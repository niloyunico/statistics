// UNICO HOSPITALS PLC — Patient Flow Census data
// Transcribed from "Patient flow census – up to April 2026"
// Months use short labels; each department lists only the months it reports.

// Lifetime month catalog: generated across many years so the suite keeps working
// indefinitely — every month gets a proper label and a stable chronological order
// (sorting/period logic everywhere relies on MONTH_ORDER.indexOf).
const _MMM  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const _MFULL= ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_FULL = {};
const MONTH_ORDER = [];
for (let y = 2024; y <= 2045; y++) {
  for (let m = 0; m < 12; m++) {
    const key = _MMM[m] + '-' + String(y).slice(-2);
    MONTHS_FULL[key] = _MFULL[m] + ' ' + y;
    MONTH_ORDER.push(key);
  }
}

// helper to build row objects from column ids + a values array
function rows(months, vals){
  return months.map((m,i)=>({ month:m, v:vals[i] }));
}

const DEPARTMENTS = [
  {
    id:"er", name:"Emergency Medicine", short:"ER", group:"Critical & Emergency",
    desc:"Emergency department registrations, admissions & disposition.",
    primary:"total", primaryLabel:"Total ED Patients",
    cols:[
      {id:"reg",label:"ER Reg Cases"},{id:"adm",label:"Admission"},
      {id:"conv",label:"IPD Conversion",pct:true},{id:"lama",label:"LAMA"},
      {id:"daycare",label:"Day Care"},{id:"proc",label:"Procedure"},
      {id:"mlc",label:"MLC"},{id:"ref",label:"Referral"},
      {id:"death",label:"Brought Death"},{id:"total",label:"Total ED"}
    ],
    months:["Aug-25","Sep-25","Oct-25","Nov-25","Dec-25","Jan-26","Feb-26","Mar-26","Apr-26"],
    data:[
      {reg:11,adm:3,conv:27.27,lama:2,daycare:27,proc:3,mlc:0,ref:0,death:0,total:41},
      {reg:27,adm:12,conv:44.44,lama:4,daycare:33,proc:17,mlc:0,ref:0,death:0,total:77},
      {reg:31,adm:20,conv:64.52,lama:3,daycare:20,proc:4,mlc:0,ref:0,death:0,total:55},
      {reg:43,adm:28,conv:65.12,lama:4,daycare:38,proc:29,mlc:0,ref:0,death:0,total:110},
      {reg:34,adm:26,conv:76.47,lama:0,daycare:21,proc:41,mlc:0,ref:0,death:1,total:97},
      {reg:67,adm:43,conv:65.15,lama:8,daycare:30,proc:19,mlc:5,ref:0,death:1,total:116},
      {reg:61,adm:39,conv:63.93,lama:3,daycare:26,proc:11,mlc:0,ref:1,death:0,total:98},
      {reg:108,adm:79,conv:73.15,lama:8,daycare:15,proc:14,mlc:0,ref:0,death:0,total:108},
      {reg:78,adm:61,conv:78.21,lama:7,daycare:78,proc:13,mlc:1,ref:1,death:0,total:169}
    ]
  },
  {
    id:"opd", name:"Out-Patient Department", short:"OPD", group:"Out-Patient",
    desc:"Total OPD footfall across all consultants.",
    primary:"opd", primaryLabel:"OPD Patients",
    cols:[{id:"opd",label:"OPD Patients"}],
    months:["Jan-25","Feb-25","Mar-25","Apr-25","May-25","Jun-25","Jul-25","Aug-25","Sep-25","Oct-25","Nov-25","Dec-25","Jan-26","Feb-26","Mar-26","Apr-26"],
    data:[198,111,74,209,296,336,610,976,1085,1244,1346,1159,1508,1635,1568,2689].map(v=>({opd:v}))
  },
  {
    id:"nicu", name:"Neonatal ICU", short:"NICU", group:"Critical & Emergency",
    desc:"Monthly neonatal intensive care patient flow.",
    primary:"nicu", primaryLabel:"NICU Patients",
    cols:[{id:"nicu",label:"NICU Patients"}],
    months:["Oct-25","Nov-25","Dec-25","Jan-26","Feb-26","Mar-26","Apr-26","May-26"],
    data:[1,6,4,6,7,5,2,10].map(v=>({nicu:v}))
  },
  {
    id:"endoscopy", name:"Endoscopy", short:"Endo", group:"Procedural",
    desc:"GI & pulmonary endoscopic procedures.",
    primary:"total", primaryLabel:"Total Procedures",
    cols:[
      {id:"endo",label:"Endoscopy"},{id:"colon",label:"Colonoscopy"},
      {id:"polyp",label:"Polypectomy"},{id:"histo",label:"Histopathology"},
      {id:"bronch",label:"Bronchoscopy"},{id:"pluro",label:"Pluroscopy"},
      {id:"total",label:"Total"}
    ],
    months:["Sep-25","Oct-25","Nov-25","Dec-25","Jan-26","Feb-26","Mar-26","Apr-26","May-26"],
    data:[
      {endo:1,colon:0,polyp:0,histo:0,bronch:0,pluro:0,total:1},
      {endo:6,colon:3,polyp:4,histo:0,bronch:0,pluro:0,total:13},
      {endo:5,colon:0,polyp:5,histo:0,bronch:0,pluro:0,total:10},
      {endo:2,colon:0,polyp:3,histo:1,bronch:0,pluro:0,total:6},
      {endo:3,colon:0,polyp:7,histo:0,bronch:0,pluro:0,total:10},
      {endo:7,colon:0,polyp:9,histo:0,bronch:2,pluro:1,total:19},
      {endo:1,colon:0,polyp:5,histo:0,bronch:2,pluro:0,total:8},
      {endo:14,colon:15,polyp:3,histo:5,bronch:3,pluro:2,total:42},
      {endo:12,colon:8,polyp:5,histo:18,bronch:3,pluro:1,total:47}
    ]
  },
  {
    id:"ot", name:"Operation Theatre", short:"OT", group:"Procedural",
    desc:"Total surgical cases performed monthly.",
    primary:"ot", primaryLabel:"OT Patients",
    cols:[{id:"ot",label:"Total OT Patients"}],
    months:["Oct-25","Nov-25","Dec-25","Jan-26","Feb-26","Mar-26","Apr-26"],
    data:[12,20,33,24,32,32,31].map(v=>({ot:v}))
  },
  {
    id:"sicu", name:"Surgical ICU", short:"SICU", group:"Critical & Emergency",
    desc:"Surgical intensive care patient flow.",
    primary:"sicu", primaryLabel:"SICU Patients",
    cols:[{id:"sicu",label:"SICU Patients"}],
    months:["Aug-25","Sep-25","Oct-25","Nov-25","Dec-25","Jan-26","Feb-26","Mar-26","Apr-26"],
    data:[2,4,8,2,3,3,0,0,1].map(v=>({sicu:v}))
  },
  {
    id:"dialysis", name:"Dialysis", short:"Dialysis", group:"Procedural",
    desc:"Renal replacement therapy — modality breakdown.",
    primary:"total", primaryLabel:"Total Dialysis",
    cols:[
      {id:"total",label:"Total Dialysis"},{id:"ipd",label:"IPD Patients"},
      {id:"opd",label:"OPD Patients"},{id:"conv",label:"Conventional"},
      {id:"modi",label:"Modi-SLED"},{id:"sled",label:"SLED"}
    ],
    months:["Nov-25","Dec-25","Jan-26","Feb-26","Mar-26","Apr-26","May-26"],
    data:[
      {total:3,ipd:1,opd:2,conv:2,modi:1,sled:0},
      {total:1,ipd:0,opd:1,conv:1,modi:0,sled:0},
      {total:17,ipd:15,opd:2,conv:7,modi:2,sled:8},
      {total:12,ipd:10,opd:2,conv:8,modi:1,sled:3},
      {total:18,ipd:5,opd:13,conv:18,modi:0,sled:0},
      {total:60,ipd:19,opd:41,conv:54,modi:1,sled:5},
      {total:74,ipd:21,opd:53,conv:57,modi:7,sled:10}
    ]
  },
  {
    id:"lvl10", name:"Level 10 Ward", short:"L10", group:"In-Patient Wards",
    desc:"Ward 10 admissions, discharges & transfers.",
    primary:"adm", primaryLabel:"Admissions",
    cols:[
      {id:"adm",label:"Admission"},{id:"dis",label:"Discharge"},
      {id:"tin",label:"Transfer In"},{id:"tout",label:"Transfer Out"}
    ],
    months:["Jul-25","Aug-25","Sep-25","Oct-25","Nov-25","Dec-25","Jan-26","Feb-26","Mar-26","Apr-26","May-26"],
    data:[
      {adm:6,dis:4,tin:0,tout:0},{adm:10,dis:8,tin:0,tout:0},
      {adm:23,dis:20,tin:0,tout:0},{adm:38,dis:34,tin:0,tout:0},
      {adm:52,dis:53,tin:0,tout:0},{adm:57,dis:59,tin:0,tout:0},
      {adm:60,dis:56,tin:7,tout:2},{adm:59,dis:58,tin:10,tout:4},
      {adm:82,dis:77,tin:20,tout:3},{adm:98,dis:0,tin:33,tout:4},
      {adm:96,dis:91,tin:17,tout:4}
    ]
  },
  {
    id:"lvl9", name:"Level 9 Ward", short:"L9", group:"In-Patient Wards",
    desc:"Ward 9 day-care & in-patient flow.",
    primary:"total", primaryLabel:"Total Patients",
    cols:[
      {id:"day",label:"Day Care"},{id:"ipd",label:"IPD"},
      {id:"total",label:"Total Patients"},{id:"tin",label:"Transfer In"},{id:"tout",label:"Transfer Out"},
      {id:"dorb",label:"DORB"}
    ],
    months:["Jan-26","Feb-26","Mar-26","Apr-26","May-26"],
    data:[
      {day:0,ipd:3,total:3,tin:0,tout:0},
      {day:0,ipd:9,total:9,tin:0,tout:0},
      {day:8,ipd:3,total:11,tin:0,tout:0},
      {day:10,ipd:27,total:37,tin:5,tout:4},
      {day:11,ipd:18,total:29,tin:2,tout:1,dorb:1}
    ]
  },
  {
    id:"ldr", name:"Labour / Delivery / Recovery", short:"LDR", group:"In-Patient Wards",
    desc:"Maternity LDR patient flow.",
    primary:"ldr", primaryLabel:"LDR Patients",
    cols:[{id:"ldr",label:"LDR Patients"}],
    months:["Sep-25","Oct-25","Nov-25","Dec-25","Jan-26","Feb-26","Mar-26","Apr-26"],
    data:[3,6,9,6,10,12,11,13].map(v=>({ldr:v}))
  },
  {
    id:"micu", name:"Medical ICU", short:"MICU", group:"Critical & Emergency",
    desc:"Medical intensive care admissions & outcomes.",
    primary:"adm", primaryLabel:"Admissions",
    cols:[
      {id:"adm",label:"Admission"},{id:"tin",label:"TR-IN"},{id:"tout",label:"TR-OUT"},
      {id:"lama",label:"LAMA"},{id:"dama",label:"DAMA"},{id:"dis",label:"Discharge"},{id:"death",label:"Death"}
    ],
    months:["Sep-25","Oct-25","Nov-25","Dec-25","Jan-26","Feb-26","Mar-26","Apr-26"],
    data:[
      {adm:1,tin:0,tout:0,lama:0,dama:0,dis:0,death:0},
      {adm:5,tin:1,tout:4,lama:1,dama:0,dis:1,death:0},
      {adm:6,tin:3,tout:7,lama:1,dama:0,dis:0,death:0},
      {adm:5,tin:1,tout:6,lama:0,dama:0,dis:0,death:0},
      {adm:12,tin:5,tout:10,lama:4,dama:2,dis:0,death:0},
      {adm:8,tin:4,tout:8,lama:1,dama:1,dis:0,death:2},
      {adm:10,tin:2,tout:5,lama:3,dama:1,dis:0,death:3},
      {adm:16,tin:4,tout:15,lama:2,dama:0,dis:0,death:1}
    ]
  },
  {
    id:"ccu", name:"Coronary Care Unit", short:"CCU", group:"Critical & Emergency",
    desc:"Cardiac care unit admissions.",
    primary:"adm", primaryLabel:"Admissions",
    cols:[{id:"adm",label:"Admission"}],
    months:["Nov-25","Dec-25","Jan-26","Feb-26","Mar-26","Apr-26"],
    data:[5,9,14,17,18,15].map(v=>({adm:v}))
  },
  {
    id:"cathlab", name:"Cath Lab", short:"Cath", group:"Procedural",
    desc:"Interventional cardiology procedure mix.",
    primary:"total", primaryLabel:"Total Procedures",
    cols:[
      {id:"cag",label:"CAG"},{id:"pci",label:"PCI"},{id:"ppm",label:"PPM"},
      {id:"tpm",label:"TPM"},{id:"dsa",label:"DSA"},{id:"total",label:"Total"}
    ],
    months:["Aug-25","Sep-25","Oct-25","Nov-25","Dec-25","Jan-26","Feb-26","Mar-26","Apr-26","May-26"],
    data:[
      {cag:2,pci:1,ppm:0,tpm:0,dsa:0,total:3},
      {cag:3,pci:1,ppm:0,tpm:0,dsa:1,total:5},
      {cag:2,pci:1,ppm:0,tpm:0,dsa:0,total:3},
      {cag:3,pci:2,ppm:0,tpm:0,dsa:0,total:5},
      {cag:2,pci:3,ppm:0,tpm:0,dsa:0,total:5},
      {cag:4,pci:4,ppm:0,tpm:0,dsa:0,total:8},
      {cag:7,pci:4,ppm:1,tpm:1,dsa:0,total:13},
      {cag:2,pci:2,ppm:1,tpm:1,dsa:0,total:6},
      {cag:10,pci:7,ppm:0,tpm:0,dsa:2,total:19},
      {cag:7,pci:6,ppm:0,tpm:1,dsa:1,total:15}
    ]
  },
  {
    id:"ctvs", name:"Cardiothoracic & Vascular Surgery", short:"CTVS", group:"Procedural",
    desc:"Cardiac & vascular surgical procedure mix.",
    primary:"total", primaryLabel:"Total Cases",
    cols:[
      {id:"cabg",label:"CABG"},{id:"vsd",label:"VSD"},{id:"asd",label:"ASD"},
      {id:"avfistula",label:"AV Fistula"},{id:"haemangioma",label:"Excisional Haemangioma"},
      {id:"total",label:"Total"}
    ],
    months:["Apr-26","May-26"],
    data:[
      {cabg:1,vsd:1,asd:0,avfistula:1,haemangioma:1,total:4},
      {cabg:2,vsd:0,asd:3,avfistula:1,haemangioma:0,total:6}
    ]
  },
  {
    id:"homecare", name:"Home Care", short:"Home", group:"Out-Patient",
    desc:"Patients managed under home-care service.",
    primary:"home", primaryLabel:"Home Care Patients",
    cols:[{id:"home",label:"Home Care Patients"}],
    months:["Oct-25","Nov-25","Jan-26","Feb-26","Mar-26","Apr-26"],
    data:[3,8,4,14,7,9].map(v=>({home:v}))
  }
];

