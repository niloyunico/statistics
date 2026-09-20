/* ===== generated chunk loader ===== */
window.__UNICO_CHUNKS__={"qualityguide":"/dist/qualityguide.chunk.js?v=d50a7373c6","staffprofile":"/dist/staffprofile.chunk.js?v=08eb088ada","reports":"/dist/reports.chunk.js?v=9e4c428dd2","quality":"/dist/quality.chunk.js?v=1e13271f23","datacollection":"/dist/datacollection.chunk.js?v=880373738e","supervisor":"/dist/supervisor.chunk.js?v=68e57a1aee","performance":"/dist/performance.chunk.js?v=991d23f89e","roster":"/dist/roster.chunk.js?v=f1bf936a26","manpower":"/dist/manpower.chunk.js?v=2280baf576","medicine":"/dist/medicine.chunk.js?v=7218a3ca36"};
window.__UNICO_CHUNK_DEPS__={"quality":["qualityguide"],"datacollection":["qualityguide"]};
(function(){
var M=window.__UNICO_CHUNKS__,D=window.__UNICO_CHUNK_DEPS__,PENDING={},READY={};
function inject(src){return new Promise(function(res,rej){var s=document.createElement("script");s.src=src;s.async=false;s.onload=function(){res(true);};s.onerror=function(){rej(new Error("Could not load "+src));};(document.head||document.documentElement).appendChild(s);});}
function staleReload(){try{if(sessionStorage.getItem("unico:chunk-reload"))return false;sessionStorage.setItem("unico:chunk-reload","1");location.reload();return true;}catch(e){return false;}}
function load(n){if(!M[n])return Promise.resolve(false);if(READY[n])return Promise.resolve(true);if(PENDING[n])return PENDING[n];PENDING[n]=Promise.all((D[n]||[]).map(load)).then(function(){return inject(M[n]);}).then(function(){READY[n]=true;PENDING[n]=null;try{sessionStorage.removeItem("unico:chunk-reload");}catch(e){}try{window.dispatchEvent(new CustomEvent("unico:chunk-loaded",{detail:n}));}catch(e){}return true;},function(e){PENDING[n]=null;staleReload();throw e;});return PENDING[n];}
window.unicoLoadChunk=load;
window.unicoChunkReady=function(n){return !!READY[n];};
window.unicoChunkNames=function(){var a=[];for(var k in M){if(Object.prototype.hasOwnProperty.call(M,k))a.push(k);}return a;};
var ORDER=["datacollection","qualityguide","quality","reports","staffprofile","roster","performance","supervisor","medicine","manpower"];
function preload(){var q=ORDER.slice();
try{var u=window.__UNICO_USER__;if(u&&["collector","incharge","nurse","pca"].indexOf(u.role)>=0){q=["datacollection"].concat(q.filter(function(n){return n!=="datacollection";}));}}catch(e){}
function next(){if(!q.length)return;var n=q.shift();load(n)["catch"](function(){})["then"](function(){setTimeout(next,150);});}
next();}
function start(){var idle=window.requestIdleCallback||function(f){return setTimeout(f,1200);};idle(function(){setTimeout(preload,600);});}
if(document.readyState==="complete")start();else window.addEventListener("load",start);
})();
/* ===== placeholders for code-split components ===== */
(function(){var N=["StaffProfile","StaffForm","UserManagement","Reports","Settings","QualityView","QualityReportsPanel","ChartsGallery","DataFields","DataPatientForm","DataQualityForm","DataReview","DataShareLinks","CollectorPortal","SubmissionAnalytics","DataCollectionSettings","SupervisorView","PerformanceView","RosterView","MedicineView"];
function ph(){return (window.React&&window.React.createElement)?window.React.createElement("div",{style:{display:"grid",placeItems:"center",height:"50vh",color:"var(--muted)",fontSize:13}},"Loading this screen\u2026"):null;}
for(var i=0;i<N.length;i++){if(typeof window[N[i]]==="undefined"){window[N[i]]=ph;window[N[i]].__unicoPlaceholder=true;}}
})();
/* ===== config.js ===== */
/* UNICO build configuration.
   Set UNICO_DEFAULT_API to the HTTPS address of YOUR deployed UNICO auth/data
   server BEFORE building the .exe. Then everyone who installs the .exe just
   signs in — no settings to configure.

   IMPORTANT: this is only the server ADDRESS (a URL), never a password. The
   database connection string lives ONLY on that server, never in this app. */
window.UNICO_DEFAULT_API = ''; // empty = NO login, app runs fully offline. Put a server URL here later to re-enable cloud login.

;
/* ===== deptmap.js ===== */
/* UNICO — client-side canonical department map helper.
 *
 * ONE place to resolve a department id or a quality-area key to the single canonical NAME
 * shown everywhere, so Statistics and Quality never disagree ("Cath Lab" not "Cathlab").
 *
 * Source of truth = window.__UNICO_DEPT_MAP__ (injected by server/web.js). BUT if that is
 * missing/empty (older server, or a page that didn't get it), we BUILD the same map on the
 * client from the always-injected globals window.__UNICO_DEPARTMENTS__ (id/name/qualityKey)
 * + window.__UNICO_QUALITY__ (key/deptId). This makes name resolution robust regardless of
 * server version, so a raw id/key is never shown where a name should be. See server/deptmap.js.
 */
(function () {
  var _cache = null;

  function buildFromGlobals() {
    var w = window;
    var deps = w.__UNICO_DEPARTMENTS__ || (w.UNICO && w.UNICO.DEPARTMENTS) || [];
    var quals = w.__UNICO_QUALITY__ || w.QUALITY_SEED || [];
    var byId = {}, idToQk = {}, qkToId = {}, patientDepts = [], allKeys = [];
    (deps || []).forEach(function (d) {
      if (!d || !d.id) return;
      byId[d.id] = { id: d.id, name: d.name || d.id, qualityKey: d.qualityKey || null };
      patientDepts.push(d.id);
      if (d.qualityKey) { idToQk[d.id] = d.qualityKey; qkToId[d.qualityKey] = d.id; }
    });
    (quals || []).forEach(function (q) {
      if (!q) return;
      var key = q.key || q._id;
      if (key) allKeys.push(key);
      var id = q.deptId || qkToId[key];
      if (key && id) {
        qkToId[key] = id; if (!idToQk[id]) idToQk[id] = key;
        // Fallback name from the quality doc when the (scoped) departments list didn't supply
        // one — e.g. a hospital-wide collector whose __UNICO_DEPARTMENTS__ is scoped to empty.
        // Ensures a real label ("OPD"/"Cathlab") instead of a raw slug id even without the
        // server-injected map; the injected map still upgrades these to canonical names.
        if (!byId[id]) byId[id] = { id: id, name: q.name || key, qualityKey: key };
      }
      if (q.deptId === '__hospital__' || key === 'Overall Hospital') {
        byId['__hospital__'] = { id: '__hospital__', name: q.name || 'Overall Hospital', qualityKey: key, qualityOnly: true };
      }
    });
    return { byId: byId, idToQk: idToQk, qkToId: qkToId, patientDepts: patientDepts, allKeys: allKeys.filter(function (v, i, a) { return a.indexOf(v) === i; }) };
  }

  function M() {
    if (_cache) return _cache;
    var injected = (typeof window !== 'undefined' && window.__UNICO_DEPT_MAP__) || null;
    if (injected && injected.byId && Object.keys(injected.byId).length) { _cache = injected; return _cache; }
    // Injected map absent/empty -> build it from the raw globals (always present).
    try { _cache = buildFromGlobals(); } catch (e) { _cache = { byId: {}, idToQk: {}, qkToId: {}, patientDepts: [], allKeys: [] }; }
    return _cache;
  }

  function nameFromId(id) { var e = M().byId[id]; return (e && e.name) || id; }
  function qkFromId(id) { return M().idToQk[id] || null; }
  function idFromQk(key) { return M().qkToId[key] || null; }
  // Canonical display name for a quality-area key (falls back to the key itself).
  function nameFromQualityKey(key) { var id = idFromQk(key); return id ? nameFromId(id) : key; }
  function isQualityOnly(id) { var e = M().byId[id]; return !!(e && e.qualityOnly); }
  function allAreaKeys() { return (M().allKeys || []).slice(); }
  function patientDeptIds() { return (M().patientDepts || []).slice(); }
  // Quality areas derived from a canonical department-id list (mirrors server deriveQualityAreas).
  function areasFromDepts(ids, allQualityAreas) {
    if (allQualityAreas) return allAreaKeys();
    var out = [];
    (ids || []).forEach(function (id) { var qk = qkFromId(id); if (qk && out.indexOf(qk) < 0) out.push(qk); });
    return out;
  }

  window.DEPTMAP = { map: M, refresh: function () { _cache = null; }, nameFromId: nameFromId, qkFromId: qkFromId, idFromQk: idFromQk, nameFromQualityKey: nameFromQualityKey, isQualityOnly: isQualityOnly, allAreaKeys: allAreaKeys, patientDeptIds: patientDeptIds, areasFromDepts: areasFromDepts };
})();

;
/* ===== departments-seed.js ===== */
/* Generated from server/seed/departments.json for offline/verification fallback. */
window.__UNICO_DEPARTMENTS_FALLBACK__ = [
  {
    "id": "er",
    "name": "Emergency Medicine",
    "short": "ER",
    "group": "Critical & Emergency",
    "desc": "Emergency department registrations, admissions & disposition.",
    "primary": "total",
    "primaryLabel": "Total ED Patients",
    "cols": [
      {
        "id": "reg",
        "label": "ER Reg Cases"
      },
      {
        "id": "adm",
        "label": "Admission"
      },
      {
        "id": "conv",
        "label": "IPD Conversion",
        "pct": true
      },
      {
        "id": "lama",
        "label": "LAMA / DAMA"
      },
      {
        "id": "daycare",
        "label": "Day Care"
      },
      {
        "id": "proc",
        "label": "Procedure"
      },
      {
        "id": "mlc",
        "label": "MLC"
      },
      {
        "id": "ref",
        "label": "Referral"
      },
      {
        "id": "death",
        "label": "Brought Death"
      },
      {
        "id": "total",
        "label": "Total ED"
      }
    ],
    "months": [
      "Aug-25",
      "Sep-25",
      "Oct-25",
      "Nov-25",
      "Dec-25",
      "Jan-26",
      "Feb-26",
      "Mar-26",
      "Apr-26"
    ],
    "data": [
      {
        "reg": 11,
        "adm": 3,
        "conv": 27.27,
        "lama": 2,
        "daycare": 27,
        "proc": 3,
        "mlc": 0,
        "ref": 0,
        "death": 0,
        "total": 41
      },
      {
        "reg": 27,
        "adm": 12,
        "conv": 44.44,
        "lama": 4,
        "daycare": 33,
        "proc": 17,
        "mlc": 0,
        "ref": 0,
        "death": 0,
        "total": 77
      },
      {
        "reg": 31,
        "adm": 20,
        "conv": 64.52,
        "lama": 3,
        "daycare": 20,
        "proc": 4,
        "mlc": 0,
        "ref": 0,
        "death": 0,
        "total": 55
      },
      {
        "reg": 43,
        "adm": 28,
        "conv": 65.12,
        "lama": 4,
        "daycare": 38,
        "proc": 29,
        "mlc": 0,
        "ref": 0,
        "death": 0,
        "total": 110
      },
      {
        "reg": 34,
        "adm": 26,
        "conv": 76.47,
        "lama": 0,
        "daycare": 21,
        "proc": 41,
        "mlc": 0,
        "ref": 0,
        "death": 1,
        "total": 97
      },
      {
        "reg": 67,
        "adm": 43,
        "conv": 65.15,
        "lama": 8,
        "daycare": 30,
        "proc": 19,
        "mlc": 5,
        "ref": 0,
        "death": 1,
        "total": 116
      },
      {
        "reg": 61,
        "adm": 39,
        "conv": 63.93,
        "lama": 3,
        "daycare": 26,
        "proc": 11,
        "mlc": 0,
        "ref": 1,
        "death": 0,
        "total": 98
      },
      {
        "reg": 108,
        "adm": 79,
        "conv": 73.15,
        "lama": 8,
        "daycare": 15,
        "proc": 14,
        "mlc": 0,
        "ref": 0,
        "death": 0,
        "total": 108
      },
      {
        "reg": 78,
        "adm": 61,
        "conv": 78.21,
        "lama": 7,
        "daycare": 78,
        "proc": 13,
        "mlc": 1,
        "ref": 1,
        "death": 0,
        "total": 169
      }
    ],
    "order": 0
  },
  {
    "id": "opd",
    "name": "Out-Patient Department",
    "short": "OPD",
    "group": "Out-Patient",
    "desc": "Total OPD footfall across all consultants.",
    "primary": "opd",
    "primaryLabel": "OPD Patients",
    "cols": [
      {
        "id": "opd",
        "label": "OPD Patients"
      }
    ],
    "months": [
      "Jan-25",
      "Feb-25",
      "Mar-25",
      "Apr-25",
      "May-25",
      "Jun-25",
      "Jul-25",
      "Aug-25",
      "Sep-25",
      "Oct-25",
      "Nov-25",
      "Dec-25",
      "Jan-26",
      "Feb-26",
      "Mar-26",
      "Apr-26"
    ],
    "data": [
      {
        "opd": 198
      },
      {
        "opd": 111
      },
      {
        "opd": 74
      },
      {
        "opd": 209
      },
      {
        "opd": 296
      },
      {
        "opd": 336
      },
      {
        "opd": 610
      },
      {
        "opd": 976
      },
      {
        "opd": 1085
      },
      {
        "opd": 1244
      },
      {
        "opd": 1346
      },
      {
        "opd": 1159
      },
      {
        "opd": 1508
      },
      {
        "opd": 1635
      },
      {
        "opd": 1568
      },
      {
        "opd": 2689
      }
    ],
    "order": 1
  },
  {
    "id": "nicu",
    "name": "Neonatal ICU",
    "short": "NICU",
    "group": "Critical & Emergency",
    "desc": "Monthly neonatal intensive care patient flow.",
    "primary": "nicu",
    "primaryLabel": "NICU Patients",
    "cols": [
      {
        "id": "nicu",
        "label": "NICU Patients"
      }
    ],
    "months": [
      "Oct-25",
      "Nov-25",
      "Dec-25",
      "Jan-26",
      "Feb-26",
      "Mar-26",
      "Apr-26",
      "May-26"
    ],
    "data": [
      {
        "nicu": 1
      },
      {
        "nicu": 6
      },
      {
        "nicu": 4
      },
      {
        "nicu": 6
      },
      {
        "nicu": 7
      },
      {
        "nicu": 5
      },
      {
        "nicu": 2
      },
      {
        "nicu": 10
      }
    ],
    "order": 2
  },
  {
    "id": "endoscopy",
    "name": "Endoscopy",
    "short": "Endo",
    "group": "Procedural",
    "desc": "GI & pulmonary endoscopic procedures.",
    "primary": "total",
    "primaryLabel": "Total Procedures",
    "cols": [
      {
        "id": "endo",
        "label": "Endoscopy"
      },
      {
        "id": "colon",
        "label": "Colonoscopy"
      },
      {
        "id": "polyp",
        "label": "Polypectomy"
      },
      {
        "id": "histo",
        "label": "Histopathology"
      },
      {
        "id": "bronch",
        "label": "Bronchoscopy"
      },
      {
        "id": "pluro",
        "label": "Pluroscopy"
      },
      {
        "id": "total",
        "label": "Total"
      }
    ],
    "months": [
      "Sep-25",
      "Oct-25",
      "Nov-25",
      "Dec-25",
      "Jan-26",
      "Feb-26",
      "Mar-26",
      "Apr-26",
      "May-26"
    ],
    "data": [
      {
        "endo": 1,
        "colon": 0,
        "polyp": 0,
        "histo": 0,
        "bronch": 0,
        "pluro": 0,
        "total": 1
      },
      {
        "endo": 6,
        "colon": 3,
        "polyp": 4,
        "histo": 0,
        "bronch": 0,
        "pluro": 0,
        "total": 13
      },
      {
        "endo": 5,
        "colon": 0,
        "polyp": 5,
        "histo": 0,
        "bronch": 0,
        "pluro": 0,
        "total": 10
      },
      {
        "endo": 2,
        "colon": 0,
        "polyp": 3,
        "histo": 1,
        "bronch": 0,
        "pluro": 0,
        "total": 6
      },
      {
        "endo": 3,
        "colon": 0,
        "polyp": 7,
        "histo": 0,
        "bronch": 0,
        "pluro": 0,
        "total": 10
      },
      {
        "endo": 7,
        "colon": 0,
        "polyp": 9,
        "histo": 0,
        "bronch": 2,
        "pluro": 1,
        "total": 19
      },
      {
        "endo": 1,
        "colon": 0,
        "polyp": 5,
        "histo": 0,
        "bronch": 2,
        "pluro": 0,
        "total": 8
      },
      {
        "endo": 14,
        "colon": 15,
        "polyp": 3,
        "histo": 5,
        "bronch": 3,
        "pluro": 2,
        "total": 42
      },
      {
        "endo": 12,
        "colon": 8,
        "polyp": 5,
        "histo": 18,
        "bronch": 3,
        "pluro": 1,
        "total": 47
      }
    ],
    "order": 3
  },
  {
    "id": "ot",
    "name": "Operation Theatre",
    "short": "OT",
    "group": "Procedural",
    "desc": "Total surgical cases performed monthly.",
    "primary": "ot",
    "primaryLabel": "OT Patients",
    "cols": [
      {
        "id": "ot",
        "label": "Total OT Patients"
      }
    ],
    "months": [
      "Oct-25",
      "Nov-25",
      "Dec-25",
      "Jan-26",
      "Feb-26",
      "Mar-26",
      "Apr-26"
    ],
    "data": [
      {
        "ot": 12
      },
      {
        "ot": 20
      },
      {
        "ot": 33
      },
      {
        "ot": 24
      },
      {
        "ot": 32
      },
      {
        "ot": 32
      },
      {
        "ot": 31
      }
    ],
    "order": 4
  },
  {
    "id": "sicu",
    "name": "Surgical ICU",
    "short": "SICU",
    "group": "Critical & Emergency",
    "desc": "Surgical intensive care patient flow.",
    "primary": "sicu",
    "primaryLabel": "SICU Patients",
    "cols": [
      {
        "id": "sicu",
        "label": "SICU Patients"
      }
    ],
    "months": [
      "Aug-25",
      "Sep-25",
      "Oct-25",
      "Nov-25",
      "Dec-25",
      "Jan-26",
      "Feb-26",
      "Mar-26",
      "Apr-26"
    ],
    "data": [
      {
        "sicu": 2
      },
      {
        "sicu": 4
      },
      {
        "sicu": 8
      },
      {
        "sicu": 2
      },
      {
        "sicu": 3
      },
      {
        "sicu": 3
      },
      {
        "sicu": 0
      },
      {
        "sicu": 0
      },
      {
        "sicu": 1
      }
    ],
    "order": 5
  },
  {
    "id": "dialysis",
    "name": "Dialysis",
    "short": "Dialysis",
    "group": "Procedural",
    "desc": "Renal replacement therapy — modality breakdown.",
    "primary": "total",
    "primaryLabel": "Total Dialysis",
    "cols": [
      {
        "id": "total",
        "label": "Total Dialysis"
      },
      {
        "id": "ipd",
        "label": "IPD Patients"
      },
      {
        "id": "opd",
        "label": "OPD Patients"
      },
      {
        "id": "conv",
        "label": "Conventional"
      },
      {
        "id": "modi",
        "label": "Modi-SLED"
      },
      {
        "id": "sled",
        "label": "SLED"
      }
    ],
    "months": [
      "Nov-25",
      "Dec-25",
      "Jan-26",
      "Feb-26",
      "Mar-26",
      "Apr-26",
      "May-26"
    ],
    "data": [
      {
        "total": 3,
        "ipd": 1,
        "opd": 2,
        "conv": 2,
        "modi": 1,
        "sled": 0
      },
      {
        "total": 1,
        "ipd": 0,
        "opd": 1,
        "conv": 1,
        "modi": 0,
        "sled": 0
      },
      {
        "total": 17,
        "ipd": 15,
        "opd": 2,
        "conv": 7,
        "modi": 2,
        "sled": 8
      },
      {
        "total": 12,
        "ipd": 10,
        "opd": 2,
        "conv": 8,
        "modi": 1,
        "sled": 3
      },
      {
        "total": 18,
        "ipd": 5,
        "opd": 13,
        "conv": 18,
        "modi": 0,
        "sled": 0
      },
      {
        "total": 60,
        "ipd": 19,
        "opd": 41,
        "conv": 54,
        "modi": 1,
        "sled": 5
      },
      {
        "total": 74,
        "ipd": 21,
        "opd": 53,
        "conv": 57,
        "modi": 7,
        "sled": 10
      }
    ],
    "order": 6
  },
  {
    "id": "lvl10",
    "name": "Level 10 Ward",
    "short": "L10",
    "group": "In-Patient Wards",
    "desc": "Ward 10 admissions, discharges & transfers.",
    "primary": "adm",
    "primaryLabel": "Admissions",
    "cols": [
      {
        "id": "adm",
        "label": "Admission"
      },
      {
        "id": "dis",
        "label": "Discharge"
      },
      {
        "id": "tin",
        "label": "Transfer In"
      },
      {
        "id": "tout",
        "label": "Transfer Out"
      }
    ],
    "months": [
      "Jul-25",
      "Aug-25",
      "Sep-25",
      "Oct-25",
      "Nov-25",
      "Dec-25",
      "Jan-26",
      "Feb-26",
      "Mar-26",
      "Apr-26",
      "May-26"
    ],
    "data": [
      {
        "adm": 6,
        "dis": 4,
        "tin": 0,
        "tout": 0
      },
      {
        "adm": 10,
        "dis": 8,
        "tin": 0,
        "tout": 0
      },
      {
        "adm": 23,
        "dis": 20,
        "tin": 0,
        "tout": 0
      },
      {
        "adm": 38,
        "dis": 34,
        "tin": 0,
        "tout": 0
      },
      {
        "adm": 52,
        "dis": 53,
        "tin": 0,
        "tout": 0
      },
      {
        "adm": 57,
        "dis": 59,
        "tin": 0,
        "tout": 0
      },
      {
        "adm": 60,
        "dis": 56,
        "tin": 7,
        "tout": 2
      },
      {
        "adm": 59,
        "dis": 58,
        "tin": 10,
        "tout": 4
      },
      {
        "adm": 82,
        "dis": 77,
        "tin": 20,
        "tout": 3
      },
      {
        "adm": 98,
        "dis": 0,
        "tin": 33,
        "tout": 4
      },
      {
        "adm": 96,
        "dis": 91,
        "tin": 17,
        "tout": 4
      }
    ],
    "order": 7
  },
  {
    "id": "lvl9",
    "name": "Level 9 Ward",
    "short": "L9",
    "group": "In-Patient Wards",
    "desc": "Ward 9 day-care & in-patient flow.",
    "primary": "total",
    "primaryLabel": "Total Patients",
    "cols": [
      {
        "id": "day",
        "label": "Day Care"
      },
      {
        "id": "ipd",
        "label": "IPD"
      },
      {
        "id": "total",
        "label": "Total Patients"
      },
      {
        "id": "tin",
        "label": "Transfer In"
      },
      {
        "id": "tout",
        "label": "Transfer Out"
      },
      {
        "id": "dorb",
        "label": "DORB"
      }
    ],
    "months": [
      "Jan-26",
      "Feb-26",
      "Mar-26",
      "Apr-26",
      "May-26"
    ],
    "data": [
      {
        "day": 0,
        "ipd": 3,
        "total": 3,
        "tin": 0,
        "tout": 0
      },
      {
        "day": 0,
        "ipd": 9,
        "total": 9,
        "tin": 0,
        "tout": 0
      },
      {
        "day": 8,
        "ipd": 3,
        "total": 11,
        "tin": 0,
        "tout": 0
      },
      {
        "day": 10,
        "ipd": 27,
        "total": 37,
        "tin": 5,
        "tout": 4
      },
      {
        "day": 11,
        "ipd": 18,
        "total": 29,
        "tin": 2,
        "tout": 1,
        "dorb": 1
      }
    ],
    "order": 8
  },
  {
    "id": "ldr",
    "name": "Labour / Delivery / Recovery",
    "short": "LDR",
    "group": "In-Patient Wards",
    "desc": "Maternity LDR patient flow.",
    "primary": "ldr",
    "primaryLabel": "LDR Patients",
    "cols": [
      {
        "id": "ldr",
        "label": "LDR Patients"
      }
    ],
    "months": [
      "Sep-25",
      "Oct-25",
      "Nov-25",
      "Dec-25",
      "Jan-26",
      "Feb-26",
      "Mar-26",
      "Apr-26"
    ],
    "data": [
      {
        "ldr": 3
      },
      {
        "ldr": 6
      },
      {
        "ldr": 9
      },
      {
        "ldr": 6
      },
      {
        "ldr": 10
      },
      {
        "ldr": 12
      },
      {
        "ldr": 11
      },
      {
        "ldr": 13
      }
    ],
    "order": 9
  },
  {
    "id": "micu",
    "name": "Medical ICU",
    "short": "MICU",
    "group": "Critical & Emergency",
    "desc": "Medical intensive care admissions & outcomes.",
    "primary": "adm",
    "primaryLabel": "Admissions",
    "cols": [
      {
        "id": "adm",
        "label": "Admission"
      },
      {
        "id": "tin",
        "label": "TR-IN"
      },
      {
        "id": "tout",
        "label": "TR-OUT"
      },
      {
        "id": "lama",
        "label": "LAMA / DAMA"
      },
      {
        "id": "dis",
        "label": "Discharge"
      },
      {
        "id": "death",
        "label": "Death"
      }
    ],
    "months": [
      "Sep-25",
      "Oct-25",
      "Nov-25",
      "Dec-25",
      "Jan-26",
      "Feb-26",
      "Mar-26",
      "Apr-26"
    ],
    "data": [
      {
        "adm": 1,
        "tin": 0,
        "tout": 0,
        "lama": 0,
        "dis": 0,
        "death": 0
      },
      {
        "adm": 5,
        "tin": 1,
        "tout": 4,
        "lama": 1,
        "dis": 1,
        "death": 0
      },
      {
        "adm": 6,
        "tin": 3,
        "tout": 7,
        "lama": 1,
        "dis": 0,
        "death": 0
      },
      {
        "adm": 5,
        "tin": 1,
        "tout": 6,
        "lama": 0,
        "dis": 0,
        "death": 0
      },
      {
        "adm": 12,
        "tin": 5,
        "tout": 10,
        "lama": 6,
        "dis": 0,
        "death": 0
      },
      {
        "adm": 8,
        "tin": 4,
        "tout": 8,
        "lama": 2,
        "dis": 0,
        "death": 2
      },
      {
        "adm": 10,
        "tin": 2,
        "tout": 5,
        "lama": 4,
        "dis": 0,
        "death": 3
      },
      {
        "adm": 16,
        "tin": 4,
        "tout": 15,
        "lama": 2,
        "dis": 0,
        "death": 1
      }
    ],
    "order": 10
  },
  {
    "id": "ccu",
    "name": "Coronary Care Unit",
    "short": "CCU",
    "group": "Critical & Emergency",
    "desc": "Cardiac care unit admissions.",
    "primary": "adm",
    "primaryLabel": "Admissions",
    "cols": [
      {
        "id": "adm",
        "label": "Admission"
      }
    ],
    "months": [
      "Nov-25",
      "Dec-25",
      "Jan-26",
      "Feb-26",
      "Mar-26",
      "Apr-26"
    ],
    "data": [
      {
        "adm": 5
      },
      {
        "adm": 9
      },
      {
        "adm": 14
      },
      {
        "adm": 17
      },
      {
        "adm": 18
      },
      {
        "adm": 15
      }
    ],
    "order": 11
  },
  {
    "id": "cathlab",
    "name": "Cath Lab",
    "short": "Cath",
    "group": "Procedural",
    "desc": "Interventional cardiology procedure mix.",
    "primary": "total",
    "primaryLabel": "Total Procedures",
    "cols": [
      {
        "id": "cag",
        "label": "CAG"
      },
      {
        "id": "pci",
        "label": "PCI"
      },
      {
        "id": "ppm",
        "label": "PPM"
      },
      {
        "id": "tpm",
        "label": "TPM"
      },
      {
        "id": "dsa",
        "label": "DSA"
      },
      {
        "id": "total",
        "label": "Total"
      }
    ],
    "months": [
      "Aug-25",
      "Sep-25",
      "Oct-25",
      "Nov-25",
      "Dec-25",
      "Jan-26",
      "Feb-26",
      "Mar-26",
      "Apr-26",
      "May-26"
    ],
    "data": [
      {
        "cag": 2,
        "pci": 1,
        "ppm": 0,
        "tpm": 0,
        "dsa": 0,
        "total": 3
      },
      {
        "cag": 3,
        "pci": 1,
        "ppm": 0,
        "tpm": 0,
        "dsa": 1,
        "total": 5
      },
      {
        "cag": 2,
        "pci": 1,
        "ppm": 0,
        "tpm": 0,
        "dsa": 0,
        "total": 3
      },
      {
        "cag": 3,
        "pci": 2,
        "ppm": 0,
        "tpm": 0,
        "dsa": 0,
        "total": 5
      },
      {
        "cag": 2,
        "pci": 3,
        "ppm": 0,
        "tpm": 0,
        "dsa": 0,
        "total": 5
      },
      {
        "cag": 4,
        "pci": 4,
        "ppm": 0,
        "tpm": 0,
        "dsa": 0,
        "total": 8
      },
      {
        "cag": 7,
        "pci": 4,
        "ppm": 1,
        "tpm": 1,
        "dsa": 0,
        "total": 13
      },
      {
        "cag": 2,
        "pci": 2,
        "ppm": 1,
        "tpm": 1,
        "dsa": 0,
        "total": 6
      },
      {
        "cag": 10,
        "pci": 7,
        "ppm": 0,
        "tpm": 0,
        "dsa": 2,
        "total": 19
      },
      {
        "cag": 7,
        "pci": 6,
        "ppm": 0,
        "tpm": 1,
        "dsa": 1,
        "total": 15
      }
    ],
    "order": 12
  },
  {
    "id": "ctvs",
    "name": "Cardiothoracic & Vascular Surgery",
    "short": "CTVS",
    "group": "Procedural",
    "desc": "Cardiac & vascular surgical procedure mix.",
    "primary": "total",
    "primaryLabel": "Total Cases",
    "cols": [
      {
        "id": "cabg",
        "label": "CABG"
      },
      {
        "id": "vsd",
        "label": "VSD"
      },
      {
        "id": "asd",
        "label": "ASD"
      },
      {
        "id": "avfistula",
        "label": "AV Fistula"
      },
      {
        "id": "haemangioma",
        "label": "Excisional Haemangioma"
      },
      {
        "id": "total",
        "label": "Total"
      }
    ],
    "months": [
      "Apr-26",
      "May-26"
    ],
    "data": [
      {
        "cabg": 1,
        "vsd": 1,
        "asd": 0,
        "avfistula": 1,
        "haemangioma": 1,
        "total": 4
      },
      {
        "cabg": 2,
        "vsd": 0,
        "asd": 3,
        "avfistula": 1,
        "haemangioma": 0,
        "total": 6
      }
    ],
    "order": 13
  },
  {
    "id": "homecare",
    "name": "Home Care",
    "short": "Home",
    "group": "Out-Patient",
    "desc": "Patients managed under home-care service.",
    "primary": "home",
    "primaryLabel": "Home Care Patients",
    "cols": [
      {
        "id": "home",
        "label": "Home Care Patients"
      }
    ],
    "months": [
      "Oct-25",
      "Nov-25",
      "Jan-26",
      "Feb-26",
      "Mar-26",
      "Apr-26"
    ],
    "data": [
      {
        "home": 3
      },
      {
        "home": 8
      },
      {
        "home": 4
      },
      {
        "home": 14
      },
      {
        "home": 7
      },
      {
        "home": 9
      }
    ],
    "order": 14
  }
];

;
/* ===== data.js ===== */
// UNICO HOSPITALS PLC — Patient Flow Census
// The monthly statistics now live in MongoDB (the `departments` collection) and
// are injected by the Express web server as window.__UNICO_DEPARTMENTS__ before
// this script runs. There are NO hardcoded monthly numbers in this file anymore.
// To edit the seed data: server/seed/departments.json, then
//   npm --prefix server run seed-departments -- --force

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

// Department definitions (metadata + months[] + monthly data[]) come from the
// database via the server-injected global. Clone so the computed helpers below
// never mutate the injected source.
const _INJECTED_DEPTS = (typeof window !== 'undefined' && Array.isArray(window.__UNICO_DEPARTMENTS__))
  ? window.__UNICO_DEPARTMENTS__
  : null;
const _FALLBACK_DEPTS = (typeof window !== 'undefined' && Array.isArray(window.__UNICO_DEPARTMENTS_FALLBACK__))
  ? window.__UNICO_DEPARTMENTS_FALLBACK__
  : [];
// Same rule as the quality seed: an injected list wins even when it is empty. A
// scoped account with no departments must see none, not the bundled sample data.
// Hidden duplicate columns (an empty twin marked { hidden, duplicateOf } by
// scripts/organize-database.js) stay on the stored record but are never shown or offered for
// entry, so a value can't be typed into the twin and split across two ids again.
const DEPARTMENTS = (_INJECTED_DEPTS || _FALLBACK_DEPTS).map(d => ({ ...d, cols: Array.isArray(d.cols) ? d.cols.filter(c => !(c && c.hidden)) : d.cols }));

// Attach the derived fields the app expects (series/total/latest/prev/delta/peak),
// guarded so a department with no rows can't throw.
function decorateDept(d) {
  d.months = Array.isArray(d.months) ? d.months : [];
  d.data   = Array.isArray(d.data) ? d.data : [];
  d.cols   = Array.isArray(d.cols) ? d.cols : [];
  d.fullMonths = d.months.map(m => MONTHS_FULL[m] || m);
  d.series = d.data.map((row, i) => ({ month: d.months[i], full: MONTHS_FULL[d.months[i]] || d.months[i], ...row }));
  if (!d.series.length) { d.total = 0; d.latest = {}; d.prev = null; d.delta = 0; d.peak = 0; return; }
  d.total = d.series.reduce((s, r) => s + (r[d.primary] || 0), 0);
  d.latest = d.series[d.series.length - 1];
  d.prev = d.series.length > 1 ? d.series[d.series.length - 2] : null;
  const cur = d.latest[d.primary] || 0;
  const prev = d.prev ? (d.prev[d.primary] || 0) : 0;
  d.delta = prev === 0 ? (cur > 0 ? 100 : 0) : Math.round(((cur - prev) / prev) * 100);
  d.peak = Math.max(0, ...d.series.map(r => r[d.primary] || 0));
}
DEPARTMENTS.forEach(decorateDept);

const GROUPS = [...new Set(DEPARTMENTS.map(d => d.group))];

// Hospital-wide rollups for the dashboard (guarded against missing departments).
const HOSPITAL = {
  name: "UNICO Hospitals PLC",
  reportRange: "Aug 2025 – May 2026",
  generated: "05/18/2026",
  kpis: (function () {
    const find = id => DEPARTMENTS.find(d => d.id === id);
    const er = find("er"), opd = find("opd"), ot = find("ot"), cath = find("cathlab");
    return {
      erLatest: (er && er.latest && er.latest.total) || 0,
      opdTotal: (opd && opd.total) || 0,
      otTotal: (ot && ot.total) || 0,
      cathTotal: (cath && cath.total) || 0,
    };
  })()
};

window.UNICO = { DEPARTMENTS, GROUPS, MONTHS_FULL, MONTH_ORDER, HOSPITAL };

// Report signatures (Prepared / Checked / Approved by) — typed once, saved, and shared
// by EVERY report builder (Patient Statistics, Monthly Statistics, Quality console).
window.unicoSig = {
  KEY: 'unico_report_sig_v1',
  blank() { return { prepared: '', reviewed: '', recommended: '', approved: '' }; },
  load() {
    try {
      const s = JSON.parse(localStorage.getItem(this.KEY));
      return (s && typeof s === 'object')
        ? { prepared: s.prepared || '', reviewed: s.reviewed || '', recommended: s.recommended || '', approved: s.approved || '' }
        : this.blank();
    } catch (e) { return this.blank(); }
  },
  save(sig) {
    try { localStorage.setItem(this.KEY, JSON.stringify({ prepared: (sig && sig.prepared) || '', reviewed: (sig && sig.reviewed) || '', recommended: (sig && sig.recommended) || '', approved: (sig && sig.approved) || '' })); } catch (e) { }
  },
};

// Live refetch: after an approved Data-Collection submission is APPLIED on the
// server, the page-load snapshot above is stale. Swap the canonical department
// data in place so every view that (re)mounts sees the fresh numbers without a
// full page reload.
let _deptSig = null;
window.UNICO.refreshDepartments = function () {
  return fetch('/api/departments', { credentials: 'same-origin', cache: 'no-store' })
    .then(r => r.json())
    .then(j => {
      if (!j || !j.ok || !Array.isArray(j.departments)) return false;
      // Collector sessions also receive their re-scoped config overlay — keep the
      // local copy current so admin column/rename edits apply on live refresh.
      // Through the bridge (raw write, skips this tab's unsaved edits, updates the save baseline)
      // AND announced: mounted stores held the old overlay in React state and wrote it back.
      try {
        const ov = j.overlay && j.overlay['unico_store_v3'];
        if (typeof ov === 'string') {
          if (typeof window.unicoApplyRemoteOverlay === 'function') window.unicoApplyRemoteOverlay({ unico_store_v3: ov }, { source: 'departments' });
          else if (localStorage.getItem('unico_store_v3') !== ov) { localStorage.setItem('unico_store_v3', ov); window.dispatchEvent(new CustomEvent('unico:overlay-merged', { detail: { keys: ['unico_store_v3'], source: 'departments' } })); }
        }
      } catch (e) { }
      // Unchanged since the last refresh: skip the swap and the event. The app polls every 60 s,
      // and 'unico:data-refreshed' makes stores rebuild and several views refetch their lists.
      const sig = JSON.stringify(j.departments);
      if (sig === _deptSig) return true;
      _deptSig = sig;
      const fresh = j.departments.map(d => ({ ...d }));
      fresh.forEach(decorateDept);
      DEPARTMENTS.length = 0; fresh.forEach(d => DEPARTMENTS.push(d));
      GROUPS.length = 0; [...new Set(DEPARTMENTS.map(d => d.group))].forEach(g => GROUPS.push(g));
      const find = id => DEPARTMENTS.find(d => d.id === id);
      const er = find('er'), opd = find('opd'), ot = find('ot'), cath = find('cathlab');
      HOSPITAL.kpis = {
        erLatest: (er && er.latest && er.latest.total) || 0,
        opdTotal: (opd && opd.total) || 0,
        otTotal: (ot && ot.total) || 0,
        cathTotal: (cath && cath.total) || 0,
      };
      // The dept store memoizes over its overlay only — tell every mounted store the
      // canonical snapshot changed so open views rebuild without a remount/reload.
      try { window.dispatchEvent(new CustomEvent('unico:data-refreshed', { detail: { source: 'departments' } })); } catch (e) { }
      return true;
    }).catch(() => false);
};

;
/* ===== store.js ===== */
/* UNICO — department store: CRUD + custom columns, persisted to localStorage */
(function(){
  const KEY='unico_store_v3';
  const load=()=>{ try{ const s=JSON.parse(localStorage.getItem(KEY)); return s&&typeof s==='object'?s:null; }catch(e){ return null; } };
  const blank=()=>({ custom:[], renames:{}, deleted:[], entries:[], order:[] });

  function recompute(d){
    d.series=d.data.map((row,i)=>({ month:d.months[i], full:window.UNICO.MONTHS_FULL[d.months[i]]||d.months[i], ...row }));
    if(!d.series.length){
      d.total=0; d.latest={}; d.prev=null; d.delta=0; d.peak=0; d.avg=0; return d;
    }
    d.total=d.series.reduce((s,r)=>s+(r[d.primary]||0),0);
    d.latest=d.series[d.series.length-1];
    d.prev=d.series.length>1?d.series[d.series.length-2]:null;
    const cur=d.latest[d.primary]||0, prev=d.prev?(d.prev[d.primary]||0):0;
    d.delta=prev===0?(cur>0?100:0):Math.round(((cur-prev)/prev)*100);
    d.peak=Math.max(...d.series.map(r=>r[d.primary]||0));
    d.avg=Math.round(d.total/d.series.length);
    return d;
  }

  function buildDepts(store){
    const base=window.UNICO.DEPARTMENTS.map(d=>({...d, custom:false, months:[...d.months], data:d.data.map(r=>({...r})), cols:d.cols.map(c=>({...c}))}));
    const custom=(store.custom||[]).map(d=>({...d, custom:true, months:[...(d.months||[])], data:(d.data||[]).map(r=>({...r})), cols:(d.cols||[]).map(c=>({...c}))}));
    // A custom dept later promoted to a REAL dept (CT OT / CT ICU class) exists in BOTH
    // lists under the same id. Never render two copies: the server copy is canonical;
    // fold in any months/cols that still live only in the overlay copy.
    const baseIds=new Set(base.map(d=>d.id));
    custom.filter(d=>baseIds.has(d.id)).forEach(cd=>{
      const bd=base.find(d=>d.id===cd.id);
      (cd.months||[]).forEach((m,i)=>{ if(bd.months.indexOf(m)<0){ bd.months.push(m); bd.data.push({...((cd.data||[])[i]||{})}); } });
      (cd.cols||[]).forEach(c=>{ if(!bd.cols.some(x=>x.id===c.id)) bd.cols.push({...c}); });
    });
    let list=[...base,...custom.filter(d=>!baseIds.has(d.id))].filter(d=>!(store.deleted||[]).includes(d.id));
    // renames / overrides
    list.forEach(d=>{ const r=(store.renames||{})[d.id]; if(r){ Object.assign(d,r); } });
    // explicitly-deleted months (a later entry for the same month re-adds it)
    const removed=store.removed||{};
    // …unless the month was APPROVED again after it was deleted here (newest wins): the server
    // stamps d.approvedAt[month]; deleteMonth stamps removedAt. A legacy deletion has no stamp,
    // so a stamped approval outranks it — hiding a later approval for good read as lost data.
    const removedAt=store.removedAt||{};
    list.forEach(d=>{ const rm=removed[d.id]; if(rm&&rm.length){ for(let i=d.months.length-1;i>=0;i--){ const m=d.months[i]; if(rm.includes(m) && !(Number((d.approvedAt||{})[m])>(Number((removedAt[d.id]||{})[m])||0))){ d.months.splice(i,1); d.data.splice(i,1); } } } });
    // entries merge
    const byId=Object.fromEntries(list.map(d=>[d.id,d]));
    (store.entries||[]).forEach(e=>{
      const d=byId[e.dept]; if(!d) return;
      const idx=d.months.indexOf(e.month);
      // An entry with no actual values must not create a new month — an accidental
      // empty save would otherwise add an all-blank row that poisons "latest".
      const hasValue=Object.values(e.row||{}).some(v=>v!==null&&v!==''&&v!==undefined);
      if(idx>=0){
        // Merge only REAL values into an existing month: an all-blank "save anyway"
        // entry used to spread nulls OVER the server's approved data, blanking the
        // whole row on screen while the values sat safely in the DB (Endoscopy Jun-26).
        // Newest wins per field: a value APPROVED for this month after the entry was typed
        // (server stamp d.approvedAt[month] vs the entry's ts) must not be painted over by it.
        const approvedNewer=Number((d.approvedAt||{})[e.month])>(Number(e.ts)||0);
        const patch={}; Object.keys(e.row||{}).forEach(k=>{ const v=(e.row||{})[k]; if(v!==null&&v!==''&&v!==undefined&&!(approvedNewer&&d.data[idx]&&Object.prototype.hasOwnProperty.call(d.data[idx],k))) patch[k]=v; });
        d.data[idx]={...d.data[idx],...patch};
      }
      else if(hasValue) { d.months.push(e.month); d.data.push({...e.row}); }
    });
    // Chronological order AFTER all merging: an overlay entry for an out-of-order month
    // (e.g. a correction) is pushed at the END above, which would otherwise become the
    // false "latest" month everywhere (cards, deltas, charts, report ranges).
    const MO=(window.UNICO&&window.UNICO.MONTH_ORDER)||[];
    list.forEach(d=>{
      const zip=d.months.map((m,i)=>({m,r:d.data[i],k:MO.indexOf(m)})).sort((a,b)=>(a.k<0?1e9:a.k)-(b.k<0?1e9:b.k));
      d.months=zip.map(z=>z.m); d.data=zip.map(z=>z.r);
    });
    // Normalise partially-populated department docs so a missing short / group /
    // primaryLabel never renders blank (e.g. CT OT was added without a short code,
    // which showed as an empty sidebar row).
    list.forEach(d=>{
      if(!d.short||!String(d.short).trim()) d.short=(String(d.name||d.id||'').replace(/[^A-Za-z0-9]+/g,'').slice(0,6))||String(d.id||'').slice(0,6);
      if(!d.group||!String(d.group).trim()) d.group='General';
      if(!d.primaryLabel){ const pc=(d.cols||[]).find(c=>c.id===d.primary)||(d.cols||[])[0]; d.primaryLabel=pc?pc.label:(d.primary||''); }
      if(d.desc==null) d.desc='';
    });
    list.forEach(recompute);
    // ordering
    if(store.order&&store.order.length){
      list.sort((a,b)=>{ const ia=store.order.indexOf(a.id), ib=store.order.indexOf(b.id);
        return (ia<0?999:ia)-(ib<0?999:ib); });
    }
    return list;
  }

  function useDeptStore(){
    const [store,setStore]=React.useState(()=>load()||blank());
    const hist=React.useRef([]);
    const [canUndo,setCanUndo]=React.useState(false);
    // The canonical snapshot (window.UNICO.DEPARTMENTS) is refetched IN PLACE after an
    // approved submission or a tab refocus; the memo below only watches the overlay, so
    // bump on the refresh event or open views keep rendering the page-load data forever.
    const [rev,setRev]=React.useState(0);
    React.useEffect(()=>{ const h=()=>setRev(r=>r+1); window.addEventListener('unico:data-refreshed',h); return ()=>window.removeEventListener('unico:data-refreshed',h); },[]);
    // The server merged this overlay with another session's saves: reload it, so this tab shows
    // (and keeps building on) their edits instead of writing its older copy back.
    React.useEffect(()=>{ const h=(e)=>{ const ks=(e&&e.detail&&e.detail.keys)||[]; if(ks.indexOf(KEY)>=0){ const s=load(); if(s) setStore(s); } }; window.addEventListener('unico:overlay-merged',h); return ()=>window.removeEventListener('unico:overlay-merged',h); },[]);
    React.useEffect(()=>{ localStorage.setItem(KEY,JSON.stringify(store)); },[store]);
    const depts=React.useMemo(()=>buildDepts(store),[store,rev]);

    // Snapshot the current state before every change so it can be undone.
    const commit=(updater)=>{ hist.current=[...hist.current.slice(-49), store]; setCanUndo(true); setStore(typeof updater==='function'?updater(store):updater); };

    const api={
      depts,
      entries:store.entries||[],
      canUndo,
      addEntry:(e)=>commit(s=>({...s, entries:[...(s.entries||[]), e]})),
      clearEntries:()=>commit(s=>({...s, entries:[]})),
      addDept:(def)=>commit(s=>({...s, custom:[...(s.custom||[]), def], order:[...(s.order||[]), def.id]})),
      updateDept:(id,patch)=>commit(s=>{
        const isCustom=(s.custom||[]).some(d=>d.id===id);
        if(isCustom) return {...s, custom:s.custom.map(d=>d.id===id?{...d,...patch}:d)};
        return {...s, renames:{...(s.renames||{}), [id]:{...(s.renames||{})[id], ...patch}}};
      }),
      deleteDept:(id)=>commit(s=>{
        const isCustom=(s.custom||[]).some(d=>d.id===id);
        if(isCustom) return {...s, custom:s.custom.filter(d=>d.id!==id), entries:(s.entries||[]).filter(e=>e.dept!==id)};
        return {...s, deleted:[...(s.deleted||[]), id]};
      }),
      // Deleting a built-in department only HIDES it (its data stays saved); this brings it back.
      // The only other way out used to be Settings → Reset, which wiped every Data Entry value.
      undeleteDept:(id)=>commit(s=>({...s, deleted:(s.deleted||[]).filter(x=>x!==id)})),
      deletedIds:store.deleted||[],
      // Remove a single month's data for a department (built-in or custom).
      deleteMonth:(id,month)=>commit(s=>{
        const isCustom=(s.custom||[]).some(d=>d.id===id);
        const entries=(s.entries||[]).filter(e=>!(e.dept===id&&e.month===month));
        if(isCustom){
          return {...s, entries, custom:s.custom.map(d=>{ if(d.id!==id) return d; const idx=(d.months||[]).indexOf(month); if(idx<0) return d; return {...d, months:d.months.filter((_,i)=>i!==idx), data:(d.data||[]).filter((_,i)=>i!==idx)}; })};
        }
        const removed={...(s.removed||{})}; removed[id]=[...(removed[id]||[]).filter(m=>m!==month), month];
        const removedAt={...(s.removedAt||{})}; removedAt[id]={...(removedAt[id]||{}), [month]:Date.now()};
        return {...s, entries, removed, removedAt};
      }),
      reset:()=>commit(blank()),
      undo:()=>{ const h=hist.current; if(!h.length) return; const prev=h[h.length-1]; hist.current=h.slice(0,-1); setCanUndo(hist.current.length>0); setStore(prev); }
    };
    return api;
  }

  window.useDeptStore=useDeptStore;
  window.buildDepts=buildDepts;
})();

;
/* ===== staff-seed.js ===== */
/* UNICO — staff (nurse + PCA) records.
   The records now live in MongoDB (the `staff` collection) and are injected by the
   Express web server as window.__UNICO_STAFF__ before this script runs. No hardcoded
   staff data remains here. To edit the seed: server/seed/staff.json then
   npm --prefix server run seed-data -- staff --force */
window.STAFF_SEED = (typeof window !== 'undefined' && Array.isArray(window.__UNICO_STAFF__)) ? window.__UNICO_STAFF__ : [];

;
/* ===== staff-data.js ===== */
/* UNICO — Workforce / HR data: config, seed staff, store, analytics (mirrors NEMS) */
(function(){
  const DEPARTMENTS=["ER","OPD","NICU","MICU","SICU","CCU","CT ICU","Level-10","Level-9","Level-11",
    "LDR","Dialysis","Endoscopy","Cath Lab","General OT","Cardiac OT","Radiology","HomeCare","DayCare",
    "Oncology","Infection Control","Training & Development","Management","Vaccination Room"];
  const DESIGNATIONS=["Staff Nurse","Trainee Nurse","Senior Staff Nurse","Charge Nurse","Acting Charge Nurse",
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
  // Extracurricular activities / talents — the form's chip picker also lets any
  // custom value be added, so this list is just the common starting set.
  const EXTRACURRICULARS=["Dancing","Acting","Cooking","Singing","Music / Instrument","Sports",
    "Painting / Drawing","Writing / Poetry","Photography","Anchoring / Hosting","Debate / Public Speaking",
    "Handicrafts","Gardening","Volunteering / Social Work",
    "Communication","Organizing","Planning","Event Management","Leadership","Teamwork",
    "Teaching / Mentoring","Counselling","Decoration & Design","Fundraising","Sports Coaching","Cultural Programs"
  ].sort((a,b)=>a.localeCompare(b));

  // PCA (Patient Care Assistant) role config
  const ROLES=["Nurse","PCA"];
  const PCA_DESIGNATIONS=["Patient Care Assistant","Senior PCA","ICU PCA","Ward Assistant","OT Helper","PCA Trainee"];
  const PCA_QUALIFICATIONS=["SSC","HSC","PCA Certificate","Care Giving Course","Nursing Aide Diploma","Basic First Aid"];
  const PCA_TRAININGS=["BLS","Patient Handling","Hygiene & Bed Care","Infection Control","Vital Signs","Specimen Transport",""];

  // ---------- clinical privileges catalogue ----------
  // Source: "Clinical Privileges & Activity Checklist" (Nursing Services), imported
  // from the hospital's privilege-area spreadsheet. Each "group" below is a privilege
  // AREA (e.g. "Assessment & monitoring", "Airway & respiratory"); each area lists the
  // specific activities a staff member can be privileged to perform. Nurse and PCA
  // have separate catalogues because their scopes of practice differ.
  const NURSE_PRIVILEGE_GROUPS=[
    {group:'1. Assessment & monitoring',items:['Vital signs monitoring','Head-to-toe assessment','Pain assessment','Neurological / GCS assessment','Fall risk assessment','Pressure injury (Braden) scoring','Nutrition screening','Fluid balance charting','Early warning score (NEWS/MEWS)','Blood glucose monitoring','ECG recording','Pulse oximetry','Cardiac monitor interpretation','Haemodynamic monitoring','Intracranial pressure monitoring','Central venous pressure measurement','Capnography monitoring','Delirium screening (CAM-ICU)','Sedation scoring (RASS)','Sepsis screening bundle','Skin integrity rounds','Peripheral perfusion assessment','Abdominal girth measurement','Bladder scan','Telemetry monitoring','Weaning readiness screening']},
    {group:'2. Airway & respiratory',items:['Oxygen therapy','Nebulisation','Airway suctioning','Oropharyngeal airway insertion','Bag-mask ventilation','Ventilator care','Ventilator weaning support','Tracheostomy care','Tracheostomy suctioning','Chest physiotherapy assist','Incentive spirometry coaching','ABG sampling','Chest drain management','CPAP / BiPAP setup','HFNC management','Endotracheal tube care','Cuff pressure monitoring','Prone positioning','Ventilator bundle compliance','Inhaler technique teaching','Peak flow measurement','Humidification management','Nitric oxide therapy assist','Underwater seal drain change','Sputum induction']},
    {group:'3. Vascular access & infusion',items:['Peripheral IV cannulation','Central line care','PICC line dressing','Port-a-cath access','Arterial line care','Blood sampling from lines','Infusion pump handling','Syringe pump handling','Blood transfusion','Platelet / plasma transfusion','Phlebotomy','Fluid resuscitation','Midline catheter care','Dialysis catheter care','Umbilical line care','Intraosseous access assist','Blood component warming','Transfusion reaction management','Line-associated infection prevention','IV site rotation & documentation','Extravasation management','TPN administration']},
    {group:'4. Medication management',items:['Oral medication administration','IM / SC injection','IV bolus administration','IV drug preparation','Insulin administration & titration','Heparin / anticoagulant management','Inotrope / vasopressor titration','Narcotics handling & count','Chemotherapy handling','Antibiotic stewardship compliance','Vaccination','Medication reconciliation','High-alert drug double-check','Patient-controlled analgesia','Epidural infusion care','Intrathecal drug handling assist','Nebulised drug administration','Eye / ear / nasal drops','Topical & transdermal application','Rectal & vaginal medication','Sublingual administration','Thrombolysis administration','Sedation administration & monitoring','Antidote administration','Drug dilution calculation','Look-alike sound-alike drug segregation','Medication fridge & temperature log','Expiry & recall check']},
    {group:'5. Emergency & critical care',items:['Basic life support','Advanced cardiac life support','Paediatric advanced life support','Defibrillation','Cardioversion assist','Code team response','Rapid response call','Crash cart checking','Emergency drug preparation','CRRT / dialysis','Peritoneal dialysis','Therapeutic hypothermia care','Massive transfusion protocol','Triage','Disaster / mass casualty response','Post-resuscitation care','Shock management','Stroke code response','STEMI code response','Trauma primary survey assist','Spinal immobilisation','Poisoning & overdose management','Snake bite management','Anaphylaxis management','Seizure management','Obstetric emergency response','Intra-hospital critical transfer','Ambulance handover']},
    {group:'6. Wound & tissue care',items:['Simple wound dressing','Complex wound dressing','Negative pressure wound therapy','Pressure injury prevention & care','Stoma care','Suture / staple removal','Drain management','Burn dressing','Diabetic foot care','Wound swab collection','Compression bandaging','Fistula & sinus care','Tracheostomy stoma care','Skin graft site care','Debridement assist','Maggot / larval therapy assist','Scar & pressure garment care','Wound photography & measurement','Cast & splint care','Traction care']},
    {group:'7. Procedures & diagnostics',items:['Urinary catheterisation','Bladder irrigation','NG / RT tube insertion','NG feeding & flushing','Enema administration','Specimen collection','Blood culture collection','Lumbar puncture assist','Paracentesis / thoracentesis assist','Bone marrow aspiration assist','Cath lab assist','Endoscopy assist','Bronchoscopy assist','Radiology procedure escort','Point-of-care testing','Bladder catheter removal','Suprapubic catheter care','Colostomy irrigation','Flatus tube insertion','Gastric lavage','ERCP assist','Biopsy assist','Pleural tap assist','Pacemaker insertion assist','Echocardiography assist','EEG / EMG assist','Swallow assessment assist','Urodynamic study assist','Sample transport & chain of custody']},
    {group:'8. Maternal & neonatal',items:['Antenatal assessment','Labour support','CTG / fetal monitoring','Second-stage delivery assist','Perineal care','Postpartum haemorrhage response','Newborn resuscitation','Newborn assessment (APGAR)','Umbilical cord care','Breastfeeding counselling','Phototherapy care','Kangaroo mother care','Neonatal incubator care','Surfactant administration assist','Exchange transfusion assist','Neonatal cannulation','Neonatal NG feeding','Neonatal vital monitoring','Retinopathy screening assist','Newborn hearing screening','Immunisation of newborn','Cord blood collection','Family planning counselling','Antenatal class teaching','High-risk pregnancy monitoring','Eclampsia management assist','Caesarean section assist','Vacuum / forceps delivery assist']},
    {group:'9. Perioperative & procedural',items:['Pre-operative checklist','Surgical site preparation','OT scrub','OT circulating','Instrument & swab count','Anaesthesia assist','Patient positioning for surgery','Specimen labelling & handover','Post-anaesthesia recovery','Extubation monitoring','CSSD / sterilisation','Autoclave load verification','Surgical safety checklist (WHO)','Time-out & site marking verification','Diathermy & tourniquet setup','Laparoscopy stack setup','Implant & prosthesis documentation','Blood loss estimation','Warming device management','Surgical count discrepancy escalation','Endoscope reprocessing','Instrument tray assembly','OT environmental monitoring']},
    {group:'10. Infection prevention & safety',items:['Hand hygiene compliance','PPE donning & doffing','Isolation precautions','Aseptic non-touch technique','Sharps & waste segregation','Spill management','Device bundle compliance (CLABSI/CAUTI/VAP)','Surveillance & reporting','Antimicrobial resistance flagging','Environmental cleaning audit','Terminal cleaning verification','Needle-stick injury management','Outbreak investigation support','Cohorting & bed spacing','TB / airborne precaution setup','Negative pressure room monitoring','Linen & laundry handling','Biomedical waste documentation','Vaccination of staff (assist)','Hand hygiene audit','Disinfectant preparation & dilution']},
    {group:'11. Patient care & mobility',items:['Bed bath & hygiene care','Oral & eye care','Positioning & turning schedule','Passive range of motion','Ambulation & transfer assist','Restraint application & monitoring','Fall precaution setup','End-of-life / palliative care','Last offices','Nutrition & feeding support','Bowel & bladder care','Bereavement support','Pain relief non-pharmacological','Sleep & rest promotion','Sensory aid support (glasses / hearing)','Prosthesis & orthosis care','Chest & limb physiotherapy assist','Fall recovery assist','Isolation patient care','Dementia & confusion care','Paediatric play & distraction']},
    {group:'12. Documentation & coordination',items:['Nursing care plan','SBAR handover','Incident reporting','Medication error reporting','Consent witnessing','Discharge planning & counselling','Referral coordination','Ward round documentation','Duty roster preparation','Indent & inventory recording','Death documentation','Medico-legal case documentation','Electronic health record entry','Handover checklist completion','Care bundle documentation','Consent form verification','Insurance & billing documentation','Transfer summary preparation','Narcotic register maintenance','Equipment fault reporting','Complaint documentation','Statistics & census reporting','Appointment & follow-up scheduling']},
    {group:'13. Education & leadership',items:['Patient & family education','Student nurse supervision','New joiner orientation','Skills demonstration / in-service teaching','Preceptorship','Audit participation','Quality improvement project','Shift in-charge duty','Team allocation & delegation','Committee representation','Clinical protocol drafting','Policy compliance monitoring','Mentoring junior nurses','Simulation / mock drill facilitation','Root cause analysis participation','Accreditation preparation','Research data collection','Journal club presentation','Infection control link nurse duty','Emergency preparedness training']},
  ];
  const PCA_PRIVILEGE_GROUPS=[
    {group:'1. Personal care',items:['Bed bath & hygiene','Oral care','Hair & nail care','Shaving & grooming','Dressing & undressing','Perineal care','Incontinence & diaper care','Bedpan / urinal assistance','Denture care','Hair wash in bed','Foot care','Eye care assist','Catheter bag emptying','Colostomy bag emptying','Skin moisturising','Pressure area inspection (report)']},
    {group:'2. Feeding & nutrition support',items:['Feeding assistance','Meal tray service','Fluid offering & recording','Oral intake documentation','Feeding position setup','NG feed observation (report only)','Diet tray labelling','Feeding aid setup','Water & jug refilling','Special diet delivery','Meal-time patient positioning']},
    {group:'3. Mobility & transfer',items:['Positioning & turning','Bed to trolley transfer','Bed to chair transfer','Wheelchair transport','Ambulation assist','Hoist / lift use','Patient escort to departments','Range of motion assist','Pressure relief schedule','Walker & crutch assist','Log-roll assist','Sitting balance support','Stretcher handling','Lift team participation','Post-fall assistance']},
    {group:'4. Monitoring support',items:['Temperature check','Pulse & respiration count','Blood pressure (assist)','Height & weight','Blood glucose assist','Intake / output recording','Vitals charting assist','Reporting abnormal findings','Urine output measurement','Drain output measurement','Stool & vomitus observation','Weighing scale calibration check','Pulse oximeter application']},
    {group:'5. Ward & equipment support',items:['Bed making','Linen change','Equipment cleaning','Wheelchair & trolley upkeep','Oxygen cylinder handling','Specimen transport','Sample dispatch to lab','Stock replenishment','Indent collection from store','Waste segregation','Terminal cleaning assist','Suction machine cleaning','Nebuliser cleaning','Bed alarm & call bell check','Trolley stocking for rounds','Sterile pack transport','Blood sample dispatch','Pharmacy indent pickup','Equipment return to store']},
    {group:'6. Patient support & comfort',items:['Comfort positioning','Companionship & reassurance','Sleep environment setup','Attendant guidance','Belongings handover','Assisting during rounds','Assisting during procedures','Post-mortem care assist','Wheelchair comfort setup','Privacy screen management','Patient orientation to ward','Discharge belongings check','Visitor guidance','Language / translation support']},
    {group:'7. Safety & compliance',items:['Hand hygiene','PPE use','Fall precaution','Patient identification','Side rail & bed brake check','Restraint monitoring (assist)','Basic life support awareness','Fire & evacuation drill','Incident escalation to nurse','Choking first response','Spill reporting','Sharps container replacement','Oxygen safety check','Electrical safety reporting','Missing patient escalation']},
  ];
  // Admin-created privileges (Settings → Department Privileges → "Create a new
  // privilege"), layered on top of the imported catalogue above. Shape mirrors the
  // base groups so privilegeGroupsFor() can merge them transparently: an item is
  // appended to an existing area by name, or a brand-new area is created for it.
  const CUSTOM_PRIV_KEY='unico_privilege_custom_v1';
  function loadCustomPrivileges(){ try{const o=JSON.parse(localStorage.getItem(CUSTOM_PRIV_KEY)); return (o&&typeof o==='object'&&!Array.isArray(o))?o:{}; }catch(e){return {};} }
  function saveCustomPrivileges(o){ try{localStorage.setItem(CUSTOM_PRIV_KEY,JSON.stringify(o));}catch(e){} }
  function roleKey(role){ return role==='PCA'?'PCA':'Nurse'; }
  // Adds one activity to a (possibly new) privilege area for the role. Returns false
  // if that exact area+activity already exists (built-in or custom) — never a silent dupe.
  function addCustomPrivilege(role,groupName,item){
    groupName=String(groupName||'').trim(); item=String(item||'').trim();
    if(!groupName||!item) return false;
    const already=privilegeGroupsFor(role).some(g=>g.group===groupName&&g.items.some(x=>x.toLowerCase()===item.toLowerCase()));
    if(already) return false;
    const o=loadCustomPrivileges(); const rk=roleKey(role); const arr=o[rk]=o[rk]||[];
    let g=arr.find(x=>x.group===groupName); if(!g){ g={group:groupName,items:[]}; arr.push(g); }
    g.items.push(item); saveCustomPrivileges(o); return true;
  }
  // Removes a custom activity entirely (from the catalogue, so it also disappears
  // from every department's assignment). Built-in (imported) activities can't be
  // removed this way — same rule as the built-in option lists elsewhere in this file.
  function removeCustomPrivilege(role,groupName,item){
    const o=loadCustomPrivileges(); const rk=roleKey(role); const arr=o[rk]||[];
    const g=arr.find(x=>x.group===groupName); if(g) g.items=g.items.filter(x=>x!==item);
    o[rk]=arr.filter(g=>g.items.length>0); saveCustomPrivileges(o);
  }
  function privilegeGroupsFor(role){
    const base=role==='PCA'?PCA_PRIVILEGE_GROUPS:NURSE_PRIVILEGE_GROUPS;
    const custom=loadCustomPrivileges()[roleKey(role)]||[];
    if(!custom.length) return base;
    const out=base.map(g=>({group:g.group,items:g.items.slice()}));
    custom.forEach(cg=>{
      let g=out.find(x=>x.group===cg.group);
      if(!g){ g={group:cg.group,items:[]}; out.push(g); }
      cg.items.forEach(it=>{ if(!g.items.includes(it)) g.items.push(it); });
    });
    return out;
  }
  // Stable key for one activity within one privilege area — used to key the granted map.
  function privKey(group,item){ return group+'||'+item; }
  // Roll-up: total activities in the catalogue, how many are granted, and the same
  // breakdown per privilege area — used by both the form rail and the profile view.
  function privilegeStats(role,privileges){
    const groups=privilegeGroupsFor(role); const p=privileges||{};
    let granted=0,total=0;
    const byGroup=groups.map(g=>{
      const gTotal=g.items.length;
      const gGranted=g.items.filter(it=>p[privKey(g.group,it)]).length;
      granted+=gGranted; total+=gTotal;
      return {group:g.group,granted:gGranted,total:gTotal};
    });
    return {granted,total,byGroup};
  }
  // ---------- department ⇄ privilege assignment (Settings → Department Privileges) ----------
  // Which catalogue activities apply to which department, per role. This is what the
  // create/edit staff form filters its Privileges checklist against once a department
  // is chosen — a staff member can only be granted an activity their department has
  // been assigned. Shape: { [deptName]: { Nurse:{key:true,...}, PCA:{key:true,...} } }.
  const DEPT_PRIV_KEY='unico_dept_privileges_v1';
  function loadDeptPrivileges(){ try{const o=JSON.parse(localStorage.getItem(DEPT_PRIV_KEY)); return (o&&typeof o==='object'&&!Array.isArray(o))?o:{}; }catch(e){return {};} }
  function saveDeptPrivileges(o){ try{localStorage.setItem(DEPT_PRIV_KEY,JSON.stringify(o));}catch(e){} }
  function deptPrivilegeMap(dept,role){ const o=loadDeptPrivileges(); const d=o[dept]; return (d&&d[roleKey(role)])?d[roleKey(role)]:{}; }
  function setDeptPrivilegeMap(dept,role,map){ if(!dept) return; const o=loadDeptPrivileges(); o[dept]=o[dept]||{}; o[dept][roleKey(role)]=map; saveDeptPrivileges(o); }
  // Union of assigned activity keys across every department in `depts`, for one role —
  // what the staff form's checklist is allowed to show once department(s) are picked.
  function deptPrivilegeKeysFor(depts,role){
    const set=new Set();
    (depts||[]).forEach(d=>{ const m=deptPrivilegeMap(d,role); Object.keys(m).forEach(k=>{ if(m[k]) set.add(k); }); });
    return set;
  }
  // Activity-centric counterparts of the two above — same store, read/written the
  // other way round: which departments (out of `deptNames`) have ONE activity, and
  // toggling that one activity for ONE department. Lets the assignment screen work
  // either "pick a department, tick its activities" or "pick an activity, tick its
  // departments" against the exact same underlying data.
  function privilegeDeptsAssigned(deptNames,role,group,item){
    const key=privKey(group,item);
    return (deptNames||[]).filter(d=>!!(deptPrivilegeMap(d,role)||{})[key]);
  }
  function setPrivilegeDeptAssignment(dept,role,group,item,on){
    const key=privKey(group,item);
    const map={...(deptPrivilegeMap(dept,role)||{})};
    if(on) map[key]=true; else delete map[key];
    setDeptPrivilegeMap(dept,role,map);
  }
  // ---------- department GROUPS — bulk-assignment presets ("All OPD", "All ICU"...) ----------
  // Named bundles of departments, purely a shortcut for the assignment screen: pick a
  // zone instead of hand-picking every department in it. Seeded ONCE from a best-guess
  // over each department's .group (from the Statistics module) and name, then owned
  // entirely by the admin — never re-guessed after that, so edits are never silently
  // clobbered by a later reload.
  const DEPT_GROUP_KEY='unico_dept_privilege_groups_v1';
  function loadDeptGroupsRaw(){ try{const a=JSON.parse(localStorage.getItem(DEPT_GROUP_KEY)); return Array.isArray(a)?a:null; }catch(e){return null;} }
  function saveDeptGroups(arr){ try{localStorage.setItem(DEPT_GROUP_KEY,JSON.stringify(arr||[]));}catch(e){} }
  function guessDeptGroups(deptObjs){
    const items=(deptObjs||[]).map(d=>typeof d==='string'?{name:d,group:''}:{name:d.name||'',group:d.group||''});
    const pick=(re)=>[...new Set(items.filter(d=>re.test(d.group)||re.test(d.name)).map(d=>d.name).filter(Boolean))];
    return [
      {name:'All OPD',depts:pick(/out.?patient|\bopd\b|day\s?care|home\s?care/i)},
      {name:'All IPD / Cabin',depts:pick(/in-?patient|ward|\bipd\b|cabin|\blevel[-\s]?\d+\b|labour|delivery|\bldr\b/i)},
      {name:'All OT',depts:pick(/operat(ing|ive)|theatre|\bot\b/i)},
      {name:'All Critical / ICU',depts:pick(/critical|emergency|\bicu\b|\bccu\b|\bhdu\b|\ber\b/i)},
    ].filter(g=>g.depts.length>0);
  }
  // deptObjs: the live department list ([{name,group}] from the Statistics module, or
  // plain name strings as a fallback) — used only to seed groups the very first time.
  function deptGroupsFor(deptObjs){
    const stored=loadDeptGroupsRaw();
    if(stored) return stored;
    const guessed=guessDeptGroups(deptObjs);
    saveDeptGroups(guessed);
    return guessed;
  }
  function setDeptGroups(arr){ saveDeptGroups(arr); }
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

  // Upcoming birthdays — same shape and windowing rule as anniversaries() so the two
  // dashboard cards behave identically. `turns` is the age they are about to become, so
  // a blank/typo'd year (age outside 15..80) just omits it rather than printing "2026 yrs".
  // `inDays` = 0 means TODAY, which is what the dashboard highlights.
  function birthdays(list,nDays=30){
    const now=new Date(); const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
    const horizon=new Date(today.getTime()+nDays*86400000); const out=[];
    list.filter(e=>e.is_active&&!e.former&&e.dob).forEach(e=>{
      const d=new Date(e.dob); if(isNaN(d))return;
      let bd=new Date(today.getFullYear(),d.getMonth(),d.getDate());
      if(bd<today) bd=new Date(today.getFullYear()+1,d.getMonth(),d.getDate());
      if(bd>=today&&bd<=horizon){
        const t=bd.getFullYear()-d.getFullYear();
        out.push({e,bday:bd,turns:(t>=15&&t<=80)?t:null,inDays:Math.round((bd-today)/86400000)});
      }
    });
    return out.sort((a,b)=>a.bday-b.bday);
  }

  // ---------- store ----------
  const KEY='unico_staff_v3';
  function realSeed(){ return Array.isArray(window.STAFF_SEED)
    ? window.STAFF_SEED.map(e=>({...e,fav:!!e.fav,notes:e.notes||[]}))
    : []; }
  /* The overlay is the browser's copy of the roster. It masks the database by design —
     but NOT for a BNMC verification.

     A verification is evidence obtained once from an outside authority, stored on the
     staff document server-side (POST /api/bnmc/record). It arrives here inside
     window.__UNICO_STAFF__. Merging it OVER the overlay row means a cleared browser, a
     stale localStorage copy, or a hydration that lost the field can never erase it: the
     server copy always wins for these three keys, and nothing else is touched.

     The same applies to a staff PORTRAIT: the bytes are in Cloudinary, but the url was
     overlay-only, so 23 uploads on production ended up orphaned — the picture kept, the
     link gone, and no way to tell whose face it was. server/photos.js now writes that
     url to the staff document, and it is restored here whenever a row has lost it. */
  function mergeServerVerification(list){
    try{
      const src=(typeof window!=='undefined'&&Array.isArray(window.__UNICO_STAFF__))?window.__UNICO_STAFF__:null;
      if(!src||!src.length||!Array.isArray(list)) return list;
      // Matched by record id ONLY. Employee numbers are shared by different people
      // (11410, 11520), and an emp_id fallback stamped one nurse's photo and BNMC licence
      // onto the other, which the next staff save then made permanent.
      const byId={};
      src.forEach(x=>{ if(!x||!(x.licence_verified||x.photo)) return;
        if(x.id!=null) byId[String(x.id)]=x; });
      if(!Object.keys(byId).length) return list;
      return list.map(e=>{
        const srv=e&&e.id!=null&&byId[String(e.id)];
        if(!srv) return e;
        // Only take a NEWER verification, so a local re-verify done seconds ago is not
        // reverted by a server copy the page was hydrated with.
        const out=Object.assign({},e);
        let changed=false;
        // Verification: the server copy wins unless ours is newer (a re-verify done
        // seconds ago must not be reverted by the copy this page was hydrated with).
        if(srv.licence_verified){
          const mine=e.licence_verified&&e.licence_verified.at;
          const theirs=srv.licence_verified.at;
          if(!(mine&&theirs&&String(mine)>=String(theirs))){
            out.licence_verified=srv.licence_verified;
            out.licence_no=e.licence_no||srv.licence_no;
            out.licence_program=e.licence_program||srv.licence_program;
            changed=true;
          }
        }
        // Portrait: restore ONLY when this row has none. Never overwrite a picture the
        // overlay already carries — that may be one just chosen and not yet synced. A
        // removal clears the server copy too (photos.js), so nothing comes back.
        if(srv.photo&&!(e.photo||e.photo_url)){ out.photo=srv.photo; changed=true; }
        return changed?out:e;
      });
    }catch(err){ return list; }
  }
  function load(){ try{const s=JSON.parse(localStorage.getItem(KEY)); return Array.isArray(s)?mergeServerVerification(s):null;}catch(e){return null;} }
  // Publish a photo lookup for every module that shows a staff avatar (Performance,
  // Duty Roster, HR…) but doesn't hold the staff record itself. Keyed by emp id and
  // by lowercase name; the value is the CDN url. Includes former staff — an exits
  // register still shows the person's face.
  function publishPhotos(list){
    try{
      const m={};
      (list||[]).forEach(e=>{
        const p=e.photo||e.photo_url; const u=p?(typeof p==='string'?p:(p.url||'')):'';
        if(!u)return;
        if(e.emp_id)m['id:'+String(e.emp_id).trim()]=u;
        if(e.id!=null)m['id:'+String(e.id)]=u;
        if(e.name)m['nm:'+String(e.name).trim().toLowerCase()]=u;
      });
      window.__STAFF_PHOTOS__=m;
    }catch(err){}
  }
  publishPhotos(load()||[]);   // modules can render before any staff view mounts
  /* ONE roster per page, shared by every useStaffStore() call.

     The hook is called by the app shell, the header search (always mounted), Performance,
     Duty Roster, Manpower… and each call used to keep its OWN copy of the roster, edit
     counter and 30-second refresh. A refresh only knew about edits made through its own
     copy. When the header search read the roster just before a Save and its answer
     landed while that save was in flight, the older roster was written back into the
     browser, and the next routine save sent it to the server as a deliberate edit: the
     new nurse was deleted, or the activities just entered were reverted — after the form
     had already said "saved". With one shared state, an edit made through any view
     invalidates every refresh that started before it. */
  const shared={staff:null,version:0,busy:null,refreshing:false,error:'',subs:new Set(),mounted:0,timer:null};
  const rosterNow=()=>{ if(shared.staff===null) shared.staff=load()||realSeed(); return shared.staff; };
  const notify=()=>shared.subs.forEach(fn=>{ try{ fn(); }catch(e){} });
  function setStaff(change){
    const next=typeof change==='function'?change(rosterNow()):change;
    // Persist local edits immediately, so a Refresh in the same tick can flush
    // them before fetching. React mounting/hydration never writes the register.
    localStorage.setItem(KEY,JSON.stringify(next));
    shared.version++; shared.staff=next; notify();
  }
  function refresh(){
    if(shared.busy) return shared.busy;
    if(window.unicoCan && !window.unicoCan('staff','view')) return Promise.resolve(false);
    const started=shared.version, stored=localStorage.getItem(KEY);
    shared.refreshing=true; shared.error=''; notify();
    shared.busy=(async()=>{
      try{
        const saved=window.unicoFlushNow ? await window.unicoFlushNow() : {ok:true};
        if(saved && saved.ok===false) throw new Error('Save pending. Keep this tab open and try Refresh again.');
        const session=window.unicoSession;
        const base=session&&session.configured()?session.serverUrl():'';
        const headers=base&&session.token()?{authorization:'Bearer '+session.token()}:{};
        const r=await fetch(base+'/api/staff',{credentials:'same-origin',cache:'no-store',headers});
        const j=await r.json();
        if(!r.ok || !j.ok || !Array.isArray(j.staff)) throw new Error(j.error||'Could not refresh the staff list. Try again.');
        // Anything written to the roster while the request was out is newer than its answer.
        if(shared.version!==started || localStorage.getItem(KEY)!==stored) return false;
        const data={[KEY]:JSON.stringify(j.staff)};
        if(window.unicoApplyRemoteData){
          const applied=window.unicoApplyRemoteData(data);
          if(applied && applied[KEY]===false) return false; // the bridge still holds an unconfirmed edit
        } else localStorage.setItem(KEY,data[KEY]);
        window.__UNICO_STAFF__=j.staff;
        window.STAFF_SEED=j.staff;
        shared.staff=j.staff;
        return true;
      }catch(e){ shared.error=e.message||'Could not refresh the staff list.'; return false; }
      finally{ shared.busy=null; shared.refreshing=false; notify(); }
    })();
    return shared.busy;
  }
  // One poll for the page however many views show staff: on entry, every 30 seconds
  // and when returning to the app.
  const pollNow=()=>{ if(document.visibilityState!=='hidden') refresh(); };
  function useStaffStore(){
    const [,rerender]=React.useState(0);
    React.useEffect(()=>{
      const fn=()=>rerender(n=>n+1);
      shared.subs.add(fn);
      if(!shared.mounted++){
        shared.timer=setInterval(pollNow,30000);
        window.addEventListener('focus',pollNow);
        document.addEventListener('visibilitychange',pollNow);
      }
      pollNow();
      return ()=>{
        shared.subs.delete(fn);
        if(!--shared.mounted){
          clearInterval(shared.timer); shared.timer=null;
          window.removeEventListener('focus',pollNow);
          document.removeEventListener('visibilitychange',pollNow);
        }
      };
    },[]);
    const staff=rosterNow();
    React.useEffect(()=>{
      publishPhotos(staff);
    },[staff]);
    const api={
      staff, refresh, refreshing:shared.refreshing, refreshError:shared.error,
      get:(id)=>staff.find(e=>e.id===id),
      nextEmpId:()=>{ const max=staff.reduce((m,e)=>{const n=parseInt((e.emp_id||'').replace(/\D/g,''))||0;return Math.max(m,n);},100); return `UNC-${String(max+1).padStart(4,'0')}`; },
      create:(data)=>{ const id=Math.max(0,...rosterNow().map(e=>e.id))+1; setStaff(s=>[...s,{id,is_active:true,notes:[],created_at:Date.now(),...data}]); return id; },
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

  window.STAFF={DEPARTMENTS,DESIGNATIONS,QUALIFICATIONS,VACCINATION_STATES,TRAININGS,EXTRACURRICULARS,VACC_OK,canonVacc,
    ROLES,PCA_DESIGNATIONS,PCA_QUALIFICATIONS,PCA_TRAININGS,designationsFor,qualificationsFor,
    NURSE_PRIVILEGE_GROUPS,PCA_PRIVILEGE_GROUPS,privilegeGroupsFor,privKey,privilegeStats,
    loadCustomPrivileges,addCustomPrivilege,removeCustomPrivilege,
    deptPrivilegeMap,setDeptPrivilegeMap,deptPrivilegeKeysFor,privilegeDeptsAssigned,setPrivilegeDeptAssignment,
    deptGroupsFor,setDeptGroups,
    fieldOptList,addFieldOpt,removeFieldOpt,
    customFields,addCustomField,removeCustomField,renameCustomField,addCustomFieldOption,removeCustomFieldOption,
    seedStaff,kpis,countBy,vaccinationBreakdown,experienceBuckets,expYears,expLabel,priorYearsOf,unicoYearsOf,fmtYM,joinersByYear,recentJoiners,compliance,anniversaries,birthdays,byRole,uniqueVals};
  window.useStaffStore=useStaffStore;
})();

;
/* ===== quality-seed.js ===== */
/* Generated from server/seed/quality.json for offline/verification fallback. */
window.__UNICO_QUALITY_FALLBACK__ = [
  {
    "key": "Cathlab",
    "name": "Cathlab",
    "year": "2025-2026",
    "executive": {
      "keyAchievements": "Zero post-PCI complications and zero needle-stick injuries across all four reported quarters. 100% door-to-balloon time compliance in Q2 (Nov-Dec 2025). Patient volume grew steadily from 11 (Q1) to 22 (Q4). Total patients treated across the year: 63.",
      "majorGaps": "2 puncture-site hematomas reported (1 in Q1 Aug-Oct 2025, 1 in Q4 Apr-May 2026). Door-to-balloon time data captured only in Q2 - tracking gap for other quarters.",
      "overallStatus": "Good",
      "recommendations": "Continue current safety protocols. Ensure door-to-balloon time is recorded for every PCI case across all quarters. Review hematoma root cause for Q4 case and reinforce post-puncture compression protocol."
    },
    "meta": {
      "preparedBy": "",
      "reviewedBy": "",
      "approvedBy": ""
    },
    "indicators": [
      {
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "id": "ind-puncture-hematoma",
        "name": "Puncture Site Hematoma",
        "quarterRemarks": {
          "Q1": "Aug-Oct 2025: 1 hematoma",
          "Q2": "Nov-Dec 2025: nil",
          "Q3": "Jan-Mar 2026: nil",
          "Q4": "Apr-May 2026: 1 hematoma"
        },
        "quarters": {
          "Q1": 1,
          "Q2": 0,
          "Q3": 0,
          "Q4": 1
        },
        "remarks": "2 cases for the year (Q1 and Q4)",
        "valueType": "Count",
        "formula": "count",
        "numLabel": "Puncture Site Hematoma",
        "unit": "count",
        "formulaText": "value = Puncture Site Hematoma",
        "numeratorDef": "Post-procedure cath-lab complications (e.g. access-site haematoma).",
        "reference": "Cath-lab procedural safety indicator."
      },
      {
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "id": "ind-post-pci-complication",
        "name": "Post-PCI Complication",
        "quarterRemarks": {
          "Q1": "Aug-Oct 2025: nil",
          "Q2": "Nov-Dec 2025: nil",
          "Q3": "Jan-Mar 2026: nil",
          "Q4": "Apr-May 2026: nil"
        },
        "quarters": {
          "Q1": 0,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "remarks": "Zero across all four reported quarters",
        "valueType": "Count",
        "formula": "count",
        "numLabel": "Post-PCI Complication",
        "unit": "count",
        "formulaText": "value = Post-PCI Complication",
        "numeratorDef": "Post-procedure cath-lab complications (e.g. access-site haematoma).",
        "reference": "Cath-lab procedural safety indicator."
      },
      {
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "id": "ind-needle-stick-injury",
        "name": "Needle Stick Injury (NSI)",
        "quarterRemarks": {
          "Q1": "Aug-Oct 2025: nil",
          "Q2": "Nov-Dec 2025: nil",
          "Q3": "Jan-Mar 2026: nil",
          "Q4": "Apr-May 2026: nil"
        },
        "quarters": {
          "Q1": 0,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "remarks": "Staff safety indicator - zero injuries maintained across all quarters",
        "valueType": "Count",
        "formula": "count",
        "numLabel": "Needle Stick Injury (NSI)",
        "unit": "count",
        "formulaText": "value = Needle Stick Injury (NSI)",
        "numeratorDef": "Needle-stick / sharps injuries to staff.",
        "reference": "CDC sharps-safety · NABH staff-safety indicator."
      },
      {
        "benchmark": ">=90% of cases within 90 min",
        "benchmarkValue": 90,
        "goalDirection": "higher_is_better",
        "id": "ind-door-to-balloon",
        "name": "Door-to-Balloon Compliance Rate (<=90 min)",
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Nov-Dec 2025: 1 case, proper time maintained (100%)",
          "Q3": "Not reported",
          "Q4": "Not reported"
        },
        "quarters": {
          "Q1": null,
          "Q2": 100,
          "Q3": null,
          "Q4": null
        },
        "remarks": "Q2: 1/1 case within proper time (100%). Other quarters: not reported.",
        "valueType": "%",
        "formula": "pct",
        "numLabel": "PCI cases with door-to-balloon ≤90 min",
        "denLabel": "Total primary PCI cases",
        "unit": "%",
        "formulaText": "(PCI cases with door-to-balloon ≤90 min ÷ Total primary PCI cases) × 100",
        "numeratorDef": "Primary-PCI STEMI cases where balloon inflation occurred within 90 minutes of hospital arrival.",
        "denominatorDef": "All primary-PCI STEMI cases in the reporting period.",
        "reference": "ACC/AHA STEMI guideline — door-to-balloon (D2B) ≤90 min for primary PCI."
      },
      {
        "id": "ind-cauti-rate",
        "name": "CAUTI Rate (per 1000 cath-days)",
        "valueType": "Rate (per 1000)",
        "formula": "rate1000",
        "numLabel": "CAUTI cases",
        "denLabel": "Urinary catheter days",
        "unit": "per 1000 cath-days",
        "benchmark": "<= 0",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "quarters": {
          "Q1": null,
          "Q2": null,
          "Q3": null,
          "Q4": null
        },
        "quarterRemarks": {},
        "remarks": "",
        "formulaText": "(CAUTI cases ÷ Urinary catheter days) × 1000",
        "numeratorDef": "Lab-confirmed catheter-associated urinary tract infections.",
        "denominatorDef": "Urinary catheter days in the reporting period.",
        "reference": "CDC NHSN — CAUTI surveillance definition."
      }
    ]
  },
  {
    "key": "CCU",
    "name": "CCU",
    "year": "2025-2026",
    "executive": {
      "keyAchievements": "Zero bed sores in Q2 (Nov-Dec 2025) and Q4 (Apr-May 2026). Patient volume across reported quarters: 14 (Q2), 50 (Q3), 35 (Q4); total 99 patients.",
      "majorGaps": "Cardiac arrest survival rate at 0% in both Q3 (0/2) and Q4 (0/3) - 5 cardiac arrests with no survivors across the year. 2 bed sores recorded in Q3 (Jan-Mar 2026). Q1 (Aug-Oct 2025) data not reported.",
      "overallStatus": "Needs Improvement",
      "recommendations": "Urgent review of cardiac arrest response: audit code-blue activation time, ACLS team readiness, defibrillator availability, and post-arrest care pathway. Conduct root cause analysis on each arrest case. Reinforce pressure-injury prevention bundle (repositioning schedule, skin assessment, support surfaces) following the Q3 bed sore cluster. Begin reporting Q1 data going forward for full-year trending."
    },
    "meta": {
      "preparedBy": "",
      "reviewedBy": "",
      "approvedBy": ""
    },
    "indicators": [
      {
        "id": "ind-ccu-bed-sore",
        "name": "Bed Sore (Pressure Injury)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "2 cases for the year, both in Q3 (Jan-Mar 2026).",
        "quarters": {
          "Q1": null,
          "Q2": 0,
          "Q3": 2,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Nov-Dec 2025 (14 patients): nil",
          "Q3": "Jan-Mar 2026 (50 patients): 2 cases",
          "Q4": "Apr-May 2026 (35 patients): nil"
        },
        "formula": "count",
        "numLabel": "Bed Sore (Pressure Injury)",
        "unit": "count",
        "formulaText": "value = Bed Sore (Pressure Injury)",
        "numeratorDef": "Hospital-acquired pressure ulcers (stage II+).",
        "reference": "NPUAP/EPUAP staging · NABH patient-safety indicator."
      },
      {
        "id": "ind-ccu-cardiac-arrest-events",
        "name": "Cardiac Arrest Events",
        "valueType": "Count",
        "benchmark": "Informational (track + RCA)",
        "benchmarkValue": "",
        "goalDirection": "lower_is_better",
        "remarks": "5 cardiac arrests across the year (2 in Q3, 3 in Q4). Denominator for survival rate.",
        "quarters": {
          "Q1": null,
          "Q2": 0,
          "Q3": 2,
          "Q4": 3
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Nov-Dec 2025: nil",
          "Q3": "Jan-Mar 2026: 2 events",
          "Q4": "Apr-May 2026: 3 events"
        },
        "formula": "count",
        "numLabel": "Cardiac Arrest Events",
        "unit": "count",
        "formulaText": "value = Cardiac Arrest Events",
        "numeratorDef": "In-unit cardiac arrest events (denominator for survival rate).",
        "reference": "Utstein resuscitation reporting."
      },
      {
        "id": "ind-ccu-cardiac-arrest-survival",
        "name": "Cardiac Arrest Survival Rate",
        "valueType": "%",
        "benchmark": ">=25% (ROSC sustained / discharged alive)",
        "benchmarkValue": 25,
        "goalDirection": "higher_is_better",
        "remarks": "0% survival across all reported arrests (0/5). Trigger for root cause analysis and code-blue response audit.",
        "quarters": {
          "Q1": null,
          "Q2": null,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Nov-Dec 2025: 0 arrests - N/A",
          "Q3": "Jan-Mar 2026: 0/2 survived (100% not survived)",
          "Q4": "Apr-May 2026: 0/3 survived (100% not survived)"
        },
        "formula": "pct",
        "numLabel": "Cardiac arrests survived (ROSC sustained / discharged alive)",
        "denLabel": "Cardiac arrest events",
        "unit": "%",
        "formulaText": "(Cardiac arrests survived (ROSC sustained / discharged alive) ÷ Cardiac arrest events) × 100",
        "numeratorDef": "In-unit cardiac arrests with sustained return of spontaneous circulation (ROSC ≥20 min) / survived to discharge.",
        "denominatorDef": "Total cardiac arrest events in the unit during the period.",
        "reference": "Utstein resuscitation reporting — ROSC / survival to discharge."
      }
    ]
  },
  {
    "key": "CTICU",
    "name": "CT ICU",
    "year": "2025-2026",
    "executive": {
      "keyAchievements": "Zero events across all nine quality indicators (CAUTI, CLABSI, VAE, SSI, NSI, HAPU, DVT, Patient Fall, Return to ICU) for Q2 2026 (Apr-May 2026). Patient volume: 7 patients in the reporting period.",
      "majorGaps": "Q1 2026 (Jan-Mar) data not yet reported. Full-year 2025 reporting also pending across Q1-Q4 2025.",
      "overallStatus": "Excellent",
      "recommendations": "Sustain current infection-prevention bundles (VAE, CAUTI, CLABSI), DVT prophylaxis, pressure-injury prevention, and fall-risk assessment. Begin reporting earlier quarters going forward for full-year trending."
    },
    "meta": {
      "preparedBy": {
        "name": "",
        "designation": ""
      },
      "reviewedBy": {
        "name": "",
        "designation": ""
      },
      "approvedBy": {
        "name": "",
        "designation": ""
      }
    },
    "indicators": [
      {
        "id": "ind-ctvs-2026-volume",
        "name": "Patient Volume",
        "valueType": "Count",
        "benchmark": "Informational",
        "benchmarkValue": "",
        "goalDirection": "higher_is_better",
        "category": "Volume",
        "year": "2026",
        "remarks": "Total patients admitted to CT ICU during the reporting quarter.",
        "quarters": {
          "Q1": null,
          "Q2": 7,
          "Q3": null,
          "Q4": null
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Apr-May 2026: 7 patients",
          "Q3": "",
          "Q4": ""
        },
        "formula": "count",
        "numLabel": "Patient Volume",
        "unit": "count",
        "formulaText": "value = Patient Volume",
        "numeratorDef": "Patients admitted/treated in the unit during the period.",
        "reference": "Informational census (denominator for rate indicators)."
      },
      {
        "id": "ind-ctvs-2026-cauti",
        "name": "Catheter-Associated UTI (CAUTI)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "year": "2026",
        "remarks": "Zero in reported quarter.",
        "quarters": {
          "Q1": null,
          "Q2": 0,
          "Q3": null,
          "Q4": null
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Apr-May 2026 (7 patients): nil",
          "Q3": "",
          "Q4": ""
        },
        "formula": "count",
        "numLabel": "Catheter-Associated UTI (CAUTI)",
        "unit": "count",
        "formulaText": "value = Catheter-Associated UTI (CAUTI)",
        "numeratorDef": "Lab-confirmed catheter-associated urinary tract infections.",
        "reference": "CDC NHSN — CAUTI surveillance definition."
      },
      {
        "id": "ind-ctvs-2026-clabsi",
        "name": "Central Line-Associated Bloodstream Infection (CLABSI)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "year": "2026",
        "remarks": "Zero in reported quarter.",
        "quarters": {
          "Q1": null,
          "Q2": 0,
          "Q3": null,
          "Q4": null
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Apr-May 2026 (7 patients): nil",
          "Q3": "",
          "Q4": ""
        },
        "formula": "count",
        "numLabel": "Central Line-Associated Bloodstream Infection (CLABSI)",
        "unit": "count",
        "formulaText": "value = Central Line-Associated Bloodstream Infection (CLABSI)",
        "numeratorDef": "Lab-confirmed central-line associated bloodstream infections.",
        "reference": "CDC NHSN — CLABSI surveillance definition."
      },
      {
        "id": "ind-ctvs-2026-vae",
        "name": "Ventilator-Associated Event (VAE)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "year": "2026",
        "remarks": "Zero in reported quarter.",
        "quarters": {
          "Q1": null,
          "Q2": 0,
          "Q3": null,
          "Q4": null
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Apr-May 2026 (7 patients): nil",
          "Q3": "",
          "Q4": ""
        },
        "formula": "count",
        "numLabel": "Ventilator-Associated Event (VAE)",
        "unit": "count",
        "formulaText": "value = Ventilator-Associated Event (VAE)",
        "numeratorDef": "Ventilator-associated pneumonia / events.",
        "reference": "CDC NHSN — VAP / VAE surveillance definition."
      },
      {
        "id": "ind-ctvs-2026-ssi",
        "name": "Surgical Site Infection (SSI)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "year": "2026",
        "remarks": "Zero in reported quarter.",
        "quarters": {
          "Q1": null,
          "Q2": 0,
          "Q3": null,
          "Q4": null
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Apr-May 2026 (7 patients): nil",
          "Q3": "",
          "Q4": ""
        },
        "formula": "count",
        "numLabel": "Surgical Site Infection (SSI)",
        "unit": "count",
        "formulaText": "value = Surgical Site Infection (SSI)",
        "numeratorDef": "Surgical site infections following an operative procedure.",
        "reference": "CDC NHSN — SSI surveillance definition."
      },
      {
        "id": "ind-needle-stick-injury",
        "name": "Needle Stick Injury (NSI)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "year": "2026",
        "remarks": "Staff safety indicator - zero in reported quarter.",
        "quarters": {
          "Q1": null,
          "Q2": 0,
          "Q3": null,
          "Q4": null
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Apr-May 2026: nil",
          "Q3": "",
          "Q4": ""
        },
        "formula": "count",
        "numLabel": "Needle Stick Injury (NSI)",
        "unit": "count",
        "formulaText": "value = Needle Stick Injury (NSI)",
        "numeratorDef": "Needle-stick / sharps injuries to staff.",
        "reference": "CDC sharps-safety · NABH staff-safety indicator."
      },
      {
        "id": "ind-ctvs-2026-hapu",
        "name": "Hospital-Acquired Pressure Ulcer (HAPU)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "year": "2026",
        "remarks": "Zero in reported quarter.",
        "quarters": {
          "Q1": null,
          "Q2": 0,
          "Q3": null,
          "Q4": null
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Apr-May 2026 (7 patients): nil",
          "Q3": "",
          "Q4": ""
        },
        "formula": "count",
        "numLabel": "Hospital-Acquired Pressure Ulcer (HAPU)",
        "unit": "count",
        "formulaText": "value = Hospital-Acquired Pressure Ulcer (HAPU)",
        "numeratorDef": "Hospital-acquired pressure ulcers (stage II+).",
        "reference": "NPUAP/EPUAP staging · NABH patient-safety indicator."
      },
      {
        "id": "ind-ctvs-2026-dvt",
        "name": "Deep Vein Thrombosis (DVT)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "year": "2026",
        "remarks": "Zero in reported quarter.",
        "quarters": {
          "Q1": null,
          "Q2": 0,
          "Q3": null,
          "Q4": null
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Apr-May 2026 (7 patients): nil",
          "Q3": "",
          "Q4": ""
        },
        "formula": "count",
        "numLabel": "Deep Vein Thrombosis (DVT)",
        "unit": "count",
        "formulaText": "value = Deep Vein Thrombosis (DVT)",
        "numeratorDef": "Hospital-acquired deep-vein thrombosis events.",
        "reference": "NABH VTE prophylaxis & surveillance."
      },
      {
        "id": "ind-ctvs-2026-patient-fall",
        "name": "Patient Fall",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "year": "2026",
        "remarks": "Zero in reported quarter.",
        "quarters": {
          "Q1": null,
          "Q2": 0,
          "Q3": null,
          "Q4": null
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Apr-May 2026 (7 patients): nil",
          "Q3": "",
          "Q4": ""
        },
        "formula": "count",
        "numLabel": "Patient Fall",
        "unit": "count",
        "formulaText": "value = Patient Fall",
        "numeratorDef": "Patient fall events during the in-patient stay.",
        "reference": "NABH / NDNQI — patient fall events."
      },
      {
        "id": "ind-ctvs-2026-return-to-icu",
        "name": "Return to ICU",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "year": "2026",
        "remarks": "Zero in reported quarter.",
        "quarters": {
          "Q1": null,
          "Q2": 0,
          "Q3": null,
          "Q4": null
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Apr-May 2026 (7 patients): nil",
          "Q3": "",
          "Q4": ""
        },
        "formula": "count",
        "numLabel": "Return to ICU",
        "unit": "count",
        "formulaText": "value = Return to ICU",
        "numeratorDef": "Patients returning to ICU during the same admission.",
        "reference": "Critical-care outcome — return to ICU."
      }
    ]
  },
  {
    "key": "Dialysis",
    "name": "Dialysis",
    "year": "2025-2026",
    "executive": {
      "keyAchievements": "Zero events across six safety indicators (Patient Fall, Medication Administration Error, Catheter De-lining, NSI, Infection Rate, Vascular Access Complications) in October 2025.",
      "majorGaps": "1 hypotension event in October 2025. Dialysis Adequacy and Water Quality data not yet reported - establish per-session and per-sample tracking.",
      "overallStatus": "Good",
      "recommendations": "Review hypotension case for fluid removal protocol adherence (UF rate, dry weight assessment). Begin routine reporting of Kt/V or URR per session and AAMI water quality samples. Sustain current infection-prevention and access-care bundles."
    },
    "meta": {
      "preparedBy": "",
      "reviewedBy": "",
      "approvedBy": ""
    },
    "indicators": [
      {
        "id": "ind-dial-patient-fall",
        "name": "Patient Fall",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero in reported quarter.",
        "quarters": {
          "Q1": 0,
          "Q2": null,
          "Q3": null,
          "Q4": null
        },
        "quarterRemarks": {
          "Q1": "Aug-Oct 2025 (reported as 2025 Q4): nil",
          "Q2": "Not reported",
          "Q3": "Not reported",
          "Q4": "Not reported"
        },
        "formula": "count",
        "numLabel": "Patient Fall",
        "unit": "count",
        "formulaText": "value = Patient Fall",
        "numeratorDef": "Patient fall events during the in-patient stay.",
        "reference": "NABH / NDNQI — patient fall events."
      },
      {
        "id": "ind-dial-med-error",
        "name": "Medication Administration Error",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero in reported quarter.",
        "quarters": {
          "Q1": 0,
          "Q2": null,
          "Q3": null,
          "Q4": null
        },
        "quarterRemarks": {
          "Q1": "Aug-Oct 2025 (reported as 2025 Q4): nil",
          "Q2": "Not reported",
          "Q3": "Not reported",
          "Q4": "Not reported"
        },
        "formula": "count",
        "numLabel": "Medication Administration Error",
        "unit": "count",
        "formulaText": "value = Medication Administration Error",
        "numeratorDef": "Medication errors reported (prescribing/dispensing/administration).",
        "reference": "NABH MOM · NCC-MERP medication-error taxonomy."
      },
      {
        "id": "ind-dial-cath-dislodge",
        "name": "Accidental De-lining of Catheter",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero in reported quarter.",
        "quarters": {
          "Q1": 0,
          "Q2": null,
          "Q3": null,
          "Q4": null
        },
        "quarterRemarks": {
          "Q1": "Aug-Oct 2025 (reported as 2025 Q4): nil",
          "Q2": "Not reported",
          "Q3": "Not reported",
          "Q4": "Not reported"
        },
        "formula": "count",
        "numLabel": "Accidental De-lining of Catheter",
        "unit": "count",
        "formulaText": "value = Accidental De-lining of Catheter",
        "numeratorDef": "Accidental / unplanned catheter or line dislodgements.",
        "reference": "NABH device-management safety indicator."
      },
      {
        "id": "ind-needle-stick-injury",
        "name": "Needle Stick Injury (NSI)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Staff safety - zero in reported quarter.",
        "quarters": {
          "Q1": 0,
          "Q2": null,
          "Q3": null,
          "Q4": null
        },
        "quarterRemarks": {
          "Q1": "Oct 2025: nil",
          "Q2": "Not reported",
          "Q3": "Not reported",
          "Q4": "Not reported"
        },
        "formula": "count",
        "numLabel": "Needle Stick Injury (NSI)",
        "unit": "count",
        "formulaText": "value = Needle Stick Injury (NSI)",
        "numeratorDef": "Needle-stick / sharps injuries to staff.",
        "reference": "CDC sharps-safety · NABH staff-safety indicator."
      },
      {
        "id": "ind-dial-infection-rate",
        "name": "Infection Rate",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero infections in reported quarter.",
        "quarters": {
          "Q1": 0,
          "Q2": null,
          "Q3": null,
          "Q4": null
        },
        "quarterRemarks": {
          "Q1": "Aug-Oct 2025 (reported as 2025 Q4): nil",
          "Q2": "Not reported",
          "Q3": "Not reported",
          "Q4": "Not reported"
        },
        "formula": "count",
        "numLabel": "Infection Rate",
        "unit": "count",
        "formulaText": "value = Infection Rate",
        "numeratorDef": "Healthcare-associated infection events in the unit.",
        "reference": "NABH HAI surveillance (event count)."
      },
      {
        "id": "ind-dial-adequacy",
        "name": "Dialysis Adequacy (URR)",
        "valueType": "%",
        "benchmark": ">=65% URR",
        "benchmarkValue": 65,
        "goalDirection": "higher_is_better",
        "remarks": "Pending - awaiting per-session adequacy data.",
        "quarters": {
          "Q1": null,
          "Q2": null,
          "Q3": null,
          "Q4": null
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Not reported",
          "Q3": "Not reported",
          "Q4": "Not reported"
        },
        "formula": "pct",
        "numLabel": "Sessions achieving URR ≥65% (or Kt/V ≥1.2)",
        "denLabel": "Dialysis sessions sampled",
        "unit": "%",
        "formulaText": "(Sessions achieving URR ≥65% (or Kt/V ≥1.2) ÷ Dialysis sessions sampled) × 100",
        "numeratorDef": "Haemodialysis sessions meeting the adequacy target (URR ≥65% or single-pool Kt/V ≥1.2).",
        "denominatorDef": "Dialysis sessions in which adequacy (URR / Kt/V) was measured.",
        "reference": "KDOQI Haemodialysis Adequacy — URR ≥65% / spKt/V ≥1.2."
      },
      {
        "id": "ind-dial-hypotension",
        "name": "Hypotension Rate",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "1 hypotension event in October 2025.",
        "quarters": {
          "Q1": 1,
          "Q2": null,
          "Q3": null,
          "Q4": null
        },
        "quarterRemarks": {
          "Q1": "Aug-Oct 2025 (reported as 2025 Q4): 1 hypotension event in October",
          "Q2": "Not reported",
          "Q3": "Not reported",
          "Q4": "Not reported"
        },
        "formula": "count",
        "numLabel": "Hypotension Rate",
        "unit": "count",
        "formulaText": "value = Hypotension Rate",
        "numeratorDef": "Intradialytic hypotension events.",
        "reference": "Dialysis safety — intradialytic hypotension."
      },
      {
        "id": "ind-dial-vascular-complic",
        "name": "Vascular Access Complication Rate",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero in reported quarter.",
        "quarters": {
          "Q1": 0,
          "Q2": null,
          "Q3": null,
          "Q4": null
        },
        "quarterRemarks": {
          "Q1": "Aug-Oct 2025 (reported as 2025 Q4): nil",
          "Q2": "Not reported",
          "Q3": "Not reported",
          "Q4": "Not reported"
        },
        "formula": "count",
        "numLabel": "Vascular Access Complication Rate",
        "unit": "count",
        "formulaText": "value = Vascular Access Complication Rate",
        "numeratorDef": "Vascular-access complications (infection, thrombosis, bleeding).",
        "reference": "Dialysis vascular-access safety."
      },
      {
        "id": "ind-dial-water-quality",
        "name": "Water Quality Compliance",
        "valueType": "%",
        "benchmark": "100% AAMI/ISO compliance",
        "benchmarkValue": 100,
        "goalDirection": "higher_is_better",
        "remarks": "Pending - awaiting water quality test results.",
        "quarters": {
          "Q1": null,
          "Q2": null,
          "Q3": null,
          "Q4": null
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Not reported",
          "Q3": "Not reported",
          "Q4": "Not reported"
        },
        "formula": "pct",
        "numLabel": "Water/dialysate samples within AAMI/ISO limits",
        "denLabel": "Water/dialysate samples tested",
        "unit": "%",
        "formulaText": "(Water/dialysate samples within AAMI/ISO limits ÷ Water/dialysate samples tested) × 100",
        "numeratorDef": "Samples meeting AAMI/ISO chemical & microbiological purity limits.",
        "denominatorDef": "Total water / dialysate samples tested in the period.",
        "reference": "AAMI / ISO 23500 — water & dialysate quality for haemodialysis."
      }
    ]
  },
  {
    "key": "Gastroenterology",
    "name": "Gastroenterology",
    "year": "2025-2026",
    "executive": {
      "keyAchievements": "Zero events across all four quality indicators (Phlebitis, Medication Administration Error, Patient Fall, Post-Procedure Complication) for every reported quarter. Full-year coverage with 110 total patients (24 Sep-Nov 2025, 6 Dec 2025, 34 Jan-Mar 2026, 46 Apr-May 2026).",
      "majorGaps": "None identified - zero defect maintained across all indicators.",
      "overallStatus": "Excellent",
      "recommendations": "Sustain pre/post-procedure assessment, sedation safety protocol, fall-risk screening for sedated patients, and IV-site care to maintain zero adverse events."
    },
    "meta": {
      "preparedBy": "",
      "reviewedBy": "",
      "approvedBy": ""
    },
    "indicators": [
      {
        "id": "ind-gastro-phlebitis",
        "name": "Phlebitis",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across all reported quarters.",
        "quarters": {
          "Q1": 0,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Sep-Nov 2025 (calendar 2025 Q3, 24 patients): nil",
          "Q2": "Dec 2025 (calendar 2025 Q4, 6 patients): nil",
          "Q3": "Jan-Mar 2026 (calendar 2026 Q1, 34 patients): nil",
          "Q4": "Apr-May 2026 (calendar 2026 Q2, 46 patients): nil"
        },
        "formula": "count",
        "numLabel": "Phlebitis",
        "unit": "count",
        "formulaText": "value = Phlebitis",
        "numeratorDef": "Peripheral IV phlebitis events (grade ≥2).",
        "reference": "INS Infusion Therapy Standards — phlebitis scale."
      },
      {
        "id": "ind-gastro-med-error",
        "name": "Medication Administration Error",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across all reported quarters.",
        "quarters": {
          "Q1": 0,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Sep-Nov 2025: nil",
          "Q2": "Dec 2025: nil",
          "Q3": "Jan-Mar 2026: nil",
          "Q4": "Apr-May 2026: nil"
        },
        "formula": "count",
        "numLabel": "Medication Administration Error",
        "unit": "count",
        "formulaText": "value = Medication Administration Error",
        "numeratorDef": "Medication errors reported (prescribing/dispensing/administration).",
        "reference": "NABH MOM · NCC-MERP medication-error taxonomy."
      },
      {
        "id": "ind-gastro-patient-fall",
        "name": "Patient Fall",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across all reported quarters.",
        "quarters": {
          "Q1": 0,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Sep-Nov 2025: nil",
          "Q2": "Dec 2025: nil",
          "Q3": "Jan-Mar 2026: nil",
          "Q4": "Apr-May 2026: nil"
        },
        "formula": "count",
        "numLabel": "Patient Fall",
        "unit": "count",
        "formulaText": "value = Patient Fall",
        "numeratorDef": "Patient fall events during the in-patient stay.",
        "reference": "NABH / NDNQI — patient fall events."
      },
      {
        "id": "ind-gastro-post-proc-comp",
        "name": "Post-Procedure Complication",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across all reported quarters.",
        "quarters": {
          "Q1": 0,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Sep-Nov 2025: nil",
          "Q2": "Dec 2025: nil",
          "Q3": "Jan-Mar 2026: nil",
          "Q4": "Apr-May 2026: nil"
        },
        "formula": "count",
        "numLabel": "Post-Procedure Complication",
        "unit": "count",
        "formulaText": "value = Post-Procedure Complication",
        "numeratorDef": "Complications following an endoscopic/diagnostic procedure.",
        "reference": "Procedural safety indicator."
      }
    ]
  },
  {
    "key": "InfectionControl",
    "name": "Infection Control",
    "year": "2025-2026",
    "executive": {
      "keyAchievements": "Overall hand hygiene compliance trending upward: 62.2% (Sep 2025) -> 79% (Apr 2026), a 17 percentage point improvement. Nurses peaked at 87.6% in Feb 2026 - above the WHO 80% benchmark.",
      "majorGaps": "All four indicators remain below the WHO 80% benchmark on average. Doctors consistently lowest (61-71%). Others (paramedics/support) lowest overall (53-63%) with a drop to 53% in April 2026. April 2026 saw a regression for Doctors, Nurses, and Others despite Overall hitting 79%.",
      "overallStatus": "Needs Improvement",
      "recommendations": "Targeted hand hygiene training for Doctors and Others - both groups well below benchmark. Investigate April 2026 regression across groups. Maintain Nurse-focused initiatives that drove the Feb 2026 spike. Hold monthly compliance huddles per department."
    },
    "meta": {
      "preparedBy": "",
      "reviewedBy": "",
      "approvedBy": ""
    },
    "indicators": [
      {
        "id": "ind-ic-hh-overall",
        "name": "Hand Hygiene Compliance - Overall",
        "valueType": "%",
        "benchmark": ">=80%",
        "benchmarkValue": 80,
        "goalDirection": "higher_is_better",
        "remarks": "Below 80% WHO benchmark across all quarters. Improving trend.",
        "quarters": {
          "Q1": null,
          "Q2": 63.97,
          "Q3": 74.07,
          "Q4": 79
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Oct-Dec 2025 avg (Oct 61.5%, Nov 68.4%, Dec 62%) - calendar 2025 Q4",
          "Q3": "Jan-Mar 2026 avg (Jan 68%, Feb 76%, Mar 78.2%) - calendar 2026 Q1",
          "Q4": "Apr 2026 (calendar 2026 Q2): 79% (248/195)"
        },
        "formula": "pct",
        "numLabel": "Compliant hand-hygiene moments",
        "denLabel": "Observed hand-hygiene opportunities",
        "unit": "%",
        "formulaText": "(Compliant hand-hygiene moments ÷ Observed hand-hygiene opportunities) × 100",
        "numeratorDef": "Observed moments where hand hygiene was correctly performed (all staff groups).",
        "denominatorDef": "Total hand-hygiene opportunities observed (WHO 5 Moments).",
        "reference": "WHO \"My 5 Moments for Hand Hygiene\" — compliance = actions ÷ opportunities × 100."
      },
      {
        "id": "ind-ic-hh-doctors",
        "name": "Hand Hygiene Compliance - Doctors",
        "valueType": "%",
        "benchmark": ">=80%",
        "benchmarkValue": 80,
        "goalDirection": "higher_is_better",
        "remarks": "Doctor compliance lowest among groups. Below 80% across all quarters.",
        "quarters": {
          "Q1": null,
          "Q2": 61.77,
          "Q3": 70,
          "Q4": 66
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Oct-Dec 2025 avg (Oct 63, Nov 62.3, Dec 60%)",
          "Q3": "Jan-Mar 2026 avg (Jan 69, Feb 70, Mar 71%)",
          "Q4": "Apr 2026: 66% (regression)"
        },
        "formula": "pct",
        "numLabel": "Compliant moments — Doctors",
        "denLabel": "Observed opportunities — Doctors",
        "unit": "%",
        "formulaText": "(Compliant moments — Doctors ÷ Observed opportunities — Doctors) × 100",
        "numeratorDef": "Hand-hygiene moments correctly performed by doctors.",
        "denominatorDef": "Hand-hygiene opportunities observed for doctors.",
        "reference": "WHO \"My 5 Moments for Hand Hygiene\" (doctor cohort)."
      },
      {
        "id": "ind-ic-hh-nurses",
        "name": "Hand Hygiene Compliance - Nurses",
        "valueType": "%",
        "benchmark": ">=80%",
        "benchmarkValue": 80,
        "goalDirection": "higher_is_better",
        "remarks": "Best-performing group. Feb 2026 peaked at 87.6% (above benchmark). Drop in April to 69%.",
        "quarters": {
          "Q1": null,
          "Q2": 69,
          "Q3": 77.2,
          "Q4": 69
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Oct-Dec 2025 avg (Oct 67, Nov 74, Dec 66)",
          "Q3": "Jan-Mar 2026 avg (Jan 70, Feb 87.6, Mar 74)",
          "Q4": "Apr 2026: 69% (drop from Feb peak)"
        },
        "formula": "pct",
        "numLabel": "Compliant moments — Nurses",
        "denLabel": "Observed opportunities — Nurses",
        "unit": "%",
        "formulaText": "(Compliant moments — Nurses ÷ Observed opportunities — Nurses) × 100",
        "numeratorDef": "Hand-hygiene moments correctly performed by nurses.",
        "denominatorDef": "Hand-hygiene opportunities observed for nurses.",
        "reference": "WHO \"My 5 Moments for Hand Hygiene\" (nurse cohort)."
      },
      {
        "id": "ind-ic-hh-others",
        "name": "Hand Hygiene Compliance - Others",
        "valueType": "%",
        "benchmark": ">=80%",
        "benchmarkValue": 80,
        "goalDirection": "higher_is_better",
        "remarks": "Others (paramedics/support) consistently below 65%. Targeted training needed.",
        "quarters": {
          "Q1": null,
          "Q2": 58.53,
          "Q3": 60.67,
          "Q4": 53
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Oct-Dec 2025 avg (Oct 53.2, Nov 63, Dec 59.4%)",
          "Q3": "Jan-Mar 2026 avg (Jan 62, Feb 60, Mar 60%)",
          "Q4": "Apr 2026: 53% (lowest point)"
        },
        "formula": "pct",
        "numLabel": "Compliant moments — Others",
        "denLabel": "Observed opportunities — Others",
        "unit": "%",
        "formulaText": "(Compliant moments — Others ÷ Observed opportunities — Others) × 100",
        "numeratorDef": "Hand-hygiene moments correctly performed by paramedics / support staff.",
        "denominatorDef": "Hand-hygiene opportunities observed for other staff.",
        "reference": "WHO \"My 5 Moments for Hand Hygiene\" (other-staff cohort)."
      }
    ]
  },
  {
    "key": "LDR",
    "name": "LDR",
    "year": "2025-2026",
    "executive": {
      "keyAchievements": "Zero events across seven safety indicators (CAUTI, CLABSI, VAP, SSI, HAPU, DVT, Patient Fall) for all four reported quarters. 100% Partograph and Fetal HR monitoring compliance maintained. Patient volume: 10 (Q3 2025), 19 (Q4 2025), 33 (Q1 2026), 21 (Q2 2026) = 83 total.",
      "majorGaps": "1 Needle Stick Injury in Sep-Oct 2025 - any injury is above the zero-defect benchmark.",
      "overallStatus": "Good",
      "recommendations": "Conduct root cause analysis on the Q3 2025 NSI case. Reinforce safe sharps disposal, safety-engineered devices, and double-glove protocol during deliveries. Sustain current partograph, fetal monitoring, and infection-prevention bundles."
    },
    "meta": {
      "preparedBy": "",
      "reviewedBy": "",
      "approvedBy": ""
    },
    "indicators": [
      {
        "id": "ind-ldr-cauti",
        "name": "Catheter-Associated UTI (CAUTI)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across all four reported quarters.",
        "quarters": {
          "Q1": 0,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Sep-Oct 2025 (calendar 2025 Q3, 10 patients): nil",
          "Q2": "Nov-Dec 2025 (calendar 2025 Q4, 19 patients): nil",
          "Q3": "Jan-Mar 2026 (calendar 2026 Q1, 33 patients): nil",
          "Q4": "Apr-May 2026 (calendar 2026 Q2, 21 patients): nil"
        },
        "formula": "count",
        "numLabel": "Catheter-Associated UTI (CAUTI)",
        "unit": "count",
        "formulaText": "value = Catheter-Associated UTI (CAUTI)",
        "numeratorDef": "Lab-confirmed catheter-associated urinary tract infections.",
        "reference": "CDC NHSN — CAUTI surveillance definition."
      },
      {
        "id": "ind-ldr-clabsi",
        "name": "Central Line-Associated Bloodstream Infection (CLABSI)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across all four reported quarters.",
        "quarters": {
          "Q1": 0,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Sep-Oct 2025: nil",
          "Q2": "Nov-Dec 2025: nil",
          "Q3": "Jan-Mar 2026: nil",
          "Q4": "Apr-May 2026: nil"
        },
        "formula": "count",
        "numLabel": "Central Line-Associated Bloodstream Infection (CLABSI)",
        "unit": "count",
        "formulaText": "value = Central Line-Associated Bloodstream Infection (CLABSI)",
        "numeratorDef": "Lab-confirmed central-line associated bloodstream infections.",
        "reference": "CDC NHSN — CLABSI surveillance definition."
      },
      {
        "id": "ind-ldr-vap",
        "name": "Ventilator-Associated Pneumonia (VAP)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across all four reported quarters.",
        "quarters": {
          "Q1": 0,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Sep-Oct 2025: nil",
          "Q2": "Nov-Dec 2025: nil",
          "Q3": "Jan-Mar 2026: nil",
          "Q4": "Apr-May 2026: nil"
        },
        "formula": "count",
        "numLabel": "Ventilator-Associated Pneumonia (VAP)",
        "unit": "count",
        "formulaText": "value = Ventilator-Associated Pneumonia (VAP)",
        "numeratorDef": "Ventilator-associated pneumonia / events.",
        "reference": "CDC NHSN — VAP / VAE surveillance definition."
      },
      {
        "id": "ind-ldr-ssi",
        "name": "Surgical Site Infection (SSI)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across all four reported quarters.",
        "quarters": {
          "Q1": 0,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Sep-Oct 2025: nil",
          "Q2": "Nov-Dec 2025: nil",
          "Q3": "Jan-Mar 2026: nil",
          "Q4": "Apr-May 2026: nil"
        },
        "formula": "count",
        "numLabel": "Surgical Site Infection (SSI)",
        "unit": "count",
        "formulaText": "value = Surgical Site Infection (SSI)",
        "numeratorDef": "Surgical site infections following an operative procedure.",
        "reference": "CDC NHSN — SSI surveillance definition."
      },
      {
        "id": "ind-ldr-hapu",
        "name": "Hospital-Acquired Pressure Ulcer (HAPU)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across all four reported quarters.",
        "quarters": {
          "Q1": 0,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Sep-Oct 2025: nil",
          "Q2": "Nov-Dec 2025: nil",
          "Q3": "Jan-Mar 2026: nil",
          "Q4": "Apr-May 2026: nil"
        },
        "formula": "count",
        "numLabel": "Hospital-Acquired Pressure Ulcer (HAPU)",
        "unit": "count",
        "formulaText": "value = Hospital-Acquired Pressure Ulcer (HAPU)",
        "numeratorDef": "Hospital-acquired pressure ulcers (stage II+).",
        "reference": "NPUAP/EPUAP staging · NABH patient-safety indicator."
      },
      {
        "id": "ind-ldr-dvt",
        "name": "Deep Vein Thrombosis (DVT)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across all four reported quarters.",
        "quarters": {
          "Q1": 0,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Sep-Oct 2025: nil",
          "Q2": "Nov-Dec 2025: nil",
          "Q3": "Jan-Mar 2026: nil",
          "Q4": "Apr-May 2026: nil"
        },
        "formula": "count",
        "numLabel": "Deep Vein Thrombosis (DVT)",
        "unit": "count",
        "formulaText": "value = Deep Vein Thrombosis (DVT)",
        "numeratorDef": "Hospital-acquired deep-vein thrombosis events.",
        "reference": "NABH VTE prophylaxis & surveillance."
      },
      {
        "id": "ind-ldr-patient-fall",
        "name": "Patient Fall",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across all four reported quarters.",
        "quarters": {
          "Q1": 0,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Sep-Oct 2025: nil",
          "Q2": "Nov-Dec 2025: nil",
          "Q3": "Jan-Mar 2026: nil",
          "Q4": "Apr-May 2026: nil"
        },
        "formula": "count",
        "numLabel": "Patient Fall",
        "unit": "count",
        "formulaText": "value = Patient Fall",
        "numeratorDef": "Patient fall events during the in-patient stay.",
        "reference": "NABH / NDNQI — patient fall events."
      },
      {
        "id": "ind-needle-stick-injury",
        "name": "Needle Stick Injury (NSI)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "1 NSI in Sep-Oct 2025. Zero in subsequent quarters.",
        "quarters": {
          "Q1": 1,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Sep-Oct 2025 (calendar 2025 Q3, 10 patients): 1 case",
          "Q2": "Nov-Dec 2025: nil",
          "Q3": "Jan-Mar 2026: nil",
          "Q4": "Apr-May 2026: nil"
        },
        "formula": "count",
        "numLabel": "Needle Stick Injury (NSI)",
        "unit": "count",
        "formulaText": "value = Needle Stick Injury (NSI)",
        "numeratorDef": "Needle-stick / sharps injuries to staff.",
        "reference": "CDC sharps-safety · NABH staff-safety indicator."
      },
      {
        "id": "ind-ldr-partograph",
        "name": "Partograph Compliance",
        "valueType": "%",
        "benchmark": "100%",
        "benchmarkValue": 100,
        "goalDirection": "higher_is_better",
        "remarks": "100% compliance maintained in 2026 Q1 and Q2.",
        "quarters": {
          "Q1": null,
          "Q2": null,
          "Q3": 100,
          "Q4": 100
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Not reported",
          "Q3": "Jan-Mar 2026 (calendar 2026 Q1): 100%",
          "Q4": "Apr-May 2026 (calendar 2026 Q2): 100%"
        },
        "formula": "pct",
        "numLabel": "Deliveries with a correctly completed partograph",
        "denLabel": "Eligible labouring women",
        "unit": "%",
        "formulaText": "(Deliveries with a correctly completed partograph ÷ Eligible labouring women) × 100",
        "numeratorDef": "Labours in which the partograph was completed per protocol.",
        "denominatorDef": "All eligible labouring women in the period.",
        "reference": "WHO Labour Care Guide / partograph use in labour monitoring."
      },
      {
        "id": "ind-ldr-fetal-hr",
        "name": "Fetal Heart Rate Monitoring Compliance",
        "valueType": "%",
        "benchmark": "100%",
        "benchmarkValue": 100,
        "goalDirection": "higher_is_better",
        "remarks": "100% compliance sustained from Q4 2025 through Q2 2026.",
        "quarters": {
          "Q1": null,
          "Q2": 100,
          "Q3": 100,
          "Q4": 100
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Nov-Dec 2025 (calendar 2025 Q4): 100%",
          "Q3": "Jan-Mar 2026 (calendar 2026 Q1): 100%",
          "Q4": "Apr-May 2026 (calendar 2026 Q2): 100%"
        },
        "formula": "pct",
        "numLabel": "Deliveries with FHR monitored per protocol",
        "denLabel": "Deliveries requiring FHR monitoring",
        "unit": "%",
        "formulaText": "(Deliveries with FHR monitored per protocol ÷ Deliveries requiring FHR monitoring) × 100",
        "numeratorDef": "Labours with fetal heart-rate monitored at the protocol-defined frequency.",
        "denominatorDef": "All labours requiring fetal heart-rate monitoring.",
        "reference": "Intrapartum fetal surveillance — FHR monitoring compliance."
      }
    ]
  },
  {
    "key": "Level10",
    "name": "Level 10",
    "year": "2025-2026",
    "executive": {
      "keyAchievements": "Zero events across seven IPD quality indicators (Medication Administration Error, HAPU, Phlebitis, CLABSI, CAUTI, NSI, SSI) in both reporting periods.",
      "majorGaps": "2 patient falls reported during the year: 1 in 2025 Q3 (Jul-Sep) and 1 in 2026 Q2 (Apr-Jun). Other quarters not reported.",
      "overallStatus": "Good",
      "recommendations": "Conduct root cause analysis on both fall incidents. Reinforce fall-risk assessment protocol (Morse scale on admission and shift change), bed-alarm use for high-risk patients, and patient/family education on call-bell use. Sustain current infection-prevention and medication-safety practices."
    },
    "meta": {
      "preparedBy": "",
      "reviewedBy": "",
      "approvedBy": ""
    },
    "indicators": [
      {
        "id": "ind-l10-medication-error",
        "name": "Medication Administration Error",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across both reported quarters.",
        "quarters": {
          "Q1": 0,
          "Q2": null,
          "Q3": null,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Aug-Oct 2025 (reported as 2025 Q3): nil",
          "Q2": "Not reported",
          "Q3": "Not reported",
          "Q4": "Apr-May 2026 (reported as 2026 Q2): nil"
        },
        "formula": "count",
        "numLabel": "Medication Administration Error",
        "unit": "count",
        "formulaText": "value = Medication Administration Error",
        "numeratorDef": "Medication errors reported (prescribing/dispensing/administration).",
        "reference": "NABH MOM · NCC-MERP medication-error taxonomy."
      },
      {
        "id": "ind-l10-hapu",
        "name": "Hospital-Acquired Pressure Ulcer (HAPU)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across both reported quarters.",
        "quarters": {
          "Q1": 0,
          "Q2": null,
          "Q3": null,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Aug-Oct 2025 (reported as 2025 Q3): nil",
          "Q2": "Not reported",
          "Q3": "Not reported",
          "Q4": "Apr-May 2026 (reported as 2026 Q2): nil"
        },
        "formula": "count",
        "numLabel": "Hospital-Acquired Pressure Ulcer (HAPU)",
        "unit": "count",
        "formulaText": "value = Hospital-Acquired Pressure Ulcer (HAPU)",
        "numeratorDef": "Hospital-acquired pressure ulcers (stage II+).",
        "reference": "NPUAP/EPUAP staging · NABH patient-safety indicator."
      },
      {
        "id": "ind-l10-phlebitis",
        "name": "Phlebitis",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across both reported quarters.",
        "quarters": {
          "Q1": 0,
          "Q2": null,
          "Q3": null,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Aug-Oct 2025 (reported as 2025 Q3): nil",
          "Q2": "Not reported",
          "Q3": "Not reported",
          "Q4": "Apr-May 2026 (reported as 2026 Q2): nil"
        },
        "formula": "count",
        "numLabel": "Phlebitis",
        "unit": "count",
        "formulaText": "value = Phlebitis",
        "numeratorDef": "Peripheral IV phlebitis events (grade ≥2).",
        "reference": "INS Infusion Therapy Standards — phlebitis scale."
      },
      {
        "id": "ind-l10-clabsi",
        "name": "Central Line-Associated Bloodstream Infection (CLABSI)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across both reported quarters.",
        "quarters": {
          "Q1": 0,
          "Q2": null,
          "Q3": null,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Aug-Oct 2025 (reported as 2025 Q3): nil",
          "Q2": "Not reported",
          "Q3": "Not reported",
          "Q4": "Apr-May 2026 (reported as 2026 Q2): nil"
        },
        "formula": "count",
        "numLabel": "Central Line-Associated Bloodstream Infection (CLABSI)",
        "unit": "count",
        "formulaText": "value = Central Line-Associated Bloodstream Infection (CLABSI)",
        "numeratorDef": "Lab-confirmed central-line associated bloodstream infections.",
        "reference": "CDC NHSN — CLABSI surveillance definition."
      },
      {
        "id": "ind-l10-cauti",
        "name": "Catheter-Associated UTI (CAUTI)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across both reported quarters.",
        "quarters": {
          "Q1": 0,
          "Q2": null,
          "Q3": null,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Aug-Oct 2025 (reported as 2025 Q3): nil",
          "Q2": "Not reported",
          "Q3": "Not reported",
          "Q4": "Apr-May 2026 (reported as 2026 Q2): nil"
        },
        "formula": "count",
        "numLabel": "Catheter-Associated UTI (CAUTI)",
        "unit": "count",
        "formulaText": "value = Catheter-Associated UTI (CAUTI)",
        "numeratorDef": "Lab-confirmed catheter-associated urinary tract infections.",
        "reference": "CDC NHSN — CAUTI surveillance definition."
      },
      {
        "id": "ind-needle-stick-injury",
        "name": "Needle Stick Injury (NSI)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Staff safety indicator - zero across both reported quarters.",
        "quarters": {
          "Q1": 0,
          "Q2": null,
          "Q3": null,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Aug-Oct 2025 (reported as 2025 Q3): nil",
          "Q2": "Not reported",
          "Q3": "Not reported",
          "Q4": "Apr-May 2026 (reported as 2026 Q2): nil"
        },
        "formula": "count",
        "numLabel": "Needle Stick Injury (NSI)",
        "unit": "count",
        "formulaText": "value = Needle Stick Injury (NSI)",
        "numeratorDef": "Needle-stick / sharps injuries to staff.",
        "reference": "CDC sharps-safety · NABH staff-safety indicator."
      },
      {
        "id": "ind-l10-ssi",
        "name": "Surgical Site Infection (SSI)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across both reported quarters.",
        "quarters": {
          "Q1": 0,
          "Q2": null,
          "Q3": null,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Aug-Oct 2025 (reported as 2025 Q3): nil",
          "Q2": "Not reported",
          "Q3": "Not reported",
          "Q4": "Apr-May 2026 (reported as 2026 Q2): nil"
        },
        "formula": "count",
        "numLabel": "Surgical Site Infection (SSI)",
        "unit": "count",
        "formulaText": "value = Surgical Site Infection (SSI)",
        "numeratorDef": "Surgical site infections following an operative procedure.",
        "reference": "CDC NHSN — SSI surveillance definition."
      },
      {
        "id": "ind-l10-patient-fall",
        "name": "Patient Fall",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "2 falls for the year: 1 in 2025 Q3 (Jul-Sep), 1 in 2026 Q2 (Apr-Jun). Trigger for fall-risk RCA.",
        "quarters": {
          "Q1": 1,
          "Q2": null,
          "Q3": null,
          "Q4": 1
        },
        "quarterRemarks": {
          "Q1": "Aug-Oct 2025 (reported as 2025 Q3): 1 fall",
          "Q2": "Not reported",
          "Q3": "Not reported",
          "Q4": "Apr-May 2026 (reported as 2026 Q2): 1 fall"
        },
        "formula": "count",
        "numLabel": "Patient Fall",
        "unit": "count",
        "formulaText": "value = Patient Fall",
        "numeratorDef": "Patient fall events during the in-patient stay.",
        "reference": "NABH / NDNQI — patient fall events."
      }
    ]
  },
  {
    "key": "Level9",
    "name": "Level 9",
    "year": "2025-2026",
    "executive": {
      "keyAchievements": "Zero events across all nine IPD quality indicators (HAPU, Patient Fall, Phlebitis, Medication Administration Error, NSI, CAUTI, CLABSI, SSI, Accidental Catheter Removal) for both reported quarters. Patient volume: 20 (Q3 Jan-Mar 2026), 61 (Q4 Apr-May 2026); total 81 patients.",
      "majorGaps": "Q1 (Aug-Oct 2025) and Q2 (Nov-Dec 2025) data not reported.",
      "overallStatus": "Excellent",
      "recommendations": "Sustain current infection-prevention and patient-safety protocols. Begin reporting Q1 and Q2 data going forward to enable full-year trending."
    },
    "meta": {
      "preparedBy": "",
      "reviewedBy": "",
      "approvedBy": ""
    },
    "indicators": [
      {
        "id": "ind-l9-hapu",
        "name": "Hospital-Acquired Pressure Ulcer (HAPU)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across both reported quarters.",
        "quarters": {
          "Q1": null,
          "Q2": null,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Not reported",
          "Q3": "Jan-Mar 2026 (20 patients): nil",
          "Q4": "Apr-May 2026 (61 patients): nil"
        },
        "formula": "count",
        "numLabel": "Hospital-Acquired Pressure Ulcer (HAPU)",
        "unit": "count",
        "formulaText": "value = Hospital-Acquired Pressure Ulcer (HAPU)",
        "numeratorDef": "Hospital-acquired pressure ulcers (stage II+).",
        "reference": "NPUAP/EPUAP staging · NABH patient-safety indicator."
      },
      {
        "id": "ind-l9-patient-fall",
        "name": "Patient Fall",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across both reported quarters.",
        "quarters": {
          "Q1": null,
          "Q2": null,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Not reported",
          "Q3": "Jan-Mar 2026 (20 patients): nil",
          "Q4": "Apr-May 2026 (61 patients): nil"
        },
        "formula": "count",
        "numLabel": "Patient Fall",
        "unit": "count",
        "formulaText": "value = Patient Fall",
        "numeratorDef": "Patient fall events during the in-patient stay.",
        "reference": "NABH / NDNQI — patient fall events."
      },
      {
        "id": "ind-l9-phlebitis",
        "name": "Phlebitis",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across both reported quarters.",
        "quarters": {
          "Q1": null,
          "Q2": null,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Not reported",
          "Q3": "Jan-Mar 2026 (20 patients): nil",
          "Q4": "Apr-May 2026 (61 patients): nil"
        },
        "formula": "count",
        "numLabel": "Phlebitis",
        "unit": "count",
        "formulaText": "value = Phlebitis",
        "numeratorDef": "Peripheral IV phlebitis events (grade ≥2).",
        "reference": "INS Infusion Therapy Standards — phlebitis scale."
      },
      {
        "id": "ind-l9-medication-error",
        "name": "Medication Administration Error",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across both reported quarters.",
        "quarters": {
          "Q1": null,
          "Q2": null,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Not reported",
          "Q3": "Jan-Mar 2026 (20 patients): nil",
          "Q4": "Apr-May 2026 (61 patients): nil"
        },
        "formula": "count",
        "numLabel": "Medication Administration Error",
        "unit": "count",
        "formulaText": "value = Medication Administration Error",
        "numeratorDef": "Medication errors reported (prescribing/dispensing/administration).",
        "reference": "NABH MOM · NCC-MERP medication-error taxonomy."
      },
      {
        "id": "ind-needle-stick-injury",
        "name": "Needle Stick Injury (NSI)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Staff safety indicator - zero across both reported quarters.",
        "quarters": {
          "Q1": null,
          "Q2": null,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Not reported",
          "Q3": "Jan-Mar 2026: nil",
          "Q4": "Apr-May 2026: nil"
        },
        "formula": "count",
        "numLabel": "Needle Stick Injury (NSI)",
        "unit": "count",
        "formulaText": "value = Needle Stick Injury (NSI)",
        "numeratorDef": "Needle-stick / sharps injuries to staff.",
        "reference": "CDC sharps-safety · NABH staff-safety indicator."
      },
      {
        "id": "ind-l9-cauti",
        "name": "Catheter-Associated UTI (CAUTI)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across both reported quarters.",
        "quarters": {
          "Q1": null,
          "Q2": null,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Not reported",
          "Q3": "Jan-Mar 2026 (20 patients): nil",
          "Q4": "Apr-May 2026 (61 patients): nil"
        },
        "formula": "count",
        "numLabel": "Catheter-Associated UTI (CAUTI)",
        "unit": "count",
        "formulaText": "value = Catheter-Associated UTI (CAUTI)",
        "numeratorDef": "Lab-confirmed catheter-associated urinary tract infections.",
        "reference": "CDC NHSN — CAUTI surveillance definition."
      },
      {
        "id": "ind-l9-clabsi",
        "name": "Central Line-Associated Bloodstream Infection (CLABSI)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across both reported quarters.",
        "quarters": {
          "Q1": null,
          "Q2": null,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Not reported",
          "Q3": "Jan-Mar 2026 (20 patients): nil",
          "Q4": "Apr-May 2026 (61 patients): nil"
        },
        "formula": "count",
        "numLabel": "Central Line-Associated Bloodstream Infection (CLABSI)",
        "unit": "count",
        "formulaText": "value = Central Line-Associated Bloodstream Infection (CLABSI)",
        "numeratorDef": "Lab-confirmed central-line associated bloodstream infections.",
        "reference": "CDC NHSN — CLABSI surveillance definition."
      },
      {
        "id": "ind-l9-ssi",
        "name": "Surgical Site Infection (SSI)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across both reported quarters.",
        "quarters": {
          "Q1": null,
          "Q2": null,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Not reported",
          "Q3": "Jan-Mar 2026 (20 patients): nil",
          "Q4": "Apr-May 2026 (61 patients): nil"
        },
        "formula": "count",
        "numLabel": "Surgical Site Infection (SSI)",
        "unit": "count",
        "formulaText": "value = Surgical Site Infection (SSI)",
        "numeratorDef": "Surgical site infections following an operative procedure.",
        "reference": "CDC NHSN — SSI surveillance definition."
      },
      {
        "id": "ind-l9-accidental-catheter",
        "name": "Accidental Removal of Catheter",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across both reported quarters.",
        "quarters": {
          "Q1": null,
          "Q2": null,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Not reported",
          "Q3": "Jan-Mar 2026 (20 patients): nil",
          "Q4": "Apr-May 2026 (61 patients): nil"
        },
        "formula": "count",
        "numLabel": "Accidental Removal of Catheter",
        "unit": "count",
        "formulaText": "value = Accidental Removal of Catheter",
        "numeratorDef": "Accidental / unplanned catheter or line dislodgements.",
        "reference": "NABH device-management safety indicator."
      }
    ]
  },
  {
    "key": "MICU",
    "name": "MICU",
    "year": "2025-2026",
    "executive": {
      "keyAchievements": "Zero events across all twelve MICU quality indicators (Re-intubation within 48hr, ICU Re-admission within 48hr, HAPU, CAUTI, CLABSI, VAP, SSI, Phlebitis, Patient Fall, Accidental Catheter Dislodgement, Medication Administration Error, Needle Stick Injury) for Q2, Q3, and Q4.",
      "majorGaps": "Q1 (Aug-Oct 2025) data not reported.",
      "overallStatus": "Excellent",
      "recommendations": "Sustain current infection-prevention bundles (VAP, CAUTI, CLABSI), ventilator weaning protocol, pressure-injury prevention, fall-risk assessment, and medication-safety practices. Begin reporting Q1 data going forward for full-year trending."
    },
    "meta": {
      "preparedBy": "",
      "reviewedBy": "",
      "approvedBy": ""
    },
    "indicators": [
      {
        "id": "ind-micu-reintubation-48hr",
        "name": "Re-intubation within 48 hours",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across Q2, Q3, Q4.",
        "quarters": {
          "Q1": null,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Nov-Dec 2025: nil",
          "Q3": "Jan-Mar 2026: nil",
          "Q4": "Apr-May 2026: nil"
        },
        "formula": "count",
        "numLabel": "Re-intubation within 48 hours",
        "unit": "count",
        "formulaText": "value = Re-intubation within 48 hours",
        "numeratorDef": "Re-intubations within 48 hours of planned extubation.",
        "reference": "Critical-care outcome — unplanned re-intubation <48h."
      },
      {
        "id": "ind-micu-readmission-48hr",
        "name": "ICU Re-admission within 48 hours",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across Q2, Q3, Q4.",
        "quarters": {
          "Q1": null,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Nov-Dec 2025: nil",
          "Q3": "Jan-Mar 2026: nil",
          "Q4": "Apr-May 2026: nil"
        },
        "formula": "count",
        "numLabel": "ICU Re-admission within 48 hours",
        "unit": "count",
        "formulaText": "value = ICU Re-admission within 48 hours",
        "numeratorDef": "ICU re-admissions within 48 hours of discharge from the unit.",
        "reference": "Critical-care outcome — ICU re-admission <48h."
      },
      {
        "id": "ind-micu-hapu",
        "name": "Hospital-Acquired Pressure Ulcer (HAPU)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across Q2, Q3, Q4.",
        "quarters": {
          "Q1": null,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Nov-Dec 2025: nil",
          "Q3": "Jan-Mar 2026: nil",
          "Q4": "Apr-May 2026: nil"
        },
        "formula": "count",
        "numLabel": "Hospital-Acquired Pressure Ulcer (HAPU)",
        "unit": "count",
        "formulaText": "value = Hospital-Acquired Pressure Ulcer (HAPU)",
        "numeratorDef": "Hospital-acquired pressure ulcers (stage II+).",
        "reference": "NPUAP/EPUAP staging · NABH patient-safety indicator."
      },
      {
        "id": "ind-micu-cauti",
        "name": "Catheter-Associated UTI (CAUTI)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across Q2, Q3, Q4.",
        "quarters": {
          "Q1": null,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Nov-Dec 2025: nil",
          "Q3": "Jan-Mar 2026: nil",
          "Q4": "Apr-May 2026: nil"
        },
        "formula": "count",
        "numLabel": "Catheter-Associated UTI (CAUTI)",
        "unit": "count",
        "formulaText": "value = Catheter-Associated UTI (CAUTI)",
        "numeratorDef": "Lab-confirmed catheter-associated urinary tract infections.",
        "reference": "CDC NHSN — CAUTI surveillance definition."
      },
      {
        "id": "ind-micu-clabsi",
        "name": "Central Line-Associated Bloodstream Infection (CLABSI)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across Q2, Q3, Q4.",
        "quarters": {
          "Q1": null,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Nov-Dec 2025: nil",
          "Q3": "Jan-Mar 2026: nil",
          "Q4": "Apr-May 2026: nil"
        },
        "formula": "count",
        "numLabel": "Central Line-Associated Bloodstream Infection (CLABSI)",
        "unit": "count",
        "formulaText": "value = Central Line-Associated Bloodstream Infection (CLABSI)",
        "numeratorDef": "Lab-confirmed central-line associated bloodstream infections.",
        "reference": "CDC NHSN — CLABSI surveillance definition."
      },
      {
        "id": "ind-micu-vap",
        "name": "Ventilator-Associated Pneumonia (VAP)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across Q2, Q3, Q4.",
        "quarters": {
          "Q1": null,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Nov-Dec 2025: nil",
          "Q3": "Jan-Mar 2026: nil",
          "Q4": "Apr-May 2026: nil"
        },
        "formula": "count",
        "numLabel": "Ventilator-Associated Pneumonia (VAP)",
        "unit": "count",
        "formulaText": "value = Ventilator-Associated Pneumonia (VAP)",
        "numeratorDef": "Ventilator-associated pneumonia / events.",
        "reference": "CDC NHSN — VAP / VAE surveillance definition."
      },
      {
        "id": "ind-micu-ssi",
        "name": "Surgical Site Infection (SSI)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across Q2, Q3, Q4.",
        "quarters": {
          "Q1": null,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Nov-Dec 2025: nil",
          "Q3": "Jan-Mar 2026: nil",
          "Q4": "Apr-May 2026: nil"
        },
        "formula": "count",
        "numLabel": "Surgical Site Infection (SSI)",
        "unit": "count",
        "formulaText": "value = Surgical Site Infection (SSI)",
        "numeratorDef": "Surgical site infections following an operative procedure.",
        "reference": "CDC NHSN — SSI surveillance definition."
      },
      {
        "id": "ind-micu-phlebitis",
        "name": "Phlebitis",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across Q2, Q3, Q4.",
        "quarters": {
          "Q1": null,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Nov-Dec 2025: nil",
          "Q3": "Jan-Mar 2026: nil",
          "Q4": "Apr-May 2026: nil"
        },
        "formula": "count",
        "numLabel": "Phlebitis",
        "unit": "count",
        "formulaText": "value = Phlebitis",
        "numeratorDef": "Peripheral IV phlebitis events (grade ≥2).",
        "reference": "INS Infusion Therapy Standards — phlebitis scale."
      },
      {
        "id": "ind-micu-patient-fall",
        "name": "Patient Fall",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across Q2, Q3, Q4.",
        "quarters": {
          "Q1": null,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Nov-Dec 2025: nil",
          "Q3": "Jan-Mar 2026: nil",
          "Q4": "Apr-May 2026: nil"
        },
        "formula": "count",
        "numLabel": "Patient Fall",
        "unit": "count",
        "formulaText": "value = Patient Fall",
        "numeratorDef": "Patient fall events during the in-patient stay.",
        "reference": "NABH / NDNQI — patient fall events."
      },
      {
        "id": "ind-micu-accidental-catheter",
        "name": "Accidental Catheter Dislodgement",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across Q2, Q3, Q4.",
        "quarters": {
          "Q1": null,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Nov-Dec 2025: nil",
          "Q3": "Jan-Mar 2026: nil",
          "Q4": "Apr-May 2026: nil"
        },
        "formula": "count",
        "numLabel": "Accidental Catheter Dislodgement",
        "unit": "count",
        "formulaText": "value = Accidental Catheter Dislodgement",
        "numeratorDef": "Accidental / unplanned catheter or line dislodgements.",
        "reference": "NABH device-management safety indicator."
      },
      {
        "id": "ind-micu-medication-error",
        "name": "Medication Administration Error",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across Q2, Q3, Q4.",
        "quarters": {
          "Q1": null,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Nov-Dec 2025: nil",
          "Q3": "Jan-Mar 2026: nil",
          "Q4": "Apr-May 2026: nil"
        },
        "formula": "count",
        "numLabel": "Medication Administration Error",
        "unit": "count",
        "formulaText": "value = Medication Administration Error",
        "numeratorDef": "Medication errors reported (prescribing/dispensing/administration).",
        "reference": "NABH MOM · NCC-MERP medication-error taxonomy."
      },
      {
        "id": "ind-needle-stick-injury",
        "name": "Needle Stick Injury (NSI)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Staff safety indicator - zero across Q2, Q3, Q4.",
        "quarters": {
          "Q1": null,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Nov-Dec 2025: nil",
          "Q3": "Jan-Mar 2026: nil",
          "Q4": "Apr-May 2026: nil"
        },
        "formula": "count",
        "numLabel": "Needle Stick Injury (NSI)",
        "unit": "count",
        "formulaText": "value = Needle Stick Injury (NSI)",
        "numeratorDef": "Needle-stick / sharps injuries to staff.",
        "reference": "CDC sharps-safety · NABH staff-safety indicator."
      }
    ]
  },
  {
    "key": "NICU",
    "name": "NICU",
    "year": "2025-2026",
    "executive": {
      "keyAchievements": "",
      "majorGaps": "1 accidental ETT removal in December 2025 — rate 8.3 per 100 ventilator days, well above the <1.0 benchmark. Triggers safety review.",
      "overallStatus": "Needs Improvement",
      "recommendations": "Conduct root cause analysis on the December 2025 ETT removal. Reinforce ETT securement protocol (tape technique, tube position checks each shift), agitation/sedation review, and bedside monitoring for high-risk neonates. Audit ventilator-day denominator tracking."
    },
    "meta": {
      "preparedBy": "",
      "reviewedBy": "",
      "approvedBy": ""
    },
    "indicators": [
      {
        "id": "ind-nicu-ett-removal",
        "name": "Accidental Removal of ETT Tube",
        "valueType": "%",
        "benchmark": "<1.0 per 100 ventilator days",
        "benchmarkValue": 1,
        "goalDirection": "lower_is_better",
        "remarks": "1 event in December 2025; rate = 8.3 per 100 ventilator days (implies ~12 ventilator days in the period).",
        "quarters": {
          "Q1": null,
          "Q2": 8.3,
          "Q3": null,
          "Q4": null
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Nov-Dec 2025: 1 accidental removal, rate 8.3 per 100 ventilator days",
          "Q3": "Not reported",
          "Q4": "Not reported"
        },
        "formula": "pct",
        "numLabel": "Accidental / unplanned ETT removals",
        "denLabel": "Ventilator days",
        "unit": "%",
        "formulaText": "(Accidental / unplanned ETT removals ÷ Ventilator days) × 100",
        "numeratorDef": "Unplanned (accidental or self-) extubation events in ventilated neonates.",
        "denominatorDef": "Total ventilator days in the period (value is expressed per 100 ventilator-days).",
        "reference": "Neonatal ventilation safety — unplanned extubation rate per 100 ventilator-days."
      }
    ]
  },
  {
    "key": "NursingTraining",
    "name": "Nursing Training",
    "year": "2025-2026",
    "executive": {
      "keyAchievements": "Progressive improvement in mandatory training compliance through reminder systems and collaborative roster management with nurse managers and charge nurses. BLS certification activities ongoing to strengthen emergency response competency (20 nurses certified in the reporting period). Induction program reached 94% completion (114 of 122 nurses).",
      "majorGaps": "Mandatory training compliance at 80%, still below the >=90% benchmark. 8 nurses pending induction completion at end of reporting period (Jan-May 2026).",
      "overallStatus": "Good",
      "recommendations": "Continue advance scheduling and reminder systems for mandatory training. Arrange regular BLS certification and renewal sessions. Maintain close monitoring of ongoing induction completion. Strengthen coordination with nurse managers for staff participation in training activities."
    },
    "meta": {
      "preparedBy": "Chelcia Bani Baroi (Instructor, Quality & Training)",
      "reviewedBy": "Mohd. Balayet Hossen (Senior Nurse Manager, Quality & Training)",
      "approvedBy": "Elizabeth Jothi (Chief of Nursing, Unico Hospitals)"
    },
    "indicators": [
      {
        "id": "ind-mandatory-training",
        "name": "Mandatory Training Compliance",
        "valueType": "%",
        "benchmark": ">=90%",
        "benchmarkValue": 90,
        "goalDirection": "higher_is_better",
        "remarks": "Improving trend after reminder system and roster adjustment with nurse managers / charge nurses.",
        "quarters": {
          "Q1": null,
          "Q2": null,
          "Q3": null,
          "Q4": 80
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Not reported",
          "Q3": "Not reported",
          "Q4": "Jan-May 2026 aggregate: 80%. Improving trend after reminder system and roster adjustment."
        },
        "formula": "pct",
        "numLabel": "Staff who completed mandatory training",
        "denLabel": "Staff due for mandatory training",
        "unit": "%",
        "formulaText": "(Staff who completed mandatory training ÷ Staff due for mandatory training) × 100",
        "numeratorDef": "Staff who completed their mandatory training within the cycle.",
        "denominatorDef": "Staff scheduled/due for mandatory training in the period.",
        "reference": "NABH HRM — mandatory staff training & education compliance."
      },
      {
        "id": "ind-bls-certification",
        "name": "BLS Certification Rate",
        "valueType": "Count",
        "benchmark": "Ongoing",
        "benchmarkValue": "",
        "goalDirection": "higher_is_better",
        "remarks": "Regular certification sessions continuing.",
        "quarters": {
          "Q1": null,
          "Q2": null,
          "Q3": null,
          "Q4": 20
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Not reported",
          "Q3": "Not reported",
          "Q4": "Jan-May 2026: 20 nurses certified. Regular sessions continuing."
        },
        "formula": "pct",
        "numLabel": "Clinical staff with valid BLS certification",
        "denLabel": "Clinical staff requiring BLS",
        "unit": "%",
        "formulaText": "(Clinical staff with valid BLS certification ÷ Clinical staff requiring BLS) × 100",
        "numeratorDef": "Clinical staff holding a current/valid Basic Life Support certification.",
        "denominatorDef": "Clinical staff required to hold BLS certification.",
        "reference": "AHA BLS — proportion of clinical staff with current certification."
      },
      {
        "id": "ind-induction-completion",
        "name": "Induction Completion within 30 Days",
        "valueType": "%",
        "benchmark": "100%",
        "benchmarkValue": 100,
        "goalDirection": "higher_is_better",
        "remarks": "114 completed, 8 ongoing (Jan-May 2026).",
        "quarters": {
          "Q1": null,
          "Q2": null,
          "Q3": null,
          "Q4": 94
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Not reported",
          "Q3": "Not reported",
          "Q4": "Jan-May 2026 aggregate: 94% (114 completed, 8 ongoing). Partially achieved."
        },
        "formula": "pct",
        "numLabel": "New staff completing induction within 30 days",
        "denLabel": "New staff who joined",
        "unit": "%",
        "formulaText": "(New staff completing induction within 30 days ÷ New staff who joined) × 100",
        "numeratorDef": "New joiners who completed induction/orientation within 30 days of joining.",
        "denominatorDef": "Total new staff who joined in the period.",
        "reference": "NABH HRM — induction/orientation of new staff."
      }
    ]
  },
  {
    "key": "OPD",
    "name": "OPD",
    "year": "2025-2026",
    "executive": {
      "keyAchievements": "",
      "majorGaps": "",
      "overallStatus": "Good",
      "recommendations": ""
    },
    "meta": {
      "preparedBy": "",
      "reviewedBy": "",
      "approvedBy": ""
    },
    "indicators": []
  },
  {
    "key": "SurgicalICU",
    "name": "Surgical ICU",
    "year": "2025-2026",
    "executive": {
      "keyAchievements": "Zero events across all nine quality indicators (CAUTI, CLABSI, VAP, SSI, NSI, HAPU, DVT, Patient Fall, Return to ICU) for every reported quarter of the year. Full-year reporting completed (Q1-Q4). Patient volume: 14 (Q1 Aug-Oct 2025), 5 (Q2 Nov-Dec 2025), 4 (Q3 Jan-Mar 2026), 1 (Q4 Apr-May 2026); total 24 patients.",
      "majorGaps": "None identified - zero defect maintained across all indicators.",
      "overallStatus": "Excellent",
      "recommendations": "Sustain current infection-prevention bundles (VAP, CAUTI, CLABSI), DVT prophylaxis protocol, pressure-injury prevention, and fall-risk assessment. Continue post-discharge tracking to maintain zero Return-to-ICU rate."
    },
    "meta": {
      "preparedBy": "",
      "reviewedBy": "",
      "approvedBy": ""
    },
    "indicators": [
      {
        "id": "ind-sicu-cauti",
        "name": "Catheter-Associated UTI (CAUTI)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across all four reported quarters.",
        "quarters": {
          "Q1": 0,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Aug-Oct 2025 (14 patients): nil",
          "Q2": "Nov-Dec 2025 (5 patients): nil",
          "Q3": "Jan-Mar 2026 (4 patients): nil",
          "Q4": "Apr-May 2026 (1 patient): nil"
        },
        "formula": "count",
        "numLabel": "Catheter-Associated UTI (CAUTI)",
        "unit": "count",
        "formulaText": "value = Catheter-Associated UTI (CAUTI)",
        "numeratorDef": "Lab-confirmed catheter-associated urinary tract infections.",
        "reference": "CDC NHSN — CAUTI surveillance definition."
      },
      {
        "id": "ind-sicu-clabsi",
        "name": "Central Line-Associated Bloodstream Infection (CLABSI)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across all four reported quarters.",
        "quarters": {
          "Q1": 0,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Aug-Oct 2025 (14 patients): nil",
          "Q2": "Nov-Dec 2025 (5 patients): nil",
          "Q3": "Jan-Mar 2026 (4 patients): nil",
          "Q4": "Apr-May 2026 (1 patient): nil"
        },
        "formula": "count",
        "numLabel": "Central Line-Associated Bloodstream Infection (CLABSI)",
        "unit": "count",
        "formulaText": "value = Central Line-Associated Bloodstream Infection (CLABSI)",
        "numeratorDef": "Lab-confirmed central-line associated bloodstream infections.",
        "reference": "CDC NHSN — CLABSI surveillance definition."
      },
      {
        "id": "ind-sicu-vap",
        "name": "Ventilator-Associated Pneumonia (VAP)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across all four reported quarters.",
        "quarters": {
          "Q1": 0,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Aug-Oct 2025 (14 patients): nil",
          "Q2": "Nov-Dec 2025 (5 patients): nil",
          "Q3": "Jan-Mar 2026 (4 patients): nil",
          "Q4": "Apr-May 2026 (1 patient): nil"
        },
        "formula": "count",
        "numLabel": "Ventilator-Associated Pneumonia (VAP)",
        "unit": "count",
        "formulaText": "value = Ventilator-Associated Pneumonia (VAP)",
        "numeratorDef": "Ventilator-associated pneumonia / events.",
        "reference": "CDC NHSN — VAP / VAE surveillance definition."
      },
      {
        "id": "ind-sicu-ssi",
        "name": "Surgical Site Infection (SSI)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across all four reported quarters.",
        "quarters": {
          "Q1": 0,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Aug-Oct 2025 (14 patients): nil",
          "Q2": "Nov-Dec 2025 (5 patients): nil",
          "Q3": "Jan-Mar 2026 (4 patients): nil",
          "Q4": "Apr-May 2026 (1 patient): nil"
        },
        "formula": "count",
        "numLabel": "Surgical Site Infection (SSI)",
        "unit": "count",
        "formulaText": "value = Surgical Site Infection (SSI)",
        "numeratorDef": "Surgical site infections following an operative procedure.",
        "reference": "CDC NHSN — SSI surveillance definition."
      },
      {
        "id": "ind-needle-stick-injury",
        "name": "Needle Stick Injury (NSI)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Staff safety indicator - zero across all four reported quarters.",
        "quarters": {
          "Q1": 0,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Aug-Oct 2025: nil",
          "Q2": "Nov-Dec 2025: nil",
          "Q3": "Jan-Mar 2026: nil",
          "Q4": "Apr-May 2026: nil"
        },
        "formula": "count",
        "numLabel": "Needle Stick Injury (NSI)",
        "unit": "count",
        "formulaText": "value = Needle Stick Injury (NSI)",
        "numeratorDef": "Needle-stick / sharps injuries to staff.",
        "reference": "CDC sharps-safety · NABH staff-safety indicator."
      },
      {
        "id": "ind-sicu-hapu",
        "name": "Hospital-Acquired Pressure Ulcer (HAPU)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across all four reported quarters.",
        "quarters": {
          "Q1": 0,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Aug-Oct 2025 (14 patients): nil",
          "Q2": "Nov-Dec 2025 (5 patients): nil",
          "Q3": "Jan-Mar 2026 (4 patients): nil",
          "Q4": "Apr-May 2026 (1 patient): nil"
        },
        "formula": "count",
        "numLabel": "Hospital-Acquired Pressure Ulcer (HAPU)",
        "unit": "count",
        "formulaText": "value = Hospital-Acquired Pressure Ulcer (HAPU)",
        "numeratorDef": "Hospital-acquired pressure ulcers (stage II+).",
        "reference": "NPUAP/EPUAP staging · NABH patient-safety indicator."
      },
      {
        "id": "ind-sicu-dvt",
        "name": "Deep Vein Thrombosis (DVT)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across all four reported quarters.",
        "quarters": {
          "Q1": 0,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Aug-Oct 2025 (14 patients): nil",
          "Q2": "Nov-Dec 2025 (5 patients): nil",
          "Q3": "Jan-Mar 2026 (4 patients): nil",
          "Q4": "Apr-May 2026 (1 patient): nil"
        },
        "formula": "count",
        "numLabel": "Deep Vein Thrombosis (DVT)",
        "unit": "count",
        "formulaText": "value = Deep Vein Thrombosis (DVT)",
        "numeratorDef": "Hospital-acquired deep-vein thrombosis events.",
        "reference": "NABH VTE prophylaxis & surveillance."
      },
      {
        "id": "ind-sicu-patient-fall",
        "name": "Patient Fall",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across all four reported quarters.",
        "quarters": {
          "Q1": 0,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Aug-Oct 2025 (14 patients): nil",
          "Q2": "Nov-Dec 2025 (5 patients): nil",
          "Q3": "Jan-Mar 2026 (4 patients): nil",
          "Q4": "Apr-May 2026 (1 patient): nil"
        },
        "formula": "count",
        "numLabel": "Patient Fall",
        "unit": "count",
        "formulaText": "value = Patient Fall",
        "numeratorDef": "Patient fall events during the in-patient stay.",
        "reference": "NABH / NDNQI — patient fall events."
      },
      {
        "id": "ind-sicu-return-to-icu",
        "name": "Return to ICU",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across all four reported quarters.",
        "quarters": {
          "Q1": 0,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Aug-Oct 2025 (14 patients): nil",
          "Q2": "Nov-Dec 2025 (5 patients): nil",
          "Q3": "Jan-Mar 2026 (4 patients): nil",
          "Q4": "Apr-May 2026 (1 patient): nil"
        },
        "formula": "count",
        "numLabel": "Return to ICU",
        "unit": "count",
        "formulaText": "value = Return to ICU",
        "numeratorDef": "Patients returning to ICU during the same admission.",
        "reference": "Critical-care outcome — return to ICU."
      }
    ]
  }
];

;
/* ===== quality-data.js ===== */
/* UNICO — Quality Indicators.
   The reports now live in MongoDB (the `quality` collection) and are injected by the
   Express web server as window.__UNICO_QUALITY__ before this script runs. No hardcoded
   quality data remains here. To edit the seed: server/seed/quality.json then
   npm --prefix server run seed-data -- quality --force */
// An INJECTED array wins even when it is EMPTY. The `.length` test that used to be
// here treated "the server scoped you to nothing" the same as "the server injected
// nothing", so an account whose quality areas matched none of the real keys fell
// through to the unscoped bundled seed and was shown the whole hospital. Empty is an
// answer; only a MISSING inject is a reason to fall back.
window.QUALITY_SEED = (typeof window !== 'undefined' && Array.isArray(window.__UNICO_QUALITY__))
  ? window.__UNICO_QUALITY__
  : ((typeof window !== 'undefined' && Array.isArray(window.__UNICO_QUALITY_FALLBACK__)) ? window.__UNICO_QUALITY_FALLBACK__ : []);

// Live refetch (same contract as window.UNICO.refreshDepartments): after an approved
// quality submission is applied server-side, replace the stale page-load snapshot so
// the Quality console shows the new reading when its view (re)mounts.
var _qualitySig = null;
window.refreshQualitySeed = function () {
  return fetch('/api/quality', { credentials: 'same-origin', cache: 'no-store' })
    .then(function (r) { return r.json(); })
    .then(function (j) {
      if (!j || !j.ok || !Array.isArray(j.quality)) return false;
      // Collector sessions also receive their re-scoped definition overlay (indicator
      // assign/unassign etc.) — keep the local copy current so admin edits apply live.
      // Through the bridge + announced, so mounted quality stores reload instead of writing
      // their old overlay back (see refreshDepartments).
      try {
        var ov = j.overlay && j.overlay['unico_quality_v2'];
        if (typeof ov === 'string') {
          if (typeof window.unicoApplyRemoteOverlay === 'function') window.unicoApplyRemoteOverlay({ unico_quality_v2: ov }, { source: 'quality' });
          else if (localStorage.getItem('unico_quality_v2') !== ov) { localStorage.setItem('unico_quality_v2', ov); window.dispatchEvent(new CustomEvent('unico:overlay-merged', { detail: { keys: ['unico_quality_v2'], source: 'quality' } })); }
        }
      } catch (e) { }
      // Unchanged since the last refresh (the app polls every 60 s): no swap, no rebuild event.
      var sig = JSON.stringify(j.quality);
      if (sig === _qualitySig) return true;
      _qualitySig = sig;
      window.QUALITY_SEED = j.quality;
      // Same contract as refreshDepartments: notify mounted stores so open quality
      // views rebuild from the fresh seed without needing a remount/reload.
      try { window.dispatchEvent(new CustomEvent('unico:data-refreshed', { detail: { source: 'quality' } })); } catch (e) { }
      return true;
    }).catch(function () { return false; });
};

// Formula Library edits used to reach only the tab that saved them (the master is injected
// once at page load). Re-read the catalogue and rebuild window.QI_CORRECTIONS exactly like the
// server inject (server/quality-formulas.js buildByNameMap: same DEF_FIELDS, same norm — the one
// quality-store.js correctedBase() looks names up with). An empty catalogue (dev / no DB) keeps
// the bundled static corrections, as at load.
window.refreshQualityFormulas = function () {
  return fetch('/api/quality-formulas', { credentials: 'same-origin', cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) {
      if (!j || !j.ok || !Array.isArray(j.formulas) || !j.formulas.length) return false;
      if (JSON.stringify(j.formulas) === JSON.stringify(window.__UNICO_QI_FORMULAS__ || null)) return false;
      var DEF_FIELDS = ['formula', 'unit', 'numLabel', 'denLabel', 'numeratorDef', 'denominatorDef', 'benchmark', 'benchmarkValue', 'benchmarkNote', 'goalDirection', 'reference', 'referenceUrl', 'denAdminOnly', 'victimField'];
      var norm = function (s) { return String(s || '').trim().toLowerCase().replace(/\s+/g, ' '); };
      var empty = function (v) { return v === undefined || v === null || v === ''; };
      var map = {};
      j.formulas.forEach(function (f) {
        var def = { canonicalName: f.canonicalName };
        DEF_FIELDS.forEach(function (k) { if (!empty(f[k])) def[k] = f[k]; });
        (f.aliases || []).map(norm).concat([norm(f.canonicalName)]).forEach(function (k) { if (k) map[k] = def; });
      });
      window.QI_CORRECTIONS = map; window.__UNICO_QI_CORRECTIONS__ = map; window.__UNICO_QI_FORMULAS__ = j.formulas;
      try { window.dispatchEvent(new CustomEvent('unico:data-refreshed', { detail: { source: 'formulas' } })); } catch (e) { }
      return true;
    }).catch(function () { return false; });
};

;
/* ===== quality-corrections.js ===== */
/* UNICO — authoritative quality-indicator corrections (AUTO-GENERATED, web-verified).
   QI_CORRECTIONS: by indicator name (applied in quality-store.js by name).
   QI_CORRECTIONS_BY_DEFID: by QI_DEFS id (applied in the Catalog/library). */
window.QI_CORRECTIONS = {
  "catheter-associated uti (cauti)": {
    "canonicalName": "Catheter-Associated Urinary Tract Infection (CAUTI) Rate",
    "formula": "rate1000",
    "numLabel": "CAUTIs",
    "denLabel": "Urinary catheter-days",
    "numeratorDef": "Number of CAUTI events meeting the NHSN UTI surveillance definition (symptomatic UTI/SUTI) in patients who had an indwelling urinary catheter in place for >2 consecutive days (day of catheter placement = Day 1) in an inpatient location on the date of event, with the catheter in place on that date or removed the day before. Count each qualifying event once.",
    "denominatorDef": "Total number of indwelling urinary catheter-days, obtained by counting, once each day at the same time each day during the surveillance month, the number of patients in the location with one or more indwelling urinary catheters, and summing these daily counts over the month (electronic counts allowed if validated to within 5% of manual counts).",
    "unit": "per 1000 catheter-days",
    "benchmarkValue": 1,
    "benchmark": "≤ 1 per 1000 catheter-days",
    "benchmarkNote": "NHSN primary benchmark is the SIR < 1.0 vs the NHSN baseline (fewer infections observed than predicted); pooled-mean CAUTI rate is roughly 1.0 per 1000 catheter-days but varies widely by unit type and is not an official fixed threshold",
    "goalDirection": "lower_is_better",
    "reference": "CDC NHSN Patient Safety Component Manual, Chapter 7: Urinary Tract Infection (CAUTI) Events; CDC NHSN SIR Guide (A Guide to the SIR)",
    "referenceUrl": "https://www.cdc.gov/nhsn/pdfs/pscmanual/7psccauticurrent.pdf"
  },
  "cauti rate (per 1000 cath-days)": {
    "canonicalName": "Catheter-Associated Urinary Tract Infection (CAUTI) Rate",
    "formula": "rate1000",
    "numLabel": "CAUTIs",
    "denLabel": "Urinary catheter-days",
    "numeratorDef": "Number of CAUTI events meeting the NHSN UTI surveillance definition (symptomatic UTI/SUTI) in patients who had an indwelling urinary catheter in place for >2 consecutive days (day of catheter placement = Day 1) in an inpatient location on the date of event, with the catheter in place on that date or removed the day before. Count each qualifying event once.",
    "denominatorDef": "Total number of indwelling urinary catheter-days, obtained by counting, once each day at the same time each day during the surveillance month, the number of patients in the location with one or more indwelling urinary catheters, and summing these daily counts over the month (electronic counts allowed if validated to within 5% of manual counts).",
    "unit": "per 1000 catheter-days",
    "benchmarkValue": 1,
    "benchmark": "≤ 1 per 1000 catheter-days",
    "benchmarkNote": "NHSN primary benchmark is the SIR < 1.0 vs the NHSN baseline (fewer infections observed than predicted); pooled-mean CAUTI rate is roughly 1.0 per 1000 catheter-days but varies widely by unit type and is not an official fixed threshold",
    "goalDirection": "lower_is_better",
    "reference": "CDC NHSN Patient Safety Component Manual, Chapter 7: Urinary Tract Infection (CAUTI) Events; CDC NHSN SIR Guide (A Guide to the SIR)",
    "referenceUrl": "https://www.cdc.gov/nhsn/pdfs/pscmanual/7psccauticurrent.pdf"
  },
  "central line-associated bloodstream infection (clabsi)": {
    "canonicalName": "Central Line-Associated Bloodstream Infection (CLABSI) Rate",
    "formula": "rate1000",
    "numLabel": "CLABSIs",
    "denLabel": "Central line-days",
    "numeratorDef": "Number of laboratory-confirmed bloodstream infections (LCBI) meeting the NHSN CLABSI definition: a primary LCBI not secondary to an infection at another site, in a patient with an eligible central line in place for >2 consecutive calendar days (following first access in an inpatient location) on the date of event, with the line present on that date or removed the day before.",
    "denominatorDef": "Total number of central line-days, summed by counting the number of patients with one or more central lines in the location once each day at the same time each day during the surveillance month.",
    "unit": "per 1000 central line-days",
    "benchmarkValue": 1,
    "benchmark": "≤ 1 per 1000 central line-days",
    "benchmarkNote": "SIR < 1.0 vs NHSN baseline; pooled-mean CLABSI rate ~1.0 per 1000 central line-days (varies by unit type)",
    "goalDirection": "lower_is_better",
    "reference": "CDC NHSN Patient Safety Component Manual, Chapter 4: Bloodstream Infection Event (CLABSI); CDC NHSN SIR Guide",
    "referenceUrl": "https://www.cdc.gov/nhsn/pdfs/pscmanual/4psc_clabscurrent.pdf"
  },
  "ventilator-associated pneumonia (vap)": {
    "canonicalName": "Ventilator-Associated Pneumonia (VAP) Rate",
    "formula": "rate1000",
    "numLabel": "VAP events",
    "denLabel": "Ventilator-days",
    "numeratorDef": "Number of pneumonia events meeting the NHSN PNEU/VAP surveillance criteria in a patient who was on mechanical ventilation with the ventilator in place on the date of event or the day before. (Note: the NHSN PNEU/VAP definition has NO minimum ventilation-duration requirement; the '>2 consecutive ventilator-days' rule belongs to the separate VAE algorithm, not to VAP/PNEU. For adult and pediatric inpatient locations NHSN replaced in-plan VAP surveillance with the VAE algorithm in January 2013 [PedVAE for pediatric locations]; the PNEU/VAP protocol remains available for in-plan PedVAP surveillance in pediatric locations and off-plan PNEU surveillance in any inpatient location, including neonatal.)",
    "denominatorDef": "Total number of ventilator-days, summed by counting the number of patients on mechanical ventilation in the location once each day at the same time each day during the surveillance month.",
    "unit": "per 1000 ventilator-days",
    "benchmarkValue": 1,
    "benchmark": "≤ 1 per 1000 ventilator-days",
    "benchmarkNote": "No single fixed target; aim toward 0. Historical NHSN pooled-mean VAP rates ~1-2 per 1000 ventilator-days depending on unit type",
    "goalDirection": "lower_is_better",
    "reference": "CDC NHSN Patient Safety Component Manual, Chapter 6: Pneumonia (Ventilator-associated [VAP] and non-ventilator-associated [PNEU]) Event",
    "referenceUrl": "https://www.cdc.gov/nhsn/pdfs/pscmanual/6pscvapcurrent.pdf"
  },
  "ventilator-associated event (vae)": {
    "canonicalName": "Ventilator-Associated Event (VAE) Rate",
    "formula": "rate1000",
    "numLabel": "VAE events (VAC/IVAC/PVAP)",
    "denLabel": "Ventilator-days",
    "numeratorDef": "Number of Ventilator-Associated Events meeting the NHSN VAE algorithm tiers — Ventilator-Associated Condition (VAC), Infection-related Ventilator-Associated Complication (IVAC), and Possible VAP (PVAP) — identified in adult patients (>=18 years) mechanically ventilated for >2 calendar days, triggered by a sustained increase (>=2 calendar days) in daily minimum FiO2 (increase >=0.20) or PEEP (increase >=3 cmH2O) after a baseline period of >=2 days of stability or improvement. Each event counted once; rates may be reported by tier.",
    "denominatorDef": "Total number of ventilator-days, summed by counting the number of patients on mechanical ventilation in the location once each day at the same time each day during the surveillance month (eligible adult inpatient locations); only the monthly total is entered into NHSN.",
    "unit": "per 1000 ventilator-days",
    "benchmarkValue": 1,
    "benchmark": "≤ 1 per 1000 ventilator-days",
    "benchmarkNote": "SIR < 1.0 vs NHSN baseline (observed/predicted; SIR not computed when predicted <1.0); aim toward 0. Pooled VAC/IVAC raw rates vary widely (~3-17 per 1000 ventilator-days) by setting.",
    "goalDirection": "lower_is_better",
    "reference": "CDC NHSN Patient Safety Component Manual, Chapter 10: Ventilator-Associated Event (VAE) Protocol",
    "referenceUrl": "https://www.cdc.gov/nhsn/pdfs/pscmanual/10-vae_final.pdf"
  },
  "infection rate": {
    "canonicalName": "Healthcare-Associated Infection (HAI) Rate",
    "formula": "rate1000",
    "numLabel": "HAI events",
    "denLabel": "Patient-days (or device-days)",
    "numeratorDef": "Number of healthcare-associated infections meeting the applicable NHSN site-specific surveillance definition during the surveillance period, where the date of event occurs on or after the 3rd calendar day of admission to an inpatient location (day of admission = calendar day 1), i.e., not present or incubating on admission. For device-associated infections use the corresponding device-day denominator; for overall HAI surveillance use patient-days.",
    "denominatorDef": "Total patient-days for overall HAI rates (sum of the daily census over the surveillance month), or the relevant device-days for device-associated infection rates, counted once per patient per day at a consistent time each day.",
    "unit": "per 1000 patient-days",
    "benchmarkValue": 5,
    "benchmark": "≤ 5 per 1000 patient-days",
    "benchmarkNote": "Lower is better; no universal fixed target. NHSN's authoritative benchmark is the Standardized Infection Ratio (SIR = observed/expected vs. risk-adjusted national baseline, target < 1.0), not a fixed rate. Overall HAI incidence is indicatively ~2-5 per 1000 patient-days and should trend downward facility-wide.",
    "goalDirection": "lower_is_better",
    "reference": "CDC NHSN Patient Safety Component Manual, Chapter 2 (Identifying HAIs in NHSN / Present on Admission vs HAI); WHO Guidelines on Core Components of IPC Programmes",
    "referenceUrl": "https://www.cdc.gov/nhsn/pdfs/pscmanual/2psc_identifyinghais_nhsncurrent.pdf"
  },
  "patient fall": {
    "canonicalName": "Patient Falls (Total Fall Rate)",
    "formula": "rate1000",
    "numLabel": "Number of patient falls",
    "denLabel": "Patient-days",
    "numeratorDef": "Total number of patient falls (with or without injury, whether or not assisted by a staff member) occurring on the eligible reporting unit during the calendar month. A fall = an unplanned descent to the floor (or extension of the floor, e.g., trash can or other equipment) with or without injury. Includes assisted falls and falls in which the patient was found on the floor. Count each fall event; a patient who falls more than once is counted each time.",
    "denominatorDef": "Total patient-days for the eligible reporting unit during the same calendar month. Patient-days = sum of the daily inpatient census (typically counted at a consistent time each day, e.g., midnight) over the reporting period. Multiply the falls/patient-day ratio by 1000.",
    "unit": "per 1000 patient-days",
    "benchmarkValue": 3.3,
    "benchmark": "≤ 3.3 per 1000 patient-days",
    "benchmarkNote": "<= 3.3 falls per 1000 patient-days (NDNQI national median; lower is better)",
    "goalDirection": "lower_is_better",
    "reference": "National Database of Nursing Quality Indicators (NDNQI), a Press Ganey solution (measure copyrighted by the American Nurses Association); NQF/CBE #0141 Patient Fall Rate, a nursing-sensitive indicator (now maintained under the Partnership for Quality Measurement / Battelle CBE framework)",
    "referenceUrl": "https://p4qm.org/measures/0141"
  },
  "hospital-acquired pressure ulcer (hapu)": {
    "canonicalName": "Hospital-Acquired Pressure Ulcer (HAPU) Incidence Rate",
    "formula": "rate1000",
    "numLabel": "Patients who developed ≥ 1 HAPU (Stage 2+)",
    "denLabel": "Patient-days",
    "numeratorDef": "Number of patients who developed one or more NEW hospital-acquired (nosocomial) pressure ulcers of Stage 2 or greater (including Stage 2, Stage 3, Stage 4, unstageable, and deep tissue injury) per NPIAP staging during the reporting period. Hospital-acquired = not present on admission; identified on/after the assessment that follows admission. A patient is counted once regardless of the number of ulcers.",
    "denominatorDef": "Total number of patient-days for the same unit and period, obtained by summing the daily inpatient census over the month. Rate = (patients who developed ≥ 1 HAPU ÷ total patient-days) × 1,000.",
    "unit": "per 1000 patient-days",
    "benchmarkValue": 0.75,
    "benchmark": "≤ 0.75 per 1000 patient-days",
    "benchmarkNote": "HAPU incidence rate = (patients with ≥ 1 new hospital-acquired pressure ulcer ÷ patient-days) × 1,000 — the standard for ongoing internal clinical quality tracking. < 0.75 per 1000 patient-days is the commonly used NDNQI-derived benchmark (lower is better; aspirational target 0). Note: the one-day prevalence survey (~≤ 3.6% of patients surveyed, NDNQI) is a DIFFERENT metric — do not mix the two.",
    "goalDirection": "lower_is_better",
    "reference": "National Database of Nursing Quality Indicators (NDNQI) Pressure Injury Incidence; AHRQ Preventing Pressure Ulcers in Hospitals Toolkit (incidence & prevalence measurement); NPIAP (formerly NPUAP/EPUAP) International Pressure Injury Staging",
    "referenceUrl": "https://www.ahrq.gov/patient-safety/settings/hospital/resource/pressureulcer/tool/put5.html"
  },
  "bed sore (pressure injury)": {
    "canonicalName": "Hospital-Acquired Pressure Ulcer (HAPU) Incidence Rate",
    "formula": "rate1000",
    "numLabel": "Patients who developed ≥ 1 HAPU (Stage 2+)",
    "denLabel": "Patient-days",
    "numeratorDef": "Number of patients who developed one or more NEW hospital-acquired (nosocomial) pressure ulcers of Stage 2 or greater (including Stage 2, Stage 3, Stage 4, unstageable, and deep tissue injury) per NPIAP staging during the reporting period. Hospital-acquired = not present on admission; identified on/after the assessment that follows admission. A patient is counted once regardless of the number of ulcers.",
    "denominatorDef": "Total number of patient-days for the same unit and period, obtained by summing the daily inpatient census over the month. Rate = (patients who developed ≥ 1 HAPU ÷ total patient-days) × 1,000.",
    "unit": "per 1000 patient-days",
    "benchmarkValue": 0.75,
    "benchmark": "≤ 0.75 per 1000 patient-days",
    "benchmarkNote": "HAPU incidence rate = (patients with ≥ 1 new hospital-acquired pressure ulcer ÷ patient-days) × 1,000 — the standard for ongoing internal clinical quality tracking. < 0.75 per 1000 patient-days is the commonly used NDNQI-derived benchmark (lower is better; aspirational target 0). Note: the one-day prevalence survey (~≤ 3.6% of patients surveyed, NDNQI) is a DIFFERENT metric — do not mix the two.",
    "goalDirection": "lower_is_better",
    "reference": "National Database of Nursing Quality Indicators (NDNQI) Pressure Injury Incidence; AHRQ Preventing Pressure Ulcers in Hospitals Toolkit (incidence & prevalence measurement); NPIAP (formerly NPUAP/EPUAP) International Pressure Injury Staging",
    "referenceUrl": "https://www.ahrq.gov/patient-safety/settings/hospital/resource/pressureulcer/tool/put5.html"
  },
  "surgical site infection (ssi)": {
    "canonicalName": "Surgical Site Infection (SSI) Rate",
    "formula": "pct",
    "numLabel": "Number of SSIs",
    "denLabel": "Number of operative procedures",
    "numeratorDef": "Count of surgical site infections (superficial incisional, deep incisional, or organ/space) detected through routine surveillance within the applicable NHSN surveillance period for the procedure category (a 30- or 90-day period determined by the NHSN operative procedure CATEGORY and the tissue level/depth of the SSI event, per the 2013+ definitions — note this is no longer based on implant presence). Include SSIs identified during admission, on readmission, and via post-discharge surveillance. Each procedure-related SSI is counted once per NHSN protocol.",
    "denominatorDef": "Total number of NHSN operative procedures of that category performed during the same period (each trip to the OR meeting the NHSN procedure-code definition counts as one procedure), applying standard NHSN exclusion criteria. SSI rate = (SSIs / procedures) x 100. NHSN also risk-adjusts via the Standardized Infection Ratio (SIR = observed/predicted SSIs), with target SIR < 1.0.",
    "unit": "%",
    "benchmarkValue": 2,
    "benchmark": "≤ 2%",
    "benchmarkNote": "<= 2% per 100 procedures (procedure-dependent; NHSN risk-adjusted target SIR < 1.0)",
    "goalDirection": "lower_is_better",
    "reference": "CDC NHSN Patient Safety Component — Surgical Site Infection (SSI) Event protocol; WHO Global Guidelines for the Prevention of SSI",
    "referenceUrl": "https://www.cdc.gov/nhsn/psc/ssi/index.html"
  },
  "puncture site hematoma": {
    "canonicalName": "Puncture Site Hematoma Rate",
    "formula": "pct",
    "numLabel": "Number of puncture-site hematomas",
    "denLabel": "Number of vascular access procedures",
    "numeratorDef": "Count of clinically significant access-site hematomas occurring after a percutaneous vascular access procedure (e.g., cardiac catheterization/PCI), within 72 hours of the procedure (or by discharge if earlier), per NCDR CathPCI access-site complication definitions. A reportable/clinically significant hematoma is one associated with a hemoglobin drop >=3 g/dL, requiring blood transfusion, or requiring surgical or percutaneous intervention.",
    "denominatorDef": "Total number of percutaneous vascular access procedures performed in the same period. Rate = (puncture-site hematomas / access procedures) x 100.",
    "unit": "%",
    "benchmarkValue": 2,
    "benchmark": "≤ 2%",
    "benchmarkNote": "<= 2% of access procedures (route-dependent: transradial ~1-2%; transfemoral typically 2-12%)",
    "goalDirection": "lower_is_better",
    "reference": "ACC NCDR CathPCI Registry — access-site / vascular (hematoma) complication definitions; SCAI quality-improvement guidance on access-site bleeding (transradial best-practices consensus & femoral access-site bleeding QI)",
    "referenceUrl": "https://www.ncdr.com/WebNCDR/docs/default-source/ncdr-general-documents/cathpci-registry-2014-sample-report.pdf?sfvrsn=2"
  },
  "post-pci complication": {
    "canonicalName": "Post-PCI Complication Rate",
    "formula": "pct",
    "numLabel": "Number of PCI procedures with a complication",
    "denLabel": "Number of PCI procedures",
    "numeratorDef": "Count of PCI procedures with any in-hospital post-procedure complication as defined by the NCDR CathPCI Registry — including access-site/vascular complications (hematoma, pseudoaneurysm, AV fistula, retroperitoneal bleed, dissection/occlusion requiring treatment), major bleeding (per NCDR bleeding definition: bleeding within 72h, hemorrhagic stroke, cardiac tamponade, post-PCI transfusion when preprocedure Hgb >8 g/dL, or absolute Hgb drop >=3 g/dL when preprocedure Hgb <=16 g/dL), periprocedural MI, stroke/TIA, emergency CABG, new dialysis/acute kidney injury (AKIN stage 1+ or new dialysis), cardiac tamponade, or death — occurring from procedure start until discharge.",
    "denominatorDef": "Total number of PCI procedures performed in the same period. Rate = (PCIs with complication / total PCIs) x 100. NOTE: this unadjusted composite is a local quality-tracking metric, NOT an official NCDR surveillance measure. NCDR formally reports complications as separate RISK-ADJUSTED / risk-standardized outcome measures (in-hospital risk-adjusted mortality, risk-adjusted major bleeding, risk-adjusted AKI), because raw rates are confounded by patient risk mix.",
    "unit": "%",
    "benchmarkValue": 5,
    "benchmark": "≤ 5%",
    "benchmarkNote": "<= 5% of PCI procedures (generic composite target; not an official NCDR threshold). Real-world overall periprocedural complication ~2-3.5%; component targets lower (major bleeding ~1-2%). Prefer NCDR risk-adjusted, NQF-endorsed component measures where available.",
    "goalDirection": "lower_is_better",
    "reference": "American College of Cardiology NCDR CathPCI Registry — outcome/performance measure definitions (risk-adjusted mortality, bleeding, AKI; mortality & bleeding NQF-endorsed)",
    "referenceUrl": "https://www.ncdr.com/WebNCDR/docs/default-source/ncdr-general-documents/cathpci-registry-2014-sample-report.pdf?sfvrsn=2"
  },
  "post-procedure complication": {
    "canonicalName": "Post-Procedure Complication Rate",
    "formula": "pct",
    "numLabel": "Number of procedures with a complication",
    "denLabel": "Number of procedures performed",
    "numeratorDef": "Count of procedures with any post-procedure complication (e.g., bleeding/hematoma, infection, perforation, vascular injury, adverse event requiring intervention) identified from the time of procedure through the defined follow-up/discharge window (commonly up to 30 days for invasive/operative procedures), per the relevant procedure-specific surveillance definition.",
    "denominatorDef": "Total number of procedures of that type performed during the same period. Rate = (procedures with complication / total procedures) x 100.",
    "unit": "%",
    "benchmarkValue": 5,
    "benchmark": "≤ 5%",
    "benchmarkNote": "<= 5% of procedures (placeholder; strongly procedure-dependent)",
    "goalDirection": "lower_is_better",
    "reference": "AHRQ Quality Indicators / Patient Safety Indicators (postoperative complication rates) and NABH quality indicators; refine with procedure-specific registries (e.g., ACC NCDR for cardiac procedures)",
    "referenceUrl": "https://qualityindicators.ahrq.gov/measures/psi_resources"
  },
  "phlebitis": {
    "canonicalName": "Phlebitis rate (peripheral IV)",
    "formula": "pct",
    "numLabel": "Phlebitis events",
    "denLabel": "Peripheral IV catheters",
    "numeratorDef": "Number of peripheral intravenous (PIV) catheters that developed phlebitis (typically Visual Infusion Phlebitis [VIP] score >=2, i.e. pain plus erythema and/or induration/swelling along the vein) during the surveillance period. Count each affected catheter once.",
    "denominatorDef": "Total number of peripheral IV catheters in place / inserted during the same surveillance period.",
    "unit": "%",
    "benchmarkValue": 5,
    "benchmark": "≤ 5%",
    "benchmarkNote": "<= 5% of peripheral IV catheters",
    "goalDirection": "lower_is_better",
    "reference": "Infusion Nurses Society (INS), Infusion Therapy Standards of Practice (8th ed., 2021), Journal of Infusion Nursing 44(1S):S1-S224 - Phlebitis standard",
    "referenceUrl": "https://www.ins1.org/wp-content/uploads/2021/07/JIN-D-21-00031_SOP-Update-Hi-resWithout_Folio-7.13.21.pdf"
  },
  "deep vein thrombosis (dvt)": {
    "canonicalName": "Deep vein thrombosis / VTE rate",
    "formula": "rate1000",
    "numLabel": "DVT/VTE cases",
    "denLabel": "Surgical discharges",
    "numeratorDef": "Number of surgical discharges with a secondary (not present-on-admission) ICD-10-CM diagnosis of PROXIMAL deep vein thrombosis or pulmonary embolism arising perioperatively (hospital-acquired VTE). Per AHRQ PSI-12, only proximal DVT/PE qualify; isolated distal/calf DVT is excluded. Excludes cases with a principal diagnosis of PE/proximal DVT, POA PE/proximal DVT, vena cava interruption or pulmonary thrombectomy on/before the first OR procedure day, ECMO, acute brain/spinal injury POA, and obstetric discharges.",
    "denominatorDef": "Surgical discharges for patients age >=18 with any-listed ICD-10-PCS operating-room procedure code and a surgical MS-DRG (PSI-12 denominator). For general HA-VTE monitoring the denominator may be broadened to all eligible admissions, but the AHRQ-standard denominator is surgical discharges.",
    "unit": "per 1000 surgical discharges",
    "benchmarkValue": 4,
    "benchmark": "≤ 4 per 1000 surgical discharges",
    "benchmarkNote": "Lower is better; track against the AHRQ risk-adjusted PSI-12 national reference (observed rates roughly 3-5 per 1000 surgical discharges); no fixed zero target",
    "goalDirection": "lower_is_better",
    "reference": "AHRQ Quality Indicators, Patient Safety Indicator 12 (PSI-12): Perioperative Pulmonary Embolism or Deep Vein Thrombosis Rate (NQF #0450; titled 'Postoperative...' in older ICD-9 versions)",
    "referenceUrl": "https://qualityindicators.ahrq.gov/Downloads/Modules/PSI/V2025/TechSpecs/PSI_12_Perioperative_Pulmonary_Embolism_or_Deep_Vein_Thrombosis_Rate.pdf"
  },
  "accidental de-lining of catheter": {
    "canonicalName": "Accidental / unplanned catheter removal rate",
    "formula": "rate1000",
    "numLabel": "Accidental catheter removals/dislodgements",
    "denLabel": "Catheter-days",
    "numeratorDef": "Number of unplanned/accidental removals or dislodgements of an indwelling catheter (e.g. central venous catheter, PICC, arterial line, peripheral line) during the surveillance period - i.e. any removal not clinically ordered, including patient self-removal, accidental dislodgement, or migration requiring re-siting. Count each event once.",
    "denominatorDef": "Total catheter-days = sum, over each day of the surveillance period, of the number of indwelling catheters in place that day across all patients (device-days).",
    "unit": "per 1000 catheter-days",
    "benchmarkValue": 1,
    "benchmark": "≤ 1 per 1000 catheter-days",
    "benchmarkNote": "Lower is better; aspirational goal <= ~1 per 1000 catheter-days. Reported literature varies widely by device type and setting: central venous catheters ~2 per 1000 catheter-days (de la Torre/Lorente, Crit Care 2004, reported as 0.20/100 catheter-days), unplanned CVC removal ~5 per 1000 CVC-days in a multicenter ICU cohort, and ~11-16 per 1000 catheter-days for arterial lines and PICU central/PICC lines.",
    "goalDirection": "lower_is_better",
    "reference": "de la Torre / Lorente et al., 'Accidental catheter removal in critically ill patients: a prospective and observational study,' Critical Care 2004 (incidence density per catheter-days); INS Infusion Therapy Standards of Practice 2024 (device securement / dislodgement prevention)",
    "referenceUrl": "https://pmc.ncbi.nlm.nih.gov/articles/PMC522842/"
  },
  "accidental removal of catheter": {
    "canonicalName": "Accidental / unplanned catheter removal rate",
    "formula": "rate1000",
    "numLabel": "Accidental catheter removals/dislodgements",
    "denLabel": "Catheter-days",
    "numeratorDef": "Number of unplanned/accidental removals or dislodgements of an indwelling catheter (e.g. central venous catheter, PICC, arterial line, peripheral line) during the surveillance period - i.e. any removal not clinically ordered, including patient self-removal, accidental dislodgement, or migration requiring re-siting. Count each event once.",
    "denominatorDef": "Total catheter-days = sum, over each day of the surveillance period, of the number of indwelling catheters in place that day across all patients (device-days).",
    "unit": "per 1000 catheter-days",
    "benchmarkValue": 1,
    "benchmark": "≤ 1 per 1000 catheter-days",
    "benchmarkNote": "Lower is better; aspirational goal <= ~1 per 1000 catheter-days. Reported literature varies widely by device type and setting: central venous catheters ~2 per 1000 catheter-days (de la Torre/Lorente, Crit Care 2004, reported as 0.20/100 catheter-days), unplanned CVC removal ~5 per 1000 CVC-days in a multicenter ICU cohort, and ~11-16 per 1000 catheter-days for arterial lines and PICU central/PICC lines.",
    "goalDirection": "lower_is_better",
    "reference": "de la Torre / Lorente et al., 'Accidental catheter removal in critically ill patients: a prospective and observational study,' Critical Care 2004 (incidence density per catheter-days); INS Infusion Therapy Standards of Practice 2024 (device securement / dislodgement prevention)",
    "referenceUrl": "https://pmc.ncbi.nlm.nih.gov/articles/PMC522842/"
  },
  "accidental catheter dislodgement": {
    "canonicalName": "Accidental / unplanned catheter removal rate",
    "formula": "rate1000",
    "numLabel": "Accidental catheter removals/dislodgements",
    "denLabel": "Catheter-days",
    "numeratorDef": "Number of unplanned/accidental removals or dislodgements of an indwelling catheter (e.g. central venous catheter, PICC, arterial line, peripheral line) during the surveillance period - i.e. any removal not clinically ordered, including patient self-removal, accidental dislodgement, or migration requiring re-siting. Count each event once.",
    "denominatorDef": "Total catheter-days = sum, over each day of the surveillance period, of the number of indwelling catheters in place that day across all patients (device-days).",
    "unit": "per 1000 catheter-days",
    "benchmarkValue": 1,
    "benchmark": "≤ 1 per 1000 catheter-days",
    "benchmarkNote": "Lower is better; aspirational goal <= ~1 per 1000 catheter-days. Reported literature varies widely by device type and setting: central venous catheters ~2 per 1000 catheter-days (de la Torre/Lorente, Crit Care 2004, reported as 0.20/100 catheter-days), unplanned CVC removal ~5 per 1000 CVC-days in a multicenter ICU cohort, and ~11-16 per 1000 catheter-days for arterial lines and PICU central/PICC lines.",
    "goalDirection": "lower_is_better",
    "reference": "de la Torre / Lorente et al., 'Accidental catheter removal in critically ill patients: a prospective and observational study,' Critical Care 2004 (incidence density per catheter-days); INS Infusion Therapy Standards of Practice 2024 (device securement / dislodgement prevention)",
    "referenceUrl": "https://pmc.ncbi.nlm.nih.gov/articles/PMC522842/"
  },
  "accidental removal of ett tube": {
    "canonicalName": "Unplanned (accidental) extubation rate",
    "formula": "rate100",
    "numLabel": "Unplanned extubations",
    "denLabel": "Ventilator-days",
    "numeratorDef": "Number of unplanned/accidental extubations - any removal of the endotracheal (ETT) tube not deliberately performed by the care team, including patient self-extubation and accidental dislodgement during care/transport. Count each event once.",
    "denominatorDef": "Total ventilator-days = sum across the surveillance period of the number of patients with an ETT on mechanical ventilation each day. Multiply the ratio by 100 (rate expressed per 100 ventilator-days).",
    "unit": "per 100 ventilator-days",
    "benchmarkValue": 0.95,
    "benchmark": "≤ 0.95 per 100 ventilator-days",
    "benchmarkNote": "<= 0.95 unplanned extubations per 100 ventilator-days (Solutions for Patient Safety national goal); reported literature rates typically ~0.9-1.06 per 100 ventilator-days",
    "goalDirection": "lower_is_better",
    "reference": "Solutions for Patient Safety (SPS) unplanned-extubation bundle benchmark goal (<=0.95 per 100 ventilator-days, introduced May 2018); per-100-ventilator-day surveillance convention per published ICU/NICU/PICU UE literature (e.g., Respir Care editorial, PMC10753604, defining UE per 100 days of mechanical ventilation)",
    "referenceUrl": "https://pmc.ncbi.nlm.nih.gov/articles/PMC10753604/"
  },
  "hand hygiene compliance - overall": {
    "canonicalName": "Hand Hygiene Compliance - Overall",
    "formula": "pct",
    "numLabel": "Hand hygiene actions performed",
    "denLabel": "Hand hygiene opportunities observed",
    "numeratorDef": "Number of observed hand hygiene actions performed (rubbing hands with alcohol-based handrub OR washing with soap and water) when an opportunity occurs, counted across ALL healthcare worker categories via direct observation using the WHO 'My 5 Moments for Hand Hygiene' method.",
    "denominatorDef": "Total number of hand hygiene opportunities observed across ALL healthcare worker categories. An opportunity is defined by one or more of the WHO 5 Moments (before touching a patient; before clean/aseptic procedure; after body fluid exposure risk; after touching a patient; after touching patient surroundings). Several indications arising simultaneously count as a single opportunity.",
    "unit": "%",
    "benchmarkValue": 80,
    "benchmark": "≥ 80%",
    "benchmarkNote": ">= 80% compliance",
    "goalDirection": "higher_is_better",
    "reference": "WHO Guidelines on Hand Hygiene in Health Care (2009), 'My 5 Moments for Hand Hygiene' and WHO Hand Hygiene Technical Reference Manual; benchmark reflects a commonly used operational target (The Joint Commission no longer mandates a fixed numeric compliance percentage).",
    "referenceUrl": "https://www.ncbi.nlm.nih.gov/books/NBK144028/"
  },
  "hand hygiene compliance - doctors": {
    "canonicalName": "Hand Hygiene Compliance - Doctors",
    "formula": "pct",
    "numLabel": "Hand hygiene actions performed by doctors",
    "denLabel": "Hand hygiene opportunities observed for doctors",
    "numeratorDef": "Number of observed hand hygiene actions performed (alcohol-based handrub OR soap-and-water handwash) by DOCTORS / medical staff when an opportunity occurs, via WHO 'My 5 Moments' direct observation.",
    "denominatorDef": "Total number of hand hygiene opportunities observed for DOCTORS / medical staff, where an opportunity is any of the WHO 5 Moments (before patient contact; before aseptic task; after body fluid exposure risk; after patient contact; after contact with patient surroundings). Simultaneous indications = one opportunity.",
    "unit": "%",
    "benchmarkValue": 80,
    "benchmark": "≥ 80%",
    "benchmarkNote": ">= 80% compliance (institutional/program target; not a WHO- or Joint Commission-mandated threshold)",
    "goalDirection": "higher_is_better",
    "reference": "WHO Guidelines on Hand Hygiene in Health Care (2009), 'My 5 Moments for Hand Hygiene' and WHO Hand Hygiene Technical Reference Manual (compliance = actions/opportunities x 100; stratification by professional category recommended)",
    "referenceUrl": "https://www.ncbi.nlm.nih.gov/books/NBK144028/"
  },
  "hand hygiene compliance - nurses": {
    "canonicalName": "Hand Hygiene Compliance - Nurses",
    "formula": "pct",
    "numLabel": "Hand hygiene actions performed by nurses",
    "denLabel": "Hand hygiene opportunities observed for nurses",
    "numeratorDef": "Number of observed hand hygiene actions performed (alcohol-based handrub OR soap-and-water handwash) by NURSES / nursing staff when an opportunity occurs, via WHO 'My 5 Moments' direct observation.",
    "denominatorDef": "Total number of hand hygiene opportunities observed for NURSES / nursing staff, where an opportunity is any of the WHO 5 Moments (before patient contact; before aseptic task; after body fluid exposure risk; after patient contact; after contact with patient surroundings). Simultaneous/overlapping indications during a single care sequence count as ONE opportunity.",
    "unit": "%",
    "benchmarkValue": 80,
    "benchmark": "≥ 80%",
    "benchmarkNote": ">= 80% compliance",
    "goalDirection": "higher_is_better",
    "reference": "WHO Guidelines on Hand Hygiene in Health Care (2009), 'Hand hygiene as a performance indicator' / 'My 5 Moments for Hand Hygiene' (defines the actions/opportunities formula). Note: the >=80% target is a commonly used institutional/operational benchmark, NOT an official numeric standard of WHO or The Joint Commission.",
    "referenceUrl": "https://www.ncbi.nlm.nih.gov/books/NBK144028/"
  },
  "hand hygiene compliance - others": {
    "canonicalName": "Hand Hygiene Compliance - Others",
    "formula": "pct",
    "numLabel": "Hand hygiene actions performed by other staff",
    "denLabel": "Hand hygiene opportunities observed for other staff",
    "numeratorDef": "Number of observed hand hygiene actions performed (alcohol-based handrub OR soap-and-water handwash) by healthcare workers in the WHO 'Other health-care worker' professional category (therapists e.g. physiotherapists/occupational/speech therapists; technicians e.g. radiology/laboratory/cardiology; dieticians, dentists, social workers, students, and lay persons providing care) when an opportunity occurs, via WHO 'My 5 Moments' direct observation.",
    "denominatorDef": "Total number of hand hygiene opportunities observed for healthcare workers in the WHO 'Other health-care worker' professional category, where an opportunity is any of the WHO 5 Moments (before patient contact; before aseptic task; after body fluid exposure risk; after patient contact; after contact with patient surroundings). Simultaneous indications count as one opportunity.",
    "unit": "%",
    "benchmarkValue": 80,
    "benchmark": "≥ 80%",
    "benchmarkNote": ">= 80% compliance",
    "goalDirection": "higher_is_better",
    "reference": "WHO Guidelines on Hand Hygiene in Health Care (2009), Part III Ch.1 'Hand hygiene as a performance indicator' and 'My 5 Moments for Hand Hygiene'; benchmark per The Joint Commission NPSG.07.01.01 hand hygiene standard",
    "referenceUrl": "https://www.ncbi.nlm.nih.gov/books/NBK144028/"
  },
  "icu re-admission within 48 hours": {
    "canonicalName": "ICU Readmission Rate within 48 Hours",
    "formula": "pct",
    "numLabel": "ICU readmissions within 48h",
    "denLabel": "ICU discharges/transfers",
    "numeratorDef": "Number of patients readmitted to (returned to) the ICU within 48 hours of being discharged or transferred out of the ICU to a lower level of care (ward/step-down) during the reporting period. Count each unplanned return; planned/scheduled returns (e.g., staged post-operative ICU admissions) are typically excluded. A patient is counted once per qualifying readmission event.",
    "denominatorDef": "Total number of patients discharged or transferred alive from the ICU to a lower level of care (ward/step-down) during the reporting period (the population at risk of returning). ICU deaths and patients discharged directly home or to another facility (not at risk of ICU return) are excluded from the at-risk denominator.",
    "unit": "%",
    "benchmarkValue": 4,
    "benchmark": "≤ 4%",
    "benchmarkNote": "<= 4% of ICU discharges (soft target; no single hard accreditation threshold). The 48h subset typically runs ~2-2.5%; all-cause/longer-window readmission ~6-7%. Reported rates vary widely (~1.7% up to ~15% when unexpected death is bundled in) by case-mix and discharge policy.",
    "goalDirection": "lower_is_better",
    "reference": "Society of Critical Care Medicine (SCCM) Quality Indicators Committee (48h ICU readmission listed as a performance indicator); Woldhek AL et al., 'Readmission of ICU patients: A quality indicator?', J Crit Care 2017;38:328-334",
    "referenceUrl": "https://pubmed.ncbi.nlm.nih.gov/27939901/"
  },
  "re-admission within 48 hours (icu)": {
    "canonicalName": "ICU Readmission Rate within 48 Hours",
    "formula": "pct",
    "numLabel": "ICU readmissions within 48h",
    "denLabel": "ICU discharges/transfers",
    "numeratorDef": "Number of patients readmitted to (returned to) the ICU within 48 hours of being discharged or transferred out of the ICU to a lower level of care (ward/step-down) during the reporting period. Count each unplanned return; planned/scheduled returns (e.g., staged post-operative ICU admissions) are typically excluded. A patient is counted once per qualifying readmission event.",
    "denominatorDef": "Total number of patients discharged or transferred alive from the ICU to a lower level of care (ward/step-down) during the reporting period (the population at risk of returning). ICU deaths and patients discharged directly home or to another facility (not at risk of ICU return) are excluded from the at-risk denominator.",
    "unit": "%",
    "benchmarkValue": 4,
    "benchmark": "≤ 4%",
    "benchmarkNote": "<= 4% of ICU discharges (soft target; no single hard accreditation threshold). The 48h subset typically runs ~2-2.5%; all-cause/longer-window readmission ~6-7%. Reported rates vary widely (~1.7% up to ~15% when unexpected death is bundled in) by case-mix and discharge policy.",
    "goalDirection": "lower_is_better",
    "reference": "Society of Critical Care Medicine (SCCM) Quality Indicators Committee (48h ICU readmission listed as a performance indicator); Woldhek AL et al., 'Readmission of ICU patients: A quality indicator?', J Crit Care 2017;38:328-334",
    "referenceUrl": "https://pubmed.ncbi.nlm.nih.gov/27939901/"
  },
  "return to icu": {
    "canonicalName": "ICU Readmission Rate within 48 Hours",
    "formula": "pct",
    "numLabel": "ICU readmissions within 48h",
    "denLabel": "ICU discharges/transfers",
    "numeratorDef": "Number of patients readmitted to (returned to) the ICU within 48 hours of being discharged or transferred out of the ICU to a lower level of care (ward/step-down) during the reporting period. Count each unplanned return; planned/scheduled returns (e.g., staged post-operative ICU admissions) are typically excluded. A patient is counted once per qualifying readmission event.",
    "denominatorDef": "Total number of patients discharged or transferred alive from the ICU to a lower level of care (ward/step-down) during the reporting period (the population at risk of returning). ICU deaths and patients discharged directly home or to another facility (not at risk of ICU return) are excluded from the at-risk denominator.",
    "unit": "%",
    "benchmarkValue": 4,
    "benchmark": "≤ 4%",
    "benchmarkNote": "<= 4% of ICU discharges (soft target; no single hard accreditation threshold). The 48h subset typically runs ~2-2.5%; all-cause/longer-window readmission ~6-7%. Reported rates vary widely (~1.7% up to ~15% when unexpected death is bundled in) by case-mix and discharge policy.",
    "goalDirection": "lower_is_better",
    "reference": "Society of Critical Care Medicine (SCCM) Quality Indicators Committee (48h ICU readmission listed as a performance indicator); Woldhek AL et al., 'Readmission of ICU patients: A quality indicator?', J Crit Care 2017;38:328-334",
    "referenceUrl": "https://pubmed.ncbi.nlm.nih.gov/27939901/"
  },
  "re-intubation within 48 hours": {
    "canonicalName": "Re-intubation Rate within 48 Hours (Extubation Failure)",
    "formula": "pct",
    "numLabel": "Re-intubations within 48h",
    "denLabel": "Planned extubations",
    "numeratorDef": "Number of patients requiring reintubation (or return to invasive mechanical ventilation via any invasive airway) within 48 hours of a planned extubation during the reporting period. This is 'extubation failure.' Reintubation following unplanned/accidental (self-)extubation, or reintubation for a new, unrelated surgical procedure, is typically excluded.",
    "denominatorDef": "Total number of planned (elective) extubations of mechanically ventilated patients performed during the reporting period. Each planned extubation event counts as one denominator unit.",
    "unit": "%",
    "benchmarkValue": 10,
    "benchmark": "≤ 10%",
    "benchmarkNote": "Acceptable/target extubation-failure rate ~5-10% of planned extubations (wider reasonable band 5-15%); commonly benchmarked at <=10%",
    "goalDirection": "lower_is_better",
    "reference": "Epstein SK. 'What is the optimal rate of failed extubation?' Critical Care 2012;16(1):111. Also supported by ATS/CHEST ventilator liberation guidance and standard critical-care weaning literature.",
    "referenceUrl": "https://pmc.ncbi.nlm.nih.gov/articles/PMC3396264/"
  },
  "door-to-balloon compliance rate (<=90 min)": {
    "canonicalName": "Door-to-Balloon Time <=90 min Compliance",
    "formula": "pct",
    "numLabel": "STEMI patients with primary PCI within 90 min",
    "denLabel": "STEMI patients receiving primary PCI",
    "numeratorDef": "Number of AMI/STEMI (ST-elevation or new LBBB on ECG closest to arrival) patients whose interval from hospital arrival (door) to first device deployment / balloon inflation during primary PCI is <= 90 minutes. Count each qualifying patient once.",
    "denominatorDef": "Number of AMI patients with ST-segment elevation or LBBB on the ECG closest to arrival who receive primary PCI as the reperfusion strategy during the hospital stay (CMS CMS53v7 / AMI-8a initial population: patients >=18 yr with STEMI undergoing primary PCI). Exclude transfers-in, fibrinolytic patients, and documented contraindication/delay reasons per measure spec.",
    "unit": "%",
    "benchmarkValue": 90,
    "benchmark": "≥ 90%",
    "benchmarkNote": ">= 90% of primary-PCI STEMI patients treated within 90 minutes (each individual case target door-to-balloon <= 90 min; ACC/AHA Class I). Original ACC D2B Alliance population goal was >=75%; high performers reach ~85-90%+.",
    "goalDirection": "higher_is_better",
    "reference": "CMS/Joint Commission measure CMS53v7 / AMI-8a 'Primary PCI Received Within 90 Minutes of Hospital Arrival' (NQF #0163); ACC/AHA STEMI guideline & performance measures",
    "referenceUrl": "https://ecqi.healthit.gov/ecqm/eh/2019/cms053v7"
  },
  "cardiac arrest events": {
    "canonicalName": "Cardiac Arrest (Code Blue) Events",
    "formula": "count",
    "numLabel": "Number of cardiac arrest (code blue) events",
    "denLabel": "",
    "numeratorDef": "Count of in-hospital cardiac arrest events (pulselessness requiring chest compressions and/or defibrillation, i.e. a resuscitation/code-blue activation) occurring during the reporting period, per AHA Get With The Guidelines-Resuscitation event definition. Excludes patients with an existing do-not-resuscitate order who did not receive CPR. Tally each qualifying arrest event.",
    "denominatorDef": "",
    "unit": "count",
    "benchmarkValue": 0,
    "benchmark": "0 — track & RCA every event",
    "benchmarkNote": "No fixed external benchmark; tracked as an absolute event count and trended internally (lower is better). For context, published IHCA incidence is often normalized to roughly 1-10 per 1000 admissions, but the registry sets no fixed threshold.",
    "goalDirection": "lower_is_better",
    "reference": "American Heart Association Get With The Guidelines-Resuscitation (in-hospital cardiac arrest registry; cardiac arrest defined as pulselessness requiring chest compression and/or defibrillation)",
    "referenceUrl": "https://www.heart.org/en/professional/quality-improvement/get-with-the-guidelines/get-with-the-guidelines-resuscitation"
  },
  "cardiac arrest survival rate": {
    "canonicalName": "Cardiac Arrest Survival to Discharge Rate",
    "formula": "pct",
    "numLabel": "Cardiac arrest patients surviving to hospital discharge",
    "denLabel": "Patients with an in-hospital cardiac arrest with attempted resuscitation",
    "numeratorDef": "Number of in-hospital cardiac arrest patients who survived to hospital discharge (alive at discharge) following resuscitation. Count each patient once per index arrest.",
    "denominatorDef": "Number of patients who had an in-hospital cardiac arrest (pulseless event requiring chest compressions and/or defibrillation) with an attempted resuscitation during the reporting period (GWTG-Resuscitation index-event population; excludes patients with pre-existing do-not-resuscitate orders).",
    "unit": "%",
    "benchmarkValue": 25,
    "benchmark": "≥ 25%",
    "benchmarkNote": "Higher is better; AHA GWTG-R contemporary adult IHCA survival-to-discharge ~24% (benchmark ~25%)",
    "goalDirection": "higher_is_better",
    "reference": "American Heart Association Get With The Guidelines-Resuscitation; AHA Heart Disease & Stroke Statistics / 2025 ECC Guidelines",
    "referenceUrl": "https://www.ahajournals.org/doi/10.1161/CIR.0000000000001372"
  },
  "dialysis adequacy (urr)": {
    "canonicalName": "Dialysis Adequacy (URR)",
    "formula": "pct",
    "numLabel": "Pre-BUN minus post-BUN",
    "denLabel": "Pre-dialysis BUN",
    "numeratorDef": "(Pre-dialysis BUN minus post-dialysis BUN) for the treatment session; equivalently, count of HD patients meeting the adequacy target when reporting facility compliance",
    "denominatorDef": "Pre-dialysis BUN drawn immediately before the session (post-BUN drawn per the slow-flow/stop-pump technique); for facility reporting, total HD patients with a measured URR in the period",
    "unit": "%",
    "benchmarkValue": 65,
    "benchmark": "≥ 65%",
    "benchmarkNote": ">= 65% minimum (target > 70%); equivalent to spKt/V minimum 1.2, target 1.4 for thrice-weekly HD",
    "goalDirection": "higher_is_better",
    "reference": "NKF KDOQI Clinical Practice Guideline for Hemodialysis Adequacy: 2015 Update",
    "referenceUrl": "https://www.ajkd.org/article/S0272-6386(15)01019-7/fulltext"
  },
  "hypotension rate": {
    "canonicalName": "Intradialytic Hypotension Rate",
    "formula": "pct",
    "numLabel": "HD sessions with intradialytic hypotension",
    "denLabel": "Total HD sessions",
    "numeratorDef": "Number of hemodialysis sessions during which intradialytic hypotension occurred, defined per KDOQI as a decrease in systolic BP >= 20 mmHg (or a fall in mean arterial pressure >= 10 mmHg) associated with symptoms (e.g., cramps, nausea, dizziness, fainting) and requiring nursing intervention (e.g., stopping ultrafiltration and/or saline infusion)",
    "denominatorDef": "Total number of hemodialysis sessions delivered in the reporting period",
    "unit": "%",
    "benchmarkValue": 20,
    "benchmark": "≤ 20%",
    "benchmarkNote": "<= 20% of sessions (KDOQI background prevalence ~20-30%, about 25%; lower is better)",
    "goalDirection": "lower_is_better",
    "reference": "NKF KDOQI Clinical Practice Guidelines for Cardiovascular Disease in Dialysis Patients - Intradialytic Hypotension",
    "referenceUrl": "https://kidneyfoundation.cachefly.net/professionals/KDOQI/guidelines_cvd/intradialytic.htm"
  },
  "vascular access complication rate": {
    "canonicalName": "Vascular Access Thrombosis Rate (AV Fistula/Graft)",
    "formula": "rate1000",
    "numLabel": "Access thrombosis events",
    "denLabel": "Access-days at risk",
    "numeratorDef": "Number of thrombosis events occurring in functioning AV fistulae/grafts during the period. (KDOQI benchmarks are defined for thrombosis specifically; a broader composite that also counts stenosis requiring intervention or access infection may be reported separately but is not directly comparable to the per-access-year thrombosis benchmark.)",
    "denominatorDef": "Cumulative access-days at risk (sum of days each functioning AV access is in use during the period). The native KDOQI metric is events per access-year (= access-days / 365); divide access-days by 365 to compare with the per-access-year benchmark.",
    "unit": "per 1000 access-days at risk",
    "benchmarkValue": 0.5,
    "benchmark": "≤ 0.5 per 1000 access-days at risk",
    "benchmarkNote": "<= 0.5 thrombosis events per access-year (~1.37 per 1000 access-days). AV grafts: baseline 0.5-0.8/graft-year, target 0.2-0.4/graft-year with surveillance; AV fistulae lower (~0.1-0.5/year).",
    "goalDirection": "lower_is_better",
    "reference": "NKF KDOQI Clinical Practice Guideline for Vascular Access: 2019 Update (Am J Kidney Dis. 2020;75(4)(suppl 2):S1-S164)",
    "referenceUrl": "https://www.ajkd.org/article/S0272-6386(19)31137-0/fulltext"
  },
  "vascular access thrombosis rate": {
    "canonicalName": "Vascular Access Thrombosis Rate (AV Fistula/Graft)",
    "formula": "rate1000",
    "numLabel": "Access thrombosis events",
    "denLabel": "Access-days at risk",
    "numeratorDef": "Number of thrombosis events occurring in functioning AV fistulae/grafts during the period. (KDOQI benchmarks are defined for thrombosis specifically; a broader composite that also counts stenosis requiring intervention or access infection may be reported separately but is not directly comparable to the per-access-year thrombosis benchmark.)",
    "denominatorDef": "Cumulative access-days at risk (sum of days each functioning AV access is in use during the period). The native KDOQI metric is events per access-year (= access-days / 365); divide access-days by 365 to compare with the per-access-year benchmark.",
    "unit": "per 1000 access-days at risk",
    "benchmarkValue": 0.5,
    "benchmark": "≤ 0.5 per 1000 access-days at risk",
    "benchmarkNote": "<= 0.5 thrombosis events per access-year (~1.37 per 1000 access-days). AV grafts: baseline 0.5-0.8/graft-year, target 0.2-0.4/graft-year with surveillance; AV fistulae lower (~0.1-0.5/year).",
    "goalDirection": "lower_is_better",
    "reference": "NKF KDOQI Clinical Practice Guideline for Vascular Access: 2019 Update (Am J Kidney Dis. 2020;75(4)(suppl 2):S1-S164)",
    "referenceUrl": "https://www.ajkd.org/article/S0272-6386(19)31137-0/fulltext"
  },
  "water quality compliance": {
    "canonicalName": "Dialysis Water Quality Compliance",
    "formula": "pct",
    "numLabel": "Water/dialysate samples within AAMI/ISO limits",
    "denLabel": "Total water/dialysate samples tested",
    "numeratorDef": "Number of dialysis water and dialysate microbiological/endotoxin samples meeting applicable ANSI/AAMI/ISO 23500 limits. For standard dialysis WATER: total viable count (TVC) < 100 CFU/mL (action level 50 CFU/mL) and endotoxin < 0.25 EU/mL (action level 0.125 EU/mL). For standard dialysate (dialysis fluid): TVC < 100 CFU/mL and endotoxin < 0.5 EU/mL (action levels 50 CFU/mL and 0.25 EU/mL). For ultrapure dialysate: TVC < 0.1 CFU/mL and endotoxin < 0.03 EU/mL. Cultures performed on low-nutrient media (e.g., TGEA/R2A) at 17-23 C for >=168 h; do not use nutrient-rich media.",
    "denominatorDef": "Total number of scheduled water/dialysate quality samples tested in the period (microbiological cultures and endotoxin/LAL assays at required sampling points)",
    "unit": "%",
    "benchmarkValue": 100,
    "benchmark": "≥ 100%",
    "benchmarkNote": "100% of samples within ANSI/AAMI/ISO 23500 limits (water: TVC < 100 CFU/mL, endotoxin < 0.25 EU/mL; dialysate: TVC < 100 CFU/mL, endotoxin < 0.5 EU/mL)",
    "goalDirection": "higher_is_better",
    "reference": "ANSI/AAMI/ISO 23500 series (incl. ISO 13959 / ISO 23500-3 water for haemodialysis; ISO 23500-5 dialysis fluid) - Preparation and quality management of fluids for haemodialysis and related therapies; CMS ESRD Conditions for Coverage; CDC dialysis water quality recommendations",
    "referenceUrl": "https://www.cdc.gov/dialysis-safety/hcp/recommendations-resources/water-use-in-dialysis.html"
  },
  "partograph compliance": {
    "canonicalName": "Partograph / Labour Care Guide Compliance",
    "formula": "pct",
    "numLabel": "Eligible labours with partograph correctly used/completed",
    "denLabel": "Eligible women in active labour",
    "numeratorDef": "Number of eligible women in active labour for whom the partograph (or WHO Labour Care Guide) was correctly commenced and completed per protocol — i.e. cervical dilatation, fetal heart rate, contractions, descent, maternal vitals and the alert/action line plotted at the required intervals. Determined by retrospective chart audit against a defined completeness checklist.",
    "denominatorDef": "Total number of eligible women in active labour (vaginal-birth pathway) audited during the period for whom a partograph/Labour Care Guide should have been used. Exclude pre-labour caesarean and other women in whom partograph monitoring is not indicated.",
    "unit": "%",
    "benchmarkValue": 100,
    "benchmark": "≥ 100%",
    "benchmarkNote": "Target 100% (full compliance); commonly set >=90% as an interim quality threshold",
    "goalDirection": "higher_is_better",
    "reference": "WHO recommendations: intrapartum care for a positive childbirth experience (2018, ISBN 9789241550215) and WHO Labour Care Guide: User's Manual (2020, ISBN 9789240017566); NABH accreditation standards (Nursing Excellence / Nursing Quality Indicators) as general accreditation context",
    "referenceUrl": "https://www.who.int/publications/i/item/9789240017566"
  },
  "fetal heart rate monitoring compliance": {
    "canonicalName": "Intrapartum Fetal Heart Rate Monitoring Compliance",
    "formula": "pct",
    "numLabel": "Labours with FHR monitored & documented per protocol",
    "denLabel": "Labours requiring intrapartum FHR monitoring",
    "numeratorDef": "Number of monitored labours in which intrapartum fetal heart rate was assessed and documented at the protocol-required frequency and method (e.g. intermittent auscultation immediately after a palpated contraction for >=1 minute, at least every 15 minutes in established first stage and at least every 5 minutes in second stage for low-risk women, or continuous CTG when antenatal/intrapartum risk factors are present). Counted by chart/partogram audit as fully compliant only when all required FHR entries are present at the required interval and method. State whether scoring per labour or per assessment opportunity and keep it consistent.",
    "denominatorDef": "Total number of labours audited that required intrapartum fetal heart rate monitoring during the period (eligible labours). If scoring at the observation level, the denominator is instead the total number of required FHR-assessment opportunities; choose one level and apply it consistently across the numerator and denominator.",
    "unit": "%",
    "benchmarkValue": 100,
    "benchmark": "≥ 100%",
    "benchmarkNote": "Target 100% (full compliance); >=90% commonly used as an interim audit threshold",
    "goalDirection": "higher_is_better",
    "reference": "NICE NG229 Fetal monitoring in labour (2022); FIGO consensus guidelines on intrapartum fetal monitoring (2015); ACOG Clinical Practice Guideline No. 10: Intrapartum Fetal Heart Rate Monitoring: Interpretation and Management (Oct 2025), which replaces the retired Practice Bulletins No. 106 (2009) and No. 116 (2010)",
    "referenceUrl": "https://www.nice.org.uk/guidance/ng229/chapter/Recommendations"
  },
  "needle stick / sharps injury": {
    "canonicalName": "Needle Stick / Sharps Injury Rate",
    "formula": "rate100",
    "numLabel": "Number of NSI cases",
    "denLabel": "Total healthcare workers",
    "denAdminOnly": true,
    "victimField": true,
    "numeratorDef": "Count every reported needlestick / sharps (NSI) injury sustained by a healthcare worker during the month; log each case with its injured staff member (victim). Data collectors enter only the NSI cases (one per incident) — they do NOT enter the denominator.",
    "denominatorDef": "Total number of healthcare workers at risk (the hospital's staff headcount). This is a fixed figure set by the ADMINISTRATOR (not by data collectors). Rate = (NSI cases / total healthcare workers) x 100.",
    "unit": "per 100 healthcare workers",
    "benchmarkValue": 2,
    "benchmark": "≤ 2 per 100 FTE per year",
    "benchmarkNote": "<= 2.0 injuries per 100 FTE per year (US national EXPO-S.T.O.P./EPINet benchmark; rate has held near 1.9-2.0 since 2021); aspirational target 0. Note: nurse-specific rates run higher (~4-5 per 100 FTE).",
    "goalDirection": "lower_is_better",
    "reference": "AOHP EXPO-S.T.O.P. national survey (Grimmond/Good); International Safety Center EPINet (Exposure Prevention Information Network); OSHA Bloodborne Pathogens Standard 29 CFR 1910.1030.",
    "referenceUrl": "https://internationalsafetycenter.org/exposure-data-network-epinet/"
  },
  "needle stick injury (nsi)": {
    "canonicalName": "Needle Stick / Sharps Injury Rate",
    "formula": "rate100",
    "numLabel": "Number of NSI cases",
    "denLabel": "Total healthcare workers",
    "denAdminOnly": true,
    "victimField": true,
    "numeratorDef": "Count every reported needlestick / sharps (NSI) injury sustained by a healthcare worker during the month; log each case with its injured staff member (victim). Data collectors enter only the NSI cases (one per incident) — they do NOT enter the denominator.",
    "denominatorDef": "Total number of healthcare workers at risk (the hospital's staff headcount). This is a fixed figure set by the ADMINISTRATOR (not by data collectors). Rate = (NSI cases / total healthcare workers) x 100.",
    "unit": "per 100 healthcare workers",
    "benchmarkValue": 2,
    "benchmark": "≤ 2 per 100 FTE per year",
    "benchmarkNote": "<= 2.0 injuries per 100 FTE per year (US national EXPO-S.T.O.P./EPINet benchmark; rate has held near 1.9-2.0 since 2021); aspirational target 0. Note: nurse-specific rates run higher (~4-5 per 100 FTE).",
    "goalDirection": "lower_is_better",
    "reference": "AOHP EXPO-S.T.O.P. national survey (Grimmond/Good); International Safety Center EPINet (Exposure Prevention Information Network); OSHA Bloodborne Pathogens Standard 29 CFR 1910.1030.",
    "referenceUrl": "https://internationalsafetycenter.org/exposure-data-network-epinet/"
  },
  "needle stick injury": {
    "canonicalName": "Needle Stick / Sharps Injury Rate",
    "formula": "rate100",
    "numLabel": "Number of NSI cases",
    "denLabel": "Total healthcare workers",
    "denAdminOnly": true,
    "victimField": true,
    "numeratorDef": "Count every reported needlestick / sharps (NSI) injury sustained by a healthcare worker during the month; log each case with its injured staff member (victim). Data collectors enter only the NSI cases (one per incident) — they do NOT enter the denominator.",
    "denominatorDef": "Total number of healthcare workers at risk (the hospital's staff headcount). This is a fixed figure set by the ADMINISTRATOR (not by data collectors). Rate = (NSI cases / total healthcare workers) x 100.",
    "unit": "per 100 healthcare workers",
    "benchmarkValue": 2,
    "benchmark": "≤ 2 per 100 FTE per year",
    "benchmarkNote": "<= 2.0 injuries per 100 FTE per year (US national EXPO-S.T.O.P./EPINet benchmark; rate has held near 1.9-2.0 since 2021); aspirational target 0. Note: nurse-specific rates run higher (~4-5 per 100 FTE).",
    "goalDirection": "lower_is_better",
    "reference": "AOHP EXPO-S.T.O.P. national survey (Grimmond/Good); International Safety Center EPINet (Exposure Prevention Information Network); OSHA Bloodborne Pathogens Standard 29 CFR 1910.1030.",
    "referenceUrl": "https://internationalsafetycenter.org/exposure-data-network-epinet/"
  },
  "medication error": {
    "canonicalName": "Medication Administration Error Rate",
    "formula": "pct",
    "numLabel": "Number of medication administration errors",
    "denLabel": "Total doses administered (opportunities for error)",
    "numeratorDef": "Number of medication administration errors: doses given incorrectly at the administration stage per the NCC-MERP definition (wrong drug, wrong dose, wrong route, wrong time/rate, wrong patient, wrong preparation/technique, or an omitted / unauthorised dose), detected by direct observation or incident report.",
    "denominatorDef": "Total Opportunities for Error (TOE) = total doses administered during the period (doses given plus doses omitted). Rate = (number of medication administration errors / total doses administered) x 100.",
    "unit": "%",
    "benchmarkValue": 0,
    "benchmark": "0% (zero-error target)",
    "benchmarkNote": "NCC-MERP: there is no acceptable incidence rate for medication errors; operational target is 0% with continual reduction toward zero. Some programmes benchmark against a < 5% threshold using the direct-observation method (Barker KN et al.).",
    "goalDirection": "lower_is_better",
    "reference": "NCC-MERP Index for Categorizing Medication Errors (2001, rev. 2022); Barker KN et al. — medication administration error direct-observation method",
    "referenceUrl": "https://www.nccmerp.org/statement-medication-error-rates"
  },
  "mandatory training compliance": {
    "canonicalName": "Mandatory Training Compliance",
    "formula": "pct",
    "numLabel": "Staff who completed required mandatory training",
    "denLabel": "Staff required to complete the training",
    "numeratorDef": "Number of staff who completed all assigned mandatory/statutory training (e.g., infection control, biomedical waste management, fire & emergency, patient safety, BLS) within the required cycle/timeframe.",
    "denominatorDef": "Total number of staff who were due/required to complete that mandatory training during the surveillance period.",
    "unit": "%",
    "benchmarkValue": 100,
    "benchmark": "≥ 100%",
    "benchmarkNote": "100% (target); high performers >= 90-95%",
    "goalDirection": "higher_is_better",
    "reference": "NABH Accreditation Standards for Hospitals - Human Resource Management (HRM) chapter (HRM.3 induction training, HRM.4 ongoing professional training & development, HRM.5 job-specific training, HRM.6 safety & quality training)",
    "referenceUrl": "https://nabh.co/hospitals/"
  },
  "bls certification rate": {
    "canonicalName": "BLS Certification Rate",
    "formula": "pct",
    "numLabel": "Clinical staff with current/valid BLS certification",
    "denLabel": "Clinical staff required to hold BLS certification",
    "numeratorDef": "Number of clinical (and other policy-designated) staff holding a current, non-expired Basic Life Support (BLS) certification (typically AHA BLS for Healthcare Providers, valid 2 years) at the measurement point.",
    "denominatorDef": "Total number of staff for whom BLS certification is mandated by role or hospital policy at the measurement point. Rate = (certified / required) x 100.",
    "unit": "%",
    "benchmarkValue": 100,
    "benchmark": "≥ 100%",
    "benchmarkNote": "100% of required clinical staff with valid BLS certification",
    "goalDirection": "higher_is_better",
    "reference": "American Heart Association (AHA) BLS Provider standards; NABH HRM (Human Resource Management) staff competency/credentialing requirements",
    "referenceUrl": "https://cpr.heart.org/en/cpr-courses-and-kits/healthcare-professional/basic-life-support-bls-training"
  },
  "induction completion within 30 days": {
    "canonicalName": "Induction Completion Within 30 Days",
    "formula": "pct",
    "numLabel": "New employees who completed induction within 30 days of joining",
    "denLabel": "New employees who joined in the period",
    "numeratorDef": "Number of new employees who completed their mandatory induction/orientation training within 30 days (one month) of their date of joining.",
    "denominatorDef": "Total number of new employees who joined during the surveillance period. Compliance % = (completed induction within 30 days / total new joiners) x 100.",
    "unit": "%",
    "benchmarkValue": 100,
    "benchmark": "≥ 100%",
    "benchmarkNote": "100% of new hires inducted within 30 days",
    "goalDirection": "higher_is_better",
    "reference": "NABH Accreditation Standards (Hospitals), Human Resource Management (HRM) - Standard HRM.3: staff are provided induction training at the time of joining; objective element requires induction within one month of joining (CORE)",
    "referenceUrl": "https://nabh.co/hospitals/"
  },
  "patient volume": {
    "canonicalName": "Patient Volume",
    "formula": "direct",
    "numLabel": "Number of patients",
    "denLabel": "Period",
    "numeratorDef": "Count of patients seen/treated/admitted during the reporting period (e.g., OPD visits, IP admissions, ED visits, or total patient encounters depending on the unit). A raw workload/census/throughput figure, not a quality rate.",
    "denominatorDef": "None - this is a direct count reported per period (day/month/quarter/year). Patient volume commonly serves as the denominator base (e.g., patient-days, admissions, encounters) for other rate-based indicators rather than having its own denominator.",
    "unit": "count",
    "benchmarkValue": 0,
    "benchmark": "0 — track & RCA every event",
    "benchmarkNote": "Not applicable - operational/workload volume metric monitored for trend and capacity planning; no authoritative clinical benchmark",
    "goalDirection": "higher_is_better",
    "reference": "Operational hospital statistics / NABH Hospital Accreditation Programme workload & utilization indicators (no external clinical surveillance standard)",
    "referenceUrl": "https://nabh.co/programmes/hospitals-accreditation-programme-hco/"
  },
  "door-to-balloon compliance (<=90 min)": {
    "canonicalName": "Door-to-Balloon Time <=90 min Compliance",
    "formula": "pct",
    "numLabel": "STEMI patients with primary PCI within 90 min",
    "denLabel": "STEMI patients receiving primary PCI",
    "numeratorDef": "Number of AMI/STEMI (ST-elevation or new LBBB on ECG closest to arrival) patients whose interval from hospital arrival (door) to first device deployment / balloon inflation during primary PCI is <= 90 minutes. Count each qualifying patient once.",
    "denominatorDef": "Number of AMI patients with ST-segment elevation or LBBB on the ECG closest to arrival who receive primary PCI as the reperfusion strategy during the hospital stay (CMS CMS53v7 / AMI-8a initial population: patients >=18 yr with STEMI undergoing primary PCI). Exclude transfers-in, fibrinolytic patients, and documented contraindication/delay reasons per measure spec.",
    "unit": "%",
    "benchmarkValue": 90,
    "benchmark": "≥ 90%",
    "benchmarkNote": ">= 90% of primary-PCI STEMI patients treated within 90 minutes (each individual case target door-to-balloon <= 90 min; ACC/AHA Class I). Original ACC D2B Alliance population goal was >=75%; high performers reach ~85-90%+.",
    "goalDirection": "higher_is_better",
    "reference": "CMS/Joint Commission measure CMS53v7 / AMI-8a 'Primary PCI Received Within 90 Minutes of Hospital Arrival' (NQF #0163); ACC/AHA STEMI guideline & performance measures",
    "referenceUrl": "https://ecqi.healthit.gov/ecqm/eh/2019/cms053v7"
  },
  "hand hygiene compliance": {
    "canonicalName": "Hand Hygiene Compliance - Overall",
    "formula": "pct",
    "numLabel": "Hand hygiene actions performed",
    "denLabel": "Hand hygiene opportunities observed",
    "numeratorDef": "Number of observed hand hygiene actions performed (rubbing hands with alcohol-based handrub OR washing with soap and water) when an opportunity occurs, counted across ALL healthcare worker categories via direct observation using the WHO 'My 5 Moments for Hand Hygiene' method.",
    "denominatorDef": "Total number of hand hygiene opportunities observed across ALL healthcare worker categories. An opportunity is defined by one or more of the WHO 5 Moments (before touching a patient; before clean/aseptic procedure; after body fluid exposure risk; after touching a patient; after touching patient surroundings). Several indications arising simultaneously count as a single opportunity.",
    "unit": "%",
    "benchmarkValue": 80,
    "benchmark": "≥ 80%",
    "benchmarkNote": ">= 80% compliance",
    "goalDirection": "higher_is_better",
    "reference": "WHO Guidelines on Hand Hygiene in Health Care (2009), 'My 5 Moments for Hand Hygiene' and WHO Hand Hygiene Technical Reference Manual; benchmark reflects a commonly used operational target (The Joint Commission no longer mandates a fixed numeric compliance percentage).",
    "referenceUrl": "https://www.ncbi.nlm.nih.gov/books/NBK144028/"
  },
  "hand hygiene compliance (hospital)": {
    "canonicalName": "Hand Hygiene Compliance - Overall",
    "formula": "pct",
    "numLabel": "Hand hygiene actions performed",
    "denLabel": "Hand hygiene opportunities observed",
    "numeratorDef": "Number of observed hand hygiene actions performed (rubbing hands with alcohol-based handrub OR washing with soap and water) when an opportunity occurs, counted across ALL healthcare worker categories via direct observation using the WHO 'My 5 Moments for Hand Hygiene' method.",
    "denominatorDef": "Total number of hand hygiene opportunities observed across ALL healthcare worker categories. An opportunity is defined by one or more of the WHO 5 Moments (before touching a patient; before clean/aseptic procedure; after body fluid exposure risk; after touching a patient; after touching patient surroundings). Several indications arising simultaneously count as a single opportunity.",
    "unit": "%",
    "benchmarkValue": 80,
    "benchmark": "≥ 80%",
    "benchmarkNote": ">= 80% compliance",
    "goalDirection": "higher_is_better",
    "reference": "WHO Guidelines on Hand Hygiene in Health Care (2009), 'My 5 Moments for Hand Hygiene' and WHO Hand Hygiene Technical Reference Manual; benchmark reflects a commonly used operational target (The Joint Commission no longer mandates a fixed numeric compliance percentage).",
    "referenceUrl": "https://www.ncbi.nlm.nih.gov/books/NBK144028/"
  },
  "intradialytic hypotension": {
    "canonicalName": "Intradialytic Hypotension Rate",
    "formula": "pct",
    "numLabel": "HD sessions with intradialytic hypotension",
    "denLabel": "Total HD sessions",
    "numeratorDef": "Number of hemodialysis sessions during which intradialytic hypotension occurred, defined per KDOQI as a decrease in systolic BP >= 20 mmHg (or a fall in mean arterial pressure >= 10 mmHg) associated with symptoms (e.g., cramps, nausea, dizziness, fainting) and requiring nursing intervention (e.g., stopping ultrafiltration and/or saline infusion)",
    "denominatorDef": "Total number of hemodialysis sessions delivered in the reporting period",
    "unit": "%",
    "benchmarkValue": 20,
    "benchmark": "≤ 20%",
    "benchmarkNote": "<= 20% of sessions (KDOQI background prevalence ~20-30%, about 25%; lower is better)",
    "goalDirection": "lower_is_better",
    "reference": "NKF KDOQI Clinical Practice Guidelines for Cardiovascular Disease in Dialysis Patients - Intradialytic Hypotension",
    "referenceUrl": "https://kidneyfoundation.cachefly.net/professionals/KDOQI/guidelines_cvd/intradialytic.htm"
  },
  "re-intubation within 48 hours (icu)": {
    "canonicalName": "Re-intubation Rate within 48 Hours (Extubation Failure)",
    "formula": "pct",
    "numLabel": "Re-intubations within 48h",
    "denLabel": "Planned extubations",
    "numeratorDef": "Number of patients requiring reintubation (or return to invasive mechanical ventilation via any invasive airway) within 48 hours of a planned extubation during the reporting period. This is 'extubation failure.' Reintubation following unplanned/accidental (self-)extubation, or reintubation for a new, unrelated surgical procedure, is typically excluded.",
    "denominatorDef": "Total number of planned (elective) extubations of mechanically ventilated patients performed during the reporting period. Each planned extubation event counts as one denominator unit.",
    "unit": "%",
    "benchmarkValue": 10,
    "benchmark": "≤ 10%",
    "benchmarkNote": "Acceptable/target extubation-failure rate ~5-10% of planned extubations (wider reasonable band 5-15%); commonly benchmarked at <=10%",
    "goalDirection": "lower_is_better",
    "reference": "Epstein SK. 'What is the optimal rate of failed extubation?' Critical Care 2012;16(1):111. Also supported by ATS/CHEST ventilator liberation guidance and standard critical-care weaning literature.",
    "referenceUrl": "https://pmc.ncbi.nlm.nih.gov/articles/PMC3396264/"
  },
  "vascular access complication": {
    "canonicalName": "Vascular Access Thrombosis Rate (AV Fistula/Graft)",
    "formula": "rate1000",
    "numLabel": "Access thrombosis events",
    "denLabel": "Access-days at risk",
    "numeratorDef": "Number of thrombosis events occurring in functioning AV fistulae/grafts during the period. (KDOQI benchmarks are defined for thrombosis specifically; a broader composite that also counts stenosis requiring intervention or access infection may be reported separately but is not directly comparable to the per-access-year thrombosis benchmark.)",
    "denominatorDef": "Cumulative access-days at risk (sum of days each functioning AV access is in use during the period). The native KDOQI metric is events per access-year (= access-days / 365); divide access-days by 365 to compare with the per-access-year benchmark.",
    "unit": "per 1000 access-days at risk",
    "benchmarkValue": 0.5,
    "benchmark": "≤ 0.5 per 1000 access-days at risk",
    "benchmarkNote": "<= 0.5 thrombosis events per access-year (~1.37 per 1000 access-days). AV grafts: baseline 0.5-0.8/graft-year, target 0.2-0.4/graft-year with surveillance; AV fistulae lower (~0.1-0.5/year).",
    "goalDirection": "lower_is_better",
    "reference": "NKF KDOQI Clinical Practice Guideline for Vascular Access: 2019 Update (Am J Kidney Dis. 2020;75(4)(suppl 2):S1-S164)",
    "referenceUrl": "https://www.ajkd.org/article/S0272-6386(19)31137-0/fulltext"
  },
  "average length of stay at the emergency department": {
    "canonicalName": "Average Length of Stay at the Emergency Department",
    "formula": "avg",
    "numLabel": "Total ED patient-hours",
    "denLabel": "Number of ED patient visits",
    "numeratorDef": "Sum of the length of stay of every patient managed in the Emergency Department during the month = Σ (time of departure/disposition from the ED − time of ED arrival or triage registration), expressed in hours. Include every disposition (discharged, admitted/transferred to a ward, referred out, LAMA/DAMA, death in ED).",
    "denominatorDef": "Total number of Emergency Department patient visits during the same month (every patient who arrived and was dispositioned) — the same visits whose stays are summed in the numerator.",
    "unit": "hours",
    "benchmarkValue": 4,
    "benchmark": "≤ 4 hours",
    "benchmarkNote": "Average ED length of stay = total ED patient-hours ÷ number of ED visits (a mean DURATION, not a percentage or a count). ≤ 4 hours total ED LOS is a widely used throughput target (e.g. the NHS A&E 4-hour standard); many hospitals set ≤ 4 h for discharged and ≤ 6 h for admitted patients. Adjust the benchmark and the unit (hours or minutes) to your hospital's agreed target.",
    "goalDirection": "lower_is_better",
    "reference": "CMS Hospital Outpatient Quality Reporting — ED Throughput (OP-18: median time from ED arrival to ED departure for discharged patients); NHS A&E 4-hour standard; ACEP ED crowding / boarding resources",
    "referenceUrl": "https://www.cms.gov/medicare/quality/hospital-outpatient-quality-reporting-program"
  }
};
// ED average-length-of-stay aliases → the SAME correction, so the fix lands regardless of the
// exact name the indicator was saved under (variants seen: with/without "the", "(ED)", dashes).
['average length of stay (emergency department)', 'average length of stay - emergency department', 'average length of stay in the emergency department', 'average length of stay at emergency department', 'average length of stay (ed)', 'average ed length of stay', 'ed average length of stay', 'emergency department average length of stay', 'average length of stay emergency department', 'ed alos', 'alos (ed)'].forEach(function (k) {
  window.QI_CORRECTIONS[k] = window.QI_CORRECTIONS['average length of stay at the emergency department'];
});
// Medication error rename (2026-07): indicators renamed "Medication Administration Error"
// keep resolving to the same correction as the legacy "Medication Error" name.
['medication administration error', 'medication administration error rate'].forEach(function (k) {
  window.QI_CORRECTIONS[k] = window.QI_CORRECTIONS['medication error'];
});
// In/Out Patient Fall split (2026-07): inpatient wards report "In Patient Fall", the
// Out-Patient Department reports "Out Patient Fall" — both inherit the patient-fall
// correction (formula/benchmark/defs) so the split names keep the enforced definition.
['in patient fall', 'inpatient fall', 'in-patient fall'].forEach(function (k) {
  window.QI_CORRECTIONS[k] = window.QI_CORRECTIONS['patient fall'];
});
['out patient fall', 'outpatient fall', 'out-patient fall'].forEach(function (k) {
  window.QI_CORRECTIONS[k] = Object.assign({}, window.QI_CORRECTIONS['patient fall'], {
    canonicalName: 'Out Patient Fall',
    denLabel: 'Out-patient visits',
    denominatorDef: 'Total number of out-patient visits during the reporting period. Rate = (falls ÷ out-patient visits) × 1,000.',
    unit: 'per 1000 out-patient visits',
    benchmark: '≤ 3.3 per 1000 out-patient visits',
    benchmarkNote: '<= 3.3 falls per 1000 out-patient visits (adapted from the NDNQI inpatient median; set your own out-patient target if agreed differently)',
  });
});
window.QI_CORRECTIONS_BY_DEFID = {
  "cauti": {
    "canonicalName": "Catheter-Associated Urinary Tract Infection (CAUTI) Rate",
    "formula": "rate1000",
    "numLabel": "CAUTIs",
    "denLabel": "Urinary catheter-days",
    "numeratorDef": "Number of CAUTI events meeting the NHSN UTI surveillance definition (symptomatic UTI/SUTI) in patients who had an indwelling urinary catheter in place for >2 consecutive days (day of catheter placement = Day 1) in an inpatient location on the date of event, with the catheter in place on that date or removed the day before. Count each qualifying event once.",
    "denominatorDef": "Total number of indwelling urinary catheter-days, obtained by counting, once each day at the same time each day during the surveillance month, the number of patients in the location with one or more indwelling urinary catheters, and summing these daily counts over the month (electronic counts allowed if validated to within 5% of manual counts).",
    "unit": "per 1000 catheter-days",
    "benchmarkValue": 1,
    "benchmark": "≤ 1 per 1000 catheter-days",
    "benchmarkNote": "NHSN primary benchmark is the SIR < 1.0 vs the NHSN baseline (fewer infections observed than predicted); pooled-mean CAUTI rate is roughly 1.0 per 1000 catheter-days but varies widely by unit type and is not an official fixed threshold",
    "goalDirection": "lower_is_better",
    "reference": "CDC NHSN Patient Safety Component Manual, Chapter 7: Urinary Tract Infection (CAUTI) Events; CDC NHSN SIR Guide (A Guide to the SIR)",
    "referenceUrl": "https://www.cdc.gov/nhsn/pdfs/pscmanual/7psccauticurrent.pdf"
  },
  "clabsi": {
    "canonicalName": "Central Line-Associated Bloodstream Infection (CLABSI) Rate",
    "formula": "rate1000",
    "numLabel": "CLABSIs",
    "denLabel": "Central line-days",
    "numeratorDef": "Number of laboratory-confirmed bloodstream infections (LCBI) meeting the NHSN CLABSI definition: a primary LCBI not secondary to an infection at another site, in a patient with an eligible central line in place for >2 consecutive calendar days (following first access in an inpatient location) on the date of event, with the line present on that date or removed the day before.",
    "denominatorDef": "Total number of central line-days, summed by counting the number of patients with one or more central lines in the location once each day at the same time each day during the surveillance month.",
    "unit": "per 1000 central line-days",
    "benchmarkValue": 1,
    "benchmark": "≤ 1 per 1000 central line-days",
    "benchmarkNote": "SIR < 1.0 vs NHSN baseline; pooled-mean CLABSI rate ~1.0 per 1000 central line-days (varies by unit type)",
    "goalDirection": "lower_is_better",
    "reference": "CDC NHSN Patient Safety Component Manual, Chapter 4: Bloodstream Infection Event (CLABSI); CDC NHSN SIR Guide",
    "referenceUrl": "https://www.cdc.gov/nhsn/pdfs/pscmanual/4psc_clabscurrent.pdf"
  },
  "vap": {
    "canonicalName": "Ventilator-Associated Pneumonia (VAP) Rate",
    "formula": "rate1000",
    "numLabel": "VAP events",
    "denLabel": "Ventilator-days",
    "numeratorDef": "Number of pneumonia events meeting the NHSN PNEU/VAP surveillance criteria in a patient who was on mechanical ventilation with the ventilator in place on the date of event or the day before. (Note: the NHSN PNEU/VAP definition has NO minimum ventilation-duration requirement; the '>2 consecutive ventilator-days' rule belongs to the separate VAE algorithm, not to VAP/PNEU. For adult and pediatric inpatient locations NHSN replaced in-plan VAP surveillance with the VAE algorithm in January 2013 [PedVAE for pediatric locations]; the PNEU/VAP protocol remains available for in-plan PedVAP surveillance in pediatric locations and off-plan PNEU surveillance in any inpatient location, including neonatal.)",
    "denominatorDef": "Total number of ventilator-days, summed by counting the number of patients on mechanical ventilation in the location once each day at the same time each day during the surveillance month.",
    "unit": "per 1000 ventilator-days",
    "benchmarkValue": 1,
    "benchmark": "≤ 1 per 1000 ventilator-days",
    "benchmarkNote": "No single fixed target; aim toward 0. Historical NHSN pooled-mean VAP rates ~1-2 per 1000 ventilator-days depending on unit type",
    "goalDirection": "lower_is_better",
    "reference": "CDC NHSN Patient Safety Component Manual, Chapter 6: Pneumonia (Ventilator-associated [VAP] and non-ventilator-associated [PNEU]) Event",
    "referenceUrl": "https://www.cdc.gov/nhsn/pdfs/pscmanual/6pscvapcurrent.pdf"
  },
  "vae": {
    "canonicalName": "Ventilator-Associated Event (VAE) Rate",
    "formula": "rate1000",
    "numLabel": "VAE events (VAC/IVAC/PVAP)",
    "denLabel": "Ventilator-days",
    "numeratorDef": "Number of Ventilator-Associated Events meeting the NHSN VAE algorithm tiers — Ventilator-Associated Condition (VAC), Infection-related Ventilator-Associated Complication (IVAC), and Possible VAP (PVAP) — identified in adult patients (>=18 years) mechanically ventilated for >2 calendar days, triggered by a sustained increase (>=2 calendar days) in daily minimum FiO2 (increase >=0.20) or PEEP (increase >=3 cmH2O) after a baseline period of >=2 days of stability or improvement. Each event counted once; rates may be reported by tier.",
    "denominatorDef": "Total number of ventilator-days, summed by counting the number of patients on mechanical ventilation in the location once each day at the same time each day during the surveillance month (eligible adult inpatient locations); only the monthly total is entered into NHSN.",
    "unit": "per 1000 ventilator-days",
    "benchmarkValue": 1,
    "benchmark": "≤ 1 per 1000 ventilator-days",
    "benchmarkNote": "SIR < 1.0 vs NHSN baseline (observed/predicted; SIR not computed when predicted <1.0); aim toward 0. Pooled VAC/IVAC raw rates vary widely (~3-17 per 1000 ventilator-days) by setting.",
    "goalDirection": "lower_is_better",
    "reference": "CDC NHSN Patient Safety Component Manual, Chapter 10: Ventilator-Associated Event (VAE) Protocol",
    "referenceUrl": "https://www.cdc.gov/nhsn/pdfs/pscmanual/10-vae_final.pdf"
  },
  "ssirate": {
    "canonicalName": "Surgical Site Infection (SSI) Rate",
    "formula": "pct",
    "numLabel": "Number of SSIs",
    "denLabel": "Number of operative procedures",
    "numeratorDef": "Count of surgical site infections (superficial incisional, deep incisional, or organ/space) detected through routine surveillance within the applicable NHSN surveillance period for the procedure category (a 30- or 90-day period determined by the NHSN operative procedure CATEGORY and the tissue level/depth of the SSI event, per the 2013+ definitions — note this is no longer based on implant presence). Include SSIs identified during admission, on readmission, and via post-discharge surveillance. Each procedure-related SSI is counted once per NHSN protocol.",
    "denominatorDef": "Total number of NHSN operative procedures of that category performed during the same period (each trip to the OR meeting the NHSN procedure-code definition counts as one procedure), applying standard NHSN exclusion criteria. SSI rate = (SSIs / procedures) x 100. NHSN also risk-adjusts via the Standardized Infection Ratio (SIR = observed/predicted SSIs), with target SIR < 1.0.",
    "unit": "%",
    "benchmarkValue": 2,
    "benchmark": "≤ 2%",
    "benchmarkNote": "<= 2% per 100 procedures (procedure-dependent; NHSN risk-adjusted target SIR < 1.0)",
    "goalDirection": "lower_is_better",
    "reference": "CDC NHSN Patient Safety Component — Surgical Site Infection (SSI) Event protocol; WHO Global Guidelines for the Prevention of SSI",
    "referenceUrl": "https://www.cdc.gov/nhsn/psc/ssi/index.html"
  },
  "hai": {
    "canonicalName": "Healthcare-Associated Infection (HAI) Rate",
    "formula": "rate1000",
    "numLabel": "HAI events",
    "denLabel": "Patient-days (or device-days)",
    "numeratorDef": "Number of healthcare-associated infections meeting the applicable NHSN site-specific surveillance definition during the surveillance period, where the date of event occurs on or after the 3rd calendar day of admission to an inpatient location (day of admission = calendar day 1), i.e., not present or incubating on admission. For device-associated infections use the corresponding device-day denominator; for overall HAI surveillance use patient-days.",
    "denominatorDef": "Total patient-days for overall HAI rates (sum of the daily census over the surveillance month), or the relevant device-days for device-associated infection rates, counted once per patient per day at a consistent time each day.",
    "unit": "per 1000 patient-days",
    "benchmarkValue": 5,
    "benchmark": "≤ 5 per 1000 patient-days",
    "benchmarkNote": "Lower is better; no universal fixed target. NHSN's authoritative benchmark is the Standardized Infection Ratio (SIR = observed/expected vs. risk-adjusted national baseline, target < 1.0), not a fixed rate. Overall HAI incidence is indicatively ~2-5 per 1000 patient-days and should trend downward facility-wide.",
    "goalDirection": "lower_is_better",
    "reference": "CDC NHSN Patient Safety Component Manual, Chapter 2 (Identifying HAIs in NHSN / Present on Admission vs HAI); WHO Guidelines on Core Components of IPC Programmes",
    "referenceUrl": "https://www.cdc.gov/nhsn/pdfs/pscmanual/2psc_identifyinghais_nhsncurrent.pdf"
  },
  "fall": {
    "canonicalName": "Patient Falls (Total Fall Rate)",
    "formula": "rate1000",
    "numLabel": "Number of patient falls",
    "denLabel": "Patient-days",
    "numeratorDef": "Total number of patient falls (with or without injury, whether or not assisted by a staff member) occurring on the eligible reporting unit during the calendar month. A fall = an unplanned descent to the floor (or extension of the floor, e.g., trash can or other equipment) with or without injury. Includes assisted falls and falls in which the patient was found on the floor. Count each fall event; a patient who falls more than once is counted each time.",
    "denominatorDef": "Total patient-days for the eligible reporting unit during the same calendar month. Patient-days = sum of the daily inpatient census (typically counted at a consistent time each day, e.g., midnight) over the reporting period. Multiply the falls/patient-day ratio by 1000.",
    "unit": "per 1000 patient-days",
    "benchmarkValue": 3.3,
    "benchmark": "≤ 3.3 per 1000 patient-days",
    "benchmarkNote": "<= 3.3 falls per 1000 patient-days (NDNQI national median; lower is better)",
    "goalDirection": "lower_is_better",
    "reference": "National Database of Nursing Quality Indicators (NDNQI), a Press Ganey solution (measure copyrighted by the American Nurses Association); NQF/CBE #0141 Patient Fall Rate, a nursing-sensitive indicator (now maintained under the Partnership for Quality Measurement / Battelle CBE framework)",
    "referenceUrl": "https://p4qm.org/measures/0141"
  },
  "hapu": {
    "canonicalName": "Hospital-Acquired Pressure Ulcer (HAPU) Incidence Rate",
    "formula": "rate1000",
    "numLabel": "Patients who developed ≥ 1 HAPU (Stage 2+)",
    "denLabel": "Patient-days",
    "numeratorDef": "Number of patients who developed one or more NEW hospital-acquired (nosocomial) pressure ulcers of Stage 2 or greater (including Stage 2, Stage 3, Stage 4, unstageable, and deep tissue injury) per NPIAP staging during the reporting period. Hospital-acquired = not present on admission; identified on/after the assessment that follows admission. A patient is counted once regardless of the number of ulcers.",
    "denominatorDef": "Total number of patient-days for the same unit and period, obtained by summing the daily inpatient census over the month. Rate = (patients who developed ≥ 1 HAPU ÷ total patient-days) × 1,000.",
    "unit": "per 1000 patient-days",
    "benchmarkValue": 0.75,
    "benchmark": "≤ 0.75 per 1000 patient-days",
    "benchmarkNote": "HAPU incidence rate = (patients with ≥ 1 new hospital-acquired pressure ulcer ÷ patient-days) × 1,000 — the standard for ongoing internal clinical quality tracking. < 0.75 per 1000 patient-days is the commonly used NDNQI-derived benchmark (lower is better; aspirational target 0). Note: the one-day prevalence survey (~≤ 3.6% of patients surveyed, NDNQI) is a DIFFERENT metric — do not mix the two.",
    "goalDirection": "lower_is_better",
    "reference": "National Database of Nursing Quality Indicators (NDNQI) Pressure Injury Incidence; AHRQ Preventing Pressure Ulcers in Hospitals Toolkit (incidence & prevalence measurement); NPIAP (formerly NPUAP/EPUAP) International Pressure Injury Staging",
    "referenceUrl": "https://www.ahrq.gov/patient-safety/settings/hospital/resource/pressureulcer/tool/put5.html"
  },
  "phlebitis": {
    "canonicalName": "Phlebitis rate (peripheral IV)",
    "formula": "pct",
    "numLabel": "Phlebitis events",
    "denLabel": "Peripheral IV catheters",
    "numeratorDef": "Number of peripheral intravenous (PIV) catheters that developed phlebitis (typically Visual Infusion Phlebitis [VIP] score >=2, i.e. pain plus erythema and/or induration/swelling along the vein) during the surveillance period. Count each affected catheter once.",
    "denominatorDef": "Total number of peripheral IV catheters in place / inserted during the same surveillance period.",
    "unit": "%",
    "benchmarkValue": 5,
    "benchmark": "≤ 5%",
    "benchmarkNote": "<= 5% of peripheral IV catheters",
    "goalDirection": "lower_is_better",
    "reference": "Infusion Nurses Society (INS), Infusion Therapy Standards of Practice (8th ed., 2021), Journal of Infusion Nursing 44(1S):S1-S224 - Phlebitis standard",
    "referenceUrl": "https://www.ins1.org/wp-content/uploads/2021/07/JIN-D-21-00031_SOP-Update-Hi-resWithout_Folio-7.13.21.pdf"
  },
  "mederror": {
    "canonicalName": "Medication Administration Error Rate",
    "formula": "pct",
    "numLabel": "Number of medication administration errors",
    "denLabel": "Total doses administered (opportunities for error)",
    "numeratorDef": "Number of medication administration errors: doses given incorrectly at the administration stage per the NCC-MERP definition (wrong drug, wrong dose, wrong route, wrong time/rate, wrong patient, wrong preparation/technique, or an omitted / unauthorised dose), detected by direct observation or incident report.",
    "denominatorDef": "Total Opportunities for Error (TOE) = total doses administered during the period (doses given plus doses omitted). Rate = (number of medication administration errors / total doses administered) x 100.",
    "unit": "%",
    "benchmarkValue": 0,
    "benchmark": "0% (zero-error target)",
    "benchmarkNote": "NCC-MERP: there is no acceptable incidence rate for medication errors; operational target is 0% with continual reduction toward zero. Some programmes benchmark against a < 5% threshold using the direct-observation method (Barker KN et al.).",
    "goalDirection": "lower_is_better",
    "reference": "NCC-MERP Index for Categorizing Medication Errors (2001, rev. 2022); Barker KN et al. — medication administration error direct-observation method",
    "referenceUrl": "https://www.nccmerp.org/statement-medication-error-rates"
  },
  "nsi": {
    "canonicalName": "Needle Stick / Sharps Injury Rate",
    "formula": "rate100",
    "numLabel": "Number of NSI cases",
    "denLabel": "Total healthcare workers",
    "denAdminOnly": true,
    "victimField": true,
    "numeratorDef": "Count every reported needlestick / sharps (NSI) injury sustained by a healthcare worker during the month; log each case with its injured staff member (victim). Data collectors enter only the NSI cases (one per incident) — they do NOT enter the denominator.",
    "denominatorDef": "Total number of healthcare workers at risk (the hospital's staff headcount). This is a fixed figure set by the ADMINISTRATOR (not by data collectors). Rate = (NSI cases / total healthcare workers) x 100.",
    "unit": "per 100 healthcare workers",
    "benchmarkValue": 2,
    "benchmark": "≤ 2 per 100 FTE per year",
    "benchmarkNote": "<= 2.0 injuries per 100 FTE per year (US national EXPO-S.T.O.P./EPINet benchmark; rate has held near 1.9-2.0 since 2021); aspirational target 0. Note: nurse-specific rates run higher (~4-5 per 100 FTE).",
    "goalDirection": "lower_is_better",
    "reference": "AOHP EXPO-S.T.O.P. national survey (Grimmond/Good); International Safety Center EPINet (Exposure Prevention Information Network); OSHA Bloodborne Pathogens Standard 29 CFR 1910.1030.",
    "referenceUrl": "https://internationalsafetycenter.org/exposure-data-network-epinet/"
  },
  "reintubation": {
    "canonicalName": "Re-intubation Rate within 48 Hours (Extubation Failure)",
    "formula": "pct",
    "numLabel": "Re-intubations within 48h",
    "denLabel": "Planned extubations",
    "numeratorDef": "Number of patients requiring reintubation (or return to invasive mechanical ventilation via any invasive airway) within 48 hours of a planned extubation during the reporting period. This is 'extubation failure.' Reintubation following unplanned/accidental (self-)extubation, or reintubation for a new, unrelated surgical procedure, is typically excluded.",
    "denominatorDef": "Total number of planned (elective) extubations of mechanically ventilated patients performed during the reporting period. Each planned extubation event counts as one denominator unit.",
    "unit": "%",
    "benchmarkValue": 10,
    "benchmark": "≤ 10%",
    "benchmarkNote": "Acceptable/target extubation-failure rate ~5-10% of planned extubations (wider reasonable band 5-15%); commonly benchmarked at <=10%",
    "goalDirection": "lower_is_better",
    "reference": "Epstein SK. 'What is the optimal rate of failed extubation?' Critical Care 2012;16(1):111. Also supported by ATS/CHEST ventilator liberation guidance and standard critical-care weaning literature.",
    "referenceUrl": "https://pmc.ncbi.nlm.nih.gov/articles/PMC3396264/"
  },
  "readmission": {
    "canonicalName": "ICU Readmission Rate within 48 Hours",
    "formula": "pct",
    "numLabel": "ICU readmissions within 48h",
    "denLabel": "ICU discharges/transfers",
    "numeratorDef": "Number of patients readmitted to (returned to) the ICU within 48 hours of being discharged or transferred out of the ICU to a lower level of care (ward/step-down) during the reporting period. Count each unplanned return; planned/scheduled returns (e.g., staged post-operative ICU admissions) are typically excluded. A patient is counted once per qualifying readmission event.",
    "denominatorDef": "Total number of patients discharged or transferred alive from the ICU to a lower level of care (ward/step-down) during the reporting period (the population at risk of returning). ICU deaths and patients discharged directly home or to another facility (not at risk of ICU return) are excluded from the at-risk denominator.",
    "unit": "%",
    "benchmarkValue": 4,
    "benchmark": "≤ 4%",
    "benchmarkNote": "<= 4% of ICU discharges (soft target; no single hard accreditation threshold). The 48h subset typically runs ~2-2.5%; all-cause/longer-window readmission ~6-7%. Reported rates vary widely (~1.7% up to ~15% when unexpected death is bundled in) by case-mix and discharge policy.",
    "goalDirection": "lower_is_better",
    "reference": "Society of Critical Care Medicine (SCCM) Quality Indicators Committee (48h ICU readmission listed as a performance indicator); Woldhek AL et al., 'Readmission of ICU patients: A quality indicator?', J Crit Care 2017;38:328-334",
    "referenceUrl": "https://pubmed.ncbi.nlm.nih.gov/27939901/"
  },
  "handhygiene": {
    "canonicalName": "Hand Hygiene Compliance - Overall",
    "formula": "pct",
    "numLabel": "Hand hygiene actions performed",
    "denLabel": "Hand hygiene opportunities observed",
    "numeratorDef": "Number of observed hand hygiene actions performed (rubbing hands with alcohol-based handrub OR washing with soap and water) when an opportunity occurs, counted across ALL healthcare worker categories via direct observation using the WHO 'My 5 Moments for Hand Hygiene' method.",
    "denominatorDef": "Total number of hand hygiene opportunities observed across ALL healthcare worker categories. An opportunity is defined by one or more of the WHO 5 Moments (before touching a patient; before clean/aseptic procedure; after body fluid exposure risk; after touching a patient; after touching patient surroundings). Several indications arising simultaneously count as a single opportunity.",
    "unit": "%",
    "benchmarkValue": 80,
    "benchmark": "≥ 80%",
    "benchmarkNote": ">= 80% compliance",
    "goalDirection": "higher_is_better",
    "reference": "WHO Guidelines on Hand Hygiene in Health Care (2009), 'My 5 Moments for Hand Hygiene' and WHO Hand Hygiene Technical Reference Manual; benchmark reflects a commonly used operational target (The Joint Commission no longer mandates a fixed numeric compliance percentage).",
    "referenceUrl": "https://www.ncbi.nlm.nih.gov/books/NBK144028/"
  },
  "d2b": {
    "canonicalName": "Door-to-Balloon Time <=90 min Compliance",
    "formula": "pct",
    "numLabel": "STEMI patients with primary PCI within 90 min",
    "denLabel": "STEMI patients receiving primary PCI",
    "numeratorDef": "Number of AMI/STEMI (ST-elevation or new LBBB on ECG closest to arrival) patients whose interval from hospital arrival (door) to first device deployment / balloon inflation during primary PCI is <= 90 minutes. Count each qualifying patient once.",
    "denominatorDef": "Number of AMI patients with ST-segment elevation or LBBB on the ECG closest to arrival who receive primary PCI as the reperfusion strategy during the hospital stay (CMS CMS53v7 / AMI-8a initial population: patients >=18 yr with STEMI undergoing primary PCI). Exclude transfers-in, fibrinolytic patients, and documented contraindication/delay reasons per measure spec.",
    "unit": "%",
    "benchmarkValue": 90,
    "benchmark": "≥ 90%",
    "benchmarkNote": ">= 90% of primary-PCI STEMI patients treated within 90 minutes (each individual case target door-to-balloon <= 90 min; ACC/AHA Class I). Original ACC D2B Alliance population goal was >=75%; high performers reach ~85-90%+.",
    "goalDirection": "higher_is_better",
    "reference": "CMS/Joint Commission measure CMS53v7 / AMI-8a 'Primary PCI Received Within 90 Minutes of Hospital Arrival' (NQF #0163); ACC/AHA STEMI guideline & performance measures",
    "referenceUrl": "https://ecqi.healthit.gov/ecqm/eh/2019/cms053v7"
  },
  "dialysisadequacy": {
    "canonicalName": "Dialysis Adequacy (URR)",
    "formula": "pct",
    "numLabel": "Pre-BUN minus post-BUN",
    "denLabel": "Pre-dialysis BUN",
    "numeratorDef": "(Pre-dialysis BUN minus post-dialysis BUN) for the treatment session; equivalently, count of HD patients meeting the adequacy target when reporting facility compliance",
    "denominatorDef": "Pre-dialysis BUN drawn immediately before the session (post-BUN drawn per the slow-flow/stop-pump technique); for facility reporting, total HD patients with a measured URR in the period",
    "unit": "%",
    "benchmarkValue": 65,
    "benchmark": "≥ 65%",
    "benchmarkNote": ">= 65% minimum (target > 70%); equivalent to spKt/V minimum 1.2, target 1.4 for thrice-weekly HD",
    "goalDirection": "higher_is_better",
    "reference": "NKF KDOQI Clinical Practice Guideline for Hemodialysis Adequacy: 2015 Update",
    "referenceUrl": "https://www.ajkd.org/article/S0272-6386(15)01019-7/fulltext"
  },
  "idh": {
    "canonicalName": "Intradialytic Hypotension Rate",
    "formula": "pct",
    "numLabel": "HD sessions with intradialytic hypotension",
    "denLabel": "Total HD sessions",
    "numeratorDef": "Number of hemodialysis sessions during which intradialytic hypotension occurred, defined per KDOQI as a decrease in systolic BP >= 20 mmHg (or a fall in mean arterial pressure >= 10 mmHg) associated with symptoms (e.g., cramps, nausea, dizziness, fainting) and requiring nursing intervention (e.g., stopping ultrafiltration and/or saline infusion)",
    "denominatorDef": "Total number of hemodialysis sessions delivered in the reporting period",
    "unit": "%",
    "benchmarkValue": 20,
    "benchmark": "≤ 20%",
    "benchmarkNote": "<= 20% of sessions (KDOQI background prevalence ~20-30%, about 25%; lower is better)",
    "goalDirection": "lower_is_better",
    "reference": "NKF KDOQI Clinical Practice Guidelines for Cardiovascular Disease in Dialysis Patients - Intradialytic Hypotension",
    "referenceUrl": "https://kidneyfoundation.cachefly.net/professionals/KDOQI/guidelines_cvd/intradialytic.htm"
  },
  "fhr": {
    "canonicalName": "Intrapartum Fetal Heart Rate Monitoring Compliance",
    "formula": "pct",
    "numLabel": "Labours with FHR monitored & documented per protocol",
    "denLabel": "Labours requiring intrapartum FHR monitoring",
    "numeratorDef": "Number of monitored labours in which intrapartum fetal heart rate was assessed and documented at the protocol-required frequency and method (e.g. intermittent auscultation immediately after a palpated contraction for >=1 minute, at least every 15 minutes in established first stage and at least every 5 minutes in second stage for low-risk women, or continuous CTG when antenatal/intrapartum risk factors are present). Counted by chart/partogram audit as fully compliant only when all required FHR entries are present at the required interval and method. State whether scoring per labour or per assessment opportunity and keep it consistent.",
    "denominatorDef": "Total number of labours audited that required intrapartum fetal heart rate monitoring during the period (eligible labours). If scoring at the observation level, the denominator is instead the total number of required FHR-assessment opportunities; choose one level and apply it consistently across the numerator and denominator.",
    "unit": "%",
    "benchmarkValue": 100,
    "benchmark": "≥ 100%",
    "benchmarkNote": "Target 100% (full compliance); >=90% commonly used as an interim audit threshold",
    "goalDirection": "higher_is_better",
    "reference": "NICE NG229 Fetal monitoring in labour (2022); FIGO consensus guidelines on intrapartum fetal monitoring (2015); ACOG Clinical Practice Guideline No. 10: Intrapartum Fetal Heart Rate Monitoring: Interpretation and Management (Oct 2025), which replaces the retired Practice Bulletins No. 106 (2009) and No. 116 (2010)",
    "referenceUrl": "https://www.nice.org.uk/guidance/ng229/chapter/Recommendations"
  },
  "bls": {
    "canonicalName": "BLS Certification Rate",
    "formula": "pct",
    "numLabel": "Clinical staff with current/valid BLS certification",
    "denLabel": "Clinical staff required to hold BLS certification",
    "numeratorDef": "Number of clinical (and other policy-designated) staff holding a current, non-expired Basic Life Support (BLS) certification (typically AHA BLS for Healthcare Providers, valid 2 years) at the measurement point.",
    "denominatorDef": "Total number of staff for whom BLS certification is mandated by role or hospital policy at the measurement point. Rate = (certified / required) x 100.",
    "unit": "%",
    "benchmarkValue": 100,
    "benchmark": "≥ 100%",
    "benchmarkNote": "100% of required clinical staff with valid BLS certification",
    "goalDirection": "higher_is_better",
    "reference": "American Heart Association (AHA) BLS Provider standards; NABH HRM (Human Resource Management) staff competency/credentialing requirements",
    "referenceUrl": "https://cpr.heart.org/en/cpr-courses-and-kits/healthcare-professional/basic-life-support-bls-training"
  },
  "codeblue": {
    "canonicalName": "Cardiac Arrest (Code Blue) Events",
    "formula": "count",
    "numLabel": "Number of cardiac arrest (code blue) events",
    "denLabel": "",
    "numeratorDef": "Count of in-hospital cardiac arrest events (pulselessness requiring chest compressions and/or defibrillation, i.e. a resuscitation/code-blue activation) occurring during the reporting period, per AHA Get With The Guidelines-Resuscitation event definition. Excludes patients with an existing do-not-resuscitate order who did not receive CPR. Tally each qualifying arrest event.",
    "denominatorDef": "",
    "unit": "count",
    "benchmarkValue": 0,
    "benchmark": "0 — track & RCA every event",
    "benchmarkNote": "No fixed external benchmark; tracked as an absolute event count and trended internally (lower is better). For context, published IHCA incidence is often normalized to roughly 1-10 per 1000 admissions, but the registry sets no fixed threshold.",
    "goalDirection": "lower_is_better",
    "reference": "American Heart Association Get With The Guidelines-Resuscitation (in-hospital cardiac arrest registry; cardiac arrest defined as pulselessness requiring chest compression and/or defibrillation)",
    "referenceUrl": "https://www.heart.org/en/professional/quality-improvement/get-with-the-guidelines/get-with-the-guidelines-resuscitation"
  },
  "rosc": {
    "canonicalName": "Cardiac Arrest Survival to Discharge Rate",
    "formula": "pct",
    "numLabel": "Cardiac arrest patients surviving to hospital discharge",
    "denLabel": "Patients with an in-hospital cardiac arrest with attempted resuscitation",
    "numeratorDef": "Number of in-hospital cardiac arrest patients who survived to hospital discharge (alive at discharge) following resuscitation. Count each patient once per index arrest.",
    "denominatorDef": "Number of patients who had an in-hospital cardiac arrest (pulseless event requiring chest compressions and/or defibrillation) with an attempted resuscitation during the reporting period (GWTG-Resuscitation index-event population; excludes patients with pre-existing do-not-resuscitate orders).",
    "unit": "%",
    "benchmarkValue": 25,
    "benchmark": "≥ 25%",
    "benchmarkNote": "Higher is better; AHA GWTG-R contemporary adult IHCA survival-to-discharge ~24% (benchmark ~25%)",
    "goalDirection": "higher_is_better",
    "reference": "American Heart Association Get With The Guidelines-Resuscitation; AHA Heart Disease & Stroke Statistics / 2025 ECC Guidelines",
    "referenceUrl": "https://www.ahajournals.org/doi/10.1161/CIR.0000000000001372"
  }
};

;
/* ===== quality-corrections-apply.js ===== */
/* UNICO — swap the code-bundled QI_CORRECTIONS for the DB-backed master.
 *
 * The server (web.js) injects window.__UNICO_QI_CORRECTIONS__ (the qualityFormulas
 * collection expanded to the by-indicator-name shape) into the page BEFORE the
 * bundle runs. This module — loaded right AFTER quality-corrections.js and BEFORE
 * quality-store.js in the bundle — makes that DB master win over the static
 * fallback, so editing one formula row in the Formula Library applies everywhere.
 * When the inject is absent (dev/in-memory, DB down, or the desktop build) the
 * static window.QI_CORRECTIONS from quality-corrections.js is left in place.
 */
(function () {
  try {
    if (typeof window === 'undefined') return;
    var db = window.__UNICO_QI_CORRECTIONS__;
    if (db && typeof db === 'object' && Object.keys(db).length) {
      window.QI_CORRECTIONS = db;
    }
  } catch (e) { /* keep the static fallback */ }
})();

;
/* ===== quality-store.js ===== */
/* UNICO — Quality Indicators editable overlay store.
   Merges the read-only QUALITY_SEED with user edits saved in localStorage so the
   entire Quality module (dashboard, department detail, entry, CAPA, exports) reads
   ONE connected, editable dataset.

   The merged objects keep the exact shape of QUALITY_SEED entries, so existing
   readers work unchanged once pointed at qualityData()/useQualityStore().

   Persistence: localStorage 'unico_quality_v2' (auto-mirrored to disk by preload).
   (v2: reset for the NQI monthly dataset; any stale v1 overlay is ignored.) */
(function () {
  const KEY = 'unico_quality_v2';
  const QS = ['Q1', 'Q2', 'Q3', 'Q4'];

  // Canonical quarter <-> month mapping — the NQI report's 12-month fiscal year
  // Jun-2025 … May-2026, three months per quarter (matches quality.jsx QMONTHS).
  const QUARTER_MONTHS = {
    Q1: ['Jun-25', 'Jul-25', 'Aug-25'],
    Q2: ['Sep-25', 'Oct-25', 'Nov-25'],
    Q3: ['Dec-25', 'Jan-26', 'Feb-26'],
    Q4: ['Mar-26', 'Apr-26', 'May-26'],
  };
  const MONTH_QUARTER = {};
  Object.keys(QUARTER_MONTHS).forEach(q => QUARTER_MONTHS[q].forEach(m => { MONTH_QUARTER[m] = q; }));

  // Fiscal-year (Jun–May) helpers so quarters can be rolled up PER YEAR, not just for the
  // hardcoded 2025-26 above. A month's quarter depends only on its month name, so any year works.
  // Per-year quarter rollups (quartersByFy) follow the CALENDAR reporting year the console uses:
  // year N = Jan…Dec of N, Q1 = Jan–Mar. (The flat legacy `quarters` above stays as it was.)
  const FY_MONS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function fyOfKeyS(key){ const p = String(key||'').split('-'); const mi = FY_MONS.indexOf(p[0]); const yy = parseInt(p[1],10); if(mi<0||isNaN(yy)) return null; return 2000+yy; }
  function fyQuarterMonths(startYear){ const yy=String(startYear%100).padStart(2,'0'); return { Q1:['Jan-'+yy,'Feb-'+yy,'Mar-'+yy], Q2:['Apr-'+yy,'May-'+yy,'Jun-'+yy], Q3:['Jul-'+yy,'Aug-'+yy,'Sep-'+yy], Q4:['Oct-'+yy,'Nov-'+yy,'Dec-'+yy] }; }
  function fysInInd(ind){ const set=new Set(); ['months','mNum','mDen'].forEach(f=>{ const o=ind && ind[f]; if(o) Object.keys(o).forEach(k=>{ if(o[k]!=null&&o[k]!==''){ const fy=fyOfKeyS(k); if(fy!=null) set.add(fy); } }); }); return [...set]; }

  function isPct(ind) {
    const t = ((ind && ind.valueType) || '').toString().toLowerCase();
    return t.indexOf('%') >= 0 || t.startsWith('per');
  }

  // Roll a quarter up from its months when monthly data is present; else undefined
  // (meaning: use the directly-entered quarter value).
  function rollupQuarter(ind, q) {
    const months = (ind && ind.months) || {};
    const ms = QUARTER_MONTHS[q] || [];
    const vals = ms.map(m => months[m]).filter(v => v != null && v !== '');
    if (!vals.length) return undefined;
    const nums = vals.map(Number);
    if (isPct(ind)) return Math.round((nums.reduce((s, x) => s + x, 0) / nums.length) * 100) / 100;
    return nums.reduce((s, x) => s + x, 0);
  }

  // Compute {Q1..Q4} for an explicit quarter->months map, from MONTHLY data only. Used to build
  // per-fiscal-year quarter rollups. Mirrors the formula/direct logic in mergeIndicator.
  function computeQuartersFor(ind, QM) {
    const f = ind.formula; const out = {};
    if (f && f !== 'direct') {
      const needDen = f !== 'count';
      Object.keys(QM).forEach(q => {
        const ms = QM[q] || [];
        const have = ms.some(m => ind.mNum && ind.mNum[m] != null && ind.mNum[m] !== '' && (!needDen || (ind.mDen && ind.mDen[m] != null && ind.mDen[m] !== '')));
        let v = null;
        if (have) {
          const num = ms.reduce((s, m) => s + (Number((ind.mNum || {})[m]) || 0), 0);
          const den = ms.reduce((s, m) => s + (Number((ind.mDen || {})[m]) || 0), 0);
          v = (needDen && !den) ? null : qiFormulaCompute(f, num, den);
        }
        if (v == null) {
          // Approved zero-event / denominator-less readings store their computed value
          // in months{} — roll those up (mean for rates/%, sum for counts) so a quarter
          // of "0 events" reads as 0 on benchmark instead of not-reported.
          const vals = ms.map(m => (ind.months || {})[m]).filter(x => x != null && x !== '').map(Number);
          if (vals.length) v = f === 'count' ? vals.reduce((s, x) => s + x, 0) : Math.round((vals.reduce((s, x) => s + x, 0) / vals.length) * 100) / 100;
        }
        if (v != null) out[q] = v;
      });
    } else {
      const months = ind.months || {};
      Object.keys(QM).forEach(q => {
        const vals = (QM[q] || []).map(m => months[m]).filter(v => v != null && v !== '').map(Number);
        if (!vals.length) return;
        out[q] = isPct(ind) ? Math.round((vals.reduce((s, x) => s + x, 0) / vals.length) * 100) / 100 : vals.reduce((s, x) => s + x, 0);
      });
    }
    return out;
  }

  function loadOverlay() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      return (s && typeof s === 'object' && s.depts) ? s : { depts: {} };
    } catch (e) { return { depts: {} }; }
  }
  function saveOverlay(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { } }

  // Formula-based value: count = numerator; rate1000/rate100/pct = num/den × mult;
  // avg = num/den (mean, no multiplier).
  function qiFormulaCompute(formula, num, den) {
    const n = Number(num) || 0, d = Number(den) || 0;
    if (formula === 'count') return n;
    if (!d) return 0;
    if (formula === 'rate1000') return Math.round((n / d) * 1000 * 100) / 100;
    // mean / average = numerator ÷ denominator (no multiplier), e.g. average length of stay
    // = total patient-hours ÷ number of patients. Quarter roll-ups sum num & den first, so
    // this yields the opportunity-weighted average, not a mean-of-means.
    if (formula === 'avg') return Math.round((n / d) * 100) / 100;
    return Math.round((n / d) * 100 * 100) / 100; // rate100 / pct
  }

  // Object-valued indicator fields that deep-merge (rather than replace) on patch.
  // incidents/capa are month-keyed too, so editing one month's incident report from
  // the admin drill-down preserves every other month's.
  // Month-keyed maps: a patch MERGES into the existing map instead of replacing it, so
  // editing Aug never wipes Jul. `mNotObserved` marks a month as deliberately not
  // measured — it must merge like every other month map or the flag would be lost the
  // next time any other month on the same indicator is edited.
  const NESTED = ['quarters', 'quarterRemarks', 'months', 'monthRemarks', 'qNum', 'qDen', 'mNum', 'mDen', 'incidents', 'capa', 'mGroups', 'mGroupsDen', 'mDeptBreakdown', 'mNotObserved', 'mEditedAt'];

  /* NEWEST WINS between a manual edit here (overlay) and an approved submission (database).
     The overlay used to win unconditionally, so a month cleared or typed in the console
     earlier hid every reading approved for it later — the approved data was safely in the
     database but "missing" on screen (e.g. MICU CLABSI Aug-26 showed blank, not the approved 0).
     The server stamps base.mApprovedAt[month]; patchIndicator stamps layer.mEditedAt[month].
     A layer cell is dropped only where the approval is newer AND the database actually holds
     that cell, so an admin-owned headcount (mDen) the submission never carried is kept. Legacy
     edits carry no stamp and therefore yield to a stamped approval. */
  const MONTH_MAPS = ['months', 'monthRemarks', 'mNum', 'mDen', 'incidents', 'capa', 'mGroups', 'mGroupsDen', 'mDeptBreakdown', 'mNotObserved'];
  function withoutSuperseded(layer, base) {
    const appr = base && base.mApprovedAt;
    if (!layer || !appr || typeof appr !== 'object') return layer;
    const edited = layer.mEditedAt || {};
    let out = layer;
    Object.keys(appr).forEach((m) => {
      if (!(Number(appr[m]) > (Number(edited[m]) || 0))) return;
      const has = (k) => !!(base[k] && Object.prototype.hasOwnProperty.call(base[k], m));
      const dbReading = ['months', 'mNum'].some((k) => has(k) && base[k][m] != null && base[k][m] !== '');
      const dbNotObs = !!(base.mNotObserved && base.mNotObserved[m]);
      MONTH_MAPS.forEach((k) => {
        if (!out[k] || !Object.prototype.hasOwnProperty.call(out[k], m)) return;
        const drop = has(k) || (k === 'mNotObserved' && dbReading) || (dbNotObs && k !== 'mDen');
        if (!drop) return;
        if (out === layer) out = Object.assign({}, layer);
        out[k] = Object.assign({}, out[k]); delete out[k][m];
      });
    });
    return out;
  }

  // Definition fields overwritten by an authoritative correction (window.QI_CORRECTIONS,
  // keyed by indicator name). VALUE fields (quarters/qNum/qDen/mNum/mDen/months) are
  // never touched, so entered data is preserved.
  const CORRECT_FIELDS = ['formula', 'numLabel', 'denLabel', 'numeratorDef', 'denominatorDef', 'unit', 'benchmark', 'benchmarkValue', 'benchmarkNote', 'goalDirection', 'reference', 'referenceUrl', 'denAdminOnly', 'victimField'];
  function correctedBase(seedInd) {
    try {
      const C = (typeof window !== 'undefined') && window.QI_CORRECTIONS;
      if (!C) return seedInd;
      const corr = C[String((seedInd && seedInd.name) || '').trim().toLowerCase().replace(/\s+/g, ' ')];
      if (!corr) return seedInd;
      const base = Object.assign({}, seedInd);
      CORRECT_FIELDS.forEach(k => { if (corr[k] !== undefined && corr[k] !== null && corr[k] !== '') base[k] = corr[k]; });
      // Keep the legacy `valueType` in sync with the corrected formula (several UI
      // surfaces still derive the %/measure from it), and drop any stale cached
      // `formulaText` so downstream screens recompute it from the corrected labels.
      if (corr.formula) base.valueType = corr.formula === 'pct' ? '%' : (corr.formula === 'count' ? 'Count' : 'Rate');
      delete base.formulaText;
      return base;
    } catch (e) { return seedInd; }
  }

  function mergeIndicator(seedInd, patch) {
    // Apply the authoritative correction to the BASE so an explicit user edit (patch)
    // still wins, but every uncorrected indicator gets the right formula/reference.
    const corrected = correctedBase(seedInd);
    patch = withoutSuperseded(patch, corrected);
    const ind = Object.assign({}, corrected, patch || {});
    if (patch) NESTED.forEach(k => { if (patch[k]) ind[k] = Object.assign({}, corrected[k] || {}, patch[k]); });

    const f = ind.formula;
    if (f && f !== 'direct') {
      // Formula indicators: compute each quarter from monthly num/den (aggregate
      // rates by SUMMING numerators & denominators) or from the direct quarter num/den.
      const q2 = Object.assign({}, ind.quarters || {});
      const needDen = f !== 'count'; // rate/pct/rate1000 require a denominator to be meaningful
      QS.forEach(q => {
        const ms = QUARTER_MONTHS[q] || [];
        // A month only counts toward the rollup if it has a numerator AND (for rate/pct) a
        // denominator — otherwise summing empty denominators yields den=0 → a false on-benchmark 0.
        const haveMonths = ms.some(m => ind.mNum && ind.mNum[m] != null && ind.mNum[m] !== ''
          && (!needDen || (ind.mDen && ind.mDen[m] != null && ind.mDen[m] !== '')));
        let num, den, hadInput = haveMonths;
        if (haveMonths) {
          num = ms.reduce((s, m) => s + (Number((ind.mNum || {})[m]) || 0), 0);
          den = ms.reduce((s, m) => s + (Number((ind.mDen || {})[m]) || 0), 0);
        } else {
          const n = (ind.qNum || {})[q];
          if (n != null && n !== '') { hadInput = true; num = n; den = (ind.qDen || {})[q]; }
        }
        // No denominator for a rate/pct ⇒ not computable from num/den…
        let v = hadInput ? ((needDen && !den) ? null : qiFormulaCompute(f, num, den)) : null;
        if (v == null) {
          // …but approved zero-event / denominator-less readings store their computed
          // value in months{} — roll those up so "0 events" isn't shown as not-reported.
          const vals = ms.map(m => (ind.months || {})[m]).filter(x => x != null && x !== '').map(Number);
          if (vals.length) v = f === 'count' ? vals.reduce((s, x) => s + x, 0) : Math.round((vals.reduce((s, x) => s + x, 0) / vals.length) * 100) / 100;
        }
        if (v != null) q2[q] = v; else if (hadInput) q2[q] = null; // explicit null only when something was entered
      });
      ind.quarters = q2;
    } else if (ind.months && Object.keys(ind.months).length) {
      // Direct value: roll the quarter up from months (sum for Count, avg for %).
      const q2 = Object.assign({}, ind.quarters || {});
      QS.forEach(q => { const r = rollupQuarter(ind, q); if (r !== undefined) q2[q] = r; });
      ind.quarters = q2;
    }
    // Additive: quarters keyed PER FISCAL YEAR, computed from that year's monthly data. FY-aware
    // readers use these; the flat ind.quarters above stays as-is for legacy/no-FY readers.
    const fys = fysInInd(ind);
    if (fys.length) { const byFy = {}; fys.forEach(fy => { byFy[fy] = computeQuartersFor(ind, fyQuarterMonths(fy)); }); ind.quartersByFy = byFy; }
    return ind;
  }

  // The ONE canonical display name for a quality department = its linked Statistics
  // department name (via window.DEPTMAP / __UNICO_DEPT_MAP__). Resolves by the quality
  // doc's deptId link, else by mapping its key. Falls back to the doc's own name.
  function canonicalDeptName(seedDept) {
    try {
      if (typeof window === 'undefined' || !window.DEPTMAP) return null;
      const id = (seedDept && seedDept.deptId) || window.DEPTMAP.idFromQk(seedDept && seedDept.key);
      if (!id) return null;
      const nm = window.DEPTMAP.nameFromId(id);
      if (nm && nm !== id) return nm; // only a REAL resolved name — never fall back to the raw id
    } catch (e) { }
    return null;
  }

  function mergeDept(seedDept, ov) {
    let dept;
    if (!ov) {
      // No overlay for this department — STILL run each indicator through mergeIndicator:
      // it applies the QI_CORRECTIONS definition fixes and computes quarter rollups. The
      // old pass-through skipped both, so a never-edited department kept wrong formulas
      // (e.g. NSI shown as a plain count with no admin denominator control).
      dept = Object.assign({}, seedDept, { indicators: (seedDept.indicators || []).map(i => mergeIndicator(i)) });
    } else {
      const removed = new Set(ov.indRemoved || []);
      const patches = ov.indPatches || {};
      const kept = (seedDept.indicators || []).filter(i => !removed.has(i.id));
      const inds = kept.map(i => mergeIndicator(i, patches[i.id]));
      // An overlay-added entry whose id ALSO exists in the seed used to be pushed as a
      // SECOND row: the department rendered the same indicator twice, both rows sharing
      // one indPatches entry, so editing either moved both. Fold it onto the seed copy
      // instead — the added definition wins, but the seed's recorded months/incidents
      // survive underneath, so nothing that was ever entered disappears.
      const rawById = new Map(kept.map(i => [String(i.id), i]));
      const idxById = new Map(kept.map((i, ix) => [String(i.id), ix]));
      (ov.indAdded || []).forEach(a => {
        if (removed.has(a.id)) return;
        const key = String(a.id);
        const base = rawById.get(key);
        let raw = a;
        if (base) {
          // The added copy is an overlay snapshot too: a month approved after it was taken wins.
          const a2 = withoutSuperseded(a, base);
          raw = Object.assign({}, base, a2);
          NESTED.forEach(k => { if (base[k] || a2[k]) raw[k] = Object.assign({}, base[k] || {}, a2[k] || {}); });
        }
        const merged = mergeIndicator(raw, patches[a.id]);
        const at = idxById.get(key);
        if (at == null) { idxById.set(key, inds.length); inds.push(merged); } else { inds[at] = merged; }
      });
      dept = Object.assign({}, seedDept, { indicators: inds });
      if (ov.executive) dept.executive = Object.assign({}, seedDept.executive || {}, ov.executive);
      if (ov.meta) dept.meta = Object.assign({}, seedDept.meta || {}, ov.meta);
    }
    // Show the single canonical Statistics name everywhere quality is rendered (keeps the
    // `key` as the stable identity — only the displayed `name` becomes canonical).
    const cn = canonicalDeptName(seedDept);
    // qualityName keeps the quality doc's own name: the hand-hygiene audit files rows under it
    // ("Emergency Medicine"), so after the rename to "Emergency Room" nothing matched.
    if (cn && cn !== dept.name) dept = Object.assign({}, dept, { name: cn, qualityName: dept.name });
    // Unassigning hand hygiene from a department with audit rows must stick: the audit clone
    // below used to re-create it on every build, so the assignment "came back".
    const rmIds = (ov && ov.indRemoved) || [];
    if (rmIds.some((id) => String(id) === 'ind-hh-from-audit' || (seedDept.indicators || []).some((i) => String(i.id) === String(id) && /hand\s*hygiene/i.test(i.name || '')))) dept = Object.assign({}, dept, { hhOptOut: true });
    return dept;
  }

  // ---- Hand-hygiene audit → each department's own HH indicator ----
  // The WHO hand-hygiene audit is submitted ONCE (hospital-wide) with a per-department
  // breakdown stored on the hospital indicator: mDeptBreakdown[month] =
  // [{dept:'<display name>', g:{nurse:{n,d},doctor,pca,other}}]. The departments' own
  // "Hand Hygiene Compliance" indicators stayed empty, so every dept row showed
  // "not reported" even though the audit covered that department. This pass fills a
  // department's HH indicator from its audit rows — only for months the department has
  // not entered itself (its own entry always wins) — so dashboards, scorecards and
  // reports read one connected dataset.
  function applyHHDeptBreakdown(list) {
    try {
      const isHH = (ind) => /hand\s*hygiene/i.test((ind && ind.name) || '');
      let src = null;
      list.forEach((d) => (d.indicators || []).forEach((ind) => {
        if (isHH(ind) && ind.mDeptBreakdown && Object.keys(ind.mDeptBreakdown).length) {
          if (!src || /overall|hospital/i.test(d.name + ' ' + ind.name)) src = { dep: d, ind: ind };
        }
      }));
      if (!src) return list;
      const normN = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
      // The hand-hygiene audit stored each dept's rows under its ORIGINAL name; several
      // depts were later renamed to their canonical Quality name, which broke the plain
      // name match (a renamed dept silently stopped receiving its audited compliance).
      // Map the old audit names -> canonical so those departments match again.
      const HH_DEPT_ALIAS = {
        'endoscopy': 'endoscopic suite',
        'level 10 ward': 'ipd cabin level 10',
        'level 9 ward': 'ipd cabin level 9',
        'labour / delivery / recovery': 'labour , delivery & recovery room',
        'ct ot': 'ctvs ot',
        'ct icu': 'ctvs icu',
      };
      const canonDept = (s) => { const n = normN(s); return HH_DEPT_ALIAS[n] || n; };
      const bd = src.ind.mDeptBreakdown;
      return list.map((d) => {
        if (d === src.dep) return d;
        const idx = (d.indicators || []).findIndex(isHH);
        if (idx < 0 && d.hhOptOut) return d;   // admin unassigned it — no audit clone
        // A dept with audited rows but NO hand-hygiene indicator of its own (e.g. CT ICU)
        // gets a synthetic one cloned from the hospital-wide source — otherwise its
        // audited compliance renders as a blank '—' column in every heatmap/report.
        // Once the dept records a real HH indicator, findIndex hits that one instead
        // and the synthetic simply stops being created.
        const hh = idx >= 0 ? d.indicators[idx] : {
          id: 'ind-hh-from-audit', name: 'Hand Hygiene Compliance', formula: 'pct', unit: '%', valueType: '%',
          numLabel: src.ind.numLabel || 'Compliant moments', denLabel: src.ind.denLabel || 'Observed moments',
          benchmark: src.ind.benchmark || '≥ 90 %', benchmarkValue: (src.ind.benchmarkValue != null ? src.ind.benchmarkValue : 90),
          goalDirection: 'higher_is_better', months: {}, mNum: {}, mDen: {},
        };
        let months = null, mNum = null, mDen = null;
        Object.keys(bd).forEach((mk) => {
          const rows = bd[mk]; if (!Array.isArray(rows)) return;
          // Match by canonical name (alias-mapped) OR by the dept's stable key, so a
          // later display-name change never breaks a department's audit distribution.
          const row = rows.find((r) => r && (canonDept(r.dept) === canonDept(d.name) || (d.qualityName && canonDept(r.dept) === canonDept(d.qualityName)) || normN(r.dept) === normN(d.key) || canonDept(r.dept) === normN(d.key))); if (!row) return;
          let n = 0, den = 0; const g = row.g || {};
          ['nurse', 'doctor', 'pca', 'other'].forEach((k) => { const x = g[k] || {}; n += Number(x.n) || 0; den += Number(x.d) || 0; });
          if (!(den > 0)) return; // this dept was not audited that month (0/0 row)
          const own = (hh.mNum && hh.mNum[mk] != null && hh.mNum[mk] !== '') || (hh.months && hh.months[mk] != null && hh.months[mk] !== '');
          if (own) return;
          if (!months) { months = Object.assign({}, hh.months || {}); mNum = Object.assign({}, hh.mNum || {}); mDen = Object.assign({}, hh.mDen || {}); }
          // fill BOTH shapes: months (formula 'direct' reads it) and mNum/mDen ('pct' reads those)
          months[mk] = Math.round((n / den) * 10000) / 100;
          mNum[mk] = n; mDen[mk] = den;
        });
        if (!months) return d;
        const patched = Object.assign({}, hh, { months: months, mNum: mNum, mDen: mDen, hhFromAudit: true });
        // refresh the per-year quarter rollups so quarter-based views see the filled months
        const fys = fysInInd(patched);
        if (fys.length) { const byFy = {}; fys.forEach((fy) => { byFy[fy] = computeQuartersFor(patched, fyQuarterMonths(fy)); }); patched.quartersByFy = byFy; }
        const inds = (d.indicators || []).slice();
        if (idx >= 0) inds[idx] = patched; else inds.push(patched);
        return Object.assign({}, d, { indicators: inds });
      });
    } catch (e) { return list; }
  }

  // Merged, read-anywhere snapshot (reads localStorage fresh each call).
  function qualityData() {
    const ov = loadOverlay();
    return applyHHDeptBreakdown((window.QUALITY_SEED || []).map(d => mergeDept(d, ov.depts[d.key])));
  }

  // React hook for screens that EDIT quality data.
  function useQualityStore() {
    const [overlay, setOverlay] = React.useState(loadOverlay);
    // window.QUALITY_SEED is swapped in place by refreshQualitySeed (approval / tab
    // refocus); the memo only watches the overlay, so bump to rebuild from fresh seed.
    const [rev, setRev] = React.useState(0);
    React.useEffect(() => { const h = () => setRev(r => r + 1); window.addEventListener('unico:data-refreshed', h); return () => window.removeEventListener('unico:data-refreshed', h); }, []);
    // The server merged the quality overlay with another session's saves: reload it so this
    // tab builds on their edits instead of writing its older copy back.
    React.useEffect(() => { const h = (e) => { const ks = (e && e.detail && e.detail.keys) || []; if (ks.some(k => /^unico_quality_v\d+$/.test(k))) setOverlay(loadOverlay()); }; window.addEventListener('unico:overlay-merged', h); return () => window.removeEventListener('unico:overlay-merged', h); }, []);
    React.useEffect(() => { saveOverlay(overlay); }, [overlay]);
    const merged = React.useMemo(
      () => applyHHDeptBreakdown((window.QUALITY_SEED || []).map(d => mergeDept(d, overlay.depts[d.key]))),
      [overlay, rev]
    );

    // A missing dept key must never become a write. `depts[key]` string-coerces an
    // undefined/null key into the literal bucket "undefined", which no department ever
    // reads back — so the edit silently vanishes AND leaves an orphan slice behind that
    // accumulates in the overlay forever. Every mutation below funnels through here, so
    // this one guard covers add/remove/patch/restore/executive/meta.
    const patchDept = (key, fn) => setOverlay(o => {
      const k = (key == null) ? '' : String(key);
      if (!k || k === 'undefined' || k === 'null') {
        try { console.warn('[quality-store] ignored an edit with no department key:', key); } catch (e) {}
        return o;
      }
      const depts = Object.assign({}, o.depts);
      depts[k] = fn(depts[k] ? Object.assign({}, depts[k]) : {});
      return Object.assign({}, o, { depts });
    });

    // Persistent master catalogue of admin-defined indicators (survives even
    // before any department reports them). Lives alongside `depts` in the same
    // overlay blob, so it mirrors to disk/MongoDB through the very same bridge.
    const catalog = overlay.catalog || [];
    const catNorm = (s) => (s || '').toString().trim().toLowerCase().replace(/\s+/g, ' ');

    return {
      depts: merged,
      catalog,
      get: (key) => merged.find(d => d.key === key),
      isEdited: (key) => !!overlay.depts[key],

      // master catalogue: add (de-duped by name) / remove a standalone indicator def
      addCatalogIndicator: (def) => setOverlay(o => {
        const nn = catNorm(def && def.name);
        if (!nn) return o;
        const list = o.catalog || [];
        if (list.some(c => catNorm(c.name) === nn)) return o; // already defined
        return Object.assign({}, o, { catalog: [...list, def] });
      }),
      removeCatalogIndicator: (name) => setOverlay(o => {
        const nn = catNorm(name);
        const list = o.catalog || [];
        return Object.assign({}, o, { catalog: list.filter(c => catNorm(c.name) !== nn) });
      }),

      patchIndicator: (deptKey, indId, patch) => patchDept(deptKey, cur => {
        const all = Object.assign({}, cur.indPatches || {});
        const prev = all[indId] || {};
        const next = Object.assign({}, prev, patch);
        NESTED.forEach(k => { if (patch[k]) next[k] = Object.assign({}, prev[k] || {}, patch[k]); });
        // Stamp WHEN each month was edited, so it can be weighed against a later approval.
        const now = Date.now(), touched = {};
        MONTH_MAPS.forEach(k => { if (patch[k] && typeof patch[k] === 'object') Object.keys(patch[k]).forEach(m => { touched[m] = now; }); });
        if (Object.keys(touched).length) next.mEditedAt = Object.assign({}, prev.mEditedAt || {}, touched);
        all[indId] = next;
        return Object.assign({}, cur, { indPatches: all });
      }),

      // Adding is an explicit "this department reports this indicator", so it must also
      // UN-HIDE the id if a previous unassign put it in indRemoved — otherwise the
      // freshly added indicator is filtered straight back out by the removed-set when
      // the dept is merged, and it just never appears. Re-adding the same id replaces
      // the entry rather than stacking a second twin next to it.
      addIndicator: (deptKey, ind) => patchDept(deptKey, cur => Object.assign({}, cur, {
        indAdded: [...(cur.indAdded || []).filter(a => String(a.id) !== String(ind.id)), ind],
        indRemoved: (cur.indRemoved || []).filter(x => String(x) !== String(ind.id)),
      })),

      removeIndicator: (deptKey, indId) => patchDept(deptKey, cur => {
        const added = cur.indAdded || [];
        if (added.some(a => a.id === indId)) {
          const patches = Object.assign({}, cur.indPatches || {}); delete patches[indId];
          return Object.assign({}, cur, { indAdded: added.filter(a => a.id !== indId), indPatches: patches });
        }
        return Object.assign({}, cur, { indRemoved: [...(cur.indRemoved || []), indId] });
      }),

      // Un-hide a SEED indicator a previous unassign put in indRemoved. The assign
      // matrix uses this on re-tick so the department's ORIGINAL indicator (with all
      // its recorded data) comes back, instead of minting an empty twin with a new id.
      restoreIndicator: (deptKey, indId) => patchDept(deptKey, cur => Object.assign({}, cur, {
        indRemoved: (cur.indRemoved || []).filter(x => String(x) !== String(indId)),
      })),

      setExecutive: (deptKey, patch) => patchDept(deptKey, cur => ({
        ...cur, executive: Object.assign({}, cur.executive || {}, patch),
      })),
      setMeta: (deptKey, patch) => patchDept(deptKey, cur => ({
        ...cur, meta: Object.assign({}, cur.meta || {}, patch),
      })),

      resetDept: (deptKey) => setOverlay(o => {
        const depts = Object.assign({}, o.depts); delete depts[deptKey];
        return Object.assign({}, o, { depts });
      }),
    };
  }

  // helpers used across the Quality screens
  // The id is the DATA KEY and is also what makes an indicator "the same indicator"
  // across departments (the console's Common-indicator edit scope, the assignment
  // matrix and every report group by id). This used to end in Math.random(), so
  // adding the SAME indicator in two departments always minted two different ids —
  // that is how needle-stick fragmented into ind-needle-stick-sharps-injury-t6z2 /
  // -3hww / -f212 / -wzr4 …, one orphan per department. The slug is now DERIVED FROM
  // THE NAME, so the same indicator lands on the same id everywhere.
  // Ids only have to be unique WITHIN one department, so pass that department's
  // existing ids as `taken` and a numeric suffix is added only on a real collision.
  function qualitySlug(s, taken) {
    const base = 'ind-' + String(s || 'indicator').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '');
    const used = taken instanceof Set ? taken : new Set(Array.isArray(taken) ? taken : []);
    if (!used.has(base)) return base;
    let n = 2;
    while (used.has(base + '-' + n)) n++;
    return base + '-' + n;
  }

  window.qualityData = qualityData;
  window.useQualityStore = useQualityStore;
  window.qiFormulaCompute = qiFormulaCompute;
  window.QUALITY_QUARTER_MONTHS = QUARTER_MONTHS;
  window.QUALITY_MONTH_QUARTER = MONTH_QUARTER;
  window.qualityIsPct = isPct;
  window.qualitySlug = qualitySlug;
})();

;
/* ===== appraisal-spec.js ===== */
/* UNICO — Individual Performance Appraisal, Form HR-NUR-PA-01.
 *
 * THE PAPER FORM, AS DATA. Everything the appraisal module scores, prints or grades
 * comes from this one file: the 10 sections, the 20 parameters, the behavioural
 * descriptor that earns each point from 5 down to 1, the section maxima and the grade
 * bands. Nothing here is presentation — performance.jsx renders it, the printable form
 * renders it, and the score summary adds it up, so the screen, the print-out and the
 * stored record can never drift apart from each other or from the paper original.
 *
 * Marked out of 100, so the total obtained IS the percentage.
 *
 * Loaded as plain JS before the components (see MANIFEST in scripts/build-renderer.js)
 * and published as window.UNICO_APPRAISAL.
 */
(function () {
  'use strict';

  // Score -> what it means. Printed as Part B of the form.
  var RATING_KEY = [
    { score: 5, label: 'Excellent', desc: 'Consistently exceeds the required standard; can be held up as an example to others.' },
    { score: 4, label: 'Very Good', desc: 'Frequently exceeds the required standard; needs little or no correction.' },
    { score: 3, label: 'Good / Satisfactory', desc: 'Meets the required standard consistently; performance is dependable.' },
    { score: 2, label: 'Needs Improvement', desc: 'Falls below the required standard at times; needs guidance and follow-up.' },
    { score: 1, label: 'Unsatisfactory', desc: 'Consistently below the required standard; immediate corrective action needed.' },
  ];

  // The 10 sections. `max` is the section sub-total and is ALWAYS params.length * 5 —
  // asserted at the bottom of this file so a future edit cannot silently break the
  // out-of-100 arithmetic that the percentage and the grade both depend on.
  var SECTIONS = [
    {
      no: 1, title: 'QUALITY OF WORK', max: 10, params: [
        {
          sl: 1, name: 'Accuracy of work',
          desc: 'Correctness of medication administration, documentation, vitals recording and procedure technique; freedom from errors.',
          guide: {
            5: 'No medication, documentation or procedure error during the whole period.',
            4: 'Rare minor error, self-detected and corrected; no patient harm.',
            3: 'Occasional minor errors, corrected on supervision; no harm caused.',
            2: 'Repeated errors needing correction by others; near-miss reported.',
            1: 'Frequent errors; an incident causing or risking patient harm.',
          },
        },
        {
          sl: 2, name: 'Neatness and thoroughness',
          desc: 'Tidiness of patient area and records; completeness of work; adherence to infection-control and safety standards.',
          guide: {
            5: 'Patient area, trolley and records always clean, orderly and complete.',
            4: 'Consistently tidy and complete; very rarely needs a reminder.',
            3: 'Generally tidy; occasional gaps closed after a reminder.',
            2: 'Untidy work area or incomplete records noticed repeatedly.',
            1: 'Poor hygiene practice or grossly incomplete work; infection-control breach.',
          },
        },
      ],
    },
    {
      no: 2, title: 'QUANTITY OF WORK', max: 5, params: [
        {
          sl: 3, name: 'Volume of work completed and freedom from pending work',
          desc: 'Amount of assigned duty completed within the shift against the expected workload; tasks are finished rather than left pending or handed over incomplete to the next shift.',
          guide: {
            5: 'Full workload completed every shift; often absorbs extra duty.',
            4: 'Full workload completed; pending work is rare and always explained.',
            3: 'Normal workload completed; a few tasks handed over pending.',
            2: 'Frequently leaves work for the next shift; needs help to finish.',
            1: 'Regularly fails to complete assigned duty; burdens colleagues.',
          },
        },
      ],
    },
    {
      no: 3, title: 'COMMUNICATION SKILLS', max: 15, params: [
        {
          sl: 4, name: 'Speaking',
          desc: 'Clear, courteous and professional verbal communication with patients, attendants, doctors and colleagues.',
          guide: {
            5: 'Always clear, calm and courteous, even with difficult attendants.',
            4: 'Clear and polite; explains care well to patients, doctors and staff.',
            3: 'Communicates adequately; sometimes brief or unclear under pressure.',
            2: 'Abrupt or unclear speech; complaints received about manner.',
            1: 'Rude or argumentative, or unable to convey clinical information.',
          },
        },
        {
          sl: 5, name: 'Listening',
          desc: 'Attentive listening; understands and follows instructions and patient concerns correctly.',
          guide: {
            5: 'Listens fully, confirms understanding, never needs repetition.',
            4: 'Attentive; follows instructions correctly almost every time.',
            3: 'Generally follows instructions; occasionally needs repetition.',
            2: 'Frequently misunderstands or ignores instructions and patient concerns.',
            1: 'Does not listen; errors result from missed instructions.',
          },
        },
        {
          sl: 6, name: 'Writing',
          desc: 'Legible, accurate and timely written records, charts, handover notes and reports.',
          guide: {
            5: 'Records always legible, complete, timely and properly signed.',
            4: 'Records clear and timely; very rare omission.',
            3: 'Records acceptable; occasional late entry or missing signature.',
            2: 'Illegible or late entries; gaps found on chart audit.',
            1: 'Records missing, falsified or unusable for continuity of care.',
          },
        },
      ],
    },
    {
      no: 4, title: 'RELIABILITY AND DEPENDABILITY', max: 10, params: [
        {
          sl: 7, name: 'Regularity of attendance, punctuality and shift discipline',
          desc: 'Consistent presence on duty throughout the period; unauthorised or unplanned absence kept to a minimum.',
          guide: {
            5: 'Full attendance; no unauthorised absence at all.',
            4: 'Attendance above 95%; all leave properly applied for and sanctioned.',
            3: 'Attendance 90-95%; leave mostly regularised.',
            2: 'Attendance 85-90%, or 1-2 days of unauthorised absence.',
            1: 'Attendance below 85%, or repeated unauthorised absence.',
          },
        },
        {
          sl: 8, name: 'Requires minimum supervision',
          desc: 'Carries out duties dependably without repeated reminders or close monitoring.',
          guide: {
            5: 'Works independently; the supervisor can rely on her without checking.',
            4: 'Needs occasional guidance only in unfamiliar situations.',
            3: 'Works well once instructed; needs routine follow-up.',
            2: 'Needs frequent reminders and re-checking of completed work.',
            1: 'Cannot be left unsupervised; work often has to be redone.',
          },
        },
      ],
    },
    {
      no: 5, title: 'PROBLEM SOLVING SKILLS', max: 10, params: [
        {
          sl: 9, name: 'Analytical and critical thinking',
          desc: 'Identifies the real issue in a clinical or ward situation rather than reacting to symptoms only; weighs options, anticipates consequences and applies clinical reasoning.',
          guide: {
            5: 'Identifies the underlying problem early and anticipates complications.',
            4: 'Analyses situations well; clinical reasoning is usually sound.',
            3: 'Understands obvious problems; needs help with complex ones.',
            2: 'Reacts to symptoms only; misses the underlying issue.',
            1: 'Unable to analyse; acts without thinking through consequences.',
          },
        },
        {
          sl: 10, name: 'Finding workable solutions',
          desc: 'Arrives at practical solutions and escalates appropriately when the matter is beyond own scope.',
          guide: {
            5: 'Provides practical solutions and escalates correctly every time.',
            4: 'Usually finds a workable solution within her own scope.',
            3: 'Finds simple solutions; refers most matters upward.',
            2: 'Waits for others to solve even routine ward problems.',
            1: 'Neither solves nor escalates; problems are allowed to worsen.',
          },
        },
      ],
    },
    {
      no: 6, title: 'DECISION MAKING SKILLS', max: 5, params: [
        {
          sl: 11, name: 'Soundness and timeliness of decisions',
          desc: 'Makes correct decisions within own authority, at the right time, including under pressure or in emergencies.',
          guide: {
            5: 'Correct and prompt decisions even in emergencies; never exceeds authority.',
            4: 'Sound and timely decisions in almost all situations.',
            3: 'Makes routine decisions correctly; hesitates in emergencies.',
            2: 'Delays decisions, or decides wrongly and needs correction.',
            1: 'Wrong or unsafe decisions, or acts beyond own authority.',
          },
        },
      ],
    },
    {
      no: 7, title: 'COORDINATION WITH TEAM MEMBERS', max: 10, params: [
        {
          sl: 12, name: 'Willingness to work as a team',
          desc: 'Cooperates with nursing, medical and support staff; accepts shared responsibility.',
          guide: {
            5: 'Actively builds cooperation and resolves friction within the team.',
            4: 'Cooperates readily with all staff and across shifts.',
            3: 'Cooperates when asked; keeps strictly to own assignment.',
            2: 'Reluctant to cooperate; occasional friction with colleagues.',
            1: 'Refuses cooperation; a source of conflict in the unit.',
          },
        },
        {
          sl: 13, name: 'Willingness to help others',
          desc: 'Voluntarily assists colleagues during workload peaks, emergencies and staff shortage.',
          guide: {
            5: 'Volunteers help in every emergency and staff shortage.',
            4: 'Helps willingly whenever the ward is under pressure.',
            3: 'Helps when specifically requested to do so.',
            2: 'Avoids helping; leaves colleagues to manage alone.',
            1: 'Refuses to help even during emergencies.',
          },
        },
      ],
    },
    {
      no: 8, title: 'INITIATIVE', max: 10, params: [
        {
          sl: 14, name: 'Readiness to take up new tasks',
          desc: 'Accepts new duties, additional responsibility and learning opportunities willingly.',
          guide: {
            5: 'Seeks out new duties and training; takes extra responsibility willingly.',
            4: 'Accepts new duties willingly whenever they are offered.',
            3: 'Accepts new duties when formally assigned.',
            2: 'Reluctant; avoids anything outside routine work.',
            1: 'Refuses new duties or training opportunities.',
          },
        },
        {
          sl: 15, name: 'Contributes suggestions for improvement',
          desc: 'Offers constructive ideas to improve patient care, safety or ward workflow.',
          guide: {
            5: 'Suggests improvements regularly; at least one adopted in the ward.',
            4: 'Offers useful suggestions on patient care and workflow.',
            3: 'Occasionally contributes ideas in ward meetings.',
            2: 'Rarely contributes; criticises without suggesting a remedy.',
            1: 'Never contributes; resists improvement efforts by others.',
          },
        },
      ],
    },
    {
      no: 9, title: 'TIME MANAGEMENT', max: 15, params: [
        {
          sl: 16, name: 'Attending duty on time',
          desc: 'Arrives before shift start and is ready for handover; remains on duty for the full shift and does not leave before the duty is properly handed over.',
          guide: {
            5: 'Always on duty before shift start; never leaves before handover.',
            4: 'Punctual; not more than 1-2 late arrivals in the whole period.',
            3: '3-5 late arrivals; handover generally proper.',
            2: '6-10 late arrivals, or occasionally leaves before handover.',
            1: 'More than 10 late arrivals, or leaves duty without handover.',
          },
        },
        {
          sl: 17, name: 'Prioritising work',
          desc: 'Sorts duties by urgency and clinical priority and re-orders them as the ward situation changes.',
          guide: {
            5: 'Prioritises correctly even when the ward is overloaded.',
            4: 'Sets priorities well; rarely needs re-direction.',
            3: 'Handles routine priorities; struggles when workload rises.',
            2: 'Works in the wrong order; urgent tasks get delayed.',
            1: 'No sense of priority; critical care is delayed as a result.',
          },
        },
        {
          sl: 18, name: 'Performing and completing work within time',
          desc: 'Medication rounds, observations and procedures carried out at the scheduled time, and assigned duty and documentation finished before the end of the shift.',
          guide: {
            5: 'All rounds, procedures and documentation completed on schedule.',
            4: 'Almost always on schedule; delays are rare and explained.',
            3: 'Mostly on time; documentation sometimes finished late.',
            2: 'Frequently delayed; work spills into the next shift.',
            1: 'Habitually late; medication or observation timings are missed.',
          },
        },
      ],
    },
    {
      no: 10, title: 'ACCOUNTABILITY', max: 10, params: [
        {
          sl: 19, name: 'Owning up to mistakes',
          desc: 'Reports own errors and incidents honestly and promptly, without concealment.',
          guide: {
            5: 'Reports her own errors immediately, without being asked.',
            4: 'Admits mistakes readily whenever they occur.',
            3: 'Admits mistakes when they are pointed out.',
            2: 'Defensive; tends to blame others or the circumstances.',
            1: 'Conceals errors or gives false information about them.',
          },
        },
        {
          sl: 20, name: 'Learning from mistakes',
          desc: 'Accepts feedback and demonstrably does not repeat the same error.',
          guide: {
            5: 'Never repeats an error and shares the learning with colleagues.',
            4: 'Acts on feedback; the same error is not repeated.',
            3: 'Improves after counselling; change is slow but visible.',
            2: 'Repeats the same error despite feedback.',
            1: 'Rejects feedback; the same errors continue throughout the period.',
          },
        },
      ],
    },
  ];

  // Part F. `min` is inclusive; the bands are checked from the top down.
  var GRADES = [
    { min: 90, grade: 'A+', rating: 'Outstanding',       interp: 'Commendation / promotion consideration', tone: 'ok' },
    { min: 80, grade: 'A',  rating: 'Very Good',         interp: 'Eligible for normal increment',          tone: 'ok' },
    { min: 70, grade: 'B',  rating: 'Good',              interp: 'Eligible for normal increment',          tone: 'ok' },
    { min: 60, grade: 'C',  rating: 'Satisfactory',      interp: 'Continue in present post; monitor',      tone: 'warn' },
    { min: 50, grade: 'D',  rating: 'Needs Improvement', interp: 'Counselling and re-training required',   tone: 'warn' },
    { min: 0,  grade: 'E',  rating: 'Unsatisfactory',    interp: 'Formal warning / review of employment',  tone: 'bad' },
  ];

  // Part H — what the Chief Nursing Superintendent may record. `suggest` lists the
  // grades for which the module pre-ticks the action; the Authority may override it.
  var CNS_ACTIONS = [
    { id: 'commend',   label: 'Letter of commendation',              suggest: ['A+'] },
    { id: 'promotion', label: 'Recommended for promotion review',    suggest: ['A+'] },
    { id: 'increment', label: 'Eligible for normal increment',       suggest: ['A+', 'A', 'B'] },
    { id: 'continue',  label: 'Continue in present post; monitor',   suggest: ['C'] },
    { id: 'counsel',   label: 'Counselling and re-training required', suggest: ['D'] },
    { id: 'training',  label: 'Refer for structured re-training',    suggest: ['D', 'E'] },
    { id: 'warning',   label: 'Formal written warning',              suggest: ['E'] },
    { id: 'review',    label: 'Review of continued employment',      suggest: ['E'] },
  ];

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /* ---- flattened helpers ---- */
  var PARAMS = [];
  SECTIONS.forEach(function (s) { s.params.forEach(function (p) { PARAMS.push({ sec: s.no, secTitle: s.title, sl: p.sl, name: p.name, desc: p.desc, guide: p.guide }); }); });
  var TOTAL_MAX = SECTIONS.reduce(function (t, s) { return t + s.max; }, 0);

  function gradeFor(pct) {
    var n = Number(pct);
    if (!isFinite(n)) return GRADES[GRADES.length - 1];
    for (var i = 0; i < GRADES.length; i++) if (n >= GRADES[i].min) return GRADES[i];
    return GRADES[GRADES.length - 1];
  }

  // scores: { <sl>: 1..5 }. Returns per-section sub-totals plus the grand total.
  // Deliberately tolerant of a partly-filled form — the module scores a draft live.
  function tally(scores) {
    var s = scores || {};
    var sections = SECTIONS.map(function (sec) {
      var sub = 0, rated = 0;
      sec.params.forEach(function (p) {
        var v = Number(s[p.sl]);
        if (v >= 1 && v <= 5) { sub += v; rated++; }
      });
      return { no: sec.no, title: sec.title, max: sec.max, sub: sub, rated: rated, of: sec.params.length };
    });
    var total = sections.reduce(function (t, x) { return t + x.sub; }, 0);
    var rated = sections.reduce(function (t, x) { return t + x.rated; }, 0);
    var lows = PARAMS.filter(function (p) { var v = Number(s[p.sl]); return v === 1 || v === 2; });
    return {
      sections: sections,
      total: total,
      max: TOTAL_MAX,
      rated: rated,
      of: PARAMS.length,
      complete: rated === PARAMS.length,
      // Marked out of 100, so the total obtained IS the percentage.
      pct: total,
      grade: gradeFor(total),
      lows: lows,
    };
  }

  // Instruction 4 on the form: any rating of 1 or 2 must carry a written remark.
  // Returns the parameters that are still missing one.
  function missingRemarks(scores, remarks) {
    var s = scores || {}, r = remarks || [];
    return PARAMS.filter(function (p) {
      var v = Number(s[p.sl]);
      if (v !== 1 && v !== 2) return false;
      var txt = r[p.sl] || (r && r[String(p.sl)]);
      return !(txt && String(txt).trim());
    });
  }

  /* ---- appraisal cycles, anchored to the individual's date of joining ----
     The window is six months from the person's own DOJ, not a calendar half-year:
     someone who joined on 15 January is appraised 15 Jan - 14 Jul, then 15 Jul - 14 Jan.
     The first appraisal therefore falls six months after joining, which is what makes
     new joiners appear in the reminders. */
  function parseDate(d) {
    if (!d) return null;
    if (d instanceof Date) return isNaN(d.getTime()) ? null : d;
    var t = new Date(d);
    return isNaN(t.getTime()) ? null : t;
  }
  function addMonths(d, n) {
    var x = new Date(d.getTime());
    var day = x.getDate();
    x.setDate(1);
    x.setMonth(x.getMonth() + n);
    // Clamp for short months (31 Aug + 6 -> 28/29 Feb).
    var last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
    x.setDate(Math.min(day, last));
    return x;
  }
  function fmtDay(d) { return d ? d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear() : ''; }
  function fmtShort(d) { return d ? d.getDate() + ' ' + MONTHS[d.getMonth()] : ''; }

  // The appraisal window containing `at` (default: now) for someone who joined on doj.
  function cycleOf(doj, at) {
    var start = parseDate(doj);
    var now = parseDate(at) || new Date();
    if (!start) return null;
    if (now < start) return null;
    var s = new Date(start.getTime());
    var guard = 0;
    while (guard++ < 200) {
      var e = addMonths(s, 6);
      if (now < e) {
        var endIncl = new Date(e.getTime()); endIncl.setDate(endIncl.getDate() - 1);
        return {
          start: s, end: endIncl, due: e,
          id: s.getFullYear() + '-' + String(s.getMonth() + 1).padStart(2, '0') + '-' + String(s.getDate()).padStart(2, '0'),
          label: fmtShort(s) + ' - ' + fmtDay(endIncl),
          index: guard,
        };
      }
      s = e;
    }
    return null;
  }
  // Every completed window since joining, newest first (for the history table).
  function cyclesSince(doj, at, limit) {
    var start = parseDate(doj);
    var now = parseDate(at) || new Date();
    var out = [];
    if (!start) return out;
    var s = new Date(start.getTime());
    var guard = 0;
    while (guard++ < 60) {
      var e = addMonths(s, 6);
      if (e > now) break;
      var endIncl = new Date(e.getTime()); endIncl.setDate(endIncl.getDate() - 1);
      out.push({
        start: new Date(s.getTime()), end: endIncl, due: e,
        id: s.getFullYear() + '-' + String(s.getMonth() + 1).padStart(2, '0') + '-' + String(s.getDate()).padStart(2, '0'),
        label: fmtShort(s) + ' - ' + fmtDay(endIncl),
      });
      s = e;
    }
    out.reverse();
    return limit ? out.slice(0, limit) : out;
  }
  // The organisation-wide half-year, used where entries are pooled across staff
  // (incidents, achievements, the recognition board): "Jul - Dec 2026".
  function orgCycle(at) {
    var d = parseDate(at) || new Date();
    var h = d.getMonth() < 6 ? 0 : 1;
    return {
      id: d.getFullYear() + '-H' + (h + 1),
      label: (h ? 'Jul - Dec ' : 'Jan - Jun ') + d.getFullYear(),
      start: new Date(d.getFullYear(), h ? 6 : 0, 1),
      end: new Date(d.getFullYear(), h ? 11 : 5, h ? 31 : 30),
    };
  }

  /* ONE PERSON'S APPRAISAL STANDING — which window they are in, which form counts as
     theirs, what has been filed against them, and whether a closed window went by
     unappraised.

     It lives in the spec because THREE screens now ask the same question and must give
     the same answer: the Performance module's roster, the Appraisal column on the
     Nurse / PCA directory, and the performance section of the staff record. Three
     copies of this arithmetic drift the moment one of them is corrected, and a
     directory reading "overdue" beside a module reading "due" is worse than no column
     at all.

     `appraisals` is the WHOLE register — it is filtered here on the employee key, so
     no caller has to know that a form is filed under `emp_id || String(id)`. */
  function standing(emp, appraisals, at) {
    var now = parseDate(at) || new Date();
    var empId = emp ? (emp.emp_id || String(emp.id)) : '';
    var doj = emp && emp.doj;
    var mine = (appraisals || []).filter(function (x) { return x && String(x.empId) === String(empId); });
    var cyc = cycleOf(doj, now);
    var current = mine.filter(function (x) { return cyc && x.cycleId === cyc.id; })[0] || null;
    // A form still open from an EARLIER window stays this person's appraisal until it
    // is filed. Matching only the current window made a completed form awaiting Part H
    // vanish from the queue the day the next window opened — so it could never be
    // actioned. An abandoned old DRAFT does not hide the current window's form.
    var earlier = mine.filter(function (x) { return x.status !== 'actioned' && !(cyc && x.cycleId === cyc.id); })
      .sort(function (a, b) { return String(b.cycleStart).localeCompare(String(a.cycleStart)); })[0] || null;
    var appraisal = (earlier && earlier.status !== 'draft') ? earlier : (current || earlier);
    var history = mine.filter(function (x) { return x.status === 'actioned'; })
      .sort(function (a, b) { return String(b.cycleStart).localeCompare(String(a.cycleStart)); });
    var firstDue = doj ? addMonths(parseDate(doj) || now, 6) : null;
    var neverAppraised = history.length === 0;
    /* OVERDUE = a window that has already CLOSED with nothing filed against it.

       cycleOf() only ever returns the window CONTAINING today, whose due date is by
       definition still in the future — so testing that one can never be true. The
       closed windows come from cyclesSince(), newest first. Testing the open window
       instead would flag the whole roster the morning a new cycle starts. */
    var lastClosed = doj ? (cyclesSince(doj, now, 1) || [])[0] : null;
    var missedClosed = !!(lastClosed && !mine.some(function (x) { return x.cycleId === lastClosed.id; }));
    return {
      empId: empId, cycle: cyc, appraisal: appraisal, status: appraisal ? appraisal.status : 'none',
      mine: mine, history: history, last: history[0] || null,
      firstDue: firstDue, neverAppraised: neverAppraised, lastClosed: lastClosed,
      overdue: missedClosed,
      // Never appraised AND past their first six months: the new-joiner reminder,
      // which is a different question from "a window closed unappraised".
      newJoinerDue: !!(neverAppraised && firstDue && firstDue <= now),
    };
  }

  /* WHAT AN ACHIEVEMENT OR AN INCIDENT CAN BE, and what each is worth. These live in
     the shared spec rather than in the Performance module because the staff profile
     records conduct against a person too (Recognition & conduct) — two copies of this
     list would drift, and a category that exists on one screen but not the other files
     entries the register cannot group. */
  var ACH_CATEGORIES = [
    { id: 'award', label: 'Award / recognition', levels: [['Hospital', 3], ['Department', 2], ['Unit', 1]] },
    { id: 'training', label: 'Training completed', levels: [['International', 3], ['National', 2], ['In-house', 1]] },
    { id: 'presentation', label: 'Presentation / teaching', levels: [['Conference', 3], ['Hospital', 2], ['Unit', 1]] },
    { id: 'improvement', label: 'Quality improvement adopted', levels: [['Hospital-wide', 3], ['Department', 2], ['Unit', 1]] },
    { id: 'appreciation', label: 'Patient / family appreciation', levels: [['Written', 2], ['Verbal', 1]] },
    { id: 'extra', label: 'Extra duty / emergency cover', levels: [['Sustained', 2], ['One-off', 1]] },
  ];
  var INC_CATEGORIES = [
    { id: 'medication', label: 'Medication error' },
    { id: 'documentation', label: 'Documentation lapse' },
    { id: 'infection', label: 'Infection-control breach' },
    { id: 'attendance', label: 'Attendance / punctuality' },
    { id: 'conduct', label: 'Conduct / communication' },
    { id: 'procedure', label: 'Procedure / protocol deviation' },
  ];
  var SEVERITIES = [['Minor', 1], ['Moderate', 2], ['Major', 3], ['Critical', 5]];

  // Bonus (achievements) and deduction (incidents) caps, per staff member per cycle.
  var BONUS_CAP = 5;
  var PENALTY_CAP = 5;

  // Final mark = the 20 parameters, plus capped achievement bonus, less capped
  // incident deduction, held inside 0..100 so the grade band always makes sense.
  function finalScore(base, bonus, penalty) {
    var b = Math.min(Math.max(Number(bonus) || 0, 0), BONUS_CAP);
    var p = Math.min(Math.max(Number(penalty) || 0, 0), PENALTY_CAP);
    var n = (Number(base) || 0) + b - p;
    return { bonus: b, penalty: p, score: Math.max(0, Math.min(100, n)) };
  }

  var API = {
    FORM_ID: 'HR-NUR-PA-01',
    FORM_REV: 'Rev. 2',
    SECTIONS: SECTIONS,
    PARAMS: PARAMS,
    RATING_KEY: RATING_KEY,
    GRADES: GRADES,
    CNS_ACTIONS: CNS_ACTIONS,
    TOTAL_MAX: TOTAL_MAX,
    BONUS_CAP: BONUS_CAP,
    PENALTY_CAP: PENALTY_CAP,
    ACH_CATEGORIES: ACH_CATEGORIES,
    INC_CATEGORIES: INC_CATEGORIES,
    SEVERITIES: SEVERITIES,
    MONTHS: MONTHS,
    gradeFor: gradeFor,
    tally: tally,
    missingRemarks: missingRemarks,
    cycleOf: cycleOf,
    cyclesSince: cyclesSince,
    orgCycle: orgCycle,
    standing: standing,
    finalScore: finalScore,
    addMonths: addMonths,
    parseDate: parseDate,
    fmtDay: fmtDay,
    fmtShort: fmtShort,
  };

  // The out-of-100 arithmetic is load-bearing: the total obtained IS the percentage,
  // and the grade band is read off it directly. Shout loudly rather than quietly
  // grading everyone against the wrong denominator.
  (function selfCheck() {
    var bad = SECTIONS.filter(function (s) { return s.max !== s.params.length * 5; });
    if (bad.length) console.error('[appraisal] section max does not match its parameters:', bad.map(function (s) { return s.title; }));
    if (TOTAL_MAX !== 100) console.error('[appraisal] the form must total 100, not ' + TOTAL_MAX + ' - the percentage and grade depend on it.');
    if (PARAMS.length !== 20) console.error('[appraisal] expected 20 parameters, found ' + PARAMS.length);
  })();

  if (typeof window !== 'undefined') window.UNICO_APPRAISAL = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();

;
/* ===== roster-spec.js ===== */
/* UNICO — duty roster shift codes, as data.
 *
 * Taken verbatim from the hospital's own roster legend (the "Duty Roster For …"
 * workbook), so a code typed here means exactly what it means on the printed sheet.
 * Everything the roster module computes — hours worked, shift coverage, who is away,
 * the rule checks — is derived from this table and nothing else.
 *
 * Buckets: G general · M morning · E evening · N night · O off/leave.
 * `hours` is paid duty length; leave codes are 0 and are never counted as cover.
 *
 * Published as window.UNICO_ROSTER.
 */
(function () {
  'use strict';

  // [code, label, bucket, hours]
  var RAW = [
    ['G1', '9:00 AM - 5:00 PM', 'G', 8],
    ['G2', '10:00 AM - 6:00 PM', 'G', 8],
    ['G3', '8:00 AM - 4:00 PM', 'G', 8],
    ['G4', '11:00 AM - 7:00 PM', 'G', 8],

    ['M1', '7:00 AM - 3:00 PM', 'M', 8],
    ['M2', '6:00 AM - 2:00 PM', 'M', 8],
    ['M3', '8:00 AM - 8:00 PM', 'M', 12],
    ['M4', '8:00 AM - 2:00 PM', 'M', 6],
    ['M6', '8:00 AM - 3:00 PM', 'M', 7],
    ['M7', '7:00 AM - 2:00 PM', 'M', 7],
    ['M8', '10:00 AM - 10:00 PM', 'M', 12],
    ['M11', '7:00 AM - 2:00 PM', 'M', 7],

    ['E1', '12:00 PM - 8:00 PM', 'E', 8],
    ['E2', '1:00 PM - 9:00 PM', 'E', 8],
    ['E3', '2:00 PM - 10:00 PM', 'E', 8],
    ['E4', '2:00 PM - 8:00 PM', 'E', 6],
    ['E6', '3:00 PM - 10:00 PM', 'E', 7],
    ['E10', '4:00 PM - 10:00 PM', 'E', 6],
    ['E11', '2:00 PM - 9:00 PM', 'E', 7],

    ['N1', '9:00 PM - 7:00 AM', 'N', 10],
    ['N2', '8:00 PM - 8:00 AM', 'N', 12],
    ['N3', '9:00 PM - 9:00 AM', 'N', 12],
    ['N4', '10:00 PM - 8:00 AM', 'N', 10],
    ['N5', '10:00 PM - 7:00 AM', 'N', 9],
    ['N6', '11:00 PM - 7:00 AM', 'N', 8],
    ['N7', '7:00 PM - 7:00 AM', 'N', 12],
    ['N11', '9:00 PM - 7:00 AM', 'N', 10],
    ['DN1', '12:00 PM - next 8:00 AM', 'N', 20],

    ['PH', 'Public Holiday', 'O', 0],
    ['DO', 'Day Off', 'O', 0],
    ['OFF', 'Off Day', 'O', 0],
    ['AL', 'Annual Leave', 'O', 0],
    ['CL', 'Casual Leave', 'O', 0],
    ['EL', 'Earned Leave', 'O', 0],
    ['ML', 'Maternity Leave', 'O', 0],
    ['FL', 'Paternity Leave', 'O', 0],
  ];

  var SHIFTS = RAW.map(function (r) { return { code: r[0], label: r[1], bucket: r[2], hours: r[3] }; });
  var BY_CODE = {};
  SHIFTS.forEach(function (s) { BY_CODE[s.code] = s; });

  // Colours are the mockup's own BUCKETS table, so a shift pill is the same colour on
  // the screen, in the legend and on the printed sheet.
  var BUCKETS = [
    { id: 'G', label: 'General', color: '#6a52d4' },
    { id: 'M', label: 'Morning', color: '#e08a1e' },
    { id: 'E', label: 'Evening', color: '#0090ca' },
    { id: 'N', label: 'Night', color: '#5b45c4' },
    { id: 'O', label: 'Leave / off', color: '#8b98ab' },
  ];
  var BUCKET_COLOR = {};
  BUCKETS.forEach(function (b) { BUCKET_COLOR[b.id] = b.color; });

  // Codes that mean "away", as opposed to a rostered day off. Used by the leave view:
  // a day off is planned rest, annual leave is absence, and they are not the same thing
  // when you are checking whether a shift is covered.
  var LEAVE_CODES = ['AL', 'CL', 'EL', 'ML', 'FL', 'PH'];
  var OFF_CODES = ['DO', 'OFF'];

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function bucketOf(code) { var s = BY_CODE[code]; return s ? s.bucket : null; }
  function hoursOf(code) { var s = BY_CODE[code]; return s ? s.hours : 0; }
  function isLeave(code) { return LEAVE_CODES.indexOf(code) >= 0; }
  function isOff(code) { return OFF_CODES.indexOf(code) >= 0; }
  function isDuty(code) { var b = bucketOf(code); return !!b && b !== 'O'; }
  function daysIn(year, month) { return new Date(year, month + 1, 0).getDate(); }

  // Per-person totals for one month: counts per bucket + total paid hours.
  function totalsFor(row, days) {
    var t = { G: 0, M: 0, E: 0, N: 0, O: 0, hours: 0, leave: 0 };
    for (var d = 1; d <= days; d++) {
      var c = row && row[d];
      if (!c) continue;
      var b = bucketOf(c);
      if (b) t[b]++;
      t.hours += hoursOf(c);
      if (isLeave(c)) t.leave++;
    }
    return t;
  }

  // Coverage for one day: how many people are on each duty bucket.
  function coverageFor(grid, empIds, day) {
    var c = { G: 0, M: 0, E: 0, N: 0, O: 0, names: { G: [], M: [], E: [], N: [], O: [] } };
    empIds.forEach(function (id) {
      var code = grid[id] && grid[id][day];
      var b = bucketOf(code);
      if (!b) return;
      c[b]++;
      c.names[b].push(id);
    });
    return c;
  }

  /* ---- rule checks --------------------------------------------------------
     Deliberately few, deliberately explicit, and every one of them switchable:
     a roster rule that cannot be turned off gets worked around rather than fixed.
     Each rule returns a list of { day, empId, text } findings. */
  var DEFAULT_RULES = {
    minNight: { on: true, value: 2, label: 'Minimum staff on night duty', unit: 'per day' },
    minMorning: { on: true, value: 2, label: 'Minimum staff on morning duty', unit: 'per day' },
    minEvening: { on: true, value: 2, label: 'Minimum staff on evening duty', unit: 'per day' },
    maxConsecNight: { on: true, value: 4, label: 'Maximum consecutive night shifts', unit: 'per person' },
    maxConsecDuty: { on: true, value: 6, label: 'Maximum consecutive duty days', unit: 'per person' },
    weeklyOff: { on: true, value: 1, label: 'Minimum days off per week', unit: 'per person' },
    leaveClash: { on: true, value: 2, label: 'Maximum staff away on the same day', unit: 'per day' },
  };

  function checkRules(grid, staff, year, month, rules) {
    var R = Object.assign({}, DEFAULT_RULES, rules || {});
    var days = daysIn(year, month);
    var ids = staff.map(function (s) { return s.empId; });
    var out = [];
    var nameOf = {};
    staff.forEach(function (s) { nameOf[s.empId] = s.name; });

    // per-day coverage rules
    for (var d = 1; d <= days; d++) {
      var cov = coverageFor(grid, ids, d);
      [['minMorning', 'M'], ['minEvening', 'E'], ['minNight', 'N']].forEach(function (pair) {
        var r = R[pair[0]];
        if (!r || !r.on) return;
        if (cov[pair[1]] < r.value) {
          out.push({
            day: d, kind: pair[0], severity: cov[pair[1]] === 0 ? 'high' : 'medium',
            text: (cov[pair[1]] === 0 ? 'No one rostered' : 'Only ' + cov[pair[1]]) + ' on ' +
              (pair[1] === 'M' ? 'morning' : pair[1] === 'E' ? 'evening' : 'night') + ' duty (needs ' + r.value + ')',
          });
        }
      });
      if (R.leaveClash && R.leaveClash.on) {
        var away = ids.filter(function (id) { return isLeave(grid[id] && grid[id][d]); });
        if (away.length > R.leaveClash.value) {
          out.push({ day: d, kind: 'leaveClash', severity: 'medium', text: away.length + ' staff away on the same day (limit ' + R.leaveClash.value + ')' });
        }
      }
    }

    // per-person sequence rules
    staff.forEach(function (s) {
      var row = grid[s.empId] || {};
      var runNight = 0, runDuty = 0;
      for (var d = 1; d <= days; d++) {
        var code = row[d];
        runNight = bucketOf(code) === 'N' ? runNight + 1 : 0;
        runDuty = isDuty(code) ? runDuty + 1 : 0;
        if (R.maxConsecNight && R.maxConsecNight.on && runNight === R.maxConsecNight.value + 1) {
          out.push({ day: d, empId: s.empId, kind: 'maxConsecNight', severity: 'medium', text: nameOf[s.empId] + ' has ' + runNight + ' consecutive nights (limit ' + R.maxConsecNight.value + ')' });
        }
        if (R.maxConsecDuty && R.maxConsecDuty.on && runDuty === R.maxConsecDuty.value + 1) {
          out.push({ day: d, empId: s.empId, kind: 'maxConsecDuty', severity: 'medium', text: nameOf[s.empId] + ' has ' + runDuty + ' consecutive duty days (limit ' + R.maxConsecDuty.value + ')' });
        }
      }
      if (R.weeklyOff && R.weeklyOff.on) {
        for (var w = 0; w < Math.ceil(days / 7); w++) {
          var start = w * 7 + 1, end = Math.min(days, start + 6);
          var offs = 0, any = 0;
          for (var k = start; k <= end; k++) { if (row[k]) any++; if (isOff(row[k]) || isLeave(row[k])) offs++; }
          if (any && offs < R.weeklyOff.value) {
            out.push({ day: start, empId: s.empId, kind: 'weeklyOff', severity: 'low', text: nameOf[s.empId] + ' has no day off in week ' + (w + 1) });
          }
        }
      }
    });

    return out;
  }

  var API = {
    SHIFTS: SHIFTS, BY_CODE: BY_CODE, BUCKETS: BUCKETS, BUCKET_COLOR: BUCKET_COLOR,
    LEAVE_CODES: LEAVE_CODES, OFF_CODES: OFF_CODES, MONTHS: MONTHS, DOW: DOW,
    DEFAULT_RULES: DEFAULT_RULES,
    bucketOf: bucketOf, hoursOf: hoursOf, isLeave: isLeave, isOff: isOff, isDuty: isDuty,
    daysIn: daysIn, totalsFor: totalsFor, coverageFor: coverageFor, checkRules: checkRules,
  };

  if (typeof window !== 'undefined') window.UNICO_ROSTER = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();

;
/* ===== mockup-ui.js ===== */
/* UNICO — the design system from the UI mockups, as tokens.
 *
 * Lifted verbatim from `ui/Performance module UI mockups/Performance Module.dc.html`
 * (its GC / RT / ST tables, av(), gchip(), stChip(), roleStyle(), barColor(), and the
 * glass card treatment) so the built screens match the approved design exactly rather
 * than approximately. If the mockup changes, change it HERE and every screen follows.
 *
 * Published as window.MK.
 */
(function () {
  'use strict';

  var MONO = "'IBM Plex Mono',monospace";
  var ANIM = 'growW .7s cubic-bezier(.2,.8,.25,1)';

  // Text
  var INK = '#16202e';        // headings / values
  var BODY = '#3c4858';       // body copy
  var MUTED = '#6c7a8c';      // secondary
  var FAINT = '#9aa6b4';      // footnotes
  var LINE = 'rgba(125,145,180,.18)';

  // Grade colours
  var GC = { 'A+': '#1f9d57', A: '#3ab5a7', B: '#0090ca', C: '#e08a1e', D: '#c05621', E: '#d23a52' };
  // Rating 5..1
  var RT = { 5: ['Excellent', '#1f9d57'], 4: ['Very Good', '#3ab5a7'], 3: ['Good / Satisfactory', '#0090ca'], 2: ['Needs Improvement', '#e08a1e'], 1: ['Unsatisfactory', '#d23a52'] };
  // Status chips
  var ST = {
    'Not started': { c: '#5b6b80', bg: 'rgba(125,145,180,.16)' },
    'In progress': { c: '#0072a3', bg: 'rgba(0,144,202,.1)' },
    'Awaiting discussion': { c: '#b5670a', bg: 'rgba(224,138,30,.15)' },
    Discussed: { c: '#2b8f83', bg: 'rgba(58,181,167,.16)' },
    'Awaiting Part H': { c: '#6a52d4', bg: 'rgba(106,82,212,.12)' },
    Actioned: { c: '#1f9d57', bg: 'rgba(31,157,87,.15)' },
    Locked: { c: '#1f9d57', bg: 'rgba(31,157,87,.15)' },
  };

  // Accent pairs used for the little rounded icon badges: [tint, solid]
  var TINT = {
    blue: ['rgba(0,144,202,.1)', '#0090ca'],
    green: ['rgba(31,157,87,.15)', '#1f9d57'],
    amber: ['rgba(224,138,30,.15)', '#e08a1e'],
    violet: ['rgba(106,82,212,.12)', '#6a52d4'],
    teal: ['rgba(58,181,167,.16)', '#2b8f83'],
    red: ['rgba(210,58,82,.13)', '#d23a52'],
    slate: ['rgba(125,145,180,.16)', '#5b6b80'],
  };

  // The glass panel every block sits in.
  var card = {
    background: 'linear-gradient(152deg,rgba(255,255,255,.76),rgba(236,247,255,.46))',
    backdropFilter: 'blur(26px) saturate(1.75)',
    WebkitBackdropFilter: 'blur(26px) saturate(1.75)',
    border: '1px solid rgba(255,255,255,.92)',
    borderRadius: 16,
    boxShadow: '0 14px 42px rgba(31,59,90,.14),0 4px 16px rgba(0,144,202,.09),inset 0 1px 0 rgba(255,255,255,.95),inset 0 0 22px rgba(255,255,255,.35)',
    overflow: 'hidden',
  };
  var cardHead = { display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderBottom: '1px solid ' + LINE };
  var cardBody = { padding: '14px 16px' };
  var h3 = { margin: 0, fontSize: 13.5, fontWeight: 600, color: INK };
  var sub = { fontSize: 11.5, color: MUTED };
  var page = { maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 };

  function hue(name) { var h = 0, s = String(name || ''); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; }
  function av(name, size) {
    var h = hue(name);
    return {
      width: size, height: size, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center',
      fontSize: size * 0.38, fontWeight: 700, color: '#fff',
      background: 'linear-gradient(135deg,hsl(' + h + ' 60% 52%),hsl(' + ((h + 40) % 360) + ' 62% 42%))',
    };
  }
  function ini(name) { var p = String(name || '').trim().split(/\s+/); return ((p[0] && p[0][0]) || '' + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase() || '?'; }
  function initials(name) {
    var p = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!p.length) return '?';
    return ((p[0][0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
  }

  /* ---- photo-aware avatar -------------------------------------------------
     Staff photos are stored on the staff record as {url, publicId} (Cloudinary,
     via PhotoPicker). Every module that draws an initials circle should show the
     REAL photo when one exists — this is the one component that does it, so the
     fallback logic isn't re-invented (wrongly) per module.
       <MK.Av name={r.name} emp={r.emp} empId={r.empId} size={28}/>
     Resolution: the record passed as `emp` -> the global lookup published by the
     staff store (window.__STAFF_PHOTOS__, by emp id then by name). A dead URL
     falls back to initials instead of the browser's broken-image glyph. */
  function photoUrlOf(rec) {
    if (!rec) return '';
    var p = rec.photo || rec.photo_url;
    if (!p) return '';
    return typeof p === 'string' ? p : (p.url || '');
  }
  /* CREDIT SAVER. Every avatar used to download the 640px ORIGINAL (~180 KB) even at
     26px — pure Cloudinary bandwidth waste. This rewrites a Cloudinary URL to a small
     auto-format derivative (~5-15 KB). Only TWO standard sizes exist on purpose
     (96px for list avatars, 320px for portraits): each DISTINCT transformation is
     billed once ever, so two buckets cost at most 2 per image, then every view is a
     CDN cache hit. Cloudinary URLs are versioned + immutable, so the browser cache
     holds them for a year too. Non-Cloudinary URLs pass through untouched.
       mode 'fill' (default) — square centre-crop, matches objectFit:cover
       mode 'fit'            — scale down only, keeps the uploaded aspect ratio */
  function cdnPhoto(url, px, mode) {
    try {
      if (!url || url.indexOf('res.cloudinary.com') < 0 || url.indexOf('/upload/') < 0) return url;
      if (/\/upload\/[a-z]+_[^/]*\//.test(url)) return url;          // already a derivative
      var w = (px || 32) <= 48 ? 96 : 320;                            // 2x for retina, 2 buckets only
      var t = mode === 'fit' ? ('c_limit,w_' + w) : ('c_fill,w_' + w + ',h_' + w);
      return url.replace('/upload/', '/upload/' + t + ',q_auto,f_auto/');
    } catch (e) { return url; }
  }
  function photoLookup(empId, name) {
    var m = (typeof window !== 'undefined') && window.__STAFF_PHOTOS__;
    if (!m) return '';
    return (empId != null && m['id:' + String(empId).trim()]) || (name && m['nm:' + String(name).trim().toLowerCase()]) || '';
  }
  function Av(props) {
    var name = props.name, size = props.size || 28;
    var url = photoUrlOf(props.emp) || photoUrlOf(props) || photoLookup(props.empId, name);
    var st = React.useState(false); var dead = st[0], setDead = st[1];
    React.useEffect(function () { setDead(false); }, [url]);   // eslint-disable-line
    var radius = props.radius == null ? '50%' : props.radius;
    if (url && !dead) {
      return React.createElement('img', {
        src: cdnPhoto(url, size), alt: name || '', onError: function () { setDead(true); },
        loading: 'lazy', decoding: 'async',
        style: Object.assign({ width: size, height: size, borderRadius: radius, objectFit: 'cover', flexShrink: 0, display: 'block' }, props.style || {}),
      });
    }
    var base = av(name, size);
    if (props.radius != null) base = Object.assign({}, base, { borderRadius: props.radius });
    return React.createElement('div', { style: Object.assign(base, props.style || {}) }, initials(name));
  }
  function roleChip(role) {
    var c = role === 'PCA' ? '#6a52d4' : '#0090ca';
    return { display: 'inline-flex', alignItems: 'center', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 5, color: c, background: c + '16', letterSpacing: '.3px', flexShrink: 0 };
  }
  function gchip(g, big) {
    var c = GC[g] || '#5b6b80';
    return {
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO,
      fontSize: big ? 12 : 11, fontWeight: 700, padding: big ? '3px 10px' : '2px 9px', borderRadius: 14,
      color: c, background: c + '1a', whiteSpace: 'nowrap',
    };
  }
  function stChip(s) {
    var t = ST[s] || ST['Not started'];
    return { display: 'inline-flex', alignItems: 'center', fontSize: 10.5, fontWeight: 600, padding: '2px 9px', borderRadius: 14, color: t.c, background: t.bg, whiteSpace: 'nowrap', flexShrink: 0 };
  }
  function ratingPill(v) {
    var c = (RT[v] || RT[3])[1];
    return { display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 11.5, fontWeight: 600, padding: '4px 11px', borderRadius: 14, background: c + '14', color: c, border: '1px solid ' + c + '33' };
  }
  function iconBadge(tint, size) {
    var t = Array.isArray(tint) ? tint : (TINT[tint] || TINT.blue);
    var n = size || 38;
    return { width: n, height: n, borderRadius: 10, display: 'grid', placeItems: 'center', flexShrink: 0, background: t[0], color: t[1] };
  }
  function barColor(pct) { return pct >= 90 ? '#1f9d57' : pct >= 70 ? '#0090ca' : pct >= 50 ? '#e08a1e' : '#d23a52'; }
  function progColor(frac) { return frac >= 0.75 ? '#1f9d57' : frac >= 0.5 ? '#0090ca' : '#e08a1e'; }
  function track(h) { return { background: 'rgba(125,145,180,.2)', borderRadius: 5, height: h || 6, overflow: 'hidden' }; }
  function fill(w, c) { return { width: Math.max(0, Math.min(100, w)) + '%', height: '100%', borderRadius: 5, background: c, animation: ANIM }; }

  // Primary / ghost buttons, matching the mockup's pill treatment.
  var btnPri = {
    border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, padding: '7px 14px',
    borderRadius: 9, color: '#fff', background: 'linear-gradient(135deg,#27a8db,#0072a3)',
    boxShadow: '0 6px 16px rgba(0,144,202,.28)', display: 'inline-flex', alignItems: 'center', gap: 7,
  };
  var btnGhost = {
    cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, padding: '7px 13px',
    borderRadius: 9, color: BODY, background: 'rgba(255,255,255,.7)', border: '1px solid rgba(125,145,180,.28)',
    display: 'inline-flex', alignItems: 'center', gap: 7,
  };
  function btnTone(c) {
    return {
      border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, padding: '7px 14px',
      borderRadius: 9, color: '#fff', background: c, boxShadow: '0 6px 16px ' + c + '44',
      display: 'inline-flex', alignItems: 'center', gap: 7,
    };
  }

  var API = {
    MONO: MONO, ANIM: ANIM, INK: INK, BODY: BODY, MUTED: MUTED, FAINT: FAINT, LINE: LINE,
    GC: GC, RT: RT, ST: ST, TINT: TINT,
    card: card, cardHead: cardHead, cardBody: cardBody, h3: h3, sub: sub, page: page,
    hue: hue, av: av, ini: ini, initials: initials, Av: Av, photoUrlOf: photoUrlOf, cdnPhoto: cdnPhoto, roleChip: roleChip, gchip: gchip, stChip: stChip,
    ratingPill: ratingPill, iconBadge: iconBadge, barColor: barColor, progColor: progColor,
    track: track, fill: fill, btnPri: btnPri, btnGhost: btnGhost, btnTone: btnTone,
  };

  /* ---- scoped stylesheet -------------------------------------------------
     Injected once. Everything inside .mk-scope picks up the mockup's glass panel,
     header and table treatment, so the existing markup did not have to be rewritten
     element by element to match the approved design. */
  function injectCss() {
    if (typeof document === 'undefined' || document.getElementById('mk-style')) return;
    var el = document.createElement('style');
    el.id = 'mk-style';
    el.textContent = [
      '.mk-scope{max-width:1400px;margin:0 auto;color:' + BODY + '}',
      '.mk-scope .card{background:linear-gradient(152deg,rgba(255,255,255,.76),rgba(236,247,255,.46));',
      'backdrop-filter:blur(26px) saturate(1.75);-webkit-backdrop-filter:blur(26px) saturate(1.75);',
      'border:1px solid rgba(255,255,255,.92);border-radius:16px;',
      'box-shadow:0 14px 42px rgba(31,59,90,.14),0 4px 16px rgba(0,144,202,.09),inset 0 1px 0 rgba(255,255,255,.95),inset 0 0 22px rgba(255,255,255,.35);overflow:hidden}',
      '.mk-scope .card-h{display:flex;align-items:center;gap:10px;padding:13px 16px;border-bottom:1px solid ' + LINE + '}',
      '.mk-scope .card-b{padding:14px 16px}',
      '.mk-scope .sub{font-size:11.5px;color:' + MUTED + '}',
      '.mk-scope .num{font-family:' + MONO + '}',
      '.mk-scope .tbl{width:100%;border-collapse:collapse}',
      '.mk-scope .tbl thead th{text-align:left;font-size:10px;font-weight:700;letter-spacing:.5px;',
      'text-transform:uppercase;color:' + FAINT + ';padding:7px 10px;border-bottom:1px solid ' + LINE + '}',
      '.mk-scope .tbl tbody td{padding:9px 10px;font-size:12.2px;color:' + BODY + ';border-bottom:1px solid rgba(125,145,180,.12)}',
      '.mk-scope .tbl tbody tr:last-child td{border-bottom:0}',
      '.mk-scope .tbl tbody tr:hover{background:rgba(0,144,202,.045)}',
      '.mk-scope .tag{display:inline-flex;align-items:center;font-size:10.5px;font-weight:600;padding:2px 9px;',
      'border-radius:14px;color:#5b6b80;background:rgba(125,145,180,.16);white-space:nowrap}',
      '.mk-scope .btn{cursor:pointer;font-family:inherit;font-size:12px;font-weight:600;padding:7px 13px;',
      'border-radius:9px;color:' + BODY + ';background:rgba(255,255,255,.7);border:1px solid rgba(125,145,180,.28)}',
      '.mk-scope .btn:hover{background:#fff;border-color:rgba(0,144,202,.4)}',
      '.mk-scope .btn.pri,.mk-scope .btn.sm.pri{border:0;color:#fff;font-weight:700;',
      'background:linear-gradient(135deg,#27a8db,#0072a3);box-shadow:0 6px 16px rgba(0,144,202,.28)}',
      '.mk-scope .btn:disabled{opacity:.5;cursor:default;box-shadow:none}',
      '.mk-scope input,.mk-scope select,.mk-scope textarea{font-family:inherit;font-size:12.4px;color:' + INK + ';',
      'padding:7px 10px;border-radius:9px;border:1px solid rgba(125,145,180,.3);background:rgba(255,255,255,.8);outline:none}',
      '.mk-scope input:focus,.mk-scope select:focus,.mk-scope textarea:focus{border-color:#27a8db;background:#fff}',
      '.mk-scope h3{margin:0;font-size:13.5px;font-weight:600;color:' + INK + '}',
      '@keyframes growW{from{width:0}}',
    ].join('');
    document.head.appendChild(el);
  }
  /* ---- app-wide glass ----------------------------------------------------
     The mockup's look is not just the card — it is a card that is TRANSLUCENT over a
     coloured backdrop. Without the gradient behind it, a glass panel just reads as a
     flat white box. So this puts the mockup's radial-gradient field and drifting orb
     behind the whole app and makes every .card glass, everywhere — not only in the
     modules built from the mockup.

     Print and PDF capture opt out: backdrop-filter does not rasterise reliably, and a
     printed sheet should be opaque white anyway. */
  function injectGlobal() {
    if (typeof document === 'undefined' || document.getElementById('mk-global')) return;
    var el = document.createElement('style');
    el.id = 'mk-global';
    el.textContent = [
      'body::before{content:"";position:fixed;inset:0;z-index:-2;pointer-events:none;',
      'background:radial-gradient(900px 620px at 12% -8%,rgba(0,144,202,.26),transparent 62%),',
      'radial-gradient(820px 560px at 90% 6%,rgba(58,181,167,.24),transparent 62%),',
      'radial-gradient(950px 720px at 78% 98%,rgba(106,82,212,.20),transparent 62%),',
      'radial-gradient(720px 520px at 5% 92%,rgba(39,168,219,.20),transparent 62%),',
      'linear-gradient(180deg,#eef3fb,#e4ecf8)}',
      'body::after{content:"";position:fixed;z-index:-1;pointer-events:none;width:640px;height:640px;',
      'left:18%;top:-220px;border-radius:50%;',
      'background:radial-gradient(circle,rgba(39,168,219,.22),rgba(58,181,167,.12) 52%,transparent 72%);',
      'filter:blur(52px);animation:orbFloat 18s ease-in-out infinite alternate}',
      '@keyframes orbFloat{from{transform:translate(0,0) scale(1)}to{transform:translate(160px,110px) scale(1.18)}}',
      '.main,.content{background:transparent}',
      /* the glass panel itself */
      '.card{background:linear-gradient(152deg,rgba(255,255,255,.76),rgba(236,247,255,.46));',
      'backdrop-filter:blur(26px) saturate(1.75);-webkit-backdrop-filter:blur(26px) saturate(1.75);',
      'border:1px solid rgba(255,255,255,.92);border-radius:16px;',
      'box-shadow:0 14px 42px rgba(31,59,90,.14),0 4px 16px rgba(0,144,202,.09),',
      'inset 0 1px 0 rgba(255,255,255,.95),inset 0 0 22px rgba(255,255,255,.35)}',
      '.card:hover{box-shadow:0 18px 50px rgba(31,59,90,.17),0 6px 20px rgba(0,144,202,.12),',
      'inset 0 1px 0 rgba(255,255,255,.95),inset 0 0 22px rgba(255,255,255,.35)}',
      '.card-h{border-bottom:1px solid ' + LINE + '}',
      /* a card nested inside a card should not double the blur */
      '.card .card{backdrop-filter:none;-webkit-backdrop-filter:none;background:rgba(255,255,255,.62);',
      'box-shadow:0 4px 14px rgba(31,59,90,.08);border-color:rgba(255,255,255,.85)}',
      /* the topbar floats over the same field */
      '.topbar{background:rgba(255,255,255,.62);backdrop-filter:blur(20px) saturate(1.6);',
      '-webkit-backdrop-filter:blur(20px) saturate(1.6);border-bottom:1px solid rgba(255,255,255,.8)}',
      /* opaque for print and PDF capture */
      '@media print{body::before,body::after{display:none}',
      '.card,.card .card{background:#fff !important;backdrop-filter:none !important;',
      '-webkit-backdrop-filter:none !important;box-shadow:none !important;border:1px solid #ccc !important}}',
      'body.qc-pdfcap .card{background:#fff !important;backdrop-filter:none !important;',
      '-webkit-backdrop-filter:none !important}',
      /* The two opt-outs above only know about `.card`. Most report and certificate
         pages are hand-rolled shells, so glassing one would silently bleed the page
         gradient into an exported PDF -- html2canvas rasterises exactly what it sees.
         Anything inside a capture root is forced back to paper whatever class it
         carries. */
      '@media print{#pdf-root,#pdf-root *,.pdf-page,.pdf-page *{background-image:none !important;',
      'backdrop-filter:none !important;-webkit-backdrop-filter:none !important}}',
      'body.qc-pdfcap #pdf-root,body.qc-pdfcap #pdf-root *,body.qc-pdfcap .pdf-page,body.qc-pdfcap .pdf-page *,',
      'body.pdf-export-mode #pdf-root,body.pdf-export-mode #pdf-root *{background-image:none !important;',
      'backdrop-filter:none !important;-webkit-backdrop-filter:none !important}',
    ].join('');
    document.head.appendChild(el);
  }
  API.injectGlobal = injectGlobal;

  if (typeof document !== 'undefined') {
    var boot = function () { injectCss(); injectGlobal(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }
  API.injectCss = injectCss;

  if (typeof window !== 'undefined') window.MK = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();

;
/* ===== charts.jsx ===== */
(function(){
const {
  useState,
  useEffect,
  useRef,
  useMemo
} = React;
const PALETTE = ['#0b66d0', '#0f9b8e', '#e08a1e', '#6a52d4', '#d23a52', '#2bb3a3', '#8a93a3', '#4f8df7', '#1f9d57', '#c2486f'];
const fmt = n => n == null ? '–' : (Math.round(n * 100) / 100).toLocaleString();
function useMounted(delay = 30) {
  const [m, setM] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setM(true), delay);
    return () => clearTimeout(t);
  }, []);
  return m;
}
function useTip() {
  const [tip, setTip] = useState(null);
  const node = tip ? React.createElement("div", {
    style: {
      position: 'fixed',
      left: tip.x,
      top: tip.y,
      transform: 'translate(-50%,-115%)',
      background: '#0d1b2e',
      color: '#fff',
      padding: '7px 10px',
      borderRadius: 7,
      fontSize: 11.5,
      pointerEvents: 'none',
      zIndex: 9999,
      boxShadow: '0 8px 24px rgba(0,0,0,.3)',
      whiteSpace: 'nowrap'
    }
  }, React.createElement("div", {
    style: {
      fontWeight: 700,
      marginBottom: tip.rows ? 3 : 0
    }
  }, tip.title), (tip.rows || []).map((r, i) => React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      opacity: .95
    }
  }, r.color && React.createElement("i", {
    style: {
      width: 8,
      height: 8,
      borderRadius: 2,
      background: r.color,
      display: 'inline-block'
    }
  }), React.createElement("span", {
    style: {
      color: '#aebccd'
    }
  }, r.label), React.createElement("b", {
    className: "num",
    style: {
      marginLeft: 'auto',
      paddingLeft: 10,
      fontFamily: 'IBM Plex Mono'
    }
  }, r.value))), tip.single != null && React.createElement("div", {
    className: "num",
    style: {
      fontFamily: 'IBM Plex Mono',
      fontSize: 15,
      fontWeight: 600
    }
  }, tip.single)) : null;
  return [node, setTip];
}
const BAR_COLORS = ['#0090ca', '#159fbf', '#2bb3a3', '#46b87e', '#7cc35a', '#f0a93b', '#ef8049', '#e85c69', '#b65cc6', '#6a6fd4'];
function BarChart({
  data,
  x,
  y,
  height = 240,
  color = '#0b66d0',
  label,
  accent,
  flat = false
}) {
  const mounted = useMounted();
  const m = flat || mounted;
  const [tip, setTip] = useTip();
  const wrap = useRef(null);
  const max = Math.max(1, ...data.map(d => d[y] || 0));
  const id = 'bg' + String(label || y || 'v').replace(/\W/g, '');
  return React.createElement("div", {
    ref: wrap,
    style: {
      position: 'relative'
    }
  }, React.createElement("svg", {
    viewBox: `0 0 ${data.length * 54} ${height}`,
    height: height,
    preserveAspectRatio: "none",
    style: {
      overflow: 'visible',
      width: '100%',
      maxWidth: data.length * 74,
      margin: '0 auto',
      display: 'block'
    }
  }, React.createElement("defs", null, BAR_COLORS.map((c, ci) => React.createElement("linearGradient", {
    key: ci,
    id: id + '_' + ci,
    x1: "0",
    y1: "0",
    x2: "0",
    y2: "1"
  }, React.createElement("stop", {
    offset: "0%",
    stopColor: c
  }), React.createElement("stop", {
    offset: "100%",
    stopColor: c,
    stopOpacity: "0.58"
  })))), [0, .25, .5, .75, 1].map((g, i) => React.createElement("line", {
    key: i,
    x1: "0",
    x2: data.length * 54,
    y1: height - 20 - g * (height - 44),
    y2: height - 20 - g * (height - 44),
    stroke: "#eef1f5",
    strokeWidth: "1"
  })), data.map((d, i) => {
    const v = d[y] || 0;
    const bh = m ? v / max * (height - 44) : 0;
    const bx = i * 54 + 14,
      bw = 26,
      by = height - 20 - bh;
    return React.createElement("g", {
      key: i,
      onMouseMove: e => setTip({
        x: e.clientX,
        y: e.clientY,
        title: d[x],
        single: fmt(v)
      }),
      onMouseLeave: () => setTip(null),
      style: {
        cursor: 'pointer'
      }
    }, React.createElement("rect", {
      x: i * 54 + 4,
      y: "0",
      width: "46",
      height: height - 20,
      fill: "transparent"
    }), React.createElement("rect", {
      x: bx,
      y: by,
      width: bw,
      height: bh,
      rx: "4",
      fill: flat ? BAR_COLORS[i % BAR_COLORS.length] : `url(#${id}_${i % BAR_COLORS.length})`,
      style: flat ? undefined : {
        transition: 'y .7s cubic-bezier(.2,.8,.25,1), height .7s cubic-bezier(.2,.8,.25,1)'
      }
    }), m && v > 0 && React.createElement("text", {
      x: bx + bw / 2,
      y: by - 6,
      textAnchor: "middle",
      fontSize: "10.5",
      fontFamily: "IBM Plex Mono",
      fontWeight: "600",
      fill: BAR_COLORS[i % BAR_COLORS.length]
    }, v), React.createElement("text", {
      x: bx + bw / 2,
      y: height - 6,
      textAnchor: "middle",
      fontSize: "9.5",
      fill: "#9aa6b4"
    }, String(d[x]).replace(/ \d{4}| 20\d\d/, '').slice(0, 6)));
  })), tip);
}
function GroupedBar({
  data,
  x,
  series,
  height = 260
}) {
  const m = useMounted();
  const [tip, setTip] = useTip();
  const max = Math.max(1, ...data.flatMap(d => series.map(s => d[s.id] || 0)));
  const groupW = Math.max(48, series.length * 16 + 18);
  const bw = Math.min(15, (groupW - 14) / series.length - 3);
  return React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, React.createElement("svg", {
    viewBox: `0 0 ${data.length * groupW} ${height}`,
    height: height,
    preserveAspectRatio: "none",
    style: {
      overflow: 'visible',
      width: '100%',
      maxWidth: data.length * Math.max(70, groupW),
      margin: '0 auto',
      display: 'block'
    }
  }, [0, .25, .5, .75, 1].map((g, i) => React.createElement("line", {
    key: i,
    x1: "0",
    x2: data.length * groupW,
    y1: height - 20 - g * (height - 44),
    y2: height - 20 - g * (height - 44),
    stroke: "#eef1f5"
  })), data.map((d, gi) => React.createElement("g", {
    key: gi,
    onMouseMove: e => setTip({
      x: e.clientX,
      y: e.clientY,
      title: d[x],
      rows: series.map(s => ({
        label: s.label,
        value: fmt(d[s.id] || 0),
        color: s.color
      }))
    }),
    onMouseLeave: () => setTip(null),
    style: {
      cursor: 'pointer'
    }
  }, React.createElement("rect", {
    x: gi * groupW,
    y: "0",
    width: groupW,
    height: height - 20,
    fill: "transparent"
  }), series.map((s, si) => {
    const v = d[s.id] || 0,
      h = m ? v / max * (height - 44) : 0;
    const bx = gi * groupW + 9 + si * (bw + 3),
      by = height - 20 - h;
    return React.createElement("rect", {
      key: si,
      x: bx,
      y: by,
      width: bw,
      height: h,
      rx: "3",
      fill: s.color,
      style: {
        transition: `y .6s ${si * 60}ms cubic-bezier(.2,.8,.25,1), height .6s ${si * 60}ms cubic-bezier(.2,.8,.25,1)`
      }
    });
  }), React.createElement("text", {
    x: gi * groupW + groupW / 2,
    y: height - 6,
    textAnchor: "middle",
    fontSize: "9.5",
    fill: "#9aa6b4"
  }, String(d[x]).replace(/ \d{4}| 20\d\d/, '').slice(0, 6))))), tip);
}
function StackedBar({
  data,
  x,
  series,
  height = 260
}) {
  const m = useMounted();
  const [tip, setTip] = useTip();
  const totals = data.map(d => series.reduce((s, k) => s + (d[k.id] || 0), 0));
  const max = Math.max(1, ...totals);
  const step = Math.max(40, Math.min(70, 600 / data.length));
  return React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, React.createElement("svg", {
    viewBox: `0 0 ${data.length * step} ${height}`,
    height: height,
    preserveAspectRatio: "none",
    style: {
      overflow: 'visible',
      width: '100%',
      maxWidth: data.length * Math.max(64, step),
      margin: '0 auto',
      display: 'block'
    }
  }, [0, .25, .5, .75, 1].map((g, i) => React.createElement("line", {
    key: i,
    x1: "0",
    x2: data.length * step,
    y1: height - 20 - g * (height - 44),
    y2: height - 20 - g * (height - 44),
    stroke: "#eef1f5"
  })), data.map((d, gi) => {
    let acc = 0;
    const bx = gi * step + (step - 24) / 2,
      bw = 24;
    return React.createElement("g", {
      key: gi,
      onMouseMove: e => setTip({
        x: e.clientX,
        y: e.clientY,
        title: d[x],
        rows: [...series.map(s => ({
          label: s.label,
          value: fmt(d[s.id] || 0),
          color: s.color
        })), {
          label: 'Total',
          value: fmt(totals[gi])
        }]
      }),
      onMouseLeave: () => setTip(null),
      style: {
        cursor: 'pointer'
      }
    }, React.createElement("rect", {
      x: gi * step,
      y: "0",
      width: step,
      height: height - 20,
      fill: "transparent"
    }), series.map((s, si) => {
      const v = d[s.id] || 0;
      const h = m ? v / max * (height - 44) : 0;
      const by = height - 20 - acc - h;
      acc += h;
      return React.createElement("rect", {
        key: si,
        x: bx,
        y: by,
        width: bw,
        height: Math.max(0, h),
        fill: s.color,
        rx: si === series.length - 1 ? 3 : 0,
        style: {
          transition: `all .6s ${si * 50}ms cubic-bezier(.2,.8,.25,1)`
        }
      });
    }), React.createElement("text", {
      x: gi * step + step / 2,
      y: height - 6,
      textAnchor: "middle",
      fontSize: "9.5",
      fill: "#9aa6b4"
    }, String(d[x]).replace(/ \d{4}| 20\d\d/, '').slice(0, 6)));
  })), tip);
}
function HBar({
  rows,
  height
}) {
  const m = useMounted();
  const max = Math.max(1, ...rows.map(r => r.value));
  return React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, rows.map((r, i) => React.createElement("div", {
    key: i,
    style: {
      display: 'grid',
      gridTemplateColumns: '112px 1fr 46px',
      alignItems: 'center',
      gap: 10
    }
  }, React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 600,
      color: '#3c4858',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, r.label), React.createElement("div", {
    style: {
      height: 16,
      background: '#eef1f5',
      borderRadius: 5,
      overflow: 'hidden'
    }
  }, React.createElement("div", {
    style: {
      height: '100%',
      width: m ? `${r.value / max * 100}%` : '0%',
      background: `linear-gradient(90deg,${r.color || '#0b66d0'},${r.color2 || r.color || '#2a82e0'})`,
      borderRadius: 5,
      transition: `width .8s ${i * 55}ms cubic-bezier(.2,.8,.25,1)`
    }
  })), React.createElement("div", {
    className: "num",
    style: {
      fontSize: 12.5,
      fontWeight: 600,
      textAlign: 'right',
      color: '#16202e'
    }
  }, fmt(r.value)))));
}
function LineChart({
  data,
  x,
  y,
  height = 240,
  color = '#0b66d0',
  area = true,
  flat = false
}) {
  data = Array.isArray(data) ? data : [];
  const mounted = useMounted();
  const m = flat || mounted;
  const [tip, setTip] = useTip();
  const [hi, setHi] = useState(-1);
  if (!data.length) {
    return React.createElement("svg", {
      viewBox: `0 0 360 ${height}`,
      height: height,
      preserveAspectRatio: "none",
      style: {
        overflow: 'visible',
        width: '100%',
        maxWidth: 360,
        margin: '0 auto',
        display: 'block'
      }
    }, [0, .25, .5, .75, 1].map((g, i) => React.createElement("line", {
      key: i,
      x1: "26",
      x2: "334",
      y1: 22 + g * (height - 44),
      y2: 22 + g * (height - 44),
      stroke: "#eef1f5"
    })), React.createElement("text", {
      x: "180",
      y: height / 2,
      textAnchor: "middle",
      fontSize: "11",
      fill: "#9aa6b4"
    }, "No data"));
  }
  const W = Math.max(360, data.length * 60),
    H = height,
    pad = 26;
  const max = Math.max(1, ...data.map(d => d[y] || 0)),
    min = 0;
  const px = i => pad + (data.length <= 1 ? W / 2 : i / (data.length - 1) * (W - pad * 2));
  const py = v => H - 22 - (v - min) / (max - min) * (H - 44);
  const pts = data.map((d, i) => [px(i), py(d[y] || 0)]);
  const path = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const areaPath = path + ` L ${pts[pts.length - 1][0]} ${H - 22} L ${pts[0][0]} ${H - 22} Z`;
  const id = 'ln' + y;
  return React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, React.createElement("svg", {
    viewBox: `0 0 ${W} ${H}`,
    height: H,
    preserveAspectRatio: "none",
    style: {
      overflow: 'visible',
      width: '100%',
      maxWidth: Math.max(140, data.length * 80),
      margin: '0 auto',
      display: 'block'
    },
    onMouseLeave: () => {
      setTip(null);
      setHi(-1);
    }
  }, React.createElement("defs", null, React.createElement("linearGradient", {
    id: id,
    x1: "0",
    y1: "0",
    x2: "0",
    y2: "1"
  }, React.createElement("stop", {
    offset: "0%",
    stopColor: color,
    stopOpacity: "0.28"
  }), React.createElement("stop", {
    offset: "100%",
    stopColor: color,
    stopOpacity: "0"
  }))), [0, .25, .5, .75, 1].map((g, i) => React.createElement("line", {
    key: i,
    x1: pad,
    x2: W - pad,
    y1: 22 + g * (H - 44),
    y2: 22 + g * (H - 44),
    stroke: "#eef1f5"
  })), area && React.createElement("path", {
    d: areaPath,
    fill: flat ? color : `url(#${id})`,
    fillOpacity: flat ? 0.12 : 1,
    style: flat ? undefined : {
      opacity: m ? 1 : 0,
      transition: 'opacity .9s .3s'
    }
  }), React.createElement("path", {
    d: path,
    fill: "none",
    stroke: color,
    strokeWidth: "2.5",
    strokeLinejoin: "round",
    strokeLinecap: "round",
    style: {
      strokeDasharray: 1400,
      strokeDashoffset: m ? 0 : 1400,
      transition: 'stroke-dashoffset 1.1s cubic-bezier(.4,0,.2,1)'
    }
  }), pts.map((p, i) => React.createElement("g", {
    key: i
  }, React.createElement("rect", {
    x: px(i) - W / data.length / 2,
    y: "0",
    width: W / data.length,
    height: H,
    fill: "transparent",
    onMouseMove: e => {
      setHi(i);
      setTip({
        x: e.clientX,
        y: e.clientY,
        title: data[i][x],
        single: fmt(data[i][y] || 0)
      });
    }
  }), React.createElement("circle", {
    cx: p[0],
    cy: p[1],
    r: hi === i ? 5 : 3.2,
    fill: "#fff",
    stroke: color,
    strokeWidth: "2.5",
    style: {
      opacity: m ? 1 : 0,
      transition: 'opacity .4s ' + (0.5 + i * 0.05) + 's, r .15s'
    }
  }))), hi >= 0 && React.createElement("line", {
    x1: px(hi),
    x2: px(hi),
    y1: "14",
    y2: H - 22,
    stroke: color,
    strokeWidth: "1",
    strokeDasharray: "3 3",
    opacity: ".5"
  })), tip);
}
function donutArc(cx, cy, rO, rI, a0, a1) {
  if (a1 - a0 >= Math.PI * 2 - 1e-4) a1 = a0 + Math.PI * 2 - 1e-4;
  const P = (r, a) => `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${P(rO, a0)} A ${rO} ${rO} 0 ${large} 1 ${P(rO, a1)} L ${P(rI, a1)} A ${rI} ${rI} 0 ${large} 0 ${P(rI, a0)} Z`;
}
function Donut({
  data,
  size = 180,
  thickness = 30,
  centerLabel,
  centerValue,
  flat = false,
  onSlice
}) {
  const mounted = useMounted();
  const m = flat || mounted;
  const [tip, setTip] = useTip();
  const [hi, setHi] = useState(-1);
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = (size - thickness) / 2,
    cx = size / 2,
    cy = size / 2,
    C = 2 * Math.PI * r;
  const rO = size / 2,
    rI = size / 2 - thickness;
  let off = 0,
    ang = -Math.PI / 2;
  return React.createElement("div", {
    style: {
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      gap: 18
    }
  }, React.createElement("div", {
    style: {
      position: 'relative',
      width: size,
      height: size,
      flexShrink: 0
    }
  }, flat ? React.createElement("svg", {
    width: size,
    height: size,
    viewBox: `0 0 ${size} ${size}`
  }, data.map((d, i) => {
    const frac = d.value / total;
    const a0 = ang,
      a1 = ang + frac * 2 * Math.PI;
    ang = a1;
    return React.createElement("path", {
      key: i,
      d: donutArc(cx, cy, rO, rI, a0, a1),
      fill: d.color || PALETTE[i % PALETTE.length],
      onMouseMove: e => {
        setHi(i);
        setTip({
          x: e.clientX,
          y: e.clientY,
          title: d.label,
          single: fmt(d.value) + ` (${Math.round(frac * 100)}%)` + (onSlice ? ' · click to view' : '')
        });
      },
      onMouseLeave: () => {
        setHi(-1);
        setTip(null);
      },
      onClick: () => onSlice && onSlice(i, d),
      style: {
        cursor: 'pointer'
      }
    });
  })) : React.createElement("svg", {
    width: size,
    height: size,
    viewBox: `0 0 ${size} ${size}`,
    style: {
      transform: 'rotate(-90deg)'
    }
  }, data.map((d, i) => {
    const frac = d.value / total;
    const len = frac * C;
    const dash = `${m ? len : 0} ${C}`;
    const el = React.createElement("circle", {
      key: i,
      cx: cx,
      cy: cy,
      r: r,
      fill: "none",
      stroke: d.color || PALETTE[i % PALETTE.length],
      strokeWidth: hi === i ? thickness + 5 : thickness,
      strokeDasharray: dash,
      strokeDashoffset: -off,
      strokeLinecap: "butt",
      onMouseMove: e => {
        setHi(i);
        setTip({
          x: e.clientX,
          y: e.clientY,
          title: d.label,
          single: fmt(d.value) + ` (${Math.round(frac * 100)}%)` + (onSlice ? ' · click to view' : '')
        });
      },
      onMouseLeave: () => {
        setHi(-1);
        setTip(null);
      },
      onClick: () => onSlice && onSlice(i, d),
      style: {
        transition: `stroke-dasharray .9s ${i * 80}ms cubic-bezier(.3,.8,.3,1), stroke-width .15s`,
        cursor: 'pointer'
      }
    });
    off += len;
    return el;
  })), centerValue != null && React.createElement("div", {
    style: {
      position: 'absolute',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%,-50%)',
      textAlign: 'center',
      width: '82%',
      pointerEvents: 'none'
    }
  }, React.createElement("div", {
    className: "num",
    style: {
      fontSize: 24,
      fontWeight: 600,
      color: '#16202e',
      lineHeight: 1
    }
  }, centerValue), React.createElement("div", {
    style: {
      fontSize: 10,
      color: '#6c7a8c',
      textTransform: 'uppercase',
      letterSpacing: .4
    }
  }, centerLabel))), React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, data.map((d, i) => React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontSize: 12,
      opacity: hi < 0 || hi === i ? 1 : .45,
      transition: 'opacity .15s',
      cursor: onSlice ? 'pointer' : 'default'
    },
    onMouseEnter: () => setHi(i),
    onMouseLeave: () => setHi(-1),
    onClick: () => onSlice && onSlice(i, d)
  }, React.createElement("i", {
    style: {
      width: 9,
      height: 9,
      borderRadius: 3,
      background: d.color || PALETTE[i % PALETTE.length],
      display: 'inline-block'
    }
  }), React.createElement("span", {
    style: {
      color: '#3c4858',
      fontWeight: 500
    }
  }, d.label), React.createElement("b", {
    className: "num",
    style: {
      marginLeft: 'auto',
      paddingLeft: 14,
      color: '#16202e'
    }
  }, fmt(d.value))))), tip);
}
function Spark({
  values,
  color = '#0b66d0',
  w = 110,
  h = 34,
  fill = true
}) {
  const m = useMounted();
  values = Array.isArray(values) ? values.filter(v => v != null && !isNaN(Number(v))).map(Number) : [];
  if (!values.length) {
    return React.createElement("svg", {
      width: w,
      height: h,
      viewBox: `0 0 ${w} ${h}`,
      style: {
        display: 'block'
      }
    }, React.createElement("line", {
      x1: "2",
      x2: w - 2,
      y1: h - 4,
      y2: h - 4,
      stroke: "#e7ecf3",
      strokeWidth: "2",
      strokeLinecap: "round"
    }));
  }
  const max = Math.max(1, ...values),
    min = Math.min(...values, 0);
  const px = i => i / (values.length - 1 || 1) * w;
  const py = v => h - 3 - (v - min) / (max - min || 1) * (h - 6);
  const path = values.map((v, i) => (i ? 'L' : 'M') + px(i).toFixed(1) + ' ' + py(v).toFixed(1)).join(' ');
  return React.createElement("svg", {
    width: w,
    height: h,
    viewBox: `0 0 ${w} ${h}`,
    style: {
      display: 'block'
    }
  }, fill && React.createElement("path", {
    d: path + ` L ${w} ${h} L 0 ${h} Z`,
    fill: color,
    opacity: ".12"
  }), React.createElement("path", {
    d: path,
    fill: "none",
    stroke: color,
    strokeWidth: "2",
    strokeLinejoin: "round",
    strokeLinecap: "round",
    style: {
      strokeDasharray: 300,
      strokeDashoffset: m ? 0 : 300,
      transition: 'stroke-dashoffset .9s'
    }
  }), React.createElement("circle", {
    cx: px(values.length - 1),
    cy: py(values[values.length - 1]),
    r: "2.6",
    fill: color
  }));
}
Object.assign(window, {
  BarChart,
  GroupedBar,
  StackedBar,
  HBar,
  LineChart,
  Donut,
  Spark,
  PALETTE,
  fmt,
  useTip,
  useMounted
});
})();
;
/* ===== charts3d.jsx ===== */
(function(){
function Bar3D({
  data,
  x,
  y,
  height = 300,
  color = '#0b66d0',
  multi = true,
  flat = false,
  onBar
}) {
  const m = useMounted(60);
  const [tip, setTip] = useTip();
  const [hi, setHi] = React.useState(-1);
  const max = Math.max(1, ...data.map(d => d[y] || 0));
  const dx = 13,
    dy = -9,
    step = Math.max(46, Math.min(78, 640 / data.length));
  const W = data.length * step + dx + 10,
    baseY = height - 26,
    bw = Math.min(30, step - 22);
  const lighten = (h, p) => {
    const n = parseInt(h.slice(1), 16);
    let r = (n >> 16) + p,
      g = (n >> 8 & 255) + p,
      b = (n & 255) + p;
    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));
    return '#' + (r << 16 | g << 8 | b).toString(16).padStart(6, '0');
  };
  const PAL = ['#0090ca', '#159fbf', '#2bb3a3', '#46b87e', '#7cc35a', '#f0a93b', '#ef8049', '#e85c69', '#e0679b', '#b65cc6', '#6a6fd4', '#4f8df7'];
  const colAt = i => multi ? PAL[i % PAL.length] : color;
  const id = 'b3' + color.replace('#', '');
  return React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, React.createElement("svg", {
    viewBox: `0 0 ${W} ${height}`,
    width: "100%",
    height: height,
    preserveAspectRatio: "xMidYMid meet",
    style: {
      overflow: 'visible'
    }
  }, React.createElement("defs", null, PAL.map((c, ci) => React.createElement("linearGradient", {
    key: ci,
    id: id + '_' + ci,
    x1: "0",
    y1: "0",
    x2: "0",
    y2: "1"
  }, React.createElement("stop", {
    offset: "0%",
    stopColor: lighten(c, 28)
  }), React.createElement("stop", {
    offset: "100%",
    stopColor: lighten(c, -12)
  }))), React.createElement("filter", {
    id: id + 'sh',
    x: "-30%",
    y: "-30%",
    width: "160%",
    height: "160%"
  }, React.createElement("feDropShadow", {
    dx: "0",
    dy: "5",
    stdDeviation: "5",
    floodColor: "#1b2b3f",
    floodOpacity: "0.22"
  }))), [0, .25, .5, .75, 1].map((g, i) => {
    const gy = baseY - g * (height - 58);
    return React.createElement("g", {
      key: i
    }, React.createElement("line", {
      x1: "0",
      y1: gy,
      x2: data.length * step,
      y2: gy,
      stroke: "#e9edf3"
    }), React.createElement("line", {
      x1: data.length * step,
      y1: gy,
      x2: data.length * step + dx,
      y2: gy + dy,
      stroke: "#eef1f5"
    }));
  }), data.map((d, i) => {
    const v = d[y] || 0,
      bh = v > 0 ? v / max * (height - 58) : 2;
    const bx = i * step + 12,
      by = baseY - bh,
      on = hi === i;
    const pts = {
      top: `${bx},${by} ${bx + dx},${by + dy} ${bx + bw + dx},${by + dy} ${bx + bw},${by}`,
      side: `${bx + bw},${by} ${bx + bw + dx},${by + dy} ${bx + bw + dx},${baseY + dy} ${bx + bw},${baseY}`
    };
    return React.createElement("g", {
      key: i,
      filter: flat ? undefined : `url(#${id}sh)`,
      onMouseMove: e => {
        setHi(i);
        setTip({
          x: e.clientX,
          y: e.clientY,
          title: d[x],
          single: fmt(v) + (onBar ? ' · click to view' : '')
        });
      },
      onMouseLeave: () => {
        setHi(-1);
        setTip(null);
      },
      onClick: () => onBar && onBar(i, d),
      style: {
        cursor: 'pointer'
      }
    }, React.createElement("g", {
      style: {
        transformOrigin: `${bx + bw / 2}px ${baseY}px`,
        transform: `scaleY(${m || flat ? 1 : 0.001})`,
        transition: flat ? 'none' : `transform .8s ${i * 55}ms cubic-bezier(.2,.85,.3,1)`,
        opacity: hi < 0 || on ? 1 : .82
      }
    }, React.createElement("polygon", {
      points: pts.side,
      fill: lighten(colAt(i), -44)
    }), React.createElement("polygon", {
      points: pts.top,
      fill: lighten(colAt(i), 46)
    }), React.createElement("rect", {
      x: bx,
      y: by,
      width: bw,
      height: bh,
      fill: flat ? colAt(i) : `url(#${id}_${i % PAL.length})`,
      stroke: lighten(colAt(i), -18),
      strokeWidth: "0.5"
    })), (m || flat) && React.createElement("text", {
      x: bx + bw / 2 + dx / 2,
      y: by + dy - 6,
      textAnchor: "middle",
      fontSize: "11",
      fontFamily: "IBM Plex Mono",
      fontWeight: "600",
      fill: "#16202e"
    }, v), React.createElement("text", {
      x: bx + bw / 2,
      y: height - 6,
      textAnchor: "middle",
      fontSize: "9.5",
      fill: "#9aa6b4"
    }, String(d[x]).replace(/ \d{4}| 20\d\d/, '').slice(0, 6)));
  })), tip);
}
function LiveMonitor({
  title = 'Live Patient Activity',
  seed = 40,
  unit = 'patients/hr',
  color = '#3ddc97'
}) {
  const N = 18;
  const rnd = b => Math.max(2, Math.round(b + (Math.random() - 0.45) * b * 0.7));
  const [bars, setBars] = React.useState(() => Array.from({
    length: N
  }, () => rnd(seed)));
  const [pulse, setPulse] = React.useState(true);
  React.useEffect(() => {
    const t = setInterval(() => {
      setBars(b => [...b.slice(1), rnd(seed)]);
      setPulse(p => !p);
    }, 1100);
    return () => clearInterval(t);
  }, [seed]);
  const max = Math.max(...bars, 1);
  const cur = bars[bars.length - 1];
  const avg = Math.round(bars.reduce((a, c) => a + c, 0) / bars.length);
  return React.createElement("div", {
    className: "card live-card",
    style: {
      padding: 0,
      overflow: 'hidden',
      background: 'linear-gradient(160deg,#0d1b2e,#15243a)',
      border: '1px solid #24344e'
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '14px 16px',
      borderBottom: '1px solid rgba(255,255,255,.07)'
    }
  }, React.createElement("span", {
    className: "live-dot"
  }), React.createElement("div", {
    style: {
      color: '#fff',
      fontSize: 13.5,
      fontWeight: 700
    }
  }, title), React.createElement("span", {
    style: {
      fontSize: 10,
      letterSpacing: 1,
      color: '#3ddc97',
      border: '1px solid #1f6e54',
      borderRadius: 5,
      padding: '2px 7px',
      fontWeight: 700
    }
  }, "\u25CF LIVE"), React.createElement("span", {
    className: "spacer"
  }), React.createElement("div", {
    style: {
      textAlign: 'right'
    }
  }, React.createElement("div", {
    className: "num",
    style: {
      color: '#fff',
      fontSize: 22,
      fontWeight: 600,
      lineHeight: 1
    }
  }, cur), React.createElement("div", {
    style: {
      fontSize: 10,
      color: '#7e8da0'
    }
  }, unit))), React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: 5,
      height: 128,
      padding: '16px 16px 14px'
    }
  }, bars.map((v, i) => {
    const last = i === bars.length - 1;
    return React.createElement("div", {
      key: i,
      style: {
        flex: 1,
        height: `${v / max * 100}%`,
        minHeight: 3,
        borderRadius: '4px 4px 2px 2px',
        background: last ? `linear-gradient(180deg,${color},#1f9d6b)` : 'linear-gradient(180deg,rgba(61,220,151,.55),rgba(61,220,151,.12))',
        boxShadow: last ? `0 0 16px ${color}aa` : 'none',
        transition: 'height .9s cubic-bezier(.3,.8,.3,1), background .3s'
      }
    });
  })), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 18,
      padding: '0 16px 14px',
      color: '#9fb0c4',
      fontSize: 11
    }
  }, React.createElement("span", null, "Avg ", React.createElement("b", {
    className: "num",
    style: {
      color: '#fff'
    }
  }, avg)), React.createElement("span", null, "Peak ", React.createElement("b", {
    className: "num",
    style: {
      color: '#fff'
    }
  }, Math.max(...bars))), React.createElement("span", {
    className: "spacer",
    style: {
      flex: 1
    }
  }), React.createElement("span", {
    style: {
      color: '#6f8198'
    }
  }, "updated live \xB7 1s")));
}
function Gauge({
  value,
  max,
  label,
  color = '#0b66d0',
  size = 150
}) {
  const m = useMounted(80);
  const r = (size - 26) / 2,
    cx = size / 2,
    cy = size / 2,
    C = Math.PI * r;
  const frac = Math.min(1, value / (max || 1));
  return React.createElement("div", {
    style: {
      position: 'relative',
      textAlign: 'center'
    }
  }, React.createElement("svg", {
    width: size,
    height: size * 0.66,
    viewBox: `0 0 ${size} ${size * 0.66}`
  }, React.createElement("path", {
    d: `M13 ${cy} A ${r} ${r} 0 0 1 ${size - 13} ${cy}`,
    fill: "none",
    stroke: "#e8edf3",
    strokeWidth: "13",
    strokeLinecap: "round"
  }), React.createElement("path", {
    d: `M13 ${cy} A ${r} ${r} 0 0 1 ${size - 13} ${cy}`,
    fill: "none",
    stroke: color,
    strokeWidth: "13",
    strokeLinecap: "round",
    strokeDasharray: C,
    strokeDashoffset: m ? C * (1 - frac) : C,
    style: {
      transition: 'stroke-dashoffset 1.1s cubic-bezier(.3,.8,.3,1)'
    }
  })), React.createElement("div", {
    style: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: '42%',
      transform: 'translateY(-50%)'
    }
  }, React.createElement("div", {
    className: "num",
    style: {
      fontSize: 22,
      fontWeight: 600,
      color: 'var(--ink)',
      lineHeight: 1
    }
  }, fmt(value)), React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: 'var(--muted)',
      marginTop: 2
    }
  }, label)));
}
Object.assign(window, {
  Bar3D,
  LiveMonitor,
  Gauge
});
})();
;
/* ===== charts-extra.jsx ===== */
(function(){
function ComboChart({
  data,
  x,
  barKey,
  lineKey,
  height = 250,
  barColor = '#0090ca',
  lineColor = '#e08a1e',
  barLabel,
  lineLabel,
  flat = false
}) {
  const mounted = useMounted();
  const m = flat || mounted;
  const [tip, setTip] = useTip();
  const [hi, setHi] = React.useState(-1);
  data = data || [];
  const isPct = String(lineKey).toLowerCase().includes('pct') || String(lineKey).toLowerCase().includes('percent') || String(lineKey).toLowerCase().includes('rate');
  const padL = 42,
    padR = 46,
    padT = 22,
    padB = 24;
  const step = Math.max(46, Math.min(82, 560 / Math.max(1, data.length)));
  const W = Math.max(320, data.length * step + padL + padR),
    H = height;
  const plotW = W - padL - padR,
    plotH = H - padT - padB;
  const barMax = Math.max(1, ...data.map(d => +d[barKey] || 0));
  const lineVals = data.map(d => +d[lineKey] || 0);
  const lineMax = Math.max(isPct ? 100 : 1, ...lineVals);
  const lineMin = 0;
  const cx = i => padL + (data.length <= 1 ? plotW / 2 : (i + 0.5) * (plotW / data.length));
  const lpy = v => padT + plotH - (v - lineMin) / (lineMax - lineMin || 1) * plotH;
  const baseY = padT + plotH;
  const id = 'cmb' + String(barKey).replace(/\W/g, '');
  const pts = data.map((d, i) => [cx(i), lpy(+d[lineKey] || 0)]);
  const path = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const fmtLine = v => isPct ? Math.round(v * 10) / 10 + '%' : fmt(v);
  const ticks = [0, .25, .5, .75, 1];
  return React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      gap: 18,
      justifyContent: 'center',
      marginBottom: 6,
      fontSize: 11.5,
      color: '#3c4858'
    }
  }, React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, React.createElement("i", {
    style: {
      width: 11,
      height: 11,
      borderRadius: 3,
      background: barColor,
      display: 'inline-block'
    }
  }), barLabel || barKey), React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, React.createElement("i", {
    style: {
      width: 14,
      height: 3,
      borderRadius: 2,
      background: lineColor,
      display: 'inline-block'
    }
  }), lineLabel || lineKey)), React.createElement("svg", {
    viewBox: `0 0 ${W} ${H}`,
    height: H,
    preserveAspectRatio: "none",
    style: {
      overflow: 'visible',
      width: '100%',
      maxWidth: Math.max(260, data.length * step + padL + padR),
      margin: '0 auto',
      display: 'block'
    },
    onMouseLeave: () => {
      setTip(null);
      setHi(-1);
    }
  }, !flat && React.createElement("defs", null, React.createElement("linearGradient", {
    id: id,
    x1: "0",
    y1: "0",
    x2: "0",
    y2: "1"
  }, React.createElement("stop", {
    offset: "0%",
    stopColor: barColor
  }), React.createElement("stop", {
    offset: "100%",
    stopColor: barColor,
    stopOpacity: "0.58"
  }))), ticks.map((g, i) => React.createElement("line", {
    key: i,
    x1: padL,
    x2: W - padR,
    y1: baseY - g * plotH,
    y2: baseY - g * plotH,
    stroke: "#eef1f5",
    strokeWidth: "1"
  })), ticks.map((g, i) => React.createElement("text", {
    key: 'l' + i,
    x: padL - 6,
    y: baseY - g * plotH + 3,
    textAnchor: "end",
    fontSize: "9",
    fontFamily: "IBM Plex Mono",
    fill: "#9aa6b4"
  }, fmt(Math.round(barMax * g)))), ticks.map((g, i) => React.createElement("text", {
    key: 'r' + i,
    x: W - padR + 6,
    y: baseY - g * plotH + 3,
    textAnchor: "start",
    fontSize: "9",
    fontFamily: "IBM Plex Mono",
    fill: lineColor
  }, isPct ? Math.round(lineMax * g) + '%' : fmt(Math.round(lineMax * g)))), data.map((d, i) => {
    const v = +d[barKey] || 0;
    const bh = m ? v / barMax * plotH : 0;
    const bw = Math.min(28, plotW / data.length * 0.5);
    const bx = cx(i) - bw / 2,
      by = baseY - bh;
    return React.createElement("g", {
      key: i,
      onMouseMove: e => {
        setHi(i);
        setTip({
          x: e.clientX,
          y: e.clientY,
          title: String(d[x]),
          rows: [{
            label: barLabel || barKey,
            value: fmt(v),
            color: barColor
          }, {
            label: lineLabel || lineKey,
            value: fmtLine(+d[lineKey] || 0),
            color: lineColor
          }]
        });
      },
      onMouseLeave: () => {
        setTip(null);
        setHi(-1);
      },
      style: {
        cursor: 'pointer'
      }
    }, React.createElement("rect", {
      x: cx(i) - plotW / data.length / 2,
      y: padT,
      width: plotW / data.length,
      height: plotH,
      fill: "transparent"
    }), React.createElement("rect", {
      x: bx,
      y: by,
      width: bw,
      height: Math.max(0, bh),
      rx: "4",
      fill: flat ? barColor : `url(#${id})`,
      style: flat ? undefined : {
        transition: 'y .7s cubic-bezier(.2,.8,.25,1), height .7s cubic-bezier(.2,.8,.25,1)'
      }
    }), m && v > 0 && React.createElement("text", {
      x: cx(i),
      y: by - 5,
      textAnchor: "middle",
      fontSize: "9.5",
      fontFamily: "IBM Plex Mono",
      fontWeight: "600",
      fill: barColor
    }, fmt(v)));
  }), React.createElement("path", {
    d: path,
    fill: "none",
    stroke: lineColor,
    strokeWidth: "2.5",
    strokeLinejoin: "round",
    strokeLinecap: "round",
    style: flat ? undefined : {
      strokeDasharray: 1600,
      strokeDashoffset: m ? 0 : 1600,
      transition: 'stroke-dashoffset 1.1s cubic-bezier(.4,0,.2,1)'
    }
  }), pts.map((p, i) => React.createElement("circle", {
    key: i,
    cx: p[0],
    cy: p[1],
    r: hi === i ? 5 : 3.4,
    fill: "#fff",
    stroke: lineColor,
    strokeWidth: "2.5",
    style: flat ? undefined : {
      opacity: m ? 1 : 0,
      transition: 'opacity .4s ' + (0.5 + i * 0.05) + 's, r .15s'
    }
  })), data.map((d, i) => React.createElement("text", {
    key: 'x' + i,
    x: cx(i),
    y: H - 6,
    textAnchor: "middle",
    fontSize: "9.5",
    fill: "#9aa6b4"
  }, String(d[x]).replace(/ \d{4}| 20\d\d/, '').slice(0, 6)))), tip);
}
function HBarChart({
  data,
  x,
  y,
  height,
  flat = false
}) {
  const mounted = useMounted();
  const m = flat || mounted;
  data = data || [];
  const max = Math.max(1, ...data.map(d => +d[y] || 0));
  const maxH = height || data.length * 30 + 8;
  const tall = data.length * 30 + 8 > maxH;
  return React.createElement("div", {
    style: {
      maxHeight: maxH,
      overflowY: tall ? 'auto' : 'visible',
      overflowX: 'hidden'
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 9,
      padding: '2px 0'
    }
  }, data.map((d, i) => {
    const v = +d[y] || 0;
    const c = PALETTE[i % PALETTE.length];
    return React.createElement("div", {
      key: i,
      style: {
        display: 'grid',
        gridTemplateColumns: '120px 1fr 54px',
        alignItems: 'center',
        gap: 10
      }
    }, React.createElement("div", {
      style: {
        fontSize: 12,
        fontWeight: 600,
        color: '#3c4858',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      },
      title: String(d[x])
    }, String(d[x])), React.createElement("div", {
      style: {
        height: 15,
        background: '#eef1f5',
        borderRadius: 5,
        overflow: 'hidden'
      }
    }, React.createElement("div", {
      style: {
        height: '100%',
        width: m ? `${v / max * 100}%` : '0%',
        background: flat ? c : `linear-gradient(90deg,${c},${c}cc)`,
        borderRadius: 5,
        transition: flat ? undefined : `width .8s ${i * 45}ms cubic-bezier(.2,.8,.25,1)`
      }
    })), React.createElement("div", {
      className: "num",
      style: {
        fontSize: 12.5,
        fontWeight: 600,
        textAlign: 'right',
        color: '#16202e',
        fontFamily: 'IBM Plex Mono'
      }
    }, fmt(v)));
  })));
}
function StackedPctBar({
  data,
  x,
  series,
  height = 260,
  flat = false
}) {
  const mounted = useMounted();
  const m = flat || mounted;
  const [tip, setTip] = useTip();
  data = data || [];
  series = series || [];
  const padT = 16,
    padB = 24;
  const plotH = height - padT - padB;
  const totals = data.map(d => series.reduce((s, k) => s + (+d[k.id] || 0), 0));
  const step = Math.max(40, Math.min(74, 560 / Math.max(1, data.length)));
  const W = Math.max(280, data.length * step),
    H = height;
  const baseY = padT + plotH;
  const ticks = [0, .25, .5, .75, 1];
  return React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      gap: 14,
      flexWrap: 'wrap',
      justifyContent: 'center',
      marginBottom: 6,
      fontSize: 11.5,
      color: '#3c4858'
    }
  }, series.map((s, i) => React.createElement("span", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, React.createElement("i", {
    style: {
      width: 11,
      height: 11,
      borderRadius: 3,
      background: s.color || PALETTE[i % PALETTE.length],
      display: 'inline-block'
    }
  }), s.label || s.id))), React.createElement("svg", {
    viewBox: `0 0 ${W} ${H}`,
    height: H,
    preserveAspectRatio: "none",
    style: {
      overflow: 'visible',
      width: '100%',
      maxWidth: Math.max(260, data.length * Math.max(64, step)),
      margin: '0 auto',
      display: 'block'
    }
  }, ticks.map((g, i) => React.createElement("g", {
    key: i
  }, React.createElement("line", {
    x1: "0",
    x2: W,
    y1: baseY - g * plotH,
    y2: baseY - g * plotH,
    stroke: "#eef1f5",
    strokeWidth: "1"
  }), React.createElement("text", {
    x: 2,
    y: baseY - g * plotH - 2,
    fontSize: "9",
    fontFamily: "IBM Plex Mono",
    fill: "#9aa6b4"
  }, Math.round(g * 100), "%"))), data.map((d, gi) => {
    const tot = totals[gi] || 0;
    const bw = Math.min(26, step * 0.5);
    const bx = gi * step + (step - bw) / 2;
    let acc = 0;
    return React.createElement("g", {
      key: gi,
      onMouseMove: e => setTip({
        x: e.clientX,
        y: e.clientY,
        title: String(d[x]),
        rows: series.map((s, si) => {
          const v = +d[s.id] || 0;
          const pc = tot ? v / tot * 100 : 0;
          return {
            label: s.label || s.id,
            value: fmt(v) + ` (${Math.round(pc)}%)`,
            color: s.color || PALETTE[si % PALETTE.length]
          };
        })
      }),
      onMouseLeave: () => setTip(null),
      style: {
        cursor: 'pointer'
      }
    }, React.createElement("rect", {
      x: gi * step,
      y: padT,
      width: step,
      height: plotH,
      fill: "transparent"
    }), series.map((s, si) => {
      const v = +d[s.id] || 0;
      const frac = tot ? v / tot : 0;
      const h = m ? frac * plotH : 0;
      const by = baseY - acc - h;
      acc += h;
      return React.createElement("rect", {
        key: si,
        x: bx,
        y: by,
        width: bw,
        height: Math.max(0, h),
        fill: s.color || PALETTE[si % PALETTE.length],
        rx: si === series.length - 1 ? 3 : 0,
        style: flat ? undefined : {
          transition: `all .6s ${si * 50}ms cubic-bezier(.2,.8,.25,1)`
        }
      });
    }), React.createElement("text", {
      x: gi * step + step / 2,
      y: H - 6,
      textAnchor: "middle",
      fontSize: "9.5",
      fill: "#9aa6b4"
    }, String(d[x]).replace(/ \d{4}| 20\d\d/, '').slice(0, 6)));
  })), tip);
}
function AreaTargetChart({
  data,
  x,
  y,
  target = null,
  height = 240,
  color = '#0090ca',
  flat = false
}) {
  const mounted = useMounted();
  const m = flat || mounted;
  const [tip, setTip] = useTip();
  const [hi, setHi] = React.useState(-1);
  data = data || [];
  const pad = 30,
    padB = 24,
    padT = 18;
  const W = Math.max(320, data.length * 60),
    H = height;
  const plotH = H - padT - padB;
  const vals = data.map(d => +d[y] || 0);
  const max = Math.max(1, ...vals, target != null ? target : 0);
  const min = 0;
  const px = i => pad + (data.length <= 1 ? (W - pad * 2) / 2 : i / (data.length - 1) * (W - pad * 2));
  const py = v => padT + plotH - (v - min) / (max - min || 1) * plotH;
  const baseY = padT + plotH;
  const pts = data.map((d, i) => [px(i), py(+d[y] || 0)]);
  const path = pts.length ? pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ') : '';
  const areaPath = pts.length ? path + ` L ${pts[pts.length - 1][0]} ${baseY} L ${pts[0][0]} ${baseY} Z` : '';
  const id = 'area' + String(y).replace(/\W/g, '');
  const ticks = [0, .25, .5, .75, 1];
  return React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, React.createElement("svg", {
    viewBox: `0 0 ${W} ${H}`,
    height: H,
    preserveAspectRatio: "none",
    style: {
      overflow: 'visible',
      width: '100%',
      maxWidth: Math.max(160, data.length * 80),
      margin: '0 auto',
      display: 'block'
    },
    onMouseLeave: () => {
      setTip(null);
      setHi(-1);
    }
  }, !flat && React.createElement("defs", null, React.createElement("linearGradient", {
    id: id,
    x1: "0",
    y1: "0",
    x2: "0",
    y2: "1"
  }, React.createElement("stop", {
    offset: "0%",
    stopColor: color,
    stopOpacity: "0.28"
  }), React.createElement("stop", {
    offset: "100%",
    stopColor: color,
    stopOpacity: "0"
  }))), ticks.map((g, i) => React.createElement("g", {
    key: i
  }, React.createElement("line", {
    x1: pad,
    x2: W - pad,
    y1: padT + g * plotH,
    y2: padT + g * plotH,
    stroke: "#eef1f5",
    strokeWidth: "1"
  }), React.createElement("text", {
    x: pad - 6,
    y: padT + g * plotH + 3,
    textAnchor: "end",
    fontSize: "9",
    fontFamily: "IBM Plex Mono",
    fill: "#9aa6b4"
  }, fmt(Math.round(max * (1 - g)))))), areaPath && React.createElement("path", {
    d: areaPath,
    fill: flat ? color : `url(#${id})`,
    fillOpacity: flat ? 0.12 : 1,
    style: flat ? undefined : {
      opacity: m ? 1 : 0,
      transition: 'opacity .9s .3s'
    }
  }), path && React.createElement("path", {
    d: path,
    fill: "none",
    stroke: color,
    strokeWidth: "2.5",
    strokeLinejoin: "round",
    strokeLinecap: "round",
    style: flat ? undefined : {
      strokeDasharray: 1600,
      strokeDashoffset: m ? 0 : 1600,
      transition: 'stroke-dashoffset 1.1s cubic-bezier(.4,0,.2,1)'
    }
  }), target != null && React.createElement("g", null, React.createElement("line", {
    x1: pad,
    x2: W - pad,
    y1: py(target),
    y2: py(target),
    stroke: "#d23a52",
    strokeWidth: "1.5",
    strokeDasharray: "5 4"
  }), React.createElement("text", {
    x: W - pad,
    y: py(target) - 4,
    textAnchor: "end",
    fontSize: "10",
    fontFamily: "IBM Plex Mono",
    fontWeight: "600",
    fill: "#d23a52"
  }, "target ", fmt(target))), pts.map((p, i) => React.createElement("g", {
    key: i
  }, React.createElement("rect", {
    x: px(i) - W / Math.max(1, data.length) / 2,
    y: padT,
    width: W / Math.max(1, data.length),
    height: plotH,
    fill: "transparent",
    onMouseMove: e => {
      setHi(i);
      setTip({
        x: e.clientX,
        y: e.clientY,
        title: String(data[i][x]),
        single: fmt(+data[i][y] || 0)
      });
    }
  }), React.createElement("circle", {
    cx: p[0],
    cy: p[1],
    r: hi === i ? 5 : 3.2,
    fill: "#fff",
    stroke: color,
    strokeWidth: "2.5",
    style: flat ? undefined : {
      opacity: m ? 1 : 0,
      transition: 'opacity .4s ' + (0.5 + i * 0.05) + 's, r .15s'
    }
  }))), hi >= 0 && React.createElement("line", {
    x1: px(hi),
    x2: px(hi),
    y1: padT,
    y2: baseY,
    stroke: color,
    strokeWidth: "1",
    strokeDasharray: "3 3",
    opacity: ".5"
  }), data.map((d, i) => React.createElement("text", {
    key: 'x' + i,
    x: px(i),
    y: H - 6,
    textAnchor: "middle",
    fontSize: "9.5",
    fill: "#9aa6b4"
  }, String(d[x]).replace(/ \d{4}| 20\d\d/, '').slice(0, 6)))), tip);
}
Object.assign(window, {
  ComboChart,
  HBarChart,
  StackedPctBar,
  AreaTargetChart
});
})();
;
/* ===== ui.jsx ===== */
(function(){
const I = {
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  pulse: 'M3 12h4l2 6 4-14 2 8h6',
  layers: 'M12 2 2 7l10 5 10-5zM2 12l10 5 10-5M2 17l10 5 10-5',
  input: 'M4 4h16v16H4zM4 9h16M9 4v16',
  doc: 'M6 2h9l5 5v15H6zM15 2v5h5M9 13h7M9 17h7',
  gear: 'M12 8a4 4 0 100 8 4 4 0 000-8zM2 12h2M20 12h2M12 2v2M12 20v2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5',
  bell: 'M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0',
  search: 'M11 4a7 7 0 105 12l4 4M11 4a7 7 0 015 12',
  chevR: 'M9 6l6 6-6 6',
  download: 'M12 3v12m0 0l4-4m-4 4l-4-4M4 19h16',
  upload: 'M12 21V9m0 0l4 4m-4-4l-4 4M4 5h16',
  filter: 'M3 5h18l-7 8v6l-4-2v-4z',
  plus: 'M12 5v14M5 12h14',
  check: 'M4 12l5 5L20 6',
  heart: 'M12 21s-8-5-10-10a5 5 0 019-3 5 5 0 019 3c-2 5-10 10-10 10z',
  bed: 'M3 7v10M3 12h12a4 4 0 014 4v1M3 17h18M7 9h4a2 2 0 010 4H3',
  activity: 'M3 12h4l2 6 4-14 2 8h6',
  steth: 'M6 3v5a4 4 0 008 0V3M19 14a3 3 0 11-6 0v-1M16 18v2',
  cal: 'M3 5h18v16H3zM3 9h18M8 3v4M16 3v4',
  syringe: 'M18 2l4 4M16 4l4 4-9 9H7v-4zM2 22l5-5',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0',
  trend: 'M3 17l6-6 4 4 8-8M21 7v5h-5',
  x: 'M6 6l12 12M18 6L6 18',
  edit: 'M4 20h4l11-11-4-4L4 16zM14 5l4 4',
  print: 'M6 9V3h12v6M6 18H4v-7h16v7h-2M8 14h8v7H8z',
  arrowR: 'M5 12h14M13 6l6 6-6 6',
  grip: 'M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01',
  star: 'M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5-4.8-4.6 6.6-.9z',
  phone: 'M22 16.92v3a2 2 0 01-2.18 2 19.8 19.8 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.8 19.8 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.36 1.9.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0122 16.92z'
};
function Ic({
  d,
  s = 18,
  sw = 1.9,
  c = 'currentColor',
  fill = 'none',
  style
}) {
  return React.createElement("svg", {
    width: s,
    height: s,
    viewBox: "0 0 24 24",
    fill: fill,
    stroke: c,
    strokeWidth: sw,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: style,
    className: "ico"
  }, d.split('M').filter(Boolean).map((seg, i) => React.createElement("path", {
    key: i,
    d: 'M' + seg
  })));
}
const DEPT_ICON = {
  er: I.pulse,
  opd: I.user,
  nicu: I.heart,
  endoscopy: I.activity,
  ot: I.syringe,
  sicu: I.bed,
  dialysis: I.activity,
  lvl10: I.bed,
  lvl9: I.bed,
  ldr: I.heart,
  micu: I.pulse,
  ccu: I.heart,
  cathlab: I.activity,
  ctvs: I.syringe,
  homecare: I.user
};
const UNICO_MODULES = [{
  id: 'stats',
  label: 'Statistics',
  short: 'Statistics',
  icon: I.grid,
  home: 'dashboard'
}, {
  id: 'datacol',
  label: 'Data Collection',
  short: 'Data',
  icon: I.input,
  home: 'dcReview'
}, {
  id: 'staff',
  label: 'Staff Management',
  short: 'Staff',
  icon: I.steth,
  home: 'nurseHome'
}, {
  id: 'quality',
  label: 'Quality Indicators',
  short: 'Quality',
  icon: I.heart,
  home: 'quality'
}, {
  id: 'supervisor',
  label: 'Supervisor Reports',
  short: 'Supervisor',
  icon: I.doc,
  home: 'supHome'
}, {
  id: 'reports',
  label: 'Reports',
  short: 'Reports',
  icon: I.doc,
  home: 'reports'
}, {
  id: 'users',
  label: 'User Management',
  short: 'Users',
  icon: I.user,
  home: 'users'
}, {
  id: 'perf',
  label: 'Performance',
  short: 'Performance',
  icon: I.doc,
  home: 'perfHome'
}, {
  id: 'roster',
  label: 'Duty Roster',
  short: 'Roster',
  icon: I.grid,
  home: 'rosterHome'
}, {
  id: 'medicine',
  label: 'Medicine & Rx',
  short: 'Medicine',
  icon: I.heart,
  home: 'medHome'
}];
const UNICO_MODULE_VIEWS = {
  stats: ['dashboard', 'departments', 'compare', 'gallery', 'manage', 'settings'],
  datacol: ['dcReview', 'dcPatient', 'dcQuality', 'input', 'dcSettings', 'dcShare', 'dcFields', 'dcAnalytics'],
  staff: ['nurseHome', 'nurses', 'nurseCompliance', 'pcaHome', 'pca', 'pcaCompliance', 'staffPrevious', 'staffProfile', 'staffForm'],
  quality: ['quality', 'qualityScore', 'qualityTrend', 'qualityIncidents', 'qualityDataEntry', 'qualityManage', 'qualityCatalog', 'qualityAssign', 'qualityCapa', 'qualityDept', 'qualityEdit', 'qualityEntry', 'qualityHub', 'qualityDeptManage'],
  supervisor: ['supHome', 'supBoard', 'supNew', 'supHistory', 'supReport'],
  reports: ['reports', 'reportsQuality', 'qualityReport', 'qualityReportQ'],
  users: ['users'],
  perf: ['perfHome', 'perfForm', 'perfPrint', 'perfAchievements', 'perfIncidents', 'perfCompare', 'perfAttrition', 'perfRisk', 'perfBoard'],
  roster: ['rosterHome', 'rosterGrid', 'rosterReview', 'rosterPrint', 'rosterFullReview', 'manpower'],
  medicine: ['medHome', 'medInfo', 'medBrowse', 'medBrand', 'medGeneric', 'medRxNew', 'medRxList', 'medRxPrint', 'medTemplates', 'medCatalog', 'medInteractions', 'medCalc', 'medAnalytics']
};
function unicoModuleOf(view) {
  for (let i = 0; i < UNICO_MODULES.length; i++) {
    const m = UNICO_MODULES[i];
    if ((UNICO_MODULE_VIEWS[m.id] || []).indexOf(view) >= 0) return m.id;
  }
  return 'stats';
}
const UNICO_ACCESS_MODULES = ['stats', 'quality', 'supervisor', 'staff', 'datacol', 'reports', 'users', 'perf', 'roster', 'medicine'];
function unicoAccessModuleOf(view) {
  if (view === 'settings') return 'users';
  return unicoModuleOf(view);
}
const UNICO_PERM_RANK = {
  none: 0,
  view: 1,
  edit: 2,
  add: 3,
  delete: 4
};
function unicoUserPerms() {
  const u = typeof window !== 'undefined' && window.__UNICO_USER__ || null;
  if (!u) return null;
  if (u.role === 'Administrator') return null;
  if (u.role === 'collector') return null;
  return u.perms && typeof u.perms === 'object' && !Array.isArray(u.perms) ? u.perms : {};
}
function unicoModuleLevel(mid) {
  const p = unicoUserPerms();
  if (!p) return 'delete';
  return p[mid] || 'none';
}
function unicoCan(mid, action) {
  const p = unicoUserPerms();
  if (!p) return true;
  const val = p[mid];
  if (Array.isArray(val)) {
    if (action === 'view') return val.length > 0;
    return val.indexOf(action) >= 0;
  }
  if (action === 'print') return false;
  return (UNICO_PERM_RANK[val || 'none'] || 0) >= (UNICO_PERM_RANK[action] || UNICO_PERM_RANK.view);
}
function unicoCanAccessModule(mid) {
  return unicoCan(mid, 'view');
}
function unicoCanAccessView(view) {
  if (view === 'profile' || view === 'home' || view === 'dcResponsibles') return true;
  return unicoCanAccessModule(unicoAccessModuleOf(view));
}
function unicoAllowedModules() {
  const p = unicoUserPerms();
  if (!p) return null;
  return UNICO_ACCESS_MODULES.filter(m => unicoCan(m, 'view'));
}
function unicoFirstAllowedHome() {
  const homes = [['stats', 'dashboard'], ['quality', 'quality'], ['supervisor', 'supHome'], ['medicine', 'medHome'], ['staff', 'nurseHome'], ['datacol', 'dcReview'], ['perf', 'perfHome'], ['roster', 'rosterHome'], ['reports', 'reports'], ['users', 'settings']];
  for (let i = 0; i < homes.length; i++) {
    if (unicoCanAccessModule(homes[i][0])) return homes[i][1];
  }
  return null;
}
function unicoRefreshPerms() {
  const u = typeof window !== 'undefined' && window.__UNICO_USER__ || null;
  if (!u || !u.username || u.role === 'Administrator' || ['collector', 'incharge', 'nurse', 'pca'].indexOf(u.role) >= 0) return Promise.resolve(false);
  return fetch('/api/me', {
    credentials: 'same-origin',
    cache: 'no-store'
  }).then(r => r.ok ? r.json() : null).then(j => {
    if (!j || !j.ok || j.degraded || !j.perms || typeof j.perms !== 'object' || Array.isArray(j.perms)) return false;
    const staffScope = j.staffScope || u.staffScope;
    if (JSON.stringify(j.perms) === JSON.stringify(u.perms || null) && staffScope === u.staffScope) return false;
    const appJob = window.unicoRefreshAppData ? window.unicoRefreshAppData({
      includeNew: true
    }) : Promise.resolve([]);
    const jobs = [appJob];
    try {
      if (window.UNICO && window.UNICO.refreshDepartments) jobs.push(window.UNICO.refreshDepartments());
    } catch (e) {}
    try {
      if (window.refreshQualitySeed) jobs.push(window.refreshQualitySeed());
    } catch (e) {}
    return Promise.all(jobs.map(p => Promise.resolve(p).catch(() => null))).then(res => {
      if (res[0] === null) return false;
      Object.assign(u, {
        perms: j.perms,
        staffScope
      });
      try {
        window.dispatchEvent(new CustomEvent('unico:perms-changed', {
          detail: {
            perms: j.perms
          }
        }));
      } catch (e) {}
      return true;
    });
  }).catch(() => false);
}
function unicoSidebarGroups(moduleId) {
  if (moduleId === 'datacol') return [{
    sec: 'Data Collection',
    items: [{
      id: 'dcPatient',
      label: 'Patient Statistics',
      icon: I.input
    }, {
      id: 'dcQuality',
      label: 'Quality Data',
      icon: I.activity
    }, {
      id: 'dcSettings',
      label: 'Department Setup',
      icon: I.gear
    }, {
      id: 'dcShare',
      label: 'Share Links',
      icon: I.arrowR
    }, {
      id: 'dcFields',
      label: 'Form Fields',
      icon: I.filter
    }, {
      id: 'dcReview',
      label: 'Review & History',
      icon: I.doc
    }]
  }];
  if (moduleId === 'staff') return [{
    sec: 'Staff Management',
    items: [{
      id: 'nurseHome',
      label: 'Dashboard',
      icon: I.grid,
      match: ['nurseHome', 'pcaHome']
    }, {
      id: 'nurses',
      label: 'Directory',
      icon: I.layers,
      match: ['nurses', 'pca']
    }, {
      id: 'nurseCompliance',
      label: 'Compliance',
      icon: I.heart,
      match: ['nurseCompliance', 'pcaCompliance']
    }, {
      id: 'staffPrevious',
      label: 'Previous Staff',
      icon: I.doc
    }, {
      id: 'perfHome',
      label: 'Performance',
      icon: I.trend
    }, {
      id: 'rosterHome',
      label: 'Duty Roster',
      icon: I.grid
    }]
  }];
  if (moduleId === 'quality') return [{
    sec: 'Monitor',
    items: [{
      id: 'quality',
      label: 'Dashboard',
      icon: I.grid,
      match: ['quality', 'qualityDept']
    }, {
      id: 'qualityScore',
      label: 'Scorecard',
      icon: I.layers
    }, {
      id: 'qualityTrend',
      label: 'Trends',
      icon: I.trend
    }]
  }, {
    sec: 'Reporting',
    items: [{
      id: 'qualityIncidents',
      label: 'Incident Reports',
      icon: I.activity
    }]
  }, {
    sec: 'Administration',
    items: [{
      id: 'qualityDeptManage',
      label: 'Manage Departments',
      icon: I.layers
    }, {
      id: 'qualityManage',
      label: 'Indicator Administration',
      icon: I.edit,
      match: ['qualityManage', 'qualityCatalog', 'qualityAssign', 'qualityEdit']
    }, {
      id: 'qualityDataEntry',
      label: 'Quality Data Entry',
      icon: I.input
    }, {
      id: 'qualityCapa',
      label: 'Action Plans',
      icon: I.check
    }]
  }];
  if (moduleId === 'reports') return [{
    sec: 'Report Generator',
    items: [{
      id: 'reports',
      label: 'Patient Statistics',
      icon: I.doc
    }, {
      id: 'reportsQuality',
      label: 'Quality Indicators',
      icon: I.heart
    }]
  }];
  if (moduleId === 'users') return [{
    sec: 'User Management',
    items: [{
      id: 'users',
      label: 'All Users & Roles',
      icon: I.user
    }]
  }];
  return [{
    sec: 'Overview',
    items: [{
      id: 'dashboard',
      label: 'Dashboard',
      icon: I.grid
    }, {
      id: 'departments',
      label: 'Departments',
      icon: I.layers
    }, {
      id: 'compare',
      label: 'Compare',
      icon: I.trend
    }, {
      id: 'manage',
      label: 'Manage Depts',
      icon: I.edit
    }, {
      id: 'input',
      label: 'Data Entry',
      icon: I.input
    }, {
      id: 'settings',
      label: 'Settings',
      icon: I.gear
    }]
  }];
}
function ModuleSwitch({
  route,
  setRoute
}) {
  const cur = unicoModuleOf(route.view);
  return React.createElement("div", {
    className: "seg modswitch",
    style: {
      flexShrink: 0,
      marginRight: 10
    },
    title: "Switch workspace"
  }, UNICO_MODULES.map(m => React.createElement("button", {
    key: m.id,
    className: cur === m.id ? 'on' : '',
    title: m.label,
    onClick: () => {
      if (cur !== m.id) setRoute({
        view: m.home
      });
    },
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      whiteSpace: 'nowrap'
    }
  }, React.createElement(Ic, {
    d: m.icon,
    s: 15
  }), React.createElement("span", {
    className: "modswitch-lbl"
  }, m.short))));
}
function unicoPeriodMonths(allMonths, period) {
  if (!period || period.mode === 'all') return null;
  if (period.mode === 'latest') return allMonths.slice(-1);
  if (period.mode === 'last3') return allMonths.slice(-3);
  if (period.mode === 'last6') return allMonths.slice(-6);
  if (period.mode === 'q1') {
    const yy = allMonths.length ? String(allMonths[allMonths.length - 1]).split('-')[1] : '';
    const q = ['Jan-' + yy, 'Feb-' + yy, 'Mar-' + yy].filter(m => allMonths.includes(m));
    return q.length ? q : null;
  }
  if (period.mode === 'custom') {
    const fi = allMonths.indexOf(period.from),
      ti = allMonths.indexOf(period.to);
    if (fi < 0 || ti < 0) return null;
    const a = Math.min(fi, ti),
      b = Math.max(fi, ti);
    return allMonths.slice(a, b + 1);
  }
  return null;
}
window.unicoPeriodMonths = unicoPeriodMonths;
function unicoQualityBreachCount() {
  try {
    const Qh = window.UNICO_Q;
    if (!window.qualityData || !Qh) return 0;
    const areas = window.qualityData();
    const months = Qh.fyAxis(Qh.defaultFy(areas));
    let br = 0;
    areas.forEach(d => (d.indicators || []).forEach(ind => {
      br += Qh.countBreaches(ind, months);
    }));
    return br;
  } catch (e) {
    return 0;
  }
}
window.unicoQualityBreachCount = unicoQualityBreachCount;
function unicoSupAlertCount() {
  try {
    return window.__UNICO_SUP_ALERTS__ || 0;
  } catch (e) {
    return 0;
  }
}
window.unicoSupAlertCount = unicoSupAlertCount;
const UNICO_WS = [{
  sec: '',
  items: [{
    id: 'home',
    label: 'Home',
    icon: I.pulse,
    home: 'home',
    on: v => v === 'home',
    always: true
  }, {
    id: 'overview',
    label: 'Overview',
    icon: I.grid,
    home: 'dashboard',
    on: v => v === 'dashboard'
  }, {
    id: 'profile',
    label: 'My Profile',
    icon: I.user,
    home: 'profile',
    on: v => v === 'profile',
    always: true
  }]
}, {
  sec: 'Clinical',
  items: [{
    id: 'departments',
    label: 'Departments',
    icon: I.layers,
    home: 'departments',
    on: v => unicoModuleOf(v) === 'stats' && ['dashboard', 'settings', 'profile', 'home'].indexOf(v) < 0
  }, {
    id: 'quality',
    label: 'Quality',
    icon: I.heart,
    home: 'quality',
    on: v => unicoModuleOf(v) === 'quality',
    badge: true
  }, {
    id: 'supervisor',
    label: 'Supervisor Reports',
    icon: I.doc,
    home: 'supHome',
    on: v => unicoModuleOf(v) === 'supervisor',
    badge: 'sup'
  }, {
    id: 'medicine',
    label: 'Medicine & Rx',
    icon: I.syringe,
    home: 'medHome',
    on: v => unicoModuleOf(v) === 'medicine',
    tag: 'NEW'
  }]
}, {
  sec: 'Data',
  items: [{
    id: 'datacol',
    label: 'Data Collection',
    icon: I.input,
    home: 'dcReview',
    on: v => unicoModuleOf(v) === 'datacol'
  }, {
    id: 'reports',
    label: 'Reports',
    icon: I.doc,
    home: 'reports',
    on: v => unicoModuleOf(v) === 'reports'
  }]
}, {
  sec: 'Administer',
  items: [{
    id: 'staff',
    label: 'Staff Management',
    icon: I.steth,
    home: 'nurseHome',
    mods: ['staff', 'perf', 'roster'],
    on: v => ['staff', 'perf', 'roster'].indexOf(unicoModuleOf(v)) >= 0
  }, {
    id: 'settings',
    label: 'Settings',
    icon: I.gear,
    home: 'settings',
    on: v => v === 'settings' || unicoModuleOf(v) === 'users'
  }]
}];
const UNICO_VIEW_TABS = [{
  mod: 'perf',
  hide: ['perfForm', 'perfPrint'],
  parent: {
    perfRisk: 'perfAttrition'
  },
  tabs: [['perfHome', 'Overview'], ['perfAchievements', 'Achievements'], ['perfIncidents', 'Incidents'], ['perfBoard', 'Recognition'], ['perfAttrition', 'Attrition & Exits'], ['perfCompare', 'By Department']]
}, {
  mod: 'roster',
  hide: ['rosterPrint'],
  parent: {
    rosterGrid: 'rosterHome',
    rosterReview: 'rosterHome'
  },
  tabs: [['rosterHome', 'Rosters'], ['manpower', 'Manpower'], ['rosterFullReview', 'Full Review']]
}];
function unicoViewTabs(view) {
  for (let i = 0; i < UNICO_VIEW_TABS.length; i++) {
    const g = UNICO_VIEW_TABS[i];
    if (unicoModuleOf(view) !== g.mod) continue;
    if ((g.hide || []).indexOf(view) >= 0) return null;
    return {
      cur: g.parent && g.parent[view] || view,
      tabs: g.tabs
    };
  }
  return null;
}
function ViewTabs({
  view,
  setRoute
}) {
  const g = unicoViewTabs(view);
  if (!g) return null;
  return React.createElement("div", {
    className: "seg",
    style: {
      alignSelf: 'flex-start',
      maxWidth: '100%',
      flexWrap: 'wrap',
      marginBottom: 12
    }
  }, g.tabs.map(([v, label]) => React.createElement("button", {
    key: v,
    className: g.cur === v ? 'on' : '',
    onClick: () => {
      if (g.cur !== v) setRoute({
        view: v
      });
    }
  }, label)));
}
function wsHome(it) {
  if (!it.mods) return it.home;
  if (unicoCanAccessModule(unicoAccessModuleOf(it.home))) return it.home;
  for (let i = 0; i < it.mods.length; i++) {
    const h = UNICO_MODULE_VIEWS[it.mods[i]] && UNICO_MODULE_VIEWS[it.mods[i]][0];
    if (h && unicoCanAccessModule(it.mods[i])) return h;
  }
  return it.home;
}
function unicoWorkspaceSub(view) {
  const mod = unicoModuleOf(view);
  if (view === 'home') return [];
  if (view === 'profile') return [];
  if (view === 'settings' || mod === 'users') return [];
  if (mod === 'stats' && view !== 'dashboard' && view !== 'settings') return [{
    label: 'Compare',
    view: 'compare'
  }];
  if (mod === 'quality') return [{
    label: 'Scorecard',
    view: 'qualityScore'
  }, {
    label: 'Trends',
    view: 'qualityTrend'
  }, {
    label: 'Incident Reports',
    view: 'qualityIncidents'
  }, {
    label: 'Indicator Administration',
    view: 'qualityManage',
    match: ['qualityManage', 'qualityCatalog', 'qualityAssign', 'qualityEdit']
  }, {
    label: 'Quality Data Entry',
    view: 'qualityDataEntry'
  }, {
    label: 'Action Plans',
    view: 'qualityCapa'
  }];
  if (mod === 'supervisor') return [{
    label: 'Dashboard',
    view: 'supHome'
  }, {
    label: 'Patient Board',
    view: 'supBoard'
  }, {
    label: 'New Report',
    view: 'supNew'
  }, {
    label: 'History',
    view: 'supHistory'
  }, {
    label: 'Generate Report',
    view: 'supReport'
  }];
  if (mod === 'staff' || mod === 'perf' || mod === 'roster') return [{
    label: 'Dashboard',
    view: 'nurseHome',
    mod: 'staff',
    match: ['nurseHome', 'pcaHome']
  }, {
    label: 'Directory',
    view: 'nurses',
    mod: 'staff',
    match: ['nurses', 'pca']
  }, {
    label: 'Compliance',
    view: 'nurseCompliance',
    mod: 'staff',
    match: ['nurseCompliance', 'pcaCompliance']
  }, {
    label: 'Previous Staff',
    view: 'staffPrevious',
    mod: 'staff'
  }, {
    label: 'Performance',
    view: 'perfHome',
    mod: 'perf',
    divider: true,
    match: UNICO_MODULE_VIEWS.perf
  }, {
    label: 'Duty Roster',
    view: 'rosterHome',
    mod: 'roster',
    match: UNICO_MODULE_VIEWS.roster
  }];
  if (mod === 'medicine') return [{
    label: 'Medicine Info',
    view: 'medInfo'
  }, {
    label: 'Drug Index',
    view: 'medBrowse',
    match: ['medBrowse', 'medBrand', 'medGeneric']
  }, {
    label: 'New Prescription',
    view: 'medRxNew'
  }, {
    label: 'Prescriptions',
    view: 'medRxList',
    match: ['medRxList', 'medRxPrint']
  }, {
    label: 'Interaction Checker',
    view: 'medInteractions'
  }, {
    label: 'Dose Calculator',
    view: 'medCalc'
  }, {
    label: 'Rx Templates',
    view: 'medTemplates'
  }, {
    label: 'Prescribing Stats',
    view: 'medAnalytics'
  }, {
    label: 'Drug Catalogue',
    view: 'medCatalog'
  }];
  if (mod === 'reports') return [{
    label: 'Patient Statistics',
    view: 'reports'
  }, {
    label: 'Quality Indicators',
    view: 'reportsQuality'
  }];
  if (mod === 'datacol') return [{
    label: 'Data Entry',
    view: 'input'
  }, {
    label: 'Review & History',
    view: 'dcReview'
  }, {
    label: 'Performance',
    view: 'dcAnalytics'
  }, {
    label: 'Patient Statistics',
    view: 'dcPatient'
  }, {
    label: 'Quality Data',
    view: 'dcQuality'
  }, {
    label: 'Department Setup',
    view: 'dcSettings'
  }, {
    label: 'Share Links',
    view: 'dcShare'
  }];
  return [];
}
function MyAccount({
  onClose
}) {
  const {
    useState
  } = React;
  const u = typeof window !== 'undefined' && window.__UNICO_USER__ || null;
  const [tab, setTab] = useState('password');
  const [name, setName] = useState(u && u.name || '');
  const [email, setEmail] = useState(u && u.email || '');
  const [cur, setCur] = useState('');
  const [nw, setNw] = useState('');
  const [nw2, setNw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [photo, setPhoto] = useState(u && u.photo || null);
  const api = (method, path, body) => fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'same-origin',
    body: body ? JSON.stringify(body) : undefined
  }).then(async r => {
    let j = null;
    try {
      j = await r.json();
    } catch (e) {}
    if (!r.ok || !j || j.ok === false) throw new Error(j && j.error || (r.status === 401 ? 'Sign in to manage your account.' : 'Request failed (' + r.status + ').'));
    return j;
  });
  const txt = {
    padding: '9px 11px',
    border: '1px solid var(--line)',
    borderRadius: 8,
    fontSize: 13,
    fontFamily: 'inherit',
    width: '100%',
    outline: 'none',
    background: '#fff',
    boxSizing: 'border-box'
  };
  const savePw = async () => {
    setErr('');
    setOk('');
    if (nw.length < 6) return setErr('New password must be at least 6 characters.');
    if (nw !== nw2) return setErr('New passwords do not match.');
    setBusy(true);
    try {
      await api('POST', '/api/me/password', {
        currentPassword: cur,
        newPassword: nw
      });
      setOk('Password changed successfully.');
      setCur('');
      setNw('');
      setNw2('');
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  const saveProfile = async () => {
    setErr('');
    setOk('');
    setBusy(true);
    try {
      await api('PATCH', '/api/me', {
        name,
        email
      });
      if (window.__UNICO_USER__) {
        window.__UNICO_USER__.name = name;
        window.__UNICO_USER__.email = email;
      }
      setOk('Profile updated. Reload to see it everywhere.');
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  const role = u ? u.role === 'collector' ? 'Data Collector' : u.title || u.role : 'Administrator (local)';
  const initials = String(u && u.name || 'U').split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'U';
  const modal = React.createElement("div", {
    onMouseDown: onClose,
    style: {
      position: 'fixed',
      inset: 0,
      background: 'rgba(16,32,46,.42)',
      zIndex: 500,
      display: 'grid',
      placeItems: 'center',
      padding: 'clamp(6px,3vw,20px)'
    }
  }, React.createElement("div", {
    onMouseDown: e => e.stopPropagation(),
    className: "card",
    style: {
      width: 'min(440px,96vw)',
      maxHeight: '92vh',
      overflow: 'auto'
    }
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, "My Account"), React.createElement("span", {
    className: "spacer"
  }), React.createElement("button", {
    className: "icon-btn",
    style: {
      width: 28,
      height: 28
    },
    onClick: onClose
  }, React.createElement(Ic, {
    d: I.x,
    s: 14
  }))), React.createElement("div", {
    className: "card-b",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, React.createElement(PhotoPicker, {
    value: photo,
    size: 54,
    kind: "profile",
    initials: initials,
    name: u && u.name || 'Account',
    readOnly: !u,
    onChange: next => {
      setPhoto(next);
      window.unicoSetAccountPhoto(next);
    }
  }), React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, React.createElement("div", {
    style: {
      fontSize: 14.5,
      fontWeight: 700,
      color: 'var(--ink)'
    }
  }, u && u.name || 'Local Administrator'), React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--muted)'
    }
  }, u ? '@' + u.username + ' · ' + role : role))), !u && React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: '#9a6b00',
      background: 'var(--warn-bg,#fff4e0)',
      border: '1px solid #f0d9a8',
      borderRadius: 8,
      padding: '9px 11px'
    }
  }, "You're in local admin mode (no login). Account settings apply on the deployed site where sign-in is required."), React.createElement("div", {
    className: "seg"
  }, React.createElement("button", {
    className: tab === 'password' ? 'on' : '',
    onClick: () => {
      setTab('password');
      setErr('');
      setOk('');
    }
  }, "Password"), React.createElement("button", {
    className: tab === 'profile' ? 'on' : '',
    onClick: () => {
      setTab('profile');
      setErr('');
      setOk('');
    }
  }, "Profile")), tab === 'password' ? React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, React.createElement("div", {
    className: "field"
  }, React.createElement("label", null, "Current password"), React.createElement("input", {
    type: "password",
    style: txt,
    value: cur,
    onChange: e => setCur(e.target.value),
    placeholder: "Enter current password"
  })), React.createElement("div", {
    className: "field"
  }, React.createElement("label", null, "New password"), React.createElement("input", {
    type: "password",
    style: txt,
    value: nw,
    onChange: e => setNw(e.target.value),
    placeholder: "At least 6 characters"
  })), React.createElement("div", {
    className: "field"
  }, React.createElement("label", null, "Confirm new password"), React.createElement("input", {
    type: "password",
    style: txt,
    value: nw2,
    onChange: e => setNw2(e.target.value),
    placeholder: "Re-enter new password"
  })), React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'flex-end'
    }
  }, React.createElement("button", {
    className: "btn pri sm",
    onClick: savePw,
    disabled: busy
  }, React.createElement(Ic, {
    d: I.check,
    s: 14
  }), busy ? 'Saving…' : 'Change password'))) : React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, React.createElement("div", {
    className: "field"
  }, React.createElement("label", null, "Full name"), React.createElement("input", {
    style: txt,
    value: name,
    onChange: e => setName(e.target.value),
    placeholder: "Display name"
  })), React.createElement("div", {
    className: "field"
  }, React.createElement("label", null, "Email"), React.createElement("input", {
    style: txt,
    value: email,
    onChange: e => setEmail(e.target.value),
    placeholder: "name@unicohospitals.com"
  })), React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'flex-end'
    }
  }, React.createElement("button", {
    className: "btn pri sm",
    onClick: saveProfile,
    disabled: busy
  }, React.createElement(Ic, {
    d: I.check,
    s: 14
  }), busy ? 'Saving…' : 'Save profile'))), err && React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: '#b32339',
      background: 'var(--neg-bg)',
      borderRadius: 7,
      padding: '8px 10px'
    }
  }, err), ok && React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'var(--pos)',
      background: 'var(--pos-bg)',
      borderRadius: 7,
      padding: '8px 10px'
    }
  }, ok), React.createElement("div", {
    style: {
      borderTop: '1px solid var(--line-2)',
      paddingTop: 12,
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, React.createElement("span", {
    style: {
      fontSize: 11.5,
      color: 'var(--muted)'
    }
  }, "Signed in as ", u ? u.role : 'local admin'), React.createElement("span", {
    className: "spacer",
    style: {
      flex: 1
    }
  }), React.createElement("a", {
    href: "/logout",
    className: "btn sm",
    style: {
      color: 'var(--rose)',
      borderColor: '#f1c6cd',
      textDecoration: 'none'
    }
  }, "Sign out")))));
  return typeof ReactDOM !== 'undefined' && ReactDOM.createPortal && typeof document !== 'undefined' ? ReactDOM.createPortal(modal, document.body) : modal;
}
window.MyAccount = MyAccount;
function Sidebar({
  route,
  setRoute,
  collapsed,
  depts
}) {
  const [acct, setAcct] = React.useState(false);
  const view = route.view;
  const [chunkTick, setChunkTick] = React.useState(0);
  React.useEffect(() => {
    const h = () => setChunkTick(t => t + 1);
    window.addEventListener('unico:chunk-loaded', h);
    return () => window.removeEventListener('unico:chunk-loaded', h);
  }, []);
  const qBadge = React.useMemo(() => window.UNICO_Q ? unicoQualityBreachCount() : 0, [chunkTick]);
  const supBadge = React.useMemo(() => unicoSupAlertCount(), [view, chunkTick]);
  const sub = unicoWorkspaceSub(view).filter(s => !s.mod || unicoCanAccessModule(s.mod));
  const subOn = s => s.match ? s.match.indexOf(view) >= 0 : view === s.view;
  return React.createElement("aside", {
    className: "sb"
  }, React.createElement("div", {
    className: "sb-brand"
  }, React.createElement("img", {
    className: "sb-logo-img sb-logo-full",
    src: "unico/logo.svg",
    alt: "UNICO \u2014 Hands of Care Hospitals"
  }), React.createElement("img", {
    className: "sb-logo-img sb-logo-mark",
    src: "unico/logo-mark.svg",
    alt: "UNICO"
  })), React.createElement("div", {
    className: "sb-scroll"
  }, UNICO_WS.map((g, gi) => {
    const items = g.items.filter(it => it.always || (it.mods ? it.mods.some(m => unicoCanAccessModule(m)) : unicoCanAccessModule(unicoAccessModuleOf(it.home))));
    if (!items.length) return null;
    return React.createElement(React.Fragment, {
      key: gi
    }, g.sec && React.createElement("div", {
      className: "sb-sec"
    }, g.sec), items.map(it => {
      const active = it.on(view);
      const badgeN = it.badge === 'sup' ? supBadge : it.badge ? qBadge : 0;
      const badge = badgeN > 0 ? badgeN : null;
      return React.createElement(React.Fragment, {
        key: it.id
      }, React.createElement("div", {
        className: 'sb-item' + (active ? ' active' : ''),
        onClick: () => setRoute({
          view: wsHome(it)
        }),
        title: it.label
      }, React.createElement(Ic, {
        d: it.icon,
        s: 18
      }), React.createElement("span", {
        className: "lbl"
      }, it.label), it.tag && React.createElement("span", {
        className: "lbl",
        style: {
          marginLeft: 6,
          fontSize: 8.6,
          fontWeight: 800,
          letterSpacing: .6,
          padding: '2px 6px',
          borderRadius: 5,
          color: '#0d1b2e',
          background: 'linear-gradient(135deg,#5fd3c4,#3ab5a7)'
        }
      }, it.tag), badge != null && React.createElement("span", {
        className: "badge alert num"
      }, badge)), active && sub.length > 0 && React.createElement("div", {
        className: "sb-sub"
      }, sub.map((s, si) => React.createElement("div", {
        key: s.view,
        className: 'sb-sub-item' + (subOn(s) ? ' active' : ''),
        onClick: () => setRoute({
          view: s.view
        }),
        style: s.divider && si > 0 ? {
          marginTop: 7,
          paddingTop: 9,
          borderTop: '1px solid rgba(255,255,255,.10)'
        } : null
      }, React.createElement("span", {
        className: "dot"
      }), React.createElement("span", {
        className: "lbl"
      }, s.label)))));
    }));
  })), React.createElement("div", {
    className: "sb-foot"
  }, (() => {
    const u = typeof window !== 'undefined' && window.__UNICO_USER__ || null;
    const name = u && u.name || 'Nasif Ahammed Niloy';
    const role = u && u.designation || (u ? u.role === 'collector' ? 'Data Collector' : u.role === 'incharge' ? 'In-charge' : u.role : 'Administrator');
    const initials = String(name).split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'U';
    return React.createElement(React.Fragment, null, React.createElement("div", {
      onClick: () => setRoute({
        view: 'profile'
      }),
      title: "My profile \u2014 photo, details & password",
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        minWidth: 0,
        flex: 1,
        cursor: 'pointer'
      }
    }, React.createElement(UnicoAvatar, {
      className: "avatar",
      initials: initials
    }), React.createElement("div", {
      className: "who",
      style: {
        minWidth: 0,
        flex: 1
      }
    }, React.createElement("div", {
      style: {
        color: '#fff',
        fontSize: 12.5,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, name), React.createElement("div", {
      style: {
        color: '#83909f',
        fontSize: 10.5,
        whiteSpace: 'nowrap'
      }
    }, role))), React.createElement("a", {
      href: "/logout",
      title: "Sign out",
      style: {
        marginLeft: 'auto',
        display: 'grid',
        placeItems: 'center',
        width: 32,
        height: 32,
        borderRadius: 8,
        color: '#cfe0f0',
        background: 'rgba(255,255,255,.08)',
        textDecoration: 'none',
        flexShrink: 0
      }
    }, React.createElement("svg", {
      width: "16",
      height: "16",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"
    }), React.createElement("path", {
      d: "M16 17l5-5-5-5"
    }), React.createElement("path", {
      d: "M21 12H9"
    }))));
  })()), acct && React.createElement(MyAccount, {
    onClose: () => setAcct(false)
  }));
}
const NMONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const NMONS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function nextMonthKey(mk) {
  const [m, y] = mk.split('-');
  let i = NMONS.indexOf(m) + 1,
    yy = +y;
  if (i > 11) {
    i = 0;
    yy++;
  }
  return NMONS[i] + '-' + String(yy).padStart(2, '0');
}
function mnum(mk) {
  const [m, y] = mk.split('-');
  return (2000 + +y) * 12 + NMONS.indexOf(m);
}
function monthFull(mk) {
  const [m, y] = mk.split('-');
  return NMONS_FULL[NMONS.indexOf(m)] + ' 20' + y;
}
function PeriodPill({
  period,
  setPeriod,
  depts = []
}) {
  const [open, setOpen] = React.useState(false);
  const MO = window.UNICO.MONTH_ORDER;
  const allMonths = [...new Set(depts.flatMap(d => d.months || []))].sort((a, b) => MO.indexOf(a) - MO.indexOf(b));
  const fmtKey = k => String(k || '').replace('-', ' ');
  const active = unicoPeriodMonths(allMonths, period) || allMonths;
  const label = active.length ? `${fmtKey(active[0])} – ${fmtKey(active[active.length - 1])}` : 'No data';
  const q1yr = allMonths.length ? '20' + String(allMonths[allMonths.length - 1]).split('-')[1] : '';
  const presets = [['all', 'All time'], ['last3', 'Last 3 months'], ['last6', 'Last 6 months'], ['q1', 'Q1' + (q1yr ? ' ' + q1yr : '')], ['latest', 'Latest month']];
  const cur = period && period.mode || 'all';
  const pick = mode => {
    setPeriod({
      mode
    });
    setOpen(false);
  };
  const first = allMonths[0],
    last = allMonths[allMonths.length - 1];
  const cFrom = period && period.mode === 'custom' && period.from || first;
  const cTo = period && period.mode === 'custom' && period.to || last;
  return React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, React.createElement("button", {
    className: "tb-pill",
    onClick: () => setOpen(o => !o),
    title: "Filter dashboard period",
    style: {
      cursor: 'pointer',
      border: '1px solid ' + (cur !== 'all' ? 'var(--blue-100)' : 'var(--line)'),
      background: cur !== 'all' ? 'var(--blue-50)' : 'var(--panel-2)'
    }
  }, React.createElement(Ic, {
    d: I.cal,
    s: 14,
    c: "#0b66d0"
  }), React.createElement("span", {
    className: "num"
  }, label), React.createElement(Ic, {
    d: I.chevR,
    s: 12,
    style: {
      transform: 'rotate(90deg)',
      opacity: .55
    }
  })), open && React.createElement("div", {
    onMouseLeave: () => setOpen(false),
    style: {
      position: 'absolute',
      right: 0,
      top: '118%',
      zIndex: 200,
      width: 236,
      background: 'rgba(255,255,255,.88)',
      backdropFilter: 'blur(24px) saturate(1.6)',
      WebkitBackdropFilter: 'blur(24px) saturate(1.6)',
      border: '1px solid rgba(255,255,255,.92)',
      boxShadow: '0 22px 56px rgba(31,59,90,.26)',
      borderRadius: 12,
      overflow: 'hidden'
    }
  }, React.createElement("div", {
    style: {
      padding: '10px 13px',
      borderBottom: '1px solid var(--line-2)',
      fontSize: 11,
      fontWeight: 700,
      color: 'var(--ink-2)',
      textTransform: 'uppercase',
      letterSpacing: .4
    }
  }, "Reporting period"), React.createElement("div", {
    style: {
      padding: 6
    }
  }, presets.map(([m, l]) => React.createElement("div", {
    key: m,
    onClick: () => pick(m),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      padding: '8px 10px',
      borderRadius: 7,
      cursor: 'pointer',
      fontSize: 12.5,
      fontWeight: 600,
      background: cur === m ? 'var(--blue-50)' : 'transparent',
      color: cur === m ? 'var(--blue-700)' : 'var(--ink-2)'
    },
    onMouseEnter: e => {
      if (cur !== m) e.currentTarget.style.background = 'var(--panel-2)';
    },
    onMouseLeave: e => {
      if (cur !== m) e.currentTarget.style.background = 'transparent';
    }
  }, React.createElement("span", {
    style: {
      width: 14,
      display: 'inline-flex'
    }
  }, cur === m && React.createElement(Ic, {
    d: I.check,
    s: 13,
    c: "var(--blue)"
  })), l))), React.createElement("div", {
    style: {
      borderTop: '1px solid var(--line-2)',
      padding: '10px 12px'
    }
  }, React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 600,
      color: cur === 'custom' ? 'var(--blue-700)' : 'var(--muted)',
      marginBottom: 6
    }
  }, "Custom range"), React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, React.createElement("select", {
    value: cFrom,
    onChange: e => setPeriod({
      mode: 'custom',
      from: e.target.value,
      to: cTo
    }),
    style: {
      flex: 1,
      minWidth: 0,
      padding: '6px 7px',
      border: '1px solid var(--line)',
      borderRadius: 6,
      fontSize: 11.5,
      fontFamily: 'inherit',
      background: '#fff'
    }
  }, allMonths.map(m => React.createElement("option", {
    key: m,
    value: m
  }, fmtKey(m)))), React.createElement("span", {
    style: {
      fontSize: 11,
      color: 'var(--muted)'
    }
  }, "to"), React.createElement("select", {
    value: cTo,
    onChange: e => setPeriod({
      mode: 'custom',
      from: cFrom,
      to: e.target.value
    }),
    style: {
      flex: 1,
      minWidth: 0,
      padding: '6px 7px',
      border: '1px solid var(--line)',
      borderRadius: 6,
      fontSize: 11.5,
      fontFamily: 'inherit',
      background: '#fff'
    }
  }, allMonths.map(m => React.createElement("option", {
    key: m,
    value: m
  }, fmtKey(m))))))));
}
function TopBar({
  route,
  setRoute,
  onBurger,
  crumbs,
  actions,
  depts = [],
  onFill,
  period,
  setPeriod
}) {
  const [notifOpen, setNotifOpen] = React.useState(false);
  const reporting = depts.filter(d => d.months && d.months.length && d.latest && d.latest.month);
  const nexts = reporting.map(d => nextMonthKey(d.latest.month));
  const currentKey = nexts.length ? nexts.reduce((a, b) => mnum(b) < mnum(a) ? b : a) : null;
  const missing = currentKey ? reporting.filter(d => !d.months.includes(currentKey)) : [];
  return React.createElement("div", {
    className: "topbar"
  }, React.createElement("button", {
    className: "tb-burger",
    onClick: onBurger,
    title: "Toggle menu"
  }, React.createElement(Ic, {
    d: I.grid,
    s: 16
  })), React.createElement("div", {
    className: "crumb"
  }, crumbs.map((c, i) => React.createElement(React.Fragment, {
    key: i
  }, i > 0 && React.createElement(Ic, {
    d: I.chevR,
    s: 13,
    c: "#b6c0cc"
  }), i === crumbs.length - 1 ? route.view === 'departments' && route.dept && depts && depts.length ? React.createElement("select", {
    value: route.dept || depts[0].id,
    onChange: e => setRoute({
      view: 'departments',
      dept: e.target.value
    }),
    title: "Switch department",
    style: {
      border: '1px solid var(--line)',
      borderRadius: 7,
      padding: '3px 8px',
      fontSize: 14,
      fontWeight: 600,
      color: 'var(--ink)',
      fontFamily: 'inherit',
      background: 'var(--panel-2)',
      cursor: 'pointer',
      maxWidth: 240
    }
  }, depts.map(d => React.createElement("option", {
    key: d.id,
    value: d.id
  }, d.name))) : React.createElement("b", null, c) : React.createElement("span", {
    style: {
      cursor: 'pointer'
    }
  }, c)))), React.createElement("div", {
    className: "tb-search",
    onClick: () => window.dispatchEvent(new Event('unico:open-search')),
    style: {
      cursor: 'pointer'
    },
    title: "Search (Ctrl+K)"
  }, React.createElement(Ic, {
    d: I.search,
    s: 15
  }), React.createElement("span", {
    style: {
      flex: 1,
      fontSize: 12.5,
      color: 'var(--faint)',
      whiteSpace: 'nowrap',
      overflow: 'hidden'
    }
  }, "Search departments, staff, quality\u2026"), React.createElement("span", {
    style: {
      fontSize: 10.5,
      fontWeight: 600,
      color: 'var(--faint)',
      border: '1px solid var(--line)',
      borderRadius: 5,
      padding: '1px 6px',
      background: 'var(--panel)'
    }
  }, "Ctrl K")), React.createElement("div", {
    className: "tb-right"
  }, actions, route.view === 'dashboard' && setPeriod && React.createElement(PeriodPill, {
    period: period,
    setPeriod: setPeriod,
    depts: depts
  }), React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, React.createElement("button", {
    className: "tb-icon",
    onClick: () => setNotifOpen(o => !o),
    title: "Reminders"
  }, React.createElement(Ic, {
    d: I.bell,
    s: 17
  }), missing.length > 0 && React.createElement("span", {
    className: "tb-dot"
  })), notifOpen && React.createElement("div", {
    onMouseLeave: () => setNotifOpen(false),
    style: {
      position: 'absolute',
      right: 0,
      top: '118%',
      zIndex: 200,
      width: 320,
      background: 'rgba(255,255,255,.88)',
      backdropFilter: 'blur(24px) saturate(1.6)',
      WebkitBackdropFilter: 'blur(24px) saturate(1.6)',
      border: '1px solid rgba(255,255,255,.92)',
      boxShadow: '0 22px 56px rgba(31,59,90,.26)',
      borderRadius: 12,
      overflow: 'hidden'
    }
  }, React.createElement("div", {
    style: {
      padding: '13px 15px',
      borderBottom: '1px solid var(--line-2)',
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, React.createElement(Ic, {
    d: I.bell,
    s: 16,
    c: "var(--blue)"
  }), React.createElement("div", {
    style: {
      fontSize: 13.5,
      fontWeight: 700
    }
  }, "Reminders"), React.createElement("span", {
    className: "spacer"
  }), missing.length > 0 && React.createElement("span", {
    className: "chip neg"
  }, missing.length)), currentKey && React.createElement("div", {
    style: {
      padding: '10px 15px',
      background: 'var(--blue-50)',
      borderBottom: '1px solid var(--line-2)',
      fontSize: 11.5,
      color: 'var(--ink-2)'
    }
  }, "Running month \xB7 ", React.createElement("b", null, monthFull(currentKey))), React.createElement("div", {
    style: {
      maxHeight: 300,
      overflowY: 'auto'
    }
  }, missing.length === 0 ? React.createElement("div", {
    style: {
      padding: '26px 16px',
      textAlign: 'center',
      color: 'var(--pos)',
      fontSize: 12.5
    }
  }, React.createElement(Ic, {
    d: I.check,
    s: 24,
    c: "#1f9d57"
  }), React.createElement("div", {
    style: {
      marginTop: 6
    }
  }, "All departments up to date.")) : missing.map(d => React.createElement("div", {
    key: d.id,
    onClick: () => {
      onFill && onFill(d.id);
      setNotifOpen(false);
    },
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 15px',
      borderBottom: '1px solid var(--line-2)',
      cursor: 'pointer'
    },
    onMouseEnter: e => e.currentTarget.style.background = 'var(--panel-2)',
    onMouseLeave: e => e.currentTarget.style.background = '#fff'
  }, React.createElement("div", {
    style: {
      width: 30,
      height: 30,
      borderRadius: 8,
      background: 'var(--neg-bg)',
      color: 'var(--neg)',
      display: 'grid',
      placeItems: 'center',
      flexShrink: 0
    }
  }, React.createElement(Ic, {
    d: DEPT_ICON[d.id] || I.activity,
    s: 16
  })), React.createElement("div", {
    style: {
      minWidth: 0,
      flex: 1
    }
  }, React.createElement("div", {
    style: {
      fontSize: 12.5,
      fontWeight: 600,
      color: 'var(--ink)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, d.name), React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--muted)'
    }
  }, monthFull(currentKey), " not entered")), React.createElement(Ic, {
    d: I.input,
    s: 15,
    c: "var(--blue)"
  })))), missing.length > 0 && React.createElement("div", {
    style: {
      padding: '10px 12px',
      borderTop: '1px solid var(--line-2)'
    }
  }, React.createElement("button", {
    className: "btn pri sm",
    style: {
      width: '100%',
      justifyContent: 'center'
    },
    onClick: () => {
      onFill && onFill(missing[0].id);
      setNotifOpen(false);
    }
  }, React.createElement(Ic, {
    d: I.input,
    s: 14
  }), "Enter ", monthFull(currentKey), " data")))), (() => {
    let ok = true;
    try {
      ok = !window.unicoCan || window.unicoCan(window.unicoAccessModuleOf ? window.unicoAccessModuleOf(route && route.view) : 'stats', 'print');
    } catch (e) {
      ok = true;
    }
    return ok ? React.createElement("button", {
      className: "tb-icon",
      title: "Print",
      onClick: () => window.print()
    }, React.createElement(Ic, {
      d: I.print,
      s: 17
    })) : null;
  })(), window.unicoLock && window.unicoLock.isEnabled() && React.createElement("button", {
    className: "tb-icon",
    title: "Lock now",
    onClick: () => window.dispatchEvent(new Event('unico:lock'))
  }, React.createElement("svg", {
    width: "17",
    height: "17",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.9",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, React.createElement("rect", {
    x: "4",
    y: "11",
    width: "16",
    height: "10",
    rx: "2"
  }), React.createElement("path", {
    d: "M8 11V7a4 4 0 018 0v4"
  }), React.createElement("circle", {
    cx: "12",
    cy: "16",
    r: "1.1"
  })))));
}
function Delta({
  v
}) {
  const cls = v > 0 ? 'pos' : v < 0 ? 'neg' : 'flat';
  const sym = v > 0 ? '▲' : v < 0 ? '▼' : '—';
  return React.createElement("span", {
    className: 'chip ' + cls
  }, sym, " ", Math.abs(v), "%");
}
function SectionTitle({
  icon,
  title,
  sub,
  right
}) {
  return React.createElement("div", {
    className: "sec-head",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 11,
      margin: '4px 0 12px'
    }
  }, icon && React.createElement("div", {
    style: {
      width: 30,
      height: 30,
      borderRadius: 8,
      background: 'var(--blue-50)',
      color: 'var(--blue)',
      display: 'grid',
      placeItems: 'center'
    }
  }, React.createElement(Ic, {
    d: icon,
    s: 17
  })), React.createElement("div", null, React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      color: 'var(--ink)'
    }
  }, title), sub && React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--muted)'
    }
  }, sub)), React.createElement("div", {
    className: "spacer"
  }), right);
}
Object.assign(window, {
  Ic,
  I,
  DEPT_ICON,
  Sidebar,
  TopBar,
  Delta,
  SectionTitle,
  ModuleSwitch,
  ViewTabs,
  unicoViewTabs,
  unicoModuleOf,
  UNICO_ACCESS_MODULES,
  unicoAccessModuleOf,
  unicoAllowedModules,
  unicoCanAccessModule,
  unicoCanAccessView,
  unicoFirstAllowedHome,
  unicoCan,
  unicoModuleLevel,
  unicoUserPerms,
  unicoRefreshPerms
});
})();
;
/* ===== photo-picker.jsx ===== */
(function(){
(function () {
  const PHOTO_MAX_PX = 640;
  const PHOTO_QUALITY = 0.85;
  function unicoResizeImage(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onerror = () => reject(new Error('Could not read that file.'));
      fr.onload = () => {
        const raw = String(fr.result || '');
        const img = new Image();
        img.onerror = () => resolve(raw);
        img.onload = () => {
          try {
            const scale = Math.min(1, PHOTO_MAX_PX / Math.max(img.width, img.height));
            if (scale >= 1 && raw.length < 600 * 1024) return resolve(raw);
            const c = document.createElement('canvas');
            c.width = Math.round(img.width * scale);
            c.height = Math.round(img.height * scale);
            const ctx = c.getContext('2d');
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, c.width, c.height);
            ctx.drawImage(img, 0, 0, c.width, c.height);
            resolve(c.toDataURL('image/jpeg', PHOTO_QUALITY));
          } catch (e) {
            resolve(raw);
          }
        };
        img.src = raw;
      };
      fr.readAsDataURL(file);
    });
  }
  let _cfg = null;
  function unicoPhotoStatus() {
    if (_cfg) return _cfg;
    _cfg = fetch('/api/upload/status', {
      credentials: 'same-origin'
    }).then(r => r.json()).catch(() => ({
      ok: false,
      configured: false
    }));
    return _cfg;
  }
  async function unicoUploadPhoto(src, opts) {
    const o = opts || {};
    const image = typeof src === 'string' ? src : await unicoResizeImage(src);
    const r = await fetch('/api/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'same-origin',
      body: JSON.stringify({
        image,
        kind: o.kind || 'staff',
        staffName: o.name || '',
        staffId: o.staffId != null ? o.staffId : null,
        empId: o.empId || null
      })
    });
    const j = await r.json().catch(() => ({
      ok: false,
      error: 'The server sent an unreadable reply.'
    }));
    if (!r.ok || !j.ok) throw new Error(j.error || 'Upload failed.');
    return j;
  }
  async function unicoDeletePhoto(publicId, kind, who) {
    const w = who || {};
    const r = await fetch('/api/upload', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'same-origin',
      body: JSON.stringify({
        publicId: publicId,
        kind: kind || 'staff',
        staffId: w.staffId != null ? w.staffId : null,
        empId: w.empId || null
      })
    });
    const j = await r.json().catch(() => ({
      ok: false
    }));
    if (!r.ok || !j.ok) throw new Error(j.error || 'Could not remove the photo.');
    return true;
  }
  const CROP_BOX = 300;
  const CROP_OUT = 640;
  function CropDialog({
    src,
    aspect,
    radius,
    onCancel,
    onDone
  }) {
    const [img, setImg] = React.useState(null);
    const [zoom, setZoom] = React.useState(1);
    const [pan, setPan] = React.useState({
      x: 0,
      y: 0
    });
    const drag = React.useRef(null);
    const boxW = aspect >= 1 ? CROP_BOX : Math.round(CROP_BOX * aspect);
    const boxH = aspect >= 1 ? Math.round(CROP_BOX / aspect) : CROP_BOX;
    React.useEffect(() => {
      const i = new Image();
      i.onload = () => {
        setImg(i);
        setZoom(1);
      };
      i.src = src;
    }, [src]);
    const base = img ? Math.max(boxW / img.width, boxH / img.height) : 1;
    const eff = base * zoom;
    const dispW = img ? img.width * eff : 0;
    const dispH = img ? img.height * eff : 0;
    function clampTo(p, w, h) {
      return {
        x: Math.min(0, Math.max(boxW - w, p.x)),
        y: Math.min(0, Math.max(boxH - h, p.y))
      };
    }
    const prevEff = React.useRef(null);
    React.useEffect(() => {
      if (!img) return;
      const b = Math.max(boxW / img.width, boxH / img.height);
      setPan(clampTo({
        x: (boxW - img.width * b) / 2,
        y: (boxH - img.height * b) / 2
      }, img.width * b, img.height * b));
      prevEff.current = b;
    }, [img]);
    React.useEffect(() => {
      if (!img) return;
      const before = prevEff.current;
      prevEff.current = eff;
      if (!before || before === eff) return;
      const k = eff / before;
      setPan(p => clampTo({
        x: boxW / 2 - (boxW / 2 - p.x) * k,
        y: boxH / 2 - (boxH / 2 - p.y) * k
      }, dispW, dispH));
    }, [zoom]);
    function down(e) {
      const pt = e.touches ? e.touches[0] : e;
      drag.current = {
        x: pt.clientX,
        y: pt.clientY,
        ox: pan.x,
        oy: pan.y
      };
    }
    function move(e) {
      if (!drag.current) return;
      const pt = e.touches ? e.touches[0] : e;
      if (e.cancelable) e.preventDefault();
      setPan(clampTo({
        x: drag.current.ox + (pt.clientX - drag.current.x),
        y: drag.current.oy + (pt.clientY - drag.current.y)
      }, dispW, dispH));
    }
    const up = () => {
      drag.current = null;
    };
    React.useEffect(() => {
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
      window.addEventListener('touchmove', move, {
        passive: false
      });
      window.addEventListener('touchend', up);
      return () => {
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', up);
        window.removeEventListener('touchmove', move);
        window.removeEventListener('touchend', up);
      };
    });
    function confirm() {
      if (!img) return;
      const outW = aspect >= 1 ? CROP_OUT : Math.round(CROP_OUT * aspect);
      const outH = aspect >= 1 ? Math.round(CROP_OUT / aspect) : CROP_OUT;
      const c = document.createElement('canvas');
      c.width = outW;
      c.height = outH;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, outW, outH);
      ctx.drawImage(img, -pan.x / eff, -pan.y / eff, boxW / eff, boxH / eff, 0, 0, outW, outH);
      onDone(c.toDataURL('image/jpeg', PHOTO_QUALITY));
    }
    const body = React.createElement("div", {
      onMouseDown: e => {
        if (e.target === e.currentTarget) onCancel();
      },
      style: {
        position: 'fixed',
        inset: 0,
        background: 'rgba(16,32,46,.55)',
        zIndex: 2000,
        display: 'grid',
        placeItems: 'center',
        padding: 16
      }
    }, React.createElement("div", {
      className: "card",
      style: {
        width: 'min(400px,96vw)'
      }
    }, React.createElement("div", {
      className: "card-h"
    }, React.createElement("h3", null, "Position your photo")), React.createElement("div", {
      className: "card-b",
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 13
      }
    }, React.createElement("div", {
      onMouseDown: down,
      onTouchStart: down,
      onWheel: e => {
        e.preventDefault();
        setZoom(z => Math.min(4, Math.max(1, +(z - e.deltaY * 0.0016).toFixed(3))));
      },
      style: {
        position: 'relative',
        width: boxW,
        height: boxH,
        overflow: 'hidden',
        borderRadius: radius == null ? '50%' : radius,
        background: '#0e1826',
        cursor: 'grab',
        touchAction: 'none',
        boxShadow: '0 0 0 2px var(--blue,#0090ca), 0 8px 26px rgba(13,27,46,.25)'
      }
    }, img ? React.createElement("img", {
      src: src,
      alt: "",
      draggable: false,
      style: {
        position: 'absolute',
        left: pan.x,
        top: pan.y,
        width: dispW,
        height: dispH,
        maxWidth: 'none',
        userSelect: 'none',
        pointerEvents: 'none'
      }
    }) : React.createElement("div", {
      style: {
        display: 'grid',
        placeItems: 'center',
        height: '100%',
        color: '#8fa6c0',
        fontSize: 12
      }
    }, "Loading\u2026")), React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        width: '100%'
      }
    }, React.createElement("button", {
      type: "button",
      className: "btn sm",
      title: "Zoom out",
      onClick: () => setZoom(z => Math.max(1, +(z - 0.25).toFixed(2))),
      style: {
        padding: '2px 10px',
        fontSize: 15,
        lineHeight: 1.3,
        fontWeight: 700
      }
    }, "\u2212"), React.createElement("input", {
      type: "range",
      min: "1",
      max: "4",
      step: "0.01",
      value: zoom,
      onChange: e => setZoom(parseFloat(e.target.value)),
      style: {
        flex: 1
      }
    }), React.createElement("button", {
      type: "button",
      className: "btn sm",
      title: "Zoom in",
      onClick: () => setZoom(z => Math.min(4, +(z + 0.25).toFixed(2))),
      style: {
        padding: '2px 10px',
        fontSize: 15,
        lineHeight: 1.3,
        fontWeight: 700
      }
    }, "+"), React.createElement("span", {
      className: "num",
      style: {
        fontSize: 10.5,
        fontWeight: 700,
        color: 'var(--muted)',
        width: 34,
        textAlign: 'right'
      }
    }, zoom.toFixed(1), "x")), React.createElement("div", {
      style: {
        fontSize: 11,
        color: 'var(--muted)',
        textAlign: 'center',
        lineHeight: 1.5
      }
    }, "Drag to move, scroll or use \u2212 / + to zoom. Only what you see in the frame is saved."), React.createElement("div", {
      style: {
        display: 'flex',
        gap: 8,
        width: '100%',
        justifyContent: 'flex-end'
      }
    }, React.createElement("button", {
      className: "btn sm",
      onClick: onCancel
    }, "Cancel"), React.createElement("button", {
      className: "btn pri sm",
      onClick: confirm,
      disabled: !img
    }, "Use this photo")))));
    return window.ReactDOM && window.ReactDOM.createPortal ? window.ReactDOM.createPortal(body, document.body) : body;
  }
  function PhotoLightbox({
    src,
    name,
    sub,
    onClose
  }) {
    React.useEffect(() => {
      const h = e => {
        if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', h);
      return () => window.removeEventListener('keydown', h);
    }, [onClose]);
    const body = React.createElement("div", {
      onMouseDown: e => {
        if (e.target === e.currentTarget) onClose();
      },
      style: {
        position: 'fixed',
        inset: 0,
        background: 'rgba(10,22,34,.74)',
        backdropFilter: 'blur(3px)',
        zIndex: 2000,
        display: 'grid',
        placeItems: 'center',
        padding: 18
      }
    }, React.createElement("div", {
      style: {
        position: 'relative',
        background: '#fff',
        borderRadius: 18,
        padding: 12,
        boxShadow: '0 24px 70px rgba(0,0,0,.45)',
        width: 'min(440px, 94vw)'
      }
    }, React.createElement("button", {
      type: "button",
      title: "Close",
      onClick: onClose,
      style: {
        position: 'absolute',
        top: -13,
        right: -13,
        width: 32,
        height: 32,
        borderRadius: '50%',
        border: '2px solid #fff',
        background: '#132435',
        color: '#fff',
        cursor: 'pointer',
        display: 'grid',
        placeItems: 'center',
        fontSize: 15,
        fontWeight: 700,
        lineHeight: 1,
        boxShadow: '0 3px 10px rgba(0,0,0,.35)',
        padding: 0,
        zIndex: 1
      }
    }, "\u2715"), React.createElement("img", {
      src: src,
      alt: name || 'Photo',
      style: {
        display: 'block',
        width: '100%',
        maxHeight: '72vh',
        objectFit: 'contain',
        borderRadius: 11,
        background: '#0e1826'
      }
    }), (name || sub) && React.createElement("div", {
      style: {
        textAlign: 'center',
        padding: '10px 8px 4px'
      }
    }, name && React.createElement("div", {
      style: {
        fontSize: 15,
        fontWeight: 800,
        color: '#15181c',
        letterSpacing: '-.2px'
      }
    }, name), sub && React.createElement("div", {
      style: {
        fontSize: 11.5,
        fontWeight: 700,
        color: '#0072a3',
        marginTop: 2
      }
    }, sub))));
    return window.ReactDOM && window.ReactDOM.createPortal ? window.ReactDOM.createPortal(body, document.body) : body;
  }
  function PhotoPicker({
    value,
    onChange,
    initials,
    name,
    size,
    kind,
    readOnly,
    hue,
    w,
    h,
    radius,
    plain,
    zoomable,
    zoomSub,
    staffId,
    empId
  }) {
    const [busy, setBusy] = React.useState(false);
    const [cfg, setCfg] = React.useState(null);
    const [cropSrc, setCropSrc] = React.useState(null);
    const [viewing, setViewing] = React.useState(false);
    const inputRef = React.useRef(null);
    const px = size || 96;
    React.useEffect(() => {
      let live = true;
      unicoPhotoStatus().then(c => {
        if (live) setCfg(c);
      });
      return () => {
        live = false;
      };
    }, []);
    const toast = (m, t) => {
      try {
        window.UI && window.UI.toast && window.UI.toast(m, t);
      } catch (e) {}
    };
    function pick(ev) {
      const file = ev.target.files && ev.target.files[0];
      ev.target.value = '';
      if (!file) return;
      if (!/^image\//.test(file.type)) {
        toast('That is not an image file', 'error');
        return;
      }
      const fr = new FileReader();
      fr.onerror = () => toast('Could not read that file', 'error');
      fr.onload = () => setCropSrc(String(fr.result || ''));
      fr.readAsDataURL(file);
    }
    async function uploadCropped(dataUri) {
      setCropSrc(null);
      setBusy(true);
      try {
        const up = await unicoUploadPhoto(dataUri, {
          kind: kind,
          name: name,
          staffId: staffId,
          empId: empId
        });
        onChange && onChange({
          url: up.url,
          publicId: up.publicId
        });
        toast('Photo updated', 'success');
      } catch (e) {
        toast(String(e && e.message || e), 'error');
      } finally {
        setBusy(false);
      }
    }
    async function clear() {
      if (!value) {
        onChange && onChange(null);
        return;
      }
      if (!value.publicId) {
        if ((kind || 'staff') === 'staff' && staffId != null && staffId !== '') {
          setBusy(true);
          try {
            await unicoDeletePhoto('', 'staff', {
              staffId: staffId,
              empId: empId
            });
          } catch (e) {
            toast(String(e && e.message || e), 'error');
            setBusy(false);
            return;
          }
          setBusy(false);
        }
        onChange && onChange(null);
        return;
      }
      const ok = window.UI && window.UI.confirm ? await window.UI.confirm({
        title: 'Remove this photo?',
        message: 'The picture is deleted from storage permanently.',
        danger: true,
        confirmLabel: 'Remove'
      }) : true;
      if (!ok) return;
      setBusy(true);
      try {
        await unicoDeletePhoto(value.publicId, kind, {
          staffId: staffId,
          empId: empId
        });
        onChange && onChange(null);
        toast('Photo removed', 'success');
      } catch (e) {
        toast(String(e && e.message || e), 'error');
      } finally {
        setBusy(false);
      }
    }
    const ring = typeof hue === 'number' ? 'hsl(' + hue + ' 55% 45%)' : 'var(--blue)';
    const W = w || px,
      H = h || px;
    const R = radius == null ? '50%' : radius;
    const btn = Math.max(26, Math.round(Math.min(W, H) / 3.4));
    const fill = typeof hue === 'number' ? 'linear-gradient(135deg,hsl(' + hue + ' 60% 52%),hsl(' + (hue + 40) % 360 + ' 62% 42%))' : 'var(--blue-50)';
    return React.createElement("div", {
      style: {
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8
      }
    }, React.createElement("div", {
      style: {
        position: 'relative',
        width: W,
        height: H
      }
    }, React.createElement("div", {
      onClick: zoomable && value && value.url && !busy ? () => setViewing(true) : undefined,
      title: zoomable && value && value.url ? 'View photo' : undefined,
      style: {
        width: W,
        height: H,
        borderRadius: R,
        overflow: 'hidden',
        background: value && value.url ? '#fff' : fill,
        border: plain ? 'none' : '2px solid ' + ring,
        display: 'grid',
        placeItems: 'center',
        fontSize: Math.round(Math.min(W, H) / 2.6),
        fontWeight: 800,
        color: plain ? '#fff' : ring,
        letterSpacing: '.5px',
        cursor: zoomable && value && value.url && !busy ? 'zoom-in' : undefined
      }
    }, value && value.url ? React.createElement("img", {
      src: window.MK && window.MK.cdnPhoto ? window.MK.cdnPhoto(value.url, Math.max(W, H), 'fit') : value.url,
      alt: name || 'Photo',
      decoding: "async",
      style: {
        width: '100%',
        height: '100%',
        objectFit: 'cover'
      }
    }) : React.createElement("span", null, initials || '—')), busy && React.createElement("div", {
      style: {
        position: 'absolute',
        inset: 0,
        borderRadius: R,
        background: 'rgba(255,255,255,.74)',
        display: 'grid',
        placeItems: 'center',
        fontSize: 10.5,
        fontWeight: 700,
        color: 'var(--blue)'
      }
    }, "Uploading\u2026"), !readOnly && !busy && React.createElement("button", {
      type: "button",
      title: "Upload a photo",
      onClick: () => inputRef.current && inputRef.current.click(),
      style: {
        position: 'absolute',
        right: -2,
        bottom: -2,
        width: btn,
        height: btn,
        borderRadius: '50%',
        border: '2px solid #fff',
        background: 'var(--blue)',
        color: '#fff',
        cursor: 'pointer',
        display: 'grid',
        placeItems: 'center',
        boxShadow: '0 2px 7px rgba(0,0,0,.22)',
        padding: 0
      }
    }, React.createElement("svg", {
      width: Math.max(13, Math.round(btn / 2)),
      height: Math.max(13, Math.round(btn / 2)),
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
    }), React.createElement("circle", {
      cx: "12",
      cy: "13",
      r: "4"
    })))), React.createElement("input", {
      ref: inputRef,
      type: "file",
      accept: "image/jpeg,image/png,image/webp",
      onChange: pick,
      style: {
        display: 'none'
      }
    }), viewing && value && value.url && React.createElement(PhotoLightbox, {
      src: value.url,
      name: name,
      sub: zoomSub,
      onClose: () => setViewing(false)
    }), cropSrc && React.createElement(CropDialog, {
      src: cropSrc,
      aspect: W / H,
      radius: R,
      onCancel: () => setCropSrc(null),
      onDone: uploadCropped
    }), !readOnly && value && value.url && !busy && React.createElement("button", {
      type: "button",
      className: "btn sm",
      onClick: clear,
      style: {
        color: '#d23a52',
        borderColor: '#f1c6cd',
        fontSize: 11,
        padding: '3px 9px'
      }
    }, "Remove photo"), !readOnly && cfg && !cfg.configured && React.createElement("div", {
      style: {
        fontSize: 10.5,
        color: 'var(--muted)',
        maxWidth: 190,
        textAlign: 'center',
        lineHeight: 1.5
      }
    }, "Photo storage is not set up on this server."));
  }
  function unicoSetAccountPhoto(next) {
    if (window.__UNICO_USER__) window.__UNICO_USER__.photo = next || null;
    try {
      window.dispatchEvent(new CustomEvent('unico:profile-photo', {
        detail: next || null
      }));
    } catch (e) {}
  }
  function UnicoAvatar({
    photo,
    initials,
    size,
    radius,
    className,
    style
  }) {
    const [live, setLive] = React.useState(photo === undefined ? (window.__UNICO_USER__ || {}).photo || null : photo);
    const [dead, setDead] = React.useState(false);
    React.useEffect(() => {
      if (photo !== undefined) {
        setLive(photo);
        setDead(false);
      }
    }, [photo]);
    React.useEffect(() => {
      if (photo !== undefined) return;
      const h = e => {
        setLive(e.detail || null);
        setDead(false);
      };
      window.addEventListener('unico:profile-photo', h);
      return () => window.removeEventListener('unico:profile-photo', h);
    }, [photo]);
    const px = size || 34;
    const base = Object.assign({
      width: px,
      height: px,
      borderRadius: radius == null ? 9 : radius
    }, style || {});
    if (live && live.url && !dead) {
      const src = window.MK && window.MK.cdnPhoto ? window.MK.cdnPhoto(live.url, px) : live.url;
      return React.createElement("img", {
        className: className,
        src: src,
        alt: initials || '',
        onError: () => setDead(true),
        loading: "lazy",
        decoding: "async",
        style: Object.assign({}, base, {
          objectFit: 'cover',
          padding: 0,
          display: 'block'
        })
      });
    }
    return React.createElement("div", {
      className: className,
      style: base
    }, initials || 'U');
  }
  Object.assign(window, {
    PhotoPicker,
    PhotoLightbox,
    UnicoAvatar,
    unicoSetAccountPhoto,
    unicoUploadPhoto,
    unicoDeletePhoto,
    unicoPhotoStatus,
    unicoResizeImage
  });
})();
})();
;
/* ===== profile.jsx ===== */
(function(){
(function () {
  const {
    useState,
    useEffect,
    useMemo
  } = React;
  const api = (method, path, body) => fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'same-origin',
    body: body ? JSON.stringify(body) : undefined
  }).then(async r => {
    let j = null;
    try {
      j = await r.json();
    } catch (e) {}
    if (!r.ok || !j || j.ok === false) {
      throw new Error(j && j.error || (r.status === 401 ? 'Sign in to manage your account.' : 'Request failed (' + r.status + ').'));
    }
    return j;
  });
  const initialsOf = n => String(n || 'U').split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'U';
  const WS_LABEL = {
    stats: 'Statistics',
    quality: 'Quality Indicators',
    supervisor: 'Supervisor Reports',
    staff: 'Staff Management',
    datacol: 'Data Collection',
    reports: 'Reports',
    users: 'User Management',
    perf: 'Performance',
    roster: 'Duty Roster',
    medicine: 'Medicine & Rx'
  };
  const ACTIONS = ['view', 'edit', 'add', 'delete'];
  const ACTION_LABEL = {
    view: 'View',
    edit: 'Edit',
    add: 'Add',
    delete: 'Delete'
  };
  function Barcode({
    seed,
    height
  }) {
    const bars = useMemo(() => {
      const s = String(seed || 'UNICO0000');
      const out = [];
      let acc = 7;
      for (let i = 0; i < 54; i++) {
        acc = acc * 31 + (s.charCodeAt(i % s.length) || 48) + i * 7 >>> 0;
        out.push({
          w: 1 + acc % 4,
          on: (acc >> 3) % 5 !== 0
        });
      }
      return out;
    }, [seed]);
    return React.createElement("div", {
      "aria-hidden": "true",
      style: {
        display: 'flex',
        alignItems: 'stretch',
        gap: '1.5px',
        height: height || 38,
        justifyContent: 'center'
      }
    }, bars.map((b, i) => React.createElement("span", {
      key: i,
      style: {
        width: b.w + 'px',
        background: b.on ? '#15181c' : 'transparent'
      }
    })));
  }
  function Field({
    label,
    hint,
    children
  }) {
    return React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 5
      }
    }, React.createElement("label", {
      style: {
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '.7px',
        color: 'var(--muted)',
        textTransform: 'uppercase'
      }
    }, label), children, hint && React.createElement("div", {
      style: {
        fontSize: 11,
        color: 'var(--faint,#9aa6b4)'
      }
    }, hint));
  }
  function Banner({
    m
  }) {
    if (!m) return null;
    const ok = m.kind === 'ok';
    return React.createElement("div", {
      role: "status",
      style: {
        fontSize: 12.5,
        fontWeight: 600,
        borderRadius: 8,
        padding: '9px 12px',
        color: ok ? '#0f6a39' : '#b4232f',
        background: ok ? 'rgba(31,157,87,.10)' : 'rgba(210,58,82,.10)',
        border: '1px solid ' + (ok ? 'rgba(31,157,87,.28)' : 'rgba(210,58,82,.28)')
      }
    }, m.text);
  }
  function ProfileView() {
    const u = typeof window !== 'undefined' && window.__UNICO_USER__ || null;
    const [photo, setPhoto] = useState(u && u.photo || null);
    const [name, setName] = useState(u && u.name || '');
    const [designation, setDesignation] = useState(u && u.designation || '');
    const [email, setEmail] = useState(u && u.email || '');
    const [phone, setPhone] = useState(u && u.phone || '');
    const [cur, setCur] = useState('');
    const [nw, setNw] = useState('');
    const [nw2, setNw2] = useState('');
    const [busy, setBusy] = useState(false);
    const [pwBusy, setPwBusy] = useState(false);
    const [msg, setMsg] = useState(null);
    const [pwMsg, setPwMsg] = useState(null);
    useEffect(() => {
      document.title = 'My Profile · UNICO';
    }, []);
    const dirty = u ? name !== (u.name || '') || email !== (u.email || '') || phone !== (u.phone || '') || designation !== (u.designation || '') : false;
    async function saveProfile() {
      setMsg(null);
      setBusy(true);
      try {
        const cleanPhone = u && phone && phone.trim().toLowerCase() === String(u.username).toLowerCase() ? '' : phone;
        if (cleanPhone !== phone) setPhone(cleanPhone);
        await api('PATCH', '/api/me', {
          name,
          email,
          phone: cleanPhone,
          designation
        });
        if (window.__UNICO_USER__) Object.assign(window.__UNICO_USER__, {
          name,
          email,
          phone: cleanPhone,
          designation
        });
        setMsg({
          kind: 'ok',
          text: 'Profile saved.'
        });
      } catch (e) {
        setMsg({
          kind: 'err',
          text: String(e && e.message || e)
        });
      } finally {
        setBusy(false);
      }
    }
    async function savePassword() {
      setPwMsg(null);
      if (nw.length < 6) return setPwMsg({
        kind: 'err',
        text: 'New password must be at least 6 characters.'
      });
      if (nw !== nw2) return setPwMsg({
        kind: 'err',
        text: 'New passwords do not match.'
      });
      setPwBusy(true);
      try {
        await api('POST', '/api/me/password', {
          currentPassword: cur,
          newPassword: nw
        });
        setCur('');
        setNw('');
        setNw2('');
        setPwMsg({
          kind: 'ok',
          text: 'Password changed.'
        });
      } catch (e) {
        setPwMsg({
          kind: 'err',
          text: String(e && e.message || e)
        });
      } finally {
        setPwBusy(false);
      }
    }
    const roleLabel = !u ? 'Local session' : u.role === 'collector' ? 'Data Collector' : u.role === 'incharge' ? 'In-charge' : u.role || 'User';
    const idText = u && u.username || '— — — —';
    const access = useMemo(() => {
      const perms = window.unicoUserPerms ? window.unicoUserPerms() : null;
      if (!perms) return {
        unrestricted: true,
        rows: []
      };
      const ids = Object.keys(WS_LABEL).filter(m => window.unicoCan && window.unicoCan(m, 'view'));
      return {
        unrestricted: false,
        rows: ids.map(m => ({
          id: m,
          label: WS_LABEL[m] || m,
          actions: ACTIONS.filter(a => window.unicoCan(m, a))
        }))
      };
    }, [u]);
    const deptNames = useMemo(() => {
      const map = typeof window !== 'undefined' && window.__UNICO_DEPT_MAP__ || null;
      const ids = u && u.departments || [];
      if (!ids.length) return [];
      return ids.map(id => map && map.byId && map.byId[id] && map.byId[id].name || id);
    }, [u]);
    const scopeText = !u ? 'All staff' : u.staffScope === 'self' ? 'Own record only' : u.staffScope === 'departments' ? 'Own departments' : 'All staff';
    const txt = {
      padding: '9px 11px',
      border: '1px solid var(--line)',
      borderRadius: 8,
      fontSize: 13,
      fontFamily: 'inherit',
      width: '100%',
      outline: 'none',
      background: '#fff',
      boxSizing: 'border-box'
    };
    const mono = {
      fontFamily: 'var(--mono)'
    };
    return React.createElement("div", {
      className: "grid unico-profile",
      style: {
        gap: 16
      }
    }, React.createElement("style", null, `
          .unico-profile .cred{animation:credIn .5s cubic-bezier(.2,.7,.3,1) both}
          @keyframes credIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
          @media (prefers-reduced-motion:reduce){.unico-profile .cred{animation:none}}
          /* NB: this is a real stylesheet, not a JSX style object — every length needs
             its unit. A bare gap:16 is invalid CSS, silently dropped, and the two
             columns rendered with NO gap: the Details card sat flush over the
             credential's edge and clipped its values. */
          .unico-profile .cols{display:grid;grid-template-columns:minmax(280px,360px) minmax(0,1fr);gap:16px;align-items:start}
          @media (max-width:980px){.unico-profile .cols{grid-template-columns:minmax(0,1fr)}}
          .unico-profile .cred{min-width:0}
          .unico-profile .duo{display:grid;grid-template-columns:1fr 1fr;gap:12px}
          @media (max-width:560px){.unico-profile .duo{grid-template-columns:1fr}}
          .unico-profile input:focus-visible{border-color:var(--blue);box-shadow:0 0 0 3px rgba(0,144,202,.16)}
          .unico-profile .wsrow{display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid var(--line-2)}
          .unico-profile .wsrow:first-child{border-top:0}
        `), React.createElement(SectionTitle, {
      icon: I.user,
      title: "My Profile",
      sub: "Your credential, your details, and what your account can open."
    }), !u && React.createElement("div", {
      style: {
        fontSize: 12.5,
        color: '#9a6b00',
        background: 'var(--warn-bg,#fff4e0)',
        border: '1px solid #f0d9a8',
        borderRadius: 8,
        padding: '10px 12px'
      }
    }, "You are in local admin mode, so there is no account to edit. On the deployed site, where sign-in is required, this page saves to your account."), React.createElement("div", {
      className: "cols"
    }, React.createElement("div", {
      className: "card cred",
      style: {
        padding: 0,
        overflow: 'hidden',
        background: 'var(--panel)'
      }
    }, React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'center',
        paddingTop: 11
      }
    }, React.createElement("div", {
      style: {
        width: 52,
        height: 7,
        borderRadius: 5,
        background: 'var(--line)'
      }
    })), React.createElement("div", {
      style: {
        marginTop: 9,
        padding: '11px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: 'var(--panel-2)'
      }
    }, React.createElement("img", {
      src: "unico/logo.svg",
      alt: "UNICO Hospitals",
      style: {
        height: 28,
        width: 'auto',
        display: 'block'
      }
    }), React.createElement("span", {
      style: {
        flex: 1
      }
    }), React.createElement("span", {
      style: {
        fontFamily: 'var(--mono)',
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '.9px',
        color: '#fff',
        background: 'linear-gradient(130deg,#0aa0d4,#0072a3)',
        padding: '4px 9px',
        borderRadius: 6,
        whiteSpace: 'nowrap'
      }
    }, "STAFF ID")), React.createElement("div", {
      style: {
        height: 4,
        background: 'linear-gradient(90deg,#3ab5a7,#0aa0d4,#0072a3)'
      }
    }), React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '20px 22px 6px'
      }
    }, React.createElement(PhotoPicker, {
      value: photo,
      size: 132,
      kind: "profile",
      initials: initialsOf(name || u && u.username),
      name: name || 'Account',
      readOnly: !u,
      onChange: next => {
        setPhoto(next);
        window.unicoSetAccountPhoto(next);
      }
    }), React.createElement("h2", {
      style: {
        margin: '15px 0 3px',
        fontSize: 20,
        fontWeight: 800,
        letterSpacing: '-.3px',
        textAlign: 'center',
        lineHeight: 1.2
      }
    }, name || u && u.username || 'Local Administrator'), React.createElement("div", {
      style: {
        fontSize: 12.5,
        color: 'var(--blue-700)',
        fontWeight: 700,
        textAlign: 'center'
      }
    }, designation || roleLabel)), React.createElement("div", {
      style: {
        padding: '10px 22px 0'
      }
    }, [['ID No.', idText], ['Role', roleLabel], ['Phone', phone || 'Not recorded'], ['Email', email || 'Not recorded']].map(([l, v], i) => React.createElement("div", {
      key: l,
      style: {
        display: 'flex',
        alignItems: 'baseline',
        gap: 12,
        padding: '8px 0',
        borderTop: i ? '1px solid var(--line-2)' : 'none'
      }
    }, React.createElement("span", {
      style: {
        fontSize: 9.5,
        textTransform: 'uppercase',
        letterSpacing: '.7px',
        color: 'var(--muted)',
        fontWeight: 700,
        flex: '0 0 62px'
      }
    }, l), React.createElement("span", {
      style: Object.assign({}, mono, {
        fontSize: 12,
        fontWeight: 600,
        marginLeft: 'auto',
        textAlign: 'right',
        minWidth: 0,
        overflowWrap: 'anywhere',
        wordBreak: 'break-word',
        color: v === 'Not recorded' || v === '— — — —' ? 'var(--faint)' : 'var(--ink)'
      })
    }, v)))), React.createElement("div", {
      style: {
        margin: '15px 18px 18px',
        padding: '11px 10px 7px',
        borderRadius: 10,
        background: '#fff',
        border: '1px solid var(--line-2)'
      }
    }, React.createElement(Barcode, {
      seed: idText
    }), React.createElement("div", {
      style: Object.assign({}, mono, {
        textAlign: 'center',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 3,
        color: '#15181c',
        marginTop: 6
      })
    }, idText))), React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 16
      }
    }, React.createElement("div", {
      className: "card"
    }, React.createElement("div", {
      className: "card-h"
    }, React.createElement("h3", null, "Details"), React.createElement("span", {
      className: "sub",
      style: {
        marginLeft: 'auto'
      }
    }, dirty ? 'Unsaved changes' : 'Everything saved')), React.createElement("form", {
      className: "card-b",
      autoComplete: "off",
      onSubmit: e => {
        e.preventDefault();
        if (u && dirty && !busy) saveProfile();
      },
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 13
      }
    }, React.createElement(Banner, {
      m: msg
    }), React.createElement(Field, {
      label: "Full name",
      hint: "Shown on reports you sign and everywhere your account appears."
    }, React.createElement("input", {
      style: txt,
      name: "fullname",
      autoComplete: "name",
      value: name,
      onChange: e => setName(e.target.value),
      placeholder: "Your full name",
      disabled: !u
    })), React.createElement(Field, {
      label: "Designation",
      hint: "Free text, e.g. Nursing Supervisor. Does not affect your access."
    }, React.createElement("input", {
      style: txt,
      name: "designation",
      autoComplete: "organization-title",
      value: designation,
      onChange: e => setDesignation(e.target.value),
      placeholder: "Your job title",
      disabled: !u
    })), React.createElement("div", {
      className: "duo"
    }, React.createElement(Field, {
      label: "Email"
    }, React.createElement("input", {
      style: txt,
      type: "email",
      name: "email",
      autoComplete: "email",
      value: email,
      onChange: e => setEmail(e.target.value),
      placeholder: "name@unicohospitals.com",
      disabled: !u
    })), React.createElement(Field, {
      label: "Phone"
    }, React.createElement("input", {
      style: Object.assign({}, txt, mono),
      type: "tel",
      name: "phone",
      autoComplete: "tel",
      inputMode: "tel",
      value: phone,
      onChange: e => setPhone(e.target.value),
      placeholder: "01XXXXXXXXX",
      disabled: !u
    }))), React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'flex-end'
      }
    }, React.createElement("button", {
      className: "btn pri sm",
      type: "submit",
      disabled: busy || !u || !dirty
    }, React.createElement(Ic, {
      d: I.check,
      s: 14
    }), busy ? 'Saving…' : 'Save changes')))), React.createElement("div", {
      className: "card"
    }, React.createElement("div", {
      className: "card-h"
    }, React.createElement("h3", null, "Password")), React.createElement("form", {
      className: "card-b",
      onSubmit: e => {
        e.preventDefault();
        if (u && cur && nw && !pwBusy) savePassword();
      },
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 13
      }
    }, React.createElement(Banner, {
      m: pwMsg
    }), React.createElement("input", {
      type: "text",
      name: "username",
      autoComplete: "username",
      readOnly: true,
      tabIndex: -1,
      "aria-hidden": "true",
      value: u && u.username || '',
      onChange: () => {},
      style: {
        position: 'absolute',
        width: 1,
        height: 1,
        opacity: 0,
        pointerEvents: 'none'
      }
    }), React.createElement(Field, {
      label: "Current password"
    }, React.createElement("input", {
      style: txt,
      type: "password",
      autoComplete: "current-password",
      value: cur,
      onChange: e => setCur(e.target.value),
      placeholder: "Enter current password",
      disabled: !u
    })), React.createElement("div", {
      className: "duo"
    }, React.createElement(Field, {
      label: "New password"
    }, React.createElement("input", {
      style: txt,
      type: "password",
      autoComplete: "new-password",
      value: nw,
      onChange: e => setNw(e.target.value),
      placeholder: "At least 6 characters",
      disabled: !u
    })), React.createElement(Field, {
      label: "Confirm new password"
    }, React.createElement("input", {
      style: txt,
      type: "password",
      autoComplete: "new-password",
      value: nw2,
      onChange: e => setNw2(e.target.value),
      placeholder: "Re-enter new password",
      disabled: !u
    }))), React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'flex-end'
      }
    }, React.createElement("button", {
      className: "btn pri sm",
      type: "submit",
      disabled: pwBusy || !u || !cur || !nw
    }, React.createElement(Ic, {
      d: I.check,
      s: 14
    }), pwBusy ? 'Saving…' : 'Change password')))))));
  }
  window.ProfileView = ProfileView;
})();
})();
;
/* ===== home.jsx ===== */
(function(){
(function () {
  const {
    useState,
    useEffect,
    useMemo,
    useRef,
    useCallback
  } = React;
  const KEY_MOOD = 'unico_home_mood_v1';
  const lsGet = (k, d) => {
    try {
      const v = JSON.parse(localStorage.getItem(k));
      return v == null ? d : v;
    } catch (e) {
      return d;
    }
  };
  const lsSet = (k, v) => {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {}
  };
  const pad = n => String(n).padStart(2, '0');
  const to12 = hhmm => {
    const [H, M] = hhmm.split(':').map(Number);
    const ap = H < 12 ? 'AM' : 'PM';
    const hh = H % 12 === 0 ? 12 : H % 12;
    return pad(hh) + ':' + pad(M) + ' ' + ap;
  };
  const initialsOf = n => String(n || 'U').replace('Dr. ', '').split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'U';
  const sx = css => {
    const o = {};
    for (const part of String(css || '').split(';')) {
      const i = part.indexOf(':');
      if (i < 0) continue;
      let k = part.slice(0, i).trim();
      const v = part.slice(i + 1).trim();
      if (!k) continue;
      if (k.startsWith('--')) {
        o[k] = v;
        continue;
      }
      k = k.replace(/^-webkit-/, 'Webkit-').replace(/^-moz-/, 'Moz-').replace(/-([a-z])/g, (m, c) => c.toUpperCase());
      o[k] = v;
    }
    return o;
  };
  const ANIMS = ['orbFloat', 'pop', 'livepulse', 'shiftSweep', 'tick', 'cloudDrift', 'twinkle', 'discGlow', 'birdFly', 'rayspin', 'planeFly', 'trailFade', 'rocketRise', 'flameFlicker', 'balloonUp', 'sway', 'hotAir', 'bob', 'shoot', 'smoke', 'winFlick', 'godray', 'ringGlow', 'riseIn', 'rainFall', 'snowFall', 'flash', 'firefly', 'kiteBob', 'ripple', 'grassSway', 'textGlow', 'sparkle', 'burst', 'trainRun', 'satellite', 'barShine', 'slideDown', 'fadeSwap', 'checkPop'];
  const fixAnim = css => String(css || '').replace(new RegExp('\\b(' + ANIMS.join('|') + ')\\b', 'g'), 'hd$1');
  const fs = css => sx(fixAnim(css));
  const tag = (c, bg) => 'display:inline-flex;align-items:center;font-size:10.5px;font-weight:700;letter-spacing:.4px;padding:3px 9px;border-radius:20px;color:' + c + ';background:' + bg;
  function parseRange(label) {
    const m = String(label || '').match(/(\d{1,2}):(\d{2})\s*([AP]M)\s*[-—]\s*(\d{1,2}):(\d{2})\s*([AP]M)/i);
    if (!m) return null;
    const to = (h, mi, ap) => (+h % 12 + (/pm/i.test(ap) ? 12 : 0)) * 3600 + +mi * 60;
    return {
      start: to(m[1], m[2], m[3]),
      end: to(m[4], m[5], m[6])
    };
  }
  const BUCKET = {
    M: {
      name: 'Morning',
      accent: '#27a8db',
      accent2: '#7ac4e8'
    },
    E: {
      name: 'Evening',
      accent: '#3ab5a7',
      accent2: '#7fd6cb'
    },
    N: {
      name: 'Night',
      accent: '#8a72ee',
      accent2: '#b9a8ff'
    },
    G: {
      name: 'General',
      accent: '#e08a1e',
      accent2: '#ffd166'
    }
  };
  const TEAM_COLORS = ['#0072a3', '#3ab5a7', '#6a52d4', '#e08a1e', '#27a8db', '#d23a52'];
  const KEYFRAMES = fixAnim(`
@keyframes orbFloat{from{transform:translate(0,0) scale(1)}to{transform:translate(160px,110px) scale(1.18)}}
@keyframes livepulse{0%{box-shadow:0 0 0 0 rgba(61,220,151,.6)}70%{box-shadow:0 0 0 8px rgba(61,220,151,0)}100%{box-shadow:0 0 0 0 rgba(61,220,151,0)}}
@keyframes shiftSweep{from{background-position:200% 0}to{background-position:-200% 0}}
@keyframes tick{from{opacity:.45}to{opacity:1}}
@keyframes cloudDrift{from{transform:translateX(-120px)}to{transform:translateX(760px)}}
@keyframes twinkle{0%,100%{opacity:.25}50%{opacity:1}}
@keyframes discGlow{0%,100%{filter:blur(0);transform:scale(1)}50%{filter:blur(.4px);transform:scale(1.04)}}
@keyframes birdFly{from{transform:translate(-60px,10px)}to{transform:translate(700px,-30px)}}
@keyframes rayspin{to{transform:rotate(360deg)}}
@keyframes planeFly{0%{transform:translate(-140px,26px)}100%{transform:translate(1100px,-16px)}}
@keyframes trailFade{0%,100%{opacity:0}12%{opacity:.55}80%{opacity:.2}}
@keyframes rocketRise{0%{transform:translate(0,120px) rotate(28deg);opacity:0}8%{opacity:1}70%{opacity:1}100%{transform:translate(300px,-190px) rotate(28deg);opacity:0}}
@keyframes flameFlicker{0%,100%{transform:scaleY(1);opacity:.9}50%{transform:scaleY(1.5);opacity:.6}}
@keyframes balloonUp{0%{transform:translateY(0) scale(.6);opacity:0}8%{opacity:1;transform:translateY(-10px) scale(1)}100%{transform:translateY(-280px) translateX(30px) scale(.85);opacity:0}}
@keyframes sway{0%,100%{rotate:-4deg}50%{rotate:4deg}}
@keyframes hotAir{from{transform:translateX(-90px)}to{transform:translateX(1150px)}}
@keyframes bob{0%,100%{translate:0 0}50%{translate:0 -9px}}
@keyframes shoot{0%,100%{transform:translate(0,0);opacity:0}3%{opacity:1}14%{transform:translate(-260px,150px);opacity:0}}
@keyframes smoke{0%{transform:translate(0,0) scale(.5);opacity:.5}100%{transform:translate(14px,-46px) scale(1.6);opacity:0}}
@keyframes winFlick{0%,92%,100%{opacity:.95}95%{opacity:.4}}
@keyframes godray{from{transform:rotate(0deg)}to{transform:rotate(-360deg)}}
@keyframes ringGlow{0%,100%{box-shadow:0 0 0 0 rgba(61,220,151,.0)}50%{box-shadow:0 0 22px 4px rgba(61,220,151,.35)}}
@keyframes riseIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes rainFall{from{transform:translateY(-40px)}to{transform:translateY(280px)}}
@keyframes snowFall{from{transform:translate(0,-20px) rotate(0)}to{transform:translate(34px,280px) rotate(180deg)}}
@keyframes flash{0%,94%,100%{opacity:0}95%{opacity:.75}96%{opacity:0}97.5%{opacity:.5}98.5%{opacity:0}}
@keyframes firefly{0%,100%{transform:translate(0,0);opacity:0}20%{opacity:1}50%{transform:translate(20px,-26px);opacity:.25}80%{opacity:1}}
@keyframes kiteBob{0%,100%{transform:translate(0,0) rotate(-10deg)}50%{transform:translate(14px,-16px) rotate(8deg)}}
@keyframes ripple{from{transform:scale(.15);opacity:.9}to{transform:scale(1);opacity:0}}
@keyframes grassSway{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(5deg)}}
@keyframes textGlow{0%,100%{text-shadow:0 0 0 rgba(39,168,219,0)}50%{text-shadow:0 0 18px rgba(39,168,219,.55)}}
@keyframes sparkle{0%{transform:scale(0) rotate(0);opacity:1}100%{transform:scale(1.5) rotate(120deg);opacity:0}}
@keyframes burst{0%{transform:translateX(0) scale(1);opacity:1}100%{transform:translateX(120px) scale(.3);opacity:0}}
@keyframes trainRun{from{transform:translateX(1260px)}to{transform:translateX(-380px)}}
@keyframes satellite{from{transform:translate(-30px,46px)}to{transform:translate(1000px,6px)}}
@keyframes barShine{from{transform:translateX(-100%)}to{transform:translateX(300%)}}
@keyframes slideDown{from{opacity:0;transform:translateY(-10px) scale(.98)}to{opacity:1;transform:none}}
@keyframes fadeSwap{from{opacity:0;transform:translateX(12px)}to{opacity:1;transform:none}}
@keyframes checkPop{0%{transform:scale(.4);opacity:0}60%{transform:scale(1.15);opacity:1}100%{transform:scale(1)}}
`) + `
@media (prefers-reduced-motion:reduce){.unico-home *{animation:none!important;transition:none!important}}`;
  const GLASS = 'background:linear-gradient(152deg,rgba(255,255,255,.82),rgba(236,247,255,.58));backdrop-filter:blur(22px) saturate(1.6);-webkit-backdrop-filter:blur(22px) saturate(1.6);border:1px solid rgba(255,255,255,.9);border-radius:16px;box-shadow:0 14px 38px rgba(31,59,90,.14),inset 0 1px 0 rgba(255,255,255,.95);padding:16px 17px';
  const cardH = (title, right) => React.createElement("div", {
    style: sx('display:flex;align-items:center;gap:10px;margin-bottom:12px')
  }, React.createElement("div", {
    style: sx('font-size:14.5px;font-weight:700;color:#16202e')
  }, title), React.createElement("span", {
    style: {
      flex: 1
    }
  }), right);
  const LIVE = {
    thisWeek: false,
    dutyToday: false,
    announcements: false,
    team: false,
    offDays: false,
    records: false
  };
  function Soon({
    live,
    label,
    children
  }) {
    if (live) return children;
    return React.createElement("div", {
      style: {
        position: 'relative'
      },
      "aria-disabled": "true"
    }, React.createElement("div", {
      style: {
        pointerEvents: 'none',
        userSelect: 'none',
        filter: 'saturate(.55)',
        opacity: .55
      },
      "aria-hidden": "true"
    }, children), React.createElement("div", {
      style: sx('position:absolute;inset:0;border-radius:16px;display:grid;place-items:center;background:linear-gradient(152deg,rgba(244,249,255,.55),rgba(226,239,252,.45));backdrop-filter:blur(3.5px);-webkit-backdrop-filter:blur(3.5px);border:1px dashed rgba(0,144,202,.35)')
    }, React.createElement("div", {
      style: {
        textAlign: 'center',
        padding: '0 18px'
      }
    }, React.createElement("div", {
      style: sx('display:inline-flex;align-items:center;gap:8px;padding:7px 14px;border-radius:20px;background:linear-gradient(135deg,#27a8db,#0072a3);color:#fff;font-size:11.5px;font-weight:800;letter-spacing:.8px;text-transform:uppercase;box-shadow:0 10px 24px rgba(0,144,202,.35)')
    }, React.createElement("svg", {
      width: "13",
      height: "13",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.4",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("rect", {
      x: "4",
      y: "11",
      width: "16",
      height: "10",
      rx: "2"
    }), React.createElement("path", {
      d: "M8 11V7a4 4 0 018 0v4"
    })), "Coming soon"), React.createElement("div", {
      style: sx('font-size:11px;color:#3c4e66;margin-top:8px;line-height:1.55;font-weight:600')
    }, label))));
  }
  const MOOD_DEFS = [{
    label: 'Great',
    mouth: 'M7.5 14c1.2 2.2 2.7 3.2 4.5 3.2s3.3-1 4.5-3.2',
    c: '#0f7a5f'
  }, {
    label: 'Good',
    mouth: 'M8.5 14.5c1 1.2 2.2 1.8 3.5 1.8s2.5-.6 3.5-1.8',
    c: '#0072a3'
  }, {
    label: 'Okay',
    mouth: 'M8.5 15.5h7',
    c: '#5c6f88'
  }, {
    label: 'Tired',
    mouth: 'M8.5 16.5c1-1.2 2.2-1.8 3.5-1.8s2.5.6 3.5 1.8',
    c: '#b06a10'
  }, {
    label: 'Stressed',
    mouth: 'M8 17c1.3-2 2.6-3 4-3s2.7 1 4 3',
    c: '#b2263e'
  }];
  function HomeView({
    setRoute
  }) {
    const u = typeof window !== 'undefined' && window.__UNICO_USER__ || null;
    const [now, setNow] = useState(() => new Date());
    const [roster, setRoster] = useState(null);
    const [certs, setCerts] = useState(null);
    const [moodSt, setMoodSt] = useState(() => lsGet(KEY_MOOD, {}));
    const [selDay, setSelDay] = useState(null);
    const [annPinned, setAnnPinned] = useState(null);
    const [openRec, setOpenRec] = useState(null);
    const [teamSel, setTeamSel] = useState(0);
    const [weather, setWeather] = useState('Clear');
    const [lights, setLights] = useState(null);
    const [par, setPar] = useState({
      mx: 0,
      my: 0
    });
    const [ripples, setRipples] = useState([]);
    const [sparkles, setSparkles] = useState([]);
    const [bursts, setBursts] = useState([]);
    const [balloonsUp, setBalloonsUp] = useState([]);
    const raf = useRef(0);
    const pm = useRef(null);
    const ls = useRef(0);
    useEffect(() => {
      document.title = 'Home · UNICO';
      const t = setInterval(() => setNow(new Date()), 1000);
      return () => clearInterval(t);
    }, []);
    const me = useMemo(() => {
      const list = typeof window !== 'undefined' && window.STAFF_SEED || [];
      if (!u) return list[0] || null;
      const norm = x => String(x == null ? '' : x).trim().toLowerCase().replace(/\s+/g, ' ');
      if (u.staffId != null) {
        const hit = list.find(s => String(s.id) === String(u.staffId));
        if (hit) return hit;
      }
      if (u.staffEmpId) {
        const hit = list.find(s => norm(s.emp_id) === norm(u.staffEmpId));
        if (hit) return hit;
      }
      return list.find(s => norm(s.emp_id) && norm(s.emp_id) === norm(u.username)) || (u.name ? list.find(s => norm(s.name) === norm(u.name)) : null) || null;
    }, [u]);
    const bdays = useMemo(() => {
      const list = typeof window !== 'undefined' && window.STAFF_SEED || [];
      if (!list.length) return [];
      if (window.STAFF && window.STAFF.birthdays) return window.STAFF.birthdays(list, 30);
      return [];
    }, [now.getDate()]);
    const staffName = u && u.name || me && me.name || 'UNICO staff';
    const designation = u && u.designation || me && me.designation || (u && u.role === 'incharge' ? 'In-charge' : 'Staff');
    const unit = me && me.current_department || 'Nursing Service';
    const staffId = me && me.emp_id || u && u.username || '—';
    const initials = initialsOf(staffName);
    useEffect(() => {
      let live = true;
      const y = now.getFullYear(),
        mo = now.getMonth();
      const hasMe = doc => {
        const g = doc && doc.grid;
        if (!g || !me) return false;
        const row = g['S' + me.id] || g[String(me.id)] || g[String(me.emp_id)];
        return !!(row && Object.keys(row).length);
      };
      const sq = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
      const myUnits = String(unit || '').split(',').map(sq).filter(Boolean);
      const isMyUnit = r => !!r && (myUnits.indexOf(sq(r.dept)) >= 0 || myUnits.indexOf(sq(r.deptName)) >= 0);
      fetch('/api/rosters', {
        credentials: 'same-origin'
      }).then(r => r.json()).then(async j => {
        const all = j && (j.rosters || j.list) || [];
        const month = all.filter(r => +r.year === y && +r.month === mo);
        const cand = [...month.filter(isMyUnit), ...month.filter(r => !isMyUnit(r))];
        if (!cand.length) {
          if (live) setRoster(false);
          return;
        }
        const get = r => fetch('/api/rosters/' + encodeURIComponent(r.dept) + '/' + r.year + '/' + r.month, {
          credentials: 'same-origin'
        }).then(x => x.json()).then(f => f && (f.roster || f.doc) || null).catch(() => null);
        let fallback = null;
        for (const r of cand.slice(0, 12)) {
          if (!live) return;
          const full = await get(r);
          if (!full) continue;
          if (!fallback && isMyUnit(full)) fallback = full;
          if (hasMe(full)) {
            if (live) setRoster(full);
            return;
          }
        }
        if (live) setRoster(fallback || false);
      }).catch(() => {
        if (live) setRoster(false);
      });
      return () => {
        live = false;
      };
    }, [unit, me && me.id]);
    useEffect(() => {
      let live = true;
      let allowed = true;
      try {
        allowed = window.unicoCan ? window.unicoCan('perf', 'view') : true;
      } catch (e) {
        allowed = true;
      }
      if (!allowed) {
        setCerts([]);
        return () => {
          live = false;
        };
      }
      fetch('/api/performance', {
        credentials: 'same-origin'
      }).then(r => r.json()).then(j => {
        if (live) setCerts(j && j.certifications || []);
      }).catch(() => {
        if (live) setCerts([]);
      });
      return () => {
        live = false;
      };
    }, []);
    const R = typeof window !== 'undefined' && window.UNICO_ROSTER || null;
    const codeInfo = useCallback(code => {
      if (!code || !R) return null;
      const f = R.byCode && R.byCode[code] || R.CODES && R.CODES[code] || (R.list || R.ALL || []).find && (R.list || R.ALL || []).find(c => c.code === code);
      if (!f) return {
        code,
        label: '',
        bucket: '',
        hours: 0
      };
      return {
        code,
        label: f.label || f.time || '',
        bucket: f.bucket || '',
        hours: f.hours || 0
      };
    }, [R]);
    const myRow = useMemo(() => {
      if (!roster || !roster.grid || !me) return null;
      return roster.grid[String(me.id)] || roster.grid[String(me.emp_id)] || null;
    }, [roster, me]);
    const h = now.getHours();
    const greeting = h >= 23 || h < 5 ? 'Working late' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 20 ? 'Good evening' : 'Good night';
    const greetEmoji = h >= 23 || h < 5 ? '🌙✨' : h < 12 ? '☀️' : h < 17 ? '🌤️' : h < 20 ? '🌆' : '🌙';
    const dateLine = now.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
    const h12 = h % 12 === 0 ? 12 : h % 12;
    const clock = pad(h12) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds()) + ' ' + (h < 12 ? 'AM' : 'PM');
    const todayCode = roster && +roster.year === now.getFullYear() && +roster.month === now.getMonth() + 1 && myRow ? myRow[now.getDate()] : null;
    const todayInfo = codeInfo(todayCode);
    const sh = useMemo(() => {
      if (!todayInfo || !todayInfo.label) return null;
      const r = parseRange(todayInfo.label);
      if (!r) return null;
      const b = BUCKET[todayInfo.bucket] || BUCKET.M;
      const fmt = s => to12(pad(Math.floor(s / 3600) % 24) + ':' + pad(Math.floor(s / 60) % 60));
      return {
        name: b.name,
        accent: b.accent,
        accent2: b.accent2,
        start: r.start,
        len: r.end > r.start ? r.end - r.start : 86400 - r.start + r.end,
        range: fmt(r.start) + ' — ' + fmt(r.end)
      };
    }, [todayCode]);
    const secs = h * 3600 + now.getMinutes() * 60 + now.getSeconds();
    let on = false,
      before = false,
      remain = 0,
      pct = 0;
    if (sh) {
      let s0 = sh.start,
        s1 = sh.start + sh.len,
        t = secs;
      if (s1 > 86400 && t < s1 - 86400) t += 86400;
      before = t < s0;
      on = t >= s0 && t < s1;
      remain = on ? s1 - t : before ? s0 - t : 86400 + s0 - t;
      pct = on ? (t - s0) / sh.len * 100 : 0;
    }
    const hms = v => pad(Math.floor(v / 3600)) + ':' + pad(Math.floor(v / 60) % 60) + ':' + pad(v % 60);
    const shiftNote = !sh ? roster === null ? 'Looking for your duty roster…' : roster === false ? 'No duty roster has been published for your department yet.' : 'You are not on this month’s roster for ' + (roster && (roster.deptName || roster.dept) || 'your unit') + '.' : on ? sh.name + ' shift in progress — ' + Math.round(pct) + '% elapsed, ends ' + sh.range.split(' — ')[1] + '.' : before ? sh.name + ' shift starts at ' + sh.range.split(' — ')[0] + ' today.' : 'Shift completed. Next duty per the roster.';
    const theme = h >= 5 && h < 12 ? {
      a: 'rgba(255,214,140,.55)',
      b: 'rgba(120,196,240,.5)',
      sky: 'linear-gradient(170deg,#3f8fd0 0%,#7bc0e8 34%,#bfe1f2 62%,#ffd9a3 88%,#ffc27a 100%)',
      wash: 'linear-gradient(140deg,rgba(255,196,120,.22),transparent 60%)'
    } : h >= 12 && h < 17 ? {
      a: 'rgba(255,255,255,.5)',
      b: 'rgba(120,206,240,.5)',
      sky: 'linear-gradient(170deg,#2f7fc4 0%,#66b4e2 38%,#a9d8ef 70%,#dcf0f8 100%)',
      wash: 'linear-gradient(140deg,rgba(255,255,255,.16),transparent 60%)'
    } : h >= 17 && h < 20 ? {
      a: 'rgba(255,158,110,.5)',
      b: 'rgba(126,96,210,.5)',
      sky: 'linear-gradient(170deg,#2a3a78 0%,#7a5a9e 32%,#e08a6a 66%,#ffb27a 86%,#ffd9a3 100%)',
      wash: 'linear-gradient(140deg,rgba(255,150,110,.2),transparent 62%)'
    } : {
      a: 'rgba(106,82,212,.42)',
      b: 'rgba(39,168,219,.28)',
      sky: 'linear-gradient(170deg,#0a1428 0%,#122448 46%,#1b2f5a 78%,#24406e 100%)',
      wash: 'linear-gradient(140deg,rgba(88,66,190,.22),rgba(12,26,52,.2) 55%,transparent)'
    };
    const night = h >= 20 || h < 5;
    const ink = night ? {
      strong: '#ffffff',
      soft: '#9fb0c4',
      muted: '#7d8ea8'
    } : {
      strong: '#0c1c34',
      soft: '#3c4e66',
      muted: '#5c6f88'
    };
    const lit = lights == null ? night : lights;
    const dayFrac = night ? ((h >= 20 ? h - 20 : h + 4) + now.getMinutes() / 60) / 9 : (h - 5 + now.getMinutes() / 60) / 15;
    const px = Math.min(1, Math.max(0, dayFrac));
    const discX = 6 + px * 48,
      discY = 56 - Math.sin(px * Math.PI) * 38;
    const parS = (fx, fy) => 'transform:translate(' + (par.mx * fx).toFixed(1) + 'px,' + (par.my * fy).toFixed(1) + 'px);transition:transform .5s cubic-bezier(.2,.7,.3,1)';
    const disc = night ? 'position:absolute;left:' + discX.toFixed(1) + '%;top:' + discY.toFixed(1) + 'px;width:44px;height:44px;border-radius:50%;background:radial-gradient(circle at 36% 34%,#f4f7ff,#c3cfe6 62%,#9aa8c4);box-shadow:0 0 34px 12px rgba(198,214,255,.28),inset -8px -4px 0 rgba(10,18,36,.35);animation:discGlow 7s ease-in-out infinite' : 'position:absolute;left:' + discX.toFixed(1) + '%;top:' + discY.toFixed(1) + 'px;width:58px;height:58px;border-radius:50%;background:radial-gradient(circle at 40% 38%,#fff6d8,#ffd166 52%,#ffa93c);box-shadow:0 0 52px 20px rgba(255,190,90,.4),0 0 120px 50px rgba(255,170,70,.18);animation:discGlow 6s ease-in-out infinite';
    const rays = night ? null : 'position:absolute;inset:-26px;border-radius:50%;background:conic-gradient(from 0deg,rgba(255,214,140,.32) 0 6deg,transparent 6deg 30deg,rgba(255,214,140,.28) 30deg 36deg,transparent 36deg 60deg,rgba(255,214,140,.32) 60deg 66deg,transparent 66deg 90deg,rgba(255,214,140,.28) 90deg 96deg,transparent 96deg 120deg,rgba(255,214,140,.32) 120deg 126deg,transparent 126deg 150deg,rgba(255,214,140,.28) 150deg 156deg,transparent 156deg 180deg,rgba(255,214,140,.32) 180deg 186deg,transparent 186deg 210deg,rgba(255,214,140,.28) 210deg 216deg,transparent 216deg 240deg,rgba(255,214,140,.32) 240deg 246deg,transparent 246deg 270deg,rgba(255,214,140,.28) 270deg 276deg,transparent 276deg 300deg,rgba(255,214,140,.32) 300deg 306deg,transparent 306deg 330deg,rgba(255,214,140,.28) 330deg 336deg,transparent 336deg 360deg);mask:radial-gradient(circle,transparent 30%,#000 34%,transparent 74%);-webkit-mask:radial-gradient(circle,transparent 30%,#000 34%,transparent 74%);animation:rayspin 90s linear infinite;pointer-events:none';
    const moonPhase = ((now - new Date(2000, 0, 6, 18, 14)) / 86400000 / 29.530588853 % 1 + 1) % 1;
    const illum = 1 - Math.abs(moonPhase - .5) * 2;
    const moonShadow = night ? 'position:absolute;inset:0;border-radius:50%;overflow:hidden;pointer-events:none;background:radial-gradient(circle 22px at ' + (50 - (moonPhase < .5 ? 1 : -1) * illum * 100).toFixed(0) + '% 50%,rgba(12,26,52,.85) 20.5px,transparent 22px);transition:background 1s' : null;
    const cloudTint = night ? 'rgba(160,176,204,.22)' : h >= 17 ? 'rgba(255,214,196,.4)' : 'rgba(255,255,255,.42)';
    const clouds = [{
      top: 22,
      sc: 1,
      dur: 64,
      delay: 0
    }, {
      top: 58,
      sc: .72,
      dur: 92,
      delay: -22
    }, {
      top: 12,
      sc: .55,
      dur: 120,
      delay: -48
    }];
    const puff = (w, hh, l, b) => 'position:absolute;left:' + l + 'px;bottom:' + b + 'px;width:' + w + 'px;height:' + hh + 'px;border-radius:50%;background:' + cloudTint + ';filter:blur(6px)';
    const stars = night ? Array.from({
      length: 16
    }, (_, i) => 'position:absolute;left:' + (i * 37 % 97 + 1) + '%;top:' + (i * 23 % 46 + 4) + 'px;width:' + (i % 3 === 0 ? 2.5 : 1.8) + 'px;height:' + (i % 3 === 0 ? 2.5 : 1.8) + 'px;border-radius:50%;background:#eaf1ff;opacity:.6;animation:twinkle ' + (2.4 + i % 5 * .6).toFixed(1) + 's ease-in-out infinite;animation-delay:-' + (i * .37).toFixed(2) + 's') : [];
    const flocks = [{
      top: 24,
      w: 84,
      hh: 18,
      dur: 30,
      delay: 0,
      op: .5
    }, {
      top: 52,
      w: 58,
      hh: 13,
      dur: 44,
      delay: -12,
      op: .38
    }, {
      top: 14,
      w: 44,
      hh: 10,
      dur: 58,
      delay: -26,
      op: .3
    }, {
      top: 74,
      w: 70,
      hh: 15,
      dur: 38,
      delay: -33,
      op: .32
    }];
    const drops = weather === 'Rain' ? Array.from({
      length: 46
    }, (_, i) => 'position:absolute;top:0;left:' + i * 53 % 100 + '%;width:1.5px;height:' + (14 + i % 4 * 4) + 'px;border-radius:2px;background:linear-gradient(180deg,transparent,rgba(210,230,255,.75));rotate:12deg;animation:rainFall ' + (.7 + i % 5 * .12).toFixed(2) + 's linear -' + (i * .37 % 1.4).toFixed(2) + 's infinite;pointer-events:none') : [];
    const flakes = weather === 'Snow' ? Array.from({
      length: 34
    }, (_, i) => 'position:absolute;top:0;left:' + i * 41 % 100 + '%;width:' + (3 + i % 3 * 1.5) + 'px;height:' + (3 + i % 3 * 1.5) + 'px;border-radius:50%;background:rgba(255,255,255,.9);filter:blur(' + (i % 3 === 0 ? .8 : 0) + 'px);animation:snowFall ' + (6 + i % 6).toFixed(1) + 's linear -' + (i * .9 % 6).toFixed(2) + 's infinite;pointer-events:none') : [];
    const fireflies = night ? Array.from({
      length: 12
    }, (_, i) => 'position:absolute;left:' + (i * 29 % 96 + 2) + '%;bottom:' + (18 + i * 13 % 50) + 'px;width:4px;height:4px;border-radius:50%;background:#ffe27a;box-shadow:0 0 8px 3px rgba(255,226,122,.55);animation:firefly ' + (4 + i % 4).toFixed(1) + 's ease-in-out -' + (i * .7).toFixed(1) + 's infinite;pointer-events:none') : [];
    const rainbow = !night && weather === 'Rain' ? 'position:absolute;left:18%;bottom:-300px;width:560px;height:560px;border-radius:50%;pointer-events:none;opacity:.42;filter:blur(1.5px);background:radial-gradient(circle,transparent 61%,#d23a52 61.5% 63.5%,#e08a1e 63.5% 65.5%,#ffd166 65.5% 67.5%,#3ddc97 67.5% 69.5%,#27a8db 69.5% 71.5%,#6a52d4 71.5% 73.5%,transparent 74%);animation:riseIn 1.5s ease-out backwards' : null;
    const heroMove = e => {
      const r = e.currentTarget.getBoundingClientRect();
      pm.current = {
        mx: ((e.clientX - r.left) / r.width - .5) * 2,
        my: ((e.clientY - r.top) / r.height - .5) * 2
      };
      const t = performance.now();
      if (e.target === e.currentTarget && t - ls.current > 70) {
        ls.current = t;
        const id = t + Math.random();
        setSparkles(s => [...s, {
          id,
          x: e.clientX - r.left,
          y: e.clientY - r.top,
          s: 6 + Math.random() * 8
        }].slice(-24));
        setTimeout(() => setSparkles(s => s.filter(x => x.id !== id)), 800);
      }
      if (!raf.current) raf.current = requestAnimationFrame(() => {
        raf.current = 0;
        setPar(pm.current);
      });
    };
    const heroClick = e => {
      if (e.target !== e.currentTarget) return;
      const r = e.currentTarget.getBoundingClientRect();
      const id = Date.now() + Math.random();
      const x = e.clientX - r.left,
        y = e.clientY - r.top;
      setRipples(s => [...s, {
        id,
        x,
        y
      }]);
      setTimeout(() => setRipples(s => s.filter(q => q.id !== id)), 900);
      const colors = ['#d23a52', '#27a8db', '#3ab5a7', '#e08a1e', '#6a52d4', '#ffd166'];
      setBalloonsUp(s => [...s, {
        id,
        x,
        y,
        color: colors[Math.floor(Math.random() * colors.length)]
      }]);
      setTimeout(() => setBalloonsUp(s => s.filter(q => q.id !== id)), 9000);
    };
    const celebrate = e => {
      e.stopPropagation();
      const r = e.currentTarget.getBoundingClientRect(),
        hb = e.currentTarget.parentElement.getBoundingClientRect();
      const cx = r.left - hb.left + r.width / 2,
        cy = r.top - hb.top + r.height / 2;
      const colors = ['#d23a52', '#27a8db', '#3ab5a7', '#e08a1e', '#6a52d4', '#ffd166', '#3ddc97'];
      const batch = Date.now();
      const pieces = Array.from({
        length: 26
      }, (_, i) => ({
        id: batch + i / 100,
        x: cx,
        y: cy,
        a: i * (360 / 26) + Math.random() * 10,
        sc: .6 + Math.random() * .9,
        c: colors[i % colors.length],
        w: 5 + Math.random() * 5
      }));
      setBursts(s => [...s, ...pieces]);
      setTimeout(() => setBursts(s => s.filter(x => Math.floor(x.id) !== batch)), 1000);
    };
    const cycleWeather = e => {
      e.stopPropagation();
      const o = ['Clear', 'Rain', 'Snow'];
      setWeather(w => o[(o.indexOf(w) + 1) % 3]);
    };
    const week = useMemo(() => {
      const d0 = new Date(now);
      d0.setDate(now.getDate() - (now.getDay() + 6) % 7);
      return Array.from({
        length: 7
      }, (_, i) => {
        const d = new Date(d0);
        d.setDate(d0.getDate() + i);
        const inMonth = roster && +roster.year === d.getFullYear() && +roster.month === d.getMonth() + 1;
        const code = inMonth && myRow ? myRow[d.getDate()] : null;
        const info = codeInfo(code);
        const off = !code || info && info.bucket === 'O';
        return {
          full: d,
          dow: d.toLocaleDateString('en-GB', {
            weekday: 'short'
          }),
          date: pad(d.getDate()),
          code,
          info,
          off,
          today: d.toDateString() === now.toDateString()
        };
      });
    }, [roster, myRow, now.toDateString()]);
    const sel = selDay != null ? selDay : (now.getDay() + 6) % 7;
    const sd = week[sel];
    const anns = useMemo(() => {
      const out = [];
      if (roster && roster.deptName) {
        out.push({
          title: 'Roster published — ' + roster.deptName,
          body: 'The ' + roster.deptName + ' duty roster for ' + pad(roster.month) + '/' + roster.year + ' is live' + (roster.status ? ' (' + roster.status + ')' : '') + '. Open Duty Roster to see your month.'
        });
      }
      (certs || []).forEach(c => {
        if (!c.expiry) return;
        const d = new Date(c.expiry),
          days = Math.round((d - now) / 86400000);
        if (days > 0 && days <= 90) out.push({
          title: (c.name || 'Certification') + ' expiring',
          body: 'Expires ' + c.expiry + ' (' + days + ' days). Arrange renewal through your supervisor.'
        });
      });
      if (!out.length) out.push({
        title: 'No announcements yet',
        body: 'This space carries Nursing Services notices — roster publications and certification reminders appear here on their own.'
      });
      return out;
    }, [roster, certs, now.toDateString()]);
    const ai = annPinned != null ? Math.min(annPinned, anns.length - 1) : Math.floor(now.getTime() / 7000) % anns.length;
    const team = useMemo(() => {
      if (!roster || !roster.grid || !todayCode) return [];
      const rows = roster.names || roster.rows || [];
      const staffList = typeof window !== 'undefined' && window.STAFF_SEED || [];
      return rows.filter(r => {
        const g = roster.grid[String(r.id)] || roster.grid[String(r.empId)] || roster.grid[String(r.emp_id)] || {};
        return g[now.getDate()] === todayCode;
      }).slice(0, 6).map((r, i) => {
        const nm = r.name || r.staffName || String(r.empId || r.emp_id || r.id);
        const st = staffList.find(s => s.name === nm || String(s.emp_id) === String(r.empId || r.emp_id));
        return {
          name: nm,
          role: st && st.designation || r.designation || 'Staff',
          c: TEAM_COLORS[i % TEAM_COLORS.length]
        };
      });
    }, [roster, todayCode, now.toDateString()]);
    const tp = team[Math.min(teamSel, Math.max(0, team.length - 1))] || null;
    const offStats = useMemo(() => {
      if (!myRow || !roster) return null;
      const daysIn = new Date(roster.year, roster.month, 0).getDate();
      let total = 0,
        taken = 0;
      for (let d = 1; d <= daysIn; d++) {
        const inf = codeInfo(myRow[d]);
        if (inf && inf.bucket === 'O') {
          total++;
          if (+roster.month === now.getMonth() + 1 && d <= now.getDate()) taken++;
        }
      }
      return {
        total,
        taken,
        left: total - taken
      };
    }, [myRow, roster, now.toDateString()]);
    const records = useMemo(() => {
      const out = (certs || []).filter(c => me && (String(c.staffId) === String(me.id) || String(c.empId) === String(me.emp_id))).map(c => {
        const exp = c.expiry ? new Date(c.expiry) : null;
        const expired = exp && exp < now,
          soon = exp && !expired && (exp - now) / 86400000 <= 90;
        return {
          label: c.name || c.title || 'Certification',
          meta: c.expiry ? (expired ? 'Expired ' : 'Expires ') + c.expiry : c.issued ? 'Issued ' + c.issued : 'No date recorded',
          tag: expired ? 'Expired' : soon ? 'Renew soon' : 'Valid',
          tagStyle: expired ? tag('#b2263e', 'rgba(210,58,82,.14)') : soon ? tag('#b06a10', 'rgba(224,138,30,.16)') : tag('#0f7a5f', 'rgba(61,220,151,.2)'),
          dotC: expired ? '#d23a52' : soon ? '#e08a1e' : '#3ddc97',
          detail: [c.issuer && 'Issued by ' + c.issuer, c.issued && 'Issued ' + c.issued, c.note].filter(Boolean).join(' · ') || 'Recorded on the staff register.'
        };
      });
      if (me && me.hepatitis_b_vaccination) {
        const done = /^completed$/i.test(String(me.hepatitis_b_vaccination).trim());
        out.push({
          label: 'Hepatitis B vaccination',
          meta: String(me.hepatitis_b_vaccination),
          tag: done ? 'Complete' : 'Incomplete',
          tagStyle: done ? tag('#0f7a5f', 'rgba(61,220,151,.2)') : tag('#b06a10', 'rgba(224,138,30,.16)'),
          dotC: done ? '#3ddc97' : '#e08a1e',
          detail: 'From the staff register. Ask Nursing Services to correct this if it is out of date.'
        });
      }
      return out;
    }, [certs, me, now.toDateString()]);
    const dayKey = now.toDateString();
    const mood = moodSt[dayKey] && moodSt[dayKey].label;
    const moodAt = moodSt[dayKey] && moodSt[dayKey].at;
    const pickMood = label => setMoodSt(s => {
      const n = Object.assign({}, s, {
        [dayKey]: {
          label,
          at: Date.now()
        }
      });
      lsSet(KEY_MOOD, n);
      return n;
    });
    const shiftCard = 'position:relative;flex:1 1 300px;min-width:0;max-width:400px;margin-left:auto;padding:13px 15px;border-radius:14px;overflow:hidden;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid ' + (night ? 'rgba(122,196,232,.4)' : 'rgba(255,255,255,.85)') + ';background:' + (night ? 'linear-gradient(120deg,' + (sh && sh.accent || '#27a8db') + '44,rgba(255,255,255,.06),' + (sh && sh.accent || '#27a8db') + '44) 0 0/220% 100%' : 'linear-gradient(120deg,rgba(255,255,255,.78),rgba(255,255,255,.6),rgba(255,255,255,.78)) 0 0/220% 100%') + ';animation:shiftSweep 7s linear infinite;box-shadow:0 10px 28px rgba(12,28,52,' + (night ? '.22' : '.14') + ')';
    const miniLabel = 'font-size:9.5px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:' + ink.muted;
    const rangeStyle = "font-size:10.5px;font-family:'IBM Plex Mono',monospace;color:" + ink.soft;
    const factChip = i => 'min-width:126px;flex:1 1 120px;padding:9px 12px;border-radius:11px;cursor:default;border:1px solid ' + (night ? 'rgba(255,255,255,.14)' : 'rgba(12,28,52,.12)') + ';background:' + (night ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,.55)') + ';backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);animation:riseIn .6s cubic-bezier(.2,.7,.3,1) ' + (.15 + i * .08).toFixed(2) + 's backwards';
    const idFacts = [{
      label: 'Staff ID',
      value: staffId
    }, {
      label: 'Date of joining',
      value: me && me.doj || 'Not recorded'
    }, {
      label: 'Role',
      value: designation || (!u ? 'Local session' : u.role === 'incharge' ? 'In-charge' : u.role === 'collector' ? 'Data Collector' : u.role || 'Staff')
    }, {
      label: 'Department',
      value: unit
    }];
    const nextOff = week.find(w => w.off && w.code && w.full >= now);
    const duty = [{
      label: 'Assigned shift',
      value: sh ? sh.name : 'None',
      note: sh ? sh.range : 'Nothing rostered today'
    }, {
      label: 'Ward',
      value: unit,
      note: roster && roster.deptName || 'From your staff record'
    }, {
      label: 'Next off day',
      value: nextOff ? nextOff.dow + ' ' + nextOff.date : '—',
      note: nextOff ? 'From this week’s roster' : 'None in the next 7 days'
    }, {
      label: 'Off days',
      value: offStats ? offStats.left + ' left' : '—',
      note: offStats ? offStats.taken + ' taken of ' + offStats.total + ' this month' : 'Needs a published roster'
    }];
    return React.createElement("div", {
      className: "unico-home",
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 16
      }
    }, React.createElement("style", null, KEYFRAMES), React.createElement("div", {
      onMouseMove: heroMove,
      onMouseLeave: () => setPar({
        mx: 0,
        my: 0
      }),
      onClick: heroClick,
      style: sx('position:relative;overflow:hidden;border-radius:18px;padding:20px 22px 88px;display:flex;align-items:center;gap:18px;flex-wrap:wrap;min-height:236px;box-shadow:0 18px 48px rgba(12,28,52,.25)')
    }, React.createElement("div", {
      style: sx('position:absolute;inset:0;pointer-events:none;transition:background 1.2s ease;background:' + theme.sky)
    }), React.createElement("div", {
      style: fs('position:absolute;top:-100px;right:6%;width:280px;height:250px;border-radius:50%;pointer-events:none;filter:blur(26px);background:radial-gradient(circle,' + theme.a + ',transparent 70%);animation:orbFloat 16s ease-in-out infinite alternate')
    }), React.createElement("div", {
      style: fs('position:absolute;bottom:-120px;left:32%;width:300px;height:250px;border-radius:50%;pointer-events:none;filter:blur(30px);background:radial-gradient(circle,' + theme.b + ',transparent 70%);animation:orbFloat 21s ease-in-out infinite alternate-reverse')
    }), stars.map((st, i) => React.createElement("span", {
      key: 's' + i,
      "aria-hidden": "true",
      style: fs(st)
    })), night && React.createElement("span", {
      "aria-hidden": "true",
      style: fs('position:absolute;top:8px;left:0;width:3px;height:3px;border-radius:50%;background:#cfe0f0;opacity:.8;animation:satellite 26s linear infinite;pointer-events:none')
    }), night && React.createElement("span", {
      "aria-hidden": "true",
      style: fs('position:absolute;top:16%;right:6%;width:78px;height:1.5px;border-radius:2px;background:linear-gradient(270deg,transparent,#fff);animation:shoot 14s linear infinite;pointer-events:none')
    }), React.createElement("div", {
      onClick: cycleWeather,
      title: "Click to change the weather",
      style: Object.assign(fs(disc), sx('pointer-events:auto;cursor:pointer;z-index:3;' + parS(-10, -6)))
    }, rays && React.createElement("span", {
      style: fs(rays)
    }), moonShadow && React.createElement("span", {
      style: fs(moonShadow)
    })), React.createElement("div", {
      "aria-hidden": "true",
      style: sx('position:absolute;inset:0;pointer-events:none;' + parS(18, 8))
    }, clouds.map((c, i) => React.createElement("span", {
      key: 'c' + i,
      style: fs('position:absolute;top:' + c.top + 'px;left:0;width:120px;height:34px;transform-origin:left center;scale:' + c.sc + ';opacity:' + (night ? .5 : .85) + ';animation:cloudDrift ' + c.dur + 's linear infinite;animation-delay:' + c.delay + 's')
    }, React.createElement("span", {
      style: sx(puff(72, 26, 0, 0))
    }), React.createElement("span", {
      style: sx(puff(52, 40, 30, 6))
    }), React.createElement("span", {
      style: sx(puff(58, 24, 60, 0))
    })))), React.createElement("div", {
      "aria-hidden": "true",
      style: sx('position:absolute;inset:0;pointer-events:none;' + parS(22, 10))
    }, React.createElement("div", {
      style: fs('position:absolute;top:' + (night ? 40 : 30) + 'px;left:0;opacity:' + (night ? .75 : 1) + ';animation:hotAir 95s linear infinite;animation-delay:-30s')
    }, React.createElement("div", {
      style: fs('animation:bob 5s ease-in-out infinite')
    }, React.createElement("svg", {
      viewBox: "0 0 40 60",
      width: "30",
      height: "45",
      style: sx('display:block;filter:drop-shadow(0 2px 4px rgba(10,20,40,.3))')
    }, React.createElement("path", {
      d: "M20 2C9 2 2 10 2 20c0 10 10 18 15 26h6c5-8 15-16 15-26C38 10 31 2 20 2z",
      fill: "#d23a52"
    }), React.createElement("path", {
      d: "M20 2c-4 0-7 8-7 18s4 18 7 26c3-8 7-16 7-26S24 2 20 2z",
      fill: "#ffd166"
    }), React.createElement("path", {
      d: "M17 46v6M23 46v6",
      stroke: "#5a4634",
      strokeWidth: "1.4"
    }), React.createElement("rect", {
      x: "14",
      y: "52",
      width: "12",
      height: "7",
      rx: "1.5",
      fill: "#8a5a2b"
    }))))), !night && React.createElement("div", {
      "aria-hidden": "true",
      style: sx('position:absolute;inset:0;pointer-events:none;' + parS(28, 12))
    }, flocks.map((b, i) => React.createElement("svg", {
      key: 'f' + i,
      viewBox: "0 0 140 30",
      width: b.w,
      height: b.hh,
      style: fs('position:absolute;top:' + b.top + 'px;left:0;opacity:' + b.op + ';animation:birdFly ' + b.dur + 's linear infinite;animation-delay:' + b.delay + 's;pointer-events:none'),
      fill: "none",
      stroke: "#12233c",
      strokeWidth: "2.4",
      strokeLinecap: "round"
    }, React.createElement("path", {
      d: "M6 16c5-7 10-7 15 0M34 9c5-7 10-7 15 0M58 20c5-7 10-7 15 0M86 12c5-7 10-7 15 0"
    })))), React.createElement("div", {
      "aria-hidden": "true",
      style: fs('position:absolute;top:' + (night ? 34 : 18) + 'px;left:0;width:190px;height:14px;opacity:' + (night ? .5 : .9) + ';animation:planeFly 22s linear infinite;pointer-events:none')
    }, React.createElement("div", {
      style: fs('position:absolute;right:26px;top:7px;width:150px;height:3px;border-radius:2px;background:linear-gradient(270deg,rgba(255,255,255,.85),transparent);filter:blur(1.4px);animation:trailFade 22s linear infinite')
    }), React.createElement("svg", {
      viewBox: "0 0 64 24",
      width: "34",
      height: "13",
      style: sx('position:absolute;right:0;top:0;filter:drop-shadow(0 1px 2px rgba(10,20,40,.35))'),
      fill: "#eef4fb"
    }, React.createElement("path", {
      d: "M63 12l-9 3H36l-9 8h-5l3-8H14l-5 5H5l3-5H2v-6h6L5 4h4l5 5h11l-3-8h5l9 8h18z"
    }))), React.createElement("div", {
      "aria-hidden": "true",
      style: fs('position:absolute;bottom:56px;left:14%;width:16px;animation:rocketRise 17s ease-in ' + (night ? '2s' : '6s') + ' infinite;pointer-events:none')
    }, React.createElement("svg", {
      viewBox: "0 0 24 60",
      width: "15",
      height: "38",
      style: sx('display:block;filter:drop-shadow(0 0 8px rgba(255,170,90,.6))')
    }, React.createElement("path", {
      d: "M12 0c6 10 8 20 8 30l-4 12H8L4 30C4 20 6 10 12 0z",
      fill: "#e8eef7"
    }), React.createElement("path", {
      d: "M12 0c3 10 4 20 4 30l-2 12h-4z",
      fill: "#ffffff",
      opacity: ".55"
    }), React.createElement("circle", {
      cx: "12",
      cy: "20",
      r: "3.4",
      fill: "#27a8db"
    }), React.createElement("path", {
      d: "M4 30L0 44l6-4zM20 30l4 14-6-4z",
      fill: "#d23a52"
    })), React.createElement("div", {
      style: fs('width:9px;height:26px;margin:-2px auto 0;border-radius:0 0 50% 50%;background:linear-gradient(180deg,#ffd166,#ff7a3c,transparent);filter:blur(2px);transform-origin:top center;animation:flameFlicker .35s linear infinite')
    })), !night && React.createElement("div", {
      "aria-hidden": "true",
      style: sx('position:absolute;right:20%;top:22px;width:80px;height:150px;pointer-events:none;opacity:.9')
    }, React.createElement("svg", {
      viewBox: "0 0 80 150",
      width: "80",
      height: "150",
      style: sx('display:block;overflow:visible')
    }, React.createElement("path", {
      d: "M40 34c-8 30-22 60-30 116",
      stroke: "rgba(40,60,90,.55)",
      strokeWidth: "1",
      fill: "none"
    }), React.createElement("g", {
      style: fs('transform-origin:40px 18px;animation:kiteBob 4s ease-in-out infinite')
    }, React.createElement("path", {
      d: "M40 0l16 18-16 22-16-22z",
      fill: "#d23a52"
    }), React.createElement("path", {
      d: "M40 0v40M24 18h32",
      stroke: "rgba(255,255,255,.6)",
      strokeWidth: "1.2"
    }), React.createElement("path", {
      d: "M40 40q-6 8 0 16q6 8 0 16",
      stroke: "#e08a1e",
      strokeWidth: "2",
      fill: "none"
    })))), weather === 'Rain' && React.createElement(React.Fragment, null, React.createElement("div", {
      "aria-hidden": "true",
      style: sx('position:absolute;inset:0;background:rgba(60,80,110,.28);pointer-events:none')
    }), drops.map((d, i) => React.createElement("span", {
      key: 'd' + i,
      "aria-hidden": "true",
      style: fs(d)
    })), React.createElement("div", {
      "aria-hidden": "true",
      style: fs('position:absolute;inset:0;background:#fff;pointer-events:none;animation:flash 11s linear infinite')
    }), rainbow && React.createElement("div", {
      "aria-hidden": "true",
      style: fs(rainbow)
    })), weather === 'Snow' && flakes.map((f, i) => React.createElement("span", {
      key: 'sn' + i,
      "aria-hidden": "true",
      style: fs(f)
    })), fireflies.map((f, i) => React.createElement("span", {
      key: 'ff' + i,
      "aria-hidden": "true",
      style: fs(f)
    })), React.createElement("svg", {
      onClick: e => {
        e.stopPropagation();
        setLights(v => !(v == null ? night : v));
      },
      viewBox: "0 0 1200 200",
      preserveAspectRatio: "none",
      style: sx('position:absolute;left:-12px;right:-12px;bottom:0;width:calc(100% + 24px);height:74px;opacity:' + (night ? .95 : .8) + ';pointer-events:auto;cursor:pointer;' + parS(-8, 2))
    }, React.createElement("g", {
      style: fs('animation:trainRun 36s linear 6s infinite')
    }, React.createElement("g", {
      fill: "#040a16",
      opacity: ".92"
    }, React.createElement("rect", {
      x: "0",
      y: "176",
      width: "70",
      height: "20",
      rx: "3"
    }), React.createElement("rect", {
      x: "8",
      y: "166",
      width: "30",
      height: "12",
      rx: "2"
    }), React.createElement("rect", {
      x: "76",
      y: "178",
      width: "60",
      height: "18",
      rx: "2"
    }), React.createElement("rect", {
      x: "142",
      y: "178",
      width: "60",
      height: "18",
      rx: "2"
    }), React.createElement("rect", {
      x: "208",
      y: "178",
      width: "60",
      height: "18",
      rx: "2"
    })), React.createElement("g", {
      style: sx('opacity:' + (lit ? 1 : 0) + ';transition:opacity 1.2s ease'),
      fill: "#ffd98a"
    }, React.createElement("rect", {
      x: "14",
      y: "169",
      width: "7",
      height: "6"
    }), React.createElement("rect", {
      x: "82",
      y: "182",
      width: "8",
      height: "6"
    }), React.createElement("rect", {
      x: "98",
      y: "182",
      width: "8",
      height: "6"
    }), React.createElement("rect", {
      x: "114",
      y: "182",
      width: "8",
      height: "6"
    }), React.createElement("rect", {
      x: "148",
      y: "182",
      width: "8",
      height: "6"
    }), React.createElement("rect", {
      x: "164",
      y: "182",
      width: "8",
      height: "6"
    }), React.createElement("rect", {
      x: "180",
      y: "182",
      width: "8",
      height: "6"
    }), React.createElement("rect", {
      x: "214",
      y: "182",
      width: "8",
      height: "6"
    }), React.createElement("rect", {
      x: "230",
      y: "182",
      width: "8",
      height: "6"
    }), React.createElement("rect", {
      x: "246",
      y: "182",
      width: "8",
      height: "6"
    })), React.createElement("circle", {
      cx: "60",
      cy: "170",
      r: "3",
      fill: "#ffe9a8"
    })), React.createElement("path", {
      d: "M0 150c120-26 210 10 330-6s200-40 320-24 260 44 380 22 170-14 170-14V200H0z",
      fill: "#050d1c",
      opacity: ".55"
    }), React.createElement("path", {
      d: "M0 200v-28h120l14-16 14 16h52v-34h26v-14l22-16 22 16v14h26v34h74l16-20 16 20h58v-46h30l24-18 24 18h30v46h96l14-18 14 18h64v-30h96v30h108l18-22 18 22h100v28z",
      fill: "#040a16",
      opacity: ".9"
    }), React.createElement("path", {
      d: "M470 172v-52h8v52zM474 118l-16 10 16 6 16-6z",
      fill: "#040a16",
      opacity: ".9"
    }), React.createElement("g", {
      fill: "#040a16",
      opacity: ".9"
    }, React.createElement("ellipse", {
      cx: "700",
      cy: "158",
      rx: "26",
      ry: "30"
    }), React.createElement("rect", {
      x: "697",
      y: "158",
      width: "6",
      height: "42"
    }), React.createElement("ellipse", {
      cx: "1010",
      cy: "164",
      rx: "22",
      ry: "26"
    }), React.createElement("rect", {
      x: "1007",
      y: "164",
      width: "6",
      height: "36"
    })), React.createElement("g", {
      fill: "#040a16",
      opacity: ".9"
    }, React.createElement("path", {
      d: "M872 200l4-72h8l4 72z"
    }), React.createElement("g", {
      style: fs('transform-origin:880px 126px;animation:rayspin 7s linear infinite')
    }, React.createElement("path", {
      d: "M880 126l-3-40h6zM880 126l36 18-3 5zM880 126l-36 18 3 5z"
    }), React.createElement("circle", {
      cx: "880",
      cy: "126",
      r: "4"
    }))), React.createElement("g", {
      fill: "none",
      stroke: "#061020",
      strokeWidth: "3",
      strokeLinecap: "round",
      opacity: ".9"
    }, React.createElement("g", {
      style: fs('transform-origin:60px 200px;animation:grassSway 3.2s ease-in-out infinite')
    }, React.createElement("path", {
      d: "M50 200q2-12 8-20M62 200q0-14 4-24M74 200q-2-12-8-18"
    })), React.createElement("g", {
      style: fs('transform-origin:330px 200px;animation:grassSway 2.8s ease-in-out -1s infinite')
    }, React.createElement("path", {
      d: "M320 200q2-12 8-20M332 200q0-14 4-24M344 200q-2-12-8-18"
    })), React.createElement("g", {
      style: fs('transform-origin:620px 200px;animation:grassSway 3.6s ease-in-out -2s infinite')
    }, React.createElement("path", {
      d: "M610 200q2-12 8-20M622 200q0-14 4-24M634 200q-2-12-8-18"
    })), React.createElement("g", {
      style: fs('transform-origin:1130px 200px;animation:grassSway 3s ease-in-out -.5s infinite')
    }, React.createElement("path", {
      d: "M1120 200q2-12 8-20M1132 200q0-14 4-24M1144 200q-2-12-8-18"
    }))), React.createElement("g", {
      style: sx('opacity:' + (lit ? 1 : 0) + ';transition:opacity 1.2s ease'),
      fill: "#ffd98a"
    }, React.createElement("rect", {
      x: "128",
      y: "180",
      width: "7",
      height: "8"
    }), React.createElement("rect", {
      x: "212",
      y: "150",
      width: "7",
      height: "9"
    }), React.createElement("rect", {
      x: "232",
      y: "150",
      width: "7",
      height: "9",
      style: fs('animation:winFlick 6s linear infinite')
    }), React.createElement("rect", {
      x: "252",
      y: "150",
      width: "7",
      height: "9"
    }), React.createElement("rect", {
      x: "378",
      y: "180",
      width: "7",
      height: "8",
      style: fs('animation:winFlick 9s linear 2s infinite')
    }), React.createElement("rect", {
      x: "443",
      y: "180",
      width: "7",
      height: "8"
    }), React.createElement("rect", {
      x: "480",
      y: "140",
      width: "7",
      height: "9"
    }), React.createElement("rect", {
      x: "520",
      y: "140",
      width: "7",
      height: "9"
    }), React.createElement("rect", {
      x: "546",
      y: "140",
      width: "7",
      height: "9",
      style: fs('animation:winFlick 7s linear 1s infinite')
    }), React.createElement("rect", {
      x: "672",
      y: "180",
      width: "7",
      height: "8"
    }), React.createElement("rect", {
      x: "770",
      y: "152",
      width: "7",
      height: "9"
    }), React.createElement("rect", {
      x: "800",
      y: "152",
      width: "7",
      height: "9",
      style: fs('animation:winFlick 11s linear 4s infinite')
    }), React.createElement("rect", {
      x: "830",
      y: "152",
      width: "7",
      height: "9"
    }), React.createElement("rect", {
      x: "972",
      y: "180",
      width: "7",
      height: "8"
    }))), React.createElement("div", {
      "aria-hidden": "true",
      style: sx('position:absolute;left:23.5%;bottom:22px;width:10px;height:10px;pointer-events:none')
    }, [0, 1.3, 2.6].map(d => React.createElement("span", {
      key: d,
      style: fs('position:absolute;inset:0;border-radius:50%;background:rgba(220,228,240,.55);filter:blur(2px);animation:smoke 4s ease-out ' + d + 's infinite')
    }))), ripples.map(r => React.createElement("span", {
      key: r.id,
      "aria-hidden": "true",
      style: fs('position:absolute;left:' + (r.x - 60) + 'px;top:' + (r.y - 60) + 'px;width:120px;height:120px;border-radius:50%;border:2px solid ' + (night ? 'rgba(255,255,255,.7)' : 'rgba(0,114,163,.6)') + ';pointer-events:none;animation:ripple .9s ease-out forwards')
    })), sparkles.map(s => React.createElement("span", {
      key: s.id,
      "aria-hidden": "true",
      style: fs('position:absolute;left:' + (s.x - s.s / 2) + 'px;top:' + (s.y - s.s / 2) + 'px;width:' + s.s + 'px;height:' + s.s + 'px;background:' + (night ? '#fff' : '#ffd166') + ';clip-path:polygon(50% 0,62% 38%,100% 50%,62% 62%,50% 100%,38% 62%,0 50%,38% 38%);pointer-events:none;animation:sparkle .8s ease-out forwards;filter:drop-shadow(0 0 4px rgba(255,220,140,.8))')
    })), bursts.map(b => React.createElement("span", {
      key: b.id,
      "aria-hidden": "true",
      style: sx('position:absolute;left:' + b.x + 'px;top:' + b.y + 'px;rotate:' + b.a + 'deg;scale:' + b.sc + ';pointer-events:none')
    }, React.createElement("span", {
      style: fs('display:block;width:' + b.w + 'px;height:' + b.w * .6 + 'px;border-radius:2px;background:' + b.c + ';animation:burst .9s cubic-bezier(.1,.7,.3,1) forwards')
    }))), balloonsUp.map(b => React.createElement("div", {
      key: b.id,
      "aria-hidden": "true",
      style: fs('position:absolute;left:' + (b.x - 13) + 'px;top:' + (b.y - 30) + 'px;pointer-events:none;animation:balloonUp 9s cubic-bezier(.3,.6,.4,1) forwards')
    }, React.createElement("svg", {
      viewBox: "0 0 24 40",
      width: "26",
      height: "42",
      style: fs('display:block;animation:sway 2.4s ease-in-out infinite;filter:drop-shadow(0 3px 6px rgba(10,20,40,.3))')
    }, React.createElement("ellipse", {
      cx: "12",
      cy: "13",
      rx: "10",
      ry: "12",
      fill: b.color
    }), React.createElement("ellipse", {
      cx: "8.5",
      cy: "9",
      rx: "3",
      ry: "4.5",
      fill: "#fff",
      opacity: ".35"
    }), React.createElement("path", {
      d: "M10 25l2 3 2-3z",
      fill: b.color
    }), React.createElement("path", {
      d: "M12 28c-3 4 3 6 0 11",
      stroke: "#5a6b84",
      strokeWidth: "1",
      fill: "none"
    })))), React.createElement("div", {
      "aria-hidden": "true",
      style: fs('position:absolute;inset:0;pointer-events:none;background:linear-gradient(100deg,transparent 30%,rgba(255,255,255,.07) 50%,transparent 70%) 0 0/240% 100%;animation:shiftSweep 9s linear infinite')
    }), React.createElement("div", {
      "aria-hidden": "true",
      style: sx(night ? 'position:absolute;inset:0;pointer-events:none;background:linear-gradient(100deg,rgba(6,16,34,.25),rgba(6,16,34,.1) 60%,transparent)' : 'position:absolute;inset:0;pointer-events:none;background:linear-gradient(100deg,rgba(255,255,255,.5),rgba(255,255,255,.22) 55%,rgba(255,255,255,.06))')
    }), React.createElement("div", {
      "aria-hidden": "true",
      style: sx('position:absolute;inset:0;pointer-events:none;transition:background 1.2s ease;background:' + theme.wash)
    }), React.createElement("div", {
      onClick: celebrate,
      title: "Shift progress \xB7 click me",
      style: fs('position:relative;z-index:4;width:74px;height:74px;padding:4px;border-radius:20px;flex-shrink:0;display:grid;place-items:center;background:conic-gradient(#3ddc97 ' + pct.toFixed(1) + '%,' + (night ? 'rgba(255,255,255,.18)' : 'rgba(12,28,52,.14)') + ' 0);' + (on ? 'animation:ringGlow 3s ease-in-out infinite;' : '') + 'transition:background .8s,transform .25s;cursor:pointer')
    }, React.createElement("div", {
      style: sx('width:66px;height:66px;border-radius:16px;background:linear-gradient(135deg,#3ab5a7,#0090ca);color:#fff;display:grid;place-items:center;font-weight:800;font-size:23px;overflow:hidden')
    }, u && u.photo && u.photo.url ? React.createElement("img", {
      src: u.photo.url,
      alt: "",
      style: {
        width: '100%',
        height: '100%',
        objectFit: 'cover'
      }
    }) : initials)), React.createElement("div", {
      style: sx('position:relative;min-width:0;flex:1 1 200px;z-index:4;pointer-events:none')
    }, React.createElement("div", {
      style: fs('font-size:34px;font-weight:800;letter-spacing:-.8px;line-height:1.1;color:' + ink.strong + ';animation:textGlow 4s ease-in-out infinite')
    }, greeting, " ", React.createElement("span", {
      style: sx('font-size:30px;letter-spacing:0')
    }, greetEmoji)), React.createElement("div", {
      style: sx('font-size:16px;font-weight:700;letter-spacing:-.2px;margin-top:6px;color:' + (night ? '#cfe0f0' : '#12385c'))
    }, staffName), React.createElement("div", {
      style: sx('font-size:12.5px;margin-top:2px;color:' + ink.soft)
    }, designation, " \xB7 ", unit)), React.createElement("div", {
      style: fs(shiftCard)
    }, sh ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: sx('display:flex;align-items:center;gap:9px')
    }, React.createElement("span", {
      style: fs('width:9px;height:9px;border-radius:50%;flex-shrink:0;background:' + (on ? '#3ddc97' : sh.accent) + ';' + (on ? 'animation:livepulse 2.4s infinite' : ''))
    }), React.createElement("span", {
      style: sx('font-size:13.5px;font-weight:700;letter-spacing:.2px;color:' + ink.strong)
    }, sh.name, " shift"), React.createElement("span", {
      style: sx(on ? tag('#0b3a2c', 'rgba(61,220,151,.85)') : tag(night ? '#cfe0f0' : '#2b3d55', night ? 'rgba(255,255,255,.14)' : 'rgba(12,28,52,.1)'))
    }, on ? 'On duty' : before ? 'Upcoming' : 'Completed'), React.createElement("span", {
      style: {
        flex: 1
      }
    }), React.createElement("span", {
      style: sx(rangeStyle)
    }, sh.range)), React.createElement("div", {
      style: sx('display:flex;align-items:flex-end;gap:14px;flex-wrap:wrap;margin-top:11px')
    }, React.createElement("div", null, React.createElement("div", {
      style: sx(miniLabel)
    }, on ? 'Time left on shift' : before ? 'Starts in' : 'Next shift in'), React.createElement("div", {
      style: sx("font-family:'IBM Plex Mono',monospace;font-size:27px;font-weight:700;letter-spacing:1px;line-height:1.1;margin-top:2px;color:" + ink.strong)
    }, hms(remain))), React.createElement("div", {
      style: sx('margin-left:auto;text-align:right')
    }, React.createElement("div", {
      style: sx(miniLabel)
    }, "Now"), React.createElement("div", {
      style: fs("font-family:'IBM Plex Mono',monospace;font-size:15px;font-weight:700;letter-spacing:.6px;margin-top:3px;color:" + ink.strong + ';animation:tick 1s ease-in-out infinite alternate')
    }, clock), React.createElement("div", {
      style: sx(rangeStyle)
    }, dateLine))), React.createElement("div", {
      style: sx('position:relative;height:6px;border-radius:4px;overflow:hidden;margin-top:11px;background:' + (night ? 'rgba(255,255,255,.12)' : 'rgba(12,28,52,.16)'))
    }, React.createElement("div", {
      style: sx('height:100%;border-radius:4px;width:' + pct.toFixed(2) + '%;background:linear-gradient(90deg,' + sh.accent + ',' + sh.accent2 + ');transition:width 1s linear')
    }), React.createElement("div", {
      style: fs('position:absolute;top:0;bottom:0;left:0;width:30%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.6),transparent);animation:barShine 2.8s ease-in-out infinite;pointer-events:none')
    })), React.createElement("div", {
      style: sx('font-size:11px;margin-top:8px;color:' + ink.soft)
    }, shiftNote)) : React.createElement(React.Fragment, null, React.createElement("div", {
      style: sx('display:flex;align-items:center;gap:9px')
    }, React.createElement("span", {
      style: sx('width:9px;height:9px;border-radius:50%;flex-shrink:0;background:#9fb0c4')
    }), React.createElement("span", {
      style: sx('font-size:13.5px;font-weight:700;color:' + ink.strong)
    }, "No shift today"), React.createElement("span", {
      style: {
        flex: 1
      }
    }), React.createElement("span", {
      style: sx(rangeStyle)
    }, dateLine)), React.createElement("div", {
      style: fs("font-family:'IBM Plex Mono',monospace;font-size:27px;font-weight:700;letter-spacing:1px;margin-top:10px;color:" + ink.strong + ';animation:tick 1s ease-in-out infinite alternate')
    }, clock), React.createElement("div", {
      style: sx('font-size:11px;margin-top:8px;color:' + ink.soft)
    }, shiftNote))), React.createElement("div", {
      style: sx('position:relative;display:flex;flex-wrap:wrap;gap:10px;flex:1 1 100%')
    }, idFacts.map((f, i) => React.createElement("div", {
      key: f.label,
      style: fs(factChip(i))
    }, React.createElement("div", {
      style: sx('font-size:9.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:' + ink.muted)
    }, f.label), React.createElement("div", {
      style: sx("font-size:13.5px;font-weight:700;margin-top:3px;font-family:'IBM Plex Mono',monospace;color:" + ink.strong)
    }, f.value)))), React.createElement("div", {
      "aria-hidden": "true",
      style: sx('position:absolute;right:16px;bottom:9px;font-size:9.5px;letter-spacing:.6px;text-transform:uppercase;font-weight:600;color:' + (night ? 'rgba(199,210,224,.55)' : 'rgba(12,28,52,.45)') + ';pointer-events:none')
    }, "Click the sky \xB7 the sun changes the weather")), React.createElement("div", {
      style: Object.assign(sx(GLASS), {
        padding: '14px 16px'
      })
    }, React.createElement("div", {
      style: sx('display:flex;align-items:center;gap:8px')
    }, React.createElement("div", {
      style: sx('font-size:10.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#7d8ea8')
    }, "How are you feeling?"), React.createElement("span", {
      style: {
        flex: 1
      }
    }), React.createElement("span", {
      style: sx("font-size:10.5px;color:#9aa6b4;font-family:'IBM Plex Mono',monospace")
    }, mood ? 'Logged ' + to12(pad(new Date(moodAt).getHours()) + ':' + pad(new Date(moodAt).getMinutes())) + ' · this device only' : 'Private to you')), React.createElement("div", {
      style: sx('display:flex;gap:8px;margin-top:10px;flex-wrap:wrap')
    }, MOOD_DEFS.map(m => React.createElement("button", {
      key: m.label,
      type: "button",
      onClick: () => pickMood(m.label),
      title: m.label,
      style: fs('flex:1;min-width:88px;display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 4px;border-radius:12px;cursor:pointer;font-family:inherit;transition:transform .25s cubic-bezier(.2,.7,.3,1),border-color .25s;border:1px solid ' + (mood === m.label ? m.c : 'rgba(125,145,180,.22)') + ';background:' + (mood === m.label ? '#fff' : 'rgba(255,255,255,.55)') + ';color:' + (mood === m.label ? m.c : '#7d8ea8') + ';' + (mood === m.label ? 'animation:checkPop .4s cubic-bezier(.2,.7,.3,1);box-shadow:0 10px 22px rgba(31,59,90,.14)' : ''))
    }, React.createElement("svg", {
      width: "26",
      height: "26",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "1.8",
      strokeLinecap: "round"
    }, React.createElement("circle", {
      cx: "12",
      cy: "12",
      r: "9.5"
    }), React.createElement("path", {
      d: m.mouth
    }), React.createElement("path", {
      d: "M8.5 9.5h.01M15.5 9.5h.01",
      strokeWidth: "2.4"
    })), React.createElement("span", {
      style: sx('font-size:9.5px;font-weight:700;letter-spacing:.3px')
    }, m.label))))), React.createElement("div", {
      style: sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:16px;align-items:start')
    }, React.createElement("div", {
      style: sx('display:flex;flex-direction:column;gap:16px;min-width:0')
    }, React.createElement(Soon, {
      live: LIVE.thisWeek,
      label: "Unlocks when the Duty Roster module is rolled out to your ward."
    }, React.createElement("div", {
      style: sx(GLASS)
    }, cardH('This week', React.createElement("span", {
      style: sx('font-size:11px;color:#9aa6b4')
    }, "Click a day")), React.createElement("div", {
      style: sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(58px,1fr));gap:8px')
    }, week.map((w, i) => {
      const isSel = i === sel;
      return React.createElement("button", {
        key: i,
        type: "button",
        onClick: () => setSelDay(i),
        style: sx('display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 4px;border-radius:12px;cursor:pointer;font-family:inherit;transition:transform .25s cubic-bezier(.2,.7,.3,1),box-shadow .25s;border:1px solid ' + (isSel ? 'rgba(0,144,202,.5)' : w.today ? 'rgba(58,181,167,.5)' : 'rgba(125,145,180,.22)') + ';background:' + (isSel ? 'linear-gradient(135deg,#27a8db,#0072a3)' : 'rgba(255,255,255,.62)') + ';color:' + (isSel ? '#fff' : w.off ? '#9aa6b4' : '#16202e') + ';box-shadow:' + (isSel ? '0 10px 24px rgba(0,144,202,.35)' : 'none'))
      }, React.createElement("span", {
        style: sx('font-size:9.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase;opacity:.75')
      }, w.dow), React.createElement("span", {
        style: sx("font-size:19px;font-weight:800;font-family:'IBM Plex Mono',monospace;line-height:1.1")
      }, w.date), React.createElement("span", {
        style: sx('font-size:9px;font-weight:700;letter-spacing:.4px;padding:2px 7px;border-radius:10px;background:' + (isSel ? 'rgba(255,255,255,.22)' : w.off ? 'rgba(125,145,180,.14)' : 'rgba(0,144,202,.12)') + ';color:' + (isSel ? '#fff' : w.off ? '#8894a6' : '#0072a3'))
      }, w.code || (w.off ? 'Off' : '—')));
    })), React.createElement("div", {
      key: sel,
      style: fs('display:flex;align-items:center;gap:12px;margin-top:12px;padding:11px 13px;border-radius:12px;border:1px solid rgba(125,145,180,.22);background:rgba(255,255,255,.62);animation:fadeSwap .3s ease')
    }, React.createElement("span", {
      style: sx('width:10px;height:10px;border-radius:50%;flex-shrink:0;background:' + (sd && sd.off ? '#b6c0cc' : '#27a8db'))
    }), React.createElement("div", {
      style: sx('flex:1;min-width:0')
    }, React.createElement("div", {
      style: sx('font-size:13px;font-weight:700;color:#16202e')
    }, sd ? sd.full.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: '2-digit',
      month: 'short'
    }) + (sd.code ? sd.off ? ' · Off' : ' · ' + sd.code : ' · Nothing rostered') : ''), React.createElement("div", {
      style: sx('font-size:11.5px;color:#6c7a8c;margin-top:1px')
    }, sd && sd.info && sd.info.label ? sd.info.label + ' · ' + unit : sd && sd.off && sd.code ? 'No duty scheduled. Enjoy your rest day.' : 'Not on the published roster for this day.')), React.createElement("button", {
      type: "button",
      title: "Opens the Duty Roster module",
      onClick: () => setRoute && setRoute({
        view: 'rosterHome'
      }),
      style: sx('font-family:inherit;font-size:11.5px;font-weight:700;padding:7px 12px;border-radius:9px;cursor:pointer;border:1px solid rgba(0,144,202,.35);background:rgba(255,255,255,.7);color:#0072a3;white-space:nowrap')
    }, "Request swap")))), React.createElement(Soon, {
      live: LIVE.dutyToday,
      label: "Unlocks with the Duty Roster rollout."
    }, React.createElement("div", {
      style: sx(GLASS)
    }, cardH('My duty today', React.createElement("span", {
      style: sx("font-size:11px;color:#9aa6b4;font-family:'IBM Plex Mono',monospace")
    }, dateLine)), React.createElement("div", {
      style: sx('display:flex;flex-wrap:wrap;gap:12px')
    }, duty.map(d => React.createElement("div", {
      key: d.label,
      style: sx('flex:1 1 130px;min-width:130px;padding:12px 13px;border-radius:13px;border:1px solid rgba(125,145,180,.22);background:rgba(255,255,255,.62)')
    }, React.createElement("div", {
      style: sx('font-size:10.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#7d8ea8')
    }, d.label), React.createElement("div", {
      style: sx('font-size:16px;font-weight:800;color:#16202e;margin-top:5px;letter-spacing:-.2px')
    }, d.value), React.createElement("div", {
      style: sx('font-size:11.5px;color:#6c7a8c;margin-top:2px')
    }, d.note))))))), React.createElement("div", {
      style: sx('display:flex;flex-direction:column;gap:16px;min-width:0')
    }, React.createElement(Soon, {
      live: LIVE.announcements,
      label: "Unlocks when Nursing Services notices go live."
    }, React.createElement("div", {
      style: sx('position:relative;overflow:hidden;border-radius:16px;border:1px solid rgba(122,196,232,.25);background:linear-gradient(135deg,rgba(0,114,163,.96),rgba(58,181,167,.92));color:#fff;box-shadow:0 14px 38px rgba(0,114,163,.3);padding:16px 17px;min-height:118px')
    }, React.createElement("div", {
      "aria-hidden": "true",
      style: fs('position:absolute;right:-40px;top:-50px;width:170px;height:170px;border-radius:50%;background:rgba(255,255,255,.12);animation:orbFloat 12s ease-in-out infinite alternate')
    }), React.createElement("div", {
      style: sx('display:flex;align-items:center;gap:8px;position:relative')
    }, React.createElement("span", {
      style: sx('font-size:10.5px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:rgba(255,255,255,.8)')
    }, "Announcements"), React.createElement("span", {
      style: {
        flex: 1
      }
    }), React.createElement("div", {
      style: sx('display:flex;gap:5px')
    }, anns.map((_, i) => React.createElement("button", {
      key: i,
      type: "button",
      onClick: () => setAnnPinned(i),
      style: sx('width:' + (i === ai ? 18 : 7) + 'px;height:7px;border-radius:4px;border:none;padding:0;cursor:pointer;background:rgba(255,255,255,' + (i === ai ? .95 : .45) + ');transition:width .3s,background .3s')
    })))), React.createElement("div", {
      key: ai,
      style: fs('position:relative;margin-top:10px;animation:fadeSwap .35s ease')
    }, React.createElement("div", {
      style: sx('font-size:15px;font-weight:800;letter-spacing:-.2px')
    }, anns[ai].title), React.createElement("div", {
      style: sx('font-size:12px;color:rgba(255,255,255,.85);margin-top:4px;line-height:1.5')
    }, anns[ai].body)))), React.createElement(Soon, {
      live: LIVE.team,
      label: "Unlocks with the Duty Roster rollout."
    }, React.createElement("div", {
      style: sx(GLASS)
    }, cardH('Team on my shift', React.createElement("span", {
      style: sx('font-size:11px;color:#9aa6b4')
    }, team.length ? team.length + ' on this shift' : '')), team.length === 0 ? React.createElement("div", {
      style: sx('font-size:12.5px;color:#6c7a8c;line-height:1.6')
    }, todayCode ? 'Nobody else on the published roster carries ' + todayCode + ' today.' : 'This fills in once you are on a published roster for today.') : React.createElement(React.Fragment, null, React.createElement("div", {
      style: sx('display:flex;align-items:center;gap:0')
    }, team.map((p, i) => React.createElement("div", {
      key: i,
      onClick: () => setTeamSel(i),
      title: p.name,
      style: sx('position:relative;width:40px;height:40px;border-radius:12px;margin-left:' + (i ? -8 : 0) + 'px;display:grid;place-items:center;font-size:12px;font-weight:700;color:#fff;cursor:pointer;background:' + p.c + ';border:2.5px solid ' + (teamSel === i ? '#16202e' : '#fff') + ';box-shadow:0 6px 16px rgba(31,59,90,.18);transition:transform .25s cubic-bezier(.2,.7,.3,1),border-color .25s;z-index:' + (teamSel === i ? 4 : 1))
    }, initialsOf(p.name), React.createElement("span", {
      style: sx('position:absolute;right:-2px;bottom:-2px;width:10px;height:10px;border-radius:50%;border:2px solid #fff;background:#3ddc97')
    })))), tp && React.createElement("div", {
      key: teamSel,
      style: fs('display:flex;align-items:center;gap:11px;margin-top:12px;padding:10px 12px;border-radius:11px;border:1px solid rgba(125,145,180,.22);background:rgba(255,255,255,.62);animation:fadeSwap .3s ease')
    }, React.createElement("div", {
      style: sx('width:36px;height:36px;border-radius:10px;display:grid;place-items:center;font-size:12px;font-weight:700;color:#fff;background:' + tp.c + ';flex-shrink:0')
    }, initialsOf(tp.name)), React.createElement("div", {
      style: sx('flex:1;min-width:0')
    }, React.createElement("div", {
      style: sx('font-size:12.5px;font-weight:700;color:#16202e')
    }, tp.name), React.createElement("div", {
      style: sx('font-size:11px;color:#6c7a8c')
    }, tp.role)), React.createElement("span", {
      style: sx(tag('#0f7a5f', 'rgba(61,220,151,.2)'))
    }, "On duty"))))), React.createElement("div", {
      style: sx(GLASS)
    }, cardH('Birthdays', React.createElement("span", {
      style: sx('font-size:11px;color:#9aa6b4')
    }, bdays.length ? 'next 30 days' : '')), bdays.length === 0 ? React.createElement("div", {
      style: sx('font-size:12.5px;color:#6c7a8c;line-height:1.6')
    }, "No birthdays in the next 30 days. (Dates come from each staff profile\u2019s Date of Birth.)") : React.createElement("div", {
      style: sx('display:flex;flex-direction:column;gap:6px')
    }, bdays.slice(0, 6).map(({
      e,
      bday,
      turns,
      inDays
    }) => React.createElement("div", {
      key: e.id,
      onClick: () => setRoute && setRoute({
        view: 'staffProfile',
        emp: e.id
      }),
      style: sx('display:flex;align-items:center;gap:11px;padding:8px 10px;border-radius:11px;cursor:pointer;border:1px solid ' + (inDays === 0 ? 'rgba(214,82,155,.35)' : 'rgba(125,145,180,.22)') + ';background:' + (inDays === 0 ? 'rgba(253,238,246,.9)' : 'rgba(255,255,255,.62)'))
    }, React.createElement("div", {
      style: sx('width:34px;height:34px;border-radius:10px;display:grid;place-items:center;font-size:11.5px;font-weight:700;color:#fff;flex-shrink:0;background:' + (inDays === 0 ? '#d4529b' : '#7d91b4'))
    }, inDays === 0 ? '🎂' : initialsOf(e.name)), React.createElement("div", {
      style: sx('flex:1;min-width:0')
    }, React.createElement("div", {
      style: sx('font-size:12.5px;font-weight:700;color:#16202e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')
    }, e.name), React.createElement("div", {
      style: sx('font-size:11px;color:#6c7a8c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')
    }, e.current_department || '—', turns ? ' · turns ' + turns : '')), React.createElement("span", {
      style: sx('font-size:11px;font-weight:700;flex-shrink:0;color:' + (inDays === 0 ? '#b02a72' : '#6c7a8c'))
    }, inDays === 0 ? 'Today' : inDays === 1 ? 'Tomorrow' : bday.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric'
    })))))), React.createElement(Soon, {
      live: LIVE.offDays,
      label: "Unlocks with the Duty Roster rollout."
    }, React.createElement("div", {
      style: sx(GLASS)
    }, React.createElement("div", {
      style: sx('display:flex;align-items:center;gap:14px')
    }, React.createElement("div", {
      style: sx('width:70px;height:70px;border-radius:50%;padding:5px;flex-shrink:0;display:grid;place-items:center;background:conic-gradient(#27a8db ' + (offStats && offStats.total ? (offStats.left / offStats.total * 100).toFixed(1) : 0) + '%,rgba(125,145,180,.18) 0);transition:background .6s')
    }, React.createElement("div", {
      style: sx('width:60px;height:60px;border-radius:50%;background:#fff;display:grid;place-items:center;text-align:center;line-height:1')
    }, React.createElement("div", null, React.createElement("div", {
      style: sx("font-size:18px;font-weight:800;font-family:'IBM Plex Mono',monospace;color:#16202e")
    }, offStats ? offStats.left : '—'), React.createElement("div", {
      style: sx('font-size:8.5px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#7d8ea8;margin-top:2px')
    }, "days")))), React.createElement("div", {
      style: sx('flex:1;min-width:0')
    }, React.createElement("div", {
      style: sx('font-size:14.5px;font-weight:700;color:#16202e')
    }, "Off days this month"), React.createElement("div", {
      style: sx('font-size:11.5px;color:#6c7a8c;margin-top:3px')
    }, offStats ? offStats.taken + ' taken of ' + offStats.total + ' on the published roster' : 'Counts your O-coded days once a roster is published.'), React.createElement("div", {
      style: sx('font-size:10.5px;color:#9aa6b4;margin-top:6px')
    }, "Leave requests still go through your in-charge \u2014 this counts the roster only."))))), React.createElement(Soon, {
      live: LIVE.records,
      label: "Unlocks when the certification register is filled in."
    }, React.createElement("div", {
      style: sx(GLASS)
    }, cardH('My records', React.createElement("span", {
      style: sx('font-size:11px;color:#9aa6b4')
    }, "Click to expand")), React.createElement("div", {
      style: sx('display:flex;flex-direction:column;gap:8px')
    }, certs === null ? React.createElement("div", {
      style: sx('font-size:12.5px;color:#6c7a8c')
    }, "Loading your records\u2026") : records.length === 0 ? React.createElement("div", {
      style: sx('font-size:12.5px;color:#6c7a8c;line-height:1.6')
    }, "No certifications or vaccination status recorded against your staff record yet.") : records.map((r, i) => {
      const open = openRec === i;
      return React.createElement("div", {
        key: i,
        onClick: () => setOpenRec(open ? null : i),
        style: sx('padding:9px 11px;border-radius:11px;cursor:pointer;border:1px solid ' + (open ? 'rgba(0,144,202,.35)' : 'rgba(125,145,180,.2)') + ';background:' + (open ? '#fff' : 'rgba(255,255,255,.6)') + ';transition:transform .25s cubic-bezier(.2,.7,.3,1),box-shadow .25s,border-color .25s')
      }, React.createElement("div", {
        style: sx('display:flex;align-items:center;gap:10px')
      }, React.createElement("span", {
        style: sx('width:9px;height:9px;border-radius:50%;background:' + r.dotC + ';flex-shrink:0')
      }), React.createElement("div", {
        style: sx('min-width:0;flex:1')
      }, React.createElement("div", {
        style: sx('font-size:12.5px;font-weight:600;color:#16202e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')
      }, r.label), React.createElement("div", {
        style: sx('font-size:11px;color:#9aa6b4')
      }, r.meta)), React.createElement("span", {
        style: sx(r.tagStyle)
      }, r.tag), React.createElement("svg", {
        width: "14",
        height: "14",
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "#9aa6b4",
        strokeWidth: "2.2",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        style: sx('flex-shrink:0;transition:transform .3s;transform:rotate(' + (open ? 180 : 0) + 'deg)')
      }, React.createElement("path", {
        d: "M6 9l6 6 6-6"
      }))), open && React.createElement("div", {
        style: fs('margin-top:9px;padding-top:9px;border-top:1px dashed rgba(125,145,180,.3);font-size:11.5px;color:#3c4e66;line-height:1.55;animation:slideDown .25s ease')
      }, r.detail));
    })), React.createElement("div", {
      style: sx('margin-top:12px;font-size:11px;color:#9aa6b4;line-height:1.5;border-top:1px solid rgba(125,145,180,.2);padding-top:10px')
    }, "Records are maintained by Nursing Services. Contact your supervisor to correct any detail."))))));
  }
  window.HomeView = HomeView;
})();
})();
;
/* ===== feedback.jsx ===== */
(function(){
(function () {
  const {
    useState,
    useEffect,
    useRef,
    useCallback
  } = React;
  const PATH_INFO = 'M12 2a10 10 0 100 20 10 10 0 000-20M12 11v5M12 7.5v.01';
  const PATH_WARN = 'M12 3l9.5 16.5H2.5zM12 10v4M12 17.5v.01';
  const TYPES = {
    success: {
      fg: 'var(--green)',
      bg: '#e7f6ed',
      bd: '#bfe6cf',
      d: window.I && window.I.check || 'M4 12l5 5L20 6'
    },
    error: {
      fg: 'var(--rose)',
      bg: 'var(--neg-bg)',
      bd: '#f1c6cd',
      d: window.I && window.I.x || 'M6 6l12 12M18 6L6 18'
    },
    info: {
      fg: 'var(--blue)',
      bg: 'var(--blue-50)',
      bd: 'var(--blue-100)',
      d: PATH_INFO
    },
    warn: {
      fg: 'var(--amber)',
      bg: '#fbf0dd',
      bd: '#f0d8a8',
      d: PATH_WARN
    }
  };
  const DEFAULT_DURATION = 3200;
  function Icon({
    d,
    s = 18,
    c = 'currentColor',
    sw = 2
  }) {
    if (typeof window.Ic === 'function') return React.createElement(window.Ic, {
      d,
      s,
      c,
      sw
    });
    return React.createElement("svg", {
      width: s,
      height: s,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: c,
      strokeWidth: sw,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      className: "ico"
    }, d.split('M').filter(Boolean).map((seg, i) => React.createElement("path", {
      key: i,
      d: 'M' + seg
    })));
  }
  let toastSeq = 0;
  const toastListeners = new Set();
  let toastState = [];
  function emitToasts() {
    toastListeners.forEach(fn => {
      try {
        fn(toastState);
      } catch (e) {}
    });
  }
  function addToast(message, type, opts) {
    opts = opts || {};
    const t = type && TYPES[type] ? type : 'success';
    const id = ++toastSeq;
    const duration = typeof opts.duration === 'number' ? opts.duration : DEFAULT_DURATION;
    toastState = toastState.concat([{
      id,
      message: String(message == null ? '' : message),
      type: t,
      duration
    }]);
    emitToasts();
    return id;
  }
  function removeToast(id) {
    const before = toastState.length;
    toastState = toastState.filter(x => x.id !== id);
    if (toastState.length !== before) emitToasts();
  }
  function ToastItem({
    t,
    onClose
  }) {
    const cfg = TYPES[t.type] || TYPES.success;
    const [leaving, setLeaving] = useState(false);
    const timerRef = useRef(null);
    const dismiss = useCallback(() => {
      if (leaving) return;
      setLeaving(true);
      window.setTimeout(() => onClose(t.id), 200);
    }, [leaving, onClose, t.id]);
    useEffect(() => {
      if (t.duration > 0) {
        timerRef.current = window.setTimeout(dismiss, t.duration);
        return () => window.clearTimeout(timerRef.current);
      }
    }, [t.duration, dismiss]);
    return React.createElement("div", {
      className: 'uni-toast' + (leaving ? ' leaving' : ''),
      role: "status",
      style: {
        '--tfg': cfg.fg,
        '--tbg': cfg.bg,
        '--tbd': cfg.bd
      },
      onClick: dismiss,
      title: "Dismiss"
    }, React.createElement("span", {
      className: "uni-toast-ic"
    }, React.createElement(Icon, {
      d: cfg.d,
      s: 16,
      c: cfg.fg,
      sw: 2.4
    })), React.createElement("span", {
      className: "uni-toast-msg"
    }, t.message), React.createElement("span", {
      className: "uni-toast-x"
    }, React.createElement(Icon, {
      d: window.I && window.I.x || 'M6 6l12 12M18 6L6 18',
      s: 13,
      c: "var(--faint)",
      sw: 2.2
    })));
  }
  function ToastHost() {
    const [items, setItems] = useState(toastState);
    useEffect(() => {
      const fn = next => setItems(next);
      toastListeners.add(fn);
      fn(toastState);
      return () => {
        toastListeners.delete(fn);
      };
    }, []);
    return React.createElement("div", {
      className: "uni-toast-stack"
    }, items.map(t => React.createElement(ToastItem, {
      key: t.id,
      t: t,
      onClose: removeToast
    })));
  }
  let confirmSeq = 0;
  const confirmListeners = new Set();
  let confirmQueue = [];
  function emitConfirms() {
    confirmListeners.forEach(fn => {
      try {
        fn(confirmQueue);
      } catch (e) {}
    });
  }
  function pushConfirm(opts) {
    return new Promise(resolve => {
      const id = ++confirmSeq;
      confirmQueue = confirmQueue.concat([{
        id,
        opts: opts || {},
        resolve
      }]);
      emitConfirms();
    });
  }
  function settleConfirm(id, value) {
    const entry = confirmQueue.find(c => c.id === id);
    confirmQueue = confirmQueue.filter(c => c.id !== id);
    emitConfirms();
    if (entry) {
      try {
        entry.resolve(value);
      } catch (e) {}
    }
  }
  function ConfirmDialog({
    entry
  }) {
    const o = entry.opts || {};
    const danger = !!o.danger;
    const confirmLabel = o.confirmLabel || 'Confirm';
    const cancelLabel = o.cancelLabel || 'Cancel';
    const title = o.title || 'Are you sure?';
    const message = o.message || '';
    const btnRef = useRef(null);
    const cancel = useCallback(() => settleConfirm(entry.id, false), [entry.id]);
    const ok = useCallback(() => settleConfirm(entry.id, true), [entry.id]);
    useEffect(() => {
      const onKey = e => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          cancel();
        } else if (e.key === 'Enter') {
          e.stopPropagation();
          ok();
        }
      };
      window.addEventListener('keydown', onKey, true);
      if (btnRef.current) {
        try {
          btnRef.current.focus();
        } catch (e) {}
      }
      return () => window.removeEventListener('keydown', onKey, true);
    }, [cancel, ok]);
    const icPath = danger ? window.I && window.I.x || 'M6 6l12 12M18 6L6 18' : window.I && window.I.bell || PATH_INFO;
    const toBody = n => typeof window !== 'undefined' && window.ReactDOM && window.ReactDOM.createPortal && typeof document !== 'undefined' ? window.ReactDOM.createPortal(n, document.body) : n;
    return toBody(React.createElement("div", {
      className: "modal-bg",
      onMouseDown: e => {
        if (e.target === e.currentTarget) cancel();
      }
    }, React.createElement("div", {
      className: "modal",
      style: {
        width: 'min(420px,92vw)'
      }
    }, React.createElement("div", {
      style: {
        padding: '22px 22px 18px'
      }
    }, React.createElement("div", {
      style: {
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start'
      }
    }, React.createElement("div", {
      style: {
        width: 38,
        height: 38,
        borderRadius: 10,
        flexShrink: 0,
        display: 'grid',
        placeItems: 'center',
        background: danger ? 'var(--neg-bg)' : 'var(--blue-50)',
        color: danger ? 'var(--rose)' : 'var(--blue)'
      }
    }, React.createElement(Icon, {
      d: icPath,
      s: 20,
      sw: 2.4,
      c: danger ? 'var(--rose)' : 'var(--blue)'
    })), React.createElement("div", {
      style: {
        minWidth: 0
      }
    }, React.createElement("div", {
      style: {
        fontSize: 15.5,
        fontWeight: 700,
        color: 'var(--ink)'
      }
    }, title), message ? React.createElement("div", {
      style: {
        fontSize: 13,
        color: 'var(--muted)',
        marginTop: 4,
        lineHeight: 1.5
      }
    }, message) : null)), React.createElement("div", {
      style: {
        display: 'flex',
        gap: 10,
        marginTop: 20
      }
    }, React.createElement("span", {
      className: "spacer",
      style: {
        flex: 1
      }
    }), React.createElement("button", {
      className: "btn",
      onClick: cancel
    }, cancelLabel), React.createElement("button", {
      ref: btnRef,
      className: "btn pri",
      style: danger ? {
        background: 'var(--rose)',
        borderColor: 'var(--rose)',
        boxShadow: 'none'
      } : undefined,
      onClick: ok
    }, confirmLabel))))));
  }
  function ConfirmHost() {
    const [queue, setQueue] = useState(confirmQueue);
    useEffect(() => {
      const fn = next => setQueue(next);
      confirmListeners.add(fn);
      fn(confirmQueue);
      return () => {
        confirmListeners.delete(fn);
      };
    }, []);
    if (!queue.length) return null;
    const entry = queue[queue.length - 1];
    return React.createElement(ConfirmDialog, {
      key: entry.id,
      entry: entry
    });
  }
  function mount() {
    if (!document.body) {
      window.addEventListener('DOMContentLoaded', mount, {
        once: true
      });
      return;
    }
    if (window.__uniFeedbackMounted) return;
    window.__uniFeedbackMounted = true;
    const toastEl = document.createElement('div');
    toastEl.id = 'uni-toast-root';
    document.body.appendChild(toastEl);
    ReactDOM.createRoot(toastEl).render(React.createElement(ToastHost, null));
    const confirmEl = document.createElement('div');
    confirmEl.id = 'uni-confirm-root';
    document.body.appendChild(confirmEl);
    ReactDOM.createRoot(confirmEl).render(React.createElement(ConfirmHost, null));
  }
  mount();
  const api = {
    toast: function (message, type, opts) {
      return addToast(message, type, opts);
    },
    confirm: function (opts) {
      return pushConfirm(opts);
    },
    dismiss: function (id) {
      removeToast(id);
    }
  };
  window.UI = Object.assign({}, window.UI, api);
  window.toast = window.UI.toast;
})();
})();
;
/* ===== dashboard.jsx ===== */
(function(){
function KpiCard({
  label,
  value,
  delta,
  foot,
  icon,
  tone = '#0b66d0',
  spark,
  sparkColor
}) {
  return React.createElement("div", {
    className: "card kpi anim-pop"
  }, React.createElement("div", {
    className: "top"
  }, React.createElement("div", {
    className: "ic",
    style: {
      background: tone + '1a',
      color: tone
    }
  }, React.createElement(Ic, {
    d: icon,
    s: 20
  })), React.createElement("div", {
    style: {
      flex: 1
    }
  }, React.createElement("div", {
    className: "lbl"
  }, label)), spark && React.createElement(Spark, {
    values: spark,
    color: sparkColor || tone,
    w: 84,
    h: 30
  })), React.createElement("div", {
    className: "val"
  }, value), React.createElement("div", {
    className: "row2"
  }, delta != null && React.createElement(Delta, {
    v: delta
  }), React.createElement("span", {
    className: "foot"
  }, foot)));
}
function DeptMiniCard({
  d,
  onOpen
}) {
  const vals = d.series.map(r => r[d.primary] || 0);
  const tone = PALETTE[(d.id.charCodeAt(0) + d.id.length) % PALETTE.length];
  return React.createElement("div", {
    className: "card anim-pop",
    style: {
      padding: 14,
      cursor: 'pointer',
      display: 'flex',
      flexDirection: 'column',
      gap: 9
    },
    onClick: onOpen,
    onMouseEnter: e => e.currentTarget.style.boxShadow = 'var(--shadow-md)',
    onMouseLeave: e => e.currentTarget.style.boxShadow = 'var(--shadow)'
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9
    }
  }, React.createElement("div", {
    style: {
      width: 30,
      height: 30,
      borderRadius: 8,
      background: tone + '18',
      color: tone,
      display: 'grid',
      placeItems: 'center'
    }
  }, React.createElement(Ic, {
    d: DEPT_ICON[d.id] || I.activity,
    s: 16
  })), React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: 'var(--ink)',
      whiteSpace: 'nowrap'
    }
  }, d.short), React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: 'var(--muted)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      maxWidth: 118
    }
  }, d.name)), React.createElement("div", {
    className: "spacer"
  }), React.createElement(Delta, {
    v: d.delta
  })), React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'space-between'
    }
  }, React.createElement("div", null, React.createElement("div", {
    className: "num",
    style: {
      fontSize: 23,
      fontWeight: 600,
      color: 'var(--ink)',
      lineHeight: 1
    }
  }, d.series.length ? fmt(d.latest[d.primary] || 0) : '—'), React.createElement("div", {
    style: {
      fontSize: 10,
      color: 'var(--faint)',
      textTransform: 'uppercase',
      letterSpacing: .3,
      marginTop: 3
    }
  }, d.primaryLabel, " \xB7 ", d.latest.month || 'no report in period')), vals.length ? React.createElement(Spark, {
    values: vals,
    color: tone,
    w: 96,
    h: 36
  }) : null));
}
function ReportingCompliance({
  depts,
  onFill
}) {
  const MO = window.UNICO.MONTH_ORDER,
    MF = window.UNICO.MONTHS_FULL;
  const allM = [...new Set(depts.flatMap(d => d.months))].sort((a, b) => MO.indexOf(a) - MO.indexOf(b));
  const yearOf = m => String(m || '').split('-')[1] || '';
  const yLabel = y => y && y.length === 2 ? '20' + y : y || '';
  const years = [...new Set(allM.map(yearOf))].filter(Boolean).sort();
  const [year, setYear] = React.useState(() => years[years.length - 1] || '');
  const curYear = years.indexOf(year) >= 0 ? year : years[years.length - 1] || '';
  const monthsOfYear = allM.filter(m => yearOf(m) === curYear);
  const recent = monthsOfYear.length ? monthsOfYear : allM.slice(-5);
  let reported = 0,
    missing = 0;
  const rows = depts.map(d => {
    const first = d.months[0];
    const cells = recent.map(m => {
      if (!first || MO.indexOf(m) < MO.indexOf(first)) return {
        m,
        st: 'na'
      };
      if (d.months.includes(m)) {
        reported++;
        return {
          m,
          st: 'ok'
        };
      }
      missing++;
      return {
        m,
        st: 'miss'
      };
    });
    return {
      d,
      cells,
      miss: cells.filter(c => c.st === 'miss').length
    };
  }).sort((a, b) => b.miss - a.miss);
  const pct = reported + missing ? Math.round(reported * 100 / (reported + missing)) : 100;
  const pending = rows.filter(r => r.miss > 0);
  return React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, "Reporting Compliance"), React.createElement("span", {
    className: "sub"
  }, curYear ? yLabel(curYear) : 'running months', " \xB7 missing department stats"), React.createElement("span", {
    className: "spacer"
  }), years.length > 1 && React.createElement("div", {
    className: "seg",
    style: {
      marginRight: 8
    },
    title: "Switch reporting year"
  }, years.map(y => React.createElement("button", {
    key: y,
    className: curYear === y ? 'on' : '',
    onClick: () => setYear(y)
  }, yLabel(y)))), React.createElement("span", {
    className: "chip ",
    style: {
      background: pct >= 90 ? 'var(--pos-bg)' : pct >= 70 ? '#fdf3e3' : 'var(--neg-bg)',
      color: pct >= 90 ? 'var(--pos)' : pct >= 70 ? 'var(--amber)' : 'var(--neg)'
    }
  }, pct, "% complete"), React.createElement("span", {
    className: "tag num",
    style: {
      marginLeft: 8
    }
  }, missing, " pending")), React.createElement("div", {
    style: {
      overflowX: 'auto'
    }
  }, React.createElement("table", {
    className: "tbl"
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", {
    style: {
      textAlign: 'left'
    }
  }, "Department"), recent.map(m => React.createElement("th", {
    key: m,
    style: {
      textAlign: 'center'
    }
  }, m)), React.createElement("th", {
    style: {
      textAlign: 'center'
    }
  }, "Gaps"))), React.createElement("tbody", null, rows.map(({
    d,
    cells,
    miss
  }) => React.createElement("tr", {
    key: d.id
  }, React.createElement("td", {
    style: {
      textAlign: 'left',
      cursor: 'pointer'
    },
    onClick: () => onFill && onFill(d.id)
  }, React.createElement("b", {
    style: {
      color: 'var(--ink)'
    }
  }, d.short), " ", React.createElement("span", {
    style: {
      color: 'var(--faint)',
      fontWeight: 400,
      fontFamily: "'IBM Plex Sans'"
    }
  }, d.name)), cells.map((c, i) => React.createElement("td", {
    key: i,
    style: {
      textAlign: 'center'
    }
  }, c.st === 'ok' && React.createElement("span", {
    style: {
      color: 'var(--pos)',
      fontWeight: 700
    }
  }, "\u2713"), c.st === 'na' && React.createElement("span", {
    style: {
      color: '#cbd3dd'
    }
  }, "\u2013"), c.st === 'miss' && React.createElement("span", {
    title: `Fill ${d.short} · ${c.m}`,
    onClick: () => onFill && onFill(d.id),
    style: {
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 22,
      height: 22,
      borderRadius: 6,
      background: 'var(--neg-bg)',
      color: 'var(--neg)',
      fontWeight: 700,
      fontSize: 11
    }
  }, "!"))), React.createElement("td", {
    style: {
      textAlign: 'center'
    }
  }, miss > 0 ? React.createElement("span", {
    className: "chip neg"
  }, miss) : React.createElement("span", {
    className: "chip pos"
  }, "0"))))))), pending.length > 0 && React.createElement("div", {
    style: {
      padding: '12px 16px',
      borderTop: '1px solid var(--line-2)',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      flexWrap: 'wrap'
    }
  }, React.createElement("span", {
    style: {
      fontSize: 12,
      color: 'var(--muted)'
    }
  }, "Fill missing months:"), pending.slice(0, 8).map(({
    d,
    miss
  }) => React.createElement("button", {
    key: d.id,
    className: "btn sm",
    onClick: () => onFill && onFill(d.id)
  }, React.createElement(Ic, {
    d: I.input,
    s: 13
  }), d.short, " ", React.createElement("span", {
    style: {
      color: 'var(--rose)',
      marginLeft: 2
    }
  }, "(", miss, ")")))));
}
function deptForPeriod(d, monthSet) {
  const idxs = [];
  for (let i = 0; i < d.months.length; i++) if (monthSet.has(d.months[i])) idxs.push(i);
  if (!idxs.length) return {
    ...d,
    months: [],
    data: [],
    series: [],
    total: 0,
    latest: {},
    prev: null,
    delta: 0,
    peak: 0,
    avg: 0
  };
  const months = idxs.map(i => d.months[i]);
  const data = idxs.map(i => d.data[i]);
  const series = data.map((row, i) => ({
    month: months[i],
    full: window.UNICO.MONTHS_FULL[months[i]] || months[i],
    ...row
  }));
  const total = series.reduce((s, r) => s + (r[d.primary] || 0), 0);
  const latest = series[series.length - 1];
  const li = idxs[idxs.length - 1];
  const prevRow = li > 0 ? d.data[li - 1] : null;
  const prev = prevRow ? {
    month: d.months[li - 1],
    full: window.UNICO.MONTHS_FULL[d.months[li - 1]] || d.months[li - 1],
    ...prevRow
  } : null;
  const cur = latest[d.primary] || 0,
    pv = prev ? prev[d.primary] || 0 : 0;
  const delta = pv === 0 ? cur > 0 ? 100 : 0 : Math.round((cur - pv) / pv * 100);
  const peak = Math.max(...series.map(r => r[d.primary] || 0));
  const avg = Math.round(total / series.length);
  return {
    ...d,
    months,
    data,
    series,
    total,
    latest,
    prev,
    delta,
    peak,
    avg
  };
}
function Dashboard({
  layout,
  depts: rawDepts,
  period,
  openDept,
  onFill,
  setRoute
}) {
  const MO = window.UNICO.MONTH_ORDER,
    MF = window.UNICO.MONTHS_FULL;
  const allMonths = React.useMemo(() => [...new Set(rawDepts.flatMap(d => d.months || []))].sort((a, b) => MO.indexOf(a) - MO.indexOf(b)), [rawDepts]);
  const months = window.unicoPeriodMonths(allMonths, period || {
    mode: 'all'
  });
  const monthsKey = months ? months.join(',') : 'all';
  const depts = React.useMemo(() => {
    if (!months) return rawDepts;
    const set = new Set(months);
    return rawDepts.map(d => deptForPeriod(d, set));
  }, [rawDepts, monthsKey]);
  const activeMonths = months || allMonths;
  const fmtKey = k => String(k || '').replace('-', ' ');
  const mShort = k => String(k || '').split('-')[0];
  const rangeShort = activeMonths.length ? `${fmtKey(activeMonths[0])}–${fmtKey(activeMonths[activeMonths.length - 1])}` : '—';
  const rangeFull = activeMonths.length ? `${MF[activeMonths[0]] || activeMonths[0]} – ${MF[activeMonths[activeMonths.length - 1]] || activeMonths[activeMonths.length - 1]}` : '—';
  const D = Object.fromEntries(depts.map(d => [d.id, d]));
  const BLANK = {
    latest: {},
    series: [],
    prev: null,
    total: 0,
    delta: 0,
    cols: []
  };
  const dg = id => D[id] || BLANK;
  const er = dg('er'),
    opd = dg('opd'),
    ot = dg('ot'),
    cath = dg('cathlab');
  const icuTotal = ['micu', 'sicu', 'ccu', 'nicu'].reduce((s, id) => s + (D[id]?.total || 0), 0);
  const procTotal = ['endoscopy', 'ot', 'cathlab', 'dialysis', 'ctvs'].reduce((s, id) => s + (D[id]?.total || 0), 0);
  const kpis = React.createElement("div", {
    className: "grid",
    style: {
      gridTemplateColumns: 'repeat(auto-fit,minmax(208px,1fr))'
    }
  }, React.createElement(KpiCard, {
    label: `ED Patients · ${mShort(er.latest.month)}`,
    value: fmt(er.latest.total),
    delta: er.delta,
    icon: I.pulse,
    tone: "#d23a52",
    foot: er.prev ? `vs ${mShort(er.prev.month)}` : 'latest month',
    spark: er.series.map(r => r.total),
    sparkColor: "#d23a52"
  }), React.createElement(KpiCard, {
    label: `OPD Footfall · ${mShort(opd.latest.month)}`,
    value: fmt(opd.latest.opd),
    delta: opd.delta,
    icon: I.user,
    tone: "#0b66d0",
    foot: `${fmt(opd.total)} over ${rangeShort}`,
    spark: opd.series.map(r => r.opd)
  }), React.createElement(KpiCard, {
    label: "Procedures",
    value: fmt(procTotal),
    icon: I.activity,
    tone: "#0f9b8e",
    foot: "OT \xB7 Cath \xB7 Endo \xB7 Dialysis",
    spark: ot.series.map(r => r.ot),
    sparkColor: "#0f9b8e"
  }), React.createElement(KpiCard, {
    label: "Critical Care Vol.",
    value: fmt(icuTotal),
    icon: I.heart,
    tone: "#6a52d4",
    foot: "MICU \xB7 SICU \xB7 CCU \xB7 NICU",
    spark: dg('micu').series.map(r => r.adm),
    sparkColor: "#6a52d4"
  }));
  const qualityKpis = function () {
    const Qh = window.UNICO_Q;
    if (!window.qualityData || !Qh) return null;
    const qd = window.qualityData().filter(d => d.indicators && d.indicators.length);
    const months = Qh.fyAxis(Qh.defaultFy(qd));
    let okC = 0,
      brC = 0;
    qd.forEach(d => {
      const s = Qh.deptStat(d, months);
      okC += s.ok;
      brC += s.breach;
    });
    const zero = okC + brC ? Math.round(okC * 100 / (okC + brC)) : 100;
    let capaMap = {};
    try {
      capaMap = JSON.parse(localStorage.getItem('unico_capa_v1')) || {};
    } catch (e) {}
    if (Array.isArray(capaMap)) capaMap = {};
    let open = 0;
    qd.forEach(d => d.indicators.forEach(ind => {
      if (Qh.countBreaches(ind, months) > 0 && capaMap[d.key + '/' + ind.id] !== 'Closed') open++;
    }));
    return {
      depts: qd.length,
      zero: zero,
      breach: brC,
      capaOpen: open
    };
  }();
  const qCard = (label, val, foot, color, route) => React.createElement("div", {
    className: "card anim-pop",
    onClick: () => setRoute && setRoute(route),
    style: {
      padding: '15px 18px',
      borderLeft: '4px solid ' + color,
      display: 'flex',
      flexDirection: 'column',
      minHeight: 104,
      cursor: setRoute ? 'pointer' : 'default'
    }
  }, React.createElement("div", {
    style: {
      fontSize: 12.5,
      fontWeight: 700,
      color: 'var(--ink-2)'
    }
  }, label), React.createElement("div", {
    className: "num",
    style: {
      fontSize: 30,
      fontWeight: 700,
      color: color,
      margin: '8px 0 5px',
      lineHeight: 1
    }
  }, val), React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--muted)',
      marginTop: 'auto'
    }
  }, foot));
  const qualityStrip = qualityKpis ? React.createElement(React.Fragment, null, React.createElement("div", {
    className: "eyebrow",
    style: {
      marginTop: 6
    }
  }, "Quality & Safety"), React.createElement("div", {
    className: "grid",
    style: {
      gridTemplateColumns: 'repeat(3,minmax(0,1fr))'
    }
  }, qCard('Zero-Defect Rate', qualityKpis.zero + '%', 'on-benchmark indicator-months', qualityKpis.zero >= 90 ? '#1f9d57' : qualityKpis.zero >= 70 ? '#e08a1e' : '#d23a52', {
    view: 'quality'
  }), qCard('Off Benchmark', fmt(qualityKpis.breach), 'indicator-months off benchmark', qualityKpis.breach > 0 ? '#d23a52' : '#1f9d57', {
    view: 'quality',
    qview: 'incidents'
  }), qCard('Open Action Plans', fmt(qualityKpis.capaOpen), 'off-benchmark months not yet closed', qualityKpis.capaOpen > 0 ? '#0090ca' : '#1f9d57', {
    view: 'quality',
    qview: 'actionplans'
  }))) : null;
  if (layout === 'operational') {
    return React.createElement("div", {
      className: "grid",
      style: {
        gap: 16
      }
    }, kpis, React.createElement(SectionTitle, {
      icon: I.layers,
      title: "All Departments",
      sub: "Latest month at a glance \u2014 click any card to drill in"
    }), React.createElement("div", {
      className: "grid",
      style: {
        gridTemplateColumns: 'repeat(auto-fill,minmax(232px,1fr))'
      }
    }, depts.map(d => React.createElement(DeptMiniCard, {
      key: d.id,
      d: d,
      onOpen: () => openDept(d.id)
    }))), React.createElement(ReportingCompliance, {
      depts: rawDepts,
      onFill: onFill
    }));
  }
  if (layout === 'analytics') {
    const erSeries = [{
      id: 'reg',
      label: 'ER Reg',
      color: '#0b66d0'
    }, {
      id: 'adm',
      label: 'Admission',
      color: '#0f9b8e'
    }, {
      id: 'total',
      label: 'Total ED',
      color: '#e08a1e'
    }];
    const dia = dg('dialysis');
    const diaSeries = [{
      id: 'conv',
      label: 'Conventional',
      color: '#0b66d0'
    }, {
      id: 'modi',
      label: 'Modi-SLED',
      color: '#0f9b8e'
    }, {
      id: 'sled',
      label: 'SLED',
      color: '#e08a1e'
    }];
    const cathMix = (cath.cols || []).filter(c => c.id !== 'total').map((c, i) => ({
      label: c.label,
      value: cath.series.reduce((s, r) => s + (r[c.id] || 0), 0),
      color: PALETTE[i]
    }));
    return React.createElement("div", {
      className: "grid",
      style: {
        gap: 16
      }
    }, kpis, React.createElement("div", {
      className: "grid",
      style: {
        gridTemplateColumns: '1.4fr 1fr'
      }
    }, React.createElement("div", {
      className: "card"
    }, React.createElement("div", {
      className: "card-h"
    }, React.createElement("h3", null, "Emergency Department \u2014 Registrations vs Admissions"), React.createElement("span", {
      className: "spacer"
    }), React.createElement("span", {
      className: "tag"
    }, "Grouped")), React.createElement("div", {
      className: "card-b"
    }, React.createElement(GroupedBar, {
      data: er.series,
      x: "month",
      series: erSeries,
      height: 250
    }))), React.createElement("div", {
      className: "card"
    }, React.createElement("div", {
      className: "card-h"
    }, React.createElement("h3", null, "Cath Lab \u2014 Procedure Mix"), React.createElement("span", {
      className: "spacer"
    }), React.createElement("span", {
      className: "tag"
    }, "Donut")), React.createElement("div", {
      className: "card-b",
      style: {
        display: 'grid',
        placeItems: 'center',
        minHeight: 250
      }
    }, React.createElement(Donut, {
      data: cathMix,
      centerValue: cath.total,
      centerLabel: "Total"
    })))), React.createElement("div", {
      className: "grid",
      style: {
        gridTemplateColumns: '1fr 1.4fr'
      }
    }, React.createElement("div", {
      className: "card"
    }, React.createElement("div", {
      className: "card-h"
    }, React.createElement("h3", null, "Dialysis \u2014 Modality Stack"), React.createElement("span", {
      className: "spacer"
    }), React.createElement("span", {
      className: "tag"
    }, "Stacked")), React.createElement("div", {
      className: "card-b"
    }, React.createElement(StackedBar, {
      data: dia.series,
      x: "month",
      series: diaSeries,
      height: 240
    }))), React.createElement("div", {
      className: "card"
    }, React.createElement("div", {
      className: "card-h"
    }, React.createElement("h3", null, "OPD Footfall \u2014 ", activeMonths.length, "-Month Trend"), React.createElement("span", {
      className: "spacer"
    }), React.createElement("span", {
      className: "tag"
    }, "Area line")), React.createElement("div", {
      className: "card-b"
    }, React.createElement(LineChart, {
      data: opd.series,
      x: "full",
      y: "opd",
      height: 240,
      color: "#0b66d0"
    })))));
  }
  const ranking = depts.map(d => ({
    label: d.short,
    value: d.latest[d.primary] || 0,
    color: PALETTE[d.id.charCodeAt(0) % PALETTE.length]
  })).sort((a, b) => b.value - a.value).slice(0, 8);
  const groupMix = [...new Set(depts.map(d => d.group).filter(Boolean))].map((g, i) => ({
    label: g,
    value: depts.filter(d => d.group === g).reduce((s, d) => s + d.total, 0),
    color: PALETTE[i]
  })).filter(x => x.value > 0);
  const erConv = er && er.latest && er.latest.conv != null ? er.latest.conv : 0;
  const latestFull = activeMonths.length ? MF[activeMonths[activeMonths.length - 1]] || activeMonths[activeMonths.length - 1] : '';
  return React.createElement("div", {
    className: "grid",
    style: {
      gap: 14
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: 16,
      flexWrap: 'wrap'
    }
  }, React.createElement("div", null, React.createElement("div", {
    style: {
      fontSize: 23,
      fontWeight: 700,
      letterSpacing: -.5
    }
  }, "Hospital Overview"), React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--muted)',
      marginTop: 3
    }
  }, "Unico Hospitals \xB7 ", depts.length, " department", depts.length === 1 ? '' : 's', " reporting", latestFull ? ' · ' + latestFull : '')), React.createElement("div", {
    style: {
      marginLeft: 'auto',
      display: 'flex',
      alignItems: 'center',
      gap: 9
    }
  }, React.createElement("button", {
    className: "btn",
    onClick: () => setRoute && setRoute({
      view: 'quality'
    })
  }, React.createElement(Ic, {
    d: I.heart,
    s: 15
  }), "Quality board"), React.createElement("button", {
    className: "btn pri",
    onClick: () => setRoute && setRoute({
      view: 'reports'
    })
  }, React.createElement(Ic, {
    d: I.doc,
    s: 15
  }), "Generate Report"))), React.createElement("div", {
    className: "eyebrow"
  }, "Patient Volume"), kpis, qualityStrip, React.createElement("div", {
    className: "eyebrow",
    style: {
      marginTop: 6
    }
  }, "Trends & Distribution"), React.createElement("div", {
    className: "grid",
    style: {
      gridTemplateColumns: '1.55fr 1fr'
    }
  }, React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, "OPD Footfall \u2014 Hospital-wide Trend"), React.createElement("span", {
    className: "sub"
  }, rangeFull), React.createElement("span", {
    className: "spacer"
  }), React.createElement(Delta, {
    v: opd.delta
  })), React.createElement("div", {
    className: "card-b"
  }, React.createElement(LineChart, {
    data: opd.series,
    x: "full",
    y: "opd",
    height: 258,
    color: "#0b66d0"
  }))), React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, "Volume by Service Line"), React.createElement("span", {
    className: "spacer"
  })), React.createElement("div", {
    className: "card-b",
    style: {
      display: 'grid',
      placeItems: 'center'
    }
  }, React.createElement(Donut, {
    data: groupMix,
    size: 186,
    centerValue: fmt(groupMix.reduce((s, d) => s + d.value, 0)),
    centerLabel: "All cases"
  })))));
}
window.Dashboard = Dashboard;
})();
;
/* ===== department.jsx ===== */
(function(){
function unicoDeptQuality(dept) {
  try {
    if (!dept || !window.qualityData) return null;
    const deptId = dept.id;
    const norm = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const qk = window.DEPTMAP ? window.DEPTMAP.qkFromId(deptId) : null;
    const areas = window.qualityData();
    const nId = norm(deptId),
      nShort = norm(dept.short),
      nName = norm(dept.name);
    const area = areas.find(a => qk && a.key === qk || a.deptId === deptId) || areas.find(a => norm(a.key) === nId || norm(a.key) === nShort || norm(a.name) === nName);
    if (!area || !(area.indicators && area.indicators.length)) return null;
    const Qh = window.UNICO_Q;
    if (!Qh) return null;
    const fy = Qh.defaultFy([area]);
    const months = Qh.fyAxis(fy);
    let capaMap = {};
    try {
      capaMap = JSON.parse(localStorage.getItem('unico_capa_v1')) || {};
    } catch (e) {}
    if (Array.isArray(capaMap)) capaMap = {};
    let latestMk = null;
    months.forEach(m => {
      if ((area.indicators || []).some(ind => Qh.qcCellVal(ind, m) != null)) latestMk = m[0];
    });
    const rows = (area.indicators || []).map(ind => {
      let lastVal = null;
      months.forEach(m => {
        const v = Qh.qcCellVal(ind, m);
        if (v != null) lastVal = v;
      });
      const reported = Qh.hasData(ind, months);
      const breaches = Qh.countBreaches(ind, months);
      const status = Qh.qStatus(ind, lastVal);
      const capa = capaMap[area.key + '/' + ind.id];
      const pct = Qh.isPctInd(ind);
      const bench = ind.benchmark || (ind.benchmarkValue != null && ind.benchmarkValue !== '' ? (ind.goalDirection === 'higher_is_better' ? '≥ ' : '≤ ') + ind.benchmarkValue + (pct ? ' %' : '') : '—');
      return {
        ind,
        id: ind.id,
        name: ind.name,
        latestVal: lastVal,
        status,
        pct,
        bench,
        reported,
        anyBreach: breaches > 0,
        capa,
        capaOpen: breaches > 0 && capa !== 'Closed'
      };
    });
    const agg = Qh.deptStat(area, months);
    const reported = rows.filter(r => r.reported);
    const onBench = reported.filter(r => r.status === 'ok').length;
    const openBreach = reported.filter(r => r.status === 'breach').length;
    const actionPlans = rows.filter(r => r.capaOpen);
    return {
      area,
      rows,
      reported,
      onBench,
      openBreach,
      zero: agg.rate,
      capaOpen: actionPlans.length,
      actionPlans,
      latestMonth: latestMk,
      reportedCount: reported.length,
      fy
    };
  } catch (e) {
    return null;
  }
}
window.unicoDeptQuality = unicoDeptQuality;
const Q_DOT = {
  ok: '#1f9d57',
  breach: '#d23a52',
  na: '#c4ccd6'
};
function unicoIndVal(r) {
  if (r.latestVal == null) return '—';
  try {
    if (window.UNICO_Q && window.UNICO_Q.fmtVal) return window.UNICO_Q.fmtVal(r.ind, r.latestVal);
  } catch (e) {}
  return r.pct ? r.latestVal + '%' : String(r.latestVal);
}
function DeptQualityBench({
  Q,
  showAll
}) {
  const rows = showAll ? Q.rows : Q.reported;
  const mShort = mk => String(mk || '').split('-')[0];
  return React.createElement("div", {
    className: "card",
    style: {
      overflow: 'hidden'
    }
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, "Indicators vs benchmark", Q.latestMonth ? ' · ' + mShort(Q.latestMonth) : ''), React.createElement("span", {
    className: "spacer"
  }), React.createElement("span", {
    className: "chip pos"
  }, Q.onBench, " / ", Q.reportedCount)), React.createElement("div", {
    style: {
      padding: '4px 0'
    }
  }, rows.length === 0 && React.createElement("div", {
    style: {
      padding: '20px 16px',
      textAlign: 'center',
      color: 'var(--muted)',
      fontSize: 12.5
    }
  }, "No indicator data reported yet."), rows.map((r, i) => {
    const breach = r.status === 'breach';
    return React.createElement("div", {
      key: r.id,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        padding: '11px 16px',
        borderBottom: i < rows.length - 1 ? '1px solid #f2f5f9' : 'none',
        background: breach ? '#fdf1f3' : 'transparent'
      }
    }, React.createElement("span", {
      style: {
        width: 9,
        height: 9,
        borderRadius: '50%',
        background: Q_DOT[r.status] || Q_DOT.na,
        flexShrink: 0
      }
    }), React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, React.createElement("div", {
      style: {
        fontSize: 12.5,
        fontWeight: 600,
        color: breach ? '#d23a52' : 'var(--ink)'
      }
    }, r.name, breach && React.createElement("span", {
      style: {
        fontSize: 9.5,
        fontWeight: 700,
        background: '#d23a52',
        color: '#fff',
        padding: '1px 6px',
        borderRadius: 9,
        marginLeft: 7
      }
    }, "BREACH")), React.createElement("div", {
      style: {
        fontSize: 10.5,
        color: breach ? '#c0757f' : 'var(--faint)'
      }
    }, "target ", r.bench)), React.createElement("span", {
      className: "num",
      style: {
        fontSize: 14,
        fontWeight: breach ? 700 : 600,
        color: breach ? '#d23a52' : 'var(--ink)'
      }
    }, unicoIndVal(r)));
  })));
}
function DeptActionPlans({
  Q
}) {
  if (!Q.actionPlans.length) return null;
  return Q.actionPlans.map(r => React.createElement("div", {
    key: r.id,
    className: "card",
    style: {
      borderLeft: '4px solid #e08a1e',
      padding: '14px 16px'
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8
    }
  }, React.createElement(Ic, {
    d: I.doc,
    s: 16,
    c: "#e08a1e"
  }), React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700
    }
  }, "Action Plan \xB7 ", r.name), React.createElement("span", {
    style: {
      marginLeft: 'auto',
      fontSize: 10,
      fontWeight: 700,
      background: '#fdf3e3',
      color: '#e08a1e',
      padding: '2px 8px',
      borderRadius: 20,
      textTransform: 'uppercase'
    }
  }, r.capa || 'Open')), React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--ink-2)',
      lineHeight: 1.5
    }
  }, "Off benchmark (target ", r.bench, ") \u2014 corrective action required. ", React.createElement("span", {
    style: {
      color: 'var(--faint)'
    }
  }, "Latest reading ", unicoIndVal(r), "."))));
}
function DeptDetail({
  dept,
  openDept,
  depts,
  setRoute
}) {
  const d = dept;
  const [chart, setChart] = React.useState('bar');
  const Q = React.useMemo(() => unicoDeptQuality(d), [d.id]);
  const editData = () => {
    if (setRoute) setRoute({
      view: 'input',
      dept: d.id
    });
  };
  const exportCSV = () => {
    const cols = d.cols;
    const esc = v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const lines = [['Month', ...cols.map(c => c.label)].map(esc).join(',')];
    d.series.forEach(r => lines.push([r.full || r.month, ...cols.map(c => r[c.id] == null ? '' : r[c.id])].map(esc).join(',')));
    try {
      const blob = new Blob([lines.join('\n')], {
        type: 'text/csv;charset=utf-8'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${d.short}-data.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      window.UI && window.UI.toast(`Exported ${d.short} data (CSV)`, 'success');
    } catch (e) {
      window.UI && window.UI.toast('Export failed', 'error');
    }
  };
  const tone = PALETTE[d.id.charCodeAt(0) % PALETTE.length];
  const multi = d.cols.length > 1;
  const breakdownCols = d.cols.filter(c => c.id !== d.primary && !c.pct);
  const mixSeries = breakdownCols.slice(0, 6).map((c, i) => ({
    id: c.id,
    label: c.label,
    color: PALETTE[i]
  }));
  const [rangeMode, setRangeMode] = React.useState('all');
  const [fromM, setFromM] = React.useState(d.months[0]);
  const [toM, setToM] = React.useState(d.months[d.months.length - 1]);
  React.useEffect(() => {
    setRangeMode('all');
    setFromM(d.months[0]);
    setToM(d.months[d.months.length - 1]);
  }, [d.id]);
  let vs = d.series;
  if (rangeMode === 'l3') vs = d.series.slice(-3);else if (rangeMode === 'l6') vs = d.series.slice(-6);else if (rangeMode === 'latest') vs = d.series.slice(-1);else if (rangeMode === 'custom') {
    const fi = d.months.indexOf(fromM),
      ti = d.months.indexOf(toM);
    if (fi < 0 || ti < 0) vs = d.series;else {
      const a = Math.min(fi, ti),
        b = Math.max(fi, ti);
      vs = d.series.slice(a, b + 1);
    }
  }
  if (!vs.length) vs = d.series.slice(-1);
  const vTotal = vs.reduce((s, r) => s + (r[d.primary] || 0), 0);
  const vLatest = vs[vs.length - 1] || {};
  const vPrev = vs.length > 1 ? vs[vs.length - 2] : null;
  const vDelta = vPrev ? (() => {
    const c = vLatest[d.primary] || 0,
      p = vPrev[d.primary] || 0;
    return p === 0 ? c > 0 ? 100 : 0 : Math.round((c - p) / p * 100);
  })() : d.delta;
  const vPeak = vs.length ? Math.max(...vs.map(r => r[d.primary] || 0)) : 0;
  const vAvg = vs.length ? Math.round(vTotal / vs.length) : 0;
  const mixDonut = breakdownCols.map((c, i) => ({
    label: c.label,
    value: vs.reduce((s, r) => s + (r[c.id] || 0), 0),
    color: PALETTE[i % PALETTE.length]
  })).filter(x => x.value > 0);
  const rangeLabel = rangeMode === 'all' ? `all ${d.series.length} months` : rangeMode === 'latest' ? 'latest month' : rangeMode === 'l3' ? 'last 3 months' : rangeMode === 'l6' ? 'last 6 months' : `${vs[0]?.month || ''} → ${vs[vs.length - 1]?.month || ''}`;
  const selSty = {
    padding: '6px 9px',
    border: '1px solid var(--line)',
    borderRadius: 6,
    fontSize: 12,
    fontFamily: 'var(--mono)',
    background: '#fff'
  };
  const stat = (label, val, sub, chip) => React.createElement("div", {
    className: "card",
    style: {
      padding: '13px 15px',
      display: 'flex',
      flexDirection: 'column',
      gap: 5
    }
  }, React.createElement("div", {
    className: "lbl",
    style: {
      fontSize: 10.5,
      color: 'var(--muted)',
      textTransform: 'uppercase',
      letterSpacing: .4,
      fontWeight: 600
    }
  }, label), React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 8
    }
  }, React.createElement("div", {
    className: "num",
    style: {
      fontSize: 24,
      fontWeight: 600,
      color: 'var(--ink)'
    }
  }, val), chip), React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--faint)'
    }
  }, sub));
  const header = React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      flexWrap: 'wrap'
    }
  }, React.createElement("span", {
    onClick: () => setRoute && setRoute({
      view: 'departments'
    }),
    style: {
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      color: 'var(--muted)',
      fontSize: 12.5,
      fontWeight: 600
    }
  }, React.createElement(Ic, {
    d: "M15 6l-6 6 6 6",
    s: 15
  }), "All departments"), React.createElement("div", {
    style: {
      width: 46,
      height: 46,
      borderRadius: 12,
      background: tone + '18',
      color: tone,
      display: 'grid',
      placeItems: 'center'
    }
  }, React.createElement(Ic, {
    d: DEPT_ICON[d.id] || I.activity,
    s: 24
  })), React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, React.createElement("div", {
    style: {
      fontSize: 20,
      fontWeight: 700,
      letterSpacing: -.3
    }
  }, d.name), React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--muted)'
    }
  }, d.group, Q ? ` · ${Q.rows.length} quality indicator${Q.rows.length === 1 ? '' : 's'} tracked` : d.desc ? ' · ' + d.desc : '')), React.createElement("div", {
    style: {
      marginLeft: 'auto',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, React.createElement("button", {
    className: "btn sm",
    onClick: () => setRoute && setRoute({
      view: 'gallery',
      dept: d.id
    }),
    title: "All charts + export"
  }, React.createElement(Ic, {
    d: I.grid,
    s: 15
  }), "All Charts"), React.createElement("button", {
    className: "btn sm",
    onClick: exportCSV
  }, React.createElement(Ic, {
    d: I.download,
    s: 15
  }), "Export"), React.createElement("button", {
    className: "btn sm",
    onClick: editData
  }, React.createElement(Ic, {
    d: I.edit,
    s: 15
  }), "Edit Data"), React.createElement("button", {
    className: "btn pri sm",
    onClick: editData,
    title: `Enter data for ${d.name}`
  }, React.createElement(Ic, {
    d: I.input,
    s: 15
  }), "Quick Entry")));
  const qColor = Q ? Q.zero >= 90 ? '#1f9d57' : Q.zero >= 70 ? '#e08a1e' : '#d23a52' : 'var(--ink)';
  const qkTile = (eye, eyeColor, val, valColor, foot) => React.createElement("div", {
    className: "card",
    style: {
      padding: '13px 15px'
    }
  }, React.createElement("div", {
    style: {
      fontSize: 10,
      textTransform: 'uppercase',
      letterSpacing: .5,
      color: eyeColor,
      fontWeight: 700,
      marginBottom: 8
    }
  }, eye), React.createElement("div", {
    className: "num",
    style: {
      fontSize: 24,
      fontWeight: 600,
      lineHeight: 1,
      color: valColor || 'var(--ink)'
    }
  }, val), React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--muted)',
      marginTop: 5
    }
  }, foot));
  const deltaTxt = v => React.createElement("span", {
    style: {
      color: v >= 0 ? '#1f9d57' : '#d23a52',
      fontWeight: 600
    }
  }, v >= 0 ? '▲' : '▼', Math.abs(v), "%");
  const kpiRow = React.createElement("div", {
    className: "grid",
    style: {
      gridTemplateColumns: 'repeat(5,1fr)',
      gap: 12
    }
  }, qkTile('◆ Volume', '#0090ca', fmt(d.latest[d.primary] || 0), 'var(--ink)', React.createElement("span", null, "Latest ", d.primaryLabel, " ", deltaTxt(d.delta))), qkTile('◆ Volume', '#0090ca', fmt(d.avg), 'var(--ink)', 'Monthly average'), qkTile('● Quality', qColor, Q ? Q.zero + '%' : '—', qColor, 'Zero-Defect'), qkTile('● Quality', '#d23a52', Q ? String(Q.openBreach) : '—', Q && Q.openBreach > 0 ? '#d23a52' : 'var(--ink)', 'Off Benchmark'), qkTile('● Quality', '#e08a1e', Q ? String(Q.capaOpen) : '—', Q && Q.capaOpen > 0 ? '#e08a1e' : 'var(--ink)', 'Action Plan' + (Q && Q.capaOpen === 1 ? '' : 's')));
  return React.createElement("div", {
    className: "grid",
    style: {
      gap: 16
    }
  }, header, kpiRow, React.createElement("div", {
    className: "eyebrow",
    style: {
      marginTop: 2
    }
  }, "Patient Volume"), React.createElement("div", {
    className: "card",
    style: {
      padding: '10px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      flexWrap: 'wrap'
    }
  }, React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: 'var(--ink-2)',
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, React.createElement(Ic, {
    d: I.cal,
    s: 15,
    c: "var(--blue)"
  }), "View"), React.createElement("div", {
    className: "seg"
  }, [['all', 'Monthly'], ['l3', 'Last 3M'], ['l6', 'Last 6M'], ['latest', 'Latest'], ['custom', 'Custom']].map(([id, l]) => React.createElement("button", {
    key: id,
    className: rangeMode === id ? 'on' : '',
    onClick: () => setRangeMode(id)
  }, l))), rangeMode === 'custom' && React.createElement(React.Fragment, null, React.createElement("span", {
    style: {
      fontSize: 12,
      color: 'var(--muted)'
    }
  }, "From"), React.createElement("select", {
    style: selSty,
    value: fromM,
    onChange: e => setFromM(e.target.value)
  }, d.months.map(m => React.createElement("option", {
    key: m,
    value: m
  }, m))), React.createElement("span", {
    style: {
      fontSize: 12,
      color: 'var(--muted)'
    }
  }, "To"), React.createElement("select", {
    style: selSty,
    value: toM,
    onChange: e => setToM(e.target.value)
  }, d.months.map(m => React.createElement("option", {
    key: m,
    value: m
  }, m)))), React.createElement("span", {
    className: "spacer"
  }), React.createElement("span", {
    style: {
      fontSize: 11.5,
      color: 'var(--faint)'
    }
  }, "Showing ", rangeLabel, " \xB7 ", vs.length, " point", vs.length > 1 ? 's' : '')), React.createElement("div", {
    className: "grid",
    style: {
      gridTemplateColumns: 'repeat(4,1fr)'
    }
  }, stat(`${d.primaryLabel} · ${vLatest.month || ''}`, fmt(vLatest[d.primary] || 0), 'latest in range', React.createElement(Delta, {
    v: vDelta
  })), stat('Range Total', fmt(vTotal), `${vs.length} month${vs.length > 1 ? 's' : ''} · ${rangeLabel}`), stat('Peak Month', fmt(vPeak), vs.find(r => (r[d.primary] || 0) === vPeak)?.full || ''), stat('Monthly Average', fmt(vAvg), 'mean across range')), React.createElement("div", {
    className: "grid",
    style: {
      gridTemplateColumns: multi && mixDonut.length > 1 ? '1.55fr 1fr' : '1fr'
    }
  }, React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, d.primaryLabel, " \u2014 Monthly Trend"), React.createElement("span", {
    className: "spacer"
  }), React.createElement("div", {
    className: "seg",
    style: {
      flexWrap: 'wrap'
    }
  }, ['bar', '3d', 'line', 'area', 'combo', 'horizontal', multi && 'grouped', multi && 'stacked', multi && 'pct', mixDonut.length > 1 && 'donut'].filter(Boolean).map(t => React.createElement("button", {
    key: t,
    className: chart === t ? 'on' : '',
    onClick: () => setChart(t)
  }, t === '3d' ? '3D' : t === 'combo' ? 'Bar+Line' : t === 'pct' ? '100%' : t === 'horizontal' ? 'Horiz' : t[0].toUpperCase() + t.slice(1))))), React.createElement("div", {
    className: "card-b"
  }, chart === 'bar' && React.createElement(BarChart, {
    data: vs,
    x: "month",
    y: d.primary,
    height: 280,
    color: tone
  }), chart === '3d' && React.createElement(Bar3D, {
    data: vs,
    x: "month",
    y: d.primary,
    height: 300,
    color: tone
  }), chart === 'line' && React.createElement(LineChart, {
    data: vs,
    x: "full",
    y: d.primary,
    height: 280,
    color: tone
  }), chart === 'area' && typeof window.AreaTargetChart === 'function' && React.createElement(AreaTargetChart, {
    data: vs,
    x: "full",
    y: d.primary,
    target: vAvg,
    height: 280,
    color: tone
  }), chart === 'combo' && typeof window.ComboChart === 'function' && (() => {
    const pc = d.cols.find(c => c.pct);
    const lk = pc ? pc.id : (mixSeries[0] || {}).id || d.primary;
    return React.createElement(ComboChart, {
      data: vs,
      x: "month",
      barKey: d.primary,
      lineKey: lk,
      barColor: tone,
      lineColor: "#e08a1e",
      barLabel: d.primaryLabel || 'Value',
      lineLabel: (d.cols.find(c => c.id === lk) || {}).label || 'Trend',
      height: 300
    });
  })(), chart === 'horizontal' && typeof window.HBarChart === 'function' && React.createElement(HBarChart, {
    data: vs.map(r => ({
      label: r.full,
      val: r[d.primary] || 0
    })),
    x: "label",
    y: "val",
    height: Math.max(180, vs.length * 32)
  }), chart === 'grouped' && React.createElement(GroupedBar, {
    data: vs,
    x: "month",
    series: mixSeries,
    height: 290
  }), chart === 'stacked' && React.createElement(StackedBar, {
    data: vs,
    x: "month",
    series: mixSeries,
    height: 290
  }), chart === 'pct' && typeof window.StackedPctBar === 'function' && React.createElement(StackedPctBar, {
    data: vs,
    x: "month",
    series: mixSeries,
    height: 290
  }), chart === 'donut' && React.createElement("div", {
    style: {
      display: 'grid',
      placeItems: 'center',
      minHeight: 280
    }
  }, React.createElement(Donut, {
    data: mixDonut,
    size: 200,
    centerValue: fmt(mixDonut.reduce((s, x) => s + x.value, 0)),
    centerLabel: "Total"
  })))), multi && mixDonut.length > 1 && React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, "Composition"), React.createElement("span", {
    className: "sub"
  }, "period total")), React.createElement("div", {
    className: "card-b",
    style: {
      display: 'grid',
      placeItems: 'center'
    }
  }, React.createElement(Donut, {
    data: mixDonut,
    size: 186,
    centerValue: fmt(mixDonut.reduce((s, x) => s + x.value, 0)),
    centerLabel: "Total"
  })))), React.createElement("div", {
    className: "card",
    style: {
      overflow: 'hidden'
    }
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, "Monthly Data Table"), React.createElement("span", {
    className: "spacer"
  }), React.createElement("button", {
    className: "btn sm",
    onClick: exportCSV
  }, React.createElement(Ic, {
    d: I.download,
    s: 14
  }), "CSV")), React.createElement("div", {
    style: {
      overflowX: 'auto'
    }
  }, React.createElement("table", {
    className: "tbl"
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Month"), d.cols.map(c => React.createElement("th", {
    key: c.id
  }, c.label)))), React.createElement("tbody", null, vs.map((r, i) => React.createElement("tr", {
    key: i
  }, React.createElement("td", null, r.full), d.cols.map(c => React.createElement("td", {
    key: c.id
  }, r[c.id] == null ? '–' : c.pct ? r[c.id] + '%' : fmt(r[c.id]))))), React.createElement("tr", {
    className: "tot"
  }, React.createElement("td", null, "TOTAL"), d.cols.map(c => React.createElement("td", {
    key: c.id
  }, c.pct ? '—' : fmt(vs.reduce((s, r) => s + (r[c.id] || 0), 0))))))))), React.createElement("div", {
    className: "eyebrow",
    style: {
      marginTop: 6
    }
  }, "Quality & Safety"), Q ? React.createElement(React.Fragment, null, React.createElement("div", {
    className: "grid",
    style: {
      gridTemplateColumns: Q.actionPlans.length ? '1.5fr 1fr' : '1fr',
      alignItems: 'start'
    }
  }, React.createElement(DeptQualityBench, {
    Q: Q,
    showAll: true
  }), Q.actionPlans.length > 0 && React.createElement("div", {
    className: "grid",
    style: {
      gap: 12,
      alignContent: 'start'
    }
  }, React.createElement(DeptActionPlans, {
    Q: Q
  }))), Q.actionPlans.length === 0 && React.createElement("div", {
    className: "card",
    style: {
      padding: '14px 16px',
      fontSize: 12,
      color: 'var(--muted)',
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, React.createElement(Ic, {
    d: I.check,
    s: 16,
    c: "#1f9d57"
  }), "No open action plans \u2014 reported indicators on benchmark."), React.createElement("div", null, React.createElement("button", {
    className: "btn sm",
    onClick: () => setRoute && setRoute({
      view: 'quality'
    })
  }, React.createElement(Ic, {
    d: I.arrowR,
    s: 14
  }), "Open full Quality console"))) : React.createElement("div", {
    className: "card",
    style: {
      padding: '28px 16px',
      textAlign: 'center',
      color: 'var(--muted)',
      fontSize: 12.5
    }
  }, React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      color: 'var(--ink)'
    }
  }, "No quality indicators linked"), React.createElement("div", {
    style: {
      margin: '6px 0 14px'
    }
  }, "This department has no quality area yet."), React.createElement("button", {
    className: "btn sm",
    onClick: () => setRoute && setRoute({
      view: 'quality'
    })
  }, React.createElement(Ic, {
    d: I.heart,
    s: 14
  }), "Open Quality board")), React.createElement("div", {
    style: {
      marginTop: 4
    }
  }, React.createElement(SectionTitle, {
    icon: I.layers,
    title: "Jump to another department"
  }), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, depts.filter(x => x.id !== d.id).map(x => React.createElement("button", {
    key: x.id,
    className: "btn sm",
    onClick: () => openDept(x.id)
  }, React.createElement(Ic, {
    d: DEPT_ICON[x.id] || I.activity,
    s: 14
  }), x.short)))));
}
window.DeptDetail = DeptDetail;
function DeptCardTile({
  d,
  onOpen
}) {
  const tone = PALETTE[(d.id.charCodeAt(0) + d.id.length) % PALETTE.length];
  return React.createElement("div", {
    className: "card",
    onClick: onOpen,
    style: {
      cursor: 'pointer',
      padding: '14px 15px'
    },
    onMouseEnter: e => e.currentTarget.style.boxShadow = 'var(--shadow-md)',
    onMouseLeave: e => e.currentTarget.style.boxShadow = 'var(--shadow)'
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      marginBottom: 11
    }
  }, React.createElement("div", {
    style: {
      width: 32,
      height: 32,
      borderRadius: 9,
      background: tone + '18',
      color: tone,
      display: 'grid',
      placeItems: 'center'
    }
  }, React.createElement(Ic, {
    d: DEPT_ICON[d.id] || I.activity,
    s: 17
  })), React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, React.createElement("div", {
    style: {
      fontSize: 13.5,
      fontWeight: 700,
      color: 'var(--ink)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      maxWidth: 150
    }
  }, d.short), React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: 'var(--faint)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      maxWidth: 150
    }
  }, d.name)), React.createElement("span", {
    style: {
      marginLeft: 'auto'
    }
  }, React.createElement(Delta, {
    v: d.delta
  }))), React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'space-between'
    }
  }, React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, React.createElement("div", {
    className: "num",
    style: {
      fontSize: 23,
      fontWeight: 600,
      color: 'var(--ink)',
      lineHeight: 1
    }
  }, fmt(d.latest[d.primary] || 0)), React.createElement("div", {
    style: {
      fontSize: 10,
      color: 'var(--faint)',
      fontWeight: 600,
      marginTop: 3,
      whiteSpace: 'nowrap'
    }
  }, d.latest.full || d.latest.month || 'No data')), React.createElement(Spark, {
    values: d.series.map(r => r[d.primary] || 0),
    color: tone,
    w: 96,
    h: 34
  })));
}
function DeptGrid({
  depts,
  openDept,
  setRoute
}) {
  const [mode, setMode] = React.useState('group');
  const [showFilter, setShowFilter] = React.useState(false);
  const [q, setQ] = React.useState('');
  const GROUPS = window.UNICO.GROUPS;
  const allM = [...new Set(depts.flatMap(d => d.months || []))];
  const MO = window.UNICO.MONTH_ORDER || [];
  const gapOf = d => {
    const own = (d.months || []).map(m => MO.indexOf(m)).filter(i => i >= 0);
    if (!own.length) return allM.length - (d.months && d.months.length || 0);
    const first = Math.min(...own);
    return Math.max(0, allM.filter(m => MO.indexOf(m) >= first).length - d.months.length);
  };
  const query = q.trim().toLowerCase();
  const shown = query ? depts.filter(d => ((d.name || '') + ' ' + (d.short || '')).toLowerCase().includes(query)) : depts;
  let groups;
  if (mode === 'alpha') {
    const list = [...shown].sort((a, b) => String(a.name).localeCompare(String(b.name)));
    groups = [{
      name: 'All Departments',
      color: PALETTE[0],
      count: list.length,
      tot: fmt(list.reduce((s, d) => s + d.total, 0)) + ' cases',
      cards: list
    }];
  } else if (mode === 'gaps') {
    const need = shown.filter(d => gapOf(d) > 0).sort((a, b) => gapOf(b) - gapOf(a));
    const ok = shown.filter(d => gapOf(d) === 0);
    groups = [need.length ? {
      name: 'Needs attention',
      color: '#d23a52',
      count: need.length,
      tot: 'missing months',
      cards: need
    } : null, ok.length ? {
      name: 'Up to date',
      color: '#1f9d57',
      count: ok.length,
      tot: 'complete',
      cards: ok
    } : null].filter(Boolean);
  } else {
    groups = GROUPS.map((g, i) => {
      const cards = shown.filter(d => d.group === g);
      return cards.length ? {
        name: g,
        color: PALETTE[i % PALETTE.length],
        count: cards.length,
        tot: fmt(cards.reduce((s, d) => s + d.total, 0)) + ' cases',
        cards
      } : null;
    }).filter(Boolean);
    const other = shown.filter(d => GROUPS.indexOf(d.group) < 0);
    if (other.length) groups.push({
      name: 'Other',
      color: PALETTE[GROUPS.length % PALETTE.length],
      count: other.length,
      tot: fmt(other.reduce((s, d) => s + d.total, 0)) + ' cases',
      cards: other
    });
  }
  return React.createElement("div", null, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      marginBottom: 20,
      flexWrap: 'wrap'
    }
  }, React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--muted)',
      fontWeight: 600
    }
  }, "Group by"), React.createElement("div", {
    className: "seg"
  }, [['group', 'Service line'], ['alpha', 'Alphabetical'], ['gaps', 'Reporting gaps']].map(([id, l]) => React.createElement("button", {
    key: id,
    className: mode === id ? 'on' : '',
    onClick: () => setMode(id)
  }, l))), showFilter && React.createElement("input", {
    autoFocus: true,
    value: q,
    onChange: e => setQ(e.target.value),
    placeholder: "Filter departments\u2026",
    style: {
      padding: '6px 10px',
      border: '1px solid var(--line)',
      borderRadius: 8,
      fontSize: 12.5,
      fontFamily: 'inherit',
      background: '#fff',
      width: 180,
      outline: 'none'
    }
  }), React.createElement("div", {
    style: {
      marginLeft: 'auto',
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, React.createElement("button", {
    className: 'btn sm' + (showFilter ? ' pri' : ''),
    onClick: () => {
      setShowFilter(v => !v);
      if (showFilter) setQ('');
    }
  }, React.createElement(Ic, {
    d: I.filter,
    s: 14
  }), "Filter"), React.createElement("button", {
    className: "btn pri sm",
    onClick: () => setRoute && setRoute({
      view: 'manage'
    })
  }, React.createElement(Ic, {
    d: I.plus,
    s: 14
  }), "Add Department"))), groups.length === 0 && React.createElement("div", {
    style: {
      padding: '40px 16px',
      textAlign: 'center',
      color: 'var(--muted)',
      fontSize: 13
    }
  }, "No departments match \u201C", q, "\u201D."), groups.map((g, gi) => React.createElement(React.Fragment, {
    key: gi
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 11,
      margin: '0 0 12px'
    }
  }, React.createElement("span", {
    style: {
      width: 11,
      height: 11,
      borderRadius: 4,
      background: g.color
    }
  }), React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 700
    }
  }, g.name), React.createElement("span", {
    className: "num",
    style: {
      fontSize: 10.5,
      fontWeight: 600,
      background: '#f2f5f9',
      color: '#5b6b80',
      padding: '2px 8px',
      borderRadius: 20
    }
  }, g.count), React.createElement("div", {
    style: {
      flex: 1,
      height: 1,
      background: '#e3e9f1'
    }
  }), React.createElement("span", {
    style: {
      fontSize: 12,
      color: 'var(--muted)'
    }
  }, g.tot)), React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill,minmax(252px,1fr))',
      gap: 12,
      marginBottom: 26
    }
  }, g.cards.map(d => React.createElement(DeptCardTile, {
    key: d.id,
    d: d,
    onOpen: () => openDept(d.id)
  }))))));
}
window.DeptGrid = DeptGrid;
})();
;
/* ===== comparison.jsx ===== */
(function(){
function DeptCompare({
  depts,
  openDept
}) {
  const {
    useState,
    useMemo
  } = React;
  const MAX = 6;
  const [sel, setSel] = useState(() => depts.slice(0, 3).map(d => d.id));
  const toggle = id => setSel(s => {
    if (s.includes(id)) return s.filter(x => x !== id);
    if (s.length >= MAX) return s;
    return [...s, id];
  });
  const selDepts = useMemo(() => sel.map(id => depts.find(d => d.id === id)).filter(Boolean), [sel, depts]);
  const metricOptions = useMemo(() => {
    const count = {},
      labelOf = {};
    selDepts.forEach(d => {
      (d.cols || []).forEach(c => {
        if (c.pct) return;
        count[c.id] = (count[c.id] || 0) + 1;
        if (!labelOf[c.id]) labelOf[c.id] = c.label;
      });
    });
    const opts = [{
      id: '__primary__',
      label: 'Primary metric (per dept)'
    }];
    Object.keys(count).forEach(id => {
      if (count[id] >= 2 && id !== '__primary__') opts.push({
        id,
        label: labelOf[id]
      });
    });
    return opts;
  }, [selDepts]);
  const [metric, setMetric] = useState('__primary__');
  React.useEffect(() => {
    if (!metricOptions.some(o => o.id === metric)) setMetric('__primary__');
  }, [metricOptions]);
  const keyFor = d => {
    if (metric === '__primary__') return d.primary;
    return (d.cols || []).some(c => c.id === metric && !c.pct) ? metric : d.primary;
  };
  const metricLabel = metric === '__primary__' ? 'Primary metric' : metricOptions.find(o => o.id === metric)?.label || metric;
  const [rangeMode, setRangeMode] = useState('all');
  const RANGE = [['all', 'All'], ['l6', 'Last 6M'], ['l3', 'Last 3M'], ['latest', 'Latest']];
  const sliceN = rangeMode === 'l3' ? 3 : rangeMode === 'l6' ? 6 : rangeMode === 'latest' ? 1 : 0;
  const MO = window.UNICO && window.UNICO.MONTH_ORDER || [];
  const windowMonths = useMemo(() => {
    if (rangeMode === 'all') return null;
    const all = [...new Set(selDepts.flatMap(d => (d.series || []).map(r => r.month)))].sort((a, b) => MO.indexOf(a) - MO.indexOf(b));
    return new Set(all.slice(-sliceN));
  }, [selDepts, rangeMode, sliceN]);
  const inRange = d => {
    const s = d.series || [];
    if (!s.length) return [];
    if (!windowMonths) return s;
    return s.filter(r => windowMonths.has(r.month));
  };
  const stats = useMemo(() => selDepts.map(d => {
    const k = keyFor(d);
    const vs = inRange(d);
    const vals = vs.map(r => r[k] || 0);
    const total = vals.reduce((a, b) => a + b, 0);
    const latestRow = vs[vs.length - 1] || {};
    const prevRow = vs.length > 1 ? vs[vs.length - 2] : null;
    const latest = latestRow[k] || 0;
    const prev = prevRow ? prevRow[k] || 0 : null;
    const delta = prev == null ? 0 : prev === 0 ? latest > 0 ? 100 : 0 : Math.round((latest - prev) / prev * 100);
    const peak = vals.length ? Math.max(...vals) : 0;
    const avg = vals.length ? Math.round(total / vals.length) : 0;
    const tone = PALETTE[Math.abs(d.id.charCodeAt(0) + d.id.length) % PALETTE.length];
    return {
      d,
      k,
      vs,
      total,
      latest,
      latestMonth: latestRow.month || '—',
      delta,
      hasPrev: prev != null,
      peak,
      avg,
      count: vals.length,
      tone,
      empty: !vs.length
    };
  }), [selDepts, metric, rangeMode]);
  const chartData = useMemo(() => {
    const monthSet = [];
    stats.forEach(st => st.vs.forEach(r => {
      if (!monthSet.includes(r.month)) monthSet.push(r.month);
    }));
    const order = window.UNICO && window.UNICO.MONTH_ORDER;
    monthSet.sort((a, b) => order ? order.indexOf(a) - order.indexOf(b) : 0);
    return monthSet.map(m => {
      const row = {
        month: m
      };
      stats.forEach(st => {
        const hit = st.vs.find(r => r.month === m);
        row[st.d.id] = hit ? hit[st.k] || 0 : 0;
      });
      return row;
    });
  }, [stats]);
  const chartSeries = stats.map(st => ({
    id: st.d.id,
    label: st.d.short,
    color: st.tone
  }));
  const tooFew = selDepts.length < 2;
  const rangeNote = rangeMode === 'all' ? 'all reported months' : rangeMode === 'latest' ? 'latest month' : rangeMode === 'l3' ? 'last 3 months' : 'last 6 months';
  return React.createElement("div", {
    className: "grid",
    style: {
      gap: 16
    }
  }, React.createElement(SectionTitle, {
    icon: I.layers,
    title: "Compare Departments",
    sub: `Side-by-side comparison of patient-flow metrics · ${metricLabel} · ${rangeNote}`
  }), React.createElement("div", {
    className: "card",
    style: {
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 13
    }
  }, React.createElement("div", null, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 9
    }
  }, React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: 'var(--ink-2)',
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, React.createElement(Ic, {
    d: I.layers,
    s: 15,
    c: "var(--blue)"
  }), "Departments"), React.createElement("span", {
    style: {
      fontSize: 11,
      color: 'var(--faint)'
    }
  }, sel.length, "/", MAX, " selected \xB7 pick 2\u2013", MAX), React.createElement("span", {
    className: "spacer"
  }), React.createElement("button", {
    className: "btn sm",
    onClick: () => setSel(depts.slice(0, 3).map(d => d.id))
  }, "Reset")), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, depts.map(d => {
    const on = sel.includes(d.id);
    const idx = sel.indexOf(d.id);
    const tone = on ? PALETTE[Math.abs(d.id.charCodeAt(0) + d.id.length) % PALETTE.length] : null;
    const disabled = !on && sel.length >= MAX;
    return React.createElement("button", {
      key: d.id,
      onClick: () => toggle(d.id),
      disabled: disabled,
      title: disabled ? `Max ${MAX} departments` : d.name,
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        padding: '6px 11px',
        borderRadius: 8,
        border: '1px solid ' + (on ? tone : 'var(--line)'),
        background: on ? tone + '14' : '#fff',
        color: on ? tone : 'var(--ink-2)',
        fontSize: 12,
        fontWeight: 600,
        opacity: disabled ? .45 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: '.15s'
      }
    }, React.createElement("span", {
      style: {
        width: 16,
        height: 16,
        borderRadius: 4,
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
        border: '1.5px solid ' + (on ? tone : 'var(--line)'),
        background: on ? tone : '#fff',
        color: '#fff'
      }
    }, on && React.createElement(Ic, {
      d: I.check,
      s: 11,
      c: "#fff",
      sw: 2.6
    })), React.createElement(Ic, {
      d: DEPT_ICON[d.id] || I.activity,
      s: 15
    }), d.short);
  }))), React.createElement("div", {
    style: {
      height: 1,
      background: 'var(--line-2)'
    }
  }), React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      flexWrap: 'wrap'
    }
  }, React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: 'var(--ink-2)',
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, React.createElement(Ic, {
    d: I.trend,
    s: 15,
    c: "var(--blue)"
  }), "Metric"), React.createElement("div", {
    className: "seg"
  }, metricOptions.map(o => React.createElement("button", {
    key: o.id,
    className: metric === o.id ? 'on' : '',
    onClick: () => setMetric(o.id)
  }, o.label))), React.createElement("span", {
    className: "spacer"
  }), React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: 'var(--ink-2)',
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, React.createElement(Ic, {
    d: I.cal,
    s: 15,
    c: "var(--blue)"
  }), "Range"), React.createElement("div", {
    className: "seg"
  }, RANGE.map(([id, l]) => React.createElement("button", {
    key: id,
    className: rangeMode === id ? 'on' : '',
    onClick: () => setRangeMode(id)
  }, l))))), tooFew ? React.createElement("div", {
    className: "card",
    style: {
      padding: '48px 20px',
      textAlign: 'center'
    }
  }, React.createElement("div", {
    style: {
      width: 56,
      height: 56,
      borderRadius: 15,
      background: 'var(--blue-50)',
      color: 'var(--blue)',
      display: 'grid',
      placeItems: 'center',
      margin: '0 auto 14px'
    }
  }, React.createElement(Ic, {
    d: I.layers,
    s: 28
  })), React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 700
    }
  }, "Pick at least 2 departments"), React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--muted)',
      marginTop: 6
    }
  }, "Select two or more departments above to compare them side by side.")) : React.createElement(React.Fragment, null, React.createElement("div", {
    className: "grid",
    style: {
      gridTemplateColumns: `repeat(${Math.min(stats.length, 3)},1fr)`
    }
  }, stats.map(st => {
    const dcls = st.delta > 0 ? 'pos' : st.delta < 0 ? 'neg' : 'flat';
    const dcol = st.delta > 0 ? 'var(--pos)' : st.delta < 0 ? 'var(--rose)' : 'var(--slate)';
    const dsym = st.delta > 0 ? '▲' : st.delta < 0 ? '▼' : '—';
    return React.createElement("div", {
      key: st.d.id,
      className: "card",
      onClick: () => openDept(st.d.id),
      title: `Open ${st.d.name}`,
      style: {
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        cursor: 'pointer',
        borderTop: '3px solid ' + st.tone
      }
    }, React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 9
      }
    }, React.createElement("div", {
      style: {
        width: 32,
        height: 32,
        borderRadius: 9,
        background: st.tone + '1c',
        color: st.tone,
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0
      }
    }, React.createElement(Ic, {
      d: DEPT_ICON[st.d.id] || I.activity,
      s: 17
    })), React.createElement("div", {
      style: {
        minWidth: 0
      }
    }, React.createElement("div", {
      style: {
        fontSize: 13,
        fontWeight: 700,
        color: 'var(--ink)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, st.d.short), React.createElement("div", {
      style: {
        fontSize: 10.5,
        color: 'var(--muted)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, st.d.name)), React.createElement("span", {
      className: "spacer"
    }), React.createElement(Ic, {
      d: I.arrowR,
      s: 15,
      c: "var(--faint)"
    })), st.empty ? React.createElement("div", {
      style: {
        fontSize: 12,
        color: 'var(--faint)',
        padding: '8px 0'
      }
    }, "No data in range") : React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'baseline',
        gap: 8
      }
    }, React.createElement("div", {
      className: "num",
      style: {
        fontSize: 26,
        fontWeight: 600,
        color: 'var(--ink)',
        lineHeight: 1
      }
    }, fmt(st.latest)), React.createElement("span", {
      className: 'chip ' + dcls
    }, dsym, " ", Math.abs(st.delta), "%")), React.createElement("div", {
      style: {
        display: 'flex',
        gap: 14,
        fontSize: 11,
        color: 'var(--faint)'
      }
    }, React.createElement("span", null, "Latest \xB7 ", st.latestMonth), React.createElement("span", {
      className: "spacer"
    }), React.createElement("span", null, "Avg ", React.createElement("b", {
      className: "num",
      style: {
        color: 'var(--ink-2)'
      }
    }, fmt(st.avg))))));
  })), React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, metricLabel, " \u2014 Monthly Comparison"), React.createElement("span", {
    className: "sub"
  }, rangeNote), React.createElement("span", {
    className: "spacer"
  }), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      flexWrap: 'wrap',
      justifyContent: 'flex-end'
    }
  }, chartSeries.map(s => React.createElement("span", {
    key: s.id,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 11.5,
      color: 'var(--ink-2)',
      fontWeight: 600
    }
  }, React.createElement("i", {
    style: {
      width: 10,
      height: 10,
      borderRadius: 3,
      background: s.color,
      display: 'inline-block'
    }
  }), s.label)))), React.createElement("div", {
    className: "card-b"
  }, chartData.length === 0 ? React.createElement("div", {
    style: {
      display: 'grid',
      placeItems: 'center',
      minHeight: 200,
      color: 'var(--faint)',
      fontSize: 13
    }
  }, "No data available for the selected range.") : React.createElement(GroupedBar, {
    data: chartData,
    x: "month",
    series: chartSeries,
    height: 300
  }))), React.createElement("div", {
    className: "card",
    style: {
      overflow: 'hidden'
    }
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, "Comparison Table"), React.createElement("span", {
    className: "sub"
  }, metricLabel, " \xB7 ", rangeNote, " \xB7 click a row to open")), React.createElement("div", {
    style: {
      overflowX: 'auto'
    }
  }, React.createElement("table", {
    className: "tbl"
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Department"), React.createElement("th", null, "Metric"), React.createElement("th", null, "Latest"), React.createElement("th", null, "Average"), React.createElement("th", null, "Peak"), React.createElement("th", null, "\u0394 vs prev"), React.createElement("th", null, "Total"))), React.createElement("tbody", null, stats.map(st => {
    const dcls = st.delta > 0 ? 'pos' : st.delta < 0 ? 'neg' : 'flat';
    const dsym = st.delta > 0 ? '▲' : st.delta < 0 ? '▼' : '—';
    const colLabel = (st.d.cols || []).find(c => c.id === st.k)?.label || st.k;
    return React.createElement("tr", {
      key: st.d.id,
      style: {
        cursor: 'pointer'
      },
      onClick: () => openDept(st.d.id)
    }, React.createElement("td", null, React.createElement("span", {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8
      }
    }, React.createElement("i", {
      style: {
        width: 9,
        height: 9,
        borderRadius: 3,
        background: st.tone,
        display: 'inline-block'
      }
    }), st.d.name)), React.createElement("td", {
      style: {
        fontFamily: "'IBM Plex Sans'",
        color: 'var(--muted)'
      }
    }, colLabel), React.createElement("td", null, st.empty ? '–' : fmt(st.latest)), React.createElement("td", null, st.empty ? '–' : fmt(st.avg)), React.createElement("td", null, st.empty ? '–' : fmt(st.peak)), React.createElement("td", null, st.empty ? '–' : React.createElement("span", {
      className: 'chip ' + dcls
    }, dsym, " ", Math.abs(st.delta), "%")), React.createElement("td", null, st.empty ? '–' : fmt(st.total)));
  })))))));
}
window.DeptCompare = DeptCompare;
})();
;
/* ===== manage.jsx ===== */
(function(){
function slug(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'col';
}
function DeptModal({
  initial,
  onClose,
  onSave,
  groups,
  entries
}) {
  const editing = !!initial;
  const [name, setName] = React.useState(initial?.name || '');
  const [short, setShort] = React.useState(initial?.short || '');
  const [group, setGroup] = React.useState(initial?.group || groups[0]);
  const [desc, setDesc] = React.useState(initial?.desc || '');
  const [cols, setCols] = React.useState(() => initial?.cols?.map(c => ({
    id: c.id,
    label: c.label,
    pct: !!c.pct
  })) || [{
    label: 'Patients',
    pct: false
  }]);
  const [err, setErr] = React.useState('');
  const [dragIdx, setDragIdx] = React.useState(null);
  const [overIdx, setOverIdx] = React.useState(null);
  const addCol = () => setCols(c => [...c, {
    label: '',
    pct: false
  }]);
  const setCol = (i, patch) => setCols(c => c.map((x, j) => j === i ? {
    ...x,
    ...patch
  } : x));
  const rmCol = i => setCols(c => c.filter((_, j) => j !== i));
  const moveCol = (from, to) => {
    if (from == null || to == null || from === to) return;
    setCols(cs => {
      const a = cs.slice();
      const [m] = a.splice(from, 1);
      a.splice(to, 0, m);
      return a;
    });
  };
  const endDrag = () => {
    setDragIdx(null);
    setOverIdx(null);
  };
  const save = () => {
    if (!name.trim()) {
      setErr('Department name is required');
      return;
    }
    const clean = cols.filter(c => c.label.trim());
    if (!clean.length) {
      setErr('Add at least one metric column');
      return;
    }
    const used = new Set(clean.filter(c => c.id).map(c => c.id));
    if (editing) {
      const srv = (window.UNICO && window.UNICO.DEPARTMENTS || []).find(d => d.id === initial.id);
      [initial, srv].forEach(d => {
        if (!d) return;
        (d.cols || []).forEach(c => {
          if (c && c.id) used.add(c.id);
        });
        (d.data || []).forEach(r => {
          if (r) Object.keys(r).forEach(k => used.add(k));
        });
      });
      (entries || []).forEach(e => {
        if (e && e.dept === initial.id && e.row) Object.keys(e.row).forEach(k => used.add(k));
      });
    }
    const finalCols = clean.map(c => {
      if (c.id) return {
        id: c.id,
        label: c.label.trim(),
        pct: c.pct
      };
      let id = slug(c.label),
        b = id,
        k = 1;
      while (used.has(id)) {
        id = b + '_' + ++k;
      }
      used.add(id);
      return {
        id,
        label: c.label.trim(),
        pct: c.pct
      };
    });
    const primaryCol = editing && finalCols.find(c => c.id === initial.primary) || finalCols[0];
    const def = {
      id: initial?.id || 'cust_' + Date.now().toString(36),
      name: name.trim(),
      short: short.trim() || name.trim().slice(0, 5),
      group: group.trim() || 'Custom',
      desc: desc.trim() || 'Custom department added in-app.',
      cols: finalCols,
      primary: primaryCol.id,
      primaryLabel: primaryCol.label,
      months: initial?.months || [],
      data: initial?.data || []
    };
    onSave(def, editing);
  };
  const toBody = n => typeof window !== 'undefined' && window.ReactDOM && window.ReactDOM.createPortal && typeof document !== 'undefined' ? window.ReactDOM.createPortal(n, document.body) : n;
  return toBody(React.createElement("div", {
    className: "modal-bg",
    onMouseDown: e => {
      if (e.target === e.currentTarget) onClose();
    }
  }, React.createElement("div", {
    className: "modal"
  }, React.createElement("div", {
    className: "modal-h"
  }, React.createElement("div", {
    style: {
      width: 30,
      height: 30,
      borderRadius: 8,
      background: 'var(--blue-50)',
      color: 'var(--blue)',
      display: 'grid',
      placeItems: 'center'
    }
  }, React.createElement(Ic, {
    d: editing ? I.edit : I.plus,
    s: 17
  })), React.createElement("h3", null, editing ? 'Edit Department' : 'New Department'), React.createElement("span", {
    className: "spacer"
  }), React.createElement("button", {
    className: "icon-btn",
    onClick: onClose
  }, React.createElement(Ic, {
    d: I.x,
    s: 16
  }))), React.createElement("div", {
    style: {
      padding: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '2fr 1fr',
      gap: 12
    }
  }, React.createElement("div", {
    className: "field"
  }, React.createElement("label", null, "Department name"), React.createElement("input", {
    value: name,
    onChange: e => setName(e.target.value),
    placeholder: "e.g. Physiotherapy",
    autoFocus: true
  })), React.createElement("div", {
    className: "field"
  }, React.createElement("label", null, "Code / short"), React.createElement("input", {
    value: short,
    onChange: e => setShort(e.target.value),
    placeholder: "e.g. PHYSIO",
    maxLength: 8
  }))), React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 12
    }
  }, React.createElement("div", {
    className: "field"
  }, React.createElement("label", null, "Service line"), React.createElement("input", {
    list: "grp-list",
    value: group,
    onChange: e => setGroup(e.target.value),
    placeholder: "Service line"
  }), React.createElement("datalist", {
    id: "grp-list"
  }, groups.map(g => React.createElement("option", {
    key: g,
    value: g
  })))), React.createElement("div", {
    className: "field"
  }, React.createElement("label", null, "Short description"), React.createElement("input", {
    value: desc,
    onChange: e => setDesc(e.target.value),
    placeholder: "What this department tracks"
  }))), React.createElement("div", null, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      marginBottom: 8
    }
  }, React.createElement("div", {
    style: {
      fontSize: 12.5,
      fontWeight: 700,
      color: 'var(--ink)'
    }
  }, "Custom metrics"), React.createElement("span", {
    style: {
      fontSize: 11,
      color: 'var(--muted)',
      marginLeft: 8
    }
  }, "drag ", React.createElement(Ic, {
    d: I.grip,
    s: 11,
    style: {
      verticalAlign: '-1px',
      opacity: .7
    }
  }), " to reorder \xB7 first metric is the headline figure"), React.createElement("span", {
    className: "spacer",
    style: {
      flex: 1
    }
  }), React.createElement("button", {
    className: "btn sm",
    onClick: addCol
  }, React.createElement(Ic, {
    d: I.plus,
    s: 14
  }), "Add metric")), React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, cols.map((c, i) => React.createElement("div", {
    key: i,
    onDragOver: e => {
      if (dragIdx == null) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (overIdx !== i) setOverIdx(i);
    },
    onDrop: e => {
      e.preventDefault();
      moveCol(dragIdx, i);
      endDrag();
    },
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      padding: '2px 4px',
      borderRadius: 8,
      transition: 'background .12s,box-shadow .12s',
      background: overIdx === i && dragIdx != null && dragIdx !== i ? 'var(--blue-50)' : 'transparent',
      boxShadow: overIdx === i && dragIdx != null && dragIdx !== i ? 'inset 0 0 0 1px var(--blue)' : 'none',
      opacity: dragIdx === i ? .45 : 1
    }
  }, React.createElement("span", {
    title: "Drag to reorder",
    draggable: true,
    onDragStart: e => {
      setDragIdx(i);
      e.dataTransfer.effectAllowed = 'move';
      try {
        e.dataTransfer.setData('text/plain', String(i));
      } catch (_) {}
    },
    onDragEnd: endDrag,
    style: {
      cursor: 'grab',
      color: 'var(--muted)',
      display: 'grid',
      placeItems: 'center',
      flexShrink: 0,
      touchAction: 'none'
    }
  }, React.createElement(Ic, {
    d: I.grip,
    s: 16,
    sw: 2.6
  })), React.createElement("span", {
    style: {
      width: 22,
      height: 22,
      borderRadius: 6,
      display: 'grid',
      placeItems: 'center',
      fontSize: 11,
      fontWeight: 700,
      background: i === 0 ? 'var(--blue)' : 'var(--panel-2)',
      color: i === 0 ? '#fff' : 'var(--muted)',
      flexShrink: 0
    }
  }, i + 1), React.createElement("input", {
    value: c.label,
    onChange: e => setCol(i, {
      label: e.target.value
    }),
    placeholder: i === 0 ? 'Primary metric (e.g. Total Patients)' : 'Metric name',
    style: {
      flex: 1,
      padding: '8px 11px',
      border: '1px solid var(--line)',
      borderRadius: 7,
      fontSize: 13,
      fontFamily: 'inherit',
      outline: 'none'
    }
  }), React.createElement("label", {
    className: "col-chip",
    style: {
      cursor: 'pointer'
    }
  }, React.createElement("input", {
    type: "checkbox",
    checked: c.pct,
    onChange: e => setCol(i, {
      pct: e.target.checked
    }),
    style: {
      margin: 0
    }
  }), "%"), React.createElement("button", {
    className: "icon-btn danger",
    onClick: () => rmCol(i),
    disabled: cols.length <= 1,
    style: {
      opacity: cols.length <= 1 ? .4 : 1
    }
  }, React.createElement(Ic, {
    d: I.x,
    s: 14
  })))))), err && React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--rose)',
      fontWeight: 600
    }
  }, err), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      borderTop: '1px solid var(--line-2)',
      paddingTop: 14
    }
  }, React.createElement("span", {
    className: "spacer",
    style: {
      flex: 1
    }
  }), React.createElement("button", {
    className: "btn",
    onClick: onClose
  }, "Cancel"), React.createElement("button", {
    className: "btn pri",
    onClick: save
  }, React.createElement(Ic, {
    d: I.check,
    s: 16,
    sw: 2.4
  }), editing ? 'Save changes' : 'Create department'))))));
}
function ConfirmModal({
  title,
  body,
  danger,
  onClose,
  onConfirm
}) {
  const toBody = n => typeof window !== 'undefined' && window.ReactDOM && window.ReactDOM.createPortal && typeof document !== 'undefined' ? window.ReactDOM.createPortal(n, document.body) : n;
  return toBody(React.createElement("div", {
    className: "modal-bg",
    onMouseDown: e => {
      if (e.target === e.currentTarget) onClose();
    }
  }, React.createElement("div", {
    className: "modal",
    style: {
      width: 'min(420px,92vw)'
    }
  }, React.createElement("div", {
    style: {
      padding: '22px 22px 18px'
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      alignItems: 'flex-start'
    }
  }, React.createElement("div", {
    style: {
      width: 38,
      height: 38,
      borderRadius: 10,
      background: 'var(--neg-bg)',
      color: 'var(--rose)',
      display: 'grid',
      placeItems: 'center',
      flexShrink: 0
    }
  }, React.createElement(Ic, {
    d: I.x,
    s: 20,
    sw: 2.4
  })), React.createElement("div", null, React.createElement("div", {
    style: {
      fontSize: 15.5,
      fontWeight: 700
    }
  }, title), React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--muted)',
      marginTop: 4
    }
  }, body))), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      marginTop: 20
    }
  }, React.createElement("span", {
    className: "spacer",
    style: {
      flex: 1
    }
  }), React.createElement("button", {
    className: "btn",
    onClick: onClose
  }, "Cancel"), React.createElement("button", {
    className: "btn pri",
    style: {
      background: 'var(--rose)',
      borderColor: 'var(--rose)',
      boxShadow: 'none'
    },
    onClick: onConfirm
  }, "Delete"))))));
}
function ManageDepts({
  depts,
  store,
  setRoute
}) {
  const [modal, setModal] = React.useState(null);
  const [confirm, setConfirm] = React.useState(null);
  const groups = window.UNICO.GROUPS;
  const customCount = depts.filter(d => d.custom).length;
  const qByDept = React.useMemo(() => {
    const m = {};
    try {
      const areas = window.qualityData ? window.qualityData() : [];
      const qk = window.DEPTMAP ? window.DEPTMAP.qkFromId : null;
      const norm = s => String(s || '').trim().toLowerCase();
      depts.forEach(d => {
        const key = qk ? qk(d.id) : null;
        const area = areas.find(a => key && a.key === key || a.deptId === d.id || norm(a.name) === norm(d.name) || norm(a.key) === norm(d.id) || norm(a.key) === norm(d.short));
        m[d.id] = area ? (area.indicators || []).length : 0;
      });
    } catch (e) {}
    return m;
  }, [depts]);
  const totalInd = Object.keys(qByDept).reduce((s, k) => s + qByDept[k], 0);
  const onSave = (def, editing) => {
    if (editing) store.updateDept(def.id, {
      name: def.name,
      short: def.short,
      group: def.group,
      desc: def.desc,
      cols: def.cols,
      primary: def.primary,
      primaryLabel: def.primaryLabel
    });else store.addDept(def);
    setModal(null);
  };
  return React.createElement("div", {
    className: "grid",
    style: {
      gap: 16
    }
  }, React.createElement(SectionTitle, {
    icon: I.edit,
    title: "Manage Departments",
    sub: `${depts.length} departments · ${totalInd} quality indicators · ${customCount} custom — one place for statistics AND quality`,
    right: !window.unicoCan || window.unicoCan('stats', 'add') ? React.createElement("button", {
      className: "btn pri",
      onClick: () => setModal({
        type: 'add'
      })
    }, React.createElement(Ic, {
      d: I.plus,
      s: 16
    }), "Add Department") : null
  }), React.createElement("div", {
    className: "grid",
    style: {
      gap: 10
    }
  }, depts.map(d => {
    const tone = PALETTE[d.id.charCodeAt(0) % PALETTE.length];
    return React.createElement("div", {
      key: d.id,
      className: "dept-row"
    }, React.createElement("div", {
      style: {
        width: 38,
        height: 38,
        borderRadius: 10,
        background: tone + '18',
        color: tone,
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0
      }
    }, React.createElement(Ic, {
      d: DEPT_ICON[d.id] || I.activity,
      s: 19
    })), React.createElement("div", {
      style: {
        minWidth: 0,
        flex: 1
      }
    }, React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        minWidth: 0
      }
    }, React.createElement("span", {
      style: {
        fontSize: 14,
        fontWeight: 700,
        color: 'var(--ink)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, d.name), React.createElement("span", {
      className: "tag"
    }, d.short), d.custom && React.createElement("span", {
      className: "tag",
      style: {
        background: 'var(--pos-bg)',
        color: 'var(--pos)'
      }
    }, "Custom")), React.createElement("div", {
      style: {
        fontSize: 11.5,
        color: 'var(--muted)',
        marginTop: 2
      }
    }, d.group, " \xB7 ", d.cols.length, " metric", d.cols.length > 1 ? 's' : '', " \xB7 ", React.createElement("span", {
      style: {
        color: '#6a52d4',
        fontWeight: 600
      }
    }, qByDept[d.id] || 0, " quality indicator", (qByDept[d.id] || 0) === 1 ? '' : 's'), " \xB7 ", d.series.length, " month", d.series.length !== 1 ? 's' : '')), React.createElement("div", {
      style: {
        display: 'flex',
        gap: 6,
        flexWrap: 'wrap',
        maxWidth: 280,
        justifyContent: 'flex-end'
      }
    }, d.cols.slice(0, 4).map(c => React.createElement("span", {
      key: c.id,
      className: "col-chip"
    }, c.label)), d.cols.length > 4 && React.createElement("span", {
      className: "col-chip"
    }, "+", d.cols.length - 4)), React.createElement("div", {
      style: {
        display: 'flex',
        gap: 6,
        flexShrink: 0
      }
    }, React.createElement("button", {
      className: "btn sm",
      title: "Enter statistics data",
      onClick: () => setRoute({
        view: 'input',
        dept: d.id
      })
    }, React.createElement(Ic, {
      d: I.plus,
      s: 14
    }), "Data"), React.createElement("button", {
      className: "btn sm",
      title: "Manage quality indicators",
      onClick: () => setRoute({
        view: 'qualityManage',
        dept: window.DEPTMAP && window.DEPTMAP.qkFromId(d.id) || d.id
      })
    }, React.createElement(Ic, {
      d: I.heart,
      s: 14
    }), "Quality"), (!window.unicoCan || window.unicoCan('stats', 'edit')) && React.createElement("button", {
      className: "icon-btn",
      title: "Rename / edit metrics",
      onClick: () => setModal({
        type: 'edit',
        dept: d
      })
    }, React.createElement(Ic, {
      d: I.edit,
      s: 15
    })), (!window.unicoCan || window.unicoCan('stats', 'delete')) && React.createElement("button", {
      className: "icon-btn danger",
      title: "Delete",
      onClick: () => setConfirm(d)
    }, React.createElement(Ic, {
      d: I.x,
      s: 15
    }))));
  })), React.createElement("div", {
    className: "card feature",
    style: {
      padding: '16px 18px',
      display: 'flex',
      alignItems: 'center',
      gap: 14
    }
  }, React.createElement("div", {
    style: {
      width: 38,
      height: 38,
      borderRadius: 10,
      background: 'var(--blue-50)',
      color: 'var(--blue)',
      display: 'grid',
      placeItems: 'center'
    }
  }, React.createElement(Ic, {
    d: I.plus,
    s: 20
  })), React.createElement("div", null, React.createElement("div", {
    style: {
      fontSize: 13.5,
      fontWeight: 700
    }
  }, "Add a new department with custom metrics"), React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--muted)'
    }
  }, "Define your own fields \u2014 e.g. Physiotherapy, Blood Bank, Pharmacy \u2014 then capture data in the Data Entry module.")), React.createElement("span", {
    className: "spacer"
  }), (!window.unicoCan || window.unicoCan('stats', 'add')) && React.createElement("button", {
    className: "btn pri",
    onClick: () => setModal({
      type: 'add'
    })
  }, React.createElement(Ic, {
    d: I.plus,
    s: 16
  }), "New Department")), store.undeleteDept && (store.deletedIds || []).length > 0 && (!window.unicoCan || window.unicoCan('stats', 'edit')) && React.createElement("div", {
    className: "card",
    style: {
      padding: '12px 16px',
      marginTop: 14,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      flexWrap: 'wrap'
    }
  }, React.createElement("b", {
    style: {
      fontSize: 13
    }
  }, "Hidden departments"), React.createElement("span", {
    style: {
      fontSize: 12,
      color: 'var(--muted)'
    }
  }, "Their data is still saved."), (store.deletedIds || []).map(id => {
    const src = (window.UNICO.DEPARTMENTS || []).find(x => x.id === id);
    return React.createElement("button", {
      key: id,
      className: "btn sm",
      onClick: () => {
        store.undeleteDept(id);
        window.UI && window.UI.toast(`${src && src.name || id} restored`, 'success');
      }
    }, React.createElement(Ic, {
      d: I.check,
      s: 13
    }), "Restore ", src && (src.short || src.name) || id);
  })), modal && React.createElement(DeptModal, {
    initial: modal.type === 'edit' ? modal.dept : null,
    groups: groups,
    entries: store.entries,
    onClose: () => setModal(null),
    onSave: onSave
  }), confirm && React.createElement(ConfirmModal, {
    title: `Delete ${confirm.name}?`,
    danger: true,
    body: confirm.custom ? 'This custom department and its entered data will be permanently removed.' : 'This built-in department will be hidden from the platform. Its saved data is not deleted — an administrator can restore the department.',
    onClose: () => setConfirm(null),
    onConfirm: () => {
      store.deleteDept(confirm.id);
      setConfirm(null);
    }
  }));
}
window.ManageDepts = ManageDepts;
})();
;
/* ===== staff.jsx ===== */
(function(){
const VACC_TONE = {
  "Completed": "pos",
  "3rd Dose": "pos",
  "2nd Dose": "warn",
  "1st Dose": "warn",
  "Not Completed": "neg",
  "Unknown": "flat"
};
function vaccCanon(s) {
  return window.STAFF && window.STAFF.canonVacc ? window.STAFF.canonVacc(s) : s || 'Unknown';
}
function vaccOK(s) {
  return (window.STAFF && window.STAFF.VACC_OK || ['Completed', '3rd Dose']).includes(vaccCanon(s));
}
function vaccColor(s) {
  const t = VACC_TONE[vaccCanon(s)] || "flat";
  return t === 'pos' ? '#1f9d57' : t === 'warn' ? '#e08a1e' : t === 'neg' ? '#d23a52' : '#8a93a3';
}
function VaccBadge({
  status
}) {
  const cs = vaccCanon(status),
    c = vaccColor(status);
  return React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      fontSize: 11,
      fontWeight: 600,
      padding: '2px 9px',
      borderRadius: 20,
      color: c,
      background: c + '1c'
    }
  }, React.createElement("i", {
    style: {
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: c
    }
  }), cs);
}
function Avatar({
  name,
  size = 34,
  fontSize,
  photo
}) {
  const [dead, setDead] = React.useState(false);
  React.useEffect(() => {
    setDead(false);
  }, [photo && photo.url]);
  const parts = (name || '?').split(' ');
  const ini = (parts[0][0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '');
  let h = 0;
  for (const ch of name || '') h = (h * 31 + ch.charCodeAt(0)) % 360;
  const box = {
    width: size,
    height: size,
    borderRadius: '50%',
    flexShrink: 0
  };
  if (photo && photo.url && !dead) {
    const src = window.MK && window.MK.cdnPhoto ? window.MK.cdnPhoto(photo.url, size) : photo.url;
    return React.createElement("img", {
      src: src,
      alt: ini.toUpperCase(),
      title: name || '',
      onError: () => setDead(true),
      loading: "lazy",
      decoding: "async",
      style: {
        ...box,
        objectFit: 'cover',
        display: 'block',
        background: '#e8eef5'
      }
    });
  }
  return React.createElement("div", {
    style: {
      ...box,
      display: 'grid',
      placeItems: 'center',
      fontSize: fontSize || size * 0.4,
      fontWeight: 700,
      color: '#fff',
      background: `linear-gradient(135deg,hsl(${h} 60% 52%),hsl(${(h + 40) % 360} 62% 42%))`
    }
  }, ini.toUpperCase());
}
function RoleBadge({
  role
}) {
  const pca = role === 'PCA';
  const c = pca ? '#6a52d4' : '#0090ca';
  return React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      fontSize: 10.5,
      fontWeight: 700,
      padding: '2px 8px',
      borderRadius: 5,
      color: c,
      background: c + '16',
      letterSpacing: .3
    }
  }, role || 'Nurse');
}
function RoleSwitch({
  role,
  setRoute,
  views
}) {
  return React.createElement("div", {
    className: "seg",
    style: {
      flexShrink: 0
    },
    title: "Nurses or PCA"
  }, [['Nurse', 'Nurses'], ['PCA', 'PCA']].map(([v, l]) => React.createElement("button", {
    key: v,
    className: role === v ? 'on' : '',
    onClick: () => {
      if (role !== v) setRoute({
        view: views[v]
      });
    }
  }, l)));
}
const APPR_SHARED = {
  at: 0,
  inflight: null,
  data: null
};
function apprCanSee() {
  try {
    return window.unicoCan ? window.unicoCan('perf', 'view') : true;
  } catch (e) {
    return true;
  }
}
function apprCanEdit() {
  try {
    return window.unicoCan ? window.unicoCan('perf', 'edit') : true;
  } catch (e) {
    return true;
  }
}
function useStaffAppraisals() {
  const [, bump] = React.useState(0);
  React.useEffect(() => {
    if (!apprCanSee()) return;
    if (APPR_SHARED.data && Date.now() - APPR_SHARED.at < 30000) return;
    let live = true;
    if (!APPR_SHARED.inflight) {
      APPR_SHARED.inflight = fetch('/api/performance', {
        credentials: 'same-origin',
        headers: {
          accept: 'application/json'
        }
      }).then(r => r.json()).then(j => {
        APPR_SHARED.data = j && j.ok ? j : {
          appraisals: [],
          incidents: [],
          achievements: []
        };
        APPR_SHARED.at = Date.now();
      }).catch(() => {
        APPR_SHARED.data = {
          appraisals: [],
          incidents: [],
          achievements: []
        };
        APPR_SHARED.at = Date.now();
      }).then(() => {
        APPR_SHARED.inflight = null;
      });
    }
    APPR_SHARED.inflight.then(() => {
      if (live) bump(n => n + 1);
    });
    return () => {
      live = false;
    };
  });
  if (!apprCanSee()) return null;
  return APPR_SHARED.data;
}
const APPR_STATUS = {
  none: {
    label: 'Not started',
    c: '#8a93a3'
  },
  draft: {
    label: 'In progress',
    c: '#e08a1e'
  },
  submitted: {
    label: 'Scored',
    c: '#0090ca'
  },
  discussed: {
    label: 'Discussed',
    c: '#6a52d4'
  },
  actioned: {
    label: 'Completed',
    c: '#1f9d57'
  }
};
function ApprCell({
  st
}) {
  if (!st) return React.createElement("span", {
    style: {
      color: 'var(--faint)'
    }
  }, "\u2014");
  const meta = APPR_STATUS[st.status] || APPR_STATUS.none;
  const c = st.overdue ? '#d23a52' : meta.c;
  const label = st.overdue && st.status === 'none' ? 'Overdue' : meta.label;
  return React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      whiteSpace: 'nowrap'
    }
  }, React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      fontSize: 11,
      fontWeight: 600,
      padding: '2px 9px',
      borderRadius: 20,
      color: c,
      background: c + '1c'
    }
  }, React.createElement("i", {
    style: {
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: c
    }
  }), label), st.last && React.createElement("span", {
    className: "num",
    style: {
      fontSize: 11.5,
      fontWeight: 700,
      color: 'var(--ink-2)'
    },
    title: 'Last filed: ' + (st.last.cycleLabel || '')
  }, st.last.grade || '', " ", st.last.score == null ? '' : st.last.score));
}
const STAFF_EXPORT_COLS = [['Emp ID', 'emp_id'], ['Name', 'name'], ['Role', 'role'], ['Designation', 'designation'], ['Department', 'current_department'], ['Qualification', 'qualification'], ['DOJ', 'doj'], ['Experience', 'total_experience_text'], ['Special Training', 'special_training'], ['Extracurricular Activities', 'extracurricular'], ['Hep-B Vaccination', 'hepatitis_b_vaccination'], ['Phone', 'phone'], ['Remarks', 'remarks']];
function esc(v) {
  return ((v == null ? '' : v) + '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function downloadBlob(content, filename, mime) {
  const blob = new Blob([content], {
    type: mime
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 600);
}
function staffTableHTML(rows) {
  const th = STAFF_EXPORT_COLS.map(c => `<th style="background:#0090ca;color:#fff;border:1px solid #2b6f9c;padding:6px 8px;font-family:Calibri,Arial,sans-serif;text-align:left;font-size:11pt">${c[0]}</th>`).join('');
  const trs = rows.map((e, i) => `<tr style="background:${i % 2 ? '#eef6fb' : '#ffffff'}">${STAFF_EXPORT_COLS.map(c => `<td style="border:1px solid #b9c6d2;padding:5px 8px;font-family:Calibri,Arial,sans-serif;font-size:10.5pt">${esc(e[c[1]])}</td>`).join('')}</tr>`).join('');
  return `<table border="1" style="border-collapse:collapse"><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`;
}
function exportStaff(rows, role, fmt) {
  const date = new Date().toISOString().slice(0, 10);
  const title = `UNICO Hospitals — ${role} Roster`;
  const base = `UNICO-${role}-roster-${date}`;
  if (fmt === 'csv') {
    const head = STAFF_EXPORT_COLS.map(c => `"${c[0]}"`).join(',');
    const body = rows.map(e => STAFF_EXPORT_COLS.map(c => `"${((e[c[1]] == null ? '' : e[c[1]]) + '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    downloadBlob('\uFEFF' + head + '\r\n' + body, base + '.csv', 'text/csv;charset=utf-8');
  } else if (fmt === 'excel') {
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>${role}</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body><h3 style="font-family:Calibri">${title} — ${rows.length} ${role}(s)</h3>${staffTableHTML(rows)}</body></html>`;
    downloadBlob(html, base + '.xls', 'application/vnd.ms-excel');
  } else if (fmt === 'word') {
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${title}</title><style>@page{size:A4 landscape;margin:1.2cm}</style></head><body><h2 style="font-family:Calibri;color:#0072a3;margin-bottom:2px">${title}</h2><p style="font-family:Calibri;color:#555;margin-top:0">Generated ${date} · ${rows.length} ${role}(s)</p>${staffTableHTML(rows)}</body></html>`;
    downloadBlob(html, base + '.doc', 'application/msword');
  } else if (fmt === 'pdf') {
    const root = document.getElementById('pdf-root');
    const native = window.unicoNative;
    if (!root || !native || typeof native.exportPDF !== 'function') {
      try {
        document.body.classList.add('pdf-export-mode');
        window.print();
      } catch (e) {} finally {
        setTimeout(() => document.body.classList.remove('pdf-export-mode'), 500);
      }
      return;
    }
    root.innerHTML = `<div class="pdf-page" style="padding:10mm 11mm;font-family:'IBM Plex Sans',Arial,sans-serif;color:#16202e"><h2 style="color:#0072a3;margin:0 0 2px;font-size:18px">${title}</h2><div style="color:#8a93a3;font-size:10.5px;margin-bottom:10px">Generated ${date} · ${rows.length} ${role}(s) · Confidential</div>${staffTableHTML(rows)}</div>`;
    document.body.classList.add('pdf-export-mode');
    Promise.resolve(native.exportPDF({
      pageSize: 'A4',
      landscape: true,
      defaultName: base
    })).catch(() => {}).then(() => {
      root.innerHTML = '';
      document.body.classList.remove('pdf-export-mode');
    });
  }
}
function ExportMenu({
  rows,
  role
}) {
  const [open, setOpen] = React.useState(false);
  return React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, React.createElement("button", {
    className: "btn sm",
    onClick: () => setOpen(o => !o)
  }, React.createElement(Ic, {
    d: I.download,
    s: 14
  }), "Export \u25BE"), open && React.createElement("div", {
    onMouseLeave: () => setOpen(false),
    style: {
      position: 'absolute',
      right: 0,
      top: '112%',
      zIndex: 60,
      background: 'rgba(255,255,255,.88)',
      backdropFilter: 'blur(24px) saturate(1.6)',
      WebkitBackdropFilter: 'blur(24px) saturate(1.6)',
      border: '1px solid rgba(255,255,255,.92)',
      boxShadow: '0 22px 56px rgba(31,59,90,.26)',
      borderRadius: 10,
      minWidth: 172,
      overflow: 'hidden',
      padding: 4
    }
  }, React.createElement("div", {
    style: {
      fontSize: 10,
      color: 'var(--faint)',
      textTransform: 'uppercase',
      letterSpacing: .4,
      padding: '6px 9px 3px',
      fontWeight: 700
    }
  }, "Export ", rows.length, " ", role, "(s)"), [['pdf', 'PDF document (.pdf)', I.doc], ['excel', 'Microsoft Excel (.xls)', I.grid], ['word', 'Microsoft Word (.doc)', I.doc], ['csv', 'CSV (.csv)', I.doc]].map(([f, l, ic]) => React.createElement("div", {
    key: f,
    onClick: () => {
      exportStaff(rows, role, f);
      setOpen(false);
    },
    style: {
      padding: '8px 10px',
      fontSize: 12.5,
      cursor: 'pointer',
      display: 'flex',
      gap: 9,
      alignItems: 'center',
      borderRadius: 6,
      color: 'var(--ink-2)',
      fontWeight: 500
    },
    onMouseEnter: e => e.currentTarget.style.background = 'var(--blue-50)',
    onMouseLeave: e => e.currentTarget.style.background = 'transparent'
  }, React.createElement(Ic, {
    d: ic,
    s: 15,
    c: "var(--blue)"
  }), l))));
}
function staffShortCanon(raw) {
  const S = window.STAFF;
  const DEPTS = S && S.DEPARTMENTS || [];
  const DESIGS = S && S.DESIGNATIONS || [];
  const s = String(raw || '').trim();
  if (!s) return 'Unassigned';
  const lc = s.toLowerCase();
  for (const d of DEPTS) {
    if (d.toLowerCase() === lc) return d;
  }
  const norm = s.replace(/[.,;/]+/g, ' ').replace(/\s+/g, ' ').trim();
  const nl = norm.toLowerCase();
  const padded = ' ' + nl + ' ';
  const ALIAS = {
    emergency: 'ER',
    cticu: 'CT ICU',
    'ct icu': 'CT ICU',
    'cardiac icu': 'CT ICU',
    'ctvs icu': 'CT ICU',
    homecare: 'HomeCare',
    'home care': 'HomeCare',
    'family medicine': 'HomeCare',
    daycare: 'DayCare',
    'day care': 'DayCare'
  };
  if (ALIAS[nl]) return ALIAS[nl];
  const esc = x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const sorted = [...DEPTS].sort((a, b) => b.length - a.length);
  for (const d of sorted) {
    if (new RegExp('(^| )' + esc(d.toLowerCase()) + '( |$)').test(padded)) return d;
  }
  if (/training\s*(and|&)\s*development/.test(nl)) return 'Training & Development';
  if (/infection\s*(prevention|control)/.test(nl)) return 'Infection Control';
  const lvl = nl.match(/level\s*-?\s*(\d+)/);
  if (lvl) return 'Level-' + lvl[1];
  if (/cath\s*lab/.test(nl)) return 'Cath Lab';
  if (DESIGS.some(g => {
    const gl = g.toLowerCase();
    return nl === gl || new RegExp('(^| )' + esc(gl) + '( |$)').test(padded);
  })) return 'Unassigned';
  return s;
}
let _staffStatsCache = null,
  _staffStatsKey = null;
function staffStatsList() {
  try {
    if (!window.buildDepts) return null;
    const rawOv = localStorage.getItem('unico_store_v3') || '';
    if (_staffStatsKey === rawOv && _staffStatsCache) return _staffStatsCache;
    const m = window.buildDepts(JSON.parse(rawOv || '{}') || {});
    if (Array.isArray(m) && m.length) {
      _staffStatsKey = rawOv;
      _staffStatsCache = m;
      return m;
    }
  } catch (e) {}
  return null;
}
function staffStatsName(raw) {
  const list = staffStatsList();
  if (!list) return null;
  const v = String(raw || '').trim();
  if (!v || v === 'Unassigned') return null;
  const lc = v.toLowerCase();
  const d = list.find(x => [x.name, x.id, x.key, x.short].some(a => String(a || '').trim().toLowerCase() === lc));
  return d ? d.name : null;
}
function staffCanonDept(raw) {
  const short = staffShortCanon(raw);
  return staffStatsName(raw) || staffStatsName(short) || short;
}
const STAFF_DEPT_FULL = {
  'ER': 'Emergency (ER)',
  'OPD': 'Outpatient Department (OPD)',
  'NICU': 'Neonatal ICU (NICU)',
  'MICU': 'Medical ICU (MICU)',
  'SICU': 'Surgical ICU (SICU)',
  'CCU': 'Coronary Care Unit (CCU)',
  'CT ICU': 'Cardiac ICU (CT ICU)',
  'CT OT': 'Cardiac Operation Theatre (CT OT)',
  'LDR': 'Labour, Delivery & Recovery (LDR)',
  'Cath Lab': 'Catheterization Lab',
  'General OT': 'General Operation Theatre',
  'Cardiac OT': 'Cardiac Operation Theatre',
  'HomeCare': 'Family Medicine',
  'DayCare': 'Day Care',
  'Level-9': 'Cabin Level 9',
  'Level-10': 'Cabin Level 10',
  'Level-11': 'Cabin Level 11'
};
function staffDeptLabel(n) {
  return STAFF_DEPT_FULL[n] || n;
}
function staffDeptShow(raw) {
  const parts = String(raw || '').split(',').map(x => x.trim()).filter(Boolean);
  const one = v => {
    const short = staffShortCanon(v);
    return staffStatsName(v) || staffStatsName(short) || staffDeptLabel(short);
  };
  if (parts.length > 1) return [...new Set(parts.map(one))].join(', ');
  return one(raw);
}
function staffCanonDesig(raw) {
  let s = String(raw || '').trim().replace(/\s+/g, ' ');
  if (!s) return '';
  s = s.replace(/satff/gi, 'Staff').replace(/\bsr\.?\b/gi, 'Senior').replace(/\bjr\.?\b/gi, 'Junior').replace(/incharge/gi, 'Incharge').replace(/\s+/g, ' ').trim();
  if (/in\s*charge nurse$/i.test(s)) return 'Charge Nurse';
  const DESIGS = window.STAFF && window.STAFF.DESIGNATIONS || [];
  const lc = s.toLowerCase();
  for (const d of DESIGS) {
    if (d.toLowerCase() === lc) return d;
  }
  return s;
}
if (typeof window !== 'undefined') {
  window.staffCanonDept = staffCanonDept;
  window.staffDeptLabel = staffDeptLabel;
  window.staffDeptShow = staffDeptShow;
  window.staffCanonDesig = staffCanonDesig;
}
function StaffDeptChart({
  list,
  setRoute,
  tone = '#0090ca',
  role = 'Nurse'
}) {
  const {
    useState,
    useEffect,
    useMemo
  } = React;
  const [q, setQ] = useState('');
  const [pick, setPick] = useState('');
  const [sortMode, setSortMode] = useState('count');
  const [mounted, setMounted] = useState(false);
  const [sel, setSel] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 30);
    return () => clearTimeout(t);
  }, []);
  const members = useMemo(() => {
    const m = {};
    list.forEach(e => {
      const parts = [...new Set(String(e.current_department || '').split(',').map(x => staffCanonDept(x.trim())).filter(Boolean))];
      (parts.length ? parts : ['Unassigned']).forEach(d => {
        (m[d] = m[d] || []).push(e);
      });
    });
    return m;
  }, [list]);
  const rows = Object.entries(members).map(([label, arr]) => ({
    label,
    value: arr.length
  }));
  const total = rows.reduce((s, r) => s + r.value, 0) || 1;
  const max = Math.max(1, ...rows.map(r => r.value));
  const noun = role === 'PCA' ? 'PCA' : 'nurses';
  const ql = q.trim().toLowerCase();
  let shown = rows.filter(r => (!ql || r.label.toLowerCase().includes(ql) || staffDeptLabel(r.label).toLowerCase().includes(ql)) && (!pick || r.label === pick));
  shown = sortMode === 'name' ? [...shown].sort((a, b) => staffDeptLabel(a.label).localeCompare(staffDeptLabel(b.label))) : [...shown].sort((a, b) => b.value - a.value);
  const tone2 = '#27a8db';
  const deptOptions = [...rows.map(r => r.label)].sort((a, b) => staffDeptLabel(a).localeCompare(staffDeptLabel(b)));
  const selSty = {
    padding: '6px 8px',
    border: '1px solid var(--line)',
    borderRadius: 7,
    fontSize: 11.5,
    fontFamily: 'inherit',
    background: '#fff',
    color: 'var(--ink-2)',
    maxWidth: 170
  };
  return React.createElement("div", {
    className: "card",
    style: {
      display: 'flex',
      flexDirection: 'column'
    }
  }, React.createElement("div", {
    className: "card-h",
    style: {
      flexWrap: 'wrap',
      gap: 8
    }
  }, React.createElement("h3", null, "Employees per Department"), React.createElement("span", {
    className: "sub"
  }, rows.length, " units \xB7 ", total, " ", noun), React.createElement("span", {
    className: "spacer"
  }), React.createElement("select", {
    value: pick,
    onChange: e => setPick(e.target.value),
    style: selSty,
    title: "Filter to a department"
  }, React.createElement("option", {
    value: ""
  }, "All departments"), deptOptions.map(d => React.createElement("option", {
    key: d,
    value: d
  }, staffDeptLabel(d)))), React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      background: 'var(--panel-2)',
      border: '1px solid var(--line)',
      borderRadius: 7,
      padding: '5px 9px',
      width: 128,
      color: 'var(--faint)'
    }
  }, React.createElement(Ic, {
    d: I.search,
    s: 13
  }), React.createElement("input", {
    value: q,
    onChange: e => setQ(e.target.value),
    placeholder: "Find unit\u2026",
    style: {
      border: 0,
      background: 'transparent',
      outline: 'none',
      fontFamily: 'inherit',
      fontSize: 12,
      color: 'var(--ink)',
      width: '100%'
    }
  })), React.createElement("div", {
    className: "seg"
  }, React.createElement("button", {
    className: sortMode === 'count' ? 'on' : '',
    onClick: () => setSortMode('count')
  }, "Count"), React.createElement("button", {
    className: sortMode === 'name' ? 'on' : '',
    onClick: () => setSortMode('name')
  }, "A\u2013Z"))), React.createElement("div", {
    className: "card-b",
    style: {
      maxHeight: 360,
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: 9
    }
  }, shown.length === 0 && React.createElement("div", {
    style: {
      textAlign: 'center',
      color: 'var(--faint)',
      fontSize: 12.5,
      padding: 20
    }
  }, "No units match \u201C", q, "\u201D."), shown.map((r, i) => {
    const pct = Math.round(r.value / total * 100),
      w = r.value / max * 100,
      top = sortMode === 'count' && i === 0;
    return React.createElement("div", {
      key: r.label,
      onClick: () => setSel(s => s === r.label ? '' : r.label),
      title: `Click to list ${staffDeptLabel(r.label)} ${noun}`,
      style: {
        display: 'grid',
        gridTemplateColumns: '190px 1fr 64px',
        alignItems: 'center',
        gap: 10,
        cursor: 'pointer',
        borderRadius: 7,
        padding: '2px 4px',
        background: sel === r.label ? 'var(--blue-50)' : 'transparent'
      },
      onMouseEnter: e => {
        const b = e.currentTarget.querySelector('.dbar');
        if (b) b.style.filter = 'brightness(1.08)';
      },
      onMouseLeave: e => {
        const b = e.currentTarget.querySelector('.dbar');
        if (b) b.style.filter = 'none';
      }
    }, React.createElement("div", {
      style: {
        fontSize: 12,
        fontWeight: top ? 700 : 600,
        color: top ? 'var(--ink)' : 'var(--ink-2)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, staffDeptLabel(r.label)), React.createElement("div", {
      style: {
        height: 18,
        background: 'var(--panel-2)',
        borderRadius: 6,
        overflow: 'hidden'
      }
    }, React.createElement("div", {
      className: "dbar",
      style: {
        height: '100%',
        width: mounted ? w + '%' : '0%',
        minWidth: r.value ? 6 : 0,
        background: `linear-gradient(90deg,${tone},${tone2})`,
        borderRadius: 6,
        transition: `width .8s ${Math.min(i, 22) * 45}ms cubic-bezier(.2,.8,.25,1),filter .15s`
      }
    })), React.createElement("div", {
      style: {
        textAlign: 'right',
        whiteSpace: 'nowrap'
      }
    }, React.createElement("span", {
      className: "num",
      style: {
        fontSize: 13,
        fontWeight: 700,
        color: 'var(--ink)'
      }
    }, r.value), React.createElement("span", {
      style: {
        fontSize: 10.5,
        color: 'var(--muted)',
        marginLeft: 4
      }
    }, pct, "%")));
  })), sel && members[sel] && React.createElement("div", {
    style: {
      borderTop: '1px solid var(--line-2)',
      padding: '10px 14px'
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
      flexWrap: 'wrap'
    }
  }, React.createElement("b", {
    style: {
      fontSize: 13
    }
  }, staffDeptLabel(sel)), React.createElement("span", {
    className: "tag",
    style: {
      background: 'var(--blue-50)',
      color: 'var(--blue-700)'
    }
  }, members[sel].length, " ", noun), React.createElement("span", {
    className: "spacer",
    style: {
      flex: 1
    }
  }), React.createElement("button", {
    className: "btn sm",
    onClick: () => setSel('')
  }, React.createElement(Ic, {
    d: I.x,
    s: 13
  }), "Close")), React.createElement("div", {
    style: {
      maxHeight: 210,
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }
  }, [...members[sel]].sort((a, b) => String(a.name).localeCompare(String(b.name))).map(e => React.createElement("div", {
    key: e.id,
    onClick: () => setRoute && setRoute({
      view: 'staffProfile',
      emp: e.id
    }),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      padding: '6px 8px',
      borderRadius: 7,
      cursor: 'pointer',
      border: '1px solid var(--line-2)'
    },
    onMouseEnter: ev => ev.currentTarget.style.background = 'var(--panel-2)',
    onMouseLeave: ev => ev.currentTarget.style.background = 'transparent'
  }, React.createElement(Avatar, {
    photo: e.photo,
    name: e.name,
    size: 26
  }), React.createElement("div", {
    style: {
      minWidth: 0,
      flex: 1
    }
  }, React.createElement("div", {
    style: {
      fontSize: 12.5,
      fontWeight: 600,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, e.name), React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: 'var(--muted)'
    }
  }, e.designation || '—', e.emp_id ? ' · ' + e.emp_id : '')), e.phone && React.createElement("span", {
    className: "num",
    style: {
      fontSize: 11,
      color: 'var(--ink-2)'
    }
  }, e.phone))))));
}
function StaffExpChart({
  list,
  setRoute,
  role = 'Nurse'
}) {
  const {
    useState
  } = React;
  const [sel, setSel] = useState(-1);
  const S = window.STAFF;
  const BUCKETS = [['<1y', 0, 1], ['1-3y', 1, 3], ['3-5y', 3, 5], ['5-10y', 5, 10], ['10y+', 10, Infinity]];
  const members = BUCKETS.map(() => []);
  list.forEach(e => {
    const y = S.expYears(e);
    if (y == null) return;
    for (let i = 0; i < BUCKETS.length; i++) {
      if (y >= BUCKETS[i][1] && y < BUCKETS[i][2]) {
        members[i].push(e);
        break;
      }
    }
  });
  const data = BUCKETS.map(([label], i) => ({
    label,
    value: members[i].length
  }));
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const noun = role === 'PCA' ? 'PCA' : 'nurses';
  const cur = sel >= 0 ? members[sel] : null;
  return React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, "Experience Distribution"), React.createElement("span", {
    className: "sub"
  }, "click a bar to list staff"), React.createElement("span", {
    className: "spacer"
  }), React.createElement("span", {
    className: "tag"
  }, "3D")), React.createElement("div", {
    className: "card-b"
  }, React.createElement(Bar3D, {
    data: data,
    x: "label",
    y: "value",
    height: 240,
    color: "#0090ca",
    onBar: i => setSel(s => s === i ? -1 : i)
  }), cur && React.createElement("div", {
    style: {
      marginTop: 6,
      borderTop: '1px solid var(--line-2)',
      paddingTop: 10
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
      flexWrap: 'wrap'
    }
  }, React.createElement("b", {
    style: {
      fontSize: 13
    }
  }, BUCKETS[sel][0], " experience"), React.createElement("span", {
    className: "tag",
    style: {
      background: 'var(--blue-50)',
      color: 'var(--blue-700)'
    }
  }, cur.length, " ", noun, " \xB7 ", Math.round(cur.length / total * 100), "%"), React.createElement("span", {
    className: "spacer",
    style: {
      flex: 1
    }
  }), React.createElement("button", {
    className: "btn sm",
    onClick: () => setSel(-1)
  }, React.createElement(Ic, {
    d: I.x,
    s: 13
  }), "Close")), React.createElement("div", {
    style: {
      maxHeight: 168,
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }
  }, cur.length === 0 && React.createElement("div", {
    style: {
      color: 'var(--faint)',
      fontSize: 12,
      padding: '4px 2px'
    }
  }, "No ", noun, " in this range."), [...cur].sort((a, b) => S.expYears(b) - S.expYears(a)).map(e => React.createElement("div", {
    key: e.id,
    onClick: () => setRoute({
      view: 'staffProfile',
      emp: e.id
    }),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      padding: '6px 8px',
      borderRadius: 7,
      cursor: 'pointer',
      border: '1px solid var(--line-2)'
    },
    onMouseEnter: ev => ev.currentTarget.style.background = 'var(--panel-2)',
    onMouseLeave: ev => ev.currentTarget.style.background = 'transparent'
  }, React.createElement(Avatar, {
    photo: e.photo,
    name: e.name,
    size: 26
  }), React.createElement("div", {
    style: {
      minWidth: 0,
      flex: 1
    }
  }, React.createElement("div", {
    style: {
      fontSize: 12.5,
      fontWeight: 600,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, e.name), React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: 'var(--muted)'
    }
  }, e.designation || '—', " \xB7 ", staffDeptShow(e.current_department))), React.createElement("span", {
    className: "num",
    style: {
      fontSize: 11.5,
      color: 'var(--ink-2)',
      fontWeight: 600
    }
  }, S.expLabel(e))))))));
}
function StaffDesigChart({
  list,
  setRoute,
  role = 'Nurse'
}) {
  const {
    useState
  } = React;
  const [sel, setSel] = useState(null);
  const S = window.STAFF;
  const canon = window.staffCanonDesig || (x => x);
  const count = {},
    members = {};
  list.forEach(e => {
    const d = canon(e.designation) || '—';
    count[d] = (count[d] || 0) + 1;
    (members[d] = members[d] || []).push(e);
  });
  const all = Object.entries(count).sort((a, b) => b[1] - a[1]);
  const donut = all.map(([label, value], i) => ({
    label,
    value,
    color: PALETTE[i] || `hsl(${i * 67 % 360} 58% 52%)`
  }));
  const noun = role === 'PCA' ? 'PCA' : 'nurses';
  let curLabel = null,
    curList = null;
  if (sel) {
    curLabel = sel;
    curList = members[sel] || [];
  }
  return React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, "Designation Breakdown"), React.createElement("span", {
    className: "sub"
  }, "click a role to list staff"), React.createElement("span", {
    className: "spacer"
  })), React.createElement("div", {
    className: "card-b"
  }, React.createElement("div", {
    style: {
      display: 'grid',
      placeItems: 'center'
    }
  }, React.createElement(Donut, {
    data: donut,
    size: 188,
    centerValue: fmt(list.length),
    centerLabel: "staff",
    onSlice: (i, d) => setSel(s => s === d.label ? null : d.label)
  })), curList && React.createElement("div", {
    style: {
      marginTop: 8,
      borderTop: '1px solid var(--line-2)',
      paddingTop: 10
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
      flexWrap: 'wrap'
    }
  }, React.createElement("b", {
    style: {
      fontSize: 13
    }
  }, curLabel), React.createElement("span", {
    className: "tag",
    style: {
      background: 'var(--blue-50)',
      color: 'var(--blue-700)'
    }
  }, curList.length, " ", noun, " \xB7 ", Math.round(curList.length / (list.length || 1) * 100), "%"), React.createElement("span", {
    className: "spacer",
    style: {
      flex: 1
    }
  }), React.createElement("button", {
    className: "btn sm",
    onClick: () => setSel(null)
  }, React.createElement(Ic, {
    d: I.x,
    s: 13
  }), "Close")), React.createElement("div", {
    style: {
      maxHeight: 180,
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }
  }, [...curList].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(e => React.createElement("div", {
    key: e.id,
    onClick: () => setRoute({
      view: 'staffProfile',
      emp: e.id
    }),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      padding: '6px 8px',
      borderRadius: 7,
      cursor: 'pointer',
      border: '1px solid var(--line-2)'
    },
    onMouseEnter: ev => ev.currentTarget.style.background = 'var(--panel-2)',
    onMouseLeave: ev => ev.currentTarget.style.background = 'transparent'
  }, React.createElement(Avatar, {
    photo: e.photo,
    name: e.name,
    size: 26
  }), React.createElement("div", {
    style: {
      minWidth: 0,
      flex: 1
    }
  }, React.createElement("div", {
    style: {
      fontSize: 12.5,
      fontWeight: 600,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, e.name), React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: 'var(--muted)'
    }
  }, canon(e.designation) || '—', " \xB7 ", staffDeptShow(e.current_department))), React.createElement("span", {
    className: "num",
    style: {
      fontSize: 11.5,
      color: 'var(--ink-2)',
      fontWeight: 600
    }
  }, S.expLabel(e))))))));
}
function WorkforceDashboard({
  store,
  setRoute,
  role = 'Nurse'
}) {
  const S = window.STAFF;
  const list = store.staff.filter(e => (e.role || 'Nurse') === role && e.is_active && !e.former);
  const [showHi, setShowHi] = React.useState(false);
  const [printForm, setPrintForm] = React.useState(false);
  const openBlankForm = async () => {
    if (!window.UnicoStaffRegForm && window.unicoLoadChunk) {
      try {
        await window.unicoLoadChunk('datacollection');
      } catch (e) {}
    }
    if (window.UnicoStaffRegForm) setPrintForm(true);
  };
  const tone = role === 'PCA' ? '#6a52d4' : '#0090ca';
  const listView = role === 'PCA' ? 'pca' : 'nurses';
  const compView = role === 'PCA' ? 'pcaCompliance' : 'nurseCompliance';
  const homeView = role === 'PCA' ? 'pcaHome' : 'nurseHome';
  const k = S.kpis(list);
  const vacc = S.vaccinationBreakdown(list).map(([label, value]) => ({
    label,
    value,
    color: vaccColor(label)
  }));
  const recent = S.recentJoiners(list, 6);
  const annv = S.anniversaries(list, 60);
  const bdays = S.birthdays(list, 30);
  const bdayToday = bdays.filter(b => b.inDays === 0);
  const comp = S.compliance(list);
  const compIssues = comp.missing_vaccination.length + comp.missing_training.length + comp.missing_phone.length;
  const Kpi = ({
    label,
    val,
    foot,
    color
  }) => React.createElement("div", {
    className: "card anim-pop",
    style: {
      padding: '17px 20px',
      borderLeft: `4px solid ${color}`,
      display: 'flex',
      flexDirection: 'column',
      minHeight: 128
    }
  }, React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: 'var(--ink-2)'
    }
  }, label), React.createElement("div", {
    className: "num",
    style: {
      fontSize: 38,
      fontWeight: 700,
      color,
      margin: '12px 0 8px',
      lineHeight: 1
    }
  }, val), React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--muted)',
      marginTop: 'auto'
    }
  }, foot));
  return React.createElement("div", {
    className: "grid",
    style: {
      gap: 16
    }
  }, React.createElement(SectionTitle, {
    icon: role === 'PCA' ? I.bed : I.steth,
    title: `${role === 'PCA' ? 'PCA' : 'Nurse'} Dashboard`,
    sub: `Live overview of the ${role} roster`,
    right: React.createElement(React.Fragment, null, (!window.unicoCan || window.unicoCan('staff', 'add')) && React.createElement("button", {
      className: "btn sm",
      title: "Print the blank staff information form to fill in by hand",
      onClick: openBlankForm
    }, React.createElement(Ic, {
      d: I.print,
      s: 15
    }), "Print staff information"), printForm && window.UnicoStaffRegForm && React.createElement(window.UnicoStaffRegForm, {
      role,
      onDone: () => setPrintForm(false)
    }), React.createElement(RoleSwitch, {
      role: role,
      setRoute: setRoute,
      views: {
        Nurse: 'nurseHome',
        PCA: 'pcaHome'
      }
    }), React.createElement("button", {
      className: "btn sm",
      onClick: () => setShowHi(true),
      style: {
        color: '#b8860b',
        borderColor: '#e6c34d'
      }
    }, React.createElement(Ic, {
      d: I.star,
      s: 15
    }), "Staff Highlight"), React.createElement("button", {
      className: "btn sm",
      onClick: () => setRoute({
        view: listView
      })
    }, React.createElement(Ic, {
      d: I.layers,
      s: 15
    }), "Directory"), React.createElement("button", {
      className: "btn sm",
      onClick: () => setRoute({
        view: compView
      })
    }, React.createElement(Ic, {
      d: I.heart,
      s: 15
    }), "Compliance"), React.createElement("button", {
      className: "btn sm",
      disabled: store.refreshing,
      onClick: () => store.refresh()
    }, React.createElement(Ic, {
      d: I.activity,
      s: 15
    }), store.refreshing ? 'Refreshing…' : 'Refresh'), (!window.unicoCan || window.unicoCan('staff', 'add')) && React.createElement("button", {
      className: "btn pri sm",
      style: {
        background: tone,
        borderColor: tone
      },
      onClick: () => setRoute({
        view: 'staffForm',
        role
      })
    }, React.createElement(Ic, {
      d: I.plus,
      s: 15
    }), "Add ", role === 'PCA' ? 'PCA' : 'Nurse'))
  }), store.refreshError && React.createElement("div", {
    role: "alert",
    style: {
      color: '#b4232f',
      fontSize: 13
    }
  }, store.refreshError), React.createElement("div", {
    className: "grid",
    style: {
      gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))'
    }
  }, React.createElement(Kpi, {
    label: `Total ${role === 'PCA' ? 'PCAs' : 'Nurses'}`,
    val: fmt(k.total_staff),
    foot: `active ${role} on roster`,
    color: tone
  }), React.createElement(Kpi, {
    label: "Departments",
    val: fmt(new Set(list.map(e => staffCanonDept(e.current_department))).size),
    foot: "distinct units staffed",
    color: "#6a52d4"
  }), React.createElement(Kpi, {
    label: "Vaccinated",
    val: k.vaccinated_pct + '%',
    foot: "Hep-B completed / vaccinated",
    color: "#1f9d57"
  }), React.createElement(Kpi, {
    label: "Compliance Issues",
    val: fmt(compIssues),
    foot: `${comp.missing_vaccination.length} vacc · ${comp.missing_training.length} training · click for details`,
    color: "#d23a52"
  })), React.createElement("div", {
    className: "grid",
    style: {
      gridTemplateColumns: '1.25fr 1fr'
    }
  }, React.createElement(StaffDeptChart, {
    list: list,
    setRoute: setRoute,
    tone: tone,
    role: role
  }), React.createElement(StaffDesigChart, {
    list: list,
    setRoute: setRoute,
    role: role
  })), window.PerfBands && React.createElement(window.PerfBands, {
    role: role,
    setRoute: setRoute
  }), React.createElement("div", {
    className: "grid",
    style: {
      gridTemplateColumns: '1fr 1.25fr'
    }
  }, React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, "Hep-B Vaccination"), React.createElement("span", {
    className: "spacer"
  })), React.createElement("div", {
    className: "card-b",
    style: {
      display: 'grid',
      placeItems: 'center'
    }
  }, React.createElement(Donut, {
    data: vacc,
    size: 172,
    centerValue: k.vaccinated_pct + '%',
    centerLabel: "compliant"
  }))), React.createElement(StaffExpChart, {
    list: list,
    setRoute: setRoute,
    role: role
  })), React.createElement("div", {
    className: "grid",
    style: {
      gridTemplateColumns: '1fr 1fr'
    }
  }, React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, "Recent Joiners"), React.createElement("span", {
    className: "spacer"
  })), React.createElement("div", {
    className: "card-b",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    }
  }, recent.map(e => React.createElement("div", {
    key: e.id,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 11,
      padding: '8px 4px',
      borderBottom: '1px solid var(--line-2)',
      cursor: 'pointer'
    },
    onClick: () => setRoute({
      view: 'staffProfile',
      emp: e.id
    })
  }, React.createElement(Avatar, {
    photo: e.photo,
    name: e.name,
    size: 32
  }), React.createElement("div", {
    style: {
      minWidth: 0,
      flex: 1
    }
  }, React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, e.name), React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--muted)'
    }
  }, e.designation, " \xB7 ", e.current_department)), React.createElement("div", {
    className: "num",
    style: {
      fontSize: 11.5,
      color: 'var(--muted)'
    }
  }, e.doj))))), React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, "Upcoming Anniversaries"), React.createElement("span", {
    className: "sub"
  }, "next 60 days"), React.createElement("span", {
    className: "spacer"
  }), React.createElement("span", {
    className: "tag num"
  }, annv.length)), React.createElement("div", {
    className: "card-b",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    }
  }, annv.length === 0 && React.createElement("div", {
    style: {
      color: 'var(--faint)',
      fontSize: 12.5,
      padding: '14px 4px'
    }
  }, "No anniversaries in the window."), annv.slice(0, 6).map(({
    e,
    annv,
    years
  }) => React.createElement("div", {
    key: e.id,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 11,
      padding: '8px 4px',
      borderBottom: '1px solid var(--line-2)',
      cursor: 'pointer'
    },
    onClick: () => setRoute({
      view: 'staffProfile',
      emp: e.id
    })
  }, React.createElement(Avatar, {
    photo: e.photo,
    name: e.name,
    size: 32
  }), React.createElement("div", {
    style: {
      minWidth: 0,
      flex: 1
    }
  }, React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, e.name), React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--muted)'
    }
  }, e.current_department)), React.createElement("span", {
    className: "tag",
    style: {
      background: 'var(--blue-50)',
      color: 'var(--blue-700)'
    }
  }, years, " yr", years > 1 ? 's' : ''), React.createElement("div", {
    className: "num",
    style: {
      fontSize: 11.5,
      color: 'var(--muted)',
      width: 54,
      textAlign: 'right'
    }
  }, annv.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric'
  }))))))), React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("span", {
    style: {
      color: '#d4529b',
      display: 'inline-flex'
    }
  }, React.createElement(Ic, {
    d: I.heart,
    s: 16
  })), React.createElement("h3", null, "Birthday Reminders"), React.createElement("span", {
    className: "sub"
  }, "next 30 days"), React.createElement("span", {
    className: "spacer"
  }), bdayToday.length > 0 && React.createElement("span", {
    className: "tag",
    style: {
      background: '#fdeef6',
      color: '#b02a72',
      fontWeight: 700
    }
  }, "\uD83C\uDF82 ", bdayToday.length, " today"), React.createElement("span", {
    className: "tag num"
  }, bdays.length)), React.createElement("div", {
    className: "card-b",
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))',
      gap: 2
    }
  }, bdays.length === 0 && React.createElement("div", {
    style: {
      color: 'var(--faint)',
      fontSize: 12.5,
      padding: '14px 4px'
    }
  }, "No birthdays in the window", list.filter(e => e.dob).length === 0 ? ' — no date of birth recorded yet. Add it on a staff profile (Personal → Date of Birth).' : '.'), bdays.slice(0, 12).map(({
    e,
    bday,
    turns,
    inDays
  }) => React.createElement("div", {
    key: e.id,
    onClick: () => setRoute({
      view: 'staffProfile',
      emp: e.id
    }),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 11,
      padding: '8px 9px',
      borderRadius: 9,
      cursor: 'pointer',
      background: inDays === 0 ? 'linear-gradient(120deg,#fdeef6,#fff)' : 'transparent',
      border: '1px solid ' + (inDays === 0 ? '#f5c9e0' : 'transparent')
    }
  }, React.createElement(Avatar, {
    photo: e.photo,
    name: e.name,
    size: 32
  }), React.createElement("div", {
    style: {
      minWidth: 0,
      flex: 1
    }
  }, React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, inDays === 0 ? '🎂 ' : '', e.name), React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--muted)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, e.current_department || '—', turns ? ' · turns ' + turns : '')), React.createElement("div", {
    className: "num",
    style: {
      fontSize: 11.5,
      fontWeight: inDays === 0 ? 700 : 400,
      color: inDays === 0 ? '#b02a72' : 'var(--muted)',
      textAlign: 'right',
      flexShrink: 0
    }
  }, inDays === 0 ? 'Today' : inDays === 1 ? 'Tomorrow' : bday.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric'
  })))))), React.createElement("div", {
    className: "card feature",
    style: {
      padding: '14px 18px',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      flexWrap: 'wrap'
    }
  }, React.createElement("div", {
    style: {
      fontSize: 13.5,
      fontWeight: 700
    }
  }, "Compliance gaps"), [['Missing vaccination', comp.missing_vaccination.length, '#d23a52'], ['No training recorded', comp.missing_training.length, '#e08a1e'], ['No phone on file', comp.missing_phone.length, '#6a52d4']].map(([l, n, c]) => React.createElement("div", {
    key: l,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, React.createElement("span", {
    className: "num",
    style: {
      fontSize: 20,
      fontWeight: 700,
      color: c
    }
  }, n), React.createElement("span", {
    style: {
      fontSize: 12,
      color: 'var(--muted)'
    }
  }, l))), React.createElement("span", {
    className: "spacer"
  }), React.createElement("button", {
    className: "btn pri sm",
    onClick: () => setRoute({
      view: compView
    })
  }, "Review compliance", React.createElement(Ic, {
    d: I.arrowR,
    s: 15
  }))), showHi && React.createElement(StaffHighlight, {
    list: list,
    role: role,
    tone: tone,
    setRoute: setRoute,
    onClose: () => setShowHi(false)
  }));
}
function StaffHighlight({
  list,
  role,
  tone,
  setRoute,
  onClose
}) {
  const S = window.STAFF;
  const active = list.filter(e => e.is_active);
  const go = e => {
    onClose();
    setRoute({
      view: 'staffProfile',
      emp: e.id
    });
  };
  const topExp = [...active].map(e => ({
    e,
    y: S.expYears(e)
  })).filter(x => x.y != null).sort((a, b) => b.y - a.y).slice(0, 5);
  const newest = S.recentJoiners(active, 5);
  const annv = S.anniversaries(active, 90).slice(0, 5);
  const Row = ({
    e,
    right
  }) => React.createElement("div", {
    onClick: () => go(e),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '8px 6px',
      borderBottom: '1px solid var(--line-2)',
      cursor: 'pointer',
      borderRadius: 6
    },
    onMouseEnter: ev => ev.currentTarget.style.background = 'var(--panel-2)',
    onMouseLeave: ev => ev.currentTarget.style.background = 'transparent'
  }, React.createElement(Avatar, {
    photo: e.photo,
    name: e.name,
    size: 30
  }), React.createElement("div", {
    style: {
      minWidth: 0,
      flex: 1
    }
  }, React.createElement("div", {
    style: {
      fontSize: 12.5,
      fontWeight: 600,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, e.name), React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: 'var(--muted)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, e.designation || '—', " \xB7 ", e.current_department || '—')), React.createElement("span", {
    className: "num",
    style: {
      fontSize: 11.5,
      fontWeight: 700,
      color: tone,
      flexShrink: 0
    }
  }, right));
  const Card = ({
    icon,
    color,
    title,
    sub,
    children,
    empty
  }) => React.createElement("div", {
    className: "card",
    style: {
      padding: 0,
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0
    }
  }, React.createElement("div", {
    className: "card-h",
    style: {
      padding: '11px 13px',
      borderBottom: '1px solid var(--line-2)'
    }
  }, React.createElement("span", {
    style: {
      color,
      display: 'inline-flex'
    }
  }, React.createElement(Ic, {
    d: icon,
    s: 16
  })), React.createElement("h3", {
    style: {
      fontSize: 13
    }
  }, title), React.createElement("span", {
    className: "sub",
    style: {
      fontSize: 10.5
    }
  }, sub), React.createElement("span", {
    className: "spacer"
  })), React.createElement("div", {
    style: {
      padding: '4px 9px 8px'
    }
  }, children.length ? children : React.createElement("div", {
    style: {
      color: 'var(--faint)',
      fontSize: 12,
      padding: '12px 4px'
    }
  }, empty)));
  return React.createElement("div", {
    onClick: onClose,
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 1200,
      background: 'rgba(16,24,40,.5)',
      display: 'grid',
      placeItems: 'center',
      padding: 20,
      backdropFilter: 'blur(2px)'
    }
  }, React.createElement("div", {
    onClick: ev => ev.stopPropagation(),
    className: "card anim-pop",
    style: {
      width: 'min(860px,96vw)',
      maxHeight: '92vh',
      overflow: 'auto',
      padding: 0
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 11,
      padding: '16px 20px',
      borderBottom: '1px solid var(--line)',
      background: 'linear-gradient(120deg,#fff8e6,#fff)'
    }
  }, React.createElement("span", {
    style: {
      color: '#e0a81e',
      display: 'inline-flex'
    }
  }, React.createElement(Ic, {
    d: I.star,
    s: 22
  })), React.createElement("div", {
    style: {
      flex: 1
    }
  }, React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 800,
      color: 'var(--ink)'
    }
  }, role, " Highlights"), React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--muted)'
    }
  }, "Standout members of the ", role.toLowerCase(), " roster \u2014 ", active.length, " active")), React.createElement("button", {
    className: "icon-btn",
    onClick: onClose
  }, React.createElement(Ic, {
    d: I.x,
    s: 16
  }))), React.createElement("div", {
    className: "grid",
    style: {
      gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))',
      gap: 14,
      padding: 16
    }
  }, React.createElement(Card, {
    icon: I.star,
    color: "#e0a81e",
    title: "Most Experienced",
    sub: "by total experience",
    empty: "No experience on record"
  }, topExp.map(({
    e,
    y
  }) => React.createElement(Row, {
    key: e.id,
    e: e,
    right: S.expLabel(e)
  }))), React.createElement(Card, {
    icon: I.plus,
    color: "#1f9d57",
    title: "Newest Joiners",
    sub: "recent hires",
    empty: "No joining dates on record"
  }, newest.map(e => React.createElement(Row, {
    key: e.id,
    e: e,
    right: e.doj
  }))), React.createElement(Card, {
    icon: I.heart,
    color: "#6a52d4",
    title: "Upcoming Anniversaries",
    sub: "next 90 days",
    empty: "None in the window"
  }, annv.map(({
    e,
    years
  }) => React.createElement(Row, {
    key: e.id,
    e: e,
    right: `${years} yr${years > 1 ? 's' : ''}`
  }))))));
}
function staffDeptList(e) {
  const parts = String(e && e.current_department || '').split(',').map(x => x.trim()).filter(Boolean);
  return parts.length ? parts.map(x => staffCanonDept(x)) : [staffCanonDept(e && e.current_department)];
}
function StaffDirectory({
  store,
  setRoute,
  initialFilter
}) {
  const [q, setQ] = React.useState('');
  const [role, setRole] = React.useState(initialFilter?.role || '');
  const [dept, setDept] = React.useState(initialFilter?.dept || '');
  const [desig, setDesig] = React.useState('');
  const [vacc, setVacc] = React.useState(initialFilter?.vacc || '');
  const list = store.staff.filter(e => e.is_active);
  const filtered = list.filter(e => {
    if (q && !`${e.name} ${e.emp_id} ${e.phone || ''}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (role && (e.role || 'Nurse') !== role) return false;
    if (dept && staffDeptList(e).indexOf(dept) < 0) return false;
    if (desig && staffCanonDesig(e.designation) !== desig) return false;
    if (vacc === '__ok' && !vaccOK(e.hepatitis_b_vaccination)) return false;
    if (vacc === '__gap' && vaccOK(e.hepatitis_b_vaccination)) return false;
    if (vacc && !vacc.startsWith('__') && vaccCanon(e.hepatitis_b_vaccination) !== vacc) return false;
    return true;
  });
  const sel = {
    padding: '8px 11px',
    border: '1px solid var(--line)',
    borderRadius: 7,
    fontSize: 12.5,
    fontFamily: 'inherit',
    background: '#fff'
  };
  const nurses = list.filter(e => (e.role || 'Nurse') === 'Nurse').length,
    pcas = list.filter(e => e.role === 'PCA').length;
  return React.createElement("div", {
    className: "grid",
    style: {
      gap: 16
    }
  }, React.createElement(SectionTitle, {
    icon: I.layers,
    title: "Staff Directory",
    sub: `${filtered.length} shown · ${nurses} nurses · ${pcas} PCA`,
    right: !window.unicoCan || window.unicoCan('staff', 'add') ? React.createElement("button", {
      className: "btn pri sm",
      onClick: () => setRoute({
        view: 'staffForm'
      })
    }, React.createElement(Ic, {
      d: I.plus,
      s: 15
    }), "Add Staff") : null
  }), React.createElement("div", {
    className: "card",
    style: {
      padding: '12px 14px',
      display: 'flex',
      gap: 10,
      flexWrap: 'wrap',
      alignItems: 'center'
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      background: 'var(--panel-2)',
      border: '1px solid var(--line)',
      borderRadius: 7,
      padding: '7px 11px',
      width: 240,
      flexShrink: 0,
      color: 'var(--faint)'
    }
  }, React.createElement(Ic, {
    d: I.search,
    s: 15
  }), React.createElement("input", {
    placeholder: "Search name, ID, phone\u2026",
    value: q,
    onChange: e => setQ(e.target.value),
    style: {
      border: 0,
      background: 'transparent',
      outline: 'none',
      fontFamily: 'inherit',
      fontSize: 12.5,
      color: 'var(--ink)',
      width: '100%'
    }
  })), React.createElement("div", {
    className: "seg"
  }, [['', 'All'], ['Nurse', 'Nurses'], ['PCA', 'PCA']].map(([v, l]) => React.createElement("button", {
    key: v,
    className: role === v ? 'on' : '',
    onClick: () => setRole(v)
  }, l))), React.createElement("select", {
    style: sel,
    value: dept,
    onChange: e => setDept(e.target.value)
  }, React.createElement("option", {
    value: ""
  }, "All departments"), window.STAFF.DEPARTMENTS.map(d => React.createElement("option", {
    key: d,
    value: d
  }, staffDeptLabel(d)))), React.createElement("select", {
    style: sel,
    value: desig,
    onChange: e => setDesig(e.target.value)
  }, React.createElement("option", {
    value: ""
  }, "All designations"), [...window.STAFF.DESIGNATIONS, ...window.STAFF.PCA_DESIGNATIONS].map(d => React.createElement("option", {
    key: d
  }, d))), React.createElement("select", {
    style: sel,
    value: vacc,
    onChange: e => setVacc(e.target.value)
  }, React.createElement("option", {
    value: ""
  }, "Any vaccination"), React.createElement("option", {
    value: "__ok"
  }, "\u2713 Compliant"), React.createElement("option", {
    value: "__gap"
  }, "\u26A0 Has gap"), window.STAFF.VACCINATION_STATES.map(d => React.createElement("option", {
    key: d
  }, d))), (q || role || dept || desig || vacc) && React.createElement("button", {
    className: "btn sm",
    onClick: () => {
      setQ('');
      setRole('');
      setDept('');
      setDesig('');
      setVacc('');
    }
  }, "Clear"), React.createElement("span", {
    className: "spacer"
  }), React.createElement(ExportMenu, {
    rows: filtered,
    role: role || 'Staff'
  })), React.createElement("div", {
    className: "card",
    style: {
      overflow: 'hidden'
    }
  }, React.createElement("div", {
    style: {
      overflowX: 'auto'
    }
  }, React.createElement("table", {
    className: "tbl"
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", {
    style: {
      textAlign: 'left'
    }
  }, "Staff"), React.createElement("th", {
    style: {
      textAlign: 'left'
    }
  }, "Role"), React.createElement("th", {
    style: {
      textAlign: 'left'
    }
  }, "Emp ID"), React.createElement("th", {
    style: {
      textAlign: 'left'
    }
  }, "Designation"), React.createElement("th", {
    style: {
      textAlign: 'left'
    }
  }, "Department"), React.createElement("th", null, "Experience"), React.createElement("th", {
    style: {
      textAlign: 'left'
    }
  }, "Vaccination"), React.createElement("th", {
    style: {
      textAlign: 'left'
    }
  }, "Phone"), React.createElement("th", null))), React.createElement("tbody", null, filtered.map(e => React.createElement("tr", {
    key: e.id,
    style: {
      cursor: 'pointer'
    },
    onClick: () => setRoute({
      view: 'staffProfile',
      emp: e.id
    })
  }, React.createElement("td", {
    style: {
      textAlign: 'left'
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, React.createElement(Avatar, {
    photo: e.photo,
    name: e.name,
    size: 30
  }), React.createElement("div", null, React.createElement("div", {
    style: {
      fontWeight: 600,
      color: 'var(--ink)'
    }
  }, e.name), React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: 'var(--faint)',
      fontFamily: "'IBM Plex Sans'"
    }
  }, e.qualification || '—')))), React.createElement("td", {
    style: {
      textAlign: 'left'
    }
  }, React.createElement(RoleBadge, {
    role: e.role
  })), React.createElement("td", {
    style: {
      textAlign: 'left'
    }
  }, e.emp_id), React.createElement("td", {
    style: {
      textAlign: 'left',
      fontFamily: "'IBM Plex Sans'"
    }
  }, staffCanonDesig(e.designation) || '—'), React.createElement("td", {
    style: {
      textAlign: 'left',
      fontFamily: "'IBM Plex Sans'"
    }
  }, staffDeptShow(e.current_department)), React.createElement("td", {
    title: e.total_experience_text || '',
    className: "num"
  }, window.STAFF.expLabel(e)), React.createElement("td", {
    style: {
      textAlign: 'left'
    }
  }, React.createElement(VaccBadge, {
    status: e.hepatitis_b_vaccination
  })), React.createElement("td", {
    style: {
      textAlign: 'left'
    }
  }, e.phone || React.createElement("span", {
    style: {
      color: 'var(--rose)'
    }
  }, "missing")), React.createElement("td", null, React.createElement(Ic, {
    d: I.chevR,
    s: 15,
    c: "#b6c0cc"
  })))))), filtered.length === 0 && React.createElement("div", {
    style: {
      textAlign: 'center',
      color: 'var(--faint)',
      padding: '34px',
      fontSize: 13
    }
  }, "No staff match these filters."))));
}
function StaffCompliance({
  store,
  setRoute,
  role = 'Nurse'
}) {
  const comp = window.STAFF.compliance(store.staff.filter(e => (e.role || 'Nurse') === role && e.is_active && !e.former));
  const card = (title, icon, tone, rows, emptyMsg, filter) => React.createElement("div", {
    className: "card",
    style: {
      overflow: 'hidden'
    }
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("div", {
    style: {
      width: 28,
      height: 28,
      borderRadius: 7,
      background: tone + '1a',
      color: tone,
      display: 'grid',
      placeItems: 'center'
    }
  }, React.createElement(Ic, {
    d: icon,
    s: 16
  })), React.createElement("h3", null, title), React.createElement("span", {
    className: "spacer"
  }), React.createElement("span", {
    className: "num",
    style: {
      fontSize: 20,
      fontWeight: 700,
      color: tone
    }
  }, rows.length)), React.createElement("div", {
    style: {
      maxHeight: 300,
      overflowY: 'auto'
    }
  }, rows.length === 0 ? React.createElement("div", {
    style: {
      padding: '24px',
      textAlign: 'center',
      color: 'var(--pos)',
      fontSize: 13
    }
  }, React.createElement(Ic, {
    d: I.check,
    s: 26,
    c: "#1f9d57"
  }), React.createElement("div", {
    style: {
      marginTop: 6
    }
  }, emptyMsg)) : rows.map(e => React.createElement("div", {
    key: e.id,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '9px 14px',
      borderBottom: '1px solid var(--line-2)',
      cursor: 'pointer'
    },
    onClick: () => setRoute({
      view: 'staffProfile',
      emp: e.id
    })
  }, React.createElement(Avatar, {
    photo: e.photo,
    name: e.name,
    size: 30
  }), React.createElement("div", {
    style: {
      minWidth: 0,
      flex: 1
    }
  }, React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, e.name), React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--muted)'
    }
  }, e.designation, " \xB7 ", e.current_department)), React.createElement("button", {
    className: "btn sm",
    onClick: ev => {
      ev.stopPropagation();
      setRoute({
        view: 'staffForm',
        emp: e.id
      });
    }
  }, "Fix")))));
  return React.createElement("div", {
    className: "grid",
    style: {
      gap: 16
    }
  }, React.createElement(SectionTitle, {
    icon: I.heart,
    title: `${role === 'PCA' ? 'PCA' : 'Nurse'} Compliance`,
    sub: `${role} records that need attention — click to open the profile or fix`,
    right: React.createElement(RoleSwitch, {
      role: role,
      setRoute: setRoute,
      views: {
        Nurse: 'nurseCompliance',
        PCA: 'pcaCompliance'
      }
    })
  }), React.createElement("div", {
    className: "grid",
    style: {
      gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))'
    }
  }, card('Missing Hep-B Vaccination', I.heart, '#d23a52', comp.missing_vaccination, 'All staff vaccinated', 'vacc'), card('No Special Training', I.activity, '#e08a1e', comp.missing_training, 'All staff have training', 'training'), card('No Phone on File', I.user, '#6a52d4', comp.missing_phone, 'All staff have phone numbers', 'phone')));
}
const DIR_MEMO = {};
function ManageStaff({
  store,
  setRoute,
  role
}) {
  const S = window.STAFF;
  const M = DIR_MEMO[role] || {};
  const [q, setQ] = React.useState(M.q || '');
  const [chip, setChip] = React.useState(M.chip || 'all');
  const [dept, setDept] = React.useState(M.dept || '');
  const [desig, setDesig] = React.useState(M.desig || '');
  const [vacc, setVacc] = React.useState(M.vacc || '');
  const [qual, setQual] = React.useState(M.qual || '');
  const [expB, setExpB] = React.useState(M.expB || '');
  const [training, setTraining] = React.useState(M.training || '');
  const [sortBy, setSortBy] = React.useState(M.sortBy || 'name');
  const [showInactive, setShowInactive] = React.useState(!!M.showInactive);
  React.useEffect(() => {
    DIR_MEMO[role] = Object.assign({}, DIR_MEMO[role], {
      q,
      chip,
      dept,
      desig,
      vacc,
      qual,
      expB,
      training,
      sortBy,
      showInactive
    });
  });
  React.useEffect(() => {
    const el = document.querySelector('.content');
    if (!el) return;
    const saved = (DIR_MEMO[role] || {}).scroll || 0;
    if (saved) {
      let tries = 0;
      const restore = () => {
        el.scrollTop = saved;
        if (Math.abs(el.scrollTop - saved) > 4 && ++tries < 12) requestAnimationFrame(restore);
      };
      requestAnimationFrame(restore);
    }
    const onScroll = () => {
      DIR_MEMO[role] = Object.assign({}, DIR_MEMO[role], {
        scroll: el.scrollTop
      });
    };
    el.addEventListener('scroll', onScroll, {
      passive: true
    });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);
  const tone = role === 'PCA' ? '#6a52d4' : '#0090ca';
  const all = store.staff.filter(e => (e.role || 'Nurse') === role);
  const apprData = useStaffAppraisals();
  const A_ = window.UNICO_APPRAISAL;
  const apprOn = !!(apprData && A_ && A_.standing);
  const standing = React.useMemo(() => {
    if (!apprOn) return null;
    const by = {};
    (apprData.appraisals || []).forEach(x => {
      const k = String(x && x.empId);
      (by[k] || (by[k] = [])).push(x);
    });
    const now = new Date();
    const m = {};
    store.staff.forEach(e => {
      if ((e.role || 'Nurse') !== role) return;
      m[e.id] = A_.standing(e, by[String(e.emp_id || e.id)] || [], now);
    });
    return m;
  }, [apprOn, apprData, store.staff, role]);
  const stOf = e => standing ? standing[e.id] : null;
  const active = all.filter(e => e.is_active);
  const base = all.filter(e => showInactive || e.is_active);
  const now = Date.now();
  const matchChip = e => {
    const d = e.current_department || '';
    switch (chip) {
      case 'fav':
        return !!e.fav;
      case 'missing':
        return !vaccOK(e.hepatitis_b_vaccination);
      case 'icu':
        return /\b(icu|ccu|nicu|micu|sicu)\b/i.test(d) || /ct\s*icu/i.test(d);
      case 'emergency':
        return /emerg|\ber\b/i.test(d);
      case 'otcath':
        return /\bot\b|cath|theatre/i.test(d);
      case 'newhire':
        return e.doj && now - new Date(e.doj) < 220 * 86400000;
      case 'apprOverdue':
        {
          const s = stOf(e);
          return !!(s && s.overdue);
        }
      case 'apprDue':
        {
          const s = stOf(e);
          return !!(s && s.status !== 'actioned');
        }
      default:
        return true;
    }
  };
  const staffDeptsOf = staffDeptList;
  const filtered = base.filter(e => {
    if (!matchChip(e)) return false;
    if (q && !`${e.name} ${e.emp_id} ${e.phone || ''}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (dept && staffDeptsOf(e).indexOf(dept) < 0) return false;
    if (desig && staffCanonDesig(e.designation) !== desig) return false;
    if (vacc === '__ok' && !vaccOK(e.hepatitis_b_vaccination)) return false;
    if (vacc === '__gap' && vaccOK(e.hepatitis_b_vaccination)) return false;
    if (vacc && !vacc.startsWith('__') && vaccCanon(e.hepatitis_b_vaccination) !== vacc) return false;
    if (qual && e.qualification !== qual) return false;
    if (training === 'has' && !(e.special_training && e.special_training.trim())) return false;
    if (training === 'none' && e.special_training && e.special_training.trim()) return false;
    if (expB) {
      const y = S.expYears(e);
      if (y == null) return false;
      if (expB === '<1' && !(y < 1)) return false;
      if (expB === '1-3' && !(y >= 1 && y < 3)) return false;
      if (expB === '3-5' && !(y >= 3 && y < 5)) return false;
      if (expB === '5-10' && !(y >= 5 && y < 10)) return false;
      if (expB === '10+' && !(y >= 10)) return false;
    }
    return true;
  });
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'exp') {
      const ya = S.expYears(a),
        yb = S.expYears(b);
      return (yb == null ? -1 : yb) - (ya == null ? -1 : ya) || (a.name || '').localeCompare(b.name || '');
    }
    if (sortBy === 'appraisal') {
      const sa = stOf(a),
        sb = stOf(b);
      const va = sa && sa.last ? sa.last.score : -1,
        vb = sb && sb.last ? sb.last.score : -1;
      return vb - va || (a.name || '').localeCompare(b.name || '');
    }
    if (sortBy === 'doj') return (b.doj || '').localeCompare(a.doj || '');
    if (sortBy === 'dept') return (a.current_department || '').localeCompare(b.current_department || '') || (a.name || '').localeCompare(b.name || '');
    return (a.name || '').localeCompare(b.name || '');
  });
  const deptOpts = [...new Set(all.flatMap(e => staffDeptsOf(e)))].sort((a, b) => a.localeCompare(b));
  const desigOpts = [...new Set(all.map(e => staffCanonDesig(e.designation)).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const qualOpts = S.uniqueVals(all, 'qualification');
  const sel = {
    padding: '9px 11px',
    border: '1px solid var(--line)',
    borderRadius: 8,
    fontSize: 12.5,
    fontFamily: 'inherit',
    background: '#fff'
  };
  const chips = [['all', 'All'], ['fav', '★ Favorites'], ['missing', '⚠ Missing vaccination'], ['icu', 'ICU staff'], ['emergency', 'Emergency / ER'], ['otcath', 'OT / Cath Lab'], ['newhire', 'New hire']].concat(apprOn ? [['apprDue', '◷ Appraisal due'], ['apprOverdue', '⚠ Appraisal overdue']] : []);
  const anyFilter = q || dept || desig || vacc || qual || expB || training || chip !== 'all';
  return React.createElement("div", {
    className: "grid",
    style: {
      gap: 14
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: 12,
      flexWrap: 'wrap'
    }
  }, React.createElement("div", {
    style: {
      flexShrink: 0
    }
  }, React.createElement("div", {
    style: {
      fontSize: 22,
      fontWeight: 800,
      color: 'var(--ink)',
      letterSpacing: '-.3px',
      whiteSpace: 'nowrap'
    }
  }, role === 'PCA' ? 'PCA' : 'Nurse', " Employees"), React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--muted)'
    }
  }, "Dedicated ", role, " roster", all.length > active.length ? ` · ${all.length - active.length} inactive hidden` : '')), React.createElement("span", {
    className: "spacer",
    style: {
      flex: 1
    }
  }), React.createElement(RoleSwitch, {
    role: role,
    setRoute: setRoute,
    views: {
      Nurse: 'nurses',
      PCA: 'pca'
    }
  }), React.createElement("button", {
    className: "btn sm",
    onClick: () => setShowInactive(v => !v)
  }, showInactive ? 'Hide inactive' : 'Show inactive'), (!window.unicoCan || window.unicoCan('staff', 'add')) && React.createElement("button", {
    className: "btn pri sm",
    style: {
      background: tone,
      borderColor: tone
    },
    onClick: () => setRoute({
      view: 'staffForm',
      role
    })
  }, React.createElement(Ic, {
    d: I.plus,
    s: 15
  }), "Add ", role), React.createElement("span", {
    className: "num",
    style: {
      fontSize: 12.5,
      color: 'var(--muted)',
      fontWeight: 600
    }
  }, active.length, " employee(s)")), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, chips.map(([id, label]) => React.createElement("button", {
    key: id,
    onClick: () => setChip(id),
    style: {
      padding: '7px 14px',
      borderRadius: 8,
      fontSize: 12.5,
      fontWeight: 600,
      cursor: 'pointer',
      border: '1px solid ' + (chip === id ? tone : 'var(--line)'),
      background: chip === id ? tone : 'var(--panel-2)',
      color: chip === id ? '#fff' : 'var(--ink-2)'
    }
  }, label))), React.createElement("div", {
    className: "card",
    style: {
      padding: '12px 14px',
      display: 'flex',
      gap: 10,
      flexWrap: 'wrap',
      alignItems: 'center'
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      background: '#fff',
      border: '1px solid var(--line)',
      borderRadius: 8,
      padding: '8px 11px',
      flex: 1,
      minWidth: 200,
      color: 'var(--faint)'
    }
  }, React.createElement(Ic, {
    d: I.search,
    s: 15
  }), React.createElement("input", {
    placeholder: "Search name / Emp ID / Phone",
    value: q,
    onChange: e => setQ(e.target.value),
    style: {
      border: 0,
      background: 'transparent',
      outline: 'none',
      fontFamily: 'inherit',
      fontSize: 13,
      color: 'var(--ink)',
      width: '100%'
    }
  })), React.createElement("select", {
    style: sel,
    value: dept,
    onChange: e => setDept(e.target.value)
  }, React.createElement("option", {
    value: ""
  }, "All Departments"), deptOpts.map(d => React.createElement("option", {
    key: d,
    value: d
  }, staffDeptLabel(d)))), React.createElement("select", {
    style: sel,
    value: desig,
    onChange: e => setDesig(e.target.value)
  }, React.createElement("option", {
    value: ""
  }, "All Designations"), desigOpts.map(d => React.createElement("option", {
    key: d
  }, d))), React.createElement("select", {
    style: sel,
    value: vacc,
    onChange: e => setVacc(e.target.value)
  }, React.createElement("option", {
    value: ""
  }, "All Vaccination"), React.createElement("option", {
    value: "__ok"
  }, "\u2713 Compliant"), React.createElement("option", {
    value: "__gap"
  }, "\u26A0 Has gap"), [...new Set(all.map(e => e.hepatitis_b_vaccination).filter(Boolean))].map(d => React.createElement("option", {
    key: d
  }, d))), qualOpts.length > 0 && React.createElement("select", {
    style: sel,
    value: qual,
    onChange: e => setQual(e.target.value)
  }, React.createElement("option", {
    value: ""
  }, "All Qualifications"), qualOpts.map(d => React.createElement("option", {
    key: d
  }, d))), React.createElement("select", {
    style: sel,
    value: expB,
    onChange: e => setExpB(e.target.value)
  }, React.createElement("option", {
    value: ""
  }, "All Experience"), ['<1', '1-3', '3-5', '5-10', '10+'].map(x => React.createElement("option", {
    key: x,
    value: x
  }, x, " yrs"))), React.createElement("select", {
    style: sel,
    value: training,
    onChange: e => setTraining(e.target.value)
  }, React.createElement("option", {
    value: ""
  }, "Any Training"), React.createElement("option", {
    value: "has"
  }, "Has training"), React.createElement("option", {
    value: "none"
  }, "No training")), React.createElement("select", {
    style: sel,
    value: sortBy,
    onChange: e => setSortBy(e.target.value)
  }, React.createElement("option", {
    value: "name"
  }, "Sort: Name"), React.createElement("option", {
    value: "exp"
  }, "Sort: Experience"), React.createElement("option", {
    value: "doj"
  }, "Sort: Newest hire"), React.createElement("option", {
    value: "dept"
  }, "Sort: Department"), apprOn && React.createElement("option", {
    value: "appraisal"
  }, "Sort: Appraisal score")), React.createElement("button", {
    className: "btn pri sm",
    style: {
      opacity: anyFilter ? 1 : .5
    },
    onClick: () => {
      setQ('');
      setDept('');
      setDesig('');
      setVacc('');
      setQual('');
      setExpB('');
      setTraining('');
      setChip('all');
    }
  }, "Clear filters"), React.createElement(ExportMenu, {
    rows: sorted,
    role: role
  })), React.createElement("div", {
    className: "card",
    style: {
      overflow: 'hidden'
    }
  }, React.createElement("div", {
    style: {
      overflowX: 'auto'
    }
  }, React.createElement("table", {
    className: "tbl"
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", {
    style: {
      textAlign: 'center',
      width: 34
    }
  }, "\u2605"), React.createElement("th", {
    style: {
      textAlign: 'left'
    }
  }, "Emp ID"), React.createElement("th", {
    style: {
      textAlign: 'left'
    }
  }, "Name"), React.createElement("th", {
    style: {
      textAlign: 'left'
    }
  }, "Designation"), React.createElement("th", {
    style: {
      textAlign: 'left'
    }
  }, "Department"), React.createElement("th", null, "Experience"), React.createElement("th", {
    style: {
      textAlign: 'left'
    }
  }, "Vaccination"), apprOn && React.createElement("th", {
    style: {
      textAlign: 'left'
    }
  }, "Appraisal"), React.createElement("th", {
    style: {
      textAlign: 'left'
    }
  }, "Phone"), React.createElement("th", {
    style: {
      textAlign: 'right'
    }
  }, "Manage"))), React.createElement("tbody", null, sorted.map(e => React.createElement("tr", {
    key: e.id,
    style: {
      opacity: e.is_active ? 1 : .55
    }
  }, React.createElement("td", {
    style: {
      textAlign: 'center'
    }
  }, React.createElement("span", {
    onClick: ev => {
      ev.stopPropagation();
      store.toggleFav(e.id);
    },
    style: {
      cursor: 'pointer',
      fontSize: 16,
      color: e.fav ? '#e0a81e' : '#c4ccd6'
    }
  }, e.fav ? '★' : '☆')), React.createElement("td", {
    style: {
      textAlign: 'left'
    }
  }, e.emp_id), React.createElement("td", {
    style: {
      textAlign: 'left',
      cursor: 'pointer'
    },
    onClick: () => setRoute({
      view: 'staffProfile',
      emp: e.id
    })
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, React.createElement(Avatar, {
    photo: e.photo,
    name: e.name,
    size: 28
  }), React.createElement("div", null, React.createElement("div", {
    style: {
      fontWeight: 600,
      color: 'var(--ink)',
      display: 'flex',
      alignItems: 'center',
      gap: 5
    }
  }, React.createElement("span", {
    style: {
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, e.name), e.licence_verified ? (() => {
    const v = e.licence_verified,
      p = v.primary || {},
      ex = !!p.expired,
      c = ex ? '#d23a52' : '#157a43';
    return React.createElement("span", {
      title: (ex ? 'BNMC licence EXPIRED' : 'BNMC verified') + (p.regNo ? ' · Reg ' + p.regNo : '') + ' · register checked ' + (String(v.at || '').slice(0, 10) || '—'),
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 14,
        height: 14,
        borderRadius: '50%',
        background: c,
        flex: '0 0 auto',
        fontSize: 10,
        fontWeight: 800,
        color: '#fff',
        lineHeight: 1
      }
    }, ex ? '!' : React.createElement(Ic, {
      d: I.check,
      s: 9,
      c: "#fff"
    }));
  })() : null), e.qualification && React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: 'var(--faint)',
      fontFamily: "'IBM Plex Sans'"
    }
  }, e.qualification)))), React.createElement("td", {
    style: {
      textAlign: 'left',
      fontFamily: "'IBM Plex Sans'"
    }
  }, staffCanonDesig(e.designation) || '—'), React.createElement("td", {
    style: {
      textAlign: 'left',
      fontFamily: "'IBM Plex Sans'"
    }
  }, staffDeptShow(e.current_department)), React.createElement("td", {
    title: e.total_experience_text || '',
    className: "num"
  }, window.STAFF.expLabel(e)), React.createElement("td", {
    style: {
      textAlign: 'left',
      fontFamily: "'IBM Plex Sans'"
    }
  }, React.createElement("span", {
    style: {
      color: vaccColor(e.hepatitis_b_vaccination),
      fontWeight: 600
    }
  }, e.hepatitis_b_vaccination || 'Unknown')), apprOn && React.createElement("td", {
    style: {
      textAlign: 'left',
      cursor: 'pointer'
    },
    title: "Open the performance record on this profile",
    onClick: () => setRoute({
      view: 'staffProfile',
      emp: e.id
    })
  }, React.createElement(ApprCell, {
    st: stOf(e)
  })), React.createElement("td", {
    style: {
      textAlign: 'left'
    }
  }, e.phone || React.createElement("span", {
    style: {
      color: 'var(--rose)'
    }
  }, "\u2014")), React.createElement("td", null, React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      justifyContent: 'flex-end'
    }
  }, apprOn && apprCanEdit() && (() => {
    const st = stOf(e);
    if (!st || !st.cycle) return null;
    return React.createElement("button", {
      className: "icon-btn",
      title: st.appraisal ? 'Continue the ' + (st.appraisal.cycleLabel || 'current') + ' appraisal' : 'Start the ' + st.cycle.label + ' appraisal',
      onClick: () => setRoute({
        view: 'perfForm',
        emp: e.emp_id || String(e.id)
      }),
      style: st.overdue ? {
        color: '#d23a52',
        background: '#d23a5214',
        border: '1px solid #d23a5240'
      } : null
    }, React.createElement(Ic, {
      d: I.doc,
      s: 14
    }));
  })(), (!window.unicoCan || window.unicoCan('staff', 'edit')) && React.createElement("button", {
    className: "icon-btn",
    title: "Edit",
    onClick: () => setRoute({
      view: 'staffForm',
      emp: e.id
    })
  }, React.createElement(Ic, {
    d: I.edit,
    s: 14
  })), (!window.unicoCan || window.unicoCan('staff', 'edit')) && (e.is_active ? React.createElement("button", {
    className: "icon-btn danger",
    title: "Deactivate",
    onClick: async () => {
      const ok = await window.UI.confirm({
        title: `Deactivate ${e.name}?`,
        message: 'They will be moved off the active roster into Previous Staff. You can restore them anytime.',
        confirmLabel: 'Deactivate'
      });
      if (ok) {
        store.remove(e.id);
        window.UI.toast(e.name + ' moved to Previous Staff', 'success');
      }
    }
  }, React.createElement(Ic, {
    d: I.x,
    s: 14
  })) : React.createElement("button", {
    className: "icon-btn",
    title: "Restore",
    onClick: () => {
      store.restore(e.id);
      window.UI && window.UI.toast(e.name + ' restored to the active roster', 'success');
    },
    style: {
      color: 'var(--pos)'
    }
  }, React.createElement(Ic, {
    d: I.check,
    s: 14
  }))), (!window.unicoCan || window.unicoCan('staff', 'delete')) && React.createElement("button", {
    className: "icon-btn",
    title: "Delete permanently",
    onClick: async () => {
      const ok = await window.UI.confirm({
        title: `Permanently delete ${e.name}?`,
        message: 'This removes the record entirely and cannot be undone. (Use Deactivate to keep the record.)',
        danger: true,
        confirmLabel: 'Delete permanently'
      });
      if (ok) {
        store.destroy(e.id);
        window.UI.toast('Staff record deleted', 'success');
      }
    },
    style: {
      color: '#d23a52',
      background: '#d23a521a',
      border: '1px solid #d23a5240'
    }
  }, React.createElement(Ic, {
    d: I.x,
    s: 14,
    sw: 2.6
  })))))))), sorted.length === 0 && React.createElement("div", {
    style: {
      textAlign: 'center',
      color: 'var(--faint)',
      padding: '34px',
      fontSize: 13
    }
  }, "No ", role, " match these filters."))));
}
function PreviousStaff({
  store,
  setRoute
}) {
  const [q, setQ] = React.useState('');
  const [role, setRole] = React.useState('');
  const list = store.staff.filter(e => e.former || e.is_active === false);
  const fmtd = d => {
    try {
      return d ? new Date(d).toLocaleDateString() : '';
    } catch (e) {
      return '';
    }
  };
  const rows = list.filter(e => !role || (e.role || 'Nurse') === role).filter(e => !q || `${e.name} ${e.emp_id || ''} ${e.current_department || ''}`.toLowerCase().includes(q.toLowerCase())).sort((a, b) => (b.archived_at || 0) - (a.archived_at || 0));
  const inp = {
    padding: '8px 11px',
    border: '1px solid var(--line)',
    borderRadius: 8,
    fontSize: 13,
    fontFamily: 'inherit',
    background: '#fff',
    outline: 'none'
  };
  const nurses = list.filter(e => (e.role || 'Nurse') === 'Nurse').length,
    pcas = list.filter(e => e.role === 'PCA').length;
  return React.createElement("div", {
    className: "grid",
    style: {
      gap: 16
    }
  }, React.createElement(SectionTitle, {
    icon: I.steth,
    title: "Previous Staff",
    sub: `${list.length} inactive staff — archived from an import or deactivated, so off the active roster. Records are kept for history; restore anyone anytime.`,
    right: React.createElement("input", {
      placeholder: "Search former staff\u2026",
      value: q,
      onChange: e => setQ(e.target.value),
      style: {
        ...inp,
        minWidth: 220
      }
    })
  }), React.createElement("div", {
    className: "card",
    style: {
      overflow: 'hidden'
    }
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, "Archived Roster"), React.createElement("span", {
    className: "spacer"
  }), React.createElement("div", {
    className: "seg"
  }, [['', 'All'], ['Nurse', 'Nurses (' + nurses + ')'], ['PCA', 'PCA (' + pcas + ')']].map(([v, l]) => React.createElement("button", {
    key: v,
    className: role === v ? 'on' : '',
    onClick: () => setRole(v)
  }, l))), React.createElement("span", {
    className: "tag num",
    style: {
      marginLeft: 8
    }
  }, rows.length)), rows.length === 0 ? React.createElement("div", {
    style: {
      padding: '34px',
      textAlign: 'center',
      color: 'var(--faint)',
      fontSize: 13
    }
  }, "No previous staff.") : React.createElement("div", {
    style: {
      overflowX: 'auto'
    }
  }, React.createElement("table", {
    className: "tbl"
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", {
    style: {
      textAlign: 'left'
    }
  }, "Name"), React.createElement("th", null, "Emp ID"), React.createElement("th", null, "Role"), React.createElement("th", {
    style: {
      textAlign: 'left'
    }
  }, "Department"), React.createElement("th", {
    style: {
      textAlign: 'left'
    }
  }, "Designation"), React.createElement("th", null, "Archived"), React.createElement("th", {
    style: {
      textAlign: 'left'
    }
  }, "Reason"), React.createElement("th", null))), React.createElement("tbody", null, rows.map(e => React.createElement("tr", {
    key: e.id,
    style: {
      opacity: .9
    }
  }, React.createElement("td", {
    style: {
      textAlign: 'left'
    }
  }, React.createElement("b", {
    style: {
      color: 'var(--ink)'
    }
  }, e.name)), React.createElement("td", {
    className: "num"
  }, e.emp_id || '—'), React.createElement("td", null, React.createElement(RoleBadge, {
    role: e.role
  })), React.createElement("td", {
    style: {
      textAlign: 'left'
    }
  }, staffDeptShow(e.current_department)), React.createElement("td", {
    style: {
      textAlign: 'left'
    }
  }, staffCanonDesig(e.designation) || '—'), React.createElement("td", {
    style: {
      fontSize: 12,
      color: 'var(--muted)'
    }
  }, fmtd(e.archived_at)), React.createElement("td", {
    style: {
      textAlign: 'left',
      fontSize: 12,
      color: 'var(--muted)'
    }
  }, e.archived_reason || (e.former ? 'Not in latest import' : 'Deactivated')), React.createElement("td", {
    style: {
      textAlign: 'right',
      whiteSpace: 'nowrap'
    }
  }, React.createElement("button", {
    className: "btn sm",
    style: {
      marginRight: 5
    },
    onClick: () => setRoute && setRoute({
      view: e.role === 'PCA' ? 'pca' : 'nurses'
    }),
    title: "Open in directory"
  }, React.createElement(Ic, {
    d: I.user,
    s: 13
  }), "View"), React.createElement("button", {
    className: "btn sm pri",
    onClick: () => {
      store.restore ? store.restore(e.id) : store.update(e.id, {
        is_active: true,
        former: false,
        archived_at: null,
        archived_reason: ''
      });
      window.UI && window.UI.toast(e.name + ' restored to the active roster', 'success');
    }
  }, React.createElement(Ic, {
    d: I.check,
    s: 13
  }), "Restore")))))))), React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--muted)',
      padding: '0 2px',
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, React.createElement(Ic, {
    d: I.doc,
    s: 13
  }), " Restoring a staff member returns them to the active Nurse / PCA roster with all their details intact."));
}
Object.assign(window, {
  Avatar,
  VaccBadge,
  RoleBadge,
  RoleSwitch,
  vaccColor,
  WorkforceDashboard,
  StaffDirectory,
  StaffCompliance,
  ManageStaff,
  PreviousStaff,
  useStaffAppraisals,
  ApprCell,
  APPR_STATUS,
  apprCanSee,
  apprCanEdit
});
})();
;
/* ===== input.jsx ===== */
(function(){
function Toast({
  msg,
  onDone
}) {
  React.useEffect(() => {
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, []);
  return React.createElement("div", {
    style: {
      position: 'fixed',
      bottom: 24,
      right: 24,
      zIndex: 9999,
      background: '#0d1b2e',
      color: '#fff',
      padding: '12px 16px',
      borderRadius: 10,
      boxShadow: 'var(--shadow-pop)',
      display: 'flex',
      alignItems: 'center',
      gap: 10
    },
    className: "anim-pop"
  }, React.createElement("div", {
    style: {
      width: 24,
      height: 24,
      borderRadius: '50%',
      background: 'var(--green)',
      display: 'grid',
      placeItems: 'center'
    }
  }, React.createElement(Ic, {
    d: I.check,
    s: 15,
    c: "#fff",
    sw: 2.6
  })), React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 600
    }
  }, msg));
}
function NumField({
  col,
  value,
  onChange,
  err,
  autoFocus,
  draggable,
  dragging,
  dragOver,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop
}) {
  return React.createElement("label", {
    onDragOver: onDragOver,
    onDrop: onDrop,
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 5,
      position: 'relative',
      opacity: dragging ? 0.45 : 1,
      outline: dragOver ? '2px dashed var(--blue)' : 'none',
      outlineOffset: dragOver ? 2 : 0,
      borderRadius: 8,
      transition: 'opacity .12s'
    }
  }, React.createElement("span", {
    style: {
      fontSize: 11.5,
      fontWeight: 600,
      color: 'var(--ink-2)',
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, draggable && React.createElement("span", {
    draggable: true,
    onDragStart: onDragStart,
    onDragEnd: onDragEnd,
    title: "Drag to reorder",
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      cursor: 'grab',
      color: 'var(--faint)',
      marginLeft: -2,
      touchAction: 'none'
    },
    onMouseDown: e => e.currentTarget.style.cursor = 'grabbing',
    onMouseUp: e => e.currentTarget.style.cursor = 'grab'
  }, React.createElement(Ic, {
    d: I.grip,
    s: 13,
    sw: 2.4
  })), col.label, col.pct && React.createElement("span", {
    style: {
      color: 'var(--faint)',
      fontWeight: 500
    }
  }, "(%)")), React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, React.createElement("input", {
    type: "number",
    min: "0",
    step: col.pct ? '0.01' : '1',
    value: value,
    autoFocus: autoFocus,
    onChange: e => onChange(e.target.value),
    style: {
      width: '100%',
      padding: '9px 11px',
      border: '1px solid ' + (err ? 'var(--rose)' : 'var(--line)'),
      borderRadius: 7,
      fontFamily: 'IBM Plex Mono',
      fontSize: 14,
      background: err ? 'var(--neg-bg)' : '#fff',
      outline: 'none'
    },
    onFocus: e => e.target.style.borderColor = 'var(--blue)',
    onBlur: e => e.target.style.borderColor = err ? 'var(--rose)' : 'var(--line)'
  }), col.pct && React.createElement("span", {
    style: {
      position: 'absolute',
      right: 11,
      top: 10,
      color: 'var(--faint)',
      fontSize: 13
    }
  }, "%")), err && React.createElement("span", {
    style: {
      fontSize: 10.5,
      color: 'var(--rose)'
    }
  }, err));
}
function DataEntry({
  depts,
  addEntry,
  entries,
  initialDept,
  updateDept,
  deleteMonth,
  undo,
  canUndo
}) {
  const [mode, setMode] = React.useState('form');
  const [deptId, setDeptId] = React.useState(initialDept && depts.some(d => d.id === initialDept) ? initialDept : depts[0].id);
  const [month, setMonth] = React.useState(() => {
    const MO = window.UNICO.MONTH_ORDER;
    const initId = initialDept && depts.some(d => d.id === initialDept) ? initialDept : depts[0].id;
    const dep = depts.find(x => x.id === initId) || depts[0];
    const last = (dep.months || [])[(dep.months || []).length - 1];
    const i = last ? MO.indexOf(last) : -1;
    return i >= 0 && MO[i + 1] || last || MO[0];
  });
  const [vals, setVals] = React.useState({});
  const [errs, setErrs] = React.useState({});
  const [step, setStep] = React.useState(0);
  const [toast, setToast] = React.useState(null);
  const [fldOpen, setFldOpen] = React.useState(false);
  const [fName, setFName] = React.useState('');
  const [fPct, setFPct] = React.useState(false);
  const d = depts.find(x => x.id === deptId) || depts[0];
  const [dragIdx, setDragIdx] = React.useState(null);
  const [dragOverIdx, setDragOverIdx] = React.useState(null);
  const reorderCols = (from, to) => {
    if (from == null || to == null || from === to || !updateDept) return;
    const next = d.cols.map(c => ({
      ...c
    }));
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    updateDept(d.id, {
      cols: next
    });
  };
  const MO = window.UNICO.MONTH_ORDER;
  const nextNew = dep => {
    const last = (dep.months || [])[(dep.months || []).length - 1];
    const i = last ? MO.indexOf(last) : -1;
    return i >= 0 && MO[i + 1] || last || MO[0];
  };
  const addField = () => {
    const name = fName.trim();
    if (!name) {
      window.UI && window.UI.toast('Enter a field name', 'error');
      return;
    }
    if (!updateDept) {
      window.UI && window.UI.toast('Custom fields unavailable here', 'error');
      return;
    }
    let base = ('c_' + name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')).slice(0, 26);
    if (base === 'c_' || base === 'c') base = 'c_field';
    const existing = new Set(d.cols.map(c => c.id));
    let id = base,
      n = 2;
    while (existing.has(id)) {
      id = base + '_' + n++;
    }
    updateDept(d.id, {
      cols: [...d.cols.map(c => ({
        ...c
      })), {
        id,
        label: name,
        pct: !!fPct
      }]
    });
    try {
      fetch('/api/departments/' + encodeURIComponent(d.id) + '/fields', {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          id,
          label: name,
          pct: !!fPct
        })
      }).catch(() => {});
    } catch (e) {}
    window.UI && window.UI.toast(`Field "${name}" added to ${d.short}`, 'success');
    setFName('');
    setFPct(false);
    setFldOpen(false);
  };
  const removeField = col => {
    if (!updateDept) return;
    window.UI.confirm({
      title: `Remove the "${col.label}" field?`,
      message: `Drops this metric from ${d.short}. Existing values for it are discarded.`,
      danger: true,
      confirmLabel: 'Remove field'
    }).then(ok => {
      if (!ok) return;
      updateDept(d.id, {
        cols: d.cols.filter(c => c.id !== col.id).map(c => ({
          ...c
        }))
      });
      try {
        fetch('/api/departments/' + encodeURIComponent(d.id) + '/fields/' + encodeURIComponent(col.id), {
          method: 'DELETE',
          credentials: 'same-origin'
        }).catch(() => {});
      } catch (e) {}
      window.UI.toast('Field removed', 'success');
    });
  };
  const monthOpts = (() => {
    const all = d.months || [];
    const fi = Math.max(0, MO.indexOf(all[0] || MO[0]));
    const li = MO.indexOf(all[all.length - 1] || MO[0]);
    let opts = MO.slice(fi, Math.min(MO.length, (li < 0 ? fi : li) + 37));
    if (month && !opts.includes(month)) opts = opts.concat(month);
    return opts;
  })();
  const isExisting = (d.months || []).includes(month);
  const MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MYEARS = Array.from({
    length: 22
  }, (_, i) => 2024 + i);
  const parseKey = k => {
    const p = String(k || '').split('-');
    return {
      mi: Math.max(0, MONS.indexOf(p[0])),
      yr: 2000 + (parseInt(p[1], 10) || 26)
    };
  };
  const [monthPickOpen, setMonthPickOpen] = React.useState(false);
  const [pm, setPm] = React.useState(() => parseKey(month).mi);
  const [py, setPy] = React.useState(() => parseKey(month).yr);
  const openMonthPicker = () => {
    const p = parseKey(month);
    setPm(p.mi);
    setPy(p.yr);
    setMonthPickOpen(true);
  };
  const useCustomMonth = () => {
    const key = MONS[pm] + '-' + String(py).slice(-2);
    setMonth(key);
    setMonthPickOpen(false);
    window.UI && window.UI.toast('Reporting month set to ' + (window.UNICO.MONTHS_FULL[key] || key), 'success');
  };
  const [gridEdits, setGridEdits] = React.useState({});
  const gridCell = (mo, col, cur) => gridEdits[mo] && gridEdits[mo][col] !== undefined ? gridEdits[mo][col] : cur == null ? '' : cur;
  const setGridCell = (mo, col, v) => setGridEdits(s => ({
    ...s,
    [mo]: {
      ...(s[mo] || {}),
      [col]: v
    }
  }));
  const updateMonthRow = r => {
    const edits = gridEdits[r.month] || {};
    const row = {};
    Object.keys(edits).forEach(k => {
      const v = String(edits[k] == null ? '' : edits[k]).trim();
      row[k] = v === '' ? null : Number(v);
    });
    if (!Object.keys(row).length) {
      setGridEdits(s => {
        const n = {
          ...s
        };
        delete n[r.month];
        return n;
      });
      return;
    }
    addEntry({
      dept: d.id,
      deptName: d.short,
      month: r.month,
      full: r.full || window.UNICO.MONTHS_FULL[r.month] || r.month,
      row,
      ts: Date.now()
    });
    setToast(`Updated ${d.short} · ${r.full || r.month}`);
    setGridEdits(s => {
      const n = {
        ...s
      };
      delete n[r.month];
      return n;
    });
  };
  const delMonthRow = r => {
    if (!deleteMonth) {
      window.UI && window.UI.toast('Delete unavailable', 'error');
      return;
    }
    window.UI.confirm({
      title: `Delete ${r.full || r.month}?`,
      message: `Removes ${d.short}'s data for this month. You can Undo afterwards.`,
      danger: true,
      confirmLabel: 'Delete'
    }).then(ok => {
      if (ok) {
        deleteMonth(d.id, r.month);
        window.UI.toast('Month deleted', 'success');
      }
    });
  };
  const doUndo = () => {
    if (undo) {
      undo();
      window.UI && window.UI.toast('Reverted last change', 'success');
    }
  };
  React.useEffect(() => {
    setVals({});
    setErrs({});
    setStep(0);
    setMonth(nextNew(d));
    setMonthPickOpen(false);
    setGridEdits({});
  }, [deptId]);
  const set = (id, v) => setVals(s => ({
    ...s,
    [id]: v
  }));
  const validate = cols => {
    const e = {};
    cols.forEach(c => {
      const raw = vals[c.id];
      if (raw === undefined || raw === '') {
        if (!c.pct) e[c.id] = 'Required';
      } else if (Number(raw) < 0) e[c.id] = 'Must be ≥ 0';else if (!c.pct && !Number.isInteger(Number(raw))) e[c.id] = 'Whole number';
    });
    const totalCol = cols.find(c => c.id === 'total');
    if (totalCol && vals.total !== undefined) {
      const comp = cols.filter(c => c.id !== 'total' && !c.pct && ['cag', 'pci', 'ppm', 'tpm', 'dsa', 'endo', 'colon', 'polyp', 'histo', 'bronch', 'pluro', 'cabg', 'valve', 'other'].includes(c.id));
      if (comp.length) {
        const sum = comp.reduce((s, c) => s + Number(vals[c.id] || 0), 0);
        if (Number(vals.total) !== sum) e.total = `≠ component sum (${sum})`;
      }
    }
    return e;
  };
  const submit = async () => {
    const e = validate(d.cols);
    setErrs(e);
    const hard = Object.keys(e).filter(k => e[k] !== 'Required');
    if (hard.length) {
      return false;
    }
    if (d.cols.every(c => vals[c.id] === undefined || vals[c.id] === '')) {
      window.UI && window.UI.toast ? window.UI.toast('Enter at least one value before saving', 'error') : alert('Enter at least one value before saving');
      return false;
    }
    const missing = d.cols.filter(c => e[c.id] === 'Required');
    if (missing.length) {
      const names = missing.map(c => c.label).join(', ');
      const ok = window.UI && window.UI.confirm ? await window.UI.confirm({
        title: `Save with ${missing.length} field${missing.length > 1 ? 's' : ''} missing?`,
        message: `No value entered for: ${names}. These will be saved as blank (—) and won't be counted in charts or totals — you can fill them in later.`,
        confirmLabel: 'Save anyway',
        cancelLabel: 'Keep editing'
      }) : window.confirm(`Save with missing data (${names})?`);
      if (!ok) return false;
    }
    const row = {};
    d.cols.forEach(c => {
      const raw = vals[c.id];
      row[c.id] = raw === undefined || raw === '' ? null : Number(raw);
    });
    if (!Object.values(row).some(v => v !== null)) {
      window.UI && window.UI.toast('Nothing to save — every field is empty', 'error');
      return false;
    }
    addEntry({
      dept: d.id,
      deptName: d.short,
      month,
      full: window.UNICO.MONTHS_FULL[month] || month,
      row,
      ts: Date.now()
    });
    setToast(`Saved ${d.short} · ${month}`);
    setVals({});
    setErrs({});
    setStep(0);
    return true;
  };
  const tabBtn = (id, label, icon) => React.createElement("button", {
    onClick: () => setMode(id),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '10px 16px',
      border: '0',
      borderBottom: '2.5px solid ' + (mode === id ? 'var(--blue)' : 'transparent'),
      background: 'transparent',
      color: mode === id ? 'var(--blue)' : 'var(--muted)',
      fontWeight: 600,
      fontSize: 13
    }
  }, React.createElement(Ic, {
    d: icon,
    s: 16
  }), label);
  const selector = React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      flexWrap: 'wrap',
      alignItems: 'flex-end'
    }
  }, React.createElement("label", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 5,
      minWidth: 240
    }
  }, React.createElement("span", {
    style: {
      fontSize: 11.5,
      fontWeight: 600,
      color: 'var(--ink-2)'
    }
  }, "Department"), React.createElement("select", {
    value: deptId,
    onChange: e => setDeptId(e.target.value),
    style: {
      padding: '9px 11px',
      border: '1px solid var(--line)',
      borderRadius: 7,
      fontSize: 13,
      fontFamily: 'inherit',
      background: '#fff'
    }
  }, depts.map(x => React.createElement("option", {
    key: x.id,
    value: x.id
  }, x.name, " (", x.short, ")")))), React.createElement("label", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 5,
      minWidth: 170
    }
  }, React.createElement("span", {
    style: {
      fontSize: 11.5,
      fontWeight: 600,
      color: 'var(--ink-2)'
    }
  }, "Reporting Month"), React.createElement("select", {
    value: month,
    onChange: e => setMonth(e.target.value),
    style: {
      padding: '9px 11px',
      border: '1px solid var(--line)',
      borderRadius: 7,
      fontSize: 13,
      fontFamily: 'inherit',
      background: '#fff'
    }
  }, monthOpts.map(m => React.createElement("option", {
    key: m,
    value: m
  }, window.UNICO.MONTHS_FULL[m] || m))), React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, React.createElement("span", {
    className: "tag",
    style: {
      fontSize: 10,
      background: isExisting ? '#fbeed0' : 'var(--pos-bg)',
      color: isExisting ? 'var(--amber)' : 'var(--pos)'
    }
  }, isExisting ? 'Editing existing' : 'New month'), React.createElement("button", {
    type: "button",
    onClick: openMonthPicker,
    title: "Enter data for any month / year",
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 3,
      border: 0,
      background: 'none',
      color: 'var(--blue)',
      fontSize: 11,
      fontWeight: 700,
      cursor: 'pointer',
      padding: 0
    }
  }, React.createElement(Ic, {
    d: I.plus,
    s: 12,
    sw: 2.6
  }), "New month")), monthPickOpen && React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      alignItems: 'center',
      flexWrap: 'wrap',
      background: 'var(--panel-2)',
      border: '1px solid var(--line)',
      borderRadius: 7,
      padding: '7px 8px',
      marginTop: 2
    }
  }, React.createElement("select", {
    value: pm,
    onChange: e => setPm(+e.target.value),
    style: {
      padding: '5px 7px',
      border: '1px solid var(--line)',
      borderRadius: 6,
      fontSize: 12.5,
      fontFamily: 'inherit',
      background: '#fff'
    }
  }, MONS.map((mn, i) => React.createElement("option", {
    key: mn,
    value: i
  }, mn))), React.createElement("select", {
    value: py,
    onChange: e => setPy(+e.target.value),
    style: {
      padding: '5px 7px',
      border: '1px solid var(--line)',
      borderRadius: 6,
      fontSize: 12.5,
      fontFamily: 'inherit',
      background: '#fff'
    }
  }, MYEARS.map(y => React.createElement("option", {
    key: y,
    value: y
  }, y))), React.createElement("button", {
    className: "btn sm pri",
    type: "button",
    onClick: useCustomMonth
  }, React.createElement(Ic, {
    d: I.check,
    s: 13
  }), "Use"), React.createElement("button", {
    className: "btn sm",
    type: "button",
    onClick: () => setMonthPickOpen(false)
  }, "Cancel"))));
  return React.createElement("div", {
    className: "grid",
    style: {
      gap: 16
    }
  }, React.createElement(SectionTitle, {
    icon: I.input,
    title: "Data Entry",
    sub: "Capture monthly department statistics \u2014 saved entries flow straight into dashboards"
  }), React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    style: {
      display: 'flex',
      borderBottom: '1px solid var(--line)',
      padding: '0 8px',
      alignItems: 'center'
    }
  }, tabBtn('form', 'Quick Form', I.edit), tabBtn('grid', 'Grid Entry', I.grid), tabBtn('wizard', 'Guided Wizard', I.steth), React.createElement("span", {
    style: {
      flex: 1
    }
  }), canUndo && React.createElement("button", {
    className: "btn sm",
    style: {
      marginRight: 6
    },
    onClick: doUndo,
    title: "Undo the last data change"
  }, React.createElement(Ic, {
    d: I.chevR,
    s: 13,
    style: {
      transform: 'rotate(180deg)'
    }
  }), "Undo")), mode === 'form' && React.createElement("div", {
    className: "card-b",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 18
    }
  }, selector, React.createElement("div", {
    style: {
      height: 1,
      background: 'var(--line-2)'
    }
  }), React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))',
      gap: 14
    }
  }, d.cols.map((c, i) => React.createElement(NumField, {
    key: c.id,
    col: c,
    value: vals[c.id] ?? '',
    err: errs[c.id],
    onChange: v => set(c.id, v),
    draggable: d.cols.length > 1,
    dragging: dragIdx === i,
    dragOver: dragOverIdx === i && dragIdx !== null && dragIdx !== i,
    onDragStart: e => {
      setDragIdx(i);
      setDragOverIdx(i);
      e.dataTransfer.effectAllowed = 'move';
      try {
        e.dataTransfer.setData('text/plain', String(i));
      } catch (_) {}
    },
    onDragOver: e => {
      if (dragIdx !== null) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dragOverIdx !== i) setDragOverIdx(i);
      }
    },
    onDrop: e => {
      e.preventDefault();
      const from = dragIdx;
      if (from !== null && from !== i) {
        reorderCols(from, i);
      }
      setDragIdx(null);
      setDragOverIdx(null);
    },
    onDragEnd: () => {
      setDragIdx(null);
      setDragOverIdx(null);
    }
  }))), React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      flexWrap: 'wrap'
    }
  }, !fldOpen ? React.createElement("button", {
    className: "btn sm",
    onClick: () => setFldOpen(true),
    style: {
      borderStyle: 'dashed'
    }
  }, React.createElement(Ic, {
    d: I.plus,
    s: 14
  }), "Add custom field") : React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      alignItems: 'center',
      flexWrap: 'wrap',
      background: 'var(--panel-2)',
      border: '1px solid var(--line)',
      borderRadius: 8,
      padding: '10px 12px'
    }
  }, React.createElement("span", {
    style: {
      fontSize: 11.5,
      fontWeight: 600,
      color: 'var(--ink-2)'
    }
  }, "New field for ", d.short, ":"), React.createElement("input", {
    autoFocus: true,
    placeholder: "e.g. Ventilator days",
    value: fName,
    onChange: e => setFName(e.target.value),
    onKeyDown: e => {
      if (e.key === 'Enter') addField();
    },
    style: {
      padding: '7px 10px',
      border: '1px solid var(--line)',
      borderRadius: 7,
      fontFamily: 'inherit',
      fontSize: 13,
      minWidth: 190,
      outline: 'none'
    }
  }), React.createElement("label", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      fontSize: 12,
      color: 'var(--ink-2)'
    }
  }, React.createElement("input", {
    type: "checkbox",
    checked: fPct,
    onChange: e => setFPct(e.target.checked)
  }), "%"), React.createElement("button", {
    className: "btn sm pri",
    onClick: addField
  }, React.createElement(Ic, {
    d: I.check,
    s: 14
  }), "Add"), React.createElement("button", {
    className: "btn sm",
    onClick: () => {
      setFldOpen(false);
      setFName('');
      setFPct(false);
    }
  }, "Cancel")), d.cols.filter(c => String(c.id).startsWith('c_')).map(c => React.createElement("span", {
    key: c.id,
    className: "col-chip",
    style: {
      gap: 5
    }
  }, c.label, React.createElement("button", {
    className: "icon-btn",
    style: {
      width: 18,
      height: 18,
      border: 0,
      background: 'transparent',
      color: 'var(--rose)'
    },
    title: "Remove field",
    onClick: () => removeField(c)
  }, React.createElement(Ic, {
    d: I.x,
    s: 12
  }))))), React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, React.createElement("button", {
    className: "btn pri",
    onClick: submit
  }, React.createElement(Ic, {
    d: I.check,
    s: 16,
    sw: 2.4
  }), "Save Entry"), React.createElement("button", {
    className: "btn",
    onClick: () => {
      setVals({});
      setErrs({});
    }
  }, "Clear"), Object.keys(errs).length > 0 && (() => {
    const hard = Object.keys(errs).filter(k => errs[k] !== 'Required').length;
    const miss = Object.keys(errs).length - hard;
    return hard ? React.createElement("span", {
      style: {
        fontSize: 12,
        color: 'var(--rose)',
        fontWeight: 600
      }
    }, "Fix ", hard, " field", hard > 1 ? 's' : '', " before saving") : React.createElement("span", {
      style: {
        fontSize: 12,
        color: 'var(--amber)',
        fontWeight: 600
      }
    }, miss, " field", miss > 1 ? 's' : '', " empty \u2014 you'll be asked to confirm");
  })(), React.createElement("span", {
    className: "spacer"
  }), React.createElement("span", {
    style: {
      fontSize: 11.5,
      color: 'var(--faint)'
    }
  }, "Auto-validates totals & non-negative counts"))), mode === 'grid' && React.createElement("div", {
    className: "card-b",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, selector, React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--muted)'
    }
  }, "Spreadsheet entry \u2014 existing months are ", React.createElement("b", null, "editable"), "; change a value then click ", React.createElement("b", null, "Update"), ", or ", React.createElement("b", null, "Delete"), " a month. The highlighted row adds the next new month."), React.createElement("div", {
    style: {
      overflowX: 'auto',
      border: '1px solid var(--line)',
      borderRadius: 9
    }
  }, React.createElement("table", {
    className: "tbl",
    style: {
      minWidth: 620
    }
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Month"), d.cols.map(c => React.createElement("th", {
    key: c.id
  }, c.label)), React.createElement("th", {
    style: {
      textAlign: 'right'
    }
  }, "Actions"))), React.createElement("tbody", null, d.series.slice(-8).map(r => {
    const dirty = !!gridEdits[r.month];
    return React.createElement("tr", {
      key: r.month,
      style: dirty ? {
        background: '#fff8ec'
      } : null
    }, React.createElement("td", {
      style: {
        fontWeight: 600,
        whiteSpace: 'nowrap'
      }
    }, r.full || r.month), d.cols.map(c => React.createElement("td", {
      key: c.id,
      style: {
        padding: 4
      }
    }, React.createElement("input", {
      type: "number",
      min: "0",
      value: gridCell(r.month, c.id, r[c.id]),
      onChange: e => setGridCell(r.month, c.id, e.target.value),
      style: {
        width: '100%',
        minWidth: 60,
        padding: '6px 6px',
        border: '1px solid ' + (dirty ? 'var(--amber)' : 'var(--line)'),
        borderRadius: 5,
        fontFamily: 'IBM Plex Mono',
        fontSize: 13,
        textAlign: 'right',
        outline: 'none',
        background: '#fff'
      }
    }))), React.createElement("td", {
      style: {
        padding: 4,
        whiteSpace: 'nowrap',
        textAlign: 'right'
      }
    }, React.createElement("button", {
      className: "btn sm",
      disabled: !dirty,
      onClick: () => updateMonthRow(r),
      style: {
        opacity: dirty ? 1 : .45
      }
    }, "Update"), React.createElement("button", {
      className: "icon-btn",
      title: "Delete this month",
      style: {
        marginLeft: 5,
        color: 'var(--rose)',
        borderColor: '#f1c6cd'
      },
      onClick: () => delMonthRow(r)
    }, React.createElement(Ic, {
      d: I.x,
      s: 13
    }))));
  }), !isExisting && React.createElement("tr", {
    style: {
      background: 'var(--blue-50)'
    }
  }, React.createElement("td", {
    style: {
      fontWeight: 700,
      color: 'var(--blue)',
      whiteSpace: 'nowrap'
    }
  }, window.UNICO.MONTHS_FULL[month] || month), d.cols.map(c => React.createElement("td", {
    key: c.id,
    style: {
      padding: 4
    }
  }, React.createElement("input", {
    type: "number",
    min: "0",
    value: vals[c.id] ?? '',
    onChange: e => set(c.id, e.target.value),
    style: {
      width: '100%',
      minWidth: 60,
      padding: '6px 6px',
      border: '1px solid ' + (errs[c.id] ? 'var(--rose)' : 'var(--line)'),
      borderRadius: 5,
      fontFamily: 'IBM Plex Mono',
      fontSize: 13,
      textAlign: 'right',
      outline: 'none',
      background: errs[c.id] ? 'var(--neg-bg)' : '#fff'
    }
  }))), React.createElement("td", {
    style: {
      padding: 4,
      textAlign: 'right',
      color: 'var(--blue)',
      fontSize: 11,
      fontWeight: 600
    }
  }, "new"))))), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      alignItems: 'center',
      flexWrap: 'wrap'
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '5px 9px',
      border: '1px solid var(--line)',
      borderRadius: 8,
      background: 'var(--panel-2)'
    }
  }, React.createElement("span", {
    style: {
      fontSize: 11.5,
      fontWeight: 600,
      color: 'var(--ink-2)'
    }
  }, "New row month:"), React.createElement("select", {
    value: parseKey(month).mi,
    onChange: e => setMonth(MONS[+e.target.value] + '-' + String(parseKey(month).yr).slice(-2)),
    style: {
      padding: '5px 7px',
      border: '1px solid var(--line)',
      borderRadius: 6,
      fontSize: 12.5,
      fontFamily: 'inherit',
      background: '#fff'
    }
  }, MONS.map((mn, i) => React.createElement("option", {
    key: mn,
    value: i
  }, mn))), React.createElement("select", {
    value: parseKey(month).yr,
    onChange: e => setMonth(MONS[parseKey(month).mi] + '-' + String(+e.target.value).slice(-2)),
    style: {
      padding: '5px 7px',
      border: '1px solid var(--line)',
      borderRadius: 6,
      fontSize: 12.5,
      fontFamily: 'inherit',
      background: '#fff'
    }
  }, MYEARS.map(y => React.createElement("option", {
    key: y,
    value: y
  }, y))), isExisting && React.createElement("span", {
    className: "tag",
    style: {
      fontSize: 10,
      background: '#fbeed0',
      color: 'var(--amber)'
    }
  }, "already exists \u2014 edit above")), React.createElement("button", {
    className: "btn pri",
    onClick: submit,
    disabled: isExisting,
    style: {
      opacity: isExisting ? .5 : 1
    },
    title: isExisting ? 'This month already exists — edit it in the row above' : ''
  }, React.createElement(Ic, {
    d: I.check,
    s: 16,
    sw: 2.4
  }), "Commit New Row"), React.createElement("button", {
    className: "btn",
    onClick: () => setVals({})
  }, "Reset Row"))), mode === 'wizard' && (() => {
    const steps = ['Select', 'Core metrics', 'Detail metrics', 'Review'];
    const primaryCols = d.cols.filter(c => c.id === d.primary || ['adm', 'reg', 'total'].includes(c.id)).slice(0, 3);
    const otherCols = d.cols.filter(c => !primaryCols.includes(c));
    const next = () => {
      if (step === 1) {
        const e = validate(primaryCols);
        setErrs(e);
        if (Object.keys(e).length) return;
      }
      if (step === 2) {
        const e = validate(otherCols);
        setErrs(e);
        if (Object.keys(e).length) return;
      }
      setStep(s => Math.min(3, s + 1));
    };
    return React.createElement("div", {
      className: "card-b",
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 18
      }
    }, React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 0
      }
    }, steps.map((s, i) => React.createElement(React.Fragment, {
      key: i
    }, React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }
    }, React.createElement("div", {
      style: {
        width: 26,
        height: 26,
        borderRadius: '50%',
        display: 'grid',
        placeItems: 'center',
        fontSize: 12,
        fontWeight: 700,
        background: i < step ? 'var(--green)' : i === step ? 'var(--blue)' : '#e8edf3',
        color: i <= step ? '#fff' : 'var(--muted)'
      }
    }, i < step ? React.createElement(Ic, {
      d: I.check,
      s: 14,
      c: "#fff",
      sw: 3
    }) : i + 1), React.createElement("span", {
      style: {
        fontSize: 12.5,
        fontWeight: 600,
        color: i === step ? 'var(--ink)' : 'var(--muted)'
      }
    }, s)), i < steps.length - 1 && React.createElement("div", {
      style: {
        flex: 1,
        height: 2,
        background: i < step ? 'var(--green)' : '#e8edf3',
        margin: '0 12px'
      }
    })))), React.createElement("div", {
      style: {
        height: 1,
        background: 'var(--line-2)'
      }
    }), step === 0 && React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 16
      }
    }, selector, React.createElement("div", {
      style: {
        fontSize: 12.5,
        color: 'var(--muted)',
        background: 'var(--blue-50)',
        padding: '11px 14px',
        borderRadius: 8
      }
    }, "You're entering data for ", React.createElement("b", {
      style: {
        color: 'var(--ink)'
      }
    }, d.name), " \u2014 ", window.UNICO.MONTHS_FULL[month] || month, ". This wizard captures ", d.cols.length, " metric", d.cols.length > 1 ? 's' : '', " in ", primaryCols.length < d.cols.length ? 'two' : 'one', " stage", primaryCols.length < d.cols.length ? 's' : '', " with validation at each step.")), step === 1 && React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))',
        gap: 14
      }
    }, primaryCols.map((c, i) => React.createElement(NumField, {
      key: c.id,
      col: c,
      value: vals[c.id] ?? '',
      err: errs[c.id],
      autoFocus: i === 0,
      onChange: v => set(c.id, v)
    }))), step === 2 && (otherCols.length ? React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))',
        gap: 14
      }
    }, otherCols.map((c, i) => React.createElement(NumField, {
      key: c.id,
      col: c,
      value: vals[c.id] ?? '',
      err: errs[c.id],
      autoFocus: i === 0,
      onChange: v => set(c.id, v)
    }))) : React.createElement("div", {
      style: {
        fontSize: 13,
        color: 'var(--muted)'
      }
    }, "No additional metrics for this department.")), step === 3 && React.createElement("div", {
      className: "card",
      style: {
        padding: 0,
        overflow: 'hidden'
      }
    }, React.createElement("div", {
      className: "card-h"
    }, React.createElement("h3", null, "Review \u2014 ", d.name, " \xB7 ", window.UNICO.MONTHS_FULL[month] || month)), React.createElement("table", {
      className: "tbl"
    }, React.createElement("tbody", null, d.cols.map(c => React.createElement("tr", {
      key: c.id
    }, React.createElement("td", null, c.label), React.createElement("td", {
      style: {
        fontSize: 14,
        fontWeight: 600,
        color: 'var(--ink)'
      }
    }, vals[c.id] ?? '0', c.pct ? '%' : '')))))), React.createElement("div", {
      style: {
        display: 'flex',
        gap: 10
      }
    }, step > 0 && React.createElement("button", {
      className: "btn",
      onClick: () => setStep(s => s - 1)
    }, "Back"), React.createElement("span", {
      className: "spacer"
    }), step < 3 ? React.createElement("button", {
      className: "btn pri",
      onClick: next
    }, "Continue", React.createElement(Ic, {
      d: I.arrowR,
      s: 15
    })) : React.createElement("button", {
      className: "btn pri",
      onClick: submit
    }, React.createElement(Ic, {
      d: I.check,
      s: 16,
      sw: 2.4
    }), "Confirm & Save")));
  })()), React.createElement("div", {
    className: "card",
    style: {
      overflow: 'hidden'
    }
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, "Recent Submissions"), React.createElement("span", {
    className: "sub"
  }, "this session"), React.createElement("span", {
    className: "spacer"
  }), React.createElement("span", {
    className: "tag num"
  }, entries.length, " saved")), entries.length === 0 ? React.createElement("div", {
    className: "card-b",
    style: {
      textAlign: 'center',
      color: 'var(--faint)',
      padding: '30px'
    }
  }, React.createElement(Ic, {
    d: I.doc,
    s: 30,
    c: "#c4ccd6"
  }), React.createElement("div", {
    style: {
      marginTop: 8,
      fontSize: 13
    }
  }, "No entries yet \u2014 saved rows will appear here.")) : React.createElement("table", {
    className: "tbl"
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Department"), React.createElement("th", null, "Month"), React.createElement("th", null, "Primary metric"), React.createElement("th", null, "Fields"), React.createElement("th", null, "Saved"))), React.createElement("tbody", null, entries.slice().reverse().map((e, i) => {
    const dd = depts.find(x => x.id === e.dept);
    return React.createElement("tr", {
      key: i
    }, React.createElement("td", null, e.deptName), React.createElement("td", null, e.full), React.createElement("td", null, dd ? fmt((e.row || {})[dd.primary] || 0) : '—'), React.createElement("td", null, Object.keys(e.row || {}).length), React.createElement("td", {
      style: {
        color: 'var(--green)'
      }
    }, "\u2713 ", new Date(e.ts).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    })));
  })))), toast && React.createElement(Toast, {
    msg: toast,
    onDone: () => setToast(null)
  }));
}
window.DataEntry = DataEntry;
})();
;
/* ===== login.jsx ===== */
(function(){
const {
  useState,
  useRef,
  useEffect
} = React;
const UNICO_LOCK_KEY = 'unico_lock_v1';
function unicoPinHash(pin) {
  let h = 0x811c9dc5;
  const s = 'unico:' + String(pin == null ? '' : pin);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
  }
  return (h >>> 0).toString(16);
}
function unicoLockRead() {
  try {
    const raw = localStorage.getItem(UNICO_LOCK_KEY);
    if (!raw) return {
      enabled: false,
      hash: ''
    };
    const o = JSON.parse(raw);
    return {
      enabled: !!(o && o.enabled),
      hash: o && typeof o.hash === 'string' ? o.hash : ''
    };
  } catch (e) {
    return {
      enabled: false,
      hash: ''
    };
  }
}
function unicoLockWrite(state) {
  try {
    localStorage.setItem(UNICO_LOCK_KEY, JSON.stringify({
      enabled: !!state.enabled,
      hash: state.hash || ''
    }));
  } catch (e) {}
}
const unicoLock = {
  isEnabled() {
    const s = unicoLockRead();
    return !!(s.enabled && s.hash);
  },
  hasPin() {
    return !!unicoLockRead().hash;
  },
  verify(pin) {
    const s = unicoLockRead();
    if (!s.hash) return false;
    return unicoPinHash(pin) === s.hash;
  },
  setPin(pin) {
    unicoLockWrite({
      enabled: true,
      hash: unicoPinHash(pin)
    });
  },
  disable() {
    const s = unicoLockRead();
    unicoLockWrite({
      enabled: false,
      hash: s.hash
    });
  }
};
function LockGlyph({
  s = 24,
  c = 'currentColor',
  sw = 1.9,
  open = false
}) {
  return React.createElement("svg", {
    width: s,
    height: s,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: c,
    strokeWidth: sw,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true"
  }, React.createElement("rect", {
    x: "4",
    y: "11",
    width: "16",
    height: "10",
    rx: "2"
  }), open ? React.createElement("path", {
    d: "M8 11V7a4 4 0 017.9-1"
  }) : React.createElement("path", {
    d: "M8 11V7a4 4 0 018 0v4"
  }), React.createElement("circle", {
    cx: "12",
    cy: "16",
    r: "1.1"
  }));
}
function LockScreen({
  onUnlock
}) {
  const setup = !unicoLock.hasPin();
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState('');
  const [shake, setShake] = useState(false);
  const pinRef = useRef(null);
  useEffect(() => {
    if (pinRef.current) pinRef.current.focus();
  }, []);
  const fail = msg => {
    setErr(msg);
    setShake(false);
    requestAnimationFrame(() => requestAnimationFrame(() => setShake(true)));
  };
  const onlyDigits = v => v.replace(/[^0-9]/g, '').slice(0, 12);
  const submit = e => {
    if (e && e.preventDefault) e.preventDefault();
    if (setup) {
      if (pin.length < 4) {
        fail('PIN must be at least 4 digits.');
        return;
      }
      if (pin !== confirm) {
        fail('PINs do not match.');
        return;
      }
      unicoLock.setPin(pin);
      onUnlock && onUnlock();
      return;
    }
    if (unicoLock.verify(pin)) {
      onUnlock && onUnlock();
    } else {
      setPin('');
      fail('Incorrect PIN. Please try again.');
      if (pinRef.current) pinRef.current.focus();
    }
  };
  return React.createElement("div", {
    style: S.gate
  }, React.createElement("div", {
    style: S.bgGlow
  }), React.createElement("form", {
    style: {
      ...S.card,
      ...(shake ? S.shake : null)
    },
    onSubmit: submit,
    className: "anim-pop"
  }, React.createElement("div", {
    style: S.logoWrap
  }, React.createElement("img", {
    src: "unico/logo.svg",
    alt: "UNICO Healthcare",
    style: S.logo
  })), React.createElement("div", {
    style: S.badge
  }, React.createElement(LockGlyph, {
    s: 22,
    c: "#fff",
    open: false
  })), React.createElement("h1", {
    style: S.title
  }, setup ? 'Secure this workstation' : 'Workstation locked'), React.createElement("p", {
    style: S.sub
  }, setup ? 'Create a numeric PIN to protect access to the UNICO statistics suite on this device.' : 'Enter your PIN to continue. Statistics, staff and quality data remain protected.'), React.createElement("div", {
    style: S.fieldGrp
  }, React.createElement("label", {
    style: S.label
  }, setup ? 'New PIN' : 'PIN'), React.createElement("input", {
    ref: pinRef,
    type: "password",
    inputMode: "numeric",
    autoComplete: "off",
    placeholder: "\u2022\u2022\u2022\u2022",
    value: pin,
    onChange: e => {
      setPin(onlyDigits(e.target.value));
      if (err) setErr('');
    },
    style: S.input
  })), setup && React.createElement("div", {
    style: S.fieldGrp
  }, React.createElement("label", {
    style: S.label
  }, "Confirm PIN"), React.createElement("input", {
    type: "password",
    inputMode: "numeric",
    autoComplete: "off",
    placeholder: "\u2022\u2022\u2022\u2022",
    value: confirm,
    onChange: e => {
      setConfirm(onlyDigits(e.target.value));
      if (err) setErr('');
    },
    style: S.input
  })), err ? React.createElement("div", {
    style: S.err
  }, React.createElement(LockGlyph, {
    s: 14,
    c: "#ffb4be",
    open: true
  }), " ", err) : React.createElement("div", {
    style: S.errPlaceholder
  }), React.createElement("button", {
    type: "submit",
    className: "btn pri",
    style: S.action
  }, React.createElement(LockGlyph, {
    s: 16,
    c: "#fff",
    open: true
  }), setup ? 'Set PIN & continue' : 'Unlock'), React.createElement("div", {
    style: S.foot
  }, React.createElement("div", {
    style: S.dot
  }), React.createElement("span", null, "Nasif Ahammed Niloy \xB7 Administrator"))), React.createElement("div", {
    style: S.legal
  }, "UNICO Healthcare \xB7 Offline statistics suite \xB7 Single-user device lock"), React.createElement("style", null, `@keyframes unicoShake{
        10%,90%{transform:translateX(-1px)} 20%,80%{transform:translateX(2px)}
        30%,50%,70%{transform:translateX(-5px)} 40%,60%{transform:translateX(5px)}
      }`));
}
const S = {
  gate: {
    position: 'fixed',
    inset: 0,
    zIndex: 3000,
    background: '#0d1b2e',
    backgroundImage: 'radial-gradient(1100px 700px at 18% -10%, rgba(39,168,219,.16), transparent 60%), radial-gradient(900px 600px at 110% 120%, rgba(58,181,167,.14), transparent 55%)',
    display: 'grid',
    placeItems: 'center',
    padding: 24,
    overflow: 'auto'
  },
  bgGlow: {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    background: 'linear-gradient(180deg, rgba(13,27,46,0) 40%, rgba(13,27,46,.55) 100%)'
  },
  card: {
    position: 'relative',
    width: 'min(380px,94vw)',
    background: '#ffffff',
    border: '1px solid #e3e9f1',
    borderRadius: 18,
    padding: '30px 30px 22px',
    boxShadow: '0 24px 60px rgba(5,12,24,.55), 0 2px 0 rgba(255,255,255,.04) inset',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center'
  },
  shake: {
    animation: 'unicoShake .5s cubic-bezier(.36,.07,.19,.97) both'
  },
  logoWrap: {
    marginBottom: 18
  },
  logo: {
    height: 38,
    width: 'auto',
    display: 'block'
  },
  badge: {
    width: 52,
    height: 52,
    borderRadius: 14,
    display: 'grid',
    placeItems: 'center',
    background: 'linear-gradient(135deg,#27a8db,#0072a3)',
    color: '#fff',
    boxShadow: '0 8px 20px rgba(0,144,202,.45)',
    marginBottom: 14
  },
  title: {
    margin: '0 0 6px',
    fontSize: 18,
    fontWeight: 700,
    color: '#16202e',
    letterSpacing: '.1px'
  },
  sub: {
    margin: '0 0 18px',
    fontSize: 12.5,
    lineHeight: 1.5,
    color: '#6c7a8c',
    maxWidth: 300
  },
  fieldGrp: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
    marginBottom: 11,
    textAlign: 'left'
  },
  label: {
    fontSize: 11.5,
    fontWeight: 600,
    color: '#3c4858'
  },
  input: {
    width: '100%',
    padding: '11px 13px',
    border: '1px solid #dde3ec',
    borderRadius: 9,
    fontFamily: 'inherit',
    fontSize: 18,
    letterSpacing: '.35em',
    textAlign: 'center',
    background: '#f7f9fc',
    color: '#16202e',
    outline: 'none',
    boxSizing: 'border-box'
  },
  err: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 20,
    margin: '2px 0 10px',
    fontSize: 12,
    fontWeight: 600,
    color: '#ffd2d8',
    background: 'rgba(210,58,82,.16)',
    border: '1px solid rgba(210,58,82,.35)',
    borderRadius: 8,
    padding: '7px 10px',
    boxSizing: 'border-box'
  },
  errPlaceholder: {
    minHeight: 20,
    margin: '2px 0 10px'
  },
  action: {
    width: '100%',
    justifyContent: 'center',
    padding: '11px 13px',
    fontSize: 13.5
  },
  foot: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    fontSize: 11.5,
    color: '#9aa6b4'
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#3ddc97',
    boxShadow: '0 0 0 3px rgba(61,220,151,.18)'
  },
  legal: {
    position: 'absolute',
    bottom: 18,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 10.5,
    letterSpacing: '.4px',
    color: '#5b6b80'
  }
};
window.unicoLock = unicoLock;
window.LockScreen = LockScreen;
})();
;
/* ===== auth-login.jsx ===== */
(function(){
(function () {
  const API_KEY = 'unico_api_base',
    TOK_KEY = 'unico_session_token',
    USER_KEY = 'unico_session_user';
  const read = k => {
    try {
      return localStorage.getItem(k) || '';
    } catch (e) {
      return '';
    }
  };
  const write = (k, v) => {
    try {
      v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v);
    } catch (e) {}
  };
  const trimBase = u => (u || '').trim().replace(/\/+$/, '');
  const DATA_EXCLUDE = ['unico_api_base', 'unico_session_token', 'unico_session_user', 'unico_lock_v1'];
  function appSnapshot() {
    const o = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.indexOf('unico') === 0 && DATA_EXCLUDE.indexOf(k) < 0) o[k] = localStorage.getItem(k);
      }
    } catch (e) {}
    return o;
  }
  const unicoSession = {
    serverUrl() {
      return trimBase(read(API_KEY)) || trimBase(typeof window !== 'undefined' && window.UNICO_DEFAULT_API || '');
    },
    setServerUrl(u) {
      write(API_KEY, trimBase(u));
    },
    configured() {
      return !!trimBase(typeof window !== 'undefined' && window.UNICO_DEFAULT_API || '');
    },
    token() {
      return read(TOK_KEY);
    },
    user() {
      try {
        return JSON.parse(read(USER_KEY) || 'null');
      } catch (e) {
        return null;
      }
    },
    isAuthed() {
      return !!unicoSession.token();
    },
    async login(username, password) {
      const base = unicoSession.serverUrl();
      if (!base) return {
        ok: false,
        error: 'No server URL is configured.'
      };
      let r;
      try {
        r = await fetch(base + '/api/login', {
          method: 'POST',
          headers: {
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            username,
            password
          })
        });
      } catch (e) {
        return {
          ok: false,
          error: 'Cannot reach the server. Check the URL and your connection.'
        };
      }
      let data;
      try {
        data = await r.json();
      } catch (e) {
        data = {};
      }
      if (!r.ok || !data.ok) return {
        ok: false,
        error: data.error || 'Login failed (' + r.status + ').'
      };
      write(TOK_KEY, data.token);
      write(USER_KEY, JSON.stringify(data.user || {}));
      return {
        ok: true,
        user: data.user
      };
    },
    async verify() {
      const base = unicoSession.serverUrl(),
        tok = unicoSession.token();
      if (!base || !tok) return false;
      try {
        const r = await fetch(base + '/api/me', {
          headers: {
            authorization: 'Bearer ' + tok
          }
        });
        if (r.status === 401) return false;
        const d = await r.json();
        return !!(r.ok && d.ok);
      } catch (e) {
        return null;
      }
    },
    async pullData() {
      const base = unicoSession.serverUrl(),
        tok = unicoSession.token();
      if (!base || !tok) return {
        ok: false
      };
      try {
        const r = await fetch(base + '/api/data', {
          headers: {
            authorization: 'Bearer ' + tok
          }
        });
        const d = await r.json();
        if (r.ok && d.ok && d.data && typeof d.data === 'object') {
          let n = 0;
          Object.keys(d.data).forEach(k => {
            if (DATA_EXCLUDE.indexOf(k) < 0) {
              try {
                localStorage.setItem(k, d.data[k]);
                n++;
              } catch (e) {}
            }
          });
          return {
            ok: true,
            count: n,
            updatedAt: d.updatedAt
          };
        }
        return {
          ok: true,
          count: 0
        };
      } catch (e) {
        return {
          ok: false,
          error: String(e)
        };
      }
    },
    async pushData() {
      const base = unicoSession.serverUrl(),
        tok = unicoSession.token();
      if (!base || !tok) return {
        ok: false
      };
      try {
        const r = await fetch(base + '/api/data', {
          method: 'PUT',
          headers: {
            'content-type': 'application/json',
            authorization: 'Bearer ' + tok
          },
          body: JSON.stringify({
            data: appSnapshot()
          })
        });
        const d = await r.json();
        return {
          ok: !!(r.ok && d.ok),
          updatedAt: d.updatedAt
        };
      } catch (e) {
        return {
          ok: false,
          error: String(e)
        };
      }
    },
    logout() {
      write(TOK_KEY, null);
      write(USER_KEY, null);
      try {
        window.dispatchEvent(new Event('unico:logout'));
      } catch (e) {}
    }
  };
  window.unicoSession = unicoSession;
  function CloudLogin({
    onLogin
  }) {
    const [u, setU] = React.useState('');
    const [p, setP] = React.useState('');
    const [busy, setBusy] = React.useState(false);
    const [err, setErr] = React.useState('');
    const [cfgOpen, setCfgOpen] = React.useState(!unicoSession.serverUrl());
    const [srv, setSrv] = React.useState(unicoSession.serverUrl() || 'http://localhost:4000');
    const uRef = React.useRef(null);
    React.useEffect(() => {
      if (uRef.current) uRef.current.focus();
    }, []);
    const submit = async e => {
      if (e && e.preventDefault) e.preventDefault();
      unicoSession.setServerUrl(srv);
      if (!srv.trim()) {
        setErr('Enter the server address first.');
        setCfgOpen(true);
        return;
      }
      if (!u.trim() || !p) {
        setErr('Enter your username and password.');
        return;
      }
      setBusy(true);
      setErr('');
      const res = await unicoSession.login(u.trim(), p);
      if (!res.ok) {
        setBusy(false);
        setErr(res.error || 'Login failed.');
        return;
      }
      const pulled = await unicoSession.pullData();
      if (!pulled || !pulled.count) {
        await unicoSession.pushData();
      }
      try {
        window.location.reload();
      } catch (e) {
        setBusy(false);
        onLogin && onLogin(res.user);
      }
    };
    return React.createElement("div", {
      style: S.gate
    }, React.createElement("div", {
      style: S.bgGlow
    }), React.createElement("form", {
      style: S.card,
      onSubmit: submit,
      className: "anim-pop"
    }, React.createElement("div", {
      style: {
        marginBottom: 16
      }
    }, React.createElement("img", {
      src: "unico/logo.svg",
      alt: "UNICO Healthcare",
      style: {
        height: 38
      }
    })), React.createElement("div", {
      style: S.badge
    }, React.createElement("svg", {
      width: "22",
      height: "22",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "#fff",
      strokeWidth: "1.9",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M12 12a4 4 0 100-8 4 4 0 000 8z"
    }), React.createElement("path", {
      d: "M4 21a8 8 0 0116 0"
    }))), React.createElement("h1", {
      style: S.title
    }, "Sign in"), React.createElement("p", {
      style: S.sub
    }, "Log in to the UNICO Statistics Suite with your account."), React.createElement("div", {
      style: S.grp
    }, React.createElement("label", {
      style: S.label
    }, "Username"), React.createElement("input", {
      ref: uRef,
      value: u,
      autoComplete: "username",
      onChange: e => {
        setU(e.target.value);
        if (err) setErr('');
      },
      style: S.input,
      placeholder: "your username"
    })), React.createElement("div", {
      style: S.grp
    }, React.createElement("label", {
      style: S.label
    }, "Password"), React.createElement("input", {
      type: "password",
      value: p,
      autoComplete: "current-password",
      onChange: e => {
        setP(e.target.value);
        if (err) setErr('');
      },
      style: S.input,
      placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
    })), err ? React.createElement("div", {
      style: S.err
    }, err) : React.createElement("div", {
      style: {
        minHeight: 18,
        margin: '2px 0 8px'
      }
    }), React.createElement("button", {
      type: "submit",
      className: "btn pri",
      style: S.action,
      disabled: busy
    }, busy ? 'Signing in…' : 'Sign in'), React.createElement("button", {
      type: "button",
      onClick: () => setCfgOpen(o => !o),
      style: S.cfgToggle
    }, cfgOpen ? 'Hide server settings' : 'Server settings'), cfgOpen && React.createElement("div", {
      style: S.cfgBox
    }, React.createElement("label", {
      style: {
        ...S.label,
        color: '#9aa6b4'
      }
    }, "Auth server address"), React.createElement("input", {
      value: srv,
      onChange: e => setSrv(e.target.value),
      style: {
        ...S.input,
        fontSize: 13,
        letterSpacing: 0,
        textAlign: 'left'
      },
      placeholder: "https://your-server.example.com"
    }), React.createElement("div", {
      style: {
        fontSize: 10.5,
        color: '#7e8da0',
        marginTop: 6,
        lineHeight: 1.5
      }
    }, "Where your UNICO auth server is running. Set once per device. The database connection lives on that server \u2014 never in this app."))), React.createElement("div", {
      style: S.legal
    }, "UNICO Healthcare \xB7 Statistics Suite \xB7 Secure account sign-in"));
  }
  window.CloudLogin = CloudLogin;
  const S = {
    gate: {
      position: 'fixed',
      inset: 0,
      zIndex: 3000,
      background: '#0d1b2e',
      backgroundImage: 'radial-gradient(1100px 700px at 18% -10%, rgba(39,168,219,.16), transparent 60%), radial-gradient(900px 600px at 110% 120%, rgba(58,181,167,.14), transparent 55%)',
      display: 'grid',
      placeItems: 'center',
      padding: 24,
      overflow: 'auto'
    },
    bgGlow: {
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      background: 'linear-gradient(180deg, rgba(13,27,46,0) 40%, rgba(13,27,46,.55) 100%)'
    },
    card: {
      position: 'relative',
      width: 'min(380px,94vw)',
      background: '#fff',
      border: '1px solid #e3e9f1',
      borderRadius: 18,
      padding: '30px 30px 22px',
      boxShadow: '0 24px 60px rgba(5,12,24,.55)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center'
    },
    badge: {
      width: 52,
      height: 52,
      borderRadius: 14,
      display: 'grid',
      placeItems: 'center',
      background: 'linear-gradient(135deg,#27a8db,#0072a3)',
      boxShadow: '0 8px 20px rgba(0,144,202,.45)',
      marginBottom: 14
    },
    title: {
      margin: '0 0 6px',
      fontSize: 18,
      fontWeight: 700,
      color: '#16202e'
    },
    sub: {
      margin: '0 0 18px',
      fontSize: 12.5,
      lineHeight: 1.5,
      color: '#6c7a8c',
      maxWidth: 300
    },
    grp: {
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: 5,
      marginBottom: 11,
      textAlign: 'left'
    },
    label: {
      fontSize: 11.5,
      fontWeight: 600,
      color: '#3c4858'
    },
    input: {
      width: '100%',
      padding: '11px 13px',
      border: '1px solid #dde3ec',
      borderRadius: 9,
      fontFamily: 'inherit',
      fontSize: 14,
      background: '#f7f9fc',
      color: '#16202e',
      outline: 'none',
      boxSizing: 'border-box'
    },
    err: {
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      minHeight: 18,
      margin: '2px 0 8px',
      fontSize: 12,
      fontWeight: 600,
      color: '#b4232f',
      background: 'rgba(210,58,82,.10)',
      border: '1px solid rgba(210,58,82,.3)',
      borderRadius: 8,
      padding: '7px 10px',
      boxSizing: 'border-box'
    },
    action: {
      width: '100%',
      justifyContent: 'center',
      padding: '11px 13px',
      fontSize: 13.5
    },
    cfgToggle: {
      marginTop: 12,
      background: 'none',
      border: 0,
      color: '#0072a3',
      fontSize: 11.5,
      fontWeight: 600,
      cursor: 'pointer'
    },
    cfgBox: {
      width: '100%',
      marginTop: 8,
      background: '#f3f6fa',
      border: '1px solid #e3e9f1',
      borderRadius: 10,
      padding: '11px 12px',
      textAlign: 'left'
    },
    legal: {
      position: 'absolute',
      bottom: 18,
      left: 0,
      right: 0,
      textAlign: 'center',
      fontSize: 10.5,
      letterSpacing: '.4px',
      color: '#5b6b80'
    }
  };
  (function autoSync() {
    if (!(unicoSession.configured() && unicoSession.isAuthed())) return;
    let last = '';
    try {
      last = JSON.stringify(appSnapshot());
    } catch (e) {}
    setInterval(() => {
      try {
        const snap = JSON.stringify(appSnapshot());
        if (snap !== last) {
          last = snap;
          unicoSession.pushData();
        }
      } catch (e) {}
    }, 15000);
  })();
})();
})();
;
/* ===== search.jsx ===== */
(function(){
(function () {
  const {
    useState,
    useEffect,
    useRef,
    useMemo
  } = React;
  const AV_COLORS = [['#3ab5a7', '#0090ca'], ['#6a52d4', '#27a8db'], ['#e08a1e', '#d23a52'], ['#0090ca', '#0072a3'], ['#1f9d57', '#3ab5a7'], ['#d23a52', '#6a52d4']];
  function initials(name) {
    const p = (name || '').trim().split(/\s+/);
    return ((p[0]?.[0] || '') + (p[1]?.[0] || p[0]?.[1] || '')).toUpperCase() || '?';
  }
  function avColor(seed) {
    let h = 0;
    const s = String(seed);
    for (let i = 0; i < s.length; i++) h = h * 31 + s.charCodeAt(i) >>> 0;
    return AV_COLORS[h % AV_COLORS.length];
  }
  function matches(q, ...fields) {
    if (!q) return true;
    const t = q.toLowerCase();
    return fields.some(f => f && String(f).toLowerCase().includes(t));
  }
  const PAGES = [{
    id: 'pg-dashboard',
    label: 'Dashboard',
    hint: 'Overview',
    route: {
      view: 'dashboard'
    }
  }, {
    id: 'pg-compare',
    label: 'Compare',
    hint: 'Department compare',
    route: {
      view: 'compare'
    }
  }, {
    id: 'pg-input',
    label: 'Data Entry',
    hint: 'Enter statistics',
    route: {
      view: 'input'
    }
  }, {
    id: 'pg-reports',
    label: 'Reports',
    hint: 'Export & print',
    route: {
      view: 'reports'
    }
  }, {
    id: 'pg-quality',
    label: 'Quality',
    hint: 'Quality indicators',
    route: {
      view: 'quality'
    }
  }, {
    id: 'pg-nurses',
    label: 'Nurse Directory',
    hint: 'Nursing staff',
    route: {
      view: 'nurses'
    }
  }, {
    id: 'pg-pca',
    label: 'PCA Directory',
    hint: 'Patient care assistants',
    route: {
      view: 'pca'
    }
  }, {
    id: 'pg-settings',
    label: 'Settings',
    hint: 'Configuration',
    route: {
      view: 'settings'
    }
  }];
  function GlobalSearch({
    setRoute,
    depts
  }) {
    const staffStore = window.useStaffStore ? window.useStaffStore() : {
      staff: []
    };
    const allStaff = staffStore && staffStore.staff || [];
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState('');
    const [sel, setSel] = useState(0);
    const inputRef = useRef(null);
    const listRef = useRef(null);
    useEffect(() => {
      function onKey(e) {
        const k = (e.key || '').toLowerCase();
        if ((e.ctrlKey || e.metaKey) && k === 'k') {
          e.preventDefault();
          setOpen(o => !o);
        } else if (k === 'escape') {
          setOpen(false);
        }
      }
      function onOpen() {
        setOpen(true);
      }
      window.addEventListener('keydown', onKey);
      window.addEventListener('unico:open-search', onOpen);
      return () => {
        window.removeEventListener('keydown', onKey);
        window.removeEventListener('unico:open-search', onOpen);
      };
    }, []);
    useEffect(() => {
      if (open) {
        setQ('');
        setSel(0);
        const id = setTimeout(() => inputRef.current && inputRef.current.focus(), 20);
        return () => clearTimeout(id);
      }
    }, [open]);
    const groups = useMemo(() => {
      const qd = depts || [];
      const qual = (window.QUALITY_SEED || []).filter(d => d.indicators && d.indicators.length);
      const CAP = 6;
      const pages = PAGES.filter(p => matches(q, p.label, p.hint));
      const dList = qd.filter(d => matches(q, d.name, d.short, d.group)).slice(0, CAP);
      const sList = allStaff.filter(e => e.is_active !== false && matches(q, e.name, e.role, e.current_department, e.designation, e.emp_id)).slice(0, CAP);
      const qList = qual.filter(d => matches(q, d.name, d.key, d.overallStatus)).slice(0, CAP);
      const out = [];
      if (pages.length) out.push({
        key: 'pages',
        title: q ? 'Pages & Actions' : 'Quick actions',
        total: pages.length,
        items: pages.map(p => ({
          id: p.id,
          kind: 'page',
          label: p.label,
          sub: p.hint,
          icon: I.grid,
          route: p.route
        }))
      });
      if (dList.length) out.push({
        key: 'depts',
        title: 'Departments',
        total: qd.filter(d => matches(q, d.name, d.short, d.group)).length,
        items: dList.map(d => ({
          id: 'd-' + d.id,
          kind: 'dept',
          label: d.name,
          sub: (d.short || '') + (d.group ? ' · ' + d.group : ''),
          icon: window.DEPT_ICON && window.DEPT_ICON[d.id] || I.layers,
          route: {
            view: 'departments',
            dept: d.id
          }
        }))
      });
      if (sList.length) out.push({
        key: 'staff',
        title: 'Staff',
        total: allStaff.filter(e => e.is_active !== false && matches(q, e.name, e.role, e.current_department, e.designation, e.emp_id)).length,
        items: sList.map(e => ({
          id: 's-' + e.id,
          kind: 'staff',
          label: e.name,
          sub: [e.role, e.designation, e.current_department].filter(Boolean).join(' · '),
          avatar: e.name,
          route: {
            view: 'staffProfile',
            emp: e.id
          }
        }))
      });
      if (qList.length) out.push({
        key: 'quality',
        title: 'Quality departments',
        total: qual.filter(d => matches(q, d.name, d.key, d.overallStatus)).length,
        items: qList.map(d => ({
          id: 'q-' + d.key,
          kind: 'quality',
          label: d.name,
          sub: (d.overallStatus ? d.overallStatus + ' · ' : '') + (d.indicators.length + ' indicators'),
          icon: I.heart,
          route: {
            view: 'quality',
            qview: 'reports',
            dept: d.key
          }
        }))
      });
      return out;
    }, [q, depts, allStaff]);
    const flat = useMemo(() => {
      const f = [];
      groups.forEach(g => g.items.forEach(it => f.push(it)));
      return f;
    }, [groups]);
    useEffect(() => {
      if (sel > flat.length - 1) setSel(Math.max(0, flat.length - 1));
    }, [flat.length, sel]);
    function activate(item) {
      if (!item) return;
      setOpen(false);
      setRoute(item.route);
    }
    function onListKey(e) {
      const k = (e.key || '').toLowerCase();
      if (k === 'arrowdown') {
        e.preventDefault();
        setSel(s => Math.min(flat.length - 1, s + 1));
      } else if (k === 'arrowup') {
        e.preventDefault();
        setSel(s => Math.max(0, s - 1));
      } else if (k === 'enter') {
        e.preventDefault();
        activate(flat[sel]);
      }
    }
    useEffect(() => {
      if (!open || !listRef.current) return;
      const node = listRef.current.querySelector('[data-idx="' + sel + '"]');
      if (node && node.scrollIntoView) node.scrollIntoView({
        block: 'nearest'
      });
    }, [sel, open]);
    if (!open) return null;
    let idx = -1;
    return React.createElement("div", {
      className: "gs-backdrop",
      onMouseDown: e => {
        if (e.target === e.currentTarget) setOpen(false);
      }
    }, React.createElement("div", {
      className: "gs-palette",
      role: "dialog",
      "aria-label": "Global search",
      onKeyDown: onListKey
    }, React.createElement("div", {
      className: "gs-input"
    }, React.createElement(Ic, {
      d: I.search,
      s: 18,
      c: "var(--muted)"
    }), React.createElement("input", {
      ref: inputRef,
      value: q,
      onChange: e => {
        setQ(e.target.value);
        setSel(0);
      },
      placeholder: "Search departments, staff, quality\u2026",
      spellCheck: false
    }), React.createElement("span", {
      className: "gs-kbd"
    }, "Esc")), React.createElement("div", {
      className: "gs-results",
      ref: listRef
    }, flat.length === 0 ? React.createElement("div", {
      className: "gs-empty"
    }, "No matches for \u201C", q, "\u201D.") : groups.map(g => React.createElement("div", {
      key: g.key,
      className: "gs-group"
    }, React.createElement("div", {
      className: "gs-group-h"
    }, React.createElement("span", null, g.title), React.createElement("span", {
      className: "gs-count num"
    }, g.total)), g.items.map(it => {
      idx++;
      const i = idx;
      const active = i === sel;
      const col = it.avatar ? avColor(it.avatar) : null;
      return React.createElement("div", {
        key: it.id,
        "data-idx": i,
        className: 'gs-row' + (active ? ' active' : ''),
        onMouseEnter: () => setSel(i),
        onMouseDown: e => {
          e.preventDefault();
          activate(it);
        }
      }, it.avatar ? window.MK && window.MK.Av ? React.createElement(window.MK.Av, {
        name: it.avatar,
        size: 34,
        radius: 9,
        style: {
          fontSize: 12.5
        }
      }) : React.createElement("div", {
        className: "avatar gs-av",
        style: {
          background: `linear-gradient(135deg,${col[0]},${col[1]})`
        }
      }, initials(it.avatar)) : React.createElement("div", {
        className: "gs-ic"
      }, React.createElement(Ic, {
        d: it.icon || I.arrowR,
        s: 17
      })), React.createElement("div", {
        className: "gs-text"
      }, React.createElement("div", {
        className: "gs-label"
      }, it.label), it.sub && React.createElement("div", {
        className: "gs-sub"
      }, it.sub)), active && React.createElement("span", {
        className: "gs-enter"
      }, React.createElement(Ic, {
        d: I.arrowR,
        s: 14,
        c: "var(--blue)"
      })));
    })))), React.createElement("div", {
      className: "gs-foot"
    }, React.createElement("span", {
      className: "gs-tip"
    }, React.createElement("span", {
      className: "gs-kbd"
    }, "\u2191"), React.createElement("span", {
      className: "gs-kbd"
    }, "\u2193"), " navigate \xB7 ", React.createElement("span", {
      className: "gs-kbd"
    }, "\u21B5"), " open"), React.createElement("span", {
      className: "gs-tip"
    }, q ? `${flat.length} result${flat.length === 1 ? '' : 's'}` : 'Type to search · Esc to close'))));
  }
  window.GlobalSearch = GlobalSearch;
})();
})();
;
/* ===== monitor.jsx ===== */
(function(){
(function installSaveFailureReporter() {
  const n = window.unicoNative;
  if (!n || typeof n.persist !== 'function' || n.__monitorWrapped) return;
  const QUEUE = 'uncmon_pending_v1';
  const recent = {};
  const read = () => {
    try {
      const q = JSON.parse(localStorage.getItem(QUEUE));
      return Array.isArray(q) ? q : [];
    } catch (e) {
      return [];
    }
  };
  const write = q => {
    try {
      localStorage.setItem(QUEUE, JSON.stringify(q.slice(-20)));
    } catch (e) {}
  };
  const send = ev => fetch('/api/monitor/event', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(ev)
  }).then(r => {
    if (r.status >= 500 || r.status === 0) throw new Error('retry');
    return true;
  });
  const flush = () => {
    const q = read();
    if (!q.length) return;
    write([]);
    q.reduce((p, ev) => p.then(() => send(ev)).catch(() => {
      write(read().concat([ev]));
    }), Promise.resolve());
  };
  const report = r => {
    const detail = String(r && r.error || 'The database did not confirm the save.');
    if (/session expired/i.test(detail)) return;
    const kind = r && r.conflict ? 'save_conflict' : r && r.forbidden ? 'save_forbidden' : 'save_failed';
    const sig = kind + '|' + detail;
    const now = Date.now();
    if (recent[sig] && now - recent[sig] < 120000) return;
    recent[sig] = now;
    const ev = {
      kind,
      detail,
      keys: r && Array.isArray(r.conflicted) ? r.conflicted : [],
      page: location.pathname + location.hash,
      at: now
    };
    send(ev).catch(() => write(read().concat([ev])));
  };
  const orig = n.persist;
  n.persist = function () {
    const p = orig.apply(this, arguments);
    try {
      Promise.resolve(p).then(r => {
        if (r && r.ok === false) report(r);
      }, () => {});
    } catch (e) {}
    return p;
  };
  n.__monitorWrapped = true;
  window.addEventListener('online', flush);
  setTimeout(flush, 5000);
})();
function SystemMonitor() {
  const [d, setD] = React.useState(null);
  const [err, setErr] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [running, setRunning] = React.useState(false);
  const [open, setOpen] = React.useState({});
  const load = React.useCallback(() => {
    setBusy(true);
    setErr('');
    fetch('/api/monitor/status', {
      credentials: 'same-origin',
      cache: 'no-store'
    }).then(r => r.json()).then(j => {
      if (j && j.ok) setD(j);else setErr(j && j.error || 'Could not load the monitor.');
    }).catch(() => setErr('Could not reach the server.')).finally(() => setBusy(false));
  }, []);
  React.useEffect(() => {
    load();
  }, [load]);
  const runNow = () => {
    setRunning(true);
    setErr('');
    fetch('/api/monitor/run', {
      method: 'POST',
      credentials: 'same-origin'
    }).then(r => r.json()).then(j => {
      if (!j || !j.ok) setErr(j && j.error || 'The check failed.');
      load();
    }).catch(() => setErr('Could not reach the server.')).finally(() => setRunning(false));
  };
  const when = t => t ? new Date(t).toLocaleString([], {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }) : '—';
  const ago = t => {
    if (!t) return 'never';
    const h = Math.round((Date.now() - t) / 36e5);
    return h < 1 ? 'within the hour' : h < 48 ? h + ' h ago' : Math.round(h / 24) + ' days ago';
  };
  const GOOD = '#157a43',
    WARN = '#b5670a',
    BAD = '#b4232f';
  const tile = (label, val, sub, color) => React.createElement("div", {
    key: label,
    style: {
      background: 'var(--panel-2)',
      borderRadius: 9,
      padding: '10px 13px',
      minWidth: 120,
      flex: '1 1 120px'
    }
  }, React.createElement("div", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: .5,
      textTransform: 'uppercase',
      color: 'var(--muted)'
    }
  }, label), React.createElement("div", {
    className: "num",
    style: {
      fontSize: 19,
      fontWeight: 800,
      color: color || 'var(--ink)',
      marginTop: 2
    }
  }, val), sub && React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: 'var(--faint)',
      marginTop: 1
    }
  }, sub));
  const pill = (text, color) => React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 11.5,
      fontWeight: 700,
      padding: '4px 11px',
      borderRadius: 15,
      color,
      background: color + '1f'
    }
  }, React.createElement("i", {
    style: {
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: color
    }
  }), text);
  const levelColor = l => l === 'alert' ? BAD : WARN;
  const card = (title, sub, body, extra) => React.createElement("div", {
    className: "card",
    style: {
      marginBottom: 14
    }
  }, React.createElement("div", {
    className: "card-b"
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      flexWrap: 'wrap',
      marginBottom: 12
    }
  }, React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 180
    }
  }, React.createElement("div", {
    style: {
      fontSize: 13.5,
      fontWeight: 700,
      color: 'var(--ink)'
    }
  }, title), sub && React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--muted)'
    }
  }, sub)), extra), body));
  if (err && !d) return card('System Monitor', null, React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'var(--rose)',
      fontWeight: 600
    }
  }, err), React.createElement("button", {
    className: "btn sm",
    onClick: load
  }, "Retry"));
  if (!d) return card('System Monitor', null, React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'var(--faint)',
      padding: 14,
      textAlign: 'center'
    }
  }, "Loading\u2026"));
  const h = d.health || {},
    latest = d.latest,
    history = d.history || [],
    events = d.events || [];
  const alerts = latest && latest.alerts || 0;
  const checkStale = !latest || Date.now() - latest.at > 36 * 36e5;
  const recentEvents = events.filter(e => Date.now() - e.at < 7 * 864e5);
  const overall = (d.config || []).some(x => x.level === 'alert') || alerts > 0 ? ['Needs attention', BAD] : recentEvents.length || checkStale ? ['Check the notes below', WARN] : ['All clear', GOOD];
  const findingRow = (x, i, at) => {
    const k = (at || 0) + ':' + i;
    return React.createElement("div", {
      key: k,
      style: {
        borderLeft: '3px solid ' + levelColor(x.level),
        background: 'var(--panel-2)',
        borderRadius: 7,
        padding: '8px 11px'
      }
    }, React.createElement("div", {
      style: {
        display: 'flex',
        gap: 8,
        alignItems: 'baseline',
        flexWrap: 'wrap'
      }
    }, React.createElement("span", {
      style: {
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: .5,
        textTransform: 'uppercase',
        color: levelColor(x.level)
      }
    }, x.level), React.createElement("span", {
      style: {
        fontSize: 10.5,
        color: 'var(--muted)'
      }
    }, x.area, at ? ' · ' + when(at) : '')), React.createElement("div", {
      style: {
        fontSize: 12.5,
        color: 'var(--ink)',
        marginTop: 2
      }
    }, x.message), x.details && x.details.length > 0 && React.createElement("div", {
      style: {
        marginTop: 4
      }
    }, React.createElement("button", {
      className: "btn sm",
      style: {
        fontSize: 11,
        padding: '2px 8px'
      },
      onClick: () => setOpen(o => Object.assign({}, o, {
        [k]: !o[k]
      }))
    }, open[k] ? 'Hide' : 'Show', " ", x.details.length, " name", x.details.length > 1 ? 's' : ''), open[k] && React.createElement("div", {
      style: {
        fontSize: 11.5,
        color: 'var(--ink-2)',
        marginTop: 4,
        lineHeight: 1.6
      }
    }, x.details.join(' · '))));
  };
  const olderFindings = history.slice(1).flatMap(s => (s.findings || []).filter(x => x.area !== 'configuration').map((x, i) => ({
    x,
    i,
    at: s.at
  })));
  const kindLabel = {
    save_failed: 'Save failed',
    save_conflict: 'Save conflict',
    save_forbidden: 'Not permitted',
    save_unconfirmed: 'Not confirmed'
  };
  return React.createElement(React.Fragment, null, card('System Monitor', 'Checks every day that nothing saved has gone missing, and collects save problems from every browser.', React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, err && React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'var(--rose)',
      fontWeight: 600
    }
  }, err), (d.config || []).map((x, i) => findingRow(x, i)), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 9,
      flexWrap: 'wrap'
    }
  }, tile('Database', h.dbMs != null ? h.dbMs + ' ms' : '—', 'reachable now', h.dbMs > 2000 ? WARN : GOOD), tile('Databases in use', h.singleDatabase ? 'One' : 'Two', h.singleDatabase ? 'no split possible' : 'failover is on', h.singleDatabase ? GOOD : BAD), tile('Redis', h.redisConfigured ? 'Configured' : 'Off', h.redisConfigured ? 'not expected' : 'as intended', h.redisConfigured ? WARN : GOOD), tile('Last daily check', latest ? ago(latest.at) : 'never', latest ? when(latest.at) : 'run one now', checkStale ? WARN : GOOD), tile('Backups', h.backup === undefined ? 'Not set up' : h.backup === null ? 'None yet' : h.backup.ok ? ago(h.backup.at) : 'Failed', h.backup && h.backup.at ? when(h.backup.at) : '', h.backup && h.backup.ok ? GOOD : WARN), tile('Keep-alive', ago(h.lastKeepalive), 'database kept awake', h.lastKeepalive && Date.now() - h.lastKeepalive < 50 * 36e5 ? GOOD : WARN))), React.createElement(React.Fragment, null, pill(overall[0], overall[1]), React.createElement("button", {
    className: "btn sm",
    onClick: load,
    disabled: busy
  }, busy ? 'Loading…' : 'Refresh'), React.createElement("button", {
    className: "btn pri sm",
    onClick: runNow,
    disabled: running
  }, running ? 'Checking…' : 'Run check now'))), card('Did anything go missing?', latest ? 'Compared with the previous check' + (history[1] ? ' on ' + when(history[1].at) : '') + '. A deliberate deletion also appears here — the Activity Log shows who made it.' : 'No check has run yet. Run one now; the next one will compare against it.', latest ? React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, latest.findings.filter(x => x.area !== 'configuration').length === 0 ? React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: GOOD,
      fontWeight: 600,
      background: 'rgba(31,157,87,.08)',
      borderRadius: 7,
      padding: '9px 12px'
    }
  }, "\u2713 Nothing went missing since the previous check.") : latest.findings.filter(x => x.area !== 'configuration').map((x, i) => findingRow(x, i, latest.at)), olderFindings.length > 0 && React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: 'var(--muted)',
      marginTop: 6,
      textTransform: 'uppercase',
      letterSpacing: .5
    }
  }, "Earlier checks"), olderFindings.slice(0, 20).map(({
    x,
    i,
    at
  }) => findingRow(x, i, at)), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 9,
      flexWrap: 'wrap',
      marginTop: 6
    }
  }, tile('Staff records', latest.staff.rows == null ? '—' : latest.staff.rows, (latest.staff.active || 0) + ' active · ' + (latest.staff.former || 0) + ' previous'), tile('With activities', latest.staff.filled.extracurricular || 0, 'extracurricular filled'), tile('Submissions', latest.submissions.total || 0, Object.entries(latest.submissions.byStatus || {}).map(([k, v]) => v + ' ' + k).join(' · ')), tile('Statistics values', latest.statisticsValues, 'across departments'), tile('Quality readings', latest.qualityReadings, 'across departments'))) : null), card('Save problems from browsers', 'Every save the database refused or never received, reported by the browser it happened in (last 30 days).', events.length === 0 ? React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: GOOD,
      fontWeight: 600,
      background: 'rgba(31,157,87,.08)',
      borderRadius: 7,
      padding: '9px 12px'
    }
  }, "\u2713 No failed saves reported.") : React.createElement("div", {
    style: {
      overflowX: 'auto'
    }
  }, React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: 12
    }
  }, React.createElement("thead", null, React.createElement("tr", {
    style: {
      textAlign: 'left',
      color: 'var(--muted)',
      fontSize: 10.5,
      textTransform: 'uppercase',
      letterSpacing: .4
    }
  }, React.createElement("th", {
    style: {
      padding: '6px 8px'
    }
  }, "When"), React.createElement("th", {
    style: {
      padding: '6px 8px'
    }
  }, "Who"), React.createElement("th", {
    style: {
      padding: '6px 8px'
    }
  }, "What"), React.createElement("th", {
    style: {
      padding: '6px 8px'
    }
  }, "Details"), React.createElement("th", {
    style: {
      padding: '6px 8px'
    }
  }, "Screen"))), React.createElement("tbody", null, events.slice(0, 100).map((e, i) => React.createElement("tr", {
    key: i,
    style: {
      borderTop: '1px solid var(--line-2)'
    }
  }, React.createElement("td", {
    style: {
      padding: '6px 8px',
      whiteSpace: 'nowrap'
    }
  }, when(e.happenedAt || e.at)), React.createElement("td", {
    style: {
      padding: '6px 8px'
    }
  }, e.name || e.username), React.createElement("td", {
    style: {
      padding: '6px 8px',
      color: e.kind === 'save_conflict' ? WARN : BAD,
      fontWeight: 700,
      whiteSpace: 'nowrap'
    }
  }, kindLabel[e.kind] || e.kind), React.createElement("td", {
    style: {
      padding: '6px 8px',
      color: 'var(--ink-2)'
    }
  }, e.detail, e.keys && e.keys.length ? ' (' + e.keys.join(', ') + ')' : ''), React.createElement("td", {
    style: {
      padding: '6px 8px',
      color: 'var(--muted)'
    }
  }, e.page)))))), events.length ? pill(recentEvents.length + ' this week', recentEvents.length ? WARN : GOOD) : null), history.length > 1 && card('Trend', 'One row per daily check, newest first.', React.createElement("div", {
    style: {
      overflowX: 'auto'
    }
  }, React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: 12
    }
  }, React.createElement("thead", null, React.createElement("tr", {
    style: {
      textAlign: 'left',
      color: 'var(--muted)',
      fontSize: 10.5,
      textTransform: 'uppercase',
      letterSpacing: .4
    }
  }, ['Checked', 'Alerts', 'Staff', 'With activities', 'Submissions', 'Statistics values', 'Quality readings'].map(x => React.createElement("th", {
    key: x,
    style: {
      padding: '6px 8px'
    }
  }, x)))), React.createElement("tbody", null, history.map((s, i) => React.createElement("tr", {
    key: i,
    style: {
      borderTop: '1px solid var(--line-2)'
    }
  }, React.createElement("td", {
    style: {
      padding: '6px 8px',
      whiteSpace: 'nowrap'
    }
  }, when(s.at)), React.createElement("td", {
    style: {
      padding: '6px 8px',
      color: s.alerts ? BAD : GOOD,
      fontWeight: 700
    }
  }, s.alerts || 0), React.createElement("td", {
    style: {
      padding: '6px 8px'
    }
  }, s.staffRows), React.createElement("td", {
    style: {
      padding: '6px 8px'
    }
  }, s.activities), React.createElement("td", {
    style: {
      padding: '6px 8px'
    }
  }, s.submissions), React.createElement("td", {
    style: {
      padding: '6px 8px'
    }
  }, s.statisticsValues), React.createElement("td", {
    style: {
      padding: '6px 8px'
    }
  }, s.qualityReadings))))))));
}
window.SystemMonitor = SystemMonitor;
})();
;
/* ===== app.jsx ===== */
(function(){
const {
  useState,
  useEffect,
  useMemo
} = React;
function App() {
  const store = window.useDeptStore();
  const staff = window.useStaffStore();
  const depts = store.depts;
  const [route, setRouteRaw] = useState(() => {
    const init = typeof window !== 'undefined' && window.__UNICO_INITIAL_ROUTE__ || {
      view: 'home'
    };
    if (window.unicoCanAccessView && !window.unicoCanAccessView(init.view)) {
      const home = window.unicoFirstAllowedHome && window.unicoFirstAllowedHome();
      if (home) return {
        view: home
      };
    }
    return init;
  });
  const staffRef = React.useRef(staff);
  staffRef.current = staff;
  const fixRoute = React.useCallback(r => {
    if (!r || typeof r !== 'object') return r;
    if (r.view === 'perfDirectory') return Object.assign({}, r, {
      view: 'nurses'
    });
    if (r.view === 'perfStaff') {
      const list = staffRef.current && staffRef.current.staff || [];
      const rec = list.find(e => String(e.emp_id || e.id) === String(r.emp)) || list.find(e => String(e.id) === String(r.emp));
      return rec ? {
        view: 'staffProfile',
        emp: rec.id
      } : {
        view: r.role === 'PCA' ? 'pca' : 'nurses'
      };
    }
    return r;
  }, []);
  const setRoute = React.useCallback(r => {
    setRouteRaw(typeof r === 'function' ? prev => fixRoute(r(prev)) : fixRoute(r));
  }, [fixRoute]);
  const [collapsed, setCollapsed] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 820);
  const [layout, setLayout] = useState('executive');
  const [period, setPeriod] = useState({
    mode: 'all'
  });
  const [locked, setLocked] = useState(() => !!(window.unicoLock && window.unicoLock.isEnabled()));
  useEffect(() => {
    const h = () => {
      if (window.unicoLock && window.unicoLock.isEnabled()) setLocked(true);
    };
    window.addEventListener('unico:lock', h);
    return () => window.removeEventListener('unico:lock', h);
  }, []);
  const [authed, setAuthed] = useState(() => !(window.unicoSession && window.unicoSession.configured()) || window.unicoSession.isAuthed());
  useEffect(() => {
    if (!(window.unicoSession && window.unicoSession.configured() && window.unicoSession.isAuthed())) return;
    let live = true;
    window.unicoSession.verify().then(ok => {
      if (live && ok === false) {
        window.unicoSession.logout();
        setAuthed(false);
      }
    });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    const h = () => setAuthed(false);
    window.addEventListener('unico:logout', h);
    return () => window.removeEventListener('unico:logout', h);
  }, []);
  const [permsRev, setPermsRev] = useState(0);
  useEffect(() => {
    const h = () => setPermsRev(r => r + 1);
    window.addEventListener('unico:perms-changed', h);
    return () => window.removeEventListener('unico:perms-changed', h);
  }, []);
  useEffect(() => {
    let stamp = Date.now(),
      busy = false;
    const refresh = e => {
      if (busy || typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (e !== 'tick' && Date.now() - stamp < 15000) return;
      busy = true;
      stamp = Date.now();
      const jobs = [];
      try {
        if (window.unicoRefreshAppData) jobs.push(window.unicoRefreshAppData());
      } catch (e) {}
      try {
        if (window.UNICO && window.UNICO.refreshDepartments) jobs.push(window.UNICO.refreshDepartments());
      } catch (e) {}
      try {
        if (window.refreshQualitySeed) jobs.push(window.refreshQualitySeed());
      } catch (e) {}
      try {
        if (window.refreshQualityFormulas) jobs.push(window.refreshQualityFormulas());
      } catch (e) {}
      try {
        if (window.unicoRefreshPerms) jobs.push(window.unicoRefreshPerms());
      } catch (e) {}
      Promise.all(jobs.map(p => Promise.resolve(p).catch(() => null))).then(() => {
        busy = false;
      });
    };
    const poll = setInterval(() => refresh('tick'), 60000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(poll);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  useEffect(() => {
    if (route.view !== 'perfStaff' && route.view !== 'perfDirectory') return;
    if (!staff.staff || !staff.staff.length) return;
    setRoute(route);
  }, [route.view, route.emp, staff.staff.length]);
  useEffect(() => {
    if (window.unicoCanAccessView && !window.unicoCanAccessView(route.view)) {
      const home = window.unicoFirstAllowedHome && window.unicoFirstAllowedHome();
      if (home && home !== route.view) setRoute({
        view: home
      });
    }
  }, [route.view, permsRev]);
  const openDept = id => setRoute({
    view: 'departments',
    dept: id
  });
  const safeDepts = depts.length ? depts : [];
  const curDept = route.view === 'departments' ? depts.find(d => d.id === (route.dept || depts[0]?.id)) || depts[0] : null;
  const CHUNK_OF_VIEW = v => {
    const s = String(v || '');
    if (s === 'qualityDeptManage') return null;
    if (s.indexOf('quality') === 0 || s === 'reportsQuality' || s === 'gallery') return 'quality';
    if (s.indexOf('dc') === 0) return 'datacollection';
    if (s === 'reports' || s === 'settings') return 'reports';
    if (s === 'staffProfile' || s === 'staffForm' || s === 'perfStaff') return 'staffprofile';
    if (s.indexOf('perf') === 0) return 'performance';
    if (s.indexOf('roster') === 0) return 'roster';
    if (s.indexOf('sup') === 0) return 'supervisor';
    if (s.indexOf('med') === 0) return 'medicine';
    if (s === 'manpower') return 'manpower';
    return null;
  };
  const [chunkTick, setChunkTick] = useState(0);
  const [chunkErr, setChunkErr] = useState('');
  useEffect(() => {
    const h = () => setChunkTick(t => t + 1);
    window.addEventListener('unico:chunk-loaded', h);
    return () => window.removeEventListener('unico:chunk-loaded', h);
  }, []);
  const viewAllowed = !window.unicoCanAccessView || window.unicoCanAccessView(route.view);
  const needChunk = viewAllowed ? CHUNK_OF_VIEW(route.view) : null;
  const chunkReady = !needChunk || !window.unicoChunkReady || window.unicoChunkReady(needChunk);
  useEffect(() => {
    if (!needChunk || chunkReady || !window.unicoLoadChunk) return;
    setChunkErr('');
    window.unicoLoadChunk(needChunk).catch(() => setChunkErr(needChunk));
  }, [needChunk, chunkReady]);
  let crumbs = ['UNICO'],
    body = null,
    actions = null;
  if (route.view === 'dashboard') {
    crumbs = ['UNICO', 'Dashboard'];
    body = React.createElement(Dashboard, {
      layout: layout,
      depts: depts,
      period: period,
      openDept: openDept,
      onFill: id => setRoute({
        view: 'input',
        dept: id
      }),
      setRoute: setRoute
    });
    actions = React.createElement("div", {
      className: "seg",
      style: {
        marginRight: 4
      }
    }, [['executive', 'Executive'], ['operational', 'Operational'], ['analytics', 'Analytics']].map(([id, l]) => React.createElement("button", {
      key: id,
      className: layout === id ? 'on' : '',
      onClick: () => setLayout(id)
    }, l)));
  } else if (route.view === 'departments') {
    if (!depts.length) {
      body = React.createElement(EmptyState, {
        setRoute: setRoute
      });
      crumbs = ['UNICO', 'Departments'];
    } else if (!route.dept) {
      crumbs = ['UNICO', 'Departments'];
      body = React.createElement(DeptGrid, {
        depts: depts,
        openDept: openDept,
        setRoute: setRoute
      });
    } else {
      const cd = depts.find(d => d.id === route.dept) || depts[0];
      crumbs = ['UNICO', 'Departments', cd.name];
      body = React.createElement(DeptDetail, {
        key: cd.id,
        dept: cd,
        openDept: openDept,
        depts: depts,
        setRoute: setRoute
      });
    }
  } else if (route.view === 'compare') {
    crumbs = ['UNICO', 'Compare'];
    body = React.createElement(DeptCompare, {
      depts: depts,
      openDept: openDept
    });
  } else if (route.view === 'gallery') {
    const gd = depts.find(x => x.id === route.dept) || depts[0];
    crumbs = ['UNICO', 'Departments', gd ? gd.name : '', ' Charts'];
    body = React.createElement(ChartsGallery, {
      dept: gd,
      setRoute: setRoute
    });
  } else if (route.view === 'manage') {
    crumbs = ['UNICO', 'Manage Departments'];
    body = React.createElement(ManageDepts, {
      depts: depts,
      store: store,
      setRoute: setRoute
    });
  } else if (route.view === 'input') {
    crumbs = ['UNICO', 'Data Collection', 'Data Entry'];
    body = React.createElement(DataEntry, {
      depts: depts,
      addEntry: store.addEntry,
      entries: store.entries,
      initialDept: route.dept,
      updateDept: store.updateDept,
      deleteDept: store.deleteDept,
      deleteMonth: store.deleteMonth,
      undo: store.undo,
      canUndo: store.canUndo
    });
  } else if (route.view === 'reports') {
    crumbs = ['UNICO', 'Reports', 'Patient Statistics'];
    body = React.createElement(Reports, {
      depts: depts
    });
  } else if (route.view === 'reportsQuality') {
    crumbs = ['UNICO', 'Reports', 'Quality Indicators'];
    body = typeof QualityReportsPanel !== 'undefined' ? React.createElement(QualityReportsPanel, null) : null;
  } else if (route.view === 'home') {
    crumbs = ['UNICO', 'Home'];
    body = typeof HomeView !== 'undefined' ? React.createElement(HomeView, {
      setRoute: setRoute
    }) : null;
  } else if (route.view === 'profile') {
    crumbs = ['UNICO', 'My Profile'];
    body = typeof ProfileView !== 'undefined' ? React.createElement(ProfileView, {
      setRoute: setRoute
    }) : null;
  } else if (route.view === 'settings') {
    crumbs = ['UNICO', 'Settings'];
    body = React.createElement(Settings, {
      depts: depts,
      store: store,
      setRoute: setRoute
    });
  } else if (route.view === 'qualityDeptManage') {
    crumbs = ['UNICO', 'Departments', 'Manage'];
    body = React.createElement(ManageDepts, {
      depts: depts,
      store: store,
      setRoute: setRoute
    });
  } else if (route.view && route.view.indexOf('quality') === 0) {
    const QV_MAP = {
      quality: 'dashboard',
      qualityScore: 'scorecard',
      qualityTrend: 'trends',
      qualityReport: 'reports',
      qualityReportQ: 'reports',
      qualityIncidents: 'incidents',
      qualityDataEntry: 'dataentry',
      qualityManage: 'admin',
      qualityCatalog: 'admin',
      qualityAssign: 'admin',
      qualityCapa: 'actionplans',
      qualityDept: 'dashboard',
      qualityEdit: 'admin',
      qualityEntry: 'dataentry',
      qualityHub: 'dashboard'
    };
    const QTITLE = {
      dashboard: 'Dashboard',
      scorecard: 'Scorecard',
      trends: 'Trends',
      reports: 'Reports',
      incidents: 'Incident Reports',
      admin: 'Indicator Administration',
      dataentry: 'Quality Data Entry',
      actionplans: 'Action Plans'
    };
    const qv = route.qview || QV_MAP[route.view] || 'dashboard';
    crumbs = ['UNICO', 'Quality Indicators', QTITLE[qv] || 'Dashboard'];
    body = typeof QualityView !== 'undefined' ? React.createElement(QualityView, {
      view: qv,
      initialDept: route.dept,
      setRoute: setRoute
    }) : null;
  } else if (route.view && route.view.indexOf('sup') === 0 && typeof SupervisorView !== 'undefined') {
    const SV_TITLE = {
      supHome: 'Dashboard',
      supBoard: 'Patient Board',
      supNew: 'New Report',
      supHistory: 'History',
      supReport: 'Generate Report'
    };
    crumbs = ['UNICO', 'Supervisor Reports', SV_TITLE[route.view] || 'Dashboard'];
    body = React.createElement(SupervisorView, {
      view: route.view,
      id: route.id,
      shift: route.shift,
      openAdd: route.openAdd,
      depts: depts,
      setRoute: setRoute
    });
  } else if (route.view === 'dcPatient') {
    crumbs = ['UNICO', 'Data Collection', 'Patient Statistics'];
    body = React.createElement(DataPatientForm, {
      depts: depts,
      prefill: {
        dept: route.dept,
        responsible: route.responsible,
        month: route.month
      }
    });
  } else if (route.view === 'dcQuality') {
    crumbs = ['UNICO', 'Data Collection', 'Quality Data'];
    body = React.createElement(DataQualityForm, {
      prefill: {
        area: route.area,
        responsible: route.responsible
      }
    });
  } else if (route.view === 'dcResponsibles') {
    const toSettings = !window.unicoCanAccessView || window.unicoCanAccessView('settings');
    if (toSettings) {
      try {
        window.__UNICO_SETTINGS_TAB__ = 'responsibles';
      } catch (e) {}
    }
    setTimeout(() => setRoute({
      view: toSettings ? 'settings' : 'dcReview'
    }), 0);
    crumbs = toSettings ? ['UNICO', 'Settings', 'Users & Roles'] : ['UNICO', 'Data Collection', 'Review & History'];
    body = null;
  } else if (route.view === 'dcSettings') {
    crumbs = ['UNICO', 'Data Collection', 'Department Setup'];
    body = typeof DataCollectionSettings !== 'undefined' ? React.createElement(DataCollectionSettings, {
      depts: depts
    }) : null;
  } else if (route.view === 'dcReview') {
    crumbs = ['UNICO', 'Data Collection', 'Review & History'];
    body = React.createElement(DataReview, null);
  } else if (route.view === 'dcAnalytics') {
    crumbs = ['UNICO', 'Data Collection', 'Performance'];
    body = typeof SubmissionAnalytics !== 'undefined' ? React.createElement(SubmissionAnalytics, null) : null;
  } else if (route.view === 'dcShare') {
    crumbs = ['UNICO', 'Data Collection', 'Share Links'];
    body = React.createElement(DataShareLinks, {
      depts: depts
    });
  } else if (route.view === 'dcFields') {
    crumbs = ['UNICO', 'Data Collection', 'Form Fields'];
    body = React.createElement(DataFields, {
      setRoute: setRoute
    });
  } else if (route.view === 'users') {
    crumbs = ['UNICO', 'User Management'];
    body = typeof UserManagement !== 'undefined' ? React.createElement(UserManagement, {
      setRoute: setRoute
    }) : React.createElement(SectionTitle, {
      icon: I.user,
      title: "User Management"
    });
  } else if (route.view === 'nurseHome') {
    crumbs = ['UNICO', 'Staff Management', 'Nurse Dashboard'];
    body = React.createElement(WorkforceDashboard, {
      store: staff,
      setRoute: setRoute,
      role: "Nurse"
    });
  } else if (route.view === 'pcaHome') {
    crumbs = ['UNICO', 'Staff Management', 'PCA Dashboard'];
    body = React.createElement(WorkforceDashboard, {
      store: staff,
      setRoute: setRoute,
      role: "PCA"
    });
  } else if (route.view === 'nurses') {
    crumbs = ['UNICO', 'Staff Management', 'Nurses'];
    body = React.createElement(ManageStaff, {
      store: staff,
      setRoute: setRoute,
      role: "Nurse"
    });
  } else if (route.view === 'pca') {
    crumbs = ['UNICO', 'Staff Management', 'PCA'];
    body = React.createElement(ManageStaff, {
      store: staff,
      setRoute: setRoute,
      role: "PCA"
    });
  } else if (route.view === 'nurseCompliance') {
    crumbs = ['UNICO', 'Staff Management', 'Nurse Compliance'];
    body = React.createElement(StaffCompliance, {
      store: staff,
      setRoute: setRoute,
      role: "Nurse"
    });
  } else if (route.view === 'pcaCompliance') {
    crumbs = ['UNICO', 'Staff Management', 'PCA Compliance'];
    body = React.createElement(StaffCompliance, {
      store: staff,
      setRoute: setRoute,
      role: "PCA"
    });
  } else if (route.view === 'staffPrevious') {
    crumbs = ['UNICO', 'Staff Management', 'Previous Staff'];
    body = React.createElement(PreviousStaff, {
      store: staff,
      setRoute: setRoute
    });
  } else if (route.view === 'manpower' && typeof window !== 'undefined' && window.ManpowerOverview) {
    crumbs = ['UNICO', 'Staff Management', 'Manpower Overview'];
    body = React.createElement(window.ManpowerOverview, {
      setRoute: setRoute
    });
  } else if (route.view === 'rosterFullReview' && typeof window !== 'undefined' && window.RosterReviewFull) {
    crumbs = ['UNICO', 'Staff Management', 'Roster Full Review'];
    body = React.createElement(window.RosterReviewFull, {
      setRoute: setRoute
    });
  } else if (route.view && route.view.indexOf('roster') === 0 && typeof RosterView !== 'undefined') {
    const RV_TITLE = {
      rosterHome: 'Duty Roster',
      rosterGrid: 'Monthly Grid',
      rosterReview: 'Coverage & Rules',
      rosterPrint: 'Print Sheet'
    };
    crumbs = ['UNICO', 'Staff Management', RV_TITLE[route.view] || 'Duty Roster'];
    body = React.createElement(RosterView, {
      view: route.view,
      dept: route.dept,
      year: route.year,
      month: route.month,
      setRoute: setRoute
    });
  } else if (route.view && route.view.indexOf('med') === 0 && typeof MedicineView !== 'undefined') {
    const MV_TITLE = {
      medHome: 'Overview',
      medInfo: 'Medicine Info',
      medBrowse: 'Drug Index',
      medBrand: 'Brand',
      medGeneric: 'Generic',
      medRxNew: 'New Prescription',
      medRxList: 'Prescriptions',
      medRxPrint: 'Print Prescription',
      medTemplates: 'Rx Templates',
      medCatalog: 'Drug Catalogue'
    };
    crumbs = ['UNICO', 'Medicine & Rx', MV_TITLE[route.view] || 'Overview'];
    body = React.createElement(MedicineView, {
      view: route.view,
      id: route.id,
      rx: route.rx,
      q: route.q,
      setRoute: setRoute
    });
  } else if (route.view === 'perfStaff' || route.view === 'perfDirectory') {
    crumbs = ['UNICO', 'Staff Management'];
    body = React.createElement("div", {
      style: {
        display: 'grid',
        placeItems: 'center',
        height: '50vh',
        color: 'var(--muted)',
        fontSize: 13
      }
    }, "Opening the staff record\u2026");
  } else if (route.view && route.view.indexOf('perf') === 0 && typeof PerformanceView !== 'undefined') {
    const PV_TITLE = {
      perfHome: 'Performance',
      perfForm: 'Appraisal Form',
      perfPrint: 'Printable Form',
      perfAchievements: 'Achievements',
      perfIncidents: 'Incidents',
      perfCompare: 'Department Comparison',
      perfAttrition: 'Attrition & Exits',
      perfRisk: 'Retention Risk',
      perfBoard: 'Recognition Board'
    };
    crumbs = ['UNICO', 'Staff Management', PV_TITLE[route.view] || 'Performance'];
    body = React.createElement(PerformanceView, {
      view: route.view,
      emp: route.emp,
      cycleId: route.cycleId,
      setRoute: setRoute
    });
  } else if (route.view === 'staffProfile') {
    const emp = staff.get(route.emp);
    crumbs = ['UNICO', 'Staff Management', emp ? emp.name : 'Profile'];
    body = React.createElement(StaffProfile, {
      store: staff,
      empId: route.emp,
      setRoute: setRoute
    });
  } else if (route.view === 'staffForm') {
    crumbs = ['UNICO', 'Staff Management', route.emp ? 'Edit Staff' : `Add ${route.role || 'Staff'}`];
    body = React.createElement(StaffForm, {
      store: staff,
      empId: route.emp,
      setRoute: setRoute,
      role: route.role,
      depts: depts
    });
  }
  if (window.unicoSession && window.unicoSession.configured() && !authed) {
    return React.createElement(CloudLogin, {
      onLogin: () => setAuthed(true)
    });
  }
  if (locked) {
    return React.createElement(LockScreen, {
      onUnlock: () => setLocked(false)
    });
  }
  const PORTAL_ROLES = ['collector', 'incharge'];
  if (typeof window !== 'undefined' && window.__UNICO_USER__ && PORTAL_ROLES.indexOf(window.__UNICO_USER__.role) >= 0) {
    if (typeof CollectorPortal === 'undefined') {
      if (window.unicoLoadChunk) window.unicoLoadChunk('datacollection').catch(() => {});
      return React.createElement(ModuleLoading, null);
    }
    return React.createElement(CollectorPortal, null);
  }
  const accessMods = window.unicoAllowedModules ? window.unicoAllowedModules() : null;
  if (Array.isArray(accessMods) && accessMods.length === 0) {
    return React.createElement(NoAccessScreen, null);
  }
  if (window.unicoCanAccessView && !window.unicoCanAccessView(route.view)) {
    crumbs = ['UNICO'];
    body = React.createElement("div", {
      style: {
        display: 'grid',
        placeItems: 'center',
        height: '50vh',
        color: 'var(--muted)',
        fontSize: 13
      }
    }, "Redirecting\u2026");
  }
  if (needChunk && !chunkReady) {
    body = React.createElement(ModuleLoading, {
      failed: chunkErr === needChunk,
      onRetry: () => {
        setChunkErr('');
        if (window.unicoLoadChunk) window.unicoLoadChunk(needChunk).catch(() => setChunkErr(needChunk));
      }
    });
  }
  return React.createElement("div", {
    className: 'app' + (collapsed ? ' collapsed' : '')
  }, React.createElement(GlobalSearch, {
    setRoute: setRoute,
    depts: depts
  }), React.createElement(Sidebar, {
    route: route,
    setRoute: setRoute,
    collapsed: collapsed,
    depts: depts
  }), React.createElement("div", {
    className: "main"
  }, React.createElement(TopBar, {
    route: route,
    setRoute: setRoute,
    onBurger: () => setCollapsed(c => !c),
    crumbs: crumbs,
    actions: actions,
    depts: depts,
    onFill: id => setRoute({
      view: 'input',
      dept: id
    }),
    period: period,
    setPeriod: setPeriod
  }), React.createElement("div", {
    className: "content",
    key: route.view + (route.dept || '') + (route.emp || '') + layout
  }, typeof ViewTabs !== 'undefined' && React.createElement(ViewTabs, {
    view: route.view,
    setRoute: setRoute
  }), body)));
}
function ModuleLoading({
  failed,
  onRetry
}) {
  return React.createElement("div", {
    style: {
      display: 'grid',
      placeItems: 'center',
      height: '50vh',
      gap: 10,
      color: 'var(--muted)',
      fontSize: 13,
      textAlign: 'center'
    }
  }, failed ? React.createElement(React.Fragment, null, React.createElement("div", null, "This screen could not be downloaded. Check the connection and try again."), onRetry && React.createElement("button", {
    className: "btn sm",
    onClick: onRetry
  }, "Try again")) : React.createElement("div", null, "Loading this screen\u2026"));
}
function NoAccessScreen() {
  return React.createElement("div", {
    style: {
      minHeight: '100vh',
      display: 'grid',
      placeItems: 'center',
      background: 'transparent',
      fontFamily: '"IBM Plex Sans",system-ui,sans-serif',
      padding: 24
    }
  }, React.createElement("div", {
    style: {
      maxWidth: 440,
      background: 'linear-gradient(152deg,rgba(255,255,255,.76),rgba(236,247,255,.46))',
      backdropFilter: 'blur(26px) saturate(1.75)',
      WebkitBackdropFilter: 'blur(26px) saturate(1.75)',
      border: '1px solid rgba(255,255,255,.92)',
      boxShadow: '0 14px 42px rgba(31,59,90,.14),0 4px 16px rgba(0,144,202,.09),inset 0 1px 0 rgba(255,255,255,.95)',
      borderRadius: 16,
      padding: '28px 30px',
      textAlign: 'center'
    }
  }, React.createElement("div", {
    style: {
      fontSize: 34,
      marginBottom: 8
    }
  }, "\uD83D\uDD12"), React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 700,
      color: '#16202e',
      marginBottom: 6
    }
  }, "No workspace access"), React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: '#6c7a8c',
      lineHeight: 1.5,
      marginBottom: 16
    }
  }, "Your account hasn\u2019t been granted access to any module yet. Please ask an administrator to assign the workspaces you need."), React.createElement("a", {
    href: "/logout",
    style: {
      display: 'inline-block',
      border: 0,
      borderRadius: 9,
      padding: '10px 22px',
      cursor: 'pointer',
      fontSize: 13,
      fontWeight: 700,
      color: '#fff',
      textDecoration: 'none',
      background: 'linear-gradient(135deg,#27a8db,#0072a3)'
    }
  }, "Sign out")));
}
function EmptyState({
  setRoute
}) {
  return React.createElement("div", {
    style: {
      display: 'grid',
      placeItems: 'center',
      height: '60vh',
      textAlign: 'center'
    }
  }, React.createElement("div", null, React.createElement("div", {
    style: {
      width: 60,
      height: 60,
      borderRadius: 16,
      background: 'var(--blue-50)',
      color: 'var(--blue)',
      display: 'grid',
      placeItems: 'center',
      margin: '0 auto 14px'
    }
  }, React.createElement(Ic, {
    d: I.layers,
    s: 30
  })), React.createElement("div", {
    style: {
      fontSize: 17,
      fontWeight: 700
    }
  }, "No departments yet"), React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--muted)',
      margin: '6px 0 16px'
    }
  }, "Add a department to start tracking statistics."), React.createElement("button", {
    className: "btn pri",
    onClick: () => setRoute({
      view: 'manage'
    })
  }, React.createElement(Ic, {
    d: I.plus,
    s: 16
  }), "Add Department")));
}
class AppErrorBoundary extends React.Component {
  constructor(p) {
    super(p);
    this.state = {
      err: null
    };
  }
  static getDerivedStateFromError(err) {
    return {
      err
    };
  }
  render() {
    if (!this.state.err) return this.props.children;
    const msg = String(this.state.err && this.state.err.message || this.state.err);
    return React.createElement("div", {
      style: {
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: 'transparent',
        fontFamily: '"IBM Plex Sans",system-ui,sans-serif',
        padding: 24
      }
    }, React.createElement("div", {
      style: {
        maxWidth: 460,
        background: 'linear-gradient(152deg,rgba(255,255,255,.76),rgba(236,247,255,.46))',
        backdropFilter: 'blur(26px) saturate(1.75)',
        WebkitBackdropFilter: 'blur(26px) saturate(1.75)',
        border: '1px solid rgba(255,255,255,.92)',
        boxShadow: '0 14px 42px rgba(31,59,90,.14),0 4px 16px rgba(0,144,202,.09),inset 0 1px 0 rgba(255,255,255,.95)',
        borderRadius: 16,
        padding: '26px 28px',
        textAlign: 'center'
      }
    }, React.createElement("div", {
      style: {
        fontSize: 34,
        marginBottom: 8
      }
    }, "\u26A0\uFE0F"), React.createElement("div", {
      style: {
        fontSize: 16,
        fontWeight: 700,
        color: '#16202e',
        marginBottom: 6
      }
    }, "Something went wrong in this view"), React.createElement("div", {
      style: {
        fontSize: 12.5,
        color: '#6c7a8c',
        lineHeight: 1.5,
        marginBottom: 6
      }
    }, "Your data is safe \u2014 this is a display error. Reload to continue."), React.createElement("div", {
      style: {
        fontSize: 11,
        color: '#9aa6b4',
        fontFamily: '"IBM Plex Mono",monospace',
        background: '#f7f9fc',
        border: '1px solid #eef2f7',
        borderRadius: 8,
        padding: '7px 10px',
        margin: '0 0 14px',
        wordBreak: 'break-word'
      }
    }, msg), React.createElement("button", {
      onClick: () => {
        try {
          location.hash = '';
        } catch (e) {}
        location.reload();
      },
      style: {
        border: 0,
        borderRadius: 9,
        padding: '10px 22px',
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontSize: 13,
        fontWeight: 700,
        color: '#fff',
        background: 'linear-gradient(135deg,#27a8db,#0072a3)'
      }
    }, "Reload the app")));
  }
}
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(AppErrorBoundary, null, React.createElement(App, null)));
})();
