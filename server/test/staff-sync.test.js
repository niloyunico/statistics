const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = name => fs.readFileSync(path.join(__dirname,'../../renderer/unico',name),'utf8');
const key = 'unico_staff_v3';
const old = [{id:1,name:'Old',role:'Nurse',is_active:true}];
const latest = [...old.map(x=>({...x,name:'Updated'})),{id:2,name:'Added',role:'Nurse',is_active:true}];

async function bridgeTest() {
  let local = {[key]:JSON.stringify(old),unico_store_v3:'old stats'};
  const calls=[];
  const w = {__UNICO_SNAPSHOT__:{...local},unicoSnapshotAll:()=>({...local})};
  let release, hold=false;
  const success={ok:true,status:200,json:async()=>({ok:true})};
  const ctx={window:w,document:{},setTimeout,console,fetch:async(url,opts)=>{
    calls.push(JSON.parse(opts.body));
    if(hold){hold=false;return new Promise(resolve=>release=()=>resolve(success));}
    return success;
  }};
  vm.runInNewContext(read('web-native.js'),ctx);
  await w.unicoNative.persist(local);
  assert.equal(calls.length,0,'mount is not a save');
  local.unico_store_v3='edited stats';
  await w.unicoNative.persist(local);
  assert.deepEqual(calls[0],{partial:true,data:{unico_store_v3:'edited stats'},removed:[]},'unrelated save cannot overwrite stale staff');
  local[key]=JSON.stringify(latest);
  w.unicoNative.acceptSnapshot({[key]:local[key]});
  await w.unicoNative.persist(local);
  assert.equal(calls.length,1,'remote roster is not echoed back');
  local[key]=JSON.stringify([{...latest[0],name:'My edit'}]);
  await w.unicoNative.persist(local);
  assert.deepEqual(Object.keys(calls[1].data),[key]);
  assert.equal(calls[1].staffBase,JSON.stringify(latest),'staff writes include the browser baseline for field merging');
  delete local.unico_store_v3;
  await w.unicoNative.persist(local);
  assert.deepEqual(calls[2].removed,['unico_store_v3']);
  hold=true;local[key]='[{"id":1,"name":"First edit"}]';
  const first=w.unicoNative.persist({...local});await new Promise(setImmediate);
  local[key]='[{"id":1,"name":"Second edit"}]';
  const second=w.unicoNative.persist({...local});await new Promise(setImmediate);
  assert.equal(calls.length,4,'a second save waits for the first');
  release();await Promise.all([first,second]);
  assert.equal(calls[4].data[key],local[key],'latest edit is saved after an older in-flight save');
}

async function formSaveTest() {
  const source=read('staff-profile.jsx');
  const start=source.indexOf('  const save=async()=>',source.indexOf('function StaffForm('));
  const end=source.indexOf('  // The overlay owns the route change',start);
  let created=0,updated=0,confirmed=0,accept=false;
  const ctx={
    f:{name:'New nurse',role:'Nurse',extracurricular:'Singing'},entries:[],directPrior:0,
    S:{unicoYearsOf:()=>0,fmtYM:()=>''},entYears:()=>0,initialForm:{current:{}},
    pendingId:{current:null},saveLock:{current:false},chipsOf:()=>[],
    setErr:()=>{},setSaving:()=>{},setSaved:()=>{confirmed++;},
    store:{create:()=>{created++;return 7;},update:()=>{updated++;}},
    window:{unicoFlushNow:async()=>({ok:accept,error:'Offline'})},
  };
  vm.runInNewContext(source.slice(start,end)+'\nthis.save=save;',ctx);
  await ctx.save();assert.equal(confirmed,0,'failed database save must not show success');
  assert.equal(created,1);
  accept=true;await ctx.save();assert.equal(confirmed,1);
  assert.equal(created,1,'retry must not create a duplicate nurse');assert.equal(updated,1);
}

async function storeTest() {
  const storage = new Map([[key,JSON.stringify(old)]]);
  let writes=0, fetches=0, cursor=0, effects=[], interval, response=latest, resolveFetch;
  const cells=[], deps=[];
  const events={};
  const w = {STAFF_SEED:old,__UNICO_STAFF__:old,unicoCan:()=>true,
    unicoFlushNow:async()=>({ok:true}),
    unicoApplyRemoteData:data=>Object.entries(data).forEach(([k,v])=>storage.set(k,v)),
    addEventListener:(name,fn)=>events[name]=fn, removeEventListener:()=>{}};
  const doc={visibilityState:'hidden',addEventListener:()=>{},removeEventListener:()=>{}};
  const react={
    useState(initial){const i=cursor++;if(!(i in cells))cells[i]=typeof initial==='function'?initial():initial;return [cells[i],v=>{cells[i]=typeof v==='function'?v(cells[i]):v;}];},
    useRef(value){const i=cursor++;return cells[i]||(cells[i]={current:value});},
    useEffect(fn,values){const i=cursor++;if(!deps[i]||values.some((v,n)=>v!==deps[i][n])){deps[i]=values;effects.push(fn);}},
  };
  const ctx={window:w,React:react,document:doc,console,
    localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>{writes++;storage.set(k,v);}},
    setInterval:fn=>{interval=fn;return 1;},clearInterval:()=>{},
    fetch:async()=>{fetches++;if(response==='pending')return new Promise(resolve=>resolveFetch=resolve);if(response==='error')throw new Error('Offline');return {ok:true,json:async()=>({ok:true,staff:response})};},
  };
  vm.runInNewContext(read('staff-data.js'),ctx);
  function render(){cursor=0;const store=w.useStaffStore();const run=effects;effects=[];run.forEach(fn=>fn());return store;}
  let store=render();
  assert.equal(writes,0,'opening the app does not save the stale roster');
  await store.refresh();store=render();
  assert.equal(store.staff.length,2);assert.equal(store.staff[0].name,'Updated');
  assert.equal(writes,0,'refreshing is read-only');
  response='pending';const inFlight=store.refresh();await new Promise(setImmediate);
  store.update(1,{name:'My unsaved edit'});
  resolveFetch({ok:true,json:async()=>({ok:true,staff:latest})});await inFlight;store=render();
  assert.equal(store.staff[0].name,'My unsaved edit','slow refresh does not discard newer local edits');
  response='error';await store.refresh();store=render();
  assert.equal(store.staff.length,2);assert(store.refreshError);
  response=[];await store.refresh();store=render();
  assert.equal(store.staff.length,0,'empty server roster stays empty');
  doc.visibilityState='visible';response=latest;interval();await store.refresh();store=render();
  assert.equal(store.staff.length,2,'polling updates the rendered store');
  const before=fetches;w.unicoCan=()=>false;await store.refresh();assert.equal(fetches,before,'no staff access makes no roster request');
}

(async()=>{await bridgeTest();await storeTest();await formSaveTest();console.log('STAFF_SYNC_TEST_PASS: refresh, polling, local edits, failures, empty lists, partial saves and database confirmation');})().catch(e=>{console.error(e);process.exitCode=1;});
