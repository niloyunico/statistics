/* Cloudflare D1 — schema init. Creates every table the app stores in D1 and
   proves the connection works. Idempotent: safe to re-run at any time (every
   statement is CREATE ... IF NOT EXISTS, so existing rows are never touched).

   Run from the server directory:

       node d1-migrate.js

   Then copy any existing MongoDB rows across ONCE with:

       node d1-import.js --verify

   Requires CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_D1_DATABASE_ID / CLOUDFLARE_API_TOKEN
   in server/.env. */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const d1 = require('./d1');
const d1store = require('./d1-store');

const TABLES = ['activity_log', 'supervisor_reports'];

(async () => {
  if (!d1.status().configured) {
    console.error('D1 not configured. Set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID, CLOUDFLARE_API_TOKEN in server/.env');
    process.exit(1);
  }

  await d1store.ensureSchema();
  console.log('Schema applied (' + d1store.SCHEMA.length + ' statements).');

  // A connection + write smoke test that does not touch application data.
  await d1.run('CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT, updated_at INTEGER)');
  await d1.run('INSERT OR REPLACE INTO app_meta (key, value, updated_at) VALUES (?, ?, ?)',
    ['schema', new Date().toISOString(), Date.now()]);

  for (const t of TABLES) {
    const row = await d1.get('SELECT COUNT(*) AS n FROM ' + t);
    console.log('  ' + t.padEnd(20) + (row && row.n != null ? row.n : 0) + ' rows');
  }

  const mods = d1store.activeModules();
  console.log('D1 connected (' + d1.status().database + '). Modules routed to D1: ' + (mods.length ? mods.join(', ') : 'none — set D1_MODULES'));
  process.exit(0);
})().catch((e) => { console.error('D1 init failed: ' + String((e && e.message) || e)); process.exit(1); });
