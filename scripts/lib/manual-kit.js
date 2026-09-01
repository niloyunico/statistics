/* Shared data + presentation kit for the Quality Indicator Manual builders.
 *
 * Used by scripts/build-quality-manual.js for BOTH the hospital-wide manual and the
 * per-department booklets it writes under --split, so the two can never drift apart.
 * (There is no longer a separate "consolidated" edition — the hospital-wide manual now
 * defines every indicator once in a single alphabetical sequence.)
 *
 * Definitions only — neither manual carries recorded figures, so nothing here computes
 * a value. (Restoring performance would mean re-porting the chain from
 * renderer/unico/quality-console.jsx:124-246; api/report_pdf.py:1247-1400 is a verified port.)
 */
const path = require('path');
const fs = require('fs');
const D = require(path.join(__dirname, '..', '..', 'server', 'node_modules', 'docx'));
const {
  Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle,
  AlignmentType, VerticalAlign, Header, Footer, SimpleField, HeadingLevel, TabStopType,
} = D;

/* ============================ text helpers ============================ */
function measureName(f) {
  if (f === 'pct') return 'Percentage';
  if (f === 'rate1000' || f === 'rate100') return 'Rate';
  if (f === 'avg') return 'Average';
  return 'Count';
}
/* Benchmark sentence — same rule the Quality console uses (quality-console.jsx:296). */
function benchExpr(ind) {
  const v = ind.benchmarkValue;
  if (v == null || v === '') return ind.benchmark || 'No benchmark set';
  const sym = ind.goalDirection === 'higher_is_better' ? '≥' : '≤';
  const pct = ind.formula === 'pct' ? '%' : '';
  const unit = (ind.unit && !pct && ind.unit !== 'count') ? (' ' + ind.unit) : '';
  return sym + ' ' + v + pct + unit;
}
function formulaText(ind) {
  const f = ind.formula;
  const num = ind.numLabel || ind.name || 'numerator';
  const den = ind.denLabel || 'denominator';
  if (f === 'direct') return (ind.name || 'Value') + ' = entered value';
  if (f === 'count') return 'Value = ' + num;
  if (f === 'avg') return num + ' ÷ ' + den;
  return '(' + num + ' ÷ ' + den + ') ' + (f === 'rate1000' ? '× 1000' : '× 100');
}
/* Names the calculation type so the reader can see WHICH kind of formula this is —
   `pct` and `rate100` do identical arithmetic and differ only in how the result reads. */
function formulaKind(ind) {
  switch (ind.formula) {
    case 'pct': return 'Percentage';
    case 'rate1000': return 'Rate per 1 000';
    case 'rate100': return 'Rate per 100';
    case 'avg': return 'Average';
    case 'count': return 'Event count';
    case 'direct': return 'Value entered directly';
    default: return 'Event count';
  }
}
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const nonEmpty = (v) => v != null && v !== '';

/* ============================ data ============================ */
/* Month/quarter-keyed maps a patch merges into rather than replaces. */
const NESTED = ['months', 'monthRemarks', 'mNum', 'mDen', 'quarters', 'quarterRemarks', 'qNum', 'qDen', 'incidents', 'mGroups', 'capa'];

/* The effective list a department reports: base − overlay-removed + overlay-added, with
   indPatches merged over BOTH (a patch applies to added indicators too, not only base). */
function effectiveIndicators(dep, ov) {
  const q = dep.quality || {};
  const o = (ov && ov.depts && ov.depts[q.key]) || {};
  const removed = new Set(o.indRemoved || []);
  const patches = o.indPatches || {};
  const apply = (ind) => {
    const p = patches[ind.id];
    if (!p) return ind;
    const out = Object.assign({}, ind, p);
    NESTED.forEach((f) => { if (p[f]) out[f] = Object.assign({}, ind[f] || {}, p[f]); });
    return out;
  };
  return (q.indicators || []).filter((i) => !removed.has(i.id)).map(apply)
    .concat((o.indAdded || []).filter((i) => !removed.has(i.id)).map(apply));
}

/* Fields that change HOW an indicator is measured or judged. A difference in these
   between departments is reported to the reader; wording drift elsewhere is not. */
