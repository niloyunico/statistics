/* ===== reports.jsx ===== */
(function(){
const PAGE_SIZES = {
  A4: [700, 1.414],
  A3: [815, 1.414],
  Letter: [700, 1.294]
};
const CHART_STYLE_LABEL = {
  bar3d: '3D Bars',
  bar: 'Bar',
  line: 'Line',
  area: 'Area + Target',
  combo: 'Bar + Line',
  grouped: 'Grouped',
  stacked: 'Stacked',
  pct: '100% Stacked',
  horizontal: 'Horizontal',
  donut: 'Composition'
};
const REPORT_STYLES = [['bar3d', '3D'], ['bar', 'Bar'], ['line', 'Line'], ['area', 'Area'], ['combo', 'Bar+Line'], ['grouped', 'Grouped'], ['stacked', 'Stacked'], ['pct', '100%'], ['horizontal', 'Horizontal'], ['donut', 'Donut']];
function reportSeries(d) {
  return d.cols.filter(c => c.id !== d.primary && !c.pct).slice(0, 6).map((c, i) => ({
    id: c.id,
    label: c.label,
    color: PALETTE[i % PALETTE.length]
  }));
}
function rptTransferInCol(d) {
  return (d.cols || []).find(c => c.id !== d.primary && !c.pct && (c.id === 'tin' || c.id === 'trin' || c.id === 'tr_in' || /^\s*tr[\s._-]*in\s*$/i.test(c.label || '') || /transfer\s*[-\s]?in/i.test(c.label || '')));
}
function rptAdmitsPrimary(d) {
  const pc = (d.cols || []).find(c => c.id === d.primary) || {};
  return d.primary === 'adm' || d.primary === 'admission' || /admission/i.test(pc.label || '') || /admission/i.test(d.primaryLabel || '');
}
function rptMergeTin(d) {
  return rptAdmitsPrimary(d) ? rptTransferInCol(d) : null;
}
function rptChartRows(d, fs) {
  const t = rptMergeTin(d);
  if (!t) return fs;
  return fs.map(r => ({
    ...r,
    [d.primary]: (r[d.primary] || 0) + (r[t.id] || 0)
  }));
}
function compositionGroups(d, fs) {
  const sum = id => fs.reduce((s, r) => s + (r[id] || 0), 0);
  const colBy = id => (d.cols || []).find(c => c.id === id);
  const mk = ids => ids.map(colBy).filter(Boolean).map((c, i) => ({
    label: c.label,
    value: sum(c.id),
    color: PALETTE[i % PALETTE.length]
  })).filter(x => x.value > 0);
  if (d.id === 'dialysis') {
    return [{
      title: 'Patients',
      data: mk(['ipd', 'opd'])
    }, {
      title: 'Dialysis Type',
      data: mk(['conv', 'modi', 'sled'])
    }].filter(g => g.data.length > 1);
  }
  const tin = rptMergeTin(d);
  const showAdm = rptAdmitsPrimary(d);
  const breakdown = (d.cols || []).filter(c => c.id !== d.primary && !c.pct && !(tin && c.id === tin.id));
  let list = breakdown.map(c => ({
    label: c.label,
    value: sum(c.id)
  }));
  if (showAdm) {
    const pc = colBy(d.primary) || {};
    list = [{
      label: pc.label || d.primaryLabel || 'Admission',
      value: sum(d.primary) + (tin ? sum(tin.id) : 0)
    }, ...list];
  }
  const data = list.map((x, i) => ({
    label: x.label,
    value: x.value,
    color: PALETTE[i % PALETTE.length]
  })).filter(x => x.value > 0);
  return data.length > 1 ? [{
    title: 'Composition',
    data
  }] : [];
}
function reportChartEl(d, style, tone, fs, compGroups) {
  const has = n => typeof window[n] === 'function';
  if (style === 'bar') return React.createElement(BarChart, {
    data: fs,
    x: "month",
    y: d.primary,
    height: 195,
    color: tone,
    flat: true
  });
  if (style === 'line') return React.createElement(LineChart, {
    data: fs,
    x: "full",
    y: d.primary,
    height: 195,
    color: tone,
    flat: true
  });
  if (style === 'area' && has('AreaTargetChart')) {
    const avg = fs.length ? Math.round(fs.reduce((s, r) => s + (r[d.primary] || 0), 0) / fs.length) : 0;
    return React.createElement(AreaTargetChart, {
      data: fs,
      x: "full",
      y: d.primary,
      target: avg,
      height: 200,
      color: tone,
      flat: true
    });
  }
  if (style === 'combo' && has('ComboChart')) {
    const pctCol = d.cols.find(c => c.pct);
    const lineKey = pctCol ? pctCol.id : (d.cols.find(c => c.id !== d.primary && !c.pct) || {}).id || d.primary;
    return React.createElement(ComboChart, {
      data: fs,
      x: "month",
      barKey: d.primary,
      lineKey: lineKey,
      barColor: tone,
      lineColor: "#e08a1e",
      barLabel: (d.cols.find(c => c.id === d.primary) || {}).label || 'Value',
      lineLabel: (d.cols.find(c => c.id === lineKey) || {}).label || 'Trend',
      height: 210,
      flat: true
    });
  }
  if (style === 'grouped') {
    const sr = reportSeries(d);
    return sr.length ? React.createElement(GroupedBar, {
      data: fs,
      x: "month",
      series: sr,
      height: 210
    }) : React.createElement(BarChart, {
      data: fs,
      x: "month",
      y: d.primary,
      height: 195,
      color: tone,
      flat: true
    });
  }
  if (style === 'stacked') {
    const sr = reportSeries(d);
    return sr.length ? React.createElement(StackedBar, {
      data: fs,
      x: "month",
      series: sr,
      height: 210
    }) : React.createElement(BarChart, {
      data: fs,
      x: "month",
      y: d.primary,
      height: 195,
      color: tone,
      flat: true
    });
  }
  if (style === 'pct' && has('StackedPctBar')) {
    const sr = reportSeries(d);
    return sr.length ? React.createElement(StackedPctBar, {
      data: fs,
      x: "month",
      series: sr,
      height: 210,
      flat: true
    }) : React.createElement(BarChart, {
      data: fs,
      x: "month",
      y: d.primary,
      height: 195,
      color: tone,
      flat: true
    });
  }
  if (style === 'horizontal' && has('HBarChart')) return React.createElement(HBarChart, {
    data: fs.map(r => ({
      label: r.full,
      val: r[d.primary] || 0
    })),
    x: "label",
    y: "val",
    height: Math.max(150, fs.length * 30),
    flat: true
  });
  if (style === 'donut') return compGroups.length ? React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 18,
      justifyContent: 'space-around',
      alignItems: 'center',
      minHeight: 205
    }
  }, compGroups.map((g, gi) => React.createElement("div", {
    key: gi,
    style: {
      display: 'grid',
      placeItems: 'center'
    }
  }, React.createElement(Donut, {
    data: g.data,
    size: compGroups.length > 1 ? 152 : 188,
    centerValue: fmt(g.data.reduce((s, x) => s + x.value, 0)),
    centerLabel: compGroups.length > 1 ? g.title : 'Total',
    flat: true
  })))) : React.createElement(Bar3D, {
    data: fs,
    x: "month",
    y: d.primary,
    height: 205,
    color: tone,
    flat: true
  });
  return React.createElement(Bar3D, {
    data: fs,
    x: "month",
    y: d.primary,
    height: 205,
    color: tone,
    flat: true
  });
}
const MONO = "'IBM Plex Mono',ui-monospace,SFMono-Regular,Menlo,monospace";
function msEsc(s) {
  return ((s == null ? '' : s) + '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function msDownload(content, filename, mime) {
  try {
    const blob = new Blob([content], {
      type: mime
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try {
        document.body.removeChild(a);
      } catch (e) {}
      URL.revokeObjectURL(url);
    }, 600);
  } catch (e) {}
}
function msVal(d, colId, monthKey) {
  const r = d.series.find(s => s.month === monthKey);
  const v = r ? r[colId] : null;
  return v == null || v === '' ? null : v;
}
function msFmt(col, v) {
  return v == null ? '–' : col.pct ? fmt(v) + '%' : fmt(v);
}
function msPrimaryCol(d) {
  return (d.cols || []).find(c => c.id === d.primary) || (d.cols || [])[0] || {
    id: d.primary,
    label: d.primaryLabel || d.primary
  };
}
function msReportHTML(depts) {
  const date = new Date().toISOString().slice(0, 10);
  const yrs = [...new Set((depts || []).flatMap(d => d.months || []).map(m => String(m).split('-')[1]).filter(Boolean))].sort();
  const fy = yrs.length ? 'FY 20' + yrs[0] + '–' + yrs[yrs.length - 1] : 'FY';
  let body = '<h1 style="font-family:Calibri,Arial;color:#0072a3;margin:0 0 2px">UNICO Hospitals — Monthly Statistics Report</h1>' + '<div style="font-family:Calibri;color:#555;margin-bottom:12px">' + fy + ' · generated ' + date + ' · Confidential</div>';
  depts.forEach(d => {
    const pc = msPrimaryCol(d),
      tot = d.series.reduce((s, r) => s + (r[d.primary] || 0), 0),
      peak = d.series.length ? Math.max(...d.series.map(r => r[d.primary] || 0)) : 0;
    body += '<h2 style="font-family:Calibri;color:#16202e;margin:16px 0 3px">' + msEsc(d.name) + '</h2>' + '<div style="font-family:Calibri;color:#555;margin-bottom:6px">Total ' + msEsc(pc.label) + ': <b>' + fmt(tot) + '</b> · Peak: <b>' + fmt(peak) + '</b> · Metrics: ' + d.cols.length + '</div>';
    const th = ['Metric'].concat(d.months.map(k => msEsc(window.UNICO.MONTHS_FULL[k] || k))).map(h => '<th style="background:#0090ca;color:#fff;border:1px solid #2b6f9c;padding:5px 7px;font-family:Calibri;font-size:10.5pt;text-align:left">' + h + '</th>').join('');
    const trs = d.cols.map((col, i) => {
      const cells = ['<span style="font-weight:' + (col.id === d.primary ? 700 : 400) + '">' + msEsc(col.label) + '</span>'].concat(d.series.map(r => {
        const v = r[col.id];
        return msEsc(v == null || v === '' ? '–' : col.pct ? fmt(v) + '%' : fmt(v));
      }));
      return '<tr style="background:' + (i % 2 ? '#eef6fb' : '#fff') + '">' + cells.map((c, ci) => '<td style="border:1px solid #b9c6d2;padding:4px 7px;font-family:Calibri;font-size:10pt;' + (ci ? 'text-align:center' : '') + '">' + c + '</td>').join('') + '</tr>';
    }).join('');
    body += '<table border="1" style="border-collapse:collapse"><thead><tr>' + th + '</tr></thead><tbody>' + trs + '</tbody></table>';
  });
  const sig = window.unicoSig && window.unicoSig.load() || {
    prepared: '',
    reviewed: '',
    recommended: '',
    approved: ''
  };
  body += '<table style="border-collapse:collapse;width:100%;margin-top:30px"><tr>' + [['Prepared by', sig.prepared], ['Checked by', sig.reviewed], ['Recommended by', sig.recommended], ['Approved by', sig.approved]].map(([role, name]) => '<td style="width:25%;padding:0 18px 0 0;border:0"><div style="border-bottom:1.2px solid #16202e;height:36px"></div>' + '<div style="font-family:Calibri;font-size:10.5pt;font-weight:700;color:#16202e;margin-top:3px">' + msEsc(name || ' ') + '</div>' + '<div style="font-family:Calibri;font-size:8.5pt;color:#555;text-transform:uppercase">' + role + '</div></td>').join('') + '</tr></table>';
  return body;
}
function msExport(depts, f) {
  const base = 'UNICO-Statistics-Report-' + new Date().toISOString().slice(0, 10);
  if (f === 'csv') {
    const AX = [...new Set(depts.flatMap(d => d.months))].sort((a, b) => window.UNICO.MONTH_ORDER.indexOf(a) - window.UNICO.MONTH_ORDER.indexOf(b));
    const rows = [['Department', 'Metric', 'Type'].concat(AX.map(k => window.UNICO.MONTHS_FULL[k] || k))];
    depts.forEach(d => d.cols.forEach(col => {
      rows.push([d.name, col.label + (col.id === d.primary ? ' (primary)' : ''), col.pct ? 'percent' : 'count'].concat(AX.map(k => {
        const r = d.series.find(s => s.month === k);
        const v = r ? r[col.id] : null;
        return v == null || v === '' ? '' : col.pct ? v + '%' : v;
      })));
    }));
    msDownload('﻿' + rows.map(r => r.map(c => '"' + ((c == null ? '' : c) + '').replace(/"/g, '""') + '"').join(',')).join('\r\n'), base + '.csv', 'text/csv;charset=utf-8');
    return;
  }
  const html = '<html xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><style>@page{size:A4 landscape;margin:1cm}</style></head><body>' + msReportHTML(depts) + '</body></html>';
  if (f === 'excel') return msDownload(html, base + '.xls', 'application/vnd.ms-excel');
  if (f === 'word') return msDownload(html, base + '.doc', 'application/msword');
  if (f === 'pdf') {
    const root = typeof document !== 'undefined' ? document.getElementById('pdf-root') : null;
    const native = window.unicoNative;
    if (!root) {
      try {
        window.print();
      } catch (e) {}
      return;
    }
    root.innerHTML = '<div class="pdf-page" style="padding:9mm 10mm;font-family:Calibri,Arial">' + msReportHTML(depts) + '</div>';
    document.body.classList.add('pdf-export-mode');
    const done = () => {
      root.innerHTML = '';
      document.body.classList.remove('pdf-export-mode');
    };
    if (native && typeof native.exportPDF === 'function') {
      Promise.resolve(native.exportPDF({
        pageSize: 'A4',
        landscape: true,
        defaultName: base
      })).catch(() => {}).then(done);
    } else {
      try {
        window.print();
      } catch (e) {}
      setTimeout(done, 700);
    }
  }
}
function MSSpark({
  d,
  colId
}) {
  const AX = [...new Set(d.months)].sort((a, b) => window.UNICO.MONTH_ORDER.indexOf(a) - window.UNICO.MONTH_ORDER.indexOf(b));
  const vals = AX.map(k => {
    const r = d.series.find(s => s.month === k);
    const v = r ? r[colId] : null;
    return v == null || v === '' ? 0 : v;
  });
  if (!vals.some(v => v > 0)) return React.createElement("span", {
    style: {
      color: 'var(--faint)',
      fontSize: 10,
      fontFamily: MONO
    }
  }, "\u2013");
  const col = colId === d.primary ? PALETTE[0] : '#3ab5a7';
  return React.createElement(Spark, {
    values: vals,
    color: col,
    w: 92,
    h: 24,
    fill: false
  });
}
function MSBars({
  scope,
  AX,
  color = PALETTE[0]
}) {
  const data = AX.map(k => ({
    label: k.split('-')[0],
    v: scope.reduce((s, d) => {
      const r = d.series.find(x => x.month === k);
      return s + (r && r[d.primary] || 0);
    }, 0)
  }));
  const max = Math.max(1, ...data.map(d => d.v));
  return React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: 5,
      height: 180
    }
  }, data.map((d, i) => React.createElement("div", {
    key: i,
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 4,
      height: '100%',
      justifyContent: 'flex-end'
    }
  }, React.createElement("span", {
    style: {
      fontSize: 8.5,
      fontFamily: MONO,
      color: 'var(--muted)'
    }
  }, d.v || ''), React.createElement("div", {
    title: d.label + ': ' + d.v,
    style: {
      width: '100%',
      maxWidth: 26,
      background: d.v ? color : 'var(--line-2)',
      borderRadius: '3px 3px 0 0',
      height: d.v / max * 100 + '%',
      minHeight: 3
    }
  }), React.createElement("span", {
    style: {
      fontSize: 8,
      color: 'var(--faint)'
    }
  }, d.label))));
}
function MonthlyStatsReport({
  depts
}) {
  const [dept, setDept] = React.useState('all');
  const MF = window.UNICO.MONTHS_FULL,
    MO = window.UNICO.MONTH_ORDER;
  const scope = dept === 'all' ? depts : depts.filter(d => d.id === dept);
  const AX = [...new Set(scope.flatMap(d => d.months))].sort((a, b) => MO.indexOf(a) - MO.indexOf(b));
  const scopeName = dept === 'all' ? 'All departments' : scope[0] && scope[0].name || '—';
  const single = dept !== 'all' ? scope[0] : null;
  const primaryLabel = single ? msPrimaryCol(single).label || single.primaryLabel || 'Volume' : 'Volume';
  const monthTotals = AX.map(k => scope.reduce((s, d) => {
    const r = rptChartRows(d, d.series).find(x => x.month === k);
    return s + (r && r[d.primary] || 0);
  }, 0));
  const kpi = {
    total: scope.reduce((a, d) => a + rptChartRows(d, d.series).reduce((s, r) => s + (r[d.primary] || 0), 0), 0),
    peak: monthTotals.length ? Math.max(...monthTotals) : 0,
    months: AX.length
  };
  const avg = kpi.months ? Math.round(kpi.total / kpi.months) : 0;
  const metricCount = scope.reduce((n, d) => n + d.cols.length, 0);
  const multiYr = new Set(AX.map(k => k.split('-')[1])).size > 1;
  const barData = AX.map((k, i) => ({
    month: multiYr ? k.split('-')[0] + " '" + k.split('-')[1] : k.split('-')[0],
    val: monthTotals[i]
  }));
  const hasCombo = typeof window.ComboChart === 'function';
  const cardBox = {
    background: 'linear-gradient(152deg,rgba(255,255,255,.76),rgba(236,247,255,.46))',
    backdropFilter: 'blur(26px) saturate(1.75)',
    WebkitBackdropFilter: 'blur(26px) saturate(1.75)',
    border: '1px solid rgba(255,255,255,.92)',
    boxShadow: '0 14px 42px rgba(31,59,90,.14),0 4px 16px rgba(0,144,202,.09),inset 0 1px 0 rgba(255,255,255,.95)',
    borderRadius: 16,
    padding: '14px 16px'
  };
  const EXP = [['pdf', 'PDF'], ['excel', 'Excel'], ['word', 'Word'], ['csv', 'CSV']];
  const expBtn = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    border: '1px solid var(--line)',
    borderRadius: 7,
    background: '#fff',
    color: 'var(--ink-2)',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer'
  };
  const primaryChart = () => {
    if (single) {
      const pctCol = single.cols.find(c => c.pct);
      const lineKey = pctCol ? pctCol.id : single.primary;
      if (hasCombo) return React.createElement(ComboChart, {
        data: single.series,
        x: "month",
        barKey: single.primary,
        lineKey: lineKey,
        barLabel: msPrimaryCol(single).label,
        lineLabel: (single.cols.find(c => c.id === lineKey) || {}).label || 'Trend',
        barColor: PALETTE[0],
        lineColor: "#e08a1e",
        height: 210,
        flat: true
      });
      return React.createElement(BarChart, {
        data: single.series,
        x: "month",
        y: single.primary,
        height: 200,
        color: PALETTE[0],
        flat: true
      });
    }
    if (hasCombo) return React.createElement(ComboChart, {
      data: barData,
      x: "month",
      barKey: "val",
      lineKey: "val",
      barLabel: "Total",
      lineLabel: "Trend",
      barColor: PALETTE[0],
      lineColor: "#e08a1e",
      height: 210,
      flat: true
    });
    if (typeof window.BarChart === 'function') return React.createElement(BarChart, {
      data: barData,
      x: "month",
      y: "val",
      height: 200,
      color: PALETTE[0],
      flat: true
    });
    return React.createElement(MSBars, {
      scope: scope,
      AX: AX,
      color: PALETTE[0]
    });
  };
  const firstLabel = AX.length ? MF[AX[0]] || AX[0] : '—';
  const lastLabel = AX.length ? MF[AX[AX.length - 1]] || AX[AX.length - 1] : '—';
  const fyLabel = AX.length ? 'FY 20' + String(AX[0]).split('-')[1] + '–' + String(AX[AX.length - 1]).split('-')[1] : 'FY —';
  return React.createElement("div", null, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
      marginBottom: 14,
      background: 'linear-gradient(152deg,rgba(255,255,255,.76),rgba(236,247,255,.46))',
      backdropFilter: 'blur(26px) saturate(1.75)',
      WebkitBackdropFilter: 'blur(26px) saturate(1.75)',
      border: '1px solid rgba(255,255,255,.92)',
      boxShadow: '0 14px 42px rgba(31,59,90,.14),0 4px 16px rgba(0,144,202,.09),inset 0 1px 0 rgba(255,255,255,.95)',
      borderRadius: 12,
      padding: '10px 13px'
    }
  }, React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: 'var(--ink)'
    }
  }, "Export full report (all departments, all metrics):"), EXP.map(([f, l]) => React.createElement("button", {
    key: f,
    onClick: () => msExport(depts, f),
    style: expBtn
  }, React.createElement(Ic, {
    d: I.download,
    s: 14
  }), l)), React.createElement("span", {
    style: {
      flex: 1
    }
  }), React.createElement("span", {
    style: {
      fontSize: 11,
      color: 'var(--muted)'
    }
  }, depts.length, " departments \xB7 ", depts.reduce((n, d) => n + d.cols.length, 0), " metrics in scope")), React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginBottom: 14,
      flexWrap: 'wrap'
    }
  }, React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 600,
      color: 'var(--ink-2)'
    }
  }, "Scope"), React.createElement("select", {
    value: dept,
    onChange: e => setDept(e.target.value),
    style: {
      padding: '8px 11px',
      border: '1px solid var(--line)',
      borderRadius: 8,
      fontSize: 12.5,
      fontWeight: 600,
      background: '#fff',
      color: 'var(--ink)',
      outline: 'none'
    }
  }, React.createElement("option", {
    value: "all"
  }, "All departments"), depts.map(d => React.createElement("option", {
    key: d.id,
    value: d.id
  }, d.name)))), React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '220px 1fr',
      gap: 14,
      marginBottom: 14
    }
  }, React.createElement("div", {
    style: {
      ...cardBox,
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, [['Total', fmt(kpi.total)], ['Peak month', fmt(kpi.peak)], ['Avg / month', fmt(avg)]].map(([l, v]) => React.createElement("div", {
    key: l
  }, React.createElement("div", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      color: 'var(--muted)',
      textTransform: 'uppercase',
      letterSpacing: '.4px'
    }
  }, l), React.createElement("div", {
    style: {
      fontFamily: MONO,
      fontSize: 22,
      fontWeight: 700,
      color: 'var(--ink)'
    }
  }, v))), React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--muted)',
      borderTop: '1px solid var(--line-2)',
      paddingTop: 10
    }
  }, React.createElement("b", {
    style: {
      color: 'var(--ink)'
    }
  }, metricCount), " metrics \xB7 ", scope.length, " department", scope.length !== 1 ? 's' : ''), single && React.createElement("div", null, React.createElement(Delta, {
    v: single.delta
  }))), React.createElement("div", {
    style: cardBox
  }, React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: 'var(--muted)',
      textTransform: 'uppercase',
      letterSpacing: '.4px',
      marginBottom: 10
    }
  }, "Monthly ", primaryLabel, " \u2014 ", scopeName), primaryChart())), React.createElement("div", {
    style: {
      background: 'linear-gradient(152deg,rgba(255,255,255,.76),rgba(236,247,255,.46))',
      backdropFilter: 'blur(26px) saturate(1.75)',
      WebkitBackdropFilter: 'blur(26px) saturate(1.75)',
      border: '1px solid rgba(255,255,255,.92)',
      boxShadow: '0 14px 42px rgba(31,59,90,.14),0 4px 16px rgba(0,144,202,.09),inset 0 1px 0 rgba(255,255,255,.95)',
      borderRadius: 16,
      overflow: 'hidden'
    }
  }, React.createElement("div", {
    style: {
      padding: '14px 18px',
      borderBottom: '1px solid var(--line-2)',
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      flexWrap: 'wrap',
      background: 'linear-gradient(150deg,#ffffff,#f5fafd)'
    }
  }, React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      color: 'var(--ink)'
    }
  }, "UNICO Hospitals \u2014 ", scopeName), React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--muted)'
    }
  }, "Monthly Statistics Report \xB7 ", fyLabel, " \xB7 ", firstLabel, " \u2013 ", lastLabel)), React.createElement("div", {
    style: {
      textAlign: 'center'
    }
  }, React.createElement("div", {
    style: {
      fontFamily: MONO,
      fontSize: 18,
      fontWeight: 700,
      color: PALETTE[0]
    }
  }, fmt(kpi.total)), React.createElement("div", {
    style: {
      fontSize: 10,
      color: 'var(--faint)',
      textTransform: 'uppercase',
      letterSpacing: '.4px'
    }
  }, "total")), React.createElement("div", {
    style: {
      textAlign: 'center'
    }
  }, React.createElement("div", {
    style: {
      fontFamily: MONO,
      fontSize: 18,
      fontWeight: 700,
      color: '#3ab5a7'
    }
  }, metricCount), React.createElement("div", {
    style: {
      fontSize: 10,
      color: 'var(--faint)',
      textTransform: 'uppercase',
      letterSpacing: '.4px'
    }
  }, "metrics"))), React.createElement("div", {
    style: {
      overflowX: 'auto'
    }
  }, React.createElement("table", {
    style: {
      borderCollapse: 'collapse',
      fontSize: 11,
      width: '100%',
      minWidth: 380 + AX.length * 46
    }
  }, React.createElement("thead", null, React.createElement("tr", {
    style: {
      background: '#f7f9fc'
    }
  }, dept === 'all' && React.createElement("th", {
    style: {
      textAlign: 'left',
      padding: '8px 8px',
      fontSize: 9.5,
      color: 'var(--muted)',
      fontWeight: 700,
      borderBottom: '1px solid var(--line)',
      background: '#f7f9fc'
    }
  }, "Dept"), React.createElement("th", {
    style: {
      textAlign: 'left',
      padding: '8px 10px',
      fontSize: 10,
      textTransform: 'uppercase',
      letterSpacing: '.2px',
      color: 'var(--muted)',
      fontWeight: 700,
      borderBottom: '1px solid var(--line)',
      background: '#f7f9fc',
      minWidth: 190
    }
  }, "Metric"), AX.map(k => React.createElement("th", {
    key: k,
    style: {
      textAlign: 'center',
      padding: '8px 4px',
      fontSize: 9,
      color: 'var(--muted)',
      fontWeight: 700,
      borderBottom: '1px solid var(--line)',
      background: '#f7f9fc'
    }
  }, k.split('-')[0])), React.createElement("th", {
    style: {
      textAlign: 'center',
      padding: '8px 6px',
      fontSize: 9,
      color: 'var(--muted)',
      fontWeight: 700,
      borderBottom: '1px solid var(--line)',
      background: '#f7f9fc'
    }
  }, "Trend"))), React.createElement("tbody", null, scope.map(d => d.cols.map(col => {
    const isPrimary = col.id === d.primary;
    return React.createElement("tr", {
      key: d.id + '/' + col.id,
      style: {
        borderBottom: '1px solid var(--line-2)'
      }
    }, dept === 'all' && React.createElement("td", {
      style: {
        padding: '6px 8px',
        textAlign: 'left',
        fontSize: 10,
        color: 'var(--muted)',
        whiteSpace: 'nowrap',
        fontWeight: 600
      }
    }, col === d.cols[0] ? d.name : ''), React.createElement("td", {
      style: {
        padding: '7px 10px',
        textAlign: 'left',
        fontWeight: 600,
        color: 'var(--ink)'
      }
    }, col.label, isPrimary ? ' ★' : ''), AX.map(k => {
      const v = msVal(d, col.id, k);
      const bg = v == null ? 'transparent' : isPrimary ? '#eef6fb' : '#f4f6f9';
      const cc = v == null ? 'var(--faint)' : 'var(--ink)';
      return React.createElement("td", {
        key: k,
        style: {
          textAlign: 'center',
          padding: '4px 3px'
        }
      }, React.createElement("span", {
        style: {
          display: 'inline-block',
          minWidth: 30,
          padding: '3px 4px',
          borderRadius: 5,
          background: bg,
          color: cc,
          fontFamily: MONO,
          fontWeight: 600,
          fontSize: 10
        }
      }, v == null ? '·' : msFmt(col, v)));
    }), React.createElement("td", {
      style: {
        textAlign: 'center',
        padding: '4px 6px'
      }
    }, React.createElement(MSSpark, {
      d: d,
      colId: col.id
    })));
  })))))), (() => {
    const sig = window.unicoSig && window.unicoSig.load() || {
      prepared: '',
      reviewed: '',
      recommended: '',
      approved: ''
    };
    return React.createElement("div", {
      style: {
        ...cardBox,
        marginTop: 14
      }
    }, React.createElement("div", {
      style: {
        fontSize: 9.5,
        fontWeight: 700,
        color: 'var(--muted)',
        textTransform: 'uppercase',
        letterSpacing: .4,
        marginBottom: 16
      }
    }, "Authorisation"), React.createElement("div", {
      style: {
        display: 'flex',
        gap: 30
      }
    }, [['Prepared by', sig.prepared], ['Checked by', sig.reviewed], ['Recommended by', sig.recommended], ['Approved by', sig.approved]].map(([role, name]) => React.createElement("div", {
      key: role,
      style: {
        flex: 1,
        minWidth: 0
      }
    }, React.createElement("div", {
      style: {
        borderBottom: '1px solid var(--ink-2)',
        height: 30
      }
    }), React.createElement("div", {
      style: {
        fontSize: 11,
        fontWeight: 700,
        color: 'var(--ink)',
        marginTop: 4
      }
    }, name || ' '), React.createElement("div", {
      style: {
        fontSize: 9.5,
        color: 'var(--muted)',
        textTransform: 'uppercase',
        letterSpacing: .3
      }
    }, role)))));
  })());
}
async function unicoHtmlServerPDF(pageSize, orient, filename) {
  try {
    const root = document.getElementById('pdf-root');
    if (!root || !root.querySelector('.pdf-page,.qc-rpage')) return false;
    let css = '';
    for (const s of Array.from(document.styleSheets)) {
      try {
        const r = s.cssRules;
        for (let i = 0; i < r.length; i++) css += r[i].cssText + '\n';
      } catch (_) {}
    }
    const norm = '@page{size:' + pageSize + ' ' + (orient === 'landscape' ? 'landscape' : 'portrait') + ';margin:0}' + 'html,body{margin:0;padding:0;background:#fff}' + '.pdf-page,.qc-rpage{width:100%!important;min-height:0!important;box-shadow:none!important;margin:0!important;box-sizing:border-box;page-break-after:always;break-after:page}' + '.pdf-page:last-child,.qc-rpage:last-child{page-break-after:auto}';
    const html = '<!doctype html><html><head><meta charset="utf-8"><base href="' + location.origin + '/">' + '<style>' + css + norm + '</style></head><body class="pdf-export-mode qc-pdfcap">' + root.outerHTML + '</body></html>';
    const res = await fetch('/api/report-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        mode: 'html',
        html: html,
        pageSize: pageSize,
        orient: orient
      })
    });
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (res.ok && ct.indexOf('pdf') >= 0) {
      const blob = await res.blob(),
        url = URL.createObjectURL(blob),
        a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        try {
          document.body.removeChild(a);
        } catch (_) {}
        URL.revokeObjectURL(url);
      }, 600);
      return true;
    }
  } catch (e) {
    try {
      console.warn('[html-pdf] failed, falling back:', e);
    } catch (_) {}
  }
  return false;
}
try {
  if (typeof window !== 'undefined') window.unicoHtmlServerPDF = unicoHtmlServerPDF;
} catch (e) {}
function Reports({
  depts
}) {
  const MO = window.UNICO.MONTH_ORDER,
    MF = window.UNICO.MONTHS_FULL;
  const [mode, setMode] = React.useState('builder');
  const RB_KEY = 'unico_report_builder_v1';
  const RB = (() => {
    try {
      const s = JSON.parse(localStorage.getItem(RB_KEY));
      return s && typeof s === 'object' ? s : {};
    } catch (e) {
      return {};
    }
  })();
  const [sel, setSel] = React.useState(() => Array.isArray(RB.sel) && RB.sel.length ? RB.sel.filter(id => depts.some(d => d.id === id)) : depts.slice(0, 4).map(d => d.id));
  const [type, setType] = React.useState(RB.type || 'summary');
  const [period, setPeriod] = React.useState(RB.period && typeof RB.period === 'object' ? RB.period : {
    mode: 'all'
  });
  const [chartStyles, setChartStyles] = React.useState(Array.isArray(RB.chartStyles) && RB.chartStyles.length ? RB.chartStyles : ['bar3d']);
  const toggleStyle = s => setChartStyles(a => a.includes(s) ? a.length > 1 ? a.filter(x => x !== s) : a : [...a, s]);
  const [hdrTitle, setHdrTitle] = React.useState(RB.hdrTitle != null ? RB.hdrTitle : 'Patient Flow Census');
  const [hdrSub, setHdrSub] = React.useState(RB.hdrSub || '');
  const [hospitalName, setHospitalName] = React.useState(RB.hospitalName != null ? RB.hospitalName : 'UNICO HOSPITALS PLC');
  const [showLogo, setShowLogo] = React.useState(RB.showLogo != null ? RB.showLogo : true);
  const [confidential, setConfidential] = React.useState(RB.confidential != null ? RB.confidential : true);
  const [footerNote, setFooterNote] = React.useState(RB.footerNote || '');
  const [pageSize, setPageSize] = React.useState(RB.pageSize || 'A4');
  const [orient, setOrient] = React.useState(RB.orient || 'portrait');
  const [pageIdx, setPageIdx] = React.useState(0);
  const [sig, setSig] = React.useState(() => window.unicoSig ? window.unicoSig.load() : {
    prepared: '',
    reviewed: '',
    recommended: '',
    approved: ''
  });
  React.useEffect(() => {
    if (window.unicoSig) window.unicoSig.save(sig);
  }, [sig]);
  const [showSig, setShowSig] = React.useState(RB.showSig != null ? RB.showSig : true);
  const [showCover, setShowCover] = React.useState(RB.showCover != null ? RB.showCover : true);
  React.useEffect(() => {
    try {
      localStorage.setItem(RB_KEY, JSON.stringify({
        sel,
        type,
        period,
        chartStyles,
        hdrTitle,
        hdrSub,
        hospitalName,
        showLogo,
        confidential,
        footerNote,
        pageSize,
        orient,
        showSig,
        showCover
      }));
    } catch (e) {}
  }, [sel, type, period, chartStyles, hdrTitle, hdrSub, hospitalName, showLogo, confidential, footerNote, pageSize, orient, showSig, showCover]);
  const toggle = id => setSel(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const chosen = depts.filter(d => sel.includes(d.id));
  const allMonths = [...new Set(depts.flatMap(d => d.months))].sort((a, b) => MO.indexOf(a) - MO.indexOf(b));
  const lyy = allMonths.length ? String(allMonths[allMonths.length - 1]).split('-')[1] : String(new Date().getFullYear() % 100);
  const pMonths = (() => {
    if (period.mode === 'q1') return ['Jan-' + lyy, 'Feb-' + lyy, 'Mar-' + lyy];
    if (period.mode === 'apr') return ['Apr-' + lyy];
    if (period.mode === 'last6') return allMonths.slice(-6);
    if (period.mode === 'custom') {
      const fi = allMonths.indexOf(period.from || allMonths[0]),
        ti = allMonths.indexOf(period.to || allMonths[allMonths.length - 1]);
      const a = Math.min(fi, ti),
        b = Math.max(fi, ti);
      return allMonths.slice(a, b + 1);
    }
    return allMonths;
  })();
  const pSet = new Set(pMonths);
  const rangeLabel = pMonths.length ? `${MF[pMonths[0]] || pMonths[0]} – ${MF[pMonths[pMonths.length - 1]] || pMonths[pMonths.length - 1]}` : '—';
  const fseriesOf = d => d.series.filter(r => pSet.has(r.month));
  const statOf = (d, fs) => {
    const total = fs.reduce((s, r) => s + (r[d.primary] || 0), 0);
    const latest = fs[fs.length - 1] || {};
    const peak = fs.length ? Math.max(...fs.map(r => r[d.primary] || 0)) : 0;
    const avg = fs.length ? Math.round(total / fs.length) : 0;
    const lv = fs.length ? fs[fs.length - 1][d.primary] || 0 : 0,
      pv = fs.length > 1 ? fs[fs.length - 2][d.primary] || 0 : 0;
    const delta = fs.length < 2 ? 0 : pv === 0 ? lv > 0 ? 100 : 0 : Math.round((lv - pv) / pv * 100);
    return {
      total,
      latest,
      peak,
      avg,
      delta
    };
  };
  const [base, ratio] = PAGE_SIZES[pageSize];
  const portrait = orient === 'portrait';
  const pageW = portrait ? base : Math.round(base * ratio);
  const pageMinH = portrait ? Math.round(base * ratio) : base;
  const coverOn = showCover && chosen.length > 0;
  const basePages = type === 'compare' || type === 'board' ? 1 : Math.max(1, chosen.length);
  const pages = basePages + (coverOn ? 1 : 0);
  const pi = Math.min(pageIdx, pages - 1);
  const contentIdx = coverOn ? pi - 1 : pi;
  const pageDept = chosen[Math.max(0, contentIdx)] || depts[0];
  const sel2 = {
    padding: '9px 11px',
    border: '1px solid var(--line)',
    borderRadius: 7,
    fontSize: 13,
    fontFamily: 'inherit',
    background: '#fff'
  };
  const fieldLabel = t => React.createElement("div", {
    style: {
      fontSize: 11.5,
      fontWeight: 600,
      color: 'var(--ink-2)',
      marginBottom: 7
    }
  }, t);
  const Header = () => React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      borderBottom: '2px solid var(--blue)',
      paddingBottom: 14
    }
  }, showLogo && React.createElement("img", {
    src: "unico/logo.svg",
    alt: "UNICO Healthcare",
    style: {
      height: 38
    }
  }), React.createElement("div", null, React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 700,
      color: 'var(--ink)'
    }
  }, hdrTitle || 'Report'), React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: 'var(--muted)',
      letterSpacing: .4,
      textTransform: 'uppercase',
      marginTop: 2
    }
  }, hdrSub ? hdrSub + ' · ' : '', rangeLabel)), React.createElement("div", {
    className: "spacer"
  }), React.createElement("div", {
    style: {
      textAlign: 'right',
      fontSize: 10,
      color: 'var(--faint)'
    }
  }, "Generated", React.createElement("br", null), React.createElement("b", {
    className: "num",
    style: {
      color: 'var(--ink-2)'
    }
  }, new Date().toLocaleDateString('en-US'))));
  const Footer = ({
    n,
    total
  }) => React.createElement("div", {
    className: "pdf-foot",
    style: {
      borderTop: '1px solid var(--line)',
      paddingTop: 8,
      fontSize: 9.5,
      color: 'var(--faint)',
      display: 'flex',
      flex: '0 0 auto'
    }
  }, React.createElement("span", null, hospitalName), React.createElement("span", {
    className: "spacer"
  }), React.createElement("span", null, "Page ", n, " of ", total), React.createElement("span", {
    className: "spacer"
  }), React.createElement("span", null, footerNote ? footerNote + ' · ' : '', confidential ? 'Confidential · ' : '', pageSize, " ", orient));
  const SigBlock = () => React.createElement("div", {
    style: {
      marginTop: 26,
      pageBreakInside: 'avoid'
    }
  }, React.createElement("div", {
    style: {
      fontSize: 9.5,
      fontWeight: 700,
      color: 'var(--muted)',
      textTransform: 'uppercase',
      letterSpacing: .4,
      marginBottom: 12
    }
  }, "Authorisation \xB7 ", hospitalName), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 30
    }
  }, [['Prepared by', sig.prepared], ['Checked by', sig.reviewed], ['Recommended by', sig.recommended], ['Approved by', sig.approved]].map(([role, name]) => React.createElement("div", {
    key: role,
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("div", {
    style: {
      borderBottom: '1px solid var(--ink-2)',
      height: 34
    }
  }), React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: 'var(--ink)',
      marginTop: 4
    }
  }, name || ' '), React.createElement("div", {
    style: {
      fontSize: 9.5,
      color: 'var(--muted)',
      textTransform: 'uppercase',
      letterSpacing: .3
    }
  }, role)))));
  function CoverPage({
    n,
    total
  }) {
    const rows = chosen.map(d => {
      const fs = fseriesOf(d);
      const st = statOf(d, fs);
      return {
        d,
        st,
        fs
      };
    });
    const totAll = rows.reduce((s, r) => s + r.st.total, 0);
    const mTot = {};
    rows.forEach(({
      d,
      fs
    }) => fs.forEach(r => {
      mTot[r.month] = (mTot[r.month] || 0) + (r[d.primary] || 0);
    }));
    const peakM = Object.keys(mTot).sort((a, b) => mTot[b] - mTot[a])[0];
    const typeLabel = {
      summary: 'Department Summary Report',
      detail: 'Detailed Statistical Report',
      compare: 'Cross-Department Comparison',
      board: 'Executive Board Report'
    }[type] || 'Statistical Report';
    return React.createElement("div", {
      className: "qc-rpage"
    }, React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '60px 20px 30px',
        flex: '1 0 auto'
      }
    }, showLogo && React.createElement("img", {
      src: "unico/logo.svg",
      alt: "UNICO Healthcare",
      style: {
        height: 66,
        marginBottom: 26
      }
    }), React.createElement("div", {
      style: {
        fontSize: 13,
        fontWeight: 700,
        color: 'var(--blue)',
        textTransform: 'uppercase',
        letterSpacing: 1.5
      }
    }, hospitalName), React.createElement("h1", {
      style: {
        fontSize: 32,
        fontWeight: 700,
        color: 'var(--ink)',
        margin: '14px 0 6px',
        letterSpacing: '-.5px'
      }
    }, hdrTitle || 'Patient Statistics Report'), React.createElement("div", {
      style: {
        fontSize: 13,
        color: 'var(--muted)'
      }
    }, hdrSub ? hdrSub + ' · ' : '', typeLabel), React.createElement("div", {
      style: {
        fontSize: 14,
        color: 'var(--ink-2)',
        marginTop: 10,
        fontWeight: 600
      }
    }, rangeLabel), React.createElement("div", {
      style: {
        display: 'flex',
        gap: 26,
        marginTop: 34,
        flexWrap: 'wrap',
        justifyContent: 'center'
      }
    }, [['Departments', String(chosen.length), PALETTE[0]], ['Total patients', fmt(totAll), PALETTE[1]], ['Peak month', peakM ? peakM.split('-')[0] + ' 20' + peakM.split('-')[1] : '—', PALETTE[2]], ['Months covered', String(pMonths.length), PALETTE[3]]].map(c => React.createElement("div", {
      key: c[0],
      style: {
        textAlign: 'center'
      }
    }, React.createElement("div", {
      className: "num",
      style: {
        fontSize: 26,
        fontWeight: 700,
        color: c[2]
      }
    }, c[1]), React.createElement("div", {
      style: {
        fontSize: 9.5,
        color: 'var(--muted)',
        textTransform: 'uppercase',
        letterSpacing: .4,
        marginTop: 2
      }
    }, c[0])))), confidential && React.createElement("div", {
      style: {
        marginTop: 34,
        fontSize: 10.5,
        color: 'var(--rose)',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: 1,
        border: '1px solid #f1c6cd',
        borderRadius: 6,
        padding: '6px 14px'
      }
    }, "Confidential \u2014 for authorised recipients only"), React.createElement("div", {
      style: {
        fontSize: 10,
        color: 'var(--faint)',
        marginTop: 20
      }
    }, "Generated ", new Date().toLocaleDateString('en-US')), showSig && (sig.prepared || sig.reviewed || sig.recommended || sig.approved) && React.createElement("div", {
      style: {
        width: '100%',
        maxWidth: 600,
        textAlign: 'left'
      }
    }, React.createElement(SigBlock, null))), React.createElement(Footer, {
      n: n,
      total: total
    }));
  }
  function DeptPage({
    d,
    n,
    total
  }) {
    const tone = PALETTE[d.id.charCodeAt(0) % PALETTE.length];
    const fs = fseriesOf(d);
    const st = statOf(d, rptChartRows(d, fs));
    const compGroups = compositionGroups(d, fs);
    const detailed = type === 'detail';
    const ncol = d.cols.length + 1;
    const tblFont = ncol > 10 ? 8 : ncol > 8 ? 8.5 : ncol > 6 ? 9.5 : detailed ? 10.5 : 11;
    const partial = fs.length > 0 && fs.length < pMonths.length;
    if (fs.length === 0) {
      return React.createElement("div", {
        className: "qc-rpage"
      }, React.createElement(Header, null), React.createElement("div", {
        style: {
          marginTop: 18
        }
      }, React.createElement("div", {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          marginBottom: 12
        }
      }, React.createElement(Ic, {
        d: DEPT_ICON[d.id] || I.activity,
        s: 18,
        c: tone
      }), React.createElement("div", {
        style: {
          fontWeight: 700,
          fontSize: 15
        }
      }, d.name), React.createElement("span", {
        className: "tag"
      }, d.group)), React.createElement("div", {
        style: {
          border: '1px dashed var(--line)',
          borderRadius: 10,
          padding: '38px 20px',
          textAlign: 'center',
          color: 'var(--muted)',
          fontSize: 12.5
        }
      }, "No data reported for ", d.name, " in the selected period (", rangeLabel, ").")), React.createElement(Footer, {
        n: n,
        total: total
      }));
    }
    return React.createElement("div", {
      className: "qc-rpage"
    }, React.createElement(Header, null), React.createElement("div", {
      style: {
        marginTop: 18
      }
    }, React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        marginBottom: 12
      }
    }, React.createElement(Ic, {
      d: DEPT_ICON[d.id] || I.activity,
      s: 18,
      c: tone
    }), React.createElement("div", {
      style: {
        fontWeight: 700,
        fontSize: 15
      }
    }, d.name), React.createElement("span", {
      className: "tag"
    }, d.group), React.createElement("span", {
      className: "spacer"
    }), React.createElement(Delta, {
      v: st.delta
    })), partial && React.createElement("div", {
      style: {
        fontSize: 10,
        color: 'var(--muted)',
        background: 'var(--panel-2)',
        borderRadius: 6,
        padding: '5px 10px',
        marginBottom: 10
      }
    }, "Reported data covers ", React.createElement("b", null, fs[0].full, " \u2013 ", fs[fs.length - 1].full), " (", fs.length, " of the ", pMonths.length, " months in the selected period); months without a report are not plotted."), React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4,1fr)',
        gap: 10,
        marginBottom: 16
      }
    }, [[st.latest.full || 'Latest', fmt(st.latest[d.primary] || 0)], ['Total', fmt(st.total)], ['Peak', fmt(st.peak)], ['Average', fmt(st.avg)]].map(([l, v], i) => React.createElement("div", {
      key: i,
      style: {
        background: 'var(--panel-2)',
        borderRadius: 7,
        padding: '9px 11px',
        borderLeft: '3px solid ' + tone
      }
    }, React.createElement("div", {
      style: {
        fontSize: 9.5,
        color: 'var(--muted)',
        textTransform: 'uppercase',
        letterSpacing: .3
      }
    }, l), React.createElement("div", {
      className: "num",
      style: {
        fontSize: 18,
        fontWeight: 600
      }
    }, v)))), chartStyles.map((cs, ci) => React.createElement("div", {
      key: ci,
      style: {
        margin: '4px 0 8px'
      }
    }, chartStyles.length > 1 && React.createElement("div", {
      style: {
        fontSize: 9.5,
        fontWeight: 700,
        color: 'var(--muted)',
        textTransform: 'uppercase',
        letterSpacing: .4,
        margin: '8px 0 2px'
      }
    }, CHART_STYLE_LABEL[cs] || cs), reportChartEl(d, cs, tone, rptChartRows(d, fs), compGroups))), !chartStyles.includes('donut') && compGroups.map((g, gi) => React.createElement("div", {
      key: gi,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: 'var(--panel-2)',
        borderRadius: 9,
        padding: '10px 14px',
        marginTop: 6
      }
    }, React.createElement("div", {
      style: {
        fontSize: 10.5,
        color: 'var(--muted)',
        textTransform: 'uppercase',
        letterSpacing: .3,
        fontWeight: 600,
        width: 78
      }
    }, g.title), React.createElement(Donut, {
      data: g.data,
      size: 104,
      thickness: 20,
      flat: true
    }))), React.createElement("table", {
      className: detailed || ncol > 7 ? 'tbl rpt' : 'tbl',
      style: {
        marginTop: 14,
        fontSize: tblFont
      }
    }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Month"), d.cols.map(c => React.createElement("th", {
      key: c.id
    }, c.label)))), React.createElement("tbody", null, fs.map((r, i) => React.createElement("tr", {
      key: i
    }, React.createElement("td", null, detailed ? r.month : r.full), d.cols.map(c => React.createElement("td", {
      key: c.id
    }, r[c.id] == null ? '–' : c.pct ? r[c.id] + '%' : fmt(r[c.id]))))), detailed && React.createElement("tr", {
      className: "tot"
    }, React.createElement("td", null, "TOTAL"), d.cols.map(c => React.createElement("td", {
      key: c.id
    }, c.pct ? '—' : fmt(fs.reduce((s, r) => s + (r[c.id] || 0), 0)))))))), React.createElement(Footer, {
      n: n,
      total: total
    }));
  }
  function ComparePage({
    n = 1,
    total = 1
  }) {
    const rows = chosen.map(d => {
      const fs = fseriesOf(d);
      const st = statOf(d, fs);
      return {
        d,
        st
      };
    });
    const hbar = rows.map(({
      d,
      st
    }) => ({
      label: d.short,
      value: st.total,
      color: PALETTE[d.id.charCodeAt(0) % PALETTE.length]
    })).sort((a, b) => b.value - a.value);
    return React.createElement("div", {
      className: "qc-rpage"
    }, React.createElement(Header, null), React.createElement("div", {
      style: {
        marginTop: 18
      }
    }, React.createElement("div", {
      style: {
        fontWeight: 700,
        fontSize: 15,
        marginBottom: 12
      }
    }, "Cross-department comparison \xB7 ", chosen.length, " departments"), React.createElement("div", {
      style: {
        marginBottom: 16
      }
    }, React.createElement(HBar, {
      rows: hbar
    })), React.createElement("table", {
      className: "tbl",
      style: {
        fontSize: 11.5
      }
    }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Department"), React.createElement("th", null, "Service line"), React.createElement("th", null, "Latest"), React.createElement("th", null, "Total"), React.createElement("th", null, "Peak"), React.createElement("th", null, "Avg"), React.createElement("th", null, "Trend"))), React.createElement("tbody", null, rows.map(({
      d,
      st
    }) => React.createElement("tr", {
      key: d.id
    }, React.createElement("td", null, d.name), React.createElement("td", {
      style: {
        fontFamily: "'IBM Plex Sans'"
      }
    }, d.group), React.createElement("td", null, fmt(st.latest[d.primary] || 0)), React.createElement("td", null, fmt(st.total)), React.createElement("td", null, fmt(st.peak)), React.createElement("td", null, fmt(st.avg)), React.createElement("td", {
      style: {
        textAlign: 'right'
      }
    }, React.createElement(Delta, {
      v: st.delta
    }))))))), React.createElement(Footer, {
      n: n,
      total: total
    }));
  }
  function BoardPage({
    n = 1,
    total = 1
  }) {
    const rows = chosen.map(d => {
      const fs = fseriesOf(d);
      const st = statOf(d, fs);
      return {
        d,
        st,
        fs
      };
    });
    const totAll = rows.reduce((s, r) => s + r.st.total, 0);
    const top = rows.slice().sort((a, b) => b.st.total - a.st.total)[0];
    const mTot = {};
    rows.forEach(({
      d,
      fs
    }) => fs.forEach(r => {
      mTot[r.month] = (mTot[r.month] || 0) + (r[d.primary] || 0);
    }));
    const trend = pMonths.filter(m => mTot[m] != null).map(m => ({
      label: m.split('-')[0],
      val: mTot[m]
    }));
    const peakM = trend.slice().sort((a, b) => b.val - a.val)[0];
    const hbar = rows.map(({
      d,
      st
    }) => ({
      label: d.short,
      value: st.total,
      color: PALETTE[d.id.charCodeAt(0) % PALETTE.length]
    })).sort((a, b) => b.value - a.value);
    const kpis = [['Total patients', fmt(totAll)], ['Departments', String(rows.length)], ['Busiest dept', top ? top.d.short : '—'], ['Peak month', peakM ? peakM.label : '—']];
    return React.createElement("div", {
      className: "qc-rpage"
    }, React.createElement(Header, null), React.createElement("div", {
      style: {
        marginTop: 18
      }
    }, React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        marginBottom: 12
      }
    }, React.createElement(Ic, {
      d: I.doc,
      s: 18,
      c: PALETTE[0]
    }), React.createElement("div", {
      style: {
        fontWeight: 700,
        fontSize: 15
      }
    }, "Executive Board Report"), React.createElement("span", {
      className: "tag"
    }, rangeLabel), React.createElement("span", {
      className: "spacer"
    }), React.createElement("span", {
      className: "tag"
    }, rows.length, " departments")), React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4,1fr)',
        gap: 10,
        marginBottom: 16
      }
    }, kpis.map(([l, v], i) => React.createElement("div", {
      key: i,
      style: {
        background: 'var(--panel-2)',
        borderRadius: 7,
        padding: '9px 11px',
        borderLeft: '3px solid ' + PALETTE[i % PALETTE.length]
      }
    }, React.createElement("div", {
      style: {
        fontSize: 9.5,
        color: 'var(--muted)',
        textTransform: 'uppercase',
        letterSpacing: .3
      }
    }, l), React.createElement("div", {
      className: "num",
      style: {
        fontSize: 18,
        fontWeight: 600
      }
    }, v)))), trend.length > 1 && typeof window.BarChart === 'function' && React.createElement("div", {
      style: {
        margin: '4px 0 12px'
      }
    }, React.createElement("div", {
      style: {
        fontSize: 9.5,
        fontWeight: 700,
        color: 'var(--muted)',
        textTransform: 'uppercase',
        letterSpacing: .4,
        margin: '8px 0 2px'
      }
    }, "Hospital volume \u2014 monthly trend"), window.BarChart({
      data: trend,
      x: 'label',
      y: 'val',
      height: 170,
      color: PALETTE[0],
      flat: true
    })), React.createElement("div", {
      style: {
        fontSize: 9.5,
        fontWeight: 700,
        color: 'var(--muted)',
        textTransform: 'uppercase',
        letterSpacing: .4,
        margin: '8px 0 6px'
      }
    }, "Department ranking (period total)"), React.createElement("div", {
      style: {
        marginBottom: 14
      }
    }, React.createElement(HBar, {
      rows: hbar
    })), React.createElement("table", {
      className: "tbl",
      style: {
        fontSize: 11
      }
    }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Department"), React.createElement("th", null, "Service line"), React.createElement("th", null, "Total"), React.createElement("th", null, "Share"), React.createElement("th", null, "Avg / month"), React.createElement("th", null, "Trend"))), React.createElement("tbody", null, rows.slice().sort((a, b) => b.st.total - a.st.total).map(({
      d,
      st
    }) => React.createElement("tr", {
      key: d.id
    }, React.createElement("td", null, d.name), React.createElement("td", {
      style: {
        fontFamily: "'IBM Plex Sans'"
      }
    }, d.group), React.createElement("td", null, fmt(st.total)), React.createElement("td", null, totAll ? Math.round(st.total * 100 / totAll) + '%' : '—'), React.createElement("td", null, fmt(st.avg)), React.createElement("td", {
      style: {
        textAlign: 'right'
      }
    }, React.createElement(Delta, {
      v: st.delta
    }))))))), React.createElement(Footer, {
      n: n,
      total: total
    }));
  }
  const [exporting, setExporting] = React.useState(false);
  const [note, setNote] = React.useState(null);
  const buildVectorPDF = async J => {
    const hx = h => {
      const m = /^#?([0-9a-f]{6})$/i.exec(String(h || ''));
      const n = m ? parseInt(m[1], 16) : 0x16202e;
      return [n >> 16 & 255, n >> 8 & 255, n & 255];
    };
    const C = {
      ink: hx('#16202e'),
      ink2: hx('#3c4858'),
      muted: hx('#6c7a8c'),
      faint: hx('#9aa6b4'),
      line: hx('#dde3ec'),
      line2: hx('#e8edf3'),
      panel2: hx('#f7f9fc'),
      grid: hx('#eef1f5'),
      grid3: hx('#e9edf3'),
      blue: hx('#0090ca'),
      blue700: hx('#0072a3'),
      blue50: hx('#eef8fc'),
      rose: hx('#d23a52'),
      roseLine: hx('#f1c6cd'),
      pos: hx('#1f9d57'),
      posBg: hx('#e7f6ed'),
      negBg: hx('#fbe9ec'),
      slate: hx('#5b6b80'),
      flatBg: hx('#eef1f5'),
      white: [255, 255, 255]
    };
    const PALV = PALETTE.map(hx);
    const BARC = ['#0090ca', '#159fbf', '#2bb3a3', '#46b87e', '#7cc35a', '#f0a93b', '#ef8049', '#e85c69', '#b65cc6', '#6a6fd4'].map(hx);
    const PAL3 = ['#0090ca', '#159fbf', '#2bb3a3', '#46b87e', '#7cc35a', '#f0a93b', '#ef8049', '#e85c69', '#e0679b', '#b65cc6', '#6a6fd4', '#4f8df7'].map(hx);
    const lift = (c, p) => c.map(v => Math.max(0, Math.min(255, v + p)));
    const mixW = (c, a) => c.map(v => Math.round(v * a + 255 * (1 - a)));
    const ori = orient === 'landscape' ? 'l' : 'p';
    const fmtP = pageSize === 'A3' ? 'a3' : pageSize === 'Letter' ? 'letter' : 'a4';
    const doc = new J({
      orientation: ori,
      unit: 'pt',
      format: fmtP,
      compress: true
    });
    const PW = doc.internal.pageSize.getWidth();
    const S = PW / pageW,
      X = v => v * S;
    const MX = 30,
      MT = 28,
      CWx = pageW - 60;
    const FOOTY = pageMinH - MT - 21;
    const LIMIT = FOOTY - 12;
    const genDate = new Date().toLocaleDateString('en-US');
    const font = (style, size, color) => {
      doc.setFont('helvetica', style);
      doc.setFontSize(size * S);
      const c = color || C.ink;
      doc.setTextColor(c[0], c[1], c[2]);
    };
    const T = (t, x, y, o) => doc.text(String(t), X(x), X(y), o);
    const tw = t => doc.getTextWidth(String(t)) / S;
    const LN = (x1, y1, x2, y2, c, w2) => {
      const cc = c || C.line;
      doc.setDrawColor(cc[0], cc[1], cc[2]);
      doc.setLineWidth((w2 == null ? 1 : w2) * S);
      doc.line(X(x1), X(y1), X(x2), X(y2));
    };
    const FR = (x, y, w2, h2, c, rx, ry) => {
      doc.setFillColor(c[0], c[1], c[2]);
      if (rx) doc.roundedRect(X(x), X(y), X(w2), X(h2), X(rx), X(ry == null ? rx : ry), 'F');else doc.rect(X(x), X(y), X(w2), X(h2), 'F');
    };
    const TRI = (x1, y1, x2, y2, x3, y3, c) => {
      doc.setFillColor(c[0], c[1], c[2]);
      doc.triangle(X(x1), X(y1), X(x2), X(y2), X(x3), X(y3), 'F');
    };
    const CIRC = (x, y, r, fill, stroke, lw) => {
      if (fill) doc.setFillColor(fill[0], fill[1], fill[2]);
      if (stroke) {
        doc.setDrawColor(stroke[0], stroke[1], stroke[2]);
        doc.setLineWidth((lw || 1) * S);
      }
      doc.circle(X(x), X(y), X(r), fill && stroke ? 'FD' : fill ? 'F' : 'S');
    };
    const POLY = (pts, c) => {
      if (pts.length < 3) return;
      doc.setFillColor(c[0], c[1], c[2]);
      doc.lines(pts.slice(1).map((p, i) => [p[0] - pts[i][0], p[1] - pts[i][1]]), X(pts[0][0]), X(pts[0][1]), [S, S], 'F', true);
    };
    const PLINE = (pts, c, lw) => {
      if (pts.length < 2) return;
      doc.setDrawColor(c[0], c[1], c[2]);
      doc.setLineWidth((lw || 2) * S);
      try {
        doc.setLineCap('round');
        doc.setLineJoin('round');
      } catch (e) {}
      doc.lines(pts.slice(1).map((p, i) => [p[0] - pts[i][0], p[1] - pts[i][1]]), X(pts[0][0]), X(pts[0][1]), [S, S], 'S', false);
    };
    const clip = (s, w2) => {
      s = String(s == null ? '–' : s);
      if (tw(s) <= w2) return s;
      while (s.length > 1 && tw(s + '…') > w2) s = s.slice(0, -1);
      return s + '…';
    };
    const wedge = (cx, cy, rO, rI, a0, a1, c) => {
      if (a1 - a0 >= Math.PI * 2 - 1e-4) a1 = a0 + Math.PI * 2 - 1e-4;
      const pt = (r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
      const arc = (r, s0, e0) => {
        const out = [];
        const n = Math.max(1, Math.ceil(Math.abs(e0 - s0) / (Math.PI / 3)));
        for (let i = 0; i < n; i++) {
          const u = s0 + (e0 - s0) * i / n,
            v2 = s0 + (e0 - s0) * (i + 1) / n,
            k = 4 / 3 * Math.tan((v2 - u) / 4) * r;
          out.push([[cx + r * Math.cos(u) - k * Math.sin(u), cy + r * Math.sin(u) + k * Math.cos(u)], [cx + r * Math.cos(v2) + k * Math.sin(v2), cy + r * Math.sin(v2) - k * Math.cos(v2)], pt(r, v2)]);
        }
        return out;
      };
      const start = pt(rO, a0);
      let cur = start;
      const segs = [];
      arc(rO, a0, a1).forEach(([c1, c2, p]) => {
        segs.push([c1[0] - cur[0], c1[1] - cur[1], c2[0] - cur[0], c2[1] - cur[1], p[0] - cur[0], p[1] - cur[1]]);
        cur = p;
      });
      const q = pt(rI, a1);
      segs.push([q[0] - cur[0], q[1] - cur[1]]);
      cur = q;
      arc(rI, a1, a0).forEach(([c1, c2, p]) => {
        segs.push([c1[0] - cur[0], c1[1] - cur[1], c2[0] - cur[0], c2[1] - cur[1], p[0] - cur[0], p[1] - cur[1]]);
        cur = p;
      });
      doc.setFillColor(c[0], c[1], c[2]);
      doc.lines(segs, X(start[0]), X(start[1]), [S, S], 'F', true);
    };
    const logo = showLogo ? await new Promise(res => {
      try {
        const img = new Image();
        img.onload = () => {
          try {
            const c = document.createElement('canvas');
            const s3 = 3;
            c.width = (img.width || 120) * s3;
            c.height = (img.height || 40) * s3;
            c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
            res({
              d: c.toDataURL('image/png'),
              w: c.width / s3,
              h: c.height / s3
            });
          } catch (e) {
            res(null);
          }
        };
        img.onerror = () => res(null);
        img.src = 'unico/logo.svg';
        setTimeout(() => res(null), 2500);
      } catch (e) {
        res(null);
      }
    }) : null;
    const drawLogo = (x, y, h2) => {
      if (!logo) return 0;
      const w2 = h2 * (logo.w / logo.h);
      try {
        doc.addImage(logo.d, 'PNG', X(x), X(y), X(w2), X(h2));
      } catch (e) {}
      return w2;
    };
    const iconPng = (d, hex) => {
      try {
        const c = document.createElement('canvas');
        c.width = c.height = 72;
        const g = c.getContext('2d');
        g.scale(3, 3);
        g.strokeStyle = hex;
        g.lineWidth = 1.9;
        g.lineCap = 'round';
        g.lineJoin = 'round';
        String(d).split('M').filter(Boolean).forEach(seg => g.stroke(new Path2D('M' + seg)));
        return c.toDataURL('image/png');
      } catch (e) {
        return null;
      }
    };
    const drawIcon = (d, x, y, s3, hex) => {
      const p = iconPng(d, hex);
      if (p) try {
        doc.addImage(p, 'PNG', X(x), X(y), X(s3), X(s3));
      } catch (e) {}
    };
    const tagChip = (x, y, txt) => {
      font('bold', 10.5, C.blue700);
      const t2 = String(txt || '').toUpperCase();
      const w2 = tw(t2) + 16;
      FR(x, y, w2, 17, C.blue50, 5);
      T(t2, x + 8, y + 12);
      return w2;
    };
    const deltaChip = (xr, y, v) => {
      const pos = v > 0,
        neg = v < 0;
      const fg = pos ? C.pos : neg ? C.rose : C.slate,
        bg = pos ? C.posBg : neg ? C.negBg : C.flatBg;
      font('bold', 11, fg);
      const t2 = Math.abs(v || 0) + '%';
      const w2 = 9 + tw(t2) + 16;
      FR(xr - w2, y, w2, 18, bg, 9);
      const ax = xr - w2 + 7,
        ay = y + 6.5;
      if (pos) TRI(ax, ay + 5, ax + 3, ay, ax + 6, ay + 5, fg);else if (neg) TRI(ax, ay, ax + 6, ay, ax + 3, ay + 5, fg);else FR(ax, ay + 2, 6, 1.6, fg);
      T(t2, ax + 9, y + 13);
      return w2;
    };
    const richText = (segs, x, y, maxW, fs2, lh, color) => {
      let cx2 = x,
        cy2 = y;
      segs.forEach(([t2, b]) => {
        String(t2).split(/(\s+)/).forEach(wd => {
          if (!wd) return;
          font(b ? 'bold' : 'normal', fs2, color);
          const w2 = tw(wd);
          if (cx2 + w2 > x + maxW && wd.trim()) {
            cx2 = x;
            cy2 += lh;
          }
          if (!(!wd.trim() && cx2 === x)) {
            T(wd, cx2, cy2);
            cx2 += w2;
          }
        });
      });
      return cy2;
    };
    const pageHeader = () => {
      let x = MX;
      if (logo) {
        const w2 = drawLogo(MX, MT, 38);
        x = MX + w2 + 12;
      }
      font('bold', 14);
      T(hdrTitle || 'Report', x, MT + 16);
      font('normal', 10.5, C.muted);
      doc.text(((hdrSub ? hdrSub + ' · ' : '') + rangeLabel).toUpperCase(), X(x), X(MT + 30), {
        charSpace: 0.4 * S
      });
      font('normal', 10, C.faint);
      T('Generated', pageW - MX, MT + 12, {
        align: 'right'
      });
      font('bold', 10, C.ink2);
      T(genDate, pageW - MX, MT + 25, {
        align: 'right'
      });
      LN(MX, MT + 52, pageW - MX, MT + 52, C.blue, 2);
      return MT + 52 + 18;
    };
    const newPage = () => {
      doc.addPage(fmtP, ori);
      return pageHeader();
    };
    const kpiRow = (y, items) => {
      const gap = 10,
        w2 = (CWx - gap * (items.length - 1)) / items.length;
      items.forEach((it, i) => {
        const x = MX + i * (w2 + gap);
        FR(x, y, w2, 56, C.panel2, 7);
        FR(x, y, 3, 56, it.tone, 1.5);
        font('normal', 9.5, C.muted);
        doc.text(String(it.label).toUpperCase(), X(x + 14), X(y + 19), {
          charSpace: 0.3 * S
        });
        font('bold', 18, C.ink);
        T(it.value, x + 14, y + 41);
      });
      return y + 56 + 16;
    };
    const monthLbl = s => String(s).replace(/ \d{4}| 20\d\d/, '').slice(0, 6);
    const gridLines = (ox, rw, y0, hgt) => {
      [0, .25, .5, .75, 1].forEach(g => LN(ox, y0 + hgt - 20 - g * (hgt - 44), ox + rw, y0 + hgt - 20 - g * (hgt - 44), C.grid, 1));
    };
    const vBar3D = (y0, data, xKey, yKey, hgt) => {
      const n = Math.max(1, data.length),
        dx = 13,
        dy = -9;
      const step = Math.max(46, Math.min(78, 640 / n)),
        Wv = n * step + dx + 10,
        baseY = hgt - 26,
        bw = Math.min(30, step - 22);
      const max = Math.max(1, ...data.map(d => d[yKey] || 0));
      const s3 = Math.min(CWx / Wv, 1),
        ox = MX + (CWx - Wv * s3) / 2,
        oy = y0 + (hgt - hgt * s3) / 2;
      const gx = v => ox + v * s3,
        gy = v => oy + v * s3;
      [0, .25, .5, .75, 1].forEach(g => {
        const gyv = baseY - g * (hgt - 58);
        LN(gx(0), gy(gyv), gx(n * step), gy(gyv), C.grid3, s3);
        LN(gx(n * step), gy(gyv), gx(n * step + dx), gy(gyv + dy), C.grid, s3);
      });
      data.forEach((d, i) => {
        const v = d[yKey] || 0,
          bh = v > 0 ? v / max * (hgt - 58) : 2,
          bx = i * step + 12,
          by = baseY - bh,
          c = PAL3[i % PAL3.length];
        TRI(gx(bx + bw), gy(by), gx(bx + bw + dx), gy(by + dy), gx(bx + bw + dx), gy(baseY + dy), lift(c, -44));
        TRI(gx(bx + bw), gy(by), gx(bx + bw + dx), gy(baseY + dy), gx(bx + bw), gy(baseY), lift(c, -44));
        TRI(gx(bx), gy(by), gx(bx + dx), gy(by + dy), gx(bx + bw + dx), gy(by + dy), lift(c, 46));
        TRI(gx(bx), gy(by), gx(bx + bw + dx), gy(by + dy), gx(bx + bw), gy(by), lift(c, 46));
        doc.setFillColor(c[0], c[1], c[2]);
        const st3 = lift(c, -18);
        doc.setDrawColor(st3[0], st3[1], st3[2]);
        doc.setLineWidth(0.5 * S * s3);
        doc.rect(X(gx(bx)), X(gy(by)), X(bw * s3), X(Math.max(bh, 0.1) * s3), 'FD');
        font('bold', 11 * s3, C.ink);
        T(fmt(v), gx(bx + bw / 2 + dx / 2), gy(by + dy - 6), {
          align: 'center'
        });
        font('normal', 9.5 * s3, C.faint);
        T(monthLbl(d[xKey]), gx(bx + bw / 2), gy(hgt - 6), {
          align: 'center'
        });
      });
      return y0 + hgt;
    };
    const vBarFlat = (y0, data, xKey, yKey, hgt) => {
      const n = Math.max(1, data.length),
        rw = Math.min(CWx, n * 74),
        sx = rw / (n * 54),
        ox = MX + (CWx - rw) / 2;
      const max = Math.max(1, ...data.map(d => d[yKey] || 0));
      gridLines(ox, rw, y0, hgt);
      data.forEach((d, i) => {
        const v = d[yKey] || 0,
          bh = v / max * (hgt - 44),
          c = BARC[i % BARC.length];
        const bx = ox + (i * 54 + 14) * sx,
          bwv = 26 * sx,
          by = y0 + hgt - 20 - bh;
        doc.setFillColor(c[0], c[1], c[2]);
        doc.roundedRect(X(bx), X(by), X(bwv), X(Math.max(bh, 0.1)), X(Math.min(4, bwv / 2)), X(Math.min(4, Math.max(bh, 0.1) / 2)), 'F');
        if (v > 0) {
          font('bold', 10.5, c);
          T(fmt(v), bx + bwv / 2, by - 6, {
            align: 'center'
          });
        }
        font('normal', 9.5, C.faint);
        T(monthLbl(d[xKey]), bx + bwv / 2, y0 + hgt - 6, {
          align: 'center'
        });
      });
      return y0 + hgt;
    };
    const vLine = (y0, data, xKey, yKey, tone, hgt) => {
      const n = data.length;
      if (!n) {
        font('normal', 11, C.faint);
        T('No data', pageW / 2, y0 + hgt / 2, {
          align: 'center'
        });
        return y0 + hgt;
      }
      const viewW = Math.max(360, n * 60),
        rw = Math.min(CWx, Math.max(140, n * 80)),
        sx = rw / viewW,
        ox = MX + (CWx - rw) / 2;
      const max = Math.max(1, ...data.map(d => d[yKey] || 0));
      const px2 = i => ox + (26 + (n <= 1 ? (viewW - 52) / 2 : i / (n - 1) * (viewW - 52))) * sx;
      const py2 = v => y0 + hgt - 22 - v / max * (hgt - 44);
      [0, .25, .5, .75, 1].forEach(g => LN(ox + 26 * sx, y0 + 22 + g * (hgt - 44), ox + (viewW - 26) * sx, y0 + 22 + g * (hgt - 44), C.grid, 1));
      const pts = data.map((d, i) => [px2(i), py2(d[yKey] || 0)]);
      if (n > 1) {
        POLY(pts.concat([[pts[n - 1][0], y0 + hgt - 22], [pts[0][0], y0 + hgt - 22]]), mixW(tone, 0.12));
        PLINE(pts, tone, 2.5);
      }
      pts.forEach(p => CIRC(p[0], p[1], 3.2, C.white, tone, 2.5));
      return y0 + hgt;
    };
    const vArea = (y0, data, xKey, yKey, tone, target, hgt) => {
      const n = Math.max(1, data.length);
      const viewW = Math.max(320, n * 60),
        rw = Math.min(CWx, Math.max(160, n * 80)),
        sx = rw / viewW,
        ox = MX + (CWx - rw) / 2;
      const pad = 30,
        padT = 18,
        plotH = hgt - 42;
      const max = Math.max(1, ...data.map(d => +d[yKey] || 0), target != null ? target : 0);
      const px2 = i => ox + (pad + (n <= 1 ? (viewW - 60) / 2 : i / (n - 1) * (viewW - 60))) * sx;
      const py2 = v => y0 + padT + plotH - v / max * plotH;
      [0, .25, .5, .75, 1].forEach(g => {
        LN(ox + pad * sx, y0 + padT + g * plotH, ox + (viewW - pad) * sx, y0 + padT + g * plotH, C.grid, 1);
        font('normal', 9, C.faint);
        T(fmt(Math.round(max * (1 - g))), ox + (pad - 6) * sx, y0 + padT + g * plotH + 3, {
          align: 'right'
        });
      });
      const pts = data.map((d, i) => [px2(i), py2(+d[yKey] || 0)]);
      if (pts.length > 1) {
        POLY(pts.concat([[pts[pts.length - 1][0], y0 + padT + plotH], [pts[0][0], y0 + padT + plotH]]), mixW(tone, 0.12));
        PLINE(pts, tone, 2.5);
      }
      if (target != null) {
        try {
          doc.setLineDashPattern([5 * S, 4 * S], 0);
        } catch (e) {}
        LN(ox + pad * sx, py2(target), ox + (viewW - pad) * sx, py2(target), C.rose, 1.5);
        try {
          doc.setLineDashPattern([], 0);
        } catch (e) {}
        font('bold', 10, C.rose);
        T('target ' + fmt(target), ox + (viewW - pad) * sx, py2(target) - 4, {
          align: 'right'
        });
      }
      pts.forEach(p => CIRC(p[0], p[1], 3.2, C.white, tone, 2.5));
      data.forEach((d, i) => {
        font('normal', 9.5, C.faint);
        T(monthLbl(d[xKey]), px2(i), y0 + hgt - 6, {
          align: 'center'
        });
      });
      return y0 + hgt;
    };
    const vCombo = (y0, data, xKey, barKey, lineKey, barC, lineC, barLabel, lineLabel, hgt) => {
      const n = Math.max(1, data.length);
      font('normal', 11.5, C.ink2);
      const t1 = String(barLabel || barKey),
        t2 = String(lineLabel || lineKey);
      const lw2 = 11 + 6 + tw(t1) + 18 + 14 + 6 + tw(t2);
      let lx = MX + Math.max(0, (CWx - lw2) / 2);
      FR(lx, y0 + 2, 11, 11, barC, 3);
      T(t1, lx + 17, y0 + 12);
      lx += 11 + 6 + tw(t1) + 18;
      FR(lx, y0 + 6, 14, 3, lineC, 1.5);
      T(t2, lx + 20, y0 + 12);
      y0 += 21;
      const isPct = /pct|percent|rate/.test(String(lineKey).toLowerCase());
      const padL = 42,
        padR = 46,
        padT = 22,
        plotH = hgt - 46;
      const step = Math.max(46, Math.min(82, 560 / n)),
        viewW = Math.max(320, n * step + padL + padR);
      const rw = Math.min(CWx, Math.max(260, n * step + padL + padR)),
        sx = rw / viewW,
        ox = MX + (CWx - rw) / 2;
      const plotW = viewW - padL - padR,
        baseY = y0 + padT + plotH;
      const barMax = Math.max(1, ...data.map(d => +d[barKey] || 0));
      const lineMax = Math.max(isPct ? 100 : 1, ...data.map(d => +d[lineKey] || 0));
      const cx2 = i => ox + (padL + (n <= 1 ? plotW / 2 : (i + 0.5) * plotW / n)) * sx;
      const lpy = v => y0 + padT + plotH - v / lineMax * plotH;
      [0, .25, .5, .75, 1].forEach(g => {
        const yy = baseY - g * plotH;
        LN(ox + padL * sx, yy, ox + (viewW - padR) * sx, yy, C.grid, 1);
        font('normal', 9, C.faint);
        T(fmt(Math.round(barMax * g)), ox + (padL - 6) * sx, yy + 3, {
          align: 'right'
        });
        font('normal', 9, lineC);
        T(isPct ? Math.round(lineMax * g) + '%' : fmt(Math.round(lineMax * g)), ox + (viewW - padR + 6) * sx, yy + 3);
      });
      const bw = Math.min(28, plotW / n * 0.5) * sx;
      data.forEach((d, i) => {
        const v = +d[barKey] || 0,
          bh = v / barMax * plotH;
        doc.setFillColor(barC[0], barC[1], barC[2]);
        doc.roundedRect(X(cx2(i) - bw / 2), X(baseY - bh), X(bw), X(Math.max(bh, 0.1)), X(Math.min(4, bw / 2)), X(Math.min(4, Math.max(bh, 0.1) / 2)), 'F');
        if (v > 0) {
          font('bold', 9.5, barC);
          T(fmt(v), cx2(i), baseY - bh - 5, {
            align: 'center'
          });
        }
        font('normal', 9.5, C.faint);
        T(monthLbl(d[xKey]), cx2(i), y0 + hgt - 6, {
          align: 'center'
        });
      });
      const pts = data.map((d, i) => [cx2(i), lpy(+d[lineKey] || 0)]);
      PLINE(pts, lineC, 2.5);
      pts.forEach(p => CIRC(p[0], p[1], 3.4, C.white, lineC, 2.5));
      return y0 + hgt;
    };
    const vGrouped = (y0, data, xKey, series, hgt) => {
      const n = Math.max(1, data.length),
        ns = Math.max(1, series.length);
      const groupW = Math.max(48, ns * 16 + 18),
        bw = Math.min(15, (groupW - 14) / ns - 3);
      const rw = Math.min(CWx, n * Math.max(70, groupW)),
        sx = rw / (n * groupW),
        ox = MX + (CWx - rw) / 2;
      const max = Math.max(1, ...data.flatMap(d => series.map(s3 => d[s3.id] || 0)));
      gridLines(ox, rw, y0, hgt);
      data.forEach((d, gi) => {
        series.forEach((s3, si) => {
          const v = d[s3.id] || 0,
            h2 = v / max * (hgt - 44);
          if (h2 <= 0) return;
          const c = hx(s3.color),
            bx = ox + (gi * groupW + 9 + si * (bw + 3)) * sx,
            by = y0 + hgt - 20 - h2;
          doc.setFillColor(c[0], c[1], c[2]);
          doc.roundedRect(X(bx), X(by), X(bw * sx), X(h2), X(Math.min(3, bw * sx / 2)), X(Math.min(3, h2 / 2)), 'F');
        });
        font('normal', 9.5, C.faint);
        T(monthLbl(d[xKey]), ox + (gi * groupW + groupW / 2) * sx, y0 + hgt - 6, {
          align: 'center'
        });
      });
      return y0 + hgt;
    };
    const vStacked = (y0, data, xKey, series, hgt) => {
      const n = Math.max(1, data.length);
      const step = Math.max(40, Math.min(70, 600 / n)),
        rw = Math.min(CWx, n * Math.max(64, step)),
        sx = rw / (n * step),
        ox = MX + (CWx - rw) / 2;
      const totals = data.map(d => series.reduce((s3, k) => s3 + (d[k.id] || 0), 0));
      const max = Math.max(1, ...totals);
      gridLines(ox, rw, y0, hgt);
      data.forEach((d, gi) => {
        let acc = 0;
        const bx = ox + (gi * step + (step - 24) / 2) * sx,
          bwv = 24 * sx;
        series.forEach((s3, si) => {
          const v = d[s3.id] || 0,
            h2 = v / max * (hgt - 44);
          if (h2 <= 0) return;
          const by = y0 + hgt - 20 - acc - h2;
          acc += h2;
          const c = hx(s3.color);
          doc.setFillColor(c[0], c[1], c[2]);
          if (si === series.length - 1) doc.roundedRect(X(bx), X(by), X(bwv), X(h2), X(Math.min(3, bwv / 2)), X(Math.min(3, h2 / 2)), 'F');else doc.rect(X(bx), X(by), X(bwv), X(h2), 'F');
        });
        font('normal', 9.5, C.faint);
        T(monthLbl(d[xKey]), ox + (gi * step + step / 2) * sx, y0 + hgt - 6, {
          align: 'center'
        });
      });
      return y0 + hgt;
    };
    const vPct = (y0, data, xKey, series, hgt) => {
      const items = series.map((s3, i) => ({
        t: String(s3.label || s3.id),
        c: hx(s3.color || PALETTE[i % PALETTE.length])
      }));
      font('normal', 11.5, C.ink2);
      const totW = items.reduce((a, it) => a + 11 + 6 + tw(it.t), 0) + 14 * (items.length - 1);
      let lx = MX + Math.max(0, (CWx - totW) / 2),
        ly = y0 + 2;
      items.forEach(it => {
        const w2 = 11 + 6 + tw(it.t);
        if (lx + w2 > MX + CWx) {
          lx = MX;
          ly += 16;
        }
        FR(lx, ly, 11, 11, it.c, 3);
        font('normal', 11.5, C.ink2);
        T(it.t, lx + 17, ly + 9.5);
        lx += w2 + 14;
      });
      y0 = ly + 19;
      const n = Math.max(1, data.length),
        padT = 16,
        plotH = hgt - 40;
      const step = Math.max(40, Math.min(74, 560 / n)),
        viewW = Math.max(280, n * step);
      const rw = Math.min(CWx, Math.max(260, n * Math.max(64, step))),
        sx = rw / viewW,
        ox = MX + (CWx - rw) / 2;
      const totals = data.map(d => series.reduce((s3, k) => s3 + (+d[k.id] || 0), 0));
      const baseY = y0 + padT + plotH;
      [0, .25, .5, .75, 1].forEach(g => {
        LN(ox, baseY - g * plotH, ox + rw, baseY - g * plotH, C.grid, 1);
        font('normal', 9, C.faint);
        T(Math.round(g * 100) + '%', ox + 2 * sx, baseY - g * plotH - 2);
      });
      data.forEach((d, gi) => {
        const tot = totals[gi] || 0,
          bwp = Math.min(26, step * 0.5),
          bwv = bwp * sx,
          bx = ox + (gi * step + (step - bwp) / 2) * sx;
        let acc = 0;
        series.forEach((s3, si) => {
          const v = +d[s3.id] || 0,
            frac = tot ? v / tot : 0,
            h2 = frac * plotH;
          if (h2 <= 0) return;
          const by = baseY - acc - h2;
          acc += h2;
          const c = hx(s3.color || PALETTE[si % PALETTE.length]);
          doc.setFillColor(c[0], c[1], c[2]);
          if (si === series.length - 1) doc.roundedRect(X(bx), X(by), X(bwv), X(h2), X(Math.min(3, bwv / 2)), X(Math.min(3, h2 / 2)), 'F');else doc.rect(X(bx), X(by), X(bwv), X(h2), 'F');
        });
        font('normal', 9.5, C.faint);
        T(monthLbl(d[xKey]), ox + (gi * step + step / 2) * sx, y0 + hgt - 6, {
          align: 'center'
        });
      });
      return y0 + hgt;
    };
    const vHBarRows = (y0, rows) => {
      const max = Math.max(1, ...rows.map(r => r.value));
      let y = y0;
      rows.forEach(r => {
        if (y + 20 > LIMIT) y = newPage();
        font('bold', 12, C.ink2);
        T(clip(r.label, 116), MX, y + 12);
        const tx = MX + 130,
          twd = CWx - 130 - 64;
        FR(tx, y + 1.5, twd, 15, C.grid, 5);
        if (r.value > 0) FR(tx, y + 1.5, Math.max(4, twd * (r.value / max)), 15, r.color, 5);
        font('bold', 12.5, C.ink);
        T(fmt(r.value), MX + CWx, y + 12.5, {
          align: 'right'
        });
        y += 24;
      });
      return y - 9 + 4;
    };
    const vDonut = (x, y, size, thickness, data, centerValue, centerLabel) => {
      const total = data.reduce((s3, d) => s3 + d.value, 0) || 1;
      const cx2 = x + size / 2,
        cy2 = y + size / 2,
        rO = size / 2,
        rI = size / 2 - thickness;
      let ang = -Math.PI / 2;
      data.forEach((d, i) => {
        const frac = d.value / total,
          a1 = ang + frac * 2 * Math.PI;
        if (frac > 0) wedge(cx2, cy2, rO, rI, ang, a1, hx(d.color || PALETTE[i % PALETTE.length]));
        ang = a1;
      });
      if (centerValue != null) {
        font('bold', 24, C.ink);
        T(centerValue, cx2, cy2 + 3, {
          align: 'center'
        });
        font('normal', 10, C.muted);
        doc.text(String(centerLabel || '').toUpperCase(), X(cx2), X(cy2 + 16), {
          align: 'center',
          charSpace: 0.4 * S
        });
      }
    };
    const donutLegend = (x, y, data) => {
      data.forEach((d, i) => {
        const ry = y + i * 21;
        FR(x, ry, 9, 9, hx(d.color || PALETTE[i % PALETTE.length]), 3);
        font('normal', 12, C.ink2);
        T(d.label, x + 17, ry + 9);
      });
      font('bold', 12, C.ink);
      const labW = Math.max(...data.map(d => tw(d.label)));
      const w2 = 9 + 8 + labW + 14 + Math.max(...data.map(d => tw(fmt(d.value))));
      data.forEach((d, i) => {
        font('bold', 12, C.ink);
        T(fmt(d.value), x + w2, y + i * 21 + 9, {
          align: 'right'
        });
      });
      return w2;
    };
    const donutLegendW = data => {
      font('normal', 12, C.ink2);
      const labW = Math.max(...data.map(d => tw(d.label)));
      font('bold', 12, C.ink);
      return 9 + 8 + labW + 14 + Math.max(...data.map(d => tw(fmt(d.value))));
    };
    const vDonutBlock = (y0, data, hgt) => {
      const legW = donutLegendW(data),
        size = 188,
        legH = data.length * 21 - 6;
      const x0 = MX + Math.max(0, (CWx - (size + 18 + legW)) / 2),
        blockH = Math.max(hgt, size);
      vDonut(x0, y0 + (blockH - size) / 2, size, 30, data, fmt(data.reduce((s3, d) => s3 + d.value, 0)), 'Total');
      donutLegend(x0 + size + 18, y0 + (blockH - legH) / 2, data);
      return y0 + blockH;
    };
    const compositionStrip = (y0, data, title) => {
      const legH = data.length * 21 - 6,
        boxH = Math.max(124, legH + 20);
      FR(MX, y0, CWx, boxH, C.panel2, 9);
      font('bold', 10.5, C.muted);
      doc.text(String(title || 'COMPOSITION').toUpperCase(), X(MX + 14), X(y0 + boxH / 2 + 3), {
        charSpace: 0.3 * S
      });
      const dx0 = MX + 14 + 78 + 10;
      vDonut(dx0, y0 + (boxH - 104) / 2, 104, 20, data, null, null);
      donutLegend(dx0 + 104 + 18, y0 + (boxH - legH) / 2, data);
      return y0 + boxH;
    };
    const vTable = (y, heads, widths, rows, o) => {
      o = o || {};
      const fs2 = o.fs || 12.5,
        rpt = !!o.rpt;
      const hfs = rpt ? fs2 : 10.5,
        padX = rpt ? 6 : 12,
        padY = rpt ? 5 : 8;
      const rowH = Math.round(fs2 * 1.3 + padY * 2),
        lh = hfs * 1.18;
      const xs = [];
      let ax = MX;
      widths.forEach(w2 => {
        xs.push(ax);
        ax += w2;
      });
      const drawHead = yy => {
        font('bold', hfs, C.muted);
        const wrapped = heads.map((h2, i) => doc.splitTextToSize(String(h2).toUpperCase(), X(Math.max(10, widths[i] - padX - 4))));
        const maxL = Math.max(1, ...wrapped.map(w2 => w2.length));
        const hH = Math.round(maxL * lh + padY * 2 + 2);
        FR(MX, yy, CWx, hH, C.panel2);
        wrapped.forEach((lines, i) => {
          const right = i > 0;
          const tx = right ? xs[i] + widths[i] - padX : xs[i] + padX;
          const sy = yy + hH - padY - 3 - (lines.length - 1) * lh;
          lines.forEach((ln2, li) => T(ln2, tx, sy + li * lh, right ? {
            align: 'right'
          } : undefined));
        });
        LN(MX, yy + hH, MX + CWx, yy + hH, C.line, 1);
        return yy + hH;
      };
      {
        font('bold', hfs, C.muted);
        const wrapped0 = heads.map((h2, i) => doc.splitTextToSize(String(h2).toUpperCase(), X(Math.max(10, widths[i] - padX - 4))));
        const hH0 = Math.round(Math.max(1, ...wrapped0.map(w2 => w2.length)) * lh + padY * 2 + 2);
        if (y + hH0 + rowH > LIMIT) y = newPage();
      }
      y = drawHead(y);
      rows.forEach((r, ri) => {
        if (y + rowH > LIMIT) {
          y = newPage();
          y = drawHead(y);
        }
        const tot = o.totalRow && ri === rows.length - 1;
        if (tot) {
          FR(MX, y, CWx, rowH, C.panel2);
          LN(MX, y, MX + CWx, y, C.line, 2);
        }
        r.forEach((cell, ci) => {
          if (o.deltaCol === ci) {
            deltaChip(xs[ci] + widths[ci] - padX, y + (rowH - 18) / 2, Number(cell) || 0);
            return;
          }
          const right = ci > 0;
          font(ci === 0 || tot ? 'bold' : 'normal', fs2, tot ? C.ink : ci === 0 ? C.ink : C.ink2);
          T(clip(cell, widths[ci] - padX - 4), right ? xs[ci] + widths[ci] - padX : xs[ci] + padX, y + rowH - padY - fs2 * 0.24, right ? {
            align: 'right'
          } : undefined);
        });
        LN(MX, y + rowH, MX + CWx, y + rowH, C.line2, 1);
        y += rowH;
      });
      return y;
    };
    const sigBlockAt = (x0, wAll, y) => {
      y += 26;
      font('bold', 9.5, C.muted);
      doc.text(('Authorisation · ' + hospitalName).toUpperCase(), X(x0), X(y + 9), {
        charSpace: 0.4 * S
      });
      const gap = 22,
        w3 = (wAll - 3 * gap) / 4,
        ly = y + 9 + 12 + 34;
      [['Prepared by', sig.prepared], ['Checked by', sig.reviewed], ['Recommended by', sig.recommended], ['Approved by', sig.approved]].forEach(([role, name], i) => {
        const x = x0 + i * (w3 + gap);
        LN(x, ly, x + w3, ly, C.ink2, 1);
        font('bold', 11, C.ink);
        T(name || ' ', x, ly + 14);
        font('normal', 9.5, C.muted);
        doc.text(role.toUpperCase(), X(x), X(ly + 26), {
          charSpace: 0.3 * S
        });
      });
      return ly + 32;
    };
    const sigBlockPx = y => sigBlockAt(MX, CWx, y);
    const SIGH = 113;
    const chartH = (cs, fs2, compGroups) => {
      if (cs === 'horizontal') return Math.max(1, fs2.length) * 24 - 5;
      if (cs === 'donut') return compGroups.length ? Math.max(205, compGroups.length * 210 - 5) : 205;
      if (cs === 'combo' || cs === 'pct') return 231;
      if (cs === 'grouped' || cs === 'stacked') return 210;
      if (cs === 'area') return 200;
      if (cs === 'bar' || cs === 'line') return 195;
      return 205;
    };
    const drawChart = (cs, y, d, fs2, tone, compGroups) => {
      const prim = d.primary;
      if (cs === 'bar') return vBarFlat(y, fs2, 'month', prim, 195);
      if (cs === 'line') return vLine(y, fs2, 'full', prim, tone, 195);
      if (cs === 'area') {
        const avg = fs2.length ? Math.round(fs2.reduce((s3, r) => s3 + (r[prim] || 0), 0) / fs2.length) : 0;
        return vArea(y, fs2, 'full', prim, tone, avg, 200);
      }
      if (cs === 'combo') {
        const pctCol = d.cols.find(c => c.pct);
        const lineKey = pctCol ? pctCol.id : (d.cols.find(c => c.id !== prim && !c.pct) || {}).id || prim;
        return vCombo(y, fs2, 'month', prim, lineKey, tone, hx('#e08a1e'), (d.cols.find(c => c.id === prim) || {}).label || 'Value', (d.cols.find(c => c.id === lineKey) || {}).label || 'Trend', 210);
      }
      if (cs === 'grouped') {
        const sr = reportSeries(d);
        return sr.length ? vGrouped(y, fs2, 'month', sr, 210) : vBarFlat(y, fs2, 'month', prim, 195);
      }
      if (cs === 'stacked') {
        const sr = reportSeries(d);
        return sr.length ? vStacked(y, fs2, 'month', sr, 210) : vBarFlat(y, fs2, 'month', prim, 195);
      }
      if (cs === 'pct') {
        const sr = reportSeries(d);
        return sr.length ? vPct(y, fs2, 'month', sr, 210) : vBarFlat(y, fs2, 'month', prim, 195);
      }
      if (cs === 'horizontal') return vHBarRows(y, fs2.map((r, i) => ({
        label: r.full,
        value: r[prim] || 0,
        color: PALV[i % PALV.length]
      })));
      if (cs === 'donut') return compGroups.length ? compGroups.reduce((yy, g) => vDonutBlock(yy, g.data, 205) + 8, y) : vBar3D(y, fs2, 'month', prim, 205);
      return vBar3D(y, fs2, 'month', prim, 205);
    };
    const deptPage = (d, isLast) => {
      let y = pageHeader();
      const fs2 = fseriesOf(d),
        st = statOf(d, fs2);
      const toneHex = PALETTE[d.id.charCodeAt(0) % PALETTE.length],
        tone = hx(toneHex);
      drawIcon(DEPT_ICON[d.id] || I.activity, MX, y + 1, 18, toneHex);
      font('bold', 15, C.ink);
      T(d.name, MX + 27, y + 15);
      tagChip(MX + 27 + tw(d.name) + 9, y + 2, d.group || '');
      if (fs2.length) deltaChip(pageW - MX, y + 1, st.delta);
      y += 31;
      if (!fs2.length) {
        try {
          doc.setLineDashPattern([4 * S, 3 * S], 0);
        } catch (e) {}
        doc.setDrawColor(C.line[0], C.line[1], C.line[2]);
        doc.setLineWidth(1 * S);
        doc.roundedRect(X(MX), X(y), X(CWx), X(96), X(10), X(10), 'S');
        try {
          doc.setLineDashPattern([], 0);
        } catch (e) {}
        font('normal', 12.5, C.muted);
        T('No data reported for ' + d.name + ' in the selected period (' + rangeLabel + ').', MX + CWx / 2, y + 52, {
          align: 'center'
        });
        y += 96;
        return;
      }
      if (fs2.length < pMonths.length) {
        const segs = [['Reported data covers ', false], [fs2[0].full + ' – ' + fs2[fs2.length - 1].full, true], [' (' + fs2.length + ' of the ' + pMonths.length + ' months in the selected period); months without a report are not plotted.', false]];
        font('normal', 10, C.muted);
        const lines = doc.splitTextToSize(segs.map(s3 => s3[0]).join(''), X(CWx - 20)).length;
        const boxH = lines * 14 + 10;
        FR(MX, y, CWx, boxH, C.panel2, 6);
        richText(segs, MX + 10, y + 15, CWx - 20, 10, 14, C.muted);
        y += boxH + 10;
      }
      y = kpiRow(y, [[st.latest.full || 'Latest', fmt(st.latest[d.primary] || 0)], ['Total', fmt(st.total)], ['Peak', fmt(st.peak)], ['Average', fmt(st.avg)]].map(p => ({
        label: p[0],
        value: p[1],
        tone
      })));
      const compGroups = compositionGroups(d, fs2);
      chartStyles.forEach(cs => {
        const capH = chartStyles.length > 1 ? 18 : 0;
        const need = capH + chartH(cs, fs2, compGroups) + 12;
        if (y + need > LIMIT && y > MT + 71) y = newPage();
        y += 4;
        if (chartStyles.length > 1) {
          font('bold', 9.5, C.muted);
          doc.text(String(CHART_STYLE_LABEL[cs] || cs).toUpperCase(), X(MX), X(y + 12), {
            charSpace: 0.4 * S
          });
          y += 18;
        }
        y = drawChart(cs, y, d, rptChartRows(d, fs2), tone, compGroups);
        y += 8;
      });
      if (!chartStyles.includes('donut')) {
        compGroups.forEach(g => {
          const boxH = Math.max(124, g.data.length * 21 - 6 + 20);
          if (y + 6 + boxH > LIMIT) y = newPage();
          y = compositionStrip(y + 6, g.data, g.title);
        });
      }
      const detailed = type === 'detail';
      const ncol = d.cols.length + 1;
      const tblFont = ncol > 10 ? 8 : ncol > 8 ? 8.5 : ncol > 6 ? 9.5 : detailed ? 10.5 : 11;
      const rpt = detailed || ncol > 7;
      font('bold', tblFont);
      const firstW = rpt ? 58 : Math.min(120, Math.max(76, ...fs2.map(r => tw(detailed ? r.month : r.full) + 24)));
      const widths = [firstW].concat(d.cols.map(() => (CWx - firstW) / d.cols.length));
      const rows = fs2.map(r => [detailed ? r.month : r.full].concat(d.cols.map(c => r[c.id] == null ? '–' : c.pct ? r[c.id] + '%' : fmt(r[c.id]))));
      if (detailed) rows.push(['TOTAL'].concat(d.cols.map(c => c.pct ? '—' : fmt(fs2.reduce((s3, r) => s3 + (r[c.id] || 0), 0)))));
      y = vTable(y + 14, ['Month'].concat(d.cols.map(c => c.label)), widths, rows, {
        fs: tblFont,
        rpt: rpt,
        totalRow: detailed
      });
    };
    const coverPage = () => {
      const rows = chosen.map(d => {
        const fsr = fseriesOf(d);
        return {
          d,
          st: statOf(d, fsr),
          fs: fsr
        };
      });
      const totAll = rows.reduce((s3, r) => s3 + r.st.total, 0);
      const mTot = {};
      rows.forEach(rr => rr.fs.forEach(r => {
        mTot[r.month] = (mTot[r.month] || 0) + (r[rr.d.primary] || 0);
      }));
      const peakM = Object.keys(mTot).sort((a, b) => mTot[b] - mTot[a])[0];
      const typeLabel = {
        summary: 'Department Summary Report',
        detail: 'Detailed Statistical Report',
        compare: 'Cross-Department Comparison',
        board: 'Executive Board Report'
      }[type] || 'Statistical Report';
      const hasSig = !!(sig.prepared || sig.reviewed || sig.recommended || sig.approved);
      const totalH = (logo ? 92 : 0) + 16 + 58 + 17 + 28 + 82 + (confidential ? 54 : 0) + 29 + (hasSig ? SIGH : 0);
      let y = MT + Math.max(24, (FOOTY - MT - totalH) / 2 + 15);
      if (logo) {
        const w2 = 66 * (logo.w / logo.h);
        drawLogo(pageW / 2 - w2 / 2, y, 66);
        y += 92;
      }
      font('bold', 13, C.blue);
      doc.text(String(hospitalName).toUpperCase(), X(pageW / 2), X(y + 11), {
        align: 'center',
        charSpace: 1.5 * S
      });
      y += 16;
      font('bold', 32, C.ink);
      T(hdrTitle || 'Patient Statistics Report', pageW / 2, y + 40, {
        align: 'center'
      });
      y += 58;
      font('normal', 13, C.muted);
      T((hdrSub ? hdrSub + ' · ' : '') + typeLabel, pageW / 2, y + 12, {
        align: 'center'
      });
      y += 17;
      font('bold', 14, C.ink2);
      T(rangeLabel, pageW / 2, y + 21, {
        align: 'center'
      });
      y += 28;
      const sw = CWx / 4;
      [['Departments', String(chosen.length), PALV[0]], ['Total patients', fmt(totAll), PALV[1]], ['Peak month', peakM ? peakM.split('-')[0] + ' 20' + peakM.split('-')[1] : '—', PALV[2]], ['Months covered', String(pMonths.length), PALV[3]]].forEach((s3, i) => {
        const x = MX + i * sw + sw / 2;
        font('bold', 26, s3[2]);
        T(s3[1], x, y + 58, {
          align: 'center'
        });
        font('normal', 9.5, C.muted);
        doc.text(String(s3[0]).toUpperCase(), X(x), X(y + 72), {
          align: 'center',
          charSpace: 0.4 * S
        });
      });
      y += 82;
      if (confidential) {
        font('bold', 10.5, C.rose);
        const t2 = 'CONFIDENTIAL — FOR AUTHORISED RECIPIENTS ONLY';
        const w2 = tw(t2) + 28;
        doc.setDrawColor(C.roseLine[0], C.roseLine[1], C.roseLine[2]);
        doc.setLineWidth(1 * S);
        doc.roundedRect(X(pageW / 2 - w2 / 2), X(y + 28), X(w2), X(26), X(6), X(6), 'S');
        T(t2, pageW / 2, y + 44.5, {
          align: 'center'
        });
        y += 54;
      }
      font('normal', 10, C.faint);
      T('Generated ' + genDate, pageW / 2, y + 24, {
        align: 'center'
      });
      y += 29;
      if (showSig && hasSig) sigBlockAt(Math.max(MX, (pageW - 600) / 2), Math.min(600, CWx), y);
    };
    const comparePage = () => {
      let y = pageHeader();
      const rows = chosen.map(d => {
        const fsr = fseriesOf(d);
        return {
          d,
          st: statOf(d, fsr)
        };
      });
      font('bold', 15, C.ink);
      T('Cross-department comparison · ' + chosen.length + ' departments', MX, y + 14);
      y += 31;
      const hbar = rows.map(rr => ({
        label: rr.d.short,
        value: rr.st.total,
        color: PALV[rr.d.id.charCodeAt(0) % PALV.length]
      })).sort((a, b) => b.value - a.value);
      y = vHBarRows(y, hbar) + 16;
      const widths = [CWx * 0.22, CWx * 0.18, CWx * 0.11, CWx * 0.11, CWx * 0.11, CWx * 0.11, CWx * 0.16];
      y = vTable(y, ['Department', 'Service line', 'Latest', 'Total', 'Peak', 'Avg', 'Trend'], widths, rows.map(rr => [rr.d.name, rr.d.group, fmt(rr.st.latest[rr.d.primary] || 0), fmt(rr.st.total), fmt(rr.st.peak), fmt(rr.st.avg), rr.st.delta]), {
        fs: 11.5,
        deltaCol: 6
      });
    };
    const boardPage = () => {
      let y = pageHeader();
      const rows = chosen.map(d => {
        const fsr = fseriesOf(d);
        return {
          d,
          st: statOf(d, fsr),
          fs: fsr
        };
      });
      const totAll = rows.reduce((s3, r) => s3 + r.st.total, 0);
      const top = rows.slice().sort((a, b) => b.st.total - a.st.total)[0];
      const mTot = {};
      rows.forEach(rr => rr.fs.forEach(r => {
        mTot[r.month] = (mTot[r.month] || 0) + (r[rr.d.primary] || 0);
      }));
      const trend = pMonths.filter(m => mTot[m] != null).map(m => ({
        label: m.split('-')[0],
        val: mTot[m]
      }));
      const peakM = trend.slice().sort((a, b) => b.val - a.val)[0];
      drawIcon(I.doc, MX, y + 1, 18, PALETTE[0]);
      font('bold', 15, C.ink);
      T('Executive Board Report', MX + 27, y + 15);
      tagChip(MX + 27 + tw('Executive Board Report') + 9, y + 2, rangeLabel);
      font('bold', 10.5, C.blue700);
      tagChip(pageW - MX - (tw(String(rows.length) + ' DEPARTMENTS') + 16), y + 2, rows.length + ' departments');
      y += 31;
      y = kpiRow(y, [['Total patients', fmt(totAll)], ['Departments', String(rows.length)], ['Busiest dept', top ? top.d.short : '—'], ['Peak month', peakM ? peakM.label : '—']].map((p, i) => ({
        label: p[0],
        value: p[1],
        tone: PALV[i % PALV.length]
      })));
      if (trend.length > 1) {
        font('bold', 9.5, C.muted);
        doc.text('HOSPITAL VOLUME — MONTHLY TREND', X(MX), X(y + 12), {
          charSpace: 0.4 * S
        });
        y += 18;
        y = vBarFlat(y, trend, 'label', 'val', 170) + 12;
      }
      font('bold', 9.5, C.muted);
      doc.text('DEPARTMENT RANKING (PERIOD TOTAL)', X(MX), X(y + 12), {
        charSpace: 0.4 * S
      });
      y += 20;
      const hbar = rows.map(rr => ({
        label: rr.d.short,
        value: rr.st.total,
        color: PALV[rr.d.id.charCodeAt(0) % PALV.length]
      })).sort((a, b) => b.value - a.value);
      y = vHBarRows(y, hbar) + 14;
      const ranked = rows.slice().sort((a, b) => b.st.total - a.st.total);
      const widths = [CWx * 0.24, CWx * 0.20, CWx * 0.13, CWx * 0.11, CWx * 0.16, CWx * 0.16];
      y = vTable(y, ['Department', 'Service line', 'Total', 'Share', 'Avg / month', 'Trend'], widths, ranked.map(rr => [rr.d.name, rr.d.group, fmt(rr.st.total), totAll ? Math.round(rr.st.total * 100 / totAll) + '%' : '—', fmt(rr.st.avg), rr.st.delta]), {
        fs: 11,
        deltaCol: 5
      });
    };
    if (showCover && chosen.length > 0) coverPage();
    if (type === 'compare') {
      if (showCover) doc.addPage(fmtP, ori);
      comparePage();
    } else if (type === 'board') {
      if (showCover) doc.addPage(fmtP, ori);
      boardPage();
    } else chosen.forEach((d, di) => {
      if (showCover || di > 0) doc.addPage(fmtP, ori);
      deptPage(d, di === chosen.length - 1);
    });
    const total = doc.getNumberOfPages();
    for (let p = 1; p <= total; p++) {
      doc.setPage(p);
      LN(MX, FOOTY, pageW - MX, FOOTY, C.line, 1);
      font('normal', 9.5, C.faint);
      T(hospitalName, MX, FOOTY + 16);
      T('Page ' + p + ' of ' + total, pageW / 2, FOOTY + 16, {
        align: 'center'
      });
      T((footerNote ? footerNote + ' · ' : '') + (confidential ? 'Confidential · ' : '') + pageSize + ' ' + orient, pageW - MX, FOOTY + 16, {
        align: 'right'
      });
    }
    doc.save('UNICO-statistics-' + type + '-' + new Date().toISOString().slice(0, 10) + '.pdf');
  };
  const doPrint = () => {
    try {
      document.body.classList.add('pdf-export-mode');
      window.print();
    } catch (e) {} finally {
      setTimeout(() => document.body.classList.remove('pdf-export-mode'), 500);
    }
  };
  const buildRenderModel = () => {
    const toneOf = d => PALETTE[d.id.charCodeAt(0) % PALETTE.length];
    const typeLabel = {
      summary: 'Department Summary Report',
      detail: 'Detailed Statistical Report',
      compare: 'Cross-Department Comparison',
      board: 'Executive Board Report'
    }[type] || 'Statistical Report';
    const rows = chosen.map(d => {
      const fs = fseriesOf(d);
      return {
        d,
        fs,
        st: statOf(d, fs)
      };
    });
    const depts = rows.map(({
      d,
      fs,
      st
    }) => {
      const cg = compositionGroups(d, fs).map(g => ({
        title: g.title,
        data: g.data.map(x => ({
          label: x.label,
          value: x.value,
          color: x.color
        }))
      }));
      const chart = rptChartRows(d, fs);
      return {
        id: d.id,
        name: d.name,
        short: d.short,
        group: d.group || '',
        primary: d.primary,
        primaryLabel: d.primaryLabel || '',
        toneHex: toneOf(d),
        cols: d.cols.map(c => ({
          id: c.id,
          label: c.label,
          pct: !!c.pct
        })),
        fs: fs.map(r => {
          const o = {
            month: r.month,
            full: r.full
          };
          d.cols.forEach(c => {
            o[c.id] = r[c.id] == null ? null : r[c.id];
          });
          return o;
        }),
        chartRows: chart.map(r => ({
          x: r.month,
          full: r.full,
          v: r[d.primary] || 0
        })),
        series: reportSeries(d),
        stat: {
          latestFull: st.latest.full || 'Latest',
          latestValue: st.latest[d.primary] || 0,
          total: st.total,
          peak: st.peak,
          avg: st.avg,
          delta: st.delta
        },
        partial: fs.length > 0 && fs.length < pMonths.length ? {
          from: fs[0].full,
          to: fs[fs.length - 1].full,
          reported: fs.length,
          periodMonths: pMonths.length
        } : null,
        compGroups: cg
      };
    });
    const totAll = rows.reduce((s, r) => s + r.st.total, 0);
    const mTot = {};
    rows.forEach(({
      d,
      fs
    }) => fs.forEach(r => {
      mTot[r.month] = (mTot[r.month] || 0) + (r[d.primary] || 0);
    }));
    const peakM = Object.keys(mTot).sort((a, b) => mTot[b] - mTot[a])[0];
    const trend = pMonths.filter(m => mTot[m] != null).map(m => ({
      label: m.split('-')[0],
      val: mTot[m]
    }));
    const bPeak = trend.slice().sort((a, b) => b.val - a.val)[0];
    const bTop = rows.slice().sort((a, b) => b.st.total - a.st.total)[0];
    const ranked = rows.slice().sort((a, b) => b.st.total - a.st.total);
    const board = {
      kpis: [['Total patients', fmt(totAll)], ['Departments', String(rows.length)], ['Busiest dept', bTop ? bTop.d.short : '—'], ['Peak month', bPeak ? bPeak.label : '—']],
      trend,
      hbar: rows.map(({
        d,
        st
      }) => ({
        label: d.short,
        value: st.total,
        color: toneOf(d)
      })).sort((a, b) => b.value - a.value),
      ranked: ranked.map(({
        d,
        st
      }) => ({
        name: d.name,
        group: d.group || '',
        total: st.total,
        share: totAll ? Math.round(st.total * 100 / totAll) + '%' : '—',
        avg: st.avg,
        delta: st.delta
      }))
    };
    const compare = {
      hbar: rows.map(({
        d,
        st
      }) => ({
        label: d.short,
        value: st.total,
        color: toneOf(d)
      })).sort((a, b) => b.value - a.value),
      rows: rows.map(({
        d,
        st
      }) => ({
        name: d.name,
        group: d.group || '',
        latest: st.latest[d.primary] || 0,
        total: st.total,
        peak: st.peak,
        avg: st.avg,
        delta: st.delta
      }))
    };
    const cover = {
      typeLabel,
      deptCount: chosen.length,
      totAll,
      peakMonthLabel: peakM ? peakM.split('-')[0] + ' 20' + peakM.split('-')[1] : '—',
      monthsCovered: pMonths.length
    };
    return {
      doc: {
        type,
        pageSize,
        orient,
        hdrTitle,
        hdrSub,
        hospitalName,
        showLogo,
        confidential,
        footerNote,
        showCover: showCover && chosen.length > 0,
        showSig,
        rangeLabel,
        genDate: new Date().toLocaleDateString('en-US'),
        chartStyles,
        sig,
        palette: PALETTE
      },
      depts,
      board,
      compare,
      cover
    };
  };
  const tryServerPDF = async () => {
    if (window.__UNICO_SERVER_PDF__ === false) return false;
    try {
      const res = await fetch('/api/report-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(buildRenderModel())
      });
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      if (res.ok && ct.indexOf('pdf') >= 0) {
        const blob = await res.blob();
        msDownload(blob, 'UNICO-statistics-' + type + '-' + new Date().toISOString().slice(0, 10) + '.pdf', 'application/pdf');
        return true;
      }
      try {
        console.warn('[reports] server PDF unavailable (' + res.status + ' ' + ct + ') — falling back to vector');
      } catch (_) {}
    } catch (e) {
      try {
        console.warn('[reports] server PDF failed, falling back to vector:', e);
      } catch (_) {}
    }
    return false;
  };
  const doExport = async () => {
    const native = window.unicoNative;
    if (chosen.length === 0) {
      setNote({
        ok: false,
        text: 'Select at least one department first.'
      });
      return;
    }
    if (native && typeof native.exportPDF === 'function' && !native.isWeb) {
      setExporting(true);
      setNote(null);
      document.body.classList.add('pdf-export-mode');
      try {
        const res = await native.exportPDF({
          pageSize,
          landscape: orient === 'landscape',
          defaultName: `UNICO-${type}-report`
        });
        if (res && res.ok) setNote({
          ok: true,
          text: 'PDF' + (res.path ? ' saved · ' + res.path : ' ready — save it from the print dialog')
        });else if (res && res.canceled) {} else setNote({
          ok: false,
          text: res && res.error || 'Export failed.'
        });
      } catch (e) {
        setNote({
          ok: false,
          text: String(e && e.message ? e.message : e)
        });
      } finally {
        document.body.classList.remove('pdf-export-mode');
        setExporting(false);
      }
      return;
    }
    if (chosen.length > 0) {
      setExporting('Generating PDF…');
      setNote(null);
      if (window.__UNICO_HTML_PDF__ === true) {
        try {
          if (await unicoHtmlServerPDF(pageSize, orient, 'UNICO-statistics-' + type + '-' + new Date().toISOString().slice(0, 10) + '.pdf')) {
            setNote({
              ok: true,
              text: 'PDF downloaded.'
            });
            setExporting(false);
            return;
          }
        } catch (e) {}
      }
      try {
        if (await tryServerPDF()) {
          setNote({
            ok: true,
            text: 'PDF downloaded.'
          });
          setExporting(false);
          return;
        }
      } catch (e) {}
    }
    if (window.unicoLoadPdfLibs && !(window.jspdf && window.html2canvas)) {
      setExporting('Preparing PDF…');
      setNote(null);
      try {
        await window.unicoLoadPdfLibs();
      } catch (e) {
        try {
          console.warn('[reports] PDF libraries failed to load:', e);
        } catch (_) {}
      }
    }
    const J0 = window.jspdf && window.jspdf.jsPDF;
    if (J0) {
      setExporting('Building PDF…');
      setNote(null);
      try {
        await buildVectorPDF(J0);
        setNote({
          ok: true,
          text: 'PDF downloaded — vector quality (selectable text).'
        });
        setExporting(false);
        return;
      } catch (e) {
        try {
          console.warn('[reports] vector PDF failed, falling back to raster:', e);
        } catch (_) {}
      }
    }
    const H = window.html2canvas,
      J = window.jspdf && window.jspdf.jsPDF;
    if (H && J) {
      setExporting(true);
      setNote(null);
      const stage = document.getElementById('pdf-root');
      let els = [],
        prev = [];
      try {
        if (!stage) throw new Error('render target missing');
        document.body.classList.add('qc-pdfcap');
        els = Array.prototype.slice.call(stage.querySelectorAll('.pdf-page'));
        if (!els.length) throw new Error('nothing to export');
        prev = els.map(el => el.getAttribute('style') || '');
        els.forEach(el => {
          el.style.width = pageW + 'px';
          el.style.boxSizing = 'border-box';
          el.style.padding = '28px 30px';
          el.style.background = '#fff';
          el.style.margin = '0';
          el.style.height = 'auto';
          el.style.overflow = 'visible';
        });
        try {
          if (document.fonts && document.fonts.ready) await document.fonts.ready;
        } catch (e) {}
        await new Promise(r => setTimeout(r, 80));
        const fmt = pageSize === 'A3' ? 'a3' : pageSize === 'Letter' ? 'letter' : 'a4',
          ori = orient === 'landscape' ? 'l' : 'p';
        const doc = new J({
          orientation: ori,
          unit: 'pt',
          format: fmt,
          compress: true
        });
        const pw = doc.internal.pageSize.getWidth(),
          ph = doc.internal.pageSize.getHeight();
        const capScale = els.length > 8 ? 1.5 : 2;
        let firstPage = true;
        for (let i = 0; i < els.length; i++) {
          setExporting('Page ' + (i + 1) + '/' + els.length + '…');
          await new Promise(r => setTimeout(r, 30));
          const el = els[i];
          if (el.scrollHeight <= pageMinH) {
            el.style.height = pageMinH + 'px';
            el.style.overflow = 'hidden';
          }
          const elRect = el.getBoundingClientRect();
          const guardsCss = [];
          el.querySelectorAll('tr,svg,.pdf-foot,[style*="break-inside"]').forEach(a => {
            const r = a.getBoundingClientRect();
            if (r.height > 0) guardsCss.push([r.top - elRect.top, r.bottom - elRect.top]);
          });
          const fEl = el.querySelector('.pdf-foot');
          let fCss = null;
          if (fEl) {
            const fr = fEl.getBoundingClientRect();
            if (fr.height > 0) fCss = [fr.top - elRect.top, fr.bottom - elRect.top];
          }
          const canvas = await H(el, {
            scale: capScale,
            backgroundColor: '#ffffff',
            useCORS: true,
            logging: false
          });
          el.style.height = 'auto';
          el.style.overflow = 'visible';
          const cW = canvas.width,
            cH = canvas.height,
            pxPerPt = cW / pw,
            pageHpx = Math.round(ph * pxPerPt);
          const k = elRect.height > 0 ? cH / elRect.height : capScale;
          const guards = guardsCss.map(g => [g[0] * k, g[1] * k]).filter(g => g[1] - g[0] < pageHpx * 0.9);
          const fPx = fCss ? [fCss[0] * k, fCss[1] * k] : null;
          const pickEnd = (y0, budget) => {
            if (cH - y0 <= budget) return cH;
            let cut = y0 + budget;
            for (let pass = 0; pass < 8; pass++) {
              let moved = false;
              for (const g of guards) {
                if (g[0] < cut - 1 && g[1] > cut + 1) {
                  const c2 = Math.floor(g[0]);
                  if (c2 > y0 + budget * 0.35) {
                    cut = c2;
                    moved = true;
                  }
                }
              }
              if (!moved) break;
            }
            return Math.max(cut, y0 + Math.round(budget * 0.35));
          };
          const crop = (top, h) => {
            const tmp = document.createElement('canvas');
            tmp.width = cW;
            tmp.height = h;
            tmp.getContext('2d').drawImage(canvas, 0, top, cW, h, 0, 0, cW, h);
            return tmp.toDataURL('image/jpeg', 0.94);
          };
          const snapCtx = canvas.getContext('2d', {
            willReadFrequently: true
          });
          const rowBlank = yy => {
            if (yy <= 0 || yy >= cH) return false;
            const d2 = snapCtx.getImageData(0, yy, cW, 1).data;
            for (let j = 0; j < d2.length; j += 4) {
              if (d2[j] < 252 || d2[j + 1] < 252 || d2[j + 2] < 252) return false;
            }
            return true;
          };
          const snapCut = (cut, y0) => {
            if (rowBlank(cut)) return cut;
            const up = Math.min(90, cut - (y0 + 24));
            for (let dY = 1; dY <= 90; dY++) {
              if (dY <= up && rowBlank(cut - dY)) return cut - dY;
              if (dY <= 8 && cut + dY < cH - 1 && rowBlank(cut + dY)) return cut + dY;
            }
            return cut;
          };
          const padPx = Math.round(28 * k),
            padPt = padPx / pxPerPt;
          if (cH <= pageHpx + 4) {
            if (!firstPage) doc.addPage(fmt, ori);
            firstPage = false;
            doc.addImage(canvas.toDataURL('image/jpeg', 0.94), 'JPEG', 0, 0, pw, Math.min(ph, cH / pxPerPt), undefined, 'FAST');
          } else {
            let y = 0;
            do {
              const first = y === 0,
                top = first ? 0 : padPt,
                budget = pageHpx - (first ? 1 : 2) * padPx;
              let end = pickEnd(y, budget);
              if (end < cH) end = snapCut(end, y);
              const sliceH = end - y;
              if (!firstPage) doc.addPage(fmt, ori);
              firstPage = false;
              if (cH - end <= 2 && sliceH < budget - 4 && fPx && fPx[0] >= y - 2 && fPx[0] < end) {
                const fTop = Math.max(y, snapCut(Math.floor(fPx[0]), y)),
                  contentH = fTop - y,
                  footH = end - fTop;
                if (contentH > 2) doc.addImage(crop(y, contentH), 'JPEG', 0, top, pw, contentH / pxPerPt, undefined, 'FAST');
                if (footH > 2) doc.addImage(crop(fTop, footH), 'JPEG', 0, ph - footH / pxPerPt, pw, footH / pxPerPt, undefined, 'FAST');
              } else {
                doc.addImage(crop(y, sliceH), 'JPEG', 0, top, pw, sliceH / pxPerPt, undefined, 'FAST');
              }
              y = end;
            } while (cH - y > 2);
          }
        }
        els.forEach((el, i) => el.setAttribute('style', prev[i]));
        els = [];
        document.body.classList.remove('qc-pdfcap');
        doc.save('UNICO-statistics-' + type + '-' + new Date().toISOString().slice(0, 10) + '.pdf');
        setNote({
          ok: true,
          text: 'PDF downloaded (' + (ori === 'l' ? 'landscape' : 'portrait') + ').'
        });
      } catch (e) {
        try {
          els.forEach((el, i) => el.setAttribute('style', prev[i]));
        } catch (_) {}
        document.body.classList.remove('qc-pdfcap');
        setNote({
          ok: false,
          text: 'Direct PDF failed (' + String(e && e.message || e) + '); opening Print instead.'
        });
        try {
          document.body.classList.add('pdf-export-mode');
          window.print();
          setTimeout(() => document.body.classList.remove('pdf-export-mode'), 600);
        } catch (_) {}
      } finally {
        setExporting(false);
      }
      return;
    }
    doPrint();
  };
  const pdfRoot = typeof document !== 'undefined' ? document.getElementById('pdf-root') : null;
  const hasQualityReports = typeof window.QualityReportsPanel === 'function';
  const modeSeg = React.createElement("div", {
    className: "seg"
  }, React.createElement("button", {
    className: mode === 'builder' ? 'on' : '',
    onClick: () => setMode('builder')
  }, "Report Builder"), React.createElement("button", {
    className: mode === 'monthly' ? 'on' : '',
    onClick: () => setMode('monthly')
  }, "Monthly Statistics Report"), hasQualityReports && React.createElement("button", {
    className: mode === 'quality' ? 'on' : '',
    onClick: () => setMode('quality')
  }, "Quality & Hand Hygiene"));
  if (mode === 'monthly') return React.createElement("div", {
    className: "grid",
    style: {
      gap: 16
    }
  }, React.createElement(SectionTitle, {
    icon: I.doc,
    title: "Reports",
    sub: "Statistical & board-ready reporting",
    right: modeSeg
  }), React.createElement(MonthlyStatsReport, {
    depts: depts
  }));
  if (mode === 'quality') return React.createElement("div", {
    className: "grid",
    style: {
      gap: 16
    }
  }, React.createElement(SectionTitle, {
    icon: I.doc,
    title: "Reports",
    sub: "Quality indicators & Hand Hygiene \u2014 board-ready reporting",
    right: modeSeg
  }), hasQualityReports ? React.createElement(window.QualityReportsPanel) : React.createElement(Card, null, React.createElement("div", {
    style: {
      padding: 24,
      color: 'var(--muted)',
      textAlign: 'center'
    }
  }, "Quality reports module is not loaded.")));
  return React.createElement("div", {
    className: "grid",
    style: {
      gap: 16
    }
  }, React.createElement("style", null, '.qc-rpage{display:flex;flex-direction:column;flex:1 0 auto}.qc-rpage .pdf-foot{margin-top:auto}@media print{.qc-rpage{display:block}.qc-rpage .pdf-foot{margin-top:12px}}'), React.createElement(SectionTitle, {
    icon: I.doc,
    title: "Report Builder",
    sub: "Compose and export board-ready statistical reports",
    right: React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap'
      }
    }, modeSeg, React.createElement("button", {
      className: "btn sm",
      onClick: doPrint
    }, React.createElement(Ic, {
      d: I.print,
      s: 15
    }), "Print"), React.createElement("button", {
      className: "btn pri sm",
      onClick: doExport,
      disabled: !!exporting || chosen.length === 0
    }, React.createElement(Ic, {
      d: I.download,
      s: 15
    }), exporting ? typeof exporting === 'string' ? exporting : 'Exporting…' : 'Export PDF'))
  }), note && React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      padding: '10px 14px',
      borderRadius: 8,
      fontSize: 12.5,
      fontWeight: 600,
      color: note.ok ? 'var(--pos)' : 'var(--rose)',
      background: note.ok ? 'var(--pos-bg)' : 'var(--neg-bg)',
      border: '1px solid ' + (note.ok ? '#bfe6cd' : '#f1c6cd')
    }
  }, React.createElement(Ic, {
    d: note.ok ? I.check : I.x,
    s: 15
  }), React.createElement("span", {
    style: {
      wordBreak: 'break-all'
    }
  }, note.text), React.createElement("span", {
    className: "spacer",
    style: {
      flex: 1
    }
  }), React.createElement("button", {
    className: "icon-btn",
    style: {
      width: 24,
      height: 24,
      border: 0,
      background: 'transparent'
    },
    onClick: () => setNote(null)
  }, React.createElement(Ic, {
    d: I.x,
    s: 13
  }))), pdfRoot && ReactDOM.createPortal(React.createElement("div", {
    className: "pdf-doc" + (orient === 'portrait' ? ' portrait' : '')
  }, coverOn && React.createElement("section", {
    className: "pdf-page"
  }, React.createElement(CoverPage, {
    n: 1,
    total: pages
  })), chosen.length > 0 && (type === 'compare' ? React.createElement("section", {
    className: "pdf-page"
  }, React.createElement(ComparePage, {
    n: coverOn ? 2 : 1,
    total: pages
  })) : type === 'board' ? React.createElement("section", {
    className: "pdf-page"
  }, React.createElement(BoardPage, {
    n: coverOn ? 2 : 1,
    total: pages
  })) : chosen.map((d, i) => React.createElement("section", {
    className: "pdf-page",
    key: d.id
  }, React.createElement(DeptPage, {
    d: d,
    n: i + 1 + (coverOn ? 1 : 0),
    total: pages
  }))))), pdfRoot), React.createElement("div", {
    className: "grid",
    style: {
      gridTemplateColumns: '320px 1fr',
      alignItems: 'start'
    }
  }, React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, "Configuration")), React.createElement("div", {
    className: "card-b",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, React.createElement("div", null, fieldLabel('Report type'), React.createElement("div", {
    className: "seg",
    style: {
      width: '100%'
    }
  }, [['summary', 'Summary'], ['detail', 'Detailed'], ['compare', 'Comparison'], ['board', 'Board']].map(([id, l]) => React.createElement("button", {
    key: id,
    className: type === id ? 'on' : '',
    style: {
      flex: 1
    },
    onClick: () => {
      setType(id);
      setPageIdx(0);
    }
  }, l))), React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--muted)',
      marginTop: 6
    }
  }, type === 'summary' ? 'KPIs + chart, one page per department.' : type === 'detail' ? 'Full data table & composition per department.' : type === 'board' ? 'Executive board summary — hospital KPIs, ranking, trend + authorisation sign-off.' : 'All selected departments on one comparison page.')), React.createElement("div", null, fieldLabel('Reporting period'), React.createElement("select", {
    value: period.mode,
    onChange: e => setPeriod({
      mode: e.target.value,
      from: allMonths[0],
      to: allMonths[allMonths.length - 1]
    }),
    style: {
      ...sel2,
      width: '100%'
    }
  }, React.createElement("option", {
    value: "all"
  }, "Full period (", allMonths[0], " \u2013 ", allMonths[allMonths.length - 1], ")"), React.createElement("option", {
    value: "q1"
  }, "Q1 20", lyy, " (Jan\u2013Mar)"), React.createElement("option", {
    value: "apr"
  }, "April 20", lyy, " only"), React.createElement("option", {
    value: "last6"
  }, "Last 6 months"), React.createElement("option", {
    value: "custom"
  }, "Custom range\u2026")), period.mode === 'custom' && React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginTop: 8,
      alignItems: 'center'
    }
  }, React.createElement("select", {
    value: period.from,
    onChange: e => setPeriod(p => ({
      ...p,
      from: e.target.value
    })),
    style: {
      ...sel2,
      flex: 1
    }
  }, allMonths.map(m => React.createElement("option", {
    key: m,
    value: m
  }, m))), React.createElement("span", {
    style: {
      fontSize: 12,
      color: 'var(--muted)'
    }
  }, "to"), React.createElement("select", {
    value: period.to,
    onChange: e => setPeriod(p => ({
      ...p,
      to: e.target.value
    })),
    style: {
      ...sel2,
      flex: 1
    }
  }, allMonths.map(m => React.createElement("option", {
    key: m,
    value: m
  }, m))))), React.createElement("div", null, fieldLabel('Chart styles — pick one or more (each renders per department)'), React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 6
    }
  }, REPORT_STYLES.map(([id, l]) => {
    const on = chartStyles.includes(id);
    return React.createElement("button", {
      key: id,
      onClick: () => toggleStyle(id),
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '5px 10px',
        borderRadius: 20,
        fontSize: 11.5,
        fontWeight: 600,
        cursor: 'pointer',
        border: '1px solid ' + (on ? 'var(--blue)' : 'var(--line)'),
        background: on ? 'var(--blue-50)' : '#fff',
        color: on ? 'var(--blue-700)' : 'var(--muted)'
      }
    }, on && React.createElement(Ic, {
      d: I.check,
      s: 11,
      sw: 3
    }), l);
  }))), React.createElement("div", null, fieldLabel('Header & footer editor'), React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, React.createElement("input", {
    value: hdrTitle,
    onChange: e => setHdrTitle(e.target.value),
    placeholder: "Report title (header)",
    style: {
      ...sel2,
      width: '100%'
    }
  }), React.createElement("input", {
    value: hdrSub,
    onChange: e => setHdrSub(e.target.value),
    placeholder: "Subtitle (optional)",
    style: {
      ...sel2,
      width: '100%'
    }
  }), React.createElement("input", {
    value: hospitalName,
    onChange: e => setHospitalName(e.target.value),
    placeholder: "Footer \u2014 hospital / org name",
    style: {
      ...sel2,
      width: '100%'
    }
  }), React.createElement("input", {
    value: footerNote,
    onChange: e => setFooterNote(e.target.value),
    placeholder: "Footer note (optional)",
    style: {
      ...sel2,
      width: '100%'
    }
  }), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 16,
      flexWrap: 'wrap'
    }
  }, React.createElement("label", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 12,
      color: 'var(--ink-2)'
    }
  }, React.createElement("input", {
    type: "checkbox",
    checked: showLogo,
    onChange: e => setShowLogo(e.target.checked)
  }), "Show logo"), React.createElement("label", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 12,
      color: 'var(--ink-2)'
    }
  }, React.createElement("input", {
    type: "checkbox",
    checked: confidential,
    onChange: e => setConfidential(e.target.checked)
  }), "Confidential mark"), React.createElement("label", {
    title: "A title sheet (org name, report title, period, headline stats) as page 1",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 12,
      color: 'var(--ink-2)'
    }
  }, React.createElement("input", {
    type: "checkbox",
    checked: showCover,
    onChange: e => {
      setShowCover(e.target.checked);
      setPageIdx(0);
    }
  }), "Cover page")))), React.createElement("div", null, fieldLabel('Signatures — saved automatically, shared with every report'), React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, React.createElement("input", {
    value: sig.prepared,
    onChange: e => setSig(s => ({
      ...s,
      prepared: e.target.value
    })),
    placeholder: "Prepared by (name & title)",
    style: {
      ...sel2,
      width: '100%'
    }
  }), React.createElement("input", {
    value: sig.reviewed,
    onChange: e => setSig(s => ({
      ...s,
      reviewed: e.target.value
    })),
    placeholder: "Checked by (name & title)",
    style: {
      ...sel2,
      width: '100%'
    }
  }), React.createElement("input", {
    value: sig.recommended,
    onChange: e => setSig(s => ({
      ...s,
      recommended: e.target.value
    })),
    placeholder: "Recommended by (name & title)",
    style: {
      ...sel2,
      width: '100%'
    }
  }), React.createElement("input", {
    value: sig.approved,
    onChange: e => setSig(s => ({
      ...s,
      approved: e.target.value
    })),
    placeholder: "Approved by (name & title)",
    style: {
      ...sel2,
      width: '100%'
    }
  }), React.createElement("label", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 12,
      color: 'var(--ink-2)'
    }
  }, React.createElement("input", {
    type: "checkbox",
    checked: showSig,
    onChange: e => setShowSig(e.target.checked)
  }), "Signature block on cover page"))), React.createElement("div", null, fieldLabel('Page setup'), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, React.createElement("select", {
    value: pageSize,
    onChange: e => setPageSize(e.target.value),
    style: {
      ...sel2,
      flex: 1
    }
  }, React.createElement("option", null, "A4"), React.createElement("option", null, "A3"), React.createElement("option", null, "Letter")), React.createElement("div", {
    className: "seg"
  }, [['portrait', 'Portrait'], ['landscape', 'Landscape']].map(([id, l]) => React.createElement("button", {
    key: id,
    className: orient === id ? 'on' : '',
    onClick: () => setOrient(id)
  }, l))))), React.createElement("div", null, React.createElement("div", {
    style: {
      fontSize: 11.5,
      fontWeight: 600,
      color: 'var(--ink-2)',
      marginBottom: 7,
      display: 'flex'
    }
  }, "Departments", React.createElement("span", {
    className: "spacer"
  }), React.createElement("button", {
    onClick: () => setSel(sel.length === depts.length ? [] : depts.map(d => d.id)),
    style: {
      border: 0,
      background: 'none',
      color: 'var(--blue)',
      fontSize: 11,
      fontWeight: 600,
      cursor: 'pointer'
    }
  }, sel.length === depts.length ? 'Clear all' : 'Select all')), React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 6
    }
  }, depts.map(d => React.createElement("button", {
    key: d.id,
    onClick: () => toggle(d.id),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      padding: '5px 10px',
      borderRadius: 20,
      fontSize: 11.5,
      fontWeight: 600,
      cursor: 'pointer',
      border: '1px solid ' + (sel.includes(d.id) ? 'var(--blue)' : 'var(--line)'),
      background: sel.includes(d.id) ? 'var(--blue-50)' : '#fff',
      color: sel.includes(d.id) ? 'var(--blue-700)' : 'var(--muted)'
    }
  }, sel.includes(d.id) && React.createElement(Ic, {
    d: I.check,
    s: 12,
    sw: 3
  }), d.short)))), React.createElement("div", {
    style: {
      background: 'var(--panel-2)',
      border: '1px solid var(--line)',
      borderRadius: 8,
      padding: '11px 13px',
      fontSize: 12,
      color: 'var(--muted)'
    }
  }, React.createElement("b", {
    style: {
      color: 'var(--ink)'
    }
  }, chosen.length), " departments \xB7 ", React.createElement("b", {
    style: {
      color: 'var(--ink)'
    }
  }, type), " \xB7 ", pageSize, " ", orient, " \xB7 ", pMonths.length, " month", pMonths.length !== 1 ? 's' : ''))), React.createElement("div", {
    className: "card",
    style: {
      padding: 0,
      overflow: 'hidden'
    }
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, "Live Preview"), React.createElement("span", {
    className: "sub"
  }, pageSize, " \xB7 ", orient), React.createElement("span", {
    className: "spacer"
  }), React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, React.createElement("button", {
    className: "icon-btn",
    style: {
      width: 28,
      height: 28
    },
    disabled: pi <= 0,
    onClick: () => setPageIdx(p => Math.max(0, p - 1))
  }, React.createElement(Ic, {
    d: I.chevR,
    s: 15,
    style: {
      transform: 'rotate(180deg)'
    }
  })), React.createElement("span", {
    className: "tag num"
  }, "Page ", pi + 1, " of ", pages), React.createElement("button", {
    className: "icon-btn",
    style: {
      width: 28,
      height: 28
    },
    disabled: pi >= pages - 1,
    onClick: () => setPageIdx(p => Math.min(pages - 1, p + 1))
  }, React.createElement(Ic, {
    d: I.chevR,
    s: 15
  })))), React.createElement("div", {
    style: {
      padding: 26,
      background: '#eef1f5',
      overflowX: 'auto'
    }
  }, React.createElement("div", {
    style: {
      background: '#fff',
      borderRadius: 4,
      boxShadow: '0 4px 18px rgba(0,0,0,.12)',
      padding: '28px 30px',
      width: pageW,
      minHeight: pageMinH,
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      margin: '0 auto',
      transition: 'width .25s'
    }
  }, chosen.length === 0 ? React.createElement("div", {
    style: {
      textAlign: 'center',
      color: 'var(--faint)',
      padding: '60px 0'
    }
  }, "Select at least one department.") : coverOn && pi === 0 ? React.createElement(CoverPage, {
    n: 1,
    total: pages
  }) : type === 'compare' ? React.createElement(ComparePage, {
    n: pi + 1,
    total: pages
  }) : type === 'board' ? React.createElement(BoardPage, {
    n: pi + 1,
    total: pages
  }) : React.createElement(DeptPage, {
    d: pageDept,
    n: pi + 1,
    total: pages
  }))))));
}
const UCOLORS = ['#0090ca', '#3ab5a7', '#6a52d4', '#e08a1e', '#d23a52', '#1f9d57'];
const USER_MODS = [['stats', 'Hospital Statistics'], ['quality', 'Quality Indicators'], ['supervisor', 'Supervisor Reports'], ['staff', 'Staff Management'], ['datacol', 'Data Collection'], ['reports', 'Reports'], ['users', 'Administration'], ['perf', 'Performance Appraisal'], ['roster', 'Duty Roster'], ['medicine', 'Medicine & Rx']];
const PERM_LEVELS = [['none', 'None'], ['view', 'View'], ['edit', 'Edit'], ['add', 'Add'], ['delete', 'Delete']];
const PERM_RANK = {
  none: 0,
  view: 1,
  edit: 2,
  add: 3,
  delete: 4
};
const PERM_ACTS = [['view', 'View'], ['edit', 'Edit'], ['add', 'Add'], ['delete', 'Delete']];
const PERM_ORDER = ['view', 'edit', 'add', 'delete'];
function levelToActions(lv) {
  const i = ['none', 'view', 'edit', 'add', 'delete'].indexOf(lv);
  return i <= 0 ? [] : PERM_ORDER.slice(0, i);
}
function asActions(v) {
  if (Array.isArray(v)) return PERM_ORDER.filter(a => v.indexOf(a) >= 0);
  return levelToActions(v || 'none');
}
function sameActs(a, b) {
  a = asActions(a);
  b = asActions(b);
  return a.length === b.length && a.every((x, i) => x === b[i]);
}
const ROLE_PRESETS = {
  'Administrator': {
    stats: 'delete',
    quality: 'delete',
    supervisor: 'delete',
    staff: 'delete',
    datacol: 'delete',
    reports: 'delete',
    users: 'delete'
  },
  'Manager': {
    stats: 'edit',
    quality: 'edit',
    supervisor: 'edit',
    staff: 'edit',
    datacol: 'edit',
    reports: 'edit',
    users: 'view'
  },
  'Department Head': {
    stats: 'view',
    quality: 'add',
    supervisor: 'add',
    staff: 'edit',
    datacol: 'add',
    reports: 'view',
    users: 'none'
  },
  'Data Entry': {
    stats: 'view',
    quality: 'add',
    supervisor: 'add',
    staff: 'none',
    datacol: 'add',
    reports: 'view',
    users: 'none'
  },
  'Read-only': {
    stats: 'view',
    quality: 'view',
    supervisor: 'view',
    staff: 'view',
    datacol: 'view',
    reports: 'view',
    users: 'none'
  }
};
const USER_ROLES = Object.keys(ROLE_PRESETS);
const PORTAL_ROLE_LABEL = {
  collector: 'Data Collector',
  incharge: 'In-charge (portal)',
  nurse: 'Nurse (portal)',
  pca: 'PCA (portal)'
};
const portalRoleOfLabel = l => Object.keys(PORTAL_ROLE_LABEL).find(k => PORTAL_ROLE_LABEL[k] === l) || null;
let ROLE_TMPL = null;
let ROLE_TMPL_P = null;
const tmplFallback = () => USER_ROLES.filter(r => r !== 'Administrator').map(r => ({
  id: r.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  name: r,
  description: '',
  perms: ROLE_PRESETS[r],
  builtin: true
}));
function loadRoleTemplates(force) {
  if (!force && ROLE_TMPL) return Promise.resolve(ROLE_TMPL);
  if (!force && ROLE_TMPL_P) return ROLE_TMPL_P;
  ROLE_TMPL_P = usersApi('GET', '/api/roles').then(j => {
    ROLE_TMPL = (j.templates || []).length ? j.templates : tmplFallback();
    ROLE_TMPL_P = null;
    return ROLE_TMPL;
  }).catch(() => {
    ROLE_TMPL = tmplFallback();
    ROLE_TMPL_P = null;
    return ROLE_TMPL;
  });
  return ROLE_TMPL_P;
}
function useRoleTemplates() {
  const [t, setT] = React.useState(ROLE_TMPL);
  React.useEffect(() => {
    let live = true;
    loadRoleTemplates().then(x => {
      if (live) setT(x);
    });
    return () => {
      live = false;
    };
  }, []);
  return t || ROLE_TMPL || tmplFallback();
}
const FULL_PERMS = () => USER_MODS.reduce((m, [k]) => (m[k] = [...PERM_ORDER], m), {});
const NONE_PERMS = () => USER_MODS.reduce((m, [k]) => (m[k] = [], m), {});
const inits = n => (n || '?').split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase();
const detectTemplate = p => {
  for (const r of USER_ROLES) {
    if (r === 'Administrator') continue;
    const pr = ROLE_PRESETS[r];
    if (USER_MODS.every(([k]) => sameActs(p[k], pr[k]))) return r;
  }
  return 'Custom';
};
const permSummary = p => {
  if (!p) return 'No access';
  const acts = USER_MODS.map(([k]) => asActions(p[k]));
  const on = acts.filter(a => a.length).length;
  if (!on) return 'No access';
  if (acts.every(a => a.length === 4)) return 'Full access';
  const ed = acts.filter(a => a.indexOf('edit') >= 0 || a.indexOf('add') >= 0 || a.indexOf('delete') >= 0).length;
  return `${on} module${on !== 1 ? 's' : ''}${ed ? ' · ' + ed + ' editable' : ''}`;
};
function usersApi(method, path, body) {
  return fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'same-origin',
    body: body ? JSON.stringify(body) : undefined
  }).then(async r => {
    let j = null;
    try {
      j = await r.json();
    } catch (e) {}
    if (!r.ok || !j || j.ok === false) {
      throw new Error(j && j.error || (r.status === 401 ? 'Sign in as an administrator to manage users.' : r.status === 403 ? 'Administrator access required.' : 'Request failed (' + r.status + ').'));
    }
    return j;
  });
}
function uToast(m, k) {
  try {
    if (window.UI && window.UI.toast) window.UI.toast(m, k || 'success');
  } catch (e) {}
}
function uCustomAreasOf(r) {
  if (!r) return [];
  if (window.dcCustomAreas) return window.dcCustomAreas(r).slice();
  if (Array.isArray(r.customQualityAreas)) return r.customQualityAreas.slice();
  if (r.allQualityAreas) return [];
  const auto = window.DEPTMAP ? window.DEPTMAP.areasFromDepts(r.departments || []) : [];
  return (r.qualityAreas || []).filter(k => auto.indexOf(k) < 0);
}
const U_NO_RESPS = [];
function UserModal({
  initial,
  onClose,
  onSaved,
  depts
}) {
  const {
    useState
  } = React;
  const editing = !!initial;
  const [username, setUsername] = useState(editing ? initial.username : '');
  const [name, setName] = useState(editing ? initial.name || '' : '');
  const [email, setEmail] = useState(editing ? initial.email || '' : '');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState(editing ? initial.active !== false ? 'active' : 'inactive' : 'active');
  const templates = useRoleTemplates();
  const tmplMatch = pm => {
    const t = templates.find(x => USER_MODS.every(([k]) => sameActs(pm[k], x.perms && x.perms[k])));
    return t ? t.name : 'Custom';
  };
  const initTemplate = editing ? initial.role === 'Administrator' ? 'Administrator' : PORTAL_ROLE_LABEL[initial.role] ? PORTAL_ROLE_LABEL[initial.role] : initial.perms ? tmplMatch(initial.perms) : 'Custom' : 'Custom';
  const [role, setRole] = useState(initTemplate);
  const [roleTmpl, setRoleTmpl] = useState(editing ? initial.roleTemplate || null : null);
  React.useEffect(() => {
    if (editing && initial.perms && role === 'Custom' && templates.length) {
      const m = tmplMatch(initial.perms);
      if (m !== 'Custom') setRole(m);
    }
  }, [templates.length]);
  const [perms, setPerms] = useState(() => {
    if (editing && initial.role === 'Administrator') return FULL_PERMS();
    const src = editing && initial.perms ? {
      ...NONE_PERMS(),
      ...initial.perms
    } : NONE_PERMS();
    return USER_MODS.reduce((m, [k]) => (m[k] = asActions(src[k]), m), {});
  });
  const [staffScope, setStaffScope] = useState(editing ? initial.staffScope || 'all' : 'all');
  const [staffDepts, setStaffDepts] = useState(editing && Array.isArray(initial.departments) ? initial.departments : []);
  const [staffId, setStaffId] = useState(editing && (initial.staffId === 0 || initial.staffId) ? initial.staffId : '');
  const allDepts = React.useMemo(() => {
    try {
      if (window.buildDepts) {
        const ov = JSON.parse(localStorage.getItem('unico_store_v3') || '{}') || {};
        const m = window.buildDepts(ov);
        if (Array.isArray(m) && m.length) return m.map(d => ({
          id: d.id,
          name: d.name
        }));
      }
    } catch (e) {}
    return (window.__UNICO_DEPARTMENTS__ || []).map(d => ({
      id: d.id,
      name: d.name
    }));
  }, []);
  const allStaff = React.useMemo(() => {
    const s = window.STAFF_SEED || window.__UNICO_STAFF__ || [];
    return Array.isArray(s) ? s.slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))) : [];
  }, []);
  const toggleDept = id => setStaffDepts(ds => ds.indexOf(id) >= 0 ? ds.filter(x => x !== id) : [...ds, id]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const isAdmin = role === 'Administrator';
  const portalRole = portalRoleOfLabel(role);
  const isColl = !!portalRole;
  const collects = portalRole === 'collector' || portalRole === 'incharge';
  const scopeInit = !!(editing && (initial.role === 'collector' || initial.role === 'incharge'));
  const scope0 = React.useRef(null);
  if (!scope0.current) scope0.current = {
    departments: scopeInit && Array.isArray(initial.departments) ? initial.departments.slice() : [],
    allQualityAreas: !!(scopeInit && initial.allQualityAreas),
    customQualityAreas: scopeInit ? uCustomAreasOf(initial) : [],
    qualityIndicators: scopeInit && initial.qualityIndicators && typeof initial.qualityIndicators === 'object' ? {
      ...initial.qualityIndicators
    } : {}
  };
  const [scope, setScope] = useState(scope0.current);
  const scopeTouched = React.useRef(false);
  const editScope = v => {
    scopeTouched.current = true;
    setScope(v);
  };
  const scopeBase = React.useRef(null);
  const [resps, setResps] = useState(null);
  const [scopeLoaded, setScopeLoaded] = useState(!editing);
  const [scopeLoadFailed, setScopeLoadFailed] = useState(false);
  const scopeReady = !collects || scopeLoaded;
  React.useEffect(() => {
    if (!collects || resps !== null && scopeLoaded) return;
    let live = true;
    usersApi('GET', '/api/responsibles').then(j => {
      if (!live) return;
      const list = j.responsibles || [];
      setResps(list);
      if (editing && !scopeLoaded && !scopeTouched.current) {
        const u = initial,
          s0 = scope0.current;
        const rec = u.responsibleId && list.find(r => r.id === u.responsibleId) || list.find(r => String(r.empId || '').toLowerCase() === u.username);
        let next = s0;
        if (rec) {
          const recScope = {
            departments: (rec.departments || []).slice(),
            allQualityAreas: !!rec.allQualityAreas,
            customQualityAreas: uCustomAreasOf(rec),
            qualityIndicators: {
              ...(rec.qualityIndicators || {})
            }
          };
          if (!scopeInit) next = recScope;else {
            const empty = !(u.departments || []).length && !u.allQualityAreas && !(u.qualityAreas || []).length && !Object.keys(u.qualityIndicators || {}).length;
            if (empty) next = recScope;else if (!Array.isArray(u.customQualityAreas) && Array.isArray(rec.customQualityAreas)) next = {
              ...s0,
              customQualityAreas: rec.customQualityAreas.slice()
            };
          }
        }
        if (next !== s0) setScope(next);
        scopeBase.current = window.dcScopeBase ? window.dcScopeBase(next) : null;
      }
      setScopeLoaded(true);
    }).catch(() => {
      if (live) {
        setResps(r => r || []);
        if (editing && !scopeInit && !scopeTouched.current) setScopeLoadFailed(true);
        setScopeLoaded(true);
      }
    });
    return () => {
      live = false;
    };
  }, [collects]);
  const linkedRespId = editing ? initial.responsibleId || ((resps || []).find(r => String(r.empId || '').toLowerCase() === initial.username) || {}).id || null : null;
  const ScopeEditor = window.DcScopeEditor;
  const pickRole = r => {
    setRole(r);
    if (r === 'Administrator' || portalRoleOfLabel(r) || r === 'Custom') {
      setRoleTmpl(null);
      return;
    }
    const t = templates.find(x => x.name === r);
    if (t) {
      setRoleTmpl(t.id);
      setPerms(USER_MODS.reduce((m, [k]) => (m[k] = asActions(t.perms && t.perms[k]), m), {}));
    } else if (ROLE_PRESETS[r]) {
      setRoleTmpl(null);
      setPerms(USER_MODS.reduce((m, [k]) => (m[k] = levelToActions(ROLE_PRESETS[r][k] || 'none'), m), {}));
    }
  };
  const toggleAct = (mid, act) => {
    setPerms(p => {
      const cur = asActions(p[mid]);
      let next = cur.indexOf(act) >= 0 ? cur.filter(a => a !== act) : [...cur, act];
      if (next.some(a => a !== 'view') && next.indexOf('view') < 0) next.push('view');
      next = PERM_ORDER.filter(a => next.indexOf(a) >= 0);
      return {
        ...p,
        [mid]: next
      };
    });
    setRole('Custom');
    setRoleTmpl(null);
  };
  const clearMod = mid => {
    setPerms(p => ({
      ...p,
      [mid]: []
    }));
    setRole('Custom');
    setRoleTmpl(null);
  };
  const roleOpts = ['Administrator', ...templates.map(t => t.name), ...Object.values(PORTAL_ROLE_LABEL), 'Custom'];
  const save = async () => {
    setErr('');
    if (!editing) {
      if (!/^[a-z0-9._-]{2,40}$/.test(String(username).trim().toLowerCase())) return setErr('Username: letters, numbers, dot, dash or underscore (2–40 chars).');
      if (password.length < 6) return setErr('Password must be at least 6 characters.');
    }
    if (!name.trim()) return setErr('Full name is required.');
    if (email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setErr('Enter a valid email (or leave it blank).');
    const sendScope = collects && !!ScopeEditor && !!window.dcScopePayload && !scopeLoadFailed;
    if (sendScope && !scopeReady) return setErr('Still loading this account’s data collection scope — try again in a moment.');
    setBusy(true);
    try {
      const backendRole = isAdmin ? 'Administrator' : portalRole || 'User';
      const payload = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        title: isAdmin || isColl ? null : role === 'Custom' ? 'Custom access' : role,
        active: status === 'active',
        perms: isAdmin || isColl ? null : perms,
        roleTemplate: isAdmin || isColl ? null : roleTmpl || null
      };
      if (!editing || backendRole !== (initial.role || 'User')) payload.role = backendRole;
      if (sendScope) {
        const base = scopeBase.current || (window.dcScopeBase ? window.dcScopeBase(scope0.current) : undefined);
        const sp = window.dcScopePayload(scope, base);
        payload.departments = sp.departments;
        payload.allQualityAreas = sp.allQualityAreas;
        payload.customQualityAreas = sp.customQualityAreas;
        payload.qualityIndicators = sp.qualityIndicators;
      }
      if (!isAdmin && !isColl) {
        payload.staffScope = staffScope;
        payload.departments = staffScope === 'departments' ? staffDepts : [];
        payload.staffId = staffScope === 'self' && staffId !== '' ? Number(staffId) : null;
        const rec = allStaff.find(x => String(x.id) === String(staffId));
        payload.staffEmpId = staffScope === 'self' && rec && rec.emp_id ? rec.emp_id : '';
      }
      if (editing) {
        await usersApi('PATCH', '/api/users/' + encodeURIComponent(initial.username), payload);
        if (password) {
          if (password.length < 6) {
            setBusy(false);
            return setErr('New password must be at least 6 characters.');
          }
          await usersApi('POST', '/api/users/' + encodeURIComponent(initial.username) + '/password', {
            password
          });
        }
      } else {
        await usersApi('POST', '/api/users', {
          username: String(username).trim().toLowerCase(),
          password,
          ...payload
        });
      }
      uToast(editing ? 'User updated' : 'User created');
      onSaved();
    } catch (e) {
      setErr(e.message || 'Could not save.');
    } finally {
      setBusy(false);
    }
  };
  const lvlColor = {
    none: 'var(--muted)',
    view: '#0090ca',
    edit: '#3ab5a7',
    add: '#e08a1e',
    delete: '#d23a52'
  };
  const toBody = n => typeof window !== 'undefined' && window.ReactDOM && window.ReactDOM.createPortal && typeof document !== 'undefined' ? window.ReactDOM.createPortal(n, document.body) : n;
  return toBody(React.createElement("div", {
    className: "modal-bg",
    onMouseDown: e => {
      if (e.target === e.currentTarget) onClose();
    }
  }, React.createElement("div", {
    className: "modal",
    style: {
      width: collects ? 'min(720px,94vw)' : 'min(560px,94vw)',
      maxHeight: '92vh',
      overflow: 'auto'
    }
  }, React.createElement("div", {
    className: "modal-h"
  }, editing && window.MK && window.MK.Av ? React.createElement(window.MK.Av, {
    name: initial.name || initial.username,
    emp: initial,
    empId: initial.staffEmpId,
    size: 30,
    radius: 8,
    style: {
      fontSize: 12
    }
  }) : React.createElement("div", {
    style: {
      width: 30,
      height: 30,
      borderRadius: 8,
      background: 'var(--blue-50)',
      color: 'var(--blue)',
      display: 'grid',
      placeItems: 'center'
    }
  }, React.createElement(Ic, {
    d: editing ? I.edit : I.plus,
    s: 17
  })), React.createElement("h3", null, editing ? 'Manage user' : 'Add user'), React.createElement("span", {
    className: "spacer"
  }), React.createElement("button", {
    className: "icon-btn",
    onClick: onClose
  }, React.createElement(Ic, {
    d: I.x,
    s: 16
  }))), React.createElement("div", {
    style: {
      padding: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 12
    }
  }, React.createElement("div", {
    className: "field"
  }, React.createElement("label", null, "Username", editing && React.createElement("span", {
    style: {
      fontWeight: 400,
      color: 'var(--muted)'
    }
  }, " \xB7 fixed")), React.createElement("input", {
    value: username,
    disabled: editing,
    onChange: e => setUsername(e.target.value),
    placeholder: "e.g. j.smith",
    style: editing ? {
      opacity: .6
    } : null,
    autoFocus: !editing
  })), React.createElement("div", {
    className: "field"
  }, React.createElement("label", null, "Full name"), React.createElement("input", {
    value: name,
    onChange: e => setName(e.target.value),
    placeholder: "e.g. Nasif Ahammed Niloy"
  }))), React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 12
    }
  }, React.createElement("div", {
    className: "field"
  }, React.createElement("label", null, "Email ", React.createElement("span", {
    style: {
      fontWeight: 400,
      color: 'var(--muted)'
    }
  }, "\xB7 optional")), React.createElement("input", {
    value: email,
    onChange: e => setEmail(e.target.value),
    placeholder: "name@unicohospitals.com"
  })), React.createElement("div", {
    className: "field"
  }, React.createElement("label", null, editing ? 'Reset password' : 'Password', " ", editing && React.createElement("span", {
    style: {
      fontWeight: 400,
      color: 'var(--muted)'
    }
  }, "\xB7 blank = keep")), React.createElement("input", {
    type: "password",
    value: password,
    onChange: e => setPassword(e.target.value),
    placeholder: "At least 6 characters"
  }))), React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 12
    }
  }, React.createElement("div", {
    className: "field"
  }, React.createElement("label", null, "Role / template"), React.createElement("select", {
    value: role,
    onChange: e => pickRole(e.target.value)
  }, roleOpts.map(r => React.createElement("option", {
    key: r
  }, r)))), React.createElement("div", {
    className: "field"
  }, React.createElement("label", null, "Status"), React.createElement("select", {
    value: status,
    onChange: e => setStatus(e.target.value)
  }, React.createElement("option", {
    value: "active"
  }, "Active"), React.createElement("option", {
    value: "inactive"
  }, "Inactive")))), isAdmin ? React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'var(--ink-2)',
      background: 'var(--blue-50)',
      border: '1px solid var(--blue-100)',
      borderRadius: 9,
      padding: '12px 14px',
      display: 'flex',
      gap: 9,
      alignItems: 'center'
    }
  }, React.createElement(Ic, {
    d: I.check,
    s: 16,
    c: "var(--blue)"
  }), React.createElement("span", null, React.createElement("b", null, "Full access."), " Administrators can view, add, edit and delete in every module.")) : isColl && !collects ? React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'var(--ink-2)',
      background: 'var(--blue-50)',
      border: '1px solid var(--blue-100)',
      borderRadius: 9,
      padding: '12px 14px',
      display: 'flex',
      gap: 9,
      alignItems: 'center'
    }
  }, React.createElement(Ic, {
    d: I.user,
    s: 16,
    c: "var(--blue)"
  }), React.createElement("span", null, React.createElement("b", null, role, "."), " Nurse/PCA accounts sign in to the staff app; they don't submit data.")) : isColl ? React.createElement("div", null, React.createElement("div", {
    style: {
      fontSize: 12.5,
      fontWeight: 700,
      color: 'var(--ink)',
      marginBottom: 3
    }
  }, "Data collection scope ", React.createElement("span", {
    style: {
      fontWeight: 500,
      color: 'var(--muted)',
      fontSize: 11
    }
  }, "\xB7 ", role, " \u2014 signs in to the portal only")), React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: 'var(--muted)',
      marginBottom: 9
    }
  }, "The departments they report, the quality areas those give (plus any extra), and optionally which indicators. Saved with the account and shown in ", React.createElement("b", null, "Indicator Access"), "."), !ScopeEditor ? React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'var(--ink-2)',
      background: 'var(--blue-50)',
      border: '1px solid var(--blue-100)',
      borderRadius: 9,
      padding: '12px 14px'
    }
  }, "The data collection module is not loaded, so the scope cannot be edited here. The current assignment is kept when you save.") : scopeLoadFailed ? React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: '#8a5a00',
      background: '#fff8e9',
      border: '1px solid #f1d49a',
      borderRadius: 9,
      padding: '12px 14px'
    }
  }, "Couldn\u2019t load this account\u2019s current data collection assignment. Close and reopen Manage to edit it \u2014 saving now keeps the stored assignment unchanged.") : !scopeReady ? React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--muted)',
      padding: '8px 0'
    }
  }, "Loading assignment\u2026") : React.createElement(ScopeEditor, {
    value: scope,
    onChange: editScope,
    depts: depts,
    exceptResponsibleId: linkedRespId,
    persons: resps || U_NO_RESPS
  })) : React.createElement("div", null, React.createElement("div", {
    style: {
      fontSize: 12.5,
      fontWeight: 700,
      color: 'var(--ink)',
      marginBottom: 3
    }
  }, "Module permissions ", React.createElement("span", {
    style: {
      fontWeight: 500,
      color: 'var(--muted)',
      fontSize: 11
    }
  }, "\xB7 a template sets defaults; fine-tune per module")), React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: 'var(--muted)',
      marginBottom: 9
    }
  }, "Tick any combination \u2014 ", React.createElement("b", null, "Edit"), ", ", React.createElement("b", null, "Add"), " and ", React.createElement("b", null, "Delete"), " are independent (e.g. grant Delete without Add). Selecting any of them includes View automatically."), React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, USER_MODS.map(([id, label]) => {
    const acts = asActions(perms[id]);
    const none = acts.length === 0;
    return React.createElement("div", {
      key: id,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap'
      }
    }, React.createElement("span", {
      style: {
        flex: '1 1 140px',
        fontSize: 12.5,
        color: 'var(--ink-2)',
        fontWeight: 600
      }
    }, label), React.createElement("div", {
      style: {
        display: 'flex',
        gap: 6,
        flexShrink: 0,
        flexWrap: 'wrap'
      }
    }, React.createElement("button", {
      onClick: () => clearMod(id),
      style: {
        padding: '5px 12px',
        borderRadius: 7,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        border: '1px solid ' + (none ? 'var(--muted)' : 'var(--line)'),
        background: none ? 'var(--panel-2)' : '#fff',
        color: none ? 'var(--ink)' : 'var(--muted)'
      }
    }, "None"), PERM_ACTS.map(([v, l]) => {
      const on = acts.indexOf(v) >= 0;
      const c = lvlColor[v];
      return React.createElement("button", {
        key: v,
        onClick: () => toggleAct(id, v),
        title: v === 'view' ? 'Can open / read' : v === 'edit' ? 'Can modify existing' : v === 'add' ? 'Can create new' : 'Can delete',
        style: {
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 11px',
          borderRadius: 7,
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          border: '1px solid ' + (on ? c : 'var(--line)'),
          background: on ? c : '#fff',
          color: on ? '#fff' : 'var(--ink-2)'
        }
      }, React.createElement("span", {
        style: {
          width: 13,
          height: 13,
          borderRadius: 4,
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
          border: '1px solid ' + (on ? '#fff' : 'var(--line)'),
          background: on ? 'rgba(255,255,255,.25)' : '#fff'
        }
      }, on && React.createElement(Ic, {
        d: I.check,
        s: 9,
        c: "#fff",
        sw: 3
      })), l);
    })));
  }))), !isAdmin && !isColl && React.createElement("div", {
    style: {
      borderTop: '1px solid var(--line-2)',
      paddingTop: 14
    }
  }, React.createElement("div", {
    style: {
      fontSize: 12.5,
      fontWeight: 700,
      color: 'var(--ink)',
      marginBottom: 3
    }
  }, "Staff data access ", React.createElement("span", {
    style: {
      fontWeight: 500,
      color: 'var(--muted)',
      fontSize: 11
    }
  }, "\xB7 whose personnel records this account may open")), React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: 'var(--muted)',
      marginBottom: 9
    }
  }, "Module permissions above decide whether they can open Staff Management at all. This decides ", React.createElement("b", null, "which people"), " they see once inside \u2014 enforced on the server, so it also applies to the raw data the browser receives."), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 7,
      flexWrap: 'wrap',
      marginBottom: staffScope === 'all' ? 0 : 11
    }
  }, [['all', 'All staff', 'Every record in the register'], ['departments', 'Only their departments', 'Just the units picked below'], ['self', 'Only their own record', 'A personal view: their file and nobody else’s']].map(([v, l, tip]) => {
    const on = staffScope === v;
    return React.createElement("button", {
      key: v,
      title: tip,
      onClick: () => setStaffScope(v),
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        padding: '7px 13px',
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        border: '1px solid ' + (on ? 'var(--blue)' : 'var(--line)'),
        background: on ? 'var(--blue)' : '#fff',
        color: on ? '#fff' : 'var(--ink-2)'
      }
    }, React.createElement("span", {
      style: {
        width: 13,
        height: 13,
        borderRadius: '50%',
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
        border: '1px solid ' + (on ? '#fff' : 'var(--line)'),
        background: on ? 'rgba(255,255,255,.25)' : '#fff'
      }
    }, on && React.createElement(Ic, {
      d: I.check,
      s: 9,
      c: "#fff",
      sw: 3
    })), l);
  })), staffScope === 'departments' && React.createElement("div", null, React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--muted)',
      marginBottom: 7
    }
  }, "Departments this account covers ", staffDepts.length ? React.createElement("b", {
    style: {
      color: 'var(--ink-2)'
    }
  }, "\xB7 ", staffDepts.length, " selected") : React.createElement("b", {
    style: {
      color: 'var(--rose)'
    }
  }, "\xB7 none selected = they will see no staff at all")), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      flexWrap: 'wrap',
      maxHeight: 150,
      overflow: 'auto',
      padding: 2
    }
  }, allDepts.map(d => {
    const on = staffDepts.indexOf(d.id) >= 0;
    return React.createElement("button", {
      key: d.id,
      onClick: () => toggleDept(d.id),
      style: {
        padding: '5px 11px',
        borderRadius: 7,
        fontSize: 11.5,
        fontWeight: 600,
        cursor: 'pointer',
        border: '1px solid ' + (on ? 'var(--teal,#3ab5a7)' : 'var(--line)'),
        background: on ? 'var(--teal,#3ab5a7)' : '#fff',
        color: on ? '#fff' : 'var(--ink-2)'
      }
    }, d.name);
  }), !allDepts.length && React.createElement("span", {
    style: {
      fontSize: 11.5,
      color: 'var(--muted)'
    }
  }, "No departments loaded."))), staffScope === 'self' && React.createElement("div", {
    className: "field"
  }, React.createElement("label", null, "Which staff member is this login?"), React.createElement("select", {
    value: staffId === null ? '' : String(staffId),
    onChange: e => setStaffId(e.target.value)
  }, React.createElement("option", {
    value: ""
  }, "\u2014 not linked \u2014"), allStaff.map(x => React.createElement("option", {
    key: x.id,
    value: x.id
  }, x.name, x.emp_id ? ' · ' + x.emp_id : '', x.current_department ? ' · ' + x.current_department : ''))), React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: staffId === '' ? 'var(--rose)' : 'var(--muted)',
      marginTop: 5
    }
  }, staffId === '' ? 'Not linked yet — until you pick a person, this account will see no staff records at all.' : 'They will see this one record and nothing else.'))), err && React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--rose)',
      fontWeight: 600,
      background: 'var(--neg-bg)',
      borderRadius: 7,
      padding: '8px 10px'
    }
  }, err), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      borderTop: '1px solid var(--line-2)',
      paddingTop: 14
    }
  }, React.createElement("span", {
    className: "spacer",
    style: {
      flex: 1
    }
  }), React.createElement("button", {
    className: "btn",
    onClick: onClose
  }, "Cancel"), React.createElement("button", {
    className: "btn pri",
    onClick: save,
    disabled: busy
  }, React.createElement(Ic, {
    d: I.check,
    s: 16,
    sw: 2.4
  }), busy ? 'Saving…' : editing ? 'Save changes' : 'Create user'))))));
}
function uAvatarColor(s) {
  let h = 0;
  for (const ch of s || '') h = h * 31 + ch.charCodeAt(0) >>> 0;
  return UCOLORS[h % UCOLORS.length];
}
function RoleTemplatesPanel() {
  const {
    useState,
    useEffect
  } = React;
  const [list, setList] = useState(null);
  const [counts, setCounts] = useState({});
  const [open, setOpen] = useState(null);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const may = a => {
    try {
      return typeof window.unicoCan !== 'function' || window.unicoCan('users', a);
    } catch (e) {
      return true;
    }
  };
  const load = () => {
    setErr('');
    usersApi('GET', '/api/roles').then(j => {
      setList(j.templates || []);
      setCounts(j.counts || {});
      ROLE_TMPL = j.templates || null;
    }).catch(e => {
      setList([]);
      setErr(e.message || 'Could not load role templates.');
    });
  };
  useEffect(load, []);
  const startEdit = t => {
    setOpen(t.id);
    setDraft({
      name: t.name,
      description: t.description || '',
      perms: USER_MODS.reduce((m, [k]) => (m[k] = asActions(t.perms && t.perms[k]), m), {})
    });
  };
  const startNew = () => {
    setOpen('__new');
    setDraft({
      name: '',
      description: '',
      perms: NONE_PERMS()
    });
  };
  const toggle = (mid, act) => setDraft(d => {
    const cur = asActions(d.perms[mid]);
    let next = cur.indexOf(act) >= 0 ? cur.filter(a => a !== act) : [...cur, act];
    if (next.some(a => a !== 'view') && next.indexOf('view') < 0) next.push('view');
    next = PERM_ORDER.filter(a => next.indexOf(a) >= 0);
    return {
      ...d,
      perms: {
        ...d.perms,
        [mid]: next
      }
    };
  });
  const setAll = v => setDraft(d => ({
    ...d,
    perms: USER_MODS.reduce((m, [k]) => (m[k] = v ? [...PERM_ORDER] : [], m), {})
  }));
  const save = async t => {
    if (!draft) return;
    if (!draft.name.trim()) {
      setErr('Role name is required.');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      if (t) await usersApi('PUT', '/api/roles/' + encodeURIComponent(t.id), draft);else await usersApi('POST', '/api/roles', draft);
      uToast(t ? 'Role “' + draft.name.trim() + '” saved' : 'Role “' + draft.name.trim() + '” created');
      setOpen(null);
      setDraft(null);
      loadRoleTemplates(true);
      load();
    } catch (e) {
      setErr(e.message || 'Could not save the role.');
    } finally {
      setBusy(false);
    }
  };
  const apply = async t => {
    const n = counts[t.id] || 0;
    const ok = await window.UI.confirm({
      title: 'Apply “' + t.name + '” to ' + n + ' account' + (n === 1 ? '' : 's') + '?',
      message: 'Each account stamped with this role gets exactly these permissions, replacing what it holds now. They will be signed out so the change takes effect immediately.',
      confirmLabel: 'Apply to ' + n
    });
    if (!ok) return;
    setBusy(true);
    try {
      const r = await usersApi('POST', '/api/roles/' + encodeURIComponent(t.id) + '/apply');
      uToast('Applied to ' + (r.updated || 0) + ' account' + ((r.updated || 0) === 1 ? '' : 's'));
    } catch (e) {
      uToast(e.message || 'Failed', 'error');
    } finally {
      setBusy(false);
    }
  };
  const del = async t => {
    const n = counts[t.id] || 0;
    const ok = await window.UI.confirm({
      title: 'Delete the role “' + t.name + '”?',
      message: n ? 'It is used by ' + n + ' account' + (n === 1 ? '' : 's') + '. They keep every permission they already have — only the label is removed.' : 'It is not used by any account.',
      danger: true,
      confirmLabel: 'Delete role'
    });
    if (!ok) return;
    try {
      await usersApi('DELETE', '/api/roles/' + encodeURIComponent(t.id));
      uToast('Role removed');
      loadRoleTemplates(true);
      load();
    } catch (e) {
      uToast(e.message || 'Failed', 'error');
    }
  };
  const summary = perms => {
    const acts = USER_MODS.map(([k]) => asActions(perms && perms[k]));
    const on = acts.filter(a => a.length).length;
    if (!on) return 'No access';
    const ed = acts.filter(a => a.length > 1).length;
    return on + ' module' + (on !== 1 ? 's' : '') + (ed ? ' · ' + ed + ' editable' : ' · read-only');
  };
  const matrix = (d, t) => React.createElement("div", {
    style: {
      borderTop: '1px solid var(--line-2)',
      marginTop: 11,
      paddingTop: 12
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      flexWrap: 'wrap',
      marginBottom: 11
    }
  }, React.createElement("input", {
    value: d.name,
    onChange: e => setDraft(x => ({
      ...x,
      name: e.target.value
    })),
    placeholder: "Role name \u2014 e.g. Nurse Manager",
    style: {
      flex: '1 1 210px',
      padding: '9px 11px',
      border: '1px solid var(--line)',
      borderRadius: 7,
      fontSize: 13,
      fontFamily: 'inherit',
      outline: 'none'
    }
  }), React.createElement("input", {
    value: d.description,
    onChange: e => setDraft(x => ({
      ...x,
      description: e.target.value
    })),
    placeholder: "What this role is for (shown to administrators)",
    style: {
      flex: '2 1 300px',
      padding: '9px 11px',
      border: '1px solid var(--line)',
      borderRadius: 7,
      fontSize: 13,
      fontFamily: 'inherit',
      outline: 'none'
    }
  })), React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8
    }
  }, React.createElement("span", {
    style: {
      fontSize: 11,
      color: 'var(--muted)',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: .4
    }
  }, "Module privileges"), React.createElement("span", {
    className: "spacer",
    style: {
      flex: 1
    }
  }), React.createElement("button", {
    className: "btn sm",
    onClick: () => setAll(true)
  }, "Grant all"), React.createElement("button", {
    className: "btn sm",
    onClick: () => setAll(false)
  }, "Clear all")), React.createElement("div", {
    style: {
      border: '1px solid var(--line)',
      borderRadius: 9,
      overflow: 'hidden'
    }
  }, USER_MODS.map(([mid, label], i) => {
    const acts = asActions(d.perms[mid]);
    return React.createElement("div", {
      key: mid,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 11px',
        flexWrap: 'wrap',
        borderTop: i ? '1px solid var(--line-2)' : 0,
        background: acts.length ? 'var(--panel-2)' : 'transparent'
      }
    }, React.createElement("span", {
      style: {
        flex: '1 1 160px',
        fontSize: 12.5,
        fontWeight: 600,
        color: acts.length ? 'var(--ink)' : 'var(--muted)'
      }
    }, label), PERM_ACTS.map(([a, al]) => {
      const on = acts.indexOf(a) >= 0;
      return React.createElement("span", {
        key: a,
        onClick: () => toggle(mid, a),
        style: {
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          borderRadius: 16,
          fontSize: 11.5,
          fontWeight: 600,
          border: '1px solid ' + (on ? 'var(--blue)' : 'var(--line)'),
          background: on ? 'var(--blue-50)' : '#fff',
          color: on ? 'var(--blue-700)' : 'var(--muted)'
        }
      }, React.createElement("span", {
        style: {
          width: 12,
          height: 12,
          borderRadius: 3,
          display: 'grid',
          placeItems: 'center',
          border: '1px solid ' + (on ? 'var(--blue)' : 'var(--line)'),
          background: on ? 'var(--blue)' : '#fff'
        }
      }, on && React.createElement(Ic, {
        d: I.check,
        s: 9,
        c: "#fff"
      })), al);
    }));
  })), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 9,
      marginTop: 12,
      flexWrap: 'wrap'
    }
  }, React.createElement("span", {
    style: {
      fontSize: 11.5,
      color: 'var(--muted)',
      flex: 1,
      minWidth: 180,
      alignSelf: 'center'
    }
  }, "Saving updates the role only. Existing accounts keep their current permissions until you press ", React.createElement("b", null, "Apply to members"), "."), React.createElement("button", {
    className: "btn",
    onClick: () => {
      setOpen(null);
      setDraft(null);
      setErr('');
    }
  }, "Cancel"), React.createElement("button", {
    className: "btn pri",
    disabled: busy,
    onClick: () => save(t)
  }, busy ? 'Saving…' : t ? 'Save role' : 'Create role')));
  return React.createElement("div", {
    style: {
      marginTop: 22,
      borderTop: '1px solid var(--line)',
      paddingTop: 18
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginBottom: 4,
      flexWrap: 'wrap'
    }
  }, React.createElement("div", null, React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 700
    }
  }, "Role templates"), React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--muted)'
    }
  }, "Named privilege sets you can grant in one pick \u2014 Nurse Manager, Ward In-charge, or your own.")), React.createElement("span", {
    className: "spacer",
    style: {
      flex: 1
    }
  }), React.createElement("button", {
    className: "btn sm",
    onClick: load
  }, React.createElement(Ic, {
    d: I.search,
    s: 14
  }), "Refresh"), may('add') && React.createElement("button", {
    className: "btn pri sm",
    onClick: startNew
  }, React.createElement(Ic, {
    d: I.plus,
    s: 14
  }), "Add role")), err && React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: '#b32339',
      background: 'var(--neg-bg)',
      border: '1px solid var(--line)',
      borderRadius: 9,
      padding: '10px 12px',
      margin: '10px 0'
    }
  }, err), open === '__new' && draft && React.createElement("div", {
    style: {
      border: '1px solid var(--blue-100)',
      borderRadius: 10,
      padding: '12px 14px',
      marginTop: 10,
      background: 'var(--blue-50)'
    }
  }, React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: 'var(--blue-700)'
    }
  }, "New role"), matrix(draft, null)), React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      marginTop: 10
    }
  }, list === null && React.createElement("div", {
    style: {
      textAlign: 'center',
      color: 'var(--faint)',
      padding: '18px',
      fontSize: 13
    }
  }, "Loading\u2026"), (list || []).map(t => {
    const n = counts[t.id] || 0;
    const isOpen = open === t.id;
    return React.createElement("div", {
      key: t.id,
      style: {
        border: '1px solid ' + (isOpen ? 'var(--blue-100)' : 'var(--line)'),
        borderRadius: 10,
        padding: '11px 13px'
      }
    }, React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap'
      }
    }, React.createElement("div", {
      style: {
        minWidth: 0,
        flex: '1 1 200px'
      }
    }, React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }
    }, React.createElement("span", {
      style: {
        fontSize: 13.5,
        fontWeight: 700
      }
    }, t.name), t.builtin && React.createElement("span", {
      className: "tag",
      style: {
        background: 'var(--panel-2)',
        color: 'var(--muted)'
      }
    }, "Built-in")), t.description && React.createElement("div", {
      style: {
        fontSize: 11.5,
        color: 'var(--muted)',
        marginTop: 2
      }
    }, t.description)), React.createElement("span", {
      className: "tag",
      style: {
        minWidth: 120,
        justifyContent: 'center',
        color: 'var(--ink-2)'
      }
    }, summary(t.perms)), React.createElement("span", {
      className: "tag",
      style: {
        minWidth: 78,
        justifyContent: 'center'
      }
    }, n, " member", n === 1 ? '' : 's'), may('edit') && React.createElement("button", {
      className: "btn sm",
      onClick: () => isOpen ? (setOpen(null), setDraft(null)) : startEdit(t)
    }, React.createElement(Ic, {
      d: I.edit,
      s: 13
    }), isOpen ? 'Close' : 'Edit'), may('edit') && React.createElement("button", {
      className: "btn sm",
      disabled: !n || busy,
      title: n ? 'Push these permissions onto its members' : 'No account uses this role yet',
      onClick: () => apply(t)
    }, React.createElement(Ic, {
      d: I.check,
      s: 13
    }), "Apply to members"), may('delete') && !t.builtin && React.createElement("button", {
      className: "icon-btn danger",
      title: "Delete role",
      onClick: () => del(t)
    }, React.createElement(Ic, {
      d: I.x,
      s: 14
    }))), isOpen && draft && matrix(draft, t));
  }), list !== null && list.length === 0 && React.createElement("div", {
    style: {
      textAlign: 'center',
      color: 'var(--faint)',
      padding: '18px',
      fontSize: 13
    }
  }, "No role templates yet.")));
}
window.RoleTemplatesPanel = RoleTemplatesPanel;
function UsersAndRoles({
  depts
}) {
  const [sub, setSub] = React.useState(() => {
    const s = typeof window !== 'undefined' && window.__UNICO_USERS_SUBTAB__ || 'accounts';
    try {
      delete window.__UNICO_USERS_SUBTAB__;
    } catch (e) {}
    return s === 'access' ? 'access' : 'accounts';
  });
  const hasDC = typeof DataResponsibles !== 'undefined';
  const TABS = [['accounts', 'Accounts', I.user], ['access', 'Indicator Access', I.check]];
  return React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-b",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      flexWrap: 'wrap'
    }
  }, React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 220
    }
  }, React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      color: 'var(--ink)'
    }
  }, "Users & Roles"), React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--muted)'
    }
  }, "Sign-in accounts and roles. A collector\u2019s or in-charge\u2019s departments, quality areas and indicators are set in their account (Manage).")), React.createElement("div", {
    className: "seg"
  }, TABS.map(([id, l, ic]) => React.createElement("button", {
    key: id,
    className: sub === id ? 'on' : '',
    onClick: () => setSub(id),
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6
    }
  }, React.createElement(Ic, {
    d: ic,
    s: 13
  }), l))))), sub === 'accounts' && React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-b"
  }, React.createElement(UserManagement, {
    depts: depts
  }))), sub === 'access' && (hasDC ? React.createElement(DataResponsibles, {
    key: "access",
    depts: depts,
    embedded: true,
    initialView: "access"
  }) : null));
}
function UserManagement({
  depts
} = {}) {
  const {
    useState,
    useEffect
  } = React;
  const toBody = n => typeof window !== 'undefined' && window.ReactDOM && window.ReactDOM.createPortal && typeof document !== 'undefined' ? window.ReactDOM.createPortal(n, document.body) : n;
  const [users, setUsers] = useState(null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const me = typeof window !== 'undefined' && window.__UNICO_USER__ && window.__UNICO_USER__.username || null;
  const load = () => {
    setErr('');
    usersApi('GET', '/api/users').then(j => setUsers(j.users || [])).catch(e => {
      setUsers([]);
      setErr(e.message || 'Could not load users.');
    });
  };
  useEffect(load, []);
  const all = users || [];
  const admins = all.filter(u => u.role === 'Administrator' && u.active !== false).length;
  const filtered = all.filter(u => !q || `${u.name} ${u.username} ${u.email || ''} ${u.title || u.role}`.toLowerCase().includes(q.toLowerCase()));
  const toggle = async u => {
    try {
      await usersApi('PATCH', '/api/users/' + encodeURIComponent(u.username), {
        active: u.active === false
      });
      uToast(u.active === false ? 'Activated' : 'Deactivated');
      load();
    } catch (e) {
      uToast(e.message || 'Failed', 'error');
    }
  };
  const del = async u => {
    try {
      await usersApi('DELETE', '/api/users/' + encodeURIComponent(u.username));
      uToast('User removed');
      setConfirm(null);
      load();
    } catch (e) {
      uToast(e.message || 'Failed', 'error');
      setConfirm(null);
    }
  };
  const may = a => {
    try {
      return typeof window.unicoCan !== 'function' || window.unicoCan('users', a);
    } catch (e) {
      return true;
    }
  };
  const mayAdd = may('add'),
    mayEdit = may('edit'),
    mayDel = may('delete');
  const roleLabel = u => u.role === 'Administrator' ? 'Administrator' : PORTAL_ROLE_LABEL[u.role] || u.title || 'User';
  const staffScopeLabel = u => {
    const sc = u.staffScope || 'all';
    if (sc === 'self') return 'own record only';
    if (sc === 'departments') return (u.departments && u.departments.length ? u.departments.length + ' dept' : 'no dept') + ' staff';
    return '';
  };
  const summaryOf = u => {
    if (u.role === 'Administrator') return 'Full access';
    if (PORTAL_ROLE_LABEL[u.role]) return u.role === 'collector' ? 'Data collection' : 'Portal';
    const base = permSummary(u.perms);
    const sc = staffScopeLabel(u);
    return sc && base !== 'No access' ? base + ' · ' + sc : base;
  };
  const scopeLine = u => {
    if (!PORTAL_ROLE_LABEL[u.role]) return '';
    const DM = window.DEPTMAP;
    const ds = (u.departments || []).map(id => (DM ? DM.nameFromId(id) : id) || id);
    const dPart = !ds.length ? 'No department' : ds.length <= 2 ? ds.join(', ') : ds.slice(0, 2).join(', ') + ' +' + (ds.length - 2);
    const na = (u.qualityAreas || []).length;
    const aPart = u.allQualityAreas ? 'all areas' : na + ' area' + (na !== 1 ? 's' : '');
    const qi = u.qualityIndicators || {};
    const ni = Object.keys(qi).reduce((s, k) => s + (Array.isArray(qi[k]) ? qi[k].length : 0), 0);
    return [dPart, aPart, ni ? ni + ' indicator' + (ni !== 1 ? 's' : '') + ' limited' : ''].filter(Boolean).join(' · ');
  };
  return React.createElement("div", null, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginBottom: 14,
      flexWrap: 'wrap'
    }
  }, React.createElement("div", null, React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 700
    }
  }, "Accounts"), React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--muted)'
    }
  }, all.length, " user", all.length !== 1 ? 's' : '', " \xB7 ", admins, " administrator", admins !== 1 ? 's' : '')), React.createElement("span", {
    className: "spacer",
    style: {
      flex: 1
    }
  }), React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      background: 'var(--panel-2)',
      border: '1px solid var(--line)',
      borderRadius: 7,
      padding: '6px 10px',
      width: 190,
      color: 'var(--faint)'
    }
  }, React.createElement(Ic, {
    d: I.search,
    s: 14
  }), React.createElement("input", {
    placeholder: "Search users\u2026",
    value: q,
    onChange: e => setQ(e.target.value),
    style: {
      border: 0,
      background: 'transparent',
      outline: 'none',
      fontFamily: 'inherit',
      fontSize: 12.5,
      color: 'var(--ink)',
      width: '100%'
    }
  })), React.createElement("button", {
    className: "btn sm",
    onClick: load
  }, React.createElement(Ic, {
    d: I.search,
    s: 14
  }), "Refresh"), mayAdd && React.createElement("button", {
    className: "btn pri sm",
    onClick: () => setModal({
      user: null
    })
  }, React.createElement(Ic, {
    d: I.plus,
    s: 14
  }), "Add user")), err && React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: '#b32339',
      background: 'var(--neg-bg)',
      border: '1px solid var(--line)',
      borderRadius: 9,
      padding: '11px 13px',
      marginBottom: 12
    }
  }, err, String(err).toLowerCase().includes('administrator') ? '' : ' · Is the server running with a database connection?'), React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, users === null && React.createElement("div", {
    style: {
      textAlign: 'center',
      color: 'var(--faint)',
      padding: '24px',
      fontSize: 13
    }
  }, "Loading\u2026"), users !== null && filtered.map(u => {
    const active = u.active !== false;
    const isMe = me && u.username === me;
    const isColl = u.role === 'collector';
    const lastAdmin = u.role === 'Administrator' && u.active !== false && admins <= 1;
    return React.createElement("div", {
      key: u.username,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '11px 13px',
        border: '1px solid var(--line)',
        borderRadius: 10,
        opacity: active ? 1 : .6,
        flexWrap: 'wrap'
      }
    }, window.MK && window.MK.Av ? React.createElement(window.MK.Av, {
      name: u.name,
      emp: u,
      empId: u.staffEmpId,
      size: 38,
      radius: 9,
      style: {
        fontSize: 14
      }
    }) : React.createElement("div", {
      className: "avatar",
      style: {
        background: uAvatarColor(u.username),
        width: 38,
        height: 38
      }
    }, inits(u.name)), React.createElement("div", {
      style: {
        minWidth: 0,
        flex: '1 1 180px'
      }
    }, React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }
    }, React.createElement("span", {
      style: {
        fontSize: 13.5,
        fontWeight: 700
      }
    }, u.name), isMe && React.createElement("span", {
      className: "tag",
      style: {
        background: 'var(--pos-bg)',
        color: 'var(--pos)'
      }
    }, "You")), React.createElement("div", {
      style: {
        fontSize: 11.5,
        color: 'var(--muted)'
      }
    }, "@", u.username, u.email ? ' · ' + u.email : ''), scopeLine(u) && React.createElement("div", {
      style: {
        fontSize: 11,
        color: 'var(--ink-2)',
        marginTop: 2
      },
      title: "Data collection scope (edit in Manage)"
    }, scopeLine(u))), React.createElement("span", {
      className: "tag",
      style: {
        minWidth: 96,
        justifyContent: 'center'
      }
    }, roleLabel(u)), React.createElement("span", {
      className: "tag",
      style: {
        minWidth: 96,
        justifyContent: 'center',
        color: 'var(--ink-2)'
      }
    }, summaryOf(u)), active ? React.createElement("span", {
      className: "chip pos"
    }, "\u25CF Active") : React.createElement("span", {
      className: "chip flat"
    }, "\u25CB Inactive"), mayEdit && React.createElement("button", {
      className: "btn sm",
      onClick: () => setModal({
        user: u
      })
    }, "Manage"), mayEdit && React.createElement("button", {
      className: "icon-btn",
      title: active ? 'Deactivate' : 'Activate',
      onClick: () => toggle(u),
      disabled: isMe || lastAdmin
    }, React.createElement(Ic, {
      d: active ? I.x : I.check,
      s: 14
    })), mayDel && React.createElement("button", {
      className: "icon-btn danger",
      title: "Remove",
      onClick: () => setConfirm(u),
      disabled: isMe || lastAdmin
    }, React.createElement(Ic, {
      d: I.x,
      s: 14
    })));
  }), users !== null && filtered.length === 0 && React.createElement("div", {
    style: {
      textAlign: 'center',
      color: 'var(--faint)',
      padding: '24px',
      fontSize: 13
    }
  }, "No users", q ? ' match the search' : ' yet', ".")), React.createElement(RoleTemplatesPanel, null), modal && React.createElement(UserModal, {
    initial: modal.user,
    depts: depts,
    onClose: () => setModal(null),
    onSaved: () => {
      setModal(null);
      load();
    }
  }), confirm && toBody(React.createElement("div", {
    className: "modal-bg",
    onMouseDown: e => {
      if (e.target === e.currentTarget) setConfirm(null);
    }
  }, React.createElement("div", {
    className: "modal",
    style: {
      width: 'min(400px,92vw)'
    }
  }, React.createElement("div", {
    style: {
      padding: '22px'
    }
  }, React.createElement("div", {
    style: {
      fontSize: 15.5,
      fontWeight: 700
    }
  }, "Remove ", confirm.name, "?"), React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--muted)',
      marginTop: 4
    }
  }, "Permanently deletes the account \u201C@", confirm.username, "\u201D and revokes all access."), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      marginTop: 18
    }
  }, React.createElement("span", {
    className: "spacer",
    style: {
      flex: 1
    }
  }), React.createElement("button", {
    className: "btn",
    onClick: () => setConfirm(null)
  }, "Cancel"), React.createElement("button", {
    className: "btn pri",
    style: {
      background: 'var(--rose)',
      borderColor: 'var(--rose)'
    },
    onClick: () => del(confirm)
  }, "Remove")))))));
}
window.UserManagement = UserManagement;
function StaffFieldsSettings({
  depts,
  setRoute
}) {
  const S = window.STAFF || {};
  const [, force] = React.useState(0);
  const rerender = () => force(x => x + 1);
  const [draft, setDraft] = React.useState({
    qualifications: '',
    designations: ''
  });
  const add = kind => {
    const v = (draft[kind] || '').trim();
    if (!v) return;
    if (S.addFieldOpt && S.addFieldOpt(kind, v)) {
      window.UI && window.UI.toast('Added “' + v + '”', 'success');
    } else {
      window.UI && window.UI.toast('That option already exists', 'warn');
    }
    setDraft(s => ({
      ...s,
      [kind]: ''
    }));
    rerender();
  };
  const del = (kind, v) => {
    S.removeFieldOpt && S.removeFieldOpt(kind, v);
    rerender();
  };
  const chip = (label, removable, onDel) => React.createElement("span", {
    key: label,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '5px 10px',
      borderRadius: 16,
      fontSize: 12,
      fontWeight: 600,
      background: removable ? 'var(--blue-50)' : 'var(--panel-2)',
      color: removable ? 'var(--blue-700)' : 'var(--muted)',
      border: '1px solid ' + (removable ? 'var(--blue-100)' : 'var(--line)')
    }
  }, label, removable && React.createElement("span", {
    onClick: onDel,
    title: "Remove",
    style: {
      display: 'inline-grid',
      placeItems: 'center',
      cursor: 'pointer',
      opacity: .7
    }
  }, React.createElement(Ic, {
    d: I.x,
    s: 11,
    sw: 2.4
  })));
  const group = (kind, title, sub, base) => {
    const custom = S.fieldOptList && S.fieldOptList(kind) || [];
    return React.createElement("div", {
      style: {
        padding: '16px 0',
        borderBottom: '1px solid var(--line-2)'
      }
    }, React.createElement("div", {
      style: {
        fontSize: 13,
        fontWeight: 700,
        color: 'var(--ink)'
      }
    }, title), React.createElement("div", {
      style: {
        fontSize: 11.5,
        color: 'var(--muted)',
        marginBottom: 10
      }
    }, sub), React.createElement("div", {
      style: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: 7,
        marginBottom: 10
      }
    }, base.map(o => chip(o, false)), custom.map(o => chip(o, true, () => del(kind, o))), base.length + custom.length === 0 && React.createElement("span", {
      style: {
        fontSize: 12,
        color: 'var(--faint)'
      }
    }, "No options yet.")), React.createElement("div", {
      style: {
        display: 'flex',
        gap: 8,
        maxWidth: 460
      }
    }, React.createElement("input", {
      value: draft[kind] || '',
      onChange: e => setDraft(s => ({
        ...s,
        [kind]: e.target.value
      })),
      onKeyDown: e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          add(kind);
        }
      },
      placeholder: 'Add a new ' + title.toLowerCase() + '…',
      style: {
        flex: 1,
        padding: '9px 11px',
        border: '1px solid var(--line)',
        borderRadius: 7,
        fontFamily: 'inherit',
        fontSize: 13,
        outline: 'none'
      }
    }), React.createElement("button", {
      className: "btn pri sm",
      onClick: () => add(kind),
      disabled: !(draft[kind] || '').trim()
    }, React.createElement(Ic, {
      d: I.plus,
      s: 14
    }), "Add")), custom.length > 0 && React.createElement("div", {
      style: {
        fontSize: 11,
        color: 'var(--muted)',
        marginTop: 8
      }
    }, "Built-in options are shown in grey and can\u2019t be removed; your added options are blue and removable."));
  };
  const deptNames = depts && depts.length ? depts.map(d => d.name || d).filter(Boolean) : [];
  const cfs = S.customFields && S.customFields() || [];
  const [nf, setNf] = React.useState({
    name: '',
    kind: 'single'
  });
  const [cfDraft, setCfDraft] = React.useState({});
  const addField = () => {
    const n = (nf.name || '').trim();
    if (!n) return;
    S.addCustomField && S.addCustomField(n, nf.kind);
    setNf({
      name: '',
      kind: 'single'
    });
    rerender();
    window.UI && window.UI.toast('Field “' + n + '” added', 'success');
  };
  const kindLabel = {
    single: 'Single-select',
    multi: 'Multi-select',
    text: 'Free text'
  };
  return React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-b"
  }, React.createElement("div", {
    style: {
      fontSize: 13.5,
      fontWeight: 700,
      color: 'var(--ink)',
      marginBottom: 2
    }
  }, "Staff form fields"), React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--muted)',
      marginBottom: 6
    }
  }, "These lists populate the dropdowns in Add / Edit Staff. Add your own values below; they appear instantly in the form."), group('qualifications', 'Education / Qualification', 'Degrees & diplomas offered in the Qualification picker.', S.QUALIFICATIONS || []), group('designations', 'Designation', 'Job titles offered in the Designation picker.', S.DESIGNATIONS || []), React.createElement("div", {
    style: {
      padding: '16px 0',
      borderBottom: '1px solid var(--line-2)'
    }
  }, React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: 'var(--ink)'
    }
  }, "Department"), React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--muted)',
      marginBottom: 10
    }
  }, "Departments come automatically from the ", React.createElement("b", null, "Statistics"), " module \u2014 ", deptNames.length, " in use. Add or rename them in Departments and they update here."), React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 7,
      marginBottom: 10
    }
  }, deptNames.length ? deptNames.map(d => chip(d, false)) : React.createElement("span", {
    style: {
      fontSize: 12,
      color: 'var(--faint)'
    }
  }, "No statistics departments loaded.")), setRoute && React.createElement("button", {
    className: "btn sm",
    onClick: () => setRoute({
      view: 'qualityDeptManage'
    })
  }, React.createElement(Ic, {
    d: I.layers,
    s: 14
  }), "Manage departments")), React.createElement("div", {
    style: {
      padding: '16px 0'
    }
  }, React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: 'var(--ink)'
    }
  }, "Custom fields"), React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--muted)',
      marginBottom: 12
    }
  }, "Create your own fields (e.g. Shift, Unit Type, Certification). Each one appears in the Add / Edit Staff form."), React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, cfs.map(f => {
    const custom = Array.isArray(f.options) ? f.options : [];
    const dkey = 'opt_' + f.id;
    return React.createElement("div", {
      key: f.id,
      style: {
        border: '1px solid var(--line)',
        borderRadius: 9,
        padding: '12px 14px'
      }
    }, React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: custom.length || f.kind !== 'text' ? 8 : 0
      }
    }, React.createElement("b", {
      style: {
        fontSize: 13,
        color: 'var(--ink)'
      }
    }, f.name), React.createElement("span", {
      className: "tag",
      style: {
        background: 'var(--panel-2)',
        color: 'var(--muted)'
      }
    }, kindLabel[f.kind] || f.kind), React.createElement("span", {
      className: "spacer",
      style: {
        flex: 1
      }
    }), React.createElement("button", {
      className: "btn sm",
      onClick: () => {
        const nn = prompt('Rename field', f.name);
        if (nn && nn.trim()) {
          S.renameCustomField(f.id, nn.trim());
          rerender();
        }
      }
    }, React.createElement(Ic, {
      d: I.edit,
      s: 13
    }), "Rename"), React.createElement("button", {
      className: "btn sm",
      style: {
        color: 'var(--rose)',
        borderColor: '#f1c6cd'
      },
      onClick: async () => {
        const ok = await window.UI.confirm({
          title: `Delete field “${f.name}”?`,
          message: 'Removes it from the staff form. Values already saved on staff records are kept but hidden.',
          danger: true,
          confirmLabel: 'Delete field'
        });
        if (ok) {
          S.removeCustomField(f.id);
          rerender();
        }
      }
    }, React.createElement(Ic, {
      d: I.x,
      s: 13
    }), "Delete")), f.kind !== 'text' && React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: 7,
        marginBottom: 9
      }
    }, custom.length ? custom.map(o => chip(o, true, () => {
      S.removeCustomFieldOption(f.id, o);
      rerender();
    })) : React.createElement("span", {
      style: {
        fontSize: 12,
        color: 'var(--faint)'
      }
    }, "No options yet.")), React.createElement("div", {
      style: {
        display: 'flex',
        gap: 8,
        maxWidth: 460
      }
    }, React.createElement("input", {
      value: cfDraft[dkey] || '',
      onChange: e => setCfDraft(s => ({
        ...s,
        [dkey]: e.target.value
      })),
      onKeyDown: e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const v = (cfDraft[dkey] || '').trim();
          if (v) {
            S.addCustomFieldOption(f.id, v);
            setCfDraft(s => ({
              ...s,
              [dkey]: ''
            }));
            rerender();
          }
        }
      },
      placeholder: 'Add an option to ' + f.name + '…',
      style: {
        flex: 1,
        padding: '9px 11px',
        border: '1px solid var(--line)',
        borderRadius: 7,
        fontFamily: 'inherit',
        fontSize: 13,
        outline: 'none'
      }
    }), React.createElement("button", {
      className: "btn pri sm",
      onClick: () => {
        const v = (cfDraft[dkey] || '').trim();
        if (v) {
          S.addCustomFieldOption(f.id, v);
          setCfDraft(s => ({
            ...s,
            [dkey]: ''
          }));
          rerender();
        }
      },
      disabled: !(cfDraft[dkey] || '').trim()
    }, React.createElement(Ic, {
      d: I.plus,
      s: 14
    }), "Add"))), f.kind === 'text' && React.createElement("div", {
      style: {
        fontSize: 11.5,
        color: 'var(--muted)'
      }
    }, "Free-text field \u2014 staff type any value in the form."));
  }), cfs.length === 0 && React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--faint)'
    }
  }, "No custom fields yet.")), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      alignItems: 'center',
      marginTop: 14,
      flexWrap: 'wrap'
    }
  }, React.createElement("input", {
    value: nf.name,
    onChange: e => setNf(s => ({
      ...s,
      name: e.target.value
    })),
    onKeyDown: e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addField();
      }
    },
    placeholder: "New field name \u2014 e.g. Shift, Unit Type, Certification",
    style: {
      flex: '1 1 240px',
      padding: '9px 11px',
      border: '1px solid var(--line)',
      borderRadius: 7,
      fontFamily: 'inherit',
      fontSize: 13,
      outline: 'none'
    }
  }), React.createElement("select", {
    value: nf.kind,
    onChange: e => setNf(s => ({
      ...s,
      kind: e.target.value
    })),
    style: {
      padding: '9px 11px',
      border: '1px solid var(--line)',
      borderRadius: 7,
      fontFamily: 'inherit',
      fontSize: 13,
      background: '#fff'
    }
  }, React.createElement("option", {
    value: "single"
  }, "Single-select"), React.createElement("option", {
    value: "multi"
  }, "Multi-select"), React.createElement("option", {
    value: "text"
  }, "Free text")), React.createElement("button", {
    className: "btn pri",
    onClick: addField,
    disabled: !nf.name.trim()
  }, React.createElement(Ic, {
    d: I.plus,
    s: 15
  }), "Add field")))));
}
function ActivityLog() {
  const [rows, setRows] = React.useState(null);
  const [err, setErr] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [q, setQ] = React.useState('');
  const load = React.useCallback(() => {
    setBusy(true);
    setErr('');
    fetch('/api/activity?limit=5000&days=92', {
      credentials: 'same-origin'
    }).then(r => r.json()).then(j => {
      if (j && j.ok) setRows(j.entries || []);else setErr(j && j.error || 'Could not load the activity log.');
    }).catch(() => setErr('Could not reach the server.')).finally(() => setBusy(false));
  }, []);
  React.useEffect(() => {
    load();
  }, [load]);
  const clear = async () => {
    const ok = await window.UI.confirm({
      title: 'Clear the activity log?',
      message: 'Permanently removes every recorded event. This cannot be undone.',
      danger: true,
      confirmLabel: 'Clear log'
    });
    if (!ok) return;
    fetch('/api/activity', {
      method: 'DELETE',
      credentials: 'same-origin'
    }).then(r => r.json()).then(() => {
      load();
      window.UI && window.UI.toast('Activity log cleared', 'success');
    }).catch(() => {});
  };
  const META = {
    login: {
      l: 'Signed in',
      c: '#1f9d57'
    },
    login_failed: {
      l: 'Failed sign-in',
      c: '#d23a52'
    },
    logout: {
      l: 'Signed out',
      c: '#6a52d4'
    },
    user_created: {
      l: 'User created',
      c: '#0090ca'
    },
    user_updated: {
      l: 'User updated',
      c: '#e08a1e'
    },
    user_deleted: {
      l: 'User deleted',
      c: '#d23a52'
    },
    password_reset: {
      l: 'Password reset',
      c: '#e08a1e'
    },
    activity_cleared: {
      l: 'Log cleared',
      c: '#8a93a3'
    },
    db_row_updated: {
      l: 'Database row edited',
      c: '#e08a1e'
    },
    db_row_deleted: {
      l: 'Database row deleted',
      c: '#d23a52'
    },
    media_deleted: {
      l: 'File deleted',
      c: '#d23a52'
    },
    app_data_saved: {
      l: 'Data saved',
      c: '#0090ca'
    },
    profile_updated: {
      l: 'Profile updated',
      c: '#0090ca'
    },
    password_changed: {
      l: 'Password changed',
      c: '#e08a1e'
    },
    password_changed_self: {
      l: 'Password changed',
      c: '#e08a1e'
    },
    photo_upload: {
      l: 'Photo uploaded',
      c: '#3ab5a7'
    },
    photo_delete: {
      l: 'Photo deleted',
      c: '#d23a52'
    },
    roster_saved: {
      l: 'Duty roster saved',
      c: '#1f9d57'
    },
    roster_deleted: {
      l: 'Duty roster deleted',
      c: '#d23a52'
    },
    submission_sent: {
      l: 'Submission sent',
      c: '#0090ca'
    },
    staff_request: {
      l: 'Staff change request',
      c: '#e08a1e'
    },
    performance_saved: {
      l: 'Performance saved',
      c: '#6a52d4'
    },
    quality_saved: {
      l: 'Quality data saved',
      c: '#3ab5a7'
    },
    user_account_changed: {
      l: 'User account changed',
      c: '#e08a1e'
    },
    user_account_deleted: {
      l: 'User account deleted',
      c: '#d23a52'
    },
    departments_changed: {
      l: 'Departments changed',
      c: '#e08a1e'
    },
    medicine_changed: {
      l: 'Medicine data changed',
      c: '#6a52d4'
    },
    supervisor_report_saved: {
      l: 'Supervisor report saved',
      c: '#0090ca'
    },
    role_template_created: {
      l: 'Role created',
      c: '#0090ca'
    },
    role_template_updated: {
      l: 'Role updated',
      c: '#e08a1e'
    },
    role_template_deleted: {
      l: 'Role deleted',
      c: '#d23a52'
    },
    role_template_applied: {
      l: 'Role applied to members',
      c: '#6a52d4'
    }
  };
  const meta = a => META[a] || {
    l: a,
    c: '#8a93a3'
  };
  const fmtTs = ts => {
    try {
      return new Date(ts).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return '';
    }
  };
  const filtered = (rows || []).filter(r => {
    if (!q.trim()) return true;
    const s = (r.username + ' ' + r.name + ' ' + meta(r.action).l + ' ' + r.target + ' ' + r.detail + ' ' + r.ip).toLowerCase();
    return s.includes(q.trim().toLowerCase());
  });
  const cell = {
    padding: '9px 12px',
    fontSize: 12.5,
    borderBottom: '1px solid var(--line-2)',
    textAlign: 'left',
    verticalAlign: 'top'
  };
  return React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-b"
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      flexWrap: 'wrap',
      marginBottom: 12
    }
  }, React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 160
    }
  }, React.createElement("div", {
    style: {
      fontSize: 13.5,
      fontWeight: 700,
      color: 'var(--ink)'
    }
  }, "Activity log"), React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--muted)'
    }
  }, "Every sign-in and change across the platform \xB7 last 3 months", rows && rows.length ? ` · ${rows.length} events since ${new Date(rows[rows.length - 1].ts).toLocaleDateString([], {
    month: 'short',
    day: 'numeric'
  })}` : '', ".")), React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      background: '#fff',
      border: '1px solid var(--line)',
      borderRadius: 7,
      padding: '7px 10px',
      minWidth: 200,
      color: 'var(--faint)'
    }
  }, React.createElement(Ic, {
    d: I.search,
    s: 14
  }), React.createElement("input", {
    value: q,
    onChange: e => setQ(e.target.value),
    placeholder: "Search user / action / IP\u2026",
    style: {
      border: 0,
      outline: 'none',
      background: 'transparent',
      fontSize: 12.5,
      fontFamily: 'inherit',
      color: 'var(--ink)',
      width: '100%'
    }
  })), React.createElement("button", {
    className: "btn sm",
    onClick: load,
    disabled: busy
  }, React.createElement(Ic, {
    d: I.activity,
    s: 14
  }), busy ? 'Loading…' : 'Refresh'), React.createElement("button", {
    className: "btn sm",
    style: {
      color: 'var(--rose)',
      borderColor: '#f1c6cd'
    },
    onClick: clear
  }, React.createElement(Ic, {
    d: I.x,
    s: 14
  }), "Clear")), err && React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'var(--rose)',
      fontWeight: 600,
      background: 'var(--neg-bg)',
      borderRadius: 7,
      padding: '9px 11px'
    }
  }, err), !err && rows && rows.length === 0 && React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'var(--faint)',
      padding: '22px',
      textAlign: 'center'
    }
  }, "No activity recorded yet."), !err && rows && rows.length > 0 && React.createElement("div", {
    style: {
      overflowX: 'auto',
      border: '1px solid var(--line-2)',
      borderRadius: 9
    }
  }, React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse'
    }
  }, React.createElement("thead", null, React.createElement("tr", {
    style: {
      background: 'var(--panel-2)'
    }
  }, ['When', 'User', 'Action', 'Details', 'IP'].map(h => React.createElement("th", {
    key: h,
    style: {
      ...cell,
      fontSize: 10.5,
      textTransform: 'uppercase',
      letterSpacing: .4,
      color: 'var(--muted)',
      fontWeight: 700,
      borderBottom: '1px solid var(--line)'
    }
  }, h)))), React.createElement("tbody", null, filtered.map((r, i) => {
    const m = meta(r.action);
    const day = ts => {
      try {
        return new Date(ts).toDateString();
      } catch (e) {
        return '';
      }
    };
    const newDay = i === 0 || day(r.ts) !== day(filtered[i - 1].ts);
    const dayLabel = (() => {
      try {
        return new Date(r.ts).toLocaleDateString([], {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric'
        });
      } catch (e) {
        return '';
      }
    })();
    return React.createElement(React.Fragment, {
      key: i
    }, newDay && React.createElement("tr", null, React.createElement("td", {
      colSpan: 5,
      style: {
        ...cell,
        padding: '7px 12px',
        background: 'var(--panel-2)',
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: .5,
        textTransform: 'uppercase',
        color: 'var(--muted)'
      }
    }, dayLabel)), React.createElement("tr", null, React.createElement("td", {
      style: {
        ...cell,
        whiteSpace: 'nowrap',
        color: 'var(--muted)',
        fontFamily: 'IBM Plex Mono'
      }
    }, fmtTs(r.ts)), React.createElement("td", {
      style: {
        ...cell
      }
    }, React.createElement("div", {
      style: {
        fontWeight: 600,
        color: 'var(--ink)'
      }
    }, r.name || r.username || '—'), r.username && r.name && React.createElement("div", {
      style: {
        fontSize: 10.5,
        color: 'var(--faint)'
      }
    }, "@", r.username)), React.createElement("td", {
      style: {
        ...cell,
        whiteSpace: 'nowrap'
      }
    }, React.createElement("span", {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 11.5,
        fontWeight: 700,
        color: m.c
      }
    }, React.createElement("i", {
      style: {
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: m.c
      }
    }), m.l)), React.createElement("td", {
      style: {
        ...cell,
        color: 'var(--ink-2)'
      }
    }, r.target ? React.createElement("b", null, r.target) : '', r.target && r.detail ? ' — ' : '', r.detail || (!r.target ? '—' : '')), React.createElement("td", {
      style: {
        ...cell,
        whiteSpace: 'nowrap',
        color: 'var(--muted)',
        fontFamily: 'IBM Plex Mono'
      }
    }, r.ip || '—')));
  }), filtered.length === 0 && React.createElement("tr", null, React.createElement("td", {
    colSpan: 5,
    style: {
      ...cell,
      textAlign: 'center',
      color: 'var(--faint)'
    }
  }, "No events match \u201C", q, "\u201D."))))), !err && !rows && React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'var(--faint)',
      padding: '22px',
      textAlign: 'center'
    }
  }, "Loading\u2026")));
}
function CacheStats() {
  const [d, setD] = React.useState(null);
  const [err, setErr] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const load = React.useCallback(() => {
    setBusy(true);
    setErr('');
    fetch('/api/cache/stats', {
      credentials: 'same-origin'
    }).then(r => r.json()).then(j => {
      if (j && j.ok) setD(j);else setErr(j && j.error || 'Could not load cache stats.');
    }).catch(() => setErr('Could not reach the server.')).finally(() => setBusy(false));
  }, []);
  React.useEffect(() => {
    load();
  }, [load]);
  const tile = (label, val, sub, color) => React.createElement("div", {
    key: label,
    style: {
      background: 'var(--panel-2)',
      borderRadius: 9,
      padding: '10px 13px',
      minWidth: 110,
      flex: '1 1 110px'
    }
  }, React.createElement("div", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: .5,
      textTransform: 'uppercase',
      color: 'var(--muted)'
    }
  }, label), React.createElement("div", {
    className: "num",
    style: {
      fontSize: 21,
      fontWeight: 800,
      color: color || 'var(--ink)',
      marginTop: 2
    }
  }, val), sub && React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: 'var(--faint)',
      marginTop: 1
    }
  }, sub));
  const c = d && d.cache,
    r = d && d.redis;
  const redisLive = r && r.driver === 'rest' && r.live !== 'memory';
  return React.createElement("div", {
    className: "card",
    style: {
      marginBottom: 14
    }
  }, React.createElement("div", {
    className: "card-b"
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      flexWrap: 'wrap',
      marginBottom: 12
    }
  }, React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 160
    }
  }, React.createElement("div", {
    style: {
      fontSize: 13.5,
      fontWeight: 700,
      color: 'var(--ink)'
    }
  }, "Cache & Redis"), React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--muted)'
    }
  }, "This instance, since it booted \u2014 refresh after browsing a few pages to see it work.")), d && (() => {
    const mode = c && c.mode;
    const good = mode === 'mongo' || redisLive,
      off = mode === 'off';
    const label = mode === 'mongo' ? 'MongoDB version counters' : off ? 'Cache off (CACHE_DISABLED)' : redisLive ? 'Redis connected (REST)' : 'In-memory fallback — Redis not configured';
    const fg = good ? '#157a43' : off ? '#5b6b80' : '#b5670a',
      bg = good ? 'rgba(31,157,87,.12)' : off ? 'rgba(125,145,180,.15)' : 'rgba(224,138,30,.13)',
      dot = good ? '#1f9d57' : off ? '#9aa6b4' : '#e08a1e';
    return React.createElement("span", {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 11.5,
        fontWeight: 700,
        padding: '4px 11px',
        borderRadius: 15,
        color: fg,
        background: bg
      }
    }, React.createElement("i", {
      style: {
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: dot
      }
    }), label);
  })(), React.createElement("button", {
    className: "btn sm",
    onClick: load,
    disabled: busy
  }, React.createElement(Ic, {
    d: I.activity,
    s: 14
  }), busy ? 'Loading…' : 'Refresh')), err && React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'var(--rose)',
      fontWeight: 600,
      background: 'var(--neg-bg)',
      borderRadius: 7,
      padding: '9px 11px'
    }
  }, err), !err && !d && React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'var(--faint)',
      padding: '14px',
      textAlign: 'center'
    }
  }, "Loading\u2026"), !err && d && React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, d.db && d.db.authority > 0 && React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 600,
      color: '#8f1d2e',
      background: 'rgba(210,58,82,.1)',
      border: '1px solid rgba(210,58,82,.3)',
      borderRadius: 7,
      padding: '9px 12px'
    }
  }, "\u26A0 WRITE-FAILOVER ACTIVE \u2014 the primary cluster went down and the standby took over reads AND writes", d.db.authorityFlippedAt ? ' at ' + new Date(d.db.authorityFlippedAt).toLocaleTimeString() : '', ". Everything keeps working. Once the primary is reachable again, run ", React.createElement("b", null, "node scripts/sync-clusters.js --heal"), " to copy the new data back and return authority to it.", d.db.lastPrimaryError ? ' Last primary error: ' + String(d.db.lastPrimaryError).slice(0, 110) : ''), d.db && d.db.authority === 0 && d.db.failedOver && React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 600,
      color: '#7a4d09',
      background: 'rgba(224,138,30,.12)',
      border: '1px solid rgba(224,138,30,.3)',
      borderRadius: 7,
      padding: '9px 12px'
    }
  }, "\u26A0 Primary unreachable \u2014 reads are being served from the standby; the first save will move write authority over automatically. Primary re-probed every 15 s.", d.db.lastPrimaryError ? ' Last error: ' + String(d.db.lastPrimaryError).slice(0, 110) : ''), d.db && !d.db.failedOver && d.db.clusters > 1 && React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: '#157a43',
      background: 'rgba(31,157,87,.08)',
      borderRadius: 7,
      padding: '7px 11px'
    }
  }, "\u2713 Failover armed: ", d.db.clusters, " clusters \u2014 primary live, every write mirrored to the standby", d.db.mirrorFails ? ` (${d.db.mirrorFails} mirror failures — standby may be missing recent writes; run sync-clusters.js --apply)` : '', "; if the primary dies, the standby takes over reads and writes automatically."), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 9,
      flexWrap: 'wrap'
    }
  }, tile('Hit rate', d.hitRate == null ? '—' : d.hitRate + '%', 'of ' + ((c.hits || 0) + (c.l1Hits || 0) + (c.misses || 0)) + ' reads', d.hitRate >= 70 ? '#1f9d57' : d.hitRate != null && d.hitRate < 40 ? '#d23a52' : undefined), tile('Shared hits', c.hits || 0, 'served from Redis'), tile('Local hits', c.l1Hits || 0, 'in-process L1'), tile('Misses', c.misses || 0, 'loaded from MongoDB'), tile('Stale serves', c.stale || 0, 'fresh window lapsed'), tile('Outage rescues', c.rescues || 0, c.lastRescue ? 'last ' + String(c.lastRescue).slice(0, 16).replace('T', ' ') : 'DB down, cache stood in', c.rescues ? '#e08a1e' : undefined)), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 9,
      flexWrap: 'wrap'
    }
  }, tile('Invalidations', c.bumps || 0, 'writes that bumped a version'), tile('Lost bumps', c.lostBumps || 0, (c.pendingBumps ? c.pendingBumps + ' pending retry — ' : '') + 'never reached shared store', c.lostBumps ? '#d23a52' : undefined), tile('Background refresh', c.revalidated || 0, (c.revalidateFails || 0) + ' failed'), tile('Redis calls', r.calls == null ? '—' : r.calls, (r.errors || 0) + ' errors' + (r.mutedForMs > 0 ? ' · MUTED ' + Math.ceil(r.mutedForMs / 1000) + 's' : ''), r.mutedForMs > 0 ? '#d23a52' : undefined)), r.lastError && React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: '#b5670a',
      background: 'rgba(224,138,30,.1)',
      borderRadius: 7,
      padding: '8px 11px'
    }
  }, "Last Redis error: ", String(r.lastError).slice(0, 180)), !redisLive && React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--muted)',
      background: 'var(--panel-2)',
      borderRadius: 7,
      padding: '8px 11px'
    }
  }, "No shared cache is configured \u2014 by design since Redis was removed (CACHE_DISABLED=true). Every read goes straight to the database, so data is always current; pages may load a little slower."))));
}
function DatabaseBrowser() {
  const [info, setInfo] = React.useState(null);
  const [table, setTable] = React.useState('');
  const [meta, setMeta] = React.useState(null);
  const [data, setData] = React.useState(null);
  const [err, setErr] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [q, setQ] = React.useState('');
  const [term, setTerm] = React.useState('');
  const [offset, setOffset] = React.useState(0);
  const [open, setOpen] = React.useState(-1);
  const [edit, setEdit] = React.useState(null);
  const [saving, setSaving] = React.useState(false);
  const LIMIT = 50;
  const loadTables = React.useCallback(() => {
    setErr('');
    fetch('/api/d1/tables', {
      credentials: 'same-origin'
    }).then(r => r.json()).then(j => {
      if (!j || !j.ok) {
        setErr(j && j.error || 'Could not read the database.');
        return;
      }
      setInfo(j);
      setTable(t => t || j.tables && j.tables[0] && j.tables[0].name || '');
    }).catch(() => setErr('Could not reach the server.'));
  }, []);
  React.useEffect(() => {
    loadTables();
  }, [loadTables]);
  React.useEffect(() => {
    if (!table) {
      setMeta(null);
      return;
    }
    fetch('/api/d1/meta?table=' + encodeURIComponent(table), {
      credentials: 'same-origin'
    }).then(r => r.json()).then(j => setMeta(j && j.ok ? j : null)).catch(() => setMeta(null));
  }, [table]);
  const loadRows = React.useCallback(() => {
    if (!table) return;
    setBusy(true);
    setErr('');
    setOpen(-1);
    setEdit(null);
    const u = '/api/d1/rows?table=' + encodeURIComponent(table) + '&limit=' + LIMIT + '&offset=' + offset + (term ? '&q=' + encodeURIComponent(term) : '');
    fetch(u, {
      credentials: 'same-origin'
    }).then(r => r.json()).then(j => {
      if (j && j.ok) setData(j);else {
        setData(null);
        setErr(j && j.error || 'Could not read the rows.');
      }
    }).catch(() => setErr('Could not reach the server.')).finally(() => setBusy(false));
  }, [table, offset, term]);
  React.useEffect(() => {
    loadRows();
  }, [loadRows]);
  const pickTable = name => {
    if (name === table) return;
    setTable(name);
    setOffset(0);
    setQ('');
    setTerm('');
    setData(null);
  };
  const search = () => {
    setOffset(0);
    setTerm(q.trim());
  };
  const refresh = () => {
    loadTables();
    loadRows();
  };
  const isJson = v => {
    if (typeof v !== 'string' || v.length < 2) return false;
    const c = v[0];
    return (c === '{' || c === '[') && /[}\]]$/.test(v);
  };
  const short = v => {
    if (v === null || v === undefined) return '';
    const t = String(v);
    if (isJson(t)) return '{…} ' + (t.length > 1024 ? (t.length / 1024).toFixed(1) + ' KB' : t.length + ' B');
    return t.length > 60 ? t.slice(0, 59) + '…' : t;
  };
  const isTime = c => c === 'ts' || c === 'created_at' || c === 'updated_at';
  const fmt = (c, v) => {
    if (isTime(c) && v) {
      try {
        return new Date(Number(v)).toLocaleString([], {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      } catch (e) {
        return String(v);
      }
    }
    return short(v);
  };
  const pretty = v => {
    try {
      return JSON.stringify(JSON.parse(v), null, 2);
    } catch (e) {
      return String(v);
    }
  };
  const pk = meta && meta.primaryKey;
  const canEdit = !!(meta && meta.editable && pk);
  const editableCol = c => canEdit && c !== pk;
  const beginEdit = (row, col) => {
    if (!editableCol(col)) return;
    const raw = row[col];
    const json = isJson(String(raw === null || raw === undefined ? '' : raw));
    setEdit({
      key: row[pk],
      column: col,
      value: json ? pretty(raw) : raw === null || raw === undefined ? '' : String(raw),
      json
    });
  };
  const saveEdit = () => {
    if (!edit) return;
    setSaving(true);
    fetch('/api/d1/row?table=' + encodeURIComponent(table), {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        key: edit.key,
        column: edit.column,
        value: edit.value
      })
    }).then(r => r.json()).then(j => {
      if (!j || !j.ok) {
        window.UI && window.UI.toast(j && j.error || 'Could not save the change', 'warn');
        return;
      }
      setData(d => d ? {
        ...d,
        rows: d.rows.map(r => String(r[pk]) === String(edit.key) ? j.row : r)
      } : d);
      setEdit(null);
      window.UI && window.UI.toast('Saved', 'success');
    }).catch(() => {
      window.UI && window.UI.toast('Could not reach the server', 'warn');
    }).finally(() => setSaving(false));
  };
  const delRow = async row => {
    const ok = await window.UI.confirm({
      title: 'Delete this row?',
      message: 'Permanently removes ' + table + ' [' + row[pk] + '] from the database. This cannot be undone.',
      danger: true,
      confirmLabel: 'Delete row'
    });
    if (!ok) return;
    fetch('/api/d1/row?table=' + encodeURIComponent(table) + '&key=' + encodeURIComponent(row[pk]), {
      method: 'DELETE',
      credentials: 'same-origin'
    }).then(r => r.json()).then(j => {
      if (!j || !j.ok) {
        window.UI && window.UI.toast(j && j.error || 'Could not delete the row', 'warn');
        return;
      }
      window.UI && window.UI.toast('Row deleted', 'success');
      refresh();
    }).catch(() => {
      window.UI && window.UI.toast('Could not reach the server', 'warn');
    });
  };
  const cell = {
    padding: '9px 12px',
    fontSize: 12.5,
    borderBottom: '1px solid var(--line-2)',
    textAlign: 'left',
    verticalAlign: 'top'
  };
  const cols = data && data.columns || [];
  const rows = data && data.rows || [];
  const total = data && data.total || 0;
  const from = total ? offset + 1 : 0,
    to = Math.min(offset + rows.length, total);
  if (info && !info.configured) return React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-b"
  }, React.createElement("div", {
    style: {
      fontSize: 13.5,
      fontWeight: 700,
      color: 'var(--ink)',
      marginBottom: 4
    }
  }, "Database"), React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'var(--muted)',
      lineHeight: 1.6
    }
  }, "Cloudflare D1 is not connected, so the Activity Log and Supervisor Reports are still stored in MongoDB.", React.createElement("div", {
    style: {
      marginTop: 10,
      fontFamily: 'IBM Plex Mono',
      fontSize: 11.5,
      background: 'var(--panel-2)',
      border: '1px solid var(--line-2)',
      borderRadius: 7,
      padding: '10px 12px',
      whiteSpace: 'pre-wrap'
    }
  }, info.hint))));
  return React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-b"
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      flexWrap: 'wrap',
      marginBottom: 12
    }
  }, React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 160
    }
  }, React.createElement("div", {
    style: {
      fontSize: 13.5,
      fontWeight: 700,
      color: 'var(--ink)'
    }
  }, "Database"), React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--muted)'
    }
  }, "Cloudflare D1", info && info.database ? ' · ' + info.database : '', info && info.modules && info.modules.length ? ' · serving ' + info.modules.join(', ') : '')), React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      background: '#fff',
      border: '1px solid var(--line)',
      borderRadius: 7,
      padding: '7px 10px',
      minWidth: 200,
      color: 'var(--faint)'
    }
  }, React.createElement(Ic, {
    d: I.search,
    s: 14
  }), React.createElement("input", {
    value: q,
    onChange: e => setQ(e.target.value),
    onKeyDown: e => {
      if (e.key === 'Enter') search();
    },
    placeholder: "Search this table\u2026",
    style: {
      border: 0,
      outline: 'none',
      background: 'transparent',
      fontSize: 12.5,
      fontFamily: 'inherit',
      color: 'var(--ink)',
      width: '100%'
    }
  }), term && React.createElement("span", {
    onClick: () => {
      setQ('');
      setTerm('');
      setOffset(0);
    },
    style: {
      cursor: 'pointer',
      display: 'flex'
    },
    title: "Clear search"
  }, React.createElement(Ic, {
    d: I.x,
    s: 13
  }))), React.createElement("button", {
    className: "btn sm",
    onClick: search,
    disabled: busy
  }, "Search"), React.createElement("button", {
    className: "btn sm",
    onClick: refresh,
    disabled: busy
  }, React.createElement(Ic, {
    d: I.activity,
    s: 14
  }), busy ? 'Loading…' : 'Refresh')), err && React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'var(--rose)',
      fontWeight: 600,
      background: 'var(--neg-bg)',
      borderRadius: 7,
      padding: '9px 11px',
      marginBottom: 12
    }
  }, err), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap',
      marginBottom: 12
    }
  }, (info && info.tables || []).map(t => React.createElement("div", {
    key: t.name,
    onClick: () => pickTable(t.name),
    title: t.rows + ' row(s)',
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      padding: '7px 11px',
      borderRadius: 7,
      cursor: 'pointer',
      fontSize: 12.5,
      fontWeight: 600,
      border: '1px solid ' + (table === t.name ? 'var(--blue)' : 'var(--line)'),
      background: table === t.name ? 'var(--blue-50)' : '#fff',
      color: table === t.name ? 'var(--blue-700)' : 'var(--ink-2)'
    }
  }, React.createElement(Ic, {
    d: I.grid,
    s: 14
  }), t.name, React.createElement("span", {
    style: {
      fontFamily: 'IBM Plex Mono',
      fontSize: 11,
      color: 'var(--muted)'
    }
  }, t.rows))), info && info.tables && info.tables.length === 0 && React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'var(--faint)'
    }
  }, "No tables yet \u2014 run ", React.createElement("code", null, "node server/d1-migrate.js"), ".")), table && meta && !canEdit && React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--muted)',
      background: 'var(--panel-2)',
      border: '1px solid var(--line-2)',
      borderRadius: 7,
      padding: '8px 11px',
      marginBottom: 12
    }
  }, "This table has no single-column primary key, so rows here are read-only."), !err && data && rows.length === 0 && React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'var(--faint)',
      padding: '22px',
      textAlign: 'center'
    }
  }, term ? 'No rows match “' + term + '”.' : 'This table is empty.'), !err && rows.length > 0 && React.createElement("div", {
    style: {
      overflowX: 'auto',
      border: '1px solid var(--line-2)',
      borderRadius: 9
    }
  }, React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse'
    }
  }, React.createElement("thead", null, React.createElement("tr", {
    style: {
      background: 'var(--panel-2)'
    }
  }, cols.map(c => React.createElement("th", {
    key: c.name,
    style: {
      ...cell,
      fontSize: 10.5,
      textTransform: 'uppercase',
      letterSpacing: .4,
      color: 'var(--muted)',
      fontWeight: 700,
      borderBottom: '1px solid var(--line)',
      whiteSpace: 'nowrap'
    }
  }, c.name, c.name === pk ? ' ·pk' : '')), canEdit && React.createElement("th", {
    style: {
      ...cell,
      borderBottom: '1px solid var(--line)',
      width: 1
    }
  }))), React.createElement("tbody", null, rows.map((r, i) => {
    const big = cols.filter(c => isJson(String(r[c.name] === null || r[c.name] === undefined ? '' : r[c.name]))).map(c => c.name);
    const rowKey = pk ? String(r[pk]) : String(i);
    return React.createElement(React.Fragment, {
      key: rowKey
    }, React.createElement("tr", {
      style: {
        background: open === i ? 'var(--blue-50)' : 'transparent'
      }
    }, cols.map(c => {
      const editingThis = edit && String(edit.key) === rowKey && edit.column === c.name;
      if (editingThis && !edit.json) return React.createElement("td", {
        key: c.name,
        style: {
          ...cell
        }
      }, React.createElement("div", {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 6
        }
      }, React.createElement("input", {
        autoFocus: true,
        value: edit.value,
        onChange: e => setEdit({
          ...edit,
          value: e.target.value
        }),
        onKeyDown: e => {
          if (e.key === 'Enter') saveEdit();
          if (e.key === 'Escape') setEdit(null);
        },
        style: {
          padding: '6px 9px',
          border: '1px solid var(--blue)',
          borderRadius: 6,
          fontFamily: 'inherit',
          fontSize: 12.5,
          minWidth: 150
        }
      }), React.createElement("button", {
        className: "btn sm pri",
        onClick: saveEdit,
        disabled: saving
      }, React.createElement(Ic, {
        d: I.check,
        s: 13
      })), React.createElement("button", {
        className: "btn sm",
        onClick: () => setEdit(null)
      }, React.createElement(Ic, {
        d: I.x,
        s: 13
      }))));
      const canClick = editableCol(c.name);
      const jsonCell = big.indexOf(c.name) >= 0;
      return React.createElement("td", {
        key: c.name,
        title: canClick ? jsonCell ? 'Click to expand, then edit' : 'Click to edit' : c.name === pk ? 'Primary key — not editable' : '',
        onClick: () => {
          if (jsonCell) {
            setOpen(open === i ? -1 : i);
          } else if (canClick) {
            beginEdit(r, c.name);
          }
        },
        style: {
          ...cell,
          whiteSpace: 'nowrap',
          cursor: canClick || jsonCell ? 'pointer' : 'default',
          fontFamily: isTime(c.name) || c.name === pk ? 'IBM Plex Mono' : 'inherit',
          color: isTime(c.name) ? 'var(--muted)' : 'var(--ink-2)'
        }
      }, fmt(c.name, r[c.name]) || React.createElement("span", {
        style: {
          color: 'var(--faint)'
        }
      }, "\u2014"));
    }), canEdit && React.createElement("td", {
      style: {
        ...cell,
        whiteSpace: 'nowrap'
      }
    }, React.createElement("button", {
      className: "btn sm",
      style: {
        color: 'var(--rose)',
        borderColor: '#f1c6cd'
      },
      title: "Delete this row",
      onClick: () => delRow(r)
    }, React.createElement(Ic, {
      d: I.x,
      s: 13
    })))), open === i && big.map(cn => {
      const editingJson = edit && String(edit.key) === rowKey && edit.column === cn;
      return React.createElement("tr", {
        key: cn
      }, React.createElement("td", {
        colSpan: cols.length + (canEdit ? 1 : 0),
        style: {
          ...cell,
          background: 'var(--panel-2)'
        }
      }, React.createElement("div", {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 6
        }
      }, React.createElement("div", {
        style: {
          flex: 1,
          fontSize: 10.5,
          textTransform: 'uppercase',
          letterSpacing: .4,
          color: 'var(--muted)',
          fontWeight: 700
        }
      }, cn), editingJson ? React.createElement(React.Fragment, null, React.createElement("button", {
        className: "btn sm pri",
        onClick: saveEdit,
        disabled: saving
      }, React.createElement(Ic, {
        d: I.check,
        s: 13
      }), saving ? 'Saving…' : 'Save JSON'), React.createElement("button", {
        className: "btn sm",
        onClick: () => setEdit(null)
      }, "Cancel")) : editableCol(cn) && React.createElement("button", {
        className: "btn sm",
        onClick: () => beginEdit(r, cn)
      }, React.createElement(Ic, {
        d: I.edit,
        s: 13
      }), "Edit JSON")), editingJson ? React.createElement("textarea", {
        value: edit.value,
        onChange: e => setEdit({
          ...edit,
          value: e.target.value
        }),
        spellCheck: false,
        style: {
          width: '100%',
          minHeight: 260,
          padding: '10px 12px',
          border: '1px solid var(--blue)',
          borderRadius: 7,
          fontFamily: 'IBM Plex Mono',
          fontSize: 11.5,
          lineHeight: 1.55,
          color: 'var(--ink-2)',
          resize: 'vertical'
        }
      }) : React.createElement("pre", {
        style: {
          margin: 0,
          maxHeight: 340,
          overflow: 'auto',
          fontFamily: 'IBM Plex Mono',
          fontSize: 11.5,
          lineHeight: 1.55,
          color: 'var(--ink-2)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word'
        }
      }, pretty(r[cn]))));
    }));
  })))), !err && total > 0 && React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginTop: 12,
      flexWrap: 'wrap'
    }
  }, React.createElement("div", {
    style: {
      flex: 1,
      fontSize: 11.5,
      color: 'var(--muted)'
    }
  }, "Showing ", from, "\u2013", to, " of ", total, term ? ' matching rows' : ' rows', ".", canEdit ? ' Click a cell to edit it; click a {…} cell to expand the document.' : ''), React.createElement("button", {
    className: "btn sm",
    onClick: () => setOffset(Math.max(0, offset - LIMIT)),
    disabled: busy || offset === 0
  }, "Previous"), React.createElement("button", {
    className: "btn sm",
    onClick: () => setOffset(offset + LIMIT),
    disabled: busy || to >= total
  }, "Next")), !err && !data && React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'var(--faint)',
      padding: '22px',
      textAlign: 'center'
    }
  }, "Loading\u2026")));
}
function MediaBrowser() {
  const [info, setInfo] = React.useState(null);
  const [path, setPath] = React.useState('');
  const [folders, setFolders] = React.useState([]);
  const [assets, setAssets] = React.useState([]);
  const [cursor, setCursor] = React.useState('');
  const [type, setType] = React.useState('image');
  const [usage, setUsage] = React.useState(null);
  const [err, setErr] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [zoom, setZoom] = React.useState(null);
  const loadFolders = React.useCallback(p => {
    setErr('');
    fetch('/api/media/folders?path=' + encodeURIComponent(p || ''), {
      credentials: 'same-origin'
    }).then(r => r.json()).then(j => {
      if (!j || !j.ok) {
        setErr(j && j.error || 'Could not read the media store.');
        return;
      }
      setInfo(j);
      setFolders(j.folders || []);
    }).catch(() => setErr('Could not reach the server.'));
  }, []);
  const loadAssets = React.useCallback((p, t, cur) => {
    setBusy(true);
    setErr('');
    const u = '/api/media/assets?folder=' + encodeURIComponent(p || '') + '&type=' + encodeURIComponent(t) + (cur ? '&cursor=' + encodeURIComponent(cur) : '');
    fetch(u, {
      credentials: 'same-origin'
    }).then(r => r.json()).then(j => {
      if (!j || !j.ok) {
        setErr(j && j.error || 'Could not list the files.');
        return;
      }
      setAssets(a => cur ? a.concat(j.assets || []) : j.assets || []);
      setCursor(j.cursor || '');
    }).catch(() => setErr('Could not reach the server.')).finally(() => setBusy(false));
  }, []);
  React.useEffect(() => {
    loadFolders('');
  }, [loadFolders]);
  React.useEffect(() => {
    if (info && info.configured) loadAssets(path, type, '');
  }, [info, path, type, loadAssets]);
  React.useEffect(() => {
    if (!info || !info.configured) return;
    fetch('/api/media/usage', {
      credentials: 'same-origin'
    }).then(r => r.json()).then(j => {
      if (j && j.ok) setUsage(j.usage);
    }).catch(() => {});
  }, [info]);
  const go = p => {
    setPath(p);
    setCursor('');
    setAssets([]);
    loadFolders(p);
  };
  const crumbs = path ? path.split('/') : [];
  const kb = n => n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : n >= 1024 ? (n / 1024).toFixed(0) + ' KB' : n + ' B';
  const del = async a => {
    const ok = await window.UI.confirm({
      title: 'Delete this file?',
      message: 'Permanently removes “' + a.publicId + '” from Cloudinary. Anything still pointing at it will show a broken image. This cannot be undone.',
      danger: true,
      confirmLabel: 'Delete file'
    });
    if (!ok) return;
    fetch('/api/media/asset?publicId=' + encodeURIComponent(a.publicId), {
      method: 'DELETE',
      credentials: 'same-origin'
    }).then(r => r.json()).then(j => {
      if (!j || !j.ok) {
        window.UI && window.UI.toast(j && j.error || 'Could not delete the file', 'warn');
        return;
      }
      setAssets(list => list.filter(x => x.publicId !== a.publicId));
      window.UI && window.UI.toast('File deleted', 'success');
    }).catch(() => {
      window.UI && window.UI.toast('Could not reach the server', 'warn');
    });
  };
  if (info && !info.configured) return React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-b"
  }, React.createElement("div", {
    style: {
      fontSize: 13.5,
      fontWeight: 700,
      color: 'var(--ink)',
      marginBottom: 4
    }
  }, "Media"), React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'var(--muted)',
      lineHeight: 1.6
    }
  }, "Cloudinary is not connected, so uploaded photos and files are not stored on the CDN.", React.createElement("div", {
    style: {
      marginTop: 10,
      fontFamily: 'IBM Plex Mono',
      fontSize: 11.5,
      background: 'var(--panel-2)',
      border: '1px solid var(--line-2)',
      borderRadius: 7,
      padding: '10px 12px',
      whiteSpace: 'pre-wrap'
    }
  }, info.hint))));
  return React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-b"
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      flexWrap: 'wrap',
      marginBottom: 12
    }
  }, React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 160
    }
  }, React.createElement("div", {
    style: {
      fontSize: 13.5,
      fontWeight: 700,
      color: 'var(--ink)'
    }
  }, "Media"), React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--muted)'
    }
  }, "Cloudinary", info && info.cloudName ? ' · ' + info.cloudName : '', usage ? ' · ' + usage.resources + ' files · ' + kb(usage.storage.usage) + ' stored' : '', usage && usage.credits && usage.credits.limit ? ' · ' + usage.credits.usage.toFixed(2) + '/' + usage.credits.limit + ' credits used' : '')), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6
    }
  }, [['image', 'Images'], ['video', 'Videos'], ['raw', 'Files']].map(([id, l]) => React.createElement("button", {
    key: id,
    className: 'btn sm' + (type === id ? ' pri' : ''),
    onClick: () => {
      setType(id);
      setCursor('');
      setAssets([]);
    }
  }, l))), React.createElement("button", {
    className: "btn sm",
    onClick: () => {
      loadFolders(path);
      loadAssets(path, type, '');
    },
    disabled: busy
  }, React.createElement(Ic, {
    d: I.activity,
    s: 14
  }), busy ? 'Loading…' : 'Refresh')), err && React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'var(--rose)',
      fontWeight: 600,
      background: 'var(--neg-bg)',
      borderRadius: 7,
      padding: '9px 11px',
      marginBottom: 12
    }
  }, err), React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      flexWrap: 'wrap',
      marginBottom: 12,
      fontSize: 12.5
    }
  }, React.createElement("span", {
    onClick: () => go(''),
    style: {
      cursor: 'pointer',
      fontWeight: 700,
      color: path ? 'var(--blue-700)' : 'var(--ink)'
    }
  }, "All files"), crumbs.map((c, i) => React.createElement(React.Fragment, {
    key: i
  }, React.createElement(Ic, {
    d: I.chevR,
    s: 13
  }), React.createElement("span", {
    onClick: () => go(crumbs.slice(0, i + 1).join('/')),
    style: {
      cursor: 'pointer',
      fontWeight: 700,
      color: i === crumbs.length - 1 ? 'var(--ink)' : 'var(--blue-700)'
    }
  }, c)))), folders.length > 0 && React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap',
      marginBottom: 14
    }
  }, folders.map(f => React.createElement("div", {
    key: f.path,
    onClick: () => go(f.path),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      padding: '8px 12px',
      borderRadius: 7,
      cursor: 'pointer',
      fontSize: 12.5,
      fontWeight: 600,
      border: '1px solid var(--line)',
      background: '#fff',
      color: 'var(--ink-2)'
    }
  }, React.createElement(Ic, {
    d: I.layers,
    s: 14
  }), f.name))), !err && assets.length === 0 && !busy && React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'var(--faint)',
      padding: '22px',
      textAlign: 'center'
    }
  }, "No ", type === 'image' ? 'images' : type === 'video' ? 'videos' : 'files', " in ", path ? '“' + path + '”' : 'this account', "."), assets.length > 0 && React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))',
      gap: 12
    }
  }, assets.map(a => React.createElement("div", {
    key: a.publicId,
    style: {
      border: '1px solid var(--line-2)',
      borderRadius: 9,
      overflow: 'hidden',
      background: '#fff'
    }
  }, React.createElement("div", {
    onClick: () => a.thumbUrl && setZoom(a),
    style: {
      height: 120,
      background: 'var(--panel-2)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: a.thumbUrl ? 'zoom-in' : 'default'
    }
  }, a.thumbUrl ? React.createElement("img", {
    src: a.thumbUrl,
    alt: a.name,
    style: {
      width: '100%',
      height: '100%',
      objectFit: 'cover'
    }
  }) : React.createElement("div", {
    style: {
      textAlign: 'center',
      color: 'var(--faint)'
    }
  }, React.createElement(Ic, {
    d: I.doc,
    s: 26
  }), React.createElement("div", {
    style: {
      fontSize: 10.5,
      marginTop: 4,
      textTransform: 'uppercase',
      fontWeight: 700
    }
  }, a.format || a.resourceType))), React.createElement("div", {
    style: {
      padding: '8px 10px'
    }
  }, React.createElement("div", {
    title: a.publicId,
    style: {
      fontSize: 11.5,
      fontWeight: 600,
      color: 'var(--ink)',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, a.name), React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: 'var(--muted)',
      fontFamily: 'IBM Plex Mono'
    }
  }, kb(a.bytes), a.width ? ' · ' + a.width + '×' + a.height : ''), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      marginTop: 7
    }
  }, React.createElement("a", {
    className: "btn sm",
    href: a.url,
    target: "_blank",
    rel: "noreferrer",
    style: {
      flex: 1,
      textAlign: 'center',
      textDecoration: 'none'
    }
  }, "Open"), React.createElement("button", {
    className: "btn sm",
    style: {
      color: 'var(--rose)',
      borderColor: '#f1c6cd'
    },
    title: "Delete from Cloudinary",
    onClick: () => del(a)
  }, React.createElement(Ic, {
    d: I.x,
    s: 13
  }))))))), cursor && React.createElement("div", {
    style: {
      textAlign: 'center',
      marginTop: 14
    }
  }, React.createElement("button", {
    className: "btn sm",
    onClick: () => loadAssets(path, type, cursor),
    disabled: busy
  }, busy ? 'Loading…' : 'Load more')), zoom && React.createElement("div", {
    onClick: () => setZoom(null),
    style: {
      position: 'fixed',
      inset: 0,
      background: 'rgba(12,18,28,.72)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 30,
      cursor: 'zoom-out'
    }
  }, React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      background: '#fff',
      borderRadius: 11,
      overflow: 'hidden',
      maxWidth: '90vw',
      maxHeight: '90vh',
      display: 'flex',
      flexDirection: 'column'
    }
  }, React.createElement("img", {
    src: zoom.url,
    alt: zoom.name,
    style: {
      maxWidth: '90vw',
      maxHeight: '72vh',
      objectFit: 'contain',
      background: 'var(--panel-2)'
    }
  }), React.createElement("div", {
    style: {
      padding: '10px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("div", {
    style: {
      fontSize: 12.5,
      fontWeight: 700,
      color: 'var(--ink)'
    }
  }, zoom.name), React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: 'var(--muted)',
      fontFamily: 'IBM Plex Mono',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, zoom.publicId, " \xB7 ", kb(zoom.bytes), zoom.width ? ' · ' + zoom.width + '×' + zoom.height : '')), React.createElement("a", {
    className: "btn sm",
    href: zoom.url,
    target: "_blank",
    rel: "noreferrer",
    style: {
      textDecoration: 'none'
    }
  }, "Open original"), React.createElement("button", {
    className: "btn sm",
    onClick: () => setZoom(null)
  }, React.createElement(Ic, {
    d: I.x,
    s: 13
  }), "Close"))))));
}
function Settings({
  depts,
  store,
  setRoute
}) {
  const [tab, setTab] = React.useState(() => {
    const t = typeof window !== 'undefined' && window.__UNICO_SETTINGS_TAB__ || 'general';
    if (t === 'responsibles') {
      try {
        window.__UNICO_USERS_SUBTAB__ = 'accounts';
        delete window.__UNICO_SETTINGS_TAB__;
      } catch (e) {}
      return 'users';
    }
    return t;
  });
  const [dbFile, setDbFile] = React.useState('');
  const [sysTab, setSysTab] = React.useState('activity');
  React.useEffect(() => {
    if (['activity', 'database', 'monitor', 'data'].indexOf(tab) >= 0) {
      setSysTab(tab);
      setTab('system');
    }
  }, [tab]);
  const native = window.unicoNative;
  React.useEffect(() => {
    if (native && native.dbPath) {
      native.dbPath().then(setDbFile).catch(() => {});
    }
  }, []);
  const doBackup = async () => {
    if (!native) {
      window.UI && window.UI.toast('Backups need the desktop app', 'warn');
      return;
    }
    try {
      if (window.unicoFlushNow) await window.unicoFlushNow();
      const data = window.unicoSnapshotAll ? window.unicoSnapshotAll() : undefined;
      const res = await native.backup(data);
      if (res && res.ok) window.UI.toast('Backup saved to ' + (res.path || 'file') + ' ✓', 'success');else if (!(res && res.canceled)) window.UI.toast('Backup failed: ' + (res && res.error || 'unknown'), 'error');
    } catch (e) {
      window.UI.toast('Backup failed', 'error');
    }
  };
  const doRestore = async () => {
    if (!native) {
      window.UI && window.UI.toast('Restore needs the desktop app', 'warn');
      return;
    }
    const ok = await window.UI.confirm({
      title: 'Restore from backup?',
      message: 'This replaces ALL current data — entries, staff, quality, users and settings — with the chosen backup file, then reloads the app.',
      danger: true,
      confirmLabel: 'Choose file & restore'
    });
    if (!ok) return;
    try {
      const res = await native.restore();
      if (res && res.canceled) return;
      if (res && res.ok && res.data) {
        try {
          localStorage.clear();
        } catch (e) {}
        Object.keys(res.data).forEach(k => {
          try {
            localStorage.setItem(k, res.data[k]);
          } catch (e) {}
        });
        window.UI.toast('Data restored ✓ — reloading…', 'success');
        setTimeout(() => location.reload(), 800);
      } else window.UI.toast('Restore failed: ' + (res && res.error || 'invalid file'), 'error');
    } catch (e) {
      window.UI.toast('Restore failed', 'error');
    }
  };
  const doClear = async () => {
    if (!store) return;
    const ok = await window.UI.confirm({
      title: 'Clear entered data?',
      message: 'Removes all manually entered monthly entries. Seeded data is kept.',
      danger: true,
      confirmLabel: 'Clear entries'
    });
    if (ok) {
      store.clearEntries();
      window.UI.toast('Entries cleared', 'success');
    }
  };
  const doReset = async () => {
    if (!store) return;
    const ok = await window.UI.confirm({
      title: 'Reset all customizations?',
      message: 'Removes added / renamed / deleted departments and all entered data. This cannot be undone.',
      danger: true,
      confirmLabel: 'Reset everything'
    });
    if (ok) {
      store.reset();
      window.UI.toast('All customizations reset', 'success');
    }
  };
  const lock = window.unicoLock;
  const [lockOn, setLockOn] = React.useState(() => !!(lock && lock.isEnabled()));
  const [pinMode, setPinMode] = React.useState(false);
  const [pin1, setPin1] = React.useState('');
  const [pin2, setPin2] = React.useState('');
  const savePin = () => {
    if (pin1.length < 4) {
      window.UI.toast('PIN must be at least 4 digits', 'error');
      return;
    }
    if (pin1 !== pin2) {
      window.UI.toast('PINs do not match', 'error');
      return;
    }
    lock.setPin(pin1);
    setLockOn(true);
    setPinMode(false);
    setPin1('');
    setPin2('');
    window.UI.toast('App lock enabled ✓', 'success');
  };
  const disableLock = async () => {
    const ok = await window.UI.confirm({
      title: 'Disable app lock?',
      message: 'The app will no longer require a PIN to open.',
      danger: true,
      confirmLabel: 'Disable'
    });
    if (ok) {
      lock.disable();
      setLockOn(false);
      window.UI.toast('App lock disabled', 'success');
    }
  };
  const row = (label, control) => React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: '13px 0',
      borderBottom: '1px solid var(--line-2)'
    }
  }, React.createElement("div", {
    style: {
      flex: 1
    }
  }, React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: 'var(--ink)'
    }
  }, label.t), React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--muted)'
    }
  }, label.s)), control);
  const Toggle = ({
    on = true
  }) => {
    const [v, setV] = React.useState(on);
    return React.createElement("button", {
      onClick: () => setV(!v),
      style: {
        width: 42,
        height: 24,
        borderRadius: 20,
        border: 0,
        background: v ? 'var(--blue)' : '#cdd6e2',
        position: 'relative',
        transition: '.2s',
        cursor: 'pointer'
      }
    }, React.createElement("span", {
      style: {
        position: 'absolute',
        top: 3,
        left: v ? 21 : 3,
        width: 18,
        height: 18,
        borderRadius: '50%',
        background: '#fff',
        transition: '.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,.3)'
      }
    }));
  };
  return React.createElement("div", {
    className: "grid",
    style: {
      gap: 16
    }
  }, React.createElement(SectionTitle, {
    icon: I.gear,
    title: "Settings",
    sub: "Configure the statistics platform"
  }), React.createElement("div", {
    className: "grid",
    style: {
      gridTemplateColumns: '200px 1fr',
      alignItems: 'start'
    }
  }, React.createElement("div", {
    className: "card",
    style: {
      padding: 6
    }
  }, [['general', 'General', I.gear], ['departments', 'Departments', I.layers], ['stafffields', 'Staff Fields', I.steth], ['deptprivileges', 'Department Privileges', I.check], ['users', 'Users & Roles', I.user], ['system', 'System & Data', I.grid], ['media', 'Media', I.doc], ['fields', 'Form Fields', I.filter]].map(([id, l, ic]) => React.createElement("div", {
    key: id,
    onClick: () => setTab(id),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 12px',
      borderRadius: 7,
      cursor: 'pointer',
      fontSize: 13,
      fontWeight: 600,
      background: tab === id ? 'var(--blue-50)' : 'transparent',
      color: tab === id ? 'var(--blue-700)' : 'var(--ink-2)'
    }
  }, React.createElement(Ic, {
    d: ic,
    s: 16
  }), l))), React.createElement("div", {
    style: {
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, tab === 'general' && React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-b"
  }, row({
    t: 'Hospital name',
    s: 'Shown across the platform and on exports'
  }, React.createElement("input", {
    defaultValue: "UNICO Hospitals PLC",
    style: {
      padding: '8px 11px',
      border: '1px solid var(--line)',
      borderRadius: 7,
      fontFamily: 'inherit',
      fontSize: 13,
      width: 230
    }
  })), row({
    t: 'Default reporting period',
    s: 'Initial range when opening dashboards'
  }, React.createElement("select", {
    style: {
      padding: '8px 11px',
      border: '1px solid var(--line)',
      borderRadius: 7,
      fontFamily: 'inherit',
      fontSize: 13
    }
  }, React.createElement("option", null, "Last 9 months"), React.createElement("option", null, "Year to date"), React.createElement("option", null, "All time"))), row({
    t: 'Week starts on',
    s: 'Calendar & trend grouping'
  }, React.createElement("select", {
    style: {
      padding: '8px 11px',
      border: '1px solid var(--line)',
      borderRadius: 7,
      fontFamily: 'inherit',
      fontSize: 13
    }
  }, React.createElement("option", null, "Sunday"), React.createElement("option", null, "Monday"))), row({
    t: 'Auto-validate totals',
    s: 'Block entries where components don’t sum to total'
  }, React.createElement(Toggle, {
    on: true
  })), row({
    t: 'Confidential watermark',
    s: 'Stamp exported reports'
  }, React.createElement(Toggle, {
    on: true
  })), lock && React.createElement("div", {
    style: {
      padding: '13px 0'
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14
    }
  }, React.createElement("div", {
    style: {
      flex: 1
    }
  }, React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: 'var(--ink)'
    }
  }, "App lock (PIN)"), React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--muted)'
    }
  }, "Require a PIN each time the app opens", lockOn ? ' · currently ON' : '')), lockOn ? React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, React.createElement("button", {
    className: "btn sm",
    onClick: () => {
      setPinMode(true);
      setPin1('');
      setPin2('');
    }
  }, "Change PIN"), React.createElement("button", {
    className: "btn sm",
    style: {
      color: 'var(--rose)',
      borderColor: '#f1c6cd'
    },
    onClick: disableLock
  }, "Disable")) : !pinMode && React.createElement("button", {
    className: "btn sm pri",
    onClick: () => {
      setPinMode(true);
      setPin1('');
      setPin2('');
    }
  }, "Enable lock")), pinMode && React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginTop: 10,
      alignItems: 'center',
      flexWrap: 'wrap'
    }
  }, React.createElement("input", {
    type: "password",
    inputMode: "numeric",
    placeholder: "New PIN (4+)",
    value: pin1,
    onChange: e => setPin1(e.target.value.replace(/\D/g, '')),
    style: {
      padding: '7px 10px',
      border: '1px solid var(--line)',
      borderRadius: 7,
      fontFamily: 'inherit',
      fontSize: 13,
      width: 130
    }
  }), React.createElement("input", {
    type: "password",
    inputMode: "numeric",
    placeholder: "Confirm PIN",
    value: pin2,
    onChange: e => setPin2(e.target.value.replace(/\D/g, '')),
    onKeyDown: e => {
      if (e.key === 'Enter') savePin();
    },
    style: {
      padding: '7px 10px',
      border: '1px solid var(--line)',
      borderRadius: 7,
      fontFamily: 'inherit',
      fontSize: 13,
      width: 130
    }
  }), React.createElement("button", {
    className: "btn sm pri",
    onClick: savePin
  }, "Save PIN"), React.createElement("button", {
    className: "btn sm",
    onClick: () => {
      setPinMode(false);
      setPin1('');
      setPin2('');
    }
  }, "Cancel"))))), tab === 'departments' && (typeof ManageDepts !== 'undefined' ? React.createElement(ManageDepts, {
    depts: depts,
    store: store,
    setRoute: setRoute
  }) : null), tab === 'stafffields' && React.createElement(StaffFieldsSettings, {
    depts: depts,
    setRoute: setRoute
  }), tab === 'deptprivileges' && (typeof DeptPrivilegesSettings !== 'undefined' ? React.createElement(DeptPrivilegesSettings, {
    depts: depts
  }) : null), tab === 'system' && React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-b",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      flexWrap: 'wrap'
    }
  }, React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 220
    }
  }, React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      color: 'var(--ink)'
    }
  }, "System & Data"), React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--muted)'
    }
  }, "Activity history, the database, live system health, backups and exports.")), React.createElement("div", {
    className: "seg",
    style: {
      flexWrap: 'wrap'
    }
  }, [['activity', 'Activity Log', I.activity], ['database', 'Database', I.grid], ['monitor', 'System Monitor', I.activity], ['data', 'Data & Export', I.doc]].map(([id, l, ic]) => React.createElement("button", {
    key: id,
    className: sysTab === id ? 'on' : '',
    onClick: () => setSysTab(id),
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6
    }
  }, React.createElement(Ic, {
    d: ic,
    s: 13
  }), l))))), tab === 'system' && sysTab === 'activity' && React.createElement(ActivityLog, null), tab === 'system' && sysTab === 'database' && React.createElement(React.Fragment, null, React.createElement(CacheStats, null), React.createElement(DatabaseBrowser, null)), tab === 'system' && sysTab === 'monitor' && (window.SystemMonitor ? React.createElement(window.SystemMonitor, null) : React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-b"
  }, "System Monitor is not loaded."))), tab === 'media' && React.createElement(MediaBrowser, null), tab === 'users' && React.createElement(UsersAndRoles, {
    depts: depts
  }), tab === 'fields' && (typeof DataFields !== 'undefined' ? React.createElement(DataFields, {
    setRoute: setRoute
  }) : null), tab === 'system' && sysTab === 'data' && React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "card-b"
  }, React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: 'var(--ink)',
      marginBottom: 2
    }
  }, "Backup & restore"), React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--muted)',
      marginBottom: 10
    }
  }, "All data is stored in a local database on this PC. Back it up to a file you can keep safe or move to another PC."), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      flexWrap: 'wrap'
    }
  }, React.createElement("button", {
    className: "btn pri",
    onClick: doBackup
  }, React.createElement(Ic, {
    d: I.download,
    s: 15
  }), "Back up all data\u2026"), React.createElement("button", {
    className: "btn",
    onClick: doRestore
  }, React.createElement(Ic, {
    d: I.upload,
    s: 15
  }), "Restore from backup\u2026")), dbFile && React.createElement("div", {
    className: "col-chip",
    style: {
      marginTop: 12,
      maxWidth: '100%',
      wordBreak: 'break-all'
    },
    title: dbFile
  }, React.createElement(Ic, {
    d: I.doc,
    s: 13
  }), "Database: ", dbFile), React.createElement("div", {
    style: {
      height: 1,
      background: 'var(--line-2)',
      margin: '16px 0'
    }
  }), row({
    t: 'Export format',
    s: 'Default download type for reports'
  }, React.createElement("select", {
    style: {
      padding: '8px 11px',
      border: '1px solid var(--line)',
      borderRadius: 7,
      fontFamily: 'inherit',
      fontSize: 13
    }
  }, React.createElement("option", null, "PDF"), React.createElement("option", null, "Excel (.xlsx)"), React.createElement("option", null, "CSV"))), row({
    t: 'Round percentages',
    s: 'Display IPD conversion to 2 decimals'
  }, React.createElement(Toggle, {
    on: true
  })), React.createElement("div", {
    style: {
      marginTop: 14,
      display: 'flex',
      gap: 10,
      flexWrap: 'wrap'
    }
  }, React.createElement("button", {
    className: "btn",
    style: {
      color: 'var(--rose)',
      borderColor: '#f1c6cd'
    },
    onClick: doClear
  }, "Clear session entries"), React.createElement("button", {
    className: "btn",
    style: {
      color: 'var(--rose)',
      borderColor: '#f1c6cd'
    },
    onClick: doReset
  }, "Reset all customizations")))))));
}
window.Reports = Reports;
window.Settings = Settings;
})();
;
/* ===== user-admin.jsx ===== */
(function(){
const UA_ROLES = ['Administrator', 'collector', 'User'];
const UA_ROLE_LABEL = {
  Administrator: 'Administrator',
  collector: 'Data Collector',
  User: 'User'
};
const UA_MODULES = [{
  id: 'stats',
  label: 'Statistics',
  icon: I.grid,
  desc: 'Dashboards, departments & data entry'
}, {
  id: 'quality',
  label: 'Quality',
  icon: I.heart,
  desc: 'Quality indicators, scorecards & trends'
}, {
  id: 'staff',
  label: 'Staff',
  icon: I.steth,
  desc: 'Nurse & PCA management'
}, {
  id: 'datacol',
  label: 'Data Collection',
  icon: I.input,
  desc: 'Submission forms & review'
}, {
  id: 'reports',
  label: 'Reports',
  icon: I.doc,
  desc: 'Report generator'
}, {
  id: 'users',
  label: 'Administration',
  icon: I.gear,
  desc: 'Users, roles & settings'
}];
const UA_MODULE_LABEL = UA_MODULES.reduce((m, x) => {
  m[x.id] = x.label;
  return m;
}, {});
const UA_ROLE_TONE = {
  Administrator: ['#6a52d4', 'rgba(106,82,212,.12)'],
  collector: ['#0090ca', 'var(--blue-50)'],
  User: ['#5b6b80', '#eef1f5']
};
function uaRoleTone(r) {
  return UA_ROLE_TONE[r] || UA_ROLE_TONE.User;
}
function uaApi(method, path, body) {
  return fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'same-origin',
    body: body ? JSON.stringify(body) : undefined
  }).then(async r => {
    let j = null;
    try {
      j = await r.json();
    } catch (e) {}
    if (!r.ok || !j || j.ok === false) {
      const msg = j && j.error || (r.status === 401 ? 'Sign in as an administrator to manage users.' : r.status === 403 ? 'Administrator access required.' : 'Request failed (' + r.status + ').');
      throw new Error(msg);
    }
    return j;
  });
}
function uaToast(msg, kind) {
  try {
    if (window.UI && window.UI.toast) window.UI.toast(msg, kind || 'success');
  } catch (e) {}
}
function UAUserForm({
  user,
  roles,
  onClose,
  onSaved
}) {
  const {
    useState
  } = React;
  const editing = !!user;
  const [username, setUsername] = useState(user ? user.username : '');
  const [name, setName] = useState(user ? user.name || '' : '');
  const [role, setRole] = useState(user ? user.role || 'User' : 'User');
  const [active, setActive] = useState(user ? user.active !== false : true);
  const [password, setPassword] = useState('');
  const [departments, setDepartments] = useState(user && user.departments ? user.departments.join(', ') : '');
  const [allQualityAreas, setAllQualityAreas] = useState(user ? !!user.allQualityAreas : false);
  const [qualityAreas, setQualityAreas] = useState(user && Array.isArray(user.qualityAreas) ? user.qualityAreas : []);
  const [qualityIndicators, setQualityIndicators] = useState(user && user.qualityIndicators && typeof user.qualityIndicators === 'object' && !Array.isArray(user.qualityIndicators) ? user.qualityIndicators : {});
  const [modules, setModules] = useState(user ? Array.isArray(user.modules) ? user.modules : UA_MODULES.map(m => m.id) : []);
  const qAreas = React.useMemo(() => (window.qualityData ? window.qualityData() : []).map(d => ({
    key: d.key,
    name: d.name
  })), []);
  const qAreaInds = React.useMemo(() => {
    const m = {};
    (window.qualityData ? window.qualityData() : []).forEach(d => {
      m[d.key] = (d.indicators || []).map(i => ({
        id: i.id,
        name: i.name
      }));
    });
    return m;
  }, []);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const txt = {
    padding: '9px 11px',
    border: '1px solid var(--line)',
    borderRadius: 8,
    fontSize: 13,
    fontFamily: 'inherit',
    width: '100%',
    outline: 'none',
    background: '#fff'
  };
  const list = s => s.split(',').map(x => x.trim()).filter(Boolean);
  const submit = async () => {
    setErr('');
    if (!editing && !String(username).trim()) return setErr('Username is required.');
    if (!editing && password.length < 6) return setErr('Password must be at least 6 characters.');
    setBusy(true);
    try {
      const scope = role === 'collector' ? {
        departments: list(departments),
        allQualityAreas,
        qualityAreas,
        qualityIndicators,
        modules: null
      } : {
        departments: [],
        allQualityAreas: false,
        qualityAreas: [],
        qualityIndicators: {},
        modules: role === 'User' ? modules : null
      };
      if (editing) {
        await uaApi('PATCH', '/api/users/' + encodeURIComponent(user.username), {
          name,
          role,
          active,
          ...scope
        });
      } else {
        await uaApi('POST', '/api/users', {
          username: String(username).trim().toLowerCase(),
          name,
          role,
          active,
          password,
          ...scope
        });
      }
      uaToast(editing ? 'User updated' : 'User created');
      onSaved();
    } catch (e) {
      setErr(e.message || 'Could not save.');
    } finally {
      setBusy(false);
    }
  };
  return React.createElement("div", {
    onMouseDown: onClose,
    style: {
      position: 'fixed',
      inset: 0,
      background: 'rgba(16,32,46,.42)',
      zIndex: 400,
      display: 'grid',
      placeItems: 'center',
      padding: 20
    }
  }, React.createElement("div", {
    onMouseDown: e => e.stopPropagation(),
    className: "card",
    style: {
      width: 460,
      maxWidth: '100%',
      maxHeight: '90vh',
      overflow: 'auto'
    }
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, editing ? 'Edit user' : 'Add user'), React.createElement("span", {
    className: "spacer"
  }), React.createElement("button", {
    className: "icon-btn",
    style: {
      width: 28,
      height: 28
    },
    onClick: onClose
  }, React.createElement(Ic, {
    d: I.x,
    s: 14
  }))), React.createElement("div", {
    className: "card-b",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, React.createElement("div", {
    className: "field"
  }, React.createElement("label", null, "Username"), React.createElement("input", {
    style: {
      ...txt,
      opacity: editing ? 0.6 : 1
    },
    value: username,
    disabled: editing,
    onChange: e => setUsername(e.target.value),
    placeholder: "e.g. j.smith"
  })), React.createElement("div", {
    className: "field"
  }, React.createElement("label", null, "Full name"), React.createElement("input", {
    style: txt,
    value: name,
    onChange: e => setName(e.target.value),
    placeholder: "Display name"
  })), React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr auto',
      gap: 12,
      alignItems: 'end'
    }
  }, React.createElement("div", {
    className: "field"
  }, React.createElement("label", null, "Role"), React.createElement("select", {
    style: txt,
    value: role,
    onChange: e => setRole(e.target.value)
  }, (roles && roles.length ? roles : UA_ROLES).map(r => React.createElement("option", {
    key: r,
    value: r
  }, UA_ROLE_LABEL[r] || r)))), React.createElement("label", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      fontSize: 13,
      color: 'var(--ink-2)',
      cursor: 'pointer',
      paddingBottom: 9
    }
  }, React.createElement("input", {
    type: "checkbox",
    checked: active,
    onChange: e => setActive(e.target.checked)
  }), "Active")), role === 'collector' && (() => {
    const derived = allQualityAreas ? window.DEPTMAP ? window.DEPTMAP.allAreaKeys() : [] : window.DEPTMAP ? window.DEPTMAP.areasFromDepts(list(departments)) : [];
    const effective = allQualityAreas ? derived : [...derived, ...qualityAreas.filter(k => !derived.includes(k))];
    const toggleArea = k => setQualityAreas(qa => qa.includes(k) ? qa.filter(x => x !== k) : [...qa, k]);
    const depNames = list(departments).map(id => window.DEPTMAP ? window.DEPTMAP.nameFromId(id) : id);
    return React.createElement(React.Fragment, null, React.createElement("div", {
      className: "field"
    }, React.createElement("label", null, "Departments ", React.createElement("span", {
      style: {
        fontWeight: 400,
        color: 'var(--muted)'
      }
    }, "\xB7 ids, comma-separated (incl. custom like ctot)")), React.createElement("input", {
      style: txt,
      value: departments,
      onChange: e => setDepartments(e.target.value),
      placeholder: "e.g. micu, ccu, ctot"
    }), depNames.length > 0 && React.createElement("div", {
      style: {
        fontSize: 11.5,
        color: 'var(--muted)',
        marginTop: 4
      }
    }, depNames.join(' · '))), React.createElement("div", {
      className: "field"
    }, React.createElement("label", null, "Quality areas ", React.createElement("span", {
      style: {
        fontWeight: 400,
        color: 'var(--muted)'
      }
    }, "\xB7 AUTO from departments + custom extras")), React.createElement("label", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 13,
        color: 'var(--ink-2)',
        cursor: 'pointer',
        margin: '2px 0 8px'
      }
    }, React.createElement("input", {
      type: "checkbox",
      checked: allQualityAreas,
      onChange: e => setAllQualityAreas(e.target.checked)
    }), "Hospital-wide \u2014 every quality area"), !allQualityAreas && React.createElement("div", {
      style: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6
      }
    }, qAreas.map(a => {
      const auto = derived.includes(a.key);
      const on = auto || qualityAreas.includes(a.key);
      return React.createElement("span", {
        key: a.key,
        onClick: () => {
          if (!auto) toggleArea(a.key);
        },
        title: auto ? 'From a department' : 'Custom access',
        style: {
          cursor: auto ? 'default' : 'pointer',
          padding: '4px 9px',
          borderRadius: 999,
          fontSize: 11.5,
          fontWeight: 600,
          border: '1px solid ' + (on ? 'var(--blue)' : 'var(--line)'),
          background: on ? 'var(--blue-50)' : '#fff',
          color: on ? 'var(--blue-700)' : 'var(--ink-2)',
          opacity: auto ? 0.85 : 1
        }
      }, a.name, auto && React.createElement("span", {
        style: {
          fontSize: 8.5,
          fontWeight: 700,
          marginLeft: 3,
          opacity: 0.7
        }
      }, "AUTO"));
    }))), effective.length > 0 && React.createElement("div", {
      className: "field"
    }, React.createElement("label", null, "Specific indicators ", React.createElement("span", {
      style: {
        fontWeight: 400,
        color: 'var(--muted)'
      }
    }, "\xB7 leave empty in an area = all indicators")), React.createElement("div", {
      style: {
        display: 'grid',
        gap: 8
      }
    }, effective.map(ak => {
      const inds = qAreaInds[ak] || [];
      if (!inds.length) return null;
      const aName = (qAreas.find(a => a.key === ak) || {}).name || ak;
      const sel = qualityIndicators[ak] || [];
      const setSel = ids => setQualityIndicators(m => {
        const n = {
          ...m
        };
        if (ids && ids.length) n[ak] = ids;else delete n[ak];
        return n;
      });
      return React.createElement("div", {
        key: ak,
        style: {
          padding: '8px 10px',
          background: 'var(--panel-2)',
          border: '1px solid var(--line)',
          borderRadius: 8
        }
      }, React.createElement("div", {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 6
        }
      }, React.createElement("span", {
        style: {
          fontSize: 11.5,
          fontWeight: 700,
          color: 'var(--ink-2)'
        }
      }, aName, " ", React.createElement("span", {
        style: {
          fontWeight: 500,
          color: 'var(--muted)'
        }
      }, "\xB7 ", sel.length ? sel.length + ' of ' + inds.length + ' selected' : 'all ' + inds.length)), React.createElement("span", {
        style: {
          flex: 1
        }
      }), React.createElement("button", {
        type: "button",
        onClick: () => setSel(inds.map(x => x.id)),
        style: {
          border: 0,
          background: 'none',
          color: 'var(--blue)',
          fontSize: 11,
          fontWeight: 700,
          cursor: 'pointer',
          padding: 0
        }
      }, "Select all"), React.createElement("button", {
        type: "button",
        onClick: () => setSel([]),
        style: {
          border: 0,
          background: 'none',
          color: 'var(--muted)',
          fontSize: 11,
          fontWeight: 700,
          cursor: 'pointer',
          padding: 0
        }
      }, "Clear (= all)")), React.createElement("div", {
        style: {
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6
        }
      }, inds.map(ind => {
        const on = sel.includes(ind.id);
        return React.createElement("span", {
          key: ind.id,
          onClick: () => setSel(on ? sel.filter(x => x !== ind.id) : [...sel, ind.id]),
          style: {
            cursor: 'pointer',
            padding: '3px 8px',
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 600,
            border: '1px solid ' + (on ? 'var(--blue)' : 'var(--line)'),
            background: on ? 'var(--blue-50)' : '#fff',
            color: on ? 'var(--blue-700)' : 'var(--ink-2)'
          }
        }, ind.name);
      })));
    }))));
  })(), role === 'User' && (() => {
    const toggle = id => setModules(ms => ms.includes(id) ? ms.filter(x => x !== id) : [...ms, id]);
    const allIds = UA_MODULES.map(m => m.id);
    const allOn = allIds.every(id => modules.includes(id));
    return React.createElement("div", {
      className: "field"
    }, React.createElement("label", null, "Module access ", React.createElement("span", {
      style: {
        fontWeight: 400,
        color: 'var(--muted)'
      }
    }, "\xB7 which workspaces this user can open")), React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        margin: '2px 0 8px'
      }
    }, React.createElement("span", {
      style: {
        fontSize: 11.5,
        color: 'var(--muted)'
      }
    }, modules.length ? modules.length + ' of ' + allIds.length + ' granted' : 'No access yet — select at least one'), React.createElement("span", {
      style: {
        flex: 1
      }
    }), React.createElement("button", {
      type: "button",
      onClick: () => setModules(allOn ? [] : allIds),
      style: {
        border: 0,
        background: 'none',
        color: 'var(--blue)',
        fontSize: 11,
        fontWeight: 700,
        cursor: 'pointer',
        padding: 0
      }
    }, allOn ? 'Clear all' : 'Select all')), React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 8
      }
    }, UA_MODULES.map(m => {
      const on = modules.includes(m.id);
      return React.createElement("div", {
        key: m.id,
        onClick: () => toggle(m.id),
        title: m.desc,
        style: {
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 9,
          padding: '9px 11px',
          borderRadius: 9,
          border: '1px solid ' + (on ? 'var(--blue)' : 'var(--line)'),
          background: on ? 'var(--blue-50)' : '#fff'
        }
      }, React.createElement("span", {
        style: {
          marginTop: 1,
          width: 16,
          height: 16,
          borderRadius: 5,
          flexShrink: 0,
          display: 'grid',
          placeItems: 'center',
          border: '1px solid ' + (on ? 'var(--blue)' : 'var(--line)'),
          background: on ? 'var(--blue)' : '#fff'
        }
      }, on && React.createElement(Ic, {
        d: I.check,
        s: 11,
        c: "#fff"
      })), React.createElement("span", {
        style: {
          minWidth: 0
        }
      }, React.createElement("span", {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12.5,
          fontWeight: 700,
          color: on ? 'var(--blue-700)' : 'var(--ink)'
        }
      }, React.createElement(Ic, {
        d: m.icon,
        s: 13
      }), m.label), React.createElement("span", {
        style: {
          display: 'block',
          fontSize: 10.5,
          color: 'var(--muted)',
          marginTop: 2,
          lineHeight: 1.35
        }
      }, m.desc)));
    })));
  })(), !editing && React.createElement("div", {
    className: "field"
  }, React.createElement("label", null, "Password"), React.createElement("input", {
    style: txt,
    type: "password",
    value: password,
    onChange: e => setPassword(e.target.value),
    placeholder: "At least 6 characters"
  })), err && React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: '#b32339',
      background: 'var(--neg-bg)',
      borderRadius: 7,
      padding: '8px 10px'
    }
  }, err), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      justifyContent: 'flex-end'
    }
  }, React.createElement("button", {
    className: "btn sm",
    onClick: onClose
  }, "Cancel"), React.createElement("button", {
    className: "btn pri sm",
    onClick: submit,
    disabled: busy
  }, React.createElement(Ic, {
    d: I.check,
    s: 14
  }), busy ? 'Saving…' : editing ? 'Save changes' : 'Create user')))));
}
function UAPasswordForm({
  user,
  onClose,
  onSaved
}) {
  const {
    useState
  } = React;
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const txt = {
    padding: '9px 11px',
    border: '1px solid var(--line)',
    borderRadius: 8,
    fontSize: 13,
    fontFamily: 'inherit',
    width: '100%',
    outline: 'none',
    background: '#fff'
  };
  const submit = async () => {
    if (pw.length < 6) return setErr('Password must be at least 6 characters.');
    setBusy(true);
    setErr('');
    try {
      await uaApi('POST', '/api/users/' + encodeURIComponent(user.username) + '/password', {
        password: pw
      });
      uaToast('Password reset');
      onSaved();
    } catch (e) {
      setErr(e.message || 'Could not reset.');
    } finally {
      setBusy(false);
    }
  };
  return React.createElement("div", {
    onMouseDown: onClose,
    style: {
      position: 'fixed',
      inset: 0,
      background: 'rgba(16,32,46,.42)',
      zIndex: 400,
      display: 'grid',
      placeItems: 'center',
      padding: 20
    }
  }, React.createElement("div", {
    onMouseDown: e => e.stopPropagation(),
    className: "card",
    style: {
      width: 380,
      maxWidth: '100%'
    }
  }, React.createElement("div", {
    className: "card-h"
  }, React.createElement("h3", null, "Reset password"), React.createElement("span", {
    className: "spacer"
  }), React.createElement("button", {
    className: "icon-btn",
    style: {
      width: 28,
      height: 28
    },
    onClick: onClose
  }, React.createElement(Ic, {
    d: I.x,
    s: 14
  }))), React.createElement("div", {
    className: "card-b",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'var(--muted)'
    }
  }, "New password for ", React.createElement("b", {
    style: {
      color: 'var(--ink)'
    }
  }, user.name || user.username), " (@", user.username, ")."), React.createElement("input", {
    style: txt,
    type: "password",
    value: pw,
    onChange: e => setPw(e.target.value),
    placeholder: "At least 6 characters"
  }), err && React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: '#b32339',
      background: 'var(--neg-bg)',
      borderRadius: 7,
      padding: '8px 10px'
    }
  }, err), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      justifyContent: 'flex-end'
    }
  }, React.createElement("button", {
    className: "btn sm",
    onClick: onClose
  }, "Cancel"), React.createElement("button", {
    className: "btn pri sm",
    onClick: submit,
    disabled: busy
  }, React.createElement(Ic, {
    d: I.check,
    s: 14
  }), busy ? 'Saving…' : 'Reset password')))));
}
function UserAdmin() {
  const {
    useState,
    useEffect
  } = React;
  const [users, setUsers] = useState(null);
  const [roles, setRoles] = useState(UA_ROLES);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [form, setForm] = useState(null);
  const [pwUser, setPwUser] = useState(null);
  const load = () => {
    setErr('');
    uaApi('GET', '/api/users').then(j => {
      setUsers(j.users || []);
      if (j.roles && j.roles.length) setRoles(j.roles);
    }).catch(e => {
      setUsers([]);
      setErr(e.message || 'Could not load users.');
    });
  };
  useEffect(load, []);
  const setActive = async (u, active) => {
    try {
      await uaApi('PATCH', '/api/users/' + encodeURIComponent(u.username), {
        active
      });
      uaToast(active ? 'Activated' : 'Deactivated');
      load();
    } catch (e) {
      uaToast(e.message || 'Failed', 'error');
    }
  };
  const del = async u => {
    let ok = true;
    try {
      ok = await window.UI.confirm({
        title: 'Delete user?',
        message: `Permanently removes "${u.name || u.username}" (@${u.username}).`,
        danger: true,
        confirmLabel: 'Delete'
      });
    } catch (e) {
      ok = window.confirm('Delete ' + u.username + '?');
    }
    if (!ok) return;
    try {
      await uaApi('DELETE', '/api/users/' + encodeURIComponent(u.username));
      uaToast('User deleted');
      load();
    } catch (e) {
      uaToast(e.message || 'Failed', 'error');
    }
  };
  const all = users || [];
  const counts = {
    total: all.length,
    admin: all.filter(u => u.role === 'Administrator').length,
    collector: all.filter(u => u.role === 'collector').length,
    active: all.filter(u => u.active !== false).length
  };
  const ql = q.trim().toLowerCase();
  const shown = all.filter(u => (roleFilter === 'all' || u.role === roleFilter) && (!ql || (u.username || '').toLowerCase().includes(ql) || (u.name || '').toLowerCase().includes(ql)));
  const sel = {
    padding: '8px 10px',
    border: '1px solid var(--line)',
    borderRadius: 8,
    fontSize: 12.5,
    fontFamily: 'inherit',
    background: '#fff',
    color: 'var(--ink)'
  };
  const Kpi = ({
    label,
    val,
    color
  }) => React.createElement("div", {
    className: "card anim-pop",
    style: {
      padding: '15px 18px',
      borderLeft: `4px solid ${color}`,
      display: 'flex',
      flexDirection: 'column',
      minHeight: 92
    }
  }, React.createElement("div", {
    style: {
      fontSize: 12.5,
      fontWeight: 700,
      color: 'var(--ink-2)'
    }
  }, label), React.createElement("div", {
    className: "num",
    style: {
      fontSize: 28,
      fontWeight: 700,
      color,
      margin: '6px 0 0',
      lineHeight: 1
    }
  }, val));
  return React.createElement("div", {
    className: "grid",
    style: {
      gap: 16
    }
  }, React.createElement(SectionTitle, {
    icon: I.user,
    title: "User Management",
    sub: "All accounts, roles & access across the UNICO suite",
    right: React.createElement(React.Fragment, null, React.createElement("button", {
      className: "btn sm",
      onClick: load
    }, React.createElement(Ic, {
      d: I.search,
      s: 14
    }), "Refresh"), React.createElement("button", {
      className: "btn pri sm",
      onClick: () => setForm({
        user: null
      })
    }, React.createElement(Ic, {
      d: I.plus,
      s: 14
    }), "Add user"))
  }), React.createElement("div", {
    className: "grid",
    style: {
      gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))'
    }
  }, React.createElement(Kpi, {
    label: "Total users",
    val: counts.total,
    color: "#0090ca"
  }), React.createElement(Kpi, {
    label: "Administrators",
    val: counts.admin,
    color: "#6a52d4"
  }), React.createElement(Kpi, {
    label: "Data collectors",
    val: counts.collector,
    color: "#3ab5a7"
  }), React.createElement(Kpi, {
    label: "Active",
    val: counts.active,
    color: "#1f9d57"
  })), err && React.createElement("div", {
    className: "card",
    style: {
      padding: '12px 16px',
      borderLeft: '4px solid #d23a52',
      fontSize: 12.5,
      color: '#b32339'
    }
  }, err, " ", String(err).toLowerCase().includes('administrator') ? '' : '· Is the server running with a database connection?'), React.createElement("div", {
    className: "card",
    style: {
      overflow: 'hidden'
    }
  }, React.createElement("div", {
    className: "card-h",
    style: {
      flexWrap: 'wrap',
      gap: 8
    }
  }, React.createElement("h3", null, "Accounts"), React.createElement("span", {
    className: "sub"
  }, shown.length, " of ", all.length, " shown"), React.createElement("span", {
    className: "spacer"
  }), React.createElement("div", {
    className: "tb-search",
    style: {
      width: 220,
      margin: 0
    }
  }, React.createElement(Ic, {
    d: I.search,
    s: 14
  }), React.createElement("input", {
    value: q,
    onChange: e => setQ(e.target.value),
    placeholder: "Search name or username\u2026"
  })), React.createElement("select", {
    style: sel,
    value: roleFilter,
    onChange: e => setRoleFilter(e.target.value)
  }, React.createElement("option", {
    value: "all"
  }, "All roles"), roles.map(r => React.createElement("option", {
    key: r,
    value: r
  }, UA_ROLE_LABEL[r] || r)))), React.createElement("div", {
    style: {
      overflowX: 'auto'
    }
  }, React.createElement("table", {
    className: "tbl"
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", {
    style: {
      textAlign: 'left'
    }
  }, "Name"), React.createElement("th", {
    style: {
      textAlign: 'left'
    }
  }, "Username"), React.createElement("th", {
    style: {
      textAlign: 'left'
    }
  }, "Role"), React.createElement("th", {
    style: {
      textAlign: 'center'
    }
  }, "Status"), React.createElement("th", {
    style: {
      textAlign: 'left'
    }
  }, "Scope"), React.createElement("th", {
    style: {
      textAlign: 'right'
    }
  }, "Actions"))), React.createElement("tbody", null, users === null && React.createElement("tr", null, React.createElement("td", {
    colSpan: 6,
    style: {
      textAlign: 'center',
      color: 'var(--muted)',
      padding: 24
    }
  }, "Loading\u2026")), users !== null && shown.length === 0 && React.createElement("tr", null, React.createElement("td", {
    colSpan: 6,
    style: {
      textAlign: 'center',
      color: 'var(--muted)',
      padding: 24
    }
  }, "No users", ql || roleFilter !== 'all' ? ' match the filter' : ' found', ".")), shown.map(u => {
    const [fg, bg] = uaRoleTone(u.role);
    const active = u.active !== false;
    const scope = u.role === 'Administrator' ? ['All workspaces'] : u.role === 'User' ? Array.isArray(u.modules) ? u.modules.length ? u.modules.map(m => UA_MODULE_LABEL[m] || m) : ['No access'] : ['All workspaces'] : [].concat(u.departments || []).concat(u.qualityAreas || []);
    return React.createElement("tr", {
      key: u.username
    }, React.createElement("td", {
      style: {
        textAlign: 'left'
      }
    }, React.createElement("b", {
      style: {
        color: 'var(--ink)'
      }
    }, u.name || u.username)), React.createElement("td", {
      style: {
        textAlign: 'left',
        fontFamily: 'var(--mono)',
        fontSize: 12
      }
    }, "@", u.username), React.createElement("td", {
      style: {
        textAlign: 'left'
      }
    }, React.createElement("span", {
      className: "chip",
      style: {
        background: bg,
        color: fg,
        fontWeight: 700
      }
    }, UA_ROLE_LABEL[u.role] || u.role)), React.createElement("td", {
      style: {
        textAlign: 'center'
      }
    }, React.createElement("span", {
      className: "chip",
      style: {
        background: active ? 'var(--pos-bg)' : '#eef1f5',
        color: active ? 'var(--pos)' : '#9aa6b4'
      }
    }, active ? 'Active' : 'Inactive')), React.createElement("td", {
      style: {
        textAlign: 'left',
        fontSize: 11.5,
        color: 'var(--muted)',
        maxWidth: 240
      }
    }, scope.length ? scope.join(', ') : '—'), React.createElement("td", {
      style: {
        textAlign: 'right',
        whiteSpace: 'nowrap'
      }
    }, React.createElement("button", {
      className: "btn sm",
      title: "Edit",
      onClick: () => setForm({
        user: u
      })
    }, React.createElement(Ic, {
      d: I.edit,
      s: 13
    })), ' ', React.createElement("button", {
      className: "btn sm",
      title: "Reset password",
      onClick: () => setPwUser(u)
    }, React.createElement(Ic, {
      d: I.gear,
      s: 13
    })), ' ', React.createElement("button", {
      className: "btn sm",
      title: active ? 'Deactivate' : 'Activate',
      onClick: () => setActive(u, !active)
    }, React.createElement(Ic, {
      d: active ? I.x : I.check,
      s: 13
    })), ' ', React.createElement("button", {
      className: "icon-btn danger",
      style: {
        width: 28,
        height: 28,
        display: 'inline-grid'
      },
      title: "Delete",
      onClick: () => del(u)
    }, React.createElement(Ic, {
      d: I.x,
      s: 14
    }))));
  }))))), form && React.createElement(UAUserForm, {
    user: form.user,
    roles: roles,
    onClose: () => setForm(null),
    onSaved: () => {
      setForm(null);
      load();
    }
  }), pwUser && React.createElement(UAPasswordForm, {
    user: pwUser,
    onClose: () => setPwUser(null),
    onSaved: () => setPwUser(null)
  }));
}
window.UserAdmin = UserAdmin;
})();
