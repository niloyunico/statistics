/* UNICO — animated SVG chart library */
const { useState, useEffect, useRef, useMemo } = React;

const PALETTE = ['#0b66d0','#0f9b8e','#e08a1e','#6a52d4','#d23a52','#2bb3a3','#8a93a3','#4f8df7','#1f9d57','#c2486f'];
const fmt = n => (n==null?'–':(Math.round(n*100)/100).toLocaleString());

function useMounted(delay=30){
  const [m,setM]=useState(false);
  useEffect(()=>{ const t=setTimeout(()=>setM(true),delay); return ()=>clearTimeout(t); },[]);
  return m;
}

/* floating tooltip */
function useTip(){
  const [tip,setTip]=useState(null);
  const node = tip ? (
    <div style={{position:'fixed',left:tip.x,top:tip.y,transform:'translate(-50%,-115%)',
      background:'#0d1b2e',color:'#fff',padding:'7px 10px',borderRadius:7,fontSize:11.5,
      pointerEvents:'none',zIndex:9999,boxShadow:'0 8px 24px rgba(0,0,0,.3)',whiteSpace:'nowrap'}}>
      <div style={{fontWeight:700,marginBottom:tip.rows?3:0}}>{tip.title}</div>
      {(tip.rows||[]).map((r,i)=>(
        <div key={i} style={{display:'flex',alignItems:'center',gap:6,opacity:.95}}>
          {r.color&&<i style={{width:8,height:8,borderRadius:2,background:r.color,display:'inline-block'}}/>}
          <span style={{color:'#aebccd'}}>{r.label}</span>
          <b className="num" style={{marginLeft:'auto',paddingLeft:10,fontFamily:'IBM Plex Mono'}}>{r.value}</b>
        </div>
      ))}
      {tip.single!=null&&<div className="num" style={{fontFamily:'IBM Plex Mono',fontSize:15,fontWeight:600}}>{tip.single}</div>}
    </div>
  ) : null;
  return [node,setTip];
}

/* ---------- Vertical bar (rounded, gradient, animated) ---------- */
const BAR_COLORS=['#0090ca','#159fbf','#2bb3a3','#46b87e','#7cc35a','#f0a93b','#ef8049','#e85c69','#b65cc6','#6a6fd4'];
function BarChart({data, x, y, height=240, color='#0b66d0', label, accent, flat=false}){
  const mounted=useMounted(); const m=flat||mounted; const [tip,setTip]=useTip(); const wrap=useRef(null);
  const max=Math.max(1,...data.map(d=>d[y]||0));
  const id='bg'+(label||y).replace(/\W/g,'');
  return (
    <div ref={wrap} style={{position:'relative'}}>
      <svg viewBox={`0 0 ${data.length*54} ${height}`} height={height} preserveAspectRatio="none" style={{overflow:'visible',width:'100%',maxWidth:data.length*74,margin:'0 auto',display:'block'}}>
        <defs>
          {BAR_COLORS.map((c,ci)=>(
            <linearGradient key={ci} id={id+'_'+ci} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c}/><stop offset="100%" stopColor={c} stopOpacity="0.58"/>
            </linearGradient>
          ))}
        </defs>
        {[0,.25,.5,.75,1].map((g,i)=>(
          <line key={i} x1="0" x2={data.length*54} y1={height-20-g*(height-44)} y2={height-20-g*(height-44)} stroke="#eef1f5" strokeWidth="1"/>
        ))}
        {data.map((d,i)=>{
          const v=d[y]||0; const bh=m?(v/max)*(height-44):0;
          const bx=i*54+14, bw=26, by=height-20-bh;
          return (
            <g key={i}
              onMouseMove={e=>setTip({x:e.clientX,y:e.clientY,title:d[x],single:fmt(v)})}
              onMouseLeave={()=>setTip(null)} style={{cursor:'pointer'}}>
              <rect x={i*54+4} y="0" width="46" height={height-20} fill="transparent"/>
              <rect x={bx} y={by} width={bw} height={bh} rx="4" fill={flat?BAR_COLORS[i%BAR_COLORS.length]:`url(#${id}_${i%BAR_COLORS.length})`}
                style={flat?undefined:{transition:'y .7s cubic-bezier(.2,.8,.25,1), height .7s cubic-bezier(.2,.8,.25,1)'}}/>
              {m&&v>0&&<text x={bx+bw/2} y={by-6} textAnchor="middle" fontSize="10.5" fontFamily="IBM Plex Mono" fontWeight="600" fill={BAR_COLORS[i%BAR_COLORS.length]}>{v}</text>}
              <text x={bx+bw/2} y={height-6} textAnchor="middle" fontSize="9.5" fill="#9aa6b4">{String(d[x]).replace(/ \d{4}| 20\d\d/,'').slice(0,6)}</text>
            </g>
          );
        })}
      </svg>
      {tip}
    </div>
  );
}

