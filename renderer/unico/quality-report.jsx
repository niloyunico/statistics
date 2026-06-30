/* UNICO — Quality Indicators · Monthly Department-wise Report + Export system.
 *
 * An "advanced" reporting screen that sits on top of the existing Quality module.
 * It renders a DEPARTMENT-WISE, MONTH-WISE quality-indicator matrix (one row per
 * indicator, one column per month) with RAG (red/amber/green) status cells, per
 * department summaries, a hospital-wide roll-up, and a full report EXPORT system
 * (PDF / Print / Excel / Word / CSV).
 *
 * Data source: window.qualityData() (the merged seed + user-edited overlay). The
 * seed reports values QUARTERLY only, so for "monthly" we PREFER genuine monthly
 * data when present (ind.months for direct indicators, or ind.mNum/ind.mDen +
 * qiFormulaCompute for formula indicators) and otherwise DERIVE the month from its
 * quarter's reported value — derived cells are clearly marked (≈) and can be
 * hidden. This matches how QualityDept/QualityTrends already behave.
 *
 * Self-contained on purpose: every helper is prefixed qr/QR_ so it never collides
 * with the shared global-lexical scope that all <script type="text/babel"> files
 * share (e.g. app.jsx's top-level `const {useState}=React`). React is destructured
 * INSIDE the component for the same reason.
 *
 * Registered in: index.html (script tag after quality-capa.jsx), app.jsx (route
 * view 'qualityReport'), ui.jsx (Quality sidebar group + match map).
 */

/* ---------------- month / quarter scaffolding ---------------- */
const QR_QORDER = ['Q1', 'Q2', 'Q3', 'Q4'];
const QR_QM = (window.QUALITY_QUARTER_MONTHS) || {
  Q1: ['Jun-25', 'Jul-25', 'Aug-25'], Q2: ['Sep-25', 'Oct-25', 'Nov-25'],
  Q3: ['Dec-25', 'Jan-26', 'Feb-26'], Q4: ['Mar-26', 'Apr-26', 'May-26'],
};
const QR_MQ = (window.QUALITY_MONTH_QUARTER) || (function () {
  const o = {}; QR_QORDER.forEach(q => (QR_QM[q] || []).forEach(m => { o[m] = q; })); return o;
})();
const QR_MONTHS = QR_QORDER.reduce((a, q) => a.concat(QR_QM[q] || []), []); // ['Aug-25'..'May-26']
const QR_QLABEL = { Q1: 'Q1 · Jun–Aug 25', Q2: 'Q2 · Sep–Nov 25', Q3: 'Q3 · Dec 25–Feb 26', Q4: 'Q4 · Mar–May 26' };
const QR_MON_FULL = { Jan: 'January', Feb: 'February', Mar: 'March', Apr: 'April', May: 'May', Jun: 'June', Jul: 'July', Aug: 'August', Sep: 'September', Oct: 'October', Nov: 'November', Dec: 'December' };
function qrMonthLabel(m) { const p = String(m).split('-'); return p[0] + ' ' + p[1]; }          // 'Aug 25'
function qrMonthFull(m) { const p = String(m).split('-'); return (QR_MON_FULL[p[0]] || p[0]) + ' 20' + p[1]; } // 'August 2025'

/* ---------------- status & value model ---------------- */
const QR_STONE = { Excellent: '#1f9d57', Good: '#0090ca', 'Very Good': '#0f9b8e', Satisfactory: '#3ab5a7', Fair: '#e08a1e', Average: '#e08a1e', 'Needs Improvement': '#d23a52', Poor: '#d23a52' };
function qrStone(s) { return QR_STONE[s] || '#0090ca'; }

// On-screen pill colours [foreground, background].
const QR_CELL = {
  ok: ['#1f9d57', 'var(--pos-bg)'], breach: ['#d23a52', 'var(--neg-bg)'],
  na: ['#9aa6b4', '#eef1f5'], info: ['#6a52d4', 'rgba(106,82,212,.12)'],
};
// Export (inline) cell colours — must be literal hex (Office HTML ignores CSS vars).
const QR_XLS_BG = { ok: '#e3f5ec', breach: '#fae3e7', na: '#eef1f5', info: '#efeafe' };
const QR_XLS_FG = { ok: '#157a43', breach: '#b32339', na: '#9aa6b4', info: '#5a45b8' };

