/* UNICO — the ONE dose-calculation engine (Medicine & Rx → Dose Calculator).
   Pure arithmetic, no React and no DOM, so the calculator, the server (review hashes)
   and server/test/dose-math.test.js all run exactly the same code.

   Units: amounts are converted through a base per family — mass in mcg, activity in
   units, substance in mmol, volume in mL. A dose unit is "<amount>[/kg]/<min|h>" (e.g.
   mcg/kg/min, units/h, g/h). A concentration is { amount, unit, ml }.

   Every function returns null (never NaN / Infinity) when an input is missing, so the
   UI can show "—" rather than a wrong number. */
(function (root) {
  const MASS = { g: 1e6, mg: 1e3, mcg: 1, ng: 1e-3 };
  const ACT = { units: 1, milliunits: 1e-3 };
  const SUB = { mmol: 1, mEq: 1 };
  const VOL = { L: 1000, mL: 1 };

  const fin = (n) => (typeof n === 'number' && Number.isFinite(n) ? n : null);
  const pos = (v) => { const n = typeof v === 'number' ? v : parseFloat(v); return Number.isFinite(n) && n > 0 ? n : null; };
  const numv = (v) => { const n = typeof v === 'number' ? v : parseFloat(v); return Number.isFinite(n) ? n : null; };
  const round = (n, dp) => { if (fin(n) == null) return null; const p = Math.pow(10, dp == null ? 2 : dp); return Math.round(n * p) / p; };

  function family(u) {
    if (MASS[u] != null) return ['mass', MASS[u]];
    if (ACT[u] != null) return ['act', ACT[u]];
    if (SUB[u] != null) return ['sub', SUB[u]];
    if (VOL[u] != null) return ['vol', VOL[u]];
    return null;
  }
  // Factor that turns an amount in `from` into `to`, or null when the families differ.
  function factor(from, to) {
    const a = family(from), b = family(to);
    if (!a || !b || a[0] !== b[0]) return null;
    return a[1] / b[1];
  }
  function convert(value, from, to) { const f = factor(from, to); const v = numv(value); return f == null || v == null ? null : v * f; }

  // "mcg/kg/min" → { amount:'mcg', perKg:true, perMin:true }
  function parseUnit(u) {
    const parts = String(u || '').split('/');
    return { amount: parts[0], perKg: parts.indexOf('kg') > 0, perMin: parts[parts.length - 1] === 'min', timed: parts.length > 1 && /^(min|h)$/.test(parts[parts.length - 1]) };
  }

  // Amount of drug per mL of the prepared solution, expressed in `inUnit`.
  function concPerMl(conc, inUnit) {
    if (!conc) return null;
    const amt = pos(conc.amount), ml = pos(conc.ml);
    if (amt == null || ml == null) return null;
    const f = factor(conc.unit, inUnit || conc.unit);
    return f == null ? null : (amt * f) / ml;
  }

  // dose (in doseUnit) → mL/h.
  function rateFromDose(o) {
    const u = parseUnit(o.unit), dose = numv(o.dose);
    if (dose == null || dose < 0) return null;
    const w = u.perKg ? pos(o.weight) : 1;
    if (w == null) return null;
    const c = concPerMl(o.conc, u.amount);
    if (c == null) return null;
    const perHour = dose * w * (u.perMin ? 60 : 1);
    return perHour / c;
  }
  // mL/h → dose (in doseUnit).
  function doseFromRate(o) {
    const u = parseUnit(o.unit), rate = numv(o.rate);
    if (rate == null || rate < 0) return null;
    const w = u.perKg ? pos(o.weight) : 1;
    if (w == null) return null;
    const c = concPerMl(o.conc, u.amount);
    if (c == null) return null;
    return (rate * c) / (w * (u.perMin ? 60 : 1));
  }

  // Pumps step in 0.1 mL/h (0.01 below 1 mL/h on most syringe drivers).
  function roundToPump(rate) {
    const r = numv(rate);
    if (r == null) return null;
    return r < 1 ? Math.round(r * 100) / 100 : Math.round(r * 10) / 10;
  }

  // 'ok' | 'low' | 'high' | 'hard'  (hard = above the ceiling; never printable)
  function checkLimits(entry, dose) {
    const d = numv(dose);
    if (d == null || !entry) return null;
    const soft = entry.soft || [], hard = numv(entry.hard);
    if (hard != null && d > hard + 1e-9) return 'hard';
    if (numv(soft[1]) != null && d > soft[1] + 1e-9) return 'high';
    if (numv(soft[0]) != null && d < soft[0] - 1e-9) return 'low';
    return 'ok';
  }

  // Bedside titration chart: dose steps from the low end to the ceiling, with mL/h.
  function titrationTable(entry, conc, weight, rows) {
    if (!entry) return [];
    const lo = numv((entry.soft || [])[0]), top = numv(entry.hard) || numv((entry.soft || [])[1]);
    const step = pos(entry.step);
    if (lo == null || top == null || step == null) return [];
    const out = [];
    const max = rows || 14;
    // Start at the first step at/below the usual minimum so the start dose is on the chart.
    let d = Math.max(step, Math.floor(lo / step) * step);
    if (lo < step) d = lo;
    for (let i = 0; i < 60 && out.length < max && d <= top + 1e-9; i++) {
      const rate = rateFromDose({ dose: d, unit: entry.unit, weight: weight, conc: conc });
      out.push({ dose: round(d, 4), rate: rate == null ? null : roundToPump(rate), level: checkLimits(entry, d) });
      d = (i === 0 && lo < step) ? step : d + step;
    }
    return out;
  }

  // 24-h totals of a running infusion.
  function dailyTotals(entry, conc, rate) {
    const r = pos(rate);
    if (r == null || !conc) return null;
    const perMl = concPerMl(conc, conc.unit);
    return { ml: r * 24, amount: perMl == null ? null : perMl * r * 24, unit: conc.unit };
  }

  // How to make the solution from the stock ampoule.
  function prepPlan(conc, amp) {
    if (!conc || !amp) return null;
    const need = convert(conc.amount, conc.unit, amp.unit);
    const per = pos(amp.amount), ampMl = pos(amp.ml), vol = pos(conc.ml);
    if (need == null || per == null || ampMl == null || vol == null) return null;
    const ampoules = need / per;
    const drawMl = ampoules * ampMl;
    const diluentMl = vol - drawMl;
    return {
      ampoules: round(ampoules, 2), open: Math.ceil(ampoules - 1e-9), drawMl: round(drawMl, 2),
      diluentMl: round(Math.max(0, diluentMl), 1), undiluted: Math.abs(diluentMl) < 0.05, impossible: diluentMl < -0.05,
    };
  }

  // Simulated pump: what has gone in after `elapsedH` hours at `rate` mL/h of a `volume` mL syringe/bag.
  function pumpState(o) {
    const rate = numv(o.rate) || 0, vol = pos(o.volume), h = Math.max(0, numv(o.elapsedH) || 0);
    if (vol == null) return null;
    const infused = Math.min(vol, rate * h);
    const left = vol - infused;
    const hoursLeft = rate > 0 ? left / rate : null;
    return { infused: infused, left: left, fraction: left / vol, hoursLeft: hoursLeft, empty: left <= 1e-9, nearEmpty: left / vol < 0.1 };
  }

  // Gravity drip: drops/min from volume, minutes and the giving-set drop factor.
  function dripRate(volumeMl, minutes, dropFactor) {
    const v = pos(volumeMl), m = pos(minutes), f = pos(dropFactor);
    if (v == null || m == null || f == null) return null;
    return { dropsPerMin: (v * f) / m, mlPerHour: (v / m) * 60 };
  }
  function dripsFromRate(mlPerHour, dropFactor) {
    const r = pos(mlPerHour), f = pos(dropFactor);
    return r == null || f == null ? null : (r * f) / 60;
  }

  /* ---- body size ---- */
  function ibw(heightCm, sex) {
    const h = pos(heightCm);
    if (h == null) return null;
    const v = (sex === 'F' ? 45.5 : 50) + 0.9055 * (h - 152.4);   // Devine: 2.3 kg per inch over 5 ft
    return v > 0 ? v : null;
  }
  function adjBw(weight, ibwKg) {
    const w = pos(weight), i = pos(ibwKg);
    if (w == null || i == null) return null;
    return w > i ? i + 0.4 * (w - i) : w;
  }
  function bmi(weight, heightCm) { const w = pos(weight), h = pos(heightCm); return w == null || h == null ? null : w / Math.pow(h / 100, 2); }
  function bsaMosteller(weight, heightCm) { const w = pos(weight), h = pos(heightCm); return w == null || h == null ? null : Math.sqrt((w * h) / 3600); }
  // APLS weight estimate from age in years (1–12).
  function weightFromAge(age) {
    const a = numv(age);
    if (a == null || a < 0) return null;
    if (a < 1) return round(Math.max(3.5, (a * 12 + 9) / 2), 1);   // (months + 9) / 2
    if (a <= 5) return 2 * a + 8;
    if (a <= 12) return 3 * a + 7;
    return null;
  }

  /* ---- renal ---- */
  const scrMgDl = (scr, unit) => { const s = pos(scr); return s == null ? null : (unit === 'umol' ? s / 88.4 : s); };
  function crclCockcroftGault(o) {
    const age = pos(o.age), w = pos(o.weight), s = scrMgDl(o.scr, o.scrUnit);
    if (age == null || w == null || s == null) return null;
    return ((140 - age) * w * (o.sex === 'F' ? 0.85 : 1)) / (72 * s);
  }
  // CKD-EPI 2021 (race-free), mL/min/1.73 m².
  function egfrCkdEpi2021(o) {
    const age = pos(o.age), s = scrMgDl(o.scr, o.scrUnit);
    if (age == null || s == null) return null;
    const F = o.sex === 'F', k = F ? 0.7 : 0.9, a = F ? -0.241 : -0.302;
    return 142 * Math.pow(Math.min(s / k, 1), a) * Math.pow(Math.max(s / k, 1), -1.2) * Math.pow(0.9938, age) * (F ? 1.012 : 1);
  }
  // Bedside Schwartz (children), mL/min/1.73 m².
  function schwartzBedside(heightCm, scr, scrUnit) { const h = pos(heightCm), s = scrMgDl(scr, scrUnit); return h == null || s == null ? null : (0.413 * h) / s; }

  /* ---- fluids ---- */
  // Holliday–Segar 4-2-1 (mL/h) and 100/50/20 (mL/day).
  function maintenance421(weight) {
    const w = pos(weight);
    if (w == null) return null;
    const perH = w <= 10 ? 4 * w : w <= 20 ? 40 + 2 * (w - 10) : 60 + (w - 20);
    const perDay = w <= 10 ? 100 * w : w <= 20 ? 1000 + 50 * (w - 10) : 1500 + 20 * (w - 20);
    return { mlPerHour: perH, mlPerDay: perDay };
  }
  // Parkland: 4 mL × kg × %TBSA in 24 h, half in the first 8 h from the time of the burn.
  function parkland(weight, tbsa) {
    const w = pos(weight), t = pos(tbsa);
    if (w == null || t == null) return null;
    const total = 4 * w * Math.min(100, t);
    return { total: total, first8: total / 2, first8PerHour: total / 16, next16PerHour: total / 32 };
  }

  /* ---- sodium & water ---- */
  // Total body water fraction: child 0.6, adult man 0.6, woman 0.5, elderly man 0.5, elderly woman 0.45.
  function tbwFraction(sex, age) {
    const a = numv(age);
    if (a != null && a < 18) return 0.6;
    const old = a != null && a >= 65;
    if (sex === 'F') return old ? 0.45 : 0.5;
    return old ? 0.5 : 0.6;
  }
  function tbw(weight, sex, age) { const w = pos(weight); return w == null ? null : w * tbwFraction(sex, age); }
  function sodiumDeficit(o) {
    const t = tbw(o.weight, o.sex, o.age), cur = pos(o.na), target = pos(o.target);
    return t == null || cur == null || target == null ? null : t * (target - cur);
  }
  const FLUID_NA = { 'NS 0.9%': 154, '3% saline': 513, "Ringer's lactate": 130, '0.45% saline': 77, 'DNS (D5 + 0.9%)': 154, 'D5W': 0 };
  // Adrogué–Madias: change in serum Na from 1 L of the infusate.
  function adrogueMadias(o) {
    const t = tbw(o.weight, o.sex, o.age), na = pos(o.na);
    const inNa = numv(o.infusateNa), inK = numv(o.infusateK) || 0;
    if (t == null || na == null || inNa == null) return null;
    const perL = (inNa + inK - na) / (t + 1);
    const target = numv(o.targetChange);
    return { perLitre: perL, litresForTarget: target != null && perL !== 0 ? Math.abs(target / perL) : null };
  }
  function freeWaterDeficit(o) {
    const t = tbw(o.weight, o.sex, o.age), na = pos(o.na);
    return t == null || na == null ? null : t * (na / 140 - 1);
  }
  // Hillier: + 2.4 mmol/L per 100 mg/dL glucose above 100.
  function correctedSodium(na, glucose, glucoseUnit) {
    const n = pos(na), g = pos(glucose);
    if (n == null || g == null) return null;
    const mg = glucoseUnit === 'mmol' ? g * 18 : g;
    return n + 0.024 * (mg - 100);
  }
  // Calcium corrected for albumin (mg/dL with g/dL albumin, or mmol/L with g/L).
  function correctedCalcium(ca, alb, unit) {
    const c = pos(ca), a = pos(alb);
    if (c == null || a == null) return null;
    return unit === 'mmol' ? c + 0.02 * (40 - a) : c + 0.8 * (4 - a);
  }
  function anionGap(na, cl, hco3, albGdl) {
    const n = pos(na), c = pos(cl), h = pos(hco3);
    if (n == null || c == null || h == null) return null;
    const ag = n - (c + h);
    const a = pos(albGdl);
    return { gap: ag, corrected: a == null ? null : ag + 2.5 * (4 - a) };
  }
  function meanArterial(sbp, dbp) { const s = pos(sbp), d = pos(dbp); return s == null || d == null ? null : (s + 2 * d) / 3; }

  /* ---- unit converter ---- */
  // kind: 'mass' (value, from, to) | 'ratio' (1:N → mg/mL) | 'percent' (% → mg/mL) | 'mmol' (mg ↔ mmol with mw & valence)
  function convertUnits(o) {
    const v = numv(o.value);
    if (v == null) return null;
    if (o.kind === 'ratio') return v > 0 ? 1000 / v : null;           // 1:1000 → 1 mg/mL
    if (o.kind === 'percent') return v * 10;                          // 1% → 10 mg/mL
    if (o.kind === 'mg2mmol') { const mw = pos(o.mw); return mw == null ? null : v / mw; }
    if (o.kind === 'mmol2meq') return v * (pos(o.valence) || 1);
    return convert(v, o.from, o.to);
  }

  /* ---- emergency sheet ---- */
  function isAdult(weight, age) {
    const a = numv(age), w = pos(weight);
    if (a != null) return a >= 16;
    return w != null && w >= 50;
  }
  function emergencyDose(entry, weight, age) {
    const w = pos(weight);
    if (!entry || w == null) return null;
    const adult = isAdult(weight, age);
    const range = Array.isArray(entry.dose) ? entry.dose : [entry.dose, entry.dose];
    let lo = range[0] * w, hi = range[1] * w, capped = false, usedAdult = false;
    if (adult && entry.adult != null && !Array.isArray(entry.dose)) { lo = hi = entry.adult; usedAdult = true; }
    if (entry.min != null && !usedAdult) { if (lo < entry.min) lo = entry.min; if (hi < entry.min) hi = entry.min; }
    // The adult dose IS the adult dose — the paediatric single-dose ceiling (atropine 0.5 mg) does not apply to it.
    if (entry.max != null && !usedAdult) { if (hi > entry.max) { hi = entry.max; capped = true; } if (lo > entry.max) { lo = entry.max; capped = true; } }
    const ml = entry.perMl ? [lo / entry.perMl, hi / entry.perMl] : (entry.unit === 'mL' ? [lo, hi] : null);
    return { lo: lo, hi: hi, unit: entry.unit, ml: ml, capped: capped, adult: usedAdult, single: Math.abs(hi - lo) < 1e-9 };
  }
  function electricalDose(entry, weight, age) {
    const w = pos(weight);
    if (!entry || w == null) return null;
    const r = Array.isArray(entry.jPerKg) ? entry.jPerKg : [entry.jPerKg, entry.jPerKg];
    if (isAdult(weight, age)) return { lo: entry.adult, hi: entry.adult, adult: true, capped: false };
    const cap = Math.min(entry.adult, entry.max ? entry.max * w : Infinity);
    const lo = Math.min(cap, r[0] * w), hi = Math.min(cap, r[1] * w);
    return { lo: lo, hi: hi, adult: false, capped: r[1] * w > cap };
  }
  // ETT: uncuffed age/4 + 4, cuffed age/4 + 3.5, oral depth age/2 + 12 (APLS), for 1–12 y.
  function airway(age) {
    const a = numv(age);
    if (a == null) return null;
    if (a < 1) return { cuffed: 3.5, uncuffed: 3.5, depth: null, note: 'Infant: 3.0–3.5 cuffed (term), 3.5–4.0 uncuffed.' };
    if (a > 12) return { cuffed: null, uncuffed: null, depth: null, note: 'Adult: women 7.0–7.5, men 7.5–8.5; oral depth ≈ 21 / 23 cm at the teeth.' };
    // Round DOWN to the half size (a smaller tube passes); have ±0.5 ready.
    const half = (x) => Math.floor(x * 2 + 1e-9) / 2;
    return { cuffed: half(a / 4 + 3.5), uncuffed: half(a / 4 + 4), depth: round(a / 2 + 12, 1), note: 'Have the half size above and below ready.' };
  }
  function emergencySheet(lib, weight, age) {
    const em = (lib && lib.EMERGENCY) || [], el = (lib && lib.ELECTRICAL) || [];
    return {
      drugs: em.map((e) => ({ entry: e, dose: emergencyDose(e, weight, age) })),
      electrical: el.map((e) => ({ entry: e, dose: electricalDose(e, weight, age) })),
      airway: airway(age),
      fluid: maintenance421(weight),
    };
  }

  /* ---- paediatric ---- */
  // mgPerKg: the chosen figure inside entry.dose ([lo, hi]); defaults to the top of the range.
  function paedDose(entry, weight, strength, mgPerKg) {
    const w = pos(weight);
    if (!entry || w == null) return null;
    const range = entry.dose || [];
    const pick = numv(mgPerKg) != null ? numv(mgPerKg) : range[1];
    const perDay = Math.max(1, entry.perDay || 1);
    let dose = entry.mode === 'day' ? (pick * w) / perDay : pick * w;
    let capped = null;
    if (entry.maxDose != null && dose > entry.maxDose) { dose = entry.maxDose; capped = 'dose'; }
    let day = dose * perDay;
    const dayCap = Math.min(entry.maxDay != null ? entry.maxDay : Infinity, entry.maxDayPerKg != null ? entry.maxDayPerKg * w : Infinity);
    if (day > dayCap + 1e-9) { day = dayCap; dose = dayCap / perDay; capped = 'day'; }
    let volume = null, units = null;
    if (strength && strength.form) units = dose / strength.mg;                   // tablets / capsules
    else if (strength && pos(strength.mg) && pos(strength.ml)) volume = (dose / strength.mg) * strength.ml;
    return { dose: dose, day: day, perDay: perDay, mgPerKg: pick, volume: volume, units: units, capped: capped, outOfRange: pick < range[0] - 1e-9 || pick > range[1] + 1e-9 };
  }

  /* ---- library merge, hashing, ordering ---- */
  // FNV-1a over a stable JSON of the clinical content (never ids, review or ordering).
  function stableJson(v) {
    if (Array.isArray(v)) return '[' + v.map(stableJson).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => JSON.stringify(k) + ':' + stableJson(v[k])).join(',') + '}';
    return JSON.stringify(v == null ? null : v);
  }
  const META = { id: 1, kind: 1, review: 1, reviewed: 1, builtIn: 1, custom: 1, disabled: 1, updatedAt: 1, updatedBy: 1, overridden: 1 };
  function contentHash(entry) {
    const c = {};
    Object.keys(entry || {}).forEach((k) => { if (!META[k]) c[k] = entry[k]; });
    const s = stableJson(c);
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8);
  }
  const KIND_LIST = { infusion: 'INFUSIONS', emergency: 'EMERGENCY', paed: 'PAEDIATRIC' };
  // overrides: [{ id, kind, builtIn, disabled, data, review:{by, at, hash} }]
  function mergeLibrary(lib, overrides) {
    const byId = {};
    (overrides || []).forEach((o) => { if (o && o.id && o.id.charAt(0) !== '_') byId[o.id] = o; });
    const out = {};
    Object.keys(KIND_LIST).forEach((kind) => {
      const list = ((lib && lib[KIND_LIST[kind]]) || []).map((b) => {
        const o = byId[b.id];
        const e = Object.assign({}, b, o && o.data ? o.data : {}, { id: b.id, kind: kind, builtIn: true, overridden: !!(o && o.data && Object.keys(o.data).length), disabled: !!(o && o.disabled) });
        return withReview(e, o);
      });
      Object.keys(byId).forEach((id) => {
        const o = byId[id];
        if (o.kind !== kind || o.builtIn || list.some((x) => x.id === id) || !o.data) return;
        list.push(withReview(Object.assign({}, o.data, { id: id, kind: kind, builtIn: false, custom: true, disabled: !!o.disabled }), o));
      });
      out[kind] = list;
    });
    return out;
  }
  function withReview(e, o) {
    const r = o && o.review;
    const hash = contentHash(e);
    e.reviewed = !r || !r.hash ? { state: 'none' } : { state: r.hash === hash ? 'ok' : 'stale', by: r.by, at: r.at };
    return e;
  }
  // Items in the saved order; anything new goes to the end (in its own order), unknown ids are ignored.
  function applyOrder(items, order, key) {
    const get = key || ((x) => x.id);
    if (!Array.isArray(order) || !order.length) return items.slice();
    const pos = {};
    order.forEach((id, i) => { if (pos[id] == null) pos[id] = i; });
    return items.map((x, i) => ({ x: x, i: i, p: pos[get(x)] })).sort((a, b) => {
      if (a.p != null && b.p != null) return a.p - b.p;
      if (a.p != null) return -1;
      if (b.p != null) return 1;
      return a.i - b.i;
    }).map((r) => r.x);
  }
  function moveItem(list, from, to) {
    const a = list.slice();
    if (from < 0 || from >= a.length || to < 0 || to >= a.length || from === to) return a;
    const it = a.splice(from, 1)[0];
    a.splice(to, 0, it);
    return a;
  }

  // Human formatting: 2.625 → "2.63", 1250 → "1,250", 0.0125 → "0.0125".
  function fmt(n, dp) {
    if (fin(n) == null) return '—';
    const a = Math.abs(n);
    const d = dp != null ? dp : a >= 100 ? 0 : a >= 10 ? 1 : a >= 1 ? 2 : a >= 0.1 ? 3 : 4;
    // Trailing zeros are trimmed only AFTER a decimal point — "160" must never become "16".
    let s = (Math.round(n * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d);
    if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
    return s.indexOf('.') < 0 && Math.abs(n) >= 1000 ? Number(s).toLocaleString('en-US') : s;
  }

  const API = {
    MASS: MASS, ACT: ACT, FLUID_NA: FLUID_NA, round: round, fmt: fmt, factor: factor, convert: convert, parseUnit: parseUnit,
    concPerMl: concPerMl, rateFromDose: rateFromDose, doseFromRate: doseFromRate, roundToPump: roundToPump, checkLimits: checkLimits,
    titrationTable: titrationTable, dailyTotals: dailyTotals, prepPlan: prepPlan, pumpState: pumpState, dripRate: dripRate, dripsFromRate: dripsFromRate,
    ibw: ibw, adjBw: adjBw, bmi: bmi, bsaMosteller: bsaMosteller, weightFromAge: weightFromAge,
    crclCockcroftGault: crclCockcroftGault, egfrCkdEpi2021: egfrCkdEpi2021, schwartzBedside: schwartzBedside,
    maintenance421: maintenance421, parkland: parkland, tbwFraction: tbwFraction, tbw: tbw, sodiumDeficit: sodiumDeficit,
    adrogueMadias: adrogueMadias, freeWaterDeficit: freeWaterDeficit, correctedSodium: correctedSodium, correctedCalcium: correctedCalcium,
    anionGap: anionGap, meanArterial: meanArterial, convertUnits: convertUnits,
    isAdult: isAdult, emergencyDose: emergencyDose, electricalDose: electricalDose, airway: airway, emergencySheet: emergencySheet,
    paedDose: paedDose, contentHash: contentHash, mergeLibrary: mergeLibrary, applyOrder: applyOrder, moveItem: moveItem,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.UNICO_DOSE = API;
})(typeof window !== 'undefined' ? window : null);
