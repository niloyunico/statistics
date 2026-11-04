/* Dose calculator engine (renderer/unico/dose-math.js) + built-in library (dose-library.js).
   Every expected figure here is worked by hand / from the published worked example, so a
   change in the maths shows up as a failure rather than as a wrong syringe label.
   Run: node test/dose-math.test.js */
const assert = require('assert');
const D = require('../../renderer/unico/dose-math.js');
const LIB = require('../../renderer/unico/dose-library.js');

let pass = 0; const t = (name, fn) => { fn(); pass++; console.log('  ok', name); };
const near = (a, b, tol, msg) => assert.ok(a != null && Math.abs(a - b) <= (tol == null ? 1e-6 : tol), (msg || '') + ' expected ' + b + ', got ' + a);
const inf = (id) => LIB.INFUSIONS.find((x) => x.id === id);
const em = (id) => LIB.EMERGENCY.find((x) => x.id === id);
const pd = (id) => LIB.PAEDIATRIC.find((x) => x.id === id);

t('noradrenaline 8 mg/50 mL, 70 kg, 0.1 mcg/kg/min = 2.625 mL/h, and back', () => {
  const conc = { amount: 8, unit: 'mg', ml: 50 };
  near(D.concPerMl(conc, 'mcg'), 160);
  const r = D.rateFromDose({ dose: 0.1, unit: 'mcg/kg/min', weight: 70, conc });
  near(r, 2.625);
  near(D.doseFromRate({ rate: r, unit: 'mcg/kg/min', weight: 70, conc }), 0.1);
  assert.strictEqual(D.roundToPump(r), 2.6);
  assert.strictEqual(D.roundToPump(0.456), 0.46);
});

t('insulin, vasopressin, oxytocin, magnesium rates', () => {
  near(D.rateFromDose({ dose: 0.1, unit: 'units/kg/h', weight: 60, conc: { amount: 50, unit: 'units', ml: 50 } }), 6);
  near(D.rateFromDose({ dose: 0.03, unit: 'units/min', conc: { amount: 20, unit: 'units', ml: 100 } }), 9);
  near(D.rateFromDose({ dose: 2, unit: 'milliunits/min', conc: { amount: 10, unit: 'units', ml: 500 } }), 6);
  near(D.rateFromDose({ dose: 1, unit: 'g/h', conc: { amount: 5, unit: 'g', ml: 50 } }), 10);
  near(D.rateFromDose({ dose: 60, unit: 'mg/h', conc: { amount: 900, unit: 'mg', ml: 500 } }), 33.333, 0.001);
});

t('weight-based dose without a weight is null, never a number', () => {
  assert.strictEqual(D.rateFromDose({ dose: 0.1, unit: 'mcg/kg/min', weight: '', conc: { amount: 4, unit: 'mg', ml: 50 } }), null);
  assert.strictEqual(D.rateFromDose({ dose: 0.1, unit: 'mcg/kg/min', weight: 70, conc: { amount: 4, unit: 'units', ml: 50 } }), null, 'units vs mcg cannot convert');
});

t('limit bands', () => {
  const na = inf('inf-noradrenaline');
  assert.strictEqual(D.checkLimits(na, 0.005), 'low');
  assert.strictEqual(D.checkLimits(na, 0.1), 'ok');
  assert.strictEqual(D.checkLimits(na, 1.5), 'high');
  assert.strictEqual(D.checkLimits(na, 3.01), 'hard');
  assert.strictEqual(D.checkLimits(na, 3), 'high', 'exactly the ceiling is still allowed');
});

t('titration table starts at the low end and stops at the ceiling', () => {
  const na = inf('inf-noradrenaline');
  const rows = D.titrationTable(na, na.conc[1], 70, 200);
  assert.strictEqual(rows[0].dose, 0.01);
  assert.strictEqual(rows[1].dose, 0.02);
  assert.ok(rows[rows.length - 1].dose <= na.hard + 1e-9);
  assert.ok(rows.every((r, i) => i === 0 || r.rate >= rows[i - 1].rate));
});

