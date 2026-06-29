/* UNICO — extra chart components (combo, hbar, 100% stacked, area+target)
   global-script React: no imports/exports. Reuses globals from charts.jsx:
   useMounted, useTip, PALETTE, fmt, BAR_COLORS.
   PDF SAFETY: every component takes `flat`. When flat=true -> solid fills, no
   gradients, no svg filters, full geometry on first paint (no useMounted gate). */

/* ---------- ComboChart: dual-axis bars (left) + line (right) ---------- */
function ComboChart({data, x, barKey, lineKey, height=250, barColor='#0090ca', lineColor='#e08a1e', barLabel, lineLabel, flat=false}){
  const mounted=useMounted(); const m=flat||mounted;
  const [tip,setTip]=useTip(); const [hi,setHi]=React.useState(-1);
  data=data||[];
  const isPct = String(lineKey).toLowerCase().includes('pct') || String(lineKey).toLowerCase().includes('percent') || String(lineKey).toLowerCase().includes('rate');
  const padL=42, padR=46, padT=22, padB=24;
  const step=Math.max(46,Math.min(82,560/Math.max(1,data.length)));
  const W=Math.max(320, data.length*step + padL + padR), H=height;
  const plotW=W-padL-padR, plotH=H-padT-padB;
  const barMax=Math.max(1,...data.map(d=>+d[barKey]||0));
  const lineVals=data.map(d=>+d[lineKey]||0);
  const lineMax=Math.max(isPct?100:1,...lineVals);
  const lineMin=0;
  const cx=i=>padL + (data.length<=1?plotW/2:(i+0.5)*(plotW/data.length));
  const lpy=v=>padT + plotH - ((v-lineMin)/((lineMax-lineMin)||1))*plotH;
  const baseY=padT+plotH;
  const id='cmb'+String(barKey).replace(/\W/g,'');
  const pts=data.map((d,i)=>[cx(i),lpy(+d[lineKey]||0)]);
  const path=pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
  const fmtLine=v=>isPct?(Math.round(v*10)/10)+'%':fmt(v);
  const ticks=[0,.25,.5,.75,1];
  return (
    <div style={{position:'relative'}}>
      <div style={{display:'flex',gap:18,justifyContent:'center',marginBottom:6,fontSize:11.5,color:'#3c4858'}}>
        <span style={{display:'flex',alignItems:'center',gap:6}}>
          <i style={{width:11,height:11,borderRadius:3,background:barColor,display:'inline-block'}}/>{barLabel||barKey}
        </span>
        <span style={{display:'flex',alignItems:'center',gap:6}}>
          <i style={{width:14,height:3,borderRadius:2,background:lineColor,display:'inline-block'}}/>{lineLabel||lineKey}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} height={H} preserveAspectRatio="none"
        style={{overflow:'visible',width:'100%',maxWidth:Math.max(260,data.length*step+padL+padR),margin:'0 auto',display:'block'}}
        onMouseLeave={()=>{setTip(null);setHi(-1);}}>
        {!flat&&<defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={barColor}/><stop offset="100%" stopColor={barColor} stopOpacity="0.58"/>
          </linearGradient>
        </defs>}
        {ticks.map((g,i)=>(
          <line key={i} x1={padL} x2={W-padR} y1={baseY-g*plotH} y2={baseY-g*plotH} stroke="#eef1f5" strokeWidth="1"/>
        ))}
        {/* left axis (bars) */}
        {ticks.map((g,i)=>(
          <text key={'l'+i} x={padL-6} y={baseY-g*plotH+3} textAnchor="end" fontSize="9" fontFamily="IBM Plex Mono" fill="#9aa6b4">{fmt(Math.round(barMax*g))}</text>
        ))}
        {/* right axis (line) */}
        {ticks.map((g,i)=>(
          <text key={'r'+i} x={W-padR+6} y={baseY-g*plotH+3} textAnchor="start" fontSize="9" fontFamily="IBM Plex Mono" fill={lineColor}>{isPct?Math.round(lineMax*g)+'%':fmt(Math.round(lineMax*g))}</text>
        ))}
        {/* bars */}
        {data.map((d,i)=>{
          const v=+d[barKey]||0; const bh=m?(v/barMax)*plotH:0;
          const bw=Math.min(28,(plotW/data.length)*0.5);
          const bx=cx(i)-bw/2, by=baseY-bh;
          return (
            <g key={i}
              onMouseMove={e=>{setHi(i);setTip({x:e.clientX,y:e.clientY,title:String(d[x]),rows:[
                {label:barLabel||barKey,value:fmt(v),color:barColor},
                {label:lineLabel||lineKey,value:fmtLine(+d[lineKey]||0),color:lineColor}]});}}
              onMouseLeave={()=>{setTip(null);setHi(-1);}} style={{cursor:'pointer'}}>
              <rect x={cx(i)-(plotW/data.length)/2} y={padT} width={plotW/data.length} height={plotH} fill="transparent"/>
              <rect x={bx} y={by} width={bw} height={Math.max(0,bh)} rx="4"
                fill={flat?barColor:`url(#${id})`}
                style={flat?undefined:{transition:'y .7s cubic-bezier(.2,.8,.25,1), height .7s cubic-bezier(.2,.8,.25,1)'}}/>
              {m&&v>0&&<text x={cx(i)} y={by-5} textAnchor="middle" fontSize="9.5" fontFamily="IBM Plex Mono" fontWeight="600" fill={barColor}>{fmt(v)}</text>}
            </g>
          );
        })}
        {/* line */}
        <path d={path} fill="none" stroke={lineColor} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"
          style={flat?undefined:{strokeDasharray:1600,strokeDashoffset:m?0:1600,transition:'stroke-dashoffset 1.1s cubic-bezier(.4,0,.2,1)'}}/>
        {pts.map((p,i)=>(
          <circle key={i} cx={p[0]} cy={p[1]} r={hi===i?5:3.4} fill="#fff" stroke={lineColor} strokeWidth="2.5"
            style={flat?undefined:{opacity:m?1:0,transition:'opacity .4s '+(0.5+i*0.05)+'s, r .15s'}}/>
        ))}
        {/* x labels */}
        {data.map((d,i)=>(
          <text key={'x'+i} x={cx(i)} y={H-6} textAnchor="middle" fontSize="9.5" fill="#9aa6b4">{String(d[x]).replace(/ \d{4}| 20\d\d/,'').slice(0,6)}</text>
        ))}
      </svg>
      {tip}
    </div>
  );
}

