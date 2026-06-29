/* UNICO — Quality Indicator Reference Catalog (NABH/JCI-style definitions)
   Read-only reference built from QI_DEFS (authoritative formulas/definitions in
   quality-entry.jsx) and cross-referenced against window.QUALITY_SEED to show
   which departments report each indicator. Global-script React — no imports. */

/* ---- helpers (self-contained; QI_DEFS / qiFormulaText are globals from quality-entry.jsx) ---- */

// QI_DEFS has no explicit `category` field, so derive an NABH-style clinical
// domain from the indicator id/name. Falls back to "Other".
function qcCategory(def){
  if(def.category) return def.category;                 // honour it if ever added
  const id=def.id||'', n=(def.name||'').toLowerCase();
  if(['cauti','clabsi','vap','ssi','phlebitis'].includes(id) || /infection|cauti|clabsi|vap|ssi|phlebitis|sepsis/.test(n))
    return 'Healthcare-Associated Infection';
  if(['fall','hapu','mederror'].includes(id) || /fall|pressure|hapu|ulcer|medication/.test(n))
    return 'Patient Safety';
  if(['handhygiene'].includes(id) || /hand hygiene|compliance/.test(n))
    return 'Infection Prevention';
  if(['reintubation','readmission'].includes(id) || /re-?intubation|re-?admission|return to icu/.test(n))
    return 'Clinical Outcomes';
  if(['nsi'].includes(id) || /needle stick|staff/.test(n))
    return 'Staff Safety';
  return 'Other';
}

// Human formula text. Prefer the authoritative qiFormulaText() from quality-entry.jsx;
// fall back to deriving it from formula/valueType when fields are missing.
function qcFormulaText(def){
  try{ if(typeof qiFormulaText==='function') return qiFormulaText(def); }catch(e){}
  if(!def) return '—';
  if(def.formula==='count' || !def.den) return `${def.name||'Indicator'} = ${def.num||'event count'}`;
  const mult=def.formula==='rate1000'?'× 1000':def.formula==='rate100'?'× 100':'× 100';
  return `${def.name} = (${def.num} ÷ ${def.den}) ${mult}`;
}

// Classify the measure type for the KPI strip.
function qcMeasureType(def){
  if(def.formula==='pct') return 'Percentage';
  if(def.formula==='rate1000'||def.formula==='rate100') return 'Rate';
  return 'Count';
}

function qcGoalDir(def){
  return def.dir==='higher' ? {sym:'↑',label:'Higher is better',tone:'#0090ca'}
                            : {sym:'↓',label:'Lower is better',tone:'#1f9d57'};
}

// Benchmark text — tolerate numeric / missing benchmark.
function qcBenchmark(def){
  const b=def.benchmark;
  if(b==null||b==='') return '—';
  const pct=def.formula==='pct'?'%':'';
  return `${def.dir==='higher'?'≥':'≤'} ${b}${pct}`;
}

// Normalise a name for fuzzy matching across QI_DEFS and QUALITY_SEED.
// Strips parenthetical abbreviations, punctuation, "rate/compliance" suffixes, etc.
function qcNorm(s){
  return (s||'').toLowerCase()
    .replace(/\([^)]*\)/g,' ')                 // drop "(CAUTI)" etc.
    .replace(/within \d+\s*h(ou)?rs?/g,' ')     // "within 48 hours"
    .replace(/<\s*\d+\s*h/g,' ')
    .replace(/[^a-z0-9 ]+/g,' ')
    .replace(/\b(rate|compliance|cases?|events?|injury|the|of|per|associated)\b/g,' ')
    .replace(/\s+/g,' ').trim();
}

// Tokens that strongly identify an indicator family, used as a fallback matcher.
const QC_ALIASES={
  cauti:['cauti','catheter associated uti','urinary'],
  clabsi:['clabsi','central line'],
  vap:['vap','ventilator associated pneumonia','vae','ventilator associated event'],
  fall:['patient fall','fall'],
  hapu:['hapu','pressure ulcer','pressure injury','bed sore'],
  phlebitis:['phlebitis'],
  handhygiene:['hand hygiene'],
  mederror:['medication error'],
  reintubation:['re-intubation','reintubation','re intubation'],
  readmission:['re-admission','readmission','re admission','return to icu'],
  nsi:['needle stick','nsi'],
  ssi:['ssi','surgical site infection'],
};

// Does a QUALITY_SEED indicator (by name) report this QI_DEFS indicator?
function qcMatches(def, seedIndName){
  const a=qcNorm(def.name), b=qcNorm(seedIndName);
  if(!a||!b) return false;
  if(a===b) return true;
  if(a.length>3 && (b.includes(a)||a.includes(b))) return true;
  const aliases=QC_ALIASES[def.id]||[];
  const raw=(seedIndName||'').toLowerCase();
  return aliases.some(al=>raw.includes(al));
}

