/* Nursing KPI — the report as a PowerPoint deck, in the Nursing Department's own style:
 * the UNICO template background of "KPI for Nursing Department.pptx" (server/kpi/deck-bg.jpg),
 * its navy #00293A / blue #008FCB / teal #37B4A6 tables, and its per-KPI layout (Objective ·
 * Current · Target · Variance · Action Plan · Formula · Tracking Frequency · Remarks).
 * Every chart is a NATIVE PowerPoint chart, so it stays editable after download.
 *
 *   full     title · scorecard · status by pillar · achievement vs target (with the 100% line) ·
 *            per pillar: a divider, then one slide per KPI (the deck's table + a 12-month trend
 *            against the target, + a notes slide for its action plan / remarks when they are long) ·
 *            open action plans · summary & sign-off · thank you.
 *   summary  title · scorecard · status by pillar · one slide per pillar · sign-off · thank you.
 *   Every size comes from FS below (nothing under 11 pt); long tables continue on the next slide.
 *
 * Input is the report object from server/kpi.js (rows built by kpi-core buildRows), so the
 * deck shows exactly the figures, targets and statuses the screen shows.
 */
const path = require('path');
const K = require('../renderer/unico/kpi-core.js');

const NAVY = '00293A', BLUE = '008FCB', TEAL = '37B4A6', INK = '16202E', MUTED = '5B6878', LINE = 'C9D3DE', ZEBRA = 'F4F7FA';
const ST = { met: '1F9D57', near: 'E0A21E', off: 'D23A52', notarget: '7B8796', nodata: 'A3ADBA', notstarted: 'A3ADBA', notdue: 'A3ADBA' };
const ST_BG = { met: 'E7F6ED', near: 'FFF6E0', off: 'FDE4E8', notarget: 'EEF2F6', nodata: 'F3F5F8', notstarted: 'F6F8FA', notdue: 'F6F8FA' };
// A KPI measured every N months: its figure says which period it is ("Jan–Jun 2026", or "latest: …").
const resultOf = (r) => (r.latest ? 'latest: ' + r.latest.label : r.freqMonths > 1 && r.resultLabel ? r.resultLabel : '');
// A month cell: '·' when the KPI owes nothing that month (measured less often).
const monthTxt = (r, m, fv) => { const c = (r.cells || {})[m] || {}; return c.source === 'not-due' ? '·' : fv(r, c.value); };
const LVL = { error: 'D23A52', warn: 'E0A21E', info: '7B8796' };
const SRC_LABEL = { 'doc-audit': 'Documentation audits', approved: 'Approved', 'overlay-edit': 'Console edit', audit: 'Audit', own: 'Own reading', covered: 'Covered by audit', 'not-audited': 'Not audited', 'not-observed': 'Not observed', missing: 'MISSING', partial: 'No denominator', 'den-zero': 'Denominator 0', 'carried-den': 'Headcount carried', manual: 'Entered', pending: 'Not sent yet', 'counted-zero': 'No report · counted 0', zero: '0 events', 'zero-assumed': 'No reports · counted 0' };
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
/* Data labels: the value printed on every bar / point, in the KPI's own unit and decimals.
   Values are rounded first so a label never shows 80.267857. */
const dpOf = (r) => (r && K.has(r.decimals) ? Math.min(Math.max(+r.decimals, 0), 4) : (K.unitKind(r) === 'money' ? 0 : 2));
const rnd = (r, v) => (v == null || !K.has(v) ? null : K.round(Number(v), dpOf(r)));
const labelFmt = (r) => { const k = K.unitKind(r); return k === 'pct' ? 'General"%"' : k === 'min' ? 'General" min"' : k === 'money' ? '"Tk "#,##0' : 'General'; };
/* ONE size scale for the whole deck (2026-11-22: the text was too small to read on a projector —
   tables at 8–9.5 pt, chart axes at 8 pt). Nothing below the "small" size anywhere; a slide that
   cannot hold its content at these sizes continues on the next slide instead of shrinking it. */
