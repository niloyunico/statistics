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
  grip:'M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01',
  star:'M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5-4.8-4.6 6.6-.9z',
  shield:'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4',
  phone:'M22 16.92v3a2 2 0 01-2.18 2 19.8 19.8 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.8 19.8 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.36 1.9.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0122 16.92z',
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
  { id:'supervisor', label:'Supervisor Reports', short:'Supervisor', icon:I.doc, home:'supHome' },
  { id:'reports', label:'Reports',            short:'Reports',    icon:I.doc,   home:'reports' },
  { id:'users',   label:'Access Control',     short:'Access',     icon:I.shield,home:'users' },
  { id:'perf',    label:'Performance',        short:'Performance',icon:I.doc,   home:'perfHome' },
  { id:'roster',  label:'Duty Roster',        short:'Roster',     icon:I.grid,  home:'rosterHome' },
  { id:'medicine',label:'Medicine & Rx',      short:'Medicine',   icon:I.heart, home:'medHome' },
  // Data Submission: reporting a unit's own figures — what the /collect portal used to be,
  // now a module any account can be given, for the departments set on that person.
  { id:'datasubmit',label:'Data Submission', short:'Submit',     icon:I.upload,home:'dsHome' },
];
const UNICO_MODULE_VIEWS = {
  stats:  ['dashboard','departments','compare','gallery','manage','settings'],
  datacol:['dcReview','dcPatient','dcQuality','input','dcSettings','dcShare','dcFields','dcAnalytics'],
  staff:  ['nurseHome','nurses','nurseCompliance','pcaHome','pca','pcaCompliance','staffPrevious','staffProfile','staffForm','staffRequests'],
  quality:['quality','qualityScore','qualityTrend','qualityIncidents','qualityDataEntry','qualityManage','qualityCatalog','qualityAssign','qualityCapa','qualityDept','qualityEdit','qualityEntry','qualityHub','qualityDeptManage'],
  supervisor:['supHome','supBoard','supNew','supHistory','supReport'],
  reports:['reports','reportsQuality','qualityReport','qualityReportQ'],
  users:  ['users'],
  // perfDirectory / perfStaff are GONE: the staff directory and the per-person record
  // belong to Nurse / PCA Management, which already owns the roster. app.jsx rewrites
  // the two old route names onto the staff module so old links still land somewhere.
  perf:   ['perfHome','perfForm','perfPrint','perfAchievements','perfIncidents','perfCompare','perfAttrition','perfRisk','perfBoard'],
  roster: ['rosterHome','rosterGrid','rosterReview','rosterPrint','rosterFullReview','manpower'],
  datasubmit:['dsHome','dsMissing','dsStatus','dsQuality','dsPatient','dsHistory'],
  medicine:['medHome','medInfo','medBrowse','medBrand','medGeneric','medRxNew','medRxList','medRxPrint','medTemplates','medCatalog','medInteractions','medCalc','medAnalytics'],
};
/* Data Submission's screens — each its own route and its own sidebar sub-item, and each
   grantable per person (Access Control → Data Submission → "Screens they can open").
   [screen id (server/access.js DS_SCREENS), route view, label]. The rule that decides which
   a person may open is the server's dsScreensOf(), mirrored here for the menu. */
// Only DATA screens: the roster is the Duty Roster module, a unit's staff and nurse / PCA
// requests are Staff Management.
const UNICO_DS_SCREENS = [
  ['missing','dsMissing','Missing data'], ['status','dsStatus','Submission status'],
  ['quality','dsQuality','Quality data'], ['patient','dsPatient','Patient statistics'],
  ['history','dsHistory','My submissions'],
];
function unicoDsScreens(){
  const u=(typeof window!=='undefined' && window.__UNICO_USER__)||null;
  const all=UNICO_DS_SCREENS.map(s=>s[0]);
  if(!u || u.role==='Administrator' || ['collector','incharge','nurse','pca'].indexOf(u.role)>=0) return all;
  const k=u.submitKinds||{};
  const list=Array.isArray(u.dsScreens) ? all.filter(s=>u.dsScreens.indexOf(s)>=0)
    : all.filter(s=>(s!=='patient'||k.patient!==false) && ((s!=='quality'&&s!=='status')||k.quality!==false));
  // A screen with nothing in it is not offered: no assigned departments → no patient
  // statistics; no quality areas → no quality data / submission status.
  const hasDepts=Array.isArray(u.departments)&&u.departments.length>0;
  const hasAreas=!!u.allQualityAreas||(Array.isArray(u.qualityAreas)&&u.qualityAreas.length>0);
  return list.filter(s=>(s!=='patient'||hasDepts)&&((s!=='quality'&&s!=='status')||hasAreas));
}
const unicoDsViewOf=(screen)=>{ const r=UNICO_DS_SCREENS.find(s=>s[0]===screen); return r?r[1]:'dsHome'; };
const unicoDsScreenOf=(view)=>{ const r=UNICO_DS_SCREENS.find(s=>s[1]===view); return r?r[0]:null; };
function unicoModuleOf(view){
  for(let i=0;i<UNICO_MODULES.length;i++){ const m=UNICO_MODULES[i]; if((UNICO_MODULE_VIEWS[m.id]||[]).indexOf(view)>=0) return m.id; }
  return 'stats';
}

/* ---- Per-module workspace access (multi-user deployments) ---------------------
   A signed-in 'User' account can be granted only specific workspaces (Statistics /
   Quality / Staff / Data Collection / Reports / Administration). The grant lives on
   window.__UNICO_USER__.modules (injected by the server). Administrators and the
   open local-PC session are unrestricted; collectors render their own portal, so
   they are never gated here. `modules` null/absent = unrestricted (legacy accounts
   keep full access until an admin assigns modules). ---- */
