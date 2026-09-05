/* UNICO — the design system from the UI mockups, as tokens.
 *
 * Lifted verbatim from `ui/Performance module UI mockups/Performance Module.dc.html`
 * (its GC / RT / ST tables, av(), gchip(), stChip(), roleStyle(), barColor(), and the
 * glass card treatment) so the built screens match the approved design exactly rather
 * than approximately. If the mockup changes, change it HERE and every screen follows.
 *
 * Published as window.MK.
 */
(function () {
  'use strict';

  var MONO = "'IBM Plex Mono',monospace";
  var ANIM = 'growW .7s cubic-bezier(.2,.8,.25,1)';

  // Text
  var INK = '#16202e';        // headings / values
  var BODY = '#3c4858';       // body copy
  var MUTED = '#6c7a8c';      // secondary
  var FAINT = '#9aa6b4';      // footnotes
  var LINE = 'rgba(125,145,180,.18)';

  // Grade colours
  var GC = { 'A+': '#1f9d57', A: '#3ab5a7', B: '#0090ca', C: '#e08a1e', D: '#c05621', E: '#d23a52' };
  // Rating 5..1
  var RT = { 5: ['Excellent', '#1f9d57'], 4: ['Very Good', '#3ab5a7'], 3: ['Good / Satisfactory', '#0090ca'], 2: ['Needs Improvement', '#e08a1e'], 1: ['Unsatisfactory', '#d23a52'] };
  // Status chips
  var ST = {
    'Not started': { c: '#5b6b80', bg: 'rgba(125,145,180,.16)' },
    'In progress': { c: '#0072a3', bg: 'rgba(0,144,202,.1)' },
    'Awaiting discussion': { c: '#b5670a', bg: 'rgba(224,138,30,.15)' },
    Discussed: { c: '#2b8f83', bg: 'rgba(58,181,167,.16)' },
    'Awaiting Part H': { c: '#6a52d4', bg: 'rgba(106,82,212,.12)' },
    Actioned: { c: '#1f9d57', bg: 'rgba(31,157,87,.15)' },
    Locked: { c: '#1f9d57', bg: 'rgba(31,157,87,.15)' },
  };

  // Accent pairs used for the little rounded icon badges: [tint, solid]
  var TINT = {
    blue: ['rgba(0,144,202,.1)', '#0090ca'],
    green: ['rgba(31,157,87,.15)', '#1f9d57'],
    amber: ['rgba(224,138,30,.15)', '#e08a1e'],
    violet: ['rgba(106,82,212,.12)', '#6a52d4'],
    teal: ['rgba(58,181,167,.16)', '#2b8f83'],
    red: ['rgba(210,58,82,.13)', '#d23a52'],
    slate: ['rgba(125,145,180,.16)', '#5b6b80'],
  };

  // The glass panel every block sits in.
  var card = {
    background: 'linear-gradient(152deg,rgba(255,255,255,.76),rgba(236,247,255,.46))',
    backdropFilter: 'blur(26px) saturate(1.75)',
    WebkitBackdropFilter: 'blur(26px) saturate(1.75)',
    border: '1px solid rgba(255,255,255,.92)',
    borderRadius: 16,
    boxShadow: '0 14px 42px rgba(31,59,90,.14),0 4px 16px rgba(0,144,202,.09),inset 0 1px 0 rgba(255,255,255,.95),inset 0 0 22px rgba(255,255,255,.35)',
    overflow: 'hidden',
  };
  var cardHead = { display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderBottom: '1px solid ' + LINE };
  var cardBody = { padding: '14px 16px' };
  var h3 = { margin: 0, fontSize: 13.5, fontWeight: 600, color: INK };
  var sub = { fontSize: 11.5, color: MUTED };
  var page = { maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 };

  function hue(name) { var h = 0, s = String(name || ''); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; }
  function av(name, size) {
    var h = hue(name);
    return {
      width: size, height: size, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center',
      fontSize: size * 0.38, fontWeight: 700, color: '#fff',
      background: 'linear-gradient(135deg,hsl(' + h + ' 60% 52%),hsl(' + ((h + 40) % 360) + ' 62% 42%))',
    };
  }
  function ini(name) { var p = String(name || '').trim().split(/\s+/); return ((p[0] && p[0][0]) || '' + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase() || '?'; }
  function initials(name) {
    var p = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!p.length) return '?';
    return ((p[0][0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
  }

  /* ---- photo-aware avatar -------------------------------------------------
     Staff photos are stored on the staff record as {url, publicId} (Cloudinary,
     via PhotoPicker). Every module that draws an initials circle should show the
     REAL photo when one exists — this is the one component that does it, so the
     fallback logic isn't re-invented (wrongly) per module.
       <MK.Av name={r.name} emp={r.emp} empId={r.empId} size={28}/>
     Resolution: the record passed as `emp` -> the global lookup published by the
     staff store (window.__STAFF_PHOTOS__, by emp id then by name). A dead URL
     falls back to initials instead of the browser's broken-image glyph. */
  function photoUrlOf(rec) {
    if (!rec) return '';
    var p = rec.photo || rec.photo_url;
    if (!p) return '';
    return typeof p === 'string' ? p : (p.url || '');
  }
  /* CREDIT SAVER. Every avatar used to download the 640px ORIGINAL (~180 KB) even at
     26px — pure Cloudinary bandwidth waste. This rewrites a Cloudinary URL to a small
     auto-format derivative (~5-15 KB). Only TWO standard sizes exist on purpose
     (96px for list avatars, 320px for portraits): each DISTINCT transformation is
     billed once ever, so two buckets cost at most 2 per image, then every view is a
     CDN cache hit. Cloudinary URLs are versioned + immutable, so the browser cache
     holds them for a year too. Non-Cloudinary URLs pass through untouched.
       mode 'fill' (default) — square centre-crop, matches objectFit:cover
       mode 'fit'            — scale down only, keeps the uploaded aspect ratio */
  function cdnPhoto(url, px, mode) {
    try {
      if (!url || url.indexOf('res.cloudinary.com') < 0 || url.indexOf('/upload/') < 0) return url;
      if (/\/upload\/[a-z]+_[^/]*\//.test(url)) return url;          // already a derivative
      var w = (px || 32) <= 48 ? 96 : 320;                            // 2x for retina, 2 buckets only
      var t = mode === 'fit' ? ('c_limit,w_' + w) : ('c_fill,w_' + w + ',h_' + w);
      return url.replace('/upload/', '/upload/' + t + ',q_auto,f_auto/');
    } catch (e) { return url; }
  }
  function photoLookup(empId, name) {
    var m = (typeof window !== 'undefined') && window.__STAFF_PHOTOS__;
    if (!m) return '';
    return (empId != null && m['id:' + String(empId).trim()]) || (name && m['nm:' + String(name).trim().toLowerCase()]) || '';
  }
  function Av(props) {
    var name = props.name, size = props.size || 28;
    var url = photoUrlOf(props.emp) || photoUrlOf(props) || photoLookup(props.empId, name);
    var st = React.useState(false); var dead = st[0], setDead = st[1];
    React.useEffect(function () { setDead(false); }, [url]);   // eslint-disable-line
    var radius = props.radius == null ? '50%' : props.radius;
    if (url && !dead) {
      return React.createElement('img', {
        src: cdnPhoto(url, size), alt: name || '', onError: function () { setDead(true); },
        loading: 'lazy', decoding: 'async',
        style: Object.assign({ width: size, height: size, borderRadius: radius, objectFit: 'cover', flexShrink: 0, display: 'block' }, props.style || {}),
      });
    }
    var base = av(name, size);
    if (props.radius != null) base = Object.assign({}, base, { borderRadius: props.radius });
    return React.createElement('div', { style: Object.assign(base, props.style || {}) }, initials(name));
  }
  function roleChip(role) {
    var c = role === 'PCA' ? '#6a52d4' : '#0090ca';
    return { display: 'inline-flex', alignItems: 'center', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 5, color: c, background: c + '16', letterSpacing: '.3px', flexShrink: 0 };
  }
  function gchip(g, big) {
    var c = GC[g] || '#5b6b80';
    return {
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO,
      fontSize: big ? 12 : 11, fontWeight: 700, padding: big ? '3px 10px' : '2px 9px', borderRadius: 14,
      color: c, background: c + '1a', whiteSpace: 'nowrap',
    };
  }
  function stChip(s) {
    var t = ST[s] || ST['Not started'];
    return { display: 'inline-flex', alignItems: 'center', fontSize: 10.5, fontWeight: 600, padding: '2px 9px', borderRadius: 14, color: t.c, background: t.bg, whiteSpace: 'nowrap', flexShrink: 0 };
  }
  function ratingPill(v) {
    var c = (RT[v] || RT[3])[1];
    return { display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 11.5, fontWeight: 600, padding: '4px 11px', borderRadius: 14, background: c + '14', color: c, border: '1px solid ' + c + '33' };
  }
  function iconBadge(tint, size) {
    var t = Array.isArray(tint) ? tint : (TINT[tint] || TINT.blue);
    var n = size || 38;
    return { width: n, height: n, borderRadius: 10, display: 'grid', placeItems: 'center', flexShrink: 0, background: t[0], color: t[1] };
  }
  function barColor(pct) { return pct >= 90 ? '#1f9d57' : pct >= 70 ? '#0090ca' : pct >= 50 ? '#e08a1e' : '#d23a52'; }
  function progColor(frac) { return frac >= 0.75 ? '#1f9d57' : frac >= 0.5 ? '#0090ca' : '#e08a1e'; }
  function track(h) { return { background: 'rgba(125,145,180,.2)', borderRadius: 5, height: h || 6, overflow: 'hidden' }; }
  function fill(w, c) { return { width: Math.max(0, Math.min(100, w)) + '%', height: '100%', borderRadius: 5, background: c, animation: ANIM }; }

  // Primary / ghost buttons, matching the mockup's pill treatment.
  var btnPri = {
    border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, padding: '7px 14px',
    borderRadius: 9, color: '#fff', background: 'linear-gradient(135deg,#27a8db,#0072a3)',
    boxShadow: '0 6px 16px rgba(0,144,202,.28)', display: 'inline-flex', alignItems: 'center', gap: 7,
  };
  var btnGhost = {
    cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, padding: '7px 13px',
    borderRadius: 9, color: BODY, background: 'rgba(255,255,255,.7)', border: '1px solid rgba(125,145,180,.28)',
    display: 'inline-flex', alignItems: 'center', gap: 7,
  };
  function btnTone(c) {
    return {
      border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, padding: '7px 14px',
      borderRadius: 9, color: '#fff', background: c, boxShadow: '0 6px 16px ' + c + '44',
      display: 'inline-flex', alignItems: 'center', gap: 7,
    };
  }

  var API = {
    MONO: MONO, ANIM: ANIM, INK: INK, BODY: BODY, MUTED: MUTED, FAINT: FAINT, LINE: LINE,
    GC: GC, RT: RT, ST: ST, TINT: TINT,
    card: card, cardHead: cardHead, cardBody: cardBody, h3: h3, sub: sub, page: page,
    hue: hue, av: av, ini: ini, initials: initials, Av: Av, photoUrlOf: photoUrlOf, cdnPhoto: cdnPhoto, roleChip: roleChip, gchip: gchip, stChip: stChip,
    ratingPill: ratingPill, iconBadge: iconBadge, barColor: barColor, progColor: progColor,
    track: track, fill: fill, btnPri: btnPri, btnGhost: btnGhost, btnTone: btnTone,
  };

  /* ---- scoped stylesheet -------------------------------------------------
     Injected once. Everything inside .mk-scope picks up the mockup's glass panel,
     header and table treatment, so the existing markup did not have to be rewritten
     element by element to match the approved design. */
  function injectCss() {
    if (typeof document === 'undefined' || document.getElementById('mk-style')) return;
    var el = document.createElement('style');
    el.id = 'mk-style';
    el.textContent = [
      '.mk-scope{max-width:1400px;margin:0 auto;color:' + BODY + '}',
      '.mk-scope .card{background:linear-gradient(152deg,rgba(255,255,255,.76),rgba(236,247,255,.46));',
      'backdrop-filter:blur(26px) saturate(1.75);-webkit-backdrop-filter:blur(26px) saturate(1.75);',
      'border:1px solid rgba(255,255,255,.92);border-radius:16px;',
      'box-shadow:0 14px 42px rgba(31,59,90,.14),0 4px 16px rgba(0,144,202,.09),inset 0 1px 0 rgba(255,255,255,.95),inset 0 0 22px rgba(255,255,255,.35);overflow:hidden}',
      '.mk-scope .card-h{display:flex;align-items:center;gap:10px;padding:13px 16px;border-bottom:1px solid ' + LINE + '}',
      '.mk-scope .card-b{padding:14px 16px}',
      '.mk-scope .sub{font-size:11.5px;color:' + MUTED + '}',
      '.mk-scope .num{font-family:' + MONO + '}',
      '.mk-scope .tbl{width:100%;border-collapse:collapse}',
      '.mk-scope .tbl thead th{text-align:left;font-size:10px;font-weight:700;letter-spacing:.5px;',
      'text-transform:uppercase;color:' + FAINT + ';padding:7px 10px;border-bottom:1px solid ' + LINE + '}',
      '.mk-scope .tbl tbody td{padding:9px 10px;font-size:12.2px;color:' + BODY + ';border-bottom:1px solid rgba(125,145,180,.12)}',
      '.mk-scope .tbl tbody tr:last-child td{border-bottom:0}',
      '.mk-scope .tbl tbody tr:hover{background:rgba(0,144,202,.045)}',
      '.mk-scope .tag{display:inline-flex;align-items:center;font-size:10.5px;font-weight:600;padding:2px 9px;',
      'border-radius:14px;color:#5b6b80;background:rgba(125,145,180,.16);white-space:nowrap}',
      '.mk-scope .btn{cursor:pointer;font-family:inherit;font-size:12px;font-weight:600;padding:7px 13px;',
      'border-radius:9px;color:' + BODY + ';background:rgba(255,255,255,.7);border:1px solid rgba(125,145,180,.28)}',
      '.mk-scope .btn:hover{background:#fff;border-color:rgba(0,144,202,.4)}',
      '.mk-scope .btn.pri,.mk-scope .btn.sm.pri{border:0;color:#fff;font-weight:700;',
      'background:linear-gradient(135deg,#27a8db,#0072a3);box-shadow:0 6px 16px rgba(0,144,202,.28)}',
      '.mk-scope .btn:disabled{opacity:.5;cursor:default;box-shadow:none}',
      '.mk-scope input,.mk-scope select,.mk-scope textarea{font-family:inherit;font-size:12.4px;color:' + INK + ';',
      'padding:7px 10px;border-radius:9px;border:1px solid rgba(125,145,180,.3);background:rgba(255,255,255,.8);outline:none}',
      '.mk-scope input:focus,.mk-scope select:focus,.mk-scope textarea:focus{border-color:#27a8db;background:#fff}',
      '.mk-scope h3{margin:0;font-size:13.5px;font-weight:600;color:' + INK + '}',
      '@keyframes growW{from{width:0}}',
    ].join('');
    document.head.appendChild(el);
  }
  /* ---- app-wide glass ----------------------------------------------------
     The mockup's look is not just the card — it is a card that is TRANSLUCENT over a
     coloured backdrop. Without the gradient behind it, a glass panel just reads as a
     flat white box. So this puts the mockup's radial-gradient field and drifting orb
     behind the whole app and makes every .card glass, everywhere — not only in the
     modules built from the mockup.

     Print and PDF capture opt out: backdrop-filter does not rasterise reliably, and a
     printed sheet should be opaque white anyway. */
  function injectGlobal() {
    if (typeof document === 'undefined' || document.getElementById('mk-global')) return;
    var el = document.createElement('style');
    el.id = 'mk-global';
    el.textContent = [
      'body::before{content:"";position:fixed;inset:0;z-index:-2;pointer-events:none;',
      'background:radial-gradient(900px 620px at 12% -8%,rgba(0,144,202,.26),transparent 62%),',
      'radial-gradient(820px 560px at 90% 6%,rgba(58,181,167,.24),transparent 62%),',
      'radial-gradient(950px 720px at 78% 98%,rgba(106,82,212,.20),transparent 62%),',
      'radial-gradient(720px 520px at 5% 92%,rgba(39,168,219,.20),transparent 62%),',
      'linear-gradient(180deg,#eef3fb,#e4ecf8)}',
      'body::after{content:"";position:fixed;z-index:-1;pointer-events:none;width:640px;height:640px;',
      'left:18%;top:-220px;border-radius:50%;',
      'background:radial-gradient(circle,rgba(39,168,219,.22),rgba(58,181,167,.12) 52%,transparent 72%);',
      'filter:blur(52px);animation:orbFloat 18s ease-in-out infinite alternate}',
      '@keyframes orbFloat{from{transform:translate(0,0) scale(1)}to{transform:translate(160px,110px) scale(1.18)}}',
      '.main,.content{background:transparent}',
      /* the glass panel itself */
      '.card{background:linear-gradient(152deg,rgba(255,255,255,.76),rgba(236,247,255,.46));',
      'backdrop-filter:blur(26px) saturate(1.75);-webkit-backdrop-filter:blur(26px) saturate(1.75);',
      'border:1px solid rgba(255,255,255,.92);border-radius:16px;',
      'box-shadow:0 14px 42px rgba(31,59,90,.14),0 4px 16px rgba(0,144,202,.09),',
      'inset 0 1px 0 rgba(255,255,255,.95),inset 0 0 22px rgba(255,255,255,.35)}',
      '.card:hover{box-shadow:0 18px 50px rgba(31,59,90,.17),0 6px 20px rgba(0,144,202,.12),',
      'inset 0 1px 0 rgba(255,255,255,.95),inset 0 0 22px rgba(255,255,255,.35)}',
      '.card-h{border-bottom:1px solid ' + LINE + '}',
      /* a card nested inside a card should not double the blur */
      '.card .card{backdrop-filter:none;-webkit-backdrop-filter:none;background:rgba(255,255,255,.62);',
      'box-shadow:0 4px 14px rgba(31,59,90,.08);border-color:rgba(255,255,255,.85)}',
      /* the topbar floats over the same field */
      '.topbar{background:rgba(255,255,255,.62);backdrop-filter:blur(20px) saturate(1.6);',
      '-webkit-backdrop-filter:blur(20px) saturate(1.6);border-bottom:1px solid rgba(255,255,255,.8)}',
      /* opaque for print and PDF capture */
      '@media print{body::before,body::after{display:none}',
      '.card,.card .card{background:#fff !important;backdrop-filter:none !important;',
      '-webkit-backdrop-filter:none !important;box-shadow:none !important;border:1px solid #ccc !important}}',
      'body.qc-pdfcap .card{background:#fff !important;backdrop-filter:none !important;',
      '-webkit-backdrop-filter:none !important}',
      /* The two opt-outs above only know about `.card`. Most report and certificate
         pages are hand-rolled shells, so glassing one would silently bleed the page
         gradient into an exported PDF -- html2canvas rasterises exactly what it sees.
         Anything inside a capture root is forced back to paper whatever class it
         carries. */
      '@media print{#pdf-root,#pdf-root *,.pdf-page,.pdf-page *{background-image:none !important;',
      'backdrop-filter:none !important;-webkit-backdrop-filter:none !important}}',
      'body.qc-pdfcap #pdf-root,body.qc-pdfcap #pdf-root *,body.qc-pdfcap .pdf-page,body.qc-pdfcap .pdf-page *,',
      'body.pdf-export-mode #pdf-root,body.pdf-export-mode #pdf-root *{background-image:none !important;',
      'backdrop-filter:none !important;-webkit-backdrop-filter:none !important}',
    ].join('');
    document.head.appendChild(el);
  }
  API.injectGlobal = injectGlobal;

  if (typeof document !== 'undefined') {
    var boot = function () { injectCss(); injectGlobal(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }
  API.injectCss = injectCss;

  if (typeof window !== 'undefined') window.MK = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
