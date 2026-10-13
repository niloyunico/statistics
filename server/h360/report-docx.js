// The supervisor report of Print & Export as a Word file.
//
// The page sends what it is showing (its headings and tables, after the template,
// the switched-off sections and the custom columns have been applied), and this
// draws the same thing in Word. The Word LOG SHEET, the hospital's paper form, is
// a different document: render.js.
const fs = require('fs');
const path = require('path');
const {
  AlignmentType, BorderStyle, Document, HeightRule, ImageRun, Packer, Paragraph, ShadingType, Table, TableCell,
  TableLayoutType, TableRow, TabStopType, TextRun, VerticalAlign, WidthType,
} = require('docx');

const LOGO = path.join(__dirname, 'logo.png');
const PAGE = { width: 11906, height: 16838, margin: 720 };   // A4 upright, half-inch margins
const FULL = PAGE.width - 2 * PAGE.margin;
const LINE = { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' };
const NO_LINE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const NO_BORDERS = { top: NO_LINE, bottom: NO_LINE, left: NO_LINE, right: NO_LINE };
const BORDERS = { top: LINE, bottom: LINE, left: LINE, right: LINE };
const LIMIT = { blocks: 400, rows: 3000, cells: 80, text: 6000 };

const text = (value) => (value === null || value === undefined ? '' : String(value)).slice(0, LIMIT.text);
const fail = (message) => Object.assign(new Error(message), { status: 400 });

// What the page sent, checked and cut to size: this is typed by people and posted by a browser.
function clean(body) {
  const src = body && typeof body === 'object' ? body : {};
  const header = src.header && typeof src.header === 'object' ? src.header : {};
  const blocks = (Array.isArray(src.blocks) ? src.blocks : []).slice(0, LIMIT.blocks).map((block) => {
    if (!block || block.type !== 'table') return { type: 'heading', text: text(block && block.text) };
    const rows = (Array.isArray(block.rows) ? block.rows : []).slice(0, LIMIT.rows)
      .map((row) => (Array.isArray(row) ? row : []).slice(0, LIMIT.cells).map((cell) => ({ t: text(cell && cell.t), h: Boolean(cell && cell.h), c: cell && (cell.c === 'tot' || cell.c === 'none') ? cell.c : '' })))
      .filter((row) => row.length);
    const columns = rows.reduce((n, row) => Math.max(n, row.length), 0);
    const given = (Array.isArray(block.widths) ? block.widths : []).map(Number);
    const usable = given.length === columns && given.every((n) => Number.isFinite(n) && n > 0);
    const sum = usable ? given.reduce((a, b) => a + b, 0) : columns;
    return {
      type: 'table', rows, columns,
      kind: ['across', 'pairs', 'sign'].includes(block.kind) ? block.kind : 'rows',
      head: Math.max(0, Math.min(Number(block.head) || 0, rows.length)),
      widths: Array.from({ length: columns }, (_, i) => (usable ? given[i] : 1) / sum),
    };
  }).filter((block) => block.type === 'heading' ? block.text : block.columns);
  if (!blocks.length) throw fail('There is nothing on the report to export.');
  return {
    hospital: text(header.hospital), title: text(header.title),
    lines: (Array.isArray(header.lines) ? header.lines : []).slice(0, 8).map((line) => [text(line && line[0]), text(line && line[1])]),
    blocks,
    footer: (Array.isArray(src.footer) ? src.footer : []).slice(0, 2).map(text),
  };
}

const run = (value, opts) => new TextRun({ text: value, size: 17, ...opts });
const para = (children, opts) => new Paragraph({ spacing: { before: 0, after: 0 }, children, ...opts });

function tableOf(block) {
  // The page's own proportions, but no column narrower than its longest word: the type is
  // larger here than on the page, and "Departm-ent" or a number broken in two reads badly.
  // What that takes is given up by the wide columns, in proportion to their room to spare.
  const longest = (i) => block.rows.reduce((n, row) => Math.max(n, ...text(row[i] && row[i].t).split(/\s+/).map((word) => word.length)), 0);
  const least = block.widths.map((_, i) => Math.min(longest(i), 16) * 92 + 150);
  let widths = block.widths.map((share) => share * FULL);
  if (least.reduce((a, b) => a + b, 0) <= FULL) {
    const short = widths.reduce((sum, w, i) => sum + Math.max(least[i] - w, 0), 0);
    const spare = widths.reduce((sum, w, i) => sum + Math.max(w - least[i], 0), 0);
    widths = widths.map((w, i) => (w < least[i] ? least[i] : w - (spare ? (w - least[i]) * short / spare : 0)));
  }
  // Whole twips, and the last column takes what rounding left over.
  widths = widths.map((w) => Math.max(Math.floor(w), 200));
  widths[widths.length - 1] += FULL - widths.reduce((a, b) => a + b, 0);
  const centred = block.kind === 'across';
  const cellOf = (cell, i, body) => {
    const none = cell.c === 'none';
    const total = cell.c === 'tot';
    const fill = none ? undefined : total ? 'DBEAFE' : cell.h ? 'EEF2F7' : undefined;
    const small = cell.h && (block.kind === 'across' || block.kind === 'pairs');
    return new TableCell({
      width: { size: widths[i], type: WidthType.DXA },
      borders: none ? NO_BORDERS : BORDERS,
      verticalAlign: centred || block.kind === 'pairs' ? VerticalAlign.CENTER : VerticalAlign.TOP,
      shading: fill ? { type: ShadingType.CLEAR, fill, color: 'auto' } : undefined,
      margins: { top: 30, bottom: 30, left: 60, right: 60 },
      children: (none ? [''] : cell.t.split('\n')).map((line) => para(
        [run(line, { bold: cell.h || total || (centred && body), size: small ? 15 : 17 })],
        { alignment: centred ? AlignmentType.CENTER : AlignmentType.LEFT })),
    });
  };
  return new Table({
    width: { size: FULL, type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    rows: block.rows.map((row, r) => new TableRow({
      cantSplit: true,
      tableHeader: r < block.head,
      // room to sign in
      height: block.kind === 'sign' && r >= block.head ? { value: 760, rule: HeightRule.ATLEAST } : undefined,
      // a short row is filled out, so every row has every column
      children: Array.from({ length: block.columns }, (_, i) => cellOf(row[i] || { t: '', h: false, c: 'none' }, i, r >= block.head && !(row[i] && row[i].h))),
    })),
  });
}

function headOf(doc) {
  let picture = null;
  try { picture = fs.readFileSync(LOGO); } catch (e) { /* the report is still the report without its logo */ }
  const rule = { style: BorderStyle.SINGLE, size: 16, color: '1E3A8A' };
  const borders = { ...NO_BORDERS, bottom: rule };
  const widths = [picture ? 1900 : 0, 0, 3500];
  widths[1] = FULL - widths[0] - widths[2];
  const cell = (i, children, alignment) => new TableCell({
    width: { size: widths[i], type: WidthType.DXA }, borders, verticalAlign: VerticalAlign.CENTER,
    margins: { top: 0, bottom: 90, left: i ? 80 : 0, right: 0 },
    children: children.length ? children.map((c) => para(c, { alignment })) : [para([])],
  });
  const cells = [
    cell(1, [[run(doc.hospital, { bold: true, size: 26, color: '0F172A' })], [run(doc.title, { bold: true, size: 21, color: '1E3A8A' })]], AlignmentType.LEFT),
    cell(2, doc.lines.map(([label, value]) => [run(label + ' ', { bold: true, color: '334155' }), run(value, { color: '334155' })]), AlignmentType.RIGHT),
  ];
  if (picture) cells.unshift(cell(0, [[new ImageRun({ type: 'png', data: picture, transformation: { width: 115, height: 42 } })]], AlignmentType.LEFT));
  return new Table({
    width: { size: FULL, type: WidthType.DXA }, columnWidths: picture ? widths : widths.slice(1), layout: TableLayoutType.FIXED,
    borders: { ...NO_BORDERS, insideHorizontal: NO_LINE, insideVertical: NO_LINE },
    rows: [new TableRow({ children: cells })],
  });
}

async function toDocx(body) {
  const doc = clean(body);
  const children = [headOf(doc), para([], { spacing: { before: 0, after: 60 } })];
  for (const block of doc.blocks) {
    if (block.type === 'heading') {
      children.push(para([run(block.text, { bold: true, size: 21, color: '0F172A' })], {
        keepNext: true, spacing: { before: 150, after: 50 }, indent: { left: 110 },
        border: { left: { style: BorderStyle.SINGLE, size: 18, color: '2563EB', space: 5 } },
      }));
    } else {
      // The space after a table: two tables that touch would join into one in Word.
      children.push(tableOf(block), para([], { spacing: { before: 0, after: block.kind === 'sign' ? 0 : 40 } }));
    }
  }
  if (doc.footer.some(Boolean)) {
    children.push(para([run(doc.footer[0] || '', { size: 14, color: '64748B' }), run('\t' + (doc.footer[1] || ''), { size: 14, color: '64748B' })], {
      spacing: { before: 160, after: 0 }, tabStops: [{ type: TabStopType.RIGHT, position: FULL }],
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1', space: 4 } },
    }));
  }
  const document = new Document({
    creator: doc.hospital || 'Unico Hospitals',
    title: doc.title,
    styles: { default: { document: { run: { font: 'Calibri', size: 17 } } } },
    sections: [{
      properties: { page: { size: { width: PAGE.width, height: PAGE.height }, margin: { top: PAGE.margin, right: PAGE.margin, bottom: PAGE.margin, left: PAGE.margin } } },
      children,
    }],
  });
  return Packer.toBuffer(document);
}

module.exports = { toDocx, clean };