t('preparation plan from the stock ampoule', () => {
  const p = D.prepPlan({ amount: 8, unit: 'mg', ml: 50 }, { amount: 4, unit: 'mg', ml: 4 });
  assert.deepStrictEqual([p.ampoules, p.open, p.drawMl, p.diluentMl, p.undiluted], [2, 2, 8, 42, false]);
  const prop = D.prepPlan({ amount: 500, unit: 'mg', ml: 50 }, { amount: 200, unit: 'mg', ml: 20 });
  assert.strictEqual(prop.undiluted, true);
  assert.strictEqual(prop.open, 3);
  const fent = D.prepPlan({ amount: 1, unit: 'mg', ml: 50 }, { amount: 100, unit: 'mcg', ml: 2 });
  assert.strictEqual(fent.drawMl, 20, 'mg ↔ mcg converted');
});

t('pump simulation: 50 mL at 2.6 mL/h', () => {
  const s = D.pumpState({ rate: 2.6, volume: 50, elapsedH: 0 });
  near(s.hoursLeft, 19.2308, 0.001);
  const later = D.pumpState({ rate: 2.6, volume: 50, elapsedH: 18 });
  assert.strictEqual(later.nearEmpty, true);
  assert.strictEqual(D.pumpState({ rate: 2.6, volume: 50, elapsedH: 40 }).empty, true);
});

t('emergency sheet: 20 kg child and 120 kg adult', () => {
  const a20 = D.emergencyDose(em('em-adrenaline-arrest'), 20, 5);
  near(a20.lo, 0.2); near(a20.ml[0], 2);
  near(D.emergencyDose(em('em-amiodarone'), 20, 5).lo, 100);
  const a120 = D.emergencyDose(em('em-adrenaline-arrest'), 120, 40);
  near(a120.lo, 1); assert.strictEqual(a120.adult, true);
  near(D.emergencyDose(em('em-amiodarone'), 120, 40).lo, 300);
  near(D.emergencyDose(em('em-atropine'), 80, 40).lo, 1, 1e-9, 'adult atropine is not capped at the child 0.5 mg');
  near(D.emergencyDose(em('em-atropine'), 3, 0.2).lo, 0.1, 1e-9, 'atropine minimum 0.1 mg');
  const ket = D.emergencyDose(em('em-ketamine'), 20, 5);
  near(ket.lo, 20); near(ket.hi, 40); assert.strictEqual(ket.single, false);
  const fluid = D.emergencyDose(em('em-fluid'), 80, 40);
  assert.strictEqual(fluid.hi, 1000); assert.strictEqual(fluid.capped, true);
  const shock = D.electricalDose(LIB.ELECTRICAL[0], 20, 5);
  near(shock.lo, 40);
  near(D.electricalDose(LIB.ELECTRICAL[1], 60, 10).lo, 200, 1e-9, '4 J/kg × 60 kg capped at adult 200 J');
  const aw4 = D.airway(4);
  assert.deepStrictEqual([aw4.cuffed, aw4.uncuffed, aw4.depth], [4.5, 5, 14]);
  const aw3 = D.airway(3);
  assert.deepStrictEqual([aw3.cuffed, aw3.uncuffed], [4, 4.5], 'rounded down to the half size');
  assert.strictEqual(D.weightFromAge(4), 16);
  assert.strictEqual(D.weightFromAge(8), 31);
});

t('paediatric: paracetamol 15 mg/kg at 14 kg = 210 mg = 8.75 mL of 120 mg/5 mL', () => {
  const p = pd('pd-paracetamol');
  const r = D.paedDose(p, 14, p.strengths[0], 15);
  near(r.dose, 210); near(r.volume, 8.75); near(r.day, 840); assert.strictEqual(r.capped, null);
  const big = D.paedDose(p, 80, p.strengths[0], 15);
  near(big.dose, 1000); assert.strictEqual(big.capped, 'dose');
  const amox = D.paedDose(pd('pd-amoxicillin'), 20, pd('pd-amoxicillin').strengths[1], 45);
  near(amox.dose, 300); near(amox.volume, 6);
  const tab = D.paedDose(p, 40, p.strengths[2], 12.5);
  near(tab.units, 1);
  const dayCap = D.paedDose({ mode: 'dose', dose: [20, 20], perDay: 4, maxDayPerKg: 60 }, 10, null, 20);
  near(dayCap.day, 600); near(dayCap.dose, 150); assert.strictEqual(dayCap.capped, 'day');
  assert.strictEqual(D.paedDose(p, 14, p.strengths[0], 20).outOfRange, true);
});

