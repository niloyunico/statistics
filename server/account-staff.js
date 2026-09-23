/* Which staff-register record a login account belongs to.
 *
 * Employee numbers are NOT a safe key on their own: the register and the accounts have
 * disagreed (2026-09-23: register 11104 = Md Zakir, 11105 = Md. Balayet Hossen, while
 * the ACCOUNTS 11104/11105 are Belayet Hossien/Md Zakir), and a few numbers are shared
 * by two people. Matching "username = emp_id" blindly showed one person another's
 * record and photo. So a number-only match must also AGREE on the name, allowing the
 * spelling drift the register is full of (Belayet/Balayet, Hossien/Hossen, "Md."/none).
 *
 * Order: admin-set staffId → admin-set staffEmpId (unique) → username as emp_id whose
 * name agrees (unique) → exact name (unique) → close name (unique). Ambiguous = null.
 *
 * ⚠️ The renderer has the SAME rule in renderer/unico/staff-data.js (unicoStaffOfAccount);
 * change both together.
 */
const TITLES = new Set(['md', 'mst', 'mohammad', 'mohammed', 'muhammad', 'mohd', 'mrs', 'mr', 'ms', 'dr', 'miss']);
const norm = (x) => String(x == null ? '' : x).trim().toLowerCase().replace(/\s+/g, ' ');
function tokens(name) {
  return norm(name).replace(/[^a-zঀ-৿ ]+/g, ' ').split(' ').filter((t) => t.length >= 3 && !TITLES.has(t));
}
function lev(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length; if (!m || !n) return m || n;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
const tokSame = (a, b) => a === b || (Math.min(a.length, b.length) >= 4 && lev(a, b) <= 2);
// Some token in common (typo-tolerant): enough to CONFIRM a number match.
function nameAgrees(a, b) {
  const A = tokens(a), B = tokens(b);
  if (!A.length || !B.length) return true;          // nothing to contradict
  return A.some((x) => B.some((y) => tokSame(x, y)));
}
// Every token of the shorter name found in the longer one: strong enough to match on NAME alone.
function nameClose(a, b) {
  const A = tokens(a), B = tokens(b);
  if (!A.length || !B.length) return false;
  const [s, l] = A.length <= B.length ? [A, B] : [B, A];
  return s.every((x) => l.some((y) => tokSame(x, y)));
}
const only = (arr) => (arr.length === 1 ? arr[0] : null);

function staffOfAccount(acct, list) {
  if (!acct) return null;
  const rows = (list || []).filter((r) => r && !r.former);
  if (acct.staffId != null && acct.staffId !== '') {
    const hit = rows.find((r) => String(r.id) === String(acct.staffId));
    if (hit) return hit;
  }
  const empOf = (v) => (norm(v) ? rows.filter((r) => norm(r.emp_id) === norm(v)) : []);
  let hit = only(empOf(acct.staffEmpId));
  if (hit) return hit;
  hit = only(empOf(acct.username).filter((r) => nameAgrees(r.name, acct.name)));
  if (hit) return hit;
  if (acct.name) {
    // A username that IS an employee number vetoes a record carrying a DIFFERENT number:
    // two "Rabbi Miah"s (11223, 11230) are two people, not one spelled twice.
    const numU = /^\d{3,}$/.test(norm(acct.username)) ? norm(acct.username) : '';
    const numOk = (r) => !numU || !norm(r.emp_id) || norm(r.emp_id) === numU;
    hit = only(rows.filter((r) => norm(r.name) === norm(acct.name)).filter(numOk));
    if (hit) return hit;
    hit = only(rows.filter((r) => nameClose(r.name, acct.name)).filter(numOk));
    if (hit) return hit;
  }
  return null;
}

module.exports = { staffOfAccount, nameAgrees, nameClose };
