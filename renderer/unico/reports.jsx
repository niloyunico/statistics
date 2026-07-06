/* UNICO — Reports & Settings */
const PAGE_SIZES={A4:[700,1.414],A3:[815,1.414],Letter:[700,1.294]};
const CHART_STYLE_LABEL={bar3d:'3D Bars',bar:'Bar',line:'Line',area:'Area + Target',combo:'Bar + Line',grouped:'Grouped',stacked:'Stacked',pct:'100% Stacked',horizontal:'Horizontal',donut:'Composition'};
const REPORT_STYLES=[['bar3d','3D'],['bar','Bar'],['line','Line'],['area','Area'],['combo','Bar+Line'],['grouped','Grouped'],['stacked','Stacked'],['pct','100%'],['horizontal','Horizontal'],['donut','Donut']];
function reportSeries(d){ return d.cols.filter(c=>c.id!==d.primary&&!c.pct).slice(0,6).map((c,i)=>({id:c.id,label:c.label,color:PALETTE[i%PALETTE.length]})); }
function reportChartEl(d,style,tone,fs,donutData){
  const has=n=>typeof window[n]==='function';
  if(style==='bar') return <BarChart data={fs} x="month" y={d.primary} height={195} color={tone} flat/>;
  if(style==='line') return <LineChart data={fs} x="full" y={d.primary} height={195} color={tone} flat/>;
  if(style==='area'&&has('AreaTargetChart')){ const avg=fs.length?Math.round(fs.reduce((s,r)=>s+(r[d.primary]||0),0)/fs.length):0; return <AreaTargetChart data={fs} x="full" y={d.primary} target={avg} height={200} color={tone} flat/>; }
  if(style==='combo'&&has('ComboChart')){ const pctCol=d.cols.find(c=>c.pct); const lineKey=pctCol?pctCol.id:((d.cols.find(c=>c.id!==d.primary&&!c.pct)||{}).id||d.primary); return <ComboChart data={fs} x="month" barKey={d.primary} lineKey={lineKey} barColor={tone} lineColor="#e08a1e" barLabel={(d.cols.find(c=>c.id===d.primary)||{}).label||'Value'} lineLabel={(d.cols.find(c=>c.id===lineKey)||{}).label||'Trend'} height={210} flat/>; }
  if(style==='grouped'){ const sr=reportSeries(d); return sr.length?<GroupedBar data={fs} x="month" series={sr} height={210}/>:<BarChart data={fs} x="month" y={d.primary} height={195} color={tone} flat/>; }
  if(style==='stacked'){ const sr=reportSeries(d); return sr.length?<StackedBar data={fs} x="month" series={sr} height={210}/>:<BarChart data={fs} x="month" y={d.primary} height={195} color={tone} flat/>; }
  if(style==='pct'&&has('StackedPctBar')){ const sr=reportSeries(d); return sr.length?<StackedPctBar data={fs} x="month" series={sr} height={210} flat/>:<BarChart data={fs} x="month" y={d.primary} height={195} color={tone} flat/>; }
  if(style==='horizontal'&&has('HBarChart')) return <HBarChart data={fs.map(r=>({label:r.full,val:r[d.primary]||0}))} x="label" y="val" height={Math.max(150,fs.length*30)} flat/>;
  if(style==='donut') return donutData.length>1
    ? <div style={{display:'grid',placeItems:'center',minHeight:205}}><Donut data={donutData} size={188} centerValue={fmt(donutData.reduce((s,x)=>s+x.value,0))} centerLabel="Total" flat/></div>
    : <Bar3D data={fs} x="month" y={d.primary} height={205} color={tone} flat/>;
  return <Bar3D data={fs} x="month" y={d.primary} height={205} color={tone} flat/>; // bar3d + default
}

/* ==================================================================
   Monthly Statistics Report — board-ready statistical reporting.
   Mirrors the Quality report (quality-console.jsx qc*) but DIVERGES:
   - no compliance/benchmark/breach concept (statistics has no targets)
   - no incident details
   - HETEROGENEOUS metrics: each dept has its own d.cols / d.primary,
     so the table is grouped-by-department, one row per metric.
   - months are dynamic (d.months + window.UNICO.MONTH_ORDER/MONTHS_FULL),
     not a hardcoded 12-entry MONTHS array.
   Reuses window charts (Spark/BarChart/ComboChart) + #pdf-root export.
   ================================================================== */
const MONO="'IBM Plex Mono',ui-monospace,SFMono-Regular,Menlo,monospace";

