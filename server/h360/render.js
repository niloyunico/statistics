// Draws a saved report as a Word file and as a print page, following the
// final log sheet. Both come from the same list of rows, so they always show
// the same thing.
const fs = require('fs');
const path = require('path');
const {
  AlignmentType, BorderStyle, Document, ImageRun, Packer, PageOrientation, Paragraph, ShadingType, Table, TableCell,
  TableLayoutType, TableRow, TextRun, VerticalAlign, VerticalMergeType, WidthType,
} = require('docx');
const { SECTIONS, SIGNATURE } = require('./schema');

const GRID = 120;
const SHADE = 'BFBFBF';
const LOGO = path.join(__dirname, 'logo.png');
const BY_ID = Object.fromEntries(SECTIONS.map((section) => [section.id, section]));
// A sheet without its logo is still the sheet. The live site once shipped without the
// picture (.vercelignore dropped every png outside renderer/) and every export failed.
const logoBytes = () => { try { return fs.readFileSync(LOGO); } catch (e) { return null; } };

const text = (value) => (value === null || value === undefined ? '' : String(value));
const isFilled = (row) => Object.entries(row).some(([key, value]) => !key.startsWith('_') && key !== 'item' && key !== 'sub' && key !== 'type' && text(value).trim());
// "13", "04", and a plain "0" when there are none, as written on the sheet.
const countText = (n) => (n ? String(n).padStart(2, '0') : '0');

// "2026-06-28" -> "28/06/2026"
function displayDate(date) {
  const match = text(date).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : text(date);
}

// Splits a width evenly between a number of cells.
function spread(count, total) {
  const each = Math.floor(total / count);
  return Array.from({ length: count }, (_, i) => (i === count - 1 ? total - each * (count - 1) : each));
}

