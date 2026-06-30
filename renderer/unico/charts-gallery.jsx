/* UNICO — per-department Charts Gallery (PNG + PDF export)
   global-script React: no imports/exports. Depends on globals from charts.jsx
   (BarChart, LineChart, GroupedBar, StackedBar, Donut, PALETTE, fmt),
   charts3d.jsx (Bar3D), charts-extra.jsx (ComboChart, HBarChart, StackedPctBar,
   AreaTargetChart), ui.jsx (SectionTitle, Ic, I, DEPT_ICON), reports.jsx mechanism
   (#pdf-root portal + window.unicoNative.exportPDF). */

/* ----------------------------------------------------------------------------
   chartToPNG — serialize a chart's inline SVG, rasterize onto a 2x white canvas,
   download as PNG. Charts are pure inline SVG (no <img>/<foreignObject>), so they
   serialize cleanly. We inline width/height so the off-DOM Image has real pixels.
---------------------------------------------------------------------------- */
function chartToPNG(svgEl, filename){
  const toast=(m,t)=>{ try{ window.UI&&window.UI.toast&&window.UI.toast(m,t); }catch(e){} };
  if(!svgEl){ toast('Nothing to export','error'); return; }
  try{
    // Clone so we can stamp explicit dimensions without disturbing the live chart.
    const clone=svgEl.cloneNode(true);
    const rect=svgEl.getBoundingClientRect();
    const vb=(svgEl.getAttribute('viewBox')||'').split(/[ ,]+/).map(Number);
    let w=Math.round(rect.width||(vb.length===4?vb[2]:300));
    let h=Math.round(rect.height||(vb.length===4?vb[3]:200));
    if(!w||!isFinite(w)) w=600; if(!h||!isFinite(h)) h=360;
    clone.setAttribute('width',w);
    clone.setAttribute('height',h);
    if(vb.length!==4) clone.setAttribute('viewBox',`0 0 ${w} ${h}`);
    clone.setAttribute('xmlns','http://www.w3.org/2000/svg');
    const svgStr=new XMLSerializer().serializeToString(clone);
    const url='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svgStr);
    const dpr=Math.max(2, Math.round(window.devicePixelRatio||1)+1); // >= 2x device scale
    const img=new Image();
    img.onload=()=>{
      try{
        const canvas=document.createElement('canvas');
        canvas.width=Math.max(1,Math.round(w*dpr));
        canvas.height=Math.max(1,Math.round(h*dpr));
        const ctx=canvas.getContext('2d');
        ctx.setTransform(dpr,0,0,dpr,0,0);
        ctx.fillStyle='#ffffff';
        ctx.fillRect(0,0,w,h);
        ctx.drawImage(img,0,0,w,h);
        const png=canvas.toDataURL('image/png');
        const a=document.createElement('a');
        a.href=png; a.download=(filename||'chart')+'.png';
        document.body.appendChild(a); a.click(); a.remove();
        toast('Chart saved · '+a.download,'success');
      }catch(e){ toast('PNG export failed','error'); }
    };
    img.onerror=()=>{ toast('PNG export failed (could not render chart)','error'); };
    img.src=url;
  }catch(e){ toast('PNG export failed','error'); }
}

