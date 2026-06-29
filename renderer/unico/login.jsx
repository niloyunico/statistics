/* UNICO — app lock / PIN gate
   Exposes two globals:
     window.unicoLock  — localStorage-backed PIN helper (key: unico_lock_v1)
     window.LockScreen — full-window branded gate <LockScreen onUnlock={...}/>
   Global-script React app: no imports/exports, React/ReactDOM are globals. */
const { useState, useRef, useEffect } = React;

/* ---------------------------------------------------------------------------
   unicoLock — tiny PIN helper backed by localStorage key `unico_lock_v1`
   Stored JSON shape: { enabled:boolean, hash:string }
--------------------------------------------------------------------------- */
const UNICO_LOCK_KEY = 'unico_lock_v1';

// NOTE: this is a light non-cryptographic obfuscation hash (FNV-1a) for a
// local single-user desktop app — it is NOT real cryptographic security.
function unicoPinHash(pin){
  let h = 0x811c9dc5; // FNV-1a 32-bit offset basis
  const s = 'unico:' + String(pin == null ? '' : pin);
  for(let i=0;i<s.length;i++){
    h ^= s.charCodeAt(i);
    h = (h + ((h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24))) >>> 0; // h *= 16777619 (mod 2^32)
  }
  return (h >>> 0).toString(16);
}

function unicoLockRead(){
  try{
    const raw = localStorage.getItem(UNICO_LOCK_KEY);
    if(!raw) return { enabled:false, hash:'' };
    const o = JSON.parse(raw);
    return { enabled: !!(o && o.enabled), hash: (o && typeof o.hash === 'string') ? o.hash : '' };
  }catch(e){
    return { enabled:false, hash:'' };
  }
}

function unicoLockWrite(state){
  try{ localStorage.setItem(UNICO_LOCK_KEY, JSON.stringify({ enabled: !!state.enabled, hash: state.hash || '' })); }
  catch(e){ /* storage unavailable — fail open (no lock) */ }
}

const unicoLock = {
  // enabled AND a hash is set
  isEnabled(){ const s = unicoLockRead(); return !!(s.enabled && s.hash); },
  // a PIN has been configured at some point (hash present)
  hasPin(){ return !!unicoLockRead().hash; },
  // constant-ish string compare against the stored hash
  verify(pin){
    const s = unicoLockRead();
    if(!s.hash) return false;
    return unicoPinHash(pin) === s.hash;
  },
  // set a new PIN + enable the lock
  setPin(pin){ unicoLockWrite({ enabled:true, hash: unicoPinHash(pin) }); },
  // turn the lock off but keep the stored hash (so re-enabling needs no reset)
  disable(){ const s = unicoLockRead(); unicoLockWrite({ enabled:false, hash: s.hash }); },
};

/* ---------------------------------------------------------------------------
   Inline padlock icon — I.lock does not exist in the icon map (ui.jsx)
--------------------------------------------------------------------------- */
function LockGlyph({ s = 24, c = 'currentColor', sw = 1.9, open = false }){
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2"/>
      {open
        ? <path d="M8 11V7a4 4 0 017.9-1"/>
        : <path d="M8 11V7a4 4 0 018 0v4"/>}
      <circle cx="12" cy="16" r="1.1"/>
    </svg>
  );
}

/* ---------------------------------------------------------------------------
   LockScreen — full-window branded gate. Two modes:
     • setup  (no PIN yet)  → enter + confirm a new PIN (len >= 4)
     • verify (PIN exists)  → enter PIN to unlock
--------------------------------------------------------------------------- */
function LockScreen({ onUnlock }){
  const setup = !unicoLock.hasPin();
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState('');
  const [shake, setShake] = useState(false);
  const pinRef = useRef(null);

  useEffect(()=>{ if(pinRef.current) pinRef.current.focus(); }, []);

  const fail = (msg)=>{
    setErr(msg);
    setShake(false);
    // restart shake animation on each failure
    requestAnimationFrame(()=>requestAnimationFrame(()=>setShake(true)));
  };

  const onlyDigits = (v)=> v.replace(/[^0-9]/g,'').slice(0,12);

  const submit = (e)=>{
    if(e && e.preventDefault) e.preventDefault();
    if(setup){
      if(pin.length < 4){ fail('PIN must be at least 4 digits.'); return; }
      if(pin !== confirm){ fail('PINs do not match.'); return; }
      unicoLock.setPin(pin);
      onUnlock && onUnlock();
      return;
    }
    if(unicoLock.verify(pin)){
      onUnlock && onUnlock();
    } else {
      setPin('');
      fail('Incorrect PIN. Please try again.');
      if(pinRef.current) pinRef.current.focus();
    }
  };

  return (
    <div style={S.gate}>
      <div style={S.bgGlow}/>
      <form style={{ ...S.card, ...(shake ? S.shake : null) }} onSubmit={submit} className="anim-pop">
        <div style={S.logoWrap}>
          <img src="unico/logo.svg" alt="UNICO Healthcare" style={S.logo}/>
        </div>

        <div style={S.badge}>
          <LockGlyph s={22} c="#fff" open={false}/>
        </div>

        <h1 style={S.title}>{setup ? 'Secure this workstation' : 'Workstation locked'}</h1>
        <p style={S.sub}>
          {setup
            ? 'Create a numeric PIN to protect access to the UNICO statistics suite on this device.'
            : 'Enter your PIN to continue. Statistics, staff and quality data remain protected.'}
        </p>

        <div style={S.fieldGrp}>
          <label style={S.label}>{setup ? 'New PIN' : 'PIN'}</label>
          <input
            ref={pinRef}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            placeholder="••••"
            value={pin}
            onChange={e=>{ setPin(onlyDigits(e.target.value)); if(err) setErr(''); }}
            style={S.input}
          />
        </div>

        {setup && (
          <div style={S.fieldGrp}>
            <label style={S.label}>Confirm PIN</label>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              placeholder="••••"
              value={confirm}
              onChange={e=>{ setConfirm(onlyDigits(e.target.value)); if(err) setErr(''); }}
              style={S.input}
            />
          </div>
        )}

        {err
          ? <div style={S.err}><LockGlyph s={14} c="#ffb4be" open/> {err}</div>
          : <div style={S.errPlaceholder}/>}

        <button type="submit" className="btn pri" style={S.action}>
          <LockGlyph s={16} c="#fff" open/>
          {setup ? 'Set PIN & continue' : 'Unlock'}
        </button>

        <div style={S.foot}>
          <div style={S.dot}/>
          <span>Nasif Ahammed Niloy · Administrator</span>
        </div>
      </form>

      <div style={S.legal}>UNICO Healthcare · Offline statistics suite · Single-user device lock</div>

      <style>{`@keyframes unicoShake{
        10%,90%{transform:translateX(-1px)} 20%,80%{transform:translateX(2px)}
        30%,50%,70%{transform:translateX(-5px)} 40%,60%{transform:translateX(5px)}
      }`}</style>
    </div>
  );
}