function qrIsFormula(ind) { return ind && ind.formula && ind.formula !== 'direct'; }
function qrIsPct(ind) { return ((ind && ind.valueType) || '').indexOf('%') >= 0; }

// Genuine month value when present, else the quarter's reported value (derived).
// -> {value:number|null, derived:bool, real:bool}
function qrMonthValue(ind, m) {
  if (qrIsFormula(ind)) {
    const mn = ind.mNum && ind.mNum[m];
    if (mn != null && mn !== '') {
      const v = window.qiFormulaCompute ? window.qiFormulaCompute(ind.formula, mn, (ind.mDen || {})[m]) : Number(mn);
      return { value: v, derived: false, real: true };
    }
  } else if (ind.months && ind.months[m] != null && ind.months[m] !== '') {
    return { value: Number(ind.months[m]), derived: false, real: true };
  }
  const q = QR_MQ[m];
  const qv = ind.quarters ? ind.quarters[q] : null;
  return { value: (qv == null || qv === '') ? null : qv, derived: true, real: false };
}
function qrColValue(ind, c) {
  if (c.type === 'm') return qrMonthValue(ind, c.m);
  const v = ind.quarters ? ind.quarters[c.q] : null;
  return { value: (v == null || v === '') ? null : v, derived: false, real: true };
}
// 'na' (no value) | 'info' (no numeric benchmark) | 'ok' | 'breach'.
function qrStatus(ind, value) {
  if (value == null || value === '') return 'na';
  const b = ind.benchmarkValue;
  if (b == null || b === '') return 'info';
  const n = Number(value);
  if (ind.goalDirection === 'higher_is_better') return n >= b ? 'ok' : 'breach';
  return n <= b ? 'ok' : 'breach';
}
function qrFmtVal(ind, value) {
  if (value == null || value === '') return '–';
  const n = Number(value);
  const num = Number.isInteger(n) ? n : Math.round(n * 100) / 100;
  return qrIsPct(ind) ? num + '%' : num.toLocaleString();
}
// Aggregate over a set of columns. 'na'/'info' are EXCLUDED from the rate.
function qrDeptStats(d, cols) {
  let ok = 0, breach = 0, na = 0, info = 0;
  (d.indicators || []).forEach(ind => cols.forEach(c => {
    const s = qrStatus(ind, qrColValue(ind, c).value);
    if (s === 'ok') ok++; else if (s === 'breach') breach++; else if (s === 'info') info++; else na++;
  }));
  const denom = ok + breach;
  return { ok, breach, na, info, reported: ok + breach + info, total: ok + breach + na + info, rate: denom ? Math.round(ok * 100 / denom) : 100 };
}
function qrRag(rate) {
  if (rate >= 95) return { label: 'Green', color: '#1f9d57', bg: 'rgba(31,157,87,.12)' };
  if (rate >= 80) return { label: 'Amber', color: '#e08a1e', bg: 'rgba(224,138,30,.14)' };
  return { label: 'Red', color: '#d23a52', bg: 'rgba(210,58,82,.12)' };
}
function qrGoalText(ind) { return ind.goalDirection === 'higher_is_better' ? 'Higher is better' : 'Lower is better'; }
function qrMetaFld(v) { return v && typeof v === 'object' ? [v.name, v.designation].filter(Boolean).join(', ') : (v || ''); }

/* ---------------- tiny self-contained io helpers ---------------- */
function qrEsc(v) { return ((v == null ? '' : v) + '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function qrCsvCell(v) { return '"' + ((v == null ? '' : v) + '').replace(/"/g, '""') + '"'; }
function qrToast(msg, kind) { try { if (window.UI && window.UI.toast) window.UI.toast(msg, kind || 'success'); } catch (e) { } }
function qrDownload(content, filename, mime) {
  try {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { try { document.body.removeChild(a); URL.revokeObjectURL(url); } catch (e) { } }, 600);
  } catch (e) { try { console.error('[quality-report] download', e); } catch (_) { } }
}
function qrHospital() { return (window.UNICO && window.UNICO.HOSPITAL && window.UNICO.HOSPITAL.name) || 'UNICO Hospitals'; }
function qrToday() { try { return new Date().toISOString().slice(0, 10); } catch (e) { return ''; } }

