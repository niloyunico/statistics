const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const express = require('express');
const sharp = require('sharp');

(async () => {
  const image = await sharp({ create: { width: 32, height: 20, channels: 3, background: '#2388aa' } }).avif().toBuffer();
  const pathname = 'unico/staff/blob_1234-abcd.avif';
  let reads = 0, active = true;
  const privateStore = {
    isBlobId: require('../storage-blob').isBlobId,
    readCachedAsset: async () => { reads++; return { data:image,contentType:'image/avif',etag:'"test-image"' }; },
  };
  const deps = { './storage': {}, './activity-log': {}, './access': { forRequest: async () => active ? {} : null }, './db': {}, './cache': {}, './storage-blob': privateStore };
  const context = { module: { exports: {} }, Buffer, require: name => deps[name] || require(name) };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../photos.js'), 'utf8'), context);
  const app = express();
  context.module.exports.mount(app, { requireApi: (req, res, next) => { req.user = req.headers['x-test-login'] ? { sub: 'test' } : null; next(); } });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const url = 'http://127.0.0.1:' + server.address().port + '/api/media/file?pathname=' + encodeURIComponent(pathname);
  try {
    const denied = await fetch(url);
    assert.equal(denied.status, 401);
    assert.equal(reads, 0, 'logged-out requests never read storage');
    const allowed = await fetch(url, { headers: { 'x-test-login': '1' } });
    assert.equal(allowed.status, 200);
    assert.equal(allowed.headers.get('content-type'), 'image/avif');
    assert.equal(allowed.headers.get('cache-control'), 'private, no-cache, must-revalidate');
    assert.equal(allowed.headers.get('location'), null, 'never redirect to a Blob URL');
    assert.deepEqual(Buffer.from(await allowed.arrayBuffer()), image, 'the preview receives decodable AVIF bytes');
    const etag=allowed.headers.get('etag');
    const repeated=await fetch(url,{headers:{'x-test-login':'1','if-none-match':etag}});
    assert.equal(repeated.status,304,'unchanged authenticated images send no body');
    assert.equal((await repeated.arrayBuffer()).byteLength,0);
    const loggedOutCached=await fetch(url,{headers:{'if-none-match':etag}});
    assert.equal(loggedOutCached.status,401,'cached images still require login');
    active = false;
    assert.equal((await fetch(url, { headers: { 'x-test-login': '1' } })).status, 401, 'revoked accounts cannot read images');
    active = true;
    assert.equal((await fetch(url.replace(encodeURIComponent(pathname), encodeURIComponent('../secret')), { headers: { 'x-test-login': '1' } })).status, 400);
    assert.equal(reads, 2);
    console.log('Private AVIF delivery, login/revocation guards and authenticated cache revalidation checks passed.');
  } finally { await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
