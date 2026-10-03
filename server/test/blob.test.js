const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const sharp = require('sharp');

(async () => {
  const calls = [], files = new Map();
  const sdk = {
    async put(pathname, buf, opts) {
      calls.push({ pathname, opts, buf });
      const file = { pathname, url: 'https://test.public.blob.vercel-storage.com/' + pathname, size: buf.length, uploadedAt: new Date() };
      files.set(pathname, file); return file;
    },
    async head(id) { if (!files.has(id)) throw new Error('Not found'); return files.get(id); },
    async del(url) { for (const [id, file] of files) if (file.url === url || id === url) files.delete(id); },
    async list(opts) {
      const rows = [...files.values()].filter(f => f.pathname.startsWith(opts.prefix || ''));
      const offset = Number(opts.cursor || 0), end = offset + opts.limit;
      return { blobs: rows.slice(offset, end), hasMore: end < rows.length, cursor: String(end) };
    },
  };
  const env = { PRIVATE_READ_WRITE_TOKEN: 'test-secret' };
  const context = { module: { exports: {} }, Buffer, process: { env }, require: name => name === '@vercel/blob' ? sdk : require(name) };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../storage-blob.js'), 'utf8'), context);
  const storage = context.module.exports;
  const png = await sharp({ create: { width: 120, height: 80, channels: 4, background: { r: 32, g: 120, b: 240, alpha: 0.5 } } }).png().toBuffer();
  const up = await storage.uploadBuffer(png, { folder: 'unico/staff' });
  assert.ok(storage.isBlobId(up.publicId));
  assert.ok(up.publicId.startsWith('unico/staff/'));
  assert.ok(up.url.startsWith('/api/media/file?pathname='), 'images use the authenticated same-origin route');
  assert.equal(up.format, 'avif');
  assert.equal(up.width, 120);
  assert.equal(up.height, 80);
  assert.equal(up.bytes, calls[0].buf.length, 'report stored AVIF bytes, not source bytes');
  const encoded = await sharp(calls[0].buf).metadata();
  assert.equal(encoded.compression, 'av1', 'the uploaded data must really be AVIF');
  assert.equal(encoded.hasAlpha, true, 'preserve transparent PNG pixels');
  assert.equal(calls[0].opts.access, 'private');
  assert.equal(calls[0].opts.allowOverwrite, false);
  assert.equal(calls[0].opts.contentType, 'image/avif');
  assert.equal((await storage.getAsset(up.publicId)).url, up.url);
  await assert.rejects(storage.uploadBuffer(Buffer.from('RIFFnot-an-image')), /Unsupported/);
  await assert.rejects(storage.uploadBuffer(png, { folder: '../staff' }), /Invalid storage folder/);
  assert.equal((await storage.deleteByPublicId('https://example.com/file.png')).ok, false);
  assert.equal((await storage.deleteByPublicId(up.publicId.replace('/staff/', '/profiles/'))).ok, false);
  assert.equal(files.size, 1, 'a forged folder cannot delete the original');
  const pdf = await storage.uploadBuffer(Buffer.from('%PDF-1.7'), { folder: 'unico/files' });
  const page = await storage.listAssets({ folder: 'unico/staff', resourceType: 'image', limit: 1 });
  assert.equal(page.assets[0].publicId, up.publicId);
  assert.equal(page.cursor, '');
  assert.equal((await storage.listFolders('unico')).map(f => f.name).join(','), 'files,staff');
  assert.equal((await storage.usage()).resources, 2);
  assert.equal((await storage.deleteByPublicId(up.publicId)).ok, true);
  assert.ok(files.has(pdf.publicId));
  assert.equal(calls[1].opts.contentType, 'application/pdf');
  assert.equal(calls[1].buf.toString(), '%PDF-1.7', 'documents remain byte-identical');
  await assert.rejects(storage.uploadBuffer(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), /corrupt|invalid|end of/i);
  // Exercise real JPEG/WebP/GIF/AVIF codecs, EXIF rotation and AVIF library/deletion.
  const baseImage = () => sharp({ create: { width: 160, height: 80, channels: 3, background: '#3878c8' } });
  const jpeg = await baseImage().withMetadata({ orientation: 6 }).jpeg().toBuffer();
  for (const input of [jpeg, await baseImage().webp().toBuffer(), await baseImage().gif().toBuffer(), calls[0].buf]) {
    const converted = await storage.uploadBuffer(input, { folder: 'unico/staff' });
    const sent = calls.at(-1);
    const metadata = await sharp(sent.buf).metadata();
    assert.equal(metadata.compression, 'av1');
    assert.equal(converted.format, 'avif');
    assert.equal(metadata.orientation, undefined, 'strip unnecessary EXIF metadata');
    if (input === jpeg) { assert.equal(metadata.width, 80); assert.equal(metadata.height, 160); }
    assert.ok((await storage.listAssets({ folder: 'unico/staff', resourceType: 'image' })).assets.some(a => a.publicId === converted.publicId), 'AVIF appears in the image library');
    assert.equal((await storage.deleteByPublicId(converted.publicId)).ok, true);
  }
  delete env.PRIVATE_READ_WRITE_TOKEN;
  assert.equal(storage.status().configured, false);
  assert.equal((await storage.ping()).ok, false);
  await assert.rejects(storage.uploadBuffer(png), /not configured/);
  console.log('Vercel Blob upload, browsing, deletion and configuration tests passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
