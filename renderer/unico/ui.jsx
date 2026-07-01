/* UNICO — icons + shell chrome */
const I = {
  grid:'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  pulse:'M3 12h4l2 6 4-14 2 8h6',
  layers:'M12 2 2 7l10 5 10-5zM2 12l10 5 10-5M2 17l10 5 10-5',
  input:'M4 4h16v16H4zM4 9h16M9 4v16',
  doc:'M6 2h9l5 5v15H6zM15 2v5h5M9 13h7M9 17h7',
  gear:'M12 8a4 4 0 100 8 4 4 0 000-8zM2 12h2M20 12h2M12 2v2M12 20v2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5',
  bell:'M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0',
  search:'M11 4a7 7 0 105 12l4 4M11 4a7 7 0 015 12',
  chevR:'M9 6l6 6-6 6',
  download:'M12 3v12m0 0l4-4m-4 4l-4-4M4 19h16',
  upload:'M12 21V9m0 0l4 4m-4-4l-4 4M4 5h16',
  filter:'M3 5h18l-7 8v6l-4-2v-4z',
  plus:'M12 5v14M5 12h14',
  check:'M4 12l5 5L20 6',
  heart:'M12 21s-8-5-10-10a5 5 0 019-3 5 5 0 019 3c-2 5-10 10-10 10z',
  bed:'M3 7v10M3 12h12a4 4 0 014 4v1M3 17h18M7 9h4a2 2 0 010 4H3',
  activity:'M3 12h4l2 6 4-14 2 8h6',
  steth:'M6 3v5a4 4 0 008 0V3M19 14a3 3 0 11-6 0v-1M16 18v2',
  cal:'M3 5h18v16H3zM3 9h18M8 3v4M16 3v4',
  syringe:'M18 2l4 4M16 4l4 4-9 9H7v-4zM2 22l5-5',
  user:'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0',
  trend:'M3 17l6-6 4 4 8-8M21 7v5h-5',
  x:'M6 6l12 12M18 6L6 18',
  edit:'M4 20h4l11-11-4-4L4 16zM14 5l4 4',
  print:'M6 9V3h12v6M6 18H4v-7h16v7h-2M8 14h8v7H8z',
  arrowR:'M5 12h14M13 6l6 6-6 6',
};
function Ic({d,s=18,sw=1.9,c='currentColor',fill='none',style}){
  return <svg width={s} height={s} viewBox="0 0 24 24" fill={fill} stroke={c} strokeWidth={sw}
    strokeLinecap="round" strokeLinejoin="round" style={style} className="ico">{
      d.split('M').filter(Boolean).map((seg,i)=><path key={i} d={'M'+seg}/>)
  }</svg>;
}

const DEPT_ICON = { er:I.pulse, opd:I.user, nicu:I.heart, endoscopy:I.activity, ot:I.syringe,
  sicu:I.bed, dialysis:I.activity, lvl10:I.bed, lvl9:I.bed, ldr:I.heart, micu:I.pulse,
  ccu:I.heart, cathlab:I.activity, ctvs:I.syringe, homecare:I.user };

/* ---- Mega-modules: the app is split into three top-level workspaces. The top-bar
   ModuleSwitch flips between them; the Sidebar shows ONLY the active module's
   sections. The active module is DERIVED from the current route.view (no separate
   state), so deep links / breadcrumb jumps keep the right module highlighted. ---- */
