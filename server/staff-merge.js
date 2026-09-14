const KEY = 'unico_staff_v3';
function conflict(message) {
  const error = new Error(message || 'This staff record changed in another session. Refresh the directory and review your edits before saving again.');
  error.status = 409;
  return error;
}
function parse(raw) {
  if (raw == null) return [];
  const rows = JSON.parse(raw);
  if (!Array.isArray(rows) || rows.some(row => !row || row.id == null) || new Set(rows.map(row => String(row.id))).size !== rows.length) {
    throw conflict('Invalid staff register. Refresh before saving.');
  }
  return rows;
}
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// Fields the server restores onto a register row from the `staff` document
// (staff-roster.js resolveRoster): a browser's baseline can carry them while the stored
// row does not. That difference is not anybody's edit. Treating it as one made every
// delete, photo change or re-verification of such a person fail with a 409 forever.
const RESTORED = new Set(['photo', 'licence_verified', 'licence_no', 'licence_program']);
const absent = (v) => v === undefined || v === null || v === '';
function restoredOnly(field, live, before) {
  if (!RESTORED.has(field) || absent(before)) return false;
  if (absent(live)) return true;
  // resolveRoster also swaps in a NEWER server verification over an older stored one.
  return field === 'licence_verified' && String((live && live.at) || '') < String((before && before.at) || '');
}
function sameRow(live, before) {
  for (const k of new Set([...Object.keys(live), ...Object.keys(before)])) {
    if (!equal(live[k], before[k]) && !restoredOnly(k, live[k], before[k])) return false;
  }
  return true;
}
// Apply only edits made since this browser read the roster. Unchanged fields and
// people from an older browser copy must never undo another person's saved work.
function mergeStaffChanges(baseRaw, incomingRaw, currentRaw) {
  const base = new Map(parse(baseRaw).map(row => [String(row.id), row]));
  const incoming = new Map(parse(incomingRaw).map(row => [String(row.id), row]));
  const current = new Map(parse(currentRaw).map(row => [String(row.id), row]));
  for (const [id, before] of base) {
    const next = incoming.get(id), live = current.get(id);
    if (!next) {
      if (live && !sameRow(live, before)) throw conflict();
      current.delete(id);
      continue;
    }
    if (equal(before, next)) continue;
    if (!live) throw conflict('This staff record was removed in another session. Refresh the directory.');
    const merged = { ...live };
    for (const field of new Set([...Object.keys(before), ...Object.keys(next)])) {
      if (equal(before[field], next[field])) continue;
      if (!equal(live[field], before[field]) && !equal(live[field], next[field])
        && !restoredOnly(field, live[field], before[field])) throw conflict();
      if (Object.prototype.hasOwnProperty.call(next, field)) merged[field] = next[field];
      else delete merged[field];
    }
    current.set(id, merged);
  }
  for (const [id, next] of incoming) {
    if (base.has(id)) continue;
    if (current.has(id) && !equal(current.get(id), next)) throw conflict('Another session added a staff record with this ID. Refresh before adding this person.');
    current.set(id, next);
  }
  return JSON.stringify([...current.values()]);
}
module.exports = { KEY, conflict, mergeStaffChanges };
