/* UNICO — Data Entry module (form / grid / guided wizard) */
function Toast({msg,onDone}){
  React.useEffect(()=>{const t=setTimeout(onDone,2600);return ()=>clearTimeout(t);},[]);
  return (
    <div style={{position:'fixed',bottom:24,right:24,zIndex:9999,background:'#0d1b2e',color:'#fff',
      padding:'12px 16px',borderRadius:10,boxShadow:'var(--shadow-pop)',display:'flex',alignItems:'center',gap:10}} className="anim-pop">
      <div style={{width:24,height:24,borderRadius:'50%',background:'var(--green)',display:'grid',placeItems:'center'}}><Ic d={I.check} s={15} c="#fff" sw={2.6}/></div>
      <span style={{fontSize:13,fontWeight:600}}>{msg}</span>
    </div>
  );
}

function NumField({col,value,onChange,err,autoFocus}){
  return (
    <label style={{display:'flex',flexDirection:'column',gap:5}}>
      <span style={{fontSize:11.5,fontWeight:600,color:'var(--ink-2)',display:'flex',gap:6}}>
        {col.label}{col.pct&&<span style={{color:'var(--faint)',fontWeight:500}}>(%)</span>}
      </span>
      <div style={{position:'relative'}}>
        <input type="number" min="0" step={col.pct?'0.01':'1'} value={value} autoFocus={autoFocus}
          onChange={e=>onChange(e.target.value)}
          style={{width:'100%',padding:'9px 11px',border:'1px solid '+(err?'var(--rose)':'var(--line)'),
            borderRadius:7,fontFamily:'IBM Plex Mono',fontSize:14,background:err?'var(--neg-bg)':'#fff',outline:'none'}}
          onFocus={e=>e.target.style.borderColor='var(--blue)'}
          onBlur={e=>e.target.style.borderColor=err?'var(--rose)':'var(--line)'}/>
        {col.pct&&<span style={{position:'absolute',right:11,top:10,color:'var(--faint)',fontSize:13}}>%</span>}
      </div>
      {err&&<span style={{fontSize:10.5,color:'var(--rose)'}}>{err}</span>}
    </label>
  );
}

