/* UNICO — Access Control (route view 'users', permission module 'users').

   The sidebar destination for who can sign in and what each person may do. Access is set
   PERSON BY PERSON: there are no roles, templates or tiers. An account is
     · Full access  — the Administrator role: every module, every action;
     · Custom access — a 'User' holding exactly the actions ticked for it;
     · a portal login (collector / in-charge / nurse / PCA), scoped in Data Collection.

   Screens: People (the directory + bulk actions), a person's page (their details, account
   actions and the shared editor), the Permission Matrix (everyone × every module) and
   Indicator Access (Data Collection's matrix, embedded).

   The editor itself is UserModal in reports.jsx — ONE save path for both the dialog and
   this page — reached through window.UserModal / window.UNICO_USERS_KIT. The server
   (server/users-admin.js) is the only authority: every button here just calls it. */

const AC_SHORT={stats:'OV',quality:'QL',supervisor:'SR',medicine:'MX',datacol:'DC',reports:'RP',staff:'ST',perf:'PF',roster:'RO',users:'AC',datasubmit:'DS',staffapp:'SA'};
const AC_ACT_LETTER={view:'V',edit:'E',add:'A',delete:'D',print:'P'};
const acKit=()=>window.UNICO_USERS_KIT||null;

// full | custom | none | portal — what kind of access an account has, in one word.
function acAccessType(u){
  const K=acKit();
  if(u.role==='Administrator') return 'full';
  if(K.PORTAL_ROLE_LABEL[u.role]) return 'portal';
  const p=u.perms||{};
  return K.USER_MODS.some(([k])=>K.asActions(p[k]).length)?'custom':'none';
}
// A module's actions for this account ([] = none). Administrators hold everything.
function acActs(u,mod){
  const K=acKit();
  if(u.role==='Administrator') return K.PERM_ORDER.slice();
  if(K.PORTAL_ROLE_LABEL[u.role]) return [];
  return K.asActions((u.perms||{})[mod]);
}
// Collapse a module's actions to one shade for the compact strip.
function acShade(acts){
  if(!acts.length) return 'none';
  if(acts.indexOf('delete')>=0) return 'full';
  if(acts.indexOf('edit')>=0||acts.indexOf('add')>=0) return 'edit';
  return 'view';
}
const AC_SHADE={
  none:{background:'var(--panel-2)',border:'1px dashed var(--line)',color:'transparent'},
  view:{background:'var(--blue-50)',border:'1px solid var(--blue-100)',color:'var(--blue-700)'},
  edit:{background:'#a9d2f2',border:'1px solid #8cc1ea',color:'#0b3f6e'},
  full:{background:'var(--blue)',border:'1px solid var(--blue)',color:'#fff'},
};
const AC_TYPE={
  full:{label:'Full access',bg:'#eeeafb',fg:'#4b2fa8'},
  custom:{label:'Custom access',bg:'var(--blue-50)',fg:'var(--blue-700)'},
  none:{label:'No access yet',bg:'#fbf1dc',fg:'#7a5000'},
  portal:{label:'Old portal login',bg:'#fbf1dc',fg:'#7a5000'},
};
function acAgo(ts){
  if(!ts) return '';
  const d=Date.now()-ts;
  if(d<60e3) return 'Just now';
  if(d<3600e3) return Math.round(d/60e3)+' min ago';
  if(d<86400e3) return Math.round(d/3600e3)+' h ago';
  if(d<2*86400e3) return 'Yesterday';
  if(d<30*86400e3) return Math.round(d/86400e3)+' days ago';
  try{ return new Date(ts).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'}); }catch(e){ return ''; }
}
const acDate=(ts)=>{ if(!ts) return '—'; try{ return new Date(ts).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'}); }catch(e){ return '—'; } };

function AcAvatar({u,size}){
  const K=acKit(); const s=size||38;
  // Their own account photo, else the photo on THEIR staff record (matched on the server,
  // name-checked — never a bare employee number, which the register has had swapped).
  const sm=u.staffMatch||null;
  const photo=(u.photo&&u.photo.url)||(sm&&sm.photo)||null;
  if(window.MK&&window.MK.Av) return <window.MK.Av name={u.name} photo={photo} empId={sm?sm.empId:null} size={s} radius={Math.round(s/3.4)} style={{fontSize:Math.round(s/2.7)}}/>;
  return <div className="avatar" style={{background:K.uAvatarColor(u.username),width:s,height:s}}>{K.inits(u.name)}</div>;
}
function AcTypeChip({t}){ const c=AC_TYPE[t]; return <span className="tag" style={{background:c.bg,color:c.fg,fontWeight:700}}>{c.label}</span>; }
function AcStrip({u}){
  const K=acKit();
  return (
    <div style={{display:'flex',gap:3}}>
      {K.USER_MODS.map(([k,label])=>{ const acts=acActs(u,k); const sh=acShade(acts); return (
        <span key={k} title={label+': '+(acts.length?acts.join(', '):'no access')}
          style={{width:20,height:20,borderRadius:5,display:'grid',placeItems:'center',fontSize:9.5,fontWeight:800,boxSizing:'border-box',...AC_SHADE[sh]}}>
          {sh==='none'?'':sh==='full'?'F':sh==='edit'?'E':'V'}
        </span>
      );})}
    </div>
  );
}
function AcKpi({label,value,sub,tone}){
  const warn=tone==='warn';
  return (
    <div className="card" style={warn?{background:'#fff8ea',borderColor:'#f1d9a6'}:null}>
      <div className="card-b" style={{display:'flex',flexDirection:'column',gap:2,padding:'14px 16px'}}>
        <span style={{fontSize:10.5,fontWeight:700,letterSpacing:.6,textTransform:'uppercase',color:warn?'#7a5000':'var(--muted)'}}>{label}</span>
        <span className="num" style={{fontSize:26,fontWeight:800,color:warn?'#7a5000':'var(--ink)'}}>{value}</span>
        <span style={{fontSize:11.5,fontWeight:600,color:warn?'#7a5000':'var(--muted)'}}>{sub}</span>
      </div>
    </div>
  );
}

/* ================= A person's page ================= */
function AcPerson({u,all,lastSeen,depts,designation,me,onBack,reload,admins}){
  const K=acKit();
  const [busy,setBusy]=React.useState('');
  const t=acAccessType(u);
  const isMe=me&&u.username===me;
  const lastAdmin=u.role==='Administrator'&&u.active!==false&&admins<=1;
  const Editor=window.UserModal;
  const run=async(key,fn,msg)=>{ setBusy(key); try{ await fn(); K.uToast(msg); reload(); }catch(e){ K.uToast(e.message||'Failed','error'); } finally{ setBusy(''); } };
  const signOut=()=>run('out',()=>K.usersApi('POST','/api/users/'+encodeURIComponent(u.username)+'/signout'),'Signed out of every device');
  const toggle=()=>run('act',()=>K.usersApi('PATCH','/api/users/'+encodeURIComponent(u.username),{active:u.active===false}),u.active===false?'Account activated':'Account deactivated');
  const del=async()=>{
    const ok=window.UI&&window.UI.confirm?await window.UI.confirm({title:'Delete '+(u.name||u.username)+'?',message:'Permanently deletes the account “@'+u.username+'” and ends every session it has. This cannot be undone.',danger:true,confirmLabel:'Delete account'}):window.confirm('Delete this account?');
    if(!ok) return;
    setBusy('del');
    try{ await K.usersApi('DELETE','/api/users/'+encodeURIComponent(u.username)); K.uToast('Account deleted'); onBack(); reload(); }
    catch(e){ K.uToast(e.message||'Failed','error'); }
    finally{ setBusy(''); }
  };
  const row=(l,v)=>(<div style={{display:'flex',justifyContent:'space-between',gap:12,fontSize:12}}><span style={{color:'var(--muted)',fontWeight:600}}>{l}</span><span style={{fontWeight:700,textAlign:'right',color:'var(--ink)'}}>{v}</span></div>);
  const act=(key,icon,label,onClick,opts)=>(
    <button type="button" onClick={onClick} disabled={!!busy||(opts&&opts.disabled)} title={opts&&opts.title}
      style={{display:'flex',alignItems:'center',gap:11,minHeight:42,padding:'0 12px',border:0,borderRadius:9,background:'transparent',font:'inherit',fontSize:13,fontWeight:700,cursor:'pointer',textAlign:'left',width:'100%',color:(opts&&opts.color)||'var(--ink)',opacity:(opts&&opts.disabled)?.45:1}}>
      <Ic d={icon} s={16}/>{busy===key?'Working…':label}
    </button>
  );
  const granted=K.USER_MODS.map(([k,l])=>[l,acActs(u,k)]).filter(([,a])=>a.length);
  const seen=lastSeen[u.username];
  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{display:'flex',alignItems:'center',gap:10}}>
        <button className="btn sm" onClick={onBack}><span style={{display:'grid',placeItems:'center',transform:'rotate(180deg)'}}><Ic d={I.chevR} s={14}/></span>People</button>
        <span style={{fontSize:12,fontWeight:600,color:'var(--muted)'}}>Access Control / People / {u.name||u.username}</span>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'minmax(260px,320px) minmax(0,1fr)',gap:16,alignItems:'start'}} className="ac-person">
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <div className="card"><div className="card-b" style={{display:'flex',flexDirection:'column',gap:14}}>
            <div style={{display:'flex',gap:14,alignItems:'center'}}>
              <AcAvatar u={u} size={60}/>
              <div style={{minWidth:0}}>
                <div style={{fontSize:18,fontWeight:800,color:'var(--ink)'}}>{u.name||u.username}{isMe&&<span className="tag" style={{marginLeft:8,background:'var(--pos-bg)',color:'var(--pos)'}}>You</span>}</div>
                <div style={{fontSize:12,color:'var(--muted)',fontFamily:'var(--mono, monospace)'}}>@{u.username}</div>
              </div>
            </div>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              <AcTypeChip t={t}/>
              {t==='portal'&&<span className="tag">{K.PORTAL_ROLE_LABEL[u.role]}</span>}
              {designation&&<span className="tag">{designation}</span>}
              {u.active!==false?<span className="chip pos">● Active</span>:<span className="chip flat">○ Inactive</span>}
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:10,borderTop:'1px solid var(--line-2)',paddingTop:12}}>
              {row('Email',u.email||'—')}
              {row('Staff record',u.staffMatch?((u.staffMatch.empId?'Emp '+u.staffMatch.empId:'#'+u.staffMatch.id)+' · '+u.staffMatch.name):(u.staffEmpId?('Emp '+u.staffEmpId):'Not linked'))}
              {row('Last sign-in',seen?acAgo(seen):'Not recorded')}
              {row('Created',acDate(u.createdAt))}
              {row('Last changed',acDate(u.updatedAt))}
              {t!=='portal'&&row('Report sign-off',({prepare:'Prepares',check:'Checks',approve:'Approves'})[u.signoff]||'Takes no part')}
            </div>
          </div></div>

          {K.mayUsers('edit')&&<div className="card"><div className="card-b" style={{padding:8,display:'flex',flexDirection:'column'}}>
            <div style={{fontSize:10.5,fontWeight:700,letterSpacing:.6,textTransform:'uppercase',color:'var(--muted)',padding:'6px 12px'}}>Account actions</div>
            {act('out',I.arrowR,'Sign out of all devices',signOut)}
            {act('act',u.active===false?I.check:I.x,u.active===false?'Activate account':'Deactivate account',toggle,{color:'#8a5a00',disabled:isMe||lastAdmin,title:isMe?'You cannot deactivate yourself':lastAdmin?'The last active administrator':''})}
            {K.mayUsers('delete')&&act('del',I.x,'Delete account',del,{color:'var(--rose)',disabled:isMe||lastAdmin,title:isMe?'You cannot delete yourself':lastAdmin?'The last active administrator':''})}
            <div style={{fontSize:10.5,color:'var(--muted)',padding:'6px 12px 4px'}}>To reset the password, type a new one in the editor and save.</div>
          </div></div>}

          <div className="card"><div className="card-b" style={{display:'flex',flexDirection:'column',gap:8}}>
            <div style={{fontSize:10.5,fontWeight:700,letterSpacing:.6,textTransform:'uppercase',color:'var(--muted)'}}>What they can open</div>
            {t==='portal'&&<div style={{fontSize:12,color:'var(--ink-2)'}}>The portal only — its departments and indicators are set in the editor.</div>}
            {t!=='portal'&&!granted.length&&<div style={{fontSize:12,color:'var(--rose)',fontWeight:600}}>Nothing yet. They can sign in but see an empty sidebar.</div>}
            {granted.map(([l,a])=>(
              <div key={l} style={{display:'flex',alignItems:'center',gap:8,fontSize:12}}>
                <span style={{flex:1,fontWeight:600,color:'var(--ink-2)'}}>{l}</span>
                <span style={{display:'flex',gap:2}}>{K.PERM_ORDER.map(x=><span key={x} style={{width:16,height:18,borderRadius:4,display:'grid',placeItems:'center',fontSize:9.5,fontWeight:800,fontFamily:'var(--mono, monospace)',
                  background:a.indexOf(x)>=0?(x==='delete'?'var(--rose)':'var(--blue)'):'var(--panel-2)',color:a.indexOf(x)>=0?'#fff':'var(--faint)'}}>{AC_ACT_LETTER[x]}</span>)}</span>
              </div>
            ))}
          </div></div>
        </div>

        <div style={{minWidth:0}}>
          {Editor
            ? <Editor key={u.username+':'+(u.updatedAt||'')} inline initial={u} depts={depts} allUsers={all} onClose={onBack} onSaved={reload}/>
            : <div className="card"><div className="card-b" style={{color:'var(--muted)'}}>Loading the editor…</div></div>}
        </div>
      </div>
    </div>
  );
}

