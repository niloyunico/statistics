/* MY DEPARTMENT — one department's figures, its approved duty roster and a basic staff
 * list, read-only, for the departments an administrator picked for this person
 * (Access Control → My Department). Nothing here comes from the page snapshot: every
 * figure is fetched from /api/my-department, which checks the grant and the department
 * again. Printing is its own grant (My Department → Print), and the server records each
 * printout before the print window opens. Performance / appraisal data is never shown.
 */
(function () {
  const { useState, useEffect, useMemo } = React;
  const MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const SECTIONS = [['patient', 'Patient statistics'], ['quality', 'Quality indicators'], ['roster', 'Duty roster'], ['staff', 'Staff list']];
  const filled = (v) => v !== null && v !== '' && v !== undefined;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const ml = (m) => { const p = String(m).split('-'); return p[0] + ' ' + (p[1] ? '20' + p[1] : ''); };

  async function api(url, opts) {
    const r = await fetch(url, Object.assign({ credentials: 'same-origin', cache: 'no-store', headers: { accept: 'application/json', 'content-type': 'application/json' } }, opts || {}));
    if (r.status === 401 || r.redirected) throw new Error('Your session has expired. Sign in again.');
    const j = await r.json().catch(() => null);
    if (!j) throw new Error('The server did not answer. Please try again.');
    if (!j.ok) throw new Error(j.error || 'Something went wrong.');
    return j;
  }

  // ---- quality: one month's reading, formatted the way the indicator is measured ----
  const isPct = (ind) => /pct|percent/i.test(String(ind.formula || '')) || /%/.test(String(ind.unit || ''));
  const mult = (ind) => { const f = String(ind.formula || ''); return /1000/.test(f) ? 1000 : /100/.test(f) || isPct(ind) ? 100 : null; };
  function qValue(ind, m) {
    if (filled((ind.months || {})[m])) return Number(ind.months[m]);
    const n = (ind.num || {})[m], d = (ind.den || {})[m], k = mult(ind);
    if (filled(n) && filled(d) && Number(d) > 0 && k) return Math.round((Number(n) / Number(d)) * k * 100) / 100;
    return filled(n) ? Number(n) : null;
  }
  const qFmt = (ind, v) => (v == null ? '—' : (Math.round(v * 100) / 100) + (isPct(ind) ? '%' : ''));
  function qStatus(ind, v) {
    if (v == null || ind.benchmarkValue == null) return null;
    return ind.goalDirection === 'higher_is_better' ? (v >= ind.benchmarkValue ? 'ok' : 'bad') : (v <= ind.benchmarkValue ? 'ok' : 'bad');
  }
  const qCell = (ind, m) => ((ind.notObserved || {})[m] ? 'N/O' : qFmt(ind, qValue(ind, m)));

  // ---- patient statistics: months that hold anything, a total (or average for % columns) ----
  function patientTable(p) {
    const months = p.months.filter((m) => p.rows[m] && Object.keys(p.rows[m]).some((k) => filled(p.rows[m][k])));
    const foot = p.cols.map((c) => {
      const vals = months.map((m) => Number((p.rows[m] || {})[c.id])).filter((v) => Number.isFinite(v));
      if (!vals.length) return '';
      const sum = vals.reduce((a, b) => a + b, 0);
      return c.pct ? (Math.round((sum / vals.length) * 10) / 10) + '%' : Math.round(sum * 100) / 100;
    });
    return { months, foot };
  }
  const pCell = (c, v) => (filled(v) ? v + (c.pct ? '%' : '') : '—');

  function rosterDays(r) { return new Date(r.year, r.month + 1, 0).getDate(); }
  function rosterPeople(r) {
    const ids = (r.order && r.order.length ? r.order : Object.keys(r.grid || {}));
    return ids.filter((id) => r.grid && r.grid[id]).map((id) => ({ id, name: (r.names || {})[id] || id, row: r.grid[id] || {} }));
  }
  const shiftColor = (code) => { const R = window.UNICO_ROSTER; const b = R && R.bucketOf(code); return (R && b && R.BUCKET_COLOR[b]) || '#64748b'; };

  /* ---------------- the print page ----------------
     A formal document, not a screenshot: the hospital letterhead (logo + report title), a
     details strip (department, period, who printed it, a reference), numbered sections and
     a page footer with "Page x of y" (CSS @page margin boxes; a browser without them simply
     leaves the page footer out). Landscape A4, because the roster is 31 days wide. */
  /* Charts for paper: plain SVG strings (the print window has no React and no chart
     components), drawn in the screen's palette so the printout matches what was on screen. */
  const P_PAL = ['#0b66d0', '#0f9b8e', '#e08a1e', '#6a52d4', '#d23a52', '#2bb3a3', '#8a93a3', '#4f8df7'];
  const nf = (v) => String(Math.round(v * 100) / 100);
  const niceMax = (v) => { if (!(v > 0)) return 1; const e = Math.pow(10, Math.floor(Math.log10(v))); const f = v / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * e; };
  function svgBars(series, w, h) {   // series: [{ l, v }]
    const L = 30, B = 20, T = 14, R = 6, max = niceMax(Math.max.apply(null, series.map((d) => d.v).concat([0])));
    const iw = w - L - R, ih = h - T - B, bw = Math.min(34, (iw / Math.max(series.length, 1)) * 0.62);
    let g = '';
    for (let k = 0; k <= 4; k++) { const y = T + ih - (ih * k) / 4; g += '<line x1="' + L + '" x2="' + (w - R) + '" y1="' + y + '" y2="' + y + '" stroke="#e3e9f0" stroke-width="1"/><text x="' + (L - 5) + '" y="' + (y + 3) + '" text-anchor="end" font-size="8" fill="#8a96a6">' + nf((max * k) / 4) + '</text>'; }
    series.forEach((d, i) => {
      const cx = L + (iw * (i + 0.5)) / series.length, bh = (ih * d.v) / max;
      g += '<rect x="' + (cx - bw / 2) + '" y="' + (T + ih - bh) + '" width="' + bw + '" height="' + Math.max(bh, 0.5) + '" rx="2" fill="#0b66d0"/>'
        + '<text x="' + cx + '" y="' + (T + ih - bh - 3) + '" text-anchor="middle" font-size="8" font-weight="700" fill="#16202e">' + nf(d.v) + '</text>'
        + '<text x="' + cx + '" y="' + (h - 6) + '" text-anchor="middle" font-size="8" fill="#5b6878">' + esc(d.l) + '</text>';
    });
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="' + h + '" preserveAspectRatio="none" style="overflow:visible">' + g + '</svg>';
  }
  function svgDonut(items, centerLabel) {   // items: [{ label, value, color }]
    const total = items.reduce((a, d) => a + d.value, 0) || 1, r = 46, c = 2 * Math.PI * r;
    let off = 0, arcs = '';
    items.forEach((d) => { const len = (c * d.value) / total; arcs += '<circle r="' + r + '" cx="60" cy="60" fill="none" stroke="' + d.color + '" stroke-width="18" stroke-dasharray="' + len + ' ' + (c - len) + '" stroke-dashoffset="' + (-off) + '" transform="rotate(-90 60 60)"/>'; off += len; });
    const legend = items.map((d) => '<li><i style="background:' + d.color + '"></i><span>' + esc(d.label) + '</span><b>' + nf(d.value) + '</b><em>' + Math.round((d.value / total) * 100) + '%</em></li>').join('');
    return '<div class="donut"><svg viewBox="0 0 120 120" width="112" height="112">' + arcs
      + '<text x="60" y="58" text-anchor="middle" font-size="17" font-weight="700" fill="#0d1b2e">' + nf(total) + '</text><text x="60" y="72" text-anchor="middle" font-size="7.5" letter-spacing=".8" fill="#7b8796">' + esc(String(centerLabel).toUpperCase()) + '</text></svg><ul>' + legend + '</ul></div>';
  }
  function svgTrend(series, target, higher, w, h) {   // series: [{ l, v }], dashed target line
    const L = 26, B = 16, T = 8, R = 6, vals = series.map((d) => d.v).concat(target != null ? [target] : []);
    const max = niceMax(Math.max.apply(null, vals.concat([0]))), iw = w - L - R, ih = h - T - B;
    const x = (i) => L + (series.length > 1 ? (iw * i) / (series.length - 1) : iw / 2), y = (v) => T + ih - (ih * v) / max;
    let g = '<line x1="' + L + '" x2="' + (w - R) + '" y1="' + (T + ih) + '" y2="' + (T + ih) + '" stroke="#d9e2ec"/><text x="' + (L - 4) + '" y="' + (T + 3) + '" text-anchor="end" font-size="7" fill="#8a96a6">' + nf(max) + '</text>';
    if (target != null) g += '<line x1="' + L + '" x2="' + (w - R) + '" y1="' + y(target) + '" y2="' + y(target) + '" stroke="#e08a1e" stroke-width="1" stroke-dasharray="4 3"/>';
    g += '<polyline fill="none" stroke="#0090ca" stroke-width="1.6" points="' + series.map((d, i) => x(i) + ',' + y(d.v)).join(' ') + '"/>';
    series.forEach((d, i) => { const bad = target != null && (higher ? d.v < target : d.v > target); g += '<circle cx="' + x(i) + '" cy="' + y(d.v) + '" r="2.4" fill="' + (bad ? '#d23a52' : '#1f9d57') + '"/><text x="' + x(i) + '" y="' + (h - 4) + '" text-anchor="middle" font-size="7" fill="#7b8796">' + esc(d.l) + '</text>'; });
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="' + h + '" preserveAspectRatio="none" style="overflow:visible">' + g + '</svg>';
  }
  const chartBox = (title, inner, grow) => '<div class="chart' + (grow ? ' grow' : '') + '"><div class="ct">' + esc(title) + '</div>' + inner + '</div>';

  function printHtml(data, sections, opts) {
    const withCharts = !opts || opts.charts !== false;
    const me =(window.__UNICO_USER__ && (window.__UNICO_USER__.name || window.__UNICO_USER__.username)) || '';
    const now = new Date();
    const when = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' + now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const pad = (x) => String(x).padStart(2, '0');
    const ref = 'MD-' + String(data.dept.id || '').toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 10) + '-' + now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) + '-' + pad(now.getHours()) + pad(now.getMinutes());
    const logo = location.origin + '/unico/logo.svg';
    let n = 0;
    const head = (title, sub, brk) => '<div class="sec' + (brk ? ' pb' : '') + '"><div class="sh"><span class="no">' + (++n) + '</span><h2>' + esc(title) + '</h2>' + (sub ? '<span class="ss">' + esc(sub) + '</span>' : '') + '</div>';
    const none = (t) => '<p class="empty">' + esc(t) + '</p>';
    let body = '';
    if (sections.indexOf('patient') >= 0 && data.patient) {
      const p = data.patient; const t = patientTable(p);
      let pc = '';
      if (withCharts && t.months.length) {
        const totalCol = p.cols.find((c) => /^total$/i.test(String(c.label || c.id).trim()));
        const parts = p.cols.filter((c) => !c.pct && c !== totalCol);
        const row = (m) => p.rows[m] || {};
        const series = t.months.map((m) => ({ l: m.split('-')[0], v: totalCol ? (Number(row(m)[totalCol.id]) || 0) : parts.reduce((a, c) => a + (Number(row(m)[c.id]) || 0), 0) }));
        const mix = parts.map((c, i) => ({ label: c.label, value: t.months.reduce((a, m) => a + (Number(row(m)[c.id]) || 0), 0), color: P_PAL[i % P_PAL.length] })).filter((d) => d.value > 0);
        pc = '<div class="charts">' + chartBox('Monthly total · ' + data.year, svgBars(series, 640, 165), true) + (mix.length > 1 ? chartBox('Year mix · ' + data.year, svgDonut(mix, 'Total')) : '') + '</div>';
      }
      body += head('Patient statistics', 'Calendar year ' + data.year + ' · monthly figures') + pc + (t.months.length
        ? '<table><thead><tr><th>Month</th>' + p.cols.map((c) => '<th class="r">' + esc(c.label) + '</th>').join('') + '</tr></thead><tbody>'
          + t.months.map((m) => '<tr><td class="lb">' + esc(ml(m)) + '</td>' + p.cols.map((c) => '<td class="r">' + esc(pCell(c, p.rows[m][c.id])) + '</td>').join('') + '</tr>').join('')
          + '</tbody><tfoot><tr><td class="lb">Total / average</td>' + t.foot.map((v) => '<td class="r">' + esc(v) + '</td>').join('') + '</tr></tfoot></table>'
          + '<p class="note">Percentage columns show the average of the months recorded; all other columns show the total.</p>'
        : none('No figures recorded for ' + data.year + '.')) + '</div>';
    }
    if (sections.indexOf('quality') >= 0 && data.quality) {
      const q = data.quality; const months = (data.patient && data.patient.months) || MONS.map((m) => m + '-' + String(data.year % 100).padStart(2, '0'));
      const used = months.filter((m) => q.indicators.some((i) => qValue(i, m) != null || (i.notObserved || {})[m]));
      let qc = '';
      if (withCharts && used.length) {
        let ok = 0, bad = 0;
        q.indicators.forEach((i) => used.forEach((m) => { const st = qStatus(i, qValue(i, m)); if (st === 'ok') ok++; else if (st === 'bad') bad++; }));
        const split = [{ label: 'Within target', value: ok, color: '#1f9d57' }, { label: 'Outside target', value: bad, color: '#d23a52' }].filter((d) => d.value > 0);
        const minis = q.indicators.map((i) => ({ i, sr: used.filter((m) => qValue(i, m) != null).map((m) => ({ l: m.split('-')[0], v: qValue(i, m) })) })).filter((x) => x.sr.length);
        qc = (split.length ? '<div class="charts">' + chartBox('Readings against target · ' + data.year, svgDonut(split, 'Readings')) + '<div class="chart grow"><div class="ct">How to read the trends</div><p class="note" style="margin:2px 0 0">Each panel is one indicator across the months reported. <span class="key ok"></span>On target <span class="key bad"></span>Off target; the dashed orange line is the target.</p></div></div>' : '')
          + (minis.length ? '<div class="minis">' + minis.map((x) => '<div class="mini"><div class="mt">' + esc(x.i.name) + (x.i.benchmarkValue != null ? ' <span>· target ' + esc(qFmt(x.i, x.i.benchmarkValue)) + '</span>' : '') + '</div>'
            + svgTrend(x.sr, x.i.benchmarkValue, x.i.goalDirection === 'higher_is_better', 240, 78) + '</div>').join('') + '</div>' : '');
      }
      body += head('Quality indicators', q.name + ' · ' + data.year) + qc + (used.length
        ? '<table><thead><tr><th>Indicator</th><th>Target</th>' + used.map((m) => '<th class="r">' + esc(MONS[MONS.indexOf(m.split('-')[0])]) + '</th>').join('') + '</tr></thead><tbody>'
          + q.indicators.map((i) => '<tr><td class="lb">' + esc(i.name) + '</td><td class="tg">' + esc(i.benchmark || (i.benchmarkValue != null ? i.benchmarkValue : '—')) + '</td>' + used.map((m) => { const st = qStatus(i, qValue(i, m)); return '<td class="r ' + (st || '') + '">' + esc(qCell(i, m)) + '</td>'; }).join('') + '</tr>').join('')
          + '</tbody></table><p class="note"><span class="key ok"></span>Within target <span class="key bad"></span>Outside target &nbsp;·&nbsp; N/O = not observed that month</p>'
        : none('No quality readings recorded for ' + data.year + '.')) + '</div>';
    }
    if (sections.indexOf('roster') >= 0) {
      const r = data.roster;
      if (!r) body += head('Duty roster', MONS[data.month] + ' ' + data.year) + none('No approved duty roster for this month.') + '</div>';
      else {
        const days = rosterDays(r); const ppl = rosterPeople(r); const d = Array.from({ length: days }, (_, i) => i + 1);
        const dow = (x) => 'SMTWTFS'[new Date(r.year, r.month, x).getDay()];
        const wk = (x) => (new Date(r.year, r.month, x).getDay() === 5 ? ' class="we"' : '');   // Friday, the weekly holiday
        body += head('Duty roster', MONS[r.month] + ' ' + r.year + ' · approved', true)
          + '<table class="ros"><thead><tr><th class="nm">Name</th>' + d.map((x) => '<th' + wk(x) + '>' + x + '<small>' + dow(x) + '</small></th>').join('') + '</tr></thead><tbody>'
          + ppl.map((p) => '<tr><td class="nm">' + esc(p.name) + '</td>' + d.map((x) => '<td' + wk(x) + '>' + esc(p.row[x] || '') + '</td>').join('') + '</tr>').join('')
          + '</tbody></table>'
          + '<div class="signs"><div><span>Prepared by</span><b>' + esc(r.preparedBy || '—') + '</b></div><div><span>Checked by</span><b>' + esc(r.checkedBy || '—') + '</b></div><div><span>Approved by</span><b>' + esc(r.approvedBy || '—') + '</b></div></div>'
          + '</div>';
      }
    }
    if (sections.indexOf('staff') >= 0) {
      const st = data.staff || [];
      let sc = '';
      if (withCharts && st.length) {
        const by = {}; st.forEach((x) => { const k = x.designation || x.role || 'Not set'; by[k] = (by[k] || 0) + 1; });
        const mix = Object.keys(by).sort((a, b) => by[b] - by[a]).map((k, i) => ({ label: k, value: by[k], color: P_PAL[i % P_PAL.length] }));
        sc = '<div class="charts">' + chartBox('Staff by designation', svgDonut(mix, 'Staff')) + '<div class="chart grow" style="visibility:hidden"></div></div>';
      }
      body += head('Staff list', st.length + ' current staff', st.length > 0) + sc + (st.length
        ? '<table><thead><tr><th class="c">#</th><th>Name</th><th>Designation</th><th>Employee no.</th><th>Joined</th></tr></thead><tbody>'
          + st.map((x, i) => '<tr><td class="c mu">' + (i + 1) + '</td><td class="lb">' + esc(x.name) + '</td><td>' + esc(x.designation || x.role || '') + '</td><td class="mono">' + esc(x.emp_id || '') + '</td><td>' + esc(x.doj || '') + '</td></tr>').join('') + '</tbody></table>'
        : none('No current staff recorded for this department.')) + '</div>';
    }
    const runHead = ('UNICO Hospitals · ' + data.dept.name + ' · Department Report ' + data.year).replace(/["\\]/g, '');
    const css = ''
      + '@page{size:A4 landscape;margin:14mm 14mm 16mm;'
      + '@top-left{content:"' + runHead + '";font:600 7.5pt Arial,sans-serif;color:#7b8796}'
      + '@bottom-left{content:"Confidential · for internal use of UNICO Hospitals";font:7pt Arial,sans-serif;color:#9aa5b2}'
      + '@bottom-right{content:"Page " counter(page) " of " counter(pages);font:600 7.5pt Arial,sans-serif;color:#5b6878}}'
      + '@page :first{@top-left{content:none}}'
      + '*{box-sizing:border-box}html{-webkit-print-color-adjust:exact;print-color-adjust:exact}'
      + 'body{font:10pt/1.45 "Segoe UI",Arial,sans-serif;color:#16202e;margin:0;padding:18px}@media print{body{padding:0}}'
      // letterhead
      + '.lh{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;padding-bottom:12px;border-bottom:1px solid #d9e2ec}'
      + '.lh img{height:46px;width:auto;display:block}.lh .tt{text-align:right}'
      + '.lh .kind{font-size:7.5pt;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#0072a3}'
      + '.lh h1{margin:3px 0 0;font-size:17pt;line-height:1.15;font-weight:700;color:#0d1b2e}'
      + '.lh .per{margin-top:2px;font-size:9pt;color:#5b6878}'
      + '.bar{height:3px;background:linear-gradient(90deg,#0072a3,#27a8db 55%,#3ab5a7);border-radius:0 0 2px 2px}'
      // details strip
      + '.meta{display:grid;grid-template-columns:repeat(5,1fr);margin:12px 0 4px;border:1px solid #d9e2ec;border-radius:6px;overflow:hidden}'
      + '.meta div{padding:7px 10px;border-right:1px solid #e3e9f0;background:#f6f9fc;min-width:0}.meta div:last-child{border-right:0}'
      + '.meta span{display:block;font-size:6.5pt;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#7b8796}'
      + '.meta b{display:block;margin-top:1px;font-size:9pt;font-weight:600;color:#16202e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
      // sections
      + '.sec{margin-top:18px}.sh{display:flex;align-items:center;gap:9px;margin-bottom:7px;padding-bottom:5px;border-bottom:1px solid #e3e9f0}'
      + '.sh .no{width:19px;height:19px;border-radius:5px;background:#0072a3;color:#fff;font-size:8.5pt;font-weight:700;display:grid;place-items:center;flex-shrink:0}'
      + '.sh h2{margin:0;font-size:12pt;font-weight:700;color:#0d1b2e}.sh .ss{margin-left:auto;font-size:8.5pt;color:#7b8796}'
      // tables
      + 'table{border-collapse:collapse;width:100%;font-size:8.6pt;font-variant-numeric:tabular-nums}'
      + 'thead{display:table-header-group}tr{page-break-inside:avoid}'
      + 'th{background:#0d3a5c;color:#fff;font-size:7pt;font-weight:700;letter-spacing:.5px;text-transform:uppercase;text-align:left;padding:6px 7px;border:1px solid #0d3a5c}'
      + 'td{padding:5px 7px;border-bottom:1px solid #e3e9f0;border-left:1px solid #eef2f6;border-right:1px solid #eef2f6;vertical-align:top}'
      + 'tbody tr:nth-child(even) td{background:#f7fafc}'
      + 'tfoot td{background:#e6f1f8!important;font-weight:700;border-top:1.5px solid #0072a3;border-bottom:1.5px solid #0072a3}'
      + '.r{text-align:right}.c{text-align:center}.lb{font-weight:600}.mu{color:#7b8796}.tg{color:#5b6878;white-space:nowrap}.mono{font-family:Consolas,monospace}'
      + 'td.bad{color:#b4233c;font-weight:700;background:#fdf0f2!important}td.ok{color:#14713f}'
      + '.note{margin:5px 0 0;font-size:7.5pt;color:#7b8796}.empty{margin:4px 0;padding:10px 12px;border:1px dashed #cfd8e3;border-radius:6px;color:#7b8796;font-size:9pt}'
      + '.key{display:inline-block;width:8px;height:8px;border-radius:2px;margin:0 4px 0 8px;vertical-align:-1px}.key:first-child{margin-left:0}.key.ok{background:#14713f}.key.bad{background:#b4233c}'
      // roster
      + '.ros{font-size:7pt}.ros th,.ros td{padding:3px 1px;text-align:center}.ros th small{display:block;font-size:5.5pt;font-weight:600;opacity:.75;letter-spacing:0}'
      + '.ros .nm{text-align:left;white-space:nowrap;padding:3px 6px;font-weight:600}.ros td.we{background:#fff6e5!important}.ros th.we{background:#8a5a00;border-color:#8a5a00}'
      + '.signs{display:flex;gap:28px;margin-top:9px;font-size:8.5pt}.signs span{display:block;font-size:6.5pt;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#7b8796}.signs b{font-weight:600}'
      // charts
      + '.charts{display:flex;gap:12px;margin:0 0 10px;page-break-inside:avoid}.chart{flex:1 1 0;min-width:0;border:1px solid #e3e9f0;border-radius:6px;padding:8px 10px 6px;background:#fff}.chart.grow{flex:2 1 0}'
      + '.ct{font-size:7pt;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:#5b6878;margin-bottom:5px}'
      + '.donut{display:flex;align-items:center;gap:12px}.donut svg{flex-shrink:0}.donut ul{list-style:none;margin:0;padding:0;flex:1;min-width:0;font-size:8pt}'
      + '.donut li{display:flex;align-items:center;gap:6px;padding:2px 0;border-bottom:1px dotted #e3e9f0}.donut li:last-child{border-bottom:0}.donut i{width:8px;height:8px;border-radius:2px;flex-shrink:0}'
      + '.donut span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.donut b{font-weight:700}.donut em{font-style:normal;color:#7b8796;width:30px;text-align:right}'
      + '.minis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:0 0 10px}.mini{border:1px solid #e3e9f0;border-radius:6px;padding:6px 8px 2px;page-break-inside:avoid;min-width:0}'
      + '.mt{font-size:7.5pt;font-weight:700;color:#16202e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px}.mt span{font-weight:500;color:#7b8796}'
      + '.pb{page-break-before:always}'
      // closing line
      + '.end{margin-top:22px;padding-top:7px;border-top:1px solid #e3e9f0;display:flex;justify-content:space-between;gap:16px;font-size:7.5pt;color:#7b8796}'
      + '.cr{margin-top:6px;text-align:center;font-size:6.5px;letter-spacing:.2px;color:#a3adba}';
    return '<!doctype html><html><head><meta charset="utf-8"><title>' + esc(data.dept.name) + ' — Department Report ' + esc(data.year) + '</title><style>' + css + '</style></head><body>'
      + '<header class="lh"><img src="' + esc(logo) + '" alt="UNICO Hospitals"><div class="tt"><div class="kind">Department Report</div><h1>' + esc(data.dept.name) + '</h1><div class="per">Reporting year ' + esc(data.year) + '</div></div></header><div class="bar"></div>'
      + '<div class="meta"><div><span>Department</span><b>' + esc(data.dept.name) + '</b></div><div><span>Period</span><b>Jan – Dec ' + esc(data.year) + '</b></div>'
      + '<div><span>Printed by</span><b>' + esc(me || '—') + '</b></div><div><span>Printed on</span><b>' + esc(when) + '</b></div><div><span>Reference</span><b>' + esc(ref) + '</b></div></div>'
      + body
      + '<div class="end"><span>Figures as recorded in UNICO on ' + esc(when) + '. Read-only extract of approved data.</span><span>Ref. ' + esc(ref) + '</span></div>'
      + '<div class="cr">Automatically generated by the system · Developed by Nasif Ahammed Niloy</div>'
      + '<script>window.onload=function(){setTimeout(function(){window.print();},150);};<\/script></body></html>';
  }

  function PrintDialog({ data, current, onClose }) {
    const avail = SECTIONS.filter(([k]) => k !== 'patient' || data.patient).filter(([k]) => k !== 'quality' || data.quality);
    // Starts with the section on screen only; the others are ticked on purpose.
    const [pick, setPick] = useState(() => { const k = avail.some(([x]) => x === current) ? current : (avail[0] && avail[0][0]); return k ? [k] : []; });
    const [charts, setCharts] = useState(true);
    const charted = pick.some((k) => k !== 'roster');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const toggle = (k) => setPick((p) => (p.indexOf(k) >= 0 ? p.filter((x) => x !== k) : p.concat([k])));
    const go = async () => {
      if (!pick.length || busy) return;
      setBusy(true); setErr('');
      // Open the window inside the click (pop-up blockers), fill it only once the server has recorded the print.
      const w = window.open('', '_blank');
      try {
        await api('/api/my-department/print', { method: 'POST', body: JSON.stringify({ dept: data.dept.id, year: data.year, month: data.month, sections: pick }) });
        if (!w) { setErr('Allow pop-ups for this site to print.'); setBusy(false); return; }
        w.document.open(); w.document.write(printHtml(data, pick, { charts })); w.document.close();
        onClose();
      } catch (e) { if (w) w.close(); setErr(e.message); setBusy(false); }
    };
    return (
      <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', zIndex: 400, display: 'grid', placeItems: 'center', padding: 16 }}>
        <div className="card" style={{ width: 'min(420px,100%)', padding: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>Print {data.dept.name}</div>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 12 }}>Choose what goes on paper. Every printout is recorded in the activity log.</div>
          {avail.map(([k, label]) => (
            <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 0', fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={pick.indexOf(k) >= 0} onChange={() => toggle(k)} />{label}
              {k === 'roster' && <span style={{ fontSize: 11, color: 'var(--muted)' }}>· {MONS[data.month]} {data.year}</span>}
            </label>
          ))}
          <label style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 0 2px', marginTop: 6, borderTop: '1px solid var(--line-2)', fontSize: 13, cursor: charted ? 'pointer' : 'default', opacity: charted ? 1 : 0.5 }}>
            <input type="checkbox" checked={charts && charted} disabled={!charted} onChange={() => setCharts((v) => !v)} />Include charts
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>· above each table</span>
          </label>
          {err && <div style={{ color: 'var(--rose)', fontSize: 12, marginTop: 8 }}>{err}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14, flexWrap: 'wrap' }}>
            <button className="btn sm" onClick={() => setPick(avail.map(([k]) => k))}>Select everything</button>
            <button className="btn sm" onClick={onClose}>Cancel</button>
            <button className="btn pri sm" disabled={!pick.length || busy} onClick={go}>{busy ? 'Preparing…' : 'Print'}</button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------------- the screen ---------------- */
  const th = { textAlign: 'left', padding: '8px 10px', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.3px', color: 'var(--muted)', fontWeight: 700, borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap', background: 'var(--blue-50)' };
  const thr = Object.assign({}, th, { textAlign: 'right' });
  const td = { padding: '7px 10px', fontSize: 12.5, color: 'var(--ink-2)', borderBottom: '1px solid var(--line-2)', whiteSpace: 'nowrap' };
  const tdr = Object.assign({}, td, { textAlign: 'right', fontVariantNumeric: 'tabular-nums' });
  const scroll = { overflowX: 'auto', WebkitOverflowScrolling: 'touch' };
  const Empty = ({ children }) => <div style={{ padding: '22px 8px', textAlign: 'center', color: 'var(--muted)', fontSize: 12.5 }}>{children}</div>;

  /* ---- charts: the app's own components (charts.jsx / charts-extra.jsx), one row of panels
     above each table, stacking on a phone ---- */
  const PAL = () => window.PALETTE || ['#0b66d0', '#0f9b8e', '#e08a1e', '#6a52d4', '#d23a52', '#2bb3a3', '#8a93a3', '#4f8df7'];
  const hasChart = (n) => typeof window[n] === 'function';
  const ChartRow = ({ children }) => <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid var(--line-2)' }}>{children}</div>;
  const Panel = ({ title, right, grow, children }) => (
    <div style={{ flex: grow ? '2 1 360px' : '1 1 240px', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>{title}</span><span style={{ flex: 1 }} />{right}
      </div>
      {children}
    </div>
  );
  const miniSel = { padding: '4px 8px', borderRadius: 7, border: '1px solid var(--line)', background: '#fff', fontFamily: 'inherit', fontSize: 11.5, color: 'var(--ink-2)', maxWidth: 220 };
  const Seg = ({ value, onChange, opts }) => (
    <span style={{ display: 'inline-flex', border: '1px solid var(--line)', borderRadius: 7, overflow: 'hidden' }}>
      {opts.map(([v, l]) => <button key={v} type="button" onClick={() => onChange(v)} style={{ border: 0, padding: '4px 10px', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', background: value === v ? 'var(--blue)' : '#fff', color: value === v ? '#fff' : 'var(--ink-2)' }}>{l}</button>)}
    </span>
  );
  // Donut draws its own legend underneath.
  const DonutBox = ({ data, label, value }) => (data.length && hasChart('Donut')
    ? React.createElement(window.Donut, { data, size: 150, thickness: 24, centerLabel: label, centerValue: value })
    : <Empty>Nothing to chart.</Empty>);

  function PatientTab({ p, year }) {
    const [metric, setMetric] = useState('');
    const [kind, setKind] = useState('bar');
    if (!p) return <Empty>This department reports quality indicators only.</Empty>;
    const t = patientTable(p);
    if (!t.months.length) return <Empty>No patient statistics recorded for {year}.</Empty>;
    const col = p.cols.find((c) => c.id === metric) || p.cols[0];
    const series = col ? t.months.map((m) => ({ mon: m.split('-')[0], v: Number((p.rows[m] || {})[col.id]) || 0 })) : [];
    // A department's own Total column is the sum of the others, not a slice of them.
    const mix = p.cols.filter((c) => !c.pct && !/^total$/i.test(String(c.label || c.id).trim())).map((c, i) => ({ label: c.label, value: t.months.reduce((a, m) => a + (Number((p.rows[m] || {})[c.id]) || 0), 0), color: PAL()[i % PAL().length] })).filter((d) => d.value > 0);
    return (
      <div>
      <ChartRow>
        <Panel grow title={(col ? col.label : '') + ' · ' + year}
          right={<React.Fragment>
            {p.cols.length > 1 && <select style={miniSel} value={col ? col.id : ''} onChange={(e) => setMetric(e.target.value)}>{p.cols.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>}
            <Seg value={kind} onChange={setKind} opts={[['bar', 'Bar'], ['line', 'Line']]} />
          </React.Fragment>}>
          {kind === 'line' && hasChart('LineChart') ? React.createElement(window.LineChart, { data: series, x: 'mon', y: 'v', height: 220, color: '#0090ca' })
            : hasChart('BarChart') ? React.createElement(window.BarChart, { data: series, x: 'mon', y: 'v', height: 220, label: 'md' + (col ? col.id : '') }) : null}
        </Panel>
        {mix.length > 1 && <Panel title={'Year mix · ' + year}><DonutBox data={mix} label="Total" value={mix.reduce((a, d) => a + d.value, 0)} /></Panel>}
      </ChartRow>
      <div style={scroll}><table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead><tr><th style={th}>Month</th>{p.cols.map((c) => <th key={c.id} style={thr}>{c.label}</th>)}</tr></thead>
        <tbody>
          {t.months.map((m) => <tr key={m}><td style={td}>{ml(m)}</td>{p.cols.map((c) => <td key={c.id} style={tdr}>{pCell(c, p.rows[m][c.id])}</td>)}</tr>)}
          <tr><td style={Object.assign({}, td, { fontWeight: 800 })}>Total / average</td>{t.foot.map((v, i) => <td key={i} style={Object.assign({}, tdr, { fontWeight: 800, background: 'var(--blue-50)' })}>{v}</td>)}</tr>
        </tbody>
      </table></div>
      </div>
    );
  }

  function QualityTab({ q, months, year }) {
    const [pick, setPick] = useState('');
    if (!q || !q.indicators.length) return <Empty>No quality indicators for this department.</Empty>;
    const used = months.filter((m) => q.indicators.some((i) => qValue(i, m) != null || (i.notObserved || {})[m]));
    if (!used.length) return <Empty>No quality readings recorded for {year}.</Empty>;
    const tone = (s) => (s === 'ok' ? { color: '#14713f', fontWeight: 700 } : s === 'bad' ? { color: '#b4233c', fontWeight: 700 } : {});
    const withData = q.indicators.filter((i) => used.some((m) => qValue(i, m) != null));
    const ind = withData.find((i) => i.id === pick) || withData[0];
    const series = ind ? used.filter((m) => qValue(ind, m) != null).map((m) => ({ mon: m.split('-')[0], v: qValue(ind, m) })) : [];
    let ok = 0, bad = 0;
    q.indicators.forEach((i) => used.forEach((m) => { const st = qStatus(i, qValue(i, m)); if (st === 'ok') ok++; else if (st === 'bad') bad++; }));
    const split = [{ label: 'Within target', value: ok, color: '#1f9d57' }, { label: 'Outside target', value: bad, color: '#d23a52' }].filter((d) => d.value > 0);
    return (
      <div>
      <ChartRow>
        {ind && <Panel grow title={ind.name + (ind.benchmarkValue != null ? ' · target ' + qFmt(ind, ind.benchmarkValue) : '')}
          right={withData.length > 1 && <select style={miniSel} value={ind.id} onChange={(e) => setPick(e.target.value)}>{withData.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select>}>
          {hasChart('AreaTargetChart') ? React.createElement(window.AreaTargetChart, { data: series, x: 'mon', y: 'v', target: ind.benchmarkValue, height: 220, color: '#0090ca' })
            : hasChart('LineChart') ? React.createElement(window.LineChart, { data: series, x: 'mon', y: 'v', height: 220 }) : null}
        </Panel>}
        <Panel title={'Readings against target · ' + year}><DonutBox data={split} label="Readings" value={ok + bad} /></Panel>
      </ChartRow>
      <div style={scroll}><table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead><tr><th style={th}>Indicator</th><th style={th}>Target</th>{used.map((m) => <th key={m} style={thr}>{m.split('-')[0]}</th>)}</tr></thead>
        <tbody>{q.indicators.map((i) => (
          <tr key={i.id}><td style={Object.assign({}, td, { whiteSpace: 'normal', minWidth: 200, fontWeight: 600 })}>{i.name}</td>
            <td style={Object.assign({}, td, { color: 'var(--muted)' })}>{i.benchmark || (i.benchmarkValue != null ? i.benchmarkValue : '—')}</td>
            {used.map((m) => <td key={m} style={Object.assign({}, tdr, tone(qStatus(i, qValue(i, m))))}>{qCell(i, m)}</td>)}</tr>
        ))}</tbody>
      </table>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>Green = within target · red = outside target · N/O = not observed that month.</div></div>
      </div>
    );
  }

  function RosterTab({ r, month, year }) {
    if (!r) return <Empty>No approved duty roster for {MONS[month]} {year}. Drafts and rosters awaiting sign-off are not shown.</Empty>;
    const days = rosterDays(r); const ppl = rosterPeople(r); const d = Array.from({ length: days }, (_, i) => i + 1);
    const cell = { padding: '4px 3px', fontSize: 10.5, textAlign: 'center', borderBottom: '1px solid var(--line-2)', minWidth: 26 };
    const R = window.UNICO_ROSTER;
    const counts = {};
    const dutyDays = ppl.map((p) => {
      let n = 0;
      d.forEach((x) => { const c = p.row[x]; if (!c) return; const b = (R && R.bucketOf(c)) || 'O'; counts[b] = (counts[b] || 0) + 1; if (R ? R.isDuty(c) : b !== 'O') n++; });
      return { label: p.name, value: n, color: '#0090ca' };
    }).sort((a, b) => b.value - a.value).slice(0, 10);
    const mix = ((R && R.BUCKETS) || []).map((b) => ({ label: b.label, value: counts[b.id] || 0, color: b.color })).filter((x) => x.value > 0);
    return (
      <div>
        <ChartRow>
          <Panel title={'Shift mix · ' + MONS[r.month] + ' ' + r.year}><DonutBox data={mix} label="Shifts" value={mix.reduce((a, x) => a + x.value, 0)} /></Panel>
          <Panel grow title="Duty days per person (top 10)">{dutyDays.length && hasChart('HBar') ? React.createElement(window.HBar, { rows: dutyDays }) : <Empty>Nothing to chart.</Empty>}</Panel>
        </ChartRow>
        <div style={scroll}><table style={{ borderCollapse: 'collapse' }}>
          <thead><tr><th style={Object.assign({}, th, { position: 'sticky', left: 0 })}>Name</th>{d.map((x) => <th key={x} style={Object.assign({}, th, { textAlign: 'center', padding: '6px 3px' })}>{x}</th>)}</tr></thead>
          <tbody>{ppl.map((p) => (
            <tr key={p.id}><td style={Object.assign({}, td, { position: 'sticky', left: 0, background: 'var(--card, #fff)', fontWeight: 600 })}>{p.name}</td>
              {d.map((x) => { const c = p.row[x]; return <td key={x} style={cell}>{c ? <span style={{ color: shiftColor(c), fontWeight: 700 }}>{c}</span> : ''}</td>; })}</tr>
          ))}</tbody>
        </table></div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>Prepared by {r.preparedBy || '—'} · Checked by {r.checkedBy || '—'} · Approved by {r.approvedBy || '—'}</div>
      </div>
    );
  }

  function StaffTab({ s }) {
    if (!s || !s.length) return <Empty>No current staff recorded for this department.</Empty>;
    const by = {};
    s.forEach((x) => { const k = x.designation || x.role || 'Not set'; by[k] = (by[k] || 0) + 1; });
    const mix = Object.keys(by).sort((a, b) => by[b] - by[a]).map((k, i) => ({ label: k, value: by[k], color: PAL()[i % PAL().length] }));
    return (
      <div>
      <ChartRow><Panel title="Staff by designation"><DonutBox data={mix} label="Staff" value={s.length} /></Panel></ChartRow>
      <div style={scroll}><table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead><tr><th style={th}>#</th><th style={th}>Name</th><th style={th}>Designation</th><th style={th}>Employee no.</th><th style={th}>Joined</th></tr></thead>
        <tbody>{s.map((x, i) => <tr key={x.id || i}><td style={td}>{i + 1}</td><td style={Object.assign({}, td, { fontWeight: 600 })}>{x.name}</td><td style={td}>{x.designation || x.role || '—'}</td><td style={td}>{x.emp_id || '—'}</td><td style={td}>{x.doj || '—'}</td></tr>)}</tbody>
      </table></div>
      </div>
    );
  }

  function MyDepartment() {
    const now = new Date();
    const [list, setList] = useState(null);
    const [listErr, setListErr] = useState('');
    const [dept, setDept] = useState('');
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth());
    const [tab, setTab] = useState('patient');
    const [data, setData] = useState(null);
    const [err, setErr] = useState('');
    const [busy, setBusy] = useState(false);
    const [printing, setPrinting] = useState(false);

    useEffect(() => {
      api('/api/my-department').then((j) => { setList(j.departments || []); if ((j.departments || [])[0]) setDept(j.departments[0].id); })
        .catch((e) => { setListErr(e.message); setList([]); });
    }, []);
    useEffect(() => {
      if (!dept) return;
      let dead = false; setBusy(true);
      api('/api/my-department/' + encodeURIComponent(dept) + '?year=' + year + '&month=' + month)
        .then((j) => { if (!dead) { setData(j); setErr(''); if (!j.patient && tab === 'patient') setTab('quality'); } })
        .catch((e) => { if (!dead) { setErr(e.message); setData(null); } })
        .then(() => { if (!dead) setBusy(false); });
      return () => { dead = true; };
    }, [dept, year, month]);

    const years = useMemo(() => { const y = now.getFullYear(); return [y, y - 1, y - 2, y - 3]; }, []);
    const months = (data && data.patient && data.patient.months) || MONS.map((m) => m + '-' + String(year % 100).padStart(2, '0'));
    const sel = { padding: '7px 10px', borderRadius: 8, border: '1px solid var(--line)', background: '#fff', fontFamily: 'inherit', fontSize: 12.5, color: 'var(--ink-2)' };
    const tabs = [['patient', 'Patient statistics'], ['quality', 'Quality indicators'], ['roster', 'Duty roster'], ['staff', 'Staff']];

    if (list === null) return <div className="card" style={{ color: 'var(--muted)' }}>Loading…</div>;
    if (listErr) return <div className="card" style={{ color: 'var(--rose)' }}>{listErr}</div>;
    if (!list.length) return <div className="card" style={{ color: 'var(--muted)' }}>No department has been set for you yet. Ask the administrator to choose your department in Access Control → My Department.</div>;

    return (
      <div className="grid" style={{ gap: 14 }}>
        <SectionTitle icon={I.layers} title={'My Department' + (data ? ' — ' + data.dept.name : '')} sub="Your department's figures, approved duty roster and staff list. Read-only."
          right={data && data.canPrint ? <button className="btn pri sm" onClick={() => setPrinting(true)}><Ic d={I.doc} s={13} />Print</button> : null} />
        <div className="card" style={{ padding: '10px 14px', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {list.length > 1 && <select style={sel} value={dept} onChange={(e) => setDept(e.target.value)}>{list.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>}
          <select style={sel} value={year} onChange={(e) => setYear(Number(e.target.value))}>{years.map((y) => <option key={y} value={y}>{y}</option>)}</select>
          {tab === 'roster' && <select style={sel} value={month} onChange={(e) => setMonth(Number(e.target.value))}>{MONS.map((m, i) => <option key={m} value={i}>{m}</option>)}</select>}
          <span style={{ flex: 1 }} />
          {busy && <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>Loading…</span>}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {tabs.map(([k, label]) => (
            <button key={k} className={'btn sm' + (tab === k ? ' pri' : '')} onClick={() => setTab(k)}>{label}</button>
          ))}
        </div>
        <div className="card" style={{ padding: '14px 16px' }}>
          {err ? <div style={{ color: 'var(--rose)', fontSize: 12.5 }}>{err}</div>
            : !data ? <Empty>Loading…</Empty>
              : tab === 'patient' ? <PatientTab p={data.patient} year={data.year} />
                : tab === 'quality' ? <QualityTab q={data.quality} months={months} year={data.year} />
                  : tab === 'roster' ? <RosterTab r={data.roster} month={data.month} year={data.year} />
                    : <StaffTab s={data.staff} />}
        </div>
        {printing && data && <PrintDialog data={data} current={tab} onClose={() => setPrinting(false)} />}
      </div>
    );
  }

  window.MyDepartment = MyDepartment;
})();