// The whole sheet as rows of cells: { text, span, bold, shade, align, size, merge }.
// merge 'start' / 'cont' joins a cell with the ones below it.
function layout(report) {
  const rows = [];
  const part = (id) => ({ rows: [], fields: {}, ...(report.data[id] || {}) });
  const filled = (id) => part(id).rows.filter(isFilled);
  const title = (id) => BY_ID[id].title.replace('{n}', countText(filled(id).length));
  const bar = (label) => rows.push([{ text: label, span: GRID, shade: SHADE, align: 'left' }]);
  const header = (section, shade) => [
    ...(section.serial ? [{ text: section.serial.label, span: section.serial.width, align: 'center', shade }] : []),
    ...section.columns.map((column) => ({ text: column.label, span: column.width, align: 'center', shade })),
  ];
  const line = (section, row, number) => [
    ...(section.serial ? [{ text: number ? String(number).padStart(2, '0') : '', span: section.serial.width, align: 'center' }] : []),
    ...section.columns.map((column) => ({ text: text(row[column.key]), span: column.width, align: column.align || 'center' })),
  ];
  // The written rows, or as many empty ones as the sheet leaves for writing by hand.
  const lines = (section) => {
    const written = section.fixedRows || section.single ? part(section.id).rows : filled(section.id);
    const blanks = Math.max((section.minRows || (section.single ? 1 : 0)) - written.length, 0);
    return [...written.map((row, i) => line(section, row, section.fixedRows || section.single ? 0 : i + 1)), ...Array.from({ length: blanks }, () => line(section, {}, 0))];
  };
  const table = (id) => {
    const section = BY_ID[id];
    bar(title(id));
    if (!section.noHeader) rows.push(header(section));
    rows.push(...lines(section));
  };

  rows.push([{ text: report.title, span: GRID, align: 'center', size: 24 }]);
  for (const id of ['newAdmissions', 'critical', 'ward', 'lama', 'discharged', 'surgeryList', 'surgeries', 'procedures', 'radProcedures']) table(id);

  bar(title('radCounts'));
  const counts = part('radCounts').rows[0] || {};
  rows.push(BY_ID.radCounts.columns.flatMap((column) => [
    ...(column.width ? [{ text: column.label, span: column.width, align: 'left' }] : []),
    { text: text(counts[column.key]), span: column.valueWidth, align: 'left' },
  ]));

  table('ventilator');
  rows.push([{ text: '', span: GRID }]);
  table('er');

  // General Information: one numbered list that also holds the pressure sore
  // and phlebitis tables and the staff attendance lines.
  bar(title('general'));
  let number = 0;
  const general = part('general').rows;
  general.forEach((row, i) => {
    const grouped = text(row.sub) !== '';
    const follows = grouped && i > 0 && general[i - 1].item === row.item && text(general[i - 1].sub) !== '';
    if (!follows) number++;
    const lead = [
      { text: follows ? '' : `${number}.`, span: 10, align: 'center', merge: grouped ? (follows ? 'cont' : 'start') : undefined },
      { text: follows ? '' : text(row.item), span: 18, align: 'left', merge: grouped ? (follows ? 'cont' : 'start') : undefined },
    ];
    rows.push(grouped
      ? [...lead, { text: text(row.sub), span: 12, align: 'left' }, { text: text(row.value), span: 80, align: 'left' }]
      : [...lead, { text: text(row.value), span: 92, align: 'left' }]);
  });
  const nested = (id) => {
    const section = BY_ID[id];
    number++;
    const side = (first) => [
      { text: first ? `${number}.` : '', span: 10, align: 'center', merge: first ? 'start' : 'cont' },
      { text: first ? title(id) : '', span: 14, align: 'left', merge: first ? 'start' : 'cont' },
    ];
    rows.push([...side(true), ...header(section, SHADE)]);
    for (const cells of lines(section)) rows.push([...side(false), ...cells]);
  };
  nested('pressureSores');
  number++;
  rows.push([{ text: `${number}.`, span: 10, align: 'left' }, { text: '', span: 110 }]);
  nested('phlebitis');
  for (const row of part('staffing').rows) {
    number++;
    rows.push([
      { text: `${number}.`, span: 10, align: 'center' },
      { text: text(row.item), span: 14, align: 'left' },
      { text: text(row.count), span: 4, align: 'left' },
      { text: text(row.details), span: 92, align: 'left' },
    ]);
  }

  const round = part('round').fields;
  rows.push([{ text: 'ROUND OBSERVATION', span: 24, align: 'left' }, { text: text(round.observation), span: 96, align: 'left' }]);
  rows.push([{ text: 'Time:', span: 24, align: 'left' }, { text: text(round.time), span: 96, align: 'left' }]);
  rows.push([{ text: '', span: GRID }]);

  // Total 24 hours: OPD, each unit, and the total, then the totals of the day.
  const census = part('census');
  const units = census.rows.filter((row) => text(row.unit).trim() || text(row.patients).trim());
  const sum = units.reduce((n, row) => n + (Number(row.patients) || 0), 0);
  const ipd = text(census.fields.ipd) || (sum ? String(sum) : '');
  const opd = text(census.fields.opd);
  const boxes = [
    { unit: 'OPD', patients: opd },
    ...units,
    { unit: 'TOTAL', patients: ipd || opd ? String((Number(ipd) || 0) + (Number(opd) || 0)) : '' },
  ];
  const widths = spread(boxes.length, 96);
  rows.push([
    { text: 'Total 24 hours', span: 24, align: 'left', merge: 'start' },
    ...boxes.map((box, i) => ({ text: `${text(box.unit)}\n${text(box.patients)}`, span: widths[i], align: 'center' })),
  ]);
  rows.push([
    { text: '', span: 24, merge: 'cont' },
    { text: `Total IPD Patient= ${ipd}\nTotal OPD patient=${opd}`, span: 96, align: 'left' },
  ]);
  const death = (general.find((row) => row.item === 'Death') || {}).value;
  const totals = [
    ['Total New Admission', text(census.fields.newAdmission) || countText(filled('newAdmissions').length)],
    ['Total Discharge', text(census.fields.discharge) || countText(filled('discharged').length)],
    ['Total Death', text(census.fields.death) || text(death) || '0'],
  ];
  totals.forEach(([label, value], i) => {
    rows.push([
      { text: '', span: 10, merge: i ? 'cont' : 'start' },
      { text: label, span: 18, align: 'left' },
      { text: value, span: 92, align: 'left' },
    ]);
  });
  return rows;
}

// The box beside the logo and at the end: title, name, date.
function boxLines(report) {
  const by = report.preparedBy || {};
  return [text(by.role).trim() || SIGNATURE[0].fallback, text(by.name), `Date: ${displayDate(report.date)}`];
}

