/* UNICO — Assign Indicators by Department (administrator matrix).

   One grid where an administrator picks WHICH quality indicators each department
   reports. Toggling a cell ASSIGNS the indicator (added blank, ready for Monthly
   Entry) or UNASSIGNS it from that department.

   Columns are EVERY distinct quality indicator the hospital tracks — one column
   per distinct indicator name (deduped) — drawn from three sources and unified:
     • the live dataset — every indicator any department already reports (so all
       ~42 distinct measures appear as first-class, assignable columns, not just
       the 12 standard ones), plus
     • the persistent MASTER CATALOGUE — indicators the admin defines here that
       survive even before any department reports them (window.useQualityStore →
       addCatalogIndicator / removeCatalogIndicator), plus
     • the 12 STANDARD formula defs (QI_DEFS) as a baseline, added only for any
       standard family no department reports yet.
   Columns matching a standard family (QI_DEFS) are tagged "standard"; the rest
   are "custom" (removable). The All / None row buttons act on the WHOLE set.

   Writes through the SAME editable overlay store as the per-department editor
   (window.useQualityStore → addIndicator / removeIndicator), so every change
   flows to Monthly Entry, the Dashboard, Scorecard, Trends, Reports & CAPA and
   persists in localStorage (mirrored to MongoDB by the web/native bridge).

   Globals used (classic non-module scripts share the global scope):
     React, I, Ic, SectionTitle, fmt, window.useQualityStore, window.UI,
     window.qualitySlug, QI_DEFS (quality-entry.jsx), qedLibrary (quality-edit.jsx),
     qcMatches (quality-catalog.jsx — fuzzy indicator↔department-name matcher). */
