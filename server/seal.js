/* Sealing secrets kept in the database (the H360 login, the Cloudflare R2 backup keys).
 *
 * A secret saved in MongoDB is never readable there: it is sealed with AES-256-GCM under a key
 * made from this server's own secret (H360_SECRET, or JWT_SECRET) and a purpose label. A server
 * with a different secret cannot open it. Each purpose gets its own label, so a sealed H360
 * password can never be opened as an R2 key or the other way round.
 */
const crypto = require('crypto');

const secret = () => process.env.H360_SECRET || process.env.JWT_SECRET || '';

function sealer(label, nameLabel) {
  const key = () => crypto.createHash('sha256').update(label + '|' + secret()).digest();
  return {
    hasSecret: () => Boolean(secret()),
    // Which secret a copy was sealed with, without giving the secret away.
    name: () => crypto.createHash('sha256').update((nameLabel || label + '-copy') + '|' + secret()).digest('hex').slice(0, 12),
    seal(value) {
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
      const data = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
      return { iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') };
    },
    unseal(sealed) {
      const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(sealed.iv, 'base64'));
      decipher.setAuthTag(Buffer.from(sealed.tag, 'base64'));
      return Buffer.concat([decipher.update(Buffer.from(sealed.data, 'base64')), decipher.final()]).toString('utf8');
    },
  };
}

module.exports = { sealer, secret };
