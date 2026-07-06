/* UNICO — department store: CRUD + custom columns, persisted to localStorage */
(function(){
  const KEY='unico_store_v3';
  const load=()=>{ try{ const s=JSON.parse(localStorage.getItem(KEY)); return s&&typeof s==='object'?s:null; }catch(e){ return null; } };
  const blank=()=>({ custom:[], renames:{}, deleted:[], entries:[], order:[] });

  function recompute(d){
    d.series=d.data.map((row,i)=>({ month:d.months[i], full:window.UNICO.MONTHS_FULL[d.months[i]]||d.months[i], ...row }));
    if(!d.series.length){
      d.total=0; d.latest={}; d.prev=null; d.delta=0; d.peak=0; d.avg=0; return d;
    }
    d.total=d.series.reduce((s,r)=>s+(r[d.primary]||0),0);
    d.latest=d.series[d.series.length-1];
    d.prev=d.series.length>1?d.series[d.series.length-2]:null;
    const cur=d.latest[d.primary]||0, prev=d.prev?(d.prev[d.primary]||0):0;
    d.delta=prev===0?(cur>0?100:0):Math.round(((cur-prev)/prev)*100);
    d.peak=Math.max(...d.series.map(r=>r[d.primary]||0));
    d.avg=Math.round(d.total/d.series.length);
    return d;
  }

  function buildDepts(store){
    const base=window.UNICO.DEPARTMENTS.map(d=>({...d, custom:false, months:[...d.months], data:d.data.map(r=>({...r})), cols:d.cols.map(c=>({...c}))}));
    const custom=(store.custom||[]).map(d=>({...d, custom:true, months:[...(d.months||[])], data:(d.data||[]).map(r=>({...r})), cols:(d.cols||[]).map(c=>({...c}))}));
    // A custom dept later promoted to a REAL dept (CT OT / CT ICU class) exists in BOTH
    // lists under the same id. Never render two copies: the server copy is canonical;
    // fold in any months/cols that still live only in the overlay copy.
    const baseIds=new Set(base.map(d=>d.id));
    custom.filter(d=>baseIds.has(d.id)).forEach(cd=>{
      const bd=base.find(d=>d.id===cd.id);
      (cd.months||[]).forEach((m,i)=>{ if(bd.months.indexOf(m)<0){ bd.months.push(m); bd.data.push({...((cd.data||[])[i]||{})}); } });
      (cd.cols||[]).forEach(c=>{ if(!bd.cols.some(x=>x.id===c.id)) bd.cols.push({...c}); });
    });
    let list=[...base,...custom.filter(d=>!baseIds.has(d.id))].filter(d=>!(store.deleted||[]).includes(d.id));
    // renames / overrides
    list.forEach(d=>{ const r=(store.renames||{})[d.id]; if(r){ Object.assign(d,r); } });
    // explicitly-deleted months (a later entry for the same month re-adds it)
    const removed=store.removed||{};
    list.forEach(d=>{ const rm=removed[d.id]; if(rm&&rm.length){ for(let i=d.months.length-1;i>=0;i--){ if(rm.includes(d.months[i])){ d.months.splice(i,1); d.data.splice(i,1); } } } });
    // entries merge
    const byId=Object.fromEntries(list.map(d=>[d.id,d]));
    (store.entries||[]).forEach(e=>{
      const d=byId[e.dept]; if(!d) return;
      const idx=d.months.indexOf(e.month);
      // An entry with no actual values must not create a new month — an accidental
      // empty save would otherwise add an all-blank row that poisons "latest".
      const hasValue=Object.values(e.row||{}).some(v=>v!==null&&v!==''&&v!==undefined);
      if(idx>=0) d.data[idx]={...d.data[idx],...e.row};
      else if(hasValue) { d.months.push(e.month); d.data.push({...e.row}); }
    });
    // Chronological order AFTER all merging: an overlay entry for an out-of-order month
    // (e.g. a correction) is pushed at the END above, which would otherwise become the
    // false "latest" month everywhere (cards, deltas, charts, report ranges).
    const MO=(window.UNICO&&window.UNICO.MONTH_ORDER)||[];
    list.forEach(d=>{
      const zip=d.months.map((m,i)=>({m,r:d.data[i],k:MO.indexOf(m)})).sort((a,b)=>(a.k<0?1e9:a.k)-(b.k<0?1e9:b.k));
      d.months=zip.map(z=>z.m); d.data=zip.map(z=>z.r);
    });
    // Normalise partially-populated department docs so a missing short / group /
    // primaryLabel never renders blank (e.g. CT OT was added without a short code,
    // which showed as an empty sidebar row).
    list.forEach(d=>{
      if(!d.short||!String(d.short).trim()) d.short=(String(d.name||d.id||'').replace(/[^A-Za-z0-9]+/g,'').slice(0,6))||String(d.id||'').slice(0,6);
      if(!d.group||!String(d.group).trim()) d.group='General';
      if(!d.primaryLabel){ const pc=(d.cols||[]).find(c=>c.id===d.primary)||(d.cols||[])[0]; d.primaryLabel=pc?pc.label:(d.primary||''); }
      if(d.desc==null) d.desc='';
    });
    list.forEach(recompute);
    // ordering
    if(store.order&&store.order.length){
      list.sort((a,b)=>{ const ia=store.order.indexOf(a.id), ib=store.order.indexOf(b.id);
        return (ia<0?999:ia)-(ib<0?999:ib); });
    }
    return list;
  }

  function useDeptStore(){
    const [store,setStore]=React.useState(()=>load()||blank());
    const hist=React.useRef([]);
    const [canUndo,setCanUndo]=React.useState(false);
    // The canonical snapshot (window.UNICO.DEPARTMENTS) is refetched IN PLACE after an
    // approved submission or a tab refocus; the memo below only watches the overlay, so
    // bump on the refresh event or open views keep rendering the page-load data forever.
    const [rev,setRev]=React.useState(0);
    React.useEffect(()=>{ const h=()=>setRev(r=>r+1); window.addEventListener('unico:data-refreshed',h); return ()=>window.removeEventListener('unico:data-refreshed',h); },[]);
    React.useEffect(()=>{ localStorage.setItem(KEY,JSON.stringify(store)); },[store]);
    const depts=React.useMemo(()=>buildDepts(store),[store,rev]);

    // Snapshot the current state before every change so it can be undone.
    const commit=(updater)=>{ hist.current=[...hist.current.slice(-49), store]; setCanUndo(true); setStore(typeof updater==='function'?updater(store):updater); };

    const api={
      depts,
      entries:store.entries||[],
      canUndo,
      addEntry:(e)=>commit(s=>({...s, entries:[...(s.entries||[]), e]})),
      clearEntries:()=>commit(s=>({...s, entries:[]})),
      addDept:(def)=>commit(s=>({...s, custom:[...(s.custom||[]), def], order:[...(s.order||[]), def.id]})),
      updateDept:(id,patch)=>commit(s=>{
        const isCustom=(s.custom||[]).some(d=>d.id===id);
        if(isCustom) return {...s, custom:s.custom.map(d=>d.id===id?{...d,...patch}:d)};
        return {...s, renames:{...(s.renames||{}), [id]:{...(s.renames||{})[id], ...patch}}};
      }),
      deleteDept:(id)=>commit(s=>{
        const isCustom=(s.custom||[]).some(d=>d.id===id);
        if(isCustom) return {...s, custom:s.custom.filter(d=>d.id!==id), entries:(s.entries||[]).filter(e=>e.dept!==id)};
        return {...s, deleted:[...(s.deleted||[]), id]};
      }),
      // Remove a single month's data for a department (built-in or custom).
      deleteMonth:(id,month)=>commit(s=>{
        const isCustom=(s.custom||[]).some(d=>d.id===id);
        const entries=(s.entries||[]).filter(e=>!(e.dept===id&&e.month===month));
        if(isCustom){
          return {...s, entries, custom:s.custom.map(d=>{ if(d.id!==id) return d; const idx=(d.months||[]).indexOf(month); if(idx<0) return d; return {...d, months:d.months.filter((_,i)=>i!==idx), data:(d.data||[]).filter((_,i)=>i!==idx)}; })};
        }
        const removed={...(s.removed||{})}; removed[id]=[...(removed[id]||[]).filter(m=>m!==month), month];
        return {...s, entries, removed};
      }),
      reset:()=>commit(blank()),
      undo:()=>{ const h=hist.current; if(!h.length) return; const prev=h[h.length-1]; hist.current=h.slice(0,-1); setCanUndo(hist.current.length>0); setStore(prev); }
    };
    return api;
  }

  window.useDeptStore=useDeptStore;
  window.buildDepts=buildDepts;
})();
