/* UNICO — Medicine module tests.
 *
 * The interaction checker is the part of this module that can do harm by being wrong,
 * in both directions: a missed warning is a missed warning, and a checker that fires on
 * every prescription trains people to click past it. So it is tested against real
 * monograph prose from the imported index — known-interacting pairs must fire, and
 * unrelated pairs must stay silent.
 *
 * Runs against the live index when MONGODB_URI is set; the pure matching tests below
 * use fixed fixtures and always run.
 *
 *   node test/medicines.test.js
 */
'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const med = require('../medicines');

let pass = 0, fail = 0;
const ok = (cond, label) => { if (cond) { pass++; console.log('  PASS  ' + label); } else { fail++; console.log('  FAIL  ' + label); } };
const section = (t) => console.log('\n== ' + t + ' ==');

const G = (name, drugClass, interaction) => ({ id: 'x-' + name, name, drugClass, brief: { interaction: interaction || '' } });

/* ---- the matching rules, on fixed text ---- */
section('a salt-suffixed generic matches prose that names the base drug');
{
  // Verbatim from the imported Omeprazole monograph.
  const omeprazole = G('Omeprazole', 'Proton Pump Inhibitor',
    'Omeprazole can prolong the elimination of diazepam, warfarin and phenytoin. So, reduction of warfarin or phenytoin dose may be necessary when Omeprazole is added to the treatment.');
  const warfarin = G('Warfarin Sodium', 'Oral Anti-coagulants', '');
  const w = med.checkInteractions([omeprazole, warfarin]);
  const hit = w.filter((x) => x.kind === 'interaction');
  ok(hit.length === 1, 'Omeprazole + Warfarin Sodium is flagged (prose says "warfarin", not "Warfarin Sodium")');
  ok(hit.length === 1 && /warfarin/i.test(hit[0].detail), 'and the warning quotes the sentence that matched');
}

section('a hyphenated drug class matches prose that runs the word together');
{
  const aspirin = G('Aspirin', 'Anti-platelet drugs',
    'Salicylates may enhance the effect of anticoagulants, oral hypoglycaemic agents, phenytoin and sodium valporate.');
  const warfarin = G('Warfarin Sodium', 'Oral Anti-coagulants', '');
  const hit = med.checkInteractions([aspirin, warfarin]).filter((x) => x.kind === 'interaction');
  ok(hit.length === 1, 'Aspirin + Warfarin is flagged via the class ("Anti-coagulants" vs "anticoagulants")');
  ok(hit.length === 1 && /class/i.test(hit[0].source || ''), 'and the warning says it matched on the class, not the drug name');
}

section('each half of a combination generic is matched');
{
  const combo = G('Aspirin + Dipyridamole', 'Anti-platelet drugs', '');
  const other = G('Probenecid', 'Uricosuric', 'Probenecid should not be given with aspirin, which antagonises its uricosuric effect.');
  const hit = med.checkInteractions([other, combo]).filter((x) => x.kind === 'interaction');
  ok(hit.length === 1, 'a combination is flagged when prose names only one of its components');
}

section('unrelated drugs must NOT be flagged');
{
  const para = G('Paracetamol', 'Non opioid analgesics',
    'Prolonged concurrent use of Paracetamol and a NSAID may increase the risk of adverse renal effects.');
  const cetirizine = G('Cetirizine Dihydrochloride', 'Non-sedating antihistamine', 'No clinically significant interactions have been reported.');
  const hit = med.checkInteractions([para, cetirizine]).filter((x) => x.kind === 'interaction');
  ok(hit.length === 0, 'Paracetamol + Cetirizine produces no interaction warning');
}

section('a duplicated generic is always caught, under any brand');
{
  const para = G('Paracetamol', 'Non opioid analgesics', '');
  const w = med.checkInteractions([para, para]);
  const dup = w.filter((x) => x.kind === 'duplicate');
  ok(dup.length === 1, 'the same generic twice raises exactly one duplicate warning');
  ok(dup.length === 1 && dup[0].severity === 'high', 'and it is a high-severity warning');
}

section('two drugs of one class are reported, but only as information');
{
  const a = G('Ibuprofen', 'NSAID', '');
  const b = G('Naproxen', 'NSAID', '');
  const w = med.checkInteractions([a, b]);
  const cls = w.filter((x) => x.kind === 'class');
  ok(cls.length === 1, 'the shared class is reported');
  ok(cls.length === 1 && cls[0].severity === 'info', 'as info, not as a warning to be overridden');
}

