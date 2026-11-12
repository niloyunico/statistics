/* Nursing KPI — the documents that are not a period report.
 *   KPI Definition document   one page per KPI: what it measures, how it is calculated, where the
 *                             figures come from, how often, its cycles and targets, its action plan
 *                             (Word here; the browser prints / PDFs the same facts — defFacts)
 *   Data collection calendar  a year: which KPI owes a figure in which month (Excel here; the
 *                             browser prints / PDFs it from kpi-core calendar)
 * Every sentence about a KPI comes from defFacts, so the Word file and the PDF say the same thing.
 */
const K = require('../renderer/unico/kpi-core.js');

const when = (t) => (t ? new Date(t).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka', dateStyle: 'medium', timeStyle: 'short' }) : '');
const today = (t) => new Date(t || Date.now()).toLocaleDateString('en-GB', { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'long', year: 'numeric' });

/* What the documents say about one KPI. d = a live KPI definition (+ indicatorName, unitNames). */
function defFacts(d, cfg) {
  const c = K.cfgOf(cfg);
  const cc = K.cycleCfg(d, c);
  const f = K.freqOf(d);
  const linked = !!(d.source && d.source.indId);
  const lower = d.goalDirection === 'lower_is_better';
  const autoOn = d.autoFill !== false && c.autoFill !== false;
  const targetText = (n) => {
    const t = (d.targets || []).find((x) => x.cycle === n);
    if (t && K.has(t.value)) return K.fmt(d, t.value);
    if (K.has(d.baselineTargetPct)) return (d.baselineTargetPct > 0 ? '+' : '') + d.baselineTargetPct + '% vs baseline';
    return 'Not set';
  };
  const cycles = Array.from({ length: cc.cycles }, (_, i) => {
    const r = K.cycleRange(i + 1, c, d);
    return { n: i + 1, from: r.from, to: r.to, dates: K.spanLabel(r.from, r.to), target: targetText(i + 1), results: K.dueMonths(d, r.from, r.to, c).length };
  });
  const units = !linked ? 'Not applicable (entered in the KPI module)'
    : (d.units && d.units.length ? d.units.length + ' unit(s): ' + (d.unitNames && d.unitNames.length ? d.unitNames.join(', ') : d.units.join(', '))
      : 'As Department Setup — every unit that carries the indicator and measures it');
  const facts = [
    ['Objective', d.objective || '—'],
    ['Formula', d.formulaText || K.FORMULA_LABEL[d.formula] || '—'],
    ['Calculation', K.FORMULA_LABEL[d.formula] || d.formula],
    ['Numerator', d.formula === 'direct' ? 'Not used — the value itself is entered' : (d.numLabel || '—')],
    ['Denominator', d.formula === 'count' || d.formula === 'direct' ? 'Not used' : (d.denLabel || '—')],
    ['Unit and direction', (d.unit || '—') + ' · ' + (lower ? 'lower is better' : 'higher is better')],
    ['Data source', linked ? (d.source.rule === 'docaudit' ? 'Nursing Documentation KPI Audit module — every completed audit of the month, all departments' : 'Quality data — ' + (d.indicatorName || d.source.indName || d.source.indId)) + (autoOn
      ? '. Filled automatically; a KPI manager may replace a figure only with a written reason.'
      : '. Auto-fill is off: the figure is typed each period; the quality data is shown as a hint.') : 'Entered in the KPI module by a KPI manager.'],
    ['Units expected to report', units],
    ['Measured', K.freqLabel(d) + (f > 1 ? ' — one figure per period, entered in the period’s last month; units’ monthly figures are pooled (Σ numerator ÷ Σ denominator).' : ' — one figure per month.')],
    ['Tracking starts', K.fmtMonthLong(K.startOf(d, c)) + (K.isMonth(d.startMonth) ? ' (this KPI’s own start)' : ' (the same as all KPIs)')],
    ['Cycles', cc.cycles + (cc.cycles === 1 ? ' cycle' : ' cycles') + ' of ' + cc.cycleMonths + ' months' + (cc.own ? ' (this KPI’s own cycles)' : ' (the programme’s cycles)')],
    ['Baseline', d.baseline && K.has(d.baseline.value) ? K.fmt(d, d.baseline.value) + (d.baseline.note ? ' — ' + d.baseline.note : '') : 'Not set'],
    ['Status', 'On target: the target is met · Close: short of it by no more than ' + c.nearBand + '% of the target · Needs action: further off' + (lower ? ' · a zero target has no “close”: any event needs action' : '') + '.'],
  ];
  if (K.trackingNote(d)) facts.push(['Tracking note', K.trackingNote(d)]);
  if (d.remarks) facts.push(['Remarks', d.remarks]);
  facts.push(['Last changed', [d.updatedByName || d.updatedBy || '', when(d.updatedAt)].filter(Boolean).join(' · ') || '—']);
  return {
    id: d.id, code: d.code || '', name: d.name, pillar: K.pillarOf(c, d.pillar).label, pillarColor: K.pillarOf(c, d.pillar).color,
    measured: K.freqLabel(d, true), schedule: K.scheduleText(d, c), facts, cycles,
    actions: (d.actions || []).filter((a) => a && a.text).map((a) => ({ text: a.text, owner: a.owner || '', due: a.due ? K.fmtMonth(a.due) : '', status: K.ACTION_LABEL[a.status] || 'Not started' })),
  };
}

const ordered = (defs, cfg) => {
  const c = K.cfgOf(cfg);
  const po = (id) => K.pillarOf(c, id).order || 99;
  return (defs || []).slice().sort((a, b) => (po(a.pillar) - po(b.pillar)) || ((a.order || 0) - (b.order || 0)));
};

/* ------------------------------------------------------------------ Word --- */
async function definitionsDocx(defs, opts) {
  const {
    AlignmentType, BorderStyle, Document, Footer, Packer, PageBreak, PageNumber, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType, HeadingLevel,
  } = require('docx');
  const o = opts || {};
  const cfg = K.cfgOf(o.cfg);
  const list = ordered(defs, cfg).map((d) => defFacts(d, cfg));
  const NAVY = '00293A', BLUE = '008FCB', LIGHT = 'EEF4F8', LINE = 'C9D3DE';
  const FULL = 9638; // A4 width minus 2 cm margins, in twentieths of a point
  const border = { style: BorderStyle.SINGLE, size: 4, color: LINE };
  const borders = { top: border, bottom: border, left: border, right: border };
  const run = (text, x) => new TextRun(Object.assign({ text: String(text == null ? '' : text), font: 'Calibri', size: 20 }, x || {}));
  const para = (text, x, p) => new Paragraph(Object.assign({ spacing: { before: 0, after: 60 }, children: [run(text, x)] }, p || {}));
  const cell = (text, x) => new TableCell(Object.assign({
    borders, margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: String(text == null ? '' : text).split('\n').map((line) => para(line, (x && x.run) || {})),
  }, x && x.cell ? x.cell : {}));
  const head = (labels, widths) => new TableRow({ tableHeader: true, children: labels.map((l, i) => cell(l, { run: { bold: true, color: 'FFFFFF', size: 18 }, cell: { width: { size: widths[i], type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, color: 'auto', fill: NAVY } } })) });
  const table = (labels, widths, rows) => new Table({
    width: { size: FULL, type: WidthType.DXA }, columnWidths: widths,
    rows: [head(labels, widths)].concat(rows.map((r) => new TableRow({ cantSplit: true, children: r.map((v, i) => cell(v, { cell: { width: { size: widths[i], type: WidthType.DXA } }, run: { size: 19 } })) }))),
  });
  const sig = o.signoff || {};
  const roles = [['prepared', 'Prepared by'], ['reviewed', 'Reviewed by'], ['recommended', 'Recommended by'], ['approved', 'Approved by']];

  const cover = [
    para(cfg.hospitalName, { bold: true, size: 24, color: BLUE }, { spacing: { before: 2400, after: 120 } }),
    para('Nursing KPI Definitions', { bold: true, size: 56, color: NAVY }, { spacing: { before: 0, after: 120 } }),
    para(cfg.reportTitle + ' · ' + list.length + ' KPIs in ' + [...new Set(list.map((x) => x.pillar))].length + ' pillars', { size: 24, color: '3A4656' }, { spacing: { before: 0, after: 480 } }),
    para('What each KPI measures, how it is calculated, where its figures come from, how often it is measured, its cycles, targets and action plan.', { size: 21, color: '3A4656' }, { spacing: { before: 0, after: 360 } }),
    para('Version: ' + today(o.now) + (o.by ? ' · generated by ' + o.by : ''), { size: 20, color: '5B6878' }, { spacing: { before: 0, after: 600 } }),
    para('Document control', { bold: true, size: 22, color: NAVY }),
    table(['Role', 'Name', 'Signature', 'Date'], [2400, 3238, 2400, 1600], roles.map(([k, l]) => [l, sig[k] || '', '', ''])),
    new Paragraph({ children: [new PageBreak()] }),
    para('Contents', { bold: true, size: 30, color: NAVY }, { spacing: { before: 0, after: 160 } }),
    table(['Code', 'KPI', 'Pillar', 'Measured', 'Target'], [800, 3838, 2200, 1500, 1300], list.map((k) => [k.code, k.name, k.pillar, k.measured, k.cycles.map((c) => c.target).join(' → ')])),
  ];
  const pages = [];
  list.forEach((k) => {
    pages.push(new Paragraph({ children: [new PageBreak()] }));
    pages.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 0, after: 40 }, children: [run((k.code ? k.code + '  ' : '') + k.name, { bold: true, size: 32, color: NAVY })] }));
    pages.push(para(k.pillar + ' · ' + k.schedule, { size: 18, color: '5B6878' }, { spacing: { before: 0, after: 200 } }));
    pages.push(new Table({
      width: { size: FULL, type: WidthType.DXA }, columnWidths: [2400, FULL - 2400],
      rows: k.facts.map(([l, v]) => new TableRow({ cantSplit: true, children: [
        cell(l, { run: { bold: true, size: 19, color: NAVY }, cell: { width: { size: 2400, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, color: 'auto', fill: LIGHT } } }),
        cell(v, { run: { size: 19 }, cell: { width: { size: FULL - 2400, type: WidthType.DXA } } }),
      ] })),
    }));
    pages.push(para('Cycles and targets', { bold: true, size: 22, color: NAVY }, { spacing: { before: 240, after: 80 } }));
    pages.push(table(['Cycle', 'Dates', 'Target', 'Results due'], [1300, 3938, 2400, 2000], k.cycles.map((c) => ['Cycle ' + c.n, c.dates, c.target, String(c.results)])));
    pages.push(para('Action plan', { bold: true, size: 22, color: NAVY }, { spacing: { before: 240, after: 80 } }));
    if (k.actions.length) pages.push(table(['#', 'Action', 'Owner', 'Due', 'Status'], [500, 5138, 1700, 1000, 1300], k.actions.map((a, i) => [String(i + 1), a.text, a.owner, a.due, a.status])));
    else pages.push(para('No action items.', { italics: true, color: '5B6878' }));
  });

  const doc = new Document({
    creator: o.by || 'UNICO', title: 'Nursing KPI Definitions', description: cfg.reportTitle,
    styles: { default: { document: { run: { font: 'Calibri', size: 20 } } } },
    sections: [{
      properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
        run('Nursing KPI Definitions · ' + cfg.hospitalName + ' · ' + today(o.now) + ' · page ', { size: 16, color: '7B8796' }),
        new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '7B8796', font: 'Calibri' }),
        run(' of ', { size: 16, color: '7B8796' }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: '7B8796', font: 'Calibri' }),
      ] })] }) },
      children: cover.concat(pages),
    }],
  });
  return Packer.toBuffer(doc);
}