// For a QI_DEFS indicator, find departments in QUALITY_SEED that report it.
function qcDeptsFor(def){
  const seed=window.QUALITY_SEED||[];
  const out=[];
  seed.forEach(d=>{
    const inds=d.indicators||[];
    const hit=inds.find(ind=>qcMatches(def,ind.name));
    if(hit) out.push({key:d.key,name:d.name,indName:hit.name});
  });
  return out;
}

/* ---------------- KPI tile (local, matches Quality module style) ---------------- */
function QcKpi({label,val,foot,color}){
  return (
    <div className="card anim-pop" style={{padding:'16px 18px',borderLeft:`4px solid ${color}`,display:'flex',flexDirection:'column',minHeight:108}}>
      <div style={{fontSize:12.5,fontWeight:700,color:'var(--ink-2)'}}>{label}</div>
      <div className="num" style={{fontSize:30,fontWeight:700,color,margin:'8px 0 5px',lineHeight:1}}>{val}</div>
      <div style={{fontSize:11,color:'var(--muted)',marginTop:'auto'}}>{foot}</div>
    </div>
  );
}

/* ---------------- Detail card for one indicator ---------------- */
function QcDetail({def, setRoute}){
  const dir=qcGoalDir(def);
  const depts=qcDeptsFor(def);
  const measure=qcMeasureType(def);
  const Row=({label,children})=>(
    <div style={{display:'grid',gridTemplateColumns:'150px 1fr',gap:10,padding:'7px 0',borderBottom:'1px solid var(--line-2)',alignItems:'baseline'}}>
      <div style={{fontSize:10.5,textTransform:'uppercase',letterSpacing:.4,fontWeight:700,color:'var(--muted)'}}>{label}</div>
      <div style={{fontSize:12.5,color:'var(--ink-2)',lineHeight:1.5}}>{children}</div>
    </div>
  );
  return (
    <div style={{padding:'4px 2px 8px'}}>
      {/* formula banner — same blue mono style as the entry form */}
      <div style={{background:'var(--blue-50)',border:'1px solid var(--blue-100)',borderRadius:9,padding:'11px 14px',fontSize:12.5,color:'var(--blue-700)',fontFamily:'IBM Plex Mono',marginBottom:10}}>
        ƒ {qcFormulaText(def)}
      </div>
      <Row label="Numerator">{def.num||'—'}</Row>
      <Row label="Denominator">{def.formula==='count'||!def.den ? <span style={{color:'var(--faint)'}}>— (raw event count, no denominator)</span> : def.den}</Row>
      <Row label="Unit">{def.unit||'—'} <span style={{color:'var(--faint)'}}>· {measure}-based</span></Row>
      <Row label="Benchmark / Target">{qcBenchmark(def)}</Row>
      <Row label="Goal direction"><span style={{color:dir.tone,fontWeight:700}}>{dir.sym} {dir.label}</span></Row>
      <Row label="Reporting frequency">Monthly</Row>
      <Row label="Reported by">
        {depts.length===0 ? <span style={{color:'var(--faint)'}}>No department in the current dataset reports this indicator.</span> : (
          <div style={{display:'flex',flexWrap:'wrap',gap:7}}>
            {depts.map(d=>(
              <span key={d.key} className="col-chip" title={`Reported as "${d.indName}" — open ${d.name}`}
                onClick={()=>setRoute&&setRoute({view:'qualityDept',dept:d.key})}
                style={{cursor:'pointer'}}>
                <Ic d={I.heart} s={12}/>{d.name}
              </span>
            ))}
          </div>
        )}
      </Row>
    </div>
  );
}