/* ---------------- export HTML builders ---------------- */
function qrThCell(h) { return `<th style="background:#0090ca;color:#fff;border:1px solid #2b6f9c;padding:6px 8px;font-family:Calibri,Arial;text-align:center;font-size:10.5pt;white-space:nowrap">${qrEsc(h)}</th>`; }
function qrTd(content, extra) { return `<td style="border:1px solid #b9c6d2;padding:5px 8px;font-family:Calibri,Arial;font-size:10.5pt;${extra || ''}">${content}</td>`; }

function qrCellHTML(ind, c, showDerived) {
  const cv = qrColValue(ind, c);
  const s = qrStatus(ind, cv.value);
  const blank = cv.derived && !showDerived;
  const txt = (cv.value == null || blank) ? '—' : (qrFmtVal(ind, cv.value) + (cv.derived ? ' *' : ''));
  const bg = blank ? '#f6f8fa' : QR_XLS_BG[s];
  const fg = blank ? '#9aa6b4' : QR_XLS_FG[s];
  return qrTd(qrEsc(txt), `text-align:center;background:${bg};color:${fg};font-weight:600;white-space:nowrap`);
}
function qrTableHTML(d, cols, showDerived, onlyBreaches) {
  const inds = (d.indicators || []).filter(ind => !onlyBreaches || cols.some(c => qrStatus(ind, qrColValue(ind, c).value) === 'breach'));
  const th = ['Indicator', 'Benchmark', 'Goal'].concat(cols.map(c => c.label)).concat(['Remarks']).map(qrThCell).join('');
  if (!inds.length) return `<p style="font-family:Calibri;color:#888">No indicators${onlyBreaches ? ' breached in this period' : ''}.</p>`;
  const trs = inds.map((ind, i) => {
    const zebra = i % 2 ? '#f4f9fd' : '#fff';
    const lead = qrTd('<b>' + qrEsc(ind.name) + '</b>', 'text-align:left;min-width:180px')
      + qrTd(qrEsc(ind.benchmark || '—'), 'text-align:left')
      + qrTd(qrEsc(qrGoalText(ind)), 'text-align:left;white-space:nowrap');
    const mid = cols.map(c => qrCellHTML(ind, c, showDerived)).join('');
    const rem = qrTd(qrEsc(ind.remarks || '—'), 'text-align:left;color:#5b6675;font-size:9.5pt;max-width:240px');
    return `<tr style="background:${zebra}">${lead}${mid}${rem}</tr>`;
  }).join('');
  return `<table border="1" style="border-collapse:collapse;width:100%"><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`;
}
function qrDeptSectionHTML(d, cols, showDerived, onlyBreaches) {
  const st = qrDeptStats(d, cols); const rag = qrRag(st.rate); const ex = d.executive || {}; const meta = d.meta || {};
  const head = `<div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin:2px 0 8px">`
    + `<span style="font-size:15pt;font-weight:700;color:#0072a3">${qrEsc(d.name)}</span>`
    + `<span style="color:#666;font-size:10pt">FY ${qrEsc(d.year || '')}</span>`
    + `<span style="margin-left:auto;font-size:10pt;color:#333">Compliance <b style="color:${rag.color}">${st.rate}%</b> · `
    + `Breaches <b style="color:${st.breach ? '#b32339' : '#157a43'}">${st.breach}</b> · `
    + `<span style="background:${rag.bg};color:${rag.color};padding:1px 8px;border-radius:8px;font-weight:700">${rag.label}</span>`
    + (ex.overallStatus ? ` · ${qrEsc(ex.overallStatus)}` : '') + `</span></div>`;
  const execBits = [
    ex.keyAchievements && `<b>Key achievements:</b> ${qrEsc(ex.keyAchievements)}`,
    ex.majorGaps && `<b>Major gaps:</b> ${qrEsc(ex.majorGaps)}`,
    ex.recommendations && `<b>Recommendations:</b> ${qrEsc(ex.recommendations)}`,
  ].filter(Boolean);
  const exec = execBits.length ? `<div style="font-family:Calibri;font-size:9.5pt;color:#333;margin:0 0 8px;line-height:1.5">${execBits.join('<br/>')}</div>` : '';
  const signers = [['Prepared by', meta.preparedBy], ['Reviewed by', meta.reviewedBy], ['Approved by', meta.approvedBy]]
    .map(s => [s[0], qrMetaFld(s[1])]).filter(s => s[1]);
  const sign = signers.length ? `<div style="margin-top:8px;font-family:Calibri;font-size:9pt;color:#555">`
    + signers.map(s => `<span style="margin-right:22px"><b>${s[0]}:</b> ${qrEsc(s[1])}</span>`).join('') + `</div>` : '';
  return `<div style="margin:0 0 18px">${head}${exec}${qrTableHTML(d, cols, showDerived, onlyBreaches)}${sign}</div>`;
}

