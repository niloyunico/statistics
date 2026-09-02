/* PHOTO UPLOAD — one control for every picture in the app.
 *
 * Used by the staff profile (a nurse's/PCA's record photo) and by the account
 * menu (the signed-in user's own avatar). Publishes window.PhotoPicker plus the
 * three helpers underneath it, so any screen can reuse the same upload path.
 *
 * WHERE THE BYTES GO: Cloudinary, via POST /api/upload (server/photos.js). What
 * comes back is a CDN url + publicId, and THAT is what the caller stores on its
 * own record. No image data ever enters the app state or the overlay sync — a
 * staff list must not drag portrait bytes around with it.
 *
 * THE FILE IS RESIZED IN THE BROWSER FIRST. A phone portrait is 3-6 MB and none
 * of that detail survives being drawn at 96 px, so shrinking here keeps the
 * request small and the upload quick on hospital wifi. The server enforces its
 * own ceiling regardless — this is a courtesy, not the check.
 */
(function () {
  const PHOTO_MAX_PX = 640;      // longest edge kept: plenty for a 320 px badge on a 2x screen
  const PHOTO_QUALITY = 0.85;

  // Draw the chosen file onto a canvas at a sane size, return a JPEG data URI.
  // Any decode quirk resolves to the ORIGINAL data URI rather than rejecting, so
  // a browser oddity degrades to "a bigger upload", never to "cannot upload".
  function unicoResizeImage(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onerror = () => reject(new Error('Could not read that file.'));
      fr.onload = () => {
        const raw = String(fr.result || '');
        const img = new Image();
        img.onerror = () => resolve(raw);
        img.onload = () => {
          try {
            const scale = Math.min(1, PHOTO_MAX_PX / Math.max(img.width, img.height));
            if (scale >= 1 && raw.length < 600 * 1024) return resolve(raw);
            const c = document.createElement('canvas');
            c.width = Math.round(img.width * scale);
            c.height = Math.round(img.height * scale);
            const ctx = c.getContext('2d');
            ctx.fillStyle = '#fff';                       // PNG transparency -> white, not black
            ctx.fillRect(0, 0, c.width, c.height);
            ctx.drawImage(img, 0, 0, c.width, c.height);
            resolve(c.toDataURL('image/jpeg', PHOTO_QUALITY));
          } catch (e) { resolve(raw); }
        };
        img.src = raw;
      };
      fr.readAsDataURL(file);
    });
  }

  // Is photo storage configured on this server? Asked once and shared, so the
  // control can explain itself instead of offering a button that always fails.
  let _cfg = null;
  function unicoPhotoStatus() {
    if (_cfg) return _cfg;
    _cfg = fetch('/api/upload/status', { credentials: 'same-origin' })
      .then((r) => r.json()).catch(() => ({ ok: false, configured: false }));
    return _cfg;
  }

  // `src` is either a File (resized here) or a data URI the crop dialog already
  // produced. Cropping is the caller's decision, so this must not re-process one.
  async function unicoUploadPhoto(src, opts) {
    const o = opts || {};
    const image = (typeof src === 'string') ? src : await unicoResizeImage(src);
    const r = await fetch('/api/upload', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify({ image, kind: o.kind || 'staff', staffName: o.name || '' }),
    });
    const j = await r.json().catch(() => ({ ok: false, error: 'The server sent an unreadable reply.' }));
    if (!r.ok || !j.ok) throw new Error(j.error || 'Upload failed.');
    return j;   // { url, publicId, width, height, bytes }
  }

  async function unicoDeletePhoto(publicId, kind) {
    const r = await fetch('/api/upload', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify({ publicId: publicId, kind: kind || 'staff' }),
    });
    const j = await r.json().catch(() => ({ ok: false }));
    if (!r.ok || !j.ok) throw new Error(j.error || 'Could not remove the photo.');
    return true;
  }

  /* ------------------------------ CROP DIALOG ------------------------------
   * Why this exists: every portrait was being centre-cropped blindly to fill its
   * frame, which is wrong for exactly the pictures people upload — a face off to
   * one side, a wide logo, a photo with headroom. Choosing the visible area is the
   * difference between a usable badge and a slice of someone's forehead.
   *
   * HOW IT WORKS
   * The image is laid out "cover"-style inside a frame of the TARGET aspect ratio,
   * then dragged to pan and slid to zoom. Panning is clamped so the frame can never
   * show empty space. On confirm the visible rectangle is mapped back to SOURCE
   * pixels and drawn once via drawImage(sx,sy,sw,sh) — so the export is cut from the
   * ORIGINAL at full resolution, not re-sampled from the small preview.
   *
   * The frame is drawn in the shape the picture will actually appear in (a circle
   * for an avatar, the badge's rounded rectangle for a staff photo): a square
   * preview of a round crop makes people mis-frame faces.
   */
  const CROP_BOX = 300;          // preview frame, longest edge, CSS px
  const CROP_OUT = 640;          // exported image, longest edge, real px

  function CropDialog({ src, aspect, radius, onCancel, onDone }) {
    const [img, setImg] = React.useState(null);
    const [zoom, setZoom] = React.useState(1);
    const [pan, setPan] = React.useState({ x: 0, y: 0 });
    const drag = React.useRef(null);

    const boxW = aspect >= 1 ? CROP_BOX : Math.round(CROP_BOX * aspect);
    const boxH = aspect >= 1 ? Math.round(CROP_BOX / aspect) : CROP_BOX;

    React.useEffect(() => {
      const i = new Image();
      i.onload = () => { setImg(i); setZoom(1); };
      i.src = src;
    }, [src]);

    // Scale at which the image exactly covers the frame; zoom multiplies it.
    const base = img ? Math.max(boxW / img.width, boxH / img.height) : 1;
    const eff = base * zoom;
    const dispW = img ? img.width * eff : 0;
    const dispH = img ? img.height * eff : 0;

    // Keep the frame covered: the image's edges may never come inside it.
    function clampTo(p, w, h) {
      return { x: Math.min(0, Math.max(boxW - w, p.x)), y: Math.min(0, Math.max(boxH - h, p.y)) };
    }

    const prevEff = React.useRef(null);

    // Centre once, when the image loads.
    React.useEffect(() => {
      if (!img) return;
      const b = Math.max(boxW / img.width, boxH / img.height);
      setPan(clampTo({ x: (boxW - img.width * b) / 2, y: (boxH - img.height * b) / 2 }, img.width * b, img.height * b));
      prevEff.current = b;
    }, [img]);   // eslint-disable-line react-hooks/exhaustive-deps

    // ZOOM ABOUT THE CENTRE OF THE FRAME, not about the image's top-left.
    // Re-centring on every zoom change (what this did before) threw away the framing:
    // you would line a face up, nudge the slider, and be thrown back to the middle of
    // the picture — which made the zoom feel broken. Instead, hold the point that is
    // currently in the middle of the frame fixed and scale the offset around it.
    React.useEffect(() => {
      if (!img) return;
      const before = prevEff.current;
      prevEff.current = eff;
      if (!before || before === eff) return;
      const k = eff / before;
      setPan((p) => clampTo({
        x: boxW / 2 - (boxW / 2 - p.x) * k,
        y: boxH / 2 - (boxH / 2 - p.y) * k,
      }, dispW, dispH));
    }, [zoom]);   // eslint-disable-line react-hooks/exhaustive-deps

    function down(e) {
      const pt = e.touches ? e.touches[0] : e;
      drag.current = { x: pt.clientX, y: pt.clientY, ox: pan.x, oy: pan.y };
    }
    function move(e) {
      if (!drag.current) return;
      const pt = e.touches ? e.touches[0] : e;
      if (e.cancelable) e.preventDefault();
      setPan(clampTo({ x: drag.current.ox + (pt.clientX - drag.current.x), y: drag.current.oy + (pt.clientY - drag.current.y) }, dispW, dispH));
    }
    const up = () => { drag.current = null; };

    React.useEffect(() => {
      window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
      window.addEventListener('touchmove', move, { passive: false }); window.addEventListener('touchend', up);
      return () => {
        window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up);
        window.removeEventListener('touchmove', move); window.removeEventListener('touchend', up);
      };
    });

    function confirm() {
      if (!img) return;
      const outW = aspect >= 1 ? CROP_OUT : Math.round(CROP_OUT * aspect);
      const outH = aspect >= 1 ? Math.round(CROP_OUT / aspect) : CROP_OUT;
      const c = document.createElement('canvas');
      c.width = outW; c.height = outH;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, outW, outH);
      // Frame -> source pixels: pan is the image's top-left inside the frame, so the
      // frame's origin sits at (-pan / eff) in the original image.
      ctx.drawImage(img, -pan.x / eff, -pan.y / eff, boxW / eff, boxH / eff, 0, 0, outW, outH);
      onDone(c.toDataURL('image/jpeg', PHOTO_QUALITY));
    }

    // RENDERED THROUGH A PORTAL, and it must stay that way. `position:fixed` is
    // resolved against the nearest ancestor with a transform / filter /
    // backdrop-filter / contain — and this dialog is mounted deep inside a card on
    // pages that use all four. Left in place it anchored to the card and hung off
    // the edge of the screen. document.body has no such ancestor, so the overlay is
    // the viewport again, and it also escapes every overflow clip and z-index
    // stacking context on the way down.
    const body = (
      <div onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
        style={{ position: 'fixed', inset: 0, background: 'rgba(16,32,46,.55)', zIndex: 2000, display: 'grid', placeItems: 'center', padding: 16 }}>
        <div className="card" style={{ width: 'min(400px,96vw)' }}>
          <div className="card-h"><h3>Position your photo</h3></div>
          <div className="card-b" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 13 }}>
            <div onMouseDown={down} onTouchStart={down}
              onWheel={(e) => { e.preventDefault(); setZoom((z) => Math.min(4, Math.max(1, +(z - e.deltaY * 0.0016).toFixed(3)))); }}
              style={{
                position: 'relative', width: boxW, height: boxH, overflow: 'hidden',
                borderRadius: radius == null ? '50%' : radius, background: '#0e1826',
                cursor: 'grab', touchAction: 'none',
                boxShadow: '0 0 0 2px var(--blue,#0090ca), 0 8px 26px rgba(13,27,46,.25)',
              }}>
              {img
                ? <img src={src} alt="" draggable={false}
                  style={{ position: 'absolute', left: pan.x, top: pan.y, width: dispW, height: dispH, maxWidth: 'none', userSelect: 'none', pointerEvents: 'none' }} />
                : <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: '#8fa6c0', fontSize: 12 }}>Loading…</div>}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%' }}>
              <button type="button" className="btn sm" title="Zoom out" onClick={() => setZoom((z) => Math.max(1, +(z - 0.25).toFixed(2)))}
                style={{ padding: '2px 10px', fontSize: 15, lineHeight: 1.3, fontWeight: 700 }}>&minus;</button>
              <input type="range" min="1" max="4" step="0.01" value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))} style={{ flex: 1 }} />
              <button type="button" className="btn sm" title="Zoom in" onClick={() => setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)))}
                style={{ padding: '2px 10px', fontSize: 15, lineHeight: 1.3, fontWeight: 700 }}>+</button>
              <span className="num" style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', width: 34, textAlign: 'right' }}>{zoom.toFixed(1)}x</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', lineHeight: 1.5 }}>
              Drag to move, scroll or use − / + to zoom. Only what you see in the frame is saved.
            </div>

            <div style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'flex-end' }}>
              <button className="btn sm" onClick={onCancel}>Cancel</button>
              <button className="btn pri sm" onClick={confirm} disabled={!img}>Use this photo</button>
            </div>
          </div>
        </div>
      </div>
    );

    // ReactDOM is the UMD global here (no module system in this bundle). If a build
    // ever lacks createPortal, fall back to rendering in place rather than showing
    // nothing — a badly-placed dialog still beats a dead button.
    return (window.ReactDOM && window.ReactDOM.createPortal)
      ? window.ReactDOM.createPortal(body, document.body)
      : body;
  }

  /* ------------------------------ LIGHTBOX ---------------------------------
   * Full-screen "photo frame" view of a portrait. The badge photo is 104 px —
   * far too small to actually look at a face — so clicking it opens the stored
   * image at its real size inside a framed card. Read-only by design: viewing
   * must never sit one mis-click away from replacing or deleting a photo.
   * Portalled to document.body for the same fixed-position reasons as CropDialog.
   */
  function PhotoLightbox({ src, name, sub, onClose }) {
    React.useEffect(() => {
      const h = (e) => { if (e.key === 'Escape') onClose(); };
      window.addEventListener('keydown', h);
      return () => window.removeEventListener('keydown', h);
    }, [onClose]);

    const body = (
      <div onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(10,22,34,.74)', backdropFilter: 'blur(3px)',
          zIndex: 2000, display: 'grid', placeItems: 'center', padding: 18,
        }}>
        <div style={{
          position: 'relative', background: '#fff', borderRadius: 18, padding: 12,
          boxShadow: '0 24px 70px rgba(0,0,0,.45)', width: 'min(440px, 94vw)',
        }}>
          <button type="button" title="Close" onClick={onClose}
            style={{
              position: 'absolute', top: -13, right: -13, width: 32, height: 32, borderRadius: '50%',
              border: '2px solid #fff', background: '#132435', color: '#fff', cursor: 'pointer',
              display: 'grid', placeItems: 'center', fontSize: 15, fontWeight: 700, lineHeight: 1,
              boxShadow: '0 3px 10px rgba(0,0,0,.35)', padding: 0, zIndex: 1,
            }}>✕</button>
          <img src={src} alt={name || 'Photo'}
            style={{
              display: 'block', width: '100%', maxHeight: '72vh', objectFit: 'contain',
              borderRadius: 11, background: '#0e1826',
            }} />
          {(name || sub) && (
            <div style={{ textAlign: 'center', padding: '10px 8px 4px' }}>
              {name && <div style={{ fontSize: 15, fontWeight: 800, color: '#15181c', letterSpacing: '-.2px' }}>{name}</div>}
              {sub && <div style={{ fontSize: 11.5, fontWeight: 700, color: '#0072a3', marginTop: 2 }}>{sub}</div>}
            </div>
          )}
        </div>
      </div>
    );

    return (window.ReactDOM && window.ReactDOM.createPortal)
      ? window.ReactDOM.createPortal(body, document.body)
      : body;
  }

  /* PhotoPicker — the round portrait with a camera button on its corner.
   *   value    {url, publicId} | null
   *   onChange (next|null)  -> the CALLER persists it on its own record
   *   initials fallback shown when there is no picture
   *   size     px (default 96) · kind 'staff' | 'profile' · readOnly hides controls
   *   w/h/radius override the default circle for the ID-badge portrait, which is
   *   a 104x120 rounded rectangle and must not be cropped to a round frame.
   *   zoomable makes an existing photo clickable: it opens large in a lightbox
   *   (pass zoomSub for the caption line under the name).
   */
  function PhotoPicker({ value, onChange, initials, name, size, kind, readOnly, hue, w, h, radius, plain, zoomable, zoomSub }) {
    const [busy, setBusy] = React.useState(false);
    const [cfg, setCfg] = React.useState(null);
    const [cropSrc, setCropSrc] = React.useState(null);   // data URI awaiting framing
    const [viewing, setViewing] = React.useState(false);  // lightbox open?
    const inputRef = React.useRef(null);
    const px = size || 96;

    React.useEffect(() => {
      let live = true;
      unicoPhotoStatus().then((c) => { if (live) setCfg(c); });
      return () => { live = false; };
    }, []);

    const toast = (m, t) => { try { window.UI && window.UI.toast && window.UI.toast(m, t); } catch (e) { } };

    // Picking a file no longer uploads it: it opens the crop dialog first, so the
    // person decides what is inside the frame instead of being centre-cropped.
    function pick(ev) {
      const file = ev.target.files && ev.target.files[0];
      ev.target.value = '';                 // so re-picking the SAME file fires change again
      if (!file) return;
      if (!/^image\//.test(file.type)) { toast('That is not an image file', 'error'); return; }
      const fr = new FileReader();
      fr.onerror = () => toast('Could not read that file', 'error');
      fr.onload = () => setCropSrc(String(fr.result || ''));
      fr.readAsDataURL(file);
    }

    async function uploadCropped(dataUri) {
      setCropSrc(null);
      setBusy(true);
      try {
        const up = await unicoUploadPhoto(dataUri, { kind: kind, name: name });
        onChange && onChange({ url: up.url, publicId: up.publicId });
        toast('Photo updated', 'success');
      } catch (e) { toast(String((e && e.message) || e), 'error'); }
      finally { setBusy(false); }
    }

    async function clear() {
      if (!value || !value.publicId) { onChange && onChange(null); return; }
      const ok = (window.UI && window.UI.confirm)
        ? await window.UI.confirm({ title: 'Remove this photo?', message: 'The picture is deleted from storage permanently.', danger: true, confirmLabel: 'Remove' })
        : true;
      if (!ok) return;
      setBusy(true);
      try {
        await unicoDeletePhoto(value.publicId, kind);
        onChange && onChange(null);
        toast('Photo removed', 'success');
      } catch (e) { toast(String((e && e.message) || e), 'error'); }
      finally { setBusy(false); }
    }

    const ring = (typeof hue === 'number') ? ('hsl(' + hue + ' 55% 45%)') : 'var(--blue)';
    const W = w || px, H = h || px;
    const R = (radius == null) ? '50%' : radius;
    const btn = Math.max(26, Math.round(Math.min(W, H) / 3.4));
    // `plain` = the caller already draws the frame (the ID badge does), so paint the
    // portrait itself and skip our border/background.
    const fill = (typeof hue === 'number')
      ? 'linear-gradient(135deg,hsl(' + hue + ' 60% 52%),hsl(' + ((hue + 40) % 360) + ' 62% 42%))'
      : 'var(--blue-50)';

    return (
      <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <div style={{ position: 'relative', width: W, height: H }}>
          <div
            onClick={(zoomable && value && value.url && !busy) ? () => setViewing(true) : undefined}
            title={(zoomable && value && value.url) ? 'View photo' : undefined}
            style={{
              width: W, height: H, borderRadius: R, overflow: 'hidden',
              background: (value && value.url) ? '#fff' : fill,
              border: plain ? 'none' : ('2px solid ' + ring), display: 'grid', placeItems: 'center',
              fontSize: Math.round(Math.min(W, H) / 2.6), fontWeight: 800,
              color: plain ? '#fff' : ring, letterSpacing: '.5px',
              cursor: (zoomable && value && value.url && !busy) ? 'zoom-in' : undefined,
            }}>
            {value && value.url
              ? <img src={value.url} alt={name || 'Photo'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span>{initials || '—'}</span>}
          </div>
          {busy && (
            <div style={{
              position: 'absolute', inset: 0, borderRadius: R, background: 'rgba(255,255,255,.74)',
              display: 'grid', placeItems: 'center', fontSize: 10.5, fontWeight: 700, color: 'var(--blue)',
            }}>Uploading…</div>
          )}
          {!readOnly && !busy && (
            <button type="button" title="Upload a photo" onClick={() => inputRef.current && inputRef.current.click()}
              style={{
                position: 'absolute', right: -2, bottom: -2, width: btn, height: btn, borderRadius: '50%',
                border: '2px solid #fff', background: 'var(--blue)', color: '#fff', cursor: 'pointer',
                display: 'grid', placeItems: 'center', boxShadow: '0 2px 7px rgba(0,0,0,.22)', padding: 0,
              }}>
              <svg width={Math.max(13, Math.round(btn / 2))} height={Math.max(13, Math.round(btn / 2))} viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </button>
          )}
        </div>

        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={pick} style={{ display: 'none' }} />

        {viewing && value && value.url && (
          <PhotoLightbox src={value.url} name={name} sub={zoomSub} onClose={() => setViewing(false)} />
        )}

        {/* Framed in the SHAPE it will be shown in, so what you see is what is saved. */}
        {cropSrc && (
          <CropDialog src={cropSrc} aspect={W / H} radius={R}
            onCancel={() => setCropSrc(null)} onDone={uploadCropped} />
        )}

        {!readOnly && value && value.url && !busy && (
          <button type="button" className="btn sm" onClick={clear}
            style={{ color: '#d23a52', borderColor: '#f1c6cd', fontSize: 11, padding: '3px 9px' }}>Remove photo</button>
        )}
        {!readOnly && cfg && !cfg.configured && (
          <div style={{ fontSize: 10.5, color: 'var(--muted)', maxWidth: 190, textAlign: 'center', lineHeight: 1.5 }}>
            Photo storage is not set up on this server.
          </div>
        )}
      </div>
    );
  }

  /* ---------------------------- SHARED AVATAR -----------------------------
   * Every place that shows the signed-in person's picture (sidebar footer, portal
   * top bar, profile card) renders this, for two reasons that both bit us:
   *
   * 1. A dead url must never show the browser's broken-image icon. An asset can be
   *    deleted from Cloudinary, or blocked by a local security suite, and the
   *    honest answer is the person's initials — not a torn-paper glyph.
   * 2. Uploading has to update the picture EVERYWHERE at once. The account object
   *    is a plain global read at render time, so nothing re-rendered the sidebar
   *    when the profile page changed it, and the old picture sat there until a
   *    reload. unicoSetAccountPhoto() writes it and announces it; every Avatar is
   *    listening.
   */
  function unicoSetAccountPhoto(next) {
    if (window.__UNICO_USER__) window.__UNICO_USER__.photo = next || null;
    try { window.dispatchEvent(new CustomEvent('unico:profile-photo', { detail: next || null })); } catch (e) { }
  }

  // NAME IT UNIQUELY. Every bundled file is IIFE-wrapped and shares one flat
  // namespace (window), so a generic name is a landmine: staff.jsx already exports
  // its own `Avatar({name,size,fontSize})` and loads AFTER this file, so calling
  // this one `Avatar` silently handed the sidebar staff.jsx's component with the
  // wrong props — it rendered "?" on a red gradient and looked like a broken photo.
  function UnicoAvatar({ photo, initials, size, radius, className, style }) {
    // Re-read from the account object on every broadcast, so a sidebar mounted long
    // before the upload still catches up without a reload.
    const [live, setLive] = React.useState(photo === undefined ? ((window.__UNICO_USER__ || {}).photo || null) : photo);
    const [dead, setDead] = React.useState(false);
    React.useEffect(() => { if (photo !== undefined) { setLive(photo); setDead(false); } }, [photo]);
    React.useEffect(() => {
      if (photo !== undefined) return;                 // caller drives this one
      const h = (e) => { setLive(e.detail || null); setDead(false); };
      window.addEventListener('unico:profile-photo', h);
      return () => window.removeEventListener('unico:profile-photo', h);
    }, [photo]);

    const px = size || 34;
    const base = Object.assign({ width: px, height: px, borderRadius: radius == null ? 9 : radius }, style || {});
    if (live && live.url && !dead) {
      return <img className={className} src={live.url} alt={initials || ''} onError={() => setDead(true)}
        style={Object.assign({}, base, { objectFit: 'cover', padding: 0, display: 'block' })} />;
    }
    return <div className={className} style={base}>{initials || 'U'}</div>;
  }

  Object.assign(window, {
    PhotoPicker, PhotoLightbox, UnicoAvatar, unicoSetAccountPhoto,
    unicoUploadPhoto, unicoDeletePhoto, unicoPhotoStatus, unicoResizeImage,
  });
})();
