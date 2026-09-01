/* UNICO — Quality Indicators editable overlay store.
   Merges the read-only QUALITY_SEED with user edits saved in localStorage so the
   entire Quality module (dashboard, department detail, entry, CAPA, exports) reads
   ONE connected, editable dataset.

   The merged objects keep the exact shape of QUALITY_SEED entries, so existing
   readers work unchanged once pointed at qualityData()/useQualityStore().

   Persistence: localStorage 'unico_quality_v2' (auto-mirrored to disk by preload).
   (v2: reset for the NQI monthly dataset; any stale v1 overlay is ignored.) */
(function () {
  const KEY = 'unico_quality_v2';
  const QS = ['Q1', 'Q2', 'Q3', 'Q4'];

  // Canonical quarter <-> month mapping — the NQI report's 12-month fiscal year
  // Jun-2025 … May-2026, three months per quarter (matches quality.jsx QMONTHS).
  const QUARTER_MONTHS = {
    Q1: ['Jun-25', 'Jul-25', 'Aug-25'],
    Q2: ['Sep-25', 'Oct-25', 'Nov-25'],
    Q3: ['Dec-25', 'Jan-26', 'Feb-26'],
    Q4: ['Mar-26', 'Apr-26', 'May-26'],
  };
  const MONTH_QUARTER = {};
  Object.keys(QUARTER_MONTHS).forEach(q => QUARTER_MONTHS[q].forEach(m => { MONTH_QUARTER[m] = q; }));

  // Fiscal-year (Jun–May) helpers so quarters can be rolled up PER YEAR, not just for the
  // hardcoded 2025-26 above. A month's quarter depends only on its month name, so any year works.
  const FY_MONS = ['Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May'];
  function fyOfKeyS(key){ const p = String(key||'').split('-'); const mi = FY_MONS.indexOf(p[0]); const yy = parseInt(p[1],10); if(mi<0||isNaN(yy)) return null; return 2000+yy-(mi>=7?1:0); }
  function fyQuarterMonths(startYear){ const yy=String(startYear%100).padStart(2,'0'); const ny=String((startYear+1)%100).padStart(2,'0'); return { Q1:['Jun-'+yy,'Jul-'+yy,'Aug-'+yy], Q2:['Sep-'+yy,'Oct-'+yy,'Nov-'+yy], Q3:['Dec-'+yy,'Jan-'+ny,'Feb-'+ny], Q4:['Mar-'+ny,'Apr-'+ny,'May-'+ny] }; }
  function fysInInd(ind){ const set=new Set(); ['months','mNum','mDen'].forEach(f=>{ const o=ind && ind[f]; if(o) Object.keys(o).forEach(k=>{ if(o[k]!=null&&o[k]!==''){ const fy=fyOfKeyS(k); if(fy!=null) set.add(fy); } }); }); return [...set]; }

  function isPct(ind) {
    const t = ((ind && ind.valueType) || '').toString().toLowerCase();
    return t.indexOf('%') >= 0 || t.startsWith('per');
  }

  // Roll a quarter up from its months when monthly data is present; else undefined
  // (meaning: use the directly-entered quarter value).
  function rollupQuarter(ind, q) {
    const months = (ind && ind.months) || {};
    const ms = QUARTER_MONTHS[q] || [];
    const vals = ms.map(m => months[m]).filter(v => v != null && v !== '');
    if (!vals.length) return undefined;
    const nums = vals.map(Number);
    if (isPct(ind)) return Math.round((nums.reduce((s, x) => s + x, 0) / nums.length) * 100) / 100;
    return nums.reduce((s, x) => s + x, 0);
  }

  // Compute {Q1..Q4} for an explicit quarter->months map, from MONTHLY data only. Used to build
  // per-fiscal-year quarter rollups. Mirrors the formula/direct logic in mergeIndicator.
  function computeQuartersFor(ind, QM) {
    const f = ind.formula; const out = {};
    if (f && f !== 'direct') {
      const needDen = f !== 'count';
      Object.keys(QM).forEach(q => {
        const ms = QM[q] || [];
        const have = ms.some(m => ind.mNum && ind.mNum[m] != null && ind.mNum[m] !== '' && (!needDen || (ind.mDen && ind.mDen[m] != null && ind.mDen[m] !== '')));
        let v = null;
        if (have) {
          const num = ms.reduce((s, m) => s + (Number((ind.mNum || {})[m]) || 0), 0);
          const den = ms.reduce((s, m) => s + (Number((ind.mDen || {})[m]) || 0), 0);
          v = (needDen && !den) ? null : qiFormulaCompute(f, num, den);
        }
        if (v == null) {
          // Approved zero-event / denominator-less readings store their computed value
          // in months{} — roll those up (mean for rates/%, sum for counts) so a quarter
          // of "0 events" reads as 0 on benchmark instead of not-reported.
          const vals = ms.map(m => (ind.months || {})[m]).filter(x => x != null && x !== '').map(Number);
          if (vals.length) v = f === 'count' ? vals.reduce((s, x) => s + x, 0) : Math.round((vals.reduce((s, x) => s + x, 0) / vals.length) * 100) / 100;
        }
        if (v != null) out[q] = v;
      });
    } else {
      const months = ind.months || {};
      Object.keys(QM).forEach(q => {
        const vals = (QM[q] || []).map(m => months[m]).filter(v => v != null && v !== '').map(Number);
        if (!vals.length) return;
        out[q] = isPct(ind) ? Math.round((vals.reduce((s, x) => s + x, 0) / vals.length) * 100) / 100 : vals.reduce((s, x) => s + x, 0);
      });
    }
    return out;
  }

  function loadOverlay() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      return (s && typeof s === 'object' && s.depts) ? s : { depts: {} };
    } catch (e) { return { depts: {} }; }
  }
  function saveOverlay(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { } }

  // Formula-based value: count = numerator; rate1000/rate100/pct = num/den × mult;
  // avg = num/den (mean, no multiplier).
  function qiFormulaCompute(formula, num, den) {
    const n = Number(num) || 0, d = Number(den) || 0;
    if (formula === 'count') return n;
    if (!d) return 0;
    if (formula === 'rate1000') return Math.round((n / d) * 1000 * 100) / 100;
    // mean / average = numerator ÷ denominator (no multiplier), e.g. average length of stay
    // = total patient-hours ÷ number of patients. Quarter roll-ups sum num & den first, so
    // this yields the opportunity-weighted average, not a mean-of-means.
    if (formula === 'avg') return Math.round((n / d) * 100) / 100;
    return Math.round((n / d) * 100 * 100) / 100; // rate100 / pct
  }

  // Object-valued indicator fields that deep-merge (rather than replace) on patch.
  // incidents/capa are month-keyed too, so editing one month's incident report from
  // the admin drill-down preserves every other month's.
  const NESTED = ['quarters', 'quarterRemarks', 'months', 'monthRemarks', 'qNum', 'qDen', 'mNum', 'mDen', 'incidents', 'capa', 'mGroups'];

  // Definition fields overwritten by an authoritative correction (window.QI_CORRECTIONS,
  // keyed by indicator name). VALUE fields (quarters/qNum/qDen/mNum/mDen/months) are
  // never touched, so entered data is preserved.
  const CORRECT_FIELDS = ['formula', 'numLabel', 'denLabel', 'numeratorDef', 'denominatorDef', 'unit', 'benchmark', 'benchmarkValue', 'benchmarkNote', 'goalDirection', 'reference', 'referenceUrl', 'denAdminOnly', 'victimField'];
  function correctedBase(seedInd) {
    try {
      const C = (typeof window !== 'undefined') && window.QI_CORRECTIONS;
      if (!C) return seedInd;
      const corr = C[String((seedInd && seedInd.name) || '').trim().toLowerCase().replace(/\s+/g, ' ')];
      if (!corr) return seedInd;
      const base = Object.assign({}, seedInd);
      CORRECT_FIELDS.forEach(k => { if (corr[k] !== undefined && corr[k] !== null && corr[k] !== '') base[k] = corr[k]; });
      // Keep the legacy `valueType` in sync with the corrected formula (several UI
      // surfaces still derive the %/measure from it), and drop any stale cached
      // `formulaText` so downstream screens recompute it from the corrected labels.
      if (corr.formula) base.valueType = corr.formula === 'pct' ? '%' : (corr.formula === 'count' ? 'Count' : 'Rate');
      delete base.formulaText;
      return base;
    } catch (e) { return seedInd; }
  }

  function mergeIndicator(seedInd, patch) {
    // Apply the authoritative correction to the BASE so an explicit user edit (patch)
    // still wins, but every uncorrected indicator gets the right formula/reference.
    const corrected = correctedBase(seedInd);
    const ind = Object.assign({}, corrected, patch || {});
    if (patch) NESTED.forEach(k => { if (patch[k]) ind[k] = Object.assign({}, corrected[k] || {}, patch[k]); });

    const f = ind.formula;
    if (f && f !== 'direct') {
      // Formula indicators: compute each quarter from monthly num/den (aggregate
      // rates by SUMMING numerators & denominators) or from the direct quarter num/den.
      const q2 = Object.assign({}, ind.quarters || {});
      const needDen = f !== 'count'; // rate/pct/rate1000 require a denominator to be meaningful
      QS.forEach(q => {
        const ms = QUARTER_MONTHS[q] || [];
        // A month only counts toward the rollup if it has a numerator AND (for rate/pct) a
        // denominator — otherwise summing empty denominators yields den=0 → a false on-benchmark 0.
        const haveMonths = ms.some(m => ind.mNum && ind.mNum[m] != null && ind.mNum[m] !== ''
          && (!needDen || (ind.mDen && ind.mDen[m] != null && ind.mDen[m] !== '')));
        let num, den, hadInput = haveMonths;
        if (haveMonths) {
          num = ms.reduce((s, m) => s + (Number((ind.mNum || {})[m]) || 0), 0);
          den = ms.reduce((s, m) => s + (Number((ind.mDen || {})[m]) || 0), 0);
        } else {
          const n = (ind.qNum || {})[q];
          if (n != null && n !== '') { hadInput = true; num = n; den = (ind.qDen || {})[q]; }
        }
        // No denominator for a rate/pct ⇒ not computable from num/den…
        let v = hadInput ? ((needDen && !den) ? null : qiFormulaCompute(f, num, den)) : null;
        if (v == null) {
          // …but approved zero-event / denominator-less readings store their computed
          // value in months{} — roll those up so "0 events" isn't shown as not-reported.
          const vals = ms.map(m => (ind.months || {})[m]).filter(x => x != null && x !== '').map(Number);
          if (vals.length) v = f === 'count' ? vals.reduce((s, x) => s + x, 0) : Math.round((vals.reduce((s, x) => s + x, 0) / vals.length) * 100) / 100;
        }
        if (v != null) q2[q] = v; else if (hadInput) q2[q] = null; // explicit null only when something was entered
      });
      ind.quarters = q2;
    } else if (ind.months && Object.keys(ind.months).length) {
      // Direct value: roll the quarter up from months (sum for Count, avg for %).
      const q2 = Object.assign({}, ind.quarters || {});
      QS.forEach(q => { const r = rollupQuarter(ind, q); if (r !== undefined) q2[q] = r; });
      ind.quarters = q2;
    }
    // Additive: quarters keyed PER FISCAL YEAR, computed from that year's monthly data. FY-aware
    // readers use these; the flat ind.quarters above stays as-is for legacy/no-FY readers.
    const fys = fysInInd(ind);
    if (fys.length) { const byFy = {}; fys.forEach(fy => { byFy[fy] = computeQuartersFor(ind, fyQuarterMonths(fy)); }); ind.quartersByFy = byFy; }
    return ind;
  }

  // The ONE canonical display name for a quality department = its linked Statistics
  // department name (via window.DEPTMAP / __UNICO_DEPT_MAP__). Resolves by the quality
  // doc's deptId link, else by mapping its key. Falls back to the doc's own name.
  function canonicalDeptName(seedDept) {
    try {
      if (typeof window === 'undefined' || !window.DEPTMAP) return null;
      const id = (seedDept && seedDept.deptId) || window.DEPTMAP.idFromQk(seedDept && seedDept.key);
      if (!id) return null;
      const nm = window.DEPTMAP.nameFromId(id);
      if (nm && nm !== id) return nm; // only a REAL resolved name — never fall back to the raw id
    } catch (e) { }
    return null;
  }

  function mergeDept(seedDept, ov) {
    let dept;
    if (!ov) {
      // No overlay for this department — STILL run each indicator through mergeIndicator:
      // it applies the QI_CORRECTIONS definition fixes and computes quarter rollups. The
      // old pass-through skipped both, so a never-edited department kept wrong formulas
      // (e.g. NSI shown as a plain count with no admin denominator control).
      dept = Object.assign({}, seedDept, { indicators: (seedDept.indicators || []).map(i => mergeIndicator(i)) });
    } else {
      const removed = new Set(ov.indRemoved || []);
      const patches = ov.indPatches || {};
      const kept = (seedDept.indicators || []).filter(i => !removed.has(i.id));
      const inds = kept.map(i => mergeIndicator(i, patches[i.id]));
      // An overlay-added entry whose id ALSO exists in the seed used to be pushed as a
      // SECOND row: the department rendered the same indicator twice, both rows sharing
      // one indPatches entry, so editing either moved both. Fold it onto the seed copy
      // instead — the added definition wins, but the seed's recorded months/incidents
      // survive underneath, so nothing that was ever entered disappears.
      const rawById = new Map(kept.map(i => [String(i.id), i]));
      const idxById = new Map(kept.map((i, ix) => [String(i.id), ix]));
      (ov.indAdded || []).forEach(a => {
        if (removed.has(a.id)) return;
        const key = String(a.id);
        const base = rawById.get(key);
        let raw = a;
        if (base) {
          raw = Object.assign({}, base, a);
          NESTED.forEach(k => { if (base[k] || a[k]) raw[k] = Object.assign({}, base[k] || {}, a[k] || {}); });
        }
        const merged = mergeIndicator(raw, patches[a.id]);
        const at = idxById.get(key);
        if (at == null) { idxById.set(key, inds.length); inds.push(merged); } else { inds[at] = merged; }
      });
      dept = Object.assign({}, seedDept, { indicators: inds });
      if (ov.executive) dept.executive = Object.assign({}, seedDept.executive || {}, ov.executive);
      if (ov.meta) dept.meta = Object.assign({}, seedDept.meta || {}, ov.meta);
    }
    // Show the single canonical Statistics name everywhere quality is rendered (keeps the
    // `key` as the stable identity — only the displayed `name` becomes canonical).
    const cn = canonicalDeptName(seedDept);
    if (cn && cn !== dept.name) dept = Object.assign({}, dept, { name: cn });
    return dept;
  }

  // ---- Hand-hygiene audit → each department's own HH indicator ----
  // The WHO hand-hygiene audit is submitted ONCE (hospital-wide) with a per-department
  // breakdown stored on the hospital indicator: mDeptBreakdown[month] =
  // [{dept:'<display name>', g:{nurse:{n,d},doctor,pca,other}}]. The departments' own
  // "Hand Hygiene Compliance" indicators stayed empty, so every dept row showed
  // "not reported" even though the audit covered that department. This pass fills a
  // department's HH indicator from its audit rows — only for months the department has
  // not entered itself (its own entry always wins) — so dashboards, scorecards and
  // reports read one connected dataset.
  function applyHHDeptBreakdown(list) {
    try {
      const isHH = (ind) => /hand\s*hygiene/i.test((ind && ind.name) || '');
      let src = null;
      list.forEach((d) => (d.indicators || []).forEach((ind) => {
        if (isHH(ind) && ind.mDeptBreakdown && Object.keys(ind.mDeptBreakdown).length) {
          if (!src || /overall|hospital/i.test(d.name + ' ' + ind.name)) src = { dep: d, ind: ind };
        }
      }));
      if (!src) return list;
      const normN = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
      // The hand-hygiene audit stored each dept's rows under its ORIGINAL name; several
      // depts were later renamed to their canonical Quality name, which broke the plain
      // name match (a renamed dept silently stopped receiving its audited compliance).
      // Map the old audit names -> canonical so those departments match again.
      const HH_DEPT_ALIAS = {
        'endoscopy': 'endoscopic suite',
        'level 10 ward': 'ipd cabin level 10',
        'level 9 ward': 'ipd cabin level 9',
        'labour / delivery / recovery': 'labour , delivery & recovery room',
        'ct ot': 'ctvs ot',
        'ct icu': 'ctvs icu',
      };
      const canonDept = (s) => { const n = normN(s); return HH_DEPT_ALIAS[n] || n; };
      const bd = src.ind.mDeptBreakdown;
      return list.map((d) => {
        if (d === src.dep) return d;
        const idx = (d.indicators || []).findIndex(isHH);
        // A dept with audited rows but NO hand-hygiene indicator of its own (e.g. CT ICU)
        // gets a synthetic one cloned from the hospital-wide source — otherwise its
        // audited compliance renders as a blank '—' column in every heatmap/report.
        // Once the dept records a real HH indicator, findIndex hits that one instead
        // and the synthetic simply stops being created.
        const hh = idx >= 0 ? d.indicators[idx] : {
          id: 'ind-hh-from-audit', name: 'Hand Hygiene Compliance', formula: 'pct', unit: '%', valueType: '%',
          numLabel: src.ind.numLabel || 'Compliant moments', denLabel: src.ind.denLabel || 'Observed moments',
          benchmark: src.ind.benchmark || '≥ 90 %', benchmarkValue: (src.ind.benchmarkValue != null ? src.ind.benchmarkValue : 90),
          goalDirection: 'higher_is_better', months: {}, mNum: {}, mDen: {},
        };
        let months = null, mNum = null, mDen = null;
        Object.keys(bd).forEach((mk) => {
          const rows = bd[mk]; if (!Array.isArray(rows)) return;
          // Match by canonical name (alias-mapped) OR by the dept's stable key, so a
          // later display-name change never breaks a department's audit distribution.
          const row = rows.find((r) => r && (canonDept(r.dept) === canonDept(d.name) || normN(r.dept) === normN(d.key) || canonDept(r.dept) === normN(d.key))); if (!row) return;
          let n = 0, den = 0; const g = row.g || {};
          ['nurse', 'doctor', 'pca', 'other'].forEach((k) => { const x = g[k] || {}; n += Number(x.n) || 0; den += Number(x.d) || 0; });
          if (!(den > 0)) return; // this dept was not audited that month (0/0 row)
          const own = (hh.mNum && hh.mNum[mk] != null && hh.mNum[mk] !== '') || (hh.months && hh.months[mk] != null && hh.months[mk] !== '');
          if (own) return;
          if (!months) { months = Object.assign({}, hh.months || {}); mNum = Object.assign({}, hh.mNum || {}); mDen = Object.assign({}, hh.mDen || {}); }
          // fill BOTH shapes: months (formula 'direct' reads it) and mNum/mDen ('pct' reads those)
          months[mk] = Math.round((n / den) * 10000) / 100;
          mNum[mk] = n; mDen[mk] = den;
        });
        if (!months) return d;
        const patched = Object.assign({}, hh, { months: months, mNum: mNum, mDen: mDen, hhFromAudit: true });
        // refresh the per-year quarter rollups so quarter-based views see the filled months
        const fys = fysInInd(patched);
        if (fys.length) { const byFy = {}; fys.forEach((fy) => { byFy[fy] = computeQuartersFor(patched, fyQuarterMonths(fy)); }); patched.quartersByFy = byFy; }
        const inds = (d.indicators || []).slice();
        if (idx >= 0) inds[idx] = patched; else inds.push(patched);
        return Object.assign({}, d, { indicators: inds });
      });
    } catch (e) { return list; }
  }

  // Merged, read-anywhere snapshot (reads localStorage fresh each call).
  function qualityData() {
    const ov = loadOverlay();
    return applyHHDeptBreakdown((window.QUALITY_SEED || []).map(d => mergeDept(d, ov.depts[d.key])));
  }

  // React hook for screens that EDIT quality data.
  function useQualityStore() {
    const [overlay, setOverlay] = React.useState(loadOverlay);
    // window.QUALITY_SEED is swapped in place by refreshQualitySeed (approval / tab
    // refocus); the memo only watches the overlay, so bump to rebuild from fresh seed.
    const [rev, setRev] = React.useState(0);
    React.useEffect(() => { const h = () => setRev(r => r + 1); window.addEventListener('unico:data-refreshed', h); return () => window.removeEventListener('unico:data-refreshed', h); }, []);
    React.useEffect(() => { saveOverlay(overlay); }, [overlay]);
    const merged = React.useMemo(
      () => applyHHDeptBreakdown((window.QUALITY_SEED || []).map(d => mergeDept(d, overlay.depts[d.key]))),
      [overlay, rev]
    );

    // A missing dept key must never become a write. `depts[key]` string-coerces an
    // undefined/null key into the literal bucket "undefined", which no department ever
    // reads back — so the edit silently vanishes AND leaves an orphan slice behind that
    // accumulates in the overlay forever. Every mutation below funnels through here, so
    // this one guard covers add/remove/patch/restore/executive/meta.
    const patchDept = (key, fn) => setOverlay(o => {
      const k = (key == null) ? '' : String(key);
      if (!k || k === 'undefined' || k === 'null') {
        try { console.warn('[quality-store] ignored an edit with no department key:', key); } catch (e) {}
        return o;
      }
      const depts = Object.assign({}, o.depts);
      depts[k] = fn(depts[k] ? Object.assign({}, depts[k]) : {});
      return Object.assign({}, o, { depts });
    });

    // Persistent master catalogue of admin-defined indicators (survives even
    // before any department reports them). Lives alongside `depts` in the same
    // overlay blob, so it mirrors to disk/MongoDB through the very same bridge.
    const catalog = overlay.catalog || [];
    const catNorm = (s) => (s || '').toString().trim().toLowerCase().replace(/\s+/g, ' ');

    return {
      depts: merged,
      catalog,
      get: (key) => merged.find(d => d.key === key),
      isEdited: (key) => !!overlay.depts[key],

      // master catalogue: add (de-duped by name) / remove a standalone indicator def
      addCatalogIndicator: (def) => setOverlay(o => {
        const nn = catNorm(def && def.name);
        if (!nn) return o;
        const list = o.catalog || [];
        if (list.some(c => catNorm(c.name) === nn)) return o; // already defined
        return Object.assign({}, o, { catalog: [...list, def] });
      }),
      removeCatalogIndicator: (name) => setOverlay(o => {
        const nn = catNorm(name);
        const list = o.catalog || [];
        return Object.assign({}, o, { catalog: list.filter(c => catNorm(c.name) !== nn) });
      }),

      patchIndicator: (deptKey, indId, patch) => patchDept(deptKey, cur => {
        const all = Object.assign({}, cur.indPatches || {});
        const prev = all[indId] || {};
        const next = Object.assign({}, prev, patch);
        NESTED.forEach(k => { if (patch[k]) next[k] = Object.assign({}, prev[k] || {}, patch[k]); });
        all[indId] = next;
        return Object.assign({}, cur, { indPatches: all });
      }),

      // Adding is an explicit "this department reports this indicator", so it must also
      // UN-HIDE the id if a previous unassign put it in indRemoved — otherwise the
      // freshly added indicator is filtered straight back out by the removed-set when
      // the dept is merged, and it just never appears. Re-adding the same id replaces
      // the entry rather than stacking a second twin next to it.
      addIndicator: (deptKey, ind) => patchDept(deptKey, cur => Object.assign({}, cur, {
        indAdded: [...(cur.indAdded || []).filter(a => String(a.id) !== String(ind.id)), ind],
        indRemoved: (cur.indRemoved || []).filter(x => String(x) !== String(ind.id)),
      })),

      removeIndicator: (deptKey, indId) => patchDept(deptKey, cur => {
        const added = cur.indAdded || [];
        if (added.some(a => a.id === indId)) {
          const patches = Object.assign({}, cur.indPatches || {}); delete patches[indId];
          return Object.assign({}, cur, { indAdded: added.filter(a => a.id !== indId), indPatches: patches });
        }
        return Object.assign({}, cur, { indRemoved: [...(cur.indRemoved || []), indId] });
      }),

      // Un-hide a SEED indicator a previous unassign put in indRemoved. The assign
      // matrix uses this on re-tick so the department's ORIGINAL indicator (with all
      // its recorded data) comes back, instead of minting an empty twin with a new id.
      restoreIndicator: (deptKey, indId) => patchDept(deptKey, cur => Object.assign({}, cur, {
        indRemoved: (cur.indRemoved || []).filter(x => String(x) !== String(indId)),
      })),

      setExecutive: (deptKey, patch) => patchDept(deptKey, cur => ({
        ...cur, executive: Object.assign({}, cur.executive || {}, patch),
      })),
      setMeta: (deptKey, patch) => patchDept(deptKey, cur => ({
        ...cur, meta: Object.assign({}, cur.meta || {}, patch),
      })),

      resetDept: (deptKey) => setOverlay(o => {
        const depts = Object.assign({}, o.depts); delete depts[deptKey];
        return Object.assign({}, o, { depts });
      }),
    };
  }

  // helpers used across the Quality screens
  // The id is the DATA KEY and is also what makes an indicator "the same indicator"
  // across departments (the console's Common-indicator edit scope, the assignment
  // matrix and every report group by id). This used to end in Math.random(), so
  // adding the SAME indicator in two departments always minted two different ids —
  // that is how needle-stick fragmented into ind-needle-stick-sharps-injury-t6z2 /
  // -3hww / -f212 / -wzr4 …, one orphan per department. The slug is now DERIVED FROM
  // THE NAME, so the same indicator lands on the same id everywhere.
  // Ids only have to be unique WITHIN one department, so pass that department's
  // existing ids as `taken` and a numeric suffix is added only on a real collision.
  function qualitySlug(s, taken) {
    const base = 'ind-' + String(s || 'indicator').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '');
    const used = taken instanceof Set ? taken : new Set(Array.isArray(taken) ? taken : []);
    if (!used.has(base)) return base;
    let n = 2;
    while (used.has(base + '-' + n)) n++;
    return base + '-' + n;
  }

  window.qualityData = qualityData;
  window.useQualityStore = useQualityStore;
  window.qiFormulaCompute = qiFormulaCompute;
  window.QUALITY_QUARTER_MONTHS = QUARTER_MONTHS;
  window.QUALITY_MONTH_QUARTER = MONTH_QUARTER;
  window.qualityIsPct = isPct;
  window.qualitySlug = qualitySlug;
})();
