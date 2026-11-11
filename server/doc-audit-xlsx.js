/* Documentation Audit — the period as an Excel workbook (exceljs), in the shape of the policy's
 * companion tracker (Unico_Nursing_Documentation_Accuracy_KPI_Tracker):
 *   Audit Register   one row per audited record: who, where, Yes / No / N/A, score, grade, result
 *   KPI Dashboard    department × month: records, every KPI of the department's tool vs target
 *   Criterion gaps   department × criterion: how often it was marked 'No' (the top failing first)
 *   Action plans     the Corrective Action Plans of the period (Appendix B)
 * Same summary object as the Reports screen (server/doc-audit.js buildSummary).
 */
const DA = require('../renderer/unico/doc-audit-core.js');

const NAVY = 'FF00293A', ZEBRA = 'FFF4F7FA', LINE = 'FFC9D3DE';
const OK_FILL = 'FFE7F6ED', OK_INK = 'FF14713F', BAD_FILL = 'FFFDE4E8', BAD_INK = 'FFA3172F';
const when = (t) => (t ? new Date(t).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka', dateStyle: 'medium', timeStyle: 'short' }) : '');

function sheet(wb, name, cols) {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = cols;
  const h = ws.getRow(1);
  h.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  h.alignment = { vertical: 'middle', wrapText: true };
  h.height = 24;
  return ws;
}
function finish(ws) {
  ws.eachRow((row, i) => {
    row.eachCell((c) => { c.border = { top: { style: 'thin', color: { argb: LINE } }, bottom: { style: 'thin', color: { argb: LINE } }, left: { style: 'thin', color: { argb: LINE } }, right: { style: 'thin', color: { argb: LINE } } }; });
    if (i > 1) { row.alignment = { vertical: 'top', wrapText: true }; if (i % 2 === 1) row.eachCell((c) => { if (!c.fill || c.fill.type !== 'pattern') c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA } }; }); }
  });
  if (ws.rowCount > 1) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };
}
const mark = (cell, good) => { if (good == null) return; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: good ? OK_FILL : BAD_FILL } }; cell.font = { bold: true, color: { argb: good ? OK_INK : BAD_INK } }; };

