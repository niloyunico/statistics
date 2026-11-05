/* Nursing KPI — the report as a PowerPoint deck, in the Nursing Department's own style:
 * the UNICO template background of "KPI for Nursing Department.pptx" (server/kpi/deck-bg.jpg),
 * its navy #00293A / blue #008FCB / teal #37B4A6 tables, and its per-KPI layout (Objective ·
 * Current · Target · Variance · Action Plan · Formula · Tracking Frequency · Remarks).
 * Every chart is a NATIVE PowerPoint chart, so it stays editable after download.
 *
 *   full     title · scorecard · status by pillar (3D) · achievement vs target (3D) ·
 *            per pillar: a divider, then one slide per KPI (the deck's table + a 12-month trend
 *            against the target) · open action plans · summary & sign-off · thank you.
 *   summary  title · scorecard · status by pillar (3D) · one slide per pillar · sign-off · thank you.
 *
 * Input is the report object from server/kpi.js (rows built by kpi-core buildRows), so the
 * deck shows exactly the figures, targets and statuses the screen shows.
 */
const path = require('path');
const K = require('../renderer/unico/kpi-core.js');

const NAVY = '00293A', BLUE = '008FCB', TEAL = '37B4A6', INK = '16202E', MUTED = '5B6878', LINE = 'C9D3DE', ZEBRA = 'F4F7FA';
const ST = { met: '1F9D57', near: 'E0A21E', off: 'D23A52', notarget: '7B8796', nodata: 'A3ADBA', notstarted: 'A3ADBA' };
const ST_BG = { met: 'E7F6ED', near: 'FFF6E0', off: 'FDE4E8', notarget: 'EEF2F6', nodata: 'F3F5F8', notstarted: 'F6F8FA' };
const LVL = { error: 'D23A52', warn: 'E0A21E', info: '7B8796' };
const SRC_LABEL = { approved: 'Approved', 'overlay-edit': 'Console edit', audit: 'Audit', own: 'Own reading', covered: 'Covered by audit', 'not-audited': 'Not audited', 'not-observed': 'Not observed', missing: 'MISSING', partial: 'No denominator', 'den-zero': 'Denominator 0', 'carried-den': 'Headcount carried', manual: 'Entered' };
const who = (x) => [x && x.reviewedBy, x && x.by].filter(Boolean)[0] || '';
const shortDate = (t) => (t ? new Date(t).toLocaleDateString('en-GB', { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'short' }) : '');

/* One KPI's evidence over the period, unit by unit: Σ numerator, Σ denominator, the unit's own
   value, where its figures came from, who approved them. */
function periodUnits(row, months) {
  const by = new Map();
  months.forEach((m) => {
    const ev = row.evidence && row.evidence[m];
    (ev ? ev.units : []).forEach((u) => {
      if (!by.has(u.key)) by.set(u.key, { key: u.key, name: u.name, num: 0, den: 0, hasNum: false, hasDen: false, used: false, expected: false, sources: new Set(), approvers: new Set(), months: 0 });
      const x = by.get(u.key);
      if (u.used) { if (K.has(u.num)) { x.num += Number(u.num); x.hasNum = true; } if (K.has(u.den)) { x.den += Number(u.den); x.hasDen = true; } x.used = true; x.months++; }
      x.expected = x.expected || !!u.expected;
      x.sources.add(SRC_LABEL[u.source] || u.source);
      if (u.submission) x.approvers.add((u.submission.reviewedBy || '?') + ' ' + shortDate(u.submission.reviewedAt));
      else if (u.overlayEdited) x.approvers.add('console: ' + (u.overlayEdited.by || 'not recorded'));
    });
  });
  return [...by.values()].map((x) => Object.assign(x, { value: x.used && x.hasDen ? K.computeValue(row.formula, x.num, x.den) : null }));
}
const FONT = 'Calibri';
const BG = path.join(__dirname, 'kpi', 'deck-bg.jpg');
const THANKS = path.join(__dirname, 'kpi', 'deck-thanks.jpg');
const hex = (c) => String(c || '').replace('#', '').toUpperCase() || MUTED;
const cut = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };
const when = (t) => new Date(t || Date.now()).toLocaleDateString('en-GB', { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'long', year: 'numeric' });

