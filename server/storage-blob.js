// Vercel Blob adapter for the existing public photo/file storage contract.
// The read/write token stays on the server. IDs retain the upload-kind folder.
const blob = require('@vercel/blob');
const sharp = require('sharp');
const { randomUUID } = require('node:crypto');

const configured = () => !!process.env.BLOB_READ_WRITE_TOKEN;
function options(extra = {}) {
  if (!configured()) throw new Error('Vercel Blob is not configured (set BLOB_READ_WRITE_TOKEN).');
  return { token: process.env.BLOB_READ_WRITE_TOKEN, ...extra };
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
function mapFile(file) {
  return { publicId: file.pathname, url: file.url, name: file.pathname.split('/').pop(),
    folder: file.pathname.split('/').slice(0, -1).join('/'), format: file.pathname.split('.').pop(),
    resourceType: resourceType(file.pathname), bytes: file.size || 0,
    createdAt: file.uploadedAt ? new Date(file.uploadedAt).toISOString() : '',
    thumbUrl: resourceType(file.pathname) === 'image' ? file.url : '' };
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
  const result = await blob.put(pathname, buf, options({ access: 'public', addRandomSuffix: false,
    allowOverwrite: false, contentType: ext === 'pdf' ? 'application/pdf' : 'image/' + (ext === 'jpg' ? 'jpeg' : ext) }));
  return { ...mapFile({ ...result, size: buf.length }), ...dimensions, bytes: buf.length };
}
async function getAsset(publicId) {
  if (!isBlobId(publicId)) throw new Error('Invalid Vercel Blob asset.');
  const file = await blob.head(publicId, options());
  if (file.pathname !== publicId) throw new Error('That asset does not belong to this folder.');
  return mapFile(file);
}
async function deleteByPublicId(publicId) {
  try { const asset = await getAsset(publicId); await blob.del(asset.url, options()); return { ok: true }; }
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
module.exports = { uploadBuffer, deleteByPublicId, getAsset, isBlobId, listAssets, listFolders, ping, usage, status };
