/* UNICO — Quality Indicators.
   The reports now live in MongoDB (the `quality` collection) and are injected by the
   Express web server as window.__UNICO_QUALITY__ before this script runs. No hardcoded
   quality data remains here. To edit the seed: server/seed/quality.json then
   npm --prefix server run seed-data -- quality --force */
// An INJECTED array wins even when it is EMPTY. The `.length` test that used to be
// here treated "the server scoped you to nothing" the same as "the server injected
// nothing", so an account whose quality areas matched none of the real keys fell
// through to the unscoped bundled seed and was shown the whole hospital. Empty is an
// answer; only a MISSING inject is a reason to fall back.
window.QUALITY_SEED = (typeof window !== 'undefined' && Array.isArray(window.__UNICO_QUALITY__))
  ? window.__UNICO_QUALITY__
  : ((typeof window !== 'undefined' && Array.isArray(window.__UNICO_QUALITY_FALLBACK__)) ? window.__UNICO_QUALITY_FALLBACK__ : []);

// Live refetch (same contract as window.UNICO.refreshDepartments): after an approved
// quality submission is applied server-side, replace the stale page-load snapshot so
// the Quality console shows the new reading when its view (re)mounts.
window.refreshQualitySeed = function () {
  return fetch('/api/quality', { credentials: 'same-origin' })
    .then(function (r) { return r.json(); })
    .then(function (j) {
      if (!j || !j.ok || !Array.isArray(j.quality)) return false;
      window.QUALITY_SEED = j.quality;
      // Collector sessions also receive their re-scoped definition overlay (indicator
      // assign/unassign etc.) — keep the local copy current so admin edits apply live.
      try { if (j.overlay && typeof j.overlay['unico_quality_v2'] === 'string') localStorage.setItem('unico_quality_v2', j.overlay['unico_quality_v2']); } catch (e) { }
      // Same contract as refreshDepartments: notify mounted stores so open quality
      // views rebuild from the fresh seed without needing a remount/reload.
      try { window.dispatchEvent(new CustomEvent('unico:data-refreshed', { detail: { source: 'quality' } })); } catch (e) { }
      return true;
    }).catch(function () { return false; });
};
