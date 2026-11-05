/* UNICO — Nursing KPI: the ONE rule for cycles, targets, status and period values.
   Shared by the server (server/kpi.js, server/kpi-link.js, the PowerPoint / Excel builders,
   require()) and the browser (window.UNICO_KPI: every KPI screen, the print and the PDF), so
   a KPI the dashboard paints red is exactly a KPI the exported deck paints red.

   The programme it replaces is "KPI for Nursing Department.pptx": per KPI an Objective, a
   Current figure, a Target, a Variance, an Action Plan, the Formula and "Monthly for 6 months
   & later for another 6 months" — two six-month cycles, each with its own target (Falls: 10
   by month 6, then 5). Months are 'YYYY-MM'; the quality data's 'Nov-26' converts both ways. */
(function (root) {
  const MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const FORMULAS = ['pct', 'rate1000', 'rate100', 'avg', 'count', 'direct'];
  const FORMULA_LABEL = {
    pct: 'Percentage — numerator ÷ denominator × 100',
    rate1000: 'Rate per 1,000 — numerator ÷ denominator × 1000',
    rate100: 'Rate per 100 — numerator ÷ denominator × 100',
    avg: 'Average — total ÷ count',
    count: 'Count — number of events',
    direct: 'Direct value — type the figure itself',
  };
  const DIRECTIONS = ['higher_is_better', 'lower_is_better'];
  const ACTION_STATUSES = ['open', 'progress', 'done', 'dropped'];
  const ACTION_LABEL = { open: 'Not started', progress: 'In progress', done: 'Done', dropped: 'Dropped' };
  const DEFAULT_PILLARS = [
    { id: 'safety', label: 'Patient Care & Safety', color: '#00293A', order: 1 },
    { id: 'workforce', label: 'Staffing & Workforce Management', color: '#37B4A6', order: 2 },
    { id: 'experience', label: "Patient's Experience", color: '#008FCB', order: 3 },
    { id: 'financial', label: 'Financial Performance', color: '#D9902B', order: 4 },
  ];
  const DEFAULT_CFG = { cycleStart: '2026-09', cycleMonths: 6, cycles: 2, nearBand: 10, autoFill: true, pillars: DEFAULT_PILLARS, reportTitle: 'KPI for Nursing Department', hospitalName: 'UNICO Hospitals PLC' };
  const STATUS = {
    met: { label: 'On target', color: '#1f9d57', bg: '#e7f6ed', ink: '#14713f' },
    near: { label: 'Close', color: '#e0a21e', bg: '#fff6e0', ink: '#8a5a00' },
    off: { label: 'Needs action', color: '#d23a52', bg: '#fde4e8', ink: '#a3172f' },
    notarget: { label: 'No target set', color: '#7b8796', bg: '#eef2f6', ink: '#5b6878' },
    nodata: { label: 'No data yet', color: '#a3adba', bg: '#f3f5f8', ink: '#7b8796' },
    notstarted: { label: 'Not started yet', color: '#b9c2cd', bg: '#f6f8fa', ink: '#7b8796' },
  };
  const PRESETS = [
    { id: '1m', label: 'One month', n: 1 },
    { id: '2m', label: '2 months', n: 2 },
    { id: '3m', label: '3 months', n: 3 },
    { id: '6m', label: '6 months', n: 6 },
    { id: '12m', label: '12 months', n: 12 },
    { id: 'cycle1', label: 'Cycle 1', cycle: 1 },
    { id: 'cycle2', label: 'Cycle 2', cycle: 2 },
    { id: 'custom', label: 'Custom' },
  ];
  const MAX_MONTHS = 36;
  const TZ_MS = 6 * 3600 * 1000; // hospital clock, Asia/Dhaka

  const pad = (n) => String(n).padStart(2, '0');
  const has = (v) => v !== null && v !== undefined && v !== '' && !(typeof v === 'number' && isNaN(v));
  const isMonth = (s) => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
  const addMonth = (ym, n) => { let y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1 + n; y += Math.floor(m / 12); m = ((m % 12) + 12) % 12; return y + '-' + pad(m + 1); };
  const monthDiff = (a, b) => (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5, 7) - +a.slice(5, 7));
  function monthsBetween(from, to) {
    if (!isMonth(from) || !isMonth(to) || to < from) return [];
    const out = []; let m = from;
    while (m <= to && out.length < MAX_MONTHS) { out.push(m); m = addMonth(m, 1); }
    return out;
  }
  const fmtMonth = (ym) => (isMonth(ym) ? MONS[+ym.slice(5, 7) - 1] + ' ' + ym.slice(0, 4) : String(ym || ''));
  const fmtMonthLong = (ym) => (isMonth(ym) ? MONS_FULL[+ym.slice(5, 7) - 1] + ' ' + ym.slice(0, 4) : String(ym || ''));
  const fmtRange = (from, to) => (from === to ? fmtMonthLong(from) : fmtMonth(from) + ' – ' + fmtMonth(to));
  // '2026-11' → 'Nov-26' (the quality data's month key) and back.
  const toMonKey = (ym) => MONS[+ym.slice(5, 7) - 1] + '-' + ym.slice(2, 4);
  function toYm(key) {
    const s = String(key || '').trim();
    if (isMonth(s)) return s;
    const m = /^([A-Za-z]{3})[- ](\d{2}|\d{4})$/.exec(s);
    if (!m) return null;
    const i = MONS.findIndex((x) => x.toLowerCase() === m[1].toLowerCase());
    if (i < 0) return null;
    return (m[2].length === 2 ? 2000 + +m[2] : +m[2]) + '-' + pad(i + 1);
  }
  // This month on the hospital calendar, and the last month that has fully ended.
  const thisMonth = (now) => new Date((now == null ? Date.now() : +now) + TZ_MS).toISOString().slice(0, 7);
  const lastClosedMonth = (now) => addMonth(thisMonth(now), -1);

  function cfgOf(cfg) {
    const c = Object.assign({}, DEFAULT_CFG, cfg || {});
    if (!isMonth(c.cycleStart)) c.cycleStart = DEFAULT_CFG.cycleStart;
    c.cycleMonths = Math.min(Math.max(parseInt(c.cycleMonths, 10) || 6, 1), 24);
    c.cycles = Math.min(Math.max(parseInt(c.cycles, 10) || 2, 1), 6);
    c.nearBand = Math.min(Math.max(has(c.nearBand) ? Number(c.nearBand) : 10, 0), 50);
    c.pillars = (Array.isArray(c.pillars) && c.pillars.length ? c.pillars : DEFAULT_PILLARS).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
    return c;
  }
  const pillarOf = (cfg, id) => cfgOf(cfg).pillars.find((p) => p.id === id) || { id: id || 'other', label: 'Other KPIs', color: '#5b6878', order: 99 };

  /* When a KPI starts counting: its own start month if it has one, else the programme's
     ("All KPIs start on", cfg.cycleStart). Cycles, targets and missing-data checks all count from
     here; months before it are "not started" and never reported as missing. */
  const startOf = (def, cfg) => (def && isMonth(def.startMonth) ? def.startMonth : cfgOf(cfg).cycleStart);
  const isStarted = (def, ym, cfg) => isMonth(ym) && ym >= startOf(def, cfg);

  /* The cycle a month falls in: index 1..cycles from the start, 0 before it (the baseline
     period), and cycles+1 after the last one ends (still judged by the last target). With a
     `def`, the cycles count from that KPI's own start. */
  function cycleOf(ym, cfg, def) {
    const c = cfgOf(cfg);
    const s = startOf(def, c);
    const d = monthDiff(s, ym);
    if (d < 0) return { index: 0, label: def ? 'Starts ' + fmtMonth(s) : 'Baseline (before the programme)', monthNo: null, start: s };
    const i = Math.floor(d / c.cycleMonths) + 1;
    if (i > c.cycles) return { index: c.cycles + 1, label: 'After cycle ' + c.cycles, monthNo: null, start: s };
    const start = addMonth(s, (i - 1) * c.cycleMonths);
    return { index: i, label: 'Cycle ' + i, start, end: addMonth(start, c.cycleMonths - 1), monthNo: d % c.cycleMonths + 1, of: c.cycleMonths };
  }
  function cycleRange(i, cfg, def) {
    const c = cfgOf(cfg);
    const k = Math.min(Math.max(i, 1), c.cycles);
    const from = addMonth(startOf(def, c), (k - 1) * c.cycleMonths);
    return { from, to: addMonth(from, c.cycleMonths - 1) };
  }
  // The report period for a preset, ending at `end` (default: the last closed month).
  function presetRange(preset, end, cfg) {
    const p = PRESETS.find((x) => x.id === preset) || PRESETS[0];
    if (p.cycle) return cycleRange(p.cycle, cfg);
    const to = isMonth(end) ? end : lastClosedMonth();
    return { from: addMonth(to, -((p.n || 1) - 1)), to };
  }
  // A cycle is named as a cycle first; otherwise by its length; otherwise 'custom'.
  function presetOf(from, to, cfg) {
    for (const p of PRESETS) if (p.cycle) { const r = cycleRange(p.cycle, cfg); if (r.from === from && r.to === to) return p.id; }
    for (const p of PRESETS) if (p.n && monthDiff(from, to) + 1 === p.n) return p.id;
    return 'custom';
  }

  function round(v, dp) { const f = Math.pow(10, dp == null ? 2 : dp); return Math.round(v * f) / f; }

  /* The target that applies in a month: the target of that month's cycle, else the nearest
     earlier cycle that has one (before the programme: cycle 1's). A KPI may instead set its
     target relative to its baseline (consumables: 5% below the existing cost). */
  function targetFor(def, ym, cfg) {
    const list = (def && Array.isArray(def.targets) ? def.targets : []).filter((t) => t && has(t.value));
    if (!list.length) {
      if (def && has(def.baselineTargetPct) && def.baseline && has(def.baseline.value)) {
        return round(Number(def.baseline.value) * (1 + Number(def.baselineTargetPct) / 100), 4);
      }
      return null;
    }
    const idx = Math.max(cycleOf(ym, cfg, def).index, 1);
    const sorted = list.slice().sort((a, b) => a.cycle - b.cycle);
    let hit = sorted[0];
    sorted.forEach((t) => { if (t.cycle <= idx) hit = t; });
    return Number(hit.value);
  }

  // The value of one month from its numerator and denominator (the quality data's rule, but
  // "no denominator" is NO VALUE here, never a zero — a KPI must not look met for lack of data).
  function computeValue(formula, num, den) {
    if (formula === 'count') return has(num) ? Number(num) : null;
    if (!has(num) || !has(den) || !(Number(den) > 0)) return null;
    const n = Number(num), d = Number(den);
    if (formula === 'rate1000') return round((n / d) * 1000);
    if (formula === 'avg') return round(n / d);
    return round((n / d) * 100); // pct, rate100
  }

  /* One period's value from its month cells: rates and averages pool Σnum ÷ Σden (never a mean
     of monthly rates); counts add up; a direct figure is the mean of the months that have one.
     Months that carry only a value (no num/den) fall back to the mean of values. */
  function periodValue(def, cells) {
    const f = (def && def.formula) || 'pct';
    const list = (cells || []).filter((c) => c && has(c.value));
    if (!list.length) return { value: null, num: null, den: null, months: 0 };
    if (f === 'count') return { value: round(list.reduce((a, c) => a + Number(c.value), 0)), num: null, den: null, months: list.length };
    if (f !== 'direct' && list.every((c) => has(c.num) && has(c.den) && Number(c.den) > 0)) {
      const n = list.reduce((a, c) => a + Number(c.num), 0), d = list.reduce((a, c) => a + Number(c.den), 0);
      return { value: computeValue(f, n, d), num: round(n, 4), den: round(d, 4), months: list.length };
    }
    return { value: round(list.reduce((a, c) => a + Number(c.value), 0) / list.length), num: null, den: null, months: list.length };
  }

  const lower = (def) => !!def && def.goalDirection === 'lower_is_better';
  // How far is still to go: positive = short of the target, 0 = exactly on it, negative = beyond it.
  function gap(def, value, target) {
    if (!has(value) || !has(target)) return null;
    return round(lower(def) ? Number(value) - Number(target) : Number(target) - Number(value));
  }
  /* met / near / off / notarget / nodata. "Near" = short of the target by no more than
     nearBand % of it (a zero target has no near band: one event is off). */
  function statusOf(def, value, target, cfg) {
    if (!has(value)) return 'nodata';
    if (!has(target)) return 'notarget';
    const g = gap(def, value, target);
    if (g <= 0) return 'met';
    const band = Math.abs(Number(target)) * cfgOf(cfg).nearBand / 100;
    return g <= band ? 'near' : 'off';
  }
  /* Achievement against the target as one comparable number (100 = exactly on target, capped
     at 150), so KPIs in different units can share one chart. Higher-is-better: value ÷ target.
     Lower-is-better: target ÷ value. A zero-harm target (lower-is-better, target 0) is 100 when
     there were no events and 0 when there were any — it has no "nearly". */
  function achievement(def, value, target) {
    if (!has(value) || !has(target)) return null;
    const v = Number(value), t = Number(target);
    let a;
    if (lower(def)) a = t <= 0 ? (v <= 0 ? 100 : 0) : (v <= 0 ? 150 : (t / v) * 100);
    else a = t <= 0 ? 100 : (v / t) * 100;
    return Math.round(Math.min(150, Math.max(0, a)));
  }
  // improving / worsening / steady, from the last two months that have a value.
  function trendOf(def, values) {
    const v = (values || []).filter(has).map(Number);
    if (v.length < 2) return null;
    const a = v[v.length - 2], b = v[v.length - 1];
    if (a === b) return 'steady';
    return (b < a) === lower(def) ? 'improving' : 'worsening';
  }

  /* Which figure a month shows: a saved row (typed by a KPI manager — for a linked KPI that is
     an edit of the system figure) wins; else the system figure; else nothing. Both stay visible.
     With auto-fill OFF (opts.autoFill === false) the system figure is never used by itself: it
     travels as `hint` only, and the month stays empty until someone types it. */
  function resolveCell(auto, saved, opts) {
    const a = auto && (has(auto.value) || has(auto.num)) ? auto : null;
    const fill = !(opts && opts.autoFill === false);
    if (saved && !saved.removedAt) {
      return { num: has(saved.num) ? saved.num : null, den: has(saved.den) ? saved.den : null, value: has(saved.value) ? saved.value : null,
        source: a && fill ? 'edited' : 'manual', note: saved.note || '', auto: fill ? a : null, hint: fill ? null : a,
        savedAt: saved.updatedAt, savedBy: saved.updatedByName || saved.updatedBy || '', confirmed: !!saved.confirmed };
    }
    if (a && fill) return Object.assign({ note: '' }, a, { source: a.source || 'system', auto: a });
    return { num: null, den: null, value: null, source: 'missing', note: '', auto: null, hint: fill ? null : a };
  }

  // Every formula whose numerator and denominator are counts of people or events. All 17 KPIs of
  // the deck are like this; only an average (minutes, cost) or a typed value may carry decimals.
  const COUNTED = ['pct', 'rate1000', 'rate100', 'count'];
  const isWhole = (v) => Number.isInteger(Number(v));

  // A typed month: returns an error string, or null. Figures are checked, not trusted.
  function validateEntry(def, e) {
    const f = (def && def.formula) || 'pct';
    const num = (v) => has(v) && isFinite(Number(v));
    const nl = ((def && def.numLabel) || 'numerator'), dl = ((def && def.denLabel) || 'denominator');
    if (f === 'direct') {
      if (!num(e.value)) return 'Type the value.';
      if (Math.abs(Number(e.value)) > 1e9) return 'That value is too large.';
      return null;
    }
    if (!num(e.num)) return 'Type the ' + nl.toLowerCase() + '.';
    if (Number(e.num) < 0) return 'The ' + nl.toLowerCase() + ' cannot be negative.';
    if (COUNTED.indexOf(f) >= 0 && !isWhole(e.num)) return 'The ' + nl.toLowerCase() + ' is a count — it must be a whole number.';
    if (Number(e.num) > 1e9) return 'That value is too large.';
    if (f === 'count') return null;
    if (!num(e.den)) return 'Type the ' + dl.toLowerCase() + '.';
    if (!(Number(e.den) > 0)) return 'The ' + dl.toLowerCase() + ' must be more than 0.';
    if (COUNTED.indexOf(f) >= 0 && !isWhole(e.den)) return 'The ' + dl.toLowerCase() + ' is a count — it must be a whole number.';
    if (f === 'pct' && Number(e.num) > Number(e.den)) return 'The ' + nl.toLowerCase() + ' cannot be more than the ' + dl.toLowerCase() + ' for a percentage.';
    if (Number(e.den) > 1e9) return 'That value is too large.';
    return null;
  }

  // The median of the values that exist (null when there are none).
  function medianOf(values) {
    const v = (values || []).filter(has).map(Number).sort((a, b) => a - b);
    if (!v.length) return null;
    const m = Math.floor(v.length / 2);
    return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
  }
  /* Is a new figure far from the recent ones? Needs at least `minPriors` earlier values and a
     non-zero median (a zero-harm KPI's median is 0, and any event would look like a jump).
     Returns null (fine) or { median, ratio }. */
  function deviates(value, priors, opts) {
    const o = opts || {};
    const p = (priors || []).filter(has).map(Number);
    if (!has(value) || p.length < (o.minPriors || 2)) return null;
    const med = medianOf(p);
    if (!med) return null;
    const ratio = Number(value) / med;
    const band = o.band == null ? 0.5 : o.band;
    return ratio > 1 + band || ratio < 1 - band ? { median: round(med), ratio: round(ratio) } : null;
  }

  /* The data checks. Level decides what Finalise does: an 'error' blocks it until the data is
     fixed or the error is acknowledged with a reason (printed on the report); a 'warn' is printed;
     'info' is shown. The server (server/kpi-evidence.js) decides when each fires; the screens,
     the print, the PowerPoint and the Excel all take their wording from here. */
  const CHECK_META = {
    'unit-missing': { level: 'error', title: 'A unit did not report', fix: 'Ask the unit to send this indicator for the month in Data Submission — or, if it does not measure it, mark it “Not measured” in Department Setup, or take it off this KPI’s “Units expected”.' },
    partial: { level: 'error', title: 'Events without a denominator', fix: 'The unit sent the events but not the denominator (device days / patient-days / procedures). Complete the quality submission.' },
    'den-zero': { level: 'error', title: 'Denominator is zero', fix: 'Events were counted against a denominator of 0. Correct the denominator in the quality data.' },
    impossible: { level: 'error', title: 'Figure cannot be right', fix: 'A percentage over 100, more events than the denominator, or a negative value. Correct the source figure.' },
    'dd-mismatch': { level: 'error', title: 'Device days do not match', fix: 'The denominator in the quality data differs from the approved Device Days total for the month. Correct one of them so they agree.' },
    override: { level: 'warn', title: 'System figure changed by hand', fix: 'A KPI manager typed over the figure from the quality data. The note says why.' },
    'override-no-note': { level: 'error', title: 'System figure changed without a reason', fix: 'Open the month in Data Update and add a note saying why the system figure was changed — or revert to the system figure.' },
    'pending-newer': { level: 'warn', title: 'A newer figure is waiting for approval', fix: 'A unit has sent a new figure for this month that is not approved yet. Approve or return it in Data Collection, then refresh.' },
    'overlay-edit': { level: 'warn', title: 'Edited in the Quality console', fix: 'The figure used is a Quality-console edit, not the approved submission. Check it is intended.' },
    'dd-incomplete': { level: 'warn', title: 'Device Days not complete', fix: 'Some days of the month are missing or waiting for review in Device Days, so the denominator may be short.' },
    'patient-days-mismatch': { level: 'warn', title: 'Patient-days differ from Device Days', fix: 'The patient-days used differ by more than 5% from the unit’s approved Device Days total patients. Check which is right.' },
    'stale-den': { level: 'warn', title: 'Old headcount carried forward', fix: 'The staff headcount used was entered more than 3 months ago. Enter this month’s headcount in Quality → Indicator Administration.' },
    outlier: { level: 'warn', title: 'Unusual figure', fix: 'Far from the KPI’s recent months. Check the source figures are right.' },
    'setup-drift': { level: 'warn', title: 'Units expected differ from Department Setup', fix: 'This KPI’s “Units expected” list differs from the units Department Setup says report the indicator. Update one of them.' },
    'not-observed': { level: 'info', title: 'Marked not observed', fix: 'The unit marked this month as not observed.' },
    'sub-unmatched': { level: 'info', title: 'Submission not traced', fix: 'The approved figure could not be matched to its submission (an older or administrator-entered figure).' },
    'no-target': { level: 'info', title: 'No target', fix: 'Set a target for this cycle in Manage KPIs.' },
    'no-data': { level: 'error', title: 'No figure for the month', fix: 'Enter the figure in Data Update.' },
  };
  const checkLevel = (code) => (CHECK_META[code] || { level: 'info' }).level;

  /* The calculation, in words — the same sentences on the screen, the print, the PowerPoint and
     the Excel. `ev` is an evidence record (server/kpi-evidence.js). */
  const MULT = { pct: 100, rate100: 100, rate1000: 1000 };
  function evidenceSteps(def, ev) {
    const f = (def && def.formula) || 'pct';
    const t = (ev && ev.totals) || {};
    const used = ((ev && ev.units) || []).filter((u) => u.used);
    const unitWord = used.length === 1 ? '1 source' : used.length + ' sources';
    const nl = (def && def.numLabel) || 'numerator', dl = (def && def.denLabel) || 'denominator';
    const out = [];
    if (ev && ev.override) {
      out.push('Figure entered in the KPI module by ' + (ev.override.by || 'a KPI manager') + (ev.override.note ? ' — “' + ev.override.note + '”' : '') + '.');
      if (ev.override.autoValue != null) out.push('The quality data gave ' + fmt(def, ev.override.autoValue) + '; the entered figure is used instead.');
    }
    if (f === 'direct') { out.push('Value entered: ' + fmt(def, t.value) + '.'); return out; }
    if (has(t.num)) out.push(nl + ': ' + round(t.num, 4) + (used.length > 1 ? ' (sum over ' + unitWord + ')' : '') + '.');
    if (f !== 'count' && has(t.den)) out.push(dl + ': ' + round(t.den, 4) + (used.length > 1 ? ' (sum over ' + unitWord + ')' : '') + '.');
    if (f === 'count') out.push('Value = the count = ' + fmt(def, t.value) + '.');
    else if (has(t.num) && has(t.den) && Number(t.den) > 0) out.push(round(t.num, 4) + ' ÷ ' + round(t.den, 4) + (MULT[f] ? ' × ' + MULT[f] : '') + ' = ' + fmt(def, t.value) + '.');
    else if (!has(t.value)) out.push('No value: ' + (has(t.num) ? 'the ' + dl + ' is missing.' : 'no figures for the month.'));
    if (used.length > 1 && f !== 'count') out.push('Pooled — the units’ numerators and denominators are added first and divided once; it is not an average of the units’ rates.');
    return out;
  }

  // "69.5%", "1.24", "4 min", "Tk 120" — the unit the KPI declares, the decimals it asks for.
  function unitKind(def) {
    const u = String((def && def.unit) || '').toLowerCase();
    if (u === '%' || (def && def.formula === 'pct')) return 'pct';
    if (/min/.test(u)) return 'min';
    if (/cost|bdt|taka|৳|tk/.test(u)) return 'money';
    return 'num';
  }
  function fmt(def, v, opts) {
    if (!has(v)) return '—';
    const k = unitKind(def);
    const dp = def && has(def.decimals) ? Math.min(Math.max(+def.decimals, 0), 4) : (k === 'money' ? 0 : 2);
    const s = (Math.round(Number(v) * Math.pow(10, dp)) / Math.pow(10, dp)).toLocaleString('en-US', { maximumFractionDigits: dp });
    if (opts && opts.bare) return s;
    if (k === 'pct') return s + '%';
    if (k === 'min') return s + ' min';
    if (k === 'money') return 'Tk ' + s;
    return s;
  }
  // Short unit caption under a figure: "per 1000 patient-days", "%", "minutes".
  const unitLabel = (def) => String((def && def.unit) || '').trim();
  function gapLabel(def, value, target) {
    const g = gap(def, value, target);
    if (g == null) return '—';
    if (g === 0) return 'On target';
    const s = fmt(def, Math.abs(g));
    return g > 0 ? s + ' to go' : 'Beyond by ' + s;
  }

  const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
  function newKpiId(name, taken) {
    const base = 'kpi-c-' + (slug(name) || 'custom');
    let id = base, n = 2;
    while ((taken || []).indexOf(id) >= 0) id = base + '-' + (n++);
    return id;
  }

  /* Rows of a report from its definitions and month cells — the one place the period figure,
     target, gap, status and trend are decided, for the screen, the print and both office files.
     defs: [def]; cellsByKpi: { kpiId: { ym: cell } }; months: period months; trendMonths: the
     12-month window ending with the period (for the charts). */
  function buildRows(defs, cellsByKpi, months, trendMonths, cfg) {
    const end = months[months.length - 1];
    return (defs || []).map((def) => {
      const cells = (cellsByKpi && cellsByKpi[def.id]) || {};
      // Months before the KPI starts do not count: not in the period value, not in the trend.
      const on = (m) => isStarted(def, m, cfg);
      const started = months.filter(on);
      const per = periodValue(def, started.map((m) => cells[m]));
      const target = targetFor(def, end, cfg);
      const trend = (trendMonths || months).map((m) => ({ m, v: on(m) && cells[m] && has(cells[m].value) ? Number(cells[m].value) : null, t: on(m) ? targetFor(def, m, cfg) : null }));
      const status = started.length ? statusOf(def, per.value, target, cfg) : 'notstarted';
      return {
        kpiId: def.id, code: def.code || '', name: def.name, pillar: def.pillar, unit: def.unit || '', formula: def.formula, goalDirection: def.goalDirection,
        decimals: def.decimals, objective: def.objective || '', formulaText: def.formulaText || '', numLabel: def.numLabel || '', denLabel: def.denLabel || '',
        baseline: def.baseline || null, targets: def.targets || [], baselineTargetPct: def.baselineTargetPct, actions: (def.actions || []).filter((x) => x && x.text), remarks: def.remarks || '',
        frequency: def.frequency || '', linked: !!(def.source && def.source.indId), autoFill: def.autoFill !== false,
        startMonth: startOf(def, cfg), ownStart: isMonth(def.startMonth), cycle: cycleOf(end, cfg, def),
        cells: months.reduce((o, m) => { const c = cells[m]; o[m] = !on(m) ? { value: null, source: 'not-started' } : c ? { num: c.num, den: c.den, value: c.value, source: c.source } : { value: null, source: 'missing' }; return o; }, {}),
        period: per, target, gap: status === 'notstarted' ? null : gap(def, per.value, target), status, achievement: status === 'notstarted' ? null : achievement(def, per.value, target),
        trendDir: trendOf(def, trend.map((t) => t.v)), trend,
      };
    });
  }
  function summarize(rows) {
    const out = { total: 0, met: 0, near: 0, off: 0, notarget: 0, nodata: 0, notstarted: 0, improving: 0, worsening: 0 };
    (rows || []).forEach((r) => { out.total++; out[r.status] = (out[r.status] || 0) + 1; if (r.trendDir === 'improving') out.improving++; if (r.trendDir === 'worsening') out.worsening++; });
    out.scored = out.met + out.near + out.off;
    out.score = out.scored ? Math.round((out.met / out.scored) * 100) : null;
    return out;
  }
  // Report id = its period: '2026-10_2026-10' (one month), '2026-09_2027-02' (a cycle).
  const reportId = (from, to) => from + '_' + to;
  function parseReportId(id) {
    const m = /^(\d{4}-\d{2})_(\d{4}-\d{2})$/.exec(String(id || ''));
    if (!m || !isMonth(m[1]) || !isMonth(m[2]) || m[2] < m[1] || monthDiff(m[1], m[2]) >= MAX_MONTHS) return null;
    return { from: m[1], to: m[2] };
  }

  const API = {
    MONS, MONS_FULL, FORMULAS, FORMULA_LABEL, DIRECTIONS, ACTION_STATUSES, ACTION_LABEL, DEFAULT_PILLARS, DEFAULT_CFG, STATUS, PRESETS, MAX_MONTHS,
    has, isMonth, addMonth, monthDiff, monthsBetween, fmtMonth, fmtMonthLong, fmtRange, toMonKey, toYm, thisMonth, lastClosedMonth,
    cfgOf, pillarOf, startOf, isStarted, cycleOf, cycleRange, presetRange, presetOf, targetFor, round, computeValue, periodValue, gap, statusOf, trendOf, achievement,
    resolveCell, validateEntry, medianOf, deviates, CHECK_META, checkLevel, evidenceSteps, COUNTED, unitKind, fmt, unitLabel, gapLabel, slug, newKpiId, buildRows, summarize, reportId, parseReportId,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.UNICO_KPI = API;
})(typeof window !== 'undefined' ? window : null);
