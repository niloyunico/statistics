/* ===== dc-runtime.jsx ===== */
(function(){
(function () {
  'use strict';

  const React = window.React;
  const ReactDOM = window.ReactDOM;
  const {
    useState,
    useEffect
  } = React;
  const kebabToCamel = s => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  function cssToObj(css) {
    const o = {};
    for (const decl of String(css).split(';')) {
      const i = decl.indexOf(':');
      if (i < 0) continue;
      const prop = decl.slice(0, i).trim();
      if (!prop) continue;
      o[prop.startsWith('--') ? prop : kebabToCamel(prop)] = decl.slice(i + 1).trim();
    }
    return o;
  }
  const styleCache = new Map();
  function S(v) {
    if (v == null || v === '') return undefined;
    if (typeof v === 'object') return v;
    let o = styleCache.get(v);
    if (!o) {
      if (styleCache.size > 8000) styleCache.clear();
      o = cssToObj(v);
      styleCache.set(v, o);
    }
    return o;
  }
  function ix(v) {
    if (v === undefined || v === null || typeof v === 'boolean') return null;
    if (React.isValidElement(v) || Array.isArray(v)) return v;
    return String(v);
  }
  function vx(v, d) {
    return v === undefined || v === null ? d === undefined ? '' : d : v;
  }
  const PHONE_MQ = '(max-width: 560px), (max-height: 720px) and (max-width: 900px)';
  function usePhone() {
    const get = () => !!(window.matchMedia && window.matchMedia(PHONE_MQ).matches);
    const [phone, setPhone] = useState(get);
    useEffect(() => {
      if (!window.matchMedia) return undefined;
      const mq = window.matchMedia(PHONE_MQ);
      const on = () => setPhone(mq.matches);
      if (mq.addEventListener) mq.addEventListener('change', on);else mq.addListener(on);
      return () => {
        if (mq.removeEventListener) mq.removeEventListener('change', on);else mq.removeListener(on);
      };
    }, []);
    return phone;
  }
  function useClock() {
    const fmt = () => {
      const d = new Date();
      return d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0');
    };
    const [t, setT] = useState(fmt);
    useEffect(() => {
      const id = setInterval(() => setT(fmt()), 15000);
      return () => clearInterval(id);
    }, []);
    return t;
  }
  const FRAME = {
    surface: '#f4fbf8',
    onSurface: '#171d1b',
    border: 'rgba(116,119,117,0.5)'
  };
  function StatusBar() {
    const t = useClock();
    const c = FRAME.onSurface;
    return React.createElement("div", {
      style: {
        height: 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        position: 'relative',
        fontFamily: 'Roboto, system-ui, sans-serif',
        flexShrink: 0
      }
    }, React.createElement("div", {
      style: {
        width: 128,
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }
    }, React.createElement("span", {
      style: {
        fontSize: 14,
        fontWeight: 400,
        letterSpacing: 0.25,
        lineHeight: '20px',
        color: c
      }
    }, t)), React.createElement("div", {
      style: {
        position: 'absolute',
        left: '50%',
        top: 8,
        transform: 'translateX(-50%)',
        width: 24,
        height: 24,
        borderRadius: 100,
        background: '#2e2e2e'
      }
    }), React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center'
      }
    }, React.createElement("div", {
      style: {
        display: 'flex',
        paddingRight: 2
      }
    }, React.createElement("svg", {
      width: "16",
      height: "16",
      viewBox: "0 0 16 16",
      style: {
        marginRight: -2
      }
    }, React.createElement("path", {
      d: "M8 13.3L.67 5.97a10.37 10.37 0 0114.66 0L8 13.3z",
      fill: c
    })), React.createElement("svg", {
      width: "16",
      height: "16",
      viewBox: "0 0 16 16",
      style: {
        marginRight: -2
      }
    }, React.createElement("path", {
      d: "M14.67 14.67V1.33L1.33 14.67h13.34z",
      fill: c
    }))), React.createElement("svg", {
      width: "16",
      height: "16",
      viewBox: "0 0 16 16"
    }, React.createElement("rect", {
      x: "3.75",
      y: "2",
      width: "8.5",
      height: "13",
      rx: "1.5",
      fill: c
    }), React.createElement("rect", {
      x: "5.5",
      y: "0.9",
      width: "5",
      height: "2",
      rx: "0.5",
      fill: c
    }))));
  }
  function NavPill() {
    return React.createElement("div", {
      style: {
        height: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }
    }, React.createElement("div", {
      style: {
        width: 108,
        height: 4,
        borderRadius: 2,
        background: FRAME.onSurface,
        opacity: 0.4
      }
    }));
  }
  function AndroidDevice({
    children
  }) {
    const phone = usePhone();
    if (phone) {
      return React.createElement("div", {
        className: "dc-screen",
        style: {
          position: 'fixed',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          background: FRAME.surface,
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          boxSizing: 'border-box'
        }
      }, React.createElement("div", {
        style: {
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column'
        }
      }, children));
    }
    return React.createElement("div", {
      className: "dc-canvas",
      style: {
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        boxSizing: 'border-box'
      }
    }, React.createElement("div", {
      className: "dc-frame",
      style: {
        width: 412,
        height: 892,
        maxHeight: 'calc(100vh - 32px)',
        borderRadius: 18,
        overflow: 'hidden',
        background: FRAME.surface,
        border: '8px solid ' + FRAME.border,
        boxShadow: '0 30px 80px rgba(0,0,0,0.25)',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        flexShrink: 0
      }
    }, React.createElement(StatusBar, null), React.createElement("div", {
      style: {
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column'
      }
    }, children), React.createElement(NavPill, null)));
  }
  async function api(path, opts) {
    const o = Object.assign({
      method: 'GET'
    }, opts || {});
    const headers = Object.assign({
      accept: 'application/json'
    }, o.headers || {});
    if (o.body !== undefined && typeof o.body !== 'string') {
      o.body = JSON.stringify(o.body);
      headers['content-type'] = 'application/json';
    }
    const r = await fetch(path, Object.assign({}, o, {
      headers,
      credentials: 'same-origin'
    }));
    let j = null;
    try {
      j = await r.json();
    } catch (e) {
      j = null;
    }
    if (!r.ok) {
      const err = new Error(j && j.error || 'HTTP ' + r.status);
      err.status = r.status;
      err.body = j;
      throw err;
    }
    return j || {
      ok: true
    };
  }
  const tryApi = (path, opts) => api(path, opts).catch(() => null);
  function injectCSS(id, css) {
    if (!css || document.getElementById(id)) return;
    const el = document.createElement('style');
    el.id = id;
    el.textContent = css;
    document.head.appendChild(el);
  }
  function mount(App, css) {
    injectCSS('dc-view-css', css || '');
    const root = document.getElementById('root');
    const el = React.createElement(App);
    if (ReactDOM.createRoot) ReactDOM.createRoot(root).render(el);else ReactDOM.render(el, root);
  }
  window.DC = {
    S,
    ix,
    vx,
    cssToObj,
    AndroidDevice,
    usePhone,
    api,
    tryApi,
    injectCSS,
    mount
  };
})();
})();
;
/* ===== admin-app-data.js ===== */
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

;
/* ===== admin-app-view.jsx ===== */
(function(){
(function () {
  'use strict';

  const React = window.React;
  const {
    S,
    ix,
    vx,
    AndroidDevice
  } = window.DC;
  function Screen_sLogin(v) {
    return v.sLogin ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "flex": "1",
        "display": "flex",
        "flexDirection": "column",
        "padding": "34px 24px 28px",
        "gap": "22px",
        "animation": "pop .35s ease backwards"
      }
    }, React.createElement("div", {
      style: {
        "position": "absolute",
        "top": "-40px",
        "left": "-40px",
        "width": "220px",
        "height": "220px",
        "borderRadius": "50%",
        "background": "radial-gradient(circle,rgba(106,82,212,.35),transparent 70%)",
        "filter": "blur(20px)",
        "animation": "orbFloat 12s ease-in-out infinite alternate",
        "pointerEvents": "none"
      }
    }), React.createElement("div", {
      style: {
        "position": "relative",
        "display": "flex",
        "flexDirection": "column",
        "gap": "14px",
        "marginTop": "40px"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px"
      }
    }, React.createElement("img", {
      src: "assets/logo.svg",
      alt: "UNICO",
      style: {
        "height": "38px",
        "width": "auto"
      }
    }), React.createElement("span", {
      style: {
        "fontSize": "9px",
        "fontWeight": "800",
        "letterSpacing": ".8px",
        "padding": "3px 7px",
        "borderRadius": "5px",
        "color": "#fff",
        "background": "linear-gradient(135deg,#6a52d4,#0090ca)"
      }
    }, "ADMIN")), React.createElement("div", {
      style: {
        "fontSize": "26px",
        "fontWeight": "800",
        "letterSpacing": "-.5px",
        "lineHeight": "1.15"
      }
    }, "Administration", React.createElement("br", null), "console"), React.createElement("div", {
      style: {
        "fontSize": "13px",
        "color": "#6c7a8c"
      }
    }, "Sign in with an Administrator or Manager account. Every action here is recorded in the activity log.")), React.createElement("div", {
      style: {
        "position": "relative",
        "display": "flex",
        "flexDirection": "column",
        "gap": "12px",
        "background": "rgba(255,255,255,.72)",
        "border": "1px solid rgba(255,255,255,.95)",
        "borderRadius": "18px",
        "padding": "18px",
        "boxShadow": "0 14px 40px rgba(31,59,90,.14)"
      }
    }, React.createElement("label", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "5px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Username"), React.createElement("input", {
      value: vx(v.loginUser),
      onChange: v.setLoginUser,
      placeholder: "admin",
      style: {
        "border": "1px solid rgba(125,145,180,.35)",
        "borderRadius": "11px",
        "padding": "12px 13px",
        "fontSize": "15px",
        "background": "rgba(255,255,255,.85)",
        "outline": "none",
        "fontFamily": "'IBM Plex Mono',monospace"
      }
    })), React.createElement("label", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "5px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Password"), React.createElement("input", {
      type: "password",
      value: vx(v.loginPw),
      onChange: v.setLoginPw,
      placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
      style: {
        "border": "1px solid rgba(125,145,180,.35)",
        "borderRadius": "11px",
        "padding": "12px 13px",
        "fontSize": "15px",
        "background": "rgba(255,255,255,.85)",
        "outline": "none",
        "letterSpacing": "3px"
      }
    })), React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "8px",
        "fontSize": "11.5px",
        "color": "#3c4858"
      }
    }, React.createElement("svg", {
      width: "14",
      height: "14",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "#1d8f57",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("rect", {
      x: "3",
      y: "11",
      width: "18",
      height: "11",
      rx: "2"
    }), React.createElement("path", {
      d: "M7 11V7a5 5 0 0110 0v4"
    })), "Two-step verification on · code sent to your phone"), React.createElement("button", {
      onClick: v.doLogin,
      style: {
        "marginTop": "4px",
        "border": "0",
        "borderRadius": "12px",
        "padding": "14px",
        "background": "linear-gradient(140deg,#6a52d4,#0072a3)",
        "color": "#fff",
        "fontSize": "15px",
        "fontWeight": "700",
        "cursor": "pointer",
        "boxShadow": "0 10px 24px rgba(106,82,212,.35)"
      }
    }, "Sign in")), React.createElement("span", {
      style: {
        "flex": "1"
      }
    }), React.createElement("div", {
      style: {
        "textAlign": "center",
        "fontSize": "11.5px",
        "color": "#7d8ea8"
      }
    }, ix(v.loginFooter)))) : null;
  }
  function Screen_sHome(v) {
    return v.sHome ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "flex": "1",
        "minHeight": "0",
        "overflow": "auto",
        "padding": "14px 16px 20px",
        "display": "flex",
        "flexDirection": "column",
        "gap": "14px",
        "animation": "pop .3s ease backwards"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px"
      }
    }, React.createElement("button", {
      onClick: v.openDrawer,
      style: {
        "width": "40px",
        "height": "40px",
        "borderRadius": "12px",
        "border": "1px solid rgba(255,255,255,.9)",
        "background": "rgba(255,255,255,.6)",
        "display": "grid",
        "placeItems": "center",
        "color": "#3c4858",
        "cursor": "pointer",
        "flexShrink": "0"
      }
    }, React.createElement("svg", {
      width: "19",
      height: "19",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round"
    }, React.createElement("path", {
      d: "M4 7h16M4 12h16M4 17h10"
    }))), React.createElement("div", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "12px",
        "color": "#6c7a8c"
      }
    }, ix(v.hospitalName)), React.createElement("div", {
      style: {
        "fontSize": "16px",
        "fontWeight": "800",
        "letterSpacing": "-.2px"
      }
    }, "Good morning, ", ix(v.meFirst))), React.createElement("button", {
      onClick: v.goActivity,
      style: {
        "position": "relative",
        "width": "40px",
        "height": "40px",
        "borderRadius": "12px",
        "border": "1px solid rgba(255,255,255,.9)",
        "background": "rgba(255,255,255,.6)",
        "display": "grid",
        "placeItems": "center",
        "color": "#3c4858",
        "cursor": "pointer"
      }
    }, React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "1.9",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0"
    })), React.createElement("span", {
      style: {
        "position": "absolute",
        "top": "7px",
        "right": "8px",
        "width": "8px",
        "height": "8px",
        "borderRadius": "50%",
        "background": "#d23a52",
        "border": "2px solid #fff"
      }
    })), v.meHasPhoto ? React.createElement(React.Fragment, null, React.createElement("img", {
      src: v.mePhoto,
      alt: "",
      style: {
        "width": "40px",
        "height": "40px",
        "borderRadius": "12px",
        "objectFit": "cover",
        "display": "block",
        "flexShrink": "0"
      }
    })) : null, v.meNoPhoto ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: {
        "display": "grid",
        "placeItems": "center",
        "width": "40px",
        "height": "40px",
        "borderRadius": "12px",
        "color": "#fff",
        "fontSize": "13px",
        "fontWeight": "700",
        "background": "linear-gradient(135deg,#6a52d4,#0090ca)"
      }
    }, ix(v.meIni))) : null), React.createElement("div", {
      style: {
        "position": "relative",
        "overflow": "hidden",
        "flexShrink": "0",
        "borderRadius": "20px",
        "padding": "18px",
        "color": "#fff",
        "background": "linear-gradient(140deg,#1b1642,#3a2d8a 55%,#0a5f87)",
        "boxShadow": "0 16px 40px rgba(40,30,110,.32)"
      }
    }, React.createElement("div", {
      style: {
        "position": "absolute",
        "right": "-40px",
        "top": "-50px",
        "width": "190px",
        "height": "190px",
        "borderRadius": "50%",
        "background": "radial-gradient(circle,rgba(95,211,196,.5),transparent 70%)",
        "filter": "blur(12px)"
      }
    }), React.createElement("div", {
      style: {
        "position": "relative",
        "display": "flex",
        "alignItems": "center",
        "gap": "8px",
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".8px",
        "textTransform": "uppercase",
        "color": "rgba(255,255,255,.75)"
      }
    }, React.createElement("span", {
      style: {
        "width": "7px",
        "height": "7px",
        "borderRadius": "50%",
        "background": "#3ddc97",
        "animation": "livepulse 2.4s infinite"
      }
    }), ix(v.systemStatus)), React.createElement("div", {
      style: {
        "position": "relative",
        "display": "grid",
        "gridTemplateColumns": "repeat(3,1fr)",
        "gap": "8px",
        "marginTop": "12px"
      }
    }, (Array.isArray(v.heroStats) ? v.heroStats : []).map((h, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: h?.go,
      style: {
        "textAlign": "left",
        "border": "1px solid rgba(255,255,255,.2)",
        "borderRadius": "12px",
        "padding": "10px",
        "background": "rgba(255,255,255,.12)",
        "color": "#fff",
        "cursor": "pointer"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "24px",
        "fontWeight": "600",
        "lineHeight": "1"
      }
    }, ix(h?.v)), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "10.5px",
        "color": "rgba(255,255,255,.8)",
        "marginTop": "4px",
        "lineHeight": "1.3"
      }
    }, ix(h?.label))))))), React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "8px"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".7px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Needs your action"), (Array.isArray(v.actionItems) ? v.actionItems : []).map((a, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: a?.go,
      style: S(`display:flex;align-items:center;gap:12px;text-align:left;border:1px solid ${a?.border ?? ""};border-radius:15px;padding:12px 13px;background:rgba(255,255,255,.66);cursor:pointer;color:#16202e`)
    }, React.createElement("span", {
      style: S(`display:grid;place-items:center;width:40px;height:40px;border-radius:12px;color:${a?.color ?? ""};background:${a?.bg ?? ""};flex-shrink:0`)
    }, React.createElement("svg", {
      width: "19",
      height: "19",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: a?.d
    }))), React.createElement("span", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "13.5px",
        "fontWeight": "800"
      }
    }, ix(a?.title)), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "11.5px",
        "color": "#6c7a8c"
      }
    }, ix(a?.sub))), React.createElement("span", {
      style: S(`font-family:'IBM Plex Mono',monospace;font-size:18px;font-weight:600;color:${a?.color ?? ""}`)
    }, ix(a?.n)))))), React.createElement("div", {
      style: {
        "display": "grid",
        "gridTemplateColumns": "repeat(4,1fr)",
        "gap": "8px"
      }
    }, (Array.isArray(v.quickActions) ? v.quickActions : []).map((q, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: q?.go,
      style: {
        "display": "flex",
        "flexDirection": "column",
        "alignItems": "center",
        "gap": "7px",
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "14px",
        "padding": "12px 4px 10px",
        "background": "rgba(255,255,255,.62)",
        "cursor": "pointer",
        "color": "#16202e"
      },
      className: "dcp0"
    }, React.createElement("span", {
      style: S(`display:grid;place-items:center;width:38px;height:38px;border-radius:12px;color:${q?.color ?? ""};background:${q?.bg ?? ""}`)
    }, React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: q?.d
    }))), React.createElement("span", {
      style: {
        "fontSize": "11px",
        "fontWeight": "700",
        "textAlign": "center",
        "lineHeight": "1.2"
      }
    }, ix(q?.label)))))), React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "16px",
        "padding": "14px",
        "background": "rgba(255,255,255,.68)",
        "display": "flex",
        "flexDirection": "column",
        "gap": "10px"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "justifyContent": "space-between"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Aug data collection · hospital-wide"), React.createElement("button", {
      onClick: v.goApprovals,
      style: {
        "border": "0",
        "background": "none",
        "color": "#0072a3",
        "fontSize": "12px",
        "fontWeight": "700",
        "cursor": "pointer",
        "padding": "0"
      }
    }, "Review")), React.createElement("div", {
      style: {
        "display": "flex",
        "height": "10px",
        "borderRadius": "999px",
        "overflow": "hidden",
        "background": "rgba(125,145,180,.18)"
      }
    }, React.createElement("span", {
      style: S(v.covApproved)
    }), React.createElement("span", {
      style: S(v.covPending)
    }), React.createElement("span", {
      style: S(v.covRejected)
    })), React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "12px",
        "flexWrap": "wrap",
        "fontSize": "11px",
        "color": "#3c4858"
      }
    }, React.createElement("span", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "5px"
      }
    }, React.createElement("span", {
      style: {
        "width": "8px",
        "height": "8px",
        "borderRadius": "2px",
        "background": "#1d8f57"
      }
    }), ix(v.covN?.approved), " approved"), React.createElement("span", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "5px"
      }
    }, React.createElement("span", {
      style: {
        "width": "8px",
        "height": "8px",
        "borderRadius": "2px",
        "background": "#0090ca"
      }
    }), ix(v.covN?.pending), " pending"), React.createElement("span", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "5px"
      }
    }, React.createElement("span", {
      style: {
        "width": "8px",
        "height": "8px",
        "borderRadius": "2px",
        "background": "#d23a52"
      }
    }), ix(v.covN?.rejected), " returned"), React.createElement("span", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "5px"
      }
    }, React.createElement("span", {
      style: {
        "width": "8px",
        "height": "8px",
        "borderRadius": "2px",
        "background": "rgba(125,145,180,.4)"
      }
    }), ix(v.covN?.missing), " not submitted"))), React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "8px"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "justifyContent": "space-between"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".7px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Recent activity"), React.createElement("button", {
      onClick: v.goActivity,
      style: {
        "border": "0",
        "background": "none",
        "color": "#0072a3",
        "fontSize": "12px",
        "fontWeight": "700",
        "cursor": "pointer",
        "padding": "0"
      }
    }, "Full log")), (Array.isArray(v.homeActivity) ? v.homeActivity : []).map((l, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px",
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "13px",
        "padding": "9px 12px",
        "background": "rgba(255,255,255,.62)"
      }
    }, React.createElement("span", {
      style: S(l?.dot)
    }), React.createElement("span", {
      style: {
        "flex": "1",
        "minWidth": "0",
        "fontSize": "12.5px",
        "whiteSpace": "nowrap",
        "overflow": "hidden",
        "textOverflow": "ellipsis"
      }
    }, React.createElement("b", null, ix(l?.who)), " ", ix(l?.text)), React.createElement("span", {
      style: {
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "10.5px",
        "color": "#9aa6b4",
        "whiteSpace": "nowrap"
      }
    }, ix(l?.when)))))))) : null;
  }
  function Screen_sUsers(v) {
    return v.sUsers ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "flex": "1",
        "minHeight": "0",
        "overflow": "auto",
        "padding": "14px 16px 20px",
        "display": "flex",
        "flexDirection": "column",
        "gap": "12px",
        "animation": "pop .3s ease backwards"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px"
      }
    }, React.createElement("button", {
      onClick: v.openDrawer,
      style: {
        "width": "38px",
        "height": "38px",
        "borderRadius": "11px",
        "border": "1px solid rgba(255,255,255,.9)",
        "background": "rgba(255,255,255,.6)",
        "display": "grid",
        "placeItems": "center",
        "color": "#3c4858",
        "cursor": "pointer",
        "flexShrink": "0"
      }
    }, React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round"
    }, React.createElement("path", {
      d: "M4 7h16M4 12h16M4 17h10"
    }))), React.createElement("div", {
      style: {
        "flex": "1"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "19px",
        "fontWeight": "800",
        "letterSpacing": "-.3px"
      }
    }, "Users & access"), React.createElement("div", {
      style: {
        "fontSize": "12px",
        "color": "#6c7a8c"
      }
    }, ix(v.userCount), " accounts · ", ix(v.adminCount), " administrators")), React.createElement("button", {
      onClick: v.goNewUser,
      style: {
        "display": "inline-flex",
        "alignItems": "center",
        "gap": "6px",
        "border": "0",
        "borderRadius": "11px",
        "padding": "10px 12px",
        "background": "linear-gradient(140deg,#6a52d4,#0072a3)",
        "color": "#fff",
        "fontSize": "12.5px",
        "fontWeight": "700",
        "cursor": "pointer",
        "boxShadow": "0 8px 20px rgba(106,82,212,.3)"
      }
    }, React.createElement("svg", {
      width: "14",
      height: "14",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.4",
      strokeLinecap: "round"
    }, React.createElement("path", {
      d: "M12 5v14M5 12h14"
    })), "Add")), React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "9px",
        "border": "1px solid rgba(255,255,255,.95)",
        "borderRadius": "13px",
        "padding": "10px 13px",
        "background": "rgba(255,255,255,.8)",
        "flexShrink": "0"
      }
    }, React.createElement("svg", {
      width: "16",
      height: "16",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "#6c7a8c",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("circle", {
      cx: "11",
      cy: "11",
      r: "7"
    }), React.createElement("path", {
      d: "M21 21l-4.3-4.3"
    })), React.createElement("input", {
      value: vx(v.userQ),
      onChange: v.setUserQ,
      placeholder: "Name, username, department",
      style: {
        "flex": "1",
        "border": "0",
        "background": "transparent",
        "fontSize": "13.5px",
        "outline": "none",
        "minWidth": "0"
      }
    })), React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "6px",
        "overflowX": "auto",
        "paddingBottom": "2px",
        "scrollbarWidth": "none",
        "flexShrink": "0"
      }
    }, (Array.isArray(v.roleFilters) ? v.roleFilters : []).map((f, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: f?.go,
      style: S(f?.style)
    }, ix(f?.label), " ", React.createElement("b", {
      style: {
        "fontFamily": "'IBM Plex Mono',monospace"
      }
    }, ix(f?.n)))))), React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "8px"
      }
    }, (Array.isArray(v.userList) ? v.userList : []).map((u, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: u?.go,
      style: S(u?.cardStyle)
    }, React.createElement("span", {
      style: {
        "position": "relative",
        "flexShrink": "0"
      }
    }, React.createElement("span", {
      style: S(u?.avStyle)
    }, ix(u?.ini)), u?.online ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: {
        "position": "absolute",
        "right": "-2px",
        "bottom": "-2px",
        "width": "11px",
        "height": "11px",
        "borderRadius": "50%",
        "background": "#2bb673",
        "border": "2px solid #fff"
      }
    })) : null), React.createElement("span", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("span", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "6px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "13.5px",
        "fontWeight": "700",
        "whiteSpace": "nowrap",
        "overflow": "hidden",
        "textOverflow": "ellipsis"
      }
    }, ix(u?.name)), u?.inactive ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: {
        "fontSize": "9px",
        "fontWeight": "800",
        "letterSpacing": ".5px",
        "padding": "2px 5px",
        "borderRadius": "5px",
        "color": "#7d8ea8",
        "background": "rgba(125,145,180,.18)"
      }
    }, "INACTIVE")) : null), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "11.5px",
        "color": "#6c7a8c",
        "whiteSpace": "nowrap",
        "overflow": "hidden",
        "textOverflow": "ellipsis"
      }
    }, React.createElement("span", {
      style: {
        "fontFamily": "'IBM Plex Mono',monospace"
      }
    }, "@", ix(u?.username)), " · ", ix(u?.scopeLabel)), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "10.5px",
        "color": "#9aa6b4",
        "marginTop": "2px"
      }
    }, ix(u?.lastLogin))), React.createElement("span", {
      style: S(u?.roleStyle)
    }, ix(u?.roleLabel)))))))) : null;
  }
  function Screen_sUserDetail(v) {
    return v.sUserDetail ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "flex": "1",
        "minHeight": "0",
        "display": "flex",
        "flexDirection": "column",
        "animation": "pop .3s ease backwards"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px",
        "padding": "12px 16px 0",
        "flexShrink": "0"
      }
    }, React.createElement("button", {
      onClick: v.goUsers,
      style: {
        "width": "38px",
        "height": "38px",
        "borderRadius": "11px",
        "border": "1px solid rgba(255,255,255,.9)",
        "background": "rgba(255,255,255,.6)",
        "display": "grid",
        "placeItems": "center",
        "color": "#3c4858",
        "cursor": "pointer"
      }
    }, React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M15 6l-6 6 6 6"
    }))), React.createElement("div", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "16px",
        "fontWeight": "800",
        "letterSpacing": "-.2px"
      }
    }, ix(v.udTitle)), React.createElement("div", {
      style: {
        "fontSize": "12px",
        "color": "#6c7a8c"
      }
    }, ix(v.udSub))), v.udDirty ? React.createElement(React.Fragment, null, React.createElement("button", {
      onClick: v.udSave,
      style: {
        "border": "0",
        "borderRadius": "11px",
        "padding": "10px 14px",
        "background": "linear-gradient(140deg,#2bb673,#1d8f57)",
        "color": "#fff",
        "fontSize": "12.5px",
        "fontWeight": "700",
        "cursor": "pointer",
        "boxShadow": "0 8px 20px rgba(43,182,115,.3)"
      }
    }, "Save")) : null), v.udToast ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "margin": "10px 16px 0",
        "display": "flex",
        "alignItems": "center",
        "gap": "8px",
        "borderRadius": "12px",
        "padding": "10px 12px",
        "background": "rgba(43,182,115,.13)",
        "color": "#1d8f57",
        "fontSize": "12.5px",
        "fontWeight": "700",
        "flexShrink": "0",
        "animation": "pop .25s ease"
      }
    }, React.createElement("svg", {
      width: "15",
      height: "15",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.4",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M20 6L9 17l-5-5"
    })), ix(v.udToast))) : null, React.createElement("div", {
      style: {
        "display": "grid",
        "gridTemplateColumns": "repeat(3,1fr)",
        "margin": "10px 16px 0",
        "background": "rgba(255,255,255,.55)",
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "11px",
        "padding": "3px",
        "gap": "2px",
        "flexShrink": "0"
      }
    }, (Array.isArray(v.udTabs) ? v.udTabs : []).map((t, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: t?.go,
      style: S(t?.style)
    }, ix(t?.label))))), React.createElement("div", {
      style: {
        "flex": "1",
        "minHeight": "0",
        "overflow": "auto",
        "padding": "12px 16px 20px",
        "display": "flex",
        "flexDirection": "column",
        "gap": "12px"
      }
    }, v.udTabProfile ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.92)",
        "borderRadius": "18px",
        "padding": "14px",
        "background": "rgba(255,255,255,.72)",
        "display": "flex",
        "flexDirection": "column",
        "gap": "10px"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "12px"
      }
    }, React.createElement("span", {
      style: S(v.ud?.avStyle)
    }, ix(v.ud?.ini)), React.createElement("div", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "15px",
        "fontWeight": "800"
      }
    }, ix(v.ud?.nameOrNew)), React.createElement("div", {
      style: {
        "fontSize": "11.5px",
        "color": "#6c7a8c"
      }
    }, ix(v.ud?.metaLine))), React.createElement("button", {
      onClick: v.udToggleActive,
      style: S(v.udActiveTrack)
    }, React.createElement("span", {
      style: S(v.udActiveKnob)
    }))), React.createElement("label", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "4px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Full name"), React.createElement("input", {
      value: vx(v.ud?.name),
      onChange: v.udSetName,
      placeholder: "Display name",
      style: {
        "border": "1px solid rgba(125,145,180,.3)",
        "borderRadius": "10px",
        "padding": "10px 12px",
        "fontSize": "13.5px",
        "background": "rgba(255,255,255,.85)",
        "outline": "none"
      }
    })), React.createElement("div", {
      style: {
        "display": "grid",
        "gridTemplateColumns": "1fr 1fr",
        "gap": "8px"
      }
    }, React.createElement("label", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "4px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Username"), React.createElement("input", {
      value: vx(v.ud?.username),
      onChange: v.udSetUsername,
      readOnly: v.udEditing,
      placeholder: "e.g. j.smith",
      style: S(v.udUsernameStyle)
    })), React.createElement("label", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "4px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Linked staff ID"), React.createElement("input", {
      value: vx(v.ud?.emp),
      onChange: v.udSetEmp,
      placeholder: "UN-0000",
      style: {
        "border": "1px solid rgba(125,145,180,.3)",
        "borderRadius": "10px",
        "padding": "10px 12px",
        "fontSize": "13.5px",
        "background": "rgba(255,255,255,.85)",
        "outline": "none",
        "fontFamily": "'IBM Plex Mono',monospace"
      }
    }))), React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px",
        "borderRadius": "12px",
        "padding": "9px 12px",
        "background": "rgba(0,144,202,.07)"
      }
    }, React.createElement("svg", {
      width: "15",
      height: "15",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "#0072a3",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      style: {
        "flexShrink": "0"
      }
    }, React.createElement("path", {
      d: "M12 3v6M6 15v-3a3 3 0 013-3h6a3 3 0 013 3v3M6 15a3 3 0 100 6 3 3 0 000-6zM18 15a3 3 0 100 6 3 3 0 000-6z"
    })), React.createElement("span", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "10px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Reports to"), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "12.5px",
        "fontWeight": "700",
        "whiteSpace": "nowrap",
        "overflow": "hidden",
        "textOverflow": "ellipsis"
      }
    }, ix(v.udReportsTo))), React.createElement("button", {
      onClick: v.goOrg,
      style: {
        "border": "0",
        "background": "none",
        "color": "#0072a3",
        "fontSize": "11.5px",
        "fontWeight": "700",
        "cursor": "pointer",
        "padding": "0",
        "whiteSpace": "nowrap"
      }
    }, "Hierarchy")), v.udNew ? React.createElement(React.Fragment, null, React.createElement("label", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "4px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Temporary password"), React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "6px"
      }
    }, React.createElement("input", {
      value: vx(v.ud?.pw),
      onChange: v.udSetPw,
      placeholder: "min. 6 characters",
      style: {
        "flex": "1",
        "border": "1px solid rgba(125,145,180,.3)",
        "borderRadius": "10px",
        "padding": "10px 12px",
        "fontSize": "13.5px",
        "background": "rgba(255,255,255,.85)",
        "outline": "none",
        "fontFamily": "'IBM Plex Mono',monospace"
      }
    }), React.createElement("button", {
      onClick: v.udGenPw,
      style: {
        "border": "1px solid rgba(0,144,202,.3)",
        "borderRadius": "10px",
        "padding": "0 12px",
        "background": "rgba(0,144,202,.08)",
        "color": "#0072a3",
        "fontSize": "12px",
        "fontWeight": "700",
        "cursor": "pointer",
        "whiteSpace": "nowrap"
      }
    }, "Generate")), React.createElement("span", {
      style: {
        "fontSize": "11px",
        "color": "#6c7a8c"
      }
    }, "User must change it at first sign-in."))) : null), React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "6px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Role"), React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "5px"
      }
    }, (Array.isArray(v.roleOpts) ? v.roleOpts : []).map((r, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: r?.go,
      style: S(r?.style)
    }, React.createElement("span", {
      style: S(r?.radio)
    }), React.createElement("span", {
      style: {
        "flex": "1",
        "textAlign": "left"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "13px",
        "fontWeight": "700"
      }
    }, ix(r?.label)), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "11px",
        "color": "#6c7a8c",
        "lineHeight": "1.35"
      }
    }, ix(r?.desc))), React.createElement("span", {
      style: S(r?.tag)
    }, ix(r?.tagLabel))))))), v.udHasDepts ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "6px"
      }
    }, React.createElement("span", {
      style: {
        "display": "flex",
        "justifyContent": "space-between",
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, React.createElement("span", null, "Departments"), React.createElement("span", {
      style: {
        "fontWeight": "600",
        "letterSpacing": "0",
        "textTransform": "none",
        "color": "#6c7a8c"
      }
    }, ix(v.udDeptCount))), React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "6px",
        "flexWrap": "wrap"
      }
    }, (Array.isArray(v.udDeptChips) ? v.udDeptChips : []).map((d, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: d?.go,
      style: S(d?.style)
    }, ix(d?.label))))))) : null, v.udHasScope ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "6px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Staff records visible"), React.createElement("div", {
      style: {
        "display": "inline-flex",
        "background": "rgba(255,255,255,.55)",
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "11px",
        "padding": "3px",
        "gap": "3px",
        "alignSelf": "flex-start"
      }
    }, (Array.isArray(v.scopeOpts) ? v.scopeOpts : []).map((o, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: o?.go,
      style: S(o?.style)
    }, ix(o?.label))))), React.createElement("span", {
      style: {
        "fontSize": "11px",
        "color": "#6c7a8c",
        "lineHeight": "1.4"
      }
    }, ix(v.scopeHint)))) : null) : null, v.udTabAccess ? React.createElement(React.Fragment, null, v.udIsAdmin ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "flex-start",
        "gap": "10px",
        "borderRadius": "14px",
        "padding": "12px 13px",
        "background": "linear-gradient(140deg,rgba(106,82,212,.14),rgba(255,255,255,.7))",
        "border": "1px solid rgba(106,82,212,.3)"
      }
    }, React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "#6a52d4",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      style: {
        "flexShrink": "0",
        "marginTop": "2px"
      }
    }, React.createElement("path", {
      d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
    })), React.createElement("span", {
      style: {
        "fontSize": "12.5px",
        "lineHeight": "1.5"
      }
    }, React.createElement("b", null, "Administrator — unrestricted."), " Every module, every department, every action, including this console. Keep at least two active administrators."))) : null, v.udIsPortal ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "flex-start",
        "gap": "10px",
        "borderRadius": "14px",
        "padding": "12px 13px",
        "background": "rgba(0,144,202,.08)",
        "border": "1px solid rgba(0,144,202,.25)"
      }
    }, React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "#0072a3",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      style: {
        "flexShrink": "0",
        "marginTop": "2px"
      }
    }, React.createElement("path", {
      d: "M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
    })), React.createElement("span", {
      style: {
        "fontSize": "12.5px",
        "lineHeight": "1.5"
      }
    }, React.createElement("b", null, "Portal role — uses the Nurse App"), ", not this console. Access is scoped by the departments on the Profile tab. Below you can override individual app features for this person.")), React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "16px",
        "background": "rgba(255,255,255,.68)",
        "overflow": "hidden",
        "flexShrink": "0"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "justifyContent": "space-between",
        "padding": "10px 14px 4px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#7d8ea8",
        "whiteSpace": "nowrap"
      }
    }, "Nurse App features"), React.createElement("button", {
      onClick: v.goAppAccess,
      style: {
        "border": "0",
        "background": "none",
        "color": "#0072a3",
        "fontSize": "11.5px",
        "fontWeight": "700",
        "cursor": "pointer",
        "padding": "0",
        "whiteSpace": "nowrap"
      }
    }, "Role defaults")), (Array.isArray(v.udFeatRows) ? v.udFeatRows : []).map((f, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px",
        "padding": "9px 14px",
        "borderTop": "1px solid rgba(125,145,180,.12)"
      }
    }, React.createElement("span", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "12.5px",
        "fontWeight": "600"
      }
    }, ix(f?.label)), React.createElement("span", {
      style: S(`display:block;font-size:10.5px;color:${f?.stateColor ?? ""}`)
    }, ix(f?.stateLabel))), React.createElement("div", {
      style: {
        "display": "inline-flex",
        "background": "rgba(125,145,180,.12)",
        "borderRadius": "9px",
        "padding": "2px",
        "gap": "2px"
      }
    }, (Array.isArray(f?.opts) ? f?.opts : []).map((o, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: o?.go,
      style: S(o?.style)
    }, ix(o?.label)))))))))) : null, v.udIsUser ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "6px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Start from a template"), React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "6px",
        "overflowX": "auto",
        "paddingBottom": "2px",
        "scrollbarWidth": "none",
        "flexShrink": "0"
      }
    }, (Array.isArray(v.tmplChips) ? v.tmplChips : []).map((t, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: t?.go,
      style: S(t?.style)
    }, ix(t?.label)))))), React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "16px",
        "background": "rgba(255,255,255,.68)",
        "overflow": "hidden",
        "flexShrink": "0"
      }
    }, React.createElement("div", {
      style: {
        "display": "grid",
        "gridTemplateColumns": "1fr repeat(4,34px)",
        "gap": "4px",
        "alignItems": "center",
        "padding": "10px 12px 6px",
        "fontSize": "9.5px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, React.createElement("span", null, "Module"), React.createElement("span", {
      style: {
        "textAlign": "center"
      }
    }, "View"), React.createElement("span", {
      style: {
        "textAlign": "center"
      }
    }, "Edit"), React.createElement("span", {
      style: {
        "textAlign": "center"
      }
    }, "Add"), React.createElement("span", {
      style: {
        "textAlign": "center"
      }
    }, "Del")), (Array.isArray(v.permRows) ? v.permRows : []).map((m, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "display": "grid",
        "gridTemplateColumns": "1fr repeat(4,34px)",
        "gap": "4px",
        "alignItems": "center",
        "padding": "8px 12px",
        "borderTop": "1px solid rgba(125,145,180,.12)"
      }
    }, React.createElement("span", {
      style: {
        "minWidth": "0"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "12.5px",
        "fontWeight": "700",
        "whiteSpace": "nowrap",
        "overflow": "hidden",
        "textOverflow": "ellipsis"
      }
    }, ix(m?.label)), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "10px",
        "color": "#7d8ea8"
      }
    }, ix(m?.summary))), (Array.isArray(m?.cells) ? m?.cells : []).map((c, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: c?.go,
      style: S(c?.style)
    }, c?.on ? React.createElement(React.Fragment, null, React.createElement("svg", {
      width: "13",
      height: "13",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "#fff",
      strokeWidth: "3",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M20 6L9 17l-5-5"
    }))) : null))))))), React.createElement("div", {
      style: {
        "fontSize": "11px",
        "color": "#6c7a8c",
        "lineHeight": "1.45",
        "padding": "0 4px"
      }
    }, "Actions are independent — Delete without Add is allowed. Permissions are enforced on the server for every request, not just hidden in menus.")) : null, React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "8px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "What this user will see"), React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "6px",
        "flexWrap": "wrap"
      }
    }, (Array.isArray(v.previewMods) ? v.previewMods : []).map((p, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("span", {
      style: S(p?.style)
    }, ix(p?.label))))))) : null, v.udTabSecurity ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "16px",
        "background": "rgba(255,255,255,.68)",
        "overflow": "hidden",
        "flexShrink": "0"
      }
    }, (Array.isArray(v.secFacts) ? v.secFacts : []).map((f, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px",
        "padding": "11px 14px",
        "borderTop": "1px solid rgba(125,145,180,.12)"
      }
    }, React.createElement("span", {
      style: {
        "flex": "1",
        "fontSize": "12px",
        "color": "#6c7a8c",
        "fontWeight": "600"
      }
    }, ix(f?.label)), React.createElement("span", {
      style: {
        "fontSize": "12.5px",
        "fontWeight": "700",
        "textAlign": "right",
        "fontFamily": "'IBM Plex Mono',monospace"
      }
    }, ix(f?.v)))))), React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "6px"
      }
    }, (Array.isArray(v.secActions) ? v.secActions : []).map((a, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: a?.go,
      style: S(a?.style)
    }, React.createElement("span", {
      style: S(`display:grid;place-items:center;width:36px;height:36px;border-radius:10px;color:${a?.color ?? ""};background:${a?.bg ?? ""};flex-shrink:0`)
    }, React.createElement("svg", {
      width: "17",
      height: "17",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: a?.d
    }))), React.createElement("span", {
      style: {
        "flex": "1",
        "textAlign": "left"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "13px",
        "fontWeight": "700"
      }
    }, ix(a?.label)), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "11px",
        "color": "#6c7a8c",
        "lineHeight": "1.35"
      }
    }, ix(a?.sub))), React.createElement("svg", {
      width: "16",
      height: "16",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "#9aa6b4",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M9 6l6 6-6 6"
    })))))), React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "6px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "This account's activity"), (Array.isArray(v.udActivity) ? v.udActivity : []).map((l, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px",
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "13px",
        "padding": "9px 12px",
        "background": "rgba(255,255,255,.62)"
      }
    }, React.createElement("span", {
      style: S(l?.dot)
    }), React.createElement("span", {
      style: {
        "flex": "1",
        "minWidth": "0",
        "fontSize": "12px",
        "whiteSpace": "nowrap",
        "overflow": "hidden",
        "textOverflow": "ellipsis"
      }
    }, ix(l?.text)), React.createElement("span", {
      style: {
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "10.5px",
        "color": "#9aa6b4",
        "whiteSpace": "nowrap"
      }
    }, ix(l?.when))))))) : null), v.confirm ? React.createElement(React.Fragment, null, React.createElement("div", {
      onClick: v.closeConfirm,
      style: {
        "position": "absolute",
        "inset": "0",
        "zIndex": "20",
        "background": "rgba(13,28,50,.45)",
        "animation": "fadeIn .2s ease"
      }
    }), React.createElement("div", {
      style: {
        "position": "absolute",
        "left": "0",
        "right": "0",
        "bottom": "0",
        "zIndex": "21",
        "background": "rgba(255,255,255,.97)",
        "borderRadius": "22px 22px 0 0",
        "padding": "14px 18px 22px",
        "boxShadow": "0 -18px 50px rgba(31,59,90,.25)",
        "display": "flex",
        "flexDirection": "column",
        "gap": "12px",
        "animation": "pop .28s cubic-bezier(.2,.7,.3,1)"
      }
    }, React.createElement("div", {
      style: {
        "width": "40px",
        "height": "4px",
        "borderRadius": "2px",
        "background": "rgba(125,145,180,.4)",
        "alignSelf": "center"
      }
    }), React.createElement("div", {
      style: {
        "fontSize": "16px",
        "fontWeight": "800"
      }
    }, ix(v.confirm?.title)), React.createElement("div", {
      style: {
        "fontSize": "13px",
        "color": "#3c4858",
        "lineHeight": "1.5",
        "textWrap": "pretty"
      }
    }, ix(v.confirm?.body)), v.confirm?.needsReason ? React.createElement(React.Fragment, null, React.createElement("textarea", {
      value: vx(v.confirmReason),
      onChange: v.setConfirmReason,
      rows: "2",
      placeholder: "Reason (recorded in the activity log)",
      style: {
        "border": "1px solid rgba(125,145,180,.35)",
        "borderRadius": "11px",
        "padding": "10px 12px",
        "fontSize": "13.5px",
        "background": "#fff",
        "outline": "none",
        "resize": "none"
      }
    })) : null, React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "6px"
      }
    }, React.createElement("button", {
      onClick: v.closeConfirm,
      style: {
        "flex": "1",
        "border": "1px solid rgba(125,145,180,.35)",
        "borderRadius": "12px",
        "padding": "12px",
        "background": "rgba(255,255,255,.7)",
        "color": "#16202e",
        "fontSize": "13px",
        "fontWeight": "700",
        "cursor": "pointer"
      }
    }, "Cancel"), React.createElement("button", {
      onClick: v.confirm?.go,
      style: S(v.confirm?.btnStyle)
    }, ix(v.confirm?.cta))))) : null)) : null;
  }
  function Screen_sRoles(v) {
    return v.sRoles ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "flex": "1",
        "minHeight": "0",
        "overflow": "auto",
        "padding": "14px 16px 20px",
        "display": "flex",
        "flexDirection": "column",
        "gap": "12px",
        "animation": "pop .3s ease backwards"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px"
      }
    }, React.createElement("button", {
      onClick: v.openDrawer,
      style: {
        "width": "38px",
        "height": "38px",
        "borderRadius": "11px",
        "border": "1px solid rgba(255,255,255,.9)",
        "background": "rgba(255,255,255,.6)",
        "display": "grid",
        "placeItems": "center",
        "color": "#3c4858",
        "cursor": "pointer",
        "flexShrink": "0"
      }
    }, React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round"
    }, React.createElement("path", {
      d: "M4 7h16M4 12h16M4 17h10"
    }))), React.createElement("div", {
      style: {
        "flex": "1"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "19px",
        "fontWeight": "800",
        "letterSpacing": "-.3px"
      }
    }, "Roles"), React.createElement("div", {
      style: {
        "fontSize": "12px",
        "color": "#6c7a8c"
      }
    }, ix(v.roleCount), " roles · create your own, everything follows")), React.createElement("button", {
      onClick: v.newRole,
      style: {
        "display": "inline-flex",
        "alignItems": "center",
        "gap": "6px",
        "border": "0",
        "borderRadius": "11px",
        "padding": "10px 12px",
        "background": "linear-gradient(140deg,#6a52d4,#0072a3)",
        "color": "#fff",
        "fontSize": "12.5px",
        "fontWeight": "700",
        "cursor": "pointer",
        "boxShadow": "0 8px 20px rgba(106,82,212,.3)"
      }
    }, React.createElement("svg", {
      width: "14",
      height: "14",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.4",
      strokeLinecap: "round"
    }, React.createElement("path", {
      d: "M12 5v14M5 12h14"
    })), "New role")), React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "6px",
        "overflowX": "auto",
        "paddingBottom": "2px",
        "scrollbarWidth": "none",
        "flexShrink": "0"
      }
    }, (Array.isArray(v.roleKindChips) ? v.roleKindChips : []).map((k, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: k?.go,
      style: S(k?.style)
    }, ix(k?.label), " ", React.createElement("b", {
      style: {
        "fontFamily": "'IBM Plex Mono',monospace"
      }
    }, ix(k?.n)))))), React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "flex-start",
        "gap": "10px",
        "borderRadius": "14px",
        "padding": "11px 13px",
        "background": "rgba(0,144,202,.08)",
        "border": "1px solid rgba(0,144,202,.2)",
        "fontSize": "12px",
        "lineHeight": "1.5",
        "color": "#16202e"
      }
    }, React.createElement("svg", {
      width: "15",
      height: "15",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "#0072a3",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      style: {
        "flexShrink": "0",
        "marginTop": "2px"
      }
    }, React.createElement("circle", {
      cx: "12",
      cy: "12",
      r: "9"
    }), React.createElement("path", {
      d: "M12 16v-4M12 8h.01"
    })), React.createElement("span", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, "Roles are data, not code. A new role appears instantly in the user role picker, the Nurse App access matrix, custom-module audiences and broadcast targets. ", React.createElement("b", null, "Console"), " roles get module permissions; ", React.createElement("b", null, "Nurse App"), " roles get phone features.")), React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "8px"
      }
    }, (Array.isArray(v.roleList) ? v.roleList : []).map((r, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "15px",
        "padding": "12px 13px",
        "background": "rgba(255,255,255,.68)",
        "display": "flex",
        "flexDirection": "column",
        "gap": "9px"
      }
    }, React.createElement("div", {
      onClick: r?.edit,
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px",
        "cursor": "pointer"
      }
    }, React.createElement("span", {
      style: S(r?.avStyle)
    }, React.createElement("svg", {
      width: "17",
      height: "17",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: r?.d
    }))), React.createElement("span", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("span", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "6px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "13.5px",
        "fontWeight": "800"
      }
    }, ix(r?.label)), React.createElement("span", {
      style: S(r?.kindStyle)
    }, ix(r?.kindLabel)), r?.system ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: {
        "fontSize": "9px",
        "fontWeight": "800",
        "letterSpacing": ".5px",
        "padding": "2px 6px",
        "borderRadius": "5px",
        "color": "#7d8ea8",
        "background": "rgba(125,145,180,.16)"
      }
    }, "SYSTEM")) : null), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "11px",
        "color": "#6c7a8c",
        "marginTop": "1px"
      }
    }, ix(r?.members), " members · ", ix(r?.desc))), React.createElement("svg", {
      width: "16",
      height: "16",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "#9aa6b4",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M9 6l6 6-6 6"
    }))), r?.hasBars ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "3px"
      }
    }, (Array.isArray(r?.bars) ? r?.bars : []).map((b, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("span", {
      title: b?.t,
      style: S(b?.style)
    }))))) : null, r?.featLine ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "fontSize": "11px",
        "color": "#3c4858",
        "lineHeight": "1.4"
      }
    }, ix(r?.featLine))) : null, React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "6px"
      }
    }, React.createElement("button", {
      onClick: r?.use,
      style: {
        "flex": "1",
        "border": "1px solid rgba(0,144,202,.3)",
        "borderRadius": "10px",
        "padding": "9px",
        "background": "rgba(0,144,202,.08)",
        "color": "#0072a3",
        "fontSize": "12px",
        "fontWeight": "700",
        "cursor": "pointer"
      }
    }, "New user"), React.createElement("button", {
      onClick: r?.edit,
      style: {
        "flex": "1",
        "border": "1px solid rgba(125,145,180,.3)",
        "borderRadius": "10px",
        "padding": "9px",
        "background": "rgba(255,255,255,.7)",
        "color": "#16202e",
        "fontSize": "12px",
        "fontWeight": "700",
        "cursor": "pointer"
      }
    }, "Edit role"), React.createElement("button", {
      onClick: r?.duplicate,
      style: {
        "border": "1px solid rgba(125,145,180,.3)",
        "borderRadius": "10px",
        "padding": "9px 11px",
        "background": "rgba(255,255,255,.7)",
        "color": "#16202e",
        "fontSize": "12px",
        "fontWeight": "700",
        "cursor": "pointer"
      }
    }, "Duplicate")))))), React.createElement("div", {
      style: {
        "fontSize": "11px",
        "color": "#7d8ea8",
        "textAlign": "center",
        "padding": "4px"
      }
    }, "Bars: one per module · height = View → Edit → Add → Delete"))) : null;
  }
  function Screen_sOrg(v) {
    return v.sOrg ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "flex": "1",
        "minHeight": "0",
        "display": "flex",
        "flexDirection": "column",
        "animation": "pop .3s ease backwards"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px",
        "padding": "12px 16px 0",
        "flexShrink": "0"
      }
    }, React.createElement("button", {
      onClick: v.openDrawer,
      style: {
        "width": "38px",
        "height": "38px",
        "borderRadius": "11px",
        "border": "1px solid rgba(255,255,255,.9)",
        "background": "rgba(255,255,255,.6)",
        "display": "grid",
        "placeItems": "center",
        "color": "#3c4858",
        "cursor": "pointer",
        "flexShrink": "0"
      }
    }, React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round"
    }, React.createElement("path", {
      d: "M4 7h16M4 12h16M4 17h10"
    }))), React.createElement("div", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "17px",
        "fontWeight": "800",
        "letterSpacing": "-.2px"
      }
    }, "Nursing hierarchy"), React.createElement("div", {
      style: {
        "fontSize": "12px",
        "color": "#6c7a8c"
      }
    }, "CNS → Nurse Manager → In-charge → Staff"))), React.createElement("div", {
      style: {
        "display": "grid",
        "gridTemplateColumns": "repeat(3,1fr)",
        "margin": "10px 16px 0",
        "background": "rgba(255,255,255,.55)",
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "11px",
        "padding": "3px",
        "gap": "2px",
        "flexShrink": "0"
      }
    }, (Array.isArray(v.orgTabs) ? v.orgTabs : []).map((t, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: t?.go,
      style: S(t?.style)
    }, ix(t?.label))))), v.orgToast ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "margin": "10px 16px 0",
        "display": "flex",
        "alignItems": "center",
        "gap": "8px",
        "borderRadius": "12px",
        "padding": "10px 12px",
        "background": "rgba(43,182,115,.13)",
        "color": "#1d8f57",
        "fontSize": "12.5px",
        "fontWeight": "700",
        "flexShrink": "0",
        "animation": "pop .25s ease"
      }
    }, React.createElement("svg", {
      width: "15",
      height: "15",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.4",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M20 6L9 17l-5-5"
    })), ix(v.orgToast))) : null, React.createElement("div", {
      style: {
        "flex": "1",
        "minHeight": "0",
        "overflow": "auto",
        "padding": "12px 16px 20px",
        "display": "flex",
        "flexDirection": "column",
        "gap": "12px"
      }
    }, v.orgTabLevels ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "flex-start",
        "gap": "10px",
        "borderRadius": "14px",
        "padding": "11px 13px",
        "background": "rgba(0,144,202,.08)",
        "border": "1px solid rgba(0,144,202,.2)",
        "fontSize": "12px",
        "lineHeight": "1.5"
      }
    }, React.createElement("svg", {
      width: "15",
      height: "15",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "#0072a3",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      style: {
        "flexShrink": "0",
        "marginTop": "2px"
      }
    }, React.createElement("circle", {
      cx: "12",
      cy: "12",
      r: "9"
    }), React.createElement("path", {
      d: "M12 16v-4M12 8h.01"
    })), React.createElement("span", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, "Each role reports to the level above. A higher level can see and approve everything the levels below it can. Change a role's ", React.createElement("b", null, "Reports to"), " in the role editor and the chain, approvals and directory update together.")), React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "6px"
      }
    }, (Array.isArray(v.orgLevels) ? v.orgLevels : []).map((lv, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "6px"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "8px",
        "padding": "2px 2px 0"
      }
    }, React.createElement("span", {
      style: S(lv?.badge)
    }, ix(lv?.n)), React.createElement("span", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, ix(lv?.label)), React.createElement("span", {
      style: {
        "flex": "1",
        "height": "1px",
        "background": "rgba(125,145,180,.2)"
      }
    }), React.createElement("span", {
      style: {
        "fontSize": "11px",
        "color": "#6c7a8c"
      }
    }, ix(lv?.count), " people")), (Array.isArray(lv?.roles) ? lv?.roles : []).map((r, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: r?.edit,
      style: S(r?.style)
    }, React.createElement("span", {
      style: S(r?.avStyle)
    }, React.createElement("svg", {
      width: "16",
      height: "16",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: r?.d
    }))), React.createElement("span", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "13.5px",
        "fontWeight": "800"
      }
    }, ix(r?.label)), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "11px",
        "color": "#6c7a8c",
        "whiteSpace": "nowrap",
        "overflow": "hidden",
        "textOverflow": "ellipsis"
      }
    }, ix(r?.reportsTo), " · ", ix(r?.members), " members", ix(r?.holders))), r?.inherits ? React.createElement(React.Fragment, null, React.createElement("span", {
      title: "Inherits everything below",
      style: {
        "fontSize": "9px",
        "fontWeight": "800",
        "letterSpacing": ".5px",
        "padding": "2px 6px",
        "borderRadius": "5px",
        "color": "#1e8a7c",
        "background": "rgba(58,181,167,.16)"
      }
    }, "SEES BELOW")) : null, React.createElement("svg", {
      width: "16",
      height: "16",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "#9aa6b4",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M9 6l6 6-6 6"
    })))))))))) : null, v.orgTabChain ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px",
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "14px",
        "padding": "11px 13px",
        "background": "rgba(255,255,255,.66)"
      }
    }, React.createElement("span", {
      style: {
        "flex": "1"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "13px",
        "fontWeight": "700"
      }
    }, "Auto-escalate after ", ix(v.escHours), " h"), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "11px",
        "color": "#6c7a8c"
      }
    }, "Unanswered requests move one level up")), React.createElement("div", {
      style: {
        "display": "inline-flex",
        "background": "rgba(125,145,180,.12)",
        "borderRadius": "9px",
        "padding": "2px",
        "gap": "2px"
      }
    }, (Array.isArray(v.escOpts) ? v.escOpts : []).map((o, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: o?.go,
      style: S(o?.style)
    }, ix(o?.label)))))), React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "8px"
      }
    }, (Array.isArray(v.approvalRules) ? v.approvalRules : []).map((r, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "15px",
        "padding": "12px 13px",
        "background": "rgba(255,255,255,.68)",
        "display": "flex",
        "flexDirection": "column",
        "gap": "9px"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px"
      }
    }, React.createElement("span", {
      style: S(r?.iconWrap)
    }, React.createElement("svg", {
      width: "16",
      height: "16",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: r?.d
    }))), React.createElement("span", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "13.5px",
        "fontWeight": "800"
      }
    }, ix(r?.label)), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "11px",
        "color": "#6c7a8c"
      }
    }, ix(r?.sub)))), React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "4px",
        "flexWrap": "wrap"
      }
    }, (Array.isArray(r?.chain) ? r?.chain : []).map((c, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("span", {
      style: S(c?.style)
    }, ix(c?.label)), c?.arrow ? React.createElement(React.Fragment, null, React.createElement("svg", {
      width: "12",
      height: "12",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "#9aa6b4",
      strokeWidth: "2.4",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M9 6l6 6-6 6"
    }))) : null))), React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "5px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Approved by"), React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "6px",
        "flexWrap": "wrap"
      }
    }, (Array.isArray(r?.opts) ? r?.opts : []).map((o, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: o?.go,
      style: S(o?.style)
    }, ix(o?.label))))))))))) : null, v.orgTabPeople ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.92)",
        "borderRadius": "18px",
        "padding": "14px",
        "background": "linear-gradient(140deg,rgba(106,82,212,.12),rgba(255,255,255,.7))",
        "display": "flex",
        "alignItems": "center",
        "gap": "12px"
      }
    }, React.createElement("span", {
      style: {
        "display": "grid",
        "placeItems": "center",
        "width": "46px",
        "height": "46px",
        "borderRadius": "14px",
        "color": "#fff",
        "fontSize": "13px",
        "fontWeight": "700",
        "background": "linear-gradient(135deg,#6a52d4,#0090ca)"
      }
    }, ix(v.cns?.ini)), React.createElement("span", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "10px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#6a52d4"
      }
    }, "Chief of Nursing Services"), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "14.5px",
        "fontWeight": "800"
      }
    }, ix(v.cns?.name)), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "11px",
        "color": "#6c7a8c"
      }
    }, ix(v.cns?.sub))), React.createElement("button", {
      onClick: v.cns?.open,
      style: {
        "border": "1px solid rgba(106,82,212,.35)",
        "borderRadius": "9px",
        "padding": "7px 11px",
        "background": "rgba(106,82,212,.1)",
        "color": "#6a52d4",
        "fontSize": "11.5px",
        "fontWeight": "700",
        "cursor": "pointer"
      }
    }, "Open")), (Array.isArray(v.clusters) ? v.clusters : []).map((cl, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "6px"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px",
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "14px",
        "padding": "11px 13px",
        "background": "rgba(255,255,255,.7)",
        "marginLeft": "14px",
        "position": "relative"
      }
    }, React.createElement("span", {
      style: {
        "position": "absolute",
        "left": "-14px",
        "top": "50%",
        "width": "14px",
        "height": "1px",
        "background": "rgba(125,145,180,.35)"
      }
    }), React.createElement("span", {
      style: {
        "display": "grid",
        "placeItems": "center",
        "width": "38px",
        "height": "38px",
        "borderRadius": "11px",
        "color": "#fff",
        "fontSize": "11.5px",
        "fontWeight": "700",
        "background": "linear-gradient(135deg,#0072a3,#3ab5a7)"
      }
    }, ix(cl?.ini)), React.createElement("span", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "10px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#0072a3"
      }
    }, "Nurse Manager · ", ix(cl?.name)), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "13.5px",
        "fontWeight": "800"
      }
    }, ix(cl?.manager)), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "11px",
        "color": "#6c7a8c"
      }
    }, ix(cl?.depts?.length), " departments · ", ix(cl?.staff), " staff")), React.createElement("button", {
      onClick: cl?.reassign,
      style: {
        "border": "1px solid rgba(125,145,180,.3)",
        "borderRadius": "9px",
        "padding": "6px 10px",
        "background": "rgba(255,255,255,.7)",
        "color": "#16202e",
        "fontSize": "11px",
        "fontWeight": "700",
        "cursor": "pointer",
        "whiteSpace": "nowrap"
      }
    }, "Reassign")), (Array.isArray(cl?.depts) ? cl?.depts : []).map((d, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px",
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "13px",
        "padding": "9px 12px",
        "background": "rgba(255,255,255,.62)",
        "marginLeft": "34px",
        "position": "relative"
      }
    }, React.createElement("span", {
      style: {
        "position": "absolute",
        "left": "-20px",
        "top": "50%",
        "width": "20px",
        "height": "1px",
        "background": "rgba(125,145,180,.35)"
      }
    }), React.createElement("span", {
      style: {
        "display": "grid",
        "placeItems": "center",
        "width": "34px",
        "height": "34px",
        "borderRadius": "10px",
        "color": "#fff",
        "fontSize": "10.5px",
        "fontWeight": "700",
        "background": "linear-gradient(135deg,#1e8a7c,#3ab5a7)"
      }
    }, ix(d?.ini)), React.createElement("span", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "10px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#1e8a7c"
      }
    }, "In-charge · ", ix(d?.id)), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "13px",
        "fontWeight": "700"
      }
    }, ix(d?.incharge)), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "10.5px",
        "color": "#6c7a8c"
      }
    }, ix(d?.staff), " staff nurses & PCAs report here")), React.createElement("button", {
      onClick: d?.open,
      style: {
        "border": "0",
        "background": "none",
        "color": "#0072a3",
        "fontSize": "11.5px",
        "fontWeight": "700",
        "cursor": "pointer"
      }
    }, "Dept"))))))), v.reassignOpen ? React.createElement(React.Fragment, null, React.createElement("div", {
      onClick: v.closeReassign,
      style: {
        "position": "absolute",
        "inset": "0",
        "zIndex": "20",
        "background": "rgba(13,28,50,.45)",
        "animation": "fadeIn .2s ease"
      }
    }), React.createElement("div", {
      style: {
        "position": "absolute",
        "left": "0",
        "right": "0",
        "bottom": "0",
        "zIndex": "21",
        "background": "rgba(255,255,255,.97)",
        "borderRadius": "22px 22px 0 0",
        "padding": "14px 18px 22px",
        "boxShadow": "0 -18px 50px rgba(31,59,90,.25)",
        "display": "flex",
        "flexDirection": "column",
        "gap": "10px",
        "animation": "pop .28s cubic-bezier(.2,.7,.3,1)"
      }
    }, React.createElement("div", {
      style: {
        "width": "40px",
        "height": "4px",
        "borderRadius": "2px",
        "background": "rgba(125,145,180,.4)",
        "alignSelf": "center"
      }
    }), React.createElement("div", {
      style: {
        "fontSize": "15px",
        "fontWeight": "800"
      }
    }, "Nurse Manager for ", ix(v.reassignCluster)), (Array.isArray(v.reassignOpts) ? v.reassignOpts : []).map((o, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: o?.go,
      style: S(o?.style)
    }, React.createElement("span", {
      style: {
        "display": "grid",
        "placeItems": "center",
        "width": "34px",
        "height": "34px",
        "borderRadius": "10px",
        "color": "#fff",
        "fontSize": "11px",
        "fontWeight": "700",
        "background": "linear-gradient(135deg,#0072a3,#3ab5a7)"
      }
    }, ix(o?.ini)), React.createElement("span", {
      style: {
        "flex": "1",
        "textAlign": "left"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "13px",
        "fontWeight": "700"
      }
    }, ix(o?.name)), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "11px",
        "color": "#6c7a8c"
      }
    }, ix(o?.sub)))))))) : null) : null))) : null;
  }
  function Screen_sRoleEdit(v) {
    return v.sRoleEdit ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "flex": "1",
        "minHeight": "0",
        "display": "flex",
        "flexDirection": "column",
        "animation": "pop .3s ease backwards"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px",
        "padding": "12px 16px 0",
        "flexShrink": "0"
      }
    }, React.createElement("button", {
      onClick: v.goRoles,
      style: {
        "width": "38px",
        "height": "38px",
        "borderRadius": "11px",
        "border": "1px solid rgba(255,255,255,.9)",
        "background": "rgba(255,255,255,.6)",
        "display": "grid",
        "placeItems": "center",
        "color": "#3c4858",
        "cursor": "pointer"
      }
    }, React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M15 6l-6 6 6 6"
    }))), React.createElement("div", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "16px",
        "fontWeight": "800",
        "letterSpacing": "-.2px",
        "whiteSpace": "nowrap",
        "overflow": "hidden",
        "textOverflow": "ellipsis"
      }
    }, ix(v.reTitle)), React.createElement("div", {
      style: {
        "fontSize": "12px",
        "color": "#6c7a8c"
      }
    }, ix(v.reSub))), React.createElement("button", {
      onClick: v.reSave,
      style: S(v.reSaveStyle)
    }, ix(v.reSaveLabel))), v.reToast ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "margin": "10px 16px 0",
        "display": "flex",
        "alignItems": "center",
        "gap": "8px",
        "borderRadius": "12px",
        "padding": "10px 12px",
        "background": "rgba(43,182,115,.13)",
        "color": "#1d8f57",
        "fontSize": "12.5px",
        "fontWeight": "700",
        "flexShrink": "0",
        "animation": "pop .25s ease"
      }
    }, React.createElement("svg", {
      width: "15",
      height: "15",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.4",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M20 6L9 17l-5-5"
    })), ix(v.reToast))) : null, React.createElement("div", {
      style: {
        "display": "grid",
        "gridTemplateColumns": "repeat(3,1fr)",
        "margin": "10px 16px 0",
        "background": "rgba(255,255,255,.55)",
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "11px",
        "padding": "3px",
        "gap": "2px",
        "flexShrink": "0"
      }
    }, (Array.isArray(v.reTabs) ? v.reTabs : []).map((t, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: t?.go,
      style: S(t?.style)
    }, ix(t?.label))))), React.createElement("div", {
      style: {
        "flex": "1",
        "minHeight": "0",
        "overflow": "auto",
        "padding": "12px 16px 20px",
        "display": "flex",
        "flexDirection": "column",
        "gap": "12px"
      }
    }, v.reTabBasics ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.92)",
        "borderRadius": "18px",
        "padding": "14px",
        "background": "rgba(255,255,255,.72)",
        "display": "flex",
        "flexDirection": "column",
        "gap": "10px"
      }
    }, React.createElement("label", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "4px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Role name"), React.createElement("input", {
      value: vx(v.re?.label),
      onChange: v.reSetLabel,
      readOnly: v.re?.system,
      placeholder: "e.g. Ward Clerk",
      style: S(v.reNameStyle)
    })), React.createElement("label", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "4px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Description"), React.createElement("input", {
      value: vx(v.re?.desc),
      onChange: v.reSetDesc,
      placeholder: "What this role is for",
      style: {
        "border": "1px solid rgba(125,145,180,.3)",
        "borderRadius": "10px",
        "padding": "10px 12px",
        "fontSize": "13.5px",
        "background": "rgba(255,255,255,.85)",
        "outline": "none"
      }
    })), React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "5px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Where it signs in"), React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "5px"
      }
    }, (Array.isArray(v.reKinds) ? v.reKinds : []).map((k, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: k?.go,
      style: S(k?.style)
    }, React.createElement("span", {
      style: S(k?.radio)
    }), React.createElement("span", {
      style: {
        "flex": "1",
        "textAlign": "left"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "13px",
        "fontWeight": "700"
      }
    }, ix(k?.label)), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "11px",
        "color": "#6c7a8c",
        "lineHeight": "1.35"
      }
    }, ix(k?.desc)))))))), v.reNotAdmin ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "5px"
      }
    }, React.createElement("span", {
      style: {
        "display": "flex",
        "justifyContent": "space-between",
        "fontSize": "10px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, React.createElement("span", null, "Reports to"), React.createElement("span", {
      style: {
        "fontWeight": "600",
        "letterSpacing": "0",
        "textTransform": "none",
        "color": "#6c7a8c"
      }
    }, ix(v.reLevelLabel))), React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "6px",
        "flexWrap": "wrap"
      }
    }, (Array.isArray(v.reParentOpts) ? v.reParentOpts : []).map((p, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: p?.go,
      style: S(p?.style)
    }, ix(p?.label))))), React.createElement("span", {
      style: {
        "fontSize": "11px",
        "color": "#6c7a8c",
        "lineHeight": "1.4"
      }
    }, ix(v.reParentHint)))) : null, React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "5px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Colour"), React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "8px"
      }
    }, (Array.isArray(v.reColors) ? v.reColors : []).map((c, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: c?.go,
      style: S(c?.style)
    }))))), v.reIsPortal ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "5px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Default staff scope"), React.createElement("div", {
      style: {
        "display": "inline-flex",
        "background": "rgba(255,255,255,.55)",
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "11px",
        "padding": "3px",
        "gap": "3px",
        "alignSelf": "flex-start"
      }
    }, (Array.isArray(v.reScopes) ? v.reScopes : []).map((o, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: o?.go,
      style: S(o?.style)
    }, ix(o?.label))))))) : null), v.reCanDelete ? React.createElement(React.Fragment, null, React.createElement("button", {
      onClick: v.reDelete,
      style: {
        "border": "1px solid rgba(210,58,82,.35)",
        "borderRadius": "13px",
        "padding": "12px",
        "background": "rgba(210,58,82,.07)",
        "color": "#b32e2e",
        "fontSize": "13px",
        "fontWeight": "700",
        "cursor": "pointer"
      }
    }, "Delete role")) : null, v.reCannotDelete ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "fontSize": "11.5px",
        "color": "#7d8ea8",
        "textAlign": "center",
        "lineHeight": "1.5"
      }
    }, ix(v.reDeleteHint))) : null) : null, v.reTabPerms ? React.createElement(React.Fragment, null, v.reIsAdmin ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "flex-start",
        "gap": "10px",
        "borderRadius": "14px",
        "padding": "12px 13px",
        "background": "linear-gradient(140deg,rgba(106,82,212,.14),rgba(255,255,255,.7))",
        "border": "1px solid rgba(106,82,212,.3)",
        "fontSize": "12.5px",
        "lineHeight": "1.5"
      }
    }, React.createElement("b", null, "Unrestricted."), " Administrator bypasses every check on the server. Nothing to configure.")) : null, v.reIsConsole ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "6px",
        "overflowX": "auto",
        "paddingBottom": "2px",
        "scrollbarWidth": "none",
        "flexShrink": "0"
      }
    }, (Array.isArray(v.rePresetChips) ? v.rePresetChips : []).map((p, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: p?.go,
      style: S(p?.style)
    }, ix(p?.label))))), React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "16px",
        "background": "rgba(255,255,255,.68)",
        "overflow": "hidden",
        "flexShrink": "0"
      }
    }, React.createElement("div", {
      style: {
        "display": "grid",
        "gridTemplateColumns": "1fr repeat(4,34px)",
        "gap": "4px",
        "alignItems": "center",
        "padding": "10px 12px 6px",
        "fontSize": "9.5px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, React.createElement("span", null, "Module"), React.createElement("span", {
      style: {
        "textAlign": "center"
      }
    }, "View"), React.createElement("span", {
      style: {
        "textAlign": "center"
      }
    }, "Edit"), React.createElement("span", {
      style: {
        "textAlign": "center"
      }
    }, "Add"), React.createElement("span", {
      style: {
        "textAlign": "center"
      }
    }, "Del")), (Array.isArray(v.rePermRows) ? v.rePermRows : []).map((m, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "display": "grid",
        "gridTemplateColumns": "1fr repeat(4,34px)",
        "gap": "4px",
        "alignItems": "center",
        "padding": "8px 12px",
        "borderTop": "1px solid rgba(125,145,180,.12)"
      }
    }, React.createElement("span", {
      style: {
        "minWidth": "0"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "12.5px",
        "fontWeight": "700",
        "whiteSpace": "nowrap",
        "overflow": "hidden",
        "textOverflow": "ellipsis"
      }
    }, ix(m?.label)), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "10px",
        "color": "#7d8ea8"
      }
    }, ix(m?.summary))), (Array.isArray(m?.cells) ? m?.cells : []).map((c, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: c?.go,
      style: S(c?.style)
    }, c?.on ? React.createElement(React.Fragment, null, React.createElement("svg", {
      width: "13",
      height: "13",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "#fff",
      strokeWidth: "3",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M20 6L9 17l-5-5"
    }))) : null)))))))) : null, v.reIsPortal ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "6px",
        "overflowX": "auto",
        "paddingBottom": "2px",
        "scrollbarWidth": "none",
        "flexShrink": "0"
      }
    }, (Array.isArray(v.reFeatPresets) ? v.reFeatPresets : []).map((p, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: p?.go,
      style: S(p?.style)
    }, ix(p?.label))))), (Array.isArray(v.reFeatGroups) ? v.reFeatGroups : []).map((g, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "16px",
        "background": "rgba(255,255,255,.68)",
        "overflow": "hidden",
        "flexShrink": "0"
      }
    }, React.createElement("div", {
      style: {
        "padding": "10px 14px 4px",
        "fontSize": "10px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, ix(g?.sec)), (Array.isArray(g?.rows) ? g?.rows : []).map((f, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "12px",
        "padding": "9px 14px",
        "borderTop": "1px solid rgba(125,145,180,.12)"
      }
    }, React.createElement("span", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "12.5px",
        "fontWeight": "600"
      }
    }, ix(f?.label)), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "10.5px",
        "color": "#7d8ea8"
      }
    }, ix(f?.sub))), React.createElement("button", {
      onClick: f?.go,
      style: S(f?.track)
    }, React.createElement("span", {
      style: S(f?.knob)
    }))))))))) : null) : null, v.reTabMembers ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px",
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "14px",
        "padding": "11px 13px",
        "background": "rgba(255,255,255,.66)"
      }
    }, React.createElement("span", {
      style: {
        "flex": "1"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "13px",
        "fontWeight": "700"
      }
    }, ix(v.reMemberCount), " members"), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "11px",
        "color": "#6c7a8c"
      }
    }, "Saving the role updates them all automatically")), React.createElement("button", {
      onClick: v.reAddMember,
      style: {
        "border": "1px solid rgba(0,144,202,.3)",
        "borderRadius": "9px",
        "padding": "7px 11px",
        "background": "rgba(0,144,202,.08)",
        "color": "#0072a3",
        "fontSize": "11.5px",
        "fontWeight": "700",
        "cursor": "pointer",
        "whiteSpace": "nowrap"
      }
    }, "Add user")), React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "6px"
      }
    }, (Array.isArray(v.reMembers) ? v.reMembers : []).map((u, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px",
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "13px",
        "padding": "10px 12px",
        "background": "rgba(255,255,255,.62)"
      }
    }, React.createElement("span", {
      style: S(u?.avStyle)
    }, ix(u?.ini)), React.createElement("span", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "13px",
        "fontWeight": "700"
      }
    }, ix(u?.name)), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "11px",
        "color": "#6c7a8c",
        "fontFamily": "'IBM Plex Mono',monospace"
      }
    }, "@", ix(u?.username))), React.createElement("button", {
      onClick: u?.open,
      style: {
        "border": "0",
        "background": "none",
        "color": "#0072a3",
        "fontSize": "12px",
        "fontWeight": "700",
        "cursor": "pointer"
      }
    }, "Open")))), v.reNoMembers ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "textAlign": "center",
        "padding": "20px",
        "color": "#7d8ea8",
        "fontSize": "12.5px"
      }
    }, "No one has this role yet.")) : null)) : null))) : null;
  }
  function Screen_sApprovals(v) {
    return v.sApprovals ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "flex": "1",
        "minHeight": "0",
        "display": "flex",
        "flexDirection": "column",
        "animation": "pop .3s ease backwards"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px",
        "padding": "12px 16px 0",
        "flexShrink": "0"
      }
    }, React.createElement("button", {
      onClick: v.openDrawer,
      style: {
        "width": "38px",
        "height": "38px",
        "borderRadius": "11px",
        "border": "1px solid rgba(255,255,255,.9)",
        "background": "rgba(255,255,255,.6)",
        "display": "grid",
        "placeItems": "center",
        "color": "#3c4858",
        "cursor": "pointer",
        "flexShrink": "0"
      }
    }, React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round"
    }, React.createElement("path", {
      d: "M4 7h16M4 12h16M4 17h10"
    }))), React.createElement("div", {
      style: {
        "flex": "1"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "19px",
        "fontWeight": "800",
        "letterSpacing": "-.3px"
      }
    }, "Review & approve"), React.createElement("div", {
      style: {
        "fontSize": "12px",
        "color": "#6c7a8c"
      }
    }, ix(v.pendingTotal), " waiting · ", ix(v.queueMonthLabel))), v.hasPendingDc ? React.createElement(React.Fragment, null, React.createElement("button", {
      onClick: v.approveAllOk,
      style: {
        "border": "0",
        "borderRadius": "11px",
        "padding": "10px 12px",
        "background": "linear-gradient(140deg,#2bb673,#1d8f57)",
        "color": "#fff",
        "fontSize": "12px",
        "fontWeight": "700",
        "cursor": "pointer",
        "whiteSpace": "nowrap"
      }
    }, "Approve all OK")) : null), React.createElement("div", {
      style: {
        "display": "grid",
        "gridTemplateColumns": "repeat(3,1fr)",
        "margin": "10px 16px 0",
        "background": "rgba(255,255,255,.55)",
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "11px",
        "padding": "3px",
        "gap": "2px",
        "flexShrink": "0"
      }
    }, (Array.isArray(v.apTabs) ? v.apTabs : []).map((t, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: t?.go,
      style: S(t?.style)
    }, ix(t?.label), t?.badge ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: {
        "marginLeft": "5px",
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "10px",
        "fontWeight": "700",
        "padding": "1px 6px",
        "borderRadius": "8px",
        "color": "#fff",
        "background": "#e08a1e"
      }
    }, ix(t?.badge))) : null)))), React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "6px",
        "overflowX": "auto",
        "padding": "10px 16px 0",
        "scrollbarWidth": "none",
        "flexShrink": "0"
      }
    }, (Array.isArray(v.apFilters) ? v.apFilters : []).map((f, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: f?.go,
      style: S(f?.style)
    }, ix(f?.label))))), v.apToast ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "margin": "10px 16px 0",
        "display": "flex",
        "alignItems": "center",
        "gap": "8px",
        "borderRadius": "12px",
        "padding": "10px 12px",
        "background": "rgba(43,182,115,.13)",
        "color": "#1d8f57",
        "fontSize": "12.5px",
        "fontWeight": "700",
        "flexShrink": "0",
        "animation": "pop .25s ease"
      }
    }, React.createElement("svg", {
      width: "15",
      height: "15",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.4",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M20 6L9 17l-5-5"
    })), ix(v.apToast))) : null, React.createElement("div", {
      style: {
        "flex": "1",
        "minHeight": "0",
        "overflow": "auto",
        "padding": "12px 16px 20px",
        "display": "flex",
        "flexDirection": "column",
        "gap": "8px"
      }
    }, (Array.isArray(v.apList) ? v.apList : []).map((q, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: S(q?.cardStyle)
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px"
      }
    }, React.createElement("span", {
      style: S(q?.kindStyle)
    }, ix(q?.kind)), React.createElement("span", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "13.5px",
        "fontWeight": "700"
      }
    }, ix(q?.label)), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "11px",
        "color": "#6c7a8c"
      }
    }, ix(q?.dept), " · by ", ix(q?.by), " · ", ix(q?.when))), q?.dupe ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: {
        "fontSize": "9px",
        "fontWeight": "800",
        "letterSpacing": ".5px",
        "padding": "2px 6px",
        "borderRadius": "5px",
        "color": "#b8650a",
        "background": "rgba(224,138,30,.15)"
      }
    }, "DUPLICATE")) : null, q?.corr ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: {
        "fontSize": "9px",
        "fontWeight": "800",
        "letterSpacing": ".5px",
        "padding": "2px 6px",
        "borderRadius": "5px",
        "color": "#6a52d4",
        "background": "rgba(106,82,212,.13)"
      }
    }, "CORRECTION")) : null), React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px",
        "marginTop": "9px",
        "padding": "9px 11px",
        "borderRadius": "11px",
        "background": "rgba(125,145,180,.08)"
      }
    }, React.createElement("div", {
      style: {
        "flex": "1",
        "display": "flex",
        "gap": "12px",
        "flexWrap": "wrap"
      }
    }, (Array.isArray(q?.vals) ? q?.vals : []).map((v, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("span", {
      style: {
        "fontSize": "11px",
        "color": "#6c7a8c"
      }
    }, ix(v?.k), " ", React.createElement("b", {
      style: {
        "fontFamily": "'IBM Plex Mono',monospace",
        "color": "#16202e",
        "fontSize": "12px"
      }
    }, ix(v?.v)))))), q?.value ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: {
        "textAlign": "right"
      }
    }, React.createElement("span", {
      style: S(`display:block;font-family:'IBM Plex Mono',monospace;font-size:17px;font-weight:600;line-height:1;color:${q?.valueColor ?? ""}`)
    }, ix(q?.value)), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "10px",
        "color": "#7d8ea8",
        "marginTop": "2px"
      }
    }, ix(q?.benchLabel)))) : null), q?.note ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "fontSize": "11.5px",
        "color": "#3c4858",
        "marginTop": "7px",
        "lineHeight": "1.45"
      }
    }, React.createElement("b", null, "Note:"), " ", ix(q?.note))) : null, q?.pending ? React.createElement(React.Fragment, null, q?.returning ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "6px",
        "marginTop": "9px"
      }
    }, React.createElement("textarea", {
      value: vx(v.apReason),
      onChange: v.setApReason,
      rows: "2",
      placeholder: "Tell the collector what to fix",
      style: {
        "border": "1px solid rgba(214,69,69,.35)",
        "borderRadius": "10px",
        "padding": "9px 11px",
        "fontSize": "13px",
        "background": "#fff",
        "outline": "none",
        "resize": "none"
      }
    }), React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "6px"
      }
    }, React.createElement("button", {
      onClick: q?.cancelReturn,
      style: {
        "flex": "1",
        "border": "1px solid rgba(125,145,180,.35)",
        "borderRadius": "10px",
        "padding": "9px",
        "background": "rgba(255,255,255,.7)",
        "color": "#16202e",
        "fontSize": "12.5px",
        "fontWeight": "700",
        "cursor": "pointer"
      }
    }, "Cancel"), React.createElement("button", {
      onClick: q?.confirmReturn,
      style: {
        "flex": "1",
        "border": "0",
        "borderRadius": "10px",
        "padding": "9px",
        "background": "linear-gradient(140deg,#d23a52,#a8253c)",
        "color": "#fff",
        "fontSize": "12.5px",
        "fontWeight": "700",
        "cursor": "pointer"
      }
    }, "Return")))) : null, q?.notReturning ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "6px",
        "marginTop": "9px"
      }
    }, React.createElement("button", {
      onClick: q?.approve,
      style: {
        "flex": "1",
        "border": "0",
        "borderRadius": "10px",
        "padding": "10px",
        "background": "linear-gradient(140deg,#2bb673,#1d8f57)",
        "color": "#fff",
        "fontSize": "12.5px",
        "fontWeight": "700",
        "cursor": "pointer"
      }
    }, "Approve"), React.createElement("button", {
      onClick: q?.startReturn,
      style: {
        "flex": "1",
        "border": "1px solid rgba(210,58,82,.4)",
        "borderRadius": "10px",
        "padding": "10px",
        "background": "rgba(210,58,82,.08)",
        "color": "#b32e2e",
        "fontSize": "12.5px",
        "fontWeight": "700",
        "cursor": "pointer"
      }
    }, "Return"))) : null) : null, q?.decided ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "8px",
        "marginTop": "9px"
      }
    }, React.createElement("span", {
      style: S(q?.statusStyle)
    }, ix(q?.status)), q?.reason ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: {
        "fontSize": "11.5px",
        "color": "#6c7a8c",
        "flex": "1",
        "minWidth": "0",
        "whiteSpace": "nowrap",
        "overflow": "hidden",
        "textOverflow": "ellipsis"
      }
    }, ix(q?.reason))) : null, React.createElement("span", {
      style: {
        "flex": "1"
      }
    }), React.createElement("button", {
      onClick: q?.undo,
      style: {
        "border": "0",
        "background": "none",
        "color": "#0072a3",
        "fontSize": "11.5px",
        "fontWeight": "700",
        "cursor": "pointer",
        "padding": "0"
      }
    }, "Undo"))) : null))), v.apEmpty ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "textAlign": "center",
        "padding": "30px 20px",
        "color": "#7d8ea8",
        "fontSize": "13px"
      }
    }, "Nothing waiting here.")) : null))) : null;
  }
  function Screen_sDepts(v) {
    return v.sDepts ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "flex": "1",
        "minHeight": "0",
        "overflow": "auto",
        "padding": "14px 16px 20px",
        "display": "flex",
        "flexDirection": "column",
        "gap": "12px",
        "animation": "pop .3s ease backwards"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px"
      }
    }, React.createElement("button", {
      onClick: v.openDrawer,
      style: {
        "width": "38px",
        "height": "38px",
        "borderRadius": "11px",
        "border": "1px solid rgba(255,255,255,.9)",
        "background": "rgba(255,255,255,.6)",
        "display": "grid",
        "placeItems": "center",
        "color": "#3c4858",
        "cursor": "pointer",
        "flexShrink": "0"
      }
    }, React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round"
    }, React.createElement("path", {
      d: "M4 7h16M4 12h16M4 17h10"
    }))), React.createElement("div", {
      style: {
        "flex": "1"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "19px",
        "fontWeight": "800",
        "letterSpacing": "-.3px"
      }
    }, "Departments"), React.createElement("div", {
      style: {
        "fontSize": "12px",
        "color": "#6c7a8c"
      }
    }, ix(v.deptCount), " units · ", ix(v.staffTotal), " nursing staff")), React.createElement("button", {
      style: {
        "display": "inline-flex",
        "alignItems": "center",
        "gap": "6px",
        "border": "0",
        "borderRadius": "11px",
        "padding": "10px 12px",
        "background": "linear-gradient(140deg,#6a52d4,#0072a3)",
        "color": "#fff",
        "fontSize": "12.5px",
        "fontWeight": "700",
        "cursor": "pointer",
        "boxShadow": "0 8px 20px rgba(106,82,212,.3)"
      }
    }, React.createElement("svg", {
      width: "14",
      height: "14",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.4",
      strokeLinecap: "round"
    }, React.createElement("path", {
      d: "M12 5v14M5 12h14"
    })), "Add")), React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "8px"
      }
    }, (Array.isArray(v.deptList) ? v.deptList : []).map((d, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: d?.go,
      style: {
        "display": "block",
        "textAlign": "left",
        "width": "100%",
        "boxSizing": "border-box",
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "15px",
        "padding": "12px 13px",
        "background": "rgba(255,255,255,.66)",
        "cursor": "pointer",
        "color": "#16202e"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px"
      }
    }, React.createElement("span", {
      style: S(d?.avStyle)
    }, ix(d?.short)), React.createElement("span", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "13.5px",
        "fontWeight": "800"
      }
    }, ix(d?.name)), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "11px",
        "color": "#6c7a8c"
      }
    }, "In-charge: ", ix(d?.incharge), " · ", ix(d?.staff), " staff")), React.createElement("span", {
      style: S(d?.covStyle)
    }, ix(d?.cov))), React.createElement("div", {
      style: {
        "display": "flex",
        "height": "6px",
        "borderRadius": "999px",
        "overflow": "hidden",
        "background": "rgba(125,145,180,.18)",
        "marginTop": "9px"
      }
    }, React.createElement("span", {
      style: S(d?.barA)
    }), React.createElement("span", {
      style: S(d?.barP)
    }), React.createElement("span", {
      style: S(d?.barR)
    })), React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px",
        "marginTop": "7px",
        "fontSize": "10.5px",
        "color": "#7d8ea8"
      }
    }, React.createElement("span", null, ix(d?.sent), " of ", ix(d?.total), " items sent"), React.createElement("span", {
      style: {
        "flex": "1"
      }
    }), d?.alert ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: {
        "color": "#b32e2e",
        "fontWeight": "700"
      }
    }, ix(d?.alert))) : null))))))) : null;
  }
  function Screen_sDeptDetail(v) {
    return v.sDeptDetail ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "flex": "1",
        "minHeight": "0",
        "overflow": "auto",
        "padding": "12px 16px 20px",
        "display": "flex",
        "flexDirection": "column",
        "gap": "12px",
        "animation": "pop .3s ease backwards"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px"
      }
    }, React.createElement("button", {
      onClick: v.goDepts,
      style: {
        "width": "38px",
        "height": "38px",
        "borderRadius": "11px",
        "border": "1px solid rgba(255,255,255,.9)",
        "background": "rgba(255,255,255,.6)",
        "display": "grid",
        "placeItems": "center",
        "color": "#3c4858",
        "cursor": "pointer"
      }
    }, React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M15 6l-6 6 6 6"
    }))), React.createElement("div", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "17px",
        "fontWeight": "800",
        "letterSpacing": "-.2px"
      }
    }, ix(v.dd?.name)), React.createElement("div", {
      style: {
        "fontSize": "12px",
        "color": "#6c7a8c"
      }
    }, ix(v.dd?.staff), " staff · ", ix(v.dd?.beds), " beds"))), React.createElement("div", {
      style: {
        "display": "grid",
        "gridTemplateColumns": "repeat(3,1fr)",
        "gap": "8px"
      }
    }, (Array.isArray(v.ddTiles) ? v.ddTiles : []).map((t, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "13px",
        "padding": "11px 10px",
        "background": "rgba(255,255,255,.66)"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "9.5px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, ix(t?.label)), React.createElement("div", {
      style: S(`font-family:'IBM Plex Mono',monospace;font-size:20px;font-weight:600;margin-top:5px;line-height:1;color:${t?.color ?? ""}`)
    }, ix(t?.v)))))), React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "16px",
        "background": "rgba(255,255,255,.68)",
        "overflow": "hidden",
        "flexShrink": "0"
      }
    }, React.createElement("div", {
      style: {
        "padding": "12px 14px 6px",
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Responsible persons"), (Array.isArray(v.ddPeople) ? v.ddPeople : []).map((p, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px",
        "padding": "10px 14px",
        "borderTop": "1px solid rgba(125,145,180,.12)"
      }
    }, React.createElement("span", {
      style: {
        "display": "grid",
        "placeItems": "center",
        "width": "34px",
        "height": "34px",
        "borderRadius": "10px",
        "color": "#fff",
        "fontSize": "11px",
        "fontWeight": "700",
        "background": "linear-gradient(135deg,#3ab5a7,#0090ca)"
      }
    }, ix(p?.ini)), React.createElement("span", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "13px",
        "fontWeight": "700"
      }
    }, ix(p?.name)), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "11px",
        "color": "#6c7a8c"
      }
    }, ix(p?.role))), p?.hasLogin ? React.createElement(React.Fragment, null, React.createElement("button", {
      onClick: p?.openUser,
      style: {
        "border": "1px solid rgba(0,144,202,.3)",
        "borderRadius": "9px",
        "padding": "6px 10px",
        "background": "rgba(0,144,202,.08)",
        "color": "#0072a3",
        "fontSize": "11px",
        "fontWeight": "700",
        "cursor": "pointer",
        "display": "inline-flex",
        "alignItems": "center",
        "gap": "5px"
      }
    }, React.createElement("svg", {
      width: "12",
      height: "12",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M21 2l-2 2m-7.6 7.6a5.5 5.5 0 11-7.8 7.8 5.5 5.5 0 017.8-7.8zm0 0L15.5 7.5M15.5 7.5l3 3L22 7l-3-3"
    })), "Login")) : null, p?.noLogin ? React.createElement(React.Fragment, null, React.createElement("button", {
      onClick: p?.createLogin,
      style: {
        "border": "1px dashed rgba(125,145,180,.5)",
        "borderRadius": "9px",
        "padding": "6px 10px",
        "background": "transparent",
        "color": "#6c7a8c",
        "fontSize": "11px",
        "fontWeight": "700",
        "cursor": "pointer"
      }
    }, "Create login")) : null))), React.createElement("button", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "justifyContent": "center",
        "gap": "6px",
        "width": "100%",
        "border": "0",
        "borderTop": "1px solid rgba(125,145,180,.12)",
        "padding": "11px",
        "background": "transparent",
        "color": "#0072a3",
        "fontSize": "12px",
        "fontWeight": "700",
        "cursor": "pointer"
      }
    }, React.createElement("svg", {
      width: "13",
      height: "13",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.4",
      strokeLinecap: "round"
    }, React.createElement("path", {
      d: "M12 5v14M5 12h14"
    })), "Assign responsible person")), React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "8px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, ix(v.queueMonthLabel)), (Array.isArray(v.ddItems) ? v.ddItems : []).map((i, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px",
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "13px",
        "padding": "10px 12px",
        "background": "rgba(255,255,255,.62)"
      }
    }, React.createElement("span", {
      style: {
        "flex": "1",
        "fontSize": "12.5px",
        "fontWeight": "600"
      }
    }, ix(i?.label)), React.createElement("span", {
      style: S(i?.statusStyle)
    }, React.createElement("span", {
      style: S(i?.dot)
    }), ix(i?.status)))))), React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "6px"
      }
    }, React.createElement("button", {
      onClick: v.ddRemind,
      style: {
        "flex": "1",
        "border": "1px solid rgba(125,145,180,.35)",
        "borderRadius": "12px",
        "padding": "12px",
        "background": "rgba(255,255,255,.7)",
        "color": "#16202e",
        "fontSize": "13px",
        "fontWeight": "700",
        "cursor": "pointer"
      }
    }, ix(v.ddRemindLabel)), React.createElement("button", {
      onClick: v.goApprovals,
      style: {
        "flex": "1",
        "border": "0",
        "borderRadius": "12px",
        "padding": "12px",
        "background": "linear-gradient(140deg,#0aa0d4,#0072a3)",
        "color": "#fff",
        "fontSize": "13px",
        "fontWeight": "700",
        "cursor": "pointer"
      }
    }, "Review pending")))) : null;
  }
  function Screen_sModules(v) {
    return v.sModules ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "flex": "1",
        "minHeight": "0",
        "overflow": "auto",
        "padding": "14px 16px 20px",
        "display": "flex",
        "flexDirection": "column",
        "gap": "12px",
        "animation": "pop .3s ease backwards"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px"
      }
    }, React.createElement("button", {
      onClick: v.openDrawer,
      style: {
        "width": "38px",
        "height": "38px",
        "borderRadius": "11px",
        "border": "1px solid rgba(255,255,255,.9)",
        "background": "rgba(255,255,255,.6)",
        "display": "grid",
        "placeItems": "center",
        "color": "#3c4858",
        "cursor": "pointer",
        "flexShrink": "0"
      }
    }, React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round"
    }, React.createElement("path", {
      d: "M4 7h16M4 12h16M4 17h10"
    }))), React.createElement("div", {
      style: {
        "flex": "1"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "19px",
        "fontWeight": "800",
        "letterSpacing": "-.3px"
      }
    }, "All modules"), React.createElement("div", {
      style: {
        "fontSize": "12px",
        "color": "#6c7a8c"
      }
    }, "Every workspace of the UNICO suite · full access"))), React.createElement("div", {
      style: {
        "display": "grid",
        "gridTemplateColumns": "1fr 1fr",
        "gap": "8px"
      }
    }, (Array.isArray(v.moduleCards) ? v.moduleCards : []).map((m, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: m?.go,
      style: {
        "textAlign": "left",
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "16px",
        "padding": "13px",
        "background": "rgba(255,255,255,.68)",
        "cursor": "pointer",
        "color": "#16202e",
        "display": "flex",
        "flexDirection": "column",
        "gap": "8px",
        "position": "relative"
      },
      className: "dcp0"
    }, React.createElement("span", {
      style: S(`display:grid;place-items:center;width:40px;height:40px;border-radius:12px;color:${m?.color ?? ""};background:${m?.bg ?? ""}`)
    }, React.createElement("svg", {
      width: "19",
      height: "19",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: m?.d
    }))), React.createElement("span", null, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "13.5px",
        "fontWeight": "800",
        "lineHeight": "1.2"
      }
    }, ix(m?.label)), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "11px",
        "color": "#6c7a8c",
        "marginTop": "2px",
        "lineHeight": "1.35"
      }
    }, ix(m?.sub))), React.createElement("span", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "5px",
        "fontSize": "10.5px",
        "color": "#7d8ea8"
      }
    }, React.createElement("span", {
      style: {
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontWeight": "700",
        "color": "#16202e"
      }
    }, ix(m?.stat)), ix(m?.statLabel)), m?.badge ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: {
        "position": "absolute",
        "top": "10px",
        "right": "10px",
        "minWidth": "18px",
        "height": "18px",
        "padding": "0 5px",
        "borderRadius": "9px",
        "background": "#d23a52",
        "color": "#fff",
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "10px",
        "fontWeight": "700",
        "display": "grid",
        "placeItems": "center",
        "boxSizing": "border-box"
      }
    }, ix(m?.badge))) : null)))))) : null;
  }
  function Screen_sModule(v) {
    return v.sModule ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "flex": "1",
        "minHeight": "0",
        "display": "flex",
        "flexDirection": "column",
        "animation": "pop .3s ease backwards"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px",
        "padding": "12px 16px 0",
        "flexShrink": "0"
      }
    }, React.createElement("button", {
      onClick: v.goModules,
      style: {
        "width": "38px",
        "height": "38px",
        "borderRadius": "11px",
        "border": "1px solid rgba(255,255,255,.9)",
        "background": "rgba(255,255,255,.6)",
        "display": "grid",
        "placeItems": "center",
        "color": "#3c4858",
        "cursor": "pointer"
      }
    }, React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M15 6l-6 6 6 6"
    }))), React.createElement("span", {
      style: S(`display:grid;place-items:center;width:36px;height:36px;border-radius:11px;color:${v.mod?.color ?? ""};background:${v.mod?.bg ?? ""};flex-shrink:0`)
    }, React.createElement("svg", {
      width: "17",
      height: "17",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: v.mod?.d
    }))), React.createElement("div", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "16px",
        "fontWeight": "800",
        "letterSpacing": "-.2px",
        "whiteSpace": "nowrap",
        "overflow": "hidden",
        "textOverflow": "ellipsis"
      }
    }, ix(v.mod?.label)), React.createElement("div", {
      style: {
        "fontSize": "11.5px",
        "color": "#6c7a8c",
        "whiteSpace": "nowrap",
        "overflow": "hidden",
        "textOverflow": "ellipsis"
      }
    }, ix(v.mod?.sub))), v.modHasExport ? React.createElement(React.Fragment, null, React.createElement("button", {
      onClick: v.modExport,
      title: "Export",
      style: {
        "width": "38px",
        "height": "38px",
        "borderRadius": "11px",
        "border": "1px solid rgba(255,255,255,.9)",
        "background": "rgba(255,255,255,.6)",
        "display": "grid",
        "placeItems": "center",
        "color": "#3c4858",
        "cursor": "pointer",
        "flexShrink": "0"
      }
    }, React.createElement("svg", {
      width: "17",
      height: "17",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13"
    })))) : null, v.modPrimary ? React.createElement(React.Fragment, null, React.createElement("button", {
      onClick: v.modPrimary?.go,
      style: {
        "display": "inline-flex",
        "alignItems": "center",
        "gap": "6px",
        "border": "0",
        "borderRadius": "11px",
        "padding": "10px 12px",
        "background": "linear-gradient(140deg,#6a52d4,#0072a3)",
        "color": "#fff",
        "fontSize": "12px",
        "fontWeight": "700",
        "cursor": "pointer",
        "whiteSpace": "nowrap",
        "boxShadow": "0 8px 20px rgba(106,82,212,.3)"
      }
    }, React.createElement("svg", {
      width: "13",
      height: "13",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.4",
      strokeLinecap: "round"
    }, React.createElement("path", {
      d: "M12 5v14M5 12h14"
    })), ix(v.modPrimary?.label))) : null), v.modExportOpen ? React.createElement(React.Fragment, null, React.createElement("div", {
      onClick: v.closeModExport,
      style: {
        "position": "absolute",
        "inset": "0",
        "zIndex": "20",
        "background": "rgba(13,28,50,.45)",
        "animation": "fadeIn .2s ease"
      }
    }), React.createElement("div", {
      style: {
        "position": "absolute",
        "left": "0",
        "right": "0",
        "bottom": "0",
        "zIndex": "21",
        "background": "rgba(255,255,255,.97)",
        "borderRadius": "22px 22px 0 0",
        "padding": "14px 18px 22px",
        "boxShadow": "0 -18px 50px rgba(31,59,90,.25)",
        "display": "flex",
        "flexDirection": "column",
        "gap": "12px",
        "animation": "pop .28s cubic-bezier(.2,.7,.3,1)"
      }
    }, React.createElement("div", {
      style: {
        "width": "40px",
        "height": "4px",
        "borderRadius": "2px",
        "background": "rgba(125,145,180,.4)",
        "alignSelf": "center"
      }
    }), React.createElement("div", null, React.createElement("div", {
      style: {
        "fontSize": "16px",
        "fontWeight": "800"
      }
    }, "Export statistics report"), React.createElement("div", {
      style: {
        "fontSize": "12px",
        "color": "#6c7a8c"
      }
    }, ix(v.modExportSub))), React.createElement("div", {
      style: {
        "display": "grid",
        "gridTemplateColumns": "repeat(4,1fr)",
        "gap": "8px"
      }
    }, (Array.isArray(v.modExportOpts) ? v.modExportOpts : []).map((o, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: o?.go,
      style: {
        "display": "flex",
        "flexDirection": "column",
        "alignItems": "center",
        "gap": "7px",
        "border": "1px solid rgba(125,145,180,.2)",
        "borderRadius": "14px",
        "padding": "12px 4px 10px",
        "background": "rgba(255,255,255,.9)",
        "cursor": "pointer",
        "color": "#16202e"
      }
    }, React.createElement("span", {
      style: S(`display:grid;place-items:center;width:40px;height:40px;border-radius:12px;color:${o?.color ?? ""};background:${o?.bg ?? ""}`)
    }, React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: o?.d
    }))), React.createElement("span", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "textAlign": "center",
        "lineHeight": "1.2"
      }
    }, ix(o?.label)))))), React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "5px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Page"), React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "6px",
        "flexWrap": "wrap"
      }
    }, (Array.isArray(v.modExportPages) ? v.modExportPages : []).map((p, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: p?.go,
      style: S(p?.style)
    }, ix(p?.label)))))), React.createElement("div", {
      style: {
        "border": "1px solid rgba(125,145,180,.2)",
        "borderRadius": "14px",
        "background": "rgba(255,255,255,.9)",
        "overflow": "hidden",
        "flexShrink": "0"
      }
    }, (Array.isArray(v.modExportToggles) ? v.modExportToggles : []).map((t, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "12px",
        "padding": "11px 14px",
        "borderTop": "1px solid rgba(125,145,180,.14)"
      }
    }, React.createElement("span", {
      style: {
        "flex": "1"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "13px",
        "fontWeight": "600"
      }
    }, ix(t?.label)), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "11px",
        "color": "#6c7a8c"
      }
    }, ix(t?.sub))), React.createElement("button", {
      onClick: t?.go,
      style: S(t?.track)
    }, React.createElement("span", {
      style: S(t?.knob)
    })))))))) : null, React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "6px",
        "overflowX": "auto",
        "padding": "10px 16px 0",
        "scrollbarWidth": "none",
        "flexShrink": "0"
      }
    }, (Array.isArray(v.modTabs) ? v.modTabs : []).map((t, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: t?.go,
      style: S(t?.style)
    }, ix(t?.label), t?.badge ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: {
        "marginLeft": "5px",
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "10px",
        "fontWeight": "700",
        "padding": "1px 6px",
        "borderRadius": "8px",
        "color": "#fff",
        "background": "#e08a1e"
      }
    }, ix(t?.badge))) : null)))), v.modToast ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "margin": "10px 16px 0",
        "display": "flex",
        "alignItems": "center",
        "gap": "8px",
        "borderRadius": "12px",
        "padding": "10px 12px",
        "background": "rgba(43,182,115,.13)",
        "color": "#1d8f57",
        "fontSize": "12.5px",
        "fontWeight": "700",
        "flexShrink": "0",
        "animation": "pop .25s ease"
      }
    }, React.createElement("svg", {
      width: "15",
      height: "15",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.4",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M20 6L9 17l-5-5"
    })), ix(v.modToast))) : null, v.modHasFilters ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "6px",
        "overflowX": "auto",
        "padding": "8px 16px 0",
        "scrollbarWidth": "none",
        "flexShrink": "0"
      }
    }, (Array.isArray(v.modFilters) ? v.modFilters : []).map((f, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: f?.go,
      style: S(f?.style)
    }, ix(f?.label)))))) : null, v.modHasLayouts ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "grid",
        "gridTemplateColumns": "repeat(3,1fr)",
        "margin": "8px 16px 0",
        "background": "rgba(255,255,255,.55)",
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "11px",
        "padding": "3px",
        "gap": "2px",
        "flexShrink": "0"
      }
    }, (Array.isArray(v.modLayouts) ? v.modLayouts : []).map((l, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: l?.go,
      style: S(l?.style)
    }, ix(l?.label)))))) : null, React.createElement("div", {
      style: {
        "flex": "1",
        "minHeight": "0",
        "overflow": "auto",
        "padding": "12px 16px 20px",
        "display": "flex",
        "flexDirection": "column",
        "gap": "12px"
      }
    }, v.modHasInsights ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "16px",
        "padding": "13px 14px",
        "background": "linear-gradient(140deg,rgba(0,144,202,.1),rgba(58,181,167,.08),rgba(255,255,255,.7))",
        "display": "flex",
        "flexDirection": "column",
        "gap": "7px",
        "flexShrink": "0"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "8px"
      }
    }, React.createElement("span", {
      style: {
        "display": "grid",
        "placeItems": "center",
        "width": "26px",
        "height": "26px",
        "borderRadius": "8px",
        "background": "rgba(0,144,202,.16)",
        "color": "#0072a3"
      }
    }, React.createElement("svg", {
      width: "14",
      height: "14",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8z"
    }))), React.createElement("span", {
      style: {
        "fontSize": "13px",
        "fontWeight": "800"
      }
    }, ix(v.modInsightsTitle))), (Array.isArray(v.modInsights) ? v.modInsights : []).map((i, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "flex-start",
        "gap": "8px"
      }
    }, React.createElement("span", {
      style: S(i?.dot)
    }), React.createElement("span", {
      style: {
        "flex": "1",
        "fontSize": "12.5px",
        "lineHeight": "1.5",
        "textWrap": "pretty"
      }
    }, ix(i?.text))))))) : null, v.modHasTiles ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "grid",
        "gridTemplateColumns": "repeat(3,1fr)",
        "gap": "8px"
      }
    }, (Array.isArray(v.modTiles) ? v.modTiles : []).map((t, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "13px",
        "padding": "11px 10px",
        "background": "rgba(255,255,255,.66)"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "9.5px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8",
        "whiteSpace": "nowrap",
        "overflow": "hidden",
        "textOverflow": "ellipsis"
      }
    }, ix(t?.label)), React.createElement("div", {
      style: S(`font-family:'IBM Plex Mono',monospace;font-size:20px;font-weight:600;margin-top:5px;line-height:1;color:${t?.color ?? ""}`)
    }, ix(t?.v)), t?.note ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "fontSize": "10px",
        "color": "#6c7a8c",
        "marginTop": "3px",
        "whiteSpace": "nowrap",
        "overflow": "hidden",
        "textOverflow": "ellipsis"
      }
    }, ix(t?.note))) : null))))) : null, v.modHasChart ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "16px",
        "padding": "14px",
        "background": "rgba(255,255,255,.68)",
        "display": "flex",
        "flexDirection": "column",
        "gap": "10px"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "justifyContent": "space-between"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, ix(v.modChart?.title)), React.createElement("span", {
      style: {
        "fontSize": "10.5px",
        "color": "#6c7a8c"
      }
    }, ix(v.modChart?.legend))), React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "flex-end",
        "gap": "6px"
      }
    }, (Array.isArray(v.modChart?.bars) ? v.modChart?.bars : []).map((b, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "flex": "1",
        "display": "flex",
        "flexDirection": "column",
        "alignItems": "center"
      }
    }, React.createElement("span", {
      style: {
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "9.5px",
        "fontWeight": "700",
        "color": "#3c4858",
        "height": "14px",
        "lineHeight": "14px"
      }
    }, ix(b?.v)), React.createElement("span", {
      style: {
        "display": "flex",
        "alignItems": "flex-end",
        "justifyContent": "center",
        "gap": "2px",
        "height": "70px",
        "width": "100%"
      }
    }, b?.hasB ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: S(b?.barB)
    })) : null, React.createElement("span", {
      style: S(b?.bar)
    })), React.createElement("span", {
      style: {
        "fontSize": "10px",
        "fontWeight": "700",
        "color": "#7d8ea8",
        "height": "14px",
        "lineHeight": "14px",
        "marginTop": "4px"
      }
    }, ix(b?.label)))))))) : null, v.modHasChart2 ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "16px",
        "padding": "14px",
        "background": "rgba(255,255,255,.68)",
        "display": "flex",
        "flexDirection": "column",
        "gap": "10px",
        "flexShrink": "0"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "justifyContent": "space-between"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, ix(v.modChart2?.title)), React.createElement("span", {
      style: {
        "fontSize": "10.5px",
        "color": "#6c7a8c"
      }
    }, ix(v.modChart2?.legend))), React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "6px"
      }
    }, (Array.isArray(v.modChart2?.rows) ? v.modChart2?.rows : []).map((r, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "8px"
      }
    }, React.createElement("span", {
      style: {
        "width": "64px",
        "fontSize": "11px",
        "fontWeight": "700",
        "color": "#3c4858",
        "whiteSpace": "nowrap",
        "overflow": "hidden",
        "textOverflow": "ellipsis"
      }
    }, ix(r?.label)), React.createElement("div", {
      style: {
        "flex": "1",
        "height": "10px",
        "borderRadius": "999px",
        "background": "rgba(125,145,180,.16)",
        "overflow": "hidden",
        "position": "relative"
      }
    }, React.createElement("span", {
      style: S(r?.bar)
    }), r?.marker ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: S(r?.marker)
    })) : null), React.createElement("span", {
      style: S(`width:40px;text-align:right;font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;color:${r?.color ?? ""}`)
    }, ix(r?.v)))))), v.modChart2?.note ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: {
        "fontSize": "10.5px",
        "color": "#6c7a8c"
      }
    }, ix(v.modChart2?.note))) : null)) : null, v.modHasDonut ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "grid",
        "gridTemplateColumns": "1fr 1fr",
        "gap": "8px",
        "flexShrink": "0"
      }
    }, (Array.isArray(v.modDonuts) ? v.modDonuts : []).map((d, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "16px",
        "padding": "14px",
        "background": "rgba(255,255,255,.68)",
        "display": "flex",
        "flexDirection": "column",
        "alignItems": "center",
        "gap": "8px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#7d8ea8",
        "alignSelf": "flex-start"
      }
    }, ix(d?.title)), React.createElement("div", {
      style: {
        "position": "relative",
        "width": "92px",
        "height": "92px"
      }
    }, React.createElement("svg", {
      width: "92",
      height: "92",
      viewBox: "0 0 92 92",
      style: {
        "transform": "rotate(-90deg)"
      }
    }, React.createElement("circle", {
      cx: "46",
      cy: "46",
      r: "38",
      fill: "none",
      stroke: d?.bg,
      strokeWidth: "12"
    }), React.createElement("circle", {
      cx: "46",
      cy: "46",
      r: "38",
      fill: "none",
      stroke: d?.color,
      strokeWidth: "12",
      strokeDasharray: d?.dash
    })), React.createElement("div", {
      style: {
        "position": "absolute",
        "inset": "0",
        "display": "grid",
        "placeItems": "center",
        "textAlign": "center"
      }
    }, React.createElement("div", null, React.createElement("div", {
      style: {
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "17px",
        "fontWeight": "600",
        "lineHeight": "1"
      }
    }, ix(d?.v)), React.createElement("div", {
      style: {
        "fontSize": "9px",
        "color": "#7d8ea8",
        "fontWeight": "700"
      }
    }, ix(d?.unit))))), React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "3px",
        "width": "100%",
        "fontSize": "11px"
      }
    }, (Array.isArray(d?.legend) ? d?.legend : []).map((l, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("span", {
      style: {
        "display": "flex",
        "justifyContent": "space-between"
      }
    }, React.createElement("span", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "5px",
        "color": "#3c4858"
      }
    }, React.createElement("span", {
      style: S(`width:8px;height:8px;border-radius:2px;background:${l?.c ?? ""}`)
    }), ix(l?.label)), React.createElement("b", {
      style: {
        "fontFamily": "'IBM Plex Mono',monospace"
      }
    }, ix(l?.v))))))))))) : null, v.modHasForm ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.92)",
        "borderRadius": "18px",
        "padding": "14px",
        "background": "rgba(255,255,255,.72)",
        "display": "flex",
        "flexDirection": "column",
        "gap": "11px"
      }
    }, v.modForm?.title ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, ix(v.modForm?.title))) : null, (Array.isArray(v.modForm?.fields) ? v.modForm?.fields : []).map((f, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "5px"
      }
    }, React.createElement("span", {
      style: {
        "display": "flex",
        "justifyContent": "space-between",
        "fontSize": "10px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, React.createElement("span", null, ix(f?.label)), f?.hint ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: {
        "fontWeight": "600",
        "letterSpacing": "0",
        "textTransform": "none",
        "color": "#6c7a8c"
      }
    }, ix(f?.hint))) : null), f?.isChips ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "6px",
        "flexWrap": "wrap"
      }
    }, (Array.isArray(f?.chips) ? f?.chips : []).map((c, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: c?.go,
      style: S(c?.style)
    }, ix(c?.label)))))) : null, f?.isInput ? React.createElement(React.Fragment, null, React.createElement("input", {
      value: vx(f?.v),
      onChange: f?.set,
      placeholder: f?.ph,
      style: S(f?.style)
    })) : null, f?.isToggle ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px"
      }
    }, React.createElement("span", {
      style: {
        "flex": "1",
        "fontSize": "12.5px",
        "color": "#3c4858"
      }
    }, ix(f?.sub)), React.createElement("button", {
      onClick: f?.go,
      style: S(f?.track)
    }, React.createElement("span", {
      style: S(f?.knob)
    })))) : null))), React.createElement("button", {
      onClick: v.modForm?.submit,
      style: {
        "border": "0",
        "borderRadius": "12px",
        "padding": "13px",
        "background": "linear-gradient(140deg,#6a52d4,#0072a3)",
        "color": "#fff",
        "fontSize": "13.5px",
        "fontWeight": "700",
        "cursor": "pointer",
        "boxShadow": "0 10px 24px rgba(106,82,212,.3)"
      }
    }, ix(v.modForm?.cta)))) : null, v.modHasRows ? React.createElement(React.Fragment, null, v.modRowsTitle ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "justifyContent": "space-between"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, ix(v.modRowsTitle)), React.createElement("span", {
      style: {
        "fontSize": "11px",
        "color": "#6c7a8c"
      }
    }, ix(v.modRowsCount)))) : null, React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "8px"
      }
    }, (Array.isArray(v.modRows) ? v.modRows : []).map((r, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: S(r?.cardStyle)
    }, React.createElement("div", {
      onClick: r?.go,
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px",
        "cursor": "pointer"
      }
    }, r?.av ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: S(r?.avStyle)
    }, ix(r?.av))) : null, React.createElement("span", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("span", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "6px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "13.5px",
        "fontWeight": "700",
        "whiteSpace": "nowrap",
        "overflow": "hidden",
        "textOverflow": "ellipsis"
      }
    }, ix(r?.title)), r?.tag ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: S(r?.tagStyle)
    }, ix(r?.tag))) : null), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "11px",
        "color": "#6c7a8c",
        "whiteSpace": "nowrap",
        "overflow": "hidden",
        "textOverflow": "ellipsis"
      }
    }, ix(r?.sub))), r?.value ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: {
        "textAlign": "right",
        "flexShrink": "0"
      }
    }, React.createElement("span", {
      style: S(`display:block;font-family:'IBM Plex Mono',monospace;font-size:15px;font-weight:600;line-height:1;color:${r?.valueColor ?? ""}`)
    }, ix(r?.value)), r?.valueSub ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "10px",
        "color": "#7d8ea8",
        "marginTop": "2px"
      }
    }, ix(r?.valueSub))) : null)) : null, r?.status ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: S(r?.statusStyle)
    }, ix(r?.status))) : null, r?.chevron ? React.createElement(React.Fragment, null, React.createElement("svg", {
      width: "16",
      height: "16",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "#9aa6b4",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M9 6l6 6-6 6"
    }))) : null), r?.hasSegs ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "flex",
        "height": "6px",
        "borderRadius": "999px",
        "overflow": "hidden",
        "background": "rgba(125,145,180,.18)",
        "marginTop": "9px"
      }
    }, (Array.isArray(r?.segs) ? r?.segs : []).map((sg, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("span", {
      style: S(sg)
    }))))) : null, r?.body ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "fontSize": "12px",
        "color": "#3c4858",
        "lineHeight": "1.45",
        "marginTop": "8px",
        "textWrap": "pretty"
      }
    }, ix(r?.body))) : null, r?.hasActions ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "6px",
        "marginTop": "9px"
      }
    }, (Array.isArray(r?.actions) ? r?.actions : []).map((a, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: a?.go,
      style: S(a?.style)
    }, ix(a?.label)))))) : null))))) : null))) : null;
  }
  function Screen_sAppAccess(v) {
    return v.sAppAccess ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "flex": "1",
        "minHeight": "0",
        "display": "flex",
        "flexDirection": "column",
        "animation": "pop .3s ease backwards"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px",
        "padding": "12px 16px 0",
        "flexShrink": "0"
      }
    }, React.createElement("button", {
      onClick: v.openDrawer,
      style: {
        "width": "38px",
        "height": "38px",
        "borderRadius": "11px",
        "border": "1px solid rgba(255,255,255,.9)",
        "background": "rgba(255,255,255,.6)",
        "display": "grid",
        "placeItems": "center",
        "color": "#3c4858",
        "cursor": "pointer",
        "flexShrink": "0"
      }
    }, React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round"
    }, React.createElement("path", {
      d: "M4 7h16M4 12h16M4 17h10"
    }))), React.createElement("div", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "17px",
        "fontWeight": "800",
        "letterSpacing": "-.2px"
      }
    }, "Nurse App access"), React.createElement("div", {
      style: {
        "fontSize": "12px",
        "color": "#6c7a8c"
      }
    }, "What each role can open on the phone")), v.aaDirty ? React.createElement(React.Fragment, null, React.createElement("button", {
      onClick: v.aaPublish,
      style: {
        "border": "0",
        "borderRadius": "11px",
        "padding": "10px 14px",
        "background": "linear-gradient(140deg,#2bb673,#1d8f57)",
        "color": "#fff",
        "fontSize": "12.5px",
        "fontWeight": "700",
        "cursor": "pointer",
        "boxShadow": "0 8px 20px rgba(43,182,115,.3)",
        "whiteSpace": "nowrap"
      }
    }, "Publish")) : null), React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "6px",
        "overflowX": "auto",
        "padding": "10px 16px 0",
        "scrollbarWidth": "none",
        "flexShrink": "0"
      }
    }, (Array.isArray(v.aaTabs) ? v.aaTabs : []).map((t, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: t?.go,
      style: S(t?.style)
    }, ix(t?.label))))), v.aaToast ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "margin": "10px 16px 0",
        "display": "flex",
        "alignItems": "center",
        "gap": "8px",
        "borderRadius": "12px",
        "padding": "10px 12px",
        "background": "rgba(43,182,115,.13)",
        "color": "#1d8f57",
        "fontSize": "12.5px",
        "fontWeight": "700",
        "flexShrink": "0",
        "animation": "pop .25s ease"
      }
    }, React.createElement("svg", {
      width: "15",
      height: "15",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.4",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M20 6L9 17l-5-5"
    })), ix(v.aaToast))) : null, React.createElement("div", {
      style: {
        "flex": "1",
        "minHeight": "0",
        "overflow": "auto",
        "padding": "12px 16px 20px",
        "display": "flex",
        "flexDirection": "column",
        "gap": "12px"
      }
    }, v.aaTabFeatures ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "flex-start",
        "gap": "10px",
        "borderRadius": "14px",
        "padding": "11px 13px",
        "background": "rgba(0,144,202,.08)",
        "border": "1px solid rgba(0,144,202,.2)",
        "fontSize": "12px",
        "lineHeight": "1.5"
      }
    }, React.createElement("svg", {
      width: "15",
      height: "15",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "#0072a3",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      style: {
        "flexShrink": "0",
        "marginTop": "2px"
      }
    }, React.createElement("circle", {
      cx: "12",
      cy: "12",
      r: "9"
    }), React.createElement("path", {
      d: "M12 16v-4M12 8h.01"
    })), "Tap a cell to allow or block a feature for a role. Changes reach every phone within 15 s of publishing. Department and user overrides sit on top of this."), React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "16px",
        "background": "rgba(255,255,255,.68)",
        "overflow": "hidden",
        "flexShrink": "0"
      }
    }, React.createElement("div", {
      style: S(v.aaHeadStyle)
    }, React.createElement("span", null, "Feature"), (Array.isArray(v.aaRoleHeads) ? v.aaRoleHeads : []).map((h, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("span", {
      style: {
        "textAlign": "center",
        "lineHeight": "1.2",
        "letterSpacing": "0",
        "fontSize": "8.5px",
        "overflow": "hidden",
        "whiteSpace": "nowrap"
      }
    }, ix(h))))), (Array.isArray(v.aaGroups) ? v.aaGroups : []).map((g, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "padding": "8px 12px 2px",
        "fontSize": "9.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#7d8ea8",
        "background": "rgba(125,145,180,.07)",
        "borderTop": "1px solid rgba(125,145,180,.12)"
      }
    }, ix(g?.sec)), (Array.isArray(g?.rows) ? g?.rows : []).map((f, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: S(v.aaRowStyle)
    }, React.createElement("span", {
      style: {
        "minWidth": "0"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "12.5px",
        "fontWeight": "700",
        "whiteSpace": "nowrap",
        "overflow": "hidden",
        "textOverflow": "ellipsis"
      }
    }, ix(f?.label)), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "10px",
        "color": "#7d8ea8",
        "whiteSpace": "nowrap",
        "overflow": "hidden",
        "textOverflow": "ellipsis"
      }
    }, ix(f?.sub))), (Array.isArray(f?.cells) ? f?.cells : []).map((c, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: c?.go,
      title: c?.tip,
      style: S(c?.style)
    }, c?.on ? React.createElement(React.Fragment, null, React.createElement("svg", {
      width: "13",
      height: "13",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "#fff",
      strokeWidth: "3",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M20 6L9 17l-5-5"
    }))) : null, c?.off ? React.createElement(React.Fragment, null, React.createElement("svg", {
      width: "11",
      height: "11",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "#9aa6b4",
      strokeWidth: "3",
      strokeLinecap: "round"
    }, React.createElement("path", {
      d: "M6 6l12 12M18 6L6 18"
    }))) : null)))))))))) : null, v.aaTabDepts ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "6px",
        "overflowX": "auto",
        "paddingBottom": "2px",
        "scrollbarWidth": "none",
        "flexShrink": "0"
      }
    }, (Array.isArray(v.aaDeptChips) ? v.aaDeptChips : []).map((d, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: d?.go,
      style: S(d?.style)
    }, ix(d?.label))))), React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px",
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "14px",
        "padding": "11px 13px",
        "background": "rgba(255,255,255,.66)"
      }
    }, React.createElement("span", {
      style: {
        "flex": "1"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "13px",
        "fontWeight": "700"
      }
    }, ix(v.aaDeptName)), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "11px",
        "color": "#6c7a8c"
      }
    }, ix(v.aaDeptOverrideCount))), React.createElement("button", {
      onClick: v.aaDeptReset,
      style: {
        "border": "1px solid rgba(125,145,180,.35)",
        "borderRadius": "9px",
        "padding": "7px 11px",
        "background": "rgba(255,255,255,.7)",
        "color": "#16202e",
        "fontSize": "11.5px",
        "fontWeight": "700",
        "cursor": "pointer"
      }
    }, "Reset to role defaults")), React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "16px",
        "background": "rgba(255,255,255,.68)",
        "overflow": "hidden",
        "flexShrink": "0"
      }
    }, (Array.isArray(v.aaDeptRows) ? v.aaDeptRows : []).map((f, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px",
        "padding": "10px 14px",
        "borderTop": "1px solid rgba(125,145,180,.12)"
      }
    }, React.createElement("span", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "13px",
        "fontWeight": "600"
      }
    }, ix(f?.label)), React.createElement("span", {
      style: S(`display:block;font-size:10.5px;color:${f?.stateColor ?? ""}`)
    }, ix(f?.stateLabel))), React.createElement("div", {
      style: {
        "display": "inline-flex",
        "background": "rgba(125,145,180,.12)",
        "borderRadius": "9px",
        "padding": "2px",
        "gap": "2px"
      }
    }, (Array.isArray(f?.opts) ? f?.opts : []).map((o, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: o?.go,
      style: S(o?.style)
    }, ix(o?.label)))))))))) : null, v.aaTabCustom ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "8px"
      }
    }, (Array.isArray(v.customMods) ? v.customMods : []).map((c, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "15px",
        "padding": "12px 13px",
        "background": "rgba(255,255,255,.66)",
        "display": "flex",
        "flexDirection": "column",
        "gap": "8px"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px"
      }
    }, React.createElement("span", {
      style: S(c?.avStyle)
    }, React.createElement("svg", {
      width: "17",
      height: "17",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: c?.d
    }))), React.createElement("span", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "13.5px",
        "fontWeight": "800"
      }
    }, ix(c?.name)), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "11px",
        "color": "#6c7a8c"
      }
    }, ix(c?.meta))), React.createElement("button", {
      onClick: c?.toggle,
      style: S(c?.track)
    }, React.createElement("span", {
      style: S(c?.knob)
    }))), React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "5px",
        "flexWrap": "wrap"
      }
    }, (Array.isArray(c?.fieldChips) ? c?.fieldChips : []).map((f, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("span", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "600",
        "padding": "3px 8px",
        "borderRadius": "999px",
        "color": "#3c4858",
        "background": "rgba(125,145,180,.14)"
      }
    }, ix(f))))), React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "6px"
      }
    }, React.createElement("button", {
      onClick: c?.edit,
      style: {
        "flex": "1",
        "border": "1px solid rgba(125,145,180,.35)",
        "borderRadius": "10px",
        "padding": "9px",
        "background": "rgba(255,255,255,.7)",
        "color": "#16202e",
        "fontSize": "12px",
        "fontWeight": "700",
        "cursor": "pointer"
      }
    }, "Edit"), React.createElement("button", {
      onClick: c?.preview,
      style: {
        "flex": "1",
        "border": "1px solid rgba(0,144,202,.3)",
        "borderRadius": "10px",
        "padding": "9px",
        "background": "rgba(0,144,202,.08)",
        "color": "#0072a3",
        "fontSize": "12px",
        "fontWeight": "700",
        "cursor": "pointer"
      }
    }, "Preview on phone"), React.createElement("button", {
      onClick: c?.remove,
      style: {
        "border": "1px solid rgba(210,58,82,.4)",
        "borderRadius": "10px",
        "padding": "9px 12px",
        "background": "rgba(210,58,82,.08)",
        "color": "#b32e2e",
        "fontSize": "12px",
        "fontWeight": "700",
        "cursor": "pointer"
      }
    }, "Delete")))))), React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.92)",
        "borderRadius": "18px",
        "padding": "14px",
        "background": "rgba(255,255,255,.72)",
        "display": "flex",
        "flexDirection": "column",
        "gap": "11px"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, ix(v.cmTitle)), React.createElement("input", {
      value: vx(v.cm?.name),
      onChange: v.cmSetName,
      placeholder: "Module name, e.g. Crash cart checklist",
      style: {
        "border": "1px solid rgba(125,145,180,.3)",
        "borderRadius": "10px",
        "padding": "11px 12px",
        "fontSize": "14px",
        "fontWeight": "700",
        "background": "rgba(255,255,255,.85)",
        "outline": "none"
      }
    }), React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "5px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Type"), React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "6px",
        "flexWrap": "wrap"
      }
    }, (Array.isArray(v.cmTypes) ? v.cmTypes : []).map((t, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: t?.go,
      style: S(t?.style)
    }, ix(t?.label)))))), React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "5px"
      }
    }, React.createElement("span", {
      style: {
        "display": "flex",
        "justifyContent": "space-between",
        "fontSize": "10px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, React.createElement("span", null, "Fields"), React.createElement("span", {
      style: {
        "fontWeight": "600",
        "letterSpacing": "0",
        "textTransform": "none",
        "color": "#6c7a8c"
      }
    }, ix(v.cmFieldCount))), React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "5px",
        "flexWrap": "wrap"
      }
    }, (Array.isArray(v.cmFields) ? v.cmFields : []).map((f, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: f?.remove,
      style: {
        "display": "inline-flex",
        "alignItems": "center",
        "gap": "5px",
        "fontSize": "11px",
        "fontWeight": "600",
        "padding": "5px 9px",
        "borderRadius": "999px",
        "color": "#16202e",
        "background": "rgba(125,145,180,.14)",
        "border": "0",
        "cursor": "pointer"
      }
    }, ix(f?.label), React.createElement("svg", {
      width: "10",
      height: "10",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "#7d8ea8",
      strokeWidth: "3",
      strokeLinecap: "round"
    }, React.createElement("path", {
      d: "M6 6l12 12M18 6L6 18"
    })))))), React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "6px"
      }
    }, React.createElement("input", {
      value: vx(v.cm?.fieldDraft),
      onChange: v.cmSetFieldDraft,
      onKeyDown: v.cmFieldKey,
      placeholder: "Add a field, e.g. Defibrillator checked",
      style: {
        "flex": "1",
        "minWidth": "0",
        "border": "1px solid rgba(125,145,180,.3)",
        "borderRadius": "10px",
        "padding": "9px 12px",
        "fontSize": "13px",
        "background": "rgba(255,255,255,.85)",
        "outline": "none"
      }
    }), React.createElement("button", {
      onClick: v.cmAddField,
      style: {
        "width": "38px",
        "height": "38px",
        "borderRadius": "10px",
        "border": "1px solid rgba(0,144,202,.3)",
        "background": "rgba(0,144,202,.08)",
        "color": "#0072a3",
        "display": "grid",
        "placeItems": "center",
        "cursor": "pointer",
        "flexShrink": "0"
      }
    }, React.createElement("svg", {
      width: "15",
      height: "15",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.4",
      strokeLinecap: "round"
    }, React.createElement("path", {
      d: "M12 5v14M5 12h14"
    }))))), React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "5px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Who sees it"), React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "6px",
        "flexWrap": "wrap"
      }
    }, (Array.isArray(v.cmRoles) ? v.cmRoles : []).map((r, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: r?.go,
      style: S(r?.style)
    }, ix(r?.label)))))), React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "5px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Departments"), React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "6px",
        "flexWrap": "wrap"
      }
    }, (Array.isArray(v.cmDepts) ? v.cmDepts : []).map((d, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: d?.go,
      style: S(d?.style)
    }, ix(d?.label)))))), React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "5px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Schedule"), React.createElement("div", {
      style: {
        "display": "inline-flex",
        "background": "rgba(255,255,255,.55)",
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "11px",
        "padding": "3px",
        "gap": "3px",
        "alignSelf": "flex-start"
      }
    }, (Array.isArray(v.cmSched) ? v.cmSched : []).map((o, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: o?.go,
      style: S(o?.style)
    }, ix(o?.label)))))), React.createElement("button", {
      onClick: v.cmSave,
      style: S(v.cmSaveStyle)
    }, ix(v.cmSaveLabel)))) : null, v.aaTabPreview ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "inline-flex",
        "background": "rgba(255,255,255,.55)",
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "11px",
        "padding": "3px",
        "gap": "3px",
        "alignSelf": "flex-start"
      }
    }, (Array.isArray(v.pvRoles) ? v.pvRoles : []).map((r, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: r?.go,
      style: S(r?.style)
    }, ix(r?.label))))), React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "6px",
        "overflowX": "auto",
        "paddingBottom": "2px",
        "scrollbarWidth": "none",
        "flexShrink": "0"
      }
    }, (Array.isArray(v.pvDeptChips) ? v.pvDeptChips : []).map((d, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: d?.go,
      style: S(d?.style)
    }, ix(d?.label))))), React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.92)",
        "borderRadius": "18px",
        "padding": "14px",
        "background": "rgba(255,255,255,.72)",
        "display": "flex",
        "flexDirection": "column",
        "gap": "10px"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px"
      }
    }, React.createElement("span", {
      style: {
        "display": "grid",
        "placeItems": "center",
        "width": "40px",
        "height": "40px",
        "borderRadius": "12px",
        "color": "#fff",
        "fontSize": "12px",
        "fontWeight": "700",
        "background": "linear-gradient(135deg,#3ab5a7,#0090ca)"
      }
    }, ix(v.pvIni)), React.createElement("span", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "13.5px",
        "fontWeight": "800"
      }
    }, ix(v.pvTitle)), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "11px",
        "color": "#6c7a8c"
      }
    }, ix(v.pvSub))), React.createElement("a", {
      href: "Nurse App (Android).dc.html",
      style: {
        "fontSize": "11.5px",
        "fontWeight": "700",
        "textDecoration": "none",
        "color": "#0072a3",
        "whiteSpace": "nowrap"
      }
    }, "Open app →")), React.createElement("div", {
      style: {
        "fontSize": "10px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Bottom bar"), React.createElement("div", {
      style: {
        "display": "grid",
        "gridTemplateColumns": "repeat(5,1fr)",
        "gap": "4px",
        "padding": "6px",
        "borderRadius": "12px",
        "background": "rgba(255,255,255,.8)",
        "border": "1px solid rgba(255,255,255,.95)"
      }
    }, (Array.isArray(v.pvNav) ? v.pvNav : []).map((n, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("span", {
      style: S(n?.style)
    }, React.createElement("svg", {
      width: "16",
      height: "16",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: n?.d
    })), React.createElement("span", {
      style: {
        "fontSize": "9.5px",
        "fontWeight": "700"
      }
    }, ix(n?.label)))))), React.createElement("div", {
      style: {
        "fontSize": "10px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Can open"), React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "5px",
        "flexWrap": "wrap"
      }
    }, (Array.isArray(v.pvAllowed) ? v.pvAllowed : []).map((f, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("span", {
      style: {
        "fontSize": "11px",
        "fontWeight": "700",
        "padding": "5px 9px",
        "borderRadius": "999px",
        "color": "#1d8f57",
        "background": "rgba(43,182,115,.13)"
      }
    }, ix(f))))), v.pvHasBlocked ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "fontSize": "10px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Hidden"), React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "5px",
        "flexWrap": "wrap"
      }
    }, (Array.isArray(v.pvBlocked) ? v.pvBlocked : []).map((f, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("span", {
      style: {
        "fontSize": "11px",
        "fontWeight": "700",
        "padding": "5px 9px",
        "borderRadius": "999px",
        "color": "#7d8ea8",
        "background": "rgba(125,145,180,.14)",
        "textDecoration": "line-through"
      }
    }, ix(f)))))) : null)) : null))) : null;
  }
  function Screen_sMedDetail(v) {
    return v.sMedDetail ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "flex": "1",
        "minHeight": "0",
        "display": "flex",
        "flexDirection": "column",
        "animation": "pop .3s ease backwards"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px",
        "padding": "10px 12px 0",
        "flexShrink": "0"
      }
    }, React.createElement("button", {
      onClick: v.backToFormulary,
      style: {
        "width": "38px",
        "height": "38px",
        "borderRadius": "11px",
        "border": "1px solid rgba(255,255,255,.9)",
        "background": "rgba(255,255,255,.6)",
        "display": "grid",
        "placeItems": "center",
        "color": "#3c4858",
        "cursor": "pointer"
      }
    }, React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M15 6l-6 6 6 6"
    }))), React.createElement("span", {
      style: {
        "flex": "1"
      }
    }), React.createElement("button", {
      onClick: v.amToggleAlert,
      style: S(v.amAlertBtn)
    }, ix(v.amAlertLabel)), React.createElement("button", {
      onClick: v.amToggleEdit,
      style: S(v.amEditBtn)
    }, ix(v.amEditLabel))), v.amToast ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "margin": "10px 16px 0",
        "display": "flex",
        "alignItems": "center",
        "gap": "8px",
        "borderRadius": "12px",
        "padding": "10px 12px",
        "background": "rgba(43,182,115,.13)",
        "color": "#1d8f57",
        "fontSize": "12.5px",
        "fontWeight": "700",
        "flexShrink": "0",
        "animation": "pop .25s ease"
      }
    }, React.createElement("svg", {
      width: "15",
      height: "15",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.4",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M20 6L9 17l-5-5"
    })), ix(v.amToast))) : null, React.createElement("div", {
      style: {
        "flex": "1",
        "minHeight": "0",
        "overflow": "auto",
        "padding": "12px 16px 20px",
        "display": "flex",
        "flexDirection": "column",
        "gap": "12px"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "14px",
        "alignItems": "center"
      }
    }, React.createElement("span", {
      style: S(v.am?.imgStyle)
    }), React.createElement("div", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "8px",
        "flexWrap": "wrap"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "21px",
        "fontWeight": "800",
        "letterSpacing": "-.4px"
      }
    }, ix(v.am?.brand)), React.createElement("span", {
      style: {
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "12px",
        "color": "#0072a3",
        "fontWeight": "700"
      }
    }, ix(v.am?.strength))), React.createElement("div", {
      style: {
        "fontSize": "13px",
        "color": "#3c4858",
        "fontWeight": "600"
      }
    }, ix(v.am?.generic)), React.createElement("div", {
      style: {
        "fontSize": "11.5px",
        "color": "#6c7a8c",
        "marginTop": "2px"
      }
    }, ix(v.am?.cls)), React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "6px",
        "marginTop": "7px",
        "flexWrap": "wrap"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10px",
        "fontWeight": "700",
        "padding": "3px 8px",
        "borderRadius": "6px",
        "color": "#0072a3",
        "background": "rgba(0,144,202,.12)"
      }
    }, ix(v.am?.route)), React.createElement("span", {
      style: {
        "fontSize": "10px",
        "fontWeight": "700",
        "padding": "3px 8px",
        "borderRadius": "6px",
        "color": "#3c4858",
        "background": "rgba(125,145,180,.16)"
      }
    }, ix(v.am?.cat)), v.am?.alert ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: {
        "fontSize": "10px",
        "fontWeight": "800",
        "letterSpacing": ".4px",
        "padding": "3px 8px",
        "borderRadius": "6px",
        "color": "#b32e2e",
        "background": "rgba(214,69,69,.12)"
      }
    }, "HIGH ALERT")) : null))), React.createElement("div", {
      style: {
        "display": "grid",
        "gridTemplateColumns": "repeat(3,1fr)",
        "gap": "8px"
      }
    }, React.createElement("div", {
      style: {
        "borderRadius": "13px",
        "padding": "10px 11px",
        "background": "rgba(255,255,255,.68)",
        "border": "1px solid rgba(255,255,255,.9)"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "9.5px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Max daily"), React.createElement("div", {
      style: {
        "fontSize": "12.5px",
        "fontWeight": "700",
        "marginTop": "3px",
        "fontFamily": "'IBM Plex Mono',monospace"
      }
    }, ix(v.am?.maxDose))), React.createElement("div", {
      style: {
        "borderRadius": "13px",
        "padding": "10px 11px",
        "background": "rgba(255,255,255,.68)",
        "border": "1px solid rgba(255,255,255,.9)"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "9.5px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Food"), React.createElement("div", {
      style: {
        "fontSize": "12.5px",
        "fontWeight": "700",
        "marginTop": "3px"
      }
    }, ix(v.am?.food))), React.createElement("div", {
      style: {
        "borderRadius": "13px",
        "padding": "10px 11px",
        "background": "rgba(255,255,255,.68)",
        "border": "1px solid rgba(255,255,255,.9)"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "9.5px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Pregnancy"), React.createElement("div", {
      style: S(`font-size:12.5px;font-weight:700;margin-top:3px;color:${v.am?.pregColor ?? ""}`)
    }, ix(v.am?.preg)))), React.createElement("div", {
      style: {
        "display": "grid",
        "gridTemplateColumns": "repeat(3,1fr)",
        "gap": "8px"
      }
    }, React.createElement("div", {
      style: {
        "borderRadius": "13px",
        "padding": "10px 11px",
        "background": "rgba(255,255,255,.68)",
        "border": "1px solid rgba(255,255,255,.9)"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "9.5px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Unit price"), React.createElement("div", {
      style: {
        "fontSize": "12.5px",
        "fontWeight": "700",
        "marginTop": "3px",
        "fontFamily": "'IBM Plex Mono',monospace"
      }
    }, ix(v.am?.price))), React.createElement("div", {
      style: {
        "borderRadius": "13px",
        "padding": "10px 11px",
        "background": "rgba(255,255,255,.68)",
        "border": "1px solid rgba(255,255,255,.9)",
        "gridColumn": "span 2"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "9.5px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Manufacturer"), React.createElement("div", {
      style: {
        "fontSize": "12.5px",
        "fontWeight": "700",
        "marginTop": "3px",
        "whiteSpace": "nowrap",
        "overflow": "hidden",
        "textOverflow": "ellipsis"
      }
    }, ix(v.am?.mfr)))), React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "flex-start",
        "gap": "10px",
        "borderRadius": "15px",
        "padding": "12px 14px",
        "background": "linear-gradient(140deg,rgba(58,181,167,.18),rgba(255,255,255,.7))",
        "border": "1px solid rgba(58,181,167,.3)"
      }
    }, React.createElement("span", {
      style: {
        "display": "grid",
        "placeItems": "center",
        "width": "30px",
        "height": "30px",
        "borderRadius": "9px",
        "background": "rgba(58,181,167,.22)",
        "color": "#1e8a7c",
        "flexShrink": "0"
      }
    }, React.createElement("svg", {
      width: "15",
      height: "15",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M12 2v20M2 12h20"
    }))), React.createElement("div", {
      style: {
        "minWidth": "0",
        "flex": "1"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#1e8a7c"
      }
    }, "Nursing points"), v.amEditing ? React.createElement(React.Fragment, null, React.createElement("textarea", {
      value: vx(v.am?.nursing),
      onChange: v.amSetNursing,
      rows: "3",
      style: {
        "width": "100%",
        "boxSizing": "border-box",
        "marginTop": "4px",
        "border": "1px solid rgba(58,181,167,.4)",
        "borderRadius": "9px",
        "padding": "8px 10px",
        "fontSize": "13px",
        "background": "#fff",
        "outline": "none",
        "resize": "none",
        "lineHeight": "1.5"
      }
    })) : null, v.amReadOnly ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "fontSize": "13px",
        "lineHeight": "1.5",
        "marginTop": "3px",
        "textWrap": "pretty"
      }
    }, ix(v.am?.nursing))) : null)), React.createElement("div", {
      style: {
        "display": "grid",
        "gridTemplateColumns": "repeat(4,1fr)",
        "background": "rgba(255,255,255,.55)",
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "11px",
        "padding": "3px",
        "gap": "3px",
        "position": "sticky",
        "top": "0",
        "zIndex": "2",
        "backdropFilter": "blur(12px)",
        "WebkitBackdropFilter": "blur(12px)"
      }
    }, (Array.isArray(v.amTabs) ? v.amTabs : []).map((t, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: t?.go,
      style: S(t?.style)
    }, ix(t?.label))))), (Array.isArray(v.amSections) ? v.amSections : []).map((s, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "15px",
        "padding": "13px 14px",
        "background": "rgba(255,255,255,.68)"
      }
    }, React.createElement("div", {
      style: S(`display:flex;align-items:center;gap:7px;font-size:10.5px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:${s?.color ?? ""}`)
    }, React.createElement("span", {
      style: S(`width:6px;height:6px;border-radius:50%;background:${s?.color ?? ""}`)
    }), ix(s?.label), s?.custom ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: {
        "marginLeft": "auto",
        "fontSize": "9px",
        "fontWeight": "800",
        "letterSpacing": ".5px",
        "padding": "2px 6px",
        "borderRadius": "5px",
        "color": "#6a52d4",
        "background": "rgba(106,82,212,.13)"
      }
    }, "EDITED")) : null), v.amEditing ? React.createElement(React.Fragment, null, React.createElement("textarea", {
      value: vx(s?.text),
      onChange: s?.set,
      rows: "4",
      style: {
        "width": "100%",
        "boxSizing": "border-box",
        "marginTop": "6px",
        "border": "1px solid rgba(125,145,180,.35)",
        "borderRadius": "9px",
        "padding": "8px 10px",
        "fontSize": "13px",
        "background": "#fff",
        "outline": "none",
        "resize": "vertical",
        "lineHeight": "1.55"
      }
    })) : null, v.amReadOnly ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "fontSize": "13px",
        "color": "#16202e",
        "lineHeight": "1.55",
        "marginTop": "6px",
        "textWrap": "pretty",
        "whiteSpace": "pre-line"
      }
    }, ix(s?.text))) : null))), v.amTabMore ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "16px",
        "background": "rgba(255,255,255,.68)",
        "overflow": "hidden",
        "flexShrink": "0"
      }
    }, React.createElement("div", {
      style: {
        "padding": "12px 14px 4px",
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".7px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Formulary settings"), (Array.isArray(v.amSettings) ? v.amSettings : []).map((o, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "12px",
        "padding": "11px 14px",
        "borderTop": "1px solid rgba(125,145,180,.12)"
      }
    }, React.createElement("span", {
      style: {
        "flex": "1"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "13px",
        "fontWeight": "600"
      }
    }, ix(o?.label)), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "11px",
        "color": "#6c7a8c"
      }
    }, ix(o?.sub))), o?.isToggle ? React.createElement(React.Fragment, null, React.createElement("button", {
      onClick: o?.go,
      style: S(o?.track)
    }, React.createElement("span", {
      style: S(o?.knob)
    }))) : null, o?.isValue ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: {
        "fontSize": "12.5px",
        "fontWeight": "700",
        "color": "#0072a3"
      }
    }, ix(o?.value))) : null)))), React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "6px"
      }
    }, React.createElement("button", {
      onClick: v.amShare,
      style: {
        "flex": "1",
        "border": "1px solid rgba(125,145,180,.35)",
        "borderRadius": "12px",
        "padding": "12px",
        "background": "rgba(255,255,255,.7)",
        "color": "#16202e",
        "fontSize": "13px",
        "fontWeight": "700",
        "cursor": "pointer"
      }
    }, "Broadcast update to wards"), React.createElement("button", {
      onClick: v.amRemove,
      style: {
        "border": "1px solid rgba(210,58,82,.4)",
        "borderRadius": "12px",
        "padding": "12px 14px",
        "background": "rgba(210,58,82,.08)",
        "color": "#b32e2e",
        "fontSize": "13px",
        "fontWeight": "700",
        "cursor": "pointer"
      }
    }, "Remove"))) : null, v.amEditing ? React.createElement(React.Fragment, null, React.createElement("button", {
      onClick: v.amSave,
      style: {
        "border": "0",
        "borderRadius": "13px",
        "padding": "14px",
        "background": "linear-gradient(140deg,#2bb673,#1d8f57)",
        "color": "#fff",
        "fontSize": "14px",
        "fontWeight": "700",
        "cursor": "pointer",
        "boxShadow": "0 10px 24px rgba(43,182,115,.3)"
      }
    }, "Save monograph · publish to Nurse App")) : null, React.createElement("div", {
      style: {
        "fontSize": "10.5px",
        "color": "#7d8ea8",
        "textAlign": "center",
        "padding": "4px 10px",
        "lineHeight": "1.5"
      }
    }, "Same monograph nurses see in the app. Edits are versioned and recorded in the activity log.")))) : null;
  }
  function Screen_sBroadcast(v) {
    return v.sBroadcast ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "flex": "1",
        "minHeight": "0",
        "overflow": "auto",
        "padding": "12px 16px 20px",
        "display": "flex",
        "flexDirection": "column",
        "gap": "12px",
        "animation": "pop .3s ease backwards"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px"
      }
    }, React.createElement("button", {
      onClick: v.openDrawer,
      style: {
        "width": "38px",
        "height": "38px",
        "borderRadius": "11px",
        "border": "1px solid rgba(255,255,255,.9)",
        "background": "rgba(255,255,255,.6)",
        "display": "grid",
        "placeItems": "center",
        "color": "#3c4858",
        "cursor": "pointer",
        "flexShrink": "0"
      }
    }, React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round"
    }, React.createElement("path", {
      d: "M4 7h16M4 12h16M4 17h10"
    }))), React.createElement("div", {
      style: {
        "flex": "1"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "17px",
        "fontWeight": "800",
        "letterSpacing": "-.2px"
      }
    }, "Broadcast"), React.createElement("div", {
      style: {
        "fontSize": "12px",
        "color": "#6c7a8c"
      }
    }, "Announcement to every Nurse App"))), v.bcSent ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "border": "1px solid rgba(43,182,115,.35)",
        "borderRadius": "18px",
        "padding": "26px 18px",
        "background": "rgba(255,255,255,.75)",
        "textAlign": "center",
        "display": "flex",
        "flexDirection": "column",
        "alignItems": "center",
        "gap": "10px"
      }
    }, React.createElement("span", {
      style: {
        "display": "grid",
        "placeItems": "center",
        "width": "56px",
        "height": "56px",
        "borderRadius": "50%",
        "background": "rgba(43,182,115,.15)",
        "color": "#1d8f57"
      }
    }, React.createElement("svg", {
      width: "28",
      height: "28",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.4",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M20 6L9 17l-5-5"
    }))), React.createElement("div", {
      style: {
        "fontSize": "16px",
        "fontWeight": "800"
      }
    }, "Sent to ", ix(v.bcReach), " staff"), React.createElement("div", {
      style: {
        "fontSize": "12.5px",
        "color": "#6c7a8c"
      }
    }, "Acknowledgements will appear in the activity log."), React.createElement("button", {
      onClick: v.bcReset,
      style: {
        "marginTop": "6px",
        "border": "0",
        "borderRadius": "11px",
        "padding": "11px 18px",
        "background": "linear-gradient(140deg,#0aa0d4,#0072a3)",
        "color": "#fff",
        "fontSize": "13px",
        "fontWeight": "700",
        "cursor": "pointer"
      }
    }, "New broadcast"))) : null, v.bcNotSent ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.92)",
        "borderRadius": "18px",
        "padding": "14px",
        "background": "rgba(255,255,255,.72)",
        "display": "flex",
        "flexDirection": "column",
        "gap": "10px"
      }
    }, React.createElement("input", {
      value: vx(v.bcTitle),
      onChange: v.setBcTitle,
      placeholder: "Title",
      style: {
        "border": "1px solid rgba(125,145,180,.3)",
        "borderRadius": "10px",
        "padding": "11px 12px",
        "fontSize": "15px",
        "fontWeight": "700",
        "background": "rgba(255,255,255,.85)",
        "outline": "none"
      }
    }), React.createElement("textarea", {
      value: vx(v.bcBody),
      onChange: v.setBcBody,
      rows: "5",
      placeholder: "Message",
      style: {
        "border": "1px solid rgba(125,145,180,.3)",
        "borderRadius": "10px",
        "padding": "11px 12px",
        "fontSize": "13.5px",
        "background": "rgba(255,255,255,.85)",
        "outline": "none",
        "resize": "none",
        "lineHeight": "1.5"
      }
    })), React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "6px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Category"), React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "6px",
        "flexWrap": "wrap"
      }
    }, (Array.isArray(v.bcCats) ? v.bcCats : []).map((c, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: c?.go,
      style: S(c?.style)
    }, ix(c?.label)))))), React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "6px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Audience · ", ix(v.bcReach), " people"), React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "6px",
        "flexWrap": "wrap"
      }
    }, (Array.isArray(v.bcAud) ? v.bcAud : []).map((a, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: a?.go,
      style: S(a?.style)
    }, ix(a?.label)))))), React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "16px",
        "background": "rgba(255,255,255,.68)",
        "overflow": "hidden",
        "flexShrink": "0"
      }
    }, (Array.isArray(v.bcOpts) ? v.bcOpts : []).map((o, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "12px",
        "padding": "12px 14px",
        "borderTop": "1px solid rgba(125,145,180,.14)"
      }
    }, React.createElement("span", {
      style: {
        "flex": "1"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "13.5px",
        "fontWeight": "600"
      }
    }, ix(o?.label)), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "11.5px",
        "color": "#6c7a8c"
      }
    }, ix(o?.sub))), React.createElement("button", {
      onClick: o?.go,
      style: S(o?.track)
    }, React.createElement("span", {
      style: S(o?.knob)
    })))))), React.createElement("button", {
      onClick: v.bcSend,
      style: S(v.bcSendStyle)
    }, "Send to ", ix(v.bcReach), " staff")) : null)) : null;
  }
  function Screen_sActivity(v) {
    return v.sActivity ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "flex": "1",
        "minHeight": "0",
        "overflow": "auto",
        "padding": "14px 16px 20px",
        "display": "flex",
        "flexDirection": "column",
        "gap": "12px",
        "animation": "pop .3s ease backwards"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px"
      }
    }, React.createElement("button", {
      onClick: v.openDrawer,
      style: {
        "width": "38px",
        "height": "38px",
        "borderRadius": "11px",
        "border": "1px solid rgba(255,255,255,.9)",
        "background": "rgba(255,255,255,.6)",
        "display": "grid",
        "placeItems": "center",
        "color": "#3c4858",
        "cursor": "pointer",
        "flexShrink": "0"
      }
    }, React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round"
    }, React.createElement("path", {
      d: "M4 7h16M4 12h16M4 17h10"
    }))), React.createElement("div", {
      style: {
        "flex": "1"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "19px",
        "fontWeight": "800",
        "letterSpacing": "-.3px"
      }
    }, "Activity log"), React.createElement("div", {
      style: {
        "fontSize": "12px",
        "color": "#6c7a8c"
      }
    }, "Audit trail · who did what, when, from where")), React.createElement("button", {
      style: {
        "width": "38px",
        "height": "38px",
        "borderRadius": "11px",
        "border": "1px solid rgba(255,255,255,.9)",
        "background": "rgba(255,255,255,.6)",
        "display": "grid",
        "placeItems": "center",
        "color": "#3c4858",
        "cursor": "pointer"
      }
    }, React.createElement("svg", {
      width: "17",
      height: "17",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"
    })))), React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "6px",
        "overflowX": "auto",
        "paddingBottom": "2px",
        "scrollbarWidth": "none",
        "flexShrink": "0"
      }
    }, (Array.isArray(v.logFilters) ? v.logFilters : []).map((f, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: f?.go,
      style: S(f?.style)
    }, ix(f?.label))))), React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "6px"
      }
    }, (Array.isArray(v.logList) ? v.logList : []).map((l, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "flex-start",
        "gap": "10px",
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "13px",
        "padding": "10px 12px",
        "background": "rgba(255,255,255,.64)"
      }
    }, React.createElement("span", {
      style: S(l?.dotBig)
    }), React.createElement("span", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "12.5px",
        "lineHeight": "1.4"
      }
    }, React.createElement("b", null, ix(l?.who)), " ", ix(l?.text)), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "10.5px",
        "color": "#9aa6b4",
        "marginTop": "2px",
        "fontFamily": "'IBM Plex Mono',monospace"
      }
    }, ix(l?.when), " · ", ix(l?.ip), " · ", ix(l?.action))))))))) : null;
  }
  function Screen_sSettings(v) {
    return v.sSettings ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "flex": "1",
        "minHeight": "0",
        "overflow": "auto",
        "padding": "14px 16px 20px",
        "display": "flex",
        "flexDirection": "column",
        "gap": "12px",
        "animation": "pop .3s ease backwards"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px"
      }
    }, React.createElement("button", {
      onClick: v.openDrawer,
      style: {
        "width": "38px",
        "height": "38px",
        "borderRadius": "11px",
        "border": "1px solid rgba(255,255,255,.9)",
        "background": "rgba(255,255,255,.6)",
        "display": "grid",
        "placeItems": "center",
        "color": "#3c4858",
        "cursor": "pointer",
        "flexShrink": "0"
      }
    }, React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round"
    }, React.createElement("path", {
      d: "M4 7h16M4 12h16M4 17h10"
    }))), React.createElement("div", {
      style: {
        "flex": "1"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "19px",
        "fontWeight": "800",
        "letterSpacing": "-.3px"
      }
    }, "System settings"), React.createElement("div", {
      style: {
        "fontSize": "12px",
        "color": "#6c7a8c"
      }
    }, "Security, data and app policy"))), (Array.isArray(v.settingGroups) ? v.settingGroups : []).map((g, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "16px",
        "background": "rgba(255,255,255,.68)",
        "overflow": "hidden",
        "flexShrink": "0"
      }
    }, React.createElement("div", {
      style: {
        "padding": "12px 14px 4px",
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".7px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, ix(g?.sec)), (Array.isArray(g?.items) ? g?.items : []).map((s, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "12px",
        "padding": "12px 14px",
        "borderTop": "1px solid rgba(125,145,180,.14)"
      }
    }, React.createElement("span", {
      style: {
        "flex": "1"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "13.5px",
        "fontWeight": "600"
      }
    }, ix(s?.label)), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "11.5px",
        "color": "#6c7a8c",
        "lineHeight": "1.35"
      }
    }, ix(s?.sub))), s?.isToggle ? React.createElement(React.Fragment, null, React.createElement("button", {
      onClick: s?.go,
      style: S(s?.track)
    }, React.createElement("span", {
      style: S(s?.knob)
    }))) : null, s?.isValue ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: {
        "fontSize": "12.5px",
        "fontWeight": "700",
        "color": "#0072a3",
        "whiteSpace": "nowrap"
      }
    }, ix(s?.value))) : null, s?.isButton ? React.createElement(React.Fragment, null, React.createElement("button", {
      onClick: s?.go,
      style: S(s?.btnStyle)
    }, ix(s?.value))) : null)))))), v.setToast ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "8px",
        "borderRadius": "12px",
        "padding": "10px 12px",
        "background": "rgba(43,182,115,.13)",
        "color": "#1d8f57",
        "fontSize": "12.5px",
        "fontWeight": "700",
        "animation": "pop .25s ease"
      }
    }, React.createElement("svg", {
      width: "15",
      height: "15",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.4",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M20 6L9 17l-5-5"
    })), ix(v.setToast))) : null, React.createElement("button", {
      onClick: v.signOut,
      style: {
        "border": "1px solid rgba(210,58,82,.35)",
        "borderRadius": "13px",
        "padding": "13px",
        "background": "rgba(210,58,82,.07)",
        "color": "#b32e2e",
        "fontSize": "13.5px",
        "fontWeight": "700",
        "cursor": "pointer"
      }
    }, "Sign out"), React.createElement("div", {
      style: {
        "textAlign": "center",
        "fontSize": "11px",
        "color": "#9aa6b4"
      }
    }, ix(v.appFooter)))) : null;
  }
  function Screen_showNav(v) {
    return v.showNav ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "flexShrink": "0",
        "display": "grid",
        "gridTemplateColumns": "repeat(5,1fr)",
        "padding": "6px 8px 8px",
        "background": "rgba(255,255,255,.78)",
        "backdropFilter": "blur(20px)",
        "WebkitBackdropFilter": "blur(20px)",
        "borderTop": "1px solid rgba(255,255,255,.95)",
        "boxShadow": "0 -8px 28px rgba(31,59,90,.08)"
      }
    }, (Array.isArray(v.navItems) ? v.navItems : []).map((n, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: n?.go,
      style: S(n?.style)
    }, React.createElement("span", {
      style: S(n?.iconWrap)
    }, React.createElement("svg", {
      width: "20",
      height: "20",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: n?.d
    })), n?.badge ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: {
        "position": "absolute",
        "top": "-3px",
        "right": "-6px",
        "minWidth": "16px",
        "height": "16px",
        "padding": "0 4px",
        "borderRadius": "8px",
        "background": "#d23a52",
        "color": "#fff",
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "9.5px",
        "fontWeight": "700",
        "display": "grid",
        "placeItems": "center",
        "border": "2px solid #fff",
        "boxSizing": "content-box"
      }
    }, ix(n?.badge))) : null), React.createElement("span", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700"
      }
    }, ix(n?.label))))))) : null;
  }
  function Screen_drawerOpen(v) {
    return v.drawerOpen ? React.createElement(React.Fragment, null, React.createElement("div", {
      onClick: v.closeDrawer,
      style: {
        "position": "absolute",
        "inset": "0",
        "zIndex": "20",
        "background": "rgba(13,28,50,.45)",
        "backdropFilter": "blur(3px)",
        "WebkitBackdropFilter": "blur(3px)",
        "animation": "fadeIn .2s ease"
      }
    }), React.createElement("div", {
      style: {
        "position": "absolute",
        "top": "0",
        "left": "0",
        "bottom": "0",
        "width": "296px",
        "zIndex": "21",
        "display": "flex",
        "flexDirection": "column",
        "background": "linear-gradient(180deg,rgba(27,22,66,.97),rgba(8,17,32,.96))",
        "color": "#c7d2e0",
        "boxShadow": "12px 0 40px rgba(0,0,0,.35)",
        "animation": "drawerIn .28s cubic-bezier(.2,.7,.3,1)",
        "overflow": "hidden",
        "flexShrink": "0"
      }
    }, React.createElement("div", {
      style: {
        "position": "absolute",
        "top": "-70px",
        "left": "-50px",
        "width": "230px",
        "height": "210px",
        "borderRadius": "50%",
        "background": "radial-gradient(circle,rgba(106,82,212,.45),transparent 70%)",
        "filter": "blur(18px)",
        "pointerEvents": "none"
      }
    }), React.createElement("div", {
      style: {
        "position": "relative",
        "display": "flex",
        "alignItems": "center",
        "gap": "12px",
        "padding": "18px 18px 14px",
        "borderBottom": "1px solid rgba(255,255,255,.08)"
      }
    }, v.meHasPhoto ? React.createElement(React.Fragment, null, React.createElement("img", {
      src: v.mePhoto,
      alt: "",
      style: {
        "width": "46px",
        "height": "46px",
        "borderRadius": "14px",
        "objectFit": "cover",
        "display": "block",
        "flexShrink": "0"
      }
    })) : null, v.meNoPhoto ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: {
        "display": "grid",
        "placeItems": "center",
        "width": "46px",
        "height": "46px",
        "borderRadius": "14px",
        "color": "#fff",
        "fontSize": "15px",
        "fontWeight": "700",
        "background": "linear-gradient(135deg,#6a52d4,#0090ca)"
      }
    }, ix(v.meIni))) : null, React.createElement("div", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("div", {
      style: {
        "color": "#fff",
        "fontSize": "14px",
        "fontWeight": "700",
        "whiteSpace": "nowrap",
        "overflow": "hidden",
        "textOverflow": "ellipsis"
      }
    }, ix(v.meName)), React.createElement("div", {
      style: {
        "color": "#83909f",
        "fontSize": "11.5px"
      }
    }, ix(v.meRoleLine)), React.createElement("div", {
      style: {
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "10.5px",
        "color": "#b8a8ff",
        "marginTop": "2px"
      }
    }, "@", ix(v.meUsername))), React.createElement("button", {
      onClick: v.closeDrawer,
      style: {
        "width": "32px",
        "height": "32px",
        "borderRadius": "9px",
        "border": "0",
        "background": "rgba(255,255,255,.08)",
        "color": "#cfe0f0",
        "display": "grid",
        "placeItems": "center",
        "cursor": "pointer"
      }
    }, React.createElement("svg", {
      width: "15",
      height: "15",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.4",
      strokeLinecap: "round"
    }, React.createElement("path", {
      d: "M6 6l12 12M18 6L6 18"
    })))), React.createElement("div", {
      style: {
        "position": "relative",
        "flex": "1",
        "overflowY": "auto",
        "padding": "8px 10px 10px"
      }
    }, (Array.isArray(v.drawerGroups) ? v.drawerGroups : []).map((g, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "padding": "14px 10px 6px",
        "fontSize": "10px",
        "letterSpacing": ".9px",
        "textTransform": "uppercase",
        "color": "#7d8ea8",
        "fontWeight": "700"
      }
    }, ix(g?.sec)), (Array.isArray(g?.items) ? g?.items : []).map((it, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: it?.go,
      style: S(it?.style),
      className: "dcp1"
    }, React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "1.9",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      style: {
        "flexShrink": "0"
      }
    }, React.createElement("path", {
      d: it?.d
    })), React.createElement("span", {
      style: {
        "flex": "1",
        "textAlign": "left"
      }
    }, ix(it?.label)), it?.badge ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: {
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "10px",
        "fontWeight": "700",
        "minWidth": "18px",
        "textAlign": "center",
        "padding": "1px 6px",
        "borderRadius": "9px",
        "color": "#fff",
        "background": "#d23a52"
      }
    }, ix(it?.badge))) : null)))))), React.createElement("div", {
      style: {
        "position": "relative",
        "margin": "10px",
        "padding": "10px 12px",
        "border": "1px solid rgba(255,255,255,.12)",
        "borderRadius": "12px",
        "background": "rgba(255,255,255,.06)",
        "display": "flex",
        "alignItems": "center",
        "gap": "9px",
        "flexShrink": "0"
      }
    }, React.createElement("img", {
      src: "assets/logo.svg",
      alt: "UNICO",
      style: {
        "height": "22px",
        "width": "auto",
        "filter": "brightness(0) invert(1)",
        "opacity": ".9"
      }
    }), React.createElement("span", {
      style: {
        "flex": "1",
        "fontSize": "10.5px",
        "color": "#83909f",
        "lineHeight": "1.3"
      }
    }, ix(v.hospitalName), React.createElement("br", null), ix(v.appLabel)), React.createElement("button", {
      title: "Sign out",
      onClick: v.signOut,
      style: {
        "display": "grid",
        "placeItems": "center",
        "width": "32px",
        "height": "32px",
        "borderRadius": "8px",
        "color": "#cfe0f0",
        "background": "rgba(255,255,255,.08)",
        "cursor": "pointer",
        "border": "0"
      },
      className: "dcp2"
    }, React.createElement("svg", {
      width: "16",
      height: "16",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"
    })))))) : null;
  }
  function AdminAppView({
    v
  }) {
    return React.createElement(AndroidDevice, null, React.createElement("div", {
      style: {
        "height": "100%",
        "display": "flex",
        "flexDirection": "column",
        "fontFamily": "'IBM Plex Sans',system-ui,sans-serif",
        "color": "#16202e",
        "background": "radial-gradient(420px 300px at 10% -5%,rgba(106,82,212,.2),transparent 65%),radial-gradient(380px 300px at 100% 8%,rgba(0,144,202,.2),transparent 65%),radial-gradient(420px 320px at 80% 100%,rgba(58,181,167,.16),transparent 65%),linear-gradient(180deg,#eef3fb,#e4ecf8)",
        "position": "relative",
        "overflow": "hidden",
        "flexShrink": "0"
      }
    }, Screen_sLogin(v), Screen_sHome(v), Screen_sUsers(v), Screen_sUserDetail(v), Screen_sRoles(v), Screen_sOrg(v), Screen_sRoleEdit(v), Screen_sApprovals(v), Screen_sDepts(v), Screen_sDeptDetail(v), Screen_sModules(v), Screen_sModule(v), Screen_sAppAccess(v), Screen_sMedDetail(v), Screen_sBroadcast(v), Screen_sActivity(v), Screen_sSettings(v), Screen_showNav(v), Screen_drawerOpen(v)));
  }
  AdminAppView.CSS = "body{margin:0;background:#e9eff8;color:#16202e;font-family:'IBM Plex Sans',system-ui,sans-serif;font-size:13px;line-height:1.45;-webkit-font-smoothing:antialiased}\nbody::before{content:\"\";position:fixed;inset:0;z-index:-1;pointer-events:none;background:radial-gradient(900px 620px at 12% -8%,rgba(0,144,202,.26),transparent 62%),radial-gradient(820px 560px at 90% 6%,rgba(58,181,167,.24),transparent 62%),radial-gradient(950px 720px at 78% 98%,rgba(106,82,212,.2),transparent 62%),linear-gradient(180deg,#eef3fb,#e4ecf8)}\na{color:#0072a3}a:hover{color:#0090ca}\ninput,button,select,textarea{font-family:inherit}\n*{scrollbar-width:thin;scrollbar-color:rgba(0,144,202,.4) transparent}\n::-webkit-scrollbar{width:6px;height:6px}::-webkit-scrollbar-track{background:transparent}\n::-webkit-scrollbar-thumb{background:rgba(0,114,163,.4);border-radius:10px}\n@keyframes pop{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}\n@keyframes fadeIn{from{opacity:0}to{opacity:1}}\n@keyframes drawerIn{from{transform:translateX(-100%)}to{transform:none}}\n@keyframes livepulse{0%{box-shadow:0 0 0 0 rgba(61,220,151,.6)}70%{box-shadow:0 0 0 8px rgba(61,220,151,0)}100%{box-shadow:0 0 0 0 rgba(61,220,151,0)}}\n@keyframes orbFloat{from{transform:translate(0,0) scale(1)}to{transform:translate(40px,30px) scale(1.15)}}\n.dcp0:hover{background:rgba(255,255,255,.9) !important}\n.dcp1:hover{background:rgba(255,255,255,.08) !important;color:#fff !important}\n.dcp2:hover{background:rgba(210,58,82,.25) !important;color:#ff8ba0 !important}";
  window.AdminAppView = AdminAppView;
})();
})();
;
/* ===== admin-app.jsx ===== */
(function(){
(function () {
  'use strict';

  const React = window.React;
  const {
    S,
    api,
    tryApi,
    mount
  } = window.DC;
  const D = window.ADMIN_APP_DATA;
  const View = window.AdminAppView;
  const {
    MODULES,
    ACTS,
    lvl,
    P,
    preset,
    ROLE_TEMPLATES,
    ROLE_META,
    DEPTS,
    DEPT_INFO,
    DC_ITEMS,
    USERS,
    QUEUE,
    LEAVE,
    REPORTS_Q,
    LOG,
    SCREENS,
    MOD_META,
    MOD_ORDER,
    APP_ROLES,
    APP_FEATURES,
    FEAT_FLAT,
    FEAT_LABEL,
    ROLE_COLORS,
    KIND_META,
    featDefaults,
    PARENT_SEED,
    seedRoles,
    CLUSTERS_SEED,
    APPROVAL_RULES,
    CM_TYPES,
    MONTHS7,
    STATS_DEPTS,
    STAT_SERIES,
    DEPT_SERIES,
    DEPT_DEATHS,
    DEPT_ALOS,
    IND_CATALOG,
    CAPA_LIST,
    INCIDENTS,
    SUP_REPORTS,
    SUP_SECTIONS,
    STAFF_ROWS,
    COMPLIANCE,
    PRIV_GROUPS,
    SHARE_LINKS,
    FORM_FIELDS,
    SAVED_REPORTS,
    APPRAISALS,
    ROSTERS,
    SHIFT_CODES,
    MEDS_ADMIN,
    MED_REQUESTS,
    pillBtn,
    chip,
    ini,
    toggle
  } = D;
  class AdminApp extends React.Component {
    state = {
      booting: true,
      me: null,
      toast: '',
      loginBusy: false,
      live: {
        users: null,
        roles: null,
        log: null,
        subs: null,
        depts: null,
        staff: null,
        meds: null,
        deptsRaw: null,
        staffRaw: null,
        subsRaw: null,
        quality: null,
        settings: null,
        requests: null,
        shiftReports: null,
        incidents: null,
        medReqs: null,
        rosters: null,
        perf: null,
        online: null
      },
      screen: 'home',
      drawerOpen: false,
      loginUser: '',
      loginPw: '',
      users: USERS,
      userQ: '',
      roleFilter: 'All',
      selUser: 'rakib.h',
      ud: null,
      udTab: 'profile',
      udToast: '',
      confirm: null,
      confirmReason: '',
      apTab: 'data',
      apFilter: 'All',
      decisions: {},
      returning: null,
      apReason: '',
      apToast: '',
      selDept: 'LDR',
      reminded: {},
      bcTitle: '',
      bcBody: '',
      bcCat: 'General',
      bcAud: {
        all: true
      },
      bcAck: true,
      bcPin: false,
      bcPush: true,
      bcSent: false,
      logFilter: 'All',
      settings: {
        requireAuth: true,
        twofa: true,
        pinLock: true,
        session: '12 h',
        autoBackup: true,
        portalPhones: true,
        offline: true
      },
      setToast: '',
      mod: 'stats',
      modTab: 0,
      modToast: '',
      modDec: {},
      modForm: {},
      medAlert: {},
      indActive: {},
      revoked: {},
      stPeriod: 'latest',
      stLayout: 'exec',
      stCompare: ['LDR', 'SICU', 'MICU'],
      stMetric: 'adm',
      stDept: 'LDR',
      modExportOpen: false,
      stExportPage: 'A4 portrait',
      stExport: {
        charts: true,
        tables: true,
        conf: true
      },
      aaTab: 'features',
      aaToast: '',
      aaFeat: {},
      aaPublished: {},
      aaDept: 'LDR',
      aaDeptOv: {
        LDR: {
          phones: 'off'
        },
        Emergency: {
          chatHosp: 'on'
        }
      },
      udFeatOv: {},
      pvRole: 'nurse',
      pvDept: 'LDR',
      customMods: [{
        id: 'cm1',
        name: 'Crash cart checklist',
        type: 'checklist',
        fields: ['Defibrillator charged', 'Drugs in date', 'Suction working', 'Oxygen > 50%', 'Seal number recorded'],
        roles: ['nurse', 'incharge'],
        depts: ['LDR', 'CCU', 'SICU', 'MICU', 'Emergency'],
        sched: 'Every shift',
        active: true
      }, {
        id: 'cm2',
        name: 'Infection control round',
        type: 'audit',
        fields: ['Hand rub at bedside', 'Isolation signage', 'Sharps bin < ¾', 'PPE stock'],
        roles: ['incharge'],
        depts: ['All'],
        sched: 'Weekly',
        active: true
      }],
      cm: {
        id: null,
        name: '',
        type: 'checklist',
        fields: [],
        fieldDraft: '',
        roles: ['nurse', 'incharge'],
        depts: ['All'],
        sched: 'Every shift'
      },
      meds: null,
      mono: {},
      amSel: 'actrapid',
      amTab: 'overview',
      amEditing: false,
      amToast: '',
      amEdits: {},
      amFlags: {},
      amRemoved: {},
      roles: seedRoles(),
      roleKind: 'All',
      re: null,
      reTab: 'basics',
      reToast: '',
      orgTab: 'levels',
      orgToast: '',
      clusters: CLUSTERS_SEED,
      rules: {},
      escHours: 48,
      reassign: null
    };
    orgToastMsg = msg => {
      this.setState({
        orgToast: msg
      });
      setTimeout(() => this.setState({
        orgToast: ''
      }), 2400);
    };
    levelOf = (role, depth = 0) => {
      if (!role || !role.parent || depth > 8) return 0;
      const p = this.state.roles.find(r => r.id === role.parent);
      return p ? 1 + this.levelOf(p, depth + 1) : 0;
    };
    roleOf = u => this.state.roles.find(r => r.id === (u.roleId || u.role)) || this.state.roles.find(r => r.kind === (u.role === 'Administrator' ? 'admin' : u.role === 'User' ? 'console' : 'portal')) || this.state.roles[0];
    kindToLegacy = role => role.kind === 'admin' ? 'Administrator' : role.kind === 'console' ? 'User' : PORTAL_ROLES.includes(role.id) ? role.id : 'nurse';
    editRole = r => this.setState({
      screen: 'roleEdit',
      re: JSON.parse(JSON.stringify(r)),
      reTab: 'basics',
      reToast: '',
      drawerOpen: false
    });
    newRoleFn = base => this.editRole(base ? {
      ...base,
      id: null,
      label: base.label + ' copy',
      system: false
    } : {
      id: null,
      label: '',
      desc: '',
      kind: 'console',
      system: false,
      color: '#0072a3',
      perms: preset({}),
      appFeats: featDefaults(0),
      scope: 'departments',
      parent: 'Nurse Manager'
    });
    aaToastMsg = msg => {
      this.setState({
        aaToast: msg
      });
      setTimeout(() => this.setState({
        aaToast: ''
      }), 2400);
    };
    loadSeedMeds() {
      fetch('assets/nurse-app-meds.json').then(r => r.json()).then(meds => this.setState(s => ({
        meds: s.live.meds || (Array.isArray(meds) ? meds : [])
      }))).catch(() => this.setState({
        meds: []
      }));
      fetch('assets/monographs.json').then(r => r.json()).then(mono => this.setState({
        mono
      })).catch(() => {});
    }
    openMed = id => this.setState({
      screen: 'medDetail',
      amSel: id,
      amTab: 'overview',
      amEditing: false,
      amToast: '',
      drawerOpen: false
    });
    amToastMsg = msg => {
      this.setState({
        amToast: msg
      });
      setTimeout(() => this.setState({
        amToast: ''
      }), 2400);
    };
    modToast = msg => {
      this.setState({
        modToast: msg
      });
      setTimeout(() => this.setState({
        modToast: ''
      }), 2400);
    };
    openMod = (id, tab = 0) => id === 'users' ? this.go('users') : this.setState({
      screen: 'module',
      mod: id,
      modTab: tab,
      drawerOpen: false,
      modToast: ''
    });
    go = (screen, extra = {}) => this.setState({
      screen,
      drawerOpen: false,
      ...extra
    });
    openUser = username => {
      const u = this.state.users.find(x => x.username === username);
      this.setState({
        screen: 'userDetail',
        selUser: username,
        drawerOpen: false,
        udTab: 'profile',
        udToast: '',
        ud: {
          ...u,
          perms: JSON.parse(JSON.stringify(u.perms || {})),
          depts: [...(u.depts || [])],
          pw: ''
        },
        udNew: false
      });
    };
    newUser = roleId => {
      const t = this.state.roles.find(x => x.id === roleId) || this.state.roles.find(x => x.id === 'incharge') || this.state.roles[0];
      this.setState({
        screen: 'userDetail',
        drawerOpen: false,
        udTab: t.kind === 'console' ? 'access' : 'profile',
        udToast: '',
        udNew: true,
        ud: {
          username: '',
          name: '',
          role: this.kindToLegacy(t),
          roleId: t.id,
          title: t.label,
          active: true,
          emp: '',
          depts: [],
          scope: t.kind === 'admin' ? 'all' : t.scope || 'departments',
          perms: t.kind === 'console' ? JSON.parse(JSON.stringify(t.perms)) : {},
          pw: '',
          created: 'now',
          twofa: false,
          sessions: 0,
          lastLogin: 'Never'
        }
      });
    };
    renderVals() {
      const s = this.state,
        go = this.go;
      const QUEUE = s.live.subs && s.live.subs.length ? s.live.subs : D.QUEUE;
      const LOG = s.live.log && s.live.log.length ? s.live.log : D.LOG;
      const DEPTS = s.live.depts ? s.live.depts.list : D.DEPTS;
      const DEPT_INFO = s.live.depts ? Object.assign({}, D.DEPT_INFO, s.live.depts.info) : D.DEPT_INFO;
      const LV0 = liveShadows(s);
      const {
        MONTHS7,
        STAT_SERIES,
        DEPT_SERIES: DEPT_SERIES_LV,
        STATS_DEPTS: STATS_DEPTS_LV,
        DEPT_DEATHS: DEPT_DEATHS_LV,
        DEPT_ALOS: DEPT_ALOS_LV,
        INCIDENTS,
        MED_REQUESTS,
        SUP_REPORTS,
        ROSTERS,
        APPRAISALS,
        STAFF_ROWS,
        COMPLIANCE,
        CAPA_LIST,
        SAVED_REPORTS,
        LEAVE,
        REPORTS_Q,
        IND_CATALOG,
        MEDS_ADMIN
      } = LV0;
      const withDefault = (src, dflt) => Object.assign(Object.fromEntries(DEPTS.map(d => [d, typeof dflt === 'function' ? dflt() : dflt])), src);
      const STATS_DEPTS = withDefault(STATS_DEPTS_LV, () => [0, 0]);
      const DEPT_SERIES = withDefault(DEPT_SERIES_LV, () => [0, 0, 0, 0, 0, 0, 0]);
      const DEPT_DEATHS = withDefault(DEPT_DEATHS_LV, 0);
      const DEPT_ALOS = withDefault(DEPT_ALOS_LV, 0);
      const RAGD_DEFAULT = [0, 0, 0];
      const me = s.me || {
        name: '—',
        username: '',
        role: ''
      };
      const LV = LV0;
      const HOSP = LV.hospital;
      const users = LV.online ? s.users.map(u => ({
        ...u,
        online: LV.online.indexOf(u.username) >= 0
      })) : s.users;
      const pendingDc = QUEUE.filter(q => !s.decisions[q.id]).length;
      const pendingLeave = LEAVE.filter(q => !s.decisions[q.id]).length;
      const pendingRep = REPORTS_Q.filter(q => !s.decisions[q.id]).length;
      const pendingTotal = pendingDc + pendingLeave + pendingRep;
      const inactive = users.filter(u => !u.active).length;
      const roles = s.roles;
      const roleOf = u => this.roleOf(u);
      const roleLabel = u => roleOf(u).label;
      const roleColor = u => roleOf(u).color || KIND_META[roleOf(u).kind].c;
      const roleStyle = u => {
        const c = roleColor(u);
        return `font-size:10px;font-weight:800;letter-spacing:.3px;padding:4px 8px;border-radius:7px;color:${c};background:${c}22;white-space:nowrap;flex-shrink:0`;
      };
      const scopeLabel = u => roleOf(u).kind === 'admin' ? 'All departments · full access' : u.depts.length ? u.depts.join(', ') : u.scope === 'self' ? 'Own record only' : 'All departments';
      const q = s.userQ.trim().toLowerCase();
      const userList = users.filter(u => (s.roleFilter === 'All' || (s.roleFilter === 'Inactive' ? !u.active : s.roleFilter.startsWith('kind:') ? roleOf(u).kind === s.roleFilter.slice(5) : roleOf(u).id === s.roleFilter)) && (!q || (u.name + ' ' + u.username + ' ' + u.depts.join(' ') + ' ' + roleLabel(u)).toLowerCase().includes(q))).map(u => ({
        ...u,
        ini: ini(u.name),
        inactive: !u.active,
        roleLabel: roleLabel(u),
        roleStyle: roleStyle(u),
        scopeLabel: scopeLabel(u),
        go: () => this.openUser(u.username),
        avStyle: `display:grid;place-items:center;width:44px;height:44px;border-radius:13px;color:#fff;font-size:12.5px;font-weight:700;background:${u.active ? `linear-gradient(135deg,${roleColor(u)},#0090ca)` : 'rgba(125,145,180,.5)'}`,
        cardStyle: `display:flex;align-items:center;gap:11px;text-align:left;border:1px solid rgba(255,255,255,.9);border-radius:15px;padding:10px 12px;background:rgba(255,255,255,${u.active ? '.66' : '.45'});cursor:pointer;color:#16202e;opacity:${u.active ? 1 : .75}`
      }));
      const ud = s.ud || {
        ...users[0],
        perms: {},
        depts: [],
        pw: ''
      };
      const orig = users.find(u => u.username === ud.username);
      const udDirty = s.udNew ? !!(ud.username && ud.name) : !!orig && JSON.stringify({
        n: orig.name,
        r: orig.roleId,
        t: orig.title,
        a: orig.active,
        e: orig.emp,
        d: orig.depts,
        sc: orig.scope,
        p: orig.perms
      }) !== JSON.stringify({
        n: ud.name,
        r: ud.roleId,
        t: ud.title,
        a: ud.active,
        e: ud.emp,
        d: ud.depts,
        sc: ud.scope,
        p: ud.perms
      });
      const setUd = patch => this.setState({
        ud: {
          ...ud,
          ...patch
        }
      });
      const udRoleObj = roleOf(ud);
      const isPortal = udRoleObj.kind === 'portal';
      const has = (m, a) => Array.isArray(ud.perms[m]) && ud.perms[m].includes(a);
      const togglePerm = (m, a) => {
        const cur = Array.isArray(ud.perms[m]) ? [...ud.perms[m]] : [];
        let next;
        if (cur.includes(a)) {
          next = cur.filter(x => x !== a);
          if (a === 'view') next = [];
        } else {
          next = [...cur, a];
          if (a !== 'view' && !next.includes('view')) next.push('view');
        }
        setUd({
          perms: {
            ...ud.perms,
            [m]: ACTS.filter(x => next.includes(x))
          },
          title: 'Custom'
        });
      };
      const permRows = MODULES.map(([k, label]) => {
        const acts = ud.perms[k] || [];
        return {
          label,
          summary: acts.length ? acts.map(a => a[0].toUpperCase() + a.slice(1)).join(' · ') : 'No access',
          cells: ACTS.map(a => ({
            on: has(k, a),
            go: () => togglePerm(k, a),
            style: `width:30px;height:30px;border-radius:9px;cursor:pointer;display:grid;place-items:center;margin:0 auto;border:1.5px solid ${has(k, a) ? 'transparent' : 'rgba(125,145,180,.35)'};background:${has(k, a) ? a === 'delete' ? 'linear-gradient(140deg,#d23a52,#a8253c)' : 'linear-gradient(140deg,#6a52d4,#0072a3)' : 'rgba(255,255,255,.7)'}`
          }))
        };
      });
      const previewMods = udRoleObj.kind === 'admin' ? MODULES.map(([k, l]) => ({
        label: l,
        style: 'font-size:11px;font-weight:700;padding:5px 9px;border-radius:999px;color:#6a52d4;background:rgba(106,82,212,.13)'
      })) : isPortal ? FEAT_FLAT.filter(([fid]) => {
        const ov = (s.udFeatOv[ud.username] || {})[fid];
        const base = udRoleObj.appFeats[fid];
        return ov === 'on' ? true : ov === 'off' ? false : base;
      }).map(([fid, l]) => ({
        label: l,
        style: 'font-size:11px;font-weight:700;padding:5px 9px;border-radius:999px;color:#1e8a7c;background:rgba(58,181,167,.16)'
      })) : MODULES.filter(([k]) => (ud.perms[k] || []).length).map(([k, l]) => ({
        label: l,
        style: 'font-size:11px;font-weight:700;padding:5px 9px;border-radius:999px;color:#0072a3;background:rgba(0,144,202,.13)'
      }));
      const confirm = s.confirm;
      const doAction = (title, body, cta, danger, fn, needsReason) => this.setState({
        confirm: {
          title,
          body,
          cta,
          needsReason: !!needsReason,
          go: () => {
            fn();
            this.setState({
              confirm: null,
              confirmReason: ''
            });
          },
          btnStyle: `flex:1;border:0;border-radius:12px;padding:12px;color:#fff;font-size:13px;font-weight:700;cursor:pointer;background:${danger ? 'linear-gradient(140deg,#d23a52,#a8253c)' : 'linear-gradient(140deg,#6a52d4,#0072a3)'}`
        },
        confirmReason: ''
      });
      const toastUd = msg => {
        this.setState({
          udToast: msg
        });
        setTimeout(() => this.setState({
          udToast: ''
        }), 2400);
      };
      const apSource = s.apTab === 'data' ? QUEUE : s.apTab === 'leave' ? LEAVE : REPORTS_Q;
      const apList = apSource.filter(x => s.apFilter === 'All' || (s.apFilter === 'Out of range' ? !x.ok : s.apFilter === 'Pending' ? !s.decisions[x.id] : x.dept === s.apFilter)).map(x => {
        const d = s.decisions[x.id];
        return {
          ...x,
          vals: x.vals.map(([k, v]) => ({
            k,
            v
          })),
          valueColor: x.ok ? '#1d8f57' : '#b32e2e',
          benchLabel: x.bench,
          pending: !d,
          decided: !!d,
          status: d ? d.status : '',
          reason: d ? d.reason : null,
          returning: s.returning === x.id,
          notReturning: s.returning !== x.id,
          kindStyle: `font-size:9.5px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;padding:3px 7px;border-radius:6px;flex-shrink:0;${x.kind === 'Quality' ? 'color:#6a52d4;background:rgba(106,82,212,.13)' : x.kind === 'Statistics' ? 'color:#0072a3;background:rgba(0,144,202,.13)' : 'color:#1e8a7c;background:rgba(58,181,167,.16)'}`,
          cardStyle: `border:1px solid ${!x.ok && !d ? 'rgba(214,69,69,.35)' : 'rgba(255,255,255,.9)'};border-radius:15px;padding:12px 13px;background:rgba(255,255,255,${d ? '.5' : '.68'})`,
          statusStyle: `font-size:10.5px;font-weight:700;padding:3px 8px;border-radius:999px;${d && d.status === 'Approved' ? 'color:#1d8f57;background:rgba(43,182,115,.14)' : 'color:#b32e2e;background:rgba(214,69,69,.12)'}`,
          approve: () => {
            this.setState({
              decisions: {
                ...s.decisions,
                [x.id]: {
                  status: 'Approved'
                }
              },
              apToast: `Approved · ${x.dept} ${x.label}`
            });
            setTimeout(() => this.setState({
              apToast: ''
            }), 2200);
          },
          src: x.src || 'submission',
          startReturn: () => this.setState({
            returning: x.id,
            apReason: ''
          }),
          cancelReturn: () => this.setState({
            returning: null
          }),
          confirmReturn: () => {
            if (!s.apReason.trim()) return;
            this.setState({
              decisions: {
                ...s.decisions,
                [x.id]: {
                  status: 'Returned',
                  reason: s.apReason.trim()
                }
              },
              returning: null,
              apToast: `Returned to ${x.by} with reason`
            });
            setTimeout(() => this.setState({
              apToast: ''
            }), 2200);
          },
          undo: () => {
            const d2 = {
              ...s.decisions
            };
            delete d2[x.id];
            this.setState({
              decisions: d2
            });
          }
        };
      });
      const covOf = dept => {
        const items = QUEUE.filter(x => x.dept === dept);
        const monthKey = LV.live ? LV_MONTH_KEY(5) : null;
        const all = LV.live ? (s.live.subsRaw || []).filter(x => x.month === monthKey && ((x.departmentName || '') === DEPT_INFO[dept]?.name || (x.areaName || '') === DEPT_INFO[dept]?.name || x.department === LV.deptId(dept))) : [];
        const app = LV.live ? all.filter(x => x.status === 'approved').length + items.filter(x => s.decisions[x.id] && s.decisions[x.id].status === 'Approved').length : items.filter(x => s.decisions[x.id] && s.decisions[x.id].status === 'Approved').length + ({
          LDR: 2,
          SICU: 3,
          'CT ICU': 2,
          MICU: 4,
          CCU: 5,
          NICU: 6,
          Emergency: 3,
          OPD: 4,
          'Cath Lab': 2
        }[dept] || 0);
        const pen = items.filter(x => !s.decisions[x.id]).length;
        const rej = LV.live ? all.filter(x => x.status === 'rejected').length : items.filter(x => s.decisions[x.id] && s.decisions[x.id].status === 'Returned').length + (dept === 'LDR' ? 1 : 0);
        const expected = LV.live ? 1 + (((s.live.quality || []).find(a => String(a.deptId) === String(LV.deptId(dept))) || {}).indicators || []).length : 8;
        const total = Math.max(expected, app + pen + rej, 1);
        return {
          app,
          pen,
          rej,
          mis: Math.max(0, total - app - pen - rej),
          total
        };
      };
      const covAll = DEPTS.reduce((a, d) => {
        const c = covOf(d);
        a.approved += c.app;
        a.pending += c.pen;
        a.rejected += c.rej;
        a.missing += c.mis;
        a.total += c.total;
        return a;
      }, {
        approved: 0,
        pending: 0,
        rejected: 0,
        missing: 0,
        total: 0
      });
      const seg = (n, total, color) => `width:${n / total * 100}%;background:${color}`;
      const dd = DEPT_INFO[s.selDept];
      const ddCov = covOf(s.selDept);
      const ddUsers = users.filter(u => u.depts.includes(s.selDept));
      const bcReach = LV.live ? s.bcAud.all ? users.filter(u => u.active).length : users.filter(u => u.active && u.depts.some(d => s.bcAud[d])).length : s.bcAud.all ? 186 : DEPTS.filter(d => s.bcAud[d]).reduce((a, d) => a + DEPT_INFO[d].staff, 0);
      const logList = LOG.filter(l => s.logFilter === 'All' || (s.logFilter === 'Sign-ins' ? l.action.startsWith('login') : s.logFilter === 'Users & roles' ? l.action.startsWith('user') || l.action === 'session_revoked' : s.logFilter === 'Submissions' ? l.action.startsWith('submission') : s.logFilter === 'Security' ? ['login_failed', 'session_revoked', 'backup_restore'].includes(l.action) : true)).map(l => ({
        ...l,
        dotBig: `width:10px;height:10px;border-radius:50%;background:${l.c};flex-shrink:0;margin-top:5px;box-shadow:0 0 0 3px ${l.c}22`
      }));
      const navGroup = {
        home: 'home',
        users: 'users',
        userDetail: 'users',
        roles: 'users',
        roleEdit: 'users',
        org: 'users',
        appAccess: 'users',
        approvals: 'approvals',
        depts: 'modules',
        deptDetail: 'modules',
        modules: 'modules',
        module: 'modules',
        medDetail: 'modules',
        broadcast: 'more',
        activity: 'more',
        settings: 'more'
      }[s.screen];
      const dItem = (screen, label, d, extra = {}) => ({
        label,
        d,
        go: () => go(screen, extra.go || {}),
        badge: extra.badge || null,
        style: `display:flex;align-items:center;gap:11px;width:100%;box-sizing:border-box;border:0;border-radius:10px;padding:10px 12px;font-size:13px;font-weight:600;cursor:pointer;color:${s.screen === screen ? '#fff' : '#c7d2e0'};background:${s.screen === screen ? 'linear-gradient(90deg,rgba(106,82,212,.4),rgba(0,144,202,.18))' : 'transparent'};box-shadow:${s.screen === screen ? 'inset 3px 0 0 #3ab5a7' : 'none'}`
      });
      const set = s.settings;
      const setS = k => this.setState({
        settings: {
          ...set,
          [k]: !set[k]
        }
      });
      const modMeta = MOD_META[s.mod] || MOD_META.stats;
      const tabName = modMeta.tabs[s.modTab] || modMeta.tabs[0] || '';
      const dec = s.modDec;
      const setDec = (k, v, msg) => {
        this.setState({
          modDec: {
            ...dec,
            [k]: v
          }
        });
        if (msg) this.modToast(msg);
      };
      const F = s.modForm;
      const setF = (k, v) => this.setState({
        modForm: {
          ...F,
          [k]: v
        }
      });
      const row = o => ({
        av: null,
        avStyle: '',
        tag: null,
        tagStyle: '',
        sub: '',
        value: null,
        valueColor: '#16202e',
        valueSub: null,
        status: null,
        statusStyle: '',
        chevron: false,
        hasSegs: false,
        segs: [],
        body: null,
        hasActions: false,
        actions: [],
        go: () => {},
        cardStyle: 'border:1px solid rgba(255,255,255,.9);border-radius:15px;padding:11px 13px;background:rgba(255,255,255,.66)',
        ...o
      });
      const avatar = (txt, c = '#0090ca') => ({
        av: txt,
        avStyle: `display:grid;place-items:center;width:40px;height:40px;border-radius:12px;color:#fff;font-size:11.5px;font-weight:700;letter-spacing:.2px;background:linear-gradient(135deg,${c},#3ab5a7);flex-shrink:0`
      });
      const st = (label, c) => ({
        status: label,
        statusStyle: `font-size:10.5px;font-weight:700;padding:3px 8px;border-radius:999px;color:${c};background:${c}22;white-space:nowrap;flex-shrink:0`
      });
      const STC = {
        pending: ['Pending', '#b8650a'],
        approved: ['Approved', '#1d8f57'],
        returned: ['Returned', '#b32e2e'],
        submitted: ['Submitted', '#0072a3'],
        draft: ['Draft', '#7d8ea8'],
        open: ['Open', '#b32e2e'],
        progress: ['In progress', '#b8650a'],
        closed: ['Closed', '#1d8f57'],
        'Under review': ['Under review', '#b8650a'],
        Open: ['Open', '#b32e2e'],
        Closed: ['Closed', '#1d8f57'],
        active: ['Active', '#1d8f57'],
        expired: ['Expired', '#7d8ea8'],
        revoked: ['Revoked', '#b32e2e']
      };
      const stOf = k => st(...(STC[k] || [k, '#3c4858']));
      const tagOf = (t, c) => ({
        tag: t,
        tagStyle: `font-size:9px;font-weight:800;letter-spacing:.5px;padding:2px 6px;border-radius:5px;color:${c};background:${c}22;flex-shrink:0`
      });
      const btnP = (label, go, danger) => ({
        label,
        go,
        style: `flex:1;border:0;border-radius:10px;padding:9px;color:#fff;font-size:12.5px;font-weight:700;cursor:pointer;background:${danger ? 'linear-gradient(140deg,#d23a52,#a8253c)' : 'linear-gradient(140deg,#2bb673,#1d8f57)'}`
      });
      const btnS = (label, go, danger) => ({
        label,
        go,
        style: `flex:1;border:1px solid ${danger ? 'rgba(210,58,82,.4)' : 'rgba(125,145,180,.35)'};border-radius:10px;padding:9px;background:${danger ? 'rgba(210,58,82,.08)' : 'rgba(255,255,255,.7)'};color:${danger ? '#b32e2e' : '#16202e'};font-size:12.5px;font-weight:700;cursor:pointer`
      });
      const chartOf = (title, legend, labels, vals, color) => {
        const mx = Math.max(1, ...vals);
        return {
          title,
          legend,
          bars: labels.map((l, i) => ({
            label: l,
            v: vals[i],
            bar: `width:100%;max-width:26px;height:${Math.max(3, vals[i] / mx * 70)}px;border-radius:4px 4px 0 0;background:${i === labels.length - 1 ? color : color + '66'}`
          }))
        };
      };
      const inputStyle = "border:1px solid rgba(125,145,180,.3);border-radius:10px;padding:10px 12px;font-size:13.5px;background:rgba(255,255,255,.85);outline:none;width:100%;box-sizing:border-box";
      const fInput = (k, label, ph, hint, mono) => ({
        label,
        ph,
        hint: hint || null,
        isInput: true,
        isChips: false,
        isToggle: false,
        v: F[k] === undefined ? '' : F[k],
        set: e => setF(k, e.target.value),
        style: inputStyle + (mono ? ";font-family:'IBM Plex Mono',monospace" : '')
      });
      const fChips = (k, label, opts, def, multi) => ({
        label,
        hint: null,
        isInput: false,
        isChips: true,
        isToggle: false,
        chips: opts.map(o => {
          const cur = F[k] === undefined ? def : F[k];
          const on = multi ? (cur || []).includes(o) : cur === o;
          return {
            label: o,
            go: () => setF(k, multi ? on ? (cur || []).filter(x => x !== o) : [...(cur || []), o] : o),
            style: chip(on)
          };
        })
      });
      const fToggle = (k, label, sub, def) => {
        const on = F[k] === undefined ? def : F[k];
        return {
          label,
          hint: null,
          sub,
          isInput: false,
          isChips: false,
          isToggle: true,
          go: () => setF(k, !on),
          ...toggle(on)
        };
      };
      let M = {
        tiles: null,
        chart: null,
        chart2: null,
        donuts: null,
        insights: null,
        insightsTitle: '',
        filters: null,
        layouts: null,
        form: null,
        rows: [],
        rowsTitle: null,
        primary: null,
        exportable: false
      };
      const m = s.mod;
      if (m === 'stats') {
        const PERIODS = [['latest', 'Latest month'], ['3m', 'Last 3 months'], ['6m', 'Last 6 months']];
        const pN = {
          latest: 1,
          '3m': 3,
          '6m': 6
        }[s.stPeriod] || 1;
        const sl = a => a.slice(5 - pN + 1, 6);
        const sumP = a => sl(a).reduce((x, y) => x + y, 0);
        const avgP = a => Math.round(sumP(a) / pN * 10) / 10;
        const prev = a => a.slice(5 - 2 * pN + 1, 5 - pN + 1).reduce((x, y) => x + y, 0);
        const pct = (c, p) => p ? Math.round((c - p) / p * 100) : 0;
        const fmtN = n => n.toLocaleString('en-US');
        const dl = (c, p, goodUp = true) => {
          const d = pct(c, p);
          return {
            t: (d > 0 ? '+' : '') + d + '%',
            good: goodUp ? d >= 0 : d <= 0
          };
        };
        const periodLabel = (PERIODS.find(p => p[0] === s.stPeriod) || PERIODS[0])[1] + (s.stPeriod === 'latest' || !PERIODS.some(p => p[0] === s.stPeriod) ? ' · ' + MONTHS7[5] + ' ' + YR : '');
        M.filters = PERIODS.map(([k, l]) => ({
          label: l,
          go: () => this.setState({
            stPeriod: k
          }),
          style: chip(s.stPeriod === k)
        }));
        M.exportable = true;
        const admN = sumP(STAT_SERIES.adm),
          disN = sumP(STAT_SERIES.dis),
          deathN = sumP(STAT_SERIES.deaths),
          pdN = sumP(STAT_SERIES.pdays),
          occN = avgP(STAT_SERIES.occ),
          alosN = Math.round(pdN / Math.max(1, disN) * 10) / 10,
          erN = sumP(STAT_SERIES.er),
          surgN = sumP(STAT_SERIES.surg),
          delN = sumP(STAT_SERIES.deliveries);
        const mort = Math.round(deathN / Math.max(1, disN) * 1000) / 10;
        const dAdm = dl(admN, prev(STAT_SERIES.adm)),
          dOcc = dl(occN, Math.round(prev(STAT_SERIES.occ) / pN)),
          dDeath = dl(deathN, prev(STAT_SERIES.deaths), false),
          dEr = dl(erN, prev(STAT_SERIES.er)),
          dSurg = dl(surgN, prev(STAT_SERIES.surg));
        const tile = (label, v, d, color, note) => ({
          label,
          v,
          color,
          note: note === undefined ? `${d.t} vs previous` : `${d.t} ${note}`.trim(),
          dcolor: d.good ? '#1d8f57' : '#b32e2e'
        });
        if (tabName === 'Dashboard') {
          M.layouts = [['exec', 'Executive'], ['ops', 'Operational'], ['ana', 'Analytics']].map(([k, l]) => ({
            label: l,
            go: () => this.setState({
              stLayout: k
            }),
            style: pillBtn(s.stLayout === k).replace('padding:7px 10px', 'padding:6px 9px').replace('font-size:12px', 'font-size:11px')
          }));
          M.insightsTitle = `In plain words · ${periodLabel}`;
          M.insights = [{
            text: `${fmtN(admN)} admissions and ${fmtN(disN)} discharges (${dAdm.t} vs the previous period). Average occupancy ${occN}%${occN >= 85 ? ' — above the 85% safe-capacity line' : ''}.`,
            dot: 'width:8px;height:8px;border-radius:50%;background:#0090ca;flex-shrink:0;margin-top:6px'
          }, {
            text: `${deathN} deaths · gross mortality ${mort}% · average length of stay ${alosN} days.`,
            dot: `width:8px;height:8px;border-radius:50%;background:${mort > 1.1 ? '#d23a52' : '#1d8f57'};flex-shrink:0;margin-top:6px`
          }, ...(DEPTS.some(d => STATS_DEPTS[d][1] >= 90) ? [{
            text: `${DEPTS.filter(d => STATS_DEPTS[d][1] >= 90).join(', ')} ${DEPTS.filter(d => STATS_DEPTS[d][1] >= 90).length > 1 ? 'are' : 'is'} running above 90% occupancy — consider bed re-allocation.`,
            dot: 'width:8px;height:8px;border-radius:50%;background:#e08a1e;flex-shrink:0;margin-top:6px'
          }] : []), {
            text: `${fmtN(erN)} emergency attendances and ${fmtN(surgN)} surgeries; ${fmtN(delN)} deliveries.`,
            dot: 'width:8px;height:8px;border-radius:50%;background:#3ab5a7;flex-shrink:0;margin-top:6px'
          }];
          if (s.stLayout === 'exec') {
            M.tiles = [tile('Admissions', fmtN(admN), dAdm, '#0072a3'), tile('Occupancy', occN + '%', dOcc, occN >= 85 ? '#b8650a' : '#1e8a7c'), tile('Deaths', String(deathN), dDeath, '#b32e2e'), tile('ALOS', alosN + ' d', {
              t: 'target ≤ 3.5',
              good: alosN <= 3.5
            }, '#1e8a7c', ''), tile('ER visits', fmtN(erN), dEr, '#6a52d4'), tile('Surgeries', fmtN(surgN), dSurg, '#0072a3')].map(t => ({
              ...t,
              note: t.note.trim()
            }));
            M.chart = chartOf('Admissions vs discharges · 7 months', '■ admissions  ▪ discharges', MONTHS7, STAT_SERIES.adm, '#0090ca');
            M.chart.bars = M.chart.bars.map((b, i) => ({
              ...b,
              hasB: true,
              barB: `width:100%;max-width:12px;height:${Math.max(3, STAT_SERIES.dis[i] / Math.max(...STAT_SERIES.adm) * 70)}px;border-radius:4px 4px 0 0;background:#3ab5a766`,
              bar: b.bar.replace('max-width:26px', 'max-width:12px')
            }));
            const csRate = LV.live ? delN ? Math.round(sumP(STAT_SERIES.deliveries.map((v, i) => v - (STAT_SERIES.nvd ? STAT_SERIES.nvd[i] : 0))) / delN * 100) / 100 : 0 : 0.41;
            M.donuts = [{
              title: 'Bed occupancy',
              v: occN ? occN + '%' : '—',
              unit: 'AVG',
              color: occN >= 85 ? '#e08a1e' : '#0090ca',
              bg: 'rgba(125,145,180,.2)',
              dash: `${occN / 100 * 238.8} 238.8`,
              legend: [{
                label: 'Occupied',
                v: occN ? occN + '%' : 'no occupancy column',
                c: occN >= 85 ? '#e08a1e' : '#0090ca'
              }, {
                label: 'Free',
                v: occN ? 100 - occN + '%' : '—',
                c: 'rgba(125,145,180,.4)'
              }]
            }, {
              title: 'Deliveries',
              v: fmtN(delN),
              unit: periodLabel.split(' ·')[0].toUpperCase(),
              color: '#0090ca',
              bg: 'rgba(58,181,167,.8)',
              dash: `${(delN ? 1 : 0) * 238.8} 238.8`,
              legend: [{
                label: 'Total',
                v: fmtN(delN),
                c: '#0090ca'
              }, {
                label: 'ER attendances',
                v: fmtN(erN),
                c: '#3ab5a7'
              }]
            }];
            M.rowsTitle = 'Departments · admissions & occupancy';
            M.rows = DEPTS.map(d => row({
              ...avatar(d.slice(0, 4), '#0d2a4a'),
              title: DEPT_INFO[d].name,
              sub: `${DEPT_INFO[d].beds ? DEPT_INFO[d].beds + ' beds · ' : ''}${DEPT_INFO[d].staff} staff · ALOS ${DEPT_ALOS[d]} d`,
              value: fmtN(sl(DEPT_SERIES[d]).reduce((a, b) => a + b, 0)),
              valueSub: STATS_DEPTS[d][1] ? `${STATS_DEPTS[d][1]}% occ` : 'attendances',
              valueColor: STATS_DEPTS[d][1] >= 90 ? '#b32e2e' : '#16202e',
              chevron: true,
              go: () => this.setState({
                modTab: 1,
                stDept: d
              })
            }));
          } else if (s.stLayout === 'ops') {
            M.tiles = LV.live ? [{
              label: 'Admissions',
              v: fmtN(STAT_SERIES.adm[6]),
              color: '#0072a3',
              note: MONTHS7[6] + ' so far'
            }, {
              label: 'Discharges',
              v: fmtN(STAT_SERIES.dis[6]),
              color: '#1e8a7c',
              note: MONTHS7[6] + ' so far'
            }, {
              label: 'Deaths',
              v: String(STAT_SERIES.deaths[6]),
              color: STAT_SERIES.deaths[6] ? '#b32e2e' : '#1d8f57',
              note: MONTHS7[6] + ' so far'
            }, {
              label: 'ER attendances',
              v: fmtN(STAT_SERIES.er[6]),
              color: '#6a52d4',
              note: MONTHS7[6] + ' so far'
            }, {
              label: 'Surgeries',
              v: fmtN(STAT_SERIES.surg[6]),
              color: '#0072a3',
              note: MONTHS7[6] + ' so far'
            }, {
              label: 'Deliveries',
              v: fmtN(STAT_SERIES.deliveries[6]),
              color: '#3ab5a7',
              note: MONTHS7[6] + ' so far'
            }] : [{
              label: 'Beds free now',
              v: String(98 - Math.round(98 * (STATS_DEPTS.MICU || [0, 0])[1] / 100)),
              color: '#1e8a7c',
              note: 'of 98 in-patient'
            }, {
              label: 'ICU occupancy',
              v: '92%',
              color: '#b32e2e',
              note: 'SICU · MICU · CCU'
            }, {
              label: 'Pending discharges',
              v: '14',
              color: '#b8650a',
              note: 'today'
            }, {
              label: 'ER waiting',
              v: '11',
              color: '#6a52d4',
              note: 'avg 22 min'
            }, {
              label: 'OT today',
              v: '18',
              color: '#0072a3',
              note: '3 emergency'
            }, {
              label: 'Deliveries today',
              v: '6',
              color: '#3ab5a7',
              note: '2 CS'
            }];
            M.chart2 = {
              title: 'Occupancy by department · now',
              legend: 'dashed = 85% safe capacity',
              note: 'Red = at or above 90%. Tap a department for detail.',
              rows: DEPTS.filter(d => STATS_DEPTS[d][1]).sort((a, b) => STATS_DEPTS[b][1] - STATS_DEPTS[a][1]).map(d => ({
                label: d,
                v: STATS_DEPTS[d][1] + '%',
                color: STATS_DEPTS[d][1] >= 90 ? '#b32e2e' : STATS_DEPTS[d][1] >= 85 ? '#b8650a' : '#1d8f57',
                bar: `position:absolute;left:0;top:0;bottom:0;width:${STATS_DEPTS[d][1]}%;border-radius:999px;background:${STATS_DEPTS[d][1] >= 90 ? 'linear-gradient(90deg,#e08a1e,#d23a52)' : 'linear-gradient(90deg,#3ab5a7,#0090ca)'}`,
                marker: 'position:absolute;left:85%;top:-2px;bottom:-2px;width:0;border-left:1.5px dashed rgba(210,58,82,.7)'
              }))
            };
            M.rowsTitle = LV.live ? MONTHS7[6] + ' ' + YR + ' · month to date' : 'Today · movements';
            M.rows = (LV.live ? DEPTS.map(d => [DEPT_INFO[d].name, fmtN(DEPT_SERIES[d][6]), '#0072a3', STATS_DEPTS[d][1] ? 'admissions · ' + STATS_DEPTS[d][1] + '% occupancy last month' : 'admissions / attendances']) : [['Admissions so far', '38', '#0072a3', 'ER 21 · OPD 12 · direct 5'], ['Discharges planned', '41', '#1e8a7c', '14 not yet processed'], ['Transfers in / out', '6 / 4', '#3c4858', '2 ICU step-downs'], ['Deaths', '1', '#b32e2e', 'MICU · expected, DNR'], ['Ventilators in use', '17 / 24', '#b8650a', '3 on standby']]).map(([t, v, c, sub]) => row({
              title: t,
              sub,
              value: v,
              valueColor: c
            }));
          } else {
            M.tiles = [{
              label: 'Gross mortality',
              v: mort + '%',
              color: mort > 1.1 ? '#b32e2e' : '#1d8f57',
              note: 'deaths ÷ discharges'
            }, {
              label: 'Discharges',
              v: fmtN(disN),
              color: '#0072a3',
              note: periodLabel.split(' ·')[0]
            }, {
              label: 'Patient-days',
              v: pdN ? fmtN(pdN) : '—',
              color: '#3c4858',
              note: pdN ? periodLabel.split(' ·')[0] : 'no patient-days column'
            }];
            M.chart = chartOf('Average length of stay · days', 'hospital-wide', MONTHS7, STAT_SERIES.alos, '#1e8a7c');
            M.chart2 = {
              title: 'Admissions share by department',
              legend: periodLabel.split(' ·')[0],
              note: '',
              rows: DEPTS.filter(d => d !== 'OPD' && d !== 'Emergency').map(d => ({
                d,
                n: sl(DEPT_SERIES[d]).reduce((a, b) => a + b, 0)
              })).sort((a, b) => b.n - a.n).map(({
                d,
                n
              }) => {
                const tot = DEPTS.filter(x => x !== 'OPD' && x !== 'Emergency').reduce((a, x) => a + sl(DEPT_SERIES[x]).reduce((p, q) => p + q, 0), 0);
                const p = Math.round(n / tot * 100);
                return {
                  label: d,
                  v: p + '%',
                  color: '#16202e',
                  bar: `position:absolute;left:0;top:0;bottom:0;width:${p}%;border-radius:999px;background:linear-gradient(90deg,#6a52d4,#0090ca)`,
                  marker: null
                };
              })
            };
            M.rowsTitle = 'Mortality by department';
            M.rows = DEPTS.filter(d => DEPT_DEATHS[d]).sort((a, b) => DEPT_DEATHS[b] - DEPT_DEATHS[a]).map(d => {
              const dis = STATS_DEPTS[d][0];
              const r = Math.round(DEPT_DEATHS[d] / Math.max(1, dis) * 1000) / 10;
              return row({
                ...avatar(d.slice(0, 4), '#0d2a4a'),
                title: DEPT_INFO[d].name,
                sub: `${DEPT_DEATHS[d]} deaths · ${dis} discharges · ${MONTHS7[5]}`,
                value: r + '%',
                valueColor: r > 10 ? '#b32e2e' : r > 5 ? '#b8650a' : '#1d8f57',
                valueSub: 'mortality',
                chevron: true,
                go: () => this.setState({
                  modTab: 1,
                  stDept: d
                })
              });
            });
          }
        }
        if (tabName === 'Departments') {
          const d = s.stDept;
          const ser = DEPT_SERIES[d];
          const cur = sl(ser).reduce((a, b) => a + b, 0);
          const pv = ser.slice(5 - 2 * pN + 1, 5 - pN + 1).reduce((a, b) => a + b, 0);
          const dd = dl(cur, pv);
          M.filters = [...DEPTS.map(x => ({
            label: x,
            go: () => this.setState({
              stDept: x
            }),
            style: chip(s.stDept === x)
          }))];
          M.primary = {
            label: 'Quick entry',
            go: () => this.setState({
              modTab: 4,
              modForm: {
                ...F,
                dept: d
              }
            })
          };
          M.tiles = [{
            label: STATS_DEPTS[d][1] ? 'Admissions' : 'Attendances',
            v: fmtN(cur),
            color: '#0072a3',
            note: `${dd.t} vs previous`
          }, {
            label: 'Occupancy',
            v: STATS_DEPTS[d][1] ? STATS_DEPTS[d][1] + '%' : '—',
            color: STATS_DEPTS[d][1] >= 90 ? '#b32e2e' : '#1e8a7c',
            note: DEPT_INFO[d].beds ? DEPT_INFO[d].beds + ' beds' : 'no beds'
          }, {
            label: 'Deaths',
            v: String(DEPT_DEATHS[d]),
            color: DEPT_DEATHS[d] ? '#b32e2e' : '#1d8f57',
            note: MONTHS7[5]
          }, {
            label: 'ALOS',
            v: DEPT_ALOS[d] + ' d',
            color: '#3c4858',
            note: ''
          }, {
            label: 'Staff',
            v: String(DEPT_INFO[d].staff),
            color: '#6a52d4',
            note: 'nurses & PCA'
          }, {
            label: 'In-charge',
            v: String(DEPT_INFO[d].incharge || '—').split(' ')[0],
            color: '#16202e',
            note: String(DEPT_INFO[d].incharge || '').split(' ').slice(1).join(' ')
          }];
          M.chart = chartOf(`${d} · ${STATS_DEPTS[d][1] ? 'admissions' : 'attendances'} · 7 months`, 'monthly', MONTHS7, ser, '#0090ca');
          M.rowsTitle = 'Sheet fields · ' + MONTHS7[5];
          M.rows = LV.deptFields(d).map(f => row({
            title: f.label,
            sub: f.sub,
            value: LV.live ? f.value : String(Math.round(cur * 0.9)),
            valueColor: '#16202e'
          }));
          if (!M.rows.length) M.rows = [row({
            title: 'No sheet configured',
            sub: 'Add columns to this department in the desktop console'
          })];
          M.rows.push(row({
            ...avatar('→', '#0072a3'),
            title: 'Open department console',
            sub: 'Responsible persons, submissions, reminders',
            chevron: true,
            go: () => go('deptDetail', {
              selDept: d
            })
          }));
        }
        if (tabName === 'Compare') {
          const METRICS = [['adm', 'Admissions'], ['occ', 'Occupancy %'], ['alos', 'ALOS'], ['deaths', 'Deaths']];
          M.filters = [...METRICS.map(([k, l]) => ({
            label: l,
            go: () => this.setState({
              stMetric: k
            }),
            style: chip(s.stMetric === k)
          }))];
          M.rowsTitle = 'Pick departments to compare';
          const valOf = d => s.stMetric === 'adm' ? sl(DEPT_SERIES[d]).reduce((a, b) => a + b, 0) : s.stMetric === 'occ' ? STATS_DEPTS[d][1] : s.stMetric === 'alos' ? DEPT_ALOS[d] : DEPT_DEATHS[d];
          const mx = Math.max(1, ...s.stCompare.map(valOf));
          M.chart2 = {
            title: `${METRICS.find(x => x[0] === s.stMetric)[1]} · ${periodLabel.split(' ·')[0]}`,
            legend: `${s.stCompare.length} departments`,
            note: s.stMetric === 'occ' ? 'dashed = 85% safe capacity' : '',
            rows: s.stCompare.map(d => {
              const v = valOf(d);
              return {
                label: d,
                v: s.stMetric === 'occ' ? v + '%' : String(v),
                color: '#16202e',
                bar: `position:absolute;left:0;top:0;bottom:0;width:${s.stMetric === 'occ' ? v : v / mx * 100}%;border-radius:999px;background:linear-gradient(90deg,#3ab5a7,#0090ca)`,
                marker: s.stMetric === 'occ' ? 'position:absolute;left:85%;top:-2px;bottom:-2px;width:0;border-left:1.5px dashed rgba(210,58,82,.7)' : null
              };
            })
          };
          M.rows = DEPTS.map(d => {
            const on = s.stCompare.includes(d);
            return row({
              ...avatar(d.slice(0, 4), on ? '#0072a3' : '#9aa6b4'),
              title: DEPT_INFO[d].name,
              sub: `${STATS_DEPTS[d][0]} adm · ${STATS_DEPTS[d][1] ? STATS_DEPTS[d][1] + '% occ · ' : ''}ALOS ${DEPT_ALOS[d]} d`,
              ...(on ? st('Comparing', '#0072a3') : {}),
              go: () => this.setState({
                stCompare: on ? s.stCompare.filter(x => x !== d) : [...s.stCompare, d]
              }),
              cardStyle: `border:1px solid ${on ? 'rgba(0,144,202,.4)' : 'rgba(255,255,255,.9)'};border-radius:15px;padding:11px 13px;background:rgba(255,255,255,${on ? '.8' : '.6'})`
            });
          });
        }
        if (tabName === 'Trends') {
          const TREND = [['adm', 'Admissions', '#0090ca'], ['occ', 'Occupancy %', '#e08a1e'], ['deaths', 'Deaths', '#d23a52'], ['alos', 'ALOS (days)', '#1e8a7c'], ['er', 'ER attendances', '#6a52d4'], ['surg', 'Surgeries', '#0072a3'], ['deliveries', 'Deliveries', '#3ab5a7']];
          M.filters = TREND.map(([k, l]) => ({
            label: l,
            go: () => this.setState({
              stMetric: k
            }),
            style: chip(s.stMetric === k)
          }));
          const tk = TREND.find(t => t[0] === s.stMetric) || TREND[0];
          const ser = STAT_SERIES[tk[0]];
          const last = ser[5],
            first = ser[0];
          const ch = dl(last, first, tk[0] !== 'deaths');
          M.tiles = [{
            label: MONTHS7[0] + ' ' + LV_MONTHS[0].y,
            v: String(first),
            color: '#7d8ea8'
          }, {
            label: MONTHS7[5] + ' ' + LV_MONTHS[5].y,
            v: String(last),
            color: tk[2]
          }, {
            label: '6-month change',
            v: ch.t,
            color: ch.good ? '#1d8f57' : '#b32e2e',
            note: tk[0] === 'deaths' ? 'lower is better' : 'higher is better'
          }];
          M.chart = chartOf(`${tk[1]} · ${MONTHS7[0]} – ${MONTHS7[6]} ${YR}`, MONTHS7[6] + ' is month-to-date', MONTHS7, ser, tk[2]);
          M.rowsTitle = 'Read-outs';
          M.rows = [row({
            title: 'Peak month',
            sub: MONTHS7[ser.indexOf(Math.max(...ser.slice(0, 6)))] + ' ' + YR,
            value: String(Math.max(...ser.slice(0, 6))),
            valueColor: tk[2]
          }), row({
            title: 'Lowest month',
            sub: MONTHS7[ser.indexOf(Math.min(...ser.slice(0, 6)))] + ' ' + YR,
            value: String(Math.min(...ser.slice(0, 6))),
            valueColor: '#7d8ea8'
          }), row({
            title: '6-month average',
            sub: MONTHS7[0] + ' – ' + MONTHS7[5],
            value: String(Math.round(ser.slice(0, 6).reduce((a, b) => a + b, 0) / 6 * 10) / 10),
            valueColor: '#16202e'
          }), row({
            title: MONTHS7[6] + ' projection',
            sub: 'month-to-date × ' + DIM_D + ' ÷ ' + TODAY_D + ' days',
            value: String(Math.round(ser[6] * DIM_D / Math.max(1, TODAY_D))),
            valueColor: '#0072a3',
            valueSub: 'if pace holds'
          })];
        }
        if (tabName === 'Data entry') {
          M.form = {
            title: 'Monthly figures',
            cta: 'Save to statistics',
            fields: [fChips('dept', 'Department', DEPTS, 'LDR'), fChips('month', 'Month', [MONTHS7[5] + ' ' + LV_MONTHS[5].y, MONTHS7[6] + ' ' + LV_MONTHS[6].y], MONTHS7[5] + ' ' + LV_MONTHS[5].y), fInput('adm', 'Admissions', '0', null, true), fInput('dis', 'Discharges', '0', null, true), fInput('deaths', 'Deaths', '0', null, true), fInput('pdays', 'Patient days', '0', 'from census', true)],
            submit: () => this.dataEntry(F)
          };
        }
        if (tabName === 'Manage depts') {
          M.primary = {
            label: 'Add dept',
            go: () => this.modToast('New department form opened')
          };
          M.rowsTitle = 'Departments & custom fields';
          M.rows = DEPTS.map(d => row({
            ...avatar(d.slice(0, 4), '#0d2a4a'),
            title: DEPT_INFO[d].name,
            sub: `id: ${LV.deptId(d)} · ${LV.deptFields(d).length} fields`,
            hasActions: true,
            actions: [btnS('Rename', () => this.modToast('Rename ' + d)), btnS('Fields', () => this.openMod('datacol', 3)), btnS('Archive', () => this.modToast(d + ' archived'), true)]
          }));
        }
      }
      if (m === 'quality') {
        const RAGD = LV.RAGD || {
          LDR: [5, 1, 1],
          CCU: [6, 1, 1],
          SICU: [4, 2, 2],
          MICU: [5, 2, 1],
          NICU: [7, 1, 0],
          Emergency: [6, 1, 1],
          OPD: [5, 1, 0],
          'Cath Lab': [4, 0, 1],
          'CT ICU': [5, 1, 2]
        };
        if (tabName === 'Dashboard') {
          const QT = LV.qTiles || {
            total: 86,
            breaches: 9,
            onTarget: 71,
            depts: 14,
            amber: 6
          };
          M.tiles = [{
            label: 'Indicators',
            v: String(QT.total),
            color: '#16202e',
            note: QT.depts + ' departments'
          }, {
            label: 'Breaches',
            v: String(QT.breaches),
            color: QT.breaches ? '#b32e2e' : '#1d8f57',
            note: 'latest month'
          }, {
            label: 'On target',
            v: QT.onTarget + '%',
            color: '#1d8f57',
            note: QT.amber + ' to watch'
          }];
          M.chart = chartOf('Breaches by month', 'indicators outside benchmark', MONTHS7, LV.breachSeries, '#d23a52');
          M.rowsTitle = 'RAG by department';
          M.rows = DEPTS.map(d => {
            const [g, a, r] = RAGD[d] || RAGD_DEFAULT;
            const t = g + a + r;
            return row({
              ...avatar(d.slice(0, 4), '#0d2a4a'),
              title: DEPT_INFO[d].name,
              sub: `${t} indicators · ${g} green · ${a} amber · ${r} red`,
              value: r ? String(r) : '✓',
              valueColor: r ? '#b32e2e' : '#1d8f57',
              valueSub: r ? 'breach' : 'on target',
              hasSegs: true,
              segs: [`width:${g / t * 100}%;background:#1d8f57`, `width:${a / t * 100}%;background:#e08a1e`, `width:${r / t * 100}%;background:#d23a52`],
              chevron: true,
              go: () => this.setState({
                modTab: 1
              })
            });
          });
        }
        if (tabName === 'Scorecard') {
          M.rowsTitle = 'Hospital ranking · ' + MONTHS7[5];
          M.rows = DEPTS.map(d => [d, RAGD[d] || RAGD_DEFAULT]).map(([d, [g, a, r]]) => ({
            d,
            score: Math.round((g * 100 + a * 50) / (g + a + r))
          })).sort((x, y) => y.score - x.score).map((x, i) => row({
            ...avatar(String(i + 1), i < 3 ? '#1d8f57' : '#0d2a4a'),
            title: DEPT_INFO[x.d].name,
            sub: d => '',
            value: x.score + '%',
            valueColor: x.score >= 85 ? '#1d8f57' : x.score >= 70 ? '#b8650a' : '#b32e2e',
            valueSub: 'compliance',
            hasSegs: true,
            segs: [`width:${x.score}%;background:${x.score >= 85 ? '#1d8f57' : x.score >= 70 ? '#e08a1e' : '#d23a52'}`]
          })).map(r => ({
            ...r,
            sub: 'RAG-weighted score'
          }));
        }
        if (tabName === 'Trends') {
          M.chart = chartOf('Hand hygiene · hospital-wide', '% compliant', MONTHS7, LV.hhSeries, '#1d8f57');
          M.rowsTitle = LV.live ? 'Breaches by department · ' + MONTHS7[5] : 'Biggest movers';
          M.rows = LV.live ? DEPTS.filter(d => (RAGD[d] || RAGD_DEFAULT)[2] + (RAGD[d] || RAGD_DEFAULT)[1]).sort((a, b) => RAGD[b][2] * 2 + RAGD[b][1] - (RAGD[a][2] * 2 + RAGD[a][1])).map(d => row({
            ...avatar(d.slice(0, 4), '#0d2a4a'),
            title: DEPT_INFO[d].name,
            sub: `${RAGD[d][2]} in breach · ${RAGD[d][1]} to watch`,
            value: String(RAGD[d][2]),
            valueColor: RAGD[d][2] ? '#b32e2e' : '#b8650a',
            valueSub: 'breaches'
          })) : [['CLABSI · CCU', '+9.9 per 1000', '#b32e2e', 'worsening'], ['Falls · MICU', '+2.0 per 1000', '#b32e2e', 'worsening'], ['Hand hygiene · CT ICU', '−4 pts', '#b8650a', 'watch'], ['HAPU · LDR', '−1.1 per 1000', '#1d8f57', 'improving'], ['Surgical checklist · all', '+3 pts', '#1d8f57', 'improving']].map(([t, v, c, sub]) => row({
            title: t,
            sub,
            value: v,
            valueColor: c
          }));
          if (!M.rows.length) M.rows = [row({
            title: 'Every indicator is on target',
            sub: 'No breaches in ' + MONTHS7[5]
          })];
        }
        if (tabName === 'Catalog') {
          M.primary = {
            label: 'Indicator',
            go: () => this.modToast('New indicator form opened')
          };
          M.rowsTitle = 'Indicator administration';
          M.rows = IND_CATALOG.map(([n, f, b, act], i) => {
            const on = s.indActive[i] === undefined ? act : s.indActive[i];
            return row({
              title: n,
              sub: f,
              value: b,
              valueSub: 'benchmark',
              valueColor: '#0072a3',
              ...(on ? {} : tagOf('INACTIVE', '#7d8ea8')),
              hasActions: true,
              actions: [btnS('Edit formula', () => this.modToast('Editing ' + n)), btnS('Assign depts', () => this.modToast('Assign ' + n + ' to departments')), btnS(on ? 'Deactivate' : 'Activate', () => this.setState({
                indActive: {
                  ...s.indActive,
                  [i]: !on
                }
              }), on)]
            });
          });
        }
        if (tabName === 'CAPA') {
          M.tiles = [{
            label: 'Open',
            v: CAPA_LIST.filter(c => (dec['capa' + c[0] + c[1]] || c[5]) === 'open').length,
            color: '#b32e2e'
          }, {
            label: 'In progress',
            v: CAPA_LIST.filter(c => (dec['capa' + c[0] + c[1]] || c[5]) === 'progress').length,
            color: '#b8650a'
          }, {
            label: 'Closed',
            v: CAPA_LIST.filter(c => (dec['capa' + c[0] + c[1]] || c[5]) === 'closed').length,
            color: '#1d8f57'
          }];
          M.rowsTitle = 'Action plans';
          M.rows = CAPA_LIST.map(([d, issue, action, owner, due, status0]) => {
            const k = 'capa' + d + issue;
            const status = dec[k] || status0;
            return row({
              ...avatar(d.slice(0, 4), '#0d2a4a'),
              title: issue,
              sub: `${d} · ${owner} · due ${due}`,
              ...stOf(status),
              body: action,
              hasActions: status !== 'closed',
              actions: [btnS('Start', () => setDec(k, 'progress')), btnP('Close', () => setDec(k, 'closed', 'CAPA closed · ' + issue))]
            });
          });
        }
        if (tabName === 'Incidents') {
          M.tiles = [{
            label: 'Open',
            v: INCIDENTS.filter(i => (dec[i[0]] || i[5]) === 'Open').length,
            color: '#b32e2e'
          }, {
            label: 'Under review',
            v: INCIDENTS.filter(i => (dec[i[0]] || i[5]) === 'Under review').length,
            color: '#b8650a'
          }, {
            label: 'Closed',
            v: INCIDENTS.filter(i => (dec[i[0]] || i[5]) === 'Closed').length,
            color: '#1d8f57'
          }];
          M.rowsTitle = 'Incident reports';
          M.rows = INCIDENTS.map(([id, d, type, sev, desc, status0, dbId]) => {
            const status = dec[id] || status0;
            const sc = {
              'Near miss': '#1d8f57',
              Minor: '#b8650a',
              Moderate: '#d23a52',
              Severe: '#8a1c2e'
            }[sev] || '#b8650a';
            return row({
              ...avatar(String(type || '?').slice(0, 3).toUpperCase(), sc),
              title: `${id} · ${type}`,
              sub: `${d} · reported via Nurse App`,
              ...tagOf(String(sev || '').toUpperCase(), sc),
              ...stOf(status),
              body: desc,
              hasActions: status !== 'Closed',
              actions: [btnS('Assign RCA', () => {
                setDec(id, 'Under review', 'Assigned to Quality team');
                this.incidentStatus(dbId, 'Under review');
              }), btnP('Close', () => {
                setDec(id, 'Closed', id + ' closed');
                this.incidentStatus(dbId, 'Closed');
              })]
            });
          });
          if (!M.rows.length) M.rows = [row({
            title: 'No incident reports',
            sub: 'Reports sent from the Nurse App appear here'
          })];
        }
      }
      if (m === 'supervisor') {
        const list = SUP_REPORTS.map(([date, shift, by, scope, sum, status0, id], i) => ({
          k: 'sup' + i,
          id,
          date,
          shift,
          by,
          scope,
          sum,
          status: dec['sup' + i] || status0
        }));
        if (tabName === 'Pending') {
          M.rows = list.filter(r => r.status === 'pending').map(r => row({
            ...avatar(r.shift, '#6a52d4'),
            title: `${r.date} · ${r.shift} shift`,
            sub: `Supervisor ${r.by} · ${r.scope}`,
            body: r.sum,
            ...stOf('pending'),
            hasActions: true,
            actions: [btnP('Approve', () => {
              setDec(r.k, 'approved', 'Approved · ' + r.date + ' ' + r.shift);
              this.shiftStatus(r.id, 'Approved');
            }), btnS('Return', () => {
              setDec(r.k, 'returned', 'Returned to ' + r.by);
              this.shiftStatus(r.id, 'Returned');
            }, true)]
          }));
          M.rowsTitle = 'Awaiting Nurse Manager';
          if (!M.rows.length) M.rows = [row({
            title: 'Nothing pending',
            sub: 'All shift reports approved'
          })];
        }
        if (tabName === 'This week') {
          const SW = LV.supWeek || {
            reports: 19,
            adm: 71,
            events: 4,
            codes: 1,
            byDay: ['Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon'].map((l, i) => ({
              label: l,
              v: [9, 12, 10, 14, 8, 7, 11][i]
            }))
          };
          M.tiles = [{
            label: 'Reports',
            v: String(SW.reports),
            color: '#16202e',
            note: 'last 7 days'
          }, {
            label: 'Admissions',
            v: String(SW.adm),
            color: '#0072a3'
          }, {
            label: 'Events',
            v: String(SW.events),
            color: SW.events ? '#b32e2e' : '#1d8f57',
            note: SW.codes + ' code blue'
          }];
          M.chart = chartOf('Admissions by day', 'all wards', SW.byDay.map(x => x.label), SW.byDay.map(x => x.v), '#6a52d4');
          M.rows = list.map(r => row({
            ...avatar(r.shift, '#6a52d4'),
            title: `${r.date} · ${r.shift}`,
            sub: r.by,
            ...stOf(r.status),
            chevron: true
          }));
        }
        if (tabName === 'Sections') {
          M.primary = {
            label: 'Section',
            go: () => this.modToast('Custom section builder opened')
          };
          M.rowsTitle = 'Report template sections';
          M.rows = SUP_SECTIONS.map((sec, i) => row({
            ...avatar(String(i + 1), '#3c4858'),
            title: sec,
            sub: i < 7 ? 'Counts' : 'Patient register rows',
            hasActions: true,
            actions: [btnS('Edit fields', () => this.modToast('Editing ' + sec)), btnS('Hide', () => this.modToast(sec + ' hidden from the form'), true)]
          }));
        }
      }
      if (m === 'staff') {
        const nurses = STAFF_ROWS.filter(r => r[3] === 'Nurse'),
          pcas = STAFF_ROWS.filter(r => r[3] === 'PCA');
        const staffRow = ([n, des, d, role, emp]) => row({
          ...avatar(ini(n), role === 'PCA' ? '#6a52d4' : '#0090ca'),
          title: n,
          sub: `${des} · ${d} · ${emp}`,
          ...tagOf(role.toUpperCase(), role === 'PCA' ? '#6a52d4' : '#0072a3'),
          chevron: true,
          go: () => this.modToast('Opening profile · ' + n)
        });
        if (tabName === 'Overview') {
          M.primary = {
            label: 'Add staff',
            go: () => this.modToast('Add nurse / PCA form opened')
          };
          M.tiles = [{
            label: 'Nurses',
            v: String(nurses.length),
            color: '#0072a3',
            note: 'on the register'
          }, {
            label: 'PCAs',
            v: String(pcas.length),
            color: '#6a52d4'
          }, {
            label: 'Compliance',
            v: COMPLIANCE.length,
            color: COMPLIANCE.length ? '#b32e2e' : '#1d8f57',
            note: 'items to fix'
          }];
          M.chart = chartOf('Nurses by department', 'headcount', DEPTS.slice(0, 7).map(d => d.length > 4 ? d.slice(0, 3) : d), DEPTS.slice(0, 7).map(d => DEPT_INFO[d].staff), '#0090ca');
          M.rowsTitle = 'Recently updated';
          M.rows = STAFF_ROWS.slice(0, 4).map(staffRow);
        }
        if (tabName === 'Nurses') {
          M.primary = {
            label: 'Add nurse',
            go: () => this.modToast('Add nurse form opened')
          };
          M.rowsTitle = 'Nurse directory · ' + nurses.length;
          M.rows = nurses.slice(0, 150).map(staffRow);
        }
        if (tabName === 'PCA') {
          M.primary = {
            label: 'Add PCA',
            go: () => this.modToast('Add PCA form opened')
          };
          M.rowsTitle = 'PCA directory · ' + pcas.length;
          M.rows = pcas.slice(0, 150).map(staffRow);
        }
        if (tabName === 'Compliance') {
          M.rowsTitle = 'Records that need attention';
          if (!COMPLIANCE.length) M.rows = [row({
            title: 'Nothing outstanding',
            sub: 'Every register record is complete'
          })];else M.rows = COMPLIANCE.map(([n, issue, due, c], i) => {
            const k = 'comp' + i;
            const done = dec[k] === 'done';
            return row({
              ...avatar(ini(n), c),
              title: n,
              sub: issue,
              value: due,
              valueColor: c,
              valueSub: done ? 'reminded' : 'due',
              hasActions: !done,
              actions: [btnS('Remind', () => setDec(k, 'done', 'Reminder sent to ' + n)), btnS('Open record', () => this.modToast('Opening ' + n))]
            });
          });
        }
        if (tabName === 'Privileges') {
          M.primary = {
            label: 'Privilege',
            go: () => this.modToast('New clinical privilege group')
          };
          M.rowsTitle = 'Clinical privilege groups';
          M.rows = PRIV_GROUPS.map(([g, depts, n]) => row({
            ...avatar(String(n), '#1e8a7c'),
            title: g,
            sub: depts,
            valueSub: 'depts',
            hasActions: true,
            actions: [btnS('Edit items', () => this.modToast('Editing ' + g)), btnS('Assign by dept', () => this.modToast('Bulk assign · ' + g))]
          }));
        }
      }
      if (m === 'datacol') {
        if (tabName === 'Review') {
          M.tiles = [{
            label: 'Pending',
            v: pendingDc,
            color: '#0072a3'
          }, {
            label: 'Out of range',
            v: QUEUE.filter(x => !x.ok && !s.decisions[x.id]).length,
            color: '#b32e2e'
          }, {
            label: 'Approved',
            v: Object.values(s.decisions).filter(d => d.status === 'Approved').length,
            color: '#1d8f57'
          }];
          M.rows = [row({
            ...avatar('→', '#0072a3'),
            title: 'Open the review queue',
            sub: 'Approve, return with reason, bulk approve in-range',
            chevron: true,
            go: () => go('approvals')
          })];
        }
        if (tabName === 'Responsible persons') {
          M.primary = {
            label: 'Assign',
            go: () => this.modToast('Assign responsible person')
          };
          M.rowsTitle = 'Who owns each department';
          M.rows = DEPTS.map(d => {
            const u = users.find(x => x.depts.includes(d));
            return row({
              ...avatar(d.slice(0, 4), '#0d2a4a'),
              title: DEPT_INFO[d].incharge,
              sub: `${DEPT_INFO[d].name} · ${u ? '@' + u.username : 'no login yet'}`,
              ...(u ? tagOf('LOGIN', '#0072a3') : tagOf('NO LOGIN', '#b8650a')),
              chevron: true,
              go: () => u ? this.openUser(u.username) : this.newUser(null)
            });
          });
        }
        if (tabName === 'Share links') {
          M.primary = {
            label: 'New link',
            go: () => this.modToast('Share link created · /s/' + Math.random().toString(36).slice(2, 7).toUpperCase())
          };
          M.rowsTitle = 'No-login submission links';
          M.rows = SHARE_LINKS.map(([code, type, d, person, exp, active0]) => {
            const active = s.revoked[code] ? false : active0;
            return row({
              ...avatar(type === 'Quality data' ? 'Q' : 'S', type === 'Quality data' ? '#6a52d4' : '#0072a3'),
              title: code,
              sub: `${type} · ${d} · ${person}`,
              value: exp,
              valueColor: active ? '#16202e' : '#7d8ea8',
              valueSub: active ? 'expires' : '',
              ...stOf(active ? 'active' : exp === 'expired' ? 'expired' : 'revoked'),
              hasActions: active,
              actions: [btnS('Copy link', () => this.modToast('Copied unico.health' + code)), btnS('Revoke', () => {
                this.setState({
                  revoked: {
                    ...s.revoked,
                    [code]: true
                  }
                });
                this.modToast(code + ' revoked');
              }, true)]
            });
          });
        }
        if (tabName === 'Form fields') {
          M.rowsTitle = 'Patient statistics fields per department';
          M.rows = Object.entries(FORM_FIELDS).map(([d, fields]) => row({
            ...avatar(d.slice(0, 4), '#0d2a4a'),
            title: (DEPT_INFO[d] || {
              name: d
            }).name,
            sub: fields.join(' · '),
            value: String(fields.length),
            valueSub: 'fields',
            hasActions: true,
            actions: [btnS('Add field', () => this.modToast('Add field to ' + d)), btnS('Reorder', () => this.modToast('Reorder ' + d))]
          }));
        }
        if (tabName === 'Analytics') {
          const DA = LV.dcAnalytics || {
            accuracy: 94,
            turnaround: 1.4,
            perMonth: [102, 108, 111, 106, 113, 118, 41],
            collectors: [['Mahmuda Akter', 'SICU', 9, 1], ['Sabina Nasrin', 'CT ICU', 8, 2], ['Priya Das', 'LDR', 10, 1], ['Farhana Haque', 'MICU', 7, 3], ['Rakibul Hasan', 'Emergency', 5, 0]].map(([n, d, ok, rej]) => ({
              n,
              d,
              ok,
              rej
            }))
          };
          M.tiles = [{
            label: 'Accuracy',
            v: DA.accuracy == null ? '—' : DA.accuracy + '%',
            color: '#1d8f57',
            note: 'approved ÷ reviewed'
          }, {
            label: 'Pending',
            v: String(pendingDc),
            color: '#b8650a',
            note: 'awaiting review'
          }, {
            label: 'Turnaround',
            v: DA.turnaround == null ? '—' : DA.turnaround + ' d',
            color: '#0072a3',
            note: 'avg review'
          }];
          M.chart = chartOf('Submissions received', 'per month', MONTHS7, DA.perMonth, '#0090ca');
          M.rowsTitle = 'Collector performance';
          M.rows = DA.collectors.map(({
            n,
            d,
            ok,
            rej
          }) => row({
            ...avatar(ini(n)),
            title: n,
            sub: `${d} · ${ok + rej} submissions`,
            value: Math.round(ok / (ok + rej) * 100) + '%',
            valueColor: ok / (ok + rej) >= .85 ? '#1d8f57' : '#b8650a',
            valueSub: `${rej} returned`
          }));
        }
      }
      if (m === 'reports') {
        if (tabName === 'Generate') {
          M.form = {
            title: 'Report builder',
            cta: 'Generate PDF',
            fields: [fChips('rtype', 'Report type', ['Summary', 'Detailed', 'Comparison'], 'Summary'), fChips('rscope', 'Data', ['Patient statistics', 'Quality indicators', 'Manpower'], 'Quality indicators'), fChips('rperiod', 'Period', ['Latest month', 'Last 3 months', 'Last 6 months', 'Custom'], 'Latest month'), fChips('rcharts', 'Charts', ['Bar', 'Line', 'Area + target', 'Donut', 'Heatmap'], ['Bar', 'Line'], true), fChips('rpage', 'Page', ['A4', 'A3', 'Letter'], 'A4'), fChips('rorient', 'Orientation', ['Portrait', 'Landscape'], 'Portrait'), fToggle('rconf', 'Confidential watermark', 'Stamps every page', true)],
            submit: () => this.modToast(`${F.rtype || 'Summary'} · ${F.rscope || 'Quality indicators'} PDF generated · saved to Reports`)
          };
        }
        if (tabName === 'Saved') {
          M.rowsTitle = 'Generated reports';
          if (!SAVED_REPORTS.length) M.rows = [row({
            title: 'No saved reports on this phone',
            sub: 'Generate one from the Generate tab or the desktop console'
          })];else M.rows = SAVED_REPORTS.map(([t, meta, when, ext]) => row({
            ...avatar(ext, '#b32e2e'),
            title: t,
            sub: `${meta} · ${when}`,
            hasActions: true,
            actions: [btnS('Download', () => this.modToast('Downloading ' + t)), btnS('Share to chat', () => this.modToast('Shared to All Nursing Staff')), btnS('Print', () => this.modToast('Sent to printer'))]
          }));
        }
        if (tabName === 'Header & footer') {
          M.form = {
            title: 'Report header & footer',
            cta: 'Save layout',
            fields: [fInput('rt', 'Title', 'Monthly Quality Report'), fInput('rst', 'Subtitle', 'Nursing Services · ' + HOSP.name), fInput('rh', 'Hospital name', HOSP.name), fInput('rf', 'Footer note', 'Prepared by Nursing Administration · confidential'), fToggle('rlogo', 'Show logo', 'Top-left of every page', true), fToggle('rsign', 'Signature block', 'Prepared / Checked / Approved by', true)],
            submit: () => this.modToast('Header & footer saved for all reports')
          };
        }
      }
      if (m === 'perf') {
        if (tabName === 'Cycles') {
          const PS = LV.perfStats || {
            done: 174,
            total: 186,
            avg: 4.1
          };
          M.primary = {
            label: 'Cycle',
            go: () => this.modToast('Appraisals are started from a staff record in the desktop console')
          };
          M.tiles = [{
            label: 'Completed',
            v: String(PS.done),
            color: '#1d8f57',
            note: 'of ' + PS.total + ' appraisals'
          }, {
            label: 'Pending',
            v: String(APPRAISALS.filter((a, i) => !dec['app' + i]).length),
            color: '#b8650a',
            note: 'manager sign-off'
          }, {
            label: 'Avg score',
            v: PS.avg == null ? '—' : String(PS.avg),
            color: '#0072a3',
            note: 'of 5'
          }];
          M.rowsTitle = 'Appraisal cycles';
          M.rows = (LV.cycles || [['Jan – Jun 2026', '174 / 186 completed', 94, '#1d8f57', 'open'], ['Jul – Dec 2025', '186 / 186 completed', 100, '#1d8f57', 'closed'], ['Jan – Jun 2025', '181 / 184 completed', 98, '#1d8f57', 'closed']]).map(([t, sub, p, c, status]) => row({
            ...avatar(t.slice(0, 3), '#1e8a7c'),
            title: t,
            sub,
            value: p + '%',
            valueColor: c,
            ...stOf(status),
            hasSegs: true,
            segs: [`width:${p}%;background:${c}`]
          }));
        }
        if (tabName === 'Pending sign-off') {
          M.rowsTitle = 'Awaiting sign-off';
          M.rows = APPRAISALS.map(([n, d, score, by, id], i) => {
            const k = 'app' + i;
            const done = !!dec[k];
            return row({
              ...avatar(ini(n || '?')),
              title: n,
              sub: `${d} · appraised by ${by}`,
              value: score,
              valueColor: Number(score) >= 4 ? '#1d8f57' : '#b8650a',
              valueSub: 'of 5',
              ...(done ? stOf('approved') : {}),
              hasActions: !done,
              actions: [btnS('View form', () => this.modToast('Open the full form in the desktop console · ' + n)), btnP('Sign off', () => {
                setDec(k, 'approved', 'Signed off · ' + n);
                this.appraisalAction(id);
              })]
            });
          });
          if (!M.rows.length) M.rows = [row({
            title: 'Nothing awaiting sign-off',
            sub: 'Appraisals appear here once an assessor completes the form'
          })];
        }
        if (tabName === 'Bands') {
          const BD = LV.bands || [['<2.5', 2], ['2.5–3', 6], ['3–3.5', 21], ['3.5–4', 58], ['4–4.5', 64], ['4.5+', 23]];
          const bn = i => BD[i][1] + ' nurse' + (BD[i][1] === 1 ? '' : 's');
          M.chart = chartOf('Score distribution', 'nurses', BD.map(b => b[0]), BD.map(b => b[1]), '#1e8a7c');
          M.rowsTitle = 'Performance bands';
          M.rows = [['Outstanding', '4.5 – 5.0', bn(5), '#1d8f57'], ['Exceeds expectations', '4.0 – 4.4', bn(4), '#1d8f57'], ['Meets expectations', '3.5 – 3.9', bn(3), '#0072a3'], ['Needs improvement', '2.5 – 3.4', bn(1) + ' + ' + bn(2), '#b8650a'], ['Unsatisfactory', '< 2.5', bn(0), '#b32e2e']].map(([t, r, n, c]) => row({
            title: t,
            sub: n,
            value: r,
            valueColor: c,
            valueSub: 'score band'
          }));
        }
      }
      if (m === 'roster') {
        const rows = ROSTERS.map(([d, mo, by, sub, status0, ref], i) => ({
          k: 'ros' + i,
          ref,
          d,
          mo,
          by,
          sub,
          status: dec['ros' + i] || status0
        }));
        if (tabName === 'Review queue') {
          M.tiles = [{
            label: 'Submitted',
            v: rows.filter(r => r.status === 'submitted').length,
            color: '#0072a3'
          }, {
            label: 'Draft',
            v: rows.filter(r => r.status === 'draft').length,
            color: '#7d8ea8'
          }, {
            label: 'Approved',
            v: rows.filter(r => r.status === 'approved').length,
            color: '#1d8f57'
          }];
          M.rowsTitle = LV.rosterMonth.split(' ')[0] + ' rosters';
          M.rows = rows.filter(r => r.mo === LV.rosterMonth).map(r => row({
            ...avatar(r.d.slice(0, 4), '#0d2a4a'),
            title: `${r.d} · ${r.mo}`,
            sub: `Prepared by ${r.by} · ${r.sub}`,
            ...stOf(r.status),
            hasActions: r.status === 'submitted',
            actions: [btnS('Full review', () => this.modToast('Open the full grid in the desktop console · ' + r.d)), btnP('Approve', () => {
              setDec(r.k, 'approved', r.d + ' roster approved & published');
              this.rosterStatus(r.ref, 'approved');
            }), btnS('Return', () => {
              setDec(r.k, 'draft', 'Returned to ' + r.by);
              this.rosterStatus(r.ref, 'draft');
            }, true)]
          }));
          if (!M.rows.length) M.rows = [row({
            title: 'No rosters for ' + LV.rosterMonth,
            sub: 'In-charges prepare rosters in the desktop console'
          })];
        }
        if (tabName === 'Departments') {
          M.rowsTitle = 'Roster status by department';
          M.rows = DEPTS.map(d => {
            const r = rows.find(x => (x.d === d || x.d === DEPT_INFO[d].name) && x.mo === LV.rosterMonth);
            return row({
              ...avatar(d.slice(0, 4), '#0d2a4a'),
              title: DEPT_INFO[d].name,
              sub: `${DEPT_INFO[d].staff} staff · in-charge ${DEPT_INFO[d].incharge}`,
              ...stOf(r ? r.status : 'draft'),
              chevron: true,
              go: () => this.setState({
                modTab: 0
              })
            });
          });
        }
        if (tabName === 'Shift codes') {
          M.primary = {
            label: 'Code',
            go: () => this.modToast('New shift code')
          };
          M.rowsTitle = 'Hospital shift codes';
          M.rows = SHIFT_CODES.map(([c, t, n, h]) => row({
            ...avatar(c, {
              G: '#1e8a7c',
              M: '#0090ca',
              E: '#e08a1e',
              N: '#6a52d4',
              D: '#3c4858'
            }[c[0]]),
            title: `${c} · ${n}`,
            sub: t,
            value: h + ' h',
            valueSub: 'paid',
            hasActions: true,
            actions: [btnS('Edit', () => this.modToast('Editing ' + c)), btnS('Retire', () => this.modToast(c + ' retired'), true)]
          }));
        }
      }
      if (m === 'medicine') {
        const fm = (s.meds || []).filter(x => !s.amRemoved[x.id]);
        const isAlert = x => s.amFlags[x.id] && s.amFlags[x.id].alert !== undefined ? s.amFlags[x.id].alert : x.alert;
        const STOCK = {
          napa: 'In stock',
          anadol: 'Controlled · locked',
          ceftron: 'In stock',
          actrapid: 'Low stock',
          comet: 'Stock out',
          indever: 'Low stock',
          lasix: 'In stock'
        };
        const medRow = x => {
          const alert = isAlert(x);
          const stock = STOCK[x.id] || 'In stock';
          const sc = stock.startsWith('In') ? '#1d8f57' : stock.startsWith('Low') ? '#b8650a' : stock.startsWith('Stock') ? '#b32e2e' : '#6a52d4';
          const edited = !!s.amEdits[x.id];
          return row({
            av: '',
            avStyle: `width:44px;height:44px;border-radius:12px;border:1px solid rgba(125,145,180,.2);flex-shrink:0;background:#fff url(${x.img}) center/calc(100% - 8px) no-repeat`,
            title: x.brand,
            sub: `${x.generic} ${x.strength} · ${x.mfr}`,
            ...(alert ? tagOf('HIGH ALERT', '#b32e2e') : edited ? tagOf('EDITED', '#6a52d4') : {}),
            ...st(stock, sc),
            chevron: true,
            go: () => this.openMed(x.id),
            hasActions: true,
            actions: [btnS('Full details', () => this.openMed(x.id)), btnS(alert ? 'Remove high-alert' : 'Mark high-alert', () => {
              this.setState({
                amFlags: {
                  ...s.amFlags,
                  [x.id]: {
                    ...(s.amFlags[x.id] || {}),
                    alert: !alert
                  }
                }
              });
              this.modToast(x.brand + (alert ? ' removed from' : ' added to') + ' high-alert list');
            }, !alert)]
          });
        };
        if (tabName === 'Formulary') {
          M.primary = {
            label: 'Medicine',
            go: () => this.modToast('Add medicine · monograph form')
          };
          M.tiles = [{
            label: 'Medicines',
            v: String(fm.length),
            color: '#16202e',
            note: 'in formulary'
          }, {
            label: 'High-alert',
            v: fm.filter(isAlert).length,
            color: '#b32e2e'
          }, {
            label: 'Requests',
            v: MED_REQUESTS.filter(r => (dec['mreq' + (r[4] || r[0])] || r[3]) === 'pending').length,
            color: '#b8650a',
            note: 'from wards'
          }];
          M.rowsTitle = s.meds === null ? 'Loading formulary…' : 'Formulary · tap for full monograph';
          M.rows = fm.map(medRow);
        }
        if (tabName === 'High-alert') {
          M.rowsTitle = 'Independent double check required';
          M.rows = fm.filter(isAlert).map(medRow);
        }
        if (tabName === 'Stock') {
          M.rowsTitle = 'Ward stock status';
          if (!MEDS_ADMIN.length) M.rows = [row({
            title: 'Stock levels are not tracked here yet',
            sub: 'Ward stock lives with the pharmacy system'
          })];else M.rows = MEDS_ADMIN.filter(x => !x[4].startsWith('In')).map((x, i) => row({
            ...avatar(x[0].slice(0, 2).toUpperCase(), '#b8650a'),
            title: x[0],
            sub: x[1],
            ...st(x[4], x[4].startsWith('Stock') ? '#b32e2e' : '#b8650a'),
            chevron: true,
            go: () => {
              const hit = (s.meds || []).find(mm => mm.brand === x[0]);
              if (hit) this.openMed(hit.id);
            },
            hasActions: true,
            actions: [btnS('Notify pharmacy', () => this.modToast('Pharmacy notified · ' + x[0])), btnS('Notify wards', () => this.modToast('Stock notice sent to Nurse App'))]
          }));
        }
        if (tabName === 'Requests') {
          M.rowsTitle = 'Add-to-formulary requests';
          M.rows = MED_REQUESTS.map(([name, from, why, status0, id]) => {
            const k = 'mreq' + (id || name);
            const status = dec[k] || status0;
            return row({
              ...avatar('Rx', '#6a52d4'),
              title: name,
              sub: from,
              body: why,
              ...stOf(status),
              hasActions: status === 'pending',
              actions: [btnP('Approve & add', () => {
                setDec(k, 'approved', name + ' added to formulary');
                this.medDecide(id, 'Approved');
              }), btnS('Decline', () => {
                setDec(k, 'returned', 'Declined · ' + name);
                this.medDecide(id, 'Declined');
              }, true)]
            });
          });
          if (!M.rows.length) M.rows = [row({
            title: 'No requests from the wards',
            sub: 'Nurses send them from Medicine info in the app'
          })];
        }
      }
      const portalRoles = roles.filter(r => r.kind === 'portal');
      const featOn = (fid, roleId) => {
        const k = fid + ':' + roleId;
        if (s.aaFeat[k] !== undefined) return s.aaFeat[k];
        const r = roles.find(x => x.id === roleId);
        return !!(r && r.appFeats[fid]);
      };
      const aaDirty = Object.keys(s.aaFeat).some(k => s.aaFeat[k] !== s.aaPublished[k]) || Object.keys(s.aaPublished).some(k => s.aaFeat[k] !== s.aaPublished[k]);
      const triState = (cur, set) => [['inherit', 'Default'], ['on', 'Allow'], ['off', 'Block']].map(([k, l]) => ({
        label: l,
        go: () => set(k),
        style: `border:0;border-radius:7px;padding:5px 8px;font-size:10.5px;font-weight:700;cursor:pointer;white-space:nowrap;${cur === k ? k === 'off' ? 'background:#d23a52;color:#fff' : k === 'on' ? 'background:#1d8f57;color:#fff' : 'background:#fff;color:#16202e;box-shadow:0 1px 3px rgba(0,0,0,.12)' : 'background:transparent;color:#6c7a8c'}`
      }));
      const effective = (fid, roleId, dept, userOv) => {
        let v = featOn(fid, roleId);
        const dOv = (s.aaDeptOv[dept] || {})[fid];
        if (dOv === 'on') v = true;
        if (dOv === 'off') v = false;
        if (userOv === 'on') v = true;
        if (userOv === 'off') v = false;
        return v;
      };
      const deptOv = s.aaDeptOv[s.aaDept] || {};
      const cm = s.cm;
      const setCm = p => this.setState({
        cm: {
          ...cm,
          ...p
        }
      });
      const cmAddField = () => {
        const t = cm.fieldDraft.trim();
        if (!t) return;
        setCm({
          fields: [...cm.fields, t],
          fieldDraft: ''
        });
      };
      const udRole = udRoleObj.id;
      const aaCols = `grid-template-columns:1fr repeat(${portalRoles.length},40px)`;
      const shortLabel = l => l.length > 7 ? l.slice(0, 6) + '.' : l;
      const re = s.re || roles[0];
      const setRe = p => this.setState({
        re: {
          ...re,
          ...p
        }
      });
      const reMembers = users.filter(u => roleOf(u).id === re.id);
      const reHas = (m, a) => Array.isArray(re.perms[m]) && re.perms[m].includes(a);
      const reToggle = (m, a) => {
        const cur = Array.isArray(re.perms[m]) ? [...re.perms[m]] : [];
        let next;
        if (cur.includes(a)) {
          next = cur.filter(x => x !== a);
          if (a === 'view') next = [];
        } else {
          next = [...cur, a];
          if (a !== 'view' && !next.includes('view')) next.push('view');
        }
        setRe({
          perms: {
            ...re.perms,
            [m]: ACTS.filter(x => next.includes(x))
          }
        });
      };
      const reValid = !!re.label.trim() && (re.id || !roles.some(r => r.label.toLowerCase() === re.label.trim().toLowerCase()));
      const levelOf = r => this.levelOf(r);
      const LEVEL_NAMES = ['System', 'Nursing leadership', 'Department managers', 'Ward in-charge', 'Ward staff', 'Support'];
      const roleD = r => r.kind === 'admin' ? 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' : r.kind === 'portal' ? 'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z' : 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 3a4 4 0 110 8 4 4 0 010-8z';
      const managerOf = dept => {
        const cl = s.clusters.find(c => c.depts.includes(dept));
        const mu = cl && users.find(u => u.username === cl.manager);
        return mu ? mu.name : '—';
      };
      const reportsToOf = u => {
        const r = roleOf(u);
        const p = roles.find(x => x.id === r.parent);
        if (!p) return 'No one · top of the hierarchy';
        const dept = u.depts[0];
        if (p.id === 'incharge' && dept) return `${DEPT_INFO[dept] ? DEPT_INFO[dept].incharge : 'In-charge'} · Nurse in-charge, ${dept}`;
        if (p.id === 'Nurse Manager' && dept) return `${managerOf(dept)} · Nurse Manager`;
        if (p.id === 'CNS') {
          const c = users.find(x => roleOf(x).id === 'CNS');
          return (c ? c.name : 'CNS') + ' · Chief of Nursing Services';
        }
        const holder = users.find(x => roleOf(x).id === p.id);
        return (holder ? holder.name + ' · ' : '') + p.label;
      };
      const ruleApprovers = rule => s.rules[rule.id] || rule.def;
      const cnsUser = users.find(u => roleOf(u).id === 'CNS') || users.find(u => roleOf(u).kind === 'admin') || users[0] || {
        name: me.name || '—',
        username: me.username || ''
      };
      const approverRoles = roles.filter(r => r.kind !== 'admin' && ['CNS', 'Nurse Manager', 'incharge', 'Quality Officer', 'Department Head', 'Manager'].includes(r.id) || r.kind === 'console' && levelOf(r) <= 2 && r.id !== 'Read-only' && r.id !== 'IT Helpdesk');
      const udOv = s.udFeatOv[ud.username] || {};
      const pvNavDef = [['home', 'Home', 'M3 11l9-8 9 8v9a2 2 0 01-2 2h-4v-7h-6v7H5a2 2 0 01-2-2z', 'home'], ['roster', 'Roster', 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z', 'roster'], ['chatDept', 'Chat', 'M21 12a8 8 0 01-8 8H8l-5 3 1.5-4.5A8 8 0 1121 12z', 'chat'], ['meds', 'Meds', 'M10.5 20.5l10-10a4.95 4.95 0 00-7-7l-10 10a4.95 4.95 0 007 7zM8.5 8.5l7 7', 'meds'], ['home', 'Me', 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 3a4 4 0 110 8 4 4 0 010-8z', 'me']];
      const AM_TABS = {
        overview: ['Indications', 'Composition', 'Pharmacology'],
        dosage: ['Dosage & Administration', 'Administration', 'Pediatric Uses', 'Duration Of Treatment'],
        safety: ['Side Effects', 'Contraindications', 'Drug Interactions', 'Precautions And Warnings', 'Overdose Effects', 'Pregnancy & Lactation', 'Use In Special Populations'],
        more: ['Storage']
      };
      const AM_COLOR = {
        'Indications': '#0072a3',
        'Composition': '#3c4858',
        'Pharmacology': '#6a52d4',
        'Dosage & Administration': '#0072a3',
        'Administration': '#1e8a7c',
        'Pediatric Uses': '#b8650a',
        'Duration Of Treatment': '#3c4858',
        'Side Effects': '#b8650a',
        'Contraindications': '#b32e2e',
        'Drug Interactions': '#b32e2e',
        'Precautions And Warnings': '#b8650a',
        'Overdose Effects': '#b32e2e',
        'Pregnancy & Lactation': '#6a52d4',
        'Use In Special Populations': '#3c4858',
        'Storage': '#1e8a7c'
      };
      const FOODS = {
        with: 'With food',
        before: 'Before meals',
        any: 'Any time',
        na: 'N/A (IV/IM)'
      };
      const PREGS = {
        safe: ['Safe', '#1d8f57'],
        caution: ['Caution', '#b8650a'],
        avoid: ['Avoid', '#b32e2e']
      };
      const amRaw = (s.meds || []).find(x => x.id === s.amSel) || (s.meds || [])[0] || {
        id: '',
        brand: '',
        generic: '',
        cls: '',
        cat: '',
        route: '',
        strength: '',
        img: '',
        mfr: '',
        price: '',
        alert: false,
        nursing: '',
        facts: {
          max: '',
          food: 'any',
          preg: 'safe'
        },
        sec: {}
      };
      const amEd = s.amEdits[amRaw.id] || {};
      const amFlag = s.amFlags[amRaw.id] || {};
      const amSecAll = {
        ...(s.mono[amRaw.id] || {}),
        ...amRaw.sec,
        ...(amEd.sec || {})
      };
      const amAlert = amFlag.alert !== undefined ? amFlag.alert : amRaw.alert;
      const setAmSec = (k, v) => this.setState({
        amEdits: {
          ...s.amEdits,
          [amRaw.id]: {
            ...amEd,
            sec: {
              ...(amEd.sec || {}),
              [k]: v
            }
          }
        }
      });
      const modBadge = {
        datacol: pendingDc,
        supervisor: SUP_REPORTS.filter((r, i) => (dec['sup' + i] || r[5]) === 'pending').length,
        roster: ROSTERS.filter((r, i) => (dec['ros' + i] || r[4]) === 'submitted').length,
        perf: APPRAISALS.filter((a, i) => !dec['app' + i]).length,
        quality: INCIDENTS.filter(i => (dec[i[0]] || i[5]) === 'Open').length,
        medicine: MED_REQUESTS.filter(r => (dec['mreq' + (r[4] || r[0])] || r[3]) === 'pending').length
      };
      const modStat = LV.live ? {
        stats: [STAT_SERIES.adm[5].toLocaleString('en-US'), 'admissions · ' + MONTHS7[5] + (STAT_SERIES.occ[5] ? ' · ' + STAT_SERIES.occ[5] + '% occ' : '')],
        quality: [String((LV.qTiles || {}).total || 0), 'indicators'],
        supervisor: [String((LV.supWeek || {}).reports || 0), 'reports this week'],
        staff: [String(STAFF_ROWS.length), 'nurses & PCAs'],
        datacol: [String(pendingDc), 'pending review'],
        reports: [String(SAVED_REPORTS.length), 'saved reports'],
        users: [String(users.length), 'accounts'],
        perf: [(LV.perfStats || {}).done + '/' + (LV.perfStats || {}).total, 'appraisals done'],
        roster: [String(ROSTERS.filter(r => r[4] === 'submitted').length), 'rosters to approve'],
        medicine: [String((s.meds || []).length), 'medicines']
      } : {
        stats: ['4,131', 'admissions · Aug · 86% occ'],
        quality: ['86', 'indicators'],
        supervisor: ['19', 'reports this week'],
        staff: ['228', 'nurses & PCAs'],
        datacol: [String(pendingDc), 'pending review'],
        reports: ['4', 'saved reports'],
        users: [String(users.length), 'accounts'],
        perf: ['174/186', 'appraisals done'],
        roster: ['3', 'rosters to approve'],
        medicine: ['20', 'medicines']
      };
      const toastSet = msg => {
        this.setState({
          setToast: msg
        });
        setTimeout(() => this.setState({
          setToast: ''
        }), 2400);
      };
      return {
        screenChips: SCREENS.map(([k, l], i) => ({
          n: String(i + 1).padStart(2, '0'),
          label: l,
          go: () => k === 'drawer' ? this.setState({
            screen: 'home',
            drawerOpen: true
          }) : k === 'userDetail' ? this.openUser(s.selUser) : k === 'newUser' ? this.newUser(null) : k === 'deptDetail' ? go('deptDetail') : k === 'module' ? this.openMod(s.mod, s.modTab) : k === 'medDetail' ? this.openMed(s.amSel) : k === 'roleEdit' ? this.editRole(s.re || s.roles[1]) : go(k),
          style: `display:inline-flex;align-items:center;gap:6px;${chip(k === 'drawer' ? s.drawerOpen : k === 'newUser' ? s.screen === 'userDetail' && s.udNew : s.screen === k && !s.drawerOpen && !(k === 'userDetail' && s.udNew))}`
        })),
        sModules: s.screen === 'modules',
        sModule: s.screen === 'module',
        goModules: () => go('modules'),
        sMedDetail: s.screen === 'medDetail',
        backToFormulary: () => this.openMod('medicine', s.modTab),
        amToast: s.amToast,
        amEditing: s.amEditing,
        amReadOnly: !s.amEditing,
        amToggleEdit: () => this.setState({
          amEditing: !s.amEditing
        }),
        amEditLabel: s.amEditing ? 'Cancel' : 'Edit monograph',
        amEditBtn: `border:1px solid ${s.amEditing ? 'rgba(125,145,180,.35)' : 'rgba(106,82,212,.4)'};border-radius:11px;padding:9px 12px;background:${s.amEditing ? 'rgba(255,255,255,.7)' : 'linear-gradient(140deg,#6a52d4,#0072a3)'};color:${s.amEditing ? '#16202e' : '#fff'};font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap`,
        amToggleAlert: () => {
          this.setState({
            amFlags: {
              ...s.amFlags,
              [amRaw.id]: {
                ...amFlag,
                alert: !amAlert
              }
            }
          });
          this.amToastMsg(amRaw.brand + (amAlert ? ' removed from' : ' added to') + ' high-alert list · nurses see the change now');
        },
        amAlertLabel: amAlert ? 'High-alert ✓' : 'Mark high-alert',
        amAlertBtn: `border:1px solid rgba(214,69,69,${amAlert ? '.5' : '.3'});border-radius:11px;padding:9px 12px;background:${amAlert ? '#d23a52' : 'rgba(214,69,69,.08)'};color:${amAlert ? '#fff' : '#b32e2e'};font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap`,
        am: {
          ...amRaw,
          alert: amAlert,
          nursing: amEd.nursing !== undefined ? amEd.nursing : amRaw.nursing,
          maxDose: amRaw.facts.max,
          food: FOODS[amRaw.facts.food] || '',
          preg: (PREGS[amRaw.facts.preg] || PREGS.safe)[0],
          pregColor: (PREGS[amRaw.facts.preg] || PREGS.safe)[1],
          imgStyle: `width:92px;height:92px;border-radius:18px;border:1px solid rgba(125,145,180,.2);flex-shrink:0;box-shadow:0 10px 26px rgba(31,59,90,.12);background:#fff ${amRaw.img ? `url(${amRaw.img}) center/calc(100% - 12px) no-repeat` : ''}`
        },
        amSetNursing: e => this.setState({
          amEdits: {
            ...s.amEdits,
            [amRaw.id]: {
              ...amEd,
              nursing: e.target.value
            }
          }
        }),
        amTabs: [['overview', 'Overview'], ['dosage', 'Dosage'], ['safety', 'Safety'], ['more', 'More']].map(([k, l]) => ({
          label: l,
          go: () => this.setState({
            amTab: k
          }),
          style: pillBtn(s.amTab === k).replace('padding:7px 10px', 'padding:8px 4px')
        })),
        amTabMore: s.amTab === 'more',
        amSections: (AM_TABS[s.amTab] || []).filter(k => amSecAll[k] || s.amEditing).map(k => ({
          label: k,
          color: AM_COLOR[k] || '#3c4858',
          text: amSecAll[k] || '',
          custom: !!(amEd.sec && amEd.sec[k] !== undefined),
          set: e => setAmSec(k, e.target.value)
        })),
        amSettings: [{
          label: 'Visible in Nurse App',
          sub: 'Hide to remove from lookup without deleting',
          isToggle: true,
          isValue: false,
          go: () => {
            this.setState({
              amFlags: {
                ...s.amFlags,
                [amRaw.id]: {
                  ...amFlag,
                  hidden: !amFlag.hidden
                }
              }
            });
          },
          ...toggle(!amFlag.hidden)
        }, {
          label: 'Ward stock tracking',
          sub: 'Show stock status to nurses',
          isToggle: true,
          isValue: false,
          go: () => this.setState({
            amFlags: {
              ...s.amFlags,
              [amRaw.id]: {
                ...amFlag,
                stock: amFlag.stock === false
              }
            }
          }),
          ...toggle(amFlag.stock !== false)
        }, {
          label: 'Allow nurse favourites',
          sub: 'Star & recently viewed',
          isToggle: true,
          isValue: false,
          go: () => this.setState({
            amFlags: {
              ...s.amFlags,
              [amRaw.id]: {
                ...amFlag,
                fav: amFlag.fav === false
              }
            }
          }),
          ...toggle(amFlag.fav !== false)
        }, {
          label: 'Monograph version',
          sub: 'Last edited by System Administrator',
          isToggle: false,
          isValue: true,
          value: s.amEdits[amRaw.id] ? 'v3 · today' : 'v2 · 14 Aug'
        }],
        amSave: () => {
          this.setState({
            amEditing: false
          });
          this.amToastMsg('Monograph saved · published to every Nurse App');
        },
        amShare: () => {
          this.amToastMsg('Update notice sent to all nursing staff');
        },
        amRemove: () => {
          this.setState({
            amRemoved: {
              ...s.amRemoved,
              [amRaw.id]: true
            },
            screen: 'module',
            mod: 'medicine',
            modTab: 0
          });
          this.modToast(amRaw.brand + ' removed from formulary');
        },
        sAppAccess: s.screen === 'appAccess',
        goAppAccess: () => go('appAccess'),
        aaDirty,
        aaToast: s.aaToast,
        aaPublish: () => {
          this.setState({
            aaPublished: {
              ...s.aaFeat
            }
          });
          this.aaToastMsg('Published · every Nurse App updates within 15 s');
        },
        aaTabs: [['features', 'Features by role'], ['depts', 'Department overrides'], ['custom', 'Custom modules'], ['preview', 'Preview as']].map(([k, l]) => ({
          label: l,
          go: () => this.setState({
            aaTab: k
          }),
          style: chip(s.aaTab === k)
        })),
        aaTabFeatures: s.aaTab === 'features',
        aaTabDepts: s.aaTab === 'depts',
        aaTabCustom: s.aaTab === 'custom',
        aaTabPreview: s.aaTab === 'preview',
        aaRoleHeads: portalRoles.map(r => shortLabel(r.label.replace('Nurse in-charge', 'In-chg').replace('Data collector', 'Collect.').replace('Staff nurse', 'Nurse'))),
        aaHeadStyle: `display:grid;${aaCols};gap:2px;align-items:end;padding:10px 12px 6px;font-size:9px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:#7d8ea8`,
        aaRowStyle: `display:grid;${aaCols};gap:2px;align-items:center;padding:7px 12px;border-top:1px solid rgba(125,145,180,.1)`,
        aaGroups: APP_FEATURES.map(g => ({
          sec: g.sec,
          rows: g.rows.map(([fid, label, sub]) => ({
            label,
            sub,
            cells: portalRoles.map(r => {
              const ri = r.id;
              const on = featOn(fid, ri);
              const changed = s.aaFeat[fid + ':' + ri] !== undefined && s.aaFeat[fid + ':' + ri] !== s.aaPublished[fid + ':' + ri];
              return {
                on,
                off: !on,
                tip: `${label} · ${r.label} · ${on ? 'allowed' : 'blocked'}`,
                go: () => this.setState({
                  aaFeat: {
                    ...s.aaFeat,
                    [fid + ':' + ri]: !on
                  }
                }),
                style: `width:32px;height:32px;border-radius:9px;cursor:pointer;display:grid;place-items:center;margin:0 auto;border:1.5px solid ${changed ? '#e08a1e' : 'transparent'};background:${on ? 'linear-gradient(140deg,#2bb673,#1d8f57)' : 'rgba(125,145,180,.12)'}`
              };
            })
          }))
        })),
        aaDeptChips: DEPTS.map(d => ({
          label: d,
          go: () => this.setState({
            aaDept: d
          }),
          style: chip(s.aaDept === d)
        })),
        aaDeptName: `${s.aaDept} · ${(DEPT_INFO[s.aaDept] || {
          name: s.aaDept
        }).name}`,
        aaDeptOverrideCount: Object.keys(deptOv).length ? `${Object.keys(deptOv).length} override${Object.keys(deptOv).length > 1 ? 's' : ''} on top of role defaults` : 'No overrides · using role defaults',
        aaDeptReset: () => {
          const o = {
            ...s.aaDeptOv
          };
          delete o[s.aaDept];
          this.setState({
            aaDeptOv: o
          });
          this.aaToastMsg(s.aaDept + ' reset to role defaults');
        },
        aaDeptRows: FEAT_FLAT.map(([fid, label]) => {
          const cur = deptOv[fid] || 'inherit';
          const roleOn = featOn(fid, 'nurse');
          return {
            label,
            stateLabel: cur === 'inherit' ? `Default · ${roleOn ? 'allowed' : 'blocked'} for staff nurses` : cur === 'on' ? 'Allowed for everyone in this department' : 'Blocked for everyone in this department',
            stateColor: cur === 'inherit' ? '#7d8ea8' : cur === 'on' ? '#1d8f57' : '#b32e2e',
            opts: triState(cur, k => {
              const d = {
                ...deptOv
              };
              if (k === 'inherit') delete d[fid];else d[fid] = k;
              this.setState({
                aaDeptOv: {
                  ...s.aaDeptOv,
                  [s.aaDept]: d
                }
              });
            })
          };
        }),
        customMods: s.customMods.map(c => {
          const t = CM_TYPES.find(x => x[0] === c.type) || CM_TYPES[0];
          return {
            ...c,
            d: t[2],
            meta: `${t[1]} · ${c.sched} · ${c.roles.map(r => (roles.find(x => x.id === r) || {
              label: r
            }).label).join(', ')} · ${c.depts.join(', ')}`,
            fieldChips: c.fields,
            avStyle: `display:grid;place-items:center;width:38px;height:38px;border-radius:11px;color:#fff;background:linear-gradient(135deg,${c.active ? '#6a52d4' : '#9aa6b4'},#0090ca);flex-shrink:0`,
            ...toggle(c.active),
            toggle: () => this.setState({
              customMods: s.customMods.map(x => x.id === c.id ? {
                ...x,
                active: !x.active
              } : x)
            }),
            edit: () => this.setState({
              cm: {
                ...c,
                fieldDraft: ''
              }
            }),
            preview: () => this.setState({
              aaTab: 'preview',
              pvRole: c.roles[0] || 'nurse'
            }),
            remove: () => {
              this.setState({
                customMods: s.customMods.filter(x => x.id !== c.id)
              });
              this.aaToastMsg(c.name + ' removed from all phones');
            }
          };
        }),
        cmTitle: cm.id ? 'Edit module · ' + cm.name : 'Build a custom module',
        cm,
        cmSetName: e => setCm({
          name: e.target.value
        }),
        cmTypes: CM_TYPES.map(([k, l]) => ({
          label: l,
          go: () => setCm({
            type: k
          }),
          style: chip(cm.type === k)
        })),
        cmFieldCount: `${cm.fields.length} field${cm.fields.length === 1 ? '' : 's'}`,
        cmFields: cm.fields.map((f, i) => ({
          label: f,
          remove: () => setCm({
            fields: cm.fields.filter((x, j) => j !== i)
          })
        })),
        cmSetFieldDraft: e => setCm({
          fieldDraft: e.target.value
        }),
        cmFieldKey: e => {
          if (e.key === 'Enter') cmAddField();
        },
        cmAddField,
        cmRoles: portalRoles.map(r => ({
          label: r.label,
          go: () => setCm({
            roles: cm.roles.includes(r.id) ? cm.roles.filter(x => x !== r.id) : [...cm.roles, r.id]
          }),
          style: chip(cm.roles.includes(r.id))
        })),
        cmDepts: ['All', ...DEPTS].map(d => ({
          label: d,
          go: () => setCm({
            depts: d === 'All' ? ['All'] : cm.depts.includes(d) ? cm.depts.filter(x => x !== d && x !== 'All') : [...cm.depts.filter(x => x !== 'All'), d]
          }),
          style: chip(cm.depts.includes(d))
        })),
        cmSched: ['Every shift', 'Daily', 'Weekly', 'On demand'].map(o => ({
          label: o,
          go: () => setCm({
            sched: o
          }),
          style: pillBtn(cm.sched === o).replace('padding:7px 10px', 'padding:6px 9px').replace('font-size:12px', 'font-size:11px')
        })),
        cmSaveLabel: cm.id ? 'Save changes' : 'Create module & publish',
        cmSaveStyle: `border:0;border-radius:12px;padding:13px;color:#fff;font-size:13.5px;font-weight:700;cursor:pointer;background:linear-gradient(140deg,#6a52d4,#0072a3);box-shadow:0 10px 24px rgba(106,82,212,.3);opacity:${cm.name.trim() && cm.fields.length ? 1 : .5}`,
        cmSave: () => {
          if (!cm.name.trim() || !cm.fields.length) return;
          const rec = {
            id: cm.id || 'cm' + Date.now(),
            name: cm.name.trim(),
            type: cm.type,
            fields: cm.fields,
            roles: cm.roles,
            depts: cm.depts.length ? cm.depts : ['All'],
            sched: cm.sched,
            active: true
          };
          this.setState({
            customMods: cm.id ? s.customMods.map(x => x.id === cm.id ? rec : x) : [...s.customMods, rec],
            cm: {
              id: null,
              name: '',
              type: 'checklist',
              fields: [],
              fieldDraft: '',
              roles: ['nurse', 'incharge'],
              depts: ['All'],
              sched: 'Every shift'
            }
          });
          this.aaToastMsg((cm.id ? 'Updated' : 'Published') + ' · ' + rec.name + ' now appears in the Nurse App');
        },
        pvRoles: portalRoles.map(r => ({
          label: r.label,
          go: () => this.setState({
            pvRole: r.id
          }),
          style: pillBtn(s.pvRole === r.id).replace('padding:7px 10px', 'padding:6px 9px').replace('font-size:12px', 'font-size:11px')
        })),
        pvDeptChips: DEPTS.map(d => ({
          label: d,
          go: () => this.setState({
            pvDept: d
          }),
          style: chip(s.pvDept === d)
        })),
        pvIni: ini((roles.find(r => r.id === s.pvRole) || {
          label: '?'
        }).label),
        pvTitle: `${(roles.find(r => r.id === s.pvRole) || {
          label: s.pvRole
        }).label} · ${s.pvDept}`,
        pvSub: `${FEAT_FLAT.filter(([fid]) => effective(fid, s.pvRole, s.pvDept)).length} of ${FEAT_FLAT.length} features · ${s.customMods.filter(c => c.active && c.roles.includes(s.pvRole) && (c.depts.includes('All') || c.depts.includes(s.pvDept))).length} custom modules`,
        pvNav: pvNavDef.map(([fid, label, d]) => {
          const on = effective(fid, s.pvRole, s.pvDept);
          return {
            label,
            d,
            style: `display:flex;flex-direction:column;align-items:center;gap:3px;padding:6px 0;border-radius:9px;color:${on ? '#0072a3' : '#c4ccd6'};${on ? '' : 'opacity:.5'}`
          };
        }),
        pvAllowed: [...FEAT_FLAT.filter(([fid]) => effective(fid, s.pvRole, s.pvDept)).map(r => r[1]), ...s.customMods.filter(c => c.active && c.roles.includes(s.pvRole) && (c.depts.includes('All') || c.depts.includes(s.pvDept))).map(c => c.name + ' ★')],
        pvBlocked: FEAT_FLAT.filter(([fid]) => !effective(fid, s.pvRole, s.pvDept)).map(r => r[1]),
        pvHasBlocked: FEAT_FLAT.some(([fid]) => !effective(fid, s.pvRole, s.pvDept)),
        udFeatRows: FEAT_FLAT.filter(([fid]) => udRoleObj.appFeats[fid] || udOv[fid]).concat(FEAT_FLAT.filter(([fid]) => !udRoleObj.appFeats[fid] && !udOv[fid])).map(([fid, label]) => {
          const cur = udOv[fid] || 'inherit';
          const eff = effective(fid, udRole, ud.depts[0] || 'LDR', udOv[fid]);
          return {
            label,
            stateLabel: cur === 'inherit' ? `Default · ${eff ? 'allowed' : 'hidden'}` : cur === 'on' ? 'Allowed for this person' : 'Hidden for this person',
            stateColor: cur === 'inherit' ? '#7d8ea8' : cur === 'on' ? '#1d8f57' : '#b32e2e',
            opts: triState(cur, k => {
              const o = {
                ...udOv
              };
              if (k === 'inherit') delete o[fid];else o[fid] = k;
              this.setState({
                udFeatOv: {
                  ...s.udFeatOv,
                  [ud.username]: o
                }
              });
            })
          };
        }),
        moduleCards: [...MOD_ORDER.map(id => ({
          ...MOD_META[id],
          stat: modStat[id][0],
          statLabel: modStat[id][1],
          badge: modBadge[id] || null,
          go: () => this.openMod(id)
        })), {
          label: 'Nurse App access',
          sub: 'Features per role, overrides, custom modules',
          d: 'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z',
          color: '#1e8a7c',
          bg: 'rgba(58,181,167,.16)',
          stat: String(s.customMods.filter(c => c.active).length),
          statLabel: 'custom modules live',
          badge: aaDirty ? '!' : null,
          go: () => go('appAccess')
        }, {
          label: 'Roles',
          sub: 'Dynamic roles · console permissions & app features',
          d: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
          color: '#6a52d4',
          bg: 'rgba(106,82,212,.13)',
          stat: String(roles.length),
          statLabel: 'roles defined',
          badge: null,
          go: () => go('roles')
        }, {
          label: 'Nursing hierarchy',
          sub: 'CNS → Nurse Manager → In-charge → Staff · approval chain',
          d: 'M12 3v6M6 15v-3a3 3 0 013-3h6a3 3 0 013 3v3M6 15a3 3 0 100 6 3 3 0 000-6zM18 15a3 3 0 100 6 3 3 0 000-6z',
          color: '#0072a3',
          bg: 'rgba(0,144,202,.13)',
          stat: String(APPROVAL_RULES.length),
          statLabel: 'approval rules',
          badge: null,
          go: () => go('org')
        }],
        mod: modMeta,
        modTabs: modMeta.tabs.map((t, i) => ({
          label: t,
          go: () => this.setState({
            modTab: i,
            modToast: ''
          }),
          style: chip(s.modTab === i),
          badge: s.mod === 'datacol' && t === 'Review' && pendingDc || s.mod === 'supervisor' && t === 'Pending' && modBadge.supervisor || s.mod === 'roster' && t === 'Review queue' && modBadge.roster || s.mod === 'perf' && t === 'Pending sign-off' && modBadge.perf || s.mod === 'quality' && t === 'Incidents' && modBadge.quality || s.mod === 'medicine' && t === 'Requests' && modBadge.medicine || null
        })),
        modPrimary: M.primary,
        modToast: s.modToast,
        modHasTiles: !!M.tiles,
        modTiles: (M.tiles || []).map(t => ({
          ...t,
          note: t.note || null
        })),
        modHasChart: !!M.chart,
        modChart: M.chart || {
          title: '',
          legend: '',
          bars: []
        },
        modHasForm: !!M.form,
        modHasChart2: !!M.chart2,
        modChart2: M.chart2 || {
          title: '',
          legend: '',
          rows: [],
          note: null
        },
        modHasDonut: !!M.donuts,
        modDonuts: M.donuts || [],
        modHasInsights: !!M.insights,
        modInsights: M.insights || [],
        modInsightsTitle: M.insightsTitle,
        modHasFilters: !!M.filters,
        modFilters: M.filters || [],
        modHasLayouts: !!M.layouts,
        modLayouts: M.layouts || [],
        modHasExport: M.exportable,
        modExport: () => this.setState({
          modExportOpen: true
        }),
        modExportOpen: s.modExportOpen,
        closeModExport: () => this.setState({
          modExportOpen: false
        }),
        modExportSub: `Hospital Statistics · ${tabName} · ${(s.stPeriod || 'latest').toUpperCase()}`,
        modExportOpts: [{
          label: 'PDF',
          color: '#b32e2e',
          bg: 'rgba(214,69,69,.12)',
          d: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6',
          go: () => {
            this.setState({
              modExportOpen: false
            });
            this.modToast(`PDF generated · ${s.stExportPage} · saved to Reports`);
          }
        }, {
          label: 'Excel',
          color: '#1d8f57',
          bg: 'rgba(43,182,115,.14)',
          d: 'M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18',
          go: () => {
            this.setState({
              modExportOpen: false
            });
            this.modToast('CSV exported · all departments × 7 months');
          }
        }, {
          label: 'Send to CNS',
          color: '#6a52d4',
          bg: 'rgba(106,82,212,.13)',
          d: 'M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zM22 6l-10 7L2 6',
          go: () => {
            this.setState({
              modExportOpen: false
            });
            this.modToast('Emailed to Dr. Nasreen Sultana (CNS)');
          }
        }, {
          label: 'Print',
          color: '#3c4858',
          bg: 'rgba(125,145,180,.16)',
          d: 'M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z',
          go: () => {
            this.setState({
              modExportOpen: false
            });
            this.modToast('Sent to printer');
          }
        }],
        modExportPages: ['A4 portrait', 'A4 landscape', 'A3 landscape', 'Letter'].map(p => ({
          label: p,
          go: () => this.setState({
            stExportPage: p
          }),
          style: chip(s.stExportPage === p)
        })),
        modExportToggles: [['charts', 'Include charts', 'All chart styles for each department'], ['tables', 'Include data tables', 'Monthly figures per department'], ['conf', 'Confidential watermark', 'Header, footer and logo from Reports settings']].map(([k, l, sub]) => ({
          label: l,
          sub,
          go: () => this.setState({
            stExport: {
              ...s.stExport,
              [k]: !s.stExport[k]
            }
          }),
          ...toggle(s.stExport[k])
        })),
        modForm: M.form || {
          title: '',
          cta: '',
          fields: [],
          submit: () => {}
        },
        modHasRows: M.rows.length > 0,
        modRows: M.rows,
        modRowsTitle: M.rowsTitle,
        modRowsCount: M.rows.length + ' items',
        sLogin: s.screen === 'login',
        sHome: s.screen === 'home',
        sUsers: s.screen === 'users',
        sUserDetail: s.screen === 'userDetail',
        sRoles: s.screen === 'roles',
        sApprovals: s.screen === 'approvals',
        sDepts: s.screen === 'depts',
        sDeptDetail: s.screen === 'deptDetail',
        sBroadcast: s.screen === 'broadcast',
        sActivity: s.screen === 'activity',
        sSettings: s.screen === 'settings',
        showNav: s.screen !== 'login',
        drawerOpen: s.drawerOpen,
        openDrawer: () => this.setState({
          drawerOpen: true
        }),
        closeDrawer: () => this.setState({
          drawerOpen: false
        }),
        loginUser: s.loginUser,
        setLoginUser: e => this.setState({
          loginUser: e.target.value
        }),
        loginPw: s.loginPw,
        setLoginPw: e => this.setState({
          loginPw: e.target.value
        }),
        doLogin: () => go('home'),
        signOut: () => go('login', {
          loginUser: '',
          loginPw: ''
        }),
        meName: me.name,
        meFirst: 'Admin',
        meIni: 'SA',
        goUsers: () => go('users'),
        goApprovals: () => go('approvals'),
        goDepts: () => go('depts'),
        goActivity: () => go('activity'),
        goNewUser: () => this.newUser(null),
        heroStats: [{
          v: users.filter(u => u.active).length,
          label: 'active accounts',
          go: () => go('users')
        }, {
          v: pendingTotal,
          label: 'items awaiting review',
          go: () => go('approvals')
        }, {
          v: Math.round(covAll.approved / covAll.total * 100) + '%',
          label: 'Aug data approved',
          go: () => go('depts')
        }],
        actionItems: [{
          title: `${pendingDc} data submissions`,
          sub: 'Quality & statistics awaiting review',
          n: pendingDc,
          color: '#0072a3',
          bg: 'rgba(0,144,202,.13)',
          border: 'rgba(0,144,202,.3)',
          d: 'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z',
          go: () => go('approvals', {
            apTab: 'data'
          })
        }, {
          title: `${QUEUE.filter(x => !x.ok && !s.decisions[x.id]).length} out-of-range values`,
          sub: 'Benchmark breaches to check first',
          n: QUEUE.filter(x => !x.ok && !s.decisions[x.id]).length,
          color: '#b32e2e',
          bg: 'rgba(214,69,69,.12)',
          border: 'rgba(214,69,69,.3)',
          d: 'M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z',
          go: () => go('approvals', {
            apTab: 'data',
            apFilter: 'Out of range'
          })
        }, {
          title: `${pendingLeave} leave & overtime`,
          sub: 'Escalated by in-charges',
          n: pendingLeave,
          color: '#b8650a',
          bg: 'rgba(224,138,30,.15)',
          border: 'rgba(224,138,30,.3)',
          d: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z',
          go: () => go('approvals', {
            apTab: 'leave'
          })
        }, ...function () {
          const fails = LOG.filter(l => l.action === 'login_failed' && (!l.ts || Date.now() - l.ts < 86400e3));
          if (!fails.length && LV.live) return [];
          const who = Array.from(new Set(fails.map(l => l.who))).slice(0, 2).join(', ');
          return [{
            title: LV.live ? `${fails.length} failed sign-in${fails.length === 1 ? '' : 's'} · 24 h` : '1 failed sign-in burst',
            sub: LV.live ? `${who}${fails[0] && fails[0].ip && fails[0].ip !== '—' ? ' · from ' + fails[0].ip : ''}` : '@r.karim · 3 attempts from an external IP',
            n: LV.live ? fails.length : 3,
            color: '#6a52d4',
            bg: 'rgba(106,82,212,.13)',
            border: 'rgba(106,82,212,.3)',
            d: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
            go: () => go('activity', {
              logFilter: 'Security'
            })
          }];
        }()],
        quickActions: [{
          label: 'Add user',
          color: '#6a52d4',
          bg: 'rgba(106,82,212,.13)',
          d: 'M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M8.5 3a4 4 0 110 8 4 4 0 010-8zM20 8v6M23 11h-6',
          go: () => this.newUser(null)
        }, {
          label: 'App access',
          color: '#0072a3',
          bg: 'rgba(0,144,202,.13)',
          d: 'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z',
          go: () => go('appAccess')
        }, {
          label: 'Broadcast',
          color: '#b8650a',
          bg: 'rgba(224,138,30,.15)',
          d: 'M3 11v2a1 1 0 001 1h3l5 4V6L7 10H4a1 1 0 00-1 1zM16 8a5 5 0 010 8M19 5a9 9 0 010 14',
          go: () => go('broadcast')
        }, {
          label: 'All modules',
          color: '#1e8a7c',
          bg: 'rgba(58,181,167,.16)',
          d: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
          go: () => go('modules')
        }, {
          label: 'Activity log',
          color: '#3c4858',
          bg: 'rgba(125,145,180,.16)',
          d: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2',
          go: () => go('activity')
        }, {
          label: 'Settings',
          color: '#6a52d4',
          bg: 'rgba(106,82,212,.13)',
          d: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z',
          go: () => go('settings')
        }, {
          label: 'Backup now',
          color: '#0072a3',
          bg: 'rgba(0,144,202,.13)',
          d: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12',
          go: () => go('settings')
        }, {
          label: 'Nurse App',
          color: '#1e8a7c',
          bg: 'rgba(58,181,167,.16)',
          d: 'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z',
          go: () => {
            window.location.href = '/app#nurse';
          }
        }],
        covApproved: seg(covAll.approved, covAll.total, '#1d8f57'),
        covPending: seg(covAll.pending, covAll.total, '#0090ca'),
        covRejected: seg(covAll.rejected, covAll.total, '#d23a52'),
        covN: covAll,
        homeActivity: LOG.slice(0, 3).map(l => ({
          ...l,
          dot: `width:8px;height:8px;border-radius:50%;background:${l.c};flex-shrink:0`
        })),
        userCount: users.length,
        adminCount: users.filter(u => roleOf(u).kind === 'admin' && u.active).length,
        userQ: s.userQ,
        setUserQ: e => this.setState({
          userQ: e.target.value
        }),
        roleFilters: [['All', 'All', users.length], ['kind:admin', 'Admins', users.filter(u => roleOf(u).kind === 'admin').length], ['kind:console', 'Console', users.filter(u => roleOf(u).kind === 'console').length], ['kind:portal', 'Nurse App', users.filter(u => roleOf(u).kind === 'portal').length], ...roles.filter(r => r.kind !== 'admin' && users.some(u => roleOf(u).id === r.id)).map(r => [r.id, r.label, users.filter(u => roleOf(u).id === r.id).length]), ['Inactive', 'Inactive', inactive]].map(([k, l, n]) => ({
          label: l,
          n,
          go: () => this.setState({
            roleFilter: k
          }),
          style: chip(s.roleFilter === k)
        })),
        userList,
        udNew: !!s.udNew,
        udEditing: !s.udNew,
        udDirty,
        udToast: s.udToast,
        udSave: () => {
          const legacy = this.kindToLegacy(udRoleObj);
          if (s.udNew) {
            const nu = {
              ...ud,
              role: legacy,
              title: udRoleObj.label,
              online: false,
              lastLogin: 'Never',
              created: 'Today'
            };
            delete nu.pw;
            this.setState({
              users: [nu, ...users],
              udNew: false,
              selUser: nu.username,
              ud: {
                ...nu,
                pw: ''
              }
            });
            toastUd(`Account @${nu.username} created · welcome email sent`);
          } else {
            this.setState({
              users: users.map(u => u.username === ud.username ? {
                ...u,
                name: ud.name,
                role: legacy,
                roleId: ud.roleId,
                title: udRoleObj.label,
                active: ud.active,
                emp: ud.emp,
                depts: ud.depts,
                scope: ud.scope,
                perms: ud.perms
              } : u)
            });
            toastUd('Saved · takes effect within 15 s on every device');
          }
        },
        udTabs: [['profile', 'Profile'], ['access', 'Access'], ['security', 'Security']].map(([k, l]) => ({
          label: l,
          go: () => this.setState({
            udTab: k
          }),
          style: pillBtn(s.udTab === k)
        })),
        udTabProfile: s.udTab === 'profile',
        udTabAccess: s.udTab === 'access',
        udTabSecurity: s.udTab === 'security',
        ud: {
          ...ud,
          ini: ud.name ? ini(ud.name) : '?',
          nameOrNew: ud.name || 'New user',
          metaLine: (ud.active ? 'Active · can sign in' : 'Inactive · sign-in blocked') + ' · ' + udRoleObj.label,
          avStyle: `display:grid;place-items:center;width:52px;height:52px;border-radius:15px;color:#fff;font-size:15px;font-weight:700;background:${ud.active ? `linear-gradient(135deg,${udRoleObj.color},#0090ca)` : 'rgba(125,145,180,.5)'}`
        },
        udTitle: s.udNew ? 'New account' : ud.name,
        udSub: s.udNew ? 'Create a login and set what it can reach' : `@${ud.username} · ${udRoleObj.label} · created ${ud.created}`,
        udSetName: e => setUd({
          name: e.target.value
        }),
        udSetUsername: e => setUd({
          username: e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, '')
        }),
        udSetEmp: e => setUd({
          emp: e.target.value
        }),
        udSetPw: e => setUd({
          pw: e.target.value
        }),
        udGenPw: () => setUd({
          pw: Math.random().toString(36).slice(2, 6) + '-' + Math.random().toString(36).slice(2, 6)
        }),
        udUsernameStyle: `border:1px solid rgba(125,145,180,.3);border-radius:10px;padding:10px 12px;font-size:13.5px;background:${s.udNew ? 'rgba(255,255,255,.85)' : 'rgba(125,145,180,.1)'};outline:none;font-family:'IBM Plex Mono',monospace;color:${s.udNew ? '#16202e' : '#6c7a8c'}`,
        udToggleActive: () => {
          if (ud.active && udRoleObj.kind === 'admin' && users.filter(u => roleOf(u).kind === 'admin' && u.active).length <= 1) {
            toastUd('Cannot deactivate the last administrator');
            return;
          }
          setUd({
            active: !ud.active
          });
        },
        udActiveTrack: toggle(ud.active).track,
        udActiveKnob: toggle(ud.active).knob,
        roleOpts: roles.map(r => {
          const m = KIND_META[r.kind];
          const on = udRoleObj.id === r.id;
          return {
            label: r.label,
            desc: r.desc,
            tagLabel: m.tag,
            go: () => setUd({
              roleId: r.id,
              role: this.kindToLegacy(r),
              title: r.label,
              scope: r.kind === 'admin' ? 'all' : r.scope || ud.scope,
              perms: r.kind === 'console' ? JSON.parse(JSON.stringify(r.perms || {})) : {}
            }),
            radio: `width:18px;height:18px;border-radius:50%;border:2px solid ${on ? r.color : 'rgba(125,145,180,.5)'};background:${on ? `radial-gradient(circle,${r.color} 45%,#fff 50%)` : '#fff'};flex-shrink:0`,
            tag: `font-size:9px;font-weight:800;letter-spacing:.5px;padding:2px 6px;border-radius:5px;color:${r.color};background:${r.color}22;flex-shrink:0`,
            style: `display:flex;align-items:center;gap:10px;border:1.5px solid ${on ? r.color : 'rgba(125,145,180,.3)'};border-radius:12px;padding:10px 12px;background:${on ? r.color + '14' : 'rgba(255,255,255,.7)'};cursor:pointer;color:#16202e;text-align:left`
          };
        }),
        udHasDepts: udRoleObj.kind !== 'admin',
        udDeptCount: ud.depts.length ? `${ud.depts.length} selected` : 'none · all departments',
        udDeptChips: DEPTS.map(d => ({
          label: d,
          go: () => setUd({
            depts: ud.depts.includes(d) ? ud.depts.filter(x => x !== d) : [...ud.depts, d]
          }),
          style: chip(ud.depts.includes(d))
        })),
        udHasScope: udRoleObj.kind !== 'admin',
        scopeOpts: [['all', 'All'], ['departments', 'Own departments'], ['self', 'Own record']].map(([k, l]) => ({
          label: l,
          go: () => setUd({
            scope: k
          }),
          style: pillBtn(ud.scope === k).replace('padding:7px 10px', 'padding:6px 9px').replace('font-size:12px', 'font-size:11px')
        })),
        scopeHint: ud.scope === 'all' ? 'Every nurse and PCA in the hospital.' : ud.scope === 'departments' ? `Only staff rostered in ${ud.depts.length ? ud.depts.join(', ') : 'the selected departments'}.` : 'Only this person\'s own personnel record.',
        udIsAdmin: udRoleObj.kind === 'admin',
        udIsPortal: isPortal,
        udIsUser: udRoleObj.kind === 'console',
        tmplChips: ROLE_TEMPLATES.map(t => ({
          label: t.label,
          go: () => setUd({
            perms: JSON.parse(JSON.stringify(t.perms)),
            title: t.label
          }),
          style: chip(ud.title === t.label)
        })),
        permRows,
        previewMods,
        goOrg: () => go('org'),
        udReportsTo: reportsToOf(ud),
        secFacts: [['Last sign-in', ud.lastLogin || 'Never'], ['Two-step verification', ud.twofa ? 'On' : 'Off'], ['Active sessions', String(ud.sessions || 0)], ['Account created', ud.created || '—']].map(([label, v]) => ({
          label,
          v
        })),
        secActions: [{
          label: 'Reset password',
          sub: 'Sends a one-time link · current password stops working',
          color: '#0072a3',
          bg: 'rgba(0,144,202,.13)',
          d: 'M21 2l-2 2m-7.6 7.6a5.5 5.5 0 11-7.8 7.8 5.5 5.5 0 017.8-7.8zm0 0L15.5 7.5M15.5 7.5l3 3L22 7l-3-3',
          go: () => doAction('Reset password?', `A one-time reset link is sent to ${ud.name}. Their current password stops working immediately.`, 'Send reset link', false, () => this.liveUser('password', ud))
        }, {
          label: 'Sign out everywhere',
          sub: `Revokes all ${ud.sessions || 0} sessions on every device`,
          color: '#b8650a',
          bg: 'rgba(224,138,30,.15)',
          d: 'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9',
          go: () => doAction('Sign out everywhere?', `Every device signed in as @${ud.username} is signed out. They can sign in again with their password.`, 'Sign out all', false, () => {
            this.setState({
              users: users.map(u => u.username === ud.username ? {
                ...u,
                sessions: 0,
                online: false
              } : u),
              ud: {
                ...ud,
                sessions: 0
              }
            });
            toastUd('All sessions revoked');
          })
        }, {
          label: ud.twofa ? 'Turn off two-step verification' : 'Require two-step verification',
          sub: ud.twofa ? 'Weakens the account · recorded in the log' : 'Code by SMS on every new device',
          color: '#6a52d4',
          bg: 'rgba(106,82,212,.13)',
          d: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
          go: () => {
            setUd({
              twofa: !ud.twofa
            });
            this.setState({
              users: users.map(u => u.username === ud.username ? {
                ...u,
                twofa: !ud.twofa
              } : u)
            });
            toastUd(ud.twofa ? 'Two-step verification turned off' : 'Two-step verification required');
          }
        }, {
          label: ud.active ? 'Deactivate account' : 'Reactivate account',
          sub: ud.active ? 'Blocks sign-in · keeps history' : 'Allows sign-in again',
          color: ud.active ? '#b32e2e' : '#1d8f57',
          bg: ud.active ? 'rgba(214,69,69,.12)' : 'rgba(43,182,115,.14)',
          d: ud.active ? 'M18.4 5.6a9 9 0 11-12.7 12.7 9 9 0 0112.7-12.7zM5.6 5.6l12.7 12.7' : 'M20 6L9 17l-5-5',
          go: () => doAction(ud.active ? 'Deactivate this account?' : 'Reactivate this account?', ud.active ? `@${ud.username} can no longer sign in on any device. Nothing is deleted.` : `@${ud.username} can sign in again with their existing password.`, ud.active ? 'Deactivate' : 'Reactivate', ud.active, () => {
            setUd({
              active: !ud.active
            });
            this.liveUser('active', {
              ...ud,
              active: !ud.active
            });
          }, ud.active)
        }].map(a => ({
          ...a,
          style: 'display:flex;align-items:center;gap:11px;width:100%;box-sizing:border-box;text-align:left;border:1px solid rgba(255,255,255,.9);border-radius:14px;padding:11px 12px;background:rgba(255,255,255,.66);cursor:pointer;color:#16202e'
        })),
        udActivity: LOG.filter(l => l.who === ud.name || l.who === ud.username || (l.text || '').includes('@' + ud.username)).slice(0, 4).map(l => ({
          ...l,
          dot: `width:8px;height:8px;border-radius:50%;background:${l.c};flex-shrink:0`
        })),
        confirm,
        closeConfirm: () => this.setState({
          confirm: null,
          confirmReason: ''
        }),
        confirmReason: s.confirmReason,
        setConfirmReason: e => this.setState({
          confirmReason: e.target.value
        }),
        sOrg: s.screen === 'org',
        sRoleEdit: s.screen === 'roleEdit',
        goRoles: () => go('roles'),
        newRole: () => this.newRoleFn(null),
        roleCount: roles.length,
        roleKindChips: [['All', 'All', roles.length], ['admin', 'Administrator', roles.filter(r => r.kind === 'admin').length], ['console', 'Console', roles.filter(r => r.kind === 'console').length], ['portal', 'Nurse App', roles.filter(r => r.kind === 'portal').length]].map(([k, l, n]) => ({
          label: l,
          n,
          go: () => this.setState({
            roleKind: k
          }),
          style: chip(s.roleKind === k)
        })),
        roleList: roles.filter(r => s.roleKind === 'All' || r.kind === s.roleKind).map(r => {
          const m = KIND_META[r.kind];
          const members = users.filter(u => roleOf(u).id === r.id).length;
          const featOnN = FEAT_FLAT.filter(([fid]) => r.appFeats && r.appFeats[fid]).length;
          return {
            label: r.label,
            desc: r.desc,
            kindLabel: m.label,
            kindStyle: `font-size:9px;font-weight:800;letter-spacing:.5px;padding:2px 6px;border-radius:5px;color:${r.color};background:${r.color}22`,
            system: !!r.system,
            members,
            d: roleD(r),
            avStyle: `display:grid;place-items:center;width:38px;height:38px;border-radius:11px;color:#fff;background:linear-gradient(135deg,${r.color},#0090ca);flex-shrink:0`,
            hasBars: r.kind === 'console',
            bars: MODULES.map(([k, label]) => {
              const n = (r.perms && r.perms[k] || []).length;
              return {
                t: `${label}: ${n ? ACTS.slice(0, n).join(' · ') : 'none'}`,
                style: `flex:1;height:${6 + n * 4}px;border-radius:2px;background:${n ? n === 4 ? '#d23a52' : n === 3 ? '#6a52d4' : n === 2 ? '#0090ca' : '#3ab5a7' : 'rgba(125,145,180,.2)'}`
              };
            }),
            featLine: r.kind === 'portal' ? `${featOnN} of ${FEAT_FLAT.length} phone features` : r.kind === 'admin' ? 'Every module, every department, this console.' : null,
            edit: () => this.editRole(r),
            use: () => this.newUser(r.id),
            duplicate: () => this.newRoleFn(r)
          };
        }),
        orgTabs: [['levels', 'Levels'], ['chain', 'Approvals'], ['people', 'People']].map(([k, l]) => ({
          label: l,
          go: () => this.setState({
            orgTab: k
          }),
          style: pillBtn(s.orgTab === k)
        })),
        orgToast: s.orgToast,
        orgTabLevels: s.orgTab === 'levels',
        orgTabChain: s.orgTab === 'chain',
        orgTabPeople: s.orgTab === 'people',
        orgLevels: LEVEL_NAMES.map((label, n) => ({
          n: String(n),
          label,
          roles: roles.filter(r => levelOf(r) === n),
          count: users.filter(u => levelOf(roleOf(u)) === n).length,
          badge: `display:grid;place-items:center;width:22px;height:22px;border-radius:7px;font-family:'IBM Plex Mono',monospace;font-size:10.5px;font-weight:700;color:#fff;background:${ROLE_COLORS[n % ROLE_COLORS.length]}`
        })).filter(l => l.roles.length).map(l => ({
          ...l,
          roles: l.roles.map(r => {
            const holders = users.filter(u => roleOf(u).id === r.id);
            const p = roles.find(x => x.id === r.parent);
            return {
              label: r.label,
              d: roleD(r),
              reportsTo: p ? 'Reports to ' + p.label : 'Top of the hierarchy',
              members: holders.length,
              holders: holders.length && holders.length <= 2 ? ' · ' + holders.map(h => h.name.split(' ')[0]).join(', ') : '',
              inherits: r.kind !== 'portal' && levelOf(r) <= 2,
              edit: () => this.editRole(r),
              avStyle: `display:grid;place-items:center;width:36px;height:36px;border-radius:10px;color:#fff;background:linear-gradient(135deg,${r.color},#0090ca);flex-shrink:0`,
              style: 'display:flex;align-items:center;gap:10px;width:100%;box-sizing:border-box;text-align:left;border:1px solid rgba(255,255,255,.9);border-radius:14px;padding:10px 12px;background:rgba(255,255,255,.66);cursor:pointer;color:#16202e'
            };
          })
        })),
        escHours: s.escHours,
        escOpts: [24, 48, 72, 0].map(h => ({
          label: h ? h + ' h' : 'Off',
          go: () => {
            this.setState({
              escHours: h
            });
            this.orgToastMsg(h ? `Auto-escalation after ${h} h` : 'Auto-escalation off');
          },
          style: `border:0;border-radius:7px;padding:5px 8px;font-size:10.5px;font-weight:700;cursor:pointer;${s.escHours === h ? 'background:#fff;color:#16202e;box-shadow:0 1px 3px rgba(0,0,0,.12)' : 'background:transparent;color:#6c7a8c'}`
        })),
        approvalRules: APPROVAL_RULES.map(rule => {
          const cur = ruleApprovers(rule);
          return {
            label: rule.label,
            sub: rule.sub,
            d: rule.d,
            iconWrap: 'display:grid;place-items:center;width:36px;height:36px;border-radius:11px;color:#0072a3;background:rgba(0,144,202,.13);flex-shrink:0',
            chain: [{
              label: 'Request',
              style: 'font-size:10.5px;font-weight:700;padding:3px 8px;border-radius:999px;color:#3c4858;background:rgba(125,145,180,.16)',
              arrow: true
            }, ...cur.map((id, i) => {
              const r = roles.find(x => x.id === id) || {
                label: id,
                color: '#0072a3'
              };
              return {
                label: r.label,
                style: `font-size:10.5px;font-weight:700;padding:3px 8px;border-radius:999px;color:${r.color};background:${r.color}22`,
                arrow: i < cur.length - 1
              };
            })],
            opts: approverRoles.map(r => ({
              label: r.label,
              go: () => {
                const next = cur.includes(r.id) ? cur.filter(x => x !== r.id) : [...cur, r.id];
                if (!next.length) return;
                this.setState({
                  rules: {
                    ...s.rules,
                    [rule.id]: next
                  }
                });
                this.orgToastMsg(`${rule.label} · approved by ${next.map(id => (roles.find(x => x.id === id) || {
                  label: id
                }).label).join(' → ')}`);
              },
              style: chip(cur.includes(r.id))
            }))
          };
        }),
        cns: {
          ini: ini(cnsUser.name),
          name: cnsUser.name,
          sub: `@${cnsUser.username} · ${s.clusters.length} clusters · ${users.filter(u => roleOf(u).kind !== 'admin').length} accounts below`,
          open: () => this.openUser(cnsUser.username)
        },
        clusters: s.clusters.map(cl => {
          const mu = users.find(u => u.username === cl.manager);
          return {
            ini: ini(cl.name),
            name: cl.name,
            manager: mu ? mu.name : 'Unassigned',
            depts: cl.depts.map(id => ({
              id,
              ini: id.slice(0, 3).toUpperCase(),
              incharge: (DEPT_INFO[id] || {}).incharge || '—',
              staff: (DEPT_INFO[id] || {}).staff || 0,
              open: () => go('deptDetail', {
                selDept: id
              })
            })),
            staff: cl.depts.reduce((a, id) => a + ((DEPT_INFO[id] || {}).staff || 0), 0),
            reassign: () => this.setState({
              reassign: cl.id
            })
          };
        }),
        reassignOpen: !!s.reassign,
        closeReassign: () => this.setState({
          reassign: null
        }),
        reassignCluster: (s.clusters.find(c => c.id === s.reassign) || {}).name || '',
        reassignOpts: users.filter(u => ['Nurse Manager', 'CNS', 'Manager'].includes(roleOf(u).id) && u.active).map(u => {
          const cl = s.clusters.find(c => c.id === s.reassign);
          const on = cl && cl.manager === u.username;
          return {
            ini: ini(u.name),
            name: u.name,
            sub: `${roleOf(u).label} · ${s.clusters.filter(c => c.manager === u.username).map(c => c.name).join(', ') || 'no cluster yet'}`,
            go: () => {
              this.setState({
                clusters: s.clusters.map(c => c.id === s.reassign ? {
                  ...c,
                  manager: u.username
                } : c),
                reassign: null
              });
              this.orgToastMsg(`${cl ? cl.name : ''} now reports to ${u.name}`);
            },
            style: `display:flex;align-items:center;gap:10px;width:100%;box-sizing:border-box;border:1.5px solid ${on ? '#0090ca' : 'rgba(125,145,180,.3)'};border-radius:12px;padding:9px 11px;background:${on ? 'rgba(0,144,202,.08)' : 'rgba(255,255,255,.8)'};cursor:pointer;color:#16202e`
          };
        }),
        reTitle: re.id ? re.label : 'New role',
        reSub: re.id ? `${KIND_META[re.kind].label} · ${reMembers.length} member${reMembers.length === 1 ? '' : 's'}${re.system ? ' · system role' : ''}` : 'Define it once · users, the Nurse App and approvals follow',
        reSave: () => {
          if (!reValid) return;
          if (re.kind === 'portal' && !re.system && !PORTAL_ROLES.includes(re.id)) {
            this.setState({
              reToast: 'The Nurse App has four fixed roles (nurse, in-charge, collector, PCA). Create hospital-wide roles as console roles.'
            });
            setTimeout(() => this.setState({
              reToast: ''
            }), 3200);
            return;
          }
          const rec = {
            ...re,
            id: re.id || re.label.trim(),
            label: re.label.trim()
          };
          const exists = roles.some(r => r.id === rec.id);
          this.setState({
            roles: exists ? roles.map(r => r.id === rec.id ? rec : r) : [...roles, rec],
            re: rec,
            reToast: exists ? 'Role saved · every member updated' : 'Role created · available in the user role picker'
          });
          setTimeout(() => this.setState({
            reToast: ''
          }), 2400);
          this.saveRole(rec, exists);
        },
        reSaveStyle: `border:0;border-radius:11px;padding:10px 14px;color:#fff;font-size:12.5px;font-weight:700;cursor:pointer;background:linear-gradient(140deg,#2bb673,#1d8f57);box-shadow:0 8px 20px rgba(43,182,115,.3);white-space:nowrap;opacity:${reValid ? 1 : .5}`,
        reSaveLabel: re.id ? 'Save' : 'Create',
        reToast: s.reToast,
        reTabs: [['basics', 'Basics'], ['perms', re.kind === 'portal' ? 'App features' : 'Permissions'], ['members', 'Members']].map(([k, l]) => ({
          label: l,
          go: () => this.setState({
            reTab: k
          }),
          style: pillBtn(s.reTab === k)
        })),
        reTabBasics: s.reTab === 'basics',
        reTabPerms: s.reTab === 'perms',
        reTabMembers: s.reTab === 'members',
        re,
        reSetLabel: e => setRe({
          label: e.target.value
        }),
        reSetDesc: e => setRe({
          desc: e.target.value
        }),
        reNameStyle: `border:1px solid rgba(125,145,180,.3);border-radius:10px;padding:10px 12px;font-size:14px;font-weight:700;background:${re.system ? 'rgba(125,145,180,.1)' : 'rgba(255,255,255,.85)'};color:${re.system ? '#6c7a8c' : '#16202e'};outline:none`,
        reKinds: Object.keys(KIND_META).map(k => {
          const m = KIND_META[k];
          const on = re.kind === k;
          return {
            label: m.label,
            desc: m.desc,
            go: () => {
              if (re.system) return;
              setRe({
                kind: k,
                perms: k === 'console' ? Object.keys(re.perms || {}).length ? re.perms : preset({}) : {},
                appFeats: k === 'portal' ? Object.keys(re.appFeats || {}).length ? re.appFeats : featDefaults(0) : {},
                scope: k === 'admin' ? 'all' : re.scope
              });
            },
            radio: `width:18px;height:18px;border-radius:50%;border:2px solid ${on ? m.c : 'rgba(125,145,180,.5)'};background:${on ? `radial-gradient(circle,${m.c} 45%,#fff 50%)` : '#fff'};flex-shrink:0`,
            style: `display:flex;align-items:center;gap:10px;border:1.5px solid ${on ? m.c : 'rgba(125,145,180,.3)'};border-radius:12px;padding:10px 12px;background:${on ? m.c + '14' : 'rgba(255,255,255,.7)'};cursor:pointer;color:#16202e;text-align:left;opacity:${re.system && !on ? .5 : 1}`
          };
        }),
        reNotAdmin: re.kind !== 'admin',
        reLevelLabel: `Level ${levelOf(re) + (re.parent ? 1 : 0)} · ${LEVEL_NAMES[Math.min(LEVEL_NAMES.length - 1, levelOf(re) + (re.parent ? 1 : 0))]}`,
        reParentOpts: roles.filter(r => r.id !== re.id && r.kind !== 'portal').map(r => ({
          label: r.label,
          go: () => setRe({
            parent: r.id
          }),
          style: chip(re.parent === r.id)
        })),
        reParentHint: re.parent ? `${(roles.find(r => r.id === re.parent) || {
          label: re.parent
        }).label} sees and approves everything this role does.` : 'No parent · this role answers to no one.',
        reColors: ROLE_COLORS.map(c => ({
          go: () => setRe({
            color: c
          }),
          style: `width:30px;height:30px;border-radius:50%;border:3px solid ${re.color === c ? '#16202e' : '#fff'};background:${c};cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.15)`
        })),
        reIsPortal: re.kind === 'portal',
        reScopes: [['all', 'All'], ['departments', 'Own departments'], ['self', 'Own record']].map(([k, l]) => ({
          label: l,
          go: () => setRe({
            scope: k
          }),
          style: pillBtn(re.scope === k).replace('padding:7px 10px', 'padding:6px 9px').replace('font-size:12px', 'font-size:11px')
        })),
        reCanDelete: !!re.id && !re.system && !reMembers.length,
        reCannotDelete: !!re.id && (re.system || reMembers.length > 0),
        reDeleteHint: re.system ? 'System roles cannot be deleted.' : `Move its ${reMembers.length} member${reMembers.length === 1 ? '' : 's'} to another role first.`,
        reDelete: () => {
          this.setState({
            roles: roles.filter(r => r.id !== re.id),
            screen: 'roles',
            re: null
          });
          if (!s.demo && re.kind === 'console' && !re.system) api('/api/roles/' + encodeURIComponent(re.id), {
            method: 'DELETE'
          }).then(() => this.toastMsg('Role deleted on the server')).catch(e => this.toastMsg(e.message || 'The server kept the role'));
        },
        reIsAdmin: re.kind === 'admin',
        reIsConsole: re.kind === 'console',
        rePresetChips: ROLE_TEMPLATES.map(t => ({
          label: t.label,
          go: () => setRe({
            perms: JSON.parse(JSON.stringify(t.perms))
          }),
          style: chip(JSON.stringify(re.perms) === JSON.stringify(t.perms))
        })),
        rePermRows: MODULES.map(([k, label]) => {
          const acts = re.perms && re.perms[k] || [];
          return {
            label,
            summary: acts.length ? acts.map(a => a[0].toUpperCase() + a.slice(1)).join(' · ') : 'No access',
            cells: ACTS.map(a => ({
              on: reHas(k, a),
              go: () => reToggle(k, a),
              style: `width:30px;height:30px;border-radius:9px;cursor:pointer;display:grid;place-items:center;margin:0 auto;border:1.5px solid ${reHas(k, a) ? 'transparent' : 'rgba(125,145,180,.35)'};background:${reHas(k, a) ? a === 'delete' ? 'linear-gradient(140deg,#d23a52,#a8253c)' : 'linear-gradient(140deg,#6a52d4,#0072a3)' : 'rgba(255,255,255,.7)'}`
            }))
          };
        }),
        reFeatPresets: APP_ROLES.map(([id, l], i) => ({
          label: 'Like ' + l,
          go: () => setRe({
            appFeats: featDefaults(i)
          }),
          style: chip(JSON.stringify(re.appFeats) === JSON.stringify(featDefaults(i)))
        })),
        reFeatGroups: APP_FEATURES.map(g => ({
          sec: g.sec,
          rows: g.rows.map(([fid, label, sub]) => {
            const on = !!(re.appFeats && re.appFeats[fid]);
            return {
              label,
              sub,
              go: () => setRe({
                appFeats: {
                  ...(re.appFeats || {}),
                  [fid]: !on
                }
              }),
              ...toggle(on)
            };
          })
        })),
        reMemberCount: reMembers.length,
        reAddMember: () => this.newUser(re.id),
        reMembers: reMembers.map(u => ({
          ini: ini(u.name),
          name: u.name,
          username: u.username,
          open: () => this.openUser(u.username),
          avStyle: `display:grid;place-items:center;width:36px;height:36px;border-radius:10px;color:#fff;font-size:11px;font-weight:700;background:linear-gradient(135deg,${re.color || '#0072a3'},#0090ca);flex-shrink:0`
        })),
        reNoMembers: !reMembers.length,
        pendingTotal,
        hasPendingDc: s.apTab === 'data' && pendingDc > 0,
        approveAllOk: () => {
          const ok = QUEUE.filter(x => x.ok && !s.decisions[x.id]);
          const d = {
            ...s.decisions
          };
          ok.forEach(x => {
            d[x.id] = {
              status: 'Approved'
            };
            if (x.live) api('/api/submissions/' + encodeURIComponent(x.id) + '/approve', {
              method: 'POST'
            }).catch(() => {});
          });
          this.setState({
            decisions: d,
            apToast: `Approved ${ok.length} in-range submission${ok.length === 1 ? '' : 's'}`
          });
          setTimeout(() => this.setState({
            apToast: ''
          }), 2200);
        },
        apTabs: [['data', 'Data', pendingDc], ['leave', 'Leave & OT', pendingLeave], ['reports', 'Shift reports', pendingRep]].map(([k, l, n]) => ({
          label: l,
          badge: n || null,
          go: () => this.setState({
            apTab: k,
            apFilter: 'All',
            returning: null
          }),
          style: pillBtn(s.apTab === k).replace('padding:7px 10px', 'padding:7px 4px').replace('font-size:12px', 'font-size:11px')
        })),
        apFilters: ['All', 'Pending', 'Out of range', ...Array.from(new Set(apSource.map(x => x.dept)))].map(f => ({
          label: f,
          go: () => this.setState({
            apFilter: f
          }),
          style: chip(s.apFilter === f)
        })),
        apToast: s.apToast,
        apList: apList.map(q => ({
          ...q,
          approve: () => {
            q.approve();
            if (q.live) this.decideLive(q, 'approve');
          },
          confirmReturn: () => {
            const reason = s.apReason.trim();
            q.confirmReturn();
            if (q.live && reason) this.decideLive(q, 'return', reason);
          }
        })),
        apReason: s.apReason,
        setApReason: e => this.setState({
          apReason: e.target.value
        }),
        apEmpty: !apList.length,
        deptCount: DEPTS.length,
        staffTotal: DEPTS.reduce((a, d) => a + ((DEPT_INFO[d] || {}).staff || 0), 0),
        deptList: DEPTS.map(d => {
          const c = covOf(d);
          const info = DEPT_INFO[d] || {
            name: d,
            staff: 0,
            incharge: '—'
          };
          const pct = Math.round(c.app / c.total * 100);
          return {
            short: d.slice(0, 4),
            name: info.name,
            incharge: info.incharge || '—',
            staff: info.staff || 0,
            cov: pct + '%',
            covStyle: `font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:700;color:${pct >= 80 ? '#1d8f57' : pct >= 50 ? '#b8650a' : '#b32e2e'}`,
            barA: seg(c.app, c.total, '#1d8f57'),
            barP: seg(c.pen, c.total, '#0090ca'),
            barR: seg(c.rej, c.total, '#d23a52'),
            sent: c.app + c.pen + c.rej,
            total: c.total,
            alert: c.rej ? `${c.rej} returned` : c.mis >= 4 ? `${c.mis} not submitted` : null,
            avStyle: 'display:grid;place-items:center;width:40px;height:40px;border-radius:12px;color:#fff;font-size:11px;font-weight:700;letter-spacing:.2px;background:linear-gradient(135deg,#0d2a4a,#0a5f87);flex-shrink:0',
            go: () => go('deptDetail', {
              selDept: d
            })
          };
        }),
        dd: {
          name: (dd || {}).name || s.selDept,
          staff: (dd || {}).staff || 0,
          beds: (dd || {}).beds || '—'
        },
        ddTiles: [{
          label: 'Approved',
          v: ddCov.app,
          color: '#1d8f57'
        }, {
          label: 'Pending',
          v: ddCov.pen,
          color: '#0072a3'
        }, {
          label: 'Missing',
          v: ddCov.mis + ddCov.rej,
          color: ddCov.mis + ddCov.rej ? '#b32e2e' : '#1d8f57'
        }],
        ddPeople: [{
          name: (dd || {}).incharge || '—',
          role: 'Nurse in-charge',
          u: users.find(u => u.name === (dd || {}).incharge)
        }, ...ddUsers.filter(u => u.name !== (dd || {}).incharge).map(u => ({
          name: u.name,
          role: roleOf(u).label + ' · @' + u.username,
          u
        }))].map(p => ({
          ini: ini(p.name),
          name: p.name,
          role: p.role,
          hasLogin: !!p.u,
          noLogin: !p.u,
          openUser: () => p.u && this.openUser(p.u.username),
          createLogin: () => this.newUser('incharge')
        })),
        ddItems: DC_ITEMS.map((label, i) => {
          const q = QUEUE.find(x => x.dept === s.selDept && x.label.toLowerCase().startsWith(label.toLowerCase().slice(0, 6)));
          const d = q && s.decisions[q.id];
          const st = q ? d ? d.status === 'Approved' ? 'approved' : 'returned' : 'pending' : i < ddCov.app ? 'approved' : 'missing';
          const c = {
            approved: '#1d8f57',
            pending: '#0072a3',
            returned: '#b32e2e',
            missing: '#b8650a'
          }[st];
          return {
            label,
            status: {
              approved: 'Approved',
              pending: 'Pending',
              returned: 'Returned',
              missing: 'Not submitted'
            }[st],
            statusStyle: `display:inline-flex;align-items:center;gap:5px;font-size:10.5px;font-weight:700;padding:3px 8px;border-radius:999px;color:${c};background:${c}22;white-space:nowrap`,
            dot: `width:6px;height:6px;border-radius:50%;background:${c}`
          };
        }),
        ddRemind: () => {
          this.setState({
            reminded: {
              ...s.reminded,
              [s.selDept]: true
            }
          });
        },
        ddRemindLabel: s.reminded[s.selDept] ? 'Reminder sent ✓' : 'Remind in-charge',
        bcSent: s.bcSent,
        bcNotSent: !s.bcSent,
        bcReach,
        bcReset: () => this.setState({
          bcSent: false,
          bcTitle: '',
          bcBody: ''
        }),
        bcTitle: s.bcTitle,
        setBcTitle: e => this.setState({
          bcTitle: e.target.value
        }),
        bcBody: s.bcBody,
        setBcBody: e => this.setState({
          bcBody: e.target.value
        }),
        bcCats: ['General', 'Policy', 'Training', 'Roster', 'Urgent'].map(c => ({
          label: c,
          go: () => this.setState({
            bcCat: c
          }),
          style: chip(s.bcCat === c)
        })),
        bcAud: [['all', 'All staff'], ...DEPTS.map(d => [d, d])].map(([k, l]) => ({
          label: l,
          go: () => {
            const a = {
              ...s.bcAud
            };
            if (k === 'all') {
              this.setState({
                bcAud: {
                  all: true
                }
              });
              return;
            }
            delete a.all;
            a[k] = !a[k];
            if (!Object.values(a).some(Boolean)) a.all = true;
            this.setState({
              bcAud: a
            });
          },
          style: chip(!!s.bcAud[k])
        })),
        bcOpts: [['bcAck', 'Require acknowledgement', 'Staff must tap "I have read this"'], ['bcPin', 'Pin to top', 'Stays first in every Notices list'], ['bcPush', 'Push notification', 'Wakes phones that are not in the app']].map(([k, l, sub]) => ({
          label: l,
          sub,
          go: () => this.setState({
            [k]: !s[k]
          }),
          ...toggle(!!s[k])
        })),
        bcSend: () => {
          if (!s.bcTitle.trim() || !s.bcBody.trim()) return;
          this.broadcast({
            title: s.bcTitle.trim(),
            body: s.bcBody.trim(),
            cat: s.bcCat,
            audience: s.bcAud.all ? 'all' : 'depts',
            depts: DEPTS.filter(d => s.bcAud[d]).map(d => LV.deptId(d)),
            needsAck: !!s.bcAck,
            pinned: !!s.bcPin,
            when: 'now'
          });
        },
        bcSendStyle: `border:0;border-radius:13px;padding:14px;color:#fff;font-size:14px;font-weight:700;cursor:pointer;background:linear-gradient(140deg,#6a52d4,#0072a3);box-shadow:0 10px 24px rgba(106,82,212,.3);opacity:${s.bcTitle.trim() && s.bcBody.trim() ? 1 : .5}`,
        logFilters: ['All', 'Sign-ins', 'Users & roles', 'Submissions', 'Security'].map(f => ({
          label: f,
          go: () => this.setState({
            logFilter: f
          }),
          style: chip(s.logFilter === f)
        })),
        logList,
        settingGroups: [{
          sec: 'Security',
          items: [{
            label: 'Login portal',
            sub: 'Every user signs in · enforced by the server',
            isValue: true,
            value: 'Required'
          }, {
            label: 'Failed sign-ins',
            sub: 'Locked for 15 min after repeated failures',
            isValue: true,
            value: 'Throttled'
          }, {
            label: 'Session length',
            sub: 'Signed-in time before re-authentication',
            isValue: true,
            value: set.session
          }, {
            label: 'App PIN lock',
            sub: 'Nurse App locks after 5 minutes idle',
            isToggle: true,
            go: () => setS('pinLock'),
            ...toggle(set.pinLock)
          }]
        }, {
          sec: 'Data',
          items: [{
            label: 'Backups',
            sub: 'Continuous, by the database host',
            isValue: true,
            value: 'Automatic'
          }, {
            label: 'Export a snapshot',
            sub: 'Backup & restore live in the desktop console',
            isValue: true,
            value: 'Console'
          }]
        }, {
          sec: 'Nurse App',
          items: [{
            label: 'Phone numbers in directory',
            sub: 'Show staff mobiles to colleagues',
            isToggle: true,
            go: () => setS('portalPhones'),
            ...toggle(set.portalPhones)
          }, {
            label: 'Offline mode',
            sub: 'Keep the roster and formulary on the phone',
            isToggle: true,
            go: () => setS('offline'),
            ...toggle(set.offline)
          }, {
            label: 'App version',
            sub: 'Minimum version allowed to sign in',
            isValue: true,
            value: s.live.settings && s.live.settings.policy && s.live.settings.policy.minAppVersion || HOSP.version
          }]
        }].map(g => ({
          ...g,
          items: g.items.map(it => ({
            isToggle: false,
            isValue: false,
            isButton: false,
            ...it
          }))
        })),
        setToast: s.setToast,
        navItems: [['home', 'home', 'Home', 'M3 11l9-8 9 8v9a2 2 0 01-2 2h-4v-7h-6v7H5a2 2 0 01-2-2z', null], ['users', 'users', 'Users', 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 3a4 4 0 110 8 4 4 0 010-8z', null], ['approvals', 'approvals', 'Review', 'M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11', pendingTotal || null], ['modules', 'modules', 'Modules', 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z', null], ['more', 'settings', 'More', 'M12 5.5v.01M12 12v.01M12 18.5v.01', null]].map(([k, screen, label, d, badge]) => ({
          label,
          d,
          badge,
          go: () => go(screen),
          iconWrap: 'position:relative;display:grid;place-items:center;width:44px;height:30px;border-radius:12px;' + (navGroup === k ? 'background:rgba(106,82,212,.13)' : ''),
          style: `display:flex;flex-direction:column;align-items:center;gap:3px;border:0;background:transparent;padding:4px 0;cursor:pointer;color:${navGroup === k ? '#6a52d4' : '#7d8ea8'}`
        })),
        drawerGroups: [{
          sec: 'Administration',
          items: [dItem('home', 'Home', 'M3 11l9-8 9 8v9a2 2 0 01-2 2h-4v-7h-6v7H5a2 2 0 01-2-2z'), dItem('users', 'Users & access', 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 3a4 4 0 110 8 4 4 0 010-8z'), dItem('roles', 'Roles', 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'), dItem('org', 'Nursing hierarchy', 'M12 3v6M6 15v-3a3 3 0 013-3h6a3 3 0 013 3v3M6 15a3 3 0 100 6 3 3 0 000-6zM18 15a3 3 0 100 6 3 3 0 000-6z'), dItem('appAccess', 'Nurse App access', 'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z', {
            badge: aaDirty ? '!' : null
          })]
        }, {
          sec: 'Operations',
          items: [dItem('approvals', 'Review & approve', 'M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11', {
            badge: pendingTotal || null
          }), dItem('depts', 'Departments', 'M3 21h18M5 21V7l7-4 7 4v14'), dItem('modules', 'All modules', 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z'), dItem('broadcast', 'Broadcast', 'M3 11v2a1 1 0 001 1h3l5 4V6L7 10H4a1 1 0 00-1 1zM16 8a5 5 0 010 8M19 5a9 9 0 010 14')]
        }, {
          sec: 'System',
          items: [dItem('activity', 'Activity log', 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2'), dItem('settings', 'Settings', 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z'), {
            label: 'Open the Nurse App',
            d: 'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z',
            badge: null,
            go: () => {
              window.location.href = '/app#nurse';
            },
            style: dItem('x', '', '').style
          }]
        }],
        systemStatus: (() => {
          if (!LV.live) return 'System status · all services up';
          const h = s.live.health;
          if (!h) return 'System status · checking…';
          if (!h.ok) return 'System status · database unreachable';
          return 'System status · database up' + (h.redis && h.redis.live ? ' · cache up' : '');
        })(),
        mePhoto: me.photo && (me.photo.url || me.photo) || '',
        meHasPhoto: !!(me.photo && (me.photo.url || me.photo)),
        meNoPhoto: !(me.photo && (me.photo.url || me.photo)),
        meName: me.name || me.username || '—',
        meFirst: String(me.name || me.username || '—').split(' ')[0],
        meIni: ini(me.name || me.username || '?'),
        meUsername: me.username || '',
        meRoleLine: me.role === 'Administrator' ? 'Administrator · full access' : (me.title || me.designation || 'Manager') + ' · console access',
        hospitalName: HOSP.name,
        appLabel: 'Admin v' + HOSP.version,
        loginFooter: HOSP.name + ' · Admin v' + HOSP.version,
        appFooter: 'UNICO Admin · v' + HOSP.version,
        queueMonthLabel: (() => {
          const ms = QUEUE.filter(q => !s.decisions[q.id]).map(q => q.month).filter(Boolean);
          return ms.length ? Array.from(new Set(ms)).slice(0, 2).map(m => String(m).replace(/^([A-Za-z]{3})-(\d{2})$/, '$1 20$2')).join(', ') + ' submissions' : LV.live ? 'nothing waiting' : 'Aug 2026 submissions';
        })(),
        doLogin: () => {
          if (!s.loginBusy) this.doLogin();
        },
        signOut: () => this.signOut(),
        udSave: () => {
          const legacy = this.kindToLegacy(udRoleObj);
          if (s.udNew) {
            if (!ud.username || !ud.name) return;
            const nu = {
              ...ud,
              role: legacy,
              title: udRoleObj.label,
              online: false,
              lastLogin: 'Never',
              created: 'Today'
            };
            const pw = nu.pw;
            delete nu.pw;
            this.setState({
              users: [nu, ...users],
              udNew: false,
              selUser: nu.username,
              ud: {
                ...nu,
                pw: ''
              }
            });
            this.liveUser('create', {
              ...nu,
              pw
            }, udRoleObj);
            toastUd(`Account @${nu.username} created`);
          } else {
            this.setState({
              users: users.map(u => u.username === ud.username ? {
                ...u,
                name: ud.name,
                role: legacy,
                roleId: ud.roleId,
                title: udRoleObj.label,
                active: ud.active,
                emp: ud.emp,
                depts: ud.depts,
                scope: ud.scope,
                perms: ud.perms
              } : u)
            });
            this.liveUser('update', ud, udRoleObj);
            toastUd('Saved · takes effect within 15 s on every device');
          }
        },
        _toast: s.toast
      };
    }
    componentDidMount() {
      this.loadSeedMeds();
      tryApi('/api/phone/branding').then(b => {
        if (b && b.ok && b.hospital) this.setState({
          branding: b.hospital
        });
      });
      const h = String(window.location.hash || '').replace(/^#/, '');
      const localHost = /^(localhost|127\.0\.0\.1|10\.0\.2\.2|\[::1\])$/.test(String(window.location.hostname || '')) || /\.local$/.test(String(window.location.hostname || ''));
      if (localHost && /(^|&)demo(=|&|$)/.test(h)) {
        const m = h.match(/(?:^|&)screen=([^&]*)/);
        this.setState({
          booting: false,
          demo: true,
          screen: m && decodeURIComponent(m[1]) || 'home',
          me: {
            name: 'System Administrator',
            username: 'admin',
            role: 'Administrator'
          }
        });
        return;
      }
      this.setState({
        users: [],
        roles: seedRoles().filter(r => r.system || r.kind === 'portal'),
        customMods: [],
        clusters: [],
        aaDeptOv: {},
        udFeatOv: {}
      });
      tryApi('/api/me').then(me => {
        if (me && me.ok && me.user && PORTAL_ROLES.indexOf(me.user.role) < 0) this.enter(me);else {
          if (me && me.ok && me.user) this.toastMsg('That account uses the Nurse App, not the admin console.');
          this.setState({
            booting: false,
            screen: 'login'
          });
        }
      });
    }
    toastMsg(msg) {
      this.setState({
        toast: msg
      });
      clearTimeout(this._toastT);
      this._toastT = setTimeout(() => this.setState({
        toast: ''
      }), 2600);
    }
    async doLogin() {
      const username = this.state.loginUser.trim().toLowerCase(),
        password = this.state.loginPw;
      if (!username || !password) return this.toastMsg('Enter your username and password.');
      this.setState({
        loginBusy: true
      });
      try {
        const r = await api('/api/login', {
          method: 'POST',
          body: {
            username,
            password
          }
        });
        if (r.user && PORTAL_ROLES.indexOf(r.user.role) >= 0) {
          this.setState({
            loginBusy: false
          });
          return this.toastMsg('That account uses the Nurse App — open /app instead.');
        }
        const me = await api('/api/me');
        this.enter(me);
      } catch (e) {
        this.setState({
          loginBusy: false
        });
        this.toastMsg(e.status === 401 ? 'Wrong username or password.' : e.status === 429 ? e.message || 'Too many attempts. Try again shortly.' : 'Could not reach the hospital server.');
      }
    }
    enter(me) {
      this.setState({
        me: Object.assign({
          perms: me.perms
        }, me.user || {}),
        booting: false,
        screen: 'home',
        drawerOpen: false,
        loginPw: '',
        loginBusy: false
      });
      this.loadLive();
    }
    signOut() {
      if (this.state.demo) {
        window.location.hash = '';
      }
      fetch('/logout', {
        credentials: 'same-origin'
      }).catch(() => {});
      clearInterval(this._poll);
      this.setState({
        screen: 'login',
        me: null,
        loginUser: '',
        loginPw: '',
        drawerOpen: false,
        users: [],
        roles: seedRoles().filter(r => r.system || r.kind === 'portal'),
        decisions: {},
        modDec: {},
        live: {
          users: null,
          roles: null,
          log: null,
          subs: null,
          depts: null,
          staff: null,
          meds: null,
          deptsRaw: null,
          staffRaw: null,
          subsRaw: null,
          quality: null,
          settings: null,
          requests: null,
          shiftReports: null,
          incidents: null,
          medReqs: null,
          rosters: null,
          perf: null,
          online: null
        }
      });
    }
    async loadLive() {
      const patch = (k, v) => this.setState(s => ({
        live: Object.assign({}, s.live, {
          [k]: v
        })
      }));
      const [depts, staff, users, roles, log, subs, meds] = await Promise.all([tryApi('/api/departments'), tryApi('/api/staff'), tryApi('/api/users'), tryApi('/api/roles'), tryApi('/api/activity?limit=120'), tryApi('/api/submissions?limit=300'), tryApi('/api/med/browse?per=60&page=1')]);
      const deptList = depts && depts.ok && Array.isArray(depts.departments) && depts.departments.length ? depts.departments : null;
      const staffList = staff && staff.ok && Array.isArray(staff.staff) ? staff.staff : [];
      const userList = users && users.ok && Array.isArray(users.users) && users.users.length ? users.users : null;
      const shortOf = d => d.short || liveShort(d.name || d.id);
      const deptIdToShort = {};
      (deptList || []).forEach(d => {
        deptIdToShort[d.id || d._id] = shortOf(d);
        deptIdToShort[d.name] = shortOf(d);
      });
      if (deptList) {
        const info = {};
        deptList.forEach(d => {
          const sh = shortOf(d);
          const norm = x => String(x || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
          const n = staffList.filter(p => !p.former && String(p.current_department || '').split(',').some(x => norm(x) === norm(d.name) || norm(x) === norm(d.id || d._id) || norm(x) === norm(sh))).length;
          const inch = (userList || []).find(u => u.role === 'incharge' && (u.departments || []).includes(d.id || d._id));
          info[sh] = {
            id: d.id || d._id,
            name: d.name,
            staff: n,
            beds: d.beds || 0,
            incharge: inch ? inch.name : '—'
          };
        });
        patch('depts', {
          list: Object.keys(info),
          info
        });
        const first = Object.keys(info)[0];
        if (first) this.setState(st => ({
          selDept: info[st.selDept] ? st.selDept : first,
          aaDept: info[st.aaDept] ? st.aaDept : first,
          pvDept: info[st.pvDept] ? st.pvDept : first,
          stDept: info[st.stDept] ? st.stDept : first,
          stCompare: st.stCompare.filter(d => info[d]).length ? st.stCompare.filter(d => info[d]) : Object.keys(info).slice(0, 3)
        }));
      }
      if (roles && roles.ok && Array.isArray(roles.templates)) {
        const extra = roles.templates.filter(t => !this.state.roles.some(r => r.label.toLowerCase() === String(t.name || '').toLowerCase())).map(t => ({
          id: t.name,
          label: t.name,
          desc: t.description || 'Server role template',
          kind: 'console',
          system: false,
          color: '#0072a3',
          perms: permsFromLevels(t.perms),
          appFeats: {},
          scope: 'departments',
          parent: 'CNS',
          live: true
        }));
        if (extra.length) this.setState(s => ({
          roles: [...s.roles, ...extra]
        }));
        patch('roles', roles.templates);
      }
      if (userList) {
        const mapped = userList.map(u => liveUser(u, this.state.roles, deptIdToShort));
        this.setState({
          users: mapped,
          selUser: (mapped[0] || {}).username || this.state.selUser
        });
        patch('users', userList);
      }
      if (log && log.ok && Array.isArray(log.entries) && log.entries.length) patch('log', log.entries.map(liveLog));
      if (subs && subs.ok && Array.isArray(subs.submissions)) {
        const q = subs.submissions.filter(x => x.status === 'pending').map(liveQueue).filter(Boolean);
        if (q.length) patch('subs', q);
      }
      if (meds && meds.ok && Array.isArray(meds.rows) && meds.rows.length) {
        const list = meds.rows.map(liveMed);
        patch('meds', list);
        this.setState({
          meds: list,
          amSel: list[0].id
        });
      } else this.setState({
        meds: []
      });
      if (deptList) patch('deptsRaw', deptList);
      patch('staffRaw', staffList);
      if (subs && subs.ok && Array.isArray(subs.submissions)) patch('subsRaw', subs.submissions);
      this._deptShort = deptIdToShort;
      const [settings, quality, requests, shiftReports, incidents, medReqs, rosters, perf, presence, health] = await Promise.all([tryApi('/api/health').then(h => h || {
        ok: false
      }), tryApi('/api/phone/settings'), tryApi('/api/quality'), tryApi('/api/phone/requests'), tryApi('/api/phone/shift-reports'), tryApi('/api/phone/incidents'), tryApi('/api/phone/med-requests?all=1'), tryApi('/api/rosters'), tryApi('/api/performance'), tryApi('/api/phone/presence')]);
      if (settings && settings.ok && settings.settings) this.applySettings(settings.settings);
      if (quality && quality.ok && Array.isArray(quality.quality)) patch('quality', quality.quality);
      if (requests && requests.ok) patch('requests', (requests.team || []).concat(requests.mine || []).filter((r, i, a) => a.findIndex(x => x.id === r.id) === i));
      if (shiftReports && shiftReports.ok) patch('shiftReports', shiftReports.reports || []);
      if (incidents && incidents.ok) patch('incidents', incidents.incidents || []);
      if (medReqs && medReqs.ok) patch('medReqs', medReqs.requests || []);
      if (rosters && rosters.ok) patch('rosters', rosters.rosters || []);
      if (perf && perf.ok) patch('perf', perf);
      if (presence && presence.ok) patch('online', presence.online || []);
      patch('health', health);
      clearInterval(this._poll);
      this._poll = setInterval(() => this.refreshQueues(), 30000);
    }
    async refreshQueues() {
      if (this.state.demo || !this.state.me || typeof document !== 'undefined' && document.hidden) return;
      const patch = (k, v) => this.setState(s => ({
        live: Object.assign({}, s.live, {
          [k]: v
        })
      }));
      const [subs, requests, shiftReports, incidents, medReqs, presence] = await Promise.all([tryApi('/api/submissions?limit=300'), tryApi('/api/phone/requests'), tryApi('/api/phone/shift-reports'), tryApi('/api/phone/incidents'), tryApi('/api/phone/med-requests?all=1'), tryApi('/api/phone/presence')]);
      if (subs && subs.ok && Array.isArray(subs.submissions)) {
        patch('subsRaw', subs.submissions);
        patch('subs', subs.submissions.filter(x => x.status === 'pending').map(liveQueue).filter(Boolean));
      }
      if (requests && requests.ok) patch('requests', (requests.team || []).concat(requests.mine || []).filter((r, i, a) => a.findIndex(x => x.id === r.id) === i));
      if (shiftReports && shiftReports.ok) patch('shiftReports', shiftReports.reports || []);
      if (incidents && incidents.ok) patch('incidents', incidents.incidents || []);
      if (medReqs && medReqs.ok) patch('medReqs', medReqs.requests || []);
      if (presence && presence.ok) patch('online', presence.online || []);
    }
    componentWillUnmount() {
      clearInterval(this._poll);
      clearTimeout(this._saveT);
    }
    applySettings(doc) {
      const short = id => this._deptShort && this._deptShort[id] || id;
      const deptOv = {};
      Object.keys(doc.deptOverrides || {}).forEach(id => {
        deptOv[short(id)] = doc.deptOverrides[id];
      });
      const clusters = (doc.clusters || []).map(c => Object.assign({}, c, {
        depts: (c.depts || []).map(short)
      }));
      const customMods = (doc.customMods || []).map(m => Object.assign({}, m, {
        depts: (m.depts || []).map(d => d === 'All' ? d : short(d))
      }));
      const feats = Object.assign({}, doc.features || {});
      this._settingsLoaded = true;
      this.setState(s => ({
        live: Object.assign({}, s.live, {
          settings: doc
        }),
        aaFeat: feats,
        aaPublished: Object.assign({}, feats),
        aaDeptOv: deptOv,
        udFeatOv: Object.assign({}, doc.userOverrides || {}),
        customMods,
        clusters,
        rules: Object.assign({}, doc.rules || {}),
        escHours: doc.escHours != null ? doc.escHours : 48,
        settings: Object.assign({}, s.settings, {
          pinLock: !!(doc.policy || {}).pinLock,
          portalPhones: (doc.policy || {}).portalPhones !== false,
          offline: (doc.policy || {}).offline !== false
        })
      }));
    }
    settingsDoc() {
      const s = this.state;
      const id = sh => {
        const d = s.live.depts;
        return d && d.info[sh] && d.info[sh].id || sh;
      };
      const deptOverrides = {};
      Object.keys(s.aaDeptOv || {}).forEach(sh => {
        if (Object.keys(s.aaDeptOv[sh] || {}).length) deptOverrides[id(sh)] = s.aaDeptOv[sh];
      });
      const userOverrides = {};
      Object.keys(s.udFeatOv || {}).forEach(u => {
        if (Object.keys(s.udFeatOv[u] || {}).length) userOverrides[u] = s.udFeatOv[u];
      });
      const cur = s.live.settings || {};
      return {
        features: s.aaPublished,
        deptOverrides,
        userOverrides,
        rules: s.rules,
        escHours: s.escHours,
        clusters: (s.clusters || []).map(c => Object.assign({}, c, {
          depts: (c.depts || []).map(id)
        })),
        customMods: (s.customMods || []).map(m => Object.assign({}, m, {
          depts: (m.depts || []).map(d => d === 'All' ? d : id(d))
        })),
        hospital: cur.hospital,
        phonebook: cur.phonebook,
        policy: Object.assign({}, cur.policy, {
          pinLock: !!s.settings.pinLock,
          portalPhones: !!s.settings.portalPhones,
          offline: !!s.settings.offline
        })
      };
    }
    componentDidUpdate(prevProps, prev) {
      if (this.state.demo || !this._settingsLoaded || !this.state.me) return;
      const keys = ['aaPublished', 'aaDeptOv', 'udFeatOv', 'customMods', 'clusters', 'rules', 'escHours', 'settings'];
      if (!keys.some(k => prev[k] !== this.state[k])) return;
      clearTimeout(this._saveT);
      this._saveT = setTimeout(() => {
        api('/api/phone/settings', {
          method: 'PUT',
          body: this.settingsDoc()
        }).then(r => {
          if (r && r.settings) this.setState(s => ({
            live: Object.assign({}, s.live, {
              settings: r.settings
            })
          }));
        }).catch(e => this.toastMsg(e.message || 'Settings were not saved.'));
      }, 600);
    }
    saveRole(rec, exists) {
      if (this.state.demo) return;
      if (rec.kind === 'portal') {
        const feats = Object.assign({}, this.state.aaPublished);
        Object.keys(rec.appFeats || {}).forEach(fid => {
          feats[fid + ':' + rec.id] = !!rec.appFeats[fid];
        });
        this.setState({
          aaFeat: Object.assign({}, this.state.aaFeat, feats),
          aaPublished: feats
        });
        return;
      }
      if (rec.kind !== 'console') return;
      const body = {
        name: rec.label,
        description: rec.desc || '',
        perms: levelsFromPerms(rec.perms)
      };
      const p = exists && rec.live !== false && (this.state.live.roles || []).some(x => x.id === rec.id || String(x.name).toLowerCase() === String(rec.label).toLowerCase()) ? api('/api/roles/' + encodeURIComponent(rec.id), {
        method: 'PUT',
        body
      }) : api('/api/roles', {
        method: 'POST',
        body: Object.assign({
          id: rec.id
        }, body)
      });
      p.then(r => {
        if (r && r.template) this.setState(st => ({
          roles: st.roles.map(x => x.id === rec.id ? Object.assign({}, x, {
            id: r.template.id,
            live: true
          }) : x),
          live: Object.assign({}, st.live, {
            roles: (st.live.roles || []).filter(x => x.id !== r.template.id).concat([r.template])
          })
        }));
        this.toastMsg('Role saved on the server');
      }).catch(e => this.toastMsg(e.message || 'The server did not save the role.'));
    }
    post(path, body, after) {
      return api(path, {
        method: 'POST',
        body: body || {}
      }).then(r => {
        if (after) after(r);
        this.refreshQueues();
        return r;
      }).catch(e => {
        this.toastMsg(e.message || 'The server rejected that.');
        return null;
      });
    }
    decideLive(q, action, reason) {
      if (q.src === 'request') return this.post('/api/phone/requests/' + encodeURIComponent(q.id) + '/decide', {
        status: action === 'approve' ? 'approved' : 'declined',
        reason: reason || ''
      });
      if (q.src === 'shift') return this.post('/api/phone/shift-reports/' + encodeURIComponent(q.id) + '/status', {
        status: action === 'approve' ? 'Approved' : 'Returned',
        reason: reason || ''
      });
      return api('/api/submissions/' + encodeURIComponent(q.id) + '/' + (action === 'approve' ? 'approve' : 'reject'), {
        method: 'POST',
        body: action === 'approve' ? {} : {
          reason: reason || ''
        }
      }).catch(e => this.toastMsg(e.message || 'Server did not record the decision'));
    }
    incidentStatus(id, status) {
      if (!id || this.state.demo) return;
      this.post('/api/phone/incidents/' + encodeURIComponent(id) + '/status', {
        status
      });
    }
    shiftStatus(id, status) {
      if (!id || this.state.demo) return;
      this.post('/api/phone/shift-reports/' + encodeURIComponent(id) + '/status', {
        status
      });
    }
    medDecide(id, status, openId) {
      if (!id || this.state.demo) return;
      this.post('/api/phone/med-requests/' + encodeURIComponent(id) + '/decide', {
        status,
        openId: openId || null
      });
    }
    appraisalAction(id) {
      if (!id || this.state.demo) return;
      this.post('/api/performance/appraisals/' + encodeURIComponent(id) + '/action', {
        actions: ['Signed off'],
        authorityRemarks: 'Signed off in the Admin App'
      }, () => tryApi('/api/performance').then(p => {
        if (p && p.ok) this.setState(s => ({
          live: Object.assign({}, s.live, {
            perf: p
          })
        }));
      }));
    }
    rosterStatus(ref, status) {
      if (!ref || this.state.demo) return;
      tryApi('/api/rosters/' + encodeURIComponent(ref.dept) + '/' + ref.year + '/' + ref.month).then(r => {
        if (!r || !r.ok || !r.roster) return this.toastMsg('Roster not found.');
        const me = this.state.me || {};
        return api('/api/rosters', {
          method: 'PUT',
          body: Object.assign({}, r.roster, {
            status,
            approvedBy: status === 'approved' ? me.name || me.username : r.roster.approvedBy
          })
        }).then(() => tryApi('/api/rosters')).then(x => {
          if (x && x.ok) this.setState(s => ({
            live: Object.assign({}, s.live, {
              rosters: x.rosters || []
            })
          }));
        });
      }).catch(e => this.toastMsg(e.message || 'The roster was not updated.'));
    }
    broadcast(body) {
      if (this.state.demo) return this.setState({
        bcSent: true
      });
      api('/api/phone/notices', {
        method: 'POST',
        body
      }).then(() => this.setState({
        bcSent: true
      })).catch(e => this.toastMsg(e.message || 'The notice was not published.'));
    }
    dataEntry(F) {
      const s = this.state;
      if (s.demo) return this.modToast('Saved ' + (F.dept || '') + ' · ' + (F.month || '') + ' to statistics');
      const info = s.live.depts && s.live.depts.info[F.dept || (s.live.depts.list || [])[0]];
      const doc = (s.live.deptsRaw || []).find(d => info && String(d.id || d._id) === String(info.id));
      if (!doc) return this.modToast('Pick a department first');
      const values = {};
      [['adm', /^adm$|admission/i], ['dis', /discharge/i], ['deaths', /^death|deaths/i], ['pdays', /patient.?days|pdays/i]].forEach(([k, rx]) => {
        const c = (doc.cols || []).find(x => rx.test(x.id || '') || rx.test(x.label || ''));
        if (c && F[k] !== undefined && F[k] !== '') values[c.id] = Number(F[k]);
      });
      const month = String(F.month || LV_MONTH_KEY(5)).replace(/^(\w{3}) (\d{4})$/, (m, a, b) => a + '-' + b.slice(2));
      api('/api/submissions/patient', {
        method: 'POST',
        body: {
          department: doc.id || doc._id,
          month,
          values,
          note: 'Entered in the Admin App'
        }
      }).then(() => {
        this.modToast('Sent to the review queue · ' + doc.name + ' · ' + month);
        this.refreshQueues();
      }).catch(e => this.modToast(e.message || 'Not saved'));
    }
    liveUser(kind, ud, roleObj) {
      if (!this.state.live.users) return;
      const shortToId = {};
      const d = this.state.live.depts;
      if (d) Object.keys(d.info).forEach(sh => {
        shortToId[sh] = d.info[sh].id;
      });
      const body = {
        name: ud.name,
        role: this.kindToLegacy(roleObj || this.roleOf(ud)),
        title: (roleObj || this.roleOf(ud)).label,
        active: ud.active !== false,
        departments: (ud.depts || []).map(x => shortToId[x] || x),
        staffScope: ud.scope || 'departments',
        perms: levelsFromPerms(ud.perms),
        roleTemplate: ud.roleId || null,
        staffEmpId: ud.emp && ud.emp !== '—' ? ud.emp : null
      };
      let p;
      if (kind === 'create') p = api('/api/users', {
        method: 'POST',
        body: Object.assign({
          username: ud.username,
          password: ud.pw || Math.random().toString(36).slice(2, 10)
        }, body)
      });else if (kind === 'update' || kind === 'active') p = api('/api/users/' + encodeURIComponent(ud.username), {
        method: 'PATCH',
        body: kind === 'active' ? {
          active: ud.active
        } : body
      });else if (kind === 'password') p = api('/api/users/' + encodeURIComponent(ud.username) + '/password', {
        method: 'POST',
        body: {
          password: Math.random().toString(36).slice(2, 6) + '-' + Math.random().toString(36).slice(2, 6)
        }
      }).then(() => this.setState({
        udToast: 'Temporary password set · share it with the user'
      }));
      if (p) p.catch(e => this.toastMsg(e.message || 'The server rejected the change.'));
    }
    render() {
      const v = this.renderVals();
      return React.createElement(React.Fragment, null, React.createElement(View, {
        v: v
      }), v._toast ? React.createElement("div", {
        style: {
          position: 'fixed',
          left: '50%',
          bottom: 28,
          transform: 'translateX(-50%)',
          zIndex: 60,
          maxWidth: 'min(92vw,380px)',
          padding: '11px 16px',
          borderRadius: 14,
          background: 'rgba(27,22,66,.94)',
          color: '#fff',
          fontSize: 13,
          fontWeight: 600,
          boxShadow: '0 14px 40px rgba(0,0,0,.3)',
          animation: 'pop .25s ease'
        }
      }, v._toast) : null);
    }
  }
  const PORTAL_ROLES = ['incharge', 'collector', 'nurse', 'pca'];
  const NOWD = new Date(),
    YR = NOWD.getFullYear(),
    MO = NOWD.getMonth(),
    TODAY_D = NOWD.getDate(),
    DIM_D = new Date(YR, MO + 1, 0).getDate();
  const M3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const LV_MONTHS = [];
  for (let k = 6; k >= 0; k--) {
    const d = new Date(YR, MO - k, 1);
    LV_MONTHS.push({
      label: M3[d.getMonth()],
      key: M3[d.getMonth()] + '-' + String(d.getFullYear()).slice(-2),
      y: d.getFullYear(),
      m: d.getMonth()
    });
  }
  const LV_MONTH_KEY = i => LV_MONTHS[i].key;
  const fmtIsoD = iso => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    if (!m) return String(iso || '—');
    return Number(m[3]) + ' ' + M3[Number(m[2]) - 1];
  };
  const COLRX = {
    adm: /^adm$|admission/i,
    dis: /discharge/i,
    deaths: /^death|deaths|mortalit/i,
    pdays: /patient.?days|pdays|bed.?days/i,
    occ: /occupan/i,
    er: /^reg$|er reg|attendance|visits/i,
    surg: /surg|procedure|^ot$/i,
    nvd: /nvd|normal deliv/i,
    cs: /caesar|cesar|^cs$|lscs/i
  };
  const colFind = (cols, k) => (cols || []).find(c => COLRX[k].test(c.id || '') || COLRX[k].test(c.label || '')) || null;
  const seriesOf = (doc, col) => LV_MONTHS.map(mm => {
    if (!doc || !col) return 0;
    const i = (doc.months || []).indexOf(mm.key);
    if (i < 0) return 0;
    const row = (doc.data || {})[String(i)] || {};
    const v = Number(row[col.id]);
    return isFinite(v) ? v : 0;
  });
  const sumA = a => a.reduce((x, y) => x + (Number(y) || 0), 0);
  function liveShadows(s) {
    const L = s.live,
      demo = !!s.demo,
      out = {
        live: !demo
      };
    const shortOfId = id => L.depts && Object.keys(L.depts.info).find(sh => String(L.depts.info[sh].id) === String(id)) || id;
    if (demo) {
      Object.assign(out, {
        MONTHS7: D.MONTHS7,
        STAT_SERIES: D.STAT_SERIES,
        DEPT_SERIES: D.DEPT_SERIES,
        STATS_DEPTS: D.STATS_DEPTS,
        DEPT_DEATHS: D.DEPT_DEATHS,
        DEPT_ALOS: D.DEPT_ALOS,
        INCIDENTS: D.INCIDENTS,
        MED_REQUESTS: D.MED_REQUESTS,
        SUP_REPORTS: D.SUP_REPORTS,
        ROSTERS: D.ROSTERS,
        APPRAISALS: D.APPRAISALS,
        STAFF_ROWS: D.STAFF_ROWS,
        COMPLIANCE: D.COMPLIANCE,
        CAPA_LIST: D.CAPA_LIST,
        SAVED_REPORTS: D.SAVED_REPORTS,
        LEAVE: D.LEAVE,
        REPORTS_Q: D.REPORTS_Q,
        IND_CATALOG: D.IND_CATALOG,
        MEDS_ADMIN: D.MEDS_ADMIN,
        RAGD: null,
        qTiles: null,
        breachSeries: [14, 12, 13, 10, 11, 9, 9],
        hhSeries: [81, 83, 84, 86, 85, 87, 88],
        movers: null,
        dcAnalytics: null,
        perfStats: null,
        cycles: null,
        bands: null,
        supWeek: null,
        rosterMonth: 'October 2026',
        deptFields: d => (D.FORM_FIELDS[d] || D.FORM_FIELDS.LDR).map((f, i) => ({
          label: f,
          sub: 'Entered 1 Sep · approved',
          value: '—'
        })),
        deptId: d => d.toLowerCase().replace(/\s/g, ''),
        online: null,
        hospital: {
          name: 'Hands of Care Hospitals',
          app: 'UNICO Admin',
          version: '2.1.0'
        }
      });
      return out;
    }
    const docs = L.deptsRaw || [],
      depts = L.depts ? L.depts.list : [];
    const docOf = sh => {
      const info = L.depts && L.depts.info[sh];
      return docs.find(d => info && String(d.id || d._id) === String(info.id)) || null;
    };
    out.MONTHS7 = LV_MONTHS.map(m => m.label);
    const Z = () => LV_MONTHS.map(() => 0);
    const S = {
      adm: Z(),
      dis: Z(),
      deaths: Z(),
      pdays: Z(),
      occ: Z(),
      er: Z(),
      surg: Z(),
      deliveries: Z(),
      alos: Z()
    };
    let occN = 0;
    out.DEPT_SERIES = {};
    out.STATS_DEPTS = {};
    out.DEPT_DEATHS = {};
    out.DEPT_ALOS = {};
    depts.forEach(sh => {
      const doc = docOf(sh);
      const c = k => colFind(doc && doc.cols, k);
      const adm = seriesOf(doc, c('adm') || c('er') || doc && doc.cols && doc.cols[0]),
        dis = seriesOf(doc, c('dis')),
        deaths = seriesOf(doc, c('deaths')),
        pdays = seriesOf(doc, c('pdays')),
        occ = c('occ') ? seriesOf(doc, c('occ')) : null,
        er = seriesOf(doc, c('er')),
        surg = seriesOf(doc, c('surg')),
        del = seriesOf(doc, c('nvd')).map((v, i) => v + seriesOf(doc, c('cs'))[i]);
      out.DEPT_SERIES[sh] = adm;
      out.STATS_DEPTS[sh] = [adm[5], occ ? Math.round(occ[5]) : 0];
      out.DEPT_DEATHS[sh] = deaths[5];
      out.DEPT_ALOS[sh] = dis[5] ? Math.round(pdays[5] / dis[5] * 10) / 10 : 0;
      LV_MONTHS.forEach((_, i) => {
        S.adm[i] += adm[i];
        S.dis[i] += dis[i];
        S.deaths[i] += deaths[i];
        S.pdays[i] += pdays[i];
        S.er[i] += er[i];
        S.surg[i] += surg[i];
        S.deliveries[i] += del[i];
        if (occ) S.occ[i] += occ[i];
      });
      if (occ) occN++;
    });
    S.occ = S.occ.map(v => occN ? Math.round(v / occN) : 0);
    S.alos = S.pdays.map((p, i) => S.dis[i] ? Math.round(p / S.dis[i] * 10) / 10 : 0);
    out.STAT_SERIES = S;
    out.deptFields = sh => {
      const doc = docOf(sh);
      if (!doc) return [];
      const i = (doc.months || []).indexOf(LV_MONTH_KEY(5));
      const row = i >= 0 ? (doc.data || {})[String(i)] || {} : {};
      return (doc.cols || []).map(c => ({
        label: c.label || c.id,
        sub: i >= 0 ? LV_MONTHS[5].label + ' ' + LV_MONTHS[5].y : 'No figures for ' + LV_MONTHS[5].label,
        value: row[c.id] != null ? String(row[c.id]) + (c.pct ? '%' : '') : '—'
      }));
    };
    out.deptId = sh => {
      const info = L.depts && L.depts.info[sh];
      return info ? info.id : sh;
    };
    const areas = L.quality || [];
    const RAGD = {};
    let tot = 0,
      red = 0,
      amber = 0,
      green = 0;
    const catalog = {};
    const breach = Z();
    const hh = Z(),
      hhN = Z();
    areas.forEach(a => {
      const sh = shortOfId(a.deptId) || a.key;
      const acc = RAGD[sh] || [0, 0, 0];
      (a.indicators || []).forEach(ind => {
        catalog[ind.name] = catalog[ind.name] || [ind.name, ind.numLabel && ind.denLabel ? '(' + ind.numLabel + ' ÷ ' + ind.denLabel + ')' + (ind.formula === 'pct' ? ' × 100' : /1000/.test(ind.formula || '') ? ' × 1000' : '') : ind.formula || '', ind.benchmark || '—', true];
        const mv = ind.months || {};
        const keys = Object.keys(mv).sort();
        const latestK = keys.slice().reverse().find(k => {
          const x = mv[k];
          return (x && typeof x === 'object' ? x.value : x) != null;
        });
        if (!latestK) return;
        const v = Number(typeof mv[latestK] === 'object' ? mv[latestK].value : mv[latestK]);
        const b = ind.benchmarkValue != null ? Number(ind.benchmarkValue) : null;
        tot++;
        if (b == null || !isFinite(v)) {
          acc[0]++;
          green++;
          return;
        }
        const ok = ind.goalDirection === 'higher_is_better' ? v >= b : v <= b;
        const near = ind.goalDirection === 'higher_is_better' ? v >= b * 0.9 : v <= b * 1.5 + 0.5;
        if (ok) {
          acc[0]++;
          green++;
        } else if (near) {
          acc[1]++;
          amber++;
        } else {
          acc[2]++;
          red++;
        }
        LV_MONTHS.forEach((mm, i) => {
          const x = mv[mm.key];
          const vv = x == null ? null : Number(typeof x === 'object' ? x.value : x);
          if (vv == null || !isFinite(vv)) return;
          const bad = ind.goalDirection === 'higher_is_better' ? vv < b : vv > b;
          if (bad) breach[i]++;
          if (/hand hygiene/i.test(ind.name)) {
            hh[i] += vv;
            hhN[i]++;
          }
        });
      });
      RAGD[sh] = acc;
    });
    out.RAGD = RAGD;
    out.qTiles = {
      total: tot,
      breaches: red,
      onTarget: tot ? Math.round(green / tot * 100) : 0,
      depts: Object.keys(RAGD).length,
      amber
    };
    out.breachSeries = breach;
    out.hhSeries = hh.map((v, i) => hhN[i] ? Math.round(v / hhN[i]) : 0);
    out.IND_CATALOG = Object.values(catalog);
    out.movers = null;
    out.INCIDENTS = (L.incidents || []).map(x => [x.ref, x.deptName || shortOfId(x.dept) || '—', x.type, x.severity, x.description, x.status || 'Open', x.id]);
    out.MED_REQUESTS = (L.medReqs || []).map(x => [x.name + (x.strength ? ' ' + x.strength : ''), (x.deptName || '—') + ' · ' + (x.by && x.by.name || '—'), (x.reason || '') + (x.note ? ' — ' + x.note : ''), x.status === 'Approved' ? 'approved' : x.status === 'Declined' ? 'returned' : 'pending', x.id]);
    out.SUP_REPORTS = (L.shiftReports || []).map(x => {
      const c = x.counts || {};
      return [fmtIsoD(x.date), x.shift, x.by && x.by.name || '—', x.deptName || shortOfId(x.dept), (c.adm || 0) + ' adm · ' + (c.dis || 0) + ' dis · ' + (c.deaths || 0) + ' death' + (c.deaths === 1 ? '' : 's') + ' · ' + ((c.falls || 0) + (c.mederr || 0) + (c.needle || 0) + (c.code || 0)) + ' events', x.status === 'Approved' ? 'approved' : x.status === 'Returned' ? 'returned' : 'pending', x.id, x.date];
    });
    const wk = Date.now() - 7 * 86400e3;
    const week = (L.shiftReports || []).filter(x => (x.createdAt || 0) >= wk);
    out.supWeek = {
      reports: week.length,
      adm: sumA(week.map(x => (x.counts || {}).adm)),
      events: sumA(week.map(x => {
        const c = x.counts || {};
        return (c.falls || 0) + (c.mederr || 0) + (c.needle || 0) + (c.code || 0);
      })),
      codes: sumA(week.map(x => (x.counts || {}).code)),
      byDay: [6, 5, 4, 3, 2, 1, 0].map(k => {
        const d = new Date();
        d.setDate(d.getDate() - k);
        const iso = d.toISOString().slice(0, 10);
        return {
          label: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()],
          v: sumA(week.filter(x => x.date === iso).map(x => (x.counts || {}).adm))
        };
      })
    };
    const ros = L.rosters || [];
    const latest = ros.reduce((a, r) => !a || r.year > a.year || r.year === a.year && r.month > a.month ? r : a, null);
    out.rosterMonth = latest ? MONTHS_LONG[latest.month] + ' ' + latest.year : MONTHS_LONG[(MO + 1) % 12] + ' ' + (MO === 11 ? YR + 1 : YR);
    out.ROSTERS = ros.map(r => [r.deptName || r.dept, MONTHS_LONG[r.month] + ' ' + r.year, r.preparedBy || r.createdBy || '—', (r.order || []).length + ' staff' + (r.revision ? ' · rev ' + r.revision : ''), r.status === 'approved' ? 'approved' : r.status === 'submitted' ? 'submitted' : 'draft', {
      dept: r.dept,
      year: r.year,
      month: r.month
    }]);
    const perf = L.perf || {};
    const aps = perf.appraisals || [];
    const scoreOf = a => {
      const t = a.tally || a.totals || {};
      const tot5 = a.total != null ? a.total : t.total;
      return tot5 != null ? Math.round(tot5 / 20 * 10) / 10 : null;
    };
    out.APPRAISALS = aps.filter(a => a.status !== 'actioned').map(a => [a.staffName || a.name || a.empId, shortOfId(a.department || a.dept) || '—', scoreOf(a) != null ? String(scoreOf(a)) : '—', a.assessorName || '—', a.id]);
    const done = aps.filter(a => a.status === 'actioned').length;
    const scored = aps.map(scoreOf).filter(v => v != null);
    out.perfStats = {
      done,
      total: aps.length,
      avg: scored.length ? Math.round(scored.reduce((x, y) => x + y, 0) / scored.length * 10) / 10 : null
    };
    const cyc = {};
    aps.forEach(a => {
      const k = a.cycleLabel || a.cycleId || '—';
      (cyc[k] = cyc[k] || {
        n: 0,
        done: 0
      }).n++;
      if (a.status === 'actioned') cyc[k].done++;
    });
    out.cycles = Object.keys(cyc).map(k => [k, cyc[k].done + ' / ' + cyc[k].n + ' completed', cyc[k].n ? Math.round(cyc[k].done / cyc[k].n * 100) : 0, cyc[k].done === cyc[k].n ? '#1d8f57' : '#0072a3', cyc[k].done === cyc[k].n ? 'closed' : 'open']);
    const bandsDef = [['<2.5', v => v < 2.5], ['2.5–3', v => v >= 2.5 && v < 3], ['3–3.5', v => v >= 3 && v < 3.5], ['3.5–4', v => v >= 3.5 && v < 4], ['4–4.5', v => v >= 4 && v < 4.5], ['4.5+', v => v >= 4.5]];
    out.bands = bandsDef.map(([l, fn]) => [l, scored.filter(fn).length]);
    const staff = (L.staffRaw || []).filter(p => !p.former && p.is_active !== false);
    out.STAFF_ROWS = staff.map(p => [p.name, p.designation || '—', String(p.current_department || '—').split(',')[0].trim(), p.role === 'PCA' ? 'PCA' : 'Nurse', p.emp_id || '—']);
    out.COMPLIANCE = staff.flatMap(p => {
      const o = [];
      if (p.hepatitis_b_vaccination && !/complete/i.test(p.hepatitis_b_vaccination)) o.push([p.name, 'Hepatitis B vaccination: ' + p.hepatitis_b_vaccination, '—', '#b8650a']);
      if (!p.emp_id) o.push([p.name, 'Employee ID missing on the register', '—', '#7d8ea8']);
      if (!p.phone) o.push([p.name, 'Phone number missing', '—', '#7d8ea8']);
      return o;
    }).slice(0, 60);
    const subs = L.subsRaw || [];
    out.CAPA_LIST = subs.filter(x => x.capa && String(x.capa).trim()).map(x => [x.areaName || x.area || '—', x.indicatorName || 'Indicator', String(x.capa), x.submittedBy || '—', x.month || '', 'open']);
    const rev = subs.filter(x => x.status === 'approved' || x.status === 'rejected');
    const appr = rev.filter(x => x.status === 'approved').length;
    const turn = rev.filter(x => x.reviewedAt && x.submittedAt).map(x => (x.reviewedAt - x.submittedAt) / 86400e3);
    const byCol = {};
    subs.forEach(x => {
      const k = x.submittedBy || '—';
      byCol[k] = byCol[k] || {
        n: k,
        d: x.areaName || x.departmentName || '',
        ok: 0,
        rej: 0
      };
      if (x.status === 'approved') byCol[k].ok++;
      if (x.status === 'rejected') byCol[k].rej++;
    });
    out.dcAnalytics = {
      accuracy: rev.length ? Math.round(appr / rev.length * 100) : null,
      turnaround: turn.length ? Math.round(turn.reduce((a, b) => a + b, 0) / turn.length * 10) / 10 : null,
      perMonth: LV_MONTHS.map(mm => subs.filter(x => x.month === mm.key).length),
      collectors: Object.values(byCol).filter(c => c.ok + c.rej > 0).sort((a, b) => b.ok + b.rej - (a.ok + a.rej)).slice(0, 8)
    };
    out.SAVED_REPORTS = [];
    out.MEDS_ADMIN = [];
    const dn = r => r.deptName || shortOfId(r.dept) || '—';
    out.LEAVE = (L.requests || []).filter(r => r.status === 'pending').map(r => ({
      id: r.id,
      src: 'request',
      live: true,
      dept: dn(r),
      by: r.by && r.by.name || '—',
      label: r.type === 'leave' ? (r.leaveType || 'Casual') + ' leave' : 'Shift swap ' + (r.code || ''),
      kind: r.type === 'leave' ? 'Leave' : 'Swap',
      vals: [['Date', fmtIsoD(r.date)], ...(r.withName ? [['With', r.withName]] : []), ['Reason', r.reason || '—']],
      value: null,
      bench: '',
      ok: true,
      when: fmtWhen(r.createdAt),
      note: r.reason || ''
    }));
    out.REPORTS_Q = (L.shiftReports || []).filter(r => r.status === 'Submitted').map(r => {
      const c = r.counts || {};
      return {
        id: r.id,
        src: 'shift',
        live: true,
        dept: dn(r),
        by: r.by && r.by.name || '—',
        label: r.shift + ' shift · ' + fmtIsoD(r.date),
        kind: 'Shift report',
        vals: [['Admissions', c.adm || 0], ['Deliveries', (c.nvd || 0) + (c.cs || 0)], ['Events', (c.falls || 0) + (c.mederr || 0) + (c.needle || 0) + (c.code || 0)], ['Nurses', (c.actual || 0) + ' of ' + (c.planned || 0)]],
        value: null,
        bench: '',
        ok: !((c.falls || 0) + (c.mederr || 0) + (c.needle || 0) + (c.code || 0)),
        when: fmtWhen(r.createdAt),
        note: [(r.notes || {}).obs, (r.notes || {}).issues].filter(Boolean).join(' · ')
      };
    });
    out.online = L.online;
    out.hospital = L.settings && L.settings.hospital || s.branding || {
      name: '—',
      app: 'UNICO Admin',
      version: '—'
    };
    return out;
  }
  const liveShort = name => {
    const n = String(name || '');
    if (n.length <= 8) return n;
    const w = n.split(/\s+/).filter(Boolean);
    return w.length > 1 ? w.map(x => x[0]).join('').toUpperCase().slice(0, 6) : n.slice(0, 7);
  };
  const LEVELS = ['none', 'view', 'edit', 'add', 'delete'];
  function permsFromLevels(p) {
    const out = {};
    MODULES.forEach(([k]) => {
      const v = p && p[k];
      out[k] = Array.isArray(v) ? v : lvl(Math.max(0, LEVELS.indexOf(String(v || 'none'))));
    });
    return out;
  }
  function levelsFromPerms(p) {
    const out = {};
    MODULES.forEach(([k]) => {
      const a = p && p[k] || [];
      out[k] = a.includes('delete') ? 'delete' : a.includes('add') ? 'add' : a.includes('edit') ? 'edit' : a.includes('view') ? 'view' : 'none';
    });
    return out;
  }
  function liveUser(u, roles, deptMap) {
    const legacy = u.role || 'User';
    let roleId = legacy === 'Administrator' ? 'Administrator' : legacy === 'incharge' ? 'incharge' : legacy === 'collector' ? 'collector' : null;
    if (!roleId) {
      const t = String(u.roleTemplate || u.title || '');
      const hit = roles.find(r => r.kind === 'console' && (r.id === t || r.label.toLowerCase() === t.toLowerCase()));
      roleId = hit ? hit.id : u.perms ? 'Manager' : 'Manager';
    }
    return {
      username: u.username,
      name: u.name || u.username,
      role: legacy,
      roleId,
      title: u.title || roleId,
      active: u.active !== false,
      emp: u.staffEmpId || '—',
      depts: (u.departments || []).map(id => deptMap[id] || id),
      scope: u.staffScope || (legacy === 'Administrator' ? 'all' : 'departments'),
      perms: legacy === 'User' ? permsFromLevels(u.perms || {}) : {},
      online: false,
      lastLogin: u.lastLogin ? fmtWhen(u.lastLogin) : '—',
      created: u.createdAt ? fmtWhen(u.createdAt) : '—',
      twofa: false,
      sessions: 0,
      email: u.email || null,
      live: true
    };
  }
  function fmtWhen(t) {
    if (!t) return '';
    const d = new Date(t);
    if (isNaN(d)) return String(t);
    const M3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const same = d.toDateString() === now.toDateString();
    const hm = d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0');
    return same ? 'Today ' + hm : d.getDate() + ' ' + M3[d.getMonth()] + ' ' + hm;
  }
  const ACTION_COLOR = {
    login: '#0090ca',
    logout: '#7d8ea8',
    login_failed: '#b32e2e',
    submission_approved: '#1d8f57',
    submission_rejected: '#b32e2e',
    submission_created: '#6a52d4',
    user_created: '#0090ca',
    user_updated: '#b8650a',
    session_revoked: '#b8650a',
    backup_restore: '#3c4858',
    notice_published: '#6a52d4',
    bnmc_verify: '#1e8a7c',
    photo_upload: '#3c4858',
    photo_delete: '#b8650a'
  };
  function liveLog(e) {
    const a = String(e.action || 'event');
    return {
      ts: e.ts || 0,
      who: e.name || e.username || 'System',
      text: a.replace(/_/g, ' ') + (e.target ? ' · ' + e.target : '') + (e.detail ? ' — ' + e.detail : ''),
      when: fmtWhen(e.ts),
      ip: e.ip || '—',
      action: a,
      c: ACTION_COLOR[a] || '#3c4858'
    };
  }
  function liveQueue(x) {
    const id = x.id || x._id;
    if (!id) return null;
    const when = fmtWhen(x.createdAt),
      by = x.submittedBy || x.createdByName || x.createdBy || '—';
    if (x.type === 'patient') {
      const vals = Object.entries(x.values || {}).slice(0, 4).map(([k, v]) => [k, v]);
      return {
        id,
        live: true,
        month: x.month,
        dept: x.department && x.department.name || x.departmentName || '—',
        by,
        label: 'Patient statistics',
        kind: 'Statistics',
        vals,
        value: null,
        bench: '',
        ok: true,
        when,
        note: x.note || x.remark || ''
      };
    }
    const bv = x.benchmarkValue,
      v = x.value,
      dir = x.goalDirection || 'lower_is_better';
    const ok = bv == null || v == null ? true : dir === 'higher_is_better' ? v >= bv : v <= bv;
    return {
      id,
      live: true,
      month: x.month,
      dept: x.areaName || x.area || '—',
      by,
      label: x.indicatorName || 'Quality indicator',
      kind: 'Quality',
      vals: [[x.numLabel || 'Numerator', x.num], [x.denLabel || 'Denominator', x.den]],
      value: v == null ? null : String(v) + (x.unit === '%' ? '%' : ''),
      bench: x.benchmark || '',
      ok,
      when,
      note: x.remark || x.note || '',
      corr: !!x.isCorrection
    };
  }
  const PREG = {
    A: 'safe',
    B: 'safe',
    C: 'caution',
    D: 'avoid',
    X: 'avoid'
  };
  function liveMed(b) {
    const price = b.price && (b.price.unit || b.price.raw) ? '৳ ' + (b.price.unit != null ? Number(b.price.unit).toFixed(2) : b.price.raw) + (b.price.unitLabel ? ' / ' + b.price.unitLabel : '') : '';
    return {
      id: b.id || b._id,
      live: true,
      brand: b.name || '',
      strength: b.strength || '',
      generic: b.generic || '',
      route: b.form || '',
      mfr: b.manufacturer || '',
      price,
      cls: b.drugClass || '',
      cat: b.drugClass || 'Other',
      img: b.hasImage ? '/api/med/image/' + encodeURIComponent(b.id || b._id) : '',
      alert: !!b.highAlert,
      nursing: '',
      facts: {
        max: '—',
        food: 'any',
        preg: PREG[String(b.pregnancyCategory || '').trim()[0]] || 'caution'
      },
      sec: {}
    };
  }
  mount(AdminApp, View.CSS);
})();
})();
