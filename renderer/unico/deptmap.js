/* UNICO — client-side canonical department map helper.
 *
 * ONE place to resolve a department id or a quality-area key to the single canonical NAME
 * shown everywhere, so Statistics and Quality never disagree ("Cath Lab" not "Cathlab").
 *
 * Source of truth = window.__UNICO_DEPT_MAP__ (injected by server/web.js). BUT if that is
 * missing/empty (older server, or a page that didn't get it), we BUILD the same map on the
 * client from the always-injected globals window.__UNICO_DEPARTMENTS__ (id/name/qualityKey)
 * + window.__UNICO_QUALITY__ (key/deptId). This makes name resolution robust regardless of
 * server version, so a raw id/key is never shown where a name should be. See server/deptmap.js.
 */
(function () {
  var _cache = null;

  function buildFromGlobals() {
    var w = window;
    var deps = w.__UNICO_DEPARTMENTS__ || (w.UNICO && w.UNICO.DEPARTMENTS) || [];
    var quals = w.__UNICO_QUALITY__ || w.QUALITY_SEED || [];
    var byId = {}, idToQk = {}, qkToId = {}, patientDepts = [], allKeys = [];
    (deps || []).forEach(function (d) {
      if (!d || !d.id) return;
      byId[d.id] = { id: d.id, name: d.name || d.id, qualityKey: d.qualityKey || null };
      patientDepts.push(d.id);
      if (d.qualityKey) { idToQk[d.id] = d.qualityKey; qkToId[d.qualityKey] = d.id; }
    });
    (quals || []).forEach(function (q) {
      if (!q) return;
      var key = q.key || q._id;
      if (key) allKeys.push(key);
      var id = q.deptId || qkToId[key];
      if (key && id) { qkToId[key] = id; if (!idToQk[id]) idToQk[id] = key; }
      if (q.deptId === '__hospital__' || key === 'Overall Hospital') {
        byId['__hospital__'] = { id: '__hospital__', name: q.name || 'Overall Hospital', qualityKey: key, qualityOnly: true };
      }
    });
    return { byId: byId, idToQk: idToQk, qkToId: qkToId, patientDepts: patientDepts, allKeys: allKeys.filter(function (v, i, a) { return a.indexOf(v) === i; }) };
  }

  function M() {
    if (_cache) return _cache;
    var injected = (typeof window !== 'undefined' && window.__UNICO_DEPT_MAP__) || null;
    if (injected && injected.byId && Object.keys(injected.byId).length) { _cache = injected; return _cache; }
    // Injected map absent/empty -> build it from the raw globals (always present).
    try { _cache = buildFromGlobals(); } catch (e) { _cache = { byId: {}, idToQk: {}, qkToId: {}, patientDepts: [], allKeys: [] }; }
    return _cache;
  }

  function nameFromId(id) { var e = M().byId[id]; return (e && e.name) || id; }
  function qkFromId(id) { return M().idToQk[id] || null; }
  function idFromQk(key) { return M().qkToId[key] || null; }
  // Canonical display name for a quality-area key (falls back to the key itself).
  function nameFromQualityKey(key) { var id = idFromQk(key); return id ? nameFromId(id) : key; }
  function isQualityOnly(id) { var e = M().byId[id]; return !!(e && e.qualityOnly); }
  function allAreaKeys() { return (M().allKeys || []).slice(); }
  function patientDeptIds() { return (M().patientDepts || []).slice(); }
  // Quality areas derived from a canonical department-id list (mirrors server deriveQualityAreas).
  function areasFromDepts(ids, allQualityAreas) {
    if (allQualityAreas) return allAreaKeys();
    var out = [];
    (ids || []).forEach(function (id) { var qk = qkFromId(id); if (qk && out.indexOf(qk) < 0) out.push(qk); });
    return out;
  }

  window.DEPTMAP = { map: M, refresh: function () { _cache = null; }, nameFromId: nameFromId, qkFromId: qkFromId, idFromQk: idFromQk, nameFromQualityKey: nameFromQualityKey, isQualityOnly: isQualityOnly, allAreaKeys: allAreaKeys, patientDeptIds: patientDeptIds, areasFromDepts: areasFromDepts };
})();