/* ----------------------------------------------------------------- Excel --- */
async function calendarXlsx(defs, year, opts) {
  const ExcelJS = require('exceljs');
  const o = opts || {};
  const cfg = K.cfgOf(o.cfg);
  const list = ordered(defs, cfg);
  const cal = K.calendar(list, year, cfg);
  const wb = new ExcelJS.Workbook();
  wb.creator = o.by || 'UNICO';
  wb.created = new Date(o.now || Date.now());
  const NAVY = 'FF00293A', LINE = 'FFC9D3DE';
  const fill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
  const box = { top: { style: 'thin', color: { argb: LINE } }, bottom: { style: 'thin', color: { argb: LINE } }, left: { style: 'thin', color: { argb: LINE } }, right: { style: 'thin', color: { argb: LINE } } };

  const ws = wb.addWorksheet('Calendar ' + cal.year, { views: [{ state: 'frozen', xSplit: 2, ySplit: 3 }], pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  ws.mergeCells(1, 1, 1, 19);
  ws.getCell(1, 1).value = 'Nursing KPI — data collection calendar ' + cal.year + ' · ' + cfg.hospitalName;
  ws.getCell(1, 1).font = { bold: true, size: 14, color: { argb: NAVY } };
  ws.mergeCells(2, 1, 2, 19);
  ws.getCell(2, 1).value = '●  a figure is due (the period ends this month)     ·  not due     —  not started yet.     A KPI measured every N months owes one figure per period, entered in its last month.';
  ws.getCell(2, 1).font = { italic: true, size: 9, color: { argb: 'FF5B6878' } };
  const cols = ['Code', 'KPI', 'Pillar', 'Measured', 'Source'].concat(cal.months.map((m) => K.MONS[+m.slice(5) - 1]), ['Due in ' + cal.year]);
  const widths = [7, 42, 26, 15, 18].concat(cal.months.map(() => 5.5), [10]);
  const hr = ws.getRow(3);
  cols.forEach((h, i) => { const c = hr.getCell(i + 1); c.value = h; c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = fill(NAVY); c.alignment = { horizontal: i >= 5 ? 'center' : 'left', vertical: 'middle' }; c.border = box; });
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  list.forEach((d) => {
    const row = ws.addRow([d.code || '', d.name, K.pillarOf(cfg, d.pillar).label, K.freqLabel(d, true), d.source && d.source.indId ? (d.autoFill !== false && cfg.autoFill !== false ? 'Auto from quality' : 'Typed (auto-fill off)') : 'Typed']
      .concat(cal.months.map((m) => ({ due: '●', off: '·', notstarted: '—' })[cal.byKpi[d.id][m]]), [cal.months.filter((m) => cal.byKpi[d.id][m] === 'due').length]));
    row.eachCell((c, i) => {
      c.border = box;
      if (i > 5) c.alignment = { horizontal: 'center' };
      const st = i > 5 && i <= 17 ? cal.byKpi[d.id][cal.months[i - 6]] : null;
      if (st === 'due') { c.fill = fill('FFE7F6ED'); c.font = { bold: true, color: { argb: 'FF14713F' } }; }
      if (st === 'notstarted') { c.fill = fill('FFF3F5F8'); c.font = { color: { argb: 'FF9AA5B3' } }; }
    });
  });
  const tot = ws.addRow(['', 'Figures due', '', '', ''].concat(cal.dueCount, [cal.dueCount.reduce((a, b) => a + b, 0)]));
  tot.eachCell((c, i) => { c.font = { bold: true }; c.border = box; c.fill = fill('FFEEF4F8'); if (i > 5) c.alignment = { horizontal: 'center' }; });

  const sc = wb.addWorksheet('Schedule', { views: [{ state: 'frozen', ySplit: 1 }] });
  sc.columns = [{ header: 'Code', key: 'code', width: 7 }, { header: 'KPI', key: 'name', width: 42 }, { header: 'Measured', key: 'm', width: 26 }, { header: 'Starts', key: 's', width: 12 },
    { header: 'Cycles', key: 'c', width: 18 }, { header: 'Schedule', key: 'sch', width: 90 }];
  const h = sc.getRow(1); h.font = { bold: true, color: { argb: 'FFFFFFFF' } }; h.fill = fill(NAVY);
  list.forEach((d) => { const cc = K.cycleCfg(d, cfg); sc.addRow({ code: d.code || '', name: d.name, m: K.freqLabel(d), s: K.fmtMonth(K.startOf(d, cfg)), c: cc.cycles + ' × ' + cc.cycleMonths + ' months', sch: K.scheduleText(d, cfg) }); });
  sc.eachRow((r) => r.eachCell((c) => { c.border = box; c.alignment = { vertical: 'top', wrapText: true }; }));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

module.exports = { defFacts, definitionsDocx, calendarXlsx };
