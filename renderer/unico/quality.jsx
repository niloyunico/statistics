/* UNICO — Quality Indicators module (real quarterly KPI data) */
const QS=['Q1','Q2','Q3','Q4'];
const QLABEL={Q1:'Q1 · Aug–Oct 25',Q2:'Q2 · Nov–Dec 25',Q3:'Q3 · Jan–Mar 26',Q4:'Q4 · Apr–May 26'};
const QSHORT={Q1:'Q1',Q2:'Q2',Q3:'Q3',Q4:'Q4'};
const QMONTHS=[['Aug 25','Q1'],['Sep 25','Q1'],['Oct 25','Q1'],['Nov 25','Q2'],['Dec 25','Q2'],['Jan 26','Q3'],['Feb 26','Q3'],['Mar 26','Q3'],['Apr 26','Q4'],['May 26','Q4']];
const STATUS_TONE={Excellent:'#1f9d57',Good:'#0090ca','Very Good':'#0f9b8e',Satisfactory:'#3ab5a7',Fair:'#e08a1e',Average:'#e08a1e',Poor:'#d23a52','Needs Improvement':'#d23a52','':'#8a93a3'};
function statusTone(s){return STATUS_TONE[s]!==undefined?STATUS_TONE[s]:'#0090ca';}
function indStatus(ind,q){
  const v=ind.quarters?ind.quarters[q]:null;
  if(v==null||v==='') return 'na';
  const b=ind.benchmarkValue;
  if(b==null) return 'ok';
  if(ind.goalDirection==='higher_is_better') return v>=b?'ok':'breach';
  return v<=b?'ok':'breach';
}
function indVal(ind,q){const v=ind.quarters?ind.quarters[q]:null;if(v==null||v==='')return null;return (ind.valueType||'').toLowerCase().startsWith('per')?v+'%':v;}
function deptStats(d){let ok=0,breach=0,na=0;(d.indicators||[]).forEach(ind=>QS.forEach(q=>{const s=indStatus(ind,q);if(s==='ok')ok++;else if(s==='breach')breach++;else na++;}));return {ok,breach,na,rate:ok+breach?Math.round(ok*100/(ok+breach)):100};}

const QSTATUS_CELL={ok:['#1f9d57','var(--pos-bg)','✓'],breach:['#d23a52','var(--neg-bg)','!'],na:['#9aa6b4','#eef1f5','–']};

