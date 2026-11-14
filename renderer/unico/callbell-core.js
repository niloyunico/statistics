/* Call Bell Response Time — ONE rule for the server and the screen (window.UNICO_CB; require()d by
 * server/callbell.js). Reads the text of the nurse-call system's "NURSE CALL STATUS REPORT" PDF
 * (one per floor wing, e.g. "9th Floor A") and works out the monthly figures behind Nursing KPI 3B.
 *
 * A report row: Room | Nurse Call | Pull Chord | Care | Code Blue | Clear Time | Attend TAT | Clear TAT
 *   - Care = the nurse at the bedside (the call answered). Attend TAT = Care − the first alarm.
 *   - A row with a Pull Chord time is a bathroom pull-cord alarm, one with a Code Blue time a code;
 *     anything else is a nurse call (the bed call button).
 * The KPI counts NURSE CALLS ONLY (the user's choice): pull-cord alarms (some left on for 40–57 min)
 * and Code Blue are counted and shown apart, never mixed into the average.
 * Times are the hospital's wall clock, kept as "YYYY-MM-DD HH:MM:SS" text — never converted.
 */
(function (root) {
  const DT = '(20\\d{2}-[01]\\d-[0-3]\\d [0-2]\\d:[0-5]\\d:[0-5]\\d|-{2,})';
  // pdf text joins the cells ("9062026-11-09 08:55:42----2026-…0:34Min0:0 Min"); the date pattern
  // (a 20xx year followed by "-") is what separates the room from the first time.
  const ROW = new RegExp('^\\s*(\\S+?)\\s*' + DT + '\\s*' + DT + '\\s*' + DT + '\\s*' + DT + '\\s*' + DT + '\\s*(\\d+):(\\d{1,2})\\s*Min\\s*(\\d+):(\\d{1,2})\\s*Min\\s*$');
  const WING = /^\s*(\d{1,2})(?:st|nd|rd|th)\s+Floor\s*([A-Za-z0-9]*)\s*$/i;
  const SKIP = /^\s*(UNICO|NURSE CALL STATUS REPORT|Room\s*Nurse\s*Call.*|Page\s*\d+\s*\/\s*\d+)\s*$/i;
  const T = (s) => (/^-+$/.test(s) ? null : s);
  const secOf = (a, b) => {   // seconds from a to b, both "YYYY-MM-DD HH:MM:SS"
    const p = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(s); return Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6]); };
    return Math.round((p(b) - p(a)) / 1000);
  };

  /* The PDF's text → { wing: '9th Floor A', floor: 9, rows: [...], unparsed: [lines] }. */
  function parseText(text) {
    let wing = null, floor = null;
    const rows = [], unparsed = [];
    String(text || '').split(/\r?\n/).forEach((ln) => {
      if (!ln.trim()) return;
      const w = WING.exec(ln);
      if (w) { const name = ln.trim().replace(/\s+/g, ' '); if (!wing) { wing = name; floor = Number(w[1]); } return; }
      if (SKIP.test(ln)) return;
      const m = ROW.exec(ln);
      if (!m) { unparsed.push(ln.trim()); return; }
      const [, room, call, pull, care, blue, clear, am, as, cm, cs] = m;
      const r = { room, call: T(call), pull: T(pull), care: T(care), blue: T(blue), clear: T(clear),
        attendSec: Number(am) * 60 + Number(as), clearSec: Number(cm) * 60 + Number(cs) };
      r.kind = r.blue ? 'blue' : r.pull ? 'pull' : 'call';
      // When the alarm happened: the nurse call, else the pull cord. A pull-cord time can be stale —
      // a cord left pulled for days (one even dated 2024 by the device clock) is reported with the
      // next nurse call — so it never decides the date when a nurse call is there. (Nurse-call TAT
      // = Care − Nurse Call exactly; pull-cord TAT wraps at 60 min and is not used.)
      r.first = r.call || r.pull || r.care || r.clear;
      if (!r.first) { unparsed.push(ln.trim()); return; }
      rows.push(r);
    });
    return { wing, floor, rows, unparsed };
  }

  const keyOf = (wing, r) => String(wing) + '|' + r.first + '|' + r.room;
  // a parsed row carries `first`; a stored one (server/callbell.js) the same time as `at`
  const monthOf = (r) => String(r.first || r.at).slice(0, 7);
  const dayOf = (r) => String(r.first || r.at).slice(0, 10);
  const daysIn = (ym) => new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0)).getUTCDate();
  const round = (x, d) => (x == null || !isFinite(x) ? null : Math.round(x * Math.pow(10, d == null ? 2 : d)) / Math.pow(10, d == null ? 2 : d));
  const median = (a) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); const h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };
  const M3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const qualityMonth = (ym) => M3[+ym.slice(5, 7) - 1] + '-' + ym.slice(2, 4);   // '2026-10' → 'Oct-26'
  const fmtMonth = (ym) => M3[+ym.slice(5, 7) - 1] + ' ' + ym.slice(0, 4);

  /* The figures of a set of calls (one unit or wing, one month). Minutes, nurse calls only in the
     KPI part; pull-cord and Code Blue apart. `days` = days with at least one alarm. */
  function summarize(rows, opts) {
    const o = opts || {};
    const target = o.target != null ? Number(o.target) : 2;
    const calls = rows.filter((r) => r.kind === 'call');
    const mins = calls.map((r) => r.attendSec / 60);
    const sum = mins.reduce((t, x) => t + x, 0);
    const pulls = rows.filter((r) => r.kind === 'pull'), blues = rows.filter((r) => r.kind === 'blue');
    return {
      calls: calls.length,
      sumMin: round(sum, 2),
      avg: calls.length ? round(sum / calls.length, 2) : null,
      median: round(median(mins), 2),
      withinPct: calls.length ? round(100 * mins.filter((x) => x <= target).length / calls.length, 1) : null,
      longest: mins.length ? round(Math.max.apply(null, mins), 2) : null,
      pull: { count: pulls.length },   // count only: pull-cord durations are not reliable (see parseText)
      blue: { count: blues.length },
      days: new Set(rows.map(dayOf)).size,
    };
  }

  /* The month remark written with the quality figure (what the number is, and how complete). */
  function remarkOf(s, ym, opts) {
    const o = opts || {};
    const parts = ['Nurse-call system PDFs: ' + s.calls + ' nurse calls, data on ' + s.days + ' of ' + daysIn(ym) + ' days'];
    if (s.median != null) parts.push('median ' + s.median + ' min');
    if (s.withinPct != null) parts.push(s.withinPct + '% within ' + (o.target != null ? o.target : 2) + ' min');
    if (s.pull.count) parts.push('pull-cord alarms ' + s.pull.count + ' (not counted)');
    if (s.blue.count) parts.push('Code Blue ' + s.blue.count + ' (not counted)');
    return parts.join('; ') + '.';
  }

  const API = { parseText, keyOf, monthOf, dayOf, daysIn, round, median, summarize, remarkOf, qualityMonth, fmtMonth, secOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.UNICO_CB = API;
})(typeof window !== 'undefined' ? window : null);
