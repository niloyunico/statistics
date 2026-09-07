/* UNICO — Cloudinary credit usage at a glance.
 *
 * WHY THIS EXISTS
 * Cloudinary's free plan is 25 CREDITS, not 25 GB, and the three things that spend
 * them are priced very differently:
 *
 *     1 credit  =  1 GB storage  =  1 GB bandwidth  =  1,000 transformations
 *
 * So an account can hold only 3 GB of images and still be over its limit. That is
 * exactly what happened here on 2026-09-05: a bulk import of ~52,000 medicine images
 * spent ONE TRANSFORMATION PER UPLOADED ASSET, which pushed usage to 225% while
 * storage sat at 3.5 of 25. Reading the dashboard as "storage" sends you to the
 * upgrade page for a problem that is not storage.
 *
 * The figure is a ROLLING 30-DAY window, so a one-off spike ages out by itself.
 * Knowing which line caused it is the difference between waiting a month and paying
 * for an upgrade you do not need.
 *
 *   npm --prefix server run cloudinary:usage
 */
require('dotenv').config({ path: __dirname + '/.env' });
const https = require('https');

const N = process.env.CLOUDINARY_CLOUD_NAME;
const K = process.env.CLOUDINARY_API_KEY;
const S = process.env.CLOUDINARY_API_SECRET;

if (!N || !K || !S) {
  console.error('\n  x CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET'
    + ' are not set in server/.env\n');
  process.exit(1);
}

const auth = 'Basic ' + Buffer.from(K + ':' + S).toString('base64');
const bar = (pct) => {
  const n = Math.max(0, Math.min(30, Math.round((pct / 100) * 30)));
  return '[' + '#'.repeat(n) + '.'.repeat(30 - n) + ']';
};
const gb = (b) => (Number(b || 0) / 1073741824).toFixed(2) + ' GB';
const num = (v) => Number(v || 0).toLocaleString();
// Some fields come back as a scalar and some as { usage: n } — take either.
const val = (v) => Number((v && typeof v === 'object') ? (v.usage || 0) : (v || 0));

https.get({ host: 'api.cloudinary.com', path: '/v1_1/' + N + '/usage', headers: { Authorization: auth } }, (r) => {
  let body = '';
  r.on('data', (d) => { body += d; });
  r.on('end', () => {
    let j;
    try { j = JSON.parse(body); } catch (e) {
      console.error('  x Cloudinary replied HTTP ' + r.statusCode + ': ' + body.slice(0, 200));
      process.exit(1);
    }
    if (j.error) { console.error('  x ' + ((j.error && j.error.message) || 'request failed')); process.exit(1); }

    const c = j.credits || {};
    const used = Number(c.usage || 0);
    const limit = Number(c.limit || 0);
    const pct = limit ? (used / limit) * 100 : 0;

    console.log('');
    console.log('  Cloudinary — ' + N + '    plan: ' + (j.plan || '?') + '    as of ' + (j.last_updated || '?'));
    console.log('');
    console.log('  CREDITS  ' + bar(pct) + '  ' + used.toFixed(2) + ' / ' + limit
      + '   (' + pct.toFixed(1) + '%)' + (used > limit ? '   <-- OVER LIMIT' : ''));
    console.log('  rolling 30-day window — a one-off spike ages out of it');
    console.log('');

    const rows = [
      ['transformations', j.transformations, (o) => num(o.usage) + ' transforms'],
      ['storage', j.storage, (o) => gb(o.usage)],
      ['bandwidth', j.bandwidth, (o) => gb(o.usage)],
    ].filter((x) => x[1]);

    console.log('  what is spending them');
    rows.sort((a, b) => Number(b[1].credits_usage || 0) - Number(a[1].credits_usage || 0))
      .forEach((row) => {
        const label = row[0], o = row[1], fmt = row[2];
        const cr = Number(o.credits_usage || 0);
        const share = used ? (cr / used) * 100 : 0;
        console.log('    ' + label.padEnd(16) + fmt(o).padEnd(22)
          + cr.toFixed(2).padStart(7) + ' credits   ' + share.toFixed(0).padStart(3) + '% of usage');
      });

    console.log('');
    console.log('    objects stored   ' + num(val(j.objects)));
    console.log('    derived versions ' + num(val(j.derived_resources)));
    console.log('');

    // The trap worth naming out loud, because it is invisible on the dashboard: an
    // upload costs a transformation, so a bulk import looks like a transformation
    // spike and nothing like "storage".
    const tr = val(j.transformations);
    const ob = val(j.objects);
    if (ob && tr > ob * 0.8 && tr < ob * 1.3) {
      console.log('  note: transformations ~= objects stored, which is the signature of a BULK');
      console.log('        UPLOAD (one transformation per asset), not of people browsing the app.');
      console.log('        It leaves the 30-day window on its own — just do not re-run a bulk');
      console.log('        upload, and do not delete the uploader\'s done-file.');
      console.log('');
    }
  });
}).on('error', (e) => { console.error('  x ' + e.message); process.exit(1); });
