/* UNICO — Workforce module: shared bits, dashboard, directory, compliance */

const VACC_TONE={"Completed":"pos","Vaccinated":"pos","3 dose":"pos","2 dose":"warn","1 dose":"warn","Not Completed":"neg","Unknown":"flat"};
function vaccColor(s){const t=VACC_TONE[s]||"flat";return t==='pos'?'#1f9d57':t==='warn'?'#e08a1e':t==='neg'?'#d23a52':'#8a93a3';}
function VaccBadge({status}){
  const c=vaccColor(status); return <span style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:11,fontWeight:600,padding:'2px 9px',borderRadius:20,color:c,background:c+'1c'}}><i style={{width:6,height:6,borderRadius:'50%',background:c}}/>{status||'Unknown'}</span>;
}
function Avatar({name,size=34,fontSize}){
  const parts=(name||'?').split(' '); const ini=(parts[0][0]||'')+(parts.length>1?parts[parts.length-1][0]:'');
  let h=0; for(const ch of name||'') h=(h*31+ch.charCodeAt(0))%360;
  return <div style={{width:size,height:size,borderRadius:'50%',flexShrink:0,display:'grid',placeItems:'center',
    fontSize:fontSize||size*0.4,fontWeight:700,color:'#fff',background:`linear-gradient(135deg,hsl(${h} 60% 52%),hsl(${(h+40)%360} 62% 42%))`}}>{ini.toUpperCase()}</div>;
}
function RoleBadge({role}){
  const pca=role==='PCA'; const c=pca?'#6a52d4':'#0090ca';
  return <span style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:10.5,fontWeight:700,padding:'2px 8px',borderRadius:5,color:c,background:c+'16',letterSpacing:.3}}>{role||'Nurse'}</span>;
}