// fmt: 'csv' | 'excel' | 'word' | 'pdf' | 'print'
function qrRunExport(fmt, deps, cols, gran, showDerived, onlyBreaches, scopeLabel, setNote) {
  const date = qrToday();
  const hospital = qrHospital();
  const title = 'Quality Indicators — ' + (gran === 'quarterly' ? 'Quarterly' : 'Monthly') + ' Performance Report';
  const sub = `FY 2025–2026 · ${scopeLabel} · ${gran === 'monthly' ? 'Monthly' : 'Quarterly'} view · Generated ${date}`;
  const modeWord = gran === 'quarterly' ? 'Quarterly' : 'Monthly';
  const safe = (scopeLabel || 'All').replace(/[^\w.\- ]+/g, '').trim().replace(/\s+/g, '-') || 'All';
  const base = `UNICO-Quality-${modeWord}-${safe}-${date}`;
  const footnote = (gran === 'monthly' && showDerived)
    ? `<p style="font-family:Calibri;color:#888;font-size:8.5pt;margin-top:6px">* derived from the quarter's reported figure (indicator data is reported quarterly); blank where not reported.</p>` : '';

  if (fmt === 'csv') {
    const header = ['Department', 'Indicator', 'Type', 'Benchmark', 'Goal'].concat(cols.map(c => c.label)).concat(['Remarks']);
    const lines = [header.map(qrCsvCell).join(',')];
    deps.forEach(d => {
      const inds = (d.indicators || []).filter(ind => !onlyBreaches || cols.some(c => qrStatus(ind, qrColValue(ind, c).value) === 'breach'));
      inds.forEach(ind => {
        const row = [d.name, ind.name, ind.valueType || '', ind.benchmark || '', qrGoalText(ind)];
        cols.forEach(c => {
          const cv = qrColValue(ind, c);
          const blank = cv.derived && !showDerived;
          row.push((cv.value == null || blank) ? '' : (qrFmtVal(ind, cv.value) + (cv.derived ? ' *' : '')));
        });
        row.push(ind.remarks || '');
        lines.push(row.map(qrCsvCell).join(','));
      });
    });
    qrDownload('﻿' + lines.join('\r\n'), base + '.csv', 'text/csv;charset=utf-8');
    qrToast('CSV report downloaded');
    return;
  }

  const sections = deps.map(d => qrDeptSectionHTML(d, cols, showDerived, onlyBreaches)).join('');

  if (fmt === 'excel') {
    qrDownload(`<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head>`
      + `<body style="font-family:Calibri,Arial"><h2 style="margin:0;color:#0072a3">${qrEsc(hospital)}</h2>`
      + `<h3 style="margin:2px 0">${qrEsc(title)}</h3><div style="color:#666;margin-bottom:10px">${qrEsc(sub)}</div>`
      + `${sections}${footnote}</body></html>`, base + '.xls', 'application/vnd.ms-excel');
    qrToast('Excel report downloaded');
    return;
  }
  if (fmt === 'word') {
    qrDownload(`<html xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${qrEsc(title)}</title>`
      + `<style>@page{size:A4 landscape;margin:1.1cm} table{border-collapse:collapse}</style></head>`
      + `<body style="font-family:Calibri,Arial"><h2 style="margin:0;color:#0072a3">${qrEsc(hospital)}</h2>`
      + `<h3 style="margin:2px 0">${qrEsc(title)}</h3><div style="color:#666;margin-bottom:12px">${qrEsc(sub)}</div>`
      + `${sections}${footnote}<p style="color:#777;font-size:9pt;margin-top:14px">Confidential · Generated ${date}</p></body></html>`,
      base + '.doc', 'application/msword');
    qrToast('Word report downloaded');
    return;
  }

  // PDF / Print — render clean pages into #pdf-root and use the app's print path.
  const root = document.getElementById('pdf-root');
  if (!root) { try { window.print(); } catch (e) { } return; }
  const pageHead = `<div style="display:flex;align-items:flex-end;justify-content:space-between;border-bottom:2px solid #0090ca;padding-bottom:6px;margin-bottom:10px">`
    + `<div><div style="font-size:16px;font-weight:800;color:#0072a3">${qrEsc(hospital)}</div>`
    + `<div style="font-size:12px;color:#16202e;font-weight:600">${qrEsc(title)}</div></div>`
    + `<div style="text-align:right;font-size:9.5px;color:#8a93a3">${qrEsc(sub)}</div></div>`;
  const pages = deps.map(d => `<section class="pdf-page" style="padding:11mm 12mm;font-family:'IBM Plex Sans',Arial,sans-serif;color:#16202e">`
    + pageHead + qrDeptSectionHTML(d, cols, showDerived, onlyBreaches) + footnote
    + `<div class="pdf-foot" style="margin-top:auto;color:#9aa6b4;font-size:9px;border-top:1px solid #e4e9f0;padding-top:6px">`
    + `${qrEsc(hospital)} · Confidential · Generated ${date}</div></section>`).join('');
  root.innerHTML = `<div class="pdf-doc">${pages || '<section class="pdf-page" style="padding:12mm">No departments selected.</section>'}</div>`;
  document.body.classList.add('pdf-export-mode');

  const native = window.unicoNative;
  if (fmt === 'print' || !native || typeof native.exportPDF !== 'function') {
    const cleanup = () => { try { root.innerHTML = ''; document.body.classList.remove('pdf-export-mode'); window.removeEventListener('afterprint', cleanup); } catch (e) { } };
    window.addEventListener('afterprint', cleanup);
    setTimeout(() => { try { window.print(); } catch (e) { cleanup(); } }, 60);
    setTimeout(cleanup, 60000);
    return;
  }
  Promise.resolve(native.exportPDF({ pageSize: 'A4', landscape: true, defaultName: base })).catch(() => { }).then(res => {
    root.innerHTML = ''; document.body.classList.remove('pdf-export-mode');
    if (setNote) {
      if (res && res.ok) setNote({ ok: true, text: 'PDF ' + (res.path ? 'saved · ' + res.path : 'ready') });
      else if (res && res.canceled) { /* quiet */ }
      else setNote({ ok: false, text: (res && res.error) || 'Export finished.' });
    }
  });
}

