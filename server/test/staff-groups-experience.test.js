const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const React = require('../../node_modules/react');
const { renderToStaticMarkup } = require('../../node_modules/react-dom/server');
const Babel = require('../../node_modules/@babel/standalone');
const source = name => fs.readFileSync(path.join(__dirname, '../../renderer/unico', name), 'utf8');
const noop = () => {};
const window = { addEventListener:noop,removeEventListener:noop,unicoCan:()=>false,MK:{usePhoto:()=>({failed:true}),iconBadge:()=>({}),initials:()=>'?'} };
const context = vm.createContext({ window, React, console, Date, setTimeout, clearTimeout,
  localStorage:{getItem:()=>null,setItem:noop}, I:{}, Ic:()=>null, fmt:String,
  SectionTitle:({title,sub,right})=>React.createElement('header',null,title,sub,right),
  PALETTE:['#0090ca','#e08a1e','#6a52d4'], Bar3D:()=>null, Donut:()=>null, PhotoPicker:()=>null });
vm.runInContext(source('staff-data.js'), context);
const S = window.STAFF;
const people = [
  {id:1,name:'Registered Nurse',role:'Nurse',designation:'Staff Nurse',current_department:'MICU',is_active:true},
  {id:2,name:'Trainee A',role:'Nurse',designation:'Trainee Nurse',current_department:'MICU',is_active:true},
  {id:3,name:'Trainee B',role:'Nurse',designation:'  NURSE-TRAINEE ',current_department:'CCU',is_active:true},
  {id:4,name:'PCA Trainee',role:'PCA',designation:'PCA Trainee',current_department:'MICU',is_active:true},
  {id:5,name:'Former Trainee',role:'Nurse',designation:'Trainee Nurse',current_department:'CCU',is_active:false,former:true},
  {id:6,name:'Archived Nurse',role:'Nurse',designation:'Staff Nurse',is_active:true,former:true},
];
assert.deepEqual(JSON.parse(JSON.stringify(S.staffCounts(people))),{All:4,Nurse:1,Trainee:2,PCA:1});
assert.equal(S.staffGroupOf({designation:'Trainee Nurse'}),'Trainee');
assert.equal(S.staffGroupOf({role:'Nurse',designation:'Senior Staff Nurse'}),'Nurse');
assert.equal(S.staffGroupOf({role:'PCA',designation:'Trainee Nurse'}),'PCA');
assert.equal(people.filter(e=>S.matchesStaffGroup(e,'Trainee')).length,3);
assert.equal(S.staffCounts(people.filter(e=>e.current_department==='MICU')).Trainee,1);

const dated = {mode:'dates',org:'Previous Hospital',fromDate:'2020-01-15',toDate:'2022-04-15',years:99};
assert.equal(S.experienceYearsOf(dated),2.25,'dates override stale manual duration');
assert.equal(S.experienceYearsOf({...dated,toDate:'2022-04-14'}),26/12,'count completed calendar months');
assert.equal(S.experienceYearsOf({years:'2',months:'6'}),2.5,'legacy duration is preserved');
assert.equal(S.priorYearsOf({prior_experience_entries:[dated,{years:1,months:6}]}),3.75);
assert.equal(S.experienceDateError(dated,'2023-01-01'),'');
for(const invalid of [{...dated,fromDate:'2020-02-30'},{...dated,toDate:''},{...dated,toDate:'2019-01-01'},{...dated,toDate:'2099-01-01'}]) {
  assert.ok(S.experienceDateError(invalid));
}
assert.match(S.experienceDateError(dated,'2021-01-01'),/joining UNICO/);
assert.equal(S.experienceDateError({years:3},'2021-01-01'),'');

vm.runInContext(Babel.transform(source('staff.jsx'),{presets:['react']}).code,context);
const store={staff:people,refresh:noop};
const roster = renderToStaticMarkup(React.createElement(window.ManageStaff,{store,role:'Nurse',group:'Trainee',setRoute:noop}));
assert.ok(roster.includes('Trainee Nurse Directory'));
assert.ok(roster.includes('Trainee A')&&roster.includes('Trainee B'));
assert.ok(!roster.includes('Registered Nurse')&&!roster.includes('Former Trainee')&&!roster.includes('PCA Trainee'));
const dashboard=renderToStaticMarkup(React.createElement(window.WorkforceDashboard,{store,role:'Nurse',group:'Trainee',setRoute:noop}));
// The redesigned header (hero + filter bar) says 'Showing 2 active …' instead of '2 active staff'.
assert.ok(dashboard.includes('Trainee Nurse Dashboard')&&dashboard.includes('Showing <b>2</b> active'));
assert.ok(dashboard.includes('View All Staff dashboard')&&dashboard.includes('View Trainee Nurses dashboard'));
assert.ok(dashboard.includes('Dashboard department'));
// The form is tabbed now (Personal / Job / Experience …): open it on the Experience tab, where the dated rows are.
const OPEN_TAB="React.useState('personal');   // which section of the form is open";
assert.ok(source('staff-profile.jsx').includes(OPEN_TAB),'the staff form still opens on a tab the test can switch');
const formOn=tab=>{ // each copy in its own scope, as the bundle loads every file (top-level names would collide)
  const code=Babel.transform(source('staff-profile.jsx').replace(OPEN_TAB,"React.useState('"+tab+"');"),{presets:['react']}).code;
  vm.runInContext('(function(){'+code+'\n})();',context); return window.StaffForm; };
