/* System Monitor — Settings → System Monitor (administrators).
   Server side: server/monitor.js. Two jobs:

   1. SAVE-FAILURE REPORTER (every signed-in browser). A save the database refused, or
      never received, used to show only a red banner in that one person's browser — the
      administrator heard about it days later as "my data is missing". The page bridge
      calls window.unicoNative.persist() for every save; this wraps it and reports each
      {ok:false} result to POST /api/monitor/event. When the report itself cannot be sent
      (offline), it waits in this browser under a key the page bridge never syncs
      (no `unico_` prefix) and is sent with its original time once the network is back.

   2. THE PANEL: database health, the daily "did anything go missing?" check with the
      names of what went missing, save problems reported by browsers, and the trend. */

(function installSaveFailureReporter(){
  const n=window.unicoNative;
  if(!n||typeof n.persist!=='function'||n.__monitorWrapped) return;
  const QUEUE='uncmon_pending_v1';
  const recent={};
  const read=()=>{ try{ const q=JSON.parse(localStorage.getItem(QUEUE)); return Array.isArray(q)?q:[]; }catch(e){ return []; } };
  const write=(q)=>{ try{ localStorage.setItem(QUEUE,JSON.stringify(q.slice(-20))); }catch(e){} };
  const send=(ev)=>fetch('/api/monitor/event',{method:'POST',credentials:'same-origin',
    headers:{'content-type':'application/json'},body:JSON.stringify(ev)})
    .then(r=>{ if(r.status>=500||r.status===0) throw new Error('retry'); return true; });
  const flush=()=>{ const q=read(); if(!q.length) return; write([]);
    q.reduce((p,ev)=>p.then(()=>send(ev)).catch(()=>{ write(read().concat([ev])); }),Promise.resolve()); };
  const report=(r)=>{
    const detail=String((r&&r.error)||'The database did not confirm the save.');
    // An expired session cannot report anything — its own banner already sends the person to sign in.
    if(/session expired/i.test(detail)) return;
    const kind=r&&r.conflict?'save_conflict':r&&r.forbidden?'save_forbidden':'save_failed';
    const sig=kind+'|'+detail; const now=Date.now();
    if(recent[sig]&&now-recent[sig]<120000) return;       // retries of one failure are one event
    recent[sig]=now;
    const ev={kind,detail,keys:(r&&Array.isArray(r.conflicted))?r.conflicted:[],page:location.pathname+location.hash,at:now};
    send(ev).catch(()=>write(read().concat([ev])));
  };
  // The page bridge holds this SAME object and calls n.persist(...).then(clearDirty).
  // Hand back the ORIGINAL promise untouched: its value decides whether unsaved edits
  // stay marked dirty, and a rejection must still reach the bridge. The report rides a
  // separate branch that can neither alter nor swallow the result.
  const orig=n.persist;
  n.persist=function(){
    const p=orig.apply(this,arguments);
    try{ Promise.resolve(p).then(r=>{ if(r&&r.ok===false) report(r); },()=>{}); }catch(e){}
    return p;
  };
  n.__monitorWrapped=true;
  window.addEventListener('online',flush);
  setTimeout(flush,5000);
})();

