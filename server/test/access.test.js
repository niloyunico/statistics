/* Access-control self-test — the per-module + row-level authorization in
   server/access.js. No database needed (pure functions over plain objects).
   Run: npm run test:access   (exit 0 = pass)

   These assertions are the contract behind the two failures that matter:
     - a restricted account READING a module it was not granted, and
     - a scoped account SAVING and thereby deleting rows it could never see. */
process.env.MONGODB_URI = '';   // keep db/deptmap in in-memory dev mode
const assert = require('assert');
const access = require('../access');

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; console.log('  PASS  ' + name); } else { fail++; console.log('  FAIL  ' + name); } }
function eq(name, a, b) { const A = JSON.stringify(a), B = JSON.stringify(b); if (A === B) { pass++; console.log('  PASS  ' + name); } else { fail++; console.log('  FAIL  ' + name + '\n        got      ' + A + '\n        expected ' + B); } }

// A staff-only user: may view+edit staff, nothing else.
const staffUser = {
  unrestricted: false, username: 'icu.incharge', role: 'User',
  perms: { staff: ['view', 'edit'], stats: 'none', quality: 'none', supervisor: 'none', datacol: 'none', reports: 'none', users: 'none' },
  departments: ['micu'], qualityAreas: [], staffScope: 'departments', staffId: null, staffEmpId: '',
};
const selfUser = {
  unrestricted: false, username: 'nurse.rina', role: 'User',
  perms: { staff: ['view'] }, departments: [], qualityAreas: [],
  staffScope: 'self', staffId: 7, staffEmpId: 'UNC-0107',
};
const admin = { unrestricted: true, role: 'Administrator', staffScope: 'all' };

console.log('\n== can() mirrors the renderer gate ==');
ok('staff view granted', access.can(staffUser, 'staff', 'view'));
ok('staff edit granted', access.can(staffUser, 'staff', 'edit'));
ok('staff delete DENIED (array model = no implicit escalation)', !access.can(staffUser, 'staff', 'delete'));
ok('quality view denied', !access.can(staffUser, 'quality', 'view'));
ok('admin can everything', access.can(admin, 'users', 'delete'));
ok('collector blocked from perms modules', !access.can({ unrestricted: false, role: 'collector', perms: {} }, 'staff', 'view'));

console.log('\n== module of key ==');
eq('staff overlay', access.moduleOfKey('unico_staff_v3'), 'staff');
eq('supervisor draft prefix', access.moduleOfKey('unico_sup_draft_2026-08-19'), 'supervisor');
eq('unknown key -> null (deny)', access.moduleOfKey('unico_brand_new_v1'), null);

const staffArr = [
  { id: 1, emp_id: 'UNC-0101', current_department: 'micu' },
  { id: 2, emp_id: 'UNC-0102', current_department: 'ccu' },
  { id: 7, emp_id: 'UNC-0107', current_department: 'ccu' },
  { id: 8, emp_id: '', current_department: 'micu, ccu' }, // multi-valued
];

