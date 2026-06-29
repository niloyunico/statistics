/* UNICO — App shell & routing */
const { useState, useEffect, useMemo } = React;

function App(){
  const store=window.useDeptStore();
  const staff=window.useStaffStore();
  const depts=store.depts;
  const [route,setRoute]=useState({view:'dashboard'});
  const [collapsed,setCollapsed]=useState(false);
  const [layout,setLayout]=useState('executive');
  const [period,setPeriod]=useState({mode:'all'});
  const [locked,setLocked]=useState(()=>!!(window.unicoLock&&window.unicoLock.isEnabled()));
  useEffect(()=>{ const h=()=>{ if(window.unicoLock&&window.unicoLock.isEnabled()) setLocked(true); }; window.addEventListener('unico:lock',h); return ()=>window.removeEventListener('unico:lock',h); },[]);
  // Cloud account login: required only once a server URL is configured (else app stays offline/unchanged).
  const [authed,setAuthed]=useState(()=> !(window.unicoSession&&window.unicoSession.configured()) || window.unicoSession.isAuthed());
  useEffect(()=>{
    if(!(window.unicoSession&&window.unicoSession.configured()&&window.unicoSession.isAuthed())) return;
    let live=true; window.unicoSession.verify().then(ok=>{ if(live&&ok===false){ window.unicoSession.logout(); setAuthed(false); } });
    return ()=>{ live=false; };
  },[]);
  useEffect(()=>{ const h=()=>setAuthed(false); window.addEventListener('unico:logout',h); return ()=>window.removeEventListener('unico:logout',h); },[]);

  const openDept=id=>setRoute({view:'departments',dept:id});
  const safeDepts = depts.length?depts:[];
  const curDept = route.view==='departments' ? (depts.find(d=>d.id===(route.dept||depts[0]?.id))||depts[0]) : null;

  let crumbs=['UNICO'], body=null, actions=null;
  if(route.view==='dashboard'){
    crumbs=['UNICO','Dashboard'];
    body=<Dashboard layout={layout} depts={depts} period={period} openDept={openDept} onFill={(id)=>setRoute({view:'input',dept:id})} setRoute={setRoute}/>;
    actions=(
      <div className="seg" style={{marginRight:4}}>
        {[['executive','Executive'],['operational','Operational'],['analytics','Analytics']].map(([id,l])=>(
          <button key={id} className={layout===id?'on':''} onClick={()=>setLayout(id)}>{l}</button>
        ))}
      </div>
    );
  } else if(route.view==='departments'){
    if(!curDept){ body=<EmptyState setRoute={setRoute}/>; crumbs=['UNICO','Departments']; }
    else { crumbs=['UNICO','Departments',curDept.name]; body=<DeptDetail dept={curDept} openDept={openDept} depts={depts} setRoute={setRoute}/>; }
  } else if(route.view==='compare'){
    crumbs=['UNICO','Compare'];
    body=<DeptCompare depts={depts} openDept={openDept}/>;
  } else if(route.view==='gallery'){
    const gd=depts.find(x=>x.id===route.dept)||depts[0];
    crumbs=['UNICO','Departments',gd?gd.name:'',' Charts'];
    body=<ChartsGallery dept={gd} setRoute={setRoute}/>;
  } else if(route.view==='manage'){
    crumbs=['UNICO','Manage Departments'];
    body=<ManageDepts depts={depts} store={store} setRoute={setRoute}/>;
  } else if(route.view==='input'){
    crumbs=['UNICO','Data Entry'];
    body=<DataEntry depts={depts} addEntry={store.addEntry} entries={store.entries} initialDept={route.dept} updateDept={store.updateDept} deleteDept={store.deleteDept} deleteMonth={store.deleteMonth} undo={store.undo} canUndo={store.canUndo}/>;
  } else if(route.view==='reports'){
    crumbs=['UNICO','Reports'];
    body=<Reports depts={depts}/>;
  } else if(route.view==='settings'){
    crumbs=['UNICO','Settings'];
    body=<Settings depts={depts} store={store}/>;
  } else if(route.view==='quality'){
    crumbs=['UNICO','Quality Indicators'];
    body=<QualityModule setRoute={setRoute}/>;
  } else if(route.view==='qualityDept'){
    crumbs=['UNICO','Quality',route.dept];
    body=<QualityDept deptKey={route.dept} setRoute={setRoute}/>;
  } else if(route.view==='qualityEdit'){
    crumbs=['UNICO','Quality',route.dept,'Edit'];
    body=<QualityDeptEdit deptKey={route.dept} setRoute={setRoute}/>;
  } else if(route.view==='qualityEntry'){
    crumbs=['UNICO','Quality','Monthly Entry'];
    body=<QualityEntry setRoute={setRoute}/>;
  } else if(route.view==='qualityScore'){
    crumbs=['UNICO','Quality','Scorecard'];
    body=<QualityScorecard setRoute={setRoute}/>;
  } else if(route.view==='qualityTrend'){
    crumbs=['UNICO','Quality','Trends'];
    body=<QualityTrends setRoute={setRoute}/>;
  } else if(route.view==='qualityCatalog'){
    crumbs=['UNICO','Quality','Catalog'];
    body=<QualityCatalog setRoute={setRoute}/>;
  } else if(route.view==='qualityCapa'){
    crumbs=['UNICO','Quality','Action Plans'];
    body=<QualityCAPA setRoute={setRoute}/>;
  } else if(route.view==='nurseHome'){
    crumbs=['UNICO','Nurse Management','Dashboard'];
    body=<WorkforceDashboard store={staff} setRoute={setRoute} role="Nurse"/>;
  } else if(route.view==='pcaHome'){
    crumbs=['UNICO','PCA Management','Dashboard'];
    body=<WorkforceDashboard store={staff} setRoute={setRoute} role="PCA"/>;
  } else if(route.view==='nurses'){
    crumbs=['UNICO','Nurse Management','Directory'];
    body=<ManageStaff store={staff} setRoute={setRoute} role="Nurse"/>;
  } else if(route.view==='pca'){
    crumbs=['UNICO','PCA Management','Directory'];
    body=<ManageStaff store={staff} setRoute={setRoute} role="PCA"/>;
  } else if(route.view==='nurseCompliance'){
    crumbs=['UNICO','Nurse Management','Compliance'];
    body=<StaffCompliance store={staff} setRoute={setRoute} role="Nurse"/>;
  } else if(route.view==='pcaCompliance'){
    crumbs=['UNICO','PCA Management','Compliance'];
    body=<StaffCompliance store={staff} setRoute={setRoute} role="PCA"/>;
  } else if(route.view==='staffProfile'){
    const emp=staff.get(route.emp);
    crumbs=['UNICO','Staff',emp?emp.name:'Profile'];
    body=<StaffProfile store={staff} empId={route.emp} setRoute={setRoute}/>;
  } else if(route.view==='staffForm'){
    crumbs=['UNICO','Staff',route.emp?'Edit Staff':`Add ${route.role||'Staff'}`];
    body=<StaffForm store={staff} empId={route.emp} setRoute={setRoute} role={route.role}/>;
  }

  if(window.unicoSession && window.unicoSession.configured() && !authed){ return <CloudLogin onLogin={()=>setAuthed(true)}/>; }
  if(locked){ return <LockScreen onUnlock={()=>setLocked(false)}/>; }

  return (
    <div className={'app'+(collapsed?' collapsed':'')}>
      <GlobalSearch setRoute={setRoute} depts={depts}/>
      <Sidebar route={route} setRoute={setRoute} collapsed={collapsed} depts={depts}/>
      <div className="main">
        <TopBar route={route} setRoute={setRoute} onBurger={()=>setCollapsed(c=>!c)} crumbs={crumbs} actions={actions} depts={depts} onFill={(id)=>setRoute({view:'input',dept:id})} period={period} setPeriod={setPeriod}/>
        <div className="content" key={route.view+(route.dept||'')+(route.emp||'')+layout}>{body}</div>
      </div>
    </div>
  );
}

function EmptyState({setRoute}){
  return (
    <div style={{display:'grid',placeItems:'center',height:'60vh',textAlign:'center'}}>
      <div>
        <div style={{width:60,height:60,borderRadius:16,background:'var(--blue-50)',color:'var(--blue)',display:'grid',placeItems:'center',margin:'0 auto 14px'}}><Ic d={I.layers} s={30}/></div>
        <div style={{fontSize:17,fontWeight:700}}>No departments yet</div>
        <div style={{fontSize:13,color:'var(--muted)',margin:'6px 0 16px'}}>Add a department to start tracking statistics.</div>
        <button className="btn pri" onClick={()=>setRoute({view:'manage'})}><Ic d={I.plus} s={16}/>Add Department</button>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
