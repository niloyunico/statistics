/* UNICO — Quality Indicator monthly data entry (formula-based) */
const QI_MONTHS=['Aug-25','Sep-25','Oct-25','Nov-25','Dec-25','Jan-26','Feb-26','Mar-26','Apr-26','May-26','Jun-26','Jul-26'];
const QI_MFULL={'Aug-25':'August 2025','Sep-25':'September 2025','Oct-25':'October 2025','Nov-25':'November 2025','Dec-25':'December 2025','Jan-26':'January 2026','Feb-26':'February 2026','Mar-26':'March 2026','Apr-26':'April 2026','May-26':'May 2026','Jun-26':'June 2026','Jul-26':'July 2026'};

// formula-based indicator catalogue
const QI_DEFS=[
  {id:'cauti', name:'CAUTI Rate', formula:'rate1000', num:'CAUTI cases', den:'Urinary catheter days', unit:'per 1000 cath-days', benchmark:0, dir:'lower'},
  {id:'clabsi', name:'CLABSI Rate', formula:'rate1000', num:'CLABSI cases', den:'Central line days', unit:'per 1000 line-days', benchmark:0, dir:'lower'},
  {id:'vap', name:'VAP Rate', formula:'rate1000', num:'VAP cases', den:'Ventilator days', unit:'per 1000 vent-days', benchmark:0, dir:'lower'},
  {id:'fall', name:'Patient Fall Rate', formula:'rate1000', num:'Patient falls', den:'Patient days', unit:'per 1000 patient-days', benchmark:0, dir:'lower'},
  {id:'hapu', name:'HAPU Rate', formula:'rate100', num:'HAPU cases', den:'Patient days', unit:'per 100 patient-days', benchmark:0, dir:'lower'},
  {id:'phlebitis', name:'Phlebitis Rate', formula:'rate1000', num:'Phlebitis cases', den:'Peripheral line days', unit:'per 1000 line-days', benchmark:5, dir:'lower'},
  {id:'handhygiene', name:'Hand Hygiene Compliance', formula:'pct', num:'Compliant moments', den:'Observed moments', unit:'%', benchmark:90, dir:'higher'},
  {id:'mederror', name:'Medication Error', formula:'count', num:'Medication errors', den:null, unit:'count', benchmark:0, dir:'lower'},
  {id:'reintubation', name:'Re-intubation < 48h', formula:'count', num:'Re-intubations', den:null, unit:'count', benchmark:0, dir:'lower'},
  {id:'readmission', name:'ICU Re-admission < 48h', formula:'count', num:'Re-admissions', den:null, unit:'count', benchmark:0, dir:'lower'},
  {id:'nsi', name:'Needle Stick Injury', formula:'count', num:'NSI events', den:null, unit:'count', benchmark:0, dir:'lower'},
  {id:'ssi', name:'Surgical Site Infection', formula:'count', num:'SSI cases', den:null, unit:'count', benchmark:0, dir:'lower'},
];
function qiFormulaText(def){
  if(def.formula==='count') return `${def.name} = ${def.num}`;
  const mult=def.formula==='rate1000'?'× 1000':def.formula==='rate100'?'× 100':'× 100';
  return `${def.name} = (${def.num} ÷ ${def.den}) ${mult}`;
}
function qiCompute(def,num,den){
  const n=Number(num)||0, d=Number(den)||0;
  if(def.formula==='count') return n;
  if(!d) return 0;
  if(def.formula==='rate1000') return Math.round(n/d*1000*100)/100;
  return Math.round(n/d*100*100)/100; // rate100 / pct
}
function qiStatus(def,val){ return def.dir==='higher'? (val>=def.benchmark?'ok':'breach') : (val<=def.benchmark?'ok':'breach'); }

function useQualityEntries(){
  const KEY='unico_qentries_v1';
  const [rows,setRows]=React.useState(()=>{try{const s=JSON.parse(localStorage.getItem(KEY));return Array.isArray(s)?s:[];}catch(e){return [];}});
  React.useEffect(()=>{localStorage.setItem(KEY,JSON.stringify(rows));},[rows]);
  return {rows,
    save:(e)=>setRows(s=>{const i=s.findIndex(x=>x.dept===e.dept&&x.ind===e.ind&&x.month===e.month);if(i>=0){const c=[...s];c[i]={...e,ts:Date.now()};return c;}return [...s,{...e,ts:Date.now()}];}),
    remove:(dept,ind,month)=>setRows(s=>s.filter(x=>!(x.dept===dept&&x.ind===ind&&x.month===month))),
  };
}

