const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const express = require('express');
const { Webhook } = require('standardwebhooks');

async function adapter() {
  const file = {fileId:'abc123',filePath:'/unico/staff/test.png',name:'test.png',url:'https://ik.imagekit.io/demo/unico/staff/test.png',fileType:'image',size:100};
  let deleted=0, params;
  class FakeImageKit {
    constructor() { this.files={ upload:async p=>{params=p;return file;},get:async()=>file,delete:async()=>{deleted++;} };
      this.assets={list:async p=>{params=p;return [file];}}; }
    static async toFile(buf,name){return {buf,name};}
  }
  const context={module:{exports:{}},Buffer,process:{env:{IMAGEKIT_PRIVATE_KEY:'test'}},
    require:n=>n==='@imagekit/nodejs'?FakeImageKit:require(n)};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../storage-imagekit.js'),'utf8'),context);
  const s=context.module.exports;
  const up=await s.uploadBuffer(Buffer.from([137,80,78,71,13,10,26,10]),{folder:'unico/staff'});
  assert.equal(up.publicId,'unico/staff/imagekit_abc123');assert.equal(params.folder,'/unico/staff');
  assert.equal(up.url,file.url);assert.equal(up.bytes,100);
  await assert.rejects(s.uploadBuffer(Buffer.from('not an image')));
  assert.equal((await s.deleteByPublicId('unico/profiles/imagekit_abc123')).ok,false);
  assert.equal(deleted,0,'forged folder must never authorize deletion');
  assert.equal((await s.deleteByPublicId(up.publicId)).ok,true);assert.equal(deleted,1);
  const page=await s.listAssets({folder:'unico/staff',resourceType:'image',limit:1,cursor:'2'});
  assert.equal(params.skip,2);assert.equal(params.path,'/unico/staff');assert.equal(page.cursor,'3');
  assert.equal(page.assets[0].publicId,up.publicId,'library and uploads share durable asset ids');
}

async function webhook() {
  const activityPath=require.resolve('../activity-log');
  let recorded=0;
  require.cache[activityPath]={id:activityPath,filename:activityPath,loaded:true,exports:{record:async()=>{recorded++;}}};
  process.env.IMAGEKIT_WEBHOOK_SECRET='whsec_test-signing-secret';
  const app=express();require('../imagekit-webhook').mount(app);app.use(express.json());
  const server=app.listen(0,'127.0.0.1');await require('node:events').once(server,'listening');
  try {
    const url='http://127.0.0.1:'+server.address().port+'/api/webhooks/imagekit';
    const body=JSON.stringify({id:'evt_test',type:'file.created',data:{fileId:'abc123'}});
    const signer=new Webhook(Buffer.from(process.env.IMAGEKIT_WEBHOOK_SECRET).toString('base64'));
    const now=new Date(), id='msg_test';
    const headers={'content-type':'application/json','webhook-id':id,'webhook-timestamp':String(Math.floor(now.getTime()/1000)),
      'webhook-signature':signer.sign(id,now,body)};
    assert.equal((await fetch(url,{method:'POST',headers,body})).status,200);
    assert.equal(recorded,1);
    assert.equal((await fetch(url,{method:'POST',headers,body:body+' '})).status,401,'body tampering rejected');
    const old=new Date(Date.now()-600000);
    assert.equal((await fetch(url,{method:'POST',headers:{...headers,'webhook-timestamp':String(Math.floor(old.getTime()/1000)),
      'webhook-signature':signer.sign(id,old,body)},body})).status,401,'expired signatures rejected');
    assert.equal((await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body})).status,401);
    delete process.env.IMAGEKIT_WEBHOOK_SECRET;
    assert.equal((await fetch(url,{method:'POST',headers,body})).status,503,'missing secret fails closed');
    assert.equal(recorded,1);
  } finally {server.close();server.closeAllConnections();}
}
adapter().then(webhook).then(()=>console.log('ImageKit adapter and signed webhook tests passed')).catch(e=>{console.error(e);process.exitCode=1;});
