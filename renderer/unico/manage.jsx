/* UNICO — Manage Departments (CRUD + custom columns) */
function slug(s){return (s||'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')||'col';}

function DeptModal({initial, onClose, onSave, groups}){
  const editing=!!initial;
  const [name,setName]=React.useState(initial?.name||'');
  const [short,setShort]=React.useState(initial?.short||'');
  const [group,setGroup]=React.useState(initial?.group||groups[0]);
  const [desc,setDesc]=React.useState(initial?.desc||'');
  const [cols,setCols]=React.useState(()=> initial?.cols?.map(c=>({label:c.label,pct:!!c.pct})) || [{label:'Patients',pct:false}]);
  const [err,setErr]=React.useState('');

  const addCol=()=>setCols(c=>[...c,{label:'',pct:false}]);
  const setCol=(i,patch)=>setCols(c=>c.map((x,j)=>j===i?{...x,...patch}:x));
  const rmCol=(i)=>setCols(c=>c.filter((_,j)=>j!==i));

  const save=()=>{
    if(!name.trim()){ setErr('Department name is required'); return; }
    const clean=cols.filter(c=>c.label.trim());
    if(!clean.length){ setErr('Add at least one metric column'); return; }
    const ids=[]; const finalCols=clean.map(c=>{ let id=slug(c.label); let b=id,k=1; while(ids.includes(id)){id=b+'_'+(++k);} ids.push(id); return {id,label:c.label.trim(),pct:c.pct}; });
    const def={
      id: initial?.id || ('cust_'+Date.now().toString(36)),
      name:name.trim(), short:(short.trim()||name.trim().slice(0,5)), group:group.trim()||'Custom',
      desc:desc.trim()||'Custom department added in-app.',
      cols:finalCols, primary:finalCols[0].id, primaryLabel:finalCols[0].label,
      months: initial?.months || [], data: initial?.data || []
    };
    onSave(def, editing);
  };

  return (
    <div className="modal-bg" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="modal">
        <div className="modal-h">
          <div style={{width:30,height:30,borderRadius:8,background:'var(--blue-50)',color:'var(--blue)',display:'grid',placeItems:'center'}}><Ic d={editing?I.edit:I.plus} s={17}/></div>
          <h3>{editing?'Edit Department':'New Department'}</h3>
          <span className="spacer"/>
          <button className="icon-btn" onClick={onClose}><Ic d={I.x} s={16}/></button>
        </div>
        <div style={{padding:20,display:'flex',flexDirection:'column',gap:16}}>
          <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:12}}>
            <div className="field"><label>Department name</label>
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Physiotherapy" autoFocus/></div>
            <div className="field"><label>Code / short</label>
              <input value={short} onChange={e=>setShort(e.target.value)} placeholder="e.g. PHYSIO" maxLength={8}/></div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div className="field"><label>Service line</label>
              <input list="grp-list" value={group} onChange={e=>setGroup(e.target.value)} placeholder="Service line"/>
              <datalist id="grp-list">{groups.map(g=><option key={g} value={g}/>)}</datalist></div>
            <div className="field"><label>Short description</label>
              <input value={desc} onChange={e=>setDesc(e.target.value)} placeholder="What this department tracks"/></div>
          </div>

          <div>
            <div style={{display:'flex',alignItems:'center',marginBottom:8}}>
              <div style={{fontSize:12.5,fontWeight:700,color:'var(--ink)'}}>Custom metrics</div>
              <span style={{fontSize:11,color:'var(--muted)',marginLeft:8}}>first metric is the headline figure</span>
              <span className="spacer" style={{flex:1}}/>
              <button className="btn sm" onClick={addCol}><Ic d={I.plus} s={14}/>Add metric</button>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {cols.map((c,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:9}}>
                  <span style={{width:22,height:22,borderRadius:6,display:'grid',placeItems:'center',fontSize:11,fontWeight:700,
                    background:i===0?'var(--blue)':'var(--panel-2)',color:i===0?'#fff':'var(--muted)',flexShrink:0}}>{i+1}</span>
                  <input value={c.label} onChange={e=>setCol(i,{label:e.target.value})} placeholder={i===0?'Primary metric (e.g. Total Patients)':'Metric name'}
                    style={{flex:1,padding:'8px 11px',border:'1px solid var(--line)',borderRadius:7,fontSize:13,fontFamily:'inherit',outline:'none'}}/>
                  <label className="col-chip" style={{cursor:'pointer'}}><input type="checkbox" checked={c.pct} onChange={e=>setCol(i,{pct:e.target.checked})} style={{margin:0}}/>%</label>
                  <button className="icon-btn danger" onClick={()=>rmCol(i)} disabled={cols.length<=1} style={{opacity:cols.length<=1?.4:1}}><Ic d={I.x} s={14}/></button>
                </div>
              ))}
            </div>
          </div>

          {err&&<div style={{fontSize:12,color:'var(--rose)',fontWeight:600}}>{err}</div>}
          <div style={{display:'flex',gap:10,borderTop:'1px solid var(--line-2)',paddingTop:14}}>
            <span className="spacer" style={{flex:1}}/>
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn pri" onClick={save}><Ic d={I.check} s={16} sw={2.4}/>{editing?'Save changes':'Create department'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({title,body,danger,onClose,onConfirm}){
  return (
    <div className="modal-bg" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="modal" style={{width:'min(420px,92vw)'}}>
        <div style={{padding:'22px 22px 18px'}}>
          <div style={{display:'flex',gap:12,alignItems:'flex-start'}}>
            <div style={{width:38,height:38,borderRadius:10,background:'var(--neg-bg)',color:'var(--rose)',display:'grid',placeItems:'center',flexShrink:0}}><Ic d={I.x} s={20} sw={2.4}/></div>
            <div><div style={{fontSize:15.5,fontWeight:700}}>{title}</div><div style={{fontSize:13,color:'var(--muted)',marginTop:4}}>{body}</div></div>
          </div>
          <div style={{display:'flex',gap:10,marginTop:20}}>
            <span className="spacer" style={{flex:1}}/>
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn pri" style={{background:'var(--rose)',borderColor:'var(--rose)',boxShadow:'none'}} onClick={onConfirm}>Delete</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ManageDepts({depts, store, setRoute}){
  const [modal,setModal]=React.useState(null); // {type:'add'|'edit', dept}
  const [confirm,setConfirm]=React.useState(null);
  const groups=window.UNICO.GROUPS;
  const customCount=depts.filter(d=>d.custom).length;

  const onSave=(def,editing)=>{
    if(editing) store.updateDept(def.id,{name:def.name,short:def.short,group:def.group,desc:def.desc,cols:def.cols,primary:def.primary,primaryLabel:def.primaryLabel});
    else store.addDept(def);
    setModal(null);
  };

  return (
    <div className="grid" style={{gap:16}}>
      <SectionTitle icon={I.edit} title="Manage Departments" sub={`${depts.length} active · ${customCount} custom — add, rename, delete and define custom metrics`}
        right={<button className="btn pri" onClick={()=>setModal({type:'add'})}><Ic d={I.plus} s={16}/>Add Department</button>}/>

      <div className="grid" style={{gap:10}}>
        {depts.map(d=>{
          const tone=PALETTE[(d.id.charCodeAt(0))%PALETTE.length];
          return (
            <div key={d.id} className="dept-row">
              <div style={{width:38,height:38,borderRadius:10,background:tone+'18',color:tone,display:'grid',placeItems:'center',flexShrink:0}}><Ic d={DEPT_ICON[d.id]||I.activity} s={19}/></div>
              <div style={{minWidth:0,flex:1}}>
                <div style={{display:'flex',alignItems:'center',gap:8,minWidth:0}}>
                  <span style={{fontSize:14,fontWeight:700,color:'var(--ink)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{d.name}</span>
                  <span className="tag">{d.short}</span>
                  {d.custom&&<span className="tag" style={{background:'var(--pos-bg)',color:'var(--pos)'}}>Custom</span>}
                </div>
                <div style={{fontSize:11.5,color:'var(--muted)',marginTop:2}}>{d.group} · {d.cols.length} metric{d.cols.length>1?'s':''} · {d.series.length} month{d.series.length!==1?'s':''} of data</div>
              </div>
              <div style={{display:'flex',gap:6,flexWrap:'wrap',maxWidth:280,justifyContent:'flex-end'}}>
                {d.cols.slice(0,4).map(c=><span key={c.id} className="col-chip">{c.label}</span>)}
                {d.cols.length>4&&<span className="col-chip">+{d.cols.length-4}</span>}
              </div>
              <div style={{display:'flex',gap:6,flexShrink:0}}>
                <button className="btn sm" title="Enter data" onClick={()=>setRoute({view:'input',dept:d.id})}><Ic d={I.plus} s={14}/>Data</button>
                <button className="icon-btn" title="Rename / edit" onClick={()=>setModal({type:'edit',dept:d})}><Ic d={I.edit} s={15}/></button>
                <button className="icon-btn danger" title="Delete" onClick={()=>setConfirm(d)}><Ic d={I.x} s={15}/></button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card feature" style={{padding:'16px 18px',display:'flex',alignItems:'center',gap:14}}>
        <div style={{width:38,height:38,borderRadius:10,background:'var(--blue-50)',color:'var(--blue)',display:'grid',placeItems:'center'}}><Ic d={I.plus} s={20}/></div>
        <div><div style={{fontSize:13.5,fontWeight:700}}>Add a new department with custom metrics</div>
          <div style={{fontSize:12,color:'var(--muted)'}}>Define your own fields — e.g. Physiotherapy, Blood Bank, Pharmacy — then capture data in the Data Entry module.</div></div>
        <span className="spacer"/>
        <button className="btn pri" onClick={()=>setModal({type:'add'})}><Ic d={I.plus} s={16}/>New Department</button>
      </div>

      {modal&&<DeptModal initial={modal.type==='edit'?modal.dept:null} groups={groups} onClose={()=>setModal(null)} onSave={onSave}/>}
      {confirm&&<ConfirmModal title={`Delete ${confirm.name}?`} danger
        body={confirm.custom?'This custom department and its entered data will be permanently removed.':'This built-in department will be hidden from the platform. You can re-add it by resetting in Settings.'}
        onClose={()=>setConfirm(null)} onConfirm={()=>{store.deleteDept(confirm.id);setConfirm(null);}}/>}
    </div>
  );
}
window.ManageDepts=ManageDepts;
