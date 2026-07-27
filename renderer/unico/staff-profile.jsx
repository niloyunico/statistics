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
function StaffProfile({store, empId, setRoute}){
  const S=window.STAFF;
  const e=store.get(empId);
  const [note,setNote]=React.useState('');
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
        <button className="btn sm" title="Print / Save as PDF" onClick={()=>window.print()}><Ic d={I.print} s={15}/>Print</button>
        <button className="btn sm" title="Delete permanently" style={{color:'#d23a52',borderColor:'#f1c6cd'}} onClick={async()=>{
          const ok=await window.UI.confirm({title:`Permanently delete ${e.name}?`,message:'This removes the record entirely and cannot be undone. (Use Deactivate to keep the record.)',danger:true,confirmLabel:'Delete permanently'});
          if(ok){store.destroy(empId);window.UI.toast('Staff record deleted','success');setRoute({view:backView});}
        }}><Ic d={I.x} s={15} sw={2.4}/>Delete</button>
        <button className="btn pri sm" onClick={()=>setRoute({view:'staffForm',emp:e.id})}><Ic d={I.edit} s={15}/>Edit profile</button>
      </div>

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
                <div style={{width:104,height:120,borderRadius:10,display:'grid',placeItems:'center',fontSize:44,fontWeight:800,color:'#fff',letterSpacing:1,background:`linear-gradient(135deg,hsl(${badgeHue} 60% 52%),hsl(${(badgeHue+40)%360} 62% 42%))`}}>{badgeIni}</div>
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
              <div style={{gridColumn:'1 / -1'}}>{lbl('Department(s)')}{deptChipRow(e.current_department)}</div>
              <div>{lbl('Qualification')}{chipRow(e.qualification,{bg:'#eef8fc',fg:'#0072a3',br:'#dceffa'})}</div>
              <div>{lbl('Special Training')}{chipRow(e.special_training,{bg:'#fff4e5',fg:'#b5670a',br:'#ffe2b8'})}</div>
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
                        <div className="num" style={{fontSize:12,color:'var(--muted)',marginTop:1}}>{S.fmtYM((parseFloat(x.years)||0)+(parseFloat(x.months)||0)/12)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>}
              <div style={{fontSize:12,color:'var(--muted)',borderTop:'1px solid var(--line-2)',paddingTop:12}}>UNICO tenure since <b style={{color:'var(--ink-2)'}}>{e.doj||'—'}</b>{tenure?` · ${tenure.text}`:''}.</div>
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
        return shown.length>0 && (
          <div className="grid" style={{gridTemplateColumns:'1fr 1fr'}}>
            {sec('Additional Details',shown.map(d=>field(d.name,cv[d.id])))}
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

/* ---------------- Add / Edit form ---------------- */
function StaffForm({store, empId, setRoute, role}){
  const editing=!!empId;
  const existing=editing?store.get(empId):null;
  const [f,setF]=React.useState(()=> existing? {...existing, prior_experience_entries:initPriorEntries(existing)} : {
    role:role||'Nurse',emp_id:'',name:'',phone:'',qualification:'',designation:'',current_department:'',doj:'',
    prior_experience_entries:[],previous_experience:'',special_training:'',hepatitis_b_vaccination:'',remarks:''
  });
  const [err,setErr]=React.useState('');
  const [customQ,setCustomQ]=React.useState('');
  const [customT,setCustomT]=React.useState('');
  const [customD,setCustomD]=React.useState('');
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
  const statsDeptNames=(()=>{ try{ if(window.buildDepts){ const ov=JSON.parse(localStorage.getItem('unico_store_v3'))||{}; const m=window.buildDepts(ov); if(Array.isArray(m)&&m.length) return m.map(d=>d.name).filter(Boolean); } }catch(e){} return null; })();
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
  const addEntry=()=>set('prior_experience_entries',[...entries,{org:'',years:'',months:''}]);
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
    if(!f.name||!f.name.trim()){ setErr('Name is required'); return; }
    if(f.doj && isNaN(new Date(f.doj))){ setErr('Date of Joining must be YYYY-MM-DD'); return; }
    const cleanEntries=entries.filter(x=>entYears(x)>0||(x.org&&x.org.trim()));
    const rowsHave=cleanEntries.some(x=>entYears(x)>0);
    const pSum=rowsHave?cleanEntries.reduce((s,x)=>s+entYears(x),0):directPrior;
    const total=Math.round((pSum+S.unicoYearsOf(f))*10)/10;
    const data={...f, role:f.role||'Nurse',
      prior_experience_entries:cleanEntries,
      prior_experience_years:Math.round(pSum*100)/100,
      total_experience_years:total,
      total_experience_text:S.fmtYM(total),
      previous_experience: rowsHave
        ? cleanEntries.map(x=>`${x.org||'Prior role'} (${S.fmtYM(entYears(x))})`).join('; ')
        : (f.previous_experience||'')};
    if(editing) store.update(empId,data); else store.create(data);
    const roleView=(f.role||'Nurse')==='PCA'?'pca':'nurses';
    setRoute(editing?{view:'staffProfile',emp:empId}:{view:roleView});
  };

  const sec=(title,kids)=>(
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      <div style={{fontSize:13,fontWeight:700,color:'var(--ink)',borderBottom:'1px solid var(--line-2)',paddingBottom:7}}>{title}</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>{kids}</div>
    </div>
  );

  return (
    <div className="grid" style={{gap:16}}>
      <SectionTitle icon={editing?I.edit:I.plus} title={editing?'Edit Staff':`Add New ${f.role||'Nurse'}`} sub={editing?'Update fields and save':'Fill in the form and save'}/>
      <div className="card" style={{padding:'12px 16px',display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
        <span style={{fontSize:12.5,fontWeight:700,color:'var(--ink)'}}>Role</span>
        <div className="seg">{S.ROLES.map(r=><button key={r} className={(f.role||'Nurse')===r?'on':''} onClick={()=>set('role',r)}>{r}</button>)}</div>
        <span style={{fontSize:11.5,color:'var(--muted)'}}>Sets the designation &amp; qualification options for this {f.role||'Nurse'}.</span>
      </div>
      <div className="grid" style={{gridTemplateColumns:'230px 1fr',alignItems:'start'}}>
        <div className="card" style={{padding:18,display:'flex',flexDirection:'column',gap:12,alignItems:'center'}}>
          <Avatar name={f.name||'?'} size={140} fontSize={50}/>
          <div style={{fontSize:12,color:'var(--muted)',textAlign:'center'}}>Avatar is generated from initials.</div>
          {editing&&<button className="btn sm" style={{width:'100%',justifyContent:'center',color:'var(--rose)',borderColor:'#f1c6cd'}}
            onClick={()=>{if(confirm('Mark this employee as inactive?')){store.remove(empId);setRoute({view:(f.role||'Nurse')==='PCA'?'pca':'nurses'});}}}>Mark inactive</button>}
        </div>
        <div className="card"><div className="card-b" style={{display:'flex',flexDirection:'column',gap:20}}>
          {sec('Personal',<>
            {field('Emp ID',inp('emp_id','e.g. 11234'))}
            {field('Name *',inp('name','Full name'))}
            {field('Phone',inp('phone','01XXXXXXXXX'))}
            <div style={{gridColumn:'1 / -1'}}>{field('Qualification'+(chipsOf('qualification').length?' · '+chipsOf('qualification').length+' selected':''),multiChk('qualification',S.qualificationsFor(f.role),customQ,setCustomQ))}</div>
          </>)}
          {sec('Job',<>
            {field('Designation',<SelectDropdown value={f.designation} onChange={v=>set('designation',v)} options={desigOpts} labelFn={canonDesig} placeholder="Select or type — e.g. Nurse Manager, Supervisor"/>)}
            {field('Current Department'+(chipsOf('current_department').length>1?' · '+chipsOf('current_department').length+' selected':''),
              <MultiSelectDropdown value={f.current_department} onChange={v=>set('current_department',v)} options={deptOpts} labelFn={(statsDeptNames&&statsDeptNames.length)?undefined:deptLabel} placeholder="Select department(s)…"/>)}
            {field('Date of Joining',inp('doj','YYYY-MM-DD','date'))}
            {field('Total Experience',
              <div style={{padding:'9px 11px',border:'1px dashed var(--line)',borderRadius:7,fontSize:13,background:'var(--panel-2)',color:'var(--ink)',fontWeight:600}}>{S.fmtYM(totalY)}</div>,
              <span style={{fontSize:11,color:'var(--muted)'}}>auto = previous + UNICO</span>)}
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
              {entries.length>0&&<div style={{display:'grid',gridTemplateColumns:'1fr 78px 78px 32px',gap:8,fontSize:10.5,color:'var(--muted)',textTransform:'uppercase',letterSpacing:.4,fontWeight:600}}>
                <span>Organization / role</span><span>Years</span><span>Months</span><span/></div>}
              {entries.map((x,i)=>(
                <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 78px 78px 32px',gap:8,alignItems:'center'}}>
                  <input value={x.org||''} onChange={ev=>setEntry(i,'org',ev.target.value)} placeholder="e.g. City Hospital — Staff Nurse" style={rowInp}/>
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
            {field('Remarks',inp('remarks','Any notes'))}
          </>)}
          {customFieldDefs.length>0&&sec('Additional Details',customFieldDefs.map(cf=>{
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
  );
}

Object.assign(window,{ StaffProfile, StaffForm });
