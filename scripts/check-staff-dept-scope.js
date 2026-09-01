/* READ-ONLY audit: which staff would a department-scoped account actually see?
 *
 *   node scripts/check-staff-dept-scope.js
 *
 * `staffScope: 'departments'` matches a staff record's current_department against the
 * department register. Those values are free text typed by whoever entered the record,
 * so they drift from the register's canonical names ("Level-10" vs "IPD Cabin Level
 * 10"). server/access.js reconciles that with squash-matching plus an alias table —
 * this script reports what still does NOT resolve, so nobody discovers it as a
 * silently-empty roster.
 *
 * Anything listed as UNMATCHED is invisible to every department-scoped account. Fix it
 * either by correcting the staff record's department, or by adding the spelling to
 * DEPT_ALIASES in server/access.js.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });
if (!process.env.VERCEL) {
  try { require('dns').setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']); } catch (e) { /* ignore */ }
}
const access = require('../server/access');
const { getStaff, getDepartments } = require('../server/db');

(async () => {
  const [staff, depts] = await Promise.all([getStaff(), getDepartments()]);
  if (!staff.length) { console.log('No staff records found.'); process.exit(0); }

  const rows = [];
  let covered = 0;
  for (const d of depts) {
    if (d.qualityOnly) continue;
    const scope = { unrestricted: false, role: 'User', perms: { staff: ['view'] }, departments: [d.id], qualityAreas: [], staffScope: 'departments' };
    const seen = await access.filterStaff(scope, staff);
    rows.push({ id: d.id, name: d.name, n: seen.length });
    covered += seen.length;
  }
  rows.sort((a, b) => b.n - a.n);

  console.log('\nStaff visible to an account scoped to each department');
  console.log('  ' + 'department'.padEnd(34) + 'staff');
  rows.forEach((r) => console.log('  ' + (r.name + ' (' + r.id + ')').padEnd(34) + String(r.n).padStart(4) + (r.n === 0 ? '   <-- nobody' : '')));

  // Anyone matched by no department at all.
  const allDeptIds = depts.filter((d) => !d.qualityOnly).map((d) => d.id);
  const everyone = { unrestricted: false, role: 'User', perms: { staff: ['view'] }, departments: allDeptIds, qualityAreas: [], staffScope: 'departments' };
  const matched = new Set((await access.filterStaff(everyone, staff)).map((r) => String(r.id)));
  const orphans = staff.filter((r) => !matched.has(String(r.id)));

  console.log('\n' + matched.size + ' of ' + staff.length + ' staff resolve to at least one department.');
  if (orphans.length) {
    const byVal = new Map();
    orphans.forEach((r) => {
      const v = (r.current_department || r.department || '').trim() || '(blank)';
      if (!byVal.has(v)) byVal.set(v, []);
      byVal.get(v).push(r.name || r.emp_id || r.id);
    });
    console.log('\nUNMATCHED — invisible to every department-scoped account (' + orphans.length + ' staff):');
    [...byVal.entries()].sort((a, b) => b[1].length - a[1].length).forEach(([v, who]) => {
      console.log('  ' + String(v).padEnd(32) + String(who.length).padStart(3) + '  e.g. ' + who.slice(0, 3).join(', '));
    });
    console.log('\nFix each by correcting the staff record, or add the spelling to DEPT_ALIASES in server/access.js.');
  }
  process.exit(0);
})().catch((e) => { console.error('ERROR: ' + (e && e.message || e)); process.exit(1); });
