const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const React = require('react');
const ssr = require('react-dom/server');
const Babel = require('@babel/standalone');
const read = name => fs.readFileSync(path.join(__dirname,'../../renderer/unico',name),'utf8');
const ctx = { window:{addEventListener(){},unicoCan:()=>false,MK:{usePhoto:()=>({failed:true})}},React,console,
  localStorage:{getItem:()=>null},I:{},Ic:()=>null };
vm.createContext(ctx);
vm.runInContext(read('staff-data.js'),ctx);
const S = ctx.window.STAFF;
const now = Date.parse('2026-10-03T12:00:00+06:00');
const rows = [
  {id:1,created_at:now},
  {id:2,updated_at:Date.parse('2026-09-19T00:00:00+06:00')},
  {id:3,updated_at:Date.parse('2026-09-18T23:59:59+06:00')},
  {id:4,updated_at:now+90000}, // server clock 90 seconds ahead of the browser
  {id:5,updated_at:'invalid'},
  {id:6,updated_at:String(now)},
  {id:7,updated_at:Date.parse('2026-10-04T00:00:00+06:00')},
];
assert.deepEqual(Array.from(S.recentStaffUpdates(rows,15,now),r=>r.id),[2,4,6],'updates include server times ahead of the local clock today, exclude tomorrow, and never count creation as an update');
assert.deepEqual(Array.from(S.recentStaffEntries(rows,15,now),r=>r.id),[1],'entry list remains independent');
vm.runInContext(Babel.transform(read('staff.jsx'),{presets:['react']}).code,ctx);
const liveNow = Date.now();
const staff = [
  {id:10,name:'Earlier edit',role:'Nurse',is_active:true,created_at:1,updated_at:liveNow-1000},
  {id:11,name:'Latest edit',role:'Nurse',is_active:true,created_at:1,updated_at:liveNow},
  {id:12,name:'New entry only',role:'Nurse',is_active:true,created_at:liveNow},
];
const markup = ssr.renderToStaticMarkup(React.createElement(ctx.window.ManageStaff,{store:{staff,refresh:async()=>true},setRoute(){},role:'Nurse',group:'All',recentDays:15,recentKind:'update'}));
assert(markup.includes('Last Updated Staff Info'));
assert(markup.includes('Last Updated</th>'));
assert(markup.includes('>Refresh</button>'),'the list offers a direct database refresh');
assert(!markup.includes('New entry only'),'newly created staff does not appear until an info edit is saved');
assert(markup.indexOf('Latest edit')<markup.indexOf('Earlier edit'),'most recently saved info comes first');
console.log('STAFF_UPDATES_TEST_PASS: separate entry/update lists, timezone boundaries, missing/future timestamps, rendered date column and newest-first order');
