/* NURSING KPI — the Nursing Department's KPI programme ("KPI for Nursing Department.pptx"), online.
 *
 *   kpiDashboard  where every KPI stands for a chosen period (1 / 2 / 3 / 6 / 12 months, a cycle,
 *                 or any range): status tiles, 3D charts, pillar cards, the scorecard, and a
 *                 detail drawer per KPI with its trend against the target.
 *   kpiEntry      Data Update — the month grid. Figures the hospital already has (quality data,
 *                 the hand-hygiene audit) arrive filled in; any cell can still be typed over, and
 *                 the system figure stays beside it with "Revert".
 *   kpiReports    reports for any period — the month that just ended is prepared automatically —
 *                 with commentary, sign-off, Finalise, Print, PDF, PowerPoint (full / summary), Excel.
 *   kpiManage     the KPI catalogue: every field of the deck, custom KPIs, links to quality data.
 *   kpiActions    every action plan item on one board, by status.
 *   kpiSettings   (administrator) the cycles, pillars and report title.
 *
 * Every figure comes from /api/kpi (server/kpi.js), which checks the module again. The rules —
 * cycles, targets, status, period values — are window.UNICO_KPI (kpi-core.js), the same code
 * the server and the exported files run.
 */
(function () {
  const { useState, useEffect, useMemo, useRef, useCallback } = React;
  const K = window.UNICO_KPI;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const toast = (m, t) => { if (window.UI && window.UI.toast) window.UI.toast(m, t); };
  const confirmBox = (o) => (window.UI && window.UI.confirm ? window.UI.confirm(o) : Promise.resolve(window.confirm(o.message || o.title)));
  const refreshBadge = () => { try { window.dispatchEvent(new Event('unico:kpi-refresh')); } catch (e) { } };
  const lsGet = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };   // keys never start 'unico_' (those are synced)
  const when = (t) => (t ? new Date(t).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka', dateStyle: 'medium', timeStyle: 'short' }) : '');
  const me = () => (window.__UNICO_USER__ && (window.__UNICO_USER__.name || window.__UNICO_USER__.username)) || '';
  const sigNames = () => { try { return window.unicoSig ? window.unicoSig.load() : {}; } catch (e) { return {}; } };

  async function api(url, opts) {
    const r = await fetch(url, Object.assign({ credentials: 'same-origin', cache: 'no-store', headers: { accept: 'application/json', 'content-type': 'application/json' } }, opts || {}));
    if (r.status === 401 || r.redirected) throw new Error('Your session has expired. Sign in again.');
    const j = await r.json().catch(() => null);
    if (!j) throw new Error('The server did not answer. Please try again.');
    if (!j.ok) { const e = new Error(j.error || 'Something went wrong.'); e.status = r.status; e.body = j; throw e; }
    return j;
  }
  // A file from the server (PowerPoint / Excel): build first, then download, so an error is a message.
  async function download(url) {
    const r = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
    if (!r.ok) { const j = await r.json().catch(() => null); throw new Error((j && j.error) || 'Could not build the file.'); }
    const m = /filename="([^"]+)"/.exec(r.headers.get('content-disposition') || '');
    const href = URL.createObjectURL(await r.blob());
    const a = document.createElement('a'); a.href = href; a.download = m ? m[1] : 'Nursing-KPI'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 4000);
  }

  /* Print a set of A4 sheets in their own window. The window is opened first — before any await —
     so a pop-up blocker allows it; `log` records the print on the server before anything is shown. */
  async function printSheets(getRoot, title, log, setCapturing) {
    const w = window.open('', '_blank');
    try {
      await log();
      if (!w) { toast('Allow pop-ups for this site to print.', 'error'); return; }
      setCapturing(true);
      await new Promise((r) => setTimeout(r, 60));
      const html = getRoot().innerHTML.split('src="unico/logo.svg"').join('src="' + location.origin + '/unico/logo.svg"');
      setCapturing(false);
      w.document.open();
      w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' + esc(title) + '</title><style>:root{--line:#dde3ec;--line-2:#eef2f6;--muted:#7b8796;--ink:#16202e;--ink-2:#3a4656;--blue-50:#eef8fd;--shadow:none}' +
        'html{-webkit-print-color-adjust:exact;print-color-adjust:exact}body{margin:0;font-family:"IBM Plex Sans","Segoe UI",Arial,sans-serif;background:#fff}@page{size:A4 landscape;margin:0}' + CSS +
        '.kp-doc{gap:0;padding:0}.kp-sheet{box-shadow:none;page-break-after:always;break-after:page;width:297mm;height:209mm;min-height:0}.kp-sheet:last-child{page-break-after:auto}</style></head><body><div class="kp-doc">' + html + '</div><script>window.onload=function(){setTimeout(function(){window.print();},250);};<\/script></body></html>');
      w.document.close();
    } catch (e) { if (w) w.close(); setCapturing(false); throw e; }
  }
  // The same sheets as a PDF (one A4 landscape page per sheet), logged first.
  async function pdfSheets(getRoot, title, fileName, log, setCapturing) {
    await log();
    if (window.unicoLoadPdfLibs && !(window.jspdf && window.html2canvas)) await window.unicoLoadPdfLibs();
    const J = window.jspdf && window.jspdf.jsPDF, H = window.html2canvas;
    if (!J || !H) throw new Error('The PDF tools could not load. Use Print and choose “Save as PDF”.');
    setCapturing(true);
    try {
      await new Promise((r) => setTimeout(r, 120));
      const sheets = [...getRoot().querySelectorAll('.kp-sheet')];
      const pdf = new J({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
      for (let i = 0; i < sheets.length; i++) {
        const c = await H(sheets[i], { scale: 1.6, backgroundColor: '#ffffff', useCORS: true, logging: false, windowWidth: 1200 });
        if (i) pdf.addPage();
        pdf.addImage(c.toDataURL('image/jpeg', 0.85), 'JPEG', 0, 0, 297, 210);
      }
      pdf.setProperties({ title, author: me() });
      pdf.save(fileName + '.pdf');
      toast('PDF downloaded.', 'success');
    } finally { setCapturing(false); }
  }

  /* ================================================================== styles === */
  const CSS = `
.kp-wrap{display:flex;flex-direction:column;gap:16px}
.kp-card{background:#fff;border:1px solid var(--line);border-radius:12px;box-shadow:var(--shadow)}
.kp-pad{padding:14px 16px}
.kp-rise{animation:kp-rise .45s cubic-bezier(.2,.8,.3,1) both}
@keyframes kp-rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.kp-rise,.kp-pulse{animation:none!important}}
.kp-hero{position:relative;overflow:hidden;border-radius:16px;padding:18px 22px 14px;color:#fff;background:linear-gradient(125deg,#00293A 0%,#063f57 48%,#0c6f7d 100%);box-shadow:0 10px 30px rgba(0,41,58,.22)}
.kp-hero:before,.kp-hero:after{content:'';position:absolute;border-radius:50%;pointer-events:none}
.kp-hero:before{width:340px;height:340px;right:-90px;top:-170px;background:radial-gradient(circle,rgba(55,180,166,.45),transparent 65%)}
.kp-hero:after{width:260px;height:260px;left:38%;bottom:-200px;background:radial-gradient(circle,rgba(0,143,203,.38),transparent 65%)}
.kp-hero h1{margin:0;font-size:21px;font-weight:800;letter-spacing:-.2px}
.kp-hero .sub{font-size:12.5px;opacity:.82;margin-top:3px}
.kp-hero-row{display:flex;gap:18px;align-items:flex-end;flex-wrap:wrap;position:relative;z-index:1}
.kp-cycle{min-width:240px;flex:0 1 330px;margin-left:auto}
.kp-cycle .lab{display:flex;justify-content:space-between;font-size:11px;opacity:.85;margin-bottom:5px}
.kp-cycle .bar{height:8px;border-radius:99px;background:rgba(255,255,255,.18);overflow:hidden;display:flex;gap:2px}
.kp-cycle .bar i{flex:1;background:rgba(255,255,255,.16)}
.kp-cycle .bar i.on{background:linear-gradient(90deg,#37B4A6,#7fe0d4)}
.kp-cycle .bar i.now{background:#fff;animation:kp-blink 1.6s ease-in-out infinite}
@keyframes kp-blink{50%{opacity:.55}}
.kp-nav{display:flex;gap:6px;flex-wrap:wrap;margin-top:14px;position:relative;z-index:1}
.kp-nav button{border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.08);color:#fff;border-radius:999px;padding:6px 13px;font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;display:inline-flex;gap:6px;align-items:center;transition:background .15s}
.kp-nav button:hover{background:rgba(255,255,255,.18)}
.kp-nav button.on{background:#fff;color:#00293A;border-color:#fff}
.kp-nav b{background:#d23a52;color:#fff;border-radius:99px;font-size:10px;padding:1px 6px}
.kp-bar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;padding:10px 14px}
.kp-chips{display:flex;gap:5px;flex-wrap:wrap}
.kp-chip{border:1px solid var(--line);background:#fff;color:var(--ink-2);border-radius:999px;padding:5px 11px;font:inherit;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap}
.kp-chip:hover{border-color:#9cc9e0}
.kp-chip.on{background:#00293A;color:#fff;border-color:#00293A}
.kp-sel,.kp-in{padding:6px 10px;border-radius:8px;border:1px solid var(--line);background:#fff;font:inherit;font-size:12.5px;color:var(--ink-2)}
.kp-in:focus,.kp-sel:focus{outline:2px solid rgba(0,143,203,.25);border-color:#008FCB}
textarea.kp-in{width:100%;resize:vertical;line-height:1.45}
.kp-muted{color:var(--muted);font-size:12px}
.kp-pill{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap}
.kp-pill i{width:7px;height:7px;border-radius:50%;display:inline-block}
.kp-src{display:inline-block;font-size:9.5px;font-weight:700;letter-spacing:.3px;text-transform:uppercase;padding:1px 6px;border-radius:5px}
.kp-tiles{display:grid;grid-template-columns:minmax(250px,1.5fr) repeat(4,minmax(140px,1fr));gap:12px}
.kp-tile.kp-score{display:flex;align-items:center;gap:14px}
@media (max-width:1100px){.kp-tiles{grid-template-columns:repeat(2,minmax(0,1fr))}.kp-tile.kp-score{grid-column:1/-1}}
.kp-tile{padding:14px 16px;border-radius:14px;border:1px solid var(--line);background:#fff;position:relative;overflow:hidden;cursor:pointer;transition:transform .15s,box-shadow .15s}
.kp-tile:hover{transform:translateY(-2px);box-shadow:var(--shadow-md)}
.kp-tile.sel{outline:2px solid #00293A}
.kp-tile .n{font-size:30px;font-weight:800;line-height:1;font-variant-numeric:tabular-nums}
.kp-tile .l{font-size:12px;font-weight:700;margin-top:6px}
.kp-tile .s{font-size:11px;color:var(--muted);margin-top:2px}
.kp-tile .ring{position:absolute;right:-18px;top:-18px;width:74px;height:74px;border-radius:50%;opacity:.13}
.kp-grid2{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);gap:16px}
.kp-grid3{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:14px}
@media (max-width:980px){.kp-grid2{grid-template-columns:1fr}}
.kp-h{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--line-2)}
.kp-h h3{margin:0;font-size:14px;font-weight:800;color:var(--ink)}
.kp-h .grow{flex:1}
.kp-pillar{border-radius:14px;border:1px solid var(--line);background:#fff;overflow:hidden;cursor:pointer;transition:transform .15s,box-shadow .15s}
.kp-pillar:hover{transform:translateY(-2px);box-shadow:var(--shadow-md)}
.kp-pillar.sel{outline:2px solid #00293A}
.kp-pillar .top{padding:12px 14px;color:#fff;display:flex;align-items:center;gap:10px}
.kp-pillar .top b{font-size:13.5px;flex:1}
.kp-pillar .seg{display:flex;height:6px}
.kp-pillar ul{list-style:none;margin:0;padding:8px 14px 12px;display:flex;flex-direction:column;gap:5px}
.kp-pillar li{display:flex;gap:8px;align-items:center;font-size:12px;color:var(--ink-2)}
.kp-pillar li i{width:8px;height:8px;border-radius:50%;flex:none}
.kp-pillar li span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kp-tbl{border-collapse:separate;border-spacing:0;width:100%;font-size:12.5px}
.kp-tbl th{text-align:left;padding:9px 10px;font-size:10.5px;text-transform:uppercase;letter-spacing:.35px;color:#fff;background:#00293A;font-weight:700;white-space:nowrap;position:sticky;top:0;z-index:1}
.kp-tbl th:first-child{border-top-left-radius:8px}.kp-tbl th:last-child{border-top-right-radius:8px}
.kp-tbl td{padding:8px 10px;border-bottom:1px solid var(--line-2);vertical-align:middle}
.kp-tbl tbody tr{cursor:pointer;transition:background .12s}
.kp-tbl tbody tr:hover td{background:#f4f9fc}
.kp-tbl td.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.kp-code{display:inline-flex;align-items:center;justify-content:center;min-width:30px;height:22px;padding:0 6px;border-radius:6px;font-size:11px;font-weight:800;color:#fff}
.kp-trend{font-size:11px;font-weight:700;white-space:nowrap}
.kp-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
.kp-empty{padding:28px 14px;text-align:center;color:var(--muted);font-size:13px}
.kp-banner{display:flex;gap:10px;align-items:flex-start;padding:10px 14px;border-radius:12px;border:1px solid #f0d49a;background:#fff8e9;color:#7a4b00;font-size:12.5px}
.kp-banner.ok{border-color:#a8e3da;background:#ecfaf7;color:#0d5e55}
.kp-banner.info{border-color:#b9dcef;background:#eef8fd;color:#0b4f6c}
.kp-banner button{border:1px solid currentColor;background:#fff;color:inherit;border-radius:6px;padding:1px 8px;margin:3px 4px 0 0;font:inherit;font-size:11.5px;font-weight:700;cursor:pointer}
/* data grid */
.kp-eg{border-collapse:separate;border-spacing:0;font-size:12.5px;min-width:100%}
.kp-eg th{position:sticky;top:0;z-index:2;background:#00293A;color:#fff;font-size:10.5px;text-transform:uppercase;letter-spacing:.3px;padding:9px 8px;white-space:nowrap;text-align:center}
.kp-eg th.k{left:0;z-index:3;text-align:left;min-width:250px}
.kp-eg td{border-bottom:1px solid var(--line-2);padding:4px;text-align:center;background:#fff}
.kp-eg td.k{position:sticky;left:0;z-index:1;text-align:left;padding:7px 10px;border-right:1px solid var(--line-2);background:#fff;min-width:250px;max-width:330px}
.kp-eg tr.grp td{background:#f3f6fa;color:var(--ink);font-weight:800;font-size:11.5px;text-align:left;padding:7px 10px}
.kp-eg tr.hi td{background:#fffbea}
.kp-cell{width:100%;min-width:86px;border:1px solid transparent;border-radius:8px;padding:6px 6px;background:transparent;font:inherit;font-size:12.5px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;transition:background .12s,border-color .12s}
.kp-cell:hover{background:#eef8fd;border-color:#b9dcef}
.kp-cell b{font-variant-numeric:tabular-nums;font-size:13px}
.kp-cell.missing{border:1.5px dashed #e7a1ad;color:#a3172f}
.kp-cell.missing:hover{background:#fdf0f2}
.kp-cell.partial{border:1.5px dashed #e7c27a;color:#8a5a00}
.kp-cell.future{opacity:.35;cursor:default}
.kp-savebar{position:sticky;bottom:0;display:flex;gap:8px;align-items:center;padding:10px 14px;background:#fffbea;border-top:1px solid #f0dca0;border-radius:0 0 14px 14px;z-index:4}
@media (max-width:720px){.kp-savebar{position:static}}
.kp-sched td{vertical-align:middle}
.kp-cell.span{background:repeating-linear-gradient(135deg,#fafbfd,#fafbfd 7px,#f1f4f8 7px,#f1f4f8 14px);border-color:#e3e9f0}
.kp-cell.span:hover{background:#eef8fd}
.kp-cell.span.wait{cursor:default}
.kp-cell.span.wait:hover{background:repeating-linear-gradient(135deg,#fafbfd,#fafbfd 7px,#f1f4f8 7px,#f1f4f8 14px);border-color:#e3e9f0}
.kp-cell .per{font-size:9.5px;font-weight:700;color:#7b8796;white-space:nowrap}
.kp-dot{width:7px;height:7px;border-radius:50%;display:inline-block}
.kp-legend{display:flex;gap:12px;flex-wrap:wrap;font-size:11px;color:var(--muted);align-items:center}
.kp-legend span{display:inline-flex;gap:5px;align-items:center}
/* dialogs */
.kp-back{position:fixed;inset:0;background:rgba(9,22,36,.42);z-index:1200;display:flex;align-items:center;justify-content:center;padding:16px;animation:kp-fade .15s ease-out}
@keyframes kp-fade{from{opacity:0}}
.kp-dlg{background:#fff;border-radius:16px;box-shadow:0 24px 60px rgba(9,22,36,.35);width:min(560px,100%);max-height:calc(100vh - 32px);display:flex;flex-direction:column;animation:kp-rise .2s ease-out}
.kp-dlg.wide{width:min(920px,100%)}
.kp-dlg-h{padding:16px 20px 12px;border-bottom:1px solid var(--line-2);display:flex;gap:12px;align-items:flex-start}
.kp-dlg-h h3{margin:0;font-size:16px;font-weight:800;color:var(--ink)}
.kp-dlg-b{padding:16px 20px;overflow:auto;display:flex;flex-direction:column;gap:12px}
.kp-dlg-f{padding:12px 20px;border-top:1px solid var(--line-2);display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.kp-x{border:0;background:transparent;font-size:22px;line-height:1;cursor:pointer;color:var(--muted);margin-left:auto;padding:0 4px}
.kp-lab{font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.35px;margin-bottom:4px;display:block}
.kp-fld{display:flex;flex-direction:column;gap:3px}
.kp-fld .hint{font-size:11px;color:var(--muted);line-height:1.35}
.kp-row{display:flex;gap:12px;flex-wrap:wrap}.kp-row>*{flex:1;min-width:140px}
.kp-big{font-size:34px;font-weight:800;color:#00293A;font-variant-numeric:tabular-nums;line-height:1}
.kp-sys{border:1px solid #a8e3da;background:#ecfaf7;border-radius:10px;padding:9px 12px;font-size:12.5px;color:#0d5e55;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.kp-err{color:#a3172f;font-size:12.5px;font-weight:600}
.kp-tabs{display:flex;gap:4px;border-bottom:1px solid var(--line-2);padding:0 20px;overflow-x:auto}
.kp-tabs button{border:0;background:transparent;padding:10px 12px;font:inherit;font-size:13px;font-weight:700;color:var(--muted);cursor:pointer;border-bottom:2.5px solid transparent;white-space:nowrap}
.kp-tabs button.on{color:#00293A;border-color:#37B4A6}
.kp-drawer{position:fixed;top:0;right:0;bottom:0;width:min(640px,100%);background:#fff;z-index:1200;box-shadow:-20px 0 50px rgba(9,22,36,.25);display:flex;flex-direction:column;animation:kp-slide .22s ease-out}
@keyframes kp-slide{from{transform:translateX(30px);opacity:0}}
.kp-act{display:flex;gap:8px;align-items:flex-start;padding:7px 0;border-bottom:1px dashed var(--line-2);font-size:12.5px}
.kp-act:last-child{border-bottom:0}
.kp-icon-btn{border:1px solid var(--line);background:#fff;border-radius:7px;padding:3px 8px;font:inherit;font-size:12px;font-weight:700;color:var(--ink-2);cursor:pointer}
.kp-icon-btn:disabled{opacity:.4;cursor:default}
/* board */
.kp-board{display:grid;grid-template-columns:repeat(4,minmax(220px,1fr));gap:12px;overflow-x:auto}
.kp-col{background:#f3f6fa;border-radius:14px;padding:10px;min-height:120px}
.kp-col h4{margin:2px 4px 10px;font-size:12px;text-transform:uppercase;letter-spacing:.4px;display:flex;gap:6px;align-items:center}
.kp-tcard{background:#fff;border:1px solid var(--line);border-radius:10px;padding:10px 11px;margin-bottom:8px;font-size:12.5px;box-shadow:var(--shadow)}
.kp-tcard .meta{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:8px;font-size:11px;color:var(--muted)}
/* report sheets — an A4 landscape page in the deck's style (petal, logo, footer band) */
.kp-doc{display:flex;flex-direction:column;align-items:center;gap:18px;padding:4px 0 10px}
.kp-sheet{width:1123px;min-height:794px;background:#fff;position:relative;box-shadow:0 6px 26px rgba(9,22,36,.14);padding:34px 44px 46px 52px;overflow:hidden;flex:none;color:#16202e}
.kp-sheet:before{content:'';position:absolute;left:-120px;top:120px;width:240px;height:420px;border-radius:0 60% 60% 0;background:#eef6fb;opacity:.9;z-index:0}
.kp-sheet:after{content:'';position:absolute;left:0;right:0;bottom:0;height:16px;background:linear-gradient(90deg,#c0e2f2 79%,#cbe9e3 79%)}
.kp-sheet>*{position:relative;z-index:1}
.kp-sh-head{display:flex;align-items:flex-start;gap:20px;margin-bottom:16px}
.kp-sh-head .k{font-size:11px;font-weight:800;letter-spacing:1.6px;text-transform:uppercase;color:#008FCB}
.kp-sh-head h2{margin:4px 0 0;font-size:26px;font-weight:800;color:#00293A;letter-spacing:-.3px}
.kp-sh-head .rule{width:70px;height:4px;background:#37B4A6;margin-top:8px;border-radius:2px}
.kp-sh-head img{height:58px;margin-left:auto}
.kp-sh-foot{position:absolute;left:52px;right:44px;bottom:22px;display:flex;justify-content:space-between;font-size:9.5px;color:#7b8796}
.kp-deck{border-collapse:collapse;width:100%;font-size:11.5px}
.kp-deck th{background:#00293A;color:#fff;text-align:left;width:118px;padding:7px 10px;font-size:11.5px;vertical-align:middle;border:1px solid #c9d3de}
.kp-deck td{padding:7px 10px;border:1px solid #c9d3de;vertical-align:top;line-height:1.45}
.kp-deck ul{margin:0;padding-left:16px}.kp-deck li{margin:1px 0}
.kp-stbl{border-collapse:collapse;width:100%;font-size:11.5px}
.kp-stbl th{background:#00293A;color:#fff;padding:7px 8px;font-size:10.5px;text-transform:uppercase;letter-spacing:.3px;border:1px solid #00293A;text-align:center}
.kp-stbl td{padding:6px 8px;border:1px solid #d9e2ec;text-align:center;font-variant-numeric:tabular-nums}
.kp-stbl td.l{text-align:left}
.kp-stbl tr:nth-child(even) td{background:#f4f7fa}
.kp-comment{border:1px dashed #9cc9e0;border-radius:10px;background:#f6fbfe;padding:8px 10px;font-size:12px;line-height:1.45;min-height:46px;white-space:pre-wrap}
.kp-comment textarea{border:0;background:transparent;width:100%;font:inherit;resize:vertical;min-height:44px;outline:0}
.kp-signs{display:grid;grid-template-columns:repeat(4,1fr);gap:28px;margin-top:20px}
.kp-signs div{border-top:1px solid #16202e;padding-top:5px;font-size:12px}
.kp-signs span{display:block;font-size:9.5px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#7b8796;margin-bottom:2px}
.kp-signs input{border:0;border-bottom:1px dashed #b9c6d3;font:inherit;font-size:12.5px;width:100%;background:transparent;padding:2px 0}
.kp-capturing .kp-comment{border-style:solid;border-color:#e3e9f0}
.kp-capturing .kp-signs input{border:0}
/* calculation evidence */
.kp-ev{display:flex;flex-direction:column;gap:10px}
.kp-formula{border:1px solid #b9dcef;background:#eef8fd;border-radius:10px;padding:9px 12px;font-size:12.5px;color:#0b4f6c}
.kp-formula b{color:#00293A}
.kp-steps{margin:0;padding-left:20px;font-size:12.5px;line-height:1.55;color:var(--ink)}
.kp-steps li::marker{color:#008FCB;font-weight:800}
.kp-evtbl{border-collapse:collapse;width:100%;font-size:11.5px}
.kp-evtbl th{background:#00293A;color:#fff;padding:6px 7px;font-size:10px;text-transform:uppercase;letter-spacing:.3px;text-align:left;white-space:nowrap}
.kp-evtbl td{padding:6px 7px;border-bottom:1px solid var(--line-2);vertical-align:top}
.kp-evtbl td.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.kp-evtbl tr.off td{color:#9aa6b4}
.kp-evtbl tr.bad td{background:#fff6f7}
.kp-evtbl small{display:block;color:var(--muted);font-size:10.5px}
.kp-check{display:flex;gap:9px;align-items:flex-start;padding:8px 10px;border-radius:9px;font-size:12px;line-height:1.4}
.kp-check.error{background:#fdf0f2;border:1px solid #f3c2cb;color:#7d1426}
.kp-check.warn{background:#fff8e9;border:1px solid #f0d49a;color:#6b4300}
.kp-check.info{background:#f3f5f8;border:1px solid #e3e9f0;color:#5b6878}
.kp-check .tag{flex:none;font-size:9.5px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;padding:2px 6px;border-radius:5px;background:#fff}
.kp-check .fix{display:block;margin-top:3px;opacity:.85;font-size:11.5px}
.kp-check .ack{display:block;margin-top:4px;color:#14713f;font-weight:600}
.kp-cellmark{position:absolute;top:3px;right:3px;width:0;height:0;border-style:solid;border-width:0 9px 9px 0}
.kp-cellmark.error{border-color:transparent #d23a52 transparent transparent}
.kp-cellmark.warn{border-color:transparent #e0a21e transparent transparent}
.kp-switch{display:inline-flex;align-items:center;gap:8px;cursor:pointer;font-size:12.5px;font-weight:700;user-select:none}
.kp-switch i{position:relative;width:34px;height:19px;border-radius:99px;background:rgba(255,255,255,.25);transition:background .15s;flex:none}
.kp-switch i:after{content:'';position:absolute;top:2px;left:2px;width:15px;height:15px;border-radius:50%;background:#fff;transition:left .15s}
.kp-switch.on i{background:#37B4A6}.kp-switch.on i:after{left:17px}
.kp-switch.light i{background:#cfd8e3}.kp-switch.light.on i{background:#1f9d57}
@media (max-width:1180px){.kp-doc{align-items:flex-start}}
@media (max-width:720px){.kp-hero{padding:14px}.kp-hero h1{font-size:18px}.kp-board{grid-template-columns:repeat(4,240px)}}
`;
  function useStyles() {
    useEffect(() => {
      if (document.getElementById('kp-css')) return;
      const s = document.createElement('style'); s.id = 'kp-css'; s.textContent = CSS; document.head.appendChild(s);
    }, []);
  }

  /* ============================================================== small parts === */
  const ST = K.STATUS;
  // color = chip text, dot = the grid's marker (one clearly different hue per source).
  const SRC = {
    'hh-audit': { label: 'HH audit', color: '#0d5e55', dot: '#2bb3a3', bg: '#dff5f1', long: 'From the hospital hand hygiene audit' },
    'doc-audit': { label: 'Doc. audit', color: '#1f4f8a', dot: '#4a7fd0', bg: '#e6eefb', long: 'From the Nursing Documentation Audit (Σ Yes ÷ Σ Yes + No over every completed audit)' },
    pooled: { label: 'Quality', color: '#0b4f6c', dot: '#0090ca', bg: '#e1f1fa', long: 'From the quality data — all units pooled' },
    hospital: { label: 'Quality', color: '#0b4f6c', dot: '#0090ca', bg: '#e1f1fa', long: 'From the Overall Hospital quality data' },
    edited: { label: 'Edited', color: '#8a5a00', dot: '#e08a1e', bg: '#fff1d6', long: 'The system figure, changed by a KPI manager' },
    manual: { label: 'Entered', color: '#4b3fb0', dot: '#7a5ae0', bg: '#efebfd', long: 'Entered by a KPI manager' },
    partial: { label: 'Den. missing', color: '#8a5a00', dot: '#d9902b', bg: '#fff1d6', long: 'Events reported but no denominator (device days / patient-days not entered)' },
    missing: { label: '', color: '#a3172f', dot: '#d23a52', bg: 'transparent', long: 'No figure yet' },
    'not-started': { label: 'Not started', color: '#7b8796', dot: '#c3cad3', bg: '#f3f5f8', long: 'Before this KPI’s start month — not counted' },
  };
  const srcOf = (s) => SRC[s] || SRC.pooled;
  const Pill = ({ s, small }) => <span className="kp-pill" style={{ background: ST[s].bg, color: ST[s].ink, fontSize: small ? 10.5 : 11 }}><i style={{ background: ST[s].color }} />{ST[s].label}</span>;
  const Src = ({ s }) => (srcOf(s).label ? <span className="kp-src" style={{ background: srcOf(s).bg, color: srcOf(s).color }} title={srcOf(s).long}>{srcOf(s).label}</span> : null);
  const Code = ({ r, cfg }) => <span className="kp-code" style={{ background: K.pillarOf(cfg, r.pillar).color }}>{r.code || '•'}</span>;
  const TREND = { improving: ['▲ Improving', '#1f9d57'], worsening: ['▼ Worsening', '#d23a52'], steady: ['● Steady', '#7b8796'] };
  const Trend = ({ d }) => (d ? <span className="kp-trend" style={{ color: TREND[d][1] }}>{TREND[d][0]}</span> : <span className="kp-muted">—</span>);
  const Btn = ({ children, pri, onClick, disabled, title, danger }) => <button className={'btn sm' + (pri ? ' pri' : '')} onClick={onClick} disabled={disabled} title={title} style={danger ? { color: '#a3172f', borderColor: '#f0b9c3' } : undefined}>{children}</button>;
  const shade = (hex, p) => { const n = parseInt(String(hex).slice(1), 16); const c = (x) => Math.max(0, Math.min(255, x + p)); return '#' + ((c(n >> 16) << 16) | (c((n >> 8) & 255) << 8) | c(n & 255)).toString(16).padStart(6, '0'); };

  function useMounted(flat) {
    const [m, setM] = useState(!!flat);
    useEffect(() => { if (flat) return; const t = setTimeout(() => setM(true), 40); return () => clearTimeout(t); }, [flat]);
    return m;
  }

  /* An isometric 3D column chart with one colour per bar and an optional reference line
     (100 = on target). items: [{label, value, color, title}] */
  function Iso3D({ items, height, max, refLine, refLabel, onPick, flat, unit }) {
    const m = useMounted(flat);
    const [hi, setHi] = useState(-1);
    const H = height || 270;
    const n = Math.max(items.length, 1);
    const step = Math.max(38, Math.min(74, 760 / n)), bw = Math.min(30, step - 14), dx = 12, dy = -8;
    const base = H - 36, top = 30;
    const mx = max || Math.max(1, ...items.map((i) => i.value || 0), refLine || 0);
    const yOf = (v) => base - (Math.max(0, v) / mx) * (base - top);
    const W = 46 + n * step + dx + 6;
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(mx * f));
    return (
      <svg viewBox={'0 0 ' + W + ' ' + H} width="100%" height={H} preserveAspectRatio="xMidYMid meet" style={{ overflow: 'visible', display: 'block' }}>
        {ticks.map((t, i) => <g key={i}><line x1={40} x2={40 + n * step} y1={yOf(t)} y2={yOf(t)} stroke="#e9eef4" /><line x1={40 + n * step} x2={40 + n * step + dx} y1={yOf(t)} y2={yOf(t) + dy} stroke="#eef2f6" />
          <text x={34} y={yOf(t) + 3} textAnchor="end" fontSize="9.5" fill="#9aa6b4">{t}{unit || ''}</text></g>)}
        {items.map((d, i) => {
          const v = d.value || 0, x = 46 + i * step, y = v > 0 ? yOf(v) : base - 2, h = base - y, c = d.color || '#008FCB', on = hi === i;
          return (
            <g key={i} style={{ cursor: onPick ? 'pointer' : 'default', opacity: hi < 0 || on ? 1 : 0.6, transition: 'opacity .15s' }}
              onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(-1)} onClick={() => onPick && onPick(d, i)}>
              <title>{d.title || (d.label + ': ' + v)}</title>
              <g style={{ transformOrigin: (x + bw / 2) + 'px ' + base + 'px', transform: 'scaleY(' + (m ? 1 : 0.001) + ')', transition: flat ? 'none' : 'transform .8s ' + (i * 45) + 'ms cubic-bezier(.2,.85,.3,1)' }}>
                <polygon points={(x + bw) + ',' + y + ' ' + (x + bw + dx) + ',' + (y + dy) + ' ' + (x + bw + dx) + ',' + (base + dy) + ' ' + (x + bw) + ',' + base} fill={shade(c, -48)} />
                <polygon points={x + ',' + y + ' ' + (x + dx) + ',' + (y + dy) + ' ' + (x + bw + dx) + ',' + (y + dy) + ' ' + (x + bw) + ',' + y} fill={shade(c, 50)} />
                <rect x={x} y={y} width={bw} height={Math.max(h, 0)} fill={c} />
                <rect x={x} y={y} width={bw * 0.32} height={Math.max(h, 0)} fill="#fff" opacity=".14" />
              </g>
              {m && <text x={x + bw / 2 + dx / 2} y={y + dy - 5} textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#16202e">{d.valueLabel != null ? d.valueLabel : v}</text>}
              <text x={x + bw / 2} y={H - 18} textAnchor="middle" fontSize="10" fontWeight="700" fill="#5b6878">{String(d.label).slice(0, 8)}</text>
            </g>
          );
        })}
        {refLine != null && <g><line x1={40} x2={40 + n * step + dx} y1={yOf(refLine)} y2={yOf(refLine)} stroke="#00293A" strokeDasharray="5 4" strokeWidth="1.3" />
          <text x={40 + n * step + dx} y={yOf(refLine) - 5} textAnchor="end" fontSize="10" fontWeight="700" fill="#00293A">{refLabel || 'Target'}</text></g>}
      </svg>
    );
  }
  /* Stacked isometric columns — KPIs by status in each pillar. groups: [{label, parts:[{value,color,label}]}] */
  function Iso3DStack({ groups, height, flat, onPick }) {
    const m = useMounted(flat);
    const H = height || 260, n = Math.max(groups.length, 1);
    const step = Math.max(90, Math.min(150, 620 / n)), bw = Math.min(56, step - 34), dx = 16, dy = -11, base = H - 40, top = 26;
    const mx = Math.max(1, ...groups.map((g) => g.parts.reduce((a, p) => a + p.value, 0)));
    const unit = (base - top) / mx;
    const W = 30 + n * step + dx;
    return (
      <svg viewBox={'0 0 ' + W + ' ' + H} width="100%" height={H} style={{ overflow: 'visible', display: 'block' }}>
        {Array.from({ length: mx + 1 }, (_, t) => <g key={t}><line x1={24} x2={24 + n * step} y1={base - t * unit} y2={base - t * unit} stroke="#eef2f6" /><text x={18} y={base - t * unit + 3} textAnchor="end" fontSize="9.5" fill="#9aa6b4">{t}</text></g>)}
        {groups.map((g, i) => {
          const x = 34 + i * step + (step - bw) / 2;
          let y = base;
          const total = g.parts.reduce((a, p) => a + p.value, 0);
          return (
            <g key={i} style={{ cursor: onPick ? 'pointer' : 'default' }} onClick={() => onPick && onPick(g, i)}>
              <title>{g.label + ': ' + g.parts.filter((p) => p.value).map((p) => p.value + ' ' + p.label).join(', ')}</title>
              <g style={{ transformOrigin: (x + bw / 2) + 'px ' + base + 'px', transform: 'scaleY(' + (m ? 1 : 0.001) + ')', transition: flat ? 'none' : 'transform .9s ' + (i * 90) + 'ms cubic-bezier(.2,.85,.3,1)' }}>
                {g.parts.filter((p) => p.value > 0).map((p, j, arr) => {
                  const h = p.value * unit, yy = y - h; y = yy;
                  const last = j === arr.length - 1;
                  return <g key={j}>
                    <polygon points={(x + bw) + ',' + yy + ' ' + (x + bw + dx) + ',' + (yy + dy) + ' ' + (x + bw + dx) + ',' + (yy + h + dy) + ' ' + (x + bw) + ',' + (yy + h)} fill={shade(p.color, -48)} />
                    <rect x={x} y={yy} width={bw} height={h} fill={p.color} stroke="#fff" strokeWidth=".6" />
                    {last && <polygon points={x + ',' + yy + ' ' + (x + dx) + ',' + (yy + dy) + ' ' + (x + bw + dx) + ',' + (yy + dy) + ' ' + (x + bw) + ',' + yy} fill={shade(p.color, 50)} />}
                    {h > 15 && <text x={x + bw / 2} y={yy + h / 2 + 4} textAnchor="middle" fontSize="11" fontWeight="800" fill="#fff">{p.value}</text>}
                  </g>;
                })}
              </g>
              {m && <text x={x + bw / 2 + dx / 2} y={base - total * unit + dy - 6} textAnchor="middle" fontSize="11" fontWeight="800" fill="#16202e">{total}</text>}
              <text x={x + bw / 2} y={H - 20} textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#5b6878">{g.label.length > 20 ? g.label.slice(0, 19) + '…' : g.label}</text>
            </g>
          );
        })}
      </svg>
    );
  }
  // The KPI score — share of scored KPIs on target — as a ring with the number inside, on a dark tile.
  function ScoreRing({ score, size, flat }) {
    const m = useMounted(flat);
    const S = size || 96, r = S / 2 - 8, C = 2 * Math.PI * r, v = score == null ? 0 : Math.max(0, Math.min(100, score));
    const col = score == null ? '#a3adba' : v >= 75 ? '#7fe0d4' : v >= 50 ? '#ffd27a' : '#ff9aab';
    return (
      <svg width={S} height={S} viewBox={'0 0 ' + S + ' ' + S} style={{ flex: 'none', display: 'block' }}>
        <circle cx={S / 2} cy={S / 2} r={r} fill="none" stroke="rgba(255,255,255,.16)" strokeWidth="9" />
        <circle cx={S / 2} cy={S / 2} r={r} fill="none" stroke={col} strokeWidth="9" strokeLinecap="round" strokeDasharray={C}
          strokeDashoffset={m ? C * (1 - v / 100) : C} transform={'rotate(-90 ' + S / 2 + ' ' + S / 2 + ')'} style={{ transition: flat ? 'none' : 'stroke-dashoffset 1.1s cubic-bezier(.3,.8,.3,1)' }} />
        <text x={S / 2} y={S / 2 + 2} textAnchor="middle" fontSize={S * 0.27} fontWeight="800" fill="#fff">{score == null ? '—' : v + '%'}</text>
        <text x={S / 2} y={S / 2 + S * 0.2} textAnchor="middle" fontSize={S * 0.1} fill="rgba(255,255,255,.75)">on target</text>
      </svg>
    );
  }
  // A small 12-month sparkline with the target as a dashed line; nulls are gaps.
  function Spark({ row, w, h }) {
    const W = w || 120, Hh = h || 30;
    const pts = (row.trend || []);
    const vals = pts.map((p) => p.v).filter((v) => v != null);
    if (vals.length < 1) return <span className="kp-muted" style={{ fontSize: 11 }}>no data</span>;
    const tv = row.target;
    const mx = Math.max(...vals, tv != null ? tv : -Infinity), mn = Math.min(...vals, tv != null ? tv : Infinity, 0);
    const sx = (i) => 2 + (i / Math.max(pts.length - 1, 1)) * (W - 4), sy = (v) => Hh - 3 - ((v - mn) / ((mx - mn) || 1)) * (Hh - 6);
    let d = '', pen = false;
    pts.forEach((p, i) => { if (p.v == null) { pen = false; return; } d += (pen ? 'L' : 'M') + sx(i).toFixed(1) + ' ' + sy(p.v).toFixed(1) + ' '; pen = true; });
    const last = pts.map((p, i) => [p, i]).filter(([p]) => p.v != null).pop();
    const col = ST[row.status].color;
    return (
      <svg width={W} height={Hh} style={{ display: 'block' }}>
        {tv != null && <line x1="0" x2={W} y1={sy(tv)} y2={sy(tv)} stroke="#37B4A6" strokeDasharray="3 3" />}
        <path d={d} fill="none" stroke={col} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
        {last && <circle cx={sx(last[1])} cy={sy(last[0].v)} r="2.8" fill={col} />}
      </svg>
    );
  }

  /* ============================================================ period picker === */
  /* `yearCap`: how far a running year reaches — the last closed month on the Dashboard and in
     Reports ("2026 so far"); all twelve months in Data Update (future months show greyed out). */
  function usePeriod(meta, key, def, yearCap) {
    const [p, setP] = useState(() => lsGet('kpi_period_' + key) || { preset: def || '6m' });
    useEffect(() => { lsSet('kpi_period_' + key, p); }, [p, key]);
    const range = useMemo(() => {
      if (!meta) return null;
      if (p.preset === 'custom' && K.isMonth(p.from) && K.isMonth(p.to) && p.from <= p.to) return { from: p.from, to: K.monthDiff(p.from, p.to) >= K.MAX_MONTHS ? K.addMonth(p.from, K.MAX_MONTHS - 1) : p.to };
      if (p.preset === 'year') return K.yearRange(p.year || meta.lastClosed.slice(0, 4), yearCap === 'all' ? null : meta.lastClosed);
      return K.presetRange(p.preset === 'custom' ? '6m' : p.preset, K.isMonth(p.end) ? p.end : meta.lastClosed, meta.config);
    }, [p, meta, yearCap]);
    return [p, setP, range];
  }
  // Years to choose from: from the year before the programme started up to this year.
  const yearsOf = (meta) => { const last = +meta.thisMonth.slice(0, 4), first = Math.min(+meta.config.cycleStart.slice(0, 4) - 1, last - 2); const out = []; for (let y = last; y >= first; y--) out.push(y); return out; };
  function PeriodPicker({ meta, p, setP, range, presets, maxMonth }) {
    const list = K.PRESETS.filter((x) => !presets || presets.indexOf(x.id) >= 0);
    const top = maxMonth || meta.thisMonth;
    const isN = !K.PRESETS.find((x) => x.id === p.preset && x.cycle) && p.preset !== 'custom' && p.preset !== 'year';
    return (
      <div className="kp-chips" style={{ alignItems: 'center' }}>
        {list.map((x) => {
          const r = x.cycle ? K.cycleRange(x.cycle, meta.config) : null;
          return <button key={x.id} className={'kp-chip' + (p.preset === x.id ? ' on' : '')} title={r ? K.fmtRange(r.from, r.to) : x.id === 'year' ? 'A calendar year, January to December' : ''}
            onClick={() => setP(Object.assign({}, p, { preset: x.id }, x.id === 'custom' && !p.from ? { from: range.from, to: range.to } : {}, x.id === 'year' && !p.year ? { year: +meta.lastClosed.slice(0, 4) } : {}))}>{x.label}</button>;
        })}
        {p.preset === 'year' && <select className="kp-sel" value={p.year || +meta.lastClosed.slice(0, 4)} onChange={(e) => setP(Object.assign({}, p, { year: +e.target.value }))} aria-label="Year">
          {yearsOf(meta).map((y) => <option key={y} value={y}>{y}</option>)}</select>}
        {p.preset === 'year' && range && range.partial && <span className="kp-muted" style={{ fontSize: 11.5 }}>so far — the year is not over</span>}
        {isN && <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center', fontSize: 12, color: 'var(--muted)' }}>ending
          <input type="month" className="kp-sel" value={K.isMonth(p.end) ? p.end : meta.lastClosed} max={top} onChange={(e) => K.isMonth(e.target.value) && setP(Object.assign({}, p, { end: e.target.value }))} /></span>}
        {p.preset === 'custom' && <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center', fontSize: 12, color: 'var(--muted)' }}>
          <input type="month" className="kp-sel" value={p.from || range.from} max={top} onChange={(e) => K.isMonth(e.target.value) && setP(Object.assign({}, p, { from: e.target.value }))} />to
          <input type="month" className="kp-sel" value={p.to || range.to} max={top} onChange={(e) => K.isMonth(e.target.value) && setP(Object.assign({}, p, { to: e.target.value }))} /></span>}
        {range && <span className="kp-muted" style={{ fontWeight: 700, color: 'var(--ink-2)' }}>{K.fmtRange(range.from, range.to)}</span>}
      </div>
    );
  }

  /* ============================================================== KPI drawer === */
  const CHARTS = [['area', 'Area'], ['line', 'Line'], ['bar', 'Bars'], ['3d', '3D']];
  function KpiChart({ row, kind, height, flat }) {
    const data = (row.trend || []).filter((t) => t.v != null).map((t) => ({ mon: K.fmtMonth(t.m).replace(' 20', ' '), val: t.v }));
    if (!data.length) return <div className="kp-empty">No monthly figures yet for this KPI.</div>;
    const color = K.pillarOf(null, row.pillar).color === '#00293A' ? '#008FCB' : K.pillarOf(null, row.pillar).color;
    const W = window;
    if (kind === 'line' && W.LineChart) return <W.LineChart data={data} x="mon" y="val" height={height || 230} color={color} flat={flat} />;
    if (kind === 'bar' && W.BarChart) return <W.BarChart data={data} x="mon" y="val" height={height || 230} color={color} flat={flat} />;
    if (kind === '3d') return <Iso3D items={data.map((d) => ({ label: d.mon, value: d.val, color: row.target != null && K.statusOf(row, d.val, row.target) !== 'met' ? '#d23a52' : '#1f9d57', valueLabel: K.fmt(row, d.val, { bare: true }) }))} refLine={row.target} height={height || 240} flat={flat} />;
    if (W.AreaTargetChart) return <W.AreaTargetChart data={data} x="mon" y="val" target={row.target} height={height || 230} color={color} flat={flat} />;
    return null;
  }
  /* ===================================================== calculation evidence === */
  const EV_SRC = {
    approved: ['Approved', '#14713f', '#e7f6ed'], 'overlay-edit': ['Console edit', '#8a5a00', '#fff1d6'], audit: ['Audit', '#0d5e55', '#dff5f1'],
    own: ['Own reading', '#0b4f6c', '#e1f1fa'], covered: ['Covered by audit', '#5b6878', '#eef2f6'], 'not-audited': ['Not audited', '#a3172f', '#fde4e8'],
    'not-observed': ['Not observed', '#5b6878', '#eef2f6'], missing: ['Missing', '#a3172f', '#fde4e8'], partial: ['No denominator', '#a3172f', '#fde4e8'],
    'den-zero': ['Denominator 0', '#a3172f', '#fde4e8'], 'carried-den': ['Headcount carried', '#8a5a00', '#fff1d6'], manual: ['Entered', '#4b3fb0', '#efebfd'],
    'doc-audit': ['Audits', '#1f4f8a', '#e6eefb'],
  };
  const EvSrc = ({ s }) => { const x = EV_SRC[s] || [s, '#5b6878', '#eef2f6']; return <span className="kp-src" style={{ color: x[1], background: x[2] }}>{x[0]}</span>; };
  const dayOf = (t) => (t ? new Date(t).toLocaleDateString('en-GB', { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'short', year: 'numeric' }) : '');
  /* How one KPI's month was calculated — formula, the steps in words, every unit with who sent
     and approved its figure, Device Days, a hand-typed override, and the data checks. The same
     component draws the drawer tab, the entry dialog section and the report's calculation page. */
  function EvidenceView({ def, ev, steps, acks, compact }) {
    if (!ev) return null;
    const st = steps || K.evidenceSteps(def, ev);
    const ackOf = (c) => (acks || []).find((a) => a.key === [ev.kpiId, ev.ym, c.code, c.unit || ''].join('|') && !a.revokedAt);
    const units = ev.units || [];
    const nl = def.numLabel || 'Numerator', dl = def.denLabel || 'Denominator';
    return (
      <div className="kp-ev">
        {!ev.started && <div className="kp-banner info">This KPI starts in {K.fmtMonthLong(ev.startMonth)}. {K.fmtMonthLong(ev.ym)} is before that, so it is not counted and nothing is owed.</div>}
        <div className="kp-formula"><b>Formula:</b> {def.formulaText || K.FORMULA_LABEL[def.formula] || '—'}{!ev.autoFill && ev.linked ? <span> · <b>Auto-fill is off</b> — the system figure is shown for reference only.</span> : null}
          {def.formula !== 'direct' && <div style={{ fontSize: 11.5, marginTop: 3 }}><b>Num.</b> = {nl}{def.formula !== 'count' ? <> · <b>Den.</b> = {dl}</> : null}</div>}</div>
        {st.length > 0 && <ol className="kp-steps">{st.map((s, i) => <li key={i}>{s}</li>)}</ol>}
        {ev.sourceRecord && (
          <div className="kp-sys" style={{ background: '#f6fbfe', borderColor: '#b9dcef', color: '#0b4f6c' }}>
            <b>{ev.sourceRecord.name}</b>
            <span>{K.has(ev.sourceRecord.num) ? ev.sourceRecord.num + ' ÷ ' + ev.sourceRecord.den + ' = ' + K.fmt(def, ev.sourceRecord.value) : '—'}</span>
            <span>{ev.sourceRecord.submission ? 'sent by ' + (ev.sourceRecord.submission.by || '—') + ' · approved by ' + (ev.sourceRecord.submission.reviewedBy || '—') + ' on ' + dayOf(ev.sourceRecord.submission.reviewedAt) : ev.sourceRecord.overlayEdited ? 'edited in the Quality console by ' + (ev.sourceRecord.overlayEdited.by || 'someone (not recorded)') : 'approval not traced'}</span>
          </div>
        )}
        {ev.override && (
          <div className="kp-sys" style={{ background: '#fff8e9', borderColor: '#f0d49a', color: '#6b4300' }}>
            <b>{ev.linked ? 'Typed over the system figure' : 'Entered'} by {ev.override.by || '—'}</b><span>{dayOf(ev.override.at)}</span>
            {ev.override.autoValue != null && <span>system figure was {K.fmt(def, ev.override.autoValue)}</span>}
            <span style={{ fontStyle: 'italic' }}>{ev.override.note ? '“' + ev.override.note + '”' : 'no reason given'}</span>
            {ev.override.confirmed && <span>· unusual figure confirmed</span>}
          </div>
        )}
        {units.length > 0 && (
          <div className="kp-scroll"><table className="kp-evtbl">
            <thead><tr><th>Unit</th><th style={{ textAlign: 'right' }} title={nl}>Num.</th>{def.formula !== 'count' && def.formula !== 'direct' && <th style={{ textAlign: 'right' }} title={dl}>Den.</th>}<th style={{ textAlign: 'right' }}>Value</th><th>Source</th><th>Sent · approved</th>{!compact && <th>Device Days</th>}</tr></thead>
            <tbody>{units.map((u) => {
              const bad = (ev.checks || []).some((c) => c.unit === u.key && c.level === 'error');
              const s = u.submission;
              return (
                <tr key={u.key} className={bad ? 'bad' : u.used ? '' : 'off'}>
                  <td><b style={{ color: bad ? '#a3172f' : 'var(--ink)' }}>{u.name}</b>{u.expected ? <small>expected to report</small> : !u.used ? <small>not counted</small> : null}</td>
                  <td className="n">{K.has(u.num) ? u.num : '—'}</td>
                  {def.formula !== 'count' && def.formula !== 'direct' && <td className="n">{K.has(u.den) ? u.den : '—'}{u.carriedFrom ? <small>from {u.carriedFrom}</small> : null}</td>}
                  <td className="n"><b>{K.has(u.value) ? K.fmt(def, u.value) : '—'}</b></td>
                  <td><EvSrc s={u.source} /></td>
                  <td style={{ fontSize: 11 }}>{s ? <>{s.by || '—'}{s.at ? ' · ' + dayOf(s.at) : ''}<small>approved by {s.reviewedBy || '—'}{s.reviewedAt ? ' · ' + dayOf(s.reviewedAt) : ''}{s.correction ? ' · correction' : ''}</small></>
                    : u.overlayEdited ? <>Quality console<small>edited by {u.overlayEdited.by || 'not recorded'}{u.overlayEdited.at ? ' · ' + dayOf(u.overlayEdited.at) : ''}</small></>
                    : u.entered ? <>{u.entered.by || '—'}<small>{dayOf(u.entered.at)}</small></>
                    : u.pending && u.pending.length ? <span style={{ color: '#8a5a00' }}>waiting for approval<small>sent by {u.pending[0].by || '—'}</small></span>
                    : u.used ? <span className="kp-muted">approved · submission not traced</span> : '—'}</td>
                  {!compact && <td style={{ fontSize: 11 }}>{u.deviceDays ? <>{u.deviceDays.approved} {u.deviceDays.field === 'total' ? 'patient' : u.deviceDays.field} days<small>{u.deviceDays.days} day(s) approved{u.deviceDays.missing || u.deviceDays.waiting ? ' · ' + (u.deviceDays.missing ? u.deviceDays.missing + ' missed' : '') + (u.deviceDays.missing && u.deviceDays.waiting ? ', ' : '') + (u.deviceDays.waiting ? u.deviceDays.waiting + ' waiting' : '') : ''}</small></> : '—'}</td>}
                </tr>
              );
            })}</tbody>
            {units.filter((u) => u.used).length > 1 && <tfoot><tr><td><b>Total used</b></td><td className="n"><b>{K.has(ev.totals.num) ? ev.totals.num : '—'}</b></td>{def.formula !== 'count' && def.formula !== 'direct' && <td className="n"><b>{K.has(ev.totals.den) ? ev.totals.den : '—'}</b></td>}<td className="n"><b>{K.fmt(def, ev.totals.value)}</b></td><td colSpan={compact ? 2 : 3} /></tr></tfoot>}
          </table></div>
        )}
        {(ev.checks || []).length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {ev.checks.map((c, i) => { const a = ackOf(c); const meta = K.CHECK_META[c.code] || {}; return (
              <div key={i} className={'kp-check ' + c.level}>
                <span className="tag">{c.level === 'error' ? 'Error' : c.level === 'warn' ? 'Warning' : 'Note'}</span>
                <div style={{ flex: 1 }}><b>{meta.title || c.code}</b> — {c.text}
                  {!compact && meta.fix && <span className="fix">{meta.fix}</span>}
                  {a && <span className="ack">{a.fingerprint === c.fingerprint ? '✔ Acknowledged by ' + (a.byName || a.by) + ': “' + a.reason + '”' : '✖ An acknowledgement was given for older data — it needs a new one.'}</span>}</div>
              </div>); })}
          </div>
        ) : ev.started ? <div className="kp-banner ok" style={{ padding: '7px 12px' }}>✓ Every check passed for this month.</div> : null}
      </div>
    );
  }
  // Loads the evidence for one KPI-month and shows it.
  function EvidencePanel({ def, kpiId, ym, compact }) {
    const [j, setJ] = useState(null);
    const [err, setErr] = useState('');
    useEffect(() => {
      let live = true; setJ(null); setErr('');
      api('/api/kpi/evidence/' + encodeURIComponent(kpiId) + '/' + ym).then((x) => { if (live) setJ(x); }).catch((e) => live && setErr(e.message));
      return () => { live = false; };
    }, [kpiId, ym]);
    if (err) return <div className="kp-banner">{err}</div>;
    if (!j) return <div className="kp-muted">Working out how {K.fmtMonthLong(ym)} was calculated…</div>;
    return <EvidenceView def={def} ev={j.evidence} steps={j.steps} compact={compact} />;
  }

  // A KPI measured every N months: which period its figure is ("Jan–Jun 2026", or "latest: …").
  const resultOf = (r) => (r.latest ? 'latest: ' + r.latest.label : r.freqMonths > 1 && r.resultLabel ? r.resultLabel : '');
  const ResultTag = ({ r }) => (resultOf(r) ? <div className="kp-muted" style={{ fontSize: 10.5, whiteSpace: 'nowrap' }}>{resultOf(r)}{r.nextDue && r.latest ? ' · next ' + K.fmtMonth(r.nextDue) : ''}</div> : null);
  // The periods of a less-often KPI, as a small table (screen and report).
  function PeriodsTable({ row }) {
    const list = row.periods || [];
    if (!list.length) return <div className="kp-muted">{K.freqLabel(row)} — no period has ended yet{row.nextDue ? '; the first result is due in ' + K.fmtMonthLong(row.nextDue) : ''}.</div>;
    return (
      <div className="kp-scroll"><table className="kp-stbl"><thead><tr><th>Period</th>{row.formula !== 'direct' && <th>{row.numLabel || 'Numerator'}</th>}{row.formula !== 'direct' && row.formula !== 'count' && <th>{row.denLabel || 'Denominator'}</th>}<th>Value</th><th>Target</th><th>Status</th></tr></thead>
        <tbody>{list.map((pp) => <tr key={pp.to}><td className="l"><b>{pp.label}</b>{!pp.inReport ? <span className="kp-muted"> · before this report</span> : null}</td>
          {row.formula !== 'direct' && <td>{K.has(pp.num) ? pp.num : '—'}</td>}{row.formula !== 'direct' && row.formula !== 'count' && <td>{K.has(pp.den) ? pp.den : '—'}</td>}
          <td><b>{K.fmt(row, pp.value)}</b></td><td>{K.has(pp.target) ? K.fmt(row, pp.target) : '—'}</td><td><Pill s={pp.status} /></td></tr>)}</tbody></table></div>
    );
  }

  function KpiDrawer({ row, cfg, onClose, setRoute, canEnter, showCalc }) {
    const [tab, setTab] = useState(showCalc ? 'calc' : 'overview');
    // the months that carry a figure (a less-often KPI: its due months only)
    const monthsAll = Object.keys(row.cells || {}).filter((m) => (row.cells[m] || {}).source !== 'not-due');
    const [calcMonth, setCalcMonth] = useState(monthsAll[monthsAll.length - 1]);
    const [kind, setKind] = useState(() => lsGet('kpi_chart') || 'area');
    useEffect(() => { lsSet('kpi_chart', kind); }, [kind]);
    useEffect(() => { const k = (e) => { if (e.key === 'Escape') onClose(); }; document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k); }, [onClose]);
    const p = K.pillarOf(cfg, row.pillar);
    const months = Object.keys(row.cells || {});
    return (
      <div className="kp-back" style={{ justifyContent: 'flex-end', padding: 0 }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <div className="kp-drawer" role="dialog" aria-label={row.name}>
          <div style={{ background: 'linear-gradient(125deg,#00293A,' + (p.color === '#00293A' ? '#0c6f7d' : p.color) + ')', color: '#fff', padding: '16px 20px' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span className="kp-code" style={{ background: 'rgba(255,255,255,.2)' }}>{row.code || '•'}</span>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', opacity: 0.85 }}>{p.label}</span>
              <button className="kp-x" style={{ color: '#fff' }} onClick={onClose} aria-label="Close">×</button>
            </div>
            <h3 style={{ margin: '8px 0 2px', fontSize: 19 }}>{row.name}</h3>
            <div style={{ fontSize: 12, opacity: 0.85 }}>{row.objective}</div>
          </div>
          <div className="kp-tabs">{[['overview', 'Overview'], ['calc', 'How it is calculated']].map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
          {tab === 'calc' && (
            <div className="kp-dlg-b" style={{ gap: 12 }}>
              {monthsAll.length ? <><div className="kp-chips">{monthsAll.map((m) => <button key={m} className={'kp-chip' + (calcMonth === m ? ' on' : '')} onClick={() => setCalcMonth(m)}>{row.freqMonths > 1 ? K.periodOf(row, m, cfg).label : K.fmtMonth(m)}</button>)}</div>
                <EvidencePanel def={row} kpiId={row.kpiId} ym={calcMonth || monthsAll[monthsAll.length - 1]} /></>
                : <div className="kp-muted">{K.freqLabel(row)} — no period ends inside this report{row.latest ? '; the result shown is ' + row.latest.label + ' (open a report that includes ' + K.fmtMonth(row.latest.to) + ' to see its calculation)' : ''}.</div>}
            </div>
          )}
          {tab === 'overview' && <div className="kp-dlg-b" style={{ gap: 14 }}>
            <div className="kp-row" style={{ alignItems: 'stretch' }}>
              {[['Current', K.fmt(row, row.period.value), resultOf(row) || (row.unit && K.unitKind(row) === 'num' ? row.unit : (months.length > 1 ? months.length + ' months pooled' : K.fmtMonthLong(months[0])))],
                ['Target', row.target != null ? K.fmt(row, row.target) : '—', row.goalDirection === 'lower_is_better' ? 'lower is better' : 'higher is better'],
                ['Variance', K.gapLabel(row, row.period.value, row.target), row.achievement != null ? row.achievement + '% of target' : ''],
              ].map(([l, v, s], i) => (
                <div key={i} className="kp-card kp-pad" style={{ minWidth: 120 }}>
                  <div className="kp-lab">{l}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: i === 2 ? ST[row.status].color : '#00293A' }}>{v}</div>
                  <div className="kp-muted" style={{ fontSize: 11 }}>{s}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><Pill s={row.status} /><Trend d={row.trendDir} />
              {row.linked && <span className="kp-muted">· filled from the hospital's quality data</span>}</div>
            <div className="kp-muted" style={{ fontSize: 11.5 }}><b style={{ color: 'var(--ink-2)' }}>Tracking:</b> {row.schedule}{row.nextDue ? ' · next result ' + K.fmtMonthLong(row.nextDue) : ''}</div>
            <div className="kp-card">
              <div className="kp-h"><h3>{row.freqMonths > 1 ? 'Last 12 months · one point per period' : 'Last 12 months'}</h3><span className="grow" />
                <div className="kp-chips">{CHARTS.map(([k, l]) => <button key={k} className={'kp-chip' + (kind === k ? ' on' : '')} onClick={() => setKind(k)}>{l}</button>)}</div></div>
              <div className="kp-pad"><KpiChart row={row} kind={kind} /></div>
            </div>
            {row.freqMonths > 1 ? <PeriodsTable row={row} /> : <div className="kp-scroll"><table className="kp-stbl"><thead><tr><th>Month</th>{months.map((m) => <th key={m}>{K.fmtMonth(m)}</th>)}</tr></thead>
              <tbody><tr><td className="l"><b>Value</b></td>{months.map((m) => <td key={m}><b>{K.fmt(row, row.cells[m].value)}</b></td>)}</tr>
                {row.formula !== 'direct' && <tr><td className="l">{row.numLabel || 'Numerator'}</td>{months.map((m) => <td key={m}>{K.has(row.cells[m].num) ? row.cells[m].num : '—'}</td>)}</tr>}
                {row.formula !== 'direct' && row.formula !== 'count' && <tr><td className="l">{row.denLabel || 'Denominator'}</td>{months.map((m) => <td key={m}>{K.has(row.cells[m].den) ? row.cells[m].den : '—'}</td>)}</tr>}
                <tr><td className="l kp-muted">Source</td>{months.map((m) => <td key={m}><Src s={row.cells[m].source} /></td>)}</tr></tbody></table></div>}
            <div><span className="kp-lab">Formula</span><div style={{ fontSize: 12.5, fontStyle: 'italic' }}>{row.formulaText || '—'}</div></div>
            <div><span className="kp-lab">Action plan ({(row.actions || []).length})</span>
              {(row.actions || []).length ? row.actions.map((a) => <div className="kp-act" key={a.id}><span className="kp-pill" style={{ background: a.status === 'done' ? '#e7f6ed' : a.status === 'progress' ? '#e1f1fa' : '#f3f5f8', color: a.status === 'done' ? '#14713f' : a.status === 'progress' ? '#0b4f6c' : '#5b6878', fontSize: 10 }}>{K.ACTION_LABEL[a.status]}</span>
                <span style={{ flex: 1 }}>{a.text}{a.owner ? <span className="kp-muted"> — {a.owner}</span> : null}</span>{a.due && <span className="kp-muted">{K.fmtMonth(a.due)}</span>}</div>) : <div className="kp-muted">No action plan yet.</div>}
            </div>
            {row.remarks && <div><span className="kp-lab">Remarks</span><div style={{ fontSize: 12.5, whiteSpace: 'pre-wrap' }}>{row.remarks}</div></div>}
          </div>}
          <div className="kp-dlg-f">
            {canEnter && <Btn pri onClick={() => { onClose(); setRoute({ view: 'kpiEntry', kpi: row.kpiId }); }}>Enter / edit figures</Btn>}
            <Btn onClick={() => { onClose(); setRoute({ view: 'kpiActions', kpi: row.kpiId }); }}>Action plans</Btn>
            <span style={{ flex: 1 }} /><Btn onClick={onClose}>Close</Btn>
          </div>
        </div>
      </div>
    );
  }

  /* ============================================================== dashboard === */
  function Dashboard({ meta, setRoute, showCalc }) {
    const [p, setP, range] = usePeriod(meta, 'dash', '6m');
    const [rep, setRep] = useState(null);
    const [err, setErr] = useState('');
    const [fPillar, setFPillar] = useState('');
    const [fStatus, setFStatus] = useState('');
    const [open, setOpen] = useState(null);
    const cfg = meta.config;
    useEffect(() => {
      if (!range) return;
      let live = true; setErr('');
      api('/api/kpi/report/' + K.reportId(range.from, range.to)).then((j) => { if (live) setRep(j.report); }).catch((e) => live && setErr(e.message));
      return () => { live = false; };
    }, [range && range.from, range && range.to]);
    const rows = rep ? rep.rows : [];
    const sum = rep ? rep.summary : null;
    const shown = rows.filter((r) => (!fPillar || r.pillar === fPillar) && (!fStatus || (fStatus === 'nodata' ? r.status === 'nodata' || r.status === 'notarget' || r.status === 'notstarted' || r.status === 'notdue' : r.status === fStatus)));
    const pillars = cfg.pillars.filter((x) => rows.some((r) => r.pillar === x.id));
    const scored = shown.filter((r) => r.achievement != null);
    const canEnter = meta.canAdd || meta.canEdit;
    const tiles = [['met', 'On target'], ['near', 'Close to target'], ['off', 'Needs action'], ['nodata', 'No data / no target']];
    return (
      <div className="kp-wrap">
        <div className="kp-card kp-bar"><PeriodPicker meta={meta} p={p} setP={setP} range={range} presets={['1m', '3m', '6m', '12m', 'year', 'cycle1', 'cycle2', 'custom']} />
          {rep && rep.state === 'final' && <span className="kp-pill" style={{ background: '#e7f6ed', color: '#14713f' }}>Showing the final report</span>}</div>
        {err && <div className="kp-banner">{err}</div>}
        {!rep && !err && <div className="kp-card kp-empty">Working out where every KPI stands…</div>}
        {rep && <>
          <div className="kp-tiles kp-rise">
            <div className="kp-tile kp-score" style={{ background: 'linear-gradient(140deg,#00293A,#0c6f7d)', color: '#fff', border: 0, cursor: 'default' }}>
              <ScoreRing score={sum.score} size={92} />
              <div style={{ minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 800 }}>KPI score</div><div style={{ fontSize: 11.5, opacity: 0.8, marginTop: 3, lineHeight: 1.35 }}>{sum.scored ? sum.met + ' of ' + sum.scored + ' KPIs with a target and data are on target' : 'No KPI has both data and a target yet'}</div></div>
            </div>
            {tiles.map(([k, l]) => {
              const n = k === 'nodata' ? sum.nodata + sum.notarget + (sum.notstarted || 0) + (sum.notdue || 0) : sum[k];
              return (
                <div key={k} className={'kp-tile' + (fStatus === k ? ' sel' : '')} onClick={() => setFStatus(fStatus === k ? '' : k)} title="Click to show only these">
                  <span className="ring" style={{ background: ST[k].color }} />
                  <div className="n" style={{ color: ST[k].color }}>{n}</div>
                  <div className="l" style={{ color: ST[k].ink }}>{l}</div>
                  <div className="s">{k === 'met' && sum.improving ? sum.improving + ' improving overall' : k === 'off' && sum.worsening ? sum.worsening + ' worsening overall' : 'of ' + sum.total + ' KPIs'}</div>
                </div>
              );
            })}
          </div>

          <div className="kp-grid3 kp-rise" style={{ animationDelay: '.05s' }}>
            {pillars.map((pl) => {
              const list = rows.filter((r) => r.pillar === pl.id), c = K.summarize(list);
              return (
                <div key={pl.id} className={'kp-pillar' + (fPillar === pl.id ? ' sel' : '')} onClick={() => setFPillar(fPillar === pl.id ? '' : pl.id)}>
                  <div className="top" style={{ background: 'linear-gradient(120deg,' + pl.color + ',' + shade(pl.color, 40) + ')' }}><b>{pl.label}</b><span style={{ fontSize: 22, fontWeight: 800 }}>{list.length}</span></div>
                  <div className="seg">{['met', 'near', 'off', 'notarget', 'nodata', 'notstarted', 'notdue'].map((k) => (c[k] ? <span key={k} style={{ flex: c[k], background: ST[k].color }} /> : null))}</div>
                  <ul>{list.map((r) => <li key={r.kpiId} onClick={(e) => { e.stopPropagation(); setOpen(r); }}><i style={{ background: ST[r.status].color }} /><span>{r.code} {r.name}</span><b style={{ fontVariantNumeric: 'tabular-nums' }}>{K.fmt(r, r.period.value)}</b></li>)}</ul>
                </div>
              );
            })}
          </div>

          <div className="kp-grid2 kp-rise" style={{ animationDelay: '.1s' }}>
            <div className="kp-card">
              <div className="kp-h"><h3>Achievement against target</h3><span className="kp-muted">100 = exactly on target · click a bar</span></div>
              <div className="kp-pad">{scored.length ? <Iso3D items={scored.map((r) => ({ label: r.code || r.name, value: r.achievement, color: ST[r.status].color, title: r.code + ' ' + r.name + ': ' + K.fmt(r, r.period.value) + ' against ' + K.fmt(r, r.target) + ' (' + r.achievement + '%)', row: r }))} max={150} refLine={100} refLabel="On target" onPick={(d) => setOpen(d.row)} />
                : <div className="kp-empty">No KPI has both figures and a target in this period yet.</div>}</div>
            </div>
            <div className="kp-card">
              <div className="kp-h"><h3>Status by pillar</h3></div>
              <div className="kp-pad"><Iso3DStack groups={pillars.map((pl) => { const c = K.summarize(rows.filter((r) => r.pillar === pl.id)); return { id: pl.id, label: pl.label, parts: [{ value: c.met, color: ST.met.color, label: 'on target' }, { value: c.near, color: ST.near.color, label: 'close' }, { value: c.off, color: ST.off.color, label: 'need action' }, { value: c.nodata + c.notarget + (c.notstarted || 0) + (c.notdue || 0), color: ST.nodata.color, label: 'no data / target' }] }; })} onPick={(g) => setFPillar(fPillar === g.id ? '' : g.id)} />
                <div className="kp-legend" style={{ justifyContent: 'center', marginTop: 6 }}>{[['met', 'On target'], ['near', 'Close'], ['off', 'Needs action'], ['nodata', 'No data / target']].map(([k, l]) => <span key={k}><i className="kp-dot" style={{ background: ST[k].color }} />{l}</span>)}</div></div>
            </div>
          </div>

          <div className="kp-card kp-rise" style={{ animationDelay: '.15s' }}>
            <div className="kp-h"><h3>Scorecard</h3><span className="kp-muted">{shown.length} of {rows.length} KPIs{fPillar || fStatus ? ' · filtered' : ''}</span><span className="grow" />
              {(fPillar || fStatus) && <Btn onClick={() => { setFPillar(''); setFStatus(''); }}>Show all</Btn>}
              <Btn onClick={() => setRoute({ view: 'kpiReports' })}>Reports</Btn>
              {canEnter && <Btn pri onClick={() => setRoute({ view: 'kpiEntry' })}>Enter this month's data</Btn>}</div>
            <div className="kp-scroll">
              <table className="kp-tbl"><thead><tr><th>#</th><th>KPI</th><th>Last 12 months</th><th style={{ textAlign: 'right' }}>{rep.months.length > 1 ? 'Period' : 'Current'}</th><th style={{ textAlign: 'right' }}>Target</th><th>Variance</th><th>Status</th><th>Trend</th></tr></thead>
                <tbody>{shown.map((r) => (
                  <tr key={r.kpiId} onClick={() => setOpen(r)}>
                    <td><Code r={r} cfg={cfg} /></td>
                    <td><div style={{ fontWeight: 700, color: 'var(--ink)' }}>{r.name}</div><div className="kp-muted" style={{ fontSize: 11 }}>{r.unit}{r.linked ? ' · from quality data' : ''}{r.freqMonths > 1 ? ' · ' + K.freqLabel(r, true).toLowerCase() : ''}</div></td>
                    <td><Spark row={r} /></td>
                    <td className="num"><b style={{ fontSize: 14 }}>{K.fmt(r, r.period.value)}</b><ResultTag r={r} /></td>
                    <td className="num">{r.target != null ? K.fmt(r, r.target) : '—'}</td>
                    <td style={{ fontSize: 12, color: ST[r.status].ink, whiteSpace: 'nowrap' }}>{K.gapLabel(r, r.period.value, r.target)}</td>
                    <td><Pill s={r.status} /></td>
                    <td><Trend d={r.trendDir} /></td>
                  </tr>
                ))}</tbody></table>
              {!shown.length && <div className="kp-empty">No KPI matches this filter.</div>}
            </div>
          </div>
        </>}
        {open && <KpiDrawer row={open} cfg={cfg} onClose={() => setOpen(null)} setRoute={setRoute} canEnter={canEnter} showCalc={showCalc} />}
      </div>
    );
  }

  /* ============================================================ data update === */
  /* When one KPI starts counting — its own month, or "the same as all KPIs". Saved on the KPI
     (PUT /api/kpi/defs/:id startMonth); nothing is deleted, earlier months simply stop counting. */
  function StartDialog({ meta, def, suggest, onClose, onSaved }) {
    const cfg = meta.config;
    const [m, setM] = useState(suggest || def.startMonth || '');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const eff = K.isMonth(m) ? m : cfg.cycleStart;
    async function save(value) {
      setBusy(true); setErr('');
      try {
        await api('/api/kpi/defs/' + encodeURIComponent(def.id), { method: 'PUT', body: JSON.stringify({ startMonth: K.isMonth(value) ? value : null, baseUpdatedAt: def.updatedAt }) });
        toast(def.name + ' — counting starts ' + K.fmtMonthLong(K.isMonth(value) ? value : cfg.cycleStart) + '.', 'success');
        onSaved();
      } catch (e) { setErr(e.message); setBusy(false); }
    }
    return (
      <div className="kp-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <div className="kp-dlg" role="dialog">
          <div className="kp-dlg-h"><span className="kp-code" style={{ background: K.pillarOf(cfg, def.pillar).color, marginTop: 2 }}>{def.code || '•'}</span>
            <div><h3>When does {def.name} start?</h3><div className="kp-muted">Cycles, targets and the missing-data checks count from this month. Earlier months are kept but not counted.</div></div>
            <button className="kp-x" onClick={onClose}>×</button></div>
          <div className="kp-dlg-b">
            <label className="kp-fld"><span className="kp-lab">This KPI starts on</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input type="month" className="kp-in" value={m} max={meta.thisMonth} onChange={(e) => setM(e.target.value)} />
                <span className="kp-muted">{K.isMonth(m) ? '' : 'blank = the same as all KPIs (' + K.fmtMonthLong(cfg.cycleStart) + ')'}</span>
              </div></label>
            <div className="kp-banner info" style={{ display: 'block' }}>{Array.from({ length: cfg.cycles }, (_, i) => { const r = K.cycleRange(i + 1, cfg, { startMonth: eff }); return 'Cycle ' + (i + 1) + ': ' + K.fmtRange(r.from, r.to); }).join(' · ')}</div>
            {err && <div className="kp-err">{err}</div>}
          </div>
          <div className="kp-dlg-f">
            <Btn pri disabled={busy || (m && !K.isMonth(m))} onClick={() => save(m)}>Save</Btn>
            {def.startMonth && <Btn disabled={busy} onClick={() => save(null)}>Same as all KPIs</Btn>}
            <span style={{ flex: 1 }} /><Btn onClick={onClose}>Cancel</Btn>
          </div>
        </div>
      </div>
    );
  }

  function EntryDialog({ meta, def, ym, cell, onClose, onSaved, showCalc, checks, onStartHere }) {
    const f = def.formula;
    const saved = cell.source === 'manual' || cell.source === 'edited';
    const may = saved ? meta.canEdit : (meta.canAdd || meta.canEdit);
    const start = saved ? cell : (cell.auto || {});
    const [num, setNum] = useState(K.has(start.num) ? String(start.num) : '');
    const [den, setDen] = useState(K.has(start.den) ? String(start.den) : '');
    const [val, setVal] = useState(f === 'direct' && K.has(start.value) ? String(start.value) : '');
    const [note, setNote] = useState(cell.note || '');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const [needNote, setNeedNote] = useState(false);
    const [openCalc, setOpenCalc] = useState(!!showCalc);
    const first = useRef(null), noteRef = useRef(null);
    useEffect(() => { if (first.current) first.current.focus(); }, []);
    const entry = { num, den, value: val };
    const live = f === 'direct' ? (K.has(val) ? Number(val) : null) : K.computeValue(f, num, f === 'count' ? null : den);
    const target = K.targetFor(def, ym, meta.config);
    const st = K.statusOf(def, live, target, meta.config);
    // A KPI measured every N months: this figure is the whole period's, entered in its last month.
    const per = K.freqOf(def) > 1 && !cell.notStarted ? K.periodOf(def, ym, meta.config) : null;
    const when2 = per ? per.label : K.fmtMonth(ym);
    const problem = (num || den || val) ? K.validateEntry(def, entry) : null;
    // Typing over a figure the quality data produced: the reason is required (and printed).
    const overriding = !!(cell.auto && K.has(cell.auto.value));
    const fillFrom = (x) => { setNum(K.has(x.num) ? String(x.num) : ''); setDen(K.has(x.den) ? String(x.den) : ''); if (f === 'direct') setVal(K.has(x.value) ? String(x.value) : ''); };
    async function save(next, confirmed) {
      const e = K.validateEntry(def, entry);
      if (e) { setErr(e); return; }
      if (overriding && !note.trim()) { setNeedNote(true); setErr('Say why the system figure (' + K.fmt(def, cell.auto.value) + ') is being changed — the reason is printed on the report.'); if (noteRef.current) noteRef.current.focus(); return; }
      setBusy(true); setErr('');
      try {
        const j = await api('/api/kpi/values/' + encodeURIComponent(def.id) + '/' + ym, { method: 'PUT', body: JSON.stringify({ num, den, value: val, note, confirm: confirmed === true ? true : undefined, baseUpdatedAt: saved ? cell.savedAt : undefined }) });
        toast(def.name + ' · ' + when2 + ' saved: ' + K.fmt(def, j.cell.value), 'success');
        onSaved(j.cell, next);
      } catch (x) {
        setBusy(false);
        const code = x.body && x.body.code;
        if (code === 'confirm') {
          const ok = await confirmBox({ title: 'Is this figure right?', message: x.message, confirmLabel: 'Yes, it is right — save it' });
          if (ok) return save(next, true);
          setErr('Not saved. Check the figures.'); return;
        }
        if (code === 'note') { setNeedNote(true); if (noteRef.current) noteRef.current.focus(); }
        setErr(x.message);
        if (x.status === 409) onSaved(null);
      }
    }
    async function revert() {
      const ok = await confirmBox({ title: cell.source === 'edited' ? 'Go back to the system figure?' : per ? 'Clear this period?' : 'Clear this month?', message: cell.source === 'edited' ? 'Your figure (' + K.fmt(def, cell.value) + ') is removed and ' + when2 + ' shows the system figure again (' + K.fmt(def, cell.auto && cell.auto.value) + '). The change is kept in the history.' : 'The figure for ' + when2 + ' is removed. It is kept in the history.', confirmLabel: cell.source === 'edited' ? 'Use system figure' : 'Clear', danger: cell.source !== 'edited' });
      if (!ok) return;
      setBusy(true);
      try { const j = await api('/api/kpi/values/' + encodeURIComponent(def.id) + '/' + ym, { method: 'DELETE' }); toast('Done.', 'success'); onSaved(j.cell); }
      catch (x) { setErr(x.message); setBusy(false); }
    }
    const onKey = (e) => { if (e.key === 'Enter' && !e.shiftKey && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); if (may && !busy) save(true); } if (e.key === 'Escape') onClose(); };
    const numIn = (v, set, label, hint, ref) => (
      <label className="kp-fld"><span className="kp-lab">{label}</span>
        <input ref={ref} className="kp-in" inputMode="decimal" value={v} disabled={!may} onChange={(e) => set(e.target.value.replace(/[^0-9.\-]/g, ''))} style={{ fontSize: 16, fontWeight: 700 }} />
        {hint && <span className="hint">{hint}</span>}</label>
    );
    return (
      <div className="kp-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()} onKeyDown={onKey}>
        <div className="kp-dlg" role="dialog" aria-label={def.name + ' ' + when2}>
          <div className="kp-dlg-h">
            <span className="kp-code" style={{ background: K.pillarOf(meta.config, def.pillar).color, marginTop: 2 }}>{def.code || '•'}</span>
            <div><h3>{def.name}{per ? ' — ' + per.label : ''}</h3><div className="kp-muted">{per ? K.freqLabel(def) + ' · entered in ' + K.fmtMonthLong(ym) : K.fmtMonthLong(ym)} · {def.unit}{target != null ? ' · target ' + K.fmt(def, target) : ''}</div></div>
            <button className="kp-x" onClick={onClose} aria-label="Close">×</button>
          </div>
          <div className="kp-dlg-b">
            {cell.notStarted && <div className="kp-banner info"><div>This KPI starts in {K.fmtMonthLong(K.startOf(def, meta.config))}. A figure for {K.fmtMonthLong(ym)} can be kept for reference, but it is not counted in any report.
              {meta.canEdit && onStartHere && <><br /><button onClick={() => onStartHere(ym)}>Start this KPI from {K.fmtMonthLong(ym)}</button></>}</div></div>}
            {per && <div className="kp-banner info"><div><b>One figure for {per.label}.</b> {def.name} is measured {K.freqLabel(def, true).toLowerCase()}{def.source && def.source.indId ? ' — the system figure pools the units’ monthly figures over the ' + per.months + ' months (Σ ' + (def.numLabel || 'numerator').toLowerCase() + ' ÷ Σ ' + (def.denLabel || 'denominator').toLowerCase() + ').' : ' — type the result of the period (e.g. the survey) here.'}</div></div>}
            {cell.auto && (
              <div className="kp-sys"><b>System figure: {K.fmt(def, cell.auto.value)}</b>
                <span>{K.has(cell.auto.num) ? cell.auto.num + (K.has(cell.auto.den) ? ' ÷ ' + cell.auto.den : '') : ''}</span>
                <span style={{ opacity: 0.8 }}>{srcOf(cell.auto.source).long}{per && cell.auto.months ? ' · ' + cell.auto.months + ' of ' + per.months + ' months have figures' : ''}{cell.auto.areas ? ' · ' + cell.auto.areas + ' unit(s)' : ''}{cell.auto.incomplete ? ' · some units have no denominator' : ''}{cell.auto.carriedFrom ? ' · headcount from ' + cell.auto.carriedFrom : ''}</span>
                {may && saved && <button className="kp-icon-btn" onClick={() => fillFrom(cell.auto)}>Copy into the form</button>}
              </div>
            )}
            {cell.hint && (
              <div className="kp-sys" style={{ background: '#f6f9fc', borderColor: '#d9e2ec', color: '#3a4656' }}>
                <span><b>Auto-fill is off</b> for this KPI — the quality data has <b>{K.fmt(def, cell.hint.value)}</b>{K.has(cell.hint.num) ? ' (' + cell.hint.num + (K.has(cell.hint.den) ? ' ÷ ' + cell.hint.den : '') + ')' : ''}.</span>
                {may && <button className="kp-icon-btn" onClick={() => fillFrom(cell.hint)}>Use it</button>}
              </div>
            )}
            {(() => {
              const by = {}; (checks || []).forEach((c) => { (by[c.code] = by[c.code] || []).push(c); });
              return Object.keys(by).map((code) => {
                const list = by[code], meta2 = K.CHECK_META[code] || {}, lvl = list[0].level;
                return <div key={code} className={'kp-check ' + lvl}><span className="tag">{lvl === 'error' ? 'Error' : 'Warning'}</span>
                  <div><b>{list.length > 1 ? list.length + ' × ' : ''}{meta2.title || code}</b> — {list.length > 2 ? list.slice(0, 2).map((c) => c.text).join(' ') + ' + ' + (list.length - 2) + ' more.' : list.map((c) => c.text).join(' ')}{meta2.fix && <span className="fix">{meta2.fix}</span>}</div></div>;
              });
            })()}
            {(cell.auto || cell.hint) && def.source && def.source.indId && (
              <div className="kp-card" style={{ boxShadow: 'none' }}>
                <button className="kp-h" style={{ width: '100%', border: 0, background: 'transparent', cursor: 'pointer', font: 'inherit', textAlign: 'left' }} onClick={() => setOpenCalc(!openCalc)}>
                  <h3 style={{ fontSize: 13 }}>How the system figure was calculated</h3><span className="grow" /><span className="kp-muted">{openCalc ? 'Hide ▲' : 'Show ▼'}</span></button>
                {openCalc && <div className="kp-pad"><EvidencePanel def={def} kpiId={def.id} ym={ym} compact /></div>}
              </div>
            )}
            {cell.source === 'partial' && <div className="kp-banner">Events were reported for this month but the denominator is missing in the quality data (for CLABSI / CAUTI / VAP: the device days). Type the full figures here, or complete the quality data.</div>}
            {f === 'direct'
              ? numIn(val, setVal, 'Value (' + (def.unit || '') + ')', def.formulaText, first)
              : <div className="kp-row">
                {numIn(num, setNum, def.numLabel || 'Numerator', null, first)}
                {f !== 'count' && numIn(den, setDen, def.denLabel || 'Denominator')}
              </div>}
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', padding: '10px 12px', borderRadius: 12, background: '#f6f9fc' }}>
              <div><div className="kp-lab">Result</div><div className="kp-big">{K.fmt(def, live)}</div></div>
              <div style={{ flex: 1, minWidth: 180 }}>{live != null && <Pill s={st} />}<div className="kp-muted" style={{ marginTop: 5, fontStyle: 'italic' }}>{def.formulaText}</div></div>
            </div>
            {problem && <div className="kp-err">{problem}</div>}
            <label className="kp-fld"><span className="kp-lab" style={needNote ? { color: '#a3172f' } : undefined}>{overriding ? 'Reason for changing the system figure (required — printed on the report)' : 'Note (optional)'}</span>
              <textarea ref={noteRef} className="kp-in" rows={2} value={note} disabled={!may} onChange={(e) => { setNote(e.target.value); if (e.target.value.trim()) setNeedNote(false); }} style={needNote ? { borderColor: '#d23a52', background: '#fff6f7' } : undefined}
                placeholder={overriding ? 'e.g. one case reclassified after the infection-control review on 3 Nov' : 'Where the figure comes from — e.g. HR exit list, audit of 40 files'} /></label>
            {saved && cell.savedBy && <div className="kp-muted">Last saved by {cell.savedBy} · {when(cell.savedAt)}</div>}
            {!may && <div className="kp-banner info">{saved ? 'Changing a saved figure needs the Nursing KPI “Edit” permission.' : 'Entering figures needs the Nursing KPI “Add” permission.'}</div>}
            {err && <div className="kp-err">{err}</div>}
          </div>
          <div className="kp-dlg-f">
            {may && <Btn pri disabled={busy} onClick={() => save(true)}>Save & next</Btn>}
            {may && <Btn disabled={busy} onClick={() => save(false)}>Save</Btn>}
            {saved && (meta.canEdit || meta.canDelete) && <Btn disabled={busy} danger={cell.source !== 'edited'} onClick={revert}>{cell.source === 'edited' ? 'Revert to system figure' : 'Clear'}</Btn>}
            <span style={{ flex: 1 }} /><span className="kp-muted" style={{ fontSize: 11 }}>Enter = save & next · Esc = close</span>
            <Btn onClick={onClose}>Cancel</Btn>
          </div>
        </div>
      </div>
    );
  }

  function DataEntry({ meta, defs, focusKpi, showCalc, reload }) {
    const [startFor, setStartFor] = useState(null);           // { def, suggest } — the per-KPI start dialog
    const [allStart, setAllStart] = useState(meta.config.cycleStart);
    useEffect(() => { setAllStart(meta.config.cycleStart); }, [meta.config.cycleStart]);
    async function saveAllStart() {
      const ok = await confirmBox({ title: 'All KPIs start on ' + K.fmtMonthLong(allStart) + '?', message: 'Cycles, targets and the missing-data checks of every KPI count from ' + K.fmtMonthLong(allStart) + ' (a KPI with its own start month keeps it). Earlier months are kept, only not counted. Nothing is deleted.', confirmLabel: 'Change start' });
      if (!ok) { setAllStart(meta.config.cycleStart); return; }
      try { await api('/api/kpi/config', { method: 'PUT', body: JSON.stringify({ cycleStart: allStart }) }); toast('All KPIs now start ' + K.fmtMonthLong(allStart) + '.', 'success'); refreshBadge(); if (reload) reload(); setTick((t) => t + 1); }
      catch (e) { toast(e.message, 'error'); setAllStart(meta.config.cycleStart); }
    }
    const [p, setP, range] = usePeriod(meta, 'entry', '6m', 'all');
    const [vals, setVals] = useState(null);
    const [err, setErr] = useState('');
    const [only, setOnly] = useState(false);
    const [q, setQ] = useState('');
    const [edit, setEdit] = useState(null);
    const [tick, setTick] = useState(0);
    const cfg = meta.config;
    const active = defs.filter(K.isLive);
    useEffect(() => {
      if (!range) return;
      let live = true; setErr('');
      // checks=1: every cell comes back with its data checks, so a red / amber corner shows the
      // months that would block (or be flagged on) a report.
      api('/api/kpi/values?from=' + range.from + '&to=' + range.to + '&checks=1').then((j) => { if (live) setVals(j); }).catch((e) => live && setErr(e.message));
      return () => { live = false; };
    }, [range && range.from, range && range.to, tick]);
    useEffect(() => {
      if (!focusKpi || !vals) return;
      const el = document.getElementById('kp-row-' + focusKpi);
      if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, [focusKpi, vals]);
    const months = vals ? vals.months : [];
    const cellOf = (id, m) => (vals && vals.values[id] && vals.values[id][m]) || { source: 'missing', value: null };
    const checksOf = (id, m) => (vals && vals.checks && vals.checks[id] && vals.checks[id][m]) || null;
    // A month before the KPI starts, or one a less-often KPI owes nothing for, is never a gap.
    const isGap = (c) => !c.notStarted && c.source !== 'not-due' && !K.has(c.value);
    const last = meta.lastClosed;
    // Each KPI owes its latest due month: the last closed month, or a less-often KPI's last ended period.
    const dueFor = (d) => K.lastDue(d, last, cfg);
    const gaps = vals ? active.filter((d) => { const m = dueFor(d); return m && months.indexOf(m) >= 0 && isGap(cellOf(d.id, m)); }) : [];
    const anyLess = active.some((d) => K.freqOf(d) > 1);
    // A KPI measured every N months: the months of one period share one cell (the due month's).
    function segmentsOf(d) {
      const out = [];
      months.forEach((m) => {
        const pp = K.freqOf(d) > 1 ? K.periodOf(d, m, cfg) : null;
        const prev = out[out.length - 1];
        if (pp && prev && prev.p && prev.p.to === pp.to) prev.months.push(m);
        else out.push({ p: pp, months: [m] });
      });
      return out;
    }
    const errorCells = vals && vals.checks ? Object.keys(vals.checks).reduce((n, k) => n + Object.keys(vals.checks[k]).filter((m) => vals.checks[k][m].level === 'error').length, 0) : 0;
    const shown = active.filter((d) => (!q || (d.name + ' ' + d.code).toLowerCase().indexOf(q.toLowerCase()) >= 0) && (!only || months.some((m) => m <= meta.thisMonth && (isGap(cellOf(d.id, m)) || (checksOf(d.id, m) || {}).level === 'error'))));
    const groups = cfg.pillars.map((pl) => ({ pl, list: shown.filter((d) => d.pillar === pl.id) })).filter((g) => g.list.length);
    const orphan = shown.filter((d) => !cfg.pillars.find((pl) => pl.id === d.pillar));
    if (orphan.length) groups.push({ pl: K.pillarOf(cfg, 'other'), list: orphan });
    const flat = groups.reduce((a, g) => a.concat(g.list), []);
    function nextAfter(id, m) {
      const order = [];
      flat.forEach((d) => months.forEach((mm) => { if (mm <= meta.thisMonth) order.push([d, mm]); }));
      const at = order.findIndex(([d, mm]) => d.id === id && mm === m);
      const hit = order.slice(at + 1).find(([d, mm]) => isGap(cellOf(d.id, mm)) || (!cellOf(d.id, mm).notStarted && cellOf(d.id, mm).source === 'partial'));
      return hit || null;
    }
    function onSaved(cell, next) {
      const cur = edit;
      if (!cell) { setTick((t) => t + 1); return; }
      setVals((v) => { const o = Object.assign({}, v, { values: Object.assign({}, v.values) }); o.values[cur.def.id] = Object.assign({}, o.values[cur.def.id], { [cur.ym]: cell }); return o; });
      refreshBadge();
      if (next) {
        const n = nextAfter(cur.def.id, cur.ym);
        if (n) { setEdit({ def: n[0], ym: n[1], cell: cellOf(n[0].id, n[1]), k: Date.now() }); return; }
        toast('All figures in this period are filled in.', 'success');
      }
      setEdit(null);
    }
    return (
      <div className="kp-wrap">
        <div className="kp-card kp-bar">
          <PeriodPicker meta={meta} p={p} setP={setP} range={range} presets={['1m', '3m', '6m', '12m', 'year', 'cycle1', 'cycle2', 'custom']} maxMonth={meta.thisMonth} />
          <span style={{ flex: 1 }} />
          <input className="kp-in" placeholder="Find a KPI…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 170 }} />
          <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}><input type="checkbox" checked={only} onChange={(e) => setOnly(e.target.checked)} style={{ width: 'auto' }} />Only gaps</label>
          <Btn onClick={() => setTick((t) => t + 1)} title="Read the quality data again">↻ Refresh system figures</Btn>
          <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)', padding: '3px 4px 3px 10px', borderRadius: 9, background: '#eef8fd', border: '1px solid #b9dcef' }} title="Every KPI counts its cycles, targets and missing-data checks from this month, unless it has its own start">
            All KPIs start on
            {meta.isAdmin ? <><input type="month" className="kp-sel" value={allStart} max={meta.thisMonth} onChange={(e) => K.isMonth(e.target.value) && setAllStart(e.target.value)} style={{ padding: '4px 8px' }} />
              {allStart !== meta.config.cycleStart && <Btn pri onClick={saveAllStart}>Save</Btn>}</>
              : <b style={{ padding: '0 8px 0 2px' }}>{K.fmtMonth(meta.config.cycleStart)}</b>}
          </span>
        </div>
        {gaps.length > 0 && (meta.canAdd || meta.canEdit) && (
          <div className="kp-banner" role="status"><span style={{ fontSize: 16 }}>✎</span>
            <div><b>{gaps.length} KPI{gaps.length > 1 ? 's' : ''} still need{gaps.length > 1 ? '' : 's'} {anyLess ? 'their latest figure' : 'a figure for ' + K.fmtMonthLong(last)}.</b> Click one to fill it — after saving, “Save & next” takes you to the next gap.<br />
              {gaps.map((d) => { const m = dueFor(d); return <button key={d.id} onClick={() => setEdit({ def: d, ym: m, cell: cellOf(d.id, m), k: Date.now() })}>{d.code} {d.name}{K.freqOf(d) > 1 ? ' (' + K.periodOf(d, m, cfg).label + ')' : ''}</button>; })}</div></div>
        )}
        {vals && !gaps.length && months.indexOf(last) >= 0 && <div className="kp-banner ok"><span style={{ fontSize: 16 }}>✓</span><div>Every KPI has {anyLess ? 'its latest figure (' + K.fmtMonthLong(last) + ', or the last period for those measured less often)' : 'a figure for ' + K.fmtMonthLong(last)}.</div></div>}
        {errorCells > 0 && <div className="kp-banner"><span style={{ fontSize: 16 }}>⚑</span><div><b>{errorCells} month{errorCells > 1 ? 's have' : ' has'} a data error</b> (red corner) — a unit that did not report, a missing denominator, Device Days that do not match, or a changed figure without a reason. Click the cell to see it. A report cannot be finalised until each is fixed or acknowledged with a reason.</div></div>}
        {meta.config.autoFill === false && <div className="kp-banner info"><span style={{ fontSize: 16 }}>⏸</span><div><b>Auto-fill from the quality data is OFF</b> for every KPI (Settings). Each figure is typed here; the system figure is offered as a hint.</div></div>}
        {err && <div className="kp-banner">{err}</div>}
        <div className="kp-card">
          <div className="kp-h"><h3>Monthly figures</h3><span className="grow" />
            <div className="kp-legend">{[['pooled', 'From quality data'], ['hh-audit', 'Hand hygiene audit'], ['doc-audit', 'Documentation audit'], ['edited', 'Edited by you'], ['manual', 'Entered'], ['partial', 'Denominator missing']].map(([k, l]) => <span key={k}><i className="kp-dot" style={{ background: srcOf(k).dot }} />{l}</span>)}
              <span><i className="kp-dot" style={{ border: '1.5px dashed #d23a52' }} />Missing</span>
              <span><i style={{ display: 'inline-block', borderStyle: 'solid', borderWidth: '0 9px 9px 0', borderColor: 'transparent #d23a52 transparent transparent' }} />Data error</span>
              <span><i style={{ display: 'inline-block', borderStyle: 'solid', borderWidth: '0 9px 9px 0', borderColor: 'transparent #e0a21e transparent transparent' }} />Warning</span></div></div>
          {!vals && !err && <div className="kp-empty">Loading the figures…</div>}
          {vals && <div className="kp-scroll" style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
            <table className="kp-eg"><thead><tr><th className="k">KPI</th>{months.map((m) => <th key={m} style={m === last ? { background: '#0c6f7d' } : undefined}>{K.fmtMonth(m)}</th>)}<th>Target</th></tr></thead>
              <tbody>{groups.map((g) => [
                <tr key={'g' + g.pl.id} className="grp"><td colSpan={months.length + 2}><span className="kp-dot" style={{ background: g.pl.color, marginRight: 7 }} />{g.pl.label}</td></tr>,
                ...g.list.map((d) => (
                  <tr key={d.id} id={'kp-row-' + d.id} className={focusKpi === d.id ? 'hi' : ''}>
                    <td className="k"><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span className="kp-code" style={{ background: g.pl.color }}>{d.code || '•'}</span>
                      <div style={{ minWidth: 0 }}><div style={{ fontWeight: 700, color: 'var(--ink)', lineHeight: 1.25 }}>{d.name}</div><div className="kp-muted" style={{ fontSize: 10.5 }}>{d.unit}
                        {d.source && d.source.indId ? (d.autoFill === false || meta.config.autoFill === false ? ' · typed (auto-fill off)' : ' · auto from quality') : ' · typed'}
                        {K.freqOf(d) > 1 ? <b style={{ color: '#3f3fa8' }}>{' · ' + K.freqLabel(d, true).toLowerCase()}</b> : ''}
                        </div>
                        <button onClick={() => meta.canEdit && setStartFor({ def: d })} disabled={!meta.canEdit} title={meta.canEdit ? 'Change when this KPI starts counting' : ''}
                          style={{ border: 0, background: 'transparent', padding: 0, font: 'inherit', fontSize: 10.5, fontWeight: 700, color: d.startMonth ? '#8a5a00' : '#0b6b8f', cursor: meta.canEdit ? 'pointer' : 'default' }}>
                          {(d.startMonth ? '◷ starts ' + K.fmtMonth(d.startMonth) + ' (own)' : '◷ starts ' + K.fmtMonth(meta.config.cycleStart)) + (meta.canEdit ? ' ✎' : '')}</button></div></div></td>
                    {segmentsOf(d).map((sg) => {
                      if (sg.p && K.freqOf(d) > 1) {
                        // one cell for the whole period; only its due (last) month takes a figure
                        const due = sg.p.to, dueIn = sg.months.indexOf(due) >= 0, future = due > meta.thisMonth;
                        const c = dueIn ? cellOf(d.id, due) : null, ch = dueIn ? checksOf(d.id, due) : null;
                        const open = dueIn && !future;
                        const kept = sg.months.map((x) => cellOf(d.id, x).kept).filter(Boolean);
                        const cls = !open ? 'span wait' : c.source === 'partial' ? 'partial' : isGap(c) ? 'missing' : 'span';
                        const tip = sg.p.label + ' — ' + K.freqLabel(d) + ': one figure for the period, entered in ' + K.fmtMonthLong(due) + '.'
                          + (kept.length ? '\n' + kept.length + ' monthly figure(s) saved earlier are kept but not counted.' : '')
                          + (ch ? '\n' + ch.items.map((x) => (x.level === 'error' ? '✖ ' : '▲ ') + x.text).join('\n') : '') + (c ? '\n' + (c.note || srcOf(c.source).long) : '');
                        return <td key={sg.months[0]} colSpan={sg.months.length} style={{ position: 'relative' }}>
                          <button className={'kp-cell ' + cls} disabled={!open} onClick={() => setEdit({ def: d, ym: due, cell: c, k: Date.now(), checks: ch ? ch.items : [] })} title={tip}>
                            {open && (isGap(c) ? <span style={{ fontSize: 11.5, fontWeight: 700 }}>{c.source === 'partial' ? '! den.' : '+ Add'}</span> : <b>{K.fmt(d, c.value, { bare: true })}</b>)}
                            <span className="per">{sg.p.label}{!dueIn ? ' · result in ' + K.fmtMonth(due) : future ? ' · due ' + K.fmtMonth(due) : ''}</span>
                            {open && !isGap(c) && <span className="kp-dot" style={{ background: srcOf(c.source).dot }} />}
                          </button>{ch && <span className={'kp-cellmark ' + ch.level} />}</td>;
                      }
                      const m = sg.months[0];
                      const c = cellOf(d.id, m), future = m > meta.thisMonth, ch = checksOf(d.id, m);
                      const pre = !future && c.notStarted;
                      const cls = future ? 'future' : pre ? 'future' : c.source === 'partial' ? 'partial' : isGap(c) ? 'missing' : '';
                      const tip = (ch ? ch.items.map((x) => (x.level === 'error' ? '✖ ' : '▲ ') + x.text).join('\n') + '\n' : '') + (pre ? 'Before this KPI starts (' + K.fmtMonth(K.startOf(d, meta.config)) + ') — not counted' : (c.note || srcOf(c.source).long));
                      return <td key={m} style={{ position: 'relative' }}><button className={'kp-cell ' + cls} disabled={future} style={pre ? { cursor: 'pointer' } : undefined} onClick={() => setEdit({ def: d, ym: m, cell: c, k: Date.now(), checks: ch ? ch.items : [] })} title={tip}>
                        {future ? <span>—</span> : pre && !K.has(c.value) ? <span style={{ fontSize: 10.5 }}>starts {K.fmtMonth(K.startOf(d, meta.config)).replace(' 20', " '")}</span> : isGap(c) ? <span style={{ fontSize: 11.5, fontWeight: 700 }}>{c.source === 'partial' ? '! den.' : '+ Add'}</span> : <b style={pre ? { color: '#a3adba' } : undefined}>{K.fmt(d, c.value, { bare: true })}</b>}
                        {!future && !isGap(c) && !pre && <span className="kp-dot" style={{ background: srcOf(c.source).dot }} />}
                      </button>{ch && !pre && <span className={'kp-cellmark ' + ch.level} />}</td>;
                    })}
                    <td className="kp-muted" style={{ whiteSpace: 'nowrap' }}>{(() => { const t = K.targetFor(d, months[months.length - 1], cfg); return t == null ? '—' : K.fmt(d, t); })()}</td>
                  </tr>
                )),
              ])}</tbody></table>
            {!flat.length && <div className="kp-empty">{only ? 'No gaps — every KPI has its figures in this period.' : 'No KPI matches.'}</div>}
          </div>}
        </div>
        <div className="kp-muted">Figures from the quality data and the hand hygiene audit fill themselves. You can still click one and type over it — the system figure stays visible beside yours, and “Revert to system figure” brings it back.</div>
        {startFor && <StartDialog meta={meta} def={startFor.def} suggest={startFor.suggest} onClose={() => setStartFor(null)} onSaved={() => { setStartFor(null); refreshBadge(); if (reload) reload(); setTick((t) => t + 1); }} />}
        {edit && <EntryDialog key={edit.k} onStartHere={(ym) => { const def = edit.def; setEdit(null); setStartFor({ def, suggest: ym }); }} meta={meta} def={edit.def} ym={edit.ym} cell={edit.cell} checks={edit.checks || ((checksOf(edit.def.id, edit.ym) || {}).items)} showCalc={showCalc} onClose={() => setEdit(null)} onSaved={(c, next) => { onSaved(c, next); setTick((t) => t + 1); }} />}
      </div>
    );
  }

  /* ================================================================ reports === */
  function ReportsHome({ meta, setRoute }) {
    const [p, setP, range] = usePeriod(meta, 'rep', '1m');
    const [list, setList] = useState(null);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const load = () => api('/api/kpi/reports').then((j) => setList(j.reports)).catch((e) => setErr(e.message));
    useEffect(() => { load(); }, []);
    async function generate() {
      setBusy(true);
      try { const j = await api('/api/kpi/report', { method: 'POST', body: JSON.stringify({ from: range.from, to: range.to }) }); toast(j.existed ? 'This period already has a final report.' : 'Report ready.', 'success'); refreshBadge(); setRoute({ view: 'kpiReports', report: j.report.id }); }
      catch (e) { toast(e.message, 'error'); }
      setBusy(false);
    }
    const canGen = meta.canAdd || meta.canEdit;
    const SumBar = ({ s }) => (s ? <div style={{ display: 'flex', height: 8, borderRadius: 99, overflow: 'hidden', background: '#eef2f6' }}>{['met', 'near', 'off', 'notarget', 'nodata', 'notstarted', 'notdue'].map((k) => (s[k] ? <span key={k} title={s[k] + ' ' + ST[k].label} style={{ flex: s[k], background: ST[k].color }} /> : null))}</div> : null);
    return (
      <div className="kp-wrap">
        <div className="kp-card kp-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}><h3 style={{ margin: 0, fontSize: 15 }}>Make a report</h3><span className="kp-muted">one month, 2, 3, 6 or 12 months, a cycle, or any range you choose</span></div>
          <PeriodPicker meta={meta} p={p} setP={setP} range={range} maxMonth={meta.thisMonth} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Btn onClick={() => setRoute({ view: 'kpiReports', report: K.reportId(range.from, range.to) })}>Preview</Btn>
            {canGen && <Btn pri disabled={busy} onClick={generate}>{busy ? 'Preparing…' : 'Generate & save report'}</Btn>}
            <span className="kp-muted">A saved draft keeps your commentary and sign-off; its figures stay live until you finalise it. The report for the month that just ended is prepared automatically.</span>
          </div>
        </div>
        <div className="kp-card">
          <div className="kp-h"><h3>Documents</h3><span className="kp-muted">the programme itself — not a period</span></div>
          <div className="kp-grid2 kp-pad">
            <div className="kp-card kp-pad" style={{ display: 'flex', flexDirection: 'column', gap: 8, boxShadow: 'none' }}>
              <b style={{ fontSize: 14, color: 'var(--ink)' }}>KPI Definition document</b>
              <span className="kp-muted">One page per KPI: what it measures, the formula, where its figures come from, how often it is measured, its cycles and targets, and its action plan — with a cover and document control for sign-off.</span>
              <div><Btn pri onClick={() => setRoute({ view: 'kpiReports', report: 'definitions' })}>Open · Print · PDF · Word</Btn></div>
            </div>
            <div className="kp-card kp-pad" style={{ display: 'flex', flexDirection: 'column', gap: 8, boxShadow: 'none' }}>
              <b style={{ fontSize: 14, color: 'var(--ink)' }}>Data collection calendar</b>
              <span className="kp-muted">A year on one page: which KPI owes a figure in which month — monthly, every 3 or 6 months, or yearly — to hand to unit managers.</span>
              <div style={{ display: 'flex', gap: 8 }}><Btn pri onClick={() => setRoute({ view: 'kpiReports', report: 'calendar-' + meta.thisMonth.slice(0, 4) })}>Open {meta.thisMonth.slice(0, 4)} · Print · PDF · Excel</Btn>
                <Btn onClick={() => setRoute({ view: 'kpiReports', report: 'calendar-' + (+meta.thisMonth.slice(0, 4) + 1) })}>{+meta.thisMonth.slice(0, 4) + 1}</Btn></div>
            </div>
          </div>
        </div>
        {err && <div className="kp-banner">{err}</div>}
        <div className="kp-card">
          <div className="kp-h"><h3>Saved reports</h3><span className="kp-muted">{list ? list.length : ''}</span></div>
          {!list && !err && <div className="kp-empty">Loading…</div>}
          {list && !list.length && <div className="kp-empty">No report saved yet. Choose a period above and press “Generate & save report”.</div>}
          {list && list.length > 0 && <div className="kp-grid3 kp-pad">{list.map((r) => (
            <div key={r.id} className="kp-card kp-pad kp-rise" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8 }} onClick={() => setRoute({ view: 'kpiReports', report: r.id })}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <b style={{ fontSize: 14.5, color: 'var(--ink)', flex: 1 }}>{K.fmtRange(r.from, r.to)}</b>
                <span className="kp-pill" style={r.state === 'final' ? { background: '#e7f6ed', color: '#14713f' } : { background: '#fff1d6', color: '#8a5a00' }}>{r.state === 'final' ? 'Final' : 'Draft'}</span>
              </div>
              <div className="kp-muted">{(r.preset === 'year' ? 'Year ' + r.from.slice(0, 4) : (K.PRESETS.find((x) => x.id === r.preset) || {}).label || 'Custom')}{r.summary ? ' · ' + r.summary.met + ' on target · ' + r.summary.off + ' need action' : ''}</div>
              <SumBar s={r.summary} />
              <div className="kp-muted" style={{ fontSize: 11 }}>{r.state === 'final' ? 'Finalised by ' + (r.finalizedBy || '—') + ' · ' + when(r.finalizedAt) : (r.generatedBy || '') + ' · ' + when(r.generatedAt)}</div>
            </div>
          ))}</div>}
        </div>
      </div>
    );
  }

  /* The programme's documents: the KPI Definition document and a year's Data collection calendar.
     Same sheets and the same print / PDF as a report; Word and Excel come from the server
     (server/kpi-docs.js), built from the same facts (defFacts). */
  function DocView({ meta, kind, year, setRoute }) {
    const cfg = meta.config;
    const isDefs = kind === 'definitions';
    const [y, setY] = useState(year || +meta.thisMonth.slice(0, 4));
    const [data, setData] = useState(null);
    const [err, setErr] = useState('');
    const [busy, setBusy] = useState('');
    const [capturing, setCapturing] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
      let live = true; setData(null); setErr('');
      api(isDefs ? '/api/kpi/definitions' : '/api/kpi/calendar?year=' + y).then((j) => { if (live) setData(j); }).catch((e) => live && setErr(e.message));
      return () => { live = false; };
    }, [kind, y]);
    const sig = sigNames();
    const title = isDefs ? 'Nursing KPI Definitions' : 'Data collection calendar ' + y;
    const fileBase = isDefs ? 'Nursing-KPI-Definitions-' + meta.thisMonth : 'Nursing-KPI-Data-Collection-Calendar-' + y;
    const log = (k) => () => api('/api/kpi/print', { method: 'POST', body: JSON.stringify({ kind: k, what: title }) });
    async function act(k) {
      setBusy(k);
      try {
        if (k === 'print') await printSheets(() => ref.current, title, log('print'), setCapturing);
        if (k === 'pdf') await pdfSheets(() => ref.current, title, fileBase, log('pdf'), setCapturing);
        if (k === 'docx') { await download('/api/kpi/definitions.docx?sig=' + encodeURIComponent(JSON.stringify(sig))); toast('Word file downloaded.', 'success'); }
        if (k === 'xlsx') { await download('/api/kpi/calendar.xlsx?year=' + y); toast('Excel file downloaded.', 'success'); }
      } catch (e) { toast(e.message, 'error'); }
      setBusy('');
    }
    const foot = title + ' · ' + (cfg.hospitalName || '') + ' · ' + K.fmtMonthLong(meta.thisMonth);
    let page = 0;
    const pg = () => 'Page ' + (++page);
    const sheets = [];
    if (data && isDefs) {
      const list = data.defs.slice().sort((a, b) => ((K.pillarOf(cfg, a.pillar).order || 99) - (K.pillarOf(cfg, b.pillar).order || 99)) || ((a.order || 0) - (b.order || 0)));
      sheets.push(<Sheet key="cover" kicker={cfg.hospitalName} title="Nursing KPI Definitions" foot={foot} page={pg()}>
        <div style={{ fontSize: 15, color: '#3a4656', marginBottom: 6 }}>{cfg.reportTitle} · {list.length} KPIs in {[...new Set(list.map((d) => d.pillar))].length} pillars</div>
        <div style={{ fontSize: 13, color: '#3a4656', maxWidth: 820, lineHeight: 1.5, marginBottom: 18 }}>What each KPI measures, how it is calculated, where its figures come from, how often it is measured, its cycles, targets and action plan. Version: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}{me() ? ' · prepared by ' + me() : ''}.</div>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#00293A', margin: '6px 0' }}>Document control</div>
        <table className="kp-stbl" style={{ maxWidth: 820 }}><thead><tr><th>Role</th><th>Name</th><th>Signature</th><th>Date</th></tr></thead>
          <tbody>{[['prepared', 'Prepared by'], ['reviewed', 'Reviewed by'], ['recommended', 'Recommended by'], ['approved', 'Approved by']].map(([k, l]) => <tr key={k}><td className="l"><b>{l}</b></td><td className="l" style={{ height: 34 }}>{sig[k] || ''}</td><td /><td /></tr>)}</tbody></table>
      </Sheet>);
      sheets.push(<Sheet key="toc" kicker="Nursing KPI Definitions" title="Contents" foot={foot} page={pg()}>
        <table className="kp-stbl"><thead><tr><th>Code</th><th>KPI</th><th>Pillar</th><th>Measured</th><th>Target</th><th>Source</th></tr></thead>
          <tbody>{list.map((d) => <tr key={d.id}><td><b>{d.code}</b></td><td className="l">{d.name}</td><td className="l">{K.pillarOf(cfg, d.pillar).label}</td><td>{d.doc.measured}</td><td>{d.doc.cycles.map((c) => c.target).join(' → ')}</td><td>{d.source && d.source.indId ? 'Quality data' : 'Entered'}</td></tr>)}</tbody></table>
      </Sheet>);
      list.forEach((d) => {
        const doc = d.doc, pl = K.pillarOf(cfg, d.pillar);
        const acts = doc.actions.slice(0, 9);
        sheets.push(<Sheet key={d.id} kicker={pl.label + ' · ' + doc.measured} title={(doc.code ? doc.code + '  ' : '') + doc.name} foot={foot} page={pg()}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.45fr 1fr', gap: 18, alignItems: 'start' }}>
            <table className="kp-deck" style={{ fontSize: 10.8 }}><tbody>{doc.facts.map(([l, v]) => <tr key={l}><th style={{ width: 150, fontSize: 10.5, padding: '5px 9px' }}>{l}</th><td style={{ padding: '5px 9px' }}>{String(v).length > 420 ? String(v).slice(0, 420) + '…' : v}</td></tr>)}</tbody></table>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: '#00293A' }}>Cycles and targets</div>
              <table className="kp-stbl"><thead><tr><th>Cycle</th><th>Dates</th><th>Target</th><th>Results due</th></tr></thead>
                <tbody>{doc.cycles.map((c) => <tr key={c.n}><td><b>{c.n}</b></td><td className="l">{c.dates}</td><td><b>{c.target}</b></td><td>{c.results}</td></tr>)}</tbody></table>
              <div style={{ fontSize: 11, color: '#5b6878' }}>{doc.schedule}</div>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: '#00293A' }}>Action plan</div>
              {acts.length ? <table className="kp-stbl" style={{ fontSize: 10.5 }}><thead><tr><th>#</th><th>Action</th><th>Owner</th><th>Status</th></tr></thead>
                <tbody>{acts.map((a, i) => <tr key={i}><td>{i + 1}</td><td className="l">{a.text}{a.due ? <span style={{ color: '#7b8796' }}> · due {a.due}</span> : null}</td><td className="l">{a.owner}</td><td>{a.status}</td></tr>)}</tbody></table>
                : <div className="kp-muted">No action items.</div>}
              {doc.actions.length > acts.length && <div className="kp-muted" style={{ fontSize: 11 }}>+ {doc.actions.length - acts.length} more action items (in the Word file).</div>}
            </div>
          </div>
        </Sheet>);
      });
    }
    if (data && !isDefs) {
      const cal = data.calendar, defs = data.defs;
      const rowsOf = defs.slice().sort((a, b) => ((K.pillarOf(cfg, a.pillar).order || 99) - (K.pillarOf(cfg, b.pillar).order || 99)));
      const chunks = []; for (let i = 0; i < rowsOf.length; i += 20) chunks.push(rowsOf.slice(i, i + 20));
      const mark = { due: <b style={{ color: '#14713f', fontSize: 15 }}>●</b>, off: <span style={{ color: '#b9c2cd' }}>·</span>, notstarted: <span style={{ color: '#c9d1db' }}>—</span> };
      chunks.forEach((part, ci) => sheets.push(<Sheet key={'cal' + ci} kicker={cfg.hospitalName + ' · Nursing KPI'} title={'Data collection calendar ' + cal.year + (chunks.length > 1 ? ' (' + (ci + 1) + '/' + chunks.length + ')' : '')} foot={foot} page={pg()}>
        <table className="kp-stbl" style={{ fontSize: 11 }}><thead><tr><th>#</th><th style={{ textAlign: 'left' }}>KPI</th><th>Measured</th><th>Source</th>{cal.months.map((m) => <th key={m} style={{ padding: '6px 4px' }}>{K.MONS[+m.slice(5) - 1]}</th>)}<th>Due</th></tr></thead>
          <tbody>{part.map((d) => <tr key={d.id}><td><b>{d.code}</b></td><td className="l">{d.name}</td><td style={{ whiteSpace: 'nowrap' }}>{d.freq}</td><td style={{ fontSize: 10 }}>{d.linked ? (d.autoFill && cfg.autoFill !== false ? 'Auto from quality' : 'Typed') : 'Typed'}</td>
            {cal.months.map((m) => <td key={m} style={{ padding: '4px 2px', background: cal.byKpi[d.id][m] === 'due' ? '#e7f6ed' : undefined }}>{mark[cal.byKpi[d.id][m]]}</td>)}
            <td><b>{cal.months.filter((m) => cal.byKpi[d.id][m] === 'due').length}</b></td></tr>)}
            {ci === chunks.length - 1 && <tr><td /><td className="l"><b>Figures due</b></td><td /><td />{cal.dueCount.map((n, i) => <td key={i}><b>{n}</b></td>)}<td><b>{cal.dueCount.reduce((a, b) => a + b, 0)}</b></td></tr>}</tbody></table>
        <div style={{ marginTop: 12, fontSize: 11, color: '#5b6878', display: 'flex', gap: 18, flexWrap: 'wrap' }}><span><b style={{ color: '#14713f' }}>●</b> a figure is due (the period ends this month)</span><span><b>·</b> not due</span><span><b>—</b> not started yet</span>
          <span>A KPI measured every 3 or 6 months, or yearly, owes one figure per period, entered in the period’s last month.</span></div>
      </Sheet>));
    }
    return (
      <div className={'kp-wrap' + (capturing ? ' kp-capturing' : '')}>
        <div className="kp-card kp-bar" style={{ position: 'sticky', top: -22, zIndex: 5, boxShadow: '0 6px 22px rgba(13,27,46,.10)' }}>
          <Btn onClick={() => setRoute({ view: 'kpiReports' })}>‹ All reports</Btn>
          <b style={{ fontSize: 14 }}>{title}</b>
          {!isDefs && <select className="kp-sel" value={y} onChange={(e) => { setY(+e.target.value); setRoute({ view: 'kpiReports', report: 'calendar-' + e.target.value }); }}>{[-1, 0, 1, 2].map((i) => +meta.thisMonth.slice(0, 4) + i).map((n) => <option key={n} value={n}>{n}</option>)}</select>}
          <span style={{ flex: 1 }} />
          {meta.canPrint && <><Btn disabled={!data || !!busy} onClick={() => act('print')}>{busy === 'print' ? 'Preparing…' : 'Print'}</Btn>
            <Btn disabled={!data || !!busy} onClick={() => act('pdf')}>{busy === 'pdf' ? 'Making the PDF…' : 'PDF'}</Btn>
            {isDefs ? <Btn pri disabled={!data || !!busy} onClick={() => act('docx')}>{busy === 'docx' ? 'Building…' : 'Word'}</Btn>
              : <Btn pri disabled={!data || !!busy} onClick={() => act('xlsx')}>{busy === 'xlsx' ? 'Building…' : 'Excel'}</Btn>}</>}
        </div>
        {err && <div className="kp-banner">{err}</div>}
        {!data && !err && <div className="kp-card kp-empty">Preparing the document…</div>}
        {data && <div className="kp-scroll"><div className="kp-doc" ref={ref}>{sheets}</div></div>}
      </div>
    );
  }

  function Sheet({ kicker, title, children, foot, page }) {
    return (
      <section className="kp-sheet">
        <div className="kp-sh-head"><div><div className="k">{kicker}</div><h2>{title}</h2><div className="rule" /></div><img src="unico/logo.svg" alt="UNICO Hospitals" /></div>
        {children}
        <div className="kp-sh-foot"><span>{foot}</span><span>{page}</span></div>
      </section>
    );
  }
  /* A KPI's calculation for the whole report period: unit by unit (Σ over the months used), the
     months, and the checks with how each was settled. One A4 sheet per KPI. */
  function periodUnitsOf(row, months) {
    const by = new Map();
    months.forEach((m) => ((row.evidence && row.evidence[m] && row.evidence[m].units) || []).forEach((u) => {
      if (!by.has(u.key)) by.set(u.key, { key: u.key, name: u.name, num: 0, den: 0, hasNum: false, hasDen: false, used: 0, expected: false, sources: new Set(), approvers: new Set(), bad: false });
      const x = by.get(u.key);
      if (u.used) { if (K.has(u.num)) { x.num += Number(u.num); x.hasNum = true; } if (K.has(u.den)) { x.den += Number(u.den); x.hasDen = true; } x.used++; }
      x.expected = x.expected || !!u.expected;
      x.sources.add((EV_SRC[u.source] || [u.source])[0]);
      if (['missing', 'partial', 'den-zero', 'not-audited'].indexOf(u.source) >= 0 && u.expected) x.bad = true;
      if (u.submission) x.approvers.add(u.submission.reviewedBy || '—'); else if (u.overlayEdited) x.approvers.add('console: ' + (u.overlayEdited.by || 'not recorded'));
    }));
    return [...by.values()];
  }
  function CalcSheetBody({ row, months, acks }) {
    if (months.length === 1) {
      const ev = row.evidence && row.evidence[months[0]];
      return ev ? <EvidenceView def={row} ev={ev} acks={acks} compact /> : <div className="kp-muted">No calculation details.</div>;
    }
    const units = periodUnitsOf(row, months);
    const checks = [];
    months.forEach((m) => (((row.evidence || {})[m] || {}).checks || []).forEach((c) => { if (c.level !== 'info') checks.push(Object.assign({ ym: m }, c)); }));
    const ackOf = (c) => (acks || []).find((a) => a.key === [row.kpiId, c.ym, c.code, c.unit || ''].join('|'));
    const tf = row.formula !== 'count' && row.formula !== 'direct';
    return (
      <div className="kp-ev">
        <div className="kp-formula"><b>Formula:</b> {row.formulaText || '—'}</div>
        <ol className="kp-steps">
          {row.status === 'notstarted' ? <li>This KPI starts in {K.fmtMonth(row.startMonth)}; nothing before then is counted.</li> : null}
          {K.has(row.period.num) && K.has(row.period.den) ? <li>{months.length} months pooled: {(row.numLabel || 'numerator')} {K.round(row.period.num, 4)} ÷ {(row.denLabel || 'denominator')} {K.round(row.period.den, 4)} = <b>{K.fmt(row, row.period.value)}</b> — the months’ figures are added first and divided once.</li>
            : <li>Period value: <b>{K.fmt(row, row.period.value)}</b>{row.period.months ? ' (mean of ' + row.period.months + ' months)' : ''}.</li>}
          <li>Month by month: {months.map((m) => K.fmtMonth(m) + ' ' + K.fmt(row, (row.cells[m] || {}).value)).join(' · ')}.</li>
        </ol>
        {units.length > 0 && <table className="kp-evtbl"><thead><tr><th>Unit</th><th>Months used</th><th style={{ textAlign: 'right' }}>{row.numLabel || 'Numerator'}</th>{tf && <th style={{ textAlign: 'right' }}>{row.denLabel || 'Denominator'}</th>}<th style={{ textAlign: 'right' }}>Value</th><th>Source</th><th>Approved by</th></tr></thead>
          <tbody>{units.slice(0, 14).map((u) => <tr key={u.key} className={u.bad ? 'bad' : u.used ? '' : 'off'}><td><b>{u.name}</b>{u.expected ? <small>expected to report</small> : null}</td><td>{u.used} of {months.length}</td>
            <td className="n">{u.hasNum ? K.round(u.num, 4) : '—'}</td>{tf && <td className="n">{u.hasDen ? K.round(u.den, 4) : '—'}</td>}
            <td className="n"><b>{u.used && u.hasDen ? K.fmt(row, K.computeValue(row.formula, u.num, u.den)) : '—'}</b></td><td style={{ fontSize: 10.5 }}>{[...u.sources].join(', ')}</td><td style={{ fontSize: 10.5 }}>{[...u.approvers].join(', ') || '—'}</td></tr>)}</tbody></table>}
        {units.length > 14 && <div className="kp-muted">+ {units.length - 14} more units — every unit and month is in the Excel “Calculation” sheet.</div>}
        {checks.slice(0, 7).map((c, i) => { const a = ackOf(c); return <div key={i} className={'kp-check ' + c.level}><span className="tag">{K.fmtMonth(c.ym)}</span><div>{c.text}{a && <span className="ack">✔ Acknowledged by {a.byName || a.by}: “{a.reason}”</span>}</div></div>; })}
        {checks.length > 7 && <div className="kp-muted">+ {checks.length - 7} more on the Data quality page.</div>}
        {!checks.length && row.status !== 'notstarted' && <div className="kp-banner ok" style={{ padding: '7px 12px' }}>✓ Every check passed for this KPI in the period.</div>}
      </div>
    );
  }
  /* Finalise is blocked: every open error with its own "Acknowledge with reason" box. */
  function AckDialog({ id, items, meta, onClose, onDone, setRoute }) {
    const [reasons, setReasons] = useState({});
    const [done, setDone] = useState({});
    const [busy, setBusy] = useState('');
    const [err, setErr] = useState('');
    const left = items.filter((x) => !done[x.key]);
    async function ack(x) {
      setBusy(x.key); setErr('');
      try { await api('/api/kpi/report/' + id + '/ack', { method: 'PUT', body: JSON.stringify({ kpiId: x.kpiId, ym: x.ym, code: x.code, unit: x.unit, reason: reasons[x.key] || '' }) }); setDone((d) => Object.assign({}, d, { [x.key]: true })); }
      catch (e) { setErr(e.message); }
      setBusy('');
    }
    return (
      <div className="kp-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <div className="kp-dlg wide" role="dialog">
          <div className="kp-dlg-h"><div><h3>{left.length ? left.length + ' data error' + (left.length > 1 ? 's' : '') + ' before this report can be final' : 'Every error is settled'}</h3>
            <div className="kp-muted">Fix the data (the figures update by themselves), or — when the figure is right as it stands — acknowledge it with a reason. Every reason is printed on the report with your name.</div></div><button className="kp-x" onClick={onClose}>×</button></div>
          <div className="kp-dlg-b">
            {items.map((x) => {
              const meta2 = K.CHECK_META[x.code] || {};
              const ok = done[x.key];
              return (
                <div key={x.key} className={'kp-check ' + (ok ? 'info' : 'error')} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                  <div><b>{meta2.title || x.code}</b> · {K.fmtMonth(x.ym)} — {x.text}<span className="fix">{meta2.fix}</span></div>
                  {ok ? <span className="ack">✔ Acknowledged</span> : (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <input className="kp-in" style={{ flex: 1, minWidth: 220 }} placeholder="Reason (printed on the report) — e.g. CCU had no central lines in October" value={reasons[x.key] || ''} onChange={(e) => setReasons((r) => Object.assign({}, r, { [x.key]: e.target.value }))} />
                      <Btn pri disabled={busy === x.key || (reasons[x.key] || '').trim().length < 10} onClick={() => ack(x)}>Acknowledge</Btn>
                      <Btn onClick={() => { onClose(); setRoute({ view: 'kpiEntry', kpi: x.kpiId }); }}>Fix in Data Update</Btn>
                    </div>)}
                </div>
              );
            })}
            {err && <div className="kp-err">{err}</div>}
          </div>
          <div className="kp-dlg-f">{!left.length && <Btn pri onClick={onDone}>Finalise now</Btn>}<span style={{ flex: 1 }} /><Btn onClick={onClose}>Close</Btn></div>
        </div>
      </div>
    );
  }

  function ReportDoc({ meta, id, setRoute, showCalc }) {
    const [rep, setRep] = useState(null);
    const [err, setErr] = useState('');
    const [layout, setLayout] = useState(() => lsGet('kpi_layout') || 'full');
    const [busy, setBusy] = useState('');
    const [capturing, setCapturing] = useState(false);
    const [saveState, setSaveState] = useState('');
    const [tick, setTick] = useState(0);
    const [ackItems, setAckItems] = useState(null);
    const docRef = useRef(null);
    const pending = useRef({});
    const timer = useRef(null);
    const verRef = useRef(null);
    const calc = layout === 'calc' || !!showCalc;
    useEffect(() => { lsSet('kpi_layout', layout); }, [layout]);
    useEffect(() => {
      let live = true; setErr('');
      api('/api/kpi/report/' + id + (calc ? '?calc=1' : '')).then((j) => { if (!live) return; setRep(j.report); verRef.current = j.report.updatedAt; }).catch((e) => live && setErr(e.message));
      return () => { live = false; };
    }, [id, tick, calc]);
    const cfg = meta.config;
    const editable = rep && rep.state !== 'final' && meta.canEdit;
    const flush = useCallback(async () => {
      const body = pending.current; pending.current = {};
      if (!Object.keys(body).length) return;
      setSaveState('Saving…');
      try {
        const j = await api('/api/kpi/report/' + id, { method: 'PUT', body: JSON.stringify(Object.assign({}, body, verRef.current ? { baseUpdatedAt: verRef.current } : {})) });
        verRef.current = j.updatedAt; setSaveState('Saved'); setRep((r) => Object.assign({}, r, { stored: true, state: r.state === 'preview' ? 'draft' : r.state, updatedAt: j.updatedAt }));
      } catch (e) { setSaveState(''); toast(e.message, 'error'); if (e.status === 409) setTick((t) => t + 1); }
    }, [id]);
    const queue = (patch) => {
      Object.keys(patch).forEach((k) => { pending.current[k] = (patch[k] && typeof patch[k] === 'object') ? Object.assign({}, pending.current[k] || {}, patch[k]) : patch[k]; });
      setSaveState('Not saved yet…');
      clearTimeout(timer.current); timer.current = setTimeout(flush, 1100);
    };
    useEffect(() => () => { clearTimeout(timer.current); flush(); }, [flush]);
    const setComment = (k, v) => { setRep((r) => Object.assign({}, r, { commentary: Object.assign({}, r.commentary, { [k]: v }) })); queue({ commentary: { [k]: v } }); };
    const setOverall = (v) => { setRep((r) => Object.assign({}, r, { overall: v })); queue({ overall: v }); };
    const sig0 = sigNames();
    const sig = rep ? Object.assign({ prepared: sig0.prepared || '', reviewed: sig0.reviewed || '', recommended: sig0.recommended || '', approved: sig0.approved || '' }, Object.keys(rep.signoff || {}).length ? rep.signoff : {}) : {};
    const setSig = (k, v) => { setRep((r) => Object.assign({}, r, { signoff: Object.assign({}, sig, { [k]: v }) })); queue({ signoff: { [k]: v } }); };

    async function act(kind) {
      try {
        if (kind === 'refresh') { setBusy(kind); await api('/api/kpi/report', { method: 'POST', body: JSON.stringify({ from: rep.from, to: rep.to }) }); toast('Figures refreshed.', 'success'); setTick((t) => t + 1); }
        if (kind === 'finalize') {
          const ok = await confirmBox({ title: 'Finalise this report?', message: 'The figures of ' + K.fmtRange(rep.from, rep.to) + ' are frozen as they are now — later corrections will not change this report. Commentary and sign-off are locked too. An administrator can re-open it.', confirmLabel: 'Finalise' });
          if (!ok) return;
          setBusy(kind); await flush();
          try { await api('/api/kpi/report/' + id + '/finalize', { method: 'POST' }); }
          catch (e) { if (e.body && e.body.code === 'checks') { setAckItems(e.body.unresolved || []); setBusy(''); return; } throw e; }
          toast('Report finalised.', 'success'); refreshBadge(); setTick((t) => t + 1);
        }
        if (kind === 'reopen') {
          const ok = await confirmBox({ title: 'Re-open this report?', message: 'It becomes a draft again: its figures go live and can change. This is recorded in the activity log.', confirmLabel: 'Re-open', danger: true });
          if (!ok) return;
          setBusy(kind); await api('/api/kpi/report/' + id + '/reopen', { method: 'POST' }); toast('Re-opened.', 'success'); setTick((t) => t + 1);
        }
        if (kind === 'remove') {
          const ok = await confirmBox({ title: 'Remove this report?', message: 'The saved report for ' + K.fmtRange(rep.from, rep.to) + ' is removed from the list (kept in the history). The KPI figures are not touched.', confirmLabel: 'Remove', danger: true });
          if (!ok) return;
          setBusy(kind); await api('/api/kpi/report/' + id, { method: 'DELETE' }); toast('Removed.', 'success'); setRoute({ view: 'kpiReports' }); return;
        }
        if (kind.indexOf('pptx-') === 0) { setBusy(kind); await flush(); await download('/api/kpi/report/' + id + '/pptx?style=' + kind.slice(5)); toast('PowerPoint downloaded.', 'success'); }
        if (kind === 'xlsx') { setBusy(kind); await flush(); await download('/api/kpi/report/' + id + '/xlsx'); toast('Excel downloaded.', 'success'); }
        if (kind === 'print') { await flush(); printDoc(); }
        if (kind === 'pdf') { setBusy(kind); await flush(); await pdfDoc(); }
      } catch (e) { toast(e.message, 'error'); }
      setBusy('');
    }
    const title = (rep && rep.title) || cfg.reportTitle;
    const fileBase = 'Nursing-KPI-' + (rep ? (rep.from === rep.to ? rep.from : rep.from + '-to-' + rep.to) : '');
    // Print: the same sheets in their own window, logged by the server first.
    const printDoc = () => printSheets(() => docRef.current, title + ' — ' + K.fmtRange(rep.from, rep.to),
      () => api('/api/kpi/print', { method: 'POST', body: JSON.stringify({ id, kind: 'print', what: layout }) }), setCapturing);
    const pdfDoc = () => pdfSheets(() => docRef.current, title + ' — ' + K.fmtRange(rep.from, rep.to), fileBase,
      () => api('/api/kpi/print', { method: 'POST', body: JSON.stringify({ id, kind: 'pdf', what: layout }) }), setCapturing);

    if (err) return <div className="kp-wrap"><div className="kp-banner">{err}</div><div><Btn onClick={() => setRoute({ view: 'kpiReports' })}>‹ All reports</Btn></div></div>;
    if (!rep) return <div className="kp-card kp-empty">Preparing the report…</div>;
    const rows = rep.rows, sum = rep.summary;
    const period = K.fmtRange(rep.from, rep.to);
    const foot = title + ' · ' + period + ' · ' + (rep.state === 'final' ? 'Final' : 'Draft') + ' · ' + (cfg.hospitalName || '') + (rep.state === 'final' && rep.dataFingerprint ? ' · Data ' + String(rep.dataFingerprint).slice(7, 15) : '');
    const pillars = cfg.pillars.filter((pl) => rows.some((r) => r.pillar === pl.id));
    let page = 0;
    const pg = () => 'Page ' + (++page);
    const commentBox = (k, v, ph) => (editable && !capturing
      ? <div className="kp-comment"><textarea value={v || ''} placeholder={ph} onChange={(e) => (k === '__overall' ? setOverall(e.target.value) : setComment(k, e.target.value))} /></div>
      : (v ? <div className="kp-comment">{v}</div> : null));
    const months6 = rep.months.slice(-6);
    const flatCharts = true;
    return (
      <div className={'kp-wrap' + (capturing ? ' kp-capturing' : '')}>
        <div className="kp-card kp-bar" style={{ position: 'sticky', top: -22, zIndex: 5, boxShadow: '0 6px 22px rgba(13,27,46,.10)' }}>
          <Btn onClick={() => setRoute({ view: 'kpiReports' })}>‹ All reports</Btn>
          <b style={{ fontSize: 14 }}>{period}</b>
          <span className="kp-pill" style={rep.state === 'final' ? { background: '#e7f6ed', color: '#14713f' } : rep.state === 'draft' ? { background: '#fff1d6', color: '#8a5a00' } : { background: '#eef2f6', color: '#5b6878' }}>{rep.state === 'final' ? 'Final' : rep.state === 'draft' ? 'Draft · figures live' : 'Preview · not saved'}</span>
          {saveState && <span className="kp-muted">{saveState}</span>}
          <span style={{ flex: 1 }} />
          <div className="kp-chips"><button className={'kp-chip' + (layout === 'full' ? ' on' : '')} onClick={() => setLayout('full')} title="One page per KPI, like the deck">Detailed</button><button className={'kp-chip' + (layout === 'summary' ? ' on' : '')} onClick={() => setLayout('summary')} title="Scorecard and one page per pillar">Summary</button><button className={'kp-chip' + (layout === 'calc' ? ' on' : '')} onClick={() => setLayout('calc')} title="Detailed, plus how every figure was calculated (units, who sent and approved it) and the data checks">Detailed + calculations</button></div>
          {rep.state !== 'final' && (meta.canAdd || meta.canEdit) && <Btn disabled={!!busy} onClick={() => act('refresh')}>{rep.stored ? '↻ Refresh figures' : 'Save as draft'}</Btn>}
          {rep.state !== 'final' && meta.canEdit && <Btn pri disabled={!!busy} onClick={() => act('finalize')}>Finalise</Btn>}
          {rep.state === 'final' && meta.isAdmin && <Btn disabled={!!busy} onClick={() => act('reopen')}>Re-open</Btn>}
          {meta.canPrint && <>
            <Btn disabled={!!busy} onClick={() => act('print')}>Print</Btn>
            <Btn disabled={!!busy} onClick={() => act('pdf')}>{busy === 'pdf' ? 'Making PDF…' : 'PDF'}</Btn>
            <Btn disabled={!!busy} onClick={() => act('pptx-' + layout)} title={'PowerPoint — ' + (layout === 'full' ? 'full deck, one slide per KPI' : layout === 'calc' ? 'full deck with a calculation slide per KPI and the data checks' : 'summary deck')}>{busy.indexOf('pptx') === 0 ? 'Building…' : 'PowerPoint'}</Btn>
            <Btn disabled={!!busy} onClick={() => act('xlsx')}>{busy === 'xlsx' ? 'Building…' : 'Excel'}</Btn>
          </>}
          {rep.stored && meta.canDelete && (rep.state !== 'final' || meta.isAdmin) && <Btn danger disabled={!!busy} onClick={() => act('remove')}>Remove</Btn>}
        </div>
        {rep.state === 'preview' && <div className="kp-banner info">This is a preview. Press “Save as draft” (or start typing a comment) to keep it with its commentary and sign-off.</div>}
        {rep.state !== 'final' && rep.quality && rep.quality.unresolved.length > 0 && <div className="kp-banner"><span style={{ fontSize: 16 }}>⚑</span><div><b>{rep.quality.unresolved.length} data error{rep.quality.unresolved.length > 1 ? 's' : ''} must be fixed or acknowledged before this report can be final.</b> {meta.canEdit && <button onClick={() => setAckItems(rep.quality.unresolved)}>Review them</button>}</div></div>}
        {rep.state !== 'final' && rep.quality && !rep.quality.unresolved.length && <div className="kp-banner ok"><span style={{ fontSize: 16 }}>✓</span><div>All data checks are settled{rep.quality.acknowledged ? ' (' + rep.quality.acknowledged + ' acknowledged with a reason)' : ''}{rep.quality.warns ? ' · ' + rep.quality.warns + ' warning(s) are printed on the report' : ''}.</div></div>}
        {rep.state === 'final' && rep.changedSince && rep.changedSince.length > 0 && <div className="kp-banner info"><span style={{ fontSize: 16 }}>ⓘ</span><div><b>The source data has changed since this report was finalised</b> for: {rep.changedSince.map((x) => { const r = rows.find((y) => y.kpiId === x.kpiId); return (r ? r.code + ' ' + r.name : x.kpiId) + ' (' + K.fmtMonth(x.ym) + ')'; }).join(', ')}. This report still shows the figures as they were when it was finalised{rep.finalizedAt ? ' on ' + when(rep.finalizedAt) : ''}. An administrator can re-open it to bring them up to date.</div></div>}
        <div className="kp-scroll"><div className="kp-doc" ref={docRef}>
          {/* cover + summary */}
          <Sheet kicker={(rep.from === rep.to ? 'Monthly report' : 'Report') + ' · ' + period} title={title} foot={foot} page={pg()}>
            <div style={{ display: 'flex', gap: 14, marginBottom: 14, fontSize: 13, color: '#5b6878' }}>
              <span>{cfg.hospitalName}</span><span>·</span><span>{rep.cycle.label}{rep.cycle.monthNo ? ', month ' + rep.cycle.monthNo + ' of ' + rep.cycle.of : ''}</span><span>·</span><span>{rows.length} KPIs in {pillars.length} pillars</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '210px repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
              <div style={{ borderRadius: 14, padding: 12, background: 'linear-gradient(140deg,#00293A,#0c6f7d)', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <ScoreRing score={sum.score} size={104} flat />
                <div style={{ fontSize: 11, opacity: 0.85, textAlign: 'center', marginTop: 6 }}>{sum.scored ? sum.met + ' of ' + sum.scored + ' scored KPIs on target' : 'no scored KPIs'}</div></div>
              {[['met', sum.met], ['near', sum.near], ['off', sum.off], ['nodata', sum.nodata + sum.notarget + (sum.notstarted || 0) + (sum.notdue || 0)]].map(([k, n]) => (
                <div key={k} style={{ borderRadius: 14, padding: '14px 16px', background: ST[k].bg, border: '1px solid ' + ST[k].color + '55' }}>
                  <div style={{ fontSize: 36, fontWeight: 800, color: ST[k].color, lineHeight: 1 }}>{n}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: ST[k].ink, marginTop: 6 }}>{k === 'nodata' ? 'No data / no target' : ST[k].label}</div>
                  <div style={{ fontSize: 11, color: '#7b8796', marginTop: 4 }}>{rows.filter((r) => (k === 'nodata' ? r.status === 'nodata' || r.status === 'notarget' || r.status === 'notstarted' || r.status === 'notdue' : r.status === k)).map((r) => r.code).join(' · ')}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: 18 }}>
              <div><div className="kp-lab">Achievement against target (100 = on target)</div>
                <Iso3D items={rows.filter((r) => r.achievement != null).map((r) => ({ label: r.code || r.name, value: r.achievement, color: ST[r.status].color }))} max={150} refLine={100} refLabel="On target" height={250} flat={flatCharts} /></div>
              <div><div className="kp-lab">Status by pillar</div>
                <Iso3DStack height={250} flat={flatCharts} groups={pillars.map((pl) => { const c = K.summarize(rows.filter((r) => r.pillar === pl.id)); return { label: pl.label, parts: [{ value: c.met, color: ST.met.color, label: 'on target' }, { value: c.near, color: ST.near.color, label: 'close' }, { value: c.off, color: ST.off.color, label: 'need action' }, { value: c.nodata + c.notarget + (c.notstarted || 0) + (c.notdue || 0), color: ST.nodata.color, label: 'no data' }] }; })} /></div>
            </div>
            {/* the two lists a meeting starts with */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginTop: 14 }}>
              {[['off', 'Needs attention', rows.filter((r) => r.status === 'off' || r.status === 'near').sort((a, b) => (a.achievement == null ? 999 : a.achievement) - (b.achievement == null ? 999 : b.achievement))],
                ['met', 'On target', rows.filter((r) => r.status === 'met')]].map(([k, l, list]) => (
                <div key={k} style={{ borderRadius: 12, border: '1px solid ' + ST[k].color + '44', overflow: 'hidden' }}>
                  <div style={{ background: ST[k].bg, color: ST[k].ink, padding: '7px 12px', fontSize: 12, fontWeight: 800 }}>{l} · {list.length}</div>
                  <div style={{ padding: '6px 12px', fontSize: 11.5, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', columnGap: 14 }}>
                    {list.slice(0, 10).map((r) => <div key={r.kpiId} style={{ display: 'flex', gap: 6, padding: '3px 0', borderBottom: '1px dashed #e3e9f0' }}><b style={{ color: '#00293A', minWidth: 22 }}>{r.code}</b><span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span><b style={{ color: ST[r.status].color }}>{K.fmt(r, r.period.value)}</b></div>)}
                    {!list.length && <div style={{ color: '#7b8796', padding: '3px 0' }}>None this period.</div>}
                  </div>
                </div>
              ))}
            </div>
          </Sheet>
          {/* scorecard */}
          <Sheet kicker={period} title="KPI scorecard" foot={foot} page={pg()}>
            <table className="kp-stbl"><thead><tr><th>#</th><th style={{ textAlign: 'left' }}>KPI</th><th>Baseline</th><th>{rep.months.length > 1 ? 'Period' : 'Current'}</th><th>Target</th><th>Variance</th><th>Status</th><th>Trend</th><th>12 months</th></tr></thead>
              <tbody>{rows.map((r) => <tr key={r.kpiId}><td><b style={{ color: '#00293A' }}>{r.code}</b></td><td className="l">{r.name}</td>
                <td style={{ color: '#7b8796' }}>{r.baseline && K.has(r.baseline.value) ? K.fmt(r, r.baseline.value) : '—'}</td><td><b>{K.fmt(r, r.period.value)}</b><ResultTag r={r} /></td>
                <td>{r.target != null ? K.fmt(r, r.target) : '—'}</td><td style={{ fontSize: 11 }}>{K.gapLabel(r, r.period.value, r.target)}</td>
                <td style={{ background: ST[r.status].bg, color: ST[r.status].ink, fontWeight: 700 }}>{ST[r.status].label}</td><td><Trend d={r.trendDir} /></td><td><Spark row={r} w={96} h={22} /></td></tr>)}</tbody></table>
          </Sheet>
          {layout === 'summary' && pillars.map((pl) => {
            const list = rows.filter((r) => r.pillar === pl.id);
            return (
              <Sheet key={pl.id} kicker="Pillar" title={pl.label} foot={foot} page={pg()}>
                <table className="kp-stbl"><thead><tr><th>#</th><th style={{ textAlign: 'left' }}>KPI</th><th>Unit</th>{months6.map((m) => <th key={m}>{K.fmtMonth(m)}</th>)}<th>Period</th><th>Target</th><th>Status</th></tr></thead>
                  <tbody>{list.map((r) => <tr key={r.kpiId}><td><b style={{ color: '#00293A' }}>{r.code}</b></td><td className="l">{r.name}</td><td style={{ fontSize: 10, color: '#7b8796' }}>{r.unit}</td>
                    {months6.map((m) => <td key={m}>{(r.cells[m] || {}).source === 'not-due' ? <span style={{ color: '#b9c2cd' }}>·</span> : K.fmt(r, (r.cells[m] || {}).value, { bare: true })}</td>)}
                    <td><b>{K.fmt(r, r.period.value)}</b></td><td>{r.target != null ? K.fmt(r, r.target) : '—'}</td><td style={{ background: ST[r.status].bg, color: ST[r.status].ink, fontWeight: 700 }}>{ST[r.status].label}</td></tr>)}</tbody></table>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 10, marginTop: 14 }}>
                  {list.map((r) => ((editable && !capturing) || rep.commentary[r.kpiId]) ? <div key={r.kpiId}><div className="kp-lab">{r.code} {r.name} — comment</div>{commentBox(r.kpiId, rep.commentary[r.kpiId], 'What happened this period and what is being done')}</div> : null)}
                </div>
              </Sheet>
            );
          })}
          {(layout === 'full' || layout === 'calc') && pillars.map((pl) => rows.filter((r) => r.pillar === pl.id).map((r) => [
            <Sheet key={r.kpiId} kicker={pl.label} title={(r.code ? r.code + '. ' : '') + r.name} foot={foot} page={pg()}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 18 }}>
                <table className="kp-deck"><tbody>
                  <tr><th>Objective</th><td>{r.objective || '—'}</td></tr>
                  <tr><th>Current</th><td><b>{K.fmt(r, r.period.value)}</b> {K.unitKind(r) === 'num' ? r.unit : ''}{resultOf(r) ? <b style={{ color: '#3f3fa8' }}> — {resultOf(r)}</b> : null} <span style={{ color: '#7b8796' }}>(baseline {r.baseline && K.has(r.baseline.value) ? K.fmt(r, r.baseline.value) : 'not measured yet'})</span></td></tr>
                  <tr><th>Target</th><td>{(r.targets || []).length ? r.targets.map((t) => (r.targets.length > 1 ? 'Cycle ' + t.cycle + ': ' : '') + K.fmt(r, t.value)).join('  ·  ') : (r.target != null ? K.fmt(r, r.target) : 'Not set yet')}</td></tr>
                  <tr><th>Variance</th><td style={{ color: ST[r.status].color, fontWeight: 700 }}>{K.gapLabel(r, r.period.value, r.target)} · {ST[r.status].label}</td></tr>
                  <tr><th>Action plan</th><td>{(r.actions || []).length ? <ul>{r.actions.slice(0, 10).map((a) => <li key={a.id}>{a.text}{a.status !== 'open' ? <b style={{ color: a.status === 'done' ? '#1f9d57' : '#008FCB' }}> [{K.ACTION_LABEL[a.status]}]</b> : null}{a.owner ? <span style={{ color: '#7b8796' }}> — {a.owner}</span> : null}</li>)}{r.actions.length > 10 && <li style={{ color: '#7b8796' }}>+ {r.actions.length - 10} more</li>}</ul> : '—'}</td></tr>
                  <tr><th>Formula used</th><td style={{ fontStyle: 'italic' }}>{r.formulaText || '—'}</td></tr>
                  <tr><th>Tracking</th><td>{r.schedule || r.frequency || 'Monthly'}{r.trackingNote ? ' · ' + r.trackingNote : ''}{r.nextDue ? <span style={{ color: '#7b8796' }}> · next result {K.fmtMonthLong(r.nextDue)}</span> : null}</td></tr>
                  <tr><th>Remarks</th><td style={{ whiteSpace: 'pre-wrap', fontSize: 11 }}>{r.remarks || '—'}</td></tr>
                </tbody></table>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div className="kp-lab">{r.freqMonths > 1 ? 'Last 12 months · one point per period' : 'Last 12 months'}{r.unit ? ' · ' + r.unit : ''}</div>
                  <KpiChart row={r} kind="area" height={r.freqMonths > 1 ? 150 : 210} flat />
                  {r.freqMonths > 1 && <PeriodsTable row={r} />}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                    {[[K.fmt(r, r.period.value), resultOf(r) || (rep.months.length > 1 ? 'Period value' : 'This month'), '#00293A', '#eaf6fb'], [r.target != null ? K.fmt(r, r.target) : '—', 'Target', '#00293A', '#eef7f5'], [ST[r.status].label, r.achievement != null ? r.achievement + '% of target' : 'status', ST[r.status].color, ST[r.status].bg]].map(([b, s, c, bg], i) => (
                      <div key={i} style={{ background: bg, borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}><div style={{ fontSize: 17, fontWeight: 800, color: c }}>{b}</div><div style={{ fontSize: 10.5, color: '#7b8796' }}>{s}</div></div>))}
                  </div>
                  <div><div className="kp-lab">Comment for this period</div>{commentBox(r.kpiId, rep.commentary[r.kpiId], 'What happened this period, and what is being done') || <div className="kp-muted">—</div>}</div>
                </div>
              </div>
            </Sheet>,
            layout === 'calc' && r.evidence ? <Sheet key={r.kpiId + '-calc'} kicker={pl.label + ' · how it was calculated'} title={(r.code ? r.code + '. ' : '') + r.name} foot={foot} page={pg()}><CalcSheetBody row={r} months={rep.months} acks={rep.acks} /></Sheet> : null,
          ]))}
          {layout === 'calc' && rep.quality && (() => {
            // every check of the period, with its acknowledgement — 18 to a page
            const list = rep.quality.checks.filter((c) => c.level !== 'info');
            const pages = []; for (let i = 0; i < Math.max(list.length, 1); i += 18) pages.push(list.slice(i, i + 18));
            const codeOf = (id) => (rows.find((x) => x.kpiId === id) || {}).code || id;
            return pages.map((pgList, i) => (
              <Sheet key={'dq' + i} kicker={period + (pages.length > 1 ? ' · ' + (i + 1) + ' of ' + pages.length : '')} title="Data quality" foot={foot} page={pg()}>
                <div style={{ display: 'flex', gap: 12, marginBottom: 10, fontSize: 12.5, alignItems: 'center' }}>
                  <span className="kp-pill" style={{ background: '#fde4e8', color: '#a3172f' }}>{rep.quality.errors} error{rep.quality.errors === 1 ? '' : 's'}</span>
                  <span className="kp-pill" style={{ background: '#e7f6ed', color: '#14713f' }}>{rep.quality.acknowledged} acknowledged</span>
                  <span className="kp-pill" style={{ background: '#fff6e0', color: '#8a5a00' }}>{rep.quality.warns} warning{rep.quality.warns === 1 ? '' : 's'}</span>
                  {rep.dataFingerprint && <span className="kp-muted">Data fingerprint {String(rep.dataFingerprint).slice(7, 19)}</span>}
                </div>
                {pgList.length ? <table className="kp-stbl"><thead><tr><th>Level</th><th>KPI</th><th>Month</th><th style={{ textAlign: 'left' }}>What was found</th><th style={{ textAlign: 'left' }}>Acknowledged</th></tr></thead>
                  <tbody>{pgList.map((c) => <tr key={c.key}><td style={{ color: c.level === 'error' ? '#a3172f' : '#8a5a00', fontWeight: 700 }}>{c.level === 'error' ? 'Error' : 'Warning'}</td><td><b>{codeOf(c.kpiId)}</b></td><td>{K.fmtMonth(c.ym)}</td>
                    <td className="l" style={{ fontSize: 10.5 }}>{c.text}</td><td className="l" style={{ fontSize: 10.5, color: c.ack && c.ack.current ? '#14713f' : c.level === 'error' ? '#a3172f' : '#7b8796' }}>{c.ack ? (c.ack.current ? (c.ack.by + ': “' + c.ack.reason + '”') : 'given for older data — needs a new one') : (c.level === 'error' ? 'NOT RESOLVED' : '—')}</td></tr>)}</tbody></table>
                  : <div className="kp-banner ok">✓ Every figure in this report passed the data checks.</div>}
              </Sheet>
            ));
          })()}
          {/* summary & sign-off */}
          <Sheet kicker={period} title="Summary & sign-off" foot={foot} page={pg()}>
            <div className="kp-lab">Overall summary</div>
            {commentBox('__overall', rep.overall, 'The month in a few lines: what improved, what needs attention, decisions needed') || <ul style={{ fontSize: 13, lineHeight: 1.6 }}>
              <li>{sum.met} of {rows.length} KPIs on target{sum.met ? ': ' + rows.filter((r) => r.status === 'met').map((r) => r.code).join(', ') : ''}.</li>
              {sum.near > 0 && <li>{sum.near} close: {rows.filter((r) => r.status === 'near').map((r) => r.code + ' ' + r.name).join(', ')}.</li>}
              {sum.off > 0 && <li>{sum.off} need action: {rows.filter((r) => r.status === 'off').map((r) => r.code + ' ' + r.name).join(', ')}.</li>}
              {sum.nodata > 0 && <li>{sum.nodata} without figures for the period: {rows.filter((r) => r.status === 'nodata').map((r) => r.code).join(', ')}.</li>}</ul>}
            {(layout === 'full' || layout === 'calc') && (() => {
              const open = []; rows.forEach((r) => (r.actions || []).forEach((a) => { if (a.status === 'progress' || ((a.owner || a.due) && a.status === 'open')) open.push([r, a]); }));
              return open.length ? <div style={{ marginTop: 14 }}><div className="kp-lab">Action plans in progress</div>
                <table className="kp-stbl"><thead><tr><th>#</th><th style={{ textAlign: 'left' }}>Action</th><th>Owner</th><th>Due</th><th>Status</th></tr></thead>
                  <tbody>{open.slice(0, 12).map(([r, a]) => <tr key={r.kpiId + a.id}><td><b>{r.code}</b></td><td className="l">{a.text}</td><td>{a.owner || '—'}</td><td style={{ color: a.due && a.due < rep.to ? '#d23a52' : undefined }}>{a.due ? K.fmtMonth(a.due) : '—'}</td><td>{K.ACTION_LABEL[a.status]}</td></tr>)}</tbody></table></div> : null;
            })()}
            <div className="kp-signs" style={{ position: 'absolute', left: 52, right: 44, bottom: 64 }}>
              {[['prepared', 'Prepared by'], ['reviewed', 'Reviewed by'], ['recommended', 'Recommended by'], ['approved', 'Approved by']].map(([k, l]) => (
                <div key={k}><span>{l}</span>{editable && !capturing ? <input value={sig[k] || ''} onChange={(e) => setSig(k, e.target.value)} placeholder="Name" /> : (sig[k] || ' ')}</div>))}
            </div>
            <div style={{ position: 'absolute', left: 52, right: 44, bottom: 40, fontSize: 9, color: '#a3adba', textAlign: 'center' }}>Automatically generated by the system · Developed by Nasif Ahammed Niloy{rep.state === 'final' ? ' · Final — finalised by ' + (rep.finalizedBy || '—') + ' on ' + when(rep.finalizedAt) : ''}</div>
          </Sheet>
        </div></div>
        {ackItems && <AckDialog id={id} items={ackItems} meta={meta} setRoute={setRoute} onClose={() => { setAckItems(null); setTick((t) => t + 1); }} onDone={() => { setAckItems(null); act('finalize'); }} />}
      </div>
    );
  }

  /* ============================================================ manage KPIs === */
  const BLANK = { name: '', code: '', pillar: 'safety', objective: '', unit: '%', formula: 'pct', goalDirection: 'higher_is_better', decimals: '', formulaText: '', numLabel: '', denLabel: '', frequency: 'Monthly for 6 months & later for another 6 months', freqMonths: 1, cycleMonths: null, cycles: null, remarks: '', baseline: { value: '', note: '' }, targets: [], baselineTargetPct: '', source: { indId: null }, actions: [], autoFill: true, startMonth: '', units: [] };
  /* How often a KPI is measured and its cycles — an administrator's setting (the server ignores it
     from anyone else). Shared by the KPI editor; Settings → KPI schedule edits the same fields. */
  const CYCLE_CHOICES = [1, 2, 3, 4, 6, 9, 12, 18, 24];
  const cycleChoices = (f) => CYCLE_CHOICES.filter((n) => n % f === 0);
  // a new frequency drops an own cycle length that no longer holds whole periods
  const withFreq = (x, f) => Object.assign({}, x, { freqMonths: f, cycleMonths: x.cycleMonths && x.cycleMonths % f ? null : x.cycleMonths });
  function ScheduleBox({ d, setD, cfg, can, isAdmin }) {
    const f = K.freqOf(d);
    const set = (k, v) => setD((x) => Object.assign({}, x, { [k]: v }));
    return (
      <div className="kp-card kp-pad" style={{ boxShadow: 'none', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="kp-lab">Schedule — how often it is measured, and its cycles{!isAdmin && <span style={{ textTransform: 'none', fontWeight: 600, color: '#7b8796' }}> · set by an administrator (Settings → KPI schedule)</span>}</div>
        <div className="kp-row">
          <label className="kp-fld"><span className="kp-lab">Measured</span>
            <select className="kp-sel" value={f} disabled={!can} onChange={(e) => setD((x) => withFreq(x, +e.target.value))}>{K.FREQS.map((x) => <option key={x.m} value={x.m}>{x.label}</option>)}</select></label>
          <label className="kp-fld"><span className="kp-lab">Cycle length</span>
            <select className="kp-sel" value={d.cycleMonths || ''} disabled={!can} onChange={(e) => set('cycleMonths', e.target.value ? +e.target.value : null)}>
              <option value="">Same as all KPIs ({K.cycleCfg({ freqMonths: f }, cfg).cycleMonths} months)</option>
              {cycleChoices(f).map((n) => <option key={n} value={n}>{n} months</option>)}</select></label>
          <label className="kp-fld"><span className="kp-lab">Cycles</span>
            <select className="kp-sel" value={d.cycles || ''} disabled={!can} onChange={(e) => set('cycles', e.target.value ? +e.target.value : null)}>
              <option value="">Same as all KPIs ({K.cfgOf(cfg).cycles})</option>
              {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
        </div>
        <div className="kp-muted" style={{ fontSize: 11.5 }}>{K.scheduleText(d, cfg)}</div>
        {f > 1 && <div className="kp-muted" style={{ fontSize: 11.5 }}>One figure per period, entered in the period’s last month ({K.dueMonths(d, K.startOf(d, cfg), K.addMonth(K.startOf(d, cfg), 23), cfg).slice(0, 4).map(K.fmtMonth).join(', ')}…). The months between owe nothing.</div>}
      </div>
    );
  }

  function KpiEditor({ meta, def, onClose, onSaved }) {
    const cfg = meta.config;
    const isNew = !def;
    const [d, setD] = useState(() => JSON.parse(JSON.stringify(Object.assign({}, BLANK, def || { pillar: cfg.pillars[0].id }))));
    const [tab, setTab] = useState('basics');
    const [inds, setInds] = useState(null);
    const [q, setQ] = useState('');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const may = isNew ? (meta.canAdd || meta.canEdit) : meta.canEdit;
    const set = (k, v) => setD((x) => Object.assign({}, x, { [k]: v }));
    const [areas, setAreas] = useState(null);
    const [setupUnits, setSetupUnits] = useState(null);
    useEffect(() => { if ((tab === 'measure' || tab === 'units') && !inds) api('/api/kpi/indicators').then((j) => { setInds(j.indicators); setAreas(j.areas || []); }).catch(() => { setInds([]); setAreas([]); }); }, [tab]);
    // What Department Setup says (same rule as the collectors' Missing-data page), for comparison.
    useEffect(() => {
      if (tab !== 'units' || !(d.source && d.source.indId)) return;
      const qs = def && def.id && def.source && def.source.indId === d.source.indId ? 'kpi=' + encodeURIComponent(def.id) : 'indId=' + encodeURIComponent(d.source.indId) + '&indName=' + encodeURIComponent(d.source.indName || '') + '&rule=' + encodeURIComponent(d.source.rule || '');
      setSetupUnits(null);
      api('/api/kpi/units?' + qs).then((j) => setSetupUnits(j.units)).catch(() => setSetupUnits([]));
    }, [tab, d.source && d.source.indId]);
    const tgt = (c) => { const t = (d.targets || []).find((x) => x.cycle === c); return t ? String(t.value) : ''; };
    const setTgt = (c, v) => set('targets', (d.targets || []).filter((x) => x.cycle !== c).concat(v === '' ? [] : [{ cycle: c, value: v }]).sort((a, b) => a.cycle - b.cycle));
    const setAct = (i, k, v) => set('actions', d.actions.map((a, j) => (j === i ? Object.assign({}, a, { [k]: v }) : a)));
    const moveAct = (i, n) => { const a = d.actions.slice(); const [x] = a.splice(i, 1); a.splice(i + n, 0, x); set('actions', a); };
    async function save() {
      if (!String(d.name || '').trim()) { setTab('basics'); setErr('Give the KPI a name.'); return; }
      setBusy(true); setErr('');
      const body = Object.assign({}, d, { startMonth: K.isMonth(d.startMonth) ? d.startMonth : null, units: Array.isArray(d.units) ? d.units : [], baseline: { value: d.baseline && d.baseline.value !== '' ? d.baseline.value : null, note: (d.baseline && d.baseline.note) || '' }, decimals: d.decimals === '' ? null : d.decimals, baselineTargetPct: d.baselineTargetPct === '' ? null : d.baselineTargetPct, baseUpdatedAt: isNew ? undefined : def.updatedAt });
      try {
        const j = isNew ? await api('/api/kpi/defs', { method: 'POST', body: JSON.stringify(body) }) : await api('/api/kpi/defs/' + encodeURIComponent(def.id), { method: 'PUT', body: JSON.stringify(body) });
        toast(isNew ? 'KPI added.' : 'Saved.', 'success'); onSaved(j.def);
      } catch (e) { setErr(e.message); setBusy(false); }
    }
    const linked = d.source && d.source.indId;
    const shownInds = (inds || []).filter((i) => !q || (i.name + ' ' + i.id).toLowerCase().indexOf(q.toLowerCase()) >= 0).slice(0, 60);
    const fld = (label, el, hint) => <label className="kp-fld"><span className="kp-lab">{label}</span>{el}{hint && <span className="hint">{hint}</span>}</label>;
    return (
      <div className="kp-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <div className="kp-dlg wide" role="dialog">
          <div className="kp-dlg-h"><div><h3>{isNew ? 'Add a KPI' : (d.code ? d.code + '. ' : '') + d.name}</h3><div className="kp-muted">{isNew ? 'A KPI of your own — typed monthly, or linked to a quality indicator so its months fill themselves.' : 'Every field of the KPI deck. Changes apply to the dashboard and to draft reports; final reports keep what they had.'}</div></div><button className="kp-x" onClick={onClose}>×</button></div>
          <div className="kp-tabs">{[['basics', 'Basics'], ['measure', 'Measure & data'], ['units', 'Units expected' + (d.units && d.units.length ? ' (' + d.units.length + ')' : '')], ['targets', 'Baseline & targets'], ['actions', 'Action plan (' + d.actions.length + ')'], ['remarks', 'Remarks']].map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
          <div className="kp-dlg-b" style={{ minHeight: 330 }}>
            {tab === 'basics' && <>
              <div className="kp-row">
                {fld('Name', <input className="kp-in" value={d.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. IV Cannula Phlebitis" disabled={!may} />)}
                <div style={{ flex: '0 0 110px', minWidth: 90 }}>{fld('Code', <input className="kp-in" value={d.code} maxLength={8} onChange={(e) => set('code', e.target.value)} placeholder="1I" disabled={!may} />)}</div>
              </div>
              {fld('Pillar', <div className="kp-chips">{cfg.pillars.map((pl) => <button key={pl.id} disabled={!may} className={'kp-chip' + (d.pillar === pl.id ? ' on' : '')} style={d.pillar === pl.id ? { background: pl.color, borderColor: pl.color } : undefined} onClick={() => set('pillar', pl.id)}>{pl.label}</button>)}</div>)}
              {fld('Objective', <textarea className="kp-in" rows={3} value={d.objective} onChange={(e) => set('objective', e.target.value)} placeholder="To reduce … / To improve …" disabled={!may} />)}
              <div className="kp-row" style={{ alignItems: 'flex-end' }}>
                {fld('This KPI starts on', <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="month" className="kp-in" value={d.startMonth || ''} disabled={!may} onChange={(e) => set('startMonth', e.target.value)} />{d.startMonth && may ? <button className="kp-icon-btn" onClick={() => set('startMonth', '')}>Same as all KPIs</button> : null}</div>,
                  d.startMonth ? 'Counting starts ' + K.fmtMonthLong(d.startMonth) + ': cycles and targets count from here; earlier months are not counted and are never “missing”.' : 'Blank = the same as all KPIs (' + K.fmtMonthLong(cfg.cycleStart) + ', set in Settings).')}
              </div>
              <ScheduleBox d={d} setD={setD} cfg={cfg} can={may && meta.isAdmin} isAdmin={meta.isAdmin} />
            </>}
            {tab === 'units' && <>
              {!linked ? <div className="kp-banner info">This KPI is typed monthly, so it has no reporting units. Link it to a quality indicator (Measure & data) to check which units report it.</div> : <>
                <div className="kp-muted">The units that must send <b>{d.source.indName || d.source.indId}</b> each month. A unit on this list with no figure is a <b>data error</b> on the report until it is fixed or acknowledged.</div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <label className={'kp-switch light' + (d.units && d.units.length ? '' : ' on')} onClick={() => may && set('units', d.units && d.units.length ? [] : (setupUnits || []).map((u) => u.key))}>
                    <i /><span>{d.units && d.units.length ? 'My own list (tick the units below)' : 'Follow Department Setup automatically'}</span></label>
                  {may && <Btn onClick={() => set('units', (setupUnits || []).map((u) => u.key))} disabled={!setupUnits}>Fill from Department Setup</Btn>}
                </div>
                {(() => {
                  const mine = new Set(d.units || []);
                  const setupKeys = new Set((setupUnits || []).map((u) => u.key));
                  const own = (d.units || []).length > 0;
                  const extra = own ? [...mine].filter((k) => setupUnits && !setupKeys.has(k)) : [];
                  const missing = own ? (setupUnits || []).filter((u) => !mine.has(u.key)) : [];
                  return <>
                    {own && setupUnits && (extra.length || missing.length) ? <div className="kp-banner">Differs from Department Setup — {missing.length ? 'Setup also expects: ' + missing.map((u) => u.name).join(', ') + '. ' : ''}{extra.length ? 'Not due per Setup: ' + extra.map((k) => ((areas || []).find((a) => a.key === k) || {}).name || k).join(', ') + '.' : ''} The report will show this as a warning.</div> : null}
                    {!own && <div className="kp-banner ok">Following Department Setup: {setupUnits == null ? 'checking…' : setupUnits.length ? setupUnits.map((u) => u.name).join(', ') : 'no unit is due for this indicator'}.</div>}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 6 }}>
                      {(areas || []).map((a) => {
                        const on = own ? mine.has(a.key) : setupKeys.has(a.key);
                        return <label key={a.key} style={{ display: 'flex', gap: 7, alignItems: 'center', padding: '6px 9px', borderRadius: 8, border: '1px solid ' + (on ? '#9fdcc0' : 'var(--line)'), background: on ? '#effaf4' : '#fff', fontSize: 12.5, cursor: may && own ? 'pointer' : 'default', opacity: own ? 1 : 0.8 }}>
                          <input type="checkbox" style={{ width: 'auto' }} checked={on} disabled={!may || !own} onChange={(e) => set('units', e.target.checked ? (d.units || []).concat([a.key]) : (d.units || []).filter((k) => k !== a.key))} />
                          <span style={{ flex: 1 }}>{a.name}{a.hospital ? ' (hospital)' : ''}</span>{setupKeys.has(a.key) && <span className="kp-src" style={{ background: '#e1f1fa', color: '#0b4f6c' }}>Setup</span>}</label>;
                      })}
                    </div>
                  </>;
                })()}
              </>}
            </>}
            {tab === 'measure' && <>
              <div className="kp-card kp-pad" style={{ background: linked ? '#ecfaf7' : '#f6f9fc', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><b style={{ fontSize: 13 }}>Where the monthly figures come from</b><span style={{ flex: 1 }} />
                  {linked && may && <Btn onClick={() => set('source', { indId: null })}>Unlink — type them monthly</Btn>}</div>
                {linked && <label className={'kp-switch light' + (d.autoFill !== false ? ' on' : '')} onClick={() => may && set('autoFill', d.autoFill === false)}><i /><span>{d.autoFill !== false ? 'Auto-fill from the quality data: ON' : 'Auto-fill from the quality data: OFF — typed monthly, the system figure is shown as a hint'}</span></label>}
                {linked ? <div style={{ fontSize: 12.5 }}>{d.autoFill !== false ? 'Filled automatically from' : 'Linked (for reference) to'} the quality indicator <b>{d.source.indName || d.source.indId}</b>{d.source.rule ? ' (' + ({ hh: 'hand hygiene audit', fall: 'all units, out-patient falls left out', pool: 'all units pooled', hospital: 'Overall Hospital', docaudit: 'the Documentation Audit module — Σ Yes ÷ Σ Yes + No over every completed audit' })[d.source.rule] + ')' : ''}. {d.autoFill !== false ? 'Any month can still be typed over in Data Update — with a reason.' : 'Each month is typed in Data Update.'}</div>
                  : <div style={{ fontSize: 12.5 }}>Typed each month in Data Update. Or link it to a quality indicator the units already report:</div>}
                {may && <><input className="kp-in" placeholder="Search the quality indicators…" value={q} onChange={(e) => setQ(e.target.value)} />
                  <div style={{ maxHeight: 170, overflow: 'auto', border: '1px solid var(--line)', borderRadius: 8, background: '#fff' }}>
                    {!inds && <div className="kp-muted" style={{ padding: 10 }}>Loading the indicators…</div>}
                    {shownInds.map((i) => <div key={i.id} onClick={() => setD((x) => Object.assign({}, x, { source: { indId: i.id, indName: i.name, rule: null } }, x.formulaText ? {} : { formula: K.FORMULAS.indexOf(i.formula) >= 0 ? i.formula : x.formula, unit: i.unit || x.unit }))}
                      style={{ padding: '7px 10px', borderBottom: '1px solid var(--line-2)', cursor: 'pointer', fontSize: 12.5, background: linked === i.id ? '#dff5f1' : undefined }}>
                      <b>{i.name}</b> <span className="kp-muted">· {i.hospital ? 'Overall Hospital' : i.areas.length + ' unit(s)'} · {i.formula || '—'}</span></div>)}
                  </div></>}
              </div>
              <div className="kp-row">
                {fld('How it is calculated', <select className="kp-sel" value={d.formula} disabled={!may} onChange={(e) => set('formula', e.target.value)}>{K.FORMULAS.map((f) => <option key={f} value={f}>{K.FORMULA_LABEL[f]}</option>)}</select>)}
                {fld('Unit', <input className="kp-in" value={d.unit} disabled={!may} onChange={(e) => set('unit', e.target.value)} placeholder="% · per 1000 patient-days · minutes · BDT per patient-day" />)}
              </div>
              <div className="kp-row">
                {fld('Better when', <div className="kp-chips"><button disabled={!may} className={'kp-chip' + (d.goalDirection === 'higher_is_better' ? ' on' : '')} onClick={() => set('goalDirection', 'higher_is_better')}>▲ Higher</button><button disabled={!may} className={'kp-chip' + (d.goalDirection === 'lower_is_better' ? ' on' : '')} onClick={() => set('goalDirection', 'lower_is_better')}>▼ Lower</button></div>)}
                {fld('Decimals', <select className="kp-sel" value={d.decimals == null ? '' : d.decimals} disabled={!may} onChange={(e) => set('decimals', e.target.value === '' ? '' : +e.target.value)}><option value="">Automatic</option>{[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}</select>)}
              </div>
              {d.formula !== 'direct' && <div className="kp-row">
                {fld('Numerator — what is counted', <input className="kp-in" value={d.numLabel} disabled={!may} onChange={(e) => set('numLabel', e.target.value)} placeholder="e.g. Number of patient falls" />)}
                {d.formula !== 'count' && fld('Denominator — counted against', <input className="kp-in" value={d.denLabel} disabled={!may} onChange={(e) => set('denLabel', e.target.value)} placeholder="e.g. Patient-days" />)}
              </div>}
              {fld('Formula as written on the report', <input className="kp-in" value={d.formulaText} disabled={!may} onChange={(e) => set('formulaText', e.target.value)} placeholder="(Number of patient falls ÷ Patient-days) × 1000" />)}
            </>}
            {tab === 'targets' && <>
              <div className="kp-row">
                {fld('Baseline (the deck’s “Current”)', <input className="kp-in" inputMode="decimal" value={d.baseline && d.baseline.value != null ? d.baseline.value : ''} disabled={!may} onChange={(e) => set('baseline', Object.assign({}, d.baseline, { value: e.target.value.replace(/[^0-9.\-]/g, '') }))} placeholder="Not measured yet" />)}
                {fld('Where the baseline comes from', <input className="kp-in" value={(d.baseline && d.baseline.note) || ''} disabled={!may} onChange={(e) => set('baseline', Object.assign({}, d.baseline, { note: e.target.value }))} placeholder="e.g. Survey Aug 2026" />)}
              </div>
              <div className="kp-card kp-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <b style={{ fontSize: 13 }}>Target per cycle</b>
                <div className="kp-muted">This KPI runs {K.cycleCfg(d, cfg).cycles} cycle(s) of {K.cycleCfg(d, cfg).cycleMonths} months from {K.fmtMonth(K.startOf(d, cfg))}{K.cycleCfg(d, cfg).own ? ' (its own cycles)' : ''}. A cycle left empty keeps the previous cycle's target.</div>
                <div className="kp-row">{Array.from({ length: K.cycleCfg(d, cfg).cycles }, (_, i) => i + 1).map((c) => { const r = K.cycleRange(c, cfg, d); return fld('Cycle ' + c + ' · ' + K.fmtRange(r.from, r.to), <input className="kp-in" inputMode="decimal" value={tgt(c)} disabled={!may} onChange={(e) => setTgt(c, e.target.value.replace(/[^0-9.\-]/g, ''))} placeholder={c > 1 && tgt(c - 1) ? 'same as cycle ' + (c - 1) : 'Not set'} />); })}</div>
                <div className="kp-row" style={{ alignItems: 'flex-end' }}>
                  {fld('Or: a target relative to the baseline (%)', <input className="kp-in" inputMode="decimal" value={d.baselineTargetPct == null ? '' : d.baselineTargetPct} disabled={!may} onChange={(e) => set('baselineTargetPct', e.target.value.replace(/[^0-9.\-]/g, ''))} placeholder="e.g. -5 = 5% below the baseline" />, 'Used only when no cycle target is set (Consumables: 5% below the existing cost).')}
                </div>
              </div>
            </>}
            {tab === 'actions' && <>
              <div className="kp-muted">Each point of the action plan, with who owns it, by when, and how far it has got. The Action Plans board shows them all.</div>
              {d.actions.map((a, i) => (
                <div key={a.id || i} className="kp-card kp-pad" style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <textarea className="kp-in" rows={2} value={a.text} disabled={!may} onChange={(e) => setAct(i, 'text', e.target.value)} placeholder="What will be done" />
                    {may && <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}><button className="kp-icon-btn" disabled={i === 0} onClick={() => moveAct(i, -1)}>↑</button><button className="kp-icon-btn" disabled={i === d.actions.length - 1} onClick={() => moveAct(i, 1)}>↓</button><button className="kp-icon-btn" onClick={() => set('actions', d.actions.filter((_, j) => j !== i))} title="Remove">✕</button></div>}
                  </div>
                  <div className="kp-row">
                    <input className="kp-in" value={a.owner || ''} disabled={!may} onChange={(e) => setAct(i, 'owner', e.target.value)} placeholder="Owner — e.g. IC Nurse" />
                    <input type="month" className="kp-in" value={a.due || ''} disabled={!may} onChange={(e) => setAct(i, 'due', e.target.value)} title="Due month" />
                    <select className="kp-sel" value={a.status || 'open'} disabled={!may} onChange={(e) => setAct(i, 'status', e.target.value)}>{K.ACTION_STATUSES.map((s) => <option key={s} value={s}>{K.ACTION_LABEL[s]}</option>)}</select>
                  </div>
                </div>
              ))}
              {may && <div><Btn onClick={() => set('actions', d.actions.concat([{ id: '', text: '', owner: '', due: '', status: 'open', note: '' }]))}>+ Add an action</Btn></div>}
            </>}
            {tab === 'remarks' && <>
              {fld('Tracking note (optional)', <input className="kp-in" value={K.trackingNote(d)} disabled={!may} onChange={(e) => set('frequency', e.target.value)} placeholder="e.g. survey in the first week of the period's last month" />,
                'Documents print the schedule (Basics → Schedule: ' + K.freqLabel(d, true).toLowerCase() + '); a note here is added after it.')}
              {fld('Remarks', <textarea className="kp-in" rows={9} value={d.remarks} disabled={!may} onChange={(e) => set('remarks', e.target.value)} placeholder="Anything readers of the report should know. One point per line shows as a list." />, 'Shown on the KPI page of every report and in the deck (long remarks get a notes slide).')}
            </>}
            {err && <div className="kp-err">{err}</div>}
          </div>
          <div className="kp-dlg-f">{may && <Btn pri disabled={busy} onClick={save}>{busy ? 'Saving…' : isNew ? 'Add KPI' : 'Save changes'}</Btn>}<span style={{ flex: 1 }} /><Btn onClick={onClose}>{may ? 'Cancel' : 'Close'}</Btn></div>
        </div>
      </div>
    );
  }

  function ManageKpis({ meta, defs, reload }) {
    const [edit, setEdit] = useState(null);
    const [archived, setArchived] = useState(false);
    const [busy, setBusy] = useState(false);
    const cfg = meta.config;
    const list = defs.filter((d) => archived || (d.active !== false && !d.removedAt));
    const groups = cfg.pillars.map((pl) => ({ pl, list: list.filter((d) => d.pillar === pl.id) })).filter((g) => g.list.length);
    const activeIds = defs.filter((d) => d.active !== false && !d.removedAt).map((d) => d.id);   // order list: enabled + disabled
    const liveN = defs.filter(K.isLive).length, offN = activeIds.length - liveN;
    async function setEnabled(d, enabled) {
      if (!enabled) {
        const ok = await confirmBox({ title: 'Disable “' + d.name + '”?', message: 'It stays here on Manage KPIs but leaves the dashboard, Data Update, new reports, exports and the missing-data badge. Its saved figures and final reports are kept. Switch it on again at any time.', confirmLabel: 'Disable' });
        if (!ok) return;
      }
      try { await api('/api/kpi/defs/' + encodeURIComponent(d.id) + '/enabled', { method: 'POST', body: JSON.stringify({ enabled }) }); toast(d.name + (enabled ? ' enabled.' : ' disabled.'), 'success'); refreshBadge(); reload(); } catch (e) { toast(e.message, 'error'); }
    }
    async function move(id, n) {
      const ids = activeIds.slice(); const i = ids.indexOf(id); if (i < 0 || i + n < 0 || i + n >= ids.length) return;
      ids.splice(i, 1); ids.splice(i + n, 0, id);
      try { await api('/api/kpi/defs-order', { method: 'POST', body: JSON.stringify({ ids }) }); reload(); } catch (e) { toast(e.message, 'error'); }
    }
    async function archive(d) {
      const ok = await confirmBox({ title: 'Archive “' + d.name + '”?', message: 'It leaves the dashboard, data entry and new reports. Its figures and the reports that already include it are kept, and it can be restored at any time.', confirmLabel: 'Archive', danger: true });
      if (!ok) return;
      try { await api('/api/kpi/defs/' + encodeURIComponent(d.id), { method: 'DELETE' }); toast('Archived.', 'success'); reload(); } catch (e) { toast(e.message, 'error'); }
    }
    async function restore(d) { try { await api('/api/kpi/defs/' + encodeURIComponent(d.id) + '/restore', { method: 'POST' }); toast('Restored.', 'success'); reload(); } catch (e) { toast(e.message, 'error'); } }
    async function reseed() {
      setBusy(true);
      try { const j = await api('/api/kpi/seed', { method: 'POST' }); toast(j.added ? j.added + ' deck KPI(s) put back.' : 'Every deck KPI is already here.', 'success'); reload(); } catch (e) { toast(e.message, 'error'); }
      setBusy(false);
    }
    return (
      <div className="kp-wrap">
        <div className="kp-card kp-bar">
          <b style={{ fontSize: 14 }}>{liveN} KPIs</b>{offN > 0 && <span className="kp-pill" style={{ background: '#f1f2f4', color: '#5b6573' }}>{offN} disabled</span>}<span className="kp-muted">in {groups.length} pillars · from the Nursing Department KPI deck{defs.some((d) => d.custom) ? ' and your own' : ''}</span>
          <span style={{ flex: 1 }} />
          <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}><input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} style={{ width: 'auto' }} />Show archived</label>
          {meta.isAdmin && <Btn disabled={busy} onClick={reseed} title="Put back any KPI of the deck that is missing">Restore deck KPIs</Btn>}
          {(meta.canAdd || meta.canEdit) && <Btn pri onClick={() => setEdit({ def: null })}>+ Add custom KPI</Btn>}
        </div>
        {groups.map((g) => (
          <div key={g.pl.id} className="kp-card kp-rise">
            <div className="kp-h" style={{ borderLeft: '5px solid ' + g.pl.color }}><h3>{g.pl.label}</h3><span className="kp-muted">{g.list.length}</span></div>
            <div className="kp-grid3 kp-pad">{g.list.map((d) => {
              const off = d.active === false || d.removedAt, dis = !off && !!d.disabled;
              const i = activeIds.indexOf(d.id);
              return (
                <div key={d.id} className="kp-card kp-pad" style={{ display: 'flex', flexDirection: 'column', gap: 7, opacity: off ? 0.55 : 1, background: dis ? '#f6f7f9' : undefined }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}><span className="kp-code" style={{ background: g.pl.color }}>{d.code || '•'}</span>
                    <div style={{ flex: 1, minWidth: 0, opacity: dis ? 0.6 : 1 }}><div style={{ fontWeight: 800, color: 'var(--ink)', lineHeight: 1.25 }}>{d.name}</div><div className="kp-muted" style={{ fontSize: 11 }}>{d.unit} · {d.goalDirection === 'lower_is_better' ? 'lower is better' : 'higher is better'}</div></div>
                    {d.custom && <span className="kp-src" style={{ background: '#ebebfb', color: '#3f3fa8' }}>Custom</span>}
                    {!off && meta.canEdit && <label className={'kp-switch light' + (dis ? '' : ' on')} title={dis ? 'Disabled — click to enable this KPI again' : 'Enabled — click to disable (it stays here but is not counted anywhere)'} onClick={() => setEnabled(d, dis)} style={{ flexDirection: 'column', gap: 2, fontSize: 9.5, color: dis ? '#7a8494' : '#1f7a4c' }}><i /><span>{dis ? 'OFF' : 'ON'}</span></label>}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 11.5, opacity: dis ? 0.6 : 1 }}>
                    {dis && <span className="kp-pill" style={{ background: '#e9ebef', color: '#4a5463' }}>Disabled — not counted</span>}
                    <span className="kp-pill" style={{ background: '#f3f5f8', color: '#3a4656' }}>Baseline {d.baseline && K.has(d.baseline.value) ? K.fmt(d, d.baseline.value) : '—'}</span>
                    <span className="kp-pill" style={{ background: '#eef7f5', color: '#0d5e55' }}>Target {(d.targets || []).length ? d.targets.map((t) => K.fmt(d, t.value)).join(' → ') : (K.has(d.baselineTargetPct) ? d.baselineTargetPct + '% vs baseline' : '—')}</span>
                    <span className="kp-pill" style={d.source && d.source.indId && d.autoFill !== false ? { background: '#e1f1fa', color: '#0b4f6c' } : { background: '#ebebfb', color: '#3f3fa8' }}>{d.source && d.source.indId ? (d.autoFill !== false ? 'Auto from quality' : 'Typed (auto-fill off)') : 'Typed monthly'}</span>
                    {d.startMonth && <span className="kp-pill" style={{ background: '#f3f5f8', color: '#3a4656' }}>Starts {K.fmtMonth(d.startMonth)}</span>}
                    {K.freqOf(d) > 1 && <span className="kp-pill" style={{ background: '#ebebfb', color: '#3f3fa8' }}>{K.freqLabel(d, true)}</span>}
                    {K.cycleCfg(d, cfg).own && <span className="kp-pill" style={{ background: '#ebebfb', color: '#3f3fa8' }}>{K.cycleCfg(d, cfg).cycles} × {K.cycleCfg(d, cfg).cycleMonths}-month cycles</span>}
                    {d.units && d.units.length > 0 && <span className="kp-pill" style={{ background: '#effaf4', color: '#14713f' }}>{d.units.length} unit(s) expected</span>}
                    <span className="kp-pill" style={{ background: '#fff6e0', color: '#8a5a00' }}>{(d.actions || []).length} actions</span>
                  </div>
                  <div style={{ display: 'flex', gap: 5, marginTop: 'auto' }}>
                    <Btn onClick={() => setEdit({ def: d })}>{meta.canEdit ? 'Edit' : 'Open'}</Btn>
                    {!off && meta.canEdit && <><button className="kp-icon-btn" disabled={i <= 0} onClick={() => move(d.id, -1)} title="Move up">↑</button><button className="kp-icon-btn" disabled={i >= activeIds.length - 1} onClick={() => move(d.id, 1)} title="Move down">↓</button></>}
                    <span style={{ flex: 1 }} />
                    {!off && meta.canDelete && <Btn danger onClick={() => archive(d)}>Archive</Btn>}
                    {off && meta.canEdit && <Btn onClick={() => restore(d)}>Restore</Btn>}
                  </div>
                </div>
              );
            })}</div>
          </div>
        ))}
        {edit && <KpiEditor meta={meta} def={edit.def} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); refreshBadge(); }} />}
      </div>
    );
  }

  /* =========================================================== action plans === */
  function ActionBoard({ meta, defs, reload, focusKpi }) {
    const [f, setF] = useState(focusKpi || '');
    const [q, setQ] = useState('');
    const [busy, setBusy] = useState('');
    const [assigned, setAssigned] = useState(() => !!lsGet('kpi_assigned_only'));
    useEffect(() => { lsSet('kpi_assigned_only', assigned); }, [assigned]);
    const cfg = meta.config;
    const active = defs.filter(K.isLive);
    const items = [];
    active.forEach((d) => (d.actions || []).forEach((a) => {
      if (assigned && !(a.owner || a.due || (a.status && a.status !== 'open'))) return;
      if ((!f || d.id === f) && (!q || (a.text + ' ' + (a.owner || '')).toLowerCase().indexOf(q.toLowerCase()) >= 0)) items.push({ d, a });
    }));
    async function setStatus(d, a, patch) {
      setBusy(d.id + a.id);
      try {
        await api('/api/kpi/defs/' + encodeURIComponent(d.id), { method: 'PUT', body: JSON.stringify({ baseUpdatedAt: d.updatedAt, actions: d.actions.map((x) => (x.id === a.id ? Object.assign({}, x, patch) : x)) }) });
        reload();
      } catch (e) { toast(e.message, 'error'); if (e.status === 409) reload(); }
      setBusy('');
    }
    const total = (s) => items.filter((x) => (x.a.status || 'open') === s).length;
    const overdue = items.filter((x) => x.a.due && x.a.due < meta.thisMonth && x.a.status !== 'done' && x.a.status !== 'dropped').length;
    const COLS = [['open', '#7b8796'], ['progress', '#008FCB'], ['done', '#1f9d57'], ['dropped', '#a3adba']];
    return (
      <div className="kp-wrap">
        <div className="kp-card kp-bar">
          <select className="kp-sel" value={f} onChange={(e) => setF(e.target.value)} style={{ maxWidth: 320 }}><option value="">All KPIs</option>{active.map((d) => <option key={d.id} value={d.id}>{d.code} {d.name}</option>)}</select>
          <input className="kp-in" placeholder="Search actions or owners…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 210 }} />
          <label title="Hide the actions nobody has picked up yet (no owner, no due date, not started)" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}><input type="checkbox" checked={assigned} onChange={(e) => setAssigned(e.target.checked)} style={{ width: 'auto' }} />Assigned only</label>
          <span style={{ flex: 1 }} />
          <span className="kp-muted"><b style={{ color: 'var(--ink)' }}>{items.length}</b> actions · {total('done')} done{overdue ? <> · <b style={{ color: '#d23a52' }}>{overdue} overdue</b></> : null}</span>
        </div>
        {!meta.canEdit && <div className="kp-banner info">Moving an action or changing its owner needs the Nursing KPI “Edit” permission.</div>}
        <div className="kp-board">{COLS.map(([s, c]) => (
          <div key={s} className="kp-col">
            <h4 style={{ color: c }}><span className="kp-dot" style={{ background: c }} />{K.ACTION_LABEL[s]}<span className="kp-muted" style={{ marginLeft: 'auto' }}>{total(s)}</span></h4>
            {items.filter((x) => (x.a.status || 'open') === s).map(({ d, a }) => {
              const late = a.due && a.due < meta.thisMonth && s !== 'done' && s !== 'dropped';
              return (
                <div key={d.id + a.id} className="kp-tcard kp-rise" style={late ? { borderColor: '#f0b9c3' } : undefined}>
                  <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}><span className="kp-code" style={{ background: K.pillarOf(cfg, d.pillar).color, minWidth: 26, height: 19, fontSize: 10 }}>{d.code || '•'}</span><span style={{ flex: 1 }}>{a.text}</span></div>
                  <div className="meta">
                    {meta.canEdit ? <input className="kp-in" style={{ padding: '3px 6px', fontSize: 11, width: 110 }} defaultValue={a.owner || ''} placeholder="Owner" onBlur={(e) => e.target.value !== (a.owner || '') && setStatus(d, a, { owner: e.target.value })} /> : <span>{a.owner || 'No owner'}</span>}
                    {meta.canEdit ? <input type="month" className="kp-in" style={{ padding: '3px 6px', fontSize: 11, width: 128, color: late ? '#d23a52' : undefined }} defaultValue={a.due || ''} onBlur={(e) => e.target.value !== (a.due || '') && setStatus(d, a, { due: e.target.value })} /> : <span style={{ color: late ? '#d23a52' : undefined }}>{a.due ? K.fmtMonth(a.due) : 'No due date'}</span>}
                    {meta.canEdit && <select className="kp-sel" style={{ padding: '3px 6px', fontSize: 11 }} value={s} disabled={busy === d.id + a.id} onChange={(e) => setStatus(d, a, { status: e.target.value })}>{K.ACTION_STATUSES.map((x) => <option key={x} value={x}>{K.ACTION_LABEL[x]}</option>)}</select>}
                    {late && <b style={{ color: '#d23a52' }}>overdue</b>}
                  </div>
                </div>
              );
            })}
          </div>
        ))}</div>
      </div>
    );
  }

  /* =============================================================== settings === */
  /* Settings → KPI schedule (administrators): every KPI in one grid — how often it is measured, when
     it starts, its own cycle length and number of cycles. Edits are drafted; Save shows what changes
     (and which saved monthly figures stop counting — kept, never deleted) before anything is saved. */
  function ScheduleTable({ meta, defs, reload }) {
    const cfg = meta.config;
    const list = (defs || []).filter((d) => d.active !== false && !d.removedAt);
    const [draft, setDraft] = useState({});
    const [busy, setBusy] = useState(false);
    const base = (d) => ({ freqMonths: K.freqOf(d), cycleMonths: d.cycleMonths || null, cycles: d.cycles || null, startMonth: K.isMonth(d.startMonth) ? d.startMonth : null });
    const cur = (d) => Object.assign(base(d), draft[d.id] || {});
    const setF = (d, patch) => setDraft((x) => {
      let n = Object.assign({}, cur(d), patch);
      if (patch.freqMonths) n = withFreq(n, patch.freqMonths);
      const o = Object.assign({}, x);
      if (JSON.stringify(n) === JSON.stringify(base(d))) delete o[d.id]; else o[d.id] = n;
      return o;
    });
    const changed = Object.keys(draft);
    async function save() {
      const items = changed.map((id) => Object.assign({ id, baseUpdatedAt: (list.find((x) => x.id === id) || {}).updatedAt }, draft[id]));
      setBusy(true);
      try {
        const dry = await api('/api/kpi/schedule', { method: 'POST', body: JSON.stringify({ dryRun: true, items }) });
        const msg = <div><ul style={{ margin: '4px 0 8px', paddingLeft: 18 }}>{dry.changes.map((x) => <li key={x.id}><b>{x.code ? x.code + ' ' : ''}{x.name}</b>: {x.from} → <b>{x.to}</b>
          {x.kept ? <div style={{ color: '#8a5a00' }}>{x.kept} monthly figure(s) already saved in months that are no longer due are kept, but no longer counted.</div> : null}</li>)}</ul>
          Data Update, reports and the missing-data badge follow the new schedule at once. Final reports do not change. Nothing is deleted.</div>;
        const ok = await confirmBox({ title: 'Save the KPI schedule?', message: msg, confirmLabel: 'Save schedule' });
        if (!ok) { setBusy(false); return; }
        const j = await api('/api/kpi/schedule', { method: 'POST', body: JSON.stringify({ items }) });
        toast(j.saved + ' KPI schedule' + (j.saved === 1 ? '' : 's') + ' saved.', 'success');
        setDraft({}); refreshBadge(); reload();
      } catch (e) { toast(e.message, 'error'); }
      setBusy(false);
    }
    const groups = cfg.pillars.map((pl) => ({ pl, list: list.filter((d) => d.pillar === pl.id) })).filter((g) => g.list.length);
    return (
      <div className="kp-card">
        <div className="kp-h"><h3>KPI schedule</h3><span className="kp-muted">How often each KPI is measured, when it starts, and its own cycles. Blank = the same as all KPIs.</span></div>
        <div className="kp-scroll"><table className="kp-tbl kp-sched"><thead><tr><th>#</th><th>KPI</th><th>Measured</th><th>Starts</th><th>Cycle length</th><th>Cycles</th><th>Periods and cycles</th></tr></thead>
          <tbody>{groups.map((g) => [
            <tr key={'g' + g.pl.id}><td colSpan={7} style={{ background: '#f3f6fa', fontWeight: 800, fontSize: 11.5 }}><span className="kp-dot" style={{ background: g.pl.color, marginRight: 7 }} />{g.pl.label}</td></tr>,
            ...g.list.map((d) => {
              const s = cur(d), dd = Object.assign({}, d, s), f = s.freqMonths, st = K.startOf(dd, cfg), dirty = !!draft[d.id];
              const periods = K.dueMonths(dd, st, K.addMonth(st, 11), cfg).map((m) => K.periodOf(dd, m, cfg).label);
              return (
                <tr key={d.id} style={{ cursor: 'default', background: dirty ? '#fffbea' : d.disabled ? '#f6f7f9' : undefined, opacity: d.disabled ? 0.65 : 1 }}>
                  <td><span className="kp-code" style={{ background: g.pl.color }}>{d.code || '•'}</span></td>
                  <td style={{ minWidth: 200 }}><b style={{ color: 'var(--ink)' }}>{d.name}</b>{d.disabled ? <span className="kp-muted"> · disabled</span> : null}</td>
                  <td><select className="kp-sel" value={f} onChange={(e) => setF(d, { freqMonths: +e.target.value })}>{K.FREQS.map((x) => <option key={x.m} value={x.m}>{x.short}</option>)}</select></td>
                  <td><input type="month" className="kp-sel" value={s.startMonth || ''} onChange={(e) => setF(d, { startMonth: K.isMonth(e.target.value) ? e.target.value : null })} title={'Blank = the same as all KPIs (' + K.fmtMonth(cfg.cycleStart) + ')'} style={{ padding: '4px 6px' }} /></td>
                  <td><select className="kp-sel" value={s.cycleMonths || ''} onChange={(e) => setF(d, { cycleMonths: e.target.value ? +e.target.value : null })}>
                    <option value="">As all ({K.cycleCfg({ freqMonths: f }, cfg).cycleMonths} mo)</option>{cycleChoices(f).map((n) => <option key={n} value={n}>{n} months</option>)}</select></td>
                  <td><select className="kp-sel" value={s.cycles || ''} onChange={(e) => setF(d, { cycles: e.target.value ? +e.target.value : null })}>
                    <option value="">As all ({cfg.cycles})</option>{[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}</select></td>
                  <td className="kp-muted" style={{ fontSize: 11, minWidth: 220 }}>{f > 1 ? <div><b style={{ color: '#3f3fa8' }}>{periods.join(' · ')}</b></div> : <div>Every month from {K.fmtMonth(st)}</div>}
                    <div>{Array.from({ length: K.cycleCfg(dd, cfg).cycles }, (_, i) => { const r = K.cycleRange(i + 1, cfg, dd); return 'C' + (i + 1) + ' ' + K.spanLabel(r.from, r.to); }).join(' · ')}</div></td>
                </tr>
              );
            }),
          ])}</tbody></table></div>
        {changed.length > 0 && <div className="kp-savebar"><b>{changed.length} KPI schedule{changed.length > 1 ? 's' : ''} changed</b><span style={{ flex: 1 }} />
          <Btn disabled={busy} onClick={() => setDraft({})}>Discard</Btn><Btn pri disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save schedule'}</Btn></div>}
      </div>
    );
  }

  function Settings({ meta, reloadMeta, defs }) {
    const [c, setC] = useState(() => JSON.parse(JSON.stringify(meta.config)));
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const set = (k, v) => setC((x) => Object.assign({}, x, { [k]: v }));
    const setPl = (i, k, v) => set('pillars', c.pillars.map((p, j) => (j === i ? Object.assign({}, p, { [k]: v }) : p)));
    async function save() {
      setBusy(true); setErr('');
      try { await api('/api/kpi/config', { method: 'PUT', body: JSON.stringify({ cycleStart: c.cycleStart, cycleMonths: c.cycleMonths, cycles: c.cycles, nearBand: c.nearBand, reportTitle: c.reportTitle, hospitalName: c.hospitalName, pillars: c.pillars, autoFill: c.autoFill !== false }) }); toast('Settings saved.', 'success'); reloadMeta(); }
      catch (e) { setErr(e.message); }
      setBusy(false);
    }
    const cycles = Array.from({ length: Math.max(1, +c.cycles || 1) }, (_, i) => K.cycleRange(i + 1, c));
    const auto = meta.automation;
    const fld = (label, el, hint) => <label className="kp-fld"><span className="kp-lab">{label}</span>{el}{hint && <span className="hint">{hint}</span>}</label>;
    return (
      <div className="kp-wrap">
        <div className="kp-card kp-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>Programme cycles</h3>
          <div className="kp-row">
            {fld('All KPIs start on', <input type="month" className="kp-in" value={c.cycleStart} onChange={(e) => K.isMonth(e.target.value) && set('cycleStart', e.target.value)} />, 'Every KPI counts its cycles, targets and missing-data checks from this month — unless it has its own start (Manage KPIs → Basics).')}
            {fld('Months per cycle', <select className="kp-sel" value={c.cycleMonths} onChange={(e) => set('cycleMonths', +e.target.value)}>{[3, 4, 6, 12].map((n) => <option key={n} value={n}>{n}</option>)}</select>, 'The deck: “Monthly for 6 months & later for another 6 months”.')}
            {fld('Number of cycles', <select className="kp-sel" value={c.cycles} onChange={(e) => set('cycles', +e.target.value)}>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}</select>)}
            {fld('“Close to target” band (%)', <input className="kp-in" inputMode="decimal" value={c.nearBand} onChange={(e) => set('nearBand', e.target.value.replace(/[^0-9.]/g, ''))} />, 'Short of the target by no more than this share of it = amber.')}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>{cycles.map((r, i) => <div key={i} style={{ flex: 1, padding: '10px 12px', borderRadius: 10, background: i % 2 ? '#e1f1fa' : '#dff5f1', fontSize: 12.5 }}><b>Cycle {i + 1}</b><div className="kp-muted">{K.fmtRange(r.from, r.to)}</div></div>)}</div>
        </div>
        <ScheduleTable meta={meta} defs={defs} reload={reloadMeta} />
        <div className="kp-card kp-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>Figures from the quality data</h3>
          <label className={'kp-switch light' + (c.autoFill !== false ? ' on' : '')} onClick={() => set('autoFill', c.autoFill === false)}><i /><span>{c.autoFill !== false ? 'Auto-fill ON — linked KPIs fill themselves from the quality data and the hand hygiene audit' : 'Auto-fill OFF — every figure is typed in Data Update; the system figure is shown as a hint'}</span></label>
          <div className="kp-muted">Each KPI can also be switched off on its own (Manage KPIs → Measure & data). Turning it off never deletes anything.</div>
        </div>
        <div className="kp-card kp-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>Pillars</h3>
          {c.pillars.map((p, i) => (
            <div key={p.id || i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="color" value={p.color} onChange={(e) => setPl(i, 'color', e.target.value)} style={{ width: 40, height: 32, border: 0, background: 'transparent', padding: 0 }} />
              <input className="kp-in" value={p.label} onChange={(e) => setPl(i, 'label', e.target.value)} style={{ flex: 1 }} />
              <button className="kp-icon-btn" disabled={i === 0} onClick={() => { const a = c.pillars.slice(); const [x] = a.splice(i, 1); a.splice(i - 1, 0, x); set('pillars', a); }}>↑</button>
              <button className="kp-icon-btn" disabled={i === c.pillars.length - 1} onClick={() => { const a = c.pillars.slice(); const [x] = a.splice(i, 1); a.splice(i + 1, 0, x); set('pillars', a); }}>↓</button>
            </div>
          ))}
          <div><Btn onClick={() => set('pillars', c.pillars.concat([{ id: '', label: 'New pillar', color: '#5b6878' }]))}>+ Add a pillar</Btn> <span className="kp-muted">A pillar holding KPIs cannot be deleted here — move its KPIs first.</span></div>
        </div>
        <div className="kp-card kp-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>Reports</h3>
          <div className="kp-row">{fld('Report title', <input className="kp-in" value={c.reportTitle} onChange={(e) => set('reportTitle', e.target.value)} />)}{fld('Hospital', <input className="kp-in" value={c.hospitalName} onChange={(e) => set('hospitalName', e.target.value)} />)}</div>
          <div className="kp-muted">Monthly reports are prepared automatically after each month ends{auto ? ' — last: ' + K.fmtMonthLong(auto.lastMonth) + ' (' + auto.lastResult + ', ' + when(auto.lastAt) + ')' : ''}.</div>
        </div>
        {err && <div className="kp-err">{err}</div>}
        <div><Btn pri disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save settings'}</Btn></div>
      </div>
    );
  }

  /* ================================================================== shell === */
  const VIEWS = [['kpiDashboard', 'Dashboard'], ['kpiEntry', 'Data Update'], ['kpiReports', 'Reports'], ['kpiManage', 'Manage KPIs'], ['kpiActions', 'Action Plans'], ['kpiSettings', 'Settings']];
  function KpiView({ view, report, kpi, setRoute }) {
    useStyles();
    const [meta, setMeta] = useState(null);
    const [defs, setDefs] = useState(null);
    const [err, setErr] = useState('');
    const [alerts, setAlerts] = useState(() => window.__UNICO_KPI_ALERTS__ || null);
    const [showCalc, setShowCalc] = useState(() => !!lsGet('kpi_show_calc'));
    useEffect(() => { lsSet('kpi_show_calc', showCalc); }, [showCalc]);
    const loadMeta = useCallback(() => api('/api/kpi/meta').then((j) => setMeta(j)).catch((e) => setErr(e.message)), []);
    const loadDefs = useCallback(() => api('/api/kpi/defs?all=1').then((j) => setDefs(j.defs)).catch((e) => setErr(e.message)), []);
    useEffect(() => { loadMeta(); loadDefs(); }, []);
    useEffect(() => { const h = (e) => setAlerts(e.detail); window.addEventListener('unico:kpi-alerts', h); return () => window.removeEventListener('unico:kpi-alerts', h); }, []);
    if (err) return <div className="kp-wrap"><div className="kp-banner">{err}</div></div>;
    if (!meta || !defs) return <div className="kp-wrap"><div className="kp-hero"><h1>Nursing KPI</h1><div className="sub">Loading the KPI programme…</div></div></div>;
    const v = VIEWS.find(([k]) => k === view) ? view : 'kpiDashboard';
    const cyc = meta.cycle, cfg = meta.config;
    const allowed = (k) => (k === 'kpiSettings' ? meta.isAdmin : (!window.unicoCanAccessView || window.unicoCanAccessView(k)));
    const nGap = alerts && alerts.missing ? alerts.missing.length : 0;
    const segs = Array.from({ length: cfg.cycleMonths * cfg.cycles }, (_, i) => i);
    const doneN = cyc.index === 0 ? 0 : cyc.index > cfg.cycles ? segs.length : (cyc.index - 1) * cfg.cycleMonths + (cyc.monthNo || 0);
    let body;
    if (v === 'kpiEntry') body = <DataEntry meta={meta} defs={defs} focusKpi={kpi} showCalc={showCalc} reload={() => { loadMeta(); loadDefs(); }} />;
    else if (v === 'kpiReports') body = report === 'definitions' || /^calendar-\d{4}$/.test(report || '')
      ? <DocView key={report} meta={meta} kind={report === 'definitions' ? 'definitions' : 'calendar'} year={report === 'definitions' ? null : +report.slice(9)} setRoute={setRoute} />
      : report ? <ReportDoc key={report} meta={meta} id={report} setRoute={setRoute} showCalc={showCalc} /> : <ReportsHome meta={meta} setRoute={setRoute} />;
    else if (v === 'kpiManage') body = <ManageKpis meta={meta} defs={defs} reload={loadDefs} />;
    else if (v === 'kpiActions') body = <ActionBoard meta={meta} defs={defs} reload={loadDefs} focusKpi={kpi} />;
    else if (v === 'kpiSettings') body = meta.isAdmin ? <Settings meta={meta} defs={defs} reloadMeta={() => { loadMeta(); loadDefs(); }} /> : <div className="kp-card kp-empty">Only an administrator can change the Nursing KPI settings.</div>;
    else body = <Dashboard meta={meta} setRoute={setRoute} showCalc={showCalc} />;
    return (
      <div className="kp-wrap">
        {!(v === 'kpiReports' && report) && (
          <div className="kp-hero kp-rise">
            <div className="kp-hero-row">
              <div><h1>{cfg.reportTitle}</h1><div className="sub">{defs.filter(K.isLive).length} KPIs · {cfg.pillars.length} pillars · {cfg.hospitalName}</div></div>
              <label className={'kp-switch' + (showCalc ? ' on' : '')} title="Show how every figure was calculated: the units it came from, who sent and approved each figure, and the data checks" onClick={() => setShowCalc(!showCalc)} style={{ position: 'relative', zIndex: 1 }}><i /><span>Show calculation</span></label>
              <div className="kp-cycle">
                <div className="lab"><span>{cyc.label}{cyc.monthNo ? ' · month ' + cyc.monthNo + ' of ' + cyc.of : ''}</span><span>{K.fmtMonth(cfg.cycleStart)} → {K.fmtMonth(K.cycleRange(cfg.cycles, cfg).to)}</span></div>
                <div className="bar">{segs.map((i) => <i key={i} className={i < doneN - 1 ? 'on' : i === doneN - 1 ? 'now' : ''} style={i > 0 && i % cfg.cycleMonths === 0 ? { marginLeft: 4 } : undefined} />)}</div>
              </div>
            </div>
            <div className="kp-nav">{VIEWS.filter(([k]) => allowed(k)).map(([k, l]) => <button key={k} className={v === k ? 'on' : ''} onClick={() => setRoute({ view: k })}>{l}{k === 'kpiEntry' && nGap > 0 && (meta.canAdd || meta.canEdit) ? <b>{nGap}</b> : null}{k === 'kpiReports' && alerts && alerts.reportReady ? <b>1</b> : null}</button>)}</div>
          </div>
        )}
        {body}
      </div>
    );
  }
  window.KpiView = KpiView;
})();