const MATERIAL = [
  ['formula', 'Calculation', (v) => measureName(v)],
  ['unit', 'Unit', (v) => v || '—'],
  ['benchmark', 'Benchmark', (v) => v || 'none set'],
  ['goalDirection', 'Goal', (v) => (v === 'higher_is_better' ? 'higher is better' : 'lower is better')],
];
/* Definition prose: a difference here is noted as a footnote, not printed twice. */
const PROSE = ['numeratorDef', 'denominatorDef', 'numLabel', 'denLabel', 'reference'];

/* How complete a definition is — used to pick the representative variant. */
function completeness(ind) {
  return ['numeratorDef', 'denominatorDef', 'benchmark', 'benchmarkNote', 'reference', 'referenceUrl', 'numLabel', 'denLabel', 'unit']
    .reduce((n, f) => n + (nonEmpty(ind[f]) ? 1 : 0), 0);
}

/* Group every indicator instance across all departments by its display name.
   Returns [{ name, key, instances:[{deptKey,deptName,ind}], depts:[names], rep, variations, proseDiffers }]
   `rep` is the variant used by the MOST departments (ties broken on completeness), so the
   shared definition shown is the one the hospital actually uses most widely. */
function groupByIndicator(deptData) {
  const g = new Map();
  deptData.forEach((d) => d.inds.forEach((ind) => {
    const k = norm(ind.name);
    if (!g.has(k)) g.set(k, { key: k, name: ind.name, instances: [] });
    /* deptKey is the QUALITY AREA key ('SICU') — what responsibles are indexed by.
       deptId is the department id ('sicu') — what the purpose tables are keyed by.
       They are not interchangeable; passing one where the other is expected silently
       yields no match rather than an error. */
    g.get(k).instances.push({ deptKey: d.q.key, deptId: String(d.dep.id || d.dep._id), deptName: d.q.name, ind });
  }));

  return [...g.values()].map((grp) => {
    grp.depts = [...new Set(grp.instances.map((x) => x.deptName))];

    // representative = most-used variant, then most complete
    const tally = new Map();
    grp.instances.forEach((x) => {
      const sig = JSON.stringify(MATERIAL.map(([f]) => x.ind[f]));
      if (!tally.has(sig)) tally.set(sig, []);
      tally.get(sig).push(x);
    });
    const winner = [...tally.values()].sort((a, b) => b.length - a.length
      || completeness(b[0].ind) - completeness(a[0].ind))[0];
    grp.rep = winner.slice().sort((a, b) => completeness(b.ind) - completeness(a.ind))[0].ind;

    // material variations, reported to the reader
    grp.variations = [];
    MATERIAL.forEach(([f, label, fmt]) => {
      const by = new Map();
      grp.instances.forEach((x) => {
        const v = String(x.ind[f] == null ? '' : x.ind[f]);
        if (!by.has(v)) by.set(v, []);
        by.get(v).push(x.deptName);
      });
      if (by.size > 1) {
        grp.variations.push({
          label,
          options: [...by.entries()].sort((a, b) => b[1].length - a[1].length)
            .map(([v, depts]) => ({ shown: fmt(v), depts })),
        });
      }
    });
    grp.proseDiffers = PROSE.some((f) => new Set(grp.instances.map((x) => String(x.ind[f] == null ? '' : x.ind[f]))).size > 1);
    return grp;
  }).sort((a, b) => a.name.localeCompare(b.name));
}