function msEsc(s){ return ((s==null?'':s)+'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function msDownload(content, filename, mime){
  try{ const blob=new Blob([content],{type:mime}); const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click();
    setTimeout(()=>{ try{document.body.removeChild(a);}catch(e){} URL.revokeObjectURL(url); },600);
  }catch(e){}
}
// A metric may be absent/null in some months -> null renders as '–' / gap.
function msVal(d, colId, monthKey){
  const r = d.series.find(s=>s.month===monthKey);
  const v = r ? r[colId] : null;
  return (v==null || v==='') ? null : v;
}
// pct columns hold an already-computed percentage; append '%'.
function msFmt(col, v){ return v==null ? '–' : (col.pct ? (fmt(v)+'%') : fmt(v)); }
// Representative (headline) metric for a department.
function msPrimaryCol(d){ return (d.cols||[]).find(c=>c.id===d.primary) || (d.cols||[])[0] || {id:d.primary,label:d.primaryLabel||d.primary}; }

// Full multi-department report HTML — per dept: stat line + one standalone
// table over that dept's OWN d.months axis. No incident section (§5.3).
function msReportHTML(depts){
  const date=new Date().toISOString().slice(0,10);
  // FY label from the real data years, not a hardcoded string.
  const yrs=[...new Set((depts||[]).flatMap(d=>d.months||[]).map(m=>String(m).split('-')[1]).filter(Boolean))].sort();
  const fy=yrs.length?('FY 20'+yrs[0]+'–'+yrs[yrs.length-1]):'FY';
  let body='<h1 style="font-family:Calibri,Arial;color:#0072a3;margin:0 0 2px">UNICO Hospitals — Monthly Statistics Report</h1>'
    +'<div style="font-family:Calibri;color:#555;margin-bottom:12px">'+fy+' · generated '+date+' · Confidential</div>';
  depts.forEach(d=>{
    const pc=msPrimaryCol(d), tot=d.series.reduce((s,r)=>s+(r[d.primary]||0),0), peak=d.series.length?Math.max(...d.series.map(r=>r[d.primary]||0)):0;
    body+='<h2 style="font-family:Calibri;color:#16202e;margin:16px 0 3px">'+msEsc(d.name)+'</h2>'
      +'<div style="font-family:Calibri;color:#555;margin-bottom:6px">Total '+msEsc(pc.label)+': <b>'+fmt(tot)+'</b> · Peak: <b>'+fmt(peak)+'</b> · Metrics: '+d.cols.length+'</div>';
    const th=['Metric'].concat(d.months.map(k=>msEsc((window.UNICO.MONTHS_FULL[k]||k)))).map(h=>'<th style="background:#0090ca;color:#fff;border:1px solid #2b6f9c;padding:5px 7px;font-family:Calibri;font-size:10.5pt;text-align:left">'+h+'</th>').join('');
    const trs=d.cols.map((col,i)=>{
      const cells=['<span style="font-weight:'+(col.id===d.primary?700:400)+'">'+msEsc(col.label)+'</span>']
        .concat(d.series.map(r=>{ const v=r[col.id]; return msEsc(v==null||v===''?'–':(col.pct?fmt(v)+'%':fmt(v))); }));
      return '<tr style="background:'+(i%2?'#eef6fb':'#fff')+'">'+cells.map((c,ci)=>'<td style="border:1px solid #b9c6d2;padding:4px 7px;font-family:Calibri;font-size:10pt;'+(ci?'text-align:center':'')+'">'+c+'</td>').join('')+'</tr>';
    }).join('');
    body+='<table border="1" style="border-collapse:collapse"><thead><tr>'+th+'</tr></thead><tbody>'+trs+'</tbody></table>';
  });
  // Authorisation sign-off — the shared saved names (Prepared / Checked / Approved by)
  const sig=(window.unicoSig&&window.unicoSig.load())||{prepared:'',reviewed:'',approved:''};
  body+='<table style="border-collapse:collapse;width:100%;margin-top:30px"><tr>'
    +[['Prepared by',sig.prepared],['Checked by',sig.reviewed],['Approved by',sig.approved]].map(([role,name])=>
      '<td style="width:33%;padding:0 22px 0 0;border:0"><div style="border-bottom:1.2px solid #16202e;height:36px"></div>'
      +'<div style="font-family:Calibri;font-size:10.5pt;font-weight:700;color:#16202e;margin-top:3px">'+msEsc(name||' ')+'</div>'
      +'<div style="font-family:Calibri;font-size:8.5pt;color:#555;text-transform:uppercase">'+role+'</div></td>').join('')
    +'</tr></table>';
  return body;
}
// PDF / Excel / Word / CSV — buttons ALWAYS export all depts (§5.1).
function msExport(depts, f){
  const base='UNICO-Statistics-Report-'+new Date().toISOString().slice(0,10);
  if(f==='csv'){
    // CSV uses the UNION month axis; blank cells for months a dept lacks (§7.3).
    const AX=[...new Set(depts.flatMap(d=>d.months))].sort((a,b)=>window.UNICO.MONTH_ORDER.indexOf(a)-window.UNICO.MONTH_ORDER.indexOf(b));
    const rows=[['Department','Metric','Type'].concat(AX.map(k=>window.UNICO.MONTHS_FULL[k]||k))];
    depts.forEach(d=>d.cols.forEach(col=>{
      rows.push([d.name, col.label+(col.id===d.primary?' (primary)':''), col.pct?'percent':'count']
        .concat(AX.map(k=>{ const r=d.series.find(s=>s.month===k); const v=r?r[col.id]:null; return (v==null||v==='')?'':(col.pct?v+'%':v); })));
    }));
    msDownload('﻿'+rows.map(r=>r.map(c=>'"'+((c==null?'':c)+'').replace(/"/g,'""')+'"').join(',')).join('\r\n'), base+'.csv','text/csv;charset=utf-8');
    return;
  }
  const html='<html xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><style>@page{size:A4 landscape;margin:1cm}</style></head><body>'+msReportHTML(depts)+'</body></html>';
  if(f==='excel') return msDownload(html, base+'.xls','application/vnd.ms-excel');
  if(f==='word')  return msDownload(html, base+'.doc','application/msword');
  if(f==='pdf'){
    const root=typeof document!=='undefined'?document.getElementById('pdf-root'):null; const native=window.unicoNative;
    if(!root){ try{window.print();}catch(e){} return; }
    root.innerHTML='<div class="pdf-page" style="padding:9mm 10mm;font-family:Calibri,Arial">'+msReportHTML(depts)+'</div>';
    document.body.classList.add('pdf-export-mode');
    const done=()=>{ root.innerHTML=''; document.body.classList.remove('pdf-export-mode'); };
    if(native&&typeof native.exportPDF==='function'){ Promise.resolve(native.exportPDF({pageSize:'A4',landscape:true,defaultName:base})).catch(()=>{}).then(done); }
    else { try{window.print();}catch(e){} setTimeout(done,700); }
  }
}

// Per-row trend sparkline over the dept's OWN month axis (nulls -> 0; §6.3).
function MSSpark({d, colId}){
  const AX=[...new Set(d.months)].sort((a,b)=>window.UNICO.MONTH_ORDER.indexOf(a)-window.UNICO.MONTH_ORDER.indexOf(b));
  const vals=AX.map(k=>{ const r=d.series.find(s=>s.month===k); const v=r?r[colId]:null; return (v==null||v==='')?0:v; });
  if(!vals.some(v=>v>0)) return <span style={{color:'var(--faint)',fontSize:10,fontFamily:MONO}}>–</span>;
  const col = colId===d.primary ? PALETTE[0] : '#3ab5a7';
  return <Spark values={vals} color={col} w={92} h={24} fill={false}/>;
}

// Hand-rolled summed-primary month bar chart over the union axis (fallback / headline).
function MSBars({scope, AX, color=PALETTE[0]}){
  const data=AX.map(k=>({label:k.split('-')[0], v: scope.reduce((s,d)=>{ const r=d.series.find(x=>x.month===k); return s+((r&&r[d.primary])||0); },0)}));
  const max=Math.max(1,...data.map(d=>d.v));
  return (<div style={{display:'flex',alignItems:'flex-end',gap:5,height:180}}>
    {data.map((d,i)=>(<div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4,height:'100%',justifyContent:'flex-end'}}>
      <span style={{fontSize:8.5,fontFamily:MONO,color:'var(--muted)'}}>{d.v||''}</span>
      <div title={d.label+': '+d.v} style={{width:'100%',maxWidth:26,background:d.v?color:'var(--line-2)',borderRadius:'3px 3px 0 0',height:(d.v/max*100)+'%',minHeight:3}}/>
      <span style={{fontSize:8,color:'var(--faint)'}}>{d.label}</span>
    </div>))}
  </div>);
}

function MonthlyStatsReport({depts}){
  const [dept,setDept]=React.useState('all');
  const MF=window.UNICO.MONTHS_FULL, MO=window.UNICO.MONTH_ORDER;
  const scope = dept==='all' ? depts : depts.filter(d=>d.id===dept);
  // union month axis across scope, chronological
  const AX = [...new Set(scope.flatMap(d=>d.months))].sort((a,b)=>MO.indexOf(a)-MO.indexOf(b));
  const scopeName = dept==='all' ? 'All departments' : ((scope[0]&&scope[0].name)||'—');
  const single = dept!=='all' ? scope[0] : null;
  const primaryLabel = single ? (msPrimaryCol(single).label||single.primaryLabel||'Volume') : 'Volume';

  // KPI aggregation over scope, each dept summed on its own primary (§3.1).
  const kpi = scope.reduce((a,d)=>{
    const fs=d.series;
    const tot=fs.reduce((s,r)=>s+(r[d.primary]||0),0);
    const peak=fs.length?Math.max(...fs.map(r=>r[d.primary]||0)):0;
    a.total+=tot; a.peak=Math.max(a.peak,peak); a.months=Math.max(a.months,fs.length);
    return a;
  },{total:0,peak:0,months:0});
  const avg = kpi.months?Math.round(kpi.total/kpi.months):0;
  const metricCount = scope.reduce((n,d)=>n+d.cols.length,0);

  // Combined summed-primary series over AX for the headline all-depts chart (§6.1b).
  const barData = AX.map(k=>({ month:k.split('-')[0], val: scope.reduce((s,d)=>{ const r=d.series.find(x=>x.month===k); return s+((r&&r[d.primary])||0); },0) }));

  const hasCombo = typeof window.ComboChart==='function';
  const cardBox={background:'#fff',border:'1px solid var(--line)',borderRadius:12,padding:'14px 16px',boxShadow:'0 1px 2px rgba(20,32,46,.06)'};
  const EXP=[['pdf','PDF'],['excel','Excel'],['word','Word'],['csv','CSV']];
  const expBtn={display:'inline-flex',alignItems:'center',gap:6,padding:'6px 12px',border:'1px solid var(--line)',borderRadius:7,background:'#fff',color:'var(--ink-2)',fontSize:12,fontWeight:600,cursor:'pointer'};

  // Primary-metric chart for the right card (§6.1 / §6.2).
  const primaryChart=()=>{
    if(single){
      const pctCol=single.cols.find(c=>c.pct);
      const lineKey=pctCol?pctCol.id:single.primary;
      if(hasCombo) return <ComboChart data={single.series} x="month" barKey={single.primary} lineKey={lineKey}
        barLabel={msPrimaryCol(single).label} lineLabel={(single.cols.find(c=>c.id===lineKey)||{}).label||'Trend'}
        barColor={PALETTE[0]} lineColor="#e08a1e" height={210} flat/>;
      return <BarChart data={single.series} x="month" y={single.primary} height={200} color={PALETTE[0]} flat/>;
    }
    // all-departments: bar+line of the summed primary (fall back to bars / MSBars).
    if(hasCombo) return <ComboChart data={barData} x="month" barKey="val" lineKey="val" barLabel="Total" lineLabel="Trend" barColor={PALETTE[0]} lineColor="#e08a1e" height={210} flat/>;
    if(typeof window.BarChart==='function') return <BarChart data={barData} x="month" y="val" height={200} color={PALETTE[0]} flat/>;
    return <MSBars scope={scope} AX={AX} color={PALETTE[0]}/>;
  };

  const firstLabel = AX.length?(MF[AX[0]]||AX[0]):'—';
  const lastLabel = AX.length?(MF[AX[AX.length-1]]||AX[AX.length-1]):'—';
  // FY label derived from the actual data range (never hardcoded).
  const fyLabel = AX.length?('FY 20'+String(AX[0]).split('-')[1]+'–'+String(AX[AX.length-1]).split('-')[1]):'FY —';

  return (
    <div>
      {/* §5 export toolbar — always exports ALL depts (the selector filters the view only) */}
      <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:14,background:'#fff',border:'1px solid var(--line)',borderRadius:10,padding:'10px 13px'}}>
        <span style={{fontSize:12,fontWeight:700,color:'var(--ink)'}}>Export full report (all departments, all metrics):</span>
        {EXP.map(([f,l])=>(
          <button key={f} onClick={()=>msExport(depts,f)} style={expBtn}><Ic d={I.download} s={14}/>{l}</button>
        ))}
        <span style={{flex:1}}/>
        <span style={{fontSize:11,color:'var(--muted)'}}>{depts.length} departments · {depts.reduce((n,d)=>n+d.cols.length,0)} metrics in scope</span>
      </div>

      {/* department scope selector (§3.3) */}
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14,flexWrap:'wrap'}}>
        <span style={{fontSize:12,fontWeight:600,color:'var(--ink-2)'}}>Scope</span>
        <select value={dept} onChange={e=>setDept(e.target.value)} style={{padding:'8px 11px',border:'1px solid var(--line)',borderRadius:8,fontSize:12.5,fontWeight:600,background:'#fff',color:'var(--ink)',outline:'none'}}>
          <option value="all">All departments</option>
          {depts.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      {/* §3 summary cards: KPI block (220px) + primary-metric chart (1fr) */}
      <div style={{display:'grid',gridTemplateColumns:'220px 1fr',gap:14,marginBottom:14}}>
        <div style={{...cardBox,display:'flex',flexDirection:'column',gap:12}}>
          {/* DIVERGENCE: no compliance donut — statistics has no benchmark.
              Show primary-metric KPIs aggregated over scope instead (§3.1/§7.1). */}
          {[['Total',fmt(kpi.total)],['Peak month',fmt(kpi.peak)],['Avg / month',fmt(avg)]].map(([l,v])=>(
            <div key={l}>
              <div style={{fontSize:10,fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.4px'}}>{l}</div>
              <div style={{fontFamily:MONO,fontSize:22,fontWeight:700,color:'var(--ink)'}}>{v}</div>
            </div>
          ))}
          <div style={{fontSize:11,color:'var(--muted)',borderTop:'1px solid var(--line-2)',paddingTop:10}}>
            <b style={{color:'var(--ink)'}}>{metricCount}</b> metrics · {scope.length} department{scope.length!==1?'s':''}
          </div>
          {single&&<div><Delta v={single.delta}/></div>}
        </div>
        <div style={cardBox}>
          <div style={{fontSize:11,fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:10}}>Monthly {primaryLabel} — {scopeName}</div>
          {primaryChart()}
        </div>
      </div>

      {/* §4 month-wise table — grouped by department, one row per metric */}
      <div style={{background:'#fff',border:'1px solid var(--line)',borderRadius:12,boxShadow:'0 1px 2px rgba(20,32,46,.06)',overflow:'hidden'}}>
        <div style={{padding:'14px 18px',borderBottom:'1px solid var(--line-2)',display:'flex',alignItems:'center',gap:14,flexWrap:'wrap',background:'linear-gradient(150deg,#ffffff,#f5fafd)'}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:15,fontWeight:700,color:'var(--ink)'}}>UNICO Hospitals — {scopeName}</div>
            <div style={{fontSize:11.5,color:'var(--muted)'}}>Monthly Statistics Report · {fyLabel} · {firstLabel} – {lastLabel}</div>
          </div>
          {/* DIVERGENCE: no zero-defect/breaches — statistics has no benchmarks (§4.4/§7.1) */}
          <div style={{textAlign:'center'}}>
            <div style={{fontFamily:MONO,fontSize:18,fontWeight:700,color:PALETTE[0]}}>{fmt(kpi.total)}</div>
            <div style={{fontSize:10,color:'var(--faint)',textTransform:'uppercase',letterSpacing:'.4px'}}>total</div>
          </div>
          <div style={{textAlign:'center'}}>
            <div style={{fontFamily:MONO,fontSize:18,fontWeight:700,color:'#3ab5a7'}}>{metricCount}</div>
            <div style={{fontSize:10,color:'var(--faint)',textTransform:'uppercase',letterSpacing:'.4px'}}>metrics</div>
          </div>
        </div>
        <div style={{overflowX:'auto'}}>
          <table style={{borderCollapse:'collapse',fontSize:11,width:'100%',minWidth:380+AX.length*46}}>
            <thead>
              <tr style={{background:'#f7f9fc'}}>
                {dept==='all'&&<th style={{textAlign:'left',padding:'8px 8px',fontSize:9.5,color:'var(--muted)',fontWeight:700,borderBottom:'1px solid var(--line)',background:'#f7f9fc'}}>Dept</th>}
                <th style={{textAlign:'left',padding:'8px 10px',fontSize:10,textTransform:'uppercase',letterSpacing:'.2px',color:'var(--muted)',fontWeight:700,borderBottom:'1px solid var(--line)',background:'#f7f9fc',minWidth:190}}>Metric</th>
                {AX.map(k=><th key={k} style={{textAlign:'center',padding:'8px 4px',fontSize:9,color:'var(--muted)',fontWeight:700,borderBottom:'1px solid var(--line)',background:'#f7f9fc'}}>{k.split('-')[0]}</th>)}
                <th style={{textAlign:'center',padding:'8px 6px',fontSize:9,color:'var(--muted)',fontWeight:700,borderBottom:'1px solid var(--line)',background:'#f7f9fc'}}>Trend</th>
              </tr>
            </thead>
            <tbody>
              {scope.map(d=>d.cols.map(col=>{
                const isPrimary=col.id===d.primary;
                return (
                  <tr key={d.id+'/'+col.id} style={{borderBottom:'1px solid var(--line-2)'}}>
                    {dept==='all'&&<td style={{padding:'6px 8px',textAlign:'left',fontSize:10,color:'var(--muted)',whiteSpace:'nowrap',fontWeight:600}}>{col===d.cols[0]?d.name:''}</td>}
                    <td style={{padding:'7px 10px',textAlign:'left',fontWeight:600,color:'var(--ink)'}}>{col.label}{isPrimary?' ★':''}</td>
                    {AX.map(k=>{
                      const v=msVal(d,col.id,k);
                      const bg = v==null ? 'transparent' : (isPrimary?'#eef6fb':'#f4f6f9');
                      const cc = v==null ? 'var(--faint)' : 'var(--ink)';
                      return (
                        <td key={k} style={{textAlign:'center',padding:'4px 3px'}}>
                          <span style={{display:'inline-block',minWidth:30,padding:'3px 4px',borderRadius:5,background:bg,color:cc,fontFamily:MONO,fontWeight:600,fontSize:10}}>{v==null?'·':msFmt(col,v)}</span>
                        </td>
                      );
                    })}
                    <td style={{textAlign:'center',padding:'4px 6px'}}><MSSpark d={d} colId={col.id}/></td>
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Authorisation sign-off — the same shared saved names every report builder uses */}
      {(()=>{ const sig=(window.unicoSig&&window.unicoSig.load())||{prepared:'',reviewed:'',approved:''};
        return (
          <div style={{...cardBox,marginTop:14}}>
            <div style={{fontSize:9.5,fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:.4,marginBottom:16}}>Authorisation</div>
            <div style={{display:'flex',gap:30}}>
              {[['Prepared by',sig.prepared],['Checked by',sig.reviewed],['Approved by',sig.approved]].map(([role,name])=>(
                <div key={role} style={{flex:1,minWidth:0}}>
                  <div style={{borderBottom:'1px solid var(--ink-2)',height:30}}/>
                  <div style={{fontSize:11,fontWeight:700,color:'var(--ink)',marginTop:4}}>{name||' '}</div>
                  <div style={{fontSize:9.5,color:'var(--muted)',textTransform:'uppercase',letterSpacing:.3}}>{role}</div>
                </div>
              ))}
            </div>
          </div>
        ); })()}
    </div>
  );
}

function Reports({depts}){
  const MO=window.UNICO.MONTH_ORDER, MF=window.UNICO.MONTHS_FULL;
  const [mode,setMode]=React.useState('builder'); // 'builder' | 'monthly'
  const [sel,setSel]=React.useState(depts.slice(0,4).map(d=>d.id));
  const [type,setType]=React.useState('summary');
  const [period,setPeriod]=React.useState({mode:'all'});
  const [chartStyles,setChartStyles]=React.useState(['bar3d']);
  const toggleStyle=s=>setChartStyles(a=>a.includes(s)?(a.length>1?a.filter(x=>x!==s):a):[...a,s]);
  // Header / footer editor
  const [hdrTitle,setHdrTitle]=React.useState('Patient Flow Census');
  const [hdrSub,setHdrSub]=React.useState('');
  const [hospitalName,setHospitalName]=React.useState('UNICO HOSPITALS PLC');
  const [showLogo,setShowLogo]=React.useState(true);
  const [confidential,setConfidential]=React.useState(true);
  const [footerNote,setFooterNote]=React.useState('');
  const [pageSize,setPageSize]=React.useState('A4');
  const [orient,setOrient]=React.useState('portrait');
  const [pageIdx,setPageIdx]=React.useState(0);
  // Prepared / Checked / Approved by — loaded from the SHARED saved set (window.unicoSig)
  // and auto-saved on every edit, so all report builders reuse the same names.
  const [sig,setSig]=React.useState(()=> window.unicoSig?window.unicoSig.load():{prepared:'',reviewed:'',approved:''});
  React.useEffect(()=>{ if(window.unicoSig) window.unicoSig.save(sig); },[sig]);
  const [showSig,setShowSig]=React.useState(true);
  const [showCover,setShowCover]=React.useState(true); // title cover sheet before the content pages
  const toggle=id=>setSel(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);
  const chosen=depts.filter(d=>sel.includes(d.id));

  const allMonths=[...new Set(depts.flatMap(d=>d.months))].sort((a,b)=>MO.indexOf(a)-MO.indexOf(b));
  // Latest calendar year present in the data — drives the Q1/April presets dynamically.
  const lyy = allMonths.length ? String(allMonths[allMonths.length-1]).split('-')[1] : String(new Date().getFullYear()%100);
  const pMonths=(()=>{
    if(period.mode==='q1') return ['Jan-'+lyy,'Feb-'+lyy,'Mar-'+lyy];
    if(period.mode==='apr') return ['Apr-'+lyy];
    if(period.mode==='last6') return allMonths.slice(-6);
    if(period.mode==='custom'){const fi=allMonths.indexOf(period.from||allMonths[0]),ti=allMonths.indexOf(period.to||allMonths[allMonths.length-1]);const a=Math.min(fi,ti),b=Math.max(fi,ti);return allMonths.slice(a,b+1);}
    return allMonths;
  })();
  const pSet=new Set(pMonths);
  const rangeLabel = pMonths.length?`${MF[pMonths[0]]||pMonths[0]} – ${MF[pMonths[pMonths.length-1]]||pMonths[pMonths.length-1]}`:'—';
  const fseriesOf=d=>{const f=d.series.filter(r=>pSet.has(r.month));return f.length?f:d.series;};
  const statOf=(d,fs)=>{const total=fs.reduce((s,r)=>s+(r[d.primary]||0),0);const latest=fs[fs.length-1]||{};const peak=fs.length?Math.max(...fs.map(r=>r[d.primary]||0)):0;const avg=fs.length?Math.round(total/fs.length):0;return {total,latest,peak,avg};};

  const [base,ratio]=PAGE_SIZES[pageSize];
  const portrait=orient==='portrait';
  const pageW=portrait?base:Math.round(base*ratio);
  const pageMinH=portrait?Math.round(base*ratio):base;

  // Page list = optional cover sheet + the content pages; page numbers are ABSOLUTE
  // (cover = page 1) so the printed footer, pager and sig-on-last-page all agree.
  const coverOn = showCover && chosen.length>0;
  const basePages = (type==='compare'||type==='board') ? 1 : Math.max(1,chosen.length);
  const pages = basePages + (coverOn?1:0);
  const pi=Math.min(pageIdx,pages-1);
  const contentIdx = coverOn ? pi-1 : pi;            // -1 = the cover sheet itself
  const pageDept = chosen[Math.max(0,contentIdx)] || depts[0];

  const sel2={padding:'9px 11px',border:'1px solid var(--line)',borderRadius:7,fontSize:13,fontFamily:'inherit',background:'#fff'};
  const fieldLabel=t=><div style={{fontSize:11.5,fontWeight:600,color:'var(--ink-2)',marginBottom:7}}>{t}</div>;

  const Header=()=>(
    <div style={{display:'flex',alignItems:'center',gap:12,borderBottom:'2px solid var(--blue)',paddingBottom:14}}>
      {showLogo&&<img src="unico/logo.svg" alt="UNICO Healthcare" style={{height:38}}/>}
      <div>
        <div style={{fontSize:14,fontWeight:700,color:'var(--ink)'}}>{hdrTitle||'Report'}</div>
        <div style={{fontSize:10.5,color:'var(--muted)',letterSpacing:.4,textTransform:'uppercase',marginTop:2}}>{hdrSub?hdrSub+' · ':''}{rangeLabel}</div>
      </div>
      <div className="spacer"/><div style={{textAlign:'right',fontSize:10,color:'var(--faint)'}}>Generated<br/><b className="num" style={{color:'var(--ink-2)'}}>{new Date().toLocaleDateString('en-US')}</b></div>
    </div>
  );
  const Footer=({n,total})=>(
    <div className="pdf-foot" style={{borderTop:'1px solid var(--line)',paddingTop:8,fontSize:9.5,color:'var(--faint)',display:'flex',flex:'0 0 auto'}}>
      <span>{hospitalName}</span><span className="spacer"/><span>Page {n} of {total}</span><span className="spacer"/><span>{footerNote?footerNote+' · ':''}{confidential?'Confidential · ':''}{pageSize} {orient}</span>
    </div>
  );
  // Authorisation sign-off (Prepared / Checked / Approved by) — rendered on the LAST
  // page of the document when enabled; names come from the shared saved set.
  const SigBlock=()=>(
    <div style={{marginTop:26,pageBreakInside:'avoid'}}>
      <div style={{fontSize:9.5,fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:.4,marginBottom:12}}>Authorisation · {hospitalName}</div>
      <div style={{display:'flex',gap:30}}>
        {[['Prepared by',sig.prepared],['Checked by',sig.reviewed],['Approved by',sig.approved]].map(([role,name])=>(
          <div key={role} style={{flex:1,minWidth:0}}>
            <div style={{borderBottom:'1px solid var(--ink-2)',height:34}}/>
            <div style={{fontSize:11,fontWeight:700,color:'var(--ink)',marginTop:4}}>{name||' '}</div>
            <div style={{fontSize:9.5,color:'var(--muted)',textTransform:'uppercase',letterSpacing:.3}}>{role}</div>
            <div style={{fontSize:8.5,color:'var(--faint)',marginTop:1}}>Signature &amp; date</div>
          </div>
        ))}
      </div>
    </div>
  );

  /* Cover sheet — org name, report title, period + headline stats over the SELECTED
     departments and period (same aggregates BoardPage uses), confidential mark. */
  function CoverPage({n,total}){
    const rows=chosen.map(d=>{const fs=fseriesOf(d);const st=statOf(d,fs);return {d,st,fs};});
    const totAll=rows.reduce((s,r)=>s+r.st.total,0);
    const mTot={}; rows.forEach(({d,fs})=>fs.forEach(r=>{ mTot[r.month]=(mTot[r.month]||0)+(r[d.primary]||0); }));
    const peakM=Object.keys(mTot).sort((a,b)=>mTot[b]-mTot[a])[0];
    const typeLabel={summary:'Department Summary Report',detail:'Detailed Statistical Report',compare:'Cross-Department Comparison',board:'Executive Board Report'}[type]||'Statistical Report';
    return (
      <div className="qc-rpage">
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',textAlign:'center',padding:'60px 20px 30px',flex:'1 0 auto'}}>
          {showLogo&&<img src="unico/logo.svg" alt="UNICO Healthcare" style={{height:66,marginBottom:26}}/>}
          <div style={{fontSize:13,fontWeight:700,color:'var(--blue)',textTransform:'uppercase',letterSpacing:1.5}}>{hospitalName}</div>
          <h1 style={{fontSize:32,fontWeight:700,color:'var(--ink)',margin:'14px 0 6px',letterSpacing:'-.5px'}}>{hdrTitle||'Patient Statistics Report'}</h1>
          <div style={{fontSize:13,color:'var(--muted)'}}>{hdrSub?hdrSub+' · ':''}{typeLabel}</div>
          <div style={{fontSize:14,color:'var(--ink-2)',marginTop:10,fontWeight:600}}>{rangeLabel}</div>
          <div style={{display:'flex',gap:26,marginTop:34,flexWrap:'wrap',justifyContent:'center'}}>
            {[['Departments',String(chosen.length),PALETTE[0]],['Total patients',fmt(totAll),PALETTE[1]],['Peak month',peakM?peakM.split('-')[0]+' 20'+peakM.split('-')[1]:'—',PALETTE[2]],['Months covered',String(pMonths.length),PALETTE[3]]].map(c=>(
              <div key={c[0]} style={{textAlign:'center'}}>
                <div className="num" style={{fontSize:26,fontWeight:700,color:c[2]}}>{c[1]}</div>
                <div style={{fontSize:9.5,color:'var(--muted)',textTransform:'uppercase',letterSpacing:.4,marginTop:2}}>{c[0]}</div>
              </div>
            ))}
          </div>
          {confidential&&<div style={{marginTop:34,fontSize:10.5,color:'var(--rose)',fontWeight:700,textTransform:'uppercase',letterSpacing:1,border:'1px solid #f1c6cd',borderRadius:6,padding:'6px 14px'}}>Confidential — for authorised recipients only</div>}
          <div style={{fontSize:10,color:'var(--faint)',marginTop:20}}>Generated {new Date().toLocaleDateString('en-US')}</div>
        </div>
        <Footer n={n} total={total}/>
      </div>
    );
  }

  function DeptPage({d, n, total}){
    const tone=PALETTE[(d.id.charCodeAt(0))%PALETTE.length];
    const fs=fseriesOf(d); const st=statOf(d,fs);
    const breakdown=d.cols.filter(c=>c.id!==d.primary&&!c.pct);
    const donutData=breakdown.map((c,i)=>({label:c.label,value:fs.reduce((s,r)=>s+(r[c.id]||0),0),color:PALETTE[i%PALETTE.length]})).filter(x=>x.value>0);
    const detailed=type==='detail';
    const ncol=(detailed?d.cols.length:5)+1;
    const tblFont=detailed?(ncol>10?8:ncol>8?8.5:ncol>6?9.5:10.5):11;
    return (
      <div className="qc-rpage">
        <Header/>
        <div style={{marginTop:18}}>
          <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:12}}>
            <Ic d={DEPT_ICON[d.id]||I.activity} s={18} c={tone}/>
            <div style={{fontWeight:700,fontSize:15}}>{d.name}</div>
            <span className="tag">{d.group}</span><span className="spacer"/><Delta v={d.delta}/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:16}}>
            {[['Latest',fmt(st.latest[d.primary]||0)],['Total',fmt(st.total)],['Peak',fmt(st.peak)],['Avg',fmt(st.avg)]].map(([l,v],i)=>(
              <div key={i} style={{background:'var(--panel-2)',borderRadius:7,padding:'9px 11px',borderLeft:'3px solid '+tone}}>
                <div style={{fontSize:9.5,color:'var(--muted)',textTransform:'uppercase',letterSpacing:.3}}>{l}</div>
                <div className="num" style={{fontSize:18,fontWeight:600}}>{v}</div>
              </div>
            ))}
          </div>
          {chartStyles.map((cs,ci)=>(
            <div key={ci} style={{margin:'4px 0 8px'}}>
              {chartStyles.length>1&&<div style={{fontSize:9.5,fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:.4,margin:'8px 0 2px'}}>{CHART_STYLE_LABEL[cs]||cs}</div>}
              {reportChartEl(d,cs,tone,fs,donutData)}
            </div>
          ))}
          {donutData.length>1&&!chartStyles.includes('donut')&&(
            <div style={{display:'flex',alignItems:'center',gap:10,background:'var(--panel-2)',borderRadius:9,padding:'10px 14px',marginTop:6}}>
              <div style={{fontSize:10.5,color:'var(--muted)',textTransform:'uppercase',letterSpacing:.3,fontWeight:600,width:78}}>Composition</div>
              <Donut data={donutData} size={104} thickness={20} flat/>
            </div>
          )}
          <table className={detailed?'tbl rpt':'tbl'} style={{marginTop:14,fontSize:tblFont}}>
            <thead><tr><th>Month</th>{d.cols.slice(0,detailed?d.cols.length:5).map(c=><th key={c.id}>{c.label}</th>)}</tr></thead>
            <tbody>{fs.map((r,i)=>(
              <tr key={i}><td>{detailed?r.month:r.full}</td>{d.cols.slice(0,detailed?d.cols.length:5).map(c=><td key={c.id}>{r[c.id]==null?'–':(c.pct?r[c.id]+'%':fmt(r[c.id]))}</td>)}</tr>
            ))}
            {detailed&&<tr className="tot"><td>TOTAL</td>{d.cols.slice(0,d.cols.length).map(c=><td key={c.id}>{c.pct?'—':fmt(fs.reduce((s,r)=>s+(r[c.id]||0),0))}</td>)}</tr>}
            </tbody>
          </table>
          {showSig&&n===total&&<SigBlock/>}
        </div>
        <Footer n={n} total={total}/>
      </div>
    );
  }

  function ComparePage({n=1,total=1}){
    const rows=chosen.map(d=>{const fs=fseriesOf(d);const st=statOf(d,fs);return {d,st};});
    const hbar=rows.map(({d,st})=>({label:d.short,value:st.total,color:PALETTE[(d.id.charCodeAt(0))%PALETTE.length]})).sort((a,b)=>b.value-a.value);
    return (
      <div className="qc-rpage">
        <Header/>
        <div style={{marginTop:18}}>
          <div style={{fontWeight:700,fontSize:15,marginBottom:12}}>Cross-department comparison · {chosen.length} departments</div>
          <div style={{marginBottom:16}}><HBar rows={hbar}/></div>
          <table className="tbl" style={{fontSize:11.5}}>
            <thead><tr><th>Department</th><th>Service line</th><th>Latest</th><th>Total</th><th>Peak</th><th>Avg</th><th>Trend</th></tr></thead>
            <tbody>{rows.map(({d,st})=>(
              <tr key={d.id}><td>{d.name}</td><td style={{fontFamily:"'IBM Plex Sans'"}}>{d.group}</td>
                <td>{fmt(st.latest[d.primary]||0)}</td><td>{fmt(st.total)}</td><td>{fmt(st.peak)}</td><td>{fmt(st.avg)}</td>
                <td style={{textAlign:'right'}}><Delta v={d.delta}/></td></tr>
            ))}</tbody>
          </table>
          {showSig&&<SigBlock/>}
        </div>
        <Footer n={n} total={total}/>
      </div>
    );
  }

  /* Board Report — hospital-level executive page: headline KPIs, department ranking,
     aggregate monthly trend and share-of-volume table, closed by the authorisation
     sign-off. One page, board-meeting ready. */
  function BoardPage({n=1,total=1}){
    const rows=chosen.map(d=>{const fs=fseriesOf(d);const st=statOf(d,fs);return {d,st,fs};});
    const totAll=rows.reduce((s,r)=>s+r.st.total,0);
    const top=rows.slice().sort((a,b)=>b.st.total-a.st.total)[0];
    // aggregate monthly trend: per month, the summed primary across the chosen departments
    const mTot={}; rows.forEach(({d,fs})=>fs.forEach(r=>{ mTot[r.month]=(mTot[r.month]||0)+(r[d.primary]||0); }));
    const trend=pMonths.filter(m=>mTot[m]!=null).map(m=>({label:m.split('-')[0],val:mTot[m]}));
    const peakM=trend.slice().sort((a,b)=>b.val-a.val)[0];
    const hbar=rows.map(({d,st})=>({label:d.short,value:st.total,color:PALETTE[(d.id.charCodeAt(0))%PALETTE.length]})).sort((a,b)=>b.value-a.value);
    const kpis=[
      ['Total patients',fmt(totAll)],
      ['Departments',String(rows.length)],
      ['Busiest dept',top?top.d.short:'—'],
      ['Peak month',peakM?peakM.label:'—'],
    ];
    return (
      <div className="qc-rpage">
        <Header/>
        <div style={{marginTop:18}}>
          <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:12}}>
            <Ic d={I.doc} s={18} c={PALETTE[0]}/>
            <div style={{fontWeight:700,fontSize:15}}>Executive Board Report</div>
            <span className="tag">{rangeLabel}</span><span className="spacer"/><span className="tag">{rows.length} departments</span>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:16}}>
            {kpis.map(([l,v],i)=>(
              <div key={i} style={{background:'var(--panel-2)',borderRadius:7,padding:'9px 11px',borderLeft:'3px solid '+PALETTE[i%PALETTE.length]}}>
                <div style={{fontSize:9.5,color:'var(--muted)',textTransform:'uppercase',letterSpacing:.3}}>{l}</div>
                <div className="num" style={{fontSize:18,fontWeight:600}}>{v}</div>
              </div>
            ))}
          </div>
          {trend.length>1&&typeof window.BarChart==='function'&&(
            <div style={{margin:'4px 0 12px'}}>
              <div style={{fontSize:9.5,fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:.4,margin:'8px 0 2px'}}>Hospital volume — monthly trend</div>
              {window.BarChart({data:trend,x:'label',y:'val',height:170,color:PALETTE[0],flat:true})}
            </div>
          )}
          <div style={{fontSize:9.5,fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:.4,margin:'8px 0 6px'}}>Department ranking (period total)</div>
          <div style={{marginBottom:14}}><HBar rows={hbar}/></div>
          <table className="tbl" style={{fontSize:11}}>
            <thead><tr><th>Department</th><th>Service line</th><th>Total</th><th>Share</th><th>Avg / month</th><th>Trend</th></tr></thead>
            <tbody>{rows.slice().sort((a,b)=>b.st.total-a.st.total).map(({d,st})=>(
              <tr key={d.id}><td>{d.name}</td><td style={{fontFamily:"'IBM Plex Sans'"}}>{d.group}</td>
                <td>{fmt(st.total)}</td><td>{totAll?Math.round(st.total*100/totAll)+'%':'—'}</td><td>{fmt(st.avg)}</td>
                <td style={{textAlign:'right'}}><Delta v={d.delta}/></td></tr>
            ))}</tbody>
          </table>
          {showSig&&<SigBlock/>}
        </div>
        <Footer n={n} total={total}/>
      </div>
    );
  }

  const [exporting,setExporting]=React.useState(false);
  const [note,setNote]=React.useState(null); // {ok:boolean, text:string}
  const doPrint=()=>{ try{ document.body.classList.add('pdf-export-mode'); window.print(); }catch(e){} finally{ setTimeout(()=>document.body.classList.remove('pdf-export-mode'),500); } };
  const doExport=async()=>{
    const native=window.unicoNative;
    if(!native||typeof native.exportPDF!=='function'){ setNote({ok:false,text:'PDF export is only available in the desktop app.'}); return; }
    if(chosen.length===0){ setNote({ok:false,text:'Select at least one department first.'}); return; }
    setExporting(true); setNote(null);
    document.body.classList.add('pdf-export-mode'); // print only the report (#pdf-root)
    try{
      const res=await native.exportPDF({pageSize, landscape:orient==='landscape', defaultName:`UNICO-${type}-report`});
      if(res&&res.ok) setNote({ok:true,text:'PDF'+(res.path?' saved · '+res.path:' ready — save it from the print dialog')});
      else if(res&&res.canceled){ /* user dismissed the save dialog — stay quiet */ }
      else setNote({ok:false,text:(res&&res.error)||'Export failed.'});
    }catch(e){ setNote({ok:false,text:String(e&&e.message?e.message:e)}); }
    finally{ document.body.classList.remove('pdf-export-mode'); setExporting(false); }
  };
  const pdfRoot = typeof document!=='undefined' ? document.getElementById('pdf-root') : null;

  // Segmented mode toggle — shared by both modes so they stay mutually reachable.
  const hasQualityReports = typeof window.QualityReportsPanel==='function';
  const modeSeg=(
    <div className="seg">
      <button className={mode==='builder'?'on':''} onClick={()=>setMode('builder')}>Report Builder</button>
      <button className={mode==='monthly'?'on':''} onClick={()=>setMode('monthly')}>Monthly Statistics Report</button>
      {hasQualityReports && <button className={mode==='quality'?'on':''} onClick={()=>setMode('quality')}>Quality &amp; Hand Hygiene</button>}
    </div>
  );

  if(mode==='monthly') return (
    <div className="grid" style={{gap:16}}>
      <SectionTitle icon={I.doc} title="Reports" sub="Statistical & board-ready reporting"
        right={modeSeg}/>
      <MonthlyStatsReport depts={depts}/>
    </div>
  );

  if(mode==='quality') return (
    <div className="grid" style={{gap:16}}>
      <SectionTitle icon={I.doc} title="Reports" sub="Quality indicators & Hand Hygiene — board-ready reporting"
        right={modeSeg}/>
      {hasQualityReports
        ? React.createElement(window.QualityReportsPanel)
        : <Card><div style={{padding:24,color:'var(--muted)',textAlign:'center'}}>Quality reports module is not loaded.</div></Card>}
    </div>
  );

  return (
    <div className="grid" style={{gap:16}}>
      <style>{'.qc-rpage{display:flex;flex-direction:column;flex:1 0 auto}.qc-rpage .pdf-foot{margin-top:auto}@media print{.qc-rpage{display:block}.qc-rpage .pdf-foot{margin-top:12px}}'}</style>
      <SectionTitle icon={I.doc} title="Report Builder" sub="Compose and export board-ready statistical reports"
        right={<div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
          {modeSeg}
          <button className="btn sm" onClick={doPrint}><Ic d={I.print} s={15}/>Print</button>
          <button className="btn pri sm" onClick={doExport} disabled={exporting||chosen.length===0}><Ic d={I.download} s={15}/>{exporting?'Exporting…':'Export PDF'}</button>
        </div>}/>
      {note&&(
        <div style={{display:'flex',alignItems:'center',gap:9,padding:'10px 14px',borderRadius:8,fontSize:12.5,fontWeight:600,
          color:note.ok?'var(--pos)':'var(--rose)',background:note.ok?'var(--pos-bg)':'var(--neg-bg)',border:'1px solid '+(note.ok?'#bfe6cd':'#f1c6cd')}}>
          <Ic d={note.ok?I.check:I.x} s={15}/><span style={{wordBreak:'break-all'}}>{note.text}</span>
          <span className="spacer" style={{flex:1}}/>
          <button className="icon-btn" style={{width:24,height:24,border:0,background:'transparent'}} onClick={()=>setNote(null)}><Ic d={I.x} s={13}/></button>
        </div>
      )}
      {pdfRoot && ReactDOM.createPortal(
        <div className={"pdf-doc"+(orient==='portrait'?' portrait':'')}>
          {coverOn && <section className="pdf-page"><CoverPage n={1} total={pages}/></section>}
          {chosen.length>0 && (type==='compare'
            ? <section className="pdf-page"><ComparePage n={coverOn?2:1} total={pages}/></section>
            : type==='board'
            ? <section className="pdf-page"><BoardPage n={coverOn?2:1} total={pages}/></section>
            : chosen.map((d,i)=><section className="pdf-page" key={d.id}><DeptPage d={d} n={i+1+(coverOn?1:0)} total={pages}/></section>))}
        </div>,
        pdfRoot
      )}
      <div className="grid" style={{gridTemplateColumns:'320px 1fr',alignItems:'start'}}>
        {/* config */}
        <div className="card">
          <div className="card-h"><h3>Configuration</h3></div>
          <div className="card-b" style={{display:'flex',flexDirection:'column',gap:16}}>
            <div>
              {fieldLabel('Report type')}
              <div className="seg" style={{width:'100%'}}>
                {[['summary','Summary'],['detail','Detailed'],['compare','Comparison'],['board','Board']].map(([id,l])=>(
                  <button key={id} className={type===id?'on':''} style={{flex:1}} onClick={()=>{setType(id);setPageIdx(0);}}>{l}</button>
                ))}
              </div>
              <div style={{fontSize:11,color:'var(--muted)',marginTop:6}}>
                {type==='summary'?'KPIs + chart, one page per department.':type==='detail'?'Full data table & composition per department.':type==='board'?'Executive board summary — hospital KPIs, ranking, trend + authorisation sign-off.':'All selected departments on one comparison page.'}
              </div>
            </div>
            <div>
              {fieldLabel('Reporting period')}
              <select value={period.mode} onChange={e=>setPeriod({mode:e.target.value,from:allMonths[0],to:allMonths[allMonths.length-1]})} style={{...sel2,width:'100%'}}>
                <option value="all">Full period ({allMonths[0]} – {allMonths[allMonths.length-1]})</option>
                <option value="q1">Q1 20{lyy} (Jan–Mar)</option>
                <option value="apr">April 20{lyy} only</option>
                <option value="last6">Last 6 months</option>
                <option value="custom">Custom range…</option>
              </select>
              {period.mode==='custom'&&(
                <div style={{display:'flex',gap:8,marginTop:8,alignItems:'center'}}>
                  <select value={period.from} onChange={e=>setPeriod(p=>({...p,from:e.target.value}))} style={{...sel2,flex:1}}>{allMonths.map(m=><option key={m} value={m}>{m}</option>)}</select>
                  <span style={{fontSize:12,color:'var(--muted)'}}>to</span>
                  <select value={period.to} onChange={e=>setPeriod(p=>({...p,to:e.target.value}))} style={{...sel2,flex:1}}>{allMonths.map(m=><option key={m} value={m}>{m}</option>)}</select>
                </div>
              )}
            </div>
            <div>
              {fieldLabel('Chart styles — pick one or more (each renders per department)')}
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {REPORT_STYLES.map(([id,l])=>{
                  const on=chartStyles.includes(id);
                  return <button key={id} onClick={()=>toggleStyle(id)}
                    style={{display:'flex',alignItems:'center',gap:4,padding:'5px 10px',borderRadius:20,fontSize:11.5,fontWeight:600,cursor:'pointer',
                      border:'1px solid '+(on?'var(--blue)':'var(--line)'),background:on?'var(--blue-50)':'#fff',color:on?'var(--blue-700)':'var(--muted)'}}>
                    {on&&<Ic d={I.check} s={11} sw={3}/>}{l}</button>;
                })}
              </div>
            </div>
            <div>
              {fieldLabel('Header & footer editor')}
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                <input value={hdrTitle} onChange={e=>setHdrTitle(e.target.value)} placeholder="Report title (header)" style={{...sel2,width:'100%'}}/>
                <input value={hdrSub} onChange={e=>setHdrSub(e.target.value)} placeholder="Subtitle (optional)" style={{...sel2,width:'100%'}}/>
                <input value={hospitalName} onChange={e=>setHospitalName(e.target.value)} placeholder="Footer — hospital / org name" style={{...sel2,width:'100%'}}/>
                <input value={footerNote} onChange={e=>setFooterNote(e.target.value)} placeholder="Footer note (optional)" style={{...sel2,width:'100%'}}/>
                <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>
                  <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'var(--ink-2)'}}><input type="checkbox" checked={showLogo} onChange={e=>setShowLogo(e.target.checked)}/>Show logo</label>
                  <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'var(--ink-2)'}}><input type="checkbox" checked={confidential} onChange={e=>setConfidential(e.target.checked)}/>Confidential mark</label>
                  <label title="A title sheet (org name, report title, period, headline stats) as page 1" style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'var(--ink-2)'}}><input type="checkbox" checked={showCover} onChange={e=>{setShowCover(e.target.checked);setPageIdx(0);}}/>Cover page</label>
                </div>
              </div>
            </div>
            <div>
              {fieldLabel('Signatures — saved automatically, shared with every report')}
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                <input value={sig.prepared} onChange={e=>setSig(s=>({...s,prepared:e.target.value}))} placeholder="Prepared by (name & title)" style={{...sel2,width:'100%'}}/>
                <input value={sig.reviewed} onChange={e=>setSig(s=>({...s,reviewed:e.target.value}))} placeholder="Checked by (name & title)" style={{...sel2,width:'100%'}}/>
                <input value={sig.approved} onChange={e=>setSig(s=>({...s,approved:e.target.value}))} placeholder="Approved by (name & title)" style={{...sel2,width:'100%'}}/>
                <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'var(--ink-2)'}}>
                  <input type="checkbox" checked={showSig} onChange={e=>setShowSig(e.target.checked)}/>Signature block on the last page
                </label>
              </div>
            </div>
            <div>
              {fieldLabel('Page setup')}
              <div style={{display:'flex',gap:8}}>
                <select value={pageSize} onChange={e=>setPageSize(e.target.value)} style={{...sel2,flex:1}}><option>A4</option><option>A3</option><option>Letter</option></select>
                <div className="seg">
                  {[['portrait','Portrait'],['landscape','Landscape']].map(([id,l])=>(
                    <button key={id} className={orient===id?'on':''} onClick={()=>setOrient(id)}>{l}</button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <div style={{fontSize:11.5,fontWeight:600,color:'var(--ink-2)',marginBottom:7,display:'flex'}}>Departments<span className="spacer"/>
                <button onClick={()=>setSel(sel.length===depts.length?[]:depts.map(d=>d.id))} style={{border:0,background:'none',color:'var(--blue)',fontSize:11,fontWeight:600,cursor:'pointer'}}>
                  {sel.length===depts.length?'Clear all':'Select all'}</button>
              </div>
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {depts.map(d=>(
                  <button key={d.id} onClick={()=>toggle(d.id)}
                    style={{display:'flex',alignItems:'center',gap:5,padding:'5px 10px',borderRadius:20,fontSize:11.5,fontWeight:600,cursor:'pointer',
                      border:'1px solid '+(sel.includes(d.id)?'var(--blue)':'var(--line)'),
                      background:sel.includes(d.id)?'var(--blue-50)':'#fff',color:sel.includes(d.id)?'var(--blue-700)':'var(--muted)'}}>
                    {sel.includes(d.id)&&<Ic d={I.check} s={12} sw={3}/>}{d.short}
                  </button>
                ))}
              </div>
            </div>
            <div style={{background:'var(--panel-2)',border:'1px solid var(--line)',borderRadius:8,padding:'11px 13px',fontSize:12,color:'var(--muted)'}}>
              <b style={{color:'var(--ink)'}}>{chosen.length}</b> departments · <b style={{color:'var(--ink)'}}>{type}</b> · {pageSize} {orient} · {pMonths.length} month{pMonths.length!==1?'s':''}
            </div>
          </div>
        </div>

        {/* live preview */}
        <div className="card" style={{padding:0,overflow:'hidden'}}>
          <div className="card-h" style={{background:'var(--panel-2)'}}><h3>Live Preview</h3><span className="sub">{pageSize} · {orient}</span><span className="spacer"/>
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <button className="icon-btn" style={{width:28,height:28}} disabled={pi<=0} onClick={()=>setPageIdx(p=>Math.max(0,p-1))}><Ic d={I.chevR} s={15} style={{transform:'rotate(180deg)'}}/></button>
              <span className="tag num">Page {pi+1} of {pages}</span>
              <button className="icon-btn" style={{width:28,height:28}} disabled={pi>=pages-1} onClick={()=>setPageIdx(p=>Math.min(pages-1,p+1))}><Ic d={I.chevR} s={15}/></button>
            </div>
          </div>
          <div style={{padding:26,background:'#eef1f5',overflowX:'auto'}}>
            <div style={{background:'#fff',borderRadius:4,boxShadow:'0 4px 18px rgba(0,0,0,.12)',padding:'28px 30px',width:pageW,minHeight:pageMinH,boxSizing:'border-box',display:'flex',flexDirection:'column',margin:'0 auto',transition:'width .25s'}}>
              {chosen.length===0?<div style={{textAlign:'center',color:'var(--faint)',padding:'60px 0'}}>Select at least one department.</div>
                : coverOn&&pi===0?<CoverPage n={1} total={pages}/>
                : type==='compare'?<ComparePage n={pi+1} total={pages}/>
                : type==='board'?<BoardPage n={pi+1} total={pages}/>
                : <DeptPage d={pageDept} n={pi+1} total={pages}/>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const UCOLORS=['#0090ca','#3ab5a7','#6a52d4','#e08a1e','#d23a52','#1f9d57'];
const USER_MODS=[['stats','Hospital Statistics'],['entry','Data Entry'],['reports','Reports'],['nurse','Nurse Management'],['pca','PCA Management'],['depts','Manage Departments'],['settings','Settings']];
const USER_ROLES=['Administrator','Manager','Department Head','Data Entry','Read-only'];
const ROLE_PERMS={
  'Administrator':{stats:'edit',entry:'edit',reports:'edit',nurse:'edit',pca:'edit',depts:'edit',settings:'edit'},
  'Manager':{stats:'edit',entry:'edit',reports:'edit',nurse:'edit',pca:'edit',depts:'edit',settings:'view'},
  'Department Head':{stats:'view',entry:'edit',reports:'view',nurse:'edit',pca:'edit',depts:'none',settings:'none'},
  'Data Entry':{stats:'view',entry:'edit',reports:'view',nurse:'none',pca:'none',depts:'none',settings:'none'},
  'Read-only':{stats:'view',entry:'none',reports:'view',nurse:'view',pca:'view',depts:'none',settings:'none'},
};
const inits=n=>(n||'?').split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase();
const permSummary=p=>{const vals=USER_MODS.map(m=>p[m[0]]||'none');const ed=vals.filter(v=>v==='edit').length;
  if(ed===USER_MODS.length)return 'Full access'; if(vals.every(v=>v==='view'||v==='none')&&vals.some(v=>v==='view'))return 'Read-only';
  return `${ed} edit · ${vals.filter(v=>v==='view').length} view`;};

function useUserStore(){
  const KEY='unico_users_v1';
  const seed=()=>[{id:1,name:'Nasif Ahammed Niloy',email:'nasif.niloy@unicohospitals.com',role:'Administrator',status:'active',color:'#0090ca',lastActive:Date.now(),perms:{...ROLE_PERMS['Administrator']}}];
  const [users,setUsers]=React.useState(()=>{try{const s=JSON.parse(localStorage.getItem(KEY));return Array.isArray(s)&&s.length?s:seed();}catch(e){return seed();}});
  React.useEffect(()=>{localStorage.setItem(KEY,JSON.stringify(users));},[users]);
  return {users,
    add:(u)=>setUsers(s=>[...s,{id:Math.max(0,...s.map(x=>x.id))+1,status:'active',color:UCOLORS[s.length%UCOLORS.length],lastActive:null,...u}]),
    update:(id,p)=>setUsers(s=>s.map(x=>x.id===id?{...x,...p}:x)),
    remove:(id)=>setUsers(s=>s.filter(x=>x.id!==id)),
    toggle:(id)=>setUsers(s=>s.map(x=>x.id===id?{...x,status:x.status==='active'?'inactive':'active'}:x))};
}

function UserModal({initial,onClose,onSave}){
  const editing=!!initial;
  const [name,setName]=React.useState(initial?.name||'');
  const [email,setEmail]=React.useState(initial?.email||'');
  const [role,setRole]=React.useState(initial?.role||'Data Entry');
  const [status,setStatus]=React.useState(initial?.status||'active');
  const [perms,setPerms]=React.useState(()=>initial?{...initial.perms}:{...ROLE_PERMS['Data Entry']});
  const [err,setErr]=React.useState('');
  const pickRole=r=>{setRole(r);setPerms({...ROLE_PERMS[r]});};
  const save=()=>{
    if(!name.trim()){setErr('Name is required');return;}
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())){setErr('Enter a valid email');return;}
    onSave({name:name.trim(),email:email.trim().toLowerCase(),role,status,perms},editing);
  };
  return (
    <div className="modal-bg" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="modal">
        <div className="modal-h">
          <div style={{width:30,height:30,borderRadius:8,background:'var(--blue-50)',color:'var(--blue)',display:'grid',placeItems:'center'}}><Ic d={editing?I.edit:I.plus} s={17}/></div>
          <h3>{editing?'Manage User':'Invite User'}</h3><span className="spacer"/>
          <button className="icon-btn" onClick={onClose}><Ic d={I.x} s={16}/></button>
        </div>
        <div style={{padding:20,display:'flex',flexDirection:'column',gap:16}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div className="field"><label>Full name</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Nasif Ahammed Niloy" autoFocus/></div>
            <div className="field"><label>Email</label><input value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@unicohospitals.com"/></div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div className="field"><label>Role</label><select value={role} onChange={e=>pickRole(e.target.value)}>{USER_ROLES.map(r=><option key={r}>{r}</option>)}</select></div>
            <div className="field"><label>Status</label><select value={status} onChange={e=>setStatus(e.target.value)}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
          </div>
          <div>
            <div style={{fontSize:12.5,fontWeight:700,color:'var(--ink)',marginBottom:8}}>Module permissions <span style={{fontWeight:500,color:'var(--muted)',fontSize:11}}>· picking a role sets defaults; fine-tune below</span></div>
            <div style={{display:'flex',flexDirection:'column',gap:7}}>
              {USER_MODS.map(([id,label])=>(
                <div key={id} style={{display:'flex',alignItems:'center',gap:10}}>
                  <span style={{flex:1,fontSize:12.5,color:'var(--ink-2)'}}>{label}</span>
                  <div className="seg">
                    {[['none','None'],['view','View'],['edit','Edit']].map(([v,l])=>(
                      <button key={v} className={(perms[id]||'none')===v?'on':''} onClick={()=>setPerms(p=>({...p,[id]:v}))}>{l}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          {err&&<div style={{fontSize:12,color:'var(--rose)',fontWeight:600}}>{err}</div>}
          <div style={{display:'flex',gap:10,borderTop:'1px solid var(--line-2)',paddingTop:14}}>
            <span className="spacer" style={{flex:1}}/>
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn pri" onClick={save}><Ic d={I.check} s={16} sw={2.4}/>{editing?'Save changes':'Send invite'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function UserManagement(){
  const us=useUserStore();
  const [q,setQ]=React.useState('');
  const [modal,setModal]=React.useState(null);
  const [confirm,setConfirm]=React.useState(null);
  const admins=us.users.filter(u=>u.role==='Administrator'&&u.status==='active').length;
  const filtered=us.users.filter(u=>!q||`${u.name} ${u.email} ${u.role}`.toLowerCase().includes(q.toLowerCase()));
  const onSave=(data,editing)=>{ if(editing) us.update(modal.user.id,data); else us.add(data); setModal(null); };
  const ago=ts=>{ if(!ts)return 'never'; const m=Math.floor((Date.now()-ts)/60000); if(m<1)return 'just now'; if(m<60)return m+'m ago'; const h=Math.floor(m/60); if(h<24)return h+'h ago'; return Math.floor(h/24)+'d ago'; };
  return (
    <div>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
        <div><div style={{fontSize:14,fontWeight:700}}>Users &amp; Roles</div><div style={{fontSize:11.5,color:'var(--muted)'}}>{us.users.length} user{us.users.length!==1?'s':''} · {admins} administrator{admins!==1?'s':''}</div></div>
        <span className="spacer" style={{flex:1}}/>
        <div style={{display:'flex',alignItems:'center',gap:7,background:'var(--panel-2)',border:'1px solid var(--line)',borderRadius:7,padding:'6px 10px',width:190,color:'var(--faint)'}}><Ic d={I.search} s={14}/><input placeholder="Search users…" value={q} onChange={e=>setQ(e.target.value)} style={{border:0,background:'transparent',outline:'none',fontFamily:'inherit',fontSize:12.5,color:'var(--ink)',width:'100%'}}/></div>
        <button className="btn pri sm" onClick={()=>setModal({user:null})}><Ic d={I.plus} s={14}/>Invite user</button>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {filtered.map(u=>(
          <div key={u.id} style={{display:'flex',alignItems:'center',gap:12,padding:'11px 13px',border:'1px solid var(--line)',borderRadius:10,opacity:u.status==='active'?1:.6,flexWrap:'wrap'}}>
            <div className="avatar" style={{background:u.color,width:38,height:38}}>{inits(u.name)}</div>
            <div style={{minWidth:0,flex:'1 1 180px'}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}><span style={{fontSize:13.5,fontWeight:700}}>{u.name}</span>{u.id===1&&<span className="tag" style={{background:'var(--pos-bg)',color:'var(--pos)'}}>You</span>}</div>
              <div style={{fontSize:11.5,color:'var(--muted)'}}>{u.email} · {u.role}</div>
            </div>
            <div style={{textAlign:'right',fontSize:11,color:'var(--faint)'}}>last active<br/><b style={{color:'var(--ink-2)'}}>{ago(u.lastActive)}</b></div>
            <span className="tag" style={{minWidth:74,justifyContent:'center'}}>{permSummary(u.perms)}</span>
            {u.status==='active'?<span className="chip pos">● Active</span>:<span className="chip flat">○ Inactive</span>}
            <button className="btn sm" onClick={()=>setModal({user:u})}>Manage</button>
            <button className="icon-btn" title={u.status==='active'?'Deactivate':'Activate'} onClick={()=>us.toggle(u.id)} disabled={u.id===1}><Ic d={u.status==='active'?I.x:I.check} s={14}/></button>
            <button className="icon-btn danger" title="Remove" onClick={()=>setConfirm(u)} disabled={u.id===1||(u.role==='Administrator'&&admins<=1)}><Ic d={I.x} s={14}/></button>
          </div>
        ))}
        {filtered.length===0&&<div style={{textAlign:'center',color:'var(--faint)',padding:'24px',fontSize:13}}>No users match.</div>}
      </div>
      {modal&&<UserModal initial={modal.user} onClose={()=>setModal(null)} onSave={onSave}/>}
      {confirm&&(
        <div className="modal-bg" onMouseDown={e=>{if(e.target===e.currentTarget)setConfirm(null);}}>
          <div className="modal" style={{width:'min(400px,92vw)'}}><div style={{padding:'22px'}}>
            <div style={{fontSize:15.5,fontWeight:700}}>Remove {confirm.name}?</div>
            <div style={{fontSize:13,color:'var(--muted)',marginTop:4}}>This revokes their access to the platform.</div>
            <div style={{display:'flex',gap:10,marginTop:18}}><span className="spacer" style={{flex:1}}/><button className="btn" onClick={()=>setConfirm(null)}>Cancel</button><button className="btn pri" style={{background:'var(--rose)',borderColor:'var(--rose)'}} onClick={()=>{us.remove(confirm.id);setConfirm(null);}}>Remove</button></div>
          </div></div>
        </div>
      )}
    </div>
  );
}

function Settings({depts, store}){
  const [tab,setTab]=React.useState('general');
  const [dbFile,setDbFile]=React.useState('');
  const native=window.unicoNative;
  React.useEffect(()=>{ if(native&&native.dbPath){ native.dbPath().then(setDbFile).catch(()=>{}); } },[]);

  const doBackup=async()=>{
    if(!native){ window.UI&&window.UI.toast('Backups need the desktop app','warn'); return; }
    try{
      if(window.unicoFlushNow) await window.unicoFlushNow();
      const data=window.unicoSnapshotAll?window.unicoSnapshotAll():undefined;
      const res=await native.backup(data);
      if(res&&res.ok) window.UI.toast('Backup saved to '+(res.path||'file')+' ✓','success');
      else if(!(res&&res.canceled)) window.UI.toast('Backup failed: '+((res&&res.error)||'unknown'),'error');
    }catch(e){ window.UI.toast('Backup failed','error'); }
  };
  const doRestore=async()=>{
    if(!native){ window.UI&&window.UI.toast('Restore needs the desktop app','warn'); return; }
    const ok=await window.UI.confirm({title:'Restore from backup?',message:'This replaces ALL current data — entries, staff, quality, users and settings — with the chosen backup file, then reloads the app.',danger:true,confirmLabel:'Choose file & restore'});
    if(!ok) return;
    try{
      const res=await native.restore();
      if(res&&res.canceled) return;
      if(res&&res.ok&&res.data){
        try{ localStorage.clear(); }catch(e){}
        Object.keys(res.data).forEach(k=>{ try{ localStorage.setItem(k,res.data[k]); }catch(e){} });
        window.UI.toast('Data restored ✓ — reloading…','success');
        setTimeout(()=>location.reload(),800);
      } else window.UI.toast('Restore failed: '+((res&&res.error)||'invalid file'),'error');
    }catch(e){ window.UI.toast('Restore failed','error'); }
  };
  const doClear=async()=>{
    if(!store) return;
    const ok=await window.UI.confirm({title:'Clear entered data?',message:'Removes all manually entered monthly entries. Seeded data is kept.',danger:true,confirmLabel:'Clear entries'});
    if(ok){ store.clearEntries(); window.UI.toast('Entries cleared','success'); }
  };
  const doReset=async()=>{
    if(!store) return;
    const ok=await window.UI.confirm({title:'Reset all customizations?',message:'Removes added / renamed / deleted departments and all entered data. This cannot be undone.',danger:true,confirmLabel:'Reset everything'});
    if(ok){ store.reset(); window.UI.toast('All customizations reset','success'); }
  };

  // App lock (PIN) — backed by window.unicoLock (login.jsx)
  const lock=window.unicoLock;
  const [lockOn,setLockOn]=React.useState(()=>!!(lock&&lock.isEnabled()));
  const [pinMode,setPinMode]=React.useState(false);
  const [pin1,setPin1]=React.useState(''); const [pin2,setPin2]=React.useState('');
  const savePin=()=>{
    if(pin1.length<4){ window.UI.toast('PIN must be at least 4 digits','error'); return; }
    if(pin1!==pin2){ window.UI.toast('PINs do not match','error'); return; }
    lock.setPin(pin1); setLockOn(true); setPinMode(false); setPin1(''); setPin2('');
    window.UI.toast('App lock enabled ✓','success');
  };
  const disableLock=async()=>{
    const ok=await window.UI.confirm({title:'Disable app lock?',message:'The app will no longer require a PIN to open.',danger:true,confirmLabel:'Disable'});
    if(ok){ lock.disable(); setLockOn(false); window.UI.toast('App lock disabled','success'); }
  };

  const row=(label,control)=>(
    <div style={{display:'flex',alignItems:'center',gap:14,padding:'13px 0',borderBottom:'1px solid var(--line-2)'}}>
      <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:'var(--ink)'}}>{label.t}</div><div style={{fontSize:11.5,color:'var(--muted)'}}>{label.s}</div></div>
      {control}
    </div>
  );
  const Toggle=({on=true})=>{const[v,setV]=React.useState(on);return(
    <button onClick={()=>setV(!v)} style={{width:42,height:24,borderRadius:20,border:0,background:v?'var(--blue)':'#cdd6e2',position:'relative',transition:'.2s',cursor:'pointer'}}>
      <span style={{position:'absolute',top:3,left:v?21:3,width:18,height:18,borderRadius:'50%',background:'#fff',transition:'.2s',boxShadow:'0 1px 3px rgba(0,0,0,.3)'}}/></button>);};

  return (
    <div className="grid" style={{gap:16}}>
      <SectionTitle icon={I.gear} title="Settings" sub="Configure the statistics platform"/>
      <div className="grid" style={{gridTemplateColumns:'200px 1fr',alignItems:'start'}}>
        <div className="card" style={{padding:6}}>
          {[['general','General',I.gear],['departments','Departments',I.layers],['users','Users & Roles',I.user],['data','Data & Export',I.doc]].map(([id,l,ic])=>(
            <div key={id} onClick={()=>setTab(id)} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',borderRadius:7,cursor:'pointer',fontSize:13,fontWeight:600,
              background:tab===id?'var(--blue-50)':'transparent',color:tab===id?'var(--blue-700)':'var(--ink-2)'}}>
              <Ic d={ic} s={16}/>{l}
            </div>
          ))}
        </div>
        <div className="card"><div className="card-b">
          {tab==='general'&&<div>
            {row({t:'Hospital name',s:'Shown across the platform and on exports'},<input defaultValue="UNICO Hospitals PLC" style={{padding:'8px 11px',border:'1px solid var(--line)',borderRadius:7,fontFamily:'inherit',fontSize:13,width:230}}/>)}
            {row({t:'Default reporting period',s:'Initial range when opening dashboards'},<select style={{padding:'8px 11px',border:'1px solid var(--line)',borderRadius:7,fontFamily:'inherit',fontSize:13}}><option>Last 9 months</option><option>Year to date</option><option>All time</option></select>)}
            {row({t:'Week starts on',s:'Calendar & trend grouping'},<select style={{padding:'8px 11px',border:'1px solid var(--line)',borderRadius:7,fontFamily:'inherit',fontSize:13}}><option>Sunday</option><option>Monday</option></select>)}
            {row({t:'Auto-validate totals',s:'Block entries where components don’t sum to total'},<Toggle on={true}/>)}
            {row({t:'Confidential watermark',s:'Stamp exported reports'},<Toggle on={true}/>)}
            {lock&&<div style={{padding:'13px 0'}}>
              <div style={{display:'flex',alignItems:'center',gap:14}}>
                <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:'var(--ink)'}}>App lock (PIN)</div><div style={{fontSize:11.5,color:'var(--muted)'}}>Require a PIN each time the app opens{lockOn?' · currently ON':''}</div></div>
                {lockOn
                  ? <div style={{display:'flex',gap:8}}><button className="btn sm" onClick={()=>{setPinMode(true);setPin1('');setPin2('');}}>Change PIN</button><button className="btn sm" style={{color:'var(--rose)',borderColor:'#f1c6cd'}} onClick={disableLock}>Disable</button></div>
                  : (!pinMode&&<button className="btn sm pri" onClick={()=>{setPinMode(true);setPin1('');setPin2('');}}>Enable lock</button>)}
              </div>
              {pinMode&&<div style={{display:'flex',gap:8,marginTop:10,alignItems:'center',flexWrap:'wrap'}}>
                <input type="password" inputMode="numeric" placeholder="New PIN (4+)" value={pin1} onChange={e=>setPin1(e.target.value.replace(/\D/g,''))} style={{padding:'7px 10px',border:'1px solid var(--line)',borderRadius:7,fontFamily:'inherit',fontSize:13,width:130}}/>
                <input type="password" inputMode="numeric" placeholder="Confirm PIN" value={pin2} onChange={e=>setPin2(e.target.value.replace(/\D/g,''))} onKeyDown={e=>{if(e.key==='Enter')savePin();}} style={{padding:'7px 10px',border:'1px solid var(--line)',borderRadius:7,fontFamily:'inherit',fontSize:13,width:130}}/>
                <button className="btn sm pri" onClick={savePin}>Save PIN</button>
                <button className="btn sm" onClick={()=>{setPinMode(false);setPin1('');setPin2('');}}>Cancel</button>
              </div>}
            </div>}
          </div>}
          {tab==='departments'&&<div>
            <div style={{display:'flex',marginBottom:10}}><div style={{fontSize:12.5,color:'var(--muted)'}}>{depts.length} departments configured</div><span className="spacer"/><button className="btn sm pri"><Ic d={I.plus} s={14}/>Add department</button></div>
            <table className="tbl"><thead><tr><th>Department</th><th>Code</th><th>Service line</th><th>Metrics</th><th>Status</th></tr></thead>
              <tbody>{depts.map(d=>(<tr key={d.id}><td>{d.name}</td><td>{d.short}</td><td style={{fontFamily:'IBM Plex Sans'}}>{d.group}</td><td>{d.cols.length}</td>
                <td><span className="chip pos">● Active</span></td></tr>))}</tbody></table>
          </div>}
          {tab==='users'&&<UserManagement/>}
          {tab==='data'&&<div>
            <div style={{fontSize:13,fontWeight:700,color:'var(--ink)',marginBottom:2}}>Backup &amp; restore</div>
            <div style={{fontSize:11.5,color:'var(--muted)',marginBottom:10}}>All data is stored in a local database on this PC. Back it up to a file you can keep safe or move to another PC.</div>
            <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
              <button className="btn pri" onClick={doBackup}><Ic d={I.download} s={15}/>Back up all data…</button>
              <button className="btn" onClick={doRestore}><Ic d={I.upload} s={15}/>Restore from backup…</button>
            </div>
            {dbFile&&<div className="col-chip" style={{marginTop:12,maxWidth:'100%',wordBreak:'break-all'}} title={dbFile}><Ic d={I.doc} s={13}/>Database: {dbFile}</div>}
            <div style={{height:1,background:'var(--line-2)',margin:'16px 0'}}/>
            {row({t:'Export format',s:'Default download type for reports'},<select style={{padding:'8px 11px',border:'1px solid var(--line)',borderRadius:7,fontFamily:'inherit',fontSize:13}}><option>PDF</option><option>Excel (.xlsx)</option><option>CSV</option></select>)}
            {row({t:'Round percentages',s:'Display IPD conversion to 2 decimals'},<Toggle on={true}/>)}
            <div style={{marginTop:14,display:'flex',gap:10,flexWrap:'wrap'}}>
              <button className="btn" style={{color:'var(--rose)',borderColor:'#f1c6cd'}} onClick={doClear}>Clear session entries</button>
              <button className="btn" style={{color:'var(--rose)',borderColor:'#f1c6cd'}} onClick={doReset}>Reset all customizations</button>
            </div>
          </div>}
        </div></div>
      </div>
    </div>
  );
}
window.Reports=Reports; window.Settings=Settings;