function build(report, opts) {
  const PptxGenJS = require('pptxgenjs'); // lazy: only this export pays for it
  const o = opts || {};
  // 'calc' = the full deck plus a calculation slide per KPI and a data-quality slide.
  const withCalc = o.style === 'calc';
  const style = o.style === 'summary' ? 'summary' : 'full';
  const cfg = K.cfgOf(o.cfg);
  const rows = report.rows || [];
  const sum = report.summary || K.summarize(rows);
  const period = K.fmtRange(report.from, report.to);
  const pillars = cfg.pillars.filter((p) => rows.some((r) => r.pillar === p.id))
    .concat(rows.some((r) => !cfg.pillars.find((p) => p.id === r.pillar)) ? [K.pillarOf(cfg, 'other')] : []);
  const rowsOf = (p) => rows.filter((r) => (cfg.pillars.find((x) => x.id === r.pillar) ? r.pillar === p.id : p.id === 'other'));
  const fv = (r, v) => K.fmt(r, v);

  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE'; // 13.333 × 7.5 in, the deck's 16:9
  pptx.author = o.by || 'UNICO';
  pptx.company = cfg.hospitalName;
  pptx.title = cfg.reportTitle + ' — ' + period;
  pptx.subject = 'Nursing KPI report';
  pptx.defineSlideMaster({
    title: 'KPI', background: { path: BG },
    objects: [{ text: { text: cfg.reportTitle + '  ·  ' + period + (report.state === 'final' ? '' : '  ·  draft'), options: { x: 0.55, y: 7.02, w: 8, h: 0.24, fontFace: FONT, fontSize: 8, color: MUTED } } }],
    slideNumber: { x: 12.35, y: 7.0, w: 0.5, h: 0.26, fontFace: FONT, fontSize: 8, color: MUTED },
  });
  pptx.defineSlideMaster({ title: 'THANKS', background: { path: THANKS } });

  const slide = () => pptx.addSlide({ masterName: 'KPI' });
  const heading = (s, title, kicker, color) => {
    if (kicker) s.addText(kicker.toUpperCase(), { x: 0.6, y: 0.32, w: 9.2, h: 0.3, fontFace: FONT, fontSize: 10.5, bold: true, color: hex(color || BLUE), charSpacing: 1.5 });
    s.addText(title, { x: 0.6, y: kicker ? 0.6 : 0.42, w: 9.4, h: 0.62, fontFace: FONT, fontSize: 25, bold: true, color: NAVY, fit: 'shrink' });
    s.addShape(pptx.ShapeType.rect, { x: 0.62, y: kicker ? 1.24 : 1.08, w: 1.1, h: 0.06, fill: { color: hex(color || TEAL) }, line: { color: hex(color || TEAL) } });
  };
  const head = (t, extra) => ({ text: t, options: Object.assign({ fill: { color: NAVY }, color: 'FFFFFF', bold: true, fontSize: 9.5, align: 'center', valign: 'middle' }, extra || {}) });
  const cell = (t, extra) => ({ text: t == null ? '' : String(t), options: Object.assign({ fontSize: 9, color: INK, valign: 'middle' }, extra || {}) });
  const stCell = (st) => cell(K.STATUS[st].label, { bold: true, color: ST[st], fill: { color: ST_BG[st] }, align: 'center' });
  const trendTxt = (d) => (d === 'improving' ? '▲ improving' : d === 'worsening' ? '▼ worsening' : d === 'steady' ? '● steady' : '—');
  const zebra = (rowsArr) => rowsArr.map((r, i) => (i % 2 ? r.map((c) => (c.options && c.options.fill ? c : Object.assign({}, c, { options: Object.assign({}, c.options, { fill: { color: ZEBRA } }) }))) : r));
  const tableOpts = (x, y, w, colW, extra) => Object.assign({ x, y, w, colW, fontFace: FONT, border: { type: 'solid', pt: 0.5, color: LINE }, margin: 0.05, autoPage: true, autoPageRepeatHeader: true, autoPageHeaderRows: 1, newSlideStartY: 1.45 }, extra || {});

  /* ---- 1. title ---- */
  {
    const s = slide();
    s.addText(cfg.reportTitle, { x: 1.4, y: 2.15, w: 10.5, h: 1.0, fontFace: FONT, fontSize: 40, bold: true, color: NAVY });
    s.addText((report.from === report.to ? 'Monthly report — ' : 'Report for ') + period, { x: 1.4, y: 3.15, w: 10.5, h: 0.6, fontFace: FONT, fontSize: 22, color: BLUE });
    const cyc = report.cycle || K.cycleOf(report.to, cfg);
    s.addText(cfg.hospitalName + '  ·  ' + cyc.label + (cyc.monthNo ? ', month ' + cyc.monthNo + ' of ' + cyc.of : '') + '  ·  ' + rows.length + ' KPIs in ' + pillars.length + ' pillars',
      { x: 1.4, y: 3.8, w: 10.5, h: 0.4, fontFace: FONT, fontSize: 13, color: MUTED });
    const chips = [['met', sum.met], ['near', sum.near], ['off', sum.off], ['nodata', sum.nodata + (sum.notarget || 0)]];
    chips.forEach(([k, n], i) => {
      s.addText([{ text: String(n), options: { fontSize: 24, bold: true, color: ST[k], breakLine: true } }, { text: k === 'nodata' ? 'No data / no target' : K.STATUS[k].label, options: { fontSize: 10, color: MUTED } }],
        { x: 1.4 + i * 2.45, y: 4.6, w: 2.25, h: 1.05, fontFace: FONT, align: 'center', valign: 'middle', fill: { color: ST_BG[k] }, line: { color: ST[k], width: 1 }, shape: pptx.ShapeType.roundRect, rectRadius: 0.12 });
    });
    s.addText('Prepared ' + when(o.now) + (o.by ? ' by ' + o.by : '') + (report.state === 'final' ? '  ·  FINAL' + (report.finalizedBy ? ' (' + report.finalizedBy + ')' : '') : '  ·  DRAFT'),
      { x: 1.4, y: 6.0, w: 10.5, h: 0.35, fontFace: FONT, fontSize: 10.5, color: MUTED, italic: true });
  }

  /* ---- 2. scorecard ---- */
  {
    const s = slide();
    heading(s, 'KPI scorecard', period);
    const multi = report.months && report.months.length > 1;
    const hdr = [head('#'), head('KPI', { align: 'left' }), head('Baseline'), head(multi ? 'Period' : 'Current'), head('Target'), head('Variance'), head('Status'), head('Trend')];
    const body = rows.map((r) => [
      cell(r.code, { align: 'center', bold: true, color: NAVY }), cell(cut(r.name, 60)),
      cell(r.baseline && K.has(r.baseline.value) ? fv(r, r.baseline.value) : '—', { align: 'center', color: MUTED }),
      cell(fv(r, r.period.value), { align: 'center', bold: true }), cell(K.has(r.target) ? fv(r, r.target) : '—', { align: 'center' }),
      cell(K.gapLabel(r, r.period.value, r.target), { align: 'center', fontSize: 8.5 }), stCell(r.status),
      cell(trendTxt(r.trendDir), { align: 'center', fontSize: 8.5, color: r.trendDir === 'improving' ? ST.met : r.trendDir === 'worsening' ? ST.off : MUTED }),
    ]);
    const rh = Math.min(0.32, 5.35 / (rows.length + 1));
    s.addTable([hdr].concat(zebra(body)), tableOpts(0.6, 1.45, 12.1, [0.55, 4.3, 1.15, 1.3, 1.15, 1.6, 1.15, 0.9], { rowH: rh, fontSize: rows.length > 18 ? 8 : 9 }));
  }

  /* ---- 3. status by pillar (native 3D) + overall doughnut ---- */
  {
    const s = slide();
    heading(s, 'Where we stand, pillar by pillar', 'Status overview');
    const labels = pillars.map((p) => cut(p.label, 26));
    const series = ['met', 'near', 'off', 'nodata'].map((k) => ({ name: k === 'nodata' ? 'No data / no target' : K.STATUS[k].label,
      labels, values: pillars.map((p) => rowsOf(p).filter((r) => (k === 'nodata' ? r.status === 'nodata' || r.status === 'notarget' : r.status === k)).length) }));
    s.addChart(pptx.ChartType.bar3d, series, {
      x: 0.6, y: 1.5, w: 7.7, h: 5.3, barDir: 'col', barGrouping: 'stacked', bar3DShape: 'box', v3DRAngAx: true, v3DRotX: 12, v3DRotY: 18, v3DPerspective: 20, chartColors: [ST.met, ST.near, ST.off, ST.nodata],
      showLegend: true, legendPos: 'b', legendFontSize: 10, legendFontFace: FONT, catAxisLabelFontSize: 10, catAxisLabelFontFace: FONT, valAxisLabelFontSize: 9,
      valAxisMinVal: 0, valAxisMajorUnit: 1, valGridLine: { color: 'E3E9F0', size: 0.5 }, showValue: false, serGridLine: { style: 'none' },
      showTitle: true, title: 'KPIs by status in each pillar', titleFontSize: 12, titleColor: NAVY, titleFontFace: FONT,
    });
    const tot = [['met', sum.met], ['near', sum.near], ['off', sum.off], ['nodata', sum.nodata + (sum.notarget || 0)]].filter(([, n]) => n > 0);
    if (tot.length) {
      s.addChart(pptx.ChartType.doughnut, [{ name: 'KPIs', labels: tot.map(([k]) => (k === 'nodata' ? 'No data / no target' : K.STATUS[k].label)), values: tot.map(([, n]) => n) }], {
        x: 8.55, y: 1.5, w: 4.2, h: 3.9, holeSize: 58, chartColors: tot.map(([k]) => ST[k]), showLegend: true, legendPos: 'b', legendFontSize: 9, legendFontFace: FONT,
        showPercent: false, showValue: true, dataLabelColor: 'FFFFFF', dataLabelFontSize: 11, dataLabelFontBold: true,
        showTitle: true, title: 'All ' + rows.length + ' KPIs', titleFontSize: 12, titleColor: NAVY, titleFontFace: FONT,
      });
    }
    s.addText([{ text: (sum.score == null ? '—' : sum.score + '%'), options: { fontSize: 26, bold: true, color: NAVY, breakLine: true } },
      { text: 'of the KPIs with a target and data are on target', options: { fontSize: 10, color: MUTED } }],
    { x: 8.55, y: 5.55, w: 4.2, h: 1.15, fontFace: FONT, align: 'center', valign: 'middle', fill: { color: 'EAF6FB' }, shape: pptx.ShapeType.roundRect, rectRadius: 0.1 });
  }

  /* ---- 4. achievement vs target, every KPI (native 3D, one colour per status) ---- */
  const scored = rows.filter((r) => r.achievement != null);
  if (style === 'full' && scored.length) {
    const s = slide();
    heading(s, 'Achievement against target', '100 = exactly on target');
    const labels = scored.map((r) => r.code || cut(r.name, 10));
    const series = ['met', 'near', 'off'].map((k) => ({ name: K.STATUS[k].label, labels, values: scored.map((r) => (r.status === k ? r.achievement : 0)) }));
    s.addChart(pptx.ChartType.bar3d, series, {
      x: 0.6, y: 1.45, w: 12.1, h: 4.75, barDir: 'col', barGrouping: 'stacked', bar3DShape: 'box', v3DRAngAx: true, v3DRotX: 12, v3DRotY: 18, v3DPerspective: 20, chartColors: [ST.met, ST.near, ST.off],
      showLegend: true, legendPos: 't', legendFontSize: 10, legendFontFace: FONT, catAxisLabelFontSize: 10, valAxisLabelFontSize: 9, valAxisMinVal: 0, valAxisMaxVal: 150, valAxisMajorUnit: 25,
      valGridLine: { color: 'E3E9F0', size: 0.5 }, serGridLine: { style: 'none' }, valAxisTitle: '% of target achieved', showValAxisTitle: true, valAxisTitleFontSize: 9,
    });
    s.addText(scored.map((r) => r.code + ' ' + cut(r.name, 34)).join('   ·   '), { x: 0.6, y: 6.25, w: 12.1, h: 0.65, fontFace: FONT, fontSize: 8, color: MUTED, valign: 'top' });
  }

  /* ---- per pillar ---- */
  pillars.forEach((p) => {
    const list = rowsOf(p);
    if (style === 'summary') {
      const s = slide();
      heading(s, p.label, 'Pillar', p.color);
      const months = (report.months || []).slice(-6);
      const hdr = [head('#'), head('KPI', { align: 'left' }), head('Unit')].concat(months.map((m) => head(K.fmtMonth(m).replace(' 20', " '")))).concat([head('Period'), head('Target'), head('Status')]);
      const body = list.map((r) => [cell(r.code, { align: 'center', bold: true, color: NAVY }), cell(cut(r.name, 46)), cell(cut(r.unit, 22), { fontSize: 8, color: MUTED, align: 'center' })]
        .concat(months.map((m) => cell(fv(r, (r.cells[m] || {}).value), { align: 'center', fontSize: 8.5 })))
        .concat([cell(fv(r, r.period.value), { align: 'center', bold: true }), cell(K.has(r.target) ? fv(r, r.target) : '—', { align: 'center' }), stCell(r.status)]));
      const fixed = 0.5 + 1.25 + 1.1 + 1.05 + 1.15;
      const rest = 12.1 - fixed - months.length * 0.85;
      s.addTable([hdr].concat(zebra(body)), tableOpts(0.6, 1.5, 12.1, [0.5, rest, 1.25].concat(months.map(() => 0.85)).concat([1.1, 1.05, 1.15]), { rowH: 0.36 }));
      const cmts = list.filter((r) => (report.commentary || {})[r.kpiId]);
      if (cmts.length) {
        s.addText(cmts.slice(0, 4).map((r) => ({ text: r.code + ' — ' + cut(report.commentary[r.kpiId], 220), options: { bullet: true, breakLine: true } })),
          { x: 0.6, y: Math.min(1.6 + (list.length + 1) * 0.36 + 0.25, 5.4), w: 12.1, h: 1.45, fontFace: FONT, fontSize: 9.5, color: INK, valign: 'top' });
      }
      return;
    }
    // full: divider
    {
      const s = slide();
      s.addShape(pptx.ShapeType.rect, { x: 1.4, y: 2.55, w: 0.14, h: 1.9, fill: { color: hex(p.color) }, line: { color: hex(p.color) } });
      s.addText(p.label, { x: 1.75, y: 2.45, w: 9.5, h: 1.0, fontFace: FONT, fontSize: 34, bold: true, color: NAVY });
      const c = K.summarize(list);
      s.addText(list.length + ' KPI' + (list.length === 1 ? '' : 's') + '  ·  ' + c.met + ' on target  ·  ' + c.near + ' close  ·  ' + c.off + ' need action  ·  ' + (c.nodata + c.notarget) + ' without data or target',
        { x: 1.75, y: 3.45, w: 10.5, h: 0.45, fontFace: FONT, fontSize: 14, color: MUTED });
      s.addText(list.map((r) => ({ text: r.code + '  ' + r.name, options: { breakLine: true, color: ST[r.status] === ST.nodata ? MUTED : INK } })),
        { x: 1.75, y: 4.0, w: 10.5, h: 2.6, fontFace: FONT, fontSize: 12, valign: 'top' });
    }
    list.forEach((r) => kpiSlide(r, p));
  });

  function kpiSlide(r, p) {
    const s = slide();
    heading(s, (r.code ? r.code + '. ' : '') + r.name, p.label, p.color);
    const base = r.baseline && K.has(r.baseline.value) ? fv(r, r.baseline.value) : 'Not measured yet';
    const tg = (r.targets || []).length ? r.targets.map((t) => (r.targets.length > 1 ? 'Cycle ' + t.cycle + ': ' : '') + fv(r, t.value)).join('   ·   ') : (K.has(r.target) ? fv(r, r.target) : 'Not set yet');
    const acts = (r.actions || []).slice(0, 9);
    const actRuns = acts.length ? acts.map((x, i) => ({ text: cut(x.text, 150) + (x.status && x.status !== 'open' ? '  [' + K.ACTION_LABEL[x.status] + ']' : '') + (x.owner ? '  — ' + x.owner : ''),
      options: { bullet: { indent: 11 }, breakLine: i < acts.length - 1 || (r.actions.length > 9), color: x.status === 'done' ? ST.met : INK } }))
      .concat(r.actions.length > 9 ? [{ text: '+ ' + (r.actions.length - 9) + ' more in the system', options: { italic: true, color: MUTED } }] : []) : [{ text: 'No action plan recorded.', options: { color: MUTED } }];
    const cm = (report.commentary || {})[r.kpiId];
    const label = (t) => ({ text: t, options: { fill: { color: NAVY }, color: 'FFFFFF', bold: true, fontSize: 9.5, valign: 'middle' } });
    const tbl = [
      [label('Objective'), cell(cut(r.objective, 220))],
      [label('Current'), cell(fv(r, r.period.value) + (r.unit && K.unitKind(r) === 'num' ? '  ' + r.unit : '') + '   (baseline ' + base + ')', { bold: true })],
      [label('Target'), cell(tg)],
      [label('Variance'), cell(K.gapLabel(r, r.period.value, r.target) + '   ·   ' + K.STATUS[r.status].label, { bold: true, color: ST[r.status] })],
      [label('Action plan'), { text: actRuns, options: { fontSize: acts.length > 6 ? 7.5 : 8.5, color: INK, valign: 'top' } }],
      [label('Formula used'), cell(cut(r.formulaText, 200), { fontSize: 8.5, italic: true })],
      [label('Tracking'), cell(r.frequency || 'Monthly', { fontSize: 8.5 })],
      [label('Remarks'), cell(cm ? cut(cm, 300) : (r.remarks ? cut(r.remarks.split(/\n+/)[0], 300) + (/\n/.test(r.remarks) || r.remarks.length > 300 ? '  (see notes)' : '') : '—'), { fontSize: 8.5 })],
    ];
    s.addTable(tbl, { x: 0.6, y: 1.45, w: 7.0, colW: [1.35, 5.65], fontFace: FONT, border: { type: 'solid', pt: 0.5, color: LINE }, margin: 0.06, valign: 'middle', rowH: [0.55, 0.36, 0.36, 0.36, Math.min(2.6, Math.max(0.9, 0.22 + acts.length * (acts.length > 6 ? 0.2 : 0.24))), 0.45, 0.32, 0.6] });

    // trend (native line chart: the figure month by month against the target)
    const tr = (r.trend || []);
    if (tr.some((t) => t.v != null)) {
      const labels = tr.map((t) => K.fmtMonth(t.m).replace(' 20', " '"));
      const data = [{ name: 'Actual', labels, values: tr.map((t) => (t.v == null ? null : t.v)) }];
      if (tr.some((t) => t.t != null)) data.push({ name: 'Target', labels, values: tr.map((t) => (t.t == null ? null : t.t)) });
      s.addChart(pptx.ChartType.line, data, {
        x: 7.85, y: 1.4, w: 4.95, h: 3.55, chartColors: [BLUE, TEAL], lineSize: 2.25, lineDataSymbol: 'circle', lineDataSymbolSize: 6, displayBlanksAs: 'gap',
        showLegend: true, legendPos: 'b', legendFontSize: 9, legendFontFace: FONT, catAxisLabelFontSize: 8, valAxisLabelFontSize: 8, valGridLine: { color: 'E3E9F0', size: 0.5 },
        showTitle: true, title: 'Last ' + tr.length + ' months' + (r.unit ? ' (' + cut(r.unit, 28) + ')' : ''), titleFontSize: 10.5, titleColor: NAVY, titleFontFace: FONT,
        valAxisMinVal: 0,
      });
    } else {
      s.addText('No monthly figures yet — enter them in Nursing KPI → Data Update.', { x: 7.85, y: 2.4, w: 4.95, h: 1.2, fontFace: FONT, fontSize: 11, color: MUTED, align: 'center', valign: 'middle', fill: { color: 'F3F5F8' }, shape: pptx.ShapeType.roundRect, rectRadius: 0.1 });
    }
    // three tiles
    const tile = (x, big, small, col, bg) => s.addText([{ text: big, options: { fontSize: 17, bold: true, color: col, breakLine: true } }, { text: small, options: { fontSize: 8.5, color: MUTED } }],
      { x, y: 5.15, w: 1.55, h: 1.15, fontFace: FONT, align: 'center', valign: 'middle', fill: { color: bg }, shape: pptx.ShapeType.roundRect, rectRadius: 0.08 });
    tile(7.85, fv(r, r.period.value), report.months && report.months.length > 1 ? 'Period value' : 'This month', NAVY, 'EAF6FB');
    tile(9.55, K.has(r.target) ? fv(r, r.target) : '—', 'Target', NAVY, 'EEF7F5');
    tile(11.25, K.STATUS[r.status].label, r.achievement != null ? r.achievement + '% of target' : (r.trendDir ? r.trendDir : 'status'), ST[r.status], ST_BG[r.status]);
    s.addText(r.linked ? 'Figures filled from the hospital’s quality data' : 'Figures entered by the KPI team', { x: 7.85, y: 6.42, w: 4.95, h: 0.28, fontFace: FONT, fontSize: 8, color: MUTED, italic: true });
    // Remarks that do not fit the table (a list, or long text) get a notes slide of their own.
    const remark = r.remarks && (cm || r.remarks.length > 300 || r.remarks.indexOf('\n') >= 0) ? r.remarks : '';
    if (remark) {
      const n = slide();
      heading(n, (r.code ? r.code + '. ' : '') + r.name + ' — notes', p.label, p.color);
      n.addText(remark.split(/\n+/).map((t) => t.trim()).filter(Boolean).map((t) => ({ text: t, options: { bullet: { indent: 14 }, breakLine: true } })),
        { x: 0.8, y: 1.6, w: 11.7, h: 5.1, fontFace: FONT, fontSize: 15, color: INK, valign: 'top', paraSpaceAfter: 8 });
    }
  }

  /* ---- open action plans ---- */
  if (style === 'full') {
    const open = [];
    rows.forEach((r) => (r.actions || []).forEach((x) => { if (x.status !== 'done' && x.status !== 'dropped') open.push({ r, x }); }));
    const tracked = open.filter(({ x }) => x.owner || x.due || x.status === 'progress');
    if (tracked.length) {
      const s = slide();
      heading(s, 'Action plans in progress', tracked.length + ' with an owner or due date');
      const body = tracked.map(({ r, x }) => [cell(r.code, { align: 'center', bold: true, color: NAVY }), cell(cut(x.text, 120), { fontSize: 8.5 }), cell(x.owner || '—', { fontSize: 8.5 }),
        cell(x.due ? K.fmtMonth(x.due) : '—', { align: 'center', fontSize: 8.5, color: x.due && x.due < report.to ? ST.off : INK }), cell(K.ACTION_LABEL[x.status] || x.status, { align: 'center', fontSize: 8.5 })]);
      s.addTable([[head('#'), head('Action', { align: 'left' }), head('Owner'), head('Due'), head('Status')]].concat(zebra(body)), tableOpts(0.6, 1.45, 12.1, [0.6, 7.4, 1.9, 1.1, 1.1], { rowH: 0.3 }));
    }
  }

  /* ---- summary & sign-off ---- */
  {
    const s = slide();
    heading(s, 'Summary & sign-off', period);
    const off = rows.filter((r) => r.status === 'off'), near = rows.filter((r) => r.status === 'near'), met = rows.filter((r) => r.status === 'met');
    const lines = [];
    if (report.overall) lines.push({ text: cut(report.overall, 900), options: { breakLine: true, color: INK } });
    else {
      lines.push({ text: met.length + ' of ' + rows.length + ' KPIs are on target' + (met.length ? ': ' + met.map((r) => r.code).join(', ') : '') + '.', options: { bullet: true, breakLine: true } });
      if (near.length) lines.push({ text: near.length + ' close to target: ' + near.map((r) => r.code + ' ' + r.name).join(', ') + '.', options: { bullet: true, breakLine: true } });
      if (off.length) lines.push({ text: off.length + ' need action: ' + off.map((r) => r.code + ' ' + r.name).join(', ') + '.', options: { bullet: true, breakLine: true } });
      const nd = rows.filter((r) => r.status === 'nodata');
      if (nd.length) lines.push({ text: nd.length + ' have no figures for the period: ' + nd.map((r) => r.code).join(', ') + '.', options: { bullet: true, breakLine: true } });
    }
    s.addText(lines, { x: 0.6, y: 1.5, w: 12.1, h: 3.1, fontFace: FONT, fontSize: 13, color: INK, valign: 'top', paraSpaceAfter: 6 });
    const sig = report.signoff || {};
    [['Prepared by', sig.prepared], ['Reviewed by', sig.reviewed], ['Recommended by', sig.recommended], ['Approved by', sig.approved]].forEach(([l, n], i) => {
      const x = 0.6 + i * 3.08;
      s.addShape(pptx.ShapeType.line, { x, y: 5.75, w: 2.75, h: 0, line: { color: INK, width: 0.75 } });
      s.addText([{ text: l.toUpperCase(), options: { fontSize: 8.5, bold: true, color: MUTED, charSpacing: 1, breakLine: true } }, { text: n || ' ', options: { fontSize: 11, color: INK } }],
        { x, y: 5.8, w: 2.75, h: 0.7, fontFace: FONT, valign: 'top' });
    });
  }

  /* ---- with calculations: how every figure was worked out, and the data checks ---- */
  if (withCalc) {
    const months = report.months || [];
    pillars.forEach((p) => rowsOf(p).forEach((r) => {
      if (!r.evidence) return;
      const s = slide();
      heading(s, 'Calculation — ' + (r.code ? r.code + '. ' : '') + r.name, p.label, p.color);
      // the formula and the period's sums, in words
      const units = periodUnits(r, months);
      const used = units.filter((u) => u.used);
      const tn = used.reduce((a, u) => a + u.num, 0), td = used.reduce((a, u) => a + u.den, 0);
      const lines = [{ text: 'Formula: ' + (r.formulaText || '—'), options: { bold: true, breakLine: true } }];
      if (r.status === 'notstarted') lines.push({ text: 'This KPI starts in ' + K.fmtMonth(r.startMonth) + ' — nothing is counted before then.', options: { breakLine: true } });
      else if (r.period && K.has(r.period.num) && K.has(r.period.den)) lines.push({ text: (r.numLabel || 'Numerator') + ' ' + K.round(r.period.num, 4) + ' ÷ ' + (r.denLabel || 'denominator') + ' ' + K.round(r.period.den, 4) + ' → ' + fv(r, r.period.value) + (months.length > 1 ? '   (all ' + months.length + ' months pooled)' : ''), options: { breakLine: true } });
      else lines.push({ text: 'Value for the period: ' + fv(r, r.period.value), options: { breakLine: true } });
      if (used.length > 1) lines.push({ text: 'Sum of the units used: ' + K.round(tn, 4) + ' ÷ ' + K.round(td, 4) + '. Units are added first and divided once — not an average of their rates.', options: { breakLine: true, color: MUTED } });
      lines.push({ text: 'Month by month: ' + months.map((m) => K.fmtMonth(m).replace(' 20', " '") + ' ' + fv(r, (r.cells[m] || {}).value)).join('  ·  '), options: { color: MUTED } });
      s.addText(lines, { x: 0.6, y: 1.42, w: 12.1, h: 1.05, fontFace: FONT, fontSize: 10, color: INK, valign: 'top', paraSpaceAfter: 2 });
      const hdr = [head('Unit', { align: 'left' }), head('Expected'), head(cut(r.numLabel || 'Numerator', 22)), head(cut(r.denLabel || 'Denominator', 22)), head('Value'), head('Source'), head('Approved by', { align: 'left' })];
      const body = units.map((u) => [cell(cut(u.name, 34)), cell(u.expected ? 'Yes' : '—', { align: 'center' }), cell(u.hasNum ? K.round(u.num, 4) : '—', { align: 'center' }), cell(u.hasDen ? K.round(u.den, 4) : '—', { align: 'center' }),
        cell(u.value == null ? '—' : fv(r, u.value), { align: 'center', bold: true }), cell(cut([...u.sources].join(', '), 40), { fontSize: 8, align: 'center', color: [...u.sources].some((x) => /MISSING|No denominator|Denominator 0/.test(x)) ? ST.off : INK }),
        cell(cut([...u.approvers].join(', ') || '—', 60), { fontSize: 8 })]);
      if (!body.length) body.push([cell(r.linked ? 'No unit reported this KPI in the period.' : 'Typed in the KPI module — see the entries below.', { colspan: 7, color: MUTED })]);
      s.addTable([hdr].concat(zebra(body)), tableOpts(0.6, 2.55, 12.1, [2.9, 0.85, 1.55, 1.55, 1.1, 1.9, 2.25], { rowH: 0.28, fontSize: 9 }));
      // the checks on this KPI and how each was settled
      const cs = (report.quality && report.quality.checks || []).filter((c) => c.kpiId === r.kpiId && c.level !== 'info');
      if (cs.length) {
        s.addText(cs.slice(0, 6).map((c) => ({ text: (c.level === 'error' ? '✖ ' : '▲ ') + K.fmtMonth(c.ym) + ' — ' + cut(c.text, 150) + (c.ack ? '  ✔ Acknowledged by ' + c.ack.by + ': “' + cut(c.ack.reason, 90) + '”' : ''), options: { breakLine: true, color: c.ack ? MUTED : LVL[c.level] } }))
          .concat(cs.length > 6 ? [{ text: '+ ' + (cs.length - 6) + ' more on the Data quality slide', options: { italic: true, color: MUTED } }] : []),
        { x: 0.6, y: 5.75, w: 12.1, h: 1.15, fontFace: FONT, fontSize: 8.5, valign: 'top' });
      }
    }));
    // every check of the period, with its acknowledgement
    const all = ((report.quality && report.quality.checks) || []).filter((c) => c.level !== 'info');
    const s = slide();
    heading(s, 'Data quality', all.length ? all.filter((c) => c.level === 'error').length + ' errors · ' + all.filter((c) => c.level === 'warn').length + ' warnings' : 'No problems found');
    if (all.length) {
      const nameOf = (id) => (rows.find((x) => x.kpiId === id) || {}).code || id;
      const body = all.map((c) => [cell(c.level === 'error' ? 'Error' : 'Warning', { bold: true, color: LVL[c.level], align: 'center' }), cell(nameOf(c.kpiId), { align: 'center', bold: true, color: NAVY }), cell(K.fmtMonth(c.ym), { align: 'center' }),
        cell(cut(c.text, 160), { fontSize: 8.5 }), cell(c.ack ? cut(c.ack.by + ': ' + c.ack.reason, 120) : (c.level === 'error' ? 'NOT RESOLVED' : '—'), { fontSize: 8, color: c.ack ? INK : (c.level === 'error' ? ST.off : MUTED) })]);
      s.addTable([[head('Level'), head('KPI'), head('Month'), head('What was found', { align: 'left' }), head('Acknowledged', { align: 'left' })]].concat(zebra(body)), tableOpts(0.6, 1.45, 12.1, [0.9, 0.7, 1.0, 5.9, 3.6], { rowH: 0.3 }));
    } else s.addText('Every figure in this report passed the data checks.', { x: 0.6, y: 2.2, w: 12.1, h: 0.6, fontFace: FONT, fontSize: 16, color: ST.met });
    if (report.dataFingerprint) s.addText('Data fingerprint ' + String(report.dataFingerprint).slice(7, 19), { x: 0.6, y: 6.62, w: 6, h: 0.28, fontFace: FONT, fontSize: 8, color: MUTED });
  }

  pptx.addSlide({ masterName: 'THANKS' });

  return pptx.write({ outputType: 'nodebuffer' });
}

module.exports = { build };