section('the same pair is reported once, not once per direction');
{
  const a = G('Alpha', 'Class A', 'Alpha interacts with Betamycin.');
  const b = G('Betamycin', 'Class B', 'Betamycin interacts with Alpha.');
  const hit = med.checkInteractions([a, b]).filter((x) => x.kind === 'interaction');
  ok(hit.length === 1, 'one warning for one pair, though both monographs name the other');
}

section('a name match beats a class match for the same pair');
{
  const a = G('Alpha', 'Anti-coagulants', 'Alpha interacts with Betamycin specifically.');
  const b = G('Betamycin', 'Anti-coagulants', 'Betamycin interacts with anticoagulants generally.');
  const hit = med.checkInteractions([a, b]).filter((x) => x.kind === 'interaction');
  ok(hit.length === 1 && hit[0].byName === true, 'the specific, name-level match is the one kept');
}

section('short and empty inputs cannot fire a warning');
{
  const iron = G('Iron', 'Mineral', 'Take with food. Iron absorption is reduced by tea.');
  const zinc = G('Zinc', 'Mineral', '');
  const hit = med.checkInteractions([iron, zinc]).filter((x) => x.kind === 'interaction');
  ok(hit.length === 0, 'names shorter than the minimum never match ordinary prose');
  ok(med.checkInteractions([]).length === 0, 'an empty prescription produces no warnings');
  ok(med.checkInteractions([G('Solo', 'Class', '')]).length === 0, 'a single drug produces no warnings');
}

section('a prescription payload is bounded and normalised');
{
  const r = med.normRx({
    patientName: 'x'.repeat(400), items: new Array(90).fill({ brand: 'B', generic: 'G' }),
    status: 'nonsense', uhid: 'U1',
  });
  ok(r.patientName.length === 120, 'an oversized patient name is truncated');
  ok(r.items.length === 40, 'the drug list is capped at 40 lines');
  ok(r.status === 'draft', 'an unknown status falls back to draft');
  ok(r.date && /^\d{4}-\d{2}-\d{2}$/.test(r.date), 'a missing date defaults to today');
}


/* ---- allergy checking ---- */
section('an allergy is matched against the drug, its base name and its class');
{
  const amox = G('Amoxicillin Trihydrate', 'Broad spectrum penicillins', '');
  const hit = med.checkInteractions([amox], 'Penicillin').filter((w) => w.kind === 'allergy');
  ok(hit.length === 1, 'a penicillin allergy flags Amoxicillin via its drug class');
  ok(hit.length === 1 && hit[0].severity === 'critical', 'and it is CRITICAL - above any interaction');
}
{
  const asp = G('Aspirin', 'Anti-platelet drugs', '');
  ok(med.checkInteractions([asp], 'aspirin').filter((w) => w.kind === 'allergy').length === 1, 'an exact drug-name allergy is flagged');
  ok(med.checkInteractions([asp], 'Penicillin').filter((w) => w.kind === 'allergy').length === 0, 'an unrelated allergy is not');
}

section('allergy text is messy, and must not fire on noise');
{
  const para = G('Paracetamol', 'Non opioid analgesics', '');
  const ibu = G('Ibuprofen', 'NSAID', '');
  ok(med.checkInteractions([para], 'NKDA').filter((w) => w.kind === 'allergy').length === 0, '"NKDA" fires nothing');
  ok(med.checkInteractions([para], 'none').filter((w) => w.kind === 'allergy').length === 0, '"none" fires nothing');
  ok(med.checkInteractions([para], '').filter((w) => w.kind === 'allergy').length === 0, 'an empty allergy field fires nothing');
  ok(med.checkInteractions([ibu], 'allergic to NSAIDs').filter((w) => w.kind === 'allergy').length === 1, '"allergic to NSAIDs" still matches the NSAID class');
  const two = med.checkInteractions([para, ibu], 'paracetamol, NSAIDs').filter((w) => w.kind === 'allergy');
  ok(two.length === 2, 'a comma-separated list is split into separate terms');
}

section('a critical allergy sorts above every other warning');
{
  const amox = G('Amoxicillin Trihydrate', 'Broad spectrum penicillins', '');
  const para = G('Paracetamol', 'Non opioid analgesics', '');
  const all = med.checkInteractions([amox, para, para], 'penicillin');
  ok(all.length >= 2, 'both an allergy and a duplicate are reported');
  ok(all[0].severity === 'critical', 'the allergy is first in the list');
}

