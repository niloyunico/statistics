/* Add two new quality indicators, and register both in the master formula library.
 *
 *   Patient Waiting Time (OPD)  ->  Out-Patient Department   (ind-opd-waiting-time)
 *   Door to CT Scan             ->  Emergency Medicine       (ind-ed-door-to-ct)
 *
 * Both are mean DURATIONS, so both use formula 'avg' (total minutes / cases measured)
 * rather than the 'count' shape the older Door to Cath Lab entry uses — a mean the console
 * computes from a numerator and a denominator can be audited; one typed straight in as a
 * single number cannot. Same shape as ind-ed-avg-los, the most recently designed time
 * indicator.
 *
 * Writes to BOTH places a definition has to exist to be real:
 *   departments.<dept>.quality.indicators   the department's reported set
 *   qualityFormulas                         the hospital master catalogue
 *
 * Idempotent: re-running replaces the two entries in place rather than duplicating them,
 * and keeps any figures already recorded against them. No months/quarters are seeded —
 * the indicators start with no recorded data.
 *
 * Usage: node scripts/add-waiting-time-and-door-to-ct.js [--dry]
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });
const { getDbHandle } = require('../server/db');

const OPD_WAITING = {
  name: 'Patient Waiting Time (OPD)',
  id: 'ind-opd-waiting-time',
  valueType: 'minutes',
  unit: 'minutes',
  formula: 'avg',
  goalDirection: 'lower_is_better',
  benchmarkValue: 30,
  benchmark: '≤ 30 minutes',
  numLabel: 'Total waiting minutes',
  denLabel: 'Number of out-patient visits measured',
  numeratorDef: 'Sum of the waiting time of every out-patient visit measured during the month = Σ (time the patient is called in to the consultation − time the patient completes OPD registration at the clinic reception), expressed in minutes. For a booked appointment the clock starts at the registration time or the appointment time, whichever is later, so that a patient who arrives early is not counted as having waited. The clock stops when the consultation begins. Time spent inside the consultation room, and time spent afterwards at investigations, billing or pharmacy, is not part of this indicator.',
  denominatorDef: 'Number of out-patient visits whose waiting time was measured in the same month — the same visits whose waiting minutes are summed in the numerator. Where every visit is timed from the registration system this is the total OPD visits for the month; where timing is done by sample, it is the number of visits sampled, and the sample size and the sampling method must be reported with the result.',
  benchmarkNote: 'Lower is better. 30 minutes from registration to consultation is the threshold in common use for a scheduled out-patient clinic and is the value set here. This is an agreed service standard rather than a clinical limit, so it should be ratified by the hospital and reviewed against the clinic’s own appointment model. Report the mean together with the number of visits measured; where a few very long waits skew the distribution, the median and the 90th percentile say more than the mean alone and should be reported alongside it.',
  reference: 'NABH Accreditation Standards for Hospitals, 6th edition (effective 1 January 2025) — waiting time for services is a required quality indicator under the Patient Safety and Quality Improvement (PSQ) chapter, and timely access to care is required under Access, Assessment and Continuity of Care (AAC). Ministry of Health and Family Welfare, Government of India — National Quality Assurance Standards (NQAS), which assess out-patient waiting time as a service-quality measure. Conceptual basis: Institute of Medicine. Crossing the Quality Chasm: A New Health System for the 21st Century. Washington DC: National Academies Press, 2001 — timeliness as one of the six domains of health-care quality.',
  referenceUrl: 'https://doi.org/10.17226/10027',
  formulaText: 'value = total waiting minutes / number of out-patient visits measured',
  status: 'n-a',
};

const ED_DOOR_TO_CT = {
  name: 'Door to CT Scan',
  id: 'ind-ed-door-to-ct',
  valueType: 'minutes',
  unit: 'minutes',
  formula: 'avg',
  goalDirection: 'lower_is_better',
  benchmarkValue: 25,
  benchmark: '≤ 25 minutes',
  numLabel: 'Total door-to-CT minutes',
  denLabel: 'Number of eligible emergency CT scans',
  numeratorDef: 'Sum of the door-to-CT interval for every eligible patient during the month = Σ (time the CT acquisition begins − time of arrival at the Emergency Department door), expressed in minutes. Eligible patients are those on a time-critical imaging pathway: suspected acute stroke, significant head injury, and major trauma requiring urgent CT. Door time is ED arrival or triage registration — NOT the time the scan was requested. Measuring from the request would hide any delay in recognising the patient and ordering the scan, which is usually the largest part of the interval.',
  denominatorDef: 'Number of eligible patients who underwent an emergency CT scan in the same month — the same patients whose intervals are summed in the numerator. Patients whose CT was not clinically urgent are outside the indicator; patients whose scan was deliberately deferred for a documented clinical reason (for example ongoing resuscitation or an unstable airway) are excluded, and the reason for the exclusion is recorded.',
  benchmarkNote: 'Lower is better. 25 minutes from ED arrival to the start of brain imaging is the target in the acute ischaemic stroke pathway — from the NINDS / Brain Attack Coalition in-hospital time frames (door-to-physician 10 min, door-to-CT initiation 25 min, door-to-CT interpretation 45 min, door-to-needle 60 min) carried into the AHA/ASA guideline and the Target: Stroke initiative. It is the value set here because stroke is the most time-critical CT indication the department sees. For head injury the applicable standard is different: NICE recommends CT of the head within 1 hour of the risk factor being identified. Where a single combined figure is reported across indications, state the case mix with the result; once volumes allow, the stroke and trauma pathways are better reported separately.',
  reference: 'Powers WJ, Rabinstein AA, Ackerson T, et al. Guidelines for the Early Management of Patients With Acute Ischemic Stroke: 2019 Update to the 2018 Guidelines for the Early Management of Acute Ischemic Stroke — A Guideline for Healthcare Professionals From the American Heart Association / American Stroke Association. Stroke. 2019;50(12):e344–e418 — emergency evaluation and imaging time targets; AHA/ASA Target: Stroke initiative. National Institute for Health and Care Excellence. NG232, Head injury: assessment and early management (2023) — CT head within 1 hour of the risk factor being identified. NABH Accreditation Standards for Hospitals, 6th edition (effective 1 January 2025) — emergency-services quality indicators.',
  referenceUrl: 'https://doi.org/10.1161/STR.0000000000000211',
  formulaText: 'value = total door-to-CT minutes / number of eligible emergency CT scans',
  status: 'n-a',
};

/* Master-catalogue rows. Aliases are the spellings a department might already be using,
   so an existing entry matches the master rather than becoming a separate definition. */
