/* UNICO — Workforce module: shared bits, dashboard, directory, compliance */

const VACC_TONE={"Completed":"pos","3rd Dose":"pos","2nd Dose":"warn","1st Dose":"warn","Not Completed":"neg","Unknown":"flat"};
// Normalise any raw value (imports/typos) to a canonical state before colouring/labelling.
function vaccCanon(s){ return (window.STAFF&&window.STAFF.canonVacc)?window.STAFF.canonVacc(s):(s||'Unknown'); }
function vaccOK(s){ return ((window.STAFF&&window.STAFF.VACC_OK)||['Completed','3rd Dose']).includes(vaccCanon(s)); }
function vaccColor(s){const t=VACC_TONE[vaccCanon(s)]||"flat";return t==='pos'?'#1f9d57':t==='warn'?'#e08a1e':t==='neg'?'#d23a52':'#8a93a3';}
function VaccBadge({status}){
  const cs=vaccCanon(status), c=vaccColor(status); return <span style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:11,fontWeight:600,padding:'2px 9px',borderRadius:20,color:c,background:c+'1c'}}><i style={{width:6,height:6,borderRadius:'50%',background:c}}/>{cs}</span>;
}
// Staff avatar for every list and table. Shows the record's PHOTO when one has been
// uploaded (staff.photo = {url, publicId} from POST /api/upload) and falls back to
// name-coloured initials otherwise — including when the url is dead or blocked, so a
// list can never show the browser's broken-image glyph.
function Avatar({name,size=34,fontSize,photo}){
  const [dead,setDead]=React.useState(false);
  React.useEffect(()=>{setDead(false);},[photo&&photo.url]);
  const parts=(name||'?').split(' '); const ini=(parts[0][0]||'')+(parts.length>1?parts[parts.length-1][0]:'');
  let h=0; for(const ch of name||'') h=(h*31+ch.charCodeAt(0))%360;
  const box={width:size,height:size,borderRadius:'50%',flexShrink:0};
  if(photo&&photo.url&&!dead){
    // Small CDN derivative + lazy load: a 26px avatar must not pull the 640px original.
    const src=(window.MK&&window.MK.cdnPhoto)?window.MK.cdnPhoto(photo.url,size):photo.url;
    return <img src={src} alt={ini.toUpperCase()} title={name||''} onError={()=>setDead(true)}
      loading="lazy" decoding="async"
      style={{...box,objectFit:'cover',display:'block',background:'#e8eef5'}}/>;
  }
  return <div style={{...box,display:'grid',placeItems:'center',
    fontSize:fontSize||size*0.4,fontWeight:700,color:'#fff',background:`linear-gradient(135deg,hsl(${h} 60% 52%),hsl(${(h+40)%360} 62% 42%))`}}>{ini.toUpperCase()}</div>;
}
function RoleBadge({role}){
  const pca=role==='PCA'; const c=pca?'#6a52d4':'#0090ca';
  return <span style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:10.5,fontWeight:700,padding:'2px 8px',borderRadius:5,color:c,background:c+'16',letterSpacing:.3}}>{role||'Nurse'}</span>;
}

/* ---------------- Export (Excel / Word / CSV / Print) ---------------- */
const STAFF_EXPORT_COLS=[['Emp ID','emp_id'],['Name','name'],['Role','role'],['Designation','designation'],['Department','current_department'],['Qualification','qualification'],['DOJ','doj'],['Experience','total_experience_text'],['Special Training','special_training'],['Extracurricular Activities','extracurricular'],['Hep-B Vaccination','hepatitis_b_vaccination'],['Phone','phone'],['Remarks','remarks']];
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
        <div onMouseLeave={()=>setOpen(false)} style={{position:'absolute',right:0,top:'112%',zIndex:60,background:'rgba(255,255,255,.88)',backdropFilter:'blur(24px) saturate(1.6)',WebkitBackdropFilter:'blur(24px) saturate(1.6)',border:'1px solid rgba(255,255,255,.92)',boxShadow:'0 22px 56px rgba(31,59,90,.26)',borderRadius:10,minWidth:172,overflow:'hidden',padding:4}}>
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

/* Resolve a raw current_department to its REAL department. Some imported records have
   designation text baked in ("MICU, Supervisor", "Charge Nurse ER", "Nurse Manager"),
   which would otherwise each show as a bogus "department". We map to the canonical
   DEPARTMENTS list (longest match wins so "CT ICU" beats "ICU"); pure-designation values
   with no detectable department fall into "Unassigned". */
function staffShortCanon(raw){
  const S=window.STAFF; const DEPTS=(S&&S.DEPARTMENTS)||[]; const DESIGS=(S&&S.DESIGNATIONS)||[];
  const s=String(raw||'').trim();
  if(!s) return 'Unassigned';
  const lc=s.toLowerCase();
  for(const d of DEPTS){ if(d.toLowerCase()===lc) return d; }
  const norm=s.replace(/[.,;/]+/g,' ').replace(/\s+/g,' ').trim();
  const nl=norm.toLowerCase();
  const padded=' '+nl+' ';
  // Synonyms that map to a canonical department.
  const ALIAS={emergency:'ER',cticu:'CT ICU','ct icu':'CT ICU','cardiac icu':'CT ICU','ctvs icu':'CT ICU',homecare:'HomeCare','home care':'HomeCare','family medicine':'HomeCare',daycare:'DayCare','day care':'DayCare'};
  if(ALIAS[nl]) return ALIAS[nl];
  const esc=x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const sorted=[...DEPTS].sort((a,b)=>b.length-a.length);
  for(const d of sorted){ if(new RegExp('(^| )'+esc(d.toLowerCase())+'( |$)').test(padded)) return d; }
  // spelling / spacing variants
  if(/training\s*(and|&)\s*development/.test(nl)) return 'Training & Development';
  if(/infection\s*(prevention|control)/.test(nl)) return 'Infection Control';
  const lvl=nl.match(/level\s*-?\s*(\d+)/); if(lvl) return 'Level-'+lvl[1];
  if(/cath\s*lab/.test(nl)) return 'Cath Lab';
  // pure designation with no department -> Unassigned
  if(DESIGS.some(g=>{ const gl=g.toLowerCase(); return nl===gl || new RegExp('(^| )'+esc(gl)+'( |$)').test(padded); })) return 'Unassigned';
  return s; // a genuine unit not in the canonical list (kept as-is)
}

/* STATISTICS is the single source of department names. Read the live stats department
   list (base + custom, via buildDepts) so ADDING or RENAMING a department in Statistics
   auto-reflects in the staff module. Match a stored staff value to a stats dept by
   name / id / key / short and return its CURRENT name. */
