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
var _qualitySig = null;
window.refreshQualitySeed = function () {
  return fetch('/api/quality', { credentials: 'same-origin', cache: 'no-store' })
    .then(function (r) { return r.json(); })
    .then(function (j) {
      if (!j || !j.ok || !Array.isArray(j.quality)) return false;
      // Collector sessions also receive their re-scoped definition overlay (indicator
      // assign/unassign etc.) — keep the local copy current so admin edits apply live.
      // Through the bridge + announced, so mounted quality stores reload instead of writing
      // their old overlay back (see refreshDepartments).
      try {
        var ov = j.overlay && j.overlay['unico_quality_v2'];
        if (typeof ov === 'string') {
          if (typeof window.unicoApplyRemoteOverlay === 'function') window.unicoApplyRemoteOverlay({ unico_quality_v2: ov }, { source: 'quality' });
          else if (localStorage.getItem('unico_quality_v2') !== ov) { localStorage.setItem('unico_quality_v2', ov); window.dispatchEvent(new CustomEvent('unico:overlay-merged', { detail: { keys: ['unico_quality_v2'], source: 'quality' } })); }
        }
      } catch (e) { }
      // Unchanged since the last refresh (the app polls every 60 s): no swap, no rebuild event.
      var sig = JSON.stringify(j.quality);
      if (sig === _qualitySig) return true;
      _qualitySig = sig;
      window.QUALITY_SEED = j.quality;
      // Same contract as refreshDepartments: notify mounted stores so open quality
      // views rebuild from the fresh seed without needing a remount/reload.
      try { window.dispatchEvent(new CustomEvent('unico:data-refreshed', { detail: { source: 'quality' } })); } catch (e) { }
      return true;
    }).catch(function () { return false; });
};

// Formula Library edits used to reach only the tab that saved them (the master is injected
// once at page load). Re-read the catalogue and rebuild window.QI_CORRECTIONS exactly like the
// server inject (server/quality-formulas.js buildByNameMap: same DEF_FIELDS, same norm — the one
// quality-store.js correctedBase() looks names up with). An empty catalogue (dev / no DB) keeps
// the bundled static corrections, as at load.
window.refreshQualityFormulas = function () {
  return fetch('/api/quality-formulas', { credentials: 'same-origin', cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) {
      if (!j || !j.ok || !Array.isArray(j.formulas) || !j.formulas.length) return false;
      if (JSON.stringify(j.formulas) === JSON.stringify(window.__UNICO_QI_FORMULAS__ || null)) return false;
      var DEF_FIELDS = ['formula', 'unit', 'numLabel', 'denLabel', 'numeratorDef', 'denominatorDef', 'benchmark', 'benchmarkValue', 'benchmarkNote', 'goalDirection', 'reference', 'referenceUrl', 'denAdminOnly', 'victimField'];
      var norm = function (s) { return String(s || '').trim().toLowerCase().replace(/\s+/g, ' '); };
      var empty = function (v) { return v === undefined || v === null || v === ''; };
      var map = {};
      j.formulas.forEach(function (f) {
        var def = { canonicalName: f.canonicalName };
        DEF_FIELDS.forEach(function (k) { if (!empty(f[k])) def[k] = f[k]; });
        (f.aliases || []).map(norm).concat([norm(f.canonicalName)]).forEach(function (k) { if (k) map[k] = def; });
      });
      window.QI_CORRECTIONS = map; window.__UNICO_QI_CORRECTIONS__ = map; window.__UNICO_QI_FORMULAS__ = j.formulas;
      try { window.dispatchEvent(new CustomEvent('unico:data-refreshed', { detail: { source: 'formulas' } })); } catch (e) { }
      return true;
    }).catch(function () { return false; });
};
