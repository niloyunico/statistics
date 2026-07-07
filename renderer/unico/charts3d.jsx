/* UNICO — premium 3D + live charts */

/* ---------- 3D isometric bar chart ---------- */
function Bar3D({data, x, y, height=300, color='#0b66d0', multi=true, flat=false}){
  const m=useMounted(60); const [tip,setTip]=useTip(); const [hi,setHi]=React.useState(-1);
  const max=Math.max(1,...data.map(d=>d[y]||0));
  const dx=13, dy=-9, step=Math.max(46,Math.min(78,640/data.length));
  const W=data.length*step+dx+10, baseY=height-26, bw=Math.min(30,step-22);
  const lighten=(h,p)=>{const n=parseInt(h.slice(1),16);let r=(n>>16)+p,g=((n>>8)&255)+p,b=(n&255)+p;
    r=Math.max(0,Math.min(255,r));g=Math.max(0,Math.min(255,g));b=Math.max(0,Math.min(255,b));
    return '#'+(r<<16|g<<8|b).toString(16).padStart(6,'0');};
  // 12 entries so a full Jan–Dec axis gets a UNIQUE color per month (no repeats)
  const PAL=['#0090ca','#159fbf','#2bb3a3','#46b87e','#7cc35a','#f0a93b','#ef8049','#e85c69','#e0679b','#b65cc6','#6a6fd4','#4f8df7'];
  const colAt=i=>multi?PAL[i%PAL.length]:color;
  const id='b3'+color.replace('#','');
  return (
    <div style={{position:'relative'}}>
      <svg viewBox={`0 0 ${W} ${height}`} width="100%" height={height} preserveAspectRatio="xMidYMid meet" style={{overflow:'visible'}}>
        <defs>
          {PAL.map((c,ci)=>(
            <linearGradient key={ci} id={id+'_'+ci} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lighten(c,28)}/><stop offset="100%" stopColor={lighten(c,-12)}/>
            </linearGradient>
          ))}
          <filter id={id+'sh'} x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="#1b2b3f" floodOpacity="0.22"/>
          </filter>
        </defs>
        {/* iso floor grid lines */}
        {[0,.25,.5,.75,1].map((g,i)=>{const gy=baseY-g*(height-58);return(
          <g key={i}><line x1="0" y1={gy} x2={data.length*step} y2={gy} stroke="#e9edf3"/>
          <line x1={data.length*step} y1={gy} x2={data.length*step+dx} y2={gy+dy} stroke="#eef1f5"/></g>
        );})}
        {data.map((d,i)=>{
          const v=d[y]||0, bh=(v/max)*(height-58);
          const bx=i*step+12, by=baseY-bh, on=hi===i;
          const pts={
            top:`${bx},${by} ${bx+dx},${by+dy} ${bx+bw+dx},${by+dy} ${bx+bw},${by}`,
            side:`${bx+bw},${by} ${bx+bw+dx},${by+dy} ${bx+bw+dx},${baseY+dy} ${bx+bw},${baseY}`
          };
          return (
            <g key={i} filter={flat?undefined:`url(#${id}sh)`}
              onMouseMove={e=>{setHi(i);setTip({x:e.clientX,y:e.clientY,title:d[x],single:fmt(v)});}}
              onMouseLeave={()=>{setHi(-1);setTip(null);}} style={{cursor:'pointer'}}>
              <g style={{transformOrigin:`${bx+bw/2}px ${baseY}px`,transform:`scaleY(${(m||flat)?1:0.001})`,
                transition:flat?'none':`transform .8s ${i*55}ms cubic-bezier(.2,.85,.3,1)`,opacity:hi<0||on?1:.82}}>
                <polygon points={pts.side} fill={lighten(colAt(i),-44)}/>
                <polygon points={pts.top} fill={lighten(colAt(i),46)}/>
                <rect x={bx} y={by} width={bw} height={bh} fill={flat?colAt(i):`url(#${id}_${i%PAL.length})`} stroke={lighten(colAt(i),-18)} strokeWidth="0.5"/>
              </g>
              {(m||flat)&&v>0&&<text x={bx+bw/2+dx/2} y={by+dy-6} textAnchor="middle" fontSize="11" fontFamily="IBM Plex Mono" fontWeight="600" fill="#16202e">{v}</text>}
              <text x={bx+bw/2} y={height-6} textAnchor="middle" fontSize="9.5" fill="#9aa6b4">{String(d[x]).replace(/ \d{4}| 20\d\d/,'').slice(0,6)}</text>
            </g>
          );
        })}
      </svg>
      {tip}
    </div>
  );
}

