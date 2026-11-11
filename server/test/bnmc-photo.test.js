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
    console.log('\n2 passed');
  } finally {
    await client.db(DB_NAME).dropDatabase().catch(() => {});
    await client.close();
    process.exit(0);
  }
})().catch((e) => { console.error(e); process.exit(1); });
