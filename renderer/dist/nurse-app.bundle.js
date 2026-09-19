/* ===== dc-runtime.jsx ===== */
(function(){
(function () {
  'use strict';

  const React = window.React;
  const ReactDOM = window.ReactDOM;
  const {
    useState,
    useEffect
  } = React;
  const kebabToCamel = s => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  function cssToObj(css) {
    const o = {};
    for (const decl of String(css).split(';')) {
      const i = decl.indexOf(':');
      if (i < 0) continue;
      const prop = decl.slice(0, i).trim();
      if (!prop) continue;
      o[prop.startsWith('--') ? prop : kebabToCamel(prop)] = decl.slice(i + 1).trim();
    }
    return o;
  }
  const styleCache = new Map();
  function S(v) {
    if (v == null || v === '') return undefined;
    if (typeof v === 'object') return v;
    let o = styleCache.get(v);
    if (!o) {
      if (styleCache.size > 8000) styleCache.clear();
      o = cssToObj(v);
      styleCache.set(v, o);
    }
    return o;
  }
  function ix(v) {
    if (v === undefined || v === null || typeof v === 'boolean') return null;
    if (React.isValidElement(v) || Array.isArray(v)) return v;
    return String(v);
  }
  function vx(v, d) {
    return v === undefined || v === null ? d === undefined ? '' : d : v;
  }
  const PHONE_MQ = '(max-width: 560px), (max-height: 720px) and (max-width: 900px)';
  function usePhone() {
    const get = () => !!(window.matchMedia && window.matchMedia(PHONE_MQ).matches);
    const [phone, setPhone] = useState(get);
    useEffect(() => {
      if (!window.matchMedia) return undefined;
      const mq = window.matchMedia(PHONE_MQ);
      const on = () => setPhone(mq.matches);
      if (mq.addEventListener) mq.addEventListener('change', on);else mq.addListener(on);
      return () => {
        if (mq.removeEventListener) mq.removeEventListener('change', on);else mq.removeListener(on);
      };
    }, []);
    return phone;
  }
  function useClock() {
    const fmt = () => {
      const d = new Date();
      return d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0');
    };
    const [t, setT] = useState(fmt);
    useEffect(() => {
      const id = setInterval(() => setT(fmt()), 15000);
      return () => clearInterval(id);
    }, []);
    return t;
  }
  const FRAME = {
    surface: '#f4fbf8',
    onSurface: '#171d1b',
    border: 'rgba(116,119,117,0.5)'
  };
  function StatusBar() {
    const t = useClock();
    const c = FRAME.onSurface;
    return React.createElement("div", {
      style: {
        height: 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        position: 'relative',
        fontFamily: 'Roboto, system-ui, sans-serif',
        flexShrink: 0
      }
    }, React.createElement("div", {
      style: {
        width: 128,
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }
    }, React.createElement("span", {
      style: {
        fontSize: 14,
        fontWeight: 400,
        letterSpacing: 0.25,
        lineHeight: '20px',
        color: c
      }
    }, t)), React.createElement("div", {
      style: {
        position: 'absolute',
        left: '50%',
        top: 8,
        transform: 'translateX(-50%)',
        width: 24,
        height: 24,
        borderRadius: 100,
        background: '#2e2e2e'
      }
    }), React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center'
      }
    }, React.createElement("div", {
      style: {
        display: 'flex',
        paddingRight: 2
      }
    }, React.createElement("svg", {
      width: "16",
      height: "16",
      viewBox: "0 0 16 16",
      style: {
        marginRight: -2
      }
    }, React.createElement("path", {
      d: "M8 13.3L.67 5.97a10.37 10.37 0 0114.66 0L8 13.3z",
      fill: c
    })), React.createElement("svg", {
      width: "16",
      height: "16",
      viewBox: "0 0 16 16",
      style: {
        marginRight: -2
      }
    }, React.createElement("path", {
      d: "M14.67 14.67V1.33L1.33 14.67h13.34z",
      fill: c
    }))), React.createElement("svg", {
      width: "16",
      height: "16",
      viewBox: "0 0 16 16"
    }, React.createElement("rect", {
      x: "3.75",
      y: "2",
      width: "8.5",
      height: "13",
      rx: "1.5",
      fill: c
    }), React.createElement("rect", {
      x: "5.5",
      y: "0.9",
      width: "5",
      height: "2",
      rx: "0.5",
      fill: c
    }))));
  }
  function NavPill() {
    return React.createElement("div", {
      style: {
        height: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }
    }, React.createElement("div", {
      style: {
        width: 108,
        height: 4,
        borderRadius: 2,
        background: FRAME.onSurface,
        opacity: 0.4
      }
    }));
  }
  function AndroidDevice({
    children
  }) {
    const phone = usePhone();
    if (phone) {
      return React.createElement("div", {
        className: "dc-screen",
        style: {
          position: 'fixed',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          background: FRAME.surface,
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          boxSizing: 'border-box'
        }
      }, React.createElement("div", {
        style: {
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column'
        }
      }, children));
    }
    return React.createElement("div", {
      className: "dc-canvas",
      style: {
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        boxSizing: 'border-box'
      }
    }, React.createElement("div", {
      className: "dc-frame",
      style: {
        width: 412,
        height: 892,
        maxHeight: 'calc(100vh - 32px)',
        borderRadius: 18,
        overflow: 'hidden',
        background: FRAME.surface,
        border: '8px solid ' + FRAME.border,
        boxShadow: '0 30px 80px rgba(0,0,0,0.25)',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        flexShrink: 0
      }
    }, React.createElement(StatusBar, null), React.createElement("div", {
      style: {
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column'
      }
    }, children), React.createElement(NavPill, null)));
  }
  async function api(path, opts) {
    const o = Object.assign({
      method: 'GET'
    }, opts || {});
    const headers = Object.assign({
      accept: 'application/json'
    }, o.headers || {});
    if (o.body !== undefined && typeof o.body !== 'string') {
      o.body = JSON.stringify(o.body);
      headers['content-type'] = 'application/json';
    }
    const r = await fetch(path, Object.assign({}, o, {
      headers,
      credentials: 'same-origin'
    }));
    let j = null;
    try {
      j = await r.json();
    } catch (e) {
      j = null;
    }
    if (!r.ok) {
      const err = new Error(j && j.error || 'HTTP ' + r.status);
      err.status = r.status;
      err.body = j;
      if (r.status === 401 && !/^\/api\/login\b/.test(path)) {
        try {
          window.dispatchEvent(new CustomEvent('unico:session-expired', {
            detail: {
              path
            }
          }));
        } catch (e) {}
      }
      throw err;
    }
    return j || {
      ok: true
    };
  }
  const tryApi = (path, opts) => api(path, opts).catch(() => null);
  async function pageAll(path, key, maxPages) {
    const out = [];
    let offset = 0;
    for (let p = 0; p < (maxPages || 10); p++) {
      const r = await tryApi(path + (path.indexOf('?') < 0 ? '?' : '&') + 'offset=' + offset);
      if (!r || !r.ok || !Array.isArray(r[key])) return null;
      out.push(...r[key]);
      if (r.nextOffset == null || r.nextOffset <= offset) break;
      offset = r.nextOffset;
    }
    return out;
  }
  function injectCSS(id, css) {
    if (!css || document.getElementById(id)) return;
    const el = document.createElement('style');
    el.id = id;
    el.textContent = css;
    document.head.appendChild(el);
  }
  function mount(App, css) {
    injectCSS('dc-view-css', css || '');
    const root = document.getElementById('root');
    const el = React.createElement(App);
    if (ReactDOM.createRoot) ReactDOM.createRoot(root).render(el);else ReactDOM.render(el, root);
  }
  window.DC = {
    S,
    ix,
    vx,
    cssToObj,
    AndroidDevice,
    usePhone,
    api,
    tryApi,
    pageAll,
    injectCSS,
    mount
  };
})();
})();
;
/* ===== roster-spec.js ===== */
/* UNICO — duty roster shift codes, as data.
 *
 * Taken verbatim from the hospital's own roster legend (the "Duty Roster For …"
 * workbook), so a code typed here means exactly what it means on the printed sheet.
 * Everything the roster module computes — hours worked, shift coverage, who is away,
 * the rule checks — is derived from this table and nothing else.
 *
 * Buckets: G general · M morning · E evening · N night · O off/leave.
 * `hours` is paid duty length; leave codes are 0 and are never counted as cover.
 *
 * Published as window.UNICO_ROSTER.
 */
(function () {
  'use strict';

  // [code, label, bucket, hours]
  var RAW = [
    ['G1', '9:00 AM - 5:00 PM', 'G', 8],
    ['G2', '10:00 AM - 6:00 PM', 'G', 8],
    ['G3', '8:00 AM - 4:00 PM', 'G', 8],
    ['G4', '11:00 AM - 7:00 PM', 'G', 8],

    ['M1', '7:00 AM - 3:00 PM', 'M', 8],
    ['M2', '6:00 AM - 2:00 PM', 'M', 8],
    ['M3', '8:00 AM - 8:00 PM', 'M', 12],
    ['M4', '8:00 AM - 2:00 PM', 'M', 6],
    ['M6', '8:00 AM - 3:00 PM', 'M', 7],
    ['M7', '7:00 AM - 2:00 PM', 'M', 7],
    ['M8', '10:00 AM - 10:00 PM', 'M', 12],
    ['M11', '7:00 AM - 2:00 PM', 'M', 7],

    ['E1', '12:00 PM - 8:00 PM', 'E', 8],
    ['E2', '1:00 PM - 9:00 PM', 'E', 8],
    ['E3', '2:00 PM - 10:00 PM', 'E', 8],
    ['E4', '2:00 PM - 8:00 PM', 'E', 6],
    ['E6', '3:00 PM - 10:00 PM', 'E', 7],
    ['E10', '4:00 PM - 10:00 PM', 'E', 6],
    ['E11', '2:00 PM - 9:00 PM', 'E', 7],

    ['N1', '9:00 PM - 7:00 AM', 'N', 10],
    ['N2', '8:00 PM - 8:00 AM', 'N', 12],
    ['N3', '9:00 PM - 9:00 AM', 'N', 12],
    ['N4', '10:00 PM - 8:00 AM', 'N', 10],
    ['N5', '10:00 PM - 7:00 AM', 'N', 9],
    ['N6', '11:00 PM - 7:00 AM', 'N', 8],
    ['N7', '7:00 PM - 7:00 AM', 'N', 12],
    ['N11', '9:00 PM - 7:00 AM', 'N', 10],
    ['DN1', '12:00 PM - next 8:00 AM', 'N', 20],

    ['PH', 'Public Holiday', 'O', 0],
    ['DO', 'Day Off', 'O', 0],
    ['OFF', 'Off Day', 'O', 0],
    ['AL', 'Annual Leave', 'O', 0],
    ['CL', 'Casual Leave', 'O', 0],
    ['EL', 'Earned Leave', 'O', 0],
    ['ML', 'Maternity Leave', 'O', 0],
    ['FL', 'Paternity Leave', 'O', 0],
  ];

  var SHIFTS = RAW.map(function (r) { return { code: r[0], label: r[1], bucket: r[2], hours: r[3] }; });
  var BY_CODE = {};
  SHIFTS.forEach(function (s) { BY_CODE[s.code] = s; });

  // Colours are the mockup's own BUCKETS table, so a shift pill is the same colour on
  // the screen, in the legend and on the printed sheet.
  var BUCKETS = [
    { id: 'G', label: 'General', color: '#6a52d4' },
    { id: 'M', label: 'Morning', color: '#e08a1e' },
    { id: 'E', label: 'Evening', color: '#0090ca' },
    { id: 'N', label: 'Night', color: '#5b45c4' },
    { id: 'O', label: 'Leave / off', color: '#8b98ab' },
  ];
  var BUCKET_COLOR = {};
  BUCKETS.forEach(function (b) { BUCKET_COLOR[b.id] = b.color; });

  // Codes that mean "away", as opposed to a rostered day off. Used by the leave view:
  // a day off is planned rest, annual leave is absence, and they are not the same thing
  // when you are checking whether a shift is covered.
  var LEAVE_CODES = ['AL', 'CL', 'EL', 'ML', 'FL', 'PH'];
  var OFF_CODES = ['DO', 'OFF'];

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function bucketOf(code) { var s = BY_CODE[code]; return s ? s.bucket : null; }
  function hoursOf(code) { var s = BY_CODE[code]; return s ? s.hours : 0; }
  function isLeave(code) { return LEAVE_CODES.indexOf(code) >= 0; }
  function isOff(code) { return OFF_CODES.indexOf(code) >= 0; }
  function isDuty(code) { var b = bucketOf(code); return !!b && b !== 'O'; }
  function daysIn(year, month) { return new Date(year, month + 1, 0).getDate(); }

  // Per-person totals for one month: counts per bucket + total paid hours.
  function totalsFor(row, days) {
    var t = { G: 0, M: 0, E: 0, N: 0, O: 0, hours: 0, leave: 0 };
    for (var d = 1; d <= days; d++) {
      var c = row && row[d];
      if (!c) continue;
      var b = bucketOf(c);
      if (b) t[b]++;
      t.hours += hoursOf(c);
      if (isLeave(c)) t.leave++;
    }
    return t;
  }

  // Coverage for one day: how many people are on each duty bucket.
  function coverageFor(grid, empIds, day) {
    var c = { G: 0, M: 0, E: 0, N: 0, O: 0, names: { G: [], M: [], E: [], N: [], O: [] } };
    empIds.forEach(function (id) {
      var code = grid[id] && grid[id][day];
      var b = bucketOf(code);
      if (!b) return;
      c[b]++;
      c.names[b].push(id);
    });
    return c;
  }

  /* ---- rule checks --------------------------------------------------------
     Deliberately few, deliberately explicit, and every one of them switchable:
     a roster rule that cannot be turned off gets worked around rather than fixed.
     Each rule returns a list of { day, empId, text } findings. */
  var DEFAULT_RULES = {
    minNight: { on: true, value: 2, label: 'Minimum staff on night duty', unit: 'per day' },
    minMorning: { on: true, value: 2, label: 'Minimum staff on morning duty', unit: 'per day' },
    minEvening: { on: true, value: 2, label: 'Minimum staff on evening duty', unit: 'per day' },
    maxConsecNight: { on: true, value: 4, label: 'Maximum consecutive night shifts', unit: 'per person' },
    maxConsecDuty: { on: true, value: 6, label: 'Maximum consecutive duty days', unit: 'per person' },
    weeklyOff: { on: true, value: 1, label: 'Minimum days off per week', unit: 'per person' },
    leaveClash: { on: true, value: 2, label: 'Maximum staff away on the same day', unit: 'per day' },
  };

  function checkRules(grid, staff, year, month, rules) {
    var R = Object.assign({}, DEFAULT_RULES, rules || {});
    var days = daysIn(year, month);
    var ids = staff.map(function (s) { return s.empId; });
    var out = [];
    var nameOf = {};
    staff.forEach(function (s) { nameOf[s.empId] = s.name; });

    // per-day coverage rules
    for (var d = 1; d <= days; d++) {
      var cov = coverageFor(grid, ids, d);
      [['minMorning', 'M'], ['minEvening', 'E'], ['minNight', 'N']].forEach(function (pair) {
        var r = R[pair[0]];
        if (!r || !r.on) return;
        if (cov[pair[1]] < r.value) {
          out.push({
            day: d, kind: pair[0], severity: cov[pair[1]] === 0 ? 'high' : 'medium',
            text: (cov[pair[1]] === 0 ? 'No one rostered' : 'Only ' + cov[pair[1]]) + ' on ' +
              (pair[1] === 'M' ? 'morning' : pair[1] === 'E' ? 'evening' : 'night') + ' duty (needs ' + r.value + ')',
          });
        }
      });
      if (R.leaveClash && R.leaveClash.on) {
        var away = ids.filter(function (id) { return isLeave(grid[id] && grid[id][d]); });
        if (away.length > R.leaveClash.value) {
          out.push({ day: d, kind: 'leaveClash', severity: 'medium', text: away.length + ' staff away on the same day (limit ' + R.leaveClash.value + ')' });
        }
      }
    }

    // per-person sequence rules
    staff.forEach(function (s) {
      var row = grid[s.empId] || {};
      var runNight = 0, runDuty = 0;
      for (var d = 1; d <= days; d++) {
        var code = row[d];
        runNight = bucketOf(code) === 'N' ? runNight + 1 : 0;
        runDuty = isDuty(code) ? runDuty + 1 : 0;
        if (R.maxConsecNight && R.maxConsecNight.on && runNight === R.maxConsecNight.value + 1) {
          out.push({ day: d, empId: s.empId, kind: 'maxConsecNight', severity: 'medium', text: nameOf[s.empId] + ' has ' + runNight + ' consecutive nights (limit ' + R.maxConsecNight.value + ')' });
        }
        if (R.maxConsecDuty && R.maxConsecDuty.on && runDuty === R.maxConsecDuty.value + 1) {
          out.push({ day: d, empId: s.empId, kind: 'maxConsecDuty', severity: 'medium', text: nameOf[s.empId] + ' has ' + runDuty + ' consecutive duty days (limit ' + R.maxConsecDuty.value + ')' });
        }
      }
      if (R.weeklyOff && R.weeklyOff.on) {
        for (var w = 0; w < Math.ceil(days / 7); w++) {
          var start = w * 7 + 1, end = Math.min(days, start + 6);
          var offs = 0, any = 0;
          for (var k = start; k <= end; k++) { if (row[k]) any++; if (isOff(row[k]) || isLeave(row[k])) offs++; }
          if (any && offs < R.weeklyOff.value) {
            out.push({ day: start, empId: s.empId, kind: 'weeklyOff', severity: 'low', text: nameOf[s.empId] + ' has no day off in week ' + (w + 1) });
          }
        }
      }
    });

    return out;
  }

  var API = {
    SHIFTS: SHIFTS, BY_CODE: BY_CODE, BUCKETS: BUCKETS, BUCKET_COLOR: BUCKET_COLOR,
    LEAVE_CODES: LEAVE_CODES, OFF_CODES: OFF_CODES, MONTHS: MONTHS, DOW: DOW,
    DEFAULT_RULES: DEFAULT_RULES,
    bucketOf: bucketOf, hoursOf: hoursOf, isLeave: isLeave, isOff: isOff, isDuty: isDuty,
    daysIn: daysIn, totalsFor: totalsFor, coverageFor: coverageFor, checkRules: checkRules,
  };

  if (typeof window !== 'undefined') window.UNICO_ROSTER = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();

;
/* ===== appraisal-spec.js ===== */
/* UNICO — Individual Performance Appraisal, Form HR-NUR-PA-01.
 *
 * THE PAPER FORM, AS DATA. Everything the appraisal module scores, prints or grades
 * comes from this one file: the 10 sections, the 20 parameters, the behavioural
 * descriptor that earns each point from 5 down to 1, the section maxima and the grade
 * bands. Nothing here is presentation — performance.jsx renders it, the printable form
 * renders it, and the score summary adds it up, so the screen, the print-out and the
 * stored record can never drift apart from each other or from the paper original.
 *
 * Marked out of 100, so the total obtained IS the percentage.
 *
 * Loaded as plain JS before the components (see MANIFEST in scripts/build-renderer.js)
 * and published as window.UNICO_APPRAISAL.
 */
(function () {
  'use strict';

  // Score -> what it means. Printed as Part B of the form.
  var RATING_KEY = [
    { score: 5, label: 'Excellent', desc: 'Consistently exceeds the required standard; can be held up as an example to others.' },
    { score: 4, label: 'Very Good', desc: 'Frequently exceeds the required standard; needs little or no correction.' },
    { score: 3, label: 'Good / Satisfactory', desc: 'Meets the required standard consistently; performance is dependable.' },
    { score: 2, label: 'Needs Improvement', desc: 'Falls below the required standard at times; needs guidance and follow-up.' },
    { score: 1, label: 'Unsatisfactory', desc: 'Consistently below the required standard; immediate corrective action needed.' },
  ];

  // The 10 sections. `max` is the section sub-total and is ALWAYS params.length * 5 —
  // asserted at the bottom of this file so a future edit cannot silently break the
  // out-of-100 arithmetic that the percentage and the grade both depend on.
  var SECTIONS = [
    {
      no: 1, title: 'QUALITY OF WORK', max: 10, params: [
        {
          sl: 1, name: 'Accuracy of work',
          desc: 'Correctness of medication administration, documentation, vitals recording and procedure technique; freedom from errors.',
          guide: {
            5: 'No medication, documentation or procedure error during the whole period.',
            4: 'Rare minor error, self-detected and corrected; no patient harm.',
            3: 'Occasional minor errors, corrected on supervision; no harm caused.',
            2: 'Repeated errors needing correction by others; near-miss reported.',
            1: 'Frequent errors; an incident causing or risking patient harm.',
          },
        },
        {
          sl: 2, name: 'Neatness and thoroughness',
          desc: 'Tidiness of patient area and records; completeness of work; adherence to infection-control and safety standards.',
          guide: {
            5: 'Patient area, trolley and records always clean, orderly and complete.',
            4: 'Consistently tidy and complete; very rarely needs a reminder.',
            3: 'Generally tidy; occasional gaps closed after a reminder.',
            2: 'Untidy work area or incomplete records noticed repeatedly.',
            1: 'Poor hygiene practice or grossly incomplete work; infection-control breach.',
          },
        },
      ],
    },
    {
      no: 2, title: 'QUANTITY OF WORK', max: 5, params: [
        {
          sl: 3, name: 'Volume of work completed and freedom from pending work',
          desc: 'Amount of assigned duty completed within the shift against the expected workload; tasks are finished rather than left pending or handed over incomplete to the next shift.',
          guide: {
            5: 'Full workload completed every shift; often absorbs extra duty.',
            4: 'Full workload completed; pending work is rare and always explained.',
            3: 'Normal workload completed; a few tasks handed over pending.',
            2: 'Frequently leaves work for the next shift; needs help to finish.',
            1: 'Regularly fails to complete assigned duty; burdens colleagues.',
          },
        },
      ],
    },
    {
      no: 3, title: 'COMMUNICATION SKILLS', max: 15, params: [
        {
          sl: 4, name: 'Speaking',
          desc: 'Clear, courteous and professional verbal communication with patients, attendants, doctors and colleagues.',
          guide: {
            5: 'Always clear, calm and courteous, even with difficult attendants.',
            4: 'Clear and polite; explains care well to patients, doctors and staff.',
            3: 'Communicates adequately; sometimes brief or unclear under pressure.',
            2: 'Abrupt or unclear speech; complaints received about manner.',
            1: 'Rude or argumentative, or unable to convey clinical information.',
          },
        },
        {
          sl: 5, name: 'Listening',
          desc: 'Attentive listening; understands and follows instructions and patient concerns correctly.',
          guide: {
            5: 'Listens fully, confirms understanding, never needs repetition.',
            4: 'Attentive; follows instructions correctly almost every time.',
            3: 'Generally follows instructions; occasionally needs repetition.',
            2: 'Frequently misunderstands or ignores instructions and patient concerns.',
            1: 'Does not listen; errors result from missed instructions.',
          },
        },
        {
          sl: 6, name: 'Writing',
          desc: 'Legible, accurate and timely written records, charts, handover notes and reports.',
          guide: {
            5: 'Records always legible, complete, timely and properly signed.',
            4: 'Records clear and timely; very rare omission.',
            3: 'Records acceptable; occasional late entry or missing signature.',
            2: 'Illegible or late entries; gaps found on chart audit.',
            1: 'Records missing, falsified or unusable for continuity of care.',
          },
        },
      ],
    },
    {
      no: 4, title: 'RELIABILITY AND DEPENDABILITY', max: 10, params: [
        {
          sl: 7, name: 'Regularity of attendance, punctuality and shift discipline',
          desc: 'Consistent presence on duty throughout the period; unauthorised or unplanned absence kept to a minimum.',
          guide: {
            5: 'Full attendance; no unauthorised absence at all.',
            4: 'Attendance above 95%; all leave properly applied for and sanctioned.',
            3: 'Attendance 90-95%; leave mostly regularised.',
            2: 'Attendance 85-90%, or 1-2 days of unauthorised absence.',
            1: 'Attendance below 85%, or repeated unauthorised absence.',
          },
        },
        {
          sl: 8, name: 'Requires minimum supervision',
          desc: 'Carries out duties dependably without repeated reminders or close monitoring.',
          guide: {
            5: 'Works independently; the supervisor can rely on her without checking.',
            4: 'Needs occasional guidance only in unfamiliar situations.',
            3: 'Works well once instructed; needs routine follow-up.',
            2: 'Needs frequent reminders and re-checking of completed work.',
            1: 'Cannot be left unsupervised; work often has to be redone.',
          },
        },
      ],
    },
    {
      no: 5, title: 'PROBLEM SOLVING SKILLS', max: 10, params: [
        {
          sl: 9, name: 'Analytical and critical thinking',
          desc: 'Identifies the real issue in a clinical or ward situation rather than reacting to symptoms only; weighs options, anticipates consequences and applies clinical reasoning.',
          guide: {
            5: 'Identifies the underlying problem early and anticipates complications.',
            4: 'Analyses situations well; clinical reasoning is usually sound.',
            3: 'Understands obvious problems; needs help with complex ones.',
            2: 'Reacts to symptoms only; misses the underlying issue.',
            1: 'Unable to analyse; acts without thinking through consequences.',
          },
        },
        {
          sl: 10, name: 'Finding workable solutions',
          desc: 'Arrives at practical solutions and escalates appropriately when the matter is beyond own scope.',
          guide: {
            5: 'Provides practical solutions and escalates correctly every time.',
            4: 'Usually finds a workable solution within her own scope.',
            3: 'Finds simple solutions; refers most matters upward.',
            2: 'Waits for others to solve even routine ward problems.',
            1: 'Neither solves nor escalates; problems are allowed to worsen.',
          },
        },
      ],
    },
    {
      no: 6, title: 'DECISION MAKING SKILLS', max: 5, params: [
        {
          sl: 11, name: 'Soundness and timeliness of decisions',
          desc: 'Makes correct decisions within own authority, at the right time, including under pressure or in emergencies.',
          guide: {
            5: 'Correct and prompt decisions even in emergencies; never exceeds authority.',
            4: 'Sound and timely decisions in almost all situations.',
            3: 'Makes routine decisions correctly; hesitates in emergencies.',
            2: 'Delays decisions, or decides wrongly and needs correction.',
            1: 'Wrong or unsafe decisions, or acts beyond own authority.',
          },
        },
      ],
    },
    {
      no: 7, title: 'COORDINATION WITH TEAM MEMBERS', max: 10, params: [
        {
          sl: 12, name: 'Willingness to work as a team',
          desc: 'Cooperates with nursing, medical and support staff; accepts shared responsibility.',
          guide: {
            5: 'Actively builds cooperation and resolves friction within the team.',
            4: 'Cooperates readily with all staff and across shifts.',
            3: 'Cooperates when asked; keeps strictly to own assignment.',
            2: 'Reluctant to cooperate; occasional friction with colleagues.',
            1: 'Refuses cooperation; a source of conflict in the unit.',
          },
        },
        {
          sl: 13, name: 'Willingness to help others',
          desc: 'Voluntarily assists colleagues during workload peaks, emergencies and staff shortage.',
          guide: {
            5: 'Volunteers help in every emergency and staff shortage.',
            4: 'Helps willingly whenever the ward is under pressure.',
            3: 'Helps when specifically requested to do so.',
            2: 'Avoids helping; leaves colleagues to manage alone.',
            1: 'Refuses to help even during emergencies.',
          },
        },
      ],
    },
    {
      no: 8, title: 'INITIATIVE', max: 10, params: [
        {
          sl: 14, name: 'Readiness to take up new tasks',
          desc: 'Accepts new duties, additional responsibility and learning opportunities willingly.',
          guide: {
            5: 'Seeks out new duties and training; takes extra responsibility willingly.',
            4: 'Accepts new duties willingly whenever they are offered.',
            3: 'Accepts new duties when formally assigned.',
            2: 'Reluctant; avoids anything outside routine work.',
            1: 'Refuses new duties or training opportunities.',
          },
        },
        {
          sl: 15, name: 'Contributes suggestions for improvement',
          desc: 'Offers constructive ideas to improve patient care, safety or ward workflow.',
          guide: {
            5: 'Suggests improvements regularly; at least one adopted in the ward.',
            4: 'Offers useful suggestions on patient care and workflow.',
            3: 'Occasionally contributes ideas in ward meetings.',
            2: 'Rarely contributes; criticises without suggesting a remedy.',
            1: 'Never contributes; resists improvement efforts by others.',
          },
        },
      ],
    },
    {
      no: 9, title: 'TIME MANAGEMENT', max: 15, params: [
        {
          sl: 16, name: 'Attending duty on time',
          desc: 'Arrives before shift start and is ready for handover; remains on duty for the full shift and does not leave before the duty is properly handed over.',
          guide: {
            5: 'Always on duty before shift start; never leaves before handover.',
            4: 'Punctual; not more than 1-2 late arrivals in the whole period.',
            3: '3-5 late arrivals; handover generally proper.',
            2: '6-10 late arrivals, or occasionally leaves before handover.',
            1: 'More than 10 late arrivals, or leaves duty without handover.',
          },
        },
        {
          sl: 17, name: 'Prioritising work',
          desc: 'Sorts duties by urgency and clinical priority and re-orders them as the ward situation changes.',
          guide: {
            5: 'Prioritises correctly even when the ward is overloaded.',
            4: 'Sets priorities well; rarely needs re-direction.',
            3: 'Handles routine priorities; struggles when workload rises.',
            2: 'Works in the wrong order; urgent tasks get delayed.',
            1: 'No sense of priority; critical care is delayed as a result.',
          },
        },
        {
          sl: 18, name: 'Performing and completing work within time',
          desc: 'Medication rounds, observations and procedures carried out at the scheduled time, and assigned duty and documentation finished before the end of the shift.',
          guide: {
            5: 'All rounds, procedures and documentation completed on schedule.',
            4: 'Almost always on schedule; delays are rare and explained.',
            3: 'Mostly on time; documentation sometimes finished late.',
            2: 'Frequently delayed; work spills into the next shift.',
            1: 'Habitually late; medication or observation timings are missed.',
          },
        },
      ],
    },
    {
      no: 10, title: 'ACCOUNTABILITY', max: 10, params: [
        {
          sl: 19, name: 'Owning up to mistakes',
          desc: 'Reports own errors and incidents honestly and promptly, without concealment.',
          guide: {
            5: 'Reports her own errors immediately, without being asked.',
            4: 'Admits mistakes readily whenever they occur.',
            3: 'Admits mistakes when they are pointed out.',
            2: 'Defensive; tends to blame others or the circumstances.',
            1: 'Conceals errors or gives false information about them.',
          },
        },
        {
          sl: 20, name: 'Learning from mistakes',
          desc: 'Accepts feedback and demonstrably does not repeat the same error.',
          guide: {
            5: 'Never repeats an error and shares the learning with colleagues.',
            4: 'Acts on feedback; the same error is not repeated.',
            3: 'Improves after counselling; change is slow but visible.',
            2: 'Repeats the same error despite feedback.',
            1: 'Rejects feedback; the same errors continue throughout the period.',
          },
        },
      ],
    },
  ];

  // Part F. `min` is inclusive; the bands are checked from the top down.
  var GRADES = [
    { min: 90, grade: 'A+', rating: 'Outstanding',       interp: 'Commendation / promotion consideration', tone: 'ok' },
    { min: 80, grade: 'A',  rating: 'Very Good',         interp: 'Eligible for normal increment',          tone: 'ok' },
    { min: 70, grade: 'B',  rating: 'Good',              interp: 'Eligible for normal increment',          tone: 'ok' },
    { min: 60, grade: 'C',  rating: 'Satisfactory',      interp: 'Continue in present post; monitor',      tone: 'warn' },
    { min: 50, grade: 'D',  rating: 'Needs Improvement', interp: 'Counselling and re-training required',   tone: 'warn' },
    { min: 0,  grade: 'E',  rating: 'Unsatisfactory',    interp: 'Formal warning / review of employment',  tone: 'bad' },
  ];

  // Part H — what the Chief Nursing Superintendent may record. `suggest` lists the
  // grades for which the module pre-ticks the action; the Authority may override it.
  var CNS_ACTIONS = [
    { id: 'commend',   label: 'Letter of commendation',              suggest: ['A+'] },
    { id: 'promotion', label: 'Recommended for promotion review',    suggest: ['A+'] },
    { id: 'increment', label: 'Eligible for normal increment',       suggest: ['A+', 'A', 'B'] },
    { id: 'continue',  label: 'Continue in present post; monitor',   suggest: ['C'] },
    { id: 'counsel',   label: 'Counselling and re-training required', suggest: ['D'] },
    { id: 'training',  label: 'Refer for structured re-training',    suggest: ['D', 'E'] },
    { id: 'warning',   label: 'Formal written warning',              suggest: ['E'] },
    { id: 'review',    label: 'Review of continued employment',      suggest: ['E'] },
  ];

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /* ---- flattened helpers ---- */
  var PARAMS = [];
  SECTIONS.forEach(function (s) { s.params.forEach(function (p) { PARAMS.push({ sec: s.no, secTitle: s.title, sl: p.sl, name: p.name, desc: p.desc, guide: p.guide }); }); });
  var TOTAL_MAX = SECTIONS.reduce(function (t, s) { return t + s.max; }, 0);

  function gradeFor(pct) {
    var n = Number(pct);
    if (!isFinite(n)) return GRADES[GRADES.length - 1];
    for (var i = 0; i < GRADES.length; i++) if (n >= GRADES[i].min) return GRADES[i];
    return GRADES[GRADES.length - 1];
  }

  // scores: { <sl>: 1..5 }. Returns per-section sub-totals plus the grand total.
  // Deliberately tolerant of a partly-filled form — the module scores a draft live.
  function tally(scores) {
    var s = scores || {};
    var sections = SECTIONS.map(function (sec) {
      var sub = 0, rated = 0;
      sec.params.forEach(function (p) {
        var v = Number(s[p.sl]);
        if (v >= 1 && v <= 5) { sub += v; rated++; }
      });
      return { no: sec.no, title: sec.title, max: sec.max, sub: sub, rated: rated, of: sec.params.length };
    });
    var total = sections.reduce(function (t, x) { return t + x.sub; }, 0);
    var rated = sections.reduce(function (t, x) { return t + x.rated; }, 0);
    var lows = PARAMS.filter(function (p) { var v = Number(s[p.sl]); return v === 1 || v === 2; });
    return {
      sections: sections,
      total: total,
      max: TOTAL_MAX,
      rated: rated,
      of: PARAMS.length,
      complete: rated === PARAMS.length,
      // Marked out of 100, so the total obtained IS the percentage.
      pct: total,
      grade: gradeFor(total),
      lows: lows,
    };
  }

  // Instruction 4 on the form: any rating of 1 or 2 must carry a written remark.
  // Returns the parameters that are still missing one.
  function missingRemarks(scores, remarks) {
    var s = scores || {}, r = remarks || [];
    return PARAMS.filter(function (p) {
      var v = Number(s[p.sl]);
      if (v !== 1 && v !== 2) return false;
      var txt = r[p.sl] || (r && r[String(p.sl)]);
      return !(txt && String(txt).trim());
    });
  }

  /* ---- appraisal cycles, anchored to the individual's date of joining ----
     The window is six months from the person's own DOJ, not a calendar half-year:
     someone who joined on 15 January is appraised 15 Jan - 14 Jul, then 15 Jul - 14 Jan.
     The first appraisal therefore falls six months after joining, which is what makes
     new joiners appear in the reminders. */
  function parseDate(d) {
    if (!d) return null;
    if (d instanceof Date) return isNaN(d.getTime()) ? null : d;
    var t = new Date(d);
    return isNaN(t.getTime()) ? null : t;
  }
  function addMonths(d, n) {
    var x = new Date(d.getTime());
    var day = x.getDate();
    x.setDate(1);
    x.setMonth(x.getMonth() + n);
    // Clamp for short months (31 Aug + 6 -> 28/29 Feb).
    var last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
    x.setDate(Math.min(day, last));
    return x;
  }
  function fmtDay(d) { return d ? d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear() : ''; }
  function fmtShort(d) { return d ? d.getDate() + ' ' + MONTHS[d.getMonth()] : ''; }

  // The appraisal window containing `at` (default: now) for someone who joined on doj.
  function cycleOf(doj, at) {
    var start = parseDate(doj);
    var now = parseDate(at) || new Date();
    if (!start) return null;
    if (now < start) return null;
    var s = new Date(start.getTime());
    var guard = 0;
    while (guard++ < 200) {
      var e = addMonths(s, 6);
      if (now < e) {
        var endIncl = new Date(e.getTime()); endIncl.setDate(endIncl.getDate() - 1);
        return {
          start: s, end: endIncl, due: e,
          id: s.getFullYear() + '-' + String(s.getMonth() + 1).padStart(2, '0') + '-' + String(s.getDate()).padStart(2, '0'),
          label: fmtShort(s) + ' - ' + fmtDay(endIncl),
          index: guard,
        };
      }
      s = e;
    }
    return null;
  }
  // Every completed window since joining, newest first (for the history table).
  function cyclesSince(doj, at, limit) {
    var start = parseDate(doj);
    var now = parseDate(at) || new Date();
    var out = [];
    if (!start) return out;
    var s = new Date(start.getTime());
    var guard = 0;
    while (guard++ < 60) {
      var e = addMonths(s, 6);
      if (e > now) break;
      var endIncl = new Date(e.getTime()); endIncl.setDate(endIncl.getDate() - 1);
      out.push({
        start: new Date(s.getTime()), end: endIncl, due: e,
        id: s.getFullYear() + '-' + String(s.getMonth() + 1).padStart(2, '0') + '-' + String(s.getDate()).padStart(2, '0'),
        label: fmtShort(s) + ' - ' + fmtDay(endIncl),
      });
      s = e;
    }
    out.reverse();
    return limit ? out.slice(0, limit) : out;
  }
  // The organisation-wide half-year, used where entries are pooled across staff
  // (incidents, achievements, the recognition board): "Jul - Dec 2026".
  function orgCycle(at) {
    var d = parseDate(at) || new Date();
    var h = d.getMonth() < 6 ? 0 : 1;
    return {
      id: d.getFullYear() + '-H' + (h + 1),
      label: (h ? 'Jul - Dec ' : 'Jan - Jun ') + d.getFullYear(),
      start: new Date(d.getFullYear(), h ? 6 : 0, 1),
      end: new Date(d.getFullYear(), h ? 11 : 5, h ? 31 : 30),
    };
  }

  /* WHAT AN ACHIEVEMENT OR AN INCIDENT CAN BE, and what each is worth. These live in
     the shared spec rather than in the Performance module because the staff profile
     records conduct against a person too (Recognition & conduct) — two copies of this
     list would drift, and a category that exists on one screen but not the other files
     entries the register cannot group. */
  var ACH_CATEGORIES = [
    { id: 'award', label: 'Award / recognition', levels: [['Hospital', 3], ['Department', 2], ['Unit', 1]] },
    { id: 'training', label: 'Training completed', levels: [['International', 3], ['National', 2], ['In-house', 1]] },
    { id: 'presentation', label: 'Presentation / teaching', levels: [['Conference', 3], ['Hospital', 2], ['Unit', 1]] },
    { id: 'improvement', label: 'Quality improvement adopted', levels: [['Hospital-wide', 3], ['Department', 2], ['Unit', 1]] },
    { id: 'appreciation', label: 'Patient / family appreciation', levels: [['Written', 2], ['Verbal', 1]] },
    { id: 'extra', label: 'Extra duty / emergency cover', levels: [['Sustained', 2], ['One-off', 1]] },
  ];
  var INC_CATEGORIES = [
    { id: 'medication', label: 'Medication error' },
    { id: 'documentation', label: 'Documentation lapse' },
    { id: 'infection', label: 'Infection-control breach' },
    { id: 'attendance', label: 'Attendance / punctuality' },
    { id: 'conduct', label: 'Conduct / communication' },
    { id: 'procedure', label: 'Procedure / protocol deviation' },
  ];
  var SEVERITIES = [['Minor', 1], ['Moderate', 2], ['Major', 3], ['Critical', 5]];

  // Bonus (achievements) and deduction (incidents) caps, per staff member per cycle.
  var BONUS_CAP = 5;
  var PENALTY_CAP = 5;

  // Final mark = the 20 parameters, plus capped achievement bonus, less capped
  // incident deduction, held inside 0..100 so the grade band always makes sense.
  function finalScore(base, bonus, penalty) {
    var b = Math.min(Math.max(Number(bonus) || 0, 0), BONUS_CAP);
    var p = Math.min(Math.max(Number(penalty) || 0, 0), PENALTY_CAP);
    var n = (Number(base) || 0) + b - p;
    return { bonus: b, penalty: p, score: Math.max(0, Math.min(100, n)) };
  }

  var API = {
    FORM_ID: 'HR-NUR-PA-01',
    FORM_REV: 'Rev. 2',
    SECTIONS: SECTIONS,
    PARAMS: PARAMS,
    RATING_KEY: RATING_KEY,
    GRADES: GRADES,
    CNS_ACTIONS: CNS_ACTIONS,
    TOTAL_MAX: TOTAL_MAX,
    BONUS_CAP: BONUS_CAP,
    PENALTY_CAP: PENALTY_CAP,
    ACH_CATEGORIES: ACH_CATEGORIES,
    INC_CATEGORIES: INC_CATEGORIES,
    SEVERITIES: SEVERITIES,
    MONTHS: MONTHS,
    gradeFor: gradeFor,
    tally: tally,
    missingRemarks: missingRemarks,
    cycleOf: cycleOf,
    cyclesSince: cyclesSince,
    orgCycle: orgCycle,
    finalScore: finalScore,
    addMonths: addMonths,
    parseDate: parseDate,
    fmtDay: fmtDay,
    fmtShort: fmtShort,
  };

  // The out-of-100 arithmetic is load-bearing: the total obtained IS the percentage,
  // and the grade band is read off it directly. Shout loudly rather than quietly
  // grading everyone against the wrong denominator.
  (function selfCheck() {
    var bad = SECTIONS.filter(function (s) { return s.max !== s.params.length * 5; });
    if (bad.length) console.error('[appraisal] section max does not match its parameters:', bad.map(function (s) { return s.title; }));
    if (TOTAL_MAX !== 100) console.error('[appraisal] the form must total 100, not ' + TOTAL_MAX + ' - the percentage and grade depend on it.');
    if (PARAMS.length !== 20) console.error('[appraisal] expected 20 parameters, found ' + PARAMS.length);
  })();

  if (typeof window !== 'undefined') window.UNICO_APPRAISAL = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();

;
/* ===== nurse-app-data.js ===== */
/* Design data for the NURSE_APP_DATA — lifted verbatim from the Claude Design document
 * (docs/design). Seed/demo values the app falls back to when the server has no
 * live data for a screen. Published as window.NURSE_APP_DATA. */
(function () {
  'use strict';
  const SHIFTS = {
    M4:{name:'Morning',time:'8:00 AM – 2:00 PM',hours:'6h',color:'#0090ca',bg:'rgba(0,144,202,.14)'},
    E3:{name:'Evening',time:'2:00 PM – 10:00 PM',hours:'8h',color:'#e08a1e',bg:'rgba(224,138,30,.16)'},
    N2:{name:'Night',time:'8:00 PM – 8:00 AM',hours:'12h',color:'#6a52d4',bg:'rgba(106,82,212,.15)'},
    O:{name:'Off',time:'Rest day',hours:'—',color:'#7d8ea8',bg:'rgba(125,145,180,.16)'},
    CL:{name:'Casual leave',time:'Approved leave',hours:'—',color:'#1d8f57',bg:'rgba(43,182,115,.15)'},
  };
  const PATTERN = ['M4','M4','E3','E3','N2','O','O','M4','E3','E3','N2','N2','O','O'];
  const ROSTER = {}; for (let d=1; d<=30; d++) ROSTER[d] = PATTERN[(d+3)%PATTERN.length]; ROSTER[8]='M4'; ROSTER[17]='CL';
  const TODAY = 8;
  const DOWS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const dateLabel = d => `${DOWS[d%7]}, ${d} Sep`;
  const TEAM = [
    {name:'Rahima Khatun',role:'Senior Staff Nurse',code:'M4'},
    {name:'Sumaiya Akter',role:'Staff Nurse',code:'M4'},
    {name:'Tanvir Hossain',role:'Staff Nurse',code:'M3'},
    {name:'Priya Das',role:'Team Leader',code:'G1'},
  ];
  const ini = n => n.split(' ').map(w=>w[0]).slice(0,2).join('');
  const MED_CATS = ['All','Analgesic','Antibiotic','Gastro & Antiemetic','Cardiovascular','Diabetes','Respiratory & Allergy','Steroid'];
  const FOODS = {with:'With food',before:'Before meals',any:'Any time',na:'N/A (IV/IM)'};
  const PREGS = {safe:['Safe','#1d8f57'],caution:['Caution','#b8650a'],avoid:['Avoid','#b32e2e']};
  const MED_TABS = {
    overview:['Indications','Composition','Pharmacology'],
    dosage:['Dosage & Administration','Administration','Pediatric Uses','Duration Of Treatment'],
    safety:['Side Effects','Contraindications','Drug Interactions','Precautions And Warnings','Overdose Effects','Pregnancy & Lactation','Use In Special Populations'],
    more:['Storage'],
  };
  const SEC_COLOR = {'Indications':'#0072a3','Composition':'#3c4858','Pharmacology':'#6a52d4','Dosage & Administration':'#0072a3','Administration':'#1e8a7c','Pediatric Uses':'#b8650a','Duration Of Treatment':'#3c4858','Side Effects':'#b8650a','Contraindications':'#b32e2e','Drug Interactions':'#b32e2e','Precautions And Warnings':'#b8650a','Overdose Effects':'#b32e2e','Pregnancy & Lactation':'#6a52d4','Use In Special Populations':'#3c4858','Storage':'#1e8a7c'};
  const CATS = {Policy:{c:'#6a52d4',bg:'rgba(106,82,212,.13)'},Training:{c:'#1e8a7c',bg:'rgba(58,181,167,.16)'},Roster:{c:'#0072a3',bg:'rgba(0,144,202,.13)'},Urgent:{c:'#b32e2e',bg:'rgba(214,69,69,.12)'},General:{c:'#7d8ea8',bg:'rgba(125,145,180,.16)'}};
  const ATTACH_ICONS = {pdf:'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8',photo:'M21 19V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2zM8.5 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM21 15l-5-5L5 21',handover:'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 12h6M9 16h4',med:'M10.5 20.5l10-10a4.95 4.95 0 00-7-7l-10 10a4.95 4.95 0 007 7zM8.5 8.5l7 7',voice:'M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8',bed:'M2 4v16M2 8h18a2 2 0 012 2v10M2 17h20M6 8v9'};
  const NOTICES = [
    {id:1,cat:'Urgent',pinned:true,needsAck:true,attachments:[{name:'Isolation-protocol-LDR-v3.pdf',ext:'PDF',size:'1.2 MB'}],ackCount:128,ackTotal:186,title:'Infection control: new isolation protocol for LDR',when:'Today',from:'Elizabeth Jothi Raja Singh',fromRole:'Nurse Manager',audience:'All nursing staff',body:'Effective immediately, all suspected respiratory cases in LDR must be placed in a single room with droplet precautions.',full:'Effective immediately, all suspected respiratory cases in LDR must be placed in a single room with droplet precautions.\n\nDon N95, gown, gloves and eye protection before entry. Sign the door log on every entry and exit. The infection control team will audit compliance daily for the next two weeks.\n\nDirect any questions to your nurse in-charge.'},
    {id:2,cat:'Training',pinned:false,needsAck:false,poll:{q:'Which BLS date suits you?',opts:['14 Sep','16 Sep','18 Sep'],votes:[21,34,17]},title:'BLS recertification – September batch',when:'Yesterday',from:'Nursing Education',fromRole:'Training unit',audience:'Nurses due for renewal',body:'Sessions on 14, 16 and 18 September, 9 AM to 1 PM in the Skills Lab.',full:'Sessions on 14, 16 and 18 September, 9 AM to 1 PM in the Skills Lab.\n\nNurses whose BLS certificate expires before 31 December must attend one session. Register through your in-charge by 11 September. Bring your current certificate.'},
    {id:3,cat:'Roster',pinned:false,needsAck:false,title:'October roster draft open for review',when:'2 d ago',from:'Priya Das',fromRole:'Team Leader, LDR',audience:'LDR',body:'The October draft is published. Raise any conflicts by 15 September.',full:'The October draft is published in the Roster tab. Please review your shifts and raise any conflicts (exams, approved leave, family commitments) by 15 September.\n\nSwap requests after that date will need in-charge approval on a case-by-case basis.'},
    {id:4,cat:'Policy',pinned:false,needsAck:true,attachments:[{name:'High-alert-medicines-list-2026.pdf',ext:'PDF',size:'480 KB'},{name:'Double-check-SOP.pdf',ext:'PDF',size:'310 KB'}],ackCount:171,ackTotal:186,title:'Updated medication double-check policy',when:'4 d ago',from:'Chief of Nursing Services',fromRole:'Nursing administration',audience:'All nursing staff',body:'Independent double check is now mandatory for all high-alert medicines, including subcutaneous insulin.',full:'Independent double check is now mandatory for all high-alert medicines, including subcutaneous insulin and low-molecular-weight heparin.\n\nBoth nurses must sign the MAR. The list of high-alert medicines is available in Medicine Info, flagged with a red label.'},
    {id:5,cat:'General',pinned:false,needsAck:false,title:'Cafeteria hours during renovation',when:'1 w ago',from:'Administration',fromRole:'Hospital admin',audience:'All staff',body:'The staff cafeteria will close at 8 PM from 10 September until further notice.',full:'The staff cafeteria will close at 8 PM from 10 September until further notice. Night staff can collect packed meals from the 2nd-floor pantry.'},
  ];
  const DEPTS = ['LDR','CCU','SICU','MICU','NICU','Emergency','OPD','Cath Lab','CT ICU'];
  const CHATS = [
    {id:'ldr',scope:'dept',dept:'LDR',group:true,name:'LDR Nurses',members:14,online:true,sub:'14 members · 6 online',unread:3,when:'9:12',pinned:0,typing:'Priya is typing…',msgs:[
      {from:'Priya Das',role:'Team Leader',text:'Morning team. Bed 4 is going for CS at 10:30, please have the pre-op checklist done by 10.',t:'8:41',reactions:['Ack · 6']},
      {from:'Rahima Khatun',role:'Senior Staff Nurse',text:'Checklist done, consent signed. Waiting for anaesthesia review.',t:'8:58',attach:'Pre-op-checklist-B4.pdf',attachType:'pdf',replyTo:'Priya Das: Bed 4 is going for CS at 10:30…'},
      {from:'Sumaiya Akter',role:'Staff Nurse',text:'Bed 2 CTG shows variable decels, informed Dr. Farhana. She is coming.',t:'9:05',urgent:true,reactions:['On it · 2']},
      {from:'me',text:'Covering bed 6 now.',t:'9:10',seen:'Seen by 5'},
      {from:'Priya Das',role:'Team Leader',text:'Thanks Sumaiya. Stay with her and keep left lateral. Nasif, can you cover bed 6 meanwhile?',t:'9:12'}]},
    {id:'ldr-incharge',scope:'dept',dept:'LDR',group:false,name:'Priya Das',role:'Team Leader',online:true,sub:'Team Leader · online',unread:1,when:'9:14',msgs:[
      {from:'Priya Das',role:'Team Leader',text:'Your swap with Sumaiya for the 12th is approved. Roster updated.',t:'9:14'}]},
    {id:'ldr-rahima',scope:'dept',dept:'LDR',group:false,name:'Rahima Khatun',role:'Senior Staff Nurse',online:false,sub:'Senior Staff Nurse · last seen 8:58',unread:0,when:'Yest',msgs:[
      {from:'Rahima Khatun',role:'Senior Staff Nurse',text:'Can you bring the neonatal resus bag from store when you come in?',t:'Yest'},
      {from:'me',text:'Sure, will do.',t:'Yest'}]},
    {id:'ldr-doctors',scope:'dept',dept:'LDR',group:true,name:'LDR On-call Doctors',members:9,online:true,sub:'9 members · 3 online',unread:0,when:'Yest',msgs:[
      {from:'Dr. Farhana Islam',role:'Registrar, Obs & Gynae',text:'Please page me directly for any decels tonight, not through the desk.',t:'Yest'}]},
    {id:'nicu',scope:'dept',dept:'NICU',group:true,name:'NICU Nurses',members:11,online:true,sub:'11 members · 4 online',unread:0,when:'8:20',msgs:[
      {from:'Nusrat Jahan',role:'Staff Nurse, NICU',text:'Incubator 3 is ready to receive from LDR.',t:'8:20'}]},
    {id:'ccu',scope:'dept',dept:'CCU',group:true,name:'CCU Nurses',members:12,online:false,sub:'12 members',unread:0,when:'Mon',msgs:[
      {from:'Mahmud Hasan',role:'Charge Nurse, CCU',text:'Defib check log for September is in the drawer under the crash cart.',t:'Mon'}]},
    {id:'all-nursing',scope:'hosp',group:true,name:'All Nursing Staff',members:186,online:true,sub:'186 members · hospital-wide',unread:2,when:'8:55',msgs:[
      {from:'Elizabeth Jothi Raja Singh',role:'Nurse Manager',text:'Reminder: infection control isolation protocol is live from today. Acknowledge the notice in the app.',t:'8:30'},
      {from:'Nursing Education',role:'Training unit',text:'BLS September batch: 6 seats left on the 14th.',t:'8:55'}]},
    {id:'codes',scope:'hosp',group:true,name:'Rapid Response · Codes',members:42,online:true,sub:'42 members · read-only for staff',unread:0,when:'7:02',msgs:[
      {from:'Rapid Response Team',role:'System',text:'Code Blue cleared, 4th floor MICU, 06:58. Debrief at 14:00 in MICU seminar room.',t:'7:02'}]},
    {id:'it',scope:'hosp',group:true,name:'IT & App Support',members:3,online:false,sub:'Support · 9 AM – 6 PM',unread:0,when:'Fri',msgs:[
      {from:'IT Support',role:'Helpdesk',text:'Nurse App v2.1 is rolling out with chat and handover. Update from the Play Store.',t:'Fri'}]},
  ];
  const SCREENS = [
    ['login','Login'],['home','Home'],['roster','Roster'],['shift','Shift detail'],['requests','Requests'],['newRequest','New request'],
    ['chats','Chat'],['thread','Chat thread'],['meds','Medicine lookup'],['medDetail','Medicine detail'],['medRequest','Request a medicine'],['notices','Notices'],['noticeDetail','Notice detail'],
    ['composeNotice','New announcement'],['staff','Staff directory'],['staffDetail','Staff profile'],['reports','Reports (in-charge)'],['indicator','Indicator detail'],['shiftReport','Shift report form'],['datacol','Data collection'],['datacolForm','Data entry form'],['datacolHistory','My submissions'],['handover','Handover'],['incident','Incident report'],['performance','Performance'],['profile','Profile & settings'],['drawer','Sidebar menu'],
  ];
  const DAYS7 = ['Tue 2','Wed 3','Thu 4','Fri 5','Sat 6','Sun 7','Mon 8'];
  const CENSUS = { adm:[6,8,5,9,7,4,6], dis:[5,7,6,8,6,5,7], nvd:[3,4,2,5,3,2,4], cs:[2,3,2,3,3,1,2], occ:[78,85,80,92,88,75,82], deaths:[0,0,0,0,1,0,0], transfers:[1,2,0,1,1,0,1] };
  const INDICATORS = [
    {id:'hh',name:'Hand hygiene compliance',unit:'% of observed moments',v:87,bench:'≥ 85%',benchV:85,dir:'up',trend:[79,82,84,83,86,87],num:'Compliant moments observed',numV:261,den:'Total moments observed',denV:300,formula:'(compliant moments ÷ observed moments) × 100',capa:[{text:'Monthly hand-hygiene audit by two observers',owner:'Priya Das',due:'30 Sep',done:true},{text:'Refill alcohol rub at every bedside daily',owner:'Shathi Rani',due:'Ongoing',done:false}]},
    {id:'hapu',name:'Hospital-acquired pressure ulcer',unit:'per 1,000 patient-days',v:0.8,bench:'≤ 1.5',benchV:1.5,dir:'down',trend:[1.9,1.4,1.2,1.0,0.9,0.8],num:'New stage ≥2 pressure injuries',numV:1,den:'Patient-days',denV:1240,formula:'(new HAPU ÷ patient-days) × 1,000',capa:[{text:'Braden score on admission and every shift',owner:'All nurses',due:'Ongoing',done:true}]},
    {id:'falls',name:'Patient falls',unit:'falls this month',v:1,bench:'0',benchV:0,dir:'down',trend:[0,1,0,0,2,1],num:'Falls reported',numV:1,den:'—',denV:'—',formula:'Count of fall incidents reported',capa:[{text:'Bed rails up and call bell within reach for all post-op mothers',owner:'Rahima Khatun',due:'15 Sep',done:false}]},
    {id:'mederr',name:'Medication errors',unit:'errors this month',v:2,bench:'≤ 1',benchV:1,dir:'down',trend:[1,0,1,2,1,2],num:'Errors reaching the patient',numV:2,den:'Doses administered',denV:2860,formula:'Count of reported medication errors (all severities)',capa:[{text:'Independent double check for all high-alert medicines',owner:'Priya Das',due:'10 Sep',done:false},{text:'Root-cause review of both September errors',owner:'Quality team',due:'12 Sep',done:false}]},
    {id:'needle',name:'Needle-stick injuries',unit:'incidents this month',v:0,bench:'0',benchV:0,dir:'down',trend:[1,0,0,0,0,0],num:'Needle-stick injuries reported',numV:0,den:'—',denV:'—',formula:'Count of sharps injuries reported',capa:[]},
    {id:'ssc',name:'Surgical safety checklist',unit:'% of CS with full checklist',v:96,bench:'≥ 95%',benchV:95,dir:'up',trend:[88,91,93,94,95,96],num:'CS with all 3 phases signed',numV:15,den:'Caesarean sections',denV:16,formula:'(checklists complete ÷ CS performed) × 100',capa:[]},
    {id:'d2d',name:'Decision-to-delivery ≤ 30 min',unit:'% of category-1 CS',v:78,bench:'≥ 90%',benchV:90,dir:'up',trend:[85,82,80,84,81,78],num:'Cat-1 CS delivered within 30 min',numV:7,den:'Category-1 CS',denV:9,formula:'(cat-1 CS ≤ 30 min ÷ all cat-1 CS) × 100',capa:[{text:'Pre-assemble emergency CS trolley at every shift start',owner:'Sumaiya Akter',due:'9 Sep',done:false},{text:'Escalate anaesthesia call-out delays to Nurse Manager',owner:'Priya Das',due:'Ongoing',done:true}]},
  ];
  const IND_PLAIN = {
    hh:{means:'Out of every 100 times staff should have cleaned their hands, they did so 87 times. The hospital target is 85 or more.',action:'Keep alcohol rub stocked at every bed and remind the team at handover. Two observers audit each month.'},
    hapu:{means:'Fewer than 1 patient in 1,000 bed-days developed a new bedsore on the ward. Lower is better; the target is 1.5 or less.',action:'Keep doing Braden scores each shift and 2-hourly turns for high-risk mothers.'},
    falls:{means:'One patient fell this month. The target is zero.',action:'Bed rails up and call bell in reach for every post-op mother; review the fall in the next team meeting.'},
    mederr:{means:'Two medication errors reached patients this month, above the target of one or fewer. This indicator is in breach.',action:'Double-check every high-alert medicine with a second nurse and complete the root-cause review by 12 Sep.'},
    needle:{means:'No sharps injuries this month. Target met.',action:'Keep sharps bins below the fill line and never re-cap needles.'},
    ssc:{means:'96 of every 100 caesareans had the full surgical safety checklist signed. Target is 95 or more.',action:'Make sure Sign-out is completed before the patient leaves theatre.'},
    d2d:{means:'Only 78% of emergency (category-1) caesareans were delivered within 30 minutes of the decision. Target is 90%. This is in breach.',action:'Pre-assemble the emergency CS trolley each shift and escalate anaesthesia delays immediately.'},
  };
  const ragOf = i => { const ok = i.dir==='up' ? i.v>=i.benchV : i.v<=i.benchV; if (ok) return 'green'; const near = i.dir==='up' ? i.v>=i.benchV*0.9 : i.v<=i.benchV*1.5+0.5; return near ? 'amber' : 'red'; };
  const RAG = {green:['#1d8f57','rgba(43,182,115,.15)','On target'],amber:['#b8650a','rgba(224,138,30,.16)','Watch'],red:['#b32e2e','rgba(214,69,69,.13)','Breach']};
  const SR_STEPS = [
    {key:'census',label:'Census',fields:[['adm','Admissions'],['dis','Discharges'],['tin','Transfers in'],['tout','Transfers out'],['deaths','Deaths'],['census','Current census','Patients in beds at end of shift']],total:null},
    {key:'delivery',label:'Deliveries',fields:[['nvd','Normal (NVD)'],['cs','Caesarean'],['assisted','Assisted / instrumental'],['stillbirth','Stillbirth'],['nicu','Newborn to NICU']],total:'Total deliveries',totalKeys:['nvd','cs','assisted']},
    {key:'events',label:'Events',fields:[['falls','Patient falls'],['mederr','Medication errors'],['needle','Needle-stick'],['code','Code Blue / rapid response'],['complaint','Complaints'],['pph','PPH > 1000 mL']],total:'Total events',totalKeys:['falls','mederr','needle','code','complaint','pph']},
    {key:'staffing',label:'Staffing',fields:[['planned','Nurses planned'],['actual','Nurses on duty'],['sick','Sick / absent'],['ot','Overtime hours'],['pca','PCAs on duty']],total:null},
    {key:'notes',label:'Notes'},
    {key:'review',label:'Sign'},
  ];
  const DC_MONTHS = ['Jun 2026','Jul 2026','Aug 2026','Sep 2026'];
  const DC_CUR = 2; // Aug 2026 is the month due now (deadline 30 Sep)
  const DC_STAT_FIELDS = ['Admissions','Discharges','Deaths','Patient days','Deliveries (NVD)','Caesarean sections','Live births','Stillbirths'];
  const DC_ITEMS = [
    {id:'stat',kind:'stat',label:'Patient statistics sheet',meta:'Monthly sheet · 8 fields',d:'M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18'},
    {id:'hh',kind:'q',label:'Hand hygiene compliance',meta:'% of observed moments',num:'Compliant moments',den:'Moments observed',mult:100,unit:'%',bench:'≥ 85',benchV:85,dir:'up',grouped:true,d:'M7 11V7a5 5 0 0110 0v4M5 11h14l-1 9H6z'},
    {id:'hapu',kind:'q',label:'Hospital-acquired pressure ulcer',meta:'per 1,000 patient-days',num:'New stage ≥2 pressure injuries',den:'Patient-days',mult:1000,unit:'per 1000',bench:'≤ 1.5',benchV:1.5,dir:'down',denLocked:true,d:'M2 4v16M2 8h18a2 2 0 012 2v10M2 17h20M6 8v9'},
    {id:'falls',kind:'q',label:'Patient fall rate',meta:'per 1,000 patient-days',num:'Falls reported',den:'Patient-days',mult:1000,unit:'per 1000',bench:'≤ 0.5',benchV:0.5,dir:'down',denLocked:true,d:'M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z'},
    {id:'mederr',kind:'q',label:'Medication error rate',meta:'% of doses administered',num:'Errors reaching the patient',den:'Doses administered',mult:100,unit:'%',bench:'≤ 0.5',benchV:0.5,dir:'down',d:'M10.5 20.5l10-10a4.95 4.95 0 00-7-7l-10 10a4.95 4.95 0 007 7zM8.5 8.5l7 7'},
    {id:'needle',kind:'q',label:'Needle-stick injuries',meta:'per 100 staff',num:'Sharps injuries reported',den:'Nursing staff',mult:100,unit:'per 100',bench:'0',benchV:0,dir:'down',d:'M12 2v20M5 9l7-7 7 7'},
    {id:'ssc',kind:'q',label:'Surgical safety checklist',meta:'% of CS with full checklist',num:'CS with all 3 phases signed',den:'Caesarean sections',mult:100,unit:'%',bench:'≥ 95',benchV:95,dir:'up',d:'M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11'},
    {id:'d2d',kind:'q',label:'Decision-to-delivery ≤ 30 min',meta:'% of category-1 CS',num:'Cat-1 CS delivered within 30 min',den:'Category-1 CS',mult:100,unit:'%',bench:'≥ 90',benchV:90,dir:'up',d:'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2'},
  ];
  const DC_ST = {approved:['Approved','#1d8f57','rgba(43,182,115,.14)'],sent:['Pending review','#0072a3','rgba(0,144,202,.13)'],rejected:['Returned','#b32e2e','rgba(214,69,69,.12)'],missing:['Not submitted','#b8650a','rgba(224,138,30,.15)'],draft:['Draft saved','#6a52d4','rgba(106,82,212,.13)'],closed:['Not open yet','#7d8ea8','rgba(125,145,180,.16)']};
  const DC_GUIDES = {
    hh:{def:'A hand-hygiene moment is any of the WHO "5 Moments". Observe at least 200 moments per month across all shifts.',example:'176 compliant of 200 observed → 176 ÷ 200 × 100 = 88%',ref:'WHO Hand Hygiene Self-Assessment Framework'},
    hapu:{def:'Count new stage 2 or worse pressure injuries that developed after 24 h of admission. Denominator is total patient-days from the census.',example:'1 new HAPU ÷ 1,240 patient-days × 1,000 = 0.81',ref:'NPIAP / NDNQI definition'},
    falls:{def:'Any unplanned descent to the floor, with or without injury, witnessed or not. Denominator is patient-days, not admissions.',example:'1 fall ÷ 1,240 patient-days × 1,000 = 0.81',ref:'NDNQI Patient Falls'},
    mederr:{def:'Errors at any stage (prescribing, dispensing, administration) that reached the patient, any severity. Denominator is doses administered from the MAR.',example:'2 errors ÷ 2,860 doses × 100 = 0.07%',ref:'NCC MERP index'},
    needle:{def:'Any percutaneous injury from a needle or sharp. Report to Infection Control the same day.',example:'0 injuries ÷ 14 staff × 100 = 0',ref:'CDC Sharps Injury Prevention'},
    ssc:{def:'A checklist counts as complete only if Sign-in, Time-out and Sign-out are all signed.',example:'15 complete ÷ 16 CS × 100 = 93.8%',ref:'WHO Surgical Safety Checklist'},
    d2d:{def:'Category-1 caesarean: immediate threat to life of mother or fetus. Time from decision documented to delivery of the baby.',example:'7 within 30 min ÷ 9 cat-1 CS × 100 = 77.8%',ref:'RCOG / NICE CG132'},
  };
  const LAST_ACTIVE = {'Priya Das':'Active now','Rahima Khatun':'Last active 8:58 AM','Sumaiya Akter':'Active now','Tanvir Hossain':'Active 12 min ago','Shathi Rani':'Last active yesterday, 9:40 PM','Nusrat Jahan':'Active now','Mahmud Hasan':'Last active Mon, 6:15 PM','Farhana Islam':'Active 3 min ago','Elizabeth Jothi Raja Singh':'Active now','Arif Chowdhury':'Active 25 min ago','Tania Sultana':'Last active yesterday, 7:02 AM','Rafiq Ahmed':'Active now'};
  const lastActive = p => LAST_ACTIVE[p.name] || (p.online ? 'Active now' : 'Last active today');
  const lastActiveShort = p => { const l = lastActive(p); return l==='Active now' ? l : l.replace('Last active ','').replace('Active ','').replace(/^./,c=>c.toUpperCase()); };
  const lastActiveColor = p => p.online ? '#1d8f57' : '#7d8ea8';
  const ALL_STAFF = [
    {name:'Priya Das',role:'Team Leader, LDR',dept:'LDR',title:'Team Leader',online:true,admin:true,phone:'+880 1712 440 871',ext:'2214',email:'priya.das@unico.health',emp:'UN-0871',reg:'RN-44219',shift:'G1',joined:'Mar 2019'},
    {name:'Rahima Khatun',role:'Senior Staff Nurse, LDR',dept:'LDR',title:'Senior Staff Nurse',online:false,phone:'+880 1819 330 226',ext:'2215',email:'rahima.khatun@unico.health',emp:'UN-0934',reg:'RN-47102',shift:'M4',joined:'Nov 2020'},
    {name:'Sumaiya Akter',role:'Staff Nurse, LDR',dept:'LDR',title:'Staff Nurse',online:true,phone:'+880 1911 205 583',ext:'2215',email:'sumaiya.akter@unico.health',emp:'UN-1088',reg:'RN-59240',shift:'M4',joined:'Jan 2024'},
    {name:'Tanvir Hossain',role:'Staff Nurse, LDR',dept:'LDR',title:'Staff Nurse',online:true,phone:'+880 1677 812 094',ext:'2215',email:'tanvir.hossain@unico.health',emp:'UN-1051',reg:'RN-58877',shift:'M3',joined:'Sep 2023'},
    {name:'Shathi Rani',role:'PCA, LDR',dept:'LDR',title:'Patient Care Assistant',online:false,phone:'+880 1533 690 417',ext:'2216',email:'shathi.rani@unico.health',emp:'UN-1120',reg:'—',shift:'E3',joined:'Apr 2024'},
    {name:'Nusrat Jahan',role:'Staff Nurse, NICU',dept:'NICU',title:'Staff Nurse',online:true,phone:'+880 1745 118 362',ext:'3108',email:'nusrat.jahan@unico.health',emp:'UN-0990',reg:'RN-51330',shift:'M4',joined:'Jun 2021'},
    {name:'Mahmud Hasan',role:'Charge Nurse, CCU',dept:'CCU',title:'Charge Nurse',online:false,phone:'+880 1622 774 905',ext:'4102',email:'mahmud.hasan@unico.health',emp:'UN-0712',reg:'RN-39815',shift:'N2',joined:'Feb 2018'},
    {name:'Farhana Islam',role:'Registrar, Obs & Gynae',dept:'LDR',title:'Registrar',online:true,phone:'+880 1701 556 230',ext:'2201',email:'farhana.islam@unico.health',emp:'UN-D204',reg:'BMDC-71120',shift:'On call',joined:'Aug 2022'},
    {name:'Elizabeth Jothi Raja Singh',role:'Nurse Manager',dept:'Nursing Admin',title:'Nurse Manager',online:true,phone:'+880 1713 002 118',ext:'1001',email:'elizabeth.singh@unico.health',emp:'UN-0102',reg:'RN-21004',shift:'G1',joined:'May 2015'},
    {name:'Arif Chowdhury',role:'Staff Nurse, Emergency',dept:'Emergency',title:'Staff Nurse',online:true,phone:'+880 1855 401 776',ext:'1510',email:'arif.chowdhury@unico.health',emp:'UN-1012',reg:'RN-57310',shift:'E3',joined:'Jul 2023'},
    {name:'Tania Sultana',role:'Staff Nurse, SICU',dept:'SICU',title:'Staff Nurse',online:false,phone:'+880 1966 233 048',ext:'4210',email:'tania.sultana@unico.health',emp:'UN-0968',reg:'RN-50122',shift:'N2',joined:'Mar 2021'},
    {name:'Rafiq Ahmed',role:'Charge Nurse, MICU',dept:'MICU',title:'Charge Nurse',online:true,phone:'+880 1710 889 512',ext:'4301',email:'rafiq.ahmed@unico.health',emp:'UN-0655',reg:'RN-36720',shift:'M4',joined:'Oct 2017'},
  ];
  const pillBtn = on => `border:0;border-radius:8px;padding:7px 12px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;${on?'background:linear-gradient(140deg,#0aa0d4,#0072a3);color:#fff;box-shadow:0 4px 12px rgba(0,144,202,.3)':'background:transparent;color:#3c4858'}`;
  const chip = on => `border:1px solid ${on?'rgba(0,144,202,.5)':'rgba(125,145,180,.3)'};border-radius:999px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0;${on?'background:rgba(0,144,202,.12);color:#0072a3':'background:rgba(255,255,255,.6);color:#3c4858'}`;
  const catStyle = cat => { const c = CATS[cat]||CATS.General; return `font-size:9.5px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;padding:3px 7px;border-radius:6px;color:${c.c};background:${c.bg};flex-shrink:0`; };
  const statusStyle = s => ({Pending:'color:#b8650a;background:rgba(224,138,30,.15)',Approved:'color:#1d8f57;background:rgba(43,182,115,.14)',Declined:'color:#b32e2e;background:rgba(214,69,69,.12)'}[s]||'') + ';font-size:10.5px;font-weight:700;padding:3px 8px;border-radius:999px;white-space:nowrap;align-self:flex-start';
  const typeStyle = t => `font-size:9.5px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;padding:3px 7px;border-radius:6px;flex-shrink:0;${t==='Swap'?'color:#0072a3;background:rgba(0,144,202,.13)':'color:#6a52d4;background:rgba(106,82,212,.13)'}`;
  const avStyle = (group) => `display:grid;place-items:center;width:44px;height:44px;border-radius:13px;color:#fff;font-size:12px;font-weight:700;flex-shrink:0;background:${group?'linear-gradient(135deg,#0d2a4a,#0a5f87)':'linear-gradient(135deg,#3ab5a7,#0090ca)'}`;

  window.NURSE_APP_DATA = { SHIFTS, PATTERN, ROSTER, TODAY, DOWS, dateLabel, TEAM, ini, MED_CATS, FOODS, PREGS, MED_TABS, SEC_COLOR, CATS, ATTACH_ICONS, NOTICES, DEPTS, CHATS, SCREENS, DAYS7, CENSUS, INDICATORS, IND_PLAIN, ragOf, RAG, SR_STEPS, DC_MONTHS, DC_CUR, DC_STAT_FIELDS, DC_ITEMS, DC_ST, DC_GUIDES, LAST_ACTIVE, lastActive, lastActiveShort, lastActiveColor, ALL_STAFF, pillBtn, chip, catStyle, statusStyle, typeStyle, avStyle };
})();

;
/* ===== nurse-app-view.jsx ===== */
(function(){
(function () {
  'use strict';

  const React = window.React;
  const {
    S,
    ix,
    vx,
    AndroidDevice
  } = window.DC;
  function Screen_sLogin(v) {
    return v.sLogin ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "flex": "1",
        "display": "flex",
        "flexDirection": "column",
        "padding": "34px 24px 28px",
        "gap": "22px",
        "animation": "pop .35s ease backwards"
      }
    }, React.createElement("div", {
      style: {
        "position": "absolute",
        "top": "-40px",
        "left": "-40px",
        "width": "220px",
        "height": "220px",
        "borderRadius": "50%",
        "background": "radial-gradient(circle,rgba(39,168,219,.35),transparent 70%)",
        "filter": "blur(20px)",
        "animation": "orbFloat 12s ease-in-out infinite alternate",
        "pointerEvents": "none"
      }
    }), React.createElement("div", {
      style: {
        "position": "relative",
        "display": "flex",
        "flexDirection": "column",
        "gap": "14px",
        "marginTop": "40px"
      }
    }, React.createElement("img", {
      src: "assets/logo.svg",
      alt: "UNICO",
      style: {
        "height": "38px",
        "width": "auto",
        "alignSelf": "flex-start"
      }
    }), React.createElement("div", {
      style: {
        "fontSize": "26px",
        "fontWeight": "800",
        "letterSpacing": "-.5px",
        "lineHeight": "1.15"
      }
    }, "Welcome back,", React.createElement("br", null), "nurse."), React.createElement("div", {
      style: {
        "fontSize": "13px",
        "color": "#6c7a8c"
      }
    }, "Sign in with your employee ID and PIN.")), React.createElement("div", {
      style: {
        "position": "relative",
        "display": "flex",
        "flexDirection": "column",
        "gap": "12px",
        "background": "rgba(255,255,255,.72)",
        "border": "1px solid rgba(255,255,255,.95)",
        "borderRadius": "18px",
        "padding": "18px",
        "boxShadow": "0 14px 40px rgba(31,59,90,.14)"
      }
    }, React.createElement("label", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "5px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Employee ID"), React.createElement("input", {
      value: vx(v.empId),
      onChange: v.setEmpId,
      placeholder: "Employee ID or username",
      style: {
        "border": "1px solid rgba(125,145,180,.35)",
        "borderRadius": "11px",
        "padding": "12px 13px",
        "fontSize": "15px",
        "background": "rgba(255,255,255,.85)",
        "outline": "none",
        "fontFamily": "'IBM Plex Mono',monospace"
      }
    })), React.createElement("label", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "5px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "PIN"), React.createElement("input", {
      type: "password",
      value: vx(v.pin),
      onChange: v.setPin,
      placeholder: "\u2022\u2022\u2022\u2022",
      style: {
        "border": "1px solid rgba(125,145,180,.35)",
        "borderRadius": "11px",
        "padding": "12px 13px",
        "fontSize": "15px",
        "background": "rgba(255,255,255,.85)",
        "outline": "none",
        "letterSpacing": "4px"
      }
    })), React.createElement("button", {
      onClick: v.doLogin,
      style: {
        "marginTop": "4px",
        "border": "0",
        "borderRadius": "12px",
        "padding": "14px",
        "background": "linear-gradient(140deg,#0aa0d4,#0072a3)",
        "color": "#fff",
        "fontSize": "15px",
        "fontWeight": "700",
        "cursor": "pointer",
        "boxShadow": "0 10px 24px rgba(0,144,202,.35)"
      }
    }, "Sign in"), React.createElement("button", {
      onClick: v.doLogin,
      style: {
        "border": "1px solid rgba(125,145,180,.35)",
        "borderRadius": "12px",
        "padding": "12px",
        "background": "rgba(255,255,255,.7)",
        "color": "#16202e",
        "fontSize": "13.5px",
        "fontWeight": "600",
        "cursor": "pointer",
        "display": "flex",
        "alignItems": "center",
        "justifyContent": "center",
        "gap": "8px"
      }
    }, React.createElement("svg", {
      width: "17",
      height: "17",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M7 3H5a2 2 0 00-2 2v2M17 3h2a2 2 0 012 2v2M7 21H5a2 2 0 01-2-2v-2M17 21h2a2 2 0 002-2v-2M8 12a4 4 0 018 0c0 3-2 4-2 6M12 8v.01"
    })), "Use fingerprint")), React.createElement("span", {
      style: {
        "flex": "1"
      }
    }), React.createElement("div", {
      style: {
        "textAlign": "center",
        "fontSize": "11.5px",
        "color": "#7d8ea8"
      }
    }, ix(v.loginFooter)))) : null;
  }
  function Screen_sHome(v) {
    return v.sHome ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "flex": "1",
        "minHeight": "0",
        "overflow": "auto",
        "padding": "14px 16px 20px",
        "display": "flex",
        "flexDirection": "column",
        "gap": "14px",
        "animation": "pop .3s ease backwards"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px"
      }
    }, React.createElement("button", {
      onClick: v.openDrawer,
      style: {
        "width": "40px",
        "height": "40px",
        "borderRadius": "12px",
        "border": "1px solid rgba(255,255,255,.9)",
        "background": "rgba(255,255,255,.6)",
        "display": "grid",
        "placeItems": "center",
        "color": "#3c4858",
        "cursor": "pointer",
        "flexShrink": "0"
      }
    }, React.createElement("svg", {
      width: "19",
      height: "19",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round"
    }, React.createElement("path", {
      d: "M4 7h16M4 12h16M4 17h10"
    }))), React.createElement("div", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "12px",
        "color": "#6c7a8c"
      }
    }, ix(v.greeting)), React.createElement("div", {
      style: {
        "fontSize": "16px",
        "fontWeight": "800",
        "letterSpacing": "-.2px",
        "whiteSpace": "nowrap",
        "overflow": "hidden",
        "textOverflow": "ellipsis"
      }
    }, ix(v.staffName))), React.createElement("button", {
      onClick: v.goNotices,
      style: {
        "position": "relative",
        "width": "40px",
        "height": "40px",
        "borderRadius": "12px",
        "border": "1px solid rgba(255,255,255,.9)",
        "background": "rgba(255,255,255,.6)",
        "display": "grid",
        "placeItems": "center",
        "color": "#3c4858",
        "cursor": "pointer"
      }
    }, React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "1.9",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0"
    })), v.hasUnread ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: {
        "position": "absolute",
        "top": "7px",
        "right": "8px",
        "width": "8px",
        "height": "8px",
        "borderRadius": "50%",
        "background": "#d23a52",
        "border": "2px solid #fff"
      }
    })) : null), React.createElement("button", {
      onClick: v.goProfile,
      style: {
        "border": "0",
        "padding": "0",
        "background": "none",
        "cursor": "pointer",
        "flexShrink": "0"
      }
    }, v.isNurse ? React.createElement(React.Fragment, null, React.createElement("img", {
      src: v.avatarUrl,
      alt: "",
      style: {
        "width": "40px",
        "height": "40px",
        "borderRadius": "12px",
        "objectFit": "cover",
        "boxShadow": "0 0 0 2px rgba(122,196,232,.4)",
        "display": "block"
      }
    })) : null, v.isIncharge ? React.createElement(React.Fragment, null, React.createElement("img", {
      src: v.avatarUrl,
      alt: "",
      style: {
        "width": "40px",
        "height": "40px",
        "borderRadius": "12px",
        "objectFit": "cover",
        "boxShadow": "0 0 0 2px rgba(122,196,232,.4)",
        "display": "block"
      }
    })) : null)), React.createElement("div", {
      style: {
        "position": "relative",
        "overflow": "hidden",
        "flexShrink": "0",
        "borderRadius": "20px",
        "padding": "18px",
        "color": "#fff",
        "background": "linear-gradient(140deg,#0d2a4a,#0a5f87 60%,#1a9ab8)",
        "boxShadow": "0 16px 40px rgba(10,50,90,.32)"
      }
    }, React.createElement("div", {
      style: {
        "position": "absolute",
        "right": "-40px",
        "top": "-50px",
        "width": "190px",
        "height": "190px",
        "borderRadius": "50%",
        "background": "radial-gradient(circle,rgba(95,211,196,.5),transparent 70%)",
        "filter": "blur(12px)"
      }
    }), React.createElement("div", {
      style: {
        "position": "relative",
        "display": "flex",
        "alignItems": "center",
        "gap": "8px",
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".8px",
        "textTransform": "uppercase",
        "color": "rgba(255,255,255,.75)"
      }
    }, React.createElement("span", {
      style: {
        "width": "7px",
        "height": "7px",
        "borderRadius": "50%",
        "background": "#3ddc97",
        "animation": "livepulse 2.4s infinite"
      }
    }), "Today · ", ix(v.todayLabel)), React.createElement("div", {
      style: {
        "position": "relative",
        "display": "flex",
        "alignItems": "flex-end",
        "gap": "12px",
        "marginTop": "10px"
      }
    }, React.createElement("div", {
      style: {
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "44px",
        "fontWeight": "600",
        "lineHeight": "1",
        "letterSpacing": "-1px"
      }
    }, ix(v.todayCode)), React.createElement("div", {
      style: {
        "paddingBottom": "5px"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "15px",
        "fontWeight": "700"
      }
    }, ix(v.todayShiftName)), React.createElement("div", {
      style: {
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "12.5px",
        "color": "rgba(255,255,255,.8)"
      }
    }, ix(v.todayTime)))), React.createElement("div", {
      style: {
        "position": "relative",
        "display": "flex",
        "alignItems": "center",
        "gap": "8px",
        "marginTop": "14px",
        "flexWrap": "wrap"
      }
    }, React.createElement("button", {
      onClick: v.pickUnit,
      title: "Switch unit",
      style: {
        "fontSize": "11.5px",
        "padding": "5px 10px",
        "borderRadius": "999px",
        "background": "rgba(255,255,255,.16)",
        "border": "1px solid rgba(255,255,255,.25)",
        "color": "#fff",
        "cursor": "pointer",
        "fontFamily": "inherit"
      }
    }, ix(v.unitChip)), v.hasCharge ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: {
        "fontSize": "11.5px",
        "padding": "5px 10px",
        "borderRadius": "999px",
        "background": "rgba(255,255,255,.16)",
        "border": "1px solid rgba(255,255,255,.25)"
      }
    }, "Charge: ", ix(v.chargeNurse))) : null, React.createElement("span", {
      style: {
        "flex": "1"
      }
    }), React.createElement("button", {
      onClick: v.toggleClock,
      style: S(v.clockBtnStyle)
    }, ix(v.clockLabel)))), v.isIncharge ? React.createElement(React.Fragment, null, React.createElement("button", {
      onClick: v.goReports,
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "12px",
        "textAlign": "left",
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "16px",
        "padding": "12px 14px",
        "background": "rgba(255,255,255,.66)",
        "cursor": "pointer",
        "color": "#16202e",
        "boxShadow": "0 8px 22px rgba(31,59,90,.08)"
      }
    }, React.createElement("span", {
      style: {
        "display": "grid",
        "placeItems": "center",
        "width": "40px",
        "height": "40px",
        "borderRadius": "12px",
        "background": "rgba(0,144,202,.13)",
        "color": "#0072a3"
      }
    }, React.createElement("svg", {
      width: "19",
      height: "19",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M18 20V10M12 20V4M6 20v-6"
    }))), React.createElement("span", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "14px",
        "fontWeight": "800"
      }
    }, "Unit reports · today"), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "12px",
        "color": "#6c7a8c"
      }
    }, ix(v.homeReportLine))), React.createElement("span", {
      style: {
        "display": "flex",
        "alignItems": "flex-end",
        "gap": "2px",
        "height": "26px",
        "width": "52px"
      }
    }, (Array.isArray(v.homeSpark) ? v.homeSpark : []).map((b, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("span", {
      style: S(b)
    }))))), React.createElement("button", {
      onClick: v.goApprovals,
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "12px",
        "textAlign": "left",
        "border": "1px solid rgba(224,138,30,.35)",
        "borderRadius": "16px",
        "padding": "12px 14px",
        "background": "linear-gradient(140deg,rgba(255,244,228,.9),rgba(255,255,255,.7))",
        "cursor": "pointer",
        "boxShadow": "0 8px 22px rgba(31,59,90,.08)"
      }
    }, React.createElement("span", {
      style: {
        "display": "grid",
        "placeItems": "center",
        "width": "40px",
        "height": "40px",
        "borderRadius": "12px",
        "background": "rgba(224,138,30,.15)",
        "color": "#b8650a"
      }
    }, React.createElement("svg", {
      width: "19",
      height: "19",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"
    }))), React.createElement("span", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "14px",
        "fontWeight": "800"
      }
    }, ix(v.pendingCount), " approvals waiting"), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "12px",
        "color": "#6c7a8c"
      }
    }, "Swap and leave requests from your team")), React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "#9aa6b4",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M9 6l6 6-6 6"
    })))) : null, React.createElement("div", {
      style: {
        "display": "grid",
        "gridTemplateColumns": "repeat(4,1fr)",
        "gap": "8px"
      }
    }, (Array.isArray(v.quickActions) ? v.quickActions : []).map((q, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: q?.go,
      style: {
        "position": "relative",
        "display": "flex",
        "flexDirection": "column",
        "alignItems": "center",
        "gap": "7px",
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "14px",
        "padding": "12px 4px 10px",
        "background": "rgba(255,255,255,.62)",
        "cursor": "pointer",
        "color": "#16202e"
      },
      className: "dcp0"
    }, React.createElement("span", {
      style: S(`display:grid;place-items:center;width:38px;height:38px;border-radius:12px;color:${q?.color ?? ""};background:${q?.bg ?? ""}`)
    }, React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: q?.d
    }))), React.createElement("span", {
      style: {
        "fontSize": "11px",
        "fontWeight": "700"
      }
    }, ix(q?.label)), q?.badge ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: {
        "position": "absolute",
        "top": "8px",
        "right": "10px",
        "minWidth": "16px",
        "height": "16px",
        "padding": "0 4px",
        "borderRadius": "8px",
        "background": "#d23a52",
        "color": "#fff",
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "9.5px",
        "fontWeight": "700",
        "display": "grid",
        "placeItems": "center",
        "boxSizing": "border-box"
      }
    }, ix(q?.badge))) : null)))), React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "8px"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "justifyContent": "space-between"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".7px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Next 7 days"), React.createElement("button", {
      onClick: v.goRoster,
      style: {
        "border": "0",
        "background": "none",
        "color": "#0072a3",
        "fontSize": "12px",
        "fontWeight": "700",
        "cursor": "pointer",
        "padding": "0"
      }
    }, "Full roster")), React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "6px"
      }
    }, (Array.isArray(v.upcoming) ? v.upcoming : []).map((u, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: u?.go,
      style: S(u?.style)
    }, React.createElement("span", {
      style: {
        "fontSize": "10px",
        "fontWeight": "700",
        "color": "#7d8ea8"
      }
    }, ix(u?.dow)), React.createElement("span", {
      style: {
        "fontSize": "14px",
        "fontWeight": "700"
      }
    }, ix(u?.d)), React.createElement("span", {
      style: S(u?.codeStyle)
    }, ix(u?.code))))))), React.createElement("button", {
      onClick: v.goDatacol,
      style: S(`display:flex;align-items:center;gap:12px;text-align:left;border:1px solid ${v.dcHomeBorder ?? ""};border-radius:14px;padding:11px 13px;background:rgba(255,255,255,.65);cursor:pointer;color:#16202e`)
    }, React.createElement("span", {
      style: {
        "display": "grid",
        "placeItems": "center",
        "width": "38px",
        "height": "38px",
        "borderRadius": "12px",
        "background": "rgba(0,144,202,.13)",
        "color": "#0072a3"
      }
    }, React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"
    }))), React.createElement("span", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "13px",
        "fontWeight": "700"
      }
    }, "Monthly data · ", ix(v.dcMonthLabel)), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "11.5px",
        "color": "#6c7a8c"
      }
    }, ix(v.dcHomeLine))), React.createElement("span", {
      style: S(v.dcHomeBadge)
    }, ix(v.dcOpenCount))), React.createElement("button", {
      onClick: v.goHandover,
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "12px",
        "textAlign": "left",
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "14px",
        "padding": "11px 13px",
        "background": "rgba(255,255,255,.65)",
        "cursor": "pointer",
        "color": "#16202e"
      }
    }, React.createElement("span", {
      style: {
        "display": "grid",
        "placeItems": "center",
        "width": "38px",
        "height": "38px",
        "borderRadius": "12px",
        "background": "rgba(106,82,212,.13)",
        "color": "#6a52d4"
      }
    }, React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 12h6M9 16h4"
    }))), React.createElement("span", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "13px",
        "fontWeight": "700"
      }
    }, "Handover · ", ix(v.handoverSummary)), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "11.5px",
        "color": "#6c7a8c"
      }
    }, ix(v.handoverSub))), React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "#9aa6b4",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M9 6l6 6-6 6"
    }))), React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "8px"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "justifyContent": "space-between"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".7px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Latest notices"), React.createElement("button", {
      onClick: v.goNotices,
      style: {
        "border": "0",
        "background": "none",
        "color": "#0072a3",
        "fontSize": "12px",
        "fontWeight": "700",
        "cursor": "pointer",
        "padding": "0"
      }
    }, "See all")), (Array.isArray(v.homeNotices) ? v.homeNotices : []).map((n, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: n?.go,
      style: {
        "display": "flex",
        "alignItems": "flex-start",
        "gap": "10px",
        "textAlign": "left",
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "14px",
        "padding": "11px 13px",
        "background": "rgba(255,255,255,.65)",
        "cursor": "pointer",
        "color": "#16202e"
      }
    }, React.createElement("span", {
      style: S(n?.catStyle)
    }, ix(n?.cat)), React.createElement("span", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "13px",
        "fontWeight": "700",
        "lineHeight": "1.3"
      }
    }, ix(n?.title)), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "11px",
        "color": "#6c7a8c",
        "marginTop": "2px"
      }
    }, ix(n?.when), " · ", ix(n?.from))), n?.unread ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: {
        "width": "8px",
        "height": "8px",
        "borderRadius": "50%",
        "background": "#0090ca",
        "marginTop": "5px",
        "flexShrink": "0"
      }
    })) : null)))))) : null;
  }
  function Screen_sRoster(v) {
    return v.sRoster ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "flex": "1",
        "minHeight": "0",
        "overflow": "auto",
        "padding": "14px 16px 20px",
        "display": "flex",
        "flexDirection": "column",
        "gap": "14px",
        "animation": "pop .3s ease backwards"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px"
      }
    }, React.createElement("button", {
      onClick: v.openDrawer,
      style: {
        "width": "38px",
        "height": "38px",
        "borderRadius": "11px",
        "border": "1px solid rgba(255,255,255,.9)",
        "background": "rgba(255,255,255,.6)",
        "display": "grid",
        "placeItems": "center",
        "color": "#3c4858",
        "cursor": "pointer",
        "flexShrink": "0"
      }
    }, React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round"
    }, React.createElement("path", {
      d: "M4 7h16M4 12h16M4 17h10"
    }))), React.createElement("div", {
      style: {
        "flex": "1"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "19px",
        "fontWeight": "800",
        "letterSpacing": "-.3px"
      }
    }, "My roster"), React.createElement("div", {
      style: {
        "fontSize": "12px",
        "color": "#6c7a8c"
      }
    }, ix(v.dept), " · ", ix(v.monthLabel))), React.createElement("div", {
      style: {
        "display": "inline-flex",
        "background": "rgba(255,255,255,.55)",
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "10px",
        "padding": "3px",
        "gap": "2px"
      }
    }, React.createElement("button", {
      style: {
        "width": "30px",
        "height": "30px",
        "border": "0",
        "borderRadius": "8px",
        "background": "transparent",
        "color": "#3c4858",
        "cursor": "pointer",
        "display": "grid",
        "placeItems": "center"
      }
    }, React.createElement("svg", {
      width: "15",
      height: "15",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M15 6l-6 6 6 6"
    }))), React.createElement("button", {
      style: {
        "width": "30px",
        "height": "30px",
        "border": "0",
        "borderRadius": "8px",
        "background": "transparent",
        "color": "#3c4858",
        "cursor": "pointer",
        "display": "grid",
        "placeItems": "center"
      }
    }, React.createElement("svg", {
      width: "15",
      height: "15",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M9 6l6 6-6 6"
    }))))), React.createElement("div", {
      style: {
        "display": "grid",
        "gridTemplateColumns": "repeat(4,1fr)",
        "gap": "8px"
      }
    }, (Array.isArray(v.rosterStats) ? v.rosterStats : []).map((s, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "13px",
        "padding": "10px 6px",
        "background": "rgba(255,255,255,.62)",
        "textAlign": "center"
      }
    }, React.createElement("div", {
      style: {
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "19px",
        "fontWeight": "600",
        "lineHeight": "1"
      }
    }, ix(s?.n)), React.createElement("div", {
      style: {
        "fontSize": "10px",
        "fontWeight": "700",
        "letterSpacing": ".4px",
        "textTransform": "uppercase",
        "color": "#7d8ea8",
        "marginTop": "4px"
      }
    }, ix(s?.label)))))), React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.92)",
        "borderRadius": "18px",
        "padding": "14px 12px",
        "background": "rgba(255,255,255,.7)",
        "boxShadow": "0 12px 32px rgba(31,59,90,.1)"
      }
    }, React.createElement("div", {
      style: {
        "display": "grid",
        "gridTemplateColumns": "repeat(7,1fr)",
        "gap": "4px",
        "marginBottom": "6px"
      }
    }, (Array.isArray(v.dows) ? v.dows : []).map((d, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "textAlign": "center",
        "fontSize": "10px",
        "fontWeight": "700",
        "letterSpacing": ".4px",
        "color": "#7d8ea8"
      }
    }, ix(d))))), React.createElement("div", {
      style: {
        "display": "grid",
        "gridTemplateColumns": "repeat(7,1fr)",
        "gap": "4px"
      }
    }, (Array.isArray(v.calCells) ? v.calCells : []).map((c, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: c?.go,
      style: S(c?.style)
    }, React.createElement("span", {
      style: S(c?.dayStyle)
    }, ix(c?.d)), React.createElement("span", {
      style: S(c?.codeStyle)
    }, ix(c?.code))))))), React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "10px",
        "flexWrap": "wrap",
        "padding": "0 2px"
      }
    }, (Array.isArray(v.legend) ? v.legend : []).map((l, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("span", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "6px",
        "fontSize": "11px",
        "color": "#3c4858"
      }
    }, React.createElement("span", {
      style: S(l?.dot)
    }), ix(l?.label))))), React.createElement("button", {
      onClick: v.goNewRequest,
      style: {
        "display": "flex",
        "alignItems": "center",
        "justifyContent": "center",
        "gap": "8px",
        "border": "1px dashed rgba(0,144,202,.5)",
        "borderRadius": "14px",
        "padding": "13px",
        "background": "rgba(0,144,202,.06)",
        "color": "#0072a3",
        "fontSize": "13px",
        "fontWeight": "700",
        "cursor": "pointer"
      }
    }, React.createElement("svg", {
      width: "16",
      height: "16",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"
    })), "Request a swap or leave"))) : null;
  }
  function Screen_sShift(v) {
    return v.sShift ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "flex": "1",
        "minHeight": "0",
        "overflow": "auto",
        "padding": "12px 16px 20px",
        "display": "flex",
        "flexDirection": "column",
        "gap": "14px",
        "animation": "pop .3s ease backwards"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px"
      }
    }, React.createElement("button", {
      onClick: v.goRoster,
      style: {
        "width": "38px",
        "height": "38px",
        "borderRadius": "11px",
        "border": "1px solid rgba(255,255,255,.9)",
        "background": "rgba(255,255,255,.6)",
        "display": "grid",
        "placeItems": "center",
        "color": "#3c4858",
        "cursor": "pointer"
      }
    }, React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M15 6l-6 6 6 6"
    }))), React.createElement("div", {
      style: {
        "fontSize": "16px",
        "fontWeight": "800"
      }
    }, "Shift detail")), React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.92)",
        "borderRadius": "18px",
        "padding": "16px",
        "background": "rgba(255,255,255,.72)",
        "boxShadow": "0 12px 32px rgba(31,59,90,.1)",
        "display": "flex",
        "flexDirection": "column",
        "gap": "12px"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "14px"
      }
    }, React.createElement("span", {
      style: S(v.selCodeStyle)
    }, ix(v.selCode)), React.createElement("div", {
      style: {
        "flex": "1"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "16px",
        "fontWeight": "800"
      }
    }, ix(v.selDateLabel)), React.createElement("div", {
      style: {
        "fontSize": "12.5px",
        "color": "#6c7a8c"
      }
    }, ix(v.selShiftName), " · ", React.createElement("span", {
      style: {
        "fontFamily": "'IBM Plex Mono',monospace"
      }
    }, ix(v.selTime))))), React.createElement("div", {
      style: {
        "display": "grid",
        "gridTemplateColumns": "1fr 1fr",
        "gap": "8px"
      }
    }, React.createElement("div", {
      style: {
        "borderRadius": "12px",
        "padding": "10px 12px",
        "background": "rgba(0,144,202,.07)"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "10px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Unit"), React.createElement("div", {
      style: {
        "fontSize": "13.5px",
        "fontWeight": "700",
        "marginTop": "2px"
      }
    }, ix(v.dept))), React.createElement("div", {
      style: {
        "borderRadius": "12px",
        "padding": "10px 12px",
        "background": "rgba(58,181,167,.1)"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "10px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Hours"), React.createElement("div", {
      style: {
        "fontSize": "13.5px",
        "fontWeight": "700",
        "marginTop": "2px",
        "fontFamily": "'IBM Plex Mono',monospace"
      }
    }, ix(v.selHours))))), v.selIsWork ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "8px"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".7px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "On duty with you"), (Array.isArray(v.team) ? v.team : []).map((t, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "11px",
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "13px",
        "padding": "10px 12px",
        "background": "rgba(255,255,255,.62)"
      }
    }, React.createElement("span", {
      style: {
        "display": "grid",
        "placeItems": "center",
        "width": "36px",
        "height": "36px",
        "borderRadius": "10px",
        "color": "#fff",
        "fontSize": "12px",
        "fontWeight": "700",
        "background": "linear-gradient(135deg,#3ab5a7,#0090ca)"
      }
    }, ix(t?.ini)), React.createElement("div", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "13px",
        "fontWeight": "700"
      }
    }, ix(t?.name)), React.createElement("div", {
      style: {
        "fontSize": "11px",
        "color": "#6c7a8c"
      }
    }, ix(t?.role))), React.createElement("span", {
      style: {
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "12px",
        "fontWeight": "700",
        "color": "#0072a3"
      }
    }, ix(t?.code)), React.createElement("a", {
      href: t?.tel,
      title: "Call",
      style: {
        "width": "32px",
        "height": "32px",
        "borderRadius": "9px",
        "border": "1px solid rgba(43,182,115,.3)",
        "background": "rgba(43,182,115,.1)",
        "color": "#1d8f57",
        "display": "grid",
        "placeItems": "center",
        "cursor": "pointer",
        "textDecoration": "none"
      }
    }, React.createElement("svg", {
      width: "14",
      height: "14",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1.9.4 1.8.7 2.6a2 2 0 01-.5 2.1L8 9.7a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.4c.8.3 1.7.5 2.6.7a2 2 0 011.7 2z"
    }))), React.createElement("button", {
      onClick: t?.chat,
      title: "Message",
      style: {
        "width": "32px",
        "height": "32px",
        "borderRadius": "9px",
        "border": "1px solid rgba(0,144,202,.25)",
        "background": "rgba(0,144,202,.08)",
        "color": "#0072a3",
        "display": "grid",
        "placeItems": "center",
        "cursor": "pointer"
      }
    }, React.createElement("svg", {
      width: "15",
      height: "15",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M21 12a8 8 0 01-8 8H8l-5 3 1.5-4.5A8 8 0 1121 12z"
    }))))))), React.createElement("button", {
      onClick: v.goNewRequest,
      style: {
        "border": "1px solid rgba(125,145,180,.35)",
        "borderRadius": "13px",
        "padding": "13px",
        "background": "rgba(255,255,255,.7)",
        "color": "#16202e",
        "fontSize": "13px",
        "fontWeight": "700",
        "cursor": "pointer"
      }
    }, "Request swap for this shift")) : null, v.selIsOff ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "borderRadius": "14px",
        "padding": "14px",
        "background": "rgba(125,145,180,.12)",
        "fontSize": "13px",
        "color": "#3c4858",
        "textAlign": "center"
      }
    }, "Rest day. Enjoy it.")) : null)) : null;
  }
  function Screen_sRequests(v) {
    return v.sRequests ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "flex": "1",
        "minHeight": "0",
        "overflow": "auto",
        "padding": "14px 16px 20px",
        "display": "flex",
        "flexDirection": "column",
        "gap": "14px",
        "animation": "pop .3s ease backwards"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px"
      }
    }, React.createElement("button", {
      onClick: v.goHome,
      style: {
        "width": "38px",
        "height": "38px",
        "borderRadius": "11px",
        "border": "1px solid rgba(255,255,255,.9)",
        "background": "rgba(255,255,255,.6)",
        "display": "grid",
        "placeItems": "center",
        "color": "#3c4858",
        "cursor": "pointer"
      }
    }, React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M15 6l-6 6 6 6"
    }))), React.createElement("div", {
      style: {
        "flex": "1"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "19px",
        "fontWeight": "800",
        "letterSpacing": "-.3px"
      }
    }, "Requests"), React.createElement("div", {
      style: {
        "fontSize": "12px",
        "color": "#6c7a8c"
      }
    }, "Swaps and leave")), React.createElement("button", {
      onClick: v.goNewRequest,
      style: {
        "display": "inline-flex",
        "alignItems": "center",
        "gap": "6px",
        "border": "0",
        "borderRadius": "11px",
        "padding": "10px 13px",
        "background": "linear-gradient(140deg,#0aa0d4,#0072a3)",
        "color": "#fff",
        "fontSize": "12.5px",
        "fontWeight": "700",
        "cursor": "pointer",
        "boxShadow": "0 8px 20px rgba(0,144,202,.3)"
      }
    }, React.createElement("svg", {
      width: "14",
      height: "14",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.4",
      strokeLinecap: "round"
    }, React.createElement("path", {
      d: "M12 5v14M5 12h14"
    })), "New")), React.createElement("div", {
      style: {
        "display": "inline-flex",
        "background": "rgba(255,255,255,.55)",
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "11px",
        "padding": "3px",
        "gap": "3px"
      }
    }, (Array.isArray(v.reqTabs) ? v.reqTabs : []).map((t, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: t?.go,
      style: S(t?.style)
    }, ix(t?.label), t?.badge ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: {
        "marginLeft": "6px",
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "10px",
        "fontWeight": "700",
        "padding": "1px 6px",
        "borderRadius": "8px",
        "color": "#fff",
        "background": "#e08a1e"
      }
    }, ix(t?.badge))) : null)))), v.reqMine ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "8px"
      }
    }, (Array.isArray(v.myRequests) ? v.myRequests : []).map((r, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "14px",
        "padding": "12px 13px",
        "background": "rgba(255,255,255,.65)",
        "display": "flex",
        "flexDirection": "column",
        "gap": "6px"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "8px"
      }
    }, React.createElement("span", {
      style: S(r?.typeStyle)
    }, ix(r?.type)), React.createElement("span", {
      style: {
        "flex": "1",
        "fontSize": "13px",
        "fontWeight": "700"
      }
    }, ix(r?.title)), React.createElement("span", {
      style: S(r?.statusStyle)
    }, ix(r?.status))), React.createElement("div", {
      style: {
        "fontSize": "11.5px",
        "color": "#6c7a8c"
      }
    }, ix(r?.meta))))))) : null, v.reqApprovals ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "8px"
      }
    }, (Array.isArray(v.approvals) ? v.approvals : []).map((a, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "14px",
        "padding": "12px 13px",
        "background": "rgba(255,255,255,.65)",
        "display": "flex",
        "flexDirection": "column",
        "gap": "9px"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px"
      }
    }, React.createElement("span", {
      style: {
        "display": "grid",
        "placeItems": "center",
        "width": "34px",
        "height": "34px",
        "borderRadius": "10px",
        "color": "#fff",
        "fontSize": "11px",
        "fontWeight": "700",
        "background": "linear-gradient(135deg,#3ab5a7,#0090ca)"
      }
    }, ix(a?.ini)), React.createElement("div", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "13px",
        "fontWeight": "700"
      }
    }, ix(a?.name)), React.createElement("div", {
      style: {
        "fontSize": "11.5px",
        "color": "#6c7a8c"
      }
    }, ix(a?.title))), React.createElement("span", {
      style: S(a?.typeStyle)
    }, ix(a?.type))), React.createElement("div", {
      style: {
        "fontSize": "12px",
        "color": "#3c4858",
        "lineHeight": "1.4"
      }
    }, ix(a?.reason)), a?.pending ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "6px"
      }
    }, React.createElement("button", {
      onClick: a?.approve,
      style: {
        "flex": "1",
        "border": "0",
        "borderRadius": "10px",
        "padding": "10px",
        "background": "linear-gradient(140deg,#2bb673,#1d8f57)",
        "color": "#fff",
        "fontSize": "12.5px",
        "fontWeight": "700",
        "cursor": "pointer"
      }
    }, "Approve"), React.createElement("button", {
      onClick: a?.reject,
      style: {
        "flex": "1",
        "border": "1px solid rgba(210,58,82,.4)",
        "borderRadius": "10px",
        "padding": "10px",
        "background": "rgba(210,58,82,.08)",
        "color": "#b32e2e",
        "fontSize": "12.5px",
        "fontWeight": "700",
        "cursor": "pointer"
      }
    }, "Decline"))) : null, a?.decided ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: S(a?.statusStyle)
    }, ix(a?.status))) : null))))) : null)) : null;
  }
  function Screen_sNewRequest(v) {
    return v.sNewRequest ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "flex": "1",
        "minHeight": "0",
        "overflow": "auto",
        "padding": "12px 16px 20px",
        "display": "flex",
        "flexDirection": "column",
        "gap": "14px",
        "animation": "pop .3s ease backwards"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px"
      }
    }, React.createElement("button", {
      onClick: v.goRequests,
      style: {
        "width": "38px",
        "height": "38px",
        "borderRadius": "11px",
        "border": "1px solid rgba(255,255,255,.9)",
        "background": "rgba(255,255,255,.6)",
        "display": "grid",
        "placeItems": "center",
        "color": "#3c4858",
        "cursor": "pointer"
      }
    }, React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M15 6l-6 6 6 6"
    }))), React.createElement("div", {
      style: {
        "fontSize": "16px",
        "fontWeight": "800"
      }
    }, "New request")), v.reqSent ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "border": "1px solid rgba(43,182,115,.35)",
        "borderRadius": "18px",
        "padding": "26px 18px",
        "background": "rgba(255,255,255,.75)",
        "textAlign": "center",
        "display": "flex",
        "flexDirection": "column",
        "alignItems": "center",
        "gap": "10px",
        "boxShadow": "0 12px 32px rgba(31,59,90,.1)"
      }
    }, React.createElement("span", {
      style: {
        "display": "grid",
        "placeItems": "center",
        "width": "56px",
        "height": "56px",
        "borderRadius": "50%",
        "background": "rgba(43,182,115,.15)",
        "color": "#1d8f57"
      }
    }, React.createElement("svg", {
      width: "28",
      height: "28",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.4",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M20 6L9 17l-5-5"
    }))), React.createElement("div", {
      style: {
        "fontSize": "16px",
        "fontWeight": "800"
      }
    }, "Request sent"), React.createElement("div", {
      style: {
        "fontSize": "12.5px",
        "color": "#6c7a8c"
      }
    }, "Your nurse in-charge will review it. You'll get a notification once decided."), React.createElement("button", {
      onClick: v.goRequests,
      style: {
        "marginTop": "6px",
        "border": "0",
        "borderRadius": "11px",
        "padding": "11px 18px",
        "background": "linear-gradient(140deg,#0aa0d4,#0072a3)",
        "color": "#fff",
        "fontSize": "13px",
        "fontWeight": "700",
        "cursor": "pointer"
      }
    }, "View my requests"))) : null, v.reqNotSent ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "inline-flex",
        "background": "rgba(255,255,255,.55)",
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "11px",
        "padding": "3px",
        "gap": "3px"
      }
    }, (Array.isArray(v.reqTypeOpts) ? v.reqTypeOpts : []).map((t, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: t?.go,
      style: S(t?.style)
    }, ix(t?.label))))), React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.92)",
        "borderRadius": "18px",
        "padding": "16px",
        "background": "rgba(255,255,255,.72)",
        "boxShadow": "0 12px 32px rgba(31,59,90,.1)",
        "display": "flex",
        "flexDirection": "column",
        "gap": "12px"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "5px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, ix(v.reqDateLabel)), React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "8px",
        "border": "1px solid rgba(125,145,180,.35)",
        "borderRadius": "11px",
        "padding": "11px 13px",
        "background": "rgba(255,255,255,.85)"
      }
    }, React.createElement("svg", {
      width: "16",
      height: "16",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "#6c7a8c",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z"
    })), React.createElement("span", {
      style: {
        "fontSize": "14px",
        "fontWeight": "600"
      }
    }, ix(v.selDateLabel)), React.createElement("span", {
      style: {
        "marginLeft": "auto",
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "12px",
        "fontWeight": "700",
        "color": "#0072a3"
      }
    }, ix(v.selCode)))), v.reqIsSwap ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "5px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Swap with"), React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "5px"
      }
    }, (Array.isArray(v.swapCandidates) ? v.swapCandidates : []).map((c, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: c?.go,
      style: S(c?.style)
    }, React.createElement("span", {
      style: {
        "display": "grid",
        "placeItems": "center",
        "width": "30px",
        "height": "30px",
        "borderRadius": "9px",
        "color": "#fff",
        "fontSize": "10.5px",
        "fontWeight": "700",
        "background": "linear-gradient(135deg,#3ab5a7,#0090ca)"
      }
    }, ix(c?.ini)), React.createElement("span", {
      style: {
        "flex": "1",
        "textAlign": "left",
        "fontSize": "13px",
        "fontWeight": "600"
      }
    }, ix(c?.name)), React.createElement("span", {
      style: {
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "12px",
        "fontWeight": "700",
        "color": "#6c7a8c"
      }
    }, ix(c?.code)))))))) : null, v.reqIsLeave ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "5px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Leave type"), React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "6px",
        "flexWrap": "wrap"
      }
    }, (Array.isArray(v.leaveTypes) ? v.leaveTypes : []).map((l, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: l?.go,
      style: S(l?.style)
    }, ix(l?.label))))))) : null, React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "5px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Reason"), React.createElement("textarea", {
      value: vx(v.reqReason),
      onChange: v.setReqReason,
      rows: "3",
      placeholder: "Brief reason for the in-charge",
      style: {
        "border": "1px solid rgba(125,145,180,.35)",
        "borderRadius": "11px",
        "padding": "11px 13px",
        "fontSize": "13.5px",
        "background": "rgba(255,255,255,.85)",
        "outline": "none",
        "resize": "none"
      }
    }))), React.createElement("button", {
      onClick: v.submitRequest,
      style: {
        "border": "0",
        "borderRadius": "13px",
        "padding": "14px",
        "background": "linear-gradient(140deg,#0aa0d4,#0072a3)",
        "color": "#fff",
        "fontSize": "14.5px",
        "fontWeight": "700",
        "cursor": "pointer",
        "boxShadow": "0 10px 24px rgba(0,144,202,.32)"
      }
    }, "Send request")) : null)) : null;
  }
  function Screen_sChats(v) {
    return v.sChats ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "flex": "1",
        "minHeight": "0",
        "overflow": "auto",
        "padding": "14px 16px 20px",
        "display": "flex",
        "flexDirection": "column",
        "gap": "12px",
        "animation": "pop .3s ease backwards"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px"
      }
    }, React.createElement("button", {
      onClick: v.openDrawer,
      style: {
        "width": "38px",
        "height": "38px",
        "borderRadius": "11px",
        "border": "1px solid rgba(255,255,255,.9)",
        "background": "rgba(255,255,255,.6)",
        "display": "grid",
        "placeItems": "center",
        "color": "#3c4858",
        "cursor": "pointer",
        "flexShrink": "0"
      }
    }, React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round"
    }, React.createElement("path", {
      d: "M4 7h16M4 12h16M4 17h10"
    }))), React.createElement("div", {
      style: {
        "flex": "1"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "19px",
        "fontWeight": "800",
        "letterSpacing": "-.3px"
      }
    }, "Chat"), React.createElement("div", {
      style: {
        "fontSize": "12px",
        "color": "#6c7a8c"
      }
    }, ix(v.chatUnreadTotal), " unread · ", ix(v.onlineCount), " online")), React.createElement("button", {
      onClick: v.goStaff,
      title: "Staff directory",
      style: {
        "width": "38px",
        "height": "38px",
        "borderRadius": "11px",
        "border": "1px solid rgba(255,255,255,.9)",
        "background": "rgba(255,255,255,.6)",
        "display": "grid",
        "placeItems": "center",
        "color": "#3c4858",
        "cursor": "pointer"
      }
    }, React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 3a4 4 0 110 8 4 4 0 010-8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"
    }))), React.createElement("button", {
      onClick: v.openNewGroup,
      style: {
        "display": "inline-flex",
        "alignItems": "center",
        "gap": "6px",
        "border": "0",
        "borderRadius": "11px",
        "padding": "10px 12px",
        "background": "linear-gradient(140deg,#0aa0d4,#0072a3)",
        "color": "#fff",
        "fontSize": "12.5px",
        "fontWeight": "700",
        "cursor": "pointer",
        "boxShadow": "0 8px 20px rgba(0,144,202,.3)"
      }
    }, React.createElement("svg", {
      width: "14",
      height: "14",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.4",
      strokeLinecap: "round"
    }, React.createElement("path", {
      d: "M12 5v14M5 12h14"
    })), "New")), React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "9px",
        "border": "1px solid rgba(255,255,255,.95)",
        "borderRadius": "13px",
        "padding": "10px 13px",
        "background": "rgba(255,255,255,.8)",
        "flexShrink": "0"
      }
    }, React.createElement("svg", {
      width: "16",
      height: "16",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "#6c7a8c",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("circle", {
      cx: "11",
      cy: "11",
      r: "7"
    }), React.createElement("path", {
      d: "M21 21l-4.3-4.3"
    })), React.createElement("input", {
      value: vx(v.chatSearch),
      onChange: v.setChatSearch,
      placeholder: "Search people, rooms, messages",
      style: {
        "flex": "1",
        "border": "0",
        "background": "transparent",
        "fontSize": "13.5px",
        "outline": "none",
        "minWidth": "0"
      }
    })), React.createElement("div", {
      style: {
        "display": "inline-flex",
        "background": "rgba(255,255,255,.55)",
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "11px",
        "padding": "3px",
        "gap": "3px",
        "flexShrink": "0"
      }
    }, (Array.isArray(v.chatTabs) ? v.chatTabs : []).map((t, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: t?.go,
      style: S(t?.style)
    }, ix(t?.label), t?.badge ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: {
        "marginLeft": "6px",
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "10px",
        "fontWeight": "700",
        "padding": "1px 6px",
        "borderRadius": "8px",
        "color": "#fff",
        "background": "#d23a52"
      }
    }, ix(t?.badge))) : null)))), v.chatIsDept ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "6px",
        "overflowX": "auto",
        "paddingBottom": "2px",
        "scrollbarWidth": "none",
        "flexShrink": "0"
      }
    }, (Array.isArray(v.deptChips) ? v.deptChips : []).map((d, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: d?.go,
      style: S(d?.style)
    }, ix(d?.label)))))) : null, v.chatIsHosp ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px",
        "borderRadius": "14px",
        "padding": "11px 13px",
        "background": "linear-gradient(140deg,rgba(13,42,74,.95),rgba(10,95,135,.9))",
        "color": "#fff"
      }
    }, React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      style: {
        "flexShrink": "0"
      }
    }, React.createElement("path", {
      d: "M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4M9 10h.01M15 10h.01M9 14h.01M15 14h.01"
    })), React.createElement("span", {
      style: {
        "fontSize": "12.5px",
        "lineHeight": "1.4"
      }
    }, "Hospital-wide rooms reach every department. Keep patient identifiers out of these rooms."))) : null, React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "8px"
      }
    }, (Array.isArray(v.chatList) ? v.chatList : []).map((c, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: c?.go,
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "12px",
        "textAlign": "left",
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "15px",
        "padding": "11px 13px",
        "background": "rgba(255,255,255,.66)",
        "cursor": "pointer",
        "color": "#16202e"
      },
      className: "dcp0"
    }, React.createElement("span", {
      style: {
        "position": "relative",
        "flexShrink": "0"
      }
    }, React.createElement("span", {
      style: S(c?.avStyle)
    }, ix(c?.av)), c?.online ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: {
        "position": "absolute",
        "right": "-2px",
        "bottom": "-2px",
        "width": "11px",
        "height": "11px",
        "borderRadius": "50%",
        "background": "#2bb673",
        "border": "2px solid #fff"
      }
    })) : null), React.createElement("span", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("span", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "6px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "13.5px",
        "fontWeight": "700",
        "whiteSpace": "nowrap",
        "overflow": "hidden",
        "textOverflow": "ellipsis"
      }
    }, ix(c?.name)), c?.members ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: {
        "fontSize": "10.5px",
        "color": "#7d8ea8",
        "fontFamily": "'IBM Plex Mono',monospace",
        "flexShrink": "0"
      }
    }, ix(c?.members))) : null, c?.muted ? React.createElement(React.Fragment, null, React.createElement("svg", {
      width: "12",
      height: "12",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "#9aa6b4",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      style: {
        "flexShrink": "0"
      }
    }, React.createElement("path", {
      d: "M13.7 21a2 2 0 01-3.4 0M18.6 13A17.9 17.9 0 0118 8M6.3 6.3A6 6 0 006 8c0 7-3 9-3 9h14M18 8a6 6 0 00-9.3-5M1 1l22 22"
    }))) : null, c?.urgent ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: {
        "fontSize": "8.5px",
        "fontWeight": "800",
        "letterSpacing": ".5px",
        "padding": "2px 5px",
        "borderRadius": "5px",
        "color": "#fff",
        "background": "#d23a52",
        "flexShrink": "0"
      }
    }, "URGENT")) : null), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "12px",
        "color": "#6c7a8c",
        "whiteSpace": "nowrap",
        "overflow": "hidden",
        "textOverflow": "ellipsis",
        "marginTop": "1px"
      }
    }, ix(c?.last))), React.createElement("span", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "alignItems": "flex-end",
        "gap": "4px",
        "flexShrink": "0"
      }
    }, React.createElement("span", {
      style: {
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "10.5px",
        "color": "#9aa6b4"
      }
    }, ix(c?.when)), c?.unread ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: {
        "minWidth": "18px",
        "height": "18px",
        "padding": "0 5px",
        "borderRadius": "9px",
        "background": "#0090ca",
        "color": "#fff",
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "10px",
        "fontWeight": "700",
        "display": "grid",
        "placeItems": "center",
        "boxSizing": "border-box"
      }
    }, ix(c?.unread))) : null)))))), v.newGroupOpen ? React.createElement(React.Fragment, null, React.createElement("div", {
      onClick: v.closeNewGroup,
      style: {
        "position": "absolute",
        "inset": "0",
        "zIndex": "20",
        "background": "rgba(13,28,50,.45)",
        "animation": "fadeIn .2s ease"
      }
    }), React.createElement("div", {
      style: {
        "position": "absolute",
        "left": "0",
        "right": "0",
        "bottom": "0",
        "zIndex": "21",
        "background": "rgba(255,255,255,.96)",
        "borderRadius": "22px 22px 0 0",
        "padding": "14px 18px 22px",
        "boxShadow": "0 -18px 50px rgba(31,59,90,.25)",
        "display": "flex",
        "flexDirection": "column",
        "gap": "12px",
        "animation": "pop .28s cubic-bezier(.2,.7,.3,1)"
      }
    }, React.createElement("div", {
      style: {
        "width": "40px",
        "height": "4px",
        "borderRadius": "2px",
        "background": "rgba(125,145,180,.4)",
        "alignSelf": "center"
      }
    }), React.createElement("div", {
      style: {
        "fontSize": "16px",
        "fontWeight": "800"
      }
    }, "New room"), React.createElement("input", {
      value: vx(v.ngName),
      onChange: v.setNgName,
      placeholder: "Room name, e.g. LDR Night team",
      style: {
        "border": "1px solid rgba(125,145,180,.35)",
        "borderRadius": "11px",
        "padding": "11px 13px",
        "fontSize": "14px",
        "background": "#fff",
        "outline": "none"
      }
    }), React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "6px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Scope"), React.createElement("div", {
      style: {
        "display": "inline-flex",
        "background": "rgba(125,145,180,.12)",
        "borderRadius": "11px",
        "padding": "3px",
        "gap": "3px",
        "alignSelf": "flex-start"
      }
    }, (Array.isArray(v.ngScopeOpts) ? v.ngScopeOpts : []).map((o, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: o?.go,
      style: S(o?.style)
    }, ix(o?.label)))))), React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "6px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Add members"), React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "4px"
      }
    }, (Array.isArray(v.ngMembers) ? v.ngMembers : []).map((m, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: m?.go,
      style: S(m?.style)
    }, React.createElement("span", {
      style: {
        "display": "grid",
        "placeItems": "center",
        "width": "30px",
        "height": "30px",
        "borderRadius": "9px",
        "color": "#fff",
        "fontSize": "10.5px",
        "fontWeight": "700",
        "background": "linear-gradient(135deg,#3ab5a7,#0090ca)"
      }
    }, ix(m?.ini)), React.createElement("span", {
      style: {
        "flex": "1",
        "textAlign": "left"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "13px",
        "fontWeight": "600"
      }
    }, ix(m?.name)), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "11px",
        "color": "#6c7a8c"
      }
    }, ix(m?.role))), React.createElement("span", {
      style: S(m?.box)
    }, m?.on ? React.createElement(React.Fragment, null, React.createElement("svg", {
      width: "12",
      height: "12",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "#fff",
      strokeWidth: "3",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M20 6L9 17l-5-5"
    }))) : null)))))), React.createElement("button", {
      onClick: v.createGroup,
      style: {
        "border": "0",
        "borderRadius": "13px",
        "padding": "13px",
        "background": "linear-gradient(140deg,#0aa0d4,#0072a3)",
        "color": "#fff",
        "fontSize": "14px",
        "fontWeight": "700",
        "cursor": "pointer",
        "boxShadow": "0 10px 24px rgba(0,144,202,.32)"
      }
    }, "Create room · ", ix(v.ngCount), " members"))) : null) : null;
  }
  function Screen_sThread(v) {
    return v.sThread ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "flex": "1",
        "minHeight": "0",
        "display": "flex",
        "flexDirection": "column",
        "animation": "pop .3s ease backwards"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px",
        "padding": "10px 12px",
        "background": "rgba(255,255,255,.7)",
        "backdropFilter": "blur(16px)",
        "WebkitBackdropFilter": "blur(16px)",
        "borderBottom": "1px solid rgba(255,255,255,.95)",
        "flexShrink": "0"
      }
    }, React.createElement("button", {
      onClick: v.goChats,
      style: {
        "width": "36px",
        "height": "36px",
        "borderRadius": "10px",
        "border": "0",
        "background": "transparent",
        "display": "grid",
        "placeItems": "center",
        "color": "#3c4858",
        "cursor": "pointer"
      }
    }, React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M15 6l-6 6 6 6"
    }))), React.createElement("span", {
      style: S(v.thread?.avStyle)
    }, ix(v.thread?.av)), React.createElement("div", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "14px",
        "fontWeight": "800",
        "whiteSpace": "nowrap",
        "overflow": "hidden",
        "textOverflow": "ellipsis"
      }
    }, ix(v.thread?.name)), React.createElement("div", {
      style: {
        "fontSize": "11px",
        "color": "#6c7a8c"
      }
    }, ix(v.thread?.sub))), v.thread?.tel ? React.createElement(React.Fragment, null, React.createElement("a", {
      href: v.thread?.tel,
      title: "Call",
      style: {
        "width": "36px",
        "height": "36px",
        "borderRadius": "10px",
        "border": "0",
        "background": "transparent",
        "display": "grid",
        "placeItems": "center",
        "color": "#1d8f57",
        "cursor": "pointer",
        "textDecoration": "none"
      }
    }, React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1.9.4 1.8.7 2.6a2 2 0 01-.5 2.1L8 9.7a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.4c.8.3 1.7.5 2.6.7a2 2 0 011.7 2z"
    })))) : null, React.createElement("button", {
      onClick: v.openRoomInfo,
      style: {
        "width": "36px",
        "height": "36px",
        "borderRadius": "10px",
        "border": "0",
        "background": "transparent",
        "display": "grid",
        "placeItems": "center",
        "color": "#3c4858",
        "cursor": "pointer"
      }
    }, React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.4",
      strokeLinecap: "round"
    }, React.createElement("path", {
      d: "M12 5.5v.01M12 12v.01M12 18.5v.01"
    })))), v.thread?.pinnedText ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "9px",
        "padding": "8px 14px",
        "background": "rgba(224,138,30,.1)",
        "borderBottom": "1px solid rgba(224,138,30,.25)",
        "flexShrink": "0"
      }
    }, React.createElement("svg", {
      width: "13",
      height: "13",
      viewBox: "0 0 24 24",
      fill: "#e08a1e",
      stroke: "#e08a1e",
      strokeWidth: "1.5",
      strokeLinejoin: "round",
      style: {
        "flexShrink": "0"
      }
    }, React.createElement("path", {
      d: "M16 3l5 5-4 1-4 4 1 5-3 1-4-4-5 5 5-5-4-4 1-3 5 1 4-4z"
    })), React.createElement("span", {
      style: {
        "flex": "1",
        "minWidth": "0",
        "fontSize": "12px",
        "color": "#16202e",
        "whiteSpace": "nowrap",
        "overflow": "hidden",
        "textOverflow": "ellipsis"
      }
    }, React.createElement("b", {
      style: {
        "color": "#b8650a"
      }
    }, "Pinned"), " · ", ix(v.thread?.pinnedText)), React.createElement("button", {
      onClick: v.unpin,
      style: {
        "border": "0",
        "background": "none",
        "color": "#b8650a",
        "fontSize": "11px",
        "fontWeight": "700",
        "cursor": "pointer",
        "padding": "0"
      }
    }, "Unpin"))) : null, React.createElement("div", {
      style: {
        "flex": "1",
        "minHeight": "0",
        "overflow": "auto",
        "padding": "14px 14px 8px",
        "display": "flex",
        "flexDirection": "column",
        "gap": "8px"
      }
    }, React.createElement("div", {
      style: {
        "alignSelf": "center",
        "fontSize": "10.5px",
        "fontWeight": "700",
        "color": "#7d8ea8",
        "padding": "3px 10px",
        "borderRadius": "999px",
        "background": "rgba(255,255,255,.6)"
      }
    }, "Today"), (Array.isArray(v.messages) ? v.messages : []).map((m, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: S(m?.rowStyle)
    }, m?.showSender ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: {
        "display": "grid",
        "placeItems": "center",
        "width": "28px",
        "height": "28px",
        "borderRadius": "9px",
        "color": "#fff",
        "fontSize": "10px",
        "fontWeight": "700",
        "background": "linear-gradient(135deg,#3ab5a7,#0090ca)",
        "flexShrink": "0",
        "alignSelf": "flex-end"
      }
    }, ix(m?.ini))) : null, React.createElement("div", {
      style: S(m?.colStyle)
    }, React.createElement("button", {
      onClick: m?.select,
      style: S(m?.bubbleStyle)
    }, m?.urgent ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "inline-flex",
        "alignItems": "center",
        "gap": "5px",
        "fontSize": "9.5px",
        "fontWeight": "800",
        "letterSpacing": ".6px",
        "color": "#fff",
        "background": "#d23a52",
        "padding": "2px 7px",
        "borderRadius": "5px",
        "marginBottom": "5px"
      }
    }, React.createElement("svg", {
      width: "10",
      height: "10",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "3",
      strokeLinecap: "round"
    }, React.createElement("path", {
      d: "M12 5v9M12 18.5v.01"
    })), "URGENT")) : null, m?.showSender ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "fontSize": "11px",
        "fontWeight": "700",
        "color": "#0072a3",
        "marginBottom": "2px"
      }
    }, ix(m?.sender), " ", React.createElement("span", {
      style: {
        "fontWeight": "500",
        "color": "#7d8ea8"
      }
    }, "· ", ix(m?.role)))) : null, m?.replyTo ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: S(m?.replyStyle)
    }, ix(m?.replyTo))) : null, m?.attach ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: S(m?.attachStyle)
    }, React.createElement("svg", {
      width: "15",
      height: "15",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      style: {
        "flexShrink": "0"
      }
    }, React.createElement("path", {
      d: m?.attachIcon
    })), React.createElement("span", {
      style: {
        "flex": "1",
        "minWidth": "0",
        "whiteSpace": "nowrap",
        "overflow": "hidden",
        "textOverflow": "ellipsis"
      }
    }, ix(m?.attach)))) : null, React.createElement("div", {
      style: {
        "fontSize": "13.5px",
        "lineHeight": "1.45",
        "textWrap": "pretty",
        "textAlign": "left"
      }
    }, ix(m?.text)), React.createElement("div", {
      style: S(m?.timeStyle)
    }, ix(m?.time), m?.seen ? React.createElement(React.Fragment, null, " · ", ix(m?.seen)) : null)), m?.hasReactions ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: S(m?.reactRow)
    }, (Array.isArray(m?.reactions) ? m?.reactions : []).map((r, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("span", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "padding": "2px 7px",
        "borderRadius": "999px",
        "background": "rgba(255,255,255,.9)",
        "border": "1px solid rgba(0,144,202,.3)",
        "color": "#0072a3"
      }
    }, ix(r)))))) : null, m?.selected ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: S(m?.actionRow)
    }, (Array.isArray(m?.actions) ? m?.actions : []).map((a, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: a?.go,
      style: {
        "border": "1px solid rgba(125,145,180,.3)",
        "borderRadius": "999px",
        "padding": "5px 10px",
        "fontSize": "11px",
        "fontWeight": "700",
        "background": "rgba(255,255,255,.95)",
        "color": "#16202e",
        "cursor": "pointer",
        "whiteSpace": "nowrap"
      }
    }, ix(a?.label)))))) : null)))), v.typing ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "7px",
        "fontSize": "11.5px",
        "color": "#7d8ea8",
        "padding": "2px 4px"
      }
    }, React.createElement("span", {
      style: {
        "display": "inline-flex",
        "gap": "3px"
      }
    }, React.createElement("span", {
      style: {
        "width": "5px",
        "height": "5px",
        "borderRadius": "50%",
        "background": "#7d8ea8",
        "animation": "blink 1.2s infinite"
      }
    }), React.createElement("span", {
      style: {
        "width": "5px",
        "height": "5px",
        "borderRadius": "50%",
        "background": "#7d8ea8",
        "animation": "blink 1.2s .2s infinite"
      }
    }), React.createElement("span", {
      style: {
        "width": "5px",
        "height": "5px",
        "borderRadius": "50%",
        "background": "#7d8ea8",
        "animation": "blink 1.2s .4s infinite"
      }
    })), ix(v.typing))) : null), React.createElement("div", {
      style: {
        "flexShrink": "0",
        "background": "rgba(255,255,255,.75)",
        "backdropFilter": "blur(16px)",
        "WebkitBackdropFilter": "blur(16px)",
        "borderTop": "1px solid rgba(255,255,255,.95)"
      }
    }, v.replyingTo ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "8px",
        "padding": "8px 14px 0"
      }
    }, React.createElement("span", {
      style: {
        "width": "3px",
        "height": "28px",
        "borderRadius": "2px",
        "background": "#0090ca"
      }
    }), React.createElement("span", {
      style: {
        "flex": "1",
        "minWidth": "0",
        "fontSize": "12px",
        "color": "#3c4858",
        "whiteSpace": "nowrap",
        "overflow": "hidden",
        "textOverflow": "ellipsis"
      }
    }, React.createElement("b", {
      style: {
        "color": "#0072a3"
      }
    }, "Replying to"), " · ", ix(v.replyingTo)), React.createElement("button", {
      onClick: v.cancelReply,
      style: {
        "border": "0",
        "background": "none",
        "color": "#7d8ea8",
        "cursor": "pointer",
        "padding": "2px",
        "display": "grid",
        "placeItems": "center"
      }
    }, React.createElement("svg", {
      width: "14",
      height: "14",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.4",
      strokeLinecap: "round"
    }, React.createElement("path", {
      d: "M6 6l12 12M18 6L6 18"
    }))))) : null, React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "6px",
        "overflowX": "auto",
        "padding": "8px 12px 0",
        "scrollbarWidth": "none",
        "flexShrink": "0"
      }
    }, (Array.isArray(v.quickReplies) ? v.quickReplies : []).map((q, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: q?.go,
      style: {
        "border": "1px solid rgba(0,144,202,.3)",
        "borderRadius": "999px",
        "padding": "6px 11px",
        "fontSize": "11.5px",
        "fontWeight": "700",
        "background": "rgba(0,144,202,.07)",
        "color": "#0072a3",
        "cursor": "pointer",
        "whiteSpace": "nowrap",
        "flexShrink": "0"
      }
    }, ix(q?.label))))), React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "8px",
        "padding": "8px 12px 12px"
      }
    }, React.createElement("button", {
      onClick: v.toggleAttach,
      style: S(v.attachBtnStyle)
    }, React.createElement("svg", {
      width: "17",
      height: "17",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round"
    }, React.createElement("path", {
      d: "M12 5v14M5 12h14"
    }))), React.createElement("button", {
      onClick: v.toggleUrgent,
      title: "Mark urgent",
      style: S(v.urgentBtnStyle)
    }, React.createElement("svg", {
      width: "16",
      height: "16",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.6",
      strokeLinecap: "round"
    }, React.createElement("path", {
      d: "M12 4v10M12 19v.01"
    }))), React.createElement("input", {
      value: vx(v.draft),
      onChange: v.setDraft,
      onKeyDown: v.draftKey,
      placeholder: v.draftPlaceholder,
      style: {
        "flex": "1",
        "minWidth": "0",
        "border": "1px solid rgba(125,145,180,.3)",
        "borderRadius": "12px",
        "padding": "11px 13px",
        "fontSize": "14px",
        "background": "rgba(255,255,255,.85)",
        "outline": "none"
      }
    }), React.createElement("button", {
      onClick: v.sendMsg,
      style: S(v.sendBtnStyle)
    }, React.createElement("svg", {
      width: "17",
      height: "17",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"
    })))))), v.attachOpen ? React.createElement(React.Fragment, null, React.createElement("div", {
      onClick: v.toggleAttach,
      style: {
        "position": "absolute",
        "inset": "0",
        "zIndex": "20",
        "background": "rgba(13,28,50,.3)",
        "animation": "fadeIn .2s ease"
      }
    }), React.createElement("div", {
      style: {
        "position": "absolute",
        "left": "0",
        "right": "0",
        "bottom": "0",
        "zIndex": "21",
        "background": "rgba(255,255,255,.96)",
        "borderRadius": "22px 22px 0 0",
        "padding": "14px 18px 22px",
        "boxShadow": "0 -18px 50px rgba(31,59,90,.25)",
        "display": "flex",
        "flexDirection": "column",
        "gap": "12px",
        "animation": "pop .28s cubic-bezier(.2,.7,.3,1)"
      }
    }, React.createElement("div", {
      style: {
        "width": "40px",
        "height": "4px",
        "borderRadius": "2px",
        "background": "rgba(125,145,180,.4)",
        "alignSelf": "center"
      }
    }), React.createElement("div", {
      style: {
        "fontSize": "14px",
        "fontWeight": "800"
      }
    }, "Attach"), React.createElement("div", {
      style: {
        "display": "grid",
        "gridTemplateColumns": "repeat(3,1fr)",
        "gap": "8px"
      }
    }, (Array.isArray(v.attachOpts) ? v.attachOpts : []).map((a, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: a?.go,
      style: {
        "display": "flex",
        "flexDirection": "column",
        "alignItems": "center",
        "gap": "7px",
        "border": "1px solid rgba(125,145,180,.2)",
        "borderRadius": "14px",
        "padding": "12px 4px 10px",
        "background": "rgba(255,255,255,.9)",
        "cursor": "pointer",
        "color": "#16202e"
      }
    }, React.createElement("span", {
      style: S(`display:grid;place-items:center;width:40px;height:40px;border-radius:12px;color:${a?.color ?? ""};background:${a?.bg ?? ""}`)
    }, React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: a?.d
    }))), React.createElement("span", {
      style: {
        "fontSize": "11px",
        "fontWeight": "700"
      }
    }, ix(a?.label)))))))) : null, v.roomInfoOpen ? React.createElement(React.Fragment, null, React.createElement("div", {
      onClick: v.closeRoomInfo,
      style: {
        "position": "absolute",
        "inset": "0",
        "zIndex": "20",
        "background": "rgba(13,28,50,.45)",
        "animation": "fadeIn .2s ease"
      }
    }), React.createElement("div", {
      style: {
        "position": "absolute",
        "left": "0",
        "right": "0",
        "bottom": "0",
        "zIndex": "21",
        "maxHeight": "78%",
        "display": "flex",
        "flexDirection": "column",
        "background": "rgba(255,255,255,.97)",
        "borderRadius": "22px 22px 0 0",
        "padding": "14px 18px 22px",
        "boxShadow": "0 -18px 50px rgba(31,59,90,.25)",
        "gap": "12px",
        "animation": "pop .28s cubic-bezier(.2,.7,.3,1)"
      }
    }, React.createElement("div", {
      style: {
        "width": "40px",
        "height": "4px",
        "borderRadius": "2px",
        "background": "rgba(125,145,180,.4)",
        "alignSelf": "center",
        "flexShrink": "0"
      }
    }), React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "12px",
        "flexShrink": "0"
      }
    }, React.createElement("span", {
      style: S(v.thread?.avStyle)
    }, ix(v.thread?.av)), React.createElement("div", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "16px",
        "fontWeight": "800"
      }
    }, ix(v.thread?.name)), React.createElement("div", {
      style: {
        "fontSize": "12px",
        "color": "#6c7a8c"
      }
    }, ix(v.thread?.sub)))), React.createElement("div", {
      style: {
        "display": "grid",
        "gridTemplateColumns": "repeat(3,1fr)",
        "gap": "8px",
        "flexShrink": "0"
      }
    }, (Array.isArray(v.roomActions) ? v.roomActions : []).map((a, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: a?.go,
      style: S(a?.style)
    }, React.createElement("svg", {
      width: "17",
      height: "17",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: a?.d
    })), React.createElement("span", {
      style: {
        "fontSize": "11px",
        "fontWeight": "700"
      }
    }, ix(a?.label)))))), v.thread?.group ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#7d8ea8",
        "flexShrink": "0"
      }
    }, "Members · ", ix(v.thread?.memberCount)), React.createElement("div", {
      style: {
        "flex": "1",
        "minHeight": "0",
        "overflow": "auto",
        "display": "flex",
        "flexDirection": "column",
        "gap": "4px"
      }
    }, (Array.isArray(v.roomMembers) ? v.roomMembers : []).map((m, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px",
        "padding": "7px 4px"
      }
    }, React.createElement("span", {
      style: {
        "position": "relative"
      }
    }, React.createElement("span", {
      style: {
        "display": "grid",
        "placeItems": "center",
        "width": "32px",
        "height": "32px",
        "borderRadius": "10px",
        "color": "#fff",
        "fontSize": "11px",
        "fontWeight": "700",
        "background": "linear-gradient(135deg,#3ab5a7,#0090ca)"
      }
    }, ix(m?.ini)), m?.online ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: {
        "position": "absolute",
        "right": "-2px",
        "bottom": "-2px",
        "width": "9px",
        "height": "9px",
        "borderRadius": "50%",
        "background": "#2bb673",
        "border": "2px solid #fff"
      }
    })) : null), React.createElement("span", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "13px",
        "fontWeight": "600"
      }
    }, ix(m?.name)), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "11px",
        "color": "#6c7a8c"
      }
    }, ix(m?.role))), m?.admin ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: {
        "fontSize": "9.5px",
        "fontWeight": "800",
        "letterSpacing": ".5px",
        "padding": "2px 7px",
        "borderRadius": "5px",
        "color": "#0072a3",
        "background": "rgba(0,144,202,.12)"
      }
    }, "ADMIN")) : null))))) : null)) : null) : null;
  }
  function Screen_sMeds(v) {
    return v.sMeds ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "flex": "1",
        "minHeight": "0",
        "overflow": "auto",
        "padding": "14px 16px 20px",
        "display": "flex",
        "flexDirection": "column",
        "gap": "12px",
        "animation": "pop .3s ease backwards"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px"
      }
    }, React.createElement("button", {
      onClick: v.openDrawer,
      style: {
        "width": "38px",
        "height": "38px",
        "borderRadius": "11px",
        "border": "1px solid rgba(255,255,255,.9)",
        "background": "rgba(255,255,255,.6)",
        "display": "grid",
        "placeItems": "center",
        "color": "#3c4858",
        "cursor": "pointer",
        "flexShrink": "0"
      }
    }, React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round"
    }, React.createElement("path", {
      d: "M4 7h16M4 12h16M4 17h10"
    }))), React.createElement("div", {
      style: {
        "flex": "1"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "19px",
        "fontWeight": "800",
        "letterSpacing": "-.3px"
      }
    }, "Medicine info"), React.createElement("div", {
      style: {
        "fontSize": "12px",
        "color": "#6c7a8c"
      }
    }, "Hospital formulary · ", ix(v.medCount), " of ", ix(v.medTotal))), React.createElement("button", {
      onClick: v.toggleAlertOnly,
      style: S(v.alertChipStyle)
    }, "High-alert")), React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "9px",
        "border": "1px solid rgba(255,255,255,.95)",
        "borderRadius": "13px",
        "padding": "11px 13px",
        "background": "rgba(255,255,255,.8)",
        "boxShadow": "0 8px 22px rgba(31,59,90,.08)"
      }
    }, React.createElement("svg", {
      width: "17",
      height: "17",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "#6c7a8c",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("circle", {
      cx: "11",
      cy: "11",
      r: "7"
    }), React.createElement("path", {
      d: "M21 21l-4.3-4.3"
    })), React.createElement("input", {
      value: vx(v.medQuery),
      onChange: v.setMedQuery,
      placeholder: "Brand, generic, class or manufacturer",
      style: {
        "flex": "1",
        "border": "0",
        "background": "transparent",
        "fontSize": "14px",
        "outline": "none",
        "minWidth": "0"
      }
    })), React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "6px",
        "overflowX": "auto",
        "paddingBottom": "2px",
        "scrollbarWidth": "none",
        "flexShrink": "0"
      }
    }, (Array.isArray(v.medClasses) ? v.medClasses : []).map((c, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: c?.go,
      style: S(c?.style)
    }, ix(c?.label))))), v.medsLoading ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "textAlign": "center",
        "padding": "30px",
        "color": "#7d8ea8",
        "fontSize": "12.5px"
      }
    }, "Loading formulary…")) : null, React.createElement("button", {
      onClick: v.goMedRequest,
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "11px",
        "textAlign": "left",
        "border": "1px dashed rgba(0,144,202,.5)",
        "borderRadius": "14px",
        "padding": "11px 13px",
        "background": "rgba(0,144,202,.06)",
        "cursor": "pointer",
        "color": "#16202e"
      }
    }, React.createElement("span", {
      style: {
        "display": "grid",
        "placeItems": "center",
        "width": "36px",
        "height": "36px",
        "borderRadius": "11px",
        "background": "rgba(0,144,202,.13)",
        "color": "#0072a3",
        "flexShrink": "0"
      }
    }, React.createElement("svg", {
      width: "17",
      height: "17",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round"
    }, React.createElement("path", {
      d: "M12 5v14M5 12h14"
    }))), React.createElement("span", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "13px",
        "fontWeight": "700",
        "color": "#0072a3"
      }
    }, ix(v.medReqCta)), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "11.5px",
        "color": "#6c7a8c"
      }
    }, ix(v.medReqSub))), v.medReqBadge ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: {
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "10.5px",
        "fontWeight": "700",
        "padding": "3px 8px",
        "borderRadius": "999px",
        "color": "#b8650a",
        "background": "rgba(224,138,30,.15)"
      }
    }, ix(v.medReqBadge))) : null), React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "8px"
      }
    }, (Array.isArray(v.medList) ? v.medList : []).map((m, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: m?.go,
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "12px",
        "textAlign": "left",
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "14px",
        "padding": "10px 12px",
        "background": "rgba(255,255,255,.65)",
        "cursor": "pointer",
        "color": "#16202e"
      },
      className: "dcp0"
    }, React.createElement("span", {
      style: S(m?.imgStyle)
    }), React.createElement("span", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("span", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "6px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "14px",
        "fontWeight": "700"
      }
    }, ix(m?.brand)), React.createElement("span", {
      style: {
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "11px",
        "color": "#0072a3",
        "fontWeight": "700"
      }
    }, ix(m?.strength))), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "11.5px",
        "color": "#6c7a8c",
        "whiteSpace": "nowrap",
        "overflow": "hidden",
        "textOverflow": "ellipsis"
      }
    }, ix(m?.generic), " · ", ix(m?.route)), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "10.5px",
        "color": "#9aa6b4",
        "marginTop": "1px",
        "whiteSpace": "nowrap",
        "overflow": "hidden",
        "textOverflow": "ellipsis"
      }
    }, ix(m?.mfr))), m?.alert ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: {
        "fontSize": "9px",
        "fontWeight": "800",
        "letterSpacing": ".5px",
        "padding": "3px 6px",
        "borderRadius": "6px",
        "color": "#b32e2e",
        "background": "rgba(214,69,69,.12)",
        "flexShrink": "0"
      }
    }, "HIGH ALERT")) : null)))))) : null;
  }
  function Screen_sMedRequest(v) {
    return v.sMedRequest ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "flex": "1",
        "minHeight": "0",
        "overflow": "auto",
        "padding": "12px 16px 20px",
        "display": "flex",
        "flexDirection": "column",
        "gap": "12px",
        "animation": "pop .3s ease backwards"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px"
      }
    }, React.createElement("button", {
      onClick: v.goMeds,
      style: {
        "width": "38px",
        "height": "38px",
        "borderRadius": "11px",
        "border": "1px solid rgba(255,255,255,.9)",
        "background": "rgba(255,255,255,.6)",
        "display": "grid",
        "placeItems": "center",
        "color": "#3c4858",
        "cursor": "pointer"
      }
    }, React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M15 6l-6 6 6 6"
    }))), React.createElement("div", {
      style: {
        "flex": "1"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "17px",
        "fontWeight": "800",
        "letterSpacing": "-.2px"
      }
    }, "Request a medicine"), React.createElement("div", {
      style: {
        "fontSize": "12px",
        "color": "#6c7a8c"
      }
    }, "Ask administration to add it to the formulary"))), v.mrSent ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "border": "1px solid rgba(43,182,115,.35)",
        "borderRadius": "18px",
        "padding": "26px 18px",
        "background": "rgba(255,255,255,.75)",
        "textAlign": "center",
        "display": "flex",
        "flexDirection": "column",
        "alignItems": "center",
        "gap": "10px",
        "boxShadow": "0 12px 32px rgba(31,59,90,.1)"
      }
    }, React.createElement("span", {
      style: {
        "display": "grid",
        "placeItems": "center",
        "width": "56px",
        "height": "56px",
        "borderRadius": "50%",
        "background": "rgba(43,182,115,.15)",
        "color": "#1d8f57"
      }
    }, React.createElement("svg", {
      width: "28",
      height: "28",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.4",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M20 6L9 17l-5-5"
    }))), React.createElement("div", {
      style: {
        "fontSize": "16px",
        "fontWeight": "800"
      }
    }, "Request sent"), React.createElement("div", {
      style: {
        "fontSize": "12.5px",
        "color": "#6c7a8c",
        "lineHeight": "1.5"
      }
    }, "The pharmacy and Nurse Manager review requests within 2 working days. You will be notified when the monograph is added."), React.createElement("button", {
      onClick: v.mrAnother,
      style: {
        "marginTop": "6px",
        "border": "0",
        "borderRadius": "11px",
        "padding": "11px 18px",
        "background": "linear-gradient(140deg,#0aa0d4,#0072a3)",
        "color": "#fff",
        "fontSize": "13px",
        "fontWeight": "700",
        "cursor": "pointer"
      }
    }, "Request another"))) : null, v.mrNotSent ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.92)",
        "borderRadius": "18px",
        "padding": "14px",
        "background": "rgba(255,255,255,.72)",
        "display": "flex",
        "flexDirection": "column",
        "gap": "10px"
      }
    }, React.createElement("label", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "4px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Brand or generic name"), React.createElement("input", {
      value: vx(v.mr?.name),
      onChange: v.mrSetName,
      placeholder: "e.g. Oxytocin",
      style: {
        "border": "1px solid rgba(125,145,180,.3)",
        "borderRadius": "10px",
        "padding": "11px 12px",
        "fontSize": "14px",
        "fontWeight": "700",
        "background": "rgba(255,255,255,.85)",
        "outline": "none"
      }
    })), React.createElement("div", {
      style: {
        "display": "grid",
        "gridTemplateColumns": "1fr 1fr",
        "gap": "8px"
      }
    }, React.createElement("label", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "4px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Strength"), React.createElement("input", {
      value: vx(v.mr?.strength),
      onChange: v.mrSetStrength,
      placeholder: "10 IU/mL",
      style: {
        "border": "1px solid rgba(125,145,180,.3)",
        "borderRadius": "10px",
        "padding": "10px 12px",
        "fontSize": "13.5px",
        "background": "rgba(255,255,255,.85)",
        "outline": "none",
        "fontFamily": "'IBM Plex Mono',monospace"
      }
    })), React.createElement("label", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "4px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Manufacturer"), React.createElement("input", {
      value: vx(v.mr?.mfr),
      onChange: v.mrSetMfr,
      placeholder: "optional",
      style: {
        "border": "1px solid rgba(125,145,180,.3)",
        "borderRadius": "10px",
        "padding": "10px 12px",
        "fontSize": "13.5px",
        "background": "rgba(255,255,255,.85)",
        "outline": "none"
      }
    }))), React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "5px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Dosage form"), React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "6px",
        "flexWrap": "wrap"
      }
    }, (Array.isArray(v.mrForms) ? v.mrForms : []).map((f, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: f?.go,
      style: S(f?.style)
    }, ix(f?.label)))))), React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "5px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Why is it needed?"), React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "6px",
        "flexWrap": "wrap"
      }
    }, (Array.isArray(v.mrReasons) ? v.mrReasons : []).map((r, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: r?.go,
      style: S(r?.style)
    }, ix(r?.label)))))), React.createElement("label", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "4px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Details for the pharmacist"), React.createElement("textarea", {
      value: vx(v.mr?.note),
      onChange: v.mrSetNote,
      rows: "3",
      placeholder: "Where it is used, protocol it belongs to, anything the monograph should cover (dilution, high-alert)\u2026",
      style: {
        "border": "1px solid rgba(125,145,180,.3)",
        "borderRadius": "10px",
        "padding": "10px 12px",
        "fontSize": "13.5px",
        "background": "rgba(255,255,255,.85)",
        "outline": "none",
        "resize": "none",
        "lineHeight": "1.5"
      }
    })), React.createElement("button", {
      onClick: v.mrToggleUrgent,
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px",
        "border": "0",
        "background": "none",
        "padding": "2px 0",
        "cursor": "pointer",
        "textAlign": "left"
      }
    }, React.createElement("span", {
      style: S(v.mrUrgentBox)
    }, v.mr?.urgent ? React.createElement(React.Fragment, null, React.createElement("svg", {
      width: "12",
      height: "12",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "#fff",
      strokeWidth: "3",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M20 6L9 17l-5-5"
    }))) : null), React.createElement("span", {
      style: {
        "flex": "1"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "13px",
        "color": "#16202e",
        "fontWeight": "600"
      }
    }, "Urgent · in use on the ward now"), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "11px",
        "color": "#6c7a8c"
      }
    }, "Pharmacy is paged instead of the 2-day queue"))), React.createElement("button", {
      onClick: v.mrToggleHighAlert,
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px",
        "border": "0",
        "background": "none",
        "padding": "2px 0",
        "cursor": "pointer",
        "textAlign": "left"
      }
    }, React.createElement("span", {
      style: S(v.mrHighAlertBox)
    }, v.mr?.highAlert ? React.createElement(React.Fragment, null, React.createElement("svg", {
      width: "12",
      height: "12",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "#fff",
      strokeWidth: "3",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M20 6L9 17l-5-5"
    }))) : null), React.createElement("span", {
      style: {
        "flex": "1"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "13px",
        "color": "#16202e",
        "fontWeight": "600"
      }
    }, "Suggest as high-alert medicine"), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "11px",
        "color": "#6c7a8c"
      }
    }, "Double-check rule will apply once approved")))), React.createElement("button", {
      onClick: v.mrSubmit,
      style: S(v.mrSubmitStyle)
    }, "Send request to administration")) : null, React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "8px"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "justifyContent": "space-between"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "My requests"), React.createElement("span", {
      style: {
        "fontSize": "11px",
        "color": "#6c7a8c"
      }
    }, ix(v.mrCount))), (Array.isArray(v.myMedRequests) ? v.myMedRequests : []).map((r, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "14px",
        "padding": "11px 13px",
        "background": "rgba(255,255,255,.66)",
        "display": "flex",
        "flexDirection": "column",
        "gap": "6px"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "8px"
      }
    }, React.createElement("span", {
      style: {
        "display": "grid",
        "placeItems": "center",
        "width": "34px",
        "height": "34px",
        "borderRadius": "10px",
        "color": "#fff",
        "fontSize": "11px",
        "fontWeight": "700",
        "background": "linear-gradient(135deg,#6a52d4,#0090ca)",
        "flexShrink": "0"
      }
    }, "Rx"), React.createElement("span", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("span", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "6px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "13.5px",
        "fontWeight": "700"
      }
    }, ix(r?.name)), r?.urgent ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: {
        "fontSize": "8.5px",
        "fontWeight": "800",
        "letterSpacing": ".5px",
        "padding": "2px 5px",
        "borderRadius": "5px",
        "color": "#fff",
        "background": "#d23a52"
      }
    }, "URGENT")) : null), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "11px",
        "color": "#6c7a8c"
      }
    }, ix(r?.meta))), React.createElement("span", {
      style: S(r?.statusStyle)
    }, ix(r?.status))), r?.reply ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "fontSize": "11.5px",
        "color": "#3c4858",
        "lineHeight": "1.45",
        "paddingTop": "6px",
        "borderTop": "1px solid rgba(125,145,180,.14)"
      }
    }, React.createElement("b", null, "Pharmacy:"), " ", ix(r?.reply))) : null, r?.approved ? React.createElement(React.Fragment, null, React.createElement("button", {
      onClick: r?.open,
      style: {
        "alignSelf": "flex-start",
        "border": "0",
        "background": "none",
        "color": "#0072a3",
        "fontSize": "12px",
        "fontWeight": "700",
        "cursor": "pointer",
        "padding": "0"
      }
    }, "Open monograph")) : null)))))) : null;
  }
  function Screen_sMedDetail(v) {
    return v.sMedDetail ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "flex": "1",
        "minHeight": "0",
        "display": "flex",
        "flexDirection": "column",
        "animation": "pop .3s ease backwards"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px",
        "padding": "10px 12px 0",
        "flexShrink": "0"
      }
    }, React.createElement("button", {
      onClick: v.goMeds,
      style: {
        "width": "38px",
        "height": "38px",
        "borderRadius": "11px",
        "border": "1px solid rgba(255,255,255,.9)",
        "background": "rgba(255,255,255,.6)",
        "display": "grid",
        "placeItems": "center",
        "color": "#3c4858",
        "cursor": "pointer"
      }
    }, React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M15 6l-6 6 6 6"
    }))), React.createElement("span", {
      style: {
        "flex": "1"
      }
    }), React.createElement("button", {
      onClick: v.toggleFav,
      style: S(v.favStyle)
    }, React.createElement("svg", {
      width: "17",
      height: "17",
      viewBox: "0 0 24 24",
      fill: v.favFill,
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"
    }))), React.createElement("button", {
      onClick: v.shareMed,
      style: {
        "width": "38px",
        "height": "38px",
        "borderRadius": "11px",
        "border": "1px solid rgba(255,255,255,.9)",
        "background": "rgba(255,255,255,.6)",
        "display": "grid",
        "placeItems": "center",
        "color": "#3c4858",
        "cursor": "pointer"
      }
    }, React.createElement("svg", {
      width: "17",
      height: "17",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M21 12a8 8 0 01-8 8H8l-5 3 1.5-4.5A8 8 0 1121 12z"
    })))), React.createElement("div", {
      style: {
        "flex": "1",
        "minHeight": "0",
        "overflow": "auto",
        "padding": "12px 16px 20px",
        "display": "flex",
        "flexDirection": "column",
        "gap": "12px"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "14px",
        "alignItems": "center"
      }
    }, React.createElement("span", {
      style: S(v.med?.imgStyle)
    }), React.createElement("div", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "8px",
        "flexWrap": "wrap"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "21px",
        "fontWeight": "800",
        "letterSpacing": "-.4px"
      }
    }, ix(v.med?.brand)), React.createElement("span", {
      style: {
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "12px",
        "color": "#0072a3",
        "fontWeight": "700"
      }
    }, ix(v.med?.strength))), React.createElement("div", {
      style: {
        "fontSize": "13px",
        "color": "#3c4858",
        "fontWeight": "600"
      }
    }, ix(v.med?.generic)), React.createElement("div", {
      style: {
        "fontSize": "11.5px",
        "color": "#6c7a8c",
        "marginTop": "2px"
      }
    }, ix(v.med?.cls)), React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "6px",
        "marginTop": "7px",
        "flexWrap": "wrap"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10px",
        "fontWeight": "700",
        "padding": "3px 8px",
        "borderRadius": "6px",
        "color": "#0072a3",
        "background": "rgba(0,144,202,.12)"
      }
    }, ix(v.med?.route)), React.createElement("span", {
      style: {
        "fontSize": "10px",
        "fontWeight": "700",
        "padding": "3px 8px",
        "borderRadius": "6px",
        "color": "#3c4858",
        "background": "rgba(125,145,180,.16)"
      }
    }, ix(v.med?.cat)), v.med?.alert ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: {
        "fontSize": "10px",
        "fontWeight": "800",
        "letterSpacing": ".4px",
        "padding": "3px 8px",
        "borderRadius": "6px",
        "color": "#b32e2e",
        "background": "rgba(214,69,69,.12)"
      }
    }, "HIGH ALERT")) : null))), React.createElement("div", {
      style: {
        "display": "grid",
        "gridTemplateColumns": "repeat(3,1fr)",
        "gap": "8px"
      }
    }, React.createElement("div", {
      style: {
        "borderRadius": "13px",
        "padding": "10px 11px",
        "background": "rgba(255,255,255,.68)",
        "border": "1px solid rgba(255,255,255,.9)"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "9.5px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Max daily"), React.createElement("div", {
      style: {
        "fontSize": "12.5px",
        "fontWeight": "700",
        "marginTop": "3px",
        "fontFamily": "'IBM Plex Mono',monospace"
      }
    }, ix(v.med?.maxDose))), React.createElement("div", {
      style: {
        "borderRadius": "13px",
        "padding": "10px 11px",
        "background": "rgba(255,255,255,.68)",
        "border": "1px solid rgba(255,255,255,.9)"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "9.5px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Food"), React.createElement("div", {
      style: {
        "fontSize": "12.5px",
        "fontWeight": "700",
        "marginTop": "3px"
      }
    }, ix(v.med?.food))), React.createElement("div", {
      style: {
        "borderRadius": "13px",
        "padding": "10px 11px",
        "background": "rgba(255,255,255,.68)",
        "border": "1px solid rgba(255,255,255,.9)"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "9.5px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Pregnancy"), React.createElement("div", {
      style: S(`font-size:12.5px;font-weight:700;margin-top:3px;color:${v.med?.pregColor ?? ""}`)
    }, ix(v.med?.preg)))), React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "flex-start",
        "gap": "10px",
        "borderRadius": "15px",
        "padding": "12px 14px",
        "background": "linear-gradient(140deg,rgba(58,181,167,.18),rgba(255,255,255,.7))",
        "border": "1px solid rgba(58,181,167,.3)"
      }
    }, React.createElement("span", {
      style: {
        "display": "grid",
        "placeItems": "center",
        "width": "30px",
        "height": "30px",
        "borderRadius": "9px",
        "background": "rgba(58,181,167,.22)",
        "color": "#1e8a7c",
        "flexShrink": "0"
      }
    }, React.createElement("svg", {
      width: "15",
      height: "15",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M12 2v20M2 12h20"
    }))), React.createElement("div", {
      style: {
        "minWidth": "0"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#1e8a7c"
      }
    }, "Nursing points"), React.createElement("div", {
      style: {
        "fontSize": "13px",
        "lineHeight": "1.5",
        "marginTop": "3px",
        "textWrap": "pretty"
      }
    }, ix(v.med?.nursing)))), React.createElement("div", {
      style: {
        "display": "grid",
        "gridTemplateColumns": "repeat(4,1fr)",
        "background": "rgba(255,255,255,.55)",
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "11px",
        "padding": "3px",
        "gap": "3px",
        "position": "sticky",
        "top": "0",
        "zIndex": "2",
        "backdropFilter": "blur(12px)",
        "WebkitBackdropFilter": "blur(12px)"
      }
    }, (Array.isArray(v.medTabs) ? v.medTabs : []).map((t, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: t?.go,
      style: S(t?.style)
    }, ix(t?.label))))), (Array.isArray(v.medSections) ? v.medSections : []).map((s, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "15px",
        "padding": "13px 14px",
        "background": "rgba(255,255,255,.68)"
      }
    }, React.createElement("div", {
      style: S(`display:flex;align-items:center;gap:7px;font-size:10.5px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:${s?.color ?? ""}`)
    }, React.createElement("span", {
      style: S(`width:6px;height:6px;border-radius:50%;background:${s?.color ?? ""}`)
    }), ix(s?.label)), React.createElement("div", {
      style: {
        "fontSize": "13px",
        "color": "#16202e",
        "lineHeight": "1.55",
        "marginTop": "6px",
        "textWrap": "pretty",
        "whiteSpace": "pre-line"
      }
    }, ix(s?.text))))), v.medTabMore ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "15px",
        "background": "rgba(255,255,255,.68)",
        "overflow": "hidden",
        "flexShrink": "0"
      }
    }, (Array.isArray(v.medFacts) ? v.medFacts : []).map((f, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px",
        "padding": "11px 14px",
        "borderTop": "1px solid rgba(125,145,180,.14)"
      }
    }, React.createElement("span", {
      style: {
        "flex": "1",
        "fontSize": "12px",
        "color": "#6c7a8c",
        "fontWeight": "600"
      }
    }, ix(f?.label)), React.createElement("span", {
      style: {
        "fontSize": "13px",
        "fontWeight": "700",
        "textAlign": "right"
      }
    }, ix(f?.v))))))) : null, React.createElement("div", {
      style: {
        "fontSize": "10.5px",
        "color": "#7d8ea8",
        "textAlign": "center",
        "padding": "4px 10px",
        "lineHeight": "1.5"
      }
    }, "Reference information for nursing staff. Always confirm against the current prescription and hospital formulary before administration.")))) : null;
  }
  function Screen_sNotices(v) {
    return v.sNotices ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "flex": "1",
        "minHeight": "0",
        "overflow": "auto",
        "padding": "14px 16px 20px",
        "display": "flex",
        "flexDirection": "column",
        "gap": "12px",
        "animation": "pop .3s ease backwards"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px"
      }
    }, React.createElement("button", {
      onClick: v.openDrawer,
      style: {
        "width": "38px",
        "height": "38px",
        "borderRadius": "11px",
        "border": "1px solid rgba(255,255,255,.9)",
        "background": "rgba(255,255,255,.6)",
        "display": "grid",
        "placeItems": "center",
        "color": "#3c4858",
        "cursor": "pointer",
        "flexShrink": "0"
      }
    }, React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round"
    }, React.createElement("path", {
      d: "M4 7h16M4 12h16M4 17h10"
    }))), React.createElement("div", {
      style: {
        "flex": "1"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "19px",
        "fontWeight": "800",
        "letterSpacing": "-.3px"
      }
    }, "Notices"), React.createElement("div", {
      style: {
        "fontSize": "12px",
        "color": "#6c7a8c"
      }
    }, ix(v.unreadCount), " unread · ", ix(v.needsActionCount), " need action")), v.isIncharge ? React.createElement(React.Fragment, null, React.createElement("button", {
      onClick: v.goCompose,
      style: {
        "display": "inline-flex",
        "alignItems": "center",
        "gap": "6px",
        "border": "0",
        "borderRadius": "11px",
        "padding": "10px 12px",
        "background": "linear-gradient(140deg,#0aa0d4,#0072a3)",
        "color": "#fff",
        "fontSize": "12.5px",
        "fontWeight": "700",
        "cursor": "pointer",
        "boxShadow": "0 8px 20px rgba(0,144,202,.3)"
      }
    }, React.createElement("svg", {
      width: "14",
      height: "14",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.4",
      strokeLinecap: "round"
    }, React.createElement("path", {
      d: "M12 5v14M5 12h14"
    })), "Post")) : null, v.isNurse ? React.createElement(React.Fragment, null, React.createElement("button", {
      onClick: v.markAllRead,
      style: {
        "border": "0",
        "background": "none",
        "color": "#0072a3",
        "fontSize": "12px",
        "fontWeight": "700",
        "cursor": "pointer"
      }
    }, "Mark all read")) : null), React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "9px",
        "border": "1px solid rgba(255,255,255,.95)",
        "borderRadius": "13px",
        "padding": "10px 13px",
        "background": "rgba(255,255,255,.8)",
        "flexShrink": "0"
      }
    }, React.createElement("svg", {
      width: "16",
      height: "16",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "#6c7a8c",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("circle", {
      cx: "11",
      cy: "11",
      r: "7"
    }), React.createElement("path", {
      d: "M21 21l-4.3-4.3"
    })), React.createElement("input", {
      value: vx(v.noticeSearch),
      onChange: v.setNoticeSearch,
      placeholder: "Search notices",
      style: {
        "flex": "1",
        "border": "0",
        "background": "transparent",
        "fontSize": "13.5px",
        "outline": "none",
        "minWidth": "0"
      }
    })), React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "6px",
        "overflowX": "auto",
        "paddingBottom": "2px",
        "scrollbarWidth": "none",
        "flexShrink": "0"
      }
    }, (Array.isArray(v.noticeFilters) ? v.noticeFilters : []).map((f, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: f?.go,
      style: S(f?.style)
    }, ix(f?.label))))), React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "8px"
      }
    }, (Array.isArray(v.noticeList) ? v.noticeList : []).map((n, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: n?.go,
      style: S(n?.cardStyle)
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "8px"
      }
    }, React.createElement("span", {
      style: S(n?.catStyle)
    }, ix(n?.cat)), n?.pinned ? React.createElement(React.Fragment, null, React.createElement("svg", {
      width: "13",
      height: "13",
      viewBox: "0 0 24 24",
      fill: "#e08a1e",
      stroke: "#e08a1e",
      strokeWidth: "1.5",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M16 3l5 5-4 1-4 4 1 5-3 1-4-4-5 5 5-5-4-4 1-3 5 1 4-4z"
    }))) : null, React.createElement("span", {
      style: {
        "flex": "1"
      }
    }), React.createElement("span", {
      style: {
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "10.5px",
        "color": "#9aa6b4"
      }
    }, ix(n?.when)), n?.unread ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: {
        "width": "8px",
        "height": "8px",
        "borderRadius": "50%",
        "background": "#0090ca"
      }
    })) : null), React.createElement("div", {
      style: {
        "fontSize": "14px",
        "fontWeight": "700",
        "lineHeight": "1.3",
        "marginTop": "8px"
      }
    }, ix(n?.title)), React.createElement("div", {
      style: {
        "fontSize": "12px",
        "color": "#6c7a8c",
        "marginTop": "3px",
        "overflow": "hidden",
        "textOverflow": "ellipsis",
        "whiteSpace": "nowrap"
      }
    }, ix(n?.body)), React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "6px",
        "marginTop": "8px",
        "flexWrap": "wrap"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "11px",
        "color": "#7d8ea8"
      }
    }, ix(n?.from)), React.createElement("span", {
      style: {
        "flex": "1"
      }
    }), n?.hasPoll ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: {
        "fontSize": "9.5px",
        "fontWeight": "800",
        "letterSpacing": ".5px",
        "padding": "2px 6px",
        "borderRadius": "5px",
        "color": "#6a52d4",
        "background": "rgba(106,82,212,.13)"
      }
    }, "POLL")) : null, n?.hasAttach ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: {
        "display": "inline-flex",
        "alignItems": "center",
        "gap": "3px",
        "fontSize": "10px",
        "fontWeight": "700",
        "color": "#7d8ea8"
      }
    }, React.createElement("svg", {
      width: "11",
      height: "11",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M21.4 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"
    })), ix(n?.attachCount))) : null, n?.needsAction ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: {
        "fontSize": "9.5px",
        "fontWeight": "800",
        "letterSpacing": ".5px",
        "padding": "2px 6px",
        "borderRadius": "5px",
        "color": "#b8650a",
        "background": "rgba(224,138,30,.15)"
      }
    }, "ACK REQUIRED")) : null, n?.saved ? React.createElement(React.Fragment, null, React.createElement("svg", {
      width: "12",
      height: "12",
      viewBox: "0 0 24 24",
      fill: "#0090ca",
      stroke: "#0090ca",
      strokeWidth: "2",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"
    }))) : null))))))) : null;
  }
  function Screen_sNoticeDetail(v) {
    return v.sNoticeDetail ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "flex": "1",
        "minHeight": "0",
        "overflow": "auto",
        "padding": "12px 16px 20px",
        "display": "flex",
        "flexDirection": "column",
        "gap": "14px",
        "animation": "pop .3s ease backwards"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px"
      }
    }, React.createElement("button", {
      onClick: v.goNotices,
      style: {
        "width": "38px",
        "height": "38px",
        "borderRadius": "11px",
        "border": "1px solid rgba(255,255,255,.9)",
        "background": "rgba(255,255,255,.6)",
        "display": "grid",
        "placeItems": "center",
        "color": "#3c4858",
        "cursor": "pointer"
      }
    }, React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M15 6l-6 6 6 6"
    }))), React.createElement("span", {
      style: S(v.notice?.catStyle)
    }, ix(v.notice?.cat)), React.createElement("span", {
      style: {
        "flex": "1"
      }
    }), React.createElement("button", {
      onClick: v.toggleSaveNotice,
      style: S(v.saveBtnStyle)
    }, React.createElement("svg", {
      width: "16",
      height: "16",
      viewBox: "0 0 24 24",
      fill: v.saveFill,
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"
    }))), React.createElement("button", {
      onClick: v.shareNotice,
      style: {
        "width": "36px",
        "height": "36px",
        "borderRadius": "10px",
        "border": "1px solid rgba(255,255,255,.9)",
        "background": "rgba(255,255,255,.6)",
        "display": "grid",
        "placeItems": "center",
        "color": "#3c4858",
        "cursor": "pointer"
      }
    }, React.createElement("svg", {
      width: "16",
      height: "16",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M21 12a8 8 0 01-8 8H8l-5 3 1.5-4.5A8 8 0 1121 12z"
    })))), React.createElement("div", {
      style: {
        "fontSize": "21px",
        "fontWeight": "800",
        "letterSpacing": "-.4px",
        "lineHeight": "1.2",
        "textWrap": "pretty"
      }
    }, ix(v.notice?.title)), React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px"
      }
    }, React.createElement("span", {
      style: {
        "display": "grid",
        "placeItems": "center",
        "width": "34px",
        "height": "34px",
        "borderRadius": "10px",
        "color": "#fff",
        "fontSize": "11px",
        "fontWeight": "700",
        "background": "linear-gradient(135deg,#0d2a4a,#0a5f87)"
      }
    }, ix(v.notice?.ini)), React.createElement("div", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "13px",
        "fontWeight": "700"
      }
    }, ix(v.notice?.from)), React.createElement("div", {
      style: {
        "fontSize": "11px",
        "color": "#6c7a8c"
      }
    }, ix(v.notice?.fromRole), " · to ", ix(v.notice?.audience))), React.createElement("span", {
      style: {
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "11px",
        "color": "#7d8ea8"
      }
    }, ix(v.notice?.when))), React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.92)",
        "borderRadius": "18px",
        "padding": "16px",
        "background": "rgba(255,255,255,.72)",
        "boxShadow": "0 12px 32px rgba(31,59,90,.1)",
        "fontSize": "14px",
        "lineHeight": "1.6",
        "color": "#16202e",
        "textWrap": "pretty",
        "whiteSpace": "pre-line"
      }
    }, ix(v.notice?.full)), v.notice?.hasAttach ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "6px"
      }
    }, (Array.isArray(v.notice?.attachments) ? v.notice?.attachments : []).map((a, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "11px",
        "textAlign": "left",
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "13px",
        "padding": "10px 12px",
        "background": "rgba(255,255,255,.66)",
        "cursor": "pointer",
        "color": "#16202e"
      }
    }, React.createElement("span", {
      style: {
        "display": "grid",
        "placeItems": "center",
        "width": "36px",
        "height": "36px",
        "borderRadius": "10px",
        "background": "rgba(210,58,82,.1)",
        "color": "#b32e2e",
        "fontSize": "9.5px",
        "fontWeight": "800",
        "letterSpacing": ".4px"
      }
    }, ix(a?.ext)), React.createElement("span", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "13px",
        "fontWeight": "700",
        "whiteSpace": "nowrap",
        "overflow": "hidden",
        "textOverflow": "ellipsis"
      }
    }, ix(a?.name)), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "11px",
        "color": "#6c7a8c"
      }
    }, ix(a?.size))), React.createElement("svg", {
      width: "16",
      height: "16",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "#7d8ea8",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"
    }))))))) : null, v.notice?.hasPoll ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "border": "1px solid rgba(106,82,212,.25)",
        "borderRadius": "16px",
        "padding": "14px",
        "background": "linear-gradient(140deg,rgba(106,82,212,.08),rgba(255,255,255,.7))",
        "display": "flex",
        "flexDirection": "column",
        "gap": "8px"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "8px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "9.5px",
        "fontWeight": "800",
        "letterSpacing": ".5px",
        "padding": "2px 6px",
        "borderRadius": "5px",
        "color": "#6a52d4",
        "background": "rgba(106,82,212,.13)"
      }
    }, "POLL"), React.createElement("span", {
      style: {
        "fontSize": "13.5px",
        "fontWeight": "700"
      }
    }, ix(v.notice?.pollQ))), (Array.isArray(v.pollOpts) ? v.pollOpts : []).map((o, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: o?.go,
      style: S(o?.style)
    }, React.createElement("span", {
      style: S(o?.fill)
    }), React.createElement("span", {
      style: {
        "position": "relative",
        "flex": "1",
        "textAlign": "left",
        "fontSize": "13px",
        "fontWeight": "600"
      }
    }, ix(o?.label)), React.createElement("span", {
      style: {
        "position": "relative",
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "11.5px",
        "fontWeight": "700",
        "color": "#6a52d4"
      }
    }, ix(o?.pct))))), React.createElement("div", {
      style: {
        "fontSize": "11px",
        "color": "#7d8ea8"
      }
    }, ix(v.pollMeta)))) : null, v.notice?.needsAck ? React.createElement(React.Fragment, null, v.isIncharge ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "16px",
        "padding": "14px",
        "background": "rgba(255,255,255,.68)",
        "display": "flex",
        "flexDirection": "column",
        "gap": "8px"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "justifyContent": "space-between"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Acknowledgement"), React.createElement("span", {
      style: {
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "12.5px",
        "fontWeight": "700",
        "color": "#0072a3"
      }
    }, ix(v.ackStat))), React.createElement("div", {
      style: {
        "height": "8px",
        "borderRadius": "999px",
        "background": "rgba(125,145,180,.18)",
        "overflow": "hidden",
        "flexShrink": "0"
      }
    }, React.createElement("div", {
      style: S(v.ackBar)
    })), React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "8px"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex"
      }
    }, (Array.isArray(v.ackPending) ? v.ackPending : []).map((p, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("span", {
      style: {
        "display": "grid",
        "placeItems": "center",
        "width": "26px",
        "height": "26px",
        "borderRadius": "8px",
        "color": "#fff",
        "fontSize": "9.5px",
        "fontWeight": "700",
        "background": "linear-gradient(135deg,#3ab5a7,#0090ca)",
        "border": "2px solid #fff",
        "marginLeft": "-6px"
      }
    }, ix(p))))), React.createElement("span", {
      style: {
        "flex": "1",
        "fontSize": "11.5px",
        "color": "#6c7a8c"
      }
    }, ix(v.ackPendingLabel)), React.createElement("button", {
      onClick: v.remindUnread,
      style: S(v.remindStyle)
    }, ix(v.remindLabel))))) : null, v.notice?.acked ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "justifyContent": "center",
        "gap": "8px",
        "borderRadius": "13px",
        "padding": "13px",
        "background": "rgba(43,182,115,.12)",
        "color": "#1d8f57",
        "fontSize": "13.5px",
        "fontWeight": "700"
      }
    }, React.createElement("svg", {
      width: "17",
      height: "17",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.4",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M20 6L9 17l-5-5"
    })), "Acknowledged")) : null, v.notice?.notAcked ? React.createElement(React.Fragment, null, React.createElement("button", {
      onClick: v.ackNotice,
      style: {
        "border": "0",
        "borderRadius": "13px",
        "padding": "14px",
        "background": "linear-gradient(140deg,#0aa0d4,#0072a3)",
        "color": "#fff",
        "fontSize": "14px",
        "fontWeight": "700",
        "cursor": "pointer",
        "boxShadow": "0 10px 24px rgba(0,144,202,.32)"
      }
    }, "I have read this")) : null) : null, React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "8px"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Questions & comments · ", ix(v.commentCount)), (Array.isArray(v.comments) ? v.comments : []).map((c, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "9px",
        "alignItems": "flex-start"
      }
    }, React.createElement("span", {
      style: {
        "display": "grid",
        "placeItems": "center",
        "width": "28px",
        "height": "28px",
        "borderRadius": "9px",
        "color": "#fff",
        "fontSize": "10px",
        "fontWeight": "700",
        "background": "linear-gradient(135deg,#3ab5a7,#0090ca)",
        "flexShrink": "0"
      }
    }, ix(c?.ini)), React.createElement("div", {
      style: {
        "flex": "1",
        "minWidth": "0",
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "4px 13px 13px 13px",
        "padding": "9px 12px",
        "background": "rgba(255,255,255,.7)"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "6px",
        "alignItems": "baseline"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "12px",
        "fontWeight": "700"
      }
    }, ix(c?.from)), React.createElement("span", {
      style: {
        "fontSize": "10.5px",
        "color": "#9aa6b4",
        "fontFamily": "'IBM Plex Mono',monospace"
      }
    }, ix(c?.when))), React.createElement("div", {
      style: {
        "fontSize": "12.5px",
        "lineHeight": "1.45",
        "marginTop": "2px",
        "textWrap": "pretty"
      }
    }, ix(c?.text)))))), React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "8px"
      }
    }, React.createElement("input", {
      value: vx(v.commentDraft),
      onChange: v.setCommentDraft,
      onKeyDown: v.commentKey,
      placeholder: "Ask a question",
      style: {
        "flex": "1",
        "minWidth": "0",
        "border": "1px solid rgba(125,145,180,.3)",
        "borderRadius": "12px",
        "padding": "10px 13px",
        "fontSize": "13.5px",
        "background": "rgba(255,255,255,.85)",
        "outline": "none"
      }
    }), React.createElement("button", {
      onClick: v.sendComment,
      style: {
        "width": "38px",
        "height": "38px",
        "borderRadius": "11px",
        "border": "0",
        "background": "linear-gradient(140deg,#0aa0d4,#0072a3)",
        "color": "#fff",
        "display": "grid",
        "placeItems": "center",
        "cursor": "pointer",
        "flexShrink": "0"
      }
    }, React.createElement("svg", {
      width: "15",
      height: "15",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"
    }))))))) : null;
  }
  function Screen_sCompose(v) {
    return v.sCompose ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "flex": "1",
        "minHeight": "0",
        "overflow": "auto",
        "padding": "12px 16px 20px",
        "display": "flex",
        "flexDirection": "column",
        "gap": "12px",
        "animation": "pop .3s ease backwards"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px"
      }
    }, React.createElement("button", {
      onClick: v.goNotices,
      style: {
        "width": "38px",
        "height": "38px",
        "borderRadius": "11px",
        "border": "1px solid rgba(255,255,255,.9)",
        "background": "rgba(255,255,255,.6)",
        "display": "grid",
        "placeItems": "center",
        "color": "#3c4858",
        "cursor": "pointer"
      }
    }, React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M15 6l-6 6 6 6"
    }))), React.createElement("div", {
      style: {
        "flex": "1"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "17px",
        "fontWeight": "800",
        "letterSpacing": "-.2px"
      }
    }, "New announcement"), React.createElement("div", {
      style: {
        "fontSize": "12px",
        "color": "#6c7a8c"
      }
    }, "Posting as ", ix(v.staffName)))), v.composeSent ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "border": "1px solid rgba(43,182,115,.35)",
        "borderRadius": "18px",
        "padding": "26px 18px",
        "background": "rgba(255,255,255,.75)",
        "textAlign": "center",
        "display": "flex",
        "flexDirection": "column",
        "alignItems": "center",
        "gap": "10px",
        "boxShadow": "0 12px 32px rgba(31,59,90,.1)"
      }
    }, React.createElement("span", {
      style: {
        "display": "grid",
        "placeItems": "center",
        "width": "56px",
        "height": "56px",
        "borderRadius": "50%",
        "background": "rgba(43,182,115,.15)",
        "color": "#1d8f57"
      }
    }, React.createElement("svg", {
      width: "28",
      height: "28",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.4",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M20 6L9 17l-5-5"
    }))), React.createElement("div", {
      style: {
        "fontSize": "16px",
        "fontWeight": "800"
      }
    }, ix(v.composeDoneTitle)), React.createElement("div", {
      style: {
        "fontSize": "12.5px",
        "color": "#6c7a8c"
      }
    }, ix(v.composeDoneSub)), React.createElement("button", {
      onClick: v.goNotices,
      style: {
        "marginTop": "6px",
        "border": "0",
        "borderRadius": "11px",
        "padding": "11px 18px",
        "background": "linear-gradient(140deg,#0aa0d4,#0072a3)",
        "color": "#fff",
        "fontSize": "13px",
        "fontWeight": "700",
        "cursor": "pointer"
      }
    }, "Back to notices"))) : null, v.composeNotSent ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.92)",
        "borderRadius": "18px",
        "padding": "14px",
        "background": "rgba(255,255,255,.72)",
        "display": "flex",
        "flexDirection": "column",
        "gap": "10px"
      }
    }, React.createElement("input", {
      value: vx(v.cTitle),
      onChange: v.setCTitle,
      placeholder: "Title",
      style: {
        "border": "1px solid rgba(125,145,180,.3)",
        "borderRadius": "10px",
        "padding": "11px 12px",
        "fontSize": "15px",
        "fontWeight": "700",
        "background": "rgba(255,255,255,.85)",
        "outline": "none"
      }
    }), React.createElement("textarea", {
      value: vx(v.cBody),
      onChange: v.setCBody,
      rows: "5",
      placeholder: "Write the announcement. Keep patient identifiers out.",
      style: {
        "border": "1px solid rgba(125,145,180,.3)",
        "borderRadius": "10px",
        "padding": "11px 12px",
        "fontSize": "13.5px",
        "background": "rgba(255,255,255,.85)",
        "outline": "none",
        "resize": "none",
        "lineHeight": "1.5"
      }
    }), React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "6px",
        "flexWrap": "wrap"
      }
    }, React.createElement("button", {
      onClick: v.toggleCAttach,
      style: S(v.cAttachStyle)
    }, React.createElement("svg", {
      width: "13",
      height: "13",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M21.4 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"
    })), ix(v.cAttachLabel)), React.createElement("button", {
      onClick: v.toggleCPoll,
      style: S(v.cPollStyle)
    }, React.createElement("svg", {
      width: "13",
      height: "13",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M18 20V10M12 20V4M6 20v-6"
    })), ix(v.cPollLabel))), v.cPoll ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "6px",
        "borderRadius": "12px",
        "padding": "10px",
        "background": "rgba(106,82,212,.07)",
        "border": "1px solid rgba(106,82,212,.2)"
      }
    }, React.createElement("input", {
      value: vx(v.cPollQ),
      onChange: v.setCPollQ,
      placeholder: "Poll question",
      style: {
        "border": "1px solid rgba(125,145,180,.3)",
        "borderRadius": "9px",
        "padding": "9px 11px",
        "fontSize": "13px",
        "fontWeight": "600",
        "background": "#fff",
        "outline": "none"
      }
    }), (Array.isArray(v.cPollOpts) ? v.cPollOpts : []).map((o, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("input", {
      value: vx(o?.v),
      onChange: o?.set,
      placeholder: o?.ph,
      style: {
        "border": "1px solid rgba(125,145,180,.3)",
        "borderRadius": "9px",
        "padding": "9px 11px",
        "fontSize": "13px",
        "background": "#fff",
        "outline": "none"
      }
    }))))) : null), React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "6px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Category"), React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "6px",
        "flexWrap": "wrap"
      }
    }, (Array.isArray(v.cCats) ? v.cCats : []).map((c, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: c?.go,
      style: S(c?.style)
    }, ix(c?.label)))))), React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "6px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Audience"), React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "5px"
      }
    }, (Array.isArray(v.cAudiences) ? v.cAudiences : []).map((a, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: a?.go,
      style: S(a?.style)
    }, React.createElement("span", {
      style: S(a?.radio)
    }), React.createElement("span", {
      style: {
        "flex": "1",
        "textAlign": "left"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "13px",
        "fontWeight": "700"
      }
    }, ix(a?.label)), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "11px",
        "color": "#6c7a8c"
      }
    }, ix(a?.sub))), React.createElement("span", {
      style: {
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "11.5px",
        "fontWeight": "700",
        "color": "#7d8ea8"
      }
    }, ix(a?.count)))))), v.cAudienceDepts ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "6px",
        "flexWrap": "wrap",
        "paddingTop": "2px"
      }
    }, (Array.isArray(v.cDeptChips) ? v.cDeptChips : []).map((d, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: d?.go,
      style: S(d?.style)
    }, ix(d?.label)))))) : null), React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "16px",
        "background": "rgba(255,255,255,.68)",
        "overflow": "hidden",
        "flexShrink": "0"
      }
    }, (Array.isArray(v.cOptions) ? v.cOptions : []).map((o, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "12px",
        "padding": "12px 14px",
        "borderTop": "1px solid rgba(125,145,180,.14)"
      }
    }, React.createElement("span", {
      style: {
        "flex": "1"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "13.5px",
        "fontWeight": "600"
      }
    }, ix(o?.label)), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "11.5px",
        "color": "#6c7a8c"
      }
    }, ix(o?.sub))), React.createElement("button", {
      onClick: o?.go,
      style: S(o?.track)
    }, React.createElement("span", {
      style: S(o?.knob)
    })))))), React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "6px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Publish"), React.createElement("div", {
      style: {
        "display": "inline-flex",
        "background": "rgba(255,255,255,.55)",
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "11px",
        "padding": "3px",
        "gap": "3px",
        "alignSelf": "flex-start"
      }
    }, (Array.isArray(v.cWhenOpts) ? v.cWhenOpts : []).map((w, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: w?.go,
      style: S(w?.style)
    }, ix(w?.label)))))), React.createElement("button", {
      onClick: v.publishNotice,
      style: S(v.publishStyle)
    }, ix(v.publishLabel))) : null)) : null;
  }
  function Screen_sStaff(v) {
    return v.sStaff ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "flex": "1",
        "minHeight": "0",
        "overflow": "auto",
        "padding": "14px 16px 20px",
        "display": "flex",
        "flexDirection": "column",
        "gap": "12px",
        "animation": "pop .3s ease backwards"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px"
      }
    }, React.createElement("button", {
      onClick: v.openDrawer,
      style: {
        "width": "38px",
        "height": "38px",
        "borderRadius": "11px",
        "border": "1px solid rgba(255,255,255,.9)",
        "background": "rgba(255,255,255,.6)",
        "display": "grid",
        "placeItems": "center",
        "color": "#3c4858",
        "cursor": "pointer",
        "flexShrink": "0"
      }
    }, React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round"
    }, React.createElement("path", {
      d: "M4 7h16M4 12h16M4 17h10"
    }))), React.createElement("div", {
      style: {
        "flex": "1"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "19px",
        "fontWeight": "800",
        "letterSpacing": "-.3px"
      }
    }, "Staff directory"), React.createElement("div", {
      style: {
        "fontSize": "12px",
        "color": "#6c7a8c"
      }
    }, ix(v.staffCount), " staff · ", ix(v.staffOnline), " online")), v.dirIsStaff ? React.createElement(React.Fragment, null, React.createElement("button", {
      onClick: v.toggleStaffOnline,
      style: S(v.staffOnlineStyle)
    }, React.createElement("span", {
      style: {
        "width": "7px",
        "height": "7px",
        "borderRadius": "50%",
        "background": "#2bb673"
      }
    }), "Online")) : null), React.createElement("div", {
      style: {
        "display": "inline-flex",
        "background": "rgba(255,255,255,.55)",
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "11px",
        "padding": "3px",
        "gap": "3px",
        "flexShrink": "0"
      }
    }, (Array.isArray(v.dirTabs) ? v.dirTabs : []).map((t, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: t?.go,
      style: S(t?.style)
    }, ix(t?.label))))), React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "9px",
        "border": "1px solid rgba(255,255,255,.95)",
        "borderRadius": "13px",
        "padding": "10px 13px",
        "background": "rgba(255,255,255,.8)",
        "flexShrink": "0"
      }
    }, React.createElement("svg", {
      width: "16",
      height: "16",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "#6c7a8c",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("circle", {
      cx: "11",
      cy: "11",
      r: "7"
    }), React.createElement("path", {
      d: "M21 21l-4.3-4.3"
    })), React.createElement("input", {
      value: vx(v.staffSearch),
      onChange: v.setStaffSearch,
      placeholder: v.dirSearchPh,
      style: {
        "flex": "1",
        "border": "0",
        "background": "transparent",
        "fontSize": "13.5px",
        "outline": "none",
        "minWidth": "0"
      }
    })), v.dirIsPhonebook ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "8px"
      }
    }, (Array.isArray(v.phonebook) ? v.phonebook : []).map((g, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#7d8ea8",
        "padding": "4px 2px 0"
      }
    }, ix(g?.sec)), (Array.isArray(g?.items) ? g?.items : []).map((n, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: S(n?.style)
    }, React.createElement("span", {
      style: S(n?.iconWrap)
    }, React.createElement("svg", {
      width: "17",
      height: "17",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: n?.d
    }))), React.createElement("span", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "13.5px",
        "fontWeight": "700"
      }
    }, ix(n?.label)), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "11px",
        "color": "#6c7a8c"
      }
    }, ix(n?.sub))), React.createElement("a", {
      href: n?.tel,
      style: S(n?.numStyle)
    }, React.createElement("svg", {
      width: "14",
      height: "14",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1.9.4 1.8.7 2.6a2 2 0 01-.5 2.1L8 9.7a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.4c.8.3 1.7.5 2.6.7a2 2 0 011.7 2z"
    })), ix(n?.num))))))))) : null, v.dirIsStaff ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "6px",
        "overflowX": "auto",
        "paddingBottom": "2px",
        "scrollbarWidth": "none",
        "flexShrink": "0"
      }
    }, (Array.isArray(v.staffDeptChips) ? v.staffDeptChips : []).map((d, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: d?.go,
      style: S(d?.style)
    }, ix(d?.label))))), React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "8px",
        "flexShrink": "0"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#7d8ea8",
        "whiteSpace": "nowrap"
      }
    }, "Sort by"), React.createElement("div", {
      style: {
        "display": "inline-flex",
        "background": "rgba(255,255,255,.55)",
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "10px",
        "padding": "2px",
        "gap": "2px"
      }
    }, (Array.isArray(v.staffSortOpts) ? v.staffSortOpts : []).map((o, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: o?.go,
      style: S(o?.style)
    }, ix(o?.label)))))), React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "8px"
      }
    }, (Array.isArray(v.staffList) ? v.staffList : []).map((p, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      onClick: p?.go,
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "11px",
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "15px",
        "padding": "10px 12px",
        "background": "rgba(255,255,255,.66)",
        "cursor": "pointer"
      },
      className: "dcp0"
    }, React.createElement("span", {
      style: {
        "position": "relative",
        "flexShrink": "0"
      }
    }, p?.hasPhoto ? React.createElement(React.Fragment, null, React.createElement("img", {
      src: p?.photo,
      alt: "",
      style: {
        "width": "44px",
        "height": "44px",
        "borderRadius": "13px",
        "objectFit": "cover",
        "display": "block"
      }
    })) : null, p?.noPhoto ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: {
        "display": "grid",
        "placeItems": "center",
        "width": "44px",
        "height": "44px",
        "borderRadius": "13px",
        "color": "#fff",
        "fontSize": "12.5px",
        "fontWeight": "700",
        "background": "linear-gradient(135deg,#3ab5a7,#0090ca)"
      }
    }, ix(p?.ini))) : null, p?.online ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: {
        "position": "absolute",
        "right": "-2px",
        "bottom": "-2px",
        "width": "11px",
        "height": "11px",
        "borderRadius": "50%",
        "background": "#2bb673",
        "border": "2px solid #fff"
      }
    })) : null), React.createElement("span", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "13.5px",
        "fontWeight": "700",
        "whiteSpace": "nowrap",
        "overflow": "hidden",
        "textOverflow": "ellipsis"
      }
    }, ix(p?.name)), React.createElement("span", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "6px",
        "fontSize": "11.5px",
        "color": "#6c7a8c",
        "whiteSpace": "nowrap",
        "overflow": "hidden",
        "textOverflow": "ellipsis"
      }
    }, React.createElement("span", null, ix(p?.title), " · ", ix(p?.dept)), React.createElement("span", {
      style: S(p?.lastActiveStyle)
    }, ix(p?.lastActive))), React.createElement("span", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "6px",
        "marginTop": "3px",
        "whiteSpace": "nowrap"
      }
    }, React.createElement("span", {
      style: S(p?.codeStyle)
    }, ix(p?.shift)), React.createElement("span", {
      style: {
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "11px",
        "color": "#7d8ea8"
      }
    }, ix(p?.phoneShown)))), true ? React.createElement(React.Fragment, null, React.createElement("a", {
      href: p?.tel,
      onClick: p?.call,
      title: `Call ${p?.phone ?? ""}`,
      style: {
        "width": "36px",
        "height": "36px",
        "borderRadius": "10px",
        "border": "1px solid rgba(43,182,115,.3)",
        "background": "rgba(43,182,115,.1)",
        "color": "#1d8f57",
        "display": "grid",
        "placeItems": "center",
        "cursor": "pointer",
        "flexShrink": "0",
        "textDecoration": "none"
      }
    }, React.createElement("svg", {
      width: "15",
      height: "15",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1.9.4 1.8.7 2.6a2 2 0 01-.5 2.1L8 9.7a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.4c.8.3 1.7.5 2.6.7a2 2 0 011.7 2z"
    }))), React.createElement("a", {
      href: p?.wa,
      target: "_blank",
      rel: "noopener",
      onClick: p?.call,
      title: `WhatsApp ${p?.phone ?? ""}`,
      style: {
        "width": "36px",
        "height": "36px",
        "borderRadius": "10px",
        "border": "1px solid rgba(37,211,102,.4)",
        "background": "#25d366",
        "color": "#fff",
        "display": "grid",
        "placeItems": "center",
        "cursor": "pointer",
        "flexShrink": "0",
        "textDecoration": "none"
      }
    }, React.createElement("svg", {
      width: "17",
      height: "17",
      viewBox: "0 0 24 24",
      fill: "currentColor"
    }, React.createElement("path", {
      d: "M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.5-.6c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.2-.3-.2-.6-.3zM12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1112 20.2z"
    })))) : null, React.createElement("button", {
      onClick: p?.msg,
      title: "Message",
      style: {
        "width": "36px",
        "height": "36px",
        "borderRadius": "10px",
        "border": "1px solid rgba(0,144,202,.3)",
        "background": "rgba(0,144,202,.1)",
        "color": "#0072a3",
        "display": "grid",
        "placeItems": "center",
        "cursor": "pointer",
        "flexShrink": "0"
      }
    }, React.createElement("svg", {
      width: "15",
      height: "15",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M21 12a8 8 0 01-8 8H8l-5 3 1.5-4.5A8 8 0 1121 12z"
    })))))))) : null)) : null;
  }
  function Screen_sStaffDetail(v) {
    return v.sStaffDetail ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "flex": "1",
        "minHeight": "0",
        "overflow": "auto",
        "padding": "12px 16px 20px",
        "display": "flex",
        "flexDirection": "column",
        "gap": "12px",
        "animation": "pop .3s ease backwards"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px"
      }
    }, React.createElement("button", {
      onClick: v.goStaff,
      style: {
        "width": "38px",
        "height": "38px",
        "borderRadius": "11px",
        "border": "1px solid rgba(255,255,255,.9)",
        "background": "rgba(255,255,255,.6)",
        "display": "grid",
        "placeItems": "center",
        "color": "#3c4858",
        "cursor": "pointer"
      }
    }, React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M15 6l-6 6 6 6"
    }))), React.createElement("div", {
      style: {
        "fontSize": "16px",
        "fontWeight": "800"
      }
    }, "Staff profile")), React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.92)",
        "borderRadius": "18px",
        "padding": "18px 16px",
        "background": "rgba(255,255,255,.72)",
        "boxShadow": "0 12px 32px rgba(31,59,90,.1)",
        "display": "flex",
        "flexDirection": "column",
        "alignItems": "center",
        "gap": "10px",
        "textAlign": "center"
      }
    }, React.createElement("span", {
      style: {
        "position": "relative"
      }
    }, v.person?.hasPhoto ? React.createElement(React.Fragment, null, React.createElement("img", {
      src: v.person?.photo,
      alt: "",
      style: {
        "width": "76px",
        "height": "76px",
        "borderRadius": "22px",
        "objectFit": "cover",
        "display": "block",
        "flexShrink": "0"
      }
    })) : null, v.person?.noPhoto ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: {
        "display": "grid",
        "placeItems": "center",
        "width": "76px",
        "height": "76px",
        "borderRadius": "22px",
        "color": "#fff",
        "fontSize": "22px",
        "fontWeight": "700",
        "background": "linear-gradient(135deg,#3ab5a7,#0090ca)",
        "boxShadow": "0 0 0 3px rgba(122,196,232,.4)"
      }
    }, ix(v.person?.ini))) : null, v.person?.online ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: {
        "position": "absolute",
        "right": "-3px",
        "bottom": "-3px",
        "width": "16px",
        "height": "16px",
        "borderRadius": "50%",
        "background": "#2bb673",
        "border": "3px solid #fff"
      }
    })) : null), React.createElement("div", null, React.createElement("div", {
      style: {
        "fontSize": "18px",
        "fontWeight": "800",
        "letterSpacing": "-.3px"
      }
    }, ix(v.person?.name)), React.createElement("div", {
      style: {
        "fontSize": "12.5px",
        "color": "#6c7a8c",
        "marginTop": "2px"
      }
    }, ix(v.person?.title), " · ", ix(v.person?.dept))), React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "6px",
        "flexWrap": "wrap",
        "justifyContent": "center"
      }
    }, React.createElement("span", {
      style: S(v.person?.statusStyle)
    }, React.createElement("span", {
      style: S(v.person?.dotStyle)
    }), ix(v.person?.statusLabel)), React.createElement("span", {
      style: S(v.person?.codeStyle)
    }, "Today · ", ix(v.person?.shift))), React.createElement("div", {
      style: S(v.personActionsGrid)
    }, true ? React.createElement(React.Fragment, null, React.createElement("a", {
      href: v.person?.tel,
      style: {
        "display": "flex",
        "alignItems": "center",
        "justifyContent": "center",
        "gap": "8px",
        "border": "1px solid rgba(43,182,115,.35)",
        "borderRadius": "12px",
        "padding": "12px",
        "background": "rgba(43,182,115,.1)",
        "color": "#1d8f57",
        "fontSize": "13px",
        "fontWeight": "700",
        "cursor": "pointer",
        "textDecoration": "none"
      }
    }, React.createElement("svg", {
      width: "16",
      height: "16",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1.9.4 1.8.7 2.6a2 2 0 01-.5 2.1L8 9.7a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.4c.8.3 1.7.5 2.6.7a2 2 0 011.7 2z"
    })), "Call"), React.createElement("a", {
      href: v.person?.wa,
      target: "_blank",
      rel: "noopener",
      style: {
        "display": "flex",
        "alignItems": "center",
        "justifyContent": "center",
        "gap": "8px",
        "border": "0",
        "borderRadius": "12px",
        "padding": "12px",
        "background": "#25d366",
        "color": "#fff",
        "fontSize": "13px",
        "fontWeight": "700",
        "cursor": "pointer",
        "textDecoration": "none",
        "boxShadow": "0 8px 20px rgba(37,211,102,.3)"
      }
    }, React.createElement("svg", {
      width: "17",
      height: "17",
      viewBox: "0 0 24 24",
      fill: "currentColor"
    }, React.createElement("path", {
      d: "M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.5-.6c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.2-.3-.2-.6-.3zM12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1112 20.2z"
    })), "WhatsApp")) : null, React.createElement("button", {
      onClick: v.msgPerson,
      style: {
        "display": "flex",
        "alignItems": "center",
        "justifyContent": "center",
        "gap": "8px",
        "border": "0",
        "borderRadius": "12px",
        "padding": "12px",
        "background": "linear-gradient(140deg,#0aa0d4,#0072a3)",
        "color": "#fff",
        "fontSize": "13px",
        "fontWeight": "700",
        "cursor": "pointer",
        "boxShadow": "0 8px 20px rgba(0,144,202,.3)"
      }
    }, React.createElement("svg", {
      width: "16",
      height: "16",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M21 12a8 8 0 01-8 8H8l-5 3 1.5-4.5A8 8 0 1121 12z"
    })), "Message"))), React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "16px",
        "background": "rgba(255,255,255,.68)",
        "overflow": "hidden",
        "flexShrink": "0"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "12px",
        "padding": "12px 14px"
      }
    }, React.createElement("span", {
      style: {
        "display": "grid",
        "placeItems": "center",
        "width": "34px",
        "height": "34px",
        "borderRadius": "10px",
        "background": "rgba(43,182,115,.12)",
        "color": "#1d8f57"
      }
    }, React.createElement("svg", {
      width: "16",
      height: "16",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1.9.4 1.8.7 2.6a2 2 0 01-.5 2.1L8 9.7a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.4c.8.3 1.7.5 2.6.7a2 2 0 011.7 2z"
    }))), React.createElement("span", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "10px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Mobile"), React.createElement("a", {
      href: v.person?.tel,
      style: {
        "display": "block",
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "14px",
        "fontWeight": "600",
        "marginTop": "1px",
        "color": "#0072a3",
        "textDecoration": "none"
      }
    }, ix(v.person?.phone))), React.createElement("a", {
      href: v.person?.telExt,
      style: {
        "display": "flex",
        "flexDirection": "column",
        "alignItems": "center",
        "gap": "1px",
        "border": "1px solid rgba(125,145,180,.3)",
        "borderRadius": "10px",
        "padding": "6px 10px",
        "textDecoration": "none",
        "color": "#16202e"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "9px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Ext."), React.createElement("span", {
      style: {
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "13px",
        "fontWeight": "700"
      }
    }, ix(v.person?.ext)))), React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "12px",
        "padding": "12px 14px",
        "borderTop": "1px solid rgba(125,145,180,.14)"
      }
    }, React.createElement("span", {
      style: {
        "display": "grid",
        "placeItems": "center",
        "width": "34px",
        "height": "34px",
        "borderRadius": "10px",
        "background": "rgba(0,144,202,.1)",
        "color": "#0072a3"
      }
    }, React.createElement("svg", {
      width: "16",
      height: "16",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zM22 6l-10 7L2 6"
    }))), React.createElement("span", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "10px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Email"), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "13px",
        "fontWeight": "600",
        "marginTop": "1px",
        "whiteSpace": "nowrap",
        "overflow": "hidden",
        "textOverflow": "ellipsis"
      }
    }, ix(v.person?.email)))), React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "12px",
        "padding": "12px 14px",
        "borderTop": "1px solid rgba(125,145,180,.14)"
      }
    }, React.createElement("span", {
      style: {
        "display": "grid",
        "placeItems": "center",
        "width": "34px",
        "height": "34px",
        "borderRadius": "10px",
        "background": "rgba(106,82,212,.1)",
        "color": "#6a52d4"
      }
    }, React.createElement("svg", {
      width: "16",
      height: "16",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("circle", {
      cx: "12",
      cy: "12",
      r: "9"
    }), React.createElement("path", {
      d: "M12 7v5l3 2"
    }))), React.createElement("span", {
      style: {
        "flex": "1"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "10px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Shift today"), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "13px",
        "fontWeight": "600",
        "marginTop": "1px"
      }
    }, ix(v.person?.shiftLabel))))), React.createElement("div", {
      style: {
        "display": "grid",
        "gridTemplateColumns": "1fr 1fr",
        "gap": "8px"
      }
    }, (Array.isArray(v.personFacts) ? v.personFacts : []).map((f, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "13px",
        "padding": "10px 12px",
        "background": "rgba(255,255,255,.65)"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "10px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, ix(f?.label)), React.createElement("div", {
      style: {
        "fontSize": "13px",
        "fontWeight": "700",
        "marginTop": "3px",
        "fontFamily": "'IBM Plex Mono',monospace"
      }
    }, ix(f?.v)))))), v.personRooms ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "6px"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Shared rooms"), (Array.isArray(v.personRooms) ? v.personRooms : []).map((r, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: r?.go,
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px",
        "textAlign": "left",
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "13px",
        "padding": "10px 12px",
        "background": "rgba(255,255,255,.65)",
        "cursor": "pointer",
        "color": "#16202e"
      }
    }, React.createElement("span", {
      style: {
        "display": "grid",
        "placeItems": "center",
        "width": "32px",
        "height": "32px",
        "borderRadius": "10px",
        "color": "#fff",
        "fontSize": "10.5px",
        "fontWeight": "700",
        "background": "linear-gradient(135deg,#0d2a4a,#0a5f87)"
      }
    }, ix(r?.members)), React.createElement("span", {
      style: {
        "flex": "1",
        "fontSize": "13px",
        "fontWeight": "700"
      }
    }, ix(r?.name)), React.createElement("svg", {
      width: "16",
      height: "16",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "#9aa6b4",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M9 6l6 6-6 6"
    }))))))) : null)) : null;
  }
  function Screen_sReports(v) {
    return v.sReports ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "flex": "1",
        "minHeight": "0",
        "display": "flex",
        "flexDirection": "column",
        "animation": "pop .3s ease backwards"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px",
        "padding": "12px 16px 0",
        "flexShrink": "0"
      }
    }, React.createElement("button", {
      onClick: v.openDrawer,
      style: {
        "width": "38px",
        "height": "38px",
        "borderRadius": "11px",
        "border": "1px solid rgba(255,255,255,.9)",
        "background": "rgba(255,255,255,.6)",
        "display": "grid",
        "placeItems": "center",
        "color": "#3c4858",
        "cursor": "pointer",
        "flexShrink": "0"
      }
    }, React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round"
    }, React.createElement("path", {
      d: "M4 7h16M4 12h16M4 17h10"
    }))), React.createElement("div", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "19px",
        "fontWeight": "800",
        "letterSpacing": "-.3px"
      }
    }, "Reports"), React.createElement("div", {
      style: {
        "fontSize": "12px",
        "color": "#6c7a8c"
      }
    }, ix(v.dept), " · ", ix(v.periodLabel))), React.createElement("button", {
      onClick: v.toggleSimple,
      title: "Simple view",
      style: S(v.simpleBtnStyle)
    }, React.createElement("svg", {
      width: "17",
      height: "17",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M4 6h16M4 12h10M4 18h6"
    }))), React.createElement("button", {
      onClick: v.openShare,
      title: "Share",
      style: {
        "width": "38px",
        "height": "38px",
        "borderRadius": "11px",
        "border": "0",
        "background": "linear-gradient(140deg,#0aa0d4,#0072a3)",
        "display": "grid",
        "placeItems": "center",
        "color": "#fff",
        "cursor": "pointer",
        "boxShadow": "0 6px 16px rgba(0,144,202,.3)"
      }
    }, React.createElement("svg", {
      width: "17",
      height: "17",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13"
    })))), React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "8px",
        "padding": "8px 16px 0",
        "flexShrink": "0"
      }
    }, React.createElement("span", {
      style: {
        "width": "7px",
        "height": "7px",
        "borderRadius": "50%",
        "background": "#3ddc97",
        "animation": "livepulse 2.4s infinite"
      }
    }), React.createElement("span", {
      style: {
        "fontSize": "11px",
        "color": "#6c7a8c"
      }
    }, "Updated ", ix(v.repUpdated), " · live from ward registers"), React.createElement("span", {
      style: {
        "flex": "1"
      }
    }), React.createElement("button", {
      onClick: v.refreshReports,
      style: {
        "border": "0",
        "background": "none",
        "color": "#0072a3",
        "fontSize": "11.5px",
        "fontWeight": "700",
        "cursor": "pointer",
        "padding": "0",
        "display": "inline-flex",
        "alignItems": "center",
        "gap": "4px"
      }
    }, React.createElement("svg", {
      width: "12",
      height: "12",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.4",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      style: S(v.refreshSpin)
    }, React.createElement("path", {
      d: "M21 12a9 9 0 11-3-6.7M21 3v6h-6"
    })), "Refresh")), React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "6px",
        "overflowX": "auto",
        "padding": "10px 16px 0",
        "scrollbarWidth": "none",
        "flexShrink": "0"
      }
    }, (Array.isArray(v.periodOpts) ? v.periodOpts : []).map((p, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: p?.go,
      style: S(p?.style)
    }, ix(p?.label)))), React.createElement("span", {
      style: {
        "width": "1px",
        "background": "rgba(125,145,180,.3)",
        "flexShrink": "0",
        "margin": "4px 2px"
      }
    }), React.createElement("button", {
      onClick: v.toggleCompare,
      style: S(v.compareStyle)
    }, "Compare with previous")), React.createElement("div", {
      style: {
        "display": "grid",
        "gridTemplateColumns": "repeat(5,1fr)",
        "margin": "10px 16px 0",
        "background": "rgba(255,255,255,.55)",
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "11px",
        "padding": "3px",
        "gap": "2px",
        "flexShrink": "0"
      }
    }, (Array.isArray(v.repTabs) ? v.repTabs : []).map((t, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: t?.go,
      style: S(t?.style)
    }, ix(t?.label))))), v.exportToast ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "margin": "10px 16px 0",
        "display": "flex",
        "alignItems": "center",
        "gap": "8px",
        "borderRadius": "12px",
        "padding": "10px 12px",
        "background": "rgba(43,182,115,.13)",
        "color": "#1d8f57",
        "fontSize": "12.5px",
        "fontWeight": "700",
        "flexShrink": "0",
        "animation": "pop .25s ease"
      }
    }, React.createElement("svg", {
      width: "15",
      height: "15",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.4",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M20 6L9 17l-5-5"
    })), ix(v.exportToast))) : null, React.createElement("div", {
      style: {
        "flex": "1",
        "minHeight": "0",
        "overflow": "auto",
        "padding": "12px 16px 20px",
        "display": "flex",
        "flexDirection": "column",
        "gap": "12px"
      }
    }, v.repSimple ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "10px"
      }
    }, (Array.isArray(v.simpleTiles) ? v.simpleTiles : []).map((t, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: t?.go,
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "16px",
        "textAlign": "left",
        "border": "1px solid rgba(255,255,255,.92)",
        "borderRadius": "20px",
        "padding": "20px 18px",
        "background": "rgba(255,255,255,.72)",
        "boxShadow": "0 12px 32px rgba(31,59,90,.1)",
        "cursor": "pointer",
        "color": "#16202e"
      }
    }, React.createElement("span", {
      style: S(`display:grid;place-items:center;width:54px;height:54px;border-radius:16px;color:${t?.color ?? ""};background:${t?.bg ?? ""};flex-shrink:0`)
    }, React.createElement("svg", {
      width: "26",
      height: "26",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: t?.d
    }))), React.createElement("span", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "13px",
        "fontWeight": "700",
        "color": "#6c7a8c"
      }
    }, ix(t?.label)), React.createElement("span", {
      style: S(`display:block;font-family:'IBM Plex Mono',monospace;font-size:40px;font-weight:600;line-height:1.05;letter-spacing:-1px;color:${t?.color ?? ""}`)
    }, ix(t?.v)), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "13px",
        "color": "#3c4858",
        "marginTop": "2px"
      }
    }, ix(t?.note)))))), React.createElement("div", {
      style: {
        "textAlign": "center",
        "fontSize": "12px",
        "color": "#7d8ea8",
        "padding": "6px"
      }
    }, "Simple view · tap the list icon to see full charts"))) : null, v.repOverview ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "16px",
        "padding": "13px 14px",
        "background": "linear-gradient(140deg,rgba(0,144,202,.1),rgba(58,181,167,.08),rgba(255,255,255,.7))",
        "display": "flex",
        "flexDirection": "column",
        "gap": "8px"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "8px"
      }
    }, React.createElement("span", {
      style: {
        "display": "grid",
        "placeItems": "center",
        "width": "26px",
        "height": "26px",
        "borderRadius": "8px",
        "background": "rgba(0,144,202,.16)",
        "color": "#0072a3"
      }
    }, React.createElement("svg", {
      width: "14",
      height: "14",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8zM19 16l.9 2.1L22 19l-2.1.9L19 22l-.9-2.1L16 19l2.1-.9z"
    }))), React.createElement("span", {
      style: {
        "fontSize": "13px",
        "fontWeight": "800"
      }
    }, "In plain words · ", ix(v.periodLabel))), (Array.isArray(v.insights) ? v.insights : []).map((i, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "flex-start",
        "gap": "8px"
      }
    }, React.createElement("span", {
      style: S(i?.dot)
    }), React.createElement("span", {
      style: {
        "flex": "1",
        "fontSize": "12.5px",
        "lineHeight": "1.5",
        "color": "#16202e",
        "textWrap": "pretty"
      }
    }, ix(i?.text)), i?.action ? React.createElement(React.Fragment, null, React.createElement("button", {
      onClick: i?.go,
      style: {
        "border": "0",
        "background": "none",
        "color": "#0072a3",
        "fontSize": "11.5px",
        "fontWeight": "700",
        "cursor": "pointer",
        "padding": "0",
        "whiteSpace": "nowrap"
      }
    }, ix(i?.action))) : null)))), React.createElement("div", {
      style: {
        "display": "grid",
        "gridTemplateColumns": "1fr 1fr",
        "gap": "8px"
      }
    }, (Array.isArray(v.repKpis) ? v.repKpis : []).map((k, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: k?.go,
      style: S(k?.style)
    }, React.createElement("span", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "4px",
        "width": "100%"
      }
    }, React.createElement("span", {
      style: {
        "flex": "1",
        "fontSize": "10px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, ix(k?.label)), React.createElement("span", {
      onClick: k?.pin,
      title: "Pin to top",
      style: S(k?.pinStyle)
    }, React.createElement("svg", {
      width: "12",
      height: "12",
      viewBox: "0 0 24 24",
      fill: k?.pinFill,
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"
    })))), React.createElement("span", {
      style: {
        "display": "flex",
        "alignItems": "baseline",
        "gap": "6px"
      }
    }, React.createElement("span", {
      style: {
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "24px",
        "fontWeight": "600",
        "lineHeight": "1"
      }
    }, ix(k?.v)), React.createElement("span", {
      style: S(k?.deltaStyle)
    }, ix(k?.delta))), React.createElement("span", {
      style: {
        "display": "flex",
        "alignItems": "flex-end",
        "gap": "2px",
        "height": "22px",
        "width": "100%"
      }
    }, (Array.isArray(k?.spark) ? k?.spark : []).map((b, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("span", {
      style: S(b)
    })))), React.createElement("span", {
      style: {
        "fontSize": "10.5px",
        "color": "#6c7a8c"
      }
    }, ix(k?.note)))))), React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "16px",
        "padding": "14px",
        "background": "rgba(255,255,255,.68)",
        "display": "flex",
        "flexDirection": "column",
        "gap": "10px"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "justifyContent": "space-between",
        "flexWrap": "wrap",
        "gap": "6px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Daily census · last 7 days"), React.createElement("span", {
      style: {
        "display": "flex",
        "gap": "10px",
        "fontSize": "10.5px",
        "color": "#6c7a8c"
      }
    }, React.createElement("span", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "4px"
      }
    }, React.createElement("span", {
      style: {
        "width": "8px",
        "height": "8px",
        "borderRadius": "2px",
        "background": "#0090ca"
      }
    }), "Admissions"), React.createElement("span", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "4px"
      }
    }, React.createElement("span", {
      style: {
        "width": "8px",
        "height": "8px",
        "borderRadius": "2px",
        "background": "#3ab5a7"
      }
    }), "Discharges"), v.compareOn ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "4px"
      }
    }, React.createElement("span", {
      style: {
        "width": "8px",
        "height": "8px",
        "borderRadius": "2px",
        "background": "rgba(125,145,180,.45)"
      }
    }), "Previous week")) : null)), React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "flex-end",
        "gap": "6px",
        "height": "110px"
      }
    }, (Array.isArray(v.censusBars) ? v.censusBars : []).map((d, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: d?.go,
      title: d?.tip,
      style: S(d?.colStyle)
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "flex-end",
        "gap": "2px",
        "flex": "1",
        "width": "100%",
        "justifyContent": "center"
      }
    }, v.compareOn ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: S(d?.p)
    })) : null, React.createElement("span", {
      style: S(d?.a)
    }), React.createElement("span", {
      style: S(d?.b)
    })), React.createElement("span", {
      style: {
        "fontSize": "10px",
        "fontWeight": "700",
        "color": "#7d8ea8"
      }
    }, ix(d?.label)))))), v.censusTip ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "8px",
        "borderRadius": "10px",
        "padding": "8px 11px",
        "background": "rgba(0,144,202,.08)",
        "fontSize": "12px",
        "color": "#16202e",
        "animation": "pop .2s ease"
      }
    }, React.createElement("b", null, ix(v.censusTip)))) : null), React.createElement("div", {
      style: {
        "display": "grid",
        "gridTemplateColumns": "1fr 1fr",
        "gap": "8px"
      }
    }, React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "16px",
        "padding": "14px",
        "background": "rgba(255,255,255,.68)",
        "display": "flex",
        "flexDirection": "column",
        "alignItems": "center",
        "gap": "8px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#7d8ea8",
        "alignSelf": "flex-start"
      }
    }, "Delivery mix"), React.createElement("div", {
      style: {
        "position": "relative",
        "width": "96px",
        "height": "96px"
      }
    }, React.createElement("svg", {
      width: "96",
      height: "96",
      viewBox: "0 0 96 96",
      style: {
        "transform": "rotate(-90deg)"
      }
    }, React.createElement("circle", {
      cx: "48",
      cy: "48",
      r: "40",
      fill: "none",
      stroke: "rgba(58,181,167,.85)",
      strokeWidth: "12"
    }), React.createElement("circle", {
      cx: "48",
      cy: "48",
      r: "40",
      fill: "none",
      stroke: "#0090ca",
      strokeWidth: "12",
      strokeDasharray: v.csDash
    })), React.createElement("div", {
      style: {
        "position": "absolute",
        "inset": "0",
        "display": "grid",
        "placeItems": "center",
        "textAlign": "center"
      }
    }, React.createElement("div", null, React.createElement("div", {
      style: {
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "18px",
        "fontWeight": "600",
        "lineHeight": "1"
      }
    }, ix(v.csRate)), React.createElement("div", {
      style: {
        "fontSize": "9px",
        "color": "#7d8ea8",
        "fontWeight": "700"
      }
    }, "CS RATE")))), React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "3px",
        "width": "100%",
        "fontSize": "11px"
      }
    }, React.createElement("span", {
      style: {
        "display": "flex",
        "justifyContent": "space-between"
      }
    }, React.createElement("span", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "5px",
        "color": "#3c4858"
      }
    }, React.createElement("span", {
      style: {
        "width": "8px",
        "height": "8px",
        "borderRadius": "2px",
        "background": "#0090ca"
      }
    }), "Caesarean"), React.createElement("b", {
      style: {
        "fontFamily": "'IBM Plex Mono',monospace"
      }
    }, ix(v.csCount))), React.createElement("span", {
      style: {
        "display": "flex",
        "justifyContent": "space-between"
      }
    }, React.createElement("span", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "5px",
        "color": "#3c4858"
      }
    }, React.createElement("span", {
      style: {
        "width": "8px",
        "height": "8px",
        "borderRadius": "2px",
        "background": "#3ab5a7"
      }
    }), "Normal (NVD)"), React.createElement("b", {
      style: {
        "fontFamily": "'IBM Plex Mono',monospace"
      }
    }, ix(v.nvdCount))))), React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "16px",
        "padding": "14px",
        "background": "rgba(255,255,255,.68)",
        "display": "flex",
        "flexDirection": "column",
        "gap": "8px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Bed occupancy"), React.createElement("div", {
      style: {
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "26px",
        "fontWeight": "600",
        "lineHeight": "1"
      }
    }, ix(v.occAvg)), React.createElement("div", {
      style: {
        "fontSize": "10.5px",
        "color": "#6c7a8c"
      }
    }, "avg · ", ix(v.bedsUsed), " of ", ix(v.bedsTotal), " beds now"), React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "4px",
        "marginTop": "2px"
      }
    }, (Array.isArray(v.occRows) ? v.occRows : []).map((o, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "6px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10px",
        "fontWeight": "700",
        "color": "#7d8ea8",
        "width": "26px"
      }
    }, ix(o?.label)), React.createElement("div", {
      style: {
        "flex": "1",
        "height": "6px",
        "borderRadius": "999px",
        "background": "rgba(125,145,180,.18)",
        "overflow": "hidden",
        "flexShrink": "0"
      }
    }, React.createElement("div", {
      style: S(o?.bar)
    })), React.createElement("span", {
      style: {
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "10px",
        "fontWeight": "700",
        "width": "30px",
        "textAlign": "right"
      }
    }, ix(o?.v)))))))), React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "8px"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "justifyContent": "space-between"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Quality indicators · needs attention"), React.createElement("button", {
      onClick: v.goRepQuality,
      style: {
        "border": "0",
        "background": "none",
        "color": "#0072a3",
        "fontSize": "12px",
        "fontWeight": "700",
        "cursor": "pointer",
        "padding": "0"
      }
    }, "All ", ix(v.indicatorCount))), (Array.isArray(v.indicatorsAlert) ? v.indicatorsAlert : []).map((q, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: q?.go,
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "11px",
        "textAlign": "left",
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "14px",
        "padding": "11px 13px",
        "background": "rgba(255,255,255,.66)",
        "cursor": "pointer",
        "color": "#16202e"
      }
    }, React.createElement("span", {
      style: S(q?.dot)
    }), React.createElement("span", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "13px",
        "fontWeight": "700"
      }
    }, ix(q?.name)), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "11px",
        "color": "#6c7a8c"
      }
    }, "Benchmark ", ix(q?.bench))), React.createElement("span", {
      style: S(`font-family:'IBM Plex Mono',monospace;font-size:15px;font-weight:600;color:${q?.color ?? ""}`)
    }, ix(q?.v)), React.createElement("svg", {
      width: "16",
      height: "16",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "#9aa6b4",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M9 6l6 6-6 6"
    })))))), React.createElement("button", {
      onClick: v.goShiftReport,
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "12px",
        "textAlign": "left",
        "border": "1px solid rgba(0,144,202,.3)",
        "borderRadius": "16px",
        "padding": "12px 14px",
        "background": "linear-gradient(140deg,rgba(0,144,202,.12),rgba(255,255,255,.7))",
        "cursor": "pointer",
        "color": "#16202e"
      }
    }, React.createElement("span", {
      style: {
        "display": "grid",
        "placeItems": "center",
        "width": "40px",
        "height": "40px",
        "borderRadius": "12px",
        "background": "rgba(0,144,202,.14)",
        "color": "#0072a3"
      }
    }, React.createElement("svg", {
      width: "19",
      height: "19",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8"
    }))), React.createElement("span", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "14px",
        "fontWeight": "800"
      }
    }, ix(v.shiftReportTitle)), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "12px",
        "color": "#6c7a8c"
      }
    }, ix(v.shiftReportSub))), React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "#9aa6b4",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M9 6l6 6-6 6"
    })))) : null, v.repCensus ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "grid",
        "gridTemplateColumns": "repeat(3,1fr)",
        "gap": "8px"
      }
    }, (Array.isArray(v.censusTiles) ? v.censusTiles : []).map((c, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "13px",
        "padding": "11px 10px",
        "background": "rgba(255,255,255,.66)"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "9.5px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, ix(c?.label)), React.createElement("div", {
      style: S(`font-family:'IBM Plex Mono',monospace;font-size:20px;font-weight:600;margin-top:5px;line-height:1;color:${c?.color ?? ""}`)
    }, ix(c?.v)))))), React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "16px",
        "background": "rgba(255,255,255,.68)",
        "overflow": "hidden",
        "flexShrink": "0"
      }
    }, React.createElement("div", {
      style: {
        "display": "grid",
        "gridTemplateColumns": "1.2fr repeat(4,1fr)",
        "gap": "4px",
        "padding": "10px 12px",
        "fontSize": "9.5px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8",
        "borderBottom": "1px solid rgba(125,145,180,.14)"
      }
    }, React.createElement("span", null, "Day"), React.createElement("span", {
      style: {
        "textAlign": "right"
      }
    }, "Adm"), React.createElement("span", {
      style: {
        "textAlign": "right"
      }
    }, "Dis"), React.createElement("span", {
      style: {
        "textAlign": "right"
      }
    }, "NVD"), React.createElement("span", {
      style: {
        "textAlign": "right"
      }
    }, "CS")), (Array.isArray(v.censusTable) ? v.censusTable : []).map((r, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: S(r?.style)
    }, React.createElement("span", {
      style: {
        "fontWeight": "700"
      }
    }, ix(r?.day)), React.createElement("span", {
      style: {
        "textAlign": "right",
        "fontFamily": "'IBM Plex Mono',monospace"
      }
    }, ix(r?.adm)), React.createElement("span", {
      style: {
        "textAlign": "right",
        "fontFamily": "'IBM Plex Mono',monospace"
      }
    }, ix(r?.dis)), React.createElement("span", {
      style: {
        "textAlign": "right",
        "fontFamily": "'IBM Plex Mono',monospace"
      }
    }, ix(r?.nvd)), React.createElement("span", {
      style: {
        "textAlign": "right",
        "fontFamily": "'IBM Plex Mono',monospace"
      }
    }, ix(r?.cs)))))), React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "16px",
        "padding": "14px",
        "background": "rgba(255,255,255,.68)",
        "display": "flex",
        "flexDirection": "column",
        "gap": "10px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Occupancy trend · %"), React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "flex-end",
        "gap": "6px",
        "position": "relative"
      }
    }, React.createElement("div", {
      style: {
        "position": "absolute",
        "left": "0",
        "right": "0",
        "bottom": "77.5px",
        "borderTop": "1.5px dashed rgba(210,58,82,.6)"
      }
    }), (Array.isArray(v.occBars) ? v.occBars : []).map((o, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "flex": "1",
        "display": "flex",
        "flexDirection": "column",
        "alignItems": "center"
      }
    }, React.createElement("span", {
      style: {
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "9.5px",
        "fontWeight": "700",
        "color": "#3c4858",
        "height": "14px",
        "lineHeight": "14px"
      }
    }, ix(o?.v)), React.createElement("span", {
      style: {
        "display": "flex",
        "alignItems": "flex-end",
        "justifyContent": "center",
        "height": "70px",
        "width": "100%"
      }
    }, React.createElement("span", {
      style: S(o?.bar)
    })), React.createElement("span", {
      style: {
        "fontSize": "10px",
        "fontWeight": "700",
        "color": "#7d8ea8",
        "height": "14px",
        "lineHeight": "14px",
        "marginTop": "4px"
      }
    }, ix(o?.label)))))), React.createElement("span", {
      style: {
        "fontSize": "10.5px",
        "color": "#6c7a8c"
      }
    }, "Dashed line = 85% safe-capacity threshold"))) : null, v.repQuality ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "grid",
        "gridTemplateColumns": "repeat(3,1fr)",
        "gap": "8px"
      }
    }, (Array.isArray(v.ragSummary) ? v.ragSummary : []).map((r, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "13px",
        "padding": "11px 10px",
        "background": "rgba(255,255,255,.66)",
        "display": "flex",
        "alignItems": "center",
        "gap": "9px"
      }
    }, React.createElement("span", {
      style: S(r?.dot)
    }), React.createElement("span", null, React.createElement("span", {
      style: {
        "display": "block",
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "20px",
        "fontWeight": "600",
        "lineHeight": "1"
      }
    }, ix(r?.n)), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "10px",
        "fontWeight": "700",
        "color": "#7d8ea8",
        "marginTop": "3px"
      }
    }, ix(r?.label))))))), React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "8px"
      }
    }, (Array.isArray(v.indicators) ? v.indicators : []).map((q, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: q?.go,
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "11px",
        "textAlign": "left",
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "14px",
        "padding": "11px 13px",
        "background": "rgba(255,255,255,.66)",
        "cursor": "pointer",
        "color": "#16202e"
      }
    }, React.createElement("span", {
      style: S(q?.dot)
    }), React.createElement("span", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "13px",
        "fontWeight": "700"
      }
    }, ix(q?.name)), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "11px",
        "color": "#6c7a8c"
      }
    }, "Benchmark ", ix(q?.bench), " · ", ix(q?.unit))), React.createElement("span", {
      style: {
        "display": "flex",
        "alignItems": "flex-end",
        "gap": "2px",
        "height": "20px",
        "width": "44px"
      }
    }, (Array.isArray(q?.spark) ? q?.spark : []).map((b, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("span", {
      style: S(b)
    })))), React.createElement("span", {
      style: S(`font-family:'IBM Plex Mono',monospace;font-size:15px;font-weight:600;min-width:44px;text-align:right;color:${q?.color ?? ""}`)
    }, ix(q?.v)), React.createElement("span", {
      onClick: q?.info,
      title: "What does this mean?",
      style: {
        "display": "grid",
        "placeItems": "center",
        "width": "26px",
        "height": "26px",
        "borderRadius": "8px",
        "border": "1px solid rgba(125,145,180,.3)",
        "background": "rgba(255,255,255,.7)",
        "color": "#6c7a8c",
        "flexShrink": "0",
        "cursor": "pointer"
      }
    }, React.createElement("svg", {
      width: "13",
      height: "13",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("circle", {
      cx: "12",
      cy: "12",
      r: "9"
    }), React.createElement("path", {
      d: "M12 16v-4M12 8h.01"
    })))))))) : null, v.repStaffing ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "grid",
        "gridTemplateColumns": "repeat(3,1fr)",
        "gap": "8px"
      }
    }, (Array.isArray(v.staffTiles) ? v.staffTiles : []).map((c, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "13px",
        "padding": "11px 10px",
        "background": "rgba(255,255,255,.66)"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "9.5px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, ix(c?.label)), React.createElement("div", {
      style: S(`font-family:'IBM Plex Mono',monospace;font-size:20px;font-weight:600;margin-top:5px;line-height:1;color:${c?.color ?? ""}`)
    }, ix(c?.v)), React.createElement("div", {
      style: {
        "fontSize": "10px",
        "color": "#6c7a8c",
        "marginTop": "3px"
      }
    }, ix(c?.note)))))), React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "16px",
        "padding": "14px",
        "background": "rgba(255,255,255,.68)",
        "display": "flex",
        "flexDirection": "column",
        "gap": "12px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Planned vs actual · today"), (Array.isArray(v.staffShifts) ? v.staffShifts : []).map((sh, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "5px"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "8px"
      }
    }, React.createElement("span", {
      style: S(sh?.codeStyle)
    }, ix(sh?.code)), React.createElement("span", {
      style: {
        "flex": "1",
        "fontSize": "12.5px",
        "fontWeight": "600"
      }
    }, ix(sh?.name)), React.createElement("span", {
      style: S(`font-family:'IBM Plex Mono',monospace;font-size:12.5px;font-weight:700;color:${sh?.color ?? ""}`)
    }, ix(sh?.actual), " / ", ix(sh?.planned))), React.createElement("div", {
      style: {
        "height": "8px",
        "borderRadius": "999px",
        "background": "rgba(125,145,180,.18)",
        "overflow": "hidden",
        "position": "relative"
      }
    }, React.createElement("div", {
      style: S(sh?.bar)
    })), sh?.gap ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: {
        "fontSize": "11px",
        "color": "#b32e2e",
        "fontWeight": "600"
      }
    }, ix(sh?.gap))) : null)))), React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "16px",
        "background": "rgba(255,255,255,.68)",
        "overflow": "hidden",
        "flexShrink": "0"
      }
    }, React.createElement("div", {
      style: {
        "padding": "12px 14px 6px",
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Absence & leave · this week"), (Array.isArray(v.absenceRows) ? v.absenceRows : []).map((a, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px",
        "padding": "10px 14px",
        "borderTop": "1px solid rgba(125,145,180,.14)"
      }
    }, React.createElement("span", {
      style: {
        "display": "grid",
        "placeItems": "center",
        "width": "30px",
        "height": "30px",
        "borderRadius": "9px",
        "color": "#fff",
        "fontSize": "10.5px",
        "fontWeight": "700",
        "background": "linear-gradient(135deg,#3ab5a7,#0090ca)"
      }
    }, ix(a?.ini)), React.createElement("span", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "12.5px",
        "fontWeight": "600"
      }
    }, ix(a?.name)), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "11px",
        "color": "#6c7a8c"
      }
    }, ix(a?.detail))), React.createElement("span", {
      style: S(a?.tagStyle)
    }, ix(a?.tag))))))) : null, v.repSubmitted ? React.createElement(React.Fragment, null, React.createElement("button", {
      onClick: v.goShiftReport,
      style: {
        "display": "flex",
        "alignItems": "center",
        "justifyContent": "center",
        "gap": "8px",
        "border": "1px dashed rgba(0,144,202,.5)",
        "borderRadius": "14px",
        "padding": "13px",
        "background": "rgba(0,144,202,.06)",
        "color": "#0072a3",
        "fontSize": "13px",
        "fontWeight": "700",
        "cursor": "pointer"
      }
    }, React.createElement("svg", {
      width: "15",
      height: "15",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.4",
      strokeLinecap: "round"
    }, React.createElement("path", {
      d: "M12 5v14M5 12h14"
    })), "New shift report"), React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "8px"
      }
    }, (Array.isArray(v.submittedReports) ? v.submittedReports : []).map((r, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: r?.go,
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "11px",
        "textAlign": "left",
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "14px",
        "padding": "11px 13px",
        "background": "rgba(255,255,255,.66)",
        "cursor": "pointer",
        "color": "#16202e"
      }
    }, React.createElement("span", {
      style: S(r?.codeStyle)
    }, ix(r?.shift)), React.createElement("span", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "13px",
        "fontWeight": "700"
      }
    }, ix(r?.date), " · ", ix(r?.shiftName)), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "11px",
        "color": "#6c7a8c"
      }
    }, ix(r?.meta))), React.createElement("span", {
      style: S(r?.statusStyle)
    }, ix(r?.status))))))) : null)), v.shareOpen ? React.createElement(React.Fragment, null, React.createElement("div", {
      onClick: v.closeShare,
      style: {
        "position": "absolute",
        "inset": "0",
        "zIndex": "20",
        "background": "rgba(13,28,50,.45)",
        "animation": "fadeIn .2s ease"
      }
    }), React.createElement("div", {
      style: {
        "position": "absolute",
        "left": "0",
        "right": "0",
        "bottom": "0",
        "zIndex": "21",
        "background": "rgba(255,255,255,.97)",
        "borderRadius": "22px 22px 0 0",
        "padding": "14px 18px 22px",
        "boxShadow": "0 -18px 50px rgba(31,59,90,.25)",
        "display": "flex",
        "flexDirection": "column",
        "gap": "12px",
        "animation": "pop .28s cubic-bezier(.2,.7,.3,1)"
      }
    }, React.createElement("div", {
      style: {
        "width": "40px",
        "height": "4px",
        "borderRadius": "2px",
        "background": "rgba(125,145,180,.4)",
        "alignSelf": "center"
      }
    }), React.createElement("div", null, React.createElement("div", {
      style: {
        "fontSize": "16px",
        "fontWeight": "800"
      }
    }, "Share report"), React.createElement("div", {
      style: {
        "fontSize": "12px",
        "color": "#6c7a8c"
      }
    }, ix(v.dept), " · ", ix(v.periodLabel), " · ", ix(v.repTabName))), React.createElement("div", {
      style: {
        "display": "grid",
        "gridTemplateColumns": "repeat(4,1fr)",
        "gap": "8px"
      }
    }, (Array.isArray(v.shareOpts) ? v.shareOpts : []).map((o, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: o?.go,
      style: {
        "display": "flex",
        "flexDirection": "column",
        "alignItems": "center",
        "gap": "7px",
        "border": "1px solid rgba(125,145,180,.2)",
        "borderRadius": "14px",
        "padding": "12px 4px 10px",
        "background": "rgba(255,255,255,.9)",
        "cursor": "pointer",
        "color": "#16202e"
      }
    }, React.createElement("span", {
      style: S(`display:grid;place-items:center;width:40px;height:40px;border-radius:12px;color:${o?.color ?? ""};background:${o?.bg ?? ""}`)
    }, React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: o?.d
    }))), React.createElement("span", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "textAlign": "center",
        "lineHeight": "1.2"
      }
    }, ix(o?.label)))))), React.createElement("div", {
      style: {
        "border": "1px solid rgba(125,145,180,.2)",
        "borderRadius": "14px",
        "background": "rgba(255,255,255,.9)",
        "overflow": "hidden",
        "flexShrink": "0"
      }
    }, (Array.isArray(v.scheduleOpts) ? v.scheduleOpts : []).map((o, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "12px",
        "padding": "12px 14px",
        "borderTop": "1px solid rgba(125,145,180,.14)"
      }
    }, React.createElement("span", {
      style: {
        "flex": "1"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "13.5px",
        "fontWeight": "600"
      }
    }, ix(o?.label)), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "11.5px",
        "color": "#6c7a8c"
      }
    }, ix(o?.sub))), React.createElement("button", {
      onClick: o?.go,
      style: S(o?.track)
    }, React.createElement("span", {
      style: S(o?.knob)
    })))))), React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "5px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Summary text · tap to copy"), React.createElement("button", {
      onClick: v.copySummary,
      style: {
        "textAlign": "left",
        "border": "1px solid rgba(125,145,180,.25)",
        "borderRadius": "12px",
        "padding": "10px 12px",
        "background": "rgba(125,145,180,.08)",
        "fontSize": "12px",
        "lineHeight": "1.5",
        "color": "#3c4858",
        "cursor": "pointer",
        "fontFamily": "'IBM Plex Mono',monospace",
        "whiteSpace": "pre-line"
      }
    }, ix(v.summaryText))))) : null, v.infoOpen ? React.createElement(React.Fragment, null, React.createElement("div", {
      onClick: v.closeInfo,
      style: {
        "position": "absolute",
        "inset": "0",
        "zIndex": "20",
        "background": "rgba(13,28,50,.45)",
        "animation": "fadeIn .2s ease"
      }
    }), React.createElement("div", {
      style: {
        "position": "absolute",
        "left": "0",
        "right": "0",
        "bottom": "0",
        "zIndex": "21",
        "background": "rgba(255,255,255,.97)",
        "borderRadius": "22px 22px 0 0",
        "padding": "14px 18px 22px",
        "boxShadow": "0 -18px 50px rgba(31,59,90,.25)",
        "display": "flex",
        "flexDirection": "column",
        "gap": "12px",
        "animation": "pop .28s cubic-bezier(.2,.7,.3,1)"
      }
    }, React.createElement("div", {
      style: {
        "width": "40px",
        "height": "4px",
        "borderRadius": "2px",
        "background": "rgba(125,145,180,.4)",
        "alignSelf": "center"
      }
    }), React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px"
      }
    }, React.createElement("span", {
      style: S(v.infoInd?.dot)
    }), React.createElement("div", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "16px",
        "fontWeight": "800",
        "lineHeight": "1.2"
      }
    }, ix(v.infoInd?.name)), React.createElement("div", {
      style: {
        "fontSize": "12px",
        "color": "#6c7a8c"
      }
    }, ix(v.infoInd?.ragLabel), " · ", ix(v.infoInd?.v), " vs ", ix(v.infoInd?.bench)))), React.createElement("div", {
      style: {
        "borderRadius": "13px",
        "padding": "11px 13px",
        "background": "rgba(0,144,202,.07)"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "10px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "What it means"), React.createElement("div", {
      style: {
        "fontSize": "13px",
        "lineHeight": "1.55",
        "marginTop": "3px",
        "textWrap": "pretty"
      }
    }, ix(v.infoInd?.means))), React.createElement("div", {
      style: {
        "borderRadius": "13px",
        "padding": "11px 13px",
        "background": "rgba(58,181,167,.1)"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "10px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#1e8a7c"
      }
    }, "What you can do"), React.createElement("div", {
      style: {
        "fontSize": "13px",
        "lineHeight": "1.55",
        "marginTop": "3px",
        "textWrap": "pretty"
      }
    }, ix(v.infoInd?.action))), React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "6px"
      }
    }, React.createElement("button", {
      onClick: v.infoOpenDetail,
      style: {
        "flex": "1",
        "border": "0",
        "borderRadius": "12px",
        "padding": "12px",
        "background": "linear-gradient(140deg,#0aa0d4,#0072a3)",
        "color": "#fff",
        "fontSize": "13px",
        "fontWeight": "700",
        "cursor": "pointer"
      }
    }, "See trend & action plan"), React.createElement("button", {
      onClick: v.closeInfo,
      style: {
        "border": "1px solid rgba(125,145,180,.35)",
        "borderRadius": "12px",
        "padding": "12px 16px",
        "background": "rgba(255,255,255,.7)",
        "color": "#16202e",
        "fontSize": "13px",
        "fontWeight": "700",
        "cursor": "pointer"
      }
    }, "Close")))) : null) : null;
  }
  function Screen_sIndicator(v) {
    return v.sIndicator ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "flex": "1",
        "minHeight": "0",
        "overflow": "auto",
        "padding": "12px 16px 20px",
        "display": "flex",
        "flexDirection": "column",
        "gap": "12px",
        "animation": "pop .3s ease backwards"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px"
      }
    }, React.createElement("button", {
      onClick: v.goRepQuality,
      style: {
        "width": "38px",
        "height": "38px",
        "borderRadius": "11px",
        "border": "1px solid rgba(255,255,255,.9)",
        "background": "rgba(255,255,255,.6)",
        "display": "grid",
        "placeItems": "center",
        "color": "#3c4858",
        "cursor": "pointer"
      }
    }, React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M15 6l-6 6 6 6"
    }))), React.createElement("div", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "16px",
        "fontWeight": "800",
        "letterSpacing": "-.2px",
        "lineHeight": "1.2"
      }
    }, ix(v.ind?.name)), React.createElement("div", {
      style: {
        "fontSize": "12px",
        "color": "#6c7a8c"
      }
    }, ix(v.dept), " · ", ix(v.ind?.unit))), React.createElement("span", {
      style: S(v.ind?.ragStyle)
    }, ix(v.ind?.rag))), React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.92)",
        "borderRadius": "18px",
        "padding": "16px",
        "background": "rgba(255,255,255,.72)",
        "boxShadow": "0 12px 32px rgba(31,59,90,.1)",
        "display": "flex",
        "flexDirection": "column",
        "gap": "12px"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "flex-end",
        "gap": "14px"
      }
    }, React.createElement("div", null, React.createElement("div", {
      style: {
        "fontSize": "10px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "This month"), React.createElement("div", {
      style: S(`font-family:'IBM Plex Mono',monospace;font-size:34px;font-weight:600;line-height:1;margin-top:4px;color:${v.ind?.color ?? ""}`)
    }, ix(v.ind?.v))), React.createElement("div", {
      style: {
        "paddingBottom": "3px"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "10px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Benchmark"), React.createElement("div", {
      style: {
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "16px",
        "fontWeight": "600",
        "marginTop": "4px"
      }
    }, ix(v.ind?.bench))), React.createElement("span", {
      style: {
        "flex": "1"
      }
    }), React.createElement("div", {
      style: {
        "textAlign": "right",
        "paddingBottom": "3px"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "10px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "vs last month"), React.createElement("div", {
      style: S(v.ind?.deltaStyle)
    }, ix(v.ind?.delta)))), React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "flex-end",
        "gap": "6px",
        "position": "relative"
      }
    }, React.createElement("div", {
      style: S(v.ind?.benchLine)
    }), (Array.isArray(v.indBars) ? v.indBars : []).map((b, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "flex": "1",
        "display": "flex",
        "flexDirection": "column",
        "alignItems": "center"
      }
    }, React.createElement("span", {
      style: {
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "9.5px",
        "fontWeight": "700",
        "color": "#3c4858",
        "height": "14px",
        "lineHeight": "14px"
      }
    }, ix(b?.v)), React.createElement("span", {
      style: {
        "display": "flex",
        "alignItems": "flex-end",
        "justifyContent": "center",
        "height": "70px",
        "width": "100%"
      }
    }, React.createElement("span", {
      style: S(b?.bar)
    })), React.createElement("span", {
      style: {
        "fontSize": "10px",
        "fontWeight": "700",
        "color": "#7d8ea8",
        "height": "14px",
        "lineHeight": "14px",
        "marginTop": "4px"
      }
    }, ix(b?.label))))))), React.createElement("div", {
      style: {
        "display": "grid",
        "gridTemplateColumns": "1fr 1fr",
        "gap": "8px"
      }
    }, React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "13px",
        "padding": "10px 12px",
        "background": "rgba(255,255,255,.66)"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "10px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Numerator"), React.createElement("div", {
      style: {
        "fontSize": "12.5px",
        "fontWeight": "600",
        "marginTop": "3px",
        "lineHeight": "1.4"
      }
    }, ix(v.ind?.num)), React.createElement("div", {
      style: {
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "16px",
        "fontWeight": "600",
        "marginTop": "4px"
      }
    }, ix(v.ind?.numV))), React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "13px",
        "padding": "10px 12px",
        "background": "rgba(255,255,255,.66)"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "10px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Denominator"), React.createElement("div", {
      style: {
        "fontSize": "12.5px",
        "fontWeight": "600",
        "marginTop": "3px",
        "lineHeight": "1.4"
      }
    }, ix(v.ind?.den)), React.createElement("div", {
      style: {
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "16px",
        "fontWeight": "600",
        "marginTop": "4px"
      }
    }, ix(v.ind?.denV)))), React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "15px",
        "padding": "12px 14px",
        "background": "rgba(255,255,255,.66)"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "10px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Formula"), React.createElement("div", {
      style: {
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "12px",
        "marginTop": "5px",
        "lineHeight": "1.5",
        "color": "#16202e"
      }
    }, ix(v.ind?.formula))), React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "8px"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "justifyContent": "space-between"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Action plan (CAPA)"), React.createElement("span", {
      style: {
        "fontSize": "11px",
        "color": "#6c7a8c"
      }
    }, ix(v.capaDone))), (Array.isArray(v.capaItems) ? v.capaItems : []).map((c, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "flex-start",
        "gap": "10px",
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "13px",
        "padding": "11px 12px",
        "background": "rgba(255,255,255,.66)"
      }
    }, React.createElement("button", {
      onClick: c?.toggle,
      style: S(c?.box)
    }, c?.done ? React.createElement(React.Fragment, null, React.createElement("svg", {
      width: "12",
      height: "12",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "#fff",
      strokeWidth: "3",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M20 6L9 17l-5-5"
    }))) : null), React.createElement("span", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("span", {
      style: S(c?.textStyle)
    }, ix(c?.text)), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "11px",
        "color": "#6c7a8c",
        "marginTop": "2px"
      }
    }, ix(c?.owner), " · due ", ix(c?.due)))))), React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "8px"
      }
    }, React.createElement("input", {
      value: vx(v.capaDraft),
      onChange: v.setCapaDraft,
      placeholder: "Add a corrective action",
      style: {
        "flex": "1",
        "minWidth": "0",
        "border": "1px solid rgba(125,145,180,.3)",
        "borderRadius": "12px",
        "padding": "10px 13px",
        "fontSize": "13.5px",
        "background": "rgba(255,255,255,.85)",
        "outline": "none"
      }
    }), React.createElement("button", {
      onClick: v.addCapa,
      style: {
        "width": "38px",
        "height": "38px",
        "borderRadius": "11px",
        "border": "0",
        "background": "linear-gradient(140deg,#0aa0d4,#0072a3)",
        "color": "#fff",
        "display": "grid",
        "placeItems": "center",
        "cursor": "pointer",
        "flexShrink": "0"
      }
    }, React.createElement("svg", {
      width: "16",
      height: "16",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.4",
      strokeLinecap: "round"
    }, React.createElement("path", {
      d: "M12 5v14M5 12h14"
    }))))))) : null;
  }
  function Screen_sShiftReport(v) {
    return v.sShiftReport ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "flex": "1",
        "minHeight": "0",
        "display": "flex",
        "flexDirection": "column",
        "animation": "pop .3s ease backwards"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px",
        "padding": "12px 16px 0",
        "flexShrink": "0"
      }
    }, React.createElement("button", {
      onClick: v.goRepSubmitted,
      style: {
        "width": "38px",
        "height": "38px",
        "borderRadius": "11px",
        "border": "1px solid rgba(255,255,255,.9)",
        "background": "rgba(255,255,255,.6)",
        "display": "grid",
        "placeItems": "center",
        "color": "#3c4858",
        "cursor": "pointer"
      }
    }, React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M15 6l-6 6 6 6"
    }))), React.createElement("div", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "16px",
        "fontWeight": "800",
        "letterSpacing": "-.2px"
      }
    }, "Shift report"), React.createElement("div", {
      style: {
        "fontSize": "12px",
        "color": "#6c7a8c"
      }
    }, ix(v.dept), " · ", ix(v.todayLabel), " · ", ix(v.srShiftCode))), React.createElement("span", {
      style: {
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "11.5px",
        "fontWeight": "700",
        "color": "#0072a3"
      }
    }, ix(v.srStepLabel))), v.srSent ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "padding": "14px 16px"
      }
    }, React.createElement("div", {
      style: {
        "border": "1px solid rgba(43,182,115,.35)",
        "borderRadius": "18px",
        "padding": "26px 18px",
        "background": "rgba(255,255,255,.75)",
        "textAlign": "center",
        "display": "flex",
        "flexDirection": "column",
        "alignItems": "center",
        "gap": "10px",
        "boxShadow": "0 12px 32px rgba(31,59,90,.1)"
      }
    }, React.createElement("span", {
      style: {
        "display": "grid",
        "placeItems": "center",
        "width": "56px",
        "height": "56px",
        "borderRadius": "50%",
        "background": "rgba(43,182,115,.15)",
        "color": "#1d8f57"
      }
    }, React.createElement("svg", {
      width: "28",
      height: "28",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.4",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M20 6L9 17l-5-5"
    }))), React.createElement("div", {
      style: {
        "fontSize": "16px",
        "fontWeight": "800"
      }
    }, "Report submitted"), React.createElement("div", {
      style: {
        "fontSize": "12.5px",
        "color": "#6c7a8c"
      }
    }, "Sent to the Nurse Manager for approval. Figures are already counted in the Reports dashboard."), React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "6px",
        "marginTop": "6px"
      }
    }, React.createElement("button", {
      onClick: v.goRepSubmitted,
      style: {
        "border": "0",
        "borderRadius": "11px",
        "padding": "11px 16px",
        "background": "linear-gradient(140deg,#0aa0d4,#0072a3)",
        "color": "#fff",
        "fontSize": "13px",
        "fontWeight": "700",
        "cursor": "pointer"
      }
    }, "View reports"), React.createElement("button", {
      onClick: v.exportReport,
      style: {
        "border": "1px solid rgba(125,145,180,.35)",
        "borderRadius": "11px",
        "padding": "11px 16px",
        "background": "rgba(255,255,255,.7)",
        "color": "#16202e",
        "fontSize": "13px",
        "fontWeight": "700",
        "cursor": "pointer"
      }
    }, "Share PDF"))))) : null, v.srNotSent ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "4px",
        "padding": "10px 16px 0",
        "flexShrink": "0"
      }
    }, (Array.isArray(v.srSteps) ? v.srSteps : []).map((st, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: st?.go,
      style: S(st?.style)
    }, React.createElement("span", {
      style: S(st?.numStyle)
    }, ix(st?.n)), React.createElement("span", {
      style: {
        "fontSize": "10px",
        "fontWeight": "700",
        "whiteSpace": "nowrap"
      }
    }, ix(st?.label)))))), React.createElement("div", {
      style: {
        "flex": "1",
        "minHeight": "0",
        "overflow": "auto",
        "padding": "12px 16px 20px",
        "display": "flex",
        "flexDirection": "column",
        "gap": "12px"
      }
    }, v.srHasShiftPick ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "inline-flex",
        "background": "rgba(255,255,255,.55)",
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "11px",
        "padding": "3px",
        "gap": "3px",
        "alignSelf": "flex-start"
      }
    }, (Array.isArray(v.srShiftOpts) ? v.srShiftOpts : []).map((o, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: o?.go,
      style: S(o?.style)
    }, ix(o?.label)))))) : null, v.srHasCounts ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.92)",
        "borderRadius": "18px",
        "background": "rgba(255,255,255,.72)",
        "overflow": "hidden",
        "flexShrink": "0"
      }
    }, React.createElement("div", {
      style: {
        "padding": "12px 14px 6px",
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, ix(v.srSectionTitle)), (Array.isArray(v.srCounts) ? v.srCounts : []).map((f, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px",
        "padding": "9px 14px",
        "borderTop": "1px solid rgba(125,145,180,.14)"
      }
    }, React.createElement("span", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "13px",
        "fontWeight": "600"
      }
    }, ix(f?.label)), f?.hint ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "10.5px",
        "color": "#7d8ea8"
      }
    }, ix(f?.hint))) : null), React.createElement("button", {
      onClick: f?.dec,
      style: {
        "width": "34px",
        "height": "34px",
        "borderRadius": "10px",
        "border": "1px solid rgba(125,145,180,.3)",
        "background": "rgba(255,255,255,.8)",
        "color": "#3c4858",
        "display": "grid",
        "placeItems": "center",
        "cursor": "pointer",
        "fontSize": "18px",
        "lineHeight": "1"
      }
    }, "−"), React.createElement("input", {
      value: vx(f?.v),
      onChange: f?.set,
      inputMode: "numeric",
      style: S(f?.inputStyle)
    }), React.createElement("button", {
      onClick: f?.inc,
      style: {
        "width": "34px",
        "height": "34px",
        "borderRadius": "10px",
        "border": "1px solid rgba(0,144,202,.3)",
        "background": "rgba(0,144,202,.08)",
        "color": "#0072a3",
        "display": "grid",
        "placeItems": "center",
        "cursor": "pointer",
        "fontSize": "18px",
        "lineHeight": "1"
      }
    }, "+")))), v.srTotalLabel ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "justifyContent": "space-between",
        "padding": "10px 14px",
        "borderTop": "1px solid rgba(125,145,180,.14)",
        "background": "rgba(0,144,202,.05)"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "12px",
        "fontWeight": "700",
        "color": "#3c4858"
      }
    }, ix(v.srTotalLabel)), React.createElement("span", {
      style: {
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "16px",
        "fontWeight": "600",
        "color": "#0072a3"
      }
    }, ix(v.srTotal)))) : null)) : null, v.srHasNotes ? React.createElement(React.Fragment, null, (Array.isArray(v.srNotes) ? v.srNotes : []).map((n, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("label", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "5px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, ix(n?.label)), React.createElement("textarea", {
      value: vx(n?.v),
      onChange: n?.set,
      rows: "3",
      placeholder: n?.ph,
      style: {
        "border": "1px solid rgba(125,145,180,.3)",
        "borderRadius": "11px",
        "padding": "10px 12px",
        "fontSize": "13.5px",
        "background": "rgba(255,255,255,.85)",
        "outline": "none",
        "resize": "none",
        "lineHeight": "1.5"
      }
    }))))) : null, v.srHasReview ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.92)",
        "borderRadius": "18px",
        "background": "rgba(255,255,255,.72)",
        "overflow": "hidden",
        "flexShrink": "0"
      }
    }, (Array.isArray(v.srReview) ? v.srReview : []).map((r, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "padding": "10px 14px",
        "borderTop": "1px solid rgba(125,145,180,.14)"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "10px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, ix(r?.label)), React.createElement("div", {
      style: {
        "fontSize": "12.5px",
        "marginTop": "3px",
        "lineHeight": "1.5",
        "color": "#16202e",
        "textWrap": "pretty"
      }
    }, ix(r?.v)))))), React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "15px",
        "padding": "12px 14px",
        "background": "rgba(255,255,255,.66)",
        "display": "flex",
        "alignItems": "center",
        "gap": "12px"
      }
    }, React.createElement("span", {
      style: {
        "display": "grid",
        "placeItems": "center",
        "width": "38px",
        "height": "38px",
        "borderRadius": "11px",
        "color": "#fff",
        "fontSize": "12px",
        "fontWeight": "700",
        "background": "linear-gradient(135deg,#3ab5a7,#0090ca)"
      }
    }, ix(v.initials)), React.createElement("span", {
      style: {
        "flex": "1"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "10px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Prepared by"), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "13px",
        "fontWeight": "700",
        "marginTop": "1px"
      }
    }, ix(v.staffName), " · ", ix(v.designation))), React.createElement("span", {
      style: {
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "11px",
        "color": "#7d8ea8"
      }
    }, ix(v.todayLabel)))) : null, React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "6px"
      }
    }, v.srCanBack ? React.createElement(React.Fragment, null, React.createElement("button", {
      onClick: v.srBack,
      style: {
        "flex": "1",
        "border": "1px solid rgba(125,145,180,.35)",
        "borderRadius": "13px",
        "padding": "13px",
        "background": "rgba(255,255,255,.7)",
        "color": "#16202e",
        "fontSize": "13.5px",
        "fontWeight": "700",
        "cursor": "pointer"
      }
    }, "Back")) : null, React.createElement("button", {
      onClick: v.srNext,
      style: {
        "flex": "2",
        "border": "0",
        "borderRadius": "13px",
        "padding": "13px",
        "background": "linear-gradient(140deg,#0aa0d4,#0072a3)",
        "color": "#fff",
        "fontSize": "14px",
        "fontWeight": "700",
        "cursor": "pointer",
        "boxShadow": "0 10px 24px rgba(0,144,202,.32)"
      }
    }, ix(v.srNextLabel))))) : null)) : null;
  }
  function Screen_sDatacol(v) {
    return v.sDatacol ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "flex": "1",
        "minHeight": "0",
        "overflow": "auto",
        "padding": "12px 16px 20px",
        "display": "flex",
        "flexDirection": "column",
        "gap": "12px",
        "animation": "pop .3s ease backwards"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px"
      }
    }, React.createElement("button", {
      onClick: v.openDrawer,
      style: {
        "width": "38px",
        "height": "38px",
        "borderRadius": "11px",
        "border": "1px solid rgba(255,255,255,.9)",
        "background": "rgba(255,255,255,.6)",
        "display": "grid",
        "placeItems": "center",
        "color": "#3c4858",
        "cursor": "pointer",
        "flexShrink": "0"
      }
    }, React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round"
    }, React.createElement("path", {
      d: "M4 7h16M4 12h16M4 17h10"
    }))), React.createElement("div", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "19px",
        "fontWeight": "800",
        "letterSpacing": "-.3px"
      }
    }, "Data collection"), React.createElement("div", {
      style: {
        "fontSize": "12px",
        "color": "#6c7a8c"
      }
    }, ix(v.dept), " · monthly submission to administration")), React.createElement("button", {
      onClick: v.goDcHistory,
      title: "My submissions",
      style: {
        "width": "38px",
        "height": "38px",
        "borderRadius": "11px",
        "border": "1px solid rgba(255,255,255,.9)",
        "background": "rgba(255,255,255,.6)",
        "display": "grid",
        "placeItems": "center",
        "color": "#3c4858",
        "cursor": "pointer"
      }
    }, React.createElement("svg", {
      width: "17",
      height: "17",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("circle", {
      cx: "12",
      cy: "12",
      r: "9"
    }), React.createElement("path", {
      d: "M12 7v5l3 2"
    })))), React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "8px",
        "background": "rgba(255,255,255,.55)",
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "12px",
        "padding": "4px"
      }
    }, React.createElement("button", {
      onClick: v.dcPrevMonth,
      style: {
        "width": "34px",
        "height": "34px",
        "border": "0",
        "borderRadius": "9px",
        "background": "transparent",
        "color": "#3c4858",
        "cursor": "pointer",
        "display": "grid",
        "placeItems": "center"
      }
    }, React.createElement("svg", {
      width: "15",
      height: "15",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M15 6l-6 6 6 6"
    }))), React.createElement("div", {
      style: {
        "flex": "1",
        "textAlign": "center"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "14px",
        "fontWeight": "800"
      }
    }, ix(v.dcMonthLabel)), React.createElement("div", {
      style: S(v.dcDueStyle)
    }, ix(v.dcDueLabel))), React.createElement("button", {
      onClick: v.dcNextMonth,
      style: {
        "width": "34px",
        "height": "34px",
        "border": "0",
        "borderRadius": "9px",
        "background": "transparent",
        "color": "#3c4858",
        "cursor": "pointer",
        "display": "grid",
        "placeItems": "center"
      }
    }, React.createElement("svg", {
      width: "15",
      height: "15",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M9 6l6 6-6 6"
    })))), React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "14px",
        "border": "1px solid rgba(255,255,255,.92)",
        "borderRadius": "18px",
        "padding": "14px 16px",
        "background": "rgba(255,255,255,.72)",
        "boxShadow": "0 12px 32px rgba(31,59,90,.1)"
      }
    }, React.createElement("div", {
      style: {
        "position": "relative",
        "width": "74px",
        "height": "74px",
        "flexShrink": "0"
      }
    }, React.createElement("svg", {
      width: "74",
      height: "74",
      viewBox: "0 0 74 74",
      style: {
        "transform": "rotate(-90deg)"
      }
    }, React.createElement("circle", {
      cx: "37",
      cy: "37",
      r: "31",
      fill: "none",
      stroke: "rgba(125,145,180,.2)",
      strokeWidth: "8"
    }), React.createElement("circle", {
      cx: "37",
      cy: "37",
      r: "31",
      fill: "none",
      stroke: "url(#dcg)",
      strokeWidth: "8",
      strokeLinecap: "round",
      strokeDasharray: v.dcDash
    }), React.createElement("defs", null, React.createElement("linearGradient", {
      id: "dcg",
      x1: "0",
      y1: "0",
      x2: "1",
      y2: "1"
    }, React.createElement("stop", {
      offset: "0",
      stopColor: "#3ab5a7"
    }), React.createElement("stop", {
      offset: "1",
      stopColor: "#0090ca"
    })))), React.createElement("div", {
      style: {
        "position": "absolute",
        "inset": "0",
        "display": "grid",
        "placeItems": "center"
      }
    }, React.createElement("span", {
      style: {
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "16px",
        "fontWeight": "600"
      }
    }, ix(v.dcPct)))), React.createElement("div", {
      style: {
        "flex": "1",
        "minWidth": "0",
        "display": "flex",
        "flexDirection": "column",
        "gap": "4px"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "14px",
        "fontWeight": "800"
      }
    }, ix(v.dcSentCount), " of ", ix(v.dcTotal), " sent"), React.createElement("div", {
      style: {
        "display": "flex",
        "flexWrap": "wrap",
        "gap": "5px"
      }
    }, (Array.isArray(v.dcStatusChips) ? v.dcStatusChips : []).map((c, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: c?.go,
      style: S(c?.style)
    }, React.createElement("span", {
      style: S(c?.dot)
    }), ix(c?.label), " ", React.createElement("b", {
      style: {
        "fontFamily": "'IBM Plex Mono',monospace"
      }
    }, ix(c?.n)))))))), v.dcToast ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "8px",
        "borderRadius": "12px",
        "padding": "10px 12px",
        "background": "rgba(43,182,115,.13)",
        "color": "#1d8f57",
        "fontSize": "12.5px",
        "fontWeight": "700",
        "animation": "pop .25s ease"
      }
    }, React.createElement("svg", {
      width: "15",
      height: "15",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.4",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M20 6L9 17l-5-5"
    })), ix(v.dcToast))) : null, React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "8px"
      }
    }, (Array.isArray(v.dcItems) ? v.dcItems : []).map((it, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: it?.go,
      style: S(it?.cardStyle)
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px"
      }
    }, React.createElement("span", {
      style: S(it?.iconWrap)
    }, React.createElement("svg", {
      width: "16",
      height: "16",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: it?.d
    }))), React.createElement("span", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "13.5px",
        "fontWeight": "700"
      }
    }, ix(it?.label)), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "11px",
        "color": "#6c7a8c"
      }
    }, ix(it?.meta))), React.createElement("span", {
      style: S(it?.statusStyle)
    }, React.createElement("span", {
      style: S(it?.statusDot)
    }), ix(it?.statusLabel))), it?.value ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "8px",
        "marginTop": "8px",
        "paddingTop": "8px",
        "borderTop": "1px solid rgba(125,145,180,.14)"
      }
    }, React.createElement("span", {
      style: S(`font-family:'IBM Plex Mono',monospace;font-size:15px;font-weight:600;color:${it?.valueColor ?? ""}`)
    }, ix(it?.value)), React.createElement("span", {
      style: {
        "fontSize": "11px",
        "color": "#6c7a8c"
      }
    }, ix(it?.valueMeta)), React.createElement("span", {
      style: {
        "flex": "1"
      }
    }), React.createElement("span", {
      style: {
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "10.5px",
        "color": "#9aa6b4"
      }
    }, ix(it?.at)))) : null, it?.reason ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "flex-start",
        "gap": "8px",
        "marginTop": "8px",
        "borderRadius": "10px",
        "padding": "9px 11px",
        "background": "rgba(214,69,69,.08)",
        "border": "1px solid rgba(214,69,69,.2)"
      }
    }, React.createElement("svg", {
      width: "14",
      height: "14",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "#b32e2e",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      style: {
        "flexShrink": "0",
        "marginTop": "1px"
      }
    }, React.createElement("path", {
      d: "M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"
    })), React.createElement("span", {
      style: {
        "flex": "1",
        "minWidth": "0",
        "fontSize": "12px",
        "lineHeight": "1.45",
        "color": "#16202e"
      }
    }, React.createElement("b", {
      style: {
        "color": "#b32e2e"
      }
    }, "Returned by ", ix(it?.reviewer), ":"), " ", ix(it?.reason)), React.createElement("span", {
      style: {
        "fontSize": "11.5px",
        "fontWeight": "700",
        "color": "#0072a3",
        "whiteSpace": "nowrap"
      }
    }, "Fix now"))) : null)))), React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "16px",
        "padding": "13px 14px",
        "background": "linear-gradient(140deg,rgba(0,144,202,.08),rgba(255,255,255,.7))",
        "display": "flex",
        "flexDirection": "column",
        "gap": "9px"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "How submission works"), (Array.isArray(v.dcSteps) ? v.dcSteps : []).map((st, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "flex-start",
        "gap": "10px"
      }
    }, React.createElement("span", {
      style: {
        "display": "grid",
        "placeItems": "center",
        "width": "22px",
        "height": "22px",
        "borderRadius": "50%",
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "10.5px",
        "fontWeight": "700",
        "color": "#fff",
        "background": "linear-gradient(140deg,#0aa0d4,#0072a3)",
        "flexShrink": "0"
      }
    }, ix(st?.n)), React.createElement("span", {
      style: {
        "fontSize": "12.5px",
        "lineHeight": "1.45",
        "color": "#16202e"
      }
    }, React.createElement("b", null, ix(st?.t)), " · ", ix(st?.d)))))))) : null;
  }
  function Screen_sDatacolForm(v) {
    return v.sDatacolForm ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "flex": "1",
        "minHeight": "0",
        "display": "flex",
        "flexDirection": "column",
        "animation": "pop .3s ease backwards"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px",
        "padding": "12px 16px 0",
        "flexShrink": "0"
      }
    }, React.createElement("button", {
      onClick: v.goDatacol,
      style: {
        "width": "38px",
        "height": "38px",
        "borderRadius": "11px",
        "border": "1px solid rgba(255,255,255,.9)",
        "background": "rgba(255,255,255,.6)",
        "display": "grid",
        "placeItems": "center",
        "color": "#3c4858",
        "cursor": "pointer"
      }
    }, React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M15 6l-6 6 6 6"
    }))), React.createElement("div", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "16px",
        "fontWeight": "800",
        "letterSpacing": "-.2px",
        "lineHeight": "1.2"
      }
    }, ix(v.dcItem?.label)), React.createElement("div", {
      style: {
        "fontSize": "12px",
        "color": "#6c7a8c"
      }
    }, ix(v.dept), " · ", ix(v.dcMonthLabel))), React.createElement("span", {
      style: S(v.dcItem?.statusStyle)
    }, React.createElement("span", {
      style: S(v.dcItem?.statusDot)
    }), ix(v.dcItem?.statusLabel))), v.dcFormSent ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "padding": "14px 16px"
      }
    }, React.createElement("div", {
      style: {
        "border": "1px solid rgba(43,182,115,.35)",
        "borderRadius": "18px",
        "padding": "26px 18px",
        "background": "rgba(255,255,255,.75)",
        "textAlign": "center",
        "display": "flex",
        "flexDirection": "column",
        "alignItems": "center",
        "gap": "10px",
        "boxShadow": "0 12px 32px rgba(31,59,90,.1)"
      }
    }, React.createElement("span", {
      style: {
        "display": "grid",
        "placeItems": "center",
        "width": "56px",
        "height": "56px",
        "borderRadius": "50%",
        "background": "rgba(0,144,202,.13)",
        "color": "#0072a3"
      }
    }, React.createElement("svg", {
      width: "28",
      height: "28",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"
    }))), React.createElement("div", {
      style: {
        "fontSize": "16px",
        "fontWeight": "800"
      }
    }, ix(v.dcSentTitle)), React.createElement("div", {
      style: {
        "fontSize": "12.5px",
        "color": "#6c7a8c",
        "lineHeight": "1.5"
      }
    }, "Sent to Quality & Administration for review. You will be notified when it is approved or returned. Approved data goes straight to the hospital dashboard."), React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "6px",
        "marginTop": "6px"
      }
    }, React.createElement("button", {
      onClick: v.dcNextOpen,
      style: {
        "border": "0",
        "borderRadius": "11px",
        "padding": "11px 16px",
        "background": "linear-gradient(140deg,#0aa0d4,#0072a3)",
        "color": "#fff",
        "fontSize": "13px",
        "fontWeight": "700",
        "cursor": "pointer"
      }
    }, ix(v.dcNextOpenLabel)), React.createElement("button", {
      onClick: v.goDatacol,
      style: {
        "border": "1px solid rgba(125,145,180,.35)",
        "borderRadius": "11px",
        "padding": "11px 16px",
        "background": "rgba(255,255,255,.7)",
        "color": "#16202e",
        "fontSize": "13px",
        "fontWeight": "700",
        "cursor": "pointer"
      }
    }, "Back to list"))))) : null, v.dcFormOpen ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "flex": "1",
        "minHeight": "0",
        "overflow": "auto",
        "padding": "12px 16px 20px",
        "display": "flex",
        "flexDirection": "column",
        "gap": "12px"
      }
    }, v.dcItem?.reason ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "flex-start",
        "gap": "8px",
        "borderRadius": "12px",
        "padding": "10px 12px",
        "background": "rgba(214,69,69,.08)",
        "border": "1px solid rgba(214,69,69,.2)"
      }
    }, React.createElement("svg", {
      width: "14",
      height: "14",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "#b32e2e",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      style: {
        "flexShrink": "0",
        "marginTop": "1px"
      }
    }, React.createElement("path", {
      d: "M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"
    })), React.createElement("span", {
      style: {
        "fontSize": "12.5px",
        "lineHeight": "1.45"
      }
    }, React.createElement("b", {
      style: {
        "color": "#b32e2e"
      }
    }, "Returned for correction:"), " ", ix(v.dcItem?.reason)))) : null, v.dcItem?.isApproved ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "flex-start",
        "gap": "8px",
        "borderRadius": "12px",
        "padding": "10px 12px",
        "background": "rgba(43,182,115,.1)",
        "border": "1px solid rgba(43,182,115,.25)"
      }
    }, React.createElement("svg", {
      width: "14",
      height: "14",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "#1d8f57",
      strokeWidth: "2.4",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      style: {
        "flexShrink": "0",
        "marginTop": "1px"
      }
    }, React.createElement("path", {
      d: "M20 6L9 17l-5-5"
    })), React.createElement("span", {
      style: {
        "fontSize": "12.5px",
        "lineHeight": "1.45"
      }
    }, React.createElement("b", {
      style: {
        "color": "#1d8f57"
      }
    }, "Already approved"), " on ", ix(v.dcItem?.at), ". Re-submitting creates a correction request that administration must approve again."))) : null, v.dcItem?.isPending ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "flex-start",
        "gap": "8px",
        "borderRadius": "12px",
        "padding": "10px 12px",
        "background": "rgba(0,144,202,.08)",
        "border": "1px solid rgba(0,144,202,.25)"
      }
    }, React.createElement("svg", {
      width: "14",
      height: "14",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "#0072a3",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      style: {
        "flexShrink": "0",
        "marginTop": "1px"
      }
    }, React.createElement("circle", {
      cx: "12",
      cy: "12",
      r: "9"
    }), React.createElement("path", {
      d: "M12 7v5l3 2"
    })), React.createElement("span", {
      style: {
        "fontSize": "12.5px",
        "lineHeight": "1.45"
      }
    }, React.createElement("b", {
      style: {
        "color": "#0072a3"
      }
    }, "Pending review"), " since ", ix(v.dcItem?.at), ". You can't submit again until administration decides. Values are read-only."))) : null, v.dcIsStat ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.92)",
        "borderRadius": "18px",
        "background": "rgba(255,255,255,.72)",
        "overflow": "hidden",
        "flexShrink": "0"
      }
    }, React.createElement("div", {
      style: {
        "padding": "12px 14px 6px",
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Monthly statistics sheet"), (Array.isArray(v.dcStatFields) ? v.dcStatFields : []).map((f, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px",
        "padding": "9px 14px",
        "borderTop": "1px solid rgba(125,145,180,.14)"
      }
    }, React.createElement("span", {
      style: {
        "flex": "1",
        "minWidth": "0",
        "fontSize": "13px",
        "fontWeight": "600"
      }
    }, ix(f?.label)), React.createElement("input", {
      value: vx(f?.v),
      onChange: f?.set,
      inputMode: "numeric",
      readOnly: v.dcReadOnly,
      placeholder: "0",
      style: S(f?.style)
    })))))) : null, v.dcIsQuality ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.92)",
        "borderRadius": "18px",
        "padding": "14px",
        "background": "rgba(255,255,255,.72)",
        "display": "flex",
        "flexDirection": "column",
        "gap": "12px"
      }
    }, v.dcIsGrouped ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "inline-flex",
        "background": "rgba(125,145,180,.12)",
        "borderRadius": "11px",
        "padding": "3px",
        "gap": "3px",
        "alignSelf": "flex-start"
      }
    }, (Array.isArray(v.dcModeOpts) ? v.dcModeOpts : []).map((o, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: o?.go,
      style: S(o?.style)
    }, ix(o?.label))))), v.dcByGroup ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "grid",
        "gridTemplateColumns": "1fr 70px 70px",
        "gap": "6px",
        "alignItems": "center",
        "fontSize": "10px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, React.createElement("span", null, "Staff group"), React.createElement("span", {
      style: {
        "textAlign": "center"
      }
    }, "Compliant"), React.createElement("span", {
      style: {
        "textAlign": "center"
      }
    }, "Observed")), (Array.isArray(v.dcGroups) ? v.dcGroups : []).map((g, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "display": "grid",
        "gridTemplateColumns": "1fr 70px 70px",
        "gap": "6px",
        "alignItems": "center"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "13px",
        "fontWeight": "600"
      }
    }, ix(g?.label)), React.createElement("input", {
      value: vx(g?.n),
      onChange: g?.setN,
      inputMode: "numeric",
      readOnly: v.dcReadOnly,
      placeholder: "0",
      style: S(g?.style)
    }), React.createElement("input", {
      value: vx(g?.d),
      onChange: g?.setD,
      inputMode: "numeric",
      readOnly: v.dcReadOnly,
      placeholder: "0",
      style: S(g?.style)
    }))))) : null) : null, v.dcDirect ? React.createElement(React.Fragment, null, React.createElement("label", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "5px"
      }
    }, React.createElement("span", {
      style: {
        "display": "flex",
        "justifyContent": "space-between",
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, React.createElement("span", null, "Numerator"), React.createElement("span", {
      style: {
        "fontWeight": "600",
        "letterSpacing": "0",
        "textTransform": "none",
        "color": "#6c7a8c"
      }
    }, ix(v.dcItem?.num))), React.createElement("input", {
      value: vx(v.dcNum),
      onChange: v.setDcNum,
      inputMode: "numeric",
      readOnly: v.dcReadOnly,
      placeholder: "0",
      style: S(v.dcNumStyle)
    })), React.createElement("label", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "5px"
      }
    }, React.createElement("span", {
      style: {
        "display": "flex",
        "justifyContent": "space-between",
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, React.createElement("span", null, "Denominator", v.dcItem?.denLocked ? React.createElement(React.Fragment, null, " · locked by admin") : null), React.createElement("span", {
      style: {
        "fontWeight": "600",
        "letterSpacing": "0",
        "textTransform": "none",
        "color": "#6c7a8c"
      }
    }, ix(v.dcItem?.den))), React.createElement("input", {
      value: vx(v.dcDen),
      onChange: v.setDcDen,
      inputMode: "numeric",
      readOnly: v.dcDenReadOnly,
      placeholder: "0",
      style: S(v.dcDenStyle)
    }))) : null, React.createElement("div", {
      style: S(`display:flex;align-items:center;gap:12px;border-radius:13px;padding:11px 13px;background:${v.dcResultBg ?? ""}`)
    }, React.createElement("div", {
      style: {
        "flex": "1"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "10px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Calculated value"), React.createElement("div", {
      style: S(`font-family:'IBM Plex Mono',monospace;font-size:24px;font-weight:600;line-height:1;margin-top:3px;color:${v.dcResultColor ?? ""}`)
    }, ix(v.dcResult))), React.createElement("div", {
      style: {
        "textAlign": "right"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "10px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Benchmark"), React.createElement("div", {
      style: {
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "14px",
        "fontWeight": "600",
        "marginTop": "3px"
      }
    }, ix(v.dcItem?.bench)), React.createElement("div", {
      style: S(`font-size:10.5px;font-weight:700;color:${v.dcResultColor ?? ""}`)
    }, ix(v.dcResultLabel))))), React.createElement("button", {
      onClick: v.toggleDcGuide,
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px",
        "textAlign": "left",
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "14px",
        "padding": "11px 13px",
        "background": "rgba(255,255,255,.66)",
        "cursor": "pointer",
        "color": "#16202e"
      }
    }, React.createElement("span", {
      style: {
        "display": "grid",
        "placeItems": "center",
        "width": "30px",
        "height": "30px",
        "borderRadius": "9px",
        "background": "rgba(106,82,212,.12)",
        "color": "#6a52d4"
      }
    }, React.createElement("svg", {
      width: "15",
      height: "15",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M4 19.5A2.5 2.5 0 016.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"
    }))), React.createElement("span", {
      style: {
        "flex": "1",
        "fontSize": "13px",
        "fontWeight": "700"
      }
    }, "Indicator guide (HQI)"), React.createElement("svg", {
      width: "16",
      height: "16",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "#9aa6b4",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      style: S(v.dcGuideChevron)
    }, React.createElement("path", {
      d: "M6 9l6 6 6-6"
    }))), v.dcGuideOpen ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "14px",
        "padding": "12px 14px",
        "background": "rgba(255,255,255,.66)",
        "display": "flex",
        "flexDirection": "column",
        "gap": "9px",
        "animation": "pop .2s ease"
      }
    }, (Array.isArray(v.dcGuide) ? v.dcGuide : []).map((g, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", null, React.createElement("div", {
      style: {
        "fontSize": "10px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, ix(g?.label)), React.createElement("div", {
      style: S(`font-size:12.5px;line-height:1.5;margin-top:2px;text-wrap:pretty;font-family:${g?.font ?? ""}`)
    }, ix(g?.text))))))) : null) : null, v.dcEditable ? React.createElement(React.Fragment, null, v.dcNeedsCorr ? React.createElement(React.Fragment, null, React.createElement("label", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "5px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#b8650a"
      }
    }, "Reason for correction · required"), React.createElement("textarea", {
      value: vx(v.dcCorr),
      onChange: v.setDcCorr,
      rows: "2",
      placeholder: "What was wrong in the approved figure?",
      style: {
        "border": "1px solid rgba(224,138,30,.4)",
        "borderRadius": "11px",
        "padding": "10px 12px",
        "fontSize": "13.5px",
        "background": "rgba(255,255,255,.85)",
        "outline": "none",
        "resize": "none"
      }
    }))) : null, React.createElement("label", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "5px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Note to reviewer · optional"), React.createElement("textarea", {
      value: vx(v.dcNote),
      onChange: v.setDcNote,
      rows: "2",
      placeholder: "Source register, anything unusual this month",
      style: {
        "border": "1px solid rgba(125,145,180,.3)",
        "borderRadius": "11px",
        "padding": "10px 12px",
        "fontSize": "13.5px",
        "background": "rgba(255,255,255,.85)",
        "outline": "none",
        "resize": "none"
      }
    })), React.createElement("button", {
      onClick: v.toggleDcEvidence,
      style: S(v.dcEvidenceStyle)
    }, React.createElement("svg", {
      width: "14",
      height: "14",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M21.4 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"
    })), ix(v.dcEvidenceLabel)), React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "6px"
      }
    }, React.createElement("button", {
      onClick: v.dcSaveDraft,
      style: {
        "flex": "1",
        "border": "1px solid rgba(125,145,180,.35)",
        "borderRadius": "13px",
        "padding": "13px",
        "background": "rgba(255,255,255,.7)",
        "color": "#16202e",
        "fontSize": "13.5px",
        "fontWeight": "700",
        "cursor": "pointer"
      }
    }, "Save draft"), React.createElement("button", {
      onClick: v.dcSubmit,
      style: S(v.dcSubmitStyle)
    }, ix(v.dcSubmitLabel)))) : null)) : null)) : null;
  }
  function Screen_sDatacolHistory(v) {
    return v.sDatacolHistory ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "flex": "1",
        "minHeight": "0",
        "overflow": "auto",
        "padding": "12px 16px 20px",
        "display": "flex",
        "flexDirection": "column",
        "gap": "12px",
        "animation": "pop .3s ease backwards"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px"
      }
    }, React.createElement("button", {
      onClick: v.goDatacol,
      style: {
        "width": "38px",
        "height": "38px",
        "borderRadius": "11px",
        "border": "1px solid rgba(255,255,255,.9)",
        "background": "rgba(255,255,255,.6)",
        "display": "grid",
        "placeItems": "center",
        "color": "#3c4858",
        "cursor": "pointer"
      }
    }, React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M15 6l-6 6 6 6"
    }))), React.createElement("div", {
      style: {
        "flex": "1"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "17px",
        "fontWeight": "800",
        "letterSpacing": "-.2px"
      }
    }, "My submissions"), React.createElement("div", {
      style: {
        "fontSize": "12px",
        "color": "#6c7a8c"
      }
    }, "What administration has received from you"))), React.createElement("div", {
      style: {
        "display": "grid",
        "gridTemplateColumns": "repeat(3,1fr)",
        "gap": "8px"
      }
    }, (Array.isArray(v.dcHistTiles) ? v.dcHistTiles : []).map((t, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "13px",
        "padding": "11px 10px",
        "background": "rgba(255,255,255,.66)"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "9.5px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, ix(t?.label)), React.createElement("div", {
      style: S(`font-family:'IBM Plex Mono',monospace;font-size:20px;font-weight:600;margin-top:5px;line-height:1;color:${t?.color ?? ""}`)
    }, ix(t?.v)))))), React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "6px",
        "overflowX": "auto",
        "paddingBottom": "2px",
        "scrollbarWidth": "none",
        "flexShrink": "0"
      }
    }, (Array.isArray(v.dcHistFilters) ? v.dcHistFilters : []).map((f, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: f?.go,
      style: S(f?.style)
    }, ix(f?.label))))), React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "8px"
      }
    }, (Array.isArray(v.dcHistory) ? v.dcHistory : []).map((h, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: h?.go,
      style: {
        "display": "block",
        "textAlign": "left",
        "width": "100%",
        "boxSizing": "border-box",
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "14px",
        "padding": "11px 13px",
        "background": "rgba(255,255,255,.66)",
        "cursor": "pointer",
        "color": "#16202e"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "8px"
      }
    }, React.createElement("span", {
      style: {
        "flex": "1",
        "minWidth": "0",
        "fontSize": "13px",
        "fontWeight": "700",
        "whiteSpace": "nowrap",
        "overflow": "hidden",
        "textOverflow": "ellipsis"
      }
    }, ix(h?.label)), React.createElement("span", {
      style: S(h?.statusStyle)
    }, React.createElement("span", {
      style: S(h?.statusDot)
    }), ix(h?.statusLabel))), React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "8px",
        "marginTop": "4px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "11.5px",
        "color": "#6c7a8c"
      }
    }, ix(h?.month), " · ", ix(h?.summary)), React.createElement("span", {
      style: {
        "flex": "1"
      }
    }), React.createElement("span", {
      style: {
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "10.5px",
        "color": "#9aa6b4"
      }
    }, ix(h?.at))), h?.decision ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "fontSize": "11.5px",
        "color": "#3c4858",
        "marginTop": "6px",
        "paddingTop": "6px",
        "borderTop": "1px solid rgba(125,145,180,.14)",
        "lineHeight": "1.45"
      }
    }, ix(h?.decision))) : null)))))) : null;
  }
  function Screen_sHandover(v) {
    return v.sHandover ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "flex": "1",
        "minHeight": "0",
        "overflow": "auto",
        "padding": "12px 16px 20px",
        "display": "flex",
        "flexDirection": "column",
        "gap": "12px",
        "animation": "pop .3s ease backwards"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px"
      }
    }, React.createElement("button", {
      onClick: v.goHome,
      style: {
        "width": "38px",
        "height": "38px",
        "borderRadius": "11px",
        "border": "1px solid rgba(255,255,255,.9)",
        "background": "rgba(255,255,255,.6)",
        "display": "grid",
        "placeItems": "center",
        "color": "#3c4858",
        "cursor": "pointer"
      }
    }, React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M15 6l-6 6 6 6"
    }))), React.createElement("div", {
      style: {
        "flex": "1"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "17px",
        "fontWeight": "800",
        "letterSpacing": "-.2px"
      }
    }, "Shift handover"), React.createElement("div", {
      style: {
        "fontSize": "12px",
        "color": "#6c7a8c"
      }
    }, ix(v.dept), " · ", ix(v.todayCode), " → ", ix(v.nextShiftCode), " · ", ix(v.todayLabel)))), React.createElement("div", {
      style: {
        "display": "grid",
        "gridTemplateColumns": "repeat(3,1fr)",
        "gap": "8px"
      }
    }, (Array.isArray(v.handoverStats) ? v.handoverStats : []).map((s, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "13px",
        "padding": "10px 8px",
        "background": "rgba(255,255,255,.65)",
        "textAlign": "center"
      }
    }, React.createElement("div", {
      style: S(`font-family:'IBM Plex Mono',monospace;font-size:20px;font-weight:600;line-height:1;color:${s?.color ?? ""}`)
    }, ix(s?.n)), React.createElement("div", {
      style: {
        "fontSize": "10px",
        "fontWeight": "700",
        "letterSpacing": ".4px",
        "textTransform": "uppercase",
        "color": "#7d8ea8",
        "marginTop": "4px"
      }
    }, ix(s?.label)))))), React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "8px"
      }
    }, (Array.isArray(v.handoverItems) ? v.handoverItems : []).map((h, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "14px",
        "padding": "12px 13px",
        "background": "rgba(255,255,255,.66)",
        "display": "flex",
        "flexDirection": "column",
        "gap": "7px"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "8px"
      }
    }, React.createElement("span", {
      style: S(h?.bedStyle)
    }, ix(h?.bed)), React.createElement("span", {
      style: {
        "flex": "1",
        "fontSize": "13.5px",
        "fontWeight": "700"
      }
    }, ix(h?.patient)), React.createElement("span", {
      style: S(h?.prioStyle)
    }, ix(h?.prio))), React.createElement("div", {
      style: {
        "fontSize": "12.5px",
        "lineHeight": "1.5",
        "color": "#16202e",
        "textWrap": "pretty"
      }
    }, ix(h?.note)), React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "6px"
      }
    }, React.createElement("button", {
      onClick: h?.toggle,
      style: S(h?.checkStyle)
    }, h?.done ? React.createElement(React.Fragment, null, React.createElement("svg", {
      width: "13",
      height: "13",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "3",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M20 6L9 17l-5-5"
    }))) : null), React.createElement("span", {
      style: {
        "fontSize": "11.5px",
        "color": "#6c7a8c"
      }
    }, ix(h?.doneLabel))))))), React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "5px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Add a note for the next shift"), React.createElement("textarea", {
      value: vx(v.handoverDraft),
      onChange: v.setHandoverDraft,
      rows: "3",
      placeholder: "Bed, patient, what to watch",
      style: {
        "border": "1px solid rgba(125,145,180,.35)",
        "borderRadius": "11px",
        "padding": "11px 13px",
        "fontSize": "13.5px",
        "background": "rgba(255,255,255,.85)",
        "outline": "none",
        "resize": "none"
      }
    })), React.createElement("button", {
      onClick: v.addHandover,
      style: {
        "border": "0",
        "borderRadius": "13px",
        "padding": "13px",
        "background": "linear-gradient(140deg,#0aa0d4,#0072a3)",
        "color": "#fff",
        "fontSize": "14px",
        "fontWeight": "700",
        "cursor": "pointer",
        "boxShadow": "0 10px 24px rgba(0,144,202,.32)"
      }
    }, "Add to handover"))) : null;
  }
  function Screen_sIncident(v) {
    return v.sIncident ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "flex": "1",
        "minHeight": "0",
        "overflow": "auto",
        "padding": "12px 16px 20px",
        "display": "flex",
        "flexDirection": "column",
        "gap": "12px",
        "animation": "pop .3s ease backwards"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px"
      }
    }, React.createElement("button", {
      onClick: v.goHome,
      style: {
        "width": "38px",
        "height": "38px",
        "borderRadius": "11px",
        "border": "1px solid rgba(255,255,255,.9)",
        "background": "rgba(255,255,255,.6)",
        "display": "grid",
        "placeItems": "center",
        "color": "#3c4858",
        "cursor": "pointer"
      }
    }, React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M15 6l-6 6 6 6"
    }))), React.createElement("div", {
      style: {
        "flex": "1"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "17px",
        "fontWeight": "800",
        "letterSpacing": "-.2px"
      }
    }, "Report an incident"), React.createElement("div", {
      style: {
        "fontSize": "12px",
        "color": "#6c7a8c"
      }
    }, "Goes to Quality & Patient Safety"))), v.incSent ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "border": "1px solid rgba(43,182,115,.35)",
        "borderRadius": "18px",
        "padding": "26px 18px",
        "background": "rgba(255,255,255,.75)",
        "textAlign": "center",
        "display": "flex",
        "flexDirection": "column",
        "alignItems": "center",
        "gap": "10px",
        "boxShadow": "0 12px 32px rgba(31,59,90,.1)"
      }
    }, React.createElement("span", {
      style: {
        "display": "grid",
        "placeItems": "center",
        "width": "56px",
        "height": "56px",
        "borderRadius": "50%",
        "background": "rgba(43,182,115,.15)",
        "color": "#1d8f57"
      }
    }, React.createElement("svg", {
      width: "28",
      height: "28",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.4",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M20 6L9 17l-5-5"
    }))), React.createElement("div", {
      style: {
        "fontSize": "16px",
        "fontWeight": "800"
      }
    }, "Report submitted"), React.createElement("div", {
      style: {
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "12.5px",
        "color": "#0072a3",
        "fontWeight": "700"
      }
    }, ix(v.incRef)), React.createElement("div", {
      style: {
        "fontSize": "12.5px",
        "color": "#6c7a8c"
      }
    }, "Thank you. Reporting is confidential and non-punitive."), React.createElement("button", {
      onClick: v.goHome,
      style: {
        "marginTop": "6px",
        "border": "0",
        "borderRadius": "11px",
        "padding": "11px 18px",
        "background": "linear-gradient(140deg,#0aa0d4,#0072a3)",
        "color": "#fff",
        "fontSize": "13px",
        "fontWeight": "700",
        "cursor": "pointer"
      }
    }, "Back to home"))) : null, v.incNotSent ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "6px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Type"), React.createElement("div", {
      style: {
        "display": "grid",
        "gridTemplateColumns": "1fr 1fr",
        "gap": "6px"
      }
    }, (Array.isArray(v.incTypes) ? v.incTypes : []).map((t, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: t?.go,
      style: S(t?.style)
    }, ix(t?.label)))))), React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "6px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Severity"), React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "6px"
      }
    }, (Array.isArray(v.incSevs) ? v.incSevs : []).map((s, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: s?.go,
      style: S(s?.style)
    }, ix(s?.label)))))), React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.92)",
        "borderRadius": "18px",
        "padding": "14px",
        "background": "rgba(255,255,255,.72)",
        "display": "flex",
        "flexDirection": "column",
        "gap": "10px"
      }
    }, React.createElement("div", {
      style: {
        "display": "grid",
        "gridTemplateColumns": "1fr 1fr",
        "gap": "8px"
      }
    }, React.createElement("label", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "4px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Location"), React.createElement("input", {
      value: vx(v.dept),
      readOnly: true,
      style: {
        "border": "1px solid rgba(125,145,180,.3)",
        "borderRadius": "10px",
        "padding": "10px 12px",
        "fontSize": "13px",
        "background": "rgba(255,255,255,.85)",
        "outline": "none"
      }
    })), React.createElement("label", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "4px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Time"), React.createElement("input", {
      value: vx(v.incTime),
      onChange: v.setIncTime,
      style: {
        "border": "1px solid rgba(125,145,180,.3)",
        "borderRadius": "10px",
        "padding": "10px 12px",
        "fontSize": "13px",
        "background": "rgba(255,255,255,.85)",
        "outline": "none",
        "fontFamily": "'IBM Plex Mono',monospace"
      }
    }))), React.createElement("label", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "4px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "What happened"), React.createElement("textarea", {
      value: vx(v.incDesc),
      onChange: v.setIncDesc,
      rows: "4",
      placeholder: "Describe facts only: what, when, who was informed, immediate action taken.",
      style: {
        "border": "1px solid rgba(125,145,180,.3)",
        "borderRadius": "10px",
        "padding": "10px 12px",
        "fontSize": "13.5px",
        "background": "rgba(255,255,255,.85)",
        "outline": "none",
        "resize": "none"
      }
    })), React.createElement("button", {
      onClick: v.toggleAnon,
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px",
        "border": "0",
        "background": "none",
        "padding": "2px 0",
        "cursor": "pointer",
        "textAlign": "left"
      }
    }, React.createElement("span", {
      style: S(v.anonBoxStyle)
    }, v.incAnon ? React.createElement(React.Fragment, null, React.createElement("svg", {
      width: "12",
      height: "12",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "#fff",
      strokeWidth: "3",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M20 6L9 17l-5-5"
    }))) : null), React.createElement("span", {
      style: {
        "fontSize": "13px",
        "color": "#16202e",
        "fontWeight": "600"
      }
    }, "Submit anonymously"))), React.createElement("button", {
      onClick: v.submitIncident,
      style: {
        "border": "0",
        "borderRadius": "13px",
        "padding": "14px",
        "background": "linear-gradient(140deg,#d23a52,#a8253c)",
        "color": "#fff",
        "fontSize": "14.5px",
        "fontWeight": "700",
        "cursor": "pointer",
        "boxShadow": "0 10px 24px rgba(210,58,82,.3)"
      }
    }, "Submit report")) : null)) : null;
  }
  function Screen_sPerformance(v) {
    return v.sPerformance ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "flex": "1",
        "minHeight": "0",
        "overflow": "auto",
        "padding": "14px 16px 20px",
        "display": "flex",
        "flexDirection": "column",
        "gap": "14px",
        "animation": "pop .3s ease backwards"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px"
      }
    }, React.createElement("button", {
      onClick: v.goProfile,
      style: {
        "width": "38px",
        "height": "38px",
        "borderRadius": "11px",
        "border": "1px solid rgba(255,255,255,.9)",
        "background": "rgba(255,255,255,.6)",
        "display": "grid",
        "placeItems": "center",
        "color": "#3c4858",
        "cursor": "pointer"
      }
    }, React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M15 6l-6 6 6 6"
    }))), React.createElement("div", {
      style: {
        "flex": "1"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "17px",
        "fontWeight": "800",
        "letterSpacing": "-.2px"
      }
    }, "My performance"), React.createElement("div", {
      style: {
        "fontSize": "12px",
        "color": "#6c7a8c"
      }
    }, "Appraisal cycle · ", ix(v.cycleLabel)))), React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "16px",
        "border": "1px solid rgba(255,255,255,.92)",
        "borderRadius": "18px",
        "padding": "16px",
        "background": "rgba(255,255,255,.72)",
        "boxShadow": "0 12px 32px rgba(31,59,90,.1)"
      }
    }, React.createElement("div", {
      style: {
        "position": "relative",
        "width": "92px",
        "height": "92px",
        "flexShrink": "0"
      }
    }, React.createElement("svg", {
      width: "92",
      height: "92",
      viewBox: "0 0 92 92",
      style: {
        "transform": "rotate(-90deg)"
      }
    }, React.createElement("circle", {
      cx: "46",
      cy: "46",
      r: "40",
      fill: "none",
      stroke: "rgba(125,145,180,.2)",
      strokeWidth: "9"
    }), React.createElement("circle", {
      cx: "46",
      cy: "46",
      r: "40",
      fill: "none",
      stroke: "url(#pg)",
      strokeWidth: "9",
      strokeLinecap: "round",
      strokeDasharray: v.scoreDash
    }), React.createElement("defs", null, React.createElement("linearGradient", {
      id: "pg",
      x1: "0",
      y1: "0",
      x2: "1",
      y2: "1"
    }, React.createElement("stop", {
      offset: "0",
      stopColor: "#3ab5a7"
    }), React.createElement("stop", {
      offset: "1",
      stopColor: "#0090ca"
    })))), React.createElement("div", {
      style: {
        "position": "absolute",
        "inset": "0",
        "display": "grid",
        "placeItems": "center",
        "textAlign": "center"
      }
    }, React.createElement("div", null, React.createElement("div", {
      style: {
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "22px",
        "fontWeight": "600",
        "lineHeight": "1"
      }
    }, ix(v.score)), React.createElement("div", {
      style: {
        "fontSize": "9.5px",
        "color": "#7d8ea8",
        "fontWeight": "700"
      }
    }, "of 5")))), React.createElement("div", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "15px",
        "fontWeight": "800"
      }
    }, ix(v.scoreBand)), React.createElement("div", {
      style: {
        "fontSize": "12px",
        "color": "#6c7a8c",
        "marginTop": "2px",
        "lineHeight": "1.45"
      }
    }, "Reviewed by ", ix(v.reviewer), " · ", ix(v.reviewDate)), React.createElement("span", {
      style: {
        "display": "inline-block",
        "marginTop": "8px",
        "fontSize": "11px",
        "fontWeight": "700",
        "padding": "4px 9px",
        "borderRadius": "999px",
        "color": "#1d8f57",
        "background": "rgba(43,182,115,.13)"
      }
    }, "Signed off"))), React.createElement("div", {
      style: {
        "display": "grid",
        "gridTemplateColumns": "repeat(3,1fr)",
        "gap": "8px"
      }
    }, (Array.isArray(v.perfKpis) ? v.perfKpis : []).map((k, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "13px",
        "padding": "11px 10px",
        "background": "rgba(255,255,255,.65)"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "10px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, ix(k?.label)), React.createElement("div", {
      style: S(`font-family:'IBM Plex Mono',monospace;font-size:19px;font-weight:600;margin-top:5px;line-height:1;color:${k?.color ?? ""}`)
    }, ix(k?.v)), React.createElement("div", {
      style: {
        "fontSize": "10.5px",
        "color": "#6c7a8c",
        "marginTop": "3px"
      }
    }, ix(k?.note)))))), React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "16px",
        "padding": "14px",
        "background": "rgba(255,255,255,.68)",
        "display": "flex",
        "flexDirection": "column",
        "gap": "11px"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".7px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Competencies"), (Array.isArray(v.competencies) ? v.competencies : []).map((c, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "5px"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "justifyContent": "space-between",
        "fontSize": "12.5px"
      }
    }, React.createElement("span", {
      style: {
        "fontWeight": "600"
      }
    }, ix(c?.label)), React.createElement("span", {
      style: {
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontWeight": "700",
        "color": "#0072a3"
      }
    }, ix(c?.v))), React.createElement("div", {
      style: {
        "height": "7px",
        "borderRadius": "999px",
        "background": "rgba(125,145,180,.18)",
        "overflow": "hidden",
        "flexShrink": "0"
      }
    }, React.createElement("div", {
      style: S(c?.bar)
    })))))), React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "16px",
        "padding": "14px",
        "background": "rgba(255,255,255,.68)"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".7px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Supervisor note"), React.createElement("div", {
      style: {
        "fontSize": "13px",
        "lineHeight": "1.55",
        "marginTop": "6px",
        "color": "#16202e",
        "textWrap": "pretty"
      }
    }, ix(v.supervisorNote))), React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "8px"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".7px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Goals for next cycle"), (Array.isArray(v.goals) ? v.goals : []).map((g, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px",
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "13px",
        "padding": "11px 12px",
        "background": "rgba(255,255,255,.65)"
      }
    }, React.createElement("span", {
      style: S(g?.dot)
    }), React.createElement("span", {
      style: {
        "flex": "1",
        "fontSize": "13px",
        "fontWeight": "600"
      }
    }, ix(g?.label)), React.createElement("span", {
      style: {
        "fontSize": "11px",
        "color": "#6c7a8c"
      }
    }, ix(g?.due)))))))) : null;
  }
  function Screen_sProfile(v) {
    return v.sProfile ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "flex": "1",
        "minHeight": "0",
        "overflow": "auto",
        "padding": "14px 16px 20px",
        "display": "flex",
        "flexDirection": "column",
        "gap": "14px",
        "animation": "pop .3s ease backwards"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "14px",
        "border": "1px solid rgba(255,255,255,.92)",
        "borderRadius": "18px",
        "padding": "16px",
        "background": "rgba(255,255,255,.72)",
        "boxShadow": "0 12px 32px rgba(31,59,90,.1)"
      }
    }, v.isNurse ? React.createElement(React.Fragment, null, React.createElement("img", {
      src: v.avatarUrl,
      alt: "",
      style: {
        "width": "64px",
        "height": "64px",
        "borderRadius": "18px",
        "objectFit": "cover",
        "boxShadow": "0 0 0 3px rgba(122,196,232,.4)"
      }
    })) : null, v.isIncharge ? React.createElement(React.Fragment, null, React.createElement("img", {
      src: v.avatarUrl,
      alt: "",
      style: {
        "width": "64px",
        "height": "64px",
        "borderRadius": "18px",
        "objectFit": "cover",
        "boxShadow": "0 0 0 3px rgba(122,196,232,.4)"
      }
    })) : null, React.createElement("div", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "17px",
        "fontWeight": "800",
        "letterSpacing": "-.2px"
      }
    }, ix(v.staffName)), React.createElement("div", {
      style: {
        "fontSize": "12.5px",
        "color": "#6c7a8c"
      }
    }, ix(v.designation), " · ", ix(v.dept)), React.createElement("div", {
      style: {
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "11.5px",
        "color": "#0072a3",
        "fontWeight": "700",
        "marginTop": "3px"
      }
    }, ix(v.empIdShown)))), React.createElement("div", {
      style: {
        "display": "grid",
        "gridTemplateColumns": "1fr 1fr",
        "gap": "8px"
      }
    }, (Array.isArray(v.profileFacts) ? v.profileFacts : []).map((f, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "13px",
        "padding": "10px 12px",
        "background": "rgba(255,255,255,.65)"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "10px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, ix(f?.label)), React.createElement("div", {
      style: {
        "fontSize": "13px",
        "fontWeight": "700",
        "marginTop": "3px"
      }
    }, ix(f?.v)))))), React.createElement("button", {
      onClick: v.goPerformance,
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "12px",
        "textAlign": "left",
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "15px",
        "padding": "13px 14px",
        "background": "linear-gradient(140deg,rgba(58,181,167,.16),rgba(255,255,255,.7))",
        "cursor": "pointer",
        "color": "#16202e"
      }
    }, React.createElement("span", {
      style: {
        "display": "grid",
        "placeItems": "center",
        "width": "40px",
        "height": "40px",
        "borderRadius": "12px",
        "background": "rgba(58,181,167,.2)",
        "color": "#1e8a7c"
      }
    }, React.createElement("svg", {
      width: "19",
      height: "19",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M18 20V10M12 20V4M6 20v-6"
    }))), React.createElement("span", {
      style: {
        "flex": "1"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "14px",
        "fontWeight": "800"
      }
    }, "My performance"), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "12px",
        "color": "#6c7a8c"
      }
    }, "Appraisal score ", ix(v.score), " · ", ix(v.cycleLabel))), React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "#9aa6b4",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M9 6l6 6-6 6"
    }))), React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "16px",
        "background": "rgba(255,255,255,.68)",
        "overflow": "hidden",
        "flexShrink": "0"
      }
    }, React.createElement("div", {
      style: {
        "padding": "12px 14px 4px",
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".7px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Settings"), (Array.isArray(v.settings) ? v.settings : []).map((s, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "12px",
        "padding": "12px 14px",
        "borderTop": "1px solid rgba(125,145,180,.14)"
      }
    }, React.createElement("span", {
      style: {
        "flex": "1"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "13.5px",
        "fontWeight": "600"
      }
    }, ix(s?.label)), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "11.5px",
        "color": "#6c7a8c"
      }
    }, ix(s?.sub))), s?.isToggle ? React.createElement(React.Fragment, null, React.createElement("button", {
      onClick: s?.go,
      style: S(s?.trackStyle)
    }, React.createElement("span", {
      style: S(s?.knobStyle)
    }))) : null, s?.isValue ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: {
        "fontSize": "12.5px",
        "fontWeight": "700",
        "color": "#0072a3"
      }
    }, ix(s?.value))) : null)))), React.createElement("button", {
      onClick: v.signOut,
      style: {
        "border": "1px solid rgba(210,58,82,.35)",
        "borderRadius": "13px",
        "padding": "13px",
        "background": "rgba(210,58,82,.07)",
        "color": "#b32e2e",
        "fontSize": "13.5px",
        "fontWeight": "700",
        "cursor": "pointer"
      }
    }, "Sign out"), React.createElement("div", {
      style: {
        "textAlign": "center",
        "fontSize": "11px",
        "color": "#9aa6b4"
      }
    }, ix(v.appFooter)))) : null;
  }
  function Screen_sRosterEdit(v) {
    return v.sRosterEdit ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "flex": "1",
        "minHeight": "0",
        "overflow": "auto",
        "padding": "14px 16px 20px",
        "display": "flex",
        "flexDirection": "column",
        "gap": "12px",
        "animation": "pop .3s ease backwards"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px"
      }
    }, React.createElement("button", {
      onClick: v.goRoster,
      style: {
        "width": "38px",
        "height": "38px",
        "borderRadius": "11px",
        "border": "1px solid rgba(255,255,255,.9)",
        "background": "rgba(255,255,255,.6)",
        "display": "grid",
        "placeItems": "center",
        "color": "#3c4858",
        "cursor": "pointer",
        "flexShrink": "0"
      }
    }, React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M15 6l-6 6 6 6"
    }))), React.createElement("div", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "19px",
        "fontWeight": "800",
        "letterSpacing": "-.3px"
      }
    }, "Make roster"), React.createElement("div", {
      style: {
        "fontSize": "12px",
        "color": "#6c7a8c",
        "whiteSpace": "nowrap",
        "overflow": "hidden",
        "textOverflow": "ellipsis"
      }
    }, ix(v.dept), " · ", ix(v.reMonthLabel))), React.createElement("span", {
      style: S(v.reStatusStyle)
    }, ix(v.reStatus)), React.createElement("div", {
      style: {
        "display": "inline-flex",
        "background": "rgba(255,255,255,.55)",
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "10px",
        "padding": "3px",
        "gap": "2px",
        "flexShrink": "0"
      }
    }, React.createElement("button", {
      onClick: v.rePrevMonth,
      style: {
        "width": "30px",
        "height": "30px",
        "border": "0",
        "borderRadius": "8px",
        "background": "transparent",
        "color": "#3c4858",
        "cursor": "pointer",
        "display": "grid",
        "placeItems": "center"
      }
    }, React.createElement("svg", {
      width: "15",
      height: "15",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M15 6l-6 6 6 6"
    }))), React.createElement("button", {
      onClick: v.reNextMonth,
      style: {
        "width": "30px",
        "height": "30px",
        "border": "0",
        "borderRadius": "8px",
        "background": "transparent",
        "color": "#3c4858",
        "cursor": "pointer",
        "display": "grid",
        "placeItems": "center"
      }
    }, React.createElement("svg", {
      width: "15",
      height: "15",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M9 6l6 6-6 6"
    }))))), React.createElement("div", {
      style: {
        "display": "grid",
        "gridTemplateColumns": "repeat(4,1fr)",
        "gap": "8px"
      }
    }, (Array.isArray(v.reStats) ? v.reStats : []).map((s, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "13px",
        "padding": "10px 6px",
        "background": "rgba(255,255,255,.62)",
        "textAlign": "center"
      }
    }, React.createElement("div", {
      style: S(`font-family:'IBM Plex Mono',monospace;font-size:19px;font-weight:600;line-height:1;color:${s?.color ?? ""}`)
    }, ix(s?.n)), React.createElement("div", {
      style: {
        "fontSize": "10px",
        "fontWeight": "700",
        "letterSpacing": ".4px",
        "textTransform": "uppercase",
        "color": "#7d8ea8",
        "marginTop": "4px"
      }
    }, ix(s?.label)))))), v.reLocked ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px",
        "border": "1px solid rgba(43,182,115,.35)",
        "borderRadius": "14px",
        "padding": "11px 13px",
        "background": "rgba(43,182,115,.1)",
        "fontSize": "12.5px",
        "color": "#1d8f57",
        "fontWeight": "600"
      }
    }, React.createElement("svg", {
      width: "16",
      height: "16",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"
    })), React.createElement("span", {
      style: {
        "flex": "1"
      }
    }, ix(v.reLockedText)))) : null, React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "6px",
        "overflowX": "auto",
        "padding": "2px 2px 4px",
        "scrollbarWidth": "none",
        "flexShrink": "0"
      }
    }, (Array.isArray(v.reDays) ? v.reDays : []).map((d, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: d?.go,
      style: S(d?.style)
    }, React.createElement("span", {
      style: {
        "fontSize": "9.5px",
        "fontWeight": "700",
        "letterSpacing": ".3px",
        "textTransform": "uppercase",
        "opacity": ".75"
      }
    }, ix(d?.dow)), React.createElement("span", {
      style: {
        "fontSize": "15px",
        "fontWeight": "800",
        "lineHeight": "1.1"
      }
    }, ix(d?.d)), React.createElement("span", {
      style: {
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "9.5px",
        "opacity": ".85"
      }
    }, ix(d?.on)))))), React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "8px",
        "flexWrap": "wrap"
      }
    }, React.createElement("span", {
      style: {
        "flex": "1",
        "fontSize": "12.5px",
        "fontWeight": "700",
        "color": "#16202e",
        "minWidth": "120px"
      }
    }, ix(v.reDayCover)), v.reEditable ? React.createElement(React.Fragment, null, React.createElement("button", {
      onClick: v.reCopyPrev,
      style: S(v.reToolStyle)
    }, "Copy previous day"), React.createElement("button", {
      onClick: v.reRepeatWeek,
      style: S(v.reToolStyle)
    }, "Repeat weekly →"), React.createElement("button", {
      onClick: v.reClearDay,
      style: S(v.reToolStyle)
    }, "Clear day")) : null), v.reNoStaff ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "border": "1px dashed rgba(125,145,180,.4)",
        "borderRadius": "14px",
        "padding": "18px",
        "background": "rgba(255,255,255,.5)",
        "textAlign": "center",
        "fontSize": "12.5px",
        "color": "#6c7a8c"
      }
    }, ix(v.reNoStaffText))) : null, React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "6px"
      }
    }, (Array.isArray(v.reRows) ? v.reRows : []).map((r, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px",
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "14px",
        "padding": "8px 10px",
        "background": "rgba(255,255,255,.66)"
      }
    }, r?.hasPhoto ? React.createElement(React.Fragment, null, React.createElement("img", {
      src: r?.photo,
      alt: "",
      style: {
        "width": "38px",
        "height": "38px",
        "borderRadius": "11px",
        "objectFit": "cover",
        "flexShrink": "0"
      }
    })) : null, r?.noPhoto ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: {
        "display": "grid",
        "placeItems": "center",
        "width": "38px",
        "height": "38px",
        "borderRadius": "11px",
        "color": "#fff",
        "fontSize": "11.5px",
        "fontWeight": "700",
        "flexShrink": "0",
        "background": "linear-gradient(135deg,#3ab5a7,#0090ca)"
      }
    }, ix(r?.ini))) : null, React.createElement("span", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "13px",
        "fontWeight": "700",
        "whiteSpace": "nowrap",
        "overflow": "hidden",
        "textOverflow": "ellipsis"
      }
    }, ix(r?.name)), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "11px",
        "color": "#6c7a8c",
        "whiteSpace": "nowrap",
        "overflow": "hidden",
        "textOverflow": "ellipsis"
      }
    }, ix(r?.sub))), React.createElement("span", {
      style: {
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "10px",
        "color": "#7d8ea8",
        "whiteSpace": "nowrap"
      }
    }, ix(r?.hours)), React.createElement("button", {
      onClick: r?.pick,
      style: S(r?.codeStyle)
    }, ix(r?.code)))))), v.reEditable ? React.createElement(React.Fragment, null, React.createElement("label", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "5px"
      }
    }, React.createElement("span", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, "Note to administration · optional"), React.createElement("input", {
      value: vx(v.reNote),
      onChange: v.setReNote,
      placeholder: "e.g. two nurses on study leave from 12th",
      style: {
        "border": "1px solid rgba(125,145,180,.3)",
        "borderRadius": "10px",
        "padding": "10px 12px",
        "fontSize": "13px",
        "background": "rgba(255,255,255,.85)",
        "outline": "none"
      }
    })), React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "8px"
      }
    }, React.createElement("button", {
      onClick: v.reSaveDraft,
      style: {
        "flex": "1",
        "border": "1px solid rgba(0,144,202,.35)",
        "borderRadius": "13px",
        "padding": "13px",
        "background": "rgba(0,144,202,.08)",
        "color": "#0072a3",
        "fontSize": "13.5px",
        "fontWeight": "700",
        "cursor": "pointer"
      }
    }, ix(v.reSaveLabel)), React.createElement("button", {
      onClick: v.reSubmit,
      style: {
        "flex": "1.4",
        "border": "0",
        "borderRadius": "13px",
        "padding": "13px",
        "background": "linear-gradient(140deg,#0aa0d4,#0072a3)",
        "color": "#fff",
        "fontSize": "13.5px",
        "fontWeight": "700",
        "cursor": "pointer",
        "boxShadow": "0 10px 24px rgba(0,144,202,.32)"
      }
    }, ix(v.reSubmitLabel)))) : null, React.createElement("button", {
      onClick: v.reOpenExport,
      style: {
        "display": "flex",
        "alignItems": "center",
        "justifyContent": "center",
        "gap": "8px",
        "border": "1px dashed rgba(106,82,212,.5)",
        "borderRadius": "14px",
        "padding": "12px",
        "background": "rgba(106,82,212,.06)",
        "color": "#6a52d4",
        "fontSize": "13px",
        "fontWeight": "700",
        "cursor": "pointer"
      }
    }, React.createElement("svg", {
      width: "16",
      height: "16",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"
    })), "Export roster · share, copy, WhatsApp"), React.createElement("div", {
      style: {
        "textAlign": "center",
        "fontSize": "11px",
        "color": "#9aa6b4"
      }
    }, ix(v.reFooter))), v.rePickOpen ? React.createElement(React.Fragment, null, React.createElement("div", {
      onClick: v.reClosePick,
      style: {
        "position": "absolute",
        "inset": "0",
        "background": "rgba(13,28,50,.45)",
        "zIndex": "30",
        "display": "flex",
        "alignItems": "flex-end"
      }
    }, React.createElement("div", {
      style: {
        "width": "100%",
        "background": "#fff",
        "borderRadius": "22px 22px 0 0",
        "padding": "16px 16px 22px",
        "display": "flex",
        "flexDirection": "column",
        "gap": "12px",
        "boxShadow": "0 -12px 40px rgba(0,0,0,.25)",
        "animation": "pop .25s ease"
      }
    }, React.createElement("div", {
      style: {
        "width": "44px",
        "height": "4px",
        "borderRadius": "2px",
        "background": "rgba(125,145,180,.4)",
        "margin": "0 auto"
      }
    }), React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px"
      }
    }, React.createElement("div", {
      style: {
        "flex": "1"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "15px",
        "fontWeight": "800"
      }
    }, ix(v.rePickName)), React.createElement("div", {
      style: {
        "fontSize": "12px",
        "color": "#6c7a8c"
      }
    }, ix(v.rePickSub))), React.createElement("button", {
      onClick: v.reClosePick,
      style: {
        "width": "34px",
        "height": "34px",
        "borderRadius": "10px",
        "border": "1px solid rgba(125,145,180,.3)",
        "background": "rgba(255,255,255,.8)",
        "color": "#3c4858",
        "cursor": "pointer",
        "display": "grid",
        "placeItems": "center"
      }
    }, React.createElement("svg", {
      width: "16",
      height: "16",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round"
    }, React.createElement("path", {
      d: "M6 6l12 12M18 6L6 18"
    })))), (Array.isArray(v.reCodeGroups) ? v.reCodeGroups : []).map((g, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".6px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, ix(g?.label)), React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "6px",
        "flexWrap": "wrap"
      }
    }, (Array.isArray(g?.codes) ? g?.codes : []).map((c, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: c?.go,
      style: S(c?.style)
    }, React.createElement("span", {
      style: {
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "13px",
        "fontWeight": "700"
      }
    }, ix(c?.code)), React.createElement("span", {
      style: {
        "fontSize": "10px",
        "opacity": ".8"
      }
    }, ix(c?.label))))))))))) : null, v.reExportOpen ? React.createElement(React.Fragment, null, React.createElement("div", {
      onClick: v.reCloseExport,
      style: {
        "position": "absolute",
        "inset": "0",
        "background": "rgba(13,28,50,.45)",
        "zIndex": "30",
        "display": "flex",
        "alignItems": "flex-end"
      }
    }, React.createElement("div", {
      style: {
        "width": "100%",
        "background": "#fff",
        "borderRadius": "22px 22px 0 0",
        "padding": "16px 16px 22px",
        "display": "flex",
        "flexDirection": "column",
        "gap": "10px",
        "boxShadow": "0 -12px 40px rgba(0,0,0,.25)",
        "animation": "pop .25s ease"
      }
    }, React.createElement("div", {
      style: {
        "width": "44px",
        "height": "4px",
        "borderRadius": "2px",
        "background": "rgba(125,145,180,.4)",
        "margin": "0 auto"
      }
    }), React.createElement("div", {
      style: {
        "fontSize": "15px",
        "fontWeight": "800"
      }
    }, "Export roster"), React.createElement("div", {
      style: {
        "fontSize": "12px",
        "color": "#6c7a8c"
      }
    }, ix(v.reExportSub)), React.createElement("div", {
      style: {
        "display": "grid",
        "gridTemplateColumns": "repeat(3,1fr)",
        "gap": "8px"
      }
    }, (Array.isArray(v.reExportOpts) ? v.reExportOpts : []).map((o, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: o?.go,
      style: S(`display:flex;flex-direction:column;align-items:center;gap:6px;border:1px solid rgba(125,145,180,.2);border-radius:13px;padding:12px 4px;background:rgba(255,255,255,.9);cursor:pointer;color:${o?.color ?? ""}`)
    }, React.createElement("span", {
      style: S(`display:grid;place-items:center;width:38px;height:38px;border-radius:11px;background:${o?.bg ?? ""}`)
    }, React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: o?.d
    }))), React.createElement("span", {
      style: {
        "fontSize": "11.5px",
        "fontWeight": "700",
        "color": "#16202e"
      }
    }, ix(o?.label)))))), React.createElement("pre", {
      style: {
        "margin": "0",
        "maxHeight": "160px",
        "overflow": "auto",
        "border": "1px solid rgba(125,145,180,.2)",
        "borderRadius": "10px",
        "padding": "10px",
        "background": "rgba(125,145,180,.08)",
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "10.5px",
        "lineHeight": "1.4",
        "whiteSpace": "pre"
      }
    }, ix(v.reExportText))))) : null) : null;
  }
  function Screen_sUnitStaff(v) {
    return v.sUnitStaff ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "flex": "1",
        "minHeight": "0",
        "overflow": "auto",
        "padding": "14px 16px 20px",
        "display": "flex",
        "flexDirection": "column",
        "gap": "12px",
        "animation": "pop .3s ease backwards"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "10px"
      }
    }, React.createElement("button", {
      onClick: v.openDrawer,
      style: {
        "width": "38px",
        "height": "38px",
        "borderRadius": "11px",
        "border": "1px solid rgba(255,255,255,.9)",
        "background": "rgba(255,255,255,.6)",
        "display": "grid",
        "placeItems": "center",
        "color": "#3c4858",
        "cursor": "pointer",
        "flexShrink": "0"
      }
    }, React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round"
    }, React.createElement("path", {
      d: "M4 7h16M4 12h16M4 17h10"
    }))), React.createElement("div", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "19px",
        "fontWeight": "800",
        "letterSpacing": "-.3px"
      }
    }, "My unit staff"), React.createElement("div", {
      style: {
        "fontSize": "12px",
        "color": "#6c7a8c",
        "whiteSpace": "nowrap",
        "overflow": "hidden",
        "textOverflow": "ellipsis"
      }
    }, ix(v.dept), " · ", ix(v.usSummary))), React.createElement("button", {
      onClick: v.goRosterEdit,
      style: {
        "border": "1px solid rgba(0,144,202,.35)",
        "borderRadius": "10px",
        "padding": "8px 11px",
        "background": "rgba(0,144,202,.08)",
        "color": "#0072a3",
        "fontSize": "11.5px",
        "fontWeight": "700",
        "cursor": "pointer",
        "whiteSpace": "nowrap"
      }
    }, "Roster")), React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "9px",
        "border": "1px solid rgba(255,255,255,.95)",
        "borderRadius": "13px",
        "padding": "10px 13px",
        "background": "rgba(255,255,255,.8)",
        "flexShrink": "0"
      }
    }, React.createElement("svg", {
      width: "16",
      height: "16",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "#6c7a8c",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("circle", {
      cx: "11",
      cy: "11",
      r: "7"
    }), React.createElement("path", {
      d: "M21 21l-4.3-4.3"
    })), React.createElement("input", {
      value: vx(v.usSearch),
      onChange: v.setUsSearch,
      placeholder: "Name, ID, designation",
      style: {
        "flex": "1",
        "border": "0",
        "background": "transparent",
        "fontSize": "13.5px",
        "outline": "none",
        "minWidth": "0"
      }
    })), React.createElement("div", {
      style: {
        "display": "flex",
        "gap": "6px",
        "overflowX": "auto",
        "paddingBottom": "2px",
        "scrollbarWidth": "none",
        "flexShrink": "0"
      }
    }, (Array.isArray(v.usFilters) ? v.usFilters : []).map((f, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: f?.go,
      style: S(f?.style)
    }, ix(f?.label))))), v.usHasEvents ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "border": "1px solid rgba(224,138,30,.35)",
        "borderRadius": "16px",
        "padding": "12px 13px",
        "background": "linear-gradient(140deg,rgba(224,138,30,.12),rgba(255,255,255,.75))"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700",
        "letterSpacing": ".7px",
        "textTransform": "uppercase",
        "color": "#b8650a",
        "marginBottom": "8px"
      }
    }, "This month · birthdays & anniversaries"), React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "6px"
      }
    }, (Array.isArray(v.usEvents) ? v.usEvents : []).map((e, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "9px",
        "fontSize": "12.5px"
      }
    }, React.createElement("span", {
      style: S(e?.dot)
    }), React.createElement("span", {
      style: {
        "flex": "1",
        "fontWeight": "600"
      }
    }, ix(e?.name)), React.createElement("span", {
      style: {
        "color": "#6c7a8c"
      }
    }, ix(e?.text)))))))) : null, v.usEmpty ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "border": "1px dashed rgba(125,145,180,.4)",
        "borderRadius": "14px",
        "padding": "18px",
        "background": "rgba(255,255,255,.5)",
        "textAlign": "center",
        "fontSize": "12.5px",
        "color": "#6c7a8c"
      }
    }, ix(v.usEmptyText))) : null, React.createElement("div", {
      style: {
        "display": "flex",
        "flexDirection": "column",
        "gap": "8px"
      }
    }, (Array.isArray(v.usList) ? v.usList : []).map((p, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "border": "1px solid rgba(255,255,255,.9)",
        "borderRadius": "16px",
        "padding": "11px 12px",
        "background": "rgba(255,255,255,.7)",
        "display": "flex",
        "flexDirection": "column",
        "gap": "9px"
      }
    }, React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "11px"
      }
    }, p?.hasPhoto ? React.createElement(React.Fragment, null, React.createElement("img", {
      src: p?.photo,
      alt: "",
      style: {
        "width": "52px",
        "height": "52px",
        "borderRadius": "15px",
        "objectFit": "cover",
        "flexShrink": "0",
        "boxShadow": "0 0 0 2px rgba(122,196,232,.4)"
      }
    })) : null, p?.noPhoto ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: {
        "display": "grid",
        "placeItems": "center",
        "width": "52px",
        "height": "52px",
        "borderRadius": "15px",
        "color": "#fff",
        "fontSize": "14px",
        "fontWeight": "700",
        "flexShrink": "0",
        "background": "linear-gradient(135deg,#3ab5a7,#0090ca)"
      }
    }, ix(p?.ini))) : null, React.createElement("span", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "14px",
        "fontWeight": "800",
        "whiteSpace": "nowrap",
        "overflow": "hidden",
        "textOverflow": "ellipsis"
      }
    }, ix(p?.name)), React.createElement("span", {
      style: {
        "display": "block",
        "fontSize": "11.5px",
        "color": "#6c7a8c",
        "whiteSpace": "nowrap",
        "overflow": "hidden",
        "textOverflow": "ellipsis"
      }
    }, ix(p?.designation)), React.createElement("span", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "6px",
        "marginTop": "3px"
      }
    }, React.createElement("span", {
      style: {
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "11px",
        "fontWeight": "700",
        "color": "#0072a3"
      }
    }, ix(p?.empId)), React.createElement("span", {
      style: S(p?.roleStyle)
    }, ix(p?.role)), p?.badge ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: S(p?.badgeStyle)
    }, ix(p?.badge))) : null)), p?.canCall ? React.createElement(React.Fragment, null, React.createElement("a", {
      href: p?.tel,
      style: {
        "width": "36px",
        "height": "36px",
        "borderRadius": "10px",
        "border": "1px solid rgba(43,182,115,.3)",
        "background": "rgba(43,182,115,.1)",
        "color": "#1d8f57",
        "display": "grid",
        "placeItems": "center",
        "flexShrink": "0",
        "textDecoration": "none"
      }
    }, React.createElement("svg", {
      width: "15",
      height: "15",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1.9.4 1.8.7 2.6a2 2 0 01-.5 2.1L8 9.7a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.4c.8.3 1.7.5 2.6.7a2 2 0 011.7 2z"
    })))) : null), React.createElement("div", {
      style: {
        "display": "grid",
        "gridTemplateColumns": "repeat(3,1fr)",
        "gap": "6px"
      }
    }, (Array.isArray(p?.facts) ? p?.facts : []).map((f, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "border": "1px solid rgba(125,145,180,.15)",
        "borderRadius": "10px",
        "padding": "7px 8px",
        "background": "rgba(255,255,255,.6)"
      }
    }, React.createElement("div", {
      style: {
        "fontSize": "9.5px",
        "fontWeight": "700",
        "letterSpacing": ".5px",
        "textTransform": "uppercase",
        "color": "#7d8ea8"
      }
    }, ix(f?.label)), React.createElement("div", {
      style: {
        "fontSize": "12px",
        "fontWeight": "700",
        "marginTop": "2px",
        "whiteSpace": "nowrap",
        "overflow": "hidden",
        "textOverflow": "ellipsis"
      }
    }, ix(f?.v)))))), React.createElement("div", {
      style: {
        "display": "flex",
        "alignItems": "center",
        "gap": "8px",
        "fontSize": "11.5px",
        "color": "#6c7a8c"
      }
    }, React.createElement("span", {
      style: S(p?.appDot)
    }), React.createElement("span", {
      style: {
        "flex": "1",
        "whiteSpace": "nowrap",
        "overflow": "hidden",
        "textOverflow": "ellipsis"
      }
    }, ix(p?.appLine)), p?.canMsg ? React.createElement(React.Fragment, null, React.createElement("button", {
      onClick: p?.msg,
      style: {
        "border": "1px solid rgba(0,144,202,.3)",
        "borderRadius": "9px",
        "padding": "5px 10px",
        "background": "rgba(0,144,202,.08)",
        "color": "#0072a3",
        "fontSize": "11px",
        "fontWeight": "700",
        "cursor": "pointer"
      }
    }, "Message")) : null))))))) : null;
  }
  function Screen_showNav(v) {
    return v.showNav ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        "flexShrink": "0",
        "display": "grid",
        "gridTemplateColumns": "repeat(5,1fr)",
        "padding": "6px 8px 8px",
        "background": "rgba(255,255,255,.78)",
        "backdropFilter": "blur(20px)",
        "WebkitBackdropFilter": "blur(20px)",
        "borderTop": "1px solid rgba(255,255,255,.95)",
        "boxShadow": "0 -8px 28px rgba(31,59,90,.08)"
      }
    }, (Array.isArray(v.navItems) ? v.navItems : []).map((n, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: n?.go,
      style: S(n?.style)
    }, React.createElement("span", {
      style: S(n?.iconWrap)
    }, React.createElement("svg", {
      width: "20",
      height: "20",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: n?.d
    })), n?.badge ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: {
        "position": "absolute",
        "top": "-3px",
        "right": "-6px",
        "minWidth": "16px",
        "height": "16px",
        "padding": "0 4px",
        "borderRadius": "8px",
        "background": "#d23a52",
        "color": "#fff",
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "9.5px",
        "fontWeight": "700",
        "display": "grid",
        "placeItems": "center",
        "border": "2px solid #fff",
        "boxSizing": "content-box"
      }
    }, ix(n?.badge))) : null), React.createElement("span", {
      style: {
        "fontSize": "10.5px",
        "fontWeight": "700"
      }
    }, ix(n?.label))))))) : null;
  }
  function Screen_drawerOpen(v) {
    return v.drawerOpen ? React.createElement(React.Fragment, null, React.createElement("div", {
      onClick: v.closeDrawer,
      style: {
        "position": "absolute",
        "inset": "0",
        "zIndex": "20",
        "background": "rgba(13,28,50,.45)",
        "backdropFilter": "blur(3px)",
        "WebkitBackdropFilter": "blur(3px)",
        "animation": "fadeIn .2s ease"
      }
    }), React.createElement("div", {
      style: {
        "position": "absolute",
        "top": "0",
        "left": "0",
        "bottom": "0",
        "width": "296px",
        "zIndex": "21",
        "display": "flex",
        "flexDirection": "column",
        "background": "linear-gradient(180deg,rgba(13,28,50,.97),rgba(8,17,32,.96))",
        "color": "#c7d2e0",
        "boxShadow": "12px 0 40px rgba(0,0,0,.35)",
        "animation": "drawerIn .28s cubic-bezier(.2,.7,.3,1)",
        "overflow": "hidden",
        "flexShrink": "0"
      }
    }, React.createElement("div", {
      style: {
        "position": "absolute",
        "top": "-70px",
        "left": "-50px",
        "width": "230px",
        "height": "210px",
        "borderRadius": "50%",
        "background": "radial-gradient(circle,rgba(39,168,219,.42),transparent 70%)",
        "filter": "blur(18px)",
        "pointerEvents": "none"
      }
    }), React.createElement("div", {
      style: {
        "position": "relative",
        "display": "flex",
        "alignItems": "center",
        "gap": "12px",
        "padding": "18px 18px 14px",
        "borderBottom": "1px solid rgba(255,255,255,.08)"
      }
    }, v.isNurse ? React.createElement(React.Fragment, null, React.createElement("img", {
      src: v.avatarUrl,
      alt: "",
      style: {
        "width": "46px",
        "height": "46px",
        "borderRadius": "14px",
        "objectFit": "cover",
        "boxShadow": "0 0 0 2px rgba(122,196,232,.35)"
      }
    })) : null, v.isIncharge ? React.createElement(React.Fragment, null, React.createElement("img", {
      src: v.avatarUrl,
      alt: "",
      style: {
        "width": "46px",
        "height": "46px",
        "borderRadius": "14px",
        "objectFit": "cover",
        "boxShadow": "0 0 0 2px rgba(122,196,232,.35)"
      }
    })) : null, React.createElement("div", {
      style: {
        "flex": "1",
        "minWidth": "0"
      }
    }, React.createElement("div", {
      style: {
        "color": "#fff",
        "fontSize": "14px",
        "fontWeight": "700",
        "whiteSpace": "nowrap",
        "overflow": "hidden",
        "textOverflow": "ellipsis"
      }
    }, ix(v.staffName)), React.createElement("div", {
      style: {
        "color": "#83909f",
        "fontSize": "11.5px"
      }
    }, ix(v.designation), " · ", ix(v.dept)), React.createElement("div", {
      style: {
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "10.5px",
        "color": "#7ac4e8",
        "marginTop": "2px"
      }
    }, ix(v.empIdShown))), React.createElement("button", {
      onClick: v.closeDrawer,
      style: {
        "width": "32px",
        "height": "32px",
        "borderRadius": "9px",
        "border": "0",
        "background": "rgba(255,255,255,.08)",
        "color": "#cfe0f0",
        "display": "grid",
        "placeItems": "center",
        "cursor": "pointer"
      }
    }, React.createElement("svg", {
      width: "15",
      height: "15",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.4",
      strokeLinecap: "round"
    }, React.createElement("path", {
      d: "M6 6l12 12M18 6L6 18"
    })))), React.createElement("div", {
      style: {
        "position": "relative",
        "flex": "1",
        "overflowY": "auto",
        "padding": "8px 10px 10px"
      }
    }, (Array.isArray(v.drawerGroups) ? v.drawerGroups : []).map((g, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("div", {
      style: {
        "padding": "14px 10px 6px",
        "fontSize": "10px",
        "letterSpacing": ".9px",
        "textTransform": "uppercase",
        "color": "#7d8ea8",
        "fontWeight": "700"
      }
    }, ix(g?.sec)), (Array.isArray(g?.items) ? g?.items : []).map((it, $index) => React.createElement(React.Fragment, {
      key: $index
    }, React.createElement("button", {
      onClick: it?.go,
      style: S(it?.style),
      className: "dcp1"
    }, React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "1.9",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      style: {
        "flexShrink": "0"
      }
    }, React.createElement("path", {
      d: it?.d
    })), React.createElement("span", {
      style: {
        "flex": "1",
        "textAlign": "left"
      }
    }, ix(it?.label)), it?.badge ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: {
        "fontFamily": "'IBM Plex Mono',monospace",
        "fontSize": "10px",
        "fontWeight": "700",
        "minWidth": "18px",
        "textAlign": "center",
        "padding": "1px 6px",
        "borderRadius": "9px",
        "color": "#fff",
        "background": "#d23a52"
      }
    }, ix(it?.badge))) : null, it?.tag ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: {
        "fontSize": "8.6px",
        "fontWeight": "800",
        "letterSpacing": ".6px",
        "padding": "2px 6px",
        "borderRadius": "5px",
        "color": "#0d1b2e",
        "background": "linear-gradient(135deg,#5fd3c4,#3ab5a7)"
      }
    }, ix(it?.tag))) : null)))))), React.createElement("div", {
      style: {
        "position": "relative",
        "margin": "10px",
        "padding": "10px 12px",
        "border": "1px solid rgba(255,255,255,.12)",
        "borderRadius": "12px",
        "background": "rgba(255,255,255,.06)",
        "display": "flex",
        "alignItems": "center",
        "gap": "9px",
        "flexShrink": "0"
      }
    }, React.createElement("img", {
      src: "assets/logo.svg",
      alt: "UNICO",
      style: {
        "height": "22px",
        "width": "auto",
        "filter": "brightness(0) invert(1)",
        "opacity": ".9"
      }
    }), React.createElement("span", {
      style: {
        "flex": "1",
        "fontSize": "10.5px",
        "color": "#83909f",
        "lineHeight": "1.3"
      }
    }, ix(v.hospitalName), React.createElement("br", null), ix(v.appLabel)), React.createElement("button", {
      title: "Sign out",
      onClick: v.signOut,
      style: {
        "display": "grid",
        "placeItems": "center",
        "width": "32px",
        "height": "32px",
        "borderRadius": "8px",
        "color": "#cfe0f0",
        "background": "rgba(255,255,255,.08)",
        "cursor": "pointer",
        "border": "0"
      },
      className: "dcp2"
    }, React.createElement("svg", {
      width: "16",
      height: "16",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"
    })))))) : null;
  }
  function NurseAppView({
    v
  }) {
    return React.createElement(AndroidDevice, null, React.createElement("div", {
      style: {
        "height": "100%",
        "display": "flex",
        "flexDirection": "column",
        "fontFamily": "'IBM Plex Sans',system-ui,sans-serif",
        "color": "#16202e",
        "background": "radial-gradient(420px 300px at 10% -5%,rgba(0,144,202,.22),transparent 65%),radial-gradient(380px 300px at 100% 8%,rgba(58,181,167,.22),transparent 65%),radial-gradient(420px 320px at 80% 100%,rgba(106,82,212,.16),transparent 65%),linear-gradient(180deg,#eef3fb,#e4ecf8)",
        "position": "relative",
        "overflow": "hidden",
        "flexShrink": "0"
      }
    }, Screen_sLogin(v), Screen_sHome(v), Screen_sRoster(v), Screen_sShift(v), Screen_sRequests(v), Screen_sNewRequest(v), Screen_sChats(v), Screen_sThread(v), Screen_sMeds(v), Screen_sMedRequest(v), Screen_sMedDetail(v), Screen_sNotices(v), Screen_sNoticeDetail(v), Screen_sCompose(v), Screen_sStaff(v), Screen_sStaffDetail(v), Screen_sReports(v), Screen_sIndicator(v), Screen_sShiftReport(v), Screen_sDatacol(v), Screen_sDatacolForm(v), Screen_sDatacolHistory(v), Screen_sHandover(v), Screen_sIncident(v), Screen_sPerformance(v), Screen_sProfile(v), Screen_sRosterEdit(v), Screen_sUnitStaff(v), Screen_showNav(v), Screen_drawerOpen(v)));
  }
  NurseAppView.CSS = "body{margin:0;background:#e9eff8;color:#16202e;font-family:'IBM Plex Sans',system-ui,sans-serif;font-size:13px;line-height:1.45;-webkit-font-smoothing:antialiased}\nbody::before{content:\"\";position:fixed;inset:0;z-index:-1;pointer-events:none;background:radial-gradient(900px 620px at 12% -8%,rgba(0,144,202,.26),transparent 62%),radial-gradient(820px 560px at 90% 6%,rgba(58,181,167,.24),transparent 62%),radial-gradient(950px 720px at 78% 98%,rgba(106,82,212,.2),transparent 62%),linear-gradient(180deg,#eef3fb,#e4ecf8)}\na{color:#0072a3}a:hover{color:#0090ca}\ninput,button,textarea{font-family:inherit}\n*{scrollbar-width:thin;scrollbar-color:rgba(0,144,202,.4) transparent}\n::-webkit-scrollbar{width:6px;height:6px}::-webkit-scrollbar-track{background:transparent}\n::-webkit-scrollbar-thumb{background:rgba(0,114,163,.4);border-radius:10px}\n@keyframes pop{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}\n@keyframes livepulse{0%{box-shadow:0 0 0 0 rgba(61,220,151,.6)}70%{box-shadow:0 0 0 8px rgba(61,220,151,0)}100%{box-shadow:0 0 0 0 rgba(61,220,151,0)}}\n@keyframes orbFloat{from{transform:translate(0,0) scale(1)}to{transform:translate(40px,30px) scale(1.15)}}\n@keyframes drawerIn{from{transform:translateX(-100%)}to{transform:none}}\n@keyframes fadeIn{from{opacity:0}to{opacity:1}}\n@keyframes blink{0%,100%{opacity:.25}50%{opacity:1}}\n@keyframes rayspin{to{transform:rotate(360deg)}}\n.dcp0:hover{background:rgba(255,255,255,.9) !important}\n.dcp1:hover{background:rgba(255,255,255,.08) !important;color:#fff !important}\n.dcp2:hover{background:rgba(210,58,82,.25) !important;color:#ff8ba0 !important}";
  window.NurseAppView = NurseAppView;
})();
})();
;
/* ===== nurse-app.jsx ===== */
(function(){
(function () {
  'use strict';

  const React = window.React;
  const {
    api,
    tryApi,
    pageAll,
    mount
  } = window.DC;
  const D = window.NURSE_APP_DATA;
  const RS = window.UNICO_ROSTER || null;
  const AP = window.UNICO_APPRAISAL || null;
  const View = window.NurseAppView;
  const {
    SHIFTS,
    PATTERN,
    TEAM,
    ini,
    MED_CATS,
    FOODS,
    PREGS,
    MED_TABS,
    SEC_COLOR,
    CATS,
    ATTACH_ICONS,
    NOTICES,
    DEPTS,
    CHATS,
    CENSUS,
    DAYS7,
    INDICATORS,
    IND_PLAIN,
    ragOf,
    RAG,
    SR_STEPS,
    DC_STAT_FIELDS,
    DC_ITEMS,
    DC_ST,
    DC_GUIDES,
    ALL_STAFF,
    pillBtn,
    chip,
    catStyle,
    statusStyle,
    typeStyle,
    avStyle
  } = D;
  const NOW = new Date();
  const Y = NOW.getFullYear(),
    M = NOW.getMonth(),
    TODAY = NOW.getDate();
  const DIM = new Date(Y, M + 1, 0).getDate();
  const FIRST_DOW = (new Date(Y, M, 1).getDay() + 6) % 7;
  const DOWS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const MON3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dowOf = d => DOWS[(FIRST_DOW + d - 1 + 700) % 7];
  const dateLabel = d => dowOf(d) + ', ' + d + ' ' + MON3[M];
  const monthLabel = MONTHS[M] + ' ' + Y;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const pad2 = n => String(n).padStart(2, '0');
  const isoDay = d => Y + '-' + pad2(M + 1) + '-' + pad2(d);
  const hm = t => t.getHours() + ':' + pad2(t.getMinutes());
  const timeNow = () => hm(new Date());
  const dayStamp = () => {
    const d = new Date();
    return pad2(d.getDate()) + ' ' + MON3[d.getMonth()] + ' ' + timeNow();
  };
  const fmtTs = ts => {
    if (!ts) return '';
    const t = new Date(ts);
    return pad2(t.getDate()) + ' ' + MON3[t.getMonth()] + ' ' + hm(t);
  };
  const fmtIso = iso => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    if (!m) return String(iso || '—');
    return Number(m[3]) + ' ' + MON3[Number(m[2]) - 1] + (Number(m[1]) !== Y ? ' ' + m[1] : '');
  };
  const ago = ts => {
    if (!ts) return '';
    const d = Date.now() - ts;
    if (d < 0) return 'Scheduled · ' + fmtTs(ts);
    if (d < 60e3) return 'Just now';
    if (d < 3600e3) return Math.round(d / 60e3) + ' min ago';
    const t = new Date(ts),
      now = new Date();
    if (t.toDateString() === now.toDateString()) return hm(t);
    const y = new Date();
    y.setDate(y.getDate() - 1);
    if (t.toDateString() === y.toDateString()) return 'Yesterday ' + hm(t);
    return t.getDate() + ' ' + MON3[t.getMonth()] + (t.getFullYear() !== Y ? ' ' + t.getFullYear() : '');
  };
  const norm = x => String(x || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  const cap = x => String(x || '').replace(/^./, c => c.toUpperCase());
  const MONO = "font-family:'IBM Plex Mono',monospace";
  const BLUE_BTN = 'background:linear-gradient(140deg,#0aa0d4,#0072a3);color:#fff;box-shadow:0 10px 24px rgba(0,144,202,.32)';
  const BUCKET = {
    M: SHIFTS.M4,
    E: SHIFTS.E3,
    N: SHIFTS.N2,
    G: {
      name: 'General',
      color: '#1e8a7c',
      bg: 'rgba(58,181,167,.16)'
    }
  };
  const NONE = {
    name: 'Not published',
    time: '',
    hours: '—',
    color: '#9aa6b4',
    bg: 'rgba(125,145,180,.12)'
  };
  function shiftOf(code) {
    if (code === '' || code == null) return NONE;
    if (code === '—') return SHIFTS.O;
    if (SHIFTS[code]) return SHIFTS[code];
    const spec = RS && RS.BY_CODE && RS.BY_CODE[code];
    if (RS && RS.isLeave && RS.isLeave(code)) return Object.assign({}, SHIFTS.CL, {
      name: spec && spec.label || 'Leave'
    });
    if (RS && RS.isOff && RS.isOff(code)) return SHIFTS.O;
    if (spec) {
      const b = BUCKET[spec.bucket] || SHIFTS.O;
      return {
        name: b.name || spec.label,
        time: spec.label,
        hours: (spec.hours || 0) + 'h',
        color: b.color,
        bg: b.bg
      };
    }
    const b = BUCKET[String(code)[0]];
    return b ? {
      name: b.name,
      time: '',
      hours: '—',
      color: b.color,
      bg: b.bg
    } : SHIFTS.O;
  }
  const isLeave = code => code === 'CL' || !!(RS && RS.isLeave && RS.isLeave(code));
  const isWork = code => {
    if (!code) return false;
    const b = shiftOf(code);
    return b !== SHIFTS.O && b !== NONE && b.name !== 'Off' && !isLeave(code);
  };
  const hoursOf = code => {
    const h = parseFloat(shiftOf(code).hours);
    return isNaN(h) ? 0 : h;
  };
  const codeChip = code => {
    const sh = shiftOf(code);
    return MONO + `;font-size:10.5px;font-weight:700;padding:2px 6px;border-radius:6px;color:${sh.color};background:${sh.bg}`;
  };
  const bucketOf = code => {
    const spec = RS && RS.BY_CODE && RS.BY_CODE[code];
    return spec && spec.bucket || String(code || '')[0] || '';
  };
  const toggle = on => ({
    trackStyle: `position:relative;width:44px;height:26px;border-radius:13px;border:0;cursor:pointer;flex-shrink:0;transition:background .2s;background:${on ? 'linear-gradient(140deg,#0aa0d4,#0072a3)' : 'rgba(125,145,180,.35)'}`,
    knobStyle: `position:absolute;top:3px;left:${on ? '21px' : '3px'};width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:left .2s`
  });
  const track = on => ({
    track: toggle(on).trackStyle,
    knob: toggle(on).knobStyle
  });
  const dot = c => `width:10px;height:10px;border-radius:50%;background:${c};flex-shrink:0;box-shadow:0 0 0 3px ${c}22`;
  const box = on => `display:grid;place-items:center;width:22px;height:22px;border-radius:7px;border:1.5px solid ${on ? 'transparent' : 'rgba(125,145,180,.45)'};background:${on ? 'linear-gradient(140deg,#0aa0d4,#0072a3)' : 'rgba(255,255,255,.8)'};flex-shrink:0;cursor:pointer`;
  const iconBtn = (on, color) => `width:38px;height:38px;border-radius:11px;border:1px solid ${on ? color : 'rgba(255,255,255,.9)'};background:${on ? color + '22' : 'rgba(255,255,255,.6)'};display:grid;place-items:center;color:${on ? color : '#3c4858'};cursor:pointer`;
  const inputStyle = 'width:60px;text-align:center;border:1px solid rgba(125,145,180,.3);border-radius:10px;padding:8px 6px;font-size:14px;font-weight:700;background:rgba(255,255,255,.85);outline:none;' + MONO;
  const roStyle = ro => `border:1px solid rgba(125,145,180,.3);border-radius:10px;padding:10px 12px;font-size:14px;font-weight:700;background:${ro ? 'rgba(125,145,180,.1)' : 'rgba(255,255,255,.85)'};color:${ro ? '#6c7a8c' : '#16202e'};outline:none;width:100%;box-sizing:border-box;` + MONO;
  const spark = (vals, color, max) => {
    const mx = max || Math.max(1, ...vals);
    return vals.map((v, i) => `flex:1;height:${Math.max(8, Math.round(v / mx * 100))}%;border-radius:2px;background:${i === vals.length - 1 ? color : color + '66'}`);
  };
  const tel = p => p ? 'tel:' + String(p).replace(/[^\d+]/g, '') : '#';
  const wa = p => p ? 'https://wa.me/' + String(p).replace(/[^\d]/g, '') : '#';
  const mask = p => String(p || '').replace(/(\+880 \d{2})\d{2} \d{3} (\d{3})/, '$1•• ••• $2');
  const fmtN = n => Number(n || 0).toLocaleString('en-US');
  const sum = a => a.reduce((x, y) => x + (Number(y) || 0), 0);
  const DC_MONTHS = [];
  for (let k = 3; k >= 0; k--) {
    const d = new Date(Y, M - k, 1);
    DC_MONTHS.push({
      label: MON3[d.getMonth()] + ' ' + d.getFullYear(),
      key: MON3[d.getMonth()] + '-' + String(d.getFullYear()).slice(-2),
      long: MONTHS[d.getMonth()] + ' ' + d.getFullYear(),
      y: d.getFullYear(),
      m: d.getMonth()
    });
  }
  const DC_CUR = 2;
  const DC_DUE_DAY = new Date(Y, M + 1, 0).getDate();
  const PHONE_LOOK = {
    Emergency: ['#b32e2e', 'rgba(214,69,69,.12)', 'M22 12h-4l-3 9L9 3l-3 9H2'],
    'Clinical support': ['#0072a3', 'rgba(0,144,202,.13)', 'M9 3h6M10 3v6l-5 9a2 2 0 001.7 3h10.6a2 2 0 001.7-3l-5-9V3'],
    Administration: ['#6a52d4', 'rgba(106,82,212,.13)', 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 3a4 4 0 110 8 4 4 0 010-8z'],
    _: ['#3c4858', 'rgba(125,145,180,.16)', 'M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1.9.4 1.8.7 2.6a2 2 0 01-.5 2.1L8 9.7a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.4c.8.3 1.7.5 2.6.7a2 2 0 011.7 2z']
  };
  const ATTACH = [['Photo', '#0072a3', 'rgba(0,144,202,.13)', 'M21 19V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2zM8.5 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM21 15l-5-5L5 21', 'photo'], ['Document', '#b32e2e', 'rgba(214,69,69,.12)', 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8', 'pdf'], ['Handover', '#6a52d4', 'rgba(106,82,212,.13)', 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 12h6M9 16h4', 'handover'], ['Shift report', '#1e8a7c', 'rgba(58,181,167,.16)', 'M18 20V10M12 20V4M6 20v-6', 'pdf'], ['Roster', '#b8650a', 'rgba(224,138,30,.15)', 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z', 'pdf'], ['Location', '#3c4858', 'rgba(125,145,180,.16)', 'M12 22s7-7 7-12a7 7 0 10-14 0c0 5 7 12 7 12zM12 12a2 2 0 100-4 2 2 0 000 4z', 'photo']];
  const PRIO = {
    Critical: ['#b32e2e', 'rgba(214,69,69,.12)'],
    Watch: ['#b8650a', 'rgba(224,138,30,.15)'],
    Routine: ['#1d8f57', 'rgba(43,182,115,.14)']
  };
  const INC_TYPES = ['Medication', 'Fall', 'Needle-stick', 'Equipment', 'Near miss', 'Other'];
  const INC_SEVS = ['Near miss', 'Minor', 'Moderate', 'Severe'];
  const NAV_D = {
    home: 'M3 11l9-8 9 8v9a2 2 0 01-2 2h-4v-7h-6v7H5a2 2 0 01-2-2z',
    roster: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z',
    chat: 'M21 12a8 8 0 01-8 8H8l-5 3 1.5-4.5A8 8 0 1121 12z',
    meds: 'M10.5 20.5l10-10a4.95 4.95 0 00-7-7l-10 10a4.95 4.95 0 007 7zM8.5 8.5l7 7',
    me: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 3a4 4 0 110 8 4 4 0 010-8z',
    bell: 'M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0',
    swap: 'M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4',
    staff: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 3a4 4 0 110 8 4 4 0 010-8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
    incident: 'M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z',
    handover: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 12h6M9 16h4',
    reports: 'M18 20V10M12 20V4M6 20v-6',
    report: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8',
    datacol: 'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z',
    history: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2',
    perf: 'M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z',
    approvals: 'M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11',
    compose: 'M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z'
  };
  const IND_D = 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2';
  const SCREEN_FEATURE = {
    roster: 'roster',
    shift: 'roster',
    requests: 'requests',
    newRequest: 'requests',
    chats: 'chatDept',
    thread: 'chatDept',
    meds: 'meds',
    medDetail: 'meds',
    medRequest: 'medReq',
    notices: 'notices',
    noticeDetail: 'notices',
    compose: 'compose',
    staff: 'staffDir',
    staffDetail: 'staffDir',
    reports: 'reports',
    indicator: 'reports',
    shiftReport: 'shiftReport',
    datacol: 'datacol',
    datacolForm: 'datacol',
    datacolHistory: 'datacolHist',
    handover: 'handover',
    incident: 'incident',
    performance: 'performance',
    rosterEdit: 'rosterEdit',
    unitStaff: 'unitStaff'
  };
  const FEATURE_DEFAULTS = {
    home: [1, 1, 1, 1],
    roster: [1, 1, 1, 1],
    requests: [1, 1, 1, 1],
    approvals: [0, 1, 0, 0],
    handover: [1, 1, 0, 1],
    chatDept: [1, 1, 1, 1],
    chatHosp: [1, 1, 1, 0],
    notices: [1, 1, 1, 1],
    compose: [0, 1, 0, 0],
    staffDir: [1, 1, 1, 1],
    phones: [1, 1, 0, 0],
    meds: [1, 1, 1, 0],
    medReq: [1, 1, 0, 0],
    incident: [1, 1, 1, 1],
    performance: [1, 1, 1, 1],
    reports: [0, 1, 0, 0],
    shiftReport: [0, 1, 0, 0],
    datacol: [0, 1, 1, 0],
    datacolHist: [0, 1, 1, 0],
    rosterEdit: [0, 1, 0, 0],
    unitStaff: [0, 1, 0, 0]
  };
  function defaultFeatures(role) {
    const col = {
      nurse: 0,
      incharge: 1,
      collector: 2,
      pca: 3
    }[role];
    const out = {};
    Object.keys(FEATURE_DEFAULTS).forEach(k => {
      out[k] = col === undefined ? true : !!FEATURE_DEFAULTS[k][col];
    });
    return out;
  }
  const EMPTY_LIVE = () => ({
    depts: null,
    staff: null,
    roster: null,
    subs: null,
    quality: null,
    meds: null,
    medsError: false,
    directory: null,
    notices: null,
    rooms: null,
    threads: {},
    requests: null,
    handover: null,
    incidents: null,
    shiftReports: null,
    medRequests: null,
    perf: null,
    report: null,
    unitStaff: null,
    rosterDoc: null
  });
  const PREG = {
    A: 'safe',
    B: 'safe',
    C: 'caution',
    D: 'avoid',
    X: 'avoid'
  };
  function liveMed(b) {
    const price = b.price && (b.price.unit || b.price.raw) ? '৳ ' + (b.price.unit != null ? Number(b.price.unit).toFixed(2) : b.price.raw) + (b.price.unitLabel ? ' / ' + b.price.unitLabel : '') : '';
    return {
      id: b.id || b._id,
      live: true,
      brand: b.name || '',
      strength: b.strength || '',
      generic: b.generic || '',
      route: b.form || '',
      mfr: b.manufacturer || '',
      price,
      cls: b.drugClass || '',
      cat: b.drugClass || 'Other',
      img: b.hasImage ? '/api/med/image/' + encodeURIComponent(b.id || b._id) : '',
      alert: !!b.highAlert,
      nursing: '',
      facts: {
        max: '—',
        food: 'any',
        preg: PREG[String(b.pregnancyCategory || '').trim()[0]] || 'caution'
      },
      sec: {}
    };
  }
  const SEC_ALIAS = {
    interaction: 'Drug Interactions',
    interactions: 'Drug Interactions',
    'drug interactions': 'Drug Interactions',
    'storage conditions': 'Storage',
    storage: 'Storage',
    'precautions & warnings': 'Precautions And Warnings',
    'precautions and warnings': 'Precautions And Warnings',
    'precautions': 'Precautions And Warnings',
    'duration of treatment': 'Duration Of Treatment',
    'use in special populations': 'Use In Special Populations',
    'pregnancy & lactation': 'Pregnancy & Lactation',
    'pregnancy and lactation': 'Pregnancy & Lactation',
    'dosage & administration': 'Dosage & Administration',
    'dosage and administration': 'Dosage & Administration',
    dosage: 'Dosage & Administration',
    'side effects': 'Side Effects',
    contraindications: 'Contraindications',
    indications: 'Indications',
    indication: 'Indications',
    pharmacology: 'Pharmacology',
    composition: 'Composition',
    administration: 'Administration',
    'pediatric uses': 'Pediatric Uses',
    'paediatric uses': 'Pediatric Uses',
    'overdose effects': 'Overdose Effects',
    overdose: 'Overdose Effects'
  };
  function normaliseMonograph(m) {
    const out = {};
    Object.keys(m || {}).forEach(k => {
      const v = m[k];
      if (!v || typeof v !== 'string') return;
      const key = SEC_ALIAS[k.trim().toLowerCase()] || k.trim().replace(/\b\w/g, c => c.toUpperCase());
      out[key] = v;
    });
    return out;
  }
  const AUD_LABEL = n => n.audience === 'all' ? 'All nursing staff' : n.audience === 'incharges' ? 'All in-charges' : (n.deptNames || n.depts || []).join(', ') || 'My department';
  function noticeOf(n, me) {
    if (n.from !== undefined && !n.author) return Object.assign({
      read: false,
      saved: false,
      acked: false,
      myVote: null,
      comments: [],
      allowComments: true,
      ackPending: [],
      attachments: []
    }, n, {
      poll: n.poll ? Object.assign({
        votes: n.poll.opts.map(() => 0)
      }, n.poll) : null
    });
    const a = n.author || {};
    const body = String(n.body || '');
    return {
      id: n.id,
      cat: n.cat || 'General',
      pinned: !!n.pinned,
      needsAck: !!n.needsAck,
      allowComments: n.allowComments !== false,
      attachments: (n.attachments || []).map(x => ({
        name: x.name,
        ext: x.ext || 'FILE',
        size: x.size || '',
        url: x.url || null
      })),
      ackCount: n.ackCount || 0,
      ackTotal: n.reach || 0,
      title: n.title,
      when: ago(n.publishAt || n.createdAt),
      ts: n.publishAt || n.createdAt || 0,
      from: a.name || '—',
      fromRole: [a.roleLabel || a.role, a.dept].filter(Boolean).join(', '),
      audience: AUD_LABEL(n),
      body: body.split('\n')[0],
      full: body,
      poll: n.poll ? {
        q: n.poll.q,
        opts: n.poll.opts,
        votes: n.votes || n.poll.opts.map(() => 0)
      } : null,
      read: !!n.read,
      saved: !!n.saved,
      acked: !!n.acked,
      myVote: n.myVote != null ? n.myVote : null,
      mine: !!(me && a.username === me),
      comments: (n.comments || []).map(c => ({
        from: c.name || c.by,
        when: ago(c.ts),
        text: c.text
      })),
      ackPending: n.ackPending || [],
      scheduled: !!(n.publishAt && n.publishAt > Date.now())
    };
  }
  function chatOf(r) {
    return {
      id: r.id,
      scope: r.scope,
      dept: r.dept || null,
      deptId: r.deptId || null,
      group: !!r.group,
      name: r.name,
      role: r.role || null,
      online: !!r.online,
      sub: r.sub || '',
      unread: r.unread || 0,
      when: ago(r.when),
      ts: r.when || 0,
      last: r.last || null,
      muted: !!r.muted,
      pinned: r.pinned || null,
      readOnly: !!r.readOnly,
      members: r.members || 0
    };
  }
  function requestOf(r) {
    const type = r.type === 'leave' ? 'Leave' : 'Swap';
    const status = r.status === 'approved' ? 'Approved' : r.status === 'declined' ? 'Declined' : 'Pending';
    const title = type === 'Swap' ? `${r.code || 'Shift'} on ${fmtIso(r.date)} ↔ ${r.withName || 'a colleague'}` : `${r.leaveType || 'Casual'} leave · ${fmtIso(r.date)}`;
    const meta = status === 'Pending' ? `Sent ${ago(r.createdAt).toLowerCase()} · awaiting in-charge` : `${status} by ${r.decidedBy && r.decidedBy.name || 'in-charge'} · ${ago(r.decidedAt)}${r.decisionReason ? ' · ' + r.decisionReason : ''}`;
    return {
      id: r.id,
      type,
      title,
      status,
      meta,
      name: r.by && r.by.name || '—',
      reason: r.reason || '',
      date: r.date,
      dept: r.deptName || r.dept,
      ts: r.createdAt || 0,
      leaveType: r.leaveType,
      code: r.code,
      by: r.by
    };
  }
  const COL_RX = {
    adm: /^adm$|admission/i,
    dis: /discharge/i,
    nvd: /nvd|normal deliv|vaginal/i,
    cs: /caesar|cesar|^cs$|c-?section|lscs/i,
    deaths: /^death|deaths|mortalit/i,
    transfers: /transfer/i,
    occ: /occupan/i,
    pdays: /patient.?days|pdays|bed.?days/i
  };
  const findCol = (cols, k) => (cols || []).find(c => COL_RX[k].test(c.id || '') || COL_RX[k].test(c.label || '')) || null;
  function reportOf(rep) {
    if (!rep) {
      return {
        live: false,
        labels: DAYS7,
        unitLabel: 'day',
        adm: CENSUS.adm,
        dis: CENSUS.dis,
        nvd: CENSUS.nvd,
        cs: CENSUS.cs,
        occ: CENSUS.occ,
        deaths: CENSUS.deaths,
        transfers: CENSUS.transfers,
        beds: 12,
        nurses: null,
        pcas: null,
        indicators: INDICATORS.map(i => Object.assign({
          noData: false
        }, i)),
        updatedAt: null
      };
    }
    const cols = rep.cols || [],
      months = rep.months || [],
      series = rep.series || {};
    const ser = k => {
      const c = findCol(cols, k);
      return c && series[c.id] ? series[c.id].map(v => v == null ? 0 : Number(v) || 0) : months.map(() => 0);
    };
    const has = k => !!findCol(cols, k);
    const occCol = findCol(cols, 'occ');
    const inds = (rep.indicators || []).map(i => {
      const trend = (i.trend || []).map(t => t.value == null ? null : Number(t.value));
      const latest = i.latest && i.latest.value != null ? Number(i.latest.value) : null;
      return {
        id: i.id,
        name: i.name,
        unit: i.unit === '%' ? '%' : i.unit || '',
        v: latest == null ? 0 : latest,
        noData: latest == null,
        bench: i.benchmark || '—',
        benchV: i.benchmarkValue != null ? Number(i.benchmarkValue) : 0,
        dir: i.goalDirection === 'higher_is_better' ? 'up' : 'down',
        trend: trend.map(v => v == null ? 0 : v),
        trendLabels: (i.trend || []).map(t => t.month),
        num: i.numLabel || 'Numerator',
        numV: '—',
        den: i.denLabel || 'Denominator',
        denV: '—',
        formula: i.formula || '',
        capa: []
      };
    });
    return {
      live: true,
      labels: months.map(m => String(m).replace(/^([A-Za-z]{3})-([0-9]{2})$/, '$1 20$2')),
      unitLabel: 'month',
      adm: ser('adm'),
      dis: ser('dis'),
      nvd: ser('nvd'),
      cs: ser('cs'),
      occ: occCol ? ser('occ') : null,
      deaths: ser('deaths'),
      transfers: ser('transfers'),
      hasDel: has('nvd') || has('cs'),
      beds: rep.staffing && rep.staffing.beds ? rep.staffing.beds : null,
      nurses: rep.staffing ? rep.staffing.nurses : null,
      pcas: rep.staffing ? rep.staffing.pcas : null,
      indicators: inds,
      updatedAt: rep.updatedAt || null,
      deptName: rep.deptName
    };
  }
  const RATE_F = ['pct', 'rate100', 'rate1000', 'avg'];
  function formulaOf(i) {
    const declared = i.formula;
    if (['rate1000', 'rate100', 'pct', 'count', 'avg'].indexOf(declared) >= 0) return declared;
    const probe = (String(i.benchmark || '') + ' ' + String(i.unit || '')).toLowerCase();
    const per1000 = /per\s*1[.,\s]?0{3}\b|\/\s*1[.,\s]?0{3}\b/.test(probe),
      per100 = !per1000 && /per\s*100\b/.test(probe);
    return per1000 ? 'rate1000' : per100 ? 'rate100' : /%/.test(probe) || /\bpercent/.test(probe) ? 'pct' : declared || 'count';
  }
  function dcItemsOf(dept, area) {
    const out = [];
    if (dept && Array.isArray(dept.cols) && dept.cols.length) out.push({
      id: 'stat',
      kind: 'stat',
      label: (dept.name || 'Unit') + ' statistics sheet',
      meta: `Monthly sheet · ${dept.cols.length} fields`,
      d: 'M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18',
      fields: dept.cols.map(c => ({
        id: c.id,
        label: c.label || c.id,
        pct: !!c.pct
      }))
    });
    (area && Array.isArray(area.indicators) ? area.indicators : []).forEach(i => {
      const unit = i.unit === '%' ? '%' : i.unit || '';
      const formula = formulaOf(i),
        isRate = RATE_F.indexOf(formula) >= 0;
      const mult = !isRate ? 1 : formula === 'rate1000' ? 1000 : formula === 'avg' ? 1 : 100;
      out.push({
        id: i.id,
        kind: 'q',
        label: i.name,
        meta: unit === '%' ? '% (' + (i.denLabel || 'denominator') + ')' : unit || i.valueType || '',
        num: i.numLabel || 'Numerator',
        den: i.denLabel || 'Denominator',
        mult,
        formula,
        isRate,
        unit: unit === '%' ? '%' : unit ? 'per ' + unit.replace(/^per\s+/i, '') : '',
        bench: i.benchmark || '—',
        benchV: i.benchmarkValue != null ? Number(i.benchmarkValue) : null,
        dir: i.goalDirection === 'higher_is_better' ? 'up' : 'down',
        grouped: false,
        denLocked: !!i.denAdminOnly,
        d: IND_D,
        guide: i.numeratorDef || i.denominatorDef || i.reference ? {
          def: [i.numeratorDef, i.denominatorDef].filter(Boolean).join(' '),
          example: i.formula ? 'Formula: ' + i.formula + (mult !== 1 ? ' (× ' + fmtN(mult) + ')' : '') : '',
          ref: i.reference || ''
        } : null,
        ind: i
      });
    });
    return out;
  }
  function liveSubsFor(subs, monthKey, deptId, areaKey, fields) {
    if (!subs || !subs.length || !monthKey) return {};
    const out = {};
    const stMap = {
      pending: 'sent',
      approved: 'approved',
      rejected: 'rejected',
      returned: 'rejected'
    };
    subs.filter(x => String(x.month || '') === monthKey && x.status !== 'withdrawn').forEach(x => {
      const status = stMap[x.status] || 'sent';
      const rec = {
        status,
        num: x.num,
        den: x.den,
        value: x.value,
        at: fmtTs(x.submittedAt || x.createdAt),
        reviewer: x.reviewedBy || (status === 'sent' ? '' : 'Quality team'),
        reason: x.rejectReason || x.reason || null,
        note: x.note || x.remark || '',
        live: true,
        id: x.id || x._id,
        ts: x.submittedAt || x.createdAt || 0,
        autoRejected: !!x.autoRejected
      };
      const better = (a, b) => !b || b.autoRejected && !a.autoRejected || !(a.autoRejected && !b.autoRejected) && a.ts >= b.ts;
      if (x.type === 'patient') {
        if (deptId && String(x.department) !== String(deptId)) return;
        if (!better(rec, out.stat)) return;
        const vals = (fields || []).map(f => x.values && x.values[f.id] != null ? x.values[f.id] : '');
        out.stat = Object.assign(rec, {
          vals,
          values: x.values || {}
        });
        return;
      }
      if (areaKey && String(x.area) !== String(areaKey)) return;
      const id = x.indicatorId;
      if (!id) return;
      if (better(rec, out[id])) out[id] = rec;
    });
    return out;
  }
  function perfOf(p) {
    const a = p && p.appraisal;
    if (!a) return {
      has: false,
      score: null,
      band: p && p.staff ? 'No appraisal on record yet' : 'No staff record linked to this account',
      reviewer: '—',
      date: '—',
      cycle: '—',
      kpis: [],
      comps: [],
      note: p && p.staff ? 'Your in-charge has not completed an appraisal for this cycle yet.' : 'Ask administration to link your account to your staff record.',
      goals: []
    };
    const t = AP && AP.tally ? AP.tally(a.scores || {}) : null;
    const secs = t && Array.isArray(t.sections) ? t.sections : [];
    const total = t ? t.total : null,
      rated = t ? t.rated : a.rated || 0;
    const full = rated >= 20 && AP && AP.gradeFor ? AP.gradeFor(total) : null;
    const comps = secs.filter(x => x.rated > 0).map((x, i) => ({
      label: cap(String(x.title || AP.SECTIONS[i] && AP.SECTIONS[i].title || 'Section ' + (i + 1)).toLowerCase()),
      v: (x.sub / x.rated).toFixed(1),
      n: x.sub / x.rated
    }));
    return {
      has: true,
      score: rated ? Math.round(total / rated * 10) / 10 : null,
      band: full ? `${full.grade} · ${full.rating}` : rated ? `${rated} of 20 parameters rated` : 'Not yet rated',
      reviewer: a.assessorName || '—',
      date: a.cycleEnd ? fmtIso(a.cycleEnd) : '—',
      cycle: a.cycleLabel || (a.cycleStart ? fmtIso(a.cycleStart) + ' – ' + fmtIso(a.cycleEnd) : '—'),
      kpis: [{
        label: 'Total',
        v: total != null ? total + ' / 100' : '—',
        note: full ? full.interp : 'out of 100',
        color: full && full.tone === 'ok' ? '#1d8f57' : full && full.tone === 'warn' ? '#b8650a' : '#0072a3'
      }, {
        label: 'Rated',
        v: rated + ' / 20',
        note: 'parameters scored',
        color: '#0072a3'
      }, {
        label: 'Status',
        v: a.status || 'Draft',
        note: a.signedOff ? 'signed off' : 'in progress',
        color: a.signedOff ? '#1d8f57' : '#b8650a'
      }],
      comps,
      note: a.assessorRemarks || 'No remarks recorded by the assessor yet.',
      goals: []
    };
  }
  const RE_TOOL = 'border:1px solid rgba(125,145,180,.3);border-radius:9px;padding:6px 9px;font-size:11px;font-weight:700;cursor:pointer;background:rgba(255,255,255,.75);color:#3c4858;white-space:nowrap';
  const yrs = iso => {
    const d = new Date(iso);
    if (isNaN(d)) return null;
    const t = new Date();
    let y = t.getFullYear() - d.getFullYear();
    if (t.getMonth() < d.getMonth() || t.getMonth() === d.getMonth() && t.getDate() < d.getDate()) y--;
    return y;
  };
  const onDay = iso => {
    const d = new Date(iso);
    return isNaN(d) ? '' : d.getDate() + ' ' + MON3[d.getMonth()];
  };
  const monthOf = iso => {
    const d = new Date(iso);
    return isNaN(d) ? -1 : d.getMonth();
  };
  function rosterBuilder(app, s, unit, unitStaffRows, phonesOn) {
    const y = s.reYear,
      m = s.reMonth,
      dim = new Date(y, m + 1, 0).getDate();
    const first = (new Date(y, m, 1).getDay() + 6) % 7;
    const day = clamp(s.reDay, 1, dim);
    const people = (s.live.unitStaff || []).map(p => ({
      sid: 'S' + p.id,
      name: p.name,
      sub: [p.designation, p.empId].filter(Boolean).join(' · '),
      photo: p.photo || null,
      role: p.role
    }));
    const order = (s.reOrder || people.map(p => p.sid)).filter((sid, i, a) => a.indexOf(sid) === i);
    const byId = {};
    people.forEach(p => {
      byId[p.sid] = p;
    });
    const names = s.live.rosterDoc && s.live.rosterDoc.names || {};
    const rowsAll = order.map(sid => byId[sid] || {
      sid,
      name: names[sid] || sid,
      sub: 'no longer on the register',
      photo: null,
      role: 'Nurse'
    }).concat(people.filter(p => order.indexOf(p.sid) < 0));
    const codeAt = (sid, d) => s.reGrid[sid] && s.reGrid[sid][d] || '';
    const editable = s.reCanEdit !== false && s.reStatus !== 'approved' && !s.demo ? true : s.demo ? true : false;
    const locked = s.reStatus === 'approved';
    const codes = RS && RS.SHIFTS ? RS.SHIFTS : [{
      code: 'M4',
      label: '8 AM – 4 PM',
      bucket: 'M',
      hours: 8
    }, {
      code: 'E3',
      label: '2 PM – 10 PM',
      bucket: 'E',
      hours: 8
    }, {
      code: 'N2',
      label: '10 PM – 8 AM',
      bucket: 'N',
      hours: 10
    }];
    const hoursFor = sid => {
      let h = 0;
      for (let d = 1; d <= dim; d++) h += hoursOf(codeAt(sid, d));
      return h;
    };
    const dayCounts = d => {
      const c = {
        M: 0,
        E: 0,
        N: 0,
        G: 0,
        off: 0,
        leave: 0,
        blank: 0
      };
      rowsAll.forEach(r => {
        const code = codeAt(r.sid, d);
        if (!code) c.blank++;else if (isLeave(code)) c.leave++;else if (!isWork(code)) c.off++;else {
          const b = bucketOf(code);
          if (c[b] !== undefined) c[b]++;else c.G++;
        }
      });
      return c;
    };
    const dc = dayCounts(day);
    const reDays = [];
    for (let d = 1; d <= dim; d++) {
      const c = dayCounts(d);
      const on = c.M + c.E + c.N + c.G;
      const sel = d === day;
      const isT = y === Y && m === M && d === TODAY;
      reDays.push({
        d,
        dow: DOWS[(first + d - 1) % 7],
        on: on ? on + ' on' : c.blank === rowsAll.length ? '—' : '0 on',
        go: () => app.setState({
          reDay: d,
          rePickOpen: false
        }),
        style: `display:flex;flex-direction:column;align-items:center;gap:2px;min-width:46px;padding:7px 4px;border-radius:12px;cursor:pointer;border:1.5px solid ${sel ? '#0090ca' : isT ? 'rgba(0,144,202,.45)' : 'rgba(255,255,255,.9)'};background:${sel ? 'linear-gradient(140deg,#0aa0d4,#0072a3)' : 'rgba(255,255,255,.65)'};color:${sel ? '#fff' : '#16202e'};flex-shrink:0`
      });
    }
    const pickRow = rowsAll.find(r => r.sid === s.rePickId) || null;
    const chipOf = code => {
      const sh = shiftOf(code || '');
      return `min-width:54px;border:1.5px solid ${code ? sh.color + '55' : 'rgba(125,145,180,.35)'};border-radius:10px;padding:7px 8px;font-family:'IBM Plex Mono',monospace;font-size:12.5px;font-weight:700;cursor:pointer;color:${code ? sh.color : '#7d8ea8'};background:${code ? sh.bg : 'rgba(255,255,255,.8)'};white-space:nowrap`;
    };
    const groups = [{
      label: 'Shifts',
      codes: codes.map(c => ({
        code: c.code,
        label: c.label
      }))
    }, {
      label: 'Off',
      codes: (RS && RS.OFF_CODES ? RS.OFF_CODES : ['OFF']).map(c => ({
        code: c,
        label: 'Day off'
      }))
    }, {
      label: 'Leave',
      codes: (RS && RS.LEAVE_CODES ? RS.LEAVE_CODES : ['CL', 'AL', 'SL']).map(c => ({
        code: c,
        label: RS && RS.BY_CODE && RS.BY_CODE[c] && RS.BY_CODE[c].label || c
      }))
    }, {
      label: 'Clear',
      codes: [{
        code: '—',
        label: 'No duty set',
        clear: true
      }]
    }];
    const monthLabelRe = MONTHS[m] + ' ' + y;
    const stat = {
      draft: ['Draft', '#b8650a', 'rgba(224,138,30,.15)'],
      submitted: ['Awaiting approval', '#0072a3', 'rgba(0,144,202,.13)'],
      approved: ['Published', '#1d8f57', 'rgba(43,182,115,.14)']
    }[s.reStatus] || ['Draft', '#b8650a', 'rgba(224,138,30,.15)'];
    const csv = ['Name,Employee ID,' + Array.from({
      length: dim
    }, (_, i) => i + 1).join(',')].concat(rowsAll.map(r => [r.name, byId[r.sid] && byId[r.sid].sub.split(' · ').pop() || ''].concat(Array.from({
      length: dim
    }, (_, i) => codeAt(r.sid, i + 1) || '')).map(x => '"' + String(x).replace(/"/g, '""') + '"').join(','))).join('\n');
    const text = `${unit ? unit.name : ''} · Duty roster · ${monthLabelRe} (${stat[0]})\n` + rowsAll.map(r => r.name.padEnd(22).slice(0, 22) + ' ' + Array.from({
      length: dim
    }, (_, i) => (codeAt(r.sid, i + 1) || '·').padEnd(4)).join('').trim()).join('\n');
    const share = kind => {
      app.setState({
        reExportOpen: false
      });
      if (kind === 'share') {
        if (navigator.share) navigator.share({
          title: 'Duty roster · ' + monthLabelRe,
          text
        }).catch(() => {});else if (navigator.clipboard) {
          navigator.clipboard.writeText(text).catch(() => {});
          app.toastMsg('Roster copied');
        }
      } else if (kind === 'csv') {
        if (navigator.clipboard) navigator.clipboard.writeText(csv).catch(() => {});
        app.toastMsg('CSV copied · paste into Excel or Sheets');
      } else if (kind === 'wa') window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
    };
    const blanks = dc.blank;
    return {
      reMonthLabel: monthLabelRe,
      reStatus: stat[0],
      reStatusStyle: `font-size:10.5px;font-weight:700;padding:4px 9px;border-radius:999px;color:${stat[1]};background:${stat[2]};white-space:nowrap`,
      rePrevMonth: () => app.setReMonth(-1),
      reNextMonth: () => app.setReMonth(1),
      reStats: [{
        n: rowsAll.length,
        label: 'Staff',
        color: '#16202e'
      }, {
        n: dc.M + dc.E + dc.N + dc.G,
        label: 'On duty',
        color: '#0072a3'
      }, {
        n: dc.off + dc.leave,
        label: 'Off / leave',
        color: '#b8650a'
      }, {
        n: blanks,
        label: 'Unset',
        color: blanks ? '#b32e2e' : '#1d8f57'
      }],
      reLocked: locked || !editable && !s.demo,
      reLockedText: locked ? `Published · rev ${s.reRevision || 1}${s.reUpdated ? ' · ' + fmtTs(s.reUpdated) : ''} · ask administration to reopen before editing` : 'You can view this sheet but only the unit in-charge can edit it.',
      reDays,
      reDayCover: `${DOWS[(first + day - 1) % 7]} ${day} · M ${dc.M} · E ${dc.E} · N ${dc.N}${dc.G ? ' · G ' + dc.G : ''} · off ${dc.off}${dc.leave ? ' · leave ' + dc.leave : ''}`,
      reEditable: editable && !locked,
      reToolStyle: RE_TOOL,
      reCopyPrev: () => {
        if (day <= 1) return app.toastMsg('This is the first day of the month.');
        app.editDay(g => rowsAll.forEach(r => {
          const v = g[r.sid] && g[r.sid][day - 1];
          g[r.sid] = g[r.sid] || {};
          if (v) g[r.sid][day] = v;else delete g[r.sid][day];
        }));
      },
      reRepeatWeek: () => {
        app.editDay(g => rowsAll.forEach(r => {
          const v = g[r.sid] && g[r.sid][day];
          for (let d = day + 7; d <= dim; d += 7) {
            g[r.sid] = g[r.sid] || {};
            if (v) g[r.sid][d] = v;else delete g[r.sid][d];
          }
        }));
        app.toastMsg('Copied to every ' + DOWS[(first + day - 1) % 7] + ' after ' + day);
      },
      reClearDay: () => app.editDay(g => rowsAll.forEach(r => {
        if (g[r.sid]) delete g[r.sid][day];
      })),
      reNoStaff: !rowsAll.length,
      reNoStaffText: s.live.unitStaff ? 'No staff are posted to this unit on the register. Ask administration to update the staff records.' : 'Loading the unit register…',
      reRows: rowsAll.map(r => {
        const code = codeAt(r.sid, day);
        return {
          name: r.name,
          sub: r.sub,
          ini: ini(r.name),
          hasPhoto: !!r.photo,
          noPhoto: !r.photo,
          photo: r.photo,
          hours: hoursFor(r.sid) + 'h',
          code: code || '—',
          codeStyle: chipOf(code),
          pick: () => {
            if (!(editable && !locked)) return app.toastMsg(locked ? 'This roster is published and locked.' : 'Only the unit in-charge can edit the roster.');
            app.setState({
              rePickOpen: true,
              rePickId: r.sid
            });
          }
        };
      }),
      reNote: s.reNote,
      setReNote: e => app.setState({
        reNote: e.target.value,
        reDirty: true
      }),
      reSaveDraft: () => app.saveRoster('draft'),
      reSaveLabel: s.busy.roster ? 'Saving…' : 'Save draft',
      reSubmit: () => {
        if (blanks && !confirm(blanks + ' staff have no duty on ' + day + ' ' + MON3[m] + '. Submit anyway?')) return;
        app.saveRoster('submitted');
      },
      reSubmitLabel: s.reStatus === 'submitted' ? 'Re-submit for approval' : 'Submit for approval',
      reOpenExport: () => app.setState({
        reExportOpen: true
      }),
      reCloseExport: () => app.setState({
        reExportOpen: false
      }),
      reExportOpen: s.reExportOpen,
      reExportSub: `${rowsAll.length} staff · ${dim} days · ${stat[0]}`,
      reExportText: text,
      reExportOpts: [{
        label: 'Share',
        color: '#0072a3',
        bg: 'rgba(0,144,202,.13)',
        d: 'M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13',
        go: () => share('share')
      }, {
        label: 'Copy CSV',
        color: '#1e8a7c',
        bg: 'rgba(58,181,167,.16)',
        d: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 5a2 2 0 002 2h2a2 2 0 002-2',
        go: () => share('csv')
      }, {
        label: 'WhatsApp',
        color: '#1d8f57',
        bg: 'rgba(43,182,115,.14)',
        d: 'M21 12a8 8 0 01-8 8H8l-5 3 1.5-4.5A8 8 0 1121 12z',
        go: () => share('wa')
      }],
      reFooter: s.reDirty ? 'Unsaved changes on this phone' : s.reUpdated ? `Saved ${fmtTs(s.reUpdated)} · rev ${s.reRevision || 1}` : 'Nothing saved yet for this month',
      rePickOpen: s.rePickOpen && !!pickRow,
      reClosePick: () => app.setState({
        rePickOpen: false
      }),
      rePickName: pickRow ? pickRow.name : '',
      rePickSub: pickRow ? `${DOWS[(first + day - 1) % 7]} ${day} ${MON3[m]} · now ${codeAt(pickRow.sid, day) || 'unset'}` : '',
      reCodeGroups: groups.map(g => ({
        label: g.label,
        codes: g.codes.map(c => {
          const cur = pickRow && codeAt(pickRow.sid, day) === c.code;
          const sh = shiftOf(c.clear ? '' : c.code);
          return {
            code: c.code,
            label: c.label,
            go: () => pickRow && app.setCode(pickRow.sid, day, c.clear ? '' : c.code),
            style: `display:flex;flex-direction:column;align-items:center;gap:2px;min-width:64px;border:1.5px solid ${cur ? sh.color : 'rgba(125,145,180,.3)'};border-radius:11px;padding:8px 10px;background:${cur ? sh.bg : 'rgba(255,255,255,.85)'};color:${c.clear ? '#7d8ea8' : sh.color};cursor:pointer`
          };
        })
      }))
    };
  }
  function unitStaffView(app, s, unit, phonesOn) {
    const rows = s.live.unitStaff || [];
    const q = s.usSearch.trim().toLowerCase();
    const thisMonth = iso => monthOf(iso) === M;
    const withEvents = rows.map(p => {
      const bday = p.dob && thisMonth(p.dob),
        anniv = p.doj && thisMonth(p.doj) && yrs(p.doj) >= 1;
      return Object.assign({}, p, {
        bday,
        anniv,
        years: p.doj ? yrs(p.doj) : null
      });
    });
    const filters = [['All', () => true], ['Nurses', p => p.role !== 'PCA'], ['PCA', p => p.role === 'PCA'], ['Birthdays', p => p.bday], ['Anniversaries', p => p.anniv], ['No app account', p => !p.account]];
    const fn = (filters.find(f => f[0] === s.usFilter) || filters[0])[1];
    const list = withEvents.filter(p => fn(p) && (!q || [p.name, p.empId, p.designation, p.qualification].some(x => String(x || '').toLowerCase().includes(q)))).sort((a, b) => (b.bday || b.anniv ? 1 : 0) - (a.bday || a.anniv ? 1 : 0) || a.name.localeCompare(b.name));
    const events = withEvents.filter(p => p.bday || p.anniv).map(p => ({
      name: p.name,
      text: p.bday ? 'Birthday · ' + onDay(p.dob) : `${p.years} yr${p.years === 1 ? '' : 's'} on ${onDay(p.doj)}`,
      dot: `width:8px;height:8px;border-radius:50%;background:${p.bday ? '#e08a1e' : '#0090ca'};flex-shrink:0`
    }));
    return {
      usSummary: s.live.unitStaff ? `${rows.length} staff · ${rows.filter(p => p.role !== 'PCA').length} nurses · ${rows.filter(p => p.role === 'PCA').length} PCA` : 'loading register…',
      usSearch: s.usSearch,
      setUsSearch: e => app.setState({
        usSearch: e.target.value
      }),
      usFilters: filters.map(([label]) => ({
        label,
        go: () => app.setState({
          usFilter: label
        }),
        style: chip(s.usFilter === label)
      })),
      usHasEvents: events.length > 0 && s.usFilter === 'All' && !q,
      usEvents: events,
      usEmpty: !list.length,
      usEmptyText: !s.live.unitStaff ? 'Loading…' : rows.length ? 'No one matches this filter.' : 'No staff are posted to this unit on the register.',
      usList: list.map(p => ({
        name: p.name,
        designation: [p.designation, p.qualification].filter(Boolean).join(' · '),
        empId: p.empId || '—',
        role: p.role,
        ini: ini(p.name),
        hasPhoto: !!p.photo,
        noPhoto: !p.photo,
        photo: p.photo,
        roleStyle: `font-size:9.5px;font-weight:800;letter-spacing:.5px;padding:2px 6px;border-radius:5px;color:${p.role === 'PCA' ? '#6a52d4' : '#0072a3'};background:${p.role === 'PCA' ? 'rgba(106,82,212,.13)' : 'rgba(0,144,202,.13)'}`,
        badge: p.bday ? '🎂 Birthday' : p.anniv ? '🎉 ' + p.years + ' yr' + (p.years === 1 ? '' : 's') : null,
        badgeStyle: 'font-size:9.5px;font-weight:800;padding:2px 6px;border-radius:5px;color:#b8650a;background:rgba(224,138,30,.15);white-space:nowrap',
        canCall: phonesOn && !!p.phone,
        tel: tel(p.phone),
        facts: [{
          label: 'Joined',
          v: p.doj ? fmtIso(p.doj) + (p.years != null ? ' · ' + p.years + ' yr' + (p.years === 1 ? '' : 's') : '') : '—'
        }, {
          label: 'Birthday',
          v: p.dob ? onDay(p.dob) : 'not on record'
        }, {
          label: 'Experience',
          v: p.experience || '—'
        }],
        appDot: `width:8px;height:8px;border-radius:50%;background:${p.account ? p.account.online ? '#2bb673' : '#0090ca' : '#c4ccd6'};flex-shrink:0`,
        appLine: p.account ? `App account @${p.account.username} · ${p.account.roleLabel}${p.account.online ? ' · online' : ''}` : 'No app account yet · ask administration to create one',
        canMsg: !!p.account,
        msg: () => app.openDM({
          username: p.account && p.account.username,
          name: p.name
        })
      }))
    };
  }
  function seedLive(role) {
    const at = t => {
      const m = /^(\d+):(\d+)/.exec(t || '');
      const d = new Date();
      if (m) d.setHours(Number(m[1]), Number(m[2]), 0, 0);else d.setMinutes(d.getMinutes() - 30);
      return d.getTime();
    };
    const acct = p => ({
      username: norm(p.name),
      name: p.name,
      role: /manager|charge/i.test(p.role) ? 'incharge' : 'nurse',
      roleLabel: p.title,
      departments: [p.dept],
      online: !!p.online,
      staffEmpId: p.emp
    });
    const directory = ALL_STAFF.map(acct);
    const staff = ALL_STAFF.map((p, i) => ({
      id: i + 1,
      name: p.name,
      designation: p.title,
      role: p.title === 'Patient Care Assistant' ? 'PCA' : 'Nurse',
      current_department: p.dept,
      phone: p.phone,
      emp_id: p.emp,
      bnmc: p.reg,
      doj: p.joined,
      is_active: true
    }));
    const grid = {};
    ALL_STAFF.forEach((p, i) => {
      const row = {};
      for (let d = 1; d <= DIM; d++) row[d] = d === TODAY ? p.shift : PATTERN[(d + i) % PATTERN.length];
      grid['S' + (i + 1)] = row;
    });
    const rooms = CHATS.map(c => ({
      id: c.id,
      name: c.name,
      scope: c.scope,
      dept: c.dept || null,
      group: !!c.group,
      members: c.members || 2,
      online: !!c.online,
      sub: c.sub,
      unread: c.unread,
      when: at(c.msgs.length ? c.msgs[c.msgs.length - 1].t : ''),
      last: c.msgs.length ? {
        text: c.msgs[c.msgs.length - 1].text,
        from: c.msgs[c.msgs.length - 1].from === 'me' ? 'You' : c.msgs[c.msgs.length - 1].from,
        mine: c.msgs[c.msgs.length - 1].from === 'me',
        urgent: !!c.msgs[c.msgs.length - 1].urgent
      } : null,
      muted: false,
      pinned: c.pinned != null && c.msgs[c.pinned] ? {
        id: c.id + ':' + c.pinned,
        text: c.msgs[c.pinned].text,
        from: c.msgs[c.pinned].from
      } : null,
      role: c.role || null
    }));
    const threads = {};
    CHATS.forEach(c => {
      threads[c.id] = {
        room: {
          id: c.id,
          name: c.name,
          scope: c.scope,
          group: !!c.group,
          pinned: rooms.find(r => r.id === c.id).pinned,
          sub: c.sub,
          readOnly: false,
          other: c.group ? null : norm(c.name)
        },
        members: (c.group ? ALL_STAFF.slice(0, Math.min(ALL_STAFF.length, c.members || 8)) : ALL_STAFF.filter(p => p.name === c.name)).map(p => ({
          username: norm(p.name),
          name: p.name,
          role: p.title,
          online: !!p.online,
          admin: /charge|manager/i.test(p.title)
        })),
        typing: c.typing || null,
        messages: c.msgs.map((m, i) => ({
          id: c.id + ':' + i,
          from: {
            username: m.from === 'me' ? 'demo' : norm(m.from),
            name: m.from === 'me' ? 'You' : m.from,
            role: m.role || ''
          },
          text: m.text,
          urgent: !!m.urgent,
          attach: m.attach ? {
            name: m.attach,
            type: m.attachType || 'pdf'
          } : null,
          replyTo: m.replyTo ? {
            from: '',
            text: m.replyTo
          } : null,
          reactions: (m.reactions || []).map(l => ({
            label: l,
            n: 1,
            mine: false
          })),
          ts: at(m.t),
          mine: m.from === 'me',
          seen: m.seen
        }))
      };
    });
    const req = (type, date, extra) => Object.assign({
      id: 'r' + Math.random().toString(36).slice(2),
      type,
      dept: 'LDR',
      deptName: 'LDR',
      date: isoDay(clamp(date, 1, DIM)),
      status: 'pending',
      by: {
        username: 'demo',
        name: role === 'incharge' ? 'Priya Das' : 'Nasif Ahammed Niloy'
      },
      createdAt: Date.now() - 86400e3
    }, extra);
    const requests = {
      mine: [req('swap', TODAY + 4, {
        code: 'E3',
        withName: 'Sumaiya Akter'
      }), req('leave', TODAY + 9, {
        leaveType: 'Casual',
        status: 'approved',
        decidedBy: {
          name: 'Priya Das'
        },
        decidedAt: Date.now() - 5 * 86400e3
      }), req('swap', 28, {
        code: 'N2',
        withName: 'Tanvir Hossain',
        status: 'declined',
        decidedBy: {
          name: 'Priya Das'
        },
        decidedAt: Date.now() - 12 * 86400e3,
        decisionReason: 'minimum night cover'
      })],
      team: [req('swap', TODAY + 4, {
        code: 'E3',
        withName: 'Nasif Ahammed',
        by: {
          username: 'sumaiya',
          name: 'Sumaiya Akter'
        },
        reason: 'University exam the next morning, needs the earlier finish.'
      }), req('leave', TODAY + 1, {
        leaveType: 'Sick',
        by: {
          username: 'tanvir',
          name: 'Tanvir Hossain'
        },
        reason: 'Fever since last night, GP note attached.'
      }), req('leave', TODAY + 14, {
        leaveType: 'Annual',
        by: {
          username: 'rahima',
          name: 'Rahima Khatun'
        },
        reason: 'Family travel, booked in July.'
      })]
    };
    const handover = {
      dept: 'LDR',
      deptName: 'LDR',
      items: [['B2', 'Mrs. Rahman · 28 y', 'Critical', 'Variable decelerations on CTG at 09:05. Dr. Farhana reviewing. Keep left lateral, continuous CTG, IV line patent.'], ['B4', 'Mrs. Begum · 31 y', 'Watch', 'Booked for CS at 10:30. Pre-op checklist complete, consent signed. NPO since 04:00. Anaesthesia review pending.'], ['B6', 'Mrs. Akter · 24 y', 'Routine', 'Post-NVD day 1. Vitals stable, breastfeeding established. Discharge planning tomorrow if Hb ≥ 10.'], ['B7', 'Mrs. Sultana · 35 y', 'Watch', 'PIH — BP 148/94 at 08:00. Repeat 4-hourly, report ≥ 160/100. Labetalol chart reviewed.']].map(([bed, patient, prio, note], i) => ({
        id: 'h' + i,
        bed,
        patient,
        prio,
        note,
        done: false,
        by: {
          name: 'Priya Das'
        }
      }))
    };
    const medRequests = [{
      id: 'm1',
      name: 'Noradrenaline 4 mg/4 mL',
      form: 'Injection',
      createdAt: Date.now() - 11 * 86400e3,
      status: 'Approved',
      openId: 'actrapid',
      reply: 'Added with a dilution card. Flagged high-alert.'
    }, {
      id: 'm2',
      name: 'Magnesium sulphate 50%',
      form: 'Injection',
      createdAt: Date.now() - 5 * 86400e3,
      status: 'In review',
      reply: 'Checking the eclampsia protocol reference with Obs & Gynae.'
    }];
    const shiftReports = [['N2', 1, 'Submitted', 'Rahima Khatun', 3, 2, 0], ['E3', 1, 'Approved', 'Priya Das', 2, 1, 1], ['M4', 1, 'Approved', 'Priya Das', 4, 3, 0], ['N2', 2, 'Approved', 'Rahima Khatun', 1, 2, 0]].map(([shift, back, status, name, adm, del, ev], i) => ({
      id: 's' + i,
      dept: 'LDR',
      deptName: 'LDR',
      date: isoDay(clamp(TODAY - back, 1, DIM)),
      shift,
      status,
      by: {
        name
      },
      counts: {
        adm,
        nvd: del,
        cs: 0,
        falls: ev,
        mederr: 0,
        needle: 0,
        code: 0
      },
      createdAt: Date.now() - back * 86400e3
    }));
    const scores = {};
    for (let i = 1; i <= 20; i++) scores[i] = [5, 4, 4, 5, 4, 4, 3, 4, 5, 4, 4, 5, 4, 4, 4, 5, 4, 3, 4, 5][i - 1];
    const perf = {
      staff: {
        name: 'Nasif Ahammed Niloy'
      },
      appraisal: {
        cycleLabel: 'Jan – Jun ' + Y,
        cycleEnd: Y + '-06-28',
        status: 'Signed off',
        signedOff: true,
        assessorName: role === 'incharge' ? 'Elizabeth Jothi Raja Singh' : 'Priya Das',
        assessorRemarks: 'Reliable, calm under pressure and trusted by the team on busy nights. Documentation timeliness is the one area to lift — aim for real-time charting on every shift this cycle.',
        scores,
        rated: 20
      }
    };
    const notices = NOTICES.map(n => Object.assign({}, n, {
      read: n.id === 2 || n.id === 5,
      saved: n.id === 4,
      comments: n.id === 1 ? [{
        from: 'Tanvir Hossain',
        when: '8:52',
        text: 'Does this apply to the triage bay as well, or only the labour rooms?'
      }, {
        from: 'Elizabeth Jothi Raja Singh',
        when: '9:01',
        text: 'Both. Triage counts as LDR for this protocol.'
      }] : [],
      ackPending: ['Rahima Khatun', 'Tanvir Hossain', 'Shathi Rani']
    }));
    const unitStaff = ALL_STAFF.filter(p => p.dept === 'LDR').map((p, i) => ({
      id: i + 1,
      name: p.name,
      designation: p.title,
      role: p.title === 'Patient Care Assistant' ? 'PCA' : 'Nurse',
      empId: p.emp,
      doj: Y - 1 - i + '-' + pad2(M + 1) + '-' + pad2(clamp(3 + i * 4, 1, 28)),
      dob: i % 2 ? Y - 28 - i + '-' + pad2(M + 1) + '-' + pad2(clamp(10 + i, 1, 28)) : null,
      phone: p.phone,
      photo: null,
      qualification: 'BSc Nursing',
      experience: 3 + i + ' yrs',
      account: i < 3 ? {
        username: norm(p.name),
        role: 'nurse',
        roleLabel: 'Staff nurse',
        online: !!p.online
      } : null
    }));
    return {
      depts: DEPTS.map(d => ({
        id: d.toLowerCase(),
        name: d
      })),
      staff,
      roster: {
        grid,
        status: 'approved'
      },
      subs: null,
      quality: null,
      meds: null,
      medsError: false,
      directory,
      notices,
      rooms,
      threads,
      requests,
      handover,
      incidents: [],
      shiftReports,
      medRequests,
      perf,
      report: null,
      unitStaff,
      rosterDoc: null
    };
  }
  const DEMO_ME = {
    nurse: {
      username: 'demo',
      name: 'Nasif Ahammed Niloy',
      role: 'nurse',
      designation: 'Staff Nurse',
      empId: 'UN-1042'
    },
    incharge: {
      username: 'demo',
      name: 'Priya Das',
      role: 'incharge',
      designation: 'Nurse In-charge',
      empId: 'UN-0871'
    }
  };
  const DEMO_BOOT = role => ({
    user: {
      username: 'demo',
      name: DEMO_ME[role].name,
      role,
      roleLabel: role === 'incharge' ? 'Nurse in-charge' : 'Staff nurse',
      isIncharge: role === 'incharge',
      canManage: false
    },
    unit: {
      id: 'ldr',
      name: 'LDR',
      incharge: 'Priya Das'
    },
    units: [{
      id: 'ldr',
      name: 'LDR'
    }],
    features: defaultFeatures(role),
    hospital: {
      name: 'Hands of Care Hospitals',
      app: 'UNICO Nurse',
      version: '2.1.0'
    },
    policy: {
      portalPhones: true
    },
    phonebook: [['Emergency', 'Code Blue / Rapid Response', 'Dial from any ward phone', '2222'], ['Emergency', 'Ambulance desk', 'Transfers and referrals', '+880 1713 000 911'], ['Clinical support', 'Blood bank', 'Ground floor · 24 h', '2310'], ['Clinical support', 'Pharmacy', 'Ward supply · 8 AM – 10 PM', '2340'], ['Administration', 'Nursing office', 'Nurse Manager · Mon – Sat', '1001'], ['Administration', 'IT & app support', '9 AM – 6 PM', '1090']],
    prefs: {},
    favs: ['actrapid'],
    counts: {}
  });
  function savedUnit() {
    try {
      return localStorage.getItem('unico.unit') || '';
    } catch (e) {
      return '';
    }
  }
  function demoFromHash() {
    const host = String(window.location.hostname || '');
    if (!/^(localhost|127\.0\.0\.1|10\.0\.2\.2|\[::1\])$/.test(host) && !/\.local$/.test(host)) return null;
    const h = String(window.location.hash || '').replace(/^#/, '');
    if (!/(^|&)demo(=|&|$)/.test(h)) return null;
    const get = k => {
      const m = h.match(new RegExp('(?:^|&)' + k + '=([^&]*)'));
      return m ? decodeURIComponent(m[1]) : '';
    };
    return {
      role: get('demo') === 'incharge' ? 'incharge' : 'nurse',
      screen: get('screen')
    };
  }
  class NurseApp extends React.Component {
    constructor(props) {
      super(props);
      this.state = {
        screen: 'login',
        booting: true,
        role: 'nurse',
        me: null,
        boot: null,
        demo: false,
        unitSel: savedUnit(),
        drawerOpen: false,
        empId: '',
        pin: '',
        loginBusy: false,
        toast: '',
        clockedIn: false,
        busy: {},
        live: EMPTY_LIVE(),
        selDay: TODAY,
        reqTab: 'mine',
        reqType: 'Swap',
        swapWith: 0,
        leaveType: 'Casual',
        reqReason: '',
        reqSent: false,
        meds: null,
        mono: {},
        medQuery: '',
        medClass: 'All',
        alertOnly: false,
        selMed: '',
        medTab: 'overview',
        favs: [],
        medDetail: {},
        medSearch: null,
        mr: {
          name: '',
          strength: '',
          mfr: '',
          form: 'Injection',
          reason: 'Used on ward, missing',
          note: '',
          urgent: false,
          highAlert: false
        },
        mrSent: false,
        chatTab: 'dept',
        chatDept: 'All',
        selChat: null,
        draft: '',
        chatSearch: '',
        newGroupOpen: false,
        ngName: '',
        ngScope: 'dept',
        ngPicked: {},
        roomInfoOpen: false,
        attachOpen: false,
        urgent: false,
        selMsg: null,
        replyTo: null,
        pendingAttach: null,
        noticeFilter: 'All',
        noticeSearch: '',
        selNotice: null,
        commentDraft: '',
        reminded: {},
        composeSent: false,
        cTitle: '',
        cBody: '',
        cCat: 'General',
        cAudience: 'dept',
        cDepts: {},
        cAck: false,
        cPin: false,
        cComments: true,
        cWhen: 'now',
        cAttach: false,
        cPoll: false,
        cPollQ: '',
        cPollOpts: ['', ''],
        staffSearch: '',
        staffDept: 'All',
        selStaff: null,
        staffOnlineOnly: false,
        dirTab: 'staff',
        staffSort: 'active',
        dcMonth: DC_CUR,
        dcFilter: 'All',
        dcSel: 'stat',
        dcVals: {},
        dcNote: '',
        dcCorr: '',
        dcGuideOpen: false,
        dcEvidence: false,
        dcFormSent: false,
        dcToast: '',
        dcMode: 'direct',
        dcHistFilter: 'All',
        dcSubs: {},
        dcAreaSel: '',
        repSimple: false,
        compareOn: false,
        shareOpen: false,
        infoOpen: false,
        infoInd: '',
        pinnedKpis: {},
        censusTip: '',
        repUpdated: timeNow(),
        refreshing: false,
        schedDaily: true,
        schedWeekly: false,
        repPeriod: 'month',
        repTab: 'overview',
        selInd: '',
        capaDone: {},
        capaExtra: {},
        capaDraft: '',
        exportToast: '',
        srStep: 0,
        srShift: 'M4',
        srVals: {},
        srNotes: {
          obs: '',
          issues: '',
          handover: ''
        },
        srSent: false,
        handoverDraft: '',
        incType: 'Medication',
        incSev: 'Minor',
        incTime: timeNow(),
        incDesc: '',
        incAnon: false,
        incSent: false,
        incRef: '',
        notifOn: true,
        biometric: true,
        wakeOnShift: false,
        reYear: Y,
        reMonth: M,
        reDay: TODAY,
        reGrid: {},
        reOrder: null,
        reStatus: 'draft',
        reDirty: false,
        rePickOpen: false,
        rePickId: null,
        reNote: '',
        reExportOpen: false,
        reLoaded: '',
        usSearch: '',
        usFilter: 'All'
      };
    }
    componentDidMount() {
      fetch('/assets/monographs.json').then(r => r.json()).then(mono => this.setState({
        mono
      })).catch(() => {});
      this._onExpired = () => this.sessionExpired();
      window.addEventListener('unico:session-expired', this._onExpired);
      tryApi('/api/phone/branding').then(b => {
        if (b && b.ok && b.hospital) this.setState({
          branding: b.hospital
        });
      });
      const demo = demoFromHash();
      if (demo) {
        fetch('/assets/nurse-app-meds.json').then(r => r.json()).then(meds => this.setState({
          meds: Array.isArray(meds) ? meds : [],
          selMed: 'actrapid'
        })).catch(() => this.setState({
          meds: []
        }));
        this.setState({
          booting: false,
          demo: true,
          role: demo.role,
          screen: demo.screen || 'home',
          me: DEMO_ME[demo.role],
          boot: DEMO_BOOT(demo.role),
          live: seedLive(demo.role),
          favs: ['actrapid'],
          selNotice: 1,
          selChat: 'ldr',
          chatDept: 'LDR',
          cDepts: {
            ldr: true
          },
          selStaff: 'Rahima Khatun',
          srVals: {
            planned: 5,
            actual: 5,
            pca: 2
          }
        });
        return;
      }
      tryApi('/api/me').then(me => {
        if (me && me.ok && me.user) this.enter(me);else this.setState({
          booting: false,
          screen: 'login'
        });
      });
      this._poll = setInterval(() => this.tick(), 5000);
      this._tick = 0;
      this._onOnline = () => {
        if (!this.state.demo && this.state.me) this.loadBoot(true);
      };
      window.addEventListener('online', this._onOnline);
    }
    componentWillUnmount() {
      clearInterval(this._poll);
      window.removeEventListener('unico:session-expired', this._onExpired);
      window.removeEventListener('online', this._onOnline);
    }
    sessionExpired() {
      if (this.state.demo || !this.state.me) return;
      this.setState({
        screen: 'login',
        me: null,
        boot: null,
        empId: '',
        pin: '',
        drawerOpen: false,
        live: EMPTY_LIVE(),
        meds: null,
        favs: [],
        selChat: null,
        selNotice: null,
        selStaff: null,
        busy: {}
      });
      this.toastMsg('Your session has expired — sign in again.');
    }
    tick() {
      if (this.state.demo || !this.state.me || typeof document !== 'undefined' && document.hidden) return;
      const t = ++this._tick,
        s = this.state;
      if (s.screen === 'thread' && s.selChat) this.loadThread(s.selChat, true);
      if (t % 3 === 0 && s.screen === 'chats') this.loadRooms();
      if (t % 6 === 0) {
        this.loadNotices();
        if (s.screen !== 'chats') this.loadRooms();
        this.loadRequests();
        if (s.screen === 'handover') this.loadHandover();
        if (/^datacol/.test(s.screen)) this.loadSubs();
      }
      if (t % 12 === 0) {
        this.loadDirectory();
      }
      if (t % 60 === 0) this.loadBoot(true);
    }
    enter(me) {
      const u = me.user || {};
      this.setState({
        me: Object.assign({
          perms: me.perms,
          staffScope: me.staffScope
        }, u),
        booting: false,
        screen: 'home',
        drawerOpen: false,
        pin: '',
        live: EMPTY_LIVE()
      });
      this.loadBoot().then(() => this.loadLive(u));
    }
    async loadBoot(quiet) {
      const url = '/api/phone/bootstrap' + (this.state.unitSel ? '?unit=' + encodeURIComponent(this.state.unitSel) : '');
      let b = null;
      if (quiet) {
        try {
          b = await api(url);
        } catch (e) {
          return;
        }
        if (!b || !b.ok || !b.user || !this.state.me) return;
        const qr = b.user.role;
        this.setState({
          boot: b,
          role: b.user.isIncharge || b.user.canManage || b.user.isAdmin ? 'incharge' : qr === 'pca' ? 'pca' : qr === 'collector' ? 'collector' : 'nurse'
        });
        return;
      }
      for (let i = 0; i < 3 && !b; i++) {
        try {
          b = await api(url);
        } catch (e) {
          console.warn('[nurse] bootstrap attempt ' + (i + 1) + ' failed: ' + (e.status || '') + ' ' + (e.message || e));
          if (e.status === 401) break;
          await new Promise(r => setTimeout(r, 700 * (i + 1)));
        }
      }
      if (!b || !b.ok) {
        console.warn('[nurse] bootstrap unusable: ' + JSON.stringify(b).slice(0, 300));
        this.toastMsg('Could not load your app profile — some features may be hidden.');
        this.setState(s => ({
          boot: {
            user: s.me || {},
            unit: null,
            units: [],
            features: defaultFeatures(s.me && s.me.role),
            hospital: {},
            policy: {},
            phonebook: [],
            prefs: {},
            favs: [],
            counts: {}
          }
        }));
        return;
      }
      if ((b.user.isAdmin || b.user.canManage) && !/nurse/.test(String(window.location.hash || '')) && typeof window.location.replace === 'function') {
        window.location.replace('/admin');
        return;
      }
      const role = b.user.role;
      const prefs = b.prefs || {};
      this.setState({
        boot: b,
        role: b.user.isIncharge || b.user.canManage || b.user.isAdmin ? 'incharge' : role === 'pca' ? 'pca' : role === 'collector' ? 'collector' : 'nurse',
        favs: Array.isArray(b.favs) ? b.favs : [],
        notifOn: prefs.notifOn !== false,
        biometric: prefs.biometric !== false,
        wakeOnShift: !!prefs.wakeOnShift,
        chatDept: 'All',
        cDepts: b.unit ? {
          [b.unit.id]: true
        } : {}
      });
    }
    F() {
      const b = this.state.boot;
      return b && b.features || defaultFeatures(this.state.me && this.state.me.role);
    }
    allowed(screen) {
      const fid = SCREEN_FEATURE[screen];
      return !fid || this.F()[fid] !== false;
    }
    unit() {
      const b = this.state.boot;
      return b && b.unit || null;
    }
    unitQ() {
      const u = this.unit();
      return u ? '?dept=' + encodeURIComponent(u.id) : '';
    }
    setUnit(id) {
      try {
        localStorage.setItem('unico.unit', id || '');
      } catch (e) {}
      this.setState({
        unitSel: id || '',
        live: Object.assign({}, this.state.live, {
          roster: null,
          handover: null,
          report: null
        })
      });
      this.setState({
        reLoaded: ''
      });
      this.loadBoot().then(() => this.loadUnitData());
    }
    patchLive(k, v) {
      this.setState(s => ({
        live: Object.assign({}, s.live, {
          [k]: v
        })
      }));
    }
    async loadLive(u) {
      const F = this.F(),
        unit = this.unit();
      const deptsRes = await tryApi('/api/departments');
      const depts = deptsRes && deptsRes.ok && Array.isArray(deptsRes.departments) ? deptsRes.departments : null;
      if (depts) this.patchLive('depts', depts);
      const staffRes = await tryApi('/api/staff');
      const staff = staffRes && staffRes.ok && Array.isArray(staffRes.staff) ? staffRes.staff : null;
      if (staff) this.patchLive('staff', staff);
      this.loadDirectory();
      this.loadNotices();
      this.loadRooms();
      this.loadRequests();
      if (F.medReq) this.loadMedRequests();
      if (F.performance) this.loadPerf();
      if (F.datacol || F.datacolHist) {
        await this.loadSubs();
        const q = await tryApi('/api/quality');
        if (q && q.ok && Array.isArray(q.quality)) this.patchLive('quality', q.quality);
      }
      await this.loadUnitData();
      if (F.meds) {
        const medRes = await tryApi('/api/med/browse?per=60&page=1');
        if (medRes && medRes.ok && Array.isArray(medRes.rows) && medRes.rows.length) {
          const meds = medRes.rows.map(liveMed);
          this.patchLive('meds', meds);
          this.setState({
            meds,
            selMed: meds[0].id,
            medClass: 'All'
          });
        } else {
          this.patchLive('medsError', true);
          this.setState({
            meds: []
          });
        }
      }
    }
    async loadUnitData() {
      const F = this.F(),
        unit = this.unit();
      if (!unit) return;
      if (F.roster) {
        const ros = await tryApi('/api/rosters/' + encodeURIComponent(unit.name) + '/' + Y + '/' + M);
        this.patchLive('roster', ros && ros.ok && ros.roster && ros.roster.grid ? ros.roster : null);
      }
      if (F.handover) this.loadHandover();
      if (F.reports) {
        this.loadReport();
        this.loadShiftReports();
      }
      if (F.unitStaff || F.rosterEdit) this.loadUnitStaff();
    }
    async loadUnitStaff() {
      if (!this.unit()) return;
      const r = await tryApi('/api/phone/unit-staff' + this.unitQ());
      if (r && r.ok) this.patchLive('unitStaff', r.staff || []);
    }
    async loadRosterEdit(force) {
      const s = this.state,
        unit = this.unit();
      if (!unit) return;
      const key = unit.id + ':' + s.reYear + ':' + s.reMonth;
      if (!force && s.reLoaded === key) return;
      const r = await tryApi('/api/phone/roster' + this.unitQ() + '&year=' + s.reYear + '&month=' + s.reMonth);
      if (!r || !r.ok) return;
      const doc = r.roster || null;
      this.setState({
        reLoaded: key,
        reGrid: doc && doc.grid ? JSON.parse(JSON.stringify(doc.grid)) : {},
        reOrder: doc && doc.order && doc.order.length ? doc.order.slice() : null,
        reStatus: doc ? doc.status : 'draft',
        reDirty: false,
        reNote: doc && doc.note || '',
        reCanEdit: !!r.canEdit,
        reRevision: doc ? doc.revision : 0,
        reUpdated: doc ? doc.updatedAt : null
      });
      this.patchLive('rosterDoc', doc);
    }
    setReMonth(delta) {
      const d = new Date(this.state.reYear, this.state.reMonth + delta, 1);
      this.setState({
        reYear: d.getFullYear(),
        reMonth: d.getMonth(),
        reDay: 1,
        rePickOpen: false
      }, () => this.loadRosterEdit());
    }
    setCode(sid, day, code) {
      this.setState(s => {
        const g = Object.assign({}, s.reGrid);
        const row = Object.assign({}, g[sid] || {});
        if (code) row[day] = code;else delete row[day];
        g[sid] = row;
        return {
          reGrid: g,
          reDirty: true,
          rePickOpen: false
        };
      });
    }
    editDay(fn) {
      this.setState(s => {
        const g = {};
        Object.keys(s.reGrid).forEach(k => {
          g[k] = Object.assign({}, s.reGrid[k]);
        });
        fn(g, s);
        return {
          reGrid: g,
          reDirty: true
        };
      });
    }
    saveRoster(status) {
      const s = this.state,
        unit = this.unit();
      if (!unit) return;
      const order = s.reOrder || (s.live.unitStaff || []).map(p => 'S' + p.id);
      const names = {};
      (s.live.unitStaff || []).forEach(p => {
        names['S' + p.id] = p.name;
      });
      if (s.demo) {
        this.setState({
          reStatus: status,
          reDirty: false
        });
        return this.toastMsg(status === 'submitted' ? 'Roster submitted for approval' : 'Draft saved');
      }
      this.act('roster', () => api('/api/phone/roster', {
        method: 'PUT',
        body: {
          dept: unit.id,
          year: s.reYear,
          month: s.reMonth,
          grid: s.reGrid,
          order,
          names,
          status,
          note: s.reNote
        }
      }), r => {
        if (r && r.roster) {
          this.setState({
            reStatus: r.roster.status,
            reDirty: false,
            reRevision: r.roster.revision,
            reUpdated: r.roster.updatedAt
          });
          this.patchLive('rosterDoc', r.roster);
          this.toastMsg(status === 'submitted' ? 'Roster submitted to administration for approval' : 'Draft saved · rev ' + r.roster.revision);
          if (s.reYear === Y && s.reMonth === M) this.loadUnitData();
        }
      });
    }
    async loadDirectory() {
      if (!this.F().staffDir) return;
      const r = await tryApi('/api/phone/directory');
      if (r && r.ok) this.patchLive('directory', r.accounts || []);
    }
    async loadNotices() {
      if (!this.F().notices) return;
      const r = await tryApi('/api/phone/notices');
      if (r && r.ok) this.patchLive('notices', r.notices || []);
    }
    async loadRooms() {
      if (!this.F().chatDept) return;
      const r = await tryApi('/api/phone/rooms');
      if (r && r.ok) this.patchLive('rooms', r.rooms || []);
    }
    async loadThread(id, incremental) {
      const cur = this.state.live.threads[id];
      const since = incremental && cur && cur.now ? cur.now : 0;
      const r = await tryApi('/api/phone/rooms/' + encodeURIComponent(id) + '/messages' + (since ? '?since=' + since : ''));
      if (!r || !r.ok) return;
      this.setState(s => {
        const prev = s.live.threads[id];
        const msgs = since && prev ? prev.messages.concat((r.messages || []).filter(m => !prev.messages.some(x => x.id === m.id))) : r.messages || [];
        return {
          live: Object.assign({}, s.live, {
            threads: Object.assign({}, s.live.threads, {
              [id]: {
                room: r.room,
                members: r.members || [],
                messages: msgs,
                now: r.now
              }
            })
          })
        };
      });
    }
    async loadRequests() {
      if (!this.F().requests) return;
      const r = await tryApi('/api/phone/requests');
      if (r && r.ok) this.patchLive('requests', {
        mine: r.mine || [],
        team: r.team || []
      });
    }
    async loadHandover() {
      if (!this.unit()) return;
      const r = await tryApi('/api/phone/handover' + this.unitQ());
      if (r && r.ok) this.patchLive('handover', r);
    }
    async loadMedRequests() {
      const r = await tryApi('/api/phone/med-requests');
      if (r && r.ok) this.patchLive('medRequests', r.requests || []);
    }
    async loadPerf() {
      const r = await tryApi('/api/phone/my-performance');
      if (r && r.ok) this.patchLive('perf', r);
    }
    async loadReport() {
      if (!this.unit()) return;
      const r = await tryApi('/api/phone/unit-report' + this.unitQ());
      if (r && r.ok) this.patchLive('report', r);
      this.setState({
        repUpdated: timeNow(),
        refreshing: false
      });
    }
    async loadShiftReports() {
      const r = await tryApi('/api/phone/shift-reports');
      if (r && r.ok) this.patchLive('shiftReports', r.reports || []);
    }
    async loadSubs() {
      const rows = await pageAll('/api/submissions?limit=300', 'submissions', 10);
      if (rows) this.patchLive('subs', rows);
    }
    toastMsg(msg, key) {
      const k = key || 'toast';
      this.setState({
        [k]: msg
      });
      clearTimeout(this['_t_' + k]);
      this['_t_' + k] = setTimeout(() => this.setState({
        [k]: ''
      }), 2600);
    }
    go = (screen, extra) => {
      if (!this.allowed(screen)) return this.toastMsg('This feature is switched off for your role.');
      this.setState(Object.assign({
        screen,
        drawerOpen: false
      }, extra || {}));
      if (screen === 'rosterEdit') {
        if (!this.state.live.unitStaff) this.loadUnitStaff();
        this.loadRosterEdit();
      }
      if (screen === 'unitStaff' && !this.state.live.unitStaff) this.loadUnitStaff();
    };
    async act(key, fn, after) {
      if (this.state.busy[key]) return;
      this.setState(s => ({
        busy: Object.assign({}, s.busy, {
          [key]: true
        })
      }));
      try {
        const r = await fn();
        if (after) await after(r);
        return r;
      } catch (e) {
        this.toastMsg(e.status === 403 ? e.message || 'Not allowed.' : e.status === 429 ? e.message || 'Too many requests — wait a moment.' : e.message || 'The server did not accept that.');
        return null;
      } finally {
        this.setState(s => {
          const b = Object.assign({}, s.busy);
          delete b[key];
          return {
            busy: b
          };
        });
      }
    }
    savePrefs(patch) {
      this.setState(patch);
      if (this.state.demo) return;
      const s = Object.assign({}, this.state, patch);
      tryApi('/api/phone/me/state', {
        method: 'PATCH',
        body: {
          prefs: {
            notifOn: s.notifOn,
            biometric: s.biometric,
            wakeOnShift: s.wakeOnShift
          }
        }
      });
    }
    saveFavs(favs) {
      this.setState({
        favs
      });
      if (!this.state.demo) tryApi('/api/phone/me/state', {
        method: 'PATCH',
        body: {
          favs
        }
      });
    }
    async doLogin() {
      const username = this.state.empId.trim().toLowerCase(),
        password = this.state.pin;
      if (!username || !password) return this.toastMsg('Enter your employee ID and PIN.');
      this.setState({
        loginBusy: true
      });
      try {
        await api('/api/login', {
          method: 'POST',
          body: {
            username,
            password
          }
        });
        const me = await api('/api/me');
        this.setState({
          loginBusy: false
        });
        this.enter(me);
      } catch (e) {
        this.setState({
          loginBusy: false
        });
        this.toastMsg(e.status === 401 ? 'Wrong employee ID or PIN.' : e.status === 429 ? e.message || 'Too many attempts. Try again shortly.' : 'Could not reach the hospital server.');
      }
    }
    signOut() {
      if (this.state.demo) {
        window.location.hash = '';
      }
      fetch('/logout', {
        credentials: 'same-origin'
      }).catch(() => {});
      this.setState({
        screen: 'login',
        me: null,
        boot: null,
        demo: false,
        empId: '',
        pin: '',
        drawerOpen: false,
        live: EMPTY_LIVE(),
        meds: null,
        favs: [],
        selChat: null,
        selNotice: null,
        selStaff: null
      });
    }
    openNotice(n) {
      this.setState({
        screen: 'noticeDetail',
        selNotice: n.id,
        commentDraft: ''
      });
      if (n.read) return;
      this.mutateNotice(n.id, {
        read: true
      });
      if (!this.state.demo) tryApi('/api/phone/notices/' + encodeURIComponent(n.id) + '/read', {
        method: 'POST'
      });
    }
    mutateNotice(id, patch) {
      this.setState(s => ({
        live: Object.assign({}, s.live, {
          notices: (s.live.notices || []).map(n => n.id === id ? Object.assign({}, n, patch) : n)
        })
      }));
    }
    noticeAction(n, action, body, patch) {
      this.mutateNotice(n.id, patch || {});
      if (this.state.demo) return;
      this.act('notice:' + action, () => api('/api/phone/notices/' + encodeURIComponent(n.id) + '/' + action, {
        method: 'POST',
        body: body || {}
      }), () => this.loadNotices());
    }
    markAllRead() {
      this.setState(s => ({
        live: Object.assign({}, s.live, {
          notices: (s.live.notices || []).map(n => Object.assign({}, n, {
            read: true
          }))
        })
      }));
      if (!this.state.demo) tryApi('/api/phone/notices/read-all', {
        method: 'POST'
      });
    }
    sendComment(n, text) {
      const t = String(text || '').trim();
      if (!t) return;
      const me = this.state.me || {};
      this.setState({
        commentDraft: ''
      });
      if (this.state.demo) return this.mutateNotice(n.id, {
        comments: (n.comments || []).concat([{
          from: me.name,
          when: timeNow(),
          text: t
        }])
      });
      this.act('comment', () => api('/api/phone/notices/' + encodeURIComponent(n.id) + '/comments', {
        method: 'POST',
        body: {
          text: t
        }
      }), r => {
        if (r && r.comments) this.mutateNotice(n.id, {
          comments: r.comments
        });
      });
    }
    publishNotice(body) {
      if (this.state.demo) {
        const me = this.state.me;
        const id = Date.now();
        this.setState(s => ({
          composeSent: true,
          live: Object.assign({}, s.live, {
            notices: [{
              id,
              cat: body.cat,
              pinned: body.pinned,
              needsAck: body.needsAck,
              attachments: [],
              ackCount: 0,
              ackTotal: 14,
              title: body.title,
              when: 'Just now',
              from: me.name,
              fromRole: me.designation + ', LDR',
              audience: body.audience === 'all' ? 'All nursing staff' : body.audience === 'incharges' ? 'All in-charges' : 'LDR',
              body: body.body.split('\n')[0],
              full: body.body,
              poll: body.poll ? {
                q: body.poll.q,
                opts: body.poll.opts,
                votes: body.poll.opts.map(() => 0)
              } : null,
              read: true
            }].concat(s.live.notices || [])
          }),
          cTitle: '',
          cBody: '',
          cPollQ: '',
          cPollOpts: ['', ''],
          cAttach: false,
          cPoll: false
        }));
        return;
      }
      this.act('publish', () => api('/api/phone/notices', {
        method: 'POST',
        body
      }), () => {
        this.setState({
          composeSent: true,
          cTitle: '',
          cBody: '',
          cPollQ: '',
          cPollOpts: ['', ''],
          cAttach: false,
          cPoll: false
        });
        this.loadNotices();
      });
    }
    openChat(id) {
      this.setState({
        screen: 'thread',
        selChat: id,
        drawerOpen: false,
        selMsg: null,
        replyTo: null,
        roomInfoOpen: false,
        attachOpen: false
      });
      this.setState(s => ({
        live: Object.assign({}, s.live, {
          rooms: (s.live.rooms || []).map(r => r.id === id ? Object.assign({}, r, {
            unread: 0
          }) : r)
        })
      }));
      if (!this.state.demo) this.loadThread(id, false);
    }
    openDM(person) {
      if (person && person.username === (this.state.me || {}).username) return;
      if (this.state.demo) {
        const existing = (this.state.live.rooms || []).find(r => !r.group && r.name === person.name);
        if (existing) return this.openChat(existing.id);
        const id = 'dm-' + norm(person.name);
        this.setState(s => ({
          live: Object.assign({}, s.live, {
            rooms: [{
              id,
              name: person.name,
              scope: 'dept',
              dept: person.dept,
              group: false,
              members: 2,
              online: !!person.online,
              sub: `${person.title || person.role} · ${person.online ? 'online' : 'offline'}`,
              unread: 0,
              when: Date.now(),
              last: null,
              role: person.title
            }].concat(s.live.rooms || []),
            threads: Object.assign({}, s.live.threads, {
              [id]: {
                room: {
                  id,
                  name: person.name,
                  scope: 'dm',
                  group: false,
                  pinned: null,
                  sub: person.title
                },
                members: [],
                messages: []
              }
            })
          })
        }));
        return this.openChat(id);
      }
      if (!person || !person.username) return this.toastMsg((person && person.name ? person.name : 'This person') + ' has no app account yet.');
      this.act('dm', () => api('/api/phone/dm', {
        method: 'POST',
        body: {
          username: person.username
        }
      }), r => {
        if (r && r.room) {
          this.loadRooms();
          this.openChat(r.room.id);
        }
      });
    }
    sendMsg(roomId, text, extra) {
      const s = this.state,
        t = String(text || '').trim();
      if (!t && !s.pendingAttach) return;
      const th = s.live.threads[roomId];
      const body = {
        text: t,
        urgent: !!s.urgent,
        attach: s.pendingAttach ? {
          name: s.pendingAttach.name,
          type: s.pendingAttach.type
        } : null,
        replyTo: s.replyTo != null && th && th.messages[s.replyTo] ? th.messages[s.replyTo].id : null
      };
      this.setState({
        draft: '',
        urgent: false,
        replyTo: null,
        pendingAttach: null,
        attachOpen: false
      });
      const append = m => this.setState(st => {
        const cur = st.live.threads[roomId] || {
          room: {
            id: roomId,
            name: '',
            group: true
          },
          members: [],
          messages: []
        };
        return {
          live: Object.assign({}, st.live, {
            threads: Object.assign({}, st.live.threads, {
              [roomId]: Object.assign({}, cur, {
                messages: cur.messages.concat([m])
              })
            }),
            rooms: (st.live.rooms || []).map(r => r.id === roomId ? Object.assign({}, r, {
              last: {
                text: m.text || m.attach && m.attach.name || '',
                from: 'You',
                mine: true,
                urgent: m.urgent
              },
              when: m.ts
            }) : r)
          })
        };
      });
      if (s.demo) {
        const orig = body.replyTo && th ? th.messages.find(x => x.id === body.replyTo) : null;
        return append({
          id: 'm' + Date.now(),
          from: {
            username: 'demo',
            name: 'You',
            role: ''
          },
          text: t,
          urgent: body.urgent,
          attach: body.attach,
          replyTo: orig ? {
            from: orig.from.name,
            text: orig.text
          } : null,
          reactions: [],
          ts: Date.now(),
          mine: true
        });
      }
      this.act('send', () => api('/api/phone/rooms/' + encodeURIComponent(roomId) + '/messages', {
        method: 'POST',
        body
      }), r => {
        if (r && r.message) append(r.message);
      });
    }
    reactMsg(roomId, m, label) {
      this.setState({
        selMsg: null
      });
      const apply = reactions => this.setState(st => {
        const cur = st.live.threads[roomId];
        if (!cur) return null;
        return {
          live: Object.assign({}, st.live, {
            threads: Object.assign({}, st.live.threads, {
              [roomId]: Object.assign({}, cur, {
                messages: cur.messages.map(x => x.id === m.id ? Object.assign({}, x, {
                  reactions
                }) : x)
              })
            })
          })
        };
      });
      const cur = m.reactions || [],
        has = cur.find(r => r.label === label);
      apply(has ? cur.map(r => r.label === label ? Object.assign({}, r, {
        n: r.n + (r.mine ? -1 : 1),
        mine: !r.mine
      }) : r).filter(r => r.n > 0) : cur.concat([{
        label,
        n: 1,
        mine: true
      }]));
      if (!this.state.demo) tryApi('/api/phone/rooms/' + encodeURIComponent(roomId) + '/messages/' + encodeURIComponent(m.id) + '/react', {
        method: 'POST',
        body: {
          label
        }
      });
    }
    pinMsg(roomId, m) {
      this.setState({
        selMsg: null
      });
      const pinned = m ? {
        id: m.id,
        text: m.text || m.attach && m.attach.name || '',
        from: m.from.name
      } : null;
      this.setState(st => {
        const cur = st.live.threads[roomId];
        return cur ? {
          live: Object.assign({}, st.live, {
            threads: Object.assign({}, st.live.threads, {
              [roomId]: Object.assign({}, cur, {
                room: Object.assign({}, cur.room, {
                  pinned
                })
              })
            })
          })
        } : null;
      });
      if (!this.state.demo) this.act('pin', () => api('/api/phone/rooms/' + encodeURIComponent(roomId) + '/pin', {
        method: 'POST',
        body: {
          mid: m ? m.id : null
        }
      }));
    }
    deleteMsg(roomId, m) {
      this.setState({
        selMsg: null
      });
      if (this.state.demo) return this.setState(st => {
        const cur = st.live.threads[roomId];
        return {
          live: Object.assign({}, st.live, {
            threads: Object.assign({}, st.live.threads, {
              [roomId]: Object.assign({}, cur, {
                messages: cur.messages.filter(x => x.id !== m.id)
              })
            })
          })
        };
      });
      this.act('del', () => api('/api/phone/rooms/' + encodeURIComponent(roomId) + '/messages/' + encodeURIComponent(m.id), {
        method: 'DELETE'
      }), () => this.loadThread(roomId, false));
    }
    muteRoom(roomId, on) {
      this.setState(st => ({
        live: Object.assign({}, st.live, {
          rooms: (st.live.rooms || []).map(r => r.id === roomId ? Object.assign({}, r, {
            muted: on
          }) : r)
        })
      }));
      if (!this.state.demo) {
        const muted = {};
        (this.state.live.rooms || []).forEach(r => {
          muted[r.id] = r.id === roomId ? on : !!r.muted;
        });
        tryApi('/api/phone/me/state', {
          method: 'PATCH',
          body: {
            muted
          }
        });
      }
    }
    leaveRoom(room) {
      if (this.state.demo || room.scope === 'hosp' || room.group && /^dept:/.test(room.id)) {
        this.muteRoom(room.id, true);
        this.setState({
          roomInfoOpen: false,
          screen: 'chats'
        });
        return this.toastMsg(room.group && !this.state.demo ? 'Unit and hospital rooms cannot be left — muted instead' : 'You left ' + room.name);
      }
      this.act('leave', () => api('/api/phone/rooms/' + encodeURIComponent(room.id) + '/leave', {
        method: 'POST'
      }), () => {
        this.setState({
          roomInfoOpen: false,
          screen: 'chats'
        });
        this.toastMsg('You left ' + room.name);
        this.loadRooms();
      });
    }
    createGroup(name, scope, members) {
      if (this.state.demo) {
        const id = 'room-' + Date.now();
        this.setState(s => ({
          newGroupOpen: false,
          live: Object.assign({}, s.live, {
            rooms: [{
              id,
              name,
              scope,
              dept: 'LDR',
              group: true,
              members: members.length + 1,
              online: true,
              sub: `${members.length + 1} members · created by you`,
              unread: 0,
              when: Date.now(),
              last: null
            }].concat(s.live.rooms || []),
            threads: Object.assign({}, s.live.threads, {
              [id]: {
                room: {
                  id,
                  name,
                  scope,
                  group: true,
                  pinned: null
                },
                members: [],
                messages: [{
                  id: 'sys',
                  from: {
                    username: 'demo',
                    name: 'You'
                  },
                  text: `Created the room "${name}".`,
                  ts: Date.now(),
                  mine: true,
                  reactions: []
                }]
              }
            })
          })
        }));
        return this.openChat(id);
      }
      this.act('room', () => api('/api/phone/rooms', {
        method: 'POST',
        body: {
          name,
          scope,
          members
        }
      }), r => {
        if (r && r.room) {
          this.setState({
            newGroupOpen: false
          });
          this.loadRooms();
          this.openChat(r.room.id);
        }
      });
    }
    submitRequest(body) {
      if (this.state.demo) {
        const rec = Object.assign({
          id: 'r' + Date.now(),
          status: 'pending',
          by: {
            username: 'demo',
            name: this.state.me.name
          },
          createdAt: Date.now(),
          deptName: 'LDR'
        }, body);
        return this.setState(s => ({
          reqSent: true,
          reqReason: '',
          live: Object.assign({}, s.live, {
            requests: {
              mine: [rec].concat(s.live.requests.mine),
              team: s.live.requests.team
            }
          })
        }));
      }
      this.act('req', () => api('/api/phone/requests', {
        method: 'POST',
        body
      }), () => {
        this.setState({
          reqSent: true,
          reqReason: ''
        });
        this.loadRequests();
      });
    }
    decideRequest(r, status) {
      if (this.state.demo) return this.setState(s => ({
        live: Object.assign({}, s.live, {
          requests: {
            mine: s.live.requests.mine,
            team: s.live.requests.team.map(x => x.id === r.id ? Object.assign({}, x, {
              status,
              decidedBy: {
                name: s.me.name
              },
              decidedAt: Date.now()
            }) : x)
          }
        })
      }));
      this.act('decide:' + r.id, () => api('/api/phone/requests/' + encodeURIComponent(r.id) + '/decide', {
        method: 'POST',
        body: {
          status
        }
      }), () => this.loadRequests());
    }
    addHandover(item) {
      if (this.state.demo) return this.setState(s => ({
        handoverDraft: '',
        live: Object.assign({}, s.live, {
          handover: Object.assign({}, s.live.handover, {
            items: s.live.handover.items.concat([Object.assign({
              id: 'h' + Date.now(),
              done: false,
              by: {
                name: s.me.name
              }
            }, item)])
          })
        })
      }));
      const u = this.unit();
      this.act('handover', () => api('/api/phone/handover', {
        method: 'POST',
        body: Object.assign({
          dept: u ? u.id : undefined
        }, item)
      }), () => {
        this.setState({
          handoverDraft: ''
        });
        this.loadHandover();
      });
    }
    toggleHandover(it) {
      this.setState(s => ({
        live: Object.assign({}, s.live, {
          handover: Object.assign({}, s.live.handover, {
            items: s.live.handover.items.map(x => x.id === it.id ? Object.assign({}, x, {
              done: !x.done
            }) : x)
          })
        })
      }));
      if (!this.state.demo) this.act('ho:' + it.id, () => api('/api/phone/handover/' + encodeURIComponent(it.id) + '/toggle', {
        method: 'POST'
      }));
    }
    submitIncident(body) {
      if (this.state.demo) return this.setState({
        incSent: true,
        incDesc: '',
        incRef: 'IR-' + Y + '-0912'
      });
      this.act('incident', () => api('/api/phone/incidents', {
        method: 'POST',
        body
      }), r => {
        if (r && r.incident) this.setState({
          incSent: true,
          incDesc: '',
          incRef: r.incident.ref
        });
      });
    }
    submitMedRequest(body) {
      if (this.state.demo) return this.setState(s => ({
        mrSent: true,
        live: Object.assign({}, s.live, {
          medRequests: [Object.assign({
            id: 'm' + Date.now(),
            createdAt: Date.now(),
            status: body.urgent ? 'Urgent · paged' : 'In review',
            reply: null
          }, body)].concat(s.live.medRequests || [])
        })
      }));
      this.act('medreq', () => api('/api/phone/med-requests', {
        method: 'POST',
        body
      }), () => {
        this.setState({
          mrSent: true
        });
        this.loadMedRequests();
      });
    }
    submitShiftReport(body) {
      if (this.state.demo) return this.setState(s => ({
        srSent: true,
        srStep: 0,
        live: Object.assign({}, s.live, {
          shiftReports: [Object.assign({
            id: 's' + Date.now(),
            status: 'Submitted',
            by: {
              name: s.me.name
            },
            deptName: 'LDR',
            createdAt: Date.now()
          }, body)].concat(s.live.shiftReports || [])
        })
      }));
      this.act('shiftrep', () => api('/api/phone/shift-reports', {
        method: 'POST',
        body
      }), () => {
        this.setState({
          srSent: true,
          srStep: 0
        });
        this.loadShiftReports();
      });
    }
    openMed(m) {
      if (!m) return;
      this.setState({
        screen: 'medDetail',
        selMed: m.id,
        medTab: 'overview',
        drawerOpen: false
      });
      if (m.live && !this.state.medDetail[m.id]) {
        tryApi('/api/med/brand/' + encodeURIComponent(m.id)).then(r => {
          if (!r || !r.ok) return;
          const g = r.generic || {},
            sec = normaliseMonograph(g.monograph || g.sections || {});
          this.setState(s => ({
            medDetail: Object.assign({}, s.medDetail, {
              [m.id]: {
                sec,
                nursing: sec['Precautions And Warnings'] ? String(sec['Precautions And Warnings']).split(/\n|\. /)[0] + '.' : ''
              }
            })
          }));
        });
      }
    }
    searchMeds(q) {
      const term = String(q || '').trim();
      clearTimeout(this._medT);
      if (!this.state.live.meds || term.length < 2) return;
      this._medT = setTimeout(() => {
        tryApi('/api/med/search?q=' + encodeURIComponent(term) + '&kind=brand&limit=30').then(r => {
          if (!r || !r.ok || !Array.isArray(r.brands)) return;
          this.setState({
            medSearch: {
              q: term.toLowerCase(),
              rows: r.brands.map(liveMed)
            }
          });
        });
      }, 250);
    }
    async submitDc(item, monthObj, x) {
      const s = this.state,
        mi = clamp(s.dcMonth, 0, DC_MONTHS.length - 1),
        at = dayStamp();
      const local = (status, extra) => this.setState({
        dcSubs: Object.assign({}, s.dcSubs, {
          [mi]: Object.assign({}, s.dcSubs[mi] || {}, {
            [item.id]: Object.assign({
              status,
              num: x.num,
              den: x.den,
              vals: x.vals,
              at,
              note: x.note,
              reason: null,
              reviewer: ''
            }, extra || {})
          })
        }),
        dcFormSent: true,
        dcCorr: '',
        dcEvidence: false
      });
      if (s.demo) return local('sent');
      if (this._dcBusy) return;
      this._dcBusy = true;
      this.setState(st => ({
        busy: Object.assign({}, st.busy, {
          dc: true
        })
      }));
      try {
        const corr = x.isCorr ? String(x.corr || '').trim() : '';
        if (item.kind === 'stat') {
          if (!x.dept) throw new Error('Your account is not linked to a department sheet.');
          const values = {};
          (item.fields || []).forEach((f, i) => {
            if (x.vals[i] !== '' && x.vals[i] != null) values[f.id] = x.vals[i];
          });
          await api('/api/submissions/patient', {
            method: 'POST',
            body: {
              department: x.dept.id || x.dept._id,
              month: monthObj.key,
              values,
              note: x.note,
              isCorrection: !!x.isCorr,
              correctionReason: corr
            }
          });
        } else {
          if (!x.area) throw new Error('Your account is not linked to a quality area.');
          const ind = item.ind || {},
            rate = !!item.isRate;
          await api('/api/submissions/quality', {
            method: 'POST',
            body: {
              area: x.area.key,
              indicatorId: item.id,
              indicatorName: item.label,
              month: monthObj.key,
              entryMode: rate ? 'rate' : 'count',
              formula: rate ? item.formula : 'count',
              mult: rate ? item.mult : 1,
              valueType: rate ? item.formula === 'pct' ? '%' : 'Rate' : 'Count',
              value: rate ? undefined : x.num,
              num: rate ? x.num : undefined,
              den: rate && !item.denLocked ? x.den : undefined,
              numLabel: rate ? item.num : undefined,
              denLabel: rate ? item.den : undefined,
              unit: rate ? ind.unit || item.unit : ind.unit || 'count',
              remark: x.note,
              note: x.note,
              benchmark: ind.benchmark,
              benchmarkValue: ind.benchmarkValue,
              goalDirection: ind.goalDirection,
              isCorrection: !!x.isCorr,
              correctionReason: corr
            }
          });
        }
        await this.loadSubs();
        this.setState({
          dcFormSent: true,
          dcCorr: '',
          dcEvidence: false,
          dcVals: {}
        });
      } catch (e) {
        this.toastMsg(e.message || 'The server did not accept the submission.', 'dcToast');
      } finally {
        this._dcBusy = false;
        this.setState(st => {
          const b = Object.assign({}, st.busy);
          delete b.dc;
          return {
            busy: b
          };
        });
      }
    }
    renderVals() {
      const s = this.state,
        go = this.go,
        live = s.live,
        me = s.me || {},
        boot = s.boot || {},
        F = this.F();
      const bu = boot.user || {};
      const isIncharge = s.role === 'incharge',
        isNurse = !isIncharge;
      const staffName = me.name || bu.name || '';
      const designation = me.designation || me.title || bu.roleLabel || (me.role === 'incharge' ? 'Nurse In-charge' : me.role === 'pca' ? 'Patient Care Assistant' : me.role === 'collector' ? 'Data collector' : 'Staff Nurse');
      const unit = boot.unit || null;
      const units = boot.units || [];
      const dept = unit ? unit.short || unit.name : units.length ? 'All units' : '—';
      const isRealIncharge = me.role === 'incharge';
      const qAreas = !unit && !s.demo && me.role === 'collector' ? live.quality || [] : [];
      const qArea = qAreas.find(a => String(a.key) === String(s.dcAreaSel)) || qAreas[0] || null;
      const unitChip = unit ? (unit.short || unit.name) + (units.length > 1 ? ' ▾' : '') : qArea ? (qArea.name || qArea.key) + (qAreas.length > 1 ? ' ▾' : '') : units.length ? 'Choose a unit ▾' : 'No unit assigned';
      const pickUnit = () => {
        if (!unit && qAreas.length > 1) {
          const i = qAreas.indexOf(qArea);
          return this.setState({
            dcAreaSel: qAreas[(i + 1) % qAreas.length].key
          });
        }
        if (units.length <= 1) {
          if (!unit && units[0]) this.setUnit(units[0].id);
          return;
        }
        const i = units.findIndex(x => unit && x.id === unit.id);
        this.setUnit(units[(i + 1) % units.length].id);
      };
      const hospital = boot.hospital || s.branding || {};
      const phonesOn = F.phones !== false && !(boot.policy && boot.policy.portalPhones === false);
      const staffAll = live.staff || [];
      const myRec = staffAll.find(p => me.empId && p.emp_id && norm(p.emp_id) === norm(me.empId) || me.staffEmpId && p.emp_id && norm(p.emp_id) === norm(me.staffEmpId) || staffName && norm(p.name) === norm(staffName)) || null;
      const empIdShown = me.empId || myRec && myRec.emp_id || (me.username ? '@' + me.username : '—');
      const initials = ini(staffName || '?');
      const hour = NOW.getHours();
      const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
      const inMyUnit = p => {
        const d = String(p.current_department || '');
        return unit ? d.split(',').some(x => norm(x) === norm(unit.name) || norm(x) === norm(unit.id) || unit.short && norm(x) === norm(unit.short)) : true;
      };
      const gridOf = p => live.roster && live.roster.grid && p && live.roster.grid['S' + p.id] || null;
      const codeOn = (row, d) => {
        if (!row) return '';
        const c = Array.isArray(row) ? row[d - 1] : row[d];
        return c == null ? '' : String(c);
      };
      const ROSTER = {};
      let rosterLive = false;
      const myRow = gridOf(myRec);
      if (myRow) {
        for (let d = 1; d <= DIM; d++) ROSTER[d] = codeOn(myRow, d) || 'O';
        rosterLive = true;
      } else for (let d = 1; d <= DIM; d++) ROSTER[d] = '';
      const todayCode = ROSTER[TODAY],
        today = shiftOf(todayCode);
      const sel = clamp(s.selDay, 1, DIM),
        selCode = ROSTER[sel],
        selSh = shiftOf(selCode);
      const todayLabel = dateLabel(TODAY);
      const nextShiftCode = (() => {
        for (let d = TODAY + 1; d <= DIM; d++) if (isWork(ROSTER[d])) return ROSTER[d];
        return rosterLive ? '—' : '';
      })();
      const rosterNote = rosterLive ? live.roster.status === 'approved' ? 'published' : 'draft' : live.roster ? 'you are not on this sheet' : 'not published yet';
      const dir = live.directory || [];
      const acctOf = p => dir.find(a => a.staffEmpId && p.emp && norm(a.staffEmpId) === norm(p.emp) || norm(a.name) === norm(p.name)) || null;
      const STAFF = staffAll.filter(p => !p.former && p.is_active !== false).map(p => {
        const row = gridOf(p);
        const base = {
          name: p.name,
          dept: String(p.current_department || '').split(',')[0].trim() || '—',
          title: p.designation || (p.role === 'PCA' ? 'Patient Care Assistant' : 'Staff Nurse'),
          admin: /in.?charge|manager|supervisor/i.test(p.designation || ''),
          phone: phonesOn ? p.phone || p.mobile || '' : '',
          ext: phonesOn ? p.ext || '' : '',
          email: p.email || '',
          emp: p.emp_id || '',
          reg: p.bnmc || p.reg_no || '—',
          shift: row ? codeOn(row, TODAY) || 'O' : '',
          joined: p.doj ? fmtIso(p.doj) : p.joined || '',
          id: p.id,
          photo: p.photo || null,
          isPca: p.role === 'PCA',
          mine: inMyUnit(p)
        };
        base.photoUrl = p.photo ? typeof p.photo === 'string' ? p.photo : p.photo.url : p.photo_url || null;
        base.role = [base.title, base.dept].join(', ');
        const a = acctOf(base);
        base.username = a ? a.username : null;
        base.online = !!(a && a.online);
        base.hasApp = !!a;
        return base;
      });
      const unitStaff = STAFF.filter(p => p.mine);
      const onlineN = STAFF.filter(p => p.online).length;
      const ALL_NOTICES = (live.notices || []).map(n => noticeOf(n, me.username)).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.ts || 0) - (a.ts || 0));
      const noticeRaw = ALL_NOTICES.find(n => n.id === s.selNotice) || ALL_NOTICES[0] || {
        id: null,
        cat: 'General',
        title: 'No notice selected',
        body: '',
        full: '',
        from: '—',
        fromRole: '',
        when: '',
        audience: '',
        attachments: [],
        comments: [],
        ackPending: [],
        ackCount: 0,
        ackTotal: 0
      };
      const noticeSrc = (live.notices || []).find(n => n.id === noticeRaw.id) || null;
      const unread = ALL_NOTICES.filter(n => !n.read);
      const needsAction = ALL_NOTICES.filter(n => n.needsAck && !n.acked);
      const reqs = live.requests || {
        mine: [],
        team: []
      };
      const pendingCount = reqs.team.filter(r => r.status === 'pending').length;
      const calCells = [];
      for (let i = 0; i < FIRST_DOW; i++) calCells.push({
        d: '',
        code: '',
        style: 'border:0;background:transparent;min-height:48px',
        dayStyle: '',
        codeStyle: '',
        go: () => {}
      });
      for (let d = 1; d <= DIM; d++) {
        const code = ROSTER[d],
          sh = shiftOf(code),
          isT = d === TODAY,
          isSel = d === sel,
          off = !isWork(code);
        calCells.push({
          d,
          code: code === '' ? '·' : code,
          go: () => go('shift', {
            selDay: d
          }),
          style: `display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;min-height:48px;border-radius:10px;cursor:pointer;padding:4px 0;border:1.5px solid ${isSel ? '#0090ca' : isT ? 'rgba(0,144,202,.45)' : 'transparent'};background:${isSel ? 'rgba(0,144,202,.12)' : off ? 'rgba(125,145,180,.08)' : 'rgba(255,255,255,.55)'}`,
          dayStyle: `font-size:12px;font-weight:${isT ? 800 : 600};color:${isT ? '#0072a3' : '#16202e'}`,
          codeStyle: MONO + `;font-size:9.5px;font-weight:700;padding:1px 5px;border-radius:5px;color:${sh.color};background:${sh.bg}`
        });
      }
      const codes = Object.values(ROSTER);
      const shiftsN = codes.filter(isWork).length,
        nights = codes.filter(c => bucketOf(c) === 'N').length,
        offN = rosterLive ? codes.length - shiftsN : 0;
      const hours = codes.reduce((a, c) => a + (isWork(c) ? hoursOf(c) : 0), 0);
      const upcoming = [];
      for (let d = TODAY; d < TODAY + 7; d++) {
        const dd = (d - 1) % DIM + 1;
        upcoming.push({
          d: dd,
          dow: dowOf(dd),
          code: ROSTER[dd] === '' ? '·' : ROSTER[dd],
          go: () => go('shift', {
            selDay: dd
          }),
          codeStyle: codeChip(ROSTER[dd]),
          style: `flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;padding:8px 2px;border-radius:12px;cursor:pointer;color:#16202e;border:1.5px solid ${dd === TODAY ? '#0090ca' : 'rgba(255,255,255,.9)'};background:${dd === TODAY ? 'rgba(0,144,202,.1)' : 'rgba(255,255,255,.6)'}`
        });
      }
      const team = unitStaff.filter(p => p.name !== staffName && selCode && isWork(selCode) && codeOn(gridOf(staffAll.find(x => x.id === p.id)), sel) === selCode).slice(0, 8).map(p => ({
        ini: ini(p.name),
        name: p.name,
        role: p.title,
        code: selCode,
        tel: tel(p.phone),
        chat: () => this.openDM(p),
        username: p.username
      }));
      const meds = s.meds || [];
      const q = s.medQuery.trim().toLowerCase();
      const classes = live.meds ? ['All', ...Array.from(new Set(meds.map(m => m.cat).filter(Boolean))).slice(0, 10)] : MED_CATS;
      const medPool = q && s.medSearch && s.medSearch.q === q && s.medSearch.rows.length ? [...meds, ...s.medSearch.rows.filter(r => !meds.some(m => m.id === r.id))] : meds;
      const medList = medPool.filter(m => (s.medClass === 'All' || m.cat === s.medClass) && (!s.alertOnly || m.alert) && (!q || [m.brand, m.generic, m.cls, m.mfr, m.cat].some(x => String(x || '').toLowerCase().includes(q)))).map(m => ({
        ...m,
        go: () => this.openMed(m),
        imgStyle: `width:52px;height:52px;border-radius:12px;border:1px solid rgba(125,145,180,.2);flex-shrink:0;background:#fff ${m.img ? `url(${m.img}) center/calc(100% - 8px) no-repeat` : ''}`
      }));
      const medRaw = medPool.find(m => m.id === s.selMed) || meds[0] || {
        id: '',
        brand: live.medsError ? 'Catalogue unavailable' : '',
        generic: '',
        cls: '',
        cat: '',
        route: '',
        strength: '',
        img: '',
        mfr: '',
        price: '',
        alert: false,
        nursing: '',
        facts: {
          max: '',
          food: 'any',
          preg: 'safe'
        },
        sec: {}
      };
      const detail = s.medDetail[medRaw.id] || {};
      const allSec = Object.assign({}, s.mono[medRaw.id] || {}, medRaw.sec || {}, detail.sec || {});
      const med = {
        ...medRaw,
        maxDose: medRaw.facts && medRaw.facts.max || '—',
        food: FOODS[medRaw.facts && medRaw.facts.food] || '—',
        preg: (PREGS[medRaw.facts && medRaw.facts.preg] || PREGS.safe)[0],
        pregColor: (PREGS[medRaw.facts && medRaw.facts.preg] || PREGS.safe)[1],
        nursing: medRaw.nursing || detail.nursing || 'Confirm the prescription, dose and route against the drug chart. Check allergies before the first dose.',
        imgStyle: `width:92px;height:92px;border-radius:18px;border:1px solid rgba(125,145,180,.2);flex-shrink:0;box-shadow:0 10px 26px rgba(31,59,90,.12);background:#fff ${medRaw.img ? `url(${medRaw.img}) center/calc(100% - 12px) no-repeat` : ''}`
      };
      const tabKeys = Object.assign({}, MED_TABS, {
        more: [...MED_TABS.more, ...Object.keys(allSec).filter(k => !Object.values(MED_TABS).some(arr => arr.includes(k)))]
      });
      const medSections = (tabKeys[s.medTab] || []).filter(k => allSec[k]).map(k => ({
        label: k,
        color: SEC_COLOR[k] || '#3c4858',
        text: allSec[k]
      }));
      const isFav = s.favs.includes(med.id);
      const medReqs = live.medRequests || [];
      const ALL_CHATS = (live.rooms || []).map(chatOf);
      const cq = s.chatSearch.trim().toLowerCase();
      const roomDepts = Array.from(new Set(ALL_CHATS.filter(c => c.scope === 'dept' && c.dept).map(c => c.dept)));
      const chatsVisible = ALL_CHATS.filter(c => cq ? (c.name + ' ' + (c.last ? c.last.text : '')).toLowerCase().includes(cq) : s.chatTab === 'hosp' ? c.scope === 'hosp' : c.scope !== 'hosp' && (s.chatDept === 'All' || c.dept === s.chatDept));
      const chatUnreadTotal = ALL_CHATS.reduce((a, c) => a + (c.muted ? 0 : c.unread), 0);
      const threadRoom = ALL_CHATS.find(c => c.id === s.selChat) || null;
      const th = s.selChat && live.threads[s.selChat] || null;
      const threadRaw = Object.assign({
        id: s.selChat,
        name: threadRoom ? threadRoom.name : 'Conversation',
        group: threadRoom ? threadRoom.group : true,
        scope: threadRoom ? threadRoom.scope : 'dept',
        sub: threadRoom ? threadRoom.sub : '',
        pinned: threadRoom ? threadRoom.pinned : null,
        readOnly: !!(threadRoom && threadRoom.readOnly),
        members: threadRoom ? threadRoom.members : 0
      }, th ? {
        name: th.room.name || threadRoom && threadRoom.name,
        sub: th.room.sub || threadRoom && threadRoom.sub || '',
        pinned: th.room.pinned,
        readOnly: !!th.room.readOnly,
        group: th.room.group !== undefined ? !!th.room.group : threadRoom ? threadRoom.group : true,
        other: th.room.other
      } : {});
      const msgs = th ? th.messages : [];
      const pinnedMsg = threadRaw.pinned || null;
      const canPin = isIncharge || !threadRaw.group || bu.canManage;
      const messages = msgs.map((m, i) => {
        const mine = !!m.mine;
        const selected = s.selMsg === i;
        const reactions = (m.reactions || []).map(r => r.n > 1 ? `${r.label} · ${r.n}` : r.label);
        const isPinned = !!(pinnedMsg && pinnedMsg.id === m.id);
        return {
          text: m.text,
          time: hm(new Date(m.ts || 0)),
          sender: m.from.name,
          role: m.from.role || '',
          ini: ini(m.from.name || '?'),
          showSender: !mine && threadRaw.group,
          urgent: !!m.urgent,
          seen: mine ? m.seen || (i === msgs.length - 1 ? 'Delivered' : 'Seen') : null,
          replyTo: m.replyTo ? `${m.replyTo.from ? m.replyTo.from + ': ' : ''}${m.replyTo.text}` : null,
          attach: m.attach ? m.attach.name : null,
          attachIcon: ATTACH_ICONS[m.attach && m.attach.type] || ATTACH_ICONS.pdf,
          selected,
          hasReactions: reactions.length > 0,
          reactions,
          select: () => this.setState({
            selMsg: selected ? null : i
          }),
          rowStyle: `display:flex;gap:8px;justify-content:${mine ? 'flex-end' : 'flex-start'}`,
          colStyle: `display:flex;flex-direction:column;align-items:${mine ? 'flex-end' : 'flex-start'};max-width:80%;gap:4px`,
          bubbleStyle: `display:block;width:100%;box-sizing:border-box;text-align:left;cursor:pointer;font-family:inherit;padding:9px 12px 6px;border-radius:${mine ? '16px 16px 4px 16px' : '16px 16px 16px 4px'};${m.system ? 'background:rgba(125,145,180,.12);color:#3c4858;border:0;font-style:italic' : mine ? 'background:linear-gradient(140deg,#0aa0d4,#0072a3);color:#fff;border:0' : 'background:rgba(255,255,255,.85);color:#16202e;border:1px solid rgba(255,255,255,.95)'};${m.urgent ? 'box-shadow:0 0 0 2px rgba(210,58,82,.45),0 4px 14px rgba(31,59,90,.08)' : selected ? 'box-shadow:0 0 0 2px rgba(0,144,202,.45),0 4px 14px rgba(31,59,90,.08)' : 'box-shadow:0 4px 14px rgba(31,59,90,.08)'}`,
          replyStyle: `border-left:3px solid ${mine ? 'rgba(255,255,255,.7)' : '#0090ca'};padding:3px 8px;margin-bottom:5px;font-size:11.5px;border-radius:4px;background:${mine ? 'rgba(255,255,255,.15)' : 'rgba(0,144,202,.08)'};color:${mine ? 'rgba(255,255,255,.9)' : '#3c4858'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis`,
          attachStyle: `display:flex;align-items:center;gap:8px;padding:7px 9px;margin-bottom:6px;border-radius:9px;font-size:12px;font-weight:600;background:${mine ? 'rgba(255,255,255,.18)' : 'rgba(0,144,202,.08)'};color:${mine ? '#fff' : '#0072a3'}`,
          timeStyle: MONO + `;font-size:9.5px;margin-top:3px;text-align:right;color:${mine ? 'rgba(255,255,255,.7)' : '#9aa6b4'}`,
          reactRow: 'display:flex;gap:4px;flex-wrap:wrap;margin-top:-8px;padding:0 4px;position:relative;z-index:1',
          actionRow: 'display:flex;gap:5px;flex-wrap:wrap;padding:2px 0;animation:pop .2s ease',
          actions: [{
            label: 'Reply',
            go: () => this.setState({
              selMsg: null,
              replyTo: i
            })
          }, {
            label: 'Ack',
            go: () => this.reactMsg(threadRaw.id, m, 'Ack')
          }, {
            label: 'On it',
            go: () => this.reactMsg(threadRaw.id, m, 'On it')
          }, ...(canPin ? [{
            label: isPinned ? 'Unpin' : 'Pin',
            go: () => this.pinMsg(threadRaw.id, isPinned ? null : m)
          }] : []), ...(mine && Date.now() - (m.ts || 0) < 10 * 60000 ? [{
            label: 'Delete',
            go: () => this.deleteMsg(threadRaw.id, m)
          }] : [{
            label: 'Forward',
            go: () => this.setState({
              selMsg: null,
              screen: 'chats',
              draft: m.text
            })
          }])]
        };
      });
      const replyingTo = s.replyTo !== null && msgs[s.replyTo] ? `${msgs[s.replyTo].mine ? 'You' : msgs[s.replyTo].from.name}: ${msgs[s.replyTo].text}` : null;
      const sendMsg = text => this.sendMsg(threadRaw.id, typeof text === 'string' ? text : s.draft);
      const openChat = id => this.openChat(id);
      const roomMembers = (th ? th.members : []).map(m => {
        const p = STAFF.find(x => x.username === m.username || norm(x.name) === norm(m.name)) || {};
        return Object.assign({
          name: m.name,
          title: m.role,
          role: m.role,
          online: !!m.online,
          admin: !!m.admin,
          dept: p.dept || ''
        }, p, {
          ini: ini(m.name || '?'),
          username: m.username
        });
      });
      const isMuted = !!(threadRoom && threadRoom.muted);
      const threadPerson = !threadRaw.group ? STAFF.find(p => p.username && p.username === threadRaw.other) || STAFF.find(p => p.name === threadRaw.name) || null : null;
      const avOf = c => ({
        av: c.group ? c.scope === 'hosp' ? 'HC' : ini(c.name || '?') : ini(c.name || '?'),
        avStyle: avStyle(c.group)
      });
      const sq = s.staffSearch.trim().toLowerCase();
      const lastActiveOf = p => p.online ? 'Active now' : p.hasApp ? 'Offline' : 'No app account';
      const deptList = ['All', ...(unit ? [unitStaff[0] ? unitStaff[0].dept : dept] : []), ...Array.from(new Set(STAFF.map(p => p.dept))).filter(Boolean)].filter((d, i, a) => a.indexOf(d) === i);
      const staffList = STAFF.filter(p => p.name !== staffName && (s.staffDept === 'All' || p.dept === s.staffDept) && (!s.staffOnlineOnly || p.online) && (!sq || (p.name + ' ' + p.role + ' ' + p.dept + ' ' + p.ext + ' ' + p.phone).toLowerCase().includes(sq))).sort((a, b) => s.staffSort === 'active' ? (b.online ? 1 : 0) - (a.online ? 1 : 0) || (b.hasApp ? 1 : 0) - (a.hasApp ? 1 : 0) || (b.mine ? 1 : 0) - (a.mine ? 1 : 0) || a.name.localeCompare(b.name) : a.name.localeCompare(b.name));
      const person = STAFF.find(p => p.name === s.selStaff) || staffList[0] || STAFF[0] || {
        name: '—',
        title: '',
        dept: '',
        role: '',
        phone: '',
        ext: '',
        email: '',
        emp: '',
        reg: '',
        shift: '',
        joined: '',
        online: false,
        hasApp: false
      };
      const personSh = shiftOf(person.shift);
      const personRooms = ALL_CHATS.filter(c => c.group && (c.dept === person.dept || c.scope === 'hosp')).slice(0, 3).map(c => ({
        name: c.name,
        members: c.members,
        go: () => openChat(c.id)
      }));
      const canCall = !!person.phone;
      const phonebookRows = (boot.phonebook || []).map(r => Array.isArray(r) ? {
        sec: r[0],
        label: r[1],
        sub: r[2],
        num: r[3]
      } : r);
      const phonebook = Array.from(new Set(phonebookRows.map(r => r.sec))).map(sec => {
        const look = PHONE_LOOK[sec] || PHONE_LOOK._;
        return {
          sec,
          items: phonebookRows.filter(r => r.sec === sec && (!sq || (r.label + ' ' + r.sub).toLowerCase().includes(sq))).map(r => ({
            label: r.label,
            sub: r.sub,
            num: r.num,
            d: look[2],
            tel: tel(r.num),
            iconWrap: `display:grid;place-items:center;width:36px;height:36px;border-radius:11px;color:${look[0]};background:${look[1]};flex-shrink:0`,
            style: 'display:flex;align-items:center;gap:11px;border:1px solid rgba(255,255,255,.9);border-radius:14px;padding:10px 12px;background:rgba(255,255,255,.66)',
            numStyle: MONO + `;display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700;padding:7px 10px;border-radius:9px;color:${look[0]};background:${look[1]};text-decoration:none;white-space:nowrap`
          }))
        };
      }).filter(g => g.items.length);
      const R = s.demo ? reportOf(null) : reportOf(live.report || {
        cols: [],
        months: [],
        series: {},
        indicators: [],
        staffing: null
      });
      const nL = R.labels.length;
      const periodOpts = R.live ? [['month', 'Latest month'], ['q', 'Last 3 months'], ['half', 'Last 6 months']] : [['today', 'Today'], ['week', 'This week'], ['month', 'This month'], ['quarter', 'Quarter']];
      const periodK = periodOpts.some(p => p[0] === s.repPeriod) ? s.repPeriod : periodOpts[R.live ? 0 : 1][0];
      const periodLabel = periodOpts.find(p => p[0] === periodK)[1];
      const win = R.live ? {
        month: 1,
        q: 3,
        half: 6
      }[periodK] || 1 : periodK === 'today' ? 1 : nL;
      const W = a => (a || []).slice(-win);
      const admT = sum(W(R.adm)),
        disT = sum(W(R.dis)),
        nvdT = sum(W(R.nvd)),
        csT = sum(W(R.cs)),
        deathsT = sum(W(R.deaths)),
        transT = sum(W(R.transfers));
      const occAvgN = R.occ ? Math.round(sum(W(R.occ)) / Math.max(1, W(R.occ).length)) : null;
      const csRateN = Math.round(csT / Math.max(1, csT + nvdT) * 100);
      const BEDS = R.beds,
        bedsUsed = BEDS && R.occ ? Math.round(BEDS * (R.occ[nL - 1] || 0) / 100) : null;
      const last = a => a && a.length ? a[a.length - 1] : 0,
        prev = a => a && a.length > 1 ? a[a.length - 2] : 0;
      const deltaOf = (a, pct) => {
        const d = last(a) - prev(a);
        if (!prev(a) && !last(a)) return '0';
        return pct ? (d >= 0 ? '+' : '−') + Math.abs(Math.round(d / Math.max(1, prev(a)) * 100)) + '%' : (d >= 0 ? '+' : '−') + Math.abs(d);
      };
      const prevNote = R.live ? 'vs previous month' : 'vs previous week';
      const INDS = R.indicators;
      const indColor = i => i.noData ? '#9aa6b4' : RAG[ragOf(i)][0];
      const indicatorsAlertRaw = INDS.filter(i => !i.noData && ragOf(i) !== 'green');
      const eventsSeries = INDS.length ? INDS[0].trend.map((_, k) => INDS.reduce((a, i) => a + (i.noData ? 0 : (i.trend[k] || 0) > (i.dir === 'up' ? -1 : i.benchV) ? 1 : 0), 0)) : R.labels.map(() => 0);
      const kpiDef = [{
        k: 'adm',
        label: 'Admissions',
        v: admT,
        delta: deltaOf(R.adm, true),
        good: last(R.adm) >= prev(R.adm),
        note: prevNote,
        series: R.adm,
        color: '#0090ca'
      }, {
        k: 'dis',
        label: 'Discharges',
        v: disT,
        delta: deltaOf(R.dis, true),
        good: last(R.dis) >= prev(R.dis),
        note: prevNote,
        series: R.dis,
        color: '#3ab5a7'
      }, ...(R.hasDel !== false ? [{
        k: 'del',
        label: 'Deliveries',
        v: nvdT + csT,
        delta: deltaOf(R.nvd.map((n, i) => n + (R.cs[i] || 0))),
        good: true,
        note: `${nvdT} NVD · ${csT} CS`,
        series: R.nvd.map((n, i) => n + (R.cs[i] || 0)),
        color: '#6a52d4'
      }] : []), ...(R.occ ? [{
        k: 'occ',
        label: 'Occupancy',
        v: occAvgN + '%',
        delta: deltaOf(R.occ) + ' pts',
        good: occAvgN < 85,
        note: BEDS ? `${bedsUsed} of ${BEDS} beds now` : 'average',
        series: R.occ,
        color: '#e08a1e'
      }] : []), {
        k: 'deaths',
        label: 'Deaths',
        v: deathsT,
        delta: deltaOf(R.deaths),
        good: !deathsT,
        note: R.live ? 'this period' : 'this week',
        series: R.deaths,
        color: '#d23a52'
      }, {
        k: 'ev',
        label: 'Indicators off target',
        v: indicatorsAlertRaw.length,
        delta: INDS.length ? `of ${INDS.length}` : '—',
        good: !indicatorsAlertRaw.length,
        note: indicatorsAlertRaw.slice(0, 2).map(i => i.name).join(' · ') || 'all on target',
        series: eventsSeries,
        color: '#b8650a'
      }];
      const repKpis = kpiDef.slice().sort((a, b) => (s.pinnedKpis[b.k] ? 1 : 0) - (s.pinnedKpis[a.k] ? 1 : 0)).map(k => ({
        label: k.label,
        v: k.v,
        delta: k.delta,
        note: k.note,
        color: k.color,
        spark: spark(k.series, k.color),
        pin: e => {
          if (e && e.stopPropagation) e.stopPropagation();
          this.setState({
            pinnedKpis: {
              ...s.pinnedKpis,
              [k.k]: !s.pinnedKpis[k.k]
            }
          });
        },
        pinFill: s.pinnedKpis[k.k] ? '#e08a1e' : 'none',
        pinStyle: `display:grid;place-items:center;width:20px;height:20px;border-radius:6px;color:${s.pinnedKpis[k.k] ? '#e08a1e' : '#c4ccd6'};cursor:pointer`,
        deltaStyle: `font-size:11px;font-weight:700;padding:2px 6px;border-radius:6px;color:${k.good ? '#1d8f57' : '#b32e2e'};background:${k.good ? 'rgba(43,182,115,.13)' : 'rgba(214,69,69,.12)'}`,
        style: `display:flex;flex-direction:column;align-items:flex-start;gap:6px;text-align:left;border:1px solid ${s.pinnedKpis[k.k] ? 'rgba(224,138,30,.4)' : 'rgba(255,255,255,.9)'};border-radius:15px;padding:12px 13px;background:rgba(255,255,255,.66);cursor:pointer;color:#16202e`,
        go: () => this.setState({
          repTab: k.k === 'ev' ? 'quality' : k.k === 'occ' || k.k === 'adm' || k.k === 'dis' || k.k === 'deaths' ? 'census' : 'overview'
        })
      }));
      const censusMax = Math.max(...R.adm, ...R.dis, 1);
      const PREV = {
        adm: R.adm.map((_, i) => i ? R.adm[i - 1] : 0)
      };
      const censusBars = R.labels.map((lbl, i) => {
        const tip = `${lbl}: ${R.adm[i]} admissions, ${R.dis[i]} discharges, ${(R.nvd[i] || 0) + (R.cs[i] || 0)} deliveries`;
        return {
          label: lbl.split(' ')[0],
          tip: `${lbl}: ${R.adm[i]} admissions · ${R.dis[i]} discharges`,
          go: () => this.setState({
            censusTip: s.censusTip === tip ? '' : tip
          }),
          colStyle: 'flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;height:100%;border:0;background:transparent;padding:0;cursor:pointer',
          a: `width:10px;height:${Math.max(6, Math.round(R.adm[i] / censusMax * 84))}px;border-radius:3px 3px 0 0;background:#0090ca`,
          b: `width:10px;height:${Math.max(6, Math.round(R.dis[i] / censusMax * 84))}px;border-radius:3px 3px 0 0;background:#3ab5a7`,
          p: `width:6px;height:${Math.max(6, Math.round(PREV.adm[i] / censusMax * 84))}px;border-radius:3px 3px 0 0;background:rgba(125,145,180,.45)`
        };
      });
      const idot = c => `width:8px;height:8px;border-radius:50%;background:${c};flex-shrink:0;margin-top:6px`;
      const worst = indicatorsAlertRaw.slice().sort((a, b) => (ragOf(a) === 'red' ? 0 : 1) - (ragOf(b) === 'red' ? 0 : 1))[0] || null;
      const insights = [{
        text: `${admT} admissions and ${disT} discharges ${R.live ? 'in the ' + periodLabel.toLowerCase() : 'this week'} (${kpiDef[0].delta} ${prevNote}).${occAvgN != null ? ` Average occupancy ${occAvgN}%${occAvgN >= 85 ? ' — above the 85% safe-capacity line' : ''}.` : ''}`,
        dot: idot('#0090ca'),
        action: null,
        go: () => {}
      }, ...(nvdT + csT ? [{
        text: `${nvdT + csT} deliveries · CS rate ${csRateN}%.`,
        dot: idot('#e08a1e'),
        action: null,
        go: () => {}
      }] : []), ...(worst ? [{
        text: `${worst.name} is ${ragOf(worst) === 'red' ? 'in breach' : 'off target'}: ${worst.v}${worst.unit === '%' ? '%' : ''} against ${worst.bench}.`,
        dot: idot(ragOf(worst) === 'red' ? '#d23a52' : '#e08a1e'),
        action: 'Open indicator',
        go: () => go('indicator', {
          selInd: worst.id
        })
      }] : []), {
        text: INDS.length ? `${INDS.filter(i => !i.noData && ragOf(i) === 'green').length} of ${INDS.length} indicators on target${INDS.some(i => i.noData) ? ` · ${INDS.filter(i => i.noData).length} without data this month` : ''}.` : 'No quality indicators are configured for this unit yet.',
        dot: idot('#1d8f57'),
        action: null,
        go: () => {}
      }];
      const indRow = i => ({
        name: i.name,
        bench: i.bench,
        unit: i.unit,
        v: i.noData ? '—' : i.v + (String(i.unit).startsWith('%') ? '%' : ''),
        color: indColor(i),
        dot: dot(indColor(i)),
        spark: spark(i.trend, indColor(i)),
        go: () => go('indicator', {
          selInd: i.id
        }),
        info: e => {
          if (e && e.stopPropagation) e.stopPropagation();
          this.setState({
            infoOpen: true,
            infoInd: i.id
          });
        }
      });
      const indicatorsAlert = indicatorsAlertRaw.map(indRow);
      const indicators = INDS.map(indRow);
      const ragSummary = ['green', 'amber', 'red'].map(k => ({
        n: INDS.filter(i => !i.noData && ragOf(i) === k).length,
        label: RAG[k][2],
        dot: dot(RAG[k][0])
      }));
      const occRows = R.occ ? [[dept, last(R.occ)]].map(([l, v]) => ({
        label: l,
        v: v + '%',
        bar: `height:100%;width:${v}%;border-radius:999px;background:${v >= 90 ? 'linear-gradient(90deg,#e08a1e,#d23a52)' : 'linear-gradient(90deg,#3ab5a7,#0090ca)'}`
      })) : s.demo ? [['LDR', 92], ['PNW', 78], ['ANW', 70], ['HDU', 100]].map(([l, v]) => ({
        label: l,
        v: v + '%',
        bar: `height:100%;width:${v}%;border-radius:999px;background:${v >= 90 ? 'linear-gradient(90deg,#e08a1e,#d23a52)' : 'linear-gradient(90deg,#3ab5a7,#0090ca)'}`
      })) : [];
      const occBars = R.occ ? R.labels.map((lbl, i) => ({
        label: lbl.split(' ')[0],
        v: R.occ[i],
        bar: `width:100%;max-width:26px;height:${Math.round(R.occ[i] / 100 * 70)}px;border-radius:4px 4px 0 0;background:${R.occ[i] >= 85 ? 'linear-gradient(180deg,#e08a1e,#d23a52)' : '#0090ca'}`
      })) : [];
      const censusTiles = [['Admissions', admT, '#0072a3'], ['Discharges', disT, '#1e8a7c'], ['NVD', nvdT, '#3ab5a7'], ['Caesarean', csT, '#0090ca'], ['Deaths', deathsT, '#b32e2e'], ['Transfers', transT, '#6a52d4']].map(([label, v, color]) => ({
        label,
        v,
        color
      }));
      const censusTable = R.labels.map((day, i) => ({
        day,
        adm: R.adm[i],
        dis: R.dis[i],
        nvd: R.nvd[i] || 0,
        cs: R.cs[i] || 0,
        style: `display:grid;grid-template-columns:1.2fr repeat(4,1fr);gap:4px;padding:9px 12px;font-size:12.5px;border-top:1px solid rgba(125,145,180,.12);${i === nL - 1 ? 'background:rgba(0,144,202,.06)' : ''}`
      }));
      const todayIso = isoDay(TODAY);
      const onLeaveToday = reqs.team.filter(r => r.type === 'leave' && r.status === 'approved' && r.date === todayIso).map(r => r.by && r.by.name);
      const byBucket = {
        M: [],
        E: [],
        N: [],
        G: []
      };
      unitStaff.forEach(p => {
        const b = bucketOf(p.shift);
        if (byBucket[b] && isWork(p.shift)) byBucket[b].push(p);
      });
      const staffShiftDef = s.demo ? [['M4', 'Morning', 5, 5], ['E3', 'Evening', 4, 3], ['N2', 'Night', 3, 3]] : [['M', 'Morning'], ['E', 'Evening'], ['N', 'Night'], ['G', 'General']].filter(([b]) => byBucket[b].length || b !== 'G').map(([b, name]) => {
        const planned = byBucket[b].length;
        const absent = byBucket[b].filter(p => onLeaveToday.indexOf(p.name) >= 0).length;
        return [byBucket[b][0] ? byBucket[b][0].shift : b, name, planned, planned - absent];
      });
      const staffShifts = staffShiftDef.map(([code, name, planned, actual]) => ({
        code,
        name,
        planned,
        actual,
        codeStyle: codeChip(code),
        color: actual < planned ? '#b32e2e' : '#1d8f57',
        bar: `position:absolute;left:0;top:0;bottom:0;width:${planned ? Math.round(actual / planned * 100) : 0}%;border-radius:999px;background:${actual < planned ? 'linear-gradient(90deg,#e08a1e,#d23a52)' : 'linear-gradient(90deg,#3ab5a7,#0090ca)'}`,
        gap: actual < planned ? `${planned - actual} short — on approved leave today` : null
      }));
      const leaveCodesToday = unitStaff.filter(p => isLeave(p.shift));
      const staffTiles = [{
        label: 'On duty today',
        v: staffShiftDef.reduce((a, x) => a + x[3], 0),
        color: '#0072a3',
        note: `across ${staffShiftDef.length} shifts`
      }, {
        label: 'Planned',
        v: staffShiftDef.reduce((a, x) => a + x[2], 0),
        color: '#3c4858',
        note: rosterLive || s.demo ? 'from roster' : 'no roster published'
      }, {
        label: 'Absent',
        v: s.demo ? 2 : onLeaveToday.length + leaveCodesToday.length,
        color: '#b32e2e',
        note: s.demo ? '1 sick · 1 leave' : `${onLeaveToday.length} leave approved · ${leaveCodesToday.length} rostered off`
      }];
      const absenceRows = (s.demo ? [['Tanvir Hossain', 'Sick leave · today', 'SICK', '#b32e2e', 'rgba(214,69,69,.12)'], ['Rahima Khatun', `Annual leave · ${clamp(TODAY + 14, 1, DIM)}–${clamp(TODAY + 18, 1, DIM)} ${MON3[M]} · pending`, 'LEAVE', '#b8650a', 'rgba(224,138,30,.15)'], ['Shathi Rani', 'Casual leave · yesterday', 'CL', '#1d8f57', 'rgba(43,182,115,.14)'], ['Sumaiya Akter', `Swap with you · ${clamp(TODAY + 4, 1, DIM)} ${MON3[M]}`, 'SWAP', '#0072a3', 'rgba(0,144,202,.13)']] : reqs.team.filter(r => r.status !== 'declined' && r.date >= todayIso).slice(0, 8).map(r => [r.by && r.by.name || '—', `${r.type === 'leave' ? (r.leaveType || 'Casual') + ' leave' : 'Swap ' + (r.code || '')} · ${fmtIso(r.date)} · ${r.status}`, r.type === 'leave' ? 'LEAVE' : 'SWAP', r.status === 'approved' ? '#1d8f57' : '#b8650a', r.status === 'approved' ? 'rgba(43,182,115,.14)' : 'rgba(224,138,30,.15)'])).map(([name, detail, tag, c, bg]) => ({
        ini: ini(name),
        name,
        detail,
        tag,
        tagStyle: `font-size:9.5px;font-weight:800;letter-spacing:.5px;padding:3px 7px;border-radius:6px;color:${c};background:${bg}`
      }));
      const shiftReps = (live.shiftReports || []).map(r => ({
        id: r.id,
        date: fmtIso(r.date),
        rawDate: r.date,
        shift: r.shift,
        status: r.status,
        meta: `${r.by && r.by.name || '—'} · ${r.counts && r.counts.adm || 0} adm · ${(r.counts && r.counts.nvd || 0) + (r.counts && r.counts.cs || 0)} deliveries · ${['falls', 'mederr', 'needle', 'code'].reduce((a, k) => a + (r.counts && r.counts[k] || 0), 0)} events`
      }));
      const submittedReports = shiftReps.map(r => ({
        shift: r.shift,
        shiftName: shiftOf(r.shift).name,
        date: r.date,
        meta: r.meta,
        status: r.status,
        codeStyle: codeChip(r.shift),
        statusStyle: statusStyle(r.status === 'Approved' ? 'Approved' : r.status === 'Returned' ? 'Declined' : 'Pending'),
        go: () => this.toastMsg('Report ' + r.date + ' ' + r.shift + ' · ' + r.status, 'exportToast')
      }));
      const simpleTiles = [{
        label: R.live ? 'Admissions · latest month' : 'Admissions today',
        v: last(R.adm),
        color: '#0072a3',
        bg: 'rgba(0,144,202,.13)',
        d: NAV_D.home,
        note: `${last(R.dis)} discharged${BEDS ? ` · ${bedsUsed} of ${BEDS} beds full` : ''}`,
        go: () => this.setState({
          repTab: 'census',
          repSimple: false
        })
      }, {
        label: R.live ? 'Deliveries · latest month' : 'Deliveries today',
        v: last(R.nvd) + last(R.cs),
        color: '#3ab5a7',
        bg: 'rgba(58,181,167,.16)',
        d: 'M12 2v20M2 12h20',
        note: `${last(R.nvd)} normal · ${last(R.cs)} caesarean`,
        go: () => this.setState({
          repTab: 'census',
          repSimple: false
        })
      }, {
        label: 'Needs attention',
        v: indicatorsAlert.length,
        color: '#b32e2e',
        bg: 'rgba(214,69,69,.12)',
        d: NAV_D.incident,
        note: indicatorsAlert.map(i => i.name).slice(0, 2).join(' · ') || 'all indicators on target',
        go: () => this.setState({
          repTab: 'quality',
          repSimple: false
        })
      }];
      const repTabDef = [['overview', 'Overview'], ['census', 'Census'], ['quality', 'Quality'], ['staffing', 'Staffing'], ['submitted', 'Submitted']];
      const repTabName = (repTabDef.find(t => t[0] === s.repTab) || repTabDef[0])[1];
      const summaryText = `${dept} · ${periodLabel}\n${admT} admissions · ${disT} discharges · ${nvdT + csT} deliveries (CS ${csRateN}%)\n${occAvgN != null ? 'Occupancy ' + occAvgN + '% · ' : ''}${deathsT} death${deathsT === 1 ? '' : 's'} · ${indicatorsAlert.length} indicator${indicatorsAlert.length === 1 ? '' : 's'} need attention\nPrepared by ${staffName} · ${dayStamp()}`;
      const NO_IND = {
        id: '',
        name: 'No indicator',
        unit: '',
        v: 0,
        bench: '—',
        benchV: 0,
        dir: 'down',
        trend: [],
        num: '',
        numV: '—',
        den: '',
        denV: '—',
        formula: '',
        capa: [],
        noData: true
      };
      const infoIndRaw = INDS.find(i => i.id === s.infoInd) || INDS[0] || NO_IND;
      const indRaw = INDS.find(i => i.id === s.selInd) || INDS[0] || NO_IND;
      const indRag = indRaw.noData ? 'amber' : ragOf(indRaw),
        indC = indRaw.noData ? '#9aa6b4' : RAG[indRag][0];
      const trendMax = Math.max(1, ...indRaw.trend, indRaw.benchV || 0);
      const lastM = indRaw.trend.length > 1 ? indRaw.trend[indRaw.trend.length - 2] : indRaw.v;
      const deltaV = Math.round((indRaw.v - lastM) * 10) / 10;
      const better = indRaw.dir === 'up' ? deltaV >= 0 : deltaV <= 0;
      const capaAll = [...(indRaw.capa || []), ...(s.capaExtra[indRaw.id] || [])];
      const indBars = indRaw.trend.map((v, i) => ({
        v,
        label: indRaw.trendLabels && indRaw.trendLabels[i] ? String(indRaw.trendLabels[i]).slice(0, 3) : MON3[(M - (indRaw.trend.length - 1 - i) + 12) % 12],
        bar: `width:100%;max-width:26px;height:${Math.max(3, Math.round(v / trendMax * 70))}px;border-radius:4px 4px 0 0;background:${i === indRaw.trend.length - 1 ? indC : indC + '66'}`
      }));
      const capaItems = capaAll.map((c, i) => {
        const key = indRaw.id + ':' + i;
        const done = !!s.capaDone[key];
        return {
          text: c.text,
          owner: c.owner || staffName,
          due: c.due || dateLabel(clamp(TODAY + 7, 1, DIM)),
          done,
          toggle: () => this.setState({
            capaDone: {
              ...s.capaDone,
              [key]: !done
            }
          }),
          box: box(done),
          textStyle: `display:block;font-size:13px;font-weight:600;line-height:1.4;${done ? 'text-decoration:line-through;color:#7d8ea8' : ''}`
        };
      });
      const step = SR_STEPS[clamp(s.srStep, 0, SR_STEPS.length - 1)];
      const srV = k => s.srVals[k] === undefined ? 0 : s.srVals[k];
      const setSr = (k, v) => this.setState({
        srVals: {
          ...s.srVals,
          [k]: Math.max(0, Number(v) || 0)
        }
      });
      const srCounts = (step.fields || []).map(([k, label, hint]) => ({
        label,
        hint: hint || null,
        v: srV(k),
        set: e => setSr(k, e.target.value),
        inc: () => setSr(k, srV(k) + 1),
        dec: () => setSr(k, srV(k) - 1),
        inputStyle
      }));
      const srTotal = step.totalKeys ? step.totalKeys.reduce((a, k) => a + srV(k), 0) : null;
      const srReview = [['Shift', `${s.srShift} · ${shiftOf(s.srShift).name} · ${todayLabel}`], ['Census', `${srV('adm')} admitted · ${srV('dis')} discharged · ${srV('deaths')} death(s) · census ${srV('census')}`], ['Deliveries', `${srV('nvd')} NVD · ${srV('cs')} CS · ${srV('assisted')} assisted · ${srV('nicu')} to NICU`], ['Events', `${srV('falls')} falls · ${srV('mederr')} medication errors · ${srV('needle')} needle-stick · ${srV('code')} code blue`], ['Staffing', `${srV('actual')} of ${srV('planned')} nurses · ${srV('pca')} PCA · ${srV('sick')} sick · ${srV('ot')} h overtime`], ['Notes', [s.srNotes.obs, s.srNotes.issues, s.srNotes.handover].filter(Boolean).join(' · ') || '—']].map(([label, v]) => ({
        label,
        v
      }));
      const srShiftCodes = s.demo ? ['M4', 'E3', 'N2'] : Array.from(new Set([todayCode, ...unitStaff.map(p => p.shift)].filter(isWork))).slice(0, 4);
      if (!srShiftCodes.length) srShiftCodes.push('M4', 'E3', 'N2');
      const dcDept = s.demo ? null : (live.depts || []).find(d => unit && (String(d.id || d._id) === String(unit.id) || norm(d.name) === norm(unit.name))) || null;
      const dcArea = s.demo ? null : unit ? (live.quality || []).find(a => String(a.deptId) === String(unit.id) || norm(a.key) === norm(unit.id) || norm(a.name) === norm(unit.name)) || null : qArea;
      const ITEMS = s.demo ? DC_ITEMS : dcItemsOf(dcDept, dcArea);
      const dcMonth = clamp(s.dcMonth, 0, DC_MONTHS.length - 1);
      const dcM = DC_MONTHS[dcMonth];
      const statFields = ITEMS[0] && ITEMS[0].kind === 'stat' && ITEMS[0].fields ? ITEMS[0].fields : DC_STAT_FIELDS.map((l, i) => ({
        id: 'f' + i,
        label: l
      }));
      const subsOf = mi => Object.assign({}, s.dcSubs[mi] || {}, s.demo ? {} : liveSubsFor(live.subs, DC_MONTHS[mi].key, dcDept && (dcDept.id || dcDept._id), dcArea && dcArea.key, statFields));
      const monthSubs = subsOf(dcMonth);
      const stOf = sub => sub && sub.status || 'missing';
      const dcItemsRaw = ITEMS.map(it => ({
        ...it,
        sub: monthSubs[it.id] || null,
        status: stOf(monthSubs[it.id])
      }));
      const dcSent = dcItemsRaw.filter(it => it.status !== 'missing' && it.status !== 'draft').length;
      const dcTotal = ITEMS.length;
      const openCount = dcItemsRaw.filter(it => it.status === 'missing' || it.status === 'rejected' || it.status === 'draft').length;
      const stChip = k => {
        const st = DC_ST[k] || DC_ST.missing;
        return {
          statusLabel: st[0],
          statusStyle: `display:inline-flex;align-items:center;gap:5px;font-size:10.5px;font-weight:700;padding:3px 8px;border-radius:999px;color:${st[1]};background:${st[2]};white-space:nowrap;flex-shrink:0`,
          statusDot: `width:6px;height:6px;border-radius:50%;background:${st[1]}`
        };
      };
      const valueOf = (it, sub) => {
        if (!sub) return null;
        if (it.kind === 'stat') return sub.vals ? sub.vals[0] : null;
        if (sub.num == null || sub.den == null) return sub.value != null ? sub.value : null;
        const v = sub.den > 0 ? sub.num / sub.den * it.mult : 0;
        return Math.round(v * 100) / 100;
      };
      const fmtV = (it, v) => v == null || v === '' ? null : it.kind === 'stat' ? `${v} ${statFields[0] ? statFields[0].label.toLowerCase() : ''}` : it.unit === '%' ? v + '%' : String(v);
      const withinBench = (it, v) => v == null || it.benchV == null ? true : it.dir === 'up' ? v >= it.benchV : v <= it.benchV;
      const dcFilterMap = {
        All: null,
        Sent: ['sent'],
        Approved: ['approved'],
        Returned: ['rejected'],
        'Not submitted': ['missing', 'draft']
      };
      const dcItems = dcItemsRaw.filter(it => !dcFilterMap[s.dcFilter] || dcFilterMap[s.dcFilter].includes(it.status)).map(it => {
        const v = valueOf(it, it.sub);
        const ok = it.kind === 'stat' || withinBench(it, v);
        return {
          ...it,
          ...stChip(it.status),
          go: () => go('datacolForm', {
            dcSel: it.id,
            dcFormSent: false,
            dcGuideOpen: false,
            dcNote: it.sub && it.sub.note || '',
            dcCorr: '',
            dcMode: 'direct'
          }),
          cardStyle: `display:block;text-align:left;width:100%;box-sizing:border-box;border:1px solid ${it.status === 'rejected' ? 'rgba(214,69,69,.35)' : it.status === 'missing' ? 'rgba(224,138,30,.35)' : 'rgba(255,255,255,.9)'};border-radius:14px;padding:11px 13px;background:rgba(255,255,255,${it.status === 'approved' ? '.55' : '.68'});cursor:pointer;color:#16202e`,
          iconWrap: `display:grid;place-items:center;width:36px;height:36px;border-radius:11px;color:${it.kind === 'stat' ? '#0072a3' : '#6a52d4'};background:${it.kind === 'stat' ? 'rgba(0,144,202,.13)' : 'rgba(106,82,212,.12)'};flex-shrink:0`,
          value: fmtV(it, v),
          valueColor: ok ? '#1d8f57' : '#b32e2e',
          valueMeta: it.kind === 'stat' ? `${statFields.length} fields sent` : `benchmark ${it.bench}`,
          at: it.sub ? it.sub.at : '',
          reason: it.status === 'rejected' && it.sub ? it.sub.reason : null,
          reviewer: it.sub ? it.sub.reviewer : ''
        };
      });
      const dcItem0 = dcItemsRaw.find(it => it.id === s.dcSel) || dcItemsRaw[0] || {
        id: '',
        kind: 'q',
        label: 'No items configured',
        meta: '',
        num: '',
        den: '',
        mult: 1,
        unit: '',
        bench: '—',
        benchV: null,
        dir: 'down',
        sub: null,
        status: 'missing',
        d: IND_D
      };
      const dcSub = dcItem0.sub;
      const dcItem = {
        ...dcItem0,
        ...stChip(dcItem0.status),
        isApproved: dcItem0.status === 'approved',
        isPending: dcItem0.status === 'sent',
        reason: dcItem0.status === 'rejected' && dcSub ? dcSub.reason : null,
        reviewer: dcSub ? dcSub.reviewer : '',
        at: dcSub ? dcSub.at : ''
      };
      const dcReadOnly = dcItem.isPending || !dcItem0.id;
      const dcEditable = !dcReadOnly;
      const vkey = k => dcMonth + ':' + dcItem0.id + ':' + k;
      const dcGet = (k, fallback) => {
        const v = s.dcVals[vkey(k)];
        return v === undefined ? fallback === undefined ? '' : fallback : v;
      };
      const dcSet = k => e => this.setState({
        dcVals: {
          ...s.dcVals,
          [vkey(k)]: e.target.value.replace(/[^\d.]/g, '')
        }
      });
      const dcStatFields = statFields.map((f, i) => ({
        label: f.label,
        v: dcGet('f' + i, dcSub && dcSub.vals && dcSub.vals[i] != null ? dcSub.vals[i] : ''),
        set: dcSet('f' + i),
        style: roStyle(dcReadOnly) + ';width:110px;text-align:right'
      }));
      const GROUPS = ['Nurses', 'Doctors', 'PCA & support', 'Others'];
      const dcGroups = GROUPS.map((label, i) => ({
        label,
        n: dcGet('gn' + i),
        d: dcGet('gd' + i),
        setN: dcSet('gn' + i),
        setD: dcSet('gd' + i),
        style: roStyle(dcReadOnly) + ';padding:8px 6px;text-align:center'
      }));
      const byGroup = dcItem0.grouped && s.dcMode === 'group';
      const pdaysCol = statFields.findIndex(f => COL_RX.pdays.test(f.id) || COL_RX.pdays.test(f.label));
      const pdaysVal = pdaysCol >= 0 && subsOf(dcMonth).stat && subsOf(dcMonth).stat.vals ? subsOf(dcMonth).stat.vals[pdaysCol] : '';
      const dcNum = byGroup ? String(GROUPS.reduce((a, _, i) => a + (Number(dcGet('gn' + i)) || 0), 0)) : dcGet('num', dcSub && dcSub.num != null ? dcSub.num : '');
      const denMap = dcItem0.ind && dcItem0.ind.mDen || {};
      const lockedDen = dcItem0.denLocked ? denMap[dcM.key] != null && denMap[dcM.key] !== '' ? denMap[dcM.key] : Object.keys(denMap).map(k => denMap[k]).filter(v => v != null && v !== '').pop() : null;
      const isCount = dcItem0.kind === 'q' && dcItem0.isRate === false;
      const dcDen = isCount ? '' : dcItem0.denLocked ? lockedDen == null ? '' : String(lockedDen) : byGroup ? String(GROUPS.reduce((a, _, i) => a + (Number(dcGet('gd' + i)) || 0), 0)) : dcGet('den', dcSub && dcSub.den != null ? dcSub.den : /1000/.test(dcItem0.unit || '') && pdaysVal !== '' ? pdaysVal : '');
      const numN = Number(dcNum) || 0,
        denN = Number(dcDen) || 0;
      const resultV = dcItem0.kind !== 'q' ? null : isCount ? String(dcNum).trim() !== '' ? numN : null : denN > 0 ? Math.round(numN / denN * dcItem0.mult * 100) / 100 : null;
      const resultOk = resultV == null ? null : dcItem0.benchV == null ? null : withinBench(dcItem0, resultV);
      const liveHas = (() => {
        const mk = dcM.key,
          has = o => !!(o && o[mk] != null && o[mk] !== '');
        if (dcItem0.kind === 'q') {
          const i = dcItem0.ind;
          return !!i && (has(i.months) || has(i.mNum) || !!(i.mNotObserved && i.mNotObserved[mk]) || !!(i.incidents && Array.isArray(i.incidents[mk]) && i.incidents[mk].length) || !dcItem0.denLocked && has(i.mDen));
        }
        if (dcItem0.kind === 'stat' && dcDept) {
          const idx = (dcDept.months || []).indexOf(mk);
          const row = idx >= 0 ? (dcDept.data || {})[String(idx)] : null;
          return !!row && Object.keys(row).some(k => row[k] != null && row[k] !== '');
        }
        return false;
      })();
      const dcNeedsCorr = !!dcItem0.id && (dcItem.isApproved || liveHas);
      const qReady = isCount ? String(dcNum).trim() !== '' : dcItem0.denLocked || denN > 0 || numN === 0 && String(dcDen).trim() !== '' && Number(dcDen) === 0;
      const dcSubmitOk = !!dcItem0.id && !s.busy.dc && (dcItem0.kind === 'stat' ? dcStatFields.some(f => f.v !== '') : qReady) && (!dcNeedsCorr || !!s.dcCorr.trim());
      const histAll = [];
      DC_MONTHS.forEach((mm, mi) => {
        const subs = subsOf(mi);
        Object.keys(subs).forEach(id => {
          const it = ITEMS.find(x => x.id === id);
          if (!it) return;
          const sub = subs[id];
          histAll.push({
            mi,
            it,
            sub,
            v: valueOf(it, sub)
          });
        });
      });
      histAll.sort((a, b) => b.mi - a.mi || (b.sub.ts || 0) - (a.sub.ts || 0));
      const histFilterMap = {
        All: null,
        Pending: ['sent'],
        Approved: ['approved'],
        Returned: ['rejected']
      };
      const dcHistory = histAll.filter(h => !histFilterMap[s.dcHistFilter] || histFilterMap[s.dcHistFilter].includes(stOf(h.sub))).map(h => ({
        label: h.it.label,
        ...stChip(stOf(h.sub)),
        month: DC_MONTHS[h.mi].label,
        summary: h.it.kind === 'stat' ? `${h.sub.vals && h.sub.vals[0] !== '' ? h.sub.vals[0] : '—'} ${statFields[0] ? statFields[0].label.toLowerCase() : ''} · ${statFields.length} fields` : h.sub.num != null && h.sub.den != null ? `${h.sub.num} ÷ ${h.sub.den} → ${fmtV(h.it, h.v)}` : fmtV(h.it, h.v) || '—',
        at: h.sub.at,
        decision: stOf(h.sub) === 'approved' ? `Approved by ${h.sub.reviewer || 'Quality team'} · counted in the hospital dashboard` : stOf(h.sub) === 'rejected' ? `Returned by ${h.sub.reviewer || 'Quality team'}: ${h.sub.reason || ''}` : null,
        go: () => go('datacolForm', {
          dcMonth: h.mi,
          dcSel: h.it.id,
          dcFormSent: false,
          dcGuideOpen: false,
          dcNote: h.sub.note || '',
          dcCorr: '',
          dcMode: 'direct'
        })
      }));
      const guide = s.demo ? DC_GUIDES[dcItem0.id] : dcItem0.guide;
      const ho = live.handover || {
        items: [],
        deptName: dept
      };
      const handoverAll = ho.items || [];
      const handoverItems = handoverAll.map(h => {
        const done = !!h.done;
        const [c, bg] = PRIO[h.prio] || PRIO.Routine;
        return {
          bed: h.bed,
          patient: h.patient || (h.by ? 'Added by ' + String(h.by.name || '').split(' ')[0] : ''),
          prio: h.prio,
          note: h.note,
          done,
          toggle: () => this.toggleHandover(h),
          doneLabel: done ? 'Received by next shift' : 'Tap when handed over',
          bedStyle: MONO + ';font-size:11px;font-weight:700;padding:3px 7px;border-radius:6px;color:#0072a3;background:rgba(0,144,202,.12)',
          prioStyle: `font-size:9.5px;font-weight:800;letter-spacing:.5px;padding:3px 7px;border-radius:6px;color:${c};background:${bg}`,
          checkStyle: `display:grid;place-items:center;width:26px;height:26px;border-radius:8px;border:1.5px solid ${done ? 'transparent' : 'rgba(125,145,180,.45)'};background:${done ? 'linear-gradient(140deg,#2bb673,#1d8f57)' : 'rgba(255,255,255,.8)'};color:#fff;cursor:pointer`
        };
      });
      const critN = handoverAll.filter(h => h.prio === 'Critical').length,
        pendingH = handoverAll.filter(h => !h.done).length;
      const P = perfOf(live.perf);
      const scoreVal = P.score;
      const competencies = P.comps.map(c => ({
        label: c.label,
        v: c.v,
        bar: `height:100%;width:${c.n / 5 * 100}%;border-radius:999px;background:linear-gradient(90deg,#3ab5a7,#0090ca)`
      }));
      const nq = s.noticeSearch.trim().toLowerCase();
      const noticeList = ALL_NOTICES.filter(n => (s.noticeFilter === 'All' || (s.noticeFilter === 'Unread' ? !n.read : s.noticeFilter === 'Action' ? n.needsAck && !n.acked : s.noticeFilter === 'Saved' ? !!n.saved : n.cat === s.noticeFilter)) && (!nq || (n.title + ' ' + n.body + ' ' + n.from).toLowerCase().includes(nq))).map(n => ({
        ...n,
        catStyle: catStyle(n.cat),
        unread: !n.read,
        hasPoll: !!n.poll,
        hasAttach: !!(n.attachments && n.attachments.length),
        attachCount: n.attachments ? n.attachments.length : 0,
        needsAction: n.needsAck && !n.acked,
        go: () => this.openNotice(n),
        cardStyle: `display:block;text-align:left;width:100%;box-sizing:border-box;border:1px solid ${n.cat === 'Urgent' && !n.acked ? 'rgba(214,69,69,.35)' : 'rgba(255,255,255,.9)'};border-radius:15px;padding:12px 13px;background:rgba(255,255,255,${n.read ? '.6' : '.72'});cursor:pointer;color:#16202e`
      }));
      const poll = noticeRaw.poll;
      const myVote = noticeRaw.myVote;
      const pollVotes = poll ? poll.votes.slice() : [];
      const pollTotal = pollVotes.reduce((a, b) => a + b, 0);
      const pollOpts = poll ? poll.opts.map((label, i) => {
        const pct = pollTotal ? Math.round(pollVotes[i] / pollTotal * 100) : 0;
        return {
          label,
          pct: pct + '%',
          go: () => {
            if (myVote === i) return;
            const votes = pollVotes.slice();
            if (myVote != null) votes[myVote] = Math.max(0, votes[myVote] - 1);
            votes[i]++;
            this.noticeAction(noticeRaw, 'vote', {
              opt: i
            }, {
              myVote: i,
              votes,
              poll: s.demo ? Object.assign({}, poll, {
                votes
              }) : noticeSrc && noticeSrc.poll
            });
          },
          fill: `position:absolute;left:0;top:0;bottom:0;width:${pct}%;background:rgba(106,82,212,${myVote === i ? '.2' : '.1'});border-radius:10px`,
          style: `position:relative;overflow:hidden;display:flex;align-items:center;gap:8px;border:1.5px solid ${myVote === i ? '#6a52d4' : 'rgba(125,145,180,.3)'};border-radius:11px;padding:10px 12px;background:rgba(255,255,255,.8);cursor:pointer;color:#16202e`
        };
      }) : [];
      const ackedN = noticeRaw.ackCount || 0,
        ackTotal = Math.max(noticeRaw.ackTotal || 0, ackedN, 1);
      const ackPendingPeople = (noticeRaw.ackPending || []).slice(0, 3);
      const noticeComments = noticeRaw.comments || [];
      const canRemind = isIncharge || bu.canManage || noticeRaw.mine;
      const myUnits = s.demo ? [{
        id: 'ldr',
        name: 'LDR'
      }] : units;
      const pickedDeptIds = Object.keys(s.cDepts).filter(k => s.cDepts[k]);
      const pickedNames = myUnits.filter(u => pickedDeptIds.indexOf(u.id) >= 0).map(u => u.name);
      const reachOf = aud => s.demo ? aud === 'all' ? 186 : aud === 'incharges' ? 14 : pickedDeptIds.length * 14 : aud === 'all' ? dir.length + 1 : aud === 'incharges' ? dir.filter(a => a.role === 'incharge').length : dir.filter(a => (a.departments || []).some(d => pickedNames.indexOf(d) >= 0)).length + 1;
      const reach = reachOf(s.cAudience);
      const canPublish = !!(s.cTitle.trim() && s.cBody.trim()) && (s.cAudience !== 'dept' || pickedDeptIds.length > 0) && !s.busy.publish;
      const whenLabel = {
        now: 'Publish now',
        tonight: 'Schedule · tonight 8 PM',
        tomorrow: 'Schedule · tomorrow 8 AM'
      }[s.cWhen];
      const myRequests = reqs.mine.map(requestOf);
      const approvals = reqs.team.map(requestOf);
      const mrOk = !!s.mr.name.trim() && !s.busy.medreq;
      const swapPool = (team.length ? team : unitStaff.filter(p => p.name !== staffName).map(p => ({
        ini: ini(p.name),
        name: p.name,
        code: p.shift || '—',
        username: p.username
      }))).slice(0, 6);
      const RE = rosterBuilder(this, s, unit, unitStaff, phonesOn);
      const US = unitStaffView(this, s, unit, phonesOn);
      const navGroup = {
        home: 'home',
        roster: 'roster',
        shift: 'roster',
        requests: 'roster',
        newRequest: 'roster',
        chats: 'chat',
        thread: 'chat',
        meds: 'meds',
        medDetail: 'meds',
        medRequest: 'meds',
        profile: 'me',
        performance: 'me'
      }[s.screen] || null;
      const navItem = (key, screen, label, badge) => ({
        label,
        d: NAV_D[key],
        badge: badge || null,
        go: () => go(screen),
        iconWrap: 'position:relative;display:grid;place-items:center;width:44px;height:30px;border-radius:12px;' + (navGroup === key ? 'background:rgba(0,144,202,.13)' : ''),
        style: `display:flex;flex-direction:column;align-items:center;gap:3px;border:0;background:transparent;padding:4px 0;cursor:pointer;color:${navGroup === key ? '#0072a3' : '#7d8ea8'}`
      });
      const dItem = (screen, label, d, extra) => {
        const x = extra || {};
        const on = s.screen === screen;
        return {
          label,
          d,
          badge: x.badge || null,
          tag: x.tag || null,
          go: () => go(screen, x.go || {}),
          style: `display:flex;align-items:center;gap:11px;width:100%;box-sizing:border-box;border:0;border-radius:10px;padding:10px 12px;font-size:13px;font-weight:600;cursor:pointer;color:${on ? '#fff' : '#c7d2e0'};background:${on ? 'linear-gradient(90deg,rgba(0,144,202,.4),rgba(58,181,167,.18))' : 'transparent'};box-shadow:${on ? 'inset 3px 0 0 #3ab5a7' : 'none'}`
        };
      };
      const ok = screen => this.allowed(screen);
      const appLabel = `${hospital.app || 'UNICO Nurse'} v${hospital.version || '—'}`;
      return {
        sLogin: s.screen === 'login',
        sHome: s.screen === 'home',
        sRoster: s.screen === 'roster',
        sShift: s.screen === 'shift',
        sRequests: s.screen === 'requests',
        sNewRequest: s.screen === 'newRequest',
        sChats: s.screen === 'chats',
        sThread: s.screen === 'thread',
        sMeds: s.screen === 'meds',
        sMedRequest: s.screen === 'medRequest',
        sMedDetail: s.screen === 'medDetail',
        sNotices: s.screen === 'notices',
        sNoticeDetail: s.screen === 'noticeDetail',
        sCompose: s.screen === 'compose',
        sStaff: s.screen === 'staff',
        sStaffDetail: s.screen === 'staffDetail',
        sReports: s.screen === 'reports',
        sIndicator: s.screen === 'indicator',
        sShiftReport: s.screen === 'shiftReport',
        sDatacol: s.screen === 'datacol',
        sDatacolForm: s.screen === 'datacolForm',
        sDatacolHistory: s.screen === 'datacolHistory',
        sHandover: s.screen === 'handover',
        sIncident: s.screen === 'incident',
        sPerformance: s.screen === 'performance',
        sProfile: s.screen === 'profile',
        sRosterEdit: s.screen === 'rosterEdit',
        sUnitStaff: s.screen === 'unitStaff',
        goRosterEdit: () => go('rosterEdit'),
        goUnitStaff: () => go('unitStaff'),
        showNav: s.screen !== 'login' && s.screen !== 'thread',
        drawerOpen: s.drawerOpen,
        openDrawer: () => this.setState({
          drawerOpen: true
        }),
        closeDrawer: () => this.setState({
          drawerOpen: false
        }),
        isIncharge,
        isNurse,
        staffName,
        designation,
        dept,
        empIdShown,
        initials,
        greeting,
        todayLabel,
        todayCode: todayCode || '—',
        todayShiftName: today.name,
        todayTime: today.time,
        nextShiftCode,
        avatarUrl: me.photo && me.photo.url || (isIncharge ? '/assets/nurse-portrait.png' : '/assets/nurse-portrait-male.png'),
        hospitalName: hospital.name || 'Hospital',
        appLabel,
        loginFooter: `${hospital.name || 'UNICO'} · v${hospital.version || '—'}`,
        appFooter: appLabel,
        incRef: s.incRef,
        cycleLabel: P.cycle,
        empId: s.empId,
        setEmpId: e => this.setState({
          empId: e.target.value
        }),
        pin: s.pin,
        setPin: e => this.setState({
          pin: e.target.value
        }),
        doLogin: () => {
          if (!s.loginBusy) this.doLogin();
        },
        signOut: () => this.signOut(),
        goHome: () => go('home'),
        goRoster: () => go('roster'),
        goRequests: () => go('requests', {
          reqSent: false
        }),
        goNewRequest: () => go('newRequest', {
          reqSent: false,
          reqReason: ''
        }),
        goChats: () => go('chats'),
        goMeds: () => go('meds'),
        goMedRequest: () => go('medRequest', {
          mrSent: false
        }),
        goNotices: () => go('notices'),
        goCompose: () => go('compose', {
          composeSent: false
        }),
        goStaff: () => go('staff'),
        goProfile: () => go('profile'),
        goPerformance: () => go('performance'),
        goHandover: () => go('handover'),
        goDatacol: () => go('datacol', {
          dcFormSent: false
        }),
        goDcHistory: () => go('datacolHistory'),
        goReports: () => go('reports'),
        goRepQuality: () => go('reports', {
          repTab: 'quality',
          repSimple: false
        }),
        goRepSubmitted: () => go('reports', {
          repTab: 'submitted',
          repSimple: false,
          srSent: false
        }),
        goShiftReport: () => go('shiftReport', {
          srSent: false,
          srStep: 0
        }),
        goApprovals: () => go('requests', {
          reqTab: 'approvals'
        }),
        navItems: [navItem('home', 'home', 'Home'), ...(ok('roster') ? [navItem('roster', 'roster', 'Roster')] : []), ...(ok('chats') ? [navItem('chat', 'chats', 'Chat', chatUnreadTotal || null)] : []), ...(ok('meds') ? [navItem('meds', 'meds', 'Meds')] : []), navItem('me', 'profile', 'Me')],
        drawerGroups: [{
          sec: 'Today',
          items: [dItem('home', 'Home', NAV_D.home), ...(ok('roster') ? [dItem('roster', 'My roster', NAV_D.roster)] : []), ...(ok('requests') ? [dItem('requests', 'Swap & leave requests', NAV_D.swap, {
            badge: isIncharge && pendingCount ? pendingCount : null
          })] : []), ...(ok('handover') ? [dItem('handover', 'Shift handover', NAV_D.handover, {
            badge: pendingH || null
          })] : [])]
        }, {
          sec: 'Ward',
          items: [...(ok('chats') ? [dItem('chats', 'Chat', NAV_D.chat, {
            badge: chatUnreadTotal || null
          })] : []), ...(ok('notices') ? [dItem('notices', 'Notices', NAV_D.bell, {
            badge: unread.length || null
          })] : []), ...(ok('staff') ? [dItem('staff', 'Staff directory', NAV_D.staff)] : []), ...(ok('meds') ? [dItem('meds', 'Medicine info', NAV_D.meds)] : []), ...(ok('incident') ? [dItem('incident', 'Report an incident', NAV_D.incident, {
            go: {
              incSent: false
            }
          })] : [])]
        }, {
          sec: isIncharge ? 'In-charge' : 'Me',
          items: [...(ok('reports') ? [dItem('reports', 'Reports & statistics', NAV_D.reports, {
            tag: 'LIVE'
          })] : []), ...(ok('rosterEdit') ? [dItem('rosterEdit', 'Make the unit roster', NAV_D.roster, {
            badge: s.reDirty ? '•' : null
          })] : []), ...(ok('unitStaff') ? [dItem('unitStaff', 'My unit staff', NAV_D.staff)] : []), ...(ok('shiftReport') ? [dItem('shiftReport', 'Submit shift report', NAV_D.report, {
            go: {
              srSent: false,
              srStep: 0
            }
          })] : []), ...(ok('compose') ? [dItem('compose', 'Post an announcement', NAV_D.compose, {
            go: {
              composeSent: false
            }
          })] : []), ...(ok('datacol') ? [dItem('datacol', 'Data collection', NAV_D.datacol, {
            badge: openCount || null,
            go: {
              dcFormSent: false
            }
          })] : []), ...(ok('datacolHistory') ? [dItem('datacolHistory', 'My submissions', NAV_D.history)] : []), ...(ok('performance') ? [dItem('performance', 'My performance', NAV_D.perf)] : []), dItem('profile', 'Profile & settings', NAV_D.me)]
        }].filter(g => g.items.length),
        hasUnread: unread.length > 0,
        unitChip,
        pickUnit,
        hasCharge: !!unit,
        chargeNurse: isRealIncharge ? staffName.split(' ')[0] : unit && unit.incharge ? unit.incharge.split(' ').slice(0, 2).join(' ') : ((unitStaff.find(p => p.admin) || {}).name || 'not set').split(' ').slice(0, 2).join(' '),
        toggleClock: () => {
          this.setState({
            clockedIn: !s.clockedIn
          });
          this.toastMsg(s.clockedIn ? 'Clocked out · ' + timeNow() : 'Clocked in · ' + timeNow());
        },
        clockLabel: s.clockedIn ? 'Clock out' : 'Clock in',
        clockBtnStyle: `border:0;border-radius:999px;padding:7px 13px;font-size:12px;font-weight:700;cursor:pointer;${s.clockedIn ? 'background:rgba(255,255,255,.18);color:#fff;border:1px solid rgba(255,255,255,.35)' : 'background:#fff;color:#0a5f87'}`,
        pendingCount,
        homeReportLine: R.live && !live.report ? 'Loading the unit report…' : `${last(R.adm)} admissions · ${last(R.nvd) + last(R.cs)} deliveries · ${indicatorsAlert.length} indicators to watch${R.live ? ' · ' + (R.labels[nL - 1] || '') : ''}`,
        homeSpark: spark(R.adm, '#0090ca'),
        quickActions: [...(ok('roster') ? [{
          label: 'Roster',
          color: '#0072a3',
          bg: 'rgba(0,144,202,.13)',
          d: NAV_D.roster,
          go: () => go('roster')
        }] : []), ...(ok('requests') ? [{
          label: 'Requests',
          color: '#6a52d4',
          bg: 'rgba(106,82,212,.13)',
          d: NAV_D.swap,
          badge: isIncharge && pendingCount ? pendingCount : null,
          go: () => go('requests')
        }] : []), ...(ok('chats') ? [{
          label: 'Chat',
          color: '#1e8a7c',
          bg: 'rgba(58,181,167,.16)',
          d: NAV_D.chat,
          badge: chatUnreadTotal || null,
          go: () => go('chats')
        }] : []), ...(ok('notices') ? [{
          label: 'Notices',
          color: '#b8650a',
          bg: 'rgba(224,138,30,.15)',
          d: NAV_D.bell,
          badge: unread.length || null,
          go: () => go('notices')
        }] : []), ...(ok('meds') ? [{
          label: 'Medicines',
          color: '#b32e2e',
          bg: 'rgba(214,69,69,.12)',
          d: NAV_D.meds,
          go: () => go('meds')
        }] : []), ...(ok('staff') ? [{
          label: 'Staff',
          color: '#0072a3',
          bg: 'rgba(0,144,202,.13)',
          d: NAV_D.staff,
          go: () => go('staff')
        }] : []), ...(ok('incident') ? [{
          label: 'Incident',
          color: '#d23a52',
          bg: 'rgba(210,58,82,.12)',
          d: NAV_D.incident,
          go: () => go('incident', {
            incSent: false
          })
        }] : []), ...(ok('shiftReport') ? [{
          label: 'Shift report',
          color: '#3c4858',
          bg: 'rgba(125,145,180,.16)',
          d: NAV_D.report,
          go: () => go('shiftReport', {
            srSent: false,
            srStep: 0
          })
        }] : ok('handover') ? [{
          label: 'Handover',
          color: '#3c4858',
          bg: 'rgba(125,145,180,.16)',
          d: NAV_D.handover,
          go: () => go('handover')
        }] : ok('performance') ? [{
          label: 'Performance',
          color: '#3c4858',
          bg: 'rgba(125,145,180,.16)',
          d: NAV_D.perf,
          go: () => go('performance')
        }] : [])].slice(0, 8),
        upcoming,
        homeNotices: ALL_NOTICES.slice(0, 2).map(n => ({
          ...n,
          catStyle: catStyle(n.cat),
          unread: !n.read,
          go: () => this.openNotice(n)
        })),
        dcMonthLabel: dcM.label,
        dcHomeLine: !dcTotal ? 'No sheet or indicators assigned to your unit' : openCount ? `${openCount} item${openCount === 1 ? '' : 's'} still to send · due ${DC_DUE_DAY} ${MON3[M]}` : 'Everything sent — awaiting review',
        dcHomeBorder: openCount ? 'rgba(224,138,30,.35)' : 'rgba(255,255,255,.9)',
        dcHomeBadge: MONO + `;font-size:11px;font-weight:700;padding:3px 8px;border-radius:999px;color:${openCount ? '#b8650a' : '#1d8f57'};background:${openCount ? 'rgba(224,138,30,.15)' : 'rgba(43,182,115,.14)'}`,
        dcOpenCount: openCount ? openCount + ' open' : 'Done',
        handoverSummary: `${handoverAll.length} patient${handoverAll.length === 1 ? '' : 's'}`,
        handoverSub: `${critN} critical · ${pendingH} still to hand over${nextShiftCode && nextShiftCode !== '—' ? ' · next shift ' + nextShiftCode : ''}`,
        monthLabel: monthLabel + ' · ' + rosterNote,
        rosterStats: [{
          n: shiftsN,
          label: 'Shifts'
        }, {
          n: hours + 'h',
          label: 'Hours'
        }, {
          n: nights,
          label: 'Nights'
        }, {
          n: offN,
          label: 'Off'
        }],
        dows: DOWS,
        calCells,
        legend: [['M4', 'Morning'], ['E3', 'Evening'], ['N2', 'Night'], ['O', 'Off / leave']].map(([c, label]) => ({
          label,
          dot: `width:10px;height:10px;border-radius:3px;background:${shiftOf(c).color}`
        })),
        selCode: selCode || '—',
        selCodeStyle: MONO + `;font-size:20px;font-weight:700;padding:8px 12px;border-radius:12px;color:${selSh.color};background:${selSh.bg}`,
        selDateLabel: dateLabel(sel),
        selShiftName: selSh.name,
        selTime: selSh.time || '—',
        selHours: selSh.hours || '—',
        selIsWork: isWork(selCode),
        selIsOff: !isWork(selCode),
        team,
        reqTabs: [['mine', 'My requests', null], ['approvals', 'Team approvals', pendingCount || null]].filter(t => isIncharge || t[0] === 'mine').map(([k, label, badge]) => ({
          label,
          badge,
          go: () => this.setState({
            reqTab: k
          }),
          style: pillBtn(s.reqTab === k)
        })),
        reqMine: s.reqTab === 'mine' || !isIncharge,
        reqApprovals: isIncharge && s.reqTab === 'approvals',
        myRequests: myRequests.map(r => ({
          ...r,
          typeStyle: typeStyle(r.type),
          statusStyle: statusStyle(r.status)
        })),
        approvals: approvals.map(a => ({
          ...a,
          ini: ini(a.name),
          typeStyle: typeStyle(a.type),
          statusStyle: statusStyle(a.status),
          pending: a.status === 'Pending',
          decided: a.status !== 'Pending',
          approve: () => this.decideRequest(a, 'approved'),
          reject: () => this.decideRequest(a, 'declined')
        })),
        reqSent: s.reqSent,
        reqNotSent: !s.reqSent,
        reqTypeOpts: ['Swap', 'Leave'].map(t => ({
          label: t === 'Swap' ? 'Shift swap' : 'Leave',
          go: () => this.setState({
            reqType: t
          }),
          style: pillBtn(s.reqType === t)
        })),
        reqIsSwap: s.reqType === 'Swap',
        reqIsLeave: s.reqType === 'Leave',
        reqDateLabel: s.reqType === 'Swap' ? 'Shift to swap' : 'Leave date',
        swapCandidates: swapPool.map((t, i) => ({
          ini: t.ini,
          name: t.name,
          code: t.code,
          go: () => this.setState({
            swapWith: i
          }),
          style: `display:flex;align-items:center;gap:10px;border:1.5px solid ${s.swapWith === i ? '#0090ca' : 'rgba(125,145,180,.3)'};border-radius:11px;padding:8px 10px;background:${s.swapWith === i ? 'rgba(0,144,202,.08)' : 'rgba(255,255,255,.7)'};cursor:pointer;color:#16202e`
        })),
        leaveTypes: ['Casual', 'Sick', 'Annual', 'Study'].map(l => ({
          label: l,
          go: () => this.setState({
            leaveType: l
          }),
          style: chip(s.leaveType === l)
        })),
        reqReason: s.reqReason,
        setReqReason: e => this.setState({
          reqReason: e.target.value
        }),
        submitRequest: () => {
          const partner = swapPool[s.swapWith] || swapPool[0] || null;
          if (s.reqType === 'Swap' && !partner) return this.toastMsg('No colleague to swap with on that day.');
          this.submitRequest(s.reqType === 'Swap' ? {
            type: 'swap',
            date: isoDay(sel),
            code: selCode || '',
            withUsername: partner.username || '',
            withName: partner.name,
            reason: s.reqReason
          } : {
            type: 'leave',
            date: isoDay(sel),
            leaveType: s.leaveType,
            reason: s.reqReason
          });
        },
        chatUnreadTotal,
        onlineCount: onlineN,
        chatSearch: s.chatSearch,
        setChatSearch: e => this.setState({
          chatSearch: e.target.value
        }),
        chatTabs: [['dept', 'Department', ALL_CHATS.filter(c => c.scope !== 'hosp').reduce((a, c) => a + (c.muted ? 0 : c.unread), 0)], ...(F.chatHosp !== false ? [['hosp', 'Hospital-wide', ALL_CHATS.filter(c => c.scope === 'hosp').reduce((a, c) => a + (c.muted ? 0 : c.unread), 0)]] : [])].map(([k, label, badge]) => ({
          label,
          badge: badge || null,
          go: () => this.setState({
            chatTab: k
          }),
          style: pillBtn(s.chatTab === k)
        })),
        chatIsDept: s.chatTab === 'dept' && !cq,
        chatIsHosp: s.chatTab === 'hosp' && !cq,
        deptChips: roomDepts.length > 1 ? ['All', ...roomDepts].map(d => ({
          label: d,
          go: () => this.setState({
            chatDept: d
          }),
          style: chip(s.chatDept === d)
        })) : [],
        chatList: chatsVisible.length ? chatsVisible.map(c => ({
          ...avOf(c),
          name: c.name,
          members: c.group ? String(c.members) : null,
          muted: c.muted,
          urgent: !!(c.last && c.last.urgent),
          last: c.last ? (c.last.mine ? 'You: ' : c.group ? String(c.last.from || '').split(' ')[0] + ': ' : '') + (c.last.text || '') : 'No messages yet',
          when: c.when,
          unread: c.unread || null,
          online: c.online,
          go: () => openChat(c.id)
        })) : [],
        newGroupOpen: s.newGroupOpen,
        openNewGroup: () => this.setState({
          newGroupOpen: true,
          ngName: '',
          ngPicked: {}
        }),
        closeNewGroup: () => this.setState({
          newGroupOpen: false
        }),
        ngName: s.ngName,
        setNgName: e => this.setState({
          ngName: e.target.value
        }),
        ngScopeOpts: [['dept', 'My department'], ...(bu.canManage ? [['hosp', 'Hospital-wide']] : [])].map(([k, label]) => ({
          label,
          go: () => this.setState({
            ngScope: k
          }),
          style: pillBtn(s.ngScope === k)
        })),
        ngMembers: (s.demo ? STAFF.filter(p => p.name !== staffName).slice(0, 6).map(p => ({
          username: norm(p.name),
          name: p.name,
          roleLabel: p.title
        })) : dir.slice(0, 40)).map(a => ({
          ini: ini(a.name),
          name: a.name,
          role: a.roleLabel || a.role,
          on: !!s.ngPicked[a.username],
          go: () => this.setState({
            ngPicked: {
              ...s.ngPicked,
              [a.username]: !s.ngPicked[a.username]
            }
          }),
          box: box(!!s.ngPicked[a.username]),
          style: 'display:flex;align-items:center;gap:10px;border:0;background:transparent;padding:6px 2px;cursor:pointer;color:#16202e;width:100%;box-sizing:border-box'
        })),
        ngCount: Object.values(s.ngPicked).filter(Boolean).length + 1,
        createGroup: () => {
          const name = s.ngName.trim();
          if (!name) return this.toastMsg('Give the room a name.');
          this.createGroup(name, s.ngScope, Object.keys(s.ngPicked).filter(k => s.ngPicked[k]));
        },
        thread: {
          ...avOf(threadRaw),
          name: threadRaw.name,
          sub: (threadRaw.sub || '') + (isMuted ? ' · muted' : '') + (threadRaw.readOnly ? ' · read-only' : ''),
          tel: threadRaw.group || !threadPerson ? null : tel(threadPerson.phone),
          pinnedText: pinnedMsg ? pinnedMsg.text : null,
          group: !!threadRaw.group,
          memberCount: roomMembers.length || threadRaw.members || 0
        },
        unpin: () => this.pinMsg(threadRaw.id, null),
        messages,
        typing: th && th.typing && !msgs.some(m => m.mine && Date.now() - m.ts < 60000) ? th.typing : null,
        replyingTo,
        cancelReply: () => this.setState({
          replyTo: null
        }),
        quickReplies: ['On it', 'Noted, thanks', 'Coming now', 'Call me'].map(t => ({
          label: t,
          go: () => sendMsg(t)
        })),
        toggleAttach: () => this.setState({
          attachOpen: !s.attachOpen
        }),
        attachOpen: s.attachOpen,
        attachBtnStyle: iconBtn(!!s.pendingAttach, '#0072a3') + ';width:36px;height:36px;border-radius:10px;flex-shrink:0',
        attachOpts: ATTACH.map(([label, color, bg, d, type]) => ({
          label,
          color,
          bg,
          d,
          go: () => this.setState({
            attachOpen: false,
            pendingAttach: {
              name: label + (type === 'photo' ? '.jpg' : '.pdf'),
              type
            }
          })
        })),
        toggleUrgent: () => this.setState({
          urgent: !s.urgent
        }),
        urgentBtnStyle: iconBtn(s.urgent, '#d23a52') + ';width:36px;height:36px;border-radius:10px;flex-shrink:0',
        draft: s.draft,
        setDraft: e => this.setState({
          draft: e.target.value
        }),
        draftKey: e => {
          if (e.key === 'Enter') sendMsg();
        },
        draftPlaceholder: threadRaw.readOnly && !bu.canManage ? 'This room is read-only' : s.pendingAttach ? `Attach ${s.pendingAttach.name} · add a note` : s.urgent ? 'Urgent message…' : 'Message',
        sendMsg: () => sendMsg(),
        sendBtnStyle: `width:40px;height:40px;border-radius:12px;border:0;display:grid;place-items:center;cursor:pointer;flex-shrink:0;${(s.draft.trim() || s.pendingAttach) && !s.busy.send ? BLUE_BTN : 'background:rgba(125,145,180,.2);color:#7d8ea8'}`,
        roomInfoOpen: s.roomInfoOpen,
        openRoomInfo: () => this.setState({
          roomInfoOpen: true
        }),
        closeRoomInfo: () => this.setState({
          roomInfoOpen: false
        }),
        roomActions: [{
          label: isMuted ? 'Unmute' : 'Mute',
          d: 'M13.7 21a2 2 0 01-3.4 0M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9',
          go: () => this.muteRoom(threadRaw.id, !isMuted)
        }, {
          label: 'Search',
          d: 'M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-4.3-4.3',
          go: () => this.setState({
            roomInfoOpen: false,
            screen: 'chats',
            chatSearch: threadRaw.name
          })
        }, {
          label: threadRaw.group ? 'Leave room' : 'Call',
          d: threadRaw.group ? 'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9' : 'M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1.9.4 1.8.7 2.6a2 2 0 01-.5 2.1L8 9.7a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.4c.8.3 1.7.5 2.6.7a2 2 0 011.7 2z',
          go: () => {
            if (threadRaw.group) this.leaveRoom(threadRaw);else if (threadPerson && threadPerson.phone) window.location.href = tel(threadPerson.phone);else this.toastMsg(phonesOn ? 'No phone number on record.' : 'Phone numbers are hidden for your role.');
          }
        }].map(a => ({
          ...a,
          style: 'display:flex;flex-direction:column;align-items:center;gap:6px;border:1px solid rgba(125,145,180,.2);border-radius:13px;padding:11px 4px;background:rgba(255,255,255,.9);cursor:pointer;color:#0072a3'
        })),
        roomMembers,
        medCount: medList.length,
        medTotal: medPool.length,
        medsLoading: s.meds === null,
        toggleAlertOnly: () => this.setState({
          alertOnly: !s.alertOnly
        }),
        alertChipStyle: chip(s.alertOnly).replace('rgba(0,144,202,.5)', 'rgba(214,69,69,.5)').replace('rgba(0,144,202,.12);color:#0072a3', 'rgba(214,69,69,.12);color:#b32e2e'),
        medQuery: s.medQuery,
        setMedQuery: e => {
          const v = e.target.value;
          this.setState({
            medQuery: v
          });
          this.searchMeds(v);
        },
        medClasses: classes.map(c => ({
          label: c,
          go: () => this.setState({
            medClass: c
          }),
          style: chip(s.medClass === c)
        })),
        medReqCta: ok('medRequest') ? 'Can’t find a medicine? Request it' : 'Can’t find a medicine? Ask your in-charge',
        medReqSub: ok('medRequest') ? 'Pharmacy answers requests in the app' : 'Medicine requests are not enabled for your role',
        medReqBadge: medReqs.filter(r => r.status !== 'Approved' && r.status !== 'Declined').length ? medReqs.filter(r => r.status !== 'Approved' && r.status !== 'Declined').length + ' in review' : null,
        medList,
        mr: s.mr,
        mrSent: s.mrSent,
        mrNotSent: !s.mrSent,
        mrAnother: () => this.setState({
          mrSent: false,
          mr: {
            name: '',
            strength: '',
            mfr: '',
            form: 'Injection',
            reason: 'Used on ward, missing',
            note: '',
            urgent: false,
            highAlert: false
          }
        }),
        mrSetName: e => this.setState({
          mr: {
            ...s.mr,
            name: e.target.value
          }
        }),
        mrSetStrength: e => this.setState({
          mr: {
            ...s.mr,
            strength: e.target.value
          }
        }),
        mrSetMfr: e => this.setState({
          mr: {
            ...s.mr,
            mfr: e.target.value
          }
        }),
        mrSetNote: e => this.setState({
          mr: {
            ...s.mr,
            note: e.target.value
          }
        }),
        mrForms: ['Tablet', 'Capsule', 'Injection', 'Syrup', 'Other'].map(f => ({
          label: f,
          go: () => this.setState({
            mr: {
              ...s.mr,
              form: f
            }
          }),
          style: chip(s.mr.form === f)
        })),
        mrReasons: ['Used on ward, missing', 'New protocol', 'Doctor requested', 'Replaces a discontinued brand'].map(r => ({
          label: r,
          go: () => this.setState({
            mr: {
              ...s.mr,
              reason: r
            }
          }),
          style: chip(s.mr.reason === r)
        })),
        mrToggleUrgent: () => this.setState({
          mr: {
            ...s.mr,
            urgent: !s.mr.urgent
          }
        }),
        mrUrgentBox: box(s.mr.urgent),
        mrToggleHighAlert: () => this.setState({
          mr: {
            ...s.mr,
            highAlert: !s.mr.highAlert
          }
        }),
        mrHighAlertBox: box(s.mr.highAlert),
        mrSubmit: () => {
          if (!mrOk) return;
          this.submitMedRequest({
            name: s.mr.name.trim(),
            strength: s.mr.strength,
            mfr: s.mr.mfr,
            form: s.mr.form,
            reason: s.mr.reason,
            note: s.mr.note,
            urgent: s.mr.urgent,
            highAlert: s.mr.highAlert
          });
        },
        mrSubmitStyle: `border:0;border-radius:13px;padding:14px;font-size:14px;font-weight:700;cursor:pointer;${BLUE_BTN};opacity:${mrOk ? 1 : .5}`,
        myMedRequests: medReqs.map(r => ({
          name: r.name + (r.strength ? ' ' + r.strength : ''),
          meta: `${r.form || 'Other'} · sent ${fmtTs(r.createdAt)}`,
          status: r.status,
          approved: r.status === 'Approved',
          reply: r.reply || (r.decidedBy ? `${r.status} by ${r.decidedBy.name}` : null),
          openId: r.openId,
          statusStyle: statusStyle(r.status === 'Approved' ? 'Approved' : r.status === 'Declined' ? 'Declined' : 'Pending'),
          open: () => {
            const m = medPool.find(x => x.id === r.openId);
            if (m) this.openMed(m);else if (r.openId) tryApi('/api/med/brand/' + encodeURIComponent(r.openId)).then(x => {
              if (x && x.ok && x.brand) this.openMed(liveMed(x.brand));
            });
          }
        })),
        mrCount: medReqs.length + ' total',
        med,
        medTabs: [['overview', 'Overview'], ['dosage', 'Dosage'], ['safety', 'Safety'], ['more', 'More']].map(([k, l]) => ({
          label: l,
          go: () => this.setState({
            medTab: k
          }),
          style: pillBtn(s.medTab === k).replace('padding:7px 12px', 'padding:8px 4px')
        })),
        medSections,
        medTabMore: s.medTab === 'more',
        medFacts: [['Manufacturer', med.mfr || '—'], ['Unit price', med.price || '—'], ['Category', med.cat || '—'], ['Dosage form', med.route || '—'], ['Max daily (বাংলা)', med.facts && med.facts.maxBn || med.maxDose]].map(([label, v]) => ({
          label,
          v
        })),
        toggleFav: () => this.saveFavs(isFav ? s.favs.filter(x => x !== med.id) : [...s.favs, med.id]),
        favStyle: iconBtn(isFav, '#e08a1e'),
        favFill: isFav ? '#e08a1e' : 'none',
        shareMed: () => {
          const text = `${med.brand} ${med.strength} (${med.generic}) — ${med.nursing}`;
          if (navigator.share) navigator.share({
            title: med.brand,
            text
          }).catch(() => {});else {
            this.setState({
              screen: 'chats',
              draft: text
            });
          }
        },
        unreadCount: unread.length,
        needsActionCount: needsAction.length,
        markAllRead: () => this.markAllRead(),
        noticeSearch: s.noticeSearch,
        setNoticeSearch: e => this.setState({
          noticeSearch: e.target.value
        }),
        noticeFilters: ['All', 'Unread', 'Action', 'Saved', 'Urgent', 'Policy', 'Training', 'Roster'].map(f => ({
          label: f === 'Action' ? 'Needs action' : f,
          go: () => this.setState({
            noticeFilter: f
          }),
          style: chip(s.noticeFilter === f)
        })),
        noticeList,
        notice: {
          ...noticeRaw,
          catStyle: catStyle(noticeRaw.cat),
          ini: ini(noticeRaw.from || '?'),
          hasAttach: !!(noticeRaw.attachments && noticeRaw.attachments.length),
          attachments: noticeRaw.attachments || [],
          hasPoll: !!poll,
          pollQ: poll ? poll.q : '',
          acked: !!noticeRaw.acked,
          notAcked: !noticeRaw.acked,
          full: noticeRaw.full || noticeRaw.body,
          canRemind
        },
        toggleSaveNotice: () => this.noticeAction(noticeRaw, 'save', {}, {
          saved: !noticeRaw.saved
        }),
        saveBtnStyle: iconBtn(!!noticeRaw.saved, '#0072a3') + ';width:36px;height:36px;border-radius:10px',
        saveFill: noticeRaw.saved ? '#0072a3' : 'none',
        shareNotice: () => {
          const text = noticeRaw.title + ' — ' + noticeRaw.body;
          if (navigator.share) navigator.share({
            title: noticeRaw.title,
            text
          }).catch(() => {});else this.setState({
            screen: 'chats',
            draft: text
          });
        },
        pollOpts,
        pollMeta: `${pollTotal} vote${pollTotal === 1 ? '' : 's'}${myVote != null ? ' · you voted' : ' · tap to vote'}`,
        ackStat: `${ackedN} / ${ackTotal}`,
        ackBar: `height:100%;width:${Math.round(ackedN / ackTotal * 100)}%;border-radius:999px;background:linear-gradient(90deg,#3ab5a7,#0090ca)`,
        ackPending: ackPendingPeople.map(n => ini(n)),
        ackPendingLabel: `${Math.max(0, ackTotal - ackedN)} have not acknowledged yet`,
        remindUnread: () => {
          if (!canRemind) return this.toastMsg('Only the author or a manager can send reminders.');
          this.setState({
            reminded: {
              ...s.reminded,
              [noticeRaw.id]: true
            }
          });
          if (!s.demo) this.act('remind', () => api('/api/phone/notices/' + encodeURIComponent(noticeRaw.id) + '/remind', {
            method: 'POST'
          }));
        },
        remindLabel: s.reminded[noticeRaw.id] ? 'Reminder sent' : 'Remind',
        remindStyle: `border:1px solid rgba(0,144,202,.3);border-radius:9px;padding:6px 10px;font-size:11.5px;font-weight:700;cursor:pointer;${s.reminded[noticeRaw.id] ? 'background:rgba(43,182,115,.14);color:#1d8f57;border-color:rgba(43,182,115,.35)' : 'background:rgba(0,144,202,.08);color:#0072a3'}`,
        ackNotice: () => this.noticeAction(noticeRaw, 'ack', {}, {
          acked: true,
          ackCount: (noticeRaw.ackCount || 0) + 1
        }),
        comments: noticeComments.map(c => ({
          ...c,
          ini: ini(c.from || '?')
        })),
        commentCount: noticeComments.length,
        commentDraft: s.commentDraft,
        setCommentDraft: e => this.setState({
          commentDraft: e.target.value
        }),
        sendComment: () => this.sendComment(noticeRaw, s.commentDraft),
        commentKey: e => {
          if (e.key === 'Enter') this.sendComment(noticeRaw, s.commentDraft);
        },
        composeSent: s.composeSent,
        composeNotSent: !s.composeSent,
        composeDoneTitle: s.cWhen === 'now' ? 'Announcement published' : 'Announcement scheduled',
        composeDoneSub: `${reach} staff will ${s.cWhen === 'now' ? 'see it now' : 'see it ' + whenLabel.replace('Schedule · ', '')}${s.cAck ? ' · acknowledgement required' : ''}`,
        cTitle: s.cTitle,
        setCTitle: e => this.setState({
          cTitle: e.target.value
        }),
        cBody: s.cBody,
        setCBody: e => this.setState({
          cBody: e.target.value
        }),
        toggleCAttach: () => this.setState({
          cAttach: !s.cAttach
        }),
        cAttachStyle: chip(s.cAttach) + ';display:inline-flex;align-items:center;gap:5px',
        cAttachLabel: s.cAttach ? 'Attachment noted' : 'Attach file',
        toggleCPoll: () => this.setState({
          cPoll: !s.cPoll
        }),
        cPollStyle: chip(s.cPoll).replace(/0,144,202/g, '106,82,212').replace('#0072a3', '#6a52d4') + ';display:inline-flex;align-items:center;gap:5px',
        cPollLabel: s.cPoll ? 'Remove poll' : 'Add poll',
        cPoll: s.cPoll,
        cPollQ: s.cPollQ,
        setCPollQ: e => this.setState({
          cPollQ: e.target.value
        }),
        cPollOpts: s.cPollOpts.map((v, i) => ({
          v,
          ph: 'Option ' + (i + 1),
          set: e => this.setState({
            cPollOpts: s.cPollOpts.map((x, j) => j === i ? e.target.value : x)
          })
        })),
        cCats: Object.keys(CATS).map(c => ({
          label: c,
          go: () => this.setState({
            cCat: c
          }),
          style: chip(s.cCat === c)
        })),
        cAudiences: [['dept', 'My department(s)', 'Everyone with an app account in the selected units', reachOf('dept')], ...(bu.canManage || s.demo ? [['incharges', 'All in-charges', 'One per unit · for roster and policy', reachOf('incharges')], ['all', 'All nursing staff', 'Hospital-wide · use sparingly', reachOf('all')]] : [])].map(([k, label, sub, count]) => ({
          label,
          sub,
          count,
          go: () => this.setState({
            cAudience: k
          }),
          radio: `width:18px;height:18px;border-radius:50%;border:2px solid ${s.cAudience === k ? '#0090ca' : 'rgba(125,145,180,.5)'};background:${s.cAudience === k ? 'radial-gradient(circle,#0090ca 45%,#fff 50%)' : '#fff'};flex-shrink:0`,
          style: `display:flex;align-items:center;gap:10px;border:1.5px solid ${s.cAudience === k ? '#0090ca' : 'rgba(125,145,180,.3)'};border-radius:12px;padding:10px 12px;background:${s.cAudience === k ? 'rgba(0,144,202,.08)' : 'rgba(255,255,255,.7)'};cursor:pointer;color:#16202e`
        })),
        cAudienceDepts: s.cAudience === 'dept',
        cDeptChips: myUnits.map(u => ({
          label: u.short || u.name,
          go: () => this.setState({
            cDepts: {
              ...s.cDepts,
              [u.id]: !s.cDepts[u.id]
            }
          }),
          style: chip(!!s.cDepts[u.id])
        })),
        cOptions: [['cAck', 'Require acknowledgement', 'Staff must tap "I have read this"'], ['cPin', 'Pin to top', 'Stays first until you unpin it'], ['cComments', 'Allow questions', 'Staff can comment under the notice']].map(([k, label, sub]) => ({
          label,
          sub,
          go: () => this.setState({
            [k]: !s[k]
          }),
          ...track(!!s[k])
        })),
        cWhenOpts: [['now', 'Now'], ['tonight', 'Tonight 8 PM'], ['tomorrow', 'Tomorrow 8 AM']].map(([k, label]) => ({
          label,
          go: () => this.setState({
            cWhen: k
          }),
          style: pillBtn(s.cWhen === k)
        })),
        publishLabel: `${whenLabel} · ${reach} staff`,
        publishStyle: `border:0;border-radius:13px;padding:14px;font-size:14px;font-weight:700;cursor:pointer;${BLUE_BTN};opacity:${canPublish ? 1 : .5}`,
        publishNotice: () => {
          if (!canPublish) return;
          this.publishNotice({
            title: s.cTitle.trim(),
            body: s.cBody.trim(),
            cat: s.cCat,
            audience: s.cAudience === 'dept' ? 'depts' : s.cAudience,
            depts: pickedDeptIds,
            needsAck: s.cAck,
            pinned: s.cPin,
            allowComments: s.cComments,
            when: s.cWhen,
            poll: s.cPoll && s.cPollQ.trim() ? {
              q: s.cPollQ.trim(),
              opts: s.cPollOpts.filter(x => x.trim())
            } : null,
            attachments: []
          });
        },
        staffCount: STAFF.length,
        staffOnline: onlineN,
        toggleStaffOnline: () => this.setState({
          staffOnlineOnly: !s.staffOnlineOnly
        }),
        staffOnlineStyle: chip(s.staffOnlineOnly).replace(/0,144,202/g, '43,182,115').replace('#0072a3', '#1d8f57') + ';display:inline-flex;align-items:center;gap:6px',
        dirTabs: [['staff', 'Staff'], ...(phonebook.length || !sq ? [['phonebook', 'Phonebook']] : [])].map(([k, label]) => ({
          label,
          go: () => this.setState({
            dirTab: k
          }),
          style: pillBtn(s.dirTab === k)
        })),
        dirIsStaff: s.dirTab === 'staff',
        dirIsPhonebook: s.dirTab === 'phonebook',
        dirSearchPh: s.dirTab === 'staff' ? 'Name, role, unit, extension' : 'Department or service',
        staffSearch: s.staffSearch,
        setStaffSearch: e => this.setState({
          staffSearch: e.target.value
        }),
        phonebook,
        staffDeptChips: deptList.slice(0, 24).map(d => ({
          label: d,
          go: () => this.setState({
            staffDept: d
          }),
          style: chip(s.staffDept === d)
        })),
        staffSortOpts: [['active', 'Active'], ['name', 'Name']].map(([k, label]) => ({
          label,
          go: () => this.setState({
            staffSort: k
          }),
          style: pillBtn(s.staffSort === k).replace('padding:7px 12px', 'padding:5px 10px').replace('font-size:12px', 'font-size:11px')
        })),
        staffList: staffList.slice(0, 120).map(p => ({
          ini: ini(p.name),
          online: p.online,
          hasPhoto: !!p.photoUrl,
          noPhoto: !p.photoUrl,
          photo: p.photoUrl,
          name: p.name,
          title: p.title,
          dept: p.dept,
          lastActive: lastActiveOf(p),
          lastActiveStyle: `font-size:10.5px;font-weight:700;color:${p.online ? '#1d8f57' : '#7d8ea8'};white-space:nowrap`,
          shift: p.shift || '—',
          codeStyle: codeChip(p.shift),
          phoneShown: phonesOn ? mask(p.phone) || (p.ext ? 'ext ' + p.ext : '—') : 'hidden',
          phone: p.phone,
          tel: tel(p.phone),
          wa: wa(p.phone),
          call: e => {
            if (e && e.stopPropagation) e.stopPropagation();
            if (!p.phone) {
              e && e.preventDefault && e.preventDefault();
              this.toastMsg(phonesOn ? 'No phone number on record for ' + p.name : 'Phone numbers are hidden for your role.');
            }
          },
          msg: e => {
            if (e && e.stopPropagation) e.stopPropagation();
            this.openDM(p);
          },
          go: () => this.setState({
            screen: 'staffDetail',
            selStaff: p.name
          })
        })),
        person: {
          ...person,
          ini: ini(person.name || '?'),
          hasPhoto: !!person.photoUrl,
          noPhoto: !person.photoUrl,
          photo: person.photoUrl,
          statusLabel: lastActiveOf(person),
          statusStyle: `display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:700;padding:4px 9px;border-radius:999px;color:${person.online ? '#1d8f57' : '#7d8ea8'};background:${person.online ? 'rgba(43,182,115,.13)' : 'rgba(125,145,180,.14)'}`,
          dotStyle: `width:7px;height:7px;border-radius:50%;background:${person.online ? '#2bb673' : '#9aa6b4'}`,
          codeStyle: MONO + `;font-size:11px;font-weight:700;padding:4px 9px;border-radius:999px;color:${personSh.color};background:${personSh.bg}`,
          shiftLabel: `${person.shift || '—'} · ${personSh.name}${personSh.time ? ' · ' + personSh.time : ''}`,
          tel: tel(person.phone),
          wa: wa(person.phone),
          telExt: 'tel:' + (person.ext || ''),
          phone: person.phone || (phonesOn ? 'Not on record' : 'Hidden for your role'),
          ext: person.ext || '—',
          email: person.email || '—'
        },
        personActionsGrid: `display:grid;grid-template-columns:repeat(${canCall ? 3 : 1},1fr);gap:6px;width:100%`,
        msgPerson: () => this.openDM(person),
        personFacts: [['Employee ID', person.emp || '—'], ['BNMC reg.', person.reg || '—'], ['Extension', person.ext || '—'], ['Joined', person.joined || '—']].map(([label, v]) => ({
          label,
          v
        })),
        personRooms: personRooms.length ? personRooms : null,
        periodLabel,
        periodOpts: periodOpts.map(([k, label]) => ({
          label,
          go: () => this.setState({
            repPeriod: k
          }),
          style: chip(periodK === k)
        })),
        toggleCompare: () => this.setState({
          compareOn: !s.compareOn
        }),
        compareOn: s.compareOn,
        compareStyle: chip(s.compareOn),
        repTabs: repTabDef.map(([k, label]) => ({
          label,
          go: () => this.setState({
            repTab: k,
            repSimple: false
          }),
          style: pillBtn(s.repTab === k && !s.repSimple).replace('padding:7px 12px', 'padding:7px 2px').replace('font-size:12px', 'font-size:11px')
        })),
        repTabName,
        repSimple: s.repSimple,
        repOverview: !s.repSimple && s.repTab === 'overview',
        repCensus: !s.repSimple && s.repTab === 'census',
        repQuality: !s.repSimple && s.repTab === 'quality',
        repStaffing: !s.repSimple && s.repTab === 'staffing',
        repSubmitted: !s.repSimple && s.repTab === 'submitted',
        toggleSimple: () => this.setState({
          repSimple: !s.repSimple
        }),
        simpleBtnStyle: iconBtn(s.repSimple, '#0072a3'),
        simpleTiles,
        repUpdated: s.repUpdated,
        refreshReports: () => {
          this.setState({
            refreshing: true
          });
          if (s.demo) setTimeout(() => this.setState({
            refreshing: false,
            repUpdated: timeNow()
          }), 900);else {
            this.loadReport();
            this.loadShiftReports();
            this.loadRequests();
          }
        },
        refreshSpin: s.refreshing ? 'animation:rayspin .8s linear infinite' : '',
        exportToast: s.exportToast,
        insights,
        repKpis,
        censusBars,
        censusTip: s.censusTip,
        csDash: `${csRateN / 100 * 251.3} 251.3`,
        csRate: csRateN + '%',
        csCount: csT,
        nvdCount: nvdT,
        occAvg: occAvgN == null ? '—' : occAvgN + '%',
        bedsUsed: bedsUsed == null ? '—' : bedsUsed,
        bedsTotal: BEDS || '—',
        occRows,
        indicatorCount: INDS.length,
        indicatorsAlert,
        shiftReportTitle: shiftReps.some(r => r.rawDate === todayIso && r.shift === todayCode) ? 'Shift report sent' : 'Submit today’s shift report',
        shiftReportSub: `${todayCode || '—'} · ${today.name} · ${todayLabel} · 6 steps, about 3 minutes`,
        censusTiles,
        censusTable,
        occBars,
        ragSummary,
        indicators,
        staffTiles,
        staffShifts,
        absenceRows,
        submittedReports,
        shareOpen: s.shareOpen,
        openShare: () => this.setState({
          shareOpen: true
        }),
        closeShare: () => this.setState({
          shareOpen: false
        }),
        shareOpts: [['PDF', '#b32e2e', 'rgba(214,69,69,.12)', 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6'], ['WhatsApp', '#1d8f57', 'rgba(43,182,115,.14)', 'M21 12a8 8 0 01-8 8H8l-5 3 1.5-4.5A8 8 0 1121 12z'], ['Email', '#6a52d4', 'rgba(106,82,212,.13)', 'M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zM22 6l-10 7L2 6'], ['Print', '#3c4858', 'rgba(125,145,180,.16)', 'M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z']].map(([label, color, bg, d]) => ({
          label,
          color,
          bg,
          d,
          go: () => {
            this.setState({
              shareOpen: false
            });
            if (label === 'WhatsApp') window.open('https://wa.me/?text=' + encodeURIComponent(summaryText), '_blank');else if (label === 'Print') window.print();else if (label === 'Email') window.location.href = 'mailto:?subject=' + encodeURIComponent(dept + ' unit report') + '&body=' + encodeURIComponent(summaryText);else {
              if (navigator.clipboard) navigator.clipboard.writeText(summaryText).catch(() => {});
              this.toastMsg('Summary copied — paste it into your report', 'exportToast');
            }
          }
        })),
        scheduleOpts: [['schedDaily', 'Daily summary · 7 AM', 'WhatsApp to the Nurse Manager'], ['schedWeekly', 'Weekly report · Monday', 'PDF to CNS and Quality']].map(([k, label, sub]) => ({
          label,
          sub,
          go: () => this.setState({
            [k]: !s[k]
          }),
          ...track(!!s[k])
        })),
        summaryText,
        copySummary: () => {
          if (navigator.clipboard) navigator.clipboard.writeText(summaryText).catch(() => {});
          this.setState({
            shareOpen: false
          });
          this.toastMsg('Summary copied', 'exportToast');
        },
        infoOpen: s.infoOpen,
        closeInfo: () => this.setState({
          infoOpen: false
        }),
        infoInd: {
          name: infoIndRaw.name,
          v: infoIndRaw.noData ? '—' : infoIndRaw.v + (String(infoIndRaw.unit).startsWith('%') ? '%' : ''),
          bench: infoIndRaw.bench,
          ragLabel: infoIndRaw.noData ? 'No data' : RAG[ragOf(infoIndRaw)][2],
          dot: dot(indColor(infoIndRaw)),
          means: (IND_PLAIN[infoIndRaw.id] || {}).means || (infoIndRaw.num ? `${infoIndRaw.num} ÷ ${infoIndRaw.den}${infoIndRaw.formula ? ' · ' + infoIndRaw.formula : ''}` : ''),
          action: (IND_PLAIN[infoIndRaw.id] || {}).action || (infoIndRaw.noData ? 'Submit this month’s figures in Data collection.' : ragOf(infoIndRaw) === 'green' ? 'On target — keep the current practice.' : 'Review the cases behind this figure with the team and record an action plan.')
        },
        infoOpenDetail: () => this.setState({
          infoOpen: false,
          screen: 'indicator',
          selInd: infoIndRaw.id
        }),
        ind: {
          name: indRaw.name,
          unit: indRaw.unit,
          rag: indRaw.noData ? 'No data' : RAG[indRag][2],
          ragStyle: `font-size:10.5px;font-weight:700;padding:4px 9px;border-radius:999px;color:${indC};background:${indRaw.noData ? 'rgba(125,145,180,.16)' : RAG[indRag][1]};white-space:nowrap`,
          color: indC,
          v: indRaw.noData ? '—' : indRaw.v + (String(indRaw.unit).startsWith('%') ? '%' : ''),
          bench: indRaw.bench,
          delta: indRaw.noData ? '—' : (deltaV > 0 ? '+' : '') + deltaV,
          deltaStyle: MONO + `;font-size:16px;font-weight:600;margin-top:4px;color:${better ? '#1d8f57' : '#b32e2e'}`,
          benchLine: `position:absolute;left:0;right:0;bottom:${18 + Math.round((indRaw.benchV || 0) / trendMax * 70)}px;border-top:1.5px dashed rgba(210,58,82,.6)`,
          num: indRaw.num,
          numV: indRaw.numV,
          den: indRaw.den,
          denV: indRaw.denV,
          formula: indRaw.formula
        },
        indBars,
        capaItems,
        capaDone: `${capaItems.filter(c => c.done).length} of ${capaItems.length} done`,
        capaDraft: s.capaDraft,
        setCapaDraft: e => this.setState({
          capaDraft: e.target.value
        }),
        addCapa: () => {
          const t = s.capaDraft.trim();
          if (!t) return;
          this.setState({
            capaDraft: '',
            capaExtra: {
              ...s.capaExtra,
              [indRaw.id]: [...(s.capaExtra[indRaw.id] || []), {
                text: t,
                owner: staffName,
                due: dateLabel(clamp(TODAY + 7, 1, DIM))
              }]
            }
          });
        },
        srShiftCode: s.srShift,
        srStepLabel: `Step ${clamp(s.srStep, 0, 5) + 1} of ${SR_STEPS.length}`,
        srSent: s.srSent,
        srNotSent: !s.srSent,
        srSteps: SR_STEPS.map((st, i) => ({
          n: i + 1,
          label: st.label,
          go: () => this.setState({
            srStep: i
          }),
          style: `flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;border:0;border-radius:10px;padding:6px 2px;cursor:pointer;background:${i === s.srStep ? 'rgba(0,144,202,.12)' : 'transparent'};color:${i === s.srStep ? '#0072a3' : i < s.srStep ? '#1d8f57' : '#7d8ea8'}`,
          numStyle: MONO + `;display:grid;place-items:center;width:22px;height:22px;border-radius:50%;font-size:10.5px;font-weight:700;color:#fff;background:${i === s.srStep ? 'linear-gradient(140deg,#0aa0d4,#0072a3)' : i < s.srStep ? '#1d8f57' : 'rgba(125,145,180,.4)'}`
        })),
        srShiftOpts: srShiftCodes.map(c => ({
          label: `${c} · ${shiftOf(c).name}`,
          go: () => this.setState({
            srShift: c
          }),
          style: pillBtn(s.srShift === c)
        })),
        srHasShiftPick: s.srStep === 0,
        srHasCounts: !!step.fields,
        srSectionTitle: step.label,
        srCounts,
        srTotalLabel: step.total,
        srTotal,
        srHasNotes: step.key === 'notes',
        srNotes: [['obs', 'Observations', 'Ward round findings, condition changes'], ['issues', 'Issues & escalations', 'Equipment, staffing, patient complaints'], ['handover', 'Handover to next shift', 'What must happen in the next 8 hours']].map(([k, label, ph]) => ({
          label,
          ph,
          v: s.srNotes[k],
          set: e => this.setState({
            srNotes: {
              ...s.srNotes,
              [k]: e.target.value
            }
          })
        })),
        srHasReview: step.key === 'review',
        srReview,
        srCanBack: s.srStep > 0,
        srBack: () => this.setState({
          srStep: Math.max(0, s.srStep - 1)
        }),
        srNextLabel: s.srStep >= SR_STEPS.length - 1 ? s.busy.shiftrep ? 'Sending…' : 'Submit report' : 'Next: ' + SR_STEPS[s.srStep + 1].label,
        srNext: () => {
          if (s.srStep < SR_STEPS.length - 1) return this.setState({
            srStep: s.srStep + 1
          });
          this.submitShiftReport({
            dept: unit ? unit.id : undefined,
            date: todayIso,
            shift: s.srShift,
            counts: s.srVals,
            notes: s.srNotes
          });
        },
        exportReport: () => {
          if (navigator.clipboard) navigator.clipboard.writeText(srReview.map(r => r.label + ': ' + r.v).join('\n')).catch(() => {});
          this.toastMsg('Shift report copied', 'exportToast');
        },
        dcDueLabel: dcMonth === DC_CUR ? `Due ${DC_DUE_DAY} ${MON3[M]} · ${DC_DUE_DAY - TODAY} days left` : dcMonth < DC_CUR ? 'Closed month · corrections only' : 'Not open yet',
        dcDueStyle: `font-size:11px;font-weight:700;color:${dcMonth === DC_CUR ? DC_DUE_DAY - TODAY <= 5 ? '#b32e2e' : '#b8650a' : '#7d8ea8'}`,
        dcPrevMonth: () => this.setState({
          dcMonth: Math.max(0, dcMonth - 1)
        }),
        dcNextMonth: () => this.setState({
          dcMonth: Math.min(DC_MONTHS.length - 1, dcMonth + 1)
        }),
        dcDash: `${dcTotal ? dcSent / dcTotal * 194.8 : 0} 194.8`,
        dcPct: (dcTotal ? Math.round(dcSent / dcTotal * 100) : 0) + '%',
        dcSentCount: dcSent,
        dcTotal,
        dcStatusChips: ['All', 'Sent', 'Approved', 'Returned', 'Not submitted'].map(f => {
          const n = f === 'All' ? dcItemsRaw.length : dcItemsRaw.filter(it => dcFilterMap[f].includes(it.status)).length;
          const c = f === 'Approved' ? '#1d8f57' : f === 'Returned' ? '#b32e2e' : f === 'Sent' ? '#0072a3' : f === 'Not submitted' ? '#b8650a' : '#3c4858';
          return {
            label: f,
            n,
            go: () => this.setState({
              dcFilter: f
            }),
            dot: `width:7px;height:7px;border-radius:50%;background:${c}`,
            style: `display:inline-flex;align-items:center;gap:5px;border:1px solid ${s.dcFilter === f ? 'rgba(0,144,202,.5)' : 'rgba(125,145,180,.25)'};border-radius:999px;padding:4px 9px;font-size:11px;font-weight:600;cursor:pointer;background:${s.dcFilter === f ? 'rgba(0,144,202,.12)' : 'rgba(255,255,255,.7)'};color:${s.dcFilter === f ? '#0072a3' : '#3c4858'}`
          };
        }),
        dcToast: s.dcToast,
        dcItems,
        dcSteps: [['Enter', 'fill the sheet or the numerator and denominator'], ['Send', 'it goes to Quality & Administration for review'], ['Review', 'approved values feed the hospital dashboard, returned ones come back with a reason'], ['Correct', 'an approved figure can be corrected — administration approves again']].map(([t, d], i) => ({
          n: i + 1,
          t,
          d
        })),
        dcItem,
        dcFormSent: s.dcFormSent,
        dcFormOpen: !s.dcFormSent,
        dcSentTitle: dcNeedsCorr ? 'Correction sent' : 'Submitted for review',
        dcNeedsCorr,
        dcNextOpenLabel: openCount > 1 ? 'Next open item' : 'Back to list',
        dcNextOpen: () => {
          const next = dcItemsRaw.find(it => (it.status === 'missing' || it.status === 'rejected') && it.id !== dcItem0.id);
          if (next) go('datacolForm', {
            dcSel: next.id,
            dcFormSent: false,
            dcGuideOpen: false,
            dcNote: '',
            dcCorr: ''
          });else go('datacol', {
            dcFormSent: false
          });
        },
        dcIsStat: dcItem0.kind === 'stat',
        dcIsQuality: dcItem0.kind === 'q',
        dcStatFields,
        dcIsGrouped: !!dcItem0.grouped,
        dcModeOpts: [['direct', 'Direct entry'], ['group', 'By staff group']].map(([k, label]) => ({
          label,
          go: () => this.setState({
            dcMode: k
          }),
          style: pillBtn(s.dcMode === k)
        })),
        dcByGroup: byGroup,
        dcGroups,
        dcDirect: !byGroup,
        dcReadOnly,
        dcNum,
        setDcNum: dcSet('num'),
        dcNumStyle: roStyle(dcReadOnly),
        dcDen,
        setDcDen: dcSet('den'),
        dcDenReadOnly: dcReadOnly || !!dcItem0.denLocked || isCount,
        dcDenStyle: roStyle(dcReadOnly || !!dcItem0.denLocked || isCount),
        dcResult: resultV == null ? '—' : dcItem0.unit === '%' ? resultV + '%' : String(resultV),
        dcResultBg: resultOk == null ? 'rgba(125,145,180,.1)' : resultOk ? 'rgba(43,182,115,.12)' : 'rgba(214,69,69,.1)',
        dcResultColor: resultOk == null ? '#7d8ea8' : resultOk ? '#1d8f57' : '#b32e2e',
        dcResultLabel: resultV == null ? isCount ? 'enter the count' : 'enter both values' : resultOk == null ? 'no benchmark set' : resultOk ? 'within benchmark' : 'outside benchmark',
        toggleDcGuide: () => this.setState({
          dcGuideOpen: !s.dcGuideOpen
        }),
        dcGuideOpen: s.dcGuideOpen,
        dcGuideChevron: s.dcGuideOpen ? 'transform:rotate(180deg)' : '',
        dcGuide: guide ? [['Definition', guide.def, 'inherit'], ['Worked example', guide.example, "'IBM Plex Mono',monospace"], ['Benchmark', `${dcItem0.bench} ${dcItem0.meta || ''}`, "'IBM Plex Mono',monospace"], ['Reference', guide.ref, 'inherit']].filter(g => g[1]).map(([label, text, font]) => ({
          label,
          text,
          font
        })) : [],
        dcEditable,
        dcCorr: s.dcCorr,
        setDcCorr: e => this.setState({
          dcCorr: e.target.value
        }),
        dcNote: s.dcNote,
        setDcNote: e => this.setState({
          dcNote: e.target.value
        }),
        toggleDcEvidence: () => this.setState({
          dcEvidence: !s.dcEvidence
        }),
        dcEvidenceStyle: chip(s.dcEvidence) + ';display:inline-flex;align-items:center;gap:6px;align-self:flex-start',
        dcEvidenceLabel: s.dcEvidence ? 'Register photo noted' : 'Attach register photo',
        dcSaveDraft: () => {
          this.setState({
            dcSubs: {
              ...s.dcSubs,
              [dcMonth]: {
                ...(s.dcSubs[dcMonth] || {}),
                [dcItem0.id]: {
                  status: 'draft',
                  num: numN,
                  den: denN,
                  vals: dcStatFields.map(f => f.v),
                  at: dayStamp(),
                  note: s.dcNote
                }
              }
            },
            screen: 'datacol'
          });
          this.toastMsg('Draft saved on this phone · not sent yet', 'dcToast');
        },
        dcSubmitLabel: s.busy.dc ? 'Sending…' : dcNeedsCorr ? 'Send correction' : 'Submit to administration',
        dcSubmitStyle: `flex:2;border:0;border-radius:13px;padding:13px;font-size:14px;font-weight:700;cursor:${s.busy.dc ? 'wait' : 'pointer'};${BLUE_BTN};opacity:${dcSubmitOk ? 1 : .5}`,
        dcSubmit: () => {
          if (!dcSubmitOk || s.busy.dc) return;
          this.submitDc(dcItem0, dcM, {
            num: numN,
            den: denN,
            vals: dcStatFields.map(f => f.v === '' ? '' : Number(f.v)),
            note: s.dcNote,
            corr: s.dcCorr,
            isCorr: dcNeedsCorr,
            dept: dcDept,
            area: dcArea,
            resultV
          });
        },
        dcHistTiles: [['Sent', histAll.filter(h => stOf(h.sub) === 'sent').length, '#0072a3'], ['Approved', histAll.filter(h => stOf(h.sub) === 'approved').length, '#1d8f57'], ['Returned', histAll.filter(h => stOf(h.sub) === 'rejected').length, '#b32e2e']].map(([label, v, color]) => ({
          label,
          v,
          color
        })),
        dcHistFilters: ['All', 'Pending', 'Approved', 'Returned'].map(f => ({
          label: f,
          go: () => this.setState({
            dcHistFilter: f
          }),
          style: chip(s.dcHistFilter === f)
        })),
        dcHistory,
        handoverStats: [{
          n: handoverAll.length,
          label: 'Patients',
          color: '#0072a3'
        }, {
          n: critN,
          label: 'Critical',
          color: critN ? '#b32e2e' : '#1d8f57'
        }, {
          n: pendingH,
          label: 'Pending',
          color: pendingH ? '#b8650a' : '#1d8f57'
        }],
        handoverItems,
        handoverDraft: s.handoverDraft,
        setHandoverDraft: e => this.setState({
          handoverDraft: e.target.value
        }),
        addHandover: () => {
          const t = s.handoverDraft.trim();
          if (!t) return;
          const m = t.match(/^(B\d+|Bed\s*\d+)[\s:·-]*/i);
          this.addHandover({
            bed: m ? m[1].replace(/bed\s*/i, 'B') : '—',
            patient: '',
            prio: /critical|urgent|decel|bleed/i.test(t) ? 'Critical' : /watch|monitor|bp|repeat/i.test(t) ? 'Watch' : 'Routine',
            note: t.replace(m ? m[0] : '', '')
          });
        },
        incSent: s.incSent,
        incNotSent: !s.incSent,
        incTypes: INC_TYPES.map(t => ({
          label: t,
          go: () => this.setState({
            incType: t
          }),
          style: chip(s.incType === t).replace('flex-shrink:0', 'flex-shrink:0;text-align:center')
        })),
        incSevs: INC_SEVS.map(t => ({
          label: t,
          go: () => this.setState({
            incSev: t
          }),
          style: chip(s.incSev === t) + ';flex:1;text-align:center;padding:6px 4px'
        })),
        incTime: s.incTime,
        setIncTime: e => this.setState({
          incTime: e.target.value
        }),
        incDesc: s.incDesc,
        setIncDesc: e => this.setState({
          incDesc: e.target.value
        }),
        toggleAnon: () => this.setState({
          incAnon: !s.incAnon
        }),
        anonBoxStyle: box(s.incAnon),
        incAnon: s.incAnon,
        submitIncident: () => {
          if (!s.incDesc.trim()) return this.toastMsg('Describe what happened first.');
          this.submitIncident({
            type: s.incType,
            severity: s.incSev,
            time: s.incTime,
            description: s.incDesc.trim(),
            anonymous: s.incAnon
          });
        },
        score: scoreVal == null ? '—' : scoreVal.toFixed(1),
        scoreDash: `${(scoreVal || 0) / 5 * 251.3} 251.3`,
        scoreBand: P.band,
        reviewer: P.reviewer,
        reviewDate: P.date,
        perfKpis: P.kpis,
        competencies,
        supervisorNote: P.note,
        goals: P.goals,
        profileFacts: [['Employee ID', empIdShown], ['BNMC reg.', myRec && (myRec.bnmc || myRec.reg_no) || '—'], ['Joined', myRec && myRec.doj ? fmtIso(myRec.doj) : '—'], ['Unit', unit ? unit.name : dept]].map(([label, v]) => ({
          label,
          v
        })),
        settings: [{
          label: 'Notifications',
          sub: 'Roster changes, notices, approvals',
          isToggle: true,
          isValue: false,
          go: () => this.savePrefs({
            notifOn: !s.notifOn
          }),
          ...toggle(s.notifOn)
        }, {
          label: 'Biometric sign-in',
          sub: 'Fingerprint or face instead of PIN',
          isToggle: true,
          isValue: false,
          go: () => this.savePrefs({
            biometric: !s.biometric
          }),
          ...toggle(s.biometric)
        }, {
          label: 'Wake before shift',
          sub: 'Alarm 90 minutes before each duty',
          isToggle: true,
          isValue: false,
          go: () => this.savePrefs({
            wakeOnShift: !s.wakeOnShift
          }),
          ...toggle(s.wakeOnShift)
        }, {
          label: 'Signed in as',
          sub: me.username ? '@' + me.username + ' · ' + (bu.roleLabel || me.role || 'nurse') : '—',
          isToggle: false,
          isValue: true,
          value: s.demo ? 'Demo' : rosterLive ? 'Live roster' : 'No roster yet'
        }],
        ...RE,
        ...US,
        _toast: s.toast,
        _booting: s.booting
      };
    }
    render() {
      const v = this.renderVals();
      return React.createElement(React.Fragment, null, React.createElement(View, {
        v: v
      }), v._toast ? React.createElement("div", {
        style: {
          position: 'fixed',
          left: '50%',
          bottom: 28,
          transform: 'translateX(-50%)',
          zIndex: 60,
          maxWidth: 'min(92vw,380px)',
          padding: '11px 16px',
          borderRadius: 14,
          background: 'rgba(13,28,50,.94)',
          color: '#fff',
          fontSize: 13,
          fontWeight: 600,
          boxShadow: '0 14px 40px rgba(0,0,0,.3)',
          animation: 'pop .25s ease'
        }
      }, v._toast) : null);
    }
  }
  mount(NurseApp, View.CSS);
})();
})();