(async () => {
  console.log('\n== staff row scoping ==');
  const seenByIncharge = await access.filterStaff(staffUser, staffArr);
  eq('department scope sees only its own unit (incl. multi-valued)', seenByIncharge.map(r => r.id), [1, 8]);
  const seenBySelf = await access.filterStaff(selfUser, staffArr);
  eq('self scope sees only own record', seenBySelf.map(r => r.id), [7]);
  eq('admin sees all', (await access.filterStaff(admin, staffArr)).map(r => r.id), [1, 2, 7, 8]);
  eq('no staff permission -> nothing', await access.filterStaff({ unrestricted: false, role: 'User', perms: {}, staffScope: 'all' }, staffArr), []);

  console.log('\n== GET /api/data snapshot scoping ==');
  const blob = {
    unico_staff_v3: JSON.stringify(staffArr),
    unico_store_v3: '{"custom":[]}',
    unico_quality_v2: '{"depts":{}}',
    unico_report_sig_v1: '{"prepared":"X"}',
    unico_mystery_key: 'secret',
  };
  const scoped = await access.scopeSnapshot(staffUser, blob);
  eq('only staff key survives', Object.keys(scoped).sort(), ['unico_staff_v3']);
  eq('staff roster narrowed inside the blob', JSON.parse(scoped.unico_staff_v3).map(r => r.id), [1, 8]);
  eq('admin snapshot untouched', Object.keys(await access.scopeSnapshot(admin, blob)).length, 5);

  console.log('\n== PUT /api/data merge (the data-loss guard) ==');
  // The scoped browser holds ONLY what it was given, and mirrors that back.
  const echoed = { unico_staff_v3: scoped.unico_staff_v3 };
  const merged = await access.mergeAppData(staffUser, echoed, blob);
  eq('other modules survive a scoped save', Object.keys(merged).sort(),
    ['unico_mystery_key', 'unico_quality_v2', 'unico_report_sig_v1', 'unico_staff_v3', 'unico_store_v3']);
  eq('out-of-scope staff survive', JSON.parse(merged.unico_staff_v3).map(r => r.id).sort(), [1, 2, 7, 8]);

  // Edit inside scope.
  const edited = JSON.stringify([{ id: 1, emp_id: 'UNC-0101', current_department: 'micu', name: 'EDITED' }, { id: 8, emp_id: '', current_department: 'micu, ccu' }]);
  const m2 = await access.mergeAppData(staffUser, { unico_staff_v3: edited }, blob);
  const rows = JSON.parse(m2.unico_staff_v3);
  eq('in-scope edit applied', (rows.find(r => r.id === 1) || {}).name, 'EDITED');
  eq('out-of-scope row untouched', (rows.find(r => r.id === 2) || {}).emp_id, 'UNC-0102');

  // Delete inside scope is honoured; the rest stays.
  const deleted = JSON.stringify([{ id: 8, emp_id: '', current_department: 'micu, ccu' }]);
  const m3 = await access.mergeAppData(staffUser, { unico_staff_v3: deleted }, blob);
  eq('in-scope delete honoured, others kept', JSON.parse(m3.unico_staff_v3).map(r => r.id).sort(), [2, 7, 8]);

  // A scoped session must not smuggle a record into another department.
  const smuggle = JSON.stringify(staffArr.concat([{ id: 99, current_department: 'cathlab' }]));
  const m4 = await access.mergeAppData(staffUser, { unico_staff_v3: smuggle }, blob);
  ok('cannot create staff outside own scope', !JSON.parse(m4.unico_staff_v3).some(r => r.id === 99));

  // A write to a module it may only VIEW is ignored.
  const viewer = Object.assign({}, staffUser, { perms: { staff: ['view'] } });
  const m5 = await access.mergeAppData(viewer, { unico_staff_v3: '[]' }, blob);
  eq('view-only cannot write', JSON.parse(m5.unico_staff_v3).map(r => r.id).sort(), [1, 2, 7, 8]);

  // Admin keeps the old full-mirror behaviour exactly.
  eq('admin write is a straight mirror', await access.mergeAppData(admin, { a: '1' }, blob), { a: '1' });

  console.log('\n== department matching survives the real roster spellings ==');
  // The register says "IPD Cabin Level 10"; the roster says Level-10 / Level 10 /
  // Level - 10. Exact matching hid 62 of 198 real staff from every scoped account.
  const wardHead = { unrestricted: false, role: 'User', perms: { staff: ['view'] },
    departments: ['lvl10', 'cticu', 'ctvs', 'er'], qualityAreas: [], staffScope: 'departments' };
  const messy = [
    { id: 1, current_department: 'Level-10' }, { id: 2, current_department: 'Level 10' },
    { id: 3, current_department: 'Level - 10' }, { id: 4, current_department: 'Level- 10' },
    { id: 5, current_department: 'CT ICU' }, { id: 6, current_department: 'Cardiac OT' },
    { id: 7, current_department: 'Emergency' }, { id: 8, current_department: 'IPD Cabin Level 10' },
    { id: 90, current_department: 'MICU' }, { id: 91, current_department: 'Blood Bank' },
    { id: 92, current_department: 'Level 9' },
  ];
  const wardSeen = (await access.filterStaff(wardHead, messy)).map(r => r.id);
  eq('every real spelling of an assigned unit resolves', wardSeen, [1, 2, 3, 4, 5, 6, 7, 8]);
  ok('a different level is NOT swept in', wardSeen.indexOf(92) < 0);
  ok('an unassigned unit stays invisible', wardSeen.indexOf(90) < 0 && wardSeen.indexOf(91) < 0);

  console.log('\n== hardening ==');
  const corrupt = await access.scopeSnapshot(staffUser, { unico_staff_v3: '{"not":"an array"}' });
  eq('a corrupt staff overlay reveals nothing', JSON.parse(corrupt.unico_staff_v3), []);
  const degraded = { unrestricted: false, degraded: true, role: 'User', perms: {}, departments: [], qualityAreas: [], staffScope: 'self' };
  ok('a degraded (database-unreachable) session grants nothing', !access.can(degraded, 'staff', 'view'));
  eq('a degraded session receives no app state', await access.scopeSnapshot(degraded, { unico_store_v3: 'x' }), {});

  console.log('\n== the portal roles ==');
  const collector = { unrestricted: false, role: 'collector', perms: {}, departments: ['micu'], qualityAreas: ['MICU'] };
  const incharge = { unrestricted: false, role: 'incharge', perms: {}, departments: ['micu', 'sicu'], qualityAreas: ['MICU'] };
  eq('both portal roles are recognised', [access.isPortal(collector), access.isPortal(incharge)], [true, true]);
  ok('a plain User is not a portal role', !access.isPortal(staffUser));
  ok('an in-charge gets NO perms-map rights', !access.can(incharge, 'staff', 'view'));
  ok('an in-charge cannot write quality either', !access.can(incharge, 'quality', 'edit'));

  console.log('\n== portalStaff: the unit, and only the unit ==');
  const roster = [
    { id: 1, name: 'A', current_department: 'MICU', emp_id: '1', phone: '017', salary: 50000, nid: 'x', remarks: 'private' },
    { id: 2, name: 'B', current_department: 'Medical ICU', emp_id: '2' },
    { id: 3, name: 'C', current_department: 'SICU', emp_id: '3' },
    { id: 4, name: 'D', current_department: 'NICU', emp_id: '4' },
    { id: 5, name: 'E', current_department: 'CT ICU', emp_id: '5' },
    { id: 6, name: 'F', current_department: 'MICU', emp_id: '6', former: true },
    { id: 7, name: 'G', current_department: 'MICU, SICU', emp_id: '7' },
  ];
  // The account stores statistics ids; a staff record holds either the short code or
  // the full name, so the caller feeds in both spellings.
  const seen = access.portalStaff(['micu', 'Medical ICU', 'sicu', 'SICU'], roster).map((p) => p.id);
  eq('every spelling of an assigned unit resolves', seen.slice().sort(), [1, 2, 3, 7]);
  ok('another ICU is NOT swept in', seen.indexOf(4) < 0 && seen.indexOf(5) < 0);
  ok('a former member of staff is excluded', seen.indexOf(6) < 0);
  const one = access.portalStaff(['micu'], roster)[0];
  ok('personal fields never leave the server',
    one.phone === undefined && one.salary === undefined && one.nid === undefined && one.remarks === undefined);
  // The ward-relevant facts a nurse in charge rosters and audits against DO come through.
  const rich = access.portalStaff(['micu'], [{ id: 9, name: 'H', current_department: 'MICU',
    qualification: 'B.Sc', special_training: 'ACLS, BLS', hepatitis_b_vaccination: 'Completed',
    total_experience_text: '6 yrs', phone: '017', notes: ['private'] }])[0];
  ok('training, Hep-B, qualification and experience are served',
    rich.special_training === 'ACLS, BLS' && rich.hepatitis_b_vaccination === 'Completed'
    && rich.qualification === 'B.Sc' && rich.total_experience_text === '6 yrs');
  ok('contact details and notes are still withheld', rich.phone === undefined && rich.notes === undefined);
  ok('the fields a ward actually needs are kept', one.name === 'A' && one.emp_id === '1' && one.current_department === 'MICU');
  eq('no assigned unit means no staff at all', access.portalStaff([], roster), []);
  console.log('\n== no module may hard-code a single portal role ==');
  /* This is the guard for a whole CLASS of bug, not one instance of it.

     Adding the `incharge` role opened four scoping holes at once, because four files
     asked `role === 'collector'` when they meant "is this a portal account". Each one
     silently handed an in-charge the ADMIN branch: the unfiltered submission list, the
     whole shared app-state blob, no out-of-scope check on submit, and unsaved
     assignment fields. Nothing failed loudly; the account simply saw the hospital.

     access.js is the one file allowed to name the roles. Everywhere else must go
     through PORTAL_ROLES / isPortal, so the next portal role cannot reopen them. */
  {
    const fs = require('fs'), path = require('path');
    const dir = path.join(__dirname, '..');
    const skip = new Set(['access.js', 'node_modules', 'test']);
    const offenders = [];
    fs.readdirSync(dir).forEach((f) => {
      if (!f.endsWith('.js') || skip.has(f)) return;
      const src = fs.readFileSync(path.join(dir, f), 'utf8');
      src.split('\n').forEach((line, i) => {
        // A bare equality test against the collector role, outside a comment.
        const code = line.split('//')[0];
        if (/role\s*[=!]==\s*'collector'/.test(code) || /'collector'\s*[=!]==\s*[\w.]*role/.test(code)) {
          offenders.push(f + ':' + (i + 1) + '  ' + line.trim().slice(0, 90));
        }
      });
    });
    ok('no server module tests for the collector role directly'
      + (offenders.length ? '\n        ' + offenders.join('\n        ') : ''), offenders.length === 0);
  }

  console.log('\n== verb -> action mapping ==');
  eq('GET', access.actionForMethod('GET'), 'view');
  eq('POST', access.actionForMethod('POST'), 'add');
  eq('PATCH', access.actionForMethod('PATCH'), 'edit');
  eq('DELETE', access.actionForMethod('DELETE'), 'delete');

  console.log('\n' + (fail ? 'FAILED ' + fail + ' / ' + (pass + fail) : 'ALL ' + pass + ' PASSED'));
  process.exit(fail ? 1 : 0);
})();