/* ---------------- Main catalog screen ---------------- */
function QualityCatalog({setRoute}){
  const defs=(typeof QI_DEFS!=='undefined' && Array.isArray(QI_DEFS)) ? QI_DEFS : [];
  const [q,setQ]=React.useState('');
  const [cat,setCat]=React.useState('all');           // category filter chip
  const [open,setOpen]=React.useState(()=>defs[0]?defs[0].id:null); // expanded row

  // decorate
  const items=defs.map(def=>({def, category:qcCategory(def), depts:qcDeptsFor(def), measure:qcMeasureType(def)}));

  // KPI numbers
  const categories=[...new Set(items.map(i=>i.category))];
  const nRate=items.filter(i=>i.measure==='Rate').length;
  const nCount=items.filter(i=>i.measure==='Count').length;
  const nPct=items.filter(i=>i.measure==='Percentage').length;

  // filtering
  const ql=q.trim().toLowerCase();
  const filtered=items.filter(i=>{
    if(cat!=='all' && i.category!==cat) return false;
    if(!ql) return true;
    return (i.def.name||'').toLowerCase().includes(ql)
      || i.category.toLowerCase().includes(ql)
      || (i.def.num||'').toLowerCase().includes(ql)
      || (i.def.den||'').toLowerCase().includes(ql)
      || (i.def.unit||'').toLowerCase().includes(ql);
  });

  // group filtered items by category for display
  const grouped={};
  filtered.forEach(i=>{ (grouped[i.category]=grouped[i.category]||[]).push(i); });
  const groupOrder=Object.keys(grouped).sort();

  const searchSty={padding:'9px 11px',border:'1px solid var(--line)',borderRadius:8,fontSize:13,fontFamily:'inherit',background:'#fff',width:'100%',outline:'none'};

  const measureTone={Rate:'#6a52d4',Count:'#0090ca',Percentage:'#3ab5a7'};

  return (
    <div className="grid" style={{gap:16}}>
      <SectionTitle icon={I.doc} title="Quality Indicator Catalog"
        sub="NABH / JCI-style reference — formula, numerator, denominator, benchmark & reporting departments for every tracked indicator"
        right={<button className="btn sm" onClick={()=>setRoute&&setRoute({view:'quality'})}><Ic d={I.heart} s={15}/>Dashboard</button>}/>

      {/* KPI strip */}
      <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))'}}>
        <QcKpi label="Indicators" val={fmt(items.length)} foot="defined in the catalog" color="#0090ca"/>
        <QcKpi label="Categories" val={fmt(categories.length)} foot="clinical / safety domains" color="#6a52d4"/>
        <QcKpi label="Rate-based" val={fmt(nRate)} foot="per 1000 / per 100 days" color={measureTone.Rate}/>
        <QcKpi label="Count vs %" val={`${nCount} · ${nPct}`} foot="count-based · percentage" color="#1f9d57"/>
      </div>

      {/* search + category chips */}
      <div className="card"><div className="card-b" style={{display:'flex',flexDirection:'column',gap:12}}>
        <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
          <div style={{position:'relative',flex:1,minWidth:220}}>
            <span style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'var(--faint)',pointerEvents:'none'}}><Ic d={I.search} s={15}/></span>
            <input style={{...searchSty,paddingLeft:32}} placeholder="Search by name, category, numerator…" value={q} onChange={e=>setQ(e.target.value)}/>
          </div>
          <span style={{fontSize:11.5,color:'var(--muted)',whiteSpace:'nowrap'}}>{filtered.length} of {items.length} shown</span>
        </div>
        <div style={{display:'flex',gap:7,flexWrap:'wrap'}}>
          {['all',...categories].map(c=>{
            const on=cat===c;
            const n=c==='all'?items.length:items.filter(i=>i.category===c).length;
            return (
              <span key={c} onClick={()=>setCat(c)}
                style={{cursor:'pointer',fontSize:11.5,fontWeight:600,padding:'5px 11px',borderRadius:20,
                  border:'1px solid '+(on?'var(--blue)':'var(--line)'),
                  background:on?'var(--blue)':'var(--panel-2)',color:on?'#fff':'var(--ink-2)'}}>
                {c==='all'?'All indicators':c} <span style={{opacity:.7}}>· {n}</span>
              </span>
            );
          })}
        </div>
      </div></div>

      {/* grouped expandable list */}
      {filtered.length===0 && (
        <div className="card"><div className="card-b" style={{textAlign:'center',color:'var(--faint)',padding:'34px',fontSize:13}}>No indicators match your search.</div></div>
      )}

      {groupOrder.map(gname=>(
        <div key={gname} className="card" style={{overflow:'hidden'}}>
          <div className="card-h">
            <h3>{gname}</h3>
            <span className="sub">{grouped[gname].length} indicator{grouped[gname].length!==1?'s':''}</span>
            <span className="spacer"/>
          </div>
          <div>
            {grouped[gname].map(({def,depts,measure})=>{
              const isOpen=open===def.id;
              const dir=qcGoalDir(def);
              return (
                <div key={def.id} style={{borderBottom:'1px solid var(--line-2)'}}>
                  {/* clickable summary row */}
                  <div onClick={()=>setOpen(isOpen?null:def.id)}
                    style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',cursor:'pointer',background:isOpen?'var(--blue-50)':'transparent'}}>
                    <Ic d={I.chevR} s={15} style={{transform:isOpen?'rotate(90deg)':'none',transition:'transform .15s',color:'var(--faint)',flexShrink:0}}/>
                    <div style={{minWidth:0,flex:1}}>
                      <div style={{fontSize:13.5,fontWeight:600,color:'var(--ink)'}}>{def.name||'—'}</div>
                      <div style={{fontSize:11,color:'var(--muted)',fontFamily:'IBM Plex Mono',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{qcFormulaText(def)}</div>
                    </div>
                    <span className="tag" style={{flexShrink:0}}>{def.unit||measure}</span>
                    <span className="chip" style={{flexShrink:0,background:measureTone[measure]+'1c',color:measureTone[measure]}}>{measure}</span>
                    <span className="chip" style={{flexShrink:0,background:dir.tone+'1c',color:dir.tone}} title={dir.label}>{dir.sym}</span>
                    <span className="tag num" style={{flexShrink:0}} title="Departments reporting this indicator">{depts.length} dept{depts.length!==1?'s':''}</span>
                  </div>
                  {/* expanded detail */}
                  {isOpen && (
                    <div style={{padding:'2px 16px 12px 43px',background:'var(--panel-2)'}}>
                      <QcDetail def={def} setRoute={setRoute}/>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

window.QualityCatalog=QualityCatalog;
