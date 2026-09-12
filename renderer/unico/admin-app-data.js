/* Design data for the ADMIN_APP_DATA — lifted verbatim from the Claude Design document
 * (docs/design). Seed/demo values the app falls back to when the server has no
 * live data for a screen. Published as window.ADMIN_APP_DATA. */
(function () {
  'use strict';
  const MODULES = [['stats','Hospital Statistics'],['quality','Quality Indicators'],['supervisor','Supervisor Reports'],['staff','Staff Management'],['datacol','Data Collection'],['reports','Reports'],['users','Administration'],['perf','Performance Appraisal'],['roster','Duty Roster'],['medicine','Medicine & Rx']];
  const ACTS = ['view','edit','add','delete'];
  const lvl = n => ACTS.slice(0, n);
  const P = (v,e,a,d) => ({}); // placeholder (unused)
  const preset = (obj) => Object.fromEntries(MODULES.map(([k]) => [k, lvl(obj[k]||0)]));
  const ROLE_TEMPLATES = [
    {id:'Manager',label:'Manager',desc:'Edit everything, view administration',d:'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',perms:preset({stats:2,quality:2,supervisor:2,staff:2,datacol:2,reports:2,users:1,perf:2,roster:2,medicine:2})},
    {id:'Nurse Manager',label:'Nurse Manager',desc:'Staff, roster, appraisal and quality',d:'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 3a4 4 0 110 8 4 4 0 010-8z',perms:preset({stats:1,quality:3,supervisor:3,staff:4,datacol:3,reports:2,users:0,perf:4,roster:4,medicine:1})},
    {id:'Department Head',label:'Department Head',desc:'Own department data, staff edit',d:'M3 21h18M5 21V7l7-4 7 4v14',perms:preset({stats:1,quality:3,supervisor:3,staff:2,datacol:3,reports:1,users:0,perf:2,roster:3,medicine:1})},
    {id:'Quality Officer',label:'Quality Officer',desc:'Indicators, CAPA, submission review',d:'M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11',perms:preset({stats:1,quality:4,supervisor:1,staff:1,datacol:4,reports:3,users:0,perf:0,roster:0,medicine:1})},
    {id:'Data Entry',label:'Data Entry',desc:'Add statistics and quality data',d:'M12 5v14M5 12h14',perms:preset({stats:3,quality:3,supervisor:3,staff:0,datacol:3,reports:1,users:0,perf:0,roster:0,medicine:1})},
    {id:'Read-only',label:'Read-only',desc:'View dashboards and reports',d:'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 15a3 3 0 100-6 3 3 0 000 6z',perms:preset({stats:1,quality:1,supervisor:1,staff:1,datacol:1,reports:1,users:0,perf:1,roster:1,medicine:1})},
  ];
  const ROLE_META = {
    Administrator:{label:'Administrator',desc:'Unrestricted. Every module and this console.',c:'#6a52d4',bg:'rgba(106,82,212,.13)',tag:'FULL'},
    User:{label:'Console user',desc:'Desktop console with per-module permissions below.',c:'#0072a3',bg:'rgba(0,144,202,.13)',tag:'SCOPED'},
    incharge:{label:'Nurse in-charge',desc:'Nurse App · runs a ward: roster, approvals, reports, data collection.',c:'#1e8a7c',bg:'rgba(58,181,167,.16)',tag:'PORTAL'},
    collector:{label:'Data collector',desc:'Nurse App · submits monthly data for assigned departments.',c:'#b8650a',bg:'rgba(224,138,30,.15)',tag:'PORTAL'},
  };
  const DEPTS = ['LDR','CCU','SICU','MICU','NICU','Emergency','OPD','Cath Lab','CT ICU'];
  const DEPT_INFO = {LDR:{name:'Labour & Delivery',staff:14,beds:12,incharge:'Priya Das'},CCU:{name:'Coronary Care Unit',staff:12,beds:10,incharge:'Mahmud Hasan'},SICU:{name:'Surgical ICU',staff:16,beds:12,incharge:'Mahmuda Akter'},MICU:{name:'Medical ICU',staff:18,beds:14,incharge:'Rafiq Ahmed'},NICU:{name:'Neonatal ICU',staff:11,beds:16,incharge:'Nusrat Jahan'},Emergency:{name:'Emergency Medicine',staff:22,beds:20,incharge:'Rakibul Hasan'},OPD:{name:'Out-patient Dept',staff:9,beds:0,incharge:'Tania Sultana'},'Cath Lab':{name:'Cath Lab',staff:6,beds:4,incharge:'Arif Chowdhury'},'CT ICU':{name:'Cardiothoracic ICU',staff:14,beds:10,incharge:'Sabina Nasrin'}};
  const DC_ITEMS = ['Patient statistics','Hand hygiene','HAPU','Falls','Medication errors','Needle-stick','Surgical checklist','CLABSI'];
  const USERS = [
    {username:'admin',name:'System Administrator',role:'Administrator',roleId:'Administrator',active:true,emp:'UN-0001',depts:[],scope:'all',perms:{},online:true,lastLogin:'Signed in now · 10.0.4.21',created:'Jan 2024',twofa:true,sessions:2},
    {username:'e.singh',name:'Elizabeth Jothi Raja Singh',role:'User',roleId:'Nurse Manager',title:'Nurse Manager',active:true,emp:'UN-0102',depts:[],scope:'all',perms:{},online:true,lastLogin:'Today 8:02 · 10.0.4.35',created:'Jan 2024',twofa:true,sessions:1},
    {username:'cns',name:'Dr. Nasreen Sultana',role:'User',roleId:'CNS',title:'Chief of Nursing Services',active:true,emp:'UN-0100',depts:[],scope:'all',perms:{},online:true,lastLogin:'Today 8:45 · 10.0.4.30',created:'Jan 2024',twofa:true,sessions:1},
    {username:'s.parvin',name:'Shahnaz Parvin',role:'User',roleId:'Nurse Manager',title:'Nurse Manager',active:true,emp:'UN-0108',depts:['SICU','MICU','Emergency','OPD'],scope:'departments',perms:{},online:true,lastLogin:'Today 9:10 · 10.0.4.41',created:'Feb 2024',twofa:true,sessions:1},
    {username:'r.karim',name:'Rezaul Karim',role:'User',roleId:'Nurse Manager',title:'Nurse Manager',active:true,emp:'UN-0110',depts:[],scope:'all',perms:ROLE_TEMPLATES[0].perms,online:false,lastLogin:'Yesterday 17:40',created:'Mar 2024',twofa:true,sessions:0},
    {username:'quality',name:'Quality & Patient Safety',role:'User',roleId:'Quality Officer',title:'Quality Officer',active:true,emp:'—',depts:[],scope:'all',perms:ROLE_TEMPLATES[3].perms,online:true,lastLogin:'Today 9:05 · 10.0.4.60',created:'Feb 2024',twofa:false,sessions:1},
    {username:'priya.das',name:'Priya Das',role:'incharge',roleId:'incharge',active:true,emp:'UN-0871',depts:['LDR'],scope:'departments',perms:{},online:true,lastLogin:'Today 7:48 · mobile',created:'Jun 2025',twofa:true,sessions:1},
    {username:'mahmuda.a',name:'Mahmuda Akter',role:'collector',roleId:'collector',active:true,emp:'UN-0402',depts:['SICU'],scope:'departments',perms:{},online:false,lastLogin:'2 Sep 11:20 · mobile',created:'Aug 2025',twofa:false,sessions:0},
    {username:'sabina.n',name:'Sabina Nasrin',role:'collector',roleId:'collector',active:true,emp:'UN-0517',depts:['CT ICU'],scope:'departments',perms:{},online:false,lastLogin:'1 Sep 09:12 · mobile',created:'Aug 2025',twofa:false,sessions:0},
    {username:'farhana.h',name:'Farhana Haque',role:'incharge',roleId:'incharge',active:true,emp:'UN-0388',depts:['MICU'],scope:'departments',perms:{},online:true,lastLogin:'Today 8:30 · mobile',created:'Aug 2025',twofa:true,sessions:1},
    {username:'rakib.h',name:'Rakibul Hasan',role:'User',roleId:'Data Entry',title:'Data Entry',active:true,emp:'UN-0620',depts:['Emergency'],scope:'departments',perms:ROLE_TEMPLATES[4].perms,online:false,lastLogin:'5 Sep 14:02',created:'Oct 2025',twofa:false,sessions:0},
    {username:'auditor',name:'External auditor (JCI)',role:'User',roleId:'Read-only',title:'Read-only',active:false,emp:'—',depts:[],scope:'all',perms:ROLE_TEMPLATES[5].perms,online:false,lastLogin:'12 Jun 2026',created:'Jun 2026',twofa:false,sessions:0},
    {username:'it.support',name:'IT Helpdesk',role:'User',roleId:'IT Helpdesk',title:'IT Helpdesk',active:true,emp:'—',depts:[],scope:'self',perms:preset({users:1,medicine:1}),online:false,lastLogin:'Fri 16:10',created:'Jan 2024',twofa:true,sessions:0},
  ];
  const QUEUE = [
    {id:1,dept:'SICU',by:'Mahmuda Akter',label:'CLABSI rate',kind:'Quality',vals:[['Infections',0],['Line days',142]],value:'0.00',bench:'≤ 1.5 per 1000',ok:true,when:'2 Sep 11:20'},
    {id:2,dept:'SICU',by:'Mahmuda Akter',label:'VAP rate',kind:'Quality',vals:[['VAP cases',1],['Vent days',96]],value:'10.42',bench:'≤ 2 per 1000',ok:false,when:'2 Sep 11:24',note:'One late-onset VAP, bed 4, day 9 of ventilation.'},
    {id:3,dept:'CT ICU',by:'Sabina Nasrin',label:'Patient statistics',kind:'Statistics',vals:[['Admissions',37],['Discharges',35],['Deaths',2],['Patient days',264]],value:null,bench:'',ok:true,when:'1 Sep 09:12'},
    {id:4,dept:'CT ICU',by:'Sabina Nasrin',label:'Hand hygiene compliance',kind:'Quality',vals:[['Compliant',168],['Observed',200]],value:'84.0%',bench:'≥ 85%',ok:false,when:'1 Sep 09:15'},
    {id:5,dept:'LDR',by:'Priya Das',label:'HAPU rate',kind:'Quality',vals:[['New HAPU',1],['Patient days',1240]],value:'0.81',bench:'≤ 1.5 per 1000',ok:true,when:'2 Sep 11:05'},
    {id:6,dept:'MICU',by:'Farhana Haque',label:'Patient fall rate',kind:'Quality',vals:[['Falls',1],['Patient days',402]],value:'2.49',bench:'≤ 0.5 per 1000',ok:false,when:'3 Sep 08:40',dupe:true},
    {id:7,dept:'LDR',by:'Priya Das',label:'Hand hygiene compliance',kind:'Quality',vals:[['Compliant',176],['Observed',200]],value:'88.0%',bench:'≥ 85%',ok:true,when:'Today 9:20',corr:true,note:'Correction: August observed count was 190, not 200.'},
    {id:8,dept:'Emergency',by:'Rakibul Hasan',label:'Patient statistics',kind:'Statistics',vals:[['Attendances',3812],['Admitted',604],['Deaths',7]],value:null,bench:'',ok:true,when:'4 Sep 16:02'},
  ];
  const LEAVE = [
    {id:'l1',dept:'LDR',by:'Priya Das',label:'Annual leave · Rahima Khatun · 22–26 Sep',kind:'Leave',vals:[['Days',5],['Cover',1]],value:null,ok:true,when:'Today 8:10',note:'Recommended by in-charge. Ward cover arranged with NICU float.'},
    {id:'l2',dept:'MICU',by:'Farhana Haque',label:'Overtime claim · 3 nurses · 14 h',kind:'Overtime',vals:[['Hours',14],['Staff',3]],value:null,ok:true,when:'Yesterday 21:05'},
  ];
  const REPORTS_Q = [
    {id:'r1',dept:'LDR',by:'Priya Das',label:'Shift report · 7 Sep N2',kind:'Shift report',vals:[['Adm',3],['Deliveries',2],['Events',0]],value:null,ok:true,when:'8 Sep 8:05'},
    {id:'r2',dept:'CCU',by:'Mahmud Hasan',label:'Shift report · 7 Sep E3',kind:'Shift report',vals:[['Adm',2],['Deaths',1],['Events',1]],value:null,ok:false,when:'7 Sep 22:30',note:'Death: expected, DNR documented. Code Blue on bed 6 at 19:40.'},
  ];
  const LOG = [
    {who:'System Administrator',text:'approved SICU · CLABSI rate (Aug)',when:'Today 9:31',ip:'10.0.4.21',action:'submission_approved',c:'#1d8f57'},
    {who:'Elizabeth J. Raja Singh',text:'signed in',when:'Today 8:02',ip:'10.0.4.35',action:'login',c:'#0090ca'},
    {who:'Priya Das',text:'submitted LDR · Hand hygiene (correction)',when:'Today 9:20',ip:'mobile',action:'submission_created',c:'#6a52d4'},
    {who:'System Administrator',text:'changed permissions for @rakib.h · Data Collection: +delete',when:'Yesterday 17:52',ip:'10.0.4.21',action:'user_updated',c:'#b8650a'},
    {who:'r.karim',text:'failed sign-in (invalid credentials) ×3',when:'Yesterday 17:31',ip:'103.92.11.4',action:'login_failed',c:'#b32e2e'},
    {who:'System Administrator',text:'created account @auditor (Read-only)',when:'12 Jun',ip:'10.0.4.21',action:'user_created',c:'#0090ca'},
    {who:'Quality & Patient Safety',text:'returned MICU · Patient fall rate — denominator',when:'3 Sep 09:10',ip:'10.0.4.60',action:'submission_rejected',c:'#b32e2e'},
    {who:'Elizabeth J. Raja Singh',text:'published notice “Infection control: new isolation protocol”',when:'Today 8:15',ip:'10.0.4.35',action:'notice_published',c:'#6a52d4'},
    {who:'System Administrator',text:'signed out everywhere for @sabina.n',when:'28 Aug',ip:'10.0.4.21',action:'session_revoked',c:'#b8650a'},
    {who:'IT Helpdesk',text:'restored backup unico-2026-08-31.json',when:'31 Aug 23:10',ip:'10.0.4.9',action:'backup_restore',c:'#3c4858'},
  ];
  const SCREENS = [['login','Login'],['home','Home'],['modules','All modules'],['module','Module screen'],['medDetail','Medicine detail (admin)'],['appAccess','Nurse App access'],['users','Users & access'],['userDetail','User detail'],['newUser','New user'],['roles','Roles'],['roleEdit','Role editor'],['org','Nursing hierarchy'],['approvals','Review & approve'],['depts','Departments'],['deptDetail','Department detail'],['broadcast','Broadcast'],['activity','Activity log'],['settings','Settings'],['drawer','Sidebar menu']];
  const MOD_META = {
    stats:{label:'Hospital Statistics',sub:'Dashboards, departments, data entry',d:'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',color:'#0072a3',bg:'rgba(0,144,202,.13)',tabs:['Dashboard','Departments','Compare','Trends','Data entry','Manage depts']},
    quality:{label:'Quality Indicators',sub:'Indicators · scorecard · CAPA · incidents',d:'M12 21s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 11c0 5.5-7 10-7 10z',color:'#b32e2e',bg:'rgba(214,69,69,.12)',tabs:['Dashboard','Scorecard','Trends','Catalog','CAPA','Incidents']},
    supervisor:{label:'Supervisor Reports',sub:'Shift supervisor rounds',d:'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8',color:'#6a52d4',bg:'rgba(106,82,212,.13)',tabs:['Pending','This week','Sections']},
    staff:{label:'Staff Management',sub:'Nurses, PCAs, compliance, privileges',d:'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 3a4 4 0 110 8 4 4 0 010-8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',color:'#1e8a7c',bg:'rgba(58,181,167,.16)',tabs:['Overview','Nurses','PCA','Compliance','Privileges']},
    datacol:{label:'Data Collection',sub:'Review, responsible persons, links',d:'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z',color:'#0072a3',bg:'rgba(0,144,202,.13)',tabs:['Review','Responsible persons','Share links','Form fields','Analytics']},
    reports:{label:'Reports',sub:'PDF generator · header & footer',d:'M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zM8 10v6M12 8v8M16 12v4',color:'#b8650a',bg:'rgba(224,138,30,.15)',tabs:['Generate','Saved','Header & footer']},
    users:{label:'User Management',sub:'Accounts, roles, permissions',d:'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 3a4 4 0 110 8 4 4 0 010-8z',color:'#6a52d4',bg:'rgba(106,82,212,.13)',tabs:[]},
    perf:{label:'Performance Appraisal',sub:'Cycles, sign-offs, bands',d:'M18 20V10M12 20V4M6 20v-6',color:'#1e8a7c',bg:'rgba(58,181,167,.16)',tabs:['Cycles','Pending sign-off','Bands']},
    roster:{label:'Duty Roster',sub:'Approve monthly rosters',d:'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z',color:'#0072a3',bg:'rgba(0,144,202,.13)',tabs:['Review queue','Departments','Shift codes']},
    medicine:{label:'Medicine & Rx',sub:'Formulary, high-alert list, stock',d:'M10.5 20.5l10-10a4.95 4.95 0 00-7-7l-10 10a4.95 4.95 0 007 7zM8.5 8.5l7 7',color:'#b32e2e',bg:'rgba(214,69,69,.12)',tabs:['Formulary','High-alert','Stock','Requests']},
  };
  const MOD_ORDER = ['stats','quality','supervisor','staff','datacol','reports','users','perf','roster','medicine'];
  const APP_ROLES = [['nurse','Staff nurse'],['incharge','In-charge'],['collector','Collector'],['pca','PCA']];
  const APP_FEATURES = [
    {sec:'Core',rows:[['home','Home & today\'s shift','Shift card, clock-in',[1,1,1,1]],['roster','My roster','Calendar & shift detail',[1,1,1,1]],['requests','Swap & leave requests','Send requests',[1,1,1,1]],['approvals','Team approvals','Approve swaps & leave',[0,1,0,0]],['handover','Shift handover','Checklist & notes',[1,1,0,1]]]},
    {sec:'Communication',rows:[['chatDept','Department chat','Rooms & direct messages',[1,1,1,1]],['chatHosp','Hospital-wide chat','All-staff rooms',[1,1,1,0]],['notices','Notices','Read & acknowledge',[1,1,1,1]],['compose','Post announcements','Compose & track acks',[0,1,0,0]],['staffDir','Staff directory','Names & roles',[1,1,1,1]],['phones','Phone & WhatsApp','Personal numbers visible',[1,1,0,0]]]},
    {sec:'Clinical',rows:[['meds','Medicine info','Formulary lookup',[1,1,1,0]],['medReq','Request a medicine','Add-to-formulary requests',[1,1,0,0]],['incident','Report an incident','Anonymous option',[1,1,1,1]],['performance','My performance','Appraisal & goals',[1,1,1,1]]]},
    {sec:'Management & data',rows:[['reports','Reports & statistics','Unit dashboards',[0,1,0,0]],['shiftReport','Submit shift report','6-step form',[0,1,0,0]],['datacol','Data collection','Monthly submissions',[0,1,1,0]],['datacolHist','Submission history','Approved / returned',[0,1,1,0]],['rosterEdit','Make the unit roster','Prepare, submit & export',[0,1,0,0]],['unitStaff','My unit staff','Photos, IDs, joining dates, birthdays',[0,1,0,0]]]},
  ];
  const FEAT_FLAT = APP_FEATURES.flatMap(g=>g.rows);
  const FEAT_LABEL = Object.fromEntries(FEAT_FLAT.map(r=>[r[0],r[1]]));
  const ROLE_COLORS = ['#6a52d4','#0072a3','#1e8a7c','#b8650a','#b32e2e','#3c4858'];
  const KIND_META = {admin:{label:'Administrator',desc:'Desktop console and this app. Unrestricted, bypasses every check.',tag:'FULL',c:'#6a52d4'},console:{label:'Console user',desc:'Desktop console with per-module View / Edit / Add / Delete permissions.',tag:'SCOPED',c:'#0072a3'},portal:{label:'Nurse App',desc:'Signs in on the phone. Gets the app features you allow, scoped to their departments.',tag:'PORTAL',c:'#1e8a7c'}};
  const featDefaults = idx => Object.fromEntries(FEAT_FLAT.map(r=>[r[0],!!r[3][idx]]));
  const PARENT_SEED = {Administrator:null,CNS:'Administrator','Nurse Manager':'CNS',Manager:'CNS','Department Head':'Nurse Manager','Quality Officer':'CNS','Data Entry':'Department Head','Read-only':'CNS','IT Helpdesk':'Administrator',incharge:'Nurse Manager',nurse:'incharge',collector:'incharge',pca:'incharge'};
  const seedRoles = () => [
    {id:'Administrator',label:'Administrator',desc:'Unrestricted access',kind:'admin',system:true,color:'#6a52d4',perms:{},appFeats:{},scope:'all'},
    {id:'CNS',label:'Chief of Nursing Services',desc:'Head of the nursing department · final approver',kind:'console',system:true,color:'#6a52d4',perms:preset({stats:2,quality:4,supervisor:4,staff:4,datacol:4,reports:4,users:1,perf:4,roster:4,medicine:2}),appFeats:{},scope:'all'},
    ...ROLE_TEMPLATES.map(t=>({id:t.id,label:t.label,desc:t.id==='Nurse Manager'?'Department manager · runs a cluster of wards':t.desc,kind:'console',system:t.id==='Nurse Manager',color:t.id==='Nurse Manager'?'#0072a3':'#0072a3',perms:JSON.parse(JSON.stringify(t.perms)),appFeats:{},scope:t.id==='Nurse Manager'?'departments':'all'})),
    {id:'IT Helpdesk',label:'IT Helpdesk',desc:'Administration view, medicine view',kind:'console',system:false,color:'#3c4858',perms:preset({users:1,medicine:1}),appFeats:{},scope:'self'},
    {id:'incharge',label:'Nurse in-charge',desc:'Runs a ward: approvals, reports, data',kind:'portal',system:true,color:'#1e8a7c',perms:{},appFeats:featDefaults(1),scope:'departments'},
    {id:'nurse',label:'Staff nurse',desc:'Ward nurse on the Nurse App',kind:'portal',system:true,color:'#3ab5a7',perms:{},appFeats:featDefaults(0),scope:'departments'},
    {id:'collector',label:'Data collector',desc:'Submits monthly data only',kind:'portal',system:true,color:'#b8650a',perms:{},appFeats:featDefaults(2),scope:'departments'},
    {id:'pca',label:'PCA',desc:'Patient care assistant',kind:'portal',system:false,color:'#6a52d4',perms:{},appFeats:featDefaults(3),scope:'self'},
  ].map(r=>({...r,parent:PARENT_SEED[r.id]===undefined?'CNS':PARENT_SEED[r.id]}));
  const CLUSTERS_SEED = [{id:'wc',name:'Women & Children',manager:'e.singh',depts:['LDR','NICU']},{id:'cardiac',name:'Cardiac Sciences',manager:'r.karim',depts:['CCU','Cath Lab','CT ICU']},{id:'crit',name:'Critical Care & Emergency',manager:'s.parvin',depts:['SICU','MICU','Emergency','OPD']}];
  const APPROVAL_RULES = [
    {id:'swap',label:'Shift swap',sub:'Between two nurses, same month',d:'M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4',def:['incharge']},
    {id:'leave3',label:'Leave ≤ 3 days',sub:'Casual / sick',d:'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z',def:['incharge']},
    {id:'leave7',label:'Leave 4 – 7 days',sub:'Annual leave',d:'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z',def:['incharge','Nurse Manager']},
    {id:'leave8',label:'Leave > 7 days',sub:'Extended, maternity, study',d:'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z',def:['incharge','Nurse Manager','CNS']},
    {id:'roster',label:'Monthly roster',sub:'Publish to the ward',d:'M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18',def:['Nurse Manager']},
    {id:'shiftrep',label:'Shift report',sub:'Sign-off',d:'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6',def:['Nurse Manager']},
    {id:'datacol',label:'Monthly data submission',sub:'Quality & statistics',d:'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z',def:['Quality Officer']},
    {id:'incident',label:'Severe incident',sub:'RCA sign-off',d:'M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z',def:['Quality Officer','CNS']},
    {id:'medreq',label:'Add medicine to formulary',sub:'From ward requests',d:'M10.5 20.5l10-10a4.95 4.95 0 00-7-7l-10 10a4.95 4.95 0 007 7zM8.5 8.5l7 7',def:['Nurse Manager']},
    {id:'appraisal',label:'Performance appraisal',sub:'Final sign-off',d:'M18 20V10M12 20V4M6 20v-6',def:['incharge','Nurse Manager']},
  ];
  const CM_TYPES = [['checklist','Checklist','M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11'],['form','Data form','M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8'],['register','Patient register','M3 3h18v18H3zM3 9h18M3 15h18M9 3v18'],['audit','Audit round','M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-4.3-4.3']];
  const MONTHS7 = ['Mar','Apr','May','Jun','Jul','Aug','Sep'];
  const STATS_DEPTS = {LDR:[45,81],CCU:[62,88],SICU:[58,92],MICU:[71,95],NICU:[38,84],Emergency:[604,0],OPD:[3120,0],'Cath Lab':[96,0],'CT ICU':[37,79]};
  // monthly series Mar–Sep 2026 (Sep partial) · hospital-wide
  const STAT_SERIES = {
    adm:[3620,3710,3890,3760,3902,4131,1104], dis:[3540,3660,3810,3720,3850,4060,1010], deaths:[38,41,36,44,39,42,9], pdays:[11200,11480,11960,11700,12010,12580,3390],
    occ:[79,81,83,82,84,86,84], alos:[3.3,3.2,3.2,3.3,3.1,3.1,3.0], er:[3410,3520,3660,3590,3740,3812,1020], surg:[402,418,431,409,445,462,121], deliveries:[128,131,140,136,142,149,41],
  };
  const DEPT_SERIES = {LDR:[40,42,44,41,43,45,12],CCU:[55,58,60,57,61,62,17],SICU:[50,52,55,54,56,58,15],MICU:[64,66,70,67,69,71,19],NICU:[33,35,36,34,37,38,10],Emergency:[540,560,590,570,588,604,162],OPD:[2810,2900,3010,2950,3060,3120,840],'Cath Lab':[82,88,90,86,92,96,26],'CT ICU':[31,33,35,34,36,37,10]};
  const DEPT_DEATHS = {LDR:1,CCU:6,SICU:8,MICU:12,NICU:3,Emergency:7,OPD:0,'Cath Lab':1,'CT ICU':4};
  const DEPT_ALOS = {LDR:2.4,CCU:3.8,SICU:5.1,MICU:6.2,NICU:9.4,Emergency:0.3,OPD:0,'Cath Lab':1.1,'CT ICU':5.6};
  const IND_CATALOG = [['Hand hygiene compliance','(compliant ÷ observed) × 100','≥ 85%',true],['Hospital-acquired pressure ulcer','(new HAPU ÷ patient-days) × 1000','≤ 1.5',true],['Patient fall rate','(falls ÷ patient-days) × 1000','≤ 0.5',true],['CLABSI rate','(infections ÷ line-days) × 1000','≤ 1.5',true],['VAP rate','(VAP ÷ vent-days) × 1000','≤ 2',true],['CAUTI rate','(CAUTI ÷ catheter-days) × 1000','≤ 1.5',true],['Medication error rate','(errors ÷ doses) × 100','≤ 0.5%',true],['Needle-stick injuries','count per 100 staff','0',true],['Surgical safety checklist','(complete ÷ surgeries) × 100','≥ 95%',true],['Door-to-CT ≤ 25 min (stroke)','(≤25 min ÷ all) × 100','≥ 80%',false]];
  const CAPA_LIST = [['MICU','Patient falls above target','Bed alarms on all high-risk beds','Farhana Haque','15 Sep','open'],['CT ICU','Hand hygiene 84%','Two-observer audit weekly','Sabina Nasrin','30 Sep','open'],['LDR','Medication errors ×2','Independent double check, RCA','Priya Das','12 Sep','open'],['SICU','VAP 10.4 per 1000','Head-of-bed 30°, oral care q4h','Mahmuda Akter','20 Sep','progress'],['CCU','CLABSI 11.4','Line necessity review daily','Mahmud Hasan','10 Sep','closed']];
  const INCIDENTS = [['IR-2026-0912','LDR','Medication','Minor','Wrong time – oral iron given 2 h late','Open'],['IR-2026-0911','MICU','Fall','Moderate','Patient found on floor beside bed 3, no injury','Under review'],['IR-2026-0909','Emergency','Needle-stick','Minor','Recapping during IV cannulation','Closed'],['IR-2026-0905','SICU','Equipment','Severe','Infusion pump alarm failure','Under review'],['IR-2026-0902','CCU','Near miss','Near miss','Heparin dose queried before administration','Closed']];
  const SUP_REPORTS = [['7 Sep','N2','Rahima Khatun','All wards','12 adm · 9 dis · 1 death · 0 events','pending'],['7 Sep','E3','Mahmud Hasan','All wards','9 adm · 11 dis · 1 death · Code Blue CCU-6','pending'],['7 Sep','M4','Priya Das','All wards','14 adm · 8 dis · 0 deaths','approved'],['6 Sep','N2','Rafiq Ahmed','All wards','8 adm · 6 dis · 0 events','approved'],['6 Sep','E3','Tania Sultana','All wards','11 adm · 12 dis · 1 fall (MICU)','approved']];
  const SUP_SECTIONS = ['Census & admissions','Critical area','Cabin area','Discharges','Ventilator status','Radiology counts','ER census','Events & incidents','Pressure sore register','Phlebitis register','Absenteeism & sick leave','Round observation'];
  const STAFF_ROWS = [['Rahima Khatun','Senior Staff Nurse','LDR','Nurse','UN-0934'],['Sumaiya Akter','Staff Nurse','LDR','Nurse','UN-1088'],['Tanvir Hossain','Staff Nurse','LDR','Nurse','UN-1051'],['Nusrat Jahan','Staff Nurse','NICU','Nurse','UN-0990'],['Mahmud Hasan','Charge Nurse','CCU','Nurse','UN-0712'],['Arif Chowdhury','Staff Nurse','Emergency','Nurse','UN-1012'],['Tania Sultana','Staff Nurse','SICU','Nurse','UN-0968'],['Shathi Rani','PCA','LDR','PCA','UN-1120'],['Rubel Mia','PCA','MICU','PCA','UN-1131'],['Moni Akter','Senior PCA','CCU','PCA','UN-1015']];
  const COMPLIANCE = [['Rahima Khatun','BNMC licence expires 30 Sep','15 d','#b32e2e'],['Tanvir Hossain','BLS certificate expired','-8 d','#b32e2e'],['Nusrat Jahan','Hep-B dose 3 due','12 d','#b8650a'],['Arif Chowdhury','NRP training missing','—','#b8650a'],['Moni Akter','Annual appraisal not signed','30 d','#b8650a'],['Sumaiya Akter','ID photo missing','—','#7d8ea8']];
  const PRIV_GROUPS = [['IV cannulation & infusion','LDR, CCU, SICU, MICU, Emergency',6],['Medication administration','All nursing departments',9],['Neonatal resuscitation','LDR, NICU',2],['Ventilator care','SICU, MICU, CT ICU',3],['Cardiac monitoring & defibrillation','CCU, Cath Lab, CT ICU, Emergency',4],['Wound & pressure-injury care','All nursing departments',9]];
  const SHARE_LINKS = [['/s/K7Q2M','Quality data','SICU','Mahmuda Akter','30 Sep',true],['/s/D4P9X','Patient statistics','CT ICU','Sabina Nasrin','30 Sep',true],['/s/A1Z8R','Quality data','Dialysis','Mitu Rani Das','15 Sep',true],['/s/H6W3T','Patient statistics','OPD','Tania Sultana','expired',false]];
  const FORM_FIELDS = {LDR:['Admissions','Discharges','Deaths','Patient days','Deliveries (NVD)','Caesarean','Live births','Stillbirths'],SICU:['Admissions','Discharges','Deaths','Patient days','Ventilator days','Central line days'],Emergency:['Attendances','Admitted','Deaths','Left without being seen','Triage ≤ 10 min'],NICU:['Admissions','Discharges','Deaths','Patient days','< 1500 g admissions'],Dialysis:['Sessions','New patients','Missed sessions']};
  const SAVED_REPORTS = [['Monthly Quality Scorecard · Aug 2026','A4 portrait · 14 pp','Today 08:40','PDF'],['Nursing Manpower Overview · Q2','A3 landscape · 6 pp','30 Aug','PDF'],['Hospital Statistics Summary · Jul 2026','A4 portrait · 9 pp','2 Aug','PDF'],['CLABSI trend · all ICUs','Letter · 3 pp','28 Jul','PDF']];
  const APPRAISALS = [['Sumaiya Akter','LDR','4.4','Priya Das'],['Tanvir Hossain','LDR','3.9','Priya Das'],['Nusrat Jahan','NICU','4.6','Nusrat Jahan (self)'],['Arif Chowdhury','Emergency','4.1','Rakibul Hasan'],['Moni Akter','CCU','3.7','Mahmud Hasan']];
  const ROSTERS = [['LDR','October 2026','Priya Das','14 staff · 3 conflicts resolved','submitted'],['CCU','October 2026','Mahmud Hasan','12 staff · night cover 3/3','submitted'],['SICU','October 2026','Mahmuda Akter','16 staff · 1 unfilled N2 on 12 Oct','submitted'],['NICU','October 2026','Nusrat Jahan','11 staff','draft'],['MICU','October 2026','Rafiq Ahmed','18 staff','approved'],['Emergency','October 2026','Rakibul Hasan','22 staff','draft'],['LDR','September 2026','Priya Das','14 staff','approved']];
  const SHIFT_CODES = [['G1','9:00 AM – 5:00 PM','General',8],['G3','8:00 AM – 4:00 PM','General',8],['M4','8:00 AM – 2:00 PM','Morning',6],['M3','8:00 AM – 8:00 PM','Morning long',12],['E3','2:00 PM – 10:00 PM','Evening',8],['E4','2:00 PM – 8:00 PM','Evening short',6],['N2','8:00 PM – 8:00 AM','Night',12],['DN','12:00 PM – 8:00 AM','Double night',20]];
  const MEDS_ADMIN = [['Napa','Paracetamol 500 mg','Beximco',false,'In stock'],['Anadol','Tramadol 50 mg','SK+F',true,'Controlled · locked'],['Ceftron','Ceftriaxone 1 g','Square',false,'In stock'],['Actrapid','Insulin soluble 100 IU/mL','Novo Nordisk',true,'Low stock'],['Klexane','Enoxaparin 40 mg','Sanofi',true,'In stock'],['Losectil','Omeprazole 20 mg','Eskayef',false,'In stock'],['Comet','Metformin 500 mg','Square',false,'Stock out'],['Lasix','Furosemide 40 mg','Sanofi',false,'In stock'],['Decason','Dexamethasone 0.5 mg','Opsonin',false,'In stock'],['Indever','Propranolol 10 mg','ACI',false,'Low stock']];
  const MED_REQUESTS = [['Oxytocin 10 IU/mL','LDR · Priya Das','Used every delivery, not in formulary lookup','pending'],['Magnesium sulphate 50%','LDR · Priya Das','Eclampsia protocol reference','pending'],['Noradrenaline 4 mg/4 mL','SICU · Mahmuda Akter','High-alert, needs dilution card','approved']];
  const pillBtn = on => `border:0;border-radius:8px;padding:7px 10px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;${on?'background:linear-gradient(140deg,#6a52d4,#0072a3);color:#fff;box-shadow:0 4px 12px rgba(106,82,212,.3)':'background:transparent;color:#3c4858'}`;
  const chip = on => `border:1px solid ${on?'rgba(106,82,212,.5)':'rgba(125,145,180,.3)'};border-radius:999px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0;${on?'background:rgba(106,82,212,.12);color:#6a52d4':'background:rgba(255,255,255,.6);color:#3c4858'}`;
  const ini = n => n.split(' ').filter(Boolean).map(w=>w[0]).slice(0,2).join('').toUpperCase();
  const toggle = (on) => ({track:`position:relative;width:44px;height:26px;border-radius:13px;border:0;cursor:pointer;flex-shrink:0;transition:background .2s;background:${on?'linear-gradient(140deg,#6a52d4,#0072a3)':'rgba(125,145,180,.35)'}`,knob:`position:absolute;top:3px;left:${on?'21px':'3px'};width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:left .2s`});

  window.ADMIN_APP_DATA = { MODULES, ACTS, lvl, P, preset, ROLE_TEMPLATES, ROLE_META, DEPTS, DEPT_INFO, DC_ITEMS, USERS, QUEUE, LEAVE, REPORTS_Q, LOG, SCREENS, MOD_META, MOD_ORDER, APP_ROLES, APP_FEATURES, FEAT_FLAT, FEAT_LABEL, ROLE_COLORS, KIND_META, featDefaults, PARENT_SEED, seedRoles, CLUSTERS_SEED, APPROVAL_RULES, CM_TYPES, MONTHS7, STATS_DEPTS, STAT_SERIES, DEPT_SERIES, DEPT_DEATHS, DEPT_ALOS, IND_CATALOG, CAPA_LIST, INCIDENTS, SUP_REPORTS, SUP_SECTIONS, STAFF_ROWS, COMPLIANCE, PRIV_GROUPS, SHARE_LINKS, FORM_FIELDS, SAVED_REPORTS, APPRAISALS, ROSTERS, SHIFT_CODES, MEDS_ADMIN, MED_REQUESTS, pillBtn, chip, ini, toggle };
})();