function DataEntry({depts, addEntry, entries, initialDept, updateDept, deleteMonth, undo, canUndo}){
  const [mode,setMode]=React.useState('form');
  const [deptId,setDeptId]=React.useState(initialDept&&depts.some(d=>d.id===initialDept)?initialDept:depts[0].id);
  const [month,setMonth]=React.useState(()=>{
    const MO=window.UNICO.MONTH_ORDER;
    const initId=initialDept&&depts.some(d=>d.id===initialDept)?initialDept:depts[0].id;
    const dep=depts.find(x=>x.id===initId)||depts[0];
    const last=(dep.months||[])[(dep.months||[]).length-1];
    const i=last?MO.indexOf(last):-1;
    return (i>=0&&MO[i+1])||last||MO[0];
  });
  const [vals,setVals]=React.useState({});
  const [errs,setErrs]=React.useState({});
  const [step,setStep]=React.useState(0);
  const [toast,setToast]=React.useState(null);
  const [fldOpen,setFldOpen]=React.useState(false);
  const [fName,setFName]=React.useState(''); const [fPct,setFPct]=React.useState(false);
  const d=depts.find(x=>x.id===deptId)||depts[0];
  const MO=window.UNICO.MONTH_ORDER;
  // Next un-entered month for a department (so new entries don't overwrite the last one).
  const nextNew=(dep)=>{ const last=(dep.months||[])[(dep.months||[]).length-1]; const i=last?MO.indexOf(last):-1; return (i>=0&&MO[i+1])||last||MO[0]; };

  // Add a custom metric field/column to the selected department on the fly.
  // Persists to the dept's cols via the store so it shows in entry + statistics.
  const addField=()=>{
    const name=fName.trim();
    if(!name){ window.UI&&window.UI.toast('Enter a field name','error'); return; }
    if(!updateDept){ window.UI&&window.UI.toast('Custom fields unavailable here','error'); return; }
    let base=('c_'+name.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'')).slice(0,26);
    if(base==='c_'||base==='c') base='c_field';
    const existing=new Set(d.cols.map(c=>c.id)); let id=base,n=2; while(existing.has(id)){ id=base+'_'+(n++); }
    updateDept(d.id,{cols:[...d.cols.map(c=>({...c})),{id,label:name,pct:!!fPct}]});
    window.UI&&window.UI.toast(`Field "${name}" added to ${d.short}`,'success');
    setFName(''); setFPct(false); setFldOpen(false);
  };
  const removeField=(col)=>{
    if(!updateDept) return;
    window.UI.confirm({title:`Remove the "${col.label}" field?`,message:`Drops this metric from ${d.short}. Existing values for it are discarded.`,danger:true,confirmLabel:'Remove field'}).then(ok=>{
      if(!ok) return;
      updateDept(d.id,{cols:d.cols.filter(c=>c.id!==col.id).map(c=>({...c}))});
      window.UI.toast('Field removed','success');
    });
  };
  // Rolling lifetime month range: every reported month (for corrections) plus
  // ~3 years ahead of the latest, so data can be entered indefinitely.
  const monthOpts=(()=>{
    const all=d.months||[];
    const fi=Math.max(0, MO.indexOf(all[0]||MO[0]));
    const li=MO.indexOf(all[all.length-1]||MO[0]);
    let opts=MO.slice(fi, Math.min(MO.length, (li<0?fi:li)+37));
    if(month&&!opts.includes(month)) opts=opts.concat(month);
    return opts;
  })();
  const isExisting=(d.months||[]).includes(month);

  // "New month" picker — choose ANY month + year for lifetime data entry.
  const MONS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const MYEARS=Array.from({length:22},(_,i)=>2024+i);
  const parseKey=k=>{const p=String(k||'').split('-');return {mi:Math.max(0,MONS.indexOf(p[0])),yr:2000+(parseInt(p[1],10)||26)};};
  const [monthPickOpen,setMonthPickOpen]=React.useState(false);
  const [pm,setPm]=React.useState(()=>parseKey(month).mi);
  const [py,setPy]=React.useState(()=>parseKey(month).yr);
  const openMonthPicker=()=>{const p=parseKey(month);setPm(p.mi);setPy(p.yr);setMonthPickOpen(true);};
  const useCustomMonth=()=>{const key=MONS[pm]+'-'+String(py).slice(-2);setMonth(key);setMonthPickOpen(false);window.UI&&window.UI.toast('Reporting month set to '+(window.UNICO.MONTHS_FULL[key]||key),'success');};

  // Inline editing of EXISTING months in the grid.
  const [gridEdits,setGridEdits]=React.useState({});
  const gridCell=(mo,col,cur)=>(gridEdits[mo]&&gridEdits[mo][col]!==undefined)?gridEdits[mo][col]:(cur==null?'':cur);
  const setGridCell=(mo,col,v)=>setGridEdits(s=>({...s,[mo]:{...(s[mo]||{}),[col]:v}}));
  const updateMonthRow=(r)=>{const row={};d.cols.forEach(c=>{row[c.id]=Number(gridCell(r.month,c.id,r[c.id])||0);});addEntry({dept:d.id,deptName:d.short,month:r.month,full:r.full||window.UNICO.MONTHS_FULL[r.month]||r.month,row,ts:Date.now()});setToast(`Updated ${d.short} · ${r.full||r.month}`);setGridEdits(s=>{const n={...s};delete n[r.month];return n;});};
  const delMonthRow=(r)=>{if(!deleteMonth){window.UI&&window.UI.toast('Delete unavailable','error');return;}window.UI.confirm({title:`Delete ${r.full||r.month}?`,message:`Removes ${d.short}'s data for this month. You can Undo afterwards.`,danger:true,confirmLabel:'Delete'}).then(ok=>{if(ok){deleteMonth(d.id,r.month);window.UI.toast('Month deleted','success');}});};
  const doUndo=()=>{ if(undo){ undo(); window.UI&&window.UI.toast('Reverted last change','success'); } };

  React.useEffect(()=>{setVals({});setErrs({});setStep(0);setMonth(nextNew(d));setMonthPickOpen(false);setGridEdits({});},[deptId]);

  const set=(id,v)=>setVals(s=>({...s,[id]:v}));
  const validate=(cols)=>{
    const e={};
    cols.forEach(c=>{
      const raw=vals[c.id];
      if(raw===undefined||raw===''){ if(!c.pct) e[c.id]='Required'; }
      else if(Number(raw)<0) e[c.id]='Must be ≥ 0';
      else if(!c.pct && !Number.isInteger(Number(raw))) e[c.id]='Whole number';
    });
    // total check
    const totalCol=cols.find(c=>c.id==='total');
    if(totalCol && vals.total!==undefined){
      const comp=cols.filter(c=>c.id!=='total'&&!c.pct&&['cag','pci','ppm','tpm','dsa','endo','colon','polyp','histo','bronch','pluro','cabg','valve','other'].includes(c.id));
      if(comp.length){
        const sum=comp.reduce((s,c)=>s+Number(vals[c.id]||0),0);
        if(Number(vals.total)!==sum) e.total=`≠ component sum (${sum})`;
      }
    }
    return e;
  };

  const submit=async ()=>{
    const e=validate(d.cols);
    setErrs(e);
    // Hard errors (negative, non-whole, total≠sum) must be fixed — they're bad data, not missing data.
    const hard=Object.keys(e).filter(k=>e[k]!=='Required');
    if(hard.length){ return false; }
    // Missing fields are allowed: warn the admin, and on confirm save them blank (null) rather than a fake 0.
    const missing=d.cols.filter(c=>e[c.id]==='Required');
    if(missing.length){
      const names=missing.map(c=>c.label).join(', ');
      const ok = (window.UI&&window.UI.confirm)
        ? await window.UI.confirm({
            title:`Save with ${missing.length} field${missing.length>1?'s':''} missing?`,
            message:`No value entered for: ${names}. These will be saved as blank (—) and won't be counted in charts or totals — you can fill them in later.`,
            confirmLabel:'Save anyway', cancelLabel:'Keep editing' })
        : window.confirm(`Save with missing data (${names})?`);
      if(!ok) return false;
    }
    const row={};
    d.cols.forEach(c=>{ const raw=vals[c.id]; row[c.id]=(raw===undefined||raw==='')?null:Number(raw); });
    addEntry({dept:d.id,deptName:d.short,month,full:window.UNICO.MONTHS_FULL[month]||month,row,ts:Date.now()});
    setToast(`Saved ${d.short} · ${month}`);
    setVals({});setErrs({});setStep(0);
    return true;
  };

  const tabBtn=(id,label,icon)=>(
    <button onClick={()=>setMode(id)} style={{display:'flex',alignItems:'center',gap:8,padding:'10px 16px',border:'0',
      borderBottom:'2.5px solid '+(mode===id?'var(--blue)':'transparent'),background:'transparent',
      color:mode===id?'var(--blue)':'var(--muted)',fontWeight:600,fontSize:13}}>
      <Ic d={icon} s={16}/>{label}
    </button>
  );

  // ---- shared dept/month selector ----
  const selector=(
    <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'flex-end'}}>
      <label style={{display:'flex',flexDirection:'column',gap:5,minWidth:240}}>
        <span style={{fontSize:11.5,fontWeight:600,color:'var(--ink-2)'}}>Department</span>
        <select value={deptId} onChange={e=>setDeptId(e.target.value)}
          style={{padding:'9px 11px',border:'1px solid var(--line)',borderRadius:7,fontSize:13,fontFamily:'inherit',background:'#fff'}}>
          {depts.map(x=><option key={x.id} value={x.id}>{x.name} ({x.short})</option>)}
        </select>
      </label>
      <label style={{display:'flex',flexDirection:'column',gap:5,minWidth:170}}>
        <span style={{fontSize:11.5,fontWeight:600,color:'var(--ink-2)'}}>Reporting Month</span>
        <select value={month} onChange={e=>setMonth(e.target.value)}
          style={{padding:'9px 11px',border:'1px solid var(--line)',borderRadius:7,fontSize:13,fontFamily:'inherit',background:'#fff'}}>
          {monthOpts.map(m=><option key={m} value={m}>{window.UNICO.MONTHS_FULL[m]||m}</option>)}
        </select>
        <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
          <span className="tag" style={{fontSize:10,background:isExisting?'#fbeed0':'var(--pos-bg)',color:isExisting?'var(--amber)':'var(--pos)'}}>{isExisting?'Editing existing':'New month'}</span>
          <button type="button" onClick={openMonthPicker} title="Enter data for any month / year"
            style={{display:'inline-flex',alignItems:'center',gap:3,border:0,background:'none',color:'var(--blue)',fontSize:11,fontWeight:700,cursor:'pointer',padding:0}}>
            <Ic d={I.plus} s={12} sw={2.6}/>New month
          </button>
        </div>
        {monthPickOpen&&(
          <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap',background:'var(--panel-2)',border:'1px solid var(--line)',borderRadius:7,padding:'7px 8px',marginTop:2}}>
            <select value={pm} onChange={e=>setPm(+e.target.value)} style={{padding:'5px 7px',border:'1px solid var(--line)',borderRadius:6,fontSize:12.5,fontFamily:'inherit',background:'#fff'}}>
              {MONS.map((mn,i)=><option key={mn} value={i}>{mn}</option>)}
            </select>
            <select value={py} onChange={e=>setPy(+e.target.value)} style={{padding:'5px 7px',border:'1px solid var(--line)',borderRadius:6,fontSize:12.5,fontFamily:'inherit',background:'#fff'}}>
              {MYEARS.map(y=><option key={y} value={y}>{y}</option>)}
            </select>
            <button className="btn sm pri" type="button" onClick={useCustomMonth}><Ic d={I.check} s={13}/>Use</button>
            <button className="btn sm" type="button" onClick={()=>setMonthPickOpen(false)}>Cancel</button>
          </div>
        )}
      </label>
    </div>
  );

  return (
    <div className="grid" style={{gap:16}}>
      <SectionTitle icon={I.input} title="Data Entry" sub="Capture monthly department statistics — saved entries flow straight into dashboards"/>
      <div className="card">
        <div style={{display:'flex',borderBottom:'1px solid var(--line)',padding:'0 8px',alignItems:'center'}}>
          {tabBtn('form','Quick Form',I.edit)}
          {tabBtn('grid','Grid Entry',I.grid)}
          {tabBtn('wizard','Guided Wizard',I.steth)}
          <span style={{flex:1}}/>
          {canUndo&&<button className="btn sm" style={{marginRight:6}} onClick={doUndo} title="Undo the last data change"><Ic d={I.chevR} s={13} style={{transform:'rotate(180deg)'}}/>Undo</button>}
        </div>

        {/* ---------------- FORM ---------------- */}
        {mode==='form'&&(
          <div className="card-b" style={{display:'flex',flexDirection:'column',gap:18}}>
            {selector}
            <div style={{height:1,background:'var(--line-2)'}}/>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:14}}>
              {d.cols.map(c=><NumField key={c.id} col={c} value={vals[c.id]??''} err={errs[c.id]} onChange={v=>set(c.id,v)}/>)}
            </div>
            <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
              {!fldOpen
                ? <button className="btn sm" onClick={()=>setFldOpen(true)} style={{borderStyle:'dashed'}}><Ic d={I.plus} s={14}/>Add custom field</button>
                : <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',background:'var(--panel-2)',border:'1px solid var(--line)',borderRadius:8,padding:'10px 12px'}}>
                    <span style={{fontSize:11.5,fontWeight:600,color:'var(--ink-2)'}}>New field for {d.short}:</span>
                    <input autoFocus placeholder="e.g. Ventilator days" value={fName} onChange={e=>setFName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')addField();}}
                      style={{padding:'7px 10px',border:'1px solid var(--line)',borderRadius:7,fontFamily:'inherit',fontSize:13,minWidth:190,outline:'none'}}/>
                    <label style={{display:'flex',alignItems:'center',gap:5,fontSize:12,color:'var(--ink-2)'}}><input type="checkbox" checked={fPct} onChange={e=>setFPct(e.target.checked)}/>%</label>
                    <button className="btn sm pri" onClick={addField}><Ic d={I.check} s={14}/>Add</button>
                    <button className="btn sm" onClick={()=>{setFldOpen(false);setFName('');setFPct(false);}}>Cancel</button>
                  </div>}
              {d.cols.filter(c=>String(c.id).startsWith('c_')).map(c=>(
                <span key={c.id} className="col-chip" style={{gap:5}}>{c.label}
                  <button className="icon-btn" style={{width:18,height:18,border:0,background:'transparent',color:'var(--rose)'}} title="Remove field" onClick={()=>removeField(c)}><Ic d={I.x} s={12}/></button>
                </span>
              ))}
            </div>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <button className="btn pri" onClick={submit}><Ic d={I.check} s={16} sw={2.4}/>Save Entry</button>
              <button className="btn" onClick={()=>{setVals({});setErrs({});}}>Clear</button>
              {Object.keys(errs).length>0&&(()=>{
                const hard=Object.keys(errs).filter(k=>errs[k]!=='Required').length;
                const miss=Object.keys(errs).length-hard;
                return hard
                  ? <span style={{fontSize:12,color:'var(--rose)',fontWeight:600}}>Fix {hard} field{hard>1?'s':''} before saving</span>
                  : <span style={{fontSize:12,color:'var(--amber)',fontWeight:600}}>{miss} field{miss>1?'s':''} empty — you'll be asked to confirm</span>;
              })()}
              <span className="spacer"/>
              <span style={{fontSize:11.5,color:'var(--faint)'}}>Auto-validates totals & non-negative counts</span>
            </div>
          </div>
        )}

        {/* ---------------- GRID ---------------- */}
        {mode==='grid'&&(
          <div className="card-b" style={{display:'flex',flexDirection:'column',gap:14}}>
            {selector}
            <div style={{fontSize:12,color:'var(--muted)'}}>Spreadsheet entry — existing months are <b>editable</b>; change a value then click <b>Update</b>, or <b>Delete</b> a month. The highlighted row adds the next new month.</div>
            <div style={{overflowX:'auto',border:'1px solid var(--line)',borderRadius:9}}>
              <table className="tbl" style={{minWidth:620}}>
                <thead><tr><th>Month</th>{d.cols.map(c=><th key={c.id}>{c.label}</th>)}<th style={{textAlign:'right'}}>Actions</th></tr></thead>
                <tbody>
                  {d.series.slice(-8).map((r)=>{
                    const dirty=!!gridEdits[r.month];
                    return (
                    <tr key={r.month} style={dirty?{background:'#fff8ec'}:null}>
                      <td style={{fontWeight:600,whiteSpace:'nowrap'}}>{r.full||r.month}</td>
                      {d.cols.map(c=>(
                        <td key={c.id} style={{padding:4}}>
                          <input type="number" min="0" value={gridCell(r.month,c.id,r[c.id])} onChange={e=>setGridCell(r.month,c.id,e.target.value)}
                            style={{width:'100%',minWidth:60,padding:'6px 6px',border:'1px solid '+(dirty?'var(--amber)':'var(--line)'),borderRadius:5,fontFamily:'IBM Plex Mono',fontSize:13,textAlign:'right',outline:'none',background:'#fff'}}/>
                        </td>
                      ))}
                      <td style={{padding:4,whiteSpace:'nowrap',textAlign:'right'}}>
                        <button className="btn sm" disabled={!dirty} onClick={()=>updateMonthRow(r)} style={{opacity:dirty?1:.45}}>Update</button>
                        <button className="icon-btn" title="Delete this month" style={{marginLeft:5,color:'var(--rose)',borderColor:'#f1c6cd'}} onClick={()=>delMonthRow(r)}><Ic d={I.x} s={13}/></button>
                      </td>
                    </tr>
                  );})}
                  {!isExisting&&(
                  <tr style={{background:'var(--blue-50)'}}>
                    <td style={{fontWeight:700,color:'var(--blue)',whiteSpace:'nowrap'}}>{window.UNICO.MONTHS_FULL[month]||month}</td>
                    {d.cols.map(c=>(
                      <td key={c.id} style={{padding:4}}>
                        <input type="number" min="0" value={vals[c.id]??''} onChange={e=>set(c.id,e.target.value)}
                          style={{width:'100%',minWidth:60,padding:'6px 6px',border:'1px solid '+(errs[c.id]?'var(--rose)':'var(--line)'),
                            borderRadius:5,fontFamily:'IBM Plex Mono',fontSize:13,textAlign:'right',outline:'none',background:errs[c.id]?'var(--neg-bg)':'#fff'}}/>
                      </td>
                    ))}
                    <td style={{padding:4,textAlign:'right',color:'var(--blue)',fontSize:11,fontWeight:600}}>new</td>
                  </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div style={{display:'flex',gap:10}}>
              <button className="btn pri" onClick={submit} disabled={isExisting} style={{opacity:isExisting?.5:1}} title={isExisting?'This month already exists — edit it in the row above':''}><Ic d={I.check} s={16} sw={2.4}/>Commit New Row</button>
              <button className="btn" onClick={()=>setVals({})}>Reset Row</button>
            </div>
          </div>
        )}

        {/* ---------------- WIZARD ---------------- */}
        {mode==='wizard'&&(()=>{
          const steps=['Select','Core metrics','Detail metrics','Review'];
          const primaryCols=d.cols.filter(c=>c.id===d.primary||['adm','reg','total'].includes(c.id)).slice(0,3);
          const otherCols=d.cols.filter(c=>!primaryCols.includes(c));
          const next=()=>{
            if(step===1){const e=validate(primaryCols);setErrs(e);if(Object.keys(e).length)return;}
            if(step===2){const e=validate(otherCols);setErrs(e);if(Object.keys(e).length)return;}
            setStep(s=>Math.min(3,s+1));
          };
          return (
            <div className="card-b" style={{display:'flex',flexDirection:'column',gap:18}}>
              {/* stepper */}
              <div style={{display:'flex',alignItems:'center',gap:0}}>
                {steps.map((s,i)=>(
                  <React.Fragment key={i}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <div style={{width:26,height:26,borderRadius:'50%',display:'grid',placeItems:'center',fontSize:12,fontWeight:700,
                        background:i<step?'var(--green)':(i===step?'var(--blue)':'#e8edf3'),color:i<=step?'#fff':'var(--muted)'}}>
                        {i<step?<Ic d={I.check} s={14} c="#fff" sw={3}/>:i+1}
                      </div>
                      <span style={{fontSize:12.5,fontWeight:600,color:i===step?'var(--ink)':'var(--muted)'}}>{s}</span>
                    </div>
                    {i<steps.length-1&&<div style={{flex:1,height:2,background:i<step?'var(--green)':'#e8edf3',margin:'0 12px'}}/>}
                  </React.Fragment>
                ))}
              </div>
              <div style={{height:1,background:'var(--line-2)'}}/>

              {step===0&&<div style={{display:'flex',flexDirection:'column',gap:16}}>{selector}
                <div style={{fontSize:12.5,color:'var(--muted)',background:'var(--blue-50)',padding:'11px 14px',borderRadius:8}}>
                  You're entering data for <b style={{color:'var(--ink)'}}>{d.name}</b> — {window.UNICO.MONTHS_FULL[month]||month}. This wizard captures {d.cols.length} metric{d.cols.length>1?'s':''} in {primaryCols.length<d.cols.length?'two':'one'} stage{primaryCols.length<d.cols.length?'s':''} with validation at each step.
                </div></div>}

              {step===1&&<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))',gap:14}}>
                {primaryCols.map((c,i)=><NumField key={c.id} col={c} value={vals[c.id]??''} err={errs[c.id]} autoFocus={i===0} onChange={v=>set(c.id,v)}/>)}
              </div>}

              {step===2&&(otherCols.length?<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))',gap:14}}>
                {otherCols.map((c,i)=><NumField key={c.id} col={c} value={vals[c.id]??''} err={errs[c.id]} autoFocus={i===0} onChange={v=>set(c.id,v)}/>)}
              </div>:<div style={{fontSize:13,color:'var(--muted)'}}>No additional metrics for this department.</div>)}

              {step===3&&<div className="card" style={{padding:0,overflow:'hidden'}}>
                <div className="card-h"><h3>Review — {d.name} · {window.UNICO.MONTHS_FULL[month]||month}</h3></div>
                <table className="tbl"><tbody>
                  {d.cols.map(c=>(
                    <tr key={c.id}><td>{c.label}</td><td style={{fontSize:14,fontWeight:600,color:'var(--ink)'}}>{vals[c.id]??'0'}{c.pct?'%':''}</td></tr>
                  ))}
                </tbody></table>
              </div>}

              <div style={{display:'flex',gap:10}}>
                {step>0&&<button className="btn" onClick={()=>setStep(s=>s-1)}>Back</button>}
                <span className="spacer"/>
                {step<3?<button className="btn pri" onClick={next}>Continue<Ic d={I.arrowR} s={15}/></button>
                  :<button className="btn pri" onClick={submit}><Ic d={I.check} s={16} sw={2.4}/>Confirm & Save</button>}
              </div>
            </div>
          );
        })()}
      </div>

      {/* recent entries */}
      <div className="card" style={{overflow:'hidden'}}>
        <div className="card-h"><h3>Recent Submissions</h3><span className="sub">this session</span><span className="spacer"/>
          <span className="tag num">{entries.length} saved</span></div>
        {entries.length===0?(
          <div className="card-b" style={{textAlign:'center',color:'var(--faint)',padding:'30px'}}>
            <Ic d={I.doc} s={30} c="#c4ccd6"/><div style={{marginTop:8,fontSize:13}}>No entries yet — saved rows will appear here.</div>
          </div>
        ):(
          <table className="tbl"><thead><tr><th>Department</th><th>Month</th><th>Primary metric</th><th>Fields</th><th>Saved</th></tr></thead>
            <tbody>{entries.slice().reverse().map((e,i)=>{
              const dd=depts.find(x=>x.id===e.dept);
              return <tr key={i}><td>{e.deptName}</td><td>{e.full}</td>
                <td>{fmt(e.row[dd.primary]||0)}</td><td>{Object.keys(e.row).length}</td>
                <td style={{color:'var(--green)'}}>✓ {new Date(e.ts).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</td></tr>;
            })}</tbody>
          </table>
        )}
      </div>
      {toast&&<Toast msg={toast} onDone={()=>setToast(null)}/>}
    </div>
  );
}
window.DataEntry=DataEntry;
