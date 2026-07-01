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

  function loadOverlay() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      return (s && typeof s === 'object' && s.depts) ? s : { depts: {} };
    } catch (e) { return { depts: {} }; }
  }
  function saveOverlay(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { } }

  // Formula-based value: count = numerator; rate1000/rate100/pct = num/den × mult.
  function qiFormulaCompute(formula, num, den) {
    const n = Number(num) || 0, d = Number(den) || 0;
    if (formula === 'count') return n;
    if (!d) return 0;
    if (formula === 'rate1000') return Math.round((n / d) * 1000 * 100) / 100;
    return Math.round((n / d) * 100 * 100) / 100; // rate100 / pct
  }

  // Object-valued indicator fields that deep-merge (rather than replace) on patch.
  const NESTED = ['quarters', 'quarterRemarks', 'months', 'monthRemarks', 'qNum', 'qDen', 'mNum', 'mDen'];

  // Definition fields overwritten by an authoritative correction (window.QI_CORRECTIONS,
  // keyed by indicator name). VALUE fields (quarters/qNum/qDen/mNum/mDen/months) are
  // never touched, so entered data is preserved.
  const CORRECT_FIELDS = ['formula', 'numLabel', 'denLabel', 'numeratorDef', 'denominatorDef', 'unit', 'benchmark', 'benchmarkValue', 'benchmarkNote', 'goalDirection', 'reference', 'referenceUrl'];
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
      QS.forEach(q => {
        const ms = QUARTER_MONTHS[q] || [];
        const haveMonths = ms.some(m => ind.mNum && ind.mNum[m] != null && ind.mNum[m] !== '');
        let num, den;
        if (haveMonths) {
          num = ms.reduce((s, m) => s + (Number((ind.mNum || {})[m]) || 0), 0);
          den = ms.reduce((s, m) => s + (Number((ind.mDen || {})[m]) || 0), 0);
        } else {
          const n = (ind.qNum || {})[q];
          if (n == null || n === '') return; // no data this quarter → leave as-is (null)
          num = n; den = (ind.qDen || {})[q];
        }
        q2[q] = qiFormulaCompute(f, num, den);
      });
      ind.quarters = q2;
    } else if (ind.months && Object.keys(ind.months).length) {
      // Direct value: roll the quarter up from months (sum for Count, avg for %).
      const q2 = Object.assign({}, ind.quarters || {});
      QS.forEach(q => { const r = rollupQuarter(ind, q); if (r !== undefined) q2[q] = r; });
      ind.quarters = q2;
    }
    return ind;
  }

  function mergeDept(seedDept, ov) {
    if (!ov) return seedDept;
    const removed = new Set(ov.indRemoved || []);
    const patches = ov.indPatches || {};
    const inds = (seedDept.indicators || [])
      .filter(i => !removed.has(i.id))
      .map(i => mergeIndicator(i, patches[i.id]));
    (ov.indAdded || []).forEach(a => { if (!removed.has(a.id)) inds.push(mergeIndicator(a, patches[a.id])); });
    const dept = Object.assign({}, seedDept, { indicators: inds });
    if (ov.executive) dept.executive = Object.assign({}, seedDept.executive || {}, ov.executive);
    if (ov.meta) dept.meta = Object.assign({}, seedDept.meta || {}, ov.meta);
    return dept;
  }

  // Merged, read-anywhere snapshot (reads localStorage fresh each call).
  function qualityData() {
    const ov = loadOverlay();
    return (window.QUALITY_SEED || []).map(d => mergeDept(d, ov.depts[d.key]));
  }

  // React hook for screens that EDIT quality data.
  function useQualityStore() {
    const [overlay, setOverlay] = React.useState(loadOverlay);
    React.useEffect(() => { saveOverlay(overlay); }, [overlay]);
    const merged = React.useMemo(
      () => (window.QUALITY_SEED || []).map(d => mergeDept(d, overlay.depts[d.key])),
      [overlay]
    );

    const patchDept = (key, fn) => setOverlay(o => {
      const depts = Object.assign({}, o.depts);
      depts[key] = fn(depts[key] ? Object.assign({}, depts[key]) : {});
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

      addIndicator: (deptKey, ind) => patchDept(deptKey, cur => ({
        ...cur, indAdded: [...(cur.indAdded || []), ind],
      })),

      removeIndicator: (deptKey, indId) => patchDept(deptKey, cur => {
        const added = cur.indAdded || [];
        if (added.some(a => a.id === indId)) {
          const patches = Object.assign({}, cur.indPatches || {}); delete patches[indId];
          return Object.assign({}, cur, { indAdded: added.filter(a => a.id !== indId), indPatches: patches });
        }
        return Object.assign({}, cur, { indRemoved: [...(cur.indRemoved || []), indId] });
      }),

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
  function qualitySlug(s) {
    return 'ind-' + String(s || 'indicator').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) + '-' + Math.random().toString(36).slice(2, 6);
  }

  window.qualityData = qualityData;
  window.useQualityStore = useQualityStore;
  window.qiFormulaCompute = qiFormulaCompute;
  window.QUALITY_QUARTER_MONTHS = QUARTER_MONTHS;
  window.QUALITY_MONTH_QUARTER = MONTH_QUARTER;
  window.qualityIsPct = isPct;
  window.qualitySlug = qualitySlug;
})();
