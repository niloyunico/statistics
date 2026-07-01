/* UNICO — Global command palette (Ctrl/Cmd+K). Self-contained overlay. */
(function(){
const { useState, useEffect, useRef, useMemo } = React;

/* deterministic accent for staff avatars */
const AV_COLORS=[
  ['#3ab5a7','#0090ca'],['#6a52d4','#27a8db'],['#e08a1e','#d23a52'],
  ['#0090ca','#0072a3'],['#1f9d57','#3ab5a7'],['#d23a52','#6a52d4']
];
function initials(name){
  const p=(name||'').trim().split(/\s+/);
  return ((p[0]?.[0]||'')+(p[1]?.[0]||p[0]?.[1]||'')).toUpperCase()||'?';
}
function avColor(seed){
  let h=0; const s=String(seed); for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))>>>0;
  return AV_COLORS[h%AV_COLORS.length];
}
function matches(q, ...fields){
  if(!q) return true;
  const t=q.toLowerCase();
  return fields.some(f=>f&&String(f).toLowerCase().includes(t));
}

const PAGES=[
  {id:'pg-dashboard', label:'Dashboard',        hint:'Overview',         route:{view:'dashboard'}},
  {id:'pg-compare',   label:'Compare',          hint:'Department compare',route:{view:'compare'}},
  {id:'pg-input',     label:'Data Entry',       hint:'Enter statistics', route:{view:'input'}},
  {id:'pg-reports',   label:'Reports',          hint:'Export & print',   route:{view:'reports'}},
  {id:'pg-quality',   label:'Quality',          hint:'Quality indicators',route:{view:'quality'}},
  {id:'pg-nurses',    label:'Nurse Directory',  hint:'Nursing staff',    route:{view:'nurses'}},
  {id:'pg-pca',       label:'PCA Directory',    hint:'Patient care assistants',route:{view:'pca'}},
  {id:'pg-settings',  label:'Settings',         hint:'Configuration',    route:{view:'settings'}},
];

