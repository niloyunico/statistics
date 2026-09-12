/* DC runtime — the few helpers the design-converted views need (window.DC).
 *
 * The Nurse App and Admin App views (nurse-app-view.jsx / admin-app-view.jsx) are
 * generated from the Claude Design templates by scripts/dc-to-jsx.js. They render a
 * flat view-model exactly the way the design runtime did, so they only need:
 *
 *   S(css)          inline CSS text -> a React style object (memoised; the logic
 *                   modules build styles as strings, like the design did)
 *   ix(value)       text interpolation: null/boolean render nothing, elements pass
 *   vx(value, d)    controlled-input value: undefined -> '' (or the default given)
 *   AndroidDevice   the phone: a bezelled 412x892 frame on a desktop/tablet, the whole
 *                   viewport on an actual phone
 *   api(path, opts) same-origin JSON fetch that carries the session cookie
 *   mount(App)      render an app into #root and inject its CSS once
 */
(function () {
  'use strict';
  const React = window.React;
  const ReactDOM = window.ReactDOM;
  const { useState, useEffect } = React;

  /* ---------------------------------------------------------------- styles --- */
  const kebabToCamel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  function cssToObj(css) {
    const o = {};
    for (const decl of String(css).split(';')) {
      const i = decl.indexOf(':');
      if (i < 0) continue;
      const prop = decl.slice(0, i).trim();
      if (!prop) continue;
      o[prop.startsWith('--') ? prop : kebabToCamel(prop)] = decl.slice(i + 1).trim();
    }
    return o;
  }
  const styleCache = new Map();
  function S(v) {
    if (v == null || v === '') return undefined;
    if (typeof v === 'object') return v;
    let o = styleCache.get(v);
    if (!o) {
      if (styleCache.size > 8000) styleCache.clear();
      o = cssToObj(v);
      styleCache.set(v, o);
    }
    return o;
  }
  function ix(v) {
    if (v === undefined || v === null || typeof v === 'boolean') return null;
    if (React.isValidElement(v) || Array.isArray(v)) return v;
    return String(v);
  }
  function vx(v, d) { return (v === undefined || v === null) ? (d === undefined ? '' : d) : v; }

  /* ----------------------------------------------------------------- phone --- */
  // "Phone" = a viewport that is itself phone-sized: then the app IS the screen.
  // Anything wider gets the design's Material device frame so the layout the
  // design was reviewed at (412 x 892) is exactly what is shown.
  const PHONE_MQ = '(max-width: 560px), (max-height: 720px) and (max-width: 900px)';
  function usePhone() {
    const get = () => !!(window.matchMedia && window.matchMedia(PHONE_MQ).matches);
    const [phone, setPhone] = useState(get);
    useEffect(() => {
      if (!window.matchMedia) return undefined;
      const mq = window.matchMedia(PHONE_MQ);
      const on = () => setPhone(mq.matches);
      if (mq.addEventListener) mq.addEventListener('change', on); else mq.addListener(on);
      return () => { if (mq.removeEventListener) mq.removeEventListener('change', on); else mq.removeListener(on); };
    }, []);
    return phone;
  }
  function useClock() {
    const fmt = () => { const d = new Date(); return d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0'); };
    const [t, setT] = useState(fmt);
    useEffect(() => { const id = setInterval(() => setT(fmt()), 15000); return () => clearInterval(id); }, []);
    return t;
  }
  const FRAME = {
    surface: '#f4fbf8', onSurface: '#171d1b', border: 'rgba(116,119,117,0.5)',
  };
  function StatusBar() {
    const t = useClock();
    const c = FRAME.onSurface;
    return (
      <div style={{ height: 40, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', position: 'relative', fontFamily: 'Roboto, system-ui, sans-serif', flexShrink: 0 }}>
        <div style={{ width: 128, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 400, letterSpacing: 0.25, lineHeight: '20px', color: c }}>{t}</span>
        </div>
        <div style={{ position: 'absolute', left: '50%', top: 8, transform: 'translateX(-50%)', width: 24, height: 24, borderRadius: 100, background: '#2e2e2e' }} />
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ display: 'flex', paddingRight: 2 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" style={{ marginRight: -2 }}><path d="M8 13.3L.67 5.97a10.37 10.37 0 0114.66 0L8 13.3z" fill={c} /></svg>
            <svg width="16" height="16" viewBox="0 0 16 16" style={{ marginRight: -2 }}><path d="M14.67 14.67V1.33L1.33 14.67h13.34z" fill={c} /></svg>
          </div>
          <svg width="16" height="16" viewBox="0 0 16 16"><rect x="3.75" y="2" width="8.5" height="13" rx="1.5" fill={c} /><rect x="5.5" y="0.9" width="5" height="2" rx="0.5" fill={c} /></svg>
        </div>
      </div>
    );
  }
  function NavPill() {
    return (
      <div style={{ height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <div style={{ width: 108, height: 4, borderRadius: 2, background: FRAME.onSurface, opacity: 0.4 }} />
      </div>
    );
  }
  function AndroidDevice({ children }) {
    const phone = usePhone();
    if (phone) {
      // The screen is the phone: fill the viewport, respect the notch / home bar.
      return (
        <div className="dc-screen" style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: FRAME.surface, paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)', boxSizing: 'border-box' }}>
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>{children}</div>
        </div>
      );
    }
    return (
      <div className="dc-canvas" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', boxSizing: 'border-box' }}>
        <div className="dc-frame" style={{ width: 412, height: 892, maxHeight: 'calc(100vh - 32px)', borderRadius: 18, overflow: 'hidden', background: FRAME.surface, border: '8px solid ' + FRAME.border, boxShadow: '0 30px 80px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', flexShrink: 0 }}>
          <StatusBar />
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>{children}</div>
          <NavPill />
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------- api --- */
  // Same-origin JSON. The browser session cookie set by POST /api/login rides along
  // automatically, so every /api/* call is made as the signed-in user.
  async function api(path, opts) {
    const o = Object.assign({ method: 'GET' }, opts || {});
    const headers = Object.assign({ accept: 'application/json' }, o.headers || {});
    if (o.body !== undefined && typeof o.body !== 'string') { o.body = JSON.stringify(o.body); headers['content-type'] = 'application/json'; }
    const r = await fetch(path, Object.assign({}, o, { headers, credentials: 'same-origin' }));
    let j = null;
    try { j = await r.json(); } catch (e) { j = null; }
    if (!r.ok) {
      const err = new Error((j && j.error) || ('HTTP ' + r.status));
      err.status = r.status; err.body = j;
      throw err;
    }
    return j || { ok: true };
  }
  // A read that must never break a screen: resolve null on any failure.
  const tryApi = (path, opts) => api(path, opts).catch(() => null);

  /* ----------------------------------------------------------------- mount --- */
  function injectCSS(id, css) {
    if (!css || document.getElementById(id)) return;
    const el = document.createElement('style');
    el.id = id; el.textContent = css;
    document.head.appendChild(el);
  }
  function mount(App, css) {
    injectCSS('dc-view-css', css || '');
    const root = document.getElementById('root');
    const el = React.createElement(App);
    if (ReactDOM.createRoot) ReactDOM.createRoot(root).render(el); else ReactDOM.render(el, root);
  }

  window.DC = { S, ix, vx, cssToObj, AndroidDevice, usePhone, api, tryApi, injectCSS, mount };
})();