(function () {
  const QA_QS = ['Q1', 'Q2', 'Q3', 'Q4'];
  const QA_FORMULAS = [['direct', 'Direct value (type the value)'], ['count', 'Count of events'], ['rate1000', 'Rate per 1000'], ['rate100', 'Rate per 100'], ['pct', 'Percentage (%)']];
  const QA_DIRS = [['lower_is_better', '↓ Lower is better'], ['higher_is_better', '↑ Higher is better']];
  const qaFmt = (x) => { try { return typeof fmt === 'function' ? fmt(x) : x; } catch (e) { return x; } };
  const qaNorm = (s) => (s || '').toString().trim().toLowerCase().replace(/\s+/g, ' ');

  // Fallback library shape from a QI_DEFS entry (used only if qedLibrary() is
  // unavailable). Mirrors quality-edit.jsx → qedLibrary().
  function qaShapeFromDef(def) {
    const formula = def.formula || 'count';
    const pct = formula === 'pct';
    return {
      name: def.name, formula,
      numLabel: def.num || 'Numerator', denLabel: def.den || 'Denominator',
      valueType: pct ? '%' : (formula === 'count' ? 'Count' : 'Rate'),
      unit: def.unit || '',
      benchmark: `${def.dir === 'higher' ? '≥' : '≤'} ${def.benchmark}${pct ? '%' : ''}${def.unit ? ' ' + def.unit : ''}`,
      benchmarkValue: typeof def.benchmark === 'number' ? def.benchmark : '',
      goalDirection: def.dir === 'higher' ? 'higher_is_better' : 'lower_is_better',
      quarters: { Q1: null, Q2: null, Q3: null, Q4: null }, quarterRemarks: {}, qNum: {}, qDen: {}, months: {}, monthRemarks: {}, mNum: {}, mDen: {}, remarks: '',
    };
  }

  // Blank-data add-shape for a CUSTOM indicator defined in the Add form.
  function qaShapeFromCustomDef(d) {
    const f = d.formula || 'direct';
    const pct = f === 'pct';
    const bv = (d.benchmarkValue === '' || d.benchmarkValue == null) ? '' : Number(d.benchmarkValue);
    return {
      name: d.name, formula: f,
      numLabel: d.numLabel || 'Numerator', denLabel: d.denLabel || 'Denominator',
      valueType: f === 'direct' ? (d.valueType || 'Count') : (pct ? '%' : (f === 'count' ? 'Count' : 'Rate')),
      unit: d.unit || '',
      benchmark: bv !== '' ? `${d.goalDirection === 'higher_is_better' ? '≥' : '≤'} ${bv}${pct ? '%' : ''}${d.unit ? ' ' + d.unit : ''}` : '',
      benchmarkValue: bv,
      goalDirection: d.goalDirection || 'lower_is_better',
      quarters: { Q1: null, Q2: null, Q3: null, Q4: null }, quarterRemarks: {}, qNum: {}, qDen: {}, months: {}, monthRemarks: {}, mNum: {}, mDen: {}, remarks: '',
    };
  }

  // Blank-data add-shape derived from an indicator a department already carries
  // (so assigning that custom indicator to another department keeps its config).
  function qaShapeFromInd(ind) {
    return {
      name: ind.name, formula: ind.formula || 'direct',
      numLabel: ind.numLabel || 'Numerator', denLabel: ind.denLabel || 'Denominator',
      valueType: ind.valueType || 'Count', unit: ind.unit || '',
      benchmark: ind.benchmark || '', benchmarkValue: (ind.benchmarkValue == null ? '' : ind.benchmarkValue),
      goalDirection: ind.goalDirection || 'lower_is_better',
      quarters: { Q1: null, Q2: null, Q3: null, Q4: null }, quarterRemarks: {}, qNum: {}, qDen: {}, months: {}, monthRemarks: {}, mNum: {}, mDen: {}, remarks: '',
    };
  }

  // The assignable STANDARD set: each catalogue indicator paired with its add-shape.
  // qedLibrary() derives from QI_DEFS in the SAME order, so indexes align.
  function qaLibrary() {
    const defs = (typeof QI_DEFS !== 'undefined' && Array.isArray(QI_DEFS)) ? QI_DEFS : [];
    let shapes = [];
    try { if (typeof qedLibrary === 'function') shapes = qedLibrary(); } catch (e) { /* fall back below */ }
    return defs.map((def, i) => ({
      def, shape: shapes[i] || qaShapeFromDef(def),
      key: def.id || ('ind' + i), name: def.name || ('Indicator ' + (i + 1)),
      dir: def.dir, unit: def.unit || '',
    }));
  }

  // ---- safe indicator ↔ standard-def matcher --------------------------------
  // Catalog's qcMatches() matches aliases as UN-anchored substrings, so short
  // fragments cross-match ("ssi" ⊂ "re-admiSSIon", "nsi" ⊂ "hypoteNSIon"). That is
  // harmless for the read-only Catalog but DANGEROUS here (a column could resolve
  // to the wrong row and unassign/delete it). We re-match with WORD BOUNDARIES and
  // resolve each department's indicators to defs 1:1 (greedy by score) so two
  // columns never map to the same row and the real row is never orphaned.
  const QA_ALIASES = (typeof QC_ALIASES !== 'undefined' && QC_ALIASES) ? QC_ALIASES : {};
  function qaNormName(s) {
    if (typeof qcNorm === 'function') { try { return qcNorm(s); } catch (e) { /* fall through */ } }
    return (s || '').toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function qaWordHit(raw, term) {
    const t = String(term || '').toLowerCase().trim(); if (!t) return false;
    const esc = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try { return new RegExp('(^|[^a-z0-9])' + esc + '($|[^a-z0-9])').test(raw); }
    catch (e) { return raw.indexOf(t) >= 0; }
  }
  // Match strength of a standard def against one department indicator (0 = none).
  function qaScore(def, ind) {
    const a = qaNormName(def.name), b = qaNormName(ind.name);
    if (!a || !b) return 0;
    if (a === b) return 3;                                          // exact (normalised) name
    if (a.length > 3 && (b.includes(a) || a.includes(b))) return 2; // containment
    const raw = (ind.name || '').toLowerCase();
    if ((QA_ALIASES[def.id] || []).some(al => qaWordHit(raw, al))) return 1; // word-boundary alias
    return 0;
  }
  // Resolve a department's indicators to standard defs 1:1 (greedy, highest score
  // first). Returns { byKey: {libKey -> indicator}, used: Set<indicator id> }.
  function qaResolve(dept, lib) {
    const inds = (dept && dept.indicators) || [];
    const pairs = [];
    lib.forEach(it => inds.forEach(ind => { const sc = qaScore(it.def, ind); if (sc > 0) pairs.push({ k: it.key, ind, sc }); }));
    pairs.sort((p, q) => q.sc - p.sc);
    const byKey = {}, used = new Set();
    pairs.forEach(p => { if (byKey[p.k] || used.has(p.ind.id)) return; byKey[p.k] = p.ind; used.add(p.ind.id); });
    return { byKey, used };
  }

  // Does an indicator hold any saved values? (guards against silent data loss on unassign)
  function qaHasData(ind) {
    if (!ind) return false;
    const q = ind.quarters || {};
    if (QA_QS.some(k => q[k] != null && q[k] !== '')) return true;
    const filled = o => o && Object.keys(o).some(k => o[k] != null && o[k] !== '');
    return filled(ind.months) || filled(ind.mNum) || filled(ind.mDen) || filled(ind.qNum) || filled(ind.qDen);
  }

  function qaNewId(name) {
    return window.qualitySlug ? window.qualitySlug(name)
      : 'ind-' + String(name || 'indicator').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) + '-' + Math.random().toString(36).slice(2, 6);
  }
  function qaAssignItem(Q, deptKey, item) {
    Q.addIndicator(deptKey, Object.assign({}, item.shape, { id: qaNewId(item.name), name: item.name }));
  }
  function qaToast(msg, kind) { try { if (window.UI && window.UI.toast) window.UI.toast(msg, kind || 'success'); } catch (e) { } }
  async function qaConfirm(opts, fallbackMsg) {
    try { return await window.UI.confirm(opts); }
    catch (e) { return window.confirm(fallbackMsg || opts.message || 'Are you sure?'); }
  }

  /* ---------------- Add-custom-indicator panel ---------------- */
  function QAAddCustom({ onAdd, onClose, taken }) {
    const { useState } = React;
    const [name, setName] = useState('');
    const [formula, setFormula] = useState('direct');
    const [dir, setDir] = useState('lower_is_better');
    const [bench, setBench] = useState('');
    const [unit, setUnit] = useState('');
    const [numLabel, setNumLabel] = useState('');
    const [denLabel, setDenLabel] = useState('');
    const [err, setErr] = useState('');
    const isFormula = formula !== 'direct';
    const needsDen = isFormula && formula !== 'count';
    const txt = { padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 7, fontSize: 12.5, fontFamily: 'inherit', width: '100%', outline: 'none', background: '#fff' };

    const submit = () => {
      const nm = name.trim();
      if (!nm) return setErr('Name is required.');
      if (taken(qaNorm(nm))) return setErr('An indicator with that name already exists (standard or custom).');
      onAdd({ name: nm, formula, goalDirection: dir, benchmarkValue: bench === '' ? '' : Number(bench), unit: unit.trim(), numLabel: numLabel.trim(), denLabel: denLabel.trim() });
    };
    return (
      <div style={{ border: '1px solid var(--blue-100)', borderRadius: 10, background: 'var(--blue-50)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Ic d={I.plus} s={15} c="var(--blue)" /><b style={{ fontSize: 12.5 }}>New custom indicator</b>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>becomes a new column you can assign per department</span>
          <span className="spacer" style={{ flex: 1 }} /><button className="icon-btn" style={{ width: 24, height: 24 }} onClick={onClose}><Ic d={I.x} s={13} /></button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
          <div className="field" style={{ gridColumn: '1 / -1' }}><label>Indicator name *</label><input style={txt} value={name} onChange={e => { setName(e.target.value); setErr(''); }} placeholder="e.g. Patient Satisfaction Score" /></div>
          <div className="field"><label>How is it measured?</label><select style={txt} value={formula} onChange={e => setFormula(e.target.value)}>{QA_FORMULAS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
          <div className="field"><label>Goal direction</label><select style={txt} value={dir} onChange={e => setDir(e.target.value)}>{QA_DIRS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
          <div className="field"><label>Benchmark value</label><input style={txt} type="number" value={bench} onChange={e => setBench(e.target.value)} placeholder="optional — e.g. 0 or 90" /></div>
          <div className="field"><label>Unit</label><input style={txt} value={unit} onChange={e => setUnit(e.target.value)} placeholder="optional — e.g. %, per 1000" /></div>
          {isFormula && <div className="field"><label>Numerator label</label><input style={txt} value={numLabel} onChange={e => setNumLabel(e.target.value)} placeholder="e.g. Events" /></div>}
          {needsDen && <div className="field"><label>Denominator label</label><input style={txt} value={denLabel} onChange={e => setDenLabel(e.target.value)} placeholder="e.g. Patient days" /></div>}
        </div>
        {err && <div style={{ fontSize: 12, color: '#b32339', background: 'var(--neg-bg)', borderRadius: 7, padding: '7px 10px' }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn sm" onClick={onClose}>Cancel</button>
          <button className="btn pri sm" onClick={submit}><Ic d={I.check} s={14} />Add indicator</button>
        </div>
      </div>
    );
  }

  /* ---------------- sticky bottom horizontal scrollbar ----------------
     Wraps a wide, horizontally-scrolling card and mirrors its scroll position
     onto a thin scrollbar PINNED to the bottom of the viewport (position:sticky;
     bottom:0). So you can scroll the matrix sideways without first scrolling all
     the way down to the table's own scrollbar. The scrolling ancestor is .content
     (theme.css) — placing the pinned bar outside any overflow:hidden card lets
     bottom:0 resolve against that viewport. */
  function QAStickyXScroll({ children, minWidth }) {
    const { useRef, useState, useEffect } = React;
    const bodyRef = useRef(null), barRef = useRef(null), lock = useRef(false);
    const [w, setW] = useState(minWidth || 0);
    const [show, setShow] = useState(false);
    const syncFrom = (src, dst) => { if (lock.current) return; lock.current = true; if (src.current && dst.current) dst.current.scrollLeft = src.current.scrollLeft; lock.current = false; };
    useEffect(() => {
      const el = bodyRef.current; if (!el) return;
      const measure = () => { const sw = el.scrollWidth; setW(sw); setShow(sw > el.clientWidth + 1); };
      measure();
      let ro; try { ro = new ResizeObserver(measure); ro.observe(el); } catch (e) { /* older browsers */ }
      window.addEventListener('resize', measure);
      const t = setTimeout(measure, 80); // re-measure once fonts/layout settle
      return () => { try { ro && ro.disconnect(); } catch (e) { } window.removeEventListener('resize', measure); clearTimeout(t); };
    });
    return (
      React.createElement(React.Fragment, null,
        <div ref={bodyRef} onScroll={() => syncFrom(bodyRef, barRef)} className="card" style={{ overflowX: 'auto', overflowY: 'hidden' }}>
          {children}
        </div>,
        <div ref={barRef} onScroll={() => syncFrom(barRef, bodyRef)} aria-hidden="true"
          style={{
            position: 'sticky', bottom: 0, zIndex: 6, overflowX: 'auto', overflowY: 'hidden',
            height: show ? 16 : 0, marginTop: show ? -8 : 0, background: 'var(--panel)',
            borderTop: show ? '1px solid var(--line)' : 'none', borderRadius: '0 0 var(--radius-lg) var(--radius-lg)',
            boxShadow: show ? '0 -5px 12px rgba(8,18,33,.06)' : 'none', transition: 'height .12s ease',
          }}>
          <div style={{ width: w || minWidth || 1, height: 1 }} />
        </div>
      )
    );
  }

  /* ---------------- main screen ---------------- */
  function QualityAssign({ setRoute }) {
    const { useState } = React;
    const Q = window.useQualityStore();
    const lib = React.useMemo(() => qaLibrary(), []);
    const depts = Q.depts || [];
    const [q, setQ] = useState('');
    const [onlyGaps, setOnlyGaps] = useState(false);
    const [showAdd, setShowAdd] = useState(false);
    // Admin-defined indicators that PERSIST as columns even before any department
    // reports them (stored in the overlay → mirrored to MongoDB). See quality-store.js.
    const catalog = Q.catalog || [];

    // 1:1 resolution of every department's indicators to the standard defs.
    // Memoised on the store snapshot (depts identity only changes when the overlay
    // changes), so typing in the search box doesn't re-run the whole match grid.
    const res = React.useMemo(() => {
      const r = {}; depts.forEach(d => { r[d.key] = qaResolve(d, lib); }); return r;
    }, [depts, lib]);
    const resOf = (d) => res[d.key] || { byKey: {}, used: new Set() };

    // CUSTOM columns: indicators a department carries that NO standard def claimed,
    // plus any the admin just defined here. Keyed by normalised name.
    const customMap = new Map(); // normName -> { name, sample? , def? }
    depts.forEach(d => { const used = resOf(d).used; (d.indicators || []).forEach(ind => {
      if (used.has(ind.id)) return;
      const nn = qaNorm(ind.name); if (!nn || customMap.has(nn)) return;
      customMap.set(nn, { name: ind.name, sample: ind });
    }); });
    catalog.forEach(cd => { const nn = qaNorm(cd.name); if (nn && !customMap.has(nn)) customMap.set(nn, { name: cd.name, def: cd }); });

    // unified columns: standard first, then custom
    const stdItems = lib.map(it => ({
      key: 'std:' + it.key, name: it.name, isCustom: false, unit: it.unit, higher: it.dir === 'higher',
      find: (d) => resOf(d).byKey[it.key] || null, shape: it.shape,
    }));
    const customItems = [...customMap.values()].map(c => {
      const nn = qaNorm(c.name);
      const shape = c.def ? qaShapeFromCustomDef(c.def) : qaShapeFromInd(c.sample);
      return {
        key: 'cus:' + nn, name: c.name, isCustom: true, nn, unit: shape.unit || '', higher: shape.goalDirection === 'higher_is_better',
        // exclude indicators already claimed by a standard column (no double-display)
        find: (d) => ((d.indicators || []).find(ind => qaNorm(ind.name) === nn && !resOf(d).used.has(ind.id)) || null), shape,
      };
    });
    const cols = [...stdItems, ...customItems];
    const taken = (nn) => cols.some(it => qaNorm(it.name) === nn);

    const stdOn = (d) => stdItems.reduce((n, it) => n + (it.find(d) ? 1 : 0), 0);
    const cusOn = (d) => customItems.reduce((n, it) => n + (it.find(d) ? 1 : 0), 0);
    const assignedCount = (d) => stdOn(d) + cusOn(d);

    const ql = q.trim().toLowerCase();
    const filtered = depts.filter(d => {
      if (ql && !((d.name || '').toLowerCase().includes(ql) || (d.key || '').toLowerCase().includes(ql))) return false;
      if (onlyGaps && assignedCount(d) >= cols.length) return false;
      return true;
    });

    // KPIs
    const totalCells = depts.length * cols.length;
    const totalAssigned = depts.reduce((s, d) => s + assignedCount(d), 0);
    const coverage = totalCells ? Math.round(totalAssigned * 100 / totalCells) : 0;

    // column state across FILTERED departments: 'all' | 'none' | 'some'
    const colState = (it) => {
      if (!filtered.length) return 'none';
      let on = 0; filtered.forEach(d => { if (it.find(d)) on++; });
      return on === 0 ? 'none' : on === filtered.length ? 'all' : 'some';
    };

    const toggleCell = async (dept, it) => {
      const cur = it.find(dept);
      if (cur) {
        if (qaHasData(cur)) {
          const ok = await qaConfirm({
            title: 'Unassign indicator?',
            message: `"${it.name}" has saved data in ${dept.name}. Unassigning removes the indicator and its values from this department.`,
            danger: true, confirmLabel: 'Unassign & delete',
          }, `Unassign "${it.name}" from ${dept.name}? Saved data will be removed.`);
          if (!ok) return;
        }
        Q.removeIndicator(dept.key, cur.id);
        qaToast(`Unassigned ${it.name} from ${dept.name}`);
      } else {
        qaAssignItem(Q, dept.key, it);
        qaToast(`Assigned ${it.name} to ${dept.name}`);
      }
    };

    // bulk: set one indicator across ALL filtered departments
    const toggleColumn = async (it) => {
      const st = colState(it);
      if (st === 'all') {
        const withData = filtered.filter(d => { const c = it.find(d); return c && qaHasData(c); });
        if (withData.length) {
          const ok = await qaConfirm({ title: `Unassign ${it.name} from all shown?`, message: `${withData.length} shown department(s) have saved data for "${it.name}". Unassigning deletes those values.`, danger: true, confirmLabel: 'Unassign from all' }, `Unassign ${it.name} from all shown departments? Saved data will be removed.`);
          if (!ok) return;
        }
        filtered.forEach(d => { const c = it.find(d); if (c) Q.removeIndicator(d.key, c.id); });
        qaToast(`Unassigned ${it.name} from ${filtered.length} department(s)`);
      } else {
        let n = 0; filtered.forEach(d => { if (!it.find(d)) { qaAssignItem(Q, d.key, it); n++; } });
        qaToast(`Assigned ${it.name} to ${n} department(s)`);
      }
    };

    // bulk: set EVERY indicator column for one department
    const toggleRow = async (dept, on) => {
      if (on) {
        let n = 0; cols.forEach(it => { if (!it.find(dept)) { qaAssignItem(Q, dept.key, it); n++; } });
        qaToast(`Assigned ${n} indicator(s) to ${dept.name}`);
      } else {
        const withData = cols.filter(it => { const c = it.find(dept); return c && qaHasData(c); });
        if (withData.length) {
          const ok = await qaConfirm({ title: `Clear all indicators from ${dept.name}?`, message: `${withData.length} indicator(s) in ${dept.name} have saved data. Clearing removes them and their values.`, danger: true, confirmLabel: 'Clear all' }, `Clear all indicators from ${dept.name}? Saved data will be removed.`);
          if (!ok) return;
        }
        cols.forEach(it => { const c = it.find(dept); if (c) Q.removeIndicator(dept.key, c.id); });
        qaToast(`Cleared all indicators from ${dept.name}`);
      }
    };

    // remove a custom indicator column entirely (from every department + this session)
    const removeCustom = async (it) => {
      const withData = depts.filter(d => { const c = it.find(d); return c && qaHasData(c); });
      const assignedTo = depts.filter(d => it.find(d)).length;
      const ok = await qaConfirm({
        title: `Remove custom indicator "${it.name}"?`,
        message: assignedTo ? `Removes it from ${assignedTo} department(s)${withData.length ? ` — ${withData.length} have saved data that will be deleted` : ''}.` : 'Removes this custom indicator column.',
        danger: true, confirmLabel: 'Remove',
      }, `Remove custom indicator "${it.name}" from all departments?`);
      if (!ok) return;
      depts.forEach(d => { const c = it.find(d); if (c) Q.removeIndicator(d.key, c.id); });
      Q.removeCatalogIndicator(it.name); // drop it from the persistent master catalogue too
      qaToast(`Removed custom indicator "${it.name}"`);
    };

    const onAddCustom = (def) => {
      Q.addCatalogIndicator(def); // persists immediately — survives reload even before it's assigned
      setShowAdd(false);
      qaToast(`Added "${def.name}" to the catalogue — now tick the departments that report it`);
    };

    const Kpi = ({ label, val, foot, color }) => (
      <div className="card anim-pop" style={{ padding: '15px 18px', borderLeft: `4px solid ${color}`, display: 'flex', flexDirection: 'column', minHeight: 96 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)' }}>{label}</div>
        <div className="num" style={{ fontSize: 28, fontWeight: 700, color, margin: '6px 0 0', lineHeight: 1 }}>{val}</div>
        {foot && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{foot}</div>}
      </div>
    );

    const cellTd = { textAlign: 'center', padding: '6px 4px' };
    const box = (on, partial, custom) => ({
      display: 'inline-grid', placeItems: 'center', width: 26, height: 26, borderRadius: 7, cursor: 'pointer',
      fontSize: 14, fontWeight: 800, userSelect: 'none', transition: 'background .12s,color .12s',
      background: on ? (custom ? 'rgba(106,82,212,.12)' : 'var(--pos-bg)') : partial ? 'var(--blue-50)' : '#eef1f5',
      color: on ? (custom ? '#6a52d4' : 'var(--pos)') : partial ? 'var(--blue-700)' : '#b6c0cc',
      border: '1px solid ' + (on ? (custom ? '#6a52d4' : 'var(--pos)') : partial ? 'var(--blue-100)' : 'transparent'),
    });

    return (
      <div className="grid" style={{ gap: 16 }}>
        <SectionTitle icon={I.grid} title="Assign Indicators by Department"
          sub="Administrator tool — choose which indicators each department reports, and add your own custom fields. Changes save automatically and flow to Quality Data Entry, the Dashboard & Reports."
          right={<><button className="btn pri sm" onClick={() => setShowAdd(s => !s)}><Ic d={I.plus} s={15} />Add custom indicator</button>
            <button className="btn sm" onClick={() => setRoute && setRoute({ view: 'qualityCatalog' })}><Ic d={I.doc} s={15} />Catalog</button>
            <button className="btn sm" onClick={() => setRoute && setRoute({ view: 'quality' })}><Ic d={I.heart} s={15} />Dashboard</button></>} />

        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
          <Kpi label="Departments" val={qaFmt(depts.length)} foot="in the quality dataset" color="#0090ca" />
          <Kpi label="Indicators" val={qaFmt(cols.length)} foot={`${stdItems.length} standard · ${customItems.length} custom`} color="#6a52d4" />
          <Kpi label="Assignments" val={qaFmt(totalAssigned)} foot="department × indicator" color="#1f9d57" />
          <Kpi label="Coverage" val={coverage + '%'} foot="of the full matrix" color="#3ab5a7" />
        </div>

        {showAdd && <QAAddCustom onAdd={onAddCustom} onClose={() => setShowAdd(false)} taken={taken} />}

        <div className="card" style={{ padding: '12px 14px', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 11px', width: 260, color: 'var(--faint)' }}>
            <Ic d={I.search} s={15} />
            <input placeholder="Search department…" value={q} onChange={e => setQ(e.target.value)} style={{ border: 0, background: 'transparent', outline: 'none', fontFamily: 'inherit', fontSize: 13, color: 'var(--ink)', width: '100%' }} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--ink-2)', cursor: 'pointer' }}>
            <input type="checkbox" checked={onlyGaps} onChange={e => setOnlyGaps(e.target.checked)} />Only departments missing some indicators
          </label>
          <span className="spacer" style={{ flex: 1 }} />
          <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{filtered.length} of {depts.length} shown · click a cell to assign / unassign</span>
        </div>

        <QAStickyXScroll minWidth={220 + cols.length * 64}>
            <table className="tbl" style={{ minWidth: 220 + cols.length * 64 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', position: 'sticky', left: 0, background: 'var(--panel)', zIndex: 2, minWidth: 220 }}>Department</th>
                  {cols.map(it => {
                    const st = colState(it);
                    return (
                      <th key={it.key} title={`${it.name}${it.unit ? ' · ' + it.unit : ''} · ${it.higher ? '↑ higher is better' : '↓ lower is better'}${it.isCustom ? ' · custom' : ''} · click to assign to all shown`}
                        style={{ textAlign: 'center', verticalAlign: 'bottom', minWidth: 64, maxWidth: 88, lineHeight: 1.2 }}>
                        <div onClick={() => toggleColumn(it)} style={{ cursor: 'pointer' }}>
                          {it.isCustom && <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: .4, color: '#6a52d4', textTransform: 'uppercase' }}>custom</div>}
                          <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink-2)', whiteSpace: 'normal' }}>{it.name}</div>
                        </div>
                        <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                          <span style={box(st === 'all', st === 'some', it.isCustom)} onClick={() => toggleColumn(it)}>{st === 'all' ? '✓' : st === 'some' ? '–' : ''}</span>
                          {it.isCustom && <span className="icon-btn danger" style={{ width: 20, height: 20, display: 'inline-grid' }} title="Remove this custom indicator" onClick={(e) => { e.stopPropagation(); removeCustom(it); }}><Ic d={I.x} s={11} /></span>}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={cols.length + 1} style={{ textAlign: 'center', color: 'var(--faint)', padding: '30px', fontSize: 13 }}>No departments match.</td></tr>
                )}
                {filtered.map(d => {
                  const total = assignedCount(d);
                  const allOn = total >= cols.length;
                  return (
                    <tr key={d.key}>
                      <td style={{ textAlign: 'left', position: 'sticky', left: 0, background: '#fff', zIndex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontWeight: 600, color: 'var(--ink)', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                              title={`Open ${d.name} editor`} onClick={() => setRoute && setRoute({ view: 'qualityEdit', dept: d.key })}>{d.name}</div>
                            <div style={{ fontSize: 10.5, color: 'var(--faint)' }}>{total}/{cols.length} indicators{customItems.length ? ` · ${cusOn(d)} custom` : ''}</div>
                          </div>
                          <div style={{ display: 'flex', gap: 3 }}>
                            <button className="btn sm" style={{ padding: '3px 7px' }} title="Assign every indicator" onClick={() => toggleRow(d, true)} disabled={allOn}>All</button>
                            <button className="btn sm" style={{ padding: '3px 7px' }} title="Clear all indicators" onClick={() => toggleRow(d, false)} disabled={total === 0}>None</button>
                          </div>
                        </div>
                      </td>
                      {cols.map(it => {
                        const cur = it.find(d);
                        const on = !!cur;
                        return (
                          <td key={it.key} style={cellTd}>
                            <span style={box(on, false, it.isCustom)} onClick={() => toggleCell(d, it)}
                              title={on ? `Assigned${qaHasData(cur) ? ' · has data' : ''} — click to unassign` : 'Not assigned — click to assign'}>
                              {on ? '✓' : ''}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
        </QAStickyXScroll>

        <div style={{ fontSize: 11.5, color: 'var(--muted)', padding: '0 2px' }}>
          <Ic d={I.doc} s={13} /> Every distinct indicator the hospital tracks is a column here — drag the <b style={{ color: 'var(--ink-2)' }}>scrollbar pinned at the bottom</b> to reach them all. Assigned indicators start blank — fill their monthly values in <b style={{ color: 'var(--ink-2)' }}>Quality Data Entry</b>. <b style={{ color: 'var(--ink-2)' }}>All</b> / <b style={{ color: 'var(--ink-2)' }}>None</b> assign or clear the whole set for a department. Custom indicators you add are saved to the catalogue and kept even before any department reports them.
        </div>
      </div>
    );
  }

  window.QualityAssign = QualityAssign;
})();
