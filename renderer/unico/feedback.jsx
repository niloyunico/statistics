/* UNICO — global feedback system: toast notifications + promise-based confirm dialogs.
   Self-mounts on load. Exposes window.UI = { toast, confirm } and window.toast.
   Callable imperatively from anywhere (React or plain JS) — backed by dedicated
   ReactDOM roots appended to document.body, independent of the app's React tree. */
(function () {
  const { useState, useEffect, useRef, useCallback } = React;

  /* ---- type styling ---------------------------------------------------- */
  /* Icons: reuse window.I for check/x; info & warn aren't in the map, so we
     supply small inline SVG paths and render them through <Ic d=…/>. */
  const PATH_INFO = 'M12 2a10 10 0 100 20 10 10 0 000-20M12 11v5M12 7.5v.01';
  const PATH_WARN = 'M12 3l9.5 16.5H2.5zM12 10v4M12 17.5v.01';

  const TYPES = {
    success: { fg: 'var(--green)',  bg: '#e7f6ed', bd: '#bfe6cf', d: (window.I && window.I.check) || 'M4 12l5 5L20 6' },
    error:   { fg: 'var(--rose)',   bg: 'var(--neg-bg)', bd: '#f1c6cd', d: (window.I && window.I.x) || 'M6 6l12 12M18 6L6 18' },
    info:    { fg: 'var(--blue)',   bg: 'var(--blue-50)', bd: 'var(--blue-100)', d: PATH_INFO },
    warn:    { fg: 'var(--amber)',  bg: '#fbf0dd', bd: '#f0d8a8', d: PATH_WARN },
  };
  const DEFAULT_DURATION = 3200;

  /* Inline icon — prefer the shared Ic component, but stay robust if ui.jsx
     loaded after us (it always loads first in index.html, but be safe). */
  function Icon({ d, s = 18, c = 'currentColor', sw = 2 }) {
    if (typeof window.Ic === 'function') return React.createElement(window.Ic, { d, s, c, sw });
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw}
        strokeLinecap="round" strokeLinejoin="round" className="ico">
        {d.split('M').filter(Boolean).map((seg, i) => <path key={i} d={'M' + seg} />)}
      </svg>
    );
  }

  /* ---- toast store (external, framework-agnostic) ---------------------- */
  let toastSeq = 0;
  const toastListeners = new Set();
  let toastState = [];
  function emitToasts() { toastListeners.forEach(fn => { try { fn(toastState); } catch (e) {} }); }

  function addToast(message, type, opts) {
    opts = opts || {};
    const t = (type && TYPES[type]) ? type : 'success';
    const id = ++toastSeq;
    const duration = (typeof opts.duration === 'number') ? opts.duration : DEFAULT_DURATION;
    toastState = toastState.concat([{ id, message: String(message == null ? '' : message), type: t, duration }]);
    emitToasts();
    return id;
  }
  function removeToast(id) {
    const before = toastState.length;
    toastState = toastState.filter(x => x.id !== id);
    if (toastState.length !== before) emitToasts();
  }

  function ToastItem({ t, onClose }) {
    const cfg = TYPES[t.type] || TYPES.success;
    const [leaving, setLeaving] = useState(false);
    const timerRef = useRef(null);

    const dismiss = useCallback(() => {
      if (leaving) return;
      setLeaving(true);
      // allow exit animation to play before removing from the store
      window.setTimeout(() => onClose(t.id), 200);
    }, [leaving, onClose, t.id]);

    useEffect(() => {
      if (t.duration > 0) {
        timerRef.current = window.setTimeout(dismiss, t.duration);
        return () => window.clearTimeout(timerRef.current);
      }
    }, [t.duration, dismiss]);

    return (
      <div
        className={'uni-toast' + (leaving ? ' leaving' : '')}
        role="status"
        style={{ '--tfg': cfg.fg, '--tbg': cfg.bg, '--tbd': cfg.bd }}
        onClick={dismiss}
        title="Dismiss"
      >
        <span className="uni-toast-ic"><Icon d={cfg.d} s={16} c={cfg.fg} sw={2.4} /></span>
        <span className="uni-toast-msg">{t.message}</span>
        <span className="uni-toast-x"><Icon d={(window.I && window.I.x) || 'M6 6l12 12M18 6L6 18'} s={13} c="var(--faint)" sw={2.2} /></span>
      </div>
    );
  }

  function ToastHost() {
    const [items, setItems] = useState(toastState);
    useEffect(() => {
      const fn = next => setItems(next);
      toastListeners.add(fn);
      fn(toastState);
      return () => { toastListeners.delete(fn); };
    }, []);
    return (
      <div className="uni-toast-stack">
        {items.map(t => <ToastItem key={t.id} t={t} onClose={removeToast} />)}
      </div>
    );
  }

  /* ---- confirm store (external, promise-based) ------------------------- */
  let confirmSeq = 0;
  const confirmListeners = new Set();
  let confirmQueue = []; // [{id, opts, resolve}]
  function emitConfirms() { confirmListeners.forEach(fn => { try { fn(confirmQueue); } catch (e) {} }); }

  function pushConfirm(opts) {
    return new Promise(resolve => {
      const id = ++confirmSeq;
      confirmQueue = confirmQueue.concat([{ id, opts: opts || {}, resolve }]);
      emitConfirms();
    });
  }
  function settleConfirm(id, value) {
    const entry = confirmQueue.find(c => c.id === id);
    confirmQueue = confirmQueue.filter(c => c.id !== id);
    emitConfirms();
    if (entry) { try { entry.resolve(value); } catch (e) {} }
  }

  function ConfirmDialog({ entry }) {
    const o = entry.opts || {};
    const danger = !!o.danger;
    const confirmLabel = o.confirmLabel || 'Confirm';
    const cancelLabel = o.cancelLabel || 'Cancel';
    const title = o.title || 'Are you sure?';
    const message = o.message || '';
    const btnRef = useRef(null);

    const cancel = useCallback(() => settleConfirm(entry.id, false), [entry.id]);
    const ok = useCallback(() => settleConfirm(entry.id, true), [entry.id]);

    useEffect(() => {
      const onKey = e => {
        if (e.key === 'Escape') { e.stopPropagation(); cancel(); }
        else if (e.key === 'Enter') { e.stopPropagation(); ok(); }
      };
      window.addEventListener('keydown', onKey, true);
      if (btnRef.current) { try { btnRef.current.focus(); } catch (e) {} }
      return () => window.removeEventListener('keydown', onKey, true);
    }, [cancel, ok]);

    const icPath = danger
      ? ((window.I && window.I.x) || 'M6 6l12 12M18 6L6 18')
      : ((window.I && window.I.bell) || PATH_INFO);

    return (
      <div className="modal-bg" onMouseDown={e => { if (e.target === e.currentTarget) cancel(); }}>
        <div className="modal" style={{ width: 'min(420px,92vw)' }}>
          <div style={{ padding: '22px 22px 18px' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                display: 'grid', placeItems: 'center',
                background: danger ? 'var(--neg-bg)' : 'var(--blue-50)',
                color: danger ? 'var(--rose)' : 'var(--blue)',
              }}>
                <Icon d={icPath} s={20} sw={2.4} c={danger ? 'var(--rose)' : 'var(--blue)'} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--ink)' }}>{title}</div>
                {message ? <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4, lineHeight: 1.5 }}>{message}</div> : null}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <span className="spacer" style={{ flex: 1 }} />
              <button className="btn" onClick={cancel}>{cancelLabel}</button>
              <button
                ref={btnRef}
                className="btn pri"
                style={danger ? { background: 'var(--rose)', borderColor: 'var(--rose)', boxShadow: 'none' } : undefined}
                onClick={ok}
              >{confirmLabel}</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function ConfirmHost() {
    const [queue, setQueue] = useState(confirmQueue);
    useEffect(() => {
      const fn = next => setQueue(next);
      confirmListeners.add(fn);
      fn(confirmQueue);
      return () => { confirmListeners.delete(fn); };
    }, []);
    // Render only the most recent confirm (stack-as-queue): one modal at a time.
    if (!queue.length) return null;
    const entry = queue[queue.length - 1];
    return <ConfirmDialog key={entry.id} entry={entry} />;
  }

  /* ---- mount dedicated roots on document.body -------------------------- */
  function mount() {
    if (!document.body) { window.addEventListener('DOMContentLoaded', mount, { once: true }); return; }
    if (window.__uniFeedbackMounted) return;
    window.__uniFeedbackMounted = true;

    const toastEl = document.createElement('div');
    toastEl.id = 'uni-toast-root';
    document.body.appendChild(toastEl);
    ReactDOM.createRoot(toastEl).render(<ToastHost />);

    const confirmEl = document.createElement('div');
    confirmEl.id = 'uni-confirm-root';
    document.body.appendChild(confirmEl);
    ReactDOM.createRoot(confirmEl).render(<ConfirmHost />);
  }
  mount();

  /* ---- public API ------------------------------------------------------ */
  const api = {
    toast: function (message, type, opts) { return addToast(message, type, opts); },
    confirm: function (opts) { return pushConfirm(opts); },
    dismiss: function (id) { removeToast(id); },
  };
  window.UI = Object.assign({}, window.UI, api);
  window.toast = window.UI.toast;
})();
