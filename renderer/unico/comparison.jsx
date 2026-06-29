/* UNICO — Compare Departments */
function DeptCompare({depts, openDept}){
  const {useState, useMemo} = React;

  // ---- selection (default: first 3, max 6) ----
  const MAX=6;
  const [sel,setSel]=useState(()=>depts.slice(0,3).map(d=>d.id));
  const toggle=id=>setSel(s=>{
    if(s.includes(id)) return s.filter(x=>x!==id);
    if(s.length>=MAX) return s; // cap
    return [...s,id];
  });

  // ---- metric selector: primary + columns shared across selected depts ----
  const selDepts=useMemo(()=>sel.map(id=>depts.find(d=>d.id===id)).filter(Boolean),[sel,depts]);

  // candidate metrics: any non-percent column id that appears (with same id) on >=2 selected depts.
  const metricOptions=useMemo(()=>{
    const count={}, labelOf={};
    selDepts.forEach(d=>{
      (d.cols||[]).forEach(c=>{
        if(c.pct) return; // percentages aren't comparable as raw counts
        count[c.id]=(count[c.id]||0)+1;
        if(!labelOf[c.id]) labelOf[c.id]=c.label;
      });
    });
    const opts=[{id:'__primary__',label:'Primary metric (per dept)'}];
    Object.keys(count).forEach(id=>{
      if(count[id]>=2 && id!=='__primary__') opts.push({id,label:labelOf[id]});
    });
    return opts;
  },[selDepts]);

  const [metric,setMetric]=useState('__primary__');
  // if current metric vanished from options (selection changed), reset to primary
  React.useEffect(()=>{
    if(!metricOptions.some(o=>o.id===metric)) setMetric('__primary__');
  },[metricOptions]); // eslint-disable-line

  // resolve the metric key for a given dept (fall back to its primary if missing)
  const keyFor=d=>{
    if(metric==='__primary__') return d.primary;
    return (d.cols||[]).some(c=>c.id===metric && !c.pct) ? metric : d.primary;
  };
  const metricLabel=metric==='__primary__'?'Primary metric':(metricOptions.find(o=>o.id===metric)?.label||metric);

  // ---- range control ----
  const [rangeMode,setRangeMode]=useState('all');
  const RANGE=[['all','All'],['l6','Last 6M'],['l3','Last 3M'],['latest','Latest']];
  const sliceN=rangeMode==='l3'?3:rangeMode==='l6'?6:rangeMode==='latest'?1:0;
  const inRange=(d)=>{
    const s=d.series||[];
    if(!s.length) return [];
    if(rangeMode==='all') return s;
    return s.slice(-sliceN);
  };

  // ---- per-dept computed stats over range ----
  const stats=useMemo(()=>selDepts.map(d=>{
    const k=keyFor(d);
    const vs=inRange(d);
    const vals=vs.map(r=>r[k]||0);
    const total=vals.reduce((a,b)=>a+b,0);
    const latestRow=vs[vs.length-1]||{};
    const prevRow=vs.length>1?vs[vs.length-2]:null;
    const latest=latestRow[k]||0;
    const prev=prevRow?(prevRow[k]||0):null;
    const delta=prev==null?0:(prev===0?(latest>0?100:0):Math.round((latest-prev)/prev*100));
    const peak=vals.length?Math.max(...vals):0;
    const avg=vals.length?Math.round(total/vals.length):0;
    const tone=PALETTE[Math.abs(d.id.charCodeAt(0)+d.id.length)%PALETTE.length];
    return {d, k, vs, total, latest, latestMonth:latestRow.month||'—', delta, hasPrev:prev!=null, peak, avg, count:vals.length, tone, empty:!vs.length};
  }),[selDepts, metric, rangeMode]);

  // ---- merged month axis for the grouped chart (union of months in range) ----
  const chartData=useMemo(()=>{
    const monthSet=[];
    stats.forEach(st=>st.vs.forEach(r=>{ if(!monthSet.includes(r.month)) monthSet.push(r.month); }));
    // order months by global month order
    const order=window.UNICO&&window.UNICO.MONTH_ORDER;
    monthSet.sort((a,b)=> order?order.indexOf(a)-order.indexOf(b):0);
    return monthSet.map(m=>{
      const row={month:m};
      stats.forEach(st=>{
        const hit=st.vs.find(r=>r.month===m);
        row[st.d.id]=hit?(hit[st.k]||0):0;
      });
      return row;
    });
  },[stats]);

  const chartSeries=stats.map(st=>({id:st.d.id, label:st.d.short, color:st.tone}));

  // ===== EDGE CASES =====
  const tooFew=selDepts.length<2;

  // small helpers
  const rangeNote=rangeMode==='all'?'all reported months':rangeMode==='latest'?'latest month':rangeMode==='l3'?'last 3 months':'last 6 months';

  return (
    <div className="grid" style={{gap:16}}>
      <SectionTitle icon={I.layers} title="Compare Departments"
        sub={`Side-by-side comparison of patient-flow metrics · ${metricLabel} · ${rangeNote}`}/>

      {/* ---- controls: pickers + metric + range ---- */}
      <div className="card" style={{padding:'14px 16px',display:'flex',flexDirection:'column',gap:13}}>
        {/* department picker */}
        <div>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:9}}>
            <span style={{fontSize:12,fontWeight:700,color:'var(--ink-2)',display:'flex',alignItems:'center',gap:6}}>
              <Ic d={I.layers} s={15} c="var(--blue)"/>Departments
            </span>
            <span style={{fontSize:11,color:'var(--faint)'}}>{sel.length}/{MAX} selected · pick 2–{MAX}</span>
            <span className="spacer"/>
            <button className="btn sm" onClick={()=>setSel(depts.slice(0,3).map(d=>d.id))}>Reset</button>
          </div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {depts.map(d=>{
              const on=sel.includes(d.id);
              const idx=sel.indexOf(d.id);
              const tone=on?PALETTE[Math.abs(d.id.charCodeAt(0)+d.id.length)%PALETTE.length]:null;
              const disabled=!on && sel.length>=MAX;
              return (
                <button key={d.id} onClick={()=>toggle(d.id)} disabled={disabled}
                  title={disabled?`Max ${MAX} departments`:d.name}
                  style={{display:'inline-flex',alignItems:'center',gap:7,padding:'6px 11px',borderRadius:8,
                    border:'1px solid '+(on?tone:'var(--line)'),
                    background:on?(tone+'14'):'#fff',
                    color:on?tone:'var(--ink-2)',
                    fontSize:12,fontWeight:600,
                    opacity:disabled?.45:1,cursor:disabled?'not-allowed':'pointer',
                    transition:'.15s'}}>
                  <span style={{width:16,height:16,borderRadius:4,display:'grid',placeItems:'center',flexShrink:0,
                    border:'1.5px solid '+(on?tone:'var(--line)'),background:on?tone:'#fff',color:'#fff'}}>
                    {on&&<Ic d={I.check} s={11} c="#fff" sw={2.6}/>}
                  </span>
                  <Ic d={DEPT_ICON[d.id]||I.activity} s={15}/>
                  {d.short}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{height:1,background:'var(--line-2)'}}/>

        {/* metric + range */}
        <div style={{display:'flex',alignItems:'center',gap:14,flexWrap:'wrap'}}>
          <span style={{fontSize:12,fontWeight:700,color:'var(--ink-2)',display:'flex',alignItems:'center',gap:6}}>
            <Ic d={I.trend} s={15} c="var(--blue)"/>Metric
          </span>
          <div className="seg">
            {metricOptions.map(o=>(
              <button key={o.id} className={metric===o.id?'on':''} onClick={()=>setMetric(o.id)}>{o.label}</button>
            ))}
          </div>
          <span className="spacer"/>
          <span style={{fontSize:12,fontWeight:700,color:'var(--ink-2)',display:'flex',alignItems:'center',gap:6}}>
            <Ic d={I.cal} s={15} c="var(--blue)"/>Range
          </span>
          <div className="seg">
            {RANGE.map(([id,l])=>(
              <button key={id} className={rangeMode===id?'on':''} onClick={()=>setRangeMode(id)}>{l}</button>
            ))}
          </div>
        </div>
      </div>

      {tooFew ? (
        <div className="card" style={{padding:'48px 20px',textAlign:'center'}}>
          <div style={{width:56,height:56,borderRadius:15,background:'var(--blue-50)',color:'var(--blue)',display:'grid',placeItems:'center',margin:'0 auto 14px'}}><Ic d={I.layers} s={28}/></div>
          <div style={{fontSize:16,fontWeight:700}}>Pick at least 2 departments</div>
          <div style={{fontSize:13,color:'var(--muted)',marginTop:6}}>Select two or more departments above to compare them side by side.</div>
        </div>
      ) : (
        <>
          {/* (a) comparison KPI cards */}
          <div className="grid" style={{gridTemplateColumns:`repeat(${Math.min(stats.length,3)},1fr)`}}>
            {stats.map(st=>{
              const dcls=st.delta>0?'pos':st.delta<0?'neg':'flat';
              const dcol=st.delta>0?'var(--pos)':st.delta<0?'var(--rose)':'var(--slate)';
              const dsym=st.delta>0?'▲':st.delta<0?'▼':'—';
              return (
                <div key={st.d.id} className="card" onClick={()=>openDept(st.d.id)} title={`Open ${st.d.name}`}
                  style={{padding:'14px 16px',display:'flex',flexDirection:'column',gap:10,cursor:'pointer',borderTop:'3px solid '+st.tone}}>
                  <div style={{display:'flex',alignItems:'center',gap:9}}>
                    <div style={{width:32,height:32,borderRadius:9,background:st.tone+'1c',color:st.tone,display:'grid',placeItems:'center',flexShrink:0}}>
                      <Ic d={DEPT_ICON[st.d.id]||I.activity} s={17}/>
                    </div>
                    <div style={{minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:700,color:'var(--ink)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{st.d.short}</div>
                      <div style={{fontSize:10.5,color:'var(--muted)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{st.d.name}</div>
                    </div>
                    <span className="spacer"/>
                    <Ic d={I.arrowR} s={15} c="var(--faint)"/>
                  </div>
                  {st.empty ? (
                    <div style={{fontSize:12,color:'var(--faint)',padding:'8px 0'}}>No data in range</div>
                  ):(
                    <>
                      <div style={{display:'flex',alignItems:'baseline',gap:8}}>
                        <div className="num" style={{fontSize:26,fontWeight:600,color:'var(--ink)',lineHeight:1}}>{fmt(st.latest)}</div>
                        <span className={'chip '+dcls}>{dsym} {Math.abs(st.delta)}%</span>
                      </div>
                      <div style={{display:'flex',gap:14,fontSize:11,color:'var(--faint)'}}>
                        <span>Latest · {st.latestMonth}</span>
                        <span className="spacer"/>
                        <span>Avg <b className="num" style={{color:'var(--ink-2)'}}>{fmt(st.avg)}</b></span>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* (b) comparison chart */}
          <div className="card">
            <div className="card-h">
              <h3>{metricLabel} — Monthly Comparison</h3>
              <span className="sub">{rangeNote}</span>
              <span className="spacer"/>
              <div style={{display:'flex',gap:12,flexWrap:'wrap',justifyContent:'flex-end'}}>
                {chartSeries.map(s=>(
                  <span key={s.id} style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:11.5,color:'var(--ink-2)',fontWeight:600}}>
                    <i style={{width:10,height:10,borderRadius:3,background:s.color,display:'inline-block'}}/>{s.label}
                  </span>
                ))}
              </div>
            </div>
            <div className="card-b">
              {chartData.length===0 ? (
                <div style={{display:'grid',placeItems:'center',minHeight:200,color:'var(--faint)',fontSize:13}}>No data available for the selected range.</div>
              ) : (
                <GroupedBar data={chartData} x="month" series={chartSeries} height={300}/>
              )}
            </div>
          </div>

          {/* (c) comparison table */}
          <div className="card" style={{overflow:'hidden'}}>
            <div className="card-h"><h3>Comparison Table</h3><span className="sub">{metricLabel} · {rangeNote} · click a row to open</span></div>
            <div style={{overflowX:'auto'}}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Department</th>
                    <th>Metric</th>
                    <th>Latest</th>
                    <th>Average</th>
                    <th>Peak</th>
                    <th>Δ vs prev</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map(st=>{
                    const dcls=st.delta>0?'pos':st.delta<0?'neg':'flat';
                    const dsym=st.delta>0?'▲':st.delta<0?'▼':'—';
                    const colLabel=(st.d.cols||[]).find(c=>c.id===st.k)?.label||st.k;
                    return (
                      <tr key={st.d.id} style={{cursor:'pointer'}} onClick={()=>openDept(st.d.id)}>
                        <td>
                          <span style={{display:'inline-flex',alignItems:'center',gap:8}}>
                            <i style={{width:9,height:9,borderRadius:3,background:st.tone,display:'inline-block'}}/>
                            {st.d.name}
                          </span>
                        </td>
                        <td style={{fontFamily:"'IBM Plex Sans'",color:'var(--muted)'}}>{colLabel}</td>
                        <td>{st.empty?'–':fmt(st.latest)}</td>
                        <td>{st.empty?'–':fmt(st.avg)}</td>
                        <td>{st.empty?'–':fmt(st.peak)}</td>
                        <td>{st.empty?'–':<span className={'chip '+dcls}>{dsym} {Math.abs(st.delta)}%</span>}</td>
                        <td>{st.empty?'–':fmt(st.total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
window.DeptCompare=DeptCompare;
