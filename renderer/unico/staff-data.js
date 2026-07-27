/* UNICO — Workforce / HR data: config, seed staff, store, analytics (mirrors NEMS) */
(function(){
  const DEPARTMENTS=["ER","OPD","NICU","MICU","SICU","CCU","CT ICU","Level-10","Level-9","Level-11",
    "LDR","Dialysis","Endoscopy","Cath Lab","General OT","Cardiac OT","Radiology","HomeCare","DayCare",
    "Oncology","Infection Control","Training & Development","Management","Vaccination Room"];
  const DESIGNATIONS=["Staff Nurse","Senior Staff Nurse","Charge Nurse","Acting Charge Nurse",
    "Team Leader","Assistant Nurse Manager","Nurse Manager","Senior Manager","Instructor","Infection Control Nurse","Supervisor"];
  // Bangladesh (BNMC) nursing qualifications — full current list; legacy short forms kept
  // at the end so already-recorded values still match their chip.
  // One valid name per qualification (no short-code duplicates like "B.Sc" vs
  // "B.Sc in Nursing"). Common degrees first, then specialised diplomas.
  const QUALIFICATIONS=[
    "Diploma in Nursing","Diploma in Midwifery",
    "B.Sc in Nursing","Post Basic B.Sc in Nursing","B.Sc in Public Health Nursing",
    "M.Sc in Nursing","Master of Nursing (MN)","M.Phil in Nursing","PhD in Nursing","MPH","NCLEX-RN",
    "Community Health Nursing","Diploma in Renal Nursing","Diploma in Cardiac Nursing",
    "Diploma in Critical Care Nursing","Diploma in Orthopaedic Nursing",
    "Diploma in Psychiatric / Mental Health Nursing","Diploma in Anaesthesia",
    "Diploma in OT / Operating Room Nursing"];
  const VACCINATION_STATES=["Completed","3rd Dose","2nd Dose","1st Dose","Not Completed","Unknown"];
  // Collapse any free-text Hep-B value (imports, typos) into one canonical state, so the
  // chart/compliance never fragment again ("Not completed" vs "Not Completed", "Vacinated",
  // "3 dose done" -> 3rd Dose, "2 doses taken" -> 2nd Dose…). Order matters: check "not …"
  // first, then the dose numbers (before the generic "completed"/"vaccinated").
  function canonVacc(v){
    var s=String(v||'').trim().toLowerCase();
    if(!s) return 'Unknown';
    if(/not\s*(complet|vacc?inat|done|taken)/.test(s)||/^no\b/.test(s)) return 'Not Completed';
    if(/^(unknown|n\/?a|na|nil|none|pending|-)$/.test(s)) return 'Unknown';
    if(/(^|\D)3\s*(rd)?\s*dose|dose\s*3|third/.test(s)) return '3rd Dose';
    if(/(^|\D)2\s*(nd)?\s*doses?|dose\s*2|second/.test(s)) return '2nd Dose';
    if(/(^|\D)1\s*(st)?\s*dose|dose\s*1|first/.test(s)) return '1st Dose';
    if(/^complet/.test(s)||/vacc?inat/.test(s)||/full/.test(s)) return 'Completed';
    return 'Unknown';
  }
  const TRAININGS=["BLS","ACLS","PALS","Neonatal Resuscitation (NRP)","First Aid","CPR",
    "ICU / Critical Care","Ventilator Management","Wound Care","IV Cannulation","Phlebotomy",
    "Dialysis","Cath Lab Assist","OT Scrub","Triage","Infection Control","Medication Safety","Fire Safety"];

  // PCA (Patient Care Assistant) role config
  const ROLES=["Nurse","PCA"];
  const PCA_DESIGNATIONS=["Patient Care Assistant","Senior PCA","ICU PCA","Ward Assistant","OT Helper","PCA Trainee"];
  const PCA_QUALIFICATIONS=["SSC","HSC","PCA Certificate","Care Giving Course","Nursing Aide Diploma","Basic First Aid"];
  const PCA_TRAININGS=["BLS","Patient Handling","Hygiene & Bed Care","Infection Control","Vital Signs","Specimen Transport",""];
  // ---------- custom field options (managed in Settings → Staff Fields) ----------
  // Admins can extend the Education (qualification), Designation and Training option
  // lists without a code change. Stored in localStorage, merged on top of the defaults.
  const FIELDOPT_KEY='unico_staff_fieldopts_v1';
  function loadFieldOpts(){ try{const o=JSON.parse(localStorage.getItem(FIELDOPT_KEY));return (o&&typeof o==='object'&&!Array.isArray(o))?o:{};}catch(e){return {};} }
  function fieldOptList(kind){ const o=loadFieldOpts(); return Array.isArray(o[kind])?o[kind]:[]; }
  function addFieldOpt(kind,val){ val=String(val||'').trim(); if(!val) return false; const o=loadFieldOpts(); const a=Array.isArray(o[kind])?o[kind]:[]; if(a.some(x=>x.toLowerCase()===val.toLowerCase())) return false; a.push(val); o[kind]=a; try{localStorage.setItem(FIELDOPT_KEY,JSON.stringify(o));}catch(e){} return true; }
  function removeFieldOpt(kind,val){ const o=loadFieldOpts(); o[kind]=(o[kind]||[]).filter(x=>x!==val); try{localStorage.setItem(FIELDOPT_KEY,JSON.stringify(o));}catch(e){} }

  function designationsFor(role){ const base=role==="PCA"?PCA_DESIGNATIONS:DESIGNATIONS; return [...base,...fieldOptList(role==="PCA"?'pca_designations':'designations')]; }
  function qualificationsFor(role){ const base=role==="PCA"?PCA_QUALIFICATIONS:QUALIFICATIONS; return [...base,...fieldOptList(role==="PCA"?'pca_qualifications':'qualifications')]; }

  // ---------- custom field CATEGORIES (fully dynamic, admin-defined) ----------
  // Each definition: {id, name, kind:'single'|'multi'|'text', options:[]}. Admins add
  // these in Settings → Staff Fields; the Add/Edit Staff form renders one input per
  // definition and stores values on the staff record under e.custom[id].
  const CF_KEY='unico_staff_customfields_v1';
  function loadCustomFields(){ try{const a=JSON.parse(localStorage.getItem(CF_KEY));return Array.isArray(a)?a:[];}catch(e){return [];} }
  function saveCustomFields(a){ try{localStorage.setItem(CF_KEY,JSON.stringify(a));}catch(e){} }
  function customFields(){ return loadCustomFields(); }
  function addCustomField(name,kind){ name=String(name||'').trim(); if(!name) return null;
    const a=loadCustomFields();
    const base='cf_'+(name.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'')||'field');
    let id=base,n=2; while(a.some(f=>f.id===id)){ id=base+'_'+(n++); }
    const def={id,name,kind:(kind==='multi'||kind==='text')?kind:'single',options:[]};
    a.push(def); saveCustomFields(a); return def; }
  function removeCustomField(id){ saveCustomFields(loadCustomFields().filter(f=>f.id!==id)); }
  function renameCustomField(id,name){ name=String(name||'').trim(); if(!name) return; saveCustomFields(loadCustomFields().map(f=>f.id===id?{...f,name}:f)); }
  function addCustomFieldOption(id,val){ val=String(val||'').trim(); if(!val) return false; let done=false;
    saveCustomFields(loadCustomFields().map(f=>{ if(f.id!==id) return f; const opts=Array.isArray(f.options)?f.options:[];
      if(opts.some(x=>x.toLowerCase()===val.toLowerCase())) return f; done=true; return {...f,options:[...opts,val]}; }));
    return done; }
  function removeCustomFieldOption(id,val){ saveCustomFields(loadCustomFields().map(f=>f.id===id?{...f,options:(f.options||[]).filter(x=>x!==val)}:f)); }

  const FIRST=["Ayesha","Farzana","Nusrat","Tahmina","Ruma","Shirin","Kamrun","Sabina","Rokeya","Mahmuda",
    "Salma","Nasrin","Jahanara","Rebeka","Parvin","Shahida","Morsheda","Anjuman","Dilruba","Hosne",
    "Rakib","Sohel","Imran","Jahid","Mizan","Faruk","Arif","Masud","Sumon","Tanvir",
    "Robiul","Shamim","Hasan","Kawsar","Babul","Nayeem","Saiful","Jewel"];
  const LAST=["Akter","Begum","Khatun","Rahman","Islam","Hossain","Sultana","Nahar","Chowdhury","Ahmed",
    "Khan","Sarkar","Das","Roy","Haque","Mia","Uddin","Siddiqua","Jahan","Parvez"];

  // deterministic PRNG
  function lcg(seed){ let s=seed%2147483647; if(s<=0)s+=2147483646; return ()=> (s=s*16807%2147483647)/2147483647; }

  function seedStaff(){
    const rnd=lcg(98765); const out=[];
    function push(nameIdx, role){
      const first=FIRST[nameIdx%FIRST.length], last=LAST[(nameIdx*7+3)%LAST.length];
      const dept=DEPARTMENTS[Math.floor(rnd()*DEPARTMENTS.length)];
      let desig, qual, trainPool, trainProb;
      if(role==='PCA'){
        const dr=rnd(); desig = dr<0.55?"Patient Care Assistant":dr<0.74?"Senior PCA":dr<0.85?"Ward Assistant":dr<0.93?"ICU PCA":PCA_DESIGNATIONS[Math.floor(rnd()*PCA_DESIGNATIONS.length)];
        qual=PCA_QUALIFICATIONS[Math.floor(rnd()*4)]; trainPool=PCA_TRAININGS; trainProb=0.6;
      } else {
        const dr=rnd(); desig = dr<0.5?"Staff Nurse":dr<0.72?"Senior Staff Nurse":dr<0.84?"Charge Nurse":
          dr<0.9?"Acting Charge Nurse":dr<0.94?"Team Leader":dr<0.97?"Nurse Manager":DESIGNATIONS[Math.floor(rnd()*DESIGNATIONS.length)];
        qual=QUALIFICATIONS[Math.floor(rnd()*4)]; trainPool=TRAININGS; trainProb=0.78;
      }
      const startY=2018, span=8.2; const yfrac=rnd()*span; const doyear=startY+Math.floor(yfrac);
      const domonth=1+Math.floor(rnd()*12); const doday=1+Math.floor(rnd()*27);
      const doj=`${doyear}-${String(domonth).padStart(2,'0')}-${String(doday).padStart(2,'0')}`;
      const expYears=Math.round((2026.4 - (doyear+ (domonth-1)/12))*10)/10 + Math.round(rnd()*3*10)/10;
      const vr=rnd(); const vacc = vr<0.55?"Completed":vr<0.68?"3rd Dose":vr<0.80?"2nd Dose":vr<0.88?"1st Dose":vr<0.95?"Not Completed":"Unknown";
      const training = rnd()<trainProb ? trainPool[Math.floor(rnd()*(trainPool.length-1))] : "";
      const hasPhone = rnd()<0.85;
      const phone = hasPhone ? `01${[3,5,6,7,8,9][Math.floor(rnd()*6)]}${Math.floor(10000000+rnd()*89999999)}` : "";
      const idx=out.length;
      out.push({
        id:idx+1, emp_id:`UNC-${String(101+idx).padStart(4,'0')}`, role,
        name:`${first} ${last}`, phone,
        qualification:qual, designation:desig, current_department:dept,
        doj, total_experience_years:Math.max(0.3,Math.round(expYears*10)/10),
        total_experience_text: expYears<1?`${Math.max(1,Math.round(expYears*12))} months`:`${expYears.toFixed(1)} yrs`,
        previous_experience: rnd()<0.4?`${1+Math.floor(rnd()*6)} yrs at other facility`:"",
        special_training:training,
        hepatitis_b_vaccination:vacc,
        remarks: rnd()<0.2?"On night rotation":"",
        is_active:true, notes:[], created_at:Date.now()
      });
    }
    for(let i=0;i<38;i++) push(i,'Nurse');
    for(let i=0;i<18;i++) push(i+9,'PCA');
    return out;
  }

  function byRole(list){ const m={}; list.filter(e=>e.is_active).forEach(e=>{const k=e.role||'Nurse';m[k]=(m[k]||0)+1;}); return Object.entries(m); }
  function uniqueVals(list,key){ return [...new Set(list.filter(e=>e.is_active&&e[key]&&e[key].trim()).map(e=>e[key].trim()))].sort(); }

  // ---------- analytics (mirror services/analytics.py) ----------
  const VACC_OK=["Completed","3rd Dose"];
  function kpis(list){
    const active=list.filter(e=>e.is_active);
    const total=active.length;
    const depts=new Set(active.map(e=>e.current_department).filter(Boolean)).size;
    if(!total) return {total_staff:0,departments:0,vaccinated_pct:0,trained_pct:0};
    const vacc=active.filter(e=>VACC_OK.includes(canonVacc(e.hepatitis_b_vaccination))).length;
    const trained=active.filter(e=>e.special_training&&e.special_training.trim()).length;
    return {total_staff:total,departments:depts,
      vaccinated_pct:Math.round(vacc*1000/total)/10, trained_pct:Math.round(trained*1000/total)/10};
  }
  function countBy(list,key){
    const m={}; list.filter(e=>e.is_active&&e[key]).forEach(e=>{m[e[key]]=(m[e[key]]||0)+1;});
    return Object.entries(m).sort((a,b)=>b[1]-a[1]);
  }
  function vaccinationBreakdown(list){
    const m={}; list.filter(e=>e.is_active).forEach(e=>{const k=canonVacc(e.hepatitis_b_vaccination);m[k]=(m[k]||0)+1;});
    return Object.entries(m).sort((a,b)=>b[1]-a[1]);
  }
  /* ---------- experience model ------------------------------------------------
     TOTAL experience = PRIOR experience (before UNICO) + UNICO tenure (from DOJ).
     Prior experience is entered structurally in the Add/Edit form as a dynamic
     list `prior_experience_entries` = [{org, years, months}, …]; its sum is the
     canonical prior value. Legacy records (no structured prior) fall back to the
     stored numeric field / the messy free-text so nothing is lost. */

  // UNICO tenure from Date of Joining, in decimal years (0 if unknown / future).
  function unicoYearsOf(e){
    if(!e||!e.doj) return 0;
    const d=new Date(e.doj); if(isNaN(d)) return 0;
    const now=new Date(); if(d>now) return 0;
    let months=(now.getFullYear()-d.getFullYear())*12+(now.getMonth()-d.getMonth());
    if(now.getDate()<d.getDate()) months--;
    if(months<0) months=0;
    return months/12;
  }
  // Sum of the structured prior-experience entries, in years. Returns null when no
  // structured prior was ever entered (so the legacy fallback path is used).
  function priorYearsOf(e){
    if(!e) return null;
    if(Array.isArray(e.prior_experience_entries) && e.prior_experience_entries.length){
      return e.prior_experience_entries.reduce((s,x)=>
        s + (parseFloat(x&&x.years)||0) + (parseFloat(x&&x.months)||0)/12, 0);
    }
    if(e.prior_experience_years!=null && e.prior_experience_years!=='' && !isNaN(e.prior_experience_years))
      return +e.prior_experience_years;
    return null;
  }
  // TOTAL experience in years. Structured prior (+ UNICO) wins; otherwise the
  // stored total, otherwise the parsed free-text, otherwise UNICO tenure alone.
  function expYears(e){
    if(!e) return null;
    const prior=priorYearsOf(e);
    if(prior!=null) return Math.round((prior+unicoYearsOf(e))*10)/10;
    const n=e.total_experience_years;
    if(n!=null && n!=='' && !isNaN(n)) return +n;
    const parsed=parseExpText(e.total_experience_text);
    if(parsed!=null) return parsed;
    const u=unicoYearsOf(e);
    return u>0 ? Math.round(u*10)/10 : null;
  }
  // Parse messy free-text into years — "26 yrs","19 Years","3YRS","8 Month",
  // "7 MONTHS","1.4Years(ward)","5.10 Yrs", blank, etc. (months vs years aware).
  function parseExpText(t){
    if(t==null) return null;
    const s=String(t).toLowerCase();
    const m=s.match(/\d+(?:\.\d+)?/);          // first number in the string
    if(!m) return null;
    const v=parseFloat(m[0]);
    if(isNaN(v)) return null;
    // months only when a month unit is present and no year unit is
    if(/m\s*o\s*nth|\bmos?\b/.test(s) && !/y\s*(?:r|ear)/.test(s)) return Math.round((v/12)*1000)/1000;
    return v;                                   // default unit is years
  }
  // "X yr Y mo" from a decimal-year value; compact, human-readable.
  function fmtYM(y){
    if(y==null||isNaN(y)) return '—';
    const totalMo=Math.max(0,Math.round(y*12)); const yr=Math.floor(totalMo/12), mo=totalMo%12;
    if(yr&&mo) return `${yr} yr${yr>1?'s':''} ${mo} mo`;
    if(yr) return `${yr} yr${yr>1?'s':''}`;
    return `${mo||0} mo`;
  }
  // Consistent short label for tables, e.g. "26 yrs", "1.5 yrs", "8 mo".
  function expLabel(e){
    const y=expYears(e);
    if(y==null) return (e&&e.total_experience_text)||'—';
    if(y<1){ const mo=Math.max(1,Math.round(y*12)); return `${mo} mo`; }
    const r=Math.round(y*10)/10;
    return `${Number.isInteger(r)?r:r.toFixed(1)} yrs`;
  }
  function experienceBuckets(list){
    const b={"<1y":0,"1-3y":0,"3-5y":0,"5-10y":0,"10y+":0};
    list.filter(e=>e.is_active).forEach(e=>{const y=expYears(e); if(y==null)return;
      if(y<1)b["<1y"]++;else if(y<3)b["1-3y"]++;else if(y<5)b["3-5y"]++;else if(y<10)b["5-10y"]++;else b["10y+"]++;});
    return Object.entries(b);
  }
  function joinersByYear(list){
    const m={}; list.filter(e=>e.is_active&&e.doj).forEach(e=>{const y=e.doj.slice(0,4);m[y]=(m[y]||0)+1;});
    return Object.entries(m).sort((a,b)=>a[0]-b[0]);
  }
  function recentJoiners(list,n=6){
    return list.filter(e=>e.is_active&&e.doj).sort((a,b)=>b.doj.localeCompare(a.doj)).slice(0,n);
  }
  function compliance(list){
    const a=list.filter(e=>e.is_active);
    const missing_vaccination=a.filter(e=>["Not Completed","Unknown","1 dose"].includes(e.hepatitis_b_vaccination));
    const missing_training=a.filter(e=>!e.special_training||!e.special_training.trim());
    const missing_phone=a.filter(e=>!e.phone||!e.phone.trim());
    return {missing_vaccination,missing_training,missing_phone};
  }
  function anniversaries(list,nDays=45){
    const today=new Date(); const horizon=new Date(today.getTime()+nDays*86400000); const out=[];
    list.filter(e=>e.is_active&&e.doj).forEach(e=>{
      const d=new Date(e.doj); let annv=new Date(today.getFullYear(),d.getMonth(),d.getDate());
      if(annv<today) annv=new Date(today.getFullYear()+1,d.getMonth(),d.getDate());
      if(annv>=today&&annv<=horizon){ const years=annv.getFullYear()-d.getFullYear(); if(years>0) out.push({e,annv,years}); }
    });
    return out.sort((a,b)=>a.annv-b.annv);
  }

  // ---------- store ----------
  const KEY='unico_staff_v3';
  function realSeed(){ return (window.STAFF_SEED&&window.STAFF_SEED.length)
    ? window.STAFF_SEED.map(e=>({...e,fav:!!e.fav,notes:e.notes||[]}))
    : seedStaff(); }
  function load(){ try{const s=JSON.parse(localStorage.getItem(KEY)); return Array.isArray(s)?s:null;}catch(e){return null;} }
  function useStaffStore(){
    const [staff,setStaff]=React.useState(()=>load()||realSeed());
    React.useEffect(()=>{ localStorage.setItem(KEY,JSON.stringify(staff)); },[staff]);
    const api={
      staff,
      get:(id)=>staff.find(e=>e.id===id),
      nextEmpId:()=>{ const max=staff.reduce((m,e)=>{const n=parseInt((e.emp_id||'').replace(/\D/g,''))||0;return Math.max(m,n);},100); return `UNC-${String(max+1).padStart(4,'0')}`; },
      create:(data)=>setStaff(s=>{ const id=Math.max(0,...s.map(e=>e.id))+1; return [...s,{id,is_active:true,notes:[],created_at:Date.now(),...data}]; }),
      update:(id,patch)=>setStaff(s=>s.map(e=>e.id===id?{...e,...patch}:e)),
      // Deactivating a staff member archives them: they leave the active roster AND
      // move to Previous Staff (which keys on `former`). Keep first-archived timestamp.
      remove:(id,reason)=>setStaff(s=>s.map(e=>e.id===id?{...e,is_active:false,former:true,archived_at:e.archived_at||Date.now(),archived_reason:reason||e.archived_reason||'Deactivated from roster'}:e)),
      restore:(id)=>setStaff(s=>s.map(e=>e.id===id?{...e,is_active:true,former:false,archived_at:null,archived_reason:''}:e)),
      destroy:(id)=>setStaff(s=>s.filter(e=>e.id!==id)),
      addNote:(id,text)=>setStaff(s=>s.map(e=>e.id===id?{...e,notes:[...(e.notes||[]),{id:Date.now(),text,author:'Dr. A. Rahman',ts:Date.now()}]}:e)),
      delNote:(id,nid)=>setStaff(s=>s.map(e=>e.id===id?{...e,notes:(e.notes||[]).filter(n=>n.id!==nid)}:e)),
      toggleFav:(id)=>setStaff(s=>s.map(e=>e.id===id?{...e,fav:!e.fav}:e)),
      reset:()=>setStaff(realSeed())
    };
    return api;
  }

  window.STAFF={DEPARTMENTS,DESIGNATIONS,QUALIFICATIONS,VACCINATION_STATES,TRAININGS,VACC_OK,canonVacc,
    ROLES,PCA_DESIGNATIONS,PCA_QUALIFICATIONS,PCA_TRAININGS,designationsFor,qualificationsFor,
    fieldOptList,addFieldOpt,removeFieldOpt,
    customFields,addCustomField,removeCustomField,renameCustomField,addCustomFieldOption,removeCustomFieldOption,
    seedStaff,kpis,countBy,vaccinationBreakdown,experienceBuckets,expYears,expLabel,priorYearsOf,unicoYearsOf,fmtYM,joinersByYear,recentJoiners,compliance,anniversaries,byRole,uniqueVals};
  window.useStaffStore=useStaffStore;
})();
