/* UNICO — Quality Indicator Reference Catalog (NABH/JCI-style definitions).
   Data-driven: built from the LIVE quality dataset (window.qualityData /
   window.QUALITY_SEED — all departments' indicators, now formula-enriched), not a
   hardcoded list. Every unique indicator the hospital tracks is shown once with
   its formula, numerator/denominator definitions, benchmark, goal direction, the
   STANDARD it is based on (WHO / CDC NHSN / NABH / KDOQI / …) and the departments
   that report it. Global-script React — no imports. */

/* ---- normalise a name for de-duplication / matching across departments ---- */
function qcNorm(s) {
  return (s || '').toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/within \d+\s*h(ou)?rs?/g, ' ')
    .replace(/<\s*\d+\s*h/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\b(rate|compliance|cases?|events?|injury|the|of|per|associated)\b/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

/* ---- fuzzy indicator-family matcher (kept for quality-assign.jsx's "Reported by") ---- */
const QC_ALIASES = {
  cauti: ['cauti', 'catheter associated uti', 'urinary'],
  clabsi: ['clabsi', 'central line'],
  vap: ['vap', 'ventilator associated pneumonia', 'vae', 'ventilator associated event'],
  fall: ['patient fall', 'fall'],
  hapu: ['hapu', 'pressure ulcer', 'pressure injury', 'bed sore'],
  phlebitis: ['phlebitis'],
  handhygiene: ['hand hygiene'],
  mederror: ['medication error'],
  reintubation: ['re-intubation', 'reintubation', 're intubation'],
  readmission: ['re-admission', 'readmission', 're admission', 'return to icu'],
  nsi: ['needle stick', 'nsi'],
  ssi: ['ssi', 'surgical site infection'],
};
// Does a seed indicator (by name) report this QI_DEFS-style def?
function qcMatches(def, seedIndName) {
  const a = qcNorm(def.name), b = qcNorm(seedIndName);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length > 3 && (b.includes(a) || a.includes(b))) return true;
  const aliases = QC_ALIASES[def.id] || [];
  const raw = (seedIndName || '').toLowerCase();
  return aliases.some(al => raw.includes(al));
}

/* ---- derive an NABH-style clinical domain from the indicator name ---- */
function qcCategory(ind) {
  if (ind.category) return ind.category;
  const n = (ind.name || '').toLowerCase();
  if (/infection|cauti|clabsi|vap|vae|ssi|phlebitis|sepsis|water quality/.test(n)) return 'Healthcare-Associated Infection';
  if (/hand hygiene/.test(n)) return 'Infection Prevention';
  if (/fall|pressure|hapu|ulcer|bed sore|medication|dvt|thrombosis|catheter|de-?lin|extubat|ett/.test(n)) return 'Patient Safety';
  if (/re-?intubation|re-?admission|return to icu|cardiac arrest|survival|door-to-balloon|adequacy|partograph|fetal|hypotension|vascular|post-?pci|post-?procedure|hematoma/.test(n)) return 'Clinical Outcomes';
  if (/needle stick|nsi|staff/.test(n)) return 'Staff Safety';
  if (/training|induction|bls|certification/.test(n)) return 'Staff Competency';
  if (/volume|census/.test(n)) return 'Activity / Volume';
  return 'Other';
}

function qcMeasureType(ind) {
  const f = ind.formula;
  if (f === 'pct') return 'Percentage';
  if (f === 'rate1000' || f === 'rate100') return 'Rate';
  const t = (ind.valueType || '').toLowerCase();
  if (t.indexOf('%') >= 0) return 'Percentage';
  if (t.startsWith('rate') || t.startsWith('per')) return 'Rate';
  return 'Count';
}
function qcGoalDir(ind) {
  return ind.goalDirection === 'higher_is_better'
    ? { sym: '↑', label: 'Higher is better', tone: '#0090ca' }
    : { sym: '↓', label: 'Lower is better', tone: '#1f9d57' };
}
function qcBenchmark(ind) {
  if (ind.benchmark != null && ind.benchmark !== '') return ind.benchmark;
  const b = ind.benchmarkValue;
  if (b == null || b === '') return '—';
  return `${ind.goalDirection === 'higher_is_better' ? '≥' : '≤'} ${b}${ind.formula === 'pct' ? '%' : ''}`;
}
function qcFormulaText(ind) {
  if (ind.formulaText) return ind.formulaText;
  const f = ind.formula, num = ind.numLabel || ind.name || 'numerator', den = ind.denLabel || 'denominator';
  if (!f || f === 'count' || f === 'direct') return `${ind.name || 'Indicator'} = ${num}`;
  const mult = f === 'rate1000' ? '× 1000' : '× 100';
  return `(${num} ÷ ${den}) ${mult}`;
}
function qcNeedsDen(ind) { const f = ind.formula; return f && f !== 'count' && f !== 'direct'; }

