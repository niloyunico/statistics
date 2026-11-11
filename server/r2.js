/* Cloudflare R2 (S3-compatible) client for BACKUPS — no SDK, AWS SigV4 via node:crypto.
 *
 * Config, first found wins:
 *   1. server/.env / Vercel env: R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET,
 *      R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
 *   2. what an administrator entered in Settings → System & Data → Cloud backup: Mongo
 *      backupConfig {_id:'r2'}, the secret sealed (server/seal.js). load() reads it.
 *
 * Deliberately has NO delete: backups written here can only be added to, never removed by
 * the app (the "never lose saved data" rule — a bug or a stolen admin session cannot wipe
 * the history). Pruning, if ever wanted, is a manual step in the Cloudflare dashboard.
 */
const crypto = require('crypto');

const SEAL = require('./seal').sealer('unico-r2-backup');
const endpointOf = (v) => { const s = String(v || '').trim().replace(/\/+$/, ''); return !s ? '' : /^https:\/\//i.test(s) ? s : 'https://' + s.replace(/[^a-z0-9]/gi, '') + '.r2.cloudflarestorage.com'; };
let stored = null;      // { key, secret, bucket, endpoint, source:'saved', savedAt, savedBy } from the database
let storedAt = 0;
function envCfg() {
  const e = process.env;
  return { key: e.R2_ACCESS_KEY_ID || '', secret: e.R2_SECRET_ACCESS_KEY || '', bucket: e.R2_BUCKET || '', endpoint: String(e.R2_ENDPOINT || '').replace(/\/+$/, ''), source: 'environment' };
}
const complete = (c) => !!(c && c.key && c.secret && c.bucket && c.endpoint);
function cfg() { const e = envCfg(); return complete(e) ? e : (stored || e); }
function configured() { return complete(cfg()); }
function source() { const c = cfg(); return complete(c) ? c.source : ''; }

// Read the administrator's saved settings (kept 60 s per process; `force` re-reads).
async function load(force, dbIn) {
  if (complete(envCfg())) return cfg();
  if (!force && stored && Date.now() - storedAt < 60000) return cfg();
  try {
    let db = dbIn;
    if (!db) { const h = await require('./db').getDbHandle(); db = h && h.db ? h.db : h; }
    const doc = db ? await db.collection('backupConfig').findOne({ _id: 'r2' }) : null;
    stored = doc && doc.secret && doc.keyId ? { key: doc.keyId, secret: SEAL.unseal(doc.secret), bucket: doc.bucket || 'unico-backups', endpoint: endpointOf(doc.endpoint || doc.accountId), source: 'saved', savedAt: doc.savedAt || null, savedBy: doc.savedBy || '' } : null;
  } catch (e) { stored = null; }
  storedAt = Date.now();
  return cfg();
}
// Save the administrator's settings. A blank secret keeps the saved one.
async function save(db, { accountId, endpoint, bucket, keyId, secret }, by) {
  if (!SEAL.hasSecret()) throw new Error('This server has no secret to protect the key with (JWT_SECRET).');
  const doc = (await db.collection('backupConfig').findOne({ _id: 'r2' })) || {};
  const ep = endpointOf(endpoint || accountId || doc.endpoint || doc.accountId);
  if (!ep) throw new Error('Enter the Cloudflare account ID (or the R2 endpoint).');
  if (!String(keyId || doc.keyId || '').trim()) throw new Error('Enter the R2 Access Key ID.');
  if (!secret && !doc.secret) throw new Error('Enter the R2 Secret Access Key.');
  const set = { endpoint: ep, accountId: String(accountId || doc.accountId || '').trim(), bucket: String(bucket || doc.bucket || 'unico-backups').trim(), keyId: String(keyId || doc.keyId).trim(), savedAt: new Date(), savedBy: by || '' };
  if (secret) set.secret = SEAL.seal(String(secret).trim());
  await db.collection('backupConfig').updateOne({ _id: 'r2' }, { $set: set }, { upsert: true });
  await load(true, db);
  return publicConfig();
}
// What may be shown on screen: never the secret.
function publicConfig() {
  const c = cfg();
  return { configured: complete(c), source: complete(c) ? c.source : '', endpoint: c.endpoint || '', bucket: c.bucket || '', keyId: c.key ? c.key.slice(0, 4) + '…' + c.key.slice(-4) : '', savedAt: c.savedAt || null, savedBy: c.savedBy || '' };
}

const sha256hex = (b) => crypto.createHash('sha256').update(b).digest('hex');
const hmac = (k, s) => crypto.createHmac('sha256', k).update(s).digest();
// RFC 3986 encoding as SigV4 requires (encodeURIComponent leaves !'()* unescaped).
const enc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());

