/* Back up the live `quality` collection to a file and compare it (data-only)
   against a reference seed snapshot, so we can prove the collection has NOT
   diverged from the seed before an additive --force re-seed.

   Usage: node scripts/backup-quality-collection.js <out.json> <reference-seed.json>
*/
require('dotenv').config({ path: require('path').join(__dirname, '..', 'server', '.env') });
try { require('dns').setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']); } catch (e) {}
const fs = require('fs');
const path = require('path');
const { MongoClient } = require(path.join(__dirname, '..', 'server', 'node_modules', 'mongodb'));

const OUT = process.argv[2];
const REF = process.argv[3];

(async () => {
  if (!process.env.MONGODB_URI) { console.error('No MONGODB_URI'); process.exit(1); }
  const c = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 12000 });
  try {
    await c.connect();
    const db = c.db(process.env.DB_NAME || 'unico');
    const docs = await db.collection('quality').find({}).sort({ order: 1, _id: 1 }).toArray();
    fs.writeFileSync(OUT, JSON.stringify(docs, null, 2), 'utf8');
    console.log('[backup] wrote ' + docs.length + ' quality docs -> ' + OUT);

    // Data-only comparison vs the reference seed (ignore _id/order/the new formula fields).
    if (REF && fs.existsSync(REF)) {
      const ref = JSON.parse(fs.readFileSync(REF, 'utf8'));
      const NEW = new Set(['formula', 'numLabel', 'denLabel', 'unit', 'formulaText', 'numeratorDef', 'denominatorDef', 'reference']);
      const strip = (o) => { const { _id, order, ...rest } = o; return rest; };
      const dropNew = (ind) => { const o = {}; Object.keys(ind).forEach(k => { if (!NEW.has(k)) o[k] = ind[k]; }); return o; };
      const byKeyDb = {}; docs.forEach(d => { byKeyDb[d.key] = strip(d); });
      let diffs = 0;
      ref.forEach(rd => {
        const dd = byKeyDb[rd.key];
        if (!dd) { console.log('  DB MISSING DEPT:', rd.key); diffs++; return; }
        ['year', 'executive', 'meta'].forEach(k => { if (JSON.stringify(rd[k]) !== JSON.stringify(dd[k])) { console.log('  DEPT FIELD DIFF', rd.key, k); diffs++; } });
        const ri = rd.indicators || [], di = (dd.indicators || []);
        const dbById = {}; di.forEach(x => { dbById[x.id] = x; });
        const refIds = new Set(ri.map(x => x.id));
        if (ri.length !== di.length) { console.log('  IND COUNT DIFF', rd.key, ri.length, 'vs', di.length); diffs++; }
        const isEmpty = (v) => v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0;
        ri.forEach((r) => {
          const raw = dbById[r.id];
          if (!raw) { console.log('  IND MISSING IN DB', rd.key, r.id); diffs++; return; }
          const d = dropNew(raw);
          Object.keys(r).forEach(k => { if (NEW.has(k)) return; if (JSON.stringify(r[k]) !== JSON.stringify(d[k])) { console.log('  IND FIELD DIFF', rd.key, r.id, k); diffs++; } });
          // Flag NON-EMPTY DB-only non-formula fields (e.g. months/mNum/mDen/incidents/
          // monthRemarks/capa with real data) the seed lacks — a --force re-seed DROPS them.
          Object.keys(d).forEach(k => { if (!(k in r) && !NEW.has(k) && !isEmpty(d[k])) { console.log('  DB-ONLY DATA (would be DROPPED on --force re-seed)', rd.key, r.id, k); diffs++; } });
        });
        // DB-only indicators absent from the seed entirely.
        di.forEach(x => { if (!refIds.has(x.id)) { console.log('  DB-ONLY INDICATOR (not in seed)', rd.key, x.id); diffs++; } });
      });
      console.log(diffs === 0
        ? '[verify] PASS — live quality collection == reference seed (ignoring the new formula fields). Additive re-seed is safe.'
        : '[verify] ' + diffs + ' difference(s) — REVIEW before re-seeding.');
    }
  } catch (e) {
    console.error('[backup] failed:', e.message); process.exitCode = 1;
  } finally { await c.close(); }
})();
