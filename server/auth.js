/* Password hashing + login-token signing. Kept separate so it can be unit-tested
   without a database. */
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const SECRET = () => process.env.JWT_SECRET || 'dev-secret-change-me';

function hash(password) { return bcrypt.hash(String(password), 10); }
function verify(password, passwordHash) {
  if (!passwordHash) return Promise.resolve(false);
  return bcrypt.compare(String(password), passwordHash);
}
function sign(user) {
  return jwt.sign(
    // `ep` pins the token to the account's current sessionEpoch. Bumping that field
    // (password reset, role/permission change, deactivation, "sign out everywhere")
    // invalidates every token already handed out — without it a revoked user kept
    // their old rights for the remaining 12h of the token's life. Verified in
    // access.forRequest(), which reads the live user document anyway.
    { sub: user.username, role: user.role || 'User', name: user.name || user.username, ep: Number(user.sessionEpoch || 0) },
    SECRET(),
    { expiresIn: process.env.TOKEN_TTL || '12h' }
  );
}
function check(token) {
  try { return jwt.verify(token, SECRET()); } catch (e) { return null; }
}

module.exports = { hash, verify, sign, check };
