/* DOCUMENTATION AUDIT — the nursing documentation audit (UHP-NSG-QA-001 and its OT / Dialysis &
 * Endoscopy / Emergency companions QA-002…004), online. One audit = one patient record checked
 * against the department's tool: Yes / No / N/A per criterion, evidence for every No, the score,
 * grade and PASS / FAIL worked out as it is filled — then the nurse's acknowledgement and the
 * Nurse In-charge's sign-off.
 *
 *   docAuditHome      Dashboard — this month per department: records vs the minimum, accuracy,
 *                     pass rate, critical failures, what waits for acknowledgement / sign-off.
 *   docAuditNew       The audit form (route.audit = an existing audit: read, correct, sign off).
 *   docAuditRegister  Register — every audit, filtered by department, dates, status, result.
 *   docAuditReports   Reports — Appendix C per tool, trend by department, criterion gaps,
 *                     breakdown by area / shift / nurse / auditor, the Corrective Action Plan.
 *   docAuditTools     Audit tools (administrator) — sections, criteria, critical flags, KPIs…
 *   docAuditSettings  Settings (administrator) — which tool each department audits with.
 *
 * Every figure comes from /api/doc-audit (server/doc-audit.js), which checks the module and the
 * person's departments again and computes the score itself. The scoring rule is window.UNICO_DA
 * (doc-audit-core.js) — the same code the server runs, so the live panel shows the stored result.
 */