let _staffStatsCache=null, _staffStatsKey=null;
function staffStatsList(){
  try{
    if(!window.buildDepts) return null;
    const rawOv=localStorage.getItem('unico_store_v3')||'';
    if(_staffStatsKey===rawOv && _staffStatsCache) return _staffStatsCache; // cache until the overlay (renames/adds) changes
    const m=window.buildDepts(JSON.parse(rawOv||'{}')||{});
    if(Array.isArray(m)&&m.length){ _staffStatsKey=rawOv; _staffStatsCache=m; return m; }
  }catch(e){}
  return null;
}
function staffStatsName(raw){
  const list=staffStatsList(); if(!list) return null;
  const v=String(raw||'').trim(); if(!v||v==='Unassigned') return null;
  const lc=v.toLowerCase();
  const d=list.find(x=>[x.name,x.id,x.key,x.short].some(a=>String(a||'').trim().toLowerCase()===lc));
  return d?d.name:null;
}
// Canonical department for grouping/filters: prefer the live STATISTICS name; else the
// short-code normalization above. (Resolves both the raw value and its cleaned form.)
function staffCanonDept(raw){
  const short=staffShortCanon(raw);
  return staffStatsName(raw) || staffStatsName(short) || short;
}

/* Full display name for a (canonical) department. The stored/matched value stays the
   short code (e.g. "ER") so data & filters keep working; only what's SHOWN expands.
   Edit these labels to match your hospital's exact naming. */
const STAFF_DEPT_FULL={
  'ER':'Emergency (ER)',
  'OPD':'Outpatient Department (OPD)',
  'NICU':'Neonatal ICU (NICU)',
  'MICU':'Medical ICU (MICU)',
  'SICU':'Surgical ICU (SICU)',
  'CCU':'Coronary Care Unit (CCU)',
  'CT ICU':'Cardiac ICU (CT ICU)',
  'CT OT':'Cardiac Operation Theatre (CT OT)',
  'LDR':'Labour, Delivery & Recovery (LDR)',
  'Cath Lab':'Catheterization Lab',
  'General OT':'General Operation Theatre',
  'Cardiac OT':'Cardiac Operation Theatre',
  'HomeCare':'Family Medicine',
  'DayCare':'Day Care',
  'Level-9':'Cabin Level 9',
  'Level-10':'Cabin Level 10',
  'Level-11':'Cabin Level 11',
};
function staffDeptLabel(n){ return STAFF_DEPT_FULL[n]||n; }
// Display name (read-only views): the live STATISTICS name if resolvable (so renames
// in Statistics show through), otherwise the short-code's full label.
function staffDeptShow(raw){
  // A staff member can belong to MULTIPLE departments (stored comma-separated, e.g.
  // "General OT, CTVS OT"). Resolve each part to its display name and re-join.
  const parts=String(raw||'').split(',').map(x=>x.trim()).filter(Boolean);
  const one=(v)=>{ const short=staffShortCanon(v); return staffStatsName(v)||staffStatsName(short)||staffDeptLabel(short); };
  if(parts.length>1) return [...new Set(parts.map(one))].join(', ');
  return one(raw);
}
/* Resolve a raw designation to its correct canonical spelling. Fixes common import
   typos ("Satff Nurse" -> "Staff Nurse", "Sr." -> "Senior") and case/spacing so the
   Designation Breakdown, filters and counts don't split the same role into duplicates. */
function staffCanonDesig(raw){
  let s=String(raw||'').trim().replace(/\s+/g,' ');
  if(!s) return '';
  s=s.replace(/satff/gi,'Staff').replace(/\bsr\.?\b/gi,'Senior').replace(/\bjr\.?\b/gi,'Junior')
     .replace(/incharge/gi,'Incharge').replace(/\s+/g,' ').trim();
  // Merge every "…incharge nurse" variant — "Incharge Nurse", "In charge Nurse",
  // "OT Incharge Nurse" — into the single canonical "Charge Nurse".
  if(/in\s*charge nurse$/i.test(s)) return 'Charge Nurse';
  const DESIGS=(window.STAFF&&window.STAFF.DESIGNATIONS)||[];
  const lc=s.toLowerCase();
  for(const d of DESIGS){ if(d.toLowerCase()===lc) return d; } // canonical spelling wins
  return s;
}
if(typeof window!=='undefined'){ window.staffCanonDept=staffCanonDept; window.staffDeptLabel=staffDeptLabel; window.staffDeptShow=staffDeptShow; window.staffCanonDesig=staffCanonDesig; }