// 'staffapp' is grantable too, but it is the phone app only — it has no screen in here.
const UNICO_ACCESS_MODULES = ['stats','quality','supervisor','staff','datacol','reports','users','perf','roster','medicine','datasubmit','staffapp'];
// The workspace a route.view belongs to for ACCESS purposes. Settings is the admin
// hub, so it is gated under 'users' rather than 'stats'.
function unicoAccessModuleOf(view){
  if(view==='settings') return 'users';
  return unicoModuleOf(view);
}
// Per-module access LEVELS (escalating): none < view < edit < add < delete. A signed-in
// 'User' carries window.__UNICO_USER__.perms = {moduleId: level}. Administrators and the
// open local-PC session are unrestricted (full). unicoCan(module, action) is the app-wide
// CRUD gate used by every add/edit/delete control.
const UNICO_PERM_RANK={none:0,view:1,edit:2,add:3,delete:4};
function unicoUserPerms(){
  const u=(typeof window!=='undefined' && window.__UNICO_USER__)||null;
  if(!u) return null;                       // open local mode -> full
  if(u.role==='Administrator') return null; // admins -> full
  if(u.role==='collector') return null;     // collector uses its own portal
  // A 'User' is restricted to EXACTLY the modules in its perms map. No perms map = NO
  // access (must be granted explicitly) — never silently full, or a half-configured
  // account would see the whole app.
  return (u.perms && typeof u.perms==='object' && !Array.isArray(u.perms)) ? u.perms : {};
}
function unicoModuleLevel(mid){ const p=unicoUserPerms(); if(!p) return 'delete'; return p[mid]||'none'; }
// Can this session perform `action` (view|edit|add|delete) in module `mid`?
// Perms per module are either an ARRAY of independently-granted actions (new model,
// e.g. ['view','edit','delete'] — Delete without Add) or a legacy escalating LEVEL
// string (none<view<edit<add<delete). Any granted action implies module 'view'.
/* 'print' is an INDEPENDENT action, not a rung on the view<edit<add<delete ladder:
   it takes the record out of the system and onto paper. A legacy level string never
   granted it, so it is never read out of one — an account has to be given it.
   ⚠️ An account still stored as a level STRING therefore has no Print button anywhere,
   and nothing on screen says why: tick Print for it in Users & Roles. The reasoning, and
   why this must not be "fixed" by making a level imply print, is in server/access.js. */
function unicoCan(mid, action){
  const p=unicoUserPerms(); if(!p) return true;   // admin / open local mode -> full
  const val=p[mid];
  if(Array.isArray(val)){
    if(action==='view') return val.length>0;       // any granted action lets them open it
    return val.indexOf(action)>=0;
  }
  if(action==='print') return false;
  return (UNICO_PERM_RANK[val||'none']||0) >= (UNICO_PERM_RANK[action]||UNICO_PERM_RANK.view);
}
function unicoCanAccessModule(mid){ return unicoCan(mid,'view'); }
// 'profile' is deliberately ungated: maintaining your OWN name, photo and password
// is not a privilege, and a collector granted exactly one form must still reach it.
// 'dcResponsibles' is only a legacy redirect (app.jsx) that renders nothing and picks a
// destination this session can open, which gates itself — gating the redirect would bounce first.
function unicoCanAccessView(view){ if(view==='profile'||view==='home'||view==='dcResponsibles') return true;
  // A Data Submission screen also needs that screen granted to this person.
  const ds=unicoDsScreenOf(view); if(ds && unicoDsScreens().indexOf(ds)<0) return false;
  return unicoCanAccessModule(unicoAccessModuleOf(view)); }