async function build(data) {
  const ExcelJS = require('exceljs');
  const { months, audits, tools, summary, caps } = data;
  const toolById = {}; (tools || []).forEach((t) => { toolById[t._id || t.id] = t; });
  const wb = new ExcelJS.Workbook();
  wb.creator = 'UNICO — Documentation Audit';
  wb.created = new Date();

  // 1. Audit Register
  const reg = sheet(wb, 'Audit Register', [
    { header: 'Date', key: 'date', width: 12 }, { header: 'Month', key: 'month', width: 10 }, { header: 'Department', key: 'dept', width: 22 },
    { header: 'Area / zone', key: 'area', width: 18 }, { header: 'Shift', key: 'shift', width: 9 }, { header: 'UHID / MRN', key: 'uhid', width: 14 },
    { header: 'Nurse(s) audited', key: 'nurse', width: 26 }, { header: 'Emp. ID', key: 'emp', width: 9 }, { header: 'Designation', key: 'desig', width: 16 }, { header: 'From other department', key: 'other', width: 28 },
    { header: 'Auditor', key: 'auditor', width: 20 }, { header: 'Tool', key: 'tool', width: 18 },
    { header: 'Yes', key: 'yes', width: 6 }, { header: 'No', key: 'no', width: 6 }, { header: 'N/A', key: 'na', width: 6 }, { header: 'Applicable', key: 'app', width: 9 },
    { header: 'Score %', key: 'pct', width: 8 }, { header: 'Grade', key: 'grade', width: 16 }, { header: 'Result', key: 'result', width: 8 },
    { header: 'Critical criteria marked No', key: 'crit', width: 18 }, { header: "Criteria marked 'No' (evidence)", key: 'gaps', width: 60 },
    { header: 'Status', key: 'status', width: 13 }, { header: 'Acknowledged', key: 'ack', width: 20 }, { header: 'Signed off (In-charge)', key: 'sign', width: 22 },
  ]);
  audits.slice().sort((x, y) => (x.date || '').localeCompare(y.date || '') || String(x.deptName).localeCompare(String(y.deptName))).forEach((x) => {
    const r = x.result || {};
    const byId = {}; (x.criteria || []).forEach((c) => { byId[c.id] = c; });
    const gaps = Object.keys(x.answers || {}).filter((k) => x.answers[k] === 'N' && byId[k]).sort((p, q) => byId[p].no - byId[q].no)
      .map((k) => '#' + byId[k].no + (byId[k].critical ? ' (critical)' : '') + ': ' + ((x.evidence || {})[k] || '')).join('\n');
    const row = reg.addRow({
      date: x.date, month: x.month, dept: x.deptName, area: x.area || '', shift: x.shift || '', uhid: x.uhid || '',
      nurse: DA.nurseNames(x), emp: DA.nursesOf(x).map((n) => n.empId || '—').join(', '), desig: DA.nursesOf(x).map((n) => n.designation || '—').join(', '),
      other: DA.nursesOf(x).filter((n) => n.fromOtherDept).map((n) => n.name + ': ' + (n.homeDept || '—') + ' · ' + (n.assignment || 'Deployed')).join(', '),
      auditor: (x.auditor && x.auditor.name) || '', tool: x.toolName || x.toolId,
      yes: r.yes, no: r.no, na: r.na, app: r.applicable, pct: r.pct, grade: r.gradeLabel || '', result: r.result || '',
      crit: (r.criticalFails || []).map((k) => '#' + ((byId[k] || {}).no || k)).join(', '), gaps,
      status: DA.STATUS_LABEL[x.status] || x.status,
      ack: DA.nursesOf(x).map((n) => { const k = DA.acksOf(x)[DA.nurseKey(n)]; return k ? (DA.nursesOf(x).length > 1 ? n.name + ': ' : '') + (k.method === 'account' ? 'own account · ' : 'in person · ') + when(k.at) : ''; }).filter(Boolean).join('\n'),
      sign: x.signoff ? x.signoff.name + ' · ' + when(x.signoff.at) : '',
    });
    mark(row.getCell('result'), r.result ? r.result === 'PASS' : null);
  });
  finish(reg);

  // 2. KPI Dashboard — one row per department × tool × month (+ the period), KPIs as columns.
  const maxK = Math.max(1, ...((tools || []).map((t) => (t.kpis || []).length)));
  const kcols = [];
  for (let i = 0; i < maxK; i++) kcols.push({ header: 'KPI ' + (i + 1), key: 'k' + i, width: 22 });
  const dash = sheet(wb, 'KPI Dashboard', [
    { header: 'Department', key: 'dept', width: 22 }, { header: 'Tool', key: 'tool', width: 18 }, { header: 'Month', key: 'month', width: 11 },
    { header: 'Records audited', key: 'rec', width: 9 }, { header: 'Minimum', key: 'min', width: 8 }, { header: 'Nurses audited', key: 'nurses', width: 9 },
  ].concat(kcols, [{ header: 'Top 3 failing criteria', key: 'top', width: 50 }, { header: 'CAP due (below target 2 months running)', key: 'cap', width: 24 }]));
  const kpiText = (k) => (k.value == null ? '—' : k.value + '%') + (k.target != null ? ' (target ' + (k.direction === 'lower' ? '≤ ' : '≥ ') + k.target + '%)' : '');
  const addDash = (name, toolId, label, s, min, cap) => {
    const t = toolById[toolId] || { kpis: [] };
    const o = { dept: name, tool: (t.short || t.name || toolId), month: label, rec: s.records, min: min == null ? '' : min, nurses: s.nurses,
      top: s.topFailing.map((g) => '#' + g.no + ' ×' + g.count + (g.critical ? ' (critical)' : '')).join(', '), cap: cap || '' };
    s.kpis.forEach((k, i) => { o['k' + i] = (k.code ? k.code + ' ' : '') + k.name + ': ' + kpiText(k); });
    const row = dash.addRow(o);
    s.kpis.forEach((k, i) => mark(row.getCell('k' + i), s.records ? k.met : null));
    return row;
  };
  summary.rows.forEach((r) => {
    months.forEach((ym) => {
      const cap = (r.caps.find((c) => c.month === ym) || { kpis: [] }).kpis;
      addDash(r.name, r.toolId, DA.fmtMonth(ym), r.months[ym], r.minRecords, cap.length ? 'Yes — ' + cap.join(', ') : '');
    });
    if (months.length > 1) { const row = addDash(r.name, r.toolId, 'Period', r.total, null, ''); row.font = { bold: true }; }
  });
  Object.entries(summary.hospital).forEach(([tid, h]) => { const row = addDash('HOSPITAL TOTAL', tid, months.length > 1 ? 'Period' : DA.fmtMonth(months[0]), h.total, null, ''); row.font = { bold: true }; });
  finish(dash);

  // 3. Criterion gaps
  const gp = sheet(wb, 'Criterion gaps', [
    { header: 'Department', key: 'dept', width: 22 }, { header: 'Tool', key: 'tool', width: 18 }, { header: 'No.', key: 'no', width: 5 },
    { header: 'Criterion', key: 'text', width: 70 }, { header: 'Critical', key: 'crit', width: 8 }, { header: "Times marked 'No'", key: 'count', width: 10 },
    { header: "% of records audited", key: 'pct', width: 10 },
  ]);
  summary.rows.forEach((r) => {
    const t = toolById[r.toolId] || {};
    r.total.gaps.forEach((g) => gp.addRow({ dept: r.name, tool: t.short || t.name || r.toolId, no: g.no, text: g.text, crit: g.critical ? 'Critical' : '', count: g.count, pct: r.total.records ? DA.round1((g.count / r.total.records) * 100) : null }));
  });
  finish(gp);

  // 4. Action plans
  const cp = sheet(wb, 'Action plans', [
    { header: 'Department', key: 'dept', width: 22 }, { header: 'Month', key: 'month', width: 10 }, { header: '#', key: 'n', width: 4 }, { header: 'Crit. no.', key: 'crit', width: 8 },
    { header: 'Gap identified (evidence)', key: 'gap', width: 40 }, { header: 'Root cause', key: 'root', width: 28 }, { header: 'Action', key: 'action', width: 40 },
    { header: 'Owner', key: 'owner', width: 18 }, { header: 'Due', key: 'due', width: 11 }, { header: 'Status', key: 'status', width: 11 }, { header: 'Re-audit result', key: 'reaudit', width: 24 },
    { header: 'Prepared by', key: 'by', width: 18 },
  ]);
  (caps || []).forEach((c) => (c.items || []).forEach((x) => cp.addRow({ dept: c.deptName, month: c.month, n: x.n, crit: x.critId ? '#' + String(x.critId).replace(/\D/g, '') : '', gap: x.gap, root: x.rootCause, action: x.action, owner: x.owner, due: x.due, status: ({ open: 'Open', progress: 'In progress', done: 'Done' })[x.status] || x.status, reaudit: x.reaudit, by: c.preparedBy || '' })));
  finish(cp);

  return Buffer.from(await wb.xlsx.writeBuffer());
}

module.exports = { build };
