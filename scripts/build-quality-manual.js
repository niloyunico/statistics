/* Build the Quality Indicator Manual — ONE Word booklet covering every nursing quality
 * indicator the hospital reports, in a single combined sequence.
 *
 *   Section 1 — Indicator register.  Every indicator in the hospital, A-Z, on one sheet:
 *               measure, benchmark, how many departments report it, where it is defined.
 *   Section 2 — Indicator definitions.  The same list, A-Z, each defined ONCE and in full.
 *               An indicator reported by twelve departments and one reported by a single
 *               department are set out identically — no "common" and "specific" split, so
 *               a reader never has to know which kind an indicator is before looking it up.
 *   Section 3 — Departmental schedules.  What each department is accountable for, who owns
 *               each indicator there, and the section number to read it in.
 *
 * The old two-part arrangement (common indicators first, department-specific second) forced
 * the reader to know an indicator's category before they could find it, and split the
 * alphabet across two places. One sequence, one alphabet, one definition each.
 *
 * Where departments disagree on a shared definition, the variant used by the MOST
 * departments is shown and the differences are printed in a "Departmental variations"
 * row — never silently flattened. (General OT measures Cautery Burn as a rate per 1000
 * while CTVS OT counts it; that is a real difference a reader must see.)
 *
 * DEFINITIONS ONLY — a reference manual, not a performance report. No recorded figures,
 * so it does not go out of date as new months are reported. Internal database identifiers
 * (department id, indicator id) are deliberately omitted: they mean nothing to a reader.
 * (Restoring performance would mean re-porting the compute chain from
 * renderer/unico/quality-console.jsx:124-246 — browser-only JSX with no require()-able
 * module; api/report_pdf.py:1247-1400 is a verified reference port.)
 *
 * Data assembly and styling live in scripts/lib/manual-kit.js.
 *
 * --split additionally writes ONE STANDALONE FILE PER DEPARTMENT into docs/departments/,
 * each containing that department's full assigned indicator set with every definition
 * written out — no cross-references, because a department's own file must stand on its
 * own when it is handed to that department.
 *
 * Re-runnable: never overwrites a hand-edited manual — if the target exists the output
 * goes to Quality-Indicator-Manual.generated.docx instead, unless --force is passed.
 * NOTE: Word holds a lock on an open .docx; close it before using --force.
 *
 * Usage: node scripts/build-quality-manual.js [--force] [--split]
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });
const fs = require('fs');
const { getDbHandle } = require('../server/db');
const K = require('./lib/manual-kit');
const P = require('./lib/indicator-purpose');
const { Document, Packer, TableOfContents, PageBreak, AlignmentType, WidthType } = K.D;
const { Paragraph, TextRun, TableRow, HeadingLevel } = K;

(async () => {
  const force = process.argv.includes('--force');
  const db = await getDbHandle();
  if (!db) { console.error('No DB (MONGODB_URI not set).'); process.exit(1); }

  const { deptData, groups, ownersFor, references, unusedCatalogue, meta } = await K.loadManualData(db);

  /* Section number every indicator is defined at — computed once, used by the register,
     by the departmental schedules and by the definitions themselves, so the three can
     never disagree about where something is. */
  const secNo = new Map(groups.map((g, i) => [g.key, '2.' + (i + 1)]));
  const sharedCount = groups.filter((g) => g.depts.length > 1).length;
  const generatedOn = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  const totalEntries = deptData.reduce((n, d) => n + d.inds.length, 0);

  const body = [];

  /* ---------------- title page ---------------- */
  body.push(...K.titlePage({
    line1: 'NURSING QUALITY', line2: 'INDICATOR MANUAL',
    subtitle: 'Definitions, formulae and benchmarks for every nursing quality indicator reported across the hospital',
    issued: generatedOn, meta,
    facts: [
      ['Indicators defined', String(groups.length)],
      ['Departments covered', String(deptData.length)],
      ['Reporting assignments', String(totalEntries)],
    ],
  }));

  /* ---------------- contents ---------------- */
  body.push(new Paragraph({ children: [new PageBreak()] }));
  body.push(new Paragraph({ text: 'Contents', heading: HeadingLevel.HEADING_1, spacing: { after: 120 } }));
  body.push(new Paragraph({
    children: [new TextRun({ text: 'Click in the list and press F9 to refresh it after editing.', size: 17, color: K.MUTED, italics: true })],
    spacing: { after: 200 },
  }));
  body.push(new TableOfContents('Contents', { hyperlink: true, headingStyleRange: '1-2' }));

  /* ---------------- about ---------------- */
  body.push(new Paragraph({ text: 'About this manual', heading: HeadingLevel.HEADING_1, pageBreakBefore: true }));
  body.push(K.para('This manual is the reference definition of every nursing quality indicator reported across the hospital. It is generated directly from the live quality database, so the definitions, formulae and benchmarks recorded here are the same ones the Quality console applies when data is collected and reported.'));
  body.push(K.para('It states what each indicator means, not how the hospital performed. Recorded figures are reviewed in the monthly and quarterly quality reports; keeping them out of this manual means the definitions here stay valid as new data is reported.'));

  body.push(new Paragraph({ text: 'How the manual is arranged', heading: HeadingLevel.HEADING_2 }));
  body.push(K.para('Every indicator the hospital reports is listed together, in one alphabetical sequence, and defined once. An indicator reported by twelve departments and an indicator reported by one are set out in exactly the same way, so you never need to know which kind you are looking for before you can find it.'));
  body.push(K.table([
    new TableRow({ tableHeader: true, children: [K.headCell('Section', 26), K.headCell('What it contains', 74)] }),
    new TableRow({ cantSplit: true, children: [
      K.cell(K.txt('1 — Indicator register', { bold: true, size: 18 }), { fill: K.LABEL_BG }),
      K.cell(K.txt('All ' + groups.length + ' indicators on one sheet, with the measure, the benchmark, the number of departments reporting it and the section it is defined in. The quickest way to find something.', { size: 18 })),
    ] }),
    new TableRow({ cantSplit: true, children: [
      K.cell(K.txt('2 — Indicator definitions', { bold: true, size: 18 }), { fill: K.LABEL_BG }),
      K.cell(K.txt('The full definition of each indicator, in the same alphabetical order: what it measures, how it is calculated, why it matters, what counts in the numerator and denominator, the benchmark, the standard it follows, and who is responsible for it in each department that reports it.', { size: 18 })),
    ] }),
    new TableRow({ cantSplit: true, children: [
      K.cell(K.txt('3 — Departmental schedules', { bold: true, size: 18 }), { fill: K.LABEL_BG }),
      K.cell(K.txt('One schedule per department listing everything that department is accountable for, with the responsible person and the section number of each definition. ' + deptData.length + ' departments.', { size: 18 })),
    ] }),
    new TableRow({ cantSplit: true, children: [
      K.cell(K.txt('Annexures', { bold: true, size: 18 }), { fill: K.LABEL_BG }),
      K.cell(K.txt('A — the standards and sources the definitions follow. B — definitions that exist in the hospital formula library but that no department currently reports.', { size: 18 })),
    ] }),
  ]));

  body.push(new Paragraph({ text: 'How an entry is set out', heading: HeadingLevel.HEADING_2 }));
  body.push(K.table([
    new TableRow({ tableHeader: true, children: [K.headCell('Field', 22), K.headCell('What it tells you', 78)] }),
  ].concat([
    ['Measure', 'Whether the indicator is a Count, a Rate, a Percentage or an Average, and the unit its value is expressed in.'],
    ['Formula', 'The calculation type — named first, because "(a ÷ b) × 100" alone does not say whether the result is a percentage or a rate per 100 — followed by the expression itself.'],
    ['Why we measure this', 'What the indicator detects, why that matters clinically, and what a breach should prompt a department to review. Where only one department reports the indicator, this also covers why it is measured there. Where several report it, each department\'s own reason is given on its schedule in Section 3.'],
    ['Numerator', 'Exactly what is counted — the inclusion rule for a qualifying event or a compliant observation.'],
    ['Denominator', 'Exactly what it is counted against — the exposure, device-days or population at risk.'],
    ['Benchmark', 'The target the indicator is judged against, and whether a higher or a lower value is better.'],
    ['Benchmark note', 'Where the target comes from, and any caveat on how it should be read.'],
    ['Reference', 'The standard or source the definition follows — CDC NHSN, NABH, WHO, AHA, NICE and similar.'],
    ['Reported by', 'Every department that reports the indicator, and the person accountable for collecting and reporting it in each.'],
    ['Departmental variations', 'Shown only where departments currently measure or judge the indicator differently. See "Where departments differ" below.'],
  ].map(([k, v]) => new TableRow({
    cantSplit: true,
    children: [K.cell(K.txt(k, { bold: true, size: 18 }), { fill: K.LABEL_BG }), K.cell(K.txt(v, { size: 18 }))],
  })))));

  /* Naming the calculation types once, here, is what lets every entry state its type in a
     single word instead of re-explaining the arithmetic in each of ~50 definitions. */
  body.push(new Paragraph({ text: 'The calculation types used', heading: HeadingLevel.HEADING_2 }));
  body.push(K.para('Every indicator in this manual is calculated in one of six ways. Two of them produce the same arithmetic and differ only in how the answer is read, which is why each entry names its type rather than showing the expression alone.'));
  body.push(K.table([
    new TableRow({ tableHeader: true, children: [K.headCell('Type', 22), K.headCell('Calculation', 26), K.headCell('Read as', 52)] }),
  ].concat([
    ['Event count', 'value = numerator', 'A number of events in the period. Used where there is no meaningful exposure to divide by, or where every event is reviewed individually.'],
    ['Percentage', '(numerator ÷ denominator) × 100', 'A proportion of a defined population — "x% of observed opportunities", "x% of cases".'],
    ['Rate per 100', '(numerator ÷ denominator) × 100', 'Events per 100 units of exposure. The same arithmetic as a percentage, but the answer is a rate and may legitimately exceed 100.'],
    ['Rate per 1 000', '(numerator ÷ denominator) × 1 000', 'Events per 1 000 units of exposure — device-days, patient-days or visits. Used where events are rare, so the number stays readable.'],
    ['Average', 'numerator ÷ denominator', 'A mean value per case — usually a duration in minutes or hours.'],
    ['Value entered directly', 'value = as recorded', 'A figure taken straight from a source system or register, with no calculation applied.'],
  ].map(([a, b, c]) => new TableRow({
    cantSplit: true,
    children: [
      K.cell(K.txt(a, { bold: true, size: 18 }), { fill: K.LABEL_BG }),
      K.cell(K.txt(b, { size: 17 })),
      K.cell(K.txt(c, { size: 17 })),
    ],
  })))));

  body.push(new Paragraph({ text: 'Where departments differ', heading: HeadingLevel.HEADING_2 }));
  body.push(K.para('A shared indicator should mean the same thing everywhere. Where a department currently measures one differently — a different calculation, unit or benchmark — the definition shown is the one used by the most departments, and the difference is set out in a "Departmental variations" row on that entry. Those rows mark work still to be settled, not a choice.'));

  body.push(new Paragraph({ text: 'Keeping the manual current', heading: HeadingLevel.HEADING_2 }));
  body.push(K.para('Definitions are held in the hospital quality database and in the shared formula library, not in this file. A definition corrected in the Quality console is corrected for every department that reports the indicator, and appears here the next time the manual is generated — so this document is a printed view of the live definitions rather than a separate copy that can drift out of step with them.'));
  body.push(K.para('Requests to add an indicator, change a definition or move a benchmark go to the Quality Assurance Department. A change that affects how a figure is calculated should be made at a reporting-period boundary and noted with the period it takes effect from, so that a trend is not broken silently mid-year.'));

  /* ---------------- Section 1 — register ---------------- */
  body.push(new Paragraph({ text: 'Section 1 — Indicator register', heading: HeadingLevel.HEADING_1, pageBreakBefore: true }));
  body.push(K.para('Every nursing quality indicator reported across the hospital, in alphabetical order. "Depts" is the number of departments that report it; "Defined in" is the section of this manual where its full definition is set out.'));
  body.push(K.table([
    new TableRow({ tableHeader: true, children: [
      K.headCell('#', 5), K.headCell('Indicator', 38), K.headCell('Measure', 12),
      K.headCell('Benchmark', 20), K.headCell('Depts', 8), K.headCell('Defined in', 11), K.headCell('Varies', 6),
    ] }),
  ].concat(groups.map((g, i) => new TableRow({
    cantSplit: true,
    children: [
      K.cell(K.txt(String(i + 1), { size: 17, color: K.MUTED, align: AlignmentType.CENTER })),
      K.cell(K.txt(g.name, { size: 17 })),
      K.cell(K.txt(K.measureName(g.rep.formula), { size: 17 })),
      K.cell(K.txt(K.benchExpr(g.rep), { size: 17 })),
      K.cell(K.txt(String(g.depts.length), { size: 17, align: AlignmentType.CENTER })),
      K.cell(K.txt(secNo.get(g.key), { size: 17, color: K.ACCENT, align: AlignmentType.CENTER })),
      K.cell(K.txt(g.variations.length ? 'yes' : '—', { size: 16, color: g.variations.length ? 'B3253C' : K.MUTED, align: AlignmentType.CENTER })),
    ],
  })))));

  /* ---------------- Section 2 — definitions ---------------- */
  body.push(new Paragraph({ text: 'Section 2 — Indicator definitions', heading: HeadingLevel.HEADING_1, pageBreakBefore: true }));
  body.push(K.para('Each indicator is defined once and in full, in the same alphabetical order as the register above. The definition applies wherever the indicator is collected.'));

  groups.forEach((g) => {
    body.push(new Paragraph({ text: secNo.get(g.key) + '  ' + g.name, heading: HeadingLevel.HEADING_2, keepNext: true }));

    const extra = [];
    const owners = g.instances.map((x) => {
      const who = ownersFor(x.deptKey, x.ind.id);
      return { dept: x.deptName, who: who.length ? who.join('; ') : 'Not yet assigned' };
    });
    /* Department list and accountability in one row — a reader asking "does this apply to
       us, and who owns it here?" gets both answers without turning to Section 3. */
    extra.push(K.defRow('Reported by', [
      new Paragraph({
        children: [new TextRun({
          text: g.depts.length === 1
            ? g.depts[0] + ' only.'
            : g.depts.length + ' departments: ' + g.depts.join(', ') + '.',
          size: 18,
        })],
        spacing: { after: 90 },
      }),
      new K.D.Table({
        width: { size: 100, type: WidthType.PERCENTAGE }, borders: K.allThin,
        rows: [new TableRow({
          tableHeader: true,
          children: [
            K.cell(K.txt('Department', { bold: true, size: 15, color: K.MUTED }), { width: 38, fill: K.HEAD_BG }),
            K.cell(K.txt('Responsible', { bold: true, size: 15, color: K.MUTED }), { width: 62, fill: K.HEAD_BG }),
          ],
        })].concat(owners.map((o) => new TableRow({
          cantSplit: true,
          children: [
            K.cell(K.txt(o.dept, { size: 16, bold: true }), { width: 38, fill: K.LABEL_BG }),
            K.cell(K.txt(o.who, { size: 16, color: K.MUTED }), { width: 62 }),
          ],
        }))),
      }),
    ]));

    /* A shared indicator is measured for a different reason in each unit — a neonatal
       CLABSI and a dialysis-catheter CLABSI are not the same problem. One line per
       reporting department rather than a single flattened sentence, stacked under the
       hospital-wide reason inside the one "Why we measure this" row. */
    const why = g.instances
      .map((x) => ({ dept: x.deptName, text: P.deptPurposeFor(g.name, x.deptId, x.deptName) }))
      .filter((x) => x.text);

    if (g.variations.length) {
      const lines = [];
      g.variations.forEach((v) => {
        lines.push(new Paragraph({ children: [new TextRun({ text: v.label, bold: true, size: 17 })], spacing: { before: 60, after: 20 } }));
        v.options.forEach((o) => lines.push(new Paragraph({
          children: [new TextRun({ text: o.shown + ' — ', size: 17 }), new TextRun({ text: o.depts.join(', '), size: 16, color: K.MUTED })],
          indent: { left: 200 }, spacing: { after: 20 },
        })));
      });
      if (g.proseDiffers) {
        lines.push(new Paragraph({
          children: [new TextRun({ text: 'The numerator/denominator wording also differs between departments; the version shown above is the one in widest use.', size: 16, italics: true, color: K.MUTED })],
          spacing: { before: 80 },
        }));
      }
      extra.push(K.defRow('Departmental variations', lines));
    } else if (g.proseDiffers) {
      extra.push(K.defRow('Note', 'The numerator/denominator wording differs slightly between departments; the version shown is the one in widest use. How the indicator is calculated and judged is the same everywhere.', { size: 17, color: K.MUTED }));
    }

    body.push(K.table(K.definitionRows(g.rep, {
      extraRows: extra,
      purpose: P.purposeFor(g.name),
      deptReasons: why,
    })));
    body.push(new Paragraph({ text: '', spacing: { after: 180 } }));
  });

  /* ---------------- Section 3 — departmental schedules ---------------- */
  body.push(new Paragraph({ text: 'Section 3 — Departmental schedules', heading: HeadingLevel.HEADING_1, pageBreakBefore: true }));
  body.push(K.para('What each department is accountable for. Every indicator listed here is defined in full at the section number shown in the last column.'));
  body.push(K.table([
    new TableRow({ tableHeader: true, children: [K.headCell('Department', 52), K.headCell('Indicators reported', 24), K.headCell('Schedule at', 24)] }),
  ].concat(deptData.map((d, di) => new TableRow({
    cantSplit: true,
    children: [
      K.cell(K.txt(d.q.name, { size: 17 })),
      K.cell(K.txt(String(d.inds.length), { size: 17, bold: true, align: AlignmentType.CENTER })),
      K.cell(K.txt('3.' + (di + 1), { size: 17, color: K.ACCENT, align: AlignmentType.CENTER })),
    ],
  })))));

  deptData.forEach((d, di) => {
    body.push(new Paragraph({ text: '3.' + (di + 1) + '  ' + d.q.name, heading: HeadingLevel.HEADING_2, pageBreakBefore: true }));
    body.push(K.para('All ' + d.inds.length + ' indicator' + (d.inds.length === 1 ? '' : 's') + ' this department is responsible for collecting and reporting.'));
    body.push(K.table([
      new TableRow({ tableHeader: true, children: [
        K.headCell('#', 5), K.headCell('Indicator', 33), K.headCell('Measure', 12),
        K.headCell('Benchmark', 19), K.headCell('Responsible', 21), K.headCell('Defined in', 10),
      ] }),
    ].concat(d.inds.map((ind, ii) => {
      const who = ownersFor(d.q.key, ind.id);
      return new TableRow({
        cantSplit: true,
        children: [
          K.cell(K.txt(String(ii + 1), { size: 16, color: K.MUTED, align: AlignmentType.CENTER })),
          K.cell(K.txt(ind.name, { size: 16 })),
          K.cell(K.txt(K.measureName(ind.formula), { size: 16 })),
          K.cell(K.txt(K.benchExpr(ind), { size: 16 })),
          K.cell(K.txt(who.length ? who.join('; ') : '—', { size: 15, color: K.MUTED })),
          K.cell(K.txt(secNo.get(K.norm(ind.name)) || '—', { size: 16, color: K.ACCENT, align: AlignmentType.CENTER })),
        ],
      });
    }))));

    /* The department's own reason for each indicator, gathered in its schedule — this is
       the page a unit is most likely to print and pin up, so it should say why as well
       as what. */
    const why = d.inds
      .map((ind) => ({ name: ind.name, text: P.deptPurposeFor(ind.name, String(d.dep.id || d.dep._id), d.q.name) }))
      .filter((x) => x.text);
    if (why.length) {
      body.push(new Paragraph({
        children: [new TextRun({ text: 'Why ' + d.q.name + ' reports these', bold: true, size: 19 })],
        spacing: { before: 280, after: 120 },
      }));
      body.push(K.table([
        new TableRow({ tableHeader: true, children: [K.headCell('Indicator', 30), K.headCell('Reason it is reported here', 70)] }),
      ].concat(why.map((w) => new TableRow({
        cantSplit: true,
        children: [K.cell(K.txt(w.name, { size: 16, bold: true }), { fill: K.LABEL_BG }), K.cell(K.txt(w.text, { size: 16 }))],
      })))));
    }
  });

  /* ---------------- annexures ---------------- */
  body.push(new Paragraph({ text: 'Annexure A — References', heading: HeadingLevel.HEADING_1, pageBreakBefore: true }));
  body.push(K.para('Standards and sources the indicator definitions in this manual follow.'));
  [...references.keys()].sort().forEach((k) => {
    body.push(new Paragraph({ children: [new TextRun({ text: k, size: 18 })], indent: { left: 200, hanging: 200 }, spacing: { after: 30 } }));
    if (references.get(k)) {
      body.push(new Paragraph({
        children: [new K.D.ExternalHyperlink({ children: [new TextRun({ text: references.get(k), size: 15, style: 'Hyperlink' })], link: references.get(k) })],
        indent: { left: 200 }, spacing: { after: 130 },
      }));
    } else body.push(new Paragraph({ text: '', spacing: { after: 100 } }));
  });

  body.push(new Paragraph({ text: 'Annexure B — Formula library entries not currently assigned', heading: HeadingLevel.HEADING_1, pageBreakBefore: true }));
  body.push(K.para('Definitions that already exist in the hospital formula library but that no department currently reports. They can be assigned to a department without having to be defined again.'));
  body.push(K.table([
    new TableRow({ tableHeader: true, children: [K.headCell('Indicator', 55), K.headCell('Measure', 15), K.headCell('Benchmark', 30)] }),
  ].concat(unusedCatalogue.map((f) => new TableRow({
    cantSplit: true,
    children: [K.cell(K.txt(f.canonicalName, { size: 17 })), K.cell(K.txt(K.measureName(f.formula), { size: 17 })), K.cell(K.txt(f.benchmark || '—', { size: 17 }))],
  })))));

  /* ---------------- write ---------------- */
  const doc = new Document({
    creator: 'UNICO Quality', title: 'Nursing Quality Indicator Manual',
    description: 'Every nursing quality indicator the hospital reports, defined once, with the departments that report each and who is responsible',
    features: { updateFields: true },
    styles: K.docStyles,
    sections: [K.sectionShell(body, 'Nursing Quality Indicator Manual', meta.confidential)],
  });

  const outDir = path.join(__dirname, '..', 'docs');
  fs.mkdirSync(outDir, { recursive: true });
  const target = path.join(outDir, 'Quality-Indicator-Manual.docx');
  const out = (!force && fs.existsSync(target)) ? path.join(outDir, 'Quality-Indicator-Manual.generated.docx') : target;
  const buf = await Packer.toBuffer(doc);
  /* A file locked by Word must not abort the run — the per-department files below are
     independent and should still be produced. Reported at the end, with a non-zero exit. */
  let mainLocked = false;
  try {
    fs.writeFileSync(out, buf);
  } catch (e) {
    if (e.code === 'EBUSY' || e.code === 'EPERM') mainLocked = true; else throw e;
  }

  /* ---------------- one standalone file per department (--split) ----------------
     Each department's own file repeats every definition in full — a cross-reference to
     a section number is useless in a file that does not contain that section. */
  if (process.argv.includes('--split')) {
    const dir = path.join(outDir, 'departments');
    fs.mkdirSync(dir, { recursive: true });
    const safe = (s) => String(s).replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim();
    let written = 0, skipped = [];

    for (let di = 0; di < deptData.length; di++) {
      const d = deptData[di];
      const dbody = [];

      dbody.push(...K.titlePage({
        line1: 'NURSING QUALITY INDICATORS', line2: (d.q.name || '').toUpperCase(),
        subtitle: 'Assigned nursing quality indicators for this department — definitions, formulae and benchmarks',
        issued: generatedOn, meta,
        facts: [
          ['Department', d.q.name],
          ['Indicators assigned', String(d.inds.length)],
          ['Reporting year', d.q.year || '—'],
        ],
      }));

      dbody.push(new Paragraph({ children: [new PageBreak()] }));
      dbody.push(new Paragraph({ text: 'Contents', heading: HeadingLevel.HEADING_1, spacing: { after: 120 } }));
      dbody.push(new Paragraph({
        children: [new TextRun({ text: 'Click in the list and press F9 to refresh it after editing.', size: 17, color: K.MUTED, italics: true })],
        spacing: { after: 200 },
      }));
      dbody.push(new TableOfContents('Contents', { hyperlink: true, headingStyleRange: '1-2' }));

      dbody.push(new Paragraph({ text: 'Indicators assigned to ' + d.q.name, heading: HeadingLevel.HEADING_1, pageBreakBefore: true }));
      dbody.push(K.para('These are the nursing quality indicators this department is responsible for collecting and reporting. Definitions are taken from the live quality database and match the hospital-wide Quality Indicator Manual.'));
      dbody.push(K.table([
        new TableRow({ tableHeader: true, children: [K.headCell('#', 6), K.headCell('Indicator', 40), K.headCell('Measure', 13), K.headCell('Benchmark', 20), K.headCell('Also reported by', 21)] }),
      ].concat(d.inds.map((ind, ii) => {
        const grp = groups.find((g) => g.key === K.norm(ind.name));
        const others = grp ? grp.depts.filter((x) => x !== d.q.name) : [];
        return new TableRow({
          cantSplit: true,
          children: [
            K.cell(K.txt(String(ii + 1), { size: 17, color: K.MUTED, align: AlignmentType.CENTER })),
            K.cell(K.txt(ind.name, { size: 17 })),
            K.cell(K.txt(K.measureName(ind.formula), { size: 17 })),
            K.cell(K.txt(K.benchExpr(ind), { size: 17 })),
            K.cell(K.txt(others.length ? others.length + ' other department' + (others.length === 1 ? '' : 's') : 'this department only', { size: 15, color: K.MUTED })),
          ],
        });
      }))));

      d.inds.forEach((ind, ii) => {
        dbody.push(new Paragraph({ text: (ii + 1) + '.  ' + ind.name, heading: HeadingLevel.HEADING_2, keepNext: true }));
        const who = ownersFor(d.q.key, ind.id);
        const extra = [K.defRow('Responsible', who.length ? who.join('; ') : 'Not yet assigned')];
        const grp = groups.find((g) => g.key === K.norm(ind.name));
        const others = grp ? grp.depts.filter((x) => x !== d.q.name) : [];
        if (others.length) extra.push(K.defRow('Also reported by', others.join(', '), { size: 17, color: K.MUTED }));
        dbody.push(K.table(K.definitionRows(ind, {
          extraRows: extra,
          purpose: P.purposeFor(ind.name),
          deptPurpose: P.deptPurposeFor(ind.name, String(d.dep.id || d.dep._id), d.q.name),
          deptPurposeLabel: 'Why ' + d.q.name + ' measures it',
        })));
        dbody.push(new Paragraph({ text: '', spacing: { after: 180 } }));
      });

      const ddoc = new Document({
        creator: 'UNICO Quality', title: d.q.name + ' — Nursing Quality Indicators',
        description: 'Assigned nursing quality indicators for ' + d.q.name,
        features: { updateFields: true }, styles: K.docStyles,
        sections: [K.sectionShell(dbody, d.q.name + ' — Nursing Quality Indicators', meta.confidential)],
      });
      const dfile = path.join(dir, String(di + 1).padStart(2, '0') + ' ' + safe(d.q.name) + '.docx');
      try {
        fs.writeFileSync(dfile, await Packer.toBuffer(ddoc));
        written++;
      } catch (e) {
        if (e.code === 'EBUSY' || e.code === 'EPERM') skipped.push(path.basename(dfile)); else throw e;
      }
    }
    console.log('Per-department files: ' + written + ' written to docs/departments/');
    if (skipped.length) console.log('  SKIPPED (open in Word): ' + skipped.join(', '));
  }

  const varied = groups.filter((g) => g.variations.length);
  if (mainLocked) {
    console.error('NOT written: ' + path.basename(out) + ' is open in Word. Close it and run again.');
    process.exit(1);
  }
  console.log('Manual written: ' + out);
  console.log('  Section 2: ' + groups.length + ' indicators, each defined once ('
    + sharedCount + ' reported by more than one department, '
    + (groups.length - sharedCount) + ' by a single one) covering ' + totalEntries + ' reporting assignments');
  console.log('  Section 3: ' + deptData.length + ' departmental schedules');
  console.log('  ' + varied.length + ' indicators have departmental variations: ' + varied.map((g) => g.name).join('; '));
  console.log('  ' + references.size + ' references, ' + unusedCatalogue.length + ' unassigned library entries, ' + (buf.length / 1024).toFixed(0) + ' KB');
  if (out !== target) console.log('  NOTE: ' + path.basename(target) + ' already exists and was NOT overwritten. Pass --force to replace it.');
  process.exit(0);
})().catch((e) => { console.error('failed:', (e && e.stack) || e); process.exit(1); });