/* ================= Permission matrix ================= */
function AcMatrix({users,openPerson}){
  const K=acKit();
  const [mod,setMod]=React.useState('staff');
  const [hideFull,setHideFull]=React.useState(false);
  const rows=users.filter(u=>acAccessType(u)!=='portal'&&(!hideFull||u.role!=='Administrator'));
  const modLabel=(K.USER_MODS.find(m=>m[0]===mod)||[])[1]||mod;
  const holders=K.PERM_ORDER.map(a=>[a,rows.filter(u=>acActs(u,mod).indexOf(a)>=0)]);
  const cols='minmax(170px,1.2fr) repeat('+K.USER_MODS.length+', minmax(58px,1fr))';
  return (
    <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) 300px',gap:14,alignItems:'start'}} className="ac-matrix">
      <div className="card" style={{overflow:'auto'}}>
        <div style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',borderBottom:'1px solid var(--line-2)',flexWrap:'wrap'}}>
          <div style={{fontSize:14,fontWeight:700,flex:1}}>Everyone × every module</div>
          <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12,fontWeight:600,color:'var(--ink-2)'}}><input type="checkbox" checked={hideFull} onChange={e=>setHideFull(e.target.checked)}/>Hide full-access people</label>
          <span style={{display:'flex',gap:8,fontSize:11,fontWeight:700,color:'var(--muted)'}}>{K.PERM_ORDER.map(a=><span key={a}>{AC_ACT_LETTER[a]} = {a}</span>)}</span>
        </div>
        <div style={{minWidth:900}}>
          <div style={{display:'grid',gridTemplateColumns:cols,gap:4,padding:'10px 16px',background:'var(--panel-2)',borderBottom:'1px solid var(--line-2)',alignItems:'end'}}>
            <span style={{fontSize:10.5,fontWeight:700,textTransform:'uppercase',letterSpacing:.5,color:'var(--muted)'}}>Person</span>
            {K.USER_MODS.map(([k,l])=>{ const on=k===mod; return (
              <button key={k} type="button" onClick={()=>setMod(k)} title={'Who holds '+l}
                style={{border:0,borderRadius:7,padding:'5px 2px',font:'inherit',fontSize:10,fontWeight:800,letterSpacing:.3,textTransform:'uppercase',cursor:'pointer',background:on?'var(--blue)':'transparent',color:on?'#fff':'var(--muted)',lineHeight:1.25}}>{l.split(' ')[0]}</button>
            );})}
          </div>
          {rows.map(u=>(
            <div key={u.username} style={{display:'grid',gridTemplateColumns:cols,gap:4,padding:'6px 16px',borderBottom:'1px solid var(--line-2)',alignItems:'center'}}>
              <button type="button" onClick={()=>openPerson(u.username)} style={{border:0,background:'transparent',font:'inherit',textAlign:'left',cursor:'pointer',padding:0,minWidth:0}}>
                <div style={{fontSize:12.5,fontWeight:700,color:'var(--ink)'}}>{u.name||u.username}</div>
                <div style={{fontSize:10.5,color:'var(--muted)'}}>{AC_TYPE[acAccessType(u)].label}</div>
              </button>
              {K.USER_MODS.map(([k])=>{ const a=acActs(u,k); return (
                <div key={k} title={a.length?a.join(', '):'no access'} style={{display:'flex',gap:1,justifyContent:'center',alignItems:'center',height:32,borderRadius:7,
                  background:k===mod?'var(--blue-50)':(a.length?'#f7fbff':'transparent'),border:a.length?'1px solid var(--blue-100)':'1px dashed var(--line)'}}>
                  {a.map(x=><span key={x} style={{width:11,height:16,borderRadius:3,display:'grid',placeItems:'center',fontSize:8.5,fontWeight:800,fontFamily:'var(--mono, monospace)',background:x==='delete'?'var(--rose)':'var(--blue)',color:'#fff'}}>{AC_ACT_LETTER[x]}</span>)}
                </div>
              );})}
            </div>
          ))}
          <div style={{display:'grid',gridTemplateColumns:cols,gap:4,padding:'9px 16px',background:'var(--panel-2)',alignItems:'center'}}>
            <span style={{fontSize:10.5,fontWeight:700,textTransform:'uppercase',letterSpacing:.5,color:'var(--muted)'}}>Can delete</span>
            {K.USER_MODS.map(([k])=>{ const n=rows.filter(u=>acActs(u,k).indexOf('delete')>=0).length; return <span key={k} className="num" style={{textAlign:'center',fontSize:12.5,fontWeight:800,color:n?'var(--rose)':'var(--muted)'}}>{n}</span>; })}
          </div>
        </div>
      </div>
      <div className="card"><div className="card-b" style={{display:'flex',flexDirection:'column',gap:12}}>
        <div><div style={{fontSize:10.5,fontWeight:700,letterSpacing:.6,textTransform:'uppercase',color:'var(--blue-700)'}}>Module</div>
          <div style={{fontSize:16,fontWeight:800}}>{modLabel}</div>
          <div style={{fontSize:11.5,color:'var(--muted)'}}>{rows.filter(u=>acActs(u,mod).length).length} of {rows.length} accounts hold it</div></div>
        {holders.map(([a,list])=>(
          <div key={a} style={{borderTop:'1px solid var(--line-2)',paddingTop:10}}>
            <div style={{display:'flex',fontSize:12.5,fontWeight:800,marginBottom:6,color:a==='delete'?'var(--rose)':'var(--ink)'}}><span style={{flex:1,textTransform:'capitalize'}}>{a}</span><span className="num">{list.length}</span></div>
            <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
              {list.map(u=><button key={u.username} type="button" className="tag" onClick={()=>openPerson(u.username)} style={{cursor:'pointer',border:0,font:'inherit',fontSize:11.5}}>{u.name||u.username}</button>)}
              {!list.length&&<span style={{fontSize:11.5,color:'var(--faint)'}}>Nobody</span>}
            </div>
          </div>
        ))}
      </div></div>
    </div>
  );
}

