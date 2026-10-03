// Private Vercel Blob storage. Browser URLs point to the authenticated app route.
// The read/write token stays on the server. IDs retain the upload-kind folder.
const blob = require('@vercel/blob');
const sharp = require('sharp');
const { randomUUID, createHash } = require('node:crypto');
const mediaCache = new Map(), pendingReads = new Map();
const CACHE_TTL = 10 * 60 * 1000, CACHE_BYTES = 16 * 1024 * 1024;
let cachedBytes = 0, cacheEpoch = 0;
function evict(pathname) {
  const entry = mediaCache.get(pathname);
  if (entry) { cachedBytes -= entry.data.length; mediaCache.delete(pathname); }
}
function remember(pathname, data, contentType) {
  const entry = { data, contentType, etag: '"' + createHash('sha256').update(data).digest('hex') + '"', expires: Date.now() + CACHE_TTL };
  evict(pathname);
  if (data.length <= 2 * 1024 * 1024) {
    while (mediaCache.size && (cachedBytes + data.length > CACHE_BYTES || mediaCache.size >= 512)) evict(mediaCache.keys().next().value);
    mediaCache.set(pathname, entry); cachedBytes += data.length;
  }
  return entry;
}

const configured = () => !!process.env.PRIVATE_READ_WRITE_TOKEN;
function options(extra = {}) {
  if (!configured()) throw new Error('Private Vercel Blob is not configured (set PRIVATE_READ_WRITE_TOKEN).');
  return { token: process.env.PRIVATE_READ_WRITE_TOKEN, ...extra };
}
function folderOf(value) {
  const parts = String(value || '').replace(/^\/+|\/+$/g, '').split('/');
  if (parts.some(p => p === '.' || p === '..' || (p && !/^[A-Za-z0-9_-]+$/.test(p)))) throw new Error('Invalid storage folder.');
  return parts.filter(Boolean).join('/');
}
function isBlobId(value) {
  return /^(?:[A-Za-z0-9_-]+\/)+blob_[a-f0-9-]+\.(jpg|png|webp|gif|avif|pdf)$/.test(String(value || ''));
}
function resourceType(path) { return /\.(jpg|jpeg|png|webp|gif|avif)$/i.test(path) ? 'image' : 'raw'; }
function appUrl(pathname) { return '/api/media/file?pathname=' + encodeURIComponent(pathname); }
function mapFile(file) {
  return { publicId: file.pathname, url: appUrl(file.pathname), name: file.pathname.split('/').pop(),
    folder: file.pathname.split('/').slice(0, -1).join('/'), format: file.pathname.split('.').pop(),
    resourceType: resourceType(file.pathname), bytes: file.size || 0,
    createdAt: file.uploadedAt ? new Date(file.uploadedAt).toISOString() : '',
    thumbUrl: resourceType(file.pathname) === 'image' ? appUrl(file.pathname) : '' };
}
async function uploadBuffer(buf, opts = {}) {
  if (!Buffer.isBuffer(buf) || !buf.length) throw new Error('Empty upload.');
  options(); // Fail before decoding/encoding when storage is not configured.
  const folder = folderOf(opts.folder || 'unico');
  let ext = buf[0] === 0xff && buf[1] === 0xd8 ? 'jpg' :
    buf.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? 'png' :
    buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP' ? 'webp' :
    /^GIF8[79]a$/.test(buf.subarray(0, 6).toString()) ? 'gif' :
    buf.subarray(0, 5).toString() === '%PDF-' ? 'pdf' :
    buf.subarray(4, 8).toString() === 'ftyp' && /avif|avis/.test(buf.subarray(8, 32).toString()) ? 'avif' : null;
  if (!ext) throw new Error('Unsupported image or file format.');
  let dimensions = {};
  if (ext !== 'pdf') {
    const image = sharp(buf, { limitInputPixels: 25000000 });
    const meta = await image.metadata();
    // AVIF sequences are not supported by sharp. Keep animations intact.
    if (!(meta.pages > 1)) {
      const encoded = await image.rotate().avif({ quality: 55, effort: 4 }).toBuffer({ resolveWithObject: true });
      buf = encoded.data;
      ext = 'avif';
      dimensions = { width: encoded.info.width, height: encoded.info.height };
    } else dimensions = { width: meta.width, height: meta.pageHeight || meta.height };
  }
  const pathname = folder + '/blob_' + randomUUID() + '.' + ext;
  const result = await blob.put(pathname, buf, options({ access: 'private', addRandomSuffix: false,
    allowOverwrite: false, contentType: ext === 'pdf' ? 'application/pdf' : 'image/' + (ext === 'jpg' ? 'jpeg' : ext) }));
  // The upload already has the encoded bytes, so its first preview needs no Blob read.
  remember(pathname, buf, ext === 'pdf' ? 'application/pdf' : 'image/' + (ext === 'jpg' ? 'jpeg' : ext));
  return { ...mapFile({ ...result, size: buf.length }), ...dimensions, bytes: buf.length };
}
async function getAsset(publicId) {
  if (!isBlobId(publicId)) throw new Error('Invalid Vercel Blob asset.');
  const file = await blob.head(publicId, options());
  if (file.pathname !== publicId) throw new Error('That asset does not belong to this folder.');
  return mapFile(file);
}
async function deleteByPublicId(publicId) {
  try { await getAsset(publicId); await blob.del(publicId, options()); cacheEpoch++; evict(publicId); return { ok: true }; }
  catch (e) { return { ok: false, error: String(e.message || e) }; }
}
async function listAssets(opts = {}) {
  const folder = folderOf(opts.folder);
  const page = await blob.list(options({ prefix: folder ? folder + '/' : 'unico/',
    limit: Math.min(100, Math.max(1, parseInt(opts.limit, 10) || 30)), ...(opts.cursor ? { cursor: String(opts.cursor) } : {}) }));
  const assets = page.blobs.filter(f => isBlobId(f.pathname)).map(mapFile)
    .filter(f => !opts.resourceType || f.resourceType === opts.resourceType);
  return { assets, cursor: page.hasMore ? page.cursor : '' };
}
async function scan(prefix, visit) {
  let cursor;
  for (let i = 0; i < 100; i++) {
    const page = await blob.list(options({ prefix, limit: 1000, ...(cursor ? { cursor } : {}) }));
    page.blobs.forEach(visit);
    if (!page.hasMore) return;
    cursor = page.cursor;
  }
  throw new Error('Storage listing is too large; narrow the folder.');
}
async function listFolders(path) {
  const folder = folderOf(path), prefix = folder ? folder + '/' : '';
  const folders = new Map();
  await scan(prefix, file => {
    const rest = file.pathname.slice(prefix.length);
    if (rest.includes('/')) { const name = rest.split('/')[0]; folders.set(name, { name, path: prefix + name }); }
  });
  return [...folders.values()].sort((a, b) => a.name.localeCompare(b.name));
}
async function ping() {
  try { await blob.list(options({ limit: 1 })); return { ok: true }; }
  catch (e) { return { ok: false, error: String(e.message || e) }; }
}
async function usage() {
  let bytes = 0, resources = 0;
  await scan('unico/', file => { bytes += file.size || 0; resources++; });
  return { plan: 'Vercel Blob', storage: { usage: bytes, limit: 0 }, resources };
}
function status() { return { provider: 'vercel-blob', configured: configured(), cloudName: 'Vercel Blob' }; }
async function readAsset(pathname) {
  if (!isBlobId(pathname) || !pathname.startsWith('unico/')) throw new Error('Invalid Vercel Blob asset.');
  return blob.get(pathname, options({ access: 'private', useCache: true }));
}
async function readCachedAsset(pathname) {
  options();
  if (!isBlobId(pathname) || !pathname.startsWith('unico/')) throw new Error('Invalid Vercel Blob asset.');
  const cached = mediaCache.get(pathname);
  if (cached && cached.expires > Date.now()) {
    mediaCache.delete(pathname); mediaCache.set(pathname, cached);
    return cached;
  }
  evict(pathname);
  if (pendingReads.has(pathname)) return pendingReads.get(pathname);
  const epoch = cacheEpoch;
  const pending = (async () => {
    const result = await readAsset(pathname);
    if (!result || result.statusCode !== 200) return null;
    const chunks = [];
    for await (const chunk of require('node:stream').Readable.fromWeb(result.stream)) chunks.push(chunk);
    const data = Buffer.concat(chunks);
    if (epoch !== cacheEpoch) return { data, contentType: result.blob.contentType, etag: '"' + createHash('sha256').update(data).digest('hex') + '"' };
    return remember(pathname, data, result.blob.contentType);
  })();
  pendingReads.set(pathname, pending);
  try { return await pending; } finally { pendingReads.delete(pathname); }
}
module.exports = { uploadBuffer, deleteByPublicId, getAsset, isBlobId, listAssets, listFolders, ping, usage, status, readAsset, readCachedAsset, appUrl };
