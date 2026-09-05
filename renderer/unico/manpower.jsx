/* MANPOWER OVERVIEW — live staffing command view for the whole hospital.
 *
 * UI ported 1:1 from the approved Claude-Design canvas "Manpower Overview v2.dc.html";
 * the DATA is real: units come from the staff register (grouped exactly the way the
 * Duty Roster module groups them — the raw `current_department` string), the per-day
 * duty codes come from each unit's saved roster sheet (GET /api/rosters/:dept/:y/:m,
 * grid keyed 'S'+staff.id like roster.jsx's rosKey), and the per-shift requirement
 * comes from that sheet's own rules (rules.cfg.minM/E/N, with the legacy
 * minMorning/... keys honoured). A month with no sheet shows 0 on duty against the
 * default minimums and a "No roster" chip — an unplanned month IS uncovered.
 *
 * G (general/office-hours) shifts count toward BOTH Morning and Evening cover —
 * a 9–5 nurse is present through most of both windows.
 *
 * This screen is read-only by design: moving a nurse to another shift happens in the
 * real roster editor (the popup's "Full roster" opens that unit's month), never here —
 * a second write path would silently diverge from the sheet.
 *
 * Published as window.ManpowerOverview (every bundled file is its own IIFE).
 */
(function () {
  const { useState, useEffect, useRef, useMemo } = React;
  const R = window.UNICO_ROSTER;

  const DIVS = [['ce', 'Critical & Emergency', '#0090ca'], ['pr', 'Procedural', '#6a52d4'], ['ip', 'In-Patient Wards', '#3ab5a7'], ['op', 'Out-Patient', '#e08a1e']];
  const SHIFTS = [['M', 'Morning', '08–14'], ['E', 'Evening', '14–20'], ['N', 'Night', '20–08']];
  const DESIG = [['CN', 'Charge Nurse', '#0d1b2e'], ['SSN', 'Senior Staff Nurse', '#6a52d4'], ['SN', 'Staff Nurse', '#0090ca'], ['PCA', 'PCA', '#3ab5a7']];
  const MONO = "'IBM Plex Mono',monospace";
  // Duty-code colours for chips (design palette, keyed by shift BUCKET).
  const BUCKET_CHIP = { M: '#e08a1e', E: '#6a52d4', N: '#0d1b2e', G: '#0090ca' };
  const OFF_CHIP = '#7d8ea8', LEAVE_CHIP = '#b5670a';

  const divOf = (name) => {
    const n = String(name || '').toLowerCase();
    if (/icu|ccu|emerg|\ber\b|casualty/.test(n)) return 'ce';
    if (/\bot\b|theatre|theater|cath|endo|dialysis|ctvs/.test(n)) return 'pr';
    if (/opd|out.?patient|home|clinic|physio/.test(n)) return 'op';
    return 'ip';
  };
  const desigBucket = (e) => {
    if ((e.role || 'Nurse') === 'PCA') return 3;
    const d = String(e.designation || '').toLowerCase();
    if (/in.?charge|manager|charge|supervisor|superintendent/.test(d)) return 0;
    if (/senior/.test(d)) return 1;
    return 2;
  };
  const codeChip = (code) => {
    if (!code || code === '—') return [OFF_CHIP, 'Not on the sheet'];
    if (R.isLeave(code)) return [LEAVE_CHIP, (R.BY_CODE[code] || {}).label || 'Leave'];
    if (R.isOff(code)) return [OFF_CHIP, (R.BY_CODE[code] || {}).label || 'Day off'];
    const b = R.bucketOf(code);
    return [BUCKET_CHIP[b] || OFF_CHIP, ((R.BY_CODE[code] || {}).label || '') + (R.BY_CODE[code] ? ' · ' + (R.BY_CODE[code].hours || 0) + ' h' : '')];
  };
  // Does this code put the person ON DUTY for shift index i (0 M / 1 E / 2 N)?
  const covers = (code, i) => {
    const b = R.bucketOf(code);
    if (!b || b === 'O') return false;
    if (b === 'G') return i === 0 || i === 1;   // office hours span morning + evening
    return b === 'MEN'[i];
  };
  const needOf = (sheet) => {
    const ru = (sheet && sheet.rules) || {};
    if (ru.cfg) return [Number(ru.cfg.minM) || 0, Number(ru.cfg.minE) || 0, Number(ru.cfg.minN) || 0];
    if (ru.minMorning) return [Number(ru.minMorning.value) || 2, Number(ru.minEvening && ru.minEvening.value) || 2, Number(ru.minNight && ru.minNight.value) || 2];
    return [2, 2, 2];   // the roster module's own defaults (ROS_DEF_CFG)
  };
  const statusWord = (sheet) => !sheet ? 'No roster' : sheet.status === 'approved' ? 'Published' : sheet.status === 'submitted' ? 'Submitted' : 'Draft';

  /* Keyframes + the design's style-hover states, injected once. */
  (function () {
    if (typeof document === 'undefined' || document.getElementById('mp-style')) return;
    const el = document.createElement('style');
    el.id = 'mp-style';
    el.textContent = [
      '@keyframes mpOrbFloat{from{transform:translate(0,0) scale(1)}to{transform:translate(160px,110px) scale(1.18)}}',
      '@keyframes mpPop{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}',
      '@keyframes mpLivepulse{0%{box-shadow:0 0 0 0 rgba(61,220,151,.6)}70%{box-shadow:0 0 0 8px rgba(61,220,151,0)}100%{box-shadow:0 0 0 0 rgba(61,220,151,0)}}',
      '@keyframes mpShortPulse{0%,100%{box-shadow:0 0 0 0 rgba(210,58,82,.0)}50%{box-shadow:0 0 0 5px rgba(210,58,82,.22)}}',
      '@keyframes mpBarIn{from{transform:scaleX(0)}}',
      '.mp-lift:hover{transform:translateY(-2px)}',
      '.mp-bright:hover{filter:brightness(1.04)}',
      '.mp-bright2:hover{filter:brightness(1.06)}',
      '.mp-hbtn:hover{background:rgba(0,144,202,.12)!important;color:#0072a3!important}',
      '.mp-hbg:hover{background:rgba(0,144,202,.08)}',
      '.mp-hbg2:hover{background:rgba(0,144,202,.18)!important}',
      '.mp-hwhite:hover{background:rgba(255,255,255,.9)!important}',
      '.mp-hclose:hover{background:#fff!important;color:#16202e!important}',
    ].join('\n');
    document.head.appendChild(el);
  })();

  const svgIc = (d, size, extra) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={extra && extra.sw || 2} strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
  );

  function ManpowerOverview({ setRoute }) {
    const staffStore = window.useStaffStore();
    const [S, setS] = useState(() => ({
      pop: null, view: 'day', date: new Date().toISOString().slice(0, 10), shift: 0, sel: null, hot: null, staffTab: 'on',
      narrow: typeof window !== 'undefined' && window.innerWidth < 1240,
    }));
    const set = (patch) => setS((s) => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) }));
    const dateRef = useRef(null);
    useEffect(() => {
      const rs = () => set({ narrow: window.innerWidth < 1240 });
      window.addEventListener('resize', rs);
      return () => window.removeEventListener('resize', rs);
    }, []);

    const today = () => new Date().toISOString().slice(0, 10);
    const ini = (n) => { const p = String(n || '—').split(' ').filter(Boolean); return ((p[0] && p[0][0] || '—') + (p[1] ? p[1][0] : '')).toUpperCase(); };
    const tone = (on, need) => !need ? '#7d8ea8' : on < need ? '#d23a52' : on > need ? '#0090ca' : '#157a43';
    const stateWord = (on, need) => !need ? 'Closed' : on < need ? (need - on) + ' short' : on > need ? '+' + (on - need) : 'OK';
    const shiftDate = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
    const weekStart = (iso) => { const d = new Date(iso + 'T12:00:00'); const dow = (d.getDay() + 6) % 7; return shiftDate(iso, -dow); };
    const ymOf = (iso) => [Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1];
    const dayNo = (iso) => Number(iso.slice(8, 10));

    /* ---- REAL units: active staff grouped the way the roster module groups them ---- */
    const baseUnits = useMemo(() => {
      const by = {};
      (staffStore.staff || []).filter((e) => e.is_active !== false && !e.former).forEach((e) => {
        const dept = e.current_department || 'Unassigned';
        (by[dept] = by[dept] || []).push(e);
      });
      const units = Object.keys(by).sort((a, b) => a.localeCompare(b)).map((dept) => {
        const people = by[dept];
        const hc = [0, 0, 0, 0];
        people.forEach((e) => { hc[desigBucket(e)]++; });
        const chief = people.find((e) => desigBucket(e) === 0) || people.find((e) => desigBucket(e) === 1) || people[0];
        return { dept, div: divOf(dept), people, hc, incharge: chief ? chief.name : '—' };
      });
      // floor-map placement: three floors, spans sized to fit 12 columns per floor
      const ordered = [].concat(units.filter((u) => u.div === 'ip'), units.filter((u) => u.div === 'pr'), units.filter((u) => u.div === 'ce'), units.filter((u) => u.div === 'op'));
      const per = Math.max(1, Math.ceil(ordered.length / 3));
      ordered.forEach((u, i) => {
        const row = Math.min(2, Math.floor(i / per)), pos = i - row * per, n = Math.min(per, ordered.length - row * per);
        const span = Math.max(1, Math.floor(12 / n)), extra = 12 - span * n;
        u.grid = [1 + pos * span + Math.min(pos, extra), span + (pos < extra ? 1 : 0), row + 1];
      });
      return units;
    }, [staffStore.staff]);

    /* ---- roster sheets: index once, then each (dept, y, m) the view touches ---- */
    const [index, setIndex] = useState(null);        // list of {dept, year, month, status}
    const [sheets, setSheets] = useState({});        // 'dept|y|m' -> roster doc (or null = fetched, absent)
    useEffect(() => {
      let live = true;
      fetch('/api/rosters', { headers: { accept: 'application/json' } }).then((r) => r.json())
        .then((r) => { if (live) setIndex((r && r.ok && r.rosters) || []); })
        .catch(() => { if (live) setIndex([]); });
      return () => { live = false; };
    }, []);
    const wk0 = weekStart(S.date);
    const monthsNeeded = useMemo(() => {
      const out = {};
      [S.date, wk0, shiftDate(wk0, 6), S.pop && S.pop.date].filter(Boolean).forEach((d) => { const [y, m] = ymOf(d); out[y + '|' + m] = [y, m]; });
      return Object.values(out);
    }, [S.date, wk0, S.pop]);
    useEffect(() => {
      if (!index) return;
      let live = true;
      const want = [];
      baseUnits.forEach((u) => monthsNeeded.forEach(([y, m]) => {
        const k = u.dept + '|' + y + '|' + m;
        if (sheets[k] !== undefined) return;
        const has = index.some((r) => r.dept === u.dept && Number(r.year) === y && Number(r.month) === m);
        want.push({ k, u, y, m, has });
      }));
      if (!want.length) return;
      // sheets that don't exist are marked absent without a request each
      const absent = {}; want.filter((w) => !w.has).forEach((w) => { absent[w.k] = null; });
      if (Object.keys(absent).length) setSheets((s) => ({ ...s, ...absent }));
      want.filter((w) => w.has).forEach((w) => {
        fetch('/api/rosters/' + encodeURIComponent(w.u.dept) + '/' + w.y + '/' + w.m, { headers: { accept: 'application/json' } })
          .then((r) => r.json())
          .then((r) => { if (live) setSheets((s) => ({ ...s, [w.k]: (r && r.ok && r.roster) || null })); })
          .catch(() => { if (live) setSheets((s) => ({ ...s, [w.k]: null })); });
      });
      return () => { live = false; };
    }, [index, baseUnits, monthsNeeded]);   // eslint-disable-line
    const sheetFor = (u, iso) => { const [y, m] = ymOf(iso); return sheets[u.dept + '|' + y + '|' + m] || null; };
    const loading = index === null;

    /* per-person duty for one unit on one date (code straight off the sheet) */
    const staffOf = (u, iso) => {
      const sheet = sheetFor(u, iso), d = dayNo(iso);
      return u.people.map((e) => {
        const key = 'S' + String(e.id);
        const code = (sheet && sheet.grid && sheet.grid[key] && sheet.grid[key][d]) || '';
        const bi = desigBucket(e);
        return { name: e.name, emp: e.emp_id || key, desig: DESIG[bi][1], dcol: DESIG[bi][2], code: code || '—', staffId: e.id };
      });
    };
    /* the unit's numbers for one date: on[M,E,N] / need / leave / off, from the sheet */
    const unitDay = (u, iso) => {
      const sheet = sheetFor(u, iso), st = staffOf(u, iso);
      const on = [0, 1, 2].map((i) => st.filter((p) => covers(p.code, i)).length);
      const lv = st.filter((p) => R.isLeave(p.code)).length;
      const off = st.filter((p) => p.code === '—' || R.isOff(p.code)).length;
      return { u, sheet, on, need: needOf(sheet), leave: lv, off, status: statusWord(sheet) };
    };
    const dayUnits = (iso) => baseUnits.map((u) => unitDay(u, iso));

    /* ---- derived (identical formulas to the design) ---- */
    const sh = S.shift, U = dayUnits(S.date);
    const need = U.reduce((a, x) => a + x.need[sh], 0), on = U.reduce((a, x) => a + x.on[sh], 0);
    const staffTotal = baseUnits.reduce((a, u) => a + u.people.length, 0);
    const short = U.filter((x) => x.on[sh] < x.need[sh]);
    const leave = U.reduce((a, x) => a + x.leave, 0), offToday = U.reduce((a, x) => a + x.off, 0);
    const pct = need ? Math.round(on / need * 100) : 100;
    const coverC = pct < 90 ? '#d23a52' : pct < 100 ? '#e08a1e' : '#157a43';
    const night = sh === 2;
    const T = night
      ? { glass: 'linear-gradient(152deg,rgba(236,242,252,.9),rgba(214,226,246,.72))', glassBorder: 'rgba(255,255,255,.7)', inner: 'rgba(255,255,255,.5)', innerBorder: 'rgba(255,255,255,.8)', ink: '#16202e', inkMid: '#3c4858', inkSoft: '#66748a', inkFaint: '#9aa6b4', inkLabel: '#7d8ea8', rule: 'rgba(90,110,150,.2)', shadow: '0 16px 40px rgba(2,8,22,.45),0 0 24px rgba(122,196,232,.18),inset 0 1px 0 rgba(255,255,255,.9)' }
      : { glass: 'linear-gradient(152deg,rgba(255,255,255,.8),rgba(236,247,255,.5))', glassBorder: 'rgba(255,255,255,.92)', inner: 'rgba(255,255,255,.58)', innerBorder: 'rgba(255,255,255,.92)', ink: '#16202e', inkMid: '#3c4858', inkSoft: '#6c7a8c', inkFaint: '#9aa6b4', inkLabel: '#7d8ea8', rule: 'rgba(125,145,180,.18)', shadow: '0 10px 30px rgba(31,59,90,.1),inset 0 1px 0 rgba(255,255,255,.95)' };
    const chip = (c) => ({ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9.5, fontWeight: 700, color: c, background: c + '1f', border: '1px solid ' + c + '44', padding: '1px 7px', borderRadius: 10, whiteSpace: 'nowrap', flexShrink: 0 });
    const tabStyle = (a) => ({ display: 'inline-flex', alignItems: 'center', gap: 5, border: 'none', padding: '6px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: a ? '#fff' : T.inkMid, background: a ? 'linear-gradient(135deg,#27a8db,#0072a3)' : 'transparent', boxShadow: a ? '0 6px 16px rgba(0,144,202,.3)' : 'none', transition: 'all .18s' });
    const ring = (r, p) => { const c = 2 * Math.PI * r; return (Math.min(1, p / 100) * c) + ' ' + c; };
    const active = (id) => S.sel === id || S.hot === id;
    const statusChipColor = (w) => w === 'Published' ? '#157a43' : w === 'No roster' ? '#a92c42' : '#b5670a';

    const week = Array.from({ length: 7 }, (_, i) => {
      const date = shiftDate(wk0, i), units = dayUnits(date);
      const wNeed = units.reduce((a, x) => a + x.need[sh], 0), wOn = units.reduce((a, x) => a + x.on[sh], 0);
      return { date, units, need: wNeed, on: wOn, pct: wNeed ? Math.round(wOn / wNeed * 100) : 100 };
    });
    const pop = S.pop, popU = pop ? baseUnits.find((u) => u.dept === pop.uid) : null;
    const popDay = popU ? unitDay(popU, pop.date) : null, popStaff = popU ? staffOf(popU, pop.date) : [];
    const pd = popU ? DIVS.find((d) => d[0] === popU.div) : null;
    const selU = S.sel ? baseUnits.find((u) => u.dept === S.sel) : null;
    const selD = selU ? unitDay(selU, S.date) : null;
    const sd = selU ? DIVS.find((d) => d[0] === selU.div) : null;
    const selHead = selU ? selU.people.length : 1;
    const roster = selU ? staffOf(selU, S.date) : [];
    const groups = {
      on: roster.filter((p) => covers(p.code, sh)),
      off: roster.filter((p) => !covers(p.code, sh) && !R.isLeave(p.code)),
      away: roster.filter((p) => R.isLeave(p.code)),
    };
    const SKY = [
      { bg: 'linear-gradient(180deg,#f3f6fb 0%,#e6eef9 55%,#f6efe2 100%)', a: 'rgba(255,196,110,.5)', b: 'rgba(39,168,219,.32)', sun: { top: 60, right: '12%', size: 140, color: 'radial-gradient(circle,rgba(255,224,150,.95),rgba(255,190,90,.55) 45%,transparent 70%)' } },
      { bg: 'linear-gradient(180deg,#e9e3f6 0%,#f3dbe0 45%,#f7e2cf 100%)', a: 'rgba(255,140,90,.5)', b: 'rgba(106,82,212,.38)', sun: { top: 200, right: '8%', size: 180, color: 'radial-gradient(circle,rgba(255,170,110,.95),rgba(232,96,120,.5) 45%,transparent 70%)' } },
      { bg: 'linear-gradient(180deg,#0b1730 0%,#12264a 55%,#1a2f56 100%)', a: 'rgba(39,168,219,.28)', b: 'rgba(106,82,212,.3)', sun: { top: 50, right: '10%', size: 90, color: 'radial-gradient(circle,#f4f7fb 0 44%,rgba(244,247,251,.35) 52%,transparent 70%)' } }
    ][sh];
    const rnd = (n) => { let x = 12345 + n * 7919; x = (x * 9301 + 49297) % 233280; return x / 233280; };

    const openRoster = (dept, iso) => { const [y, m] = ymOf(iso || S.date); setRoute && setRoute(dept ? { view: 'rosterGrid', dept, year: y, month: m } : { view: 'rosterHome' }); };

    /* unit tile — identical markup used by BOTH columns */
    const tileCard = (x) => {
      const u = x.u, d = DIVS.find((v) => v[0] === u.div), n = x.need[sh], o = x.on[sh], c = tone(o, n), p = n ? Math.round(o / n * 100) : 100, hc = u.people.length, act = active(u.dept);
      const sw = stateWord(o, n);
      const gapText = sw === 'OK' ? 'adequate' : sw === 'Closed' ? 'closed this shift' : sw.replace('+', 'surplus +');
      const mix = DESIG.map((dg, i) => ({ code: dg[0], n: u.hc[i], title: dg[1] + ': ' + u.hc[i], w: hc ? u.hc[i] / hc * 100 : 0, col: dg[2] }));
      return (
        <div key={u.dept} className="mp-lift" onClick={() => set({ sel: S.sel === u.dept ? null : u.dept })}
          onMouseEnter={() => set({ hot: u.dept })} onMouseLeave={() => set({ hot: null })}
          style={{ position: 'relative', overflow: 'hidden', cursor: 'pointer', background: T.glass, backdropFilter: 'blur(24px) saturate(1.7)', WebkitBackdropFilter: 'blur(24px) saturate(1.7)', border: '1px solid ' + (act ? d[2] + '99' : T.glassBorder), borderRadius: 13, boxShadow: act ? '0 0 0 3px ' + d[2] + '2e,0 12px 34px rgba(31,59,90,.16)' : T.shadow, padding: '10px 11px 9px 14px', transition: 'transform .2s,box-shadow .25s,border-color .2s' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: d[2] }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ position: 'relative', width: 42, height: 42, flexShrink: 0 }}>
              <svg viewBox="0 0 42 42" width="42" height="42" style={{ display: 'block' }}><circle cx="21" cy="21" r="17" fill="none" stroke="rgba(125,145,180,.18)" strokeWidth="5" /><circle cx="21" cy="21" r="17" fill="none" stroke={c} strokeWidth="5" strokeLinecap="round" strokeDasharray={ring(17, p)} transform="rotate(-90 21 21)" style={{ transition: 'stroke-dasharray .5s ease' }} /></svg>
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontFamily: MONO, fontSize: 9.5, fontWeight: 700 }}>{p + '%'}</div>
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.dept}</span><span style={chip(statusChipColor(x.status))}>{x.status}</span></div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 1 }}><span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: c }}>{o + '/' + n}</span><span style={{ fontSize: 10, color: T.inkSoft }}>on duty · {gapText}</span></div>
              <div style={{ fontSize: 10, color: T.inkFaint }}>on register <b style={{ fontFamily: MONO, color: T.inkMid, fontWeight: 600 }}>{hc}</b> staff</div>
            </div>
          </div>
          <div style={{ marginTop: 8, display: 'flex', height: 6, borderRadius: 4, overflow: 'hidden', gap: 1 }}>
            {mix.map((m) => <span key={m.code} title={m.title} style={{ display: 'block', width: m.w + '%', background: m.col, transition: 'width .3s' }} />)}
          </div>
          <div style={{ display: 'flex', gap: 7, marginTop: 4, fontSize: 9.5, color: T.inkLabel, fontFamily: MONO }}>
            {mix.map((m) => <span key={m.code} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><span style={{ width: 6, height: 6, borderRadius: 2, background: m.col, display: 'inline-block' }} />{m.code} {m.n}</span>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 4, marginTop: 8 }}>
            {SHIFTS.map((s, i) => { const tc = tone(x.on[i], x.need[i]); return (
              <span key={s[0]} title={s[1] + ' ' + s[2] + ': ' + x.on[i] + ' on duty, ' + x.need[i] + ' required'}
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 3, fontFamily: MONO, fontSize: 10, color: i === sh ? '#fff' : tc, background: i === sh ? tc : tc + '1a', border: '1px solid ' + tc + (i === sh ? '' : '44'), borderRadius: 7, padding: '3px 0', transition: 'all .2s' }}>
                {s[0]} <b style={{ fontWeight: 700 }}>{x.on[i] + '/' + x.need[i]}</b></span>
            ); })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, paddingTop: 7, borderTop: '1px solid ' + T.rule }}>
            <span style={{ display: 'inline-grid', placeItems: 'center', width: 22, height: 22, borderRadius: 7, fontSize: 9, fontWeight: 800, color: '#fff', background: 'linear-gradient(135deg,' + d[2] + ',#0d1b2e)', flexShrink: 0 }}>{ini(u.incharge)}</span>
            <div style={{ minWidth: 0, flex: 1, fontSize: 10.5, color: T.inkMid, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.incharge}</div>
            <span style={{ fontSize: 9.5, fontWeight: 600, color: x.leave ? '#b5670a' : '#157a43', whiteSpace: 'nowrap' }}>{x.leave ? x.leave + ' leave · ' + x.off + ' off' : 'all present'}</span>
          </div>
        </div>
      );
    };

    const legendRow = (
      <>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, color: T.inkSoft }}><span style={{ width: 10, height: 10, borderRadius: 3, background: '#d23a52' }} />Short</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, color: T.inkSoft }}><span style={{ width: 10, height: 10, borderRadius: 3, background: '#157a43' }} />Adequate</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, color: T.inkSoft }}><span style={{ width: 10, height: 10, borderRadius: 3, background: '#0090ca' }} />Surplus</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, color: T.inkSoft }}><span style={{ width: 10, height: 10, borderRadius: 3, background: 'rgba(125,145,180,.35)' }} />Closed</span>
      </>
    );

    const glassCard = { background: T.glass, backdropFilter: 'blur(26px) saturate(1.75)', WebkitBackdropFilter: 'blur(26px) saturate(1.75)', border: '1px solid ' + T.glassBorder, borderRadius: 16, boxShadow: '0 14px 42px rgba(31,59,90,.14),inset 0 1px 0 rgba(255,255,255,.95)', overflow: 'hidden' };
    const secLabel = { fontSize: 9.5, fontWeight: 800, letterSpacing: '.7px', textTransform: 'uppercase', color: T.inkLabel, marginBottom: 7 };
    const half = Math.ceil(U.length / 2);

    return (
      <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 18, margin: '-8px -10px', color: T.ink }}>
        {/* sky — morning / evening / night, with stars after dark */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden', background: SKY.bg, transition: 'background 1s ease' }}>
          <div style={{ position: 'absolute', width: 720, height: 720, left: '-8%', top: '-30%', borderRadius: '50%', background: 'radial-gradient(circle,' + SKY.a + ',transparent 70%)', filter: 'blur(50px)', animation: 'mpOrbFloat 18s ease-in-out infinite alternate', transition: 'background 1s ease' }} />
          <div style={{ position: 'absolute', width: 800, height: 800, right: '-12%', bottom: '-35%', borderRadius: '50%', background: 'radial-gradient(circle,' + SKY.b + ',transparent 70%)', filter: 'blur(60px)', animation: 'mpOrbFloat 22s ease-in-out infinite alternate-reverse', transition: 'background 1s ease' }} />
          <div style={{ position: 'absolute', top: SKY.sun.top, right: SKY.sun.right, width: SKY.sun.size, height: SKY.sun.size, borderRadius: '50%', background: SKY.sun.color, filter: night ? 'drop-shadow(0 0 30px rgba(220,230,255,.6))' : 'blur(6px)', transition: 'all 1s ease' }} />
          {night && <div>{Array.from({ length: 70 }, (_, i) => (
            <span key={i} style={{ position: 'absolute', left: rnd(i) * 100 + '%', top: rnd(i + 200) * 70 + '%', width: 1 + rnd(i + 400) * 2, height: 1 + rnd(i + 400) * 2, borderRadius: '50%', background: '#fff', opacity: .3 + rnd(i + 600) * .7, animation: 'mpLivepulse ' + (2 + rnd(i + 800) * 4) + 's ease-in-out ' + (rnd(i) * 3) + 's infinite' }} />
          ))}</div>}
        </div>
        <div style={{ position: 'relative', minHeight: 'calc(100vh - 130px)', padding: '16px 18px 40px', boxSizing: 'border-box' }}>
          <div style={{ maxWidth: 1500, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* ===== header ===== */}
            <div style={{ position: 'relative', overflow: 'hidden', background: T.glass, backdropFilter: 'blur(24px) saturate(1.7)', WebkitBackdropFilter: 'blur(24px) saturate(1.7)', border: '1px solid ' + T.glassBorder, borderRadius: 16, boxShadow: '0 14px 40px rgba(31,59,90,.14),inset 0 1px 0 rgba(255,255,255,.95)', padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ position: 'absolute', right: -70, top: -80, width: 250, height: 230, borderRadius: '50%', background: 'radial-gradient(circle,rgba(0,144,202,.2),transparent 70%)', filter: 'blur(12px)', pointerEvents: 'none', animation: 'mpOrbFloat 18s ease-in-out infinite alternate' }} />
              <span style={{ position: 'relative', display: 'inline-grid', placeItems: 'center', width: 38, height: 38, borderRadius: 11, background: 'rgba(0,144,202,.16)', color: '#0072a3', flexShrink: 0, boxShadow: '0 0 20px rgba(0,144,202,.28)' }}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" /></svg>
              </span>
              <div style={{ position: 'relative', minWidth: 200 }}>
                <div style={{ fontSize: 15.5, fontWeight: 800, letterSpacing: '-.2px' }}>Manpower at a glance</div>
                <div style={{ fontSize: 11, color: T.inkSoft }}>{U.length} departments · {staffTotal} nursing staff{loading ? ' · loading rosters…' : ''}</div>
              </div>
              {/* date pager */}
              <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 4, background: T.inner, border: '1px solid ' + T.innerBorder, borderRadius: 10, padding: 3 }}>
                <button className="mp-hbtn" onClick={() => set({ date: shiftDate(S.date, -1) })} title="Previous day" style={{ width: 26, height: 26, borderRadius: 7, border: 'none', background: 'transparent', color: T.inkMid, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>{svgIc('M15 6l-6 6 6 6', 13, { sw: 2.2 })}</button>
                <div className="mp-hbg" onClick={() => { const el = dateRef.current; if (el && el.showPicker) { try { el.showPicker(); } catch (e) {} } }} title="Pick a date" style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 6px', cursor: 'pointer', borderRadius: 7 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0072a3" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5h18v16H3zM3 9h18M8 3v4M16 3v4" /></svg>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: T.ink, whiteSpace: 'nowrap' }}>{new Date(S.date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  <input ref={dateRef} type="date" value={S.date} onChange={(e) => { if (e.target.value) set({ date: e.target.value }); }} style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', border: 0, padding: 0, margin: 0 }} />
                </div>
                <button className="mp-hbtn" onClick={() => set({ date: shiftDate(S.date, 1) })} title="Next day" style={{ width: 26, height: 26, borderRadius: 7, border: 'none', background: 'transparent', color: T.inkMid, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>{svgIc('M9 6l6 6-6 6', 13, { sw: 2.2 })}</button>
                {S.date !== today() && <button className="mp-hbg2" onClick={() => set({ date: today() })} style={{ border: 'none', background: 'rgba(0,144,202,.12)', color: '#0072a3', fontFamily: 'inherit', fontSize: 10.5, fontWeight: 700, padding: '5px 9px', borderRadius: 7, cursor: 'pointer' }}>Today</button>}
              </div>
              {/* Day / Week */}
              <div style={{ position: 'relative', display: 'inline-flex', background: T.inner, border: '1px solid ' + T.innerBorder, borderRadius: 10, padding: 3, gap: 2 }}>
                {[['day', 'Day', 'M3 3h18v18H3zM3 9h18M9 9v12M15 3v6'], ['week', 'Week', 'M3 5h18v16H3zM3 9h18M8 3v4M16 3v4M3 15h18M9 9v12M15 9v12']].map((v) => (
                  <button key={v[0]} onClick={() => set({ view: v[0] })} style={Object.assign(tabStyle(S.view === v[0]), { padding: '5px 10px', fontSize: 11 })}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={v[2]} /></svg>{v[1]}</button>
                ))}
              </div>
              {/* KPIs */}
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginLeft: 6 }}>
                {[
                  { val: on + '/' + need, lbl: 'on duty vs required', c: coverC },
                  { val: pct + '%', lbl: 'hospital cover', c: coverC },
                  { val: String(short.length), lbl: 'depts short', c: short.length ? '#d23a52' : '#157a43' },
                  { val: String(leave), lbl: 'on leave', c: '#e08a1e' },
                  { val: String(offToday), lbl: 'off today', c: '#9aa6b4' },
                ].map((k, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.inner, border: '1px solid ' + T.innerBorder, borderRadius: 10, padding: '6px 10px 6px 8px' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: k.c, boxShadow: '0 0 0 3px ' + k.c + '26', flexShrink: 0 }} />
                    <span style={{ fontFamily: MONO, fontSize: 15, fontWeight: 700, lineHeight: 1 }}>{k.val}</span>
                    <span style={{ fontSize: 10, color: T.inkSoft, lineHeight: 1.15, maxWidth: 78 }}>{k.lbl}</span>
                  </div>
                ))}
              </div>
              <div style={{ flex: 1 }} />
              {/* shift tabs + banner */}
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ display: 'inline-flex', background: T.inner, border: '1px solid ' + T.innerBorder, borderRadius: 10, padding: 3, gap: 2, boxShadow: '0 6px 18px rgba(31,59,90,.1)' }}>
                  {SHIFTS.map((s, i) => (
                    <button key={s[0]} onClick={() => set({ shift: i })} style={tabStyle(i === sh)}>{s[1]}<span style={{ fontFamily: MONO, fontSize: 9.5, opacity: .7 }}>{s[2]}</span></button>
                  ))}
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, borderRadius: 20, padding: '6px 12px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', color: ['#8a4b00', '#4a2f9e', '#dbe7ff'][sh], background: ['rgba(255,196,110,.28)', 'rgba(106,82,212,.16)', 'rgba(13,27,48,.85)'][sh], border: '1px solid ' + ['rgba(224,138,30,.4)', 'rgba(106,82,212,.35)', 'rgba(122,196,232,.35)'][sh], transition: 'all .6s ease' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={['M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4M12 8a4 4 0 100 8 4 4 0 000-8z', 'M17 18a5 5 0 00-10 0M12 2v7M4.2 10.2l1.4 1.4M1 18h2M21 18h2M18.4 11.6l1.4-1.4M22 22H2M16 6l-4 3-4-3', 'M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z'][sh]} /></svg>
                  {SHIFTS[sh][1] + ' shift · ' + SHIFTS[sh][2]}
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#3ddc97', animation: 'mpLivepulse 2.4s infinite', marginLeft: 2 }} />
                </span>
              </div>
            </div>

            {/* ===== main grid ===== */}
            <div style={S.narrow ? { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 12, alignItems: 'start' } : { display: 'grid', gridTemplateColumns: '262px minmax(0,1fr) 262px', gap: 12, alignItems: 'start' }}>

              {/* left tiles */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>{U.slice(0, half).map(tileCard)}</div>

              {/* center */}
              <div style={S.narrow ? { display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0, gridColumn: '1 / span 2', gridRow: 1 } : { display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>

                {/* ---- floor map (day view) ---- */}
                {S.view !== 'week' && (
                  <div style={glassCard}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid ' + T.rule, flexWrap: 'wrap' }}>
                      <span style={{ display: 'inline-grid', placeItems: 'center', width: 26, height: 26, borderRadius: 8, background: 'rgba(0,144,202,.12)', color: '#0072a3', flexShrink: 0 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h18v18H3zM3 9h18M9 9v12M15 3v6" /></svg></span>
                      <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>Hospital floor map — {SHIFTS[sh][1]} shift</h3>
                      <span style={{ fontSize: 10.5, color: T.inkFaint }}>rooms coloured by staffing · click a room</span>
                      <span style={{ flex: 1 }} />
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>{legendRow}</div>
                    </div>
                    <div style={{ padding: 12, background: 'repeating-linear-gradient(0deg,rgba(125,145,180,.07) 0 1px,transparent 1px 22px),repeating-linear-gradient(90deg,rgba(125,145,180,.07) 0 1px,transparent 1px 22px)' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: 5, marginBottom: 6, flexWrap: 'wrap' }}>
                          {DIVS.map((d) => {
                            const us = U.filter((x) => x.u.div === d[0]); if (!us.length) return null;
                            const wN = us.reduce((a, x) => a + x.need[sh], 0), wO = us.reduce((a, x) => a + x.on[sh], 0);
                            return (
                              <div key={d[0]} style={{ flex: '1 1 0', display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: d[2], background: d[2] + '14', border: '1px solid ' + d[2] + '33', borderRadius: 7, padding: '3px 8px', minWidth: 0, whiteSpace: 'nowrap' }}>
                                <span style={{ width: 7, height: 7, borderRadius: 2, background: d[2] }} />
                                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{({ ce: 'Critical & ER', pr: 'Procedural', ip: 'In-patient', op: 'Out-patient' })[d[0]]}</span>
                                <span style={{ fontFamily: MONO, fontWeight: 600, opacity: .8, marginLeft: 'auto', flexShrink: 0 }}>{wO + '/' + wN}</span>
                              </div>
                            );
                          })}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12,minmax(0,1fr))', gridTemplateRows: '78px 22px 78px 22px 78px', gap: 5 }}>
                          {U.map((x) => {
                            const u = x.u, d = DIVS.find((v) => v[0] === u.div), n = x.need[sh], o = x.on[sh], c = tone(o, n), g = u.grid, act = active(u.dept), closed = !n;
                            return (
                              <div key={u.dept} className="mp-bright" onClick={() => set({ sel: S.sel === u.dept ? null : u.dept })}
                                onMouseEnter={() => set({ hot: u.dept })} onMouseLeave={() => set({ hot: null })}
                                title={u.dept + ' · ' + d[1] + ' · ' + o + ' on duty / ' + n + ' required'}
                                style={{ gridColumn: g[0] + ' / span ' + g[1], gridRow: (g[2] * 2 - 1) + ' / span 1', display: 'flex', flexDirection: 'column', padding: '6px 7px 5px', borderRadius: 9, cursor: 'pointer', minWidth: 0, color: closed ? T.inkLabel : T.ink, background: closed ? T.inner : 'linear-gradient(160deg,' + c + (night ? '3a' : '2e') + ',' + c + (night ? '18' : '14') + ')', border: '1.5px solid ' + (act ? c : c + '66'), borderTop: '4px solid ' + d[2], boxShadow: act ? '0 0 0 3px ' + c + '33,0 10px 24px rgba(31,59,90,.18)' : 'inset 0 1px 0 rgba(255,255,255,.7)', animation: o < n && n ? 'mpShortPulse 2.6s ease-in-out infinite' : 'none', transition: 'box-shadow .2s,border-color .2s' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                                  <span style={{ fontSize: 10.5, fontWeight: 700, lineHeight: 1.2, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.dept}</span>
                                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, flexShrink: 0, marginTop: 3 }} />
                                </div>
                                <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'baseline', gap: 4 }}>
                                  <span style={{ fontFamily: MONO, fontSize: 16, fontWeight: 700, lineHeight: 1 }}>{o}</span>
                                  <span style={{ fontFamily: MONO, fontSize: 10, opacity: .75, whiteSpace: 'nowrap' }}>/{n}</span>
                                  <span style={{ marginLeft: 'auto', fontSize: 9.5, fontWeight: 700, letterSpacing: '.3px', opacity: .9, whiteSpace: 'nowrap', display: g[1] < 2 ? 'none' : 'inline' }}>{stateWord(o, n)}</span>
                                </div>
                              </div>
                            );
                          })}
                          <div style={{ gridColumn: '1 / span 12', gridRow: 2, borderRadius: 6, background: 'linear-gradient(90deg,rgba(125,145,180,.16),rgba(125,145,180,.26),rgba(125,145,180,.16))', border: '1px dashed rgba(125,145,180,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, fontSize: 9.5, fontWeight: 700, letterSpacing: '.9px', textTransform: 'uppercase', color: T.inkLabel }}>
                            <span>Lifts</span><span style={{ opacity: .5 }}>·</span><span>In-patient wards</span><span style={{ opacity: .5 }}>·</span><span>Nurses' station</span>
                          </div>
                          <div style={{ gridColumn: '1 / span 12', gridRow: 4, borderRadius: 6, background: 'linear-gradient(90deg,rgba(125,145,180,.16),rgba(125,145,180,.26),rgba(125,145,180,.16))', border: '1px dashed rgba(125,145,180,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, fontSize: 9.5, fontWeight: 700, letterSpacing: '.9px', textTransform: 'uppercase', color: T.inkLabel }}>
                            <span>Lifts</span><span style={{ opacity: .5 }}>·</span><span>Procedural floor above · Critical care &amp; out-patient below</span><span style={{ opacity: .5 }}>·</span><span>Lifts</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ---- week grid ---- */}
                {S.view === 'week' && (
                  <div style={glassCard}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid ' + T.rule, flexWrap: 'wrap' }}>
                      <span style={{ display: 'inline-grid', placeItems: 'center', width: 26, height: 26, borderRadius: 8, background: 'rgba(0,144,202,.12)', color: '#0072a3', flexShrink: 0 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5h18v16H3zM3 9h18M8 3v4M16 3v4M3 15h18M9 9v12M15 9v12" /></svg></span>
                      <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>Week of {new Date(wk0 + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} — {SHIFTS[sh][1]} shift</h3>
                      <span style={{ fontSize: 10.5, color: T.inkFaint }}>on duty / required · click a cell for that unit's day</span>
                      <span style={{ flex: 1 }} />
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2, background: T.inner, border: '1px solid ' + T.innerBorder, borderRadius: 9, padding: 2 }}>
                        <button className="mp-hbtn" onClick={() => set({ date: shiftDate(S.date, -7) })} title="Previous week" style={{ width: 24, height: 24, borderRadius: 6, border: 'none', background: 'transparent', color: T.inkMid, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>{svgIc('M15 6l-6 6 6 6', 12, { sw: 2.2 })}</button>
                        <span style={{ fontSize: 10.5, fontWeight: 700, padding: '0 6px', whiteSpace: 'nowrap' }}>{new Date(wk0 + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – {new Date(shiftDate(wk0, 6) + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                        <button className="mp-hbtn" onClick={() => set({ date: shiftDate(S.date, 7) })} title="Next week" style={{ width: 24, height: 24, borderRadius: 6, border: 'none', background: 'transparent', color: T.inkMid, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>{svgIc('M9 6l6 6-6 6', 12, { sw: 2.2 })}</button>
                      </div>
                    </div>
                    <div style={{ padding: '10px 12px 12px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '150px repeat(7,minmax(0,1fr))', gap: 4, alignItems: 'stretch' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-end', padding: '0 6px 4px', fontSize: 9.5, fontWeight: 800, letterSpacing: '.7px', textTransform: 'uppercase', color: T.inkLabel }}>Department</div>
                        {week.map((w) => {
                          const c = w.need ? (w.pct < 90 ? '#d23a52' : w.pct < 100 ? '#e08a1e' : w.on > w.need ? '#0090ca' : '#157a43') : T.inkLabel;
                          const cur = w.date === S.date, td = w.date === today();
                          return (
                            <div key={w.date} className="mp-bright" onClick={() => set({ date: w.date, view: 'day' })} style={{ padding: '6px 8px', borderRadius: 9, cursor: 'pointer', background: cur ? 'rgba(0,144,202,.14)' : T.inner, border: '1px solid ' + (cur ? 'rgba(0,144,202,.5)' : T.innerBorder), minWidth: 0 }}>
                              <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', opacity: .75 }}>{new Date(w.date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short' }) + (td ? ' · today' : '')}</div>
                              <div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 800, lineHeight: 1.1 }}>{new Date(w.date + 'T12:00:00').getDate()}</div>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 3 }}><span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: c }}>{w.on + '/' + w.need}</span><span style={{ fontSize: 9.5, opacity: .7 }}>{w.pct + '%'}</span></div>
                              <div style={{ marginTop: 4, height: 4, borderRadius: 2, background: 'rgba(125,145,180,.18)', overflow: 'hidden' }}><div style={{ height: '100%', width: Math.min(100, w.pct) + '%', background: c, borderRadius: 2 }} /></div>
                            </div>
                          );
                        })}
                        {baseUnits.map((u) => {
                          const d = DIVS.find((v) => v[0] === u.div);
                          return (
                            <React.Fragment key={u.dept}>
                              <div className="mp-hbg" onClick={() => set({ sel: u.dept })} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '0 8px', borderRadius: 8, cursor: 'pointer', minWidth: 0, background: S.sel === u.dept ? 'rgba(0,144,202,.1)' : 'transparent' }}>
                                <span style={{ width: 8, height: 8, borderRadius: 2, background: d[2], flexShrink: 0 }} />
                                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11, fontWeight: 600 }}>{u.dept}</span>
                              </div>
                              {week.map((w) => {
                                const v = w.units.find((x) => x.u.dept === u.dept), n = v.need[sh], o = v.on[sh], c = tone(o, n), closed = !n, cur = w.date === S.date;
                                return (
                                  <div key={w.date} className="mp-bright2" onClick={() => set({ pop: { uid: u.dept, date: w.date } })} title={u.dept + ' · ' + w.date + ' · ' + o + ' on duty / ' + n + ' required'}
                                    style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 1, padding: '7px 4px', borderRadius: 7, cursor: 'pointer', minWidth: 0, color: closed ? T.inkLabel : (night ? T.ink : c), background: closed ? T.inner : c + (night ? '3a' : '1f'), border: '1px solid ' + (cur ? c + 'aa' : c + (closed ? '22' : '44')), boxShadow: cur ? 'inset 0 0 0 1px ' + c + '55' : 'none' }}>
                                    <span style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 700 }}>{o}</span><span style={{ fontFamily: MONO, fontSize: 9.5, opacity: .7 }}>/{n}</span>
                                  </div>
                                );
                              })}
                            </React.Fragment>
                          );
                        })}
                      </div>
                      <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                        {legendRow}
                        <span style={{ flex: 1 }} />
                        <span style={{ fontSize: 10.5, color: T.inkSoft }}>Week total <b style={{ fontFamily: MONO, color: T.ink }}>{week.reduce((a, w) => a + w.on, 0) + '/' + week.reduce((a, w) => a + w.need, 0)}</b> · <b style={{ fontFamily: MONO, color: '#a92c42' }}>{week.reduce((a, w) => a + w.units.filter((v) => v.on[sh] < v.need[sh]).length, 0)}</b> short slots</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* ---- selected department ---- */}
                {!!selU && (
                  <div style={{ ...glassCard, position: 'relative', animation: 'mpPop .3s ease' }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, background: sd ? sd[2] : '#0090ca' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px 10px 18px', borderBottom: '1px solid ' + T.rule, flexWrap: 'wrap' }}>
                      <span style={{ display: 'inline-grid', placeItems: 'center', width: 32, height: 32, borderRadius: 10, fontSize: 11.5, fontWeight: 800, color: '#fff', background: 'linear-gradient(135deg,' + (sd ? sd[2] : '#0090ca') + ',#0d1b2e)', flexShrink: 0 }}>{ini(selU.incharge)}</span>
                      <div style={{ minWidth: 0 }}>
                        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{selU.dept} <span style={{ fontWeight: 500, color: T.inkSoft }}>· {sd ? sd[1] : ''}</span></h3>
                        <div style={{ fontSize: 10.5, color: T.inkSoft }}>In-charge {selU.incharge} · {selHead} staff · roster {selD.status.toLowerCase()}</div>
                      </div>
                      <span style={{ flex: 1 }} />
                      <span style={Object.assign(chip(tone(selD.on[sh], selD.need[sh])), { fontSize: 10.5, padding: '3px 9px' })}>{stateWord(selD.on[sh], selD.need[sh]).replace('OK', 'Adequate') + ' · ' + SHIFTS[sh][1]}</span>
                      <button className="mp-hbg2" onClick={() => openRoster(selU.dept, S.date)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid rgba(0,144,202,.3)', background: 'rgba(0,144,202,.1)', color: '#0072a3', padding: '6px 11px', borderRadius: 9, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Open roster{svgIc('M9 6l6 6-6 6', 11, { sw: 2.2 })}</button>
                    </div>
                    <div style={{ padding: '12px 14px 12px 18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14 }}>
                      <div>
                        <div style={secLabel}>Cover per shift</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          {SHIFTS.map((s, i) => {
                            const mx = Math.max.apply(null, selD.need.concat(selD.on)) || 1, c = tone(selD.on[i], selD.need[i]);
                            return (
                              <div key={s[0]} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 11, color: T.inkMid, width: 56, flexShrink: 0 }}>{s[1]}</span>
                                <div style={{ flex: 1, height: 9, borderRadius: 5, background: 'rgba(125,145,180,.14)', overflow: 'hidden', position: 'relative' }}>
                                  <div style={{ height: '100%', width: selD.on[i] / mx * 100 + '%', background: c, borderRadius: 5, transformOrigin: 'left', animation: 'mpBarIn .5s ease' }} />
                                  <div style={{ position: 'absolute', top: -2, bottom: -2, left: selD.need[i] / mx * 100 + '%', width: 2, background: '#3c4858', transform: 'translateX(-50%)' }} />
                                </div>
                                <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: c, width: 36, textAlign: 'right' }}>{selD.on[i]}/{selD.need[i]}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <div style={secLabel}>Designation mix</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          {DESIG.map((dg, i) => (
                            <div key={dg[0]} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 11, color: T.inkMid, width: 112, flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{dg[1]}</span>
                              <div style={{ flex: 1, height: 9, borderRadius: 5, background: 'rgba(125,145,180,.14)', overflow: 'hidden' }}><div style={{ height: '100%', width: selU.hc[i] / selHead * 100 + '%', background: dg[2], borderRadius: 5 }} /></div>
                              <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, width: 18, textAlign: 'right' }}>{selU.hc[i]}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div style={secLabel}>This day</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                          {[
                            { v: String(selHead - selD.leave), l: 'available', c: '#157a43' },
                            { v: String(selD.leave), l: 'on leave', c: selD.leave ? '#b5670a' : '#9aa6b4' },
                            { v: String(selD.off), l: 'off / unrostered', c: '#9aa6b4' },
                            { v: String(selD.on[0] + selD.on[1] + selD.on[2]), l: 'duty slots filled', c: '#0072a3' },
                          ].map((a, i) => (
                            <div key={i} style={{ background: T.inner, border: '1px solid ' + T.innerBorder, borderRadius: 9, padding: '6px 9px' }}>
                              <div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 700, lineHeight: 1.1, color: a.c }}>{a.v}</div>
                              <div style={{ fontSize: 9.5, color: T.inkSoft }}>{a.l}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div style={{ padding: '0 14px 14px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                        <div style={{ ...secLabel, marginBottom: 0 }}>Staff list · {selU.dept}</div>
                        <span style={{ flex: 1 }} />
                        <div style={{ display: 'inline-flex', background: T.inner, border: '1px solid ' + T.innerBorder, borderRadius: 9, padding: 2, gap: 2 }}>
                          {[['on', 'On duty'], ['off', 'Off / other shift'], ['away', 'On leave']].map((t) => (
                            <button key={t[0]} onClick={() => set({ staffTab: t[0] })} style={Object.assign(tabStyle(S.staffTab === t[0]), { padding: '4px 9px', fontSize: 10.5 })}>{t[1]}<span style={{ fontFamily: MONO, fontSize: 9.5, opacity: .75 }}>{groups[t[0]].length}</span></button>
                          ))}
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 6 }}>
                        {(groups[S.staffTab] || []).map((p) => {
                          const m = codeChip(p.code);
                          return (
                            <div key={p.emp} className="mp-hwhite" style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.inner, border: '1px solid ' + T.innerBorder, borderRadius: 10, padding: '6px 9px', animation: 'mpPop .25s ease backwards' }}>
                              {(window.MK && window.MK.Av)
                                ? <window.MK.Av name={p.name} empId={p.emp} size={26} radius={8} style={{ fontSize: 9.5 }} />
                                : <span style={{ display: 'inline-grid', placeItems: 'center', width: 26, height: 26, borderRadius: 8, fontSize: 9.5, fontWeight: 800, color: '#fff', background: 'linear-gradient(135deg,' + p.dcol + ',' + (sd ? sd[2] : '#0090ca') + ')', flexShrink: 0 }}>{ini(p.name)}</span>}
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                                <div style={{ fontSize: 9.5, color: T.inkFaint, whiteSpace: 'nowrap' }}><span style={{ fontFamily: MONO }}>{p.emp}</span> · {p.desig}</div>
                              </div>
                              <span title={m[1]} style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: R.bucketOf(p.code) === 'N' ? '#fff' : m[0], background: R.bucketOf(p.code) === 'N' ? m[0] : m[0] + '1f', border: '1px solid ' + m[0] + '55', padding: '2px 7px', borderRadius: 7, flexShrink: 0 }}>{p.code}</span>
                            </div>
                          );
                        })}
                        {!(groups[S.staffTab] || []).length && <div style={{ fontSize: 11, color: T.inkSoft, padding: '8px 10px', background: 'rgba(255,255,255,.5)', borderRadius: 9 }}>Nobody in this group.</div>}
                      </div>
                    </div>
                  </div>
                )}

                {/* ---- division summary ---- */}
                <div style={{ ...glassCard, padding: '11px 14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
                  {DIVS.map((d) => {
                    const us = U.filter((x) => x.u.div === d[0]); if (!us.length) return null;
                    const dN = us.reduce((a, x) => a + x.need[sh], 0), dO = us.reduce((a, x) => a + x.on[sh], 0), sh2 = us.filter((x) => x.on[sh] < x.need[sh]), p = dN ? Math.round(dO / dN * 100) : 100;
                    return (
                      <div key={d[0]} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 11, background: T.inner, border: '1px solid ' + T.innerBorder }}>
                        <div style={{ position: 'relative', width: 44, height: 44, flexShrink: 0 }}>
                          <svg viewBox="0 0 44 44" width="44" height="44" style={{ display: 'block' }}><circle cx="22" cy="22" r="18" fill="none" stroke="rgba(125,145,180,.18)" strokeWidth="5" /><circle cx="22" cy="22" r="18" fill="none" stroke={d[2]} strokeWidth="5" strokeLinecap="round" strokeDasharray={ring(18, p)} transform="rotate(-90 22 22)" style={{ transition: 'stroke-dasharray .5s ease' }} /></svg>
                          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontFamily: MONO, fontSize: 10, fontWeight: 700 }}>{p + '%'}</div>
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d[1]}</div>
                          <div style={{ fontSize: 10.5, color: T.inkSoft }}>{us.length} depts · {us.reduce((a, x) => a + x.u.people.length, 0)} staff</div>
                          <div style={{ fontSize: 10.5, color: sh2.length ? '#a92c42' : '#157a43', fontWeight: 600 }}>{sh2.length ? sh2.map((x) => x.u.dept).join(', ') + ' short' : 'All departments covered'}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* right tiles */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>{U.slice(half).map(tileCard)}</div>
            </div>
          </div>

          {/* ===== unit-day popup (read-only: edits happen in the real roster editor) ===== */}
          {!!pop && popU && (
            <div onClick={() => set({ pop: null })} style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(8,17,32,.45)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', display: 'grid', placeItems: 'center', padding: 20, animation: 'mpPop .2s ease' }}>
              <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative', overflow: 'hidden', width: 'min(860px,100%)', maxHeight: 'calc(100vh - 40px)', display: 'flex', flexDirection: 'column', background: 'linear-gradient(152deg,rgba(255,255,255,.96),rgba(236,247,255,.92))', border: '1px solid rgba(255,255,255,.95)', borderRadius: 18, boxShadow: '0 30px 80px rgba(2,8,22,.45)', animation: 'mpPop .25s cubic-bezier(.2,.7,.3,1)', color: '#16202e' }}>
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, background: pd ? pd[2] : '#0090ca' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '14px 16px 12px 20px', borderBottom: '1px solid rgba(125,145,180,.18)', flexWrap: 'wrap' }}>
                  <span style={{ display: 'inline-grid', placeItems: 'center', width: 38, height: 38, borderRadius: 12, fontSize: 13, fontWeight: 800, color: '#fff', background: 'linear-gradient(135deg,' + (pd ? pd[2] : '#0090ca') + ',#0d1b2e)', flexShrink: 0 }}>{ini(popU.incharge)}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>{popU.dept}</h3><span style={Object.assign(chip(statusChipColor(popDay.status)), { fontSize: 10.5, padding: '2px 9px' })}>Roster {popDay.status.toLowerCase()}</span></div>
                    <div style={{ fontSize: 11.5, color: '#6c7a8c' }}>{new Date(pop.date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · {pd ? pd[1] : ''} · in-charge {popU.incharge} · {popU.people.length} staff</div>
                  </div>
                  <span style={{ flex: 1 }} />
                  <button className="mp-hbg2" onClick={() => set({ pop: null, date: pop.date, sel: pop.uid, view: 'day' })} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid rgba(0,144,202,.3)', background: 'rgba(0,144,202,.1)', color: '#0072a3', padding: '7px 12px', borderRadius: 9, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Open day view</button>
                  <button onClick={() => openRoster(popU.dept, pop.date)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid rgba(21,122,67,.3)', background: 'linear-gradient(160deg,#1c8f52,#157a43)', color: '#fff', padding: '7px 12px', borderRadius: 9, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 6px 16px rgba(21,122,67,.25)' }}>Full roster{svgIc('M9 6l6 6-6 6', 11, { sw: 2.2 })}</button>
                  <button className="mp-hclose" onClick={() => set({ pop: null })} title="Close" style={{ width: 30, height: 30, borderRadius: 9, border: '1px solid rgba(125,145,180,.3)', background: 'rgba(255,255,255,.8)', color: '#6c7a8c', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
                </div>
                <div style={{ overflowY: 'auto', padding: '14px 16px 16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 10 }}>
                    {SHIFTS.map((s, i) => {
                      const n = popDay.need[i], o = popDay.on[i], c = tone(o, n);
                      const hcol = BUCKET_CHIP['MEN'[i]];
                      const people = popStaff.filter((p) => covers(p.code, i));
                      return (
                        <div key={s[0]} style={{ background: 'rgba(255,255,255,.55)', border: '1px solid ' + c + (n ? '55' : '22'), borderTop: '3px solid ' + hcol, borderRadius: 12, overflow: 'hidden', minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 11px', borderBottom: '1px solid rgba(125,145,180,.16)' }}>
                            <span style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 800, color: i === 2 ? '#fff' : hcol, background: i === 2 ? hcol : hcol + '22', padding: '3px 7px', borderRadius: 7, flexShrink: 0 }}>{s[0]}</span>
                            <div style={{ minWidth: 0, flex: 1 }}><div style={{ fontSize: 12, fontWeight: 700 }}>{s[1]}</div><div style={{ fontSize: 10, color: '#9aa6b4' }}>{s[2]}</div></div>
                            <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 800, color: c }}>{o}<span style={{ fontSize: 10, color: '#9aa6b4', fontWeight: 500 }}>/{n}</span></span>
                          </div>
                          <div style={{ padding: '8px 9px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {people.map((p) => (
                              <div key={p.emp} style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,.7)', border: '1px solid rgba(255,255,255,.95)', borderRadius: 9, padding: '5px 8px' }}>
                                {(window.MK && window.MK.Av)
                                  ? <window.MK.Av name={p.name} empId={p.emp} size={24} radius={7} style={{ fontSize: 9 }} />
                                  : <span style={{ display: 'inline-grid', placeItems: 'center', width: 24, height: 24, borderRadius: 7, fontSize: 9, fontWeight: 800, color: '#fff', background: 'linear-gradient(135deg,' + p.dcol + ',' + (pd ? pd[2] : '#0090ca') + ')', flexShrink: 0 }}>{ini(p.name)}</span>}
                                <div style={{ minWidth: 0, flex: 1 }}><div style={{ fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div><div style={{ fontSize: 9.5, color: '#9aa6b4', whiteSpace: 'nowrap' }}><span style={{ fontFamily: MONO }}>{p.emp}</span> · {p.desig}</div></div>
                                <span title={codeChip(p.code)[1]} style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 700, color: '#3c4858', background: 'rgba(125,145,180,.14)', border: '1px solid rgba(125,145,180,.3)', padding: '2px 7px', borderRadius: 7, flexShrink: 0 }}>{p.code}</span>
                              </div>
                            ))}
                            {o !== n && <div style={{ fontSize: 10.5, fontWeight: 700, color: c, background: c + '14', border: '1px dashed ' + c + '66', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>{!n ? 'Closed this shift' : o < n ? (n - o) + ' more needed' : '+' + (o - n) + ' above requirement'}</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 10 }}>
                    <div style={{ background: 'rgba(255,255,255,.6)', border: '1px solid rgba(255,255,255,.95)', borderRadius: 12, padding: '10px 12px' }}>
                      <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '.7px', textTransform: 'uppercase', color: '#7d8ea8', marginBottom: 7 }}>On leave this day</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {popStaff.filter((p) => R.isLeave(p.code)).map((p) => (
                          <span key={p.emp} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: LEAVE_CHIP, background: LEAVE_CHIP + '1a', border: '1px solid ' + LEAVE_CHIP + '44', padding: '3px 8px', borderRadius: 12 }}>{p.name}<b style={{ fontFamily: MONO }}>{p.code}</b></span>
                        ))}
                        {!popStaff.filter((p) => R.isLeave(p.code)).length && <span style={{ fontSize: 11, color: '#157a43', fontWeight: 600 }}>Everyone available — no leave on the sheet.</span>}
                      </div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,.6)', border: '1px solid rgba(255,255,255,.95)', borderRadius: 12, padding: '10px 12px' }}>
                      <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '.7px', textTransform: 'uppercase', color: '#7d8ea8', marginBottom: 7 }}>Day off / not rostered</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {popStaff.filter((p) => p.code === '—' || R.isOff(p.code)).map((p) => (
                          <span key={p.emp} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: '#3c4858', background: 'rgba(125,145,180,.12)', border: '1px solid rgba(125,145,180,.25)', padding: '3px 8px', borderRadius: 12 }}>{p.name}<b style={{ fontFamily: MONO }}>{p.code}</b></span>
                        ))}
                        {!popStaff.filter((p) => p.code === '—' || R.isOff(p.code)).length && <span style={{ fontSize: 11, color: '#6c7a8c' }}>Nobody — the whole register is rostered or away.</span>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  window.ManpowerOverview = ManpowerOverview;
})();