/* Load everything both manuals need. */
async function loadManualData(db) {
  const deps = (await db.collection('departments').find({ 'quality.key': { $exists: true } }).toArray())
    .sort((a, b) => (a.order || 0) - (b.order || 0) || String(a.quality.name).localeCompare(String(b.quality.name)));
  const app = await db.collection('appdata').findOne({ _id: 'shared' });
  let ov = null;
  try { ov = app && app.data && app.data['unico_quality_v2'] ? JSON.parse(app.data['unico_quality_v2']) : null; } catch (e) { ov = null; }
  /* Authorisation names, credit and confidentiality wording — see scripts/set-manual-authorisation.js */
  let meta = {};
  try { meta = app && app.data && app.data['unico_manual_meta'] ? JSON.parse(app.data['unico_manual_meta']) : {}; } catch (e) { meta = {}; }
  const formulas = await db.collection('qualityFormulas').find({}).toArray();
  const responsibles = await db.collection('responsibles').find({ active: { $ne: false } }).toArray();

  /* area key -> indicator id -> owners. An EMPTY qualityIndicators list for an area means
     that person covers every indicator in it. */
  const ownersFor = (areaKey, indId) => {
    const out = [];
    responsibles.forEach((r) => {
      const areas = r.qualityIndicators || {};
      const covers = Object.prototype.hasOwnProperty.call(areas, areaKey)
        ? (!Array.isArray(areas[areaKey]) || !areas[areaKey].length || areas[areaKey].indexOf(indId) >= 0)
        : (r.allQualityAreas && (r.qualityAreas || []).indexOf(areaKey) >= 0);
      if (covers) out.push(r.name + (r.title ? ' — ' + r.title : ''));
    });
    return [...new Set(out)];
  };

  const deptData = deps.map((dep) => ({
    dep, q: dep.quality,
    inds: effectiveIndicators(dep, ov).slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))),
  }));

  const groups = groupByIndicator(deptData);

  const references = new Map();
  deptData.forEach((d) => d.inds.forEach((i) => {
    if (i.reference) { const k = String(i.reference).trim(); if (!references.has(k)) references.set(k, i.referenceUrl || ''); }
  }));
  const usedNames = new Set(groups.map((g) => g.key));
  const unusedCatalogue = formulas
    .filter((f) => ![f.canonicalName].concat(f.aliases || []).map(norm).some((n) => usedNames.has(n)))
    .sort((a, b) => String(a.canonicalName).localeCompare(String(b.canonicalName)));

  return { deptData, groups, ownersFor, references, unusedCatalogue, formulas, meta };
}

/* ============================ presentation ============================ */
/* Palette taken from the hospital logo: blue #0090CA and teal #3AB5A7.
 *
 * PRINT-SAFE RULE: colour is decoration, never information. Every piece of text is either
 * near-black (INK) or a darkened brand blue (ACCENT) that still reads at ~5:1 contrast on
 * white; fills are pale tints that reduce to light grey on a mono printer, and nothing is
 * distinguished by hue alone. So a black-and-white print loses the colour and keeps every
 * word legible and every distinction intact. BRAND/TEAL are used only for rules and the
 * logo, never for text a reader must be able to read. */
const INK = '1A2433', MUTED = '6B7684', LINE = 'DDE3EA', LABEL_BG = 'FAFBFC';
const BRAND = '0090CA', TEAL = '3AB5A7';
const ACCENT = '00648C';        // darkened brand blue — legible as text, and dark in mono
const HEAD_BG = 'E8F4FA';       // pale brand tint for table headers; prints as light grey
const BAND_BG = 'F4FAFD';
const thin = { style: BorderStyle.SINGLE, size: 4, color: LINE };
const allThin = { top: thin, bottom: thin, left: thin, right: thin, insideHorizontal: thin, insideVertical: thin };
const none = { style: BorderStyle.NONE };
const noBorders = { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none };

const txt = (t, o) => new Paragraph({
  children: [new TextRun({
    text: String(t == null ? '' : t), bold: !!(o && o.bold), italics: !!(o && o.italics),
    size: (o && o.size) || 19, color: (o && o.color) || INK,
  })],
  alignment: (o && o.align) || AlignmentType.LEFT,
  spacing: { before: 20, after: 20 },
});
const para = (t, o) => new Paragraph(Object.assign({
  children: [new TextRun({ text: String(t == null ? '' : t), size: 20, color: INK })],
  spacing: { after: 140, line: 280 },
}, o || {}));

function cell(children, o) {
  o = o || {};
  return new TableCell({
    children: Array.isArray(children) ? children : [children],
    shading: o.fill ? { fill: o.fill } : undefined,
    width: o.width ? { size: o.width, type: WidthType.PERCENTAGE } : undefined,
    margins: { top: 70, bottom: 70, left: 120, right: 120 },
    verticalAlign: VerticalAlign.CENTER,
  });
}
const table = (rows) => new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: allThin, rows });
const headCell = (t, w) => cell(txt(t, { bold: true, size: 17 }), { width: w, fill: HEAD_BG });

/* label / value row. cantSplit stops a long definition being torn across a page break. */
function defRow(label, value, valueOpts) {
  return new TableRow({
    cantSplit: true,
    children: [
      cell(txt(label, { bold: true, size: 17, color: MUTED }), { width: 20, fill: LABEL_BG }),
      cell(Array.isArray(value) ? value : txt(value, valueOpts), { width: 80 }),
    ],
  });
}