/* ---------------- KPI tile ---------------- */
function QcKpi({ label, val, foot, color }) {
  return (
    <div className="card anim-pop" style={{ padding: '16px 18px', borderLeft: `4px solid ${color}`, display: 'flex', flexDirection: 'column', minHeight: 108 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)' }}>{label}</div>
      <div className="num" style={{ fontSize: 30, fontWeight: 700, color, margin: '8px 0 5px', lineHeight: 1 }}>{val}</div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 'auto' }}>{foot}</div>
    </div>
  );
}

/* ---------------- Detail card for one indicator ---------------- */
function QcDetail({ item, setRoute }) {
  const ind = item.def;
  const dir = qcGoalDir(ind);
  const measure = item.measure;
  const needsDen = qcNeedsDen(ind);
  const Row = ({ label, children }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--line-2)', alignItems: 'baseline' }}>
      <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: .4, fontWeight: 700, color: 'var(--muted)' }}>{label}</div>
      <div style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>{children}</div>
    </div>
  );
  return (
    <div style={{ padding: '4px 2px 8px' }}>
      <div style={{ background: 'var(--blue-50)', border: '1px solid var(--blue-100)', borderRadius: 9, padding: '11px 14px', fontSize: 12.5, color: 'var(--blue-700)', fontFamily: 'IBM Plex Mono', marginBottom: 10 }}>
        ƒ {qcFormulaText(ind)}
      </div>
      <Row label="Numerator">{ind.numLabel || ind.name || '—'}{ind.numeratorDef ? <div style={{ color: 'var(--muted)', fontSize: 11.5 }}>{ind.numeratorDef}</div> : null}</Row>
      <Row label="Denominator">{needsDen ? <span>{ind.denLabel || '—'}{ind.denominatorDef ? <div style={{ color: 'var(--muted)', fontSize: 11.5 }}>{ind.denominatorDef}</div> : null}</span> : <span style={{ color: 'var(--faint)' }}>— (raw event count, no denominator)</span>}</Row>
      <Row label="Unit">{ind.unit || '—'} <span style={{ color: 'var(--faint)' }}>· {measure}-based</span></Row>
      <Row label="Benchmark / Target">{qcBenchmark(ind)}</Row>
      <Row label="Goal direction"><span style={{ color: dir.tone, fontWeight: 700 }}>{dir.sym} {dir.label}</span></Row>
      <Row label="Reporting frequency">{ind.frequency || 'Monthly'}</Row>
      {ind.reference && <Row label="Reference / Standard"><span style={{ color: 'var(--ink)' }}>{ind.reference}</span></Row>}
      <Row label="Reported by">
        {item.depts.length === 0 ? <span style={{ color: 'var(--faint)' }}>No department reports this indicator.</span> : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {item.depts.map(d => (
              <span key={d.key} className="col-chip" title={`Reported as "${d.indName}" — open ${d.name}`}
                onClick={() => setRoute && setRoute({ view: 'qualityDept', dept: d.key })} style={{ cursor: 'pointer' }}>
                <Ic d={I.heart} s={12} />{d.name}
              </span>
            ))}
          </div>
        )}
      </Row>
    </div>
  );
}