function GlobalSearch({setRoute, depts}){
  // hook must be called unconditionally — component is always mounted.
  const staffStore = window.useStaffStore ? window.useStaffStore() : {staff:[]};
  const allStaff = (staffStore && staffStore.staff) || [];

  const [open,setOpen]=useState(false);
  const [q,setQ]=useState('');
  const [sel,setSel]=useState(0);
  const inputRef=useRef(null);
  const listRef=useRef(null);

  // open via Ctrl/Cmd+K or custom event; Esc closes
  useEffect(()=>{
    function onKey(e){
      const k=(e.key||'').toLowerCase();
      if((e.ctrlKey||e.metaKey)&&k==='k'){ e.preventDefault(); setOpen(o=>!o); }
      else if(k==='escape'){ setOpen(false); }
    }
    function onOpen(){ setOpen(true); }
    window.addEventListener('keydown',onKey);
    window.addEventListener('unico:open-search',onOpen);
    return ()=>{ window.removeEventListener('keydown',onKey); window.removeEventListener('unico:open-search',onOpen); };
  },[]);

  // reset query + focus input each time it opens
  useEffect(()=>{
    if(open){ setQ(''); setSel(0); const id=setTimeout(()=>inputRef.current&&inputRef.current.focus(),20); return ()=>clearTimeout(id); }
  },[open]);

  // build grouped results
  const groups=useMemo(()=>{
    const qd=(depts||[]);
    const qual=(window.QUALITY_SEED||[]).filter(d=>d.indicators&&d.indicators.length);
    const CAP=6;

    const pages=PAGES.filter(p=>matches(q,p.label,p.hint));
    const dList=qd.filter(d=>matches(q,d.name,d.short,d.group)).slice(0,CAP);
    const sList=allStaff.filter(e=>e.is_active!==false &&
      matches(q,e.name,e.role,e.current_department,e.designation,e.emp_id)).slice(0,CAP);
    const qList=qual.filter(d=>matches(q,d.name,d.key,d.overallStatus)).slice(0,CAP);

    const out=[];
    if(pages.length) out.push({
      key:'pages', title:q?'Pages & Actions':'Quick actions', total:pages.length,
      items:pages.map(p=>({id:p.id, kind:'page', label:p.label, sub:p.hint, icon:I.grid, route:p.route}))
    });
    if(dList.length) out.push({
      key:'depts', title:'Departments', total:qd.filter(d=>matches(q,d.name,d.short,d.group)).length,
      items:dList.map(d=>({id:'d-'+d.id, kind:'dept', label:d.name, sub:(d.short||'')+(d.group?' · '+d.group:''),
        icon:(window.DEPT_ICON&&window.DEPT_ICON[d.id])||I.layers, route:{view:'departments',dept:d.id}}))
    });
    if(sList.length) out.push({
      key:'staff', title:'Staff', total:allStaff.filter(e=>e.is_active!==false&&matches(q,e.name,e.role,e.current_department,e.designation,e.emp_id)).length,
      items:sList.map(e=>({id:'s-'+e.id, kind:'staff', label:e.name,
        sub:[e.role,e.designation,e.current_department].filter(Boolean).join(' · '),
        avatar:e.name, route:{view:'staffProfile',emp:e.id}}))
    });
    if(qList.length) out.push({
      key:'quality', title:'Quality departments', total:qual.filter(d=>matches(q,d.name,d.key,d.overallStatus)).length,
      items:qList.map(d=>({id:'q-'+d.key, kind:'quality', label:d.name,
        sub:(d.overallStatus?d.overallStatus+' · ':'')+(d.indicators.length+' indicators'),
        icon:I.heart, route:{view:'quality',qview:'reports',dept:d.key}}))
    });
    return out;
  },[q,depts,allStaff]);

  // flat list for keyboard navigation
  const flat=useMemo(()=>{ const f=[]; groups.forEach(g=>g.items.forEach(it=>f.push(it))); return f; },[groups]);

  useEffect(()=>{ if(sel>flat.length-1) setSel(Math.max(0,flat.length-1)); },[flat.length,sel]);

  function activate(item){
    if(!item) return;
    setOpen(false);
    setRoute(item.route);
  }

  function onListKey(e){
    const k=(e.key||'').toLowerCase();
    if(k==='arrowdown'){ e.preventDefault(); setSel(s=>Math.min(flat.length-1,s+1)); }
    else if(k==='arrowup'){ e.preventDefault(); setSel(s=>Math.max(0,s-1)); }
    else if(k==='enter'){ e.preventDefault(); activate(flat[sel]); }
  }

  // keep highlighted row in view
  useEffect(()=>{
    if(!open||!listRef.current) return;
    const node=listRef.current.querySelector('[data-idx="'+sel+'"]');
    if(node&&node.scrollIntoView) node.scrollIntoView({block:'nearest'});
  },[sel,open]);

  if(!open) return null;

  let idx=-1;
  return (
    <div className="gs-backdrop" onMouseDown={e=>{ if(e.target===e.currentTarget) setOpen(false); }}>
      <div className="gs-palette" role="dialog" aria-label="Global search" onKeyDown={onListKey}>
        <div className="gs-input">
          <Ic d={I.search} s={18} c="var(--muted)"/>
          <input ref={inputRef} value={q} onChange={e=>{setQ(e.target.value);setSel(0);}}
            placeholder="Search departments, staff, quality…" spellCheck={false}/>
          <span className="gs-kbd">Esc</span>
        </div>
        <div className="gs-results" ref={listRef}>
          {flat.length===0 ? (
            <div className="gs-empty">No matches for “{q}”.</div>
          ) : groups.map(g=>(
            <div key={g.key} className="gs-group">
              <div className="gs-group-h"><span>{g.title}</span><span className="gs-count num">{g.total}</span></div>
              {g.items.map(it=>{
                idx++; const i=idx; const active=i===sel;
                const col=it.avatar?avColor(it.avatar):null;
                return (
                  <div key={it.id} data-idx={i} className={'gs-row'+(active?' active':'')}
                    onMouseEnter={()=>setSel(i)} onMouseDown={e=>{e.preventDefault();activate(it);}}>
                    {it.avatar
                      ? <div className="avatar gs-av" style={{background:`linear-gradient(135deg,${col[0]},${col[1]})`}}>{initials(it.avatar)}</div>
                      : <div className="gs-ic"><Ic d={it.icon||I.arrowR} s={17}/></div>}
                    <div className="gs-text">
                      <div className="gs-label">{it.label}</div>
                      {it.sub&&<div className="gs-sub">{it.sub}</div>}
                    </div>
                    {active&&<span className="gs-enter"><Ic d={I.arrowR} s={14} c="var(--blue)"/></span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="gs-foot">
          <span className="gs-tip"><span className="gs-kbd">↑</span><span className="gs-kbd">↓</span> navigate · <span className="gs-kbd">↵</span> open</span>
          <span className="gs-tip">{q?`${flat.length} result${flat.length===1?'':'s'}`:'Type to search · Esc to close'}</span>
        </div>
      </div>
    </div>
  );
}

window.GlobalSearch = GlobalSearch;
})();
