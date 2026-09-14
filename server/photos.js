/* PHOTO UPLOADS — staff record photos and account profile pictures.
 *
 * WHERE THE BYTES GO
 * Cloudinary, never MongoDB. The database only ever stores the CDN url + publicId
 * this route returns, so a staff list query stays small and the browser loads the
 * picture straight from the CDN edge. That is the contract server/media-admin.js
 * already documents ("MongoDB only ever holds the CDN url + publicId that
 * POST /api/upload returned") — this file is the missing half of it.
 *
 * TWO KINDS, TWO PERMISSIONS
 *   kind=staff    -> unico/staff     — requires EDIT on the staff module, because a
 *                                      staff photo is part of the personnel record.
 *   kind=profile  -> unico/profiles  — the caller's OWN avatar. Any signed-in account
 *                                      may set its own and no other: the target is
 *                                      taken from the session, never from the body,
 *                                      so this cannot be pointed at another user.
 *
 * WHY A DATA URI AND NOT multipart
 * The one working upload already in the app (PUT /api/med/brand/:id/image) takes a
 * base64 data URI, the browser resizes before sending, and it needs no multipart
 * parser in the request path. Same shape here, so both uploads behave identically
 * and there is one thing to learn rather than two.
 *
 * WHO WRITES THE DATABASE
 *   - profile: this route writes users.photo itself — the account document is not
 *     something the renderer may patch.
 *   - staff:   this route does NOT write the staff record. Staff edits flow through
 *     the app's existing overlay sync (unico_staff_v3 -> PUT /api/data), and a second
 *     writer on the same record is exactly how concurrent edits get lost. The caller
 *     stores the returned url on the record through the normal store.
 */
const storage = require('./storage');
const activity = require('./activity-log');
const access = require('./access');
const { getUsers, getDbHandle, getAppData } = require('./db');
const cache = require('./cache');

/* Write the portrait url onto the staff document.
 *
 * The header above used to say this route deliberately does NOT touch the staff
 * record, on the grounds that a second writer is how concurrent edits get lost. That
 * reasoning holds for whole-record writes; it does not hold for one field. And the
 * cost of leaving it out was severe: the url lived only in the `unico_staff_v3`
 * app-state blob, which the browser mirrors back wholesale, so a stale tab or an
 * unlucky hydration dropped it. Measured on production: 51 portraits uploaded to
 * Cloudinary, 28 still referenced — 23 orphaned, the bytes kept but the link gone,
 * and no way to tell whose face they were.
 *
 * A targeted $set on one field is atomic and cannot clobber a sibling edit, and it
 * goes through getDbHandle() so the read cache is invalidated fleet-wide. */
async function setStaffPhoto(staffId, empId, photo) {
  const h = await getDbHandle();
  const dbh = h && h.db ? h.db : h;
  if (!dbh) return false;
  // By record id only — see staffIdFilter: emp ids are shared by different people.
  const filter = require('./staff-roster').staffIdFilter(staffId);
  if (!filter) return false;
  const upd = photo ? { $set: { photo } } : { $unset: { photo: '' } };
  const r = await dbh.collection('staff').updateOne(filter, upd);
  // Invalidate EXPLICITLY rather than trusting the instrumented write to do it.
  // A portrait that reaches the database but not the cached `staff` copy is invisible:
  // __UNICO_STAFF__ is built from that copy, so the browser is handed a roster with no
  // picture and the client-side merge has nothing to restore. Exactly that happened to
  // one record — the document had the photo, the cached read did not.
  try { await cache.bump('staff'); } catch (e) { /* best effort */ }
  return r.matchedCount > 0;
}

// Generous for a portrait the client has already resized; small enough that a stray
// 12 MP phone photo is refused with a clear message instead of a timeout.
const IMG_MAX = 2 * 1024 * 1024;
const IMG_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const KINDS = {
  staff: { folder: 'unico/staff', module: 'staff' },
  profile: { folder: 'unico/profiles', module: null },
};

