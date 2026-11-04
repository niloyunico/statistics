/* The developer credit at the foot of every screen (window.AppCredit). One quiet line under the
 * content, scrolling with it, never fixed over anything. Hidden on paper: printing a screen or
 * exporting a PDF must not carry it (the printed reports have their own footers).
 */
(function () {
  const CSS = '.app-credit{margin:28px auto 0;padding:12px 8px 4px;border-top:1px solid var(--line-2,rgba(125,145,180,.18));'
    + 'text-align:center;font-size:11px;line-height:1.6;color:var(--muted,#6c7a8c)}'
    + '.app-credit a{color:var(--blue-700,#0072a3);font-weight:600;text-decoration:none}.app-credit a:hover{text-decoration:underline}'
    + '.app-credit .sep{margin:0 6px;opacity:.5}'
    + '@media print{.app-credit{display:none!important}}body.pdf-export-mode .app-credit{display:none!important}';

  function AppCredit() {
    return (
      <React.Fragment>
      <style>{CSS}</style>
      <footer className="app-credit">
        Designed &amp; developed by <a href="https://nasifahammedniloy.com" target="_blank" rel="noopener">Nasif Ahammed Niloy</a>
        <span className="sep">·</span><a href="https://nasifahammedniloy.com" target="_blank" rel="noopener">nasifahammedniloy.com</a>
        <span className="sep">·</span>Queries: <a href="https://wa.me/8801947527775" target="_blank" rel="noopener">WhatsApp 01947527775</a>
      </footer>
      </React.Fragment>
    );
  }

  window.AppCredit = AppCredit;
})();
