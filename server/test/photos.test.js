const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

async function persistence() {
  let fail = false, matched = true, accountMatched = true;
  const writes = [], routes = {};
  const collection = { updateOne: async (filter, update, opts) => {
    if (fail) throw new Error('Database unavailable');
    writes.push({ filter, update, opts });
    return { matchedCount: matched ? 1 : 0, upsertedCount: opts && opts.upsert ? 1 : 0 };
  } };
  const deps = {
    './storage': { status: () => ({ configured: true }), uploadBuffer: async () => ({url:'https://example.test/photo.jpg',publicId:'unico/staff/new',bytes:10}) },
    './activity-log': { record() {}, actorOf: () => ({}), ipOf: () => '' },
    './access': { forRequest: async () => ({unrestricted:true}) },
    './cache': { bump: async () => {} },
    './db': { getDbHandle: async () => ({collection:() => collection}),
      getUsers: async () => ({findOne:async () => null,updateOne:async () => ({matchedCount:accountMatched?1:0})}) },
    './staff-roster': { staffIdFilter: id => id == null ? null : {id}, loadRoster: async () => [{id:7,name:'Saved nurse'}] },
  };
  const ctx = {require: name => deps[name], module:{exports:{}}, Buffer, Date};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../photos.js'),'utf8'),ctx);
  ctx.module.exports.mount({post:(p,...f) => routes['POST '+p]=f.at(-1),delete(){},get(){}});
  async function upload(body) {
    const res = {code:200,status(n){this.code=n;return this;},json(j){this.body=j;return this;}};
    await routes['POST /api/upload']({user:{sub:'nurse'},body:{kind:'staff',image:'data:image/jpeg;base64,YQ==',...body}},res);
    return res;
  }
  assert.equal((await upload({staffId:7})).body.ok,true);
  fail=true;
  assert.equal((await upload({staffId:7})).code,500,'failed persistence must not announce success');
  fail=false;matched=false;
  assert.equal((await upload({staffId:7})).body.ok,true,'overlay-only staff get a durable photo document');
  assert.equal(writes.at(-1).filter.id,7);
  assert.equal(writes.at(-1).opts.upsert,true);
  assert.equal((await upload({staffId:99})).code,500,'unknown record cannot silently accept a photo');
  assert.equal((await upload({})).body.ok,true,'new form can upload before its first save');
  accountMatched=false;
  assert.equal((await upload({kind:'profile'})).code,500,'missing account cannot report a saved photo');
}

function recovery() {
  let state=0, cursor=0, pending=[], timer;
  const deps=[], cleanups=[], events={};
  const ctx={module:{exports:{}},URL,window:{addEventListener:(n,f)=>events[n]=f,removeEventListener:n=>delete events[n]},
    setTimeout:f=>{timer=f;return 1;},clearTimeout:()=>{timer=null;},
    React:{useState:()=>[state,v=>{state=typeof v==='function'?v(state):v;}],
      useEffect:(fn,values)=>{const i=cursor++;if(!deps[i]||values.some((v,j)=>v!==deps[i][j])){deps[i]=values;pending.push(()=>{if(cleanups[i])cleanups[i]();cleanups[i]=fn();});}}}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../renderer/unico/mockup-ui.js'),'utf8'),ctx);
  const url='https://res.cloudinary.com/demo/image/upload/v1/portrait.jpg';
  function render(src=url){cursor=0;const image=ctx.module.exports.usePhoto(src,34);const effects=pending;pending=[];effects.forEach(f=>f());return image;}
  let image=render();assert.notEqual(image.src,url);
  image.onError();image=render();assert.equal(image.src,url,'failed derivative falls back to original');
  image.onError();image=render();assert.equal(image.failed,true);assert.equal(typeof timer,'function');
  timer();image=render();assert.equal(image.failed,false,'transient failure retries');
  image.onError();image=render();assert.equal(image.failed,true);assert.equal(timer,null,'retries are bounded');
  events.online();image=render();assert.equal(image.failed,false,'network restoration retries photo');
  image.onError();image.onError();render(url+'new');image=render(url+'new');
  assert.equal(image.failed,false,'replacing photo resets previous failure');
  render('https://example.test/photo.jpg');image=render('https://example.test/photo.jpg');
  image.onError();image=render('https://example.test/photo.jpg');
  assert.equal(image.failed,true);assert.equal(typeof timer,'function','original-only URLs also schedule recovery');
  const ik='https://ik.imagekit.io/demo/portrait.jpg';
  assert.equal(new URL(ctx.module.exports.cdnPhoto(ik,34)).searchParams.get('tr'),'w-96,h-96,q-80');
  assert.equal(new URL(ctx.module.exports.cdnPhoto(ik,96,'fit')).searchParams.get('tr'),'w-320,c-at_max,q-80');
}

persistence().then(()=>{recovery();console.log('Photo persistence and recovery tests passed');}).catch(e=>{console.error(e);process.exitCode=1;});
