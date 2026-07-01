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
  const e=store.get(empId);
  const [note,setNote]=React.useState('');
  if(!e) return <div style={{padding:40}}>Staff not found. <button className="btn sm" onClick={()=>setRoute({view:'nurses'})}>Back to roster</button></div>;
  const tenure=unicoTenure(e.doj);
  const backView=e.role==='PCA'?'pca':'nurses';
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
        <button className="btn sm"><Ic d={I.print} s={15}/>Print ID Card</button>
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
        <div style={{textAlign:'center'}}><div className="num" style={{fontSize:22,fontWeight:600,color:'var(--blue)'}}>{e.total_experience_text||'—'}</div><div style={{fontSize:11,color:'var(--muted)'}}>total experience</div></div>
        <div style={{width:1,height:42,background:'var(--line)'}}/>
        <div style={{textAlign:'center'}} title={e.doj?`Joined ${e.doj}`:'No joining date on file'}><div className="num" style={{fontSize:22,fontWeight:600,color:'#1f9d57'}}>{tenure?tenure.text:'—'}</div><div style={{fontSize:11,color:'var(--muted)'}}>UNICO experience</div></div>
        <div style={{width:1,height:42,background:'var(--line)'}}/>
        <div style={{textAlign:'center'}}><VaccBadge status={e.hepatitis_b_vaccination}/><div style={{fontSize:11,color:'var(--muted)',marginTop:5}}>Hep-B status</div></div>
      </div>

      <div className="grid" style={{gridTemplateColumns:'1fr 1fr'}}>
        {sec('Personal',<>{field('Employee ID',e.emp_id,true)}{field('Phone',e.phone,true)}{field('Qualification',e.qualification)}{field('Status',e.is_active?'Active':'Inactive')}</>)}
        {sec('Job',<>{field('Designation',e.designation)}{field('Department',e.current_department)}{field('Date of Joining',e.doj,true)}{field('Total Experience',e.total_experience_text)}</>)}
      </div>
      <div className="grid" style={{gridTemplateColumns:'1fr 1fr'}}>
        {sec('Experience',<>{field('UNICO Experience',tenure?`${tenure.text}  ·  since ${e.doj}`:'',true)}{field('Total (years)',e.total_experience_years!=null?(Math.round(e.total_experience_years*10)/10)+' yrs':'',true)}{field('Previous Experience',e.previous_experience)}</>)}
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

/* ---------------- Add / Edit form ---------------- */
function StaffForm({store, empId, setRoute, role}){
  const editing=!!empId;
  const existing=editing?store.get(empId):null;
  const [f,setF]=React.useState(()=> existing? {...existing} : {
    role:role||'Nurse',emp_id:'',name:'',phone:'',qualification:'',designation:'',current_department:'',doj:'',
    total_experience_text:'',previous_experience:'',special_training:'',hepatitis_b_vaccination:'',remarks:''
  });
  const [err,setErr]=React.useState('');
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
  const field=(label,node,extra)=>(
    <div className="field"><div style={{display:'flex',alignItems:'center'}}><label>{label}</label><span className="spacer" style={{flex:1}}/>{extra}</div>{node}</div>
  );
  const linkBtn=(t,fn)=><button onClick={fn} style={{border:0,background:'none',color:'var(--blue)',fontSize:11,fontWeight:600,cursor:'pointer'}}>{t}</button>;

  const save=()=>{
    if(!f.name||!f.name.trim()){ setErr('Name is required'); return; }
    if(f.doj && isNaN(new Date(f.doj))){ setErr('Date of Joining must be YYYY-MM-DD'); return; }
    const data={...f, role:f.role||'Nurse', total_experience_years: f.doj&&!isNaN(new Date(f.doj))? Math.round(((Date.now()-new Date(f.doj))/86400000/365.25)*10)/10 : (existing?existing.total_experience_years:null)};
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
            {field('Emp ID',inp('emp_id','UNC-0000'), !editing&&linkBtn('auto',()=>set('emp_id',store.nextEmpId())))}
            {field('Name *',inp('name','Full name'))}
            {field('Phone',inp('phone','01XXXXXXXXX'))}
            {field('Qualification',cmb('qualification',S.qualificationsFor(f.role)))}
          </>)}
          {sec('Job',<>
            {field('Designation',cmb('designation',S.designationsFor(f.role)))}
            {field('Current Department',cmb('current_department',S.DEPARTMENTS))}
            {field('Date of Joining',inp('doj','YYYY-MM-DD','date'))}
            {field('Total Experience',inp('total_experience_text','e.g. 4.5 yrs'), linkBtn('from DOJ',()=>{const r=yearsFromDOJ(f.doj);if(r)set('total_experience_text',r);else setErr('Enter a valid DOJ first');}))}
          </>)}
          {sec('Experience & Compliance',<>
            {field('Previous Experience',inp('previous_experience','Prior facilities / roles'))}
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