const FS = { foot: 10, kicker: 12, title: 28, th: 12.5, td: 12, small: 11, axis: 12, label: 13, legend: 12, chartTitle: 14 };
// The deck's chart look: Calibri everywhere, a soft dashed grid, no axis lines, a faint plot background.
const GRID = { color: 'DCE3EB', size: 0.75, style: 'dash' };
const CHART = {
  catAxisLabelFontFace: FONT, valAxisLabelFontFace: FONT, legendFontFace: FONT, titleFontFace: FONT,
  catAxisLabelFontSize: FS.axis, valAxisLabelFontSize: FS.axis, legendFontSize: FS.legend, titleFontSize: FS.chartTitle,
  catAxisLabelColor: INK, valAxisLabelColor: MUTED, titleColor: NAVY,
  valGridLine: GRID, catAxisLineShow: false, valAxisLineShow: false, plotArea: { fill: { color: 'FAFCFE' } },
};
const BAR_SHADOW = { type: 'outer', blur: 4, offset: 2, angle: 90, color: '1B2B3D', opacity: 0.22 };
const LBL = { showValue: true, dataLabelFontFace: FONT, dataLabelFontBold: true, dataLabelFontSize: FS.label };
// A month's colour on a KPI trend: its status against that month's target (blue when no target).
const monthColor = (r, v, t, cfg) => { if (v == null) return ST.nodata; const st = K.statusOf(r, v, t, cfg); return st === 'notarget' ? BLUE : ST[st] || BLUE; };

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
    objects: [{ text: { text: cfg.reportTitle + '  ·  ' + period + (report.state === 'final' ? '' : '  ·  draft'), options: { x: 0.55, y: 7.0, w: 9, h: 0.3, fontFace: FONT, fontSize: FS.foot, color: MUTED } } }],
    slideNumber: { x: 12.25, y: 6.98, w: 0.6, h: 0.3, fontFace: FONT, fontSize: FS.foot, color: MUTED },
  });
  pptx.defineSlideMaster({ title: 'THANKS', background: { path: THANKS } });

  const slide = () => pptx.addSlide({ masterName: 'KPI' });
  const heading = (s, title, kicker, color) => {
    if (kicker) s.addText(kicker.toUpperCase(), { x: 0.6, y: 0.28, w: 9.4, h: 0.34, fontFace: FONT, fontSize: FS.kicker, bold: true, color: hex(color || BLUE), charSpacing: 1.5 });
    s.addText(title, { x: 0.6, y: kicker ? 0.58 : 0.4, w: 10.2, h: 0.66, fontFace: FONT, fontSize: FS.title, bold: true, color: NAVY, fit: 'shrink' });
    s.addShape(pptx.ShapeType.rect, { x: 0.62, y: kicker ? 1.26 : 1.1, w: 1.1, h: 0.06, fill: { color: hex(color || TEAL) }, line: { color: hex(color || TEAL) } });
  };
  const head = (t, extra) => ({ text: t, options: Object.assign({ fill: { color: NAVY }, color: 'FFFFFF', bold: true, fontSize: FS.th, align: 'center', valign: 'middle' }, extra || {}) });
  const cell = (t, extra) => ({ text: t == null ? '' : String(t), options: Object.assign({ fontSize: FS.td, color: INK, valign: 'middle' }, extra || {}) });
  const stCell = (st) => cell(K.STATUS[st].label, { bold: true, color: ST[st], fill: { color: ST_BG[st] }, align: 'center' });
  const trendTxt = (d) => (d === 'improving' ? '▲ improving' : d === 'worsening' ? '▼ worsening' : d === 'steady' ? '● steady' : '—');
  const zebra = (rowsArr) => rowsArr.map((r, i) => (i % 2 ? r.map((c) => (c.options && c.options.fill ? c : Object.assign({}, c, { options: Object.assign({}, c.options, { fill: { color: ZEBRA } }) }))) : r));
  const tableOpts = (x, y, w, colW, extra) => Object.assign({ x, y, w, colW, fontFace: FONT, fontSize: FS.td, border: { type: 'solid', pt: 0.5, color: LINE }, margin: [0.04, 0.08, 0.04, 0.08] }, extra || {});
  /* A table taller than the slide continues on as many slides as it needs (header repeated, the
     title marked 'continued'), so rows keep a readable height. Split here rather than with
     pptxgenjs's autoPage, which under-estimates tall rows and let the last rows run off the slide.
     cont(k) makes continuation slide k. Returns the last slide and where its table ends. */
  const BOTTOM = 6.82;
  const pagedTable = (first, hdr, body, x, y, colW, rowH, cont, extra) => {
    let s = first, top = y, i = 0, k = 0, end = y;
    do {
      if (k > 0) { s = cont(k); top = 1.5; }
      const per = Math.max(1, Math.floor((BOTTOM - top) / rowH) - 1);
      const part = body.slice(i, i + per);
      s.addTable([hdr].concat(part), tableOpts(x, top, colW.reduce((a, c) => a + c, 0), colW, Object.assign({ rowH }, extra || {})));
      end = top + (part.length + 1) * rowH;
      i += per; k++;
    } while (i < body.length);
    return { slide: s, end };
  };
  const contSlide = (title, kicker, color) => (k) => { const c = slide(); heading(c, title + ' (continued)', kicker, color); return c; };

  /* ---- 1. title ---- */
  {
    const s = slide();
    s.addShape(pptx.ShapeType.rect, { x: 1.4, y: 1.55, w: 0.12, h: 2.6, fill: { color: TEAL }, line: { color: TEAL } });
    s.addText('NURSING DEPARTMENT', { x: 1.7, y: 1.5, w: 7.4, h: 0.4, fontFace: FONT, fontSize: 12, bold: true, color: TEAL, charSpacing: 3 });
    s.addText(cfg.reportTitle, { x: 1.7, y: 1.9, w: 7.4, h: 1.25, fontFace: FONT, fontSize: 38, bold: true, color: NAVY, fit: 'shrink', valign: 'top' });
    s.addText((report.from === report.to ? 'Monthly report — ' : 'Report for ') + period, { x: 1.7, y: 3.15, w: 7.4, h: 0.55, fontFace: FONT, fontSize: 22, color: BLUE });
    const cyc = report.cycle || K.cycleOf(report.to, cfg);
    s.addText(cfg.hospitalName + '  ·  ' + cyc.label + (cyc.monthNo ? ', month ' + cyc.monthNo + ' of ' + cyc.of : '') + '  ·  ' + rows.length + ' KPIs in ' + pillars.length + ' pillars',
      { x: 1.7, y: 3.72, w: 7.6, h: 0.42, fontFace: FONT, fontSize: 14, color: MUTED });
    // The KPI score as a ring: the share of scored KPIs on target.
    if (sum.score != null) {
      s.addChart(pptx.ChartType.doughnut, [{ name: 'Score', labels: ['On target', 'Not yet'], values: [sum.score, Math.max(0, 100 - sum.score)] }], {
        x: 9.45, y: 1.45, w: 2.75, h: 2.75, holeSize: 74, chartColors: [TEAL, 'E3E9F0'], showLegend: false, showValue: false, showPercent: false, showTitle: false, dataBorder: { pt: 0.5, color: 'FFFFFF' },
      });
      s.addText([{ text: sum.score + '%', options: { fontSize: 34, bold: true, color: NAVY, breakLine: true } }, { text: 'KPI score', options: { fontSize: FS.small + 1, color: MUTED } }],
        { x: 9.45, y: 2.32, w: 2.75, h: 1.0, fontFace: FONT, align: 'center', valign: 'middle' });
    }
    const chips = [['met', sum.met], ['near', sum.near], ['off', sum.off], ['nodata', sum.nodata + (sum.notarget || 0)]];
    chips.forEach(([k, n], i) => {
      s.addText([{ text: String(n), options: { fontSize: 30, bold: true, color: ST[k], breakLine: true } }, { text: k === 'nodata' ? 'No data / no target' : K.STATUS[k].label, options: { fontSize: FS.td, color: INK } }],
        { x: 1.4 + i * 2.45, y: 4.5, w: 2.25, h: 1.25, fontFace: FONT, align: 'center', valign: 'middle', fill: { color: ST_BG[k] }, line: { color: ST[k], width: 1.25 }, shape: pptx.ShapeType.roundRect, rectRadius: 0.14, shadow: { type: 'outer', blur: 6, offset: 2, angle: 90, color: '1B2B3D', opacity: 0.14 } });
    });
    s.addText('Prepared ' + when(o.now) + (o.by ? ' by ' + o.by : '') + (report.state === 'final' ? '  ·  FINAL' + (report.finalizedBy ? ' (' + report.finalizedBy + ')' : '') : '  ·  DRAFT'),
      { x: 1.4, y: 6.05, w: 10.5, h: 0.4, fontFace: FONT, fontSize: FS.td, color: MUTED, italic: true });
  }

  /* ---- 2. scorecard ---- */
  {
    const s = slide();
    heading(s, 'KPI scorecard', period);
    const multi = report.months && report.months.length > 1;
    const hdr = [head('#'), head('KPI', { align: 'left' }), head('Baseline'), head(multi ? 'Period' : 'Current'), head('Target'), head('Variance'), head('Status'), head('Trend')];
    const body = rows.map((r) => [
      cell(r.code, { align: 'center', bold: true, color: NAVY }), cell(cut(r.name, 52)),
      cell(r.baseline && K.has(r.baseline.value) ? fv(r, r.baseline.value) : '—', { align: 'center', color: MUTED }),
      { text: [{ text: fv(r, r.period.value), options: { bold: true, breakLine: !!resultOf(r) } }].concat(resultOf(r) ? [{ text: resultOf(r), options: { fontSize: FS.small, color: MUTED } }] : []), options: { align: 'center', valign: 'middle', fontSize: FS.td, color: INK } },
      cell(K.has(r.target) ? fv(r, r.target) : '—', { align: 'center' }),
      cell(K.gapLabel(r, r.period.value, r.target), { align: 'center', fontSize: FS.small }), stCell(r.status),
      cell(trendTxt(r.trendDir), { align: 'center', fontSize: FS.small, color: r.trendDir === 'improving' ? ST.met : r.trendDir === 'worsening' ? ST.off : MUTED }),
    ]);
    // A readable row height; more KPIs than fit continue on the next slide (header repeated).
    pagedTable(s, hdr, zebra(body), 0.6, 1.5, [0.6, 4.1, 1.15, 1.35, 1.15, 1.6, 1.2, 0.95], 0.42, contSlide('KPI scorecard', period));
  }

  /* ---- 3. status by pillar + overall doughnut (flat, every segment labelled with its count) ---- */
  {
    const s = slide();
    heading(s, 'Where we stand, pillar by pillar', 'Status overview');
    const labels = pillars.map((p) => cut(p.label, 40));
    const series = ['met', 'near', 'off', 'nodata'].map((k) => ({ name: k === 'nodata' ? 'No data / no target' : K.STATUS[k].label,
      labels, values: pillars.map((p) => rowsOf(p).filter((r) => (k === 'nodata' ? r.status === 'nodata' || r.status === 'notarget' : r.status === k)).length) }));
    const maxN = Math.max(1, ...pillars.map((p) => rowsOf(p).length));
    s.addChart(pptx.ChartType.bar, series, Object.assign({}, CHART, LBL, {
      x: 0.6, y: 1.5, w: 7.7, h: 5.35, barDir: 'col', barGrouping: 'stacked', barGapWidthPct: 38, chartColors: [ST.met, ST.near, ST.off, ST.nodata], dataBorder: { pt: 1.5, color: 'FFFFFF' }, shadow: BAR_SHADOW,
      showLegend: true, legendPos: 't', catAxisLabelFontSize: FS.axis + 1, catAxisLabelFontBold: true,
      valAxisMinVal: 0, valAxisMajorUnit: maxN > 12 ? 2 : 1, valAxisLabelFormatCode: '0',
      dataLabelFormatCode: '0;;;', dataLabelColor: 'FFFFFF', dataLabelFontSize: FS.label + 1, dataLabelPosition: 'ctr', // a zero segment prints nothing
      showTitle: true, title: 'KPIs by status in each pillar',
    }));
    const tot = [['met', sum.met], ['near', sum.near], ['off', sum.off], ['nodata', sum.nodata + (sum.notarget || 0)]].filter(([, n]) => n > 0);
    if (tot.length) {
      s.addChart(pptx.ChartType.doughnut, [{ name: 'KPIs', labels: tot.map(([k]) => (k === 'nodata' ? 'No data / no target' : K.STATUS[k].label)), values: tot.map(([, n]) => n) }], Object.assign({}, CHART, {
        plotArea: {}, x: 8.55, y: 1.5, w: 4.2, h: 3.95, holeSize: 58, chartColors: tot.map(([k]) => ST[k]), showLegend: true, legendPos: 'b', dataBorder: { pt: 2, color: 'FFFFFF' },
        showPercent: false, showValue: true, dataLabelColor: 'FFFFFF', dataLabelFontSize: FS.label + 2, dataLabelFontBold: true, dataLabelFontFace: FONT,
        showTitle: true, title: 'All ' + rows.length + ' KPIs',
      }));
    }
    s.addText([{ text: (sum.score == null ? '—' : sum.score + '%'), options: { fontSize: 30, bold: true, color: NAVY, breakLine: true } },
      { text: 'of the KPIs with a target and data are on target', options: { fontSize: FS.small, color: MUTED } }],
    { x: 8.55, y: 5.55, w: 4.2, h: 1.25, fontFace: FONT, align: 'center', valign: 'middle', fill: { color: 'EAF6FB' }, line: { color: 'BFE0F2', width: 1 }, shape: pptx.ShapeType.roundRect, rectRadius: 0.12 });
  }

  /* Achievement bars: one bar per KPI, best first, coloured by status, the % printed beside each bar,
     and a dashed 100% line = on target. The plot area is placed by hand (layout, as fractions of the
     chart box) so the target line can be drawn exactly at 100% on top of it. */
  const ACH_MAX = 150;
  const achievementChart = (s, list, box, nameLen, layout) => {
    const sorted = list.slice().sort((a, b) => b.achievement - a.achievement);
    const cols = sorted.map((r) => ST[r.status] || BLUE);
    const L = layout || { x: 0.3, y: box.showTitle ? 0.14 : 0.02, w: 0.64, h: box.showTitle ? 0.74 : 0.86 };
    const many = sorted.length > 12;
    // The 100% line, drawn first so the bars and their labels sit on top of it. The plot area is
    // left transparent (a fill would hide the line). Its label sits under the plot.
    const lx = box.x + box.w * (L.x + L.w * (100 / ACH_MAX));
    const ly = box.y + box.h * L.y, lh = box.h * L.h;
    s.addShape(pptx.ShapeType.line, { x: lx, y: ly, w: 0, h: lh, line: { color: NAVY, width: 1.75, dashType: 'dash' } });
    s.addText('▲ Target 100%', { x: lx - 0.9, y: ly + lh + 0.02, w: 1.8, h: 0.3, fontFace: FONT, fontSize: FS.small, bold: true, color: NAVY, align: 'center', valign: 'top' });
    s.addChart(pptx.ChartType.bar, [{ name: '% of target achieved', labels: sorted.map((r) => (r.code ? r.code + '  ' : '') + cut(r.name, nameLen)), values: sorted.map((r) => Math.min(ACH_MAX, Math.round(r.achievement))) }],
      Object.assign({}, CHART, LBL, box, {
        layout: L, plotArea: {}, valAxisHidden: true, barDir: 'bar', catAxisOrientation: 'maxMin', barGapWidthPct: many ? 35 : 45, chartColors: cols.length > 1 ? cols : cols.concat(cols), shadow: BAR_SHADOW,
        showLegend: false, catAxisLabelFontSize: many ? FS.small : FS.axis,
        valAxisMinVal: 0, valAxisMaxVal: ACH_MAX, valAxisMajorUnit: 25, valAxisLabelFormatCode: '0"%"',
        dataLabelFormatCode: '0"%"', dataLabelPosition: 'outEnd', dataLabelColor: INK, dataLabelFontSize: many ? FS.small : FS.label,
      }));
  };
  const legendChips = (s, x, y) => {
    [['met', 'On target'], ['near', 'Close to target'], ['off', 'Needs action']].forEach(([k, l], i) => {
      s.addShape(pptx.ShapeType.roundRect, { x: x + i * 2.1, y: y + 0.08, w: 0.22, h: 0.22, rectRadius: 0.04, fill: { color: ST[k] }, line: { color: ST[k] } });
      s.addText(l, { x: x + i * 2.1 + 0.3, y, w: 1.8, h: 0.38, fontFace: FONT, fontSize: FS.td, color: INK, valign: 'middle' });
    });
  };

  /* ---- 4. achievement vs target, every KPI ---- */
  const scored = rows.filter((r) => r.achievement != null);
  if (style === 'full' && scored.length) {
    const s = slide();
    heading(s, 'Achievement against target', '100% = exactly on target');
    achievementChart(s, scored, { x: 0.6, y: 1.6, w: 12.1, h: 4.9 }, 40);
    legendChips(s, 0.75, 6.52);
    s.addText('Higher-is-better: value ÷ target. Lower-is-better: target ÷ value. Capped at 150%.', { x: 7.1, y: 6.52, w: 5.6, h: 0.38, fontFace: FONT, fontSize: FS.small, color: MUTED, align: 'right', valign: 'middle', italic: true });
  }

  /* ---- per pillar ---- */
  pillars.forEach((p) => {
    const list = rowsOf(p);
    if (style === 'summary') {
      const s = slide();
      heading(s, p.label, 'Pillar', p.color);
      const months = (report.months || []).slice(-6);
      const hdr = [head('#'), head('KPI', { align: 'left' }), head('Unit')].concat(months.map((m) => head(K.fmtMonth(m).replace(' 20', " '")))).concat([head('Period'), head('Target'), head('Status')]);
      const body = list.map((r) => [cell(r.code, { align: 'center', bold: true, color: NAVY }), cell(cut(r.name, 40)), cell(cut(r.unit, 34), { fontSize: FS.small, color: MUTED, align: 'center' })]
        .concat(months.map((m) => cell(monthTxt(r, m, fv), { align: 'center', fontSize: FS.small })))
        .concat([cell(fv(r, r.period.value), { align: 'center', bold: true }), cell(K.has(r.target) ? fv(r, r.target) : '—', { align: 'center' }), stCell(r.status)]));
      const fixed = 0.55 + 1.3 + 1.15 + 1.1 + 1.25;
      const rest = 12.1 - fixed - months.length * 0.92;
      const RH = 0.52; // room for a unit on two lines ('per 1000 patient-days')
      const placed = pagedTable(s, hdr, zebra(body), 0.6, 1.5, [0.55, rest, 1.3].concat(months.map(() => 0.92)).concat([1.15, 1.1, 1.25]), RH, contSlide(p.label, 'Pillar', p.color));
      // Commentary below the table when it fits there, else on a slide of its own — never on top.
      const cmts = list.filter((r) => (report.commentary || {})[r.kpiId]);
      if (cmts.length) {
        const tableEnd = placed.end;
        const bullets = cmts.slice(0, 6).map((r) => ({ text: r.code + ' — ' + cut(report.commentary[r.kpiId], 260), options: { bullet: true, breakLine: true } }));
        if (tableEnd + 0.25 + 1.5 <= BOTTOM) {
          placed.slide.addText(bullets, { x: 0.6, y: tableEnd + 0.25, w: 12.1, h: BOTTOM - tableEnd - 0.25, fontFace: FONT, fontSize: FS.td, color: INK, valign: 'top', paraSpaceAfter: 4 });
        } else {
          const c = slide();
          heading(c, p.label + ' — commentary', 'Pillar', p.color);
          c.addText(bullets, { x: 0.8, y: 1.6, w: 11.7, h: 5.1, fontFace: FONT, fontSize: 15, color: INK, valign: 'top', paraSpaceAfter: 8 });
        }
      }
      return;
    }
    // full: divider
    {
      const s = slide();
      const sc = list.filter((r) => r.achievement != null);
      const textW = sc.length ? 5.6 : 10.5;
      s.addShape(pptx.ShapeType.rect, { x: 0.9, y: 1.75, w: 0.14, h: 1.9, fill: { color: hex(p.color) }, line: { color: hex(p.color) } });
      s.addText('PILLAR', { x: 1.25, y: 1.6, w: textW, h: 0.35, fontFace: FONT, fontSize: FS.kicker, bold: true, color: hex(p.color), charSpacing: 3 });
      s.addText(p.label, { x: 1.25, y: 1.95, w: textW, h: 1.1, fontFace: FONT, fontSize: 34, bold: true, color: NAVY, fit: 'shrink', valign: 'top' });
      const c = K.summarize(list);
      s.addText(list.length + ' KPI' + (list.length === 1 ? '' : 's') + '  ·  ' + c.met + ' on target  ·  ' + c.near + ' close  ·  ' + c.off + ' need action  ·  ' + (c.nodata + c.notarget) + ' without data or target',
        { x: 1.25, y: 3.05, w: textW, h: 0.65, fontFace: FONT, fontSize: 14, color: MUTED, valign: 'top' });
      // each KPI with a status dot and its value
      s.addText(list.map((r) => [
        { text: '●  ', options: { color: ST[r.status] || MUTED } },
        { text: r.code + '  ' + cut(r.name, sc.length ? 30 : 64), options: { color: ST[r.status] === ST.nodata ? MUTED : INK } },
        { text: '   ' + fv(r, r.period.value), options: { bold: true, color: ST[r.status] === ST.nodata ? MUTED : NAVY, breakLine: true } },
      ]).reduce((a, x) => a.concat(x), []), { x: 1.25, y: 3.75, w: textW, h: 3.15, fontFace: FONT, fontSize: list.length > 7 ? FS.small + 1 : 14, valign: 'top', paraSpaceAfter: list.length > 7 ? 2 : 4 });
      if (sc.length) {
        achievementChart(s, sc, { x: 7.05, y: 1.45, w: 5.85, h: Math.min(5.3, 1.4 + sc.length * 0.6), showTitle: true, title: '% of target achieved' }, 16,
          { x: 0.36, y: sc.length > 3 ? 0.14 : 0.24, w: 0.56, h: sc.length > 3 ? 0.74 : 0.56 });
      }
    }
    list.forEach((r) => kpiSlide(r, p));
  });

  /* One KPI. Left: the deck's facts table (Objective · Current · Target · Variance · Formula ·
     Tracking · short Remarks) at a readable size, and the action plan under it. Right: a large
     trend chart and three result tiles. Text that does not fit at these sizes — a long action
     plan, long or multi-line remarks, commentary — goes on a notes slide right after, instead of
     being shrunk onto this one. */
  function kpiSlide(r, p) {
    const s = slide();
    heading(s, (r.code ? r.code + '. ' : '') + r.name, p.label, p.color);
    const base = r.baseline && K.has(r.baseline.value) ? fv(r, r.baseline.value) : 'Not measured yet';
    const tg = (r.targets || []).length ? r.targets.map((t) => (r.targets.length > 1 ? 'Cycle ' + t.cycle + ': ' : '') + fv(r, t.value)).join('   ·   ') : (K.has(r.target) ? fv(r, r.target) : 'Not set yet');
    const allActs = r.actions || [];
    const actLine = (x) => x.text + (x.status && x.status !== 'open' ? '  [' + K.ACTION_LABEL[x.status] + ']' : '') + (x.owner ? '  — ' + x.owner : '');
    const cm = (report.commentary || {})[r.kpiId];
    const remarksAll = String(r.remarks || '').trim();
    // What stays on this slide, and what moves to the notes slide.
    const SHOW_ACTS = 3, ACT_LEN = 95, REMARK_LEN = 120;
    const actsShort = allActs.length <= SHOW_ACTS && allActs.every((x) => actLine(x).length <= ACT_LEN);
    const remarkShort = !cm && remarksAll.length <= REMARK_LEN && remarksAll.indexOf('\n') < 0;
    const needNotes = !actsShort || !remarkShort || !!cm;

    const label = (t) => ({ text: t, options: { fill: { color: NAVY }, color: 'FFFFFF', bold: true, fontSize: FS.th, valign: 'middle' } });
    const tbl = [
      [label('Objective'), cell(cut(r.objective, 150))],
      [label('Current'), cell(fv(r, r.period.value) + (r.unit && K.unitKind(r) === 'num' ? '  ' + r.unit : '') + (resultOf(r) ? '   — ' + resultOf(r) : '') + '   (baseline ' + base + ')', { bold: true })],
      [label('Target'), cell(cut(tg, 90))],
      [label('Variance'), cell(K.gapLabel(r, r.period.value, r.target) + '   ·   ' + K.STATUS[r.status].label, { bold: true, color: ST[r.status] })],
      [label('Formula'), cell(cut(r.formulaText, 120), { fontSize: FS.small, italic: true })],
      [label('Tracking'), cell(cut((r.schedule || r.frequency || 'Monthly') + (r.trackingNote ? ' · ' + r.trackingNote : '') + (r.nextDue ? ' · next result ' + K.fmtMonth(r.nextDue) : ''), 90), { fontSize: FS.small })],
      [label('Remarks'), cell(remarkShort ? (remarksAll || '—') : (cm ? 'Commentary and remarks — see the next slide' : cut(remarksAll.split(/\n+/)[0], 70) + '  … see the next slide'), { fontSize: FS.small, color: remarkShort ? INK : MUTED, italic: !remarkShort })],
    ];
    const rowH = [0.72, 0.42, 0.42, 0.42, 0.56, 0.4, 0.5];
    s.addTable(tbl, { x: 0.6, y: 1.5, w: 6.3, colW: [1.45, 4.85], fontFace: FONT, border: { type: 'solid', pt: 0.5, color: LINE }, margin: [0.03, 0.08, 0.03, 0.08], valign: 'middle', rowH });
    // the action plan, under the table
    const actY = 1.5 + rowH.reduce((a, x) => a + x, 0) + 0.12;
    const actH = 6.9 - actY;
    const shown = allActs.slice(0, SHOW_ACTS);
    const actRuns = [{ text: 'ACTION PLAN', options: { bold: true, color: hex(p.color || BLUE), fontSize: FS.small, charSpacing: 1, breakLine: true } }]
      .concat(shown.length ? shown.map((x, i) => ({ text: cut(actLine(x), ACT_LEN), options: { bullet: { indent: 13 }, breakLine: i < shown.length - 1 || !actsShort, color: x.status === 'done' ? ST.met : INK } }))
        : [{ text: 'No action plan recorded.', options: { color: MUTED, breakLine: false } }])
      .concat(!actsShort ? [{ text: (allActs.length > SHOW_ACTS ? 'All ' + allActs.length + ' actions' : 'The full action plan') + ' on the next slide →', options: { italic: true, color: MUTED } }] : []);
    s.addText(actRuns, { x: 0.6, y: actY, w: 6.3, h: actH, fontFace: FONT, fontSize: FS.td, valign: 'top', paraSpaceAfter: 2, fill: { color: 'F6F9FC' }, line: { color: 'E1E8F0', width: 0.75 }, margin: [6, 10, 6, 10] }); // text-box margins are in points

    // trend: a column per month (coloured by its status against that month's target, the value on
    // each column) with the target as a dashed line — a native combo chart, editable in PowerPoint.
    const CX = 7.15, CW = 5.75;
    const tr = (r.trend || []);
    if (tr.some((t) => t.v != null)) {
      const labels = tr.map((t) => K.fmtMonth(t.m).replace(' 20', " '"));
      const vals = tr.map((t) => rnd(r, t.v));
      const cols = tr.map((t) => monthColor(r, t.v, t.t, cfg));
      const fmtCode = labelFmt(r);
      const dense = tr.length > 9;
      const parts = [{ type: pptx.ChartType.bar, data: [{ name: 'Actual', labels, values: vals }],
        options: Object.assign({}, LBL, { barDir: 'col', barGapWidthPct: dense ? 30 : 40, chartColors: cols.length > 1 ? cols : cols.concat(cols), shadow: BAR_SHADOW,
          dataLabelPosition: dense ? 'outEnd' : 'inEnd', dataLabelFormatCode: fmtCode, dataLabelColor: dense ? INK : 'FFFFFF', dataLabelFontSize: dense ? FS.small : FS.label }) }];
      const hasT = tr.some((t) => t.t != null);
      if (hasT) parts.push({ type: pptx.ChartType.line, data: [{ name: 'Target', labels, values: tr.map((t) => rnd(r, t.t)) }],
        options: { chartColors: [NAVY], lineSize: 2.5, lineDash: 'dash', lineDataSymbol: 'circle', lineDataSymbolSize: 7, lineDataSymbolLineColor: NAVY, showValue: false } });
      s.addChart(parts, Object.assign({}, CHART, {
        x: CX, y: 1.45, w: CW, h: 3.95, showLegend: false,
        catAxisLabelFontSize: dense ? FS.small : FS.axis, valAxisLabelFormatCode: fmtCode,
        showTitle: true, title: (r.freqMonths > 1 ? 'One bar per period · last ' + tr.length + ' months' : 'Last ' + tr.length + ' months') + (r.unit ? ' (' + cut(r.unit, 20) + ')' : '') + (hasT ? '  ·  dashed line = target' : ''),
        valAxisMinVal: 0, displayBlanksAs: 'gap',
      }));
    } else {
      s.addText(r.status === 'notstarted' && K.isMonth(r.startMonth) && r.startMonth > report.to
        ? 'This KPI starts in ' + K.fmtMonthLong(r.startMonth) + ' — after this report ends (' + K.fmtMonthLong(report.to) + '). Make a report that includes ' + K.fmtMonthLong(r.startMonth) + ' to show its figures.'
        : 'No monthly figures yet — enter them in Nursing KPI → Data Update.', { x: CX, y: 2.2, w: CW, h: 1.6, fontFace: FONT, fontSize: 14, color: MUTED, align: 'center', valign: 'middle', fill: { color: 'F3F5F8' }, shape: pptx.ShapeType.roundRect, rectRadius: 0.1 });
    }
    // three result tiles across the chart's width
    const TW = (CW - 0.2) / 3;
    const tile = (i, big, small, col, bg, line) => s.addText([{ text: big, options: { fontSize: 22, bold: true, color: col, breakLine: true } }, { text: small, options: { fontSize: FS.small, color: MUTED } }],
      { x: CX + i * (TW + 0.1), y: 5.5, w: TW, h: 1.08, fontFace: FONT, align: 'center', valign: 'middle', fill: { color: bg }, line: { color: line, width: 1 }, shape: pptx.ShapeType.roundRect, rectRadius: 0.1 });
    tile(0, fv(r, r.period.value), resultOf(r) ? cut(resultOf(r), 22) : report.months && report.months.length > 1 ? 'Period value' : 'This month', NAVY, 'EAF6FB', 'BFE0F2');
    tile(1, K.has(r.target) ? fv(r, r.target) : '—', 'Target', NAVY, 'EEF7F5', 'C4E6E0');
    tile(2, K.STATUS[r.status].label, r.achievement != null ? r.achievement + '% of target' : (r.trendDir ? r.trendDir : 'status'), ST[r.status], ST_BG[r.status], ST[r.status]);
    s.addText(r.linked ? (r.sourceRule === 'docaudit' ? 'Figures filled from the Nursing Documentation KPI Audit' : 'Figures filled from the hospital’s quality data') : 'Figures entered by the KPI team', { x: CX, y: 6.62, w: CW, h: 0.3, fontFace: FONT, fontSize: FS.small, color: MUTED, italic: true, align: 'right' });

    // The notes slide: the whole action plan, the commentary and the full remarks, at a large size.
    if (needNotes) {
      const n = slide();
      heading(n, (r.code ? r.code + '. ' : '') + r.name + ' — action plan & notes', p.label, p.color);
      const runs = [];
      const section = (t) => runs.push({ text: t, options: { bold: true, color: hex(p.color || BLUE), fontSize: FS.kicker, charSpacing: 1, breakLine: true } });
      if (allActs.length) {
        section('ACTION PLAN');
        allActs.slice(0, 14).forEach((x) => runs.push({ text: cut(actLine(x), 240), options: { bullet: { indent: 16 }, breakLine: true, color: x.status === 'done' ? ST.met : INK } }));
        if (allActs.length > 14) runs.push({ text: '+ ' + (allActs.length - 14) + ' more in the system', options: { italic: true, color: MUTED, breakLine: true } });
      }
      if (cm) { section('COMMENTARY'); runs.push({ text: cut(cm, 700), options: { breakLine: true, color: INK } }); }
      if (remarksAll && !remarkShort) {
        section('REMARKS');
        remarksAll.split(/\n+/).map((t) => t.trim()).filter(Boolean).slice(0, 12).forEach((t) => runs.push({ text: cut(t, 300), options: { bullet: { indent: 16 }, breakLine: true, color: INK } }));
      }
      const many = runs.length > 14;
      n.addText(runs, { x: 0.8, y: 1.6, w: 11.7, h: 5.2, fontFace: FONT, fontSize: many ? FS.td + 1 : 15, color: INK, valign: 'top', paraSpaceAfter: many ? 4 : 7 });
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
      const body = tracked.map(({ r, x }) => [cell(r.code, { align: 'center', bold: true, color: NAVY }), cell(cut(x.text, 110)), cell(cut(x.owner || '—', 26)),
        cell(x.due ? K.fmtMonth(x.due) : '—', { align: 'center', color: x.due && x.due < report.to ? ST.off : INK }), cell(K.ACTION_LABEL[x.status] || x.status, { align: 'center' })]);
      pagedTable(s, [head('#'), head('Action', { align: 'left' }), head('Owner'), head('Due'), head('Status')], zebra(body), 0.6, 1.5, [0.65, 6.95, 2.1, 1.15, 1.25], 0.44, contSlide('Action plans in progress', tracked.length + ' with an owner or due date'));
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
    s.addText(lines, { x: 0.6, y: 1.5, w: 12.1, h: 3.7, fontFace: FONT, fontSize: 15, color: INK, valign: 'top', paraSpaceAfter: 8 });
    const sig = report.signoff || {};
    [['Prepared by', sig.prepared], ['Reviewed by', sig.reviewed], ['Recommended by', sig.recommended], ['Approved by', sig.approved]].forEach(([l, n], i) => {
      const x = 0.6 + i * 3.08;
      s.addShape(pptx.ShapeType.line, { x, y: 5.7, w: 2.75, h: 0, line: { color: INK, width: 0.75 } });
      s.addText([{ text: l.toUpperCase(), options: { fontSize: FS.small, bold: true, color: MUTED, charSpacing: 1, breakLine: true } }, { text: n || ' ', options: { fontSize: 14, color: INK } }],
        { x, y: 5.76, w: 2.75, h: 0.9, fontFace: FONT, valign: 'top' });
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
      else if (r.status === 'notdue') lines.push({ text: 'Measured ' + K.freqLabel(r, true).toLowerCase() + ' — the first result is due in ' + K.fmtMonth(r.nextDue) + '.', options: { breakLine: true } });
      else if (r.period && K.has(r.period.num) && K.has(r.period.den)) lines.push({ text: (r.numLabel || 'Numerator') + ' ' + K.round(r.period.num, 4) + ' ÷ ' + (r.denLabel || 'denominator') + ' ' + K.round(r.period.den, 4) + ' → ' + fv(r, r.period.value) + (months.length > 1 ? '   (all ' + months.length + ' months pooled)' : ''), options: { breakLine: true } });
      else lines.push({ text: 'Value for the period: ' + fv(r, r.period.value), options: { breakLine: true } });
      if (used.length > 1) lines.push({ text: 'Sum of the units used: ' + K.round(tn, 4) + ' ÷ ' + K.round(td, 4) + '. Units are added first and divided once — not an average of their rates.', options: { breakLine: true, color: MUTED } });
      if (r.freqMonths > 1) lines.push({ text: K.freqLabel(r) + ' — period by period: ' + ((r.periods || []).map((pp) => pp.label + ' ' + fv(r, pp.value)).join('  ·  ') || 'no period has ended yet'), options: { color: MUTED } });
      else lines.push({ text: 'Month by month: ' + months.map((m) => K.fmtMonth(m).replace(' 20', " '") + ' ' + fv(r, (r.cells[m] || {}).value)).join('  ·  '), options: { color: MUTED } });
      s.addText(lines, { x: 0.6, y: 1.45, w: 12.1, h: 1.3, fontFace: FONT, fontSize: FS.small + 0.5, color: INK, valign: 'top', paraSpaceAfter: 2 });
      const hdr = [head('Unit', { align: 'left' }), head('Expected'), head(cut(r.numLabel || 'Numerator', 20)), head(cut(r.denLabel || 'Denominator', 20)), head('Value'), head('Source'), head('Approved by', { align: 'left' })];
      const body = units.map((u) => [cell(cut(u.name, 30), { fontSize: FS.small }), cell(u.expected ? 'Yes' : '—', { align: 'center', fontSize: FS.small }), cell(u.hasNum ? K.round(u.num, 4) : '—', { align: 'center', fontSize: FS.small }), cell(u.hasDen ? K.round(u.den, 4) : '—', { align: 'center', fontSize: FS.small }),
        cell(u.value == null ? '—' : fv(r, u.value), { align: 'center', bold: true, fontSize: FS.small }), cell(cut([...u.sources].join(', '), 34), { fontSize: FS.small, align: 'center', color: [...u.sources].some((x) => /MISSING|No denominator|Denominator 0/.test(x)) ? ST.off : INK }),
        cell(cut([...u.approvers].join(', ') || '—', 48), { fontSize: FS.small })]);
      if (!body.length) body.push([cell(r.linked ? 'No unit reported this KPI in the period.' : 'Typed in the KPI module — see the entries below.', { colspan: 7, color: MUTED })]);
      const unitsEnd = pagedTable(s, hdr, zebra(body), 0.6, 2.85, [2.75, 0.95, 1.5, 1.5, 1.15, 1.9, 2.35], 0.36, contSlide('Calculation — ' + (r.code ? r.code + '. ' : '') + r.name, p.label, p.color), { fontSize: FS.small });
      // the checks on this KPI and how each was settled
      const cs = (report.quality && report.quality.checks || []).filter((c) => c.kpiId === r.kpiId && c.level !== 'info');
      if (cs.length) {
        const checkRuns = cs.slice(0, 6).map((c) => ({ text: (c.level === 'error' ? '✖ ' : '▲ ') + K.fmtMonth(c.ym) + ' — ' + cut(c.text, 150) + (c.ack ? '  ✔ Acknowledged by ' + c.ack.by + ': “' + cut(c.ack.reason, 90) + '”' : ''), options: { breakLine: true, color: c.ack ? MUTED : LVL[c.level] } }))
          .concat(cs.length > 6 ? [{ text: '+ ' + (cs.length - 6) + ' more on the Data quality slide', options: { italic: true, color: MUTED } }] : []);
        // under the units table when there is room, else on a slide of its own
        const fits = unitsEnd.end + 0.15 + 1.1 <= BOTTOM;
        const target = fits ? unitsEnd.slide : contSlide('Calculation — ' + (r.code ? r.code + '. ' : '') + r.name, p.label, p.color)(1);
        const top = fits ? unitsEnd.end + 0.15 : 1.6;
        target.addText(checkRuns, { x: 0.6, y: top, w: 12.1, h: BOTTOM - top, fontFace: FONT, fontSize: FS.small, valign: 'top' });
      }
    }));
    // every check of the period, with its acknowledgement
    const all = ((report.quality && report.quality.checks) || []).filter((c) => c.level !== 'info');
    const s = slide();
    heading(s, 'Data quality', all.length ? all.filter((c) => c.level === 'error').length + ' errors · ' + all.filter((c) => c.level === 'warn').length + ' warnings' : 'No problems found');
    if (all.length) {
      const nameOf = (id) => (rows.find((x) => x.kpiId === id) || {}).code || id;
      const body = all.map((c) => [cell(c.level === 'error' ? 'Error' : 'Warning', { bold: true, color: LVL[c.level], align: 'center' }), cell(nameOf(c.kpiId), { align: 'center', bold: true, color: NAVY }), cell(K.fmtMonth(c.ym), { align: 'center' }),
        cell(cut(c.text, 140), { fontSize: FS.small }), cell(c.ack ? cut(c.ack.by + ': ' + c.ack.reason, 100) : (c.level === 'error' ? 'NOT RESOLVED' : '—'), { fontSize: FS.small, color: c.ack ? INK : (c.level === 'error' ? ST.off : MUTED) })]);
      pagedTable(s, [head('Level'), head('KPI'), head('Month'), head('What was found', { align: 'left' }), head('Acknowledged', { align: 'left' })], zebra(body), 0.6, 1.5, [1.05, 0.75, 1.05, 5.75, 3.5], 0.44, contSlide('Data quality', 'continued'));
    } else s.addText('Every figure in this report passed the data checks.', { x: 0.6, y: 2.2, w: 12.1, h: 0.6, fontFace: FONT, fontSize: 18, color: ST.met });
    if (report.dataFingerprint) s.addText('Data fingerprint ' + String(report.dataFingerprint).slice(7, 19), { x: 0.6, y: 6.6, w: 6, h: 0.3, fontFace: FONT, fontSize: FS.small, color: MUTED });
  }

  pptx.addSlide({ masterName: 'THANKS' });

  return pptx.write({ outputType: 'nodebuffer' });
}

module.exports = { build };
