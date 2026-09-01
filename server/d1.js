/* Cloudflare D1 (serverless SQLite) — connected via the D1 HTTP REST API.
 *
 * D1 has no TCP connection string; it is natively a Cloudflare Workers binding.
 * The only way to reach it from a standalone Node/Express server like this one is
 * Cloudflare's HTTP API:
 *
 *   POST https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/d1/database/{DATABASE_ID}/query
 *   Authorization: Bearer <API_TOKEN>
 *   { "sql": "...", "params": [...] }
 *
 * Configure via server/.env:
 *   CLOUDFLARE_ACCOUNT_ID      — Workers & Pages → right sidebar → Account ID
 *   CLOUDFLARE_D1_DATABASE_ID  — D1 → your database → Database ID
 *   CLOUDFLARE_API_TOKEN       — My Profile → API Tokens → Create Token → D1 → Edit
 *
 * GRACEFUL DEGRADATION: when not configured, every call throws a clear error but
 * the rest of the app is unaffected. status()/ping() report live connectivity.
 */

const CF_ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID;
const CF_DB = process.env.CLOUDFLARE_D1_DATABASE_ID;
const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

function configured() { return !!(CF_ACCOUNT && CF_DB && CF_TOKEN); }

async function rawQuery(sql, params) {
  if (!configured()) throw new Error('Cloudflare D1 is not configured (set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID, CLOUDFLARE_API_TOKEN in server/.env).');
  const url = 'https://api.cloudflare.com/client/v4/accounts/' + encodeURIComponent(CF_ACCOUNT) + '/d1/database/' + encodeURIComponent(CF_DB) + '/query';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + CF_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql, params: params || [] }),
  });
  let body;
  try { body = await res.json(); } catch (e) { body = null; }
  if (!res.ok || !(body && body.success)) {
    const errs = (body && body.errors && body.errors.length)
      ? body.errors.map((e) => (e && e.message) || String(e)).join('; ')
      : (res.status + ' ' + (res.statusText || ''));
    throw new Error('D1 query failed: ' + errs);
  }
  return body.result && body.result[0];
}

// SELECT rows -> array of objects ([] when no rows).
async function query(sql, params) {
  const r = await rawQuery(sql, params);
  return (r && r.results) || [];
}

// First row or null.
async function get(sql, params) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

// Non-SELECT statement -> { success, meta }.
async function run(sql, params) {
  const r = await rawQuery(sql, params);
  return { success: !!(r && r.success), meta: (r && r.meta) || {} };
}

// Live connectivity check (a real SELECT 1 round-trip).
async function ping() {
  if (!configured()) return { ok: false, error: 'not configured' };
  try { await query('SELECT 1 AS ok'); return { ok: true }; }
  catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
}

function status() {
  return {
    provider: 'cloudflare-d1',
    configured: configured(),
    account: CF_ACCOUNT ? (CF_ACCOUNT.slice(0, 8) + '…') : '',
    database: CF_DB || '',
  };
}

module.exports = { configured, query, get, run, ping, status };
