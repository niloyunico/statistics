/* Create / reset the first admin account in MongoDB.
   Usage:  set SEED_ADMIN_USER + SEED_ADMIN_PASSWORD in .env, then:  npm run seed
   (Only needed when MONGODB_URI is set — the in-memory dev store auto-seeds.) */
require('dotenv').config();
const auth = require('./auth');
const { getUsers, close, usingMongo } = require('./db');

(async () => {
  if (!usingMongo()) {
    console.log('No MONGODB_URI set — the dev in-memory store already has an admin; nothing to seed.');
    process.exit(0);
  }
  const username = (process.env.SEED_ADMIN_USER || 'admin').toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password) { console.error('Set SEED_ADMIN_PASSWORD in .env first.'); process.exit(1); }
  try {
    const users = await getUsers();
    const passwordHash = await auth.hash(password);
    const existing = await users.findOne({ username });
    if (existing) { await users.updateOne({ username }, { $set: { passwordHash, active: true } }); console.log('Updated admin password for:', username); }
    else { await users.insertOne({ username, name: 'Administrator', role: 'Administrator', passwordHash, active: true, created_at: Date.now() }); console.log('Created admin:', username); }
    await close();
    process.exit(0);
  } catch (e) { console.error('Seed failed:', e.message); await close(); process.exit(1); }
})();