t('body size, renal and fluid formulas', () => {
  near(D.bsaMosteller(70, 170), 1.8181, 0.001);
  near(D.ibw(180, 'M'), 74.99, 0.01);
  near(D.ibw(165, 'F'), 56.91, 0.01);
  near(D.adjBw(120, 70), 90);
  near(D.bmi(70, 175), 22.857, 0.001);
  near(D.crclCockcroftGault({ age: 60, weight: 72, scr: 1, sex: 'M' }), 80);
  near(D.crclCockcroftGault({ age: 60, weight: 72, scr: 88.4, scrUnit: 'umol', sex: 'F' }), 68);
  near(D.egfrCkdEpi2021({ age: 50, scr: 1.0, sex: 'F' }), 68.6, 0.6);
  near(D.egfrCkdEpi2021({ age: 50, scr: 1.0, sex: 'M' }), 91.7, 0.6);
  near(D.schwartzBedside(110, 0.5), 90.86, 0.01);
  assert.deepStrictEqual(D.maintenance421(25), { mlPerHour: 65, mlPerDay: 1600 });
  assert.deepStrictEqual(D.maintenance421(8), { mlPerHour: 32, mlPerDay: 800 });
  near(D.dripRate(1000, 480, 20).dropsPerMin, 41.667, 0.001);
  near(D.dripsFromRate(125, 20), 41.667, 0.001);
  const pk = D.parkland(70, 30);
  assert.deepStrictEqual([pk.total, pk.first8, pk.first8PerHour], [8400, 4200, 525]);
});

t('sodium, water and electrolytes', () => {
  near(D.adrogueMadias({ weight: 70, sex: 'M', age: 40, na: 110, infusateNa: 513 }).perLitre, 9.372, 0.001);
  near(D.freeWaterDeficit({ weight: 70, sex: 'M', age: 40, na: 160 }), 6);
  near(D.sodiumDeficit({ weight: 60, sex: 'F', age: 30, na: 120, target: 130 }), 300);
  near(D.correctedSodium(130, 600), 142);
  near(D.correctedSodium(130, 600 / 18, 'mmol'), 142, 1e-9);
  near(D.correctedCalcium(8, 2), 9.6);
  near(D.correctedCalcium(2.0, 30, 'mmol'), 2.2);
  near(D.anionGap(140, 100, 24, 2).corrected, 21);
  near(D.meanArterial(120, 60), 80);
  near(D.convertUnits({ kind: 'ratio', value: 1000 }), 1);
  near(D.convertUnits({ kind: 'percent', value: 2 }), 20);
  near(D.convertUnits({ value: 0.5, from: 'mg', to: 'mcg' }), 500);
});

t('library merge: hospital edit, disabled drug, hospital-added drug, review goes stale', () => {
  const plain = D.mergeLibrary(LIB, []);
  assert.strictEqual(plain.infusion.length, LIB.INFUSIONS.length);
  assert.ok(plain.infusion.every((e) => e.reviewed.state === 'none'));
  const na = plain.infusion.find((e) => e.id === 'inf-noradrenaline');
  const hash = D.contentHash(na);
  const reviewed = D.mergeLibrary(LIB, [{ id: 'inf-noradrenaline', kind: 'infusion', builtIn: true, review: { by: 'Pharmacist', at: 1, hash } }]);
  assert.strictEqual(reviewed.infusion.find((e) => e.id === 'inf-noradrenaline').reviewed.state, 'ok');
  const edited = D.mergeLibrary(LIB, [{ id: 'inf-noradrenaline', kind: 'infusion', builtIn: true, data: { hard: 2 }, review: { by: 'Pharmacist', at: 1, hash } }]);
  const e = edited.infusion.find((x) => x.id === 'inf-noradrenaline');
  assert.strictEqual(e.hard, 2); assert.strictEqual(e.reviewed.state, 'stale'); assert.strictEqual(e.overridden, true);
  const off = D.mergeLibrary(LIB, [{ id: 'inf-dopamine', kind: 'infusion', builtIn: true, disabled: true }]);
  assert.strictEqual(off.infusion.find((x) => x.id === 'inf-dopamine').disabled, true);
  const added = D.mergeLibrary(LIB, [{ id: 'h-inf-1', kind: 'infusion', builtIn: false, data: { name: 'Local drug', unit: 'mg/h', conc: [{ amount: 10, unit: 'mg', ml: 50 }] } }, { id: '_layout', data: {} }]);
  assert.strictEqual(added.infusion.length, LIB.INFUSIONS.length + 1);
  assert.strictEqual(added.infusion[added.infusion.length - 1].custom, true);
  assert.strictEqual(D.contentHash(Object.assign({}, na, { reviewed: { state: 'ok' }, disabled: true })), hash, 'meta fields do not change the hash');
});

