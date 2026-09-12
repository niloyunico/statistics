process.env.MONGODB_URI = '';
process.env.REQUIRE_AUTH = 'true';
process.env.JWT_SECRET = 'staff-roster-test-secret';
process.env.REDIS_URL = '';
process.env.REDIS_REST_URL = '';
const assert = require('node:assert/strict');
const { once } = require('node:events');
const db = require('../db');
const auth = require('../auth');
const { resolveRoster } = require('../staff-roster');

(async () => {
  const imported = [{id:1,name:'Old name',role:'Nurse',is_active:true,current_department:'MICU'}, {id:2,name:'Removed'}];
  const updated = [{...imported[0],name:'Updated nurse'}, {id:3,name:'New nurse',role:'Nurse',is_active:true,current_department:'CCU'}];
  assert.deepEqual(resolveRoster({unico_staff_v3:JSON.stringify(updated)}, imported), updated);
  assert.deepEqual(resolveRoster({unico_staff_v3:'[]'}, imported), [], 'empty saved roster must not resurrect imports');
  assert.deepEqual(resolveRoster({}, imported), imported);
  assert.throws(() => resolveRoster({unico_staff_v3:'{}'}, imported));
  const verified = [{...imported[0],photo:{url:'photo'},licence_verified:{at:'2026-09-01'},licence_no:'123'}];
  const resolved = resolveRoster({unico_staff_v3:JSON.stringify(updated)},verified);
  assert.equal(resolved[0].name,'Updated nurse');
  assert.equal(resolved[0].photo.url,'photo');
  assert.equal(resolved[0].licence_no,'123');

  const users = await db.getUsers();
  const accounts = [
    {username:'staff-reader',role:'User',roleTemplate:'nurse-management',perms:{staff:['view']},staffScope:'all'},
    {username:'staff-editor',role:'User',perms:{staff:['view','edit','add']},staffScope:'all'},
    {username:'staff-scoped',role:'User',perms:{staff:['view']},staffScope:'departments',departments:['micu']},
    {username:'staff-denied',role:'User',perms:{},staffScope:'all'},
  ];
  for(const u of accounts) await users.insertOne({...u,active:true});
  const server = require('../web').listen(0,'127.0.0.1');
  await once(server,'listening');
  const base = 'http://127.0.0.1:'+server.address().port;
  const headers = u => ({authorization:'Bearer '+auth.sign(u),'content-type':'application/json'});
  const admin = {username:'admin',role:'Administrator'};
  async function save(rows) {
    const r = await fetch(base+'/api/data',{method:'PUT',headers:headers(admin),body:JSON.stringify({partial:true,data:{unico_staff_v3:JSON.stringify(rows)}})});
    assert.equal(r.status,200);
  }
  try {
    await save(imported);
    const first = await (await fetch(base+'/api/staff',{headers:headers(accounts[0])})).json();
    assert.equal(first.staff[0].name,'Old name');
    await save(updated);
    for(const u of [admin,...accounts.slice(0,2)]) {
      const r = await fetch(base+'/api/staff',{headers:headers(u)});
      assert.equal(r.headers.get('cache-control'),'no-store');
      assert.deepEqual((await r.json()).staff,updated,'all-staff custom role sees the same saved list as admin');
      const page = await (await fetch(base+'/',{headers:headers(u)})).text();
      const inject = page.match(/window\.__UNICO_STAFF__=(.*?);window\./);
      assert(inject,'page inject exists');
      assert.deepEqual(JSON.parse(inject[1]),updated,'full reload uses the saved list too');
    }
    const scoped = await (await fetch(base+'/api/staff',{headers:headers(accounts[2])})).json();
    assert.deepEqual(scoped.staff.map(x=>x.id),[1]);
    assert.equal((await fetch(base+'/api/staff',{headers:headers(accounts[3])})).status,403);
    await save([]);
    assert.deepEqual((await (await fetch(base+'/api/staff',{headers:headers(accounts[0])})).json()).staff,[]);
    console.log('STAFF_ROSTER_TEST_PASS: saved updates, additions, removals, page reload, empty list and custom-role scoping');
  } finally { await new Promise(resolve=>server.close(resolve)); }
})().catch(e=>{console.error(e);process.exitCode=1;});