/* The definition block shared by both editions. `extraRows` lets the consolidated
   edition append its "reported by" and "departmental variations" rows. */
function definitionRows(ind, opts) {
  opts = opts || {};
  const rows = [
    defRow('Measure', measureName(ind.formula) + (ind.unit && ind.unit !== 'count' ? ' — ' + ind.unit : '')),
    /* The calculation type is named above the expression, because "(a ÷ b) × 100" alone
       does not tell the reader whether the result is a percentage or a rate per 100. */
    defRow('Formula', [
      new Paragraph({ children: [new TextRun({ text: formulaKind(ind), bold: true, size: 17, color: ACCENT })], spacing: { after: 40 } }),
      new Paragraph({ children: [new TextRun({ text: formulaText(ind), size: 19, color: INK })] }),
    ]),
  ];
  /* ONE "Why we measure this" row, not two. The hospital-wide reason and the departmental
     reasons are the same question answered at two levels — splitting them across two rows
     made the reader carry the general answer down the page to make sense of the specific
     one, and on a shared indicator it put the two halves either side of the numerator and
     denominator. They are stacked in a single cell instead: the general reason first, then
     the departmental reasons under a lead-in.
       opts.purpose      hospital-wide reason (string)
       opts.deptReasons  [{dept, text}] — used by the combined manual, any number of them
       opts.deptPurpose  a single department's reason (string) — used by the per-department
                         booklets, where there is only ever one department to speak for */
  const reasons = (opts.deptReasons || []).filter((r) => r && r.text);
  if (!reasons.length && opts.deptPurpose) reasons.push({ text: opts.deptPurpose });
  /* ONE paragraph. The departmental reason is appended to the hospital-wide one and read
     as continuous prose — no sub-heading, no per-department grid. A breakdown row per
     reporting department turned a two-sentence answer into half a page of table on the
     indicators reported most widely, which is exactly where the reader wants the short
     answer. Where several departments report an indicator, only the hospital-wide reason
     is given here; each department's own reason stays on its schedule in Section 3 and in
     its standalone booklet, which is where a department looks anyway. */
  const oneParagraph = [opts.purpose, reasons.length === 1 ? reasons[0].text : '']
    .filter(Boolean).join(' ');
  if (oneParagraph) rows.push(defRow('Why we measure this', oneParagraph, { size: 18 }));
  if (ind.numeratorDef) rows.push(defRow('Numerator', ind.numeratorDef, { size: 18 }));
  if (ind.denominatorDef) {
    /* denAdminOnly marks a denominator the console will not accept from a data collector
       — a staff headcount, a bed complement. Saying so on the entry stops a unit chasing
       a figure it is not the one who supplies. */
    rows.push(defRow('Denominator', ind.denAdminOnly
      ? [new Paragraph({ children: [new TextRun({ text: ind.denominatorDef, size: 18, color: INK })], spacing: { after: 60 } }),
         new Paragraph({ children: [new TextRun({ text: 'Set centrally by the administrator — data collectors enter the numerator only.', size: 16, italics: true, color: MUTED })] })]
      : ind.denominatorDef, { size: 18 }));
  }
  rows.push(defRow('Benchmark', benchExpr(ind) + (ind.goalDirection === 'higher_is_better' ? '   (higher is better)' : '   (lower is better)')));
  if (ind.benchmarkNote) rows.push(defRow('Benchmark note', ind.benchmarkNote, { size: 17, color: MUTED }));
  if (ind.reference) {
    rows.push(defRow('Reference', ind.referenceUrl
      ? [new Paragraph({ children: [new TextRun({ text: ind.reference, size: 18 })], spacing: { after: 40 } }),
         new Paragraph({ children: [new D.ExternalHyperlink({ children: [new TextRun({ text: ind.referenceUrl, size: 16, style: 'Hyperlink' })], link: ind.referenceUrl })] })]
      : ind.reference, { size: 18 }));
  }
  (opts.extraRows || []).forEach((r) => rows.push(r));
  if (ind.remarks) rows.push(defRow('Remarks', ind.remarks, { size: 18 }));
  return rows;
}