/* ---------- Grouped / clustered bars ---------- */
function GroupedBar({data, x, series, height=260}){
  const m=useMounted(); const [tip,setTip]=useTip();
  const max=Math.max(1,...data.flatMap(d=>series.map(s=>d[s.id]||0)));
  const groupW=Math.max(48, series.length*16+18);
  const bw=Math.min(15,(groupW-14)/series.length-3);
  return (
    <div style={{position:'relative'}}>
      <svg viewBox={`0 0 ${data.length*groupW} ${height}`} height={height} preserveAspectRatio="none" style={{overflow:'visible',width:'100%',maxWidth:data.length*Math.max(70,groupW),margin:'0 auto',display:'block'}}>
        {[0,.25,.5,.75,1].map((g,i)=>(
          <line key={i} x1="0" x2={data.length*groupW} y1={height-20-g*(height-44)} y2={height-20-g*(height-44)} stroke="#eef1f5"/>
        ))}
        {data.map((d,gi)=>(
          <g key={gi}
            onMouseMove={e=>setTip({x:e.clientX,y:e.clientY,title:d[x],rows:series.map(s=>({label:s.label,value:fmt(d[s.id]||0),color:s.color}))})}
            onMouseLeave={()=>setTip(null)} style={{cursor:'pointer'}}>
            <rect x={gi*groupW} y="0" width={groupW} height={height-20} fill="transparent"/>
            {series.map((s,si)=>{
              const v=d[s.id]||0, h=m?(v/max)*(height-44):0;
              const bx=gi*groupW+9+si*(bw+3), by=height-20-h;
              return <rect key={si} x={bx} y={by} width={bw} height={h} rx="3" fill={s.color}
                style={{transition:`y .6s ${si*60}ms cubic-bezier(.2,.8,.25,1), height .6s ${si*60}ms cubic-bezier(.2,.8,.25,1)`}}/>;
            })}
            <text x={gi*groupW+groupW/2} y={height-6} textAnchor="middle" fontSize="9.5" fill="#9aa6b4">{String(d[x]).replace(/ \d{4}| 20\d\d/,'').slice(0,6)}</text>
          </g>
        ))}
      </svg>
      {tip}
    </div>
  );
}

/* ---------- Stacked bars ---------- */
function StackedBar({data, x, series, height=260}){
  const m=useMounted(); const [tip,setTip]=useTip();
  const totals=data.map(d=>series.reduce((s,k)=>s+(d[k.id]||0),0));
  const max=Math.max(1,...totals);
  const step=Math.max(40,Math.min(70,600/data.length));
  return (
    <div style={{position:'relative'}}>
      <svg viewBox={`0 0 ${data.length*step} ${height}`} height={height} preserveAspectRatio="none" style={{overflow:'visible',width:'100%',maxWidth:data.length*Math.max(64,step),margin:'0 auto',display:'block'}}>
        {[0,.25,.5,.75,1].map((g,i)=>(
          <line key={i} x1="0" x2={data.length*step} y1={height-20-g*(height-44)} y2={height-20-g*(height-44)} stroke="#eef1f5"/>
        ))}
        {data.map((d,gi)=>{
          let acc=0; const bx=gi*step+(step-24)/2, bw=24;
          return (
            <g key={gi}
              onMouseMove={e=>setTip({x:e.clientX,y:e.clientY,title:d[x],rows:[...series.map(s=>({label:s.label,value:fmt(d[s.id]||0),color:s.color})),{label:'Total',value:fmt(totals[gi])}]})}
              onMouseLeave={()=>setTip(null)} style={{cursor:'pointer'}}>
              <rect x={gi*step} y="0" width={step} height={height-20} fill="transparent"/>
              {series.map((s,si)=>{
                const v=d[s.id]||0; const h=m?(v/max)*(height-44):0;
                const by=height-20-acc-h; acc+=h;
                return <rect key={si} x={bx} y={by} width={bw} height={Math.max(0,h)}
                  fill={s.color} rx={si===series.length-1?3:0}
                  style={{transition:`all .6s ${si*50}ms cubic-bezier(.2,.8,.25,1)`}}/>;
              })}
              <text x={gi*step+step/2} y={height-6} textAnchor="middle" fontSize="9.5" fill="#9aa6b4">{String(d[x]).replace(/ \d{4}| 20\d\d/,'').slice(0,6)}</text>
            </g>
          );
        })}
      </svg>
      {tip}
    </div>
  );
}

