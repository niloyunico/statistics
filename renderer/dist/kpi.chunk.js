/* ===== kpi.jsx ===== */
(function(){
(function () {
  const {
    useState,
    useEffect,
    useMemo,
    useRef,
    useCallback
  } = React;
  const K = window.UNICO_KPI;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;'
  })[c]);
  const toast = (m, t) => {
    if (window.UI && window.UI.toast) window.UI.toast(m, t);
  };
  const confirmBox = o => window.UI && window.UI.confirm ? window.UI.confirm(o) : Promise.resolve(window.confirm(o.message || o.title));
  const refreshBadge = () => {
    try {
      window.dispatchEvent(new Event('unico:kpi-refresh'));
    } catch (e) {}
  };
  const lsGet = k => {
    try {
      return JSON.parse(localStorage.getItem(k) || 'null');
    } catch (e) {
      return null;
    }
  };
  const lsSet = (k, v) => {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {}
  };
  const when = t => t ? new Date(t).toLocaleString('en-GB', {
    timeZone: 'Asia/Dhaka',
    dateStyle: 'medium',
    timeStyle: 'short'
  }) : '';
  const me = () => window.__UNICO_USER__ && (window.__UNICO_USER__.name || window.__UNICO_USER__.username) || '';
  const sigNames = () => {
    try {
      return window.unicoSig ? window.unicoSig.load() : {};
    } catch (e) {
      return {};
    }
  };
  async function api(url, opts) {
    const r = await fetch(url, Object.assign({
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json'
      }
    }, opts || {}));
    if (r.status === 401 || r.redirected) throw new Error('Your session has expired. Sign in again.');
    const j = await r.json().catch(() => null);
    if (!j) throw new Error('The server did not answer. Please try again.');
    if (!j.ok) {
      const e = new Error(j.error || 'Something went wrong.');
      e.status = r.status;
      e.body = j;
      throw e;
    }
    return j;
  }
  async function download(url) {
    const r = await fetch(url, {
      credentials: 'same-origin',
      cache: 'no-store'
    });
    if (!r.ok) {
      const j = await r.json().catch(() => null);
      throw new Error(j && j.error || 'Could not build the file.');
    }
    const m = /filename="([^"]+)"/.exec(r.headers.get('content-disposition') || '');
    const href = URL.createObjectURL(await r.blob());
    const a = document.createElement('a');
    a.href = href;
    a.download = m ? m[1] : 'Nursing-KPI';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 4000);
  }
  async function printSheets(getRoot, title, log, setCapturing) {
    const w = window.open('', '_blank');
    try {
      await log();
      if (!w) {
        toast('Allow pop-ups for this site to print.', 'error');
        return;
      }
      setCapturing(true);
      await new Promise(r => setTimeout(r, 60));
      const html = getRoot().innerHTML.split('src="unico/logo.svg"').join('src="' + location.origin + '/unico/logo.svg"');
      setCapturing(false);
      w.document.open();
      w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' + esc(title) + '</title><style>:root{--line:#dde3ec;--line-2:#eef2f6;--muted:#7b8796;--ink:#16202e;--ink-2:#3a4656;--blue-50:#eef8fd;--shadow:none}' + 'html{-webkit-print-color-adjust:exact;print-color-adjust:exact}body{margin:0;font-family:"IBM Plex Sans","Segoe UI",Arial,sans-serif;background:#fff}@page{size:A4 landscape;margin:0}' + CSS + '.kp-doc{gap:0;padding:0}.kp-sheet{box-shadow:none;page-break-after:always;break-after:page;width:297mm;height:209mm;min-height:0}.kp-sheet:last-child{page-break-after:auto}</style></head><body><div class="kp-doc">' + html + '</div><script>window.onload=function(){setTimeout(function(){window.print();},250);};<\/script></body></html>');
      w.document.close();
    } catch (e) {
      if (w) w.close();
      setCapturing(false);
      throw e;
    }
  }
  async function pdfSheets(getRoot, title, fileName, log, setCapturing) {
    await log();
    if (window.unicoLoadPdfLibs && !(window.jspdf && window.html2canvas)) await window.unicoLoadPdfLibs();
    const J = window.jspdf && window.jspdf.jsPDF,
      H = window.html2canvas;
    if (!J || !H) throw new Error('The PDF tools could not load. Use Print and choose “Save as PDF”.');
    setCapturing(true);
    try {
      await new Promise(r => setTimeout(r, 120));
      const sheets = [...getRoot().querySelectorAll('.kp-sheet')];
      const pdf = new J({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
        compress: true
      });
      for (let i = 0; i < sheets.length; i++) {
        const c = await H(sheets[i], {
          scale: 1.6,
          backgroundColor: '#ffffff',
          useCORS: true,
          logging: false,
          windowWidth: 1200
        });
        if (i) pdf.addPage();
        pdf.addImage(c.toDataURL('image/jpeg', 0.85), 'JPEG', 0, 0, 297, 210);
      }
      pdf.setProperties({
        title,
        author: me()
      });
      pdf.save(fileName + '.pdf');
      toast('PDF downloaded.', 'success');
    } finally {
      setCapturing(false);
    }
  }
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
      const s = document.createElement('style');
      s.id = 'kp-css';
      s.textContent = CSS;
      document.head.appendChild(s);
    }, []);
  }
  const ST = K.STATUS;
  const SRC = {
    'hh-audit': {
      label: 'HH audit',
      color: '#0d5e55',
      dot: '#2bb3a3',
      bg: '#dff5f1',
      long: 'From the hospital hand hygiene audit'
    },
    pooled: {
      label: 'Quality',
      color: '#0b4f6c',
      dot: '#0090ca',
      bg: '#e1f1fa',
      long: 'From the quality data — all units pooled'
    },
    hospital: {
      label: 'Quality',
      color: '#0b4f6c',
      dot: '#0090ca',
      bg: '#e1f1fa',
      long: 'From the Overall Hospital quality data'
    },
    edited: {
      label: 'Edited',
      color: '#8a5a00',
      dot: '#e08a1e',
      bg: '#fff1d6',
      long: 'The system figure, changed by a KPI manager'
    },
    manual: {
      label: 'Entered',
      color: '#4b3fb0',
      dot: '#7a5ae0',
      bg: '#efebfd',
      long: 'Entered by a KPI manager'
    },
    partial: {
      label: 'Den. missing',
      color: '#8a5a00',
      dot: '#d9902b',
      bg: '#fff1d6',
      long: 'Events reported but no denominator (device days / patient-days not entered)'
    },
    missing: {
      label: '',
      color: '#a3172f',
      dot: '#d23a52',
      bg: 'transparent',
      long: 'No figure yet'
    },
    'not-started': {
      label: 'Not started',
      color: '#7b8796',
      dot: '#c3cad3',
      bg: '#f3f5f8',
      long: 'Before this KPI’s start month — not counted'
    }
  };
  const srcOf = s => SRC[s] || SRC.pooled;
  const Pill = ({
    s,
    small
  }) => React.createElement("span", {
    className: "kp-pill",
    style: {
      background: ST[s].bg,
      color: ST[s].ink,
      fontSize: small ? 10.5 : 11
    }
  }, React.createElement("i", {
    style: {
      background: ST[s].color
    }
  }), ST[s].label);
  const Src = ({
    s
  }) => srcOf(s).label ? React.createElement("span", {
    className: "kp-src",
    style: {
      background: srcOf(s).bg,
      color: srcOf(s).color
    },
    title: srcOf(s).long
  }, srcOf(s).label) : null;
  const Code = ({
    r,
    cfg
  }) => React.createElement("span", {
    className: "kp-code",
    style: {
      background: K.pillarOf(cfg, r.pillar).color
    }
  }, r.code || '•');
  const TREND = {
    improving: ['▲ Improving', '#1f9d57'],
    worsening: ['▼ Worsening', '#d23a52'],
    steady: ['● Steady', '#7b8796']
  };
  const Trend = ({
    d
  }) => d ? React.createElement("span", {
    className: "kp-trend",
    style: {
      color: TREND[d][1]
    }
  }, TREND[d][0]) : React.createElement("span", {
    className: "kp-muted"
  }, "\u2014");
  const Btn = ({
    children,
    pri,
    onClick,
    disabled,
    title,
    danger
  }) => React.createElement("button", {
    className: 'btn sm' + (pri ? ' pri' : ''),
    onClick: onClick,
    disabled: disabled,
    title: title,
    style: danger ? {
      color: '#a3172f',
      borderColor: '#f0b9c3'
    } : undefined
  }, children);
  const shade = (hex, p) => {
    const n = parseInt(String(hex).slice(1), 16);
    const c = x => Math.max(0, Math.min(255, x + p));
    return '#' + (c(n >> 16) << 16 | c(n >> 8 & 255) << 8 | c(n & 255)).toString(16).padStart(6, '0');
  };
  function useMounted(flat) {
    const [m, setM] = useState(!!flat);
    useEffect(() => {
      if (flat) return;
      const t = setTimeout(() => setM(true), 40);
      return () => clearTimeout(t);
    }, [flat]);
    return m;
  }
  function Iso3D({
    items,
    height,
    max,
    refLine,
    refLabel,
    onPick,
    flat,
    unit
  }) {
    const m = useMounted(flat);
    const [hi, setHi] = useState(-1);
    const H = height || 270;
    const n = Math.max(items.length, 1);
    const step = Math.max(38, Math.min(74, 760 / n)),
      bw = Math.min(30, step - 14),
      dx = 12,
      dy = -8;
    const base = H - 36,
      top = 30;
    const mx = max || Math.max(1, ...items.map(i => i.value || 0), refLine || 0);
    const yOf = v => base - Math.max(0, v) / mx * (base - top);
    const W = 46 + n * step + dx + 6;
    const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(mx * f));
    return React.createElement("svg", {
      viewBox: '0 0 ' + W + ' ' + H,
      width: "100%",
      height: H,
      preserveAspectRatio: "xMidYMid meet",
      style: {
        overflow: 'visible',
        display: 'block'
      }
    }, ticks.map((t, i) => React.createElement("g", {
      key: i
    }, React.createElement("line", {
      x1: 40,
      x2: 40 + n * step,
      y1: yOf(t),
      y2: yOf(t),
      stroke: "#e9eef4"
    }), React.createElement("line", {
      x1: 40 + n * step,
      x2: 40 + n * step + dx,
      y1: yOf(t),
      y2: yOf(t) + dy,
      stroke: "#eef2f6"
    }), React.createElement("text", {
      x: 34,
      y: yOf(t) + 3,
      textAnchor: "end",
      fontSize: "9.5",
      fill: "#9aa6b4"
    }, t, unit || ''))), items.map((d, i) => {
      const v = d.value || 0,
        x = 46 + i * step,
        y = v > 0 ? yOf(v) : base - 2,
        h = base - y,
        c = d.color || '#008FCB',
        on = hi === i;
      return React.createElement("g", {
        key: i,
        style: {
          cursor: onPick ? 'pointer' : 'default',
          opacity: hi < 0 || on ? 1 : 0.6,
          transition: 'opacity .15s'
        },
        onMouseEnter: () => setHi(i),
        onMouseLeave: () => setHi(-1),
        onClick: () => onPick && onPick(d, i)
      }, React.createElement("title", null, d.title || d.label + ': ' + v), React.createElement("g", {
        style: {
          transformOrigin: x + bw / 2 + 'px ' + base + 'px',
          transform: 'scaleY(' + (m ? 1 : 0.001) + ')',
          transition: flat ? 'none' : 'transform .8s ' + i * 45 + 'ms cubic-bezier(.2,.85,.3,1)'
        }
      }, React.createElement("polygon", {
        points: x + bw + ',' + y + ' ' + (x + bw + dx) + ',' + (y + dy) + ' ' + (x + bw + dx) + ',' + (base + dy) + ' ' + (x + bw) + ',' + base,
        fill: shade(c, -48)
      }), React.createElement("polygon", {
        points: x + ',' + y + ' ' + (x + dx) + ',' + (y + dy) + ' ' + (x + bw + dx) + ',' + (y + dy) + ' ' + (x + bw) + ',' + y,
        fill: shade(c, 50)
      }), React.createElement("rect", {
        x: x,
        y: y,
        width: bw,
        height: Math.max(h, 0),
        fill: c
      }), React.createElement("rect", {
        x: x,
        y: y,
        width: bw * 0.32,
        height: Math.max(h, 0),
        fill: "#fff",
        opacity: ".14"
      })), m && React.createElement("text", {
        x: x + bw / 2 + dx / 2,
        y: y + dy - 5,
        textAnchor: "middle",
        fontSize: "10.5",
        fontWeight: "700",
        fill: "#16202e"
      }, d.valueLabel != null ? d.valueLabel : v), React.createElement("text", {
        x: x + bw / 2,
        y: H - 18,
        textAnchor: "middle",
        fontSize: "10",
        fontWeight: "700",
        fill: "#5b6878"
      }, String(d.label).slice(0, 8)));
    }), refLine != null && React.createElement("g", null, React.createElement("line", {
      x1: 40,
      x2: 40 + n * step + dx,
      y1: yOf(refLine),
      y2: yOf(refLine),
      stroke: "#00293A",
      strokeDasharray: "5 4",
      strokeWidth: "1.3"
    }), React.createElement("text", {
      x: 40 + n * step + dx,
      y: yOf(refLine) - 5,
      textAnchor: "end",
      fontSize: "10",
      fontWeight: "700",
      fill: "#00293A"
    }, refLabel || 'Target')));
  }
  function Iso3DStack({
    groups,
    height,
    flat,
    onPick
  }) {
    const m = useMounted(flat);
    const H = height || 260,
      n = Math.max(groups.length, 1);
    const step = Math.max(90, Math.min(150, 620 / n)),
      bw = Math.min(56, step - 34),
      dx = 16,
      dy = -11,
      base = H - 40,
      top = 26;
    const mx = Math.max(1, ...groups.map(g => g.parts.reduce((a, p) => a + p.value, 0)));
    const unit = (base - top) / mx;
    const W = 30 + n * step + dx;
    return React.createElement("svg", {
      viewBox: '0 0 ' + W + ' ' + H,
      width: "100%",
      height: H,
      style: {
        overflow: 'visible',
        display: 'block'
      }
    }, Array.from({
      length: mx + 1
    }, (_, t) => React.createElement("g", {
      key: t
    }, React.createElement("line", {
      x1: 24,
      x2: 24 + n * step,
      y1: base - t * unit,
      y2: base - t * unit,
      stroke: "#eef2f6"
    }), React.createElement("text", {
      x: 18,
      y: base - t * unit + 3,
      textAnchor: "end",
      fontSize: "9.5",
      fill: "#9aa6b4"
    }, t))), groups.map((g, i) => {
      const x = 34 + i * step + (step - bw) / 2;
      let y = base;
      const total = g.parts.reduce((a, p) => a + p.value, 0);
      return React.createElement("g", {
        key: i,
        style: {
          cursor: onPick ? 'pointer' : 'default'
        },
        onClick: () => onPick && onPick(g, i)
      }, React.createElement("title", null, g.label + ': ' + g.parts.filter(p => p.value).map(p => p.value + ' ' + p.label).join(', ')), React.createElement("g", {
        style: {
          transformOrigin: x + bw / 2 + 'px ' + base + 'px',
          transform: 'scaleY(' + (m ? 1 : 0.001) + ')',
          transition: flat ? 'none' : 'transform .9s ' + i * 90 + 'ms cubic-bezier(.2,.85,.3,1)'
        }
      }, g.parts.filter(p => p.value > 0).map((p, j, arr) => {
        const h = p.value * unit,
          yy = y - h;
        y = yy;
        const last = j === arr.length - 1;
        return React.createElement("g", {
          key: j
        }, React.createElement("polygon", {
          points: x + bw + ',' + yy + ' ' + (x + bw + dx) + ',' + (yy + dy) + ' ' + (x + bw + dx) + ',' + (yy + h + dy) + ' ' + (x + bw) + ',' + (yy + h),
          fill: shade(p.color, -48)
        }), React.createElement("rect", {
          x: x,
          y: yy,
          width: bw,
          height: h,
          fill: p.color,
          stroke: "#fff",
          strokeWidth: ".6"
        }), last && React.createElement("polygon", {
          points: x + ',' + yy + ' ' + (x + dx) + ',' + (yy + dy) + ' ' + (x + bw + dx) + ',' + (yy + dy) + ' ' + (x + bw) + ',' + yy,
          fill: shade(p.color, 50)
        }), h > 15 && React.createElement("text", {
          x: x + bw / 2,
          y: yy + h / 2 + 4,
          textAnchor: "middle",
          fontSize: "11",
          fontWeight: "800",
          fill: "#fff"
        }, p.value));
      })), m && React.createElement("text", {
        x: x + bw / 2 + dx / 2,
        y: base - total * unit + dy - 6,
        textAnchor: "middle",
        fontSize: "11",
        fontWeight: "800",
        fill: "#16202e"
      }, total), React.createElement("text", {
        x: x + bw / 2,
        y: H - 20,
        textAnchor: "middle",
        fontSize: "10.5",
        fontWeight: "700",
        fill: "#5b6878"
      }, g.label.length > 20 ? g.label.slice(0, 19) + '…' : g.label));
    }));
  }
  function ScoreRing({
    score,
    size,
    flat
  }) {
    const m = useMounted(flat);
    const S = size || 96,
      r = S / 2 - 8,
      C = 2 * Math.PI * r,
      v = score == null ? 0 : Math.max(0, Math.min(100, score));
    const col = score == null ? '#a3adba' : v >= 75 ? '#7fe0d4' : v >= 50 ? '#ffd27a' : '#ff9aab';
    return React.createElement("svg", {
      width: S,
      height: S,
      viewBox: '0 0 ' + S + ' ' + S,
      style: {
        flex: 'none',
        display: 'block'
      }
    }, React.createElement("circle", {
      cx: S / 2,
      cy: S / 2,
      r: r,
      fill: "none",
      stroke: "rgba(255,255,255,.16)",
      strokeWidth: "9"
    }), React.createElement("circle", {
      cx: S / 2,
      cy: S / 2,
      r: r,
      fill: "none",
      stroke: col,
      strokeWidth: "9",
      strokeLinecap: "round",
      strokeDasharray: C,
      strokeDashoffset: m ? C * (1 - v / 100) : C,
      transform: 'rotate(-90 ' + S / 2 + ' ' + S / 2 + ')',
      style: {
        transition: flat ? 'none' : 'stroke-dashoffset 1.1s cubic-bezier(.3,.8,.3,1)'
      }
    }), React.createElement("text", {
      x: S / 2,
      y: S / 2 + 2,
      textAnchor: "middle",
      fontSize: S * 0.27,
      fontWeight: "800",
      fill: "#fff"
    }, score == null ? '—' : v + '%'), React.createElement("text", {
      x: S / 2,
      y: S / 2 + S * 0.2,
      textAnchor: "middle",
      fontSize: S * 0.1,
      fill: "rgba(255,255,255,.75)"
    }, "on target"));
  }
  function Spark({
    row,
    w,
    h
  }) {
    const W = w || 120,
      Hh = h || 30;
    const pts = row.trend || [];
    const vals = pts.map(p => p.v).filter(v => v != null);
    if (vals.length < 1) return React.createElement("span", {
      className: "kp-muted",
      style: {
        fontSize: 11
      }
    }, "no data");
    const tv = row.target;
    const mx = Math.max(...vals, tv != null ? tv : -Infinity),
      mn = Math.min(...vals, tv != null ? tv : Infinity, 0);
    const sx = i => 2 + i / Math.max(pts.length - 1, 1) * (W - 4),
      sy = v => Hh - 3 - (v - mn) / (mx - mn || 1) * (Hh - 6);
    let d = '',
      pen = false;
    pts.forEach((p, i) => {
      if (p.v == null) {
        pen = false;
        return;
      }
      d += (pen ? 'L' : 'M') + sx(i).toFixed(1) + ' ' + sy(p.v).toFixed(1) + ' ';
      pen = true;
    });
    const last = pts.map((p, i) => [p, i]).filter(([p]) => p.v != null).pop();
    const col = ST[row.status].color;
    return React.createElement("svg", {
      width: W,
      height: Hh,
      style: {
        display: 'block'
      }
    }, tv != null && React.createElement("line", {
      x1: "0",
      x2: W,
      y1: sy(tv),
      y2: sy(tv),
      stroke: "#37B4A6",
      strokeDasharray: "3 3"
    }), React.createElement("path", {
      d: d,
      fill: "none",
      stroke: col,
      strokeWidth: "1.8",
      strokeLinejoin: "round",
      strokeLinecap: "round"
    }), last && React.createElement("circle", {
      cx: sx(last[1]),
      cy: sy(last[0].v),
      r: "2.8",
      fill: col
    }));
  }
  function usePeriod(meta, key, def, yearCap) {
    const [p, setP] = useState(() => lsGet('kpi_period_' + key) || {
      preset: def || '6m'
    });
    useEffect(() => {
      lsSet('kpi_period_' + key, p);
    }, [p, key]);
    const range = useMemo(() => {
      if (!meta) return null;
      if (p.preset === 'custom' && K.isMonth(p.from) && K.isMonth(p.to) && p.from <= p.to) return {
        from: p.from,
        to: K.monthDiff(p.from, p.to) >= K.MAX_MONTHS ? K.addMonth(p.from, K.MAX_MONTHS - 1) : p.to
      };
      if (p.preset === 'year') return K.yearRange(p.year || meta.lastClosed.slice(0, 4), yearCap === 'all' ? null : meta.lastClosed);
      return K.presetRange(p.preset === 'custom' ? '6m' : p.preset, K.isMonth(p.end) ? p.end : meta.lastClosed, meta.config);
    }, [p, meta, yearCap]);
    return [p, setP, range];
  }
  const yearsOf = meta => {
    const last = +meta.thisMonth.slice(0, 4),
      first = Math.min(+meta.config.cycleStart.slice(0, 4) - 1, last - 2);
    const out = [];
    for (let y = last; y >= first; y--) out.push(y);
    return out;
  };
  function PeriodPicker({
    meta,
    p,
    setP,
    range,
    presets,
    maxMonth
  }) {
    const list = K.PRESETS.filter(x => !presets || presets.indexOf(x.id) >= 0);
    const top = maxMonth || meta.thisMonth;
    const isN = !K.PRESETS.find(x => x.id === p.preset && x.cycle) && p.preset !== 'custom' && p.preset !== 'year';
    return React.createElement("div", {
      className: "kp-chips",
      style: {
        alignItems: 'center'
      }
    }, list.map(x => {
      const r = x.cycle ? K.cycleRange(x.cycle, meta.config) : null;
      return React.createElement("button", {
        key: x.id,
        className: 'kp-chip' + (p.preset === x.id ? ' on' : ''),
        title: r ? K.fmtRange(r.from, r.to) : x.id === 'year' ? 'A calendar year, January to December' : '',
        onClick: () => setP(Object.assign({}, p, {
          preset: x.id
        }, x.id === 'custom' && !p.from ? {
          from: range.from,
          to: range.to
        } : {}, x.id === 'year' && !p.year ? {
          year: +meta.lastClosed.slice(0, 4)
        } : {}))
      }, x.label);
    }), p.preset === 'year' && React.createElement("select", {
      className: "kp-sel",
      value: p.year || +meta.lastClosed.slice(0, 4),
      onChange: e => setP(Object.assign({}, p, {
        year: +e.target.value
      })),
      "aria-label": "Year"
    }, yearsOf(meta).map(y => React.createElement("option", {
      key: y,
      value: y
    }, y))), p.preset === 'year' && range && range.partial && React.createElement("span", {
      className: "kp-muted",
      style: {
        fontSize: 11.5
      }
    }, "so far \u2014 the year is not over"), isN && React.createElement("span", {
      style: {
        display: 'inline-flex',
        gap: 5,
        alignItems: 'center',
        fontSize: 12,
        color: 'var(--muted)'
      }
    }, "ending", React.createElement("input", {
      type: "month",
      className: "kp-sel",
      value: K.isMonth(p.end) ? p.end : meta.lastClosed,
      max: top,
      onChange: e => K.isMonth(e.target.value) && setP(Object.assign({}, p, {
        end: e.target.value
      }))
    })), p.preset === 'custom' && React.createElement("span", {
      style: {
        display: 'inline-flex',
        gap: 5,
        alignItems: 'center',
        fontSize: 12,
        color: 'var(--muted)'
      }
    }, React.createElement("input", {
      type: "month",
      className: "kp-sel",
      value: p.from || range.from,
      max: top,
      onChange: e => K.isMonth(e.target.value) && setP(Object.assign({}, p, {
        from: e.target.value
      }))
    }), "to", React.createElement("input", {
      type: "month",
      className: "kp-sel",
      value: p.to || range.to,
      max: top,
      onChange: e => K.isMonth(e.target.value) && setP(Object.assign({}, p, {
        to: e.target.value
      }))
    })), range && React.createElement("span", {
      className: "kp-muted",
      style: {
        fontWeight: 700,
        color: 'var(--ink-2)'
      }
    }, K.fmtRange(range.from, range.to)));
  }
  const CHARTS = [['area', 'Area'], ['line', 'Line'], ['bar', 'Bars'], ['3d', '3D']];
  function KpiChart({
    row,
    kind,
    height,
    flat
  }) {
    const data = (row.trend || []).filter(t => t.v != null).map(t => ({
      mon: K.fmtMonth(t.m).replace(' 20', ' '),
      val: t.v
    }));
    if (!data.length) return React.createElement("div", {
      className: "kp-empty"
    }, "No monthly figures yet for this KPI.");
    const color = K.pillarOf(null, row.pillar).color === '#00293A' ? '#008FCB' : K.pillarOf(null, row.pillar).color;
    const W = window;
    if (kind === 'line' && W.LineChart) return React.createElement(W.LineChart, {
      data: data,
      x: "mon",
      y: "val",
      height: height || 230,
      color: color,
      flat: flat
    });
    if (kind === 'bar' && W.BarChart) return React.createElement(W.BarChart, {
      data: data,
      x: "mon",
      y: "val",
      height: height || 230,
      color: color,
      flat: flat
    });
    if (kind === '3d') return React.createElement(Iso3D, {
      items: data.map(d => ({
        label: d.mon,
        value: d.val,
        color: row.target != null && K.statusOf(row, d.val, row.target) !== 'met' ? '#d23a52' : '#1f9d57',
        valueLabel: K.fmt(row, d.val, {
          bare: true
        })
      })),
      refLine: row.target,
      height: height || 240,
      flat: flat
    });
    if (W.AreaTargetChart) return React.createElement(W.AreaTargetChart, {
      data: data,
      x: "mon",
      y: "val",
      target: row.target,
      height: height || 230,
      color: color,
      flat: flat
    });
    return null;
  }
  const EV_SRC = {
    approved: ['Approved', '#14713f', '#e7f6ed'],
    'overlay-edit': ['Console edit', '#8a5a00', '#fff1d6'],
    audit: ['Audit', '#0d5e55', '#dff5f1'],
    own: ['Own reading', '#0b4f6c', '#e1f1fa'],
    covered: ['Covered by audit', '#5b6878', '#eef2f6'],
    'not-audited': ['Not audited', '#a3172f', '#fde4e8'],
    'not-observed': ['Not observed', '#5b6878', '#eef2f6'],
    missing: ['Missing', '#a3172f', '#fde4e8'],
    partial: ['No denominator', '#a3172f', '#fde4e8'],
    'den-zero': ['Denominator 0', '#a3172f', '#fde4e8'],
    'carried-den': ['Headcount carried', '#8a5a00', '#fff1d6'],
    manual: ['Entered', '#4b3fb0', '#efebfd']
  };
  const EvSrc = ({
    s
  }) => {
    const x = EV_SRC[s] || [s, '#5b6878', '#eef2f6'];
    return React.createElement("span", {
      className: "kp-src",
      style: {
        color: x[1],
        background: x[2]
      }
    }, x[0]);
  };
  const dayOf = t => t ? new Date(t).toLocaleDateString('en-GB', {
    timeZone: 'Asia/Dhaka',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }) : '';
  function EvidenceView({
    def,
    ev,
    steps,
    acks,
    compact
  }) {
    if (!ev) return null;
    const st = steps || K.evidenceSteps(def, ev);
    const ackOf = c => (acks || []).find(a => a.key === [ev.kpiId, ev.ym, c.code, c.unit || ''].join('|') && !a.revokedAt);
    const units = ev.units || [];
    const nl = def.numLabel || 'Numerator',
      dl = def.denLabel || 'Denominator';
    return React.createElement("div", {
      className: "kp-ev"
    }, !ev.started && React.createElement("div", {
      className: "kp-banner info"
    }, "This KPI starts in ", K.fmtMonthLong(ev.startMonth), ". ", K.fmtMonthLong(ev.ym), " is before that, so it is not counted and nothing is owed."), React.createElement("div", {
      className: "kp-formula"
    }, React.createElement("b", null, "Formula:"), " ", def.formulaText || K.FORMULA_LABEL[def.formula] || '—', !ev.autoFill && ev.linked ? React.createElement("span", null, " \xB7 ", React.createElement("b", null, "Auto-fill is off"), " \u2014 the system figure is shown for reference only.") : null, def.formula !== 'direct' && React.createElement("div", {
      style: {
        fontSize: 11.5,
        marginTop: 3
      }
    }, React.createElement("b", null, "Num."), " = ", nl, def.formula !== 'count' ? React.createElement(React.Fragment, null, " \xB7 ", React.createElement("b", null, "Den."), " = ", dl) : null)), st.length > 0 && React.createElement("ol", {
      className: "kp-steps"
    }, st.map((s, i) => React.createElement("li", {
      key: i
    }, s))), ev.sourceRecord && React.createElement("div", {
      className: "kp-sys",
      style: {
        background: '#f6fbfe',
        borderColor: '#b9dcef',
        color: '#0b4f6c'
      }
    }, React.createElement("b", null, ev.sourceRecord.name), React.createElement("span", null, K.has(ev.sourceRecord.num) ? ev.sourceRecord.num + ' ÷ ' + ev.sourceRecord.den + ' = ' + K.fmt(def, ev.sourceRecord.value) : '—'), React.createElement("span", null, ev.sourceRecord.submission ? 'sent by ' + (ev.sourceRecord.submission.by || '—') + ' · approved by ' + (ev.sourceRecord.submission.reviewedBy || '—') + ' on ' + dayOf(ev.sourceRecord.submission.reviewedAt) : ev.sourceRecord.overlayEdited ? 'edited in the Quality console by ' + (ev.sourceRecord.overlayEdited.by || 'someone (not recorded)') : 'approval not traced')), ev.override && React.createElement("div", {
      className: "kp-sys",
      style: {
        background: '#fff8e9',
        borderColor: '#f0d49a',
        color: '#6b4300'
      }
    }, React.createElement("b", null, ev.linked ? 'Typed over the system figure' : 'Entered', " by ", ev.override.by || '—'), React.createElement("span", null, dayOf(ev.override.at)), ev.override.autoValue != null && React.createElement("span", null, "system figure was ", K.fmt(def, ev.override.autoValue)), React.createElement("span", {
      style: {
        fontStyle: 'italic'
      }
    }, ev.override.note ? '“' + ev.override.note + '”' : 'no reason given'), ev.override.confirmed && React.createElement("span", null, "\xB7 unusual figure confirmed")), units.length > 0 && React.createElement("div", {
      className: "kp-scroll"
    }, React.createElement("table", {
      className: "kp-evtbl"
    }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Unit"), React.createElement("th", {
      style: {
        textAlign: 'right'
      },
      title: nl
    }, "Num."), def.formula !== 'count' && def.formula !== 'direct' && React.createElement("th", {
      style: {
        textAlign: 'right'
      },
      title: dl
    }, "Den."), React.createElement("th", {
      style: {
        textAlign: 'right'
      }
    }, "Value"), React.createElement("th", null, "Source"), React.createElement("th", null, "Sent \xB7 approved"), !compact && React.createElement("th", null, "Device Days"))), React.createElement("tbody", null, units.map(u => {
      const bad = (ev.checks || []).some(c => c.unit === u.key && c.level === 'error');
      const s = u.submission;
      return React.createElement("tr", {
        key: u.key,
        className: bad ? 'bad' : u.used ? '' : 'off'
      }, React.createElement("td", null, React.createElement("b", {
        style: {
          color: bad ? '#a3172f' : 'var(--ink)'
        }
      }, u.name), u.expected ? React.createElement("small", null, "expected to report") : !u.used ? React.createElement("small", null, "not counted") : null), React.createElement("td", {
        className: "n"
      }, K.has(u.num) ? u.num : '—'), def.formula !== 'count' && def.formula !== 'direct' && React.createElement("td", {
        className: "n"
      }, K.has(u.den) ? u.den : '—', u.carriedFrom ? React.createElement("small", null, "from ", u.carriedFrom) : null), React.createElement("td", {
        className: "n"
      }, React.createElement("b", null, K.has(u.value) ? K.fmt(def, u.value) : '—')), React.createElement("td", null, React.createElement(EvSrc, {
        s: u.source
      })), React.createElement("td", {
        style: {
          fontSize: 11
        }
      }, s ? React.createElement(React.Fragment, null, s.by || '—', s.at ? ' · ' + dayOf(s.at) : '', React.createElement("small", null, "approved by ", s.reviewedBy || '—', s.reviewedAt ? ' · ' + dayOf(s.reviewedAt) : '', s.correction ? ' · correction' : '')) : u.overlayEdited ? React.createElement(React.Fragment, null, "Quality console", React.createElement("small", null, "edited by ", u.overlayEdited.by || 'not recorded', u.overlayEdited.at ? ' · ' + dayOf(u.overlayEdited.at) : '')) : u.entered ? React.createElement(React.Fragment, null, u.entered.by || '—', React.createElement("small", null, dayOf(u.entered.at))) : u.pending && u.pending.length ? React.createElement("span", {
        style: {
          color: '#8a5a00'
        }
      }, "waiting for approval", React.createElement("small", null, "sent by ", u.pending[0].by || '—')) : u.used ? React.createElement("span", {
        className: "kp-muted"
      }, "approved \xB7 submission not traced") : '—'), !compact && React.createElement("td", {
        style: {
          fontSize: 11
        }
      }, u.deviceDays ? React.createElement(React.Fragment, null, u.deviceDays.approved, " ", u.deviceDays.field === 'total' ? 'patient' : u.deviceDays.field, " days", React.createElement("small", null, u.deviceDays.days, " day(s) approved", u.deviceDays.missing || u.deviceDays.waiting ? ' · ' + (u.deviceDays.missing ? u.deviceDays.missing + ' missed' : '') + (u.deviceDays.missing && u.deviceDays.waiting ? ', ' : '') + (u.deviceDays.waiting ? u.deviceDays.waiting + ' waiting' : '') : '')) : '—'));
    })), units.filter(u => u.used).length > 1 && React.createElement("tfoot", null, React.createElement("tr", null, React.createElement("td", null, React.createElement("b", null, "Total used")), React.createElement("td", {
      className: "n"
    }, React.createElement("b", null, K.has(ev.totals.num) ? ev.totals.num : '—')), def.formula !== 'count' && def.formula !== 'direct' && React.createElement("td", {
      className: "n"
    }, React.createElement("b", null, K.has(ev.totals.den) ? ev.totals.den : '—')), React.createElement("td", {
      className: "n"
    }, React.createElement("b", null, K.fmt(def, ev.totals.value))), React.createElement("td", {
      colSpan: compact ? 2 : 3
    }))))), (ev.checks || []).length > 0 ? React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 6
      }
    }, ev.checks.map((c, i) => {
      const a = ackOf(c);
      const meta = K.CHECK_META[c.code] || {};
      return React.createElement("div", {
        key: i,
        className: 'kp-check ' + c.level
      }, React.createElement("span", {
        className: "tag"
      }, c.level === 'error' ? 'Error' : c.level === 'warn' ? 'Warning' : 'Note'), React.createElement("div", {
        style: {
          flex: 1
        }
      }, React.createElement("b", null, meta.title || c.code), " \u2014 ", c.text, !compact && meta.fix && React.createElement("span", {
        className: "fix"
      }, meta.fix), a && React.createElement("span", {
        className: "ack"
      }, a.fingerprint === c.fingerprint ? '✔ Acknowledged by ' + (a.byName || a.by) + ': “' + a.reason + '”' : '✖ An acknowledgement was given for older data — it needs a new one.')));
    })) : ev.started ? React.createElement("div", {
      className: "kp-banner ok",
      style: {
        padding: '7px 12px'
      }
    }, "\u2713 Every check passed for this month.") : null);
  }
  function EvidencePanel({
    def,
    kpiId,
    ym,
    compact
  }) {
    const [j, setJ] = useState(null);
    const [err, setErr] = useState('');
    useEffect(() => {
      let live = true;
      setJ(null);
      setErr('');
      api('/api/kpi/evidence/' + encodeURIComponent(kpiId) + '/' + ym).then(x => {
        if (live) setJ(x);
      }).catch(e => live && setErr(e.message));
      return () => {
        live = false;
      };
    }, [kpiId, ym]);
    if (err) return React.createElement("div", {
      className: "kp-banner"
    }, err);
    if (!j) return React.createElement("div", {
      className: "kp-muted"
    }, "Working out how ", K.fmtMonthLong(ym), " was calculated\u2026");
    return React.createElement(EvidenceView, {
      def: def,
      ev: j.evidence,
      steps: j.steps,
      compact: compact
    });
  }
  const resultOf = r => r.latest ? 'latest: ' + r.latest.label : r.freqMonths > 1 && r.resultLabel ? r.resultLabel : '';
  const ResultTag = ({
    r
  }) => resultOf(r) ? React.createElement("div", {
    className: "kp-muted",
    style: {
      fontSize: 10.5,
      whiteSpace: 'nowrap'
    }
  }, resultOf(r), r.nextDue && r.latest ? ' · next ' + K.fmtMonth(r.nextDue) : '') : null;
  function PeriodsTable({
    row
  }) {
    const list = row.periods || [];
    if (!list.length) return React.createElement("div", {
      className: "kp-muted"
    }, K.freqLabel(row), " \u2014 no period has ended yet", row.nextDue ? '; the first result is due in ' + K.fmtMonthLong(row.nextDue) : '', ".");
    return React.createElement("div", {
      className: "kp-scroll"
    }, React.createElement("table", {
      className: "kp-stbl"
    }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Period"), row.formula !== 'direct' && React.createElement("th", null, row.numLabel || 'Numerator'), row.formula !== 'direct' && row.formula !== 'count' && React.createElement("th", null, row.denLabel || 'Denominator'), React.createElement("th", null, "Value"), React.createElement("th", null, "Target"), React.createElement("th", null, "Status"))), React.createElement("tbody", null, list.map(pp => React.createElement("tr", {
      key: pp.to
    }, React.createElement("td", {
      className: "l"
    }, React.createElement("b", null, pp.label), !pp.inReport ? React.createElement("span", {
      className: "kp-muted"
    }, " \xB7 before this report") : null), row.formula !== 'direct' && React.createElement("td", null, K.has(pp.num) ? pp.num : '—'), row.formula !== 'direct' && row.formula !== 'count' && React.createElement("td", null, K.has(pp.den) ? pp.den : '—'), React.createElement("td", null, React.createElement("b", null, K.fmt(row, pp.value))), React.createElement("td", null, K.has(pp.target) ? K.fmt(row, pp.target) : '—'), React.createElement("td", null, React.createElement(Pill, {
      s: pp.status
    })))))));
  }
  function KpiDrawer({
    row,
    cfg,
    onClose,
    setRoute,
    canEnter,
    showCalc
  }) {
    const [tab, setTab] = useState(showCalc ? 'calc' : 'overview');
    const monthsAll = Object.keys(row.cells || {}).filter(m => (row.cells[m] || {}).source !== 'not-due');
    const [calcMonth, setCalcMonth] = useState(monthsAll[monthsAll.length - 1]);
    const [kind, setKind] = useState(() => lsGet('kpi_chart') || 'area');
    useEffect(() => {
      lsSet('kpi_chart', kind);
    }, [kind]);
    useEffect(() => {
      const k = e => {
        if (e.key === 'Escape') onClose();
      };
      document.addEventListener('keydown', k);
      return () => document.removeEventListener('keydown', k);
    }, [onClose]);
    const p = K.pillarOf(cfg, row.pillar);
    const months = Object.keys(row.cells || {});
    return React.createElement("div", {
      className: "kp-back",
      style: {
        justifyContent: 'flex-end',
        padding: 0
      },
      onMouseDown: e => e.target === e.currentTarget && onClose()
    }, React.createElement("div", {
      className: "kp-drawer",
      role: "dialog",
      "aria-label": row.name
    }, React.createElement("div", {
      style: {
        background: 'linear-gradient(125deg,#00293A,' + (p.color === '#00293A' ? '#0c6f7d' : p.color) + ')',
        color: '#fff',
        padding: '16px 20px'
      }
    }, React.createElement("div", {
      style: {
        display: 'flex',
        gap: 10,
        alignItems: 'center'
      }
    }, React.createElement("span", {
      className: "kp-code",
      style: {
        background: 'rgba(255,255,255,.2)'
      }
    }, row.code || '•'), React.createElement("span", {
      style: {
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 1,
        textTransform: 'uppercase',
        opacity: 0.85
      }
    }, p.label), React.createElement("button", {
      className: "kp-x",
      style: {
        color: '#fff'
      },
      onClick: onClose,
      "aria-label": "Close"
    }, "\xD7")), React.createElement("h3", {
      style: {
        margin: '8px 0 2px',
        fontSize: 19
      }
    }, row.name), React.createElement("div", {
      style: {
        fontSize: 12,
        opacity: 0.85
      }
    }, row.objective)), React.createElement("div", {
      className: "kp-tabs"
    }, [['overview', 'Overview'], ['calc', 'How it is calculated']].map(([k, l]) => React.createElement("button", {
      key: k,
      className: tab === k ? 'on' : '',
      onClick: () => setTab(k)
    }, l))), tab === 'calc' && React.createElement("div", {
      className: "kp-dlg-b",
      style: {
        gap: 12
      }
    }, monthsAll.length ? React.createElement(React.Fragment, null, React.createElement("div", {
      className: "kp-chips"
    }, monthsAll.map(m => React.createElement("button", {
      key: m,
      className: 'kp-chip' + (calcMonth === m ? ' on' : ''),
      onClick: () => setCalcMonth(m)
    }, row.freqMonths > 1 ? K.periodOf(row, m, cfg).label : K.fmtMonth(m)))), React.createElement(EvidencePanel, {
      def: row,
      kpiId: row.kpiId,
      ym: calcMonth || monthsAll[monthsAll.length - 1]
    })) : React.createElement("div", {
      className: "kp-muted"
    }, K.freqLabel(row), " \u2014 no period ends inside this report", row.latest ? '; the result shown is ' + row.latest.label + ' (open a report that includes ' + K.fmtMonth(row.latest.to) + ' to see its calculation)' : '', ".")), tab === 'overview' && React.createElement("div", {
      className: "kp-dlg-b",
      style: {
        gap: 14
      }
    }, React.createElement("div", {
      className: "kp-row",
      style: {
        alignItems: 'stretch'
      }
    }, [['Current', K.fmt(row, row.period.value), resultOf(row) || (row.unit && K.unitKind(row) === 'num' ? row.unit : months.length > 1 ? months.length + ' months pooled' : K.fmtMonthLong(months[0]))], ['Target', row.target != null ? K.fmt(row, row.target) : '—', row.goalDirection === 'lower_is_better' ? 'lower is better' : 'higher is better'], ['Variance', K.gapLabel(row, row.period.value, row.target), row.achievement != null ? row.achievement + '% of target' : '']].map(([l, v, s], i) => React.createElement("div", {
      key: i,
      className: "kp-card kp-pad",
      style: {
        minWidth: 120
      }
    }, React.createElement("div", {
      className: "kp-lab"
    }, l), React.createElement("div", {
      style: {
        fontSize: 22,
        fontWeight: 800,
        color: i === 2 ? ST[row.status].color : '#00293A'
      }
    }, v), React.createElement("div", {
      className: "kp-muted",
      style: {
        fontSize: 11
      }
    }, s)))), React.createElement("div", {
      style: {
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        flexWrap: 'wrap'
      }
    }, React.createElement(Pill, {
      s: row.status
    }), React.createElement(Trend, {
      d: row.trendDir
    }), row.linked && React.createElement("span", {
      className: "kp-muted"
    }, "\xB7 filled from the hospital's quality data")), React.createElement("div", {
      className: "kp-muted",
      style: {
        fontSize: 11.5
      }
    }, React.createElement("b", {
      style: {
        color: 'var(--ink-2)'
      }
    }, "Tracking:"), " ", row.schedule, row.nextDue ? ' · next result ' + K.fmtMonthLong(row.nextDue) : ''), React.createElement("div", {
      className: "kp-card"
    }, React.createElement("div", {
      className: "kp-h"
    }, React.createElement("h3", null, row.freqMonths > 1 ? 'Last 12 months · one point per period' : 'Last 12 months'), React.createElement("span", {
      className: "grow"
    }), React.createElement("div", {
      className: "kp-chips"
    }, CHARTS.map(([k, l]) => React.createElement("button", {
      key: k,
      className: 'kp-chip' + (kind === k ? ' on' : ''),
      onClick: () => setKind(k)
    }, l)))), React.createElement("div", {
      className: "kp-pad"
    }, React.createElement(KpiChart, {
      row: row,
      kind: kind
    }))), row.freqMonths > 1 ? React.createElement(PeriodsTable, {
      row: row
    }) : React.createElement("div", {
      className: "kp-scroll"
    }, React.createElement("table", {
      className: "kp-stbl"
    }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Month"), months.map(m => React.createElement("th", {
      key: m
    }, K.fmtMonth(m))))), React.createElement("tbody", null, React.createElement("tr", null, React.createElement("td", {
      className: "l"
    }, React.createElement("b", null, "Value")), months.map(m => React.createElement("td", {
      key: m
    }, React.createElement("b", null, K.fmt(row, row.cells[m].value))))), row.formula !== 'direct' && React.createElement("tr", null, React.createElement("td", {
      className: "l"
    }, row.numLabel || 'Numerator'), months.map(m => React.createElement("td", {
      key: m
    }, K.has(row.cells[m].num) ? row.cells[m].num : '—'))), row.formula !== 'direct' && row.formula !== 'count' && React.createElement("tr", null, React.createElement("td", {
      className: "l"
    }, row.denLabel || 'Denominator'), months.map(m => React.createElement("td", {
      key: m
    }, K.has(row.cells[m].den) ? row.cells[m].den : '—'))), React.createElement("tr", null, React.createElement("td", {
      className: "l kp-muted"
    }, "Source"), months.map(m => React.createElement("td", {
      key: m
    }, React.createElement(Src, {
      s: row.cells[m].source
    }))))))), React.createElement("div", null, React.createElement("span", {
      className: "kp-lab"
    }, "Formula"), React.createElement("div", {
      style: {
        fontSize: 12.5,
        fontStyle: 'italic'
      }
    }, row.formulaText || '—')), React.createElement("div", null, React.createElement("span", {
      className: "kp-lab"
    }, "Action plan (", (row.actions || []).length, ")"), (row.actions || []).length ? row.actions.map(a => React.createElement("div", {
      className: "kp-act",
      key: a.id
    }, React.createElement("span", {
      className: "kp-pill",
      style: {
        background: a.status === 'done' ? '#e7f6ed' : a.status === 'progress' ? '#e1f1fa' : '#f3f5f8',
        color: a.status === 'done' ? '#14713f' : a.status === 'progress' ? '#0b4f6c' : '#5b6878',
        fontSize: 10
      }
    }, K.ACTION_LABEL[a.status]), React.createElement("span", {
      style: {
        flex: 1
      }
    }, a.text, a.owner ? React.createElement("span", {
      className: "kp-muted"
    }, " \u2014 ", a.owner) : null), a.due && React.createElement("span", {
      className: "kp-muted"
    }, K.fmtMonth(a.due)))) : React.createElement("div", {
      className: "kp-muted"
    }, "No action plan yet.")), row.remarks && React.createElement("div", null, React.createElement("span", {
      className: "kp-lab"
    }, "Remarks"), React.createElement("div", {
      style: {
        fontSize: 12.5,
        whiteSpace: 'pre-wrap'
      }
    }, row.remarks))), React.createElement("div", {
      className: "kp-dlg-f"
    }, canEnter && React.createElement(Btn, {
      pri: true,
      onClick: () => {
        onClose();
        setRoute({
          view: 'kpiEntry',
          kpi: row.kpiId
        });
      }
    }, "Enter / edit figures"), React.createElement(Btn, {
      onClick: () => {
        onClose();
        setRoute({
          view: 'kpiActions',
          kpi: row.kpiId
        });
      }
    }, "Action plans"), React.createElement("span", {
      style: {
        flex: 1
      }
    }), React.createElement(Btn, {
      onClick: onClose
    }, "Close"))));
  }
  function Dashboard({
    meta,
    setRoute,
    showCalc
  }) {
    const [p, setP, range] = usePeriod(meta, 'dash', '6m');
    const [rep, setRep] = useState(null);
    const [err, setErr] = useState('');
    const [fPillar, setFPillar] = useState('');
    const [fStatus, setFStatus] = useState('');
    const [open, setOpen] = useState(null);
    const cfg = meta.config;
    useEffect(() => {
      if (!range) return;
      let live = true;
      setErr('');
      api('/api/kpi/report/' + K.reportId(range.from, range.to)).then(j => {
        if (live) setRep(j.report);
      }).catch(e => live && setErr(e.message));
      return () => {
        live = false;
      };
    }, [range && range.from, range && range.to]);
    const rows = rep ? rep.rows : [];
    const sum = rep ? rep.summary : null;
    const shown = rows.filter(r => (!fPillar || r.pillar === fPillar) && (!fStatus || (fStatus === 'nodata' ? r.status === 'nodata' || r.status === 'notarget' || r.status === 'notstarted' || r.status === 'notdue' : r.status === fStatus)));
    const pillars = cfg.pillars.filter(x => rows.some(r => r.pillar === x.id));
    const scored = shown.filter(r => r.achievement != null);
    const canEnter = meta.canAdd || meta.canEdit;
    const tiles = [['met', 'On target'], ['near', 'Close to target'], ['off', 'Needs action'], ['nodata', 'No data / no target']];
    return React.createElement("div", {
      className: "kp-wrap"
    }, React.createElement("div", {
      className: "kp-card kp-bar"
    }, React.createElement(PeriodPicker, {
      meta: meta,
      p: p,
      setP: setP,
      range: range,
      presets: ['1m', '3m', '6m', '12m', 'year', 'cycle1', 'cycle2', 'custom']
    }), rep && rep.state === 'final' && React.createElement("span", {
      className: "kp-pill",
      style: {
        background: '#e7f6ed',
        color: '#14713f'
      }
    }, "Showing the final report")), err && React.createElement("div", {
      className: "kp-banner"
    }, err), !rep && !err && React.createElement("div", {
      className: "kp-card kp-empty"
    }, "Working out where every KPI stands\u2026"), rep && React.createElement(React.Fragment, null, React.createElement("div", {
      className: "kp-tiles kp-rise"
    }, React.createElement("div", {
      className: "kp-tile kp-score",
      style: {
        background: 'linear-gradient(140deg,#00293A,#0c6f7d)',
        color: '#fff',
        border: 0,
        cursor: 'default'
      }
    }, React.createElement(ScoreRing, {
      score: sum.score,
      size: 92
    }), React.createElement("div", {
      style: {
        minWidth: 0
      }
    }, React.createElement("div", {
      style: {
        fontSize: 13,
        fontWeight: 800
      }
    }, "KPI score"), React.createElement("div", {
      style: {
        fontSize: 11.5,
        opacity: 0.8,
        marginTop: 3,
        lineHeight: 1.35
      }
    }, sum.scored ? sum.met + ' of ' + sum.scored + ' KPIs with a target and data are on target' : 'No KPI has both data and a target yet'))), tiles.map(([k, l]) => {
      const n = k === 'nodata' ? sum.nodata + sum.notarget + (sum.notstarted || 0) + (sum.notdue || 0) : sum[k];
      return React.createElement("div", {
        key: k,
        className: 'kp-tile' + (fStatus === k ? ' sel' : ''),
        onClick: () => setFStatus(fStatus === k ? '' : k),
        title: "Click to show only these"
      }, React.createElement("span", {
        className: "ring",
        style: {
          background: ST[k].color
        }
      }), React.createElement("div", {
        className: "n",
        style: {
          color: ST[k].color
        }
      }, n), React.createElement("div", {
        className: "l",
        style: {
          color: ST[k].ink
        }
      }, l), React.createElement("div", {
        className: "s"
      }, k === 'met' && sum.improving ? sum.improving + ' improving overall' : k === 'off' && sum.worsening ? sum.worsening + ' worsening overall' : 'of ' + sum.total + ' KPIs'));
    })), React.createElement("div", {
      className: "kp-grid3 kp-rise",
      style: {
        animationDelay: '.05s'
      }
    }, pillars.map(pl => {
      const list = rows.filter(r => r.pillar === pl.id),
        c = K.summarize(list);
      return React.createElement("div", {
        key: pl.id,
        className: 'kp-pillar' + (fPillar === pl.id ? ' sel' : ''),
        onClick: () => setFPillar(fPillar === pl.id ? '' : pl.id)
      }, React.createElement("div", {
        className: "top",
        style: {
          background: 'linear-gradient(120deg,' + pl.color + ',' + shade(pl.color, 40) + ')'
        }
      }, React.createElement("b", null, pl.label), React.createElement("span", {
        style: {
          fontSize: 22,
          fontWeight: 800
        }
      }, list.length)), React.createElement("div", {
        className: "seg"
      }, ['met', 'near', 'off', 'notarget', 'nodata', 'notstarted', 'notdue'].map(k => c[k] ? React.createElement("span", {
        key: k,
        style: {
          flex: c[k],
          background: ST[k].color
        }
      }) : null)), React.createElement("ul", null, list.map(r => React.createElement("li", {
        key: r.kpiId,
        onClick: e => {
          e.stopPropagation();
          setOpen(r);
        }
      }, React.createElement("i", {
        style: {
          background: ST[r.status].color
        }
      }), React.createElement("span", null, r.code, " ", r.name), React.createElement("b", {
        style: {
          fontVariantNumeric: 'tabular-nums'
        }
      }, K.fmt(r, r.period.value))))));
    })), React.createElement("div", {
      className: "kp-grid2 kp-rise",
      style: {
        animationDelay: '.1s'
      }
    }, React.createElement("div", {
      className: "kp-card"
    }, React.createElement("div", {
      className: "kp-h"
    }, React.createElement("h3", null, "Achievement against target"), React.createElement("span", {
      className: "kp-muted"
    }, "100 = exactly on target \xB7 click a bar")), React.createElement("div", {
      className: "kp-pad"
    }, scored.length ? React.createElement(Iso3D, {
      items: scored.map(r => ({
        label: r.code || r.name,
        value: r.achievement,
        color: ST[r.status].color,
        title: r.code + ' ' + r.name + ': ' + K.fmt(r, r.period.value) + ' against ' + K.fmt(r, r.target) + ' (' + r.achievement + '%)',
        row: r
      })),
      max: 150,
      refLine: 100,
      refLabel: "On target",
      onPick: d => setOpen(d.row)
    }) : React.createElement("div", {
      className: "kp-empty"
    }, "No KPI has both figures and a target in this period yet."))), React.createElement("div", {
      className: "kp-card"
    }, React.createElement("div", {
      className: "kp-h"
    }, React.createElement("h3", null, "Status by pillar")), React.createElement("div", {
      className: "kp-pad"
    }, React.createElement(Iso3DStack, {
      groups: pillars.map(pl => {
        const c = K.summarize(rows.filter(r => r.pillar === pl.id));
        return {
          id: pl.id,
          label: pl.label,
          parts: [{
            value: c.met,
            color: ST.met.color,
            label: 'on target'
          }, {
            value: c.near,
            color: ST.near.color,
            label: 'close'
          }, {
            value: c.off,
            color: ST.off.color,
            label: 'need action'
          }, {
            value: c.nodata + c.notarget + (c.notstarted || 0) + (c.notdue || 0),
            color: ST.nodata.color,
            label: 'no data / target'
          }]
        };
      }),
      onPick: g => setFPillar(fPillar === g.id ? '' : g.id)
    }), React.createElement("div", {
      className: "kp-legend",
      style: {
        justifyContent: 'center',
        marginTop: 6
      }
    }, [['met', 'On target'], ['near', 'Close'], ['off', 'Needs action'], ['nodata', 'No data / target']].map(([k, l]) => React.createElement("span", {
      key: k
    }, React.createElement("i", {
      className: "kp-dot",
      style: {
        background: ST[k].color
      }
    }), l)))))), React.createElement("div", {
      className: "kp-card kp-rise",
      style: {
        animationDelay: '.15s'
      }
    }, React.createElement("div", {
      className: "kp-h"
    }, React.createElement("h3", null, "Scorecard"), React.createElement("span", {
      className: "kp-muted"
    }, shown.length, " of ", rows.length, " KPIs", fPillar || fStatus ? ' · filtered' : ''), React.createElement("span", {
      className: "grow"
    }), (fPillar || fStatus) && React.createElement(Btn, {
      onClick: () => {
        setFPillar('');
        setFStatus('');
      }
    }, "Show all"), React.createElement(Btn, {
      onClick: () => setRoute({
        view: 'kpiReports'
      })
    }, "Reports"), canEnter && React.createElement(Btn, {
      pri: true,
      onClick: () => setRoute({
        view: 'kpiEntry'
      })
    }, "Enter this month's data")), React.createElement("div", {
      className: "kp-scroll"
    }, React.createElement("table", {
      className: "kp-tbl"
    }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "#"), React.createElement("th", null, "KPI"), React.createElement("th", null, "Last 12 months"), React.createElement("th", {
      style: {
        textAlign: 'right'
      }
    }, rep.months.length > 1 ? 'Period' : 'Current'), React.createElement("th", {
      style: {
        textAlign: 'right'
      }
    }, "Target"), React.createElement("th", null, "Variance"), React.createElement("th", null, "Status"), React.createElement("th", null, "Trend"))), React.createElement("tbody", null, shown.map(r => React.createElement("tr", {
      key: r.kpiId,
      onClick: () => setOpen(r)
    }, React.createElement("td", null, React.createElement(Code, {
      r: r,
      cfg: cfg
    })), React.createElement("td", null, React.createElement("div", {
      style: {
        fontWeight: 700,
        color: 'var(--ink)'
      }
    }, r.name), React.createElement("div", {
      className: "kp-muted",
      style: {
        fontSize: 11
      }
    }, r.unit, r.linked ? ' · from quality data' : '', r.freqMonths > 1 ? ' · ' + K.freqLabel(r, true).toLowerCase() : '')), React.createElement("td", null, React.createElement(Spark, {
      row: r
    })), React.createElement("td", {
      className: "num"
    }, React.createElement("b", {
      style: {
        fontSize: 14
      }
    }, K.fmt(r, r.period.value)), React.createElement(ResultTag, {
      r: r
    })), React.createElement("td", {
      className: "num"
    }, r.target != null ? K.fmt(r, r.target) : '—'), React.createElement("td", {
      style: {
        fontSize: 12,
        color: ST[r.status].ink,
        whiteSpace: 'nowrap'
      }
    }, K.gapLabel(r, r.period.value, r.target)), React.createElement("td", null, React.createElement(Pill, {
      s: r.status
    })), React.createElement("td", null, React.createElement(Trend, {
      d: r.trendDir
    })))))), !shown.length && React.createElement("div", {
      className: "kp-empty"
    }, "No KPI matches this filter.")))), open && React.createElement(KpiDrawer, {
      row: open,
      cfg: cfg,
      onClose: () => setOpen(null),
      setRoute: setRoute,
      canEnter: canEnter,
      showCalc: showCalc
    }));
  }
  function StartDialog({
    meta,
    def,
    suggest,
    onClose,
    onSaved
  }) {
    const cfg = meta.config;
    const [m, setM] = useState(suggest || def.startMonth || '');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const eff = K.isMonth(m) ? m : cfg.cycleStart;
    async function save(value) {
      setBusy(true);
      setErr('');
      try {
        await api('/api/kpi/defs/' + encodeURIComponent(def.id), {
          method: 'PUT',
          body: JSON.stringify({
            startMonth: K.isMonth(value) ? value : null,
            baseUpdatedAt: def.updatedAt
          })
        });
        toast(def.name + ' — counting starts ' + K.fmtMonthLong(K.isMonth(value) ? value : cfg.cycleStart) + '.', 'success');
        onSaved();
      } catch (e) {
        setErr(e.message);
        setBusy(false);
      }
    }
    return React.createElement("div", {
      className: "kp-back",
      onMouseDown: e => e.target === e.currentTarget && onClose()
    }, React.createElement("div", {
      className: "kp-dlg",
      role: "dialog"
    }, React.createElement("div", {
      className: "kp-dlg-h"
    }, React.createElement("span", {
      className: "kp-code",
      style: {
        background: K.pillarOf(cfg, def.pillar).color,
        marginTop: 2
      }
    }, def.code || '•'), React.createElement("div", null, React.createElement("h3", null, "When does ", def.name, " start?"), React.createElement("div", {
      className: "kp-muted"
    }, "Cycles, targets and the missing-data checks count from this month. Earlier months are kept but not counted.")), React.createElement("button", {
      className: "kp-x",
      onClick: onClose
    }, "\xD7")), React.createElement("div", {
      className: "kp-dlg-b"
    }, React.createElement("label", {
      className: "kp-fld"
    }, React.createElement("span", {
      className: "kp-lab"
    }, "This KPI starts on"), React.createElement("div", {
      style: {
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        flexWrap: 'wrap'
      }
    }, React.createElement("input", {
      type: "month",
      className: "kp-in",
      value: m,
      max: meta.thisMonth,
      onChange: e => setM(e.target.value)
    }), React.createElement("span", {
      className: "kp-muted"
    }, K.isMonth(m) ? '' : 'blank = the same as all KPIs (' + K.fmtMonthLong(cfg.cycleStart) + ')'))), React.createElement("div", {
      className: "kp-banner info",
      style: {
        display: 'block'
      }
    }, Array.from({
      length: cfg.cycles
    }, (_, i) => {
      const r = K.cycleRange(i + 1, cfg, {
        startMonth: eff
      });
      return 'Cycle ' + (i + 1) + ': ' + K.fmtRange(r.from, r.to);
    }).join(' · ')), err && React.createElement("div", {
      className: "kp-err"
    }, err)), React.createElement("div", {
      className: "kp-dlg-f"
    }, React.createElement(Btn, {
      pri: true,
      disabled: busy || m && !K.isMonth(m),
      onClick: () => save(m)
    }, "Save"), def.startMonth && React.createElement(Btn, {
      disabled: busy,
      onClick: () => save(null)
    }, "Same as all KPIs"), React.createElement("span", {
      style: {
        flex: 1
      }
    }), React.createElement(Btn, {
      onClick: onClose
    }, "Cancel"))));
  }
  function EntryDialog({
    meta,
    def,
    ym,
    cell,
    onClose,
    onSaved,
    showCalc,
    checks,
    onStartHere
  }) {
    const f = def.formula;
    const saved = cell.source === 'manual' || cell.source === 'edited';
    const may = saved ? meta.canEdit : meta.canAdd || meta.canEdit;
    const start = saved ? cell : cell.auto || {};
    const [num, setNum] = useState(K.has(start.num) ? String(start.num) : '');
    const [den, setDen] = useState(K.has(start.den) ? String(start.den) : '');
    const [val, setVal] = useState(f === 'direct' && K.has(start.value) ? String(start.value) : '');
    const [note, setNote] = useState(cell.note || '');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const [needNote, setNeedNote] = useState(false);
    const [openCalc, setOpenCalc] = useState(!!showCalc);
    const first = useRef(null),
      noteRef = useRef(null);
    useEffect(() => {
      if (first.current) first.current.focus();
    }, []);
    const entry = {
      num,
      den,
      value: val
    };
    const live = f === 'direct' ? K.has(val) ? Number(val) : null : K.computeValue(f, num, f === 'count' ? null : den);
    const target = K.targetFor(def, ym, meta.config);
    const st = K.statusOf(def, live, target, meta.config);
    const per = K.freqOf(def) > 1 && !cell.notStarted ? K.periodOf(def, ym, meta.config) : null;
    const when2 = per ? per.label : K.fmtMonth(ym);
    const problem = num || den || val ? K.validateEntry(def, entry) : null;
    const overriding = !!(cell.auto && K.has(cell.auto.value));
    const fillFrom = x => {
      setNum(K.has(x.num) ? String(x.num) : '');
      setDen(K.has(x.den) ? String(x.den) : '');
      if (f === 'direct') setVal(K.has(x.value) ? String(x.value) : '');
    };
    async function save(next, confirmed) {
      const e = K.validateEntry(def, entry);
      if (e) {
        setErr(e);
        return;
      }
      if (overriding && !note.trim()) {
        setNeedNote(true);
        setErr('Say why the system figure (' + K.fmt(def, cell.auto.value) + ') is being changed — the reason is printed on the report.');
        if (noteRef.current) noteRef.current.focus();
        return;
      }
      setBusy(true);
      setErr('');
      try {
        const j = await api('/api/kpi/values/' + encodeURIComponent(def.id) + '/' + ym, {
          method: 'PUT',
          body: JSON.stringify({
            num,
            den,
            value: val,
            note,
            confirm: confirmed === true ? true : undefined,
            baseUpdatedAt: saved ? cell.savedAt : undefined
          })
        });
        toast(def.name + ' · ' + when2 + ' saved: ' + K.fmt(def, j.cell.value), 'success');
        onSaved(j.cell, next);
      } catch (x) {
        setBusy(false);
        const code = x.body && x.body.code;
        if (code === 'confirm') {
          const ok = await confirmBox({
            title: 'Is this figure right?',
            message: x.message,
            confirmLabel: 'Yes, it is right — save it'
          });
          if (ok) return save(next, true);
          setErr('Not saved. Check the figures.');
          return;
        }
        if (code === 'note') {
          setNeedNote(true);
          if (noteRef.current) noteRef.current.focus();
        }
        setErr(x.message);
        if (x.status === 409) onSaved(null);
      }
    }
    async function revert() {
      const ok = await confirmBox({
        title: cell.source === 'edited' ? 'Go back to the system figure?' : per ? 'Clear this period?' : 'Clear this month?',
        message: cell.source === 'edited' ? 'Your figure (' + K.fmt(def, cell.value) + ') is removed and ' + when2 + ' shows the system figure again (' + K.fmt(def, cell.auto && cell.auto.value) + '). The change is kept in the history.' : 'The figure for ' + when2 + ' is removed. It is kept in the history.',
        confirmLabel: cell.source === 'edited' ? 'Use system figure' : 'Clear',
        danger: cell.source !== 'edited'
      });
      if (!ok) return;
      setBusy(true);
      try {
        const j = await api('/api/kpi/values/' + encodeURIComponent(def.id) + '/' + ym, {
          method: 'DELETE'
        });
        toast('Done.', 'success');
        onSaved(j.cell);
      } catch (x) {
        setErr(x.message);
        setBusy(false);
      }
    }
    const onKey = e => {
      if (e.key === 'Enter' && !e.shiftKey && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        if (may && !busy) save(true);
      }
      if (e.key === 'Escape') onClose();
    };
    const numIn = (v, set, label, hint, ref) => React.createElement("label", {
      className: "kp-fld"
    }, React.createElement("span", {
      className: "kp-lab"
    }, label), React.createElement("input", {
      ref: ref,
      className: "kp-in",
      inputMode: "decimal",
      value: v,
      disabled: !may,
      onChange: e => set(e.target.value.replace(/[^0-9.\-]/g, '')),
      style: {
        fontSize: 16,
        fontWeight: 700
      }
    }), hint && React.createElement("span", {
      className: "hint"
    }, hint));
    return React.createElement("div", {
      className: "kp-back",
      onMouseDown: e => e.target === e.currentTarget && onClose(),
      onKeyDown: onKey
    }, React.createElement("div", {
      className: "kp-dlg",
      role: "dialog",
      "aria-label": def.name + ' ' + when2
    }, React.createElement("div", {
      className: "kp-dlg-h"
    }, React.createElement("span", {
      className: "kp-code",
      style: {
        background: K.pillarOf(meta.config, def.pillar).color,
        marginTop: 2
      }
    }, def.code || '•'), React.createElement("div", null, React.createElement("h3", null, def.name, per ? ' — ' + per.label : ''), React.createElement("div", {
      className: "kp-muted"
    }, per ? K.freqLabel(def) + ' · entered in ' + K.fmtMonthLong(ym) : K.fmtMonthLong(ym), " \xB7 ", def.unit, target != null ? ' · target ' + K.fmt(def, target) : '')), React.createElement("button", {
      className: "kp-x",
      onClick: onClose,
      "aria-label": "Close"
    }, "\xD7")), React.createElement("div", {
      className: "kp-dlg-b"
    }, cell.notStarted && React.createElement("div", {
      className: "kp-banner info"
    }, React.createElement("div", null, "This KPI starts in ", K.fmtMonthLong(K.startOf(def, meta.config)), ". A figure for ", K.fmtMonthLong(ym), " can be kept for reference, but it is not counted in any report.", meta.canEdit && onStartHere && React.createElement(React.Fragment, null, React.createElement("br", null), React.createElement("button", {
      onClick: () => onStartHere(ym)
    }, "Start this KPI from ", K.fmtMonthLong(ym))))), per && React.createElement("div", {
      className: "kp-banner info"
    }, React.createElement("div", null, React.createElement("b", null, "One figure for ", per.label, "."), " ", def.name, " is measured ", K.freqLabel(def, true).toLowerCase(), def.source && def.source.indId ? ' — the system figure pools the units’ monthly figures over the ' + per.months + ' months (Σ ' + (def.numLabel || 'numerator').toLowerCase() + ' ÷ Σ ' + (def.denLabel || 'denominator').toLowerCase() + ').' : ' — type the result of the period (e.g. the survey) here.')), cell.auto && React.createElement("div", {
      className: "kp-sys"
    }, React.createElement("b", null, "System figure: ", K.fmt(def, cell.auto.value)), React.createElement("span", null, K.has(cell.auto.num) ? cell.auto.num + (K.has(cell.auto.den) ? ' ÷ ' + cell.auto.den : '') : ''), React.createElement("span", {
      style: {
        opacity: 0.8
      }
    }, srcOf(cell.auto.source).long, per && cell.auto.months ? ' · ' + cell.auto.months + ' of ' + per.months + ' months have figures' : '', cell.auto.areas ? ' · ' + cell.auto.areas + ' unit(s)' : '', cell.auto.incomplete ? ' · some units have no denominator' : '', cell.auto.carriedFrom ? ' · headcount from ' + cell.auto.carriedFrom : ''), may && saved && React.createElement("button", {
      className: "kp-icon-btn",
      onClick: () => fillFrom(cell.auto)
    }, "Copy into the form")), cell.hint && React.createElement("div", {
      className: "kp-sys",
      style: {
        background: '#f6f9fc',
        borderColor: '#d9e2ec',
        color: '#3a4656'
      }
    }, React.createElement("span", null, React.createElement("b", null, "Auto-fill is off"), " for this KPI \u2014 the quality data has ", React.createElement("b", null, K.fmt(def, cell.hint.value)), K.has(cell.hint.num) ? ' (' + cell.hint.num + (K.has(cell.hint.den) ? ' ÷ ' + cell.hint.den : '') + ')' : '', "."), may && React.createElement("button", {
      className: "kp-icon-btn",
      onClick: () => fillFrom(cell.hint)
    }, "Use it")), (() => {
      const by = {};
      (checks || []).forEach(c => {
        (by[c.code] = by[c.code] || []).push(c);
      });
      return Object.keys(by).map(code => {
        const list = by[code],
          meta2 = K.CHECK_META[code] || {},
          lvl = list[0].level;
        return React.createElement("div", {
          key: code,
          className: 'kp-check ' + lvl
        }, React.createElement("span", {
          className: "tag"
        }, lvl === 'error' ? 'Error' : 'Warning'), React.createElement("div", null, React.createElement("b", null, list.length > 1 ? list.length + ' × ' : '', meta2.title || code), " \u2014 ", list.length > 2 ? list.slice(0, 2).map(c => c.text).join(' ') + ' + ' + (list.length - 2) + ' more.' : list.map(c => c.text).join(' '), meta2.fix && React.createElement("span", {
          className: "fix"
        }, meta2.fix)));
      });
    })(), (cell.auto || cell.hint) && def.source && def.source.indId && React.createElement("div", {
      className: "kp-card",
      style: {
        boxShadow: 'none'
      }
    }, React.createElement("button", {
      className: "kp-h",
      style: {
        width: '100%',
        border: 0,
        background: 'transparent',
        cursor: 'pointer',
        font: 'inherit',
        textAlign: 'left'
      },
      onClick: () => setOpenCalc(!openCalc)
    }, React.createElement("h3", {
      style: {
        fontSize: 13
      }
    }, "How the system figure was calculated"), React.createElement("span", {
      className: "grow"
    }), React.createElement("span", {
      className: "kp-muted"
    }, openCalc ? 'Hide ▲' : 'Show ▼')), openCalc && React.createElement("div", {
      className: "kp-pad"
    }, React.createElement(EvidencePanel, {
      def: def,
      kpiId: def.id,
      ym: ym,
      compact: true
    }))), cell.source === 'partial' && React.createElement("div", {
      className: "kp-banner"
    }, "Events were reported for this month but the denominator is missing in the quality data (for CLABSI / CAUTI / VAP: the device days). Type the full figures here, or complete the quality data."), f === 'direct' ? numIn(val, setVal, 'Value (' + (def.unit || '') + ')', def.formulaText, first) : React.createElement("div", {
      className: "kp-row"
    }, numIn(num, setNum, def.numLabel || 'Numerator', null, first), f !== 'count' && numIn(den, setDen, def.denLabel || 'Denominator')), React.createElement("div", {
      style: {
        display: 'flex',
        gap: 16,
        alignItems: 'center',
        flexWrap: 'wrap',
        padding: '10px 12px',
        borderRadius: 12,
        background: '#f6f9fc'
      }
    }, React.createElement("div", null, React.createElement("div", {
      className: "kp-lab"
    }, "Result"), React.createElement("div", {
      className: "kp-big"
    }, K.fmt(def, live))), React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 180
      }
    }, live != null && React.createElement(Pill, {
      s: st
    }), React.createElement("div", {
      className: "kp-muted",
      style: {
        marginTop: 5,
        fontStyle: 'italic'
      }
    }, def.formulaText))), problem && React.createElement("div", {
      className: "kp-err"
    }, problem), React.createElement("label", {
      className: "kp-fld"
    }, React.createElement("span", {
      className: "kp-lab",
      style: needNote ? {
        color: '#a3172f'
      } : undefined
    }, overriding ? 'Reason for changing the system figure (required — printed on the report)' : 'Note (optional)'), React.createElement("textarea", {
      ref: noteRef,
      className: "kp-in",
      rows: 2,
      value: note,
      disabled: !may,
      onChange: e => {
        setNote(e.target.value);
        if (e.target.value.trim()) setNeedNote(false);
      },
      style: needNote ? {
        borderColor: '#d23a52',
        background: '#fff6f7'
      } : undefined,
      placeholder: overriding ? 'e.g. one case reclassified after the infection-control review on 3 Nov' : 'Where the figure comes from — e.g. HR exit list, audit of 40 files'
    })), saved && cell.savedBy && React.createElement("div", {
      className: "kp-muted"
    }, "Last saved by ", cell.savedBy, " \xB7 ", when(cell.savedAt)), !may && React.createElement("div", {
      className: "kp-banner info"
    }, saved ? 'Changing a saved figure needs the Nursing KPI “Edit” permission.' : 'Entering figures needs the Nursing KPI “Add” permission.'), err && React.createElement("div", {
      className: "kp-err"
    }, err)), React.createElement("div", {
      className: "kp-dlg-f"
    }, may && React.createElement(Btn, {
      pri: true,
      disabled: busy,
      onClick: () => save(true)
    }, "Save & next"), may && React.createElement(Btn, {
      disabled: busy,
      onClick: () => save(false)
    }, "Save"), saved && (meta.canEdit || meta.canDelete) && React.createElement(Btn, {
      disabled: busy,
      danger: cell.source !== 'edited',
      onClick: revert
    }, cell.source === 'edited' ? 'Revert to system figure' : 'Clear'), React.createElement("span", {
      style: {
        flex: 1
      }
    }), React.createElement("span", {
      className: "kp-muted",
      style: {
        fontSize: 11
      }
    }, "Enter = save & next \xB7 Esc = close"), React.createElement(Btn, {
      onClick: onClose
    }, "Cancel"))));
  }
  function DataEntry({
    meta,
    defs,
    focusKpi,
    showCalc,
    reload
  }) {
    const [startFor, setStartFor] = useState(null);
    const [allStart, setAllStart] = useState(meta.config.cycleStart);
    useEffect(() => {
      setAllStart(meta.config.cycleStart);
    }, [meta.config.cycleStart]);
    async function saveAllStart() {
      const ok = await confirmBox({
        title: 'All KPIs start on ' + K.fmtMonthLong(allStart) + '?',
        message: 'Cycles, targets and the missing-data checks of every KPI count from ' + K.fmtMonthLong(allStart) + ' (a KPI with its own start month keeps it). Earlier months are kept, only not counted. Nothing is deleted.',
        confirmLabel: 'Change start'
      });
      if (!ok) {
        setAllStart(meta.config.cycleStart);
        return;
      }
      try {
        await api('/api/kpi/config', {
          method: 'PUT',
          body: JSON.stringify({
            cycleStart: allStart
          })
        });
        toast('All KPIs now start ' + K.fmtMonthLong(allStart) + '.', 'success');
        refreshBadge();
        if (reload) reload();
        setTick(t => t + 1);
      } catch (e) {
        toast(e.message, 'error');
        setAllStart(meta.config.cycleStart);
      }
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
      let live = true;
      setErr('');
      api('/api/kpi/values?from=' + range.from + '&to=' + range.to + '&checks=1').then(j => {
        if (live) setVals(j);
      }).catch(e => live && setErr(e.message));
      return () => {
        live = false;
      };
    }, [range && range.from, range && range.to, tick]);
    useEffect(() => {
      if (!focusKpi || !vals) return;
      const el = document.getElementById('kp-row-' + focusKpi);
      if (el) el.scrollIntoView({
        block: 'center',
        behavior: 'smooth'
      });
    }, [focusKpi, vals]);
    const months = vals ? vals.months : [];
    const cellOf = (id, m) => vals && vals.values[id] && vals.values[id][m] || {
      source: 'missing',
      value: null
    };
    const checksOf = (id, m) => vals && vals.checks && vals.checks[id] && vals.checks[id][m] || null;
    const isGap = c => !c.notStarted && c.source !== 'not-due' && !K.has(c.value);
    const last = meta.lastClosed;
    const dueFor = d => K.lastDue(d, last, cfg);
    const gaps = vals ? active.filter(d => {
      const m = dueFor(d);
      return m && months.indexOf(m) >= 0 && isGap(cellOf(d.id, m));
    }) : [];
    const anyLess = active.some(d => K.freqOf(d) > 1);
    function segmentsOf(d) {
      const out = [];
      months.forEach(m => {
        const pp = K.freqOf(d) > 1 ? K.periodOf(d, m, cfg) : null;
        const prev = out[out.length - 1];
        if (pp && prev && prev.p && prev.p.to === pp.to) prev.months.push(m);else out.push({
          p: pp,
          months: [m]
        });
      });
      return out;
    }
    const errorCells = vals && vals.checks ? Object.keys(vals.checks).reduce((n, k) => n + Object.keys(vals.checks[k]).filter(m => vals.checks[k][m].level === 'error').length, 0) : 0;
    const shown = active.filter(d => (!q || (d.name + ' ' + d.code).toLowerCase().indexOf(q.toLowerCase()) >= 0) && (!only || months.some(m => m <= meta.thisMonth && (isGap(cellOf(d.id, m)) || (checksOf(d.id, m) || {}).level === 'error'))));
    const groups = cfg.pillars.map(pl => ({
      pl,
      list: shown.filter(d => d.pillar === pl.id)
    })).filter(g => g.list.length);
    const orphan = shown.filter(d => !cfg.pillars.find(pl => pl.id === d.pillar));
    if (orphan.length) groups.push({
      pl: K.pillarOf(cfg, 'other'),
      list: orphan
    });
    const flat = groups.reduce((a, g) => a.concat(g.list), []);
    function nextAfter(id, m) {
      const order = [];
      flat.forEach(d => months.forEach(mm => {
        if (mm <= meta.thisMonth) order.push([d, mm]);
      }));
      const at = order.findIndex(([d, mm]) => d.id === id && mm === m);
      const hit = order.slice(at + 1).find(([d, mm]) => isGap(cellOf(d.id, mm)) || !cellOf(d.id, mm).notStarted && cellOf(d.id, mm).source === 'partial');
      return hit || null;
    }
    function onSaved(cell, next) {
      const cur = edit;
      if (!cell) {
        setTick(t => t + 1);
        return;
      }
      setVals(v => {
        const o = Object.assign({}, v, {
          values: Object.assign({}, v.values)
        });
        o.values[cur.def.id] = Object.assign({}, o.values[cur.def.id], {
          [cur.ym]: cell
        });
        return o;
      });
      refreshBadge();
      if (next) {
        const n = nextAfter(cur.def.id, cur.ym);
        if (n) {
          setEdit({
            def: n[0],
            ym: n[1],
            cell: cellOf(n[0].id, n[1]),
            k: Date.now()
          });
          return;
        }
        toast('All figures in this period are filled in.', 'success');
      }
      setEdit(null);
    }
    return React.createElement("div", {
      className: "kp-wrap"
    }, React.createElement("div", {
      className: "kp-card kp-bar"
    }, React.createElement(PeriodPicker, {
      meta: meta,
      p: p,
      setP: setP,
      range: range,
      presets: ['1m', '3m', '6m', '12m', 'year', 'cycle1', 'cycle2', 'custom'],
      maxMonth: meta.thisMonth
    }), React.createElement("span", {
      style: {
        flex: 1
      }
    }), React.createElement("input", {
      className: "kp-in",
      placeholder: "Find a KPI\u2026",
      value: q,
      onChange: e => setQ(e.target.value),
      style: {
        width: 170
      }
    }), React.createElement("label", {
      style: {
        display: 'inline-flex',
        gap: 6,
        alignItems: 'center',
        fontSize: 12.5,
        fontWeight: 600,
        cursor: 'pointer'
      }
    }, React.createElement("input", {
      type: "checkbox",
      checked: only,
      onChange: e => setOnly(e.target.checked),
      style: {
        width: 'auto'
      }
    }), "Only gaps"), React.createElement(Btn, {
      onClick: () => setTick(t => t + 1),
      title: "Read the quality data again"
    }, "\u21BB Refresh system figures"), React.createElement("span", {
      style: {
        display: 'inline-flex',
        gap: 6,
        alignItems: 'center',
        fontSize: 12.5,
        fontWeight: 700,
        color: 'var(--ink-2)',
        padding: '3px 4px 3px 10px',
        borderRadius: 9,
        background: '#eef8fd',
        border: '1px solid #b9dcef'
      },
      title: "Every KPI counts its cycles, targets and missing-data checks from this month, unless it has its own start"
    }, "All KPIs start on", meta.isAdmin ? React.createElement(React.Fragment, null, React.createElement("input", {
      type: "month",
      className: "kp-sel",
      value: allStart,
      max: meta.thisMonth,
      onChange: e => K.isMonth(e.target.value) && setAllStart(e.target.value),
      style: {
        padding: '4px 8px'
      }
    }), allStart !== meta.config.cycleStart && React.createElement(Btn, {
      pri: true,
      onClick: saveAllStart
    }, "Save")) : React.createElement("b", {
      style: {
        padding: '0 8px 0 2px'
      }
    }, K.fmtMonth(meta.config.cycleStart)))), gaps.length > 0 && (meta.canAdd || meta.canEdit) && React.createElement("div", {
      className: "kp-banner",
      role: "status"
    }, React.createElement("span", {
      style: {
        fontSize: 16
      }
    }, "\u270E"), React.createElement("div", null, React.createElement("b", null, gaps.length, " KPI", gaps.length > 1 ? 's' : '', " still need", gaps.length > 1 ? '' : 's', " ", anyLess ? 'their latest figure' : 'a figure for ' + K.fmtMonthLong(last), "."), " Click one to fill it \u2014 after saving, \u201CSave & next\u201D takes you to the next gap.", React.createElement("br", null), gaps.map(d => {
      const m = dueFor(d);
      return React.createElement("button", {
        key: d.id,
        onClick: () => setEdit({
          def: d,
          ym: m,
          cell: cellOf(d.id, m),
          k: Date.now()
        })
      }, d.code, " ", d.name, K.freqOf(d) > 1 ? ' (' + K.periodOf(d, m, cfg).label + ')' : '');
    }))), vals && !gaps.length && months.indexOf(last) >= 0 && React.createElement("div", {
      className: "kp-banner ok"
    }, React.createElement("span", {
      style: {
        fontSize: 16
      }
    }, "\u2713"), React.createElement("div", null, "Every KPI has ", anyLess ? 'its latest figure (' + K.fmtMonthLong(last) + ', or the last period for those measured less often)' : 'a figure for ' + K.fmtMonthLong(last), ".")), errorCells > 0 && React.createElement("div", {
      className: "kp-banner"
    }, React.createElement("span", {
      style: {
        fontSize: 16
      }
    }, "\u2691"), React.createElement("div", null, React.createElement("b", null, errorCells, " month", errorCells > 1 ? 's have' : ' has', " a data error"), " (red corner) \u2014 a unit that did not report, a missing denominator, Device Days that do not match, or a changed figure without a reason. Click the cell to see it. A report cannot be finalised until each is fixed or acknowledged with a reason.")), meta.config.autoFill === false && React.createElement("div", {
      className: "kp-banner info"
    }, React.createElement("span", {
      style: {
        fontSize: 16
      }
    }, "\u23F8"), React.createElement("div", null, React.createElement("b", null, "Auto-fill from the quality data is OFF"), " for every KPI (Settings). Each figure is typed here; the system figure is offered as a hint.")), err && React.createElement("div", {
      className: "kp-banner"
    }, err), React.createElement("div", {
      className: "kp-card"
    }, React.createElement("div", {
      className: "kp-h"
    }, React.createElement("h3", null, "Monthly figures"), React.createElement("span", {
      className: "grow"
    }), React.createElement("div", {
      className: "kp-legend"
    }, [['pooled', 'From quality data'], ['hh-audit', 'Hand hygiene audit'], ['edited', 'Edited by you'], ['manual', 'Entered'], ['partial', 'Denominator missing']].map(([k, l]) => React.createElement("span", {
      key: k
    }, React.createElement("i", {
      className: "kp-dot",
      style: {
        background: srcOf(k).dot
      }
    }), l)), React.createElement("span", null, React.createElement("i", {
      className: "kp-dot",
      style: {
        border: '1.5px dashed #d23a52'
      }
    }), "Missing"), React.createElement("span", null, React.createElement("i", {
      style: {
        display: 'inline-block',
        borderStyle: 'solid',
        borderWidth: '0 9px 9px 0',
        borderColor: 'transparent #d23a52 transparent transparent'
      }
    }), "Data error"), React.createElement("span", null, React.createElement("i", {
      style: {
        display: 'inline-block',
        borderStyle: 'solid',
        borderWidth: '0 9px 9px 0',
        borderColor: 'transparent #e0a21e transparent transparent'
      }
    }), "Warning"))), !vals && !err && React.createElement("div", {
      className: "kp-empty"
    }, "Loading the figures\u2026"), vals && React.createElement("div", {
      className: "kp-scroll",
      style: {
        maxHeight: 'calc(100vh - 300px)',
        overflowY: 'auto'
      }
    }, React.createElement("table", {
      className: "kp-eg"
    }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", {
      className: "k"
    }, "KPI"), months.map(m => React.createElement("th", {
      key: m,
      style: m === last ? {
        background: '#0c6f7d'
      } : undefined
    }, K.fmtMonth(m))), React.createElement("th", null, "Target"))), React.createElement("tbody", null, groups.map(g => [React.createElement("tr", {
      key: 'g' + g.pl.id,
      className: "grp"
    }, React.createElement("td", {
      colSpan: months.length + 2
    }, React.createElement("span", {
      className: "kp-dot",
      style: {
        background: g.pl.color,
        marginRight: 7
      }
    }), g.pl.label)), ...g.list.map(d => React.createElement("tr", {
      key: d.id,
      id: 'kp-row-' + d.id,
      className: focusKpi === d.id ? 'hi' : ''
    }, React.createElement("td", {
      className: "k"
    }, React.createElement("div", {
      style: {
        display: 'flex',
        gap: 8,
        alignItems: 'center'
      }
    }, React.createElement("span", {
      className: "kp-code",
      style: {
        background: g.pl.color
      }
    }, d.code || '•'), React.createElement("div", {
      style: {
        minWidth: 0
      }
    }, React.createElement("div", {
      style: {
        fontWeight: 700,
        color: 'var(--ink)',
        lineHeight: 1.25
      }
    }, d.name), React.createElement("div", {
      className: "kp-muted",
      style: {
        fontSize: 10.5
      }
    }, d.unit, d.source && d.source.indId ? d.autoFill === false || meta.config.autoFill === false ? ' · typed (auto-fill off)' : ' · auto from quality' : ' · typed', K.freqOf(d) > 1 ? React.createElement("b", {
      style: {
        color: '#3f3fa8'
      }
    }, ' · ' + K.freqLabel(d, true).toLowerCase()) : ''), React.createElement("button", {
      onClick: () => meta.canEdit && setStartFor({
        def: d
      }),
      disabled: !meta.canEdit,
      title: meta.canEdit ? 'Change when this KPI starts counting' : '',
      style: {
        border: 0,
        background: 'transparent',
        padding: 0,
        font: 'inherit',
        fontSize: 10.5,
        fontWeight: 700,
        color: d.startMonth ? '#8a5a00' : '#0b6b8f',
        cursor: meta.canEdit ? 'pointer' : 'default'
      }
    }, (d.startMonth ? '◷ starts ' + K.fmtMonth(d.startMonth) + ' (own)' : '◷ starts ' + K.fmtMonth(meta.config.cycleStart)) + (meta.canEdit ? ' ✎' : ''))))), segmentsOf(d).map(sg => {
      if (sg.p && K.freqOf(d) > 1) {
        const due = sg.p.to,
          dueIn = sg.months.indexOf(due) >= 0,
          future = due > meta.thisMonth;
        const c = dueIn ? cellOf(d.id, due) : null,
          ch = dueIn ? checksOf(d.id, due) : null;
        const open = dueIn && !future;
        const kept = sg.months.map(x => cellOf(d.id, x).kept).filter(Boolean);
        const cls = !open ? 'span wait' : c.source === 'partial' ? 'partial' : isGap(c) ? 'missing' : 'span';
        const tip = sg.p.label + ' — ' + K.freqLabel(d) + ': one figure for the period, entered in ' + K.fmtMonthLong(due) + '.' + (kept.length ? '\n' + kept.length + ' monthly figure(s) saved earlier are kept but not counted.' : '') + (ch ? '\n' + ch.items.map(x => (x.level === 'error' ? '✖ ' : '▲ ') + x.text).join('\n') : '') + (c ? '\n' + (c.note || srcOf(c.source).long) : '');
        return React.createElement("td", {
          key: sg.months[0],
          colSpan: sg.months.length,
          style: {
            position: 'relative'
          }
        }, React.createElement("button", {
          className: 'kp-cell ' + cls,
          disabled: !open,
          onClick: () => setEdit({
            def: d,
            ym: due,
            cell: c,
            k: Date.now(),
            checks: ch ? ch.items : []
          }),
          title: tip
        }, open && (isGap(c) ? React.createElement("span", {
          style: {
            fontSize: 11.5,
            fontWeight: 700
          }
        }, c.source === 'partial' ? '! den.' : '+ Add') : React.createElement("b", null, K.fmt(d, c.value, {
          bare: true
        }))), React.createElement("span", {
          className: "per"
        }, sg.p.label, !dueIn ? ' · result in ' + K.fmtMonth(due) : future ? ' · due ' + K.fmtMonth(due) : ''), open && !isGap(c) && React.createElement("span", {
          className: "kp-dot",
          style: {
            background: srcOf(c.source).dot
          }
        })), ch && React.createElement("span", {
          className: 'kp-cellmark ' + ch.level
        }));
      }
      const m = sg.months[0];
      const c = cellOf(d.id, m),
        future = m > meta.thisMonth,
        ch = checksOf(d.id, m);
      const pre = !future && c.notStarted;
      const cls = future ? 'future' : pre ? 'future' : c.source === 'partial' ? 'partial' : isGap(c) ? 'missing' : '';
      const tip = (ch ? ch.items.map(x => (x.level === 'error' ? '✖ ' : '▲ ') + x.text).join('\n') + '\n' : '') + (pre ? 'Before this KPI starts (' + K.fmtMonth(K.startOf(d, meta.config)) + ') — not counted' : c.note || srcOf(c.source).long);
      return React.createElement("td", {
        key: m,
        style: {
          position: 'relative'
        }
      }, React.createElement("button", {
        className: 'kp-cell ' + cls,
        disabled: future,
        style: pre ? {
          cursor: 'pointer'
        } : undefined,
        onClick: () => setEdit({
          def: d,
          ym: m,
          cell: c,
          k: Date.now(),
          checks: ch ? ch.items : []
        }),
        title: tip
      }, future ? React.createElement("span", null, "\u2014") : pre && !K.has(c.value) ? React.createElement("span", {
        style: {
          fontSize: 10.5
        }
      }, "starts ", K.fmtMonth(K.startOf(d, meta.config)).replace(' 20', " '")) : isGap(c) ? React.createElement("span", {
        style: {
          fontSize: 11.5,
          fontWeight: 700
        }
      }, c.source === 'partial' ? '! den.' : '+ Add') : React.createElement("b", {
        style: pre ? {
          color: '#a3adba'
        } : undefined
      }, K.fmt(d, c.value, {
        bare: true
      })), !future && !isGap(c) && !pre && React.createElement("span", {
        className: "kp-dot",
        style: {
          background: srcOf(c.source).dot
        }
      })), ch && !pre && React.createElement("span", {
        className: 'kp-cellmark ' + ch.level
      }));
    }), React.createElement("td", {
      className: "kp-muted",
      style: {
        whiteSpace: 'nowrap'
      }
    }, (() => {
      const t = K.targetFor(d, months[months.length - 1], cfg);
      return t == null ? '—' : K.fmt(d, t);
    })())))]))), !flat.length && React.createElement("div", {
      className: "kp-empty"
    }, only ? 'No gaps — every KPI has its figures in this period.' : 'No KPI matches.'))), React.createElement("div", {
      className: "kp-muted"
    }, "Figures from the quality data and the hand hygiene audit fill themselves. You can still click one and type over it \u2014 the system figure stays visible beside yours, and \u201CRevert to system figure\u201D brings it back."), startFor && React.createElement(StartDialog, {
      meta: meta,
      def: startFor.def,
      suggest: startFor.suggest,
      onClose: () => setStartFor(null),
      onSaved: () => {
        setStartFor(null);
        refreshBadge();
        if (reload) reload();
        setTick(t => t + 1);
      }
    }), edit && React.createElement(EntryDialog, {
      key: edit.k,
      onStartHere: ym => {
        const def = edit.def;
        setEdit(null);
        setStartFor({
          def,
          suggest: ym
        });
      },
      meta: meta,
      def: edit.def,
      ym: edit.ym,
      cell: edit.cell,
      checks: edit.checks || (checksOf(edit.def.id, edit.ym) || {}).items,
      showCalc: showCalc,
      onClose: () => setEdit(null),
      onSaved: (c, next) => {
        onSaved(c, next);
        setTick(t => t + 1);
      }
    }));
  }
  function ReportsHome({
    meta,
    setRoute
  }) {
    const [p, setP, range] = usePeriod(meta, 'rep', '1m');
    const [list, setList] = useState(null);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const load = () => api('/api/kpi/reports').then(j => setList(j.reports)).catch(e => setErr(e.message));
    useEffect(() => {
      load();
    }, []);
    async function generate() {
      setBusy(true);
      try {
        const j = await api('/api/kpi/report', {
          method: 'POST',
          body: JSON.stringify({
            from: range.from,
            to: range.to
          })
        });
        toast(j.existed ? 'This period already has a final report.' : 'Report ready.', 'success');
        refreshBadge();
        setRoute({
          view: 'kpiReports',
          report: j.report.id
        });
      } catch (e) {
        toast(e.message, 'error');
      }
      setBusy(false);
    }
    const canGen = meta.canAdd || meta.canEdit;
    const SumBar = ({
      s
    }) => s ? React.createElement("div", {
      style: {
        display: 'flex',
        height: 8,
        borderRadius: 99,
        overflow: 'hidden',
        background: '#eef2f6'
      }
    }, ['met', 'near', 'off', 'notarget', 'nodata', 'notstarted', 'notdue'].map(k => s[k] ? React.createElement("span", {
      key: k,
      title: s[k] + ' ' + ST[k].label,
      style: {
        flex: s[k],
        background: ST[k].color
      }
    }) : null)) : null;
    return React.createElement("div", {
      className: "kp-wrap"
    }, React.createElement("div", {
      className: "kp-card kp-pad",
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 10
      }
    }, React.createElement("div", {
      style: {
        display: 'flex',
        gap: 10,
        alignItems: 'baseline',
        flexWrap: 'wrap'
      }
    }, React.createElement("h3", {
      style: {
        margin: 0,
        fontSize: 15
      }
    }, "Make a report"), React.createElement("span", {
      className: "kp-muted"
    }, "one month, 2, 3, 6 or 12 months, a cycle, or any range you choose")), React.createElement(PeriodPicker, {
      meta: meta,
      p: p,
      setP: setP,
      range: range,
      maxMonth: meta.thisMonth
    }), React.createElement("div", {
      style: {
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap',
        alignItems: 'center'
      }
    }, React.createElement(Btn, {
      onClick: () => setRoute({
        view: 'kpiReports',
        report: K.reportId(range.from, range.to)
      })
    }, "Preview"), canGen && React.createElement(Btn, {
      pri: true,
      disabled: busy,
      onClick: generate
    }, busy ? 'Preparing…' : 'Generate & save report'), React.createElement("span", {
      className: "kp-muted"
    }, "A saved draft keeps your commentary and sign-off; its figures stay live until you finalise it. The report for the month that just ended is prepared automatically."))), React.createElement("div", {
      className: "kp-card"
    }, React.createElement("div", {
      className: "kp-h"
    }, React.createElement("h3", null, "Documents"), React.createElement("span", {
      className: "kp-muted"
    }, "the programme itself \u2014 not a period")), React.createElement("div", {
      className: "kp-grid2 kp-pad"
    }, React.createElement("div", {
      className: "kp-card kp-pad",
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        boxShadow: 'none'
      }
    }, React.createElement("b", {
      style: {
        fontSize: 14,
        color: 'var(--ink)'
      }
    }, "KPI Definition document"), React.createElement("span", {
      className: "kp-muted"
    }, "One page per KPI: what it measures, the formula, where its figures come from, how often it is measured, its cycles and targets, and its action plan \u2014 with a cover and document control for sign-off."), React.createElement("div", null, React.createElement(Btn, {
      pri: true,
      onClick: () => setRoute({
        view: 'kpiReports',
        report: 'definitions'
      })
    }, "Open \xB7 Print \xB7 PDF \xB7 Word"))), React.createElement("div", {
      className: "kp-card kp-pad",
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        boxShadow: 'none'
      }
    }, React.createElement("b", {
      style: {
        fontSize: 14,
        color: 'var(--ink)'
      }
    }, "Data collection calendar"), React.createElement("span", {
      className: "kp-muted"
    }, "A year on one page: which KPI owes a figure in which month \u2014 monthly, every 3 or 6 months, or yearly \u2014 to hand to unit managers."), React.createElement("div", {
      style: {
        display: 'flex',
        gap: 8
      }
    }, React.createElement(Btn, {
      pri: true,
      onClick: () => setRoute({
        view: 'kpiReports',
        report: 'calendar-' + meta.thisMonth.slice(0, 4)
      })
    }, "Open ", meta.thisMonth.slice(0, 4), " \xB7 Print \xB7 PDF \xB7 Excel"), React.createElement(Btn, {
      onClick: () => setRoute({
        view: 'kpiReports',
        report: 'calendar-' + (+meta.thisMonth.slice(0, 4) + 1)
      })
    }, +meta.thisMonth.slice(0, 4) + 1))))), err && React.createElement("div", {
      className: "kp-banner"
    }, err), React.createElement("div", {
      className: "kp-card"
    }, React.createElement("div", {
      className: "kp-h"
    }, React.createElement("h3", null, "Saved reports"), React.createElement("span", {
      className: "kp-muted"
    }, list ? list.length : '')), !list && !err && React.createElement("div", {
      className: "kp-empty"
    }, "Loading\u2026"), list && !list.length && React.createElement("div", {
      className: "kp-empty"
    }, "No report saved yet. Choose a period above and press \u201CGenerate & save report\u201D."), list && list.length > 0 && React.createElement("div", {
      className: "kp-grid3 kp-pad"
    }, list.map(r => React.createElement("div", {
      key: r.id,
      className: "kp-card kp-pad kp-rise",
      style: {
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 8
      },
      onClick: () => setRoute({
        view: 'kpiReports',
        report: r.id
      })
    }, React.createElement("div", {
      style: {
        display: 'flex',
        gap: 8,
        alignItems: 'center'
      }
    }, React.createElement("b", {
      style: {
        fontSize: 14.5,
        color: 'var(--ink)',
        flex: 1
      }
    }, K.fmtRange(r.from, r.to)), React.createElement("span", {
      className: "kp-pill",
      style: r.state === 'final' ? {
        background: '#e7f6ed',
        color: '#14713f'
      } : {
        background: '#fff1d6',
        color: '#8a5a00'
      }
    }, r.state === 'final' ? 'Final' : 'Draft')), React.createElement("div", {
      className: "kp-muted"
    }, r.preset === 'year' ? 'Year ' + r.from.slice(0, 4) : (K.PRESETS.find(x => x.id === r.preset) || {}).label || 'Custom', r.summary ? ' · ' + r.summary.met + ' on target · ' + r.summary.off + ' need action' : ''), React.createElement(SumBar, {
      s: r.summary
    }), React.createElement("div", {
      className: "kp-muted",
      style: {
        fontSize: 11
      }
    }, r.state === 'final' ? 'Finalised by ' + (r.finalizedBy || '—') + ' · ' + when(r.finalizedAt) : (r.generatedBy || '') + ' · ' + when(r.generatedAt)))))));
  }
  function DocView({
    meta,
    kind,
    year,
    setRoute
  }) {
    const cfg = meta.config;
    const isDefs = kind === 'definitions';
    const [y, setY] = useState(year || +meta.thisMonth.slice(0, 4));
    const [data, setData] = useState(null);
    const [err, setErr] = useState('');
    const [busy, setBusy] = useState('');
    const [capturing, setCapturing] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
      let live = true;
      setData(null);
      setErr('');
      api(isDefs ? '/api/kpi/definitions' : '/api/kpi/calendar?year=' + y).then(j => {
        if (live) setData(j);
      }).catch(e => live && setErr(e.message));
      return () => {
        live = false;
      };
    }, [kind, y]);
    const sig = sigNames();
    const title = isDefs ? 'Nursing KPI Definitions' : 'Data collection calendar ' + y;
    const fileBase = isDefs ? 'Nursing-KPI-Definitions-' + meta.thisMonth : 'Nursing-KPI-Data-Collection-Calendar-' + y;
    const log = k => () => api('/api/kpi/print', {
      method: 'POST',
      body: JSON.stringify({
        kind: k,
        what: title
      })
    });
    async function act(k) {
      setBusy(k);
      try {
        if (k === 'print') await printSheets(() => ref.current, title, log('print'), setCapturing);
        if (k === 'pdf') await pdfSheets(() => ref.current, title, fileBase, log('pdf'), setCapturing);
        if (k === 'docx') {
          await download('/api/kpi/definitions.docx?sig=' + encodeURIComponent(JSON.stringify(sig)));
          toast('Word file downloaded.', 'success');
        }
        if (k === 'xlsx') {
          await download('/api/kpi/calendar.xlsx?year=' + y);
          toast('Excel file downloaded.', 'success');
        }
      } catch (e) {
        toast(e.message, 'error');
      }
      setBusy('');
    }
    const foot = title + ' · ' + (cfg.hospitalName || '') + ' · ' + K.fmtMonthLong(meta.thisMonth);
    let page = 0;
    const pg = () => 'Page ' + ++page;
    const sheets = [];
    if (data && isDefs) {
      const list = data.defs.slice().sort((a, b) => (K.pillarOf(cfg, a.pillar).order || 99) - (K.pillarOf(cfg, b.pillar).order || 99) || (a.order || 0) - (b.order || 0));
      sheets.push(React.createElement(Sheet, {
        key: "cover",
        kicker: cfg.hospitalName,
        title: "Nursing KPI Definitions",
        foot: foot,
        page: pg()
      }, React.createElement("div", {
        style: {
          fontSize: 15,
          color: '#3a4656',
          marginBottom: 6
        }
      }, cfg.reportTitle, " \xB7 ", list.length, " KPIs in ", [...new Set(list.map(d => d.pillar))].length, " pillars"), React.createElement("div", {
        style: {
          fontSize: 13,
          color: '#3a4656',
          maxWidth: 820,
          lineHeight: 1.5,
          marginBottom: 18
        }
      }, "What each KPI measures, how it is calculated, where its figures come from, how often it is measured, its cycles, targets and action plan. Version: ", new Date().toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }), me() ? ' · prepared by ' + me() : '', "."), React.createElement("div", {
        style: {
          fontSize: 13,
          fontWeight: 800,
          color: '#00293A',
          margin: '6px 0'
        }
      }, "Document control"), React.createElement("table", {
        className: "kp-stbl",
        style: {
          maxWidth: 820
        }
      }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Role"), React.createElement("th", null, "Name"), React.createElement("th", null, "Signature"), React.createElement("th", null, "Date"))), React.createElement("tbody", null, [['prepared', 'Prepared by'], ['reviewed', 'Reviewed by'], ['recommended', 'Recommended by'], ['approved', 'Approved by']].map(([k, l]) => React.createElement("tr", {
        key: k
      }, React.createElement("td", {
        className: "l"
      }, React.createElement("b", null, l)), React.createElement("td", {
        className: "l",
        style: {
          height: 34
        }
      }, sig[k] || ''), React.createElement("td", null), React.createElement("td", null)))))));
      sheets.push(React.createElement(Sheet, {
        key: "toc",
        kicker: "Nursing KPI Definitions",
        title: "Contents",
        foot: foot,
        page: pg()
      }, React.createElement("table", {
        className: "kp-stbl"
      }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Code"), React.createElement("th", null, "KPI"), React.createElement("th", null, "Pillar"), React.createElement("th", null, "Measured"), React.createElement("th", null, "Target"), React.createElement("th", null, "Source"))), React.createElement("tbody", null, list.map(d => React.createElement("tr", {
        key: d.id
      }, React.createElement("td", null, React.createElement("b", null, d.code)), React.createElement("td", {
        className: "l"
      }, d.name), React.createElement("td", {
        className: "l"
      }, K.pillarOf(cfg, d.pillar).label), React.createElement("td", null, d.doc.measured), React.createElement("td", null, d.doc.cycles.map(c => c.target).join(' → ')), React.createElement("td", null, d.source && d.source.indId ? 'Quality data' : 'Entered')))))));
      list.forEach(d => {
        const doc = d.doc,
          pl = K.pillarOf(cfg, d.pillar);
        const acts = doc.actions.slice(0, 9);
        sheets.push(React.createElement(Sheet, {
          key: d.id,
          kicker: pl.label + ' · ' + doc.measured,
          title: (doc.code ? doc.code + '  ' : '') + doc.name,
          foot: foot,
          page: pg()
        }, React.createElement("div", {
          style: {
            display: 'grid',
            gridTemplateColumns: '1.45fr 1fr',
            gap: 18,
            alignItems: 'start'
          }
        }, React.createElement("table", {
          className: "kp-deck",
          style: {
            fontSize: 10.8
          }
        }, React.createElement("tbody", null, doc.facts.map(([l, v]) => React.createElement("tr", {
          key: l
        }, React.createElement("th", {
          style: {
            width: 150,
            fontSize: 10.5,
            padding: '5px 9px'
          }
        }, l), React.createElement("td", {
          style: {
            padding: '5px 9px'
          }
        }, String(v).length > 420 ? String(v).slice(0, 420) + '…' : v))))), React.createElement("div", {
          style: {
            display: 'flex',
            flexDirection: 'column',
            gap: 10
          }
        }, React.createElement("div", {
          style: {
            fontSize: 12.5,
            fontWeight: 800,
            color: '#00293A'
          }
        }, "Cycles and targets"), React.createElement("table", {
          className: "kp-stbl"
        }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Cycle"), React.createElement("th", null, "Dates"), React.createElement("th", null, "Target"), React.createElement("th", null, "Results due"))), React.createElement("tbody", null, doc.cycles.map(c => React.createElement("tr", {
          key: c.n
        }, React.createElement("td", null, React.createElement("b", null, c.n)), React.createElement("td", {
          className: "l"
        }, c.dates), React.createElement("td", null, React.createElement("b", null, c.target)), React.createElement("td", null, c.results))))), React.createElement("div", {
          style: {
            fontSize: 11,
            color: '#5b6878'
          }
        }, doc.schedule), React.createElement("div", {
          style: {
            fontSize: 12.5,
            fontWeight: 800,
            color: '#00293A'
          }
        }, "Action plan"), acts.length ? React.createElement("table", {
          className: "kp-stbl",
          style: {
            fontSize: 10.5
          }
        }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "#"), React.createElement("th", null, "Action"), React.createElement("th", null, "Owner"), React.createElement("th", null, "Status"))), React.createElement("tbody", null, acts.map((a, i) => React.createElement("tr", {
          key: i
        }, React.createElement("td", null, i + 1), React.createElement("td", {
          className: "l"
        }, a.text, a.due ? React.createElement("span", {
          style: {
            color: '#7b8796'
          }
        }, " \xB7 due ", a.due) : null), React.createElement("td", {
          className: "l"
        }, a.owner), React.createElement("td", null, a.status))))) : React.createElement("div", {
          className: "kp-muted"
        }, "No action items."), doc.actions.length > acts.length && React.createElement("div", {
          className: "kp-muted",
          style: {
            fontSize: 11
          }
        }, "+ ", doc.actions.length - acts.length, " more action items (in the Word file).")))));
      });
    }
    if (data && !isDefs) {
      const cal = data.calendar,
        defs = data.defs;
      const rowsOf = defs.slice().sort((a, b) => (K.pillarOf(cfg, a.pillar).order || 99) - (K.pillarOf(cfg, b.pillar).order || 99));
      const chunks = [];
      for (let i = 0; i < rowsOf.length; i += 20) chunks.push(rowsOf.slice(i, i + 20));
      const mark = {
        due: React.createElement("b", {
          style: {
            color: '#14713f',
            fontSize: 15
          }
        }, "\u25CF"),
        off: React.createElement("span", {
          style: {
            color: '#b9c2cd'
          }
        }, "\xB7"),
        notstarted: React.createElement("span", {
          style: {
            color: '#c9d1db'
          }
        }, "\u2014")
      };
      chunks.forEach((part, ci) => sheets.push(React.createElement(Sheet, {
        key: 'cal' + ci,
        kicker: cfg.hospitalName + ' · Nursing KPI',
        title: 'Data collection calendar ' + cal.year + (chunks.length > 1 ? ' (' + (ci + 1) + '/' + chunks.length + ')' : ''),
        foot: foot,
        page: pg()
      }, React.createElement("table", {
        className: "kp-stbl",
        style: {
          fontSize: 11
        }
      }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "#"), React.createElement("th", {
        style: {
          textAlign: 'left'
        }
      }, "KPI"), React.createElement("th", null, "Measured"), React.createElement("th", null, "Source"), cal.months.map(m => React.createElement("th", {
        key: m,
        style: {
          padding: '6px 4px'
        }
      }, K.MONS[+m.slice(5) - 1])), React.createElement("th", null, "Due"))), React.createElement("tbody", null, part.map(d => React.createElement("tr", {
        key: d.id
      }, React.createElement("td", null, React.createElement("b", null, d.code)), React.createElement("td", {
        className: "l"
      }, d.name), React.createElement("td", {
        style: {
          whiteSpace: 'nowrap'
        }
      }, d.freq), React.createElement("td", {
        style: {
          fontSize: 10
        }
      }, d.linked ? d.autoFill && cfg.autoFill !== false ? 'Auto from quality' : 'Typed' : 'Typed'), cal.months.map(m => React.createElement("td", {
        key: m,
        style: {
          padding: '4px 2px',
          background: cal.byKpi[d.id][m] === 'due' ? '#e7f6ed' : undefined
        }
      }, mark[cal.byKpi[d.id][m]])), React.createElement("td", null, React.createElement("b", null, cal.months.filter(m => cal.byKpi[d.id][m] === 'due').length)))), ci === chunks.length - 1 && React.createElement("tr", null, React.createElement("td", null), React.createElement("td", {
        className: "l"
      }, React.createElement("b", null, "Figures due")), React.createElement("td", null), React.createElement("td", null), cal.dueCount.map((n, i) => React.createElement("td", {
        key: i
      }, React.createElement("b", null, n))), React.createElement("td", null, React.createElement("b", null, cal.dueCount.reduce((a, b) => a + b, 0)))))), React.createElement("div", {
        style: {
          marginTop: 12,
          fontSize: 11,
          color: '#5b6878',
          display: 'flex',
          gap: 18,
          flexWrap: 'wrap'
        }
      }, React.createElement("span", null, React.createElement("b", {
        style: {
          color: '#14713f'
        }
      }, "\u25CF"), " a figure is due (the period ends this month)"), React.createElement("span", null, React.createElement("b", null, "\xB7"), " not due"), React.createElement("span", null, React.createElement("b", null, "\u2014"), " not started yet"), React.createElement("span", null, "A KPI measured every 3 or 6 months, or yearly, owes one figure per period, entered in the period\u2019s last month.")))));
    }
    return React.createElement("div", {
      className: 'kp-wrap' + (capturing ? ' kp-capturing' : '')
    }, React.createElement("div", {
      className: "kp-card kp-bar",
      style: {
        position: 'sticky',
        top: -22,
        zIndex: 5,
        boxShadow: '0 6px 22px rgba(13,27,46,.10)'
      }
    }, React.createElement(Btn, {
      onClick: () => setRoute({
        view: 'kpiReports'
      })
    }, "\u2039 All reports"), React.createElement("b", {
      style: {
        fontSize: 14
      }
    }, title), !isDefs && React.createElement("select", {
      className: "kp-sel",
      value: y,
      onChange: e => {
        setY(+e.target.value);
        setRoute({
          view: 'kpiReports',
          report: 'calendar-' + e.target.value
        });
      }
    }, [-1, 0, 1, 2].map(i => +meta.thisMonth.slice(0, 4) + i).map(n => React.createElement("option", {
      key: n,
      value: n
    }, n))), React.createElement("span", {
      style: {
        flex: 1
      }
    }), meta.canPrint && React.createElement(React.Fragment, null, React.createElement(Btn, {
      disabled: !data || !!busy,
      onClick: () => act('print')
    }, busy === 'print' ? 'Preparing…' : 'Print'), React.createElement(Btn, {
      disabled: !data || !!busy,
      onClick: () => act('pdf')
    }, busy === 'pdf' ? 'Making the PDF…' : 'PDF'), isDefs ? React.createElement(Btn, {
      pri: true,
      disabled: !data || !!busy,
      onClick: () => act('docx')
    }, busy === 'docx' ? 'Building…' : 'Word') : React.createElement(Btn, {
      pri: true,
      disabled: !data || !!busy,
      onClick: () => act('xlsx')
    }, busy === 'xlsx' ? 'Building…' : 'Excel'))), err && React.createElement("div", {
      className: "kp-banner"
    }, err), !data && !err && React.createElement("div", {
      className: "kp-card kp-empty"
    }, "Preparing the document\u2026"), data && React.createElement("div", {
      className: "kp-scroll"
    }, React.createElement("div", {
      className: "kp-doc",
      ref: ref
    }, sheets)));
  }
  function Sheet({
    kicker,
    title,
    children,
    foot,
    page
  }) {
    return React.createElement("section", {
      className: "kp-sheet"
    }, React.createElement("div", {
      className: "kp-sh-head"
    }, React.createElement("div", null, React.createElement("div", {
      className: "k"
    }, kicker), React.createElement("h2", null, title), React.createElement("div", {
      className: "rule"
    })), React.createElement("img", {
      src: "unico/logo.svg",
      alt: "UNICO Hospitals"
    })), children, React.createElement("div", {
      className: "kp-sh-foot"
    }, React.createElement("span", null, foot), React.createElement("span", null, page)));
  }
  function periodUnitsOf(row, months) {
    const by = new Map();
    months.forEach(m => (row.evidence && row.evidence[m] && row.evidence[m].units || []).forEach(u => {
      if (!by.has(u.key)) by.set(u.key, {
        key: u.key,
        name: u.name,
        num: 0,
        den: 0,
        hasNum: false,
        hasDen: false,
        used: 0,
        expected: false,
        sources: new Set(),
        approvers: new Set(),
        bad: false
      });
      const x = by.get(u.key);
      if (u.used) {
        if (K.has(u.num)) {
          x.num += Number(u.num);
          x.hasNum = true;
        }
        if (K.has(u.den)) {
          x.den += Number(u.den);
          x.hasDen = true;
        }
        x.used++;
      }
      x.expected = x.expected || !!u.expected;
      x.sources.add((EV_SRC[u.source] || [u.source])[0]);
      if (['missing', 'partial', 'den-zero', 'not-audited'].indexOf(u.source) >= 0 && u.expected) x.bad = true;
      if (u.submission) x.approvers.add(u.submission.reviewedBy || '—');else if (u.overlayEdited) x.approvers.add('console: ' + (u.overlayEdited.by || 'not recorded'));
    }));
    return [...by.values()];
  }
  function CalcSheetBody({
    row,
    months,
    acks
  }) {
    if (months.length === 1) {
      const ev = row.evidence && row.evidence[months[0]];
      return ev ? React.createElement(EvidenceView, {
        def: row,
        ev: ev,
        acks: acks,
        compact: true
      }) : React.createElement("div", {
        className: "kp-muted"
      }, "No calculation details.");
    }
    const units = periodUnitsOf(row, months);
    const checks = [];
    months.forEach(m => (((row.evidence || {})[m] || {}).checks || []).forEach(c => {
      if (c.level !== 'info') checks.push(Object.assign({
        ym: m
      }, c));
    }));
    const ackOf = c => (acks || []).find(a => a.key === [row.kpiId, c.ym, c.code, c.unit || ''].join('|'));
    const tf = row.formula !== 'count' && row.formula !== 'direct';
    return React.createElement("div", {
      className: "kp-ev"
    }, React.createElement("div", {
      className: "kp-formula"
    }, React.createElement("b", null, "Formula:"), " ", row.formulaText || '—'), React.createElement("ol", {
      className: "kp-steps"
    }, row.status === 'notstarted' ? React.createElement("li", null, "This KPI starts in ", K.fmtMonth(row.startMonth), "; nothing before then is counted.") : null, K.has(row.period.num) && K.has(row.period.den) ? React.createElement("li", null, months.length, " months pooled: ", row.numLabel || 'numerator', " ", K.round(row.period.num, 4), " \xF7 ", row.denLabel || 'denominator', " ", K.round(row.period.den, 4), " = ", React.createElement("b", null, K.fmt(row, row.period.value)), " \u2014 the months\u2019 figures are added first and divided once.") : React.createElement("li", null, "Period value: ", React.createElement("b", null, K.fmt(row, row.period.value)), row.period.months ? ' (mean of ' + row.period.months + ' months)' : '', "."), React.createElement("li", null, "Month by month: ", months.map(m => K.fmtMonth(m) + ' ' + K.fmt(row, (row.cells[m] || {}).value)).join(' · '), ".")), units.length > 0 && React.createElement("table", {
      className: "kp-evtbl"
    }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Unit"), React.createElement("th", null, "Months used"), React.createElement("th", {
      style: {
        textAlign: 'right'
      }
    }, row.numLabel || 'Numerator'), tf && React.createElement("th", {
      style: {
        textAlign: 'right'
      }
    }, row.denLabel || 'Denominator'), React.createElement("th", {
      style: {
        textAlign: 'right'
      }
    }, "Value"), React.createElement("th", null, "Source"), React.createElement("th", null, "Approved by"))), React.createElement("tbody", null, units.slice(0, 14).map(u => React.createElement("tr", {
      key: u.key,
      className: u.bad ? 'bad' : u.used ? '' : 'off'
    }, React.createElement("td", null, React.createElement("b", null, u.name), u.expected ? React.createElement("small", null, "expected to report") : null), React.createElement("td", null, u.used, " of ", months.length), React.createElement("td", {
      className: "n"
    }, u.hasNum ? K.round(u.num, 4) : '—'), tf && React.createElement("td", {
      className: "n"
    }, u.hasDen ? K.round(u.den, 4) : '—'), React.createElement("td", {
      className: "n"
    }, React.createElement("b", null, u.used && u.hasDen ? K.fmt(row, K.computeValue(row.formula, u.num, u.den)) : '—')), React.createElement("td", {
      style: {
        fontSize: 10.5
      }
    }, [...u.sources].join(', ')), React.createElement("td", {
      style: {
        fontSize: 10.5
      }
    }, [...u.approvers].join(', ') || '—'))))), units.length > 14 && React.createElement("div", {
      className: "kp-muted"
    }, "+ ", units.length - 14, " more units \u2014 every unit and month is in the Excel \u201CCalculation\u201D sheet."), checks.slice(0, 7).map((c, i) => {
      const a = ackOf(c);
      return React.createElement("div", {
        key: i,
        className: 'kp-check ' + c.level
      }, React.createElement("span", {
        className: "tag"
      }, K.fmtMonth(c.ym)), React.createElement("div", null, c.text, a && React.createElement("span", {
        className: "ack"
      }, "\u2714 Acknowledged by ", a.byName || a.by, ": \u201C", a.reason, "\u201D")));
    }), checks.length > 7 && React.createElement("div", {
      className: "kp-muted"
    }, "+ ", checks.length - 7, " more on the Data quality page."), !checks.length && row.status !== 'notstarted' && React.createElement("div", {
      className: "kp-banner ok",
      style: {
        padding: '7px 12px'
      }
    }, "\u2713 Every check passed for this KPI in the period."));
  }
  function AckDialog({
    id,
    items,
    meta,
    onClose,
    onDone,
    setRoute
  }) {
    const [reasons, setReasons] = useState({});
    const [done, setDone] = useState({});
    const [busy, setBusy] = useState('');
    const [err, setErr] = useState('');
    const left = items.filter(x => !done[x.key]);
    async function ack(x) {
      setBusy(x.key);
      setErr('');
      try {
        await api('/api/kpi/report/' + id + '/ack', {
          method: 'PUT',
          body: JSON.stringify({
            kpiId: x.kpiId,
            ym: x.ym,
            code: x.code,
            unit: x.unit,
            reason: reasons[x.key] || ''
          })
        });
        setDone(d => Object.assign({}, d, {
          [x.key]: true
        }));
      } catch (e) {
        setErr(e.message);
      }
      setBusy('');
    }
    return React.createElement("div", {
      className: "kp-back",
      onMouseDown: e => e.target === e.currentTarget && onClose()
    }, React.createElement("div", {
      className: "kp-dlg wide",
      role: "dialog"
    }, React.createElement("div", {
      className: "kp-dlg-h"
    }, React.createElement("div", null, React.createElement("h3", null, left.length ? left.length + ' data error' + (left.length > 1 ? 's' : '') + ' before this report can be final' : 'Every error is settled'), React.createElement("div", {
      className: "kp-muted"
    }, "Fix the data (the figures update by themselves), or \u2014 when the figure is right as it stands \u2014 acknowledge it with a reason. Every reason is printed on the report with your name.")), React.createElement("button", {
      className: "kp-x",
      onClick: onClose
    }, "\xD7")), React.createElement("div", {
      className: "kp-dlg-b"
    }, items.map(x => {
      const meta2 = K.CHECK_META[x.code] || {};
      const ok = done[x.key];
      return React.createElement("div", {
        key: x.key,
        className: 'kp-check ' + (ok ? 'info' : 'error'),
        style: {
          flexDirection: 'column',
          alignItems: 'stretch'
        }
      }, React.createElement("div", null, React.createElement("b", null, meta2.title || x.code), " \xB7 ", K.fmtMonth(x.ym), " \u2014 ", x.text, React.createElement("span", {
        className: "fix"
      }, meta2.fix)), ok ? React.createElement("span", {
        className: "ack"
      }, "\u2714 Acknowledged") : React.createElement("div", {
        style: {
          display: 'flex',
          gap: 6,
          alignItems: 'center',
          flexWrap: 'wrap'
        }
      }, React.createElement("input", {
        className: "kp-in",
        style: {
          flex: 1,
          minWidth: 220
        },
        placeholder: "Reason (printed on the report) \u2014 e.g. CCU had no central lines in October",
        value: reasons[x.key] || '',
        onChange: e => setReasons(r => Object.assign({}, r, {
          [x.key]: e.target.value
        }))
      }), React.createElement(Btn, {
        pri: true,
        disabled: busy === x.key || (reasons[x.key] || '').trim().length < 10,
        onClick: () => ack(x)
      }, "Acknowledge"), React.createElement(Btn, {
        onClick: () => {
          onClose();
          setRoute({
            view: 'kpiEntry',
            kpi: x.kpiId
          });
        }
      }, "Fix in Data Update")));
    }), err && React.createElement("div", {
      className: "kp-err"
    }, err)), React.createElement("div", {
      className: "kp-dlg-f"
    }, !left.length && React.createElement(Btn, {
      pri: true,
      onClick: onDone
    }, "Finalise now"), React.createElement("span", {
      style: {
        flex: 1
      }
    }), React.createElement(Btn, {
      onClick: onClose
    }, "Close"))));
  }
  function ReportDoc({
    meta,
    id,
    setRoute,
    showCalc
  }) {
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
    useEffect(() => {
      lsSet('kpi_layout', layout);
    }, [layout]);
    useEffect(() => {
      let live = true;
      setErr('');
      api('/api/kpi/report/' + id + (calc ? '?calc=1' : '')).then(j => {
        if (!live) return;
        setRep(j.report);
        verRef.current = j.report.updatedAt;
      }).catch(e => live && setErr(e.message));
      return () => {
        live = false;
      };
    }, [id, tick, calc]);
    const cfg = meta.config;
    const editable = rep && rep.state !== 'final' && meta.canEdit;
    const flush = useCallback(async () => {
      const body = pending.current;
      pending.current = {};
      if (!Object.keys(body).length) return;
      setSaveState('Saving…');
      try {
        const j = await api('/api/kpi/report/' + id, {
          method: 'PUT',
          body: JSON.stringify(Object.assign({}, body, verRef.current ? {
            baseUpdatedAt: verRef.current
          } : {}))
        });
        verRef.current = j.updatedAt;
        setSaveState('Saved');
        setRep(r => Object.assign({}, r, {
          stored: true,
          state: r.state === 'preview' ? 'draft' : r.state,
          updatedAt: j.updatedAt
        }));
      } catch (e) {
        setSaveState('');
        toast(e.message, 'error');
        if (e.status === 409) setTick(t => t + 1);
      }
    }, [id]);
    const queue = patch => {
      Object.keys(patch).forEach(k => {
        pending.current[k] = patch[k] && typeof patch[k] === 'object' ? Object.assign({}, pending.current[k] || {}, patch[k]) : patch[k];
      });
      setSaveState('Not saved yet…');
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, 1100);
    };
    useEffect(() => () => {
      clearTimeout(timer.current);
      flush();
    }, [flush]);
    const setComment = (k, v) => {
      setRep(r => Object.assign({}, r, {
        commentary: Object.assign({}, r.commentary, {
          [k]: v
        })
      }));
      queue({
        commentary: {
          [k]: v
        }
      });
    };
    const setOverall = v => {
      setRep(r => Object.assign({}, r, {
        overall: v
      }));
      queue({
        overall: v
      });
    };
    const sig0 = sigNames();
    const sig = rep ? Object.assign({
      prepared: sig0.prepared || '',
      reviewed: sig0.reviewed || '',
      recommended: sig0.recommended || '',
      approved: sig0.approved || ''
    }, Object.keys(rep.signoff || {}).length ? rep.signoff : {}) : {};
    const setSig = (k, v) => {
      setRep(r => Object.assign({}, r, {
        signoff: Object.assign({}, sig, {
          [k]: v
        })
      }));
      queue({
        signoff: {
          [k]: v
        }
      });
    };
    async function act(kind) {
      try {
        if (kind === 'refresh') {
          setBusy(kind);
          await api('/api/kpi/report', {
            method: 'POST',
            body: JSON.stringify({
              from: rep.from,
              to: rep.to
            })
          });
          toast('Figures refreshed.', 'success');
          setTick(t => t + 1);
        }
        if (kind === 'finalize') {
          const ok = await confirmBox({
            title: 'Finalise this report?',
            message: 'The figures of ' + K.fmtRange(rep.from, rep.to) + ' are frozen as they are now — later corrections will not change this report. Commentary and sign-off are locked too. An administrator can re-open it.',
            confirmLabel: 'Finalise'
          });
          if (!ok) return;
          setBusy(kind);
          await flush();
          try {
            await api('/api/kpi/report/' + id + '/finalize', {
              method: 'POST'
            });
          } catch (e) {
            if (e.body && e.body.code === 'checks') {
              setAckItems(e.body.unresolved || []);
              setBusy('');
              return;
            }
            throw e;
          }
          toast('Report finalised.', 'success');
          refreshBadge();
          setTick(t => t + 1);
        }
        if (kind === 'reopen') {
          const ok = await confirmBox({
            title: 'Re-open this report?',
            message: 'It becomes a draft again: its figures go live and can change. This is recorded in the activity log.',
            confirmLabel: 'Re-open',
            danger: true
          });
          if (!ok) return;
          setBusy(kind);
          await api('/api/kpi/report/' + id + '/reopen', {
            method: 'POST'
          });
          toast('Re-opened.', 'success');
          setTick(t => t + 1);
        }
        if (kind === 'remove') {
          const ok = await confirmBox({
            title: 'Remove this report?',
            message: 'The saved report for ' + K.fmtRange(rep.from, rep.to) + ' is removed from the list (kept in the history). The KPI figures are not touched.',
            confirmLabel: 'Remove',
            danger: true
          });
          if (!ok) return;
          setBusy(kind);
          await api('/api/kpi/report/' + id, {
            method: 'DELETE'
          });
          toast('Removed.', 'success');
          setRoute({
            view: 'kpiReports'
          });
          return;
        }
        if (kind.indexOf('pptx-') === 0) {
          setBusy(kind);
          await flush();
          await download('/api/kpi/report/' + id + '/pptx?style=' + kind.slice(5));
          toast('PowerPoint downloaded.', 'success');
        }
        if (kind === 'xlsx') {
          setBusy(kind);
          await flush();
          await download('/api/kpi/report/' + id + '/xlsx');
          toast('Excel downloaded.', 'success');
        }
        if (kind === 'print') {
          await flush();
          printDoc();
        }
        if (kind === 'pdf') {
          setBusy(kind);
          await flush();
          await pdfDoc();
        }
      } catch (e) {
        toast(e.message, 'error');
      }
      setBusy('');
    }
    const title = rep && rep.title || cfg.reportTitle;
    const fileBase = 'Nursing-KPI-' + (rep ? rep.from === rep.to ? rep.from : rep.from + '-to-' + rep.to : '');
    const printDoc = () => printSheets(() => docRef.current, title + ' — ' + K.fmtRange(rep.from, rep.to), () => api('/api/kpi/print', {
      method: 'POST',
      body: JSON.stringify({
        id,
        kind: 'print',
        what: layout
      })
    }), setCapturing);
    const pdfDoc = () => pdfSheets(() => docRef.current, title + ' — ' + K.fmtRange(rep.from, rep.to), fileBase, () => api('/api/kpi/print', {
      method: 'POST',
      body: JSON.stringify({
        id,
        kind: 'pdf',
        what: layout
      })
    }), setCapturing);
    if (err) return React.createElement("div", {
      className: "kp-wrap"
    }, React.createElement("div", {
      className: "kp-banner"
    }, err), React.createElement("div", null, React.createElement(Btn, {
      onClick: () => setRoute({
        view: 'kpiReports'
      })
    }, "\u2039 All reports")));
    if (!rep) return React.createElement("div", {
      className: "kp-card kp-empty"
    }, "Preparing the report\u2026");
    const rows = rep.rows,
      sum = rep.summary;
    const period = K.fmtRange(rep.from, rep.to);
    const foot = title + ' · ' + period + ' · ' + (rep.state === 'final' ? 'Final' : 'Draft') + ' · ' + (cfg.hospitalName || '') + (rep.state === 'final' && rep.dataFingerprint ? ' · Data ' + String(rep.dataFingerprint).slice(7, 15) : '');
    const pillars = cfg.pillars.filter(pl => rows.some(r => r.pillar === pl.id));
    let page = 0;
    const pg = () => 'Page ' + ++page;
    const commentBox = (k, v, ph) => editable && !capturing ? React.createElement("div", {
      className: "kp-comment"
    }, React.createElement("textarea", {
      value: v || '',
      placeholder: ph,
      onChange: e => k === '__overall' ? setOverall(e.target.value) : setComment(k, e.target.value)
    })) : v ? React.createElement("div", {
      className: "kp-comment"
    }, v) : null;
    const months6 = rep.months.slice(-6);
    const flatCharts = true;
    return React.createElement("div", {
      className: 'kp-wrap' + (capturing ? ' kp-capturing' : '')
    }, React.createElement("div", {
      className: "kp-card kp-bar",
      style: {
        position: 'sticky',
        top: -22,
        zIndex: 5,
        boxShadow: '0 6px 22px rgba(13,27,46,.10)'
      }
    }, React.createElement(Btn, {
      onClick: () => setRoute({
        view: 'kpiReports'
      })
    }, "\u2039 All reports"), React.createElement("b", {
      style: {
        fontSize: 14
      }
    }, period), React.createElement("span", {
      className: "kp-pill",
      style: rep.state === 'final' ? {
        background: '#e7f6ed',
        color: '#14713f'
      } : rep.state === 'draft' ? {
        background: '#fff1d6',
        color: '#8a5a00'
      } : {
        background: '#eef2f6',
        color: '#5b6878'
      }
    }, rep.state === 'final' ? 'Final' : rep.state === 'draft' ? 'Draft · figures live' : 'Preview · not saved'), saveState && React.createElement("span", {
      className: "kp-muted"
    }, saveState), React.createElement("span", {
      style: {
        flex: 1
      }
    }), React.createElement("div", {
      className: "kp-chips"
    }, React.createElement("button", {
      className: 'kp-chip' + (layout === 'full' ? ' on' : ''),
      onClick: () => setLayout('full'),
      title: "One page per KPI, like the deck"
    }, "Detailed"), React.createElement("button", {
      className: 'kp-chip' + (layout === 'summary' ? ' on' : ''),
      onClick: () => setLayout('summary'),
      title: "Scorecard and one page per pillar"
    }, "Summary"), React.createElement("button", {
      className: 'kp-chip' + (layout === 'calc' ? ' on' : ''),
      onClick: () => setLayout('calc'),
      title: "Detailed, plus how every figure was calculated (units, who sent and approved it) and the data checks"
    }, "Detailed + calculations")), rep.state !== 'final' && (meta.canAdd || meta.canEdit) && React.createElement(Btn, {
      disabled: !!busy,
      onClick: () => act('refresh')
    }, rep.stored ? '↻ Refresh figures' : 'Save as draft'), rep.state !== 'final' && meta.canEdit && React.createElement(Btn, {
      pri: true,
      disabled: !!busy,
      onClick: () => act('finalize')
    }, "Finalise"), rep.state === 'final' && meta.isAdmin && React.createElement(Btn, {
      disabled: !!busy,
      onClick: () => act('reopen')
    }, "Re-open"), meta.canPrint && React.createElement(React.Fragment, null, React.createElement(Btn, {
      disabled: !!busy,
      onClick: () => act('print')
    }, "Print"), React.createElement(Btn, {
      disabled: !!busy,
      onClick: () => act('pdf')
    }, busy === 'pdf' ? 'Making PDF…' : 'PDF'), React.createElement(Btn, {
      disabled: !!busy,
      onClick: () => act('pptx-' + layout),
      title: 'PowerPoint — ' + (layout === 'full' ? 'full deck, one slide per KPI' : layout === 'calc' ? 'full deck with a calculation slide per KPI and the data checks' : 'summary deck')
    }, busy.indexOf('pptx') === 0 ? 'Building…' : 'PowerPoint'), React.createElement(Btn, {
      disabled: !!busy,
      onClick: () => act('xlsx')
    }, busy === 'xlsx' ? 'Building…' : 'Excel')), rep.stored && meta.canDelete && (rep.state !== 'final' || meta.isAdmin) && React.createElement(Btn, {
      danger: true,
      disabled: !!busy,
      onClick: () => act('remove')
    }, "Remove")), rep.state === 'preview' && React.createElement("div", {
      className: "kp-banner info"
    }, "This is a preview. Press \u201CSave as draft\u201D (or start typing a comment) to keep it with its commentary and sign-off."), rep.state !== 'final' && rep.quality && rep.quality.unresolved.length > 0 && React.createElement("div", {
      className: "kp-banner"
    }, React.createElement("span", {
      style: {
        fontSize: 16
      }
    }, "\u2691"), React.createElement("div", null, React.createElement("b", null, rep.quality.unresolved.length, " data error", rep.quality.unresolved.length > 1 ? 's' : '', " must be fixed or acknowledged before this report can be final."), " ", meta.canEdit && React.createElement("button", {
      onClick: () => setAckItems(rep.quality.unresolved)
    }, "Review them"))), rep.state !== 'final' && rep.quality && !rep.quality.unresolved.length && React.createElement("div", {
      className: "kp-banner ok"
    }, React.createElement("span", {
      style: {
        fontSize: 16
      }
    }, "\u2713"), React.createElement("div", null, "All data checks are settled", rep.quality.acknowledged ? ' (' + rep.quality.acknowledged + ' acknowledged with a reason)' : '', rep.quality.warns ? ' · ' + rep.quality.warns + ' warning(s) are printed on the report' : '', ".")), rep.state === 'final' && rep.changedSince && rep.changedSince.length > 0 && React.createElement("div", {
      className: "kp-banner info"
    }, React.createElement("span", {
      style: {
        fontSize: 16
      }
    }, "\u24D8"), React.createElement("div", null, React.createElement("b", null, "The source data has changed since this report was finalised"), " for: ", rep.changedSince.map(x => {
      const r = rows.find(y => y.kpiId === x.kpiId);
      return (r ? r.code + ' ' + r.name : x.kpiId) + ' (' + K.fmtMonth(x.ym) + ')';
    }).join(', '), ". This report still shows the figures as they were when it was finalised", rep.finalizedAt ? ' on ' + when(rep.finalizedAt) : '', ". An administrator can re-open it to bring them up to date.")), React.createElement("div", {
      className: "kp-scroll"
    }, React.createElement("div", {
      className: "kp-doc",
      ref: docRef
    }, React.createElement(Sheet, {
      kicker: (rep.from === rep.to ? 'Monthly report' : 'Report') + ' · ' + period,
      title: title,
      foot: foot,
      page: pg()
    }, React.createElement("div", {
      style: {
        display: 'flex',
        gap: 14,
        marginBottom: 14,
        fontSize: 13,
        color: '#5b6878'
      }
    }, React.createElement("span", null, cfg.hospitalName), React.createElement("span", null, "\xB7"), React.createElement("span", null, rep.cycle.label, rep.cycle.monthNo ? ', month ' + rep.cycle.monthNo + ' of ' + rep.cycle.of : ''), React.createElement("span", null, "\xB7"), React.createElement("span", null, rows.length, " KPIs in ", pillars.length, " pillars")), React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: '210px repeat(4,1fr)',
        gap: 12,
        marginBottom: 16
      }
    }, React.createElement("div", {
      style: {
        borderRadius: 14,
        padding: 12,
        background: 'linear-gradient(140deg,#00293A,#0c6f7d)',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }
    }, React.createElement(ScoreRing, {
      score: sum.score,
      size: 104,
      flat: true
    }), React.createElement("div", {
      style: {
        fontSize: 11,
        opacity: 0.85,
        textAlign: 'center',
        marginTop: 6
      }
    }, sum.scored ? sum.met + ' of ' + sum.scored + ' scored KPIs on target' : 'no scored KPIs')), [['met', sum.met], ['near', sum.near], ['off', sum.off], ['nodata', sum.nodata + sum.notarget + (sum.notstarted || 0) + (sum.notdue || 0)]].map(([k, n]) => React.createElement("div", {
      key: k,
      style: {
        borderRadius: 14,
        padding: '14px 16px',
        background: ST[k].bg,
        border: '1px solid ' + ST[k].color + '55'
      }
    }, React.createElement("div", {
      style: {
        fontSize: 36,
        fontWeight: 800,
        color: ST[k].color,
        lineHeight: 1
      }
    }, n), React.createElement("div", {
      style: {
        fontSize: 13,
        fontWeight: 700,
        color: ST[k].ink,
        marginTop: 6
      }
    }, k === 'nodata' ? 'No data / no target' : ST[k].label), React.createElement("div", {
      style: {
        fontSize: 11,
        color: '#7b8796',
        marginTop: 4
      }
    }, rows.filter(r => k === 'nodata' ? r.status === 'nodata' || r.status === 'notarget' || r.status === 'notstarted' || r.status === 'notdue' : r.status === k).map(r => r.code).join(' · '))))), React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: '1.25fr 1fr',
        gap: 18
      }
    }, React.createElement("div", null, React.createElement("div", {
      className: "kp-lab"
    }, "Achievement against target (100 = on target)"), React.createElement(Iso3D, {
      items: rows.filter(r => r.achievement != null).map(r => ({
        label: r.code || r.name,
        value: r.achievement,
        color: ST[r.status].color
      })),
      max: 150,
      refLine: 100,
      refLabel: "On target",
      height: 250,
      flat: flatCharts
    })), React.createElement("div", null, React.createElement("div", {
      className: "kp-lab"
    }, "Status by pillar"), React.createElement(Iso3DStack, {
      height: 250,
      flat: flatCharts,
      groups: pillars.map(pl => {
        const c = K.summarize(rows.filter(r => r.pillar === pl.id));
        return {
          label: pl.label,
          parts: [{
            value: c.met,
            color: ST.met.color,
            label: 'on target'
          }, {
            value: c.near,
            color: ST.near.color,
            label: 'close'
          }, {
            value: c.off,
            color: ST.off.color,
            label: 'need action'
          }, {
            value: c.nodata + c.notarget + (c.notstarted || 0) + (c.notdue || 0),
            color: ST.nodata.color,
            label: 'no data'
          }]
        };
      })
    }))), React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 18,
        marginTop: 14
      }
    }, [['off', 'Needs attention', rows.filter(r => r.status === 'off' || r.status === 'near').sort((a, b) => (a.achievement == null ? 999 : a.achievement) - (b.achievement == null ? 999 : b.achievement))], ['met', 'On target', rows.filter(r => r.status === 'met')]].map(([k, l, list]) => React.createElement("div", {
      key: k,
      style: {
        borderRadius: 12,
        border: '1px solid ' + ST[k].color + '44',
        overflow: 'hidden'
      }
    }, React.createElement("div", {
      style: {
        background: ST[k].bg,
        color: ST[k].ink,
        padding: '7px 12px',
        fontSize: 12,
        fontWeight: 800
      }
    }, l, " \xB7 ", list.length), React.createElement("div", {
      style: {
        padding: '6px 12px',
        fontSize: 11.5,
        display: 'grid',
        gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)',
        columnGap: 14
      }
    }, list.slice(0, 10).map(r => React.createElement("div", {
      key: r.kpiId,
      style: {
        display: 'flex',
        gap: 6,
        padding: '3px 0',
        borderBottom: '1px dashed #e3e9f0'
      }
    }, React.createElement("b", {
      style: {
        color: '#00293A',
        minWidth: 22
      }
    }, r.code), React.createElement("span", {
      style: {
        flex: 1,
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }
    }, r.name), React.createElement("b", {
      style: {
        color: ST[r.status].color
      }
    }, K.fmt(r, r.period.value)))), !list.length && React.createElement("div", {
      style: {
        color: '#7b8796',
        padding: '3px 0'
      }
    }, "None this period.")))))), React.createElement(Sheet, {
      kicker: period,
      title: "KPI scorecard",
      foot: foot,
      page: pg()
    }, React.createElement("table", {
      className: "kp-stbl"
    }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "#"), React.createElement("th", {
      style: {
        textAlign: 'left'
      }
    }, "KPI"), React.createElement("th", null, "Baseline"), React.createElement("th", null, rep.months.length > 1 ? 'Period' : 'Current'), React.createElement("th", null, "Target"), React.createElement("th", null, "Variance"), React.createElement("th", null, "Status"), React.createElement("th", null, "Trend"), React.createElement("th", null, "12 months"))), React.createElement("tbody", null, rows.map(r => React.createElement("tr", {
      key: r.kpiId
    }, React.createElement("td", null, React.createElement("b", {
      style: {
        color: '#00293A'
      }
    }, r.code)), React.createElement("td", {
      className: "l"
    }, r.name), React.createElement("td", {
      style: {
        color: '#7b8796'
      }
    }, r.baseline && K.has(r.baseline.value) ? K.fmt(r, r.baseline.value) : '—'), React.createElement("td", null, React.createElement("b", null, K.fmt(r, r.period.value)), React.createElement(ResultTag, {
      r: r
    })), React.createElement("td", null, r.target != null ? K.fmt(r, r.target) : '—'), React.createElement("td", {
      style: {
        fontSize: 11
      }
    }, K.gapLabel(r, r.period.value, r.target)), React.createElement("td", {
      style: {
        background: ST[r.status].bg,
        color: ST[r.status].ink,
        fontWeight: 700
      }
    }, ST[r.status].label), React.createElement("td", null, React.createElement(Trend, {
      d: r.trendDir
    })), React.createElement("td", null, React.createElement(Spark, {
      row: r,
      w: 96,
      h: 22
    }))))))), layout === 'summary' && pillars.map(pl => {
      const list = rows.filter(r => r.pillar === pl.id);
      return React.createElement(Sheet, {
        key: pl.id,
        kicker: "Pillar",
        title: pl.label,
        foot: foot,
        page: pg()
      }, React.createElement("table", {
        className: "kp-stbl"
      }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "#"), React.createElement("th", {
        style: {
          textAlign: 'left'
        }
      }, "KPI"), React.createElement("th", null, "Unit"), months6.map(m => React.createElement("th", {
        key: m
      }, K.fmtMonth(m))), React.createElement("th", null, "Period"), React.createElement("th", null, "Target"), React.createElement("th", null, "Status"))), React.createElement("tbody", null, list.map(r => React.createElement("tr", {
        key: r.kpiId
      }, React.createElement("td", null, React.createElement("b", {
        style: {
          color: '#00293A'
        }
      }, r.code)), React.createElement("td", {
        className: "l"
      }, r.name), React.createElement("td", {
        style: {
          fontSize: 10,
          color: '#7b8796'
        }
      }, r.unit), months6.map(m => React.createElement("td", {
        key: m
      }, (r.cells[m] || {}).source === 'not-due' ? React.createElement("span", {
        style: {
          color: '#b9c2cd'
        }
      }, "\xB7") : K.fmt(r, (r.cells[m] || {}).value, {
        bare: true
      }))), React.createElement("td", null, React.createElement("b", null, K.fmt(r, r.period.value))), React.createElement("td", null, r.target != null ? K.fmt(r, r.target) : '—'), React.createElement("td", {
        style: {
          background: ST[r.status].bg,
          color: ST[r.status].ink,
          fontWeight: 700
        }
      }, ST[r.status].label))))), React.createElement("div", {
        style: {
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))',
          gap: 10,
          marginTop: 14
        }
      }, list.map(r => editable && !capturing || rep.commentary[r.kpiId] ? React.createElement("div", {
        key: r.kpiId
      }, React.createElement("div", {
        className: "kp-lab"
      }, r.code, " ", r.name, " \u2014 comment"), commentBox(r.kpiId, rep.commentary[r.kpiId], 'What happened this period and what is being done')) : null)));
    }), (layout === 'full' || layout === 'calc') && pillars.map(pl => rows.filter(r => r.pillar === pl.id).map(r => [React.createElement(Sheet, {
      key: r.kpiId,
      kicker: pl.label,
      title: (r.code ? r.code + '. ' : '') + r.name,
      foot: foot,
      page: pg()
    }, React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: '1.2fr 1fr',
        gap: 18
      }
    }, React.createElement("table", {
      className: "kp-deck"
    }, React.createElement("tbody", null, React.createElement("tr", null, React.createElement("th", null, "Objective"), React.createElement("td", null, r.objective || '—')), React.createElement("tr", null, React.createElement("th", null, "Current"), React.createElement("td", null, React.createElement("b", null, K.fmt(r, r.period.value)), " ", K.unitKind(r) === 'num' ? r.unit : '', resultOf(r) ? React.createElement("b", {
      style: {
        color: '#3f3fa8'
      }
    }, " \u2014 ", resultOf(r)) : null, " ", React.createElement("span", {
      style: {
        color: '#7b8796'
      }
    }, "(baseline ", r.baseline && K.has(r.baseline.value) ? K.fmt(r, r.baseline.value) : 'not measured yet', ")"))), React.createElement("tr", null, React.createElement("th", null, "Target"), React.createElement("td", null, (r.targets || []).length ? r.targets.map(t => (r.targets.length > 1 ? 'Cycle ' + t.cycle + ': ' : '') + K.fmt(r, t.value)).join('  ·  ') : r.target != null ? K.fmt(r, r.target) : 'Not set yet')), React.createElement("tr", null, React.createElement("th", null, "Variance"), React.createElement("td", {
      style: {
        color: ST[r.status].color,
        fontWeight: 700
      }
    }, K.gapLabel(r, r.period.value, r.target), " \xB7 ", ST[r.status].label)), React.createElement("tr", null, React.createElement("th", null, "Action plan"), React.createElement("td", null, (r.actions || []).length ? React.createElement("ul", null, r.actions.slice(0, 10).map(a => React.createElement("li", {
      key: a.id
    }, a.text, a.status !== 'open' ? React.createElement("b", {
      style: {
        color: a.status === 'done' ? '#1f9d57' : '#008FCB'
      }
    }, " [", K.ACTION_LABEL[a.status], "]") : null, a.owner ? React.createElement("span", {
      style: {
        color: '#7b8796'
      }
    }, " \u2014 ", a.owner) : null)), r.actions.length > 10 && React.createElement("li", {
      style: {
        color: '#7b8796'
      }
    }, "+ ", r.actions.length - 10, " more")) : '—')), React.createElement("tr", null, React.createElement("th", null, "Formula used"), React.createElement("td", {
      style: {
        fontStyle: 'italic'
      }
    }, r.formulaText || '—')), React.createElement("tr", null, React.createElement("th", null, "Tracking"), React.createElement("td", null, r.schedule || r.frequency || 'Monthly', r.trackingNote ? ' · ' + r.trackingNote : '', r.nextDue ? React.createElement("span", {
      style: {
        color: '#7b8796'
      }
    }, " \xB7 next result ", K.fmtMonthLong(r.nextDue)) : null)), React.createElement("tr", null, React.createElement("th", null, "Remarks"), React.createElement("td", {
      style: {
        whiteSpace: 'pre-wrap',
        fontSize: 11
      }
    }, r.remarks || '—')))), React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 10
      }
    }, React.createElement("div", {
      className: "kp-lab"
    }, r.freqMonths > 1 ? 'Last 12 months · one point per period' : 'Last 12 months', r.unit ? ' · ' + r.unit : ''), React.createElement(KpiChart, {
      row: r,
      kind: "area",
      height: r.freqMonths > 1 ? 150 : 210,
      flat: true
    }), r.freqMonths > 1 && React.createElement(PeriodsTable, {
      row: r
    }), React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(3,1fr)',
        gap: 8
      }
    }, [[K.fmt(r, r.period.value), resultOf(r) || (rep.months.length > 1 ? 'Period value' : 'This month'), '#00293A', '#eaf6fb'], [r.target != null ? K.fmt(r, r.target) : '—', 'Target', '#00293A', '#eef7f5'], [ST[r.status].label, r.achievement != null ? r.achievement + '% of target' : 'status', ST[r.status].color, ST[r.status].bg]].map(([b, s, c, bg], i) => React.createElement("div", {
      key: i,
      style: {
        background: bg,
        borderRadius: 10,
        padding: '10px 8px',
        textAlign: 'center'
      }
    }, React.createElement("div", {
      style: {
        fontSize: 17,
        fontWeight: 800,
        color: c
      }
    }, b), React.createElement("div", {
      style: {
        fontSize: 10.5,
        color: '#7b8796'
      }
    }, s)))), React.createElement("div", null, React.createElement("div", {
      className: "kp-lab"
    }, "Comment for this period"), commentBox(r.kpiId, rep.commentary[r.kpiId], 'What happened this period, and what is being done') || React.createElement("div", {
      className: "kp-muted"
    }, "\u2014"))))), layout === 'calc' && r.evidence ? React.createElement(Sheet, {
      key: r.kpiId + '-calc',
      kicker: pl.label + ' · how it was calculated',
      title: (r.code ? r.code + '. ' : '') + r.name,
      foot: foot,
      page: pg()
    }, React.createElement(CalcSheetBody, {
      row: r,
      months: rep.months,
      acks: rep.acks
    })) : null])), layout === 'calc' && rep.quality && (() => {
      const list = rep.quality.checks.filter(c => c.level !== 'info');
      const pages = [];
      for (let i = 0; i < Math.max(list.length, 1); i += 18) pages.push(list.slice(i, i + 18));
      const codeOf = id => (rows.find(x => x.kpiId === id) || {}).code || id;
      return pages.map((pgList, i) => React.createElement(Sheet, {
        key: 'dq' + i,
        kicker: period + (pages.length > 1 ? ' · ' + (i + 1) + ' of ' + pages.length : ''),
        title: "Data quality",
        foot: foot,
        page: pg()
      }, React.createElement("div", {
        style: {
          display: 'flex',
          gap: 12,
          marginBottom: 10,
          fontSize: 12.5,
          alignItems: 'center'
        }
      }, React.createElement("span", {
        className: "kp-pill",
        style: {
          background: '#fde4e8',
          color: '#a3172f'
        }
      }, rep.quality.errors, " error", rep.quality.errors === 1 ? '' : 's'), React.createElement("span", {
        className: "kp-pill",
        style: {
          background: '#e7f6ed',
          color: '#14713f'
        }
      }, rep.quality.acknowledged, " acknowledged"), React.createElement("span", {
        className: "kp-pill",
        style: {
          background: '#fff6e0',
          color: '#8a5a00'
        }
      }, rep.quality.warns, " warning", rep.quality.warns === 1 ? '' : 's'), rep.dataFingerprint && React.createElement("span", {
        className: "kp-muted"
      }, "Data fingerprint ", String(rep.dataFingerprint).slice(7, 19))), pgList.length ? React.createElement("table", {
        className: "kp-stbl"
      }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Level"), React.createElement("th", null, "KPI"), React.createElement("th", null, "Month"), React.createElement("th", {
        style: {
          textAlign: 'left'
        }
      }, "What was found"), React.createElement("th", {
        style: {
          textAlign: 'left'
        }
      }, "Acknowledged"))), React.createElement("tbody", null, pgList.map(c => React.createElement("tr", {
        key: c.key
      }, React.createElement("td", {
        style: {
          color: c.level === 'error' ? '#a3172f' : '#8a5a00',
          fontWeight: 700
        }
      }, c.level === 'error' ? 'Error' : 'Warning'), React.createElement("td", null, React.createElement("b", null, codeOf(c.kpiId))), React.createElement("td", null, K.fmtMonth(c.ym)), React.createElement("td", {
        className: "l",
        style: {
          fontSize: 10.5
        }
      }, c.text), React.createElement("td", {
        className: "l",
        style: {
          fontSize: 10.5,
          color: c.ack && c.ack.current ? '#14713f' : c.level === 'error' ? '#a3172f' : '#7b8796'
        }
      }, c.ack ? c.ack.current ? c.ack.by + ': “' + c.ack.reason + '”' : 'given for older data — needs a new one' : c.level === 'error' ? 'NOT RESOLVED' : '—'))))) : React.createElement("div", {
        className: "kp-banner ok"
      }, "\u2713 Every figure in this report passed the data checks.")));
    })(), React.createElement(Sheet, {
      kicker: period,
      title: "Summary & sign-off",
      foot: foot,
      page: pg()
    }, React.createElement("div", {
      className: "kp-lab"
    }, "Overall summary"), commentBox('__overall', rep.overall, 'The month in a few lines: what improved, what needs attention, decisions needed') || React.createElement("ul", {
      style: {
        fontSize: 13,
        lineHeight: 1.6
      }
    }, React.createElement("li", null, sum.met, " of ", rows.length, " KPIs on target", sum.met ? ': ' + rows.filter(r => r.status === 'met').map(r => r.code).join(', ') : '', "."), sum.near > 0 && React.createElement("li", null, sum.near, " close: ", rows.filter(r => r.status === 'near').map(r => r.code + ' ' + r.name).join(', '), "."), sum.off > 0 && React.createElement("li", null, sum.off, " need action: ", rows.filter(r => r.status === 'off').map(r => r.code + ' ' + r.name).join(', '), "."), sum.nodata > 0 && React.createElement("li", null, sum.nodata, " without figures for the period: ", rows.filter(r => r.status === 'nodata').map(r => r.code).join(', '), ".")), (layout === 'full' || layout === 'calc') && (() => {
      const open = [];
      rows.forEach(r => (r.actions || []).forEach(a => {
        if (a.status === 'progress' || (a.owner || a.due) && a.status === 'open') open.push([r, a]);
      }));
      return open.length ? React.createElement("div", {
        style: {
          marginTop: 14
        }
      }, React.createElement("div", {
        className: "kp-lab"
      }, "Action plans in progress"), React.createElement("table", {
        className: "kp-stbl"
      }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "#"), React.createElement("th", {
        style: {
          textAlign: 'left'
        }
      }, "Action"), React.createElement("th", null, "Owner"), React.createElement("th", null, "Due"), React.createElement("th", null, "Status"))), React.createElement("tbody", null, open.slice(0, 12).map(([r, a]) => React.createElement("tr", {
        key: r.kpiId + a.id
      }, React.createElement("td", null, React.createElement("b", null, r.code)), React.createElement("td", {
        className: "l"
      }, a.text), React.createElement("td", null, a.owner || '—'), React.createElement("td", {
        style: {
          color: a.due && a.due < rep.to ? '#d23a52' : undefined
        }
      }, a.due ? K.fmtMonth(a.due) : '—'), React.createElement("td", null, K.ACTION_LABEL[a.status])))))) : null;
    })(), React.createElement("div", {
      className: "kp-signs",
      style: {
        position: 'absolute',
        left: 52,
        right: 44,
        bottom: 64
      }
    }, [['prepared', 'Prepared by'], ['reviewed', 'Reviewed by'], ['recommended', 'Recommended by'], ['approved', 'Approved by']].map(([k, l]) => React.createElement("div", {
      key: k
    }, React.createElement("span", null, l), editable && !capturing ? React.createElement("input", {
      value: sig[k] || '',
      onChange: e => setSig(k, e.target.value),
      placeholder: "Name"
    }) : sig[k] || ' '))), React.createElement("div", {
      style: {
        position: 'absolute',
        left: 52,
        right: 44,
        bottom: 40,
        fontSize: 9,
        color: '#a3adba',
        textAlign: 'center'
      }
    }, "Automatically generated by the system \xB7 Developed by Nasif Ahammed Niloy", rep.state === 'final' ? ' · Final — finalised by ' + (rep.finalizedBy || '—') + ' on ' + when(rep.finalizedAt) : '')))), ackItems && React.createElement(AckDialog, {
      id: id,
      items: ackItems,
      meta: meta,
      setRoute: setRoute,
      onClose: () => {
        setAckItems(null);
        setTick(t => t + 1);
      },
      onDone: () => {
        setAckItems(null);
        act('finalize');
      }
    }));
  }
  const BLANK = {
    name: '',
    code: '',
    pillar: 'safety',
    objective: '',
    unit: '%',
    formula: 'pct',
    goalDirection: 'higher_is_better',
    decimals: '',
    formulaText: '',
    numLabel: '',
    denLabel: '',
    frequency: 'Monthly for 6 months & later for another 6 months',
    freqMonths: 1,
    cycleMonths: null,
    cycles: null,
    remarks: '',
    baseline: {
      value: '',
      note: ''
    },
    targets: [],
    baselineTargetPct: '',
    source: {
      indId: null
    },
    actions: [],
    autoFill: true,
    startMonth: '',
    units: []
  };
  const CYCLE_CHOICES = [1, 2, 3, 4, 6, 9, 12, 18, 24];
  const cycleChoices = f => CYCLE_CHOICES.filter(n => n % f === 0);
  const withFreq = (x, f) => Object.assign({}, x, {
    freqMonths: f,
    cycleMonths: x.cycleMonths && x.cycleMonths % f ? null : x.cycleMonths
  });
  function ScheduleBox({
    d,
    setD,
    cfg,
    can,
    isAdmin
  }) {
    const f = K.freqOf(d);
    const set = (k, v) => setD(x => Object.assign({}, x, {
      [k]: v
    }));
    return React.createElement("div", {
      className: "kp-card kp-pad",
      style: {
        boxShadow: 'none',
        background: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        gap: 8
      }
    }, React.createElement("div", {
      className: "kp-lab"
    }, "Schedule \u2014 how often it is measured, and its cycles", !isAdmin && React.createElement("span", {
      style: {
        textTransform: 'none',
        fontWeight: 600,
        color: '#7b8796'
      }
    }, " \xB7 set by an administrator (Settings \u2192 KPI schedule)")), React.createElement("div", {
      className: "kp-row"
    }, React.createElement("label", {
      className: "kp-fld"
    }, React.createElement("span", {
      className: "kp-lab"
    }, "Measured"), React.createElement("select", {
      className: "kp-sel",
      value: f,
      disabled: !can,
      onChange: e => setD(x => withFreq(x, +e.target.value))
    }, K.FREQS.map(x => React.createElement("option", {
      key: x.m,
      value: x.m
    }, x.label)))), React.createElement("label", {
      className: "kp-fld"
    }, React.createElement("span", {
      className: "kp-lab"
    }, "Cycle length"), React.createElement("select", {
      className: "kp-sel",
      value: d.cycleMonths || '',
      disabled: !can,
      onChange: e => set('cycleMonths', e.target.value ? +e.target.value : null)
    }, React.createElement("option", {
      value: ""
    }, "Same as all KPIs (", K.cycleCfg({
      freqMonths: f
    }, cfg).cycleMonths, " months)"), cycleChoices(f).map(n => React.createElement("option", {
      key: n,
      value: n
    }, n, " months")))), React.createElement("label", {
      className: "kp-fld"
    }, React.createElement("span", {
      className: "kp-lab"
    }, "Cycles"), React.createElement("select", {
      className: "kp-sel",
      value: d.cycles || '',
      disabled: !can,
      onChange: e => set('cycles', e.target.value ? +e.target.value : null)
    }, React.createElement("option", {
      value: ""
    }, "Same as all KPIs (", K.cfgOf(cfg).cycles, ")"), [1, 2, 3, 4, 5, 6].map(n => React.createElement("option", {
      key: n,
      value: n
    }, n))))), React.createElement("div", {
      className: "kp-muted",
      style: {
        fontSize: 11.5
      }
    }, K.scheduleText(d, cfg)), f > 1 && React.createElement("div", {
      className: "kp-muted",
      style: {
        fontSize: 11.5
      }
    }, "One figure per period, entered in the period\u2019s last month (", K.dueMonths(d, K.startOf(d, cfg), K.addMonth(K.startOf(d, cfg), 23), cfg).slice(0, 4).map(K.fmtMonth).join(', '), "\u2026). The months between owe nothing."));
  }
  function KpiEditor({
    meta,
    def,
    onClose,
    onSaved
  }) {
    const cfg = meta.config;
    const isNew = !def;
    const [d, setD] = useState(() => JSON.parse(JSON.stringify(Object.assign({}, BLANK, def || {
      pillar: cfg.pillars[0].id
    }))));
    const [tab, setTab] = useState('basics');
    const [inds, setInds] = useState(null);
    const [q, setQ] = useState('');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const may = isNew ? meta.canAdd || meta.canEdit : meta.canEdit;
    const set = (k, v) => setD(x => Object.assign({}, x, {
      [k]: v
    }));
    const [areas, setAreas] = useState(null);
    const [setupUnits, setSetupUnits] = useState(null);
    useEffect(() => {
      if ((tab === 'measure' || tab === 'units') && !inds) api('/api/kpi/indicators').then(j => {
        setInds(j.indicators);
        setAreas(j.areas || []);
      }).catch(() => {
        setInds([]);
        setAreas([]);
      });
    }, [tab]);
    useEffect(() => {
      if (tab !== 'units' || !(d.source && d.source.indId)) return;
      const qs = def && def.id && def.source && def.source.indId === d.source.indId ? 'kpi=' + encodeURIComponent(def.id) : 'indId=' + encodeURIComponent(d.source.indId) + '&indName=' + encodeURIComponent(d.source.indName || '') + '&rule=' + encodeURIComponent(d.source.rule || '');
      setSetupUnits(null);
      api('/api/kpi/units?' + qs).then(j => setSetupUnits(j.units)).catch(() => setSetupUnits([]));
    }, [tab, d.source && d.source.indId]);
    const tgt = c => {
      const t = (d.targets || []).find(x => x.cycle === c);
      return t ? String(t.value) : '';
    };
    const setTgt = (c, v) => set('targets', (d.targets || []).filter(x => x.cycle !== c).concat(v === '' ? [] : [{
      cycle: c,
      value: v
    }]).sort((a, b) => a.cycle - b.cycle));
    const setAct = (i, k, v) => set('actions', d.actions.map((a, j) => j === i ? Object.assign({}, a, {
      [k]: v
    }) : a));
    const moveAct = (i, n) => {
      const a = d.actions.slice();
      const [x] = a.splice(i, 1);
      a.splice(i + n, 0, x);
      set('actions', a);
    };
    async function save() {
      if (!String(d.name || '').trim()) {
        setTab('basics');
        setErr('Give the KPI a name.');
        return;
      }
      setBusy(true);
      setErr('');
      const body = Object.assign({}, d, {
        startMonth: K.isMonth(d.startMonth) ? d.startMonth : null,
        units: Array.isArray(d.units) ? d.units : [],
        baseline: {
          value: d.baseline && d.baseline.value !== '' ? d.baseline.value : null,
          note: d.baseline && d.baseline.note || ''
        },
        decimals: d.decimals === '' ? null : d.decimals,
        baselineTargetPct: d.baselineTargetPct === '' ? null : d.baselineTargetPct,
        baseUpdatedAt: isNew ? undefined : def.updatedAt
      });
      try {
        const j = isNew ? await api('/api/kpi/defs', {
          method: 'POST',
          body: JSON.stringify(body)
        }) : await api('/api/kpi/defs/' + encodeURIComponent(def.id), {
          method: 'PUT',
          body: JSON.stringify(body)
        });
        toast(isNew ? 'KPI added.' : 'Saved.', 'success');
        onSaved(j.def);
      } catch (e) {
        setErr(e.message);
        setBusy(false);
      }
    }
    const linked = d.source && d.source.indId;
    const shownInds = (inds || []).filter(i => !q || (i.name + ' ' + i.id).toLowerCase().indexOf(q.toLowerCase()) >= 0).slice(0, 60);
    const fld = (label, el, hint) => React.createElement("label", {
      className: "kp-fld"
    }, React.createElement("span", {
      className: "kp-lab"
    }, label), el, hint && React.createElement("span", {
      className: "hint"
    }, hint));
    return React.createElement("div", {
      className: "kp-back",
      onMouseDown: e => e.target === e.currentTarget && onClose()
    }, React.createElement("div", {
      className: "kp-dlg wide",
      role: "dialog"
    }, React.createElement("div", {
      className: "kp-dlg-h"
    }, React.createElement("div", null, React.createElement("h3", null, isNew ? 'Add a KPI' : (d.code ? d.code + '. ' : '') + d.name), React.createElement("div", {
      className: "kp-muted"
    }, isNew ? 'A KPI of your own — typed monthly, or linked to a quality indicator so its months fill themselves.' : 'Every field of the KPI deck. Changes apply to the dashboard and to draft reports; final reports keep what they had.')), React.createElement("button", {
      className: "kp-x",
      onClick: onClose
    }, "\xD7")), React.createElement("div", {
      className: "kp-tabs"
    }, [['basics', 'Basics'], ['measure', 'Measure & data'], ['units', 'Units expected' + (d.units && d.units.length ? ' (' + d.units.length + ')' : '')], ['targets', 'Baseline & targets'], ['actions', 'Action plan (' + d.actions.length + ')'], ['remarks', 'Remarks']].map(([k, l]) => React.createElement("button", {
      key: k,
      className: tab === k ? 'on' : '',
      onClick: () => setTab(k)
    }, l))), React.createElement("div", {
      className: "kp-dlg-b",
      style: {
        minHeight: 330
      }
    }, tab === 'basics' && React.createElement(React.Fragment, null, React.createElement("div", {
      className: "kp-row"
    }, fld('Name', React.createElement("input", {
      className: "kp-in",
      value: d.name,
      onChange: e => set('name', e.target.value),
      placeholder: "e.g. IV Cannula Phlebitis",
      disabled: !may
    })), React.createElement("div", {
      style: {
        flex: '0 0 110px',
        minWidth: 90
      }
    }, fld('Code', React.createElement("input", {
      className: "kp-in",
      value: d.code,
      maxLength: 8,
      onChange: e => set('code', e.target.value),
      placeholder: "1I",
      disabled: !may
    })))), fld('Pillar', React.createElement("div", {
      className: "kp-chips"
    }, cfg.pillars.map(pl => React.createElement("button", {
      key: pl.id,
      disabled: !may,
      className: 'kp-chip' + (d.pillar === pl.id ? ' on' : ''),
      style: d.pillar === pl.id ? {
        background: pl.color,
        borderColor: pl.color
      } : undefined,
      onClick: () => set('pillar', pl.id)
    }, pl.label)))), fld('Objective', React.createElement("textarea", {
      className: "kp-in",
      rows: 3,
      value: d.objective,
      onChange: e => set('objective', e.target.value),
      placeholder: "To reduce \u2026 / To improve \u2026",
      disabled: !may
    })), React.createElement("div", {
      className: "kp-row",
      style: {
        alignItems: 'flex-end'
      }
    }, fld('This KPI starts on', React.createElement("div", {
      style: {
        display: 'flex',
        gap: 6,
        alignItems: 'center'
      }
    }, React.createElement("input", {
      type: "month",
      className: "kp-in",
      value: d.startMonth || '',
      disabled: !may,
      onChange: e => set('startMonth', e.target.value)
    }), d.startMonth && may ? React.createElement("button", {
      className: "kp-icon-btn",
      onClick: () => set('startMonth', '')
    }, "Same as all KPIs") : null), d.startMonth ? 'Counting starts ' + K.fmtMonthLong(d.startMonth) + ': cycles and targets count from here; earlier months are not counted and are never “missing”.' : 'Blank = the same as all KPIs (' + K.fmtMonthLong(cfg.cycleStart) + ', set in Settings).')), React.createElement(ScheduleBox, {
      d: d,
      setD: setD,
      cfg: cfg,
      can: may && meta.isAdmin,
      isAdmin: meta.isAdmin
    })), tab === 'units' && React.createElement(React.Fragment, null, !linked ? React.createElement("div", {
      className: "kp-banner info"
    }, "This KPI is typed monthly, so it has no reporting units. Link it to a quality indicator (Measure & data) to check which units report it.") : React.createElement(React.Fragment, null, React.createElement("div", {
      className: "kp-muted"
    }, "The units that must send ", React.createElement("b", null, d.source.indName || d.source.indId), " each month. A unit on this list with no figure is a ", React.createElement("b", null, "data error"), " on the report until it is fixed or acknowledged."), React.createElement("div", {
      style: {
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        flexWrap: 'wrap'
      }
    }, React.createElement("label", {
      className: 'kp-switch light' + (d.units && d.units.length ? '' : ' on'),
      onClick: () => may && set('units', d.units && d.units.length ? [] : (setupUnits || []).map(u => u.key))
    }, React.createElement("i", null), React.createElement("span", null, d.units && d.units.length ? 'My own list (tick the units below)' : 'Follow Department Setup automatically')), may && React.createElement(Btn, {
      onClick: () => set('units', (setupUnits || []).map(u => u.key)),
      disabled: !setupUnits
    }, "Fill from Department Setup")), (() => {
      const mine = new Set(d.units || []);
      const setupKeys = new Set((setupUnits || []).map(u => u.key));
      const own = (d.units || []).length > 0;
      const extra = own ? [...mine].filter(k => setupUnits && !setupKeys.has(k)) : [];
      const missing = own ? (setupUnits || []).filter(u => !mine.has(u.key)) : [];
      return React.createElement(React.Fragment, null, own && setupUnits && (extra.length || missing.length) ? React.createElement("div", {
        className: "kp-banner"
      }, "Differs from Department Setup \u2014 ", missing.length ? 'Setup also expects: ' + missing.map(u => u.name).join(', ') + '. ' : '', extra.length ? 'Not due per Setup: ' + extra.map(k => ((areas || []).find(a => a.key === k) || {}).name || k).join(', ') + '.' : '', " The report will show this as a warning.") : null, !own && React.createElement("div", {
        className: "kp-banner ok"
      }, "Following Department Setup: ", setupUnits == null ? 'checking…' : setupUnits.length ? setupUnits.map(u => u.name).join(', ') : 'no unit is due for this indicator', "."), React.createElement("div", {
        style: {
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))',
          gap: 6
        }
      }, (areas || []).map(a => {
        const on = own ? mine.has(a.key) : setupKeys.has(a.key);
        return React.createElement("label", {
          key: a.key,
          style: {
            display: 'flex',
            gap: 7,
            alignItems: 'center',
            padding: '6px 9px',
            borderRadius: 8,
            border: '1px solid ' + (on ? '#9fdcc0' : 'var(--line)'),
            background: on ? '#effaf4' : '#fff',
            fontSize: 12.5,
            cursor: may && own ? 'pointer' : 'default',
            opacity: own ? 1 : 0.8
          }
        }, React.createElement("input", {
          type: "checkbox",
          style: {
            width: 'auto'
          },
          checked: on,
          disabled: !may || !own,
          onChange: e => set('units', e.target.checked ? (d.units || []).concat([a.key]) : (d.units || []).filter(k => k !== a.key))
        }), React.createElement("span", {
          style: {
            flex: 1
          }
        }, a.name, a.hospital ? ' (hospital)' : ''), setupKeys.has(a.key) && React.createElement("span", {
          className: "kp-src",
          style: {
            background: '#e1f1fa',
            color: '#0b4f6c'
          }
        }, "Setup"));
      })));
    })())), tab === 'measure' && React.createElement(React.Fragment, null, React.createElement("div", {
      className: "kp-card kp-pad",
      style: {
        background: linked ? '#ecfaf7' : '#f6f9fc',
        display: 'flex',
        flexDirection: 'column',
        gap: 8
      }
    }, React.createElement("div", {
      style: {
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        flexWrap: 'wrap'
      }
    }, React.createElement("b", {
      style: {
        fontSize: 13
      }
    }, "Where the monthly figures come from"), React.createElement("span", {
      style: {
        flex: 1
      }
    }), linked && may && React.createElement(Btn, {
      onClick: () => set('source', {
        indId: null
      })
    }, "Unlink \u2014 type them monthly")), linked && React.createElement("label", {
      className: 'kp-switch light' + (d.autoFill !== false ? ' on' : ''),
      onClick: () => may && set('autoFill', d.autoFill === false)
    }, React.createElement("i", null), React.createElement("span", null, d.autoFill !== false ? 'Auto-fill from the quality data: ON' : 'Auto-fill from the quality data: OFF — typed monthly, the system figure is shown as a hint')), linked ? React.createElement("div", {
      style: {
        fontSize: 12.5
      }
    }, d.autoFill !== false ? 'Filled automatically from' : 'Linked (for reference) to', " the quality indicator ", React.createElement("b", null, d.source.indName || d.source.indId), d.source.rule ? ' (' + {
      hh: 'hand hygiene audit',
      fall: 'all units, out-patient falls left out',
      pool: 'all units pooled',
      hospital: 'Overall Hospital'
    }[d.source.rule] + ')' : '', ". ", d.autoFill !== false ? 'Any month can still be typed over in Data Update — with a reason.' : 'Each month is typed in Data Update.') : React.createElement("div", {
      style: {
        fontSize: 12.5
      }
    }, "Typed each month in Data Update. Or link it to a quality indicator the units already report:"), may && React.createElement(React.Fragment, null, React.createElement("input", {
      className: "kp-in",
      placeholder: "Search the quality indicators\u2026",
      value: q,
      onChange: e => setQ(e.target.value)
    }), React.createElement("div", {
      style: {
        maxHeight: 170,
        overflow: 'auto',
        border: '1px solid var(--line)',
        borderRadius: 8,
        background: '#fff'
      }
    }, !inds && React.createElement("div", {
      className: "kp-muted",
      style: {
        padding: 10
      }
    }, "Loading the indicators\u2026"), shownInds.map(i => React.createElement("div", {
      key: i.id,
      onClick: () => setD(x => Object.assign({}, x, {
        source: {
          indId: i.id,
          indName: i.name,
          rule: null
        }
      }, x.formulaText ? {} : {
        formula: K.FORMULAS.indexOf(i.formula) >= 0 ? i.formula : x.formula,
        unit: i.unit || x.unit
      })),
      style: {
        padding: '7px 10px',
        borderBottom: '1px solid var(--line-2)',
        cursor: 'pointer',
        fontSize: 12.5,
        background: linked === i.id ? '#dff5f1' : undefined
      }
    }, React.createElement("b", null, i.name), " ", React.createElement("span", {
      className: "kp-muted"
    }, "\xB7 ", i.hospital ? 'Overall Hospital' : i.areas.length + ' unit(s)', " \xB7 ", i.formula || '—')))))), React.createElement("div", {
      className: "kp-row"
    }, fld('How it is calculated', React.createElement("select", {
      className: "kp-sel",
      value: d.formula,
      disabled: !may,
      onChange: e => set('formula', e.target.value)
    }, K.FORMULAS.map(f => React.createElement("option", {
      key: f,
      value: f
    }, K.FORMULA_LABEL[f])))), fld('Unit', React.createElement("input", {
      className: "kp-in",
      value: d.unit,
      disabled: !may,
      onChange: e => set('unit', e.target.value),
      placeholder: "% \xB7 per 1000 patient-days \xB7 minutes \xB7 BDT per patient-day"
    }))), React.createElement("div", {
      className: "kp-row"
    }, fld('Better when', React.createElement("div", {
      className: "kp-chips"
    }, React.createElement("button", {
      disabled: !may,
      className: 'kp-chip' + (d.goalDirection === 'higher_is_better' ? ' on' : ''),
      onClick: () => set('goalDirection', 'higher_is_better')
    }, "\u25B2 Higher"), React.createElement("button", {
      disabled: !may,
      className: 'kp-chip' + (d.goalDirection === 'lower_is_better' ? ' on' : ''),
      onClick: () => set('goalDirection', 'lower_is_better')
    }, "\u25BC Lower"))), fld('Decimals', React.createElement("select", {
      className: "kp-sel",
      value: d.decimals == null ? '' : d.decimals,
      disabled: !may,
      onChange: e => set('decimals', e.target.value === '' ? '' : +e.target.value)
    }, React.createElement("option", {
      value: ""
    }, "Automatic"), [0, 1, 2, 3].map(n => React.createElement("option", {
      key: n,
      value: n
    }, n))))), d.formula !== 'direct' && React.createElement("div", {
      className: "kp-row"
    }, fld('Numerator — what is counted', React.createElement("input", {
      className: "kp-in",
      value: d.numLabel,
      disabled: !may,
      onChange: e => set('numLabel', e.target.value),
      placeholder: "e.g. Number of patient falls"
    })), d.formula !== 'count' && fld('Denominator — counted against', React.createElement("input", {
      className: "kp-in",
      value: d.denLabel,
      disabled: !may,
      onChange: e => set('denLabel', e.target.value),
      placeholder: "e.g. Patient-days"
    }))), fld('Formula as written on the report', React.createElement("input", {
      className: "kp-in",
      value: d.formulaText,
      disabled: !may,
      onChange: e => set('formulaText', e.target.value),
      placeholder: "(Number of patient falls \xF7 Patient-days) \xD7 1000"
    }))), tab === 'targets' && React.createElement(React.Fragment, null, React.createElement("div", {
      className: "kp-row"
    }, fld('Baseline (the deck’s “Current”)', React.createElement("input", {
      className: "kp-in",
      inputMode: "decimal",
      value: d.baseline && d.baseline.value != null ? d.baseline.value : '',
      disabled: !may,
      onChange: e => set('baseline', Object.assign({}, d.baseline, {
        value: e.target.value.replace(/[^0-9.\-]/g, '')
      })),
      placeholder: "Not measured yet"
    })), fld('Where the baseline comes from', React.createElement("input", {
      className: "kp-in",
      value: d.baseline && d.baseline.note || '',
      disabled: !may,
      onChange: e => set('baseline', Object.assign({}, d.baseline, {
        note: e.target.value
      })),
      placeholder: "e.g. Survey Aug 2026"
    }))), React.createElement("div", {
      className: "kp-card kp-pad",
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 10
      }
    }, React.createElement("b", {
      style: {
        fontSize: 13
      }
    }, "Target per cycle"), React.createElement("div", {
      className: "kp-muted"
    }, "This KPI runs ", K.cycleCfg(d, cfg).cycles, " cycle(s) of ", K.cycleCfg(d, cfg).cycleMonths, " months from ", K.fmtMonth(K.startOf(d, cfg)), K.cycleCfg(d, cfg).own ? ' (its own cycles)' : '', ". A cycle left empty keeps the previous cycle's target."), React.createElement("div", {
      className: "kp-row"
    }, Array.from({
      length: K.cycleCfg(d, cfg).cycles
    }, (_, i) => i + 1).map(c => {
      const r = K.cycleRange(c, cfg, d);
      return fld('Cycle ' + c + ' · ' + K.fmtRange(r.from, r.to), React.createElement("input", {
        className: "kp-in",
        inputMode: "decimal",
        value: tgt(c),
        disabled: !may,
        onChange: e => setTgt(c, e.target.value.replace(/[^0-9.\-]/g, '')),
        placeholder: c > 1 && tgt(c - 1) ? 'same as cycle ' + (c - 1) : 'Not set'
      }));
    })), React.createElement("div", {
      className: "kp-row",
      style: {
        alignItems: 'flex-end'
      }
    }, fld('Or: a target relative to the baseline (%)', React.createElement("input", {
      className: "kp-in",
      inputMode: "decimal",
      value: d.baselineTargetPct == null ? '' : d.baselineTargetPct,
      disabled: !may,
      onChange: e => set('baselineTargetPct', e.target.value.replace(/[^0-9.\-]/g, '')),
      placeholder: "e.g. -5 = 5% below the baseline"
    }), 'Used only when no cycle target is set (Consumables: 5% below the existing cost).')))), tab === 'actions' && React.createElement(React.Fragment, null, React.createElement("div", {
      className: "kp-muted"
    }, "Each point of the action plan, with who owns it, by when, and how far it has got. The Action Plans board shows them all."), d.actions.map((a, i) => React.createElement("div", {
      key: a.id || i,
      className: "kp-card kp-pad",
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 7
      }
    }, React.createElement("div", {
      style: {
        display: 'flex',
        gap: 6
      }
    }, React.createElement("textarea", {
      className: "kp-in",
      rows: 2,
      value: a.text,
      disabled: !may,
      onChange: e => setAct(i, 'text', e.target.value),
      placeholder: "What will be done"
    }), may && React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 3
      }
    }, React.createElement("button", {
      className: "kp-icon-btn",
      disabled: i === 0,
      onClick: () => moveAct(i, -1)
    }, "\u2191"), React.createElement("button", {
      className: "kp-icon-btn",
      disabled: i === d.actions.length - 1,
      onClick: () => moveAct(i, 1)
    }, "\u2193"), React.createElement("button", {
      className: "kp-icon-btn",
      onClick: () => set('actions', d.actions.filter((_, j) => j !== i)),
      title: "Remove"
    }, "\u2715"))), React.createElement("div", {
      className: "kp-row"
    }, React.createElement("input", {
      className: "kp-in",
      value: a.owner || '',
      disabled: !may,
      onChange: e => setAct(i, 'owner', e.target.value),
      placeholder: "Owner \u2014 e.g. IC Nurse"
    }), React.createElement("input", {
      type: "month",
      className: "kp-in",
      value: a.due || '',
      disabled: !may,
      onChange: e => setAct(i, 'due', e.target.value),
      title: "Due month"
    }), React.createElement("select", {
      className: "kp-sel",
      value: a.status || 'open',
      disabled: !may,
      onChange: e => setAct(i, 'status', e.target.value)
    }, K.ACTION_STATUSES.map(s => React.createElement("option", {
      key: s,
      value: s
    }, K.ACTION_LABEL[s])))))), may && React.createElement("div", null, React.createElement(Btn, {
      onClick: () => set('actions', d.actions.concat([{
        id: '',
        text: '',
        owner: '',
        due: '',
        status: 'open',
        note: ''
      }]))
    }, "+ Add an action"))), tab === 'remarks' && React.createElement(React.Fragment, null, fld('Tracking note (optional)', React.createElement("input", {
      className: "kp-in",
      value: K.trackingNote(d),
      disabled: !may,
      onChange: e => set('frequency', e.target.value),
      placeholder: "e.g. survey in the first week of the period's last month"
    }), 'Documents print the schedule (Basics → Schedule: ' + K.freqLabel(d, true).toLowerCase() + '); a note here is added after it.'), fld('Remarks', React.createElement("textarea", {
      className: "kp-in",
      rows: 9,
      value: d.remarks,
      disabled: !may,
      onChange: e => set('remarks', e.target.value),
      placeholder: "Anything readers of the report should know. One point per line shows as a list."
    }), 'Shown on the KPI page of every report and in the deck (long remarks get a notes slide).')), err && React.createElement("div", {
      className: "kp-err"
    }, err)), React.createElement("div", {
      className: "kp-dlg-f"
    }, may && React.createElement(Btn, {
      pri: true,
      disabled: busy,
      onClick: save
    }, busy ? 'Saving…' : isNew ? 'Add KPI' : 'Save changes'), React.createElement("span", {
      style: {
        flex: 1
      }
    }), React.createElement(Btn, {
      onClick: onClose
    }, may ? 'Cancel' : 'Close'))));
  }
  function ManageKpis({
    meta,
    defs,
    reload
  }) {
    const [edit, setEdit] = useState(null);
    const [archived, setArchived] = useState(false);
    const [busy, setBusy] = useState(false);
    const cfg = meta.config;
    const list = defs.filter(d => archived || d.active !== false && !d.removedAt);
    const groups = cfg.pillars.map(pl => ({
      pl,
      list: list.filter(d => d.pillar === pl.id)
    })).filter(g => g.list.length);
    const activeIds = defs.filter(d => d.active !== false && !d.removedAt).map(d => d.id);
    const liveN = defs.filter(K.isLive).length,
      offN = activeIds.length - liveN;
    async function setEnabled(d, enabled) {
      if (!enabled) {
        const ok = await confirmBox({
          title: 'Disable “' + d.name + '”?',
          message: 'It stays here on Manage KPIs but leaves the dashboard, Data Update, new reports, exports and the missing-data badge. Its saved figures and final reports are kept. Switch it on again at any time.',
          confirmLabel: 'Disable'
        });
        if (!ok) return;
      }
      try {
        await api('/api/kpi/defs/' + encodeURIComponent(d.id) + '/enabled', {
          method: 'POST',
          body: JSON.stringify({
            enabled
          })
        });
        toast(d.name + (enabled ? ' enabled.' : ' disabled.'), 'success');
        refreshBadge();
        reload();
      } catch (e) {
        toast(e.message, 'error');
      }
    }
    async function move(id, n) {
      const ids = activeIds.slice();
      const i = ids.indexOf(id);
      if (i < 0 || i + n < 0 || i + n >= ids.length) return;
      ids.splice(i, 1);
      ids.splice(i + n, 0, id);
      try {
        await api('/api/kpi/defs-order', {
          method: 'POST',
          body: JSON.stringify({
            ids
          })
        });
        reload();
      } catch (e) {
        toast(e.message, 'error');
      }
    }
    async function archive(d) {
      const ok = await confirmBox({
        title: 'Archive “' + d.name + '”?',
        message: 'It leaves the dashboard, data entry and new reports. Its figures and the reports that already include it are kept, and it can be restored at any time.',
        confirmLabel: 'Archive',
        danger: true
      });
      if (!ok) return;
      try {
        await api('/api/kpi/defs/' + encodeURIComponent(d.id), {
          method: 'DELETE'
        });
        toast('Archived.', 'success');
        reload();
      } catch (e) {
        toast(e.message, 'error');
      }
    }
    async function restore(d) {
      try {
        await api('/api/kpi/defs/' + encodeURIComponent(d.id) + '/restore', {
          method: 'POST'
        });
        toast('Restored.', 'success');
        reload();
      } catch (e) {
        toast(e.message, 'error');
      }
    }
    async function reseed() {
      setBusy(true);
      try {
        const j = await api('/api/kpi/seed', {
          method: 'POST'
        });
        toast(j.added ? j.added + ' deck KPI(s) put back.' : 'Every deck KPI is already here.', 'success');
        reload();
      } catch (e) {
        toast(e.message, 'error');
      }
      setBusy(false);
    }
    return React.createElement("div", {
      className: "kp-wrap"
    }, React.createElement("div", {
      className: "kp-card kp-bar"
    }, React.createElement("b", {
      style: {
        fontSize: 14
      }
    }, liveN, " KPIs"), offN > 0 && React.createElement("span", {
      className: "kp-pill",
      style: {
        background: '#f1f2f4',
        color: '#5b6573'
      }
    }, offN, " disabled"), React.createElement("span", {
      className: "kp-muted"
    }, "in ", groups.length, " pillars \xB7 from the Nursing Department KPI deck", defs.some(d => d.custom) ? ' and your own' : ''), React.createElement("span", {
      style: {
        flex: 1
      }
    }), React.createElement("label", {
      style: {
        display: 'inline-flex',
        gap: 6,
        alignItems: 'center',
        fontSize: 12.5,
        fontWeight: 600,
        cursor: 'pointer'
      }
    }, React.createElement("input", {
      type: "checkbox",
      checked: archived,
      onChange: e => setArchived(e.target.checked),
      style: {
        width: 'auto'
      }
    }), "Show archived"), meta.isAdmin && React.createElement(Btn, {
      disabled: busy,
      onClick: reseed,
      title: "Put back any KPI of the deck that is missing"
    }, "Restore deck KPIs"), (meta.canAdd || meta.canEdit) && React.createElement(Btn, {
      pri: true,
      onClick: () => setEdit({
        def: null
      })
    }, "+ Add custom KPI")), groups.map(g => React.createElement("div", {
      key: g.pl.id,
      className: "kp-card kp-rise"
    }, React.createElement("div", {
      className: "kp-h",
      style: {
        borderLeft: '5px solid ' + g.pl.color
      }
    }, React.createElement("h3", null, g.pl.label), React.createElement("span", {
      className: "kp-muted"
    }, g.list.length)), React.createElement("div", {
      className: "kp-grid3 kp-pad"
    }, g.list.map(d => {
      const off = d.active === false || d.removedAt,
        dis = !off && !!d.disabled;
      const i = activeIds.indexOf(d.id);
      return React.createElement("div", {
        key: d.id,
        className: "kp-card kp-pad",
        style: {
          display: 'flex',
          flexDirection: 'column',
          gap: 7,
          opacity: off ? 0.55 : 1,
          background: dis ? '#f6f7f9' : undefined
        }
      }, React.createElement("div", {
        style: {
          display: 'flex',
          gap: 8,
          alignItems: 'flex-start'
        }
      }, React.createElement("span", {
        className: "kp-code",
        style: {
          background: g.pl.color
        }
      }, d.code || '•'), React.createElement("div", {
        style: {
          flex: 1,
          minWidth: 0,
          opacity: dis ? 0.6 : 1
        }
      }, React.createElement("div", {
        style: {
          fontWeight: 800,
          color: 'var(--ink)',
          lineHeight: 1.25
        }
      }, d.name), React.createElement("div", {
        className: "kp-muted",
        style: {
          fontSize: 11
        }
      }, d.unit, " \xB7 ", d.goalDirection === 'lower_is_better' ? 'lower is better' : 'higher is better')), d.custom && React.createElement("span", {
        className: "kp-src",
        style: {
          background: '#ebebfb',
          color: '#3f3fa8'
        }
      }, "Custom"), !off && meta.canEdit && React.createElement("label", {
        className: 'kp-switch light' + (dis ? '' : ' on'),
        title: dis ? 'Disabled — click to enable this KPI again' : 'Enabled — click to disable (it stays here but is not counted anywhere)',
        onClick: () => setEnabled(d, dis),
        style: {
          flexDirection: 'column',
          gap: 2,
          fontSize: 9.5,
          color: dis ? '#7a8494' : '#1f7a4c'
        }
      }, React.createElement("i", null), React.createElement("span", null, dis ? 'OFF' : 'ON'))), React.createElement("div", {
        style: {
          display: 'flex',
          gap: 6,
          flexWrap: 'wrap',
          fontSize: 11.5,
          opacity: dis ? 0.6 : 1
        }
      }, dis && React.createElement("span", {
        className: "kp-pill",
        style: {
          background: '#e9ebef',
          color: '#4a5463'
        }
      }, "Disabled \u2014 not counted"), React.createElement("span", {
        className: "kp-pill",
        style: {
          background: '#f3f5f8',
          color: '#3a4656'
        }
      }, "Baseline ", d.baseline && K.has(d.baseline.value) ? K.fmt(d, d.baseline.value) : '—'), React.createElement("span", {
        className: "kp-pill",
        style: {
          background: '#eef7f5',
          color: '#0d5e55'
        }
      }, "Target ", (d.targets || []).length ? d.targets.map(t => K.fmt(d, t.value)).join(' → ') : K.has(d.baselineTargetPct) ? d.baselineTargetPct + '% vs baseline' : '—'), React.createElement("span", {
        className: "kp-pill",
        style: d.source && d.source.indId && d.autoFill !== false ? {
          background: '#e1f1fa',
          color: '#0b4f6c'
        } : {
          background: '#ebebfb',
          color: '#3f3fa8'
        }
      }, d.source && d.source.indId ? d.autoFill !== false ? 'Auto from quality' : 'Typed (auto-fill off)' : 'Typed monthly'), d.startMonth && React.createElement("span", {
        className: "kp-pill",
        style: {
          background: '#f3f5f8',
          color: '#3a4656'
        }
      }, "Starts ", K.fmtMonth(d.startMonth)), K.freqOf(d) > 1 && React.createElement("span", {
        className: "kp-pill",
        style: {
          background: '#ebebfb',
          color: '#3f3fa8'
        }
      }, K.freqLabel(d, true)), K.cycleCfg(d, cfg).own && React.createElement("span", {
        className: "kp-pill",
        style: {
          background: '#ebebfb',
          color: '#3f3fa8'
        }
      }, K.cycleCfg(d, cfg).cycles, " \xD7 ", K.cycleCfg(d, cfg).cycleMonths, "-month cycles"), d.units && d.units.length > 0 && React.createElement("span", {
        className: "kp-pill",
        style: {
          background: '#effaf4',
          color: '#14713f'
        }
      }, d.units.length, " unit(s) expected"), React.createElement("span", {
        className: "kp-pill",
        style: {
          background: '#fff6e0',
          color: '#8a5a00'
        }
      }, (d.actions || []).length, " actions")), React.createElement("div", {
        style: {
          display: 'flex',
          gap: 5,
          marginTop: 'auto'
        }
      }, React.createElement(Btn, {
        onClick: () => setEdit({
          def: d
        })
      }, meta.canEdit ? 'Edit' : 'Open'), !off && meta.canEdit && React.createElement(React.Fragment, null, React.createElement("button", {
        className: "kp-icon-btn",
        disabled: i <= 0,
        onClick: () => move(d.id, -1),
        title: "Move up"
      }, "\u2191"), React.createElement("button", {
        className: "kp-icon-btn",
        disabled: i >= activeIds.length - 1,
        onClick: () => move(d.id, 1),
        title: "Move down"
      }, "\u2193")), React.createElement("span", {
        style: {
          flex: 1
        }
      }), !off && meta.canDelete && React.createElement(Btn, {
        danger: true,
        onClick: () => archive(d)
      }, "Archive"), off && meta.canEdit && React.createElement(Btn, {
        onClick: () => restore(d)
      }, "Restore")));
    })))), edit && React.createElement(KpiEditor, {
      meta: meta,
      def: edit.def,
      onClose: () => setEdit(null),
      onSaved: () => {
        setEdit(null);
        reload();
        refreshBadge();
      }
    }));
  }
  function ActionBoard({
    meta,
    defs,
    reload,
    focusKpi
  }) {
    const [f, setF] = useState(focusKpi || '');
    const [q, setQ] = useState('');
    const [busy, setBusy] = useState('');
    const [assigned, setAssigned] = useState(() => !!lsGet('kpi_assigned_only'));
    useEffect(() => {
      lsSet('kpi_assigned_only', assigned);
    }, [assigned]);
    const cfg = meta.config;
    const active = defs.filter(K.isLive);
    const items = [];
    active.forEach(d => (d.actions || []).forEach(a => {
      if (assigned && !(a.owner || a.due || a.status && a.status !== 'open')) return;
      if ((!f || d.id === f) && (!q || (a.text + ' ' + (a.owner || '')).toLowerCase().indexOf(q.toLowerCase()) >= 0)) items.push({
        d,
        a
      });
    }));
    async function setStatus(d, a, patch) {
      setBusy(d.id + a.id);
      try {
        await api('/api/kpi/defs/' + encodeURIComponent(d.id), {
          method: 'PUT',
          body: JSON.stringify({
            baseUpdatedAt: d.updatedAt,
            actions: d.actions.map(x => x.id === a.id ? Object.assign({}, x, patch) : x)
          })
        });
        reload();
      } catch (e) {
        toast(e.message, 'error');
        if (e.status === 409) reload();
      }
      setBusy('');
    }
    const total = s => items.filter(x => (x.a.status || 'open') === s).length;
    const overdue = items.filter(x => x.a.due && x.a.due < meta.thisMonth && x.a.status !== 'done' && x.a.status !== 'dropped').length;
    const COLS = [['open', '#7b8796'], ['progress', '#008FCB'], ['done', '#1f9d57'], ['dropped', '#a3adba']];
    return React.createElement("div", {
      className: "kp-wrap"
    }, React.createElement("div", {
      className: "kp-card kp-bar"
    }, React.createElement("select", {
      className: "kp-sel",
      value: f,
      onChange: e => setF(e.target.value),
      style: {
        maxWidth: 320
      }
    }, React.createElement("option", {
      value: ""
    }, "All KPIs"), active.map(d => React.createElement("option", {
      key: d.id,
      value: d.id
    }, d.code, " ", d.name))), React.createElement("input", {
      className: "kp-in",
      placeholder: "Search actions or owners\u2026",
      value: q,
      onChange: e => setQ(e.target.value),
      style: {
        width: 210
      }
    }), React.createElement("label", {
      title: "Hide the actions nobody has picked up yet (no owner, no due date, not started)",
      style: {
        display: 'inline-flex',
        gap: 6,
        alignItems: 'center',
        fontSize: 12.5,
        fontWeight: 600,
        cursor: 'pointer'
      }
    }, React.createElement("input", {
      type: "checkbox",
      checked: assigned,
      onChange: e => setAssigned(e.target.checked),
      style: {
        width: 'auto'
      }
    }), "Assigned only"), React.createElement("span", {
      style: {
        flex: 1
      }
    }), React.createElement("span", {
      className: "kp-muted"
    }, React.createElement("b", {
      style: {
        color: 'var(--ink)'
      }
    }, items.length), " actions \xB7 ", total('done'), " done", overdue ? React.createElement(React.Fragment, null, " \xB7 ", React.createElement("b", {
      style: {
        color: '#d23a52'
      }
    }, overdue, " overdue")) : null)), !meta.canEdit && React.createElement("div", {
      className: "kp-banner info"
    }, "Moving an action or changing its owner needs the Nursing KPI \u201CEdit\u201D permission."), React.createElement("div", {
      className: "kp-board"
    }, COLS.map(([s, c]) => React.createElement("div", {
      key: s,
      className: "kp-col"
    }, React.createElement("h4", {
      style: {
        color: c
      }
    }, React.createElement("span", {
      className: "kp-dot",
      style: {
        background: c
      }
    }), K.ACTION_LABEL[s], React.createElement("span", {
      className: "kp-muted",
      style: {
        marginLeft: 'auto'
      }
    }, total(s))), items.filter(x => (x.a.status || 'open') === s).map(({
      d,
      a
    }) => {
      const late = a.due && a.due < meta.thisMonth && s !== 'done' && s !== 'dropped';
      return React.createElement("div", {
        key: d.id + a.id,
        className: "kp-tcard kp-rise",
        style: late ? {
          borderColor: '#f0b9c3'
        } : undefined
      }, React.createElement("div", {
        style: {
          display: 'flex',
          gap: 7,
          alignItems: 'flex-start'
        }
      }, React.createElement("span", {
        className: "kp-code",
        style: {
          background: K.pillarOf(cfg, d.pillar).color,
          minWidth: 26,
          height: 19,
          fontSize: 10
        }
      }, d.code || '•'), React.createElement("span", {
        style: {
          flex: 1
        }
      }, a.text)), React.createElement("div", {
        className: "meta"
      }, meta.canEdit ? React.createElement("input", {
        className: "kp-in",
        style: {
          padding: '3px 6px',
          fontSize: 11,
          width: 110
        },
        defaultValue: a.owner || '',
        placeholder: "Owner",
        onBlur: e => e.target.value !== (a.owner || '') && setStatus(d, a, {
          owner: e.target.value
        })
      }) : React.createElement("span", null, a.owner || 'No owner'), meta.canEdit ? React.createElement("input", {
        type: "month",
        className: "kp-in",
        style: {
          padding: '3px 6px',
          fontSize: 11,
          width: 128,
          color: late ? '#d23a52' : undefined
        },
        defaultValue: a.due || '',
        onBlur: e => e.target.value !== (a.due || '') && setStatus(d, a, {
          due: e.target.value
        })
      }) : React.createElement("span", {
        style: {
          color: late ? '#d23a52' : undefined
        }
      }, a.due ? K.fmtMonth(a.due) : 'No due date'), meta.canEdit && React.createElement("select", {
        className: "kp-sel",
        style: {
          padding: '3px 6px',
          fontSize: 11
        },
        value: s,
        disabled: busy === d.id + a.id,
        onChange: e => setStatus(d, a, {
          status: e.target.value
        })
      }, K.ACTION_STATUSES.map(x => React.createElement("option", {
        key: x,
        value: x
      }, K.ACTION_LABEL[x]))), late && React.createElement("b", {
        style: {
          color: '#d23a52'
        }
      }, "overdue")));
    })))));
  }
  function ScheduleTable({
    meta,
    defs,
    reload
  }) {
    const cfg = meta.config;
    const list = (defs || []).filter(d => d.active !== false && !d.removedAt);
    const [draft, setDraft] = useState({});
    const [busy, setBusy] = useState(false);
    const base = d => ({
      freqMonths: K.freqOf(d),
      cycleMonths: d.cycleMonths || null,
      cycles: d.cycles || null,
      startMonth: K.isMonth(d.startMonth) ? d.startMonth : null
    });
    const cur = d => Object.assign(base(d), draft[d.id] || {});
    const setF = (d, patch) => setDraft(x => {
      let n = Object.assign({}, cur(d), patch);
      if (patch.freqMonths) n = withFreq(n, patch.freqMonths);
      const o = Object.assign({}, x);
      if (JSON.stringify(n) === JSON.stringify(base(d))) delete o[d.id];else o[d.id] = n;
      return o;
    });
    const changed = Object.keys(draft);
    async function save() {
      const items = changed.map(id => Object.assign({
        id,
        baseUpdatedAt: (list.find(x => x.id === id) || {}).updatedAt
      }, draft[id]));
      setBusy(true);
      try {
        const dry = await api('/api/kpi/schedule', {
          method: 'POST',
          body: JSON.stringify({
            dryRun: true,
            items
          })
        });
        const msg = React.createElement("div", null, React.createElement("ul", {
          style: {
            margin: '4px 0 8px',
            paddingLeft: 18
          }
        }, dry.changes.map(x => React.createElement("li", {
          key: x.id
        }, React.createElement("b", null, x.code ? x.code + ' ' : '', x.name), ": ", x.from, " \u2192 ", React.createElement("b", null, x.to), x.kept ? React.createElement("div", {
          style: {
            color: '#8a5a00'
          }
        }, x.kept, " monthly figure(s) already saved in months that are no longer due are kept, but no longer counted.") : null))), "Data Update, reports and the missing-data badge follow the new schedule at once. Final reports do not change. Nothing is deleted.");
        const ok = await confirmBox({
          title: 'Save the KPI schedule?',
          message: msg,
          confirmLabel: 'Save schedule'
        });
        if (!ok) {
          setBusy(false);
          return;
        }
        const j = await api('/api/kpi/schedule', {
          method: 'POST',
          body: JSON.stringify({
            items
          })
        });
        toast(j.saved + ' KPI schedule' + (j.saved === 1 ? '' : 's') + ' saved.', 'success');
        setDraft({});
        refreshBadge();
        reload();
      } catch (e) {
        toast(e.message, 'error');
      }
      setBusy(false);
    }
    const groups = cfg.pillars.map(pl => ({
      pl,
      list: list.filter(d => d.pillar === pl.id)
    })).filter(g => g.list.length);
    return React.createElement("div", {
      className: "kp-card"
    }, React.createElement("div", {
      className: "kp-h"
    }, React.createElement("h3", null, "KPI schedule"), React.createElement("span", {
      className: "kp-muted"
    }, "How often each KPI is measured, when it starts, and its own cycles. Blank = the same as all KPIs.")), React.createElement("div", {
      className: "kp-scroll"
    }, React.createElement("table", {
      className: "kp-tbl kp-sched"
    }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "#"), React.createElement("th", null, "KPI"), React.createElement("th", null, "Measured"), React.createElement("th", null, "Starts"), React.createElement("th", null, "Cycle length"), React.createElement("th", null, "Cycles"), React.createElement("th", null, "Periods and cycles"))), React.createElement("tbody", null, groups.map(g => [React.createElement("tr", {
      key: 'g' + g.pl.id
    }, React.createElement("td", {
      colSpan: 7,
      style: {
        background: '#f3f6fa',
        fontWeight: 800,
        fontSize: 11.5
      }
    }, React.createElement("span", {
      className: "kp-dot",
      style: {
        background: g.pl.color,
        marginRight: 7
      }
    }), g.pl.label)), ...g.list.map(d => {
      const s = cur(d),
        dd = Object.assign({}, d, s),
        f = s.freqMonths,
        st = K.startOf(dd, cfg),
        dirty = !!draft[d.id];
      const periods = K.dueMonths(dd, st, K.addMonth(st, 11), cfg).map(m => K.periodOf(dd, m, cfg).label);
      return React.createElement("tr", {
        key: d.id,
        style: {
          cursor: 'default',
          background: dirty ? '#fffbea' : d.disabled ? '#f6f7f9' : undefined,
          opacity: d.disabled ? 0.65 : 1
        }
      }, React.createElement("td", null, React.createElement("span", {
        className: "kp-code",
        style: {
          background: g.pl.color
        }
      }, d.code || '•')), React.createElement("td", {
        style: {
          minWidth: 200
        }
      }, React.createElement("b", {
        style: {
          color: 'var(--ink)'
        }
      }, d.name), d.disabled ? React.createElement("span", {
        className: "kp-muted"
      }, " \xB7 disabled") : null), React.createElement("td", null, React.createElement("select", {
        className: "kp-sel",
        value: f,
        onChange: e => setF(d, {
          freqMonths: +e.target.value
        })
      }, K.FREQS.map(x => React.createElement("option", {
        key: x.m,
        value: x.m
      }, x.short)))), React.createElement("td", null, React.createElement("input", {
        type: "month",
        className: "kp-sel",
        value: s.startMonth || '',
        onChange: e => setF(d, {
          startMonth: K.isMonth(e.target.value) ? e.target.value : null
        }),
        title: 'Blank = the same as all KPIs (' + K.fmtMonth(cfg.cycleStart) + ')',
        style: {
          padding: '4px 6px'
        }
      })), React.createElement("td", null, React.createElement("select", {
        className: "kp-sel",
        value: s.cycleMonths || '',
        onChange: e => setF(d, {
          cycleMonths: e.target.value ? +e.target.value : null
        })
      }, React.createElement("option", {
        value: ""
      }, "As all (", K.cycleCfg({
        freqMonths: f
      }, cfg).cycleMonths, " mo)"), cycleChoices(f).map(n => React.createElement("option", {
        key: n,
        value: n
      }, n, " months")))), React.createElement("td", null, React.createElement("select", {
        className: "kp-sel",
        value: s.cycles || '',
        onChange: e => setF(d, {
          cycles: e.target.value ? +e.target.value : null
        })
      }, React.createElement("option", {
        value: ""
      }, "As all (", cfg.cycles, ")"), [1, 2, 3, 4, 5, 6].map(n => React.createElement("option", {
        key: n,
        value: n
      }, n)))), React.createElement("td", {
        className: "kp-muted",
        style: {
          fontSize: 11,
          minWidth: 220
        }
      }, f > 1 ? React.createElement("div", null, React.createElement("b", {
        style: {
          color: '#3f3fa8'
        }
      }, periods.join(' · '))) : React.createElement("div", null, "Every month from ", K.fmtMonth(st)), React.createElement("div", null, Array.from({
        length: K.cycleCfg(dd, cfg).cycles
      }, (_, i) => {
        const r = K.cycleRange(i + 1, cfg, dd);
        return 'C' + (i + 1) + ' ' + K.spanLabel(r.from, r.to);
      }).join(' · '))));
    })])))), changed.length > 0 && React.createElement("div", {
      className: "kp-savebar"
    }, React.createElement("b", null, changed.length, " KPI schedule", changed.length > 1 ? 's' : '', " changed"), React.createElement("span", {
      style: {
        flex: 1
      }
    }), React.createElement(Btn, {
      disabled: busy,
      onClick: () => setDraft({})
    }, "Discard"), React.createElement(Btn, {
      pri: true,
      disabled: busy,
      onClick: save
    }, busy ? 'Saving…' : 'Save schedule')));
  }
  function Settings({
    meta,
    reloadMeta,
    defs
  }) {
    const [c, setC] = useState(() => JSON.parse(JSON.stringify(meta.config)));
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const set = (k, v) => setC(x => Object.assign({}, x, {
      [k]: v
    }));
    const setPl = (i, k, v) => set('pillars', c.pillars.map((p, j) => j === i ? Object.assign({}, p, {
      [k]: v
    }) : p));
    async function save() {
      setBusy(true);
      setErr('');
      try {
        await api('/api/kpi/config', {
          method: 'PUT',
          body: JSON.stringify({
            cycleStart: c.cycleStart,
            cycleMonths: c.cycleMonths,
            cycles: c.cycles,
            nearBand: c.nearBand,
            reportTitle: c.reportTitle,
            hospitalName: c.hospitalName,
            pillars: c.pillars,
            autoFill: c.autoFill !== false
          })
        });
        toast('Settings saved.', 'success');
        reloadMeta();
      } catch (e) {
        setErr(e.message);
      }
      setBusy(false);
    }
    const cycles = Array.from({
      length: Math.max(1, +c.cycles || 1)
    }, (_, i) => K.cycleRange(i + 1, c));
    const auto = meta.automation;
    const fld = (label, el, hint) => React.createElement("label", {
      className: "kp-fld"
    }, React.createElement("span", {
      className: "kp-lab"
    }, label), el, hint && React.createElement("span", {
      className: "hint"
    }, hint));
    return React.createElement("div", {
      className: "kp-wrap"
    }, React.createElement("div", {
      className: "kp-card kp-pad",
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 14
      }
    }, React.createElement("h3", {
      style: {
        margin: 0,
        fontSize: 15
      }
    }, "Programme cycles"), React.createElement("div", {
      className: "kp-row"
    }, fld('All KPIs start on', React.createElement("input", {
      type: "month",
      className: "kp-in",
      value: c.cycleStart,
      onChange: e => K.isMonth(e.target.value) && set('cycleStart', e.target.value)
    }), 'Every KPI counts its cycles, targets and missing-data checks from this month — unless it has its own start (Manage KPIs → Basics).'), fld('Months per cycle', React.createElement("select", {
      className: "kp-sel",
      value: c.cycleMonths,
      onChange: e => set('cycleMonths', +e.target.value)
    }, [3, 4, 6, 12].map(n => React.createElement("option", {
      key: n,
      value: n
    }, n))), 'The deck: “Monthly for 6 months & later for another 6 months”.'), fld('Number of cycles', React.createElement("select", {
      className: "kp-sel",
      value: c.cycles,
      onChange: e => set('cycles', +e.target.value)
    }, [1, 2, 3, 4].map(n => React.createElement("option", {
      key: n,
      value: n
    }, n)))), fld('“Close to target” band (%)', React.createElement("input", {
      className: "kp-in",
      inputMode: "decimal",
      value: c.nearBand,
      onChange: e => set('nearBand', e.target.value.replace(/[^0-9.]/g, ''))
    }), 'Short of the target by no more than this share of it = amber.')), React.createElement("div", {
      style: {
        display: 'flex',
        gap: 6
      }
    }, cycles.map((r, i) => React.createElement("div", {
      key: i,
      style: {
        flex: 1,
        padding: '10px 12px',
        borderRadius: 10,
        background: i % 2 ? '#e1f1fa' : '#dff5f1',
        fontSize: 12.5
      }
    }, React.createElement("b", null, "Cycle ", i + 1), React.createElement("div", {
      className: "kp-muted"
    }, K.fmtRange(r.from, r.to)))))), React.createElement(ScheduleTable, {
      meta: meta,
      defs: defs,
      reload: reloadMeta
    }), React.createElement("div", {
      className: "kp-card kp-pad",
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 10
      }
    }, React.createElement("h3", {
      style: {
        margin: 0,
        fontSize: 15
      }
    }, "Figures from the quality data"), React.createElement("label", {
      className: 'kp-switch light' + (c.autoFill !== false ? ' on' : ''),
      onClick: () => set('autoFill', c.autoFill === false)
    }, React.createElement("i", null), React.createElement("span", null, c.autoFill !== false ? 'Auto-fill ON — linked KPIs fill themselves from the quality data and the hand hygiene audit' : 'Auto-fill OFF — every figure is typed in Data Update; the system figure is shown as a hint')), React.createElement("div", {
      className: "kp-muted"
    }, "Each KPI can also be switched off on its own (Manage KPIs \u2192 Measure & data). Turning it off never deletes anything.")), React.createElement("div", {
      className: "kp-card kp-pad",
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 12
      }
    }, React.createElement("h3", {
      style: {
        margin: 0,
        fontSize: 15
      }
    }, "Pillars"), c.pillars.map((p, i) => React.createElement("div", {
      key: p.id || i,
      style: {
        display: 'flex',
        gap: 8,
        alignItems: 'center'
      }
    }, React.createElement("input", {
      type: "color",
      value: p.color,
      onChange: e => setPl(i, 'color', e.target.value),
      style: {
        width: 40,
        height: 32,
        border: 0,
        background: 'transparent',
        padding: 0
      }
    }), React.createElement("input", {
      className: "kp-in",
      value: p.label,
      onChange: e => setPl(i, 'label', e.target.value),
      style: {
        flex: 1
      }
    }), React.createElement("button", {
      className: "kp-icon-btn",
      disabled: i === 0,
      onClick: () => {
        const a = c.pillars.slice();
        const [x] = a.splice(i, 1);
        a.splice(i - 1, 0, x);
        set('pillars', a);
      }
    }, "\u2191"), React.createElement("button", {
      className: "kp-icon-btn",
      disabled: i === c.pillars.length - 1,
      onClick: () => {
        const a = c.pillars.slice();
        const [x] = a.splice(i, 1);
        a.splice(i + 1, 0, x);
        set('pillars', a);
      }
    }, "\u2193"))), React.createElement("div", null, React.createElement(Btn, {
      onClick: () => set('pillars', c.pillars.concat([{
        id: '',
        label: 'New pillar',
        color: '#5b6878'
      }]))
    }, "+ Add a pillar"), " ", React.createElement("span", {
      className: "kp-muted"
    }, "A pillar holding KPIs cannot be deleted here \u2014 move its KPIs first."))), React.createElement("div", {
      className: "kp-card kp-pad",
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 12
      }
    }, React.createElement("h3", {
      style: {
        margin: 0,
        fontSize: 15
      }
    }, "Reports"), React.createElement("div", {
      className: "kp-row"
    }, fld('Report title', React.createElement("input", {
      className: "kp-in",
      value: c.reportTitle,
      onChange: e => set('reportTitle', e.target.value)
    })), fld('Hospital', React.createElement("input", {
      className: "kp-in",
      value: c.hospitalName,
      onChange: e => set('hospitalName', e.target.value)
    }))), React.createElement("div", {
      className: "kp-muted"
    }, "Monthly reports are prepared automatically after each month ends", auto ? ' — last: ' + K.fmtMonthLong(auto.lastMonth) + ' (' + auto.lastResult + ', ' + when(auto.lastAt) + ')' : '', ".")), err && React.createElement("div", {
      className: "kp-err"
    }, err), React.createElement("div", null, React.createElement(Btn, {
      pri: true,
      disabled: busy,
      onClick: save
    }, busy ? 'Saving…' : 'Save settings')));
  }
  const VIEWS = [['kpiDashboard', 'Dashboard'], ['kpiEntry', 'Data Update'], ['kpiReports', 'Reports'], ['kpiManage', 'Manage KPIs'], ['kpiActions', 'Action Plans'], ['kpiSettings', 'Settings']];
  function KpiView({
    view,
    report,
    kpi,
    setRoute
  }) {
    useStyles();
    const [meta, setMeta] = useState(null);
    const [defs, setDefs] = useState(null);
    const [err, setErr] = useState('');
    const [alerts, setAlerts] = useState(() => window.__UNICO_KPI_ALERTS__ || null);
    const [showCalc, setShowCalc] = useState(() => !!lsGet('kpi_show_calc'));
    useEffect(() => {
      lsSet('kpi_show_calc', showCalc);
    }, [showCalc]);
    const loadMeta = useCallback(() => api('/api/kpi/meta').then(j => setMeta(j)).catch(e => setErr(e.message)), []);
    const loadDefs = useCallback(() => api('/api/kpi/defs?all=1').then(j => setDefs(j.defs)).catch(e => setErr(e.message)), []);
    useEffect(() => {
      loadMeta();
      loadDefs();
    }, []);
    useEffect(() => {
      const h = e => setAlerts(e.detail);
      window.addEventListener('unico:kpi-alerts', h);
      return () => window.removeEventListener('unico:kpi-alerts', h);
    }, []);
    if (err) return React.createElement("div", {
      className: "kp-wrap"
    }, React.createElement("div", {
      className: "kp-banner"
    }, err));
    if (!meta || !defs) return React.createElement("div", {
      className: "kp-wrap"
    }, React.createElement("div", {
      className: "kp-hero"
    }, React.createElement("h1", null, "Nursing KPI"), React.createElement("div", {
      className: "sub"
    }, "Loading the KPI programme\u2026")));
    const v = VIEWS.find(([k]) => k === view) ? view : 'kpiDashboard';
    const cyc = meta.cycle,
      cfg = meta.config;
    const allowed = k => k === 'kpiSettings' ? meta.isAdmin : !window.unicoCanAccessView || window.unicoCanAccessView(k);
    const nGap = alerts && alerts.missing ? alerts.missing.length : 0;
    const segs = Array.from({
      length: cfg.cycleMonths * cfg.cycles
    }, (_, i) => i);
    const doneN = cyc.index === 0 ? 0 : cyc.index > cfg.cycles ? segs.length : (cyc.index - 1) * cfg.cycleMonths + (cyc.monthNo || 0);
    let body;
    if (v === 'kpiEntry') body = React.createElement(DataEntry, {
      meta: meta,
      defs: defs,
      focusKpi: kpi,
      showCalc: showCalc,
      reload: () => {
        loadMeta();
        loadDefs();
      }
    });else if (v === 'kpiReports') body = report === 'definitions' || /^calendar-\d{4}$/.test(report || '') ? React.createElement(DocView, {
      key: report,
      meta: meta,
      kind: report === 'definitions' ? 'definitions' : 'calendar',
      year: report === 'definitions' ? null : +report.slice(9),
      setRoute: setRoute
    }) : report ? React.createElement(ReportDoc, {
      key: report,
      meta: meta,
      id: report,
      setRoute: setRoute,
      showCalc: showCalc
    }) : React.createElement(ReportsHome, {
      meta: meta,
      setRoute: setRoute
    });else if (v === 'kpiManage') body = React.createElement(ManageKpis, {
      meta: meta,
      defs: defs,
      reload: loadDefs
    });else if (v === 'kpiActions') body = React.createElement(ActionBoard, {
      meta: meta,
      defs: defs,
      reload: loadDefs,
      focusKpi: kpi
    });else if (v === 'kpiSettings') body = meta.isAdmin ? React.createElement(Settings, {
      meta: meta,
      defs: defs,
      reloadMeta: () => {
        loadMeta();
        loadDefs();
      }
    }) : React.createElement("div", {
      className: "kp-card kp-empty"
    }, "Only an administrator can change the Nursing KPI settings.");else body = React.createElement(Dashboard, {
      meta: meta,
      setRoute: setRoute,
      showCalc: showCalc
    });
    return React.createElement("div", {
      className: "kp-wrap"
    }, !(v === 'kpiReports' && report) && React.createElement("div", {
      className: "kp-hero kp-rise"
    }, React.createElement("div", {
      className: "kp-hero-row"
    }, React.createElement("div", null, React.createElement("h1", null, cfg.reportTitle), React.createElement("div", {
      className: "sub"
    }, defs.filter(K.isLive).length, " KPIs \xB7 ", cfg.pillars.length, " pillars \xB7 ", cfg.hospitalName)), React.createElement("label", {
      className: 'kp-switch' + (showCalc ? ' on' : ''),
      title: "Show how every figure was calculated: the units it came from, who sent and approved each figure, and the data checks",
      onClick: () => setShowCalc(!showCalc),
      style: {
        position: 'relative',
        zIndex: 1
      }
    }, React.createElement("i", null), React.createElement("span", null, "Show calculation")), React.createElement("div", {
      className: "kp-cycle"
    }, React.createElement("div", {
      className: "lab"
    }, React.createElement("span", null, cyc.label, cyc.monthNo ? ' · month ' + cyc.monthNo + ' of ' + cyc.of : ''), React.createElement("span", null, K.fmtMonth(cfg.cycleStart), " \u2192 ", K.fmtMonth(K.cycleRange(cfg.cycles, cfg).to))), React.createElement("div", {
      className: "bar"
    }, segs.map(i => React.createElement("i", {
      key: i,
      className: i < doneN - 1 ? 'on' : i === doneN - 1 ? 'now' : '',
      style: i > 0 && i % cfg.cycleMonths === 0 ? {
        marginLeft: 4
      } : undefined
    }))))), React.createElement("div", {
      className: "kp-nav"
    }, VIEWS.filter(([k]) => allowed(k)).map(([k, l]) => React.createElement("button", {
      key: k,
      className: v === k ? 'on' : '',
      onClick: () => setRoute({
        view: k
      })
    }, l, k === 'kpiEntry' && nGap > 0 && (meta.canAdd || meta.canEdit) ? React.createElement("b", null, nGap) : null, k === 'kpiReports' && alerts && alerts.reportReady ? React.createElement("b", null, "1") : null)))), body);
  }
  window.KpiView = KpiView;
})();
})();