// "**bold**" and "==highlighted==" inside any cell.
function richRuns(value) {
  const runs = [];
  for (const piece of text(value).split(/(\*\*[^*]+\*\*|==[^=]+==)/)) {
    if (!piece) continue;
    if (piece.startsWith('**')) runs.push({ text: piece.slice(2, -2), bold: true });
    else if (piece.startsWith('==')) runs.push({ text: piece.slice(2, -2), highlight: true });
    else runs.push({ text: piece });
  }
  return runs;
}

// ---- Word ----

const PAGE = { width: 11906, height: 16838, top: 432, bottom: 288, side: 720 }; // A4; turned to landscape below
const UNIT = Math.floor((PAGE.height - 2 * PAGE.side) / GRID);
const ALIGN = { left: AlignmentType.LEFT, center: AlignmentType.CENTER, right: AlignmentType.RIGHT };
const NO_LINE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const NO_BORDERS = { top: NO_LINE, bottom: NO_LINE, left: NO_LINE, right: NO_LINE, insideHorizontal: NO_LINE, insideVertical: NO_LINE };

function wordParagraphs(cell) {
  return text(cell.text).split('\n').map(
    (line) =>
      new Paragraph({
        alignment: ALIGN[cell.align] || AlignmentType.LEFT,
        spacing: { before: 0, after: 0 },
        children: richRuns(line).map(
          (run) => new TextRun({ text: run.text, bold: cell.bold || run.bold, size: cell.size || 22, highlight: run.highlight ? 'yellow' : undefined })
        ),
      })
  );
}

function wordCell(cell) {
  return new TableCell({
    columnSpan: cell.span,
    width: { size: cell.span * UNIT, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    verticalMerge: cell.merge === 'start' ? VerticalMergeType.RESTART : cell.merge === 'cont' ? VerticalMergeType.CONTINUE : undefined,
    shading: cell.shade ? { type: ShadingType.CLEAR, fill: cell.shade, color: 'auto' } : undefined,
    margins: { top: 20, bottom: 20, left: 70, right: 70 },
    children: wordParagraphs(cell),
  });
}

function wordBox(report, width) {
  const [role, name, date] = boxLines(report);
  const centred = (value) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80, after: 80 }, children: [new TextRun({ text: value, bold: true, size: 24 })] });
  return new Table({
    width: { size: width, type: WidthType.DXA },
    columnWidths: [width],
    alignment: AlignmentType.RIGHT,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: width, type: WidthType.DXA },
            margins: { top: 60, bottom: 100, left: 140, right: 140 },
            children: [
              new Paragraph({ spacing: { before: 60, after: 80 }, children: [new TextRun({ text: role, bold: true, size: 24 })] }),
              centred(name),
              centred(date),
            ],
          }),
        ],
      }),
    ],
  });
}

async function toDocx(report) {
  const full = GRID * UNIT;
  const boxWidth = 3300;
  const picture = logoBytes();
  const logo = new Paragraph({
    spacing: { before: 500, after: 0 },
    children: picture ? [new ImageRun({ type: 'png', data: picture, transformation: { width: 150, height: 55 } })] : [],
  });
  // Logo on the left, the manager's box on the right, as on the first page of the sheet.
  const top = new Table({
    width: { size: full, type: WidthType.DXA },
    columnWidths: [full - boxWidth - 200, boxWidth + 200],
    layout: TableLayoutType.FIXED,
    borders: NO_BORDERS,
    rows: [
      new TableRow({
        children: [
          new TableCell({ width: { size: full - boxWidth - 200, type: WidthType.DXA }, borders: NO_BORDERS, verticalAlign: VerticalAlign.BOTTOM, children: [logo] }),
          new TableCell({ width: { size: boxWidth + 200, type: WidthType.DXA }, borders: NO_BORDERS, children: [wordBox(report, boxWidth), new Paragraph({ spacing: { before: 0, after: 0 }, children: [] })] }),
        ],
      }),
    ],
  });
  const sheet = new Table({
    width: { size: full, type: WidthType.DXA },
    columnWidths: Array(GRID).fill(UNIT),
    layout: TableLayoutType.FIXED,
    rows: layout(report).map((cells) => new TableRow({ cantSplit: true, children: cells.map(wordCell) })),
  });

  const document = new Document({
    creator: text((report.preparedBy || {}).name) || 'Unico Hospitals',
    title: `${report.title} ${displayDate(report.date)}`,
    styles: { default: { document: { run: { font: 'Times New Roman', size: 22 } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE.width, height: PAGE.height, orientation: PageOrientation.LANDSCAPE },
            margin: { top: PAGE.top, right: PAGE.side, bottom: PAGE.bottom, left: PAGE.side },
          },
        },
        children: [
          top,
          new Paragraph({ spacing: { before: 0, after: 120 }, children: [] }),
          sheet,
          new Paragraph({ spacing: { before: 360, after: 0 }, children: [] }),
          wordBox(report, boxWidth),
        ],
      },
    ],
  });
  return Packer.toBuffer(document);
}

