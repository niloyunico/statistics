/* UNICO — swap the code-bundled QI_CORRECTIONS for the DB-backed master.
 *
 * The server (web.js) injects window.__UNICO_QI_CORRECTIONS__ (the qualityFormulas
 * collection expanded to the by-indicator-name shape) into the page BEFORE the
 * bundle runs. This module — loaded right AFTER quality-corrections.js and BEFORE
 * quality-store.js in the bundle — makes that DB master win over the static
 * fallback, so editing one formula row in the Formula Library applies everywhere.
 * When the inject is absent (dev/in-memory, DB down, or the desktop build) the
 * static window.QI_CORRECTIONS from quality-corrections.js is left in place.
 */
(function () {
  try {
    if (typeof window === 'undefined') return;
    var db = window.__UNICO_QI_CORRECTIONS__;
    if (db && typeof db === 'object' && Object.keys(db).length) {
      window.QI_CORRECTIONS = db;
    }
  } catch (e) { /* keep the static fallback */ }
})();
