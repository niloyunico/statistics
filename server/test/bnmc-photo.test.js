/* BNMC portraits cached in our database (server/bnmc-verify.js portrait()).
   A staff record without a photo of ours shows its BNMC portrait, so a directory may ask for
   dozens: each must be fetched from BNMC once and then come from bnmcPhotos.
   Needs MongoDB on this computer; skipped without it.   Run: node test/bnmc-photo.test.js */
const assert = require('assert');
const { MongoClient } = require('mongodb');

const DB_NAME = 'bnmcphototest_' + Date.now().toString(36);
for (const k of Object.keys(process.env)) if (/^(MONGODB_|REDIS|UPSTASH)/.test(k)) delete process.env[k];
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017';
process.env.DB_NAME = DB_NAME;
process.env.CACHE_DISABLED = 'true';

(async () => {
  let client;
  try { client = await MongoClient.connect('mongodb://127.0.0.1:27017', { serverSelectionTimeoutMS: 2500 }); }
  catch (e) { console.log('  --  MongoDB is not running on this computer: skipped.'); return; }
  const bnmc = require('../bnmc-verify');
  let calls = 0;
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
  const fake = (type) => async () => { calls++; return { ok: true, headers: { get: () => type }, arrayBuffer: async () => jpeg }; };
  const url = 'http://bncdb.bnmc.gov.bd/media/media/36145.jpg';
  try {
    const first = await bnmc.portrait(url, { fetch: fake('image/jpeg') });
    assert.deepStrictEqual([first.type, first.data.equals(jpeg), calls], ['image/jpeg', true, 1]);
    const second = await bnmc.portrait(url, { fetch: fake('image/jpeg') });
    assert.deepStrictEqual([second.data.equals(jpeg), calls], [true, 1], 'the second view comes from our database, not BNMC');
    const kept = await client.db(DB_NAME).collection('bnmcPhotos').findOne({ _id: url });
    assert.ok(kept && kept.type === 'image/jpeg');
    console.log('  ok  a BNMC portrait is fetched once, kept in bnmcPhotos, then served from there');
    await assert.rejects(bnmc.portrait('http://bncdb.bnmc.gov.bd/media/media/other.jpg', { fetch: fake('text/html') }), (e) => e.status === 415);
    assert.strictEqual(await client.db(DB_NAME).collection('bnmcPhotos').countDocuments({ _id: /other/ }), 0);
    console.log('  ok  a page that is not an image is refused and not kept');

    // Live: kept in Vercel Blob (a stand-in store here).
    const files = new Map();
    let uploads = 0, reads = 0;
    const blob = {
      uploadBuffer: async (buf, o) => { uploads++; const p = o.folder + '/blob_' + uploads + 'aaaa.avif'; files.set(p, buf); return { publicId: p, url: '/api/media/file?pathname=' + p }; },
      readCachedAsset: async (p) => { reads++; return files.has(p) ? { data: files.get(p), contentType: 'image/avif' } : null; },
    };
    calls = 0;
    const b1 = 'http://bncdb.bnmc.gov.bd/media/media/blob-1.jpg';
    await bnmc.portrait(b1, { fetch: fake('image/jpeg'), blob });
    assert.deepStrictEqual([calls, uploads], [1, 1]);
    const kept1 = await client.db(DB_NAME).collection('bnmcPhotos').findOne({ _id: b1 });
    assert.ok(kept1.pathname && kept1.pathname.startsWith('unico/bnmc/') && !kept1.data, 'the map holds the Blob file, not the bytes');
    const again = await bnmc.portrait(b1, { fetch: fake('image/jpeg'), blob });
    assert.deepStrictEqual([calls, uploads, reads, again.data.equals(jpeg)], [1, 1, 1, true], 'the second view comes from Blob, BNMC is not asked');
    console.log('  ok  live: the portrait is fetched from BNMC once, kept in Vercel Blob, then served from Blob');
    // A portrait kept as bytes earlier (no Blob then) moves to Blob on its next view, without asking BNMC.
    const moved = await bnmc.portrait(url, { fetch: fake('image/jpeg'), blob });
    const kept2 = await client.db(DB_NAME).collection('bnmcPhotos').findOne({ _id: url });
    assert.deepStrictEqual([calls, uploads, moved.data.equals(jpeg), Boolean(kept2.pathname), kept2.data === undefined], [1, 2, true, true, true]);
    console.log('  ok  a portrait kept as bytes before moves to Blob without a BNMC request');
    console.log('\n4 passed');
  } finally {
    await client.db(DB_NAME).dropDatabase().catch(() => {});
    await client.close();
    process.exit(0);
  }
})().catch((e) => { console.error(e); process.exit(1); });
