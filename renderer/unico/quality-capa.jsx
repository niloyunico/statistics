/* UNICO — Quality: Corrective / Preventive Action Plans (CAPA)
   Self-contained screen. Reuses globals: React, I, Ic, SectionTitle, fmt, QS,
   indStatus, statusTone, window.QUALITY_SEED, window.UI.{confirm,toast}.
   Persistence: localStorage key 'unico_capa_v1' (auto-mirrored to disk). */

const CAPA_KEY='unico_capa_v1';
const CAPA_STATUSES=['Open','In progress','Done'];
const CAPA_STATUS_TONE={Open:'#e08a1e','In progress':'#0090ca',Done:'#1f9d57'};
function capaStatusTone(s){return CAPA_STATUS_TONE[s]||'#8a93a3';}

/* localStorage-backed store (mirrors useQualityEntries pattern) */
function useCapaStore(){
  const [plans,setPlans]=React.useState(()=>{
    try{const s=JSON.parse(localStorage.getItem(CAPA_KEY));return Array.isArray(s)?s:[];}catch(e){return [];}
  });
  React.useEffect(()=>{localStorage.setItem(CAPA_KEY,JSON.stringify(plans));},[plans]);
  const nextId=()=>{ // robust unique id
    const t=Date.now();const r=Math.floor(Math.random()*1000);
    return Number(String(t)+String(r).padStart(3,'0'));
  };
  return {
    plans,
    add:(p)=>setPlans(s=>[...s,{...p,id:nextId(),ts:Date.now()}]),
    update:(id,patch)=>setPlans(s=>s.map(x=>x.id===id?{...x,...patch,ts:Date.now()}:x)),
    remove:(id)=>setPlans(s=>s.filter(x=>x.id!==id)),
  };
}

