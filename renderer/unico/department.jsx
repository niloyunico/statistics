/* UNICO — Department 360 (combined statistics + quality), per UNICO.dc.html */

// Quality snapshot for a Statistics department — links via DEPTMAP.qkFromId and reads
// the SAME monthly logic as the Quality console / Dashboard. Returns null when the
// department has no linked quality area or no indicators.
function unicoDeptQuality(dept){
  try{
    if(!dept || !window.qualityData) return null;
    const deptId = dept.id;
    const norm=s=>String(s||'').trim().toLowerCase().replace(/\s+/g,' ');
    const qk = window.DEPTMAP ? window.DEPTMAP.qkFromId(deptId) : null;
    const areas = window.qualityData();
    // Primary: the explicit Mongo link (departments.qualityKey / quality.deptId) — wins in
    // production. Fallback (offline seed, no link): SAFE exact matches on id/short/name so a
    // department still shows its indicators without risking a fuzzy mis-link.
    const nId=norm(deptId), nShort=norm(dept.short), nName=norm(dept.name);
    const area = areas.find(a=> (qk&&a.key===qk) || a.deptId===deptId)
      || areas.find(a=> norm(a.key)===nId || norm(a.key)===nShort || norm(a.name)===nName);
    if(!area || !(area.indicators && area.indicators.length)) return null;
    const Qh = window.UNICO_Q;                 // authoritative quality-compute helpers
    if(!Qh) return null;
    const fy = Qh.defaultFy(areas);            // reporting year with the most data
    const months = Qh.fyAxis(fy);              // year-aware [key,label,Q] month tuples
    let capaMap={}; try{ capaMap=JSON.parse(localStorage.getItem('unico_capa_v1'))||{}; }catch(e){} if(Array.isArray(capaMap)) capaMap={};
    let latestMk=null;
    months.forEach(m=>{ if((area.indicators||[]).some(ind=>Qh.qcCellVal(ind,m)!=null)) latestMk=m[0]; });
    const rows=(area.indicators||[]).map(ind=>{
      let lastVal=null;
      months.forEach(m=>{ const v=Qh.qcCellVal(ind,m); if(v!=null) lastVal=v; });   // latest reported value (quarter/year-aware)
      const reported = Qh.hasData(ind, months);
      const breaches = Qh.countBreaches(ind, months);
      const status = Qh.qStatus(ind, lastVal);
      const capa = capaMap[area.key+'/'+ind.id];
      const pct = Qh.isPctInd(ind);
      const bench = ind.benchmark || (ind.benchmarkValue!=null&&ind.benchmarkValue!==''?((ind.goalDirection==='higher_is_better'?'≥ ':'≤ ')+ind.benchmarkValue+(pct?' %':'')):'—');
      return { ind, id:ind.id, name:ind.name, latestVal:lastVal, status, pct, bench, reported, anyBreach:breaches>0, capa, capaOpen:(breaches>0)&&capa!=='Closed' };
    });
    const agg = Qh.deptStat(area, months);     // {ok,breach,na,rate} — same math as the console
    const reported = rows.filter(r=>r.reported);
    const onBench = reported.filter(r=>r.status==='ok').length;
    const openBreach = reported.filter(r=>r.status==='breach').length;
    const actionPlans = rows.filter(r=>r.capaOpen);
    return { area, rows, reported, onBench, openBreach, zero:agg.rate, capaOpen:actionPlans.length, actionPlans, latestMonth:latestMk, reportedCount: reported.length, fy };
  }catch(e){ return null; }
}
window.unicoDeptQuality=unicoDeptQuality;

const Q_DOT={ok:'#1f9d57',breach:'#d23a52',na:'#c4ccd6'};
function unicoIndVal(r){ if(r.latestVal==null) return '—'; try{ if(window.UNICO_Q&&window.UNICO_Q.fmtVal) return window.UNICO_Q.fmtVal(r.ind, r.latestVal); }catch(e){} return r.pct? r.latestVal+'%' : String(r.latestVal); }

