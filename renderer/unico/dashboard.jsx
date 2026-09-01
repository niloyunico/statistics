/* UNICO — Dashboard with layout variations */
function KpiCard({label,value,delta,foot,icon,tone='#0b66d0',spark,sparkColor}){
  return (
    <div className="card kpi anim-pop">
      <div className="top">
        <div className="ic" style={{background:tone+'1a',color:tone}}><Ic d={icon} s={20}/></div>
        <div style={{flex:1}}>
          <div className="lbl">{label}</div>
        </div>
        {spark&&<Spark values={spark} color={sparkColor||tone} w={84} h={30}/>}
      </div>
      <div className="val">{value}</div>
      <div className="row2">
        {delta!=null&&<Delta v={delta}/>}
        <span className="foot">{foot}</span>
      </div>
    </div>
  );
}

function DeptMiniCard({d,onOpen}){
  const vals=d.series.map(r=>r[d.primary]||0);
  const tone=PALETTE[(d.id.charCodeAt(0)+d.id.length)%PALETTE.length];
  return (
    <div className="card anim-pop" style={{padding:14,cursor:'pointer',display:'flex',flexDirection:'column',gap:9}}
      onClick={onOpen} onMouseEnter={e=>e.currentTarget.style.boxShadow='var(--shadow-md)'}
      onMouseLeave={e=>e.currentTarget.style.boxShadow='var(--shadow)'}>
      <div style={{display:'flex',alignItems:'center',gap:9}}>
        <div style={{width:30,height:30,borderRadius:8,background:tone+'18',color:tone,display:'grid',placeItems:'center'}}><Ic d={DEPT_ICON[d.id]||I.activity} s={16}/></div>
        <div style={{minWidth:0}}>
          <div style={{fontSize:13,fontWeight:700,color:'var(--ink)',whiteSpace:'nowrap'}}>{d.short}</div>
          <div style={{fontSize:10.5,color:'var(--muted)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:118}}>{d.name}</div>
        </div>
        <div className="spacer"/>
        <Delta v={d.delta}/>
      </div>
      <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between'}}>
        <div>
          <div className="num" style={{fontSize:23,fontWeight:600,color:'var(--ink)',lineHeight:1}}>{fmt(d.latest[d.primary]||0)}</div>
          <div style={{fontSize:10,color:'var(--faint)',textTransform:'uppercase',letterSpacing:.3,marginTop:3}}>{d.primaryLabel} · {d.latest.month}</div>
        </div>
        <Spark values={vals} color={tone} w={96} h={36}/>
      </div>
    </div>
  );
}

function ReportingCompliance({depts, onFill}){
  const MO=window.UNICO.MONTH_ORDER, MF=window.UNICO.MONTHS_FULL;
  const allM=[...new Set(depts.flatMap(d=>d.months))].sort((a,b)=>MO.indexOf(a)-MO.indexOf(b));
  const yearOf=m=>String(m||'').split('-')[1]||'';
  const yLabel=y=>y&&y.length===2?'20'+y:(y||'');
  const years=[...new Set(allM.map(yearOf))].filter(Boolean).sort();
  const [year,setYear]=React.useState(()=>years[years.length-1]||'');
  const curYear=years.indexOf(year)>=0?year:(years[years.length-1]||'');
  // Show the selected year's months (fall back to the last 5 overall if none).
  const monthsOfYear=allM.filter(m=>yearOf(m)===curYear);
  const recent=monthsOfYear.length?monthsOfYear:allM.slice(-5);
  let reported=0, missing=0;
  const rows=depts.map(d=>{
    const first=d.months[0];
    const cells=recent.map(m=>{
      if(!first||MO.indexOf(m)<MO.indexOf(first)) return {m,st:'na'};
      if(d.months.includes(m)){reported++;return {m,st:'ok'};}
      missing++; return {m,st:'miss'};
    });
    return {d,cells,miss:cells.filter(c=>c.st==='miss').length};
  }).sort((a,b)=>b.miss-a.miss);
  const pct=reported+missing?Math.round(reported*100/(reported+missing)):100;
  const pending=rows.filter(r=>r.miss>0);
  return (
    <div className="card">
      <div className="card-h">
        <h3>Reporting Compliance</h3><span className="sub">{curYear?yLabel(curYear):'running months'} · missing department stats</span><span className="spacer"/>
        {years.length>1&&(
          <div className="seg" style={{marginRight:8}} title="Switch reporting year">
            {years.map(y=><button key={y} className={curYear===y?'on':''} onClick={()=>setYear(y)}>{yLabel(y)}</button>)}
          </div>
        )}
        <span className="chip " style={{background:pct>=90?'var(--pos-bg)':pct>=70?'#fdf3e3':'var(--neg-bg)',color:pct>=90?'var(--pos)':pct>=70?'var(--amber)':'var(--neg)'}}>{pct}% complete</span>
        <span className="tag num" style={{marginLeft:8}}>{missing} pending</span>
      </div>
      <div style={{overflowX:'auto'}}>
        <table className="tbl">
          <thead><tr><th style={{textAlign:'left'}}>Department</th>{recent.map(m=><th key={m} style={{textAlign:'center'}}>{m}</th>)}<th style={{textAlign:'center'}}>Gaps</th></tr></thead>
          <tbody>
            {rows.map(({d,cells,miss})=>(
              <tr key={d.id}>
                <td style={{textAlign:'left',cursor:'pointer'}} onClick={()=>onFill&&onFill(d.id)}><b style={{color:'var(--ink)'}}>{d.short}</b> <span style={{color:'var(--faint)',fontWeight:400,fontFamily:"'IBM Plex Sans'"}}>{d.name}</span></td>
                {cells.map((c,i)=>(
                  <td key={i} style={{textAlign:'center'}}>
                    {c.st==='ok'&&<span style={{color:'var(--pos)',fontWeight:700}}>✓</span>}
                    {c.st==='na'&&<span style={{color:'#cbd3dd'}}>–</span>}
                    {c.st==='miss'&&<span title={`Fill ${d.short} · ${c.m}`} onClick={()=>onFill&&onFill(d.id)} style={{cursor:'pointer',display:'inline-flex',alignItems:'center',justifyContent:'center',width:22,height:22,borderRadius:6,background:'var(--neg-bg)',color:'var(--neg)',fontWeight:700,fontSize:11}}>!</span>}
                  </td>
                ))}
                <td style={{textAlign:'center'}}>{miss>0?<span className="chip neg">{miss}</span>:<span className="chip pos">0</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pending.length>0&&(
        <div style={{padding:'12px 16px',borderTop:'1px solid var(--line-2)',display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
          <span style={{fontSize:12,color:'var(--muted)'}}>Fill missing months:</span>
          {pending.slice(0,8).map(({d,miss})=>(
            <button key={d.id} className="btn sm" onClick={()=>onFill&&onFill(d.id)}><Ic d={I.input} s={13}/>{d.short} <span style={{color:'var(--rose)',marginLeft:2}}>({miss})</span></button>
          ))}
        </div>
      )}
    </div>
  );
}

// Return a copy of department `d` whose time-dependent aggregates (series, total,
// latest, prev, delta, peak, avg) are recomputed over only the in-range months.
// Mirrors store.js `recompute` so the rest of the Dashboard reads the same shape.
// Falls back to the unfiltered dept if it has no data inside the window.
function deptForPeriod(d, monthSet){
  const idxs=[];
  for(let i=0;i<d.months.length;i++) if(monthSet.has(d.months[i])) idxs.push(i);
  if(!idxs.length) return d;
  const months=idxs.map(i=>d.months[i]);
  const data=idxs.map(i=>d.data[i]);
  const series=data.map((row,i)=>({month:months[i], full:(window.UNICO.MONTHS_FULL[months[i]]||months[i]), ...row}));
  const total=series.reduce((s,r)=>s+(r[d.primary]||0),0);
  const latest=series[series.length-1];
  const prev=series.length>1?series[series.length-2]:null;
  const cur=latest[d.primary]||0, pv=prev?(prev[d.primary]||0):0;
  const delta=pv===0?(cur>0?100:0):Math.round(((cur-pv)/pv)*100);
  const peak=Math.max(...series.map(r=>r[d.primary]||0));
  const avg=Math.round(total/series.length);
  return {...d, months, data, series, total, latest, prev, delta, peak, avg};
}

function Dashboard({layout, depts:rawDepts, period, openDept, onFill, setRoute}){
  const MO=window.UNICO.MONTH_ORDER, MF=window.UNICO.MONTHS_FULL;
  const allMonths=React.useMemo(()=>[...new Set(rawDepts.flatMap(d=>d.months||[]))].sort((a,b)=>MO.indexOf(a)-MO.indexOf(b)),[rawDepts]);
  const months=window.unicoPeriodMonths(allMonths, period||{mode:'all'});
  const monthsKey=months?months.join(','):'all';
  const depts=React.useMemo(()=>{ if(!months) return rawDepts; const set=new Set(months); return rawDepts.map(d=>deptForPeriod(d,set)); },[rawDepts,monthsKey]);
  const activeMonths=months||allMonths;
  const fmtKey=k=>String(k||'').replace('-',' ');
  const mShort=k=>String(k||'').split('-')[0];
  const rangeShort=activeMonths.length?`${fmtKey(activeMonths[0])}–${fmtKey(activeMonths[activeMonths.length-1])}`:'—';
  const rangeFull=activeMonths.length?`${MF[activeMonths[0]]||activeMonths[0]} – ${MF[activeMonths[activeMonths.length-1]]||activeMonths[activeMonths.length-1]}`:'—';
  const D=Object.fromEntries(depts.map(d=>[d.id,d]));
  // Departments can be renamed/deleted or simply absent from the DB, so a hardcoded id may
  // not resolve — fall back to a BLANK shape so KPI cards/charts degrade gracefully instead
  // of crashing with "Cannot read property total/series of undefined".
  const BLANK={latest:{},series:[],prev:null,total:0,delta:0,cols:[]};
  const dg=id=>D[id]||BLANK;
  const er=dg('er'), opd=dg('opd'), ot=dg('ot'), cath=dg('cathlab');
  // aggregate ICU admissions (null-safe: skip any ICU dept that isn't present)
  const icuTotal=['micu','sicu','ccu','nicu'].reduce((s,id)=>s+(D[id]?.total||0),0);
  const procTotal=['endoscopy','ot','cathlab','dialysis','ctvs'].reduce((s,id)=>s+(D[id]?.total||0),0);

  const kpis=(
    <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit,minmax(208px,1fr))'}}>
      <KpiCard label={`ED Patients · ${mShort(er.latest.month)}`} value={fmt(er.latest.total)} delta={er.delta} icon={I.pulse} tone="#d23a52"
        foot={er.prev?`vs ${mShort(er.prev.month)}`:'latest month'} spark={er.series.map(r=>r.total)} sparkColor="#d23a52"/>
      <KpiCard label={`OPD Footfall · ${mShort(opd.latest.month)}`} value={fmt(opd.latest.opd)} delta={opd.delta} icon={I.user} tone="#0b66d0"
        foot={`${fmt(opd.total)} over ${rangeShort}`} spark={opd.series.map(r=>r.opd)}/>
      <KpiCard label="Procedures" value={fmt(procTotal)} icon={I.activity} tone="#0f9b8e"
        foot="OT · Cath · Endo · Dialysis" spark={ot.series.map(r=>r.ot)} sparkColor="#0f9b8e"/>
      <KpiCard label="Critical Care Vol." value={fmt(icuTotal)} icon={I.heart} tone="#6a52d4"
        foot="MICU · SICU · CCU · NICU" spark={dg('micu').series.map(r=>r.adm)} sparkColor="#6a52d4"/>
    </div>
  );

  // Hospital-wide Quality & Safety KPIs (reads the merged quality data + CAPA store).
  const qualityKpis=(function(){
    const Qh=window.UNICO_Q;
    if(!window.qualityData || !Qh) return null;
    // Use the Quality console's authoritative, YEAR/quarter-aware helpers so this strip
    // and the console's own dashboard KPIs are always identical (the old fixed-window
    // scan silently read the wrong months and showed a flat 100% / 0 breaches).
    const qd=window.qualityData().filter(d=>d.indicators&&d.indicators.length);
    const months=Qh.fyAxis(Qh.defaultFy(qd));
    let okC=0,brC=0;
    qd.forEach(d=>{ const s=Qh.deptStat(d,months); okC+=s.ok; brC+=s.breach; });
    const zero=okC+brC?Math.round(okC*100/(okC+brC)):100;
    // Action Plans (CAPA): the console stores a status map {'<deptKey>/<indId>':'Open'|'In Progress'|'Closed'}.
    let capaMap={}; try{ capaMap=JSON.parse(localStorage.getItem('unico_capa_v1'))||{}; }catch(e){}
    if(Array.isArray(capaMap)) capaMap={}; // ignore any stale legacy array format
    let open=0;
    qd.forEach(d=>d.indicators.forEach(ind=>{ if(Qh.countBreaches(ind,months)>0 && capaMap[d.key+'/'+ind.id]!=='Closed') open++; }));
    return {depts:qd.length, zero:zero, breach:brC, capaOpen:open};
  })();
  const qCard=(label,val,foot,color,route)=>(
    <div className="card anim-pop" onClick={()=>setRoute&&setRoute(route)} style={{padding:'15px 18px',borderLeft:'4px solid '+color,display:'flex',flexDirection:'column',minHeight:104,cursor:setRoute?'pointer':'default'}}>
      <div style={{fontSize:12.5,fontWeight:700,color:'var(--ink-2)'}}>{label}</div>
      <div className="num" style={{fontSize:30,fontWeight:700,color:color,margin:'8px 0 5px',lineHeight:1}}>{val}</div>
      <div style={{fontSize:11,color:'var(--muted)',marginTop:'auto'}}>{foot}</div>
    </div>
  );
  const qualityStrip = qualityKpis ? (
    <React.Fragment>
      <div className="eyebrow" style={{marginTop:6}}>Quality &amp; Safety</div>
      <div className="grid" style={{gridTemplateColumns:'repeat(3,minmax(0,1fr))'}}>
        {qCard('Zero-Defect Rate', qualityKpis.zero+'%', 'on-benchmark indicator-months', qualityKpis.zero>=90?'#1f9d57':qualityKpis.zero>=70?'#e08a1e':'#d23a52', {view:'quality'})}
        {qCard('Off Benchmark', fmt(qualityKpis.breach), 'indicator-months off benchmark', qualityKpis.breach>0?'#d23a52':'#1f9d57', {view:'quality',qview:'incidents'})}
        {qCard('Open Action Plans', fmt(qualityKpis.capaOpen), 'off-benchmark months not yet closed', qualityKpis.capaOpen>0?'#0090ca':'#1f9d57', {view:'quality',qview:'actionplans'})}
      </div>
    </React.Fragment>
  ) : null;

  if(layout==='operational'){
    return (
      <div className="grid" style={{gap:16}}>
        {kpis}
        <SectionTitle icon={I.layers} title="All Departments" sub="Latest month at a glance — click any card to drill in"/>
        <div className="grid" style={{gridTemplateColumns:'repeat(auto-fill,minmax(232px,1fr))'}}>
          {depts.map(d=><DeptMiniCard key={d.id} d={d} onOpen={()=>openDept(d.id)}/>)}
        </div>
        <ReportingCompliance depts={depts} onFill={onFill}/>
      </div>
    );
  }

  if(layout==='analytics'){
    const erSeries=[{id:'reg',label:'ER Reg',color:'#0b66d0'},{id:'adm',label:'Admission',color:'#0f9b8e'},{id:'total',label:'Total ED',color:'#e08a1e'}];
    const dia=dg('dialysis');
    const diaSeries=[{id:'conv',label:'Conventional',color:'#0b66d0'},{id:'modi',label:'Modi-SLED',color:'#0f9b8e'},{id:'sled',label:'SLED',color:'#e08a1e'}];
    const cathMix=(cath.cols||[]).filter(c=>c.id!=='total').map((c,i)=>({label:c.label,value:cath.series.reduce((s,r)=>s+(r[c.id]||0),0),color:PALETTE[i]}));
    return (
      <div className="grid" style={{gap:16}}>
        {kpis}
        <div className="grid" style={{gridTemplateColumns:'1.4fr 1fr'}}>
          <div className="card">
            <div className="card-h"><h3>Emergency Department — Registrations vs Admissions</h3><span className="spacer"/><span className="tag">Grouped</span></div>
            <div className="card-b"><GroupedBar data={er.series} x="month" series={erSeries} height={250}/></div>
          </div>
          <div className="card">
            <div className="card-h"><h3>Cath Lab — Procedure Mix</h3><span className="spacer"/><span className="tag">Donut</span></div>
            <div className="card-b" style={{display:'grid',placeItems:'center',minHeight:250}}><Donut data={cathMix} centerValue={cath.total} centerLabel="Total"/></div>
          </div>
        </div>
        <div className="grid" style={{gridTemplateColumns:'1fr 1.4fr'}}>
          <div className="card">
            <div className="card-h"><h3>Dialysis — Modality Stack</h3><span className="spacer"/><span className="tag">Stacked</span></div>
            <div className="card-b"><StackedBar data={dia.series} x="month" series={diaSeries} height={240}/></div>
          </div>
          <div className="card">
            <div className="card-h"><h3>OPD Footfall — {activeMonths.length}-Month Trend</h3><span className="spacer"/><span className="tag">Area line</span></div>
            <div className="card-b"><LineChart data={opd.series} x="full" y="opd" height={240} color="#0b66d0"/></div>
          </div>
        </div>
      </div>
    );
  }

  // executive (default) — matches UNICO.dc.html "Hospital Overview"
  const ranking=depts.map(d=>({label:d.short,value:d.latest[d.primary]||0,color:PALETTE[(d.id.charCodeAt(0))%PALETTE.length]}))
    .sort((a,b)=>b.value-a.value).slice(0,8);
  const groupMix=window.UNICO.GROUPS.map((g,i)=>({label:g,value:depts.filter(d=>d.group===g).reduce((s,d)=>s+d.total,0),color:PALETTE[i]})).filter(x=>x.value>0);
  const erConv=er&&er.latest&&er.latest.conv!=null?er.latest.conv:0;
  const latestFull=activeMonths.length?(MF[activeMonths[activeMonths.length-1]]||activeMonths[activeMonths.length-1]):'';
  return (
    <div className="grid" style={{gap:14}}>
      {/* hero header */}
      <div style={{display:'flex',alignItems:'flex-end',gap:16,flexWrap:'wrap'}}>
        <div>
          <div style={{fontSize:23,fontWeight:700,letterSpacing:-.5}}>Hospital Overview</div>
          <div style={{fontSize:13,color:'var(--muted)',marginTop:3}}>Unico Hospitals · {depts.length} department{depts.length===1?'':'s'} reporting{latestFull?' · '+latestFull:''}</div>
        </div>
        <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:9}}>
          <button className="btn" onClick={()=>setRoute&&setRoute({view:'quality'})}><Ic d={I.heart} s={15}/>Quality board</button>
          <button className="btn pri" onClick={()=>setRoute&&setRoute({view:'reports'})}><Ic d={I.doc} s={15}/>Generate Report</button>
        </div>
      </div>

      <div className="eyebrow">Patient Volume</div>
      {kpis}
      {qualityStrip}

      <div className="eyebrow" style={{marginTop:6}}>Trends &amp; Distribution</div>
      <div className="grid" style={{gridTemplateColumns:'1.55fr 1fr'}}>
        <div className="card">
          <div className="card-h">
            <h3>OPD Footfall — Hospital-wide Trend</h3>
            <span className="sub">{rangeFull}</span><span className="spacer"/>
            <span className="tag" style={{background:'var(--pos-bg)',color:'var(--pos)'}}>▲ {opd.delta}% MoM</span>
          </div>
          <div className="card-b"><LineChart data={opd.series} x="full" y="opd" height={258} color="#0b66d0"/></div>
        </div>
        <div className="card">
          <div className="card-h"><h3>Volume by Service Line</h3><span className="spacer"/></div>
          <div className="card-b" style={{display:'grid',placeItems:'center'}}>
            <Donut data={groupMix} size={186} centerValue={fmt(groupMix.reduce((s,d)=>s+d.value,0))} centerLabel="All cases"/>
          </div>
        </div>
      </div>

    </div>
  );
}
window.Dashboard=Dashboard;
