/* The shared overlay is the saved personnel register. The staff collection is
 * its initial import and holds server-verified photos/licences; it must not
 * replace later additions, edits, archives or deletions from the register. */
const { getAppData, getStaff } = require('./db');

function resolveRoster(data, base) {
  const key = 'unico_staff_v3';
  if (!Object.prototype.hasOwnProperty.call(data || {}, key)) return base || [];
  const rows = JSON.parse(data[key]);
  if (!Array.isArray(rows)) throw new Error('Invalid staff register');
  const byId = new Map((base || []).map(row => [String(row.id), row]));
  return rows.map(row => {
    const verified = byId.get(String(row.id));
    if (!verified) return row;
    const out = { ...row };
    if (!out.photo && !out.photo_url && verified.photo) out.photo = verified.photo;
    if (verified.licence_verified && (!out.licence_verified ||
      String(verified.licence_verified.at || '') > String(out.licence_verified.at || ''))) {
      out.licence_verified = verified.licence_verified;
      out.licence_no = out.licence_no || verified.licence_no;
      out.licence_program = out.licence_program || verified.licence_program;
    }
    return out;
  });
}

// `cached` is for display-only reads (the phone apps); GET /api/staff stays fresh.
async function loadRoster(opts) {
  const cached = !!(opts && opts.cached);
  const [snapshot, base] = await Promise.all(cached
    ? [getAppData(), getStaff()]
    : [getAppData({ fresh: true, noRescue: true }), getStaff({ fresh: true })]);
  return resolveRoster(snapshot.data, base);
}

// Which `staff` document a server-written field (portrait url, BNMC verification)
// belongs to. The record id alone decides. Employee numbers are NOT unique (11410 and
// 11520 each belong to two people) and a new record's form may carry a number already
// used by somebody else, so an `$or` of id-or-emp_id wrote one nurse's photo or licence
// onto another. No id -> no server write; the value still lives on the register row.
function staffIdFilter(staffId) {
  if (staffId == null || String(staffId).trim() === '') return null;
  const or = [{ _id: String(staffId) }];
  const n = Number(staffId);
  if (Number.isFinite(n)) or.unshift({ id: n });
  return { $or: or };
}

module.exports = { resolveRoster, loadRoster, staffIdFilter };