// attach helpers to each dept
DEPARTMENTS.forEach(d=>{
  d.fullMonths = d.months.map(m=>MONTHS_FULL[m]);
  d.series = d.data.map((row,i)=>({ month:d.months[i], full:MONTHS_FULL[d.months[i]], ...row }));
  d.total = d.series.reduce((s,r)=>s+(r[d.primary]||0),0);
  d.latest = d.series[d.series.length-1];
  d.prev = d.series.length>1 ? d.series[d.series.length-2] : null;
  const cur = d.latest[d.primary]||0;
  const prev = d.prev ? (d.prev[d.primary]||0) : 0;
  d.delta = prev===0 ? (cur>0?100:0) : Math.round(((cur-prev)/prev)*100);
  d.peak = Math.max(...d.series.map(r=>r[d.primary]||0));
});

const GROUPS = [...new Set(DEPARTMENTS.map(d=>d.group))];

// Hospital-wide rollups for the dashboard
const HOSPITAL = {
  name:"UNICO Hospitals PLC",
  reportRange:"Aug 2025 – May 2026",
  generated:"05/18/2026",
  kpis:(function(){
    const er = DEPARTMENTS.find(d=>d.id==="er");
    const opd = DEPARTMENTS.find(d=>d.id==="opd");
    const ot = DEPARTMENTS.find(d=>d.id==="ot");
    const cath = DEPARTMENTS.find(d=>d.id==="cathlab");
    return { erLatest:er.latest.total, opdTotal:opd.total, otTotal:ot.total, cathTotal:cath.total };
  })()
};

window.UNICO = { DEPARTMENTS, GROUPS, MONTHS_FULL, MONTH_ORDER, HOSPITAL };