const UNICO_MODULES = [
  { id:'stats',   label:'Statistics',         short:'Statistics', icon:I.grid,  home:'dashboard' },
  { id:'datacol', label:'Data Collection',    short:'Data',       icon:I.input, home:'dcReview' },
  { id:'staff',   label:'Staff Management',   short:'Staff',      icon:I.steth, home:'nurseHome' },
  { id:'quality', label:'Quality Indicators', short:'Quality',    icon:I.heart, home:'quality' },
  { id:'users',   label:'User Management',    short:'Users',      icon:I.user,  home:'users' },
];
const UNICO_MODULE_VIEWS = {
  stats:  ['dashboard','departments','compare','gallery','manage','input','reports','settings'],
  datacol:['dcPatient','dcQuality','dcResponsibles','dcShare','dcFields','dcReview'],
  staff:  ['nurseHome','nurses','nurseCompliance','pcaHome','pca','pcaCompliance','staffProfile','staffForm'],
  quality:['quality','qualityScore','qualityTrend','qualityReport','qualityReportQ','qualityIncidents','qualityDataEntry','qualityManage','qualityCatalog','qualityAssign','qualityCapa','qualityDept','qualityEdit','qualityEntry','qualityHub'],
  users:  ['users'],
};
function unicoModuleOf(view){
  for(let i=0;i<UNICO_MODULES.length;i++){ const m=UNICO_MODULES[i]; if((UNICO_MODULE_VIEWS[m.id]||[]).indexOf(view)>=0) return m.id; }
  return 'stats';
}
function unicoSidebarGroups(moduleId){
  if(moduleId==='datacol') return [
    {sec:'Data Collection', items:[
      {id:'dcPatient',label:'Patient Statistics',icon:I.input},
      {id:'dcQuality',label:'Quality Data',icon:I.activity},
      {id:'dcResponsibles',label:'Responsible Persons',icon:I.user},
      {id:'dcShare',label:'Share Links',icon:I.arrowR},
      {id:'dcFields',label:'Form Fields',icon:I.filter},
      {id:'dcReview',label:'Review & History',icon:I.doc},
    ]},
  ];
  if(moduleId==='staff') return [
    {sec:'Nurse Management', items:[{id:'nurseHome',label:'Dashboard',icon:I.grid},{id:'nurses',label:'Directory',icon:I.layers},{id:'nurseCompliance',label:'Compliance',icon:I.heart}]},
    {sec:'PCA Management',   items:[{id:'pcaHome',label:'Dashboard',icon:I.grid},{id:'pca',label:'Directory',icon:I.layers},{id:'pcaCompliance',label:'Compliance',icon:I.heart}]},
  ];
  // Quality module (window.QualityView) now renders inside the global shell; these
  // are its views. Each id is a route.view that app.jsx maps to a quality view.
  if(moduleId==='quality') return [
    {sec:'Monitor', items:[
      {id:'quality',label:'Dashboard',icon:I.grid,match:['quality','qualityDept']},
      {id:'qualityScore',label:'Scorecard',icon:I.layers},
      {id:'qualityTrend',label:'Trends',icon:I.trend},
    ]},
    {sec:'Reporting', items:[
      {id:'qualityReport',label:'Reports',icon:I.doc,match:['qualityReport','qualityReportQ']},
      {id:'qualityIncidents',label:'Incident Reports',icon:I.activity},
    ]},
    {sec:'Administration', items:[
      {id:'qualityManage',label:'Indicator Administration',icon:I.edit,match:['qualityManage','qualityCatalog','qualityAssign','qualityEdit']},
      {id:'qualityDataEntry',label:'Quality Data Entry',icon:I.input},
      {id:'qualityCapa',label:'Action Plans',icon:I.check},
    ]},
  ];
  if(moduleId==='users') return [
    {sec:'User Management', items:[
      {id:'users',label:'All Users & Roles',icon:I.user},
    ]},
  ];
  return [
    {sec:'Overview', items:[
      {id:'dashboard',label:'Dashboard',icon:I.grid},
      {id:'departments',label:'Departments',icon:I.layers},
      {id:'compare',label:'Compare',icon:I.trend},
      {id:'manage',label:'Manage Depts',icon:I.edit},
      {id:'input',label:'Data Entry',icon:I.input},
      {id:'reports',label:'Reports',icon:I.doc},
      {id:'settings',label:'Settings',icon:I.gear},
    ]},
  ];
}
// Top-bar workspace switcher. Selecting a module jumps to that module's home view.
function ModuleSwitch({route, setRoute}){
  const cur=unicoModuleOf(route.view);
  return (
    <div className="seg modswitch" style={{flexShrink:0,marginRight:10}} title="Switch workspace">
      {UNICO_MODULES.map(m=>(
        <button key={m.id} className={cur===m.id?'on':''} title={m.label}
          onClick={()=>{ if(cur!==m.id) setRoute({view:m.home}); }}
          style={{display:'inline-flex',alignItems:'center',gap:6,whiteSpace:'nowrap'}}>
          <Ic d={m.icon} s={15}/><span className="modswitch-lbl">{m.short}</span>
        </button>
      ))}
    </div>
  );
}

