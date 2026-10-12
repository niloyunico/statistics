/* A stand-in H360 for tests and previews: the same pages H360 serves (sign-in form,
   Nurse Station page, station lists, patient tabs, record pages, IPD Admission) with
   made-up patients. Sign-in: tester / secret-pass. Every request is noted in state.hits. */
const express = require('express');

// "Today" as the hospital's clock has it.
const hospitalNow = new Date(Date.now() + 6 * 3600 * 1000);
const TODAY = hospitalNow.toISOString().slice(0, 10);
const [YEAR, MONTH, DAY] = TODAY.split('-');
const daysAgo = (n) => new Date(hospitalNow.getTime() - n * 86400000).toISOString().slice(0, 10);

function standIn() {
  const state = {
    hits: [],
    registerMode: 'table',
    patients: [
      { station: '11', admission_no_pk: 1001, patient_no_fk: 501, patient_name: 'TEST ALPHA', patient_code: 'U0001', admission_uid: 'IP-1', admission_date: `${TODAY} 00:30:00`, bed_name: '1018/B', ward_name: 'Cabin', primary_doctor_name: 'Dr. One', doc_department: 'Medicine', dis_req_ind: '1', death_ind: '0', contact_person_mobile: '01700000000' },
      { station: '12', admission_no_pk: 1002, patient_no_fk: 502, patient_name: 'TEST BRAVO', patient_code: 'U0002', admission_uid: 'IP-2', admission_date: `${daysAgo(5)} 14:00:00`, bed_name: 'MICU-3', ward_name: 'ICU', primary_doctor_name: 'Dr. Two', doc_department: 'Critical Care', dis_req_ind: '0', death_ind: '0' },
      { station: '11', admission_no_pk: 1003, patient_no_fk: 503, patient_name: 'TEST CHARLIE', patient_code: 'U0003', admission_uid: 'IP-3', admission_date: `${daysAgo(3)} 09:00:00`, bed_name: '1020/A', ward_name: 'Cabin', primary_doctor_name: 'Dr. One', doc_department: 'Medicine', dis_req_ind: '0', death_ind: '0' },
    ],
    // On the IPD Admission list only: admitted today and not received by a station; and discharged today.
    registerOnly: [
      { admission_no_pk: 1004, patient_name: 'TEST DELTA', patient_code: 'U0004', admission_uid: 'IP-4', admission_date: `${TODAY} 00:45:00`, bed_name: '1101/A', ward_name: 'Nurse Station L-11', primary_doctor_name: 'Dr. Three', dis_ind: '0' },
      { admission_no_pk: 1005, patient_name: 'TEST ECHO', patient_code: 'U0005', admission_uid: 'IP-5', admission_date: `${daysAgo(4)} 10:00:00`, bed_name: '0905/C', ward_name: 'Nurse Station L-9', primary_doctor_name: 'Dr. Two', dis_ind: '1', dis_datetime: `${TODAY} 00:50:00`, dis_reason: 'Normal Discharge', bill_status: 'Cleared' },
    ],
    left: {},
  };
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  // state.delay (ms) slows every answer down, to watch a collection in progress.
  app.use((req, res, next) => { state.hits.push(req.method + ' ' + req.path); if (state.delay) setTimeout(next, state.delay); else next(); });
  const cookies = (req) => Object.fromEntries(String(req.headers.cookie || '').split(';').map((p) => p.trim().split('=')).filter((p) => p[0]));
  const signedIn = (req) => cookies(req).h360_session === 'signed-in';
  const page = (body, head = '') => `<!doctype html><html><head><meta name="csrf-token" content="csrf-123">${head}</head><body>${body}</body></html>`;
  const needLogin = (req, res, next) => (signedIn(req) ? next() : res.redirect('/login'));

  app.get('/login', (req, res) => {
    if (signedIn(req)) return res.redirect('/dashboard');
    res.setHeader('Set-Cookie', ['XSRF-TOKEN=x1; path=/', 'h360_session=anonymous; path=/; httponly']);
    res.send(page(`${req.query.failed ? '<span class="invalid-feedback">These credentials do not match our records.</span>' : ''}
      <form method="POST" action="${state.base}/login"><input type="hidden" name="_token" value="form-token-1">
      <input name="email" type="text"><input name="password" type="password"><button type="submit">Sign in</button></form>`));
  });
  app.post('/login', (req, res) => {
    if (req.body._token !== 'form-token-1' || cookies(req).h360_session !== 'anonymous') return res.status(419).send('Page Expired');
    if (req.body.email !== 'tester' || req.body.password !== 'secret-pass') return res.redirect('/login?failed=1');
    res.setHeader('Set-Cookie', 'h360_session=signed-in; path=/; httponly');
    res.redirect('/dashboard');
  });
  app.get('/dashboard', needLogin, (req, res) => res.send(page('<h1>Dashboard</h1>')));

  // state.shell: a page's address gives an empty frame whose script asks for the page again,
  // marked as coming from a script, and puts the answer into the frame (as H360 does).
  app.get(['/v2/ipd/nurse-station-receive-request', '/ipd/ipd-admission', '/prescription/appointments/opd-nurse-station'], needLogin, (req, res, next) => {
    if (!state.shell || req.headers['x-requested-with']) return next();
    res.send(page(`<div id="page-content"></div><script>
      const pageurl = location.href;
      fetch(location.pathname, { headers: { 'X-Requested-With': 'XMLHttpRequest' } }).then(function (r) { return r.text(); }).then(function (html) {
        var box = document.getElementById('page-content'); box.innerHTML = html;
        box.querySelectorAll('script').forEach(function (old) { var s = document.createElement('script'); s.textContent = old.textContent; old.replaceWith(s); });
      });</script>`));
  });
  app.get('/v2/ipd/nurse-station-receive-request', needLogin, (req, res) => {
    if (state.stationsMode === 'script') {
      return res.send(page(`<select id="nurse_station_received"><option value="">Select</option></select>
        <script>
        $.ajax({ url: "/v2/ipd/get-nurse-station-list", success: function (d) { $('#nurse_station_received').html(d); } });
        </script>`));
    }
    res.send(page(`<select id="nurse_station_received"><option value="">Select</option>
      <option value="11">Nurse Station L-10</option><option value="12">Nursing Services - MICU</option></select>`));
  });
  app.post('/v2/ipd/nurse-station-received-patient', (req, res) => {
    if (!signedIn(req) || req.headers['x-csrf-token'] !== 'csrf-123') return res.status(419).json({ message: 'CSRF token mismatch.' });
    res.json({ data: state.patients.filter((p) => p.station === req.body.nurse_station).map(({ station, ...admission }) => ({ ...admission, ns_no_fk: station })) });
  });

  const registerRows = () => [
    ...state.patients.map((p) => ({ ...p, dis_ind: '0' })),
    ...Object.values(state.left),
    ...state.registerOnly,
  ].map(({ station, patient_no_fk, ...row }) => row);
  app.get('/ipd/ipd-admission', needLogin, (req, res) => {
    if (state.registerMode === 'xhr') {
      return res.send(page(`<table id="list"><thead><tr><th>IP No</th><th>UHID</th><th>Patient Name</th></tr></thead><tbody></tbody></table>
        <script>fetch('/ipd/ipd-admission-data?draw=1&start=0&length=2', { headers: { 'X-Requested-With': 'XMLHttpRequest' } }).then((r) => r.json()).then((d) => { window.loaded = d.data.length; });</script>`));
    }
    const cell = (v) => `<td>${v || ''}</td>`;
    res.send(page(`<table><thead><tr><th>IP No</th><th>UHID</th><th>Patient Name</th><th>Bed</th><th>Ward</th><th>Consultant</th><th>Admission Date</th><th>Discharge Date</th><th>Discharge Type</th><th>Bill Status</th><th>Action</th></tr></thead><tbody>
      ${registerRows().map((r) => `<tr>${[r.admission_uid, r.patient_code, r.patient_name, r.bed_name, r.ward_name, r.primary_doctor_name, r.admission_date, r.dis_datetime, r.dis_reason, r.bill_status].map(cell).join('')}<td><a class="btn" href="/ipd/discharge-request/${r.admission_no_pk}">Discharge</a></td></tr>`).join('')}
      </tbody></table>`));
  });
  app.get('/ipd/ipd-admission-data', needLogin, (req, res) => {
    const rows = registerRows();
    const start = Number(req.query.start) || 0;
    const length = Number(req.query.length) || 10;
    res.json({ draw: Number(req.query.draw), recordsTotal: rows.length, recordsFiltered: rows.length, data: rows.slice(start, start + length) });
  });

// The OPD Nurse Station Patient List: three lists side by side, one on show at a time.
  state.opd = [
    { id: 9001, name: 'OPD ANNA', age: '69 Y 0 M 12 D', gender: 'Male', department: 'General Surgery', doctor: 'Dr. Knife', serial: '24', status: 'Appointed (Vitals Taken)', list: 'appointed' },
    { id: 9002, name: 'OPD BEN', age: '31 Y 8 M 16 D', gender: 'Male', department: 'Family medicine', doctor: 'Dr. Home', serial: '10', status: 'Appointed', list: 'appointed' },
    { id: 9003, name: 'OPD CARA', age: '57 Y 0 M 1 D', gender: 'Female', department: 'Family medicine', doctor: 'Dr. Home', serial: '2', status: 'Prescribed', list: 'prescribed' },
    { id: 9004, name: 'OPD DAN', age: '40 Y 1 M 1 D', gender: 'Male', department: 'General Surgery', doctor: 'Dr. Knife', serial: '', status: 'Prescribed (Vitals Taken)', list: 'prescribed' },
  ];
  app.get('/prescription/appointments/opd-nurse-station', needLogin, (req, res) => {
    const [y, m, d] = TODAY.split('-');
    const card = (p) => `<div class="col-md-3"><div class="card text-center"><img src="/photo/${p.id}.png"><h5>${p.name}</h5><p>Age: ${p.age}, Gender: ${p.gender}</p><p>Appointment Date: ${d}/${m}/${y}</p><p>${p.department}</p><p>${p.doctor}</p><p>Serial: ${p.serial}</p><span class="badge">${p.status}</span><div class="btn-group"><a class="btn" href="/emr/opd-emr/${p.id}">EMR</a><a class="btn" href="/prescription/vitals-entry/${p.id}">VITALS</a></div></div></div>`;
    const pane = (id, list, shown) => `<div class="tab-pane" id="${id}" style="${shown ? '' : 'display:none'}"><div class="row">${list.map(card).join('')}</div></div>`;
    res.send(page(`<h4>OPD Nurse Station Patient List</h4>
      <form><input name="patient_code" placeholder="Patient Code."><input name="from_date" value="${d}-${m}-${y}"><input name="to_date" value="${d}-${m}-${y}"></form>
      <ul class="nav"><li><a class="tabh" href="#appointed">APPOINTED PATIENT</a></li><li><a class="tabh" href="#prescribed">PRESCRIBED PATIENT</a></li><li><a class="tabh" href="#all_patient">ALL PATIENT</a></li></ul>
      <div class="tab-content">${pane('appointed', state.opd.filter((p) => p.list === 'appointed'), true)}${pane('prescribed', state.opd.filter((p) => p.list === 'prescribed'))}${pane('all_patient', state.opd)}</div>
      <script>document.querySelectorAll('.tabh').forEach(function (a) { a.onclick = function (e) { e.preventDefault(); document.querySelectorAll('.tab-pane').forEach(function (p) { p.style.display = p.id === a.getAttribute('href').slice(1) ? '' : 'none'; }); }; });</script>`));
  });

  const header = (adm) => `<div class="row"><div><label>Age</label></div><div>: ${adm === '1002' ? '9 Y 2 M 0 D' : '35 Y 0 M 3 D'}</div><div><label>Gender</label></div><div>: Male</div><div><label>Contact No.</label></div><div>: 01711111111</div></div>`;
  app.get('/v2/ipd/nurse-note/nurses-tab/:adm', needLogin, (req, res) => {
    const adm = req.params.adm;
    res.send(page(`${header(adm)}
      <a class="btn" href="/consultation-note/${adm}">Follow-up Notes</a>
      <a class="btn" href="/skin-care-plan/${adm}">Skin Care Plan</a>
      <a class="btn" href="/v2/ipd/nurse-assessment-adult/${adm}">Nursing Assessment</a>
      <a class="btn" href="/ipd/discharge-request/${adm}">Discharge Request</a>
      <a class="btn" href="/ipd/bill-view/${adm}">Billing</a>`));
  });
  app.get('/v2/ipd/nurse-note/doctors-tab/:adm', needLogin, (req, res) => {
    const adm = req.params.adm;
    res.send(page(`${header(adm)}
      <a class="btn" href="/problem-list/${adm}">Problem List</a>
      <a class="btn" href="/progress-note/${adm}">Progress Note</a>
      <a class="btn" href="/ot-procedure-note/${adm}">OT Procedure Note</a>
      <a class="btn" href="/ipd/discharge-summary/${adm}">Discharge Summary</a>`));
  });
  app.get('/v2/ipd/nurse-note/:adm', needLogin, (req, res) => res.send(page('<div class="alert"><b>Allergy:</b> Penicillin</div>')));

  const table = (title, headers, rows) => `<h4>${title}</h4><table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  app.get('/consultation-note/:adm', needLogin, (req, res) => res.send(page(table('Follow-up Notes', ['Date', 'Notes', 'Action'], [[`${DAY}/${MONTH}/${YEAR} 08:00`, `Patient ${req.params.adm} stable on room air.`, 'Edit']]))));
  app.get('/problem-list/:adm', needLogin, (req, res) => res.send(page(table('Problem List', ['Date', 'Problem'], [[`${DAY}/${MONTH}/${YEAR}`, '1. Pneumonia 2. DM']]))));
  app.get('/progress-note/:adm', needLogin, (req, res) => res.send(page(table('Progress Note', ['Date', 'Details'], [[`${DAY}/${MONTH}/${YEAR}`, 'Improving.']]))));
  app.get('/ot-procedure-note/:adm', needLogin, (req, res) => res.send(page(req.params.adm === '1002'
    ? table('OT Notes', ['OT Date', 'OT Time', 'Operation Name', 'OT Surgeon', 'Anaesthetist', 'OT Anaesthesia'], [[`${DAY}/${MONTH}/${YEAR}`, '10:30', 'Appendectomy', 'Dr. Cut', 'Dr. Sleep', 'GA']])
    : table('OT Notes', ['OT Date', 'OT Time'], [['Data Not Found']]))));
  app.get('/skin-care-plan/:adm', needLogin, (req, res) => res.send(page(req.params.adm === '1002'
    ? table('Skin Care Plan', ['Date', 'Skin Condition'], [[`${DAY}/${MONTH}/${YEAR}`, 'Redness']])
    : '<p>No record</p>')));
  app.get('/v2/ipd/nurse-assessment-adult/:adm', needLogin, (req, res) => res.send(page('<p>Nothing saved</p>')));
  app.use((req, res) => res.status(404).send('Not found'));
  return { app, state };
}


module.exports = { standIn, TODAY, daysAgo };
