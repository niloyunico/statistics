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