const FORMULAS = [
  {
    _id: 'patient-waiting-time-opd',
    canonicalName: 'Patient Waiting Time (OPD)',
    aliases: [
      'opd waiting time', 'out patient waiting time', 'out-patient waiting time',
      'patient waiting time', 'patient waiting time (opd)', 'patient waiting time for opd',
      'patient waiting time - opd', 'waiting time (opd)', 'waiting time for opd',
      'average opd waiting time',
    ],
    src: OPD_WAITING,
  },
  {
    _id: 'door-to-ct-scan',
    canonicalName: 'Door to CT Scan',
    aliases: [
      'door to ct', 'door-to-ct', 'door to ct scan', 'door-to-ct scan',
      'door to ct scan time', 'door-to-ct time', 'door to ct time',
      'ed door to ct', 'emergency door to ct scan',
    ],
    src: ED_DOOR_TO_CT,
  },
];

const CATALOGUE_FIELDS = ['formula', 'unit', 'numLabel', 'denLabel', 'numeratorDef',
  'denominatorDef', 'benchmark', 'benchmarkValue', 'benchmarkNote', 'goalDirection',
  'reference', 'referenceUrl'];

/* Replace the indicator in place if it is already there, otherwise append — so a re-run
   updates the wording instead of leaving two entries carrying the same id. */
function upsertIndicator(list, ind) {
  const at = list.findIndex((i) => i.id === ind.id);
  if (at < 0) { list.push(ind); return 'added  '; }
  /* Merge OVER the existing entry so any recorded months/quarters survive the update. */
  list[at] = Object.assign({}, list[at], ind);
  return 'updated';
}

(async () => {
  const dry = process.argv.includes('--dry');
  const db = await getDbHandle();
  if (!db) { console.error('No DB (MONGODB_URI not set).'); process.exit(1); }

  const app = await db.collection('appdata').findOne({ _id: 'shared' });
  let ov = null;
  try { ov = app && app.data && app.data['unico_quality_v2'] ? JSON.parse(app.data['unico_quality_v2']) : null; } catch (e) { ov = null; }

  const targets = [
    { deptId: 'opd', ind: OPD_WAITING },
    { deptId: 'er', ind: ED_DOOR_TO_CT },
  ];

  for (const t of targets) {
    const dep = await db.collection('departments').findOne({ id: t.deptId });
    if (!dep) { console.error('Department not found: ' + t.deptId); process.exit(1); }
    const inds = (dep.quality && dep.quality.indicators) || [];
    const what = upsertIndicator(inds, t.ind);
    if (!dry) {
      await db.collection('departments').updateOne({ _id: dep._id },
        { $set: { 'quality.indicators': inds } });
    }
    console.log(what + ' ' + t.ind.name + '  ->  ' + dep.quality.name
      + '  (' + inds.length + ' indicators' + (dry ? ', DRY RUN' : '') + ')');

    /* The overlay's indRemoved list is what hides an indicator from the app. A brand-new
       id can only be in there if it was added and deleted before — check, don't assume. */
    const o = (ov && ov.depts && ov.depts[dep.quality.key]) || {};
    if ((o.indRemoved || []).indexOf(t.ind.id) >= 0) {
      console.log('  WARNING: overlay indRemoved still hides ' + t.ind.id + ' in ' + dep.quality.key);
    }
  }

  for (const f of FORMULAS) {
    const doc = Object.assign({
      canonicalName: f.canonicalName,
      aliases: f.aliases,
      order: 0,
      updatedAt: Date.now(),
      updatedBy: 'add-waiting-time-and-door-to-ct',
    }, CATALOGUE_FIELDS.reduce((o, k) => { if (f.src[k] !== undefined) o[k] = f.src[k]; return o; }, {}));
    if (!dry) await db.collection('qualityFormulas').replaceOne({ _id: f._id }, doc, { upsert: true });
    console.log('formula library: ' + f._id + (dry ? ' (DRY RUN)' : ' written'));
  }

  const total = await db.collection('qualityFormulas').countDocuments();
  console.log('qualityFormulas holds ' + total + ' definitions.');
  process.exit(0);
})().catch((e) => { console.error('failed:', (e && e.stack) || e); process.exit(1); });