/* A4 page + running header + page numbers, cover left bare. */
function sectionShell(children, headerTitle, confidential) {
  const CONTENT_W = 11906 - 1000 - 1000; // page width less both margins — position of the right tab
  return {
    properties: {
      page: { size: { width: 11906, height: 16838 }, margin: { top: 1100, bottom: 1100, left: 1000, right: 1000, header: 560, footer: 560 } },
      titlePage: true,
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          children: [new TextRun({ text: headerTitle, size: 16, color: MUTED })],
          alignment: AlignmentType.RIGHT,
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: LINE, space: 6 } },
        })],
      }),
    },
    /* PAGE / NUMPAGES as w:fldSimple, NOT as a TextRun child. Building the field from
       fldChar runs puts begin/instrText/separate/end inside ONE run with no result
       placeholder, and Word then renders the footer blank or frozen instead of
       recomputing it per page. fldSimple is the form Word always recalculates. */
    footers: {
      default: new Footer({
        children: [new Paragraph({
          /* Confidentiality left, page number right, on one ruled line. */
          tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W }],
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: LINE, space: 6 } },
          children: [
            new TextRun({ text: confidential || '', size: 15, color: MUTED, italics: true }),
            new TextRun({ text: '\t', size: 15 }),
            new TextRun({ text: 'Page ', size: 16, color: MUTED }),
            new SimpleField('PAGE'),
            new TextRun({ text: ' of ', size: 16, color: MUTED }),
            new SimpleField('NUMPAGES'),
          ],
        })],
      }),
    },
    children,
  };
}

/* Heading styles MUST be supplied as `default.heading1/heading2`, not as `paragraphStyles`.
 * Two reasons, both of which broke the table of contents:
 *   1. paragraphStyles APPENDS a second style carrying the same w:styleId as docx's own
 *      built-in Heading1/Heading2 — duplicate style ids, which Word resolves arbitrarily.
 *   2. Neither the built-ins nor an appended style carry <w:outlineLvl>, and `TOC \o "1-2"`
 *      collects paragraphs by OUTLINE LEVEL. With no outline level anywhere in the file the
 *      TOC has nothing to collect, so it stays empty however many times F9 is pressed.
 * `outlineLevel` below is what actually makes the contents list build. */
const docStyles = {
  default: {
    document: { run: { font: 'Calibri', size: 20, color: INK } },
    heading1: {
      run: { size: 32, bold: true, color: ACCENT },
      paragraph: {
        outlineLevel: 0,
        spacing: { before: 200, after: 200 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: LINE, space: 8 } },
      },
    },
    heading2: {
      run: { size: 23, bold: true, color: INK },
      paragraph: { outlineLevel: 1, spacing: { before: 300, after: 130 } },
    },
  },
};

/* Logo files, read once. Missing assets are not an error — the manual simply builds
   without a logo rather than failing the whole run. */
let _logo;
function readLogo() {
  if (_logo !== undefined) return _logo;
  try {
    const dir = path.join(__dirname, '..', '..', 'assets');
    _logo = { svg: fs.readFileSync(path.join(dir, 'logo.svg')), png: fs.readFileSync(path.join(dir, 'logo.png')) };
  } catch (e) { _logo = null; }
  return _logo;
}

/* Title page block shared by every edition.
 * The four sign-off columns replace the old blank Prepared/Reviewed/Approved rows and
 * match the authorisation block the app prints on its reports. Names come from
 * appdata.unico_manual_meta (see scripts/set-manual-authorisation.js) — the app's own
 * names live in browser localStorage, which a build script cannot read. */
