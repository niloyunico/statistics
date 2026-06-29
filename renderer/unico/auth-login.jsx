/* UNICO — cloud account login.
   Talks ONLY to the UNICO auth server's HTTP API (which holds the MongoDB
   connection). Exposes:
     window.unicoSession — server URL + token/session helper (localStorage)
     window.CloudLogin   — branded full-window login gate <CloudLogin onLogin={...}/>
   Global-script React app: no imports/exports. */
(function () {
  const API_KEY = 'unico_api_base', TOK_KEY = 'unico_session_token', USER_KEY = 'unico_session_user';
  const read = (k) => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
  const write = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { } };
  const trimBase = (u) => (u || '').trim().replace(/\/+$/, '');

  // Keys that are device/session-local and must NOT sync to the cloud.
  const DATA_EXCLUDE = ['unico_api_base', 'unico_session_token', 'unico_session_user', 'unico_lock_v1'];
  // Snapshot of all syncable app state (unico_* keys minus the device-local ones).
  function appSnapshot() {
    const o = {};
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf('unico') === 0 && DATA_EXCLUDE.indexOf(k) < 0) o[k] = localStorage.getItem(k); } } catch (e) { }
    return o;
  }

  const unicoSession = {
    serverUrl() { return trimBase(read(API_KEY)) || trimBase((typeof window !== 'undefined' && window.UNICO_DEFAULT_API) || ''); },
    setServerUrl(u) { write(API_KEY, trimBase(u)); },
    // Cloud login is a BUILD-TIME choice: it engages only when UNICO_DEFAULT_API is
    // set in config.js. Empty = no login, fully offline (ignores any saved URL).
    configured() { return !!trimBase((typeof window !== 'undefined' && window.UNICO_DEFAULT_API) || ''); },
    token() { return read(TOK_KEY); },
    user() { try { return JSON.parse(read(USER_KEY) || 'null'); } catch (e) { return null; } },
    isAuthed() { return !!unicoSession.token(); },
    async login(username, password) {
      const base = unicoSession.serverUrl();
      if (!base) return { ok: false, error: 'No server URL is configured.' };
      let r;
      try { r = await fetch(base + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username, password }) }); }
      catch (e) { return { ok: false, error: 'Cannot reach the server. Check the URL and your connection.' }; }
      let data; try { data = await r.json(); } catch (e) { data = {}; }
      if (!r.ok || !data.ok) return { ok: false, error: data.error || ('Login failed (' + r.status + ').') };
      write(TOK_KEY, data.token); write(USER_KEY, JSON.stringify(data.user || {}));
      return { ok: true, user: data.user };
    },
    // returns true=valid, false=invalid(expired), null=couldn't reach (stay logged in offline)
    async verify() {
      const base = unicoSession.serverUrl(), tok = unicoSession.token();
      if (!base || !tok) return false;
      try { const r = await fetch(base + '/api/me', { headers: { authorization: 'Bearer ' + tok } }); if (r.status === 401) return false; const d = await r.json(); return !!(r.ok && d.ok); }
      catch (e) { return null; }
    },
    // Pull the shared app state from the server into localStorage (cloud is source of truth).
    async pullData() {
      const base = unicoSession.serverUrl(), tok = unicoSession.token();
      if (!base || !tok) return { ok: false };
      try {
        const r = await fetch(base + '/api/data', { headers: { authorization: 'Bearer ' + tok } });
        const d = await r.json();
        if (r.ok && d.ok && d.data && typeof d.data === 'object') {
          let n = 0;
          Object.keys(d.data).forEach(k => { if (DATA_EXCLUDE.indexOf(k) < 0) { try { localStorage.setItem(k, d.data[k]); n++; } catch (e) { } } });
          return { ok: true, count: n, updatedAt: d.updatedAt };
        }
        return { ok: true, count: 0 };
      } catch (e) { return { ok: false, error: String(e) }; }
    },
    // Push this device's app state to the server (last-write-wins).
    async pushData() {
      const base = unicoSession.serverUrl(), tok = unicoSession.token();
      if (!base || !tok) return { ok: false };
      try {
        const r = await fetch(base + '/api/data', { method: 'PUT', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: JSON.stringify({ data: appSnapshot() }) });
        const d = await r.json();
        return { ok: !!(r.ok && d.ok), updatedAt: d.updatedAt };
      } catch (e) { return { ok: false, error: String(e) }; }
    },
    logout() { write(TOK_KEY, null); write(USER_KEY, null); try { window.dispatchEvent(new Event('unico:logout')); } catch (e) { } },
  };
  window.unicoSession = unicoSession;

  function CloudLogin({ onLogin }) {
    const [u, setU] = React.useState('');
    const [p, setP] = React.useState('');
    const [busy, setBusy] = React.useState(false);
    const [err, setErr] = React.useState('');
    const [cfgOpen, setCfgOpen] = React.useState(!unicoSession.serverUrl());
    const [srv, setSrv] = React.useState(unicoSession.serverUrl() || 'http://localhost:4000');
    const uRef = React.useRef(null);
    React.useEffect(() => { if (uRef.current) uRef.current.focus(); }, []);

    const submit = async (e) => {
      if (e && e.preventDefault) e.preventDefault();
      unicoSession.setServerUrl(srv);
      if (!srv.trim()) { setErr('Enter the server address first.'); setCfgOpen(true); return; }
      if (!u.trim() || !p) { setErr('Enter your username and password.'); return; }
      setBusy(true); setErr('');
      const res = await unicoSession.login(u.trim(), p);
      if (!res.ok) { setBusy(false); setErr(res.error || 'Login failed.'); return; }
      // Sync: pull the cloud's data; if the cloud is empty, seed it from this device.
      // Then reload so the app's stores hydrate from the (now-synced) local storage.
      const pulled = await unicoSession.pullData();
      if (!pulled || !pulled.count) { await unicoSession.pushData(); }
      try { window.location.reload(); } catch (e) { setBusy(false); onLogin && onLogin(res.user); }
    };

    return (
      <div style={S.gate}>
        <div style={S.bgGlow} />
        <form style={S.card} onSubmit={submit} className="anim-pop">
          <div style={{ marginBottom: 16 }}><img src="unico/logo.svg" alt="UNICO Healthcare" style={{ height: 38 }} /></div>
          <div style={S.badge}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 12a4 4 0 100-8 4 4 0 000 8z" /><path d="M4 21a8 8 0 0116 0" /></svg></div>
          <h1 style={S.title}>Sign in</h1>
          <p style={S.sub}>Log in to the UNICO Statistics Suite with your account.</p>

          <div style={S.grp}>
            <label style={S.label}>Username</label>
            <input ref={uRef} value={u} autoComplete="username" onChange={e => { setU(e.target.value); if (err) setErr(''); }} style={S.input} placeholder="your username" />
          </div>
          <div style={S.grp}>
            <label style={S.label}>Password</label>
            <input type="password" value={p} autoComplete="current-password" onChange={e => { setP(e.target.value); if (err) setErr(''); }} style={S.input} placeholder="••••••••" />
          </div>

          {err ? <div style={S.err}>{err}</div> : <div style={{ minHeight: 18, margin: '2px 0 8px' }} />}

          <button type="submit" className="btn pri" style={S.action} disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>

          <button type="button" onClick={() => setCfgOpen(o => !o)} style={S.cfgToggle}>{cfgOpen ? 'Hide server settings' : 'Server settings'}</button>
          {cfgOpen && (
            <div style={S.cfgBox}>
              <label style={{ ...S.label, color: '#9aa6b4' }}>Auth server address</label>
              <input value={srv} onChange={e => setSrv(e.target.value)} style={{ ...S.input, fontSize: 13, letterSpacing: 0, textAlign: 'left' }} placeholder="https://your-server.example.com" />
              <div style={{ fontSize: 10.5, color: '#7e8da0', marginTop: 6, lineHeight: 1.5 }}>Where your UNICO auth server is running. Set once per device. The database connection lives on that server — never in this app.</div>
            </div>
          )}
        </form>
        <div style={S.legal}>UNICO Healthcare · Statistics Suite · Secure account sign-in</div>
      </div>
    );
  }
  window.CloudLogin = CloudLogin;

  const S = {
    gate: { position: 'fixed', inset: 0, zIndex: 3000, background: '#0d1b2e', backgroundImage: 'radial-gradient(1100px 700px at 18% -10%, rgba(39,168,219,.16), transparent 60%), radial-gradient(900px 600px at 110% 120%, rgba(58,181,167,.14), transparent 55%)', display: 'grid', placeItems: 'center', padding: 24, overflow: 'auto' },
    bgGlow: { position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(180deg, rgba(13,27,46,0) 40%, rgba(13,27,46,.55) 100%)' },
    card: { position: 'relative', width: 'min(380px,94vw)', background: '#fff', border: '1px solid #e3e9f1', borderRadius: 18, padding: '30px 30px 22px', boxShadow: '0 24px 60px rgba(5,12,24,.55)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' },
    badge: { width: 52, height: 52, borderRadius: 14, display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg,#27a8db,#0072a3)', boxShadow: '0 8px 20px rgba(0,144,202,.45)', marginBottom: 14 },
    title: { margin: '0 0 6px', fontSize: 18, fontWeight: 700, color: '#16202e' },
    sub: { margin: '0 0 18px', fontSize: 12.5, lineHeight: 1.5, color: '#6c7a8c', maxWidth: 300 },
    grp: { width: '100%', display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 11, textAlign: 'left' },
    label: { fontSize: 11.5, fontWeight: 600, color: '#3c4858' },
    input: { width: '100%', padding: '11px 13px', border: '1px solid #dde3ec', borderRadius: 9, fontFamily: 'inherit', fontSize: 14, background: '#f7f9fc', color: '#16202e', outline: 'none', boxSizing: 'border-box' },
    err: { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 18, margin: '2px 0 8px', fontSize: 12, fontWeight: 600, color: '#b4232f', background: 'rgba(210,58,82,.10)', border: '1px solid rgba(210,58,82,.3)', borderRadius: 8, padding: '7px 10px', boxSizing: 'border-box' },
    action: { width: '100%', justifyContent: 'center', padding: '11px 13px', fontSize: 13.5 },
    cfgToggle: { marginTop: 12, background: 'none', border: 0, color: '#0072a3', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' },
    cfgBox: { width: '100%', marginTop: 8, background: '#f3f6fa', border: '1px solid #e3e9f1', borderRadius: 10, padding: '11px 12px', textAlign: 'left' },
    legal: { position: 'absolute', bottom: 18, left: 0, right: 0, textAlign: 'center', fontSize: 10.5, letterSpacing: '.4px', color: '#5b6b80' },
  };

  // Background sync: once signed in (and a server is configured), push local
  // changes to the cloud every 15s when the snapshot actually changes.
  (function autoSync() {
    if (!(unicoSession.configured() && unicoSession.isAuthed())) return;
    let last = '';
    try { last = JSON.stringify(appSnapshot()); } catch (e) { }
    setInterval(() => {
      try { const snap = JSON.stringify(appSnapshot()); if (snap !== last) { last = snap; unicoSession.pushData(); } } catch (e) { }
    }, 15000);
  })();
})();