// Resolve a reporting-period selection to the concrete list of in-range month
// keys (chronological). Returns null for "all" — meaning no filtering. Shared by
// the top-bar PeriodPill (for its label) and the Dashboard (for actual filtering).
function unicoPeriodMonths(allMonths, period){
  if(!period || period.mode==='all') return null;
  if(period.mode==='latest') return allMonths.slice(-1);
  if(period.mode==='last3')  return allMonths.slice(-3);
  if(period.mode==='last6')  return allMonths.slice(-6);
  if(period.mode==='q1'){ const q=['Jan-26','Feb-26','Mar-26'].filter(m=>allMonths.includes(m)); return q.length?q:null; }
  if(period.mode==='custom'){
    const fi=allMonths.indexOf(period.from), ti=allMonths.indexOf(period.to);
    if(fi<0||ti<0) return null;
    const a=Math.min(fi,ti), b=Math.max(fi,ti);
    return allMonths.slice(a,b+1);
  }
  return null;
}
window.unicoPeriodMonths=unicoPeriodMonths;

function Sidebar({route, setRoute, collapsed, depts}){
  const activeMod = unicoModuleOf(route.view);
  const groups = unicoSidebarGroups(activeMod);
  const curMod = UNICO_MODULES.find(m=>m.id===activeMod) || UNICO_MODULES[0];
  const isOn = it => it.match ? it.match.indexOf(route.view)>=0 : route.view===it.id;
  return (
    <aside className="sb">
      <div className="sb-brand">
        <img className="sb-logo-img sb-logo-full" src="unico/logo.svg" alt="UNICO Healthcare"/>
        <img className="sb-logo-mark" src="unico/logo-mark.svg" alt="UNICO"/>
      </div>
      <div className="sb-scroll">
        {/* current workspace label — mirrors the top-bar ModuleSwitch so the admin always knows where they are */}
        <div className="sb-sec" style={{display:'flex',alignItems:'center',gap:7,color:'var(--blue)'}}>
          <Ic d={curMod.icon} s={14}/><span style={{fontWeight:800,letterSpacing:.3}}>{curMod.label}</span>
        </div>
        {groups.map((g,gi)=>(
          <React.Fragment key={gi}>
            <div className="sb-sec">{g.sec}</div>
            {g.items.map(n=>(
              <div key={n.id} className={'sb-item'+(isOn(n)?' active':'')} onClick={()=>setRoute({view:n.id})}>
                <Ic d={n.icon} s={18}/><span className="lbl">{n.label}</span>
              </div>
            ))}
          </React.Fragment>
        ))}
        {activeMod==='stats' && (
          <>
            <div className="sb-sec" style={{display:'flex',alignItems:'center'}}>Departments<span className="spacer" style={{flex:1}}/>
              <span onClick={()=>setRoute({view:'manage'})} title="Add / manage" style={{cursor:'pointer',color:'#7e8da0',display:'grid',placeItems:'center',padding:'0 2px'}}><Ic d={I.plus} s={15}/></span>
            </div>
            {depts.map(d=>(
              <div key={d.id} className={'sb-item'+(route.view==='departments'&&route.dept===d.id?' active':'')}
                onClick={()=>setRoute({view:'departments',dept:d.id})} title={d.name}>
                <Ic d={DEPT_ICON[d.id]||I.activity} s={17}/>
                <span className="lbl">{d.short}</span>
                <span className="badge num">{d.total}</span>
              </div>
            ))}
          </>
        )}
      </div>
      <div className="sb-foot">
        {(()=>{
          const u=(typeof window!=='undefined' && window.__UNICO_USER__)||null;
          const name=(u&&u.name)||'Nasif Ahammed Niloy';
          const role=u?(u.role==='collector'?'Data Collector':u.role):'Administrator';
          const initials=String(name).split(/\s+/).map(w=>w[0]).filter(Boolean).slice(0,2).join('').toUpperCase()||'U';
          return (<>
            <div className="avatar">{initials}</div>
            <div className="who" style={{minWidth:0,flex:1}}>
              <div style={{color:'#fff',fontSize:12.5,fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{name}</div>
              <div style={{color:'#83909f',fontSize:10.5,whiteSpace:'nowrap'}}>{role}</div>
            </div>
            <a href="/logout" title="Sign out" style={{marginLeft:'auto',display:'grid',placeItems:'center',width:32,height:32,borderRadius:8,color:'#cfe0f0',background:'rgba(255,255,255,.08)',textDecoration:'none',flexShrink:0}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>
            </a>
          </>);
        })()}
      </div>
    </aside>
  );
}

const NMONS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const NMONS_FULL=['January','February','March','April','May','June','July','August','September','October','November','December'];
function nextMonthKey(mk){const [m,y]=mk.split('-');let i=NMONS.indexOf(m)+1,yy=+y;if(i>11){i=0;yy++;}return NMONS[i]+'-'+String(yy).padStart(2,'0');}
function mnum(mk){const [m,y]=mk.split('-');return (2000+ +y)*12+NMONS.indexOf(m);}
function monthFull(mk){const [m,y]=mk.split('-');return NMONS_FULL[NMONS.indexOf(m)]+' 20'+y;}

// Top-bar reporting-period filter. Drives the Dashboard's KPIs + charts.
function PeriodPill({period, setPeriod, depts=[]}){
  const [open,setOpen]=React.useState(false);
  const MO=window.UNICO.MONTH_ORDER;
  const allMonths=[...new Set(depts.flatMap(d=>d.months||[]))].sort((a,b)=>MO.indexOf(a)-MO.indexOf(b));
  const fmtKey=k=>String(k||'').replace('-',' ');
  const active=unicoPeriodMonths(allMonths, period)||allMonths;
  const label=active.length?`${fmtKey(active[0])} – ${fmtKey(active[active.length-1])}`:'No data';
  const presets=[['all','All time'],['last3','Last 3 months'],['last6','Last 6 months'],['q1','Q1 2026'],['latest','Latest month']];
  const cur=period&&period.mode||'all';
  const pick=mode=>{ setPeriod({mode}); setOpen(false); };
  const first=allMonths[0], last=allMonths[allMonths.length-1];
  const cFrom=(period&&period.mode==='custom'&&period.from)||first;
  const cTo=(period&&period.mode==='custom'&&period.to)||last;
  return (
    <div style={{position:'relative'}}>
      <button className="tb-pill" onClick={()=>setOpen(o=>!o)} title="Filter dashboard period"
        style={{cursor:'pointer',border:'1px solid '+(cur!=='all'?'var(--blue-100)':'var(--line)'),background:cur!=='all'?'var(--blue-50)':'var(--panel-2)'}}>
        <Ic d={I.cal} s={14} c="#0b66d0"/><span className="num">{label}</span>
        <Ic d={I.chevR} s={12} style={{transform:'rotate(90deg)',opacity:.55}}/>
      </button>
      {open&&(
        <div onMouseLeave={()=>setOpen(false)} style={{position:'absolute',right:0,top:'118%',zIndex:200,width:236,background:'#fff',border:'1px solid var(--line)',borderRadius:11,boxShadow:'var(--shadow-pop)',overflow:'hidden'}}>
          <div style={{padding:'10px 13px',borderBottom:'1px solid var(--line-2)',fontSize:11,fontWeight:700,color:'var(--ink-2)',textTransform:'uppercase',letterSpacing:.4}}>Reporting period</div>
          <div style={{padding:6}}>
            {presets.map(([m,l])=>(
              <div key={m} onClick={()=>pick(m)} style={{display:'flex',alignItems:'center',gap:7,padding:'8px 10px',borderRadius:7,cursor:'pointer',fontSize:12.5,fontWeight:600,
                background:cur===m?'var(--blue-50)':'transparent',color:cur===m?'var(--blue-700)':'var(--ink-2)'}}
                onMouseEnter={e=>{if(cur!==m)e.currentTarget.style.background='var(--panel-2)';}} onMouseLeave={e=>{if(cur!==m)e.currentTarget.style.background='transparent';}}>
                <span style={{width:14,display:'inline-flex'}}>{cur===m&&<Ic d={I.check} s={13} c="var(--blue)"/>}</span>{l}
              </div>
            ))}
          </div>
          <div style={{borderTop:'1px solid var(--line-2)',padding:'10px 12px'}}>
            <div style={{fontSize:11,fontWeight:600,color:cur==='custom'?'var(--blue-700)':'var(--muted)',marginBottom:6}}>Custom range</div>
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <select value={cFrom} onChange={e=>setPeriod({mode:'custom',from:e.target.value,to:cTo})} style={{flex:1,minWidth:0,padding:'6px 7px',border:'1px solid var(--line)',borderRadius:6,fontSize:11.5,fontFamily:'inherit',background:'#fff'}}>
                {allMonths.map(m=><option key={m} value={m}>{fmtKey(m)}</option>)}
              </select>
              <span style={{fontSize:11,color:'var(--muted)'}}>to</span>
              <select value={cTo} onChange={e=>setPeriod({mode:'custom',from:cFrom,to:e.target.value})} style={{flex:1,minWidth:0,padding:'6px 7px',border:'1px solid var(--line)',borderRadius:6,fontSize:11.5,fontFamily:'inherit',background:'#fff'}}>
                {allMonths.map(m=><option key={m} value={m}>{fmtKey(m)}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TopBar({route, setRoute, onBurger, crumbs, actions, depts=[], onFill, period, setPeriod}){
  const [notifOpen,setNotifOpen]=React.useState(false);
  const reporting=depts.filter(d=>d.months&&d.months.length&&d.latest&&d.latest.month);
  const nexts=reporting.map(d=>nextMonthKey(d.latest.month));
  const currentKey=nexts.length?nexts.reduce((a,b)=>mnum(b)<mnum(a)?b:a):null;
  const missing=currentKey?reporting.filter(d=>!d.months.includes(currentKey)):[];
  return (
    <div className="topbar">
      <button className="tb-burger" onClick={onBurger} title="Toggle menu"><Ic d={I.grid} s={16}/></button>
      <ModuleSwitch route={route} setRoute={setRoute}/>
      <div className="crumb">
        {crumbs.map((c,i)=>(
          <React.Fragment key={i}>
            {i>0&&<Ic d={I.chevR} s={13} c="#b6c0cc"/>}
            {i===crumbs.length-1
              ? ((route.view==='departments'&&depts&&depts.length)
                  ? <select value={route.dept||depts[0].id} onChange={e=>setRoute({view:'departments',dept:e.target.value})} title="Switch department"
                      style={{border:'1px solid var(--line)',borderRadius:7,padding:'3px 8px',fontSize:14,fontWeight:600,color:'var(--ink)',fontFamily:'inherit',background:'var(--panel-2)',cursor:'pointer',maxWidth:240}}>
                      {depts.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  : <b>{c}</b>)
              : <span style={{cursor:'pointer'}}>{c}</span>}
          </React.Fragment>
        ))}
      </div>
      <div className="tb-search" onClick={()=>window.dispatchEvent(new Event('unico:open-search'))} style={{cursor:'pointer'}} title="Search (Ctrl+K)">
        <Ic d={I.search} s={15}/>
        <span style={{flex:1,fontSize:12.5,color:'var(--faint)',whiteSpace:'nowrap',overflow:'hidden'}}>Search departments, staff, quality…</span>
        <span style={{fontSize:10.5,fontWeight:600,color:'var(--faint)',border:'1px solid var(--line)',borderRadius:5,padding:'1px 6px',background:'var(--panel)'}}>Ctrl K</span>
      </div>
      <div className="tb-right">
        {actions}
        {route.view==='dashboard'&&setPeriod&&<PeriodPill period={period} setPeriod={setPeriod} depts={depts}/>}
        <div style={{position:'relative'}}>
          <button className="tb-icon" onClick={()=>setNotifOpen(o=>!o)} title="Reminders"><Ic d={I.bell} s={17}/>{missing.length>0&&<span className="tb-dot"/>}</button>
          {notifOpen&&(
            <div onMouseLeave={()=>setNotifOpen(false)} style={{position:'absolute',right:0,top:'118%',zIndex:200,width:320,background:'#fff',border:'1px solid var(--line)',borderRadius:11,boxShadow:'var(--shadow-pop)',overflow:'hidden'}}>
              <div style={{padding:'13px 15px',borderBottom:'1px solid var(--line-2)',display:'flex',alignItems:'center',gap:8}}>
                <Ic d={I.bell} s={16} c="var(--blue)"/><div style={{fontSize:13.5,fontWeight:700}}>Reminders</div>
                <span className="spacer"/>{missing.length>0&&<span className="chip neg">{missing.length}</span>}
              </div>
              {currentKey&&(
                <div style={{padding:'10px 15px',background:'var(--blue-50)',borderBottom:'1px solid var(--line-2)',fontSize:11.5,color:'var(--ink-2)'}}>
                  Running month · <b>{monthFull(currentKey)}</b>
                </div>
              )}
              <div style={{maxHeight:300,overflowY:'auto'}}>
                {missing.length===0?(
                  <div style={{padding:'26px 16px',textAlign:'center',color:'var(--pos)',fontSize:12.5}}><Ic d={I.check} s={24} c="#1f9d57"/><div style={{marginTop:6}}>All departments up to date.</div></div>
                ):missing.map(d=>(
                  <div key={d.id} onClick={()=>{onFill&&onFill(d.id);setNotifOpen(false);}} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 15px',borderBottom:'1px solid var(--line-2)',cursor:'pointer'}}
                    onMouseEnter={e=>e.currentTarget.style.background='var(--panel-2)'} onMouseLeave={e=>e.currentTarget.style.background='#fff'}>
                    <div style={{width:30,height:30,borderRadius:8,background:'var(--neg-bg)',color:'var(--neg)',display:'grid',placeItems:'center',flexShrink:0}}><Ic d={DEPT_ICON[d.id]||I.activity} s={16}/></div>
                    <div style={{minWidth:0,flex:1}}><div style={{fontSize:12.5,fontWeight:600,color:'var(--ink)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{d.name}</div>
                      <div style={{fontSize:11,color:'var(--muted)'}}>{monthFull(currentKey)} not entered</div></div>
                    <Ic d={I.input} s={15} c="var(--blue)"/>
                  </div>
                ))}
              </div>
              {missing.length>0&&(
                <div style={{padding:'10px 12px',borderTop:'1px solid var(--line-2)'}}>
                  <button className="btn pri sm" style={{width:'100%',justifyContent:'center'}} onClick={()=>{onFill&&onFill(missing[0].id);setNotifOpen(false);}}><Ic d={I.input} s={14}/>Enter {monthFull(currentKey)} data</button>
                </div>
              )}
            </div>
          )}
        </div>
        <button className="tb-icon" title="Print" onClick={()=>window.print()}><Ic d={I.print} s={17}/></button>
        {window.unicoLock&&window.unicoLock.isEnabled()&&(
          <button className="tb-icon" title="Lock now" onClick={()=>window.dispatchEvent(new Event('unico:lock'))}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/><circle cx="12" cy="16" r="1.1"/></svg>
          </button>
        )}
      </div>
    </div>
  );
}

/* small reusable bits */
function Delta({v}){
  const cls = v>0?'pos':(v<0?'neg':'flat');
  const sym = v>0?'▲':(v<0?'▼':'—');
  return <span className={'chip '+cls}>{sym} {Math.abs(v)}%</span>;
}
function SectionTitle({icon,title,sub,right}){
  return (
    <div className="sec-head" style={{display:'flex',alignItems:'center',gap:11,margin:'4px 0 12px'}}>
      {icon&&<div style={{width:30,height:30,borderRadius:8,background:'var(--blue-50)',color:'var(--blue)',display:'grid',placeItems:'center'}}><Ic d={icon} s={17}/></div>}
      <div>
        <div style={{fontSize:15,fontWeight:700,color:'var(--ink)'}}>{title}</div>
        {sub&&<div style={{fontSize:11.5,color:'var(--muted)'}}>{sub}</div>}
      </div>
      <div className="spacer"/>
      {right}
    </div>
  );
}

Object.assign(window,{ Ic, I, DEPT_ICON, Sidebar, TopBar, Delta, SectionTitle, ModuleSwitch, unicoModuleOf });