section('derived fields exist on the imported index');

/* ---- against the real imported index ---- */
(async function live() {
  if (!process.env.MONGODB_URI) {
    console.log('\n(no MONGODB_URI — skipping the live-index checks)');
    return done();
  }
  const { getDbHandle, close } = require('../db');
  let db;
  try { db = await getDbHandle(); } catch (e) { db = null; }
  if (!db) { console.log('\n(no database — skipping the live-index checks)'); return done(); }

  const col = db.collection(med.C_GEN);
  const n = await col.estimatedDocumentCount();
  if (!n) { console.log('\n(index not imported — skipping the live-index checks)'); await close(); return done(); }

  const byName = async (name) => {
    const d = await col.findOne({ nameLower: name.toLowerCase() }, { projection: { name: 1, drugClass: 1, 'brief.interaction': 1 } });
    return d ? { id: d._id, name: d.name, drugClass: d.drugClass, brief: d.brief } : null;
  };
  const pair = async (x, y) => {
    const a = await byName(x), b = await byName(y);
    if (!a || !b) return null;
    return med.checkInteractions([a, b]).filter((w) => w.kind === 'interaction');
  };

  section('pregnancy category and antibiotic flag were derived');
  const withPreg = await col.countDocuments({ pregnancyCategory: { $in: ['A', 'B', 'C', 'D', 'X'] } });
  const withAbx = await col.countDocuments({ abx: true });
  console.log('         ' + withPreg + ' generics carry a pregnancy category, ' + withAbx + ' are antibiotics');
  ok(withPreg > 300, 'a pregnancy category was extracted for a useful share of the index');
  ok(withAbx > 50, 'antibiotics are flagged for stewardship reporting');
  const bad = await col.countDocuments({ pregnancyCategory: { $nin: ['', 'A', 'B', 'C', 'D', 'X'] } });
  ok(bad === 0, 'no generic carries a category outside A-X');

  section('known interacting pairs, against the real monographs');
  for (const [x, y] of [['Omeprazole', 'Warfarin Sodium'], ['Aspirin', 'Warfarin Sodium'], ['Ciprofloxacin', 'Theophylline']]) {
    const hit = await pair(x, y);
    if (hit === null) { console.log('  SKIP  ' + x + ' + ' + y + ' (not both in the index)'); continue; }
    ok(hit.length >= 1, x + ' + ' + y + ' is flagged');
    if (hit.length) console.log('         ' + hit[0].detail.slice(0, 130));
  }

  section('unrelated pairs stay silent, against the real monographs');
  for (const [x, y] of [['Paracetamol', 'Cetirizine Hydrochloride'], ['Amoxicillin Trihydrate', 'Vitamin C [Ascorbic acid]'], ['Paracetamol', 'Amoxicillin Trihydrate']]) {
    const hit = await pair(x, y);
    if (hit === null) { console.log('  SKIP  ' + x + ' + ' + y + ' (not both in the index)'); continue; }
    ok(hit.length === 0, x + ' + ' + y + ' produces no warning');
  }

  // A checker that fires on most random pairs is noise. Sampling real generics gives a
  // blunt but honest read on that, and it is the number to watch if the matcher changes.
  section('the checker is not indiscriminate');
  const sample = await col.aggregate([{ $sample: { size: 60 } }, { $project: { name: 1, drugClass: 1, 'brief.interaction': 1 } }]).toArray();
  const docs = sample.map((d) => ({ id: d._id, name: d.name, drugClass: d.drugClass, brief: d.brief }));
  let fired = 0, tried = 0;
  for (let i = 0; i + 1 < docs.length; i += 2) {
    tried++;
    if (med.checkInteractions([docs[i], docs[i + 1]]).some((w) => w.kind === 'interaction')) fired++;
  }
  const rate = tried ? fired / tried : 0;
  console.log('         ' + fired + ' of ' + tried + ' random pairs flagged (' + Math.round(rate * 100) + '%)');
  ok(rate < 0.35, 'fewer than a third of random pairs fire a warning');

  await close();
  done();
})();

function done() {
  console.log('\n' + (fail ? fail + ' FAILED, ' : 'ALL ') + pass + ' PASSED');
  if (fail) process.exitCode = 1;
}
