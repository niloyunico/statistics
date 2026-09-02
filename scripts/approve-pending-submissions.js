/* Bulk-approve every PENDING data-collection submission, exactly as pressing
 * Approve on each one in the app would: values are applied to the live
 * `departments` / `quality` collections via the server's own approveSubmission()
 * (applyPatient / applyQuality), the submission is marked approved, and any
 * still-pending duplicate for the same target+month is auto-rejected.
 *
 * Newest first, deliberately: where the same dept/indicator+month was submitted
 * twice, the LATEST values are the ones applied and the older copies become the
 * auto-rejected duplicates.
 *
 *     node scripts/approve-pending-submissions.js            list what would happen
 *     node scripts/approve-pending-submissions.js --apply    actually approve
 *
 * Reads MONGODB_URI from server/.env (the authoritative cluster). Restart or
 * cache-flush afterwards so serving instances drop their cached copies.
 */
const path = require('path');
require(path.join(__dirname, '..', 'server', 'node_modules', 'dotenv')).config({ path: path.join(__dirname, '..', 'server', '.env') });
const dc = require(path.join(__dirname, '..', 'server', 'data-collection'));
const { MongoClient } = require(path.join(__dirname, '..', 'server', 'node_modules', 'mongodb'));

const APPLY = process.argv.includes('--apply');
const INCLUDE_FUTURE = process.argv.includes('--include-future');

// "Sep-26" -> first millisecond of that month. A submission dated BEFORE its own
// month began is almost certainly a month-picker mistake; skip unless overridden.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function monthStart(m) {
  const p = /^([A-Za-z]{3})-(\d{2})$/.exec(String(m || ''));
  if (!p) return 0;
  const mi = MONTHS.indexOf(p[1]);
  return mi < 0 ? 0 : new Date(2000 + parseInt(p[2], 10), mi, 1).getTime();
}

(async () => {
  const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  const h = client.db(process.env.DB_NAME || 'unico');
  const pend = await h.collection('submissions').find({ status: 'pending' }).sort({ submittedAt: -1 }).toArray();
  await client.close();
  console.log((APPLY ? 'Approving' : 'DRY RUN — would approve') + ' ' + pend.length + ' pending submissions (newest first):\n');

  let ok = 0, dup = 0, fail = 0;
  for (const s of pend) {
    const label = [
      new Date(s.submittedAt || 0).toISOString().slice(0, 16),
      (s.type || '?'),
      (s.departmentName || s.areaName || s.department || s.area || '?'),
      (s.month || ''),
      s.indicatorName ? s.indicatorName.slice(0, 55) : '',
    ].filter(Boolean).join(' | ');
    if (!INCLUDE_FUTURE && monthStart(s.month) > (s.submittedAt || 0)) {
      console.log('  SKIPPED (month had not started when submitted — likely a month-picker mistake; use --include-future to approve): ' + label);
      continue;
    }
    if (!APPLY) { console.log('  ' + label); continue; }
    try {
      const r = await dc.approveSubmission(String(s._id), 'Nasif Ahammed (bulk approve)');
      ok++;
      console.log('  APPROVED ' + label + (r.autoRejected ? '  (+' + r.autoRejected + ' older duplicate auto-rejected)' : ''));
    } catch (e) {
      const m = String((e && e.message) || e);
      if (m.indexOf('Only pending') >= 0) { dup++; console.log('  skipped (auto-rejected as duplicate of a newer one): ' + label); }
      else { fail++; console.log('  FAILED ' + label + ' -> ' + m); }
    }
  }
  if (APPLY) console.log('\nDone: approved=' + ok + '  duplicates-skipped=' + dup + '  failed=' + fail);
  else console.log('\nRun again with --apply to approve these.');
  process.exit(0);
})().catch((e) => { console.error('ERROR: ' + String((e && e.message) || e)); process.exit(1); });
