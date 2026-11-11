/* UNICO — Nursing Documentation Audit: the ONE rule for scoring an audited record and for the
   monthly KPIs. Shared by the server (server/doc-audit.js, require()) and the browser
   (window.UNICO_DA: the audit form's live result panel, the register, the reports), so the
   score a nurse is shown on screen is exactly the score the server stores and the KPI counts.

   The rules are the policy's (UHP-NSG-QA-001 v2.0 §8, repeated by QA-002/003/004):
     Documentation Accuracy (%) = Yes ÷ (Yes + No) × 100 — N/A is excluded from scoring.
     PASS = score ≥ 90 % AND no critical criterion marked No. Any critical failure = FAIL.
     Grade: ≥ 95 Excellent · 90–94.9 Good · 80–89.9 Needs improvement · < 80 Unsatisfactory.
   The score is rounded to one decimal BEFORE it is graded, so the band printed always matches
   the figure printed beside it. Unreviewed items stay blank and are never counted as N/A.

   An audit carries a frozen copy of the criteria it was filled against (freezeCriteria), so
   editing a tool later never changes an old audit's score. Dates are on the hospital calendar
   (Asia/Dhaka, UTC+6, no DST). */
(function (root) {
  const STATUSES = ['draft', 'completed', 'acknowledged', 'signed'];
  const STATUS_LABEL = { draft: 'Draft', completed: 'Completed', acknowledged: 'Acknowledged', signed: 'Signed off' };
  const ANSWERS = ['Y', 'N', 'NA'];
  const PASS_MARK = 90;
  const GRADES = [
    { id: 'excellent', min: 95, label: 'Excellent', action: 'Recognise good practice; share as example.' },
    { id: 'good', min: 90, label: 'Good', action: 'Feedback on gaps; monitor next audit.' },
    { id: 'improve', min: 80, label: 'Needs improvement', action: 'Coaching; re-audit within 1 month.' },
    { id: 'unsat', min: -1, label: 'Unsatisfactory', action: 'Individual improvement plan; focused training; re-audit within 2 weeks.' },
  ];
  const FAIL_ACTION = 'Same-day correction where possible; incident report if harm/near miss; root-cause review.';
  const KPI_FORMULAS = ['accuracy', 'pass', 'full', 'critical', 'subset'];
  const KPI_FORMULA_LABEL = {
    accuracy: "Total 'Yes' ÷ (Total 'Yes' + Total 'No') × 100 across all audited records",
    pass: 'Records scoring ≥ 90% with zero critical failures ÷ records audited × 100',
    full: "Records with no 'No' answers ÷ records audited × 100",
    critical: "Records with ≥ 1 critical criterion marked 'No' ÷ records audited × 100",
    subset: "'Yes' ÷ ('Yes' + 'No') for the chosen criteria",
  };
  const SHIFTS = ['Morning', 'Evening', 'Night'];
  const MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const TZ_MS = 6 * 3600 * 1000;

  const pad = (n) => String(n).padStart(2, '0');
  const has = (v) => v !== null && v !== undefined && v !== '' && !(typeof v === 'number' && isNaN(v));
  const round1 = (x) => Math.round(x * 10) / 10;
  const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + 'T00:00:00Z'));
  const isMonth = (s) => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
  function hospitalNow(now) {
    const t = new Date((now == null ? Date.now() : +now) + TZ_MS);
    return { date: t.toISOString().slice(0, 10), month: t.toISOString().slice(0, 7) };
  }
  const addMonth = (ym, n) => { let y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1 + n; y += Math.floor(m / 12); m = ((m % 12) + 12) % 12; return y + '-' + pad(m + 1); };
  function monthsBetween(from, to, cap) {
    const out = [];
    if (!isMonth(from) || !isMonth(to) || from > to) return out;
    for (let m = from; m <= to && out.length < (cap || 60); m = addMonth(m, 1)) out.push(m);
    return out;
  }
  const fmtMonth = (ym) => (isMonth(ym) ? MONS[+ym.slice(5, 7) - 1] + ' ' + ym.slice(0, 4) : String(ym || ''));
  const fmtDate = (d) => (isDate(d) ? +d.slice(8, 10) + ' ' + MONS[+d.slice(5, 7) - 1] + ' ' + d.slice(0, 4) : String(d || ''));
  const quarterOf = (d) => { const s = String(d || ''); return s.slice(0, 4) + '-Q' + (Math.floor((+s.slice(5, 7) - 1) / 3) + 1); };

  /* ------------------------------------------------------------ the tool --- */
  const isLiveTool = (t) => !!t && !t.removedAt && !t.disabled;
  const activeCriteria = (list) => (list || []).filter((c) => c && c.id && c.active !== false);
  // The criteria an audit is scored against, frozen onto the audit when it is created.
  function freezeCriteria(tool) {
    const secs = {};
    ((tool && tool.sections) || []).forEach((s) => { secs[s.id] = s.title; });
    return activeCriteria(tool && tool.criteria).map((c) => ({
      id: c.id, no: c.no, sectionId: c.sectionId || '', section: secs[c.sectionId] || '', text: c.text,
      critical: !!c.critical, jci: Array.isArray(c.jci) ? c.jci.slice(0, 8) : [],
    }));
  }
  // The N/A guidance for one procedure area / zone: { na:[ids suggested N/A], never:[ids that may never be N/A], notes:[...] }.
  function guideFor(tool, area) {
    const out = { na: [], never: [], notes: [] };
    const a = String(area || '').trim().toLowerCase();
    ((tool && tool.naGuide) || []).forEach((g) => {
      if (!g || !Array.isArray(g.areas) || !g.areas.some((x) => String(x).trim().toLowerCase() === a)) return;
      (g.na || []).forEach((id) => { if (out.na.indexOf(id) < 0) out.na.push(id); });
      (g.never || []).forEach((id) => { if (out.never.indexOf(id) < 0) out.never.push(id); });
      if (g.note) out.notes.push(g.note);
    });
    return out;
  }

  /* ----------------------------------------------------------- one record --- */
  function gradeOf(pct) {
    if (!has(pct)) return null;
    return GRADES.find((g) => pct >= g.min) || GRADES[GRADES.length - 1];
  }
  /* The result of one audited record. `criteria` = the audit's frozen list (or a tool's criteria).
     Returns { yes, no, na, blank, applicable, pct, criticalFails:[ids], grade, gradeLabel, pass, action, complete }. */
  function score(answers, criteria) {
    const a = answers || {};
    let yes = 0, no = 0, na = 0, blank = 0;
    const criticalFails = [];
    activeCriteria(criteria).forEach((c) => {
      const v = a[c.id];
      if (v === 'Y') yes++;
      else if (v === 'N') { no++; if (c.critical) criticalFails.push(c.id); }
      else if (v === 'NA') na++;
      else blank++;
    });
    const applicable = yes + no;
    const pct = applicable ? round1((yes / applicable) * 100) : null;
    const g = gradeOf(pct);
    const pass = pct != null && pct >= PASS_MARK && criticalFails.length === 0;
    return {
      yes, no, na, blank, applicable, pct, criticalFails,
      grade: g ? g.id : null, gradeLabel: g ? g.label : '',
      pass, result: pct == null ? '' : pass ? 'PASS' : 'FAIL',
      action: criticalFails.length ? FAIL_ACTION : g ? g.action : '',
      complete: blank === 0 && applicable + na > 0,
    };
  }

  /* What stops an audit from being completed. `audit` = { deptId, date, uhid, nurse, answers, evidence, area };
     `criteria` = its frozen list; `opts` = { today, tool (for the N/A guide), auditorStaffId }.
     Returns [{ field, criterion?, message }] — empty = ready. */
  function validate(audit, criteria, opts) {
    const o = opts || {};
    const x = audit || {};
    const out = [];
    const ans = x.answers || {}, ev = x.evidence || {};
    if (!x.deptId) out.push({ field: 'deptId', message: 'Choose the department.' });
    if (!isDate(x.date)) out.push({ field: 'date', message: 'Enter the audit date.' });
    else if (o.today && x.date > o.today) out.push({ field: 'date', message: 'The audit date cannot be in the future.' });
    if (!String(x.uhid || '').trim()) out.push({ field: 'uhid', message: 'Enter the patient UHID / MRN.' });
    const n = x.nurse || {};
    if (!n.staffId && !String(n.name || '').trim()) out.push({ field: 'nurse', message: 'Choose the nurse whose documentation was audited.' });
    if (o.auditorStaffId != null && n.staffId != null && String(o.auditorStaffId) === String(n.staffId)) out.push({ field: 'nurse', message: 'Nurses do not audit their own documentation (policy 7.3).' });
    const guide = o.tool ? guideFor(o.tool, x.area) : { never: [] };
    activeCriteria(criteria).forEach((c) => {
      const v = ans[c.id];
      // Evidence for a 'No' is optional (the user's choice, 2026-11-11): the box is offered, never required.
      if (ANSWERS.indexOf(v) < 0) out.push({ field: 'answers', criterion: c.id, message: 'Criterion ' + c.no + ' is not answered (Yes, No or N/A).' });
      else if (v === 'NA' && guide.never.indexOf(c.id) >= 0) out.push({ field: 'answers', criterion: c.id, message: 'Criterion ' + c.no + ' is never N/A in ' + x.area + ' (policy 7.3).' });
    });
    return out;
  }

  /* ------------------------------------------------------- KPIs & reports --- */
  // A KPI over a list of audits (each with .answers, .criteria, .result). Returns { num, den, value, target, direction, met }.
  function kpiValue(kpi, audits) {
    const k = kpi || {};
    const list = (audits || []).filter((a) => a && a.result);
    let num = 0, den = 0;
    if (k.formula === 'accuracy') list.forEach((a) => { num += a.result.yes; den += a.result.yes + a.result.no; });
    else if (k.formula === 'pass') list.forEach((a) => { den++; if (a.result.pass) num++; });
    else if (k.formula === 'full') list.forEach((a) => { den++; if (a.result.no === 0 && a.result.applicable > 0) num++; });
    else if (k.formula === 'critical') list.forEach((a) => { den++; if ((a.result.criticalFails || []).length) num++; });
    else if (k.formula === 'subset') {
      const ids = Array.isArray(k.criteria) ? k.criteria : [];
      list.forEach((a) => {
        const live = new Set(activeCriteria(a.criteria).map((c) => c.id));
        ids.forEach((id) => { if (!live.has(id)) return; const v = (a.answers || {})[id]; if (v === 'Y') { num++; den++; } else if (v === 'N') den++; });
      });
    }
    const value = den > 0 ? round1((num / den) * 100) : null;
    const target = has(k.target) ? Number(k.target) : null;
    const lower = k.direction === 'lower';
    const met = value == null || target == null ? null : lower ? value <= target : value >= target;
    return { id: k.id, name: k.name, code: k.code || '', formula: k.formula, num, den, value, target, direction: lower ? 'lower' : 'higher', met };
  }
  /* One group of audits (a department-month, a hospital total…): counts, every KPI of the tool,
     the criteria that failed most, and which KPIs are below target. */
  function summarize(audits, kpis) {
    const list = (audits || []).filter((a) => a && a.result);
    const s = { records: list.length, yes: 0, no: 0, na: 0, pass: 0, criticalRecords: 0, fullyCompliant: 0, nurses: 0 };
    const gaps = {};
    const nurses = new Set();
    list.forEach((a) => {
      s.yes += a.result.yes; s.no += a.result.no; s.na += a.result.na;
      if (a.result.pass) s.pass++;
      if ((a.result.criticalFails || []).length) s.criticalRecords++;
      if (a.result.no === 0 && a.result.applicable > 0) s.fullyCompliant++;
      if (a.nurse) nurses.add(String(a.nurse.staffId != null ? 's' + a.nurse.staffId : 'n' + String(a.nurse.name || '').toLowerCase()));
      const crit = {};
      activeCriteria(a.criteria).forEach((c) => { crit[c.id] = c; });
      Object.keys(a.answers || {}).forEach((id) => {
        if (a.answers[id] !== 'N' || !crit[id]) return;
        const g = gaps[id] || (gaps[id] = { id, no: crit[id].no, text: crit[id].text, critical: !!crit[id].critical, count: 0 });
        g.count++;
      });
    });
    s.nurses = nurses.size;
    s.accuracy = s.yes + s.no > 0 ? round1((s.yes / (s.yes + s.no)) * 100) : null;
    s.kpis = (kpis || []).map((k) => kpiValue(k, list));
    s.belowTarget = s.kpis.filter((k) => k.met === false).map((k) => k.id);
    s.gaps = Object.values(gaps).sort((x, y) => y.count - x.count || (x.no || 0) - (y.no || 0));
    s.topFailing = s.gaps.slice(0, 3);
    return s;
  }
  // The policy's CAP trigger (§9): the same KPI below target two months running. `prev`, `cur` = summaries.
  function capDue(prev, cur) {
    if (!prev || !cur || !prev.records || !cur.records) return [];
    return cur.belowTarget.filter((id) => prev.belowTarget.indexOf(id) >= 0);
  }
  // Group audits by a key function: { key: [audits] }.
  function groupBy(audits, fn) {
    const out = {};
    (audits || []).forEach((a) => { const k = fn(a); if (k == null) return; (out[k] = out[k] || []).push(a); });
    return out;
  }
  const countsInKpi = (a) => !!a && !a.removedAt && a.status !== 'draft' && !!a.result;

  const API = {
    STATUSES, STATUS_LABEL, ANSWERS, PASS_MARK, GRADES, FAIL_ACTION, KPI_FORMULAS, KPI_FORMULA_LABEL, SHIFTS,
    has, round1, isDate, isMonth, hospitalNow, addMonth, monthsBetween, fmtMonth, fmtDate, quarterOf,
    isLiveTool, activeCriteria, freezeCriteria, guideFor, gradeOf, score, validate,
    kpiValue, summarize, capDue, groupBy, countsInKpi,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.UNICO_DA = API;
})(typeof window !== 'undefined' ? window : null);