// "Log Sheet For Night Supervisor- 11.10.26"
function fileName(report, extension) {
  const [day, month, year] = displayDate(report.date).split('/');
  return `Log Sheet For ${report.shift} Supervisor- ${day}.${month}.${text(year).slice(-2)}.${extension}`;
}

// ---- Print page ----

const escape = (value) => text(value).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function htmlRows(rows) {
  // A merged cell becomes one tall cell: count the rows below that continue it at the same place.
  const startOf = (cells, index) => cells.slice(0, index).reduce((n, cell) => n + cell.span, 0);
  return rows.map((cells, r) => {
    const out = cells.map((cell, c) => {
      if (cell.merge === 'cont') return '';
      let tall = 1;
      if (cell.merge === 'start') {
        const at = startOf(cells, c);
        while (rows[r + tall] && rows[r + tall].some((below, i) => below.merge === 'cont' && startOf(rows[r + tall], i) === at)) tall++;
      }
      const inner = text(cell.text)
        .split('\n')
        .map((line) => richRuns(line).map((run) => (run.bold ? `<b>${escape(run.text)}</b>` : run.highlight ? `<mark>${escape(run.text)}</mark>` : escape(run.text))).join(''))
        .join('<br>');
      const style = [
        `text-align:${cell.align || 'left'}`,
        cell.bold ? 'font-weight:bold' : '',
        cell.shade ? `background:#${cell.shade}` : '',
        cell.size ? `font-size:${cell.size / 2}pt` : '',
      ].filter(Boolean).join(';');
      return `<td colspan="${cell.span}"${tall > 1 ? ` rowspan="${tall}"` : ''} style="${style}">${inner}</td>`;
    });
    return `<tr>${out.join('')}</tr>`;
  }).join('\n');
}

function toHtml(report) {
  const box = boxLines(report).map((line, i) => `<div${i ? ' class="mid"' : ''}>${escape(line)}</div>`).join('');
  const picture = logoBytes();
  const logo = picture ? `<img class="logo" src="data:image/png;base64,${picture.toString('base64')}" alt="Unico Hospitals">` : '<span></span>';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${escape(fileName(report, 'pdf').replace(/\.pdf$/, ''))}</title>
<style>
  @page { size: A4 landscape; margin: 0.3in 0.5in 0.2in; }
  body { font: 11pt "Times New Roman", Times, serif; color: #000; margin: 0 auto; max-width: 10.7in; padding: 12px; }
  .top { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 10px; }
  .logo { height: 55px; }
  .box { width: 2.3in; border: 1px solid #000; padding: 6px 10px 10px; font-weight: bold; font-size: 12pt; line-height: 1.9; }
  .box .mid { text-align: center; }
  table.sheet { border-collapse: collapse; width: 100%; table-layout: fixed; }
  table.sheet td { border: 1px solid #000; padding: 1px 5px; height: 13pt; vertical-align: middle; overflow-wrap: anywhere; }
  tr { break-inside: avoid; }
  mark { background: #ff0; }
  .end { display: flex; justify-content: flex-end; margin-top: 24px; }
  .bar { margin-bottom: 12px; font-family: "Segoe UI", sans-serif; }
  .bar button { font: inherit; padding: 8px 16px; cursor: pointer; }
  @media print { .bar { display: none; } body { padding: 0; max-width: none; } }
</style></head>
<body>
<div class="bar"><button onclick="window.print()">Print / Save as PDF</button></div>
<div class="top">${logo}<div class="box">${box}</div></div>
<table class="sheet"><colgroup>${'<col>'.repeat(GRID)}</colgroup>
${htmlRows(layout(report))}
</table>
<div class="end"><div class="box">${box}</div></div>
</body></html>`;
}

module.exports = { toDocx, toHtml, fileName, displayDate, isFilled, layout };
