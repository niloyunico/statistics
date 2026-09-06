/* UNICO — Workforce: staff profile + add/edit form */

function yearsFromDOJ(doj){
  if(!doj) return '';
  const d=new Date(doj); if(isNaN(d)) return '';
  const days=(Date.now()-d.getTime())/86400000; if(days<0) return '';
  const y=days/365.25;
  return y<1?`${Math.max(1,Math.round(days/30.44))} months`:`${y.toFixed(1)} yrs`;
}

/* UNICO experience = time served at UNICO, derived live from Date of Joining
   (≠ total_experience which may include prior facilities). Returns y/mo breakdown. */
function unicoTenure(doj){
  if(!doj) return null;
  const d=new Date(doj); if(isNaN(d)) return null;
  const now=new Date(); if(d>now) return null;
  let months=(now.getFullYear()-d.getFullYear())*12+(now.getMonth()-d.getMonth());
  if(now.getDate()<d.getDate()) months--;
  if(months<0) months=0;
  const years=Math.floor(months/12), mo=months%12;
  const text = years>0 ? (mo>0?`${years} yr${years>1?'s':''} ${mo} mo`:`${years} yr${years>1?'s':''}`) : `${mo} mo`;
  return {months, years, mo, decimalYears:Math.round(months/12*10)/10, text};
}

/* ---------------- Profile (read-only + notes) ---------------- */
/* One person's performance file: their appraisals, and the achievements and
   incidents recorded against them. Loaded here rather than passed in because the
   profile is reachable from three places and none of them already hold it.
   Returns null while loading so the panel can say "loading" instead of "none".

   `perfId` is NOT the staff store's record id. The performance module keys every
   appraisal, incident and achievement on `emp_id || String(id)` (performance.jsx),
   so filtering on the store's internal id silently matched nothing and every panel
   read as "nothing on file" for anyone who has an employee number -- which is almost
   everyone. */
function useStaffPerf(perfId){
  const [d,setD]=React.useState(null);
  React.useEffect(()=>{
    let live=true;
    const api=(window.PerfUI&&window.PerfUI.perfApi)||null;
    const get=api?api.get('/api/performance'):fetch('/api/performance',{credentials:'same-origin'}).then(r=>r.json());
    Promise.resolve(get).then(r=>{
      if(!live||!r||!r.ok) { if(live) setD({appraisals:[],incidents:[],achievements:[]}); return; }
      const mine=(list)=>(list||[]).filter(x=>String(x.empId)===String(perfId));
      setD({appraisals:mine(r.appraisals),incidents:mine(r.incidents),achievements:mine(r.achievements)});
    }).catch(()=>{ if(live) setD({appraisals:[],incidents:[],achievements:[]}); });
    return ()=>{live=false;};
  },[perfId]);
  return d;
}

/* DISCONTINUE — a proper exit, not a bare "mark inactive". Collects the separation
   type, last working day and the stated reason, files the exit in the Performance
   module's Attrition & Exits register (POST /api/performance/exits — the attrition
   rate is computed from it), THEN archives the person to Previous Staff with the
   same reason. Order matters: if the register write fails, nothing is archived, so
   the roster and the attrition figures can never disagree. */
const SEPARATIONS=['Resignation','End of contract','Retirement','Termination','Absconded','Transfer','Other'];
function DiscontinueDialog({e,onClose,onDone}){
  const today=(()=>{try{const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);}catch(err){return '';}})();
  const [sep,setSep]=React.useState('Resignation');
  const [lastDay,setLastDay]=React.useState(today);
  const [noticeDate,setNoticeDate]=React.useState('');
  const [reason,setReason]=React.useState('');
  const [rehire,setRehire]=React.useState(true);
  const [note,setNote]=React.useState('');
  const [busy,setBusy]=React.useState(false);
  const [err,setErr]=React.useState('');
  const inp={padding:'9px 11px',border:'1px solid var(--line)',borderRadius:8,fontSize:13,fontFamily:'inherit',outline:'none',width:'100%',background:'#fff'};
  const lab=(t)=><label style={{fontSize:11,fontWeight:700,color:'var(--ink-2)'}}>{t}</label>;
  const confirm=async()=>{
    if(!lastDay){setErr('Last working day is required — the attrition month is taken from it.');return;}
    if(!reason.trim()){setErr('Please state the discontinue reason.');return;}
    setBusy(true);setErr('');
    try{
      const r=await fetch('/api/performance/exits',{method:'POST',headers:{'content-type':'application/json'},credentials:'same-origin',
        body:JSON.stringify({empId:e.emp_id||String(e.id),staffName:e.name,department:e.current_department||'',designation:e.designation||'',
          doj:e.doj||'',noticeDate,lastDay,separation:sep,reason:reason.trim(),rehire,note})});
      const j=await r.json().catch(()=>({ok:false}));
      if(!r.ok||!j.ok) throw new Error((j&&j.error)||'Could not record the exit.');
    }catch(ex){ setBusy(false); setErr(String((ex&&ex.message)||ex)+' Nothing was changed — the person is still on the active roster.'); return; }
    onDone(sep+' — '+reason.trim());
  };
  const body=(
    <div onMouseDown={(ev)=>{if(ev.target===ev.currentTarget&&!busy)onClose();}} style={{position:'fixed',inset:0,background:'rgba(16,32,46,.5)',zIndex:600,display:'grid',placeItems:'center',padding:16}}>
      <div className="card" style={{width:'min(500px,96vw)',maxHeight:'92vh',overflow:'auto',border:'1px solid #f1c6cd'}}>
        <div className="card-h" style={{background:'rgba(210,58,82,.06)'}}>
          <span style={{display:'inline-grid',placeItems:'center',width:30,height:30,borderRadius:9,background:'rgba(210,58,82,.12)',color:'#d23a52',marginRight:7,fontSize:15}}>⚠</span>
          <h3 style={{color:'#d23a52'}}>Discontinue {e.name}</h3><span className="spacer"/>
          <button className="icon-btn" onClick={onClose}><Ic d={I.x} s={15}/></button>
        </div>
        <div className="card-b" style={{display:'flex',flexDirection:'column',gap:12}}>
          <div style={{fontSize:12,color:'var(--ink-2)',lineHeight:1.55,background:'var(--warn-bg,#fff4e0)',border:'1px solid #f0d9a8',borderRadius:9,padding:'10px 12px'}}>
            {e.name} is moved off the active roster to <b>Previous Staff</b>, and the exit is filed in the <b>Attrition &amp; Exits</b> register — the attrition rate updates immediately. The record is kept and they can be restored anytime.
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div style={{display:'flex',flexDirection:'column',gap:4}}>{lab('Separation type')}
              <select style={inp} value={sep} onChange={ev=>setSep(ev.target.value)}>{SEPARATIONS.map(x=><option key={x}>{x}</option>)}</select></div>
            <div style={{display:'flex',flexDirection:'column',gap:4}}>{lab('Last working day *')}
              <input type="date" style={{...inp,borderColor:lastDay?undefined:'#d23a52'}} value={lastDay} onChange={ev=>setLastDay(ev.target.value)}/></div>
            <div style={{display:'flex',flexDirection:'column',gap:4}}>{lab('Notice / resignation date')}
              <input type="date" style={inp} value={noticeDate} onChange={ev=>setNoticeDate(ev.target.value)}/></div>
            <div style={{display:'flex',flexDirection:'column',gap:4}}>{lab('Eligible for rehire?')}
              <label style={{display:'flex',alignItems:'center',gap:8,fontSize:12.5,padding:'9px 0',cursor:'pointer',color:'var(--ink-2)'}}>
                <input type="checkbox" checked={rehire} onChange={ev=>setRehire(ev.target.checked)}/>Yes — may be rehired</label></div>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:4}}>{lab('Discontinue reason *')}
            <input style={{...inp,borderColor:reason.trim()?undefined:'#d23a52'}} value={reason} onChange={ev=>setReason(ev.target.value)} placeholder="e.g. Better opportunity abroad / family relocation / contract ended"/></div>
          <div style={{display:'flex',flexDirection:'column',gap:4}}>{lab('Note (optional)')}
            <textarea style={{...inp,minHeight:52}} value={note} onChange={ev=>setNote(ev.target.value)} placeholder="Exit interview points, clearance status, anything worth keeping"/></div>
          {err&&<div style={{fontSize:12.5,color:'#d23a52',fontWeight:600}}>{err}</div>}
          <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
            <button className="btn" disabled={busy} onClick={onClose}>Cancel</button>
            <button className="btn" disabled={busy} onClick={confirm} style={{background:'#d23a52',borderColor:'#d23a52',color:'#fff',fontWeight:700}}>⚠ {busy?'Recording…':'Discontinue & move to Previous Staff'}</button>
          </div>
        </div>
      </div>
    </div>
  );
  return (window.ReactDOM&&window.ReactDOM.createPortal)?window.ReactDOM.createPortal(body,document.body):body;
}

