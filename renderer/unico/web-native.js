/* UNICO web bridge — the browser stand-in for the Electron "unicoNative" API.
 *
 * The Express web server injects this file (and window.__UNICO_SNAPSHOT__) into
 * index.html BEFORE the inline db-bridge runs, so the renderer behaves exactly
 * as it did inside the desktop shell:
 *   - hydrate localStorage from the snapshot at startup (done by the inline bridge
 *     using our .snapshot),
 *   - mirror every change back to the database via .persist() -> PUT /api/data.
 *
 * If a real Electron bridge is already present (running inside the desktop app),
 * we do nothing and let it win.
 */
(function () {
  if (window.unicoNative) return; // real desktop bridge present
  var API = ''; // same-origin; the server serves both the page and /api/*

  // When the login session expires (12h JWT) every mirror PUT starts failing with
  // 401 — silently, so the user keeps editing while nothing is saved. Show a
  // one-time, unmissable banner that sends them back through /login.
  var sessionWarned = false;
  function warnSessionExpired() {
    if (sessionWarned) return;
    sessionWarned = true;
    try {
      var b = document.createElement('div');
      b.setAttribute('role', 'alert');
      b.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:18px;z-index:99999;'
        + 'max-width:min(560px,92vw);font:600 13px/1.45 "IBM Plex Sans",system-ui,"Segoe UI",sans-serif;'
        + 'color:#fff;background:#b4232f;border-radius:12px;padding:12px 16px;'
        + 'box-shadow:0 10px 30px rgba(5,12,24,.4);text-align:center';
      b.innerHTML = 'Your session has expired &mdash; recent changes are <u>not being saved</u>. '
        + '<a href="/login" style="color:#fff;font-weight:700">Sign in again</a> to continue.';
      document.body.appendChild(b);
    } catch (e) { /* banner is best-effort */ }
  }

  // Persist the full localStorage key->value map to MongoDB (debounced by caller).
  function persist(data) {
    return fetch(API + '/api/data', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ data: data || {} }),
    }).then(function (r) {
      if (r.status === 401) { warnSessionExpired(); return { ok: false, error: 'Session expired' }; }
      return r.json().catch(function () { return { ok: r.ok }; });
    }).catch(function (e) {
      return { ok: false, error: String(e) };
    });
  }

  // Back up = download all data as a .unicobak (JSON) file in the browser.
  function backup(data) {
    try {
      var text = JSON.stringify(data || {}, null, 2);
      var blob = new Blob([text], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      var stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = 'UNICO-Backup-' + stamp + '.unicobak';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { try { document.body.removeChild(a); } catch (e) {} URL.revokeObjectURL(url); }, 0);
      return Promise.resolve({ ok: true });
    } catch (e) {
      return Promise.resolve({ ok: false, error: String(e) });
    }
  }

  // Restore = pick a .unicobak/.json file and return its parsed contents to apply.
  function restore() {
    return new Promise(function (resolve) {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = '.unicobak,.json,application/json';
      input.style.display = 'none';
      input.onchange = function () {
        var file = input.files && input.files[0];
        try { document.body.removeChild(input); } catch (e) {}
        if (!file) return resolve({ ok: false, canceled: true });
        var reader = new FileReader();
        reader.onload = function () {
          try {
            var obj = JSON.parse(String(reader.result));
            if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('Not a valid UNICO backup file');
            resolve({ ok: true, data: obj });
          } catch (e) { resolve({ ok: false, error: String(e && e.message || e) }); }
        };
        reader.onerror = function () { resolve({ ok: false, error: 'Could not read the file.' }); };
        reader.readAsText(file);
      };
      // If the user cancels the picker there is no event; that is fine — nothing happens.
      document.body.appendChild(input);
      input.click();
    });
  }

  function dbPath() { return Promise.resolve('MongoDB Atlas (cloud) - unicostatics'); }

  // PDF export -> browser print. The app already scopes printing to #pdf-root via
  // @media print (theme.css), so "Save as PDF" in the print dialog yields the same
  // clean report the desktop app produced through Chromium printToPDF.
  function exportPDF(opts) {
    return new Promise(function (resolve) {
      var settled = false;
      function finish(result) {
        if (settled) return;
        settled = true;
        try { document.body.classList.remove('pdf-export-mode'); } catch (e) {}
        window.removeEventListener('afterprint', onAfter);
        resolve(result || { ok: true });
      }
      function onAfter() { finish({ ok: true }); }
      try { document.body.classList.add('pdf-export-mode'); } catch (e) {}
      window.addEventListener('afterprint', onAfter);
      // Give React a tick to flush the #pdf-root portal, then open the print dialog.
      setTimeout(function () {
        try { window.print(); } catch (e) { finish({ ok: false, error: String(e) }); }
      }, 80);
      // Safety net in case 'afterprint' never fires (some browsers/headless).
      setTimeout(function () { finish({ ok: true }); }, 60000);
    });
  }

  window.unicoNative = {
    snapshot: window.__UNICO_SNAPSHOT__ || {},
    persist: persist,
    backup: backup,
    restore: restore,
    dbPath: dbPath,
    exportPDF: exportPDF,
    isWeb: true,
  };
})();
