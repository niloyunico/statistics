/* UNICO — the ONE hand-hygiene pooling rule.
   Shared by the server (/api/hand-hygiene, require()), the Data Submission "Hand Hygiene"
   screen and the Quality console's hand-hygiene report (window.UNICO_HH), so every screen
   shows the same hospital total. api/report_pdf.py mirrors it (_hh_pool).

   Source of truth: the hospital-wide WHO audit the Infection Control nurse submits on
   Overall Hospital → Hand Hygiene Compliance (Hospital): mNum/mDen per month plus
   mDeptBreakdown[month] = [{dept, g:{nurse:{n,d}, doctor, pca, other}}].
   quality-store.js copies each audit row into that department's own HH indicator (tagged
   mFromAudit[month]), so adding the hospital record AND the departments counted every
   observation twice. Here the audit row is used once; a department's OWN reading counts
   only for a month the audit did not cover, and only in `totalAll`, so the hospital total
   (`total`) is exactly the audit the nurse entered. */
(function (root) {
  const GROUPS = [['nurse', 'Nurse'], ['doctor', 'Doctor'], ['pca', 'PCA'], ['other', 'Other']];
  const DEFAULT_BENCH = 80;
  const HOSPITAL_ID = '__hospital__';

  const normN = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  // The audit filed rows under the departments' ORIGINAL names; several were renamed to their
  // canonical Quality name later. Old audit name → canonical.
  const DEPT_ALIAS = {
    'endoscopy': 'endoscopic suite',
    'level 10 ward': 'ipd cabin level 10',
    'level 9 ward': 'ipd cabin level 9',
    'labour / delivery / recovery': 'labour , delivery & recovery room',
    'ct ot': 'ctvs ot',
    'ct icu': 'ctvs icu',
    'emergency medicine': 'emergency room',
    'home care': 'family medicine',
  };
  const canonDept = (s) => { const n = normN(s); return DEPT_ALIAS[n] || n; };

  const has = (v) => v != null && v !== '';
  const pctOf = (n, d) => (d > 0 ? Math.round((n / d) * 10000) / 100 : null);
  const isHHInd = (ind) => /hand\s*hygiene/i.test((ind && ind.name) || '');
  const isHospital = (d) => !!d && (d.deptId === HOSPITAL_ID || d._id === HOSPITAL_ID || normN(d.key) === 'overall hospital');
  const benchOf = (ind) => {
    const b = ind && ind.benchmarkValue;
    return (b != null && b !== '' && !isNaN(Number(b))) ? Number(b) : DEFAULT_BENCH;
  };

  // The hospital audit indicator: the HH indicator of the Overall Hospital record. Older data
  // kept the audit on another area; then the HH indicator that holds a department breakdown.
  function findSource(depts) {
    let best = null;
    (depts || []).forEach((d) => (d.indicators || []).forEach((ind) => {
      if (!isHHInd(ind)) return;
      const bd = ind.mDeptBreakdown && Object.keys(ind.mDeptBreakdown).length > 0;
      const score = (isHospital(d) ? 4 : 0) + (bd ? 2 : 0) + (/overall|hospital/i.test(ind.name || '') ? 1 : 0);
      if (score >= 2 && (!best || score > best.score)) best = { dep: d, ind: ind, score: score };
    }));
    return best;
  }

  // Which quality area an audit row belongs to (null = a department with no quality area).
  function matchDept(rowName, depts) {
    const c = canonDept(rowName);
    return (depts || []).find((d) => !isHospital(d) && (canonDept(d.name) === c || (d.qualityName && canonDept(d.qualityName) === c)
      || normN(d.key) === normN(rowName) || canonDept(d.key) === c)) || null;
  }

  const sumG = (g) => GROUPS.reduce((a, [k]) => { const x = (g || {})[k] || {}; return { n: a.n + (Number(x.n) || 0), d: a.d + (Number(x.d) || 0) }; }, { n: 0, d: 0 });
  const cell = (n, d, src) => ({ n: n, d: d, pct: pctOf(n, d), src: src });

  /* Shape for one series reader: the hospital view = the audit (n/d/pct); a view narrowed to
     chosen departments = their audit rows plus their own readings (nAll/dAll/pctAll). */
  function series(res) {
    const all = !!(res && res.restricted);
    return ((res && res.months) || []).map((x) => ({ m: x.m, n: all ? x.nAll : x.n, d: all ? x.dAll : x.d, pct: all ? x.pctAll : x.pct, pctOnly: x.pctOnly }));
  }
  const totalOf = (res) => (res ? (res.restricted ? res.totalAll : res.total) : null);

  /* build(depts, months, opts)
     depts  — quality areas [{key,name,deptId?,qualityName?,indicators}]
     months — month keys ['Jan-26', …] in display order
     opts.only — area keys to restrict the rows to (absent, or holding the hospital = all)
     Returns {source, bench, months[], rows[], groups[], total, totalAll}. Every n/d/pct is a
     pooled Σcompliant / Σopportunities — never a mean of percentages. */
  function build(depts, months, opts) {
    opts = opts || {};
    months = (months || []).slice();
    const src = findSource(depts);
    const sInd = src ? src.ind : null;
    const bd = (sInd && sInd.mDeptBreakdown) || {};
    const onlySet = Array.isArray(opts.only) && opts.only.length ? new Set(opts.only.map(String)) : null;
    const restrict = !!onlySet && !(src && onlySet.has(String(src.dep.key)));
    const keep = (key) => !restrict || onlySet.has(String(key));

    const rowsByKey = new Map();
    const rowFor = (key, name, dep) => {
      if (!rowsByKey.has(key)) rowsByKey.set(key, { key: key, name: name, deptKey: dep ? dep.key : null, cells: {}, groups: {} });
      return rowsByKey.get(key);
    };

    // 1. the audit rows
    months.forEach((m) => {
      const rows = Array.isArray(bd[m]) ? bd[m] : [];
      rows.forEach((r) => {
        if (!r) return;
        const dep = matchDept(r.dept, depts);
        const key = dep ? String(dep.key) : 'audit:' + canonDept(r.dept);
        if (!keep(key)) return;
        const t = sumG(r.g);
        const row = rowFor(key, dep ? dep.name : String(r.dept || '—'), dep);
        if (!(t.d > 0)) { if (!row.cells[m]) row.cells[m] = { n: 0, d: 0, pct: null, src: 'not-audited' }; return; }
        const prev = row.cells[m];
        const n = t.n + (prev && prev.src === 'audit' ? prev.n : 0), d = t.d + (prev && prev.src === 'audit' ? prev.d : 0);
        row.cells[m] = cell(n, d, 'audit');
        const gg = row.groups[m] = row.groups[m] || {};
        GROUPS.forEach(([k]) => { const x = (r.g || {})[k] || {}; const o = gg[k] || { n: 0, d: 0 }; gg[k] = { n: o.n + (Number(x.n) || 0), d: o.d + (Number(x.d) || 0) }; });
      });
    });

    // 2. a department's own readings, for months the audit did not cover
    (depts || []).forEach((d) => {
      if (src && d === src.dep) return;
      if (!keep(String(d.key))) return;
      (d.indicators || []).forEach((ind) => {
        if (!isHHInd(ind) || ind === sInd) return;
        const fromAudit = ind.mFromAudit || {};
        months.forEach((m) => {
          if (fromAudit[m]) return;
          const row0 = rowsByKey.get(String(d.key));
          if (row0 && row0.cells[m] && row0.cells[m].src === 'audit') return;
          const nn = ind.mNum && ind.mNum[m], dd = ind.mDen && ind.mDen[m];
          const row = () => rowFor(String(d.key), d.name, d);
          if (has(nn) && Number(dd) > 0) {
            const prev = row().cells[m];
            const n = Number(nn) + (prev && prev.src === 'own' ? prev.n : 0), den = Number(dd) + (prev && prev.src === 'own' ? prev.d : 0);
            row().cells[m] = cell(n, den, 'own');
            const gN = ind.mGroups && ind.mGroups[m], gD = ind.mGroupsDen && ind.mGroupsDen[m];
            if (gN && gD) { const gg = row().groups[m] = {}; GROUPS.forEach(([k]) => { if (has(gN[k]) || has(gD[k])) gg[k] = { n: Number(gN[k]) || 0, d: Number(gD[k]) || 0 }; }); }
          } else if (has(ind.months && ind.months[m]) && !(row().cells[m])) {
            row().cells[m] = { n: null, d: null, pct: Number(ind.months[m]), src: 'own-pct' };
          }
        });
      });
    });

    const rows = Array.from(rowsByKey.values());
    // 3. per-month hospital totals
    const monthRows = months.map((m) => {
      let an = 0, ad = 0, on = 0, od = 0, audited = false;
      rows.forEach((r) => { const c = r.cells[m]; if (!c || c.d == null) return;
        if (c.src === 'audit') { an += c.n; ad += c.d; audited = true; } else if (c.src === 'own') { on += c.n; od += c.d; } });
      let n = null, d = null, pct = null, pctOnly = false;
      if (audited) { n = an; d = ad; pct = pctOf(an, ad); }
      else if (!restrict && sInd && has(sInd.mNum && sInd.mNum[m]) && Number(sInd.mDen && sInd.mDen[m]) > 0) {
        n = Number(sInd.mNum[m]); d = Number(sInd.mDen[m]); pct = pctOf(n, d);
      } else if (!restrict && sInd && has(sInd.months && sInd.months[m])) { pct = Number(sInd.months[m]); pctOnly = true; }
      const nAll = (n || 0) + on, dAll = (d || 0) + od;
      return {
        m: m, n: n, d: d, pct: pct, pctOnly: pctOnly,
        nAll: dAll > 0 ? nAll : n, dAll: dAll > 0 ? dAll : d, pctAll: dAll > 0 ? pctOf(nAll, dAll) : pct,
        selfReported: od > 0,
        notObserved: !!(sInd && sInd.mNotObserved && sInd.mNotObserved[m]),
      };
    });

    // 4. row and grand totals over the whole period (pooled)
    rows.forEach((r) => {
      let n = 0, d = 0;
      months.forEach((m) => { const c = r.cells[m]; if (c && c.d > 0) { n += c.n; d += c.d; } });
      r.total = { n: n, d: d, pct: pctOf(n, d) };
      r.selfReported = months.some((m) => r.cells[m] && (r.cells[m].src === 'own' || r.cells[m].src === 'own-pct'));
    });
    rows.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    const tot = (fN, fD) => { let n = 0, d = 0; monthRows.forEach((x) => { if (x[fD] > 0) { n += x[fN]; d += x[fD]; } }); return { n: n, d: d, pct: pctOf(n, d) }; };

    // 5. staff groups: the audit rows' groups, else the hospital record's own group entries
    const groups = GROUPS.map(([k, label]) => {
      const cells = {}; let n = 0, d = 0;
      months.forEach((m) => {
        let cn = 0, cd = 0, any = false;
        // The hospital view counts the audit's groups; a report on chosen departments also
        // counts a department's own group entries (its data, for a month the audit missed).
        rows.forEach((r) => { const c = r.cells[m]; if (!c || !(c.src === 'audit' || (restrict && c.src === 'own'))) return; const x = (r.groups[m] || {})[k]; if (x) { cn += x.n; cd += x.d; any = true; } });
        if (!any && !restrict && sInd && sInd.mGroups && sInd.mGroups[m]) {
          const gn = sInd.mGroups[m][k], gd = sInd.mGroupsDen && sInd.mGroupsDen[m] && sInd.mGroupsDen[m][k];
          if (has(gn) || has(gd)) { cn = Number(gn) || 0; cd = Number(gd) || 0; any = true; }
        }
        if (any) { cells[m] = cell(cn, cd, 'audit'); n += cn; d += cd; }
      });
      return { key: k, label: label, cells: cells, total: { n: n, d: d, pct: pctOf(n, d) } };
    }).filter((g) => g.total.d > 0 || g.total.n > 0);

    return {
      source: src ? { deptKey: src.dep.key, deptName: src.dep.name, indId: src.ind.id, name: src.ind.name } : null,
      bench: benchOf(sInd),
      months: monthRows,
      rows: rows,
      groups: groups,
      total: tot('n', 'd'),
      totalAll: tot('nAll', 'dAll'),
      hasSelfReported: monthRows.some((x) => x.selfReported),
      // true = narrowed to opts.only. Such a report is about those departments, so readers
      // use the *All figures (their audit rows plus their own readings).
      restricted: restrict,
    };
  }

  /* WHO-style band against the hospital target: at/above target = compliant; from 75% (or
     the target, if lower) up to it = needs improvement (re-audit within 2 weeks); below =
     unacceptable (escalate). With a target at or under 75 there is no middle band. */
  function status(pct, bench) {
    if (pct == null || isNaN(pct)) return null;
    const b = (bench == null || isNaN(Number(bench))) ? DEFAULT_BENCH : Number(bench);
    const low = Math.min(75, b);
    if (pct >= b) return { key: 'ok', label: 'Compliant' };
    if (pct >= low && low < b) return { key: 'warn', label: 'Needs improvement' };
    return { key: 'bad', label: 'Unacceptable' };
  }
  // "75–79%" for the interpretation note; null when the target leaves no middle band.
  function improveBand(bench) {
    const b = (bench == null || isNaN(Number(bench))) ? DEFAULT_BENCH : Number(bench);
    const low = Math.min(75, b);
    if (!(low < b)) return null;
    const hi = Math.round((b - (Number.isInteger(b) ? 1 : 0.1)) * 10) / 10;
    return low + '–' + hi + '%';
  }

  const API = { GROUPS: GROUPS, DEFAULT_BENCH: DEFAULT_BENCH, HOSPITAL_ID: HOSPITAL_ID, DEPT_ALIAS: DEPT_ALIAS, normN: normN, canonDept: canonDept, isHHInd: isHHInd, isHospital: isHospital, benchOf: benchOf, findSource: findSource, matchDept: matchDept, pctOf: pctOf, build: build, series: series, totalOf: totalOf, status: status, improveBand: improveBand };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.UNICO_HH = API;
})(typeof window !== 'undefined' ? window : null);
