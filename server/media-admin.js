/* Admin MEDIA BROWSER for the Cloudinary asset store, behind Settings → Media.
 *
 * Cloudinary is where the app's photos and files actually live: MongoDB only ever
 * holds the CDN url + publicId that `POST /api/upload` returned. This panel is the
 * way to see what is really up there, folder by folder — profile photos under
 * `unico/profiles`, everything else under `unico` — and to remove an asset that is
 * no longer referenced.
 *
 * DELETION IS PERMANENT and Cloudinary keeps no recycle bin, so a delete here is
 * confirmed in the UI and written to the activity log with the publicId. It does
 * NOT touch the MongoDB record that points at the asset: use the owning screen
 * (Users & Roles for a profile photo) when you want both gone, and this panel for
 * orphans that no screen can reach any more.
 *
 * The Cloudinary Admin API is rate-limited (500 calls/hour on the free plan), so
 * every endpoint here is called only when an admin actually opens the panel.
 *
 * Administrator only, on top of the normal API guard.
 */
const storage = require('./storage');
const activity = require('./activity-log');

function mount(app, opts) {
  const requireApi = (opts && opts.requireApi) || ((req, res, next) => { req.user = null; next(); });
  const adminOnly = (req, res, next) => {
    // Prefer the RESOLVED authority (req.access, read from the live user document by
    // server/access.js) over req.user.role, which is only a claim inside the token — a
    // snapshot of who the caller was when they signed in, not who they are now.
    if (req.access) {
      if (req.access.unrestricted) return next();
      return res.status(403).json({ ok: false, error: 'Administrator access required.' });
    }
    if (req.user && req.user.role && req.user.role !== 'Administrator') {
      return res.status(403).json({ ok: false, error: 'Administrator access required.' });
    }
    next();
  };
  const guard = [requireApi, adminOnly];

  const notConfigured = (res) => res.json({
    ok: true, configured: false, folders: [], assets: [],
    hint: 'Set CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET in server/.env to store photos and files on Cloudinary instead of in the database.',
  });

  // Folder tree, one level at a time (?path= empty for the top level).
  app.get('/api/media/folders', guard, async (req, res) => {
    const st = storage.status();
    if (!st.configured) return notConfigured(res);
    try {
      const folders = await storage.listFolders(req.query.path || '');
      res.json({ ok: true, configured: true, cloudName: st.cloudName, path: String(req.query.path || ''), folders });
    } catch (e) {
      res.status(500).json({ ok: false, error: String((e && e.message) || e) });
    }
  });

  // One page of assets in a folder. `cursor` continues the previous page.
  app.get('/api/media/assets', guard, async (req, res) => {
    const st = storage.status();
    if (!st.configured) return notConfigured(res);
    try {
      const r = await storage.listAssets({
        folder: req.query.folder || '',
        cursor: req.query.cursor || '',
        limit: req.query.limit,
        resourceType: req.query.type || 'image',
      });
      res.json({ ok: true, configured: true, cloudName: st.cloudName, folder: String(req.query.folder || ''), ...r });
    } catch (e) {
      res.status(500).json({ ok: false, error: String((e && e.message) || e) });
    }
  });

  // Plan consumption — the numbers that matter on the free tier.
  app.get('/api/media/usage', guard, async (req, res) => {
    if (!storage.status().configured) return notConfigured(res);
    try { res.json({ ok: true, configured: true, usage: await storage.usage() }); }
    catch (e) { res.status(500).json({ ok: false, error: String((e && e.message) || e) }); }
  });

  // Permanently remove one asset.
  app.delete('/api/media/asset', guard, async (req, res) => {
    if (!storage.status().configured) return res.status(400).json({ ok: false, error: 'Cloudinary is not configured.' });
    const publicId = String(req.query.publicId || '');
    if (!publicId) return res.status(400).json({ ok: false, error: 'Missing publicId.' });
    const r = await storage.deleteByPublicId(publicId);
    if (!r.ok) return res.status(500).json({ ok: false, error: r.error || 'Cloudinary refused the delete.' });
    activity.log(req, 'media_deleted', { target: publicId, detail: 'Deleted from Cloudinary' });
    res.json({ ok: true });
  });

  return app;
}

module.exports = { mount };
