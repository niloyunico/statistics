/* UNICO — client-side canonical department map helper.
 * Thin wrapper over window.__UNICO_DEPT_MAP__ (injected by server/web.js from
 * departments.qualityKey + quality.deptId). ONE place to resolve a department id or a
 * quality-area key to the single canonical NAME shown everywhere, so Statistics and
 * Quality never disagree ("Cath Lab" not "Cathlab"). See server/deptmap.js.
 */
(function () {
  function M() {
    return (typeof window !== 'undefined' && window.__UNICO_DEPT_MAP__) ||
      { byId: {}, idToQk: {}, qkToId: {}, patientDepts: [], allKeys: [] };
  }
  function nameFromId(id) { const e = M().byId[id]; return (e && e.name) || id; }
  function qkFromId(id) { return M().idToQk[id] || null; }
  function idFromQk(key) { return M().qkToId[key] || null; }
  // Canonical display name for a quality-area key (falls back to the key itself).
  function nameFromQualityKey(key) { const id = idFromQk(key); return id ? nameFromId(id) : key; }
  function isQualityOnly(id) { const e = M().byId[id]; return !!(e && e.qualityOnly); }
  function allAreaKeys() { return (M().allKeys || []).slice(); }
  function patientDeptIds() { return (M().patientDepts || []).slice(); }
  // Quality areas derived from a canonical department-id list (mirrors server deriveQualityAreas).
  function areasFromDepts(ids, allQualityAreas) {
    if (allQualityAreas) return allAreaKeys();
    const out = [];
    (ids || []).forEach((id) => { const qk = qkFromId(id); if (qk && out.indexOf(qk) < 0) out.push(qk); });
    return out;
  }
  window.DEPTMAP = { map: M, nameFromId, qkFromId, idFromQk, nameFromQualityKey, isQualityOnly, allAreaKeys, patientDeptIds, areasFromDepts };
})();