/* --- due-date parsing for "Overdue" KPI; tolerant of "Jun 2026" / dates --- */
const CAPA_MONTHS={jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
function capaDueDate(due){
  if(!due) return null;
  const s=String(due).trim();
  // "Jun 2026" / "June 2026" / "Jun-26"
  const m=s.match(/([A-Za-z]{3,})[\s\-]*'?(\d{2,4})/);
  if(m){
    const mon=CAPA_MONTHS[m[1].slice(0,3).toLowerCase()];
    if(mon!=null){let y=Number(m[2]);if(y<100)y+=2000;return new Date(y,mon+1,0);} // end of that month
  }
  const d=new Date(s);
  return isNaN(d.getTime())?null:d;
}
function capaIsOverdue(p){
  if(p.status==='Done') return false;
  const d=capaDueDate(p.due);
  if(!d) return false;
  return d.getTime()<Date.now();
}

/* --- breach radar: scan seed for breached indicators --- */
function capaScanBreaches(){
  const out=[];
  (window.qualityData?window.qualityData():(window.QUALITY_SEED||[])).forEach(d=>{
    (d.indicators||[]).forEach(ind=>{
      const breachQs=(typeof QS!=='undefined'?QS:['Q1','Q2','Q3','Q4']).filter(q=>indStatus(ind,q)==='breach');
      if(breachQs.length){
        out.push({dept:d.key,deptName:d.name,indicator:ind.name,benchmark:ind.benchmark||'benchmark',quarters:breachQs});
      }
    });
  });
  return out;
}

/* ============================ modal ============================ */
function CapaModal({plan,onClose,onSave}){
  const seed=window.qualityData?window.qualityData():(window.QUALITY_SEED||[]);
  const [f,setF]=React.useState(()=>({
    dept:plan&&plan.dept||(seed[0]&&seed[0].key)||'',
    indicator:plan&&plan.indicator||'',
    issue:plan&&plan.issue||'',
    action:plan&&plan.action||'',
    owner:plan&&plan.owner||'',
    due:plan&&plan.due||'',
    status:plan&&plan.status||'Open',
    notes:plan&&plan.notes||'',
  }));
  const set=(k,v)=>setF(s=>({...s,[k]:v}));
  const curDept=seed.find(d=>d.key===f.dept);
  const deptInds=(curDept&&curDept.indicators||[]).map(i=>i.name);
  const [indFree,setIndFree]=React.useState(()=> !!(plan&&plan.indicator&&!( (seed.find(d=>d.key===(plan.dept))||{}).indicators||[]).some(i=>i.name===plan.indicator) ));
  const errDept=!f.dept;
  const errAction=!f.action.trim();
  const save=()=>{
    if(errDept||errAction) return;
    const deptName=(seed.find(d=>d.key===f.dept)||{}).name||f.dept;
    onSave({...f,deptName});
  };
  const sel={padding:'9px 11px',border:'1px solid var(--line)',borderRadius:7,fontSize:13,fontFamily:'inherit',background:'#fff',width:'100%',outline:'none'};
  const inp={...sel,fontFamily:'inherit'};
  return (
    <div className="modal-bg" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-h">
          <div style={{width:30,height:30,borderRadius:8,background:'var(--blue-50)',color:'var(--blue)',display:'grid',placeItems:'center'}}><Ic d={plan&&plan.id?I.edit:I.plus} s={17}/></div>
          <h3>{plan&&plan.id?'Edit Action Plan':'New Action Plan'}</h3>
          <span className="spacer"/>
          <button className="icon-btn" onClick={onClose} title="Close"><Ic d={I.x} s={15}/></button>
        </div>
        <div className="card-b" style={{display:'flex',flexDirection:'column',gap:13}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div className="field">
              <label>Department <span style={{color:'var(--rose)'}}>*</span></label>
              <select style={{...sel,borderColor:errDept?'var(--rose)':'var(--line)'}} value={f.dept} onChange={e=>{set('dept',e.target.value);set('indicator','');}}>
                <option value="">— select —</option>
                {seed.map(d=><option key={d.key} value={d.key}>{d.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label style={{display:'flex',alignItems:'center'}}>Indicator<span className="spacer" style={{flex:1}}/>
                <span onClick={()=>setIndFree(v=>!v)} style={{cursor:'pointer',fontSize:10.5,fontWeight:600,color:'var(--blue)'}}>{indFree?'pick from list':'type freely'}</span>
              </label>
              {indFree||!deptInds.length
                ? <input style={inp} value={f.indicator} onChange={e=>set('indicator',e.target.value)} placeholder="Indicator name"/>
                : <select style={sel} value={f.indicator} onChange={e=>set('indicator',e.target.value)}>
                    <option value="">— select —</option>
                    {deptInds.map(n=><option key={n} value={n}>{n}</option>)}
                  </select>}
            </div>
          </div>

          <div className="field">
            <label>Issue / breach description</label>
            <input style={inp} value={f.issue} onChange={e=>set('issue',e.target.value)} placeholder="What is breaching, and the benchmark"/>
          </div>

          <div className="field">
            <label>Corrective / preventive action <span style={{color:'var(--rose)'}}>*</span></label>
            <textarea style={{...inp,minHeight:64,resize:'vertical',fontSize:13}} value={f.action} onChange={e=>set('action',e.target.value)} placeholder="Action to take"/>
            {errAction&&<span style={{fontSize:10.5,color:'var(--rose)'}}>Action is required.</span>}
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
            <div className="field"><label>Owner</label><input style={inp} value={f.owner} onChange={e=>set('owner',e.target.value)} placeholder="Responsible person"/></div>
            <div className="field"><label>Due</label><input style={inp} value={f.due} onChange={e=>set('due',e.target.value)} placeholder="e.g. Jun 2026"/></div>
            <div className="field"><label>Status</label>
              <select style={sel} value={f.status} onChange={e=>set('status',e.target.value)}>{CAPA_STATUSES.map(s=><option key={s} value={s}>{s}</option>)}</select>
            </div>
          </div>

          <div className="field"><label>Notes</label>
            <textarea style={{...inp,minHeight:48,resize:'vertical',fontSize:13}} value={f.notes} onChange={e=>set('notes',e.target.value)} placeholder="Optional notes / follow-up"/>
          </div>
        </div>
        <div className="modal-h" style={{borderTop:'1px solid var(--line)',borderBottom:0,justifyContent:'flex-end'}}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn pri" onClick={save} disabled={errDept||errAction} style={{opacity:(errDept||errAction)?.5:1}}><Ic d={I.check} s={16} sw={2.4}/>Save</button>
        </div>
      </div>
    </div>
  );
}

/* ============================ main screen ============================ */
function QualityCAPA({setRoute}){
  const store=useCapaStore();
  const [modal,setModal]=React.useState(null); // {plan} or null
  const [fDept,setFDept]=React.useState('all');
  const [fStatus,setFStatus]=React.useState('all');
  const seed=window.qualityData?window.qualityData():(window.QUALITY_SEED||[]);

  // KPI counts
  const total=store.plans.length;
  const cOpen=store.plans.filter(p=>p.status==='Open').length;
  const cProg=store.plans.filter(p=>p.status==='In progress').length;
  const cDone=store.plans.filter(p=>p.status==='Done').length;
  const cOver=store.plans.filter(capaIsOverdue).length;

  // breach radar — exclude breaches that already have a plan (dept+indicator match)
  const allBreaches=React.useMemo(()=>capaScanBreaches(),[]);
  const covered=new Set(store.plans.map(p=>p.dept+'§'+(p.indicator||'')));
  const uncovered=allBreaches.filter(b=>!covered.has(b.dept+'§'+b.indicator));

  // filtered plans
  const rows=store.plans.filter(p=>(fDept==='all'||p.dept===fDept)&&(fStatus==='all'||p.status===fStatus))
    .slice().sort((a,b)=>{const o={Open:0,'In progress':1,Done:2};return (o[a.status]-o[b.status])|| (b.ts-a.ts);});

  const openNew=(pre)=>setModal({plan:pre||null});
  const openEdit=(p)=>setModal({plan:p});

  const saveFromModal=(data)=>{
    const editing=modal&&modal.plan&&modal.plan.id;
    if(editing) store.update(modal.plan.id,data);
    else store.add(data);
    setModal(null);
    try{window.UI&&window.UI.toast('Saved ✓','success');}catch(e){}
  };

  const del=async(p)=>{
    let ok=true;
    try{ok=await window.UI.confirm({title:'Delete this action plan?',message:`Removes the CAPA for ${p.deptName||p.dept} — ${p.indicator||'indicator'}.`,danger:true,confirmLabel:'Delete'});}
    catch(e){ ok=window.confirm('Delete this action plan?'); }
    if(!ok) return;
    store.remove(p.id);
    try{window.UI&&window.UI.toast('Action plan deleted','success');}catch(e){}
  };

  const fromBreach=(b)=>openNew({
    dept:b.dept, deptName:b.deptName, indicator:b.indicator,
    issue:`${b.indicator} breaching benchmark ${b.benchmark}`,
    action:'', owner:'', due:'', status:'Open', notes:'',
  });

  const sel={padding:'7px 10px',border:'1px solid var(--line)',borderRadius:7,fontSize:12.5,fontFamily:'inherit',background:'#fff'};
  const Kpi=({label,val,foot,color})=>(
    <div className="card anim-pop" style={{padding:'15px 18px',borderLeft:`4px solid ${color}`,display:'flex',flexDirection:'column',minHeight:104}}>
      <div style={{fontSize:12.5,fontWeight:700,color:'var(--ink-2)'}}>{label}</div>
      <div className="num" style={{fontSize:30,fontWeight:700,color,margin:'8px 0 5px',lineHeight:1}}>{val}</div>
      <div style={{fontSize:11,color:'var(--muted)',marginTop:'auto'}}>{foot}</div>
    </div>
  );

  return (
    <div className="grid" style={{gap:16}}>
      <SectionTitle icon={I.check} title="Corrective / Preventive Action Plans"
        sub="CAPA for breached quality indicators — track owner, due date and status"
        right={<>
          <button className="btn sm" onClick={()=>setRoute({view:'quality'})}><Ic d={I.heart} s={15}/>Quality</button>
          <button className="btn pri sm" onClick={()=>openNew()}><Ic d={I.plus} s={15}/>New plan</button>
        </>}/>

      {/* KPI strip */}
      <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))'}}>
        <Kpi label="Total plans" val={fmt(total)} foot="action plans logged" color="#6a52d4"/>
        <Kpi label="Open" val={fmt(cOpen)} foot="not yet started" color="#e08a1e"/>
        <Kpi label="In progress" val={fmt(cProg)} foot="being worked on" color="#0090ca"/>
        <Kpi label="Done" val={fmt(cDone)} foot="completed" color="#1f9d57"/>
        <Kpi label="Overdue" val={fmt(cOver)} foot="past due, not done" color={cOver>0?'#d23a52':'#1f9d57'}/>
      </div>

      {/* Breach radar */}
      <div className="card" style={{overflow:'hidden'}}>
        <div className="card-h">
          <div style={{width:28,height:28,borderRadius:8,background:'var(--neg-bg)',color:'var(--neg)',display:'grid',placeItems:'center'}}><Ic d={I.trend} s={16}/></div>
          <h3>Breach Radar</h3><span className="sub">breached indicators without an action plan</span><span className="spacer"/>
          <span className="chip" style={{background:uncovered.length?'var(--neg-bg)':'var(--pos-bg)',color:uncovered.length?'var(--neg)':'var(--pos)'}}>{uncovered.length} uncovered</span>
        </div>
        <div className="card-b">
          {uncovered.length===0
            ? <div style={{textAlign:'center',color:'var(--faint)',padding:'22px',fontSize:13}}>
                {allBreaches.length? 'Every breached indicator has an action plan. ✓':'No breached indicators detected.'}
              </div>
            : <div style={{display:'flex',flexDirection:'column',gap:9}}>
                {uncovered.map((b,i)=>(
                  <div key={b.dept+b.indicator+i} className="dept-row">
                    <div style={{minWidth:0,flex:1}}>
                      <div style={{fontWeight:600,color:'var(--ink)'}}>{b.indicator}</div>
                      <div style={{fontSize:11.5,color:'var(--muted)'}}>{b.deptName} · benchmark {b.benchmark} · breach in {b.quarters.join(', ')}</div>
                    </div>
                    <button className="btn sm pri" onClick={()=>fromBreach(b)}><Ic d={I.plus} s={14}/>Create action plan</button>
                  </div>
                ))}
              </div>}
        </div>
      </div>

      {/* Action plans table */}
      <div className="card" style={{overflow:'hidden'}}>
        <div className="card-h">
          <h3>Action Plans</h3><span className="sub">{rows.length} of {total}</span><span className="spacer"/>
          <Ic d={I.filter} s={15} c="var(--muted)"/>
          <select style={sel} value={fDept} onChange={e=>setFDept(e.target.value)}>
            <option value="all">All departments</option>
            {seed.map(d=><option key={d.key} value={d.key}>{d.name}</option>)}
          </select>
          <select style={sel} value={fStatus} onChange={e=>setFStatus(e.target.value)}>
            <option value="all">All statuses</option>
            {CAPA_STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={{overflowX:'auto'}}>
          <table className="tbl">
            <thead><tr>
              <th style={{textAlign:'left'}}>Department</th>
              <th style={{textAlign:'left'}}>Indicator</th>
              <th style={{textAlign:'left'}}>Action</th>
              <th style={{textAlign:'left'}}>Owner</th>
              <th style={{textAlign:'left'}}>Due</th>
              <th style={{textAlign:'left'}}>Status</th>
              <th style={{textAlign:'right'}}>Actions</th>
            </tr></thead>
            <tbody>
              {rows.length===0&&<tr><td colSpan={7} style={{textAlign:'center',color:'var(--faint)',fontFamily:"'IBM Plex Sans'",padding:'22px'}}>
                {total===0?'No action plans yet — create one from the Breach Radar or “New plan”.':'No plans match the current filters.'}
              </td></tr>}
              {rows.map(p=>{
                const tone=capaStatusTone(p.status);
                const overdue=capaIsOverdue(p);
                return (
                  <tr key={p.id}>
                    <td style={{textAlign:'left'}}><b style={{color:'var(--ink)'}}>{p.deptName||p.dept}</b></td>
                    <td style={{textAlign:'left',fontFamily:"'IBM Plex Sans'"}}>{p.indicator||<span style={{color:'var(--faint)'}}>—</span>}</td>
                    <td style={{textAlign:'left',fontFamily:"'IBM Plex Sans'",color:'var(--ink-2)',maxWidth:280,whiteSpace:'normal'}}>
                      {p.action||<span style={{color:'var(--faint)'}}>—</span>}
                      {p.issue&&<div style={{fontSize:10.5,color:'var(--faint)',marginTop:2}}>{p.issue}</div>}
                    </td>
                    <td style={{textAlign:'left',fontFamily:"'IBM Plex Sans'"}}>{p.owner||<span style={{color:'var(--faint)'}}>—</span>}</td>
                    <td style={{textAlign:'left',fontFamily:"'IBM Plex Sans'"}}>
                      {p.due
                        ? <span style={{color:overdue?'var(--neg)':'var(--ink-2)',fontWeight:overdue?700:400}}>{p.due}{overdue&&' ⚠'}</span>
                        : <span style={{color:'var(--faint)'}}>—</span>}
                    </td>
                    <td style={{textAlign:'left'}}><span className="chip" style={{background:tone+'1c',color:tone}}>{p.status}</span></td>
                    <td><div style={{display:'flex',gap:6,justifyContent:'flex-end'}}>
                      <button className="icon-btn" style={{width:26,height:26}} title="Edit" onClick={()=>openEdit(p)}><Ic d={I.edit} s={14}/></button>
                      <button className="icon-btn danger" style={{width:26,height:26}} title="Delete" onClick={()=>del(p)}><Ic d={I.x} s={14}/></button>
                    </div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modal&&<CapaModal plan={modal.plan} onClose={()=>setModal(null)} onSave={saveFromModal}/>}
    </div>
  );
}

window.QualityCAPA=QualityCAPA;
window.useCapaStore=useCapaStore;