/* ---------------- on-screen cell ---------------- */
function QRCell({ ind, c, showDerived }) {
  const cv = qrColValue(ind, c);
  const s = qrStatus(ind, cv.value);
  const tone = QR_CELL[s] || QR_CELL.na;
  const blank = cv.derived && !showDerived;
  const shown = (cv.value == null || blank) ? '–' : qrFmtVal(ind, cv.value);
  const tip = (c.full || c.label)
    + (cv.derived && cv.value != null ? ' · derived from ' + c.q + ' (reported quarterly)' : '')
    + (cv.real ? ' · reported monthly' : '')
    + (ind.quarterRemarks && ind.quarterRemarks[c.q] ? ' · ' + ind.quarterRemarks[c.q] : '');
  return (
    <td style={{ textAlign: 'center' }}>
      <span title={tip} style={{
        display: 'inline-grid', placeItems: 'center', minWidth: 36, height: 24, padding: '0 7px', borderRadius: 6,
        background: blank ? '#f3f5f8' : tone[1], color: blank ? '#9aa6b4' : tone[0],
        fontWeight: 700, fontSize: 11.5, fontStyle: cv.derived ? 'italic' : 'normal', opacity: blank ? 0.55 : 1,
      }}>
        {shown}{cv.derived && !blank && cv.value != null ? <sup style={{ fontSize: 8, marginLeft: 1, opacity: 0.7 }}>≈</sup> : null}
      </span>
    </td>
  );
}

