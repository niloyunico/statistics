/* UNICO — Quality Scorecard (hospital-wide, all departments) */
/* Reuses globals from quality.jsx (QS, deptStats, indStatus, statusTone),
   charts.jsx (HBar, fmt), ui.jsx (SectionTitle, Ic, I) and staff.jsx (downloadBlob). */

/* RAG band from a zero-defect rate -> {label,color,bg} */
function ragOf(rate){
  if(rate>=95) return {label:'Green',color:'#1f9d57',bg:'rgba(31,157,87,.12)',bar:'#1f9d57'};
  if(rate>=80) return {label:'Amber',color:'#e08a1e',bg:'rgba(224,138,30,.14)',bar:'#e8a93a'};
  return {label:'Red',color:'#d23a52',bg:'rgba(210,58,82,.12)',bar:'#d23a52'};
}

/* indicator in a dept with the most breach quarters; ties -> first encountered */
function topRiskIndicator(d){
  let best=null,bestB=0;
  (d.indicators||[]).forEach(ind=>{
    let b=0; QS.forEach(q=>{ if(indStatus(ind,q)==='breach') b++; });
    if(b>bestB){ bestB=b; best=ind; }
  });
  return best?{name:best.name,breaches:bestB}:null;
}

/* build the per-department rows the whole screen renders from */
function scorecardRows(){
  return (window.QUALITY_SEED||[]).filter(d=>d.indicators&&d.indicators.length).map(d=>{
    const s=deptStats(d);
    return {
      key:d.key, name:d.name, indicators:d.indicators.length,
      rate:s.rate, ok:s.ok, breach:s.breach, na:s.na,
      rag:ragOf(s.rate), risk:topRiskIndicator(d),
      status:(d.executive&&d.executive.overallStatus)||''
    };
  });
}

