/* The developer credit (window.AppCredit). In the app shell it is the last child of .main, a
 * slim bar BELOW the scrolling .content, so it stays at the bottom of the window on every
 * screen (short pages no longer leave it floating mid-page) and never covers the content.
 * Elsewhere (the collector portal) it simply follows the page. Hidden on paper: printing a
 * screen or exporting a PDF must not carry it (the printed reports have their own footers).
 */
(function () {
  const CSS = '.app-credit{flex-shrink:0;position:relative;z-index:4;background:rgba(255,255,255,.86);'
    + '-webkit-backdrop-filter:saturate(1.4) blur(8px);backdrop-filter:saturate(1.4) blur(8px);'
    + 'border-top:1px solid var(--line,#dde3ec);box-shadow:0 -6px 18px -14px rgba(22,32,46,.35)}'
    + '.app-credit .ac-in{max-width:1400px;margin:0 auto;padding:7px 26px;display:flex;align-items:center;gap:14px;min-height:38px;box-sizing:border-box}'
    + '.app-credit .ac-by{display:flex;align-items:center;gap:9px;min-width:0;font-size:11.5px;color:var(--muted,#6c7a8c);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '.app-credit .ac-mark{width:22px;height:22px;border-radius:7px;flex-shrink:0;display:grid;place-items:center;font-size:9.5px;font-weight:800;letter-spacing:.3px;color:#fff;'
    + 'background:linear-gradient(135deg,var(--blue-500,#27a8db),var(--blue-700,#0072a3));box-shadow:0 2px 6px rgba(0,114,163,.35)}'
    + '.app-credit .ac-name{color:var(--ink,#16202e);font-weight:700;text-decoration:none}.app-credit .ac-name:hover{color:var(--blue-700,#0072a3)}'
    + '.app-credit .ac-links{margin-left:auto;display:flex;align-items:center;gap:6px;flex-shrink:0}'
    + '.app-credit .ac-chip{display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 10px;border-radius:999px;font-size:11px;font-weight:600;'
    + 'text-decoration:none;color:var(--ink-2,#3c4858);background:var(--panel-2,#f7f9fc);border:1px solid var(--line,#dde3ec);transition:border-color .15s,color .15s,background .15s}'
    + '.app-credit .ac-chip:hover{color:var(--blue-700,#0072a3);border-color:var(--blue-500,#27a8db);background:#fff}'
    + '.app-credit .ac-chip.wa{color:#127a45;background:#effaf3;border-color:#c9ecd6}.app-credit .ac-chip.wa:hover{border-color:#25a35a;background:#fff}'
    + '.app-credit .ac-chip svg{flex-shrink:0}'
    + '@media (max-width:760px){.app-credit .ac-in{padding:6px 12px;gap:8px}.app-credit .ac-site,.app-credit .ac-pre{display:none}}'
    + '@media (max-width:420px){.app-credit .ac-wa-l{display:none}}'
    + '@media print{.app-credit{display:none!important}}body.pdf-export-mode .app-credit{display:none!important}';

  const SITE = 'https://nasifahammedniloy.com';
  const WA = 'https://wa.me/8801947527775';
  const svg = (d) => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
  );

  function AppCredit() {
    return (
      <React.Fragment>
      <style>{CSS}</style>
      <footer className="app-credit">
        <div className="ac-in">
          <span className="ac-by">
            <span className="ac-mark" aria-hidden="true">NA</span>
            <span><span className="ac-pre">Designed &amp; developed by </span><a className="ac-name" href={SITE} target="_blank" rel="noopener">Nasif Ahammed Niloy</a></span>
          </span>
          <span className="ac-links">
            <a className="ac-chip ac-site" href={SITE} target="_blank" rel="noopener" title="Developer website">
              {svg(<React.Fragment><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></React.Fragment>)}
              nasifahammedniloy.com
            </a>
            <a className="ac-chip wa" href={WA} target="_blank" rel="noopener" title="Questions or problems? Message on WhatsApp">
              {svg(<path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.4A8.5 8.5 0 1 1 21 11.5z"/>)}
              <span><span className="ac-wa-l">WhatsApp </span>01947527775</span>
            </a>
          </span>
        </div>
      </footer>
      </React.Fragment>
    );
  }

  window.AppCredit = AppCredit;
})();
