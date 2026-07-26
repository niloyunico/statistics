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
  return (
    <div className="grid" style={{gap:16}}>
      <div style={{display:'flex',alignItems:'center',gap:10}}>
        <button className="btn sm" onClick={()=>setRoute({view:backView})}><Ic d={I.chevR} s={14} style={{transform:'rotate(180deg)'}}/>{e.role==='PCA'?'PCA':'Nurses'}</button>
        <span className="spacer"/>
        <button className="btn sm" title="Delete permanently" style={{color:'#d23a52',borderColor:'#f1c6cd'}} onClick={async()=>{
          const ok=await window.UI.confirm({title:`Permanently delete ${e.name}?`,message:'This removes the record entirely and cannot be undone. (Use Deactivate to keep the record.)',danger:true,confirmLabel:'Delete permanently'});
          if(ok){store.destroy(empId);window.UI.toast('Staff record deleted','success');setRoute({view:backView});}
        }}><Ic d={I.x} s={15} sw={2.4}/>Delete record</button>
        <button className="btn pri sm" onClick={()=>setRoute({view:'staffForm',emp:e.id})}><Ic d={I.edit} s={15}/>Edit</button>
      </div>
      {/* header */}
      <div className="card feature" style={{padding:'20px 22px',display:'flex',alignItems:'center',gap:18}}>
        <Avatar name={e.name} size={72} fontSize={26}/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
            <h2 style={{margin:0,fontSize:23,fontWeight:700}}>{e.name}</h2>
            <RoleBadge role={e.role}/>
            <span className="tag">{e.emp_id}</span>
            {!e.is_active&&<span className="chip neg">Inactive</span>}
          </div>
          <div style={{fontSize:13.5,color:'var(--muted)',marginTop:3}}>{e.designation||'—'} · {e.current_department||'—'}</div>
        </div>
        {e.phone
          ? <a href={`tel:${(e.phone||'').replace(/[^\d+]/g,'')}`} title={`Call ${e.name} · ${e.phone}`} style={{display:'inline-flex',alignItems:'center',gap:9,textDecoration:'none',padding:'8px 14px',borderRadius:24,background:'#e7f6ed',border:'1px solid #bfe6cf'}}>
              <span style={{display:'inline-grid',placeItems:'center',width:30,height:30,borderRadius:'50%',background:'#1f9d57',color:'#fff'}}><Ic d={I.phone} s={15} sw={2}/></span>
              <span className="num" style={{fontSize:14.5,fontWeight:700,color:'#137a41',letterSpacing:.2}}>{e.phone}</span>
            </a>
          : <span style={{display:'inline-flex',alignItems:'center',gap:8,padding:'8px 14px',borderRadius:24,background:'var(--panel-2)',border:'1px dashed var(--line)',color:'var(--faint)',fontSize:12.5}}><Ic d={I.phone} s={15}/>No phone on file</span>}
        <div style={{width:1,height:42,background:'var(--line)'}}/>
        <div style={{textAlign:'center'}} title="Previous experience + UNICO tenure"><div className="num" style={{fontSize:22,fontWeight:600,color:'var(--blue)'}}>{totalText}</div><div style={{fontSize:11,color:'var(--muted)'}}>total experience</div></div>
        <div style={{width:1,height:42,background:'var(--line)'}}/>
        <div style={{textAlign:'center'}} title="Experience before joining UNICO (Total − UNICO)"><div className="num" style={{fontSize:22,fontWeight:600,color:'#6a52d4'}}>{priorExclText}</div><div style={{fontSize:11,color:'var(--muted)'}}>previous experience</div></div>
        <div style={{width:1,height:42,background:'var(--line)'}}/>
        <div style={{textAlign:'center'}} title={e.doj?`Joined ${e.doj}`:'No joining date on file'}><div className="num" style={{fontSize:22,fontWeight:600,color:'#1f9d57'}}>{tenure?tenure.text:'—'}</div><div style={{fontSize:11,color:'var(--muted)'}}>UNICO experience</div></div>
        <div style={{width:1,height:42,background:'var(--line)'}}/>
        <div style={{textAlign:'center'}}><VaccBadge status={e.hepatitis_b_vaccination}/><div style={{fontSize:11,color:'var(--muted)',marginTop:5}}>Hep-B status</div></div>
      </div>

      <div className="grid" style={{gridTemplateColumns:'1fr 1fr'}}>
        {sec('Personal',<>{field('Employee ID',e.emp_id,true)}{field('Phone',e.phone,true)}{field('Qualification',e.qualification)}{field('Status',e.is_active?'Active':'Inactive')}</>)}
        {sec('Job',<>{field('Designation',e.designation)}{field('Department',e.current_department)}{field('Date of Joining',e.doj,true)}{field('Total Experience',totalText,true)}</>)}
      </div>
      <div className="grid" style={{gridTemplateColumns:'1fr 1fr'}}>
        {sec('Experience',<>
          {field('Previous Experience (excl. UNICO)',priorExclText,true)}
          {field('UNICO Experience',tenure?`${tenure.text}  ·  since ${e.doj}`:'',true)}
          {field('Total Experience',totalText,true)}
          {entries.length>0 && <div style={{gridColumn:'1 / -1',display:'flex',flexDirection:'column',gap:3}}>
            <span style={{fontSize:10.5,color:'var(--muted)',textTransform:'uppercase',letterSpacing:.4,fontWeight:600}}>Prior Positions</span>
            <div style={{display:'flex',flexDirection:'column',gap:4,marginTop:2}}>
              {entries.map((x,i)=>(
                <div key={i} style={{fontSize:12.5,color:'var(--ink)',display:'flex',gap:8,alignItems:'baseline'}}>
                  <span style={{fontWeight:600}}>{x.org||'Prior role'}</span>
                  <span className="num" style={{color:'var(--muted)'}}>{S.fmtYM((parseFloat(x.years)||0)+(parseFloat(x.months)||0)/12)}</span>
                </div>
              ))}
            </div>
          </div>}
        </>)}
        {sec('Compliance',<>{field('Special Training',e.special_training)}<div style={{display:'flex',flexDirection:'column',gap:3}}><span style={{fontSize:10.5,color:'var(--muted)',textTransform:'uppercase',letterSpacing:.4,fontWeight:600}}>Hep-B Vaccination</span><div><VaccBadge status={e.hepatitis_b_vaccination}/></div></div>{field('Remarks',e.remarks)}</>)}
      </div>

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
  // Direct "previous experience (excl. UNICO)" entry — a simple Years+Months input
  // used when the experience is NOT itemised by organisation below.
  const priorInit0=existing&&existing.prior_experience_years!=null&&existing.prior_experience_years!==''&&!isNaN(existing.prior_experience_years)?+existing.prior_experience_years:0;
  const [dpY,setDpY]=React.useState(()=>{const y=Math.floor(priorInit0);return y?String(y):'';});
  const [dpM,setDpM]=React.useState(()=>{const mo=Math.round((priorInit0-Math.floor(priorInit0))*12);return mo?String(mo):'';});
  const set=(k,v)=>setF(s=>({...s,[k]:v}));
  const S=window.STAFF;

  const inp=(k,ph,type='text')=>(
    <input value={f[k]||''} onChange={e=>set(k,e.target.value)} placeholder={ph} type={type}
      style={{padding:'9px 11px',border:'1px solid var(--line)',borderRadius:7,fontSize:13,fontFamily:k==='phone'||k==='doj'||k==='emp_id'?'IBM Plex Mono':'inherit',outline:'none',width:'100%'}}/>
  );
  const cmb=(k,opts)=>(
    <select value={f[k]||''} onChange={e=>set(k,e.target.value)} style={{padding:'9px 11px',border:'1px solid var(--line)',borderRadius:7,fontSize:13,fontFamily:'inherit',background:'#fff',width:'100%'}}>
      <option value="">—</option>{opts.map(o=><option key={o}>{o}</option>)}
    </select>
  );
  // Multi-select chip picker. Stored as a comma-separated string in f[k] so tables,
  // exports and the profile view (which read a plain string) keep working unchanged.
  // Any existing value not in `opts` (e.g. a previously typed custom) is preserved.
  const chipsOf=(k)=>String(f[k]||'').split(',').map(x=>x.trim()).filter(Boolean);
  const multiChk=(k,opts,customText,setCustomText)=>{
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
          <input value={customText||''} onChange={e=>setCustomText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addCustom();}}} placeholder="Add another qualification…"
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
            {field('Designation',cmb('designation',S.designationsFor(f.role)))}
            {field('Current Department',cmb('current_department',S.DEPARTMENTS))}
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
            {field('Special Training',inp('special_training','e.g. BLS, ACLS'))}
            {field('Hepatitis B Vaccination',cmb('hepatitis_b_vaccination',S.VACCINATION_STATES))}
            {field('Remarks',inp('remarks','Any notes'))}
          </>)}
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
