/* UNICO — App shell & routing */
const { useState, useEffect, useMemo } = React;

function App(){
  const store=window.useDeptStore();
  const staff=window.useStaffStore();
  const depts=store.depts;
  const [route,setRoute]=useState(()=> (typeof window!=='undefined' && window.__UNICO_INITIAL_ROUTE__) || {view:'dashboard'});
  const [collapsed,setCollapsed]=useState(()=> typeof window!=='undefined' && window.innerWidth<=820);
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
  // Long-lived tabs go stale: department/quality snapshots are injected at page LOAD,
  // and an approval made in ANOTHER tab (or by a collector) never reaches this one.
  // On tab refocus (away ≥15s), refetch both; the refreshers dispatch
  // 'unico:data-refreshed' and the stores rebuild, so open views update live.
  useEffect(()=>{
    let stamp=Date.now(), busy=false;
    const refresh=()=>{
      if(busy || (typeof document!=='undefined' && document.visibilityState==='hidden')) return;
      if(Date.now()-stamp<15000) return;
      busy=true; stamp=Date.now();
      const jobs=[];
      try{ if(window.UNICO&&window.UNICO.refreshDepartments) jobs.push(window.UNICO.refreshDepartments()); }catch(e){}
      try{ if(window.refreshQualitySeed) jobs.push(window.refreshQualitySeed()); }catch(e){}
      Promise.all(jobs).catch(()=>{}).then(()=>{ busy=false; });
    };
    window.addEventListener('focus',refresh);
    document.addEventListener('visibilitychange',refresh);
    return ()=>{ window.removeEventListener('focus',refresh); document.removeEventListener('visibilitychange',refresh); };
  },[]);

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
    if(!depts.length){ body=<EmptyState setRoute={setRoute}/>; crumbs=['UNICO','Departments']; }
    else if(!route.dept){ crumbs=['UNICO','Departments']; body=<DeptGrid depts={depts} openDept={openDept} setRoute={setRoute}/>; }
    else { const cd=depts.find(d=>d.id===route.dept)||depts[0]; crumbs=['UNICO','Departments',cd.name]; body=<DeptDetail dept={cd} openDept={openDept} depts={depts} setRoute={setRoute}/>; }
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
    crumbs=['UNICO','Data Collection','Data Entry'];
    body=<DataEntry depts={depts} addEntry={store.addEntry} entries={store.entries} initialDept={route.dept} updateDept={store.updateDept} deleteDept={store.deleteDept} deleteMonth={store.deleteMonth} undo={store.undo} canUndo={store.canUndo}/>;
  } else if(route.view==='reports'){
    crumbs=['UNICO','Reports','Patient Statistics'];
    body=<Reports depts={depts}/>;
  } else if(route.view==='reportsQuality'){
    crumbs=['UNICO','Reports','Quality Indicators'];
    body= (typeof QualityReportsPanel!=='undefined') ? <QualityReportsPanel/> : null;
  } else if(route.view==='settings'){
    crumbs=['UNICO','Settings'];
    body=<Settings depts={depts} store={store} setRoute={setRoute}/>;
  } else if(route.view==='qualityDeptManage'){
    // Department management is now ONE unified screen (statistics + quality merged), so
    // the old quality "Manage Departments" link lands on the single manager.
    crumbs=['UNICO','Departments','Manage'];
    body=<ManageDepts depts={depts} store={store} setRoute={setRoute}/>;
  } else if(route.view && route.view.indexOf('quality')===0){
    // Quality module renders INSIDE the global shell now (window.QualityView); the 8
    // views are the quality submenu. Legacy quality* routes map to a module id.
    const QV_MAP={quality:'dashboard',qualityScore:'scorecard',qualityTrend:'trends',qualityReport:'reports',qualityReportQ:'reports',qualityIncidents:'incidents',qualityDataEntry:'dataentry',qualityManage:'admin',qualityCatalog:'admin',qualityAssign:'admin',qualityCapa:'actionplans',qualityDept:'dashboard',qualityEdit:'admin',qualityEntry:'dataentry',qualityHub:'dashboard'};
    const QTITLE={dashboard:'Dashboard',scorecard:'Scorecard',trends:'Trends',reports:'Reports',incidents:'Incident Reports',admin:'Indicator Administration',dataentry:'Quality Data Entry',actionplans:'Action Plans'};
    const qv=route.qview||QV_MAP[route.view]||'dashboard';
    crumbs=['UNICO','Quality Indicators',QTITLE[qv]||'Dashboard'];
    body= (typeof QualityView!=='undefined') ? <QualityView view={qv} initialDept={route.dept} setRoute={setRoute}/> : null;
  } else if(route.view==='dcPatient'){
    crumbs=['UNICO','Data Collection','Patient Statistics'];
    body=<DataPatientForm depts={depts} prefill={{dept:route.dept,responsible:route.responsible,month:route.month}}/>;
  } else if(route.view==='dcQuality'){
    crumbs=['UNICO','Data Collection','Quality Data'];
    body=<DataQualityForm prefill={{area:route.area,responsible:route.responsible}}/>;
  } else if(route.view==='dcResponsibles'){
    crumbs=['UNICO','Data Collection','Responsible Persons'];
    body=<DataResponsibles depts={depts}/>;
  } else if(route.view==='dcReview'){
    crumbs=['UNICO','Data Collection','Review & History'];
    body=<DataReview/>;
  } else if(route.view==='dcShare'){
    crumbs=['UNICO','Data Collection','Share Links'];
    body=<DataShareLinks depts={depts}/>;
  } else if(route.view==='dcFields'){
    crumbs=['UNICO','Data Collection','Form Fields'];
    body=<DataFields setRoute={setRoute}/>;
  } else if(route.view==='users'){
    crumbs=['UNICO','User Management'];
    body=<UserAdmin setRoute={setRoute}/>;
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
  // Data collectors get ONLY the data-collection portal (submit forms + their own
  // history) — every other module (dashboard, statistics, staff, quality…) is hidden.
  if(typeof window!=='undefined' && window.__UNICO_USER__ && window.__UNICO_USER__.role==='collector' && typeof CollectorPortal!=='undefined'){
    return <CollectorPortal/>;
  }

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

/* Last-resort error boundary: without it, ANY uncaught render error unmounts the
   whole React tree and the user is left staring at a blank gray page with no clue
   (that was the "report generation blank" bug). Show what broke + a reload. */
class AppErrorBoundary extends React.Component{
  constructor(p){ super(p); this.state={err:null}; }
  static getDerivedStateFromError(err){ return {err}; }
  render(){
    if(!this.state.err) return this.props.children;
    const msg = String((this.state.err && this.state.err.message) || this.state.err);
    return (
      <div style={{minHeight:'100vh',display:'grid',placeItems:'center',background:'#eef2f7',fontFamily:'"IBM Plex Sans",system-ui,sans-serif',padding:24}}>
        <div style={{maxWidth:460,background:'#fff',border:'1px solid #e3e9f1',borderRadius:16,padding:'26px 28px',textAlign:'center',boxShadow:'0 18px 50px rgba(5,12,24,.14)'}}>
          <div style={{fontSize:34,marginBottom:8}}>⚠️</div>
          <div style={{fontSize:16,fontWeight:700,color:'#16202e',marginBottom:6}}>Something went wrong in this view</div>
          <div style={{fontSize:12.5,color:'#6c7a8c',lineHeight:1.5,marginBottom:6}}>Your data is safe — this is a display error. Reload to continue.</div>
          <div style={{fontSize:11,color:'#9aa6b4',fontFamily:'"IBM Plex Mono",monospace',background:'#f7f9fc',border:'1px solid #eef2f7',borderRadius:8,padding:'7px 10px',margin:'0 0 14px',wordBreak:'break-word'}}>{msg}</div>
          <button onClick={()=>{ try{ location.hash=''; }catch(e){} location.reload(); }}
            style={{border:0,borderRadius:9,padding:'10px 22px',cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:700,color:'#fff',background:'linear-gradient(135deg,#27a8db,#0072a3)'}}>
            Reload the app
          </button>
        </div>
      </div>
    );
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(<AppErrorBoundary><App/></AppErrorBoundary>);
