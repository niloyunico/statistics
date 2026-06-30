/* UNICO — Quality Indicators · per-indicator Trend analysis
   Globals reused (from quality.jsx / charts.jsx / ui.jsx):
     QS, QLABEL, QSHORT, QMONTHS, indStatus, indVal, statusTone,
     PALETTE, fmt, SectionTitle, Ic, I.
   DATA SHAPE NOTE: indicator values live ONLY in ind.quarters{Q1..Q4}.
   There is no monthly field in the seed. The "Monthly" toggle therefore
   EXPANDS each quarter's value across its months (via QMONTHS) — the same
   derived approach QualityDept uses — it is not separately-reported data. */

const QT_OK='#1f9d57', QT_BREACH='#d23a52', QT_NA='#9aa6b4', QT_BENCH='#6a52d4';

/* numeric value of an indicator for a quarter (null when not reported) */
function qtNum(ind,q){ const v=ind&&ind.quarters?ind.quarters[q]:null; return (v==null||v==='')?null:(typeof v==='number'?v:Number(v)); }
/* pretty value with %/unit suffix where relevant (mirrors indVal) */
function qtPretty(ind,q){ const v=indVal(ind,q); return v==null?'–':v; }

/* ---- self-contained trend chart: colored points/bars + dashed benchmark ---- */
function TrendChart({points, benchmark, goalDir, mode}){
  const [tip,setTip]=React.useState(null);
  const H=240, padL=34, padR=14, padT=18, padB=26;
  const n=points.length||1;
  const vals=points.map(p=>p.v).filter(v=>v!=null);
  const benchOn=benchmark!=null && isFinite(benchmark);
  let max=Math.max(1,...vals,(benchOn?benchmark:0));
  let min=Math.min(0,...vals,(benchOn?benchmark:0));
  if(max===min) max=min+1;
  const W=Math.max(360, n*60);
  const px=i=>padL+(n<=1?(W-padL-padR)/2:(i/(n-1))*(W-padL-padR));
  const py=v=>padT+(1-((v-min)/(max-min)))*(H-padT-padB);
  const benchY=benchOn?py(benchmark):null;
  const isBar=mode==='bar';
  const grid=[0,.25,.5,.75,1];

  /* polyline through reported points only */
  const linePts=points.map((p,i)=>p.v!=null?[px(i),py(p.v)]:null).filter(Boolean);
  const path=linePts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');

  const colorFor=s=> s==='breach'?QT_BREACH : s==='ok'?QT_OK : QT_NA;
  const bw=Math.min(34,(W-padL-padR)/n*0.5);

  return (
    <div style={{position:'relative'}}>
      <svg viewBox={`0 0 ${W} ${H}`} height={H} preserveAspectRatio="none"
        style={{overflow:'visible',width:'100%',maxWidth:Math.max(160,n*82),margin:'0 auto',display:'block'}}>
        {grid.map((g,i)=>{ const yy=padT+g*(H-padT-padB);
          return <line key={i} x1={padL} x2={W-padR} y1={yy} y2={yy} stroke="#eef1f5"/>; })}
        {/* y-axis min/max ticks */}
        <text x={padL-6} y={py(max)+4} textAnchor="end" fontSize="9.5" fontFamily="IBM Plex Mono" fill="#9aa6b4">{fmt(max)}</text>
        <text x={padL-6} y={py(min)+4} textAnchor="end" fontSize="9.5" fontFamily="IBM Plex Mono" fill="#9aa6b4">{fmt(min)}</text>

        {/* benchmark / target reference line */}
        {benchOn&&(
          <g>
            <line x1={padL} x2={W-padR} y1={benchY} y2={benchY} stroke={QT_BENCH} strokeWidth="1.6" strokeDasharray="6 4" opacity=".85"/>
            <text x={W-padR} y={benchY-5} textAnchor="end" fontSize="9.5" fontFamily="IBM Plex Mono" fontWeight="600" fill={QT_BENCH}>
              target {fmt(benchmark)} {goalDir==='higher_is_better'?'↑':'↓'}
            </text>
          </g>
        )}

        {/* connecting line (line mode only) */}
        {!isBar&&linePts.length>1&&<path d={path} fill="none" stroke="#c2cad6" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>}

        {points.map((p,i)=>{
          const x=px(i);
          if(p.v==null){
            return (
              <g key={i} onMouseMove={e=>setTip({x:e.clientX,y:e.clientY,t:p.label,v:'not reported',c:QT_NA})} onMouseLeave={()=>setTip(null)} style={{cursor:'default'}}>
                <text x={x} y={H-padB+15} textAnchor="middle" fontSize="9.5" fill="#9aa6b4">{p.short}</text>
                <text x={x} y={py(min)-2} textAnchor="middle" fontSize="11" fill="#c4ccd6">–</text>
              </g>
            );
          }
          const col=colorFor(p.status);
          const y=py(p.v);
          return (
            <g key={i} onMouseMove={e=>setTip({x:e.clientX,y:e.clientY,t:p.label,v:p.pretty,c:col,s:p.status})} onMouseLeave={()=>setTip(null)} style={{cursor:'pointer'}}>
              {isBar?(
                <rect x={x-bw/2} y={Math.min(y,py(0))} width={bw} height={Math.abs(py(0)-y)||1} rx="4" fill={col} fillOpacity=".88"/>
              ):(
                <circle cx={x} cy={y} r="5" fill="#fff" stroke={col} strokeWidth="3"/>
              )}
              <text x={x} y={isBar?(y-6):(y-11)} textAnchor="middle" fontSize="10.5" fontFamily="IBM Plex Mono" fontWeight="600" fill={col}>{p.pretty}</text>
              <text x={x} y={H-padB+15} textAnchor="middle" fontSize="9.5" fill="#9aa6b4">{p.short}</text>
            </g>
          );
        })}
      </svg>
      {tip&&(
        <div style={{position:'fixed',left:tip.x,top:tip.y,transform:'translate(-50%,-115%)',background:'#0d1b2e',color:'#fff',
          padding:'7px 10px',borderRadius:7,fontSize:11.5,pointerEvents:'none',zIndex:9999,boxShadow:'0 8px 24px rgba(0,0,0,.3)',whiteSpace:'nowrap'}}>
          <div style={{fontWeight:700,marginBottom:3}}>{tip.t}</div>
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <i style={{width:8,height:8,borderRadius:2,background:tip.c,display:'inline-block'}}/>
            <span className="num">{tip.v}</span>
            {tip.s&&<span style={{color:'#aebccd'}}>· {tip.s==='breach'?'breach':'on target'}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- comparison row (HBar-styled, clickable) ---- */
function CompareRow({label, value, pretty, max, breach, onClick, idx}){
  const [m,setM]=React.useState(false);
  React.useEffect(()=>{ const t=setTimeout(()=>setM(true),30+idx*40); return ()=>clearTimeout(t); },[]);
  const col=breach?QT_BREACH:QT_OK;
  const w=value==null?0:(max>0?Math.max(2,(value/max)*100):2);
  return (
    <div onClick={onClick} title={`Open ${label} quality detail`}
      style={{display:'grid',gridTemplateColumns:'150px 1fr 92px',alignItems:'center',gap:10,cursor:'pointer',
        padding:'4px 6px',borderRadius:8,transition:'background .15s'}}
      onMouseEnter={e=>e.currentTarget.style.background='var(--blue-50)'}
      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
      <div style={{fontSize:12,fontWeight:600,color:'#3c4858',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{label}</div>
      <div style={{height:16,background:'#eef1f5',borderRadius:5,overflow:'hidden'}}>
        <div style={{height:'100%',width:m?w+'%':'0%',background:`linear-gradient(90deg,${col},${col})`,opacity:value==null?.3:1,
          borderRadius:5,transition:`width .8s ${idx*55}ms cubic-bezier(.2,.8,.25,1)`}}/>
      </div>
      <div className="num" style={{fontSize:12.5,fontWeight:600,textAlign:'right',color:breach?QT_BREACH:'#16202e',display:'flex',alignItems:'center',gap:6,justifyContent:'flex-end'}}>
        {pretty}
        {breach&&<span style={{width:7,height:7,borderRadius:'50%',background:QT_BREACH,display:'inline-block'}}/>}
      </div>
    </div>
  );
}

function QualityTrends({setRoute}){
  const deps=(window.QUALITY_SEED||[]).filter(d=>d.indicators&&d.indicators.length);
  const [deptKey,setDeptKey]=React.useState(deps[0]?deps[0].key:null);
  const dept=deps.find(d=>d.key===deptKey)||deps[0]||null;
  const inds=dept?dept.indicators:[];
  const [indId,setIndId]=React.useState(inds[0]?inds[0].id:null);
  const ind=inds.find(x=>x.id===indId)||inds[0]||null;
  const [mode,setMode]=React.useState('line');       // line | bar
  const [gran,setGran]=React.useState('monthly');     // quarterly | monthly

  /* keep indicator valid when department changes */
  React.useEffect(()=>{
    if(!ind || !inds.some(x=>x.id===ind.id)) setIndId(inds[0]?inds[0].id:null);
  },[deptKey]);

  if(!dept||!ind) return <div style={{padding:40,color:'var(--muted)'}}>No quality indicators available.</div>;

  const selDef={padding:'8px 11px',border:'1px solid var(--line)',borderRadius:8,fontSize:12.5,fontFamily:'inherit',background:'#fff',minWidth:170};

  /* ---- build chart points ---- */
  const points = gran==='monthly'
    ? QMONTHS.map(([label,q])=>{ const mk=label.replace(' ','-'); const raw=(typeof qMonthRaw==='function')?qMonthRaw(ind,mk):null;
        const v=raw; const status=indMonthStatus(ind,mk,q);
        return {label, short:label.split(' ')[0], q, v, status, pretty:v==null?'–':(indIsPct(ind)?v+'%':fmt(v))}; })
    : QS.map(q=>{ const status=indStatus(ind,q); const v=qtNum(ind,q);
        return {label:QLABEL[q], short:QSHORT[q], q, v, status, pretty:v==null?'–':qtPretty(ind,q)}; });

  /* ---- stats (over the 4 quarters, the source granularity) ---- */
  const reported=QS.map(q=>({q,v:qtNum(ind,q),status:indStatus(ind,q)})).filter(r=>r.v!=null);
  const nums=reported.map(r=>r.v);
  const higher=ind.goalDirection==='higher_is_better';
  const bench=(ind.benchmarkValue!=null && ind.benchmarkValue!=='' && isFinite(ind.benchmarkValue))?Number(ind.benchmarkValue):null;
  const latest=[...QS].reverse().map(q=>qtNum(ind,q)).find(v=>v!=null);
  const latestQ=[...QS].reverse().find(q=>qtNum(ind,q)!=null);
  const best = nums.length?(higher?Math.max(...nums):Math.min(...nums)):null;
  const worst= nums.length?(higher?Math.min(...nums):Math.max(...nums)):null;
  const breachCount=reported.filter(r=>r.status==='breach').length;
  const onTarget=breachCount===0 && reported.length>0;
  const verdict = reported.length===0 ? 'No data' : (onTarget?'On target':'Breaching');
  const verdictTone = reported.length===0 ? QT_NA : (onTarget?QT_OK:QT_BREACH);
  const unit=(ind.valueType||'').toLowerCase()==='%'?'%':'';
  const f=v=>v==null?'–':(fmt(v)+unit);

  /* ---- department comparison: same indicator NAME across departments ---- */
  const peers=deps.map(d=>{
    const match=(d.indicators||[]).find(x=>x.name===ind.name);
    if(!match) return null;
    const q4=qtNum(match,'Q4');
    let lv=q4, lq='Q4';
    if(lv==null){ for(let i=QS.length-1;i>=0;i--){ const v=qtNum(match,QS[i]); if(v!=null){lv=v;lq=QS[i];break;} } }
    return {key:d.key,name:d.name,ind:match,value:lv,lq,status:lv==null?'na':indStatus(match,lq)};
  }).filter(Boolean);
  const peerMax=Math.max(1,...peers.map(p=>p.value||0));
  const peerUnit=(ind.valueType||'').toLowerCase()==='%'?'%':'';

  const Stat=({label,val,color,foot})=>(
    <div className="card" style={{padding:'13px 15px',display:'flex',flexDirection:'column',gap:4,minHeight:84}}>
      <div style={{fontSize:10.5,color:'var(--muted)',textTransform:'uppercase',letterSpacing:.4,fontWeight:700}}>{label}</div>
      <div className="num" style={{fontSize:23,fontWeight:700,color:color||'var(--ink)',lineHeight:1.05}}>{val}</div>
      {foot&&<div style={{fontSize:10.5,color:'var(--faint)',marginTop:'auto'}}>{foot}</div>}
    </div>
  );

  return (
    <div className="grid" style={{gap:16}}>
      <SectionTitle icon={I.trend} title="Quality Trends" sub="Per-indicator trend & cross-department benchmarking · Jun 2025 – May 2026"/>

      {/* selectors */}
      <div className="card" style={{padding:'12px 16px',display:'flex',alignItems:'center',gap:14,flexWrap:'wrap'}}>
        <button className="btn sm" onClick={()=>setRoute({view:'quality'})}><Ic d={I.chevR} s={14} style={{transform:'rotate(180deg)'}}/>Quality</button>
        <div style={{display:'flex',flexDirection:'column',gap:4}}>
          <label style={{fontSize:10.5,fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:.4}}>Department</label>
          <select value={dept.key} onChange={e=>setDeptKey(e.target.value)} style={selDef}>
            {deps.map(d=><option key={d.key} value={d.key}>{d.name}</option>)}
          </select>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:4}}>
          <label style={{fontSize:10.5,fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:.4}}>Indicator</label>
          <select value={ind.id} onChange={e=>setIndId(e.target.value)} style={{...selDef,minWidth:260}}>
            {inds.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </div>
        <span className="spacer"/>
        <span className="chip" style={{background:higher?'var(--pos-bg)':'#efeafb',color:higher?'var(--pos)':QT_BENCH,fontSize:11.5,padding:'4px 10px'}}>
          {higher?'↑ higher is better':'↓ lower is better'}
        </span>
      </div>

      {/* trend chart */}
      <div className="card">
        <div className="card-h">
          <h3>{ind.name}</h3>
          <span className="sub">benchmark: {ind.benchmark||'—'}</span>
          <span className="spacer"/>
          <div className="seg" style={{marginRight:8}}>
            <button className={gran==='quarterly'?'on':''} onClick={()=>setGran('quarterly')}>Quarterly</button>
            <button className={gran==='monthly'?'on':''} onClick={()=>setGran('monthly')}>Monthly</button>
          </div>
          <div className="seg">
            <button className={mode==='line'?'on':''} onClick={()=>setMode('line')}>Line</button>
            <button className={mode==='bar'?'on':''} onClick={()=>setMode('bar')}>Bar</button>
          </div>
        </div>
        {gran==='monthly'&&(
          <div style={{padding:'8px 16px',fontSize:11,color:'var(--muted)',background:'var(--blue-50)',borderBottom:'1px solid var(--line-2)'}}>
            Monthly view shows each month's reported value (Jun 2025 – May 2026); months with no value fall back to their quarter.
          </div>
        )}
        <div className="card-b">
          <TrendChart points={points} benchmark={bench} goalDir={ind.goalDirection} mode={mode}/>
          <div style={{display:'flex',gap:16,justifyContent:'center',marginTop:10,fontSize:11,color:'var(--muted)',flexWrap:'wrap'}}>
            <span><i style={{display:'inline-block',width:9,height:9,borderRadius:2,background:QT_OK,marginRight:5}}/>on target</span>
            <span><i style={{display:'inline-block',width:9,height:9,borderRadius:2,background:QT_BREACH,marginRight:5}}/>breach</span>
            <span><i style={{display:'inline-block',width:9,height:9,borderRadius:2,background:QT_NA,marginRight:5}}/>not reported</span>
            {bench!=null&&<span><i style={{display:'inline-block',width:14,height:0,borderTop:`2px dashed ${QT_BENCH}`,marginRight:5,verticalAlign:'middle'}}/>target</span>}
          </div>
        </div>
      </div>

      {/* stat cards */}
      <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))'}}>
        <Stat label="Benchmark" val={bench!=null?f(bench):'—'} color={QT_BENCH} foot={higher?'minimum target':'maximum allowed'}/>
        <Stat label="Latest" val={f(latest)} color="#0090ca" foot={latestQ?QSHORT[latestQ]+' value':'not reported'}/>
        <Stat label="Best" val={f(best)} color={QT_OK} foot={higher?'highest reported':'lowest reported'}/>
        <Stat label="Worst" val={f(worst)} color={worst!=null&&bench!=null&&(higher?worst<bench:worst>bench)?QT_BREACH:'var(--ink)'} foot={higher?'lowest reported':'highest reported'}/>
        <Stat label="Breach periods" val={fmt(breachCount)} color={breachCount>0?QT_BREACH:QT_OK} foot={`of ${reported.length} reported`}/>
        <Stat label="Verdict" val={verdict} color={verdictTone} foot={`${reported.length} quarter${reported.length!==1?'s':''} reported`}/>
      </div>

      {/* department comparison */}
      <div className="card">
        <div className="card-h">
          <h3>Department Comparison</h3>
          <span className="sub">“{ind.name}” · latest (or Q4) value per reporting department — click a row</span>
          <span className="spacer"/>
          <span style={{fontSize:11,color:'var(--muted)'}}>{peers.length} dept{peers.length!==1?'s':''} report this</span>
        </div>
        <div className="card-b">
          {peers.length<=1 ? (
            <div style={{padding:'18px 4px',color:'var(--muted)',fontSize:12.5}}>
              No other department reports an indicator named “{ind.name}”. This metric is unique to {dept.name}.
            </div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {peers
                .slice()
                .sort((a,b)=>(b.value==null?-1:b.value)-(a.value==null?-1:a.value))
                .map((p,i)=>(
                  <CompareRow key={p.key} idx={i}
                    label={p.name + (p.key===dept.key?' ·  selected':'')}
                    value={p.value}
                    pretty={p.value==null?'n/r':(fmt(p.value)+peerUnit)+(p.lq?' ('+p.lq+')':'')}
                    max={peerMax}
                    breach={p.status==='breach'}
                    onClick={()=>setRoute({view:'qualityDept',dept:p.key})}/>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

window.QualityTrends=QualityTrends;