const ExpForm=formOn('experience'), CompForm=formOn('compliance'), PrivForm=formOn('privileges');
const formStore={...store,get:()=>({...people[1],doj:'2023-01-01',prior_experience_entries:[dated]})};
const form=renderToStaticMarkup(React.createElement(ExpForm,{store:formStore,empId:2,role:'Nurse',setRoute:noop,depts:[]}));
assert.ok(form.includes('Experience 1 from date')&&form.includes('2020-01-15'));
assert.ok(form.includes('Experience 1 to date')&&form.includes('2022-04-15'));
assert.ok(form.includes('Years / months'),'the manual alternative remains available');
const blankForm=renderToStaticMarkup(React.createElement(ExpForm,{store,role:'Nurse',setRoute:noop,depts:[]}));
assert.ok(blankForm.includes('Experience 1 from date')&&blankForm.includes('Experience 1 to date'),'new records immediately show date inputs');
const pcaForm=renderToStaticMarkup(React.createElement(CompForm,{store,role:'PCA',setRoute:noop,depts:[]}));
assert.ok(renderToStaticMarkup(React.createElement(CompForm,{store,role:'Nurse',setRoute:noop,depts:[]})).includes('Registration / Licence No.'),'the Compliance tab carries the nursing licence');
assert.ok(!pcaForm.includes('Registration / Licence No.')&&!pcaForm.includes('Licence Expiry')&&!pcaForm.includes('Live BNMC verification'),'PCA creation does not request a nursing licence');
const emptyEdit=renderToStaticMarkup(React.createElement(ExpForm,{store:{...store,get:()=>people[1]},empId:2,setRoute:noop,depts:[]}));
assert.ok(emptyEdit.includes('Experience 1 from date'),'existing records without itemized experience show the date format');
const legacyEdit=renderToStaticMarkup(React.createElement(ExpForm,{store:{...store,get:()=>({...people[1],prior_experience_entries:[{org:'Previous Hospital',years:2,months:6}]})},empId:2,setRoute:noop,depts:[]}));
assert.ok(legacyEdit.includes('Experience 1 from date')&&legacyEdit.includes('Experience 1 years'),'legacy entries show date inputs while preserving their duration');
const privilege=S.privilegeGroupsFor('Nurse')[0];
const privilegeKey=S.privKey(privilege.group,privilege.items[0]);
const savedPrivilege=renderToStaticMarkup(React.createElement(PrivForm,{store:{...store,get:()=>({...people[1],privileges:{[privilegeKey]:true}})},empId:2,setRoute:noop,depts:[]}));
assert.ok(savedPrivilege.includes(privilege.items[0]),'saved grants remain editable when department assignments are absent');
const originalStorage=context.localStorage;
context.localStorage={getItem:k=>k==='unico_dept_privileges_v1'?JSON.stringify({MICU:{Nurse:{[privilegeKey]:true}}}):null};
assert.ok(S.deptPrivilegeKeysFor(['Medical ICU (MICU)'],'Nurse').has(privilegeKey),'department aliases resolve stored privilege assignments');
context.localStorage=originalStorage;
// Render the actual local two-page print form, without its unrelated collection screens.
const printSource=source('data-collection.jsx');
const printStart=printSource.indexOf('function StaffPrintOptions(');
const printEnd=printSource.indexOf('  function CollectorStaffRequests(',printStart);
context.useEffect=React.useEffect;
context.document={getElementById:()=>({})};
context.ReactDOM={createPortal:node=>node};
vm.runInContext(Babel.transform(printSource.slice(printStart,printEnd),{presets:['react']}).code,context);
const printForm=(quantity=1)=>renderToStaticMarkup(React.createElement(window.UnicoStaffRegForm,{role:'Nurse',quantity}));
const printed=printForm();
const pairCodes=[...printed.matchAll(/data-form-pair="([^"]+)"/g)].map(m=>m[1]);
assert.equal(pairCodes.length,2,'both printed pages carry a matching box');
assert.equal(pairCodes[0],pairCodes[1],'pages share the same form identifier');
assert.notEqual(pairCodes[0],[...printForm().matchAll(/data-form-pair="([^"]+)"/g)][0][1],'separate forms have distinct identifiers');
assert.ok(printed.includes('Page 1 of 2')&&printed.includes('Page 2 of 2'));
assert.ok(printed.includes('From date')&&printed.includes('To date'));
const pcaPrint=renderToStaticMarkup(React.createElement(window.UnicoStaffRegForm,{role:'PCA'}));
assert.ok(!pcaPrint.includes('BNMC')&&!pcaPrint.includes('Licence expiry'),'PCA paper forms do not request nursing registration');
assert.ok(printed.includes('BNMC registration / licence no.')&&printed.includes('Licence expiry'),'nurse paper forms retain registration fields');
assert.equal((printed.match(/<footer/g)||[]).length,2,'each sheet has its own footer');
assert.ok(printed.indexOf('data-form-pair')>printed.indexOf('Previous experience (before joining UNICO)'),'page one matching strip follows form content');
assert.ok(printed.lastIndexOf('data-form-pair')>printed.indexOf('FOR OFFICE USE ONLY'),'page two matching strip follows form content');
const batch=printForm(3);
const batchCodes=[...batch.matchAll(/data-form-pair="([^"]+)"/g)].map(m=>m[1]);
assert.equal(batchCodes.length,6,'three forms print six identified pages');
assert.equal(new Set(batchCodes).size,3,'each form has its own pair code');
for(let i=0;i<batchCodes.length;i+=2) assert.equal(batchCodes[i],batchCodes[i+1]);
const numbers=[...batch.matchAll(/UF-[A-Z0-9]+-\d{3}/g)].map(m=>m[0]);
assert.equal(new Set(numbers).size,3,'each form has a unique number');
assert.equal(numbers.length,6,'both pages show the form number');
const symbols=[...batch.matchAll(/data-block-symbol="(\d+)"/g)].map(m=>m[1]);
assert.equal(symbols.length,144,'each of six pages carries twenty-four OMR marks');
for(let i=0;i<3;i++) assert.deepEqual(symbols.slice(i*48,i*48+24),symbols.slice(i*48+24,i*48+48),'paired pages have identical symbols');
assert.equal(new Set([0,1,2].map(i=>symbols.slice(i*48,i*48+24).join(','))).size,3,'separate forms have distinct symbol sequences');
assert.ok(!batch.includes('Pair code:'),'matching uses symbols instead of a printed code');
// Exercise the dashboard button including the lazy chunk load and its options dialog.
(async()=>{
  const options=window.StaffPrintOptions;
  const states=[];
  let cursor=0,loaded=false;
  context.React={...React,useState:initial=>{
    const index=cursor++;
    if(!(index in states)) states[index]=typeof initial==='function'?initial():initial;
    return [states[index],value=>{states[index]=value;}];
  }};
  const find=(node,predicate)=>{
    if(!node||typeof node!=='object') return null;
    if(Array.isArray(node)){for(const child of node){const found=find(child,predicate);if(found)return found;}return null;}
    if(predicate(node)) return node;
    return node.props&&(find(node.props.children,predicate)||find(node.props.right,predicate));
  };
  window.unicoCan=()=>true;
  delete window.StaffPrintOptions;
  window.unicoLoadChunk=async name=>{assert.equal(name,'datacollection');loaded=true;window.StaffPrintOptions=options;};
  const props={store,role:'Nurse',group:'All',setRoute:noop};
  const initial=window.WorkforceDashboard(props);
  const button=find(initial,node=>node.type==='button'&&JSON.stringify(node.props.children).toLowerCase().includes('print staff information'));
  assert.ok(button,'dashboard print button is available');
  await button.props.onClick();
  assert.ok(loaded,'the dashboard loads the shared print dialog chunk');
  cursor=0;
  const opened=window.WorkforceDashboard(props);
  const dialog=find(opened,node=>node.type===options);
  assert.ok(dialog,'dashboard opens quantity options instead of printing immediately');
  context.React=React;
  const markup=renderToStaticMarkup(dialog);
  assert.ok(markup.includes('Number of staff forms')&&markup.includes('role="dialog"'));
  console.log('Staff grouping, date experience, paired print forms and dashboard quantity dialog checks passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