/* ---------------- Export (Excel / Word / CSV / Print) ---------------- */
const STAFF_EXPORT_COLS=[['Emp ID','emp_id'],['Name','name'],['Role','role'],['Designation','designation'],['Department','current_department'],['Qualification','qualification'],['DOJ','doj'],['Experience','total_experience_text'],['Special Training','special_training'],['Hep-B Vaccination','hepatitis_b_vaccination'],['Phone','phone'],['Remarks','remarks']];
function esc(v){return ((v==null?'':v)+'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function downloadBlob(content,filename,mime){
  const blob=new Blob([content],{type:mime}); const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click();
  setTimeout(()=>{document.body.removeChild(a);URL.revokeObjectURL(url);},600);
}
function staffTableHTML(rows){
  const th=STAFF_EXPORT_COLS.map(c=>`<th style="background:#0090ca;color:#fff;border:1px solid #2b6f9c;padding:6px 8px;font-family:Calibri,Arial,sans-serif;text-align:left;font-size:11pt">${c[0]}</th>`).join('');
  const trs=rows.map((e,i)=>`<tr style="background:${i%2?'#eef6fb':'#ffffff'}">${STAFF_EXPORT_COLS.map(c=>`<td style="border:1px solid #b9c6d2;padding:5px 8px;font-family:Calibri,Arial,sans-serif;font-size:10.5pt">${esc(e[c[1]])}</td>`).join('')}</tr>`).join('');
  return `<table border="1" style="border-collapse:collapse"><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`;
}
function exportStaff(rows,role,fmt){
  const date=new Date().toISOString().slice(0,10);
  const title=`UNICO Hospitals — ${role} Roster`;
  const base=`UNICO-${role}-roster-${date}`;
  if(fmt==='csv'){
    const head=STAFF_EXPORT_COLS.map(c=>`"${c[0]}"`).join(',');
    const body=rows.map(e=>STAFF_EXPORT_COLS.map(c=>`"${((e[c[1]]==null?'':e[c[1]])+'').replace(/"/g,'""')}"`).join(',')).join('\r\n');
    downloadBlob('\uFEFF'+head+'\r\n'+body,base+'.csv','text/csv;charset=utf-8');
  } else if(fmt==='excel'){
    const html=`<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>${role}</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body><h3 style="font-family:Calibri">${title} — ${rows.length} ${role}(s)</h3>${staffTableHTML(rows)}</body></html>`;
    downloadBlob(html,base+'.xls','application/vnd.ms-excel');
  } else if(fmt==='word'){
    const html=`<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${title}</title><style>@page{size:A4 landscape;margin:1.2cm}</style></head><body><h2 style="font-family:Calibri;color:#0072a3;margin-bottom:2px">${title}</h2><p style="font-family:Calibri;color:#555;margin-top:0">Generated ${date} · ${rows.length} ${role}(s)</p>${staffTableHTML(rows)}</body></html>`;
    downloadBlob(html,base+'.doc','application/msword');
  } else if(fmt==='pdf'){
    // Render the roster into the shared #pdf-root and reuse the pdf-export-mode
    // print path (captures only #pdf-root) for a clean PDF via Electron.
    const root=document.getElementById('pdf-root');
    const native=window.unicoNative;
    if(!root||!native||typeof native.exportPDF!=='function'){ try{document.body.classList.add('pdf-export-mode');window.print();}catch(e){} finally{setTimeout(()=>document.body.classList.remove('pdf-export-mode'),500);} return; }
    root.innerHTML=`<div class="pdf-page" style="padding:10mm 11mm;font-family:'IBM Plex Sans',Arial,sans-serif;color:#16202e"><h2 style="color:#0072a3;margin:0 0 2px;font-size:18px">${title}</h2><div style="color:#8a93a3;font-size:10.5px;margin-bottom:10px">Generated ${date} · ${rows.length} ${role}(s) · Confidential</div>${staffTableHTML(rows)}</div>`;
    document.body.classList.add('pdf-export-mode');
    Promise.resolve(native.exportPDF({pageSize:'A4',landscape:true,defaultName:base})).catch(()=>{}).then(()=>{ root.innerHTML=''; document.body.classList.remove('pdf-export-mode'); });
  }
}
function ExportMenu({rows,role}){
  const [open,setOpen]=React.useState(false);
  return (
    <div style={{position:'relative'}}>
      <button className="btn sm" onClick={()=>setOpen(o=>!o)}><Ic d={I.download} s={14}/>Export ▾</button>
      {open&&(
        <div onMouseLeave={()=>setOpen(false)} style={{position:'absolute',right:0,top:'112%',zIndex:60,background:'#fff',border:'1px solid var(--line)',borderRadius:9,boxShadow:'var(--shadow-pop)',minWidth:172,overflow:'hidden',padding:4}}>
          <div style={{fontSize:10,color:'var(--faint)',textTransform:'uppercase',letterSpacing:.4,padding:'6px 9px 3px',fontWeight:700}}>Export {rows.length} {role}(s)</div>
          {[['pdf','PDF document (.pdf)',I.doc],['excel','Microsoft Excel (.xls)',I.grid],['word','Microsoft Word (.doc)',I.doc],['csv','CSV (.csv)',I.doc]].map(([f,l,ic])=>(
            <div key={f} onClick={()=>{exportStaff(rows,role,f);setOpen(false);}} style={{padding:'8px 10px',fontSize:12.5,cursor:'pointer',display:'flex',gap:9,alignItems:'center',borderRadius:6,color:'var(--ink-2)',fontWeight:500}}
              onMouseEnter={e=>e.currentTarget.style.background='var(--blue-50)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}><Ic d={ic} s={15} c="var(--blue)"/>{l}</div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- Workforce Dashboard (NEMS-style) ---------------- */
function WorkforceDashboard({store, setRoute, role='Nurse'}){
  const S=window.STAFF;
  const list=store.staff.filter(e=>(e.role||'Nurse')===role);
  const [welcome,setWelcome]=React.useState(true);
  const tone=role==='PCA'?'#6a52d4':'#0090ca';
  const listView=role==='PCA'?'pca':'nurses';
  const compView=role==='PCA'?'pcaCompliance':'nurseCompliance';
  const homeView=role==='PCA'?'pcaHome':'nurseHome';
  const k=S.kpis(list);
  const byDept=S.countBy(list,'current_department').slice(0,13).map(([label,value])=>({label,value,color:'#0090ca',color2:'#27a8db'}));
  const desigAll=S.countBy(list,'designation');
  const desigTop=desigAll.slice(0,6), desigOther=desigAll.slice(6).reduce((s,d)=>s+d[1],0);
  const desigDonut=[...desigTop.map(([label,value],i)=>({label,value,color:PALETTE[i%PALETTE.length]})),...(desigOther?[{label:'Other',value:desigOther,color:'#c2486f'}]:[])];
  const vacc=S.vaccinationBreakdown(list).map(([label,value])=>({label,value,color:vaccColor(label)}));
  const exp=S.experienceBuckets(list).map(([label,value])=>({label,value}));
  const recent=S.recentJoiners(list,6);
  const annv=S.anniversaries(list,60);
  const comp=S.compliance(list);
  const compIssues=comp.missing_vaccination.length+comp.missing_training.length+comp.missing_phone.length;

  const Kpi=({label,val,foot,color})=>(
    <div className="card anim-pop" style={{padding:'17px 20px',borderLeft:`4px solid ${color}`,display:'flex',flexDirection:'column',minHeight:128}}>
      <div style={{fontSize:13,fontWeight:700,color:'var(--ink-2)'}}>{label}</div>
      <div className="num" style={{fontSize:38,fontWeight:700,color,margin:'12px 0 8px',lineHeight:1}}>{val}</div>
      <div style={{fontSize:11.5,color:'var(--muted)',marginTop:'auto'}}>{foot}</div>
    </div>
  );
  return (
    <div className="grid" style={{gap:16}}>
      <SectionTitle icon={role==='PCA'?I.bed:I.steth} title={`${role==='PCA'?'PCA':'Nurse'} Dashboard`} sub={`Live overview of the ${role} roster`}
        right={<><button className="btn sm" onClick={()=>setRoute({view:listView})}><Ic d={I.layers} s={15}/>Directory</button>
          <button className="btn sm" onClick={()=>setRoute({view:compView})}><Ic d={I.heart} s={15}/>Compliance</button>
          <button className="btn pri sm" style={{background:tone,borderColor:tone}} onClick={()=>setRoute({view:homeView})}><Ic d={I.activity} s={15}/>Refresh</button></>}/>
      {welcome&&(
        <div className="card" style={{background:'var(--blue-50)',border:'1px solid var(--blue-100)',padding:'14px 16px',display:'flex',alignItems:'flex-start',gap:12}}>
          <div style={{color:'var(--blue)',marginTop:1}}><Ic d={I.heart} s={20}/></div>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:700,color:'var(--ink)'}}>{role} Management</div>
            <div style={{fontSize:12.5,color:'var(--ink-2)',marginTop:2}}>Manage the {role} roster, filter with the quick chips, export to Excel/Word, and use <b>Compliance</b> to close gaps.</div>
          </div>
          <button className="icon-btn" onClick={()=>setWelcome(false)}><Ic d={I.x} s={15}/></button>
        </div>
      )}
      <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))'}}>
        <Kpi label={`Total ${role==='PCA'?'PCAs':'Nurses'}`} val={fmt(k.total_staff)} foot={`active ${role} on roster`} color={tone}/>
        <Kpi label="Departments" val={fmt(k.departments)} foot="distinct units staffed" color="#6a52d4"/>
        <Kpi label="Vaccinated" val={k.vaccinated_pct+'%'} foot="Hep-B completed / vaccinated" color="#1f9d57"/>
        <Kpi label="Compliance Issues" val={fmt(compIssues)} foot={`${comp.missing_vaccination.length} vacc · ${comp.missing_training.length} training · click for details`} color="#d23a52"/>
      </div>

      <div className="grid" style={{gridTemplateColumns:'1.25fr 1fr'}}>
        <div className="card">
          <div className="card-h"><h3>Employees per Department</h3><span className="sub">top units by headcount</span><span className="spacer"/></div>
          <div className="card-b"><HBar rows={byDept}/></div>
        </div>
        <div className="card">
          <div className="card-h"><h3>Designation Breakdown</h3><span className="sub">role mix across the workforce</span><span className="spacer"/></div>
          <div className="card-b" style={{display:'grid',placeItems:'center'}}><Donut data={desigDonut} size={188} centerValue={fmt(k.total_staff)} centerLabel="staff"/></div>
        </div>
      </div>

      <div className="grid" style={{gridTemplateColumns:'1fr 1.25fr'}}>
        <div className="card">
          <div className="card-h"><h3>Hep-B Vaccination</h3><span className="spacer"/></div>
          <div className="card-b" style={{display:'grid',placeItems:'center'}}><Donut data={vacc} size={172} centerValue={k.vaccinated_pct+'%'} centerLabel="compliant"/></div>
        </div>
        <div className="card">
          <div className="card-h"><h3>Experience Distribution</h3><span className="spacer"/><span className="tag">3D</span></div>
          <div className="card-b"><Bar3D data={exp} x="label" y="value" height={240} color="#0090ca"/></div>
        </div>
      </div>

      <div className="grid" style={{gridTemplateColumns:'1fr 1fr'}}>
        <div className="card">
          <div className="card-h"><h3>Recent Joiners</h3><span className="spacer"/></div>
          <div className="card-b" style={{display:'flex',flexDirection:'column',gap:2}}>
            {recent.map(e=>(
              <div key={e.id} style={{display:'flex',alignItems:'center',gap:11,padding:'8px 4px',borderBottom:'1px solid var(--line-2)',cursor:'pointer'}} onClick={()=>setRoute({view:'staffProfile',emp:e.id})}>
                <Avatar name={e.name} size={32}/>
                <div style={{minWidth:0,flex:1}}><div style={{fontSize:13,fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{e.name}</div>
                  <div style={{fontSize:11,color:'var(--muted)'}}>{e.designation} · {e.current_department}</div></div>
                <div className="num" style={{fontSize:11.5,color:'var(--muted)'}}>{e.doj}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-h"><h3>Upcoming Anniversaries</h3><span className="sub">next 60 days</span><span className="spacer"/><span className="tag num">{annv.length}</span></div>
          <div className="card-b" style={{display:'flex',flexDirection:'column',gap:2}}>
            {annv.length===0&&<div style={{color:'var(--faint)',fontSize:12.5,padding:'14px 4px'}}>No anniversaries in the window.</div>}
            {annv.slice(0,6).map(({e,annv,years})=>(
              <div key={e.id} style={{display:'flex',alignItems:'center',gap:11,padding:'8px 4px',borderBottom:'1px solid var(--line-2)',cursor:'pointer'}} onClick={()=>setRoute({view:'staffProfile',emp:e.id})}>
                <Avatar name={e.name} size={32}/>
                <div style={{minWidth:0,flex:1}}><div style={{fontSize:13,fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{e.name}</div>
                  <div style={{fontSize:11,color:'var(--muted)'}}>{e.current_department}</div></div>
                <span className="tag" style={{background:'var(--blue-50)',color:'var(--blue-700)'}}>{years} yr{years>1?'s':''}</span>
                <div className="num" style={{fontSize:11.5,color:'var(--muted)',width:54,textAlign:'right'}}>{annv.toLocaleDateString(undefined,{month:'short',day:'numeric'})}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* compliance strip */}
      <div className="card feature" style={{padding:'14px 18px',display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}}>
        <div style={{fontSize:13.5,fontWeight:700}}>Compliance gaps</div>
        {[['Missing vaccination',comp.missing_vaccination.length,'#d23a52'],['No training recorded',comp.missing_training.length,'#e08a1e'],['No phone on file',comp.missing_phone.length,'#6a52d4']].map(([l,n,c])=>(
          <div key={l} style={{display:'flex',alignItems:'center',gap:8}}>
            <span className="num" style={{fontSize:20,fontWeight:700,color:c}}>{n}</span>
            <span style={{fontSize:12,color:'var(--muted)'}}>{l}</span>
          </div>
        ))}
        <span className="spacer"/>
        <button className="btn pri sm" onClick={()=>setRoute({view:compView})}>Review compliance<Ic d={I.arrowR} s={15}/></button>
      </div>
    </div>
  );
}

/* ---------------- Staff Directory ---------------- */
function StaffDirectory({store, setRoute, initialFilter}){
  const [q,setQ]=React.useState('');
  const [role,setRole]=React.useState(initialFilter?.role||'');
  const [dept,setDept]=React.useState(initialFilter?.dept||'');
  const [desig,setDesig]=React.useState('');
  const [vacc,setVacc]=React.useState(initialFilter?.vacc||'');
  const list=store.staff.filter(e=>e.is_active);
  const filtered=list.filter(e=>{
    if(q&&!(`${e.name} ${e.emp_id} ${e.phone||''}`.toLowerCase().includes(q.toLowerCase())))return false;
    if(role&&(e.role||'Nurse')!==role)return false;
    if(dept&&e.current_department!==dept)return false;
    if(desig&&e.designation!==desig)return false;
    if(vacc==='__ok'&&!window.STAFF.VACC_OK.includes(e.hepatitis_b_vaccination))return false;
    if(vacc==='__gap'&&!["Not Completed","Unknown","1 dose","2 dose"].includes(e.hepatitis_b_vaccination))return false;
    if(vacc&&!vacc.startsWith('__')&&e.hepatitis_b_vaccination!==vacc)return false;
    return true;
  });
  const sel={padding:'8px 11px',border:'1px solid var(--line)',borderRadius:7,fontSize:12.5,fontFamily:'inherit',background:'#fff'};
  const nurses=list.filter(e=>(e.role||'Nurse')==='Nurse').length, pcas=list.filter(e=>e.role==='PCA').length;
  return (
    <div className="grid" style={{gap:16}}>
      <SectionTitle icon={I.layers} title="Staff Directory" sub={`${filtered.length} shown · ${nurses} nurses · ${pcas} PCA`}
        right={<button className="btn pri sm" onClick={()=>setRoute({view:'staffForm'})}><Ic d={I.plus} s={15}/>Add Staff</button>}/>
      <div className="card" style={{padding:'12px 14px',display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,background:'var(--panel-2)',border:'1px solid var(--line)',borderRadius:7,padding:'7px 11px',width:240,flexShrink:0,color:'var(--faint)'}}><Ic d={I.search} s={15}/>
          <input placeholder="Search name, ID, phone…" value={q} onChange={e=>setQ(e.target.value)} style={{border:0,background:'transparent',outline:'none',fontFamily:'inherit',fontSize:12.5,color:'var(--ink)',width:'100%'}}/></div>
        <div className="seg">{[['','All'],['Nurse','Nurses'],['PCA','PCA']].map(([v,l])=>(<button key={v} className={role===v?'on':''} onClick={()=>setRole(v)}>{l}</button>))}</div>
        <select style={sel} value={dept} onChange={e=>setDept(e.target.value)}><option value="">All departments</option>{window.STAFF.DEPARTMENTS.map(d=><option key={d}>{d}</option>)}</select>
        <select style={sel} value={desig} onChange={e=>setDesig(e.target.value)}><option value="">All designations</option>{[...window.STAFF.DESIGNATIONS,...window.STAFF.PCA_DESIGNATIONS].map(d=><option key={d}>{d}</option>)}</select>
        <select style={sel} value={vacc} onChange={e=>setVacc(e.target.value)}><option value="">Any vaccination</option><option value="__ok">✓ Compliant</option><option value="__gap">⚠ Has gap</option>{window.STAFF.VACCINATION_STATES.map(d=><option key={d}>{d}</option>)}</select>
        {(q||role||dept||desig||vacc)&&<button className="btn sm" onClick={()=>{setQ('');setRole('');setDept('');setDesig('');setVacc('');}}>Clear</button>}
        <span className="spacer"/>
        <ExportMenu rows={list} role={role}/>
      </div>
      <div className="card" style={{overflow:'hidden'}}>
        <div style={{overflowX:'auto'}}>
          <table className="tbl">
            <thead><tr><th style={{textAlign:'left'}}>Staff</th><th style={{textAlign:'left'}}>Role</th><th style={{textAlign:'left'}}>Emp ID</th><th style={{textAlign:'left'}}>Designation</th><th style={{textAlign:'left'}}>Department</th><th>Experience</th><th style={{textAlign:'left'}}>Vaccination</th><th style={{textAlign:'left'}}>Phone</th><th></th></tr></thead>
            <tbody>
              {filtered.map(e=>(
                <tr key={e.id} style={{cursor:'pointer'}} onClick={()=>setRoute({view:'staffProfile',emp:e.id})}>
                  <td style={{textAlign:'left'}}><div style={{display:'flex',alignItems:'center',gap:10}}><Avatar name={e.name} size={30}/><div><div style={{fontWeight:600,color:'var(--ink)'}}>{e.name}</div><div style={{fontSize:10.5,color:'var(--faint)',fontFamily:"'IBM Plex Sans'"}}>{e.qualification||'—'}</div></div></div></td>
                  <td style={{textAlign:'left'}}><RoleBadge role={e.role}/></td>
                  <td style={{textAlign:'left'}}>{e.emp_id}</td>
                  <td style={{textAlign:'left',fontFamily:"'IBM Plex Sans'"}}>{e.designation||'—'}</td>
                  <td style={{textAlign:'left',fontFamily:"'IBM Plex Sans'"}}>{e.current_department||'—'}</td>
                  <td>{e.total_experience_text||'—'}</td>
                  <td style={{textAlign:'left'}}><VaccBadge status={e.hepatitis_b_vaccination}/></td>
                  <td style={{textAlign:'left'}}>{e.phone||<span style={{color:'var(--rose)'}}>missing</span>}</td>
                  <td><Ic d={I.chevR} s={15} c="#b6c0cc"/></td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length===0&&<div style={{textAlign:'center',color:'var(--faint)',padding:'34px',fontSize:13}}>No staff match these filters.</div>}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Compliance ---------------- */
function StaffCompliance({store, setRoute, role='Nurse'}){
  const comp=window.STAFF.compliance(store.staff.filter(e=>(e.role||'Nurse')===role));
  const card=(title,icon,tone,rows,emptyMsg,filter)=>(
    <div className="card" style={{overflow:'hidden'}}>
      <div className="card-h"><div style={{width:28,height:28,borderRadius:7,background:tone+'1a',color:tone,display:'grid',placeItems:'center'}}><Ic d={icon} s={16}/></div>
        <h3>{title}</h3><span className="spacer"/><span className="num" style={{fontSize:20,fontWeight:700,color:tone}}>{rows.length}</span></div>
      <div style={{maxHeight:300,overflowY:'auto'}}>
        {rows.length===0?<div style={{padding:'24px',textAlign:'center',color:'var(--pos)',fontSize:13}}><Ic d={I.check} s={26} c="#1f9d57"/><div style={{marginTop:6}}>{emptyMsg}</div></div>:
        rows.map(e=>(
          <div key={e.id} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 14px',borderBottom:'1px solid var(--line-2)',cursor:'pointer'}} onClick={()=>setRoute({view:'staffProfile',emp:e.id})}>
            <Avatar name={e.name} size={30}/>
            <div style={{minWidth:0,flex:1}}><div style={{fontSize:13,fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{e.name}</div>
              <div style={{fontSize:11,color:'var(--muted)'}}>{e.designation} · {e.current_department}</div></div>
            <button className="btn sm" onClick={ev=>{ev.stopPropagation();setRoute({view:'staffForm',emp:e.id});}}>Fix</button>
          </div>
        ))}
      </div>
    </div>
  );
  return (
    <div className="grid" style={{gap:16}}>
      <SectionTitle icon={I.heart} title={`${role==='PCA'?'PCA':'Nurse'} Compliance`} sub={`${role} records that need attention — click to open the profile or fix`}/>
      <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))'}}>
        {card('Missing Hep-B Vaccination',I.heart,'#d23a52',comp.missing_vaccination,'All staff vaccinated','vacc')}
        {card('No Special Training',I.activity,'#e08a1e',comp.missing_training,'All staff have training','training')}
        {card('No Phone on File',I.user,'#6a52d4',comp.missing_phone,'All staff have phone numbers','phone')}
      </div>
    </div>
  );
}

/* ---------------- Role-scoped management (Nurses / PCA, NEMS Employees style) ---------------- */
function ManageStaff({store, setRoute, role}){
  const S=window.STAFF;
  const [q,setQ]=React.useState('');
  const [chip,setChip]=React.useState('all');
  const [dept,setDept]=React.useState('');
  const [desig,setDesig]=React.useState('');
  const [vacc,setVacc]=React.useState('');
  const [qual,setQual]=React.useState('');
  const [expB,setExpB]=React.useState('');
  const [training,setTraining]=React.useState('');
  const [sortBy,setSortBy]=React.useState('name');
  const [showInactive,setShowInactive]=React.useState(false);
  const tone= role==='PCA'?'#6a52d4':'#0090ca';
  const all=store.staff.filter(e=>(e.role||'Nurse')===role);
  const active=all.filter(e=>e.is_active);
  const base=all.filter(e=>showInactive||e.is_active);
  const now=Date.now();
  const matchChip=(e)=>{
    const d=(e.current_department||'');
    switch(chip){
      case 'fav': return !!e.fav;
      case 'missing': return !S.VACC_OK.includes(e.hepatitis_b_vaccination);
      case 'icu': return /\b(icu|ccu|nicu|micu|sicu)\b/i.test(d)||/ct\s*icu/i.test(d);
      case 'emergency': return /emerg|\ber\b/i.test(d);
      case 'otcath': return /\bot\b|cath|theatre/i.test(d);
      case 'newhire': return e.doj && (now-new Date(e.doj))< 220*86400000;
      default: return true;
    }
  };
  const filtered=base.filter(e=>{
    if(!matchChip(e))return false;
    if(q&&!`${e.name} ${e.emp_id} ${e.phone||''}`.toLowerCase().includes(q.toLowerCase()))return false;
    if(dept&&e.current_department!==dept)return false;
    if(desig&&e.designation!==desig)return false;
    if(vacc==='__ok'&&!S.VACC_OK.includes(e.hepatitis_b_vaccination))return false;
    if(vacc==='__gap'&&!["Not Completed","Unknown","1 dose","2 dose"].includes(e.hepatitis_b_vaccination))return false;
    if(vacc&&!vacc.startsWith('__')&&e.hepatitis_b_vaccination!==vacc)return false;
    if(qual&&e.qualification!==qual)return false;
    if(training==='has'&&!(e.special_training&&e.special_training.trim()))return false;
    if(training==='none'&&(e.special_training&&e.special_training.trim()))return false;
    if(expB){const y=e.total_experience_years; if(y==null)return false;
      if(expB==='<1'&&!(y<1))return false; if(expB==='1-3'&&!(y>=1&&y<3))return false;
      if(expB==='3-5'&&!(y>=3&&y<5))return false; if(expB==='5-10'&&!(y>=5&&y<10))return false;
      if(expB==='10+'&&!(y>=10))return false;}
    return true;
  });
  const sorted=[...filtered].sort((a,b)=>{
    if(sortBy==='exp')return (b.total_experience_years||0)-(a.total_experience_years||0);
    if(sortBy==='doj')return (b.doj||'').localeCompare(a.doj||'');
    if(sortBy==='dept')return (a.current_department||'').localeCompare(b.current_department||'')||(a.name||'').localeCompare(b.name||'');
    return (a.name||'').localeCompare(b.name||'');
  });
  const deptOpts=S.uniqueVals(all,'current_department');
  const desigOpts=S.uniqueVals(all,'designation');
  const qualOpts=S.uniqueVals(all,'qualification');
  const sel={padding:'9px 11px',border:'1px solid var(--line)',borderRadius:8,fontSize:12.5,fontFamily:'inherit',background:'#fff'};
  const chips=[['all','All'],['fav','★ Favorites'],['missing','⚠ Missing vaccination'],['icu','ICU staff'],['emergency','Emergency / ER'],['otcath','OT / Cath Lab'],['newhire','New hire']];
  const anyFilter=q||dept||desig||vacc||qual||expB||training||chip!=='all';
  return (
    <div className="grid" style={{gap:14}}>
      <div style={{display:'flex',alignItems:'flex-end',gap:12,flexWrap:'wrap'}}>
        <div style={{flexShrink:0}}><div style={{fontSize:22,fontWeight:800,color:'var(--ink)',letterSpacing:'-.3px',whiteSpace:'nowrap'}}>{role==='PCA'?'PCA':'Nurse'} Employees</div>
          <div style={{fontSize:12,color:'var(--muted)'}}>Dedicated {role} roster{all.length>active.length?` · ${all.length-active.length} inactive hidden`:''}</div></div>
        <span className="spacer" style={{flex:1}}/>
        <button className="btn sm" onClick={()=>setShowInactive(v=>!v)}>{showInactive?'Hide inactive':'Show inactive'}</button>
        <button className="btn pri sm" style={{background:tone,borderColor:tone}} onClick={()=>setRoute({view:'staffForm',role})}><Ic d={I.plus} s={15}/>Add {role}</button>
        <span className="num" style={{fontSize:12.5,color:'var(--muted)',fontWeight:600}}>{active.length} employee(s)</span>
      </div>

      {/* quick chips */}
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        {chips.map(([id,label])=>(
          <button key={id} onClick={()=>setChip(id)} style={{padding:'7px 14px',borderRadius:8,fontSize:12.5,fontWeight:600,cursor:'pointer',
            border:'1px solid '+(chip===id?tone:'var(--line)'),background:chip===id?tone:'var(--panel-2)',color:chip===id?'#fff':'var(--ink-2)'}}>{label}</button>
        ))}
      </div>

      {/* filter bar */}
      <div className="card" style={{padding:'12px 14px',display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,background:'#fff',border:'1px solid var(--line)',borderRadius:8,padding:'8px 11px',flex:1,minWidth:200,color:'var(--faint)'}}><Ic d={I.search} s={15}/>
          <input placeholder="Search name / Emp ID / Phone" value={q} onChange={e=>setQ(e.target.value)} style={{border:0,background:'transparent',outline:'none',fontFamily:'inherit',fontSize:13,color:'var(--ink)',width:'100%'}}/></div>
        <select style={sel} value={dept} onChange={e=>setDept(e.target.value)}><option value="">All Departments</option>{deptOpts.map(d=><option key={d}>{d}</option>)}</select>
        <select style={sel} value={desig} onChange={e=>setDesig(e.target.value)}><option value="">All Designations</option>{desigOpts.map(d=><option key={d}>{d}</option>)}</select>
        <select style={sel} value={vacc} onChange={e=>setVacc(e.target.value)}><option value="">All Vaccination</option><option value="__ok">✓ Compliant</option><option value="__gap">⚠ Has gap</option>{[...new Set(all.map(e=>e.hepatitis_b_vaccination).filter(Boolean))].map(d=><option key={d}>{d}</option>)}</select>
        {qualOpts.length>0&&<select style={sel} value={qual} onChange={e=>setQual(e.target.value)}><option value="">All Qualifications</option>{qualOpts.map(d=><option key={d}>{d}</option>)}</select>}
        <select style={sel} value={expB} onChange={e=>setExpB(e.target.value)}><option value="">All Experience</option>{['<1','1-3','3-5','5-10','10+'].map(x=><option key={x} value={x}>{x} yrs</option>)}</select>
        <select style={sel} value={training} onChange={e=>setTraining(e.target.value)}><option value="">Any Training</option><option value="has">Has training</option><option value="none">No training</option></select>
        <select style={sel} value={sortBy} onChange={e=>setSortBy(e.target.value)}><option value="name">Sort: Name</option><option value="exp">Sort: Experience</option><option value="doj">Sort: Newest hire</option><option value="dept">Sort: Department</option></select>
        <button className="btn pri sm" style={{opacity:anyFilter?1:.5}} onClick={()=>{setQ('');setDept('');setDesig('');setVacc('');setQual('');setExpB('');setTraining('');setChip('all');}}>Clear filters</button>
        <ExportMenu rows={sorted} role={role}/>
      </div>

      {/* table */}
      <div className="card" style={{overflow:'hidden'}}>
        <div style={{overflowX:'auto'}}>
          <table className="tbl">
            <thead><tr><th style={{textAlign:'center',width:34}}>★</th><th style={{textAlign:'left'}}>Emp ID</th><th style={{textAlign:'left'}}>Name</th><th style={{textAlign:'left'}}>Designation</th><th style={{textAlign:'left'}}>Department</th><th>Experience</th><th style={{textAlign:'left'}}>Vaccination</th><th style={{textAlign:'left'}}>Phone</th><th style={{textAlign:'right'}}>Manage</th></tr></thead>
            <tbody>
              {sorted.map(e=>(
                <tr key={e.id} style={{opacity:e.is_active?1:.55}}>
                  <td style={{textAlign:'center'}}><span onClick={ev=>{ev.stopPropagation();store.toggleFav(e.id);}} style={{cursor:'pointer',fontSize:16,color:e.fav?'#e0a81e':'#c4ccd6'}}>{e.fav?'★':'☆'}</span></td>
                  <td style={{textAlign:'left'}}>{e.emp_id}</td>
                  <td style={{textAlign:'left',cursor:'pointer'}} onClick={()=>setRoute({view:'staffProfile',emp:e.id})}><div style={{display:'flex',alignItems:'center',gap:10}}><Avatar name={e.name} size={28}/><div><div style={{fontWeight:600,color:'var(--ink)'}}>{e.name}</div>{e.qualification&&<div style={{fontSize:10.5,color:'var(--faint)',fontFamily:"'IBM Plex Sans'"}}>{e.qualification}</div>}</div></div></td>
                  <td style={{textAlign:'left',fontFamily:"'IBM Plex Sans'"}}>{e.designation||'—'}</td>
                  <td style={{textAlign:'left',fontFamily:"'IBM Plex Sans'"}}>{e.current_department||'—'}</td>
                  <td>{e.total_experience_text||'—'}</td>
                  <td style={{textAlign:'left',fontFamily:"'IBM Plex Sans'"}}><span style={{color:vaccColor(e.hepatitis_b_vaccination),fontWeight:600}}>{e.hepatitis_b_vaccination||'Unknown'}</span></td>
                  <td style={{textAlign:'left'}}>{e.phone||<span style={{color:'var(--rose)'}}>—</span>}</td>
                  <td><div style={{display:'flex',gap:6,justifyContent:'flex-end'}}>
                    <button className="icon-btn" title="Edit" onClick={()=>setRoute({view:'staffForm',emp:e.id})}><Ic d={I.edit} s={14}/></button>
                    {e.is_active
                      ? <button className="icon-btn danger" title="Deactivate" onClick={()=>store.remove(e.id)}><Ic d={I.x} s={14}/></button>
                      : <button className="icon-btn" title="Restore" onClick={()=>store.restore(e.id)} style={{color:'var(--pos)'}}><Ic d={I.check} s={14}/></button>}
                    <button className="icon-btn" title="Delete permanently" onClick={async()=>{
                      const ok=await window.UI.confirm({title:`Permanently delete ${e.name}?`,message:'This removes the record entirely and cannot be undone. (Use Deactivate to keep the record.)',danger:true,confirmLabel:'Delete permanently'});
                      if(ok){store.destroy(e.id);window.UI.toast('Staff record deleted','success');}
                    }} style={{color:'#d23a52',background:'#d23a521a',border:'1px solid #d23a5240'}}><Ic d={I.x} s={14} sw={2.6}/></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
          {sorted.length===0&&<div style={{textAlign:'center',color:'var(--faint)',padding:'34px',fontSize:13}}>No {role} match these filters.</div>}
        </div>
      </div>
    </div>
  );
}

Object.assign(window,{ Avatar, VaccBadge, RoleBadge, vaccColor, WorkforceDashboard, StaffDirectory, StaffCompliance, ManageStaff });