/* ================= The module ================= */
function AccessControl({depts,setRoute}){
  const {useState,useEffect,useMemo}=React;
  const K=acKit();
  const [tab,setTab]=useState(()=>{ const t=window.__UNICO_ACCESS_TAB__; try{ delete window.__UNICO_ACCESS_TAB__; }catch(e){} return t==='indicators'||t==='matrix'?t:'people'; });
  const [users,setUsers]=useState(null);
  const [lastSeen,setLastSeen]=useState({});
  const [seenOk,setSeenOk]=useState(false);
  const [err,setErr]=useState('');
  const [person,setPerson]=useState(null);
  const [adding,setAdding]=useState(false);
  const [q,setQ]=useState('');
  const [filter,setFilter]=useState('all');
  const [sel,setSel]=useState([]);
  const [bulkMod,setBulkMod]=useState('');
  const [bulkBusy,setBulkBusy]=useState(false);
  const [,setTick]=useState(0);
  const me=(window.__UNICO_USER__&&window.__UNICO_USER__.username)||null;

  const load=()=>{
    if(!K) return;
    setErr('');
    K.usersApi('GET','/api/users').then(j=>setUsers(j.users||[])).catch(e=>{ setUsers([]); setErr(e.message||'Could not load users.'); });
    K.usersApi('GET','/api/users/last-seen').then(j=>{ setLastSeen(j.lastSeen||{}); setSeenOk(!j.degraded); }).catch(()=>{ setLastSeen({}); setSeenOk(false); });
  };
  useEffect(load,[]);   // eslint-disable-line react-hooks/exhaustive-deps
  // Indicator Access is Data Collection's matrix: pull that chunk in when the tab opens.
  useEffect(()=>{
    const h=()=>setTick(x=>x+1);
    window.addEventListener('unico:chunk-loaded',h);
    return ()=>window.removeEventListener('unico:chunk-loaded',h);
  },[]);
  // The account editor's Data Submission scope picker (DcScopeEditor) and Indicator Access
  // both live in the data-collection chunk: pull it in with this screen.
  useEffect(()=>{ if(!window.DcScopeEditor&&window.unicoLoadChunk) window.unicoLoadChunk('datacollection').catch(()=>{}); },[]);

  // Designation comes from the linked staff record (the login is named after the emp id,
  // or carries it in staffEmpId). A label only — it never grants anything.
  const staffByEmp=useMemo(()=>{
    const src=window.STAFF_SEED||window.__UNICO_STAFF__||[]; const m={};
    (Array.isArray(src)?src:[]).forEach(e=>{ const k=String(e.emp_id||'').trim().toLowerCase(); if(k) m[k]=e; });
    return m;
  },[users]);
  const designationOf=u=>{ const r=staffByEmp[String(u.staffEmpId||u.username||'').trim().toLowerCase()]; return (r&&String(r.designation||'').trim())||''; };

  if(!K) return <div className="card"><div className="card-b" style={{color:'var(--muted)'}}>Loading Access Control…</div></div>;

  const all=users||[];
  const admins=all.filter(u=>u.role==='Administrator'&&u.active!==false).length;
  const typeOf=u=>acAccessType(u);
  const active=all.filter(u=>u.active!==false);
  const cnt=(t)=>active.filter(u=>typeOf(u)===t).length;
  const week=Date.now()-7*86400e3;
  const signedWeek=active.filter(u=>(lastSeen[u.username]||0)>=week).length;
  const noAccess=active.filter(u=>typeOf(u)==='none');
  const canDeleteStaff=active.filter(u=>u.role!=='Administrator'&&acActs(u,'staff').indexOf('delete')>=0);
  const neverSeen=seenOk?active.filter(u=>!lastSeen[u.username]):[];
  const legacy=all.filter(u=>typeOf(u)==='portal');
  const attention=noAccess.length+canDeleteStaff.length+legacy.filter(u=>u.active!==false).length;
  /* Retire the portal logins: preview what changes, then convert (server/users-admin.js
     /api/users/convert-portal). Each becomes a normal account; its role becomes a module. */
  const convertAll=async()=>{
    try{
      const pre=await K.usersApi('POST','/api/users/convert-portal',{});
      if(!pre.count){ K.uToast('No old portal logins left'); load(); return; }
      const by=(f)=>pre.accounts.filter(a=>a.from===f).length;
      const lines=[['collector','→ Data Submission'],['incharge','→ Data Submission + runs a unit'],['nurse','→ Staff app (nurse)'],['pca','→ Staff app (PCA)']]
        .filter(([f])=>by(f)).map(([f,t])=>by(f)+' '+f+(by(f)===1?'':'s')+' '+t).join(' · ');
      const ok=window.UI&&window.UI.confirm
        ?await window.UI.confirm({title:'Convert '+pre.count+' old portal login'+(pre.count===1?'':'s')+'?',message:lines+'. Their departments, areas, indicators and matrix records are kept. Each person is signed out once and signs back in to the main app.',confirmLabel:'Convert all'})
        :window.confirm('Convert '+pre.count+' portal logins?');
      if(!ok) return;
      const r=await K.usersApi('POST','/api/users/convert-portal',{apply:true});
      K.uToast(r.converted+' converted'+(r.failed&&r.failed.length?' · '+r.failed.length+' failed':''),r.failed&&r.failed.length?'warn':'success');
      load();
    }catch(e){ K.uToast(e.message||'Failed','error'); }
  };

  const mayAdd=K.mayUsers('add'), mayEdit=K.mayUsers('edit');
  const qn=q.trim().toLowerCase();
  const shown=all.filter(u=>{
    if(filter==='inactive'){ if(u.active!==false) return false; }
    else { if(u.active===false&&filter!=='all') return false; if(filter!=='all'&&typeOf(u)!==filter) return false; }
    if(!qn) return true;
    return (u.name+' '+u.username+' '+(u.email||'')+' '+designationOf(u)+' '+(u.staffEmpId||'')).toLowerCase().indexOf(qn)>=0;
  });

  const current=person?all.find(u=>u.username===person):null;
  if(person&&current){
    return <AcPerson u={current} all={all} lastSeen={lastSeen} depts={depts} designation={designationOf(current)} me={me} admins={admins}
      onBack={()=>setPerson(null)} reload={load}/>;
  }

  /* ---- bulk actions: each is the same per-account API call the person page makes ---- */
  const selUsers=all.filter(u=>sel.indexOf(u.username)>=0);
  const toggleSel=(un)=>setSel(s=>s.indexOf(un)>=0?s.filter(x=>x!==un):[...s,un]);
  const allShownSel=shown.length>0&&shown.every(u=>sel.indexOf(u.username)>=0);
  const selectAllShown=()=>setSel(allShownSel?[]:shown.map(u=>u.username));
  const bulk=async(label,fn,filterFn)=>{
    const targets=selUsers.filter(filterFn||(()=>true));
    if(!targets.length){ K.uToast('Nothing to change for the selected people','warn'); return; }
    setBulkBusy(true); let ok=0, fail=0;
    for(const u of targets){ try{ await fn(u); ok++; }catch(e){ fail++; } }
    setBulkBusy(false);
    K.uToast(label+': '+ok+' updated'+(fail?', '+fail+' failed':''),fail?'warn':'success');
    load();
  };
  const permsWith=(u,mod,acts)=>{ const p={}; K.USER_MODS.forEach(([k])=>{ p[k]=K.asActions((u.perms||{})[k]); }); p[mod]=acts; return p; };
  const onlyCustom=u=>u.role==='User';
  const grantView=()=>bulkMod&&bulk('View given',u=>{ const cur=K.asActions((u.perms||{})[bulkMod]); return K.usersApi('PATCH','/api/users/'+encodeURIComponent(u.username),{perms:permsWith(u,bulkMod,cur.length?cur:['view'])}); },onlyCustom);
  const revoke=()=>bulkMod&&bulk('Module removed',u=>K.usersApi('PATCH','/api/users/'+encodeURIComponent(u.username),{perms:permsWith(u,bulkMod,[])}),onlyCustom);
  const signOutAll=()=>bulk('Signed out',u=>K.usersApi('POST','/api/users/'+encodeURIComponent(u.username)+'/signout'));
  const deactivate=async()=>{
    const ok=window.UI&&window.UI.confirm?await window.UI.confirm({title:'Deactivate '+selUsers.length+' account'+(selUsers.length===1?'':'s')+'?',message:'They are signed out and cannot sign in until reactivated. Your own account is skipped.',danger:true,confirmLabel:'Deactivate'}):true;
    if(ok) bulk('Deactivated',u=>K.usersApi('PATCH','/api/users/'+encodeURIComponent(u.username),{active:false}),u=>u.username!==me&&u.active!==false);
  };

  const FILTERS=[['all','All'],['full','Full access'],['custom','Custom'],['portal','Portal'],['none','No access'],['inactive','Inactive']];
  const TABS=[['people','People',I.user],['matrix','Permission Matrix',I.grid],['indicators','Indicator Access',I.check]];
  const COLS='28px minmax(220px,1.6fr) minmax(150px,1fr) minmax(140px,1fr) 280px 110px 150px';
  const DR=window.DataResponsibles;

  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{display:'flex',alignItems:'flex-end',gap:12,flexWrap:'wrap'}}>
        <div style={{flex:1,minWidth:240}}>
          <div style={{fontSize:22,fontWeight:800,color:'var(--ink)',letterSpacing:-.3}}>Access Control</div>
          <div style={{fontSize:12.5,color:'var(--muted)',maxWidth:640}}>Who can sign in, what they can open and what they can change — set person by person. No roles, no tiers: each account holds exactly what is ticked for it.</div>
        </div>
        <button className="btn sm" onClick={load}><Ic d={I.search} s={14}/>Refresh</button>
        {mayAdd&&<button className="btn pri sm" onClick={()=>setAdding(true)}><Ic d={I.plus} s={14}/>Add user</button>}
      </div>

      <div className="seg" style={{alignSelf:'flex-start'}}>
        {TABS.map(([id,l,ic])=><button key={id} className={tab===id?'on':''} onClick={()=>setTab(id)} style={{display:'inline-flex',alignItems:'center',gap:6}}><Ic d={ic} s={13}/>{l}{id==='people'&&users?<span className="num" style={{opacity:.7}}>{all.length}</span>:null}</button>)}
      </div>

      {err&&<div style={{fontSize:12.5,color:'#b32339',background:'var(--neg-bg)',border:'1px solid var(--line)',borderRadius:9,padding:'11px 13px'}}>{err}</div>}

      {tab==='matrix'&&(users===null?<div className="card"><div className="card-b" style={{color:'var(--faint)'}}>Loading…</div></div>:<AcMatrix users={all.filter(u=>u.active!==false)} openPerson={setPerson}/>)}

      {tab==='indicators'&&(DR?<DR key="access" depts={depts} embedded initialView="access"/>:<div className="card"><div className="card-b" style={{color:'var(--muted)'}}>Loading Indicator Access…</div></div>)}

      {tab==='people'&&(
      <React.Fragment>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:10}}>
          <AcKpi label="Accounts" value={all.length} sub={active.length+' active · '+(all.length-active.length)+' inactive'}/>
          <AcKpi label="Full access" value={cnt('full')} sub="Every module, every action"/>
          <AcKpi label="Custom access" value={cnt('custom')} sub="Set person by person"/>
          <AcKpi label="Data Submission" value={active.filter(u=>acActs(u,'datasubmit').length||u.role==='collector'||u.role==='incharge').length} sub="People who report their unit's data"/>
          <AcKpi label="Signed in · 7 days" value={seenOk?signedWeek:'—'} sub={seenOk?'of '+active.length+' active':'Sign-in log unavailable'}/>
          <AcKpi label="Needs attention" value={attention} sub="See the cards below" tone={attention?'warn':null}/>
        </div>

        {(legacy.length>0||noAccess.length>0||canDeleteStaff.length>0||neverSeen.length>0)&&(
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:10}}>
            {legacy.length>0&&<div className="card" style={{borderColor:'#f1d9a6'}}><div className="card-b" style={{display:'flex',gap:12,alignItems:'center'}}>
              <div style={{width:34,height:34,borderRadius:10,background:'#fbf1dc',color:'#8a5a00',display:'grid',placeItems:'center',flexShrink:0}}><Ic d={I.user} s={16}/></div>
              <div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:800}}>{legacy.length} old portal login{legacy.length===1?'':'s'}</div><div style={{fontSize:11.5,color:'var(--muted)'}}>Convert to normal accounts with Data Submission / Staff app</div></div>
              {mayEdit&&<button className="btn pri sm" onClick={convertAll}>Convert all</button>}
            </div></div>}
            {noAccess.length>0&&<div className="card"><div className="card-b" style={{display:'flex',gap:12,alignItems:'center'}}>
              <div style={{width:34,height:34,borderRadius:10,background:'var(--neg-bg)',color:'var(--rose)',display:'grid',placeItems:'center',flexShrink:0}}><Ic d={I.x} s={16}/></div>
              <div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:800}}>{noAccess.length} can sign in but have no modules</div><div style={{fontSize:11.5,color:'var(--muted)'}}>{noAccess.slice(0,3).map(u=>u.name).join(', ')}{noAccess.length>3?' …':''}</div></div>
              <button className="btn sm" onClick={()=>setFilter('none')}>Show</button>
            </div></div>}
            {canDeleteStaff.length>0&&<div className="card"><div className="card-b" style={{display:'flex',gap:12,alignItems:'center'}}>
              <div style={{width:34,height:34,borderRadius:10,background:'#fbf1dc',color:'#8a5a00',display:'grid',placeItems:'center',flexShrink:0}}><Ic d={I.steth} s={16}/></div>
              <div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:800}}>{canDeleteStaff.length} can delete staff records</div><div style={{fontSize:11.5,color:'var(--muted)'}}>Check each one still needs it</div></div>
              <button className="btn sm" onClick={()=>setTab('matrix')}>Review</button>
            </div></div>}
            {neverSeen.length>0&&<div className="card"><div className="card-b" style={{display:'flex',gap:12,alignItems:'center'}}>
              <div style={{width:34,height:34,borderRadius:10,background:'var(--blue-50)',color:'var(--blue)',display:'grid',placeItems:'center',flexShrink:0}}><Ic d={I.bell} s={16}/></div>
              <div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:800}}>{neverSeen.length} no sign-in on record</div><div style={{fontSize:11.5,color:'var(--muted)'}}>In the activity log's window</div></div>
            </div></div>}
          </div>
        )}

        <div className="card" style={{overflow:'hidden'}}>
          <div style={{display:'flex',alignItems:'center',gap:10,padding:'12px 16px',borderBottom:'1px solid var(--line-2)',flexWrap:'wrap'}}>
            <div style={{display:'flex',alignItems:'center',gap:7,background:'var(--panel-2)',border:'1px solid var(--line)',borderRadius:8,padding:'7px 10px',width:280,maxWidth:'100%',color:'var(--faint)'}}>
              <Ic d={I.search} s={14}/><input aria-label="Search people" placeholder="Name, username, email, emp ID" value={q} onChange={e=>setQ(e.target.value)} style={{border:0,background:'transparent',outline:'none',fontFamily:'inherit',fontSize:12.5,color:'var(--ink)',width:'100%'}}/>
            </div>
            <span style={{flex:1}}/>
            <div className="seg">{FILTERS.map(([id,l])=><button key={id} className={filter===id?'on':''} onClick={()=>setFilter(id)}>{l}</button>)}</div>
          </div>

          {mayEdit&&sel.length>0&&(
            <div style={{display:'flex',alignItems:'center',gap:8,padding:'9px 16px',background:'#0c1a31',color:'#fff',flexWrap:'wrap'}}>
              <span style={{fontSize:13,fontWeight:800,marginRight:6}}>{sel.length} selected</span>
              <select value={bulkMod} onChange={e=>setBulkMod(e.target.value)} aria-label="Module for bulk change"
                style={{padding:'6px 8px',borderRadius:7,border:'1px solid #2b4a75',background:'#16294a',color:'#fff',fontFamily:'inherit',fontSize:12}}>
                <option value="">Choose a module…</option>
                {/* Data Submission needs a per-person scope, the staff app is a phone login and Access
                    Control lists every account — none of them is a sensible one-click bulk grant. */}
                {K.USER_MODS.filter(([k])=>['datasubmit','staffapp','users'].indexOf(k)<0).map(([k,l])=><option key={k} value={k}>{l}</option>)}
              </select>
              <button className="btn sm" disabled={!bulkMod||bulkBusy} onClick={grantView}>Give view</button>
              <button className="btn sm" disabled={!bulkMod||bulkBusy} onClick={revoke}>Remove module</button>
              <span style={{width:1,height:22,background:'#2b4a75'}}/>
              <button className="btn sm" disabled={bulkBusy} onClick={signOutAll}>Sign out everywhere</button>
              <button className="btn sm" disabled={bulkBusy} onClick={deactivate}>Deactivate</button>
              <span style={{flex:1}}/>
              <span style={{fontSize:11,color:'#b8c6da'}}>Module changes apply to custom-access people only.</span>
              <button className="btn sm" onClick={()=>setSel([])} aria-label="Clear selection"><Ic d={I.x} s={13}/></button>
            </div>
          )}

          <div style={{overflowX:'auto'}}>
            <div style={{minWidth:1130}}>
              <div style={{display:'grid',gridTemplateColumns:COLS,alignItems:'center',gap:10,padding:'9px 16px',background:'var(--panel-2)',borderBottom:'1px solid var(--line-2)'}}>
                <input type="checkbox" aria-label="Select all shown" checked={allShownSel} onChange={selectAllShown} disabled={!mayEdit}/>
                {['Person','Access','Scope'].map(h=><span key={h} style={{fontSize:10.5,fontWeight:700,textTransform:'uppercase',letterSpacing:.5,color:'var(--muted)'}}>{h}</span>)}
                <div style={{display:'flex',gap:3}}>{K.USER_MODS.map(([k,l])=><span key={k} title={l} style={{width:20,textAlign:'center',fontSize:8.5,fontWeight:800,color:'var(--muted)'}}>{AC_SHORT[k]}</span>)}</div>
                <span style={{fontSize:10.5,fontWeight:700,textTransform:'uppercase',letterSpacing:.5,color:'var(--muted)'}}>Last sign-in</span>
                <span/>
              </div>
              {users===null&&<div style={{textAlign:'center',color:'var(--faint)',padding:24,fontSize:13}}>Loading…</div>}
              {users!==null&&shown.map(u=>{
                const t=typeOf(u); const isMe=me&&u.username===me; const seen=lastSeen[u.username];
                const nLim=Object.keys(u.qualityIndicators||{}).reduce((s,k)=>s+((u.qualityIndicators[k]||[]).length),0);
                const staffScope=u.role==='Administrator'?'Everything'
                  :(u.role==='nurse'||u.role==='pca')?'Staff app · own record'
                  :(t==='portal'||acActs(u,'datasubmit').length)
                  ? ((u.departments||[]).length+' dept · '+(u.allQualityAreas?'all areas':(u.qualityAreas||[]).length+' area'+((u.qualityAreas||[]).length===1?'':'s'))+(nLim?' · '+nLim+' indicators limited':''))
                  : (u.staffScope==='self'?'Staff: own record':u.staffScope==='departments'?'Staff: '+(u.departments||[]).length+' dept':'Staff: all');
                return (
                  <div key={u.username} style={{display:'grid',gridTemplateColumns:COLS,alignItems:'center',gap:10,padding:'10px 16px',borderBottom:'1px solid var(--line-2)',background:sel.indexOf(u.username)>=0?'#f4f9fe':'transparent',opacity:u.active===false?.6:1}}>
                    <input type="checkbox" aria-label={'Select '+(u.name||u.username)} checked={sel.indexOf(u.username)>=0} onChange={()=>toggleSel(u.username)} disabled={!mayEdit}/>
                    <div style={{display:'flex',alignItems:'center',gap:11,minWidth:0}}>
                      <AcAvatar u={u} size={36}/>
                      <div style={{minWidth:0}}>
                        <div style={{display:'flex',alignItems:'center',gap:6}}>
                          <button type="button" onClick={()=>setPerson(u.username)} style={{border:0,background:'transparent',padding:0,font:'inherit',fontSize:13.5,fontWeight:800,color:'var(--ink)',cursor:'pointer',textAlign:'left'}}>{u.name||u.username}</button>
                          {isMe&&<span className="tag" style={{background:'var(--pos-bg)',color:'var(--pos)'}}>You</span>}
                        </div>
                        <div style={{fontSize:11.5,color:'var(--muted)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>@{u.username}{designationOf(u)?' · '+designationOf(u):''}</div>
                      </div>
                    </div>
                    <div style={{display:'flex',flexDirection:'column',gap:3,alignItems:'flex-start'}}>
                      <AcTypeChip t={t}/>
                      <span style={{fontSize:11,color:'var(--ink-2)',fontWeight:600}}>{t==='full'?'All modules · all actions':t==='portal'?K.PORTAL_ROLE_LABEL[u.role]:K.permSummary(u.perms)}</span>
                    </div>
                    <span style={{fontSize:11.5,color:'var(--ink-2)',fontWeight:600}}>{staffScope}</span>
                    <AcStrip u={u}/>
                    <span style={{fontSize:12,fontWeight:700,color:seen?'var(--ink)':'var(--muted)'}}>{seen?acAgo(seen):(seenOk?'Not recorded':'—')}</span>
                    <div style={{display:'flex',alignItems:'center',gap:6,justifyContent:'flex-end'}}>
                      {u.active!==false?<span className="chip pos">● Active</span>:<span className="chip flat">○ Inactive</span>}
                      {mayEdit&&<button className="btn sm" onClick={()=>setPerson(u.username)}>Manage</button>}
                    </div>
                  </div>
                );
              })}
              {users!==null&&!shown.length&&<div style={{textAlign:'center',color:'var(--faint)',padding:24,fontSize:13}}>No people {q?'match the search':'in this view'}.</div>}
            </div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:14,padding:'10px 16px',background:'var(--panel-2)',flexWrap:'wrap',fontSize:11,fontWeight:700,color:'var(--ink-2)'}}>
            <span>Showing {shown.length} of {all.length}</span>
            {[['none','None'],['view','View'],['edit','Edit / add'],['full','Full incl. delete']].map(([k,l])=>(
              <span key={k} style={{display:'flex',alignItems:'center',gap:5}}><span style={{width:14,height:14,borderRadius:4,boxSizing:'border-box',...AC_SHADE[k]}}/>{l}</span>
            ))}
          </div>
        </div>
      </React.Fragment>
      )}

      {adding&&window.UserModal&&<window.UserModal initial={null} depts={depts} allUsers={all} onClose={()=>setAdding(false)} onSaved={()=>{ setAdding(false); load(); }}/>}
    </div>
  );
}
window.AccessControl=AccessControl;
