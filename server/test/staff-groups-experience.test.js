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
assert.ok(dashboard.includes('Trainee Nurse Dashboard')&&dashboard.includes('2 active staff'));
assert.ok(dashboard.includes('View All Staff dashboard')&&dashboard.includes('View Trainee Nurses dashboard'));
assert.ok(dashboard.includes('Dashboard department'));
vm.runInContext(Babel.transform(source('staff-profile.jsx'),{presets:['react']}).code,context);
const formStore={...store,get:()=>({...people[1],doj:'2023-01-01',prior_experience_entries:[dated]})};
const form=renderToStaticMarkup(React.createElement(window.StaffForm,{store:formStore,empId:2,role:'Nurse',setRoute:noop,depts:[]}));
assert.ok(form.includes('Experience 1 from date')&&form.includes('2020-01-15'));
assert.ok(form.includes('Experience 1 to date')&&form.includes('2022-04-15'));
assert.ok(form.includes('Years / months'),'the manual alternative remains available');
console.log('Staff grouping, trainee directory/dashboard and date-based experience checks passed.');