/* ---------------- export (mirrors exportQualityDept blob/anchor technique) ---------------- */
function exportQualityScorecard(rows,totals,fmt){
  const date=new Date().toISOString().slice(0,10);
  const title=`UNICO Hospitals — Hospital-Wide Quality Scorecard (${date})`;
  const esc=s=>((s==null?'':s)+'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const heads=['Department','Indicators','Zero-Defect %','Breaches','RAG','Top Risk Indicator'];
  const th=heads.map(h=>`<th style="background:#0090ca;color:#fff;border:1px solid #2b6f9c;padding:6px 8px;font-family:Calibri,Arial;text-align:left;font-size:11pt">${h}</th>`).join('');
  const trs=rows.map((r,i)=>{
    const risk=r.risk?`${r.risk.name} (${r.risk.breaches} breach quarter${r.risk.breaches!==1?'s':''})`:'—';
    const cells=[r.name,r.indicators,r.rate+'%',r.breach,r.rag.label,risk];
    return `<tr style="background:${i%2?'#eef6fb':'#fff'}">${cells.map(c=>`<td style="border:1px solid #b9c6d2;padding:5px 8px;font-family:Calibri,Arial;font-size:10.5pt">${esc(c)}</td>`).join('')}</tr>`;
  }).join('');
  const table=`<table border="1" style="border-collapse:collapse"><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`;
  const summary=`<p style="font-family:Calibri"><b>Departments:</b> ${totals.depts} &nbsp;·&nbsp; <b>Indicators:</b> ${totals.indicators} &nbsp;·&nbsp; <b>Overall zero-defect:</b> ${totals.zeroDefect}% &nbsp;·&nbsp; <b>Total breaches:</b> ${totals.breach}</p>`;
  const base=`UNICO-Quality-Scorecard-${date}`;
  if(fmt==='excel'){
    downloadBlob(`<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body><h3 style="font-family:Calibri">${title}</h3>${summary}${table}</body></html>`,base+'.xls','application/vnd.ms-excel');
  } else if(fmt==='word'){
    downloadBlob(`<html xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${title}</title><style>@page{size:A4 landscape;margin:1.2cm}</style></head><body><h2 style="font-family:Calibri;color:#0072a3">${title}</h2>${summary}${table}<p style="font-family:Calibri;color:#777;font-size:9pt;margin-top:14px">Generated ${date} · Confidential</p></body></html>`,base+'.doc','application/msword');
  }
  if(window.UI&&window.UI.toast) window.UI.toast(`Scorecard exported (${fmt==='excel'?'Excel':'Word'})`,'success');
}

/* ---------------- screen ---------------- */
function QualityScorecard({setRoute}){
  const rows=scorecardRows();
  const [sortBy,setSortBy]=React.useState('rate');   // 'rate' | 'breaches'
  const [dir,setDir]=React.useState('asc');          // worst-first for rate, most-first for breaches

  // hospital-wide aggregate (ok vs ok+breach across all departments)
  const totals=(()=>{
    let ok=0,breach=0,na=0,ind=0;
    rows.forEach(r=>{ ok+=r.ok; breach+=r.breach; na+=r.na; ind+=r.indicators; });
    return {depts:rows.length,indicators:ind,breach,zeroDefect:ok+breach?Math.round(ok*100/(ok+breach)):100};
  })();

  const sorted=[...rows].sort((a,b)=>{
    const v=sortBy==='breaches'?(a.breach-b.breach):(a.rate-b.rate);
    return dir==='asc'?v:-v;
  });

  const setSort=col=>{
    if(sortBy===col){ setDir(d=>d==='asc'?'desc':'asc'); }
    else { setSortBy(col); setDir(col==='breaches'?'desc':'asc'); }
  };
  const arrow=col=>sortBy===col?(dir==='asc'?' ▲':' ▼'):'';

  const barRows=[...rows].sort((a,b)=>a.rate-b.rate).map(r=>({label:r.name,value:r.rate,color:r.rag.bar}));

  const Kpi=({label,val,foot,color})=>(
    <div className="card anim-pop" style={{padding:'17px 20px',borderLeft:`4px solid ${color}`,display:'flex',flexDirection:'column',minHeight:122}}>
      <div style={{fontSize:13,fontWeight:700,color:'var(--ink-2)'}}>{label}</div>
      <div className="num" style={{fontSize:34,fontWeight:700,color,margin:'10px 0 6px',lineHeight:1}}>{val}</div>
      <div style={{fontSize:11.5,color:'var(--muted)',marginTop:'auto'}}>{foot}</div>
    </div>
  );

  return (
    <div className="grid" style={{gap:16}}>
      <SectionTitle icon={I.layers} title="Quality Scorecard" sub="Hospital-wide quality performance across all departments · FY 2025–2026"
        right={
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            <button className="btn sm" onClick={()=>exportQualityScorecard(sorted,totals,'word')}><Ic d={I.doc} s={14}/>Word</button>
            <button className="btn sm" onClick={()=>exportQualityScorecard(sorted,totals,'excel')}><Ic d={I.download} s={14}/>Excel</button>
            <button className="btn sm" onClick={()=>{try{window.print();}catch(e){}}}><Ic d={I.print} s={14}/>Print</button>
          </div>
        }/>

      <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))'}}>
        <Kpi label="Departments" val={fmt(totals.depts)} foot="reporting quality KPIs" color="#0090ca"/>
        <Kpi label="Indicators" val={fmt(totals.indicators)} foot="tracked across departments" color="#6a52d4"/>
        <Kpi label="Zero-Defect Rate" val={totals.zeroDefect+'%'} foot="aggregate on-benchmark vs measured" color="#1f9d57"/>
        <Kpi label="Total Breaches" val={fmt(totals.breach)} foot="indicator-quarters off benchmark" color={totals.breach>0?'#d23a52':'#1f9d57'}/>
      </div>

      <div className="grid" style={{gridTemplateColumns:'1.45fr 1fr'}}>
        {/* ranked table */}
        <div className="card" style={{overflow:'hidden'}}>
          <div className="card-h"><h3>Department Ranking</h3><span className="sub">click a row to open the department · sort by column</span><span className="spacer"/>
            <select value={sortBy+':'+dir}
              onChange={e=>{const [c,d]=e.target.value.split(':'); setSortBy(c); setDir(d);}}
              style={{padding:'6px 9px',border:'1px solid var(--line)',borderRadius:7,fontSize:12,fontFamily:'inherit',background:'#fff'}}>
              <option value="rate:asc">Sort: Lowest rate first</option>
              <option value="rate:desc">Sort: Highest rate first</option>
              <option value="breaches:desc">Sort: Most breaches first</option>
              <option value="breaches:asc">Sort: Fewest breaches first</option>
            </select>
          </div>
          <div style={{overflowX:'auto'}}>
            <table className="tbl">
              <thead><tr>
                <th style={{textAlign:'left'}}>Department</th>
                <th style={{textAlign:'center'}}>Indicators</th>
                <th style={{textAlign:'right',cursor:'pointer',userSelect:'none'}} onClick={()=>setSort('rate')} title="Sort by zero-defect rate">Zero-Defect %{arrow('rate')}</th>
                <th style={{textAlign:'center',cursor:'pointer',userSelect:'none'}} onClick={()=>setSort('breaches')} title="Sort by breaches">Breaches{arrow('breaches')}</th>
                <th style={{textAlign:'center'}}>RAG</th>
                <th style={{textAlign:'left'}}>Top Risk Indicator</th>
              </tr></thead>
              <tbody>
                {sorted.map(r=>(
                  <tr key={r.key} style={{cursor:'pointer'}} onClick={()=>setRoute({view:'qualityDept',dept:r.key})}>
                    <td style={{textAlign:'left'}}><b style={{color:'var(--ink)'}}>{r.name}</b></td>
                    <td style={{textAlign:'center'}} className="num">{r.indicators}</td>
                    <td style={{textAlign:'right'}} className="num"><b style={{color:r.rag.color}}>{r.rate}%</b></td>
                    <td style={{textAlign:'center'}} className="num">
                      <span style={{display:'inline-grid',placeItems:'center',minWidth:26,height:22,padding:'0 6px',borderRadius:6,fontWeight:700,fontSize:11.5,
                        background:r.breach>0?'var(--neg-bg)':'var(--pos-bg)',color:r.breach>0?'var(--neg)':'var(--pos)'}}>{r.breach}</span>
                    </td>
                    <td style={{textAlign:'center'}}><span className="chip" style={{background:r.rag.bg,color:r.rag.color}}>{r.rag.label}</span></td>
                    <td style={{textAlign:'left',fontSize:11.5,color:'var(--muted)',fontFamily:"'IBM Plex Sans'"}}>
                      {r.risk?<span><span style={{color:'var(--ink-2)',fontWeight:600}}>{r.risk.name}</span> · {r.risk.breaches} breach Q</span>:<span style={{color:'var(--pos)'}}>No breaches</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* visual: zero-defect % by department, colored by RAG */}
        <div className="card">
          <div className="card-h"><h3>Zero-Defect % by Department</h3><span className="spacer"/>
            <div style={{display:'flex',gap:12,fontSize:11,color:'var(--muted)'}}>
              <span><i style={{display:'inline-block',width:9,height:9,borderRadius:2,background:'#1f9d57',marginRight:4}}/>≥95</span>
              <span><i style={{display:'inline-block',width:9,height:9,borderRadius:2,background:'#e8a93a',marginRight:4}}/>80–94</span>
              <span><i style={{display:'inline-block',width:9,height:9,borderRadius:2,background:'#d23a52',marginRight:4}}/>&lt;80</span>
            </div>
          </div>
          <div className="card-b"><HBar rows={barRows}/></div>
        </div>
      </div>
    </div>
  );
}

window.QualityScorecard=QualityScorecard;