// Viewable module ids, or null when unrestricted. [] => the user has no access at all.
function unicoAllowedModules(){ const p=unicoUserPerms(); if(!p) return null; return UNICO_ACCESS_MODULES.filter(m=>unicoCan(m,'view')); }
// The landing view for the first workspace this session can open (sidebar order).
// Returns null when nothing is granted (=> the app shows a "no access" screen).
function unicoFirstAllowedHome(){
  // Every grantable workspace must appear here. 'perf' and 'roster' were missing, so an
  // account granted ONLY one of those landed on the "no workspace access" screen even
  // though it had access — the list must stay in step with UNICO_ACCESS_MODULES.
  // 'home' is not in this list on purpose: it is ungated, so unicoCanAccessView()
  // never sends anyone here looking for a fallback. This list answers a different
  // question — which WORKSPACE to open when a restricted account needs one.
  const homes=[['stats','dashboard'],['quality','quality'],['supervisor','supHome'],['medicine','medHome'],['staff','nurseHome'],['datacol','dcReview'],['datasubmit','dsHome'],['perf','perfHome'],['roster','rosterHome'],['reports','reports'],['users','settings']];
  for(let i=0;i<homes.length;i++){ if(unicoCanAccessModule(homes[i][0])) return homes[i][1]; }
  return null;
}
// Perms were injected once at page load, so a module granted/revoked meanwhile needed a reload
// (its buttons 403'd). Re-read the live grant; on a change FIRST pull the data it now allows —
// a newly granted module's overlay was never sent to this tab, and a store opened on that blank
// copy would save it over the hospital's — then tell the shell to re-render ('unico:perms-changed').
function unicoRefreshPerms(){
  const u=(typeof window!=='undefined' && window.__UNICO_USER__)||null;
  if(!u || !u.username || u.role==='Administrator' || ['collector','incharge','nurse','pca'].indexOf(u.role)>=0) return Promise.resolve(false);
  return fetch('/api/me',{credentials:'same-origin',cache:'no-store'}).then(r=>r.ok?r.json():null).then(j=>{
    // degraded = the server could not read the account: its empty perms are not a revocation.
    if(!j||!j.ok||j.degraded||!j.perms||typeof j.perms!=='object'||Array.isArray(j.perms)) return false;
    const staffScope=j.staffScope||u.staffScope;
    if(JSON.stringify(j.perms)===JSON.stringify(u.perms||null) && staffScope===u.staffScope) return false;
    const appJob=window.unicoRefreshAppData ? window.unicoRefreshAppData({includeNew:true}) : Promise.resolve([]);
    const jobs=[appJob];
    try{ if(window.UNICO&&window.UNICO.refreshDepartments) jobs.push(window.UNICO.refreshDepartments()); }catch(e){}
    try{ if(window.refreshQualitySeed) jobs.push(window.refreshQualitySeed()); }catch(e){}
    return Promise.all(jobs.map(p=>Promise.resolve(p).catch(()=>null))).then(res=>{
      if(res[0]===null) return false;   // overlay not refreshed: keep the old grant, retry next round
      Object.assign(u,{perms:j.perms,staffScope});
      try{ window.dispatchEvent(new CustomEvent('unico:perms-changed',{detail:{perms:j.perms}})); }catch(e){}
      return true;
    });
  }).catch(()=>false);
}
function unicoSidebarGroups(moduleId){
  if(moduleId==='datacol') return [
    {sec:'Data Collection', items:[
      {id:'dcPatient',label:'Patient Statistics',icon:I.input},
      {id:'dcQuality',label:'Quality Data',icon:I.activity},
      {id:'dcSettings',label:'Department Setup',icon:I.gear},
      {id:'dcShare',label:'Share Links',icon:I.arrowR},
      {id:'dcFields',label:'Form Fields',icon:I.filter},
      {id:'dcReview',label:'Review & History',icon:I.doc},
    ]},
  ];
  if(moduleId==='staff') return [
    // One workspace, role as a filter — mirrors unicoWorkspaceSub() below, which is
    // what the live Sidebar actually renders.
    {sec:'Staff Management', items:[{id:'nurseHome',label:'Dashboard',icon:I.grid,match:['nurseHome','pcaHome']},
      {id:'nurses',label:'Directory',icon:I.layers,match:['nurses','pca']},
      {id:'nurseCompliance',label:'Compliance',icon:I.heart,match:['nurseCompliance','pcaCompliance']},
      {id:'staffPrevious',label:'Previous Staff',icon:I.doc},
      {id:'perfHome',label:'Performance',icon:I.trend},
      {id:'rosterHome',label:'Duty Roster',icon:I.grid}]},
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
      {id:'qualityIncidents',label:'Incident Reports',icon:I.activity},
    ]},
    {sec:'Administration', items:[
      {id:'qualityDeptManage',label:'Manage Departments',icon:I.layers},
      {id:'qualityManage',label:'Indicator Administration',icon:I.edit,match:['qualityManage','qualityCatalog','qualityAssign','qualityEdit']},
      {id:'qualityDataEntry',label:'Quality Data Entry',icon:I.input},
      {id:'qualityCapa',label:'Action Plans',icon:I.check},
    ]},
  ];
  if(moduleId==='reports') return [
    {sec:'Report Generator', items:[
      {id:'reports',label:'Patient Statistics',icon:I.doc},
      {id:'reportsQuality',label:'Quality Indicators',icon:I.heart},
    ]},
  ];
  if(moduleId==='users') return [
    {sec:'Access Control', items:[
      {id:'users',label:'People & Access',icon:I.shield},
    ]},
  ];
  return [
    {sec:'Overview', items:[
      {id:'dashboard',label:'Dashboard',icon:I.grid},
      {id:'departments',label:'Departments',icon:I.layers},
      {id:'compare',label:'Compare',icon:I.trend},
      {id:'manage',label:'Manage Depts',icon:I.edit},
      {id:'input',label:'Data Entry',icon:I.input},
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
  if(period.mode==='q1'){ const yy=allMonths.length?String(allMonths[allMonths.length-1]).split('-')[1]:''; const q=['Jan-'+yy,'Feb-'+yy,'Mar-'+yy].filter(m=>allMonths.includes(m)); return q.length?q:null; }
  if(period.mode==='custom'){
    const fi=allMonths.indexOf(period.from), ti=allMonths.indexOf(period.to);
    if(fi<0||ti<0) return null;
    const a=Math.min(fi,ti), b=Math.max(fi,ti);
    return allMonths.slice(a,b+1);
  }
  return null;
}
window.unicoPeriodMonths=unicoPeriodMonths;

// Hospital-wide open-breach count for the sidebar "Quality" badge — same monthly
// logic the Dashboard/quality-console use. Computed once per mount (cheap, guarded).
function unicoQualityBreachCount(){
  try{
    const Qh = window.UNICO_Q;
    if(!window.qualityData || !Qh) return 0;
    // Same year-aware, quarter-aware breach count the Quality console reports.
    const areas = window.qualityData();
    const months = Qh.fyAxis(Qh.defaultFy(areas));
    let br=0; areas.forEach(d=>(d.indicators||[]).forEach(ind=>{ br += Qh.countBreaches(ind, months); }));
    return br;
  }catch(e){ return 0; }
}
window.unicoQualityBreachCount=unicoQualityBreachCount;

// Supervisor-report alerts badge — count of today's critical events + shifts still
// missing a report. Populated by the Supervisor module (window.__UNICO_SUP_ALERTS__)
// on load/save; the sidebar reads this cheap global (0 => no badge until computed).
function unicoSupAlertCount(){ try{ return window.__UNICO_SUP_ALERTS__||0; }catch(e){ return 0; } }
window.unicoSupAlertCount=unicoSupAlertCount;

// Unified workspace navigation — Statistics + Quality are MERGED into peer
// destinations (Overview / Departments / Quality) instead of separate switchable
// modules. Secondary views nest (indented) under the active destination.
const UNICO_WS = [
  { sec:'', items:[
    // Personal home first: it is the only screen that is about YOU rather than the
    // hospital, and every role can open it.
    { id:'home',        label:'Home',            icon:I.pulse,  home:'home',        on:v=>v==='home', always:true },
    { id:'overview',    label:'Overview',        icon:I.grid,   home:'dashboard',   on:v=>v==='dashboard' },
    // `always` = never gated by a module permission. Your own profile is not a
    // privilege, so every role sees this row (see unicoCanAccessView('profile')).
    { id:'profile',     label:'My Profile',      icon:I.user,   home:'profile',     on:v=>v==='profile', always:true },
  ]},
  { sec:'Clinical', items:[
    { id:'departments', label:'Departments',     icon:I.layers, home:'departments', on:v=>unicoModuleOf(v)==='stats'&&['dashboard','settings','profile','home'].indexOf(v)<0 },
    { id:'quality',     label:'Quality',         icon:I.heart,  home:'quality',     on:v=>unicoModuleOf(v)==='quality', badge:true },
    { id:'supervisor',  label:'Supervisor Reports', icon:I.doc,  home:'supHome',     on:v=>unicoModuleOf(v)==='supervisor', badge:'sup' },
    // Drug index (21.7k Bangladeshi brands / 1.7k generic monographs) + prescriptions.
    { id:'medicine',    label:'Medicine & Rx',   icon:I.syringe,home:'medHome',     on:v=>unicoModuleOf(v)==='medicine', tag:'NEW' },
  ]},
  { sec:'Data', items:[
    { id:'datasubmit',  label:'Data Submission', icon:I.upload, home:'dsHome',      on:v=>unicoModuleOf(v)==='datasubmit', badge:'ds' },
    { id:'datacol',     label:'Data Collection', icon:I.input,  home:'dcReview',    on:v=>unicoModuleOf(v)==='datacol' },
    { id:'reports',     label:'Reports',         icon:I.doc,    home:'reports',     on:v=>unicoModuleOf(v)==='reports' },
  ]},
  { sec:'Administer', items:[
    /* ONE STAFF DESTINATION. Nurse Management, PCA Management, Performance and Duty
       Roster used to be four sidebar entries over ONE roster — the same people filtered
       by role, plus their appraisals and their shifts. Four doors to one room meant the
       role was something you navigated to rather than something you filtered by, and a
       colleague's record, their appraisal and their duty sat in three different places.

       Each of those keeps its own PERMISSION ('perf' — the appraisal file is
       confidential and the server gates it; 'roster' likewise), it just no longer keeps
       its own destination: `mods` lists every module this one row can open, and the
       sub-items below carry the module each of them needs. */
    { id:'staff',       label:'Staff Management', icon:I.steth, home:'nurseHome', mods:['staff','perf','roster'],
      on:v=>['staff','perf','roster'].indexOf(unicoModuleOf(v))>=0 },
    // Access Control — accounts and per-person access (access-control.jsx). Same 'users'
    // permission as Settings; it just has its own door now instead of a Settings tab.
    { id:'access',      label:'Access Control',  icon:I.shield, home:'users',       on:v=>unicoModuleOf(v)==='users' },
    // Settings is the admin HUB (Departments config, Form Fields, Data & Export) — the
    // scattered admin submodules fold into its tabs.
    { id:'settings',    label:'Settings',        icon:I.gear,   home:'settings',    on:v=>v==='settings' },
  ]},
];
/* SECTION TABS — the screens INSIDE a sidebar destination.

   The sidebar names the places in the app; it does not enumerate every screen. When
   Nurse Management, PCA Management, Performance and Duty Roster became one Staff
   Management destination, listing all of their screens made a menu you had to scroll —
   so each of those groups carries its own tab strip on the page instead, the way
   Settings always has.

   It lives here, and the shell renders it, because a group's screens can come from
   SEVERAL components: the roster's three tabs are RosterView, window.ManpowerOverview
   and window.RosterReviewFull, so no single component could host the strip. */
const UNICO_VIEW_TABS = [
  { mod:'perf', hide:['perfForm','perfPrint'], parent:{ perfRisk:'perfAttrition' }, tabs:[
    ['perfHome','Overview'], ['perfAchievements','Achievements'], ['perfIncidents','Incidents'],
    ['perfBoard','Recognition'], ['perfAttrition','Attrition & Exits'], ['perfCompare','By Department'],
  ]},
  { mod:'roster', hide:['rosterPrint'], parent:{ rosterGrid:'rosterHome', rosterReview:'rosterHome' }, tabs:[
    ['rosterHome','Rosters'], ['manpower','Manpower'], ['rosterFullReview','Full Review'],
  ]},
];
function unicoViewTabs(view){
  for(let i=0;i<UNICO_VIEW_TABS.length;i++){
    const g=UNICO_VIEW_TABS[i];
    if(unicoModuleOf(view)!==g.mod) continue;
    if((g.hide||[]).indexOf(view)>=0) return null;     // a leaf screen, not a section
    return { cur:(g.parent&&g.parent[view])||view, tabs:g.tabs };
  }
  return null;
}
function ViewTabs({ view, setRoute }){
  const g = unicoViewTabs(view);
  if(!g) return null;
  return (
    <div className="seg" style={{alignSelf:'flex-start',maxWidth:'100%',flexWrap:'wrap',marginBottom:12}}>
      {g.tabs.map(([v,label])=>(
        <button key={v} className={g.cur===v?'on':''} onClick={()=>{ if(g.cur!==v) setRoute({view:v}); }}>{label}</button>
      ))}
    </div>
  );
}

// Where a sidebar row lands. Normally its own `home`; for a row fronting several
// permissions (`mods`), the home of the first one this session can open.
function wsHome(it){
  if(!it.mods) return it.home;
  if(unicoCanAccessModule(unicoAccessModuleOf(it.home))) return it.home;
  for(let i=0;i<it.mods.length;i++){
    const h=UNICO_MODULE_VIEWS[it.mods[i]] && UNICO_MODULE_VIEWS[it.mods[i]][0];
    if(h && unicoCanAccessModule(it.mods[i])) return h;
  }
  return it.home;
}

// Secondary views shown (indented) under the ACTIVE primary destination.
function unicoWorkspaceSub(view){
  const mod = unicoModuleOf(view);
  if(view==='home') return [];
  // My Profile is its own thing, not a workspace: it has no sub-views. Without this
  // it inherited the Statistics sub-nav (unicoModuleOf falls back to 'stats' for any
  // view it does not recognise) and showed a stray "Compare" underneath.
  if(view==='profile') return [];
  if(view==='settings' || mod==='users') return [];   // Settings uses its own internal tabs
  if(mod==='stats' && view!=='dashboard' && view!=='settings') return [
    { label:'Compare', view:'compare' },
  ];
  if(mod==='quality') return [
    { label:'Scorecard',                view:'qualityScore' },
    { label:'Trends',                   view:'qualityTrend' },
    { label:'Incident Reports',         view:'qualityIncidents' },
    { label:'Indicator Administration', view:'qualityManage', match:['qualityManage','qualityCatalog','qualityAssign','qualityEdit'] },
    { label:'Quality Data Entry',       view:'qualityDataEntry' },
    { label:'Action Plans',             view:'qualityCapa' },
  ];
  if(mod==='supervisor') return [
    { label:'Dashboard',       view:'supHome' },
    { label:'Patient Board',   view:'supBoard' },
    { label:'New Report',      view:'supNew' },
    { label:'History',         view:'supHistory' },
    { label:'Generate Report', view:'supReport' },
  ];
  /* STAFF MANAGEMENT — the roster and the appraisal work under one destination.
     There is no "Staff Directory" under Performance: there is ONE staff directory in
     this app, it is the Nurses / PCA rows below, the appraisal status rides on those
     rows and the full record opens on the staff profile. What follows the divider is
     what Performance alone owns — the registers and the roll-ups.

     `mod` names the permission a row needs. A session holding 'staff' but not 'perf'
     sees the roster half only; one holding 'perf' but not 'staff' sees the appraisal
     half. The Sidebar filters on it. */
  /* FIVE ROWS, NOT ELEVEN. The sidebar names the PLACES in this workspace; it does not
     enumerate every screen. Nurses and PCA are the same directory with the role
     switched, so they are one row — and the six Performance screens are tabs on the
     Performance page itself (PerfTabs in performance.jsx), the way Settings has always
     carried its own tabs. A sidebar you have to scroll is a menu, not a map. */
  if(mod==='staff' || mod==='perf' || mod==='roster') return [
    { label:'Dashboard',      view:'nurseHome',       mod:'staff', match:['nurseHome','pcaHome'] },
    { label:'Directory',      view:'nurses',          mod:'staff', match:['nurses','pca'] },
    { label:'Compliance',     view:'nurseCompliance', mod:'staff', match:['nurseCompliance','pcaCompliance'] },
    { label:'Previous Staff', view:'staffPrevious',   mod:'staff' },
    { label:'Nurse / PCA requests', view:'staffRequests', mod:'staff' },
    { label:'Performance',    view:'perfHome',        mod:'perf', divider:true,
      match:UNICO_MODULE_VIEWS.perf },
    { label:'Duty Roster',    view:'rosterHome',      mod:'roster',
      match:UNICO_MODULE_VIEWS.roster },
  ];
  // Data Submission: one sub-item per screen this person may open.
  if(mod==='datasubmit'){ const ok=unicoDsScreens(); return UNICO_DS_SCREENS.filter(s=>ok.indexOf(s[0])>=0).map(([,v,label])=>({ label, view:v })); }
  if(mod==='medicine') return [
    { label:'Medicine Info',     view:'medInfo' },
    { label:'Drug Index',        view:'medBrowse', match:['medBrowse','medBrand','medGeneric'] },
    { label:'New Prescription',  view:'medRxNew' },
    { label:'Prescriptions',     view:'medRxList', match:['medRxList','medRxPrint'] },
    { label:'Interaction Checker',view:'medInteractions' },
    { label:'Dose Calculator',   view:'medCalc' },
    { label:'Rx Templates',      view:'medTemplates' },
    { label:'Prescribing Stats', view:'medAnalytics' },
    { label:'Drug Catalogue',    view:'medCatalog' },
  ];
  if(mod==='reports') return [
    { label:'Patient Statistics', view:'reports' },
    { label:'Quality Indicators', view:'reportsQuality' },
  ];
  if(mod==='datacol') return [
    { label:'Data Entry',          view:'input' },
    { label:'Review & History',    view:'dcReview' },
    { label:'Performance',         view:'dcAnalytics' },
    { label:'Patient Statistics',  view:'dcPatient' },
    { label:'Quality Data',        view:'dcQuality' },
    { label:'Department Setup',    view:'dcSettings' },
    { label:'Share Links',         view:'dcShare' },
  ];
  return [];
}

/* My Account — the signed-in user manages their OWN profile + password (any role).
   Talks to the self-service API in server/users-admin.js (/api/me, /api/me/password). */
function MyAccount({ onClose }){
  const { useState } = React;
  const u = (typeof window!=='undefined' && window.__UNICO_USER__) || null;
  const [tab,setTab] = useState('password');
  const [name,setName] = useState((u&&u.name)||'');
  const [email,setEmail] = useState((u&&u.email)||'');
  const [cur,setCur] = useState(''); const [nw,setNw] = useState(''); const [nw2,setNw2] = useState('');
  const [busy,setBusy] = useState(false); const [err,setErr] = useState(''); const [ok,setOk] = useState('');
  // The account picture is written by the server (POST /api/upload, kind=profile) —
  // an account document is not something the renderer may patch. This state only
  // mirrors it so the avatar updates without a reload.
  const [photo,setPhoto] = useState((u&&u.photo)||null);
  const api = (method,path,body)=>fetch(path,{method,headers:{'Content-Type':'application/json'},credentials:'same-origin',body:body?JSON.stringify(body):undefined}).then(async r=>{ let j=null; try{j=await r.json();}catch(e){} if(!r.ok||!j||j.ok===false) throw new Error((j&&j.error)||(r.status===401?'Sign in to manage your account.':'Request failed ('+r.status+').')); return j; });
  const txt = { padding:'9px 11px', border:'1px solid var(--line)', borderRadius:8, fontSize:13, fontFamily:'inherit', width:'100%', outline:'none', background:'#fff', boxSizing:'border-box' };
  const savePw = async ()=>{ setErr(''); setOk(''); if(nw.length<6) return setErr('New password must be at least 6 characters.'); if(nw!==nw2) return setErr('New passwords do not match.'); setBusy(true);
    try{ await api('POST','/api/me/password',{currentPassword:cur,newPassword:nw}); setOk('Password changed successfully.'); setCur(''); setNw(''); setNw2(''); }catch(e){ setErr(e.message); } finally{ setBusy(false); } };
  const saveProfile = async ()=>{ setErr(''); setOk(''); setBusy(true);
    try{ await api('PATCH','/api/me',{name,email}); if(window.__UNICO_USER__){ window.__UNICO_USER__.name=name; window.__UNICO_USER__.email=email; } setOk('Profile updated. Reload to see it everywhere.'); }catch(e){ setErr(e.message); } finally{ setBusy(false); } };
  const role = u ? (u.role==='collector'?'Data Collector':(u.title||u.role)) : 'Administrator (local)';
  const initials = String((u&&u.name)||'U').split(/\s+/).map(w=>w[0]).filter(Boolean).slice(0,2).join('').toUpperCase()||'U';
  const modal = (
    <div onMouseDown={onClose} style={{position:'fixed',inset:0,background:'rgba(16,32,46,.42)',zIndex:500,display:'grid',placeItems:'center',padding:'clamp(6px,3vw,20px)'}}>
      <div onMouseDown={e=>e.stopPropagation()} className="card" style={{width:'min(440px,96vw)',maxHeight:'92vh',overflow:'auto'}}>
        <div className="card-h"><h3>My Account</h3><span className="spacer"/><button className="icon-btn" style={{width:28,height:28}} onClick={onClose}><Ic d={I.x} s={14}/></button></div>
        <div className="card-b" style={{display:'flex',flexDirection:'column',gap:14}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <PhotoPicker
              value={photo} size={54} kind="profile" initials={initials} name={(u&&u.name)||'Account'}
              readOnly={!u}
              onChange={(next)=>{ setPhoto(next); window.unicoSetAccountPhoto(next); }}
            />
            <div style={{minWidth:0}}><div style={{fontSize:14.5,fontWeight:700,color:'var(--ink)'}}>{(u&&u.name)||'Local Administrator'}</div>
              <div style={{fontSize:12,color:'var(--muted)'}}>{u?('@'+u.username+' · '+role):role}</div></div>
          </div>
          {!u && <div style={{fontSize:12.5,color:'#9a6b00',background:'var(--warn-bg,#fff4e0)',border:'1px solid #f0d9a8',borderRadius:8,padding:'9px 11px'}}>You're in local admin mode (no login). Account settings apply on the deployed site where sign-in is required.</div>}
          <div className="seg"><button className={tab==='password'?'on':''} onClick={()=>{setTab('password');setErr('');setOk('');}}>Password</button><button className={tab==='profile'?'on':''} onClick={()=>{setTab('profile');setErr('');setOk('');}}>Profile</button></div>
          {tab==='password' ? (
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              <div className="field"><label>Current password</label><input type="password" style={txt} value={cur} onChange={e=>setCur(e.target.value)} placeholder="Enter current password"/></div>
              <div className="field"><label>New password</label><input type="password" style={txt} value={nw} onChange={e=>setNw(e.target.value)} placeholder="At least 6 characters"/></div>
              <div className="field"><label>Confirm new password</label><input type="password" style={txt} value={nw2} onChange={e=>setNw2(e.target.value)} placeholder="Re-enter new password"/></div>
              <div style={{display:'flex',justifyContent:'flex-end'}}><button className="btn pri sm" onClick={savePw} disabled={busy}><Ic d={I.check} s={14}/>{busy?'Saving…':'Change password'}</button></div>
            </div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              <div className="field"><label>Full name</label><input style={txt} value={name} onChange={e=>setName(e.target.value)} placeholder="Display name"/></div>
              <div className="field"><label>Email</label><input style={txt} value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@unicohospitals.com"/></div>
              <div style={{display:'flex',justifyContent:'flex-end'}}><button className="btn pri sm" onClick={saveProfile} disabled={busy}><Ic d={I.check} s={14}/>{busy?'Saving…':'Save profile'}</button></div>
            </div>
          )}
          {err && <div style={{fontSize:12.5,color:'#b32339',background:'var(--neg-bg)',borderRadius:7,padding:'8px 10px'}}>{err}</div>}
          {ok && <div style={{fontSize:12.5,color:'var(--pos)',background:'var(--pos-bg)',borderRadius:7,padding:'8px 10px'}}>{ok}</div>}
          <div style={{borderTop:'1px solid var(--line-2)',paddingTop:12,display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontSize:11.5,color:'var(--muted)'}}>Signed in as {u?u.role:'local admin'}</span>
            <span className="spacer" style={{flex:1}}/>
            <a href="/logout" className="btn sm" style={{color:'var(--rose)',borderColor:'#f1c6cd',textDecoration:'none'}}>Sign out</a>
          </div>
        </div>
      </div>
    </div>
  );
  // Portal to <body> so no ancestor transform (the sidebar is transformed on mobile,
  // .content>* is animated) can trap this fixed overlay off-centre.
  return (typeof ReactDOM!=='undefined' && ReactDOM.createPortal && typeof document!=='undefined')
    ? ReactDOM.createPortal(modal, document.body) : modal;
}
window.MyAccount = MyAccount;

function Sidebar({route, setRoute, collapsed, depts}){
  const [acct,setAcct]=React.useState(false);
  const view = route.view;
  // The breach count needs window.UNICO_Q, which lives in the lazily loaded quality
  // chunk. Until it is in, show NOTHING rather than 0: a confident "no breaches" while
  // the module is still downloading is a worse answer than no badge at all. `chunkTick`
  // re-runs this when the chunk lands (unico:chunk-loaded).
  const [chunkTick,setChunkTick]=React.useState(0);
  React.useEffect(()=>{
    const h=()=>setChunkTick(t=>t+1);
    window.addEventListener('unico:chunk-loaded',h);
    return ()=>window.removeEventListener('unico:chunk-loaded',h);
  },[]);
  const qBadge = React.useMemo(()=>(window.UNICO_Q?unicoQualityBreachCount():0),[chunkTick]);
  const supBadge = React.useMemo(()=>unicoSupAlertCount(),[view,chunkTick]);
  // Data Submission: this person's missing count, published by the top-bar bell.
  const [dsBadge,setDsBadge]=React.useState(()=>window.__UNICO_DS_MISSING__||0);
  React.useEffect(()=>{ const h=(e)=>setDsBadge((e&&e.detail)||0); window.addEventListener('unico:ds-missing',h); return ()=>window.removeEventListener('unico:ds-missing',h); },[]);
  // A sub-item can need a permission of its own — Staff Management lists the roster
  // ('staff') and the appraisal screens ('perf') together, and an account may hold
  // only one of them.
  const sub = unicoWorkspaceSub(view).filter(s=>!s.mod || unicoCanAccessModule(s.mod));
  const subOn = s => s.match ? s.match.indexOf(view)>=0 : view===s.view;
  /* Destinations whose sub-menu is open from the start, wherever you are (Data Submission:
     its screens ARE the work, so they should not hide behind a click). The arrow folds it;
     the choice is remembered in this browser. */
  const AUTO_OPEN = { datasubmit: 'dsHome' };
  const [folded,setFolded]=React.useState(()=>{ try{ return JSON.parse(localStorage.getItem('unico_sb_folded_v1')||'{}')||{}; }catch(e){ return {}; } });
  const toggleFold=(id)=>setFolded(f=>{ const n=Object.assign({},f,{[id]:!f[id]}); try{ localStorage.setItem('unico_sb_folded_v1',JSON.stringify(n)); }catch(e){} return n; });
  const subFor = (it, active) => {
    if (active) return sub;
    if (!AUTO_OPEN[it.id] || folded[it.id]) return [];
    return unicoWorkspaceSub(AUTO_OPEN[it.id]).filter(x=>!x.mod || unicoCanAccessModule(x.mod));
  };
  return (
    <aside className="sb">
      <div className="sb-brand">
        <img className="sb-logo-img sb-logo-full" src="unico/logo.svg" alt="UNICO — Hands of Care Hospitals"/>
        <img className="sb-logo-img sb-logo-mark" src="unico/logo-mark.svg" alt="UNICO"/>
      </div>
      <div className="sb-scroll">
        {UNICO_WS.map((g,gi)=>{
          // Show only the workspaces this session is allowed to open. A section whose
          // items are all gated away is dropped entirely (no empty header).
          // `mods` = a destination that fronts SEVERAL permissions (Staff Management
          // fronts 'staff' and 'perf'). It shows when ANY of them is granted, and opens
          // at the landing of the first one this session can actually use — otherwise an
          // account with Performance but no roster clicked through to a forbidden view.
          const items = g.items.filter(it=>it.always || (it.mods
            ? it.mods.some(m=>unicoCanAccessModule(m))
            : unicoCanAccessModule(unicoAccessModuleOf(it.home))));
          if(!items.length) return null;
          return (
          <React.Fragment key={gi}>
            {g.sec && <div className="sb-sec">{g.sec}</div>}
            {items.map(it=>{
              const active = it.on(view);
              const badgeN = it.badge==='sup' ? supBadge : it.badge==='ds' ? dsBadge : (it.badge ? qBadge : 0);
              const badge = badgeN>0 ? badgeN : null;
              const auto = !!AUTO_OPEN[it.id];
              const itSub = auto && folded[it.id] ? [] : subFor(it, active);
              return (
                <React.Fragment key={it.id}>
                  <div className={'sb-item'+(active?' active':'')} onClick={()=>setRoute({view:wsHome(it)})} title={it.label}>
                    <Ic d={it.icon} s={18}/><span className="lbl">{it.label}</span>
                    {it.tag && <span className="lbl" style={{marginLeft:6,fontSize:8.6,fontWeight:800,letterSpacing:.6,padding:'2px 6px',borderRadius:5,color:'#0d1b2e',background:'linear-gradient(135deg,#5fd3c4,#3ab5a7)'}}>{it.tag}</span>}
                    {badge!=null && <span className="badge alert num">{badge}</span>}
                    {auto && <span className="lbl" role="button" aria-label={folded[it.id]?'Show sub-menu':'Hide sub-menu'} title={folded[it.id]?'Show sub-menu':'Hide sub-menu'}
                      onClick={(e)=>{ e.stopPropagation(); toggleFold(it.id); }}
                      style={{marginLeft:badge!=null?6:'auto',display:'inline-grid',placeItems:'center',width:20,height:20,borderRadius:6,cursor:'pointer',opacity:.7,transform:folded[it.id]?'rotate(-90deg)':'none',transition:'transform .15s'}}>
                      <Ic d={I.chevR} s={12} style={{transform:'rotate(90deg)'}}/></span>}
                  </div>
                  {/* secondary views nest under the active destination */}
                  {itSub.length>0 && (
                    <div className="sb-sub">
                      {itSub.map((s,si)=>(
                        <div key={s.view} className={'sb-sub-item'+(subOn(s)?' active':'')} onClick={()=>setRoute({view:s.view})}
                          style={s.divider&&si>0?{marginTop:7,paddingTop:9,borderTop:'1px solid rgba(255,255,255,.10)'}:null}>
                          <span className="dot"/><span className="lbl">{s.label}</span>
                          {s.view==='dsMissing'&&dsBadge>0&&<span className="badge alert num" style={{marginLeft:'auto'}}>{dsBadge}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </React.Fragment>
          );
        })}
      </div>
      <div className="sb-foot">
        {(()=>{
          const u=(typeof window!=='undefined' && window.__UNICO_USER__)||null;
          const name=(u&&u.name)||'Nasif Ahammed Niloy';
          const role=(u&&u.designation)
            || (u?(u.role==='collector'?'Data Collector':(u.role==='incharge'?'In-charge':u.role)):'Administrator');
          const initials=String(name).split(/\s+/).map(w=>w[0]).filter(Boolean).slice(0,2).join('').toUpperCase()||'U';
          return (<>
            <div onClick={()=>setRoute({view:'profile'})} title="My profile — photo, details & password" style={{display:'flex',alignItems:'center',gap:10,minWidth:0,flex:1,cursor:'pointer'}}>
              <UnicoAvatar className="avatar" initials={initials}/>
              <div className="who" style={{minWidth:0,flex:1}}>
                <div style={{color:'#fff',fontSize:12.5,fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{name}</div>
                <div style={{color:'#83909f',fontSize:10.5,whiteSpace:'nowrap'}}>{role}</div>
              </div>
            </div>
            <a href="/logout" title="Sign out" style={{marginLeft:'auto',display:'grid',placeItems:'center',width:32,height:32,borderRadius:8,color:'#cfe0f0',background:'rgba(255,255,255,.08)',textDecoration:'none',flexShrink:0}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>
            </a>
          </>);
        })()}
      </div>
      {acct && <MyAccount onClose={()=>setAcct(false)}/>}
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
  const q1yr = allMonths.length?('20'+String(allMonths[allMonths.length-1]).split('-')[1]):'';
  const presets=[['all','All time'],['last3','Last 3 months'],['last6','Last 6 months'],['q1','Q1'+(q1yr?' '+q1yr:'')],['latest','Latest month']];
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
        <div onMouseLeave={()=>setOpen(false)} style={{position:'absolute',right:0,top:'118%',zIndex:200,width:236,background:'rgba(255,255,255,.88)',backdropFilter:'blur(24px) saturate(1.6)',WebkitBackdropFilter:'blur(24px) saturate(1.6)',border:'1px solid rgba(255,255,255,.92)',boxShadow:'0 22px 56px rgba(31,59,90,.26)',borderRadius:12,overflow:'hidden'}}>
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
  /* Data Submission reminders: what THIS person still owes (their own departments and
     indicators), from the same rule as Data Submission → Missing data. Only for accounts
     that submit data; refreshed every 2 minutes and whenever data is refreshed. */
  const [dsMiss,setDsMiss]=React.useState(null);
  const submitter=(()=>{ const u=window.__UNICO_USER__; const v=u&&u.perms&&u.perms.datasubmit; return !!u&&(u.role||'User')==='User'&&(Array.isArray(v)?v.length>0:(!!v&&v!=='none')); })();
  React.useEffect(()=>{
    if(!submitter) return;
    let live=true;
    const run=()=>{
      const go=()=>window.dcMissingSummary&&window.dcMissingSummary().then(x=>{ if(live) setDsMiss(x); try{ window.__UNICO_DS_MISSING__=x.total||0; window.dispatchEvent(new CustomEvent('unico:ds-missing',{detail:x.total||0})); }catch(e){} }).catch(()=>{});
      if(window.dcMissingSummary) go(); else if(window.unicoLoadChunk) window.unicoLoadChunk('datacollection').then(go).catch(()=>{});
    };
    run();
    const t=setInterval(run,120000);
    window.addEventListener('unico:data-refreshed',run);
    return ()=>{ live=false; clearInterval(t); window.removeEventListener('unico:data-refreshed',run); };
  },[submitter]);
  const dsTotal=(dsMiss&&dsMiss.total)||0;
  const bellCount=missing.length+dsTotal;
  return (
    <div className="topbar">
      <button className="tb-burger" onClick={onBurger} title="Toggle menu"><Ic d={I.grid} s={16}/></button>
      <div className="crumb">
        {crumbs.map((c,i)=>(
          <React.Fragment key={i}>
            {i>0&&<Ic d={I.chevR} s={13} c="#b6c0cc"/>}
            {i===crumbs.length-1
              ? ((route.view==='departments'&&route.dept&&depts&&depts.length)
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
        {/* Always-visible reminder for a data submitter: how much they still owe, one click
            to Missing data. The bell carries the month-by-month list. */}
        {submitter&&dsTotal>0&&route.view!=='dsMissing'&&(
          <button type="button" className="tb-dsmiss" onClick={()=>setRoute({view:'dsMissing'})} title={dsTotal+' data entries still missing — open Missing data'}
            style={{display:'inline-flex',alignItems:'center',gap:8,height:34,padding:'0 12px 0 10px',borderRadius:10,cursor:'pointer',fontFamily:'inherit',
              border:'1px solid rgba(210,58,82,.35)',background:'linear-gradient(135deg,#fff1f3,#ffe3e8)',color:'#a92c42',fontSize:12.5,fontWeight:700,whiteSpace:'nowrap',
              boxShadow:'0 4px 14px rgba(210,58,82,.18)',animation:'tbDsPulse 2.4s ease-in-out infinite'}}>
            <style>{'@keyframes tbDsPulse{0%,100%{box-shadow:0 4px 14px rgba(210,58,82,.18)}50%{box-shadow:0 4px 20px rgba(210,58,82,.38)}}@media (max-width:720px){.tb-dsmiss .tb-dsmiss-t{display:none}}@media (prefers-reduced-motion:reduce){.tb-dsmiss{animation:none!important}}'}</style>
            <Ic d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0zM12 9v4M12 17h.01" s={15} c="#d23a52"/>
            <span className="num" style={{background:'#d23a52',color:'#fff',borderRadius:8,padding:'1px 7px',fontSize:11.5,fontWeight:800}}>{dsTotal}</span>
            <span className="tb-dsmiss-t">missing data · {(dsMiss.months||[]).length} month{(dsMiss.months||[]).length===1?'':'s'}</span>
            <span className="tb-dsmiss-t" style={{color:'#d23a52',textDecoration:'underline'}}>Submit now</span>
          </button>
        )}
        <div style={{position:'relative'}}>
          <button className="tb-icon" onClick={()=>setNotifOpen(o=>!o)} title="Reminders"><Ic d={I.bell} s={17}/>{bellCount>0&&(dsTotal>0
            ? <span className="num" style={{position:'absolute',top:-4,right:-4,minWidth:18,height:18,padding:'0 5px',borderRadius:9,background:'#d23a52',color:'#fff',fontSize:10,fontWeight:800,display:'grid',placeItems:'center',boxSizing:'border-box',border:'2px solid #fff'}}>{dsTotal>99?'99+':dsTotal}</span>
            : <span className="tb-dot"/>)}</button>
          {notifOpen&&(
            <div onMouseLeave={()=>setNotifOpen(false)} style={{position:'absolute',right:0,top:'118%',zIndex:200,width:320,background:'rgba(255,255,255,.88)',backdropFilter:'blur(24px) saturate(1.6)',WebkitBackdropFilter:'blur(24px) saturate(1.6)',border:'1px solid rgba(255,255,255,.92)',boxShadow:'0 22px 56px rgba(31,59,90,.26)',borderRadius:12,overflow:'hidden'}}>
              <div style={{padding:'13px 15px',borderBottom:'1px solid var(--line-2)',display:'flex',alignItems:'center',gap:8}}>
                <Ic d={I.bell} s={16} c="var(--blue)"/><div style={{fontSize:13.5,fontWeight:700}}>Reminders</div>
                <span className="spacer"/>{bellCount>0&&<span className="chip neg">{bellCount}</span>}
              </div>
              {submitter&&(
                <div style={{borderBottom:'1px solid var(--line-2)'}}>
                  <div style={{padding:'10px 15px 6px',fontSize:11,fontWeight:700,letterSpacing:.5,textTransform:'uppercase',color:dsTotal?'#a92c42':'var(--muted)'}}>Data you still owe{dsTotal?' · '+dsTotal:''}</div>
                  {dsMiss===null ? <div style={{padding:'4px 15px 12px',fontSize:12,color:'var(--muted)'}}>Checking…</div>
                    : !dsTotal ? <div style={{padding:'4px 15px 12px',fontSize:12,color:'var(--pos)',fontWeight:600}}>Nothing missing — all your data is in.</div>
                    : <div style={{maxHeight:200,overflowY:'auto'}}>
                        {dsMiss.months.slice(0,8).map(m=>(
                          <div key={m.month} onClick={()=>{ setRoute({view:'dsMissing'}); setNotifOpen(false); }} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 15px',cursor:'pointer'}}
                            onMouseEnter={e=>e.currentTarget.style.background='var(--panel-2)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                            <div style={{width:28,height:28,borderRadius:8,background:'var(--neg-bg)',color:'var(--neg)',display:'grid',placeItems:'center',flexShrink:0}}><Ic d={I.cal} s={14}/></div>
                            <div style={{flex:1,fontSize:12.5,fontWeight:600,color:'var(--ink)'}}>{m.label}</div>
                            <span className="chip neg">{m.count} missing</span>
                          </div>
                        ))}
                        {dsMiss.months.length>8&&<div style={{padding:'4px 15px 8px',fontSize:11,color:'var(--muted)'}}>and {dsMiss.months.length-8} more month{dsMiss.months.length-8===1?'':'s'}</div>}
                      </div>}
                  {dsTotal>0&&<div style={{padding:'6px 12px 12px'}}><button className="btn pri sm" style={{width:'100%',justifyContent:'center'}} onClick={()=>{ setRoute({view:'dsMissing'}); setNotifOpen(false); }}><Ic d={I.upload} s={14}/>Open Missing data</button></div>}
                </div>
              )}
              {currentKey&&(
                <div style={{padding:'10px 15px',background:'var(--blue-50)',borderBottom:'1px solid var(--line-2)',fontSize:11.5,color:'var(--ink-2)'}}>
                  Running month · <b>{monthFull(currentKey)}</b>
                </div>
              )}
              <div style={{maxHeight:300,overflowY:'auto'}}>
                {missing.length===0?(!reporting.length ? null :
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
        {/* Printing takes the record off the screen and out of the building, so it follows
            the Print permission of whatever workspace is open — not merely the right to look
            at it. Administrators and the open local session are unrestricted. */}
        {(()=>{ let ok=true; try{ ok=!window.unicoCan||window.unicoCan(window.unicoAccessModuleOf?window.unicoAccessModuleOf(route&&route.view):'stats','print'); }catch(e){ ok=true; }
          return ok ? <button className="tb-icon" title="Print" onClick={()=>window.print()}><Ic d={I.print} s={17}/></button> : null; })()}
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

Object.assign(window,{ Ic, I, DEPT_ICON, Sidebar, TopBar, Delta, SectionTitle, ModuleSwitch, ViewTabs, unicoViewTabs, unicoModuleOf,
  UNICO_ACCESS_MODULES, unicoAccessModuleOf, unicoAllowedModules, unicoCanAccessModule, unicoCanAccessView, unicoFirstAllowedHome,
  unicoCan, unicoModuleLevel, unicoUserPerms, unicoRefreshPerms });
// Data Submission screens: read by app.jsx (routes) and data-collection.jsx (the screens).
Object.assign(window,{ UNICO_DS_SCREENS, unicoDsScreens, unicoDsViewOf, unicoDsScreenOf });
