/* UNICO — Reports & Settings */
const PAGE_SIZES={A4:[700,1.414],A3:[815,1.414],Letter:[700,1.294]};
const CHART_STYLE_LABEL={bar3d:'3D Bars',bar:'Bar',line:'Line',area:'Area + Target',combo:'Bar + Line',grouped:'Grouped',stacked:'Stacked',pct:'100% Stacked',horizontal:'Horizontal',donut:'Composition'};
const REPORT_STYLES=[['bar3d','3D'],['bar','Bar'],['line','Line'],['area','Area'],['combo','Bar+Line'],['grouped','Grouped'],['stacked','Stacked'],['pct','100%'],['horizontal','Horizontal'],['donut','Donut']];
function reportSeries(d){ return d.cols.filter(c=>c.id!==d.primary&&!c.pct).slice(0,6).map((c,i)=>({id:c.id,label:c.label,color:PALETTE[i%PALETTE.length]})); }
// TR-IN (transfer-in) is clinically an admission — a patient entering the unit — so the
// TREND + COMPOSITION GRAPHS fold it into "Admission". This is GRAPH-ONLY: the data table
// and KPI figures keep the raw Admission and TR-IN columns. It only fires for
// admission-primary flow departments (MICU/CCU/wards); "total"-primary departments
// (ED, dialysis…) are untouched, since their TR-IN already sits inside the total.
function rptTransferInCol(d){
  return (d.cols||[]).find(c=> c.id!==d.primary && !c.pct && (
    c.id==='tin' || c.id==='trin' || c.id==='tr_in' ||
    /^\s*tr[\s._-]*in\s*$/i.test(c.label||'') || /transfer\s*[-\s]?in/i.test(c.label||'')
  ));
}
function rptAdmitsPrimary(d){
  const pc=(d.cols||[]).find(c=>c.id===d.primary)||{};
  return d.primary==='adm' || d.primary==='admission' || /admission/i.test(pc.label||'') || /admission/i.test(d.primaryLabel||'');
}
// The transfer-in column to fold into the primary "Admission", or null.
function rptMergeTin(d){ return rptAdmitsPrimary(d) ? rptTransferInCol(d) : null; }
// fs rows with TR-IN folded into the primary field, for primary-keyed charts. Raw fs is
// left untouched (tables/KPIs read it); only the returned copy carries the merged primary.
function rptChartRows(d,fs){ const t=rptMergeTin(d); if(!t) return fs; return fs.map(r=>({...r,[d.primary]:(r[d.primary]||0)+(r[t.id]||0)})); }
// Composition donut groups. Most departments have ONE donut = every non-primary count
// column. Dialysis is special: IPD/OPD (patient location) and Conventional/Modi-SLED/SLED
// (dialysis modality) are TWO independent breakdowns of the SAME Total — one combined
// donut double-counts (they'd sum to 2× the total), so split them into two donuts.
function compositionGroups(d, fs){
  const sum=id=>fs.reduce((s,r)=>s+(r[id]||0),0);
  const colBy=id=>(d.cols||[]).find(c=>c.id===id);
  const mk=ids=>ids.map(colBy).filter(Boolean).map((c,i)=>({label:c.label,value:sum(c.id),color:PALETTE[i%PALETTE.length]})).filter(x=>x.value>0);
  if(d.id==='dialysis'){
    return [{title:'Patients',data:mk(['ipd','opd'])},{title:'Dialysis Type',data:mk(['conv','modi','sled'])}].filter(g=>g.data.length>1);
  }
  const tin=rptMergeTin(d);              // transfer-in folded into the Admission slice
  const showAdm=rptAdmitsPrimary(d);     // primary is an admission event, not a running total
  // Non-primary counts, minus the folded TR-IN (it lives inside Admission now).
  const breakdown=(d.cols||[]).filter(c=>c.id!==d.primary && !c.pct && !(tin&&c.id===tin.id));
  let list=breakdown.map(c=>({label:c.label,value:sum(c.id)}));
  if(showAdm){
    // Admission = new admissions + transfer-ins. Without this the donut silently dropped
    // the largest inflow category (its primary), so it never appeared in the composition.
    const pc=colBy(d.primary)||{};
    list=[{label:pc.label||d.primaryLabel||'Admission', value:sum(d.primary)+(tin?sum(tin.id):0)}, ...list];
  }
  const data=list.map((x,i)=>({label:x.label,value:x.value,color:PALETTE[i%PALETTE.length]})).filter(x=>x.value>0);
  return data.length>1?[{title:'Composition',data}]:[];
}
function reportChartEl(d,style,tone,fs,compGroups){
  const has=n=>typeof window[n]==='function';
  if(style==='bar') return <BarChart data={fs} x="month" y={d.primary} height={195} color={tone} flat/>;
  if(style==='line') return <LineChart data={fs} x="full" y={d.primary} height={195} color={tone} flat/>;
  if(style==='area'&&has('AreaTargetChart')){ const avg=fs.length?Math.round(fs.reduce((s,r)=>s+(r[d.primary]||0),0)/fs.length):0; return <AreaTargetChart data={fs} x="full" y={d.primary} target={avg} height={200} color={tone} flat/>; }
  if(style==='combo'&&has('ComboChart')){ const pctCol=d.cols.find(c=>c.pct); const lineKey=pctCol?pctCol.id:((d.cols.find(c=>c.id!==d.primary&&!c.pct)||{}).id||d.primary); return <ComboChart data={fs} x="month" barKey={d.primary} lineKey={lineKey} barColor={tone} lineColor="#e08a1e" barLabel={(d.cols.find(c=>c.id===d.primary)||{}).label||'Value'} lineLabel={(d.cols.find(c=>c.id===lineKey)||{}).label||'Trend'} height={210} flat/>; }
  if(style==='grouped'){ const sr=reportSeries(d); return sr.length?<GroupedBar data={fs} x="month" series={sr} height={210}/>:<BarChart data={fs} x="month" y={d.primary} height={195} color={tone} flat/>; }
  if(style==='stacked'){ const sr=reportSeries(d); return sr.length?<StackedBar data={fs} x="month" series={sr} height={210}/>:<BarChart data={fs} x="month" y={d.primary} height={195} color={tone} flat/>; }
  if(style==='pct'&&has('StackedPctBar')){ const sr=reportSeries(d); return sr.length?<StackedPctBar data={fs} x="month" series={sr} height={210} flat/>:<BarChart data={fs} x="month" y={d.primary} height={195} color={tone} flat/>; }
  if(style==='horizontal'&&has('HBarChart')) return <HBarChart data={fs.map(r=>({label:r.full,val:r[d.primary]||0}))} x="label" y="val" height={Math.max(150,fs.length*30)} flat/>;
  if(style==='donut') return compGroups.length
    ? <div style={{display:'flex',flexWrap:'wrap',gap:18,justifyContent:'space-around',alignItems:'center',minHeight:205}}>{compGroups.map((g,gi)=><div key={gi} style={{display:'grid',placeItems:'center'}}><Donut data={g.data} size={compGroups.length>1?152:188} centerValue={fmt(g.data.reduce((s,x)=>s+x.value,0))} centerLabel={compGroups.length>1?g.title:'Total'} flat/></div>)}</div>
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
  const sig=(window.unicoSig&&window.unicoSig.load())||{prepared:'',reviewed:'',recommended:'',approved:''};
  body+='<table style="border-collapse:collapse;width:100%;margin-top:30px"><tr>'
    +[['Prepared by',sig.prepared],['Checked by',sig.reviewed],['Recommended by',sig.recommended],['Approved by',sig.approved]].map(([role,name])=>
      '<td style="width:25%;padding:0 18px 0 0;border:0"><div style="border-bottom:1.2px solid #16202e;height:36px"></div>'
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

  // KPI aggregation over scope (§3.1). Total = sum of each dept's primary; Peak = the
  // busiest COMBINED month; Avg = total ÷ DISTINCT months in scope. (Previously Avg used
  // the largest single-department month count as the denominator — up to 2× too high when
  // departments reported different months — and Peak used the max single-department month,
  // contradicting the combined chart shown beside it.)
  const monthTotals = AX.map(k=>scope.reduce((s,d)=>{ const r=d.series.find(x=>x.month===k); return s+((r&&r[d.primary])||0); },0));
  const kpi = { total: scope.reduce((a,d)=>a+d.series.reduce((s,r)=>s+(r[d.primary]||0),0),0),
    peak: monthTotals.length?Math.max(...monthTotals):0, months: AX.length };
  const avg = kpi.months?Math.round(kpi.total/kpi.months):0;
  const metricCount = scope.reduce((n,d)=>n+d.cols.length,0);

  // Combined summed-primary series over AX for the headline all-depts chart (§6.1b).
  // Label with the year when the axis spans >1 calendar year (else two "Jan" bars for
  // different years are indistinguishable).
  const multiYr = new Set(AX.map(k=>k.split('-')[1])).size>1;
  const barData = AX.map((k,i)=>({ month: multiYr ? k.split('-')[0]+" '"+k.split('-')[1] : k.split('-')[0], val: monthTotals[i] }));

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
      {(()=>{ const sig=(window.unicoSig&&window.unicoSig.load())||{prepared:'',reviewed:'',recommended:'',approved:''};
        return (
          <div style={{...cardBox,marginTop:14}}>
            <div style={{fontSize:9.5,fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:.4,marginBottom:16}}>Authorisation</div>
            <div style={{display:'flex',gap:30}}>
              {[['Prepared by',sig.prepared],['Checked by',sig.reviewed],['Recommended by',sig.recommended],['Approved by',sig.approved]].map(([role,name])=>(
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

/* EXACT-PREVIEW export — captures the rendered #pdf-root (all report pages) plus the
   page CSS and sends it to the local report service, which renders it to a vector PDF
   with a headless browser. Reproduces every report type / section / chart style /
   customization 1:1 with the on-screen preview. Resolves false so callers fall back to
   the client-side exporters (e.g. on Vercel, where the headless renderer isn't present). */
async function unicoHtmlServerPDF(pageSize, orient, filename){
  try{
    const root = document.getElementById('pdf-root');
    if(!root || !root.querySelector('.pdf-page,.qc-rpage')) return false;
    let css='';
    for(const s of Array.from(document.styleSheets)){
      try{ const r=s.cssRules; for(let i=0;i<r.length;i++) css+=r[i].cssText+'\n'; }catch(_){}
    }
    const norm='@page{size:'+pageSize+' '+(orient==='landscape'?'landscape':'portrait')+';margin:0}'
      +'html,body{margin:0;padding:0;background:#fff}'
      +'.pdf-page,.qc-rpage{width:100%!important;min-height:0!important;box-shadow:none!important;margin:0!important;box-sizing:border-box;page-break-after:always;break-after:page}'
      +'.pdf-page:last-child,.qc-rpage:last-child{page-break-after:auto}';
    const html='<!doctype html><html><head><meta charset="utf-8"><base href="'+location.origin+'/">'
      +'<style>'+css+norm+'</style></head><body class="pdf-export-mode qc-pdfcap">'+root.outerHTML+'</body></html>';
    const res=await fetch('/api/report-pdf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'html',html:html,pageSize:pageSize,orient:orient})});
    const ct=(res.headers.get('content-type')||'').toLowerCase();
    if(res.ok && ct.indexOf('pdf')>=0){
      const blob=await res.blob(), url=URL.createObjectURL(blob), a=document.createElement('a');
      a.href=url; a.download=filename; document.body.appendChild(a); a.click();
      setTimeout(()=>{ try{document.body.removeChild(a);}catch(_){} URL.revokeObjectURL(url); },600);
      return true;
    }
  }catch(e){ try{ console.warn('[html-pdf] failed, falling back:',e); }catch(_){} }
  return false;
}
try{ if(typeof window!=='undefined') window.unicoHtmlServerPDF=unicoHtmlServerPDF; }catch(e){}

function Reports({depts}){
  const MO=window.UNICO.MONTH_ORDER, MF=window.UNICO.MONTHS_FULL;
  const [mode,setMode]=React.useState('builder'); // 'builder' | 'monthly'
  // Remember the LAST report configuration (department pick, type, period, chart styles,
  // header/footer, page setup) so the builder reopens exactly where you left it.
  const RB_KEY='unico_report_builder_v1';
  const RB=(()=>{ try{ const s=JSON.parse(localStorage.getItem(RB_KEY)); return (s&&typeof s==='object')?s:{}; }catch(e){ return {}; } })();
  const [sel,setSel]=React.useState(()=> (Array.isArray(RB.sel)&&RB.sel.length) ? RB.sel.filter(id=>depts.some(d=>d.id===id)) : depts.slice(0,4).map(d=>d.id));
  const [type,setType]=React.useState(RB.type||'summary');
  const [period,setPeriod]=React.useState((RB.period&&typeof RB.period==='object')?RB.period:{mode:'all'});
  const [chartStyles,setChartStyles]=React.useState((Array.isArray(RB.chartStyles)&&RB.chartStyles.length)?RB.chartStyles:['bar3d']);
  const toggleStyle=s=>setChartStyles(a=>a.includes(s)?(a.length>1?a.filter(x=>x!==s):a):[...a,s]);
  // Header / footer editor
  const [hdrTitle,setHdrTitle]=React.useState(RB.hdrTitle!=null?RB.hdrTitle:'Patient Flow Census');
  const [hdrSub,setHdrSub]=React.useState(RB.hdrSub||'');
  const [hospitalName,setHospitalName]=React.useState(RB.hospitalName!=null?RB.hospitalName:'UNICO HOSPITALS PLC');
  const [showLogo,setShowLogo]=React.useState(RB.showLogo!=null?RB.showLogo:true);
  const [confidential,setConfidential]=React.useState(RB.confidential!=null?RB.confidential:true);
  const [footerNote,setFooterNote]=React.useState(RB.footerNote||'');
  const [pageSize,setPageSize]=React.useState(RB.pageSize||'A4');
  const [orient,setOrient]=React.useState(RB.orient||'portrait');
  const [pageIdx,setPageIdx]=React.useState(0);
  // Prepared / Checked / Approved by — loaded from the SHARED saved set (window.unicoSig)
  // and auto-saved on every edit, so all report builders reuse the same names.
  const [sig,setSig]=React.useState(()=> window.unicoSig?window.unicoSig.load():{prepared:'',reviewed:'',recommended:'',approved:''});
  React.useEffect(()=>{ if(window.unicoSig) window.unicoSig.save(sig); },[sig]);
  const [showSig,setShowSig]=React.useState(RB.showSig!=null?RB.showSig:true);
  const [showCover,setShowCover]=React.useState(RB.showCover!=null?RB.showCover:true); // title cover sheet before the content pages
  // Persist the whole config on every change, so the last report generation is restored next visit.
  React.useEffect(()=>{ try{ localStorage.setItem(RB_KEY, JSON.stringify({sel,type,period,chartStyles,hdrTitle,hdrSub,hospitalName,showLogo,confidential,footerNote,pageSize,orient,showSig,showCover})); }catch(e){} },[sel,type,period,chartStyles,hdrTitle,hdrSub,hospitalName,showLogo,confidential,footerNote,pageSize,orient,showSig,showCover]);
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
  // STRICT range filter — no silent fallback: a department with no data inside the
  // selected period must show "no data", not its full history (the old fallback made
  // a narrowed custom range look like it wasn't applied at all).
  const fseriesOf=d=>d.series.filter(r=>pSet.has(r.month));
  const statOf=(d,fs)=>{const total=fs.reduce((s,r)=>s+(r[d.primary]||0),0);const latest=fs[fs.length-1]||{};const peak=fs.length?Math.max(...fs.map(r=>r[d.primary]||0)):0;const avg=fs.length?Math.round(total/fs.length):0;
    // period-scoped trend: last vs previous reported month WITHIN the selected period, so
    // the arrow reflects the report's period rather than the dataset's all-time last two.
    const lv=fs.length?(fs[fs.length-1][d.primary]||0):0, pv=fs.length>1?(fs[fs.length-2][d.primary]||0):0;
    const delta=fs.length<2?0:(pv===0?(lv>0?100:0):Math.round(((lv-pv)/pv)*100));
    return {total,latest,peak,avg,delta};};

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
        {[['Prepared by',sig.prepared],['Checked by',sig.reviewed],['Recommended by',sig.recommended],['Approved by',sig.approved]].map(([role,name])=>(
          <div key={role} style={{flex:1,minWidth:0}}>
            <div style={{borderBottom:'1px solid var(--ink-2)',height:34}}/>
            <div style={{fontSize:11,fontWeight:700,color:'var(--ink)',marginTop:4}}>{name||' '}</div>
            <div style={{fontSize:9.5,color:'var(--muted)',textTransform:'uppercase',letterSpacing:.3}}>{role}</div>
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
          {showSig&&(sig.prepared||sig.reviewed||sig.recommended||sig.approved)&&(
            /* Saved sign-off names on the COVER too — same Authorisation block style as
               the last page (rule line + bold name + role), per the approved design. */
            <div style={{width:'100%',maxWidth:600,textAlign:'left'}}><SigBlock/></div>
          )}
        </div>
        <Footer n={n} total={total}/>
      </div>
    );
  }

  function DeptPage({d, n, total}){
    const tone=PALETTE[(d.id.charCodeAt(0))%PALETTE.length];
    const fs=fseriesOf(d); const st=statOf(d,fs);
    const compGroups=compositionGroups(d,fs);
    const detailed=type==='detail';
    // ALL metric columns, always — the summary table used to slice to the first 5,
    // silently dropping the rest for wide departments (Dialysis lost Total, ER lost
    // half its census). Width is handled by the adaptive font + fixed layout below.
    const ncol=d.cols.length+1;
    const tblFont=ncol>10?8:ncol>8?8.5:ncol>6?9.5:(detailed?10.5:11);
    // Coverage note: the axis only plots REPORTED months, so when the dept's data
    // covers less than the selected period, say so instead of looking broken.
    const partial=fs.length>0&&fs.length<pMonths.length;
    if(fs.length===0){
      return (
        <div className="qc-rpage">
          <Header/>
          <div style={{marginTop:18}}>
            <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:12}}>
              <Ic d={DEPT_ICON[d.id]||I.activity} s={18} c={tone}/>
              <div style={{fontWeight:700,fontSize:15}}>{d.name}</div>
              <span className="tag">{d.group}</span>
            </div>
            <div style={{border:'1px dashed var(--line)',borderRadius:10,padding:'38px 20px',textAlign:'center',color:'var(--muted)',fontSize:12.5}}>
              No data reported for {d.name} in the selected period ({rangeLabel}).
            </div>
            {/* authorisation now shown on the cover page only */}
          </div>
          <Footer n={n} total={total}/>
        </div>
      );
    }
    return (
      <div className="qc-rpage">
        <Header/>
        <div style={{marginTop:18}}>
          <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:12}}>
            <Ic d={DEPT_ICON[d.id]||I.activity} s={18} c={tone}/>
            <div style={{fontWeight:700,fontSize:15}}>{d.name}</div>
            <span className="tag">{d.group}</span><span className="spacer"/><Delta v={st.delta}/>
          </div>
          {partial&&(
            <div style={{fontSize:10,color:'var(--muted)',background:'var(--panel-2)',borderRadius:6,padding:'5px 10px',marginBottom:10}}>
              Reported data covers <b>{fs[0].full} – {fs[fs.length-1].full}</b> ({fs.length} of the {pMonths.length} months in the selected period); months without a report are not plotted.
            </div>
          )}
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:16}}>
            {[[st.latest.full||'Latest',fmt(st.latest[d.primary]||0)],['Total',fmt(st.total)],['Peak',fmt(st.peak)],['Average',fmt(st.avg)]].map(([l,v],i)=>(
              <div key={i} style={{background:'var(--panel-2)',borderRadius:7,padding:'9px 11px',borderLeft:'3px solid '+tone}}>
                <div style={{fontSize:9.5,color:'var(--muted)',textTransform:'uppercase',letterSpacing:.3}}>{l}</div>
                <div className="num" style={{fontSize:18,fontWeight:600}}>{v}</div>
              </div>
            ))}
          </div>
          {chartStyles.map((cs,ci)=>(
            <div key={ci} style={{margin:'4px 0 8px'}}>
              {chartStyles.length>1&&<div style={{fontSize:9.5,fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:.4,margin:'8px 0 2px'}}>{CHART_STYLE_LABEL[cs]||cs}</div>}
              {reportChartEl(d,cs,tone,rptChartRows(d,fs),compGroups)}
            </div>
          ))}
          {!chartStyles.includes('donut')&&compGroups.map((g,gi)=>(
            <div key={gi} style={{display:'flex',alignItems:'center',gap:10,background:'var(--panel-2)',borderRadius:9,padding:'10px 14px',marginTop:6}}>
              <div style={{fontSize:10.5,color:'var(--muted)',textTransform:'uppercase',letterSpacing:.3,fontWeight:600,width:78}}>{g.title}</div>
              <Donut data={g.data} size={104} thickness={20} flat/>
            </div>
          ))}
          <table className={(detailed||ncol>7)?'tbl rpt':'tbl'} style={{marginTop:14,fontSize:tblFont}}>
            <thead><tr><th>Month</th>{d.cols.map(c=><th key={c.id}>{c.label}</th>)}</tr></thead>
            <tbody>{fs.map((r,i)=>(
              <tr key={i}><td>{detailed?r.month:r.full}</td>{d.cols.map(c=><td key={c.id}>{r[c.id]==null?'–':(c.pct?r[c.id]+'%':fmt(r[c.id]))}</td>)}</tr>
            ))}
            {detailed&&<tr className="tot"><td>TOTAL</td>{d.cols.map(c=><td key={c.id}>{c.pct?'—':fmt(fs.reduce((s,r)=>s+(r[c.id]||0),0))}</td>)}</tr>}
            </tbody>
          </table>
          {/* authorisation now shown on the cover page only */}
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
                <td style={{textAlign:'right'}}><Delta v={st.delta}/></td></tr>
            ))}</tbody>
          </table>
          {/* authorisation now shown on the cover page only */}
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
                <td style={{textAlign:'right'}}><Delta v={st.delta}/></td></tr>
            ))}</tbody>
          </table>
          {/* authorisation now shown on the cover page only */}
        </div>
        <Footer n={n} total={total}/>
      </div>
    );
  }

  const [exporting,setExporting]=React.useState(false);
  const [note,setNote]=React.useState(null); // {ok:boolean, text:string}

  /* ================= TRUE VECTOR PDF (web export) =================
     Draws the report with jsPDF primitives in "preview space": every block
     below reproduces the on-screen page (CoverPage / DeptPage / ComparePage /
     BoardPage) coordinate-for-coordinate — the same 10 chart styles, the same
     donut composition, KPI tiles, tag/trend chips and table — scaled uniformly
     from the preview's px page onto the PDF's pt page, so the export looks
     exactly like the live preview. Selectable text, sharp at any zoom, ~100 KB.
     The raster path below remains only as an automatic fallback. */
  const buildVectorPDF=async(J)=>{
    const hx=h=>{const m=/^#?([0-9a-f]{6})$/i.exec(String(h||''));const n=m?parseInt(m[1],16):0x16202e;return [(n>>16)&255,(n>>8)&255,n&255];};
    // theme.css tokens
    const C={ink:hx('#16202e'),ink2:hx('#3c4858'),muted:hx('#6c7a8c'),faint:hx('#9aa6b4'),
      line:hx('#dde3ec'),line2:hx('#e8edf3'),panel2:hx('#f7f9fc'),grid:hx('#eef1f5'),grid3:hx('#e9edf3'),
      blue:hx('#0090ca'),blue700:hx('#0072a3'),blue50:hx('#eef8fc'),rose:hx('#d23a52'),roseLine:hx('#f1c6cd'),
      pos:hx('#1f9d57'),posBg:hx('#e7f6ed'),negBg:hx('#fbe9ec'),slate:hx('#5b6b80'),flatBg:hx('#eef1f5'),white:[255,255,255]};
    const PALV=PALETTE.map(hx);
    // same hexes the on-screen charts use: charts.jsx BAR_COLORS + charts3d.jsx PAL
    const BARC=['#0090ca','#159fbf','#2bb3a3','#46b87e','#7cc35a','#f0a93b','#ef8049','#e85c69','#b65cc6','#6a6fd4'].map(hx);
    const PAL3=['#0090ca','#159fbf','#2bb3a3','#46b87e','#7cc35a','#f0a93b','#ef8049','#e85c69','#e0679b','#b65cc6','#6a6fd4','#4f8df7'].map(hx);
    const lift=(c,p)=>c.map(v=>Math.max(0,Math.min(255,v+p)));   // Bar3D lighten()
    const mixW=(c,a)=>c.map(v=>Math.round(v*a+255*(1-a)));       // svg fill-opacity over white

    const ori=orient==='landscape'?'l':'p';
    const fmtP=pageSize==='A3'?'a3':pageSize==='Letter'?'letter':'a4';
    const doc=new J({orientation:ori,unit:'pt',format:fmtP,compress:true});
    const PW=doc.internal.pageSize.getWidth();
    // ---- preview space: coordinates in preview px, scaled uniformly onto pt.
    // The pt page has the SAME aspect ratio as the preview page (PAGE_SIZES),
    // so one scale factor maps the whole layout 1:1. ----
    const S=PW/pageW, X=v=>v*S;
    const MX=30, MT=28, CWx=pageW-60;              // preview page padding: 28px 30px
    const FOOTY=pageMinH-MT-21;                    // footer border-top y (px)
    const LIMIT=FOOTY-12;                          // content floor before a page break
    const genDate=new Date().toLocaleDateString('en-US');

    const font=(style,size,color)=>{doc.setFont('helvetica',style);doc.setFontSize(size*S);const c=color||C.ink;doc.setTextColor(c[0],c[1],c[2]);};
    const T=(t,x,y,o)=>doc.text(String(t),X(x),X(y),o);
    const tw=t=>doc.getTextWidth(String(t))/S;
    const LN=(x1,y1,x2,y2,c,w2)=>{const cc=c||C.line;doc.setDrawColor(cc[0],cc[1],cc[2]);doc.setLineWidth((w2==null?1:w2)*S);doc.line(X(x1),X(y1),X(x2),X(y2));};
    const FR=(x,y,w2,h2,c,rx,ry)=>{doc.setFillColor(c[0],c[1],c[2]);if(rx)doc.roundedRect(X(x),X(y),X(w2),X(h2),X(rx),X(ry==null?rx:ry),'F');else doc.rect(X(x),X(y),X(w2),X(h2),'F');};
    const TRI=(x1,y1,x2,y2,x3,y3,c)=>{doc.setFillColor(c[0],c[1],c[2]);doc.triangle(X(x1),X(y1),X(x2),X(y2),X(x3),X(y3),'F');};
    const CIRC=(x,y,r,fill,stroke,lw)=>{if(fill)doc.setFillColor(fill[0],fill[1],fill[2]);if(stroke){doc.setDrawColor(stroke[0],stroke[1],stroke[2]);doc.setLineWidth((lw||1)*S);}doc.circle(X(x),X(y),X(r),fill&&stroke?'FD':(fill?'F':'S'));};
    const POLY=(pts,c)=>{if(pts.length<3)return;doc.setFillColor(c[0],c[1],c[2]);
      doc.lines(pts.slice(1).map((p,i)=>[p[0]-pts[i][0],p[1]-pts[i][1]]),X(pts[0][0]),X(pts[0][1]),[S,S],'F',true);};
    const PLINE=(pts,c,lw)=>{if(pts.length<2)return;doc.setDrawColor(c[0],c[1],c[2]);doc.setLineWidth((lw||2)*S);
      try{doc.setLineCap('round');doc.setLineJoin('round');}catch(e){}
      doc.lines(pts.slice(1).map((p,i)=>[p[0]-pts[i][0],p[1]-pts[i][1]]),X(pts[0][0]),X(pts[0][1]),[S,S],'S',false);};
    const clip=(s,w2)=>{s=String(s==null?'–':s);if(tw(s)<=w2)return s;while(s.length>1&&tw(s+'…')>w2)s=s.slice(0,-1);return s+'…';};
    // donut wedge (solid ring segment) via cubic-bezier arc approximation
    const wedge=(cx,cy,rO,rI,a0,a1,c)=>{
      if(a1-a0>=Math.PI*2-1e-4)a1=a0+Math.PI*2-1e-4;
      const pt=(r,a)=>[cx+r*Math.cos(a),cy+r*Math.sin(a)];
      const arc=(r,s0,e0)=>{const out=[];const n=Math.max(1,Math.ceil(Math.abs(e0-s0)/(Math.PI/3)));
        for(let i=0;i<n;i++){const u=s0+(e0-s0)*i/n,v2=s0+(e0-s0)*(i+1)/n,k=(4/3)*Math.tan((v2-u)/4)*r;
          out.push([[cx+r*Math.cos(u)-k*Math.sin(u),cy+r*Math.sin(u)+k*Math.cos(u)],[cx+r*Math.cos(v2)+k*Math.sin(v2),cy+r*Math.sin(v2)-k*Math.cos(v2)],pt(r,v2)]);}
        return out;};
      const start=pt(rO,a0);let cur=start;const segs=[];
      arc(rO,a0,a1).forEach(([c1,c2,p])=>{segs.push([c1[0]-cur[0],c1[1]-cur[1],c2[0]-cur[0],c2[1]-cur[1],p[0]-cur[0],p[1]-cur[1]]);cur=p;});
      const q=pt(rI,a1);segs.push([q[0]-cur[0],q[1]-cur[1]]);cur=q;
      arc(rI,a1,a0).forEach(([c1,c2,p])=>{segs.push([c1[0]-cur[0],c1[1]-cur[1],c2[0]-cur[0],c2[1]-cur[1],p[0]-cur[0],p[1]-cur[1]]);cur=p;});
      doc.setFillColor(c[0],c[1],c[2]);
      doc.lines(segs,X(start[0]),X(start[1]),[S,S],'F',true);
    };

    // brand logo + dept icons: rasterized ONCE at 3x (tiny); all text stays vector
    const logo=showLogo?await new Promise(res=>{try{
      const img=new Image();
      img.onload=()=>{try{const c=document.createElement('canvas');const s3=3;c.width=(img.width||120)*s3;c.height=(img.height||40)*s3;
        c.getContext('2d').drawImage(img,0,0,c.width,c.height);res({d:c.toDataURL('image/png'),w:c.width/s3,h:c.height/s3});}catch(e){res(null);}};
      img.onerror=()=>res(null);img.src='unico/logo.svg';setTimeout(()=>res(null),2500);
    }catch(e){res(null);}}):null;
    const drawLogo=(x,y,h2)=>{if(!logo)return 0;const w2=h2*(logo.w/logo.h);try{doc.addImage(logo.d,'PNG',X(x),X(y),X(w2),X(h2));}catch(e){}return w2;};
    const iconPng=(d,hex)=>{try{const c=document.createElement('canvas');c.width=c.height=72;const g=c.getContext('2d');
      g.scale(3,3);g.strokeStyle=hex;g.lineWidth=1.9;g.lineCap='round';g.lineJoin='round';
      String(d).split('M').filter(Boolean).forEach(seg=>g.stroke(new Path2D('M'+seg)));return c.toDataURL('image/png');}catch(e){return null;}};
    const drawIcon=(d,x,y,s3,hex)=>{const p=iconPng(d,hex);if(p)try{doc.addImage(p,'PNG',X(x),X(y),X(s3),X(s3));}catch(e){}};

    // .tag chip — uppercase blue pill; returns its width
    const tagChip=(x,y,txt)=>{font('bold',10.5,C.blue700);const t2=String(txt||'').toUpperCase();const w2=tw(t2)+16;
      FR(x,y,w2,17,C.blue50,5);T(t2,x+8,y+12);return w2;};
    // Delta ▲/▼/— trend chip (ui.jsx Delta), right edge at xr
    const deltaChip=(xr,y,v)=>{const pos=v>0,neg=v<0;
      const fg=pos?C.pos:neg?C.rose:C.slate,bg=pos?C.posBg:neg?C.negBg:C.flatBg;
      font('bold',11,fg);const t2=Math.abs(v||0)+'%';const w2=9+tw(t2)+16;
      FR(xr-w2,y,w2,18,bg,9);
      const ax=xr-w2+7,ay=y+6.5;
      if(pos)TRI(ax,ay+5,ax+3,ay,ax+6,ay+5,fg);else if(neg)TRI(ax,ay,ax+6,ay,ax+3,ay+5,fg);else FR(ax,ay+2,6,1.6,fg);
      T(t2,ax+9,y+13);return w2;};
    // mixed-weight word-wrapped paragraph (for the coverage note)
    const richText=(segs,x,y,maxW,fs2,lh,color)=>{let cx2=x,cy2=y;
      segs.forEach(([t2,b])=>{String(t2).split(/(\s+)/).forEach(wd=>{if(!wd)return;
        font(b?'bold':'normal',fs2,color);const w2=tw(wd);
        if(cx2+w2>x+maxW&&wd.trim()){cx2=x;cy2+=lh;}
        if(!(!wd.trim()&&cx2===x)){T(wd,cx2,cy2);cx2+=w2;}});});
      return cy2;};

    const pageHeader=()=>{
      let x=MX;
      if(logo){const w2=drawLogo(MX,MT,38);x=MX+w2+12;}
      font('bold',14);T(hdrTitle||'Report',x,MT+16);
      font('normal',10.5,C.muted);doc.text(((hdrSub?hdrSub+' · ':'')+rangeLabel).toUpperCase(),X(x),X(MT+30),{charSpace:0.4*S});
      font('normal',10,C.faint);T('Generated',pageW-MX,MT+12,{align:'right'});
      font('bold',10,C.ink2);T(genDate,pageW-MX,MT+25,{align:'right'});
      LN(MX,MT+52,pageW-MX,MT+52,C.blue,2);
      return MT+52+18;
    };
    const newPage=()=>{doc.addPage(fmtP,ori);return pageHeader();};

    // KPI tiles — panel-2, 3px accent, label + big number (preview: h=56)
    const kpiRow=(y,items)=>{
      const gap=10,w2=(CWx-gap*(items.length-1))/items.length;
      items.forEach((it,i)=>{const x=MX+i*(w2+gap);
        FR(x,y,w2,56,C.panel2,7);FR(x,y,3,56,it.tone,1.5);
        font('normal',9.5,C.muted);doc.text(String(it.label).toUpperCase(),X(x+14),X(y+19),{charSpace:0.3*S});
        font('bold',18,C.ink);T(it.value,x+14,y+41);});
      return y+56+16;
    };

    /* ---------- vector charts: 1:1 ports of the on-screen SVG components ---------- */
    const monthLbl=s=>String(s).replace(/ \d{4}| 20\d\d/,'').slice(0,6);
    const gridLines=(ox,rw,y0,hgt)=>{[0,.25,.5,.75,1].forEach(g=>LN(ox,y0+hgt-20-g*(hgt-44),ox+rw,y0+hgt-20-g*(hgt-44),C.grid,1));};

    // charts3d.jsx Bar3D (flat) — isometric bars, per-month palette, iso floor grid
    const vBar3D=(y0,data,xKey,yKey,hgt)=>{
      const n=Math.max(1,data.length),dx=13,dy=-9;
      const step=Math.max(46,Math.min(78,640/n)),Wv=n*step+dx+10,baseY=hgt-26,bw=Math.min(30,step-22);
      const max=Math.max(1,...data.map(d=>d[yKey]||0));
      const s3=Math.min(CWx/Wv,1),ox=MX+(CWx-Wv*s3)/2,oy=y0+(hgt-hgt*s3)/2;
      const gx=v=>ox+v*s3,gy=v=>oy+v*s3;
      [0,.25,.5,.75,1].forEach(g=>{const gyv=baseY-g*(hgt-58);
        LN(gx(0),gy(gyv),gx(n*step),gy(gyv),C.grid3,s3);
        LN(gx(n*step),gy(gyv),gx(n*step+dx),gy(gyv+dy),C.grid,s3);});
      data.forEach((d,i)=>{
        // zero values keep a 2px stub + label, matching the on-screen Bar3D
        const v=d[yKey]||0,bh=v>0?(v/max)*(hgt-58):2,bx=i*step+12,by=baseY-bh,c=PAL3[i%PAL3.length];
        TRI(gx(bx+bw),gy(by),gx(bx+bw+dx),gy(by+dy),gx(bx+bw+dx),gy(baseY+dy),lift(c,-44));
        TRI(gx(bx+bw),gy(by),gx(bx+bw+dx),gy(baseY+dy),gx(bx+bw),gy(baseY),lift(c,-44));
        TRI(gx(bx),gy(by),gx(bx+dx),gy(by+dy),gx(bx+bw+dx),gy(by+dy),lift(c,46));
        TRI(gx(bx),gy(by),gx(bx+bw+dx),gy(by+dy),gx(bx+bw),gy(by),lift(c,46));
        doc.setFillColor(c[0],c[1],c[2]);const st3=lift(c,-18);doc.setDrawColor(st3[0],st3[1],st3[2]);doc.setLineWidth(0.5*S*s3);
        doc.rect(X(gx(bx)),X(gy(by)),X(bw*s3),X(Math.max(bh,0.1)*s3),'FD');
        font('bold',11*s3,C.ink);T(fmt(v),gx(bx+bw/2+dx/2),gy(by+dy-6),{align:'center'});
        font('normal',9.5*s3,C.faint);T(monthLbl(d[xKey]),gx(bx+bw/2),gy(hgt-6),{align:'center'});});
      return y0+hgt;
    };
    // charts.jsx BarChart (flat) — rounded bars, per-bar colors, value labels
    const vBarFlat=(y0,data,xKey,yKey,hgt)=>{
      const n=Math.max(1,data.length),rw=Math.min(CWx,n*74),sx=rw/(n*54),ox=MX+(CWx-rw)/2;
      const max=Math.max(1,...data.map(d=>d[yKey]||0));
      gridLines(ox,rw,y0,hgt);
      data.forEach((d,i)=>{
        const v=d[yKey]||0,bh=(v/max)*(hgt-44),c=BARC[i%BARC.length];
        const bx=ox+(i*54+14)*sx,bwv=26*sx,by=y0+hgt-20-bh;
        doc.setFillColor(c[0],c[1],c[2]);
        doc.roundedRect(X(bx),X(by),X(bwv),X(Math.max(bh,0.1)),X(Math.min(4,bwv/2)),X(Math.min(4,Math.max(bh,0.1)/2)),'F');
        if(v>0){font('bold',10.5,c);T(fmt(v),bx+bwv/2,by-6,{align:'center'});}
        font('normal',9.5,C.faint);T(monthLbl(d[xKey]),bx+bwv/2,y0+hgt-6,{align:'center'});});
      return y0+hgt;
    };
    // charts.jsx LineChart (flat, area) — soft area + line + points, no x labels
    const vLine=(y0,data,xKey,yKey,tone,hgt)=>{
      const n=data.length;
      if(!n){font('normal',11,C.faint);T('No data',pageW/2,y0+hgt/2,{align:'center'});return y0+hgt;}
      const viewW=Math.max(360,n*60),rw=Math.min(CWx,Math.max(140,n*80)),sx=rw/viewW,ox=MX+(CWx-rw)/2;
      const max=Math.max(1,...data.map(d=>d[yKey]||0));
      const px2=i=>ox+(26+(n<=1?(viewW-52)/2:(i/(n-1))*(viewW-52)))*sx;
      const py2=v=>y0+hgt-22-(v/max)*(hgt-44);
      [0,.25,.5,.75,1].forEach(g=>LN(ox+26*sx,y0+22+g*(hgt-44),ox+(viewW-26)*sx,y0+22+g*(hgt-44),C.grid,1));
      const pts=data.map((d,i)=>[px2(i),py2(d[yKey]||0)]);
      if(n>1){POLY(pts.concat([[pts[n-1][0],y0+hgt-22],[pts[0][0],y0+hgt-22]]),mixW(tone,0.12));PLINE(pts,tone,2.5);}
      pts.forEach(p=>CIRC(p[0],p[1],3.2,C.white,tone,2.5));
      return y0+hgt;
    };
    // charts-extra.jsx AreaTargetChart (flat) — area + dashed target + axes
    const vArea=(y0,data,xKey,yKey,tone,target,hgt)=>{
      const n=Math.max(1,data.length);
      const viewW=Math.max(320,n*60),rw=Math.min(CWx,Math.max(160,n*80)),sx=rw/viewW,ox=MX+(CWx-rw)/2;
      const pad=30,padT=18,plotH=hgt-42;
      const max=Math.max(1,...data.map(d=>+d[yKey]||0),target!=null?target:0);
      const px2=i=>ox+(pad+(n<=1?(viewW-60)/2:(i/(n-1))*(viewW-60)))*sx;
      const py2=v=>y0+padT+plotH-(v/max)*plotH;
      [0,.25,.5,.75,1].forEach(g=>{LN(ox+pad*sx,y0+padT+g*plotH,ox+(viewW-pad)*sx,y0+padT+g*plotH,C.grid,1);
        font('normal',9,C.faint);T(fmt(Math.round(max*(1-g))),ox+(pad-6)*sx,y0+padT+g*plotH+3,{align:'right'});});
      const pts=data.map((d,i)=>[px2(i),py2(+d[yKey]||0)]);
      if(pts.length>1){POLY(pts.concat([[pts[pts.length-1][0],y0+padT+plotH],[pts[0][0],y0+padT+plotH]]),mixW(tone,0.12));PLINE(pts,tone,2.5);}
      if(target!=null){try{doc.setLineDashPattern([5*S,4*S],0);}catch(e){}
        LN(ox+pad*sx,py2(target),ox+(viewW-pad)*sx,py2(target),C.rose,1.5);
        try{doc.setLineDashPattern([],0);}catch(e){}
        font('bold',10,C.rose);T('target '+fmt(target),ox+(viewW-pad)*sx,py2(target)-4,{align:'right'});}
      pts.forEach(p=>CIRC(p[0],p[1],3.2,C.white,tone,2.5));
      data.forEach((d,i)=>{font('normal',9.5,C.faint);T(monthLbl(d[xKey]),px2(i),y0+hgt-6,{align:'center'});});
      return y0+hgt;
    };
    // charts-extra.jsx ComboChart (flat) — legend, dual axes, bars + trend line
    const vCombo=(y0,data,xKey,barKey,lineKey,barC,lineC,barLabel,lineLabel,hgt)=>{
      const n=Math.max(1,data.length);
      font('normal',11.5,C.ink2);
      const t1=String(barLabel||barKey),t2=String(lineLabel||lineKey);
      const lw2=11+6+tw(t1)+18+14+6+tw(t2);let lx=MX+Math.max(0,(CWx-lw2)/2);
      FR(lx,y0+2,11,11,barC,3);T(t1,lx+17,y0+12);lx+=11+6+tw(t1)+18;
      FR(lx,y0+6,14,3,lineC,1.5);T(t2,lx+20,y0+12);
      y0+=21;
      const isPct=/pct|percent|rate/.test(String(lineKey).toLowerCase());
      const padL=42,padR=46,padT=22,plotH=hgt-46;
      const step=Math.max(46,Math.min(82,560/n)),viewW=Math.max(320,n*step+padL+padR);
      const rw=Math.min(CWx,Math.max(260,n*step+padL+padR)),sx=rw/viewW,ox=MX+(CWx-rw)/2;
      const plotW=viewW-padL-padR,baseY=y0+padT+plotH;
      const barMax=Math.max(1,...data.map(d=>+d[barKey]||0));
      const lineMax=Math.max(isPct?100:1,...data.map(d=>+d[lineKey]||0));
      const cx2=i=>ox+(padL+(n<=1?plotW/2:(i+0.5)*plotW/n))*sx;
      const lpy=v=>y0+padT+plotH-(v/lineMax)*plotH;
      [0,.25,.5,.75,1].forEach(g=>{const yy=baseY-g*plotH;
        LN(ox+padL*sx,yy,ox+(viewW-padR)*sx,yy,C.grid,1);
        font('normal',9,C.faint);T(fmt(Math.round(barMax*g)),ox+(padL-6)*sx,yy+3,{align:'right'});
        font('normal',9,lineC);T(isPct?Math.round(lineMax*g)+'%':fmt(Math.round(lineMax*g)),ox+(viewW-padR+6)*sx,yy+3);});
      const bw=Math.min(28,(plotW/n)*0.5)*sx;
      data.forEach((d,i)=>{const v=+d[barKey]||0,bh=(v/barMax)*plotH;
        doc.setFillColor(barC[0],barC[1],barC[2]);
        doc.roundedRect(X(cx2(i)-bw/2),X(baseY-bh),X(bw),X(Math.max(bh,0.1)),X(Math.min(4,bw/2)),X(Math.min(4,Math.max(bh,0.1)/2)),'F');
        if(v>0){font('bold',9.5,barC);T(fmt(v),cx2(i),baseY-bh-5,{align:'center'});}
        font('normal',9.5,C.faint);T(monthLbl(d[xKey]),cx2(i),y0+hgt-6,{align:'center'});});
      const pts=data.map((d,i)=>[cx2(i),lpy(+d[lineKey]||0)]);
      PLINE(pts,lineC,2.5);pts.forEach(p=>CIRC(p[0],p[1],3.4,C.white,lineC,2.5));
      return y0+hgt;
    };
    // charts.jsx GroupedBar — clustered series bars
    const vGrouped=(y0,data,xKey,series,hgt)=>{
      const n=Math.max(1,data.length),ns=Math.max(1,series.length);
      const groupW=Math.max(48,ns*16+18),bw=Math.min(15,(groupW-14)/ns-3);
      const rw=Math.min(CWx,n*Math.max(70,groupW)),sx=rw/(n*groupW),ox=MX+(CWx-rw)/2;
      const max=Math.max(1,...data.flatMap(d=>series.map(s3=>d[s3.id]||0)));
      gridLines(ox,rw,y0,hgt);
      data.forEach((d,gi)=>{
        series.forEach((s3,si)=>{const v=d[s3.id]||0,h2=(v/max)*(hgt-44);if(h2<=0)return;
          const c=hx(s3.color),bx=ox+(gi*groupW+9+si*(bw+3))*sx,by=y0+hgt-20-h2;
          doc.setFillColor(c[0],c[1],c[2]);
          doc.roundedRect(X(bx),X(by),X(bw*sx),X(h2),X(Math.min(3,bw*sx/2)),X(Math.min(3,h2/2)),'F');});
        font('normal',9.5,C.faint);T(monthLbl(d[xKey]),ox+(gi*groupW+groupW/2)*sx,y0+hgt-6,{align:'center'});});
      return y0+hgt;
    };
    // charts.jsx StackedBar — stacked series, rounded top segment
    const vStacked=(y0,data,xKey,series,hgt)=>{
      const n=Math.max(1,data.length);
      const step=Math.max(40,Math.min(70,600/n)),rw=Math.min(CWx,n*Math.max(64,step)),sx=rw/(n*step),ox=MX+(CWx-rw)/2;
      const totals=data.map(d=>series.reduce((s3,k)=>s3+(d[k.id]||0),0));
      const max=Math.max(1,...totals);
      gridLines(ox,rw,y0,hgt);
      data.forEach((d,gi)=>{
        let acc=0;const bx=ox+(gi*step+(step-24)/2)*sx,bwv=24*sx;
        series.forEach((s3,si)=>{const v=d[s3.id]||0,h2=(v/max)*(hgt-44);if(h2<=0)return;
          const by=y0+hgt-20-acc-h2;acc+=h2;const c=hx(s3.color);
          doc.setFillColor(c[0],c[1],c[2]);
          if(si===series.length-1)doc.roundedRect(X(bx),X(by),X(bwv),X(h2),X(Math.min(3,bwv/2)),X(Math.min(3,h2/2)),'F');
          else doc.rect(X(bx),X(by),X(bwv),X(h2),'F');});
        font('normal',9.5,C.faint);T(monthLbl(d[xKey]),ox+(gi*step+step/2)*sx,y0+hgt-6,{align:'center'});});
      return y0+hgt;
    };
    // charts-extra.jsx StackedPctBar — legend + 100% normalized stacks + % axis
    const vPct=(y0,data,xKey,series,hgt)=>{
      const items=series.map((s3,i)=>({t:String(s3.label||s3.id),c:hx(s3.color||PALETTE[i%PALETTE.length])}));
      font('normal',11.5,C.ink2);
      const totW=items.reduce((a,it)=>a+11+6+tw(it.t),0)+14*(items.length-1);
      let lx=MX+Math.max(0,(CWx-totW)/2),ly=y0+2;
      items.forEach(it=>{const w2=11+6+tw(it.t);
        if(lx+w2>MX+CWx){lx=MX;ly+=16;}
        FR(lx,ly,11,11,it.c,3);font('normal',11.5,C.ink2);T(it.t,lx+17,ly+9.5);lx+=w2+14;});
      y0=ly+19;
      const n=Math.max(1,data.length),padT=16,plotH=hgt-40;
      const step=Math.max(40,Math.min(74,560/n)),viewW=Math.max(280,n*step);
      const rw=Math.min(CWx,Math.max(260,n*Math.max(64,step))),sx=rw/viewW,ox=MX+(CWx-rw)/2;
      const totals=data.map(d=>series.reduce((s3,k)=>s3+(+d[k.id]||0),0));
      const baseY=y0+padT+plotH;
      [0,.25,.5,.75,1].forEach(g=>{LN(ox,baseY-g*plotH,ox+rw,baseY-g*plotH,C.grid,1);
        font('normal',9,C.faint);T(Math.round(g*100)+'%',ox+2*sx,baseY-g*plotH-2);});
      data.forEach((d,gi)=>{const tot=totals[gi]||0,bwp=Math.min(26,step*0.5),bwv=bwp*sx,bx=ox+(gi*step+(step-bwp)/2)*sx;
        let acc=0;
        series.forEach((s3,si)=>{const v=+d[s3.id]||0,frac=tot?v/tot:0,h2=frac*plotH;if(h2<=0)return;
          const by=baseY-acc-h2;acc+=h2;const c=hx(s3.color||PALETTE[si%PALETTE.length]);
          doc.setFillColor(c[0],c[1],c[2]);
          if(si===series.length-1)doc.roundedRect(X(bx),X(by),X(bwv),X(h2),X(Math.min(3,bwv/2)),X(Math.min(3,h2/2)),'F');
          else doc.rect(X(bx),X(by),X(bwv),X(h2),'F');});
        font('normal',9.5,C.faint);T(monthLbl(d[xKey]),ox+(gi*step+step/2)*sx,y0+hgt-6,{align:'center'});});
      return y0+hgt;
    };
    // charts.jsx HBar / charts-extra.jsx HBarChart — label · track · value rows.
    // Paginates per row (a 16-department ranking on landscape would otherwise
    // run under the footer and clip past the page edge).
    const vHBarRows=(y0,rows)=>{
      const max=Math.max(1,...rows.map(r=>r.value));
      let y=y0;
      rows.forEach(r=>{
        if(y+20>LIMIT)y=newPage();
        font('bold',12,C.ink2);T(clip(r.label,116),MX,y+12);
        const tx=MX+130,twd=CWx-130-64;
        FR(tx,y+1.5,twd,15,C.grid,5);
        if(r.value>0)FR(tx,y+1.5,Math.max(4,twd*(r.value/max)),15,r.color,5);
        font('bold',12.5,C.ink);T(fmt(r.value),MX+CWx,y+12.5,{align:'right'});
        y+=24;});
      return y-9+4;
    };
    // charts.jsx Donut (flat) — wedge ring + centre value + legend
    const vDonut=(x,y,size,thickness,data,centerValue,centerLabel)=>{
      const total=data.reduce((s3,d)=>s3+d.value,0)||1;
      const cx2=x+size/2,cy2=y+size/2,rO=size/2,rI=size/2-thickness;
      let ang=-Math.PI/2;
      data.forEach((d,i)=>{const frac=d.value/total,a1=ang+frac*2*Math.PI;
        if(frac>0)wedge(cx2,cy2,rO,rI,ang,a1,hx(d.color||PALETTE[i%PALETTE.length]));ang=a1;});
      if(centerValue!=null){font('bold',24,C.ink);T(centerValue,cx2,cy2+3,{align:'center'});
        font('normal',10,C.muted);doc.text(String(centerLabel||'').toUpperCase(),X(cx2),X(cy2+16),{align:'center',charSpace:0.4*S});}
    };
    const donutLegend=(x,y,data)=>{
      data.forEach((d,i)=>{const ry=y+i*21;
        FR(x,ry,9,9,hx(d.color||PALETTE[i%PALETTE.length]),3);
        font('normal',12,C.ink2);T(d.label,x+17,ry+9);});
      // values right-aligned in a second pass so the column lines up
      font('bold',12,C.ink);
      const labW=Math.max(...data.map(d=>tw(d.label)));
      const w2=9+8+labW+14+Math.max(...data.map(d=>tw(fmt(d.value))));
      data.forEach((d,i)=>{font('bold',12,C.ink);T(fmt(d.value),x+w2,y+i*21+9,{align:'right'});});
      return w2;
    };
    const donutLegendW=data=>{font('normal',12,C.ink2);
      const labW=Math.max(...data.map(d=>tw(d.label)));
      font('bold',12,C.ink);
      return 9+8+labW+14+Math.max(...data.map(d=>tw(fmt(d.value))));};
    // reportChartEl 'donut' style — centered donut + legend
    const vDonutBlock=(y0,data,hgt)=>{
      const legW=donutLegendW(data),size=188,legH=data.length*21-6;
      const x0=MX+Math.max(0,(CWx-(size+18+legW))/2),blockH=Math.max(hgt,size);
      vDonut(x0,y0+(blockH-size)/2,size,30,data,fmt(data.reduce((s3,d)=>s3+d.value,0)),'Total');
      donutLegend(x0+size+18,y0+(blockH-legH)/2,data);
      return y0+blockH;
    };
    // DeptPage composition strip — grey box, small donut + legend
    const compositionStrip=(y0,data,title)=>{
      const legH=data.length*21-6,boxH=Math.max(124,legH+20);
      FR(MX,y0,CWx,boxH,C.panel2,9);
      font('bold',10.5,C.muted);doc.text(String(title||'COMPOSITION').toUpperCase(),X(MX+14),X(y0+boxH/2+3),{charSpace:0.3*S});
      const dx0=MX+14+78+10;
      vDonut(dx0,y0+(boxH-104)/2,104,20,data,null,null);
      donutLegend(dx0+104+18,y0+(boxH-legH)/2,data);
      return y0+boxH;
    };

    // theme.css table.tbl / .tbl.rpt — wrapped headers, right-aligned numeric cells
    const vTable=(y,heads,widths,rows,o)=>{
      o=o||{};
      const fs2=o.fs||12.5,rpt=!!o.rpt;
      const hfs=rpt?fs2:10.5,padX=rpt?6:12,padY=rpt?5:8;
      const rowH=Math.round(fs2*1.3+padY*2),lh=hfs*1.18;
      const xs=[];let ax=MX;widths.forEach(w2=>{xs.push(ax);ax+=w2;});
      const drawHead=(yy)=>{
        font('bold',hfs,C.muted);
        const wrapped=heads.map((h2,i)=>doc.splitTextToSize(String(h2).toUpperCase(),X(Math.max(10,widths[i]-padX-4))));
        const maxL=Math.max(1,...wrapped.map(w2=>w2.length));
        const hH=Math.round(maxL*lh+padY*2+2);
        FR(MX,yy,CWx,hH,C.panel2);
        wrapped.forEach((lines,i)=>{const right=i>0;
          const tx=right?xs[i]+widths[i]-padX:xs[i]+padX;
          const sy=yy+hH-padY-3-(lines.length-1)*lh;
          lines.forEach((ln2,li)=>T(ln2,tx,sy+li*lh,right?{align:'right'}:undefined));});
        LN(MX,yy+hH,MX+CWx,yy+hH,C.line,1);
        return yy+hH;
      };
      // the initial header must also fit (with at least one row) above the footer,
      // else it would paint across the footer rule and duplicate on the next page
      {
        font('bold',hfs,C.muted);
        const wrapped0=heads.map((h2,i)=>doc.splitTextToSize(String(h2).toUpperCase(),X(Math.max(10,widths[i]-padX-4))));
        const hH0=Math.round(Math.max(1,...wrapped0.map(w2=>w2.length))*lh+padY*2+2);
        if(y+hH0+rowH>LIMIT)y=newPage();
      }
      y=drawHead(y);
      rows.forEach((r,ri)=>{
        if(y+rowH>LIMIT){y=newPage();y=drawHead(y);}
        const tot=o.totalRow&&ri===rows.length-1;
        if(tot){FR(MX,y,CWx,rowH,C.panel2);LN(MX,y,MX+CWx,y,C.line,2);}
        r.forEach((cell,ci)=>{
          if(o.deltaCol===ci){deltaChip(xs[ci]+widths[ci]-padX,y+(rowH-18)/2,Number(cell)||0);return;}
          const right=ci>0;
          font(ci===0||tot?'bold':'normal',fs2,tot?C.ink:(ci===0?C.ink:C.ink2));
          T(clip(cell,widths[ci]-padX-4),right?xs[ci]+widths[ci]-padX:xs[ci]+padX,y+rowH-padY-fs2*0.24,right?{align:'right'}:undefined);
        });
        LN(MX,y+rowH,MX+CWx,y+rowH,C.line2,1);
        y+=rowH;
      });
      return y;
    };

    // Authorisation sign-off (SigBlock) — includes its own 26px top margin
    const sigBlockAt=(x0,wAll,y)=>{
      y+=26;
      font('bold',9.5,C.muted);doc.text(('Authorisation · '+hospitalName).toUpperCase(),X(x0),X(y+9),{charSpace:0.4*S});
      const gap=22,w3=(wAll-3*gap)/4,ly=y+9+12+34;
      [['Prepared by',sig.prepared],['Checked by',sig.reviewed],['Recommended by',sig.recommended],['Approved by',sig.approved]].forEach(([role,name],i)=>{
        const x=x0+i*(w3+gap);
        LN(x,ly,x+w3,ly,C.ink2,1);
        font('bold',11,C.ink);T(name||' ',x,ly+14);
        font('normal',9.5,C.muted);doc.text(role.toUpperCase(),X(x),X(ly+26),{charSpace:0.3*S});});
      return ly+32;
    };
    const sigBlockPx=y=>sigBlockAt(MX,CWx,y);
    const SIGH=113;

    // reportChartEl equivalent — block height estimate + renderer per style
    const chartH=(cs,fs2,compGroups)=>{
      if(cs==='horizontal')return Math.max(1,fs2.length)*24-5;
      if(cs==='donut')return compGroups.length?Math.max(205,compGroups.length*210-5):205;
      if(cs==='combo'||cs==='pct')return 231;
      if(cs==='grouped'||cs==='stacked')return 210;
      if(cs==='area')return 200;
      if(cs==='bar'||cs==='line')return 195;
      return 205;
    };
    const drawChart=(cs,y,d,fs2,tone,compGroups)=>{
      const prim=d.primary;
      if(cs==='bar')return vBarFlat(y,fs2,'month',prim,195);
      if(cs==='line')return vLine(y,fs2,'full',prim,tone,195);
      if(cs==='area'){const avg=fs2.length?Math.round(fs2.reduce((s3,r)=>s3+(r[prim]||0),0)/fs2.length):0;return vArea(y,fs2,'full',prim,tone,avg,200);}
      if(cs==='combo'){const pctCol=d.cols.find(c=>c.pct);const lineKey=pctCol?pctCol.id:((d.cols.find(c=>c.id!==prim&&!c.pct)||{}).id||prim);
        return vCombo(y,fs2,'month',prim,lineKey,tone,hx('#e08a1e'),(d.cols.find(c=>c.id===prim)||{}).label||'Value',(d.cols.find(c=>c.id===lineKey)||{}).label||'Trend',210);}
      if(cs==='grouped'){const sr=reportSeries(d);return sr.length?vGrouped(y,fs2,'month',sr,210):vBarFlat(y,fs2,'month',prim,195);}
      if(cs==='stacked'){const sr=reportSeries(d);return sr.length?vStacked(y,fs2,'month',sr,210):vBarFlat(y,fs2,'month',prim,195);}
      if(cs==='pct'){const sr=reportSeries(d);return sr.length?vPct(y,fs2,'month',sr,210):vBarFlat(y,fs2,'month',prim,195);}
      if(cs==='horizontal')return vHBarRows(y,fs2.map((r,i)=>({label:r.full,value:r[prim]||0,color:PALV[i%PALV.length]})));
      if(cs==='donut')return compGroups.length?compGroups.reduce((yy,g)=>vDonutBlock(yy,g.data,205)+8,y):vBar3D(y,fs2,'month',prim,205);
      return vBar3D(y,fs2,'month',prim,205); // bar3d + default
    };

    /* ---------- DeptPage ---------- */
    const deptPage=(d,isLast)=>{
      let y=pageHeader();
      const fs2=fseriesOf(d),st=statOf(d,fs2);
      const toneHex=PALETTE[(d.id.charCodeAt(0))%PALETTE.length],tone=hx(toneHex);
      drawIcon(DEPT_ICON[d.id]||I.activity,MX,y+1,18,toneHex);
      font('bold',15,C.ink);T(d.name,MX+27,y+15);
      tagChip(MX+27+tw(d.name)+9,y+2,d.group||'');
      if(fs2.length)deltaChip(pageW-MX,y+1,st.delta);
      y+=31;
      if(!fs2.length){
        try{doc.setLineDashPattern([4*S,3*S],0);}catch(e){}
        doc.setDrawColor(C.line[0],C.line[1],C.line[2]);doc.setLineWidth(1*S);
        doc.roundedRect(X(MX),X(y),X(CWx),X(96),X(10),X(10),'S');
        try{doc.setLineDashPattern([],0);}catch(e){}
        font('normal',12.5,C.muted);
        T('No data reported for '+d.name+' in the selected period ('+rangeLabel+').',MX+CWx/2,y+52,{align:'center'});
        y+=96;
        /* authorisation drawn on the cover page only */
        return;
      }
      if(fs2.length<pMonths.length){
        const segs=[['Reported data covers ',false],[fs2[0].full+' – '+fs2[fs2.length-1].full,true],
          [' ('+fs2.length+' of the '+pMonths.length+' months in the selected period); months without a report are not plotted.',false]];
        font('normal',10,C.muted);
        const lines=doc.splitTextToSize(segs.map(s3=>s3[0]).join(''),X(CWx-20)).length;
        const boxH=lines*14+10;
        FR(MX,y,CWx,boxH,C.panel2,6);
        richText(segs,MX+10,y+15,CWx-20,10,14,C.muted);
        y+=boxH+10;
      }
      // preview: all four KPI tiles carry the DEPARTMENT tone
      y=kpiRow(y,[[st.latest.full||'Latest',fmt(st.latest[d.primary]||0)],['Total',fmt(st.total)],['Peak',fmt(st.peak)],['Average',fmt(st.avg)]]
        .map(p=>({label:p[0],value:p[1],tone})));
      const compGroups=compositionGroups(d,fs2);
      chartStyles.forEach(cs=>{
        const capH=chartStyles.length>1?18:0;
        const need=capH+chartH(cs,fs2,compGroups)+12;
        // break to a fresh page whenever the block doesn't fit — unless we're already
        // at the top of one (an over-tall horizontal chart then paginates row-wise)
        if(y+need>LIMIT&&y>MT+71)y=newPage();
        y+=4;
        if(chartStyles.length>1){font('bold',9.5,C.muted);doc.text(String(CHART_STYLE_LABEL[cs]||cs).toUpperCase(),X(MX),X(y+12),{charSpace:0.4*S});y+=18;}
        y=drawChart(cs,y,d,rptChartRows(d,fs2),tone,compGroups);
        y+=8;
      });
      if(!chartStyles.includes('donut')){
        compGroups.forEach(g=>{
          const boxH=Math.max(124,g.data.length*21-6+20);
          if(y+6+boxH>LIMIT)y=newPage();
          y=compositionStrip(y+6,g.data,g.title);
        });
      }
      const detailed=type==='detail';
      const ncol=d.cols.length+1;
      const tblFont=ncol>10?8:ncol>8?8.5:ncol>6?9.5:(detailed?10.5:11);
      const rpt=detailed||ncol>7;
      font('bold',tblFont);
      const firstW=rpt?58:Math.min(120,Math.max(76,...fs2.map(r=>tw(detailed?r.month:r.full)+24)));
      const widths=[firstW].concat(d.cols.map(()=>(CWx-firstW)/d.cols.length));
      const rows=fs2.map(r=>[detailed?r.month:r.full].concat(d.cols.map(c=>r[c.id]==null?'–':(c.pct?r[c.id]+'%':fmt(r[c.id])))));
      if(detailed)rows.push(['TOTAL'].concat(d.cols.map(c=>c.pct?'—':fmt(fs2.reduce((s3,r)=>s3+(r[c.id]||0),0)))));
      y=vTable(y+14,['Month'].concat(d.cols.map(c=>c.label)),widths,rows,{fs:tblFont,rpt:rpt,totalRow:detailed});
      /* authorisation drawn on the cover page only */
    };

    /* ---------- CoverPage ---------- */
    const coverPage=()=>{
      const rows=chosen.map(d=>{const fsr=fseriesOf(d);return {d,st:statOf(d,fsr),fs:fsr};});
      const totAll=rows.reduce((s3,r)=>s3+r.st.total,0);
      const mTot={};rows.forEach(rr=>rr.fs.forEach(r=>{mTot[r.month]=(mTot[r.month]||0)+(r[rr.d.primary]||0);}));
      const peakM=Object.keys(mTot).sort((a,b)=>mTot[b]-mTot[a])[0];
      const typeLabel={summary:'Department Summary Report',detail:'Detailed Statistical Report',compare:'Cross-Department Comparison',board:'Executive Board Report'}[type]||'Statistical Report';
      const hasSig=!!(sig.prepared||sig.reviewed||sig.recommended||sig.approved);
      const totalH=(logo?92:0)+16+58+17+28+82+(confidential?54:0)+29+(hasSig?SIGH:0);
      let y=MT+Math.max(24,(FOOTY-MT-totalH)/2+15);
      if(logo){const w2=66*(logo.w/logo.h);drawLogo(pageW/2-w2/2,y,66);y+=92;}
      font('bold',13,C.blue);doc.text(String(hospitalName).toUpperCase(),X(pageW/2),X(y+11),{align:'center',charSpace:1.5*S});y+=16;
      font('bold',32,C.ink);T(hdrTitle||'Patient Statistics Report',pageW/2,y+40,{align:'center'});y+=58;
      font('normal',13,C.muted);T((hdrSub?hdrSub+' · ':'')+typeLabel,pageW/2,y+12,{align:'center'});y+=17;
      font('bold',14,C.ink2);T(rangeLabel,pageW/2,y+21,{align:'center'});y+=28;
      const sw=CWx/4;
      [['Departments',String(chosen.length),PALV[0]],['Total patients',fmt(totAll),PALV[1]],
       ['Peak month',peakM?(peakM.split('-')[0]+' 20'+peakM.split('-')[1]):'—',PALV[2]],['Months covered',String(pMonths.length),PALV[3]]]
      .forEach((s3,i)=>{const x=MX+i*sw+sw/2;
        font('bold',26,s3[2]);T(s3[1],x,y+58,{align:'center'});
        font('normal',9.5,C.muted);doc.text(String(s3[0]).toUpperCase(),X(x),X(y+72),{align:'center',charSpace:0.4*S});});
      y+=82;
      if(confidential){
        font('bold',10.5,C.rose);const t2='CONFIDENTIAL — FOR AUTHORISED RECIPIENTS ONLY';const w2=tw(t2)+28;
        doc.setDrawColor(C.roseLine[0],C.roseLine[1],C.roseLine[2]);doc.setLineWidth(1*S);
        doc.roundedRect(X(pageW/2-w2/2),X(y+28),X(w2),X(26),X(6),X(6),'S');
        T(t2,pageW/2,y+44.5,{align:'center'});y+=54;
      }
      font('normal',10,C.faint);T('Generated '+genDate,pageW/2,y+24,{align:'center'});y+=29;
      if(showSig&&hasSig)sigBlockAt(Math.max(MX,(pageW-600)/2),Math.min(600,CWx),y);
    };

    /* ---------- ComparePage ---------- */
    const comparePage=()=>{
      let y=pageHeader();
      const rows=chosen.map(d=>{const fsr=fseriesOf(d);return {d,st:statOf(d,fsr)};});
      font('bold',15,C.ink);T('Cross-department comparison · '+chosen.length+' departments',MX,y+14);y+=31;
      const hbar=rows.map(rr=>({label:rr.d.short,value:rr.st.total,color:PALV[(rr.d.id.charCodeAt(0))%PALV.length]})).sort((a,b)=>b.value-a.value);
      y=vHBarRows(y,hbar)+16;
      const widths=[CWx*0.22,CWx*0.18,CWx*0.11,CWx*0.11,CWx*0.11,CWx*0.11,CWx*0.16];
      y=vTable(y,['Department','Service line','Latest','Total','Peak','Avg','Trend'],widths,
        rows.map(rr=>[rr.d.name,rr.d.group,fmt(rr.st.latest[rr.d.primary]||0),fmt(rr.st.total),fmt(rr.st.peak),fmt(rr.st.avg),rr.st.delta]),
        {fs:11.5,deltaCol:6});
      /* authorisation drawn on the cover page only */
    };

    /* ---------- BoardPage ---------- */
    const boardPage=()=>{
      let y=pageHeader();
      const rows=chosen.map(d=>{const fsr=fseriesOf(d);return {d,st:statOf(d,fsr),fs:fsr};});
      const totAll=rows.reduce((s3,r)=>s3+r.st.total,0);
      const top=rows.slice().sort((a,b)=>b.st.total-a.st.total)[0];
      const mTot={};rows.forEach(rr=>rr.fs.forEach(r=>{mTot[r.month]=(mTot[r.month]||0)+(r[rr.d.primary]||0);}));
      const trend=pMonths.filter(m=>mTot[m]!=null).map(m=>({label:m.split('-')[0],val:mTot[m]}));
      const peakM=trend.slice().sort((a,b)=>b.val-a.val)[0];
      drawIcon(I.doc,MX,y+1,18,PALETTE[0]);
      font('bold',15,C.ink);T('Executive Board Report',MX+27,y+15);
      tagChip(MX+27+tw('Executive Board Report')+9,y+2,rangeLabel);
      font('bold',10.5,C.blue700);
      tagChip(pageW-MX-(tw(String(rows.length)+' DEPARTMENTS')+16),y+2,rows.length+' departments');
      y+=31;
      y=kpiRow(y,[['Total patients',fmt(totAll)],['Departments',String(rows.length)],['Busiest dept',top?top.d.short:'—'],['Peak month',peakM?peakM.label:'—']]
        .map((p,i)=>({label:p[0],value:p[1],tone:PALV[i%PALV.length]})));
      if(trend.length>1){
        font('bold',9.5,C.muted);doc.text('HOSPITAL VOLUME — MONTHLY TREND',X(MX),X(y+12),{charSpace:0.4*S});y+=18;
        y=vBarFlat(y,trend,'label','val',170)+12;
      }
      font('bold',9.5,C.muted);doc.text('DEPARTMENT RANKING (PERIOD TOTAL)',X(MX),X(y+12),{charSpace:0.4*S});y+=20;
      const hbar=rows.map(rr=>({label:rr.d.short,value:rr.st.total,color:PALV[(rr.d.id.charCodeAt(0))%PALV.length]})).sort((a,b)=>b.value-a.value);
      y=vHBarRows(y,hbar)+14;
      const ranked=rows.slice().sort((a,b)=>b.st.total-a.st.total);
      const widths=[CWx*0.24,CWx*0.20,CWx*0.13,CWx*0.11,CWx*0.16,CWx*0.16];
      y=vTable(y,['Department','Service line','Total','Share','Avg / month','Trend'],widths,
        ranked.map(rr=>[rr.d.name,rr.d.group,fmt(rr.st.total),totAll?Math.round(rr.st.total*100/totAll)+'%':'—',fmt(rr.st.avg),rr.st.delta]),
        {fs:11,deltaCol:5});
      /* authorisation drawn on the cover page only */
    };

    /* ---------- assemble ---------- */
    if(showCover&&chosen.length>0)coverPage();
    if(type==='compare'){if(showCover)doc.addPage(fmtP,ori);comparePage();}
    else if(type==='board'){if(showCover)doc.addPage(fmtP,ori);boardPage();}
    else chosen.forEach((d,di)=>{if(showCover||di>0)doc.addPage(fmtP,ori);deptPage(d,di===chosen.length-1);});

    // footers on every page (needs the final page count)
    const total=doc.getNumberOfPages();
    for(let p=1;p<=total;p++){
      doc.setPage(p);
      LN(MX,FOOTY,pageW-MX,FOOTY,C.line,1);
      font('normal',9.5,C.faint);
      T(hospitalName,MX,FOOTY+16);
      T('Page '+p+' of '+total,pageW/2,FOOTY+16,{align:'center'});
      T((footerNote?footerNote+' · ':'')+(confidential?'Confidential · ':'')+pageSize+' '+orient,pageW-MX,FOOTY+16,{align:'right'});
    }
    doc.save('UNICO-statistics-'+type+'-'+new Date().toISOString().slice(0,10)+'.pdf');
  };
  const doPrint=()=>{ try{ document.body.classList.add('pdf-export-mode'); window.print(); }catch(e){} finally{ setTimeout(()=>document.body.classList.remove('pdf-export-mode'),500); } };

  /* ============ SERVER PDF (Python / ReportLab on Vercel) ============
     Serializes a PRE-RESOLVED render model — the browser owns every clinical
     derivation (fseriesOf / statOf / rptChartRows / compositionGroups); the
     Python function (api/report_pdf.py) is a pure layout engine. Mirrors the
     aggregates the on-screen pages (CoverPage / BoardPage / ComparePage /
     DeptPage) compute, so the server output matches the preview.  */
  const buildRenderModel=()=>{
    const toneOf=d=>PALETTE[(d.id.charCodeAt(0))%PALETTE.length];
    const typeLabel={summary:'Department Summary Report',detail:'Detailed Statistical Report',compare:'Cross-Department Comparison',board:'Executive Board Report'}[type]||'Statistical Report';
    // per-department resolved blocks (shared by summary/detail/cover/board/compare)
    const rows=chosen.map(d=>{const fs=fseriesOf(d);return {d,fs,st:statOf(d,fs)};});
    const depts=rows.map(({d,fs,st})=>{
      const cg=compositionGroups(d,fs).map(g=>({title:g.title,data:g.data.map(x=>({label:x.label,value:x.value,color:x.color}))}));
      const chart=rptChartRows(d,fs);
      return {
        id:d.id,name:d.name,short:d.short,group:d.group||'',primary:d.primary,primaryLabel:d.primaryLabel||'',
        toneHex:toneOf(d),
        cols:d.cols.map(c=>({id:c.id,label:c.label,pct:!!c.pct})),
        fs:fs.map(r=>{const o={month:r.month,full:r.full};d.cols.forEach(c=>{o[c.id]=r[c.id]==null?null:r[c.id];});return o;}),
        chartRows:chart.map(r=>({x:r.month,full:r.full,v:r[d.primary]||0})),
        series:reportSeries(d),
        stat:{latestFull:st.latest.full||'Latest',latestValue:st.latest[d.primary]||0,total:st.total,peak:st.peak,avg:st.avg,delta:st.delta},
        partial:(fs.length>0&&fs.length<pMonths.length)?{from:fs[0].full,to:fs[fs.length-1].full,reported:fs.length,periodMonths:pMonths.length}:null,
        compGroups:cg,
      };
    });
    const totAll=rows.reduce((s,r)=>s+r.st.total,0);
    const mTot={}; rows.forEach(({d,fs})=>fs.forEach(r=>{mTot[r.month]=(mTot[r.month]||0)+(r[d.primary]||0);}));
    const peakM=Object.keys(mTot).sort((a,b)=>mTot[b]-mTot[a])[0];
    // board aggregates (mirror BoardPage)
    const trend=pMonths.filter(m=>mTot[m]!=null).map(m=>({label:m.split('-')[0],val:mTot[m]}));
    const bPeak=trend.slice().sort((a,b)=>b.val-a.val)[0];
    const bTop=rows.slice().sort((a,b)=>b.st.total-a.st.total)[0];
    const ranked=rows.slice().sort((a,b)=>b.st.total-a.st.total);
    const board={
      kpis:[['Total patients',fmt(totAll)],['Departments',String(rows.length)],['Busiest dept',bTop?bTop.d.short:'—'],['Peak month',bPeak?bPeak.label:'—']],
      trend,
      hbar:rows.map(({d,st})=>({label:d.short,value:st.total,color:toneOf(d)})).sort((a,b)=>b.value-a.value),
      ranked:ranked.map(({d,st})=>({name:d.name,group:d.group||'',total:st.total,share:totAll?Math.round(st.total*100/totAll)+'%':'—',avg:st.avg,delta:st.delta})),
    };
    const compare={
      hbar:rows.map(({d,st})=>({label:d.short,value:st.total,color:toneOf(d)})).sort((a,b)=>b.value-a.value),
      rows:rows.map(({d,st})=>({name:d.name,group:d.group||'',latest:st.latest[d.primary]||0,total:st.total,peak:st.peak,avg:st.avg,delta:st.delta})),
    };
    const cover={typeLabel,deptCount:chosen.length,totAll,peakMonthLabel:peakM?(peakM.split('-')[0]+' 20'+peakM.split('-')[1]):'—',monthsCovered:pMonths.length};
    return {
      doc:{type,pageSize,orient,hdrTitle,hdrSub,hospitalName,showLogo,confidential,footerNote,
        showCover:showCover&&chosen.length>0,showSig,rangeLabel,genDate:new Date().toLocaleDateString('en-US'),
        chartStyles,sig,palette:PALETTE},
      depts,board,compare,cover,
    };
  };
  // Try the Python report service; resolves true on a real PDF download, false to fall back.
  const tryServerPDF=async()=>{
    if(window.__UNICO_SERVER_PDF__===false) return false;
    try{
      const res=await fetch('/api/report-pdf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(buildRenderModel())});
      // On localhost:8080 (no Vercel router) the catch-all returns index.html with 200 —
      // the content-type guard rejects that so we cleanly fall back to the JS vector export.
      const ct=(res.headers.get('content-type')||'').toLowerCase();
      if(res.ok&&ct.indexOf('pdf')>=0){
        const blob=await res.blob();
        msDownload(blob,'UNICO-statistics-'+type+'-'+new Date().toISOString().slice(0,10)+'.pdf','application/pdf');
        return true;
      }
      try{ console.warn('[reports] server PDF unavailable ('+res.status+' '+ct+') — falling back to vector'); }catch(_){}
    }catch(e){ try{ console.warn('[reports] server PDF failed, falling back to vector:',e); }catch(_){} }
    return false;
  };

  const doExport=async()=>{
    const native=window.unicoNative;
    if(chosen.length===0){ setNote({ok:false,text:'Select at least one department first.'}); return; }
    // Desktop app: superior native Chromium printToPDF (vector).
    if(native&&typeof native.exportPDF==='function'&&!native.isWeb){
      setExporting(true); setNote(null);
      document.body.classList.add('pdf-export-mode'); // print only the report (#pdf-root)
      try{
        const res=await native.exportPDF({pageSize, landscape:orient==='landscape', defaultName:`UNICO-${type}-report`});
        if(res&&res.ok) setNote({ok:true,text:'PDF'+(res.path?' saved · '+res.path:' ready — save it from the print dialog')});
        else if(res&&res.canceled){ /* user dismissed the save dialog — stay quiet */ }
        else setNote({ok:false,text:(res&&res.error)||'Export failed.'});
      }catch(e){ setNote({ok:false,text:String(e&&e.message?e.message:e)}); }
      finally{ document.body.classList.remove('pdf-export-mode'); setExporting(false); }
      return;
    }
    // Web, PREFERRED: the Python report service (api/report_pdf.py, ReportLab on
    // Vercel). Generated server-side from a resolved render model. Any failure
    // (offline, localhost without the function, non-PDF response) silently falls
    // through to the client-side jsPDF vector path below — export never breaks.
    if(chosen.length>0){
      setExporting('Generating PDF…'); setNote(null);
      // OPT-IN exact-preview render via the local report service (headless browser).
      // Off by default (set window.__UNICO_HTML_PDF__=true to enable) — it's still being
      // tuned; the proven exporters below are the default so export never breaks.
      if(window.__UNICO_HTML_PDF__===true){
        try{
          if(await unicoHtmlServerPDF(pageSize,orient,'UNICO-statistics-'+type+'-'+new Date().toISOString().slice(0,10)+'.pdf')){
            setNote({ok:true,text:'PDF downloaded.'}); setExporting(false); return;
          }
        }catch(e){ /* fall through */ }
      }
      // PREFERRED: server ReportLab model (also used on Vercel).
      try{
        if(await tryServerPDF()){
          setNote({ok:true,text:'PDF downloaded.'});
          setExporting(false);
          return;
        }
      }catch(e){ /* fall through to vector */ }
    }
    // Web fallback #1: TRUE VECTOR PDF — drawn with jsPDF primitives. Selectable text,
    // razor-sharp at any zoom, ~100 KB, and ~1 s even for a 17-page all-departments
    // run (the raster path below needed 25-40 s of html2canvas captures).
    const J0=window.jspdf&&window.jspdf.jsPDF;
    // Vector PDF reproduces ALL report types (summary / detailed / comparison / board)
    // page-for-page as the live preview shows them.
    if(J0){
      setExporting('Building PDF…'); setNote(null);
      try{
        await buildVectorPDF(J0);
        setNote({ok:true,text:'PDF downloaded — vector quality (selectable text).'});
        setExporting(false);
        return;
      }catch(e){
        // fall through to the raster path so the user still gets a PDF
        try{ console.warn('[reports] vector PDF failed, falling back to raster:',e); }catch(_){}
      }
    }
    // Web fallback: rasterize every report page (html2canvas) into a jsPDF, with the
    // SAME content-aware slicing the Quality console exporter uses.
    const H=window.html2canvas, J=window.jspdf&&window.jspdf.jsPDF;
    if(H&&J){
      setExporting(true); setNote(null);
      const stage=document.getElementById('pdf-root'); let els=[], prev=[];
      try{
        if(!stage) throw new Error('render target missing');
        document.body.classList.add('qc-pdfcap');
        els=Array.prototype.slice.call(stage.querySelectorAll('.pdf-page'));
        if(!els.length) throw new Error('nothing to export');
        prev=els.map(el=>el.getAttribute('style')||'');
        els.forEach(el=>{ el.style.width=pageW+'px'; el.style.boxSizing='border-box'; el.style.padding='28px 30px'; el.style.background='#fff'; el.style.margin='0'; el.style.height='auto'; el.style.overflow='visible'; });
        try{ if(document.fonts&&document.fonts.ready) await document.fonts.ready; }catch(e){}
        await new Promise(r=>setTimeout(r,80));
        const fmt=pageSize==='A3'?'a3':pageSize==='Letter'?'letter':'a4', ori=orient==='landscape'?'l':'p';
        const doc=new J({orientation:ori,unit:'pt',format:fmt,compress:true});
        const pw=doc.internal.pageSize.getWidth(), ph=doc.internal.pageSize.getHeight();
        // Big reports (a full 16-department run = 17+ pages) rasterize at 1.5x instead
        // of 2x — ~45% fewer pixels per page, visually identical at A4 print size.
        const capScale=els.length>8?1.5:2;
        let firstPage=true;
        for(let i=0;i<els.length;i++){
          // Live progress — a 17-page export takes ~20-40s and a frozen "Exporting…"
          // reads as a hang. Yield a frame so React actually paints the update.
          setExporting('Page '+(i+1)+'/'+els.length+'…');
          await new Promise(r=>setTimeout(r,30));
          const el=els[i];
          if(el.scrollHeight<=pageMinH){ el.style.height=pageMinH+'px'; el.style.overflow='hidden'; }
          const elRect=el.getBoundingClientRect();
          const guardsCss=[];
          el.querySelectorAll('tr,svg,.pdf-foot,[style*="break-inside"]').forEach(a=>{
            const r=a.getBoundingClientRect();
            if(r.height>0) guardsCss.push([r.top-elRect.top, r.bottom-elRect.top]);
          });
          const fEl=el.querySelector('.pdf-foot'); let fCss=null;
          if(fEl){ const fr=fEl.getBoundingClientRect(); if(fr.height>0) fCss=[fr.top-elRect.top, fr.bottom-elRect.top]; }
          const canvas=await H(el,{scale:capScale,backgroundColor:'#ffffff',useCORS:true,logging:false});
          el.style.height='auto'; el.style.overflow='visible';
          const cW=canvas.width, cH=canvas.height, pxPerPt=cW/pw, pageHpx=Math.round(ph*pxPerPt);
          const k=elRect.height>0?(cH/elRect.height):capScale;
          const guards=guardsCss.map(g=>[g[0]*k, g[1]*k]).filter(g=>(g[1]-g[0])<pageHpx*0.9);
          const fPx=fCss?[fCss[0]*k, fCss[1]*k]:null;
          const pickEnd=(y0,budget)=>{
            if(cH-y0<=budget) return cH;
            let cut=y0+budget;
            for(let pass=0; pass<8; pass++){
              let moved=false;
              for(const g of guards){
                if(g[0]<cut-1 && g[1]>cut+1){ const c2=Math.floor(g[0]); if(c2>y0+budget*0.35){ cut=c2; moved=true; } }
              }
              if(!moved) break;
            }
            return Math.max(cut, y0+Math.round(budget*0.35));
          };
          const crop=(top,h)=>{ const tmp=document.createElement('canvas'); tmp.width=cW; tmp.height=h; tmp.getContext('2d').drawImage(canvas,0,top,cW,h,0,0,cW,h); return tmp.toDataURL('image/jpeg',0.94); };
          const snapCtx=canvas.getContext('2d',{willReadFrequently:true});
          const rowBlank=(yy)=>{ if(yy<=0||yy>=cH) return false; const d2=snapCtx.getImageData(0,yy,cW,1).data;
            for(let j=0;j<d2.length;j+=4){ if(d2[j]<252||d2[j+1]<252||d2[j+2]<252) return false; } return true; };
          const snapCut=(cut,y0)=>{
            if(rowBlank(cut)) return cut;
            const up=Math.min(90, cut-(y0+24));
            for(let dY=1; dY<=90; dY++){
              if(dY<=up && rowBlank(cut-dY)) return cut-dY;
              if(dY<=8 && cut+dY<cH-1 && rowBlank(cut+dY)) return cut+dY;
            }
            return cut;
          };
          const padPx=Math.round(28*k), padPt=padPx/pxPerPt;
          if(cH<=pageHpx+4){
            if(!firstPage) doc.addPage(fmt,ori); firstPage=false;
            doc.addImage(canvas.toDataURL('image/jpeg',0.94),'JPEG',0,0,pw,Math.min(ph,cH/pxPerPt),undefined,'FAST');
          } else {
            let y=0;
            do{
              const first=y===0, top=first?0:padPt, budget=pageHpx-(first?1:2)*padPx;
              let end=pickEnd(y,budget); if(end<cH) end=snapCut(end,y);
              const sliceH=end-y;
              if(!firstPage) doc.addPage(fmt,ori); firstPage=false;
              if(cH-end<=2 && sliceH<budget-4 && fPx && fPx[0]>=y-2 && fPx[0]<end){
                const fTop=Math.max(y,snapCut(Math.floor(fPx[0]),y)), contentH=fTop-y, footH=end-fTop;
                if(contentH>2) doc.addImage(crop(y,contentH),'JPEG',0,top,pw,contentH/pxPerPt,undefined,'FAST');
                if(footH>2) doc.addImage(crop(fTop,footH),'JPEG',0,ph-footH/pxPerPt,pw,footH/pxPerPt,undefined,'FAST');
              } else {
                doc.addImage(crop(y,sliceH),'JPEG',0,top,pw,sliceH/pxPerPt,undefined,'FAST');
              }
              y=end;
            } while(cH-y>2);
          }
        }
        els.forEach((el,i)=>el.setAttribute('style',prev[i])); els=[];
        document.body.classList.remove('qc-pdfcap');
        doc.save('UNICO-statistics-'+type+'-'+new Date().toISOString().slice(0,10)+'.pdf');
        setNote({ok:true,text:'PDF downloaded ('+(ori==='l'?'landscape':'portrait')+').'});
      }catch(e){
        try{ els.forEach((el,i)=>el.setAttribute('style',prev[i])); }catch(_){}
        document.body.classList.remove('qc-pdfcap');
        setNote({ok:false,text:'Direct PDF failed ('+String(e&&e.message||e)+'); opening Print instead.'});
        try{ document.body.classList.add('pdf-export-mode'); window.print(); setTimeout(()=>document.body.classList.remove('pdf-export-mode'),600); }catch(_){}
      }finally{ setExporting(false); }
      return;
    }
    // Last resort: browser print dialog (choose "Save as PDF").
    doPrint();
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
          <button className="btn pri sm" onClick={doExport} disabled={!!exporting||chosen.length===0}><Ic d={I.download} s={15}/>{exporting?(typeof exporting==='string'?exporting:'Exporting…'):'Export PDF'}</button>
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
                <input value={sig.recommended} onChange={e=>setSig(s=>({...s,recommended:e.target.value}))} placeholder="Recommended by (name & title)" style={{...sel2,width:'100%'}}/>
                <input value={sig.approved} onChange={e=>setSig(s=>({...s,approved:e.target.value}))} placeholder="Approved by (name & title)" style={{...sel2,width:'100%'}}/>
                <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'var(--ink-2)'}}>
                  <input type="checkbox" checked={showSig} onChange={e=>setShowSig(e.target.checked)}/>Signature block on cover page
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

function Settings({depts, store, setRoute}){
  const [tab,setTab]=React.useState((typeof window!=='undefined'&&window.__UNICO_SETTINGS_TAB__)||'general');
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
          {[['general','General',I.gear],['departments','Departments',I.layers],['users','Users & Roles',I.user],['responsibles','Responsible Persons',I.user],['fields','Form Fields',I.filter],['data','Data & Export',I.doc]].map(([id,l,ic])=>(
            <div key={id} onClick={()=>setTab(id)} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',borderRadius:7,cursor:'pointer',fontSize:13,fontWeight:600,
              background:tab===id?'var(--blue-50)':'transparent',color:tab===id?'var(--blue-700)':'var(--ink-2)'}}>
              <Ic d={ic} s={16}/>{l}
            </div>
          ))}
        </div>
        <div style={{minWidth:0,display:'flex',flexDirection:'column',gap:16}}>
          {tab==='general'&&<div className="card"><div className="card-b">
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
          </div></div>}
          {tab==='departments'&&(typeof ManageDepts!=='undefined'?<ManageDepts depts={depts} store={store} setRoute={setRoute}/>:null)}
          {tab==='users'&&<div className="card"><div className="card-b"><UserManagement/></div></div>}
          {tab==='responsibles'&&(typeof DataResponsibles!=='undefined'?<DataResponsibles depts={depts}/>:null)}
          {tab==='fields'&&(typeof DataFields!=='undefined'?<DataFields setRoute={setRoute}/>:null)}
          {tab==='data'&&<div className="card"><div className="card-b">
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
          </div></div>}
        </div>
      </div>
    </div>
  );
}
window.Reports=Reports; window.Settings=Settings;
