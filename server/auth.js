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
    { sub: user.username, role: user.role || 'User', name: user.name || user.username },
    SECRET(),
    { expiresIn: process.env.TOKEN_TTL || '12h' }
  );
}
function check(token) {
  try { return jwt.verify(token, SECRET()); } catch (e) { return null; }
}

module.exports = { hash, verify, sign, check };
