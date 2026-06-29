/* One-command setup. Asks for your MongoDB connection string + an admin password,
   TESTS the connection, creates the admin user, and writes server/.env for you.
   Run:  npm --prefix server run setup
   (You still need to get the string from Atlas -> Connect -> Drivers, and rotate
   any password you shared. The string is saved only in server/.env, never in the app.) */
require('dotenv').config();
// Work around ISP/router DNS that can't do mongodb+srv:// SRV lookups.
try { require('dns').setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']); } catch (e) { /* ignore */ }
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((res) => rl.question(q, (a) => res((a || '').trim())));

(async () => {
  console.log('\n=== UNICO server setup ===\n');
  console.log('1) In Atlas: Cluster0 -> Connect -> Drivers -> copy the connection string.');
  console.log('   It looks like:  mongodb+srv://USER:PASSWORD@cluster0.xxxx.mongodb.net/...');
  console.log('   Replace <db_password> with your REAL (rotated) password.\n');

  let uri = await ask('Paste MONGODB_URI: ');
  if (!/^mongodb(\+srv)?:\/\//.test(uri)) { console.error('\n✗ That does not look like a MongoDB connection string. Run setup again.'); rl.close(); process.exit(1); }
  if (/<[^>]+>/.test(uri)) { console.error('\n✗ Your string still has a placeholder like <db_password>. Replace it with the real password, then run setup again.'); rl.close(); process.exit(1); }

  let pass = await ask('Choose an admin login password (min 4 chars): ');
  while (!pass || pass.length < 4) { pass = await ask('  Please enter at least 4 characters: '); }

  const user = (process.env.SEED_ADMIN_USER || 'admin').toLowerCase();
  const dbName = process.env.DB_NAME || 'unico';

  console.log('\nTesting the connection to MongoDB...');
  let client;
  try {
    client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
    await client.connect();
    await client.db(dbName).command({ ping: 1 });
    console.log('✓ Connected to MongoDB.');
  } catch (e) {
    console.error('\n✗ Could NOT connect: ' + (e.message || e));
    console.error('   Most common causes:');
    console.error('     - wrong password in the connection string');
    console.error('     - your IP is not allowed:  Atlas -> Network Access -> Add IP Address -> "Allow from anywhere"');
    if (client) { try { await client.close(); } catch (_) { } }
    rl.close(); process.exit(1);
  }

  try {
    const users = client.db(dbName).collection('users');
    try { await users.createIndex({ username: 1 }, { unique: true }); } catch (_) { }
    const hash = await bcrypt.hash(pass, 10);
    const existing = await users.findOne({ username: user });
    if (existing) { await users.updateOne({ username: user }, { $set: { passwordHash: hash, active: true } }); console.log(`✓ Updated admin user "${user}".`); }
    else { await users.insertOne({ username: user, name: 'Administrator', role: 'Administrator', passwordHash: hash, active: true, created_at: Date.now() }); console.log(`✓ Created admin user "${user}" in ${dbName}.users.`); }
  } catch (e) { console.error('✗ Failed to create the admin user: ' + e.message); }
  try { await client.close(); } catch (_) { }

  // write server/.env (preserving other keys)
  const envPath = path.join(__dirname, '.env');
  let env = '';
  try { env = fs.readFileSync(envPath, 'utf8'); } catch (_) { }
  const setKey = (k, v) => { const re = new RegExp('^\\s*' + k + '=.*$', 'm'); if (re.test(env)) env = env.replace(re, k + '=' + v); else env += (env.endsWith('\n') ? '' : '\n') + k + '=' + v + '\n'; };
  setKey('MONGODB_URI', uri);
  setKey('SEED_ADMIN_PASSWORD', pass);
  if (!/^\s*JWT_SECRET=.+/m.test(env)) setKey('JWT_SECRET', crypto.randomBytes(48).toString('hex'));
  if (!/^\s*DB_NAME=.+/m.test(env)) setKey('DB_NAME', dbName);
  if (!/^\s*SEED_ADMIN_USER=.+/m.test(env)) setKey('SEED_ADMIN_USER', user);
  fs.writeFileSync(envPath, env, 'utf8');
  console.log('✓ Saved server/.env');

  console.log('\n=== Done! Refresh Atlas — the "' + dbName + '" database now exists. ===');
  console.log('\nNext:');
  console.log('  1) Start the server:        npm --prefix server start');
  console.log('  2) In the app, sign in as:  ' + user + '  (the password you just set)');
  console.log('  3) Signing in uploads your app data -> an "appdata" collection appears, Data Size > 0.\n');
  rl.close();
  process.exit(0);
})();
