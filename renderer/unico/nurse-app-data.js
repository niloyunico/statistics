/* Design data for the NURSE_APP_DATA — lifted verbatim from the Claude Design document
 * (docs/design). Seed/demo values the app falls back to when the server has no
 * live data for a screen. Published as window.NURSE_APP_DATA. */
(function () {
  'use strict';
  const SHIFTS = {
    M4:{name:'Morning',time:'8:00 AM – 2:00 PM',hours:'6h',color:'#0090ca',bg:'rgba(0,144,202,.14)'},
    E3:{name:'Evening',time:'2:00 PM – 10:00 PM',hours:'8h',color:'#e08a1e',bg:'rgba(224,138,30,.16)'},
    N2:{name:'Night',time:'8:00 PM – 8:00 AM',hours:'12h',color:'#6a52d4',bg:'rgba(106,82,212,.15)'},
    O:{name:'Off',time:'Rest day',hours:'—',color:'#7d8ea8',bg:'rgba(125,145,180,.16)'},
    CL:{name:'Casual leave',time:'Approved leave',hours:'—',color:'#1d8f57',bg:'rgba(43,182,115,.15)'},
  };
  const PATTERN = ['M4','M4','E3','E3','N2','O','O','M4','E3','E3','N2','N2','O','O'];
  const ROSTER = {}; for (let d=1; d<=30; d++) ROSTER[d] = PATTERN[(d+3)%PATTERN.length]; ROSTER[8]='M4'; ROSTER[17]='CL';
  const TODAY = 8;
  const DOWS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const dateLabel = d => `${DOWS[d%7]}, ${d} Sep`;
  const TEAM = [
    {name:'Rahima Khatun',role:'Senior Staff Nurse',code:'M4'},
    {name:'Sumaiya Akter',role:'Staff Nurse',code:'M4'},
    {name:'Tanvir Hossain',role:'Staff Nurse',code:'M3'},
    {name:'Priya Das',role:'Team Leader',code:'G1'},
  ];
  const ini = n => n.split(' ').map(w=>w[0]).slice(0,2).join('');
  const MED_CATS = ['All','Analgesic','Antibiotic','Gastro & Antiemetic','Cardiovascular','Diabetes','Respiratory & Allergy','Steroid'];
  const FOODS = {with:'With food',before:'Before meals',any:'Any time',na:'N/A (IV/IM)'};
  const PREGS = {safe:['Safe','#1d8f57'],caution:['Caution','#b8650a'],avoid:['Avoid','#b32e2e']};
  const MED_TABS = {
    overview:['Indications','Composition','Pharmacology'],
    dosage:['Dosage & Administration','Administration','Pediatric Uses','Duration Of Treatment'],
    safety:['Side Effects','Contraindications','Drug Interactions','Precautions And Warnings','Overdose Effects','Pregnancy & Lactation','Use In Special Populations'],
    more:['Storage'],
  };
  const SEC_COLOR = {'Indications':'#0072a3','Composition':'#3c4858','Pharmacology':'#6a52d4','Dosage & Administration':'#0072a3','Administration':'#1e8a7c','Pediatric Uses':'#b8650a','Duration Of Treatment':'#3c4858','Side Effects':'#b8650a','Contraindications':'#b32e2e','Drug Interactions':'#b32e2e','Precautions And Warnings':'#b8650a','Overdose Effects':'#b32e2e','Pregnancy & Lactation':'#6a52d4','Use In Special Populations':'#3c4858','Storage':'#1e8a7c'};
  const CATS = {Policy:{c:'#6a52d4',bg:'rgba(106,82,212,.13)'},Training:{c:'#1e8a7c',bg:'rgba(58,181,167,.16)'},Roster:{c:'#0072a3',bg:'rgba(0,144,202,.13)'},Urgent:{c:'#b32e2e',bg:'rgba(214,69,69,.12)'},General:{c:'#7d8ea8',bg:'rgba(125,145,180,.16)'}};
  const ATTACH_ICONS = {pdf:'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8',photo:'M21 19V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2zM8.5 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM21 15l-5-5L5 21',handover:'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 12h6M9 16h4',med:'M10.5 20.5l10-10a4.95 4.95 0 00-7-7l-10 10a4.95 4.95 0 007 7zM8.5 8.5l7 7',voice:'M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8',bed:'M2 4v16M2 8h18a2 2 0 012 2v10M2 17h20M6 8v9'};
  const NOTICES = [
    {id:1,cat:'Urgent',pinned:true,needsAck:true,attachments:[{name:'Isolation-protocol-LDR-v3.pdf',ext:'PDF',size:'1.2 MB'}],ackCount:128,ackTotal:186,title:'Infection control: new isolation protocol for LDR',when:'Today',from:'Elizabeth Jothi Raja Singh',fromRole:'Nurse Manager',audience:'All nursing staff',body:'Effective immediately, all suspected respiratory cases in LDR must be placed in a single room with droplet precautions.',full:'Effective immediately, all suspected respiratory cases in LDR must be placed in a single room with droplet precautions.\n\nDon N95, gown, gloves and eye protection before entry. Sign the door log on every entry and exit. The infection control team will audit compliance daily for the next two weeks.\n\nDirect any questions to your nurse in-charge.'},
    {id:2,cat:'Training',pinned:false,needsAck:false,poll:{q:'Which BLS date suits you?',opts:['14 Sep','16 Sep','18 Sep'],votes:[21,34,17]},title:'BLS recertification – September batch',when:'Yesterday',from:'Nursing Education',fromRole:'Training unit',audience:'Nurses due for renewal',body:'Sessions on 14, 16 and 18 September, 9 AM to 1 PM in the Skills Lab.',full:'Sessions on 14, 16 and 18 September, 9 AM to 1 PM in the Skills Lab.\n\nNurses whose BLS certificate expires before 31 December must attend one session. Register through your in-charge by 11 September. Bring your current certificate.'},
    {id:3,cat:'Roster',pinned:false,needsAck:false,title:'October roster draft open for review',when:'2 d ago',from:'Priya Das',fromRole:'Team Leader, LDR',audience:'LDR',body:'The October draft is published. Raise any conflicts by 15 September.',full:'The October draft is published in the Roster tab. Please review your shifts and raise any conflicts (exams, approved leave, family commitments) by 15 September.\n\nSwap requests after that date will need in-charge approval on a case-by-case basis.'},
    {id:4,cat:'Policy',pinned:false,needsAck:true,attachments:[{name:'High-alert-medicines-list-2026.pdf',ext:'PDF',size:'480 KB'},{name:'Double-check-SOP.pdf',ext:'PDF',size:'310 KB'}],ackCount:171,ackTotal:186,title:'Updated medication double-check policy',when:'4 d ago',from:'Chief of Nursing Services',fromRole:'Nursing administration',audience:'All nursing staff',body:'Independent double check is now mandatory for all high-alert medicines, including subcutaneous insulin.',full:'Independent double check is now mandatory for all high-alert medicines, including subcutaneous insulin and low-molecular-weight heparin.\n\nBoth nurses must sign the MAR. The list of high-alert medicines is available in Medicine Info, flagged with a red label.'},
    {id:5,cat:'General',pinned:false,needsAck:false,title:'Cafeteria hours during renovation',when:'1 w ago',from:'Administration',fromRole:'Hospital admin',audience:'All staff',body:'The staff cafeteria will close at 8 PM from 10 September until further notice.',full:'The staff cafeteria will close at 8 PM from 10 September until further notice. Night staff can collect packed meals from the 2nd-floor pantry.'},
  ];
  const DEPTS = ['LDR','CCU','SICU','MICU','NICU','Emergency','OPD','Cath Lab','CT ICU'];
  const CHATS = [
    {id:'ldr',scope:'dept',dept:'LDR',group:true,name:'LDR Nurses',members:14,online:true,sub:'14 members · 6 online',unread:3,when:'9:12',pinned:0,typing:'Priya is typing…',msgs:[
      {from:'Priya Das',role:'Team Leader',text:'Morning team. Bed 4 is going for CS at 10:30, please have the pre-op checklist done by 10.',t:'8:41',reactions:['Ack · 6']},
      {from:'Rahima Khatun',role:'Senior Staff Nurse',text:'Checklist done, consent signed. Waiting for anaesthesia review.',t:'8:58',attach:'Pre-op-checklist-B4.pdf',attachType:'pdf',replyTo:'Priya Das: Bed 4 is going for CS at 10:30…'},
      {from:'Sumaiya Akter',role:'Staff Nurse',text:'Bed 2 CTG shows variable decels, informed Dr. Farhana. She is coming.',t:'9:05',urgent:true,reactions:['On it · 2']},
      {from:'me',text:'Covering bed 6 now.',t:'9:10',seen:'Seen by 5'},
      {from:'Priya Das',role:'Team Leader',text:'Thanks Sumaiya. Stay with her and keep left lateral. Nasif, can you cover bed 6 meanwhile?',t:'9:12'}]},
    {id:'ldr-incharge',scope:'dept',dept:'LDR',group:false,name:'Priya Das',role:'Team Leader',online:true,sub:'Team Leader · online',unread:1,when:'9:14',msgs:[
      {from:'Priya Das',role:'Team Leader',text:'Your swap with Sumaiya for the 12th is approved. Roster updated.',t:'9:14'}]},
    {id:'ldr-rahima',scope:'dept',dept:'LDR',group:false,name:'Rahima Khatun',role:'Senior Staff Nurse',online:false,sub:'Senior Staff Nurse · last seen 8:58',unread:0,when:'Yest',msgs:[
      {from:'Rahima Khatun',role:'Senior Staff Nurse',text:'Can you bring the neonatal resus bag from store when you come in?',t:'Yest'},
      {from:'me',text:'Sure, will do.',t:'Yest'}]},
    {id:'ldr-doctors',scope:'dept',dept:'LDR',group:true,name:'LDR On-call Doctors',members:9,online:true,sub:'9 members · 3 online',unread:0,when:'Yest',msgs:[
      {from:'Dr. Farhana Islam',role:'Registrar, Obs & Gynae',text:'Please page me directly for any decels tonight, not through the desk.',t:'Yest'}]},
    {id:'nicu',scope:'dept',dept:'NICU',group:true,name:'NICU Nurses',members:11,online:true,sub:'11 members · 4 online',unread:0,when:'8:20',msgs:[
      {from:'Nusrat Jahan',role:'Staff Nurse, NICU',text:'Incubator 3 is ready to receive from LDR.',t:'8:20'}]},
    {id:'ccu',scope:'dept',dept:'CCU',group:true,name:'CCU Nurses',members:12,online:false,sub:'12 members',unread:0,when:'Mon',msgs:[
      {from:'Mahmud Hasan',role:'Charge Nurse, CCU',text:'Defib check log for September is in the drawer under the crash cart.',t:'Mon'}]},
    {id:'all-nursing',scope:'hosp',group:true,name:'All Nursing Staff',members:186,online:true,sub:'186 members · hospital-wide',unread:2,when:'8:55',msgs:[
      {from:'Elizabeth Jothi Raja Singh',role:'Nurse Manager',text:'Reminder: infection control isolation protocol is live from today. Acknowledge the notice in the app.',t:'8:30'},
      {from:'Nursing Education',role:'Training unit',text:'BLS September batch: 6 seats left on the 14th.',t:'8:55'}]},
    {id:'codes',scope:'hosp',group:true,name:'Rapid Response · Codes',members:42,online:true,sub:'42 members · read-only for staff',unread:0,when:'7:02',msgs:[
      {from:'Rapid Response Team',role:'System',text:'Code Blue cleared, 4th floor MICU, 06:58. Debrief at 14:00 in MICU seminar room.',t:'7:02'}]},
    {id:'it',scope:'hosp',group:true,name:'IT & App Support',members:3,online:false,sub:'Support · 9 AM – 6 PM',unread:0,when:'Fri',msgs:[
      {from:'IT Support',role:'Helpdesk',text:'Nurse App v2.1 is rolling out with chat and handover. Update from the Play Store.',t:'Fri'}]},
  ];
  const SCREENS = [
    ['login','Login'],['home','Home'],['roster','Roster'],['shift','Shift detail'],['requests','Requests'],['newRequest','New request'],
    ['chats','Chat'],['thread','Chat thread'],['meds','Medicine lookup'],['medDetail','Medicine detail'],['medRequest','Request a medicine'],['notices','Notices'],['noticeDetail','Notice detail'],
    ['composeNotice','New announcement'],['staff','Staff directory'],['staffDetail','Staff profile'],['reports','Reports (in-charge)'],['indicator','Indicator detail'],['shiftReport','Shift report form'],['datacol','Data collection'],['datacolForm','Data entry form'],['datacolHistory','My submissions'],['handover','Handover'],['incident','Incident report'],['performance','Performance'],['profile','Profile & settings'],['drawer','Sidebar menu'],
  ];
  const DAYS7 = ['Tue 2','Wed 3','Thu 4','Fri 5','Sat 6','Sun 7','Mon 8'];
  const CENSUS = { adm:[6,8,5,9,7,4,6], dis:[5,7,6,8,6,5,7], nvd:[3,4,2,5,3,2,4], cs:[2,3,2,3,3,1,2], occ:[78,85,80,92,88,75,82], deaths:[0,0,0,0,1,0,0], transfers:[1,2,0,1,1,0,1] };
  const INDICATORS = [
    {id:'hh',name:'Hand hygiene compliance',unit:'% of observed moments',v:87,bench:'≥ 85%',benchV:85,dir:'up',trend:[79,82,84,83,86,87],num:'Compliant moments observed',numV:261,den:'Total moments observed',denV:300,formula:'(compliant moments ÷ observed moments) × 100',capa:[{text:'Monthly hand-hygiene audit by two observers',owner:'Priya Das',due:'30 Sep',done:true},{text:'Refill alcohol rub at every bedside daily',owner:'Shathi Rani',due:'Ongoing',done:false}]},
    {id:'hapu',name:'Hospital-acquired pressure ulcer',unit:'per 1,000 patient-days',v:0.8,bench:'≤ 1.5',benchV:1.5,dir:'down',trend:[1.9,1.4,1.2,1.0,0.9,0.8],num:'New stage ≥2 pressure injuries',numV:1,den:'Patient-days',denV:1240,formula:'(new HAPU ÷ patient-days) × 1,000',capa:[{text:'Braden score on admission and every shift',owner:'All nurses',due:'Ongoing',done:true}]},
    {id:'falls',name:'Patient falls',unit:'falls this month',v:1,bench:'0',benchV:0,dir:'down',trend:[0,1,0,0,2,1],num:'Falls reported',numV:1,den:'—',denV:'—',formula:'Count of fall incidents reported',capa:[{text:'Bed rails up and call bell within reach for all post-op mothers',owner:'Rahima Khatun',due:'15 Sep',done:false}]},
    {id:'mederr',name:'Medication errors',unit:'errors this month',v:2,bench:'≤ 1',benchV:1,dir:'down',trend:[1,0,1,2,1,2],num:'Errors reaching the patient',numV:2,den:'Doses administered',denV:2860,formula:'Count of reported medication errors (all severities)',capa:[{text:'Independent double check for all high-alert medicines',owner:'Priya Das',due:'10 Sep',done:false},{text:'Root-cause review of both September errors',owner:'Quality team',due:'12 Sep',done:false}]},
    {id:'needle',name:'Needle-stick injuries',unit:'incidents this month',v:0,bench:'0',benchV:0,dir:'down',trend:[1,0,0,0,0,0],num:'Needle-stick injuries reported',numV:0,den:'—',denV:'—',formula:'Count of sharps injuries reported',capa:[]},
    {id:'ssc',name:'Surgical safety checklist',unit:'% of CS with full checklist',v:96,bench:'≥ 95%',benchV:95,dir:'up',trend:[88,91,93,94,95,96],num:'CS with all 3 phases signed',numV:15,den:'Caesarean sections',denV:16,formula:'(checklists complete ÷ CS performed) × 100',capa:[]},
    {id:'d2d',name:'Decision-to-delivery ≤ 30 min',unit:'% of category-1 CS',v:78,bench:'≥ 90%',benchV:90,dir:'up',trend:[85,82,80,84,81,78],num:'Cat-1 CS delivered within 30 min',numV:7,den:'Category-1 CS',denV:9,formula:'(cat-1 CS ≤ 30 min ÷ all cat-1 CS) × 100',capa:[{text:'Pre-assemble emergency CS trolley at every shift start',owner:'Sumaiya Akter',due:'9 Sep',done:false},{text:'Escalate anaesthesia call-out delays to Nurse Manager',owner:'Priya Das',due:'Ongoing',done:true}]},
  ];
  const IND_PLAIN = {
    hh:{means:'Out of every 100 times staff should have cleaned their hands, they did so 87 times. The hospital target is 85 or more.',action:'Keep alcohol rub stocked at every bed and remind the team at handover. Two observers audit each month.'},
    hapu:{means:'Fewer than 1 patient in 1,000 bed-days developed a new bedsore on the ward. Lower is better; the target is 1.5 or less.',action:'Keep doing Braden scores each shift and 2-hourly turns for high-risk mothers.'},
    falls:{means:'One patient fell this month. The target is zero.',action:'Bed rails up and call bell in reach for every post-op mother; review the fall in the next team meeting.'},
    mederr:{means:'Two medication errors reached patients this month, above the target of one or fewer. This indicator is in breach.',action:'Double-check every high-alert medicine with a second nurse and complete the root-cause review by 12 Sep.'},
    needle:{means:'No sharps injuries this month. Target met.',action:'Keep sharps bins below the fill line and never re-cap needles.'},
    ssc:{means:'96 of every 100 caesareans had the full surgical safety checklist signed. Target is 95 or more.',action:'Make sure Sign-out is completed before the patient leaves theatre.'},
    d2d:{means:'Only 78% of emergency (category-1) caesareans were delivered within 30 minutes of the decision. Target is 90%. This is in breach.',action:'Pre-assemble the emergency CS trolley each shift and escalate anaesthesia delays immediately.'},
  };
  const ragOf = i => { const ok = i.dir==='up' ? i.v>=i.benchV : i.v<=i.benchV; if (ok) return 'green'; const near = i.dir==='up' ? i.v>=i.benchV*0.9 : i.v<=i.benchV*1.5+0.5; return near ? 'amber' : 'red'; };
  const RAG = {green:['#1d8f57','rgba(43,182,115,.15)','On target'],amber:['#b8650a','rgba(224,138,30,.16)','Watch'],red:['#b32e2e','rgba(214,69,69,.13)','Breach']};
  const SR_STEPS = [
    {key:'census',label:'Census',fields:[['adm','Admissions'],['dis','Discharges'],['tin','Transfers in'],['tout','Transfers out'],['deaths','Deaths'],['census','Current census','Patients in beds at end of shift']],total:null},
    {key:'delivery',label:'Deliveries',fields:[['nvd','Normal (NVD)'],['cs','Caesarean'],['assisted','Assisted / instrumental'],['stillbirth','Stillbirth'],['nicu','Newborn to NICU']],total:'Total deliveries',totalKeys:['nvd','cs','assisted']},
    {key:'events',label:'Events',fields:[['falls','Patient falls'],['mederr','Medication errors'],['needle','Needle-stick'],['code','Code Blue / rapid response'],['complaint','Complaints'],['pph','PPH > 1000 mL']],total:'Total events',totalKeys:['falls','mederr','needle','code','complaint','pph']},
    {key:'staffing',label:'Staffing',fields:[['planned','Nurses planned'],['actual','Nurses on duty'],['sick','Sick / absent'],['ot','Overtime hours'],['pca','PCAs on duty']],total:null},
    {key:'notes',label:'Notes'},
    {key:'review',label:'Sign'},
  ];
  const DC_MONTHS = ['Jun 2026','Jul 2026','Aug 2026','Sep 2026'];
  const DC_CUR = 2; // Aug 2026 is the month due now (deadline 30 Sep)
  const DC_STAT_FIELDS = ['Admissions','Discharges','Deaths','Patient days','Deliveries (NVD)','Caesarean sections','Live births','Stillbirths'];
  const DC_ITEMS = [
    {id:'stat',kind:'stat',label:'Patient statistics sheet',meta:'Monthly sheet · 8 fields',d:'M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18'},
    {id:'hh',kind:'q',label:'Hand hygiene compliance',meta:'% of observed moments',num:'Compliant moments',den:'Moments observed',mult:100,unit:'%',bench:'≥ 85',benchV:85,dir:'up',grouped:true,d:'M7 11V7a5 5 0 0110 0v4M5 11h14l-1 9H6z'},
    {id:'hapu',kind:'q',label:'Hospital-acquired pressure ulcer',meta:'per 1,000 patient-days',num:'New stage ≥2 pressure injuries',den:'Patient-days',mult:1000,unit:'per 1000',bench:'≤ 1.5',benchV:1.5,dir:'down',denLocked:true,d:'M2 4v16M2 8h18a2 2 0 012 2v10M2 17h20M6 8v9'},
    {id:'falls',kind:'q',label:'Patient fall rate',meta:'per 1,000 patient-days',num:'Falls reported',den:'Patient-days',mult:1000,unit:'per 1000',bench:'≤ 0.5',benchV:0.5,dir:'down',denLocked:true,d:'M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z'},
    {id:'mederr',kind:'q',label:'Medication error rate',meta:'% of doses administered',num:'Errors reaching the patient',den:'Doses administered',mult:100,unit:'%',bench:'≤ 0.5',benchV:0.5,dir:'down',d:'M10.5 20.5l10-10a4.95 4.95 0 00-7-7l-10 10a4.95 4.95 0 007 7zM8.5 8.5l7 7'},
    {id:'needle',kind:'q',label:'Needle-stick injuries',meta:'per 100 staff',num:'Sharps injuries reported',den:'Nursing staff',mult:100,unit:'per 100',bench:'0',benchV:0,dir:'down',d:'M12 2v20M5 9l7-7 7 7'},
    {id:'ssc',kind:'q',label:'Surgical safety checklist',meta:'% of CS with full checklist',num:'CS with all 3 phases signed',den:'Caesarean sections',mult:100,unit:'%',bench:'≥ 95',benchV:95,dir:'up',d:'M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11'},
    {id:'d2d',kind:'q',label:'Decision-to-delivery ≤ 30 min',meta:'% of category-1 CS',num:'Cat-1 CS delivered within 30 min',den:'Category-1 CS',mult:100,unit:'%',bench:'≥ 90',benchV:90,dir:'up',d:'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2'},
  ];
  const DC_ST = {approved:['Approved','#1d8f57','rgba(43,182,115,.14)'],sent:['Pending review','#0072a3','rgba(0,144,202,.13)'],rejected:['Returned','#b32e2e','rgba(214,69,69,.12)'],missing:['Not submitted','#b8650a','rgba(224,138,30,.15)'],draft:['Draft saved','#6a52d4','rgba(106,82,212,.13)'],closed:['Not open yet','#7d8ea8','rgba(125,145,180,.16)']};
  const DC_GUIDES = {
    hh:{def:'A hand-hygiene moment is any of the WHO "5 Moments". Observe at least 200 moments per month across all shifts.',example:'176 compliant of 200 observed → 176 ÷ 200 × 100 = 88%',ref:'WHO Hand Hygiene Self-Assessment Framework'},
    hapu:{def:'Count new stage 2 or worse pressure injuries that developed after 24 h of admission. Denominator is total patient-days from the census.',example:'1 new HAPU ÷ 1,240 patient-days × 1,000 = 0.81',ref:'NPIAP / NDNQI definition'},
    falls:{def:'Any unplanned descent to the floor, with or without injury, witnessed or not. Denominator is patient-days, not admissions.',example:'1 fall ÷ 1,240 patient-days × 1,000 = 0.81',ref:'NDNQI Patient Falls'},
    mederr:{def:'Errors at any stage (prescribing, dispensing, administration) that reached the patient, any severity. Denominator is doses administered from the MAR.',example:'2 errors ÷ 2,860 doses × 100 = 0.07%',ref:'NCC MERP index'},
    needle:{def:'Any percutaneous injury from a needle or sharp. Report to Infection Control the same day.',example:'0 injuries ÷ 14 staff × 100 = 0',ref:'CDC Sharps Injury Prevention'},
    ssc:{def:'A checklist counts as complete only if Sign-in, Time-out and Sign-out are all signed.',example:'15 complete ÷ 16 CS × 100 = 93.8%',ref:'WHO Surgical Safety Checklist'},
    d2d:{def:'Category-1 caesarean: immediate threat to life of mother or fetus. Time from decision documented to delivery of the baby.',example:'7 within 30 min ÷ 9 cat-1 CS × 100 = 77.8%',ref:'RCOG / NICE CG132'},
  };
  const LAST_ACTIVE = {'Priya Das':'Active now','Rahima Khatun':'Last active 8:58 AM','Sumaiya Akter':'Active now','Tanvir Hossain':'Active 12 min ago','Shathi Rani':'Last active yesterday, 9:40 PM','Nusrat Jahan':'Active now','Mahmud Hasan':'Last active Mon, 6:15 PM','Farhana Islam':'Active 3 min ago','Elizabeth Jothi Raja Singh':'Active now','Arif Chowdhury':'Active 25 min ago','Tania Sultana':'Last active yesterday, 7:02 AM','Rafiq Ahmed':'Active now'};
  const lastActive = p => LAST_ACTIVE[p.name] || (p.online ? 'Active now' : 'Last active today');
  const lastActiveShort = p => { const l = lastActive(p); return l==='Active now' ? l : l.replace('Last active ','').replace('Active ','').replace(/^./,c=>c.toUpperCase()); };
  const lastActiveColor = p => p.online ? '#1d8f57' : '#7d8ea8';
  const ALL_STAFF = [
    {name:'Priya Das',role:'Team Leader, LDR',dept:'LDR',title:'Team Leader',online:true,admin:true,phone:'+880 1712 440 871',ext:'2214',email:'priya.das@unico.health',emp:'UN-0871',reg:'RN-44219',shift:'G1',joined:'Mar 2019'},
    {name:'Rahima Khatun',role:'Senior Staff Nurse, LDR',dept:'LDR',title:'Senior Staff Nurse',online:false,phone:'+880 1819 330 226',ext:'2215',email:'rahima.khatun@unico.health',emp:'UN-0934',reg:'RN-47102',shift:'M4',joined:'Nov 2020'},
    {name:'Sumaiya Akter',role:'Staff Nurse, LDR',dept:'LDR',title:'Staff Nurse',online:true,phone:'+880 1911 205 583',ext:'2215',email:'sumaiya.akter@unico.health',emp:'UN-1088',reg:'RN-59240',shift:'M4',joined:'Jan 2024'},
    {name:'Tanvir Hossain',role:'Staff Nurse, LDR',dept:'LDR',title:'Staff Nurse',online:true,phone:'+880 1677 812 094',ext:'2215',email:'tanvir.hossain@unico.health',emp:'UN-1051',reg:'RN-58877',shift:'M3',joined:'Sep 2023'},
    {name:'Shathi Rani',role:'PCA, LDR',dept:'LDR',title:'Patient Care Assistant',online:false,phone:'+880 1533 690 417',ext:'2216',email:'shathi.rani@unico.health',emp:'UN-1120',reg:'—',shift:'E3',joined:'Apr 2024'},
    {name:'Nusrat Jahan',role:'Staff Nurse, NICU',dept:'NICU',title:'Staff Nurse',online:true,phone:'+880 1745 118 362',ext:'3108',email:'nusrat.jahan@unico.health',emp:'UN-0990',reg:'RN-51330',shift:'M4',joined:'Jun 2021'},
    {name:'Mahmud Hasan',role:'Charge Nurse, CCU',dept:'CCU',title:'Charge Nurse',online:false,phone:'+880 1622 774 905',ext:'4102',email:'mahmud.hasan@unico.health',emp:'UN-0712',reg:'RN-39815',shift:'N2',joined:'Feb 2018'},
    {name:'Farhana Islam',role:'Registrar, Obs & Gynae',dept:'LDR',title:'Registrar',online:true,phone:'+880 1701 556 230',ext:'2201',email:'farhana.islam@unico.health',emp:'UN-D204',reg:'BMDC-71120',shift:'On call',joined:'Aug 2022'},
    {name:'Elizabeth Jothi Raja Singh',role:'Nurse Manager',dept:'Nursing Admin',title:'Nurse Manager',online:true,phone:'+880 1713 002 118',ext:'1001',email:'elizabeth.singh@unico.health',emp:'UN-0102',reg:'RN-21004',shift:'G1',joined:'May 2015'},
    {name:'Arif Chowdhury',role:'Staff Nurse, Emergency',dept:'Emergency',title:'Staff Nurse',online:true,phone:'+880 1855 401 776',ext:'1510',email:'arif.chowdhury@unico.health',emp:'UN-1012',reg:'RN-57310',shift:'E3',joined:'Jul 2023'},
    {name:'Tania Sultana',role:'Staff Nurse, SICU',dept:'SICU',title:'Staff Nurse',online:false,phone:'+880 1966 233 048',ext:'4210',email:'tania.sultana@unico.health',emp:'UN-0968',reg:'RN-50122',shift:'N2',joined:'Mar 2021'},
    {name:'Rafiq Ahmed',role:'Charge Nurse, MICU',dept:'MICU',title:'Charge Nurse',online:true,phone:'+880 1710 889 512',ext:'4301',email:'rafiq.ahmed@unico.health',emp:'UN-0655',reg:'RN-36720',shift:'M4',joined:'Oct 2017'},
  ];
  const pillBtn = on => `border:0;border-radius:8px;padding:7px 12px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;${on?'background:linear-gradient(140deg,#0aa0d4,#0072a3);color:#fff;box-shadow:0 4px 12px rgba(0,144,202,.3)':'background:transparent;color:#3c4858'}`;
  const chip = on => `border:1px solid ${on?'rgba(0,144,202,.5)':'rgba(125,145,180,.3)'};border-radius:999px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0;${on?'background:rgba(0,144,202,.12);color:#0072a3':'background:rgba(255,255,255,.6);color:#3c4858'}`;
  const catStyle = cat => { const c = CATS[cat]||CATS.General; return `font-size:9.5px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;padding:3px 7px;border-radius:6px;color:${c.c};background:${c.bg};flex-shrink:0`; };
  const statusStyle = s => ({Pending:'color:#b8650a;background:rgba(224,138,30,.15)',Approved:'color:#1d8f57;background:rgba(43,182,115,.14)',Declined:'color:#b32e2e;background:rgba(214,69,69,.12)'}[s]||'') + ';font-size:10.5px;font-weight:700;padding:3px 8px;border-radius:999px;white-space:nowrap;align-self:flex-start';
  const typeStyle = t => `font-size:9.5px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;padding:3px 7px;border-radius:6px;flex-shrink:0;${t==='Swap'?'color:#0072a3;background:rgba(0,144,202,.13)':'color:#6a52d4;background:rgba(106,82,212,.13)'}`;
  const avStyle = (group) => `display:grid;place-items:center;width:44px;height:44px;border-radius:13px;color:#fff;font-size:12px;font-weight:700;flex-shrink:0;background:${group?'linear-gradient(135deg,#0d2a4a,#0a5f87)':'linear-gradient(135deg,#3ab5a7,#0090ca)'}`;

  window.NURSE_APP_DATA = { SHIFTS, PATTERN, ROSTER, TODAY, DOWS, dateLabel, TEAM, ini, MED_CATS, FOODS, PREGS, MED_TABS, SEC_COLOR, CATS, ATTACH_ICONS, NOTICES, DEPTS, CHATS, SCREENS, DAYS7, CENSUS, INDICATORS, IND_PLAIN, ragOf, RAG, SR_STEPS, DC_MONTHS, DC_CUR, DC_STAT_FIELDS, DC_ITEMS, DC_ST, DC_GUIDES, LAST_ACTIVE, lastActive, lastActiveShort, lastActiveColor, ALL_STAFF, pillBtn, chip, catStyle, statusStyle, typeStyle, avStyle };
})();
