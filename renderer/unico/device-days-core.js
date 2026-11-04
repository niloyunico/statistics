/* UNICO — Device Days: the ONE rule for "which day is due, sent, or missed".
   Shared by the server (server/device-days.js, require()) and the browser (window.UNICO_DD:
   the Device Days screens, the sidebar badge and the quality-form denominator hint), so
   a day the sheet paints red is exactly a day the badge counts.

   The paper form it replaces — "Record of Device Insertion Days" — is one row per day:
   Date · Time · Total patients · Peripheral line · Central line · Urinary catheter · Ventilator.
   A department always fills a row per day; the administrator's frequency only decides how
   often those rows are SENT: each day (daily), once the week has ended (weekly), or once the
   month has ended (monthly). Days are on the hospital calendar (Asia/Dhaka, UTC+6, no DST). */
(function (root) {
  const FIELDS = [
    { id: 'total', label: 'Total Patients', short: 'Patients' },
    { id: 'peripheral', label: 'Patients with Peripheral Line', short: 'Peripheral' },
    { id: 'central', label: 'Patients with Central Line', short: 'Central' },
    { id: 'urinary', label: 'Patients with Urinary Catheter', short: 'Urinary cath.' },
    { id: 'ventilator', label: 'Patients with Ventilator', short: 'Ventilator' },
  ];
  const DEVICES = ['peripheral', 'central', 'urinary', 'ventilator'];
  const FREQS = ['daily', 'weekly', 'monthly'];
  const DEFAULT_CFG = { tracked: false, frequency: 'daily', startDate: '', cutoff: '10:00', census: '08:00', weekStart: 6 }; // 6 = Saturday
  const MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const TZ_MS = 6 * 3600 * 1000;

  // Quality indicators whose denominator is a device-day count (formula id → field).
  const QI_FIELD = {
    'central-line-associated-bloodstream-infection-clabsi-rate': 'central',
    'catheter-associated-urinary-tract-infection-cauti-rate': 'urinary',
    'accidental-unplanned-catheter-removal-rate': 'urinary',
    'ventilator-associated-pneumonia-vap-rate': 'ventilator',
    'ventilator-associated-event-vae-rate': 'ventilator',
    'unplanned-accidental-extubation-rate': 'ventilator',
  };

  const pad = (n) => String(n).padStart(2, '0');
  const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + 'T00:00:00Z'));
  const isMonth = (s) => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
  // Calendar arithmetic on 'YYYY-MM-DD' strings, done in UTC so no local zone can shift a day.
  const toUTC = (d) => Date.parse(d + 'T00:00:00Z');
  const fromUTC = (ms) => new Date(ms).toISOString().slice(0, 10);
  const addDays = (d, n) => fromUTC(toUTC(d) + n * 86400000);
  const dow = (d) => new Date(toUTC(d)).getUTCDay();
  const monthOf = (d) => d.slice(0, 7);
  const daysInMonth = (ym) => { const y = +ym.slice(0, 4), m = +ym.slice(5, 7); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };
  const monthDays = (ym) => { const n = daysInMonth(ym), out = []; for (let i = 1; i <= n; i++) out.push(ym + '-' + pad(i)); return out; };
  const fmtDay = (d) => +d.slice(8, 10) + ' ' + MONS[+d.slice(5, 7) - 1];
  const fmtMonth = (ym) => MONS[+ym.slice(5, 7) - 1] + ' ' + ym.slice(0, 4);

  // "Now" on the hospital calendar: { date:'YYYY-MM-DD', minutes since midnight }.
  function hospitalNow(now) {
    const t = new Date((now == null ? Date.now() : +now) + TZ_MS);
    return { date: t.toISOString().slice(0, 10), minutes: t.getUTCHours() * 60 + t.getUTCMinutes() };
  }
  const cutoffMin = (c) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(c || '')); return m ? Math.min(+m[1], 23) * 60 + Math.min(+m[2], 59) : 600; };

  // Month labels the quality data uses ('Nov-26') and the ISO form ('2026-11'), both accepted.
  function monthKey(label) {
    const s = String(label || '').trim();
    if (isMonth(s)) return s;
    const m = /^([A-Za-z]{3})[- ](\d{2}|\d{4})$/.exec(s);
    if (!m) return null;
    const i = MONS.findIndex((x) => x.toLowerCase() === m[1].toLowerCase());
    if (i < 0) return null;
    const y = m[2].length === 2 ? 2000 + +m[2] : +m[2];
    return y + '-' + pad(i + 1);
  }

  function cfgOf(cfg) {
    const c = Object.assign({}, DEFAULT_CFG, cfg || {});
    if (FREQS.indexOf(c.frequency) < 0) c.frequency = 'daily';
    c.weekStart = Number.isInteger(+c.weekStart) && +c.weekStart >= 0 && +c.weekStart <= 6 ? +c.weekStart : 6;
    return c;
  }

  // The sending period a day belongs to: { key, from, to, label }.
  function periodOf(date, cfg) {
    const c = cfgOf(cfg);
    if (c.frequency === 'monthly') {
      const ym = monthOf(date);
      return { key: ym, from: ym + '-01', to: ym + '-' + pad(daysInMonth(ym)), label: fmtMonth(ym) };
    }
    if (c.frequency === 'weekly') {
      const from = addDays(date, -((dow(date) - c.weekStart + 7) % 7));
      const to = addDays(from, 6);
      return { key: 'W' + from, from, to, label: fmtDay(from) + ' – ' + fmtDay(to) };
    }
    return { key: date, from: date, to: date, label: fmtDay(date) };
  }

  // When a day's row must be sent by: { date, minutes } on the hospital calendar.
  // Daily: that day at the cut-off. Weekly / monthly: the day after the period ends, at the cut-off.
  function dueOf(date, cfg) {
    const c = cfgOf(cfg);
    const p = periodOf(date, c);
    return { date: c.frequency === 'daily' ? date : addDays(p.to, 1), minutes: cutoffMin(c.cutoff) };
  }
  const isPast = (due, hn) => hn.date > due.date || (hn.date === due.date && hn.minutes >= due.minutes);

  /* One day's state.
     approved / submitted / returned — the row's own review state;
     future     — after today: cannot be filled yet;
     not-due    — department not tracked, or before its start date;
     missing    — the send deadline passed and the row was not sent (a saved draft too);
     open       — still within time (today, or the current week / month). */
  function dayState(date, row, cfg, now) {
    const c = cfgOf(cfg);
    const hn = hospitalNow(now);
    const st = row && !row.removedAt ? row.status : null;
    if (st === 'approved' || st === 'submitted') return st;
    if (date > hn.date) return 'future';
    if (!c.tracked || (c.startDate && date < c.startDate)) return st === 'returned' ? 'returned' : 'not-due';
    if (st === 'returned') return 'returned';
    return isPast(dueOf(date, c), hn) ? 'missing' : 'open';
  }

  // Row checks the server enforces and the sheet shows live. Returns an error string or null.
  // `fields` = the form's columns (fieldsOf); every column after Total Patients is a count of
  // patients, so none may exceed it.
  function validateRow(r, fields) {
    const list = fields || FIELDS;
    for (const f of list) {
      const v = r[f.id];
      if (v === '' || v == null) return f.label + ' is required.';
      if (!Number.isInteger(+v) || +v < 0 || +v > 9999) return f.label + ' must be a whole number from 0 to 9999.';
    }
    for (const f of list) if (f.id !== 'total' && +r[f.id] > +r.total) return f.label + ' cannot be more than Total Patients.';
    if (r.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(r.time)) return 'Time must be HH:MM.';
    return null;
  }

  // Sum of the given rows (only those with a status in `statuses`, all when omitted).
  function totals(rows, statuses, fields) {
    const list = fields || FIELDS;
    const out = { days: 0 };
    list.forEach((f) => { out[f.id] = 0; });
    (rows || []).forEach((r) => {
      if (!r || r.removedAt || (statuses && statuses.indexOf(r.status) < 0)) return;
      out.days++;
      list.forEach((f) => { out[f.id] += +r[f.id] || 0; });
    });
    return out;
  }
  /* The form's columns: the four built-in device counts, then the administrator's own columns
     (config.fields, e.g. "Patients with NG tube"). A custom column's id is its data key and is
     never changed; "removing" one only hides it (active:false), so its saved values stay. */
  const cleanCustom = (list) => (Array.isArray(list) ? list : []).filter((f) => f && /^c_[a-z0-9_]{1,40}$/.test(f.id) && f.label)
    .map((f) => ({ id: f.id, label: String(f.label).slice(0, 80), short: String(f.short || f.label).slice(0, 24), active: f.active !== false, custom: true }));
  const fieldsOf = (cfgDoc, includeHidden) => FIELDS.concat(cleanCustom(cfgDoc && cfgDoc.fields).filter((f) => includeHidden || f.active));
  const customId = (label, taken) => {
    const base = 'c_' + (String(label || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30) || 'col');
    let id = base, n = 2; while ((taken || []).indexOf(id) >= 0) id = base + '_' + (n++);
    return id;
  };

  // Device utilisation ratio, e.g. central-line days ÷ patient days, as a % (null when no patient days).
  const utilisation = (t, field) => (t && t.total > 0 ? Math.round((t[field] / t.total) * 1000) / 10 : null);

  // Indicator name → canonical formula id, through the same alias table the quality data uses
  // (server/quality-formulas.js norm + slug). Browser only: needs window.QI_CORRECTIONS.
  const normName = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  function fieldForIndicator(name, corrections) {
    const tbl = corrections || (root && root.QI_CORRECTIONS) || {};
    const hit = tbl[normName(name)];
    const id = slug((hit && hit.canonicalName) || name);
    return QI_FIELD[id] || null;
  }

  const API = {
    FIELDS, DEVICES, FREQS, DEFAULT_CFG, MONS, QI_FIELD,
    isDate, isMonth, addDays, dow, monthOf, daysInMonth, monthDays, fmtDay, fmtMonth, monthKey,
    hospitalNow, cutoffMin, cfgOf, periodOf, dueOf, dayState, validateRow, totals, utilisation,
    fieldForIndicator, fieldsOf, cleanCustom, customId,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.UNICO_DD = API;

  /* The quality forms' suggested denominator: for a CLABSI / CAUTI / VAP-type indicator, the
     department's APPROVED device days for that month, with a "Use" button. It never fills the
     field by itself. Lives here (core) because the quality forms are in other chunks.
     Props: { deptId, month ('Nov-26' | '2026-11'), indicatorName, onUse(value) }. */
  if (root && root.React) {
    const cache = {};
    const fetchSuggest = (deptId, ym) => {
      const k = deptId + '|' + ym, hit = cache[k];
      if (hit && Date.now() - hit.at < 60000) return hit.p;
      const p = fetch('/api/device-days/suggest?dept=' + encodeURIComponent(deptId) + '&month=' + ym, { credentials: 'same-origin', cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null)).catch(() => null);
      cache[k] = { at: Date.now(), p };
      return p;
    };
    root.UnicoDeviceDaysHint = function UnicoDeviceDaysHint(props) {
      const R = root.React;
      const field = fieldForIndicator(props.indicatorName);
      const ym = monthKey(props.month);
      const [s, setS] = R.useState(null);
      R.useEffect(() => {
        setS(null);
        if (!field || !props.deptId || !ym) return;
        let live = true;
        fetchSuggest(props.deptId, ym).then((j) => { if (live && j && j.ok && j.tracked) setS(j); });
        return () => { live = false; };
      }, [field, props.deptId, ym]);
      if (!field || !s) return null;
      const v = s.approved[field];
      const f = FIELDS.find((x) => x.id === field);
      const gaps = (s.missing || 0) + (s.waiting || 0);
      const h = R.createElement;
      return h('div', { style: { marginTop: 6, padding: '6px 9px', borderRadius: 7, fontSize: 11.5, lineHeight: 1.4, border: '1px solid ' + (gaps ? '#f0d49a' : '#a8e3da'), background: gaps ? '#fff8e9' : '#ecfaf7', color: gaps ? '#7a4b00' : '#0d5e55', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' } },
        h('span', null, 'Device Days (approved): ', h('b', null, v), ' ' + f.short.toLowerCase() + ' days in ' + fmtMonth(ym) + ' · ' + s.approved.days + '/' + s.daysInMonth + ' days approved'
          + (gaps ? ' — ' + [s.missing ? s.missing + ' missed' : '', s.waiting ? s.waiting + ' not approved yet' : ''].filter(Boolean).join(', ') + ', so this may be incomplete.' : '.')),
        props.onUse && v > 0 ? h('button', { type: 'button', onClick: () => props.onUse(v), style: { border: '1px solid currentColor', background: '#fff', color: 'inherit', borderRadius: 6, padding: '1px 9px', font: 'inherit', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' } }, 'Use ' + v) : null);
    };
  }
})(typeof window !== 'undefined' ? window : null);
