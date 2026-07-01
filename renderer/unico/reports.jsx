/* UNICO — Reports & Settings */
const PAGE_SIZES={A4:[700,1.414],A3:[815,1.414],Letter:[700,1.294]};
const CHART_STYLE_LABEL={bar3d:'3D Bars',bar:'Bar',line:'Line',area:'Area + Target',combo:'Bar + Line',grouped:'Grouped',stacked:'Stacked',pct:'100% Stacked',horizontal:'Horizontal',donut:'Composition'};
const REPORT_STYLES=[['bar3d','3D'],['bar','Bar'],['line','Line'],['area','Area'],['combo','Bar+Line'],['grouped','Grouped'],['stacked','Stacked'],['pct','100%'],['horizontal','Horizontal'],['donut','Donut']];
function reportSeries(d){ return d.cols.filter(c=>c.id!==d.primary&&!c.pct).slice(0,6).map((c,i)=>({id:c.id,label:c.label,color:PALETTE[i%PALETTE.length]})); }
function reportChartEl(d,style,tone,fs,donutData){
  const has=n=>typeof window[n]==='function';
  if(style==='bar') return <BarChart data={fs} x="month" y={d.primary} height={195} color={tone} flat/>;
  if(style==='line') return <LineChart data={fs} x="full" y={d.primary} height={195} color={tone} flat/>;
  if(style==='area'&&has('AreaTargetChart')){ const avg=fs.length?Math.round(fs.reduce((s,r)=>s+(r[d.primary]||0),0)/fs.length):0; return <AreaTargetChart data={fs} x="full" y={d.primary} target={avg} height={200} color={tone} flat/>; }
  if(style==='combo'&&has('ComboChart')){ const pctCol=d.cols.find(c=>c.pct); const lineKey=pctCol?pctCol.id:((d.cols.find(c=>c.id!==d.primary&&!c.pct)||{}).id||d.primary); return <ComboChart data={fs} x="month" barKey={d.primary} lineKey={lineKey} barColor={tone} lineColor="#e08a1e" barLabel={(d.cols.find(c=>c.id===d.primary)||{}).label||'Value'} lineLabel={(d.cols.find(c=>c.id===lineKey)||{}).label||'Trend'} height={210} flat/>; }
  if(style==='grouped'){ const sr=reportSeries(d); return sr.length?<GroupedBar data={fs} x="month" series={sr} height={210}/>:<BarChart data={fs} x="month" y={d.primary} height={195} color={tone} flat/>; }
  if(style==='stacked'){ const sr=reportSeries(d); return sr.length?<StackedBar data={fs} x="month" series={sr} height={210}/>:<BarChart data={fs} x="month" y={d.primary} height={195} color={tone} flat/>; }
  if(style==='pct'&&has('StackedPctBar')){ const sr=reportSeries(d); return sr.length?<StackedPctBar data={fs} x="month" series={sr} height={210} flat/>:<BarChart data={fs} x="month" y={d.primary} height={195} color={tone} flat/>; }
  if(style==='horizontal'&&has('HBarChart')) return <HBarChart data={fs.map(r=>({label:r.full,val:r[d.primary]||0}))} x="label" y="val" height={Math.max(150,fs.length*30)} flat/>;
  if(style==='donut') return donutData.length>1
    ? <div style={{display:'grid',placeItems:'center',minHeight:205}}><Donut data={donutData} size={188} centerValue={fmt(donutData.reduce((s,x)=>s+x.value,0))} centerLabel="Total" flat/></div>
    : <Bar3D data={fs} x="month" y={d.primary} height={205} color={tone} flat/>;
  return <Bar3D data={fs} x="month" y={d.primary} height={205} color={tone} flat/>; // bar3d + default
}

