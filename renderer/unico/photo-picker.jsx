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

  async function unicoUploadPhoto(file, opts) {
    const o = opts || {};
    const image = await unicoResizeImage(file);
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

  /* PhotoPicker — the round portrait with a camera button on its corner.
   *   value    {url, publicId} | null
   *   onChange (next|null)  -> the CALLER persists it on its own record
   *   initials fallback shown when there is no picture
   *   size     px (default 96) · kind 'staff' | 'profile' · readOnly hides controls
   *   w/h/radius override the default circle for the ID-badge portrait, which is
   *   a 104x120 rounded rectangle and must not be cropped to a round frame.
   */
  function PhotoPicker({ value, onChange, initials, name, size, kind, readOnly, hue, w, h, radius, plain }) {
    const [busy, setBusy] = React.useState(false);
    const [cfg, setCfg] = React.useState(null);
    const inputRef = React.useRef(null);
    const px = size || 96;

    React.useEffect(() => {
      let live = true;
      unicoPhotoStatus().then((c) => { if (live) setCfg(c); });
      return () => { live = false; };
    }, []);

    const toast = (m, t) => { try { window.UI && window.UI.toast && window.UI.toast(m, t); } catch (e) { } };

    async function pick(ev) {
      const file = ev.target.files && ev.target.files[0];
      ev.target.value = '';                 // so re-picking the SAME file fires change again
      if (!file) return;
      if (!/^image\//.test(file.type)) { toast('That is not an image file', 'error'); return; }
      setBusy(true);
      try {
        const up = await unicoUploadPhoto(file, { kind: kind, name: name });
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
          <div style={{
            width: W, height: H, borderRadius: R, overflow: 'hidden',
            background: (value && value.url) ? '#fff' : fill,
            border: plain ? 'none' : ('2px solid ' + ring), display: 'grid', placeItems: 'center',
            fontSize: Math.round(Math.min(W, H) / 2.6), fontWeight: 800,
            color: plain ? '#fff' : ring, letterSpacing: '.5px',
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

  Object.assign(window, { PhotoPicker, unicoUploadPhoto, unicoDeletePhoto, unicoPhotoStatus, unicoResizeImage });
})();