function titlePage(opts) {
  const meta = opts.meta || {};
  const out = [new Paragraph({ text: '', spacing: { before: 900 } })];

  /* Logo: the SVG is the primary so it stays sharp at any zoom or print resolution, with
     a 4x PNG fallback for viewers that do not render SVG (Word before 2016, Google Docs).
     Both are read from assets/ rather than the author's desktop so the build is portable. */
  const logo = readLogo();
  if (logo) {
    out.push(new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { after: 260 },
      children: [new D.ImageRun({
        type: 'svg', data: logo.svg, fallback: { type: 'png', data: logo.png },
        transformation: { width: 214, height: 80 }, // 160.832 x 60 pt at 4:3 => points
      })],
    }));
  }
  if (meta.org) {
    out.push(new Paragraph({ children: [new TextRun({ text: meta.org.toUpperCase(), bold: true, size: 22, color: ACCENT })], alignment: AlignmentType.CENTER, spacing: { after: 60 } }));
  }
  /* Brand rule under the organisation name — decoration only; it carries no meaning, so
     losing its colour in a mono print costs nothing. */
  out.push(new Paragraph({
    text: '', alignment: AlignmentType.CENTER, spacing: { after: 300 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: BRAND, space: 1 } },
  }));
  out.push(new Paragraph({ children: [new TextRun({ text: opts.line1, bold: true, size: 56, color: INK })], alignment: AlignmentType.CENTER, spacing: { after: 60 } }));
  out.push(new Paragraph({ children: [new TextRun({ text: opts.line2, bold: true, size: 56, color: ACCENT })], alignment: AlignmentType.CENTER, spacing: { after: 200 } }));
  out.push(new Paragraph({ children: [new TextRun({ text: opts.subtitle, size: 22, color: MUTED, italics: true })], alignment: AlignmentType.CENTER, spacing: { after: 620 } }));

  out.push(new Table({
    width: { size: 70, type: WidthType.PERCENTAGE }, borders: allThin, alignment: AlignmentType.CENTER,
    rows: opts.facts.concat([['Issue date', opts.issued], ['Revision', '1.0']])
      .map(([k, v]) => new TableRow({
        children: [cell(txt(k, { bold: true, size: 17, color: MUTED }), { width: 45, fill: LABEL_BG }), cell(txt(v || ' '), { width: 55 })],
      })),
  }));

  /* ---- authorisation ---- */
  const sign = Array.isArray(meta.sign) ? meta.sign : [];
  if (sign.length) {
    out.push(new Paragraph({
      children: [new TextRun({ text: 'AUTHORISATION' + (meta.org ? ' · ' + meta.org.toUpperCase() : ''), bold: true, size: 16, color: ACCENT })],
      spacing: { before: 560, after: 60 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: BRAND, space: 4 } },
    }));
    const colW = Math.floor(100 / sign.length);
    const sigCell = (children, extra) => new TableCell(Object.assign({
      children, borders: noBorders, margins: { top: 0, bottom: 0, left: 0, right: 200 },
      width: { size: colW, type: WidthType.PERCENTAGE },
    }, extra || {}));
    out.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE }, borders: noBorders,
      rows: [
        /* Empty cell with only a bottom border = the line that is actually signed on.
           The tall top margin is the signing space itself — without it the rule sits
           against the heading and there is nowhere to put a pen. */
        new TableRow({ children: sign.map(() => sigCell([new Paragraph({ text: '' })], {
          borders: { top: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.SINGLE, size: 6, color: INK } },
          margins: { top: 900, bottom: 0, left: 0, right: 200 },
        })) }),
        new TableRow({ children: sign.map((s) => sigCell([new Paragraph({
          children: [new TextRun({ text: s.name || ' ', bold: true, size: 18, color: INK })], spacing: { before: 80 },
        })])) }),
        new TableRow({ children: sign.map((s) => sigCell([new Paragraph({
          children: [new TextRun({ text: s.title || '', size: 16, color: INK })],
        })])) }),
        new TableRow({ children: sign.map((s) => sigCell([new Paragraph({
          children: [new TextRun({ text: s.role || '', size: 14, bold: true, color: ACCENT })], spacing: { before: 40 },
        })])) }),
        /* Date line — an authorisation without a date is not much of an authorisation. */
        new TableRow({ children: sign.map(() => sigCell([new Paragraph({
          children: [new TextRun({ text: 'Date: ', size: 14, color: MUTED }), new TextRun({ text: '__________', size: 14, color: MUTED })],
          spacing: { before: 120 },
        })])) }),
      ],
    }));
  }

  if (meta.credit) {
    out.push(new Paragraph({
      children: [new TextRun({ text: meta.credit, size: 16, color: MUTED })],
      spacing: { before: 560, after: 90 },
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: LINE, space: 8 } },
    }));
  }
  if (meta.confidentialLong) {
    out.push(new Paragraph({ children: [new TextRun({ text: meta.confidentialLong, size: 15, color: MUTED, italics: true })] }));
  }
  return out;
}

module.exports = {
  D, HeadingLevel, Paragraph, TextRun, TableRow,
  measureName, benchExpr, formulaText, formulaKind, norm, nonEmpty,
  effectiveIndicators, groupByIndicator, loadManualData,
  INK, MUTED, ACCENT, LINE, HEAD_BG, LABEL_BG, BAND_BG, BRAND, TEAL, allThin,
  txt, para, cell, table, headCell, defRow, definitionRows,
  sectionShell, docStyles, titlePage,
};