function ChartsGallery({dept, setRoute}){
  const d=dept;
  const tone=PALETTE[(d.id.charCodeAt(0))%PALETTE.length];
  const series=(d&&d.series)||[];

  // ---- metric selection (mirrors department.jsx patterns) ----
  const breakdownCols=d.cols.filter(c=>c.id!==d.primary && !c.pct);
  const pctCols=d.cols.filter(c=>c.pct);
  const numericCols=d.cols.filter(c=>!c.pct);                 // value columns
  const secondMetric=numericCols.find(c=>c.id!==d.primary);   // for combo when no pct
  const lineCol=pctCols[0]||secondMetric||null;               // line key for combo
  const mixSeries=breakdownCols.slice(0,6).map((c,i)=>({id:c.id,label:c.label,color:PALETTE[i%PALETTE.length]}));
  const hasBreakdown=mixSeries.length>1;

  // composition totals across the full series
  const donutData=breakdownCols
    .map((c,i)=>({label:c.label,value:series.reduce((s,r)=>s+(r[c.id]||0),0),color:PALETTE[i%PALETTE.length]}))
    .filter(x=>x.value>0);
  const hasDonut=donutData.length>1;

  // area target = primary average across the range (a sensible benchmark)
  const primTotal=series.reduce((s,r)=>s+(r[d.primary]||0),0);
  const primAvg=series.length?Math.round(primTotal/series.length):0;

  // horizontal-bar rows: months vs primary
  const hbarData=series.map(r=>({label:r.month,value:r[d.primary]||0}));

  // ---- build the catalog of applicable charts ----
  // each: {id,title,sub, render(flat)=>element}
  const charts=[];
  charts.push({id:'trend',title:'Monthly Trend',sub:'bar',
    render:flat=><BarChart data={series} x="month" y={d.primary} height={260} color={tone} flat={flat}/>});
  if(typeof window.Bar3D==='function') charts.push({id:'iso',title:'3D Trend',sub:'isometric bars',
    render:flat=><Bar3D data={series} x="month" y={d.primary} height={280} color={tone} flat={flat}/>});
  charts.push({id:'line',title:'Line',sub:'trend line',
    render:flat=><LineChart data={series} x="full" y={d.primary} height={260} color={tone} flat={flat}/>});
  if(typeof window.AreaTargetChart==='function') charts.push({id:'area',title:'Area vs Target',sub:`target = avg ${fmt(primAvg)}`,
    render:flat=><AreaTargetChart data={series} x="full" y={d.primary} target={primAvg} height={260} color={tone} flat={flat}/>});
  if(typeof window.ComboChart==='function' && lineCol) charts.push({id:'combo',title:'Bar + Line Combo',sub:`${d.primaryLabel} vs ${lineCol.label}`,
    render:flat=><ComboChart data={series} x="month" barKey={d.primary} lineKey={lineCol.id}
      barColor={tone} lineColor={PALETTE[3]} barLabel={d.primaryLabel} lineLabel={lineCol.label} height={260} flat={flat}/>});
  if(hasBreakdown) charts.push({id:'grouped',title:'Grouped',sub:'breakdown clusters',
    render:flat=><GroupedBar data={series} x="month" series={mixSeries} height={270} flat={flat}/>});
  if(hasBreakdown) charts.push({id:'stacked',title:'Stacked',sub:'cumulative breakdown',
    render:flat=><StackedBar data={series} x="month" series={mixSeries} height={270} flat={flat}/>});
  if(hasBreakdown && typeof window.StackedPctBar==='function') charts.push({id:'stackpct',title:'100% Stacked',sub:'composition share',
    render:flat=><StackedPctBar data={series} x="month" series={mixSeries} height={270} flat={flat}/>});
  if(typeof window.HBarChart==='function') charts.push({id:'hbar',title:'Horizontal',sub:`${d.primaryLabel} by month`,
    render:flat=><HBarChart data={hbarData} x="label" y="value" height={Math.max(220,hbarData.length*26)} flat={flat}/>});
  if(hasDonut) charts.push({id:'donut',title:'Composition',sub:'breakdown totals',
    render:flat=><div style={{display:'grid',placeItems:'center',minHeight:260}}>
      <Donut data={donutData} size={200} centerValue={fmt(donutData.reduce((s,x)=>s+x.value,0))} centerLabel="Total" flat={flat}/></div>});

  // refs to each rendered card's SVG so we can rasterize on demand
  const svgRefs=React.useRef({});
  const grabSvg=id=>node=>{ if(node) svgRefs.current[id]=node.querySelector('svg'); };
  const downloadPNG=c=>{ const svg=svgRefs.current[c.id]; chartToPNG(svg,`UNICO-${d.short}-${c.id}`); };

  // ---- Export all charts to PDF via #pdf-root portal (reports.jsx mechanism) ----
  const [exporting,setExporting]=React.useState(false);
  const [pdfCharts,setPdfCharts]=React.useState(null); // array of chart defs to render flat into portal

  const exportAllPDF=()=>{
    const native=window.unicoNative;
    const toast=(m,t)=>{ try{ window.UI&&window.UI.toast&&window.UI.toast(m,t); }catch(e){} };
    setExporting(true);
    setPdfCharts(charts);            // mount flat charts into the hidden #pdf-root portal
    document.body.classList.add('pdf-export-mode'); // print only #pdf-root
    // allow React to paint the portal before invoking print/export
    setTimeout(async()=>{
      try{
        if(native&&typeof native.exportPDF==='function'){
          const res=await native.exportPDF({pageSize:'A4',landscape:true,defaultName:`UNICO-${d.short}-charts`});
          if(res&&res.ok) toast('Charts PDF'+(res.path?' saved · '+res.path:' ready — save it from the print dialog'),'success');
          else if(res&&res.canceled){ /* dismissed — stay quiet */ }
          else toast((res&&res.error)||'PDF export failed','error');
        }else{
          // browser / non-desktop fallback
          window.print();
          toast('Use the print dialog to save as PDF','info');
        }
      }catch(e){ toast('PDF export failed','error'); }
      finally{ document.body.classList.remove('pdf-export-mode'); setExporting(false); setPdfCharts(null); } // clean up portal
    },120);
  };

  const pdfRoot = typeof document!=='undefined' ? document.getElementById('pdf-root') : null;

  // Two charts per landscape A4 page.
  const pages=[];
  if(pdfCharts){
    for(let i=0;i<pdfCharts.length;i+=2) pages.push(pdfCharts.slice(i,i+2));
  }
  const PdfHeader=()=>(
    <div style={{display:'flex',alignItems:'center',gap:12,borderBottom:'2px solid var(--blue)',paddingBottom:14}}>
      <Ic d={DEPT_ICON[d.id]||I.activity} s={22} c={tone}/>
      <div><div style={{fontWeight:700,fontSize:15}}>{d.name}</div>
        <div style={{fontSize:11,color:'var(--muted)',letterSpacing:.5,textTransform:'uppercase',marginTop:2}}>Charts</div></div>
      <div className="spacer"/><span className="tag">{d.group}</span>
    </div>
  );
  const PdfFooter=({n,total})=>(
    <div className="pdf-foot" style={{marginTop:20,borderTop:'1px solid var(--line)',paddingTop:8,fontSize:9.5,color:'var(--faint)',display:'flex',flex:'0 0 auto'}}>
      <span>UNICO HOSPITALS PLC</span><span className="spacer"/><span>{d.name} — Charts</span><span className="spacer"/><span>Page {n} of {total}</span>
    </div>
  );

  return (
    <div className="grid" style={{gap:16}}>
      <SectionTitle icon={I.trend} title={`${d.name} — Charts Gallery`} sub={`${charts.length} visualizations · ${series.length} month${series.length!==1?'s':''}`}
        right={<>
          {setRoute&&<button className="btn sm" onClick={()=>setRoute({view:'departments',dept:d.id})}><Ic d={I.chevR} s={15} style={{transform:'rotate(180deg)'}}/>Back</button>}
          <button className="btn pri sm" onClick={exportAllPDF} disabled={exporting}><Ic d={I.download} s={15}/>{exporting?'Exporting…':'Export all to PDF'}</button>
        </>}/>

      {/* hidden portal — flat charts laid out one section per A4-landscape page */}
      {pdfRoot && pdfCharts && ReactDOM.createPortal(
        <div className="pdf-doc">
          {pages.map((grp,pi)=>(
            <section className="pdf-page" key={pi}>
              <div>
                <PdfHeader/>
                <div style={{marginTop:18,display:'flex',flexDirection:'column',gap:18}}>
                  {grp.map(c=>(
                    <div key={c.id}>
                      <div style={{fontWeight:700,fontSize:13,marginBottom:6,color:tone}}>{c.title}
                        <span style={{fontWeight:500,fontSize:11,color:'var(--muted)',marginLeft:8}}>{c.sub}</span></div>
                      {c.render(true)}
                    </div>
                  ))}
                </div>
                <PdfFooter n={pi+1} total={pages.length}/>
              </div>
            </section>
          ))}
        </div>,
        pdfRoot
      )}

      {/* on-screen gallery grid */}
      <div className="grid" style={{gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:16}}>
        {charts.map(c=>(
          <div className="card" key={c.id} style={{minWidth:0}}>
            <div className="card-h">
              <h3>{c.title}</h3>
              {c.sub&&<span className="sub">{c.sub}</span>}
              <span className="spacer"/>
              <button className="btn sm" onClick={()=>downloadPNG(c)} title="Download this chart as PNG">
                <Ic d={I.download} s={14}/>PNG
              </button>
            </div>
            <div className="card-b" ref={grabSvg(c.id)} style={{overflowX:'auto'}}>
              {c.render(false)}
            </div>
          </div>
        ))}
        {charts.length===0&&(
          <div className="card"><div className="card-b" style={{textAlign:'center',color:'var(--faint)',padding:'40px 0'}}>
            No chartable data for this department.
          </div></div>
        )}
      </div>
    </div>
  );
}

window.ChartsGallery=ChartsGallery;
