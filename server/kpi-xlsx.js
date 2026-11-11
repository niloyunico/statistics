/* Nursing KPI — the report as an Excel workbook (exceljs), for anyone who wants to work the
 * numbers further. Same report object as the screen and the deck (server/kpi.js):
 *   Scorecard        one row per KPI: baseline, period value, target, variance, status, trend
 *   Monthly figures  every month of the period: value, and numerator / denominator where known
 *   Action plans     every action item with owner, due month and status
 *   Commentary       the comments written on the report, the overall summary and sign-off
 */
const K = require('../renderer/unico/kpi-core.js');

const NAVY = 'FF00293A', ZEBRA = 'FFF4F7FA', LINE = 'FFC9D3DE';
const ST = { met: 'FFE7F6ED', near: 'FFFFF6E0', off: 'FFFDE4E8', notarget: 'FFEEF2F6', nodata: 'FFF3F5F8', notstarted: 'FFF6F8FA', notdue: 'FFF6F8FA' };
const ST_INK = { met: 'FF14713F', near: 'FF8A5A00', off: 'FFA3172F', notarget: 'FF5B6878', nodata: 'FF7B8796', notstarted: 'FF7B8796', notdue: 'FF7B8796' };
const LVL_FILL = { error: 'FFFDE4E8', warn: 'FFFFF6E0', info: 'FFEEF2F6' };
const LVL_INK = { error: 'FFA3172F', warn: 'FF8A5A00', info: 'FF5B6878' };
const when = (t) => (t ? new Date(t).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka', dateStyle: 'medium', timeStyle: 'short' }) : '');
const SOURCE = { 'hh-audit': 'Hand hygiene audit', 'doc-audit': 'Documentation audit (all departments)', pooled: 'Quality data (all units)', hospital: 'Quality data (hospital)', partial: 'Denominator missing', manual: 'Entered', edited: 'Edited (system figure overridden)', missing: '' };

function sheet(wb, name, cols) {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = cols;
  const h = ws.getRow(1);
  h.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  h.alignment = { vertical: 'middle', wrapText: true };
  h.height = 22;
  return ws;
}
function finish(ws) {
  ws.eachRow((row, i) => {
    row.eachCell((c) => { c.border = { top: { style: 'thin', color: { argb: LINE } }, bottom: { style: 'thin', color: { argb: LINE } }, left: { style: 'thin', color: { argb: LINE } }, right: { style: 'thin', color: { argb: LINE } } }; });
    if (i > 1) { row.alignment = { vertical: 'top', wrapText: true }; if (i % 2 === 1) row.eachCell((c) => { if (!c.fill || c.fill.type !== 'pattern') c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA } }; }); }
  });
  if (ws.rowCount > 1) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };
}
const n = (v) => (K.has(v) ? Number(v) : null);