function SystemMonitor(){
  const [d,setD]=React.useState(null);
  const [err,setErr]=React.useState('');
  const [busy,setBusy]=React.useState(false);
  const [running,setRunning]=React.useState(false);
  const [open,setOpen]=React.useState({});
  const load=React.useCallback(()=>{
    setBusy(true); setErr('');
    fetch('/api/monitor/status',{credentials:'same-origin',cache:'no-store'})
      .then(r=>r.json()).then(j=>{ if(j&&j.ok) setD(j); else setErr((j&&j.error)||'Could not load the monitor.'); })
      .catch(()=>setErr('Could not reach the server.')).finally(()=>setBusy(false));
  },[]);
  React.useEffect(()=>{ load(); },[load]);
  const runNow=()=>{
    setRunning(true); setErr('');
    fetch('/api/monitor/run',{method:'POST',credentials:'same-origin'})
      .then(r=>r.json()).then(j=>{ if(!j||!j.ok) setErr((j&&j.error)||'The check failed.'); load(); })
      .catch(()=>setErr('Could not reach the server.')).finally(()=>setRunning(false));
  };

  const when=(t)=>t?new Date(t).toLocaleString([], {day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'—';
  const ago=(t)=>{ if(!t) return 'never'; const h=Math.round((Date.now()-t)/36e5); return h<1?'within the hour':h<48?h+' h ago':Math.round(h/24)+' days ago'; };
  const GOOD='#157a43', WARN='#b5670a', BAD='#b4232f';
  const tile=(label,val,sub,color)=>(
    <div key={label} style={{background:'var(--panel-2)',borderRadius:9,padding:'10px 13px',minWidth:120,flex:'1 1 120px'}}>
      <div style={{fontSize:10,fontWeight:700,letterSpacing:.5,textTransform:'uppercase',color:'var(--muted)'}}>{label}</div>
      <div className="num" style={{fontSize:19,fontWeight:800,color:color||'var(--ink)',marginTop:2}}>{val}</div>
      {sub&&<div style={{fontSize:10.5,color:'var(--faint)',marginTop:1}}>{sub}</div>}
    </div>
  );
  const pill=(text,color)=>(
    <span style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:11.5,fontWeight:700,padding:'4px 11px',borderRadius:15,color,background:color+'1f'}}>
      <i style={{width:7,height:7,borderRadius:'50%',background:color}}/>{text}
    </span>
  );
  const levelColor=(l)=>l==='alert'?BAD:WARN;
  const card=(title,sub,body,extra)=>(
    <div className="card" style={{marginBottom:14}}><div className="card-b">
      <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',marginBottom:12}}>
        <div style={{flex:1,minWidth:180}}>
          <div style={{fontSize:13.5,fontWeight:700,color:'var(--ink)'}}>{title}</div>
          {sub&&<div style={{fontSize:11.5,color:'var(--muted)'}}>{sub}</div>}
        </div>
        {extra}
      </div>
      {body}
    </div></div>
  );

  if(err&&!d) return card('System Monitor',null,<div style={{fontSize:12.5,color:'var(--rose)',fontWeight:600}}>{err}</div>,<button className="btn sm" onClick={load}>Retry</button>);
  if(!d) return card('System Monitor',null,<div style={{fontSize:12.5,color:'var(--faint)',padding:14,textAlign:'center'}}>Loading…</div>);

  const h=d.health||{}, latest=d.latest, history=d.history||[], events=d.events||[];
  const alerts=(latest&&latest.alerts)||0;
  const checkStale=!latest||(Date.now()-latest.at)>36*36e5;
  const recentEvents=events.filter(e=>Date.now()-e.at<7*864e5);
  const overall=(d.config||[]).some(x=>x.level==='alert')||alerts>0?['Needs attention',BAD]
    :(recentEvents.length||checkStale)?['Check the notes below',WARN]:['All clear',GOOD];

  const findingRow=(x,i,at)=>{
    const k=(at||0)+':'+i;
    return (
      <div key={k} style={{borderLeft:'3px solid '+levelColor(x.level),background:'var(--panel-2)',borderRadius:7,padding:'8px 11px'}}>
        <div style={{display:'flex',gap:8,alignItems:'baseline',flexWrap:'wrap'}}>
          <span style={{fontSize:10,fontWeight:800,letterSpacing:.5,textTransform:'uppercase',color:levelColor(x.level)}}>{x.level}</span>
          <span style={{fontSize:10.5,color:'var(--muted)'}}>{x.area}{at?' · '+when(at):''}</span>
        </div>
        <div style={{fontSize:12.5,color:'var(--ink)',marginTop:2}}>{x.message}</div>
        {x.details&&x.details.length>0&&(
          <div style={{marginTop:4}}>
            <button className="btn sm" style={{fontSize:11,padding:'2px 8px'}} onClick={()=>setOpen(o=>Object.assign({},o,{[k]:!o[k]}))}>
              {open[k]?'Hide':'Show'} {x.details.length} name{x.details.length>1?'s':''}
            </button>
            {open[k]&&<div style={{fontSize:11.5,color:'var(--ink-2)',marginTop:4,lineHeight:1.6}}>{x.details.join(' · ')}</div>}
          </div>
        )}
      </div>
    );
  };
  const olderFindings=history.slice(1).flatMap(s=>(s.findings||[]).filter(x=>x.area!=='configuration').map((x,i)=>({x,i,at:s.at})));
  const kindLabel={save_failed:'Save failed',save_conflict:'Save conflict',save_forbidden:'Not permitted',save_unconfirmed:'Not confirmed'};

  return (
    <React.Fragment>
      {card('System Monitor','Checks every day that nothing saved has gone missing, and collects save problems from every browser.',
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {err&&<div style={{fontSize:12.5,color:'var(--rose)',fontWeight:600}}>{err}</div>}
          {(d.config||[]).map((x,i)=>findingRow(x,i))}
          <div style={{display:'flex',gap:9,flexWrap:'wrap'}}>
            {tile('Database',h.dbMs!=null?h.dbMs+' ms':'—','reachable now',h.dbMs>2000?WARN:GOOD)}
            {tile('Databases in use',h.singleDatabase?'One':'Two',h.singleDatabase?'no split possible':'failover is on',h.singleDatabase?GOOD:BAD)}
            {tile('Redis',h.redisConfigured?'Configured':'Off',h.redisConfigured?'not expected':'as intended',h.redisConfigured?WARN:GOOD)}
            {tile('Last daily check',latest?ago(latest.at):'never',latest?when(latest.at):'run one now',checkStale?WARN:GOOD)}
            {tile('Backups',h.backup===undefined?'Not set up':h.backup===null?'None yet':(h.backup.ok?ago(h.backup.at):'Failed'),h.backup&&h.backup.at?when(h.backup.at):'',h.backup&&h.backup.ok?GOOD:WARN)}
            {tile('Keep-alive',ago(h.lastKeepalive),'database kept awake',h.lastKeepalive&&Date.now()-h.lastKeepalive<50*36e5?GOOD:WARN)}
          </div>
        </div>,
        <React.Fragment>
          {pill(overall[0],overall[1])}
          <button className="btn sm" onClick={load} disabled={busy}>{busy?'Loading…':'Refresh'}</button>
          <button className="btn pri sm" onClick={runNow} disabled={running}>{running?'Checking…':'Run check now'}</button>
        </React.Fragment>
      )}

      {card('Did anything go missing?',
        latest?('Compared with the previous check'+(history[1]?' on '+when(history[1].at):'')+'. A deliberate deletion also appears here — the Activity Log shows who made it.'):'No check has run yet. Run one now; the next one will compare against it.',
        latest?(
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {latest.findings.filter(x=>x.area!=='configuration').length===0
              ?<div style={{fontSize:12.5,color:GOOD,fontWeight:600,background:'rgba(31,157,87,.08)',borderRadius:7,padding:'9px 12px'}}>✓ Nothing went missing since the previous check.</div>
              :latest.findings.filter(x=>x.area!=='configuration').map((x,i)=>findingRow(x,i,latest.at))}
            {olderFindings.length>0&&<div style={{fontSize:11,fontWeight:700,color:'var(--muted)',marginTop:6,textTransform:'uppercase',letterSpacing:.5}}>Earlier checks</div>}
            {olderFindings.slice(0,20).map(({x,i,at})=>findingRow(x,i,at))}
            <div style={{display:'flex',gap:9,flexWrap:'wrap',marginTop:6}}>
              {tile('Staff records',latest.staff.rows==null?'—':latest.staff.rows,(latest.staff.active||0)+' active · '+(latest.staff.former||0)+' previous')}
              {tile('With activities',latest.staff.filled.extracurricular||0,'extracurricular filled')}
              {tile('Submissions',latest.submissions.total||0,Object.entries(latest.submissions.byStatus||{}).map(([k,v])=>v+' '+k).join(' · '))}
              {tile('Statistics values',latest.statisticsValues,'across departments')}
              {tile('Quality readings',latest.qualityReadings,'across departments')}
            </div>
          </div>
        ):null
      )}

      {card('Save problems from browsers',
        'Every save the database refused or never received, reported by the browser it happened in (last 30 days).',
        events.length===0
          ?<div style={{fontSize:12.5,color:GOOD,fontWeight:600,background:'rgba(31,157,87,.08)',borderRadius:7,padding:'9px 12px'}}>✓ No failed saves reported.</div>
          :<div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead><tr style={{textAlign:'left',color:'var(--muted)',fontSize:10.5,textTransform:'uppercase',letterSpacing:.4}}>
                <th style={{padding:'6px 8px'}}>When</th><th style={{padding:'6px 8px'}}>Who</th><th style={{padding:'6px 8px'}}>What</th><th style={{padding:'6px 8px'}}>Details</th><th style={{padding:'6px 8px'}}>Screen</th>
              </tr></thead>
              <tbody>{events.slice(0,100).map((e,i)=>(
                <tr key={i} style={{borderTop:'1px solid var(--line-2)'}}>
                  <td style={{padding:'6px 8px',whiteSpace:'nowrap'}}>{when(e.happenedAt||e.at)}</td>
                  <td style={{padding:'6px 8px'}}>{e.name||e.username}</td>
                  <td style={{padding:'6px 8px',color:e.kind==='save_conflict'?WARN:BAD,fontWeight:700,whiteSpace:'nowrap'}}>{kindLabel[e.kind]||e.kind}</td>
                  <td style={{padding:'6px 8px',color:'var(--ink-2)'}}>{e.detail}{e.keys&&e.keys.length?' ('+e.keys.join(', ')+')':''}</td>
                  <td style={{padding:'6px 8px',color:'var(--muted)'}}>{e.page}</td>
                </tr>))}</tbody>
            </table>
          </div>,
        events.length?pill(recentEvents.length+' this week',recentEvents.length?WARN:GOOD):null
      )}

      {history.length>1&&card('Trend','One row per daily check, newest first.',
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead><tr style={{textAlign:'left',color:'var(--muted)',fontSize:10.5,textTransform:'uppercase',letterSpacing:.4}}>
              {['Checked','Alerts','Staff','With activities','Submissions','Statistics values','Quality readings'].map(x=><th key={x} style={{padding:'6px 8px'}}>{x}</th>)}
            </tr></thead>
            <tbody>{history.map((s,i)=>(
              <tr key={i} style={{borderTop:'1px solid var(--line-2)'}}>
                <td style={{padding:'6px 8px',whiteSpace:'nowrap'}}>{when(s.at)}</td>
                <td style={{padding:'6px 8px',color:s.alerts?BAD:GOOD,fontWeight:700}}>{s.alerts||0}</td>
                <td style={{padding:'6px 8px'}}>{s.staffRows}</td><td style={{padding:'6px 8px'}}>{s.activities}</td>
                <td style={{padding:'6px 8px'}}>{s.submissions}</td><td style={{padding:'6px 8px'}}>{s.statisticsValues}</td><td style={{padding:'6px 8px'}}>{s.qualityReadings}</td>
              </tr>))}</tbody>
          </table>
        </div>
      )}
    </React.Fragment>
  );
}

window.SystemMonitor=SystemMonitor;