/* ---------------- Main catalog screen ---------------- */
function QualityCatalog({ setRoute }) {
  const data = (typeof window.qualityData === 'function' ? window.qualityData() : (window.QUALITY_SEED || []));
  const [q, setQ] = React.useState('');
  const [cat, setCat] = React.useState('all');

  // De-duplicate indicators by normalised name across all departments; collect
  // the reporting departments + a representative (prefer one carrying a reference).
  const groups = {};
  data.forEach(d => (d.indicators || []).forEach(ind => {
    const key = qcNorm(ind.name) || ind.id;
    if (!groups[key]) groups[key] = { rep: ind, name: ind.name, depts: [] };
    groups[key].depts.push({ key: d.key, name: d.name, indName: ind.name });
    if ((!groups[key].rep.reference && ind.reference) || (!groups[key].rep.formula && ind.formula)) groups[key].rep = ind;
  }));
  const items = Object.keys(groups).map(k => {
    const g = groups[k];
    return { id: k, def: g.rep, name: g.name, depts: g.depts, category: qcCategory(g.rep), measure: qcMeasureType(g.rep) };
  }).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  const [open, setOpen] = React.useState(() => (items[0] ? items[0].id : null));

  const categories = [...new Set(items.map(i => i.category))];
  const nRate = items.filter(i => i.measure === 'Rate').length;
  const nCount = items.filter(i => i.measure === 'Count').length;
  const nPct = items.filter(i => i.measure === 'Percentage').length;

  const ql = q.trim().toLowerCase();
  const filtered = items.filter(i => {
    if (cat !== 'all' && i.category !== cat) return false;
    if (!ql) return true;
    const d = i.def;
    return (i.name || '').toLowerCase().includes(ql)
      || i.category.toLowerCase().includes(ql)
      || (d.numLabel || '').toLowerCase().includes(ql)
      || (d.denLabel || '').toLowerCase().includes(ql)
      || (d.reference || '').toLowerCase().includes(ql)
      || (d.unit || '').toLowerCase().includes(ql);
  });

  const grouped = {};
  filtered.forEach(i => { (grouped[i.category] = grouped[i.category] || []).push(i); });
  const groupOrder = Object.keys(grouped).sort();

  const searchSty = { padding: '9px 11px', border: '1px solid var(--line)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', background: '#fff', width: '100%', outline: 'none' };
  const measureTone = { Rate: '#6a52d4', Count: '#0090ca', Percentage: '#3ab5a7' };

  return (
    <div className="grid" style={{ gap: 16 }}>
      <SectionTitle icon={I.doc} title="Quality Indicator Catalog"
        sub="NABH / JCI-style reference — formula, numerator, denominator, benchmark, standard & reporting departments for every tracked indicator"
        right={<button className="btn sm" onClick={() => setRoute && setRoute({ view: 'quality' })}><Ic d={I.heart} s={15} />Dashboard</button>} />

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))' }}>
        <QcKpi label="Indicators" val={fmt(items.length)} foot="unique indicators tracked" color="#0090ca" />
        <QcKpi label="Categories" val={fmt(categories.length)} foot="clinical / safety domains" color="#6a52d4" />
        <QcKpi label="Rate-based" val={fmt(nRate)} foot="per 1000 / per 100" color={measureTone.Rate} />
        <QcKpi label="Count vs %" val={`${nCount} · ${nPct}`} foot="count-based · percentage" color="#1f9d57" />
      </div>

      <div className="card"><div className="card-b" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--faint)', pointerEvents: 'none' }}><Ic d={I.search} s={15} /></span>
            <input style={{ ...searchSty, paddingLeft: 32 }} placeholder="Search by name, category, reference, numerator…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <span style={{ fontSize: 11.5, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{filtered.length} of {items.length} shown</span>
        </div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          {['all', ...categories].map(c => {
            const on = cat === c;
            const n = c === 'all' ? items.length : items.filter(i => i.category === c).length;
            return (
              <span key={c} onClick={() => setCat(c)}
                style={{ cursor: 'pointer', fontSize: 11.5, fontWeight: 600, padding: '5px 11px', borderRadius: 20, border: '1px solid ' + (on ? 'var(--blue)' : 'var(--line)'), background: on ? 'var(--blue)' : 'var(--panel-2)', color: on ? '#fff' : 'var(--ink-2)' }}>
                {c === 'all' ? 'All indicators' : c} <span style={{ opacity: .7 }}>· {n}</span>
              </span>
            );
          })}
        </div>
      </div></div>

      {filtered.length === 0 && (
        <div className="card"><div className="card-b" style={{ textAlign: 'center', color: 'var(--faint)', padding: '34px', fontSize: 13 }}>No indicators match your search.</div></div>
      )}

      {groupOrder.map(gname => (
        <div key={gname} className="card" style={{ overflow: 'hidden' }}>
          <div className="card-h"><h3>{gname}</h3><span className="sub">{grouped[gname].length} indicator{grouped[gname].length !== 1 ? 's' : ''}</span><span className="spacer" /></div>
          <div>
            {grouped[gname].map(item => {
              const isOpen = open === item.id;
              const dir = qcGoalDir(item.def);
              return (
                <div key={item.id} style={{ borderBottom: '1px solid var(--line-2)' }}>
                  <div onClick={() => setOpen(isOpen ? null : item.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer', background: isOpen ? 'var(--blue-50)' : 'transparent' }}>
                    <Ic d={I.chevR} s={15} style={{ transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .15s', color: 'var(--faint)', flexShrink: 0 }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{item.name || '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'IBM Plex Mono', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{qcFormulaText(item.def)}</div>
                    </div>
                    <span className="tag" style={{ flexShrink: 0 }}>{item.def.unit || item.measure}</span>
                    <span className="chip" style={{ flexShrink: 0, background: measureTone[item.measure] + '1c', color: measureTone[item.measure] }}>{item.measure}</span>
                    <span className="chip" style={{ flexShrink: 0, background: dir.tone + '1c', color: dir.tone }} title={dir.label}>{dir.sym}</span>
                    <span className="tag num" style={{ flexShrink: 0 }} title="Departments reporting this indicator">{item.depts.length} dept{item.depts.length !== 1 ? 's' : ''}</span>
                  </div>
                  {isOpen && (
                    <div style={{ padding: '2px 16px 12px 43px', background: 'var(--panel-2)' }}>
                      <QcDetail item={item} setRoute={setRoute} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

window.QualityCatalog = QualityCatalog;
