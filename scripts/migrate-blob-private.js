// Run copy first, rewrite after deploying the authenticated route, then remove-public.
// Tokens remain in ignored local environment files; backups remain under scripts/backups.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const dotenv = require('../server/node_modules/dotenv');
const blob = require('../server/node_modules/@vercel/blob');
const { MongoClient } = require('../server/node_modules/mongodb');
const root = path.resolve(__dirname, '..');
const env = name => dotenv.parse(fs.readFileSync(path.join(root, name)));
const publicToken = env('.env.local').BLOB_READ_WRITE_TOKEN;
const privateToken = env('.vercel/blob-private.env').PRIVATE_READ_WRITE_TOKEN;
const dbEnv = env('server/.env');
const backupDir = path.join(__dirname, 'backups');
const manifestPath = path.join(backupDir, 'blob-private-manifest.json');
const hash = buf => crypto.createHash('sha256').update(buf).digest('hex');
const appUrl = pathname => '/api/media/file?pathname=' + encodeURIComponent(pathname);
async function main() {
  const mode = process.argv[2];
  if (!['copy', 'rewrite', 'remove-public'].includes(mode)) throw new Error('Use copy, rewrite, or remove-public.');
  fs.mkdirSync(backupDir, { recursive: true });
  if (mode === 'copy') {
    const files = [];
    let cursor;
    do {
      const page = await blob.list({ token: publicToken, prefix: 'unico/', limit: 1000, cursor });
      for (const file of page.blobs) {
        const response = await fetch(file.url);
        if (!response.ok) throw new Error('Cannot read source upload.');
        const bytes = Buffer.from(await response.arrayBuffer());
        await blob.put(file.pathname, bytes, { token: privateToken, access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: response.headers.get('content-type') || 'application/octet-stream' });
        const copy = await blob.get(file.pathname, { token: privateToken, access: 'private', useCache: false });
        if (!copy || copy.statusCode !== 200 || hash(Buffer.from(await new Response(copy.stream).arrayBuffer())) !== hash(bytes)) throw new Error('Private copy verification failed.');
        files.push({ pathname: file.pathname, publicUrl: file.url, appUrl: appUrl(file.pathname), sha256: hash(bytes) });
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    fs.writeFileSync(manifestPath, JSON.stringify({ files, verified: true, rewritten: false }, null, 2));
    console.log(JSON.stringify({ verifiedPrivateCopies: files.length }));
    return;
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath));
  if (!manifest.verified) throw new Error('Copy verification is required.');
  if (mode === 'rewrite') {
    require('node:dns').setServers(['8.8.8.8', '1.1.1.1']);
    const client = new MongoClient(dbEnv.MONGODB_URI);
    let updated = 0;
    try {
      await client.connect();
      const db = client.db(dbEnv.DB_NAME || 'unico');
      for (const name of ['staff', 'users', 'appdata', 'departments', 'quality']) {
        for await (const doc of db.collection(name).find({})) {
          const changed = {}, previous = {};
          const visit = (value, field) => {
            if (typeof value === 'string') {
              let next = value;
              for (const file of manifest.files) next = next.split(file.publicUrl).join(file.appUrl);
              if (next !== value) { changed[field] = next; previous[field] = value; }
            } else if (value && (Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype)) {
              Object.entries(value).forEach(([key, item]) => { if (key !== '_id') visit(item, field ? field + '.' + key : key); });
            }
          };
          visit(doc, '');
          if (!Object.keys(changed).length) continue;
          fs.appendFileSync(path.join(backupDir, 'blob-private-references.ndjson'), JSON.stringify({ collection: name, id: doc._id, previous }) + '\n');
          const result = await db.collection(name).updateOne({ _id: doc._id, ...previous }, { $set: changed });
          if (result.matchedCount !== 1) throw new Error('A record changed concurrently; retry migration before removing public files.');
          updated++;
        }
      }
      await db.collection('cacheMeta').updateOne({ _id: 'versions' }, { $inc: { staff: 1, users: 1, appdata: 1, departments: 1, quality: 1 } }, { upsert: true });
      manifest.rewritten = true;
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      console.log(JSON.stringify({ updatedDocuments: updated }));
    } finally { await client.close(); }
  } else {
    if (!manifest.rewritten) throw new Error('Reference migration is required before removing public copies.');
    for (const file of manifest.files) {
      const copy = await blob.get(file.pathname, { token: privateToken, access: 'private', useCache: false });
      if (!copy || copy.statusCode !== 200 || hash(Buffer.from(await new Response(copy.stream).arrayBuffer())) !== file.sha256) throw new Error('Private copy verification failed.');
      await blob.del(file.publicUrl, { token: publicToken });
    }
    console.log(JSON.stringify({ publicCopiesRemoved: manifest.files.length }));
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
