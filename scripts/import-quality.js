/* Regenerates renderer/unico/quality-data.js (window.QUALITY_SEED) from the
   latest per-department KPI JSON in C:\xampp\htdocs\unico-kpi\departments.
   Each department keeps its own indicator set (some shared across departments). */
const fs = require('fs');
const path = require('path');

const SRC = 'C:/xampp/htdocs/unico-kpi/departments';
const OUT = path.join(__dirname, '..', 'renderer', 'unico', 'quality-data.js');
// Preserve the existing clinical ordering; unknown departments go last.
const ORDER = ['Cathlab','CCU','CTICU','Dialysis','Gastroenterology','InfectionControl','LDR','Level10','Level9','MICU','NICU','NursingTraining','OPD','SurgicalICU'];

const folders = fs.readdirSync(SRC).filter((f) => { try { return fs.statSync(path.join(SRC, f)).isDirectory(); } catch (e) { return false; } });
const seed = [];
for (const f of folders) {
  const file = path.join(SRC, f, `${f}_KPI_latest.json`);
  if (!fs.existsSync(file)) { console.warn('  (skip, no latest)', f); continue; }
  let j;
  try { j = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { console.warn('  (bad JSON)', f, e.message); continue; }
  const dep = j.department || {};
  seed.push({
    key: f,
    name: dep.name || f,
    year: j.year || dep.year || '2025-2026',
    executive: dep.executive || {},
    meta: dep.meta || {},
    indicators: Array.isArray(dep.indicators) ? dep.indicators : [],
  });
}
seed.sort((a, b) => { const ia = ORDER.indexOf(a.key), ib = ORDER.indexOf(b.key); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });

fs.writeFileSync(OUT, '/* UNICO — Quality Indicators · imported from unico-kpi (latest) */\nwindow.QUALITY_SEED=' + JSON.stringify(seed) + ';\n', 'utf8');

const totalInd = seed.reduce((s, d) => s + d.indicators.length, 0);
console.log(`Wrote ${seed.length} departments, ${totalInd} indicators -> ${path.relative(path.join(__dirname,'..'), OUT)}`);
seed.forEach((d) => console.log(`  - ${d.key}: ${d.indicators.length} indicators · status=${d.executive.overallStatus || '—'}`));
