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

async function loadRoster() {
  const [snapshot, base] = await Promise.all([
    getAppData({ fresh: true, noRescue: true }), getStaff({ fresh: true }),
  ]);
  return resolveRoster(snapshot.data, base);
}

module.exports = { resolveRoster, loadRoster };