/* ---------------- per-department card ---------------- */
function QRDeptCard({ d, cols, gran, showDerived, onlyBreaches, setRoute, onExport }) {
  const st = qrDeptStats(d, cols);
  const rag = qrRag(st.rate);
  const tone = qrStone((d.executive || {}).overallStatus);
  const inds = (d.indicators || []).filter(ind => !onlyBreaches || cols.some(c => qrStatus(ind, qrColValue(ind, c).value) === 'breach'));
  const coverage = st.total ? Math.round(st.reported * 100 / st.total) : 0;
  const trend = cols.map(c => {
    let ok = 0, br = 0;
    (d.indicators || []).forEach(ind => { const s = qrStatus(ind, qrColValue(ind, c).value); if (s === 'ok') ok++; else if (s === 'breach') br++; });
    return { m: c.label, rate: (ok + br) ? Math.round(ok * 100 / (ok + br)) : null };
  });
  const hasTrend = window.LineChart && trend.filter(t => t.rate != null).length >= 2;

  const Tile = ({ label, val, color }) => (
    <div style={{ minWidth: 96 }}>
      <div className="num" style={{ fontSize: 20, fontWeight: 700, color: color || 'var(--ink)', lineHeight: 1.1 }}>{val}</div>
      <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 2 }}>{label}</div>
    </div>
  );
  const xbtn = (fmt, icon, lbl) => (
    <button className="btn sm" title={'Export ' + lbl} onClick={() => onExport(d, fmt)}><Ic d={icon} s={13} />{lbl}</button>
  );

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div className="card-h" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: tone + '1a', color: tone, display: 'grid', placeItems: 'center' }}><Ic d={I.heart} s={18} /></div>
        <div>
          <h3 style={{ margin: 0, cursor: 'pointer' }} onClick={() => setRoute({ view: 'qualityDept', dept: d.key })}>{d.name}</h3>
          <span className="sub">FY {d.year} · {d.indicators.length} indicators</span>
        </div>
        <span className="spacer" />
        <span className="chip" style={{ background: rag.bg, color: rag.color, fontWeight: 700 }}>{rag.label}</span>
        <button className="btn sm" title="Add / edit indicators & set benchmarks for this department" onClick={() => setRoute({ view: 'qualityEdit', dept: d.key })}><Ic d={I.edit} s={13} />Edit</button>
        {xbtn('pdf', I.download, 'PDF')}
        {xbtn('excel', I.download, 'Excel')}
        {xbtn('word', I.doc, 'Word')}
        {xbtn('csv', I.download, 'CSV')}
      </div>

      <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', padding: '12px 16px', borderBottom: '1px solid var(--line-2)', background: 'var(--blue-50)' }}>
        <Tile label="Compliance" val={st.rate + '%'} color={rag.color} />
        <Tile label="On benchmark" val={st.ok} color="#1f9d57" />
        <Tile label="Breaches" val={st.breach} color={st.breach ? '#d23a52' : '#1f9d57'} />
        <Tile label="Informational" val={st.info} color="#6a52d4" />
        <Tile label="Reported coverage" val={coverage + '%'} color="#0090ca" />
        {hasTrend && (
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 10.5, color: 'var(--muted)', marginBottom: 2 }}>Compliance trend</div>
            <window.LineChart data={trend} x="m" y="rate" height={64} color={rag.color} />
          </div>
        )}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Indicator</th>
              <th style={{ textAlign: 'left' }}>Benchmark</th>
              {cols.map((c, ci) => <th key={ci} style={{ textAlign: 'center' }} title={c.full}>{c.label}</th>)}
              <th style={{ textAlign: 'left' }}>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {inds.length === 0 && (
              <tr><td colSpan={cols.length + 3} style={{ textAlign: 'center', color: 'var(--muted)', padding: 18 }}>No indicators{onlyBreaches ? ' breached in this period' : ''}.</td></tr>
            )}
            {inds.map(ind => (
              <tr key={ind.id}>
                <td style={{ textAlign: 'left' }}>
                  <b style={{ color: 'var(--ink)' }}>{ind.name}</b>
                  <div style={{ fontSize: 10, color: 'var(--faint)' }}>{ind.goalDirection === 'higher_is_better' ? '↑ higher is better' : '↓ lower is better'} · {ind.valueType}</div>
                </td>
                <td style={{ textAlign: 'left', fontSize: 11.5 }}>{ind.benchmark || '—'}</td>
                {cols.map((c, ci) => <QRCell key={ci} ind={ind} c={c} showDerived={showDerived} />)}
                <td style={{ textAlign: 'left', fontSize: 11, color: 'var(--muted)', maxWidth: 220 }}>{ind.remarks || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- main screen ---------------- */
function QualityReport({ setRoute, mode }) {
  const { useState, useMemo } = React;
  const isQ = mode === 'quarterly';
  const gran = isQ ? 'quarterly' : 'monthly';
  const allDeps = useMemo(() => (window.qualityData ? window.qualityData() : (window.QUALITY_SEED || [])).filter(d => d.indicators && d.indicators.length), []);

  const [scope, setScope] = useState('all');
  const [mFrom, setMFrom] = useState(0);
  const [mTo, setMTo] = useState(QR_MONTHS.length - 1);
  const [qFrom, setQFrom] = useState(0);
  const [qTo, setQTo] = useState(QR_QORDER.length - 1);
  const [showDerived, setShowDerived] = useState(true);
  const [onlyBreaches, setOnlyBreaches] = useState(false);
  const [note, setNote] = useState(null);

  const cols = useMemo(() => {
    if (isQ) {
      const lo = Math.min(qFrom, qTo), hi = Math.max(qFrom, qTo);
      return QR_QORDER.slice(lo, hi + 1).map(q => ({ type: 'q', q, label: q, full: QR_QLABEL[q] }));
    }
    const lo = Math.min(mFrom, mTo), hi = Math.max(mFrom, mTo);
    return QR_MONTHS.slice(lo, hi + 1).map(m => ({ type: 'm', m, q: QR_MQ[m], label: qrMonthLabel(m), full: qrMonthFull(m) }));
    // eslint-disable-next-line
  }, [isQ, mFrom, mTo, qFrom, qTo]);

  const deps = scope === 'all' ? allDeps : allDeps.filter(d => d.key === scope);
  const scopeLabel = scope === 'all' ? 'All Departments' : ((allDeps.find(d => d.key === scope) || {}).name || scope);
  const periodLabel = cols.length ? (cols[0].label + (cols.length > 1 ? ' – ' + cols[cols.length - 1].label : '')) : '';

  const totals = useMemo(() => {
    let ok = 0, breach = 0, na = 0, info = 0, ind = 0;
    deps.forEach(d => { ind += d.indicators.length; const s = qrDeptStats(d, cols); ok += s.ok; breach += s.breach; na += s.na; info += s.info; });
    const denom = ok + breach;
    return { ok, breach, na, info, ind, depts: deps.length, rate: denom ? Math.round(ok * 100 / denom) : 100 };
  }, [deps, cols]);

  const ranking = useMemo(() => deps.map(d => {
    const r = qrDeptStats(d, cols).rate;
    return { label: d.name, value: r, color: qrRag(r).color, key: d.key };
  }).sort((a, b) => b.value - a.value), [deps, cols]);

  const runExport = (fmt) => { setNote(null); qrRunExport(fmt, deps, cols, gran, showDerived, onlyBreaches, scopeLabel, setNote); };

  const sel = { padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8, fontSize: 12.5, fontFamily: 'inherit', background: '#fff', color: 'var(--ink)' };
  const Kpi = ({ label, val, foot, color }) => (
    <div className="card anim-pop" style={{ padding: '15px 18px', borderLeft: `4px solid ${color}`, display: 'flex', flexDirection: 'column', minHeight: 104 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)' }}>{label}</div>
      <div className="num" style={{ fontSize: 30, fontWeight: 700, color, margin: '8px 0 5px', lineHeight: 1 }}>{val}</div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 'auto' }}>{foot}</div>
    </div>
  );
  const Legend = () => (
    <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--muted)', flexWrap: 'wrap', alignItems: 'center' }}>
      {[['On benchmark', '#1f9d57'], ['Breach', '#d23a52'], ['Informational', '#6a52d4'], ['Not reported', '#9aa6b4']].map(([l, c]) => (
        <span key={l}><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: c, marginRight: 5, verticalAlign: 'middle' }} />{l}</span>
      ))}
      {gran === 'monthly' && <span style={{ fontStyle: 'italic' }}><sup>≈</sup> derived from quarter</span>}
    </div>
  );

  return (
    <div className="grid" style={{ gap: 16 }}>
      <SectionTitle icon={I.doc} title={isQ ? 'Quarterly Quality Report' : 'Monthly Quality Report'}
        sub={'Department-wise quality-indicator performance · FY 2025–2026 · ' + (isQ ? 'Quarterly' : 'Monthly') + ' view'}
        right={<>
          <button className="btn sm" onClick={() => runExport('print')}><Ic d={I.print} s={14} />Print</button>
          <button className="btn sm" onClick={() => runExport('excel')}><Ic d={I.download} s={14} />Excel</button>
          <button className="btn sm" onClick={() => runExport('word')}><Ic d={I.doc} s={14} />Word</button>
          <button className="btn sm" onClick={() => runExport('csv')}><Ic d={I.download} s={14} />CSV</button>
          <button className="btn pri sm" onClick={() => runExport('pdf')}><Ic d={I.download} s={14} />Export PDF</button>
        </>} />

      {/* config toolbar */}
      <div className="card" style={{ padding: '14px 16px', display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field" style={{ margin: 0 }}>
          <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Department</label>
          <select value={scope} onChange={e => setScope(e.target.value)} style={sel}>
            <option value="all">All departments ({allDeps.length})</option>
            {allDeps.map(d => <option key={d.key} value={d.key}>{d.name}</option>)}
          </select>
        </div>
        <div style={{ margin: 0 }}>
          <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Period ({isQ ? 'quarters' : 'months'})</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {isQ ? (
              <>
                <select value={qFrom} onChange={e => setQFrom(+e.target.value)} style={sel}>
                  {QR_QORDER.map((q, i) => <option key={q} value={i}>{q}</option>)}
                </select>
                <span style={{ color: 'var(--muted)', fontSize: 12 }}>to</span>
                <select value={qTo} onChange={e => setQTo(+e.target.value)} style={sel}>
                  {QR_QORDER.map((q, i) => <option key={q} value={i}>{q}</option>)}
                </select>
              </>
            ) : (
              <>
                <select value={mFrom} onChange={e => setMFrom(+e.target.value)} style={sel}>
                  {QR_MONTHS.map((m, i) => <option key={m} value={i}>{qrMonthLabel(m)}</option>)}
                </select>
                <span style={{ color: 'var(--muted)', fontSize: 12 }}>to</span>
                <select value={mTo} onChange={e => setMTo(+e.target.value)} style={sel}>
                  {QR_MONTHS.map((m, i) => <option key={m} value={i}>{qrMonthLabel(m)}</option>)}
                </select>
              </>
            )}
          </div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--ink-2)', cursor: 'pointer' }}>
          <input type="checkbox" checked={onlyBreaches} onChange={e => setOnlyBreaches(e.target.checked)} />Only breached indicators
        </label>
        {gran === 'monthly' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--ink-2)', cursor: 'pointer' }}>
            <input type="checkbox" checked={showDerived} onChange={e => setShowDerived(e.target.checked)} />Show derived months
          </label>
        )}
        <span className="spacer" />
        <Legend />
      </div>

      {note && (
        <div className="card" style={{ padding: '10px 14px', fontSize: 12.5, color: note.ok ? '#157a43' : '#b32339', borderLeft: `4px solid ${note.ok ? '#1f9d57' : '#d23a52'}` }}>{note.text}</div>
      )}

      {gran === 'monthly' && (
        <div style={{ padding: '9px 14px', fontSize: 11.5, color: 'var(--muted)', background: 'var(--blue-50)', border: '1px solid var(--line-2)', borderRadius: 8 }}>
          Indicators are reported quarterly. Months marked <sup>≈</sup> are derived by applying the quarter's reported value to each of its months; genuine monthly figures (entered via the editor) are shown without the mark. Toggle “Show derived months” to view only real monthly entries.
        </div>
      )}

      {/* hospital-wide roll-up (only for All) */}
      {scope === 'all' && (
        <>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
            <Kpi label="Departments" val={totals.depts} foot="reporting quality KPIs" color="#0090ca" />
            <Kpi label="Indicators" val={totals.ind} foot="tracked across departments" color="#6a52d4" />
            <Kpi label="Compliance" val={totals.rate + '%'} foot={`${totals.ok} on benchmark · ${totals.breach} breaches`} color={qrRag(totals.rate).color} />
            <Kpi label="Breaches" val={totals.breach} foot={`over ${cols.length} ${gran === 'monthly' ? 'month' : 'quarter'}${cols.length !== 1 ? 's' : ''}`} color={totals.breach ? '#d23a52' : '#1f9d57'} />
          </div>
          {window.HBar && ranking.length > 1 && (
            <div className="card">
              <div className="card-h"><h3>Department Compliance Ranking</h3><span className="sub">{periodLabel}</span><span className="spacer" /></div>
              <div className="card-b"><window.HBar rows={ranking} /></div>
            </div>
          )}
        </>
      )}

      {deps.length === 0 && (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>No quality data to report.</div>
      )}
      {deps.map(d => (
        <QRDeptCard key={d.key} d={d} cols={cols} gran={gran} showDerived={showDerived} onlyBreaches={onlyBreaches}
          setRoute={setRoute} onExport={(dd, fmt) => qrRunExport(fmt, [dd], cols, gran, showDerived, onlyBreaches, dd.name, setNote)} />
      ))}
    </div>
  );
}

window.QualityReport = QualityReport;