function notConfigured(res) {
  return res.status(503).json({
    ok: false,
    error: 'Photo storage is not set up. Add CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET to the server environment.',
  });
}

// Decode "data:image/jpeg;base64,...." into a Buffer, or explain precisely what is
// wrong with it. Every failure here is a 4xx the user can act on.
function decodeImage(dataUri) {
  const m = String(dataUri || '').match(/^data:([a-z/+-]+);base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!m) return { error: 'Send the image as a base64 data URI.', code: 400 };
  const mime = m[1].toLowerCase();
  if (IMG_TYPES.indexOf(mime) < 0) return { error: 'JPEG, PNG or WebP only.', code: 400 };
  const buf = Buffer.from(m[2].replace(/\s/g, ''), 'base64');
  if (!buf.length) return { error: 'The image is empty.', code: 400 };
  if (buf.length > IMG_MAX) {
    return { error: 'Image too large — it must be under ' + Math.round(IMG_MAX / 1024) + ' KB.', code: 413 };
  }
  return { buf, mime };
}

function mount(app, opts) {
  const requireApi = (opts && opts.requireApi) || ((req, res, next) => { req.user = null; next(); });

  // Resolve the caller's live authority and check it may upload this kind. Returns
  // the kind spec, or null after having already answered the request.
  async function allow(req, res, rawKind) {
    const kind = KINDS[String(rawKind || 'staff').toLowerCase()];
    if (!kind) { res.status(400).json({ ok: false, error: 'Unknown upload kind.' }); return null; }
    if (!kind.module) return kind;                     // own avatar — being signed in is enough
    const a = await access.forRequest(req);
    if (!a) { res.status(401).json({ ok: false, error: 'Not authenticated.' }); return null; }
    req.access = a;
    if (!a.unrestricted && !access.can(a, kind.module, 'edit')) {
      res.status(403).json({ ok: false, error: 'You do not have permission to change staff photos.' });
      return null;
    }
    return kind;
  }

  // ---- upload -------------------------------------------------------------
  app.post('/api/upload', requireApi, async (req, res) => {
    if (!storage.status().configured) return notConfigured(res);
    const body = (req.body && typeof req.body === 'object') ? req.body : {};
    const kind = await allow(req, res, body.kind);
    if (!kind) return;

    const img = decodeImage(body.image);
    if (img.error) return res.status(img.code).json({ ok: false, error: img.error });

    try {
      const up = await storage.uploadBuffer(img.buf, { folder: kind.folder });

      // An avatar belongs to the account document, which the renderer cannot patch —
      // so this route owns that write. The target is the SESSION user, never the body.
      if (kind.folder === KINDS.profile.folder) {
        const who = req.user && (req.user.sub || req.user.username);
        if (who) {
          const users = await getUsers();
          const prev = await users.findOne({ username: who }, { projection: { photo: 1 } });
          await users.updateOne({ username: who }, {
            $set: { photo: { url: up.url, publicId: up.publicId, updatedAt: Date.now() } },
          });
          // Replacing a picture orphans the old asset; Cloudinary has no recycle bin
          // and no cleanup job, so drop it now. Best-effort: a failure here must not
          // fail an upload that already succeeded.
          const old = prev && prev.photo && prev.photo.publicId;
          if (old && old !== up.publicId) storage.deleteByPublicId(old).catch(() => {});
        }
      }

      // Staff portrait: store the url on the staff document too, so it survives a
      // cleared browser, another device and a redeploy. Best effort — a failure here
      // must not fail an upload that already succeeded, and the overlay still carries
      // it as before.
      if (kind.folder === KINDS.staff.folder && (body.staffId != null || body.empId)) {
        try {
          await setStaffPhoto(body.staffId, body.empId, { url: up.url, publicId: up.publicId, updatedAt: Date.now() });
        } catch (e) { /* keep the upload successful */ }
      }

      activity.record(Object.assign({}, activity.actorOf(req), {
        action: 'photo_upload',
        ip: activity.ipOf(req),
        detail: kind.folder + ' · ' + up.publicId + ' · ' + Math.round(up.bytes / 1024) + ' KB'
          + (body.staffName ? ' · ' + String(body.staffName).slice(0, 60) : ''),
      }));

      res.json({ ok: true, url: up.url, publicId: up.publicId, width: up.width, height: up.height, bytes: up.bytes });
    } catch (e) {
      res.status(500).json({ ok: false, error: String((e && e.message) || 'Upload failed.') });
    }
  });

  // ---- remove -------------------------------------------------------------
  // Deleting the asset is permanent. Clearing the REFERENCE is the caller's job for
  // staff (overlay sync); for an avatar this route clears it, since it owns the write.
  app.delete('/api/upload', requireApi, async (req, res) => {
    if (!storage.status().configured) return notConfigured(res);
    const body = (req.body && typeof req.body === 'object') ? req.body : {};
    const kind = await allow(req, res, body.kind);
    if (!kind) return;

    const publicId = String(body.publicId || '').trim();
    // A portrait saved without a publicId (url-only, or backfilled with publicId '') has
    // nothing to delete from storage, but its link on the staff document must still be
    // cleared: that copy is what the roster merge restored the "removed" photo from.
    if (!publicId && kind.folder === KINDS.staff.folder && body.staffId != null && body.staffId !== '') {
      try { await setStaffPhoto(body.staffId, body.empId, null); return res.json({ ok: true, storage: 'nothing to delete' }); }
      catch (e) { return res.status(500).json({ ok: false, error: 'Could not clear the photo on the staff record.' }); }
    }
    if (!publicId) return res.status(400).json({ ok: false, error: 'publicId is required.' });
    // Never let a caller reach outside the folder its kind owns.
    if (publicId.indexOf(kind.folder + '/') !== 0) {
      return res.status(403).json({ ok: false, error: 'That asset does not belong to this upload kind.' });
    }

    try {
      if (kind.folder === KINDS.profile.folder) {
        const who = req.user && (req.user.sub || req.user.username);
        if (who) await (await getUsers()).updateOne({ username: who }, { $unset: { photo: '' } });
      }
      // Removing a portrait must clear the server copy too, or the merge on the
      // client would helpfully put it back.
      if (kind.folder === KINDS.staff.folder && (body.staffId != null || body.empId)) {
        try { await setStaffPhoto(body.staffId, body.empId, null); } catch (e) { /* non-fatal */ }
      }
      await storage.deleteByPublicId(publicId);
      activity.record(Object.assign({}, activity.actorOf(req), {
        action: 'photo_delete', ip: activity.ipOf(req), detail: publicId,
      }));
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ ok: false, error: String((e && e.message) || 'Delete failed.') });
    }
  });

  // ---- library ------------------------------------------------------------
  /* Every portrait ever uploaded for staff, with WHO it is attached to.
   *
   * Cloudinary names an upload with a random id, so once the link on the staff
   * record is lost there is nothing in the asset that says whose face it is. 23 of 51
   * portraits on production ended up that way. This listing pairs each asset with the
   * record that points at it (staff document first, then the browser-mirrored overlay),
   * so an unattached one can be recognised by eye and attached with one click instead
   * of being photographed again.
   *
   * Requires EDIT on staff — the same right as uploading — because this shows every
   * portrait in the register, not just the ones a scoped account may see. */
  app.get('/api/upload/library', requireApi, async (req, res) => {
    if (!storage.status().configured) return notConfigured(res);
    const kind = await allow(req, res, 'staff');
    if (!kind) return;
    try {
      // Page through the folder (bounded — a runaway listing must not hang a request).
      const assets = []; let cursor = '';
      for (let i = 0; i < 10; i++) {
        const page = await storage.listAssets({ folder: kind.folder, resourceType: 'image', limit: 100, cursor });
        assets.push.apply(assets, page.assets || []);
        cursor = page.cursor || ''; if (!cursor) break;
      }
      // Who points at what. Keyed by publicId and by url, since older overlay rows
      // carry only the url.
      const owner = {};
      const claim = (rec, src) => {
        const p = rec && rec.photo; if (!p) return;
        const url = typeof p === 'string' ? p : (p.url || ''); const pid = typeof p === 'object' ? (p.publicId || '') : '';
        const who = { name: rec.name || '', empId: rec.emp_id || '', staffId: rec.id != null ? rec.id : null, src };
        if (pid && !owner[pid]) owner[pid] = who;
        if (url && !owner[url]) owner[url] = who;
      };
      const h = await getDbHandle(); const dbh = h && h.db ? h.db : h;
      if (dbh) (await dbh.collection('staff').find({}, { projection: { id: 1, emp_id: 1, name: 1, photo: 1 } }).toArray()).forEach((r) => claim(r, 'record'));
      try {
        let ov = ((await getAppData()) || {}).data; ov = ov && ov['unico_staff_v3'];
        if (typeof ov === 'string') ov = JSON.parse(ov);
        if (Array.isArray(ov)) ov.forEach((r) => claim(r, 'overlay'));
      } catch (e) { /* overlay unreadable -> record ownership only */ }
      const out = assets
        .map((a) => Object.assign({}, a, { attachedTo: owner[a.publicId] || owner[a.url] || null }))
        .sort((x, y) => String(y.createdAt).localeCompare(String(x.createdAt)));
      const attached = out.filter((a) => a.attachedTo).length;
      res.json({ ok: true, assets: out, counts: { total: out.length, attached, unattached: out.length - attached } });
    } catch (e) {
      res.status(500).json({ ok: false, error: String((e && e.message) || 'Could not list the library.') });
    }
  });

  // Attach an ALREADY-UPLOADED portrait to a staff record — the recovery path for the
  // orphans above, and a way to reuse a picture without re-uploading it.
  app.post('/api/upload/attach', requireApi, async (req, res) => {
    const body = (req.body && typeof req.body === 'object') ? req.body : {};
    const kind = await allow(req, res, 'staff');
    if (!kind) return;
    const publicId = String(body.publicId || '');
    if (publicId.indexOf(kind.folder + '/') !== 0) return res.status(400).json({ ok: false, error: 'That is not a staff portrait.' });
    if (body.staffId == null && !body.empId) return res.status(400).json({ ok: false, error: 'Save the staff record first, then attach a photo to it.' });
    try {
      const url = String(body.url || '');
      const photo = { url, publicId, updatedAt: Date.now() };
      const ok = await setStaffPhoto(body.staffId, body.empId, photo);
      if (!ok) return res.status(404).json({ ok: false, error: 'That staff member has no saved record yet — save the record first.' });
      activity.record(Object.assign({}, activity.actorOf(req), {
        action: 'photo_upload', ip: activity.ipOf(req),
        detail: 'attached ' + publicId + ' to staff ' + (body.empId || body.staffId) + (body.staffName ? ' · ' + String(body.staffName).slice(0, 60) : ''),
      }));
      res.json({ ok: true, photo });
    } catch (e) {
      res.status(500).json({ ok: false, error: String((e && e.message) || 'Could not attach the photo.') });
    }
  });

  // ---- capability probe ---------------------------------------------------
  // The UI asks this once so it can hide the upload control (and say why) instead of
  // offering a button that will always fail.
  app.get('/api/upload/status', requireApi, (req, res) => {
    const st = storage.status();
    res.json({ ok: true, configured: st.configured, provider: st.provider, cloudName: st.cloudName });
  });
}

module.exports = { mount, setStaffPhoto, IMG_MAX, IMG_TYPES };