/* inline style objects — kept self-contained; reuses .btn.pri + .anim-pop classes */
const S = {
  gate:{ position:'fixed', inset:0, zIndex:3000, background:'#0d1b2e',
    backgroundImage:'radial-gradient(1100px 700px at 18% -10%, rgba(39,168,219,.16), transparent 60%), radial-gradient(900px 600px at 110% 120%, rgba(58,181,167,.14), transparent 55%)',
    display:'grid', placeItems:'center', padding:24, overflow:'auto' },
  bgGlow:{ position:'absolute', inset:0, pointerEvents:'none',
    background:'linear-gradient(180deg, rgba(13,27,46,0) 40%, rgba(13,27,46,.55) 100%)' },
  card:{ position:'relative', width:'min(380px,94vw)', background:'#ffffff',
    border:'1px solid #e3e9f1', borderRadius:18, padding:'30px 30px 22px',
    boxShadow:'0 24px 60px rgba(5,12,24,.55), 0 2px 0 rgba(255,255,255,.04) inset',
    display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center' },
  shake:{ animation:'unicoShake .5s cubic-bezier(.36,.07,.19,.97) both' },
  logoWrap:{ marginBottom:18 },
  logo:{ height:38, width:'auto', display:'block' },
  badge:{ width:52, height:52, borderRadius:14, display:'grid', placeItems:'center',
    background:'linear-gradient(135deg,#27a8db,#0072a3)', color:'#fff',
    boxShadow:'0 8px 20px rgba(0,144,202,.45)', marginBottom:14 },
  title:{ margin:'0 0 6px', fontSize:18, fontWeight:700, color:'#16202e', letterSpacing:'.1px' },
  sub:{ margin:'0 0 18px', fontSize:12.5, lineHeight:1.5, color:'#6c7a8c', maxWidth:300 },
  fieldGrp:{ width:'100%', display:'flex', flexDirection:'column', gap:5, marginBottom:11, textAlign:'left' },
  label:{ fontSize:11.5, fontWeight:600, color:'#3c4858' },
  input:{ width:'100%', padding:'11px 13px', border:'1px solid #dde3ec', borderRadius:9,
    fontFamily:'inherit', fontSize:18, letterSpacing:'.35em', textAlign:'center',
    background:'#f7f9fc', color:'#16202e', outline:'none', boxSizing:'border-box' },
  err:{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:6,
    minHeight:20, margin:'2px 0 10px', fontSize:12, fontWeight:600, color:'#ffd2d8',
    background:'rgba(210,58,82,.16)', border:'1px solid rgba(210,58,82,.35)',
    borderRadius:8, padding:'7px 10px', boxSizing:'border-box' },
  errPlaceholder:{ minHeight:20, margin:'2px 0 10px' },
  action:{ width:'100%', justifyContent:'center', padding:'11px 13px', fontSize:13.5 },
  foot:{ display:'flex', alignItems:'center', gap:8, marginTop:16, fontSize:11.5, color:'#9aa6b4' },
  dot:{ width:8, height:8, borderRadius:'50%', background:'#3ddc97',
    boxShadow:'0 0 0 3px rgba(61,220,151,.18)' },
  legal:{ position:'absolute', bottom:18, left:0, right:0, textAlign:'center',
    fontSize:10.5, letterSpacing:'.4px', color:'#5b6b80' },
};

window.unicoLock = unicoLock;
window.LockScreen = LockScreen;