function StaffProfile({store, empId, setRoute}){
  const S=window.STAFF;
  const e=store.get(empId);
  const [note,setNote]=React.useState('');
  const [discontinuing,setDiscontinuing]=React.useState(false);
  // Resolved before the early return below, so the hook order never changes.
  const perfId=e?(e.emp_id||String(e.id)):null;
  const perf=useStaffPerf(perfId);
  if(!e) return <div style={{padding:40}}>Staff not found. <button className="btn sm" onClick={()=>setRoute({view:'nurses'})}>Back to roster</button></div>;
  const tenure=unicoTenure(e.doj);
  const backView=e.role==='PCA'?'pca':'nurses';
  const priorY=S.priorYearsOf(e);                     // null if no structured prior
  const totalY=S.expYears(e);
  const totalText=S.fmtYM(totalY);                    // TOTAL = prior + UNICO
  // Previous experience EXCLUDING UNICO, as a duration: always = Total − UNICO tenure,
  // so it stays consistent (Previous + UNICO = Total) even for imported records that
  // only stored a flat total and a free-text place in `previous_experience`.
  const priorExcl = totalY!=null ? Math.max(0, Math.round((totalY-S.unicoYearsOf(e))*100)/100) : priorY;
  const priorExclText = priorExcl!=null ? S.fmtYM(priorExcl) : '—';
  const entries=Array.isArray(e.prior_experience_entries)?e.prior_experience_entries:[];
  const profAge=(()=>{ const t=Date.parse(e.dob); if(isNaN(t))return null;
    const a=Math.floor((Date.now()-t)/(365.25*24*3600*1000)); return (a>=0&&a<130)?a:null; })();
  // Days until the next birthday, so the profile says the same thing the dashboard's
  // Birthday Reminders card does instead of leaving the reader to count months.
  const profBday=(()=>{ const d=new Date(e.dob); if(!e.dob||isNaN(d))return null;
    const n=new Date(); const today=new Date(n.getFullYear(),n.getMonth(),n.getDate());
    let bd=new Date(today.getFullYear(),d.getMonth(),d.getDate());
    if(bd<today) bd=new Date(today.getFullYear()+1,d.getMonth(),d.getDate());
    const days=Math.round((bd-today)/86400000);
    return days===0?'🎂 Today':days===1?'🎂 Tomorrow':days<=30?'🎂 in '+days+' days':null; })();
  const profLicence=(()=>{ const t=Date.parse(e.licence_expiry); if(isNaN(t))return null;
    const d=Math.round((t-Date.now())/86400000);
    return d<0?{t:'Expired',c:'#d23a52'}:d<=60?{t:'Expires in '+d+'d',c:'#b5670a'}:{t:'Valid',c:'#157a43'}; })();
  const field=(l,v,mono)=>(
    <div style={{display:'flex',flexDirection:'column',gap:3}}>
      <span style={{fontSize:10.5,color:'var(--muted)',textTransform:'uppercase',letterSpacing:.4,fontWeight:600}}>{l}</span>
      <span style={{fontSize:13.5,color:'var(--ink)',fontWeight:500,fontFamily:mono?'IBM Plex Mono':'inherit'}}>{v||<span style={{color:'var(--faint)'}}>—</span>}</span>
    </div>
  );
  const sec=(title,kids)=>(
    <div className="card"><div className="card-h"><h3>{title}</h3></div>
      <div className="card-b" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px 22px'}}>{kids}</div></div>
  );
  // ---------- professional-portfolio helpers ----------
  const desig=(window.staffCanonDesig?window.staffCanonDesig(e.designation):e.designation)||'';
  const deptText=(window.staffDeptShow?window.staffDeptShow(e.current_department):e.current_department)||'';
  const lbl=(t)=><div style={{fontSize:10.5,color:'var(--muted)',textTransform:'uppercase',letterSpacing:.5,fontWeight:700,marginBottom:9}}>{t}</div>;
  const chipRow=(val,tone)=>{ const arr=String(val||'').split(',').map(x=>x.trim()).filter(Boolean);
    return arr.length
      ? <div style={{display:'flex',flexWrap:'wrap',gap:7}}>{arr.map((x,i)=>(
          <span key={i} style={{fontSize:12,fontWeight:600,padding:'5px 11px',borderRadius:15,background:tone.bg,color:tone.fg,border:'1px solid '+tone.br}}>{x}</span>))}</div>
      : <span style={{fontSize:11.5,fontWeight:600,color:'var(--faint)',padding:'5px 11px',borderRadius:15,background:'var(--panel-2)',border:'1px dashed var(--line)',display:'inline-block'}}>Not recorded</span>; };
  const deptChipRow=(val)=>{ const arr=[...new Set(String(val||'').split(',').map(x=>x.trim()).filter(Boolean)
      .map(x=>{ const c=window.staffCanonDept?window.staffCanonDept(x):x; return (window.staffDeptLabel?window.staffDeptLabel(c):c)||x; }))];
    return chipRow(arr.join(', '),{bg:'#eef2ff',fg:'#4353b0',br:'#dfe4fb'}); };
  const statBox=(l,v,c,bg,br)=>(
    <div style={{background:bg||'var(--panel-2)',border:'1px solid '+(br||'var(--line-2)'),borderRadius:10,padding:'10px 6px',textAlign:'center'}}>
      <div className="num" style={{fontSize:15,fontWeight:800,color:c,lineHeight:1.1}}>{v||'—'}</div>
      <div style={{fontSize:9,color:'var(--muted)',marginTop:4,textTransform:'uppercase',letterSpacing:.3,fontWeight:700}}>{l}</div>
    </div>
  );
  const secHead=(icon,title,sub,ac)=>(
    <div className="card-h">
      <span style={{display:'inline-grid',placeItems:'center',width:30,height:30,borderRadius:9,background:ac?ac.bg:'var(--blue-50)',color:ac?ac.fg:'var(--blue)',marginRight:7}}><Ic d={icon} s={16}/></span>
      <h3>{title}</h3>{sub&&<span className="sub">{sub}</span>}<span className="spacer"/>
    </div>
  );
  const infoTile=(label,val,mono)=>(
    <div style={{background:'var(--panel-2)',borderRadius:9,padding:'8px 11px'}}>
      <div style={{fontSize:9,textTransform:'uppercase',letterSpacing:.5,color:'var(--muted)',fontWeight:700,marginBottom:3}}>{label}</div>
      <div className={mono?'num':''} style={{fontSize:13,fontWeight:700,color:val?'var(--ink)':'var(--faint)'}}>{val||'—'}</div>
    </div>
  );
  const idRow=(icon,label,val,tint)=>(
    <div style={{display:'flex',alignItems:'center',gap:10,padding:'7px 0',borderTop:'1px solid var(--line-2)'}}>
      <span style={{display:'inline-grid',placeItems:'center',width:27,height:27,borderRadius:8,background:tint?tint.bg:'var(--panel-2)',color:tint?tint.fg:'var(--muted)',flexShrink:0}}><Ic d={icon} s={14}/></span>
      <span style={{fontSize:11.5,color:'var(--muted)'}}>{label}</span>
      <span className="num" style={{marginLeft:'auto',fontSize:12.5,fontWeight:700,color:'var(--ink)',textAlign:'right'}}>{val}</span>
    </div>
  );
  // ID-photo initials + a deterministic barcode strip (looks like a real staff badge)
  const badgeIni=(()=>{ const p=(e.name||'?').split(' ').filter(Boolean); return ((p[0]&&p[0][0]||'')+(p.length>1?p[p.length-1][0]:'')).toUpperCase(); })();
  let badgeHue=0; for(const ch of e.name||'') badgeHue=(badgeHue*31+ch.charCodeAt(0))%360;
  const barcode=(seed)=>{ const s=String(seed||'UNICO0000'); const bars=[]; let acc=7;
    for(let i=0;i<48;i++){ acc=(acc*31+(s.charCodeAt(i%s.length)||48)+i*7)>>>0; const w=1+(acc%4); const on=(acc>>3)%5!==0;
      bars.push(<span key={i} style={{width:w+'px',background:on?'#15181c':'transparent'}}/>); }
    return <div style={{display:'flex',alignItems:'stretch',gap:'1.5px',height:42,justifyContent:'center'}}>{bars}</div>; };
  return (
    <div className="grid" style={{gap:16}}>
      {/* action bar */}
      <div style={{display:'flex',alignItems:'center',gap:10}}>
        <button className="btn sm" onClick={()=>setRoute({view:backView})}><Ic d={I.chevR} s={14} style={{transform:'rotate(180deg)'}}/>{e.role==='PCA'?'PCA':'Nurses'}</button>
        <span className="spacer" style={{flex:1}}/>
        {e.is_active&&(!window.unicoCan||window.unicoCan('staff','edit'))&&
          <button className="btn sm" title="Discontinue — record the exit reason & move to Previous Staff (feeds the attrition rate)"
            style={{color:'#d23a52',borderColor:'#f1c6cd',fontWeight:700}} onClick={()=>setDiscontinuing(true)}>⚠ Discontinue</button>}
        <button className="btn sm" title="Print / Save as PDF" onClick={()=>window.print()}><Ic d={I.print} s={15}/>Print</button>
        <button className="btn sm" title="Delete permanently" style={{color:'#d23a52',borderColor:'#f1c6cd'}} onClick={async()=>{
          const ok=await window.UI.confirm({title:`Permanently delete ${e.name}?`,message:'This removes the record entirely and cannot be undone. (Use Deactivate to keep the record.)',danger:true,confirmLabel:'Delete permanently'});
          if(ok){store.destroy(empId);window.UI.toast('Staff record deleted','success');setRoute({view:backView});}
        }}><Ic d={I.x} s={15} sw={2.4}/>Delete</button>
        <button className="btn pri sm" onClick={()=>setRoute({view:'staffForm',emp:e.id})}><Ic d={I.edit} s={15}/>Edit profile</button>
      </div>
      {discontinuing&&<DiscontinueDialog e={e} onClose={()=>setDiscontinuing(false)}
        onDone={(reasonText)=>{ setDiscontinuing(false); store.remove(empId,reasonText);
          window.UI&&window.UI.toast&&window.UI.toast(e.name+' discontinued — moved to Previous Staff & filed in Attrition & Exits','success');
          setRoute({view:backView}); }}/>}

      {/* ===== portfolio ===== */}
      <div className="grid staff-portfolio" style={{gridTemplateColumns:'320px minmax(0,1fr)',gap:14,alignItems:'start'}}>
        {/* LEFT — ID card */}
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div className="card id-badge" style={{padding:0,overflow:'hidden'}}>
            {/* lanyard slot */}
            <div style={{display:'flex',justifyContent:'center',paddingTop:10}}>
              <div style={{width:48,height:7,borderRadius:5,background:'var(--line)'}}/>
            </div>
            {/* org header — real UNICO logo on white */}
            <div style={{marginTop:8,padding:'11px 15px',background:'var(--panel)',display:'flex',alignItems:'center',gap:10}}>
              <img src="unico/logo.svg" alt="UNICO Hospitals" style={{height:29,width:'auto',display:'block'}}/>
              <span className="spacer" style={{flex:1}}/>
              <span style={{display:'inline-flex',alignItems:'center',gap:4,fontSize:9,fontWeight:800,letterSpacing:.8,color:'#fff',background:'linear-gradient(130deg,#0aa0d4,#0072a3)',padding:'4px 9px',borderRadius:6,flexShrink:0}}><Ic d={I.steth} s={12} c="#fff"/>{e.role==='PCA'?'PCA ID':'NURSE ID'}</span>
            </div>
            {/* accent line */}
            <div style={{height:4,background:'linear-gradient(90deg,#3ab5a7,#0aa0d4,#0072a3)'}}/>
            {/* photo */}
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',padding:'18px 22px 4px'}}>
              <div style={{borderRadius:14,padding:4,background:'var(--panel)',border:'1px solid var(--line)',boxShadow:'0 6px 16px rgba(0,0,0,.13)'}}>
                  {/* READ-ONLY on purpose. This is the profile VIEW — the badge shows
                      the photo, it does not edit it. Changing a personnel record's
                      picture belongs with the rest of that record, behind "Edit
                      profile", so a stray click on a page people mostly read cannot
                      delete someone's photo. */}
                  {/* zoomable: clicking the portrait opens it LARGE in a photo-frame
                      lightbox — still strictly view-only. */}
                  <PhotoPicker
                  value={e.photo||null}
                  initials={badgeIni} name={e.name} kind="staff" hue={badgeHue}
                  w={104} h={120} radius={10} plain readOnly
                  zoomable zoomSub={desig||undefined}
                />
              </div>
              <h2 style={{margin:'14px 0 3px',fontSize:19,fontWeight:800,letterSpacing:'-.2px',textAlign:'center'}}>{e.name}</h2>
              <div style={{fontSize:12.5,color:'var(--blue-700)',fontWeight:700,textAlign:'center'}}>{desig||'—'}</div>
              <div style={{display:'flex',gap:6,marginTop:11,flexWrap:'wrap',justifyContent:'center'}}>
                <RoleBadge role={e.role}/>
                {e.is_active?<span className="chip pos">● Active</span>:<span className="chip neg">○ Inactive</span>}
              </div>
            </div>
            {/* detail rows */}
            <div style={{padding:'8px 22px 0'}}>
              {[['ID No.',e.emp_id||'Not set',true],['Department',deptText||'—',false],['Joined',e.doj||'—',true],['Phone',e.phone||'—',true]].map(([l,v,mono],i)=>(
                <div key={l} style={{display:'flex',alignItems:'baseline',gap:12,padding:'8px 0',borderTop:i?'1px solid var(--line-2)':'none'}}>
                  <span style={{fontSize:10,textTransform:'uppercase',letterSpacing:.5,color:'var(--muted)',fontWeight:700,flex:'0 0 78px'}}>{l}</span>
                  {l==='Phone'&&e.phone
                    ? <a href={`tel:${(e.phone||'').replace(/[^\d+]/g,'')}`} className="num" style={{fontSize:12.5,fontWeight:700,color:'#0f6a39',marginLeft:'auto',textAlign:'right',textDecoration:'none'}}>{v}</a>
                    : <span className={mono?'num':''} style={{fontSize:12.5,fontWeight:700,color:v==='Not set'||v==='—'?'var(--faint)':'var(--ink)',marginLeft:'auto',textAlign:'right',wordBreak:'break-word'}}>{v}</span>}
                </div>
              ))}
            </div>
            {/* barcode */}
            <div style={{margin:'14px 18px 16px',padding:'11px 10px 7px',borderRadius:10,background:'#fff',border:'1px solid var(--line-2)'}}>
              {barcode(e.emp_id||e.name)}
              <div className="num" style={{textAlign:'center',fontSize:11,fontWeight:700,letterSpacing:3,color:'#15181c',marginTop:6}}>{e.emp_id||'— — — —'}</div>
            </div>
          </div>

          <div className="card">
            <div className="card-h" style={{paddingBottom:0,borderBottom:'none'}}>
              <span style={{display:'inline-grid',placeItems:'center',width:30,height:30,borderRadius:9,background:'var(--blue-50)',color:'var(--blue)',marginRight:7}}><Ic d={I.activity} s={16}/></span>
              <h3>Key Facts</h3><span className="spacer"/>
            </div>
            <div className="card-b" style={{padding:'0 18px 8px'}}>
              {idRow(I.trend,'Total experience',totalText,{bg:'#eef8fc',fg:'var(--blue)'})}
              {idRow(I.cal,'Before UNICO',priorExclText,{bg:'#f1eefb',fg:'#6a52d4'})}
              {idRow(I.steth,'At UNICO',tenure?tenure.text:'—',{bg:'#e7f6ed',fg:'#1f9d57'})}
              <div style={{display:'flex',alignItems:'center',gap:10,padding:'7px 0',borderTop:'1px solid var(--line-2)'}}>
                <span style={{display:'inline-grid',placeItems:'center',width:27,height:27,borderRadius:8,background:'#e7f6ed',color:'#1f9d57',flexShrink:0}}><Ic d={I.syringe} s={14}/></span>
                <span style={{fontSize:11.5,color:'var(--muted)'}}>Hep-B status</span>
                <span style={{marginLeft:'auto'}}><VaccBadge status={e.hepatitis_b_vaccination}/></span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT — content */}
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {/* Profile — role + department + credentials, merged & compact */}
          <div className="card" style={{borderLeft:'4px solid #6a52d4'}}>
            {secHead(I.layers,'Profile','role · department · credentials',{bg:'#f1eefb',fg:'#6a52d4'})}
            <div className="card-b" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'11px 12px'}}>
              {infoTile('Designation',desig)}
              {infoTile('Date of joining',e.doj,true)}
              {e.gender?infoTile('Gender',e.gender):null}
              {e.dob?infoTile('Date of birth',e.dob+(profAge!=null?'  ('+profAge+' yrs)':'')+(profBday?'   '+profBday:''),true):null}
              <div style={{gridColumn:'1 / -1'}}>{lbl('Department(s)')}{deptChipRow(e.current_department)}
                {e.primary_department?<div style={{fontSize:11,color:'var(--muted)',marginTop:5}}>Primary — <b style={{color:'var(--ink-2)'}}>{e.primary_department}</b>{e.can_float?' · can float to other units':''}</div>:null}</div>
              {/* A licence that has run out is a rostering blocker, so it is stated in
                  red on the profile rather than hidden inside the edit form. */}
              {e.licence_no||e.licence_expiry
                ? <div style={{gridColumn:'1 / -1',background:'var(--panel-2)',borderRadius:9,padding:'8px 11px'}}>
                    <div style={{fontSize:9,textTransform:'uppercase',letterSpacing:.5,color:'var(--muted)',fontWeight:700,marginBottom:3}}>Registration / licence</div>
                    <div style={{display:'flex',alignItems:'baseline',gap:9,flexWrap:'wrap'}}>
                      <span className="num" style={{fontSize:13,fontWeight:700,color:'var(--ink)'}}>{e.licence_no||'—'}</span>
                      {e.licence_expiry?<span style={{fontSize:11.5,color:'var(--muted)'}}>expires {e.licence_expiry}</span>:null}
                      {profLicence?<span style={{fontSize:10.5,fontWeight:700,color:profLicence.c,background:profLicence.c+'18',border:'1px solid '+profLicence.c+'44',borderRadius:6,padding:'1px 8px'}}>{profLicence.t}</span>:null}
                    </div>
                  </div>
                : null}
              <div>{lbl('Qualification')}{chipRow(e.qualification,{bg:'#eef8fc',fg:'#0072a3',br:'#dceffa'})}</div>
              <div>{lbl('Special Training')}{chipRow(e.special_training,{bg:'#fff4e5',fg:'#b5670a',br:'#ffe2b8'})}</div>
              <div style={{gridColumn:'1 / -1'}}>{lbl('Extracurricular Activities')}{chipRow(e.extracurricular,{bg:'#f1eefb',fg:'#6a52d4',br:'#e3dcf7'})}</div>
            </div>
          </div>

          {/* Clinical Privileges — read-only summary of the checklist filled in on the
              create/edit form. Only the granted privilege areas are shown; edit the
              full checklist (all areas, all activities) via Edit profile. */}
          <div className="card" style={{borderLeft:'4px solid #3ab5a7'}}>
            {secHead(I.check||I.doc,'Clinical Privileges','activities granted, by privilege area',{bg:'#e7f6ed',fg:'#1f9d57'})}
            <div className="card-b">
              {(()=>{
                const stats=(S.privilegeStats)?S.privilegeStats(e.role,e.privileges):{granted:0,total:0,byGroup:[]};
                if(!stats.total) return <div style={{color:'var(--muted)',fontSize:12.5}}>No privilege catalogue for this role.</div>;
                if(!stats.granted) return <div style={{color:'var(--faint)',fontSize:12.5}}>No privileges recorded yet — set them from Edit profile.</div>;
                return (
                  <div style={{display:'flex',flexDirection:'column',gap:12}}>
                    <div style={{display:'flex',alignItems:'baseline',gap:9}}>
                      <span className="num" style={{fontSize:26,fontWeight:800,color:'#1f9d57'}}>{stats.granted}</span>
                      <span style={{fontSize:12,color:'var(--muted)'}}>of {stats.total} activities granted, across {stats.byGroup.filter(g=>g.granted>0).length} privilege area{stats.byGroup.filter(g=>g.granted>0).length===1?'':'s'}</span>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))',gap:9}}>
                      {stats.byGroup.filter(g=>g.granted>0).map(g=>(
                        <div key={g.group} style={{background:'var(--panel-2)',borderRadius:8,padding:'7px 10px'}}>
                          <div style={{fontSize:11,fontWeight:600,color:'var(--ink-2)',marginBottom:4,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}} title={g.group}>{g.group.replace(/^\d+\.\s*/,'')}</div>
                          <div style={{height:5,borderRadius:3,background:'var(--line-2)',overflow:'hidden'}}>
                            <div style={{width:(g.granted/g.total*100)+'%',height:'100%',background:'#1f9d57'}}/>
                          </div>
                          <div className="num" style={{fontSize:10.5,color:'var(--muted)',marginTop:3}}>{g.granted}/{g.total}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Experience — compact */}
          <div className="card" style={{borderLeft:'4px solid #1f9d57'}}>
            {secHead(I.trend,'Experience','career timeline',{bg:'#e7f6ed',fg:'#1f9d57'})}
            <div className="card-b" style={{display:'flex',flexDirection:'column',gap:11}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:9}}>
                {statBox('Total',totalText,'var(--blue-700)','#eef8fc','#dceffa')}
                {statBox('Before UNICO',priorExclText,'#6a52d4','#f1eefb','#e2dbf7')}
                {statBox('At UNICO',tenure?tenure.text:'—','#1f9d57','#e7f6ed','#c5e8d4')}
              </div>
              {entries.length>0 && <div>
                {lbl('Prior Positions')}
                <div>
                  {entries.map((x,i)=>(
                    <div key={i} style={{display:'flex',gap:12,alignItems:'stretch'}}>
                      <div style={{display:'flex',flexDirection:'column',alignItems:'center',width:12,flexShrink:0}}>
                        <span style={{width:10,height:10,borderRadius:'50%',background:'var(--blue)',marginTop:5}}/>
                        {i<entries.length-1&&<span style={{flex:1,width:2,background:'var(--line)'}}/>}
                      </div>
                      <div style={{paddingBottom:i<entries.length-1?14:0}}>
                        <div style={{fontSize:13,fontWeight:700,color:'var(--ink)'}}>{x.org||'Prior role'}</div>
                        {/* dept is optional — rows captured before the column existed have none */}
                        {x.dept?<div style={{fontSize:11.5,color:'var(--ink-2)',marginTop:1}}>{x.dept}</div>:null}
                        <div className="num" style={{fontSize:12,color:'var(--muted)',marginTop:1}}>{S.fmtYM((parseFloat(x.years)||0)+(parseFloat(x.months)||0)/12)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>}
              <div style={{fontSize:12,color:'var(--muted)',borderTop:'1px solid var(--line-2)',paddingTop:12}}>UNICO tenure since <b style={{color:'var(--ink-2)'}}>{e.doj||'—'}</b>{tenure?` · ${tenure.text}`:''}.</div>
            </div>
          </div>

          {/* Performance — the appraisal record, read from the same file the
              Performance module writes. Deliberately read-only here: this page is the
              personnel record, and an appraisal is filed through its own form. */}
          <div className="card" style={{borderLeft:'4px solid #0072a3'}}>
            {secHead(I.trend,'Performance','appraisal record',{bg:'#eef8fc',fg:'#0072a3'})}
            <div className="card-b">
              {perf===null ? <div style={{color:'var(--muted)',fontSize:12.5}}>Loading the performance file…</div>
                : (()=>{
                  const A=window.UNICO_APPRAISAL;
                  // 'actioned' is the only status that means the cycle is closed and the
                  // grade is final. Every appraisal comes back with a numeric `score`
                  // attached by the server, so testing for one would count untouched drafts.
                  const done=(perf.appraisals||[]).filter(a=>a&&a.status==='actioned')
                    .sort((x,y)=>String(x.cycleId||'')<String(y.cycleId||'')?-1:1);
                  const last=done[done.length-1];
                  // cycleOf() returns Date objects; printing one straight into JSX gives the
                  // browser's full toString ("Sat Sep 19 2026 06:00:00 GMT+0600 (…)").
                  const nextDue=(A&&A.cycleOf&&e.doj)?(function(){ try{ const c=A.cycleOf(e.doj,new Date()); if(!c||!c.end) return null;
                    const d=c.end; return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }catch(err){ return null; } })():null;
                  if(!last) return (
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:'var(--ink)'}}>No appraisal filed yet</div>
                      <div style={{fontSize:12,color:'var(--muted)',marginTop:3,lineHeight:1.6}}>
                        The first appraisal falls six months after joining{e.doj?' ('+e.doj+')':''}.{nextDue?' Current window closes '+nextDue+'.':''}
                      </div>
                      <button className="btn sm" style={{marginTop:11}} onClick={()=>setRoute({view:'perfStaff',emp:perfId})}>Open performance record</button>
                    </div>
                  );
                  const pct=Math.max(0,Math.min(100,Number(last.score)||0));
                  const gc=(window.MK&&window.MK.GC&&window.MK.GC[last.grade])||'#0072a3';
                  return (
                    <div style={{display:'flex',flexDirection:'column',gap:12}}>
                      <div style={{display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}}>
                        <div style={{display:'flex',alignItems:'baseline',gap:9}}>
                          <span style={{fontSize:34,fontWeight:800,color:gc,lineHeight:1}}>{last.grade||'—'}</span>
                          <span className="num" style={{fontSize:20,fontWeight:800,color:'var(--ink)'}}>{last.score==null?'—':last.score}</span>
                          <span className="num" style={{fontSize:13,color:'var(--muted)'}}>/ 100</span>
                        </div>
                        <div style={{minWidth:170,flex:1}}>
                          <div style={{fontSize:10.5,textTransform:'uppercase',letterSpacing:.5,color:'var(--muted)',fontWeight:700}}>latest cycle</div>
                          <div style={{fontSize:12.5,fontWeight:600,color:'var(--ink-2)'}}>{last.cycleLabel||last.cycleId||'—'}</div>
                        </div>
                        <div style={{textAlign:'right'}}>
                          <div style={{fontSize:10.5,textTransform:'uppercase',letterSpacing:.5,color:'var(--muted)',fontWeight:700}}>appraisals</div>
                          <div className="num" style={{fontSize:15,fontWeight:800,color:'var(--ink)'}}>{done.length}</div>
                        </div>
                      </div>
                      <div style={{height:9,borderRadius:6,background:'var(--panel-2)',overflow:'hidden'}}>
                        <div style={{width:pct+'%',height:'100%',borderRadius:6,background:gc,transition:'width .9s cubic-bezier(.2,.7,.3,1)'}}/>
                      </div>
                      {done.length>1 && (
                        <div style={{display:'flex',alignItems:'flex-end',gap:7,height:52}}>
                          {done.slice(-6).map((a,i)=>{ const h=Math.max(6,Math.round((Number(a.score)||0)/100*46));
                            const c=(window.MK&&window.MK.GC&&window.MK.GC[a.grade])||'#0090ca';
                            return <div key={i} title={(a.cycleLabel||a.cycleId||'')+' — '+(a.score==null?'—':a.score)} style={{flex:1,minWidth:12}}>
                              <div style={{height:h,borderRadius:5,background:c,opacity:i===done.slice(-6).length-1?1:.55}}/>
                            </div>; })}
                        </div>
                      )}
                      <div style={{display:'flex',gap:9,flexWrap:'wrap',alignItems:'center',borderTop:'1px solid var(--line-2)',paddingTop:11}}>
                        <span style={{fontSize:12,color:'var(--muted)'}}>{nextDue?'Next appraisal window closes '+nextDue+'.':'Appraisals run every six months from the date of joining.'}</span>
                        <span style={{flex:1}}/>
                        <button className="btn sm" onClick={()=>setRoute({view:'perfStaff',emp:perfId})}>Open performance record</button>
                      </div>
                    </div>
                  );
                })()}
            </div>
          </div>

          {/* Conduct — the achievements and incidents on this person's file. Shown
              side by side on purpose: a register that only lists what went wrong is
              not a fair record of anybody. */}
          <div className="card" style={{borderLeft:'4px solid #6a52d4'}}>
            {secHead(I.star||I.doc,'Recognition & conduct','achievements and incidents on file',{bg:'#f1eefb',fg:'#6a52d4'})}
            <div className="card-b">
              {perf===null ? <div style={{color:'var(--muted)',fontSize:12.5}}>Loading…</div>
                : (perf.achievements.length===0 && perf.incidents.length===0)
                  ? <div style={{color:'var(--muted)',fontSize:12.5}}>Nothing recorded — no achievements and no incidents on this file.</div>
                  : (
                    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(230px,1fr))',gap:14}}>
                      <div>
                        {lbl('Achievements · '+perf.achievements.length)}
                        {perf.achievements.length===0 ? <div style={{fontSize:12,color:'var(--faint)'}}>None recorded</div>
                          : perf.achievements.slice().sort((a,b)=>(b.date||'')<(a.date||'')?-1:1).slice(0,6).map((a,i)=>(
                            <div key={i} style={{display:'flex',gap:9,padding:'7px 0',borderBottom:'1px solid var(--line-2)'}}>
                              <span style={{width:8,height:8,borderRadius:'50%',background:'#1f9d57',marginTop:5,flexShrink:0}}/>
                              <div style={{minWidth:0,flex:1}}>
                                <div style={{fontSize:12.5,fontWeight:600,color:'var(--ink)'}}>{a.what||'Achievement'}</div>
                                <div style={{fontSize:11,color:'var(--muted)'}}>{[a.date,a.category,a.level,a.points?'+'+a.points+' pts':null].filter(Boolean).join(' · ')}</div>
                              </div>
                            </div>
                          ))}
                      </div>
                      <div>
                        {lbl('Incidents · '+perf.incidents.length)}
                        {perf.incidents.length===0 ? <div style={{fontSize:12,color:'var(--faint)'}}>None recorded</div>
                          : perf.incidents.slice().sort((a,b)=>(b.date||'')<(a.date||'')?-1:1).slice(0,6).map((a,i)=>(
                            <div key={i} style={{display:'flex',gap:9,padding:'7px 0',borderBottom:'1px solid var(--line-2)'}}>
                              <span style={{width:8,height:8,borderRadius:'50%',background:'#e08a1e',marginTop:5,flexShrink:0}}/>
                              <div style={{minWidth:0,flex:1}}>
                                <div style={{fontSize:12.5,fontWeight:600,color:'var(--ink)'}}>{a.what||'Incident'}</div>
                                <div style={{fontSize:11,color:'var(--muted)'}}>{[a.date,a.category,a.severity,a.points?a.points+' pts':null].filter(Boolean).join(' · ')}</div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
              <div style={{fontSize:11,color:'var(--muted)',lineHeight:1.6,marginTop:11,borderTop:'1px solid var(--line-2)',paddingTop:10}}>
                Events are logged for the record and feed the appraisal's bonus and penalty caps. They are never scored on their own.
              </div>
            </div>
          </div>

          {e.remarks&&<div className="card" style={{borderLeft:'4px solid #b5670a'}}>
            {secHead(I.doc,'Remarks',null,{bg:'#fff4e5',fg:'#b5670a'})}
            <div className="card-b"><div style={{fontSize:13,color:'var(--ink)',lineHeight:1.6}}>{e.remarks}</div></div>
          </div>}
        </div>
      </div>

      {(()=>{ const defs=(S.customFields&&S.customFields())||[]; const cv=e.custom||{};
        const shown=defs.filter(d=>String(cv[d.id]||'').trim());
        // Built-in identity / emergency fields, shown only when filled so an old record
        // that predates them doesn't sprout a card full of dashes.
        const std=[['NID / Passport No.',e.nid,true],['Blood Group',e.blood_group],
                   ['Emergency Contact',e.emergency_contact],['Emergency Contact Relation',e.emergency_relation],
                   ['Languages Spoken',e.languages]].filter(r=>String(r[1]||'').trim());
        return (std.length>0||shown.length>0) && (
          <div className="grid" style={{gridTemplateColumns:'1fr 1fr'}}>
            {std.length>0&&sec('Additional Details',std.map(([l,v,mono])=>field(l,v,mono)))}
            {shown.length>0&&sec('Custom Fields',shown.map(d=>field(d.name,cv[d.id])))}
          </div>
        ); })()}

      {/* notes */}
      <div className="card">
        <div className="card-h"><h3>Notes</h3><span className="spacer"/><span className="tag num">{(e.notes||[]).length}</span></div>
        <div className="card-b" style={{display:'flex',flexDirection:'column',gap:12}}>
          <div style={{display:'flex',gap:8}}>
            <input value={note} onChange={ev=>setNote(ev.target.value)} onKeyDown={ev=>{if(ev.key==='Enter'&&note.trim()){store.addNote(e.id,note.trim());setNote('');}}}
              placeholder="Add a note (Enter to save)…" style={{flex:1,padding:'9px 12px',border:'1px solid var(--line)',borderRadius:7,fontSize:13,fontFamily:'inherit',outline:'none'}}/>
            <button className="btn pri" onClick={()=>{if(note.trim()){store.addNote(e.id,note.trim());setNote('');}}}>Add note</button>
          </div>
          {(e.notes||[]).length===0&&<div style={{fontSize:12.5,color:'var(--faint)'}}>No notes yet.</div>}
          {(e.notes||[]).slice().reverse().map(n=>(
            <div key={n.id} style={{background:'var(--panel-2)',borderRadius:9,padding:'10px 13px'}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:3}}>
                <span style={{fontSize:10.5,color:'var(--muted)'}}>{n.author} · {new Date(n.ts).toLocaleString([],{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</span>
                <span className="spacer"/>
                <button className="icon-btn danger" style={{width:24,height:24}} onClick={()=>store.delNote(e.id,n.id)}><Ic d={I.x} s={13}/></button>
              </div>
              <div style={{fontSize:13,color:'var(--ink)'}}>{n.text}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* Seed the dynamic prior-experience rows when opening an existing record. If it
   already has structured entries, keep them. Otherwise derive prior = stored total
   − UNICO tenure and pre-fill one row, so editing never silently drops experience. */
function initPriorEntries(ex){
  const S=window.STAFF;
  if(!ex) return [];
  if(Array.isArray(ex.prior_experience_entries)&&ex.prior_experience_entries.length) return ex.prior_experience_entries;
  const unico=S.unicoYearsOf(ex);
  const total=S.expYears(ex);                       // legacy total (prior path is null here)
  const prior= total!=null ? Math.max(0, total-unico) : 0;
  if(prior>=0.08){                                   // ≥ ~1 month of prior experience
    const yr=Math.floor(prior+1e-6), mo=Math.round((prior-yr)*12);
    return [{org: ex.previous_experience || 'Experience before UNICO', years:String(yr||''), months:String(mo||'')}];
  }
  return [];
}

/* Collapsed multi-select DROPDOWN with a checkbox list + search + add-custom.
   Value is stored as a comma-separated string ("A, B") so tables/exports/profile
   that read a plain string keep working unchanged. Any stored value not in
   `options` is preserved as a custom entry. */
function MultiSelectDropdown({value, onChange, options, placeholder='Select…', labelFn, allowCustom=true}){
  const [open,setOpen]=React.useState(false);
  const [q,setQ]=React.useState('');
  const sel=String(value||'').split(',').map(x=>x.trim()).filter(Boolean);
  const extras=sel.filter(x=>!(options||[]).includes(x));
  const all=[...(options||[]),...extras];
  const lab=(o)=>labelFn?labelFn(o):o;
  const setSel=(arr)=>onChange(arr.join(', '));
  const toggle=(o)=>setSel(sel.includes(o)?sel.filter(x=>x!==o):[...sel,o]);
  const filtered=all.filter(o=>!q.trim()||lab(o).toLowerCase().includes(q.trim().toLowerCase()));
  const canAdd=allowCustom&&q.trim()&&!all.some(o=>lab(o).toLowerCase()===q.trim().toLowerCase());
  const addCustom=()=>{ const v=q.trim(); if(v&&!sel.includes(v)) setSel([...sel,v]); setQ(''); };
  return (
    <div style={{position:'relative'}}>
      <div onClick={()=>setOpen(o=>!o)} style={{minHeight:40,display:'flex',alignItems:'center',gap:7,flexWrap:'wrap',padding:'6px 10px',border:'1px solid '+(open?'var(--blue)':'var(--line)'),borderRadius:7,background:'#fff',cursor:'pointer'}}>
        {sel.length===0
          ? <span style={{fontSize:13,color:'var(--faint)'}}>{placeholder}</span>
          : sel.map(o=>(
              <span key={o} style={{display:'inline-flex',alignItems:'center',gap:6,padding:'3px 8px',borderRadius:15,fontSize:12,fontWeight:600,background:'var(--blue-50)',color:'var(--blue-700)',border:'1px solid var(--blue-100)'}}>
                {lab(o)}
                <span onClick={ev=>{ev.stopPropagation();toggle(o);}} title="Remove" style={{display:'inline-grid',placeItems:'center',cursor:'pointer',opacity:.7}}><Ic d={I.x} s={11} sw={2.4}/></span>
              </span>
            ))}
        <span className="spacer" style={{flex:1}}/>
        <Ic d={I.chevR} s={15} c="var(--faint)" style={{transform:open?'rotate(-90deg)':'rotate(90deg)',transition:'transform .15s'}}/>
      </div>
      {open&&<>
        <div onClick={()=>{setOpen(false);setQ('');}} style={{position:'fixed',inset:0,zIndex:80}}/>
        <div style={{position:'absolute',left:0,right:0,top:'calc(100% + 5px)',zIndex:81,background:'#fff',border:'1px solid var(--line)',borderRadius:9,boxShadow:'var(--shadow-pop)',overflow:'hidden'}}>
          <div style={{padding:8,borderBottom:'1px solid var(--line-2)',display:'flex',alignItems:'center',gap:8}}>
            <Ic d={I.search} s={14} c="var(--faint)"/>
            <input autoFocus value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&canAdd){e.preventDefault();addCustom();}}}
              placeholder="Search or type to add…" style={{flex:1,border:0,outline:'none',fontSize:12.5,fontFamily:'inherit',background:'transparent'}}/>
            {sel.length>0&&<button type="button" className="btn sm" onClick={()=>setSel([])} style={{padding:'3px 8px',fontSize:11}}>Clear</button>}
          </div>
          <div style={{maxHeight:240,overflowY:'auto',padding:4}}>
            {filtered.length===0&&!canAdd&&<div style={{padding:'12px',fontSize:12,color:'var(--faint)',textAlign:'center'}}>No matches</div>}
            {filtered.map(o=>{ const on=sel.includes(o); return (
              <div key={o} onClick={()=>toggle(o)} style={{display:'flex',alignItems:'center',gap:9,padding:'7px 9px',borderRadius:6,cursor:'pointer',fontSize:12.5,color:'var(--ink-2)',fontWeight:on?600:500,background:on?'var(--blue-50)':'transparent'}}
                onMouseEnter={ev=>{if(!on)ev.currentTarget.style.background='var(--panel-2)';}} onMouseLeave={ev=>{if(!on)ev.currentTarget.style.background='transparent';}}>
                <span style={{width:16,height:16,borderRadius:4,display:'grid',placeItems:'center',flexShrink:0,border:'1px solid '+(on?'var(--blue)':'var(--line)'),background:on?'var(--blue)':'#fff'}}>{on&&<Ic d={I.check} s={11} c="#fff" sw={2.6}/>}</span>
                {lab(o)}
              </div>
            );})}
            {canAdd&&<div onClick={addCustom} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 9px',borderRadius:6,cursor:'pointer',fontSize:12.5,fontWeight:600,color:'var(--blue)'}}
              onMouseEnter={ev=>ev.currentTarget.style.background='var(--blue-50)'} onMouseLeave={ev=>ev.currentTarget.style.background='transparent'}>
              <Ic d={I.plus} s={14}/>Add “{q.trim()}”
            </div>}
          </div>
        </div>
      </>}
    </div>
  );
}

/* Single-select DROPDOWN with a searchable list + add-custom — a clean replacement
   for the native <datalist> (which renders as an OS popup). Stores a plain string. */
function SelectDropdown({value, onChange, options, placeholder='Select…', labelFn, allowCustom=true}){
  const [open,setOpen]=React.useState(false);
  const [q,setQ]=React.useState('');
  const cur=String(value||'').trim();
  const extras=cur&&!(options||[]).includes(cur)?[cur]:[];
  const all=[...(options||[]),...extras];
  const lab=(o)=>labelFn?labelFn(o):o;
  const filtered=all.filter(o=>!q.trim()||lab(o).toLowerCase().includes(q.trim().toLowerCase()));
  const canAdd=allowCustom&&q.trim()&&!all.some(o=>lab(o).toLowerCase()===q.trim().toLowerCase());
  const pick=(v)=>{ onChange(v); setOpen(false); setQ(''); };
  return (
    <div style={{position:'relative'}}>
      <div onClick={()=>setOpen(o=>!o)} style={{minHeight:40,display:'flex',alignItems:'center',gap:8,padding:'8px 10px',border:'1px solid '+(open?'var(--blue)':'var(--line)'),borderRadius:7,background:'#fff',cursor:'pointer'}}>
        <span style={{flex:1,fontSize:13,color:cur?'var(--ink)':'var(--faint)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{cur?lab(cur):placeholder}</span>
        {cur&&<span onClick={ev=>{ev.stopPropagation();onChange('');}} title="Clear" style={{display:'inline-grid',placeItems:'center',cursor:'pointer',color:'var(--faint)'}}><Ic d={I.x} s={13} sw={2.2}/></span>}
        <Ic d={I.chevR} s={15} c="var(--faint)" style={{transform:open?'rotate(-90deg)':'rotate(90deg)',transition:'transform .15s'}}/>
      </div>
      {open&&<>
        <div onClick={()=>{setOpen(false);setQ('');}} style={{position:'fixed',inset:0,zIndex:80}}/>
        <div style={{position:'absolute',left:0,right:0,top:'calc(100% + 5px)',zIndex:81,background:'#fff',border:'1px solid var(--line)',borderRadius:9,boxShadow:'var(--shadow-pop)',overflow:'hidden'}}>
          <div style={{padding:8,borderBottom:'1px solid var(--line-2)',display:'flex',alignItems:'center',gap:8}}>
            <Ic d={I.search} s={14} c="var(--faint)"/>
            <input autoFocus value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();if(canAdd)pick(q.trim());else if(filtered.length)pick(filtered[0]);}}}
              placeholder="Search or type to add…" style={{flex:1,border:0,outline:'none',fontSize:12.5,fontFamily:'inherit',background:'transparent'}}/>
          </div>
          <div style={{maxHeight:260,overflowY:'auto',padding:4}}>
            {filtered.length===0&&!canAdd&&<div style={{padding:'12px',fontSize:12,color:'var(--faint)',textAlign:'center'}}>No matches</div>}
            {filtered.map(o=>{ const on=cur===o; return (
              <div key={o} onClick={()=>pick(o)} style={{display:'flex',alignItems:'center',gap:9,padding:'7px 9px',borderRadius:6,cursor:'pointer',fontSize:12.5,color:'var(--ink-2)',fontWeight:on?700:500,background:on?'var(--blue-50)':'transparent'}}
                onMouseEnter={ev=>{if(!on)ev.currentTarget.style.background='var(--panel-2)';}} onMouseLeave={ev=>{if(!on)ev.currentTarget.style.background='transparent';}}>
                <span style={{width:8,height:8,borderRadius:'50%',flexShrink:0,background:on?'var(--blue)':'transparent',border:'1px solid '+(on?'var(--blue)':'var(--line)')}}/>
                {lab(o)}
              </div>
            );})}
            {canAdd&&<div onClick={()=>pick(q.trim())} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 9px',borderRadius:6,cursor:'pointer',fontSize:12.5,fontWeight:600,color:'var(--blue)'}}
              onMouseEnter={ev=>ev.currentTarget.style.background='var(--blue-50)'} onMouseLeave={ev=>ev.currentTarget.style.background='transparent'}>
              <Ic d={I.plus} s={14}/>Add “{q.trim()}”
            </div>}
          </div>
        </div>
      </>}
    </div>
  );
}

/* FREE-TEXT FIELD WITH SUGGESTIONS.
 * A previous employer's unit is usually NOT a UNICO department, so whatever is
 * typed IS the value — the list below is only a shortcut. SelectDropdown made
 * that a three-step "open, search, click Add" flow, which is backwards for a
 * field that is free text most of the time (and made pasted/imported text
 * awkward to enter at all). */
function ComboInput({value, onChange, options, placeholder, labelFn, style}){
  const [open,setOpen]=React.useState(false);
  const lab=(o)=>labelFn?labelFn(o):o;
  const v=String(value||'');
  const q=v.trim().toLowerCase();
  const sugg=[...new Set((options||[]).map(lab).filter(Boolean))]
    .filter(l=>l.toLowerCase()!==q&&(!q||l.toLowerCase().includes(q))).slice(0,8);
  return (
    <div style={{position:'relative'}}>
      <input value={v} placeholder={placeholder} style={style}
        onChange={ev=>{onChange(ev.target.value);setOpen(true);}}
        onFocus={()=>setOpen(true)}
        onKeyDown={ev=>{if(ev.key==='Escape')setOpen(false);}}/>
      {open&&sugg.length>0&&<>
        <div onClick={()=>setOpen(false)} style={{position:'fixed',inset:0,zIndex:80}}/>
        <div style={{position:'absolute',left:0,right:0,top:'calc(100% + 4px)',zIndex:81,background:'#fff',border:'1px solid var(--line)',borderRadius:9,boxShadow:'var(--shadow-pop)',overflow:'hidden',maxHeight:220,overflowY:'auto',padding:4}}>
          {sugg.map(l=>(
            <div key={l} onMouseDown={ev=>{ev.preventDefault();onChange(l);setOpen(false);}}
              style={{padding:'7px 9px',borderRadius:6,cursor:'pointer',fontSize:12.5,color:'var(--ink-2)'}}
              onMouseEnter={ev=>ev.currentTarget.style.background='var(--panel-2)'}
              onMouseLeave={ev=>ev.currentTarget.style.background='transparent'}>{l}</div>
          ))}
        </div>
      </>}
    </div>
  );
}

/* Clinical privileges checklist — one privilege AREA per group (Assessment &
   monitoring, Airway & respiratory, …), each listing the specific activities a
   staff member can be privileged to perform. Catalogue is role-specific (Nurse vs
   PCA) and lives in window.STAFF (staff-data.js), imported from the hospital's
   privilege spreadsheet plus anything admins added in Settings → Department
   Privileges. Value is a flat {areaKey: true} map so it stores/loads like any
   other plain field on the staff record.

   `allowedKeys` (optional Set of privKey) restricts which activities are shown at
   all — used on the staff form once a department is picked, so a staff member can
   only be granted activities their department has been assigned. Pass undefined/
   null to show the full catalogue (used by the department-assignment screen
   itself, where there is no department-scoping to apply).

   `deptNames` (optional, department-assignment screen only) turns on a per-item
   "which departments have this" expander: a small toggle next to each activity
   opens an inline department-chip row (same click-to-toggle as PrivilegeDeptMatrix)
   so a specific activity can be pushed to OTHER departments right from the "By
   department" checklist, without switching to the "By privilege" tab. This writes
   straight to the department store (independent of `value`/`onChange`, which only
   track the currently-selected department(s)), so `onDeptsChanged` — if given —
   is called after every such edit to let the parent refresh its own view. */
function PrivilegesEditor({ role, value, onChange, allowedKeys, emptyHint, deptNames, deptGroups, onDeptsChanged, noTarget }){
  const S=window.STAFF;
  const allGroups=(S&&S.privilegeGroupsFor)?S.privilegeGroupsFor(role):[];
  const groups=allowedKeys
    ? allGroups.map(g=>({group:g.group,items:g.items.filter(it=>allowedKeys.has(S.privKey(g.group,it)))})).filter(g=>g.items.length>0)
    : allGroups;
  const p=value||{};
  const [q,setQ]=React.useState('');
  const [openG,setOpenG]=React.useState(()=>new Set(groups.map(g=>g.group)));
  const [expandedKey,setExpandedKey]=React.useState(null);   // privKey whose department row is open
  const [,forceLocal]=React.useState(0);
  const qn=q.trim().toLowerCase();
  const total=groups.reduce((s,g)=>s+g.items.length,0);
  const granted=groups.reduce((s,g)=>s+g.items.filter(it=>p[S.privKey(g.group,it)]).length,0);
  const toggle=(k)=>{ const next={...p}; if(next[k]) delete next[k]; else next[k]=true; onChange(next); };
  const setGroupAll=(g,on)=>{ const next={...p}; g.items.forEach(it=>{ const k=S.privKey(g.group,it); if(on) next[k]=true; else delete next[k]; }); onChange(next); };
  const toggleOpen=(gname)=>setOpenG(s=>{ const n=new Set(s); n.has(gname)?n.delete(gname):n.add(gname); return n; });
  // Direct writes to the department store for the expanded item — bypasses value/
  // onChange (those only know about the department(s) picked above), then asks
  // both this component and the parent to re-read fresh state from storage.
  const toggleDeptFor=(dept,group,item,on)=>{ S.setPrivilegeDeptAssignment(dept,role,group,item,!on); forceLocal(x=>x+1); if(onDeptsChanged) onDeptsChanged(); };
  const giveManyFor=(deps,group,item,owners)=>{ deps.forEach(d=>{ if(!owners.includes(d)) S.setPrivilegeDeptAssignment(d,role,group,item,true); }); forceLocal(x=>x+1); if(onDeptsChanged) onDeptsChanged(); };
  if(allowedKeys&&groups.length===0){
    return <div style={{fontSize:12.5,color:'var(--faint)',border:'1px dashed var(--line)',borderRadius:9,padding:'16px 14px',textAlign:'center'}}>{emptyHint||'No privileges are assigned yet.'}</div>;
  }
  return (
    <div style={{display:'flex',flexDirection:'column',gap:10}}>
      <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
        <input value={q} onChange={ev=>setQ(ev.target.value)} placeholder="Search activities…"
          style={{flex:'1 1 220px',minWidth:180,padding:'8px 11px',border:'1px solid var(--line)',borderRadius:7,fontSize:12.5,fontFamily:'inherit',outline:'none'}}/>
        {noTarget
          ? <span style={{fontSize:12,color:'var(--muted)'}}><b className="num" style={{color:'var(--ink)'}}>{total}</b> activities — click one below to assign it to department(s) directly.</span>
          : <>
              <span className="num" style={{fontSize:12,fontWeight:700,color:'var(--ink)',whiteSpace:'nowrap'}}>{granted} / {total} granted</span>
              <button type="button" className="btn sm" disabled={granted===total} onClick={()=>{ const next={...p}; groups.forEach(g=>g.items.forEach(it=>{ next[S.privKey(g.group,it)]=true; })); onChange(next); }}>Select all</button>
              <button type="button" className="btn sm" disabled={!granted} onClick={()=>{ const next={...p}; groups.forEach(g=>g.items.forEach(it=>{ delete next[S.privKey(g.group,it)]; })); onChange(next); }}>Clear all</button>
            </>}
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:8,maxHeight:460,overflowY:'auto',border:'1px solid var(--line-2)',borderRadius:9,padding:10,background:'var(--panel-2)'}}>
        {groups.map(g=>{
          const items=qn?g.items.filter(it=>it.toLowerCase().includes(qn)):g.items;
          if(qn&&items.length===0) return null;
          const gGranted=g.items.filter(it=>p[S.privKey(g.group,it)]).length;
          const open=qn?true:(allowedKeys?true:openG.has(g.group));
          return (
            <div key={g.group} style={{background:'#fff',border:'1px solid var(--line-2)',borderRadius:8}}>
              <div onClick={()=>toggleOpen(g.group)} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 11px',cursor:'pointer'}}>
                <Ic d={I.chevR} s={13} c="var(--faint)" style={{transform:open?'rotate(90deg)':'rotate(0deg)',transition:'transform .15s',flexShrink:0}}/>
                <span style={{fontSize:12.5,fontWeight:700,color:'var(--ink)',flex:1}}>{g.group}</span>
                {noTarget
                  ? <span style={{fontSize:11,color:'var(--muted)'}}>{g.items.length} activities</span>
                  : <>
                      <span className="num" style={{fontSize:11,fontWeight:600,color:gGranted?'var(--blue-700)':'var(--muted)'}}>{gGranted}/{g.items.length}</span>
                      <button type="button" className="btn sm" style={{padding:'3px 8px',fontSize:10.5}}
                        onClick={ev=>{ev.stopPropagation();setGroupAll(g,gGranted<g.items.length);}}>{gGranted<g.items.length?'Select all':'Clear'}</button>
                    </>}
              </div>
              {open&&<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(210px,1fr))',gap:'3px 10px',padding:'2px 11px 10px'}}>
                {items.map(it=>{
                  const k=S.privKey(g.group,it); const on=!!p[k];
                  const isExp=deptNames&&expandedKey===k;
                  const owners=isExp?S.privilegeDeptsAssigned(deptNames,role,g.group,it):null;
                  // With no department picked, a checkbox would mean nothing (there's
                  // nothing to grant it to) — show how many departments already have
                  // it instead, and clicking the row opens the assign-by-click panel
                  // rather than a no-op toggle.
                  const covCount=noTarget?S.privilegeDeptsAssigned(deptNames,role,g.group,it).length:null;
                  const rowClick=noTarget?(()=>setExpandedKey(isExp?null:k)):(()=>toggle(k));
                  return (
                    <React.Fragment key={k}>
                      <div style={{display:'flex',alignItems:'flex-start',gap:4}}>
                        <label onClick={rowClick} style={{display:'flex',alignItems:'flex-start',gap:7,cursor:'pointer',fontSize:12,color:'var(--ink-2)',padding:'3px 0',flex:1,minWidth:0}}>
                          {noTarget
                            ? <span className="num" title={covCount?covCount+' department'+(covCount===1?'':'s'):'No departments yet'}
                                style={{minWidth:15,height:15,marginTop:1,padding:'0 2px',borderRadius:4,display:'grid',placeItems:'center',flexShrink:0,fontSize:9,fontWeight:700,
                                  background:covCount?'var(--blue-50)':'var(--panel-2)',color:covCount?'var(--blue-700)':'var(--faint)',border:'1px solid '+(covCount?'var(--blue-100)':'var(--line)')}}>{covCount||''}</span>
                            : <span style={{width:15,height:15,marginTop:1,borderRadius:4,display:'grid',placeItems:'center',flexShrink:0,border:'1px solid '+(on?'var(--blue)':'var(--line)'),background:on?'var(--blue)':'#fff'}}>{on&&<Ic d={I.check} s={10} c="#fff" sw={2.6}/>}</span>}
                          <span>{it}</span>
                        </label>
                        {deptNames&&<span onClick={()=>setExpandedKey(isExp?null:k)} title="Which departments have this activity?"
                          style={{cursor:'pointer',color:isExp?'var(--blue)':'var(--faint)',flexShrink:0,padding:'2px 2px 0'}}>
                          <Ic d={I.chevR} s={11} style={{transform:isExp?'rotate(-90deg)':'rotate(90deg)'}}/>
                        </span>}
                      </div>
                      {isExp&&(
                        <div style={{gridColumn:'1 / -1',background:'var(--panel-2)',border:'1px solid var(--line-2)',borderRadius:8,padding:'8px 10px',display:'flex',flexDirection:'column',gap:6}}>
                          <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                            <span style={{fontSize:10.5,fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:.4}}>Departments for “{it}”</span>
                            <span className="num" style={{fontSize:10.5,fontWeight:700,color:owners.length?'var(--blue-700)':'#e08a1e'}}>{owners.length}/{deptNames.length}</span>
                            {owners.length<deptNames.length&&<>
                              <span onClick={()=>giveManyFor(deptNames,g.group,it,owners)} style={{cursor:'pointer',fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:10,background:'#fff',color:'var(--ink-2)',border:'1px dashed var(--line)'}}>+ All</span>
                              {(deptGroups||[]).map(gr=>{
                                const inSet=(gr.depts||[]).filter(d=>deptNames.includes(d)&&!owners.includes(d));
                                return inSet.length>0 ? <span key={gr.name} onClick={()=>giveManyFor(inSet,g.group,it,owners)} style={{cursor:'pointer',fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:10,background:'#fff',color:'var(--ink-2)',border:'1px dashed var(--line)'}}>+ {gr.name}</span> : null;
                              })}
                            </>}
                          </div>
                          <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                            {deptNames.map(d=>{ const dOn=owners.includes(d); return (
                              <span key={d} onClick={()=>toggleDeptFor(d,g.group,it,dOn)}
                                style={{cursor:'pointer',padding:'4px 10px',borderRadius:14,fontSize:11,fontWeight:600,
                                  border:'1px solid '+(dOn?'var(--blue)':'var(--line)'),background:dOn?'var(--blue)':'#fff',color:dOn?'#fff':'var(--ink-2)'}}>{d}</span>
                            );})}
                          </div>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* The activity-centric counterpart of PrivilegesEditor: instead of picking one
   department and ticking its activities, pick one activity and see every
   department right there as a click-to-toggle chip — no menu, no "Assign"
   button, no search-then-click. Every department name is always visible for the
   activity you're looking at; click one to grant it, click again to revoke.
   Reads/writes the exact same store as PrivilegesEditor + Settings' department
   picker, just the other way round. */
function PrivilegeDeptMatrix({ role, deptNames, deptGroups }){
  const S=window.STAFF;
  const groups=S.privilegeGroupsFor(role)||[];
  const [,force]=React.useState(0); const rerender=()=>force(x=>x+1);
  const [q,setQ]=React.useState('');
  // Collapsed by default — each row now shows every department inline, so an
  // area expanded by default would dump all 300+ activities x N departments on
  // screen at once. Searching still auto-expands whatever matches.
  const [openG,setOpenG]=React.useState(()=>new Set());
  const qn=q.trim().toLowerCase();
  const toggleOpen=(gname)=>setOpenG(s=>{ const n=new Set(s); n.has(gname)?n.delete(gname):n.add(gname); return n; });
  const toggleDept=(dept,group,item,on)=>{ S.setPrivilegeDeptAssignment(dept,role,group,item,!on); rerender(); };
  const giveMany=(deps,group,item,owners)=>{ deps.forEach(d=>{ if(!owners.includes(d)) S.setPrivilegeDeptAssignment(d,role,group,item,true); }); rerender(); };
  const groupsShown=groups
    .map(g=>({group:g.group,items: qn ? g.items.filter(it=>it.toLowerCase().includes(qn)||g.group.toLowerCase().includes(qn)) : g.items}))
    .filter(g=>g.items.length>0);
  const totalActivities=groups.reduce((s,g)=>s+g.items.length,0);
  const unassigned=groups.reduce((s,g)=>s+g.items.filter(it=>S.privilegeDeptsAssigned(deptNames,role,g.group,it).length===0).length,0);
  const quickBtn={cursor:'pointer',fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:10,background:'var(--panel-2)',color:'var(--ink-2)',border:'1px dashed var(--line)',whiteSpace:'nowrap'};
  return (
    <div style={{display:'flex',flexDirection:'column',gap:10}}>
      <div style={{fontSize:11.5,color:'var(--muted)'}}>Expand a privilege area, then click any department chip on an activity to grant or revoke it — no extra menu.</div>
      <div style={{display:'flex',alignItems:'center',gap:14,flexWrap:'wrap'}}>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search activities or areas…"
          style={{flex:'1 1 240px',minWidth:200,padding:'8px 11px',border:'1px solid var(--line)',borderRadius:7,fontSize:12.5,fontFamily:'inherit',outline:'none'}}/>
        <span style={{fontSize:12,color:'var(--muted)'}}><b className="num" style={{color:'var(--ink)'}}>{totalActivities}</b> activities</span>
        <span style={{fontSize:12,color:'var(--muted)'}}><b className="num" style={{color:unassigned?'var(--rose)':'var(--ink)'}}>{unassigned}</b> unassigned</span>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:8,maxHeight:560,overflowY:'auto',border:'1px solid var(--line-2)',borderRadius:9,padding:10,background:'var(--panel-2)'}}>
        {groupsShown.length===0&&<div style={{padding:18,textAlign:'center',color:'var(--faint)',fontSize:12.5}}>No matches.</div>}
        {groupsShown.map(g=>{
          const open=qn?true:openG.has(g.group);
          const gCovered=g.items.filter(it=>S.privilegeDeptsAssigned(deptNames,role,g.group,it).length>0).length;
          return (
            <div key={g.group} style={{background:'#fff',border:'1px solid var(--line-2)',borderRadius:8}}>
              <div onClick={()=>toggleOpen(g.group)} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 11px',cursor:'pointer'}}>
                <Ic d={I.chevR} s={13} c="var(--faint)" style={{transform:open?'rotate(90deg)':'rotate(0deg)',transition:'transform .15s',flexShrink:0}}/>
                <span style={{fontSize:12.5,fontWeight:700,color:'var(--ink)',flex:1}}>{g.group}</span>
                <span className="num" style={{fontSize:11,fontWeight:600,color:gCovered?'var(--blue-700)':'var(--muted)'}}>{gCovered}/{g.items.length} have a department</span>
              </div>
              {open&&g.items.map((it,i)=>{
                const owners=S.privilegeDeptsAssigned(deptNames,role,g.group,it);
                return (
                  <div key={it} style={{padding:'9px 11px',borderTop:i>0?'1px solid var(--line-2)':'none',display:'flex',flexDirection:'column',gap:6}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                      <span style={{fontSize:12.5,fontWeight:600,color:'var(--ink)',flex:'1 1 auto',minWidth:160}}>{it}</span>
                      <span className="num" style={{fontSize:10.5,fontWeight:700,color:owners.length?'var(--blue-700)':'#e08a1e'}}>{owners.length}/{deptNames.length}</span>
                      {owners.length<deptNames.length&&<>
                        <span onClick={()=>giveMany(deptNames,g.group,it,owners)} style={quickBtn}>+ All</span>
                        {(deptGroups||[]).map(gr=>{
                          const inSet=(gr.depts||[]).filter(d=>deptNames.includes(d)&&!owners.includes(d));
                          return inSet.length>0 ? <span key={gr.name} onClick={()=>giveMany(inSet,g.group,it,owners)} style={quickBtn}>+ {gr.name}</span> : null;
                        })}
                      </>}
                    </div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                      {deptNames.map(d=>{ const on=owners.includes(d); return (
                        <span key={d} onClick={()=>toggleDept(d,g.group,it,on)}
                          style={{cursor:'pointer',padding:'4px 10px',borderRadius:14,fontSize:11,fontWeight:600,
                            border:'1px solid '+(on?'var(--blue)':'var(--line)'),background:on?'var(--blue)':'#fff',color:on?'#fff':'var(--ink-2)'}}>{d}</span>
                      );})}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* "Matrix" — a spreadsheet-style permission grid: every activity in ONE privilege
   area down the rows, every department across the columns, one checkbox per
   crossing. Click a cell to toggle that activity for that department; click an
   activity name to toggle it for EVERY department (the whole row); click a
   department name to toggle EVERY activity in this area for that department (the
   whole column). Scoped to one privilege area at a time — all 13 areas' worth of
   activities against every department at once would be thousands of cells, so a
   tab strip picks the area instead of rendering everything simultaneously. */
function PrivilegeMatrix({ role, deptNames }){
  const S=window.STAFF;
  const groups=S.privilegeGroupsFor(role)||[];
  const [,force]=React.useState(0); const rerender=()=>force(x=>x+1);
  const [groupIdx,setGroupIdx]=React.useState(0);
  const gi=Math.min(groupIdx,Math.max(0,groups.length-1));
  const g=groups[gi]||{group:'',items:[]};
  const isOn=(dept,item)=>!!(S.deptPrivilegeMap(dept,role)||{})[S.privKey(g.group,item)];
  const toggleCell=(dept,item)=>{ S.setPrivilegeDeptAssignment(dept,role,g.group,item,!isOn(dept,item)); rerender(); };
  const rowOn=(item)=>deptNames.every(d=>isOn(d,item));
  const toggleRow=(item)=>{ const on=rowOn(item); deptNames.forEach(d=>S.setPrivilegeDeptAssignment(d,role,g.group,item,!on)); rerender(); };
  const colOn=(dept)=>g.items.length>0&&g.items.every(it=>isOn(dept,it));
  const toggleCol=(dept)=>{ const on=colOn(dept); g.items.forEach(it=>S.setPrivilegeDeptAssignment(dept,role,g.group,it,!on)); rerender(); };
  const thBase={position:'sticky',top:0,zIndex:2,padding:'8px 8px',fontSize:10.5,fontWeight:700,borderBottom:'1px solid var(--line-2)',whiteSpace:'nowrap',minWidth:64,textAlign:'center',cursor:'pointer'};
  return (
    <div style={{display:'flex',flexDirection:'column',gap:10}}>
      <div style={{fontSize:11.5,color:'var(--muted)'}}>Every activity in one privilege area against every department. Click a cell to toggle it, an activity name to toggle its whole row, or a department name to toggle its whole column.</div>
      <div style={{display:'flex',flexWrap:'wrap',gap:6,maxHeight:88,overflowY:'auto'}}>
        {groups.map((gr,i)=>(
          <button key={gr.group} type="button" className={'btn sm'+(i===gi?' pri':'')} onClick={()=>setGroupIdx(i)}>{gr.group}<span className="num" style={{opacity:.7,marginLeft:5}}>{gr.items.length}</span></button>
        ))}
      </div>
      {g.items.length===0
        ? <div style={{padding:18,textAlign:'center',color:'var(--faint)',fontSize:12.5}}>No activities in this area.</div>
        : <div style={{border:'1px solid var(--line-2)',borderRadius:9,overflow:'auto',maxHeight:560}}>
            <table style={{borderCollapse:'collapse',fontSize:12,width:'100%'}}>
              <thead>
                <tr>
                  <th style={{position:'sticky',left:0,top:0,zIndex:3,background:'#fff',minWidth:230,textAlign:'left',padding:'8px 10px',borderBottom:'1px solid var(--line-2)',borderRight:'1px solid var(--line-2)',fontSize:10.5,color:'var(--muted)'}}>Activity</th>
                  {deptNames.map(d=>{ const on=colOn(d); return (
                    <th key={d} onClick={()=>toggleCol(d)} title={'Toggle every activity in this area for '+d}
                      style={{...thBase,background:on?'var(--blue-50)':'var(--panel-2)',color:on?'var(--blue-700)':'var(--ink-2)'}}>{d}</th>
                  );})}
                </tr>
              </thead>
              <tbody>
                {g.items.map((it,ri)=>{ const on=rowOn(it); return (
                  <tr key={it}>
                    <td onClick={()=>toggleRow(it)} title={'Toggle "'+it+'" for every department'}
                      style={{position:'sticky',left:0,zIndex:1,background:on?'var(--blue-50)':'#fff',cursor:'pointer',padding:'6px 10px',fontWeight:600,color:on?'var(--blue-700)':'var(--ink)',borderRight:'1px solid var(--line-2)',borderBottom:ri<g.items.length-1?'1px solid var(--line-2)':'none',whiteSpace:'nowrap'}}>{it}</td>
                    {deptNames.map(d=>{ const cellOn=isOn(d,it); return (
                      <td key={d} onClick={()=>toggleCell(d,it)} style={{textAlign:'center',cursor:'pointer',padding:'6px 8px',borderBottom:ri<g.items.length-1?'1px solid var(--line-2)':'none',background:cellOn?'rgba(11,102,208,.06)':'transparent'}}>
                        <span style={{display:'inline-grid',placeItems:'center',width:16,height:16,borderRadius:4,border:'1px solid '+(cellOn?'var(--blue)':'var(--line)'),background:cellOn?'var(--blue)':'#fff'}}>{cellOn&&<Ic d={I.check} s={10} c="#fff" sw={2.6}/>}</span>
                      </td>
                    );})}
                  </tr>
                );})}
              </tbody>
            </table>
          </div>}
    </div>
  );
}

/* "Bulk assign" — a cart. Tick any specific activities from anywhere in the
   catalogue (mixed across privilege areas — e.g. Vital signs monitoring + IV
   cannulation + Basic life support all at once) into a running selection, THEN
   pick the department(s)/zone to push that exact bundle to in one action. This is
   the "select many specific privileges, then bulk-assign them" workflow — distinct
   from "By department" (edit one department's whole list) and "By privilege"
   (edit one activity's department list). Nothing is written until Assign/Remove
   is pressed — the cart is pure local UI state until then. */
function BulkPrivilegeAssigner({ role, deptNames, deptGroups }){
  const S=window.STAFF;
  const groups=S.privilegeGroupsFor(role)||[];
  const [,force]=React.useState(0); const rerender=()=>force(x=>x+1);
  const [q,setQ]=React.useState('');
  const [openG,setOpenG]=React.useState(()=>new Set(groups.map(g=>g.group)));
  const [cart,setCart]=React.useState({});          // {privKey: true} — the staged selection
  const [targetStr,setTargetStr]=React.useState(''); // comma-joined department names
  const qn=q.trim().toLowerCase();
  const toggleOpen=(gname)=>setOpenG(s=>{ const n=new Set(s); n.has(gname)?n.delete(gname):n.add(gname); return n; });
  const toggleCart=(key)=>setCart(c=>{ const n={...c}; if(n[key]) delete n[key]; else n[key]=true; return n; });
  const cartKeys=Object.keys(cart);
  const groupsShown=groups
    .map(g=>({group:g.group,items: qn ? g.items.filter(it=>it.toLowerCase().includes(qn)||g.group.toLowerCase().includes(qn)) : g.items}))
    .filter(g=>g.items.length>0);
  const targetDepts=String(targetStr||'').split(',').map(x=>x.trim()).filter(Boolean);
  const applyTo=(add)=>{
    if(!cartKeys.length||!targetDepts.length) return;
    targetDepts.forEach(dn=>{
      const m={...(S.deptPrivilegeMap(dn,role)||{})};
      cartKeys.forEach(k=>{ if(add) m[k]=true; else delete m[k]; });
      S.setDeptPrivilegeMap(dn,role,m);
    });
    window.UI&&window.UI.toast((add?'Assigned ':'Removed ')+cartKeys.length+' privilege'+(cartKeys.length===1?'':'s')+(add?' to ':' from ')+targetDepts.join(', '),'success');
    rerender();
  };
  return (
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      <div style={{fontSize:11.5,color:'var(--muted)'}}>Tick any specific activities below — from any privilege area, mixed together — to build a bundle, then assign (or remove) that exact bundle across one or more departments in a single action.</div>
      <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search activities or areas…"
        style={{padding:'8px 11px',border:'1px solid var(--line)',borderRadius:7,fontSize:12.5,fontFamily:'inherit',outline:'none'}}/>
      <div style={{display:'flex',flexDirection:'column',gap:8,maxHeight:380,overflowY:'auto',border:'1px solid var(--line-2)',borderRadius:9,padding:10,background:'var(--panel-2)'}}>
        {groupsShown.length===0&&<div style={{padding:18,textAlign:'center',color:'var(--faint)',fontSize:12.5}}>No matches.</div>}
        {groupsShown.map(g=>{
          const open=qn?true:openG.has(g.group);
          const gSel=g.items.filter(it=>cart[S.privKey(g.group,it)]).length;
          return (
            <div key={g.group} style={{background:'#fff',border:'1px solid var(--line-2)',borderRadius:8}}>
              <div onClick={()=>toggleOpen(g.group)} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 11px',cursor:'pointer'}}>
                <Ic d={I.chevR} s={13} c="var(--faint)" style={{transform:open?'rotate(90deg)':'rotate(0deg)',transition:'transform .15s',flexShrink:0}}/>
                <span style={{fontSize:12.5,fontWeight:700,color:'var(--ink)',flex:1}}>{g.group}</span>
                <span className="num" style={{fontSize:11,fontWeight:600,color:gSel?'var(--blue-700)':'var(--muted)'}}>{gSel}/{g.items.length}</span>
              </div>
              {open&&<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(210px,1fr))',gap:'3px 10px',padding:'2px 11px 10px'}}>
                {g.items.map(it=>{ const k=S.privKey(g.group,it); const on=!!cart[k]; return (
                  <label key={k} onClick={()=>toggleCart(k)} style={{display:'flex',alignItems:'flex-start',gap:7,cursor:'pointer',fontSize:12,color:'var(--ink-2)',padding:'3px 0'}}>
                    <span style={{width:15,height:15,marginTop:1,borderRadius:4,display:'grid',placeItems:'center',flexShrink:0,border:'1px solid '+(on?'var(--blue)':'var(--line)'),background:on?'var(--blue)':'#fff'}}>{on&&<Ic d={I.check} s={10} c="#fff" sw={2.6}/>}</span>
                    <span>{it}</span>
                  </label>
                );})}
              </div>}
            </div>
          );
        })}
      </div>
      <div style={{border:'1px solid var(--line-2)',borderRadius:9,padding:12,background:'var(--panel-2)',display:'flex',flexDirection:'column',gap:10}}>
        <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
          <span style={{fontSize:12.5,fontWeight:700,color:'var(--ink)'}}>Selected: {cartKeys.length} activit{cartKeys.length===1?'y':'ies'}</span>
          <span style={{flex:1}}/>
          <button type="button" className="btn sm" disabled={!cartKeys.length} onClick={()=>setCart({})}>Clear selection</button>
        </div>
        <div>
          <div style={{fontSize:10.5,fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:.4,marginBottom:6}}>Quick select a zone</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:7}}>
            <button type="button" className="btn sm" onClick={()=>setTargetStr(deptNames.join(', '))}>All Hospital <span className="num" style={{opacity:.7,marginLeft:4}}>{deptNames.length}</span></button>
            {(deptGroups||[]).map(g=>{
              const inSet=(g.depts||[]).filter(d=>deptNames.includes(d));
              return inSet.length>0 ? <button key={g.name} type="button" className="btn sm" onClick={()=>setTargetStr(inSet.join(', '))}>{g.name} <span className="num" style={{opacity:.7,marginLeft:4}}>{inSet.length}</span></button> : null;
            })}
          </div>
        </div>
        <div>
          <div style={{fontSize:10.5,fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:.4,marginBottom:6}}>Or pick department(s)</div>
          <MultiSelectDropdown value={targetStr} onChange={setTargetStr} options={deptNames} placeholder="Select department(s)…"/>
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center',borderTop:'1px solid var(--line-2)',paddingTop:10}}>
          <button type="button" className="btn pri" disabled={!cartKeys.length||!targetDepts.length} onClick={()=>applyTo(true)}>
            <Ic d={I.plus} s={14}/>Assign {cartKeys.length||''} to {targetDepts.length||0} department{targetDepts.length===1?'':'s'}
          </button>
          <button type="button" className="btn" style={{color:'var(--rose)',borderColor:'#f1c6cd'}} disabled={!cartKeys.length||!targetDepts.length} onClick={()=>applyTo(false)}>Remove instead</button>
        </div>
      </div>
    </div>
  );
}

/* Editor for the "quick select" department groups (All OPD, All ICU, …) used
   above the department picker in Department Privileges. Rename a group, change
   which departments it covers, delete one, or add a brand-new one — e.g. "All
   Radiology" if that's a zone this hospital wants to bulk-assign as a unit. */
function DeptGroupsManager({ deptNames, groups, onChange }){
  const [draftName,setDraftName]=React.useState('');
  const [draftDepts,setDraftDepts]=React.useState('');
  const update=(i,patch)=>onChange(groups.map((g,j)=>j===i?{...g,...patch}:g));
  const remove=(i)=>onChange(groups.filter((_,j)=>j!==i));
  const addGroup=()=>{
    const n=(draftName||'').trim(); if(!n) return;
    const d=String(draftDepts||'').split(',').map(x=>x.trim()).filter(Boolean);
    onChange([...groups,{name:n,depts:d}]);
    setDraftName(''); setDraftDepts('');
  };
  return (
    <div style={{border:'1px solid var(--line-2)',borderRadius:9,padding:12,background:'#fff',marginBottom:12,display:'flex',flexDirection:'column',gap:10}}>
      <div style={{fontSize:11.5,color:'var(--muted)'}}>Edit which departments each quick-select group covers, or add your own (e.g. “All Radiology”). These are just shortcuts — nothing here is assigned until you pick a group and tick privileges below.</div>
      {groups.map((g,i)=>(
        <div key={i} style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          <input value={g.name} onChange={e=>update(i,{name:e.target.value})} style={{width:170,padding:'8px 10px',border:'1px solid var(--line)',borderRadius:7,fontSize:12.5,fontFamily:'inherit',outline:'none'}}/>
          <div style={{flex:'1 1 260px',minWidth:220}}>
            <MultiSelectDropdown value={(g.depts||[]).join(', ')} onChange={v=>update(i,{depts:v.split(',').map(x=>x.trim()).filter(Boolean)})} options={deptNames} placeholder="No departments in this group"/>
          </div>
          <button type="button" className="icon-btn danger" title="Delete group" onClick={()=>remove(i)}><Ic d={I.x} s={14}/></button>
        </div>
      ))}
      {groups.length===0&&<div style={{fontSize:12,color:'var(--faint)'}}>No quick-select groups yet.</div>}
      <div style={{display:'flex',gap:8,flexWrap:'wrap',borderTop:'1px solid var(--line-2)',paddingTop:10}}>
        <input value={draftName} onChange={e=>setDraftName(e.target.value)} placeholder="New group name — e.g. All Radiology"
          style={{width:220,padding:'8px 10px',border:'1px solid var(--line)',borderRadius:7,fontSize:12.5,fontFamily:'inherit',outline:'none'}}/>
        <div style={{flex:'1 1 220px',minWidth:200}}>
          <MultiSelectDropdown value={draftDepts} onChange={setDraftDepts} options={deptNames} placeholder="Select departments…"/>
        </div>
        <button type="button" className="btn pri sm" onClick={addGroup} disabled={!draftName.trim()}><Ic d={I.plus} s={13}/>Add group</button>
      </div>
    </div>
  );
}

/* Settings → Department Privileges — where admins decide which catalogue
   activities apply to which department (per role), and can add activities the
   imported catalogue doesn't have. This is the ONLY place that writes the
   dept→privilege assignment the staff form's checklist filters against — the
   staff form itself is read-only against it (grant within what's assigned).
   Four views over the same store: "By department" (pick a department, tick its
   activities), "By privilege" (pick an activity, tick its departments), "Matrix"
   (a spreadsheet grid — one privilege area's activities against every department,
   with row/column bulk toggles), and "Bulk assign" (tick several specific
   activities into a selection, then push that whole bundle to chosen departments
   in one action) — whichever direction is faster for the assignment at hand. */
function DeptPrivilegesSettings({ depts }){
  const S=window.STAFF;
  const deptObjs=(depts&&depts.length)?depts:(S.DEPARTMENTS||[]).map(n=>({name:n,group:''}));
  const deptNames=[...new Set(deptObjs.map(d=>(d&&d.name)?d.name:d).filter(Boolean))];
  const [groupsOpen,setGroupsOpen]=React.useState(false);
  const deptGroups=S.deptGroupsFor(deptObjs)||[];
  const [view,setView]=React.useState('byDept');   // 'byDept' | 'byPrivilege'
  // Multi-select: several departments can be edited together as one shared privilege
  // set (checked = assigned to EVERY selected department; toggling applies to ALL of
  // them at once) — the fast path for departments that should carry the same list,
  // e.g. all ICUs, or every general ward.
  const [deptStr,setDeptStr]=React.useState(deptNames[0]||'');
  const [role,setRole]=React.useState('Nurse');
  const [copyFrom,setCopyFrom]=React.useState('');
  const [,force]=React.useState(0); const rerender=()=>force(x=>x+1);
  const [newGroup,setNewGroup]=React.useState('');
  const [newItem,setNewItem]=React.useState('');
  React.useEffect(()=>{ if(!deptStr&&deptNames.length) setDeptStr(deptNames[0]); },[deptNames.join('|')]); // eslint-disable-line

  const selDepts=String(deptStr||'').split(',').map(x=>x.trim()).filter(Boolean);
  // Display = intersection (only ticked when every selected department has it), so
  // unchecking never surprises anyone by silently removing something from a
  // department they didn't realise already had it.
  const assigned=(()=>{
    if(!selDepts.length) return {};
    const maps=selDepts.map(d=>S.deptPrivilegeMap(d,role)||{});
    const out={};
    Object.keys(maps[0]).forEach(k=>{ if(maps[0][k]&&maps.every(m=>m[k])) out[k]=true; });
    return out;
  })();
  // Diff against the intersection view and apply the SAME change to every selected
  // department — one tick/untick fans out to all of them.
  const setAssigned=(next)=>{
    if(!selDepts.length) return;
    const on=Object.keys(next).filter(k=>next[k]&&!assigned[k]);
    const off=Object.keys(assigned).filter(k=>assigned[k]&&!next[k]);
    if(!on.length&&!off.length) return;
    selDepts.forEach(d=>{
      const m={...(S.deptPrivilegeMap(d,role)||{})};
      on.forEach(k=>{ m[k]=true; }); off.forEach(k=>{ delete m[k]; });
      S.setDeptPrivilegeMap(d,role,m);
    });
    rerender();
  };
  const groupOpts=(S.privilegeGroupsFor(role)||[]).map(g=>g.group);

  const addPrivilege=()=>{
    const g=(newGroup||'').trim(), it=(newItem||'').trim();
    if(!g||!it) return;
    const ok=S.addCustomPrivilege(role,g,it);
    if(!ok){ window.UI&&window.UI.toast('That activity already exists in this area','warn'); return; }
    if(view==='byDept'&&selDepts.length) setAssigned({...assigned,[S.privKey(g,it)]:true});
    setNewItem('');
    window.UI&&window.UI.toast('Privilege “'+it+'” added'+(view==='byDept'&&selDepts.length?' and assigned to '+selDepts.join(', '):''),'success');
    rerender();
  };
  const customList=(()=>{ const all=(S.loadCustomPrivileges&&S.loadCustomPrivileges())||{}; return (all[role==='PCA'?'PCA':'Nurse']||[]).flatMap(g=>g.items.map(it=>({group:g.group,item:it}))); })();
  // Copy every activity a source department has (for this role) onto the selected
  // department(s) — ADDS on top of what they already have, never removes.
  const doCopy=()=>{
    if(!copyFrom||!selDepts.length) return;
    const srcMap=S.deptPrivilegeMap(copyFrom,role)||{};
    const keys=Object.keys(srcMap).filter(k=>srcMap[k]);
    if(!keys.length){ window.UI&&window.UI.toast(copyFrom+' has no privileges assigned yet','warn'); return; }
    selDepts.forEach(d=>{
      const m={...(S.deptPrivilegeMap(d,role)||{})};
      keys.forEach(k=>{ m[k]=true; });
      S.setDeptPrivilegeMap(d,role,m);
    });
    window.UI&&window.UI.toast('Copied '+keys.length+' activities from '+copyFrom+' to '+selDepts.join(', '),'success');
    setCopyFrom(''); rerender();
  };

  return (
    <div className="grid" style={{gap:16}}>
      <div className="card"><div className="card-b">
        <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',marginBottom:2}}>
          <div style={{fontSize:13.5,fontWeight:700,color:'var(--ink)'}}>Department privileges</div>
          <span style={{flex:1}}/>
          <div style={{display:'inline-flex',gap:3,padding:3,borderRadius:9,background:'rgba(125,145,180,.16)'}}>
            <button type="button" className={'btn sm'+(view==='byDept'?' pri':'')} onClick={()=>setView('byDept')}>By department</button>
            <button type="button" className={'btn sm'+(view==='byPrivilege'?' pri':'')} onClick={()=>setView('byPrivilege')}>By privilege</button>
            <button type="button" className={'btn sm'+(view==='matrix'?' pri':'')} onClick={()=>setView('matrix')}>Matrix</button>
            <button type="button" className={'btn sm'+(view==='bulk'?' pri':'')} onClick={()=>setView('bulk')}>Bulk assign</button>
          </div>
        </div>
        <div style={{fontSize:11.5,color:'var(--muted)',marginBottom:14}}>
          {view==='byDept'
            ? "Choose which clinical activities apply to each department, per role. Pick several departments at once to set up the same list for all of them in one pass. Once a department is set on a staff member's profile, only the activities assigned here show up for them to be granted."
            : view==='byPrivilege'
              ? 'Pick one activity and tick every department it applies to — quicker when the same activity belongs to several departments at once.'
              : view==='matrix'
                ? 'A spreadsheet view: one privilege area at a time, every activity against every department. Click a cell, a row, or a whole column.'
                : 'Tick a bundle of specific activities from anywhere in the catalogue, then assign that whole bundle to one or more departments in a single action.'}
        </div>
        {view==='byDept'&&<div style={{marginBottom:12}}>
          <div style={{fontSize:10.5,fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:.4,marginBottom:6}}>Quick select a zone</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:7,alignItems:'center'}}>
            <button type="button" className="btn sm" onClick={()=>setDeptStr(deptNames.join(', '))}>All Hospital <span className="num" style={{opacity:.7,marginLeft:4}}>{deptNames.length}</span></button>
            {deptGroups.map(g=>{
              const inThisSet=(g.depts||[]).filter(d=>deptNames.includes(d));
              return <button key={g.name} type="button" className="btn sm" title={inThisSet.join(', ')||'No departments in this group yet'} disabled={!inThisSet.length} onClick={()=>setDeptStr(inThisSet.join(', '))}>{g.name} <span className="num" style={{opacity:.7,marginLeft:4}}>{inThisSet.length}</span></button>;
            })}
            <button type="button" className="btn sm" onClick={()=>setGroupsOpen(o=>!o)}><Ic d={I.gear} s={12}/>{groupsOpen?'Done editing groups':'Manage groups'}</button>
          </div>
          {groupsOpen&&<div style={{marginTop:10}}><DeptGroupsManager deptNames={deptNames} groups={deptGroups} onChange={(g)=>{S.setDeptGroups(g);rerender();}}/></div>}
        </div>}
        <div style={{display:'flex',gap:16,flexWrap:'wrap',alignItems:'flex-end',marginBottom:14}}>
          {view==='byDept'&&<div style={{minWidth:260,flex:'1 1 260px'}}>
            <div style={{fontSize:10.5,fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:.4,marginBottom:5}}>Department{selDepts.length>1?'s':''}{selDepts.length>1?' ('+selDepts.length+' selected — edits apply to all)':''}</div>
            <MultiSelectDropdown value={deptStr} onChange={setDeptStr} options={deptNames} placeholder="Select department(s)…"/>
          </div>}
          <div>
            <div style={{fontSize:10.5,fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:.4,marginBottom:5}}>Role</div>
            <div style={{display:'inline-flex',gap:3,padding:3,borderRadius:9,background:'rgba(125,145,180,.16)'}}>
              {['Nurse','PCA'].map(r=>(
                <button key={r} type="button" onClick={()=>setRole(r)} style={{border:0,cursor:'pointer',font:'inherit',fontSize:12,fontWeight:700,padding:'7px 18px',borderRadius:7,
                  color:role===r?'#fff':'var(--muted)',background:role===r?'linear-gradient(135deg,#27a8db,#0072a3)':'transparent'}}>{r}</button>
              ))}
            </div>
          </div>
          {view==='byDept'&&selDepts.length>0&&<div style={{minWidth:220}}>
            <div style={{fontSize:10.5,fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:.4,marginBottom:5}}>Or copy from another department</div>
            <div style={{display:'flex',gap:6}}>
              <select value={copyFrom} onChange={e=>setCopyFrom(e.target.value)} style={{flex:1,padding:'8px 11px',border:'1px solid var(--line)',borderRadius:7,fontSize:13,fontFamily:'inherit',background:'#fff'}}>
                <option value="">Choose a department…</option>
                {deptNames.filter(d=>!selDepts.includes(d)).map(d=><option key={d} value={d}>{d}</option>)}
              </select>
              <button type="button" className="btn sm" disabled={!copyFrom} onClick={doCopy} title="Adds every activity that department has, on top of what's already assigned">Copy</button>
            </div>
          </div>}
        </div>
        {deptNames.length===0&&<div style={{fontSize:12.5,color:'var(--faint)'}}>No departments available yet — add one in Settings → Departments.</div>}
        {deptNames.length>0&&view==='byDept'&&
          <PrivilegesEditor role={role} value={assigned} onChange={setAssigned} deptNames={deptNames} deptGroups={deptGroups} onDeptsChanged={rerender} noTarget={!selDepts.length}/>}
        {deptNames.length>0&&view==='byPrivilege'&&<PrivilegeDeptMatrix role={role} deptNames={deptNames} deptGroups={deptGroups}/>}
        {deptNames.length>0&&view==='matrix'&&<PrivilegeMatrix role={role} deptNames={deptNames}/>}
        {deptNames.length>0&&view==='bulk'&&<BulkPrivilegeAssigner role={role} deptNames={deptNames} deptGroups={deptGroups}/>}
      </div></div>

      <div className="card"><div className="card-b">
        <div style={{fontSize:13.5,fontWeight:700,color:'var(--ink)',marginBottom:2}}>Create a new privilege</div>
        <div style={{fontSize:11.5,color:'var(--muted)',marginBottom:12}}>Add an activity that isn't in the catalogue. It's added to the {role} catalogue{(view==='byDept'&&selDepts.length)?' and assigned to '+selDepts.join(', '):''} immediately — pick an existing area or type a new one.</div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <input list="dl_privgroup" value={newGroup} onChange={e=>setNewGroup(e.target.value)} placeholder="Privilege area — e.g. 14. Telehealth"
            style={{flex:'1 1 220px',padding:'9px 11px',border:'1px solid var(--line)',borderRadius:7,fontFamily:'inherit',fontSize:13,outline:'none'}}/>
          <datalist id="dl_privgroup">{groupOpts.map(g=><option key={g} value={g}/>)}</datalist>
          <input value={newItem} onChange={e=>setNewItem(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addPrivilege();}}} placeholder="Activity name — e.g. Telehealth triage call"
            style={{flex:'1 1 240px',padding:'9px 11px',border:'1px solid var(--line)',borderRadius:7,fontFamily:'inherit',fontSize:13,outline:'none'}}/>
          <button className="btn pri" onClick={addPrivilege} disabled={!newGroup.trim()||!newItem.trim()}><Ic d={I.plus} s={14}/>Add</button>
        </div>
        {customList.length>0&&<div style={{marginTop:14}}>
          <div style={{fontSize:11,color:'var(--muted)',marginBottom:8}}>Custom activities added so far ({customList.length}) — remove one to delete it from the catalogue entirely:</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:7}}>
            {customList.map(({group,item})=>(
              <span key={group+'||'+item} style={{display:'inline-flex',alignItems:'center',gap:6,padding:'5px 10px',borderRadius:16,fontSize:12,fontWeight:600,background:'var(--blue-50)',color:'var(--blue-700)',border:'1px solid var(--blue-100)'}}>
                {item}<span style={{opacity:.7,fontWeight:500}}>· {group.replace(/^\d+\.\s*/,'')}</span>
                <span onClick={()=>{S.removeCustomPrivilege(role,group,item);rerender();}} title="Delete this privilege entirely" style={{display:'inline-grid',placeItems:'center',cursor:'pointer',opacity:.7}}><Ic d={I.x} s={11} sw={2.4}/></span>
              </span>
            ))}
          </div>
        </div>}
      </div></div>
    </div>
  );
}

/* ---------------- Add / Edit form ---------------- */
// ---- Add Staff: the mockup's right rail ------------------------------------
// Live preview of the record being typed: the ID card, the experience the register
// will compute, and where this person can be deployed. Everything here is derived
// from the form state, so it is a mirror rather than a second source of truth.
function StaffFormRail({ f, editing, set }){
  const MK = window.MK, S = window.STAFF;
  const name = (f.name || '').trim();
  const isPca = (f.role || 'Nurse') === 'PCA';
  const initials = MK ? MK.initials(name) : '?';
  const prior = (S && S.priorYearsOf) ? (S.priorYearsOf(f) || 0) : 0;
  const atUnico = (S && S.unicoYearsOf) ? (S.unicoYearsOf(f) || 0) : 0;
  const total = prior + atUnico;
  const mos = (y) => Math.max(0, Math.round(y * 12));
  const label = (y) => {
    const m = mos(y);
    if (m < 12) return m + ' mos';
    const yy = Math.floor(m / 12), mm = m % 12;
    return yy + ' yr' + (yy > 1 ? 's' : '') + (mm ? ' ' + mm + ' mo' : '');
  };
  const trainings = String(f.special_training || '').split(',').map((x) => x.trim()).filter(Boolean);
  const priorPct = total ? (prior / total) * 100 : 0;
  // current_department is a MULTI-select here, stored as "A, B" — so the first entry is
  // the primary posting and the rest are the units this person can also be pulled to.
  const depts = String(f.current_department || '').split(',').map((x) => x.trim()).filter(Boolean);
  const primary = depts[0] || '';
  const quals = String(f.qualification || '').split(',').map((x) => x.trim()).filter(Boolean);
  const privStats = (S && S.privilegeStats) ? S.privilegeStats(isPca ? 'PCA' : 'Nurse', f.privileges) : { granted: 0, total: 0 };
  // The mockup's save checklist. Each tick is the SAME condition the form itself needs,
  // so the rail can never claim 100% on a record the form would reject.
  const checks = [
    ['Name entered', !!name],
    ['Date of joining set', !!f.doj],
    ['Department assigned', depts.length > 0],
    ['Qualification selected', quals.length > 0],
  ];
  const readyPct = Math.round(checks.filter((c) => c[1]).length / checks.length * 100);
  const readyDone = readyPct === 100;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14, position:'sticky', top:12 }}>
      {/* ID preview */}
      <div className="card" style={{ background:'linear-gradient(160deg,#16243a,#0d1b2e)', border:'1px solid rgba(255,255,255,.12)', color:'#fff', padding:'22px 18px', textAlign:'center' }}>
        {/* The photo is set HERE, while the record is being created — waiting until
            the profile exists meant every new nurse started life with a placeholder.
            The upload returns a CDN url which rides along in the form state and is
            saved with the rest of the record, so there is no second step. */}
        <div style={{ display:'grid', placeItems:'center' }}>
          <PhotoPicker
            value={f.photo || null}
            onChange={(next) => set && set('photo', next)}
            initials={name ? initials : '?'} name={name || 'New staff member'}
            kind="staff" size={112} radius="50%"
            readOnly={!(window.unicoCan ? window.unicoCan('staff','edit') : true)}
            style={{ background: name ? 'linear-gradient(135deg,#3ab5a7,#0090ca)' : 'linear-gradient(135deg,#2b8f83,#0072a3)',
              fontSize:38, fontWeight:700, color:'#fff', boxShadow:'0 10px 30px rgba(0,144,202,.35)',
              display:'grid', placeItems:'center' }}/>
        </div>
        <div style={{ fontSize:16, fontWeight:700, marginTop:12 }}>{name || ('New ' + (isPca ? 'PCA' : 'nurse'))}</div>
        <div style={{ fontSize:11.6, color:'#a8bdd6', marginTop:2 }}>
          {(f.designation || (isPca ? 'Patient Care Assistant' : 'Staff Nurse'))} · {f.current_department || 'unassigned'}
        </div>
        <div style={{ display:'flex', gap:6, justifyContent:'center', flexWrap:'wrap', marginTop:10 }}>
          <span style={{ fontSize:10.4, fontWeight:600, padding:'3px 10px', borderRadius:12, background:'rgba(58,181,167,.22)', color:'#8fe3d6' }}>{label(total)} exp</span>
          {f.emp_id ? <span className="num" style={{ fontSize:10.4, fontWeight:600, padding:'3px 10px', borderRadius:12, background:'rgba(0,144,202,.22)', color:'#9ad8f4' }}>{f.emp_id}</span> : null}
          {trainings.slice(0,2).map((t) => (
            <span key={t} style={{ fontSize:10.4, fontWeight:600, padding:'3px 10px', borderRadius:12, background:'rgba(255,255,255,.14)', color:'#dfe9f5' }}>{t}</span>
          ))}
        </div>
        <div style={{ borderTop:'1px solid rgba(255,255,255,.14)', marginTop:14, paddingTop:10, fontSize:10.4, color:'#8fa3ba' }}>
          {f.photo && f.photo.url ? 'Photo saved with this record.' : 'Tap the camera to add a photo — or leave it and the initials are used.'}
        </div>
      </div>

      {/* experience */}
      <div className="card">
        <div className="card-h"><h3>Experience total</h3></div>
        <div className="card-b">
          <div style={{ display:'flex', alignItems:'baseline', gap:8 }}>
            <span className="num" style={{ fontSize:30, fontWeight:700, color:'var(--ink)', lineHeight:1 }}>{label(total)}</span>
            <span style={{ fontSize:11.5, color:'var(--muted)' }}>total</span>
          </div>
          <div style={{ marginTop:12, display:'flex', flexDirection:'column', gap:7 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:11.6 }}>
              <span style={{ width:8, height:8, borderRadius:'50%', background:'#6a52d4' }} />
              <span style={{ flex:1 }}>Before UNICO</span>
              <span className="num" style={{ fontWeight:700 }}>{label(prior)}</span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:11.6 }}>
              <span style={{ width:8, height:8, borderRadius:'50%', background:'#0090ca' }} />
              <span style={{ flex:1 }}>At UNICO</span>
              <span className="num" style={{ fontWeight:700 }}>{label(atUnico)}</span>
            </div>
          </div>
          <div style={{ display:'flex', height:7, borderRadius:5, overflow:'hidden', marginTop:10, background:'rgba(125,145,180,.2)' }}>
            <div style={{ width:priorPct + '%', background:'#6a52d4' }} />
            <div style={{ width:(100 - priorPct) + '%', background:'#0090ca' }} />
          </div>
          <div style={{ fontSize:10.6, color:'var(--muted)', marginTop:9, lineHeight:1.5 }}>
            Calculated as previous experience plus UNICO tenure from the date of joining — the same rule as the staff register.
          </div>
        </div>
      </div>

      {/* deployment */}
      <div className="card">
        <div className="card-h">
          <h3>Deployment profile</h3><div style={{ flex:1 }} />
          <span style={{ fontSize:10.4, fontWeight:600, padding:'2px 9px', borderRadius:12,
            color: depts.length > 1 ? '#157a43' : '#b5670a',
            background: depts.length > 1 ? 'rgba(31,157,87,.13)' : 'rgba(224,138,30,.15)' }}>
            {depts.length > 1 ? 'Flexible' : (primary ? 'Single unit' : 'Unassigned')}
          </span>
        </div>
        <div className="card-b" style={{ display:'flex', flexDirection:'column', gap:8, fontSize:11.8 }}>
          {[['Primary posting', primary || '—', '#0090ca'],
            // Mockup's own wording/rule: everything after the primary posting is cover.
            ['Can also cover', depts.length - 1 === 1 ? '1 unit' : Math.max(0, depts.length - 1) + ' units', '#6a52d4'],
            // 'Independent in' and 'Shifts available' still have no backing field (no
            // competency map, no shift-availability record) — show a dash rather than a
            // number the register cannot back up. Privileges now come from the checklist.
            ['Independent in', '—', '#1f9d57'],
            ['Privileges granted', privStats.total ? (privStats.granted + ' / ' + privStats.total) : '—', '#3ab5a7'],
            ['Shifts available', '—', '#e08a1e'],
            ['Designation', f.designation || '—', '#6a52d4'],
            ['Qualifications', quals.length, '#1f9d57'],
            ['Trainings on file', trainings.length, '#3ab5a7'],
            ['Hep-B status', f.hepatitis_b_vaccination || 'Unknown', '#e08a1e']].map(([k, v, c]) => (
            <div key={k} style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ width:8, height:8, borderRadius:'50%', background:c }} />
              <span style={{ flex:1, color:'var(--body,#3c4858)' }}>{k}</span>
              <span className="num" style={{ fontWeight:700, color:'var(--ink)' }}>{v}</span>
            </div>
          ))}
          <div style={{ fontSize:10.6, color:'var(--muted)', lineHeight:1.55, background:'rgba(255,255,255,.55)', borderRadius:9, padding:'9px 11px', marginTop:2 }}>
            Independent in and Shifts available stay blank — the staff record has no competency or shift-availability field to read them from. Privileges granted comes from the checklist below.
          </div>
        </div>
      </div>

      {/* ready to save — the mockup's pre-flight checklist */}
      <div className="card" style={{ padding:16, display:'flex', flexDirection:'column', gap:11 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--ink)' }}>Ready to save</div>
          <span style={{ flex:1 }} />
          <span className="num" style={{ fontSize:11, fontWeight:700, padding:'2px 9px', borderRadius:10,
            color: readyDone ? '#157a43' : '#b5670a',
            background: readyDone ? 'rgba(31,157,87,.13)' : 'rgba(224,138,30,.14)' }}>{readyPct}%</span>
        </div>
        <div style={{ height:7, borderRadius:4, background:'rgba(125,145,180,.16)', overflow:'hidden' }}>
          <div style={{ width:readyPct + '%', height:'100%', borderRadius:4,
            background: readyDone ? 'linear-gradient(90deg,#3ab5a7,#1f9d57)' : 'linear-gradient(90deg,#27a8db,#0072a3)',
            animation:'growW .6s cubic-bezier(.2,.7,.3,1)', transition:'width .4s ease' }} />
        </div>
        {checks.map(([label, ok]) => (
          <div key={label} style={{ display:'flex', alignItems:'center', gap:8, fontSize:11.5, color:'var(--muted)' }}>
            <span style={{ display:'inline-grid', placeItems:'center', width:16, height:16, borderRadius:'50%', flexShrink:0, color:'#fff',
              background: ok ? 'linear-gradient(135deg,#2fbf7f,#157a43)' : 'rgba(125,145,180,.28)',
              boxShadow: ok ? '0 2px 8px rgba(31,157,87,.35)' : 'none', transition:'all .25s' }}>
              <Ic d={I.check} s={9} sw={3.4}/>
            </span>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StaffForm({store, empId, setRoute, role, depts}){
  const editing=!!empId;
  const existing=editing?store.get(empId):null;
  const [f,setF]=React.useState(()=> existing? {...existing, prior_experience_entries:initPriorEntries(existing)} : {
    role:role||'Nurse',emp_id:'',name:'',phone:'',qualification:'',designation:'',current_department:'',doj:'',
    prior_experience_entries:[],previous_experience:'',special_training:'',extracurricular:'',hepatitis_b_vaccination:'',remarks:'',privileges:{}
  });
  const [err,setErr]=React.useState('');
  const [saved,setSaved]=React.useState(null);      // {title,sub} once the write succeeded
  const [customQ,setCustomQ]=React.useState('');
  const [customT,setCustomT]=React.useState('');
  const [customD,setCustomD]=React.useState('');
  const [customX,setCustomX]=React.useState('');   // custom extracurricular activity
  const [customL,setCustomL]=React.useState('');   // custom language
  // Direct "previous experience (excl. UNICO)" entry — a simple Years+Months input
  // used when the experience is NOT itemised by organisation below.
  const priorInit0=existing&&existing.prior_experience_years!=null&&existing.prior_experience_years!==''&&!isNaN(existing.prior_experience_years)?+existing.prior_experience_years:0;
  const [dpY,setDpY]=React.useState(()=>{const y=Math.floor(priorInit0);return y?String(y):'';});
  const [dpM,setDpM]=React.useState(()=>{const mo=Math.round((priorInit0-Math.floor(priorInit0))*12);return mo?String(mo):'';});
  const set=(k,v)=>setF(s=>({...s,[k]:v}));
  const S=window.STAFF;
  // Admin-defined custom fields (Settings → Staff Fields → Custom fields). Values live
  // on the record under f.custom[id].
  const customFieldDefs=(S.customFields&&S.customFields())||[];
  const setCustom=(id,v)=>setF(s=>({...s,custom:{...(s.custom||{}),[id]:v}}));

  const inp=(k,ph,type='text')=>(
    <input value={f[k]||''} onChange={e=>set(k,e.target.value)} placeholder={ph} type={type}
      style={{padding:'9px 11px',border:'1px solid var(--line)',borderRadius:7,fontSize:13,fontFamily:k==='phone'||k==='doj'||k==='emp_id'?'IBM Plex Mono':'inherit',outline:'none',width:'100%'}}/>
  );
  const cmb=(k,opts)=>(
    <select value={f[k]||''} onChange={e=>set(k,e.target.value)} style={{padding:'9px 11px',border:'1px solid var(--line)',borderRadius:7,fontSize:13,fontFamily:'inherit',background:'#fff',width:'100%'}}>
      <option value="">—</option>{opts.map(o=><option key={o}>{o}</option>)}
    </select>
  );
  // Combo box: pick from `opts` OR type a new value. Ensures every value already in the
  // data (e.g. "Nurse Manager", "Supervisor", any unit) is listed AND lets you add new ones.
  const cmbFree=(k,opts,ph,labelFn)=>(
    <div>
      <input list={'dl_'+k} value={f[k]||''} onChange={e=>set(k,e.target.value)} placeholder={ph||'Select or type…'}
        style={{padding:'9px 11px',border:'1px solid var(--line)',borderRadius:7,fontSize:13,fontFamily:'inherit',background:'#fff',width:'100%',outline:'none'}}/>
      <datalist id={'dl_'+k}>{opts.map(o=><option key={o} value={o}>{labelFn?labelFn(o):o}</option>)}</datalist>
    </div>
  );
  // Department / designation options — MERGED to their canonical form so duplicates
  // ("Level - 10"/"Level 10"/"Level-10", "MICU , Supervisor") collapse to one entry.
  const allStaff=(store&&store.staff)||[];
  const uniq=(arr)=>[...new Set(arr.filter(Boolean).map(x=>String(x).trim()).filter(Boolean))];
  const canon=window.staffCanonDept||((x)=>x);
  const deptLabel=window.staffDeptLabel||((x)=>x);
  const baseDepts=S.DEPARTMENTS||[];
  // Department picker is sourced from the STATISTICS module's departments (base + custom
  // via buildDepts) — those are the canonical "main" names (General OT, Cardiac OT,
  // Gynae OT, …). Falls back to the staff module list if the stats data isn't loaded.
  // Same department list Settings → Department Privileges assigns against (the `depts`
  // prop, threaded down from app.jsx's live store) — NOT a separate reconstruction, so
  // the name picked here can never drift from the name a privilege was assigned to.
  // Falls back to an ad-hoc rebuild only if this form is ever mounted without the prop.
  const statsDeptNames=(()=>{
    if(Array.isArray(depts)&&depts.length) return depts.map(d=>d&&d.name).filter(Boolean);
    try{ if(window.buildDepts){ const ov=JSON.parse(localStorage.getItem('unico_store_v3'))||{}; const m=window.buildDepts(ov); if(Array.isArray(m)&&m.length) return m.map(d=>d.name).filter(Boolean); } }catch(e){}
    return null;
  })();
  const deptOpts=(statsDeptNames&&statsDeptNames.length)
    ? [...new Set(statsDeptNames)].sort((a,b)=>a.localeCompare(b))
    : [...new Set([...baseDepts,...uniq(allStaff.map(x=>canon(x&&x.current_department)))])].filter(d=>d&&d!=='Unassigned').sort((a,b)=>deptLabel(a).localeCompare(deptLabel(b)));
  const canonDesig=window.staffCanonDesig||((x)=>x);
  const baseDesig=S.designationsFor?S.designationsFor(f.role):[];
  const desigOpts=[...new Set([...baseDesig,...uniq(allStaff.map(x=>canonDesig(x&&x.designation)))])].filter(Boolean).sort((a,b)=>a.localeCompare(b));
  // Multi-select chip picker. Stored as a comma-separated string in f[k] so tables,
  // exports and the profile view (which read a plain string) keep working unchanged.
  // Any existing value not in `opts` (e.g. a previously typed custom) is preserved.
  const chipsOf=(k)=>String(f[k]||'').split(',').map(x=>x.trim()).filter(Boolean);
  // Age from date of birth — shown beside the field so a typo'd year is obvious.
  const ageOf=(d)=>{ const t=Date.parse(d); if(isNaN(t))return null;
    const a=Math.floor((Date.now()-t)/(365.25*24*3600*1000)); return (a>=0&&a<130)?a:null; };
  // Licence expiry, judged as you type: expired / expiring within 60 days / valid.
  const licenceState=(()=>{ const t=Date.parse(f.licence_expiry); if(isNaN(t))return null;
    const days=Math.round((t-Date.now())/86400000);
    if(days<0) return {t:'Expired '+(-days)+'d ago',c:'#d23a52'};
    if(days<=60) return {t:'Expires in '+days+'d',c:'#b5670a'};
    return {t:'Valid',c:'#157a43'}; })();
  const multiChk=(k,opts,customText,setCustomText,ph)=>{
    const sel=chipsOf(k);
    const extras=sel.filter(x=>!opts.includes(x));
    const all=[...opts,...extras];
    const setSel=(arr)=>set(k,arr.join(', '));
    const toggle=(o)=>setSel(sel.includes(o)?sel.filter(x=>x!==o):[...sel,o]);
    const addCustom=()=>{ const v=(customText||'').trim(); if(v&&!sel.includes(v)) setSel([...sel,v]); setCustomText(''); };
    return (
      <div>
        <div style={{display:'flex',flexWrap:'wrap',gap:7}}>
          {all.map(o=>{ const on=sel.includes(o); return (
            <span key={o} onClick={()=>toggle(o)} style={{cursor:'pointer',display:'inline-flex',alignItems:'center',gap:6,padding:'6px 11px',borderRadius:20,fontSize:12,fontWeight:600,border:'1px solid '+(on?'var(--blue)':'var(--line)'),background:on?'var(--blue-50)':'#fff',color:on?'var(--blue-700)':'var(--ink-2)'}}>
              <span style={{width:14,height:14,borderRadius:4,display:'grid',placeItems:'center',flexShrink:0,border:'1px solid '+(on?'var(--blue)':'var(--line)'),background:on?'var(--blue)':'#fff'}}>{on&&<Ic d={I.check} s={10} c="#fff"/>}</span>
              {o}
            </span>
          );})}
        </div>
        <div style={{display:'flex',gap:7,marginTop:9}}>
          <input value={customText||''} onChange={e=>setCustomText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addCustom();}}} placeholder={ph||'Add another…'}
            style={{flex:1,padding:'8px 11px',border:'1px solid var(--line)',borderRadius:7,fontSize:12.5,fontFamily:'inherit',outline:'none'}}/>
          <button type="button" className="btn sm" onClick={addCustom} disabled={!(customText||'').trim()}><Ic d={I.plus} s={13}/>Add</button>
        </div>
      </div>
    );
  };
  const field=(label,node,extra)=>(
    <div className="field"><div style={{display:'flex',alignItems:'center'}}><label>{label}</label><span className="spacer" style={{flex:1}}/>{extra}</div>{node}</div>
  );
  const linkBtn=(t,fn)=><button onClick={fn} style={{border:0,background:'none',color:'var(--blue)',fontSize:11,fontWeight:600,cursor:'pointer'}}>{t}</button>;

  // ---- dynamic previous-experience rows + live totals ----
  const entries=f.prior_experience_entries||[];
  const entYears=(x)=>(parseFloat(x&&x.years)||0)+(parseFloat(x&&x.months)||0)/12;
  const setEntry=(i,k,v)=>set('prior_experience_entries',entries.map((x,j)=>j===i?{...x,[k]:v}:x));
  const addEntry=()=>set('prior_experience_entries',[...entries,{org:'',dept:'',years:'',months:''}]);
  const delEntry=(i)=>set('prior_experience_entries',entries.filter((_,j)=>j!==i));
  const rowsPriorSum=entries.reduce((s,x)=>s+entYears(x),0);
  const hasRows=entries.some(x=>entYears(x)>0);
  const directPrior=(parseFloat(dpY)||0)+(parseFloat(dpM)||0)/12;
  // Itemised rows win when present; otherwise use the direct field.
  const priorSum=hasRows?rowsPriorSum:directPrior;
  const unicoY=S.unicoYearsOf(f);
  const totalY=Math.round((priorSum+unicoY)*10)/10;
  const rowInp={padding:'8px 10px',border:'1px solid var(--line)',borderRadius:7,fontSize:12.5,fontFamily:'inherit',outline:'none',width:'100%'};

  const save=()=>{
    // Validation failures must be VISIBLE from the sticky header's Save too — the
    // inline error line lives at the bottom of a long form, so toast it as well.
    const fail=(m)=>{ setErr(m); try{ window.UI&&window.UI.toast&&window.UI.toast(m,'error'); }catch(e){} };
    if(!f.name||!f.name.trim()){ fail('Name is required'); return; }
    if(f.doj && isNaN(new Date(f.doj))){ fail('Date of Joining must be YYYY-MM-DD'); return; }
    const cleanEntries=entries.filter(x=>entYears(x)>0||(x.org&&x.org.trim())||(x.dept&&x.dept.trim()));
    const rowsHave=cleanEntries.some(x=>entYears(x)>0);
    const pSum=rowsHave?cleanEntries.reduce((s,x)=>s+entYears(x),0):directPrior;
    const total=Math.round((pSum+S.unicoYearsOf(f))*10)/10;
    const data={...f, role:f.role||'Nurse',
      prior_experience_entries:cleanEntries,
      prior_experience_years:Math.round(pSum*100)/100,
      total_experience_years:total,
      total_experience_text:S.fmtYM(total),
      previous_experience: rowsHave
        ? cleanEntries.map(x=>`${[x.org||'Prior role',(x.dept||'').trim()].filter(Boolean).join(' — ')} (${S.fmtYM(entYears(x))})`).join('; ')
        : (f.previous_experience||'')};
    // A failed write must NOT look like a success: only the confirmation path routes away.
    try{
      if(editing) store.update(empId,data); else store.create(data);
    }catch(ex){
      const msg=(ex&&ex.message)||'the record could not be written';
      setErr('Not saved — '+msg+'. Nothing was changed; try again.');
      try{ window.UI&&window.UI.toast&&window.UI.toast('Staff record not saved','error'); }catch(e){}
      return;
    }
    setErr('');
    setSaved({title:`${f.role||'Nurse'} record saved`,
      sub:[f.name.trim(),f.designation,(chipsOf('current_department')[0]||'unassigned')].filter(Boolean).join(' · ')});
  };
  // The overlay owns the route change so the confirmation is always seen before the
  // screen swaps out from under it.
  const leaveAfterSave=()=>{
    setSaved(null);
    setRoute(editing?{view:'staffProfile',emp:empId}:{view:(f.role||'Nurse')==='PCA'?'pca':'nurses'});
  };

  const sec=(title,kids)=>(
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      <div style={{fontSize:13,fontWeight:700,color:'var(--ink)',borderBottom:'1px solid var(--line-2)',paddingBottom:7}}>{title}</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>{kids}</div>
    </div>
  );

  const MK=window.MK;
  return (
    <div className="mk-scope grid" style={{gap:14}}>
      {/* header — matches the Add Staff mockup: icon badge, title, role toggle.
          STICKY, with its own Save/Cancel: the form is long, and scrolling all the
          way down just to save one edited field was a real complaint. */}
      <div className="card" style={{padding:'12px 18px',display:'flex',gap:13,alignItems:'center',flexWrap:'wrap',
        position:'sticky',top:0,zIndex:60,boxShadow:'0 8px 22px rgba(13,27,46,.12)'}}>
        <div style={MK?MK.iconBadge('blue',38):{}}><Ic d={editing?I.edit:I.plus} s={18}/></div>
        <div style={{flex:1,minWidth:200}}>
          <div style={{fontSize:16,fontWeight:700,color:'var(--ink)'}}>{editing?'Edit staff record':`Add new ${f.role==='PCA'?'PCA':'Nurse'}`}</div>
          <div style={{fontSize:11.6,color:'var(--muted)'}}>Role sets the designation and qualification options · total experience is calculated for you</div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <button className="btn sm" onClick={()=>setRoute(editing?{view:'staffProfile',emp:empId}:{view:(f.role||'Nurse')==='PCA'?'pca':'nurses'})}>Cancel</button>
          <button className="btn pri sm" onClick={save}><Ic d={I.check} s={15} sw={2.4}/>{editing?'Save changes':'Create staff'}</button>
        </div>
        {!editing && (
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:9.6,fontWeight:700,letterSpacing:.6,textTransform:'uppercase',color:'var(--muted)',marginBottom:5}}>Staff role</div>
            <div style={{display:'inline-flex',gap:3,padding:3,borderRadius:11,background:'rgba(125,145,180,.16)'}}>
              {['Nurse','PCA'].map(r=>(
                <button key={r} onClick={()=>set('role',r)} style={{border:0,cursor:'pointer',font:'inherit',fontSize:12,fontWeight:700,
                  padding:'6px 18px',borderRadius:9,color:(f.role||'Nurse')===r?'#fff':'var(--muted)',
                  background:(f.role||'Nurse')===r?'linear-gradient(135deg,#27a8db,#0072a3)':'transparent'}}>{r}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) 320px',gap:14,alignItems:'start'}}>
      <div className="grid" style={{gap:16,minWidth:0}}>
      <div className="grid" style={{alignItems:'start'}}>
        {editing&&<div className="card" style={{padding:'10px 16px',display:'flex',alignItems:'center',gap:12}}>
          <span style={{flex:1,fontSize:11.6,color:'var(--muted)'}}>Removing this person takes them off the active roster and moves them to Previous Staff.</span>
          <button className="btn" style={{color:'var(--rose)',borderColor:'#f1c6cd'}}
            onClick={()=>{if(confirm('Mark this employee as inactive?')){store.remove(empId);setRoute({view:(f.role||'Nurse')==='PCA'?'pca':'nurses'});}}}>Mark inactive</button>
        </div>}
        <div className="card"><div className="card-b" style={{display:'flex',flexDirection:'column',gap:20}}>
          {sec('Personal',<>
            {field('Emp ID',inp('emp_id','e.g. 11234'))}
            {field('Name *',inp('name','Full name'))}
            {field('Phone',inp('phone','01XXXXXXXXX'))}
            {field('Gender',cmb('gender',['Female','Male','Other']))}
            {field('Date of Birth',inp('dob','YYYY-MM-DD','date'),
              f.dob&&ageOf(f.dob)!=null?<span style={{fontSize:11,color:'var(--muted)'}}>{ageOf(f.dob)} yrs</span>:null)}
            <div style={{gridColumn:'1 / -1'}}>{field('Qualification'+(chipsOf('qualification').length?' · '+chipsOf('qualification').length+' selected':''),multiChk('qualification',S.qualificationsFor(f.role),customQ,setCustomQ))}</div>
            <div style={{gridColumn:'1 / -1'}}>{field('Extracurricular Activities'+(chipsOf('extracurricular').length?' · '+chipsOf('extracurricular').length+' selected':''),multiChk('extracurricular',S.EXTRACURRICULARS||[],customX,setCustomX,'Add another activity — e.g. Chess…'))}</div>
          </>)}
          {sec('Job',<>
            {field('Designation',<SelectDropdown value={f.designation} onChange={v=>set('designation',v)} options={desigOpts} labelFn={canonDesig} placeholder="Select or type — e.g. Nurse Manager, Supervisor"/>)}
            {field('Current Department'+(chipsOf('current_department').length>1?' · '+chipsOf('current_department').length+' selected':''),
              <MultiSelectDropdown value={f.current_department} onChange={v=>set('current_department',v)} options={deptOpts} labelFn={(statsDeptNames&&statsDeptNames.length)?undefined:deptLabel} placeholder="Select department(s)…"/>)}
            {field('Date of Joining',inp('doj','YYYY-MM-DD','date'))}
            {/* Which unit owns this person when they hold several. Only worth asking
                once more than one department is selected. */}
            {chipsOf('current_department').length>1
              ? field('Primary Department',
                  <SelectDropdown value={f.primary_department||''} onChange={v=>set('primary_department',v)}
                    options={chipsOf('current_department')}
                    labelFn={(statsDeptNames&&statsDeptNames.length)?undefined:deptLabel}
                    placeholder="Which unit is home?"/>)
              : null}
            {field('Total Experience',
              <div style={{padding:'9px 11px',border:'1px dashed var(--line)',borderRadius:7,fontSize:13,background:'var(--panel-2)',color:'var(--ink)',fontWeight:600}}>{S.fmtYM(totalY)}</div>,
              <span style={{fontSize:11,color:'var(--muted)'}}>auto = previous + UNICO</span>)}
            {/* No shift picker here on purpose: which shifts someone actually works is
                decided in the Duty Roster, and holding a second copy on the staff record
                would only let the two disagree. `can_float` below is different — it is a
                standing capability the roster READS, not a schedule. */}
            <div style={{gridColumn:'1 / -1'}}>
              <label style={{display:'flex',alignItems:'center',gap:9,fontSize:12.5,color:'var(--ink-2)',cursor:'pointer'}}>
                <input type="checkbox" checked={!!f.can_float} onChange={e=>set('can_float',e.target.checked)}/>
                Can be floated to other units when they are short
              </label>
            </div>
          </>)}
          {sec('Previous Experience',<>
            <div style={{gridColumn:'1 / -1',display:'flex',flexDirection:'column',gap:9}}>
              <span style={{fontSize:11.5,color:'var(--muted)'}}>Enter total experience <b>before joining UNICO</b> below — or itemise it by organisation. UNICO tenure (from Date of Joining) is then added to give total experience.</span>
              {/* Direct pre-UNICO experience — used unless itemised rows are added below. */}
              <div style={{display:'flex',alignItems:'flex-end',gap:10,flexWrap:'wrap',background:'var(--panel-2)',border:'1px solid var(--line)',borderRadius:9,padding:'11px 14px'}}>
                <div style={{display:'flex',flexDirection:'column',gap:4}}>
                  <label style={{fontSize:11,color:'var(--ink-2)',fontWeight:600}}>Previous experience (excl. UNICO)</label>
                  <div style={{display:'flex',alignItems:'center',gap:6}}>
                    <input value={hasRows?String(Math.floor(rowsPriorSum)||''):dpY} disabled={hasRows} onChange={ev=>setDpY(ev.target.value.replace(/[^\d.]/g,''))} placeholder="0" inputMode="decimal" style={{...rowInp,width:64,textAlign:'center',fontFamily:'IBM Plex Mono',opacity:hasRows?.6:1}}/>
                    <span style={{fontSize:11.5,color:'var(--muted)'}}>yrs</span>
                    <input value={hasRows?String(Math.round((rowsPriorSum%1)*12)||''):dpM} disabled={hasRows} onChange={ev=>setDpM(ev.target.value.replace(/[^\d]/g,''))} placeholder="0" inputMode="numeric" style={{...rowInp,width:64,textAlign:'center',fontFamily:'IBM Plex Mono',opacity:hasRows?.6:1}}/>
                    <span style={{fontSize:11.5,color:'var(--muted)'}}>mo</span>
                  </div>
                </div>
                {hasRows&&<span style={{fontSize:11,color:'var(--muted)',paddingBottom:6}}>Auto-summed from the organisation breakdown below.</span>}
              </div>
              <span style={{fontSize:11.5,color:'var(--muted)',marginTop:2}}>Optional — break the above down by organisation / role:</span>
              {entries.length===0&&<div style={{fontSize:12.5,color:'var(--faint)',padding:'2px 0'}}>No itemised roles added.</div>}
              {entries.length>0&&<div style={{display:'grid',gridTemplateColumns:'1fr 1fr 78px 78px 32px',gap:8,fontSize:10.5,color:'var(--muted)',textTransform:'uppercase',letterSpacing:.4,fontWeight:600}}>
                <span>Organization</span><span>Department / role</span><span>Years</span><span>Months</span><span/></div>}
              {entries.map((x,i)=>(
                <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 1fr 78px 78px 32px',gap:8,alignItems:'center'}}>
                  <input value={x.org||''} onChange={ev=>setEntry(i,'org',ev.target.value)} placeholder="Organisation — e.g. City Hospital" style={rowInp}/>
                  {/* Free-text allowed: a previous employer's unit is often not a UNICO one.
                      Rows saved before this column existed simply have no `dept`. */}
                  <ComboInput value={x.dept||''} onChange={v=>setEntry(i,'dept',v)} options={deptOpts}
                    labelFn={(statsDeptNames&&statsDeptNames.length)?undefined:deptLabel}
                    placeholder="Department / role — type anything" style={rowInp}/>
                  <input value={x.years||''} onChange={ev=>setEntry(i,'years',ev.target.value.replace(/[^\d.]/g,''))} placeholder="0" inputMode="decimal" style={{...rowInp,textAlign:'center',fontFamily:'IBM Plex Mono'}}/>
                  <input value={x.months||''} onChange={ev=>setEntry(i,'months',ev.target.value.replace(/[^\d]/g,''))} placeholder="0" inputMode="numeric" style={{...rowInp,textAlign:'center',fontFamily:'IBM Plex Mono'}}/>
                  <button className="icon-btn danger" title="Remove" onClick={()=>delEntry(i)} style={{justifySelf:'center'}}><Ic d={I.x} s={14}/></button>
                </div>
              ))}
              <div><button className="btn sm" onClick={addEntry}><Ic d={I.plus} s={14}/>Add previous experience</button></div>
              <div style={{display:'flex',gap:20,flexWrap:'wrap',background:'var(--panel-2)',borderRadius:9,padding:'11px 14px',marginTop:2}}>
                {[['Previous',S.fmtYM(priorSum),'#6a52d4'],['UNICO (from DOJ)',f.doj?S.fmtYM(unicoY):'—','#1f9d57'],['Total experience',S.fmtYM(totalY),'var(--blue)']].map(([l,v,c],i)=>(
                  <div key={l} style={{display:'flex',flexDirection:'column',gap:2}}>
                    <span style={{fontSize:10.5,color:'var(--muted)',textTransform:'uppercase',letterSpacing:.4,fontWeight:600}}>{l}</span>
                    <span className="num" style={{fontSize:i===2?18:15,fontWeight:i===2?800:700,color:c}}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </>)}
          {sec('Compliance',<>
            <div style={{gridColumn:'1 / -1'}}>{field('Special Training'+(chipsOf('special_training').length?' · '+chipsOf('special_training').length+' selected':''),multiChk('special_training',S.TRAININGS.filter(Boolean),customT,setCustomT,'Add another training…'))}</div>
            {field('Hepatitis B Vaccination',cmb('hepatitis_b_vaccination',S.VACCINATION_STATES))}
            {field('Registration / Licence No.',inp('licence_no','e.g. BNMC-12345'))}
            {/* An expired licence is a rostering problem, so it is flagged the moment
                it is typed rather than waiting for someone to audit the register. */}
            {field('Licence Expiry',inp('licence_expiry','YYYY-MM-DD','date'),
              licenceState?<span style={{fontSize:11,fontWeight:700,color:licenceState.c}}>{licenceState.t}</span>:null)}
            <div style={{gridColumn:'1 / -1'}}>{field('Remarks',inp('remarks','Any notes'))}</div>
          </>)}
          {sec('Privileges',<>
            <div style={{gridColumn:'1 / -1'}}>
              {(()=>{
                const selDepts=chipsOf('current_department');
                const allowedKeys=(S.deptPrivilegeKeysFor)?S.deptPrivilegeKeysFor(selDepts,f.role||'Nurse'):null;
                // A department typed/saved before the catalogue existed (or renamed since)
                // won't match anything in Settings — call that out explicitly rather than
                // showing the same "nothing assigned yet" message for a totally different
                // problem (this string just isn't a recognised department any more).
                const unknownDepts=selDepts.filter(d=>!deptOpts.includes(d));
                const hint=selDepts.length===0
                  ? 'Select a department above first — privileges are assigned per department, in Settings → Department Privileges.'
                  : unknownDepts.length
                    ? `“${unknownDepts.join(', ')}” isn't a department Settings → Department Privileges recognises — re-pick the department above from the dropdown (it may have been renamed), then assign its privileges in Settings.`
                    : `No privileges have been assigned to ${selDepts.join(', ')} yet for this role. Assign them in Settings → Department Privileges.`;
                return (<>
                  <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:9}}>
                    <span style={{fontSize:11.5,color:'var(--muted)'}}>Tick every clinical activity this {f.role==='PCA'?'PCA':'nurse'} is privileged to perform — filtered to what's assigned to {selDepts.length?selDepts.join(', '):'their department'}.</span>
                    <span style={{flex:1}}/>
                    <button type="button" className="btn sm" onClick={async()=>{
                      const ok=await window.UI.confirm({title:'Leave this form?',message:'Managing department privileges opens Settings and leaves this form — anything typed here will be lost unless you Save changes first.',confirmLabel:'Leave without saving'});
                      if(ok){ window.__UNICO_SETTINGS_TAB__='deptprivileges'; setRoute({view:'settings'}); }
                    }}>Manage in Settings</button>
                  </div>
                  <PrivilegesEditor role={f.role||'Nurse'} value={f.privileges||{}} onChange={v=>set('privileges',v)} allowedKeys={allowedKeys} emptyHint={hint}/>
                </>);
              })()}
            </div>
          </>)}
          {/* Identity & contact details the design carries as standard. They live here
              rather than in Personal so that section stays about who the person IS;
              these are the papers and the who-to-call. Admin-defined custom fields
              follow underneath, unchanged. */}
          {sec('Additional Details',<>
            {field('NID / Passport No.',inp('nid','National ID or passport number'))}
            {field('Blood Group',cmb('blood_group',['A+','A-','B+','B-','O+','O-','AB+','AB-']))}
            {field('Emergency Contact',inp('emergency_contact','Name & phone — e.g. Rahima, 017XXXXXXXX'))}
            {field('Emergency Contact Relation',inp('emergency_relation','e.g. Spouse, Father'))}
            <div style={{gridColumn:'1 / -1'}}>{field('Languages Spoken'+(chipsOf('languages').length?' · '+chipsOf('languages').length+' selected':''),
              multiChk('languages',['Bangla','English','Hindi','Urdu','Arabic'],customL,setCustomL,'Add another language…'))}</div>
          </>)}
          {customFieldDefs.length>0&&sec('Custom Fields',customFieldDefs.map(cf=>{
            const cv=(f.custom||{})[cf.id]||'';
            const node = cf.kind==='multi'
              ? <MultiSelectDropdown value={cv} onChange={v=>setCustom(cf.id,v)} options={cf.options||[]} placeholder={'Select '+cf.name.toLowerCase()+'…'}/>
              : cf.kind==='text'
                ? <input value={cv} onChange={e=>setCustom(cf.id,e.target.value)} placeholder={cf.name} style={{padding:'9px 11px',border:'1px solid var(--line)',borderRadius:7,fontSize:13,fontFamily:'inherit',outline:'none',width:'100%'}}/>
                : <SelectDropdown value={cv} onChange={v=>setCustom(cf.id,v)} options={cf.options||[]} placeholder={'Select '+cf.name.toLowerCase()+'…'}/>;
            return <div key={cf.id} style={cf.kind==='text'?null:{gridColumn:'1 / -1'}}>{field(cf.name,node)}</div>;
          }))}
          {err&&<div style={{fontSize:12.5,color:'var(--rose)',fontWeight:600}}>{err}</div>}
          <div style={{display:'flex',gap:10,borderTop:'1px solid var(--line-2)',paddingTop:14}}>
            <button className="btn pri" onClick={save}><Ic d={I.check} s={16} sw={2.4}/>{editing?'Save changes':'Create staff'}</button>
            <button className="btn" onClick={()=>setRoute(editing?{view:'staffProfile',emp:empId}:{view:(f.role||'Nurse')==='PCA'?'pca':'nurses'})}>Cancel</button>
          </div>
        </div></div>
      </div>
      </div>
      <StaffFormRail f={f} editing={editing} set={set}/>
      </div>
      {saved&&<StaffSavedOverlay title={saved.title} sub={saved.sub} onClose={leaveAfterSave}/>}
    </div>
  );
}

/* The mockup's save confirmation: a drawn tick over a dimmed screen. It is the ONLY
   thing between a successful write and the route change, so the user always sees that
   the record landed (a corner toast on a screen that is already swapping is missed). */
function StaffSavedOverlay({title, sub, onClose}){
  React.useEffect(()=>{ const t=setTimeout(()=>{ try{onClose&&onClose();}catch(e){} },2600); return ()=>clearTimeout(t); },[]);
  return (
    <div onClick={onClose} role="status" aria-live="polite" style={{position:'fixed',inset:0,zIndex:3000,display:'grid',placeItems:'center',background:'rgba(13,27,46,.45)',backdropFilter:'blur(4px)',WebkitBackdropFilter:'blur(4px)'}}>
      <style>{'@keyframes stfPopCard{0%{opacity:0;transform:scale(.86) translateY(12px)}60%{transform:scale(1.03)}100%{opacity:1;transform:scale(1) translateY(0)}}@keyframes stfDrawCheck{from{stroke-dashoffset:48}to{stroke-dashoffset:0}}'}</style>
      <div style={{background:'linear-gradient(152deg,rgba(255,255,255,.96),rgba(236,247,255,.88))',border:'1px solid rgba(255,255,255,.95)',borderRadius:20,padding:'30px 38px 24px',textAlign:'center',maxWidth:360,boxShadow:'0 30px 80px rgba(5,12,24,.4)',animation:'stfPopCard .35s cubic-bezier(.2,.85,.3,1.15) both'}}>
        <div style={{width:64,height:64,borderRadius:'50%',background:'rgba(31,157,87,.14)',display:'grid',placeItems:'center',margin:'0 auto 14px',boxShadow:'0 0 26px rgba(31,157,87,.3)'}}>
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#1f9d57" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" strokeDasharray="48" style={{animation:'stfDrawCheck .5s .15s ease-out both'}}/></svg>
        </div>
        <div style={{fontSize:16.5,fontWeight:800,color:'#16202e'}}>{title}</div>
        <div style={{fontSize:12.5,color:'#6c7a8c',marginTop:6}}>{sub}</div>
        <div style={{fontSize:11,color:'#9aa6b4',marginTop:12}}>Tap anywhere to close</div>
      </div>
    </div>
  );
}

Object.assign(window,{ StaffProfile, StaffForm, StaffFormRail, StaffSavedOverlay, PrivilegesEditor, PrivilegeDeptMatrix, DeptPrivilegesSettings });