function QualityBulk({dept,setDept,month,setMonth,deptNames,QE,setToast}){
  const [vals,setVals]=React.useState({});
  const setV=(id,k,v)=>setVals(s=>({...s,[id]:{...(s[id]||{}),[k]:v}}));
  const zeroAll=()=>{const o={};QI_DEFS.forEach(d=>{o[d.id]={...(vals[d.id]||{}),num:'0'};});setVals(o);};
  const filledCount=QI_DEFS.filter(d=>{const n=(vals[d.id]||{}).num;return n!==''&&n!=null;}).length;
  const saveAll=()=>{let n=0;QI_DEFS.forEach(def=>{const v=vals[def.id]||{};if(v.num===''||v.num==null)return;const value=qiCompute(def,v.num,v.den);QE.save({dept,ind:def.id,indName:def.name,month,num:Number(v.num)||0,den:def.formula!=='count'?(Number(v.den)||0):null,value,unit:def.unit,benchmark:def.benchmark});n++;});setToast(`Saved ${n} indicator${n!==1?'s':''} for ${QI_MFULL[month]||month}`);setVals({});};
  const sel={padding:'9px 11px',border:'1px solid var(--line)',borderRadius:8,fontSize:13,fontFamily:'inherit',background:'#fff'};
  const cellInp={width:'100%',minWidth:78,padding:'7px 8px',border:'1px solid var(--line)',borderRadius:6,fontFamily:'IBM Plex Mono',fontSize:13,textAlign:'right',outline:'none'};
  return (
    <div className="card"><div className="card-b" style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'flex-end'}}>
        <div className="field" style={{minWidth:200}}><label>Department</label><select style={sel} value={dept} onChange={e=>setDept(e.target.value)}>{deptNames.map(n=><option key={n}>{n}</option>)}</select></div>
        <div className="field" style={{minWidth:180}}><label>Reporting month</label><select style={sel} value={month} onChange={e=>setMonth(e.target.value)}>{QI_MONTHS.map(m=><option key={m} value={m}>{QI_MFULL[m]}</option>)}</select></div>
        <span className="spacer" style={{flex:1}}/>
        <button className="btn sm" onClick={zeroAll} title="Set every indicator to 0"><Ic d={I.check} s={14}/>Zero-defect month</button>
        <button className="btn sm" onClick={()=>setVals({})}>Clear</button>
        <button className="btn pri" onClick={saveAll} disabled={!filledCount} style={{opacity:filledCount?1:.5}}><Ic d={I.check} s={16} sw={2.4}/>Save all ({filledCount})</button>
      </div>
      <div style={{fontSize:12,color:'var(--muted)'}}>Enter values for all indicators of <b style={{color:'var(--ink)'}}>{dept}</b> — {QI_MFULL[month]||month}. Rates compute live; leave a row blank to skip it.</div>
      <div style={{overflowX:'auto',border:'1px solid var(--line)',borderRadius:9}}>
        <table className="tbl">
          <thead><tr><th style={{textAlign:'left'}}>Indicator</th><th>Numerator</th><th>Denominator</th><th>Value</th><th style={{textAlign:'left'}}>Status</th></tr></thead>
          <tbody>
            {QI_DEFS.map(def=>{const v=vals[def.id]||{};const needsDen=def.formula!=='count';const value=qiCompute(def,v.num,v.den);const filled=v.num!==''&&v.num!=null;const s=qiStatus(def,value);const tone=s==='ok'?'#1f9d57':'#d23a52';
              return (
                <tr key={def.id}>
                  <td style={{textAlign:'left'}}><b style={{color:'var(--ink)'}}>{def.name}</b><div style={{fontSize:10,color:'var(--faint)',fontFamily:"'IBM Plex Sans'"}}>{def.unit} · {def.dir==='higher'?'≥':'≤'} {def.benchmark}</div></td>
                  <td style={{padding:4,width:96}}><input type="number" min="0" style={cellInp} value={v.num??''} onChange={e=>setV(def.id,'num',e.target.value)} placeholder={def.num}/></td>
                  <td style={{padding:4,width:96}}>{needsDen?<input type="number" min="0" style={cellInp} value={v.den??''} onChange={e=>setV(def.id,'den',e.target.value)} placeholder={def.den}/>:<span style={{color:'var(--faint)'}}>—</span>}</td>
                  <td className="num">{filled?value:'—'}</td>
                  <td style={{textAlign:'left'}}>{filled?<span className="chip" style={{background:tone+'1c',color:tone}}>{s==='ok'?'On benchmark':'Breach'}</span>:<span style={{color:'var(--faint)'}}>—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div></div>
  );
}

function QualityCoverage({dept,QE,onPick}){
  const months=QI_MONTHS.slice(0,10);
  const has=(id,m)=>QE.rows.find(r=>r.dept===dept&&r.ind===id&&r.month===m);
  let saved=0; const total=QI_DEFS.length*months.length;
  QI_DEFS.forEach(d=>months.forEach(m=>{if(has(d.id,m))saved++;}));
  const pct=Math.round(saved*100/total);
  return (
    <div className="card" style={{overflow:'hidden'}}>
      <div className="card-h"><h3>Data Coverage — {dept}</h3><span className="sub">which indicator-months still need data · click a cell to fill it</span><span className="spacer"/>
        <span className="chip" style={{background:pct>=90?'var(--pos-bg)':pct>=50?'#fdf3e3':'var(--neg-bg)',color:pct>=90?'var(--pos)':pct>=50?'var(--amber)':'var(--neg)'}}>{pct}% entered</span>
        <span className="tag num" style={{marginLeft:8}}>{total-saved} needed</span></div>
      <div style={{overflowX:'auto'}}>
        <table className="tbl"><thead><tr><th style={{textAlign:'left'}}>Indicator</th>{months.map(m=><th key={m} style={{textAlign:'center'}}>{m}</th>)}</tr></thead>
          <tbody>{QI_DEFS.map(def=>(
            <tr key={def.id}><td style={{textAlign:'left'}}><b style={{color:'var(--ink)'}}>{def.name}</b></td>
              {months.map(m=>{const e=has(def.id,m);return (
                <td key={m} style={{textAlign:'center'}}><span onClick={()=>onPick(def.id,m)} title={e?`${e.value} ${e.unit} · click to edit`:'Needs data — click to enter'}
                  style={{cursor:'pointer',display:'inline-grid',placeItems:'center',width:24,height:22,borderRadius:6,fontWeight:700,fontSize:11,background:e?'var(--pos-bg)':'var(--neg-bg)',color:e?'var(--pos)':'var(--neg)'}}>{e?'✓':'!'}</span></td>
              );})}
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

function QualityEntry({setRoute}){
  const QE=useQualityEntries();
  const deptNames=(window.QUALITY_SEED||[]).map(d=>d.name);
  const [dept,setDept]=React.useState(deptNames[0]||'MICU');
  const [indId,setIndId]=React.useState(QI_DEFS[0].id);
  const [month,setMonth]=React.useState('May-26');
  const [num,setNum]=React.useState('');
  const [den,setDen]=React.useState('');
  const [toast,setToast]=React.useState(null);
  const [mode,setMode]=React.useState('single');
  const def=QI_DEFS.find(x=>x.id===indId);
  const needsDen=def.formula!=='count';
  const value=qiCompute(def,num,den);
  const status=qiStatus(def,value);
  const filled = num!=='' && (!needsDen || den!=='');

  const series=QE.rows.filter(r=>r.dept===dept&&r.ind===indId).sort((a,b)=>QI_MONTHS.indexOf(a.month)-QI_MONTHS.indexOf(b.month));
  const chartData=series.map(r=>({label:r.month, value:r.value}));

  const isEditing = !!QE.rows.find(r=>r.dept===dept&&r.ind===indId&&r.month===month);
  const formCardRef=React.useRef(null);
  const numInputRef=React.useRef(null);

  const save=()=>{
    if(!filled){setToast('Enter the required value(s)');return;}
    const wasEditing=isEditing;
    QE.save({dept,ind:indId,indName:def.name,month,num:Number(num)||0,den:needsDen?(Number(den)||0):null,value,unit:def.unit,benchmark:def.benchmark});
    setToast(`Saved ${def.name} · ${QI_MFULL[month]} = ${value} ${def.unit}`);
    try{window.UI&&window.UI.toast(wasEditing?'Entry updated ✓':'Saved ✓','success');}catch(e){}
    setNum('');setDen('');
  };

  // Load a saved entry back into the single-entry form for editing.
  const loadIntoForm=(r)=>{
    setMode('single');
    setDept(r.dept);
    setIndId(r.ind);
    setMonth(r.month);
    setNum(r.num!=null?String(r.num):'');
    setDen(r.den!=null?String(r.den):'');
    // scroll/focus the form once state has applied
    setTimeout(()=>{
      try{
        if(formCardRef.current&&formCardRef.current.scrollIntoView) formCardRef.current.scrollIntoView({behavior:'smooth',block:'start'});
        if(numInputRef.current&&numInputRef.current.focus) numInputRef.current.focus();
      }catch(e){}
    },60);
  };

  // Confirm + delete a saved entry from the saved-values table.
  const deleteEntry=async(r)=>{
    let ok=true;
    try{
      ok=await window.UI.confirm({title:'Delete this entry?',message:`Removes the saved value for ${r.indName||def.name} · ${QI_MFULL[r.month]||r.month}.`,danger:true,confirmLabel:'Delete'});
    }catch(e){ ok=window.confirm(`Delete the saved value for ${r.indName||def.name} · ${QI_MFULL[r.month]||r.month}?`); }
    if(!ok) return;
    QE.remove(r.dept,r.ind,r.month);
    try{window.UI&&window.UI.toast('Entry deleted','success');}catch(e){}
  };
  const sel={padding:'9px 11px',border:'1px solid var(--line)',borderRadius:8,fontSize:13,fontFamily:'inherit',background:'#fff'};
  const inputSty={padding:'10px 12px',border:'1px solid var(--line)',borderRadius:8,fontFamily:'IBM Plex Mono',fontSize:16,width:'100%',outline:'none'};
  const tone= status==='ok'?'#1f9d57':'#d23a52';

  return (
    <div className="grid" style={{gap:16}}>
      <SectionTitle icon={I.input} title="Quality Indicator — Monthly Entry"
        sub="Enter monthly numerator & denominator — the rate is computed by formula and checked against the benchmark"
        right={<><div className="seg"><button className={mode==='single'?'on':''} onClick={()=>setMode('single')}>Single</button><button className={mode==='bulk'?'on':''} onClick={()=>setMode('bulk')}>Bulk by month</button></div><button className="btn sm" onClick={()=>setRoute({view:'quality'})}><Ic d={I.heart} s={15}/>Dashboard</button></>}/>

      {mode==='bulk'&&<QualityBulk dept={dept} setDept={setDept} month={month} setMonth={setMonth} deptNames={deptNames} QE={QE} setToast={setToast}/>}
      {mode==='single'&&
      <div className="grid" style={{gridTemplateColumns:'1.1fr 1fr',alignItems:'start'}}>
        {/* entry */}
        <div className="card" ref={formCardRef}><div className="card-b" style={{display:'flex',flexDirection:'column',gap:16}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div className="field"><label>Department</label><select style={sel} value={dept} onChange={e=>setDept(e.target.value)}>{deptNames.map(n=><option key={n}>{n}</option>)}</select></div>
            <div className="field"><label>Reporting month</label><select style={sel} value={month} onChange={e=>setMonth(e.target.value)}>{QI_MONTHS.map(m=><option key={m} value={m}>{QI_MFULL[m]}</option>)}</select></div>
          </div>
          <div className="field"><label>Indicator</label><select style={sel} value={indId} onChange={e=>{setIndId(e.target.value);setNum('');setDen('');}}>{QI_DEFS.map(d=><option key={d.id} value={d.id}>{d.name} ({d.unit})</option>)}</select></div>

          <div style={{background:'var(--blue-50)',border:'1px solid var(--blue-100)',borderRadius:9,padding:'11px 14px',fontSize:12.5,color:'var(--blue-700)',fontFamily:'IBM Plex Mono'}}>
            ƒ {qiFormulaText(def)}
          </div>

          <div style={{display:'grid',gridTemplateColumns:needsDen?'1fr 1fr':'1fr',gap:12}}>
            <div className="field"><label>{def.num} <span style={{color:'var(--faint)'}}>(numerator)</span></label><input ref={numInputRef} type="number" min="0" style={inputSty} value={num} onChange={e=>setNum(e.target.value)} placeholder="0"/></div>
            {needsDen&&<div className="field"><label>{def.den} <span style={{color:'var(--faint)'}}>(denominator)</span></label><input type="number" min="0" style={inputSty} value={den} onChange={e=>setDen(e.target.value)} placeholder="0"/></div>}
          </div>

          {/* computed result */}
          <div style={{display:'flex',alignItems:'center',gap:16,background:'var(--panel-2)',border:'1px solid var(--line)',borderRadius:11,padding:'14px 18px'}}>
            <div><div style={{fontSize:10.5,color:'var(--muted)',textTransform:'uppercase',letterSpacing:.4,fontWeight:600}}>Computed value</div>
              <div className="num" style={{fontSize:30,fontWeight:700,color:filled?tone:'var(--faint)',lineHeight:1.1}}>{filled?value:'—'} <span style={{fontSize:12,fontWeight:500,color:'var(--muted)'}}>{def.unit}</span></div></div>
            <span className="spacer"/>
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:11,color:'var(--muted)'}}>Benchmark {def.dir==='higher'?'≥':'≤'} {def.benchmark}{def.formula==='pct'?'%':''}</div>
              {filled&&<span className="chip" style={{background:tone+'1c',color:tone,marginTop:4,display:'inline-block'}}>{status==='ok'?'● On benchmark':'▲ Breach'}</span>}
            </div>
          </div>
          <div style={{display:'flex',gap:10}}>
            <button className="btn pri" onClick={save}><Ic d={I.check} s={16} sw={2.4}/>{isEditing?'Update monthly value':'Save monthly value'}</button>
            <button className="btn" onClick={()=>{setNum('');setDen('');}}>Clear</button>
          </div>
        </div></div>

        {/* trend + saved */}
        <div className="grid" style={{gap:16}}>
          <div className="card">
            <div className="card-h"><h3>{def.name} — {dept}</h3><span className="spacer"/><span className="tag">{series.length} months</span></div>
            <div className="card-b">{chartData.length?<BarChart data={chartData} x="label" y="value" height={190} color={tone}/>:<div style={{textAlign:'center',color:'var(--faint)',padding:'34px',fontSize:13}}>No saved months yet for this indicator.</div>}</div>
          </div>
          <div className="card" style={{overflow:'hidden'}}>
            <div className="card-h"><h3>Saved Monthly Values</h3><span className="spacer"/></div>
            <table className="tbl">
              <thead><tr><th>Month</th><th>{def.num}</th>{needsDen&&<th>{def.den}</th>}<th>Value</th><th style={{textAlign:'left'}}>Status</th><th style={{textAlign:'right'}}>Actions</th></tr></thead>
              <tbody>
                {series.length===0&&<tr><td colSpan={needsDen?6:5} style={{textAlign:'center',color:'var(--faint)',fontFamily:"'IBM Plex Sans'"}}>No entries.</td></tr>}
                {series.slice().reverse().map(r=>{const s=qiStatus(def,r.value);return (
                  <tr key={r.month}><td>{QI_MFULL[r.month]||r.month}</td><td>{fmt(r.num)}</td>{needsDen&&<td>{fmt(r.den)}</td>}<td>{r.value} <span style={{color:'var(--faint)',fontSize:10}}>{r.unit}</span></td>
                    <td style={{textAlign:'left'}}><span className="chip" style={{background:(s==='ok'?'#1f9d57':'#d23a52')+'1c',color:s==='ok'?'#1f9d57':'#d23a52'}}>{s==='ok'?'On benchmark':'Breach'}</span></td>
                    <td><div style={{display:'flex',gap:6,justifyContent:'flex-end'}}>
                      <button className="icon-btn" style={{width:24,height:24}} title="Edit this entry" onClick={()=>loadIntoForm(r)}><Ic d={I.edit} s={13}/></button>
                      <button className="icon-btn danger" style={{width:24,height:24}} title="Delete this entry" onClick={()=>deleteEntry(r)}><Ic d={I.x} s={13}/></button>
                    </div></td></tr>
                );})}
              </tbody>
            </table>
          </div>
        </div>
      </div>}
      {mode==='single'&&<QualityCoverage dept={dept} QE={QE} onPick={(id,m)=>{setIndId(id);setMonth(m);const ex=QE.rows.find(r=>r.dept===dept&&r.ind===id&&r.month===m);setNum(ex?String(ex.num):'');setDen(ex&&ex.den!=null?String(ex.den):'');}}/>}
      {toast&&<Toast msg={toast} onDone={()=>setToast(null)}/>}
    </div>
  );
}
window.QualityEntry=QualityEntry;
