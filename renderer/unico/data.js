// UNICO HOSPITALS PLC — Patient Flow Census
// The monthly statistics now live in MongoDB (the `departments` collection) and
// are injected by the Express web server as window.__UNICO_DEPARTMENTS__ before
// this script runs. There are NO hardcoded monthly numbers in this file anymore.
// To edit the seed data: server/seed/departments.json, then
//   npm --prefix server run seed-departments -- --force

// Lifetime month catalog: generated across many years so the suite keeps working
// indefinitely — every month gets a proper label and a stable chronological order
// (sorting/period logic everywhere relies on MONTH_ORDER.indexOf).
const _MMM  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const _MFULL= ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_FULL = {};
const MONTH_ORDER = [];
for (let y = 2024; y <= 2045; y++) {
  for (let m = 0; m < 12; m++) {
    const key = _MMM[m] + '-' + String(y).slice(-2);
    MONTHS_FULL[key] = _MFULL[m] + ' ' + y;
    MONTH_ORDER.push(key);
  }
}

// Department definitions (metadata + months[] + monthly data[]) come from the
// database via the server-injected global. Clone so the computed helpers below
// never mutate the injected source.
const DEPARTMENTS = (typeof window !== 'undefined' && Array.isArray(window.__UNICO_DEPARTMENTS__))
  ? window.__UNICO_DEPARTMENTS__.map(d => ({ ...d }))
  : [];

// Attach the derived fields the app expects (series/total/latest/prev/delta/peak),
// guarded so a department with no rows can't throw.
DEPARTMENTS.forEach(d => {
  d.months = Array.isArray(d.months) ? d.months : [];
  d.data   = Array.isArray(d.data) ? d.data : [];
  d.cols   = Array.isArray(d.cols) ? d.cols : [];
  d.fullMonths = d.months.map(m => MONTHS_FULL[m] || m);
  d.series = d.data.map((row, i) => ({ month: d.months[i], full: MONTHS_FULL[d.months[i]] || d.months[i], ...row }));
  if (!d.series.length) { d.total = 0; d.latest = {}; d.prev = null; d.delta = 0; d.peak = 0; return; }
  d.total = d.series.reduce((s, r) => s + (r[d.primary] || 0), 0);
  d.latest = d.series[d.series.length - 1];
  d.prev = d.series.length > 1 ? d.series[d.series.length - 2] : null;
  const cur = d.latest[d.primary] || 0;
  const prev = d.prev ? (d.prev[d.primary] || 0) : 0;
  d.delta = prev === 0 ? (cur > 0 ? 100 : 0) : Math.round(((cur - prev) / prev) * 100);
  d.peak = Math.max(0, ...d.series.map(r => r[d.primary] || 0));
});

const GROUPS = [...new Set(DEPARTMENTS.map(d => d.group))];

// Hospital-wide rollups for the dashboard (guarded against missing departments).
const HOSPITAL = {
  name: "UNICO Hospitals PLC",
  reportRange: "Aug 2025 – May 2026",
  generated: "05/18/2026",
  kpis: (function () {
    const find = id => DEPARTMENTS.find(d => d.id === id);
    const er = find("er"), opd = find("opd"), ot = find("ot"), cath = find("cathlab");
    return {
      erLatest: (er && er.latest && er.latest.total) || 0,
      opdTotal: (opd && opd.total) || 0,
      otTotal: (ot && ot.total) || 0,
      cathTotal: (cath && cath.total) || 0,
    };
  })()
};

window.UNICO = { DEPARTMENTS, GROUPS, MONTHS_FULL, MONTH_ORDER, HOSPITAL };
