/* ===== doc-audit.jsx ===== */
(function(){
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
(function () {
  const {
    useState,
    useEffect,
    useMemo,
    useRef,
    useCallback
  } = React;
  const DA = window.UNICO_DA;
  const W = window;
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
      window.dispatchEvent(new Event('unico:da-refresh'));
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
  const when = t => t ? new Date(t).toLocaleString('en-GB', {
    timeZone: 'Asia/Dhaka',
    dateStyle: 'medium',
    timeStyle: 'short'
  }) : '';
  const me = () => window.__UNICO_USER__ && (window.__UNICO_USER__.name || window.__UNICO_USER__.username) || '';
  const sigNames = () => {
    try {
      return window.unicoSig ? window.unicoSig.load() : {};
    } catch (e) {
      return {};
    }
  };
  const pctTxt = v => v == null ? '—' : Math.round(v * 10) / 10 + '%';
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
  const post = (url, body, method) => api(url, {
    method: method || 'POST',
    body: JSON.stringify(body || {})
  });
  async function download(url, fallback) {
    const r = await fetch(url, {
      credentials: 'same-origin',
      cache: 'no-store'
    });
    if (!r.ok) {
      const j = await r.json().catch(() => null);
      throw new Error(j && j.error || 'Could not build the file.');
    }
    const m = /filename="([^"]+)"/.exec(r.headers.get('content-disposition') || '');
    const href = URL.createObjectURL(await r.blob());
    const a = document.createElement('a');
    a.href = href;
    a.download = m ? m[1] : fallback || 'Documentation-Audit.xlsx';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 4000);
  }
  const CSS = `
.da-wrap{display:flex;flex-direction:column;gap:14px}
.da-card{background:#fff;border:1px solid var(--line);border-radius:14px;box-shadow:0 1px 2px rgba(13,27,46,.04)}
.da-pad{padding:14px 16px}
.da-h{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:12px 16px;border-bottom:1px solid var(--line-2)}
.da-h h3{margin:0;font-size:14.5px;font-weight:700;color:var(--ink)}.da-h .grow{flex:1}
.da-sub{font-size:11.5px;color:var(--muted)}
.da-muted{color:var(--muted)}
.da-bar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;padding:10px 14px}
.da-sel,.da-in,.da-ta{padding:7px 10px;border-radius:8px;border:1px solid var(--line);background:#fff;font:inherit;font-size:12.8px;color:var(--ink-2);box-sizing:border-box}
.da-sel{max-width:280px}.da-in{min-width:0}.da-ta{width:100%;resize:vertical;min-height:56px;line-height:1.4}
.da-in.bad,.da-sel.bad,.da-ta.bad{border-color:var(--rose);box-shadow:0 0 0 2px rgba(210,58,82,.14)}
.da-btn{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);background:#fff;color:var(--ink-2);border-radius:8px;padding:7px 13px;font:inherit;font-size:12.6px;font-weight:600;cursor:pointer;white-space:nowrap}
.da-btn:hover{background:var(--blue-50)}.da-btn:disabled{opacity:.5;cursor:default}
.da-btn.pri{background:var(--blue);border-color:var(--blue);color:#fff}.da-btn.pri:hover{filter:brightness(1.06)}
.da-btn.ok{background:#1f9d57;border-color:#1f9d57;color:#fff}.da-btn.danger{color:var(--rose);border-color:#f1c6cd}
.da-btn.sm{padding:4px 9px;font-size:11.5px}
.da-grid{display:grid;gap:10px}
.da-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px 14px}
.da-f label{display:block;font-size:10.8px;font-weight:700;letter-spacing:.3px;text-transform:uppercase;color:var(--muted);margin-bottom:4px}
.da-f .da-in,.da-f .da-sel{width:100%;max-width:none}
.da-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.da-tile{padding:12px 14px;border-radius:12px;border:1px solid var(--line);background:#fff}
.da-tile span{display:block;font-size:10.5px;text-transform:uppercase;letter-spacing:.4px;color:var(--muted);font-weight:700}
.da-tile b{display:block;font-size:22px;font-weight:800;color:var(--ink);font-variant-numeric:tabular-nums;margin-top:2px}
.da-tile small{color:var(--muted);font-size:11px}
.da-tbl{border-collapse:separate;border-spacing:0;width:100%;font-size:12.5px}
.da-tbl th{text-align:left;padding:8px 9px;font-size:10.5px;text-transform:uppercase;letter-spacing:.3px;color:var(--muted);font-weight:700;border-bottom:1px solid var(--line);background:var(--blue-50);white-space:nowrap}
.da-tbl td{padding:7px 9px;border-bottom:1px solid var(--line-2);vertical-align:top}
.da-tbl tr.click{cursor:pointer}.da-tbl tr.click:hover td{background:#f6fafd}
.da-tbl td.n,.da-tbl th.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.da-tbl tr.tot td{font-weight:700;background:#eef4fa;border-top:1.5px solid var(--blue-700,#0b4f6c)}
.da-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
.da-chip{display:inline-block;padding:2px 8px;border-radius:999px;font-size:10.5px;font-weight:700;letter-spacing:.2px;white-space:nowrap}
.da-chip.draft{background:#eef2f6;color:#5b6878}.da-chip.completed{background:#fbf0dd;color:#8a5a00}
.da-chip.acknowledged{background:var(--blue-50);color:var(--blue-700,#0b4f6c)}.da-chip.signed{background:#e7f6ed;color:#14713f}
.da-chip.pass{background:#e7f6ed;color:#14713f}.da-chip.fail{background:#fde4e8;color:#a3172f}
.da-chip.crit{background:#a3172f;color:#fff}.da-chip.jci{background:#eef2f6;color:#3a4656;font-weight:600;padding:1px 6px}
.da-chip.met{background:#e7f6ed;color:#14713f}.da-chip.off{background:#fde4e8;color:#a3172f}
.da-empty{padding:26px 12px;text-align:center;color:var(--muted);font-size:12.8px}
.da-banner{display:flex;gap:10px;align-items:flex-start;padding:10px 14px;border-radius:10px;border:1px solid #f0d49a;background:#fff8e9;color:#7a4b00;font-size:12.5px}
.da-banner.red{border-color:#f3c2cb;background:#fdf0f2;color:#8f1d33}.da-banner.blue{border-color:#bfe0f2;background:#eef8fd;color:#0b4f6c}.da-banner.green{border-color:#bfe6cf;background:#ecf8f1;color:#14713f}
.da-form{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:14px;align-items:start}
@media (max-width:1050px){.da-form{grid-template-columns:minmax(0,1fr)}}
.da-side{position:sticky;top:8px;display:flex;flex-direction:column;gap:12px}
@media (max-width:1050px){.da-side{position:static}}
.da-sec{padding:9px 16px;background:linear-gradient(180deg,#f4f8fc,#eef4fa);border-bottom:1px solid var(--line-2);border-top:1px solid var(--line-2);display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.da-sec b{font-size:12px;letter-spacing:.5px;text-transform:uppercase;color:#0b4f6c}.da-sec .jcis{font-size:10.5px;color:var(--muted)}
.da-row{display:grid;grid-template-columns:34px minmax(0,1fr) auto;gap:10px;padding:10px 16px;border-bottom:1px solid var(--line-2);align-items:start}
.da-row.no{background:#fff7f8}.da-row.crit-no{background:#fdeff2;box-shadow:inset 4px 0 0 #a3172f}.da-row.miss{box-shadow:inset 4px 0 0 var(--rose)}
.da-row .num{font-weight:800;color:#0b4f6c;font-size:13px;padding-top:4px;text-align:center}
.da-row .txt{font-size:13px;line-height:1.45;color:var(--ink)}
.da-row .meta{display:flex;gap:5px;flex-wrap:wrap;margin-top:5px}
.da-yn{display:inline-flex;border:1px solid var(--line);border-radius:9px;overflow:hidden;background:#fff}
.da-yn button{border:0;background:#fff;padding:7px 12px;font:inherit;font-size:12px;font-weight:700;color:var(--ink-2);cursor:pointer;min-width:46px}
.da-yn button+button{border-left:1px solid var(--line)}
.da-yn button.on.Y{background:#1f9d57;color:#fff}.da-yn button.on.N{background:#d23a52;color:#fff}.da-yn button.on.NA{background:#5b6878;color:#fff}
.da-yn button:disabled{opacity:.35;cursor:not-allowed}
.da-ev{grid-column:2 / 4;margin-top:2px}
.da-res{padding:14px 16px}
.da-res .big{font-size:34px;font-weight:800;font-variant-numeric:tabular-nums;line-height:1}
.da-res .grade{font-size:13px;font-weight:700;margin-top:4px}
.da-kv{display:grid;grid-template-columns:1fr auto;gap:4px 10px;font-size:12.5px;margin-top:10px}
.da-kv span{color:var(--muted)}.da-kv b{font-variant-numeric:tabular-nums;text-align:right}
.da-prog{height:6px;border-radius:4px;background:#eef2f6;overflow:hidden;margin-top:10px}.da-prog i{display:block;height:100%;background:var(--blue);transition:width .25s}
.da-chain{display:flex;flex-direction:column;gap:0}
.da-step{display:grid;grid-template-columns:24px 1fr;gap:8px;padding:8px 0;font-size:12.3px}
.da-step i{width:18px;height:18px;border-radius:50%;border:2px solid #cfd8e3;display:block;margin-top:1px}
.da-step.done i{background:#1f9d57;border-color:#1f9d57}.da-step.now i{border-color:var(--blue);box-shadow:0 0 0 3px rgba(0,144,202,.18)}
.da-step small{display:block;color:var(--muted);font-size:11px}
.da-dd{position:fixed;z-index:7001;background:#fff;border:1px solid var(--line);border-radius:10px;box-shadow:0 12px 34px rgba(13,27,46,.18);overflow:auto}
.da-dd .it{padding:8px 11px;cursor:pointer;border-bottom:1px solid var(--line-2);font-size:12.5px}
.da-dd .it:hover,.da-dd .it.hi{background:var(--blue-50)}.da-dd .it.off{opacity:.45;cursor:not-allowed}
.da-dd .it small{display:block;color:var(--muted);font-size:11px}
.da-modal-bg{position:fixed;inset:0;z-index:7000;background:rgba(13,27,46,.42);display:grid;place-items:center;padding:16px}
.da-modal{background:#fff;border-radius:14px;width:100%;max-width:560px;max-height:calc(100vh - 32px);display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(13,27,46,.3)}
.da-modal-h{display:flex;align-items:center;gap:10px;padding:13px 16px;border-bottom:1px solid var(--line-2)}.da-modal-h b{flex:1;font-size:14px}
.da-modal-h button{border:0;background:transparent;font-size:20px;line-height:1;cursor:pointer;color:var(--muted)}
.da-modal-b{padding:14px 16px;overflow:auto;display:flex;flex-direction:column;gap:10px}
.da-modal-f{display:flex;gap:8px;justify-content:flex-end;padding:12px 16px;border-top:1px solid var(--line-2);flex-wrap:wrap}
.da-gap{display:grid;grid-template-columns:44px minmax(0,1fr) 120px;gap:10px;align-items:center;padding:7px 0;border-bottom:1px solid var(--line-2);font-size:12.3px}
.da-gap .bar{height:10px;border-radius:5px;background:#eef2f6;overflow:hidden}.da-gap .bar i{display:block;height:100%;background:#d23a52}
.da-heat td.v{text-align:center;font-variant-numeric:tabular-nums;font-weight:700;font-size:12px}
.da-tabs{display:flex;gap:6px;flex-wrap:wrap}
.da-switch{display:inline-flex;align-items:center;gap:8px;cursor:pointer;font-size:12.5px;user-select:none}
.da-switch i{width:34px;height:19px;border-radius:999px;background:#cfd8e3;position:relative;transition:background .15s;flex:none}
.da-switch i:after{content:'';position:absolute;top:2px;left:2px;width:15px;height:15px;border-radius:50%;background:#fff;transition:left .15s;box-shadow:0 1px 2px rgba(0,0,0,.2)}
.da-switch.on i{background:#1f9d57}.da-switch.on i:after{left:17px}
.da-ed-row{display:grid;grid-template-columns:30px 90px minmax(0,1fr) 110px auto;gap:8px;align-items:start;padding:8px 0;border-bottom:1px solid var(--line-2)}
.da-ed-row.off{opacity:.5}
@media (max-width:760px){.da-row{grid-template-columns:28px minmax(0,1fr)}.da-row .da-yn{grid-column:2}.da-ev{grid-column:2}.da-ed-row{grid-template-columns:1fr}}
/* Smooth state changes: colours fade instead of snapping, a chosen Yes / No / N/A pops in, the
   evidence box, drop-downs and dialogs ease in, buttons give a little press. Off for anyone who
   asked their system for less motion. */
.da-btn,.da-yn button,.da-in,.da-sel,.da-ta,.da-tile,.da-row,.da-tbl tr.click td,.da-dd .it,.da-wrap .seg button{transition:background-color .2s ease,color .2s ease,border-color .2s ease,box-shadow .2s ease,transform .12s ease,opacity .2s ease}
.da-btn:hover:not(:disabled){box-shadow:0 3px 10px rgba(13,27,46,.08)}
.da-btn:active:not(:disabled),.da-yn button:active:not(:disabled),.da-wrap .seg button:active{transform:scale(.96)}
.da-yn button.on{animation:da-pop .24s ease;box-shadow:inset 0 0 0 1px rgba(0,0,0,.05)}
@keyframes da-pop{0%{transform:scale(.88)}60%{transform:scale(1.05)}100%{transform:scale(1)}}
.da-ev,.da-dd,.da-modal{animation:da-in .2s ease}
@keyframes da-in{from{opacity:0;transform:translateY(-5px)}to{opacity:1;transform:none}}
.da-modal-bg{animation:da-fade .18s ease}
@keyframes da-fade{from{opacity:0}to{opacity:1}}
.da-res .big,.da-res .grade,.da-res .da-chip{transition:color .3s ease,background-color .3s ease}
.da-tile:hover{box-shadow:0 4px 14px rgba(13,27,46,.07)}
.da-step i{transition:background-color .25s ease,border-color .25s ease,box-shadow .25s ease}
@media (prefers-reduced-motion:reduce){.da-wrap *,.da-dd,.da-dd *,.da-modal,.da-modal-bg{animation:none!important;transition:none!important}}
`;
  function useStyles() {
    useEffect(() => {
      if (document.getElementById('da-css')) return;
      const s = document.createElement('style');
      s.id = 'da-css';
      s.textContent = CSS;
      document.head.appendChild(s);
    }, []);
  }
  const StatusChip = ({
    s
  }) => React.createElement("span", {
    className: 'da-chip ' + s
  }, DA.STATUS_LABEL[s] || s);
  const ResultChip = ({
    r
  }) => !r || !r.result ? React.createElement("span", {
    className: "da-muted"
  }, "\u2014") : React.createElement("span", {
    className: 'da-chip ' + (r.result === 'PASS' ? 'pass' : 'fail')
  }, r.result);
  const gradeColor = g => ({
    excellent: '#14713f',
    good: '#1f9d57',
    improve: '#8a5a00',
    unsat: '#a3172f'
  })[g] || 'var(--muted)';
  const Switch = ({
    on,
    onClick,
    children,
    disabled
  }) => React.createElement("span", {
    className: 'da-switch' + (on ? ' on' : ''),
    onClick: () => !disabled && onClick && onClick(),
    style: disabled ? {
      opacity: .5,
      cursor: 'default'
    } : null
  }, React.createElement("i", null), children);
  function Modal({
    title,
    onClose,
    children,
    footer,
    wide
  }) {
    useEffect(() => {
      const k = e => {
        if (e.key === 'Escape') onClose();
      };
      document.addEventListener('keydown', k);
      return () => document.removeEventListener('keydown', k);
    }, []);
    return ReactDOM.createPortal(React.createElement("div", {
      className: "da-modal-bg",
      onMouseDown: e => {
        if (e.target === e.currentTarget) onClose();
      }
    }, React.createElement("div", {
      className: "da-modal",
      style: wide ? {
        maxWidth: 980
      } : null,
      role: "dialog",
      "aria-label": title
    }, React.createElement("div", {
      className: "da-modal-h"
    }, React.createElement("b", null, title), React.createElement("button", {
      onClick: onClose,
      "aria-label": "Close"
    }, "\xD7")), React.createElement("div", {
      className: "da-modal-b"
    }, children), footer && React.createElement("div", {
      className: "da-modal-f"
    }, footer))), document.body);
  }
  function askText(o) {
    return new Promise(done => {
      const host = document.createElement('div');
      document.body.appendChild(host);
      const root = ReactDOM.createRoot ? ReactDOM.createRoot(host) : null;
      const close = v => {
        if (root) root.unmount();else ReactDOM.unmountComponentAtNode(host);
        host.remove();
        done(v);
      };
      function Ask() {
        const [v, setV] = useState('');
        const short = (o.min || 0) > v.trim().length;
        return React.createElement(Modal, {
          title: o.title,
          onClose: () => close(null),
          footer: React.createElement(React.Fragment, null, React.createElement("button", {
            className: "da-btn",
            onClick: () => close(null)
          }, "Cancel"), React.createElement("button", {
            className: 'da-btn ' + (o.danger ? 'danger' : 'pri'),
            disabled: short,
            onClick: () => close(v.trim())
          }, o.confirmLabel || 'OK'))
        }, o.message && React.createElement("div", {
          style: {
            fontSize: 12.8,
            lineHeight: 1.5
          }
        }, o.message), React.createElement("textarea", {
          className: "da-ta",
          autoFocus: true,
          rows: 3,
          value: v,
          onChange: e => setV(e.target.value),
          placeholder: o.placeholder || ''
        }), o.min ? React.createElement("div", {
          className: "da-sub"
        }, short ? 'At least ' + o.min + ' characters.' : '') : null);
      }
      if (root) root.render(React.createElement(Ask, null));else ReactDOM.render(React.createElement(Ask, null), host);
    });
  }
  function askAck(pending) {
    return new Promise(done => {
      const host = document.createElement('div');
      document.body.appendChild(host);
      const root = ReactDOM.createRoot ? ReactDOM.createRoot(host) : null;
      const close = v => {
        if (root) root.unmount();else ReactDOM.unmountComponentAtNode(host);
        host.remove();
        done(v);
      };
      function Ask() {
        const [keys, setKeys] = useState(pending.map(DA.nurseKey));
        const [note, setNote] = useState('');
        const tog = k => setKeys(ks => ks.indexOf(k) >= 0 ? ks.filter(x => x !== k) : ks.concat([k]));
        return React.createElement(Modal, {
          title: pending.length > 1 ? 'Nurses’ acknowledgement' : 'Nurse’s acknowledgement',
          onClose: () => close(null),
          footer: React.createElement(React.Fragment, null, React.createElement("button", {
            className: "da-btn",
            onClick: () => close(null)
          }, "Cancel"), React.createElement("button", {
            className: "da-btn pri",
            disabled: !keys.length,
            onClick: () => close({
              keys,
              note: note.trim()
            })
          }, "Record acknowledgement"))
        }, React.createElement("div", {
          style: {
            fontSize: 12.8,
            lineHeight: 1.5
          }
        }, "Record that ", pending.length > 1 ? 'these nurses were' : pending[0].name + ' was', " given the same-day feedback and acknowledged this audit (policy 7.2)."), pending.length > 1 && React.createElement("div", {
          style: {
            display: 'flex',
            flexDirection: 'column',
            gap: 6
          }
        }, pending.map(n => {
          const k = DA.nurseKey(n);
          return React.createElement("label", {
            key: k,
            style: {
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              cursor: 'pointer',
              fontSize: 13
            }
          }, React.createElement("input", {
            type: "checkbox",
            checked: keys.indexOf(k) >= 0,
            onChange: () => tog(k)
          }), React.createElement("b", null, n.name), React.createElement("span", {
            className: "da-sub"
          }, nurseSub(n)));
        })), React.createElement("textarea", {
          className: "da-ta",
          rows: 2,
          value: note,
          onChange: e => setNote(e.target.value),
          placeholder: "Note (optional) \u2014 e.g. feedback given at the nurses\u2019 station; gaps explained."
        }));
      }
      if (root) root.render(React.createElement(Ask, null));else ReactDOM.render(React.createElement(Ask, null), host);
    });
  }
  function useMeta() {
    const [meta, setMeta] = useState(null);
    const [err, setErr] = useState('');
    const load = useCallback(() => api('/api/doc-audit/meta').then(setMeta).catch(e => setErr(e.message)), []);
    useEffect(() => {
      load();
    }, []);
    return [meta, err, load];
  }
  const NoDepts = ({
    meta,
    setRoute
  }) => React.createElement("div", {
    className: "da-card da-empty"
  }, meta && meta.isAdmin ? React.createElement("span", null, "No department is switched on for Nursing Documentation KPI Audit yet. Open ", React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      setRoute({
        view: 'docAuditSettings'
      });
    }
  }, "Nursing Documentation KPI Audit \u2192 Settings"), " and choose the tool each department audits with.") : React.createElement("span", null, "No department has been set for you yet. Ask the administrator to choose your departments in Access Control \u2192 Nursing Documentation KPI Audit."));
  const toolOf = (meta, id) => (meta && meta.tools || []).find(t => t.id === id) || null;
  const nurseLine = n => [n.empId && 'ID ' + n.empId, n.designation, n.department, n.linked === false && 'not in the register'].filter(Boolean).join(' · ');
  const OtherDept = ({
    n
  }) => n && n.fromOtherDept ? React.createElement("span", {
    className: "da-chip",
    style: {
      background: '#fff1d6',
      color: '#8a5a00',
      marginLeft: 5,
      verticalAlign: 1
    },
    title: "Belongs to another department"
  }, "\u21C4 Other dept", n.homeDept && n.homeDept !== n.department ? ' · ' + n.homeDept : '', " \xB7 ", n.assignment || 'Deployed') : null;
  const nurseSub = n => React.createElement(React.Fragment, null, nurseLine(n), React.createElement(OtherDept, {
    n: n
  }));
  const otherText = n => n && n.fromOtherDept ? ' — from ' + (n.homeDept || n.department || 'another department') + ', ' + String(n.assignment || 'Deployed').toLowerCase() : '';
  function NursePicker({
    meta,
    deptId,
    value,
    onChange,
    bad,
    disabled,
    excludeId
  }) {
    const picked = Array.isArray(value) ? value : [];
    const [list, setList] = useState(null);
    const [all, setAll] = useState(false);
    const [q, setQ] = useState('');
    const [open, setOpen] = useState(false);
    const [hi, setHi] = useState(0);
    const [manual, setManual] = useState(null);
    const ref = useRef(null);
    const [pos, setPos] = useState(null);
    useEffect(() => {
      if (!deptId || disabled) return;
      let live = true;
      setList(null);
      api('/api/doc-audit/staff?' + (all ? 'all=1' : 'dept=' + encodeURIComponent(deptId))).then(j => {
        if (live) setList(j.staff);
      }).catch(() => {
        if (live) setList([]);
      });
      return () => {
        live = false;
      };
    }, [deptId, all, disabled]);
    const place = () => {
      const r = ref.current && ref.current.getBoundingClientRect();
      if (!r) return;
      const below = window.innerHeight - r.bottom;
      const up = below < 240 && r.top > below;
      setPos({
        left: r.left,
        width: Math.max(r.width, 280),
        top: up ? null : r.bottom + 4,
        bottom: up ? window.innerHeight - r.top + 4 : null,
        maxH: Math.min(320, (up ? r.top : below) - 12)
      });
    };
    useEffect(() => {
      if (!open) return;
      place();
      const f = () => place();
      window.addEventListener('scroll', f, true);
      window.addEventListener('resize', f);
      const out = e => {
        if (ref.current && !ref.current.contains(e.target) && !(e.target.closest && e.target.closest('.da-dd'))) setOpen(false);
      };
      document.addEventListener('mousedown', out);
      return () => {
        window.removeEventListener('scroll', f, true);
        window.removeEventListener('resize', f);
        document.removeEventListener('mousedown', out);
      };
    }, [open]);
    const full = picked.length >= DA.MAX_NURSES;
    const needle = q.trim().toLowerCase();
    const [others, setOthers] = useState([]);
    useEffect(() => {
      if (all || disabled || needle.length < 2) {
        setOthers([]);
        return;
      }
      let live = true;
      const t = setTimeout(() => {
        api('/api/doc-audit/staff?all=1&q=' + encodeURIComponent(needle)).then(j => {
          if (live) setOthers(j.staff || []);
        }).catch(() => {});
      }, 250);
      return () => {
        live = false;
        clearTimeout(t);
      };
    }, [needle, all, disabled]);
    const isPicked = p => picked.some(n => String(n.staffId) === String(p.id));
    const self = p => meta && meta.staffId != null && String(p.id) === String(meta.staffId) || excludeId != null && String(p.id) === String(excludeId);
    const hits = (list || []).filter(p => !needle || String(p.name || '').toLowerCase().indexOf(needle) >= 0 || String(p.emp_id || '').toLowerCase().indexOf(needle) >= 0).slice(0, 80);
    const add = n => onChange(picked.concat([n]));
    const localIds = new Set((list || []).map(p => String(p.id)));
    const extra = others.filter(p => !localIds.has(String(p.id)));
    const choices = hits.concat(extra);
    const isOther = p => !all && !localIds.has(String(p.id));
    useEffect(() => {
      if (!list || all || disabled) return;
      let changed = false;
      const next = picked.map(n => {
        if (!n || n.staffId == null || n.staffId === '' || n.linked === false) return n;
        const own = localIds.has(String(n.staffId));
        if (own && n.fromOtherDept) {
          changed = true;
          const o = Object.assign({}, n);
          delete o.fromOtherDept;
          delete o.homeDept;
          delete o.assignment;
          return o;
        }
        if (!own && !n.fromOtherDept) {
          changed = true;
          return Object.assign({}, n, {
            fromOtherDept: true,
            homeDept: n.department || '',
            assignment: 'Deployed'
          });
        }
        return n;
      });
      if (changed) onChange(next);
    }, [list]);
    const pick = p => {
      if (self(p) || isPicked(p) || full) return;
      const other = isOther(p);
      add(Object.assign({
        staffId: String(p.id),
        empId: String(p.emp_id || ''),
        name: p.name,
        designation: p.designation || '',
        department: p.current_department || '',
        linked: true
      }, other ? {
        fromOtherDept: true,
        homeDept: p.current_department || '',
        assignment: 'Deployed'
      } : {}));
      setQ('');
      setHi(0);
    };
    const remove = i => onChange(picked.filter((_, j) => j !== i));
    const key = e => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setOpen(true);
        setHi(h => Math.min(h + 1, choices.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHi(h => Math.max(h - 1, 0));
      } else if (e.key === 'Enter' && open && choices[hi]) {
        e.preventDefault();
        pick(choices[hi]);
      } else if (e.key === 'Escape') setOpen(false);else if (e.key === 'Backspace' && !q && picked.length) remove(picked.length - 1);
    };
    const chips = picked.map((n, i) => React.createElement("div", {
      key: DA.nurseKey(n) + i,
      style: {
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        padding: '6px 10px',
        border: '1px solid var(--line)',
        borderRadius: 8,
        background: '#f6fafd',
        animation: 'da-in .2s ease'
      }
    }, React.createElement("span", {
      style: {
        display: 'inline-grid',
        placeItems: 'center',
        width: 20,
        height: 20,
        borderRadius: '50%',
        background: '#1f4f8a',
        color: '#fff',
        fontSize: 10.5,
        fontWeight: 800,
        flex: 'none'
      }
    }, i + 1), React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, React.createElement(Person, {
      name: n.name,
      empId: n.empId,
      size: 32,
      sub: nurseSub(n)
    }), n.fromOtherDept && !disabled && React.createElement("div", {
      style: {
        marginTop: 4,
        display: 'flex',
        gap: 6,
        alignItems: 'center',
        fontSize: 11.5
      }
    }, React.createElement("span", {
      className: "da-sub"
    }, "Here as"), React.createElement("select", {
      className: "da-sel",
      style: {
        padding: '3px 6px',
        fontSize: 11.5
      },
      value: n.assignment || 'Deployed',
      onChange: e => onChange(picked.map((x, j) => j === i ? Object.assign({}, x, {
        assignment: e.target.value
      }) : x))
    }, (meta && meta.assignments || ['Deployed', 'Relief / cover', 'Overtime', 'Float pool', 'Other']).map(a => React.createElement("option", {
      key: a,
      value: a
    }, a))))), !disabled && React.createElement("button", {
      className: "da-btn sm",
      "aria-label": 'Remove ' + n.name,
      onClick: () => remove(i)
    }, "Remove")));
    if (disabled) return React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 6
      }
    }, chips.length ? chips : React.createElement("span", null, "\u2014"));
    return React.createElement("div", {
      ref: ref,
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 6
      }
    }, chips, manual ? React.createElement("div", {
      className: "da-card da-pad",
      style: {
        padding: 10
      }
    }, React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: '2fr 1fr auto',
        gap: 6
      }
    }, React.createElement("input", {
      className: "da-in",
      autoFocus: true,
      placeholder: "Nurse's full name",
      value: manual.name,
      onChange: e => setManual(Object.assign({}, manual, {
        name: e.target.value
      }))
    }), React.createElement("input", {
      className: "da-in",
      placeholder: "Employee ID",
      value: manual.empId,
      onChange: e => setManual(Object.assign({}, manual, {
        empId: e.target.value
      }))
    }), React.createElement("button", {
      className: "da-btn sm pri",
      disabled: !manual.name.trim(),
      onClick: () => {
        add({
          staffId: null,
          empId: manual.empId.trim(),
          name: manual.name.trim(),
          designation: '',
          department: '',
          linked: false
        });
        setManual(null);
      }
    }, "Add")), React.createElement("div", {
      className: "da-sub",
      style: {
        marginTop: 4
      }
    }, "Not linked to the staff register \u2014 the audit will not show on a staff profile for this nurse. ", React.createElement("a", {
      href: "#",
      onClick: e => {
        e.preventDefault();
        setManual(null);
      }
    }, "Cancel"))) : !full && React.createElement("input", {
      className: 'da-in' + (bad ? ' bad' : ''),
      style: {
        width: '100%'
      },
      placeholder: !list ? 'Loading the staff list…' : picked.length ? 'Add another nurse — name or employee ID…' : 'Search the nurse by name or employee ID…',
      value: q,
      onFocus: () => setOpen(true),
      onChange: e => {
        setQ(e.target.value);
        setOpen(true);
        setHi(0);
      },
      onKeyDown: key
    }), React.createElement("div", {
      className: "da-sub"
    }, meta && meta.allStaff && React.createElement("label", {
      style: {
        cursor: 'pointer',
        marginRight: 10
      }
    }, React.createElement("input", {
      type: "checkbox",
      checked: all,
      onChange: e => setAll(e.target.checked),
      style: {
        verticalAlign: -2
      }
    }), " Whole register"), !full && !manual && React.createElement("a", {
      href: "#",
      style: {
        marginRight: 10
      },
      onClick: e => {
        e.preventDefault();
        setManual({
          name: '',
          empId: ''
        });
        setOpen(false);
      }
    }, "Not in the register?"), React.createElement("span", null, picked.length > 1 ? picked.length + ' nurses share this record’s checklist and score; the audit shows on each one’s record.' : 'One patient record, one checklist — add every nurse who documented in it (e.g. day + night), up to ' + DA.MAX_NURSES + '.')), open && pos && !full && !manual && ReactDOM.createPortal(React.createElement("div", {
      className: "da-dd",
      style: {
        left: pos.left,
        width: pos.width,
        top: pos.top == null ? 'auto' : pos.top,
        bottom: pos.bottom == null ? 'auto' : pos.bottom,
        maxHeight: pos.maxH
      }
    }, !list && React.createElement("div", {
      className: "it"
    }, "Loading\u2026"), list && !choices.length && React.createElement("div", {
      className: "it off"
    }, needle.length >= 2 ? 'No staff member matches “' + q + '” in any department. Use “Not in the register?”.' : 'No nurse matches “' + q + '” in this department — type 2 or more letters or digits to search every department.'), choices.map((p, i) => {
      const off = self(p) || isPicked(p);
      const other = isOther(p);
      return React.createElement(React.Fragment, {
        key: p.id
      }, other && i === hits.length && React.createElement("div", {
        className: "it off",
        style: {
          background: '#fff8e9',
          color: '#8a5a00',
          fontWeight: 700,
          fontSize: 11,
          letterSpacing: .4,
          textTransform: 'uppercase',
          cursor: 'default',
          opacity: 1
        }
      }, "Other departments \u2014 deployed / relief / float"), React.createElement("div", {
        className: 'it' + (i === hi ? ' hi' : '') + (off ? ' off' : ''),
        onMouseEnter: () => setHi(i),
        onMouseDown: e => {
          e.preventDefault();
          pick(p);
        },
        title: self(p) ? 'The auditor cannot be audited on the same record' : isPicked(p) ? 'Already added' : other ? 'Belongs to ' + (p.current_department || 'another department') : ''
      }, React.createElement(Person, {
        name: p.name + (self(p) ? ' (auditor)' : isPicked(p) ? ' ✓ added' : ''),
        empId: p.emp_id,
        size: 26,
        sub: React.createElement(React.Fragment, null, [p.emp_id && 'ID ' + p.emp_id, p.designation, p.current_department].filter(Boolean).join(' · '), other && React.createElement("span", {
          className: "da-chip",
          style: {
            background: '#fff1d6',
            color: '#8a5a00',
            marginLeft: 5
          }
        }, "\u21C4 Other dept"))
      })));
    })), document.body));
  }
  function Person({
    name,
    empId,
    sub,
    size
  }) {
    const sz = size || 26;
    const av = window.MK && window.MK.Av ? React.createElement(window.MK.Av, {
      name: name || '?',
      empId: empId || null,
      size: sz,
      style: {
        fontSize: Math.round(sz / 2.6)
      }
    }) : React.createElement("span", {
      style: {
        display: 'inline-grid',
        placeItems: 'center',
        width: sz,
        height: sz,
        borderRadius: '50%',
        background: '#e6eefb',
        color: '#1f4f8a',
        fontSize: Math.round(sz / 2.6),
        fontWeight: 800
      }
    }, String(name || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase());
    return React.createElement("div", {
      style: {
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        minWidth: 0
      }
    }, React.createElement("span", {
      style: {
        flex: 'none'
      }
    }, av), React.createElement("div", {
      style: {
        minWidth: 0
      }
    }, React.createElement("div", {
      style: {
        fontWeight: 600,
        fontSize: 12.8,
        lineHeight: 1.25
      }
    }, name || '—'), sub && React.createElement("div", {
      className: "da-sub",
      style: {
        lineHeight: 1.3
      }
    }, sub)));
  }
  const NurseList = ({
    x,
    size
  }) => {
    const ns = DA.nursesOf(x);
    return React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        minWidth: 200
      }
    }, ns.length ? ns.map(n => React.createElement(Person, {
      key: DA.nurseKey(n),
      name: n.name,
      empId: n.empId,
      size: size,
      sub: nurseSub(n)
    })) : React.createElement("span", {
      className: "da-muted"
    }, "\u2014"));
  };
  const nursesShort = x => {
    const ns = DA.nursesOf(x);
    return ns.length ? ns[0].name + (ns.length > 1 ? ' +' + (ns.length - 1) : '') : '—';
  };
  function AuditorField({
    value,
    staffId,
    onChange
  }) {
    const [list, setList] = useState(null);
    const [open, setOpen] = useState(false);
    const [hi, setHi] = useState(0);
    const [pos, setPos] = useState(null);
    const ref = useRef(null);
    useEffect(() => {
      let live = true;
      api('/api/doc-audit/staff?all=1').then(j => {
        if (live) setList(j.staff);
      }).catch(() => {
        if (live) setList([]);
      });
      return () => {
        live = false;
      };
    }, []);
    const place = () => {
      const r = ref.current && ref.current.getBoundingClientRect();
      if (!r) return;
      const below = window.innerHeight - r.bottom;
      const up = below < 240 && r.top > below;
      setPos({
        left: r.left,
        width: Math.max(r.width, 300),
        top: up ? null : r.bottom + 4,
        bottom: up ? window.innerHeight - r.top + 4 : null,
        maxH: Math.min(320, (up ? r.top : below) - 12)
      });
    };
    useEffect(() => {
      if (!open) return;
      place();
      const f = () => place();
      window.addEventListener('scroll', f, true);
      window.addEventListener('resize', f);
      const out = e => {
        if (ref.current && !ref.current.contains(e.target) && !(e.target.closest && e.target.closest('.da-dd'))) setOpen(false);
      };
      document.addEventListener('mousedown', out);
      return () => {
        window.removeEventListener('scroll', f, true);
        window.removeEventListener('resize', f);
        document.removeEventListener('mousedown', out);
      };
    }, [open]);
    const needle = String(value || '').trim().toLowerCase();
    const picked = staffId != null && staffId !== '' && (list || []).find(p => String(p.id) === String(staffId));
    const hits = (list || []).filter(p => !needle || picked && String(p.id) === String(staffId) || String(p.name || '').toLowerCase().indexOf(needle) >= 0 || String(p.emp_id || '').toLowerCase().indexOf(needle) >= 0).slice(0, 60);
    const pick = p => {
      onChange(p.name, String(p.id));
      setOpen(false);
    };
    const key = e => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setOpen(true);
        setHi(h => Math.min(h + 1, hits.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHi(h => Math.max(h - 1, 0));
      } else if (e.key === 'Enter' && open && hits[hi]) {
        e.preventDefault();
        pick(hits[hi]);
      } else if (e.key === 'Escape') setOpen(false);
    };
    return React.createElement("div", {
      ref: ref
    }, React.createElement("input", {
      className: "da-in",
      style: {
        width: '100%'
      },
      value: value || '',
      placeholder: list ? 'Search staff by name or employee ID…' : 'Loading the staff list…',
      onFocus: () => setOpen(true),
      onKeyDown: key,
      onChange: e => {
        onChange(e.target.value, null);
        setOpen(true);
        setHi(0);
      }
    }), React.createElement("div", {
      className: "da-sub",
      style: {
        marginTop: 3
      }
    }, picked ? [picked.emp_id && 'ID ' + picked.emp_id, picked.designation, picked.current_department].filter(Boolean).join(' · ') : 'Administrator: pick who audited, or type a name.'), open && pos && ReactDOM.createPortal(React.createElement("div", {
      className: "da-dd",
      style: {
        left: pos.left,
        width: pos.width,
        top: pos.top == null ? 'auto' : pos.top,
        bottom: pos.bottom == null ? 'auto' : pos.bottom,
        maxHeight: pos.maxH
      }
    }, !list && React.createElement("div", {
      className: "it"
    }, "Loading\u2026"), list && !hits.length && React.createElement("div", {
      className: "it off"
    }, "No staff member matches \u201C", value, "\u201D. The name you typed will be used."), hits.map((p, i) => React.createElement("div", {
      key: p.id,
      className: 'it' + (i === hi ? ' hi' : ''),
      onMouseEnter: () => setHi(i),
      onMouseDown: e => {
        e.preventDefault();
        pick(p);
      }
    }, React.createElement("b", null, p.name), React.createElement("small", null, [p.emp_id && 'ID ' + p.emp_id, p.designation, p.current_department].filter(Boolean).join(' · '))))), document.body));
  }
  function BlankFormButtons({
    tool,
    dept
  }) {
    const [copies, setCopies] = useState(1);
    const [busy, setBusy] = useState(false);
    const log = {
      kind: 'blank',
      dept: dept ? dept.id : undefined,
      copies
    };
    const doc = () => blankDoc(tool, dept ? dept.name : '', copies);
    return React.createElement("div", {
      style: {
        display: 'inline-flex',
        gap: 6,
        alignItems: 'center'
      },
      title: 'Blank ' + (tool.short || tool.name) + ' form for auditing on paper'
    }, React.createElement("span", {
      className: "da-sub"
    }, "Offline form"), React.createElement("input", {
      type: "number",
      min: "1",
      max: "30",
      className: "da-in",
      style: {
        width: 58,
        padding: '4px 6px'
      },
      value: copies,
      "aria-label": "Copies",
      onChange: e => setCopies(Math.max(1, Math.min(30, +e.target.value || 1)))
    }), React.createElement("span", {
      className: "da-sub"
    }, "cop", copies > 1 ? 'ies' : 'y'), React.createElement("button", {
      className: "da-btn sm",
      disabled: busy,
      onClick: () => openPrint(log, doc(), false)
    }, "Print blank form"), React.createElement("button", {
      className: "da-btn sm",
      disabled: busy,
      onClick: () => {
        setBusy(true);
        pdfFrom(log, doc(), false).catch(e => toast(e.message, 'error')).finally(() => setBusy(false));
      }
    }, "PDF"));
  }
  function AldreteField({
    value,
    onChange,
    readOnly
  }) {
    const v = value && typeof value === 'object' ? value : {};
    const c = DA.cleanAldrete(v);
    const verdict = c && c.complete ? c.total >= DA.ALDRETE_DISCHARGE ? {
      t: 'meets discharge criteria',
      bg: '#e7f6ed',
      fg: '#14713f'
    } : {
      t: 'below discharge criteria (≥ 9)',
      bg: '#fde4e8',
      fg: '#a3172f'
    } : null;
    if (readOnly) return React.createElement("div", {
      style: {
        fontSize: 13,
        paddingTop: 6
      }
    }, c ? React.createElement(React.Fragment, null, React.createElement("b", null, DA.aldreteText(v)), verdict && React.createElement("span", {
      className: "da-chip",
      style: {
        marginLeft: 6,
        background: verdict.bg,
        color: verdict.fg
      }
    }, verdict.t)) : '—');
    const setSign = (k, n) => {
      const next = Object.assign({}, v);
      if (next[k] === n) delete next[k];else next[k] = n;
      onChange(DA.cleanAldrete(next));
    };
    return React.createElement("div", {
      style: {
        display: 'flex',
        gap: 10,
        flexWrap: 'wrap',
        alignItems: 'flex-start'
      }
    }, DA.ALDRETE.map(x => React.createElement("div", {
      key: x.k,
      style: {
        minWidth: 150,
        flex: '1 1 150px'
      }
    }, React.createElement("div", {
      className: "da-sub",
      style: {
        fontWeight: 700,
        marginBottom: 3
      }
    }, x.label), React.createElement("div", {
      className: "da-yn",
      style: {
        display: 'flex'
      }
    }, [2, 1, 0].map(n => React.createElement("button", {
      key: n,
      type: "button",
      title: x.opts[n],
      className: (v[x.k] === n ? 'on ' : '') + (n === 2 ? 'Y' : n === 1 ? 'NA' : 'N'),
      style: {
        flex: 1,
        minWidth: 0
      },
      onClick: () => setSign(x.k, n)
    }, n))), React.createElement("div", {
      className: "da-sub",
      style: {
        marginTop: 2,
        minHeight: 14
      }
    }, v[x.k] != null ? x.opts[v[x.k]] : ''))), React.createElement("div", {
      style: {
        minWidth: 120,
        alignSelf: 'center'
      }
    }, React.createElement("div", {
      style: {
        fontSize: 22,
        fontWeight: 800,
        color: verdict ? verdict.fg : 'var(--ink)'
      }
    }, c ? c.total : '—', React.createElement("span", {
      className: "da-sub",
      style: {
        fontSize: 12
      }
    }, "/10")), verdict ? React.createElement("span", {
      className: "da-chip",
      style: {
        background: verdict.bg,
        color: verdict.fg
      }
    }, verdict.t) : React.createElement("span", {
      className: "da-sub"
    }, c ? 'score every sign' : 'optional')));
  }
  function ResultPanel({
    res,
    criteria,
    problems
  }) {
    const total = DA.activeCriteria(criteria).length;
    const answered = total - res.blank;
    const byId = {};
    criteria.forEach(c => {
      byId[c.id] = c;
    });
    const col = res.pct == null ? 'var(--muted)' : res.criticalFails.length ? '#a3172f' : gradeColor(res.grade);
    return React.createElement("div", {
      className: "da-card da-res"
    }, React.createElement("div", {
      className: "da-sub",
      style: {
        fontWeight: 700,
        letterSpacing: .4,
        textTransform: 'uppercase'
      }
    }, "Audit result"), React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'flex-end',
        gap: 10,
        marginTop: 6
      }
    }, React.createElement("div", {
      className: "big",
      style: {
        color: col
      }
    }, res.pct == null ? '—' : res.pct + '%'), res.result && React.createElement("span", {
      className: 'da-chip ' + (res.result === 'PASS' ? 'pass' : 'fail'),
      style: {
        fontSize: 13,
        padding: '4px 12px',
        marginBottom: 3
      }
    }, res.result)), React.createElement("div", {
      className: "grade",
      style: {
        color: col
      }
    }, res.gradeLabel || 'Answer the criteria', res.criticalFails.length ? ' · critical failure' : ''), React.createElement("div", {
      className: "da-prog"
    }, React.createElement("i", {
      style: {
        width: (total ? answered / total * 100 : 0) + '%'
      }
    })), React.createElement("div", {
      className: "da-sub",
      style: {
        marginTop: 4
      }
    }, answered, " of ", total, " criteria answered"), React.createElement("div", {
      className: "da-kv"
    }, React.createElement("span", null, "Total 'Yes' (A)"), React.createElement("b", null, res.yes), React.createElement("span", null, "Total 'No' (B)"), React.createElement("b", null, res.no), React.createElement("span", null, "Total 'N/A'"), React.createElement("b", null, res.na), React.createElement("span", null, "Applicable (A + B)"), React.createElement("b", null, res.applicable), React.createElement("span", null, "Score = A \xF7 (A + B) \xD7 100"), React.createElement("b", null, pctTxt(res.pct))), res.criticalFails.length > 0 && React.createElement("div", {
      className: "da-banner red",
      style: {
        marginTop: 10,
        padding: '8px 10px'
      }
    }, React.createElement("div", null, React.createElement("b", null, "Critical criteria marked 'No':"), " ", res.criticalFails.map(id => '#' + (byId[id] ? byId[id].no : id)).join(', '), ". Any critical failure = FAIL, whatever the score. Escalate to the Nurse In-charge today.")), res.action && React.createElement("div", {
      style: {
        marginTop: 10,
        fontSize: 12,
        lineHeight: 1.45
      }
    }, React.createElement("b", null, "Required action:"), " ", res.action), problems && problems.length > 0 && React.createElement("div", {
      style: {
        marginTop: 10,
        fontSize: 11.8,
        color: '#8a5a00'
      }
    }, React.createElement("b", null, "Before you complete:"), React.createElement("ul", {
      style: {
        margin: '4px 0 0',
        paddingLeft: 18
      }
    }, problems.slice(0, 5).map((p, i) => React.createElement("li", {
      key: i
    }, p.message)), problems.length > 5 && React.createElement("li", null, "\u2026and ", problems.length - 5, " more"))));
  }
  const OTHER = '__other__';
  function ChoiceField({
    f,
    value,
    onChange
  }) {
    const opts = f.options || [''];
    const v = value || '';
    const typed = !!v && opts.indexOf(v) < 0;
    const [typing, setTyping] = useState(typed);
    const showBox = f.other && (typing || typed);
    return React.createElement("div", null, React.createElement("select", {
      className: "da-sel",
      value: showBox ? OTHER : v,
      onChange: e => {
        if (e.target.value === OTHER) {
          setTyping(true);
          onChange('');
        } else {
          setTyping(false);
          onChange(e.target.value);
        }
      }
    }, opts.map(o => React.createElement("option", {
      key: o,
      value: o
    }, o || '—')), f.other && React.createElement("option", {
      value: OTHER
    }, "Other \u2014 type\u2026"), !f.other && typed && React.createElement("option", {
      value: v
    }, v)), showBox && React.createElement("input", {
      className: "da-in",
      style: {
        marginTop: 6
      },
      autoFocus: !typed,
      placeholder: 'Type the ' + String(f.label || 'answer').toLowerCase(),
      value: v,
      maxLength: 200,
      onChange: e => onChange(e.target.value)
    }));
  }
  function AuditForm({
    meta,
    auditId,
    initialDept,
    setRoute
  }) {
    const [loaded, setLoaded] = useState(!auditId ? {
      audit: null,
      tool: null
    } : null);
    const [err, setErr] = useState('');
    const [editing, setEditing] = useState(!auditId);
    const [busy, setBusy] = useState(false);
    const [showErr, setShowErr] = useState(false);
    const depts = meta.departments;
    const [form, setForm] = useState(null);
    const [toolId, setToolId] = useState(null);
    useEffect(() => {
      if (!auditId) return;
      let live = true;
      api('/api/doc-audit/audits/' + encodeURIComponent(auditId)).then(j => {
        if (!live) return;
        setLoaded(j);
        setForm(fromAudit(j.audit));
        setToolId(j.audit.toolId);
        setEditing(j.audit.status === 'draft' && mayWrite(j.audit, j));
      }).catch(e => setErr(e.message));
      return () => {
        live = false;
      };
    }, [auditId]);
    useEffect(() => {
      if (auditId) return;
      const d = depts.find(x => x.id === initialDept) || depts.find(x => x.id === lsGet('da_dept')) || depts[0];
      if (!d) return;
      setForm(Object.assign(blankForm(d.id), {
        area: ownArea(d, toolOf(meta, d.cfg.toolId))
      }));
      setToolId(d.cfg.toolId);
    }, [auditId]);
    function ownArea(d, t) {
      return t && DA.areasAreUnits(t) && DA.areaOfDept(d, t.header.areas) || '';
    }
    function blankForm(deptId) {
      return {
        deptId,
        area: '',
        date: meta.today,
        shift: '',
        uhid: '',
        bed: '',
        extra: {},
        nurses: [],
        answers: {},
        evidence: {},
        remarks: '',
        auditorName: meta.name,
        auditorStaffId: meta.staffId
      };
    }
    function fromAudit(a) {
      return {
        deptId: a.deptId,
        area: a.area || '',
        date: a.date,
        shift: a.shift || '',
        uhid: a.uhid || '',
        bed: a.bed || '',
        extra: a.extra || {},
        nurses: DA.nursesOf(a),
        answers: a.answers || {},
        evidence: a.evidence || {},
        remarks: a.remarks || '',
        auditorName: a.auditor && a.auditor.name || '',
        auditorStaffId: a.auditor && a.auditor.staffId || null
      };
    }
    const audit = loaded && loaded.audit;
    const tool = audit ? loaded.tool || toolOf(meta, audit.toolId) : toolOf(meta, toolId);
    const criteria = useMemo(() => audit ? audit.criteria : tool ? DA.freezeCriteria(tool) : [], [audit, tool]);
    const res = useMemo(() => DA.score(form ? form.answers : {}, criteria), [form, criteria]);
    const problems = useMemo(() => form ? DA.validate(form, criteria, {
      today: meta.today,
      tool,
      auditorStaffId: meta.staffId,
      evidenceRequired: meta.config.evidenceRequired
    }) : [], [form, criteria, tool]);
    const guide = useMemo(() => DA.guideFor(tool, form && form.area), [tool, form && form.area]);
    useEffect(() => {
      if (auditId || !form || form.area) return;
      const as = tool && tool.header && tool.header.areas || [];
      if (as.length === 1) setForm(f => f && !f.area ? Object.assign({}, f, {
        area: as[0]
      }) : f);
    }, [toolId, !!form]);
    const bad = (field, cid) => showErr && problems.some(p => p.field === field && (cid == null || p.criterion === cid));
    function mayWrite(a, r) {
      const rr = r || meta;
      if (!a) return meta.canAdd;
      const own = a.auditor && a.auditor.username === meta.user;
      if (a.status === 'signed') return !!meta.isAdmin;
      if (a.status === 'draft') return rr.canAdd || rr.canEdit;
      if (a.status === 'completed') return rr.canEdit || own && rr.canAdd;
      return rr.canEdit;
    }
    if (err) return React.createElement("div", {
      className: "da-banner red"
    }, err);
    if (!form || auditId && !loaded) return React.createElement("div", {
      className: "da-card da-empty"
    }, "Loading the audit\u2026");
    if (!auditId && !depts.length) return React.createElement(NoDepts, {
      meta: meta,
      setRoute: setRoute
    });
    if (!tool) return React.createElement("div", {
      className: "da-banner"
    }, "No audit tool is set for this department. ", meta.isAdmin ? 'Choose one in Nursing Documentation KPI Audit → Settings.' : 'Ask the administrator.');
    const set = (k, v) => setForm(f => Object.assign({}, f, {
      [k]: v
    }));
    const setAns = (cid, v) => setForm(f => {
      const answers = Object.assign({}, f.answers);
      if (answers[cid] === v) delete answers[cid];else answers[cid] = v;
      return Object.assign({}, f, {
        answers
      });
    });
    const setEv = (cid, v) => setForm(f => Object.assign({}, f, {
      evidence: Object.assign({}, f.evidence, {
        [cid]: v
      })
    }));
    const changeDept = (id, keepArea) => {
      const d = depts.find(x => x.id === id);
      lsSet('da_dept', id);
      const t = d && !audit ? toolOf(meta, d.cfg.toolId) || tool : tool;
      const own = d ? ownArea(d, t) : '';
      setForm(f => Object.assign({}, f, {
        deptId: id
      }, keepArea ? {} : own ? {
        area: own
      } : DA.areasAreUnits(t) ? {
        area: ''
      } : {}));
      if (d && !audit) setToolId(d.cfg.toolId);
    };
    const changeArea = v => {
      set('area', v);
      if (audit || !v || !DA.areasAreUnits(tool)) return;
      const d = DA.deptOfArea(v, depts);
      if (d && d.id !== form.deptId) {
        changeDept(d.id, true);
        toast('Department set to ' + d.name + ' to match the ward / unit.', 'success');
      }
    };
    const curDept = audit ? {
      id: audit.deptId,
      name: audit.deptName
    } : depts.find(d => d.id === form.deptId);
    const curOwn = curDept ? ownArea(curDept, tool) : '';
    const areaClash = !!(form.area && curOwn && form.area !== curOwn);
    const sections = (tool.sections || []).map(s => ({
      s,
      items: criteria.filter(c => c.sectionId === s.id)
    })).filter(x => x.items.length);
    const orphan = criteria.filter(c => !(tool.sections || []).some(s => s.id === c.sectionId));
    if (orphan.length) sections.push({
      s: {
        id: '_',
        title: 'Other criteria',
        jci: ''
      },
      items: orphan
    });
    const applyNa = () => setForm(f => {
      const answers = Object.assign({}, f.answers);
      guide.na.forEach(id => {
        if (!answers[id]) answers[id] = 'NA';
      });
      return Object.assign({}, f, {
        answers
      });
    });
    const sectionYes = items => setForm(f => {
      const answers = Object.assign({}, f.answers);
      items.forEach(c => {
        if (!answers[c.id]) answers[c.id] = 'Y';
      });
      return Object.assign({}, f, {
        answers
      });
    });
    const readOnly = !editing;
    async function save(complete) {
      if (complete && problems.length) {
        setShowErr(true);
        toast(problems[0].message, 'error');
        const p = problems[0];
        const el = p.criterion ? document.getElementById('da-c-' + p.criterion) : null;
        if (el) el.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
        return;
      }
      if (complete && res.criticalFails.length) {
        const ok = await confirmBox({
          title: 'Complete with a critical failure?',
          message: 'This record FAILS: critical criteria ' + res.criticalFails.map(id => '#' + (criteria.find(c => c.id === id) || {}).no).join(', ') + ' are marked No. Policy 9: correct the record today where possible, escalate to the Nurse In-charge, and file an incident report if there was harm or a near miss.',
          confirmLabel: 'Complete audit'
        });
        if (!ok) return;
      }
      let editReason;
      if (audit && audit.status === 'signed') {
        editReason = await askText({
          title: 'Correct this published audit?',
          message: 'It stays published. The reason and what changed are kept in its history' + (DA.nursesOf(audit).length ? '; if the result changes, the nurse acknowledges it again.' : '.'),
          confirmLabel: 'Save correction',
          min: 5,
          placeholder: 'Why is it corrected?'
        });
        if (!editReason) return;
      }
      setBusy(true);
      try {
        const payload = Object.assign({}, form, {
          complete: !!complete
        }, editReason ? {
          editReason
        } : {});
        let j;
        if (audit) j = await post('/api/doc-audit/audits/' + encodeURIComponent(audit.id), Object.assign(payload, {
          baseUpdatedAt: audit.updatedAt
        }), 'PUT');else j = await post('/api/doc-audit/audits', Object.assign(payload, {
          toolId: tool.id
        }));
        toast(complete || audit && audit.status !== 'draft' ? 'Audit saved — ' + (j.audit.result.pct == null ? '' : j.audit.result.pct + '% ') + j.audit.result.result : 'Draft saved.', 'success');
        refreshBadge();
        setLoaded({
          audit: j.audit,
          tool: loaded && loaded.tool ? loaded.tool : tool
        });
        setForm(fromAudit(j.audit));
        setShowErr(false);
        if (j.audit.status !== 'draft') setEditing(false);
        if (!audit) setRoute({
          view: 'docAuditNew',
          audit: j.audit.id
        });
      } catch (e) {
        if (e.body && e.body.problems) setShowErr(true);
        toast(e.message, 'error');
      } finally {
        setBusy(false);
      }
    }
    async function act(path, body, okMsg) {
      setBusy(true);
      try {
        const j = await post('/api/doc-audit/audits/' + encodeURIComponent(audit.id) + path, body);
        setLoaded({
          audit: j.audit,
          tool
        });
        setForm(fromAudit(j.audit));
        toast(okMsg, 'success');
        refreshBadge();
      } catch (e) {
        toast(e.message, 'error');
      } finally {
        setBusy(false);
      }
    }
    async function ack() {
      const pending = DA.pendingAcks(audit);
      const r = await askAck(pending);
      if (!r) return;
      act('/ack', {
        keys: r.keys,
        note: r.note
      }, r.keys.length === pending.length ? 'Acknowledgement recorded.' : r.keys.length + ' acknowledgement(s) recorded — ' + (pending.length - r.keys.length) + ' still waiting.');
    }
    async function sign() {
      const note = await askText({
        title: 'Publish this audit?',
        message: 'Publishing releases the result to the nurse' + (DA.nursesOf(audit).length > 1 ? 's' : '') + ' (My Profile) and locks the audit; only an administrator can reopen it.' + (DA.pendingAcks(audit).length ? ' Acknowledgement is optional — the nurse can still acknowledge after publishing.' : ''),
        confirmLabel: 'Publish',
        placeholder: 'Comment (optional)'
      });
      if (note == null) return;
      act('/sign', {
        note
      }, 'Published.');
    }
    async function reopen() {
      const reason = await askText({
        title: 'Reopen this audit?',
        message: 'It is taken back from the nurse; the publication is kept in the history. Say why it is reopened.',
        confirmLabel: 'Reopen',
        min: 5
      });
      if (!reason) return;
      act('/reopen', {
        reason
      }, 'Reopened.');
    }
    async function remove() {
      const reason = await askText({
        title: 'Remove this audit?',
        message: 'It leaves the register and the KPIs. Nothing is deleted: it stays in the history.',
        confirmLabel: 'Remove',
        danger: true,
        placeholder: 'Reason (optional)'
      });
      if (reason == null) return;
      try {
        await api('/api/doc-audit/audits/' + encodeURIComponent(audit.id), {
          method: 'DELETE',
          body: JSON.stringify({
            reason
          })
        });
        toast('Audit removed.', 'success');
        refreshBadge();
        setRoute({
          view: 'docAuditRegister'
        });
      } catch (e) {
        toast(e.message, 'error');
      }
    }
    const header = React.createElement("div", {
      className: "da-card"
    }, React.createElement("div", {
      className: "da-h"
    }, React.createElement("h3", null, tool.name), React.createElement("span", {
      className: "da-sub"
    }, [tool.code, tool.version && 'v' + tool.version, audit && audit.toolRevision > 1 ? 'tool revision ' + audit.toolRevision : ''].filter(Boolean).join(' · ')), React.createElement("span", {
      className: "grow"
    }), audit && React.createElement(StatusChip, {
      s: audit.status
    })), React.createElement("div", {
      className: "da-pad da-fields"
    }, React.createElement("div", {
      className: "da-f"
    }, React.createElement("label", null, "Department"), readOnly || audit ? React.createElement("div", {
      style: {
        fontSize: 13,
        fontWeight: 600,
        paddingTop: 6
      }
    }, audit ? audit.deptName : (depts.find(d => d.id === form.deptId) || {}).name) : React.createElement("select", {
      className: "da-sel",
      value: form.deptId,
      onChange: e => changeDept(e.target.value)
    }, depts.map(d => React.createElement("option", {
      key: d.id,
      value: d.id
    }, d.name)))), !audit && meta.tools.length > 1 && (meta.isAdmin || meta.allStaff) && React.createElement("div", {
      className: "da-f"
    }, React.createElement("label", null, "Audit tool"), React.createElement("select", {
      className: "da-sel",
      value: toolId || '',
      onChange: e => {
        const nt = e.target.value;
        setToolId(nt);
        setForm(f => Object.assign({}, f, {
          answers: {},
          evidence: {},
          area: ownArea(depts.find(d => d.id === f.deptId), toolOf(meta, nt)),
          extra: {}
        }));
      }
    }, meta.tools.map(t => React.createElement("option", {
      key: t.id,
      value: t.id
    }, t.short || t.name)))), React.createElement("div", {
      className: "da-f"
    }, React.createElement("label", null, tool.header && tool.header.areaLabel || 'Area'), readOnly ? React.createElement("div", {
      style: {
        fontSize: 13,
        paddingTop: 6
      }
    }, form.area || '—') : tool.header && tool.header.areas && tool.header.areas.length ? React.createElement("select", {
      className: "da-sel",
      value: form.area,
      onChange: e => changeArea(e.target.value)
    }, React.createElement("option", {
      value: ""
    }, "\u2014"), tool.header.areas.map(x => React.createElement("option", {
      key: x
    }, x))) : React.createElement("input", {
      className: "da-in",
      value: form.area,
      onChange: e => set('area', e.target.value)
    }), areaClash && React.createElement("div", {
      style: {
        marginTop: 4,
        fontSize: 11.5,
        color: '#8a5a00',
        lineHeight: 1.35
      }
    }, form.area, " is not ", curDept.name, "; nurses and results are counted for ", curDept.name, ".")), React.createElement("div", {
      className: "da-f"
    }, React.createElement("label", null, "Audit date"), readOnly ? React.createElement("div", {
      style: {
        fontSize: 13,
        paddingTop: 6
      }
    }, DA.fmtDate(form.date)) : React.createElement("input", {
      type: "date",
      className: 'da-in' + (bad('date') ? ' bad' : ''),
      max: meta.today,
      value: form.date,
      onChange: e => set('date', e.target.value)
    })), React.createElement("div", {
      className: "da-f"
    }, React.createElement("label", null, "Shift"), readOnly ? React.createElement("div", {
      style: {
        fontSize: 13,
        paddingTop: 6
      }
    }, form.shift || '—') : React.createElement("div", {
      className: "seg"
    }, DA.SHIFTS.map(s => React.createElement("button", {
      key: s,
      className: form.shift === s ? 'on' : '',
      onClick: () => set('shift', form.shift === s ? '' : s)
    }, s)))), React.createElement("div", {
      className: "da-f"
    }, React.createElement("label", null, "Patient UHID / MRN"), readOnly ? React.createElement("div", {
      style: {
        fontSize: 13,
        paddingTop: 6
      }
    }, form.uhid || '—') : React.createElement("input", {
      className: 'da-in' + (bad('uhid') ? ' bad' : ''),
      value: form.uhid,
      onChange: e => set('uhid', e.target.value)
    })), React.createElement("div", {
      className: "da-f"
    }, React.createElement("label", null, tool.header && tool.header.bedLabel || 'Ward / bed no.'), readOnly ? React.createElement("div", {
      style: {
        fontSize: 13,
        paddingTop: 6
      }
    }, form.bed || '—') : React.createElement("input", {
      className: "da-in",
      value: form.bed,
      onChange: e => set('bed', e.target.value)
    })), (tool.header && tool.header.extra || []).map(f => f.type === 'aldrete' ? React.createElement("div", {
      className: "da-f",
      key: f.id,
      style: {
        gridColumn: '1 / -1'
      }
    }, React.createElement("label", null, f.label), React.createElement(AldreteField, {
      value: form.extra[f.id],
      readOnly: readOnly,
      onChange: v => set('extra', Object.assign({}, form.extra, {
        [f.id]: v
      }))
    })) : React.createElement("div", {
      className: "da-f",
      key: f.id
    }, React.createElement("label", null, f.label), readOnly ? React.createElement("div", {
      style: {
        fontSize: 13,
        paddingTop: 6
      }
    }, form.extra[f.id] || '—') : f.type === 'select' ? React.createElement(ChoiceField, {
      f: f,
      value: form.extra[f.id],
      onChange: v => set('extra', Object.assign({}, form.extra, {
        [f.id]: v
      }))
    }) : React.createElement("input", {
      className: "da-in",
      value: form.extra[f.id] || '',
      onChange: e => set('extra', Object.assign({}, form.extra, {
        [f.id]: e.target.value
      }))
    }))), React.createElement("div", {
      className: "da-f",
      style: {
        gridColumn: '1 / -1'
      }
    }, React.createElement("label", null, "Nurse(s) audited (auditees)"), React.createElement(NursePicker, {
      meta: meta,
      deptId: form.deptId,
      value: form.nurses,
      onChange: l => set('nurses', l),
      bad: bad('nurse'),
      disabled: readOnly,
      excludeId: meta.isAdmin ? form.auditorStaffId : null
    }), bad('nurse') && React.createElement("div", {
      className: "da-sub",
      style: {
        color: 'var(--rose)'
      }
    }, (problems.find(p => p.field === 'nurse') || {}).message)), React.createElement("div", {
      className: "da-f"
    }, React.createElement("label", null, "Auditor"), meta.isAdmin && !readOnly ? React.createElement(AuditorField, {
      value: form.auditorName,
      staffId: form.auditorStaffId,
      onChange: (name, id) => setForm(f => Object.assign({}, f, {
        auditorName: name,
        auditorStaffId: id
      }))
    }) : React.createElement("div", {
      style: {
        fontSize: 13,
        paddingTop: 6
      }
    }, audit ? audit.auditor.name : meta.name))));
    const guideBox = (guide.notes.length || guide.na.length || guide.never.length) && !readOnly ? React.createElement("div", {
      className: "da-banner blue"
    }, React.createElement("div", {
      style: {
        flex: 1
      }
    }, React.createElement("b", null, "How to apply the checklist in ", form.area, ":"), " ", guide.notes.join(' '), guide.never.length > 0 && React.createElement("div", {
      style: {
        marginTop: 4
      }
    }, "Never N/A here: ", guide.never.map(id => '#' + ((criteria.find(c => c.id === id) || {}).no || id)).join(', '), "."), guide.na.length > 0 && React.createElement("div", {
      style: {
        marginTop: 6
      }
    }, React.createElement("button", {
      className: "da-btn sm",
      onClick: applyNa
    }, "Mark ", guide.na.map(id => '#' + ((criteria.find(c => c.id === id) || {}).no || id)).join(', '), " as N/A"), " ", React.createElement("span", {
      className: "da-sub"
    }, "(only the unanswered ones)")))) : null;
    const checklist = React.createElement("div", {
      className: "da-card",
      style: {
        overflow: 'hidden'
      }
    }, React.createElement("div", {
      className: "da-h"
    }, React.createElement("h3", null, "Checklist"), React.createElement("span", {
      className: "da-sub"
    }, "One answer per criterion. Evidence for a 'No' is ", meta.config.evidenceRequired ? 'required' : 'optional', " (what is missing, where, date/time). N/A is not scored; unreviewed items stay blank.")), sections.map(({
      s,
      items
    }) => React.createElement(React.Fragment, {
      key: s.id
    }, React.createElement("div", {
      className: "da-sec"
    }, React.createElement("b", null, "Section ", s.id !== '_' ? s.id + ': ' : '', s.title), s.jci && React.createElement("span", {
      className: "jcis"
    }, "JCI: ", s.jci), React.createElement("span", {
      style: {
        flex: 1
      }
    }), !readOnly && items.some(c => !form.answers[c.id]) && React.createElement("button", {
      className: "da-btn sm",
      title: "Unanswered criteria of this section become Yes",
      onClick: () => sectionYes(items)
    }, "\u2713 Rest of section Yes")), items.map(c => {
      const v = form.answers[c.id];
      const never = guide.never.indexOf(c.id) >= 0;
      const cls = 'da-row' + (v === 'N' ? c.critical ? ' crit-no' : ' no' : '') + (showErr && (bad('answers', c.id) || bad('evidence', c.id)) ? ' miss' : '');
      return React.createElement("div", {
        className: cls,
        key: c.id,
        id: 'da-c-' + c.id
      }, React.createElement("div", {
        className: "num"
      }, c.no), React.createElement("div", null, React.createElement("div", {
        className: "txt"
      }, c.text), React.createElement("div", {
        className: "meta"
      }, (c.jci || []).map(j => React.createElement("span", {
        key: j,
        className: "da-chip jci"
      }, j)), c.critical && React.createElement("span", {
        className: "da-chip crit"
      }, "Critical"), never && React.createElement("span", {
        className: "da-chip jci"
      }, "never N/A here"))), React.createElement("div", {
        className: "da-yn",
        role: "radiogroup",
        "aria-label": 'Criterion ' + c.no
      }, [['Y', 'Yes'], ['N', 'No'], ['NA', 'N/A']].map(([k, l]) => React.createElement("button", {
        key: k,
        role: "radio",
        "aria-checked": v === k,
        className: (v === k ? 'on ' : '') + k,
        disabled: readOnly || k === 'NA' && never,
        onClick: () => setAns(c.id, k)
      }, l))), (v === 'N' || form.evidence[c.id] && v) && React.createElement("div", {
        className: "da-ev"
      }, readOnly ? React.createElement("div", {
        style: {
          fontSize: 12.3,
          color: v === 'N' ? '#8f1d33' : 'var(--ink-2)'
        }
      }, React.createElement("b", null, "Evidence:"), " ", form.evidence[c.id] || '—') : React.createElement("textarea", {
        className: 'da-ta' + (bad('evidence', c.id) ? ' bad' : ''),
        rows: 2,
        placeholder: v === 'N' ? "Evidence for 'No' — what is missing, where, date / time (" + (meta.config.evidenceRequired ? 'required' : 'optional') + ")" : 'Remark',
        value: form.evidence[c.id] || '',
        onChange: e => setEv(c.id, e.target.value)
      })));
    }))), React.createElement("div", {
      className: "da-pad"
    }, React.createElement("div", {
      className: "da-f"
    }, React.createElement("label", null, "Remarks / feedback given"), readOnly ? React.createElement("div", {
      style: {
        fontSize: 12.8,
        whiteSpace: 'pre-wrap'
      }
    }, form.remarks || '—') : React.createElement("textarea", {
      className: "da-ta",
      rows: 3,
      value: form.remarks,
      onChange: e => set('remarks', e.target.value),
      placeholder: "Coaching note, good practice seen, what was corrected on the spot\u2026"
    }))));
    const own = audit && audit.auditor && audit.auditor.username === meta.user;
    const chain = audit && audit.status !== 'draft' ? React.createElement("div", {
      className: "da-card da-pad"
    }, React.createElement("div", {
      className: "da-sub",
      style: {
        fontWeight: 700,
        letterSpacing: .4,
        textTransform: 'uppercase',
        marginBottom: 4
      }
    }, "Progress"), React.createElement("div", {
      className: "da-chain"
    }, React.createElement("div", {
      className: "da-step done"
    }, React.createElement("i", null), React.createElement("div", null, React.createElement("b", null, "Audited"), " by ", audit.auditor.name, React.createElement("small", null, when(audit.completedAt || audit.createdAt)))), (() => {
      const ns = DA.nursesOf(audit),
        acks = DA.acksOf(audit),
        pend = DA.pendingAcks(audit);
      return React.createElement("div", {
        className: 'da-step ' + (!pend.length ? 'done' : 'now')
      }, React.createElement("i", null), React.createElement("div", null, React.createElement("b", null, ns.length > 1 ? 'Nurses’ acknowledgement (' + (ns.length - pend.length) + ' of ' + ns.length + ')' : 'Nurse’s acknowledgement'), ns.map(n => {
        const k = acks[DA.nurseKey(n)];
        return React.createElement("small", {
          key: DA.nurseKey(n)
        }, ns.length > 1 ? n.name + ': ' : '', k ? (k.method === 'account' ? '✓ own account' : '✓ in person, recorded by ' + (k.byName || k.by)) + ' · ' + when(k.at) + (k.note ? ' · “' + k.note + '”' : '') : 'waiting' + (meta.config.ackRequired && ns.length === 1 ? ' — needed before publishing' : ''));
      }), pend.length > 0 && meta.config.ackRequired && React.createElement("small", null, "Every nurse acknowledges before publishing."), pend.length > 0 && !meta.config.ackRequired && React.createElement("small", null, "Optional."), pend.length > 0 && audit.status !== 'draft' && meta.canAdd && React.createElement("div", {
        style: {
          marginTop: 5
        }
      }, React.createElement("button", {
        className: "da-btn sm pri",
        disabled: busy,
        onClick: ack
      }, "Record acknowledgement"))));
    })(), React.createElement("div", {
      className: 'da-step ' + (audit.signoff ? 'done' : audit.status === 'acknowledged' ? 'now' : '')
    }, React.createElement("i", null), React.createElement("div", null, React.createElement("b", null, "Published"), " ", React.createElement("span", {
      className: "da-sub"
    }, "(released to the nurse)"), audit.signoff ? React.createElement("small", null, "by ", audit.signoff.name, " \xB7 ", when(audit.signoff.at), audit.signoff.note ? ' · “' + audit.signoff.note + '”' : '') : React.createElement("small", null, own && !meta.isAdmin ? 'Another person publishes your audit' : 'Not yet — the nurse does not see it'), !audit.signoff && meta.canEdit && (audit.status === 'acknowledged' || meta.isAdmin && audit.status === 'completed' || !meta.config.ackRequired && audit.status === 'completed') && (!own || meta.isAdmin) && React.createElement("div", {
      style: {
        marginTop: 5
      }
    }, React.createElement("button", {
      className: "da-btn sm ok",
      disabled: busy,
      onClick: sign
    }, "Publish"))))), (audit.corrections || []).length > 0 && React.createElement("div", {
      className: "da-sub",
      style: {
        marginTop: 6
      }
    }, "Corrected after publishing ", audit.corrections.length, "\xD7, last by ", audit.corrections[audit.corrections.length - 1].by, " \xB7 ", when(audit.corrections[audit.corrections.length - 1].at), ": \u201C", audit.corrections[audit.corrections.length - 1].reason, "\u201D"), (audit.reopened || []).length > 0 && React.createElement("div", {
      className: "da-sub",
      style: {
        marginTop: 6
      }
    }, "Reopened ", audit.reopened.length, "\xD7, last: \u201C", audit.reopened[audit.reopened.length - 1].reason, "\u201D")) : null;
    const actions = React.createElement("div", {
      className: "da-card da-pad",
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8
      }
    }, editing && React.createElement(React.Fragment, null, (!audit || audit.status === 'draft') && React.createElement("button", {
      className: "da-btn",
      disabled: busy,
      onClick: () => save(false)
    }, "Save draft"), React.createElement("button", {
      className: "da-btn pri",
      disabled: busy,
      onClick: () => save(true),
      style: {
        justifyContent: 'center'
      }
    }, audit && audit.status !== 'draft' ? 'Save correction' : 'Complete audit'), audit && audit.status !== 'draft' && React.createElement("button", {
      className: "da-btn",
      disabled: busy,
      onClick: () => {
        setForm(fromAudit(audit));
        setEditing(false);
        setShowErr(false);
      }
    }, "Cancel"), audit && audit.status === 'acknowledged' && React.createElement("div", {
      className: "da-sub"
    }, "Changing the answers clears the nurse\u2019s acknowledgement: the nurse acknowledges the corrected audit again.")), !editing && audit && mayWrite(audit) && React.createElement("button", {
      className: "da-btn",
      onClick: () => setEditing(true)
    }, audit.status === 'draft' ? 'Continue' : audit.status === 'signed' ? 'Edit (administrator)' : 'Correct this audit'), audit && audit.status !== 'draft' && meta.canPrint && React.createElement("div", {
      style: {
        display: 'flex',
        gap: 6
      }
    }, React.createElement("button", {
      className: "da-btn",
      style: {
        flex: 1,
        justifyContent: 'center'
      },
      onClick: () => printAudit(audit, tool)
    }, "Print"), React.createElement("button", {
      className: "da-btn",
      style: {
        flex: 1,
        justifyContent: 'center'
      },
      onClick: () => pdfAudit(audit, tool).catch(e => toast(e.message, 'error'))
    }, "PDF")), audit && audit.status === 'signed' && meta.isAdmin && React.createElement("button", {
      className: "da-btn",
      disabled: busy,
      onClick: reopen
    }, "Reopen (administrator)"), audit && audit.status === 'acknowledged' && meta.isAdmin && React.createElement("button", {
      className: "da-btn",
      disabled: busy,
      onClick: reopen
    }, "Reopen acknowledgement\u2026"), audit && meta.canDelete && (audit.status !== 'signed' || meta.isAdmin) && React.createElement("button", {
      className: "da-btn danger",
      disabled: busy,
      onClick: remove
    }, "Remove"), audit && audit.selfCheck === 'unknown' && React.createElement("div", {
      className: "da-sub"
    }, "Your account is not linked to a staff record, so the \u201Cown documentation\u201D check could not run."));
    return React.createElement("div", {
      className: "da-wrap"
    }, React.createElement("div", {
      style: {
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        flexWrap: 'wrap'
      }
    }, React.createElement("button", {
      className: "da-btn sm",
      onClick: () => setRoute({
        view: audit ? 'docAuditRegister' : 'docAuditHome'
      })
    }, "\u2190 ", audit ? 'Register' : 'Dashboard'), audit && audit.status !== 'draft' && React.createElement("span", {
      className: "da-sub"
    }, "Audit of ", DA.nurseNames(audit) || '—', " \xB7 ", audit.deptName, " \xB7 ", DA.fmtDate(audit.date)), React.createElement("span", {
      style: {
        flex: 1
      }
    }), !audit && meta.canPrint && React.createElement(BlankFormButtons, {
      tool: tool,
      dept: depts.find(d => d.id === form.deptId)
    }), !audit && tool.sample && React.createElement("span", {
      className: "da-sub",
      title: tool.sample.note
    }, "Sample rule: at least ", (depts.find(d => d.id === form.deptId) || {
      cfg: {}
    }).cfg.minRecords || tool.sample.minRecords, " records a month \xB7 hover for details")), React.createElement("div", {
      className: "da-form"
    }, React.createElement("div", {
      className: "da-grid",
      style: {
        gap: 14
      }
    }, header, guideBox, checklist), React.createElement("div", {
      className: "da-side"
    }, React.createElement(ResultPanel, {
      res: res,
      criteria: criteria,
      problems: editing ? problems : null
    }), chain, actions)));
  }
  function Home({
    meta,
    setRoute
  }) {
    const [sum, setSum] = useState(null);
    const [pending, setPending] = useState(null);
    const [err, setErr] = useState('');
    useEffect(() => {
      let live = true;
      const ym = meta.month;
      Promise.all([api('/api/doc-audit/summary?from=' + ym + '&to=' + ym), api('/api/doc-audit/audits?from=' + DA.addMonth(ym, -2) + '-01')]).then(([s, a]) => {
        if (!live) return;
        setSum(s);
        setPending(a.audits);
      }).catch(e => setErr(e.message));
      return () => {
        live = false;
      };
    }, []);
    if (!meta.departments.length) return React.createElement(NoDepts, {
      meta: meta,
      setRoute: setRoute
    });
    if (err) return React.createElement("div", {
      className: "da-banner red"
    }, err);
    if (!sum) return React.createElement("div", {
      className: "da-card da-empty"
    }, "Loading this month\u2019s audits\u2026");
    const ym = meta.month;
    const tot = sum.overall.months[ym];
    const toolName = id => (sum.tools.find(t => t.id === id) || {}).short || id;
    const mineDrafts = pending.filter(x => x.status === 'draft' && x.auditor.username === meta.user);
    const ackReq = meta.config.ackRequired;
    const waitAck = ackReq ? pending.filter(x => x.status === 'completed') : [];
    const waitSign = pending.filter(x => (ackReq ? x.status === 'acknowledged' : x.status === 'completed' || x.status === 'acknowledged') && (meta.isAdmin || x.auditor.username !== meta.user));
    const List = ({
      title,
      rows,
      hint
    }) => React.createElement("div", {
      className: "da-card"
    }, React.createElement("div", {
      className: "da-h"
    }, React.createElement("h3", null, title), React.createElement("span", {
      className: "da-sub"
    }, rows.length), React.createElement("span", {
      className: "grow"
    }), React.createElement("span", {
      className: "da-sub"
    }, hint)), !rows.length ? React.createElement("div", {
      className: "da-empty",
      style: {
        padding: 14
      }
    }, "Nothing waiting.") : React.createElement("div", {
      className: "da-scroll"
    }, React.createElement("table", {
      className: "da-tbl"
    }, React.createElement("tbody", null, rows.slice(0, 8).map(x => React.createElement("tr", {
      key: x.id,
      className: "click",
      onClick: () => setRoute({
        view: 'docAuditNew',
        audit: x.id
      })
    }, React.createElement("td", {
      style: {
        whiteSpace: 'nowrap'
      }
    }, DA.fmtDate(x.date)), React.createElement("td", null, React.createElement(NurseList, {
      x: x,
      size: 22
    }), React.createElement("div", {
      className: "da-sub",
      style: {
        marginTop: 3
      }
    }, x.deptName, x.area ? ' · ' + x.area : '')), React.createElement("td", {
      className: "n"
    }, pctTxt(x.result && x.result.pct)), React.createElement("td", null, React.createElement(ResultChip, {
      r: x.result
    }))))))), rows.length > 8 && React.createElement("div", {
      className: "da-pad",
      style: {
        paddingTop: 8
      }
    }, React.createElement("a", {
      href: "#",
      onClick: e => {
        e.preventDefault();
        setRoute({
          view: 'docAuditRegister'
        });
      }
    }, "All ", rows.length, " in the register \u2192")));
    return React.createElement("div", {
      className: "da-wrap"
    }, React.createElement("div", {
      className: "da-card da-bar"
    }, React.createElement("div", null, React.createElement("b", {
      style: {
        fontSize: 15
      }
    }, "Nursing Documentation KPI Audit \xB7 ", DA.fmtMonth(ym)), React.createElement("div", {
      className: "da-sub"
    }, "Score = Yes \xF7 (Yes + No) \xD7 100 \xB7 PASS = \u2265 90% and no critical failure \xB7 results go to the Nursing Quality Committee by the 10th")), React.createElement("span", {
      style: {
        flex: 1
      }
    }), meta.canAdd && React.createElement("button", {
      className: "da-btn pri",
      onClick: () => setRoute({
        view: 'docAuditNew'
      })
    }, "+ New audit"), React.createElement("button", {
      className: "da-btn",
      onClick: () => setRoute({
        view: 'docAuditReports'
      })
    }, "Reports")), meta.config.kpiLink && React.createElement("div", {
      className: "da-banner blue",
      style: {
        padding: '8px 12px'
      }
    }, React.createElement("div", null, "Every completed audit feeds ", React.createElement("b", null, "Nursing KPI 2C \u2014 Documentation Accuracy"), " automatically (\u03A3 Yes \xF7 \u03A3 Yes + No, all departments).")), React.createElement("div", {
      className: "da-tiles"
    }, React.createElement("div", {
      className: "da-tile"
    }, React.createElement("span", null, "Records audited"), React.createElement("b", null, tot.records), React.createElement("small", null, tot.nurses, " nurse(s)")), React.createElement("div", {
      className: "da-tile"
    }, React.createElement("span", null, "Documentation accuracy"), React.createElement("b", {
      style: {
        color: tot.accuracy == null ? undefined : tot.accuracy >= 90 ? '#14713f' : '#a3172f'
      }
    }, pctTxt(tot.accuracy)), React.createElement("small", null, "target \u2265 90%")), React.createElement("div", {
      className: "da-tile"
    }, React.createElement("span", null, "Critical failures"), React.createElement("b", {
      style: {
        color: tot.criticalRecords ? '#a3172f' : undefined
      }
    }, tot.criticalRecords), React.createElement("small", null, tot.records ? pctTxt(DA.round1(tot.criticalRecords / tot.records * 100)) + ' of records · target ≤ 5%' : 'target ≤ 5%')), React.createElement("div", {
      className: "da-tile"
    }, React.createElement("span", null, "Ready to publish"), React.createElement("b", null, waitSign.length), React.createElement("small", null, ackReq ? waitAck.length + ' waiting for acknowledgement' : 'not yet seen by the nurse'))), React.createElement("div", {
      className: "da-card"
    }, React.createElement("div", {
      className: "da-h"
    }, React.createElement("h3", null, "Departments this month"), React.createElement("span", {
      className: "grow"
    }), React.createElement("span", {
      className: "da-sub"
    }, "Policy 7.1: a minimum sample per unit each month, all shifts; each nurse at least once a quarter.")), React.createElement("div", {
      className: "da-scroll"
    }, React.createElement("table", {
      className: "da-tbl"
    }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Department"), React.createElement("th", null, "Tool"), React.createElement("th", null, "Records"), React.createElement("th", {
      className: "n"
    }, "Accuracy"), React.createElement("th", {
      className: "n"
    }, "Critical"), React.createElement("th", null, "Below target"), React.createElement("th", null, "Top failing criteria"), meta.canAdd && React.createElement("th", null))), React.createElement("tbody", null, sum.rows.map(r => {
      const s = r.months[ym];
      const min = r.minRecords || 0;
      const k1 = s.kpis.find(k => k.formula === 'accuracy');
      return React.createElement("tr", {
        key: r.deptId + r.toolId
      }, React.createElement("td", null, React.createElement("b", null, r.name)), React.createElement("td", {
        className: "da-sub"
      }, toolName(r.toolId)), React.createElement("td", {
        style: {
          minWidth: 120
        }
      }, React.createElement("b", null, s.records), min ? React.createElement("span", {
        className: "da-sub"
      }, " / ", min) : null, min > 0 && React.createElement("div", {
        className: "da-prog",
        style: {
          marginTop: 4
        }
      }, React.createElement("i", {
        style: {
          width: Math.min(100, s.records / min * 100) + '%',
          background: s.records >= min ? '#1f9d57' : undefined
        }
      }))), React.createElement("td", {
        className: "n",
        style: {
          color: k1 && k1.met === false ? '#a3172f' : undefined,
          fontWeight: 700
        }
      }, pctTxt(k1 && k1.value)), React.createElement("td", {
        className: "n",
        style: {
          color: s.criticalRecords ? '#a3172f' : undefined
        }
      }, s.criticalRecords || ''), React.createElement("td", null, s.records ? s.belowTarget.length ? s.kpis.filter(k => k.met === false).map(k => React.createElement("span", {
        key: k.id,
        className: "da-chip off",
        style: {
          marginRight: 3
        }
      }, k.name)) : React.createElement("span", {
        className: "da-chip met"
      }, "On target") : React.createElement("span", {
        className: "da-muted"
      }, "\u2014")), React.createElement("td", {
        style: {
          fontSize: 11.8
        }
      }, s.topFailing.map(g => '#' + g.no + ' ×' + g.count).join(', ') || React.createElement("span", {
        className: "da-muted"
      }, "\u2014")), meta.canAdd && React.createElement("td", null, React.createElement("button", {
        className: "da-btn sm",
        onClick: () => {
          lsSet('da_dept', r.deptId);
          setRoute({
            view: 'docAuditNew',
            dept: r.deptId
          });
        }
      }, "+ Audit")));
    }))))), React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))',
        gap: 14
      }
    }, meta.canAdd && mineDrafts.length > 0 && React.createElement(List, {
      title: "Your drafts",
      rows: mineDrafts,
      hint: "not results yet"
    }), ackReq && React.createElement(List, {
      title: "Waiting for the nurse\u2019s acknowledgement",
      rows: waitAck,
      hint: "same-day feedback"
    }), meta.canEdit && React.createElement(List, {
      title: "Ready to publish",
      rows: waitSign,
      hint: "released to the nurse, then locked \u2014 or tick many in the Register"
    })));
  }
  function Register({
    meta,
    setRoute,
    nurse
  }) {
    const firstOf = ym => ym + '-01';
    const [f, setF] = useState(() => ({
      dept: '',
      from: firstOf(DA.addMonth(meta.month, -2)),
      to: meta.today,
      status: '',
      result: '',
      tool: '',
      q: '',
      nurse: nurse || ''
    }));
    const [data, setData] = useState(null);
    const [err, setErr] = useState('');
    useEffect(() => {
      let live = true;
      setData(null);
      const qs = ['from=' + f.from, 'to=' + f.to, f.dept && 'dept=' + encodeURIComponent(f.dept), f.status && 'status=' + f.status, f.result && 'result=' + f.result, f.tool && 'tool=' + f.tool, f.nurse && 'nurse=' + encodeURIComponent(f.nurse)].filter(Boolean).join('&');
      api('/api/doc-audit/audits?' + qs).then(j => {
        if (live) setData(j);
      }).catch(e => setErr(e.message));
      return () => {
        live = false;
      };
    }, [f.dept, f.from, f.to, f.status, f.result, f.tool, f.nurse]);
    const set = (k, v) => setF(x => Object.assign({}, x, {
      [k]: v
    }));
    const needle = f.q.trim().toLowerCase();
    const rows = data ? data.audits.filter(x => !needle || [DA.nursesOf(x).map(n => n.name + ' ' + (n.empId || '')).join(' '), x.uhid, x.auditor && x.auditor.name, x.area].join(' ').toLowerCase().indexOf(needle) >= 0) : [];
    const months = DA.monthsBetween(f.from.slice(0, 7), f.to.slice(0, 7), 36);
    const [picked, setPicked] = useState([]);
    const [busy, setBusy] = useState(false);
    const [reload, setReload] = useState(0);
    useEffect(() => {
      setPicked([]);
    }, [f.dept, f.from, f.to, f.status, f.result, f.tool, f.nurse, reload]);
    const shownIds = rows.map(x => x.id);
    const allOn = shownIds.length > 0 && shownIds.every(id => picked.indexOf(id) >= 0);
    const toggle = id => setPicked(p => p.indexOf(id) >= 0 ? p.filter(x => x !== id) : p.concat([id]));
    const sel = rows.filter(x => picked.indexOf(x.id) >= 0);
    const count = st => sel.filter(x => Array.isArray(st) ? st.indexOf(x.status) >= 0 : x.status === st).length;
    async function bulk(action) {
      const n = action === 'complete' ? count('draft') : action === 'publish' ? count(['completed', 'acknowledged']) : sel.length;
      const words = {
        complete: ['Complete ' + n + ' draft(s)?', 'Fully answered drafts become Completed audits; unfinished ones are skipped and listed.', 'Complete'],
        publish: ['Publish ' + n + ' audit(s)?', 'They are released to the nurses (My Profile) and locked. Your own audits are skipped — another person publishes them.', 'Publish'],
        remove: ['Remove ' + sel.length + ' audit(s)?', 'They leave the register and the KPIs; nothing is deleted (kept in history). Published ones only by an administrator.', 'Remove']
      }[action];
      if (!n) {
        toast(action === 'complete' ? 'None of the ticked audits is a draft.' : 'None of the ticked audits is completed and waiting to be published.', 'warn');
        return;
      }
      let reason = '';
      if (action === 'remove') {
        reason = await askText({
          title: words[0],
          message: words[1],
          confirmLabel: words[2],
          danger: true,
          placeholder: 'Reason (optional)'
        });
        if (reason == null) return;
      } else if (!(await confirmBox({
        title: words[0],
        message: words[1],
        confirmLabel: words[2]
      }))) return;
      setBusy(true);
      try {
        const ids = action === 'complete' ? sel.filter(x => x.status === 'draft').map(x => x.id) : action === 'publish' ? sel.filter(x => x.status === 'completed' || x.status === 'acknowledged').map(x => x.id) : sel.map(x => x.id);
        const r = await post('/api/doc-audit/bulk', {
          action,
          ids,
          reason
        });
        toast(r.done + ' done' + (r.skipped.length ? ' · ' + r.skipped.length + ' skipped — ' + r.skipped.slice(0, 3).map(s2 => (s2.label ? s2.label + ': ' : '') + s2.why).join(' · ') + (r.skipped.length > 3 ? ' …' : '') : ''), r.skipped.length ? 'warn' : 'success');
        refreshBadge();
        setReload(x => x + 1);
      } catch (e) {
        toast(e.message, 'error');
      } finally {
        setBusy(false);
      }
    }
    const done = sel.filter(x => x.status !== 'draft');
    const bulkPrint = () => {
      if (!done.length) return toast('Tick completed or published audits to print.', 'warn');
      openPrint({
        kind: 'bulk',
        ids: done.map(x => x.id)
      }, bulkDoc(done, meta), false);
    };
    const bulkPdf = () => {
      if (!done.length) return toast('Tick completed or published audits.', 'warn');
      setBusy(true);
      pdfFrom({
        kind: 'bulk',
        ids: done.map(x => x.id)
      }, bulkDoc(done, meta), false).catch(e => toast(e.message, 'error')).finally(() => setBusy(false));
    };
    const bulkExcel = async () => {
      if (!done.length) return toast('Tick completed or published audits.', 'warn');
      try {
        await download('/api/doc-audit/xlsx?ids=' + done.map(x => x.id).join(','));
        toast('Excel downloaded.', 'success');
      } catch (e) {
        toast(e.message, 'error');
      }
    };
    useEffect(() => {
      let live = true;
      if (!reload) return;
      const qs = ['from=' + f.from, 'to=' + f.to, f.dept && 'dept=' + encodeURIComponent(f.dept), f.status && 'status=' + f.status, f.result && 'result=' + f.result, f.tool && 'tool=' + f.tool, f.nurse && 'nurse=' + encodeURIComponent(f.nurse)].filter(Boolean).join('&');
      api('/api/doc-audit/audits?' + qs).then(j => {
        if (live) setData(j);
      }).catch(e => setErr(e.message));
      return () => {
        live = false;
      };
    }, [reload]);
    async function excel() {
      try {
        await download('/api/doc-audit/xlsx?from=' + months[0] + '&to=' + months[months.length - 1] + (f.dept ? '&dept=' + encodeURIComponent(f.dept) : ''));
        toast('Excel downloaded.', 'success');
      } catch (e) {
        toast(e.message, 'error');
      }
    }
    return React.createElement("div", {
      className: "da-wrap"
    }, React.createElement("div", {
      className: "da-card da-bar"
    }, React.createElement("select", {
      className: "da-sel",
      value: f.dept,
      onChange: e => set('dept', e.target.value)
    }, React.createElement("option", {
      value: ""
    }, "All my departments"), meta.departments.map(d => React.createElement("option", {
      key: d.id,
      value: d.id
    }, d.name))), React.createElement("input", {
      type: "date",
      className: "da-in",
      value: f.from,
      max: f.to,
      onChange: e => e.target.value && set('from', e.target.value)
    }), React.createElement("span", {
      className: "da-sub"
    }, "to"), React.createElement("input", {
      type: "date",
      className: "da-in",
      value: f.to,
      min: f.from,
      onChange: e => e.target.value && set('to', e.target.value)
    }), React.createElement("select", {
      className: "da-sel",
      value: f.status,
      onChange: e => set('status', e.target.value)
    }, React.createElement("option", {
      value: ""
    }, "Any status"), DA.STATUSES.map(s => React.createElement("option", {
      key: s,
      value: s
    }, DA.STATUS_LABEL[s]))), React.createElement("select", {
      className: "da-sel",
      value: f.result,
      onChange: e => set('result', e.target.value)
    }, React.createElement("option", {
      value: ""
    }, "Any result"), React.createElement("option", {
      value: "pass"
    }, "PASS"), React.createElement("option", {
      value: "fail"
    }, "FAIL"), React.createElement("option", {
      value: "critical"
    }, "Critical failure")), meta.tools.length > 1 && React.createElement("select", {
      className: "da-sel",
      value: f.tool,
      onChange: e => set('tool', e.target.value)
    }, React.createElement("option", {
      value: ""
    }, "Any tool"), meta.tools.map(t => React.createElement("option", {
      key: t.id,
      value: t.id
    }, t.short || t.name))), React.createElement("input", {
      className: "da-in",
      style: {
        flex: '1 1 180px'
      },
      placeholder: "Search nurse, ID, UHID, auditor\u2026",
      value: f.q,
      onChange: e => set('q', e.target.value)
    }), f.nurse && React.createElement("button", {
      className: "da-btn sm",
      onClick: () => set('nurse', '')
    }, "One nurse only \xD7"), meta.canPrint && React.createElement("button", {
      className: "da-btn",
      onClick: excel
    }, "Excel"), meta.canAdd && React.createElement("button", {
      className: "da-btn pri",
      onClick: () => setRoute({
        view: 'docAuditNew',
        dept: f.dept || undefined
      })
    }, "+ New audit")), err && React.createElement("div", {
      className: "da-banner red"
    }, err), picked.length > 0 && React.createElement("div", {
      className: "da-card da-bar",
      style: {
        position: 'sticky',
        top: 6,
        zIndex: 3,
        boxShadow: '0 6px 22px rgba(13,27,46,.12)',
        animation: 'da-in .2s ease'
      }
    }, React.createElement("b", {
      style: {
        fontSize: 13
      }
    }, picked.length, " selected"), React.createElement("span", {
      className: "da-sub"
    }, count('draft'), " draft \xB7 ", count(['completed', 'acknowledged']), " completed \xB7 ", count('signed'), " published"), React.createElement("span", {
      style: {
        flex: 1
      }
    }), meta.canAdd && React.createElement("button", {
      className: "da-btn",
      disabled: busy,
      onClick: () => bulk('complete')
    }, "Complete"), meta.canEdit && React.createElement("button", {
      className: "da-btn ok",
      disabled: busy,
      onClick: () => bulk('publish')
    }, "Publish"), meta.canPrint && React.createElement(React.Fragment, null, React.createElement("button", {
      className: "da-btn",
      disabled: busy,
      onClick: bulkPrint
    }, "Print"), React.createElement("button", {
      className: "da-btn",
      disabled: busy,
      onClick: bulkPdf
    }, "PDF"), React.createElement("button", {
      className: "da-btn",
      disabled: busy,
      onClick: bulkExcel
    }, "Excel")), meta.canDelete && React.createElement("button", {
      className: "da-btn danger",
      disabled: busy,
      onClick: () => bulk('remove')
    }, "Remove"), React.createElement("button", {
      className: "da-btn sm",
      onClick: () => setPicked([])
    }, "Clear")), React.createElement("div", {
      className: "da-card"
    }, !data ? React.createElement("div", {
      className: "da-empty"
    }, "Loading\u2026") : !rows.length ? React.createElement("div", {
      className: "da-empty"
    }, "No audit matches.") : React.createElement("div", {
      className: "da-scroll"
    }, React.createElement("table", {
      className: "da-tbl"
    }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", {
      style: {
        width: 30
      }
    }, React.createElement("input", {
      type: "checkbox",
      "aria-label": "Select all shown",
      checked: allOn,
      onChange: () => setPicked(allOn ? [] : shownIds)
    })), React.createElement("th", null, "Date"), React.createElement("th", null, "Department / area"), React.createElement("th", null, "Nurse(s) audited"), React.createElement("th", null, "UHID"), React.createElement("th", null, "Auditor"), React.createElement("th", {
      className: "n"
    }, "Y / N / NA"), React.createElement("th", {
      className: "n"
    }, "Score"), React.createElement("th", null, "Grade"), React.createElement("th", null, "Result"), React.createElement("th", null, "Status"))), React.createElement("tbody", null, rows.map(x => React.createElement("tr", {
      key: x.id,
      className: "click",
      style: picked.indexOf(x.id) >= 0 ? {
        background: '#eef6fd'
      } : null,
      onClick: () => setRoute({
        view: 'docAuditNew',
        audit: x.id
      })
    }, React.createElement("td", {
      onClick: e => e.stopPropagation()
    }, React.createElement("input", {
      type: "checkbox",
      "aria-label": "Select",
      checked: picked.indexOf(x.id) >= 0,
      onChange: () => toggle(x.id)
    })), React.createElement("td", {
      style: {
        whiteSpace: 'nowrap'
      }
    }, DA.fmtDate(x.date), React.createElement("div", {
      className: "da-sub"
    }, x.shift)), React.createElement("td", null, React.createElement("b", null, x.deptName), React.createElement("div", {
      className: "da-sub"
    }, x.area, x.toolName ? ' · ' + x.toolName : '')), React.createElement("td", null, React.createElement(NurseList, {
      x: x
    }), DA.nursesOf(x).length > 1 && React.createElement("div", {
      className: "da-sub",
      style: {
        marginTop: 4
      }
    }, DA.nursesOf(x).length, " nurses \xB7 shared record")), React.createElement("td", null, x.uhid), React.createElement("td", null, x.auditor ? React.createElement(Person, {
      name: x.auditor.name,
      empId: x.auditor.empId,
      sub: x.auditor.enteredBy && x.auditor.enteredBy !== x.auditor.username ? 'entered by ' + x.auditor.enteredBy : x.auditor.enteredBy ? 'entered by an administrator' : ''
    }) : ''), React.createElement("td", {
      className: "n"
    }, x.result ? x.result.yes + ' / ' + x.result.no + ' / ' + x.result.na : ''), React.createElement("td", {
      className: "n"
    }, React.createElement("b", null, pctTxt(x.result && x.result.pct))), React.createElement("td", {
      style: {
        color: gradeColor(x.result && x.result.grade),
        fontWeight: 600,
        fontSize: 12
      }
    }, x.result ? x.result.gradeLabel : '', x.result && (x.result.criticalFails || []).length ? React.createElement("div", null, React.createElement("span", {
      className: "da-chip crit"
    }, x.result.criticalFails.length, " critical")) : null), React.createElement("td", null, x.status === 'draft' ? React.createElement("span", {
      className: "da-muted"
    }, "\u2014") : React.createElement(ResultChip, {
      r: x.result
    })), React.createElement("td", null, React.createElement(StatusChip, {
      s: x.status
    }))))))), data && data.more && React.createElement("div", {
      className: "da-pad da-sub"
    }, "Showing the newest 500 \u2014 narrow the dates to see the rest.")));
  }
  function Reports({
    meta,
    setRoute
  }) {
    const ym = meta.month;
    const PRESETS = [['m0', 'This month', ym, ym], ['m1', 'Last month', DA.addMonth(ym, -1), DA.addMonth(ym, -1)], ['q', 'Last 3 months', DA.addMonth(ym, -2), ym], ['h', 'Last 6 months', DA.addMonth(ym, -5), ym], ['y', 'This year', ym.slice(0, 4) + '-01', ym]];
    const [p, setP] = useState({
      from: ym,
      to: ym,
      dept: '',
      by: ''
    });
    const [latest, setLatest] = useState(null);
    const [data, setData] = useState(null);
    const [err, setErr] = useState('');
    const [tab, setTab] = useState(null);
    const [cap, setCap] = useState(null);
    const load = useCallback(() => {
      setData(null);
      api('/api/doc-audit/summary?from=' + p.from + '&to=' + p.to + (p.dept ? '&dept=' + encodeURIComponent(p.dept) : '') + (p.by ? '&by=' + p.by : '')).then(setData).catch(e => setErr(e.message));
    }, [p.from, p.to, p.dept, p.by]);
    useEffect(() => {
      load();
    }, [load]);
    useEffect(() => {
      setLatest(null);
      if (!data || data.overall.total.records > 0) return;
      let live = true;
      api('/api/doc-audit/audits?from=' + DA.addMonth(ym, -11) + '-01' + (p.dept ? '&dept=' + encodeURIComponent(p.dept) : '')).then(j => {
        const done = (j.audits || []).filter(x => x.status !== 'draft');
        if (!live || !done.length) return;
        const m = done[0].month;
        setLatest({
          month: m,
          n: done.filter(x => x.month === m).length
        });
      }).catch(() => {});
      return () => {
        live = false;
      };
    }, [data]);
    const set = (k, v) => setP(x => Object.assign({}, x, {
      [k]: v
    }));
    const toolsShown = data ? data.tools.filter(t => data.rows.some(r => r.toolId === t.id)) : [];
    const cur = toolsShown.find(t => t.id === tab) || toolsShown[0];
    const label = p.from === p.to ? DA.fmtMonth(p.from) : DA.fmtMonth(p.from) + ' – ' + DA.fmtMonth(p.to);
    async function excel() {
      try {
        await download('/api/doc-audit/xlsx?from=' + p.from + '&to=' + p.to + (p.dept ? '&dept=' + encodeURIComponent(p.dept) : ''));
        toast('Excel downloaded.', 'success');
      } catch (e) {
        toast(e.message, 'error');
      }
    }
    const kCell = (k, records) => !records || k.value == null ? React.createElement("span", {
      className: "da-muted"
    }, "\u2014") : React.createElement("span", {
      style: {
        fontWeight: 700,
        color: k.met === false ? '#a3172f' : k.met ? '#14713f' : undefined
      }
    }, k.value, "%", k.met === false ? ' ▼' : '');
    return React.createElement("div", {
      className: "da-wrap"
    }, React.createElement("div", {
      className: "da-card da-bar"
    }, React.createElement("div", {
      className: "da-tabs"
    }, PRESETS.map(([id, l, a, b]) => React.createElement("button", {
      key: id,
      className: 'da-btn sm' + (p.from === a && p.to === b ? ' pri' : ''),
      onClick: () => setP(x => Object.assign({}, x, {
        from: a,
        to: b
      }))
    }, l))), React.createElement("input", {
      type: "month",
      className: "da-in",
      value: p.from,
      max: p.to,
      onChange: e => e.target.value && set('from', e.target.value)
    }), React.createElement("span", {
      className: "da-sub"
    }, "to"), React.createElement("input", {
      type: "month",
      className: "da-in",
      value: p.to,
      min: p.from,
      max: ym,
      onChange: e => e.target.value && set('to', e.target.value)
    }), React.createElement("select", {
      className: "da-sel",
      value: p.dept,
      onChange: e => set('dept', e.target.value)
    }, React.createElement("option", {
      value: ""
    }, "All my departments"), meta.departments.map(d => React.createElement("option", {
      key: d.id,
      value: d.id
    }, d.name))), React.createElement("span", {
      style: {
        flex: 1
      }
    }), meta.canPrint && data && React.createElement(React.Fragment, null, React.createElement("span", {
      className: "da-sub"
    }, "KPI report"), React.createElement("button", {
      className: "da-btn",
      onClick: () => printReport(data)
    }, "Print"), React.createElement("button", {
      className: "da-btn",
      onClick: () => pdfReport(data).catch(e => toast(e.message, 'error'))
    }, "PDF"), React.createElement("span", {
      className: "da-sub",
      style: {
        marginLeft: 6
      }
    }, "Complete report"), React.createElement("button", {
      className: "da-btn pri",
      title: "Summary, KPI tables, trend, criterion gaps, action plans, results by nurse and the full audit register",
      onClick: () => completeReport(data, p.dept, false)
    }, "Print"), React.createElement("button", {
      className: "da-btn",
      onClick: () => completeReport(data, p.dept, true).catch(e => toast(e.message, 'error'))
    }, "PDF"), React.createElement("button", {
      className: "da-btn",
      onClick: excel
    }, "Excel"))), err && React.createElement("div", {
      className: "da-banner red"
    }, err), data && latest && React.createElement("div", {
      className: "da-banner blue"
    }, React.createElement("div", {
      style: {
        flex: 1
      }
    }, "No completed audit in ", React.createElement("b", null, periodLabel(data.months)), ". Your latest audits are in ", React.createElement("b", null, DA.fmtMonth(latest.month)), " (", latest.n, ")."), React.createElement("button", {
      className: "da-btn sm pri",
      onClick: () => setP(x => Object.assign({}, x, {
        from: latest.month,
        to: latest.month
      }))
    }, "Show ", DA.fmtMonth(latest.month))), !data ? React.createElement("div", {
      className: "da-card da-empty"
    }, "Building the report\u2026") : React.createElement(React.Fragment, null, React.createElement("div", {
      className: "da-tiles"
    }, React.createElement("div", {
      className: "da-tile"
    }, React.createElement("span", null, "Records audited"), React.createElement("b", null, data.overall.total.records), React.createElement("small", null, label)), React.createElement("div", {
      className: "da-tile"
    }, React.createElement("span", null, "Documentation accuracy"), React.createElement("b", {
      style: {
        color: data.overall.total.accuracy == null ? undefined : data.overall.total.accuracy >= 90 ? '#14713f' : '#a3172f'
      }
    }, pctTxt(data.overall.total.accuracy)), React.createElement("small", null, "all tools \xB7 target \u2265 90%")), React.createElement("div", {
      className: "da-tile"
    }, React.createElement("span", null, "Critical failure rate"), React.createElement("b", null, data.overall.total.records ? pctTxt(DA.round1(data.overall.total.criticalRecords / data.overall.total.records * 100)) : '—'), React.createElement("small", null, data.overall.total.criticalRecords, " record(s) \xB7 target \u2264 5%")), React.createElement("div", {
      className: "da-tile"
    }, React.createElement("span", null, "Nurses audited"), React.createElement("b", null, data.overall.total.nurses), React.createElement("small", null, "each at least once a quarter"))), !toolsShown.length && React.createElement("div", {
      className: "da-card da-empty"
    }, "No audit in ", label, "."), toolsShown.length > 0 && cur && React.createElement("div", {
      className: "da-card"
    }, React.createElement("div", {
      className: "da-h"
    }, React.createElement("h3", null, "Department KPI report"), React.createElement("span", {
      className: "da-sub"
    }, "Appendix C \xB7 ", label), React.createElement("span", {
      className: "grow"
    }), toolsShown.length > 1 && React.createElement("div", {
      className: "da-tabs"
    }, toolsShown.map(t => React.createElement("button", {
      key: t.id,
      className: 'da-btn sm' + (cur.id === t.id ? ' pri' : ''),
      onClick: () => setTab(t.id)
    }, t.short || t.name)))), React.createElement("div", {
      className: "da-scroll"
    }, React.createElement("table", {
      className: "da-tbl"
    }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", {
      style: {
        minWidth: 170
      }
    }, "Department"), React.createElement("th", {
      className: "n"
    }, "Records"), cur.kpis.map(k => React.createElement("th", {
      key: k.id,
      className: "n",
      title: DA.KPI_FORMULA_LABEL[k.formula] + (k.criteria ? ' — criteria ' + k.criteria.map(c => '#' + c.replace('c', '')).join(', ') : '')
    }, React.createElement("div", {
      style: {
        textTransform: 'none',
        fontWeight: 700
      }
    }, k.name), React.createElement("div", {
      style: {
        textTransform: 'none',
        fontWeight: 500
      }
    }, k.direction === 'lower' ? '≤ ' : '≥ ', k.target, "%"))), React.createElement("th", null, "Top 3 failing criteria"), React.createElement("th", null, "Action plan"))), React.createElement("tbody", null, data.rows.filter(r => r.toolId === cur.id).map(r => {
      const s = r.total;
      const lastCap = r.caps[r.caps.length - 1];
      return React.createElement("tr", {
        key: r.deptId
      }, React.createElement("td", null, React.createElement("b", null, r.name), r.minRecords ? React.createElement("div", {
        className: "da-sub"
      }, "min ", r.minRecords, "/month") : null), React.createElement("td", {
        className: "n"
      }, s.records), s.kpis.map(k => React.createElement("td", {
        key: k.id,
        className: "n"
      }, kCell(k, s.records))), React.createElement("td", {
        style: {
          fontSize: 11.8,
          minWidth: 160
        }
      }, s.topFailing.map(g => React.createElement("div", {
        key: g.id
      }, "#", g.no, " \xD7", g.count, " ", g.critical && React.createElement("span", {
        className: "da-chip crit"
      }, "C"), " ", React.createElement("span", {
        className: "da-muted"
      }, g.text.slice(0, 60), g.text.length > 60 ? '…' : ''))), !s.topFailing.length && React.createElement("span", {
        className: "da-muted"
      }, "\u2014")), React.createElement("td", null, lastCap ? React.createElement("span", {
        className: "da-chip off",
        title: 'Below target in ' + DA.fmtMonth(DA.addMonth(lastCap.month, -1)) + ' and ' + DA.fmtMonth(lastCap.month)
      }, "CAP due") : null, React.createElement("div", null, React.createElement("button", {
        className: "da-btn sm",
        style: {
          marginTop: 4
        },
        onClick: () => setCap({
          dept: r,
          month: p.to,
          tool: cur,
          summary: r.months[p.to] || s
        })
      }, meta.canEdit ? 'Action plan' : 'View plan'))));
    }), data.hospital[cur.id] && React.createElement("tr", {
      className: "tot"
    }, React.createElement("td", null, "HOSPITAL TOTAL"), React.createElement("td", {
      className: "n"
    }, data.hospital[cur.id].total.records), data.hospital[cur.id].total.kpis.map(k => React.createElement("td", {
      key: k.id,
      className: "n"
    }, kCell(k, data.hospital[cur.id].total.records))), React.createElement("td", {
      style: {
        fontSize: 11.8
      }
    }, data.hospital[cur.id].total.topFailing.map(g => '#' + g.no + ' ×' + g.count).join(', ')), React.createElement("td", null))))), React.createElement("div", {
      className: "da-pad da-sub"
    }, "Policy 9: a department below target for 2 consecutive months submits a corrective action plan with owner and due date, focused on its top 3 failing criteria (PDSA). Hover a KPI for its formula.")), data.months.length > 1 && data.rows.length > 0 && React.createElement("div", {
      className: "da-card"
    }, React.createElement("div", {
      className: "da-h"
    }, React.createElement("h3", null, "Accuracy by month"), React.createElement("span", {
      className: "da-sub"
    }, "Documentation accuracy = \u03A3 Yes \xF7 \u03A3 (Yes + No)")), W.LineChart && React.createElement("div", {
      className: "da-pad"
    }, React.createElement(W.LineChart, {
      data: data.months.map(m => ({
        mon: DA.fmtMonth(m).slice(0, 3) + ' ' + m.slice(2, 4),
        val: data.overall.months[m].accuracy == null ? 0 : data.overall.months[m].accuracy
      })),
      x: "mon",
      y: "val",
      height: 200,
      color: "#1f4f8a"
    })), React.createElement("div", {
      className: "da-scroll"
    }, React.createElement("table", {
      className: "da-tbl da-heat"
    }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Department"), data.months.map(m => React.createElement("th", {
      key: m,
      className: "n"
    }, DA.fmtMonth(m))))), React.createElement("tbody", null, data.rows.map(r => React.createElement("tr", {
      key: r.deptId + r.toolId
    }, React.createElement("td", null, React.createElement("b", null, r.name)), data.months.map(m => {
      const s = r.months[m];
      const v = s.accuracy;
      const bg = v == null ? '#f6f8fa' : v >= 95 ? '#d6f0df' : v >= 90 ? '#e7f6ed' : v >= 80 ? '#fff1d6' : '#fde4e8';
      return React.createElement("td", {
        key: m,
        className: "v",
        style: {
          background: bg
        },
        title: s.records + ' record(s)'
      }, v == null ? '·' : v + '%', React.createElement("div", {
        className: "da-sub",
        style: {
          fontWeight: 500
        }
      }, s.records ? s.records + ' rec.' : ''));
    }))))))), cur && data.hospital[cur.id] && data.hospital[cur.id].total.gaps.length > 0 && React.createElement("div", {
      className: "da-card"
    }, React.createElement("div", {
      className: "da-h"
    }, React.createElement("h3", null, "Criterion gap analysis"), React.createElement("span", {
      className: "da-sub"
    }, cur.short || cur.name, " \xB7 how often each criterion was marked 'No'")), React.createElement("div", {
      className: "da-pad"
    }, (() => {
      const gs = data.hospital[cur.id].total.gaps.slice(0, 12);
      const max = Math.max(1, ...gs.map(g => g.count));
      const rec = data.hospital[cur.id].total.records;
      return gs.map(g => React.createElement("div", {
        className: "da-gap",
        key: g.id
      }, React.createElement("b", {
        style: {
          color: '#0b4f6c'
        }
      }, "#", g.no), React.createElement("div", {
        style: {
          minWidth: 0
        }
      }, g.critical && React.createElement("span", {
        className: "da-chip crit",
        style: {
          marginRight: 5
        }
      }, "Critical"), g.text), React.createElement("div", null, React.createElement("div", {
        className: "bar"
      }, React.createElement("i", {
        style: {
          width: g.count / max * 100 + '%',
          background: g.critical ? '#a3172f' : '#d23a52'
        }
      })), React.createElement("div", {
        className: "da-sub",
        style: {
          textAlign: 'right'
        }
      }, g.count, "\xD7 \xB7 ", rec ? DA.round1(g.count / rec * 100) : 0, "% of records"))));
    })())), React.createElement("div", {
      className: "da-card"
    }, React.createElement("div", {
      className: "da-h"
    }, React.createElement("h3", null, "Breakdown"), React.createElement("span", {
      className: "grow"
    }), React.createElement("div", {
      className: "seg"
    }, [['', 'None'], ['area', 'By area / zone'], ['shift', 'By shift'], ['nurse', 'By nurse'], ['auditor', 'By auditor']].map(([k, l]) => React.createElement("button", {
      key: k,
      className: p.by === k ? 'on' : '',
      onClick: () => set('by', k)
    }, l)))), !p.by ? React.createElement("div", {
      className: "da-empty",
      style: {
        padding: 14
      }
    }, "Choose a breakdown \u2014 ED results by zone and by shift (QA-004 \xA79), or each nurse\u2019s record (policy \xA71).") : !data.breakdown || !data.breakdown.length ? React.createElement("div", {
      className: "da-empty",
      style: {
        padding: 14
      }
    }, "No audit in this period.") : React.createElement("div", {
      className: "da-scroll"
    }, React.createElement("table", {
      className: "da-tbl"
    }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, {
      area: 'Area / zone',
      shift: 'Shift',
      nurse: 'Nurse',
      auditor: 'Auditor'
    }[p.by]), React.createElement("th", {
      className: "n"
    }, "Records"), React.createElement("th", {
      className: "n"
    }, "Accuracy"), React.createElement("th", {
      className: "n"
    }, "Critical"), React.createElement("th", null, "Top failing"))), React.createElement("tbody", null, data.breakdown.map(b => React.createElement("tr", {
      key: b.key,
      className: b.staffId ? 'click' : '',
      onClick: () => b.staffId && setRoute({
        view: 'docAuditRegister',
        nurse: b.staffId
      })
    }, React.createElement("td", null, React.createElement("b", null, b.label), b.sub && React.createElement("div", {
      className: "da-sub"
    }, b.sub)), React.createElement("td", {
      className: "n"
    }, b.summary.records), React.createElement("td", {
      className: "n",
      style: {
        fontWeight: 700,
        color: b.summary.accuracy != null && b.summary.accuracy < 90 ? '#a3172f' : undefined
      }
    }, pctTxt(b.summary.accuracy)), React.createElement("td", {
      className: "n",
      style: {
        color: b.summary.criticalRecords ? '#a3172f' : undefined
      }
    }, b.summary.criticalRecords || ''), React.createElement("td", {
      style: {
        fontSize: 11.8
      }
    }, b.summary.topFailing.map(g => '#' + g.no + ' ×' + g.count).join(', '))))))))), cap && React.createElement(CapEditor, _extends({
      meta: meta
    }, cap, {
      onClose: () => setCap(null)
    })));
  }
  const ROOT_CAUSES = ['Knowledge', 'Time / workload', 'Form design', 'System / EMR', 'Communication', 'Supervision'];
  function CapEditor({
    meta,
    dept,
    month,
    tool,
    summary,
    onClose
  }) {
    const [cap, setCap] = useState(null);
    const [items, setItems] = useState(null);
    const [busy, setBusy] = useState(false);
    const [ym, setYm] = useState(month);
    useEffect(() => {
      let live = true;
      setItems(null);
      api('/api/doc-audit/caps/' + encodeURIComponent(dept.deptId) + '/' + ym).then(j => {
        if (!live) return;
        setCap(j.cap);
        const s = dept.months[ym] || summary;
        setItems(j.cap ? j.cap.items : (s.topFailing || []).map(g => ({
          critId: g.id,
          gap: "#" + g.no + " marked 'No' in " + g.count + ' record(s): ' + g.text,
          rootCause: '',
          action: '',
          owner: '',
          due: '',
          status: 'open',
          reaudit: ''
        })));
      }).catch(e => {
        toast(e.message, 'error');
        onClose();
      });
      return () => {
        live = false;
      };
    }, [ym]);
    const may = meta.canEdit;
    const set = (i, k, v) => setItems(xs => xs.map((x, j) => j === i ? Object.assign({}, x, {
      [k]: v
    }) : x));
    async function save(submit) {
      setBusy(true);
      try {
        const j = await post('/api/doc-audit/caps/' + encodeURIComponent(dept.deptId) + '/' + ym, {
          items,
          submit: !!submit,
          baseUpdatedAt: cap ? cap.updatedAt : null
        }, 'PUT');
        setCap(j.cap);
        setItems(j.cap.items);
        toast(submit ? 'Action plan submitted.' : 'Action plan saved.', 'success');
      } catch (e) {
        toast(e.message, 'error');
      } finally {
        setBusy(false);
      }
    }
    const crits = DA.activeCriteria(tool.criteria || []);
    return React.createElement(Modal, {
      wide: true,
      title: 'Corrective Action Plan · ' + dept.name,
      onClose: onClose,
      footer: may ? React.createElement(React.Fragment, null, React.createElement("button", {
        className: "da-btn",
        onClick: onClose
      }, "Close"), React.createElement("button", {
        className: "da-btn",
        disabled: busy || !items,
        onClick: () => save(false)
      }, "Save"), React.createElement("button", {
        className: "da-btn pri",
        disabled: busy || !items || !items.length,
        onClick: () => save(true)
      }, "Submit to the Nursing Quality Committee")) : React.createElement("button", {
        className: "da-btn",
        onClick: onClose
      }, "Close")
    }, React.createElement("div", {
      style: {
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        flexWrap: 'wrap'
      }
    }, React.createElement("span", {
      className: "da-sub"
    }, "Month"), React.createElement("input", {
      type: "month",
      className: "da-in",
      value: ym,
      max: meta.month,
      onChange: e => e.target.value && setYm(e.target.value)
    }), cap && React.createElement("span", {
      className: "da-sub"
    }, "Prepared by ", cap.preparedBy, " \xB7 ", cap.submittedAt ? 'submitted ' + when(cap.submittedAt) : 'not submitted yet')), React.createElement("div", {
      className: "da-sub"
    }, "Appendix B. Root-cause prompts: knowledge, time/workload, form design, system/EMR, communication, supervision. A new plan starts from the month\u2019s top failing criteria."), !items ? React.createElement("div", {
      className: "da-empty"
    }, "Loading\u2026") : React.createElement(React.Fragment, null, items.map((x, i) => React.createElement("div", {
      key: i,
      className: "da-card da-pad",
      style: {
        display: 'grid',
        gap: 8
      }
    }, React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: '120px 1fr',
        gap: 8
      }
    }, React.createElement("select", {
      className: "da-sel",
      disabled: !may,
      value: x.critId,
      onChange: e => set(i, 'critId', e.target.value)
    }, React.createElement("option", {
      value: ""
    }, "Criterion\u2026"), crits.map(c => React.createElement("option", {
      key: c.id,
      value: c.id
    }, "#", c.no, c.critical ? ' (critical)' : ''))), React.createElement("textarea", {
      className: "da-ta",
      rows: 2,
      disabled: !may,
      placeholder: "Gap identified (evidence)",
      value: x.gap,
      onChange: e => set(i, 'gap', e.target.value)
    })), React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))',
        gap: 8
      }
    }, React.createElement("div", null, React.createElement("input", {
      className: "da-in",
      style: {
        width: '100%'
      },
      list: "da-root",
      disabled: !may,
      placeholder: "Root cause",
      value: x.rootCause,
      onChange: e => set(i, 'rootCause', e.target.value)
    })), React.createElement("input", {
      className: "da-in",
      disabled: !may,
      placeholder: "Owner",
      value: x.owner,
      onChange: e => set(i, 'owner', e.target.value)
    }), React.createElement("input", {
      type: "date",
      className: "da-in",
      disabled: !may,
      value: x.due,
      onChange: e => set(i, 'due', e.target.value)
    }), React.createElement("select", {
      className: "da-sel",
      disabled: !may,
      value: x.status,
      onChange: e => set(i, 'status', e.target.value)
    }, React.createElement("option", {
      value: "open"
    }, "Open"), React.createElement("option", {
      value: "progress"
    }, "In progress"), React.createElement("option", {
      value: "done"
    }, "Done"))), React.createElement("textarea", {
      className: "da-ta",
      rows: 2,
      disabled: !may,
      placeholder: "Action",
      value: x.action,
      onChange: e => set(i, 'action', e.target.value)
    }), React.createElement("div", {
      style: {
        display: 'flex',
        gap: 8
      }
    }, React.createElement("input", {
      className: "da-in",
      style: {
        flex: 1
      },
      disabled: !may,
      placeholder: "Status / re-audit result",
      value: x.reaudit,
      onChange: e => set(i, 'reaudit', e.target.value)
    }), may && React.createElement("button", {
      className: "da-btn sm danger",
      onClick: () => setItems(xs => xs.filter((_, j) => j !== i))
    }, "Remove")))), React.createElement("datalist", {
      id: "da-root"
    }, ROOT_CAUSES.map(r => React.createElement("option", {
      key: r,
      value: r
    }))), may && items.length < 20 && React.createElement("button", {
      className: "da-btn",
      onClick: () => setItems(xs => xs.concat([{
        critId: '',
        gap: '',
        rootCause: '',
        action: '',
        owner: '',
        due: '',
        status: 'open',
        reaudit: ''
      }]))
    }, "+ Add an action"), !items.length && React.createElement("div", {
      className: "da-empty"
    }, "No action yet.")));
  }
  function Tools({
    meta,
    reloadMeta
  }) {
    const [tools, setTools] = useState(null);
    const [sel, setSel] = useState(null);
    const [d, setD] = useState(null);
    const [busy, setBusy] = useState(false);
    const load = useCallback(() => api('/api/doc-audit/tools?all=1').then(j => {
      setTools(j.tools);
      return j.tools;
    }).catch(e => toast(e.message, 'error')), []);
    useEffect(() => {
      load().then(ts => {
        if (ts && ts.length) {
          setSel(ts[0].id);
          setD(JSON.parse(JSON.stringify(ts[0])));
        }
      });
    }, []);
    const cur = tools && tools.find(t => t.id === sel);
    const open = t => {
      setSel(t.id);
      setD(JSON.parse(JSON.stringify(t)));
    };
    const dirty = cur && d && JSON.stringify(strip(cur)) !== JSON.stringify(strip(d));
    function strip(t) {
      const {
        history,
        updatedAt,
        updatedBy,
        createdAt,
        createdBy,
        revision,
        disabled,
        removedAt,
        removedBy,
        order,
        ...rest
      } = t;
      return rest;
    }
    const set = (k, v) => setD(x => Object.assign({}, x, {
      [k]: v
    }));
    const setCrit = (i, k, v) => setD(x => Object.assign({}, x, {
      criteria: x.criteria.map((c, j) => j === i ? Object.assign({}, c, {
        [k]: v
      }) : c)
    }));
    const move = (i, dir) => setD(x => {
      const cs = x.criteria.slice();
      const j = i + dir;
      if (j < 0 || j >= cs.length) return x;
      [cs[i], cs[j]] = [cs[j], cs[i]];
      return Object.assign({}, x, {
        criteria: cs
      });
    });
    async function save() {
      const scoring = JSON.stringify((cur.criteria || []).map(c => [c.id, c.text, !!c.critical, c.active !== false, c.sectionId])) + JSON.stringify(cur.kpis) !== JSON.stringify((d.criteria || []).map(c => [c.id, c.text, !!c.critical, c.active !== false, c.sectionId])) + JSON.stringify(d.kpis);
      if (scoring && !(await confirmBox({
        title: 'Save as revision ' + ((cur.revision || 1) + 1) + '?',
        message: 'You changed criteria, critical flags or KPIs. New audits use the new version. Audits already filled keep the criteria they were filled against, so their scores do not change.',
        confirmLabel: 'Save'
      }))) return;
      setBusy(true);
      try {
        const j = await post('/api/doc-audit/tools/' + encodeURIComponent(cur.id), Object.assign({}, d, {
          baseUpdatedAt: cur.updatedAt
        }), 'PUT');
        toast('Tool saved.', 'success');
        const ts = await load();
        const t = ts.find(x => x.id === j.tool.id);
        if (t) open(t);
        reloadMeta();
      } catch (e) {
        toast(e.message, 'error');
      } finally {
        setBusy(false);
      }
    }
    async function create(from) {
      try {
        const j = await post('/api/doc-audit/tools', from ? {
          from
        } : {
          name: 'New audit tool',
          sections: [{
            id: 'A',
            title: 'Section A'
          }],
          criteria: []
        });
        const ts = await load();
        open(ts.find(x => x.id === j.tool.id));
        reloadMeta();
        toast('Tool created.', 'success');
      } catch (e) {
        toast(e.message, 'error');
      }
    }
    async function flag(path, body, msg, method) {
      try {
        await api('/api/doc-audit/tools/' + encodeURIComponent(cur.id) + path, {
          method: method || 'POST',
          body: JSON.stringify(body || {})
        });
        const ts = await load();
        const t = ts.find(x => x.id === cur.id);
        if (t) open(t);
        reloadMeta();
        toast(msg, 'success');
      } catch (e) {
        toast(e.message, 'error');
      }
    }
    if (!tools) return React.createElement("div", {
      className: "da-card da-empty"
    }, "Loading the audit tools\u2026");
    const secIds = (d && d.sections || []).map(s => s.id);
    const liveCrit = d ? d.criteria.filter(c => c.active !== false) : [];
    return React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'minmax(220px,280px) minmax(0,1fr)',
        gap: 14,
        alignItems: 'start'
      },
      className: "da-tools"
    }, React.createElement("style", null, '@media (max-width:900px){.da-tools{grid-template-columns:1fr!important}}'), React.createElement("div", {
      className: "da-card"
    }, React.createElement("div", {
      className: "da-h"
    }, React.createElement("h3", null, "Audit tools")), tools.map(t => React.createElement("div", {
      key: t.id,
      onClick: () => (!dirty || window.confirm('Leave without saving?')) && open(t),
      style: {
        padding: '10px 14px',
        borderBottom: '1px solid var(--line-2)',
        cursor: 'pointer',
        background: t.id === sel ? 'var(--blue-50)' : undefined,
        opacity: t.removedAt || t.disabled ? .55 : 1
      }
    }, React.createElement("b", {
      style: {
        fontSize: 12.8
      }
    }, t.short || t.name), React.createElement("div", {
      className: "da-sub"
    }, [t.code, 'rev. ' + (t.revision || 1), t.criteria.filter(c => c.active !== false).length + ' criteria', t.removedAt ? 'archived' : t.disabled ? 'off' : ''].filter(Boolean).join(' · ')))), React.createElement("div", {
      className: "da-pad",
      style: {
        display: 'flex',
        gap: 6,
        flexWrap: 'wrap'
      }
    }, React.createElement("button", {
      className: "da-btn sm",
      onClick: () => create(null)
    }, "+ New tool"), cur && React.createElement("button", {
      className: "da-btn sm",
      onClick: () => create(cur.id)
    }, "Duplicate"))), d && cur && React.createElement("div", {
      className: "da-wrap"
    }, React.createElement("div", {
      className: "da-card da-bar"
    }, React.createElement("b", {
      style: {
        fontSize: 14
      }
    }, cur.name), React.createElement("span", {
      className: "da-sub"
    }, "revision ", cur.revision || 1), React.createElement("span", {
      style: {
        flex: 1
      }
    }), !cur.removedAt && React.createElement(Switch, {
      on: !cur.disabled,
      onClick: () => flag('/enabled', {
        enabled: !!cur.disabled
      }, cur.disabled ? 'Tool switched on.' : 'Tool switched off.')
    }, cur.disabled ? 'Off' : 'On'), meta.canPrint !== false && React.createElement("button", {
      className: "da-btn sm",
      onClick: () => printAudit(null, d)
    }, "Print blank form"), cur.removedAt ? React.createElement("button", {
      className: "da-btn sm",
      onClick: () => flag('/restore', {}, 'Restored.')
    }, "Restore") : React.createElement("button", {
      className: "da-btn sm danger",
      onClick: async () => {
        if (await confirmBox({
          title: 'Archive this tool?',
          message: 'It stops being offered for new audits. Audits already filled with it stay as they are.',
          confirmLabel: 'Archive',
          danger: true
        })) flag('', {}, 'Archived.', 'DELETE');
      }
    }, "Archive"), React.createElement("button", {
      className: "da-btn pri",
      disabled: !dirty || busy,
      onClick: save
    }, "Save")), React.createElement("div", {
      className: "da-card da-pad da-fields"
    }, React.createElement("div", {
      className: "da-f",
      style: {
        gridColumn: 'span 2'
      }
    }, React.createElement("label", null, "Name"), React.createElement("input", {
      className: "da-in",
      value: d.name,
      onChange: e => set('name', e.target.value)
    })), React.createElement("div", {
      className: "da-f"
    }, React.createElement("label", null, "Short name"), React.createElement("input", {
      className: "da-in",
      value: d.short || '',
      onChange: e => set('short', e.target.value)
    })), React.createElement("div", {
      className: "da-f"
    }, React.createElement("label", null, "Document no."), React.createElement("input", {
      className: "da-in",
      value: d.code || '',
      onChange: e => set('code', e.target.value)
    })), React.createElement("div", {
      className: "da-f"
    }, React.createElement("label", null, "Version"), React.createElement("input", {
      className: "da-in",
      value: d.version || '',
      onChange: e => set('version', e.target.value)
    })), React.createElement("div", {
      className: "da-f"
    }, React.createElement("label", null, "Minimum records / unit / month"), React.createElement("input", {
      type: "number",
      min: "0",
      className: "da-in",
      value: (d.sample || {}).minRecords == null ? '' : d.sample.minRecords,
      onChange: e => set('sample', Object.assign({}, d.sample, {
        minRecords: e.target.value === '' ? '' : +e.target.value
      }))
    })), React.createElement("div", {
      className: "da-f",
      style: {
        gridColumn: '1 / -1'
      }
    }, React.createElement("label", null, "Applies to"), React.createElement("input", {
      className: "da-in",
      value: d.scope || '',
      onChange: e => set('scope', e.target.value)
    })), React.createElement("div", {
      className: "da-f",
      style: {
        gridColumn: '1 / -1'
      }
    }, React.createElement("label", null, "Sample rule (shown to auditors)"), React.createElement("textarea", {
      className: "da-ta",
      rows: 2,
      value: (d.sample || {}).note || '',
      onChange: e => set('sample', Object.assign({}, d.sample, {
        note: e.target.value
      }))
    }))), React.createElement("div", {
      className: "da-card"
    }, React.createElement("div", {
      className: "da-h"
    }, React.createElement("h3", null, "Sections"), React.createElement("span", {
      className: "grow"
    }), React.createElement("button", {
      className: "da-btn sm",
      onClick: () => set('sections', d.sections.concat([{
        id: '',
        title: 'New section',
        jci: ''
      }]))
    }, "+ Section")), React.createElement("div", {
      className: "da-pad"
    }, d.sections.map((s, i) => React.createElement("div", {
      key: i,
      style: {
        display: 'grid',
        gridTemplateColumns: '60px 1fr 200px auto',
        gap: 8,
        marginBottom: 6
      }
    }, React.createElement("input", {
      className: "da-in",
      value: s.id,
      placeholder: "A",
      onChange: e => set('sections', d.sections.map((x, j) => j === i ? Object.assign({}, x, {
        id: e.target.value.toUpperCase().slice(0, 3)
      }) : x))
    }), React.createElement("input", {
      className: "da-in",
      value: s.title,
      onChange: e => set('sections', d.sections.map((x, j) => j === i ? Object.assign({}, x, {
        title: e.target.value
      }) : x))
    }), React.createElement("input", {
      className: "da-in",
      value: s.jci || '',
      placeholder: "JCI chapters",
      onChange: e => set('sections', d.sections.map((x, j) => j === i ? Object.assign({}, x, {
        jci: e.target.value
      }) : x))
    }), React.createElement("button", {
      className: "da-btn sm danger",
      disabled: d.criteria.some(c => c.sectionId === s.id && c.active !== false),
      title: "Move or switch off its criteria first",
      onClick: () => set('sections', d.sections.filter((_, j) => j !== i))
    }, "\xD7"))))), React.createElement("div", {
      className: "da-card"
    }, React.createElement("div", {
      className: "da-h"
    }, React.createElement("h3", null, "Criteria"), React.createElement("span", {
      className: "da-sub"
    }, liveCrit.length, " active \xB7 ", liveCrit.filter(c => c.critical).length, " critical"), React.createElement("span", {
      className: "grow"
    }), React.createElement("button", {
      className: "da-btn sm",
      onClick: () => set('criteria', d.criteria.concat([{
        id: '',
        no: 0,
        sectionId: secIds[secIds.length - 1] || 'A',
        text: '',
        jci: [],
        critical: false,
        active: true
      }]))
    }, "+ Criterion")), React.createElement("div", {
      className: "da-pad"
    }, React.createElement("div", {
      className: "da-sub",
      style: {
        marginBottom: 6
      }
    }, "Numbers follow the section order when saved. Switching a criterion off keeps the answers old audits hold for it."), d.criteria.map((c, i) => React.createElement("div", {
      key: c.id || 'n' + i,
      className: 'da-ed-row' + (c.active === false ? ' off' : '')
    }, React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 2
      }
    }, React.createElement("button", {
      className: "da-btn sm",
      onClick: () => move(i, -1),
      "aria-label": "Up"
    }, "\u2191"), React.createElement("button", {
      className: "da-btn sm",
      onClick: () => move(i, 1),
      "aria-label": "Down"
    }, "\u2193")), React.createElement("select", {
      className: "da-sel",
      value: c.sectionId,
      onChange: e => setCrit(i, 'sectionId', e.target.value)
    }, d.sections.map(s => React.createElement("option", {
      key: s.id,
      value: s.id
    }, s.id))), React.createElement("textarea", {
      className: "da-ta",
      rows: 2,
      value: c.text,
      placeholder: "Compliance criterion (exact policy wording)",
      onChange: e => setCrit(i, 'text', e.target.value)
    }), React.createElement("input", {
      className: "da-in",
      value: (c.jci || []).join(', '),
      placeholder: "JCI e.g. IPSG, MMU",
      onChange: e => setCrit(i, 'jci', e.target.value.split(/[,\s]+/).filter(Boolean))
    }), React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 5
      }
    }, React.createElement(Switch, {
      on: !!c.critical,
      onClick: () => setCrit(i, 'critical', !c.critical)
    }, "Critical"), React.createElement(Switch, {
      on: c.active !== false,
      onClick: () => setCrit(i, 'active', c.active === false)
    }, c.active === false ? 'Off' : 'Active'), React.createElement("span", {
      className: "da-sub"
    }, c.id ? '#' + c.no + ' · id ' + c.id : 'new')))))), React.createElement("div", {
      className: "da-card"
    }, React.createElement("div", {
      className: "da-h"
    }, React.createElement("h3", null, "KPIs"), React.createElement("span", {
      className: "grow"
    }), React.createElement("button", {
      className: "da-btn sm",
      onClick: () => set('kpis', d.kpis.concat([{
        id: '',
        code: 'KPI-' + (d.kpis.length + 1),
        name: '',
        formula: 'subset',
        target: 95,
        direction: 'higher',
        criteria: []
      }]))
    }, "+ KPI")), React.createElement("div", {
      className: "da-pad"
    }, d.kpis.map((k, i) => {
      const sk = (key, v) => set('kpis', d.kpis.map((x, j) => j === i ? Object.assign({}, x, {
        [key]: v
      }) : x));
      return React.createElement("div", {
        key: i,
        style: {
          display: 'grid',
          gridTemplateColumns: '80px minmax(140px,1fr) 150px 70px 110px auto',
          gap: 8,
          marginBottom: 8,
          alignItems: 'start'
        }
      }, React.createElement("input", {
        className: "da-in",
        value: k.code || '',
        onChange: e => sk('code', e.target.value)
      }), React.createElement("input", {
        className: "da-in",
        value: k.name,
        placeholder: "Name",
        onChange: e => sk('name', e.target.value)
      }), React.createElement("select", {
        className: "da-sel",
        value: k.formula,
        onChange: e => sk('formula', e.target.value)
      }, DA.KPI_FORMULAS.concat(DA.KPI_FORMULAS.indexOf(k.formula) < 0 ? [k.formula] : []).map(f => React.createElement("option", {
        key: f,
        value: f
      }, {
        accuracy: 'Accuracy (Σ Yes ÷ Yes+No)',
        pass: 'Pass rate',
        full: 'Fully compliant',
        critical: 'Critical failure rate',
        subset: 'Chosen criteria'
      }[f]))), React.createElement("input", {
        type: "number",
        className: "da-in",
        value: k.target == null ? '' : k.target,
        onChange: e => sk('target', e.target.value === '' ? null : +e.target.value)
      }), React.createElement("select", {
        className: "da-sel",
        value: k.direction,
        onChange: e => sk('direction', e.target.value)
      }, React.createElement("option", {
        value: "higher"
      }, "\u2265 target"), React.createElement("option", {
        value: "lower"
      }, "\u2264 target")), React.createElement("button", {
        className: "da-btn sm danger",
        disabled: k.formula === 'accuracy' && d.kpis.filter(x => x.formula === 'accuracy').length === 1,
        onClick: () => set('kpis', d.kpis.filter((_, j) => j !== i))
      }, "\xD7"), k.formula === 'subset' && React.createElement("div", {
        style: {
          gridColumn: '2 / -1',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4
        }
      }, liveCrit.map(c => {
        const on = (k.criteria || []).indexOf(c.id) >= 0;
        return React.createElement("button", {
          key: c.id,
          className: 'da-btn sm' + (on ? ' pri' : ''),
          onClick: () => sk('criteria', on ? k.criteria.filter(x => x !== c.id) : (k.criteria || []).concat([c.id]))
        }, "#", c.no);
      })));
    }))), React.createElement("div", {
      className: "da-card"
    }, React.createElement("div", {
      className: "da-h"
    }, React.createElement("h3", null, "Form header")), React.createElement("div", {
      className: "da-pad da-fields"
    }, React.createElement("div", {
      className: "da-f"
    }, React.createElement("label", null, "Area label"), React.createElement("input", {
      className: "da-in",
      value: (d.header || {}).areaLabel || '',
      onChange: e => set('header', Object.assign({}, d.header, {
        areaLabel: e.target.value
      }))
    })), React.createElement("div", {
      className: "da-f"
    }, React.createElement("label", null, "Bed / room label"), React.createElement("input", {
      className: "da-in",
      value: (d.header || {}).bedLabel || '',
      onChange: e => set('header', Object.assign({}, d.header, {
        bedLabel: e.target.value
      }))
    })), React.createElement("div", {
      className: "da-f",
      style: {
        gridColumn: '1 / -1'
      }
    }, React.createElement("label", null, "Areas / zones (one per line)"), React.createElement("textarea", {
      className: "da-ta",
      rows: 4,
      value: ((d.header || {}).areas || []).join('\n'),
      onChange: e => set('header', Object.assign({}, d.header, {
        areas: e.target.value.split('\n')
      }))
    })), React.createElement("div", {
      className: "da-f",
      style: {
        gridColumn: '1 / -1'
      }
    }, React.createElement("label", null, "Extra fields"), ((d.header || {}).extra || []).map((f, i) => {
      const sf = (k, v) => set('header', Object.assign({}, d.header, {
        extra: d.header.extra.map((x, j) => j === i ? Object.assign({}, x, {
          [k]: v
        }) : x)
      }));
      return React.createElement("div", {
        key: i,
        style: {
          display: 'grid',
          gridTemplateColumns: 'minmax(140px,1fr) 100px minmax(140px,2fr) auto',
          gap: 8,
          marginBottom: 6
        }
      }, React.createElement("input", {
        className: "da-in",
        value: f.label,
        placeholder: "Label",
        onChange: e => sf('label', e.target.value)
      }), React.createElement("select", {
        className: "da-sel",
        value: f.type,
        onChange: e => sf('type', e.target.value)
      }, React.createElement("option", {
        value: "text"
      }, "Text"), React.createElement("option", {
        value: "select"
      }, "Choice"), React.createElement("option", {
        value: "aldrete"
      }, "Aldrete scale")), f.type === 'select' ? React.createElement("div", {
        style: {
          display: 'flex',
          gap: 8,
          alignItems: 'center'
        }
      }, React.createElement("input", {
        className: "da-in",
        style: {
          flex: 1
        },
        placeholder: "Choices separated by ;",
        value: (f.options || []).filter(Boolean).join('; '),
        onChange: e => sf('options', [''].concat(e.target.value.split(';').map(x => x.trim())))
      }), React.createElement("label", {
        style: {
          display: 'flex',
          gap: 4,
          alignItems: 'center',
          fontSize: 11.5,
          whiteSpace: 'nowrap'
        },
        title: "Adds 'Other \u2014 type\u2026': the auditor can type an answer that is not in the list"
      }, React.createElement("input", {
        type: "checkbox",
        checked: !!f.other,
        onChange: e => sf('other', e.target.checked)
      }), "Other (typed)")) : React.createElement("span", null), React.createElement("button", {
        className: "da-btn sm danger",
        onClick: () => set('header', Object.assign({}, d.header, {
          extra: d.header.extra.filter((_, j) => j !== i)
        }))
      }, "\xD7"));
    }), React.createElement("button", {
      className: "da-btn sm",
      onClick: () => set('header', Object.assign({}, d.header, {
        extra: ((d.header || {}).extra || []).concat([{
          id: '',
          label: '',
          type: 'text'
        }])
      }))
    }, "+ Field")))), React.createElement("div", {
      className: "da-card"
    }, React.createElement("div", {
      className: "da-h"
    }, React.createElement("h3", null, "How to apply by area (N/A guide)"), React.createElement("span", {
      className: "grow"
    }), React.createElement("button", {
      className: "da-btn sm",
      onClick: () => set('naGuide', (d.naGuide || []).concat([{
        areas: [],
        na: [],
        never: [],
        note: ''
      }]))
    }, "+ Rule")), React.createElement("div", {
      className: "da-pad"
    }, (d.naGuide || []).length === 0 && React.createElement("div", {
      className: "da-sub"
    }, "No rule. A rule offers one-click N/A for criteria that do not apply in an area, and can forbid N/A for criteria that always apply there."), (d.naGuide || []).map((g, i) => {
      const sg = (k, v) => set('naGuide', d.naGuide.map((x, j) => j === i ? Object.assign({}, x, {
        [k]: v
      }) : x));
      const tog = (k, id) => sg(k, (g[k] || []).indexOf(id) >= 0 ? g[k].filter(x => x !== id) : (g[k] || []).concat([id]));
      return React.createElement("div", {
        key: i,
        className: "da-card da-pad",
        style: {
          marginBottom: 8,
          display: 'grid',
          gap: 6
        }
      }, React.createElement("div", {
        style: {
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4
        }
      }, React.createElement("span", {
        className: "da-sub",
        style: {
          width: 70
        }
      }, "Areas"), ((d.header || {}).areas || []).filter(Boolean).map(a => React.createElement("button", {
        key: a,
        className: 'da-btn sm' + ((g.areas || []).indexOf(a) >= 0 ? ' pri' : ''),
        onClick: () => tog('areas', a)
      }, a))), React.createElement("div", {
        style: {
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4
        }
      }, React.createElement("span", {
        className: "da-sub",
        style: {
          width: 70
        }
      }, "Suggest N/A"), liveCrit.map(c => React.createElement("button", {
        key: c.id,
        className: 'da-btn sm' + ((g.na || []).indexOf(c.id) >= 0 ? ' pri' : ''),
        onClick: () => tog('na', c.id)
      }, "#", c.no))), React.createElement("div", {
        style: {
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4
        }
      }, React.createElement("span", {
        className: "da-sub",
        style: {
          width: 70
        }
      }, "Never N/A"), liveCrit.map(c => React.createElement("button", {
        key: c.id,
        className: 'da-btn sm' + ((g.never || []).indexOf(c.id) >= 0 ? ' pri' : ''),
        onClick: () => tog('never', c.id)
      }, "#", c.no))), React.createElement("div", {
        style: {
          display: 'flex',
          gap: 8
        }
      }, React.createElement("textarea", {
        className: "da-ta",
        rows: 2,
        placeholder: "Guidance shown to the auditor",
        value: g.note || '',
        onChange: e => sg('note', e.target.value)
      }), React.createElement("button", {
        className: "da-btn sm danger",
        onClick: () => set('naGuide', d.naGuide.filter((_, j) => j !== i))
      }, "\xD7")));
    }))), (cur.history || []).length > 0 && React.createElement("div", {
      className: "da-card da-pad"
    }, React.createElement("div", {
      className: "da-sub",
      style: {
        fontWeight: 700,
        marginBottom: 4
      }
    }, "HISTORY"), cur.history.slice().reverse().map((h, i) => React.createElement("div", {
      key: i,
      style: {
        fontSize: 11.8
      }
    }, when(h.at), " \xB7 ", h.by, " \xB7 ", h.action, h.changes ? ' (' + h.changes + ')' : '')))));
  }
  function Settings({
    meta,
    reloadMeta,
    setRoute
  }) {
    const [data, setData] = useState(null);
    const [draft, setDraft] = useState({});
    const [flags, setFlags] = useState(null);
    const [busy, setBusy] = useState(false);
    const load = () => api('/api/doc-audit/config').then(j => {
      setData(j);
      setDraft({});
      setFlags({
        kpiLink: j.kpiLink,
        ackRequired: j.ackRequired,
        evidenceRequired: j.evidenceRequired
      });
    }).catch(e => toast(e.message, 'error'));
    useEffect(() => {
      load();
    }, []);
    if (!data) return React.createElement("div", {
      className: "da-card da-empty"
    }, "Loading the settings\u2026");
    const cfgOf = d => Object.assign({}, d.cfg, draft[d.id] || {});
    const setRow = (d, k, v) => setDraft(x => Object.assign({}, x, {
      [d.id]: Object.assign({
        toolId: d.cfg.toolId,
        enabled: d.cfg.enabled,
        minRecords: d.cfg.minRecords
      }, x[d.id] || {}, {
        [k]: v
      })
    }));
    const dirty = Object.keys(draft).length > 0 || flags.kpiLink !== data.kpiLink || flags.ackRequired !== data.ackRequired || flags.evidenceRequired !== data.evidenceRequired;
    const auditorsOf = id => (data.people || []).filter(p => p.auditDepartments.indexOf('*') >= 0 || p.auditDepartments.indexOf(id) >= 0);
    async function save() {
      setBusy(true);
      try {
        const r = await post('/api/doc-audit/config', {
          depts: draft,
          kpiLink: flags.kpiLink,
          ackRequired: flags.ackRequired,
          evidenceRequired: flags.evidenceRequired
        }, 'PUT');
        toast(r.changed ? 'Settings saved.' : 'Nothing changed.', 'success');
        load();
        reloadMeta();
        refreshBadge();
      } catch (e) {
        toast(e.message, 'error');
      } finally {
        setBusy(false);
      }
    }
    return React.createElement("div", {
      className: "da-wrap"
    }, React.createElement("div", {
      className: "da-card da-pad",
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 10
      }
    }, React.createElement(Switch, {
      on: flags.kpiLink,
      onClick: () => setFlags(f => Object.assign({}, f, {
        kpiLink: !f.kpiLink
      }))
    }, React.createElement("span", null, React.createElement("b", null, "Feed Nursing KPI 2C (Documentation Accuracy)"), " \u2014 every completed audit counts, all departments: \u03A3 Yes \xF7 \u03A3 (Yes + No).")), React.createElement(Switch, {
      on: flags.ackRequired,
      onClick: () => setFlags(f => Object.assign({}, f, {
        ackRequired: !f.ackRequired
      }))
    }, React.createElement("span", null, React.createElement("b", null, "Nurse\u2019s acknowledgement required before publishing"), " \u2014 off: optional (the nurse may still acknowledge, before or after publishing).")), React.createElement(Switch, {
      on: flags.evidenceRequired,
      onClick: () => setFlags(f => Object.assign({}, f, {
        evidenceRequired: !f.evidenceRequired
      }))
    }, React.createElement("span", null, React.createElement("b", null, "Evidence required for every 'No'"), " \u2014 off: optional (the box is offered, never forced)."))), React.createElement("div", {
      className: "da-card"
    }, React.createElement("div", {
      className: "da-h"
    }, React.createElement("h3", null, "Departments"), React.createElement("span", {
      className: "da-sub"
    }, "Which audit tool each department uses and its minimum sample. Grey rows follow the guess from the department\u2019s name until saved."), React.createElement("span", {
      className: "grow"
    }), React.createElement("button", {
      className: "da-btn pri",
      disabled: !dirty || busy,
      onClick: save
    }, "Save")), React.createElement("div", {
      className: "da-scroll"
    }, React.createElement("table", {
      className: "da-tbl"
    }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Department"), React.createElement("th", null, "Audited"), React.createElement("th", null, "Tool"), React.createElement("th", {
      className: "n"
    }, "Min. records / month"), React.createElement("th", null, "Auditors"))), React.createElement("tbody", null, data.departments.map(d => {
      const c = cfgOf(d);
      const auds = auditorsOf(d.id);
      return React.createElement("tr", {
        key: d.id,
        style: !d.cfg.saved && !draft[d.id] ? {
          color: 'var(--muted)'
        } : null
      }, React.createElement("td", null, React.createElement("b", null, d.name), React.createElement("div", {
        className: "da-sub"
      }, d.id, !d.cfg.saved && !draft[d.id] ? ' · guessed' : '')), React.createElement("td", null, React.createElement(Switch, {
        on: !!c.enabled && !!c.toolId,
        onClick: () => setRow(d, 'enabled', !(c.enabled && c.toolId)),
        disabled: !c.toolId
      }, c.enabled && c.toolId ? 'Yes' : 'No')), React.createElement("td", null, React.createElement("select", {
        className: "da-sel",
        value: c.toolId || '',
        onChange: e => {
          setRow(d, 'toolId', e.target.value || null);
          if (e.target.value && !c.toolId) setRow(d, 'enabled', true);
        }
      }, React.createElement("option", {
        value: ""
      }, "\u2014 none \u2014"), data.tools.map(t => React.createElement("option", {
        key: t.id,
        value: t.id
      }, t.short || t.name)))), React.createElement("td", {
        className: "n"
      }, React.createElement("input", {
        type: "number",
        min: "0",
        className: "da-in",
        style: {
          width: 70,
          textAlign: 'right'
        },
        value: c.minRecords,
        onChange: e => setRow(d, 'minRecords', e.target.value === '' ? 0 : +e.target.value)
      })), React.createElement("td", {
        style: {
          fontSize: 12
        }
      }, data.peopleAvailable ? auds.length ? auds.map(p => p.name + (p.auditDepartments.indexOf('*') >= 0 ? ' (all)' : '')).join(', ') : React.createElement("span", {
        className: "da-muted"
      }, "nobody yet") : React.createElement("span", {
        className: "da-muted"
      }, "\u2014")));
    })))), React.createElement("div", {
      className: "da-pad da-sub"
    }, "Auditors are given in ", React.createElement("a", {
      href: "#",
      onClick: e => {
        e.preventDefault();
        setRoute({
          view: 'users'
        });
      }
    }, "Access Control"), ": tick Nursing Documentation KPI Audit (Add = fill audits, Edit = sign off as In-charge) and pick their departments. Administrators see every department.")));
  }
  const PRINT_CSS = '' + '.dap{font:9pt/1.35 "Segoe UI",Arial,sans-serif;color:#111;background:#fff}.dap *{box-sizing:border-box}' + '.dap .lh{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;padding-bottom:8px;border-bottom:1.5px solid #111}.dap .lh img{height:38px}' + '.dap .lh .tt{text-align:right}.dap .lh .kind{font-size:7pt;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#444}.dap .lh h1{margin:2px 0 0;font-size:13.5pt;color:#111}.dap .lh .code{font-size:7.5pt;color:#444;margin-top:2px}' + '.dap table{border-collapse:separate;border-spacing:0;width:100%;font-variant-numeric:tabular-nums}.dap thead{display:table-header-group}.dap tr{page-break-inside:avoid;break-inside:avoid}' + '.dap th,.dap td{border-right:.75pt solid #555;border-bottom:.75pt solid #555;padding:3.5px 5px;vertical-align:top;text-align:left}' + '.dap tr>*:first-child{border-left:.75pt solid #555}.dap thead tr:first-child>*{border-top:.75pt solid #555}.dap table.hd tr:first-child>*{border-top:.75pt solid #555}' + '.dap th{background:#e6e6e6;font-size:7pt;font-weight:700;text-transform:uppercase;letter-spacing:.3px}' + '.dap table.hd{margin:10px 0 6px;font-size:8.5pt}.dap table.hd td.k{background:#f2f2f2;font-weight:700;width:15%;font-size:7.5pt;text-transform:uppercase;letter-spacing:.2px}' + '.dap .hint{font-size:7.5pt;margin:4px 0 6px;color:#333}' + '.dap table.ck td.c{text-align:center;width:28px;font-size:10pt;font-weight:700}.dap table.ck td.no{width:26px;text-align:center;font-weight:700}' + '.dap table.ck tr.sec td{background:#d9d9d9;font-weight:700;font-size:7.5pt;text-transform:uppercase;letter-spacing:.4px}' + '.dap table.ck td.ev{width:28%;font-size:7.5pt}.dap .crit{font-size:6.5pt;font-weight:800;text-transform:uppercase}.dap .jci{font-size:6.8pt;width:46px}' + '.dap table.sum{margin-top:8px;font-size:8.5pt}.dap table.sum td.k{background:#f2f2f2;font-weight:700;width:22%}.dap table.sum td.v{width:28%;font-weight:700}' + '.dap .res{font-size:11pt;font-weight:800}.dap .act{margin-top:5px;font-size:8pt}' + '.dap .signs{display:grid;grid-template-columns:repeat(3,1fr);gap:22px;margin-top:22px;font-size:8pt}.dap .signs div{border-top:.75pt solid #111;padding-top:4px;min-height:44px}.dap .signs span{display:block;font-size:6.8pt;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:#444}' + '.dap .end{margin-top:12px;padding-top:5px;border-top:.5pt solid #999;display:flex;justify-content:space-between;font-size:7pt;color:#555}.dap .cr{margin-top:4px;text-align:center;font-size:6.2pt;color:#888}' + '.dap h2{font-size:10pt;margin:14px 0 6px;text-transform:uppercase;letter-spacing:.5px}.dap td.n,.dap th.n{text-align:right}.dap tr.tot td{font-weight:800;background:#eee}.dap .off{font-weight:800;color:#c0182f}' + '.dap .note{font-size:7.5pt;color:#333;margin-top:6px}' + '.dap h2{break-after:avoid;page-break-after:avoid}.dap h3.sec{font-size:11.5pt;margin:18px 0 6px;padding-bottom:3px;border-bottom:1pt solid #111;break-after:avoid;page-break-after:avoid}' + '.dap table.kt{font-size:8pt}.dap table.kt td.d{min-width:120px}.dap .legend{font-size:7pt;color:#333;margin:4px 0 2px;line-height:1.45}.dap .none{font-size:7.5pt;color:#555;margin:3px 0 8px}' + '.dap table.kv{font-size:8.5pt;margin:6px 0}.dap table.kv td.k{background:#f2f2f2;font-weight:700;width:18%}' + '.dap .gb{height:7px;background:#e6e6e6;width:120px}.dap .gb i{display:block;height:100%;background:#555}.dap .gb i.c{background:#111}' + '.dap td.b95{background:#dff1e5}.dap td.b90{background:#eef7f1}.dap td.b80{background:#fff3d9}.dap td.blow{background:#fde4e8}.dap td small{display:block;font-size:6.5pt;color:#555;font-weight:400}' + '.dap table.rg{font-size:7.5pt}.dap .chip{font-size:6.5pt;font-weight:700;border:.5pt solid #555;padding:0 3px;border-radius:2px;white-space:nowrap}';
  const logo = () => '<img src="' + esc(location.origin + '/unico/logo.svg') + '" alt="UNICO Hospitals">';
  const letterhead = (kind, title, code) => '<header class="lh">' + logo() + '<div class="tt"><div class="kind">' + esc(kind) + '</div><h1>' + esc(title) + '</h1>' + (code ? '<div class="code">' + esc(code) + '</div>' : '') + '</div></header>';
  const footer = () => {
    const at = new Date().toLocaleString('en-GB', {
      timeZone: 'Asia/Dhaka',
      dateStyle: 'medium',
      timeStyle: 'short'
    });
    return '<div class="end blk"><span>Printed by ' + esc(me() || '—') + ' on ' + esc(at) + ' from UNICO. Confidential — contains patient identifiers (policy 10).</span><span>Grading bands are an internal Unico scale, not an official JCI rating.</span></div><div class="cr">Automatically generated by the system · Developed by Nasif Ahammed Niloy</div>';
  };
  function auditDoc(a, tool, opts) {
    const o = opts || {};
    const crit = a ? a.criteria : DA.freezeCriteria(tool);
    const ans = a && a.answers || {},
      ev = a && a.evidence || {};
    const r = a ? a.result : null;
    const tick = (c, k) => ans[c.id] === k ? '✓' : '';
    const secs = (tool.sections || []).map(s => ({
      s,
      items: crit.filter(c => c.sectionId === s.id)
    })).filter(x => x.items.length);
    const rows = secs.map(({
      s,
      items
    }) => '<tr class="sec"><td colspan="8">Section ' + esc(s.id) + ': ' + esc(s.title) + (s.jci ? ' (JCI: ' + esc(s.jci) + ')' : '') + '</td></tr>' + items.map(c => '<tr><td class="no">' + c.no + '</td><td>' + esc(c.text) + '</td><td class="jci">' + esc((c.jci || []).join(', ')) + '</td><td class="crit">' + (c.critical ? 'Critical' : '') + '</td><td class="c">' + tick(c, 'Y') + '</td><td class="c">' + tick(c, 'N') + '</td><td class="c">' + tick(c, 'NA') + '</td><td class="ev">' + esc(ev[c.id] || '') + '</td></tr>').join('')).join('');
    const H = tool.header || {};
    const v = x => a ? esc(x || '—') : x ? esc(x) : '&nbsp;';
    const extra = (H.extra || []).map(f => [f.label, f.type === 'aldrete' ? a ? DA.aldreteText((a.extra || {})[f.id], true) : 'A__ R__ C__ Co__ O__ = ___/10 (≥ 9 = discharge)' : a ? (a.extra || {})[f.id] : '']);
    const pairs = [['Department', a ? a.deptName : o.deptName], ['Audit date / shift', a && DA.fmtDate(a.date) + (a.shift ? ' · ' + a.shift : '')], ['Patient UHID / MRN', a && a.uhid], [DA.nursesOf(a).length > 1 ? 'Nurses audited' : 'Nurse auditee', a && DA.nursesOf(a).map(n => n.name + (n.empId ? ' (ID ' + n.empId + ')' : '') + otherText(n)).join(', ')], ['Auditor', a && a.auditor && a.auditor.name], [H.bedLabel || 'Ward / bed no.', a && a.bed], [H.areaLabel || 'Area', a && a.area]].concat(extra);
    while (pairs.length % 2) pairs.push(['', '']);
    let hd = '';
    for (let i = 0; i < pairs.length; i += 2) hd += '<tr><td class="k">' + esc(pairs[i][0]) + '</td><td>' + v(pairs[i][1]) + '</td><td class="k">' + esc(pairs[i + 1][0]) + '</td><td>' + (pairs[i + 1][0] ? v(pairs[i + 1][1]) : '') + '</td></tr>';
    const byId = {};
    crit.forEach(c => {
      byId[c.id] = c;
    });
    const sum = '<table class="sum blk"><tr><td class="k">Total \'Yes\' (A)</td><td class="v">' + (r ? r.yes : '') + '</td><td class="k">Score % = A ÷ (A + B) × 100</td><td class="v">' + (r && r.pct != null ? r.pct + '%' : '') + '</td></tr>' + '<tr><td class="k">Total \'No\' (B)</td><td class="v">' + (r ? r.no : '') + '</td><td class="k">Critical criteria marked \'No\'</td><td class="v">' + (r ? r.criticalFails.map(id => '#' + (byId[id] ? byId[id].no : id)).join(', ') || 'None' : '') + '</td></tr>' + '<tr><td class="k">Total \'N/A\'</td><td class="v">' + (r ? r.na : '') + '</td><td class="k">Grade</td><td class="v">' + (r ? esc(r.gradeLabel) : 'Excellent / Good / Needs improvement / Unsatisfactory') + '</td></tr>' + '<tr><td class="k">Applicable (A + B)</td><td class="v">' + (r ? r.applicable : '') + '</td><td class="k">Result</td><td class="v res">' + (r ? r.result : 'PASS / FAIL') + '</td></tr></table>' + (r && r.action ? '<div class="act blk"><b>Required action:</b> ' + esc(r.action) + '</div>' : '') + (a && a.remarks ? '<div class="act blk"><b>Remarks / feedback:</b> ' + esc(a.remarks) + '</div>' : '');
    const signs = '<div class="signs blk"><div><span>Auditor</span>' + (a ? esc(a.auditor.name) + '<br>' + esc(when(a.completedAt || a.createdAt)) : 'Signature: ______________<br>Date / time: ____________') + '</div>' + '<div><span>Auditee nurse' + (a && DA.nursesOf(a).length > 1 ? 's' : '') + ' (acknowledgement)</span>' + (a && DA.nursesOf(a).length ? DA.nursesOf(a).map(n => {
      const k = DA.acksOf(a)[DA.nurseKey(n)];
      return esc(n.name) + (k ? ' · ' + esc(when(k.at)) + (k.method === 'account' ? ' · own account' : ' · in person') : ' · ____________');
    }).join('<br>') : 'Signature: ______________<br>Date / time: ____________') + '</div>' + '<div><span>Nurse In-charge (published)</span>' + (a && a.signoff ? 'Published by ' + esc(a.signoff.name) + '<br>' + esc(when(a.signoff.at)) : 'Signature: ______________<br>Date / time: ____________') + '</div></div>';
    const body = letterhead('Nursing Quality & Patient Safety', tool.name, [tool.code, tool.version && 'Version ' + tool.version, a && a.toolRevision > 1 ? 'tool revision ' + a.toolRevision : ''].filter(Boolean).join(' · ')) + '<table class="hd">' + hd + '</table>' + '<div class="hint">Mark ✓ in one box per criterion. Write evidence for a \'No\' where useful. Items marked Critical: any \'No\' = audit FAIL. N/A is excluded from scoring.</div>' + '<table class="ck"><thead><tr><th>No.</th><th>Compliance criterion</th><th>JCI</th><th>Critical</th><th>Yes</th><th>No</th><th>N/A</th><th>Evidence / remarks</th></tr></thead><tbody>' + rows + '</tbody></table>' + sum + signs + footer();
    const title = a ? 'Documentation audit — ' + DA.nurseNames(a) + ' — ' + a.date : tool.name + ' (blank form)';
    return {
      body,
      title,
      file: a ? 'Documentation-Audit_' + a.deptName.replace(/\W+/g, '-') + '_' + a.date : 'Documentation-Audit-form_' + (tool.short || tool.id).replace(/\W+/g, '-')
    };
  }
  function periodLabel(months) {
    const m = months || [];
    if (!m.length) return '';
    if (m.length === 1) return DA.fmtMonth(m[0]);
    if (m.length === 12 && m[0].slice(5) === '01' && m[11].slice(5) === '12' && m[0].slice(0, 4) === m[11].slice(0, 4)) return 'Year ' + m[0].slice(0, 4);
    const a = DA.fmtMonth(m[0]),
      b = DA.fmtMonth(m[m.length - 1]);
    return a.slice(-4) === b.slice(-4) ? a.slice(0, 3) + ' – ' + b : a + ' – ' + b;
  }
  const toolsIn = data => data.tools.filter(t => data.rows.some(r => r.toolId === t.id && r.total.records > 0));
  const codesOf = tools => tools.map(t => [t.code, t.version ? 'v' + t.version : ''].filter(Boolean).join(' ')).filter(Boolean).join(' · ');
  const kv = (k, n) => !n || k.value == null ? '—' : k.met === false ? '<span class="off">' + k.value + '% ▼</span>' : k.value + '%';
  function kpiSection(data, t, n) {
    const rows = data.rows.filter(r => r.toolId === t.id);
    const audited = rows.filter(r => r.total.records > 0),
      idle = rows.filter(r => !r.total.records);
    const h = data.hospital[t.id];
    return '<h2>' + (n ? n + ' ' : '') + esc(t.name) + (t.code ? ' · ' + esc(t.code) + (t.version ? ' v' + esc(t.version) : '') : '') + '</h2>' + '<table class="kt"><thead><tr><th>Department</th><th class="n">Records</th><th class="n">Nurses</th>' + t.kpis.map(k => '<th class="n">' + esc(k.name) + '<br>' + (k.direction === 'lower' ? '≤ ' : '≥ ') + k.target + '%</th>').join('') + '<th>Top 3 failing criteria</th></tr></thead><tbody>' + audited.map(r => '<tr><td class="d">' + esc(r.name) + (r.caps.length ? ' <span class="chip">CAP due</span>' : '') + (r.minRecords && r.total.records < r.minRecords * data.months.length ? '<br><small>' + r.total.records + ' of min ' + r.minRecords * data.months.length + '</small>' : '') + '</td><td class="n">' + r.total.records + '</td><td class="n">' + r.total.nurses + '</td>' + r.total.kpis.map(k => '<td class="n">' + kv(k, r.total.records) + '</td>').join('') + '<td>' + esc(r.total.topFailing.map(g => '#' + g.no + ' ×' + g.count + (g.critical ? ' (C)' : '')).join(', ') || '—') + '</td></tr>').join('') + (h ? '<tr class="tot"><td>HOSPITAL TOTAL</td><td class="n">' + h.total.records + '</td><td class="n">' + h.total.nurses + '</td>' + h.total.kpis.map(k => '<td class="n">' + kv(k, h.total.records) + '</td>').join('') + '<td>' + esc(h.total.topFailing.map(g => '#' + g.no + ' ×' + g.count).join(', ')) + '</td></tr>' : '') + '</tbody></table>' + (idle.length ? '<div class="none blk"><b>No audits in this period:</b> ' + esc(idle.map(r => r.name).join(', ')) + '</div>' : '') + '<div class="legend blk">' + t.kpis.map(k => '<b>' + esc(k.name) + '</b> = ' + esc(DA.KPI_FORMULA_LABEL[k.formula] || '') + (k.criteria && k.criteria.length ? ' (criteria ' + k.criteria.map(c => '#' + c.replace('c', '')).join(', ') + ')' : '')).join(' · ') + ' · <span class="off">red ▼</span> = below target · (C) = critical criterion.</div>';
  }
  const summaryTable = (data, extra) => {
    const ov = data.overall.total;
    const pct = (a, b) => b ? DA.round1(a / b * 100) + '%' : '—';
    const caps = data.rows.filter(r => r.caps.length).map(r => r.name);
    const pub = extra ? extra.audits.filter(x => x.status === 'signed').length : null;
    return '<table class="kv blk"><tr><td class="k">Reporting period</td><td>' + esc(periodLabel(data.months)) + '</td><td class="k">Departments audited</td><td>' + data.rows.filter(r => r.total.records).length + ' of ' + data.rows.length + '</td></tr>' + '<tr><td class="k">Records audited</td><td>' + ov.records + ' · ' + ov.nurses + ' nurse(s)</td><td class="k">Documentation accuracy (all tools)</td><td><b>' + (ov.accuracy == null ? '—' : ov.accuracy + '%') + '</b> (target ≥ 90%)</td></tr>' + '<tr><td class="k">Critical failure rate</td><td>' + pct(ov.criticalRecords, ov.records) + ' · ' + ov.criticalRecords + ' record(s) (target ≤ 5%)</td><td class="k">Action plans due</td><td>' + (caps.length ? esc(caps.join(', ')) : 'None') + '</td></tr>' + (extra ? '<tr><td class="k">Published to nurses</td><td>' + pub + ' of ' + extra.audits.length + '</td><td class="k"></td><td></td></tr>' : '') + '</table>';
  };
  const signBlock = () => {
    const sig = sigNames();
    return '<div class="signs blk"><div><span>Prepared by</span>' + esc(sig.prepared || '') + '</div><div><span>Reviewed by (Nursing Quality Committee)</span>' + esc(sig.reviewed || '') + '</div><div><span>Approved by (Chief Executive Officer, CEO)</span>' + esc(sig.approved || '') + '</div></div>';
  };
  const reportHead = (data, kind) => {
    const tools = toolsIn(data);
    return letterhead('Nursing Quality & Patient Safety', 'Nursing Documentation KPI Audit' + (kind ? ' — ' + kind : '') + ' — ' + periodLabel(data.months), (codesOf(tools) || 'Nursing Documentation KPI Audit') + ' · Appendix C' + (data.deptName ? ' · ' + data.deptName : ''));
  };
  function reportDoc(data) {
    const tools = toolsIn(data);
    const body = reportHead(data, '') + summaryTable(data) + (tools.length ? tools.map(t => kpiSection(data, t)).join('') : '<p>No audit in this period.</p>') + '<p class="note blk">Results go to the Nursing Quality Committee by the 10th of the following month. A department below target for 2 consecutive months submits a corrective action plan (Appendix B) for its top 3 failing criteria.</p>' + signBlock() + footer();
    const label = periodLabel(data.months);
    return {
      body,
      title: 'Nursing Documentation KPI Audit — ' + label,
      file: 'Nursing-Documentation-KPI-Audit_' + label.replace(/\W+/g, '-')
    };
  }
  function completeDoc(data, extra) {
    const tools = toolsIn(data);
    const label = periodLabel(data.months);
    let n = 0;
    const sec = title => '<h3 class="sec">' + ++n + '. ' + esc(title) + '</h3>';
    const band = v => v == null ? '' : v >= 95 ? 'b95' : v >= 90 ? 'b90' : v >= 80 ? 'b80' : 'blow';
    let trend;
    if (data.months.length < 2) trend = '<p class="note">One month only — choose a longer period (e.g. Last 3 months) for the trend.</p>';else {
      const audited = data.rows.filter(r => r.total.records > 0);
      trend = '<table class="kt"><thead><tr><th>Department</th>' + data.months.map(m => '<th class="n">' + esc(DA.fmtMonth(m)) + '</th>').join('') + '<th class="n">Period</th></tr></thead><tbody>' + audited.map(r => '<tr><td class="d">' + esc(r.name) + '</td>' + data.months.map(m => {
        const s2 = r.months[m];
        return '<td class="n ' + band(s2.accuracy) + '">' + (s2.accuracy == null ? '·' : s2.accuracy + '%') + (s2.records ? '<small>' + s2.records + ' rec.</small>' : '') + '</td>';
      }).join('') + '<td class="n ' + band(r.total.accuracy) + '"><b>' + (r.total.accuracy == null ? '—' : r.total.accuracy + '%') + '</b><small>' + r.total.records + ' rec.</small></td></tr>').join('') + '<tr class="tot"><td>ALL DEPARTMENTS</td>' + data.months.map(m => {
        const s2 = data.overall.months[m];
        return '<td class="n">' + (s2.accuracy == null ? '·' : s2.accuracy + '%') + '<small>' + s2.records + ' rec.</small></td>';
      }).join('') + '<td class="n">' + (data.overall.total.accuracy == null ? '—' : data.overall.total.accuracy + '%') + '</td></tr></tbody></table>' + '<div class="legend">Documentation accuracy = Σ Yes ÷ Σ (Yes + No). Shading: ≥ 95% · ≥ 90% · ≥ 80% · below 80%.</div>';
    }
    const gaps = tools.map(t => {
      const h = data.hospital[t.id];
      const gs = h ? h.total.gaps.slice(0, 10) : [];
      if (!gs.length) return '<h2>' + esc(t.name) + '</h2><p class="note">No criterion was marked \'No\'.</p>';
      const max = Math.max(1, ...gs.map(g => g.count));
      return '<h2>' + esc(t.name) + '</h2><table class="kt"><thead><tr><th class="n">No.</th><th>Criterion</th><th>Critical</th><th class="n">Times \'No\'</th><th class="n">% of records</th><th></th></tr></thead><tbody>' + gs.map(g => '<tr><td class="n"><b>' + g.no + '</b></td><td>' + esc(g.text) + '</td><td>' + (g.critical ? '<b>Critical</b>' : '') + '</td><td class="n">' + g.count + '</td><td class="n">' + (h.total.records ? DA.round1(g.count / h.total.records * 100) : 0) + '%</td><td><div class="gb"><i class="' + (g.critical ? 'c' : '') + '" style="width:' + Math.round(g.count / max * 100) + '%"></i></div></td></tr>').join('') + '</tbody></table>';
    }).join('');
    const capRows = data.rows.filter(r => r.caps.length);
    const toolKpi = (tid, id) => {
      const t = data.tools.find(x => x.id === tid);
      const k = t && t.kpis.find(x => x.id === id);
      return k ? k.name : id;
    };
    const caps = capRows.length ? '<table class="kt"><thead><tr><th>Department</th><th>Month</th><th>Below target two months running</th><th>Top failing criteria (period)</th></tr></thead><tbody>' + capRows.map(r => r.caps.map(c => '<tr><td class="d">' + esc(r.name) + '</td><td>' + esc(DA.fmtMonth(c.month)) + '</td><td>' + esc(c.kpis.map(id => toolKpi(r.toolId, id)).join(', ')) + '</td><td>' + esc(r.total.topFailing.map(g => '#' + g.no + ' ×' + g.count).join(', ')) + '</td></tr>').join('')).join('') + '</tbody></table>' : '<p class="note">No department was below target two months running in this period.</p>';
    const nurseRows = extra.nurses || [];
    const otherOf = staffId => {
      const hit = extra.audits.map(x => DA.nursesOf(x).find(y => String(y.staffId) === String(staffId) && y.fromOtherDept)).find(Boolean);
      return hit ? (hit.homeDept || 'other dept') + ' · ' + (hit.assignment || 'Deployed') : '';
    };
    const nurses = nurseRows.length ? '<table class="kt"><thead><tr><th>#</th><th>Nurse</th><th>ID · designation</th><th class="n">Records</th><th class="n">Accuracy</th><th class="n">Critical</th><th>Top failing</th></tr></thead><tbody>' + nurseRows.map((b, i) => {
      const s2 = b.summary;
      const o = b.staffId ? otherOf(b.staffId) : '';
      return '<tr><td class="n">' + (i + 1) + '</td><td><b>' + esc(b.label) + '</b>' + (o ? '<br><small>from ' + esc(o) + '</small>' : '') + '</td><td>' + esc(b.sub || '') + '</td><td class="n">' + s2.records + '</td><td class="n ' + band(s2.accuracy) + '">' + (s2.accuracy == null ? '—' : s2.accuracy + '%') + '</td><td class="n">' + (s2.criticalRecords || '') + '</td><td>' + esc(s2.topFailing.map(g => '#' + g.no + ' ×' + g.count).join(', ')) + '</td></tr>';
    }).join('') + '</tbody></table><div class="legend">A shared record counts under each of its nurses.</div>' : '<p class="note">No nurse audited.</p>';
    const audits = extra.audits.slice().sort((x, y) => (x.date || '').localeCompare(y.date || '') || String(x.deptName).localeCompare(String(y.deptName)));
    const register = audits.length ? '<table class="kt rg"><thead><tr><th>#</th><th>Date</th><th>Department / area</th><th>UHID</th><th>Nurse(s)</th><th>Auditor</th><th class="n">Y/N/NA</th><th class="n">Score</th><th>Grade</th><th>Result</th><th>Status</th></tr></thead><tbody>' + audits.map((x, i) => {
      const r = x.result || {};
      return '<tr><td class="n">' + (i + 1) + '</td><td>' + esc(DA.fmtDate(x.date)) + (x.shift ? '<small>' + esc(x.shift) + '</small>' : '') + '</td><td>' + esc(x.deptName) + (x.area ? '<small>' + esc(x.area) + '</small>' : '') + '</td><td>' + esc(x.uhid || '') + '</td><td>' + DA.nursesOf(x).map(y => esc(y.name) + (y.empId ? ' (' + esc(y.empId) + ')' : '') + (y.fromOtherDept ? ' <span class="chip">other dept</span>' : '')).join('<br>') + '</td><td>' + esc(x.auditor && x.auditor.name || '') + '</td><td class="n">' + (r.yes != null ? r.yes + '/' + r.no + '/' + r.na : '') + '</td><td class="n"><b>' + (r.pct == null ? '—' : r.pct + '%') + '</b></td><td>' + esc(r.gradeLabel || '') + ((r.criticalFails || []).length ? '<small>' + r.criticalFails.length + ' critical</small>' : '') + '</td><td><b>' + esc(r.result || '') + '</b></td><td>' + esc(DA.STATUS_LABEL[x.status] || x.status) + '</td></tr>';
    }).join('') + '</tbody></table>' + (extra.more ? '<p class="note">Only the newest 500 audits are listed — choose a shorter period for the full register.</p>' : '') : '<p class="note">No audit in this period.</p>';
    const body = reportHead(data, 'Complete Report') + sec('Summary') + summaryTable(data, extra) + sec('Department KPI report') + (tools.length ? tools.map(t => kpiSection(data, t)).join('') : '<p class="note">No audit in this period.</p>') + sec('Trend by month') + trend + sec('Criterion gap analysis — the criteria most often marked \'No\'') + (gaps || '<p class="note">No audit in this period.</p>') + sec('Corrective action plans due') + caps + sec('Results by nurse') + nurses + sec('Audit register') + register + '<p class="note blk">Grades: ≥ 95% Excellent · 90–94.9% Good · 80–89.9% Needs improvement · < 80% Unsatisfactory. PASS = ≥ 90% and no critical criterion marked \'No\'. N/A is excluded from scoring.</p>' + signBlock() + footer();
    return {
      body,
      title: 'Nursing Documentation KPI Audit — complete report — ' + label,
      file: 'Nursing-Documentation-KPI-Audit-complete-report_' + label.replace(/\W+/g, '-')
    };
  }
  async function openPrint(log, doc, landscape) {
    const w = window.open('', '_blank');
    try {
      await post('/api/doc-audit/print', log);
      if (!w) {
        toast('Allow pop-ups for this site to print.', 'error');
        return;
      }
      w.document.open();
      w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' + esc(doc.title) + '</title><style>@page{size:A4 ' + (landscape ? 'landscape' : 'portrait') + ';margin:11mm}html{-webkit-print-color-adjust:exact;print-color-adjust:exact}body{margin:0;padding:14px}@media print{body{padding:0}}' + PRINT_CSS + '</style></head><body><div class="dap">' + doc.body + '</div><script>window.onload=function(){setTimeout(function(){window.print();},200);};<\/script></body></html>');
      w.document.close();
    } catch (e) {
      if (w) w.close();
      toast(e.message, 'error');
    }
  }
  async function pdfFrom(log, doc, landscape) {
    await post('/api/doc-audit/print', Object.assign({}, log, {
      pdf: true
    }));
    if (window.unicoLoadPdfLibs && !(window.jspdf && window.html2canvas)) await window.unicoLoadPdfLibs();
    const J = window.jspdf && window.jspdf.jsPDF,
      H = window.html2canvas;
    if (!J || !H) throw new Error('The PDF tools could not load. Use Print and choose “Save as PDF”.');
    const mmW = landscape ? 297 : 210,
      mmH = landscape ? 210 : 297,
      M = 10;
    const pxW = landscape ? 1123 : 794;
    const pxPerMm = pxW / (mmW - 2 * M);
    const pageH = (mmH - 2 * M - 6) * pxPerMm;
    const pdf = new J({
      orientation: landscape ? 'landscape' : 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });
    let pageNo = 0;
    for (const body of doc.parts || [doc.body]) {
      const host = document.createElement('div');
      host.style.cssText = 'position:fixed;left:-30000px;top:0;width:' + pxW + 'px;background:#fff;z-index:-1';
      host.innerHTML = '<style>' + PRINT_CSS + '</style><div class="dap" style="width:' + pxW + 'px;padding:0 4px">' + body + '</div>';
      document.body.appendChild(host);
      try {
        await Promise.all([...host.querySelectorAll('img')].map(im => im.complete ? 0 : new Promise(r => {
          im.onload = im.onerror = r;
        })));
        const root = host.querySelector('.dap');
        const scale = 2;
        const canvas = await H(root, {
          scale,
          backgroundColor: '#ffffff',
          useCORS: true,
          logging: false,
          windowWidth: pxW
        });
        const top0 = root.getBoundingClientRect().top;
        const cuts = [...root.querySelectorAll('tr, .blk')].map(el => el.getBoundingClientRect().bottom - top0).sort((x, y) => x - y);
        const total = root.scrollHeight;
        let start = 0,
          guard = 0;
        while (start < total - 2 && guard++ < 60) {
          const limit = start + pageH;
          const end = total <= limit ? total : cuts.filter(c => c > start + 60 && c <= limit).pop() || limit;
          const c = document.createElement('canvas');
          c.width = canvas.width;
          c.height = Math.max(1, Math.ceil((end - start) * scale));
          c.getContext('2d').drawImage(canvas, 0, start * scale, canvas.width, (end - start) * scale, 0, 0, canvas.width, (end - start) * scale);
          if (pageNo) pdf.addPage();
          pageNo++;
          pdf.addImage(c.toDataURL('image/jpeg', 0.92), 'JPEG', M, M, mmW - 2 * M, (end - start) / pxPerMm);
          start = end;
        }
      } finally {
        host.remove();
      }
    }
    for (let i = 1; i <= pageNo; i++) {
      pdf.setPage(i);
      pdf.setFontSize(7);
      pdf.setTextColor(120);
      pdf.text('Page ' + i + ' of ' + pageNo, mmW - M, mmH - 5, {
        align: 'right'
      });
    }
    pdf.setProperties({
      title: doc.title,
      author: me()
    });
    pdf.save(doc.file + '.pdf');
    toast('PDF downloaded.', 'success');
  }
  function blankDoc(tool, deptName, copies) {
    const n = Math.max(1, Math.min(30, +copies || 1));
    const one = auditDoc(null, tool, {
      deptName
    }).body;
    const parts = Array.from({
      length: n
    }, () => one);
    return {
      parts,
      body: parts.join('<div style="page-break-before:always;break-before:page"></div>'),
      title: (tool.short || tool.name) + ' — blank form' + (deptName ? ' — ' + deptName : ''),
      file: 'Documentation-Audit-form_' + String(tool.short || tool.id || 'tool').replace(/\W+/g, '-') + (deptName ? '_' + deptName.replace(/\W+/g, '-') : '') + (n > 1 ? '_x' + n : '')
    };
  }
  function bulkDoc(audits, meta) {
    const parts = audits.map(a => auditDoc(a, toolOf(meta, a.toolId) || {
      name: a.toolName || 'Documentation audit',
      code: a.toolCode,
      sections: [...new Map(a.criteria.map(c => [c.sectionId, {
        id: c.sectionId,
        title: c.section || c.sectionId
      }])).values()],
      header: {}
    }).body);
    return {
      parts,
      body: parts.join('<div style="page-break-before:always;break-before:page"></div>'),
      title: audits.length + ' documentation audits',
      file: 'Documentation-Audits_' + audits.length + '_' + new Date().toISOString().slice(0, 10)
    };
  }
  const printAudit = (a, tool) => openPrint(a ? {
    kind: 'audit',
    id: a.id
  } : {
    kind: 'blank'
  }, auditDoc(a, tool), false);
  const pdfAudit = (a, tool) => pdfFrom({
    kind: 'audit',
    id: a.id
  }, auditDoc(a, tool), false);
  const printReport = data => openPrint({
    kind: 'report',
    from: data.months[0],
    to: data.months[data.months.length - 1]
  }, reportDoc(data), true);
  const pdfReport = data => pdfFrom({
    kind: 'report',
    from: data.months[0],
    to: data.months[data.months.length - 1]
  }, reportDoc(data), true);
  async function completeReport(data, dept, pdf) {
    const from = data.months[0],
      to = data.months[data.months.length - 1];
    const q = 'from=' + from + '&to=' + to + (dept ? '&dept=' + encodeURIComponent(dept) : '');
    const log = {
      kind: 'report',
      complete: true,
      from,
      to,
      dept: dept || undefined
    };
    const w = pdf ? null : window.open('', '_blank');
    try {
      const [s2, a2] = await Promise.all([api('/api/doc-audit/summary?' + q + '&by=nurse'), api('/api/doc-audit/audits?from=' + from + '-01&to=' + to + '-31' + (dept ? '&dept=' + encodeURIComponent(dept) : ''))]);
      const extra = {
        nurses: s2.breakdown || [],
        audits: (a2.audits || []).filter(x => x.status !== 'draft'),
        more: !!a2.more
      };
      const doc = completeDoc(Object.assign({}, data, {
        deptName: dept ? (data.rows.find(r => r.deptId === dept) || {}).name || '' : ''
      }), extra);
      if (pdf) return pdfFrom(log, doc, true);
      await post('/api/doc-audit/print', log);
      if (!w) {
        toast('Allow pop-ups for this site to print.', 'error');
        return;
      }
      w.document.open();
      w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' + esc(doc.title) + '</title><style>@page{size:A4 landscape;margin:11mm}html{-webkit-print-color-adjust:exact;print-color-adjust:exact}body{margin:0;padding:14px}@media print{body{padding:0}}' + PRINT_CSS + '</style></head><body><div class="dap">' + doc.body + '</div><script>window.onload=function(){setTimeout(function(){window.print();},250);};<\/script></body></html>');
      w.document.close();
    } catch (e) {
      if (w) w.close();
      toast(e.message, 'error');
    }
  }
  function DocAuditView({
    view,
    audit,
    dept,
    nurse,
    setRoute
  }) {
    useStyles();
    const [meta, err, reload] = useMeta();
    const isAdmin = !window.unicoUserPerms || window.unicoUserPerms() === null;
    if (err) return React.createElement("div", {
      className: "da-banner red"
    }, err);
    if (!meta) return React.createElement("div", {
      className: "da-card da-empty"
    }, "Loading Nursing Documentation KPI Audit\u2026");
    if (view === 'docAuditNew') {
      if (!audit && !meta.canAdd) return React.createElement("div", {
        className: "da-card da-empty"
      }, "Filling audits needs the Nursing Documentation KPI Audit \u201CAdd\u201D permission. Ask the administrator.");
      return React.createElement(AuditForm, {
        key: audit || 'new:' + (dept || ''),
        meta: meta,
        auditId: audit,
        initialDept: dept,
        setRoute: setRoute
      });
    }
    if (view === 'docAuditRegister') return React.createElement(Register, {
      key: nurse || '',
      meta: meta,
      nurse: nurse,
      setRoute: setRoute
    });
    if (view === 'docAuditReports') return React.createElement(Reports, {
      meta: meta,
      setRoute: setRoute
    });
    if (view === 'docAuditTools') return isAdmin ? React.createElement(Tools, {
      meta: meta,
      reloadMeta: reload
    }) : React.createElement("div", {
      className: "da-card da-empty"
    }, "Only an administrator can change the audit tools.");
    if (view === 'docAuditSettings') return isAdmin ? React.createElement(Settings, {
      meta: meta,
      reloadMeta: reload,
      setRoute: setRoute
    }) : React.createElement("div", {
      className: "da-card da-empty"
    }, "Only an administrator can change Nursing Documentation KPI Audit settings.");
    return React.createElement(Home, {
      meta: meta,
      setRoute: setRoute
    });
  }
  window.DocAuditView = DocAuditView;
})();
})();
