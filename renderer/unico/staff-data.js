/* UNICO — Workforce / HR data: config, seed staff, store, analytics (mirrors NEMS) */
(function(){
  const DEPARTMENTS=["MICU","SICU","CCU","NICU","Emergency","Dialysis","LDR","Level-10","Level-9",
    "Endoscopy","Cath Lab","OT","OPD","Oncology","Radiology","DayCare","HomeCare","Infection Control",
    "Quality & Training","Cardiology"];
  const DESIGNATIONS=["Staff Nurse","Senior Staff Nurse","Charge Nurse","Acting Charge Nurse",
    "Nurse Manager","Senior Manager","Instructor","Team Leader","Infection Control Nurse","Supervisor","OT Incharge Nurse"];
  const QUALIFICATIONS=["Diploma","B.Sc","Post B.Sc","PBSC","BSC MSN","MSS","NCLEX RN","Diploma in Midwifery","Diploma in Renal Nursing"];
  const VACCINATION_STATES=["Completed","Vaccinated","1 dose","2 dose","3 dose","Not Completed","Unknown"];
  const TRAININGS=["BLS","ACLS","ICU Care","Wound Care","Dialysis","Infection Control","Cath Lab Assist",
    "OT Scrub","Neonatal Resuscitation","Triage","Phlebotomy","Ventilator Management",""];

  // PCA (Patient Care Assistant) role config
  const ROLES=["Nurse","PCA"];
  const PCA_DESIGNATIONS=["Patient Care Assistant","Senior PCA","ICU PCA","Ward Assistant","OT Helper","PCA Trainee"];
  const PCA_QUALIFICATIONS=["SSC","HSC","PCA Certificate","Care Giving Course","Nursing Aide Diploma","Basic First Aid"];
  const PCA_TRAININGS=["BLS","Patient Handling","Hygiene & Bed Care","Infection Control","Vital Signs","Specimen Transport",""];
  function designationsFor(role){ return role==="PCA"?PCA_DESIGNATIONS:DESIGNATIONS; }
  function qualificationsFor(role){ return role==="PCA"?PCA_QUALIFICATIONS:QUALIFICATIONS; }

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
      const vr=rnd(); const vacc = vr<0.58?"Completed":vr<0.70?"3 dose":vr<0.80?"2 dose":vr<0.88?"1 dose":vr<0.95?"Not Completed":"Unknown";
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
  const VACC_OK=["Completed","Vaccinated","3 dose"];
  function kpis(list){
    const active=list.filter(e=>e.is_active);
    const total=active.length;
    const depts=new Set(active.map(e=>e.current_department).filter(Boolean)).size;
    if(!total) return {total_staff:0,departments:0,vaccinated_pct:0,trained_pct:0};
    const vacc=active.filter(e=>VACC_OK.includes(e.hepatitis_b_vaccination)).length;
    const trained=active.filter(e=>e.special_training&&e.special_training.trim()).length;
    return {total_staff:total,departments:depts,
      vaccinated_pct:Math.round(vacc*1000/total)/10, trained_pct:Math.round(trained*1000/total)/10};
  }
  function countBy(list,key){
    const m={}; list.filter(e=>e.is_active&&e[key]).forEach(e=>{m[e[key]]=(m[e[key]]||0)+1;});
    return Object.entries(m).sort((a,b)=>b[1]-a[1]);
  }
  function vaccinationBreakdown(list){
    const m={}; list.filter(e=>e.is_active).forEach(e=>{const k=e.hepatitis_b_vaccination||"Unknown";m[k]=(m[k]||0)+1;});
    return Object.entries(m).sort((a,b)=>b[1]-a[1]);
  }
  function experienceBuckets(list){
    const b={"<1y":0,"1-3y":0,"3-5y":0,"5-10y":0,"10y+":0};
    list.filter(e=>e.is_active).forEach(e=>{const y=e.total_experience_years; if(y==null)return;
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
      remove:(id)=>setStaff(s=>s.map(e=>e.id===id?{...e,is_active:false}:e)),
      restore:(id)=>setStaff(s=>s.map(e=>e.id===id?{...e,is_active:true}:e)),
      destroy:(id)=>setStaff(s=>s.filter(e=>e.id!==id)),
      addNote:(id,text)=>setStaff(s=>s.map(e=>e.id===id?{...e,notes:[...(e.notes||[]),{id:Date.now(),text,author:'Dr. A. Rahman',ts:Date.now()}]}:e)),
      delNote:(id,nid)=>setStaff(s=>s.map(e=>e.id===id?{...e,notes:(e.notes||[]).filter(n=>n.id!==nid)}:e)),
      toggleFav:(id)=>setStaff(s=>s.map(e=>e.id===id?{...e,fav:!e.fav}:e)),
      reset:()=>setStaff(realSeed())
    };
    return api;
  }

  window.STAFF={DEPARTMENTS,DESIGNATIONS,QUALIFICATIONS,VACCINATION_STATES,TRAININGS,VACC_OK,
    ROLES,PCA_DESIGNATIONS,PCA_QUALIFICATIONS,PCA_TRAININGS,designationsFor,qualificationsFor,
    seedStaff,kpis,countBy,vaccinationBreakdown,experienceBuckets,joinersByYear,recentJoiners,compliance,anniversaries,byRole,uniqueVals};
  window.useStaffStore=useStaffStore;
})();
