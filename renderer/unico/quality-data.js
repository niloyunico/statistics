/* UNICO — Quality Indicators.
   The reports now live in MongoDB (the `quality` collection) and are injected by the
   Express web server as window.__UNICO_QUALITY__ before this script runs. No hardcoded
   quality data remains here. To edit the seed: server/seed/quality.json then
   npm --prefix server run seed-data -- quality --force */
window.QUALITY_SEED = (typeof window !== 'undefined' && Array.isArray(window.__UNICO_QUALITY__)) ? window.__UNICO_QUALITY__ : [];

// Live refetch (same contract as window.UNICO.refreshDepartments): after an approved
// quality submission is applied server-side, replace the stale page-load snapshot so
// the Quality console shows the new reading when its view (re)mounts.
window.refreshQualitySeed = function () {
  return fetch('/api/quality', { credentials: 'same-origin' })
    .then(function (r) { return r.json(); })
    .then(function (j) {
      if (!j || !j.ok || !Array.isArray(j.quality)) return false;
      window.QUALITY_SEED = j.quality;
      // Same contract as refreshDepartments: notify mounted stores so open quality
      // views rebuild from the fresh seed without needing a remount/reload.
      try { window.dispatchEvent(new CustomEvent('unico:data-refreshed', { detail: { source: 'quality' } })); } catch (e) { }
      return true;
    }).catch(function () { return false; });
};