/* ---------------- Quality overview ---------------- */
function QualityModule({setRoute}){
  const deps=(window.qualityData?window.qualityData():(window.QUALITY_SEED||[])).filter(d=>d.indicators&&d.indicators.length);
  let ok=0,breach=0,na=0,totalInd=0;
  deps.forEach(d=>{totalInd+=d.indicators.length;const s=deptStats(d);ok+=s.ok;breach+=s.breach;na+=s.na;});
  const zeroDefect=ok+breach?Math.round(ok*100/(ok+breach)):100;
  const statusDonut=[
    {label:'On benchmark',value:ok,color:'#1f9d57'},
    {label:'Breach',value:breach,color:'#d23a52'},
    {label:'Not reported',value:na,color:'#c4ccd6'},
  ].filter(x=>x.value>0);
  const breachByQ=QS.map(q=>{let b=0;deps.forEach(d=>d.indicators.forEach(ind=>{if(indStatus(ind,q)==='breach')b++;}));return {label:QSHORT[q],value:b};});
  const Kpi=({label,val,foot,color})=>(
    <div className="card anim-pop" style={{padding:'17px 20px',borderLeft:`4px solid ${color}`,display:'flex',flexDirection:'column',minHeight:122}}>
      <div style={{fontSize:13,fontWeight:700,color:'var(--ink-2)'}}>{label}</div>
      <div className="num" style={{fontSize:34,fontWeight:700,color,margin:'10px 0 6px',lineHeight:1}}>{val}</div>
      <div style={{fontSize:11.5,color:'var(--muted)',marginTop:'auto'}}>{foot}</div>
    </div>
  );
  return (
    <div className="grid" style={{gap:16}}>
      <SectionTitle icon={I.heart} title="Quality Indicators" sub="Nursing quality & patient-safety KPIs · FY 2025–2026 (quarterly)"/>
      <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))'}}>
        <Kpi label="Departments" val={fmt(deps.length)} foot="reporting quality KPIs" color="#0090ca"/>
        <Kpi label="Indicators" val={fmt(totalInd)} foot="tracked across departments" color="#6a52d4"/>
        <Kpi label="Zero-Defect Rate" val={zeroDefect+'%'} foot={`${ok} on benchmark · ${breach} breaches`} color="#1f9d57"/>
        <Kpi label="Breaches" val={fmt(breach)} foot="indicator-quarters off benchmark" color={breach>0?'#d23a52':'#1f9d57'}/>
      </div>
      <div className="grid" style={{gridTemplateColumns:'1.3fr 1fr'}}>
        <div className="card">
          <div className="card-h"><h3>Breaches by Quarter</h3><span className="sub">Q1 Aug–Oct · Q2 Nov–Dec · Q3 Jan–Mar · Q4 Apr–May</span><span className="spacer"/></div>
          <div className="card-b"><Bar3D data={breachByQ} x="label" y="value" height={210} color="#d23a52"/></div>
        </div>
        <div className="card">
          <div className="card-h"><h3>Compliance Mix</h3><span className="spacer"/></div>
          <div className="card-b" style={{display:'grid',placeItems:'center'}}><Donut data={statusDonut} size={176} centerValue={zeroDefect+'%'} centerLabel="on benchmark"/></div>
        </div>
      </div>

      {/* heatmap: dept × quarter */}
      <div className="card" style={{overflow:'hidden'}}>
        <div className="card-h"><h3>Department × Quarter Heatmap</h3><span className="sub">breaches per quarter — click a department</span><span className="spacer"/>
          <div style={{display:'flex',gap:12,fontSize:11,color:'var(--muted)'}}>
            <span><i style={{display:'inline-block',width:9,height:9,borderRadius:2,background:'#1f9d57',marginRight:4}}/>clean</span>
            <span><i style={{display:'inline-block',width:9,height:9,borderRadius:2,background:'#d23a52',marginRight:4}}/>breach</span>
            <span><i style={{display:'inline-block',width:9,height:9,borderRadius:2,background:'#dfe5ec',marginRight:4}}/>n/r</span>
          </div>
        </div>
        <div style={{overflowX:'auto'}}>
          <table className="tbl">
            <thead><tr><th style={{textAlign:'left'}}>Department</th>{QS.map(q=><th key={q} style={{textAlign:'center'}}>{QSHORT[q]}</th>)}<th style={{textAlign:'center'}}>Status</th><th style={{textAlign:'right'}}>Rate</th></tr></thead>
            <tbody>
              {deps.map(d=>{
                const st=deptStats(d);
                return (
                  <tr key={d.key} style={{cursor:'pointer'}} onClick={()=>setRoute({view:'qualityDept',dept:d.key})}>
                    <td style={{textAlign:'left'}}><b style={{color:'var(--ink)'}}>{d.name}</b> <span style={{color:'var(--faint)',fontWeight:400,fontFamily:"'IBM Plex Sans'"}}>· {d.indicators.length} ind.</span></td>
                    {QS.map(q=>{
                      let b=0,rep=0;d.indicators.forEach(ind=>{const s=indStatus(ind,q);if(s==='breach')b++;if(s!=='na')rep++;});
                      const bg=rep===0?'#eef1f5':b>0?'var(--neg-bg)':'var(--pos-bg)';
                      const col=rep===0?'#9aa6b4':b>0?'var(--neg)':'var(--pos)';
                      return <td key={q} style={{textAlign:'center'}}><span style={{display:'inline-grid',placeItems:'center',width:30,height:24,borderRadius:6,background:bg,color:col,fontWeight:700,fontSize:11.5}}>{rep===0?'–':b>0?b:'✓'}</span></td>;
                    })}
                    <td style={{textAlign:'center'}}><span className="chip" style={{background:statusTone(d.executive.overallStatus)+'1c',color:statusTone(d.executive.overallStatus)}}>{d.executive.overallStatus||'—'}</span></td>
                    <td style={{textAlign:'right'}} className="num">{st.rate}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Quality department detail ---------------- */
function exportQualityDept(d,fmt){
  const date=new Date().toISOString().slice(0,10);
  const title=`UNICO Hospitals — ${d.name} Quality Indicator Report (FY ${d.year})`;
  const ex=d.executive||{};
  const esc=s=>((s==null?'':s)+'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const th=['Indicator','Benchmark','Goal','Q1','Q2','Q3','Q4','Remarks'].map(h=>`<th style="background:#0090ca;color:#fff;border:1px solid #2b6f9c;padding:6px 8px;font-family:Calibri,Arial;text-align:left;font-size:11pt">${h}</th>`).join('');
  const trs=(d.indicators||[]).map((ind,i)=>{const cells=[ind.name,ind.benchmark||'—',ind.goalDirection==='higher_is_better'?'Higher is better':'Lower is better',...QS.map(q=>{const v=ind.quarters?ind.quarters[q]:null;return v==null?'—':v;}),ind.remarks||''];return `<tr style="background:${i%2?'#eef6fb':'#fff'}">${cells.map(c=>`<td style="border:1px solid #b9c6d2;padding:5px 8px;font-family:Calibri,Arial;font-size:10.5pt">${esc(c)}</td>`).join('')}</tr>`;}).join('');
  const table=`<table border="1" style="border-collapse:collapse"><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`;
  const exec=`<p style="font-family:Calibri"><b>Overall status:</b> ${esc(ex.overallStatus||'—')}</p>`+(ex.keyAchievements?`<p style="font-family:Calibri"><b>Key achievements:</b> ${esc(ex.keyAchievements)}</p>`:'')+(ex.majorGaps?`<p style="font-family:Calibri"><b>Major gaps:</b> ${esc(ex.majorGaps)}</p>`:'')+(ex.recommendations?`<p style="font-family:Calibri"><b>Recommendations:</b> ${esc(ex.recommendations)}</p>`:'');
  const base=`UNICO-${d.key}-Quality-${date}`;
  if(fmt==='excel'){downloadBlob(`<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body><h3 style="font-family:Calibri">${title}</h3>${table}</body></html>`,base+'.xls','application/vnd.ms-excel');}
  else if(fmt==='word'){downloadBlob(`<html xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${title}</title><style>@page{size:A4 landscape;margin:1.2cm}</style></head><body><h2 style="font-family:Calibri;color:#0072a3">${title}</h2>${exec}${table}<p style="font-family:Calibri;color:#777;font-size:9pt;margin-top:14px">Generated ${date} · Confidential</p></body></html>`,base+'.doc','application/msword');}
  else if(fmt==='pdf'){
    // Render the report into the shared #pdf-root and reuse the pdf-export-mode
    // print path (only #pdf-root is captured) to produce a clean PDF.
    const root=document.getElementById('pdf-root');
    const native=window.unicoNative;
    if(!root||!native||typeof native.exportPDF!=='function'){ try{window.print();}catch(e){} return; }
    root.innerHTML=`<div class="pdf-page" style="padding:12mm 13mm;font-family:'IBM Plex Sans',Arial,sans-serif;color:#16202e"><h2 style="color:#0072a3;margin:0 0 2px;font-size:19px">${title}</h2><div style="color:#8a93a3;font-size:10.5px;margin-bottom:12px">Generated ${date} · Confidential</div>${exec}<div style="margin-top:8px">${table}</div></div>`;
    document.body.classList.add('pdf-export-mode');
    Promise.resolve(native.exportPDF({pageSize:'A4',landscape:true,defaultName:base})).catch(()=>{}).then(()=>{ root.innerHTML=''; document.body.classList.remove('pdf-export-mode'); });
  }
}
function QualityDept({deptKey, setRoute}){
  const _qd=window.qualityData?window.qualityData():(window.QUALITY_SEED||[]);
  const d=_qd.find(x=>x.key===deptKey)||_qd[0];
  const [view,setView]=React.useState('quarterly');
  if(!d) return <div style={{padding:40}}>No quality data.</div>;
  const ex=d.executive||{}; const st=deptStats(d);
  const tone=statusTone(ex.overallStatus);
  const breachByQ=QS.map(q=>{let b=0;d.indicators.forEach(ind=>{if(indStatus(ind,q)==='breach')b++;});return {label:QSHORT[q],value:b};});
  const exCard=(label,text,color)=> text? (
    <div className="card" style={{padding:'14px 16px',borderTop:`3px solid ${color}`}}>
      <div style={{fontSize:11,color:'var(--muted)',textTransform:'uppercase',letterSpacing:.4,fontWeight:700,marginBottom:6}}>{label}</div>
      <div style={{fontSize:12.5,color:'var(--ink-2)',lineHeight:1.5}}>{text}</div>
    </div>
  ):null;
  return (
    <div className="grid" style={{gap:16}}>
      <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
        <button className="btn sm" onClick={()=>setRoute({view:'quality'})}><Ic d={I.chevR} s={14} style={{transform:'rotate(180deg)'}}/>Quality</button>
        <select value={d.key} onChange={e=>setRoute({view:'qualityDept',dept:e.target.value})} style={{padding:'7px 10px',border:'1px solid var(--line)',borderRadius:7,fontSize:12.5,fontFamily:'inherit',background:'#fff'}}>
          {_qd.filter(x=>x.indicators&&x.indicators.length).map(x=><option key={x.key} value={x.key}>{x.name}</option>)}
        </select>
        <span className="spacer"/>
        <span style={{fontSize:12,color:'var(--muted)'}}>FY {d.year}</span>
        <button className="btn sm" onClick={()=>exportQualityDept(d,'pdf')}><Ic d={I.download} s={14}/>PDF</button>
        <button className="btn sm" onClick={()=>exportQualityDept(d,'word')}><Ic d={I.doc} s={14}/>Word</button>
        <button className="btn sm" onClick={()=>exportQualityDept(d,'excel')}><Ic d={I.download} s={14}/>Excel</button>
        <button className="btn sm" onClick={()=>{try{window.print();}catch(e){}}}><Ic d={I.print} s={14}/>Print</button>
        <button className="btn sm" onClick={()=>setRoute({view:'qualityEdit',dept:d.key})}><Ic d={I.edit} s={14}/>Edit</button>
        <button className="btn pri sm" onClick={()=>setRoute({view:'qualityEntry'})}><Ic d={I.input} s={14}/>Enter data</button>
      </div>
      <div className="card feature" style={{padding:'18px 20px',display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}}>
        <div style={{width:46,height:46,borderRadius:12,background:tone+'1a',color:tone,display:'grid',placeItems:'center'}}><Ic d={I.heart} s={24}/></div>
        <div><div style={{fontSize:20,fontWeight:700}}>{d.name}</div><div style={{fontSize:12.5,color:'var(--muted)'}}>{d.indicators.length} quality indicators · {st.breach} breach{st.breach!==1?'es':''}</div></div>
        <span className="spacer"/>
        <div style={{textAlign:'center'}}><div className="num" style={{fontSize:24,fontWeight:700,color:tone}}>{st.rate}%</div><div style={{fontSize:11,color:'var(--muted)'}}>zero-defect</div></div>
        <div style={{width:1,height:40,background:'var(--line)'}}/>
        <span className="chip" style={{background:tone+'1c',color:tone,fontSize:12,padding:'5px 12px'}}>{ex.overallStatus||'—'}</span>
      </div>

      <div className="grid" style={{gridTemplateColumns:'1fr 1fr'}}>
        {exCard('Key Achievements',ex.keyAchievements,'#1f9d57')}
        {exCard('Major Gaps',ex.majorGaps,'#e08a1e')}
        {exCard('Recommendations',ex.recommendations,'#0090ca')}
        {st.breach>0&&(
          <div className="card"><div className="card-h"><h3>Breaches by Quarter</h3></div><div className="card-b"><BarChart data={breachByQ} x="label" y="value" height={170} color={tone}/></div></div>
        )}
      </div>

      <div className="card" style={{overflow:'hidden'}}>
        <div className="card-h"><h3>Indicators — {view==='monthly'?'Monthly':'Quarterly'} Performance</h3><span className="spacer"/>
          <div className="seg">
            <button className={view==='quarterly'?'on':''} onClick={()=>setView('quarterly')}>Quarterly</button>
            <button className={view==='monthly'?'on':''} onClick={()=>setView('monthly')}>Monthly</button>
          </div>
        </div>
        {view==='monthly'&&<div style={{padding:'8px 16px',fontSize:11,color:'var(--muted)',background:'var(--blue-50)',borderBottom:'1px solid var(--line-2)'}}>Monthly view derives each month's status from its quarter (source data is reported quarterly). Hover a cell for the quarter value.</div>}
        <div style={{overflowX:'auto'}}>
          {(()=>{ const cols=view==='monthly'?QMONTHS.map(([label,q])=>({label,q,monthly:true,title:label+' · '+q})):QS.map(q=>({label:QSHORT[q],q,title:QLABEL[q]}));
          return (
          <table className="tbl">
            <thead><tr><th style={{textAlign:'left'}}>Indicator</th><th style={{textAlign:'left'}}>Benchmark</th>{cols.map((c,ci)=><th key={ci} style={{textAlign:'center'}} title={c.title}>{c.label}</th>)}<th style={{textAlign:'left'}}>Remarks</th></tr></thead>
            <tbody>
              {d.indicators.map(ind=>(
                <tr key={ind.id}>
                  <td style={{textAlign:'left'}}><b style={{color:'var(--ink)'}}>{ind.name}</b><div style={{fontSize:10,color:'var(--faint)',fontFamily:"'IBM Plex Sans'"}}>{ind.goalDirection==='higher_is_better'?'↑ higher is better':'↓ lower is better'}</div></td>
                  <td style={{textAlign:'left',fontFamily:"'IBM Plex Sans'"}}>{ind.benchmark||'—'}</td>
                  {cols.map((c,ci)=>{
                    const s=indStatus(ind,c.q); const v=indVal(ind,c.q); const [col,bg,sym]=QSTATUS_CELL[s];
                    const show=c.monthly?(v==null?sym:(s==='breach'?'!':'✓')):(v==null?sym:v);
                    const tip=(c.monthly?c.label+' (part of '+c.q+'): ':'')+((ind.quarterRemarks&&ind.quarterRemarks[c.q])||'');
                    return <td key={ci} style={{textAlign:'center'}}><span title={tip} style={{display:'inline-grid',placeItems:'center',minWidth:c.monthly?24:30,height:24,padding:'0 6px',borderRadius:6,background:bg,color:col,fontWeight:700,fontSize:11.5}}>{show}</span></td>;
                  })}
                  <td style={{textAlign:'left',fontFamily:"'IBM Plex Sans'",fontSize:11,color:'var(--muted)',maxWidth:220}}>{ind.remarks||'—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          );})()}
        </div>
      </div>
    </div>
  );
}
Object.assign(window,{ QualityModule, QualityDept });