// Indicators-vs-benchmark card (used in Combined + Quality tabs)
function DeptQualityBench({Q, showAll}){
  const rows = showAll ? Q.rows : Q.reported;
  const mShort=mk=>String(mk||'').split('-')[0];
  return (
    <div className="card" style={{overflow:'hidden'}}>
      <div className="card-h">
        <h3>Indicators vs benchmark{Q.latestMonth?' · '+mShort(Q.latestMonth):''}</h3>
        <span className="spacer"/>
        <span className="chip pos">{Q.onBench} / {Q.reportedCount}</span>
      </div>
      <div style={{padding:'4px 0'}}>
        {rows.length===0 && <div style={{padding:'20px 16px',textAlign:'center',color:'var(--muted)',fontSize:12.5}}>No indicator data reported yet.</div>}
        {rows.map((r,i)=>{
          const breach=r.status==='breach';
          return (
            <div key={r.id} style={{display:'flex',alignItems:'center',gap:11,padding:'11px 16px',borderBottom:i<rows.length-1?'1px solid #f2f5f9':'none',background:breach?'#fdf1f3':'transparent'}}>
              <span style={{width:9,height:9,borderRadius:'50%',background:Q_DOT[r.status]||Q_DOT.na,flexShrink:0}}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12.5,fontWeight:600,color:breach?'#d23a52':'var(--ink)'}}>{r.name}{breach&&<span style={{fontSize:9.5,fontWeight:700,background:'#d23a52',color:'#fff',padding:'1px 6px',borderRadius:9,marginLeft:7}}>BREACH</span>}</div>
                <div style={{fontSize:10.5,color:breach?'#c0757f':'var(--faint)'}}>target {r.bench}</div>
              </div>
              <span className="num" style={{fontSize:14,fontWeight:breach?700:600,color:breach?'#d23a52':'var(--ink)'}}>{unicoIndVal(r)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Action-plan (CAPA) cards for a department's open breaches
function DeptActionPlans({Q}){
  if(!Q.actionPlans.length) return null;
  return Q.actionPlans.map((r)=>(
    <div key={r.id} className="card" style={{borderLeft:'4px solid #e08a1e',padding:'14px 16px'}}>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
        <Ic d={I.doc} s={16} c="#e08a1e"/>
        <div style={{fontSize:13,fontWeight:700}}>Action Plan · {r.name}</div>
        <span style={{marginLeft:'auto',fontSize:10,fontWeight:700,background:'#fdf3e3',color:'#e08a1e',padding:'2px 8px',borderRadius:20,textTransform:'uppercase'}}>{r.capa||'Open'}</span>
      </div>
      <div style={{fontSize:12,color:'var(--ink-2)',lineHeight:1.5}}>Off benchmark (target {r.bench}) — corrective action required. <span style={{color:'var(--faint)'}}>Latest reading {unicoIndVal(r)}.</span></div>
    </div>
  ));
}

function DeptDetail({dept, openDept, depts, setRoute}){
  const d=dept;
  const [chart,setChart]=React.useState('bar');
  const Q=React.useMemo(()=>unicoDeptQuality(d),[d.id]);
  const editData=()=>{ if(setRoute) setRoute({view:'input',dept:d.id}); };
  const exportCSV=()=>{
    const cols=d.cols;
    const esc=v=>`"${String(v==null?'':v).replace(/"/g,'""')}"`;
    const lines=[['Month',...cols.map(c=>c.label)].map(esc).join(',')];
    d.series.forEach(r=>lines.push([r.full||r.month,...cols.map(c=>r[c.id]==null?'':r[c.id])].map(esc).join(',')));
    try{
      const blob=new Blob([lines.join('\n')],{type:'text/csv;charset=utf-8'});
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a'); a.href=url; a.download=`${d.short}-data.csv`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1500);
      window.UI&&window.UI.toast(`Exported ${d.short} data (CSV)`,'success');
    }catch(e){ window.UI&&window.UI.toast('Export failed','error'); }
  };
  const tone=PALETTE[(d.id.charCodeAt(0))%PALETTE.length];
  const multi=d.cols.length>1;
  const breakdownCols=d.cols.filter(c=>c.id!==d.primary && !c.pct);
  const mixSeries=breakdownCols.slice(0,6).map((c,i)=>({id:c.id,label:c.label,color:PALETTE[i]}));

  // ---- time range (Statistics tab): monthly / last N / custom / latest ----
  const [rangeMode,setRangeMode]=React.useState('all');
  const [fromM,setFromM]=React.useState(d.months[0]);
  const [toM,setToM]=React.useState(d.months[d.months.length-1]);
  let vs=d.series;
  if(rangeMode==='l3') vs=d.series.slice(-3);
  else if(rangeMode==='l6') vs=d.series.slice(-6);
  else if(rangeMode==='latest') vs=d.series.slice(-1);
  else if(rangeMode==='custom'){ const fi=d.months.indexOf(fromM),ti=d.months.indexOf(toM); const a=Math.min(fi,ti),b=Math.max(fi,ti); vs=d.series.slice(a,b+1); }
  if(!vs.length) vs=d.series.slice(-1);
  const vTotal=vs.reduce((s,r)=>s+(r[d.primary]||0),0);
  const vLatest=vs[vs.length-1]||{};
  const vPrev=vs.length>1?vs[vs.length-2]:null;
  const vDelta=vPrev?(()=>{const c=vLatest[d.primary]||0,p=vPrev[d.primary]||0;return p===0?(c>0?100:0):Math.round((c-p)/p*100);})():d.delta;
  const vPeak=vs.length?Math.max(...vs.map(r=>r[d.primary]||0)):0;
  const vAvg=vs.length?Math.round(vTotal/vs.length):0;
  const mixDonut=breakdownCols.map((c,i)=>({label:c.label,value:vs.reduce((s,r)=>s+(r[c.id]||0),0),color:PALETTE[i%PALETTE.length]})).filter(x=>x.value>0);
  const rangeLabel=rangeMode==='all'?`all ${d.series.length} months`:rangeMode==='latest'?'latest month':rangeMode==='l3'?'last 3 months':rangeMode==='l6'?'last 6 months':`${vs[0]?.month||''} → ${vs[vs.length-1]?.month||''}`;
  const selSty={padding:'6px 9px',border:'1px solid var(--line)',borderRadius:6,fontSize:12,fontFamily:'var(--mono)',background:'#fff'};

  const stat=(label,val,sub,chip)=>(
    <div className="card" style={{padding:'13px 15px',display:'flex',flexDirection:'column',gap:5}}>
      <div className="lbl" style={{fontSize:10.5,color:'var(--muted)',textTransform:'uppercase',letterSpacing:.4,fontWeight:600}}>{label}</div>
      <div style={{display:'flex',alignItems:'baseline',gap:8}}>
        <div className="num" style={{fontSize:24,fontWeight:600,color:'var(--ink)'}}>{val}</div>
        {chip}
      </div>
      <div style={{fontSize:11,color:'var(--faint)'}}>{sub}</div>
    </div>
  );

  // ---------- shared header: back link + identity + Combined/Statistics/Quality tabs ----------
  const header=(
    <div style={{display:'flex',alignItems:'center',gap:14,flexWrap:'wrap'}}>
      <span onClick={()=>setRoute&&setRoute({view:'departments'})} style={{cursor:'pointer',display:'inline-flex',alignItems:'center',gap:6,color:'var(--muted)',fontSize:12.5,fontWeight:600}}><Ic d="M15 6l-6 6 6 6" s={15}/>All departments</span>
      <div style={{width:46,height:46,borderRadius:12,background:tone+'18',color:tone,display:'grid',placeItems:'center'}}><Ic d={DEPT_ICON[d.id]||I.activity} s={24}/></div>
      <div style={{minWidth:0}}>
        <div style={{fontSize:20,fontWeight:700,letterSpacing:-.3}}>{d.name}</div>
        <div style={{fontSize:12,color:'var(--muted)'}}>{d.group}{Q?` · ${Q.rows.length} quality indicator${Q.rows.length===1?'':'s'} tracked`:(d.desc?' · '+d.desc:'')}</div>
      </div>
      <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
        <button className="btn sm" onClick={()=>setRoute&&setRoute({view:'gallery',dept:d.id})} title="All charts + export"><Ic d={I.grid} s={15}/>All Charts</button>
        <button className="btn sm" onClick={exportCSV}><Ic d={I.download} s={15}/>Export</button>
        <button className="btn sm" onClick={editData}><Ic d={I.edit} s={15}/>Edit Data</button>
        <button className="btn pri sm" onClick={editData} title={`Enter data for ${d.name}`}><Ic d={I.input} s={15}/>Quick Entry</button>
      </div>
    </div>
  );

  // ---------- combined: 5-KPI row ----------
  const qColor = Q ? (Q.zero>=90?'#1f9d57':Q.zero>=70?'#e08a1e':'#d23a52') : 'var(--ink)';
  const qkTile=(eye,eyeColor,val,valColor,foot)=>(
    <div className="card" style={{padding:'13px 15px'}}>
      <div style={{fontSize:10,textTransform:'uppercase',letterSpacing:.5,color:eyeColor,fontWeight:700,marginBottom:8}}>{eye}</div>
      <div className="num" style={{fontSize:24,fontWeight:600,lineHeight:1,color:valColor||'var(--ink)'}}>{val}</div>
      <div style={{fontSize:11,color:'var(--muted)',marginTop:5}}>{foot}</div>
    </div>
  );
  const deltaTxt=v=><span style={{color:v>=0?'#1f9d57':'#d23a52',fontWeight:600}}>{v>=0?'▲':'▼'}{Math.abs(v)}%</span>;
  const kpiRow=(
    <div className="grid" style={{gridTemplateColumns:'repeat(5,1fr)',gap:12}}>
      {qkTile('◆ Volume','#0090ca',fmt(d.latest[d.primary]||0),'var(--ink)',<span>Latest {d.primaryLabel} {deltaTxt(d.delta)}</span>)}
      {qkTile('◆ Volume','#0090ca',fmt(d.avg),'var(--ink)','Monthly average')}
      {qkTile('● Quality',qColor,Q?Q.zero+'%':'—',qColor,'Zero-Defect')}
      {qkTile('● Quality','#d23a52',Q?String(Q.openBreach):'—',Q&&Q.openBreach>0?'#d23a52':'var(--ink)','Off Benchmark')}
      {qkTile('● Quality','#e08a1e',Q?String(Q.capaOpen):'—',Q&&Q.capaOpen>0?'#e08a1e':'var(--ink)','Action Plan'+(Q&&Q.capaOpen===1?'':'s'))}
    </div>
  );

  // ONE unified department page — statistics and quality merged into a single flow
  // (no Combined/Statistics/Quality tabs), organized by section.
  return (
    <div className="grid" style={{gap:16}}>
      {header}
      {kpiRow}

      {/* ===== Patient Volume ===== */}
      <div className="eyebrow" style={{marginTop:2}}>Patient Volume</div>
      <div className="card" style={{padding:'10px 14px',display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
        <span style={{fontSize:12,fontWeight:700,color:'var(--ink-2)',display:'flex',alignItems:'center',gap:6}}><Ic d={I.cal} s={15} c="var(--blue)"/>View</span>
        <div className="seg">
          {[['all','Monthly'],['l3','Last 3M'],['l6','Last 6M'],['latest','Latest'],['custom','Custom']].map(([id,l])=>(
            <button key={id} className={rangeMode===id?'on':''} onClick={()=>setRangeMode(id)}>{l}</button>
          ))}
        </div>
        {rangeMode==='custom'&&(<React.Fragment>
          <span style={{fontSize:12,color:'var(--muted)'}}>From</span>
          <select style={selSty} value={fromM} onChange={e=>setFromM(e.target.value)}>{d.months.map(m=><option key={m} value={m}>{m}</option>)}</select>
          <span style={{fontSize:12,color:'var(--muted)'}}>To</span>
          <select style={selSty} value={toM} onChange={e=>setToM(e.target.value)}>{d.months.map(m=><option key={m} value={m}>{m}</option>)}</select>
        </React.Fragment>)}
        <span className="spacer"/>
        <span style={{fontSize:11.5,color:'var(--faint)'}}>Showing {rangeLabel} · {vs.length} point{vs.length>1?'s':''}</span>
      </div>

      <div className="grid" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
        {stat(`${d.primaryLabel} · ${vLatest.month||''}`, fmt(vLatest[d.primary]||0), 'latest in range', <Delta v={vDelta}/>)}
        {stat('Range Total', fmt(vTotal), `${vs.length} month${vs.length>1?'s':''} · ${rangeLabel}`)}
        {stat('Peak Month', fmt(vPeak), vs.find(r=>(r[d.primary]||0)===vPeak)?.full||'')}
        {stat('Monthly Average', fmt(vAvg), 'mean across range')}
      </div>

      <div className="grid" style={{gridTemplateColumns:(multi&&mixDonut.length>1)?'1.55fr 1fr':'1fr'}}>
        <div className="card">
          <div className="card-h">
            <h3>{d.primaryLabel} — Monthly Trend</h3>
            <span className="spacer"/>
            <div className="seg" style={{flexWrap:'wrap'}}>
              {['bar','3d','line','area','combo','horizontal',multi&&'grouped',multi&&'stacked',multi&&'pct',mixDonut.length>1&&'donut'].filter(Boolean).map(t=>(
                <button key={t} className={chart===t?'on':''} onClick={()=>setChart(t)}>{t==='3d'?'3D':t==='combo'?'Bar+Line':t==='pct'?'100%':t==='horizontal'?'Horiz':t[0].toUpperCase()+t.slice(1)}</button>
              ))}
            </div>
          </div>
          <div className="card-b">
            {chart==='bar'&&<BarChart data={vs} x="month" y={d.primary} height={280} color={tone}/>}
            {chart==='3d'&&<Bar3D data={vs} x="month" y={d.primary} height={300} color={tone}/>}
            {chart==='line'&&<LineChart data={vs} x="full" y={d.primary} height={280} color={tone}/>}
            {chart==='area'&&typeof window.AreaTargetChart==='function'&&<AreaTargetChart data={vs} x="full" y={d.primary} target={vAvg} height={280} color={tone}/>}
            {chart==='combo'&&typeof window.ComboChart==='function'&&(()=>{const pc=d.cols.find(c=>c.pct);const lk=pc?pc.id:((mixSeries[0]||{}).id||d.primary);return <ComboChart data={vs} x="month" barKey={d.primary} lineKey={lk} barColor={tone} lineColor="#e08a1e" barLabel={d.primaryLabel||'Value'} lineLabel={(d.cols.find(c=>c.id===lk)||{}).label||'Trend'} height={300}/>;})()}
            {chart==='horizontal'&&typeof window.HBarChart==='function'&&<HBarChart data={vs.map(r=>({label:r.full,val:r[d.primary]||0}))} x="label" y="val" height={Math.max(180,vs.length*32)}/>}
            {chart==='grouped'&&<GroupedBar data={vs} x="month" series={mixSeries} height={290}/>}
            {chart==='stacked'&&<StackedBar data={vs} x="month" series={mixSeries} height={290}/>}
            {chart==='pct'&&typeof window.StackedPctBar==='function'&&<StackedPctBar data={vs} x="month" series={mixSeries} height={290}/>}
            {chart==='donut'&&<div style={{display:'grid',placeItems:'center',minHeight:280}}><Donut data={mixDonut} size={200} centerValue={fmt(mixDonut.reduce((s,x)=>s+x.value,0))} centerLabel="Total"/></div>}
          </div>
        </div>
        {multi&&mixDonut.length>1&&(
          <div className="card">
            <div className="card-h"><h3>Composition</h3><span className="sub">period total</span></div>
            <div className="card-b" style={{display:'grid',placeItems:'center'}}><Donut data={mixDonut} size={186} centerValue={fmt(mixDonut.reduce((s,x)=>s+x.value,0))} centerLabel="Total"/></div>
          </div>
        )}
      </div>

      <div className="card" style={{overflow:'hidden'}}>
        <div className="card-h"><h3>Monthly Data Table</h3><span className="spacer"/><button className="btn sm" onClick={exportCSV}><Ic d={I.download} s={14}/>CSV</button></div>
        <div style={{overflowX:'auto'}}>
          <table className="tbl">
            <thead><tr><th>Month</th>{d.cols.map(c=><th key={c.id}>{c.label}</th>)}</tr></thead>
            <tbody>
              {vs.map((r,i)=>(
                <tr key={i}><td>{r.full}</td>{d.cols.map(c=><td key={c.id}>{r[c.id]==null?'–':(c.pct?r[c.id]+'%':fmt(r[c.id]))}</td>)}</tr>
              ))}
              <tr className="tot"><td>TOTAL</td>{d.cols.map(c=>(
                <td key={c.id}>{c.pct?'—':fmt(vs.reduce((s,r)=>s+(r[c.id]||0),0))}</td>
              ))}</tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== Quality & Safety (same page, merged) ===== */}
      <div className="eyebrow" style={{marginTop:6}}>Quality &amp; Safety</div>
      {Q ? (<React.Fragment>
        <div className="grid" style={{gridTemplateColumns:Q.actionPlans.length?'1.5fr 1fr':'1fr',alignItems:'start'}}>
          <DeptQualityBench Q={Q} showAll/>
          {Q.actionPlans.length>0 && <div className="grid" style={{gap:12,alignContent:'start'}}><DeptActionPlans Q={Q}/></div>}
        </div>
        {Q.actionPlans.length===0 && <div className="card" style={{padding:'14px 16px',fontSize:12,color:'var(--muted)',display:'flex',alignItems:'center',gap:8}}><Ic d={I.check} s={16} c="#1f9d57"/>No open action plans — reported indicators on benchmark.</div>}
        <div><button className="btn sm" onClick={()=>setRoute&&setRoute({view:'quality'})}><Ic d={I.arrowR} s={14}/>Open full Quality console</button></div>
      </React.Fragment>) : (
        <div className="card" style={{padding:'28px 16px',textAlign:'center',color:'var(--muted)',fontSize:12.5}}>
          <div style={{fontSize:14,fontWeight:600,color:'var(--ink)'}}>No quality indicators linked</div>
          <div style={{margin:'6px 0 14px'}}>This department has no quality area yet.</div>
          <button className="btn sm" onClick={()=>setRoute&&setRoute({view:'quality'})}><Ic d={I.heart} s={14}/>Open Quality board</button>
        </div>
      )}

      <div style={{marginTop:4}}>
        <SectionTitle icon={I.layers} title="Jump to another department"/>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          {depts.filter(x=>x.id!==d.id).map(x=>(
            <button key={x.id} className="btn sm" onClick={()=>openDept(x.id)}>
              <Ic d={DEPT_ICON[x.id]||I.activity} s={14}/>{x.short}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
window.DeptDetail=DeptDetail;

/* UNICO — Departments landing grid (grouped by service line), per UNICO.dc.html.
   Shown for route {view:'departments'} with NO dept selected; a card opens Dept 360. */
function DeptCardTile({d, onOpen}){
  const tone=PALETTE[(d.id.charCodeAt(0)+d.id.length)%PALETTE.length];
  return (
    <div className="card" onClick={onOpen}
      style={{cursor:'pointer',padding:'14px 15px'}}
      onMouseEnter={e=>e.currentTarget.style.boxShadow='var(--shadow-md)'}
      onMouseLeave={e=>e.currentTarget.style.boxShadow='var(--shadow)'}>
      <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:11}}>
        <div style={{width:32,height:32,borderRadius:9,background:tone+'18',color:tone,display:'grid',placeItems:'center'}}><Ic d={DEPT_ICON[d.id]||I.activity} s={17}/></div>
        <div style={{minWidth:0}}>
          <div style={{fontSize:13.5,fontWeight:700,color:'var(--ink)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:150}}>{d.short}</div>
          <div style={{fontSize:10.5,color:'var(--faint)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:150}}>{d.name}</div>
        </div>
        <span style={{marginLeft:'auto'}}><Delta v={d.delta}/></span>
      </div>
      <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between'}}>
        <div style={{minWidth:0}}>
          <div className="num" style={{fontSize:23,fontWeight:600,color:'var(--ink)',lineHeight:1}}>{fmt(d.latest[d.primary]||0)}</div>
          <div style={{fontSize:10,color:'var(--faint)',fontWeight:600,marginTop:3,whiteSpace:'nowrap'}}>{d.latest.full||d.latest.month||'No data'}</div>
        </div>
        <Spark values={d.series.map(r=>r[d.primary]||0)} color={tone} w={96} h={34}/>
      </div>
    </div>
  );
}

function DeptGrid({depts, openDept, setRoute}){
  const [mode,setMode]=React.useState('group');   // group | alpha | gaps
  const [showFilter,setShowFilter]=React.useState(false);
  const [q,setQ]=React.useState('');
  const GROUPS=window.UNICO.GROUPS;
  const allM=[...new Set(depts.flatMap(d=>d.months||[]))];
  const gapOf=d=>allM.length-((d.months&&d.months.length)||0);
  const query=q.trim().toLowerCase();
  const shown=query?depts.filter(d=>((d.name||'')+' '+(d.short||'')).toLowerCase().includes(query)):depts;

  let groups;
  if(mode==='alpha'){
    const list=[...shown].sort((a,b)=>String(a.name).localeCompare(String(b.name)));
    groups=[{name:'All Departments',color:PALETTE[0],count:list.length,tot:fmt(list.reduce((s,d)=>s+d.total,0))+' cases',cards:list}];
  } else if(mode==='gaps'){
    const need=shown.filter(d=>gapOf(d)>0).sort((a,b)=>gapOf(b)-gapOf(a));
    const ok=shown.filter(d=>gapOf(d)===0);
    groups=[
      need.length?{name:'Needs attention',color:'#d23a52',count:need.length,tot:'missing months',cards:need}:null,
      ok.length?{name:'Up to date',color:'#1f9d57',count:ok.length,tot:'complete',cards:ok}:null,
    ].filter(Boolean);
  } else {
    groups=GROUPS.map((g,i)=>{
      const cards=shown.filter(d=>d.group===g);
      return cards.length?{name:g,color:PALETTE[i%PALETTE.length],count:cards.length,tot:fmt(cards.reduce((s,d)=>s+d.total,0))+' cases',cards}:null;
    }).filter(Boolean);
    const other=shown.filter(d=>GROUPS.indexOf(d.group)<0);
    if(other.length) groups.push({name:'Other',color:PALETTE[GROUPS.length%PALETTE.length],count:other.length,tot:fmt(other.reduce((s,d)=>s+d.total,0))+' cases',cards:other});
  }

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20,flexWrap:'wrap'}}>
        <div style={{fontSize:12,color:'var(--muted)',fontWeight:600}}>Group by</div>
        <div className="seg">
          {[['group','Service line'],['alpha','Alphabetical'],['gaps','Reporting gaps']].map(([id,l])=>(
            <button key={id} className={mode===id?'on':''} onClick={()=>setMode(id)}>{l}</button>
          ))}
        </div>
        {showFilter&&(
          <input autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder="Filter departments…"
            style={{padding:'6px 10px',border:'1px solid var(--line)',borderRadius:8,fontSize:12.5,fontFamily:'inherit',background:'#fff',width:180,outline:'none'}}/>
        )}
        <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:8}}>
          <button className={'btn sm'+(showFilter?' pri':'')} onClick={()=>{ setShowFilter(v=>!v); if(showFilter) setQ(''); }}><Ic d={I.filter} s={14}/>Filter</button>
          <button className="btn pri sm" onClick={()=>setRoute&&setRoute({view:'manage'})}><Ic d={I.plus} s={14}/>Add Department</button>
        </div>
      </div>
      {groups.length===0&&(
        <div style={{padding:'40px 16px',textAlign:'center',color:'var(--muted)',fontSize:13}}>No departments match “{q}”.</div>
      )}
      {groups.map((g,gi)=>(
        <React.Fragment key={gi}>
          <div style={{display:'flex',alignItems:'center',gap:11,margin:'0 0 12px'}}>
            <span style={{width:11,height:11,borderRadius:4,background:g.color}}/>
            <div style={{fontSize:15,fontWeight:700}}>{g.name}</div>
            <span className="num" style={{fontSize:10.5,fontWeight:600,background:'#f2f5f9',color:'#5b6b80',padding:'2px 8px',borderRadius:20}}>{g.count}</span>
            <div style={{flex:1,height:1,background:'#e3e9f1'}}/>
            <span style={{fontSize:12,color:'var(--muted)'}}>{g.tot}</span>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(252px,1fr))',gap:12,marginBottom:26}}>
            {g.cards.map(d=><DeptCardTile key={d.id} d={d} onOpen={()=>openDept(d.id)}/>)}
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}
window.DeptGrid=DeptGrid;