t('number formatting never drops zeros from whole numbers', () => {
  assert.strictEqual(D.fmt(160), '160');
  assert.strictEqual(D.fmt(320), '320');
  assert.strictEqual(D.fmt(10), '10');
  assert.strictEqual(D.fmt(100), '100');
  assert.strictEqual(D.fmt(2.6), '2.6');
  assert.strictEqual(D.fmt(2.625), '2.63');
  assert.strictEqual(D.fmt(0.05), '0.05');
  assert.strictEqual(D.fmt(0.0125), '0.0125');
  assert.strictEqual(D.fmt(25000), '25,000');
  assert.strictEqual(D.fmt(1.5, 2), '1.5');
  assert.strictEqual(D.fmt(null), '—');
});

t('saved order: new items at the end, removed ids ignored', () => {
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
  assert.deepStrictEqual(D.applyOrder(items, ['c', 'gone', 'a']).map((x) => x.id), ['c', 'a', 'b', 'd']);
  assert.deepStrictEqual(D.applyOrder(items, null).map((x) => x.id), ['a', 'b', 'c', 'd']);
  assert.deepStrictEqual(D.moveItem(['a', 'b', 'c'], 0, 2), ['b', 'c', 'a']);
});

t('every built-in entry is internally consistent', () => {
  const ids = {};
  LIB.INFUSIONS.forEach((e) => {
    assert.ok(!ids[e.id], 'duplicate id ' + e.id); ids[e.id] = 1;
    assert.ok(e.source && e.name && e.group, e.id + ' needs name/group/source');
    assert.ok(e.soft[0] <= e.soft[1] && e.soft[1] <= e.hard, e.id + ' soft ≤ hard');
    assert.ok(e.start >= e.soft[0] && e.start <= e.hard, e.id + ' start in range');
    assert.ok(e.step > 0, e.id + ' step');
    e.conc.forEach((c) => {
      assert.ok(c.amount > 0 && c.ml > 0, e.id + ' concentration');
      assert.ok(D.concPerMl(c, D.parseUnit(e.unit).amount) > 0, e.id + ' concentration converts to the dose unit');
    });
    const p = D.prepPlan(e.conc[0], e.ampoule);
    assert.ok(p && !p.impossible, e.id + ' prep plan fits in the syringe/bag');
  });
  LIB.EMERGENCY.forEach((e) => {
    assert.ok(!ids[e.id], 'duplicate id ' + e.id); ids[e.id] = 1;
    assert.ok(e.source, e.id + ' source');
    const d = D.emergencyDose(e, 20, 6);
    assert.ok(d && d.lo > 0 && d.hi >= d.lo, e.id + ' child dose');
  });
  LIB.PAEDIATRIC.forEach((e) => {
    assert.ok(!ids[e.id], 'duplicate id ' + e.id); ids[e.id] = 1;
    assert.ok(e.dose[0] <= e.dose[1] && e.strengths.length && e.source, e.id);
    const r = D.paedDose(e, 15, e.strengths[0]);
    assert.ok(r && r.dose > 0, e.id + ' dose');
  });
});

console.log('dose-math: ' + pass + ' passed');
