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
const withoutUpdated = rows => rows.map(({updated_at,...row})=>row);

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
  let staffBase = null;
  async function save(rows) {
    const r = await fetch(base+'/api/data',{method:'PUT',headers:headers(admin),body:JSON.stringify({partial:true,staffBase,data:{unico_staff_v3:JSON.stringify(rows)}})});
    assert.equal(r.status,200);
    const result=await r.json();
    staffBase = result.merged&&result.merged.unico_staff_v3 || JSON.stringify(rows);
  }
  try {
    await save(imported);
    const first = await (await fetch(base+'/api/staff',{headers:headers(accounts[0])})).json();
    assert.equal(first.staff[0].name,'Old name');
    await save(updated);
    for(const u of [admin,...accounts.slice(0,2)]) {
      const r = await fetch(base+'/api/staff',{headers:headers(u)});
      assert.equal(r.headers.get('cache-control'),'no-store');
      const savedRows=(await r.json()).staff;
      assert.deepEqual(withoutUpdated(savedRows),updated,'all-staff custom role sees the same saved list as admin');
      assert(Number.isFinite(savedRows[0].updated_at),'edited record has a database save timestamp');
      assert.equal(savedRows[1].updated_at,undefined,'new entries are not classified as info updates');
      const page = await (await fetch(base+'/',{headers:headers(u)})).text();
      const inject = page.match(/window\.__UNICO_STAFF__=(.*?);window\./);
      assert(inject,'page inject exists');
      assert.deepEqual(withoutUpdated(JSON.parse(inject[1])),updated,'full reload uses the saved list too');
    }
    const scoped = await (await fetch(base+'/api/staff',{headers:headers(accounts[2])})).json();
    assert.deepEqual(scoped.staff.map(x=>x.id),[1]);
    assert.equal((await fetch(base+'/api/staff',{headers:headers(accounts[3])})).status,403);
    const staleBase = staffBase;
    const withActivities = updated.map(row => row.id === 1 ? {...row,extracurricular:'Singing, Gardening'} : row);
    await save(withActivities);
    // A different field saved from an old tab must retain the new activities.
    const staleEdit = updated.map(row => row.id === 1 ? {...row,name:'Renamed'} : row);
    const edit = await fetch(base+'/api/data',{method:'PUT',headers:headers(admin),body:JSON.stringify({partial:true,staffBase:staleBase,data:{unico_staff_v3:JSON.stringify(staleEdit)}})});
    assert.equal(edit.status,200);
    const editResult = await edit.json();
    assert.equal(JSON.parse(editResult.merged.unico_staff_v3)[0].extracurricular,'Singing, Gardening','the response carries the actual merged register');
    const reloaded = (await (await fetch(base+'/api/staff',{headers:headers(admin)})).json()).staff;
    assert.equal(reloaded[0].extracurricular,'Singing, Gardening');
    assert.equal(reloaded[0].name,'Renamed');
    const conflictEdit = updated.map(row => row.id === 1 ? {...row,extracurricular:'Dancing'} : row);
    const conflict = await fetch(base+'/api/data',{method:'PUT',headers:headers(admin),body:JSON.stringify({partial:true,staffBase:staleBase,data:{unico_staff_v3:JSON.stringify(conflictEdit)}})});
    assert.equal(conflict.status,409,'a competing change cannot overwrite activities');
    const legacy = await fetch(base+'/api/data',{method:'PUT',headers:headers(admin),body:JSON.stringify({partial:true,data:{unico_staff_v3:staleBase}})});
    assert.equal(legacy.status,409,'old clients cannot replace the register');
    staffBase=JSON.stringify(reloaded);
    const allFields = {...reloaded[0],phone:'01700000000',gender:'Female',dob:'1995-02-10',qualification:'Diploma in Nursing, B.Sc in Nursing',designation:'Staff Nurse',primary_department:'MICU',doj:'2020-01-01',can_float:false,
      prior_experience_entries:[{org:'Previous hospital',dept:'ICU',mode:'dates',fromDate:'2018-01-01',toDate:'2019-12-31'}],prior_experience_years:2,total_experience_years:8,total_experience_text:'8 years',previous_experience:'Previous hospital',special_training:'BLS, Custom training',hepatitis_b_vaccination:'Completed',licence_no:'BNMC-123',licence_expiry:'2030-01-01',licence_program:'Nursing',licence_verified:{at:'2026-10-03',name:'Verified nurse'},remarks:'Keep these remarks',privileges:{assessment:true,airway:false},nid:'0123456789',blood_group:'O+',emergency_contact:'Family 01700000001',emergency_relation:'Spouse',languages:'Bangla, French',custom:{customText:'Custom value',customMulti:'One, Two'},photo:{url:'portrait',publicId:'portrait-id'},legacy_field:'preserve imported information'};
    await save([allFields,reloaded[1]]);
    const afterFields=(await (await fetch(base+'/api/staff',{headers:headers(admin)})).json()).staff;
    assert.deepEqual(withoutUpdated(afterFields)[0],withoutUpdated([allFields])[0],'every staff field survives database save and reload');
    const stampedAt=afterFields[0].updated_at;
    await save(afterFields);
    const afterNoOp=(await (await fetch(base+'/api/staff',{headers:headers(admin)})).json()).staff;
    assert.equal(afterNoOp[0].updated_at,stampedAt,'no-op saves keep the original update timestamp');
    await save([]);
    assert.deepEqual((await (await fetch(base+'/api/staff',{headers:headers(accounts[0])})).json()).staff,[]);
    console.log('STAFF_ROSTER_TEST_PASS: saved updates, additions, removals, page reload, empty list and custom-role scoping');
  } finally { await new Promise(resolve=>server.close(resolve)); }
})().catch(e=>{console.error(e);process.exitCode=1;});
