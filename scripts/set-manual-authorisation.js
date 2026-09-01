/* Store the manual's authorisation block, credit line and confidentiality notice.
 *
 * The app's four sign-off names live in browser localStorage (`unico_report_sig_v1`,
 * window.unicoSig in renderer/unico/data.js) — a Node build script cannot read them and
 * they would be lost on any machine but the one that typed them. They are therefore kept
 * in appdata under `unico_manual_meta`, alongside the other shared settings, so the
 * manual builder can read them and a regeneration never loses them.
 *
 * Edit the values below and re-run with --apply to change what the manuals print.
 *
 * Usage: node scripts/set-manual-authorisation.js           (dry run — shows current vs new)
 *        node scripts/set-manual-authorisation.js --apply
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });
const { getDbHandle } = require('../server/db');

const KEY = 'unico_manual_meta';

const META = {
  org: 'UNICO Hospitals PLC',
  sign: [
    { name: 'Nasif Ahammed Niloy', title: 'Staff Nurse', role: 'PREPARED BY' },
    { name: 'Md Balayet Hossen', title: 'Senior Manager', role: 'CHECKED BY' },
    { name: 'Elizabeth Jothi', title: 'Chief of Nursing Service', role: 'RECOMMENDED BY' },
    { name: 'Ardra Kurien', title: 'Chief Executive Officer', role: 'APPROVED BY' },
  ],
  credit: 'Compiled and maintained by the Quality Assurance Department, UNICO Hospitals PLC. Generated from the hospital quality database.',
  confidential: 'Confidential — for internal circulation within UNICO Hospitals PLC only.',
  confidentialLong: 'This manual is the property of UNICO Hospitals PLC and is issued for internal use. It contains the hospital\'s quality indicator definitions and accountability assignments. It may not be copied, circulated outside the organisation, or published in any form without the written permission of the Quality Assurance Department.',
};

(async () => {
  const apply = process.argv.includes('--apply');
  const db = await getDbHandle();
  if (!db) { console.error('No DB (MONGODB_URI not set).'); process.exit(1); }

  const col = db.collection('appdata');
  const shared = await col.findOne({ _id: 'shared' });
  let current = null;
  try { current = shared && shared.data && shared.data[KEY] ? JSON.parse(shared.data[KEY]) : null; } catch (e) { current = null; }

  console.log('current:', current ? JSON.stringify(current, null, 2) : '(not set)');
  console.log('\nnew    :', JSON.stringify(META, null, 2));

  if (!apply) { console.log('\nDRY RUN — pass --apply to write.'); process.exit(0); }
  await col.updateOne({ _id: 'shared' }, { $set: { ['data.' + KEY] : JSON.stringify(META), updatedAt: Date.now() } }, { upsert: true });
  console.log('\nWritten to appdata.data.' + KEY);
  process.exit(0);
})().catch((e) => { console.error('failed:', (e && e.stack) || e); process.exit(1); });