/* ---------------- Employees per department — ALL units, searchable / sortable ---------------- */
function StaffDeptChart({list, setRoute, tone='#0090ca', role='Nurse'}){
  const {useState,useEffect,useMemo}=React;
  const [q,setQ]=useState('');
  const [pick,setPick]=useState('');                // selected department ('' = all)
  const [sortMode,setSortMode]=useState('count');   // 'count' | 'name'
  const [mounted,setMounted]=useState(false);
  const [sel,setSel]=useState('');                  // clicked department -> staff list below
  useEffect(()=>{ const t=setTimeout(()=>setMounted(true),30); return ()=>clearTimeout(t); },[]);
  // Group by the CANONICAL department so "Level-10"/"Level - 10"/"Level- 10", or
  // "MICU"/"MICU, Supervisor" merge into one bar instead of many.
  // Group by CANONICAL dept, SPLITTING comma-separated values so a nurse manager
  // assigned to several units is counted under each. members[dept] = staff array.
  const members=useMemo(()=>{
    const m={};
    list.forEach(e=>{
      const parts=[...new Set(String(e.current_department||'').split(',').map(x=>staffCanonDept(x.trim())).filter(Boolean))];
      (parts.length?parts:['Unassigned']).forEach(d=>{ (m[d]=m[d]||[]).push(e); });
    });
    return m;
  },[list]);
  const rows=Object.entries(members).map(([label,arr])=>({label,value:arr.length}));
  const total=rows.reduce((s,r)=>s+r.value,0)||1;
  const max=Math.max(1,...rows.map(r=>r.value));
  const noun=role==='PCA'?'PCA':'nurses';
  const ql=q.trim().toLowerCase();
  let shown=rows.filter(r=>(!ql||r.label.toLowerCase().includes(ql)||staffDeptLabel(r.label).toLowerCase().includes(ql))&&(!pick||r.label===pick));
  shown=sortMode==='name'?[...shown].sort((a,b)=>staffDeptLabel(a.label).localeCompare(staffDeptLabel(b.label))):[...shown].sort((a,b)=>b.value-a.value);
  const tone2='#27a8db';
  const deptOptions=[...rows.map(r=>r.label)].sort((a,b)=>staffDeptLabel(a).localeCompare(staffDeptLabel(b)));
  const selSty={padding:'6px 8px',border:'1px solid var(--line)',borderRadius:7,fontSize:11.5,fontFamily:'inherit',background:'#fff',color:'var(--ink-2)',maxWidth:170};
  return (
    <div className="card" style={{display:'flex',flexDirection:'column'}}>
      <div className="card-h" style={{flexWrap:'wrap',gap:8}}>
        <h3>Employees per Department</h3>
        <span className="sub">{rows.length} units · {total} {noun}</span>
        <span className="spacer"/>
        <select value={pick} onChange={e=>setPick(e.target.value)} style={selSty} title="Filter to a department">
          <option value="">All departments</option>
          {deptOptions.map(d=><option key={d} value={d}>{staffDeptLabel(d)}</option>)}
        </select>
        <div style={{display:'flex',alignItems:'center',gap:6,background:'var(--panel-2)',border:'1px solid var(--line)',borderRadius:7,padding:'5px 9px',width:128,color:'var(--faint)'}}>
          <Ic d={I.search} s={13}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Find unit…" style={{border:0,background:'transparent',outline:'none',fontFamily:'inherit',fontSize:12,color:'var(--ink)',width:'100%'}}/>
        </div>
        <div className="seg">
          <button className={sortMode==='count'?'on':''} onClick={()=>setSortMode('count')}>Count</button>
          <button className={sortMode==='name'?'on':''} onClick={()=>setSortMode('name')}>A–Z</button>
        </div>
      </div>
      <div className="card-b" style={{maxHeight:360,overflowY:'auto',display:'flex',flexDirection:'column',gap:9}}>
        {shown.length===0&&<div style={{textAlign:'center',color:'var(--faint)',fontSize:12.5,padding:20}}>No units match “{q}”.</div>}
        {shown.map((r,i)=>{
          const pct=Math.round((r.value/total)*100), w=(r.value/max)*100, top=sortMode==='count'&&i===0;
          return (
            <div key={r.label} onClick={()=>setSel(s=>s===r.label?'':r.label)} title={`Click to list ${staffDeptLabel(r.label)} ${noun}`}
              style={{display:'grid',gridTemplateColumns:'190px 1fr 64px',alignItems:'center',gap:10,cursor:'pointer',borderRadius:7,padding:'2px 4px',background:sel===r.label?'var(--blue-50)':'transparent'}}
              onMouseEnter={e=>{const b=e.currentTarget.querySelector('.dbar');if(b)b.style.filter='brightness(1.08)';}}
              onMouseLeave={e=>{const b=e.currentTarget.querySelector('.dbar');if(b)b.style.filter='none';}}>
              <div style={{fontSize:12,fontWeight:top?700:600,color:top?'var(--ink)':'var(--ink-2)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{staffDeptLabel(r.label)}</div>
              <div style={{height:18,background:'var(--panel-2)',borderRadius:6,overflow:'hidden'}}>
                <div className="dbar" style={{height:'100%',width:mounted?w+'%':'0%',minWidth:r.value?6:0,background:`linear-gradient(90deg,${tone},${tone2})`,borderRadius:6,transition:`width .8s ${Math.min(i,22)*45}ms cubic-bezier(.2,.8,.25,1),filter .15s`}}/>
              </div>
              <div style={{textAlign:'right',whiteSpace:'nowrap'}}>
                <span className="num" style={{fontSize:13,fontWeight:700,color:'var(--ink)'}}>{r.value}</span>
                <span style={{fontSize:10.5,color:'var(--muted)',marginLeft:4}}>{pct}%</span>
              </div>
            </div>
          );
        })}
      </div>
      {sel&&members[sel]&&(
        <div style={{borderTop:'1px solid var(--line-2)',padding:'10px 14px'}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8,flexWrap:'wrap'}}>
            <b style={{fontSize:13}}>{staffDeptLabel(sel)}</b>
            <span className="tag" style={{background:'var(--blue-50)',color:'var(--blue-700)'}}>{members[sel].length} {noun}</span>
            <span className="spacer" style={{flex:1}}/>
            <button className="btn sm" onClick={()=>setSel('')}><Ic d={I.x} s={13}/>Close</button>
          </div>
          <div style={{maxHeight:210,overflowY:'auto',display:'flex',flexDirection:'column',gap:4}}>
            {[...members[sel]].sort((a,b)=>String(a.name).localeCompare(String(b.name))).map(e=>(
              <div key={e.id} onClick={()=>setRoute&&setRoute({view:'staffProfile',emp:e.id})} style={{display:'flex',alignItems:'center',gap:9,padding:'6px 8px',borderRadius:7,cursor:'pointer',border:'1px solid var(--line-2)'}}
                onMouseEnter={ev=>ev.currentTarget.style.background='var(--panel-2)'} onMouseLeave={ev=>ev.currentTarget.style.background='transparent'}>
                <Avatar photo={e.photo} name={e.name} size={26}/>
                <div style={{minWidth:0,flex:1}}><div style={{fontSize:12.5,fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{e.name}</div>
                  <div style={{fontSize:10.5,color:'var(--muted)'}}>{e.designation||'—'}{e.emp_id?' · '+e.emp_id:''}</div></div>
                {e.phone&&<span className="num" style={{fontSize:11,color:'var(--ink-2)'}}>{e.phone}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Experience Distribution — interactive (click a bar → staff list) ---------------- */
function StaffExpChart({list, setRoute, role='Nurse'}){
  const {useState}=React;
  const [sel,setSel]=useState(-1);
  const S=window.STAFF;
  const BUCKETS=[['<1y',0,1],['1-3y',1,3],['3-5y',3,5],['5-10y',5,10],['10y+',10,Infinity]];
  const members=BUCKETS.map(()=>[]);
  list.forEach(e=>{ const y=S.expYears(e); if(y==null) return; for(let i=0;i<BUCKETS.length;i++){ if(y>=BUCKETS[i][1]&&y<BUCKETS[i][2]){ members[i].push(e); break; } } });
  const data=BUCKETS.map(([label],i)=>({label,value:members[i].length}));
  const total=data.reduce((s,d)=>s+d.value,0)||1;
  const noun=role==='PCA'?'PCA':'nurses';
  const cur=sel>=0?members[sel]:null;
  return (
    <div className="card">
      <div className="card-h"><h3>Experience Distribution</h3><span className="sub">click a bar to list staff</span><span className="spacer"/><span className="tag">3D</span></div>
      <div className="card-b">
        <Bar3D data={data} x="label" y="value" height={240} color="#0090ca" onBar={(i)=>setSel(s=>s===i?-1:i)}/>
        {cur&&(
          <div style={{marginTop:6,borderTop:'1px solid var(--line-2)',paddingTop:10}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8,flexWrap:'wrap'}}>
              <b style={{fontSize:13}}>{BUCKETS[sel][0]} experience</b>
              <span className="tag" style={{background:'var(--blue-50)',color:'var(--blue-700)'}}>{cur.length} {noun} · {Math.round(cur.length/total*100)}%</span>
              <span className="spacer" style={{flex:1}}/>
              <button className="btn sm" onClick={()=>setSel(-1)}><Ic d={I.x} s={13}/>Close</button>
            </div>
            <div style={{maxHeight:168,overflowY:'auto',display:'flex',flexDirection:'column',gap:4}}>
              {cur.length===0&&<div style={{color:'var(--faint)',fontSize:12,padding:'4px 2px'}}>No {noun} in this range.</div>}
              {[...cur].sort((a,b)=>S.expYears(b)-S.expYears(a)).map(e=>(
                <div key={e.id} onClick={()=>setRoute({view:'staffProfile',emp:e.id})} style={{display:'flex',alignItems:'center',gap:9,padding:'6px 8px',borderRadius:7,cursor:'pointer',border:'1px solid var(--line-2)'}}
                  onMouseEnter={ev=>ev.currentTarget.style.background='var(--panel-2)'} onMouseLeave={ev=>ev.currentTarget.style.background='transparent'}>
                  <Avatar photo={e.photo} name={e.name} size={26}/>
                  <div style={{minWidth:0,flex:1}}><div style={{fontSize:12.5,fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{e.name}</div>
                    <div style={{fontSize:10.5,color:'var(--muted)'}}>{e.designation||'—'} · {staffDeptShow(e.current_department)}</div></div>
                  <span className="num" style={{fontSize:11.5,color:'var(--ink-2)',fontWeight:600}}>{S.expLabel(e)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Designation Breakdown — interactive (click a role → staff list) ---------------- */
function StaffDesigChart({list, setRoute, role='Nurse'}){
  const {useState}=React;
  const [sel,setSel]=useState(null);   // designation label ('Other' = the grouped rest)
  const S=window.STAFF;
  const canon=window.staffCanonDesig||((x)=>x);
  const count={}, members={};
  list.forEach(e=>{ const d=canon(e.designation)||'—'; count[d]=(count[d]||0)+1; (members[d]=members[d]||[]).push(e); });
  const all=Object.entries(count).sort((a,b)=>b[1]-a[1]);
  // Show EVERY designation as its own slice/legend row (no "Other" grouping) so roles
  // like Acting Charge Nurse, Infection Control Nurse, etc. are always visible. Colours
  // reuse the brand palette, then fall back to distinct generated hues beyond it.
  const donut=all.map(([label,value],i)=>({label,value,color:PALETTE[i]||`hsl(${(i*67)%360} 58% 52%)`}));
  const noun=role==='PCA'?'PCA':'nurses';
  let curLabel=null, curList=null;
  if(sel){ curLabel=sel; curList=members[sel]||[]; }
  return (
    <div className="card">
      <div className="card-h"><h3>Designation Breakdown</h3><span className="sub">click a role to list staff</span><span className="spacer"/></div>
      <div className="card-b">
        <div style={{display:'grid',placeItems:'center'}}><Donut data={donut} size={188} centerValue={fmt(list.length)} centerLabel="staff" onSlice={(i,d)=>setSel(s=>s===d.label?null:d.label)}/></div>
        {curList&&(
          <div style={{marginTop:8,borderTop:'1px solid var(--line-2)',paddingTop:10}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8,flexWrap:'wrap'}}>
              <b style={{fontSize:13}}>{curLabel}</b>
              <span className="tag" style={{background:'var(--blue-50)',color:'var(--blue-700)'}}>{curList.length} {noun} · {Math.round(curList.length/(list.length||1)*100)}%</span>
              <span className="spacer" style={{flex:1}}/>
              <button className="btn sm" onClick={()=>setSel(null)}><Ic d={I.x} s={13}/>Close</button>
            </div>
            <div style={{maxHeight:180,overflowY:'auto',display:'flex',flexDirection:'column',gap:4}}>
              {[...curList].sort((a,b)=>(a.name||'').localeCompare(b.name||'')).map(e=>(
                <div key={e.id} onClick={()=>setRoute({view:'staffProfile',emp:e.id})} style={{display:'flex',alignItems:'center',gap:9,padding:'6px 8px',borderRadius:7,cursor:'pointer',border:'1px solid var(--line-2)'}}
                  onMouseEnter={ev=>ev.currentTarget.style.background='var(--panel-2)'} onMouseLeave={ev=>ev.currentTarget.style.background='transparent'}>
                  <Avatar photo={e.photo} name={e.name} size={26}/>
                  <div style={{minWidth:0,flex:1}}><div style={{fontSize:12.5,fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{e.name}</div>
                    <div style={{fontSize:10.5,color:'var(--muted)'}}>{canon(e.designation)||'—'} · {staffDeptShow(e.current_department)}</div></div>
                  <span className="num" style={{fontSize:11.5,color:'var(--ink-2)',fontWeight:600}}>{S.expLabel(e)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Workforce Dashboard (NEMS-style) ---------------- */
function WorkforceDashboard({store, setRoute, role='Nurse'}){
  const S=window.STAFF;
  // Active roster only — inactive / former staff never count in the dashboard charts,
  // drill-down lists or KPIs (they live in the Directory's "Show inactive" and Previous Staff).
  const list=store.staff.filter(e=>(e.role||'Nurse')===role && e.is_active && !e.former);
  const [showHi,setShowHi]=React.useState(false);
  const tone=role==='PCA'?'#6a52d4':'#0090ca';
  const listView=role==='PCA'?'pca':'nurses';
  const compView=role==='PCA'?'pcaCompliance':'nurseCompliance';
  const homeView=role==='PCA'?'pcaHome':'nurseHome';
  const k=S.kpis(list);
  const vacc=S.vaccinationBreakdown(list).map(([label,value])=>({label,value,color:vaccColor(label)}));
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
      {window.PerfBands && <window.PerfBands role={role} setRoute={setRoute}/>}
      <SectionTitle icon={role==='PCA'?I.bed:I.steth} title={`${role==='PCA'?'PCA':'Nurse'} Dashboard`} sub={`Live overview of the ${role} roster`}
        right={<><button className="btn sm" onClick={()=>setShowHi(true)} style={{color:'#b8860b',borderColor:'#e6c34d'}}><Ic d={I.star} s={15}/>Staff Highlight</button>
          <button className="btn sm" onClick={()=>setRoute({view:listView})}><Ic d={I.layers} s={15}/>Directory</button>
          <button className="btn sm" onClick={()=>setRoute({view:compView})}><Ic d={I.heart} s={15}/>Compliance</button>
          <button className="btn sm" onClick={()=>setRoute({view:homeView})}><Ic d={I.activity} s={15}/>Refresh</button>
          {(!window.unicoCan||window.unicoCan('staff','add'))&&<button className="btn pri sm" style={{background:tone,borderColor:tone}} onClick={()=>setRoute({view:'staffForm',role})}><Ic d={I.plus} s={15}/>Add {role==='PCA'?'PCA':'Nurse'}</button>}</>}/>
      <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))'}}>
        <Kpi label={`Total ${role==='PCA'?'PCAs':'Nurses'}`} val={fmt(k.total_staff)} foot={`active ${role} on roster`} color={tone}/>
        <Kpi label="Departments" val={fmt(new Set(list.map(e=>staffCanonDept(e.current_department))).size)} foot="distinct units staffed" color="#6a52d4"/>
        <Kpi label="Vaccinated" val={k.vaccinated_pct+'%'} foot="Hep-B completed / vaccinated" color="#1f9d57"/>
        <Kpi label="Compliance Issues" val={fmt(compIssues)} foot={`${comp.missing_vaccination.length} vacc · ${comp.missing_training.length} training · click for details`} color="#d23a52"/>
      </div>

      <div className="grid" style={{gridTemplateColumns:'1.25fr 1fr'}}>
        <StaffDeptChart list={list} setRoute={setRoute} tone={tone} role={role}/>
        <StaffDesigChart list={list} setRoute={setRoute} role={role}/>
      </div>

      <div className="grid" style={{gridTemplateColumns:'1fr 1.25fr'}}>
        <div className="card">
          <div className="card-h"><h3>Hep-B Vaccination</h3><span className="spacer"/></div>
          <div className="card-b" style={{display:'grid',placeItems:'center'}}><Donut data={vacc} size={172} centerValue={k.vaccinated_pct+'%'} centerLabel="compliant"/></div>
        </div>
        <StaffExpChart list={list} setRoute={setRoute} role={role}/>
      </div>

      <div className="grid" style={{gridTemplateColumns:'1fr 1fr'}}>
        <div className="card">
          <div className="card-h"><h3>Recent Joiners</h3><span className="spacer"/></div>
          <div className="card-b" style={{display:'flex',flexDirection:'column',gap:2}}>
            {recent.map(e=>(
              <div key={e.id} style={{display:'flex',alignItems:'center',gap:11,padding:'8px 4px',borderBottom:'1px solid var(--line-2)',cursor:'pointer'}} onClick={()=>setRoute({view:'staffProfile',emp:e.id})}>
                <Avatar photo={e.photo} name={e.name} size={32}/>
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
                <Avatar photo={e.photo} name={e.name} size={32}/>
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

      {showHi&&<StaffHighlight list={list} role={role} tone={tone} setRoute={setRoute} onClose={()=>setShowHi(false)}/>}
    </div>
  );
}

/* ---------------- Staff Highlight (spotlight modal) ---------------- */
function StaffHighlight({list, role, tone, setRoute, onClose}){
  const S=window.STAFF;
  const active=list.filter(e=>e.is_active);
  const go=(e)=>{onClose();setRoute({view:'staffProfile',emp:e.id});};
  const topExp=[...active].map(e=>({e,y:S.expYears(e)})).filter(x=>x.y!=null)
    .sort((a,b)=>b.y-a.y).slice(0,5);
  const newest=S.recentJoiners(active,5);
  const annv=S.anniversaries(active,90).slice(0,5);
  const Row=({e,right})=>(
    <div onClick={()=>go(e)} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 6px',borderBottom:'1px solid var(--line-2)',cursor:'pointer',borderRadius:6}}
      onMouseEnter={ev=>ev.currentTarget.style.background='var(--panel-2)'} onMouseLeave={ev=>ev.currentTarget.style.background='transparent'}>
      <Avatar photo={e.photo} name={e.name} size={30}/>
      <div style={{minWidth:0,flex:1}}>
        <div style={{fontSize:12.5,fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{e.name}</div>
        <div style={{fontSize:10.5,color:'var(--muted)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{e.designation||'—'} · {e.current_department||'—'}</div>
      </div>
      <span className="num" style={{fontSize:11.5,fontWeight:700,color:tone,flexShrink:0}}>{right}</span>
    </div>
  );
  const Card=({icon,color,title,sub,children,empty})=>(
    <div className="card" style={{padding:0,display:'flex',flexDirection:'column',minWidth:0}}>
      <div className="card-h" style={{padding:'11px 13px',borderBottom:'1px solid var(--line-2)'}}>
        <span style={{color,display:'inline-flex'}}><Ic d={icon} s={16}/></span>
        <h3 style={{fontSize:13}}>{title}</h3><span className="sub" style={{fontSize:10.5}}>{sub}</span><span className="spacer"/>
      </div>
      <div style={{padding:'4px 9px 8px'}}>{children.length?children:<div style={{color:'var(--faint)',fontSize:12,padding:'12px 4px'}}>{empty}</div>}</div>
    </div>
  );
  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,zIndex:1200,background:'rgba(16,24,40,.5)',display:'grid',placeItems:'center',padding:20,backdropFilter:'blur(2px)'}}>
      <div onClick={ev=>ev.stopPropagation()} className="card anim-pop" style={{width:'min(860px,96vw)',maxHeight:'92vh',overflow:'auto',padding:0}}>
        <div style={{display:'flex',alignItems:'center',gap:11,padding:'16px 20px',borderBottom:'1px solid var(--line)',background:'linear-gradient(120deg,#fff8e6,#fff)'}}>
          <span style={{color:'#e0a81e',display:'inline-flex'}}><Ic d={I.star} s={22}/></span>
          <div style={{flex:1}}>
            <div style={{fontSize:16,fontWeight:800,color:'var(--ink)'}}>{role} Highlights</div>
            <div style={{fontSize:12,color:'var(--muted)'}}>Standout members of the {role.toLowerCase()} roster — {active.length} active</div>
          </div>
          <button className="icon-btn" onClick={onClose}><Ic d={I.x} s={16}/></button>
        </div>
        <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:14,padding:16}}>
          <Card icon={I.star} color="#e0a81e" title="Most Experienced" sub="by total experience" empty="No experience on record">
            {topExp.map(({e,y})=><Row key={e.id} e={e} right={S.expLabel(e)}/>)}
          </Card>
          <Card icon={I.plus} color="#1f9d57" title="Newest Joiners" sub="recent hires" empty="No joining dates on record">
            {newest.map(e=><Row key={e.id} e={e} right={e.doj}/>)}
          </Card>
          <Card icon={I.heart} color="#6a52d4" title="Upcoming Anniversaries" sub="next 90 days" empty="None in the window">
            {annv.map(({e,years})=><Row key={e.id} e={e} right={`${years} yr${years>1?'s':''}`}/>)}
          </Card>
        </div>
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
    if(dept&&staffCanonDept(e.current_department)!==dept)return false;
    if(desig&&staffCanonDesig(e.designation)!==desig)return false;
    if(vacc==='__ok'&&!vaccOK(e.hepatitis_b_vaccination))return false;
    if(vacc==='__gap'&&vaccOK(e.hepatitis_b_vaccination))return false;
    if(vacc&&!vacc.startsWith('__')&&vaccCanon(e.hepatitis_b_vaccination)!==vacc)return false;
    return true;
  });
  const sel={padding:'8px 11px',border:'1px solid var(--line)',borderRadius:7,fontSize:12.5,fontFamily:'inherit',background:'#fff'};
  const nurses=list.filter(e=>(e.role||'Nurse')==='Nurse').length, pcas=list.filter(e=>e.role==='PCA').length;
  return (
    <div className="grid" style={{gap:16}}>
      <SectionTitle icon={I.layers} title="Staff Directory" sub={`${filtered.length} shown · ${nurses} nurses · ${pcas} PCA`}
        right={(!window.unicoCan||window.unicoCan('staff','add'))?<button className="btn pri sm" onClick={()=>setRoute({view:'staffForm'})}><Ic d={I.plus} s={15}/>Add Staff</button>:null}/>
      <div className="card" style={{padding:'12px 14px',display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,background:'var(--panel-2)',border:'1px solid var(--line)',borderRadius:7,padding:'7px 11px',width:240,flexShrink:0,color:'var(--faint)'}}><Ic d={I.search} s={15}/>
          <input placeholder="Search name, ID, phone…" value={q} onChange={e=>setQ(e.target.value)} style={{border:0,background:'transparent',outline:'none',fontFamily:'inherit',fontSize:12.5,color:'var(--ink)',width:'100%'}}/></div>
        <div className="seg">{[['','All'],['Nurse','Nurses'],['PCA','PCA']].map(([v,l])=>(<button key={v} className={role===v?'on':''} onClick={()=>setRole(v)}>{l}</button>))}</div>
        <select style={sel} value={dept} onChange={e=>setDept(e.target.value)}><option value="">All departments</option>{window.STAFF.DEPARTMENTS.map(d=><option key={d} value={d}>{staffDeptLabel(d)}</option>)}</select>
        <select style={sel} value={desig} onChange={e=>setDesig(e.target.value)}><option value="">All designations</option>{[...window.STAFF.DESIGNATIONS,...window.STAFF.PCA_DESIGNATIONS].map(d=><option key={d}>{d}</option>)}</select>
        <select style={sel} value={vacc} onChange={e=>setVacc(e.target.value)}><option value="">Any vaccination</option><option value="__ok">✓ Compliant</option><option value="__gap">⚠ Has gap</option>{window.STAFF.VACCINATION_STATES.map(d=><option key={d}>{d}</option>)}</select>
        {(q||role||dept||desig||vacc)&&<button className="btn sm" onClick={()=>{setQ('');setRole('');setDept('');setDesig('');setVacc('');}}>Clear</button>}
        <span className="spacer"/>
        <ExportMenu rows={filtered} role={role||'Staff'}/>
      </div>
      <div className="card" style={{overflow:'hidden'}}>
        <div style={{overflowX:'auto'}}>
          <table className="tbl">
            <thead><tr><th style={{textAlign:'left'}}>Staff</th><th style={{textAlign:'left'}}>Role</th><th style={{textAlign:'left'}}>Emp ID</th><th style={{textAlign:'left'}}>Designation</th><th style={{textAlign:'left'}}>Department</th><th>Experience</th><th style={{textAlign:'left'}}>Vaccination</th><th style={{textAlign:'left'}}>Phone</th><th></th></tr></thead>
            <tbody>
              {filtered.map(e=>(
                <tr key={e.id} style={{cursor:'pointer'}} onClick={()=>setRoute({view:'staffProfile',emp:e.id})}>
                  <td style={{textAlign:'left'}}><div style={{display:'flex',alignItems:'center',gap:10}}><Avatar photo={e.photo} name={e.name} size={30}/><div><div style={{fontWeight:600,color:'var(--ink)'}}>{e.name}</div><div style={{fontSize:10.5,color:'var(--faint)',fontFamily:"'IBM Plex Sans'"}}>{e.qualification||'—'}</div></div></div></td>
                  <td style={{textAlign:'left'}}><RoleBadge role={e.role}/></td>
                  <td style={{textAlign:'left'}}>{e.emp_id}</td>
                  <td style={{textAlign:'left',fontFamily:"'IBM Plex Sans'"}}>{staffCanonDesig(e.designation)||'—'}</td>
                  <td style={{textAlign:'left',fontFamily:"'IBM Plex Sans'"}}>{staffDeptShow(e.current_department)}</td>
                  <td title={e.total_experience_text||''} className="num">{window.STAFF.expLabel(e)}</td>
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
  const comp=window.STAFF.compliance(store.staff.filter(e=>(e.role||'Nurse')===role && e.is_active && !e.former));
  const card=(title,icon,tone,rows,emptyMsg,filter)=>(
    <div className="card" style={{overflow:'hidden'}}>
      <div className="card-h"><div style={{width:28,height:28,borderRadius:7,background:tone+'1a',color:tone,display:'grid',placeItems:'center'}}><Ic d={icon} s={16}/></div>
        <h3>{title}</h3><span className="spacer"/><span className="num" style={{fontSize:20,fontWeight:700,color:tone}}>{rows.length}</span></div>
      <div style={{maxHeight:300,overflowY:'auto'}}>
        {rows.length===0?<div style={{padding:'24px',textAlign:'center',color:'var(--pos)',fontSize:13}}><Ic d={I.check} s={26} c="#1f9d57"/><div style={{marginTop:6}}>{emptyMsg}</div></div>:
        rows.map(e=>(
          <div key={e.id} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 14px',borderBottom:'1px solid var(--line-2)',cursor:'pointer'}} onClick={()=>setRoute({view:'staffProfile',emp:e.id})}>
            <Avatar photo={e.photo} name={e.name} size={30}/>
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
// The directory must come back EXACTLY as you left it. Opening a profile swaps the
// view, so this component UNMOUNTS — every filter and the scroll position died with
// it, and "back" dumped you at the top of an unfiltered list. Filters + scroll are
// remembered here (per role, module scope: survives navigation, resets on reload).
const DIR_MEMO = {};
function ManageStaff({store, setRoute, role}){
  const S=window.STAFF;
  const M=DIR_MEMO[role]||{};
  const [q,setQ]=React.useState(M.q||'');
  const [chip,setChip]=React.useState(M.chip||'all');
  const [dept,setDept]=React.useState(M.dept||'');
  const [desig,setDesig]=React.useState(M.desig||'');
  const [vacc,setVacc]=React.useState(M.vacc||'');
  const [qual,setQual]=React.useState(M.qual||'');
  const [expB,setExpB]=React.useState(M.expB||'');
  const [training,setTraining]=React.useState(M.training||'');
  const [sortBy,setSortBy]=React.useState(M.sortBy||'name');
  const [showInactive,setShowInactive]=React.useState(!!M.showInactive);
  // Remember the filters as they change…
  React.useEffect(()=>{ DIR_MEMO[role]=Object.assign({},DIR_MEMO[role],{q,chip,dept,desig,vacc,qual,expB,training,sortBy,showInactive}); });
  // …and the scroll position, tracked live (an unmount-time read is too late: the
  // list is gone and .content has already collapsed by the time cleanup runs).
  React.useEffect(()=>{
    const el=document.querySelector('.content'); if(!el) return;
    const saved=(DIR_MEMO[role]||{}).scroll||0;
    if(saved){ let tries=0; const restore=()=>{ el.scrollTop=saved; if(Math.abs(el.scrollTop-saved)>4&&++tries<12) requestAnimationFrame(restore); }; requestAnimationFrame(restore); }
    const onScroll=()=>{ DIR_MEMO[role]=Object.assign({},DIR_MEMO[role],{scroll:el.scrollTop}); };
    el.addEventListener('scroll',onScroll,{passive:true});
    return ()=>el.removeEventListener('scroll',onScroll);
  },[]);  // eslint-disable-line
  const tone= role==='PCA'?'#6a52d4':'#0090ca';
  const all=store.staff.filter(e=>(e.role||'Nurse')===role);
  const active=all.filter(e=>e.is_active);
  const base=all.filter(e=>showInactive||e.is_active);
  const now=Date.now();
  const matchChip=(e)=>{
    const d=(e.current_department||'');
    switch(chip){
      case 'fav': return !!e.fav;
      case 'missing': return !vaccOK(e.hepatitis_b_vaccination);
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
    if(dept&&staffCanonDept(e.current_department)!==dept)return false;
    if(desig&&staffCanonDesig(e.designation)!==desig)return false;
    if(vacc==='__ok'&&!vaccOK(e.hepatitis_b_vaccination))return false;
    if(vacc==='__gap'&&vaccOK(e.hepatitis_b_vaccination))return false;
    if(vacc&&!vacc.startsWith('__')&&vaccCanon(e.hepatitis_b_vaccination)!==vacc)return false;
    if(qual&&e.qualification!==qual)return false;
    if(training==='has'&&!(e.special_training&&e.special_training.trim()))return false;
    if(training==='none'&&(e.special_training&&e.special_training.trim()))return false;
    if(expB){const y=S.expYears(e); if(y==null)return false;
      if(expB==='<1'&&!(y<1))return false; if(expB==='1-3'&&!(y>=1&&y<3))return false;
      if(expB==='3-5'&&!(y>=3&&y<5))return false; if(expB==='5-10'&&!(y>=5&&y<10))return false;
      if(expB==='10+'&&!(y>=10))return false;}
    return true;
  });
  const sorted=[...filtered].sort((a,b)=>{
    if(sortBy==='exp'){const ya=S.expYears(a),yb=S.expYears(b);
      return (yb==null?-1:yb)-(ya==null?-1:ya)||(a.name||'').localeCompare(b.name||'');}
    if(sortBy==='doj')return (b.doj||'').localeCompare(a.doj||'');
    if(sortBy==='dept')return (a.current_department||'').localeCompare(b.current_department||'')||(a.name||'').localeCompare(b.name||'');
    return (a.name||'').localeCompare(b.name||'');
  });
  const deptOpts=[...new Set(all.map(e=>staffCanonDept(e.current_department)))].sort((a,b)=>a.localeCompare(b));
  const desigOpts=[...new Set(all.map(e=>staffCanonDesig(e.designation)).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
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
        {(!window.unicoCan||window.unicoCan('staff','add'))&&<button className="btn pri sm" style={{background:tone,borderColor:tone}} onClick={()=>setRoute({view:'staffForm',role})}><Ic d={I.plus} s={15}/>Add {role}</button>}
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
        <select style={sel} value={dept} onChange={e=>setDept(e.target.value)}><option value="">All Departments</option>{deptOpts.map(d=><option key={d} value={d}>{staffDeptLabel(d)}</option>)}</select>
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
                  <td style={{textAlign:'left',cursor:'pointer'}} onClick={()=>setRoute({view:'staffProfile',emp:e.id})}><div style={{display:'flex',alignItems:'center',gap:10}}><Avatar photo={e.photo} name={e.name} size={28}/><div><div style={{fontWeight:600,color:'var(--ink)'}}>{e.name}</div>{e.qualification&&<div style={{fontSize:10.5,color:'var(--faint)',fontFamily:"'IBM Plex Sans'"}}>{e.qualification}</div>}</div></div></td>
                  <td style={{textAlign:'left',fontFamily:"'IBM Plex Sans'"}}>{staffCanonDesig(e.designation)||'—'}</td>
                  <td style={{textAlign:'left',fontFamily:"'IBM Plex Sans'"}}>{staffDeptShow(e.current_department)}</td>
                  <td title={e.total_experience_text||''} className="num">{window.STAFF.expLabel(e)}</td>
                  <td style={{textAlign:'left',fontFamily:"'IBM Plex Sans'"}}><span style={{color:vaccColor(e.hepatitis_b_vaccination),fontWeight:600}}>{e.hepatitis_b_vaccination||'Unknown'}</span></td>
                  <td style={{textAlign:'left'}}>{e.phone||<span style={{color:'var(--rose)'}}>—</span>}</td>
                  <td><div style={{display:'flex',gap:6,justifyContent:'flex-end'}}>
                    {(!window.unicoCan||window.unicoCan('staff','edit'))&&<button className="icon-btn" title="Edit" onClick={()=>setRoute({view:'staffForm',emp:e.id})}><Ic d={I.edit} s={14}/></button>}
                    {(!window.unicoCan||window.unicoCan('staff','edit'))&&(e.is_active
                      ? <button className="icon-btn danger" title="Deactivate" onClick={async()=>{
                          const ok=await window.UI.confirm({title:`Deactivate ${e.name}?`,message:'They will be moved off the active roster into Previous Staff. You can restore them anytime.',confirmLabel:'Deactivate'});
                          if(ok){store.remove(e.id);window.UI.toast(e.name+' moved to Previous Staff','success');}
                        }}><Ic d={I.x} s={14}/></button>
                      : <button className="icon-btn" title="Restore" onClick={()=>{store.restore(e.id);window.UI&&window.UI.toast(e.name+' restored to the active roster','success');}} style={{color:'var(--pos)'}}><Ic d={I.check} s={14}/></button>)}
                    {(!window.unicoCan||window.unicoCan('staff','delete'))&&<button className="icon-btn" title="Delete permanently" onClick={async()=>{
                      const ok=await window.UI.confirm({title:`Permanently delete ${e.name}?`,message:'This removes the record entirely and cannot be undone. (Use Deactivate to keep the record.)',danger:true,confirmLabel:'Delete permanently'});
                      if(ok){store.destroy(e.id);window.UI.toast('Staff record deleted','success');}
                    }} style={{color:'#d23a52',background:'#d23a521a',border:'1px solid #d23a5240'}}><Ic d={I.x} s={14} sw={2.6}/></button>}
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

/* ---------------- Previous Staff (archived / former roster) ---------------- */
function PreviousStaff({store, setRoute}){
  const [q,setQ]=React.useState('');
  const [role,setRole]=React.useState('');
  // Anyone off the active roster: import-archived (former) OR deactivated (is_active===false).
  const list=store.staff.filter(e=>e.former||e.is_active===false);
  const fmtd=d=>{ try{ return d?new Date(d).toLocaleDateString():''; }catch(e){ return ''; } };
  const rows=list
    .filter(e=>!role||(e.role||'Nurse')===role)
    .filter(e=>!q||`${e.name} ${e.emp_id||''} ${e.current_department||''}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a,b)=>(b.archived_at||0)-(a.archived_at||0));
  const inp={padding:'8px 11px',border:'1px solid var(--line)',borderRadius:8,fontSize:13,fontFamily:'inherit',background:'#fff',outline:'none'};
  const nurses=list.filter(e=>(e.role||'Nurse')==='Nurse').length, pcas=list.filter(e=>e.role==='PCA').length;
  return (
    <div className="grid" style={{gap:16}}>
      <SectionTitle icon={I.steth} title="Previous Staff"
        sub={`${list.length} inactive staff — archived from an import or deactivated, so off the active roster. Records are kept for history; restore anyone anytime.`}
        right={<input placeholder="Search former staff…" value={q} onChange={e=>setQ(e.target.value)} style={{...inp,minWidth:220}}/>}/>
      <div className="card" style={{overflow:'hidden'}}>
        <div className="card-h">
          <h3>Archived Roster</h3>
          <span className="spacer"/>
          <div className="seg">{[['','All'],['Nurse','Nurses ('+nurses+')'],['PCA','PCA ('+pcas+')']].map(([v,l])=>(<button key={v} className={role===v?'on':''} onClick={()=>setRole(v)}>{l}</button>))}</div>
          <span className="tag num" style={{marginLeft:8}}>{rows.length}</span>
        </div>
        {rows.length===0
          ? <div style={{padding:'34px',textAlign:'center',color:'var(--faint)',fontSize:13}}>No previous staff.</div>
          : <div style={{overflowX:'auto'}}><table className="tbl">
              <thead><tr><th style={{textAlign:'left'}}>Name</th><th>Emp ID</th><th>Role</th><th style={{textAlign:'left'}}>Department</th><th style={{textAlign:'left'}}>Designation</th><th>Archived</th><th style={{textAlign:'left'}}>Reason</th><th></th></tr></thead>
              <tbody>
                {rows.map(e=>(
                  <tr key={e.id} style={{opacity:.9}}>
                    <td style={{textAlign:'left'}}><b style={{color:'var(--ink)'}}>{e.name}</b></td>
                    <td className="num">{e.emp_id||'—'}</td>
                    <td><RoleBadge role={e.role}/></td>
                    <td style={{textAlign:'left'}}>{staffDeptShow(e.current_department)}</td>
                    <td style={{textAlign:'left'}}>{staffCanonDesig(e.designation)||'—'}</td>
                    <td style={{fontSize:12,color:'var(--muted)'}}>{fmtd(e.archived_at)}</td>
                    <td style={{textAlign:'left',fontSize:12,color:'var(--muted)'}}>{e.archived_reason||(e.former?'Not in latest import':'Deactivated')}</td>
                    <td style={{textAlign:'right',whiteSpace:'nowrap'}}>
                      <button className="btn sm" style={{marginRight:5}} onClick={()=>setRoute&&setRoute({view:(e.role==='PCA'?'pca':'nurses')})} title="Open in directory"><Ic d={I.user} s={13}/>View</button>
                      <button className="btn sm pri" onClick={()=>{ (store.restore?store.restore(e.id):store.update(e.id,{is_active:true,former:false,archived_at:null,archived_reason:''})); window.UI&&window.UI.toast(e.name+' restored to the active roster','success'); }}><Ic d={I.check} s={13}/>Restore</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>}
      </div>
      <div style={{fontSize:11.5,color:'var(--muted)',padding:'0 2px',display:'flex',alignItems:'center',gap:6}}>
        <Ic d={I.doc} s={13}/> Restoring a staff member returns them to the active Nurse / PCA roster with all their details intact.
      </div>
    </div>
  );
}

Object.assign(window,{ Avatar, VaccBadge, RoleBadge, vaccColor, WorkforceDashboard, StaffDirectory, StaffCompliance, ManageStaff, PreviousStaff });
