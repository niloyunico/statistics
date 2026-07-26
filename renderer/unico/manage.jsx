/* UNICO — Manage Departments (CRUD + custom columns) */
function slug(s){return (s||'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')||'col';}

function DeptModal({initial, onClose, onSave, groups}){
  const editing=!!initial;
  const [name,setName]=React.useState(initial?.name||'');
  const [short,setShort]=React.useState(initial?.short||'');
  const [group,setGroup]=React.useState(initial?.group||groups[0]);
  const [desc,setDesc]=React.useState(initial?.desc||'');
  // Keep each column's original id: it is the KEY the monthly data is stored under.
  // Dropping it (and re-slugging from the label on save) orphaned every existing
  // value — the report then showed "–"/0 for every renamed column.
  const [cols,setCols]=React.useState(()=> initial?.cols?.map(c=>({id:c.id,label:c.label,pct:!!c.pct})) || [{label:'Patients',pct:false}]);
  const [err,setErr]=React.useState('');
  const [dragIdx,setDragIdx]=React.useState(null);   // row being dragged
  const [overIdx,setOverIdx]=React.useState(null);   // row hovered as drop target

  const addCol=()=>setCols(c=>[...c,{label:'',pct:false}]);
  const setCol=(i,patch)=>setCols(c=>c.map((x,j)=>j===i?{...x,...patch}:x));
  const rmCol=(i)=>setCols(c=>c.filter((_,j)=>j!==i));
  // Reorder metrics (first metric is the headline figure, so order is meaningful).
  const moveCol=(from,to)=>{ if(from==null||to==null||from===to) return;
    setCols(cs=>{ const a=cs.slice(); const [m]=a.splice(from,1); a.splice(to,0,m); return a; }); };
  const endDrag=()=>{ setDragIdx(null); setOverIdx(null); };

  const save=()=>{
    if(!name.trim()){ setErr('Department name is required'); return; }
    const clean=cols.filter(c=>c.label.trim());
    if(!clean.length){ setErr('Add at least one metric column'); return; }
    // Preserve the existing id for any column that already has one (so its stored
    // data stays connected); slug a fresh, unique id ONLY for newly-added columns.
    const used=new Set(clean.filter(c=>c.id).map(c=>c.id));
    const finalCols=clean.map(c=>{
      if(c.id) return {id:c.id,label:c.label.trim(),pct:c.pct};
      let id=slug(c.label),b=id,k=1; while(used.has(id)){id=b+'_'+(++k);} used.add(id);
      return {id,label:c.label.trim(),pct:c.pct};
    });
    // Keep the department's original headline metric on edit — the primary column is
    // NOT always the first one (e.g. many wards headline "Total"). Only fall back to
    // the first column for a new dept, or if the old primary column was deleted.
    const primaryCol=(editing && finalCols.find(c=>c.id===initial.primary)) || finalCols[0];
    const def={
      id: initial?.id || ('cust_'+Date.now().toString(36)),
      name:name.trim(), short:(short.trim()||name.trim().slice(0,5)), group:group.trim()||'Custom',
      desc:desc.trim()||'Custom department added in-app.',
      cols:finalCols, primary:primaryCol.id, primaryLabel:primaryCol.label,
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
              <span style={{fontSize:11,color:'var(--muted)',marginLeft:8}}>drag <Ic d={I.grip} s={11} style={{verticalAlign:'-1px',opacity:.7}}/> to reorder · first metric is the headline figure</span>
              <span className="spacer" style={{flex:1}}/>
              <button className="btn sm" onClick={addCol}><Ic d={I.plus} s={14}/>Add metric</button>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {cols.map((c,i)=>(
                <div key={i}
                  onDragOver={e=>{ if(dragIdx==null) return; e.preventDefault(); e.dataTransfer.dropEffect='move'; if(overIdx!==i) setOverIdx(i); }}
                  onDrop={e=>{ e.preventDefault(); moveCol(dragIdx,i); endDrag(); }}
                  style={{display:'flex',alignItems:'center',gap:9,padding:'2px 4px',borderRadius:8,transition:'background .12s,box-shadow .12s',
                    background: (overIdx===i&&dragIdx!=null&&dragIdx!==i)?'var(--blue-50)':'transparent',
                    boxShadow: (overIdx===i&&dragIdx!=null&&dragIdx!==i)?'inset 0 0 0 1px var(--blue)':'none',
                    opacity: dragIdx===i?.45:1}}>
                  <span title="Drag to reorder" draggable
                    onDragStart={e=>{ setDragIdx(i); e.dataTransfer.effectAllowed='move'; try{e.dataTransfer.setData('text/plain',String(i));}catch(_){} }}
                    onDragEnd={endDrag}
                    style={{cursor:'grab',color:'var(--muted)',display:'grid',placeItems:'center',flexShrink:0,touchAction:'none'}}><Ic d={I.grip} s={16} sw={2.6}/></span>
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
  // Departments now carry BOTH statistics AND quality (merged), so this ONE screen
  // manages the whole record. Count each department's linked quality indicators.
  const qByDept=React.useMemo(()=>{
    const m={};
    try{
      const areas=window.qualityData?window.qualityData():[];
      const qk=window.DEPTMAP?window.DEPTMAP.qkFromId:null;
      const norm=s=>String(s||'').trim().toLowerCase();
      depts.forEach(d=>{
        const key=qk?qk(d.id):null;
        const area=areas.find(a=>(key&&a.key===key)||a.deptId===d.id||norm(a.name)===norm(d.name)||norm(a.key)===norm(d.id)||norm(a.key)===norm(d.short));
        m[d.id]=area?(area.indicators||[]).length:0;
      });
    }catch(e){}
    return m;
  },[depts]);
  const totalInd=Object.keys(qByDept).reduce((s,k)=>s+qByDept[k],0);

  const onSave=(def,editing)=>{
    if(editing) store.updateDept(def.id,{name:def.name,short:def.short,group:def.group,desc:def.desc,cols:def.cols,primary:def.primary,primaryLabel:def.primaryLabel});
    else store.addDept(def);
    setModal(null);
  };

  return (
    <div className="grid" style={{gap:16}}>
      <SectionTitle icon={I.edit} title="Manage Departments" sub={`${depts.length} departments · ${totalInd} quality indicators · ${customCount} custom — one place for statistics AND quality`}
        right={(!window.unicoCan||window.unicoCan('stats','add'))?<button className="btn pri" onClick={()=>setModal({type:'add'})}><Ic d={I.plus} s={16}/>Add Department</button>:null}/>

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
                <div style={{fontSize:11.5,color:'var(--muted)',marginTop:2}}>{d.group} · {d.cols.length} metric{d.cols.length>1?'s':''} · <span style={{color:'#6a52d4',fontWeight:600}}>{qByDept[d.id]||0} quality indicator{(qByDept[d.id]||0)===1?'':'s'}</span> · {d.series.length} month{d.series.length!==1?'s':''}</div>
              </div>
              <div style={{display:'flex',gap:6,flexWrap:'wrap',maxWidth:280,justifyContent:'flex-end'}}>
                {d.cols.slice(0,4).map(c=><span key={c.id} className="col-chip">{c.label}</span>)}
                {d.cols.length>4&&<span className="col-chip">+{d.cols.length-4}</span>}
              </div>
              <div style={{display:'flex',gap:6,flexShrink:0}}>
                <button className="btn sm" title="Enter statistics data" onClick={()=>setRoute({view:'input',dept:d.id})}><Ic d={I.plus} s={14}/>Data</button>
                <button className="btn sm" title="Manage quality indicators" onClick={()=>setRoute({view:'qualityManage',dept:(window.DEPTMAP&&window.DEPTMAP.qkFromId(d.id))||d.id})}><Ic d={I.heart} s={14}/>Quality</button>
                {(!window.unicoCan||window.unicoCan('stats','edit'))&&<button className="icon-btn" title="Rename / edit metrics" onClick={()=>setModal({type:'edit',dept:d})}><Ic d={I.edit} s={15}/></button>}
                {(!window.unicoCan||window.unicoCan('stats','delete'))&&<button className="icon-btn danger" title="Delete" onClick={()=>setConfirm(d)}><Ic d={I.x} s={15}/></button>}
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
        {(!window.unicoCan||window.unicoCan('stats','add'))&&<button className="btn pri" onClick={()=>setModal({type:'add'})}><Ic d={I.plus} s={16}/>New Department</button>}
      </div>

      {modal&&<DeptModal initial={modal.type==='edit'?modal.dept:null} groups={groups} onClose={()=>setModal(null)} onSave={onSave}/>}
      {confirm&&<ConfirmModal title={`Delete ${confirm.name}?`} danger
        body={confirm.custom?'This custom department and its entered data will be permanently removed.':'This built-in department will be hidden from the platform. You can re-add it by resetting in Settings.'}
        onClose={()=>setConfirm(null)} onConfirm={()=>{store.deleteDept(confirm.id);setConfirm(null);}}/>}
    </div>
  );
}
window.ManageDepts=ManageDepts;