async function request(method, key, opts) {
  const o = opts || {};
  const c = cfg();
  if (!configured()) throw new Error('Cloudflare R2 is not set up — an administrator enters the R2 keys in Settings → System & Data → Cloud backup.');
  const host = new URL(c.endpoint).host;
  const path = '/' + enc(c.bucket) + (key ? '/' + String(key).split('/').map(enc).join('/') : '');
  const q = o.query || {};
  const query = Object.keys(q).sort().map((k) => enc(k) + '=' + enc(String(q[k]))).join('&');
  const body = o.body == null ? Buffer.alloc(0) : (Buffer.isBuffer(o.body) ? o.body : Buffer.from(o.body));
  const payloadHash = sha256hex(body);
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const day = amzDate.slice(0, 8);
  const headers = { host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate };
  if (o.contentType) headers['content-type'] = o.contentType;
  Object.assign(headers, o.headers || {});
  const names = Object.keys(headers).map((h) => h.toLowerCase()).sort();
  const lower = {}; Object.keys(headers).forEach((h) => { lower[h.toLowerCase()] = String(headers[h]).trim(); });
  const canonical = [method, path, query, names.map((h) => h + ':' + lower[h] + '\n').join(''), names.join(';'), payloadHash].join('\n');
  const scope = day + '/auto/s3/aws4_request';
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256hex(canonical)].join('\n');
  const signingKey = hmac(hmac(hmac(hmac('AWS4' + c.secret, day), 'auto'), 's3'), 'aws4_request');
  const signature = crypto.createHmac('sha256', signingKey).update(toSign).digest('hex');
  const sendHeaders = Object.assign({}, lower, { authorization: 'AWS4-HMAC-SHA256 Credential=' + c.key + '/' + scope + ', SignedHeaders=' + names.join(';') + ', Signature=' + signature });
  delete sendHeaders.host; // fetch sets Host from the URL (and forbids overriding it)
  const res = await fetch(c.endpoint + path + (query ? '?' + query : ''), { method, headers: sendHeaders, body: (method === 'GET' || method === 'HEAD') ? undefined : body });
  if (!res.ok) {
    const text = method === 'HEAD' ? '' : await res.text().catch(() => '');
    const err = new Error('R2 ' + method + ' ' + (key || '(bucket)') + ' failed: HTTP ' + res.status + (text ? ' ' + text.slice(0, 300) : ''));
    err.status = res.status; throw err;
  }
  return res;
}

// Upload; returns the ETag and the SHA-256 we sent so callers can record it in a manifest.
async function putObject(key, body, contentType, meta) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
  const headers = {};
  Object.keys(meta || {}).forEach((k) => { headers['x-amz-meta-' + k.toLowerCase()] = String(meta[k]); });
  const res = await request('PUT', key, { body: buf, contentType: contentType || 'application/octet-stream', headers });
  return { key, bytes: buf.length, sha256: sha256hex(buf), etag: res.headers.get('etag') };
}
async function getObject(key) { const res = await request('GET', key); return Buffer.from(await res.arrayBuffer()); }
async function headObject(key) {
  try { const res = await request('HEAD', key); return { bytes: Number(res.headers.get('content-length')), etag: res.headers.get('etag') }; }
  catch (e) { if (e.status === 404) return null; throw e; }
}
// One page of keys under a prefix (ListObjectsV2). Returns { objects:[{key,bytes,lastModified}], next }.
async function listPage(prefix, token) {
  const query = { 'list-type': '2', prefix: prefix || '' };
  if (token) query['continuation-token'] = token;
  const xml = await (await request('GET', '', { query })).text();
  const pick = (block, tag) => { const m = block.match(new RegExp('<' + tag + '>([\\s\\S]*?)</' + tag + '>')); return m ? m[1] : null; };
  const unxml = (s) => String(s || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  const objects = (xml.match(/<Contents>[\s\S]*?<\/Contents>/g) || []).map((b) => ({ key: unxml(pick(b, 'Key')), bytes: Number(pick(b, 'Size')), lastModified: pick(b, 'LastModified') }));
  const truncated = pick(xml, 'IsTruncated') === 'true';
  return { objects, next: truncated ? unxml(pick(xml, 'NextContinuationToken')) : null };
}
async function list(prefix, max) {
  const all = []; let token = null;
  do { const page = await listPage(prefix, token); all.push(...page.objects); token = page.next; } while (token && all.length < (max || 100000));
  return all;
}

module.exports = { configured, source, load, save, publicConfig, endpointOf, putObject, getObject, headObject, list, listPage };
