/* Photo/file storage layer — Cloudinary (images + automatic CDN/optimization).
 *
 * This is the third live connection in the stack, alongside MongoDB (db.js) and
 * Redis (redis.js). Same rules as the others:
 *   - Credentials live ONLY here on the server (.env); they are never shipped to
 *     the desktop app or the browser.
 *   - GRACEFUL DEGRADATION: if the cloudinary package is not installed or the
 *     credentials are missing, the layer reports `configured: false` and uploads
 *     fail with a clear error — the rest of the app keeps working.
 *
 * The browser asks the server to upload (server holds the API secret); the server
 * returns a public CDN `url` + `publicId`, which the client stores in MongoDB like
 * any other app-state value.
 */
let cloudinary = null;
try { cloudinary = require('cloudinary').v2; } catch (e) { cloudinary = null; }

const CLOUD = process.env.CLOUDINARY_CLOUD_NAME;
const KEY = process.env.CLOUDINARY_API_KEY;
const SECRET = process.env.CLOUDINARY_API_SECRET;

let _configured = false;

function configure() {
  if (!cloudinary || !CLOUD || !KEY || !SECRET) return false;
  if (!_configured) {
    cloudinary.config({ cloud_name: CLOUD, api_key: KEY, api_secret: SECRET, secure: true });
    _configured = true;
  }
  return true;
}

const ALLOWED_FORMATS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf'];

// Upload a raw file Buffer. Returns the public CDN URL + public id.
async function uploadBuffer(buf, opts = {}) {
  if (!buf || !buf.length) throw new Error('Empty upload.');
  if (!configure()) throw new Error('Storage is not configured (set CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET in server/.env).');
  const folder = String(opts.folder || 'unico').replace(/[^A-Za-z0-9_/-]/g, '');
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, allowed_formats: ALLOWED_FORMATS, resource_type: 'auto' },
      (err, result) => {
        if (err) return reject(err);
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          format: result.format,
          width: result.width,
          height: result.height,
          bytes: result.bytes,
        });
      }
    );
    stream.end(buf);
  });
}

// Remove a previously uploaded asset by its public id (best-effort).
async function deleteByPublicId(publicId) {
  if (!publicId) return { ok: false, error: 'Missing publicId.' };
  if (!configure()) return { ok: false, error: 'Storage is not configured.' };
  try {
    const r = await cloudinary.uploader.destroy(publicId);
    return { ok: r && r.result === 'ok' };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
}

function status() {
  const configured = !!(cloudinary && CLOUD && KEY && SECRET);
  return { provider: 'cloudinary', configured, cloudName: CLOUD || '' };
}

// Live connectivity check — calls Cloudinary's ping endpoint to confirm the
// credentials actually work (not just that they are present).
async function ping() {
  if (!configure()) return { ok: false, error: 'not configured' };
  try {
    const r = await cloudinary.api.ping();
    return { ok: !!(r && r.status === 'ok') };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
}

/* ---- browsing (Settings -> Media) ----
   Cloudinary's Admin API is rate-limited (500 calls/hour on the free plan), so
   these are called only when an admin actually opens the Media panel. Assets are
   organised by FOLDER, which is the `folder` passed to uploadBuffer(): `unico`
   for general uploads, `unico/profiles` for user photos. */

// Folders directly under `path` (or the top level when path is empty).
async function listFolders(path) {
  if (!configure()) throw new Error('Storage is not configured (set CLOUDINARY_* in server/.env).');
  const p = String(path || '').replace(/^\/+|\/+$/g, '');
  const r = p ? await cloudinary.api.sub_folders(p) : await cloudinary.api.root_folders();
  return (r && r.folders ? r.folders : []).map((f) => ({ name: f.name, path: f.path }));
}

// One page of assets inside a folder. Cloudinary keeps images, videos and raw
// files in SEPARATE resource types, so a single listing has to ask for the one
// the caller wants — the panel offers all three.
async function listAssets(opts) {
  if (!configure()) throw new Error('Storage is not configured (set CLOUDINARY_* in server/.env).');
  const o = opts || {};
  const folder = String(o.folder || '').replace(/^\/+|\/+$/g, '');
  const type = ['image', 'video', 'raw'].indexOf(String(o.resourceType)) >= 0 ? String(o.resourceType) : 'image';
  const params = {
    type: 'upload',
    resource_type: type,
    max_results: Math.min(100, Math.max(1, parseInt(o.limit, 10) || 30)),
  };
  // An empty prefix would list the whole account; only narrow when asked to.
  if (folder) params.prefix = folder + '/';
  if (o.cursor) params.next_cursor = String(o.cursor);

  const r = await cloudinary.api.resources(params);
  const assets = (r && r.resources ? r.resources : []).map((a) => ({
    publicId: a.public_id,
    name: String(a.public_id).split('/').pop(),
    folder: a.folder || folder,
    format: a.format || '',
    resourceType: a.resource_type || type,
    bytes: a.bytes || 0,
    width: a.width || 0,
    height: a.height || 0,
    createdAt: a.created_at || '',
    url: a.secure_url || a.url || '',
    // A small, format-optimised derivative so the grid does not download originals.
    thumbUrl: (a.resource_type === 'image' && a.secure_url)
      ? a.secure_url.replace('/upload/', '/upload/c_fill,w_200,h_200,q_auto,f_auto/')
      : '',
  }));
  return { assets, cursor: (r && r.next_cursor) || '' };
}

// Plan consumption — the numbers that matter on the free tier.
async function usage() {
  if (!configure()) throw new Error('Storage is not configured (set CLOUDINARY_* in server/.env).');
  const u = await cloudinary.api.usage();
  const pick = (v) => (v && typeof v === 'object' ? { usage: v.usage || 0, limit: v.limit || 0 } : { usage: v || 0, limit: 0 });
  return {
    plan: u.plan || '',
    credits: pick(u.credits),
    storage: pick(u.storage),
    bandwidth: pick(u.bandwidth),
    resources: u.resources || 0,
    derivedResources: u.derived_resources || 0,
  };
}

module.exports = { uploadBuffer, deleteByPublicId, status, ping, listFolders, listAssets, usage };