async function build(report, opts) {
  const ExcelJS = require('exceljs');
  const o = opts || {};
  const cfg = K.cfgOf(o.cfg);
  const rows = report.rows || [];
  const pill = (id) => K.pillarOf(cfg, id).label;
  const wb = new ExcelJS.Workbook();
  wb.creator = o.by || 'UNICO';
  wb.created = new Date(o.now || Date.now());
  wb.title = cfg.reportTitle + ' — ' + K.fmtRange(report.from, report.to);

  const sc = sheet(wb, 'Scorecard', [
    { header: '#', key: 'code', width: 6 }, { header: 'Pillar', key: 'pillar', width: 24 }, { header: 'KPI', key: 'name', width: 40 }, { header: 'Unit', key: 'unit', width: 20 },
    { header: 'Direction', key: 'dir', width: 14 }, { header: 'Baseline', key: 'base', width: 11 }, { header: K.fmtRange(report.from, report.to), key: 'val', width: 14 },
    { header: 'Numerator', key: 'num', width: 12 }, { header: 'Denominator', key: 'den', width: 13 }, { header: 'Target', key: 'target', width: 10 },
    { header: 'Variance', key: 'gap', width: 16 }, { header: '% of target', key: 'ach', width: 11 }, { header: 'Status', key: 'status', width: 15 }, { header: 'Trend', key: 'trend', width: 12 },
    { header: 'Source', key: 'src', width: 16 }, { header: 'Measured', key: 'freq', width: 15 }, { header: 'Result period', key: 'rp', width: 20 },
    { header: 'Formula', key: 'formula', width: 50 }, { header: 'Schedule', key: 'sched', width: 60 },
  ]);
  rows.forEach((r) => {
    const row = sc.addRow({ code: r.code, pillar: pill(r.pillar), name: r.name, unit: r.unit, dir: r.goalDirection === 'lower_is_better' ? 'Lower is better' : 'Higher is better',
      base: n(r.baseline && r.baseline.value), val: n(r.period.value), num: n(r.period.num), den: n(r.period.den), target: n(r.target), gap: K.gapLabel(r, r.period.value, r.target),
      ach: r.achievement, status: K.STATUS[r.status].label, trend: r.trendDir || '', src: r.linked ? 'Quality data' : 'Entered', formula: r.formulaText,
      freq: K.freqLabel(r, true), rp: r.latest ? 'Latest: ' + r.latest.label : (r.resultLabel || (r.freqMonths > 1 && r.nextDue ? 'Next due ' + K.fmtMonth(r.nextDue) : K.fmtRange(report.from, report.to))), sched: r.schedule || '' });
    const c = row.getCell('status');
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ST[r.status] } };
    c.font = { bold: true, color: { argb: ST_INK[r.status] } };
  });
  finish(sc);

  const months = report.months || [];
  const mf = sheet(wb, 'Monthly figures', [{ header: '#', key: 'code', width: 6 }, { header: 'KPI', key: 'name', width: 38 }, { header: 'Figure', key: 'what', width: 13 }]
    .concat(months.map((m) => ({ header: K.fmtMonth(m), key: m, width: 11 }))));
  rows.forEach((r) => {
    // a KPI measured every N months: '·' where nothing is owed; the due month carries the period's figure
    const vrow = mf.addRow(Object.assign({ code: r.code, name: r.name + (r.freqMonths > 1 ? ' (' + K.freqLabel(r, true).toLowerCase() + ')' : ''), what: 'Value' },
      months.reduce((x, m) => { const c = r.cells[m] || {}; x[m] = c.source === 'not-due' ? '·' : n(c.value); return x; }, {})));
    vrow.font = { bold: true };
    if (r.freqMonths > 1) months.forEach((m) => { const c = r.cells[m] || {}; if (c.period && c.source !== 'not-due') vrow.getCell(m).note = 'Result for ' + c.period; });
    if (r.formula !== 'direct') mf.addRow(Object.assign({ code: '', name: r.numLabel || 'Numerator', what: 'Numerator' }, months.reduce((x, m) => { x[m] = n((r.cells[m] || {}).num); return x; }, {})));
    if (r.formula !== 'direct' && r.formula !== 'count') mf.addRow(Object.assign({ code: '', name: r.denLabel || 'Denominator', what: 'Denominator' }, months.reduce((x, m) => { x[m] = n((r.cells[m] || {}).den); return x; }, {})));
    mf.addRow(Object.assign({ code: '', name: '', what: 'Source' }, months.reduce((x, m) => { x[m] = SOURCE[(r.cells[m] || {}).source] || ''; return x; }, {}))).font = { italic: true, color: { argb: 'FF7B8796' }, size: 9 };
  });
  finish(mf);

  const ap = sheet(wb, 'Action plans', [{ header: '#', key: 'code', width: 6 }, { header: 'KPI', key: 'name', width: 34 }, { header: 'Action', key: 'text', width: 70 },
    { header: 'Owner', key: 'owner', width: 20 }, { header: 'Due', key: 'due', width: 11 }, { header: 'Status', key: 'status', width: 13 }, { header: 'Note', key: 'note', width: 34 }]);
  rows.forEach((r) => (r.actions || []).forEach((x) => ap.addRow({ code: r.code, name: r.name, text: x.text, owner: x.owner || '', due: x.due ? K.fmtMonth(x.due) : '', status: K.ACTION_LABEL[x.status] || x.status, note: x.note || '' })));
  finish(ap);

  const cm = sheet(wb, 'Commentary', [{ header: 'Item', key: 'k', width: 34 }, { header: 'Text', key: 'v', width: 110 }]);
  cm.addRow({ k: 'Report', v: cfg.reportTitle + ' — ' + K.fmtRange(report.from, report.to) + ' (' + (report.state === 'final' ? 'final' : 'draft') + ')' });
  cm.addRow({ k: 'Overall summary', v: report.overall || '' });
  rows.forEach((r) => { const t = (report.commentary || {})[r.kpiId]; if (t) cm.addRow({ k: (r.code ? r.code + ' ' : '') + r.name, v: t }); });
  const sig = report.signoff || {};
  [['Prepared by', sig.prepared], ['Reviewed by', sig.reviewed], ['Recommended by', sig.recommended], ['Approved by', sig.approved]].forEach(([k, v]) => cm.addRow({ k, v: v || '' }));
  finish(cm);

  /* How each figure was calculated: one row per KPI × month × unit, with who sent and approved it. */
  if (rows.some((r) => r.evidence)) {
    const SRC = { approved: 'Approved submission', 'overlay-edit': 'Quality-console edit', audit: 'Hand hygiene audit', own: 'Unit’s own reading', covered: 'Covered by the audit', 'not-audited': 'Not audited', 'not-observed': 'Not observed', missing: 'MISSING', partial: 'NO DENOMINATOR', 'den-zero': 'DENOMINATOR 0', 'carried-den': 'Headcount carried forward', manual: 'Entered in the KPI module' };
    const ca = sheet(wb, 'Calculation', [
      { header: '#', key: 'code', width: 6 }, { header: 'KPI', key: 'name', width: 30 }, { header: 'Month', key: 'month', width: 10 }, { header: 'Unit', key: 'unit', width: 26 },
      { header: 'Expected', key: 'exp', width: 9 }, { header: 'Used', key: 'used', width: 7 }, { header: 'Numerator', key: 'num', width: 11 }, { header: 'Denominator', key: 'den', width: 12 },
      { header: 'Value', key: 'val', width: 10 }, { header: 'Source', key: 'src', width: 24 }, { header: 'Submitted by', key: 'sby', width: 18 }, { header: 'Submitted at', key: 'sat', width: 18 },
      { header: 'Approved by', key: 'aby', width: 18 }, { header: 'Approved at', key: 'aat', width: 18 }, { header: 'Console edit by', key: 'eby', width: 18 }, { header: 'Edited at', key: 'eat', width: 18 },
      { header: 'Device Days field', key: 'ddf', width: 13 }, { header: 'Device Days approved', key: 'dda', width: 14 }, { header: 'DD days missing / waiting', key: 'ddm', width: 15 },
      { header: 'Month total (num ÷ den = value)', key: 'tot', width: 26 },
    ]);
    rows.forEach((r) => (months || []).forEach((m) => {
      const ev = r.evidence && r.evidence[m];
      if (!ev) return;
      const tot = ev.totals || {};
      const totText = K.has(tot.value) ? (K.has(tot.num) && K.has(tot.den) ? tot.num + ' ÷ ' + tot.den + ' = ' : '') + K.fmt(r, tot.value) : (ev.started ? 'no value' : 'not started');
      if (!ev.units.length) ca.addRow({ code: r.code, name: r.name, month: K.fmtMonth(m), unit: ev.started ? '—' : 'not started', tot: totText });
      ev.units.forEach((u) => {
        const s = u.submission || {}, e = u.overlayEdited || {}, d = u.deviceDays || null;
        const row = ca.addRow({ code: r.code, name: r.name, month: K.fmtMonth(m), unit: u.name, exp: u.expected ? 'yes' : '', used: u.used ? 'yes' : '', num: n(u.num), den: n(u.den), val: n(u.value),
          src: SRC[u.source] || u.source, sby: s.by || (u.entered && u.entered.by) || '', sat: when(s.at || (u.entered && u.entered.at)), aby: s.reviewedBy || '', aat: when(s.reviewedAt),
          eby: e.by || (u.overlayEdited ? 'not recorded' : ''), eat: when(e.at), ddf: d ? d.field : '', dda: d ? d.approved : null, ddm: d ? d.missing + ' / ' + d.waiting : '', tot: totText });
        if (['missing', 'partial', 'den-zero'].indexOf(u.source) >= 0) row.getCell('src').font = { bold: true, color: { argb: 'FFA3172F' } };
      });
      if (ev.override) ca.addRow({ code: r.code, name: r.name, month: K.fmtMonth(m), unit: 'KPI module entry', used: 'yes', num: n(tot.num), den: n(tot.den), val: n(tot.value), src: 'Typed over the system figure' + (ev.override.autoValue != null ? ' (' + ev.override.autoValue + ')' : ''), sby: ev.override.by, sat: when(ev.override.at), tot: totText + (ev.override.note ? ' — ' + ev.override.note : '') }).font = { italic: true };
    }));
    finish(ca);

    const dq = sheet(wb, 'Data checks', [{ header: '#', key: 'code', width: 6 }, { header: 'KPI', key: 'name', width: 30 }, { header: 'Month', key: 'month', width: 10 }, { header: 'Unit', key: 'unit', width: 22 },
      { header: 'Level', key: 'lvl', width: 9 }, { header: 'Check', key: 'chk', width: 30 }, { header: 'What was found', key: 'text', width: 70 }, { header: 'What to do', key: 'fix', width: 60 },
      { header: 'Acknowledged by', key: 'by', width: 18 }, { header: 'At', key: 'at', width: 18 }, { header: 'Reason', key: 'reason', width: 50 }]);
    ((report.quality && report.quality.checks) || []).forEach((c) => {
      const r = rows.find((x) => x.kpiId === c.kpiId) || {};
      const meta = K.CHECK_META[c.code] || {};
      const row = dq.addRow({ code: r.code || '', name: r.name || c.kpiId, month: K.fmtMonth(c.ym), unit: c.unitName || '', lvl: c.level, chk: meta.title || c.code, text: c.text, fix: meta.fix || '',
        by: c.ack ? c.ack.by : (c.level === 'error' ? 'NOT RESOLVED' : ''), at: c.ack ? when(c.ack.at) : '', reason: c.ack ? c.ack.reason : '' });
      row.getCell('lvl').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LVL_FILL[c.level] || LVL_FILL.info } };
      row.getCell('lvl').font = { bold: true, color: { argb: LVL_INK[c.level] || LVL_INK.info } };
    });
    if (report.dataFingerprint) dq.addRow({ name: 'Data fingerprint', text: report.dataFingerprint });
    finish(dq);
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}

module.exports = { build };