/* ---------- Live animated bar monitor (premium dark) ---------- */
function LiveMonitor({title='Live Patient Activity', seed=40, unit='patients/hr', color='#3ddc97'}){
  const N=18;
  const rnd=(b)=>Math.max(2,Math.round(b+(Math.random()-0.45)*b*0.7));
  const [bars,setBars]=React.useState(()=>Array.from({length:N},()=>rnd(seed)));
  const [pulse,setPulse]=React.useState(true);
  React.useEffect(()=>{
    const t=setInterval(()=>{
      setBars(b=>[...b.slice(1), rnd(seed)]);
      setPulse(p=>!p);
    },1100);
    return ()=>clearInterval(t);
  },[seed]);
  const max=Math.max(...bars,1);
  const cur=bars[bars.length-1];
  const avg=Math.round(bars.reduce((a,c)=>a+c,0)/bars.length);
  return (
    <div className="card live-card" style={{padding:0,overflow:'hidden',background:'linear-gradient(160deg,#0d1b2e,#15243a)',border:'1px solid #24344e'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,padding:'14px 16px',borderBottom:'1px solid rgba(255,255,255,.07)'}}>
        <span className="live-dot"/>
        <div style={{color:'#fff',fontSize:13.5,fontWeight:700}}>{title}</div>
        <span style={{fontSize:10,letterSpacing:1,color:'#3ddc97',border:'1px solid #1f6e54',borderRadius:5,padding:'2px 7px',fontWeight:700}}>● LIVE</span>
        <span className="spacer"/>
        <div style={{textAlign:'right'}}>
          <div className="num" style={{color:'#fff',fontSize:22,fontWeight:600,lineHeight:1}}>{cur}</div>
          <div style={{fontSize:10,color:'#7e8da0'}}>{unit}</div>
        </div>
      </div>
      <div style={{display:'flex',alignItems:'flex-end',gap:5,height:128,padding:'16px 16px 14px'}}>
        {bars.map((v,i)=>{
          const last=i===bars.length-1;
          return (
            <div key={i} style={{flex:1,height:`${(v/max)*100}%`,minHeight:3,borderRadius:'4px 4px 2px 2px',
              background:last?`linear-gradient(180deg,${color},#1f9d6b)`:'linear-gradient(180deg,rgba(61,220,151,.55),rgba(61,220,151,.12))',
              boxShadow:last?`0 0 16px ${color}aa`:'none',
              transition:'height .9s cubic-bezier(.3,.8,.3,1), background .3s'}}/>
          );
        })}
      </div>
      <div style={{display:'flex',gap:18,padding:'0 16px 14px',color:'#9fb0c4',fontSize:11}}>
        <span>Avg <b className="num" style={{color:'#fff'}}>{avg}</b></span>
        <span>Peak <b className="num" style={{color:'#fff'}}>{Math.max(...bars)}</b></span>
        <span className="spacer" style={{flex:1}}/>
        <span style={{color:'#6f8198'}}>updated live · 1s</span>
      </div>
    </div>
  );
}

/* ---------- Animated radial gauge (premium) ---------- */
function Gauge({value, max, label, color='#0b66d0', size=150}){
  const m=useMounted(80);
  const r=(size-26)/2, cx=size/2, cy=size/2, C=Math.PI*r; // half circle
  const frac=Math.min(1,value/(max||1));
  return (
    <div style={{position:'relative',textAlign:'center'}}>
      <svg width={size} height={size*0.66} viewBox={`0 0 ${size} ${size*0.66}`}>
        <path d={`M13 ${cy} A ${r} ${r} 0 0 1 ${size-13} ${cy}`} fill="none" stroke="#e8edf3" strokeWidth="13" strokeLinecap="round"/>
        <path d={`M13 ${cy} A ${r} ${r} 0 0 1 ${size-13} ${cy}`} fill="none" stroke={color} strokeWidth="13" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={m?C*(1-frac):C} style={{transition:'stroke-dashoffset 1.1s cubic-bezier(.3,.8,.3,1)'}}/>
      </svg>
      <div style={{position:'absolute',left:0,right:0,top:'42%',transform:'translateY(-50%)'}}>
        <div className="num" style={{fontSize:22,fontWeight:600,color:'var(--ink)',lineHeight:1}}>{fmt(value)}</div>
        <div style={{fontSize:10.5,color:'var(--muted)',marginTop:2}}>{label}</div>
      </div>
    </div>
  );
}

Object.assign(window,{ Bar3D, LiveMonitor, Gauge });