function Reports({depts}){
  const MO=window.UNICO.MONTH_ORDER, MF=window.UNICO.MONTHS_FULL;
  const [sel,setSel]=React.useState(depts.slice(0,4).map(d=>d.id));
  const [type,setType]=React.useState('summary');
  const [period,setPeriod]=React.useState({mode:'all'});
  const [chartStyles,setChartStyles]=React.useState(['bar3d']);
  const toggleStyle=s=>setChartStyles(a=>a.includes(s)?(a.length>1?a.filter(x=>x!==s):a):[...a,s]);
  // Header / footer editor
  const [hdrTitle,setHdrTitle]=React.useState('Patient Flow Census');
  const [hdrSub,setHdrSub]=React.useState('');
  const [hospitalName,setHospitalName]=React.useState('UNICO HOSPITALS PLC');
  const [showLogo,setShowLogo]=React.useState(true);
  const [confidential,setConfidential]=React.useState(true);
  const [footerNote,setFooterNote]=React.useState('');
  const [pageSize,setPageSize]=React.useState('A4');
  const [orient,setOrient]=React.useState('portrait');
  const [pageIdx,setPageIdx]=React.useState(0);
  const toggle=id=>setSel(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);
  const chosen=depts.filter(d=>sel.includes(d.id));

  const allMonths=[...new Set(depts.flatMap(d=>d.months))].sort((a,b)=>MO.indexOf(a)-MO.indexOf(b));
  const pMonths=(()=>{
    if(period.mode==='q1') return ['Jan-26','Feb-26','Mar-26'];
    if(period.mode==='apr') return ['Apr-26'];
    if(period.mode==='last6') return allMonths.slice(-6);
    if(period.mode==='custom'){const fi=allMonths.indexOf(period.from||allMonths[0]),ti=allMonths.indexOf(period.to||allMonths[allMonths.length-1]);const a=Math.min(fi,ti),b=Math.max(fi,ti);return allMonths.slice(a,b+1);}
    return allMonths;
  })();
  const pSet=new Set(pMonths);
  const rangeLabel = pMonths.length?`${MF[pMonths[0]]||pMonths[0]} – ${MF[pMonths[pMonths.length-1]]||pMonths[pMonths.length-1]}`:'—';
  const fseriesOf=d=>{const f=d.series.filter(r=>pSet.has(r.month));return f.length?f:d.series;};
  const statOf=(d,fs)=>{const total=fs.reduce((s,r)=>s+(r[d.primary]||0),0);const latest=fs[fs.length-1]||{};const peak=fs.length?Math.max(...fs.map(r=>r[d.primary]||0)):0;const avg=fs.length?Math.round(total/fs.length):0;return {total,latest,peak,avg};};

  const [base,ratio]=PAGE_SIZES[pageSize];
  const portrait=orient==='portrait';
  const pageW=portrait?base:Math.round(base*ratio);
  const pageMinH=portrait?Math.round(base*ratio):base;

  const pages = type==='compare' ? 1 : Math.max(1,chosen.length);
  const pi=Math.min(pageIdx,pages-1);
  const pageDept = chosen[pi] || depts[0];

  const sel2={padding:'9px 11px',border:'1px solid var(--line)',borderRadius:7,fontSize:13,fontFamily:'inherit',background:'#fff'};
  const fieldLabel=t=><div style={{fontSize:11.5,fontWeight:600,color:'var(--ink-2)',marginBottom:7}}>{t}</div>;

  const Header=()=>(
    <div style={{display:'flex',alignItems:'center',gap:12,borderBottom:'2px solid var(--blue)',paddingBottom:14}}>
      {showLogo&&<img src="unico/logo.svg" alt="UNICO Healthcare" style={{height:38}}/>}
      <div>
        <div style={{fontSize:14,fontWeight:700,color:'var(--ink)'}}>{hdrTitle||'Report'}</div>
        <div style={{fontSize:10.5,color:'var(--muted)',letterSpacing:.4,textTransform:'uppercase',marginTop:2}}>{hdrSub?hdrSub+' · ':''}{rangeLabel}</div>
      </div>
      <div className="spacer"/><div style={{textAlign:'right',fontSize:10,color:'var(--faint)'}}>Generated<br/><b className="num" style={{color:'var(--ink-2)'}}>05/18/2026</b></div>
    </div>
  );
  const Footer=({n,total})=>(
    <div className="pdf-foot" style={{marginTop:20,borderTop:'1px solid var(--line)',paddingTop:8,fontSize:9.5,color:'var(--faint)',display:'flex',flex:'0 0 auto'}}>
      <span>{hospitalName}</span><span className="spacer"/><span>Page {n} of {total}</span><span className="spacer"/><span>{footerNote?footerNote+' · ':''}{confidential?'Confidential · ':''}{pageSize} {orient}</span>
    </div>
  );

  function DeptPage({d, n, total}){
    const tone=PALETTE[(d.id.charCodeAt(0))%PALETTE.length];
    const fs=fseriesOf(d); const st=statOf(d,fs);
    const breakdown=d.cols.filter(c=>c.id!==d.primary&&!c.pct);
    const donutData=breakdown.map((c,i)=>({label:c.label,value:fs.reduce((s,r)=>s+(r[c.id]||0),0),color:PALETTE[i%PALETTE.length]})).filter(x=>x.value>0);
    const detailed=type==='detail';
    const ncol=(detailed?d.cols.length:5)+1;
    const tblFont=detailed?(ncol>10?8:ncol>8?8.5:ncol>6?9.5:10.5):11;
    return (
      <div>
        <Header/>
        <div style={{marginTop:18}}>
          <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:12}}>
            <Ic d={DEPT_ICON[d.id]||I.activity} s={18} c={tone}/>
            <div style={{fontWeight:700,fontSize:15}}>{d.name}</div>
            <span className="tag">{d.group}</span><span className="spacer"/><Delta v={d.delta}/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:16}}>
            {[['Latest',fmt(st.latest[d.primary]||0)],['Total',fmt(st.total)],['Peak',fmt(st.peak)],['Avg',fmt(st.avg)]].map(([l,v],i)=>(
              <div key={i} style={{background:'var(--panel-2)',borderRadius:7,padding:'9px 11px',borderLeft:'3px solid '+tone}}>
                <div style={{fontSize:9.5,color:'var(--muted)',textTransform:'uppercase',letterSpacing:.3}}>{l}</div>
                <div className="num" style={{fontSize:18,fontWeight:600}}>{v}</div>
              </div>
            ))}
          </div>
          {chartStyles.map((cs,ci)=>(
            <div key={ci} style={{margin:'4px 0 8px'}}>
              {chartStyles.length>1&&<div style={{fontSize:9.5,fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:.4,margin:'8px 0 2px'}}>{CHART_STYLE_LABEL[cs]||cs}</div>}
              {reportChartEl(d,cs,tone,fs,donutData)}
            </div>
          ))}
          {donutData.length>1&&!chartStyles.includes('donut')&&(
            <div style={{display:'flex',alignItems:'center',gap:10,background:'var(--panel-2)',borderRadius:9,padding:'10px 14px',marginTop:6}}>
              <div style={{fontSize:10.5,color:'var(--muted)',textTransform:'uppercase',letterSpacing:.3,fontWeight:600,width:78}}>Composition</div>
              <Donut data={donutData} size={104} thickness={20} flat/>
            </div>
          )}
          <table className={detailed?'tbl rpt':'tbl'} style={{marginTop:14,fontSize:tblFont}}>
            <thead><tr><th>Month</th>{d.cols.slice(0,detailed?d.cols.length:5).map(c=><th key={c.id}>{c.label}</th>)}</tr></thead>
            <tbody>{fs.map((r,i)=>(
              <tr key={i}><td>{detailed?r.month:r.full}</td>{d.cols.slice(0,detailed?d.cols.length:5).map(c=><td key={c.id}>{r[c.id]==null?'–':(c.pct?r[c.id]+'%':fmt(r[c.id]))}</td>)}</tr>
            ))}
            {detailed&&<tr className="tot"><td>TOTAL</td>{d.cols.slice(0,d.cols.length).map(c=><td key={c.id}>{c.pct?'—':fmt(fs.reduce((s,r)=>s+(r[c.id]||0),0))}</td>)}</tr>}
            </tbody>
          </table>
        </div>
        <Footer n={n} total={total}/>
      </div>
    );
  }

  function ComparePage(){
    const rows=chosen.map(d=>{const fs=fseriesOf(d);const st=statOf(d,fs);return {d,st};});
    const hbar=rows.map(({d,st})=>({label:d.short,value:st.total,color:PALETTE[(d.id.charCodeAt(0))%PALETTE.length]})).sort((a,b)=>b.value-a.value);
    return (
      <div>
        <Header/>
        <div style={{marginTop:18}}>
          <div style={{fontWeight:700,fontSize:15,marginBottom:12}}>Cross-department comparison · {chosen.length} departments</div>
          <div style={{marginBottom:16}}><HBar rows={hbar}/></div>
          <table className="tbl" style={{fontSize:11.5}}>
            <thead><tr><th>Department</th><th>Service line</th><th>Latest</th><th>Total</th><th>Peak</th><th>Avg</th><th>Trend</th></tr></thead>
            <tbody>{rows.map(({d,st})=>(
              <tr key={d.id}><td>{d.name}</td><td style={{fontFamily:"'IBM Plex Sans'"}}>{d.group}</td>
                <td>{fmt(st.latest[d.primary]||0)}</td><td>{fmt(st.total)}</td><td>{fmt(st.peak)}</td><td>{fmt(st.avg)}</td>
                <td style={{textAlign:'right'}}><Delta v={d.delta}/></td></tr>
            ))}</tbody>
          </table>
        </div>
        <Footer n={1} total={1}/>
      </div>
    );
  }

  const [exporting,setExporting]=React.useState(false);
  const [note,setNote]=React.useState(null); // {ok:boolean, text:string}
  const doPrint=()=>{ try{ document.body.classList.add('pdf-export-mode'); window.print(); }catch(e){} finally{ setTimeout(()=>document.body.classList.remove('pdf-export-mode'),500); } };
  const doExport=async()=>{
    const native=window.unicoNative;
    if(!native||typeof native.exportPDF!=='function'){ setNote({ok:false,text:'PDF export is only available in the desktop app.'}); return; }
    if(chosen.length===0){ setNote({ok:false,text:'Select at least one department first.'}); return; }
    setExporting(true); setNote(null);
    document.body.classList.add('pdf-export-mode'); // print only the report (#pdf-root)
    try{
      const res=await native.exportPDF({pageSize, landscape:orient==='landscape', defaultName:`UNICO-${type}-report`});
      if(res&&res.ok) setNote({ok:true,text:'PDF'+(res.path?' saved · '+res.path:' ready — save it from the print dialog')});
      else if(res&&res.canceled){ /* user dismissed the save dialog — stay quiet */ }
      else setNote({ok:false,text:(res&&res.error)||'Export failed.'});
    }catch(e){ setNote({ok:false,text:String(e&&e.message?e.message:e)}); }
    finally{ document.body.classList.remove('pdf-export-mode'); setExporting(false); }
  };
  const pdfRoot = typeof document!=='undefined' ? document.getElementById('pdf-root') : null;

  return (
    <div className="grid" style={{gap:16}}>
      <SectionTitle icon={I.doc} title="Report Builder" sub="Compose and export board-ready statistical reports"
        right={<>
          <button className="btn sm" onClick={doPrint}><Ic d={I.print} s={15}/>Print</button>
          <button className="btn pri sm" onClick={doExport} disabled={exporting||chosen.length===0}><Ic d={I.download} s={15}/>{exporting?'Exporting…':'Export PDF'}</button>
        </>}/>
      {note&&(
        <div style={{display:'flex',alignItems:'center',gap:9,padding:'10px 14px',borderRadius:8,fontSize:12.5,fontWeight:600,
          color:note.ok?'var(--pos)':'var(--rose)',background:note.ok?'var(--pos-bg)':'var(--neg-bg)',border:'1px solid '+(note.ok?'#bfe6cd':'#f1c6cd')}}>
          <Ic d={note.ok?I.check:I.x} s={15}/><span style={{wordBreak:'break-all'}}>{note.text}</span>
          <span className="spacer" style={{flex:1}}/>
          <button className="icon-btn" style={{width:24,height:24,border:0,background:'transparent'}} onClick={()=>setNote(null)}><Ic d={I.x} s={13}/></button>
        </div>
      )}
      {pdfRoot && ReactDOM.createPortal(
        <div className={"pdf-doc"+(orient==='portrait'?' portrait':'')}>
          {chosen.length>0 && (type==='compare'
            ? <section className="pdf-page"><ComparePage/></section>
            : chosen.map((d,i)=><section className="pdf-page" key={d.id}><DeptPage d={d} n={i+1} total={pages}/></section>))}
        </div>,
        pdfRoot
      )}
      <div className="grid" style={{gridTemplateColumns:'320px 1fr',alignItems:'start'}}>
        {/* config */}
        <div className="card">
          <div className="card-h"><h3>Configuration</h3></div>
          <div className="card-b" style={{display:'flex',flexDirection:'column',gap:16}}>
            <div>
              {fieldLabel('Report type')}
              <div className="seg" style={{width:'100%'}}>
                {[['summary','Summary'],['detail','Detailed'],['compare','Comparison']].map(([id,l])=>(
                  <button key={id} className={type===id?'on':''} style={{flex:1}} onClick={()=>{setType(id);setPageIdx(0);}}>{l}</button>
                ))}
              </div>
              <div style={{fontSize:11,color:'var(--muted)',marginTop:6}}>
                {type==='summary'?'KPIs + chart, one page per department.':type==='detail'?'Full data table & composition per department.':'All selected departments on one comparison page.'}
              </div>
            </div>
            <div>
              {fieldLabel('Reporting period')}
              <select value={period.mode} onChange={e=>setPeriod({mode:e.target.value,from:allMonths[0],to:allMonths[allMonths.length-1]})} style={{...sel2,width:'100%'}}>
                <option value="all">Full period ({allMonths[0]} – {allMonths[allMonths.length-1]})</option>
                <option value="q1">Q1 2026 (Jan–Mar)</option>
                <option value="apr">April 2026 only</option>
                <option value="last6">Last 6 months</option>
                <option value="custom">Custom range…</option>
              </select>
              {period.mode==='custom'&&(
                <div style={{display:'flex',gap:8,marginTop:8,alignItems:'center'}}>
                  <select value={period.from} onChange={e=>setPeriod(p=>({...p,from:e.target.value}))} style={{...sel2,flex:1}}>{allMonths.map(m=><option key={m} value={m}>{m}</option>)}</select>
                  <span style={{fontSize:12,color:'var(--muted)'}}>to</span>
                  <select value={period.to} onChange={e=>setPeriod(p=>({...p,to:e.target.value}))} style={{...sel2,flex:1}}>{allMonths.map(m=><option key={m} value={m}>{m}</option>)}</select>
                </div>
              )}
            </div>
            <div>
              {fieldLabel('Chart styles — pick one or more (each renders per department)')}
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {REPORT_STYLES.map(([id,l])=>{
                  const on=chartStyles.includes(id);
                  return <button key={id} onClick={()=>toggleStyle(id)}
                    style={{display:'flex',alignItems:'center',gap:4,padding:'5px 10px',borderRadius:20,fontSize:11.5,fontWeight:600,cursor:'pointer',
                      border:'1px solid '+(on?'var(--blue)':'var(--line)'),background:on?'var(--blue-50)':'#fff',color:on?'var(--blue-700)':'var(--muted)'}}>
                    {on&&<Ic d={I.check} s={11} sw={3}/>}{l}</button>;
                })}
              </div>
            </div>
            <div>
              {fieldLabel('Header & footer editor')}
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                <input value={hdrTitle} onChange={e=>setHdrTitle(e.target.value)} placeholder="Report title (header)" style={{...sel2,width:'100%'}}/>
                <input value={hdrSub} onChange={e=>setHdrSub(e.target.value)} placeholder="Subtitle (optional)" style={{...sel2,width:'100%'}}/>
                <input value={hospitalName} onChange={e=>setHospitalName(e.target.value)} placeholder="Footer — hospital / org name" style={{...sel2,width:'100%'}}/>
                <input value={footerNote} onChange={e=>setFooterNote(e.target.value)} placeholder="Footer note (optional)" style={{...sel2,width:'100%'}}/>
                <div style={{display:'flex',gap:16}}>
                  <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'var(--ink-2)'}}><input type="checkbox" checked={showLogo} onChange={e=>setShowLogo(e.target.checked)}/>Show logo</label>
                  <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'var(--ink-2)'}}><input type="checkbox" checked={confidential} onChange={e=>setConfidential(e.target.checked)}/>Confidential mark</label>
                </div>
              </div>
            </div>
            <div>
              {fieldLabel('Page setup')}
              <div style={{display:'flex',gap:8}}>
                <select value={pageSize} onChange={e=>setPageSize(e.target.value)} style={{...sel2,flex:1}}><option>A4</option><option>A3</option><option>Letter</option></select>
                <div className="seg">
                  {[['portrait','Portrait'],['landscape','Landscape']].map(([id,l])=>(
                    <button key={id} className={orient===id?'on':''} onClick={()=>setOrient(id)}>{l}</button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <div style={{fontSize:11.5,fontWeight:600,color:'var(--ink-2)',marginBottom:7,display:'flex'}}>Departments<span className="spacer"/>
                <button onClick={()=>setSel(sel.length===depts.length?[]:depts.map(d=>d.id))} style={{border:0,background:'none',color:'var(--blue)',fontSize:11,fontWeight:600,cursor:'pointer'}}>
                  {sel.length===depts.length?'Clear all':'Select all'}</button>
              </div>
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {depts.map(d=>(
                  <button key={d.id} onClick={()=>toggle(d.id)}
                    style={{display:'flex',alignItems:'center',gap:5,padding:'5px 10px',borderRadius:20,fontSize:11.5,fontWeight:600,cursor:'pointer',
                      border:'1px solid '+(sel.includes(d.id)?'var(--blue)':'var(--line)'),
                      background:sel.includes(d.id)?'var(--blue-50)':'#fff',color:sel.includes(d.id)?'var(--blue-700)':'var(--muted)'}}>
                    {sel.includes(d.id)&&<Ic d={I.check} s={12} sw={3}/>}{d.short}
                  </button>
                ))}
              </div>
            </div>
            <div style={{background:'var(--panel-2)',border:'1px solid var(--line)',borderRadius:8,padding:'11px 13px',fontSize:12,color:'var(--muted)'}}>
              <b style={{color:'var(--ink)'}}>{chosen.length}</b> departments · <b style={{color:'var(--ink)'}}>{type}</b> · {pageSize} {orient} · {pMonths.length} month{pMonths.length!==1?'s':''}
            </div>
          </div>
        </div>

        {/* live preview */}
        <div className="card" style={{padding:0,overflow:'hidden'}}>
          <div className="card-h" style={{background:'var(--panel-2)'}}><h3>Live Preview</h3><span className="sub">{pageSize} · {orient}</span><span className="spacer"/>
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <button className="icon-btn" style={{width:28,height:28}} disabled={pi<=0} onClick={()=>setPageIdx(p=>Math.max(0,p-1))}><Ic d={I.chevR} s={15} style={{transform:'rotate(180deg)'}}/></button>
              <span className="tag num">Page {pi+1} of {pages}</span>
              <button className="icon-btn" style={{width:28,height:28}} disabled={pi>=pages-1} onClick={()=>setPageIdx(p=>Math.min(pages-1,p+1))}><Ic d={I.chevR} s={15}/></button>
            </div>
          </div>
          <div style={{padding:26,background:'#eef1f5',overflowX:'auto'}}>
            <div style={{background:'#fff',borderRadius:4,boxShadow:'0 4px 18px rgba(0,0,0,.12)',padding:'28px 30px',width:pageW,minHeight:pageMinH,margin:'0 auto',transition:'width .25s'}}>
              {chosen.length===0?<div style={{textAlign:'center',color:'var(--faint)',padding:'60px 0'}}>Select at least one department.</div>
                : type==='compare'?<ComparePage/>:<DeptPage d={pageDept} n={pi+1} total={pages}/>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const UCOLORS=['#0090ca','#3ab5a7','#6a52d4','#e08a1e','#d23a52','#1f9d57'];
const USER_MODS=[['stats','Hospital Statistics'],['entry','Data Entry'],['reports','Reports'],['nurse','Nurse Management'],['pca','PCA Management'],['depts','Manage Departments'],['settings','Settings']];
const USER_ROLES=['Administrator','Manager','Department Head','Data Entry','Read-only'];
const ROLE_PERMS={
  'Administrator':{stats:'edit',entry:'edit',reports:'edit',nurse:'edit',pca:'edit',depts:'edit',settings:'edit'},
  'Manager':{stats:'edit',entry:'edit',reports:'edit',nurse:'edit',pca:'edit',depts:'edit',settings:'view'},
  'Department Head':{stats:'view',entry:'edit',reports:'view',nurse:'edit',pca:'edit',depts:'none',settings:'none'},
  'Data Entry':{stats:'view',entry:'edit',reports:'view',nurse:'none',pca:'none',depts:'none',settings:'none'},
  'Read-only':{stats:'view',entry:'none',reports:'view',nurse:'view',pca:'view',depts:'none',settings:'none'},
};
const inits=n=>(n||'?').split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase();
const permSummary=p=>{const vals=USER_MODS.map(m=>p[m[0]]||'none');const ed=vals.filter(v=>v==='edit').length;
  if(ed===USER_MODS.length)return 'Full access'; if(vals.every(v=>v==='view'||v==='none')&&vals.some(v=>v==='view'))return 'Read-only';
  return `${ed} edit · ${vals.filter(v=>v==='view').length} view`;};

function useUserStore(){
  const KEY='unico_users_v1';
  const seed=()=>[{id:1,name:'Nasif Ahammed Niloy',email:'nasif.niloy@unicohospitals.com',role:'Administrator',status:'active',color:'#0090ca',lastActive:Date.now(),perms:{...ROLE_PERMS['Administrator']}}];
  const [users,setUsers]=React.useState(()=>{try{const s=JSON.parse(localStorage.getItem(KEY));return Array.isArray(s)&&s.length?s:seed();}catch(e){return seed();}});
  React.useEffect(()=>{localStorage.setItem(KEY,JSON.stringify(users));},[users]);
  return {users,
    add:(u)=>setUsers(s=>[...s,{id:Math.max(0,...s.map(x=>x.id))+1,status:'active',color:UCOLORS[s.length%UCOLORS.length],lastActive:null,...u}]),
    update:(id,p)=>setUsers(s=>s.map(x=>x.id===id?{...x,...p}:x)),
    remove:(id)=>setUsers(s=>s.filter(x=>x.id!==id)),
    toggle:(id)=>setUsers(s=>s.map(x=>x.id===id?{...x,status:x.status==='active'?'inactive':'active'}:x))};
}

function UserModal({initial,onClose,onSave}){
  const editing=!!initial;
  const [name,setName]=React.useState(initial?.name||'');
  const [email,setEmail]=React.useState(initial?.email||'');
  const [role,setRole]=React.useState(initial?.role||'Data Entry');
  const [status,setStatus]=React.useState(initial?.status||'active');
  const [perms,setPerms]=React.useState(()=>initial?{...initial.perms}:{...ROLE_PERMS['Data Entry']});
  const [err,setErr]=React.useState('');
  const pickRole=r=>{setRole(r);setPerms({...ROLE_PERMS[r]});};
  const save=()=>{
    if(!name.trim()){setErr('Name is required');return;}
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())){setErr('Enter a valid email');return;}
    onSave({name:name.trim(),email:email.trim().toLowerCase(),role,status,perms},editing);
  };
  return (
    <div className="modal-bg" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="modal">
        <div className="modal-h">
          <div style={{width:30,height:30,borderRadius:8,background:'var(--blue-50)',color:'var(--blue)',display:'grid',placeItems:'center'}}><Ic d={editing?I.edit:I.plus} s={17}/></div>
          <h3>{editing?'Manage User':'Invite User'}</h3><span className="spacer"/>
          <button className="icon-btn" onClick={onClose}><Ic d={I.x} s={16}/></button>
        </div>
        <div style={{padding:20,display:'flex',flexDirection:'column',gap:16}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div className="field"><label>Full name</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Nasif Ahammed Niloy" autoFocus/></div>
            <div className="field"><label>Email</label><input value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@unicohospitals.com"/></div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div className="field"><label>Role</label><select value={role} onChange={e=>pickRole(e.target.value)}>{USER_ROLES.map(r=><option key={r}>{r}</option>)}</select></div>
            <div className="field"><label>Status</label><select value={status} onChange={e=>setStatus(e.target.value)}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
          </div>
          <div>
            <div style={{fontSize:12.5,fontWeight:700,color:'var(--ink)',marginBottom:8}}>Module permissions <span style={{fontWeight:500,color:'var(--muted)',fontSize:11}}>· picking a role sets defaults; fine-tune below</span></div>
            <div style={{display:'flex',flexDirection:'column',gap:7}}>
              {USER_MODS.map(([id,label])=>(
                <div key={id} style={{display:'flex',alignItems:'center',gap:10}}>
                  <span style={{flex:1,fontSize:12.5,color:'var(--ink-2)'}}>{label}</span>
                  <div className="seg">
                    {[['none','None'],['view','View'],['edit','Edit']].map(([v,l])=>(
                      <button key={v} className={(perms[id]||'none')===v?'on':''} onClick={()=>setPerms(p=>({...p,[id]:v}))}>{l}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          {err&&<div style={{fontSize:12,color:'var(--rose)',fontWeight:600}}>{err}</div>}
          <div style={{display:'flex',gap:10,borderTop:'1px solid var(--line-2)',paddingTop:14}}>
            <span className="spacer" style={{flex:1}}/>
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn pri" onClick={save}><Ic d={I.check} s={16} sw={2.4}/>{editing?'Save changes':'Send invite'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function UserManagement(){
  const us=useUserStore();
  const [q,setQ]=React.useState('');
  const [modal,setModal]=React.useState(null);
  const [confirm,setConfirm]=React.useState(null);
  const admins=us.users.filter(u=>u.role==='Administrator'&&u.status==='active').length;
  const filtered=us.users.filter(u=>!q||`${u.name} ${u.email} ${u.role}`.toLowerCase().includes(q.toLowerCase()));
  const onSave=(data,editing)=>{ if(editing) us.update(modal.user.id,data); else us.add(data); setModal(null); };
  const ago=ts=>{ if(!ts)return 'never'; const m=Math.floor((Date.now()-ts)/60000); if(m<1)return 'just now'; if(m<60)return m+'m ago'; const h=Math.floor(m/60); if(h<24)return h+'h ago'; return Math.floor(h/24)+'d ago'; };
  return (
    <div>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
        <div><div style={{fontSize:14,fontWeight:700}}>Users &amp; Roles</div><div style={{fontSize:11.5,color:'var(--muted)'}}>{us.users.length} user{us.users.length!==1?'s':''} · {admins} administrator{admins!==1?'s':''}</div></div>
        <span className="spacer" style={{flex:1}}/>
        <div style={{display:'flex',alignItems:'center',gap:7,background:'var(--panel-2)',border:'1px solid var(--line)',borderRadius:7,padding:'6px 10px',width:190,color:'var(--faint)'}}><Ic d={I.search} s={14}/><input placeholder="Search users…" value={q} onChange={e=>setQ(e.target.value)} style={{border:0,background:'transparent',outline:'none',fontFamily:'inherit',fontSize:12.5,color:'var(--ink)',width:'100%'}}/></div>
        <button className="btn pri sm" onClick={()=>setModal({user:null})}><Ic d={I.plus} s={14}/>Invite user</button>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {filtered.map(u=>(
          <div key={u.id} style={{display:'flex',alignItems:'center',gap:12,padding:'11px 13px',border:'1px solid var(--line)',borderRadius:10,opacity:u.status==='active'?1:.6,flexWrap:'wrap'}}>
            <div className="avatar" style={{background:u.color,width:38,height:38}}>{inits(u.name)}</div>
            <div style={{minWidth:0,flex:'1 1 180px'}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}><span style={{fontSize:13.5,fontWeight:700}}>{u.name}</span>{u.id===1&&<span className="tag" style={{background:'var(--pos-bg)',color:'var(--pos)'}}>You</span>}</div>
              <div style={{fontSize:11.5,color:'var(--muted)'}}>{u.email} · {u.role}</div>
            </div>
            <div style={{textAlign:'right',fontSize:11,color:'var(--faint)'}}>last active<br/><b style={{color:'var(--ink-2)'}}>{ago(u.lastActive)}</b></div>
            <span className="tag" style={{minWidth:74,justifyContent:'center'}}>{permSummary(u.perms)}</span>
            {u.status==='active'?<span className="chip pos">● Active</span>:<span className="chip flat">○ Inactive</span>}
            <button className="btn sm" onClick={()=>setModal({user:u})}>Manage</button>
            <button className="icon-btn" title={u.status==='active'?'Deactivate':'Activate'} onClick={()=>us.toggle(u.id)} disabled={u.id===1}><Ic d={u.status==='active'?I.x:I.check} s={14}/></button>
            <button className="icon-btn danger" title="Remove" onClick={()=>setConfirm(u)} disabled={u.id===1||(u.role==='Administrator'&&admins<=1)}><Ic d={I.x} s={14}/></button>
          </div>
        ))}
        {filtered.length===0&&<div style={{textAlign:'center',color:'var(--faint)',padding:'24px',fontSize:13}}>No users match.</div>}
      </div>
      {modal&&<UserModal initial={modal.user} onClose={()=>setModal(null)} onSave={onSave}/>}
      {confirm&&(
        <div className="modal-bg" onMouseDown={e=>{if(e.target===e.currentTarget)setConfirm(null);}}>
          <div className="modal" style={{width:'min(400px,92vw)'}}><div style={{padding:'22px'}}>
            <div style={{fontSize:15.5,fontWeight:700}}>Remove {confirm.name}?</div>
            <div style={{fontSize:13,color:'var(--muted)',marginTop:4}}>This revokes their access to the platform.</div>
            <div style={{display:'flex',gap:10,marginTop:18}}><span className="spacer" style={{flex:1}}/><button className="btn" onClick={()=>setConfirm(null)}>Cancel</button><button className="btn pri" style={{background:'var(--rose)',borderColor:'var(--rose)'}} onClick={()=>{us.remove(confirm.id);setConfirm(null);}}>Remove</button></div>
          </div></div>
        </div>
      )}
    </div>
  );
}

function Settings({depts, store}){
  const [tab,setTab]=React.useState('general');
  const [dbFile,setDbFile]=React.useState('');
  const native=window.unicoNative;
  React.useEffect(()=>{ if(native&&native.dbPath){ native.dbPath().then(setDbFile).catch(()=>{}); } },[]);

  const doBackup=async()=>{
    if(!native){ window.UI&&window.UI.toast('Backups need the desktop app','warn'); return; }
    try{
      if(window.unicoFlushNow) await window.unicoFlushNow();
      const data=window.unicoSnapshotAll?window.unicoSnapshotAll():undefined;
      const res=await native.backup(data);
      if(res&&res.ok) window.UI.toast('Backup saved to '+(res.path||'file')+' ✓','success');
      else if(!(res&&res.canceled)) window.UI.toast('Backup failed: '+((res&&res.error)||'unknown'),'error');
    }catch(e){ window.UI.toast('Backup failed','error'); }
  };
  const doRestore=async()=>{
    if(!native){ window.UI&&window.UI.toast('Restore needs the desktop app','warn'); return; }
    const ok=await window.UI.confirm({title:'Restore from backup?',message:'This replaces ALL current data — entries, staff, quality, users and settings — with the chosen backup file, then reloads the app.',danger:true,confirmLabel:'Choose file & restore'});
    if(!ok) return;
    try{
      const res=await native.restore();
      if(res&&res.canceled) return;
      if(res&&res.ok&&res.data){
        try{ localStorage.clear(); }catch(e){}
        Object.keys(res.data).forEach(k=>{ try{ localStorage.setItem(k,res.data[k]); }catch(e){} });
        window.UI.toast('Data restored ✓ — reloading…','success');
        setTimeout(()=>location.reload(),800);
      } else window.UI.toast('Restore failed: '+((res&&res.error)||'invalid file'),'error');
    }catch(e){ window.UI.toast('Restore failed','error'); }
  };
  const doClear=async()=>{
    if(!store) return;
    const ok=await window.UI.confirm({title:'Clear entered data?',message:'Removes all manually entered monthly entries. Seeded data is kept.',danger:true,confirmLabel:'Clear entries'});
    if(ok){ store.clearEntries(); window.UI.toast('Entries cleared','success'); }
  };
  const doReset=async()=>{
    if(!store) return;
    const ok=await window.UI.confirm({title:'Reset all customizations?',message:'Removes added / renamed / deleted departments and all entered data. This cannot be undone.',danger:true,confirmLabel:'Reset everything'});
    if(ok){ store.reset(); window.UI.toast('All customizations reset','success'); }
  };

  // App lock (PIN) — backed by window.unicoLock (login.jsx)
  const lock=window.unicoLock;
  const [lockOn,setLockOn]=React.useState(()=>!!(lock&&lock.isEnabled()));
  const [pinMode,setPinMode]=React.useState(false);
  const [pin1,setPin1]=React.useState(''); const [pin2,setPin2]=React.useState('');
  const savePin=()=>{
    if(pin1.length<4){ window.UI.toast('PIN must be at least 4 digits','error'); return; }
    if(pin1!==pin2){ window.UI.toast('PINs do not match','error'); return; }
    lock.setPin(pin1); setLockOn(true); setPinMode(false); setPin1(''); setPin2('');
    window.UI.toast('App lock enabled ✓','success');
  };
  const disableLock=async()=>{
    const ok=await window.UI.confirm({title:'Disable app lock?',message:'The app will no longer require a PIN to open.',danger:true,confirmLabel:'Disable'});
    if(ok){ lock.disable(); setLockOn(false); window.UI.toast('App lock disabled','success'); }
  };

  const row=(label,control)=>(
    <div style={{display:'flex',alignItems:'center',gap:14,padding:'13px 0',borderBottom:'1px solid var(--line-2)'}}>
      <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:'var(--ink)'}}>{label.t}</div><div style={{fontSize:11.5,color:'var(--muted)'}}>{label.s}</div></div>
      {control}
    </div>
  );
  const Toggle=({on=true})=>{const[v,setV]=React.useState(on);return(
    <button onClick={()=>setV(!v)} style={{width:42,height:24,borderRadius:20,border:0,background:v?'var(--blue)':'#cdd6e2',position:'relative',transition:'.2s',cursor:'pointer'}}>
      <span style={{position:'absolute',top:3,left:v?21:3,width:18,height:18,borderRadius:'50%',background:'#fff',transition:'.2s',boxShadow:'0 1px 3px rgba(0,0,0,.3)'}}/></button>);};

  return (
    <div className="grid" style={{gap:16}}>
      <SectionTitle icon={I.gear} title="Settings" sub="Configure the statistics platform"/>
      <div className="grid" style={{gridTemplateColumns:'200px 1fr',alignItems:'start'}}>
        <div className="card" style={{padding:6}}>
          {[['general','General',I.gear],['departments','Departments',I.layers],['users','Users & Roles',I.user],['data','Data & Export',I.doc]].map(([id,l,ic])=>(
            <div key={id} onClick={()=>setTab(id)} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',borderRadius:7,cursor:'pointer',fontSize:13,fontWeight:600,
              background:tab===id?'var(--blue-50)':'transparent',color:tab===id?'var(--blue-700)':'var(--ink-2)'}}>
              <Ic d={ic} s={16}/>{l}
            </div>
          ))}
        </div>
        <div className="card"><div className="card-b">
          {tab==='general'&&<div>
            {row({t:'Hospital name',s:'Shown across the platform and on exports'},<input defaultValue="UNICO Hospitals PLC" style={{padding:'8px 11px',border:'1px solid var(--line)',borderRadius:7,fontFamily:'inherit',fontSize:13,width:230}}/>)}
            {row({t:'Default reporting period',s:'Initial range when opening dashboards'},<select style={{padding:'8px 11px',border:'1px solid var(--line)',borderRadius:7,fontFamily:'inherit',fontSize:13}}><option>Last 9 months</option><option>Year to date</option><option>All time</option></select>)}
            {row({t:'Week starts on',s:'Calendar & trend grouping'},<select style={{padding:'8px 11px',border:'1px solid var(--line)',borderRadius:7,fontFamily:'inherit',fontSize:13}}><option>Sunday</option><option>Monday</option></select>)}
            {row({t:'Auto-validate totals',s:'Block entries where components don’t sum to total'},<Toggle on={true}/>)}
            {row({t:'Confidential watermark',s:'Stamp exported reports'},<Toggle on={true}/>)}
            {lock&&<div style={{padding:'13px 0'}}>
              <div style={{display:'flex',alignItems:'center',gap:14}}>
                <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:'var(--ink)'}}>App lock (PIN)</div><div style={{fontSize:11.5,color:'var(--muted)'}}>Require a PIN each time the app opens{lockOn?' · currently ON':''}</div></div>
                {lockOn
                  ? <div style={{display:'flex',gap:8}}><button className="btn sm" onClick={()=>{setPinMode(true);setPin1('');setPin2('');}}>Change PIN</button><button className="btn sm" style={{color:'var(--rose)',borderColor:'#f1c6cd'}} onClick={disableLock}>Disable</button></div>
                  : (!pinMode&&<button className="btn sm pri" onClick={()=>{setPinMode(true);setPin1('');setPin2('');}}>Enable lock</button>)}
              </div>
              {pinMode&&<div style={{display:'flex',gap:8,marginTop:10,alignItems:'center',flexWrap:'wrap'}}>
                <input type="password" inputMode="numeric" placeholder="New PIN (4+)" value={pin1} onChange={e=>setPin1(e.target.value.replace(/\D/g,''))} style={{padding:'7px 10px',border:'1px solid var(--line)',borderRadius:7,fontFamily:'inherit',fontSize:13,width:130}}/>
                <input type="password" inputMode="numeric" placeholder="Confirm PIN" value={pin2} onChange={e=>setPin2(e.target.value.replace(/\D/g,''))} onKeyDown={e=>{if(e.key==='Enter')savePin();}} style={{padding:'7px 10px',border:'1px solid var(--line)',borderRadius:7,fontFamily:'inherit',fontSize:13,width:130}}/>
                <button className="btn sm pri" onClick={savePin}>Save PIN</button>
                <button className="btn sm" onClick={()=>{setPinMode(false);setPin1('');setPin2('');}}>Cancel</button>
              </div>}
            </div>}
          </div>}
          {tab==='departments'&&<div>
            <div style={{display:'flex',marginBottom:10}}><div style={{fontSize:12.5,color:'var(--muted)'}}>{depts.length} departments configured</div><span className="spacer"/><button className="btn sm pri"><Ic d={I.plus} s={14}/>Add department</button></div>
            <table className="tbl"><thead><tr><th>Department</th><th>Code</th><th>Service line</th><th>Metrics</th><th>Status</th></tr></thead>
              <tbody>{depts.map(d=>(<tr key={d.id}><td>{d.name}</td><td>{d.short}</td><td style={{fontFamily:'IBM Plex Sans'}}>{d.group}</td><td>{d.cols.length}</td>
                <td><span className="chip pos">● Active</span></td></tr>))}</tbody></table>
          </div>}
          {tab==='users'&&<UserManagement/>}
          {tab==='data'&&<div>
            <div style={{fontSize:13,fontWeight:700,color:'var(--ink)',marginBottom:2}}>Backup &amp; restore</div>
            <div style={{fontSize:11.5,color:'var(--muted)',marginBottom:10}}>All data is stored in a local database on this PC. Back it up to a file you can keep safe or move to another PC.</div>
            <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
              <button className="btn pri" onClick={doBackup}><Ic d={I.download} s={15}/>Back up all data…</button>
              <button className="btn" onClick={doRestore}><Ic d={I.upload||I.layers} s={15}/>Restore from backup…</button>
            </div>
            {dbFile&&<div className="col-chip" style={{marginTop:12,maxWidth:'100%',wordBreak:'break-all'}} title={dbFile}><Ic d={I.doc} s={13}/>Database: {dbFile}</div>}
            <div style={{height:1,background:'var(--line-2)',margin:'16px 0'}}/>
            {row({t:'Export format',s:'Default download type for reports'},<select style={{padding:'8px 11px',border:'1px solid var(--line)',borderRadius:7,fontFamily:'inherit',fontSize:13}}><option>PDF</option><option>Excel (.xlsx)</option><option>CSV</option></select>)}
            {row({t:'Round percentages',s:'Display IPD conversion to 2 decimals'},<Toggle on={true}/>)}
            <div style={{marginTop:14,display:'flex',gap:10,flexWrap:'wrap'}}>
              <button className="btn" style={{color:'var(--rose)',borderColor:'#f1c6cd'}} onClick={doClear}>Clear session entries</button>
              <button className="btn" style={{color:'var(--rose)',borderColor:'#f1c6cd'}} onClick={doReset}>Reset all customizations</button>
            </div>
          </div>}
        </div></div>
      </div>
    </div>
  );
}
window.Reports=Reports; window.Settings=Settings;
