/* Organize the live database WITHOUT renaming or deleting anything.
 *
 *   node scripts/organize-database.js           # dry run: prints exactly what would change
 *   node scripts/organize-database.js --apply   # apply (take a backup first: scripts/backup-mongo-local.js)
 *
 * 1. Indexes — the busy collections had only _id, so every lookup scanned the whole
 *    collection (slow pages / "database busy" on the free Atlas tier). Indexes change no data.
 * 2. Empty duplicate columns — a department column with the same label as another column and
 *    NO value in any month is marked { hidden: true, duplicateOf: <the column that holds the
 *    data> }. The definition stays; forms and reports stop offering it, so values can't be
 *    split across two ids. Re-checked at write time: a twin that has gained a value is skipped.
 * 3. Missing record details (additive only, existing fields kept):
 *    - submissions.submittedByUser = the login of the submitter, only where the stored
 *      submittedBy / responsible name matches exactly ONE account;
 *    - users.createdAt copied from the legacy created_at where createdAt is absent.
 */
const path = require('path');
const serverRequire = require('module').createRequire(path.join(__dirname, '..', 'server', 'index.js'));
serverRequire('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });
const db = serverRequire('./db');
const APPLY = process.argv.includes('--apply');
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const has = (v) => v != null && v !== '';

const INDEXES = [
  ['submissions', { status: 1, submittedAt: -1 }, 'status_submittedAt'],
  ['submissions', { type: 1, month: 1, department: 1 }, 'type_month_department'],
  ['submissions', { type: 1, month: 1, area: 1, indicatorId: 1 }, 'type_month_area_indicator'],
  ['submissions', { submittedByUser: 1, submittedAt: -1 }, 'submittedByUser_submittedAt'],
  ['submissions', { submittedAt: -1 }, 'submittedAt'],
  ['responsibles', { empId: 1 }, 'empId'],
  ['users', { role: 1 }, 'role'],
  ['staff', { emp_id: 1 }, 'emp_id'],
  ['staffCertifications', { empId: 1 }, 'empId'],
  ['activity_log', { ts: -1 }, 'ts'],
  ['activity_log', { username: 1, ts: -1 }, 'username_ts'],
  ['phoneMessages', { room: 1, ts: 1 }, 'room_ts'],
  ['dutyRosters', { dept: 1, year: 1, month: 1 }, 'dept_year_month'],
  ['supervisorReports', { date: -1 }, 'date'],
  ['departments', { 'quality.key': 1 }, 'quality_key'],
];

(async () => {
  const h = await db.getDbHandle(); const d = h && h.db ? h.db : h;
  if (!d) throw new Error('No database connection.');
  console.log((APPLY ? 'APPLY' : 'DRY RUN') + ' on database "' + d.databaseName + '"\n');

  // ---- 1. indexes
  console.log('== 1. indexes');
  const existingNames = new Set(await d.listCollections({}, { nameOnly: true }).toArray().then((a) => a.map((c) => c.name)));
  for (const [coll, keys, name] of INDEXES) {
    if (!existingNames.has(coll)) { console.log('  skip ' + coll + ' (collection does not exist)'); continue; }
    const have = await d.collection(coll).indexes();
    const same = have.find((i) => JSON.stringify(i.key) === JSON.stringify(keys));
    if (same) { console.log('  ok   ' + coll + ' ' + JSON.stringify(keys) + ' (exists as ' + same.name + ')'); continue; }
    console.log('  add  ' + coll + ' ' + JSON.stringify(keys));
    if (APPLY) await d.collection(coll).createIndex(keys, { name });
  }

  // ---- 2. empty duplicate columns
  console.log('\n== 2. empty duplicate columns');
  const deps = await d.collection('departments').find({}).toArray();
  for (const dep of deps) {
    const cols = dep.cols || [];
    const rows = dep.data || [];
    const filled = (id) => rows.filter((r) => r && has(r[id])).length;
    const groups = {};
    cols.forEach((c) => { if (c && !c.hidden) (groups[norm(c.label)] = groups[norm(c.label)] || []).push(c.id); });
    for (const ids of Object.values(groups).filter((g) => g.length > 1)) {
      const counts = ids.map((id) => ({ id, n: filled(id) }));
      const keep = counts.filter((x) => x.n > 0);
      if (keep.length !== 1) { console.log('  leave ' + (dep.name || dep._id) + ' ' + ids.join('/') + ' — ' + (keep.length ? 'more than one column holds data (needs a person to decide)' : 'no column holds data yet')); continue; }
      for (const twin of counts.filter((x) => x.n === 0)) {
        console.log('  hide  ' + (dep.name || dep._id) + ': "' + twin.id + '" (empty) → duplicate of "' + keep[0].id + '" (' + keep[0].n + ' months of data)');
        if (!APPLY) continue;
        // Conditional on the twin still being empty in every month row.
        const r = await d.collection('departments').updateOne(
          { _id: dep._id, ['data.' + twin.id]: { $exists: false } },
          { $set: { 'cols.$[c].hidden': true, 'cols.$[c].duplicateOf': keep[0].id } },
          { arrayFilters: [{ 'c.id': twin.id }] },
        );
        if (!r.matchedCount) console.log('        skipped — the column gained a value since the scan');
      }
    }
  }

  // ---- 3. missing record details
  console.log('\n== 3. missing record details');
  const users = await d.collection('users').find({}).toArray();
  const byName = {};
  users.forEach((u) => { const k = norm(u.name); if (k) (byName[k] = byName[k] || []).push(u.username); });
  const subs = await d.collection('submissions').find({ submittedByUser: { $exists: false } }).toArray();
  let matched = 0, ambiguous = 0, unknown = 0;
  for (const s of subs) {
    const candidates = [s.submittedBy, s.responsible && s.responsible.name].map(norm).filter(Boolean);
    const logins = [...new Set(candidates.flatMap((c) => (byName[c] || [])))];
    const direct = users.find((u) => u.username === String(s.submittedBy || '').toLowerCase());
    const login = direct ? direct.username : (logins.length === 1 ? logins[0] : null);
    if (!login) { if (logins.length > 1) ambiguous++; else unknown++; continue; }
    matched++;
    if (APPLY) await d.collection('submissions').updateOne({ _id: s._id, submittedByUser: { $exists: false } }, { $set: { submittedByUser: login } });
  }
  console.log('  submissions without a username: ' + subs.length + ' → fill ' + matched + ', ambiguous name (left) ' + ambiguous + ', no matching account (left) ' + unknown);
  const legacy = users.filter((u) => u.createdAt == null && u.created_at != null);
  console.log('  users with only created_at: ' + legacy.length + ' → copy to createdAt (created_at kept)');
  if (APPLY) {
    for (const u of legacy) {
      const t = typeof u.created_at === 'number' ? u.created_at : Date.parse(u.created_at);
      if (Number.isFinite(t)) await d.collection('users').updateOne({ _id: u._id, createdAt: { $exists: false } }, { $set: { createdAt: t } });
    }
  }
  console.log('\n' + (APPLY ? 'Done.' : '(dry run — nothing written; pass --apply)'));
})().then(() => process.exit(0)).catch((e) => { console.error('FAILED:', e.stack || e.message); process.exit(1); });