/* ---------- Horizontal bars (ranking) ---------- */
function HBar({rows, height}){
  const m=useMounted(); const max=Math.max(1,...rows.map(r=>r.value));
  return (
    <div style={{display:'flex',flexDirection:'column',gap:10}}>
      {rows.map((r,i)=>(
        <div key={i} style={{display:'grid',gridTemplateColumns:'112px 1fr 46px',alignItems:'center',gap:10}}>
          <div style={{fontSize:12,fontWeight:600,color:'#3c4858',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{r.label}</div>
          <div style={{height:16,background:'#eef1f5',borderRadius:5,overflow:'hidden'}}>
            <div style={{height:'100%',width:m?`${(r.value/max)*100}%`:'0%',background:`linear-gradient(90deg,${r.color||'#0b66d0'},${r.color2||r.color||'#2a82e0'})`,
              borderRadius:5,transition:`width .8s ${i*55}ms cubic-bezier(.2,.8,.25,1)`}}/>
          </div>
          <div className="num" style={{fontSize:12.5,fontWeight:600,textAlign:'right',color:'#16202e'}}>{fmt(r.value)}</div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Line / area chart ---------- */
function LineChart({data, x, y, height=240, color='#0b66d0', area=true, flat=false}){
  const mounted=useMounted(); const m=flat||mounted; const [tip,setTip]=useTip(); const [hi,setHi]=useState(-1);
  const W=Math.max(360,data.length*60), H=height, pad=26;
  const max=Math.max(1,...data.map(d=>d[y]||0)), min=0;
  const px=i=>pad+ (data.length<=1?W/2:(i/(data.length-1))*(W-pad*2));
  const py=v=>H-22-((v-min)/(max-min))*(H-44);
  const pts=data.map((d,i)=>[px(i),py(d[y]||0)]);
  const path=pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
  const areaPath=path+` L ${pts[pts.length-1][0]} ${H-22} L ${pts[0][0]} ${H-22} Z`;
  const id='ln'+y;
  return (
    <div style={{position:'relative'}}>
      <svg viewBox={`0 0 ${W} ${H}`} height={H} preserveAspectRatio="none" style={{overflow:'visible',width:'100%',maxWidth:Math.max(140,data.length*80),margin:'0 auto',display:'block'}}
        onMouseLeave={()=>{setTip(null);setHi(-1);}}>
        <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28"/><stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient></defs>
        {[0,.25,.5,.75,1].map((g,i)=>(
          <line key={i} x1={pad} x2={W-pad} y1={22+g*(H-44)} y2={22+g*(H-44)} stroke="#eef1f5"/>
        ))}
        {area&&<path d={areaPath} fill={flat?color:`url(#${id})`} fillOpacity={flat?0.12:1} style={flat?undefined:{opacity:m?1:0,transition:'opacity .9s .3s'}}/>}
        <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"
          style={{strokeDasharray:1400,strokeDashoffset:m?0:1400,transition:'stroke-dashoffset 1.1s cubic-bezier(.4,0,.2,1)'}}/>
        {pts.map((p,i)=>(
          <g key={i}>
            <rect x={px(i)-(W/data.length/2)} y="0" width={W/data.length} height={H} fill="transparent"
              onMouseMove={e=>{setHi(i);setTip({x:e.clientX,y:e.clientY,title:data[i][x],single:fmt(data[i][y]||0)});}}/>
            <circle cx={p[0]} cy={p[1]} r={hi===i?5:3.2} fill="#fff" stroke={color} strokeWidth="2.5"
              style={{opacity:m?1:0,transition:'opacity .4s '+(0.5+i*0.05)+'s, r .15s'}}/>
          </g>
        ))}
        {hi>=0&&<line x1={px(hi)} x2={px(hi)} y1="14" y2={H-22} stroke={color} strokeWidth="1" strokeDasharray="3 3" opacity=".5"/>}
      </svg>
      {tip}
    </div>
  );
}

/* ---------- Donut ---------- */
// Solid donut-wedge path (no stroke-dash / rotation / animation) — rasterizes
// reliably in printToPDF, unlike the animated dashed-circle ring.
function donutArc(cx,cy,rO,rI,a0,a1){
  if(a1-a0>=Math.PI*2-1e-4) a1=a0+Math.PI*2-1e-4;
  const P=(r,a)=>`${(cx+r*Math.cos(a)).toFixed(2)} ${(cy+r*Math.sin(a)).toFixed(2)}`;
  const large=(a1-a0)>Math.PI?1:0;
  return `M ${P(rO,a0)} A ${rO} ${rO} 0 ${large} 1 ${P(rO,a1)} L ${P(rI,a1)} A ${rI} ${rI} 0 ${large} 0 ${P(rI,a0)} Z`;
}
function Donut({data, size=180, thickness=30, centerLabel, centerValue, flat=false}){
  const mounted=useMounted(); const m=flat||mounted; const [tip,setTip]=useTip(); const [hi,setHi]=useState(-1);
  const total=data.reduce((s,d)=>s+d.value,0)||1;
  const r=(size-thickness)/2, cx=size/2, cy=size/2, C=2*Math.PI*r;
  const rO=size/2, rI=size/2-thickness;
  let off=0, ang=-Math.PI/2;
  return (
    <div style={{position:'relative',display:'flex',alignItems:'center',gap:18}}>
      {flat ? (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {data.map((d,i)=>{
          const frac=d.value/total; const a0=ang, a1=ang+frac*2*Math.PI; ang=a1;
          return <path key={i} d={donutArc(cx,cy,rO,rI,a0,a1)} fill={d.color||PALETTE[i%PALETTE.length]}
            onMouseMove={e=>{setHi(i);setTip({x:e.clientX,y:e.clientY,title:d.label,single:fmt(d.value)+` (${Math.round(frac*100)}%)`});}}
            onMouseLeave={()=>{setHi(-1);setTip(null);}} style={{cursor:'pointer'}}/>;
        })}
      </svg>
      ) : (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{transform:'rotate(-90deg)'}}>
        {data.map((d,i)=>{
          const frac=d.value/total; const len=frac*C; const dash=`${m?len:0} ${C}`;
          const el=(
            <circle key={i} cx={cx} cy={cy} r={r} fill="none"
              stroke={d.color||PALETTE[i%PALETTE.length]} strokeWidth={hi===i?thickness+5:thickness}
              strokeDasharray={dash} strokeDashoffset={-off} strokeLinecap="butt"
              onMouseMove={e=>{setHi(i);setTip({x:e.clientX,y:e.clientY,title:d.label,single:fmt(d.value)+` (${Math.round(frac*100)}%)`});}}
              onMouseLeave={()=>{setHi(-1);setTip(null);}}
              style={{transition:`stroke-dasharray .9s ${i*80}ms cubic-bezier(.3,.8,.3,1), stroke-width .15s`,cursor:'pointer'}}/>
          );
          off+=len; return el;
        })}
      </svg>
      )}
      {(centerValue!=null)&&(
        <div style={{position:'absolute',left:size/2,top:size/2,transform:'translate(-50%,-50%)',textAlign:'center'}}>
          <div className="num" style={{fontSize:24,fontWeight:600,color:'#16202e',lineHeight:1}}>{centerValue}</div>
          <div style={{fontSize:10,color:'#6c7a8c',textTransform:'uppercase',letterSpacing:.4}}>{centerLabel}</div>
        </div>
      )}
      <div style={{display:'flex',flexDirection:'column',gap:6}}>
        {data.map((d,i)=>(
          <div key={i} style={{display:'flex',alignItems:'center',gap:8,fontSize:12,opacity:hi<0||hi===i?1:.45,transition:'opacity .15s'}}
            onMouseEnter={()=>setHi(i)} onMouseLeave={()=>setHi(-1)}>
            <i style={{width:9,height:9,borderRadius:3,background:d.color||PALETTE[i%PALETTE.length],display:'inline-block'}}/>
            <span style={{color:'#3c4858',fontWeight:500}}>{d.label}</span>
            <b className="num" style={{marginLeft:'auto',paddingLeft:14,color:'#16202e'}}>{fmt(d.value)}</b>
          </div>
        ))}
      </div>
      {tip}
    </div>
  );
}

/* ---------- Sparkline ---------- */
function Spark({values, color='#0b66d0', w=110, h=34, fill=true}){
  const m=useMounted();
  const max=Math.max(1,...values), min=Math.min(...values,0);
  const px=i=>(i/(values.length-1||1))*w;
  const py=v=>h-3-((v-min)/((max-min)||1))*(h-6);
  const path=values.map((v,i)=>(i?'L':'M')+px(i).toFixed(1)+' '+py(v).toFixed(1)).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{display:'block'}}>
      {fill&&<path d={path+` L ${w} ${h} L 0 ${h} Z`} fill={color} opacity=".12"/>}
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
        style={{strokeDasharray:300,strokeDashoffset:m?0:300,transition:'stroke-dashoffset .9s'}}/>
      <circle cx={px(values.length-1)} cy={py(values[values.length-1])} r="2.6" fill={color}/>
    </svg>
  );
}

Object.assign(window,{ BarChart, GroupedBar, StackedBar, HBar, LineChart, Donut, Spark, PALETTE, fmt, useTip, useMounted });
