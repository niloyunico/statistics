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