(function () {
  const { useState, useEffect, useMemo, useRef, useCallback } = React;
  const DA = window.UNICO_DA;
  const W = window;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const toast = (m, t) => { if (window.UI && window.UI.toast) window.UI.toast(m, t); };
  const confirmBox = (o) => (window.UI && window.UI.confirm ? window.UI.confirm(o) : Promise.resolve(window.confirm(o.message || o.title)));
  const refreshBadge = () => { try { window.dispatchEvent(new Event('unico:da-refresh')); } catch (e) { } };
  // Per-browser conveniences only; keys never start 'unico_' (those are synced with the server).
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } };
  const when = (t) => (t ? new Date(t).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka', dateStyle: 'medium', timeStyle: 'short' }) : '');
  const me = () => (window.__UNICO_USER__ && (window.__UNICO_USER__.name || window.__UNICO_USER__.username)) || '';
  const sigNames = () => { try { return window.unicoSig ? window.unicoSig.load() : {}; } catch (e) { return {}; } };
  const pctTxt = (v) => (v == null ? '—' : (Math.round(v * 10) / 10) + '%');

  async function api(url, opts) {
    const r = await fetch(url, Object.assign({ credentials: 'same-origin', cache: 'no-store', headers: { accept: 'application/json', 'content-type': 'application/json' } }, opts || {}));
    if (r.status === 401 || r.redirected) throw new Error('Your session has expired. Sign in again.');
    const j = await r.json().catch(() => null);
    if (!j) throw new Error('The server did not answer. Please try again.');
    if (!j.ok) { const e = new Error(j.error || 'Something went wrong.'); e.status = r.status; e.body = j; throw e; }
    return j;
  }
  const post = (url, body, method) => api(url, { method: method || 'POST', body: JSON.stringify(body || {}) });
  async function download(url, fallback) {
    const r = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
    if (!r.ok) { const j = await r.json().catch(() => null); throw new Error((j && j.error) || 'Could not build the file.'); }
    const m = /filename="([^"]+)"/.exec(r.headers.get('content-disposition') || '');
    const href = URL.createObjectURL(await r.blob());
    const a = document.createElement('a'); a.href = href; a.download = m ? m[1] : (fallback || 'Documentation-Audit.xlsx'); document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 4000);
  }

  /* ================================================================== styles === */
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
      const s = document.createElement('style'); s.id = 'da-css'; s.textContent = CSS; document.head.appendChild(s);
    }, []);
  }

  /* ============================================================ small parts === */
  const StatusChip = ({ s }) => <span className={'da-chip ' + s}>{DA.STATUS_LABEL[s] || s}</span>;
  const ResultChip = ({ r }) => (!r || !r.result ? <span className="da-muted">—</span>
    : <span className={'da-chip ' + (r.result === 'PASS' ? 'pass' : 'fail')}>{r.result}</span>);
  const gradeColor = (g) => ({ excellent: '#14713f', good: '#1f9d57', improve: '#8a5a00', unsat: '#a3172f' })[g] || 'var(--muted)';
  const Switch = ({ on, onClick, children, disabled }) => <span className={'da-switch' + (on ? ' on' : '')} onClick={() => !disabled && onClick && onClick()} style={disabled ? { opacity: .5, cursor: 'default' } : null}><i />{children}</span>;
  function Modal({ title, onClose, children, footer, wide }) {
    useEffect(() => { const k = (e) => { if (e.key === 'Escape') onClose(); }; document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k); }, []);
    return ReactDOM.createPortal(
      <div className="da-modal-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="da-modal" style={wide ? { maxWidth: 980 } : null} role="dialog" aria-label={title}>
          <div className="da-modal-h"><b>{title}</b><button onClick={onClose} aria-label="Close">×</button></div>
          <div className="da-modal-b">{children}</div>
          {footer && <div className="da-modal-f">{footer}</div>}
        </div>
      </div>, document.body);
  }
  // A text the person must write before an action goes ahead (reopen / remove / acknowledgement note).
  function askText(o) {
    return new Promise((done) => {
      const host = document.createElement('div'); document.body.appendChild(host);
      const root = ReactDOM.createRoot ? ReactDOM.createRoot(host) : null;
      const close = (v) => { if (root) root.unmount(); else ReactDOM.unmountComponentAtNode(host); host.remove(); done(v); };
      function Ask() {
        const [v, setV] = useState('');
        const short = (o.min || 0) > v.trim().length;
        return <Modal title={o.title} onClose={() => close(null)} footer={<><button className="da-btn" onClick={() => close(null)}>Cancel</button><button className={'da-btn ' + (o.danger ? 'danger' : 'pri')} disabled={short} onClick={() => close(v.trim())}>{o.confirmLabel || 'OK'}</button></>}>
          {o.message && <div style={{ fontSize: 12.8, lineHeight: 1.5 }}>{o.message}</div>}
          <textarea className="da-ta" autoFocus rows={3} value={v} onChange={(e) => setV(e.target.value)} placeholder={o.placeholder || ''} />
          {o.min ? <div className="da-sub">{short ? 'At least ' + o.min + ' characters.' : ''}</div> : null}
        </Modal>;
      }
      if (root) root.render(<Ask />); else ReactDOM.render(<Ask />, host);
    });
  }

  // Which of the nurses acknowledged in person (all ticked), and a note.
  function askAck(pending) {
    return new Promise((done) => {
      const host = document.createElement('div'); document.body.appendChild(host);
      const root = ReactDOM.createRoot ? ReactDOM.createRoot(host) : null;
      const close = (v) => { if (root) root.unmount(); else ReactDOM.unmountComponentAtNode(host); host.remove(); done(v); };
      function Ask() {
        const [keys, setKeys] = useState(pending.map(DA.nurseKey));
        const [note, setNote] = useState('');
        const tog = (k) => setKeys((ks) => (ks.indexOf(k) >= 0 ? ks.filter((x) => x !== k) : ks.concat([k])));
        return <Modal title={pending.length > 1 ? 'Nurses’ acknowledgement' : 'Nurse’s acknowledgement'} onClose={() => close(null)}
          footer={<><button className="da-btn" onClick={() => close(null)}>Cancel</button><button className="da-btn pri" disabled={!keys.length} onClick={() => close({ keys, note: note.trim() })}>Record acknowledgement</button></>}>
          <div style={{ fontSize: 12.8, lineHeight: 1.5 }}>Record that {pending.length > 1 ? 'these nurses were' : pending[0].name + ' was'} given the same-day feedback and acknowledged this audit (policy 7.2).</div>
          {pending.length > 1 && <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{pending.map((n) => { const k = DA.nurseKey(n);
            return <label key={k} style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', fontSize: 13 }}><input type="checkbox" checked={keys.indexOf(k) >= 0} onChange={() => tog(k)} /><b>{n.name}</b><span className="da-sub">{nurseSub(n)}</span></label>; })}</div>}
          <textarea className="da-ta" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional) — e.g. feedback given at the nurses’ station; gaps explained." />
        </Modal>;
      }
      if (root) root.render(<Ask />); else ReactDOM.render(<Ask />, host);
    });
  }

  function useMeta() {
    const [meta, setMeta] = useState(null);
    const [err, setErr] = useState('');
    const load = useCallback(() => api('/api/doc-audit/meta').then(setMeta).catch((e) => setErr(e.message)), []);
    useEffect(() => { load(); }, []);
    return [meta, err, load];
  }
  const NoDepts = ({ meta, setRoute }) => (
    <div className="da-card da-empty">
      {meta && meta.isAdmin
        ? <span>No department is switched on for Nursing Documentation KPI Audit yet. Open <a href="#" onClick={(e) => { e.preventDefault(); setRoute({ view: 'docAuditSettings' }); }}>Nursing Documentation KPI Audit → Settings</a> and choose the tool each department audits with.</span>
        : <span>No department has been set for you yet. Ask the administrator to choose your departments in Access Control → Nursing Documentation KPI Audit.</span>}
    </div>
  );
  const toolOf = (meta, id) => ((meta && meta.tools) || []).find((t) => t.id === id) || null;

  /* ======================================================== nurse picker === */
  /* The nurses whose documentation was audited — one patient record can be documented by several
     (day + night, scrub + circulating): one shared checklist, the audit on every listed nurse's
     record. Each is a register record of the auditor's departments (the server lists only those)
     or a typed name for someone not in the register. Up to DA.MAX_NURSES. */
  const nurseLine = (n) => [n.empId && 'ID ' + n.empId, n.designation, n.department, n.linked === false && 'not in the register'].filter(Boolean).join(' · ');
  // A nurse who belongs to another department (deployed, relief…) — shown wherever the audit is, so it stays on record.
  const OtherDept = ({ n }) => (n && n.fromOtherDept ? <span className="da-chip" style={{ background: '#fff1d6', color: '#8a5a00', marginLeft: 5, verticalAlign: 1 }} title="Belongs to another department">⇄ Other dept{n.homeDept && n.homeDept !== n.department ? ' · ' + n.homeDept : ''} · {n.assignment || 'Deployed'}</span> : null);
  const nurseSub = (n) => <>{nurseLine(n)}<OtherDept n={n} /></>;
  const otherText = (n) => (n && n.fromOtherDept ? ' — from ' + (n.homeDept || n.department || 'another department') + ', ' + String(n.assignment || 'Deployed').toLowerCase() : '');
  function NursePicker({ meta, deptId, value, onChange, bad, disabled, excludeId }) {
    const picked = Array.isArray(value) ? value : [];
    const [list, setList] = useState(null);
    const [all, setAll] = useState(false);
    const [q, setQ] = useState('');
    const [open, setOpen] = useState(false);
    const [hi, setHi] = useState(0);
    const [manual, setManual] = useState(null);   // { name, empId } while typing a nurse not in the register
    const ref = useRef(null);
    const [pos, setPos] = useState(null);
    useEffect(() => {
      if (!deptId || disabled) return;
      let live = true;
      setList(null);
      api('/api/doc-audit/staff?' + (all ? 'all=1' : 'dept=' + encodeURIComponent(deptId))).then((j) => { if (live) setList(j.staff); }).catch(() => { if (live) setList([]); });
      return () => { live = false; };
    }, [deptId, all, disabled]);
    const place = () => { const r = ref.current && ref.current.getBoundingClientRect(); if (!r) return; const below = window.innerHeight - r.bottom; const up = below < 240 && r.top > below; setPos({ left: r.left, width: Math.max(r.width, 280), top: up ? null : r.bottom + 4, bottom: up ? window.innerHeight - r.top + 4 : null, maxH: Math.min(320, (up ? r.top : below) - 12) }); };
    useEffect(() => {
      if (!open) return;
      place();
      const f = () => place();
      window.addEventListener('scroll', f, true); window.addEventListener('resize', f);
      const out = (e) => { if (ref.current && !ref.current.contains(e.target) && !(e.target.closest && e.target.closest('.da-dd'))) setOpen(false); };
      document.addEventListener('mousedown', out);
      return () => { window.removeEventListener('scroll', f, true); window.removeEventListener('resize', f); document.removeEventListener('mousedown', out); };
    }, [open]);
    const full = picked.length >= DA.MAX_NURSES;
    const needle = q.trim().toLowerCase();
    // Nurses of OTHER departments (deployed, relief, float): searched in the whole register as you type.
    const [others, setOthers] = useState([]);
    useEffect(() => {
      if (all || disabled || needle.length < 2) { setOthers([]); return; }
      let live = true;
      const t = setTimeout(() => { api('/api/doc-audit/staff?all=1&q=' + encodeURIComponent(needle)).then((j) => { if (live) setOthers(j.staff || []); }).catch(() => {}); }, 250);
      return () => { live = false; clearTimeout(t); };
    }, [needle, all, disabled]);
    const isPicked = (p) => picked.some((n) => String(n.staffId) === String(p.id));
    const self = (p) => (meta && meta.staffId != null && String(p.id) === String(meta.staffId)) || (excludeId != null && String(p.id) === String(excludeId));
    const hits = (list || []).filter((p) => !needle || String(p.name || '').toLowerCase().indexOf(needle) >= 0 || String(p.emp_id || '').toLowerCase().indexOf(needle) >= 0).slice(0, 80);
    const add = (n) => onChange(picked.concat([n]));
    const localIds = new Set((list || []).map((p) => String(p.id)));
    const extra = others.filter((p) => !localIds.has(String(p.id)));
    const choices = hits.concat(extra);
    const isOther = (p) => !all && !localIds.has(String(p.id));
    const pick = (p) => { if (self(p) || isPicked(p) || full) return; const other = isOther(p);
      add(Object.assign({ staffId: String(p.id), empId: String(p.emp_id || ''), name: p.name, designation: p.designation || '', department: p.current_department || '', linked: true },
        other ? { fromOtherDept: true, homeDept: p.current_department || '', assignment: 'Deployed' } : {})); setQ(''); setHi(0); };
    const remove = (i) => onChange(picked.filter((_, j) => j !== i));
    const key = (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHi((h) => Math.min(h + 1, choices.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
      else if (e.key === 'Enter' && open && choices[hi]) { e.preventDefault(); pick(choices[hi]); }
      else if (e.key === 'Escape') setOpen(false);
      else if (e.key === 'Backspace' && !q && picked.length) remove(picked.length - 1);
    };
    const chips = picked.map((n, i) => (
      <div key={DA.nurseKey(n) + i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 10px', border: '1px solid var(--line)', borderRadius: 8, background: '#f6fafd', animation: 'da-in .2s ease' }}>
        <span style={{ display: 'inline-grid', placeItems: 'center', width: 20, height: 20, borderRadius: '50%', background: '#1f4f8a', color: '#fff', fontSize: 10.5, fontWeight: 800, flex: 'none' }}>{i + 1}</span>
        <div style={{ flex: 1, minWidth: 0 }}><Person name={n.name} empId={n.empId} size={32} sub={nurseSub(n)} />
          {n.fromOtherDept && !disabled && <div style={{ marginTop: 4, display: 'flex', gap: 6, alignItems: 'center', fontSize: 11.5 }}><span className="da-sub">Here as</span>
            <select className="da-sel" style={{ padding: '3px 6px', fontSize: 11.5 }} value={n.assignment || 'Deployed'} onChange={(e) => onChange(picked.map((x, j) => (j === i ? Object.assign({}, x, { assignment: e.target.value }) : x)))}>
              {((meta && meta.assignments) || ['Deployed', 'Relief / cover', 'Overtime', 'Float pool', 'Other']).map((a) => <option key={a} value={a}>{a}</option>)}</select></div>}</div>
        {!disabled && <button className="da-btn sm" aria-label={'Remove ' + n.name} onClick={() => remove(i)}>Remove</button>}
      </div>));
    if (disabled) return <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{chips.length ? chips : <span>—</span>}</div>;
    return <div ref={ref} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {chips}
      {manual ? <div className="da-card da-pad" style={{ padding: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 6 }}>
            <input className="da-in" autoFocus placeholder="Nurse's full name" value={manual.name} onChange={(e) => setManual(Object.assign({}, manual, { name: e.target.value }))} />
            <input className="da-in" placeholder="Employee ID" value={manual.empId} onChange={(e) => setManual(Object.assign({}, manual, { empId: e.target.value }))} />
            <button className="da-btn sm pri" disabled={!manual.name.trim()} onClick={() => { add({ staffId: null, empId: manual.empId.trim(), name: manual.name.trim(), designation: '', department: '', linked: false }); setManual(null); }}>Add</button>
          </div>
          <div className="da-sub" style={{ marginTop: 4 }}>Not linked to the staff register — the audit will not show on a staff profile for this nurse. <a href="#" onClick={(e) => { e.preventDefault(); setManual(null); }}>Cancel</a></div>
        </div>
        : !full && <input className={'da-in' + (bad ? ' bad' : '')} style={{ width: '100%' }} placeholder={!list ? 'Loading the staff list…' : picked.length ? 'Add another nurse — name or employee ID…' : 'Search the nurse by name or employee ID…'} value={q} onFocus={() => setOpen(true)}
            onChange={(e) => { setQ(e.target.value); setOpen(true); setHi(0); }} onKeyDown={key} />}
      <div className="da-sub">
        {meta && meta.allStaff && <label style={{ cursor: 'pointer', marginRight: 10 }}><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} style={{ verticalAlign: -2 }} /> Whole register</label>}
        {!full && !manual && <a href="#" style={{ marginRight: 10 }} onClick={(e) => { e.preventDefault(); setManual({ name: '', empId: '' }); setOpen(false); }}>Not in the register?</a>}
        <span>{picked.length > 1 ? picked.length + ' nurses share this record’s checklist and score; the audit shows on each one’s record.' : 'One patient record, one checklist — add every nurse who documented in it (e.g. day + night), up to ' + DA.MAX_NURSES + '.'}</span>
      </div>
      {open && pos && !full && !manual && ReactDOM.createPortal(
        <div className="da-dd" style={{ left: pos.left, width: pos.width, top: pos.top == null ? 'auto' : pos.top, bottom: pos.bottom == null ? 'auto' : pos.bottom, maxHeight: pos.maxH }}>
          {!list && <div className="it">Loading…</div>}
          {list && !choices.length && <div className="it off">{needle.length >= 2 ? 'No staff member matches “' + q + '” in any department. Use “Not in the register?”.' : 'No nurse matches “' + q + '” in this department — type 2 or more letters or digits to search every department.'}</div>}
          {choices.map((p, i) => { const off = self(p) || isPicked(p); const other = isOther(p);
            return <React.Fragment key={p.id}>
              {other && i === hits.length && <div className="it off" style={{ background: '#fff8e9', color: '#8a5a00', fontWeight: 700, fontSize: 11, letterSpacing: .4, textTransform: 'uppercase', cursor: 'default', opacity: 1 }}>Other departments — deployed / relief / float</div>}
              <div className={'it' + (i === hi ? ' hi' : '') + (off ? ' off' : '')} onMouseEnter={() => setHi(i)} onMouseDown={(e) => { e.preventDefault(); pick(p); }} title={self(p) ? 'The auditor cannot be audited on the same record' : isPicked(p) ? 'Already added' : other ? 'Belongs to ' + (p.current_department || 'another department') : ''}>
                <Person name={p.name + (self(p) ? ' (auditor)' : isPicked(p) ? ' ✓ added' : '')} empId={p.emp_id} size={26}
                  sub={<>{[p.emp_id && 'ID ' + p.emp_id, p.designation, p.current_department].filter(Boolean).join(' · ')}{other && <span className="da-chip" style={{ background: '#fff1d6', color: '#8a5a00', marginLeft: 5 }}>⇄ Other dept</span>}</>} />
              </div>
            </React.Fragment>; })}
        </div>, document.body)}
    </div>;
  }
  /* A person with a small photo — the staff register's picture when there is one (window.MK.Av reads
     window.__STAFF_PHOTOS__ by employee ID / name), coloured initials otherwise. */
  function Person({ name, empId, sub, size }) {
    const sz = size || 26;
    const av = window.MK && window.MK.Av ? <window.MK.Av name={name || '?'} empId={empId || null} size={sz} style={{ fontSize: Math.round(sz / 2.6) }} />
      : <span style={{ display: 'inline-grid', placeItems: 'center', width: sz, height: sz, borderRadius: '50%', background: '#e6eefb', color: '#1f4f8a', fontSize: Math.round(sz / 2.6), fontWeight: 800 }}>{String(name || '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}</span>;
    return <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
      <span style={{ flex: 'none' }}>{av}</span>
      <div style={{ minWidth: 0 }}><div style={{ fontWeight: 600, fontSize: 12.8, lineHeight: 1.25 }}>{name || '—'}</div>{sub && <div className="da-sub" style={{ lineHeight: 1.3 }}>{sub}</div>}</div>
    </div>;
  }
  // Every nurse of an audit, one under the other, each with a photo.
  const NurseList = ({ x, size }) => { const ns = DA.nursesOf(x);
    return <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 200 }}>{ns.length ? ns.map((n) => <Person key={DA.nurseKey(n)} name={n.name} empId={n.empId} size={size} sub={nurseSub(n)} />) : <span className="da-muted">—</span>}</div>; };
  // "Rina Akter +2" for tables; the full list on hover.
  const nursesShort = (x) => { const ns = DA.nursesOf(x); return ns.length ? ns[0].name + (ns.length > 1 ? ' +' + (ns.length - 1) : '') : '—'; };

  /* The auditor — an administrator may name who audited (e.g. entering a paper audit done by a ward
     auditor): search the WHOLE staff register by name or employee ID and pick the person (their
     name and staff record are taken), or type a name. Everyone else is the auditor themself. */
  function AuditorField({ value, staffId, onChange }) {
    const [list, setList] = useState(null);
    const [open, setOpen] = useState(false);
    const [hi, setHi] = useState(0);
    const [pos, setPos] = useState(null);
    const ref = useRef(null);
    useEffect(() => {
      let live = true;
      api('/api/doc-audit/staff?all=1').then((j) => { if (live) setList(j.staff); }).catch(() => { if (live) setList([]); });
      return () => { live = false; };
    }, []);
    const place = () => { const r = ref.current && ref.current.getBoundingClientRect(); if (!r) return; const below = window.innerHeight - r.bottom; const up = below < 240 && r.top > below; setPos({ left: r.left, width: Math.max(r.width, 300), top: up ? null : r.bottom + 4, bottom: up ? window.innerHeight - r.top + 4 : null, maxH: Math.min(320, (up ? r.top : below) - 12) }); };
    useEffect(() => {
      if (!open) return;
      place();
      const f = () => place();
      window.addEventListener('scroll', f, true); window.addEventListener('resize', f);
      const out = (e) => { if (ref.current && !ref.current.contains(e.target) && !(e.target.closest && e.target.closest('.da-dd'))) setOpen(false); };
      document.addEventListener('mousedown', out);
      return () => { window.removeEventListener('scroll', f, true); window.removeEventListener('resize', f); document.removeEventListener('mousedown', out); };
    }, [open]);
    const needle = String(value || '').trim().toLowerCase();
    const picked = staffId != null && staffId !== '' && (list || []).find((p) => String(p.id) === String(staffId));
    const hits = (list || []).filter((p) => !needle || (picked && String(p.id) === String(staffId)) || String(p.name || '').toLowerCase().indexOf(needle) >= 0 || String(p.emp_id || '').toLowerCase().indexOf(needle) >= 0).slice(0, 60);
    const pick = (p) => { onChange(p.name, String(p.id)); setOpen(false); };
    const key = (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHi((h) => Math.min(h + 1, hits.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
      else if (e.key === 'Enter' && open && hits[hi]) { e.preventDefault(); pick(hits[hi]); }
      else if (e.key === 'Escape') setOpen(false);
    };
    return <div ref={ref}>
      <input className="da-in" style={{ width: '100%' }} value={value || ''} placeholder={list ? 'Search staff by name or employee ID…' : 'Loading the staff list…'}
        onFocus={() => setOpen(true)} onKeyDown={key} onChange={(e) => { onChange(e.target.value, null); setOpen(true); setHi(0); }} />
      <div className="da-sub" style={{ marginTop: 3 }}>{picked ? [picked.emp_id && 'ID ' + picked.emp_id, picked.designation, picked.current_department].filter(Boolean).join(' · ') : 'Administrator: pick who audited, or type a name.'}</div>
      {open && pos && ReactDOM.createPortal(
        <div className="da-dd" style={{ left: pos.left, width: pos.width, top: pos.top == null ? 'auto' : pos.top, bottom: pos.bottom == null ? 'auto' : pos.bottom, maxHeight: pos.maxH }}>
          {!list && <div className="it">Loading…</div>}
          {list && !hits.length && <div className="it off">No staff member matches “{value}”. The name you typed will be used.</div>}
          {hits.map((p, i) => (
            <div key={p.id} className={'it' + (i === hi ? ' hi' : '')} onMouseEnter={() => setHi(i)} onMouseDown={(e) => { e.preventDefault(); pick(p); }}>
              <b>{p.name}</b><small>{[p.emp_id && 'ID ' + p.emp_id, p.designation, p.current_department].filter(Boolean).join(' · ')}</small>
            </div>))}
        </div>, document.body)}
    </div>;
  }

  /* Print the OFFLINE paper version of the tool chosen above (Appendix A, empty boxes, the department
     filled in) — for a ward auditing on paper. Follows the department / tool; N copies in one go. */
  function BlankFormButtons({ tool, dept }) {
    const [copies, setCopies] = useState(1);
    const [busy, setBusy] = useState(false);
    const log = { kind: 'blank', dept: dept ? dept.id : undefined, copies };
    const doc = () => blankDoc(tool, dept ? dept.name : '', copies);
    return <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }} title={'Blank ' + (tool.short || tool.name) + ' form for auditing on paper'}>
      <span className="da-sub">Offline form</span>
      <input type="number" min="1" max="30" className="da-in" style={{ width: 58, padding: '4px 6px' }} value={copies} aria-label="Copies" onChange={(e) => setCopies(Math.max(1, Math.min(30, +e.target.value || 1)))} />
      <span className="da-sub">cop{copies > 1 ? 'ies' : 'y'}</span>
      <button className="da-btn sm" disabled={busy} onClick={() => openPrint(log, doc(), false)}>Print blank form</button>
      <button className="da-btn sm" disabled={busy} onClick={() => { setBusy(true); pdfFrom(log, doc(), false).catch((e) => toast(e.message, 'error')).finally(() => setBusy(false)); }}>PDF</button>
    </div>;
  }

  /* The Aldrete post-anaesthesia recovery score: five signs 0–2, the total live; ≥ 9 meets the
     discharge criteria. Recorded with the audit (criterion 18 checks it is documented), not scored. */
  function AldreteField({ value, onChange, readOnly }) {
    const v = value && typeof value === 'object' ? value : {};
    const c = DA.cleanAldrete(v);
    const verdict = c && c.complete ? (c.total >= DA.ALDRETE_DISCHARGE ? { t: 'meets discharge criteria', bg: '#e7f6ed', fg: '#14713f' } : { t: 'below discharge criteria (≥ 9)', bg: '#fde4e8', fg: '#a3172f' }) : null;
    if (readOnly) return <div style={{ fontSize: 13, paddingTop: 6 }}>{c ? <><b>{DA.aldreteText(v)}</b>{verdict && <span className="da-chip" style={{ marginLeft: 6, background: verdict.bg, color: verdict.fg }}>{verdict.t}</span>}</> : '—'}</div>;
    const setSign = (k, n) => { const next = Object.assign({}, v); if (next[k] === n) delete next[k]; else next[k] = n; onChange(DA.cleanAldrete(next)); };
    return <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      {DA.ALDRETE.map((x) => <div key={x.k} style={{ minWidth: 150, flex: '1 1 150px' }}>
        <div className="da-sub" style={{ fontWeight: 700, marginBottom: 3 }}>{x.label}</div>
        <div className="da-yn" style={{ display: 'flex' }}>{[2, 1, 0].map((n) => <button key={n} type="button" title={x.opts[n]} className={(v[x.k] === n ? 'on ' : '') + (n === 2 ? 'Y' : n === 1 ? 'NA' : 'N')} style={{ flex: 1, minWidth: 0 }} onClick={() => setSign(x.k, n)}>{n}</button>)}</div>
        <div className="da-sub" style={{ marginTop: 2, minHeight: 14 }}>{v[x.k] != null ? x.opts[v[x.k]] : ''}</div>
      </div>)}
      <div style={{ minWidth: 120, alignSelf: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: verdict ? verdict.fg : 'var(--ink)' }}>{c ? c.total : '—'}<span className="da-sub" style={{ fontSize: 12 }}>/10</span></div>
        {verdict ? <span className="da-chip" style={{ background: verdict.bg, color: verdict.fg }}>{verdict.t}</span> : <span className="da-sub">{c ? 'score every sign' : 'optional'}</span>}
      </div>
    </div>;
  }

  /* ========================================================= result panel === */
  function ResultPanel({ res, criteria, problems }) {
    const total = DA.activeCriteria(criteria).length;
    const answered = total - res.blank;
    const byId = {}; criteria.forEach((c) => { byId[c.id] = c; });
    const col = res.pct == null ? 'var(--muted)' : res.criticalFails.length ? '#a3172f' : gradeColor(res.grade);
    return <div className="da-card da-res">
      <div className="da-sub" style={{ fontWeight: 700, letterSpacing: .4, textTransform: 'uppercase' }}>Audit result</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginTop: 6 }}>
        <div className="big" style={{ color: col }}>{res.pct == null ? '—' : res.pct + '%'}</div>
        {res.result && <span className={'da-chip ' + (res.result === 'PASS' ? 'pass' : 'fail')} style={{ fontSize: 13, padding: '4px 12px', marginBottom: 3 }}>{res.result}</span>}
      </div>
      <div className="grade" style={{ color: col }}>{res.gradeLabel || 'Answer the criteria'}{res.criticalFails.length ? ' · critical failure' : ''}</div>
      <div className="da-prog"><i style={{ width: (total ? (answered / total) * 100 : 0) + '%' }} /></div>
      <div className="da-sub" style={{ marginTop: 4 }}>{answered} of {total} criteria answered</div>
      <div className="da-kv">
        <span>Total 'Yes' (A)</span><b>{res.yes}</b>
        <span>Total 'No' (B)</span><b>{res.no}</b>
        <span>Total 'N/A'</span><b>{res.na}</b>
        <span>Applicable (A + B)</span><b>{res.applicable}</b>
        <span>Score = A ÷ (A + B) × 100</span><b>{pctTxt(res.pct)}</b>
      </div>
      {res.criticalFails.length > 0 && <div className="da-banner red" style={{ marginTop: 10, padding: '8px 10px' }}><div><b>Critical criteria marked 'No':</b> {res.criticalFails.map((id) => '#' + (byId[id] ? byId[id].no : id)).join(', ')}. Any critical failure = FAIL, whatever the score. Escalate to the Nurse In-charge today.</div></div>}
      {res.action && <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.45 }}><b>Required action:</b> {res.action}</div>}
      {problems && problems.length > 0 && <div style={{ marginTop: 10, fontSize: 11.8, color: '#8a5a00' }}><b>Before you complete:</b><ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>{problems.slice(0, 5).map((p, i) => <li key={i}>{p.message}</li>)}{problems.length > 5 && <li>…and {problems.length - 5} more</li>}</ul></div>}
    </div>;
  }

  /* ============================================================ audit form === */
  function AuditForm({ meta, auditId, initialDept, setRoute }) {
    const [loaded, setLoaded] = useState(!auditId ? { audit: null, tool: null } : null);
    const [err, setErr] = useState('');
    const [editing, setEditing] = useState(!auditId);
    const [busy, setBusy] = useState(false);
    const [showErr, setShowErr] = useState(false);
    const depts = meta.departments;
    const [form, setForm] = useState(null);
    const [toolId, setToolId] = useState(null);

    // load an existing audit
    useEffect(() => {
      if (!auditId) return;
      let live = true;
      api('/api/doc-audit/audits/' + encodeURIComponent(auditId)).then((j) => { if (!live) return; setLoaded(j); setForm(fromAudit(j.audit)); setToolId(j.audit.toolId); setEditing(j.audit.status === 'draft' && mayWrite(j.audit, j)); })
        .catch((e) => setErr(e.message));
      return () => { live = false; };
    }, [auditId]);
    // a new audit: the department remembered in this browser, its tool
    useEffect(() => {
      if (auditId) return;
      const d = depts.find((x) => x.id === initialDept) || depts.find((x) => x.id === lsGet('da_dept')) || depts[0];
      if (!d) return;
      setForm(blankForm(d.id));
      setToolId(d.cfg.toolId);
    }, [auditId]);

    function blankForm(deptId) { return { deptId, area: '', date: meta.today, shift: '', uhid: '', bed: '', extra: {}, nurses: [], answers: {}, evidence: {}, remarks: '', auditorName: meta.name, auditorStaffId: meta.staffId }; }
    function fromAudit(a) { return { deptId: a.deptId, area: a.area || '', date: a.date, shift: a.shift || '', uhid: a.uhid || '', bed: a.bed || '', extra: a.extra || {}, nurses: DA.nursesOf(a), answers: a.answers || {}, evidence: a.evidence || {}, remarks: a.remarks || '', auditorName: (a.auditor && a.auditor.name) || '', auditorStaffId: (a.auditor && a.auditor.staffId) || null }; }
    const audit = loaded && loaded.audit;
    const tool = audit ? (loaded.tool || toolOf(meta, audit.toolId)) : toolOf(meta, toolId);
    const criteria = useMemo(() => (audit ? audit.criteria : tool ? DA.freezeCriteria(tool) : []), [audit, tool]);
    const res = useMemo(() => DA.score(form ? form.answers : {}, criteria), [form, criteria]);
    const problems = useMemo(() => (form ? DA.validate(form, criteria, { today: meta.today, tool, auditorStaffId: meta.staffId, evidenceRequired: meta.config.evidenceRequired }) : []), [form, criteria, tool]);
    const guide = useMemo(() => DA.guideFor(tool, form && form.area), [tool, form && form.area]);
    // A tool with one procedure area (e.g. the Cath Lab): a new audit starts with it chosen. Runs when
    // the tool changes, so clearing the area by hand afterwards is respected.
    useEffect(() => {
      if (auditId || !form || form.area) return;
      const as = (tool && tool.header && tool.header.areas) || [];
      if (as.length === 1) setForm((f) => (f && !f.area ? Object.assign({}, f, { area: as[0] }) : f));
    }, [toolId, !!form]);
    const bad = (field, cid) => showErr && problems.some((p) => p.field === field && (cid == null || p.criterion === cid));

    function mayWrite(a, r) {
      const rr = r || meta;
      if (!a) return meta.canAdd;
      const own = a.auditor && a.auditor.username === meta.user;
      if (a.status === 'signed') return false;
      if (a.status === 'draft') return rr.canAdd || rr.canEdit;
      if (a.status === 'completed') return rr.canEdit || (own && rr.canAdd);
      return rr.canEdit;
    }
    if (err) return <div className="da-banner red">{err}</div>;
    if (!form || (auditId && !loaded)) return <div className="da-card da-empty">Loading the audit…</div>;
    if (!auditId && !depts.length) return <NoDepts meta={meta} setRoute={setRoute} />;
    if (!tool) return <div className="da-banner">No audit tool is set for this department. {meta.isAdmin ? 'Choose one in Nursing Documentation KPI Audit → Settings.' : 'Ask the administrator.'}</div>;

    const set = (k, v) => setForm((f) => Object.assign({}, f, { [k]: v }));
    const setAns = (cid, v) => setForm((f) => { const answers = Object.assign({}, f.answers); if (answers[cid] === v) delete answers[cid]; else answers[cid] = v; return Object.assign({}, f, { answers }); });
    const setEv = (cid, v) => setForm((f) => Object.assign({}, f, { evidence: Object.assign({}, f.evidence, { [cid]: v }) }));
    const changeDept = (id) => { const d = depts.find((x) => x.id === id); lsSet('da_dept', id); setForm((f) => Object.assign({}, f, { deptId: id, nurses: [] })); if (d && !audit) setToolId(d.cfg.toolId); };
    const sections = (tool.sections || []).map((s) => ({ s, items: criteria.filter((c) => c.sectionId === s.id) })).filter((x) => x.items.length);
    const orphan = criteria.filter((c) => !(tool.sections || []).some((s) => s.id === c.sectionId));
    if (orphan.length) sections.push({ s: { id: '_', title: 'Other criteria', jci: '' }, items: orphan });
    const applyNa = () => setForm((f) => { const answers = Object.assign({}, f.answers); guide.na.forEach((id) => { if (!answers[id]) answers[id] = 'NA'; }); return Object.assign({}, f, { answers }); });
    const sectionYes = (items) => setForm((f) => { const answers = Object.assign({}, f.answers); items.forEach((c) => { if (!answers[c.id]) answers[c.id] = 'Y'; }); return Object.assign({}, f, { answers }); });
    const readOnly = !editing;

    async function save(complete) {
      if (complete && problems.length) { setShowErr(true); toast(problems[0].message, 'error'); const p = problems[0]; const el = p.criterion ? document.getElementById('da-c-' + p.criterion) : null; if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
      if (complete && res.criticalFails.length) {
        const ok = await confirmBox({ title: 'Complete with a critical failure?', message: 'This record FAILS: critical criteria ' + res.criticalFails.map((id) => '#' + (criteria.find((c) => c.id === id) || {}).no).join(', ') + ' are marked No. Policy 9: correct the record today where possible, escalate to the Nurse In-charge, and file an incident report if there was harm or a near miss.', confirmLabel: 'Complete audit' });
        if (!ok) return;
      }
      setBusy(true);
      try {
        const payload = Object.assign({}, form, { complete: !!complete });
        let j;
        if (audit) j = await post('/api/doc-audit/audits/' + encodeURIComponent(audit.id), Object.assign(payload, { baseUpdatedAt: audit.updatedAt }), 'PUT');
        else j = await post('/api/doc-audit/audits', Object.assign(payload, { toolId: tool.id }));
        toast(complete || (audit && audit.status !== 'draft') ? 'Audit saved — ' + (j.audit.result.pct == null ? '' : j.audit.result.pct + '% ') + j.audit.result.result : 'Draft saved.', 'success');
        refreshBadge();
        setLoaded({ audit: j.audit, tool: loaded && loaded.tool ? loaded.tool : tool });
        setForm(fromAudit(j.audit));
        setShowErr(false);
        if (j.audit.status !== 'draft') setEditing(false);
        if (!audit) setRoute({ view: 'docAuditNew', audit: j.audit.id });
      } catch (e) {
        if (e.body && e.body.problems) setShowErr(true);
        toast(e.message, 'error');
      } finally { setBusy(false); }
    }
    async function act(path, body, okMsg) {
      setBusy(true);
      try { const j = await post('/api/doc-audit/audits/' + encodeURIComponent(audit.id) + path, body); setLoaded({ audit: j.audit, tool }); setForm(fromAudit(j.audit)); toast(okMsg, 'success'); refreshBadge(); }
      catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
    }
    async function ack() {
      const pending = DA.pendingAcks(audit);
      const r = await askAck(pending);
      if (!r) return;
      act('/ack', { keys: r.keys, note: r.note }, r.keys.length === pending.length ? 'Acknowledgement recorded.' : r.keys.length + ' acknowledgement(s) recorded — ' + (pending.length - r.keys.length) + ' still waiting.');
    }
    async function sign() { const note = await askText({ title: 'Publish this audit?', message: 'Publishing releases the result to the nurse' + (DA.nursesOf(audit).length > 1 ? 's' : '') + ' (My Profile) and locks the audit; only an administrator can reopen it.' + (DA.pendingAcks(audit).length ? ' Acknowledgement is optional — the nurse can still acknowledge after publishing.' : ''), confirmLabel: 'Publish', placeholder: 'Comment (optional)' }); if (note == null) return; act('/sign', { note }, 'Published.'); }
    async function reopen() { const reason = await askText({ title: 'Reopen this audit?', message: 'It is taken back from the nurse; the publication is kept in the history. Say why it is reopened.', confirmLabel: 'Reopen', min: 5 }); if (!reason) return; act('/reopen', { reason }, 'Reopened.'); }
    async function remove() {
      const reason = await askText({ title: 'Remove this audit?', message: 'It leaves the register and the KPIs. Nothing is deleted: it stays in the history.', confirmLabel: 'Remove', danger: true, placeholder: 'Reason (optional)' });
      if (reason == null) return;
      try { await api('/api/doc-audit/audits/' + encodeURIComponent(audit.id), { method: 'DELETE', body: JSON.stringify({ reason }) }); toast('Audit removed.', 'success'); refreshBadge(); setRoute({ view: 'docAuditRegister' }); } catch (e) { toast(e.message, 'error'); }
    }
    const header = (
      <div className="da-card">
        <div className="da-h"><h3>{tool.name}</h3><span className="da-sub">{[tool.code, tool.version && 'v' + tool.version, audit && audit.toolRevision > 1 ? 'tool revision ' + audit.toolRevision : ''].filter(Boolean).join(' · ')}</span><span className="grow" />
          {audit && <StatusChip s={audit.status} />}</div>
        <div className="da-pad da-fields">
          <div className="da-f"><label>Department</label>
            {readOnly || audit ? <div style={{ fontSize: 13, fontWeight: 600, paddingTop: 6 }}>{audit ? audit.deptName : (depts.find((d) => d.id === form.deptId) || {}).name}</div>
              : <select className="da-sel" value={form.deptId} onChange={(e) => changeDept(e.target.value)}>{depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>}</div>
          {!audit && meta.tools.length > 1 && (meta.isAdmin || meta.allStaff) && <div className="da-f"><label>Audit tool</label>
            <select className="da-sel" value={toolId || ''} onChange={(e) => { setToolId(e.target.value); setForm((f) => Object.assign({}, f, { answers: {}, evidence: {}, area: '', extra: {} })); }}>{meta.tools.map((t) => <option key={t.id} value={t.id}>{t.short || t.name}</option>)}</select></div>}
          <div className="da-f"><label>{(tool.header && tool.header.areaLabel) || 'Area'}</label>
            {readOnly ? <div style={{ fontSize: 13, paddingTop: 6 }}>{form.area || '—'}</div>
              : (tool.header && tool.header.areas && tool.header.areas.length
                ? <select className="da-sel" value={form.area} onChange={(e) => set('area', e.target.value)}><option value="">—</option>{tool.header.areas.map((x) => <option key={x}>{x}</option>)}</select>
                : <input className="da-in" value={form.area} onChange={(e) => set('area', e.target.value)} />)}</div>
          <div className="da-f"><label>Audit date</label>{readOnly ? <div style={{ fontSize: 13, paddingTop: 6 }}>{DA.fmtDate(form.date)}</div> : <input type="date" className={'da-in' + (bad('date') ? ' bad' : '')} max={meta.today} value={form.date} onChange={(e) => set('date', e.target.value)} />}</div>
          <div className="da-f"><label>Shift</label>{readOnly ? <div style={{ fontSize: 13, paddingTop: 6 }}>{form.shift || '—'}</div>
            : <div className="seg">{DA.SHIFTS.map((s) => <button key={s} className={form.shift === s ? 'on' : ''} onClick={() => set('shift', form.shift === s ? '' : s)}>{s}</button>)}</div>}</div>
          <div className="da-f"><label>Patient UHID / MRN</label>{readOnly ? <div style={{ fontSize: 13, paddingTop: 6 }}>{form.uhid || '—'}</div> : <input className={'da-in' + (bad('uhid') ? ' bad' : '')} value={form.uhid} onChange={(e) => set('uhid', e.target.value)} />}</div>
          <div className="da-f"><label>{(tool.header && tool.header.bedLabel) || 'Ward / bed no.'}</label>{readOnly ? <div style={{ fontSize: 13, paddingTop: 6 }}>{form.bed || '—'}</div> : <input className="da-in" value={form.bed} onChange={(e) => set('bed', e.target.value)} />}</div>
          {((tool.header && tool.header.extra) || []).map((f) => f.type === 'aldrete'
            ? <div className="da-f" key={f.id} style={{ gridColumn: '1 / -1' }}><label>{f.label}</label>
                <AldreteField value={form.extra[f.id]} readOnly={readOnly} onChange={(v) => set('extra', Object.assign({}, form.extra, { [f.id]: v }))} /></div>
            : <div className="da-f" key={f.id}><label>{f.label}</label>
            {readOnly ? <div style={{ fontSize: 13, paddingTop: 6 }}>{form.extra[f.id] || '—'}</div>
              : f.type === 'select' ? <select className="da-sel" value={form.extra[f.id] || ''} onChange={(e) => set('extra', Object.assign({}, form.extra, { [f.id]: e.target.value }))}>{(f.options || ['']).map((o) => <option key={o} value={o}>{o || '—'}</option>)}</select>
                : <input className="da-in" value={form.extra[f.id] || ''} onChange={(e) => set('extra', Object.assign({}, form.extra, { [f.id]: e.target.value }))} />}</div>)}
          <div className="da-f" style={{ gridColumn: '1 / -1' }}><label>Nurse(s) audited (auditees)</label>
            <NursePicker meta={meta} deptId={form.deptId} value={form.nurses} onChange={(l) => set('nurses', l)} bad={bad('nurse')} disabled={readOnly} excludeId={meta.isAdmin ? form.auditorStaffId : null} />
            {bad('nurse') && <div className="da-sub" style={{ color: 'var(--rose)' }}>{(problems.find((p) => p.field === 'nurse') || {}).message}</div>}</div>
          <div className="da-f"><label>Auditor</label>
            {meta.isAdmin && !readOnly
              ? <AuditorField value={form.auditorName} staffId={form.auditorStaffId} onChange={(name, id) => setForm((f) => Object.assign({}, f, { auditorName: name, auditorStaffId: id }))} />
              : <div style={{ fontSize: 13, paddingTop: 6 }}>{audit ? audit.auditor.name : meta.name}</div>}</div>
        </div>
      </div>);
    const guideBox = (guide.notes.length || guide.na.length || guide.never.length) && !readOnly ? (
      <div className="da-banner blue"><div style={{ flex: 1 }}>
        <b>How to apply the checklist in {form.area}:</b> {guide.notes.join(' ')}
        {guide.never.length > 0 && <div style={{ marginTop: 4 }}>Never N/A here: {guide.never.map((id) => '#' + ((criteria.find((c) => c.id === id) || {}).no || id)).join(', ')}.</div>}
        {guide.na.length > 0 && <div style={{ marginTop: 6 }}><button className="da-btn sm" onClick={applyNa}>Mark {guide.na.map((id) => '#' + ((criteria.find((c) => c.id === id) || {}).no || id)).join(', ')} as N/A</button> <span className="da-sub">(only the unanswered ones)</span></div>}
      </div></div>) : null;
    const checklist = (
      <div className="da-card" style={{ overflow: 'hidden' }}>
        <div className="da-h"><h3>Checklist</h3><span className="da-sub">One answer per criterion. Evidence for a 'No' is {meta.config.evidenceRequired ? 'required' : 'optional'} (what is missing, where, date/time). N/A is not scored; unreviewed items stay blank.</span></div>
        {sections.map(({ s, items }) => (
          <React.Fragment key={s.id}>
            <div className="da-sec"><b>Section {s.id !== '_' ? s.id + ': ' : ''}{s.title}</b>{s.jci && <span className="jcis">JCI: {s.jci}</span>}<span style={{ flex: 1 }} />
              {!readOnly && items.some((c) => !form.answers[c.id]) && <button className="da-btn sm" title="Unanswered criteria of this section become Yes" onClick={() => sectionYes(items)}>✓ Rest of section Yes</button>}</div>
            {items.map((c) => {
              const v = form.answers[c.id];
              const never = guide.never.indexOf(c.id) >= 0;
              const cls = 'da-row' + (v === 'N' ? (c.critical ? ' crit-no' : ' no') : '') + (showErr && (bad('answers', c.id) || bad('evidence', c.id)) ? ' miss' : '');
              return (
                <div className={cls} key={c.id} id={'da-c-' + c.id}>
                  <div className="num">{c.no}</div>
                  <div><div className="txt">{c.text}</div>
                    <div className="meta">{(c.jci || []).map((j) => <span key={j} className="da-chip jci">{j}</span>)}{c.critical && <span className="da-chip crit">Critical</span>}{never && <span className="da-chip jci">never N/A here</span>}</div></div>
                  <div className="da-yn" role="radiogroup" aria-label={'Criterion ' + c.no}>
                    {[['Y', 'Yes'], ['N', 'No'], ['NA', 'N/A']].map(([k, l]) => <button key={k} role="radio" aria-checked={v === k} className={(v === k ? 'on ' : '') + k} disabled={readOnly || (k === 'NA' && never)} onClick={() => setAns(c.id, k)}>{l}</button>)}
                  </div>
                  {(v === 'N' || (form.evidence[c.id] && v)) && <div className="da-ev">
                    {readOnly ? <div style={{ fontSize: 12.3, color: v === 'N' ? '#8f1d33' : 'var(--ink-2)' }}><b>Evidence:</b> {form.evidence[c.id] || '—'}</div>
                      : <textarea className={'da-ta' + (bad('evidence', c.id) ? ' bad' : '')} rows={2} placeholder={v === 'N' ? "Evidence for 'No' — what is missing, where, date / time (" + (meta.config.evidenceRequired ? 'required' : 'optional') + ")" : 'Remark'} value={form.evidence[c.id] || ''} onChange={(e) => setEv(c.id, e.target.value)} />}
                  </div>}
                </div>);
            })}
          </React.Fragment>))}
        <div className="da-pad"><div className="da-f"><label>Remarks / feedback given</label>
          {readOnly ? <div style={{ fontSize: 12.8, whiteSpace: 'pre-wrap' }}>{form.remarks || '—'}</div> : <textarea className="da-ta" rows={3} value={form.remarks} onChange={(e) => set('remarks', e.target.value)} placeholder="Coaching note, good practice seen, what was corrected on the spot…" />}</div></div>
      </div>);

    // the sign-off chain (an existing, completed audit)
    const own = audit && audit.auditor && audit.auditor.username === meta.user;
    const chain = audit && audit.status !== 'draft' ? (
      <div className="da-card da-pad">
        <div className="da-sub" style={{ fontWeight: 700, letterSpacing: .4, textTransform: 'uppercase', marginBottom: 4 }}>Progress</div>
        <div className="da-chain">
          <div className="da-step done"><i /><div><b>Audited</b> by {audit.auditor.name}<small>{when(audit.completedAt || audit.createdAt)}</small></div></div>
          {(() => { const ns = DA.nursesOf(audit), acks = DA.acksOf(audit), pend = DA.pendingAcks(audit);
            return <div className={'da-step ' + (!pend.length ? 'done' : 'now')}><i /><div><b>{ns.length > 1 ? 'Nurses’ acknowledgement (' + (ns.length - pend.length) + ' of ' + ns.length + ')' : 'Nurse’s acknowledgement'}</b>
              {ns.map((n) => { const k = acks[DA.nurseKey(n)];
                return <small key={DA.nurseKey(n)}>{ns.length > 1 ? n.name + ': ' : ''}{k ? (k.method === 'account' ? '✓ own account' : '✓ in person, recorded by ' + (k.byName || k.by)) + ' · ' + when(k.at) + (k.note ? ' · “' + k.note + '”' : '') : 'waiting' + (meta.config.ackRequired && ns.length === 1 ? ' — needed before publishing' : '')}</small>; })}
              {pend.length > 0 && meta.config.ackRequired && <small>Every nurse acknowledges before publishing.</small>}
              {pend.length > 0 && !meta.config.ackRequired && <small>Optional.</small>}
              {pend.length > 0 && audit.status !== 'draft' && meta.canAdd && <div style={{ marginTop: 5 }}><button className="da-btn sm pri" disabled={busy} onClick={ack}>Record acknowledgement</button></div>}</div></div>; })()}
          <div className={'da-step ' + (audit.signoff ? 'done' : (audit.status === 'acknowledged' ? 'now' : ''))}><i /><div><b>Published</b> <span className="da-sub">(released to the nurse)</span>{audit.signoff ? <small>by {audit.signoff.name} · {when(audit.signoff.at)}{audit.signoff.note ? ' · “' + audit.signoff.note + '”' : ''}</small> : <small>{own && !meta.isAdmin ? 'Another person publishes your audit' : 'Not yet — the nurse does not see it'}</small>}
            {!audit.signoff && meta.canEdit && (audit.status === 'acknowledged' || (meta.isAdmin && audit.status === 'completed') || (!meta.config.ackRequired && audit.status === 'completed')) && (!own || meta.isAdmin) && <div style={{ marginTop: 5 }}><button className="da-btn sm ok" disabled={busy} onClick={sign}>Publish</button></div>}</div></div>
        </div>
        {(audit.reopened || []).length > 0 && <div className="da-sub" style={{ marginTop: 6 }}>Reopened {audit.reopened.length}×, last: “{audit.reopened[audit.reopened.length - 1].reason}”</div>}
      </div>) : null;
    const actions = (
      <div className="da-card da-pad" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {editing && <>
          {(!audit || audit.status === 'draft') && <button className="da-btn" disabled={busy} onClick={() => save(false)}>Save draft</button>}
          <button className="da-btn pri" disabled={busy} onClick={() => save(true)} style={{ justifyContent: 'center' }}>{audit && audit.status !== 'draft' ? 'Save correction' : 'Complete audit'}</button>
          {audit && audit.status !== 'draft' && <button className="da-btn" disabled={busy} onClick={() => { setForm(fromAudit(audit)); setEditing(false); setShowErr(false); }}>Cancel</button>}
          {audit && audit.status === 'acknowledged' && <div className="da-sub">Changing the answers clears the nurse’s acknowledgement: the nurse acknowledges the corrected audit again.</div>}
        </>}
        {!editing && audit && mayWrite(audit) && <button className="da-btn" onClick={() => setEditing(true)}>{audit.status === 'draft' ? 'Continue' : 'Correct this audit'}</button>}
        {audit && audit.status !== 'draft' && meta.canPrint && <div style={{ display: 'flex', gap: 6 }}><button className="da-btn" style={{ flex: 1, justifyContent: 'center' }} onClick={() => printAudit(audit, tool)}>Print</button><button className="da-btn" style={{ flex: 1, justifyContent: 'center' }} onClick={() => pdfAudit(audit, tool).catch((e) => toast(e.message, 'error'))}>PDF</button></div>}
        {audit && audit.status === 'signed' && meta.isAdmin && <button className="da-btn" disabled={busy} onClick={reopen}>Reopen (administrator)</button>}
        {audit && audit.status === 'acknowledged' && meta.isAdmin && <button className="da-btn" disabled={busy} onClick={reopen}>Reopen acknowledgement…</button>}
        {audit && meta.canDelete && (audit.status !== 'signed' || meta.isAdmin) && <button className="da-btn danger" disabled={busy} onClick={remove}>Remove</button>}
        {audit && audit.selfCheck === 'unknown' && <div className="da-sub">Your account is not linked to a staff record, so the “own documentation” check could not run.</div>}
      </div>);
    return (
      <div className="da-wrap">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="da-btn sm" onClick={() => setRoute({ view: audit ? 'docAuditRegister' : 'docAuditHome' })}>← {audit ? 'Register' : 'Dashboard'}</button>
          {audit && audit.status !== 'draft' && <span className="da-sub">Audit of {DA.nurseNames(audit) || '—'} · {audit.deptName} · {DA.fmtDate(audit.date)}</span>}
          <span style={{ flex: 1 }} />
          {!audit && meta.canPrint && <BlankFormButtons tool={tool} dept={depts.find((d) => d.id === form.deptId)} />}
          {!audit && tool.sample && <span className="da-sub" title={tool.sample.note}>Sample rule: at least {(depts.find((d) => d.id === form.deptId) || { cfg: {} }).cfg.minRecords || tool.sample.minRecords} records a month · hover for details</span>}
        </div>
        <div className="da-form">
          <div className="da-grid" style={{ gap: 14 }}>{header}{guideBox}{checklist}</div>
          <div className="da-side"><ResultPanel res={res} criteria={criteria} problems={editing ? problems : null} />{chain}{actions}</div>
        </div>
      </div>);
  }

  /* ============================================================== dashboard === */
  function Home({ meta, setRoute }) {
    const [sum, setSum] = useState(null);
    const [pending, setPending] = useState(null);
    const [err, setErr] = useState('');
    useEffect(() => {
      let live = true;
      const ym = meta.month;
      Promise.all([api('/api/doc-audit/summary?from=' + ym + '&to=' + ym), api('/api/doc-audit/audits?from=' + DA.addMonth(ym, -2) + '-01')])
        .then(([s, a]) => { if (!live) return; setSum(s); setPending(a.audits); }).catch((e) => setErr(e.message));
      return () => { live = false; };
    }, []);
    if (!meta.departments.length) return <NoDepts meta={meta} setRoute={setRoute} />;
    if (err) return <div className="da-banner red">{err}</div>;
    if (!sum) return <div className="da-card da-empty">Loading this month’s audits…</div>;
    const ym = meta.month;
    const tot = sum.overall.months[ym];
    const toolName = (id) => (sum.tools.find((t) => t.id === id) || {}).short || id;
    const mineDrafts = pending.filter((x) => x.status === 'draft' && x.auditor.username === meta.user);
    const ackReq = meta.config.ackRequired;
    const waitAck = ackReq ? pending.filter((x) => x.status === 'completed') : [];
    // Ready to publish: completed (and, when acknowledgement is required, acknowledged) — not your own.
    const waitSign = pending.filter((x) => (ackReq ? x.status === 'acknowledged' : x.status === 'completed' || x.status === 'acknowledged') && (meta.isAdmin || x.auditor.username !== meta.user));
    const List = ({ title, rows, hint }) => (
      <div className="da-card"><div className="da-h"><h3>{title}</h3><span className="da-sub">{rows.length}</span><span className="grow" /><span className="da-sub">{hint}</span></div>
        {!rows.length ? <div className="da-empty" style={{ padding: 14 }}>Nothing waiting.</div>
          : <div className="da-scroll"><table className="da-tbl"><tbody>{rows.slice(0, 8).map((x) => (
            <tr key={x.id} className="click" onClick={() => setRoute({ view: 'docAuditNew', audit: x.id })}>
              <td style={{ whiteSpace: 'nowrap' }}>{DA.fmtDate(x.date)}</td><td><NurseList x={x} size={22} /><div className="da-sub" style={{ marginTop: 3 }}>{x.deptName}{x.area ? ' · ' + x.area : ''}</div></td>
              <td className="n">{pctTxt(x.result && x.result.pct)}</td><td><ResultChip r={x.result} /></td></tr>))}</tbody></table></div>}
        {rows.length > 8 && <div className="da-pad" style={{ paddingTop: 8 }}><a href="#" onClick={(e) => { e.preventDefault(); setRoute({ view: 'docAuditRegister' }); }}>All {rows.length} in the register →</a></div>}
      </div>);
    return (
      <div className="da-wrap">
        <div className="da-card da-bar">
          <div><b style={{ fontSize: 15 }}>Nursing Documentation KPI Audit · {DA.fmtMonth(ym)}</b><div className="da-sub">Score = Yes ÷ (Yes + No) × 100 · PASS = ≥ 90% and no critical failure · results go to the Nursing Quality Committee by the 10th</div></div>
          <span style={{ flex: 1 }} />
          {meta.canAdd && <button className="da-btn pri" onClick={() => setRoute({ view: 'docAuditNew' })}>+ New audit</button>}
          <button className="da-btn" onClick={() => setRoute({ view: 'docAuditReports' })}>Reports</button>
        </div>
        {meta.config.kpiLink && <div className="da-banner blue" style={{ padding: '8px 12px' }}><div>Every completed audit feeds <b>Nursing KPI 2C — Documentation Accuracy</b> automatically (Σ Yes ÷ Σ Yes + No, all departments).</div></div>}
        <div className="da-tiles">
          <div className="da-tile"><span>Records audited</span><b>{tot.records}</b><small>{tot.nurses} nurse(s)</small></div>
          <div className="da-tile"><span>Documentation accuracy</span><b style={{ color: tot.accuracy == null ? undefined : tot.accuracy >= 90 ? '#14713f' : '#a3172f' }}>{pctTxt(tot.accuracy)}</b><small>target ≥ 90%</small></div>
          <div className="da-tile"><span>Critical failures</span><b style={{ color: tot.criticalRecords ? '#a3172f' : undefined }}>{tot.criticalRecords}</b><small>{tot.records ? pctTxt(DA.round1(tot.criticalRecords / tot.records * 100)) + ' of records · target ≤ 5%' : 'target ≤ 5%'}</small></div>
          <div className="da-tile"><span>Ready to publish</span><b>{waitSign.length}</b><small>{ackReq ? waitAck.length + ' waiting for acknowledgement' : 'not yet seen by the nurse'}</small></div>
        </div>
        <div className="da-card">
          <div className="da-h"><h3>Departments this month</h3><span className="grow" /><span className="da-sub">Policy 7.1: a minimum sample per unit each month, all shifts; each nurse at least once a quarter.</span></div>
          <div className="da-scroll"><table className="da-tbl">
            <thead><tr><th>Department</th><th>Tool</th><th>Records</th><th className="n">Accuracy</th><th className="n">Critical</th><th>Below target</th><th>Top failing criteria</th>{meta.canAdd && <th />}</tr></thead>
            <tbody>{sum.rows.map((r) => {
              const s = r.months[ym];
              const min = r.minRecords || 0;
              const k1 = s.kpis.find((k) => k.formula === 'accuracy');
              return <tr key={r.deptId + r.toolId}>
                <td><b>{r.name}</b></td><td className="da-sub">{toolName(r.toolId)}</td>
                <td style={{ minWidth: 120 }}><b>{s.records}</b>{min ? <span className="da-sub"> / {min}</span> : null}{min > 0 && <div className="da-prog" style={{ marginTop: 4 }}><i style={{ width: Math.min(100, (s.records / min) * 100) + '%', background: s.records >= min ? '#1f9d57' : undefined }} /></div>}</td>
                <td className="n" style={{ color: k1 && k1.met === false ? '#a3172f' : undefined, fontWeight: 700 }}>{pctTxt(k1 && k1.value)}</td>
                <td className="n" style={{ color: s.criticalRecords ? '#a3172f' : undefined }}>{s.criticalRecords || ''}</td>
                <td>{s.records ? (s.belowTarget.length ? s.kpis.filter((k) => k.met === false).map((k) => <span key={k.id} className="da-chip off" style={{ marginRight: 3 }}>{k.name}</span>) : <span className="da-chip met">On target</span>) : <span className="da-muted">—</span>}</td>
                <td style={{ fontSize: 11.8 }}>{s.topFailing.map((g) => '#' + g.no + ' ×' + g.count).join(', ') || <span className="da-muted">—</span>}</td>
                {meta.canAdd && <td><button className="da-btn sm" onClick={() => { lsSet('da_dept', r.deptId); setRoute({ view: 'docAuditNew', dept: r.deptId }); }}>+ Audit</button></td>}
              </tr>;
            })}</tbody></table></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 14 }}>
          {meta.canAdd && mineDrafts.length > 0 && <List title="Your drafts" rows={mineDrafts} hint="not results yet" />}
          {ackReq && <List title="Waiting for the nurse’s acknowledgement" rows={waitAck} hint="same-day feedback" />}
          {meta.canEdit && <List title="Ready to publish" rows={waitSign} hint="released to the nurse, then locked — or tick many in the Register" />}
        </div>
      </div>);
  }

  /* =============================================================== register === */
  function Register({ meta, setRoute, nurse }) {
    const firstOf = (ym) => ym + '-01';
    const [f, setF] = useState(() => ({ dept: '', from: firstOf(DA.addMonth(meta.month, -2)), to: meta.today, status: '', result: '', tool: '', q: '', nurse: nurse || '' }));
    const [data, setData] = useState(null);
    const [err, setErr] = useState('');
    useEffect(() => {
      let live = true; setData(null);
      const qs = ['from=' + f.from, 'to=' + f.to, f.dept && 'dept=' + encodeURIComponent(f.dept), f.status && 'status=' + f.status, f.result && 'result=' + f.result, f.tool && 'tool=' + f.tool, f.nurse && 'nurse=' + encodeURIComponent(f.nurse)].filter(Boolean).join('&');
      api('/api/doc-audit/audits?' + qs).then((j) => { if (live) setData(j); }).catch((e) => setErr(e.message));
      return () => { live = false; };
    }, [f.dept, f.from, f.to, f.status, f.result, f.tool, f.nurse]);
    const set = (k, v) => setF((x) => Object.assign({}, x, { [k]: v }));
    const needle = f.q.trim().toLowerCase();
    const rows = data ? data.audits.filter((x) => !needle || [DA.nursesOf(x).map((n) => n.name + ' ' + (n.empId || '')).join(' '), x.uhid, x.auditor && x.auditor.name, x.area].join(' ').toLowerCase().indexOf(needle) >= 0) : [];
    const months = DA.monthsBetween(f.from.slice(0, 7), f.to.slice(0, 7), 36);
    // BULK: tick audits, then complete / publish / print / PDF / Excel / remove them together.
    const [picked, setPicked] = useState([]);
    const [busy, setBusy] = useState(false);
    const [reload, setReload] = useState(0);
    useEffect(() => { setPicked([]); }, [f.dept, f.from, f.to, f.status, f.result, f.tool, f.nurse, reload]);
    const shownIds = rows.map((x) => x.id);
    const allOn = shownIds.length > 0 && shownIds.every((id) => picked.indexOf(id) >= 0);
    const toggle = (id) => setPicked((p) => (p.indexOf(id) >= 0 ? p.filter((x) => x !== id) : p.concat([id])));
    const sel = rows.filter((x) => picked.indexOf(x.id) >= 0);
    const count = (st) => sel.filter((x) => (Array.isArray(st) ? st.indexOf(x.status) >= 0 : x.status === st)).length;
    async function bulk(action) {
      const n = action === 'complete' ? count('draft') : action === 'publish' ? count(['completed', 'acknowledged']) : sel.length;
      const words = { complete: ['Complete ' + n + ' draft(s)?', 'Fully answered drafts become Completed audits; unfinished ones are skipped and listed.', 'Complete'],
        publish: ['Publish ' + n + ' audit(s)?', 'They are released to the nurses (My Profile) and locked. Your own audits are skipped — another person publishes them.', 'Publish'],
        remove: ['Remove ' + sel.length + ' audit(s)?', 'They leave the register and the KPIs; nothing is deleted (kept in history). Published ones only by an administrator.', 'Remove'] }[action];
      if (!n) { toast(action === 'complete' ? 'None of the ticked audits is a draft.' : 'None of the ticked audits is completed and waiting to be published.', 'warn'); return; }
      let reason = '';
      if (action === 'remove') { reason = await askText({ title: words[0], message: words[1], confirmLabel: words[2], danger: true, placeholder: 'Reason (optional)' }); if (reason == null) return; }
      else if (!(await confirmBox({ title: words[0], message: words[1], confirmLabel: words[2] }))) return;
      setBusy(true);
      try {
        const ids = action === 'complete' ? sel.filter((x) => x.status === 'draft').map((x) => x.id) : action === 'publish' ? sel.filter((x) => x.status === 'completed' || x.status === 'acknowledged').map((x) => x.id) : sel.map((x) => x.id);
        const r = await post('/api/doc-audit/bulk', { action, ids, reason });
        toast(r.done + ' done' + (r.skipped.length ? ' · ' + r.skipped.length + ' skipped — ' + r.skipped.slice(0, 3).map((s2) => (s2.label ? s2.label + ': ' : '') + s2.why).join(' · ') + (r.skipped.length > 3 ? ' …' : '') : ''), r.skipped.length ? 'warn' : 'success');
        refreshBadge(); setReload((x) => x + 1);
      } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
    }
    const done = sel.filter((x) => x.status !== 'draft');
    const bulkPrint = () => { if (!done.length) return toast('Tick completed or published audits to print.', 'warn'); openPrint({ kind: 'bulk', ids: done.map((x) => x.id) }, bulkDoc(done, meta), false); };
    const bulkPdf = () => { if (!done.length) return toast('Tick completed or published audits.', 'warn'); setBusy(true); pdfFrom({ kind: 'bulk', ids: done.map((x) => x.id) }, bulkDoc(done, meta), false).catch((e) => toast(e.message, 'error')).finally(() => setBusy(false)); };
    const bulkExcel = async () => { if (!done.length) return toast('Tick completed or published audits.', 'warn'); try { await download('/api/doc-audit/xlsx?ids=' + done.map((x) => x.id).join(',')); toast('Excel downloaded.', 'success'); } catch (e) { toast(e.message, 'error'); } };
    useEffect(() => {
      let live = true;
      if (!reload) return;
      const qs = ['from=' + f.from, 'to=' + f.to, f.dept && 'dept=' + encodeURIComponent(f.dept), f.status && 'status=' + f.status, f.result && 'result=' + f.result, f.tool && 'tool=' + f.tool, f.nurse && 'nurse=' + encodeURIComponent(f.nurse)].filter(Boolean).join('&');
      api('/api/doc-audit/audits?' + qs).then((j) => { if (live) setData(j); }).catch((e) => setErr(e.message));
      return () => { live = false; };
    }, [reload]);
    async function excel() { try { await download('/api/doc-audit/xlsx?from=' + months[0] + '&to=' + months[months.length - 1] + (f.dept ? '&dept=' + encodeURIComponent(f.dept) : '')); toast('Excel downloaded.', 'success'); } catch (e) { toast(e.message, 'error'); } }
    return (
      <div className="da-wrap">
        <div className="da-card da-bar">
          <select className="da-sel" value={f.dept} onChange={(e) => set('dept', e.target.value)}><option value="">All my departments</option>{meta.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
          <input type="date" className="da-in" value={f.from} max={f.to} onChange={(e) => e.target.value && set('from', e.target.value)} /><span className="da-sub">to</span>
          <input type="date" className="da-in" value={f.to} min={f.from} onChange={(e) => e.target.value && set('to', e.target.value)} />
          <select className="da-sel" value={f.status} onChange={(e) => set('status', e.target.value)}><option value="">Any status</option>{DA.STATUSES.map((s) => <option key={s} value={s}>{DA.STATUS_LABEL[s]}</option>)}</select>
          <select className="da-sel" value={f.result} onChange={(e) => set('result', e.target.value)}><option value="">Any result</option><option value="pass">PASS</option><option value="fail">FAIL</option><option value="critical">Critical failure</option></select>
          {meta.tools.length > 1 && <select className="da-sel" value={f.tool} onChange={(e) => set('tool', e.target.value)}><option value="">Any tool</option>{meta.tools.map((t) => <option key={t.id} value={t.id}>{t.short || t.name}</option>)}</select>}
          <input className="da-in" style={{ flex: '1 1 180px' }} placeholder="Search nurse, ID, UHID, auditor…" value={f.q} onChange={(e) => set('q', e.target.value)} />
          {f.nurse && <button className="da-btn sm" onClick={() => set('nurse', '')}>One nurse only ×</button>}
          {meta.canPrint && <button className="da-btn" onClick={excel}>Excel</button>}
          {meta.canAdd && <button className="da-btn pri" onClick={() => setRoute({ view: 'docAuditNew', dept: f.dept || undefined })}>+ New audit</button>}
        </div>
        {err && <div className="da-banner red">{err}</div>}
        {picked.length > 0 && <div className="da-card da-bar" style={{ position: 'sticky', top: 6, zIndex: 3, boxShadow: '0 6px 22px rgba(13,27,46,.12)', animation: 'da-in .2s ease' }}>
          <b style={{ fontSize: 13 }}>{picked.length} selected</b>
          <span className="da-sub">{count('draft')} draft · {count(['completed', 'acknowledged'])} completed · {count('signed')} published</span>
          <span style={{ flex: 1 }} />
          {meta.canAdd && <button className="da-btn" disabled={busy} onClick={() => bulk('complete')}>Complete</button>}
          {meta.canEdit && <button className="da-btn ok" disabled={busy} onClick={() => bulk('publish')}>Publish</button>}
          {meta.canPrint && <><button className="da-btn" disabled={busy} onClick={bulkPrint}>Print</button><button className="da-btn" disabled={busy} onClick={bulkPdf}>PDF</button><button className="da-btn" disabled={busy} onClick={bulkExcel}>Excel</button></>}
          {meta.canDelete && <button className="da-btn danger" disabled={busy} onClick={() => bulk('remove')}>Remove</button>}
          <button className="da-btn sm" onClick={() => setPicked([])}>Clear</button>
        </div>}
        <div className="da-card">
          {!data ? <div className="da-empty">Loading…</div> : !rows.length ? <div className="da-empty">No audit matches.</div> :
            <div className="da-scroll"><table className="da-tbl">
              <thead><tr><th style={{ width: 30 }}><input type="checkbox" aria-label="Select all shown" checked={allOn} onChange={() => setPicked(allOn ? [] : shownIds)} /></th><th>Date</th><th>Department / area</th><th>Nurse(s) audited</th><th>UHID</th><th>Auditor</th><th className="n">Y / N / NA</th><th className="n">Score</th><th>Grade</th><th>Result</th><th>Status</th></tr></thead>
              <tbody>{rows.map((x) => (
                <tr key={x.id} className="click" style={picked.indexOf(x.id) >= 0 ? { background: '#eef6fd' } : null} onClick={() => setRoute({ view: 'docAuditNew', audit: x.id })}>
                  <td onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label="Select" checked={picked.indexOf(x.id) >= 0} onChange={() => toggle(x.id)} /></td>
                  <td style={{ whiteSpace: 'nowrap' }}>{DA.fmtDate(x.date)}<div className="da-sub">{x.shift}</div></td>
                  <td><b>{x.deptName}</b><div className="da-sub">{x.area}{x.toolName ? ' · ' + x.toolName : ''}</div></td>
                  <td><NurseList x={x} />{DA.nursesOf(x).length > 1 && <div className="da-sub" style={{ marginTop: 4 }}>{DA.nursesOf(x).length} nurses · shared record</div>}</td>
                  <td>{x.uhid}</td>
                  <td>{x.auditor ? <Person name={x.auditor.name} empId={x.auditor.empId} sub={x.auditor.enteredBy && x.auditor.enteredBy !== x.auditor.username ? 'entered by ' + x.auditor.enteredBy : x.auditor.enteredBy ? 'entered by an administrator' : ''} /> : ''}</td>
                  <td className="n">{x.result ? x.result.yes + ' / ' + x.result.no + ' / ' + x.result.na : ''}</td>
                  <td className="n"><b>{pctTxt(x.result && x.result.pct)}</b></td>
                  <td style={{ color: gradeColor(x.result && x.result.grade), fontWeight: 600, fontSize: 12 }}>{x.result ? x.result.gradeLabel : ''}{x.result && (x.result.criticalFails || []).length ? <div><span className="da-chip crit">{x.result.criticalFails.length} critical</span></div> : null}</td>
                  <td>{x.status === 'draft' ? <span className="da-muted">—</span> : <ResultChip r={x.result} />}</td>
                  <td><StatusChip s={x.status} /></td>
                </tr>))}</tbody></table></div>}
          {data && data.more && <div className="da-pad da-sub">Showing the newest 500 — narrow the dates to see the rest.</div>}
        </div>
      </div>);
  }

  /* ================================================================ reports === */
  function Reports({ meta, setRoute }) {
    const ym = meta.month;
    const PRESETS = [['m0', 'This month', ym, ym], ['m1', 'Last month', DA.addMonth(ym, -1), DA.addMonth(ym, -1)], ['q', 'Last 3 months', DA.addMonth(ym, -2), ym], ['h', 'Last 6 months', DA.addMonth(ym, -5), ym], ['y', 'This year', ym.slice(0, 4) + '-01', ym]];
    // Opens on THIS month — the month audits are being done (Last month was empty for a new module).
    const [p, setP] = useState({ from: ym, to: ym, dept: '', by: '' });
    const [latest, setLatest] = useState(null);
    const [data, setData] = useState(null);
    const [err, setErr] = useState('');
    const [tab, setTab] = useState(null);
    const [cap, setCap] = useState(null);
    const load = useCallback(() => {
      setData(null);
      api('/api/doc-audit/summary?from=' + p.from + '&to=' + p.to + (p.dept ? '&dept=' + encodeURIComponent(p.dept) : '') + (p.by ? '&by=' + p.by : '')).then(setData).catch((e) => setErr(e.message));
    }, [p.from, p.to, p.dept, p.by]);
    useEffect(() => { load(); }, [load]);
    // An empty period: where are the latest audits? (newest first; drafts are not results)
    useEffect(() => {
      setLatest(null);
      if (!data || data.overall.total.records > 0) return;
      let live = true;
      api('/api/doc-audit/audits?from=' + DA.addMonth(ym, -11) + '-01' + (p.dept ? '&dept=' + encodeURIComponent(p.dept) : '')).then((j) => {
        const done = (j.audits || []).filter((x) => x.status !== 'draft');
        if (!live || !done.length) return;
        const m = done[0].month;
        setLatest({ month: m, n: done.filter((x) => x.month === m).length });
      }).catch(() => {});
      return () => { live = false; };
    }, [data]);
    const set = (k, v) => setP((x) => Object.assign({}, x, { [k]: v }));
    const toolsShown = data ? data.tools.filter((t) => data.rows.some((r) => r.toolId === t.id)) : [];
    const cur = toolsShown.find((t) => t.id === tab) || toolsShown[0];
    const label = p.from === p.to ? DA.fmtMonth(p.from) : DA.fmtMonth(p.from) + ' – ' + DA.fmtMonth(p.to);
    async function excel() { try { await download('/api/doc-audit/xlsx?from=' + p.from + '&to=' + p.to + (p.dept ? '&dept=' + encodeURIComponent(p.dept) : '')); toast('Excel downloaded.', 'success'); } catch (e) { toast(e.message, 'error'); } }
    const kCell = (k, records) => !records || k.value == null ? <span className="da-muted">—</span>
      : <span style={{ fontWeight: 700, color: k.met === false ? '#a3172f' : k.met ? '#14713f' : undefined }}>{k.value}%{k.met === false ? ' ▼' : ''}</span>;
    return (
      <div className="da-wrap">
        <div className="da-card da-bar">
          <div className="da-tabs">{PRESETS.map(([id, l, a, b]) => <button key={id} className={'da-btn sm' + (p.from === a && p.to === b ? ' pri' : '')} onClick={() => setP((x) => Object.assign({}, x, { from: a, to: b }))}>{l}</button>)}</div>
          <input type="month" className="da-in" value={p.from} max={p.to} onChange={(e) => e.target.value && set('from', e.target.value)} /><span className="da-sub">to</span>
          <input type="month" className="da-in" value={p.to} min={p.from} max={ym} onChange={(e) => e.target.value && set('to', e.target.value)} />
          <select className="da-sel" value={p.dept} onChange={(e) => set('dept', e.target.value)}><option value="">All my departments</option>{meta.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
          <span style={{ flex: 1 }} />
          {meta.canPrint && data && <>
            <span className="da-sub">KPI report</span>
            <button className="da-btn" onClick={() => printReport(data)}>Print</button><button className="da-btn" onClick={() => pdfReport(data).catch((e) => toast(e.message, 'error'))}>PDF</button>
            <span className="da-sub" style={{ marginLeft: 6 }}>Complete report</span>
            <button className="da-btn pri" title="Summary, KPI tables, trend, criterion gaps, action plans, results by nurse and the full audit register" onClick={() => completeReport(data, p.dept, false)}>Print</button>
            <button className="da-btn" onClick={() => completeReport(data, p.dept, true).catch((e) => toast(e.message, 'error'))}>PDF</button>
            <button className="da-btn" onClick={excel}>Excel</button></>}
        </div>
        {err && <div className="da-banner red">{err}</div>}
        {data && latest && <div className="da-banner blue"><div style={{ flex: 1 }}>No completed audit in <b>{periodLabel(data.months)}</b>. Your latest audits are in <b>{DA.fmtMonth(latest.month)}</b> ({latest.n}).</div>
          <button className="da-btn sm pri" onClick={() => setP((x) => Object.assign({}, x, { from: latest.month, to: latest.month }))}>Show {DA.fmtMonth(latest.month)}</button></div>}
        {!data ? <div className="da-card da-empty">Building the report…</div> : <>
          <div className="da-tiles">
            <div className="da-tile"><span>Records audited</span><b>{data.overall.total.records}</b><small>{label}</small></div>
            <div className="da-tile"><span>Documentation accuracy</span><b style={{ color: data.overall.total.accuracy == null ? undefined : data.overall.total.accuracy >= 90 ? '#14713f' : '#a3172f' }}>{pctTxt(data.overall.total.accuracy)}</b><small>all tools · target ≥ 90%</small></div>
            <div className="da-tile"><span>Critical failure rate</span><b>{data.overall.total.records ? pctTxt(DA.round1(data.overall.total.criticalRecords / data.overall.total.records * 100)) : '—'}</b><small>{data.overall.total.criticalRecords} record(s) · target ≤ 5%</small></div>
            <div className="da-tile"><span>Nurses audited</span><b>{data.overall.total.nurses}</b><small>each at least once a quarter</small></div>
          </div>
          {!toolsShown.length && <div className="da-card da-empty">No audit in {label}.</div>}
          {toolsShown.length > 0 && cur && <div className="da-card">
            <div className="da-h"><h3>Department KPI report</h3><span className="da-sub">Appendix C · {label}</span><span className="grow" />
              {toolsShown.length > 1 && <div className="da-tabs">{toolsShown.map((t) => <button key={t.id} className={'da-btn sm' + (cur.id === t.id ? ' pri' : '')} onClick={() => setTab(t.id)}>{t.short || t.name}</button>)}</div>}</div>
            <div className="da-scroll"><table className="da-tbl">
              <thead><tr><th style={{ minWidth: 170 }}>Department</th><th className="n">Records</th>{cur.kpis.map((k) => <th key={k.id} className="n" title={DA.KPI_FORMULA_LABEL[k.formula] + (k.criteria ? ' — criteria ' + k.criteria.map((c) => '#' + c.replace('c', '')).join(', ') : '')}><div style={{ textTransform: 'none', fontWeight: 700 }}>{k.name}</div><div style={{ textTransform: 'none', fontWeight: 500 }}>{k.direction === 'lower' ? '≤ ' : '≥ '}{k.target}%</div></th>)}<th>Top 3 failing criteria</th><th>Action plan</th></tr></thead>
              <tbody>
                {data.rows.filter((r) => r.toolId === cur.id).map((r) => {
                  const s = r.total; const lastCap = r.caps[r.caps.length - 1];
                  return <tr key={r.deptId}>
                    <td><b>{r.name}</b>{r.minRecords ? <div className="da-sub">min {r.minRecords}/month</div> : null}</td>
                    <td className="n">{s.records}</td>
                    {s.kpis.map((k) => <td key={k.id} className="n">{kCell(k, s.records)}</td>)}
                    <td style={{ fontSize: 11.8, minWidth: 160 }}>{s.topFailing.map((g) => <div key={g.id}>#{g.no} ×{g.count} {g.critical && <span className="da-chip crit">C</span>} <span className="da-muted">{g.text.slice(0, 60)}{g.text.length > 60 ? '…' : ''}</span></div>)}{!s.topFailing.length && <span className="da-muted">—</span>}</td>
                    <td>{lastCap ? <span className="da-chip off" title={'Below target in ' + DA.fmtMonth(DA.addMonth(lastCap.month, -1)) + ' and ' + DA.fmtMonth(lastCap.month)}>CAP due</span> : null}
                      <div><button className="da-btn sm" style={{ marginTop: 4 }} onClick={() => setCap({ dept: r, month: p.to, tool: cur, summary: r.months[p.to] || s })}>{meta.canEdit ? 'Action plan' : 'View plan'}</button></div></td>
                  </tr>;
                })}
                {data.hospital[cur.id] && <tr className="tot"><td>HOSPITAL TOTAL</td><td className="n">{data.hospital[cur.id].total.records}</td>{data.hospital[cur.id].total.kpis.map((k) => <td key={k.id} className="n">{kCell(k, data.hospital[cur.id].total.records)}</td>)}<td style={{ fontSize: 11.8 }}>{data.hospital[cur.id].total.topFailing.map((g) => '#' + g.no + ' ×' + g.count).join(', ')}</td><td /></tr>}
              </tbody></table></div>
            <div className="da-pad da-sub">Policy 9: a department below target for 2 consecutive months submits a corrective action plan with owner and due date, focused on its top 3 failing criteria (PDSA). Hover a KPI for its formula.</div>
          </div>}
          {data.months.length > 1 && data.rows.length > 0 && <div className="da-card">
            <div className="da-h"><h3>Accuracy by month</h3><span className="da-sub">Documentation accuracy = Σ Yes ÷ Σ (Yes + No)</span></div>
            {W.LineChart && <div className="da-pad"><W.LineChart data={data.months.map((m) => ({ mon: DA.fmtMonth(m).slice(0, 3) + ' ' + m.slice(2, 4), val: data.overall.months[m].accuracy == null ? 0 : data.overall.months[m].accuracy }))} x="mon" y="val" height={200} color="#1f4f8a" /></div>}
            <div className="da-scroll"><table className="da-tbl da-heat">
              <thead><tr><th>Department</th>{data.months.map((m) => <th key={m} className="n">{DA.fmtMonth(m)}</th>)}</tr></thead>
              <tbody>{data.rows.map((r) => <tr key={r.deptId + r.toolId}><td><b>{r.name}</b></td>{data.months.map((m) => { const s = r.months[m]; const v = s.accuracy; const bg = v == null ? '#f6f8fa' : v >= 95 ? '#d6f0df' : v >= 90 ? '#e7f6ed' : v >= 80 ? '#fff1d6' : '#fde4e8';
                return <td key={m} className="v" style={{ background: bg }} title={s.records + ' record(s)'}>{v == null ? '·' : v + '%'}<div className="da-sub" style={{ fontWeight: 500 }}>{s.records ? s.records + ' rec.' : ''}</div></td>; })}</tr>)}</tbody></table></div>
          </div>}
          {cur && data.hospital[cur.id] && data.hospital[cur.id].total.gaps.length > 0 && <div className="da-card">
            <div className="da-h"><h3>Criterion gap analysis</h3><span className="da-sub">{cur.short || cur.name} · how often each criterion was marked 'No'</span></div>
            <div className="da-pad">{(() => { const gs = data.hospital[cur.id].total.gaps.slice(0, 12); const max = Math.max(1, ...gs.map((g) => g.count)); const rec = data.hospital[cur.id].total.records;
              return gs.map((g) => <div className="da-gap" key={g.id}><b style={{ color: '#0b4f6c' }}>#{g.no}</b><div style={{ minWidth: 0 }}>{g.critical && <span className="da-chip crit" style={{ marginRight: 5 }}>Critical</span>}{g.text}</div>
                <div><div className="bar"><i style={{ width: (g.count / max) * 100 + '%', background: g.critical ? '#a3172f' : '#d23a52' }} /></div><div className="da-sub" style={{ textAlign: 'right' }}>{g.count}× · {rec ? DA.round1(g.count / rec * 100) : 0}% of records</div></div></div>); })()}</div>
          </div>}
          <div className="da-card">
            <div className="da-h"><h3>Breakdown</h3><span className="grow" />
              <div className="seg">{[['', 'None'], ['area', 'By area / zone'], ['shift', 'By shift'], ['nurse', 'By nurse'], ['auditor', 'By auditor']].map(([k, l]) => <button key={k} className={p.by === k ? 'on' : ''} onClick={() => set('by', k)}>{l}</button>)}</div></div>
            {!p.by ? <div className="da-empty" style={{ padding: 14 }}>Choose a breakdown — ED results by zone and by shift (QA-004 §9), or each nurse’s record (policy §1).</div>
              : !data.breakdown || !data.breakdown.length ? <div className="da-empty" style={{ padding: 14 }}>No audit in this period.</div>
                : <div className="da-scroll"><table className="da-tbl"><thead><tr><th>{({ area: 'Area / zone', shift: 'Shift', nurse: 'Nurse', auditor: 'Auditor' })[p.by]}</th><th className="n">Records</th><th className="n">Accuracy</th><th className="n">Critical</th><th>Top failing</th></tr></thead>
                  <tbody>{data.breakdown.map((b) => <tr key={b.key} className={b.staffId ? 'click' : ''} onClick={() => b.staffId && setRoute({ view: 'docAuditRegister', nurse: b.staffId })}>
                    <td><b>{b.label}</b>{b.sub && <div className="da-sub">{b.sub}</div>}</td><td className="n">{b.summary.records}</td>
                    <td className="n" style={{ fontWeight: 700, color: b.summary.accuracy != null && b.summary.accuracy < 90 ? '#a3172f' : undefined }}>{pctTxt(b.summary.accuracy)}</td>
                    <td className="n" style={{ color: b.summary.criticalRecords ? '#a3172f' : undefined }}>{b.summary.criticalRecords || ''}</td>
                    <td style={{ fontSize: 11.8 }}>{b.summary.topFailing.map((g) => '#' + g.no + ' ×' + g.count).join(', ')}</td></tr>)}</tbody></table></div>}
          </div>
        </>}
        {cap && <CapEditor meta={meta} {...cap} onClose={() => setCap(null)} />}
      </div>);
  }

  /* ============================================== corrective action plan === */
  const ROOT_CAUSES = ['Knowledge', 'Time / workload', 'Form design', 'System / EMR', 'Communication', 'Supervision'];
  function CapEditor({ meta, dept, month, tool, summary, onClose }) {
    const [cap, setCap] = useState(null);
    const [items, setItems] = useState(null);
    const [busy, setBusy] = useState(false);
    const [ym, setYm] = useState(month);
    useEffect(() => {
      let live = true; setItems(null);
      api('/api/doc-audit/caps/' + encodeURIComponent(dept.deptId) + '/' + ym).then((j) => {
        if (!live) return;
        setCap(j.cap);
        const s = dept.months[ym] || summary;
        setItems(j.cap ? j.cap.items : (s.topFailing || []).map((g) => ({ critId: g.id, gap: "#" + g.no + " marked 'No' in " + g.count + ' record(s): ' + g.text, rootCause: '', action: '', owner: '', due: '', status: 'open', reaudit: '' })));
      }).catch((e) => { toast(e.message, 'error'); onClose(); });
      return () => { live = false; };
    }, [ym]);
    const may = meta.canEdit;
    const set = (i, k, v) => setItems((xs) => xs.map((x, j) => (j === i ? Object.assign({}, x, { [k]: v }) : x)));
    async function save(submit) {
      setBusy(true);
      try { const j = await post('/api/doc-audit/caps/' + encodeURIComponent(dept.deptId) + '/' + ym, { items, submit: !!submit, baseUpdatedAt: cap ? cap.updatedAt : null }, 'PUT'); setCap(j.cap); setItems(j.cap.items); toast(submit ? 'Action plan submitted.' : 'Action plan saved.', 'success'); }
      catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
    }
    const crits = DA.activeCriteria(tool.criteria || []);
    return <Modal wide title={'Corrective Action Plan · ' + dept.name} onClose={onClose}
      footer={may ? <><button className="da-btn" onClick={onClose}>Close</button><button className="da-btn" disabled={busy || !items} onClick={() => save(false)}>Save</button><button className="da-btn pri" disabled={busy || !items || !items.length} onClick={() => save(true)}>Submit to the Nursing Quality Committee</button></> : <button className="da-btn" onClick={onClose}>Close</button>}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="da-sub">Month</span><input type="month" className="da-in" value={ym} max={meta.month} onChange={(e) => e.target.value && setYm(e.target.value)} />
        {cap && <span className="da-sub">Prepared by {cap.preparedBy} · {cap.submittedAt ? 'submitted ' + when(cap.submittedAt) : 'not submitted yet'}</span>}
      </div>
      <div className="da-sub">Appendix B. Root-cause prompts: knowledge, time/workload, form design, system/EMR, communication, supervision. A new plan starts from the month’s top failing criteria.</div>
      {!items ? <div className="da-empty">Loading…</div> : <>
        {items.map((x, i) => <div key={i} className="da-card da-pad" style={{ display: 'grid', gap: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 8 }}>
            <select className="da-sel" disabled={!may} value={x.critId} onChange={(e) => set(i, 'critId', e.target.value)}><option value="">Criterion…</option>{crits.map((c) => <option key={c.id} value={c.id}>#{c.no}{c.critical ? ' (critical)' : ''}</option>)}</select>
            <textarea className="da-ta" rows={2} disabled={!may} placeholder="Gap identified (evidence)" value={x.gap} onChange={(e) => set(i, 'gap', e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 8 }}>
            <div><input className="da-in" style={{ width: '100%' }} list="da-root" disabled={!may} placeholder="Root cause" value={x.rootCause} onChange={(e) => set(i, 'rootCause', e.target.value)} /></div>
            <input className="da-in" disabled={!may} placeholder="Owner" value={x.owner} onChange={(e) => set(i, 'owner', e.target.value)} />
            <input type="date" className="da-in" disabled={!may} value={x.due} onChange={(e) => set(i, 'due', e.target.value)} />
            <select className="da-sel" disabled={!may} value={x.status} onChange={(e) => set(i, 'status', e.target.value)}><option value="open">Open</option><option value="progress">In progress</option><option value="done">Done</option></select>
          </div>
          <textarea className="da-ta" rows={2} disabled={!may} placeholder="Action" value={x.action} onChange={(e) => set(i, 'action', e.target.value)} />
          <div style={{ display: 'flex', gap: 8 }}><input className="da-in" style={{ flex: 1 }} disabled={!may} placeholder="Status / re-audit result" value={x.reaudit} onChange={(e) => set(i, 'reaudit', e.target.value)} />
            {may && <button className="da-btn sm danger" onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))}>Remove</button>}</div>
        </div>)}
        <datalist id="da-root">{ROOT_CAUSES.map((r) => <option key={r} value={r} />)}</datalist>
        {may && items.length < 20 && <button className="da-btn" onClick={() => setItems((xs) => xs.concat([{ critId: '', gap: '', rootCause: '', action: '', owner: '', due: '', status: 'open', reaudit: '' }]))}>+ Add an action</button>}
        {!items.length && <div className="da-empty">No action yet.</div>}
      </>}
    </Modal>;
  }

  /* ============================================================ audit tools === */
  function Tools({ meta, reloadMeta }) {
    const [tools, setTools] = useState(null);
    const [sel, setSel] = useState(null);
    const [d, setD] = useState(null);
    const [busy, setBusy] = useState(false);
    const load = useCallback(() => api('/api/doc-audit/tools?all=1').then((j) => { setTools(j.tools); return j.tools; }).catch((e) => toast(e.message, 'error')), []);
    useEffect(() => { load().then((ts) => { if (ts && ts.length) { setSel(ts[0].id); setD(JSON.parse(JSON.stringify(ts[0]))); } }); }, []);
    const cur = tools && tools.find((t) => t.id === sel);
    const open = (t) => { setSel(t.id); setD(JSON.parse(JSON.stringify(t))); };
    const dirty = cur && d && JSON.stringify(strip(cur)) !== JSON.stringify(strip(d));
    function strip(t) { const { history, updatedAt, updatedBy, createdAt, createdBy, revision, disabled, removedAt, removedBy, order, ...rest } = t; return rest; }
    const set = (k, v) => setD((x) => Object.assign({}, x, { [k]: v }));
    const setCrit = (i, k, v) => setD((x) => Object.assign({}, x, { criteria: x.criteria.map((c, j) => (j === i ? Object.assign({}, c, { [k]: v }) : c)) }));
    const move = (i, dir) => setD((x) => { const cs = x.criteria.slice(); const j = i + dir; if (j < 0 || j >= cs.length) return x; [cs[i], cs[j]] = [cs[j], cs[i]]; return Object.assign({}, x, { criteria: cs }); });
    async function save() {
      const scoring = JSON.stringify((cur.criteria || []).map((c) => [c.id, c.text, !!c.critical, c.active !== false, c.sectionId])) + JSON.stringify(cur.kpis) !== JSON.stringify((d.criteria || []).map((c) => [c.id, c.text, !!c.critical, c.active !== false, c.sectionId])) + JSON.stringify(d.kpis);
      if (scoring && !(await confirmBox({ title: 'Save as revision ' + ((cur.revision || 1) + 1) + '?', message: 'You changed criteria, critical flags or KPIs. New audits use the new version. Audits already filled keep the criteria they were filled against, so their scores do not change.', confirmLabel: 'Save' }))) return;
      setBusy(true);
      try { const j = await post('/api/doc-audit/tools/' + encodeURIComponent(cur.id), Object.assign({}, d, { baseUpdatedAt: cur.updatedAt }), 'PUT'); toast('Tool saved.', 'success'); const ts = await load(); const t = ts.find((x) => x.id === j.tool.id); if (t) open(t); reloadMeta(); }
      catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
    }
    async function create(from) {
      try { const j = await post('/api/doc-audit/tools', from ? { from } : { name: 'New audit tool', sections: [{ id: 'A', title: 'Section A' }], criteria: [] }); const ts = await load(); open(ts.find((x) => x.id === j.tool.id)); reloadMeta(); toast('Tool created.', 'success'); } catch (e) { toast(e.message, 'error'); }
    }
    async function flag(path, body, msg, method) {
      try { await api('/api/doc-audit/tools/' + encodeURIComponent(cur.id) + path, { method: method || 'POST', body: JSON.stringify(body || {}) }); const ts = await load(); const t = ts.find((x) => x.id === cur.id); if (t) open(t); reloadMeta(); toast(msg, 'success'); } catch (e) { toast(e.message, 'error'); }
    }
    if (!tools) return <div className="da-card da-empty">Loading the audit tools…</div>;
    const secIds = (d && d.sections || []).map((s) => s.id);
    const liveCrit = d ? d.criteria.filter((c) => c.active !== false) : [];
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px,280px) minmax(0,1fr)', gap: 14, alignItems: 'start' }} className="da-tools">
        <style>{'@media (max-width:900px){.da-tools{grid-template-columns:1fr!important}}'}</style>
        <div className="da-card">
          <div className="da-h"><h3>Audit tools</h3></div>
          {tools.map((t) => <div key={t.id} onClick={() => (!dirty || window.confirm('Leave without saving?')) && open(t)} style={{ padding: '10px 14px', borderBottom: '1px solid var(--line-2)', cursor: 'pointer', background: t.id === sel ? 'var(--blue-50)' : undefined, opacity: t.removedAt || t.disabled ? .55 : 1 }}>
            <b style={{ fontSize: 12.8 }}>{t.short || t.name}</b><div className="da-sub">{[t.code, 'rev. ' + (t.revision || 1), t.criteria.filter((c) => c.active !== false).length + ' criteria', t.removedAt ? 'archived' : t.disabled ? 'off' : ''].filter(Boolean).join(' · ')}</div></div>)}
          <div className="da-pad" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><button className="da-btn sm" onClick={() => create(null)}>+ New tool</button>{cur && <button className="da-btn sm" onClick={() => create(cur.id)}>Duplicate</button>}</div>
        </div>
        {d && cur && <div className="da-wrap">
          <div className="da-card da-bar">
            <b style={{ fontSize: 14 }}>{cur.name}</b><span className="da-sub">revision {cur.revision || 1}</span><span style={{ flex: 1 }} />
            {!cur.removedAt && <Switch on={!cur.disabled} onClick={() => flag('/enabled', { enabled: !!cur.disabled }, cur.disabled ? 'Tool switched on.' : 'Tool switched off.')}>{cur.disabled ? 'Off' : 'On'}</Switch>}
            {meta.canPrint !== false && <button className="da-btn sm" onClick={() => printAudit(null, d)}>Print blank form</button>}
            {cur.removedAt ? <button className="da-btn sm" onClick={() => flag('/restore', {}, 'Restored.')}>Restore</button> : <button className="da-btn sm danger" onClick={async () => { if (await confirmBox({ title: 'Archive this tool?', message: 'It stops being offered for new audits. Audits already filled with it stay as they are.', confirmLabel: 'Archive', danger: true })) flag('', {}, 'Archived.', 'DELETE'); }}>Archive</button>}
            <button className="da-btn pri" disabled={!dirty || busy} onClick={save}>Save</button>
          </div>
          <div className="da-card da-pad da-fields">
            <div className="da-f" style={{ gridColumn: 'span 2' }}><label>Name</label><input className="da-in" value={d.name} onChange={(e) => set('name', e.target.value)} /></div>
            <div className="da-f"><label>Short name</label><input className="da-in" value={d.short || ''} onChange={(e) => set('short', e.target.value)} /></div>
            <div className="da-f"><label>Document no.</label><input className="da-in" value={d.code || ''} onChange={(e) => set('code', e.target.value)} /></div>
            <div className="da-f"><label>Version</label><input className="da-in" value={d.version || ''} onChange={(e) => set('version', e.target.value)} /></div>
            <div className="da-f"><label>Minimum records / unit / month</label><input type="number" min="0" className="da-in" value={(d.sample || {}).minRecords == null ? '' : d.sample.minRecords} onChange={(e) => set('sample', Object.assign({}, d.sample, { minRecords: e.target.value === '' ? '' : +e.target.value }))} /></div>
            <div className="da-f" style={{ gridColumn: '1 / -1' }}><label>Applies to</label><input className="da-in" value={d.scope || ''} onChange={(e) => set('scope', e.target.value)} /></div>
            <div className="da-f" style={{ gridColumn: '1 / -1' }}><label>Sample rule (shown to auditors)</label><textarea className="da-ta" rows={2} value={(d.sample || {}).note || ''} onChange={(e) => set('sample', Object.assign({}, d.sample, { note: e.target.value }))} /></div>
          </div>
          <div className="da-card">
            <div className="da-h"><h3>Sections</h3><span className="grow" /><button className="da-btn sm" onClick={() => set('sections', d.sections.concat([{ id: '', title: 'New section', jci: '' }]))}>+ Section</button></div>
            <div className="da-pad">{d.sections.map((s, i) => <div key={i} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 200px auto', gap: 8, marginBottom: 6 }}>
              <input className="da-in" value={s.id} placeholder="A" onChange={(e) => set('sections', d.sections.map((x, j) => (j === i ? Object.assign({}, x, { id: e.target.value.toUpperCase().slice(0, 3) }) : x)))} />
              <input className="da-in" value={s.title} onChange={(e) => set('sections', d.sections.map((x, j) => (j === i ? Object.assign({}, x, { title: e.target.value }) : x)))} />
              <input className="da-in" value={s.jci || ''} placeholder="JCI chapters" onChange={(e) => set('sections', d.sections.map((x, j) => (j === i ? Object.assign({}, x, { jci: e.target.value }) : x)))} />
              <button className="da-btn sm danger" disabled={d.criteria.some((c) => c.sectionId === s.id && c.active !== false)} title="Move or switch off its criteria first" onClick={() => set('sections', d.sections.filter((_, j) => j !== i))}>×</button></div>)}</div>
          </div>
          <div className="da-card">
            <div className="da-h"><h3>Criteria</h3><span className="da-sub">{liveCrit.length} active · {liveCrit.filter((c) => c.critical).length} critical</span><span className="grow" />
              <button className="da-btn sm" onClick={() => set('criteria', d.criteria.concat([{ id: '', no: 0, sectionId: secIds[secIds.length - 1] || 'A', text: '', jci: [], critical: false, active: true }]))}>+ Criterion</button></div>
            <div className="da-pad">
              <div className="da-sub" style={{ marginBottom: 6 }}>Numbers follow the section order when saved. Switching a criterion off keeps the answers old audits hold for it.</div>
              {d.criteria.map((c, i) => <div key={c.id || 'n' + i} className={'da-ed-row' + (c.active === false ? ' off' : '')}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><button className="da-btn sm" onClick={() => move(i, -1)} aria-label="Up">↑</button><button className="da-btn sm" onClick={() => move(i, 1)} aria-label="Down">↓</button></div>
                <select className="da-sel" value={c.sectionId} onChange={(e) => setCrit(i, 'sectionId', e.target.value)}>{d.sections.map((s) => <option key={s.id} value={s.id}>{s.id}</option>)}</select>
                <textarea className="da-ta" rows={2} value={c.text} placeholder="Compliance criterion (exact policy wording)" onChange={(e) => setCrit(i, 'text', e.target.value)} />
                <input className="da-in" value={(c.jci || []).join(', ')} placeholder="JCI e.g. IPSG, MMU" onChange={(e) => setCrit(i, 'jci', e.target.value.split(/[,\s]+/).filter(Boolean))} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <Switch on={!!c.critical} onClick={() => setCrit(i, 'critical', !c.critical)}>Critical</Switch>
                  <Switch on={c.active !== false} onClick={() => setCrit(i, 'active', c.active === false)}>{c.active === false ? 'Off' : 'Active'}</Switch>
                  <span className="da-sub">{c.id ? '#' + c.no + ' · id ' + c.id : 'new'}</span>
                </div></div>)}
            </div>
          </div>
          <div className="da-card">
            <div className="da-h"><h3>KPIs</h3><span className="grow" /><button className="da-btn sm" onClick={() => set('kpis', d.kpis.concat([{ id: '', code: 'KPI-' + (d.kpis.length + 1), name: '', formula: 'subset', target: 95, direction: 'higher', criteria: [] }]))}>+ KPI</button></div>
            <div className="da-pad">{d.kpis.map((k, i) => { const sk = (key, v) => set('kpis', d.kpis.map((x, j) => (j === i ? Object.assign({}, x, { [key]: v }) : x)));
              return <div key={i} style={{ display: 'grid', gridTemplateColumns: '80px minmax(140px,1fr) 150px 70px 110px auto', gap: 8, marginBottom: 8, alignItems: 'start' }}>
                <input className="da-in" value={k.code || ''} onChange={(e) => sk('code', e.target.value)} />
                <input className="da-in" value={k.name} placeholder="Name" onChange={(e) => sk('name', e.target.value)} />
                <select className="da-sel" value={k.formula} onChange={(e) => sk('formula', e.target.value)}>{DA.KPI_FORMULAS.concat(DA.KPI_FORMULAS.indexOf(k.formula) < 0 ? [k.formula] : []).map((f) => <option key={f} value={f}>{({ accuracy: 'Accuracy (Σ Yes ÷ Yes+No)', pass: 'Pass rate', full: 'Fully compliant', critical: 'Critical failure rate', subset: 'Chosen criteria' })[f]}</option>)}</select>
                <input type="number" className="da-in" value={k.target == null ? '' : k.target} onChange={(e) => sk('target', e.target.value === '' ? null : +e.target.value)} />
                <select className="da-sel" value={k.direction} onChange={(e) => sk('direction', e.target.value)}><option value="higher">≥ target</option><option value="lower">≤ target</option></select>
                <button className="da-btn sm danger" disabled={k.formula === 'accuracy' && d.kpis.filter((x) => x.formula === 'accuracy').length === 1} onClick={() => set('kpis', d.kpis.filter((_, j) => j !== i))}>×</button>
                {k.formula === 'subset' && <div style={{ gridColumn: '2 / -1', display: 'flex', flexWrap: 'wrap', gap: 4 }}>{liveCrit.map((c) => { const on = (k.criteria || []).indexOf(c.id) >= 0;
                  return <button key={c.id} className={'da-btn sm' + (on ? ' pri' : '')} onClick={() => sk('criteria', on ? k.criteria.filter((x) => x !== c.id) : (k.criteria || []).concat([c.id]))}>#{c.no}</button>; })}</div>}
              </div>; })}</div>
          </div>
          <div className="da-card">
            <div className="da-h"><h3>Form header</h3></div>
            <div className="da-pad da-fields">
              <div className="da-f"><label>Area label</label><input className="da-in" value={(d.header || {}).areaLabel || ''} onChange={(e) => set('header', Object.assign({}, d.header, { areaLabel: e.target.value }))} /></div>
              <div className="da-f"><label>Bed / room label</label><input className="da-in" value={(d.header || {}).bedLabel || ''} onChange={(e) => set('header', Object.assign({}, d.header, { bedLabel: e.target.value }))} /></div>
              <div className="da-f" style={{ gridColumn: '1 / -1' }}><label>Areas / zones (one per line)</label><textarea className="da-ta" rows={4} value={((d.header || {}).areas || []).join('\n')} onChange={(e) => set('header', Object.assign({}, d.header, { areas: e.target.value.split('\n') }))} /></div>
              <div className="da-f" style={{ gridColumn: '1 / -1' }}><label>Extra fields</label>
                {((d.header || {}).extra || []).map((f, i) => { const sf = (k, v) => set('header', Object.assign({}, d.header, { extra: d.header.extra.map((x, j) => (j === i ? Object.assign({}, x, { [k]: v }) : x)) }));
                  return <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(140px,1fr) 100px minmax(140px,2fr) auto', gap: 8, marginBottom: 6 }}>
                    <input className="da-in" value={f.label} placeholder="Label" onChange={(e) => sf('label', e.target.value)} />
                    <select className="da-sel" value={f.type} onChange={(e) => sf('type', e.target.value)}><option value="text">Text</option><option value="select">Choice</option><option value="aldrete">Aldrete scale</option></select>
                    {f.type === 'select' ? <input className="da-in" placeholder="Choices separated by ;" value={(f.options || []).filter(Boolean).join('; ')} onChange={(e) => sf('options', [''].concat(e.target.value.split(';').map((x) => x.trim())))} /> : <span />}
                    <button className="da-btn sm danger" onClick={() => set('header', Object.assign({}, d.header, { extra: d.header.extra.filter((_, j) => j !== i) }))}>×</button></div>; })}
                <button className="da-btn sm" onClick={() => set('header', Object.assign({}, d.header, { extra: ((d.header || {}).extra || []).concat([{ id: '', label: '', type: 'text' }]) }))}>+ Field</button></div>
            </div>
          </div>
          <div className="da-card">
            <div className="da-h"><h3>How to apply by area (N/A guide)</h3><span className="grow" /><button className="da-btn sm" onClick={() => set('naGuide', (d.naGuide || []).concat([{ areas: [], na: [], never: [], note: '' }]))}>+ Rule</button></div>
            <div className="da-pad">{(d.naGuide || []).length === 0 && <div className="da-sub">No rule. A rule offers one-click N/A for criteria that do not apply in an area, and can forbid N/A for criteria that always apply there.</div>}
              {(d.naGuide || []).map((g, i) => { const sg = (k, v) => set('naGuide', d.naGuide.map((x, j) => (j === i ? Object.assign({}, x, { [k]: v }) : x)));
                const tog = (k, id) => sg(k, (g[k] || []).indexOf(id) >= 0 ? g[k].filter((x) => x !== id) : (g[k] || []).concat([id]));
                return <div key={i} className="da-card da-pad" style={{ marginBottom: 8, display: 'grid', gap: 6 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}><span className="da-sub" style={{ width: 70 }}>Areas</span>{((d.header || {}).areas || []).filter(Boolean).map((a) => <button key={a} className={'da-btn sm' + ((g.areas || []).indexOf(a) >= 0 ? ' pri' : '')} onClick={() => tog('areas', a)}>{a}</button>)}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}><span className="da-sub" style={{ width: 70 }}>Suggest N/A</span>{liveCrit.map((c) => <button key={c.id} className={'da-btn sm' + ((g.na || []).indexOf(c.id) >= 0 ? ' pri' : '')} onClick={() => tog('na', c.id)}>#{c.no}</button>)}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}><span className="da-sub" style={{ width: 70 }}>Never N/A</span>{liveCrit.map((c) => <button key={c.id} className={'da-btn sm' + ((g.never || []).indexOf(c.id) >= 0 ? ' pri' : '')} onClick={() => tog('never', c.id)}>#{c.no}</button>)}</div>
                  <div style={{ display: 'flex', gap: 8 }}><textarea className="da-ta" rows={2} placeholder="Guidance shown to the auditor" value={g.note || ''} onChange={(e) => sg('note', e.target.value)} /><button className="da-btn sm danger" onClick={() => set('naGuide', d.naGuide.filter((_, j) => j !== i))}>×</button></div>
                </div>; })}</div>
          </div>
          {(cur.history || []).length > 0 && <div className="da-card da-pad"><div className="da-sub" style={{ fontWeight: 700, marginBottom: 4 }}>HISTORY</div>{cur.history.slice().reverse().map((h, i) => <div key={i} style={{ fontSize: 11.8 }}>{when(h.at)} · {h.by} · {h.action}{h.changes ? ' (' + h.changes + ')' : ''}</div>)}</div>}
        </div>}
      </div>);
  }

  /* ================================================================ settings === */
  function Settings({ meta, reloadMeta, setRoute }) {
    const [data, setData] = useState(null);
    const [draft, setDraft] = useState({});
    const [flags, setFlags] = useState(null);
    const [busy, setBusy] = useState(false);
    const load = () => api('/api/doc-audit/config').then((j) => { setData(j); setDraft({}); setFlags({ kpiLink: j.kpiLink, ackRequired: j.ackRequired, evidenceRequired: j.evidenceRequired }); }).catch((e) => toast(e.message, 'error'));
    useEffect(() => { load(); }, []);
    if (!data) return <div className="da-card da-empty">Loading the settings…</div>;
    const cfgOf = (d) => Object.assign({}, d.cfg, draft[d.id] || {});
    const setRow = (d, k, v) => setDraft((x) => Object.assign({}, x, { [d.id]: Object.assign({ toolId: d.cfg.toolId, enabled: d.cfg.enabled, minRecords: d.cfg.minRecords }, x[d.id] || {}, { [k]: v }) }));
    const dirty = Object.keys(draft).length > 0 || flags.kpiLink !== data.kpiLink || flags.ackRequired !== data.ackRequired || flags.evidenceRequired !== data.evidenceRequired;
    const auditorsOf = (id) => (data.people || []).filter((p) => p.auditDepartments.indexOf('*') >= 0 || p.auditDepartments.indexOf(id) >= 0);
    async function save() {
      setBusy(true);
      try {
        // Rows still on the name guess are saved too once touched, so the choice is the administrator's.
        const r = await post('/api/doc-audit/config', { depts: draft, kpiLink: flags.kpiLink, ackRequired: flags.ackRequired, evidenceRequired: flags.evidenceRequired }, 'PUT');
        toast(r.changed ? 'Settings saved.' : 'Nothing changed.', 'success'); load(); reloadMeta(); refreshBadge();
      } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
    }
    return (
      <div className="da-wrap">
        <div className="da-card da-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Switch on={flags.kpiLink} onClick={() => setFlags((f) => Object.assign({}, f, { kpiLink: !f.kpiLink }))}><span><b>Feed Nursing KPI 2C (Documentation Accuracy)</b> — every completed audit counts, all departments: Σ Yes ÷ Σ (Yes + No).</span></Switch>
          <Switch on={flags.ackRequired} onClick={() => setFlags((f) => Object.assign({}, f, { ackRequired: !f.ackRequired }))}><span><b>Nurse’s acknowledgement required before publishing</b> — off: optional (the nurse may still acknowledge, before or after publishing).</span></Switch>
          <Switch on={flags.evidenceRequired} onClick={() => setFlags((f) => Object.assign({}, f, { evidenceRequired: !f.evidenceRequired }))}><span><b>Evidence required for every 'No'</b> — off: optional (the box is offered, never forced).</span></Switch>
        </div>
        <div className="da-card">
          <div className="da-h"><h3>Departments</h3><span className="da-sub">Which audit tool each department uses and its minimum sample. Grey rows follow the guess from the department’s name until saved.</span><span className="grow" /><button className="da-btn pri" disabled={!dirty || busy} onClick={save}>Save</button></div>
          <div className="da-scroll"><table className="da-tbl">
            <thead><tr><th>Department</th><th>Audited</th><th>Tool</th><th className="n">Min. records / month</th><th>Auditors</th></tr></thead>
            <tbody>{data.departments.map((d) => { const c = cfgOf(d); const auds = auditorsOf(d.id);
              return <tr key={d.id} style={!d.cfg.saved && !draft[d.id] ? { color: 'var(--muted)' } : null}>
                <td><b>{d.name}</b><div className="da-sub">{d.id}{!d.cfg.saved && !draft[d.id] ? ' · guessed' : ''}</div></td>
                <td><Switch on={!!c.enabled && !!c.toolId} onClick={() => setRow(d, 'enabled', !(c.enabled && c.toolId))} disabled={!c.toolId}>{c.enabled && c.toolId ? 'Yes' : 'No'}</Switch></td>
                <td><select className="da-sel" value={c.toolId || ''} onChange={(e) => { setRow(d, 'toolId', e.target.value || null); if (e.target.value && !c.toolId) setRow(d, 'enabled', true); }}><option value="">— none —</option>{data.tools.map((t) => <option key={t.id} value={t.id}>{t.short || t.name}</option>)}</select></td>
                <td className="n"><input type="number" min="0" className="da-in" style={{ width: 70, textAlign: 'right' }} value={c.minRecords} onChange={(e) => setRow(d, 'minRecords', e.target.value === '' ? 0 : +e.target.value)} /></td>
                <td style={{ fontSize: 12 }}>{data.peopleAvailable ? (auds.length ? auds.map((p) => p.name + (p.auditDepartments.indexOf('*') >= 0 ? ' (all)' : '')).join(', ') : <span className="da-muted">nobody yet</span>) : <span className="da-muted">—</span>}</td>
              </tr>; })}</tbody></table></div>
          <div className="da-pad da-sub">Auditors are given in <a href="#" onClick={(e) => { e.preventDefault(); setRoute({ view: 'users' }); }}>Access Control</a>: tick Nursing Documentation KPI Audit (Add = fill audits, Edit = sign off as In-charge) and pick their departments. Administrators see every department.</div>
        </div>
      </div>);
  }

  /* ================================================================== print === */
  // Official A4 sheets: black on white, thin rules (separate borders: html2canvas doubles collapsed ones).
  const PRINT_CSS = ''
    + '.dap{font:9pt/1.35 "Segoe UI",Arial,sans-serif;color:#111;background:#fff}.dap *{box-sizing:border-box}'
    + '.dap .lh{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;padding-bottom:8px;border-bottom:1.5px solid #111}.dap .lh img{height:38px}'
    + '.dap .lh .tt{text-align:right}.dap .lh .kind{font-size:7pt;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#444}.dap .lh h1{margin:2px 0 0;font-size:13.5pt;color:#111}.dap .lh .code{font-size:7.5pt;color:#444;margin-top:2px}'
    + '.dap table{border-collapse:separate;border-spacing:0;width:100%;font-variant-numeric:tabular-nums}.dap thead{display:table-header-group}.dap tr{page-break-inside:avoid;break-inside:avoid}'
    + '.dap th,.dap td{border-right:.75pt solid #555;border-bottom:.75pt solid #555;padding:3.5px 5px;vertical-align:top;text-align:left}'
    + '.dap tr>*:first-child{border-left:.75pt solid #555}.dap thead tr:first-child>*{border-top:.75pt solid #555}.dap table.hd tr:first-child>*{border-top:.75pt solid #555}'
    + '.dap th{background:#e6e6e6;font-size:7pt;font-weight:700;text-transform:uppercase;letter-spacing:.3px}'
    + '.dap table.hd{margin:10px 0 6px;font-size:8.5pt}.dap table.hd td.k{background:#f2f2f2;font-weight:700;width:15%;font-size:7.5pt;text-transform:uppercase;letter-spacing:.2px}'
    + '.dap .hint{font-size:7.5pt;margin:4px 0 6px;color:#333}'
    + '.dap table.ck td.c{text-align:center;width:28px;font-size:10pt;font-weight:700}.dap table.ck td.no{width:26px;text-align:center;font-weight:700}'
    + '.dap table.ck tr.sec td{background:#d9d9d9;font-weight:700;font-size:7.5pt;text-transform:uppercase;letter-spacing:.4px}'
    + '.dap table.ck td.ev{width:28%;font-size:7.5pt}.dap .crit{font-size:6.5pt;font-weight:800;text-transform:uppercase}.dap .jci{font-size:6.8pt;width:46px}'
    + '.dap table.sum{margin-top:8px;font-size:8.5pt}.dap table.sum td.k{background:#f2f2f2;font-weight:700;width:22%}.dap table.sum td.v{width:28%;font-weight:700}'
    + '.dap .res{font-size:11pt;font-weight:800}.dap .act{margin-top:5px;font-size:8pt}'
    + '.dap .signs{display:grid;grid-template-columns:repeat(3,1fr);gap:22px;margin-top:22px;font-size:8pt}.dap .signs div{border-top:.75pt solid #111;padding-top:4px;min-height:44px}.dap .signs span{display:block;font-size:6.8pt;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:#444}'
    + '.dap .end{margin-top:12px;padding-top:5px;border-top:.5pt solid #999;display:flex;justify-content:space-between;font-size:7pt;color:#555}.dap .cr{margin-top:4px;text-align:center;font-size:6.2pt;color:#888}'
    + '.dap h2{font-size:10pt;margin:14px 0 6px;text-transform:uppercase;letter-spacing:.5px}.dap td.n,.dap th.n{text-align:right}.dap tr.tot td{font-weight:800;background:#eee}.dap .off{font-weight:800;color:#c0182f}'
    + '.dap .note{font-size:7.5pt;color:#333;margin-top:6px}'
    + '.dap h2{break-after:avoid;page-break-after:avoid}.dap h3.sec{font-size:11.5pt;margin:18px 0 6px;padding-bottom:3px;border-bottom:1pt solid #111;break-after:avoid;page-break-after:avoid}'
    + '.dap table.kt{font-size:8pt}.dap table.kt td.d{min-width:120px}.dap .legend{font-size:7pt;color:#333;margin:4px 0 2px;line-height:1.45}.dap .none{font-size:7.5pt;color:#555;margin:3px 0 8px}'
    + '.dap table.kv{font-size:8.5pt;margin:6px 0}.dap table.kv td.k{background:#f2f2f2;font-weight:700;width:18%}'
    + '.dap .gb{height:7px;background:#e6e6e6;width:120px}.dap .gb i{display:block;height:100%;background:#555}.dap .gb i.c{background:#111}'
    + '.dap td.b95{background:#dff1e5}.dap td.b90{background:#eef7f1}.dap td.b80{background:#fff3d9}.dap td.blow{background:#fde4e8}.dap td small{display:block;font-size:6.5pt;color:#555;font-weight:400}'
    + '.dap table.rg{font-size:7.5pt}.dap .chip{font-size:6.5pt;font-weight:700;border:.5pt solid #555;padding:0 3px;border-radius:2px;white-space:nowrap}';
  const logo = () => '<img src="' + esc(location.origin + '/unico/logo.svg') + '" alt="UNICO Hospitals">';
  const letterhead = (kind, title, code) => '<header class="lh">' + logo() + '<div class="tt"><div class="kind">' + esc(kind) + '</div><h1>' + esc(title) + '</h1>' + (code ? '<div class="code">' + esc(code) + '</div>' : '') + '</div></header>';
  const footer = () => {
    const at = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Dhaka', dateStyle: 'medium', timeStyle: 'short' });
    return '<div class="end blk"><span>Printed by ' + esc(me() || '—') + ' on ' + esc(at) + ' from UNICO. Confidential — contains patient identifiers (policy 10).</span><span>Grading bands are an internal Unico scale, not an official JCI rating.</span></div><div class="cr">Automatically generated by the system · Developed by Nasif Ahammed Niloy</div>';
  };
  // Appendix A — one audit (or the blank form when `a` is null).
  function auditDoc(a, tool, opts) {
    const o = opts || {};
    const crit = a ? a.criteria : DA.freezeCriteria(tool);
    const ans = (a && a.answers) || {}, ev = (a && a.evidence) || {};
    const r = a ? a.result : null;
    const tick = (c, k) => (ans[c.id] === k ? '✓' : '');
    const secs = (tool.sections || []).map((s) => ({ s, items: crit.filter((c) => c.sectionId === s.id) })).filter((x) => x.items.length);
    const rows = secs.map(({ s, items }) => '<tr class="sec"><td colspan="8">Section ' + esc(s.id) + ': ' + esc(s.title) + (s.jci ? ' (JCI: ' + esc(s.jci) + ')' : '') + '</td></tr>'
      + items.map((c) => '<tr><td class="no">' + c.no + '</td><td>' + esc(c.text) + '</td><td class="jci">' + esc((c.jci || []).join(', ')) + '</td><td class="crit">' + (c.critical ? 'Critical' : '') + '</td><td class="c">' + tick(c, 'Y') + '</td><td class="c">' + tick(c, 'N') + '</td><td class="c">' + tick(c, 'NA') + '</td><td class="ev">' + esc(ev[c.id] || '') + '</td></tr>').join('')).join('');
    const H = tool.header || {};
    const v = (x) => (a ? esc(x || '—') : x ? esc(x) : '&nbsp;');   // a blank form keeps only what was pre-filled
    const extra = (H.extra || []).map((f) => [f.label, f.type === 'aldrete'
      ? (a ? DA.aldreteText((a.extra || {})[f.id], true) : 'A__ R__ C__ Co__ O__ = ___/10 (≥ 9 = discharge)')
      : (a ? (a.extra || {})[f.id] : '')]);
    const pairs = [['Department', a ? a.deptName : o.deptName], ['Audit date / shift', a && (DA.fmtDate(a.date) + (a.shift ? ' · ' + a.shift : ''))], ['Patient UHID / MRN', a && a.uhid],
      [DA.nursesOf(a).length > 1 ? 'Nurses audited' : 'Nurse auditee', a && DA.nursesOf(a).map((n) => n.name + (n.empId ? ' (ID ' + n.empId + ')' : '') + otherText(n)).join(', ')], ['Auditor', a && a.auditor && a.auditor.name], [H.bedLabel || 'Ward / bed no.', a && a.bed],
      [H.areaLabel || 'Area', a && a.area]].concat(extra);
    while (pairs.length % 2) pairs.push(['', '']);
    let hd = '';
    for (let i = 0; i < pairs.length; i += 2) hd += '<tr><td class="k">' + esc(pairs[i][0]) + '</td><td>' + v(pairs[i][1]) + '</td><td class="k">' + esc(pairs[i + 1][0]) + '</td><td>' + (pairs[i + 1][0] ? v(pairs[i + 1][1]) : '') + '</td></tr>';
    const byId = {}; crit.forEach((c) => { byId[c.id] = c; });
    const sum = '<table class="sum blk"><tr><td class="k">Total \'Yes\' (A)</td><td class="v">' + (r ? r.yes : '') + '</td><td class="k">Score % = A ÷ (A + B) × 100</td><td class="v">' + (r && r.pct != null ? r.pct + '%' : '') + '</td></tr>'
      + '<tr><td class="k">Total \'No\' (B)</td><td class="v">' + (r ? r.no : '') + '</td><td class="k">Critical criteria marked \'No\'</td><td class="v">' + (r ? (r.criticalFails.map((id) => '#' + (byId[id] ? byId[id].no : id)).join(', ') || 'None') : '') + '</td></tr>'
      + '<tr><td class="k">Total \'N/A\'</td><td class="v">' + (r ? r.na : '') + '</td><td class="k">Grade</td><td class="v">' + (r ? esc(r.gradeLabel) : 'Excellent / Good / Needs improvement / Unsatisfactory') + '</td></tr>'
      + '<tr><td class="k">Applicable (A + B)</td><td class="v">' + (r ? r.applicable : '') + '</td><td class="k">Result</td><td class="v res">' + (r ? r.result : 'PASS / FAIL') + '</td></tr></table>'
      + (r && r.action ? '<div class="act blk"><b>Required action:</b> ' + esc(r.action) + '</div>' : '')
      + (a && a.remarks ? '<div class="act blk"><b>Remarks / feedback:</b> ' + esc(a.remarks) + '</div>' : '');
    const signs = '<div class="signs blk"><div><span>Auditor</span>' + (a ? esc(a.auditor.name) + '<br>' + esc(when(a.completedAt || a.createdAt)) : 'Signature: ______________<br>Date / time: ____________') + '</div>'
      + '<div><span>Auditee nurse' + (a && DA.nursesOf(a).length > 1 ? 's' : '') + ' (acknowledgement)</span>' + (a && DA.nursesOf(a).length ? DA.nursesOf(a).map((n) => { const k = DA.acksOf(a)[DA.nurseKey(n)]; return esc(n.name) + (k ? ' · ' + esc(when(k.at)) + (k.method === 'account' ? ' · own account' : ' · in person') : ' · ____________'); }).join('<br>') : 'Signature: ______________<br>Date / time: ____________') + '</div>'
      + '<div><span>Nurse In-charge (published)</span>' + (a && a.signoff ? 'Published by ' + esc(a.signoff.name) + '<br>' + esc(when(a.signoff.at)) : 'Signature: ______________<br>Date / time: ____________') + '</div></div>';
    const body = letterhead('Nursing Quality & Patient Safety', tool.name, [tool.code, tool.version && 'Version ' + tool.version, a && a.toolRevision > 1 ? 'tool revision ' + a.toolRevision : ''].filter(Boolean).join(' · '))
      + '<table class="hd">' + hd + '</table>'
      + '<div class="hint">Mark ✓ in one box per criterion. Write evidence for a \'No\' where useful. Items marked Critical: any \'No\' = audit FAIL. N/A is excluded from scoring.</div>'
      + '<table class="ck"><thead><tr><th>No.</th><th>Compliance criterion</th><th>JCI</th><th>Critical</th><th>Yes</th><th>No</th><th>N/A</th><th>Evidence / remarks</th></tr></thead><tbody>' + rows + '</tbody></table>'
      + sum + signs + footer();
    const title = a ? 'Documentation audit — ' + DA.nurseNames(a) + ' — ' + a.date : tool.name + ' (blank form)';
    return { body, title, file: a ? 'Documentation-Audit_' + a.deptName.replace(/\W+/g, '-') + '_' + a.date : 'Documentation-Audit-form_' + (tool.short || tool.id).replace(/\W+/g, '-') };
  }
  /* ---------------- reports (Appendix C) ----------------
     periodLabel: "November 2026" · "Sep – Nov 2026" · "Year 2026". */
  function periodLabel(months) {
    const m = months || [];
    if (!m.length) return '';
    if (m.length === 1) return DA.fmtMonth(m[0]);
    if (m.length === 12 && m[0].slice(5) === '01' && m[11].slice(5) === '12' && m[0].slice(0, 4) === m[11].slice(0, 4)) return 'Year ' + m[0].slice(0, 4);
    const a = DA.fmtMonth(m[0]), b = DA.fmtMonth(m[m.length - 1]);
    return a.slice(-4) === b.slice(-4) ? a.slice(0, 3) + ' – ' + b : a + ' – ' + b;
  }
  const toolsIn = (data) => data.tools.filter((t) => data.rows.some((r) => r.toolId === t.id && r.total.records > 0));
  const codesOf = (tools) => tools.map((t) => [t.code, t.version ? 'v' + t.version : ''].filter(Boolean).join(' ')).filter(Boolean).join(' · ');
  const kv = (k, n) => (!n || k.value == null ? '—' : k.met === false ? '<span class="off">' + k.value + '% ▼</span>' : k.value + '%');
  // One tool's KPI table: only the departments that audited; the others named in one line; a KPI legend.
  function kpiSection(data, t, n) {
    const rows = data.rows.filter((r) => r.toolId === t.id);
    const audited = rows.filter((r) => r.total.records > 0), idle = rows.filter((r) => !r.total.records);
    const h = data.hospital[t.id];
    return '<h2>' + (n ? n + ' ' : '') + esc(t.name) + (t.code ? ' · ' + esc(t.code) + (t.version ? ' v' + esc(t.version) : '') : '') + '</h2>'
      + '<table class="kt"><thead><tr><th>Department</th><th class="n">Records</th><th class="n">Nurses</th>' + t.kpis.map((k) => '<th class="n">' + esc(k.name) + '<br>' + (k.direction === 'lower' ? '≤ ' : '≥ ') + k.target + '%</th>').join('') + '<th>Top 3 failing criteria</th></tr></thead><tbody>'
      + audited.map((r) => '<tr><td class="d">' + esc(r.name) + (r.caps.length ? ' <span class="chip">CAP due</span>' : '') + (r.minRecords && r.total.records < r.minRecords * data.months.length ? '<br><small>' + r.total.records + ' of min ' + r.minRecords * data.months.length + '</small>' : '') + '</td><td class="n">' + r.total.records + '</td><td class="n">' + r.total.nurses + '</td>'
        + r.total.kpis.map((k) => '<td class="n">' + kv(k, r.total.records) + '</td>').join('') + '<td>' + esc(r.total.topFailing.map((g) => '#' + g.no + ' ×' + g.count + (g.critical ? ' (C)' : '')).join(', ') || '—') + '</td></tr>').join('')
      + (h ? '<tr class="tot"><td>HOSPITAL TOTAL</td><td class="n">' + h.total.records + '</td><td class="n">' + h.total.nurses + '</td>' + h.total.kpis.map((k) => '<td class="n">' + kv(k, h.total.records) + '</td>').join('') + '<td>' + esc(h.total.topFailing.map((g) => '#' + g.no + ' ×' + g.count).join(', ')) + '</td></tr>' : '')
      + '</tbody></table>'
      + (idle.length ? '<div class="none blk"><b>No audits in this period:</b> ' + esc(idle.map((r) => r.name).join(', ')) + '</div>' : '')
      + '<div class="legend blk">' + t.kpis.map((k) => '<b>' + esc(k.name) + '</b> = ' + esc(DA.KPI_FORMULA_LABEL[k.formula] || '') + (k.criteria && k.criteria.length ? ' (criteria ' + k.criteria.map((c) => '#' + c.replace('c', '')).join(', ') + ')' : '')).join(' · ') + ' · <span class="off">red ▼</span> = below target · (C) = critical criterion.</div>';
  }
  const summaryTable = (data, extra) => {
    const ov = data.overall.total;
    const pct = (a, b) => (b ? DA.round1(a / b * 100) + '%' : '—');
    const caps = data.rows.filter((r) => r.caps.length).map((r) => r.name);
    const pub = extra ? extra.audits.filter((x) => x.status === 'signed').length : null;
    return '<table class="kv blk"><tr><td class="k">Reporting period</td><td>' + esc(periodLabel(data.months)) + '</td><td class="k">Departments audited</td><td>' + data.rows.filter((r) => r.total.records).length + ' of ' + data.rows.length + '</td></tr>'
      + '<tr><td class="k">Records audited</td><td>' + ov.records + ' · ' + ov.nurses + ' nurse(s)</td><td class="k">Documentation accuracy (all tools)</td><td><b>' + (ov.accuracy == null ? '—' : ov.accuracy + '%') + '</b> (target ≥ 90%)</td></tr>'
      + '<tr><td class="k">Critical failure rate</td><td>' + pct(ov.criticalRecords, ov.records) + ' · ' + ov.criticalRecords + ' record(s) (target ≤ 5%)</td><td class="k">Action plans due</td><td>' + (caps.length ? esc(caps.join(', ')) : 'None') + '</td></tr>'
      + (extra ? '<tr><td class="k">Published to nurses</td><td>' + pub + ' of ' + extra.audits.length + '</td><td class="k"></td><td></td></tr>' : '')
      + '</table>';
  };
  const signBlock = () => { const sig = sigNames(); return '<div class="signs blk"><div><span>Prepared by</span>' + esc(sig.prepared || '') + '</div><div><span>Reviewed by (Nursing Quality Committee)</span>' + esc(sig.reviewed || '') + '</div><div><span>Approved by (Chief Executive Officer, CEO)</span>' + esc(sig.approved || '') + '</div></div>'; };
  const reportHead = (data, kind) => { const tools = toolsIn(data); return letterhead('Nursing Quality & Patient Safety', 'Nursing Documentation KPI Audit' + (kind ? ' — ' + kind : '') + ' — ' + periodLabel(data.months), (codesOf(tools) || 'Nursing Documentation KPI Audit') + ' · Appendix C' + (data.deptName ? ' · ' + data.deptName : '')); };

  // The department KPI report of a period (Appendix C), one table per tool.
  function reportDoc(data) {
    const tools = toolsIn(data);
    const body = reportHead(data, '') + summaryTable(data)
      + (tools.length ? tools.map((t) => kpiSection(data, t)).join('') : '<p>No audit in this period.</p>')
      + '<p class="note blk">Results go to the Nursing Quality Committee by the 10th of the following month. A department below target for 2 consecutive months submits a corrective action plan (Appendix B) for its top 3 failing criteria.</p>'
      + signBlock() + footer();
    const label = periodLabel(data.months);
    return { body, title: 'Nursing Documentation KPI Audit — ' + label, file: 'Nursing-Documentation-KPI-Audit_' + label.replace(/\W+/g, '-') };
  }

  /* The COMPLETE report: summary, KPI tables, trend by month, criterion gaps, action plans due,
     results by nurse and the full audit register. `extra` = { nurses (breakdown by nurse), audits, more }. */
  function completeDoc(data, extra) {
    const tools = toolsIn(data);
    const label = periodLabel(data.months);
    let n = 0;
    const sec = (title) => '<h3 class="sec">' + (++n) + '. ' + esc(title) + '</h3>';
    const band = (v) => (v == null ? '' : v >= 95 ? 'b95' : v >= 90 ? 'b90' : v >= 80 ? 'b80' : 'blow');
    // 3. trend
    let trend;
    if (data.months.length < 2) trend = '<p class="note">One month only — choose a longer period (e.g. Last 3 months) for the trend.</p>';
    else {
      const audited = data.rows.filter((r) => r.total.records > 0);
      trend = '<table class="kt"><thead><tr><th>Department</th>' + data.months.map((m) => '<th class="n">' + esc(DA.fmtMonth(m)) + '</th>').join('') + '<th class="n">Period</th></tr></thead><tbody>'
        + audited.map((r) => '<tr><td class="d">' + esc(r.name) + '</td>' + data.months.map((m) => { const s2 = r.months[m]; return '<td class="n ' + band(s2.accuracy) + '">' + (s2.accuracy == null ? '·' : s2.accuracy + '%') + (s2.records ? '<small>' + s2.records + ' rec.</small>' : '') + '</td>'; }).join('')
          + '<td class="n ' + band(r.total.accuracy) + '"><b>' + (r.total.accuracy == null ? '—' : r.total.accuracy + '%') + '</b><small>' + r.total.records + ' rec.</small></td></tr>').join('')
        + '<tr class="tot"><td>ALL DEPARTMENTS</td>' + data.months.map((m) => { const s2 = data.overall.months[m]; return '<td class="n">' + (s2.accuracy == null ? '·' : s2.accuracy + '%') + '<small>' + s2.records + ' rec.</small></td>'; }).join('') + '<td class="n">' + (data.overall.total.accuracy == null ? '—' : data.overall.total.accuracy + '%') + '</td></tr></tbody></table>'
        + '<div class="legend">Documentation accuracy = Σ Yes ÷ Σ (Yes + No). Shading: ≥ 95% · ≥ 90% · ≥ 80% · below 80%.</div>';
    }
    // 4. criterion gaps per tool
    const gaps = tools.map((t) => {
      const h = data.hospital[t.id]; const gs = h ? h.total.gaps.slice(0, 10) : [];
      if (!gs.length) return '<h2>' + esc(t.name) + '</h2><p class="note">No criterion was marked \'No\'.</p>';
      const max = Math.max(1, ...gs.map((g) => g.count));
      return '<h2>' + esc(t.name) + '</h2><table class="kt"><thead><tr><th class="n">No.</th><th>Criterion</th><th>Critical</th><th class="n">Times \'No\'</th><th class="n">% of records</th><th></th></tr></thead><tbody>'
        + gs.map((g) => '<tr><td class="n"><b>' + g.no + '</b></td><td>' + esc(g.text) + '</td><td>' + (g.critical ? '<b>Critical</b>' : '') + '</td><td class="n">' + g.count + '</td><td class="n">' + (h.total.records ? DA.round1(g.count / h.total.records * 100) : 0) + '%</td><td><div class="gb"><i class="' + (g.critical ? 'c' : '') + '" style="width:' + Math.round(g.count / max * 100) + '%"></i></div></td></tr>').join('')
        + '</tbody></table>';
    }).join('');
    // 5. CAPs due
    const capRows = data.rows.filter((r) => r.caps.length);
    const toolKpi = (tid, id) => { const t = data.tools.find((x) => x.id === tid); const k = t && t.kpis.find((x) => x.id === id); return k ? k.name : id; };
    const caps = capRows.length ? '<table class="kt"><thead><tr><th>Department</th><th>Month</th><th>Below target two months running</th><th>Top failing criteria (period)</th></tr></thead><tbody>'
      + capRows.map((r) => r.caps.map((c) => '<tr><td class="d">' + esc(r.name) + '</td><td>' + esc(DA.fmtMonth(c.month)) + '</td><td>' + esc(c.kpis.map((id) => toolKpi(r.toolId, id)).join(', ')) + '</td><td>' + esc(r.total.topFailing.map((g) => '#' + g.no + ' ×' + g.count).join(', ')) + '</td></tr>').join('')).join('') + '</tbody></table>'
      : '<p class="note">No department was below target two months running in this period.</p>';
    // 6. by nurse
    const nurseRows = (extra.nurses || []);
    const otherOf = (staffId) => { const hit = extra.audits.map((x) => DA.nursesOf(x).find((y) => String(y.staffId) === String(staffId) && y.fromOtherDept)).find(Boolean); return hit ? (hit.homeDept || 'other dept') + ' · ' + (hit.assignment || 'Deployed') : ''; };
    const nurses = nurseRows.length ? '<table class="kt"><thead><tr><th>#</th><th>Nurse</th><th>ID · designation</th><th class="n">Records</th><th class="n">Accuracy</th><th class="n">Critical</th><th>Top failing</th></tr></thead><tbody>'
      + nurseRows.map((b, i) => { const s2 = b.summary; const o = b.staffId ? otherOf(b.staffId) : '';
        return '<tr><td class="n">' + (i + 1) + '</td><td><b>' + esc(b.label) + '</b>' + (o ? '<br><small>from ' + esc(o) + '</small>' : '') + '</td><td>' + esc(b.sub || '') + '</td><td class="n">' + s2.records + '</td><td class="n ' + band(s2.accuracy) + '">' + (s2.accuracy == null ? '—' : s2.accuracy + '%') + '</td><td class="n">' + (s2.criticalRecords || '') + '</td><td>' + esc(s2.topFailing.map((g) => '#' + g.no + ' ×' + g.count).join(', ')) + '</td></tr>'; }).join('')
      + '</tbody></table><div class="legend">A shared record counts under each of its nurses.</div>' : '<p class="note">No nurse audited.</p>';
    // 7. register
    const audits = extra.audits.slice().sort((x, y) => (x.date || '').localeCompare(y.date || '') || String(x.deptName).localeCompare(String(y.deptName)));
    const register = audits.length ? '<table class="kt rg"><thead><tr><th>#</th><th>Date</th><th>Department / area</th><th>UHID</th><th>Nurse(s)</th><th>Auditor</th><th class="n">Y/N/NA</th><th class="n">Score</th><th>Grade</th><th>Result</th><th>Status</th></tr></thead><tbody>'
      + audits.map((x, i) => { const r = x.result || {};
        return '<tr><td class="n">' + (i + 1) + '</td><td>' + esc(DA.fmtDate(x.date)) + (x.shift ? '<small>' + esc(x.shift) + '</small>' : '') + '</td><td>' + esc(x.deptName) + (x.area ? '<small>' + esc(x.area) + '</small>' : '') + '</td><td>' + esc(x.uhid || '') + '</td><td>'
          + DA.nursesOf(x).map((y) => esc(y.name) + (y.empId ? ' (' + esc(y.empId) + ')' : '') + (y.fromOtherDept ? ' <span class="chip">other dept</span>' : '')).join('<br>') + '</td><td>' + esc((x.auditor && x.auditor.name) || '') + '</td><td class="n">' + (r.yes != null ? r.yes + '/' + r.no + '/' + r.na : '') + '</td><td class="n"><b>' + (r.pct == null ? '—' : r.pct + '%') + '</b></td><td>' + esc(r.gradeLabel || '') + ((r.criticalFails || []).length ? '<small>' + r.criticalFails.length + ' critical</small>' : '') + '</td><td><b>' + esc(r.result || '') + '</b></td><td>' + esc(DA.STATUS_LABEL[x.status] || x.status) + '</td></tr>'; }).join('')
      + '</tbody></table>' + (extra.more ? '<p class="note">Only the newest 500 audits are listed — choose a shorter period for the full register.</p>' : '') : '<p class="note">No audit in this period.</p>';

    const body = reportHead(data, 'Complete Report')
      + sec('Summary') + summaryTable(data, extra)
      + sec('Department KPI report') + (tools.length ? tools.map((t) => kpiSection(data, t)).join('') : '<p class="note">No audit in this period.</p>')
      + sec('Trend by month') + trend
      + sec('Criterion gap analysis — the criteria most often marked \'No\'') + (gaps || '<p class="note">No audit in this period.</p>')
      + sec('Corrective action plans due') + caps
      + sec('Results by nurse') + nurses
      + sec('Audit register') + register
      + '<p class="note blk">Grades: ≥ 95% Excellent · 90–94.9% Good · 80–89.9% Needs improvement · < 80% Unsatisfactory. PASS = ≥ 90% and no critical criterion marked \'No\'. N/A is excluded from scoring.</p>'
      + signBlock() + footer();
    return { body, title: 'Nursing Documentation KPI Audit — complete report — ' + label, file: 'Nursing-Documentation-KPI-Audit-complete-report_' + label.replace(/\W+/g, '-') };
  }
  async function openPrint(log, doc, landscape) {
    const w = window.open('', '_blank');   // inside the click (pop-up blockers); filled once the server has logged it
    try {
      await post('/api/doc-audit/print', log);
      if (!w) { toast('Allow pop-ups for this site to print.', 'error'); return; }
      w.document.open();
      w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' + esc(doc.title) + '</title><style>@page{size:A4 ' + (landscape ? 'landscape' : 'portrait') + ';margin:11mm}html{-webkit-print-color-adjust:exact;print-color-adjust:exact}body{margin:0;padding:14px}@media print{body{padding:0}}' + PRINT_CSS + '</style></head><body><div class="dap">' + doc.body + '</div><script>window.onload=function(){setTimeout(function(){window.print();},200);};<\/script></body></html>');
      w.document.close();
    } catch (e) { if (w) w.close(); toast(e.message, 'error'); }
  }
  // The same sheet as a downloaded PDF: rendered off-screen, cut into A4 pages at row boundaries.
  // The same sheet(s) as a downloaded PDF: rendered off-screen, cut into A4 pages at row boundaries.
  // `doc.parts` (bulk) = several sheets, each starting on a new page.
  async function pdfFrom(log, doc, landscape) {
    await post('/api/doc-audit/print', Object.assign({}, log, { pdf: true }));
    if (window.unicoLoadPdfLibs && !(window.jspdf && window.html2canvas)) await window.unicoLoadPdfLibs();
    const J = window.jspdf && window.jspdf.jsPDF, H = window.html2canvas;
    if (!J || !H) throw new Error('The PDF tools could not load. Use Print and choose “Save as PDF”.');
    const mmW = landscape ? 297 : 210, mmH = landscape ? 210 : 297, M = 10;
    const pxW = landscape ? 1123 : 794;
    const pxPerMm = pxW / (mmW - 2 * M);
    const pageH = (mmH - 2 * M - 6) * pxPerMm;
    const pdf = new J({ orientation: landscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4', compress: true });
    let pageNo = 0;
    for (const body of (doc.parts || [doc.body])) {
      const host = document.createElement('div');
      host.style.cssText = 'position:fixed;left:-30000px;top:0;width:' + pxW + 'px;background:#fff;z-index:-1';
      host.innerHTML = '<style>' + PRINT_CSS + '</style><div class="dap" style="width:' + pxW + 'px;padding:0 4px">' + body + '</div>';
      document.body.appendChild(host);
      try {
        await Promise.all([...host.querySelectorAll('img')].map((im) => (im.complete ? 0 : new Promise((r) => { im.onload = im.onerror = r; }))));
        const root = host.querySelector('.dap');
        const scale = 2;
        const canvas = await H(root, { scale, backgroundColor: '#ffffff', useCORS: true, logging: false, windowWidth: pxW });
        const top0 = root.getBoundingClientRect().top;
        const cuts = [...root.querySelectorAll('tr, .blk')].map((el) => el.getBoundingClientRect().bottom - top0).sort((x, y) => x - y);
        const total = root.scrollHeight;
        let start = 0, guard = 0;
        while (start < total - 2 && guard++ < 60) {
          const limit = start + pageH;
          const end = total <= limit ? total : (cuts.filter((c) => c > start + 60 && c <= limit).pop() || limit);
          const c = document.createElement('canvas'); c.width = canvas.width; c.height = Math.max(1, Math.ceil((end - start) * scale));
          c.getContext('2d').drawImage(canvas, 0, start * scale, canvas.width, (end - start) * scale, 0, 0, canvas.width, (end - start) * scale);
          if (pageNo) pdf.addPage();
          pageNo++;
          pdf.addImage(c.toDataURL('image/jpeg', 0.92), 'JPEG', M, M, mmW - 2 * M, (end - start) / pxPerMm);
          start = end;
        }
      } finally { host.remove(); }
    }
    for (let i = 1; i <= pageNo; i++) { pdf.setPage(i); pdf.setFontSize(7); pdf.setTextColor(120); pdf.text('Page ' + i + ' of ' + pageNo, mmW - M, mmH - 5, { align: 'right' }); }
    pdf.setProperties({ title: doc.title, author: me() });
    pdf.save(doc.file + '.pdf');
    toast('PDF downloaded.', 'success');
  }
  // The OFFLINE paper form: `copies` blank forms of the tool, the department filled in.
  function blankDoc(tool, deptName, copies) {
    const n = Math.max(1, Math.min(30, +copies || 1));
    const one = auditDoc(null, tool, { deptName }).body;
    const parts = Array.from({ length: n }, () => one);
    return { parts, body: parts.join('<div style="page-break-before:always;break-before:page"></div>'), title: (tool.short || tool.name) + ' — blank form' + (deptName ? ' — ' + deptName : ''),
      file: 'Documentation-Audit-form_' + String(tool.short || tool.id || 'tool').replace(/\W+/g, '-') + (deptName ? '_' + deptName.replace(/\W+/g, '-') : '') + (n > 1 ? '_x' + n : '') };
  }
  // Several audits in one printout / PDF (the Register's bulk), each on its own pages.
  function bulkDoc(audits, meta) {
    const parts = audits.map((a) => auditDoc(a, toolOf(meta, a.toolId) || { name: a.toolName || 'Documentation audit', code: a.toolCode, sections: [...new Map(a.criteria.map((c) => [c.sectionId, { id: c.sectionId, title: c.section || c.sectionId }])).values()], header: {} }).body);
    return { parts, body: parts.join('<div style="page-break-before:always;break-before:page"></div>'), title: audits.length + ' documentation audits', file: 'Documentation-Audits_' + audits.length + '_' + new Date().toISOString().slice(0, 10) };
  }
  const printAudit = (a, tool) => openPrint(a ? { kind: 'audit', id: a.id } : { kind: 'blank' }, auditDoc(a, tool), false);
  const pdfAudit = (a, tool) => pdfFrom({ kind: 'audit', id: a.id }, auditDoc(a, tool), false);
  const printReport = (data) => openPrint({ kind: 'report', from: data.months[0], to: data.months[data.months.length - 1] }, reportDoc(data), true);
  const pdfReport = (data) => pdfFrom({ kind: 'report', from: data.months[0], to: data.months[data.months.length - 1] }, reportDoc(data), true);
  // The complete report needs the nurse breakdown and the audit list too: fetched, then printed.
  async function completeReport(data, dept, pdf) {
    const from = data.months[0], to = data.months[data.months.length - 1];
    const q = 'from=' + from + '&to=' + to + (dept ? '&dept=' + encodeURIComponent(dept) : '');
    const log = { kind: 'report', complete: true, from, to, dept: dept || undefined };
    const w = pdf ? null : window.open('', '_blank');   // inside the click: pop-up blockers
    try {
      const [s2, a2] = await Promise.all([api('/api/doc-audit/summary?' + q + '&by=nurse'), api('/api/doc-audit/audits?from=' + from + '-01&to=' + to + '-31' + (dept ? '&dept=' + encodeURIComponent(dept) : ''))]);
      const extra = { nurses: s2.breakdown || [], audits: (a2.audits || []).filter((x) => x.status !== 'draft'), more: !!a2.more };
      const doc = completeDoc(Object.assign({}, data, { deptName: dept ? ((data.rows.find((r) => r.deptId === dept) || {}).name || '') : '' }), extra);
      if (pdf) return pdfFrom(log, doc, true);
      await post('/api/doc-audit/print', log);
      if (!w) { toast('Allow pop-ups for this site to print.', 'error'); return; }
      w.document.open();
      w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' + esc(doc.title) + '</title><style>@page{size:A4 landscape;margin:11mm}html{-webkit-print-color-adjust:exact;print-color-adjust:exact}body{margin:0;padding:14px}@media print{body{padding:0}}' + PRINT_CSS + '</style></head><body><div class="dap">' + doc.body + '</div><script>window.onload=function(){setTimeout(function(){window.print();},250);};<\/script></body></html>');
      w.document.close();
    } catch (e) { if (w) w.close(); toast(e.message, 'error'); }
  }

  /* ============================================================ the shell === */
  function DocAuditView({ view, audit, dept, nurse, setRoute }) {
    useStyles();
    const [meta, err, reload] = useMeta();
    const isAdmin = !window.unicoUserPerms || window.unicoUserPerms() === null;
    if (err) return <div className="da-banner red">{err}</div>;
    if (!meta) return <div className="da-card da-empty">Loading Nursing Documentation KPI Audit…</div>;
    if (view === 'docAuditNew') {
      if (!audit && !meta.canAdd) return <div className="da-card da-empty">Filling audits needs the Nursing Documentation KPI Audit “Add” permission. Ask the administrator.</div>;
      return <AuditForm key={audit || 'new:' + (dept || '')} meta={meta} auditId={audit} initialDept={dept} setRoute={setRoute} />;
    }
    if (view === 'docAuditRegister') return <Register key={nurse || ''} meta={meta} nurse={nurse} setRoute={setRoute} />;
    if (view === 'docAuditReports') return <Reports meta={meta} setRoute={setRoute} />;
    if (view === 'docAuditTools') return isAdmin ? <Tools meta={meta} reloadMeta={reload} /> : <div className="da-card da-empty">Only an administrator can change the audit tools.</div>;
    if (view === 'docAuditSettings') return isAdmin ? <Settings meta={meta} reloadMeta={reload} setRoute={setRoute} /> : <div className="da-card da-empty">Only an administrator can change Nursing Documentation KPI Audit settings.</div>;
    return <Home meta={meta} setRoute={setRoute} />;
  }
  window.DocAuditView = DocAuditView;
})();
