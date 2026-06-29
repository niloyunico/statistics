/* UNICO — Department detail */
function DeptDetail({dept, openDept, depts, setRoute}){
  const d=dept;
  const [chart,setChart]=React.useState('bar');
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

  // ---- time range: monthly / last N / custom / latest ----
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

  return (
    <div className="grid" style={{gap:16}}>
      {/* dept header */}
      <div className="card" style={{padding:'16px 18px',display:'flex',alignItems:'center',gap:14}}>
        <div style={{width:46,height:46,borderRadius:12,background:tone+'18',color:tone,display:'grid',placeItems:'center'}}><Ic d={DEPT_ICON[d.id]||I.activity} s={24}/></div>
        <div>
          <div style={{display:'flex',alignItems:'center',gap:9}}>
            <h2 style={{margin:0,fontSize:19,fontWeight:700}}>{d.name}</h2>
            <span className="tag">{d.group}</span>
          </div>
          <div style={{fontSize:12.5,color:'var(--muted)',marginTop:2}}>{d.desc}</div>
        </div>
        <div className="spacer"/>
        <button className="btn pri sm" onClick={editData} title={`Enter data for ${d.name}`}><Ic d={I.input} s={15}/>Quick Entry</button>
        <div className="tag" style={{background:'var(--pos-bg)',color:'var(--pos)'}}>Last active · {d.latest.month||'—'}</div>
        <button className="btn sm" onClick={()=>setRoute&&setRoute({view:'gallery',dept:d.id})} title="All charts + export"><Ic d={I.grid} s={15}/>All Charts</button>
        <button className="btn sm" onClick={exportCSV}><Ic d={I.download} s={15}/>Export</button>
        <button className="btn sm" onClick={editData}><Ic d={I.edit} s={15}/>Edit Data</button>
      </div>

      {/* time range control */}
      <div className="card" style={{padding:'10px 14px',display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
        <span style={{fontSize:12,fontWeight:700,color:'var(--ink-2)',display:'flex',alignItems:'center',gap:6}}><Ic d={I.cal} s={15} c="var(--blue)"/>View</span>
        <div className="seg">
          {[['all','Monthly'],['l3','Last 3M'],['l6','Last 6M'],['latest','Latest'],['custom','Custom']].map(([id,l])=>(
            <button key={id} className={rangeMode===id?'on':''} onClick={()=>setRangeMode(id)}>{l}</button>
          ))}
        </div>
        {rangeMode==='custom'&&(<>
          <span style={{fontSize:12,color:'var(--muted)'}}>From</span>
          <select style={selSty} value={fromM} onChange={e=>setFromM(e.target.value)}>{d.months.map(m=><option key={m} value={m}>{m}</option>)}</select>
          <span style={{fontSize:12,color:'var(--muted)'}}>To</span>
          <select style={selSty} value={toM} onChange={e=>setToM(e.target.value)}>{d.months.map(m=><option key={m} value={m}>{m}</option>)}</select>
        </>)}
        <span className="spacer"/>
        <span style={{fontSize:11.5,color:'var(--faint)'}}>Showing {rangeLabel} · {vs.length} point{vs.length>1?'s':''}</span>
      </div>

      {/* stat row */}
      <div className="grid" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
        {stat(`${d.primaryLabel} · ${vLatest.month||''}`, fmt(vLatest[d.primary]||0), 'latest in range', <Delta v={vDelta}/>)}
        {stat('Range Total', fmt(vTotal), `${vs.length} month${vs.length>1?'s':''} · ${rangeLabel}`)}
        {stat('Peak Month', fmt(vPeak), vs.find(r=>(r[d.primary]||0)===vPeak)?.full||'')}
        {stat('Monthly Average', fmt(vAvg), 'mean across range')}
      </div>

      {/* main chart */}
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

      {/* breakdown + table */}
      <div className="grid" style={{gridTemplateColumns:multi?'1fr 1.7fr':'1fr'}}>
        {multi&&mixDonut.length>1&&(
          <div className="card">
            <div className="card-h"><h3>Composition</h3><span className="sub">period total</span></div>
            <div className="card-b" style={{display:'grid',placeItems:'center'}}><Donut data={mixDonut} size={172}/></div>
          </div>
        )}
        <div className="card" style={{overflow:'hidden'}}>
          <div className="card-h"><h3>Monthly Data Table</h3><span className="spacer"/><button className="btn sm"><Ic d={I.download} s={14}/>CSV</button></div>
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
      </div>

      {/* other departments quick switch */}
      <div>
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