/* ---------- HBarChart: horizontal bars, one per item, PALETTE cycle ---------- */
function HBarChart({data, x, y, height, flat=false}){
  const mounted=useMounted(); const m=flat||mounted;
  data=data||[];
  const max=Math.max(1,...data.map(d=>+d[y]||0));
  const maxH = height || (data.length*30+8);
  const tall = (data.length*30+8) > maxH;
  return (
    <div style={{maxHeight:maxH,overflowY:tall?'auto':'visible',overflowX:'hidden'}}>
      <div style={{display:'flex',flexDirection:'column',gap:9,padding:'2px 0'}}>
        {data.map((d,i)=>{
          const v=+d[y]||0; const c=PALETTE[i%PALETTE.length];
          return (
            <div key={i} style={{display:'grid',gridTemplateColumns:'120px 1fr 54px',alignItems:'center',gap:10}}>
              <div style={{fontSize:12,fontWeight:600,color:'#3c4858',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}} title={String(d[x])}>{String(d[x])}</div>
              <div style={{height:15,background:'#eef1f5',borderRadius:5,overflow:'hidden'}}>
                <div style={{height:'100%',width:m?`${(v/max)*100}%`:'0%',
                  background:flat?c:`linear-gradient(90deg,${c},${c}cc)`,borderRadius:5,
                  transition:flat?undefined:`width .8s ${i*45}ms cubic-bezier(.2,.8,.25,1)`}}/>
              </div>
              <div className="num" style={{fontSize:12.5,fontWeight:600,textAlign:'right',color:'#16202e',fontFamily:'IBM Plex Mono'}}>{fmt(v)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- StackedPctBar: 100% normalized stacked bars ---------- */
function StackedPctBar({data, x, series, height=260, flat=false}){
  const mounted=useMounted(); const m=flat||mounted; const [tip,setTip]=useTip();
  data=data||[]; series=series||[];
  const padT=16, padB=24;
  const plotH=height-padT-padB;
  const totals=data.map(d=>series.reduce((s,k)=>s+(+d[k.id]||0),0));
  const step=Math.max(40,Math.min(74,560/Math.max(1,data.length)));
  const W=Math.max(280,data.length*step), H=height;
  const baseY=padT+plotH;
  const ticks=[0,.25,.5,.75,1];
  return (
    <div style={{position:'relative'}}>
      <div style={{display:'flex',gap:14,flexWrap:'wrap',justifyContent:'center',marginBottom:6,fontSize:11.5,color:'#3c4858'}}>
        {series.map((s,i)=>(
          <span key={i} style={{display:'flex',alignItems:'center',gap:6}}>
            <i style={{width:11,height:11,borderRadius:3,background:s.color||PALETTE[i%PALETTE.length],display:'inline-block'}}/>{s.label||s.id}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} height={H} preserveAspectRatio="none"
        style={{overflow:'visible',width:'100%',maxWidth:Math.max(260,data.length*Math.max(64,step)),margin:'0 auto',display:'block'}}>
        {ticks.map((g,i)=>(
          <g key={i}>
            <line x1="0" x2={W} y1={baseY-g*plotH} y2={baseY-g*plotH} stroke="#eef1f5" strokeWidth="1"/>
            <text x={2} y={baseY-g*plotH-2} fontSize="9" fontFamily="IBM Plex Mono" fill="#9aa6b4">{Math.round(g*100)}%</text>
          </g>
        ))}
        {data.map((d,gi)=>{
          const tot=totals[gi]||0;
          const bw=Math.min(26,step*0.5);
          const bx=gi*step+(step-bw)/2;
          let acc=0;
          return (
            <g key={gi}
              onMouseMove={e=>setTip({x:e.clientX,y:e.clientY,title:String(d[x]),rows:series.map((s,si)=>{
                const v=+d[s.id]||0; const pc=tot?(v/tot*100):0;
                return {label:s.label||s.id,value:fmt(v)+` (${Math.round(pc)}%)`,color:s.color||PALETTE[si%PALETTE.length]};
              })})}
              onMouseLeave={()=>setTip(null)} style={{cursor:'pointer'}}>
              <rect x={gi*step} y={padT} width={step} height={plotH} fill="transparent"/>
              {series.map((s,si)=>{
                const v=+d[s.id]||0; const frac=tot?v/tot:0;
                const h=m?frac*plotH:0; const by=baseY-acc-h; acc+=h;
                return <rect key={si} x={bx} y={by} width={bw} height={Math.max(0,h)}
                  fill={s.color||PALETTE[si%PALETTE.length]} rx={si===series.length-1?3:0}
                  style={flat?undefined:{transition:`all .6s ${si*50}ms cubic-bezier(.2,.8,.25,1)`}}/>;
              })}
              <text x={gi*step+step/2} y={H-6} textAnchor="middle" fontSize="9.5" fill="#9aa6b4">{String(d[x]).replace(/ \d{4}| 20\d\d/,'').slice(0,6)}</text>
            </g>
          );
        })}
      </svg>
      {tip}
    </div>
  );
}

/* ---------- AreaTargetChart: filled area + dashed target reference line ---------- */
function AreaTargetChart({data, x, y, target=null, height=240, color='#0090ca', flat=false}){
  const mounted=useMounted(); const m=flat||mounted; const [tip,setTip]=useTip(); const [hi,setHi]=React.useState(-1);
  data=data||[];
  const pad=30, padB=24, padT=18;
  const W=Math.max(320,data.length*60), H=height;
  const plotH=H-padT-padB;
  const vals=data.map(d=>+d[y]||0);
  const max=Math.max(1,...vals, target!=null?target:0);
  const min=0;
  const px=i=>pad+(data.length<=1?(W-pad*2)/2:(i/(data.length-1))*(W-pad*2));
  const py=v=>padT+plotH-((v-min)/((max-min)||1))*plotH;
  const baseY=padT+plotH;
  const pts=data.map((d,i)=>[px(i),py(+d[y]||0)]);
  const path=pts.length?pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' '):'';
  const areaPath=pts.length?path+` L ${pts[pts.length-1][0]} ${baseY} L ${pts[0][0]} ${baseY} Z`:'';
  const id='area'+String(y).replace(/\W/g,'');
  const ticks=[0,.25,.5,.75,1];
  return (
    <div style={{position:'relative'}}>
      <svg viewBox={`0 0 ${W} ${H}`} height={H} preserveAspectRatio="none"
        style={{overflow:'visible',width:'100%',maxWidth:Math.max(160,data.length*80),margin:'0 auto',display:'block'}}
        onMouseLeave={()=>{setTip(null);setHi(-1);}}>
        {!flat&&<defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28"/><stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient></defs>}
        {ticks.map((g,i)=>(
          <g key={i}>
            <line x1={pad} x2={W-pad} y1={padT+g*plotH} y2={padT+g*plotH} stroke="#eef1f5" strokeWidth="1"/>
            <text x={pad-6} y={padT+g*plotH+3} textAnchor="end" fontSize="9" fontFamily="IBM Plex Mono" fill="#9aa6b4">{fmt(Math.round(max*(1-g)))}</text>
          </g>
        ))}
        {areaPath&&<path d={areaPath} fill={flat?color:`url(#${id})`} fillOpacity={flat?0.12:1}
          style={flat?undefined:{opacity:m?1:0,transition:'opacity .9s .3s'}}/>}
        {path&&<path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"
          style={flat?undefined:{strokeDasharray:1600,strokeDashoffset:m?0:1600,transition:'stroke-dashoffset 1.1s cubic-bezier(.4,0,.2,1)'}}/>}
        {/* target reference line */}
        {target!=null&&(
          <g>
            <line x1={pad} x2={W-pad} y1={py(target)} y2={py(target)} stroke="#d23a52" strokeWidth="1.5" strokeDasharray="5 4"/>
            <text x={W-pad} y={py(target)-4} textAnchor="end" fontSize="10" fontFamily="IBM Plex Mono" fontWeight="600" fill="#d23a52">target {fmt(target)}</text>
          </g>
        )}
        {pts.map((p,i)=>(
          <g key={i}>
            <rect x={px(i)-(W/Math.max(1,data.length)/2)} y={padT} width={W/Math.max(1,data.length)} height={plotH} fill="transparent"
              onMouseMove={e=>{setHi(i);setTip({x:e.clientX,y:e.clientY,title:String(data[i][x]),single:fmt(+data[i][y]||0)});}}/>
            <circle cx={p[0]} cy={p[1]} r={hi===i?5:3.2} fill="#fff" stroke={color} strokeWidth="2.5"
              style={flat?undefined:{opacity:m?1:0,transition:'opacity .4s '+(0.5+i*0.05)+'s, r .15s'}}/>
          </g>
        ))}
        {hi>=0&&<line x1={px(hi)} x2={px(hi)} y1={padT} y2={baseY} stroke={color} strokeWidth="1" strokeDasharray="3 3" opacity=".5"/>}
        {data.map((d,i)=>(
          <text key={'x'+i} x={px(i)} y={H-6} textAnchor="middle" fontSize="9.5" fill="#9aa6b4">{String(d[x]).replace(/ \d{4}| 20\d\d/,'').slice(0,6)}</text>
        ))}
      </svg>
      {tip}
    </div>
  );
}

Object.assign(window,{ ComboChart, HBarChart, StackedPctBar, AreaTargetChart });
