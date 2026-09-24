/* ImageKit adapter. Credentials stay server-side; the existing photo contract
 * remains {url, publicId}. The folder-prefixed id preserves route permissions. */
const ImageKit = require('@imagekit/nodejs');
const { randomUUID } = require('node:crypto');

function client() {
  if (!process.env.IMAGEKIT_PRIVATE_KEY) throw new Error('ImageKit is not configured.');
  return new ImageKit({ privateKey: process.env.IMAGEKIT_PRIVATE_KEY, timeout: 20000, maxRetries: 1 });
}
function folderOf(path) { return String(path || '').replace(/^\/+|\/+$/g, ''); }
function publicIdOf(file) {
  const path = folderOf(file.filePath);
  const folder = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
  return (folder ? folder + '/' : '') + 'imagekit_' + file.fileId;
}
function isImageKitId(id) { return /(?:^|\/)imagekit_[a-zA-Z0-9_-]+$/.test(String(id || '')); }
function mapFile(file) {
  return { publicId: publicIdOf(file), url: file.url, name: file.name,
    format: String(file.name || '').split('.').pop(),
    folder: folderOf(file.filePath).split('/').slice(0, -1).join('/'),
    resourceType: file.fileType === 'image' ? 'image' : (/\.(mp4|webm|mov)$/i.test(file.name || '') ? 'video' : 'raw'),
    bytes: file.size || 0, width: file.width, height: file.height,
    createdAt: file.createdAt || '', thumbUrl: file.thumbnailUrl || file.thumbnail || file.url };
}
async function uploadBuffer(buf, opts = {}) {
  if (!buf || !buf.length) throw new Error('Empty upload.');
  const folder = String(opts.folder || 'unico').replace(/[^A-Za-z0-9_/-]/g, '');
  const ext = buf[0] === 0xff && buf[1] === 0xd8 ? 'jpg' :
    buf.subarray(0, 4).equals(Buffer.from([137,80,78,71])) ? 'png' :
    buf.subarray(0, 4).toString() === 'RIFF' ? 'webp' :
    buf.subarray(0, 3).toString() === 'GIF' ? 'gif' :
    buf.subarray(0, 4).toString() === '%PDF' ? 'pdf' : null;
  if (!ext) throw new Error('Unsupported image or file format.');
  const fileName = randomUUID() + '.' + ext;
  const result = await client().files.upload({ file: await ImageKit.toFile(buf, fileName),
    fileName, folder: '/' + folder, useUniqueFileName: true });
  return mapFile(result);
}
async function getAsset(publicId) {
  if (!isImageKitId(publicId)) throw new Error('Invalid ImageKit asset.');
  const fileId = publicId.slice(publicId.lastIndexOf('imagekit_') + 9);
  const file = await client().files.get(fileId);
  // Do not trust a caller-supplied folder prefix to authorize another folder's file.
  if (publicIdOf(file) !== publicId) throw new Error('Asset does not belong to that folder.');
  return mapFile(file);
}
async function deleteByPublicId(publicId) {
  try {
    await getAsset(publicId);
    await client().files.delete(publicId.slice(publicId.lastIndexOf('imagekit_') + 9));
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message || 'ImageKit delete failed.' }; }
}
async function listFolders(path) {
  const rows = await client().assets.list({ type: 'folder', path: '/' + folderOf(path), limit: 100 });
  return rows.map(r => ({ name: r.name, path: folderOf(r.folderPath) }));
}
async function listAssets(opts = {}) {
  const limit = Math.min(100, Math.max(1, parseInt(opts.limit, 10) || 30));
  const skip = Math.max(0, parseInt(opts.cursor, 10) || 0);
  const rows = await client().assets.list({ type: 'file', path: '/' + folderOf(opts.folder),
    fileType: opts.resourceType === 'image' ? 'image' : opts.resourceType ? 'non-image' : 'all',
    limit, skip, sort: 'DESC_CREATED' });
  const assets = rows.map(mapFile).filter(a => !opts.resourceType || a.resourceType === opts.resourceType);
  return { assets, cursor: rows.length === limit ? String(skip + rows.length) : '' };
}
async function ping() {
  try { await client().assets.list({ limit: 1, type: 'file' }); return { ok: true }; }
  catch (e) { return { ok: false, error: e.message || 'ImageKit connection failed.' }; }
}
async function usage() {
  const now = new Date(), end = new Date(now.getTime() + 86400000);
  const startDate = now.toISOString().slice(0, 7) + '-01';
  const u = await client().accounts.usage.get({ startDate, endDate: end.toISOString().slice(0,10) });
  return { plan: 'ImageKit', storage: { usage: u.mediaLibraryStorageBytes || 0 },
    bandwidth: { usage: u.bandwidthBytes || 0 }, resources: null };
}
module.exports = { uploadBuffer, deleteByPublicId, listFolders, listAssets, ping, usage, getAsset, isImageKitId };
