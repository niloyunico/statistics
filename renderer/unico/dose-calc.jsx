/* UNICO — Dose Calculator (Medicine & Rx → Dose Calculator), window.MedDoseCalc.

   Four sections over one patient bar:
     ICU infusions     drug + concentration → dose ↔ mL/h, limit gauge, preparation from
                       the stock ampoule, titration chart, animated syringe / volumetric
                       pump, printable syringe label with a two-person check
     Emergency sheet   every arrest / RSI / seizure dose for this weight, capped, printable
     Paediatric        mg/kg → mg and mL (or tablets) for the chosen strength, capped
     Clinical calcs    body size, renal function, fluids, drip rate, sodium, electrolytes,
                       burns, unit conversion

   THE NUMBERS: the maths is dose-math.js (window.UNICO_DOSE, unit-tested); the drug list
   is dose-library.js (window.UNICO_DOSE_LIB) merged with the hospital's overrides from
   /api/med/dose-library. Every library drug wears its review state — "Not yet reviewed",
   "Reviewed by …" or "Changed since review" — because a ready-made rate is only safe once
   someone at THIS hospital has checked it against local protocol.

   ORDER: drugs, groups, tabs and calculator cards can be dragged (or moved with ▲▼).
   "My layout" lives in this browser only (dosecalc_prefs_v1 — deliberately NOT a unico_*
   key, which would sync to every user); an admin can publish the current order as the
   hospital order (`_layout` in the dose library).

   Patient details stay in sessionStorage (this tab only) and are never sent anywhere. */
(function () {
  const { useState, useEffect, useMemo, useRef, useLayoutEffect, useCallback } = React;
  const MK = window.MK;
  const D = window.UNICO_DOSE;
  const LIB = window.UNICO_DOSE_LIB;
  const fmt = (n, dp) => D.fmt(n, dp);

  const api = {
    get: (u) => fetch(u, { headers: { accept: 'application/json' } }).then((r) => r.json()),
    send: (m, u, b) => fetch(u, { method: m, headers: { 'content-type': 'application/json' }, body: JSON.stringify(b || {}) }).then((r) => r.json()),
  };
  const toast = (m, t) => { try { window.UI && window.UI.toast && window.UI.toast(m, t || 'success'); } catch (e) {} };
  const isAdmin = () => { try { const u = window.__UNICO_USER__; return !u || u.role === 'Administrator'; } catch (e) { return true; } };
  const userName = () => { try { const u = window.__UNICO_USER__; return (u && (u.name || u.username)) || ''; } catch (e) { return ''; } };
  const reduceMotion = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const escH = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const PREFS_KEY = 'dosecalc_prefs_v1', PATIENT_KEY = 'dosecalc_patient_v1';
  const readJson = (store, k, d) => { try { const v = JSON.parse(store.getItem(k) || 'null'); return v && typeof v === 'object' ? v : d; } catch (e) { return d; } };
  const writeJson = (store, k, v) => { try { store.setItem(k, JSON.stringify(v)); } catch (e) {} };

  const TABS = [
    { id: 'infusion', label: 'ICU infusions', icon: 'M7 3h10M9 3v4l-4 9a3 3 0 0 0 3 4h8a3 3 0 0 0 3-4l-4-9V3' },
    { id: 'emergency', label: 'Emergency sheet', icon: 'M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9zM8 12h2l1-2 2 4 1-2h2' },
    { id: 'paed', label: 'Paediatric', icon: 'M12 7a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8 22v-7l-2-4 6-2 6 2-2 4v7' },
    { id: 'calcs', label: 'Clinical calculators', icon: 'M5 3h14v18H5zM8 7h8M8 11h2M12 11h2M8 15h2M12 15h2M16 11v4' },
  ];
  const GROUP_COLOR = {
    'Vasopressors & inotropes': '#e5484d', 'Vasodilators & antiarrhythmics': '#f08c2e', 'Sedation & analgesia': '#7c5cff',
    'Neuromuscular blockers': '#e0479e', 'Insulin, heparin & others': '#d39b00',
    'Cardiac arrest': '#e5484d', 'Anaphylaxis & shock': '#f08c2e', 'Intubation (RSI)': '#7c5cff', 'Seizure': '#0090ca',
    'Analgesic / antipyretic': '#0090ca', 'Antibiotics (oral)': '#1f9d57', 'Antibiotics (IV)': '#2b8f83', 'Other': '#6a52d4',
  };
  const colorOf = (g) => GROUP_COLOR[g] || '#27a8db';
  // A bolus button on a vasopressor would teach the wrong thing — only where boluses are normal practice.
  const BOLUS_GROUPS = { 'Sedation & analgesia': 1 };
  const UNIT_CHOICES = ['mcg/kg/min', 'mcg/kg/h', 'mg/kg/h', 'mcg/min', 'mcg/h', 'mg/min', 'mg/h', 'g/h', 'units/kg/h', 'units/h', 'units/min', 'milliunits/min', 'mmol/h'];
  const AMOUNT_UNITS = ['mg', 'mcg', 'g', 'units', 'mmol'];

  /* ================= small shared bits ================= */
  const Svg = ({ d, s, sw }) => (
    <svg viewBox="0 0 24 24" width={s || 15} height={s || 15} fill="none" stroke="currentColor" strokeWidth={sw || 1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
  );
  const IC = {
    grip: 'M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01',
    star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
    print: 'M6 9V3h12v6M6 18H4v-6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6h-2M7 14h10v7H7z',
    move: 'M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3',
    book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5M8 7h7',
    shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
    clock: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
    check: 'M5 12l5 5 9-10',
    alert: 'M12 9v4M12 17h.01M10.3 3.9L2 18a2 2 0 0 0 1.7 3h16.6A2 2 0 0 0 22 18L13.7 3.9a2 2 0 0 0-3.4 0z',
    search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5',
    up: 'M6 15l6-6 6 6', down: 'M6 9l6 6 6-6',
    plus: 'M12 5v14M5 12h14', x: 'M6 6l12 12M18 6L6 18',
    flask: 'M9 3h6M10 3v6L4.5 18.5A2 2 0 0 0 6.3 21h11.4a2 2 0 0 0 1.8-2.5L14 9V3',
    reset: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5',
    save: 'M5 3h11l3 3v15H5zM8 3v5h8M8 21v-7h8v7',
  };

  // Count-up for result numbers.
  function useTween(target, ms) {
    const [v, setV] = useState(target);
    const from = useRef(target);
    useEffect(() => {
      if (target == null || !Number.isFinite(target)) { setV(target); from.current = target; return undefined; }
      if (reduceMotion() || from.current == null || !Number.isFinite(from.current)) { setV(target); from.current = target; return undefined; }
      const a = from.current, t0 = performance.now(), dur = ms || 380;
      let raf = 0;
      const step = (now) => {
        const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        const x = a + (target - a) * e;
        setV(x); from.current = x;
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
      return () => cancelAnimationFrame(raf);
    }, [target]);
    return v;
  }
  const Tween = ({ value, dp }) => { const v = useTween(value); return <>{fmt(v == null ? null : v, dp)}</>; };

  function ReviewChip({ e, compact }) {
    const r = (e && e.reviewed) || { state: 'none' };
    const when = r.at ? new Date(r.at).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    if (r.state === 'ok') return <span className="dc-chip is-green" title={'Reviewed by ' + (r.by || '?') + ' on ' + when}><Svg d={IC.shield} s={11} />{compact ? 'Reviewed' : 'Reviewed by ' + (r.by || '?') + ' · ' + when}</span>;
    if (r.state === 'stale') return <span className="dc-chip is-red" title={'Edited after ' + (r.by || '?') + ' reviewed it on ' + when}><Svg d={IC.alert} s={11} />Changed since review</span>;
    return <span className="dc-chip is-amber" title="Built-in default from published references — not yet checked against this hospital's protocol"><Svg d={IC.alert} s={11} />{compact ? 'Not reviewed' : 'Not yet reviewed by pharmacy'}</span>;
  }
  const HighAlert = () => <span className="dc-chip is-red-solid" title="ISMP high-alert medication — independent two-person check">HIGH-ALERT</span>;

  function Field({ label, children, hint, wide }) {
    return <label className={'dc-field' + (wide ? ' is-wide' : '')}><span className="dc-flabel">{label}</span>{children}{hint ? <span className="dc-fhint">{hint}</span> : null}</label>;
  }
  const NumIn = ({ value, onChange, placeholder, step, min, style, autoFocus, ariaLabel }) => (
    <input className="inp dc-num" inputMode="decimal" type="number" step={step || 'any'} min={min != null ? min : 0} value={value} placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)} style={style} autoFocus={autoFocus} aria-label={ariaLabel} />
  );
  function Seg({ value, options, onChange, small }) {
    return (
      <div className={'dc-seg' + (small ? ' is-small' : '')} role="radiogroup">
        {options.map((o) => (
          <button key={o.v} role="radio" aria-checked={value === o.v} className={value === o.v ? 'is-on' : ''} onClick={() => onChange(o.v)} title={o.title || ''}>{o.l}</button>
        ))}
      </div>
    );
  }

  /* ================= reorderable list (pointer drag + ▲▼, FLIP reflow) ================= */
  function useFlip(ref, sig) {
    const prev = useRef({});
    useLayoutEffect(() => {
      const el = ref.current;
      if (!el) return;
      const kids = Array.from(el.querySelectorAll(':scope > [data-flip]'));
      const next = {};
      kids.forEach((k) => { next[k.getAttribute('data-flip')] = k.getBoundingClientRect(); });
      if (!reduceMotion()) {
        kids.forEach((k) => {
          const key = k.getAttribute('data-flip'), a = prev.current[key], b = next[key];
          if (!a || !b) return;
          const dx = a.left - b.left, dy = a.top - b.top;
          if (!dx && !dy) return;
          k.style.transition = 'none';
          k.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
          requestAnimationFrame(() => { k.style.transition = 'transform .24s cubic-bezier(.2,.8,.2,1)'; k.style.transform = ''; });
        });
      }
      prev.current = next;
    }, [sig]);
  }
  function Sortable({ items, getKey, onMove, enabled, render, className, axis, style }) {
    const ref = useRef(null);
    const [dragKey, setDragKey] = useState(null);
    const keys = items.map(getKey);
    useFlip(ref, keys.join('|'));
    const startDrag = (e, key) => {
      if (!enabled) return;
      e.preventDefault();
      setDragKey(key);
      const onMoveP = (ev) => {
        const el = ref.current;
        if (!el) return;
        const kids = Array.from(el.querySelectorAll(':scope > [data-flip]'));
        const cur = kids.findIndex((k) => k.getAttribute('data-flip') === key);
        if (cur < 0) return;
        const p = axis === 'x' ? ev.clientX : ev.clientY;
        let target = cur;
        kids.forEach((k, i) => {
          const r = k.getBoundingClientRect();
          const mid = axis === 'x' ? r.left + r.width / 2 : r.top + r.height / 2;
          if (i < cur && p < mid) target = Math.min(target, i);
          if (i > cur && p > mid) target = Math.max(target, i);
        });
        if (target !== cur) onMove(cur, target);
      };
      const end = () => { setDragKey(null); window.removeEventListener('pointermove', onMoveP); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end); };
      window.addEventListener('pointermove', onMoveP);
      window.addEventListener('pointerup', end);
      window.addEventListener('pointercancel', end);
    };
    return (
      <div ref={ref} className={className} style={style}>
        {items.map((it, i) => {
          const key = getKey(it);
          const handle = enabled ? (
            <span className="dc-handle" onClick={(e) => e.stopPropagation()}>
              <button className="dc-grip" aria-label="Drag to reorder" onPointerDown={(e) => startDrag(e, key)}><Svg d={IC.grip} s={14} sw={3} /></button>
              <button className="dc-mv" aria-label="Move up" disabled={i === 0} onClick={() => onMove(i, i - 1)}><Svg d={axis === 'x' ? 'M15 6l-6 6 6 6' : IC.up} s={11} sw={2.4} /></button>
              <button className="dc-mv" aria-label="Move down" disabled={i === items.length - 1} onClick={() => onMove(i, i + 1)}><Svg d={axis === 'x' ? 'M9 6l6 6-6 6' : IC.down} s={11} sw={2.4} /></button>
            </span>
          ) : null;
          return <div key={key} data-flip={key} className={'dc-sort-item' + (dragKey === key ? ' is-dragging' : '')}>{render(it, handle, i)}</div>;
        })}
      </div>
    );
  }

  /* ================= gauge ================= */
  function DoseGauge({ entry, dose, unit }) {
    const soft = (entry && entry.soft) || [0, 0], hard = entry && entry.hard;
    const top = (hard || soft[1] || 1) * 1.25;
    const W = 240, H = 136, cx = 120, cy = 118, R = 92;
    const ang = (v) => Math.PI + Math.max(0, Math.min(1, v / top)) * Math.PI;
    const pt = (v, r) => [cx + (r || R) * Math.cos(ang(v)), cy + (r || R) * Math.sin(ang(v))];
    const arc = (a, b) => { const p = pt(a), q = pt(b); return 'M' + p[0] + ' ' + p[1] + ' A' + R + ' ' + R + ' 0 0 1 ' + q[0] + ' ' + q[1]; };
    const segs = [[0, soft[0], '#8fb7d6'], [soft[0], soft[1], '#1f9d57'], [soft[1], hard || soft[1], '#e08a1e'], [hard || soft[1], top, '#d23a52']].filter((s) => s[1] > s[0]);
    const v = Number(dose);
    const has = Number.isFinite(v);
    const deg = has ? Math.max(0, Math.min(1, v / top)) * 180 - 90 : -90;
    const level = has ? D.checkLimits(entry, v) : null;
    return (
      <div className="dc-gauge">
        <svg viewBox={'0 0 ' + W + ' ' + H} width="100%" style={{ maxWidth: 260 }} role="img" aria-label="Dose against the usual range">
          <path d={arc(0, top)} stroke="rgba(125,145,180,.16)" strokeWidth="16" fill="none" strokeLinecap="round" />
          {segs.map((s, i) => <path key={i} d={arc(s[0], s[1])} stroke={s[2]} strokeWidth="14" fill="none" opacity=".88" />)}
          {[soft[0], soft[1], hard].filter((x) => x != null && x > 0).map((x, i) => {
            const p = pt(x, R + 17);
            return <text key={i} x={p[0]} y={p[1]} fontSize="9" textAnchor="middle" fill="#6c7a8c" fontFamily="IBM Plex Mono,monospace">{fmt(x)}</text>;
          })}
          <g style={{ transform: 'rotate(' + deg + 'deg)', transformOrigin: cx + 'px ' + cy + 'px', transition: 'transform .7s cubic-bezier(.34,1.56,.64,1)' }}>
            <path d={'M' + (cx - 4) + ' ' + cy + ' L' + cx + ' ' + (cy - R + 8) + ' L' + (cx + 4) + ' ' + cy + ' Z'} fill="#16202e" />
          </g>
          <circle cx={cx} cy={cy} r="8" fill="#16202e" /><circle cx={cx} cy={cy} r="3" fill="#fff" />
        </svg>
        <div className={'dc-gauge-cap is-' + (level || 'none')}>
          {level === 'ok' ? 'Within the usual range' : level === 'low' ? 'Below the usual range' : level === 'high' ? 'Above the usual range — check' : level === 'hard' ? 'OVER THE HARD LIMIT' : 'Enter a dose'}
          <span>usual {fmt(soft[0])}–{fmt(soft[1])} · max {fmt(hard)} {unit}</span>
        </div>
      </div>
    );
  }

  /* ================= printing (hidden iframe — no pop-ups, no dialogs) ================= */
  function printHtml(title, body, page) {
    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(f);
    const doc = f.contentWindow.document;
    doc.open();
    doc.write('<!doctype html><html><head><meta charset="utf-8"><title>' + escH(title) + '</title><style>' +
      '@page{size:' + (page || 'A4') + ';margin:10mm}body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:0}' +
      '.lbl{border:2px solid #111;border-radius:6px;padding:10px 12px;width:92mm;margin:0 0 8mm;page-break-inside:avoid}' +
      '.lbl .ha{background:#c8102e;color:#fff;font-weight:700;font-size:11px;padding:2px 6px;display:inline-block;border-radius:3px;letter-spacing:1px}' +
      '.lbl h1{font-size:19px;margin:6px 0 2px}.lbl .c{font-size:12px}.lbl .big{font-size:26px;font-weight:800;margin:6px 0 0}.lbl .d{font-size:13px}' +
      '.lbl .row{display:flex;gap:10px;font-size:11px;margin-top:7px}.lbl .row div{flex:1;border-bottom:1px solid #555;padding-top:12px}' +
      'table{border-collapse:collapse;width:100%;font-size:11px}th,td{border:1px solid #999;padding:4px 6px;text-align:left;vertical-align:top}th{background:#eef2f6}' +
      'h2{font-size:15px;margin:12px 0 4px}.hd{display:flex;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:6px;margin-bottom:8px}' +
      '.mut{color:#555;font-size:10px}.cap{color:#b00;font-weight:700}' +
      '</style></head><body>' + body + '</body></html>');
    doc.close();
    setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) {} setTimeout(() => { try { document.body.removeChild(f); } catch (e) {} }, 1500); }, 250);
  }

  /* ================= patient bar ================= */
  function derive(p) {
    const w = parseFloat(p.weight), h = parseFloat(p.height);
    const ibw = D.ibw(h, p.sex);
    const adj = D.adjBw(w, ibw);
    return {
      weight: w > 0 ? w : null, ibw, adj, bmi: D.bmi(w, h), bsa: D.bsaMosteller(w, h),
      crcl: D.crclCockcroftGault({ age: p.age, weight: p.basis === 'actual' ? w : (adj || w), scr: p.scr, scrUnit: p.scrUnit, sex: p.sex }),
      egfr: D.egfrCkdEpi2021({ age: p.age, scr: p.scr, scrUnit: p.scrUnit, sex: p.sex }),
      adult: D.isAdult(w, p.age),
    };
  }
  function dosingWeight(p, dv, entry) {
    if (entry && entry.weight === 'none') return null;
    if (p.basis === 'ideal' && dv.ibw) return Math.min(dv.ibw, dv.weight || dv.ibw);
    if (p.basis === 'adjusted' && dv.adj) return dv.adj;
    return dv.weight;
  }
  function PatientBar({ p, set, dv }) {
    const [open, setOpen] = useState(false);
    const upd = (k) => (v) => set(Object.assign({}, p, { [k]: v }));
    const w = parseFloat(p.weight), a = parseFloat(p.age);
    const est = !(w > 0) && a >= 0 && a <= 12 ? D.weightFromAge(a) : null;
    const weird = w > 0 && (w < 0.4 || w > 300);
    return (
      <div className="dc-card dc-patient">
        <div className="dc-pt-row">
          <div className="dc-pt-title"><span className="dc-pt-dot" />Patient</div>
          <Field label="Weight (kg)"><NumIn value={p.weight} onChange={upd('weight')} placeholder="e.g. 70" ariaLabel="Weight in kg" /></Field>
          <Field label="Height (cm)"><NumIn value={p.height} onChange={upd('height')} placeholder="for IBW/BSA" /></Field>
          <Field label="Age (years)"><NumIn value={p.age} onChange={upd('age')} placeholder="years" /></Field>
          <Field label="Sex"><Seg small value={p.sex} onChange={upd('sex')} options={[{ v: 'M', l: 'Male' }, { v: 'F', l: 'Female' }]} /></Field>
          <Field label="Creatinine">
            <div className="dc-inline">
              <NumIn value={p.scr} onChange={upd('scr')} placeholder={p.scrUnit === 'umol' ? 'µmol/L' : 'mg/dL'} style={{ width: 80 }} />
              <Seg small value={p.scrUnit} onChange={upd('scrUnit')} options={[{ v: 'umol', l: 'µmol/L' }, { v: 'mg', l: 'mg/dL' }]} />
            </div>
          </Field>
          <Field label="Dose by">
            <Seg small value={p.basis} onChange={upd('basis')} options={[
              { v: 'actual', l: 'Actual', title: 'Actual (total) body weight' },
              { v: 'ideal', l: 'Ideal', title: 'Ideal body weight (Devine) — needs height' },
              { v: 'adjusted', l: 'Adjusted', title: 'IBW + 0.4 × (actual − IBW) — needs height' }]} />
          </Field>
          <button className="dc-link" onClick={() => setOpen(!open)}>{open ? 'Hide label details' : 'Label details'}</button>
        </div>
        {open ? (
          <div className="dc-pt-row is-sub">
            <Field label="Patient name (labels only)" wide><input className="inp" value={p.name || ''} onChange={(e) => upd('name')(e.target.value)} placeholder="optional" /></Field>
            <Field label="UHID / Bed"><input className="inp" value={p.uhid || ''} onChange={(e) => upd('uhid')(e.target.value)} placeholder="optional" /></Field>
            <span className="dc-fhint" style={{ alignSelf: 'end' }}>Kept in this browser tab only — never saved or sent.</span>
          </div>
        ) : null}
        <div className="dc-derived">
          {est ? <button className="dc-pill is-action" onClick={() => upd('weight')(String(est))}>Use APLS estimate {est} kg for age {a}</button> : null}
          {weird ? <span className="dc-pill is-red"><Svg d={IC.alert} s={12} /> Check the weight — {p.weight} kg</span> : null}
          <span className="dc-pill"><b>IBW</b> {dv.ibw ? fmt(dv.ibw, 1) + ' kg' : '—'}</span>
          <span className="dc-pill"><b>Adj BW</b> {dv.adj ? fmt(dv.adj, 1) + ' kg' : '—'}</span>
          <span className="dc-pill"><b>BMI</b> {dv.bmi ? fmt(dv.bmi, 1) : '—'}</span>
          <span className="dc-pill"><b>BSA</b> {dv.bsa ? fmt(dv.bsa, 2) + ' m²' : '—'}</span>
          <span className="dc-pill" title="Cockcroft–Gault, using the dosing weight basis"><b>CrCl</b> {dv.crcl ? fmt(dv.crcl, 0) + ' mL/min' : '—'}</span>
          <span className="dc-pill" title="CKD-EPI 2021"><b>eGFR</b> {dv.egfr ? fmt(dv.egfr, 0) : '—'}</span>
          <span className={'dc-pill ' + (dv.weight ? (dv.adult ? 'is-blue' : 'is-violet') : '')}>{dv.weight ? (dv.adult ? 'Adult doses' : 'Child doses') : 'No weight yet'}</span>
        </div>
      </div>
    );
  }

  /* ================= monograph panel ================= */
  function MonographPanel({ query }) {
    const [gen, setGen] = useState(null);
    const [state, setState] = useState('idle');
    const [q, setQ] = useState('');
    const load = (id) => api.get('/api/med/generic/' + id).then((r) => { if (r && r.ok) { setGen(r.generic); setState('ok'); } else setState('none'); }).catch(() => setState('none'));
    useEffect(() => {
      const term = String(query || '').replace(/\(.*?\)/g, '').replace(/[—-].*$/, '').split(/\s+/).slice(0, 2).join(' ').trim();
      if (!term) return;
      setState('loading');
      api.get('/api/med/search?kind=generic&limit=5&q=' + encodeURIComponent(term)).then((r) => {
        const g = r && r.generics && r.generics[0];
        if (g) load(g.id); else { setGen(null); setState('none'); }
      }).catch(() => setState('none'));
    }, [query]);
    const Box = window.DrugSearchBox, Mono = window.MedMonograph;
    return (
      <div className="dc-card dc-rise">
        <div className="dc-card-h"><Svg d={IC.book} /><b>Dosage from the monograph</b><span className="dc-sub">for comparison — the drug index's own text</span></div>
        <div className="dc-card-b">
          {Box ? <Box value={q} onChange={setQ} onPick={(p) => { const id = p.kind === 'generic' ? p.doc.id : p.doc.genericId; if (id) { setState('loading'); load(id); } setQ(''); }} placeholder="Look up another drug's dosage section" /> : null}
          {state === 'loading' ? <div className="dc-muted" style={{ marginTop: 12 }}>Looking it up…</div> : null}
          {state === 'none' ? <div className="dc-muted" style={{ marginTop: 12 }}>No monograph found for “{query}” in the drug index.</div> : null}
          {gen && state === 'ok' ? (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: MK.INK, marginBottom: 6 }}>{gen.name}</div>
              {gen.monograph && gen.monograph.dosage && Mono ? <div className="dc-mono"><Mono html={gen.monograph.dosage} /></div> : <div className="dc-muted">No dosage section recorded for this generic.</div>}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  /* ================= drug picker (groups, favourites, search, reorder) ================= */
  function DrugPicker({ kind, list, selected, onPick, order, groupOrder, setOrder, setGroupOrder, arrange, favs, toggleFav, subtitle }) {
    const [q, setQ] = useState('');
    const [closed, setClosed] = useState({});
    const live = list.filter((e) => !e.disabled);
    const ordered = D.applyOrder(live, order);
    const groups = D.applyOrder(Array.from(new Set(ordered.map((e) => e.group || 'Other'))).map((g) => ({ id: g })), groupOrder).map((g) => g.id);
    const term = q.trim().toLowerCase();
    const match = (e) => !term || (e.name + ' ' + (e.group || '')).toLowerCase().indexOf(term) >= 0;
    const favList = ordered.filter((e) => favs.indexOf(e.id) >= 0 && match(e));
    const moveInGroup = (g) => (from, to) => {
      const inG = ordered.filter((e) => (e.group || 'Other') === g);
      const moved = D.moveItem(inG, from, to);
      // Splice the group's new order back into the full list at the group's slots.
      let k = 0;
      const full = ordered.map((e) => ((e.group || 'Other') === g ? moved[k++] : e));
      setOrder(full.map((e) => e.id));
    };
    const Row = (e, handle) => (
      <div className={'dc-drug' + (selected === e.id ? ' is-on' : '')} onClick={() => onPick(e.id)} role="button" tabIndex={0}
        onKeyDown={(ev) => { if (ev.key === 'Enter') onPick(e.id); }} style={{ '--g': colorOf(e.group) }}>
        {handle}
        <span className="dc-drug-bar" />
        <span className="dc-drug-name">{e.name}{e.custom ? <em> · hospital</em> : null}</span>
        <span className="dc-drug-meta">
          {e.highAlert ? <i className="dc-dot is-red" title="High-alert" /> : null}
          <i className={'dc-dot is-' + (e.reviewed.state === 'ok' ? 'green' : e.reviewed.state === 'stale' ? 'redring' : 'amber')} title={e.reviewed.state === 'ok' ? 'Reviewed' : e.reviewed.state === 'stale' ? 'Changed since review' : 'Not yet reviewed'} />
          <button className={'dc-star' + (favs.indexOf(e.id) >= 0 ? ' is-on' : '')} aria-label="Favourite" onClick={(ev) => { ev.stopPropagation(); toggleFav(e.id); }}><Svg d={IC.star} s={13} /></button>
        </span>
      </div>
    );
    return (
      <div className="dc-card dc-picker">
        <div className="dc-card-h"><b>{subtitle}</b><span className="dc-count">{live.length}</span></div>
        <div className="dc-search"><Svg d={IC.search} s={14} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search drugs…" aria-label="Search drugs" />{q ? <button onClick={() => setQ('')} aria-label="Clear"><Svg d={IC.x} s={12} /></button> : null}</div>
        <div className="dc-picker-scroll">
          {favList.length && !arrange ? (
            <div className="dc-group">
              <div className="dc-group-h is-fav"><Svg d={IC.star} s={12} />Favourites</div>
              {favList.map((e) => <div key={'f' + e.id}>{Row(e, null)}</div>)}
            </div>
          ) : null}
          <Sortable items={groups.map((g) => ({ id: g }))} getKey={(g) => g.id} enabled={arrange && !term}
            onMove={(a, b) => setGroupOrder(D.moveItem(groups, a, b))}
            render={(g, handle) => {
              const rows = ordered.filter((e) => (e.group || 'Other') === g.id && match(e));
              if (!rows.length) return null;
              const isClosed = closed[g.id] && !term;
              return (
                <div className="dc-group" style={{ '--g': colorOf(g.id) }}>
                  <div className="dc-group-h">
                    {handle}
                    <button className="dc-group-t" onClick={() => setClosed(Object.assign({}, closed, { [g.id]: !closed[g.id] }))} aria-expanded={!isClosed}>
                      <span className="dc-gdot" />{g.id}<span className="dc-count">{rows.length}</span>
                      <span className={'dc-chev' + (isClosed ? '' : ' is-open')}><Svg d={IC.down} s={12} /></span>
                    </button>
                  </div>
                  {isClosed ? null : (
                    <Sortable items={rows} getKey={(e) => e.id} enabled={arrange && !term} onMove={moveInGroup(g.id)} render={(e, h) => Row(e, h)} />
                  )}
                </div>
              );
            }} />
          {!ordered.some(match) ? <div className="dc-muted" style={{ padding: 16 }}>Nothing matches “{q}”.</div> : null}
        </div>
      </div>
    );
  }

  /* ================= ICU infusions ================= */
  function InfusionTab({ lib, p, dv, prefs, layout, setPref, arrange, restore, onRecent, admin }) {
    const list = lib.infusion;
    const firstId = (D.applyOrder(list.filter((e) => !e.disabled), (prefs.order || {}).infusion || layout.infusion)[0] || {}).id;
    const [drugId, setDrugId] = useState(() => (restore && restore.drugId) || prefs.lastInfusion || firstId);
    const entry = list.find((e) => e.id === drugId && !e.disabled) || list.find((e) => e.id === firstId);
    const [ci, setCi] = useState(0);
    const [custom, setCustom] = useState({ amount: '', unit: 'mg', ml: '50' });
    const [mode, setMode] = useState('dose');
    const [doseVal, setDoseVal] = useState(entry ? String(entry.start) : '');
    const [rateVal, setRateVal] = useState('');
    const [showMono, setShowMono] = useState(false);
    const [pumpKey, setPumpKey] = useState(0);

    const pick = (id) => {
      const e = list.find((x) => x.id === id);
      setDrugId(id); setCi(0); setMode('dose'); setDoseVal(e ? String(e.start) : ''); setRateVal(''); setPumpKey((k) => k + 1);
      setPref({ lastInfusion: id });
    };
    useEffect(() => {
      if (!restore) return;
      setDrugId(restore.drugId); setCi(restore.ci || 0); setMode('dose'); setDoseVal(String(restore.dose)); setPumpKey((k) => k + 1);
      if (restore.custom) setCustom(restore.custom);
    }, [restore]);

    if (!entry) return <div className="dc-card"><div className="dc-empty">Every infusion is switched off in the library.</div></div>;

    const concs = entry.conc || [];
    const conc = ci === 'custom' ? { label: 'Custom', amount: parseFloat(custom.amount), unit: custom.unit, ml: parseFloat(custom.ml) } : concs[ci] || concs[0];
    const u = D.parseUnit(entry.unit);
    const w = dosingWeight(p, dv, entry);
    const needW = u.perKg && !(w > 0);
    const perMlDose = D.concPerMl(conc, u.amount);
    const dose = mode === 'dose' ? parseFloat(doseVal) : D.doseFromRate({ rate: parseFloat(rateVal), unit: entry.unit, weight: w, conc });
    const rate = mode === 'dose' ? D.rateFromDose({ dose: parseFloat(doseVal), unit: entry.unit, weight: w, conc }) : parseFloat(rateVal);
    const pumpRate = rate != null && Number.isFinite(rate) ? D.roundToPump(rate) : null;
    const delivered = pumpRate != null ? D.doseFromRate({ rate: pumpRate, unit: entry.unit, weight: w, conc }) : null;
    const level = dose != null && Number.isFinite(dose) ? D.checkLimits(entry, dose) : null;
    const maxDose = (entry.hard || (entry.soft || [])[1] || 1) * 1.25;
    const maxRate = D.rateFromDose({ dose: maxDose, unit: entry.unit, weight: w || 70, conc }) || 50;
    const prep = ci === 'custom' ? null : D.prepPlan(conc, entry.ampoule);
    const totals = pumpRate ? D.dailyTotals(entry, conc, pumpRate) : null;
    const table = D.titrationTable(entry, conc, w || null, 16);
    const color = colorOf(entry.group);
    const isSyringe = !(conc && conc.ml > 60);
    const ideal = entry.weight === 'ideal' && p.basis === 'actual' && dv.ibw && dv.weight && dv.weight > dv.ibw * 1.2;

    const onPumpRate = (r) => {
      if (mode === 'rate') setRateVal(String(r));
      else { const d = D.doseFromRate({ rate: r, unit: entry.unit, weight: w, conc }); if (d != null) setDoseVal(String(D.round(d, 4))); }
    };
    const stepDose = (dir) => {
      if (mode === 'dose') setDoseVal(String(Math.max(0, D.round((parseFloat(doseVal) || 0) + dir * entry.step, 4))));
      else setRateVal(String(Math.max(0, D.roundToPump((parseFloat(rateVal) || 0) + dir * (isSyringe ? 0.1 : 1)))));
    };
    const concText = conc && conc.amount > 0 ? fmt(conc.amount) + ' ' + conc.unit + ' in ' + fmt(conc.ml) + ' mL = ' + fmt(perMlDose) + ' ' + u.amount + '/mL' : 'Enter a concentration';
    const doseText = dose != null && Number.isFinite(dose) ? fmt(dose) + ' ' + entry.unit : '';

    const printLabel = () => {
      if (level === 'hard') { toast('Over the hard limit — no label printed.', 'error'); return; }
      const when = new Date().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
      const one = '<div class="lbl">' + (entry.highAlert ? '<span class="ha">HIGH-ALERT · TWO-PERSON CHECK</span>' : '') +
        '<h1>' + escH(entry.name) + '</h1><div class="c">' + escH(concText) + (entry.diluent ? ' · ' + escH(entry.diluent) : '') + '</div>' +
        '<div class="big">' + fmt(pumpRate) + ' mL/h</div><div class="d">= ' + fmt(delivered) + ' ' + escH(entry.unit) + (u.perKg ? ' @ ' + fmt(w, 1) + ' kg' + (p.basis !== 'actual' ? ' (' + p.basis + ' BW)' : '') : '') + '</div>' +
        '<div class="c" style="margin-top:6px">Patient: <b>' + escH(p.name || '__________________') + '</b> &nbsp; UHID/Bed: <b>' + escH(p.uhid || '__________') + '</b></div>' +
        '<div class="row"><div>Prepared by</div><div>Checked by</div></div><div class="row"><div>Date/time: ' + escH(when) + '</div><div>Expires</div></div>' +
        '<div class="mut" style="margin-top:6px">UNICO dose calculator · ' + escH(entry.reviewed.state === 'ok' ? 'library reviewed by ' + entry.reviewed.by : 'library entry not yet reviewed by pharmacy') + '</div></div>';
      printHtml('Infusion label — ' + entry.name, one + one, 'A4');
      onRecent({ kind: 'infusion', drugId: entry.id, ci, custom: ci === 'custom' ? custom : null, dose: D.round(dose, 4), weight: p.weight, label: entry.name + ' ' + fmt(dose) + ' ' + entry.unit + ' → ' + fmt(pumpRate) + ' mL/h' });
    };

    return (
      <div className="dc-inf">
        <DrugPicker kind="infusion" list={list} selected={entry.id} onPick={pick} subtitle="ICU drug library"
          order={(prefs.order || {}).infusion || layout.infusion} groupOrder={((prefs.groups || {}).infusion) || (layout.groups || {}).infusion}
          setOrder={(o) => setPref({ order: Object.assign({}, prefs.order, { infusion: o }) })}
          setGroupOrder={(o) => setPref({ groups: Object.assign({}, prefs.groups, { infusion: o }) })}
          arrange={arrange} favs={prefs.favs || []} toggleFav={(id) => setPref({ favs: (prefs.favs || []).indexOf(id) >= 0 ? prefs.favs.filter((x) => x !== id) : [id].concat(prefs.favs || []) })} />

        <div className="dc-col">
          <div className="dc-card dc-rise" key={'c' + entry.id} style={{ '--g': color }}>
            <div className="dc-drug-head">
              <span className="dc-drug-swatch" />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="dc-drug-title">{entry.name}</div>
                <div className="dc-chips">
                  <span className="dc-chip">{entry.group}</span>
                  <span className="dc-chip is-mono">{entry.unit}</span>
                  {entry.highAlert ? <HighAlert /> : null}
                  <ReviewChip e={entry} />
                </div>
              </div>
            </div>
            <div className="dc-card-b">
              <div className="dc-label-row">Concentration</div>
              <div className="dc-conc">
                {concs.map((c, i) => (
                  <button key={i} className={'dc-conc-chip' + (ci === i ? ' is-on' : '')} onClick={() => { setCi(i); setPumpKey((k) => k + 1); }}>
                    <b>{fmt(c.amount)} {c.unit} / {fmt(c.ml)} mL</b><span>{c.label} · {fmt(D.concPerMl(c, u.amount))} {u.amount}/mL</span>
                  </button>
                ))}
                <button className={'dc-conc-chip' + (ci === 'custom' ? ' is-on' : '')} onClick={() => { setCi('custom'); setPumpKey((k) => k + 1); }}><b>Custom</b><span>your own mix</span></button>
              </div>
              {ci === 'custom' ? (
                <div className="dc-inline dc-rise" style={{ marginTop: 8 }}>
                  <NumIn value={custom.amount} onChange={(v) => setCustom(Object.assign({}, custom, { amount: v }))} placeholder="amount" style={{ width: 90 }} autoFocus />
                  <select className="inp" value={custom.unit} onChange={(e) => setCustom(Object.assign({}, custom, { unit: e.target.value }))}>{AMOUNT_UNITS.map((x) => <option key={x}>{x}</option>)}</select>
                  <span className="dc-muted">in</span>
                  <NumIn value={custom.ml} onChange={(v) => setCustom(Object.assign({}, custom, { ml: v }))} placeholder="mL" style={{ width: 70 }} />
                  <span className="dc-muted">mL</span>
                </div>
              ) : null}

              <div className="dc-io">
                <div className="dc-io-in">
                  <div className="dc-label-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{mode === 'dose' ? 'Dose (' + entry.unit + ')' : 'Pump rate (mL/h)'}</span>
                    <Seg small value={mode} onChange={(m) => {
                      if (m === mode) return;
                      if (m === 'rate') setRateVal(pumpRate != null ? String(pumpRate) : '');
                      else setDoseVal(dose != null && Number.isFinite(dose) ? String(D.round(dose, 4)) : '');
                      setMode(m);
                    }} options={[{ v: 'dose', l: 'Dose → mL/h' }, { v: 'rate', l: 'mL/h → dose' }]} />
                  </div>
                  <div className="dc-big-in">
                    <button className="dc-step-big" onClick={() => stepDose(-1)} aria-label="Down one step">−</button>
                    <input className="dc-big-num" type="number" inputMode="decimal" step="any" min="0" value={mode === 'dose' ? doseVal : rateVal}
                      onChange={(e) => (mode === 'dose' ? setDoseVal(e.target.value) : setRateVal(e.target.value))} aria-label={mode === 'dose' ? 'Dose' : 'Rate'} />
                    <button className="dc-step-big" onClick={() => stepDose(1)} aria-label="Up one step">+</button>
                  </div>
                  <input type="range" className="dc-range" min="0" max={mode === 'dose' ? maxDose : D.round(maxRate, 1)} step={mode === 'dose' ? entry.step / 10 : 0.1}
                    value={(mode === 'dose' ? parseFloat(doseVal) : parseFloat(rateVal)) || 0} style={{ '--g': color }}
                    onChange={(e) => (mode === 'dose' ? setDoseVal(e.target.value) : setRateVal(e.target.value))} aria-label="Adjust" />
                  <div className="dc-fhint">Titration step {fmt(entry.step)} {entry.unit} · usual start {fmt(entry.start)}</div>
                </div>
                <div className={'dc-result is-' + (level || 'none')}>
                  {needW ? (
                    <div className="dc-need"><Svg d={IC.alert} s={18} /> Enter the patient's weight — this is a per-kg dose.</div>
                  ) : (
                    <>
                      <div className="dc-result-k">{mode === 'dose' ? 'Set the pump to' : 'This rate delivers'}</div>
                      <div className="dc-result-v">
                        {mode === 'dose' ? <><Tween value={pumpRate} /><small> mL/h</small></> : <><Tween value={dose} /><small> {entry.unit}</small></>}
                      </div>
                      {mode === 'dose' && rate != null && Math.abs(rate - pumpRate) > 1e-9 ? <div className="dc-result-s">exact {fmt(rate, 3)} mL/h · at {fmt(pumpRate)} mL/h the patient gets {fmt(delivered)} {entry.unit}</div> : null}
                      {u.perKg ? <div className="dc-result-s">for {fmt(w, 1)} kg{p.basis !== 'actual' ? ' (' + p.basis + ' body weight)' : ''}</div> : <div className="dc-result-s">not weight-based</div>}
                      {level === 'hard' ? <div className="dc-banner is-red"><Svg d={IC.alert} s={14} /> Over the hard limit of {fmt(entry.hard)} {entry.unit}. Label printing and the pump are locked.</div> : null}
                      {level === 'high' ? <div className="dc-banner is-amber">Above the usual range ({fmt(entry.soft[1])} {entry.unit}). Confirm with the prescriber.</div> : null}
                      {level === 'low' ? <div className="dc-banner is-amber">Below the usual range ({fmt(entry.soft[0])} {entry.unit}).</div> : null}
                    </>
                  )}
                </div>
              </div>

              {ideal ? <div className="dc-banner is-blue" style={{ marginTop: 10 }}>This drug is usually dosed on <b>ideal body weight</b> in obesity ({fmt(dv.ibw, 1)} kg). Switch “Dose by” to Ideal in the patient bar.</div> : null}

              <div className="dc-two" style={{ marginTop: 14 }}>
                <DoseGauge entry={entry} dose={dose} unit={entry.unit} />
                <div className="dc-facts">
                  <div className="dc-fact"><span>Concentration</span><b>{concText}</b></div>
                  {prep ? (
                    <div className="dc-fact"><span><Svg d={IC.flask} s={12} /> Preparation</span>
                      <b>{prep.impossible ? 'The ampoules do not fit in this volume — check the concentration.' :
                        'Open ' + prep.open + ' × ' + (entry.ampoule.label || fmt(entry.ampoule.amount) + ' ' + entry.ampoule.unit) + ', draw ' + fmt(prep.drawMl) + ' mL' +
                        (prep.undiluted ? ' — use undiluted.' : ', add ' + fmt(prep.diluentMl) + ' mL ' + (entry.diluent || 'diluent') + ' to ' + fmt(conc.ml) + ' mL.')}</b></div>
                  ) : null}
                  {totals ? <div className="dc-fact"><span>Per 24 h at {fmt(pumpRate)} mL/h</span><b>{fmt(totals.ml, 0)} mL fluid · {fmt(totals.amount)} {totals.unit} of drug</b></div> : null}
                  {pumpRate ? <div className="dc-fact"><span><Svg d={IC.clock} s={12} /> {isSyringe ? 'Syringe' : 'Bag'} lasts</span><b>{fmt(conc.ml / pumpRate, 1)} h</b></div> : null}
                </div>
              </div>
              {entry.notes ? <div className="dc-note">{entry.notes}</div> : null}
              <div className="dc-src">Source: {entry.source}{entry.custom ? ' · hospital-added' : entry.overridden ? ' · edited by the hospital' : ''}</div>
              <div className="dc-actions">
                <button style={MK.btnPri} disabled={level === 'hard' || needW || !pumpRate} onClick={printLabel}><Svg d={IC.print} s={14} /> Print syringe label</button>
                <button style={MK.btnGhost} disabled={needW || !pumpRate} onClick={() => onRecent({ kind: 'infusion', drugId: entry.id, ci, custom: ci === 'custom' ? custom : null, dose: D.round(dose, 4), weight: p.weight, label: entry.name + ' ' + fmt(dose) + ' ' + entry.unit + ' → ' + fmt(pumpRate) + ' mL/h' })}><Svg d={IC.save} s={14} /> Save to recent</button>
                <button style={MK.btnGhost} onClick={() => setShowMono(!showMono)}><Svg d={IC.book} s={14} /> {showMono ? 'Hide' : 'Show'} monograph</button>
              </div>
            </div>
          </div>

          {table.length ? (
            <div className="dc-card dc-rise">
              <div className="dc-card-h"><b>Titration chart</b><span className="dc-sub">{concText}{u.perKg ? ' · ' + fmt(w, 1) + ' kg' : ''} — click a row to set it</span></div>
              <div className="dc-ttable">
                {table.map((r, i) => {
                  const cur = dose != null && Math.abs(r.dose - dose) < (entry.step / 2);
                  return (
                    <button key={i} className={'dc-trow is-' + r.level + (cur ? ' is-cur' : '')} onClick={() => { setMode('dose'); setDoseVal(String(r.dose)); }}>
                      <span>{fmt(r.dose)} <i>{entry.unit}</i></span><b>{r.rate == null ? '—' : fmt(r.rate)} <i>mL/h</i></b>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          {showMono ? <MonographPanel query={entry.name} /> : null}
        </div>

        <div className="dc-col dc-pump-col">
          <div className="dc-card dc-rise">
            <div className="dc-card-h"><b>{isSyringe ? 'Syringe pump' : 'Volumetric pump'}</b><span className="dc-sub">live simulation</span></div>
            <div className="dc-card-b" style={{ paddingTop: 8 }}>
              {needW ? <div className="dc-empty">Enter a weight to run the pump.</div> : isSyringe
                ? <window.DosePumps.SyringePump key={pumpKey} drug={entry.name} color={color} rate={pumpRate} volume={conc && conc.ml} doseText={doseText ? '= ' + doseText : ''}
                  level={level} onRate={onPumpRate} step={0.1} bolusMl={BOLUS_GROUPS[entry.group] ? 1 : null} maxRate={maxRate} />
                : <window.DosePumps.InfusionPump key={pumpKey} fluid={entry.name.split(' ')[0] + ' ' + fmt(conc.amount) + conc.unit} color={color} rate={pumpRate} volume={conc && conc.ml}
                  dropFactor={20} doseText={doseText ? '= ' + doseText : ''} level={level} onRate={onPumpRate} step={1} maxRate={maxRate} />}
              <div className="dc-fhint" style={{ marginTop: 8 }}>A simulation to check the set-up — it does not control any device. Turn the knob or use ▲▼ and the dose above follows.</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ================= Emergency sheet ================= */
  function EmergencyTab({ lib, p, dv, prefs, layout, setPref, arrange, admin }) {
    const [q, setQ] = useState('');
    const w = dv.weight, age = parseFloat(p.age);
    const live = D.applyOrder(lib.emergency.filter((e) => !e.disabled), (prefs.order || {}).emergency || layout.emergency);
    const groups = D.applyOrder(Array.from(new Set(live.map((e) => e.group))).map((g) => ({ id: g })), ((prefs.groups || {}).emergency) || (layout.groups || {}).emergency).map((g) => g.id);
    const airway = D.airway(Number.isFinite(age) ? age : null);
    const fluid = D.maintenance421(w);
    const term = q.trim().toLowerCase();
    const doseStr = (d, unit) => !d ? '—' : d.single ? fmt(d.lo) + ' ' + unit : fmt(d.lo) + '–' + fmt(d.hi) + ' ' + unit;
    const mlStr = (d) => !d || !d.ml ? '' : Math.abs(d.ml[1] - d.ml[0]) < 1e-9 ? fmt(d.ml[0]) + ' mL' : fmt(d.ml[0]) + '–' + fmt(d.ml[1]) + ' mL';

    const print = () => {
      const when = new Date().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
      let h = '<div class="hd"><div><b style="font-size:17px">Emergency drug sheet</b><div class="mut">UNICO dose calculator · ' + escH(when) + '</div></div>' +
        '<div style="text-align:right"><b>' + escH(p.name || '') + '</b> ' + escH(p.uhid || '') + '<div>Weight <b>' + fmt(w, 1) + ' kg</b>' + (Number.isFinite(age) ? ' · Age ' + age + ' y' : '') + ' · ' + (dv.adult ? 'Adult doses' : 'Child doses') + '</div></div></div>';
      groups.forEach((g) => {
        const rows = live.filter((e) => e.group === g);
        h += '<h2>' + escH(g) + '</h2><table><tr><th style="width:30%">Drug</th><th>Dose</th><th>Volume</th><th>Preparation</th><th>Route</th><th style="width:26%">Notes</th></tr>';
        rows.forEach((e) => {
          const d = D.emergencyDose(e, w, age);
          h += '<tr><td><b>' + escH(e.name) + '</b><div class="mut">' + (Array.isArray(e.dose) ? fmt(e.dose[0]) + '–' + fmt(e.dose[1]) : fmt(e.dose)) + ' ' + escH(e.unit) + '/kg' + (e.max ? ', max ' + fmt(e.max) : '') + '</div></td><td><b>' + doseStr(d, e.unit) + '</b>' + (d && d.capped ? ' <span class="cap">MAX</span>' : '') + (d && d.adult ? ' <span class="mut">adult</span>' : '') + '</td><td>' + mlStr(d) + '</td><td>' + escH(e.prep) + '</td><td>' + escH(e.route) + '</td><td class="mut">' + escH(e.notes) + '</td></tr>';
        });
        h += '</table>';
      });
      h += '<h2>Electrical</h2><table><tr><th>Therapy</th><th>Energy</th><th>Notes</th></tr>' + LIB.ELECTRICAL.map((e) => { const d = D.electricalDose(e, w, age); return '<tr><td>' + escH(e.name) + '</td><td><b>' + (d ? (Math.abs(d.hi - d.lo) < 1e-9 ? fmt(d.lo, 0) : fmt(d.lo, 0) + '–' + fmt(d.hi, 0)) + ' J' : '—') + '</b></td><td class="mut">' + escH(e.notes) + '</td></tr>'; }).join('') + '</table>';
      if (airway) h += '<h2>Airway & fluids</h2><table><tr><td>ETT cuffed / uncuffed</td><td><b>' + (airway.cuffed || '—') + ' / ' + (airway.uncuffed || '—') + '</b>' + (airway.depth ? ' · oral depth ' + airway.depth + ' cm' : '') + '</td><td class="mut">' + escH(airway.note) + '</td></tr>' + (fluid ? '<tr><td>Maintenance fluid</td><td><b>' + fmt(fluid.mlPerHour) + ' mL/h</b> (' + fmt(fluid.mlPerDay, 0) + ' mL/day)</td><td class="mut">Holliday–Segar 4-2-1</td></tr>' : '') + '</table>';
      h += '<div style="display:flex;gap:30px;margin-top:16px;font-size:11px"><div style="flex:1;border-top:1px solid #333;padding-top:3px">Calculated by</div><div style="flex:1;border-top:1px solid #333;padding-top:3px">Checked by</div></div>' +
        '<p class="mut">Calculation aid only — verify against the prescription and hospital protocol. Library entries not reviewed by pharmacy are defaults from ' + escH('AHA PALS / ACLS 2020 and APLS') + '.</p>';
      printHtml('Emergency drug sheet', h, 'A4');
    };

    if (!w) return <div className="dc-card dc-rise"><div className="dc-empty"><b>Enter a weight</b> in the patient bar (or an age up to 12 for the APLS estimate) and the whole resuscitation sheet is calculated.</div></div>;
    return (
      <div className="dc-col">
        <div className="dc-em-top">
          <div className="dc-stat is-big"><span>Weight</span><b>{fmt(w, 1)} kg</b><i>{dv.adult ? 'adult doses' : 'child doses'}</i></div>
          {LIB.ELECTRICAL.slice(0, 2).map((e) => { const d = D.electricalDose(e, w, age); return <div key={e.id} className="dc-stat is-red"><span>{e.name.replace('Defibrillation — ', 'Shock — ')}</span><b>{d ? fmt(d.lo, 0) : '—'} J</b><i>{Array.isArray(e.jPerKg) ? e.jPerKg.join('–') : e.jPerKg} J/kg{d && d.adult ? ' · adult' : ''}</i></div>; })}
          <div className="dc-stat"><span>ETT (cuffed)</span><b>{airway && airway.cuffed ? airway.cuffed : '—'}</b><i>{airway ? (airway.depth ? 'oral depth ' + airway.depth + ' cm' : airway.note) : 'enter age'}</i></div>
          <div className="dc-stat"><span>Maintenance</span><b>{fluid ? fmt(fluid.mlPerHour) : '—'} mL/h</b><i>4-2-1 rule</i></div>
          <div className="dc-stat"><span>Fluid bolus</span><b>{fmt(Math.min(w * 10, 1000), 0)}–{fmt(Math.min(w * 20, 1000), 0)} mL</b><i>10–20 mL/kg</i></div>
        </div>
        <div className="dc-card dc-rise">
          <div className="dc-card-h">
            <b>Weight-based emergency drugs</b>
            <div className="dc-search is-inline"><Svg d={IC.search} s={14} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter…" /></div>
            <button style={Object.assign({}, MK.btnPri, { marginLeft: 'auto' })} onClick={print}><Svg d={IC.print} s={14} /> Print A4 sheet</button>
          </div>
          <Sortable items={groups.map((g) => ({ id: g }))} getKey={(g) => g.id} enabled={arrange && !term}
            onMove={(a, b) => setPref({ groups: Object.assign({}, prefs.groups, { emergency: D.moveItem(groups, a, b) }) })}
            render={(g, handle) => {
              const rows = live.filter((e) => e.group === g.id && (!term || e.name.toLowerCase().indexOf(term) >= 0));
              if (!rows.length) return null;
              return (
                <div className="dc-em-group" style={{ '--g': colorOf(g.id) }}>
                  <div className="dc-em-gh">{handle}<span className="dc-gdot" />{g.id}</div>
                  <Sortable items={rows} getKey={(e) => e.id} enabled={arrange && !term}
                    onMove={(a, b) => {
                      const moved = D.moveItem(rows, a, b); let k = 0;
                      setPref({ order: Object.assign({}, prefs.order, { emergency: live.map((e) => (e.group === g.id ? moved[k++] : e)).map((e) => e.id) }) });
                    }}
                    render={(e, h) => {
                      const d = D.emergencyDose(e, w, age);
                      return (
                        <div className="dc-em-row">
                          {h}
                          <div className="dc-em-name"><b>{e.name}</b><span>{Array.isArray(e.dose) ? fmt(e.dose[0]) + '–' + fmt(e.dose[1]) : fmt(e.dose)} {e.unit}/kg{e.max ? ' · max ' + fmt(e.max) + ' ' + e.unit : ''}</span></div>
                          <div className="dc-em-dose"><b>{doseStr(d, e.unit)}</b>{d && d.capped ? <span className="dc-chip is-red">MAX</span> : null}{d && d.adult ? <span className="dc-chip is-blue">adult</span> : null}</div>
                          <div className="dc-em-ml">{mlStr(d) || <span className="dc-muted">—</span>}<span>{e.prep}</span></div>
                          <div className="dc-em-route">{e.route}</div>
                          <div className="dc-em-note">{e.notes}<ReviewChip e={e} compact /></div>
                        </div>
                      );
                    }} />
                </div>
              );
            }} />
          <div className="dc-card-b" style={{ borderTop: '1px solid ' + MK.LINE }}>
            <div className="dc-em-elec">
              {LIB.ELECTRICAL.map((e) => { const d = D.electricalDose(e, w, age); return <div key={e.id} className="dc-fact"><span>{e.name}</span><b>{d ? (Math.abs(d.hi - d.lo) < 1e-9 ? fmt(d.lo, 0) : fmt(d.lo, 0) + '–' + fmt(d.hi, 0)) + ' J' : '—'}</b><i className="dc-muted">{e.notes}</i></div>; })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ================= Paediatric ================= */
  function OralSyringe({ ml, color }) {
    // 10 mL oral syringe up to 10 mL; above that a 30 mL medicine cup.
    const v = Number(ml);
    if (!(v > 0)) return null;
    if (v > 10) {
      const frac = Math.min(1, v / 30);
      return (
        <svg viewBox="0 0 120 130" width="110" className="dc-oral" role="img" aria-label={fmt(v) + ' mL in a medicine cup'}>
          <path d="M20 20 L100 20 L90 120 L30 120 Z" fill="rgba(235,244,252,.75)" stroke="rgba(31,59,90,.4)" />
          <clipPath id="cupClip"><path d="M20 20 L100 20 L90 120 L30 120 Z" /></clipPath>
          <rect x="0" y={120 - frac * 100} width="120" height={frac * 100} fill={color} opacity=".6" clipPath="url(#cupClip)" style={{ transition: 'all .6s cubic-bezier(.2,.8,.2,1)' }} />
          {[5, 10, 15, 20, 25, 30].map((m) => <g key={m}><line x1="22" x2="34" y1={120 - (m / 30) * 100} y2={120 - (m / 30) * 100} stroke="rgba(31,59,90,.5)" /><text x="38" y={123 - (m / 30) * 100} fontSize="8" fill="#3c4858">{m}</text></g>)}
        </svg>
      );
    }
    const X0 = 22, X1 = 182, frac = Math.min(1, v / 10);
    const head = X0 + frac * (X1 - X0);
    return (
      <svg viewBox="0 0 240 70" width="100%" style={{ maxWidth: 300 }} className="dc-oral" role="img" aria-label={'Draw up ' + fmt(v) + ' mL'}>
        <rect x={X1} y="29" width="22" height="12" rx="3" fill="#e9eef4" stroke="rgba(31,59,90,.35)" />
        <rect x={X0} y="18" width={X1 - X0} height="34" rx="6" fill="rgba(235,244,252,.75)" stroke="rgba(31,59,90,.4)" />
        <rect x={X0 + 2} y="21" width={Math.max(0, head - X0 - 2)} height="28" rx="4" fill={color} opacity=".6" style={{ transition: 'width .6s cubic-bezier(.2,.8,.2,1)' }} />
        {[...Array(21)].map((_, i) => { const x = X0 + (i / 20) * (X1 - X0); return <line key={i} x1={x} x2={x} y1="18" y2={i % 2 ? 24 : 28} stroke="rgba(31,59,90,.45)" />; })}
        {[0, 2, 4, 6, 8, 10].map((m) => <text key={m} x={X0 + (m / 10) * (X1 - X0)} y="64" fontSize="8" textAnchor="middle" fill="#3c4858">{m}</text>)}
        <g style={{ transform: 'translateX(' + (head - X0) + 'px)', transition: 'transform .6s cubic-bezier(.2,.8,.2,1)' }}>
          <rect x={X0 - 2} y="16" width="6" height="38" rx="2" fill="#2d3a4a" />
          <rect x="-60" y="31" width={X0 + 58} height="8" rx="2" fill="#d7dee7" stroke="rgba(31,59,90,.25)" transform={'translate(' + 0 + ' 0)'} />
        </g>
      </svg>
    );
  }
  function PaedTab({ lib, p, dv, prefs, layout, setPref, arrange }) {
    const list = lib.paed;
    const firstId = (D.applyOrder(list.filter((e) => !e.disabled), (prefs.order || {}).paed || layout.paed)[0] || {}).id;
    const [id, setId] = useState(prefs.lastPaed || firstId);
    const entry = list.find((e) => e.id === id && !e.disabled) || list.find((e) => e.id === firstId);
    const [si, setSi] = useState(0);
    const [perKg, setPerKg] = useState(entry ? String(entry.dose[1]) : '');
    const [showMono, setShowMono] = useState(false);
    const pick = (x) => { const e = list.find((y) => y.id === x); setId(x); setSi(0); setPerKg(e ? String(e.dose[1]) : ''); setPref({ lastPaed: x }); };
    if (!entry) return <div className="dc-card"><div className="dc-empty">Every paediatric drug is switched off in the library.</div></div>;
    const w = dv.weight;
    const strength = entry.strengths[si] || entry.strengths[0];
    const r = D.paedDose(entry, w, strength, parseFloat(perKg));
    const color = colorOf(entry.group);
    const freq = { 1: 'once daily', 2: '12-hourly (BD)', 3: '8-hourly (TDS)', 4: '6-hourly (QDS)', 6: '4-hourly' }[entry.perDay] || entry.perDay + '× daily';
    const lo = entry.dose[0], hi = entry.dose[1];
    return (
      <div className="dc-inf is-two">
        <DrugPicker kind="paed" list={list} selected={entry.id} onPick={pick} subtitle="Paediatric drugs"
          order={(prefs.order || {}).paed || layout.paed} groupOrder={((prefs.groups || {}).paed) || (layout.groups || {}).paed}
          setOrder={(o) => setPref({ order: Object.assign({}, prefs.order, { paed: o }) })}
          setGroupOrder={(o) => setPref({ groups: Object.assign({}, prefs.groups, { paed: o }) })}
          arrange={arrange} favs={prefs.favs || []} toggleFav={(x) => setPref({ favs: (prefs.favs || []).indexOf(x) >= 0 ? prefs.favs.filter((y) => y !== x) : [x].concat(prefs.favs || []) })} />
        <div className="dc-col">
          <div className="dc-card dc-rise" key={entry.id} style={{ '--g': color }}>
            <div className="dc-drug-head">
              <span className="dc-drug-swatch" />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="dc-drug-title">{entry.name}</div>
                <div className="dc-chips"><span className="dc-chip">{entry.group}</span><span className="dc-chip is-mono">{fmt(lo)}{hi !== lo ? '–' + fmt(hi) : ''} mg/kg/{entry.mode === 'day' ? 'day' : 'dose'}</span><span className="dc-chip">{freq}</span><ReviewChip e={entry} /></div>
              </div>
            </div>
            <div className="dc-card-b">
              <div className="dc-label-row">Strength</div>
              <div className="dc-conc">
                {entry.strengths.map((s, i) => <button key={i} className={'dc-conc-chip' + (si === i ? ' is-on' : '')} onClick={() => setSi(i)}><b>{s.label}</b><span>{s.form ? s.form === 'tab' ? 'tablet' : 'capsule' : fmt(s.mg / s.ml) + ' mg/mL'}</span></button>)}
              </div>
              <div className="dc-io">
                <div className="dc-io-in">
                  <div className="dc-label-row">mg/kg per {entry.mode === 'day' ? 'day' : 'dose'}</div>
                  <div className="dc-big-in">
                    <button className="dc-step-big" onClick={() => setPerKg(String(Math.max(0, D.round((parseFloat(perKg) || 0) - (hi - lo > 4 ? 1 : 0.5), 2))))}>−</button>
                    <input className="dc-big-num" type="number" step="any" min="0" value={perKg} onChange={(e) => setPerKg(e.target.value)} aria-label="mg per kg" />
                    <button className="dc-step-big" onClick={() => setPerKg(String(D.round((parseFloat(perKg) || 0) + (hi - lo > 4 ? 1 : 0.5), 2)))}>+</button>
                  </div>
                  {hi > lo ? <input type="range" className="dc-range" min={lo} max={hi} step={(hi - lo) / 20} value={parseFloat(perKg) || lo} onChange={(e) => setPerKg(e.target.value)} style={{ '--g': color }} /> : null}
                  <div className="dc-fhint">Range {fmt(lo)}{hi !== lo ? '–' + fmt(hi) : ''} mg/kg{entry.maxDose ? ' · max ' + fmt(entry.maxDose) + ' mg/dose' : ''}{entry.maxDay ? ' · max ' + fmt(entry.maxDay) + ' mg/day' : ''}{entry.maxDayPerKg ? ' (' + entry.maxDayPerKg + ' mg/kg/day)' : ''}</div>
                </div>
                <div className={'dc-result is-' + (!r ? 'none' : r.outOfRange ? 'high' : 'ok')}>
                  {!w ? <div className="dc-need"><Svg d={IC.alert} s={18} /> Enter the child's weight in the patient bar.</div> : (
                    <>
                      <div className="dc-result-k">Each dose ({freq})</div>
                      <div className="dc-result-v">
                        {r.volume != null ? <><Tween value={r.volume} /><small> mL</small></> : r.units != null ? <><Tween value={r.units} dp={2} /><small> {strength.form === 'cap' ? 'capsule(s)' : 'tablet(s)'}</small></> : <><Tween value={r.dose} /><small> mg</small></>}
                      </div>
                      <div className="dc-result-s"><b>{fmt(r.dose)} mg</b> per dose · {fmt(r.day)} mg/day for {fmt(w, 1)} kg</div>
                      {r.units != null && Math.abs(r.units * 4 - Math.round(r.units * 4)) > 0.05 ? <div className="dc-result-s">Not a whole/half/quarter tablet — a liquid form may be better.</div> : null}
                      {r.capped ? <div className="dc-banner is-amber">Capped at the {r.capped === 'dose' ? 'maximum single dose' : 'maximum daily dose'} — the mg/kg figure would give more.</div> : null}
                      {r.outOfRange ? <div className="dc-banner is-amber">{fmt(r.mgPerKg)} mg/kg is outside the usual {fmt(lo)}–{fmt(hi)} mg/kg.</div> : null}
                    </>
                  )}
                </div>
              </div>
              {r && r.volume != null ? <div className="dc-oral-wrap"><OralSyringe ml={r.volume} color={color} /><span>Draw up <b>{fmt(r.volume)} mL</b> of {strength.label}</span></div> : null}
              {entry.notes ? <div className="dc-note">{entry.notes}</div> : null}
              <div className="dc-src">Source: {entry.source}</div>
              <div className="dc-actions"><button style={MK.btnGhost} onClick={() => setShowMono(!showMono)}><Svg d={IC.book} s={14} /> {showMono ? 'Hide' : 'Show'} monograph</button></div>
            </div>
          </div>
          {showMono ? <MonographPanel query={entry.name} /> : null}
        </div>
      </div>
    );
  }

  /* ================= Clinical calculators ================= */
  const CALC_META = {
    body: 'Body size', renal: 'Renal function', fluids: 'Maintenance fluids', drip: 'IV drip rate & pump', sodium: 'Sodium correction',
    freewater: 'Free-water deficit', electrolytes: 'Corrections & gaps', parkland: 'Burns — Parkland', convert: 'Unit converter',
  };
  function useLocal(init) { const [s, set] = useState(init); return [s, (k, v) => set((o) => Object.assign({}, o, { [k]: v }))]; }
  const Out = ({ k, v, unit, strong, hint }) => (
    <div className={'dc-out' + (strong ? ' is-strong' : '')}><span>{k}</span><b>{v == null || (typeof v === 'number' && !Number.isFinite(v)) ? '—' : typeof v === 'number' ? <Tween value={v} /> : v}{unit && v != null ? <small> {unit}</small> : null}</b>{hint ? <i>{hint}</i> : null}</div>
  );
  function CalcCard({ id, p, dv, handle }) {
    const w = dv.weight;
    const body = (() => {
      if (id === 'body') return (
        <>
          <div className="dc-outs">
            <Out k="Ideal body weight (Devine)" v={dv.ibw} unit="kg" strong />
            <Out k="Adjusted body weight" v={dv.adj} unit="kg" hint="IBW + 0.4 × (actual − IBW)" />
            <Out k="BMI" v={dv.bmi} unit="kg/m²" hint={dv.bmi ? (dv.bmi < 18.5 ? 'underweight' : dv.bmi < 25 ? 'normal' : dv.bmi < 30 ? 'overweight' : 'obese') : ''} />
            <Out k="BSA (Mosteller)" v={dv.bsa} unit="m²" hint="√(height × weight / 3600)" />
          </div>
          <div className="dc-fhint">From the patient bar (weight, height, sex).</div>
        </>
      );
      if (id === 'renal') {
        const sch = D.schwartzBedside(p.height, p.scr, p.scrUnit);
        const band = (v) => v == null ? '' : v >= 90 ? 'G1 normal' : v >= 60 ? 'G2 mild' : v >= 45 ? 'G3a' : v >= 30 ? 'G3b' : v >= 15 ? 'G4 severe' : 'G5 kidney failure';
        return (
          <>
            <div className="dc-outs">
              <Out k="CrCl (Cockcroft–Gault)" v={dv.crcl} unit="mL/min" strong hint={'with ' + (p.basis === 'actual' ? 'actual' : 'adjusted') + ' weight — the figure drug labels use'} />
              <Out k="eGFR (CKD-EPI 2021)" v={dv.egfr} unit="mL/min/1.73m²" hint={band(dv.egfr)} />
              {!dv.adult ? <Out k="Bedside Schwartz (child)" v={sch} unit="mL/min/1.73m²" /> : null}
            </div>
            <div className="dc-fhint">Needs age, sex, weight and creatinine in the patient bar.</div>
          </>
        );
      }
      if (id === 'fluids') {
        const m = D.maintenance421(w);
        return (
          <div className="dc-outs">
            <Out k="Maintenance (4-2-1)" v={m && m.mlPerHour} unit="mL/h" strong />
            <Out k="Per day (100/50/20)" v={m && m.mlPerDay} unit="mL/day" />
            <Out k="Bolus 10 / 20 mL/kg" v={w ? fmt(w * 10, 0) + ' / ' + fmt(w * 20, 0) : null} unit="mL" />
          </div>
        );
      }
      return null;
    })();
    return (
      <div className="dc-card dc-calc dc-rise">
        <div className="dc-card-h">{handle}<b>{CALC_META[id]}</b></div>
        <div className="dc-card-b">{body || <CalcForm id={id} p={p} dv={dv} />}</div>
      </div>
    );
  }
  function CalcForm({ id, p, dv }) {
    const w = dv.weight;
    const [s, set] = useLocal({ vol: '1000', hours: '8', minutes: '', df: '20', fluid: 'NS 0.9%', na: '', target: '', glucose: '', gUnit: 'mmol', ca: '', alb: '', caUnit: 'mmol', cl: '', hco3: '', sbp: '', dbp: '', tbsa: '', cv: '1', cfrom: 'mg', cto: 'mcg', ratio: '1000', pct: '1', change: '8' });
    if (id === 'drip') {
      const mins = s.minutes ? parseFloat(s.minutes) : parseFloat(s.hours) * 60;
      const d = D.dripRate(s.vol, mins, s.df);
      return (
        <>
          <div className="dc-form">
            <Field label="Volume (mL)"><NumIn value={s.vol} onChange={(v) => set('vol', v)} /></Field>
            <Field label="Over (hours)"><NumIn value={s.hours} onChange={(v) => { set('hours', v); set('minutes', ''); }} /></Field>
            <Field label="Giving set">
              <select className="inp" value={s.df} onChange={(e) => set('df', e.target.value)}>
                <option value="10">10 gtt/mL (blood)</option><option value="15">15 gtt/mL</option><option value="20">20 gtt/mL (standard)</option><option value="60">60 gtt/mL (micro)</option>
              </select>
            </Field>
            <Field label="Fluid"><select className="inp" value={s.fluid} onChange={(e) => set('fluid', e.target.value)}>{Object.keys(D.FLUID_NA).map((f) => <option key={f}>{f}</option>)}</select></Field>
          </div>
          <div className="dc-outs">
            <Out k="Drip rate" v={d && d.dropsPerMin} unit="drops/min" strong hint={d ? '≈ 1 drop every ' + fmt(60 / d.dropsPerMin, 1) + ' s' : ''} />
            <Out k="Pump rate" v={d && d.mlPerHour} unit="mL/h" />
          </div>
          {d ? <window.DosePumps.InfusionPump fluid={s.fluid} color="#7cc6ec" rate={D.roundToPump(d.mlPerHour)} volume={parseFloat(s.vol)} dropFactor={parseFloat(s.df)} level={null} step={1} maxRate={Math.max(500, d.mlPerHour * 2)}
            onRate={(r) => { if (r > 0) set('minutes', String(D.round((parseFloat(s.vol) / r) * 60, 2))); }} /> : null}
        </>
      );
    }
    if (id === 'sodium') {
      const def = D.sodiumDeficit({ weight: w, sex: p.sex, age: p.age, na: s.na, target: s.target });
      const am = D.adrogueMadias({ weight: w, sex: p.sex, age: p.age, na: s.na, infusateNa: D.FLUID_NA[s.fluid], infusateK: 0, targetChange: s.change });
      return (
        <>
          <div className="dc-form">
            <Field label="Serum Na (mmol/L)"><NumIn value={s.na} onChange={(v) => set('na', v)} placeholder="e.g. 118" /></Field>
            <Field label="Target Na"><NumIn value={s.target} onChange={(v) => set('target', v)} placeholder="e.g. 126" /></Field>
            <Field label="Fluid"><select className="inp" value={s.fluid} onChange={(e) => set('fluid', e.target.value)}>{Object.keys(D.FLUID_NA).map((f) => <option key={f}>{f}</option>)}</select></Field>
            <Field label="Rise wanted in 24 h"><NumIn value={s.change} onChange={(v) => set('change', v)} /></Field>
          </div>
          <div className="dc-outs">
            <Out k="Sodium deficit" v={def} unit="mmol" strong hint={'TBW ' + fmt(D.tbw(w, p.sex, p.age), 1) + ' L'} />
            <Out k={'1 L of ' + s.fluid + ' changes Na by'} v={am && am.perLitre} unit="mmol/L" hint="Adrogué–Madias" />
            <Out k={'Litres for +' + (s.change || 0) + ' mmol/L'} v={am && am.litresForTarget} unit="L" />
          </div>
          <div className="dc-banner is-amber">Chronic hyponatraemia: raise by no more than 8–10 mmol/L in 24 h (osmotic demyelination). Recheck Na every 2–4 h.</div>
        </>
      );
    }
    if (id === 'freewater') {
      const fw = D.freeWaterDeficit({ weight: w, sex: p.sex, age: p.age, na: s.na });
      return (
        <>
          <div className="dc-form"><Field label="Serum Na (mmol/L)"><NumIn value={s.na} onChange={(v) => set('na', v)} placeholder="e.g. 160" /></Field></div>
          <div className="dc-outs">
            <Out k="Free-water deficit" v={fw != null && fw > 0 ? fw : fw != null ? 0 : null} unit="L" strong hint="TBW × (Na / 140 − 1)" />
            <Out k="Replace over 48 h" v={fw > 0 ? (fw * 1000) / 48 : null} unit="mL/h" hint="plus ongoing losses" />
          </div>
          <div className="dc-banner is-amber">Lower Na by no more than 10 mmol/L in 24 h.</div>
        </>
      );
    }
    if (id === 'electrolytes') {
      const cna = D.correctedSodium(s.na, s.glucose, s.gUnit);
      const cca = D.correctedCalcium(s.ca, s.alb, s.caUnit);
      const ag = D.anionGap(s.na, s.cl, s.hco3, s.caUnit === 'mmol' ? (parseFloat(s.alb) / 10) : s.alb);
      const map = D.meanArterial(s.sbp, s.dbp);
      return (
        <>
          <div className="dc-form">
            <Field label="Na"><NumIn value={s.na} onChange={(v) => set('na', v)} /></Field>
            <Field label="Cl"><NumIn value={s.cl} onChange={(v) => set('cl', v)} /></Field>
            <Field label="HCO₃"><NumIn value={s.hco3} onChange={(v) => set('hco3', v)} /></Field>
            <Field label="Glucose"><div className="dc-inline"><NumIn value={s.glucose} onChange={(v) => set('glucose', v)} style={{ width: 70 }} /><Seg small value={s.gUnit} onChange={(v) => set('gUnit', v)} options={[{ v: 'mmol', l: 'mmol/L' }, { v: 'mg', l: 'mg/dL' }]} /></div></Field>
            <Field label="Calcium"><NumIn value={s.ca} onChange={(v) => set('ca', v)} /></Field>
            <Field label="Albumin"><div className="dc-inline"><NumIn value={s.alb} onChange={(v) => set('alb', v)} style={{ width: 70 }} /><Seg small value={s.caUnit} onChange={(v) => set('caUnit', v)} options={[{ v: 'mmol', l: 'mmol · g/L' }, { v: 'mg', l: 'mg · g/dL' }]} /></div></Field>
            <Field label="BP (sys / dia)"><div className="dc-inline"><NumIn value={s.sbp} onChange={(v) => set('sbp', v)} style={{ width: 64 }} /><NumIn value={s.dbp} onChange={(v) => set('dbp', v)} style={{ width: 64 }} /></div></Field>
          </div>
          <div className="dc-outs">
            <Out k="Na corrected for glucose" v={cna} unit="mmol/L" hint="+2.4 per 100 mg/dL" />
            <Out k="Corrected calcium" v={cca} unit={s.caUnit === 'mmol' ? 'mmol/L' : 'mg/dL'} />
            <Out k="Anion gap" v={ag && ag.gap} unit="mmol/L" hint={ag && ag.corrected != null ? 'albumin-corrected ' + fmt(ag.corrected, 1) : 'normal 8–12'} />
            <Out k="Mean arterial pressure" v={map} unit="mmHg" />
          </div>
        </>
      );
    }
    if (id === 'parkland') {
      const pk = D.parkland(w, s.tbsa);
      return (
        <>
          <div className="dc-form"><Field label="Burn area (% TBSA)"><NumIn value={s.tbsa} onChange={(v) => set('tbsa', v)} placeholder="partial + full thickness" /></Field></div>
          <div className="dc-outs">
            <Out k="Total in 24 h (RL)" v={pk && pk.total} unit="mL" strong hint="4 mL × kg × %TBSA" />
            <Out k="First 8 h (from the burn)" v={pk && pk.first8PerHour} unit="mL/h" />
            <Out k="Next 16 h" v={pk && pk.next16PerHour} unit="mL/h" />
          </div>
          <div className="dc-fhint">Titrate to urine output 0.5 mL/kg/h (adult), 1 mL/kg/h (child). Children also need maintenance fluid.</div>
        </>
      );
    }
    if (id === 'convert') {
      const mass = D.convertUnits({ value: s.cv, from: s.cfrom, to: s.cto });
      return (
        <>
          <div className="dc-form">
            <Field label="Value"><NumIn value={s.cv} onChange={(v) => set('cv', v)} /></Field>
            <Field label="From"><select className="inp" value={s.cfrom} onChange={(e) => set('cfrom', e.target.value)}>{['g', 'mg', 'mcg', 'ng'].map((x) => <option key={x}>{x}</option>)}</select></Field>
            <Field label="To"><select className="inp" value={s.cto} onChange={(e) => set('cto', e.target.value)}>{['g', 'mg', 'mcg', 'ng'].map((x) => <option key={x}>{x}</option>)}</select></Field>
          </div>
          <div className="dc-outs"><Out k={fmt(parseFloat(s.cv)) + ' ' + s.cfrom + ' ='} v={mass} unit={s.cto} strong /></div>
          <div className="dc-form" style={{ marginTop: 6 }}>
            <Field label="Ratio 1 :"><NumIn value={s.ratio} onChange={(v) => set('ratio', v)} /></Field>
            <Field label="Percent %"><NumIn value={s.pct} onChange={(v) => set('pct', v)} /></Field>
          </div>
          <div className="dc-outs">
            <Out k={'1:' + (s.ratio || '?') + ' ='} v={D.convertUnits({ kind: 'ratio', value: s.ratio })} unit="mg/mL" hint="1:1000 adrenaline = 1 mg/mL" />
            <Out k={(s.pct || '?') + '% ='} v={D.convertUnits({ kind: 'percent', value: s.pct })} unit="mg/mL" hint="% w/v = g per 100 mL" />
          </div>
        </>
      );
    }
    return null;
  }
  function CalcsTab({ p, dv, prefs, layout, setPref, arrange }) {
    const ids = D.applyOrder(LIB.CALCS.map((id) => ({ id })), prefs.calcs || layout.calcs).map((x) => x.id);
    return (
      <Sortable items={ids.map((id) => ({ id }))} getKey={(x) => x.id} enabled={arrange} className="dc-calcs"
        onMove={(a, b) => setPref({ calcs: D.moveItem(ids, a, b) })}
        render={(x, handle) => <CalcCard id={x.id} p={p} dv={dv} handle={handle} />} />
    );
  }

  /* ================= Library manager (admin) ================= */
  const KIND_LABEL = { infusion: 'ICU infusions', emergency: 'Emergency', paed: 'Paediatric' };
  function blankEntry(kind) {
    if (kind === 'infusion') return { name: '', group: 'Insulin, heparin & others', unit: 'mg/h', conc: [{ label: 'Standard', amount: '', unit: 'mg', ml: 50 }], ampoule: { amount: '', unit: 'mg', ml: '', label: '' }, diluent: 'NS', soft: ['', ''], hard: '', start: '', step: '', highAlert: false, notes: '', source: 'Hospital protocol' };
    if (kind === 'emergency') return { name: '', group: 'Cardiac arrest', dose: '', unit: 'mg', max: '', adult: '', perMl: '', prep: '', route: 'IV', notes: '', source: 'Hospital protocol' };
    return { name: '', group: 'Other', mode: 'dose', dose: ['', ''], perDay: 3, maxDose: '', maxDay: '', strengths: [{ label: '', mg: '', ml: 5 }], notes: '', source: 'Hospital protocol' };
  }
  function LibraryManager({ lib, overrides, reload, onClose, orderSnapshot }) {
    const [kind, setKind] = useState('infusion');
    const [q, setQ] = useState('');
    const [sel, setSel] = useState(null);
    const [form, setForm] = useState(null);
    const [busy, setBusy] = useState(false);
    const [confirmDel, setConfirmDel] = useState(false);
    const list = lib[kind];
    const entry = sel === '__new' ? null : list.find((e) => e.id === sel);
    const ov = overrides.find((o) => o.id === sel);
    useEffect(() => {
      setConfirmDel(false);
      if (sel === '__new') { setForm(blankEntry(kind)); return; }
      if (!entry) { setForm(null); return; }
      const f = JSON.parse(JSON.stringify(entry));
      ['id', 'kind', 'reviewed', 'builtIn', 'custom', 'disabled', 'overridden'].forEach((k) => delete f[k]);
      setForm(f);
    }, [sel, kind]);
    const counts = (k) => { const l = lib[k]; return { all: l.length, ok: l.filter((e) => e.reviewed.state === 'ok').length, stale: l.filter((e) => e.reviewed.state === 'stale').length, off: l.filter((e) => e.disabled).length }; };
    const c = counts(kind);
    const save = () => {
      if (!form || !form.name) { toast('A drug name is required.', 'error'); return; }
      setBusy(true);
      const id = sel === '__new' ? 'h-' + kind.slice(0, 3) + '-' + Date.now().toString(36) : sel;
      api.send('PUT', '/api/med/dose-library/' + id, { kind, data: form, disabled: entry ? entry.disabled : false }).then((r) => {
        setBusy(false);
        if (r && r.ok) { toast('Saved — every clinician now calculates from this.'); reload().then(() => setSel(id)); } else toast((r && r.error) || 'Could not save.', 'error');
      }).catch(() => { setBusy(false); toast('Could not save.', 'error'); });
    };
    const toggleOff = () => {
      if (!entry) return;
      setBusy(true);
      api.send('PUT', '/api/med/dose-library/' + entry.id, { kind, data: ov && ov.data ? ov.data : {}, disabled: !entry.disabled }).then((r) => {
        setBusy(false); if (r && r.ok) { toast(entry.disabled ? 'Switched back on.' : 'Switched off — hidden from the calculator.'); reload(); } else toast((r && r.error) || 'Could not save.', 'error');
      }).catch(() => setBusy(false));
    };
    const review = (clear) => {
      setBusy(true);
      api.send('POST', '/api/med/dose-library/' + entry.id + '/review', { clear }).then((r) => {
        setBusy(false); if (r && r.ok) { toast(clear ? 'Review cleared.' : 'Marked reviewed by ' + (userName() || 'you') + '.'); reload(); } else toast((r && r.error) || 'Could not record the review.', 'error');
      }).catch(() => setBusy(false));
    };
    const del = () => {
      setBusy(true);
      api.send('DELETE', '/api/med/dose-library/' + entry.id).then((r) => { setBusy(false); if (r && r.ok) { toast('Deleted.'); setSel(null); reload(); } else toast((r && r.error) || 'Could not delete.', 'error'); }).catch(() => setBusy(false));
    };
    const publishOrder = () => {
      setBusy(true);
      api.send('PUT', '/api/med/dose-library/_layout', { layout: orderSnapshot() }).then((r) => { setBusy(false); if (r && r.ok) { toast('Hospital order saved — everyone without their own layout now sees it.'); reload(); } else toast((r && r.error) || 'Could not save the order.', 'error'); }).catch(() => setBusy(false));
    };
    const upd = (k, v) => setForm((f) => Object.assign({}, f, { [k]: v }));
    const updArr = (k, i, sub, v) => setForm((f) => { const a = (f[k] || []).slice(); a[i] = Object.assign({}, a[i], { [sub]: v }); return Object.assign({}, f, { [k]: a }); });
    const num = (v) => (v === '' || v == null ? '' : v);
    const term = q.trim().toLowerCase();
    return (
      <div className="dc-modal" role="dialog" aria-modal="true" aria-label="Dose library" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="dc-modal-box dc-pop">
          <div className="dc-modal-h">
            <Svg d={IC.shield} s={18} /><b>Dose library</b>
            <span className="dc-sub">Edit, add, switch off and sign off the drugs every clinician calculates from</span>
            <button className="dc-x" onClick={onClose} aria-label="Close"><Svg d={IC.x} s={16} /></button>
          </div>
          <div className="dc-modal-tabs">
            {Object.keys(KIND_LABEL).map((k) => <button key={k} className={kind === k ? 'is-on' : ''} onClick={() => { setKind(k); setSel(null); }}>{KIND_LABEL[k]} <span className="dc-count">{lib[k].length}</span></button>)}
            <span className="dc-modal-stats"><span className="dc-chip is-green">{c.ok} reviewed</span><span className="dc-chip is-amber">{c.all - c.ok - c.stale} not reviewed</span>{c.stale ? <span className="dc-chip is-red">{c.stale} changed</span> : null}{c.off ? <span className="dc-chip">{c.off} off</span> : null}</span>
            <button style={MK.btnGhost} disabled={busy} onClick={publishOrder} title="Save the order you see now (your layout) as the hospital default"><Svg d={IC.move} s={13} /> Publish current order</button>
          </div>
          <div className="dc-modal-body">
            <div className="dc-lib-list">
              <div className="dc-search"><Svg d={IC.search} s={14} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" /></div>
              <button className="dc-lib-add" onClick={() => setSel('__new')}><Svg d={IC.plus} s={13} /> Add hospital drug</button>
              <div className="dc-lib-scroll">
                {list.filter((e) => !term || e.name.toLowerCase().indexOf(term) >= 0).map((e) => (
                  <button key={e.id} className={'dc-lib-row' + (sel === e.id ? ' is-on' : '') + (e.disabled ? ' is-off' : '')} onClick={() => setSel(e.id)}>
                    <i className={'dc-dot is-' + (e.reviewed.state === 'ok' ? 'green' : e.reviewed.state === 'stale' ? 'redring' : 'amber')} />
                    <span>{e.name}</span>{e.custom ? <em>hospital</em> : e.overridden ? <em>edited</em> : null}{e.disabled ? <em>off</em> : null}
                  </button>
                ))}
              </div>
            </div>
            <div className="dc-lib-edit">
              {!form ? <div className="dc-empty">Pick a drug to edit it or sign it off, or add a hospital drug.<br /><br />A built-in drug is a default from published references; the green tick appears only after someone here reviews it. Editing a reviewed drug turns it red — “Changed since review” — until it is reviewed again.</div> : (
                <>
                  {entry ? <div className="dc-chips" style={{ marginBottom: 10 }}><ReviewChip e={entry} />{entry.custom ? <span className="dc-chip">hospital-added</span> : <span className="dc-chip">built-in{entry.overridden ? ' · edited' : ''}</span>}{entry.disabled ? <span className="dc-chip is-red">switched off</span> : null}</div> : <div className="dc-chips" style={{ marginBottom: 10 }}><span className="dc-chip is-blue">New hospital drug — {KIND_LABEL[kind]}</span></div>}
                  <div className="dc-form">
                    <Field label="Name" wide><input className="inp" value={form.name || ''} onChange={(e) => upd('name', e.target.value)} /></Field>
                    <Field label="Group"><input className="inp" value={form.group || ''} onChange={(e) => upd('group', e.target.value)} list={'dc-groups-' + kind} />
                      <datalist id={'dc-groups-' + kind}>{Array.from(new Set(list.map((e) => e.group))).map((g) => <option key={g} value={g} />)}</datalist></Field>
                    {kind === 'infusion' ? <>
                      <Field label="Dose unit"><select className="inp" value={form.unit} onChange={(e) => upd('unit', e.target.value)}>{UNIT_CHOICES.map((x) => <option key={x}>{x}</option>)}</select></Field>
                      <Field label="Usual from"><NumIn value={num((form.soft || [])[0])} onChange={(v) => upd('soft', [v, (form.soft || [])[1]])} /></Field>
                      <Field label="Usual to"><NumIn value={num((form.soft || [])[1])} onChange={(v) => upd('soft', [(form.soft || [])[0], v])} /></Field>
                      <Field label="Hard limit"><NumIn value={num(form.hard)} onChange={(v) => upd('hard', v)} /></Field>
                      <Field label="Usual start"><NumIn value={num(form.start)} onChange={(v) => upd('start', v)} /></Field>
                      <Field label="Titration step"><NumIn value={num(form.step)} onChange={(v) => upd('step', v)} /></Field>
                      <Field label="Dose on"><select className="inp" value={form.weight || 'actual'} onChange={(e) => upd('weight', e.target.value)}><option value="actual">patient's chosen weight</option><option value="ideal">ideal weight (hint)</option><option value="none">not weight-based</option></select></Field>
                      <Field label="High-alert"><Seg small value={form.highAlert ? 'y' : 'n'} onChange={(v) => upd('highAlert', v === 'y')} options={[{ v: 'y', l: 'Yes' }, { v: 'n', l: 'No' }]} /></Field>
                      <Field label="Diluent"><input className="inp" value={form.diluent || ''} onChange={(e) => upd('diluent', e.target.value)} /></Field>
                    </> : null}
                    {kind === 'emergency' ? <>
                      <Field label="Dose per kg (or from)"><NumIn value={num(Array.isArray(form.dose) ? form.dose[0] : form.dose)} onChange={(v) => upd('dose', Array.isArray(form.dose) ? [v, form.dose[1]] : v)} /></Field>
                      <Field label="…to (range, optional)"><NumIn value={num(Array.isArray(form.dose) ? form.dose[1] : '')} onChange={(v) => upd('dose', v === '' ? (Array.isArray(form.dose) ? form.dose[0] : form.dose) : [Array.isArray(form.dose) ? form.dose[0] : form.dose, v])} /></Field>
                      <Field label="Unit"><select className="inp" value={form.unit} onChange={(e) => upd('unit', e.target.value)}>{['mg', 'mcg', 'g', 'mmol', 'units', 'mL'].map((x) => <option key={x}>{x}</option>)}</select></Field>
                      <Field label="Max single dose"><NumIn value={num(form.max)} onChange={(v) => upd('max', v)} /></Field>
                      <Field label="Min dose"><NumIn value={num(form.min)} onChange={(v) => upd('min', v)} /></Field>
                      <Field label="Adult dose"><NumIn value={num(form.adult)} onChange={(v) => upd('adult', v)} /></Field>
                      <Field label="Strength (unit per mL)"><NumIn value={num(form.perMl)} onChange={(v) => upd('perMl', v)} /></Field>
                      <Field label="Preparation"><input className="inp" value={form.prep || ''} onChange={(e) => upd('prep', e.target.value)} /></Field>
                      <Field label="Route"><input className="inp" value={form.route || ''} onChange={(e) => upd('route', e.target.value)} /></Field>
                    </> : null}
                    {kind === 'paed' ? <>
                      <Field label="Dose is"><Seg small value={form.mode} onChange={(v) => upd('mode', v)} options={[{ v: 'dose', l: 'mg/kg/dose' }, { v: 'day', l: 'mg/kg/day' }]} /></Field>
                      <Field label="mg/kg from"><NumIn value={num((form.dose || [])[0])} onChange={(v) => upd('dose', [v, (form.dose || [])[1]])} /></Field>
                      <Field label="mg/kg to"><NumIn value={num((form.dose || [])[1])} onChange={(v) => upd('dose', [(form.dose || [])[0], v])} /></Field>
                      <Field label="Doses per day"><NumIn value={num(form.perDay)} onChange={(v) => upd('perDay', v)} /></Field>
                      <Field label="Max mg/dose"><NumIn value={num(form.maxDose)} onChange={(v) => upd('maxDose', v)} /></Field>
                      <Field label="Max mg/day"><NumIn value={num(form.maxDay)} onChange={(v) => upd('maxDay', v)} /></Field>
                      <Field label="Max mg/kg/day"><NumIn value={num(form.maxDayPerKg)} onChange={(v) => upd('maxDayPerKg', v)} /></Field>
                    </> : null}
                  </div>
                  {kind === 'infusion' ? (
                    <div className="dc-sublist">
                      <div className="dc-label-row">Concentrations</div>
                      {(form.conc || []).map((cc, i) => (
                        <div key={i} className="dc-inline">
                          <input className="inp" style={{ width: 110 }} value={cc.label || ''} onChange={(e) => updArr('conc', i, 'label', e.target.value)} placeholder="label" />
                          <NumIn value={num(cc.amount)} onChange={(v) => updArr('conc', i, 'amount', v)} style={{ width: 80 }} placeholder="amount" />
                          <select className="inp" value={cc.unit} onChange={(e) => updArr('conc', i, 'unit', e.target.value)}>{AMOUNT_UNITS.map((x) => <option key={x}>{x}</option>)}</select>
                          <span className="dc-muted">in</span><NumIn value={num(cc.ml)} onChange={(v) => updArr('conc', i, 'ml', v)} style={{ width: 70 }} /><span className="dc-muted">mL</span>
                          <button className="dc-mv" onClick={() => upd('conc', form.conc.filter((_, j) => j !== i))} aria-label="Remove"><Svg d={IC.x} s={11} /></button>
                        </div>
                      ))}
                      <button className="dc-link" onClick={() => upd('conc', (form.conc || []).concat([{ label: '', amount: '', unit: 'mg', ml: 50 }]))}>+ Add concentration</button>
                      <div className="dc-label-row" style={{ marginTop: 8 }}>Stock ampoule / vial</div>
                      <div className="dc-inline">
                        <NumIn value={num((form.ampoule || {}).amount)} onChange={(v) => upd('ampoule', Object.assign({}, form.ampoule, { amount: v }))} style={{ width: 80 }} placeholder="amount" />
                        <select className="inp" value={(form.ampoule || {}).unit || 'mg'} onChange={(e) => upd('ampoule', Object.assign({}, form.ampoule, { unit: e.target.value }))}>{AMOUNT_UNITS.map((x) => <option key={x}>{x}</option>)}</select>
                        <span className="dc-muted">in</span><NumIn value={num((form.ampoule || {}).ml)} onChange={(v) => upd('ampoule', Object.assign({}, form.ampoule, { ml: v }))} style={{ width: 70 }} /><span className="dc-muted">mL</span>
                        <input className="inp" style={{ flex: 1, minWidth: 120 }} value={(form.ampoule || {}).label || ''} onChange={(e) => upd('ampoule', Object.assign({}, form.ampoule, { label: e.target.value }))} placeholder="label, e.g. 4 mg / 4 mL ampoule" />
                      </div>
                    </div>
                  ) : null}
                  {kind === 'paed' ? (
                    <div className="dc-sublist">
                      <div className="dc-label-row">Strengths</div>
                      {(form.strengths || []).map((st, i) => (
                        <div key={i} className="dc-inline">
                          <input className="inp" style={{ width: 180 }} value={st.label || ''} onChange={(e) => updArr('strengths', i, 'label', e.target.value)} placeholder="e.g. Suspension 125 mg/5 mL" />
                          <NumIn value={num(st.mg)} onChange={(v) => updArr('strengths', i, 'mg', v)} style={{ width: 70 }} /><span className="dc-muted">mg in</span>
                          {st.form ? <span className="dc-muted">1 {st.form}</span> : <><NumIn value={num(st.ml)} onChange={(v) => updArr('strengths', i, 'ml', v)} style={{ width: 60 }} /><span className="dc-muted">mL</span></>}
                          <button className="dc-mv" onClick={() => upd('strengths', form.strengths.filter((_, j) => j !== i))} aria-label="Remove"><Svg d={IC.x} s={11} /></button>
                        </div>
                      ))}
                      <button className="dc-link" onClick={() => upd('strengths', (form.strengths || []).concat([{ label: '', mg: '', ml: 5 }]))}>+ Add liquid strength</button>
                      <button className="dc-link" onClick={() => upd('strengths', (form.strengths || []).concat([{ label: '', mg: '', form: 'tab' }]))}>+ Add tablet</button>
                    </div>
                  ) : null}
                  <div className="dc-form" style={{ marginTop: 8 }}>
                    <Field label="Notes (shown under the result)" wide><textarea className="inp" rows={3} value={form.notes || ''} onChange={(e) => upd('notes', e.target.value)} /></Field>
                    <Field label="Source / protocol" wide><input className="inp" value={form.source || ''} onChange={(e) => upd('source', e.target.value)} /></Field>
                  </div>
                  <div className="dc-actions">
                    <button style={MK.btnPri} disabled={busy} onClick={save}><Svg d={IC.save} s={14} /> Save</button>
                    {entry ? <>
                      <button style={MK.btnTone('#1f9d57')} disabled={busy} onClick={() => review(false)} title="Sign off this exact content as checked against hospital protocol"><Svg d={IC.check} s={14} /> Mark reviewed</button>
                      {entry.reviewed.state !== 'none' ? <button style={MK.btnGhost} disabled={busy} onClick={() => review(true)}>Clear review</button> : null}
                      <button style={MK.btnGhost} disabled={busy} onClick={toggleOff}>{entry.disabled ? 'Switch on' : 'Switch off'}</button>
                      {entry.custom ? (confirmDel ? <button style={MK.btnTone('#d23a52')} disabled={busy} onClick={del}>Confirm delete</button> : <button style={MK.btnGhost} onClick={() => setConfirmDel(true)}>Delete…</button>) : null}
                    </> : null}
                  </div>
                  <div className="dc-fhint" style={{ marginTop: 8 }}>“Mark reviewed” signs off what is saved now. Save your edits first, then review.</div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ================= root ================= */
  function MedDoseCalc() {
    useEffect(() => { injectStyle(); }, []);
    const [overrides, setOverrides] = useState([]);
    const [offline, setOffline] = useState(false);
    const [prefs, setPrefs] = useState(() => readJson(localStorage, PREFS_KEY, {}));
    const [p, setP] = useState(() => Object.assign({ weight: '', height: '', age: '', sex: 'M', scr: '', scrUnit: 'umol', basis: 'actual', name: '', uhid: '' }, readJson(sessionStorage, PATIENT_KEY, {})));
    const [arrange, setArrange] = useState(false);
    const [libOpen, setLibOpen] = useState(false);
    const [restore, setRestore] = useState(null);
    const [showRecent, setShowRecent] = useState(false);
    const admin = isAdmin();

    const reload = useCallback(() => api.get('/api/med/dose-library').then((r) => {
      if (r && r.ok) { setOverrides(r.overrides || []); setOffline(!!r.offline); }
    }).catch(() => setOffline(true)), []);
    useEffect(() => { reload(); }, [reload]);
    useEffect(() => { writeJson(sessionStorage, PATIENT_KEY, p); }, [p]);

    const setPref = (patch) => setPrefs((cur) => { const n = Object.assign({}, cur, patch); writeJson(localStorage, PREFS_KEY, n); return n; });
    const lib = useMemo(() => D.mergeLibrary(LIB, overrides), [overrides]);
    const layoutDoc = overrides.find((o) => o.id === '_layout');
    const layout = (layoutDoc && layoutDoc.layout) || {};
    const dv = derive(p);
    const tabs = D.applyOrder(TABS, prefs.tabs || layout.tabs);
    const tab = tabs.some((t) => t.id === prefs.tab) ? prefs.tab : tabs[0].id;
    const tabRef = useRef(null);
    const [ink, setInk] = useState({ left: 0, width: 0 });
    useLayoutEffect(() => {
      const el = tabRef.current && tabRef.current.querySelector('[data-tab="' + tab + '"]');
      if (el) setInk({ left: el.offsetLeft, width: el.offsetWidth });
    }, [tab, tabs.map((t) => t.id).join(), arrange]);

    const all = lib.infusion.concat(lib.emergency, lib.paed);
    const reviewed = all.filter((e) => e.reviewed.state === 'ok').length;
    const stale = all.filter((e) => e.reviewed.state === 'stale').length;
    const pushRecent = (r) => { setPref({ recent: [Object.assign({ at: Date.now() }, r)].concat((prefs.recent || []).filter((x) => x.label !== r.label)).slice(0, 10) }); toast('Saved to recent calculations.'); };
    const ownLayout = !!(prefs.order || prefs.groups || prefs.tabs || prefs.calcs);
    const orderSnapshot = () => {
      const ord = (kind) => D.applyOrder(lib[kind], (prefs.order || {})[kind] || layout[kind]).map((e) => e.id);
      const grp = (kind) => {
        const gs = Array.from(new Set(D.applyOrder(lib[kind], (prefs.order || {})[kind] || layout[kind]).map((e) => e.group || 'Other')));
        return D.applyOrder(gs.map((g) => ({ id: g })), ((prefs.groups || {})[kind]) || (layout.groups || {})[kind]).map((g) => g.id);
      };
      return { infusion: ord('infusion'), emergency: ord('emergency'), paed: ord('paed'), groups: { infusion: grp('infusion'), emergency: grp('emergency'), paed: grp('paed') }, calcs: D.applyOrder(LIB.CALCS.map((id) => ({ id })), prefs.calcs || layout.calcs).map((x) => x.id), tabs: tabs.map((t) => t.id) };
    };

    const common = { lib, p, dv, prefs, layout, setPref, arrange, admin };
    return (
      <div className="dc-root" style={MK.page}>
        <div className="dc-hero">
          <div className="dc-hero-l">
            <div className="dc-hero-ic"><Svg d="M9 3h6M10 3v5l-5.5 9.5A2.5 2.5 0 0 0 6.7 21h10.6a2.5 2.5 0 0 0 2.2-3.5L14 8V3M7.5 15h9" s={22} sw={1.8} /></div>
            <div>
              <h2>Dose Calculator</h2>
              <p>ICU infusions, emergency drugs, paediatric doses and bedside formulas — from one patient's weight.</p>
            </div>
          </div>
          <div className="dc-hero-r">
            <span className={'dc-chip ' + (reviewed === all.length ? 'is-green' : 'is-amber')} title="Library entries signed off by this hospital"><Svg d={IC.shield} s={11} /> {reviewed}/{all.length} reviewed{stale ? ' · ' + stale + ' changed' : ''}</span>
            {offline ? <span className="dc-chip" title="No database — built-in list only; edits cannot be saved">built-in list (offline)</span> : null}
            <button className={'dc-tbtn' + (showRecent ? ' is-on' : '')} onClick={() => setShowRecent(!showRecent)} disabled={!(prefs.recent || []).length}><Svg d={IC.clock} s={14} /> Recent{(prefs.recent || []).length ? ' (' + prefs.recent.length + ')' : ''}</button>
            <button className={'dc-tbtn' + (arrange ? ' is-on' : '')} onClick={() => setArrange(!arrange)} title="Drag drugs, groups, tabs and calculator cards into your own order"><Svg d={IC.move} s={14} /> {arrange ? 'Done arranging' : 'Arrange'}</button>
            {admin ? <button className="dc-tbtn" onClick={() => setLibOpen(true)}><Svg d={IC.shield} s={14} /> Library</button> : null}
          </div>
        </div>

        {arrange ? (
          <div className="dc-arrange-bar dc-rise">
            <Svg d={IC.move} s={15} />
            <span><b>Arrange mode</b> — drag the ⠿ handle (or use ▲▼) on any drug, group, tab or calculator card. Your order is saved in this browser.</span>
            {ownLayout ? <button style={MK.btnGhost} onClick={() => setPref({ order: undefined, groups: undefined, tabs: undefined, calcs: undefined })}><Svg d={IC.reset} s={13} /> Reset to hospital order</button> : null}
            {admin ? <button style={MK.btnPri} disabled={offline} onClick={() => api.send('PUT', '/api/med/dose-library/_layout', { layout: orderSnapshot() }).then((r) => { if (r && r.ok) { toast('Published as the hospital order.'); reload(); } else toast((r && r.error) || 'Could not save.', 'error'); })}><Svg d={IC.save} s={13} /> Publish as hospital order</button> : null}
          </div>
        ) : null}

        {showRecent && (prefs.recent || []).length ? (
          <div className="dc-recent dc-rise">
            {(prefs.recent || []).map((r, i) => (
              <button key={i} className="dc-recent-chip" onClick={() => { if (r.weight) setP(Object.assign({}, p, { weight: String(r.weight) })); setPref({ tab: 'infusion' }); setRestore(Object.assign({}, r, { n: Date.now() })); setShowRecent(false); }}>
                <b>{r.label}</b><span>{r.weight ? r.weight + ' kg · ' : ''}{new Date(r.at).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
              </button>
            ))}
            <button className="dc-link" onClick={() => { setPref({ recent: [] }); setShowRecent(false); }}>Clear</button>
          </div>
        ) : null}

        <PatientBar p={p} set={setP} dv={dv} />

        <div className="dc-tabs-wrap" ref={tabRef}>
          <Sortable items={tabs} getKey={(t) => t.id} enabled={arrange} axis="x" className="dc-tabs"
            onMove={(a, b) => setPref({ tabs: D.moveItem(tabs.map((t) => t.id), a, b) })}
            render={(t, handle) => (
              <button data-tab={t.id} className={'dc-tab' + (tab === t.id ? ' is-on' : '')} onClick={() => { setRestore(null); setPref({ tab: t.id }); }}>
                {handle}<Svg d={t.icon} s={15} />{t.label}
              </button>
            )} />
          <span className="dc-ink" style={{ transform: 'translateX(' + ink.left + 'px)', width: ink.width }} />
        </div>

        <div className="dc-pane" key={tab}>
          {tab === 'infusion' ? <InfusionTab {...common} restore={restore} onRecent={pushRecent} /> : null}
          {tab === 'emergency' ? <EmergencyTab {...common} /> : null}
          {tab === 'paed' ? <PaedTab {...common} /> : null}
          {tab === 'calcs' ? <CalcsTab {...common} /> : null}
        </div>

        <div className="dc-disclaimer">
          <Svg d={IC.alert} s={14} />
          <span><b>Calculation aid, not a prescription.</b> Verify every dose against the written prescription and hospital protocol, and use an independent two-person check for high-alert drugs. Built-in library entries are defaults from published references until reviewed by this hospital.</span>
        </div>

        {libOpen ? <LibraryManager lib={lib} overrides={overrides} reload={reload} onClose={() => setLibOpen(false)} orderSnapshot={orderSnapshot} /> : null}
      </div>
    );
  }

  /* ================= styles ================= */
  function injectStyle() {
    if (document.getElementById('dose-calc-style')) return;
    const INK = MK.INK, MUTED = MK.MUTED, FAINT = MK.FAINT, LINE = MK.LINE, MONO = MK.MONO, BODY = MK.BODY;
    const css = `
.dc-root{--dc-blue:#0090ca;--dc-green:#1f9d57;--dc-amber:#e08a1e;--dc-red:#d23a52}
.dc-root *{box-sizing:border-box}
@keyframes dcRise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes dcPop{from{opacity:0;transform:scale(.97) translateY(8px)}to{opacity:1;transform:none}}
@keyframes dcDash{to{stroke-dashoffset:-24}}
@keyframes dcBlink{50%{opacity:.25}}
@keyframes dcDrop{0%{transform:translateY(0);opacity:0}12%{opacity:1}80%{opacity:1}100%{transform:translateY(30px);opacity:0}}
@keyframes dcSpin{to{transform:rotate(360deg)}}
@keyframes dcWave{0%{transform:translateX(0)}100%{transform:translateX(-25px)}}
@keyframes dcPulse{0%,100%{box-shadow:0 0 0 0 rgba(210,58,82,.35)}50%{box-shadow:0 0 0 7px rgba(210,58,82,0)}}
@keyframes dcPulseA{0%,100%{box-shadow:0 0 0 0 rgba(224,138,30,.35)}50%{box-shadow:0 0 0 7px rgba(224,138,30,0)}}
@keyframes dcShine{from{background-position:-200% 0}to{background-position:200% 0}}
.dc-rise{animation:dcRise .38s cubic-bezier(.2,.8,.2,1) both}
.dc-pop{animation:dcPop .28s cubic-bezier(.2,.8,.2,1) both}
.dc-pane>*{animation:dcRise .32s cubic-bezier(.2,.8,.2,1) both}
.dc-flow{animation:dcDash linear infinite}
.dc-blink{animation:dcBlink 1.6s ease-in-out infinite}
.dc-blink-fast{animation:dcBlink .7s steps(2,start) infinite}
.dc-drop{animation:dcDrop ease-in infinite}
.dc-spin{animation:dcSpin linear infinite;transform-box:view-box}
.dc-wave{animation:dcWave 1.4s linear infinite}

.dc-hero{position:relative;overflow:hidden;display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;padding:18px 22px;margin-bottom:12px;border-radius:18px;color:#fff;
  background:radial-gradient(1200px 200px at 0% 0%,rgba(255,255,255,.18),transparent 60%),linear-gradient(120deg,#0b5f8a 0%,#0090ca 48%,#28b6a3 100%);box-shadow:0 18px 40px rgba(0,110,160,.28)}
.dc-hero:after{content:"";position:absolute;inset:0;background:linear-gradient(100deg,transparent 30%,rgba(255,255,255,.14) 50%,transparent 70%);background-size:200% 100%;animation:dcShine 6s ease-in-out infinite;pointer-events:none}
.dc-hero-l{display:flex;gap:14px;align-items:center;min-width:0}
.dc-hero-ic{width:46px;height:46px;border-radius:14px;display:grid;place-items:center;background:rgba(255,255,255,.18);box-shadow:inset 0 1px 0 rgba(255,255,255,.35)}
.dc-hero h2{margin:0;font-size:20px;font-weight:800;letter-spacing:.2px}
.dc-hero p{margin:3px 0 0;font-size:12.5px;opacity:.88}
.dc-hero-r{display:flex;gap:8px;flex-wrap:wrap;align-items:center;position:relative;z-index:1}
.dc-hero .dc-chip.dc-chip{background:rgba(255,255,255,.2);color:#fff;border-color:rgba(255,255,255,.35)}
.dc-hero .dc-chip.is-amber{background:#ffe2ad;color:#7a4a08}
.dc-hero .dc-chip.is-green{background:#c9f2da;color:#0f5c36}
.dc-tbtn{display:inline-flex;align-items:center;gap:6px;border:1px solid rgba(255,255,255,.4);background:rgba(255,255,255,.14);color:#fff;font:inherit;font-size:12px;font-weight:700;padding:7px 12px;border-radius:10px;cursor:pointer;transition:background .15s,transform .15s}
.dc-tbtn:hover:not(:disabled){background:rgba(255,255,255,.26);transform:translateY(-1px)}
.dc-tbtn.is-on{background:#fff;color:#0072a3}
.dc-tbtn:disabled{opacity:.5;cursor:default}

.dc-card{background:linear-gradient(152deg,rgba(255,255,255,.82),rgba(236,247,255,.55));backdrop-filter:blur(22px) saturate(1.6);-webkit-backdrop-filter:blur(22px) saturate(1.6);border:1px solid rgba(255,255,255,.92);border-radius:16px;box-shadow:0 12px 36px rgba(31,59,90,.12),0 3px 12px rgba(0,144,202,.07),inset 0 1px 0 #fff;position:relative}
.dc-card-h{display:flex;align-items:center;gap:9px;padding:12px 16px;border-bottom:1px solid ${LINE};font-size:13.5px;color:${INK};flex-wrap:wrap}
.dc-card-b{padding:14px 16px}
.dc-sub{font-size:11.5px;color:${MUTED};font-weight:500}
.dc-muted{color:${MUTED};font-size:12px}
.dc-empty{padding:34px 20px;text-align:center;color:${MUTED};font-size:13px;line-height:1.6}
.dc-count{font-family:${MONO};font-size:10.5px;font-weight:700;color:${MUTED};background:rgba(125,145,180,.14);padding:1px 7px;border-radius:10px;margin-left:6px}

.dc-chip{display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:12px;color:#5b6b80;background:rgba(125,145,180,.14);border:1px solid transparent;white-space:nowrap}
.dc-chip.is-mono{font-family:${MONO}}
.dc-chip.is-green{color:#16794a;background:rgba(31,157,87,.13)}
.dc-chip.is-amber{color:#a5620a;background:rgba(224,138,30,.15)}
.dc-chip.is-red{color:#b4233c;background:rgba(210,58,82,.12)}
.dc-chip.is-blue{color:#0072a3;background:rgba(0,144,202,.12)}
.dc-chip.is-red-solid{color:#fff;background:#c8102e;letter-spacing:.6px;font-size:9.5px}
.dc-chips{display:flex;gap:5px;flex-wrap:wrap;margin-top:5px}

.dc-patient{padding:12px 16px;margin-bottom:12px}
.dc-pt-row{display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap}
.dc-pt-row.is-sub{margin-top:10px;padding-top:10px;border-top:1px dashed ${LINE}}
.dc-pt-title{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:800;color:${INK};text-transform:uppercase;letter-spacing:.6px;align-self:center;margin-right:4px}
.dc-pt-dot{width:9px;height:9px;border-radius:50%;background:linear-gradient(135deg,#27a8db,#28b6a3);box-shadow:0 0 0 4px rgba(39,168,219,.15)}
.dc-field{display:flex;flex-direction:column;gap:4px;min-width:0}
.dc-field.is-wide{flex:1;min-width:200px}
.dc-flabel{font-size:10.5px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:.4px}
.dc-fhint{font-size:10.5px;color:${FAINT};line-height:1.5}
.dc-root .inp{font-family:inherit;font-size:12.5px;color:${INK};padding:7px 9px;border-radius:9px;border:1px solid rgba(125,145,180,.32);background:rgba(255,255,255,.85);transition:border-color .15s,box-shadow .15s;min-width:0}
.dc-root .inp:focus{outline:0;border-color:#27a8db;box-shadow:0 0 0 3px rgba(39,168,219,.18)}
.dc-num{width:96px}
.dc-inline{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.dc-seg{display:inline-flex;padding:2px;border-radius:10px;background:rgba(125,145,180,.14);gap:2px}
.dc-seg button{border:0;background:transparent;font:inherit;font-size:12px;font-weight:600;color:${BODY};padding:6px 11px;border-radius:8px;cursor:pointer;transition:all .18s}
.dc-seg.is-small button{font-size:11px;padding:5px 9px}
.dc-seg button.is-on{background:#fff;color:#0072a3;box-shadow:0 2px 8px rgba(31,59,90,.14)}
.dc-link{border:0;background:none;color:#0072a3;font:inherit;font-size:11.5px;font-weight:700;cursor:pointer;padding:4px 2px}
.dc-link:hover{text-decoration:underline}
.dc-derived{display:flex;gap:6px;flex-wrap:wrap;margin-top:11px}
.dc-pill{font-size:11.5px;color:${BODY};background:rgba(255,255,255,.7);border:1px solid rgba(125,145,180,.22);padding:4px 10px;border-radius:20px;font-family:${MONO};display:inline-flex;gap:5px;align-items:center}
.dc-pill b{font-family:inherit;color:${MUTED};font-size:10px;letter-spacing:.4px}
.dc-pill.is-blue{color:#0072a3;background:rgba(0,144,202,.1)}
.dc-pill.is-violet{color:#6a52d4;background:rgba(106,82,212,.1)}
.dc-pill.is-red{color:#b4233c;background:rgba(210,58,82,.1);animation:dcPulse 1.6s infinite}
.dc-pill.is-action{cursor:pointer;color:#fff;background:linear-gradient(135deg,#27a8db,#0072a3);border:0;font-family:inherit;font-weight:700}

.dc-tabs-wrap{position:relative;margin-bottom:12px;background:rgba(255,255,255,.55);border:1px solid rgba(255,255,255,.9);border-radius:14px;padding:4px;box-shadow:0 6px 20px rgba(31,59,90,.08);overflow-x:auto}
.dc-tabs{display:flex;gap:2px;position:relative;z-index:1}
.dc-tab{display:inline-flex;align-items:center;gap:7px;border:0;background:transparent;font:inherit;font-size:13px;font-weight:700;color:${MUTED};padding:9px 15px;border-radius:10px;cursor:pointer;white-space:nowrap;transition:color .2s}
.dc-tab:hover{color:${INK}}
.dc-tab.is-on{color:#0072a3}
.dc-ink{position:absolute;top:4px;bottom:4px;left:4px;border-radius:10px;background:#fff;box-shadow:0 4px 14px rgba(0,114,163,.18);transition:transform .32s cubic-bezier(.3,1.3,.5,1),width .32s cubic-bezier(.3,1.3,.5,1);z-index:0}
.dc-tabs .dc-sort-item{display:flex}

.dc-inf{display:grid;grid-template-columns:260px minmax(0,1.15fr) minmax(0,1fr);gap:12px;align-items:start}
.dc-inf.is-two{grid-template-columns:260px minmax(0,1fr)}
.dc-col{display:flex;flex-direction:column;gap:12px;min-width:0}
@media (max-width:1380px){.dc-inf{grid-template-columns:250px minmax(0,1fr)}.dc-pump-col{grid-column:2}}
@media (max-width:860px){.dc-inf,.dc-inf.is-two{grid-template-columns:minmax(0,1fr)}.dc-pump-col{grid-column:auto}.dc-picker .dc-picker-scroll{max-height:260px}}

.dc-picker{position:sticky;top:8px}
.dc-picker .dc-card-h b{flex:1}
.dc-search{display:flex;align-items:center;gap:7px;margin:10px 12px 6px;padding:7px 10px;border-radius:10px;background:rgba(255,255,255,.8);border:1px solid rgba(125,145,180,.25);color:${MUTED}}
.dc-search:focus-within{border-color:#27a8db;box-shadow:0 0 0 3px rgba(39,168,219,.15)}
.dc-search input{border:0;outline:0;background:transparent;font:inherit;font-size:12.5px;color:${INK};flex:1;min-width:0}
.dc-search button{border:0;background:none;cursor:pointer;color:${MUTED};display:flex}
.dc-search.is-inline{margin:0;min-width:160px}
.dc-picker-scroll{max-height:calc(100vh - 290px);min-height:240px;overflow-y:auto;padding:0 6px 8px}
.dc-group{margin-top:6px}
.dc-group-h{display:flex;align-items:center;gap:4px;font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:${MUTED};padding:4px 6px}
.dc-group-h.is-fav{color:#b5850a}
.dc-group-t{display:flex;align-items:center;gap:6px;flex:1;border:0;background:none;font:inherit;font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:${MUTED};cursor:pointer;padding:3px 0;text-align:left}
.dc-gdot{width:8px;height:8px;border-radius:3px;background:var(--g);flex-shrink:0}
.dc-chev{margin-left:auto;display:flex;transition:transform .2s;transform:rotate(-90deg)}
.dc-chev.is-open{transform:none}
.dc-drug{position:relative;display:flex;align-items:center;gap:6px;padding:8px 8px 8px 12px;border-radius:10px;cursor:pointer;font-size:12.5px;color:${BODY};transition:background .15s,transform .15s}
.dc-drug:hover{background:rgba(0,144,202,.07)}
.dc-drug:focus-visible{outline:2px solid #27a8db;outline-offset:-2px}
.dc-drug.is-on{background:#fff;color:${INK};font-weight:700;box-shadow:0 4px 14px rgba(31,59,90,.1)}
.dc-drug-bar{position:absolute;left:3px;top:8px;bottom:8px;width:3px;border-radius:3px;background:var(--g);opacity:.35;transition:opacity .2s}
.dc-drug.is-on .dc-drug-bar{opacity:1}
.dc-drug-name{flex:1;min-width:0;line-height:1.35}
.dc-drug-name em{font-style:normal;font-size:10px;color:#0072a3}
.dc-drug-meta{display:flex;align-items:center;gap:4px}
.dc-dot{width:7px;height:7px;border-radius:50%;display:inline-block}
.dc-dot.is-red{background:#d23a52}.dc-dot.is-green{background:#1f9d57}.dc-dot.is-amber{background:#e8a33a}.dc-dot.is-redring{background:#fff;box-shadow:inset 0 0 0 2px #d23a52}
.dc-star{border:0;background:none;padding:2px;cursor:pointer;color:rgba(125,145,180,.5);display:flex;transition:color .15s,transform .2s}
.dc-star:hover{color:#e0a400;transform:scale(1.15)}
.dc-star.is-on{color:#e0a400}
.dc-star.is-on svg{fill:#f5c542}

.dc-sort-item{transition:box-shadow .2s;border-radius:10px}
.dc-sort-item.is-dragging{position:relative;z-index:5;box-shadow:0 14px 34px rgba(31,59,90,.25);background:#fff;opacity:.96}
.dc-handle{display:inline-flex;align-items:center;gap:1px;margin-right:4px}
.dc-grip{border:0;background:rgba(0,144,202,.1);color:#0072a3;border-radius:6px;padding:3px 2px;cursor:grab;display:flex;touch-action:none}
.dc-grip:active{cursor:grabbing}
.dc-mv{border:0;background:rgba(125,145,180,.12);color:${BODY};border-radius:5px;width:20px;height:20px;cursor:pointer;display:inline-grid;place-items:center}
.dc-mv:disabled{opacity:.3;cursor:default}
.dc-arrange-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 14px;margin-bottom:12px;border-radius:12px;background:rgba(0,144,202,.08);border:1px dashed rgba(0,144,202,.45);font-size:12.5px;color:#0b5f8a}
.dc-arrange-bar span{flex:1;min-width:220px}

.dc-drug-head{display:flex;gap:12px;align-items:center;padding:14px 16px;border-bottom:1px solid ${LINE};background:linear-gradient(90deg,color-mix(in srgb,var(--g) 9%,transparent),transparent 70%);border-radius:16px 16px 0 0}
.dc-drug-swatch{width:12px;align-self:stretch;border-radius:6px;background:linear-gradient(180deg,var(--g),color-mix(in srgb,var(--g) 55%,#fff))}
.dc-drug-title{font-size:17px;font-weight:800;color:${INK};letter-spacing:.1px}
.dc-label-row{font-size:10.5px;font-weight:800;color:${MUTED};text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px}
.dc-conc{display:flex;gap:7px;flex-wrap:wrap}
.dc-conc-chip{display:flex;flex-direction:column;align-items:flex-start;gap:1px;border:1px solid rgba(125,145,180,.28);background:rgba(255,255,255,.75);border-radius:11px;padding:7px 11px;cursor:pointer;font:inherit;text-align:left;transition:all .18s}
.dc-conc-chip b{font-size:12.5px;color:${INK};font-family:${MONO}}
.dc-conc-chip span{font-size:10.5px;color:${MUTED}}
.dc-conc-chip:hover{border-color:#27a8db;transform:translateY(-1px)}
.dc-conc-chip.is-on{border-color:transparent;background:linear-gradient(135deg,#27a8db,#0072a3);box-shadow:0 6px 16px rgba(0,144,202,.3)}
.dc-conc-chip.is-on b,.dc-conc-chip.is-on span{color:#fff}

.dc-io{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px;margin-top:14px}
@media (max-width:560px){.dc-io{grid-template-columns:minmax(0,1fr)}}
.dc-big-in{display:flex;align-items:center;gap:6px}
.dc-big-num{flex:1;min-width:0;font-family:${MONO};font-size:26px;font-weight:700;color:${INK};text-align:center;padding:8px 6px;border-radius:12px;border:1px solid rgba(125,145,180,.3);background:#fff;transition:border-color .15s,box-shadow .15s}
.dc-big-num:focus{outline:0;border-color:#27a8db;box-shadow:0 0 0 4px rgba(39,168,219,.16)}
.dc-step-big{width:42px;height:48px;border-radius:12px;border:1px solid rgba(125,145,180,.3);background:rgba(255,255,255,.85);font-size:22px;font-weight:700;color:#0072a3;cursor:pointer;transition:all .15s}
.dc-step-big:hover{background:#0090ca;color:#fff;border-color:#0090ca}
.dc-step-big:active{transform:scale(.94)}
.dc-range{width:100%;margin:12px 0 4px;accent-color:var(--g,#0090ca);cursor:pointer}
.dc-result{border-radius:14px;padding:14px 16px;background:rgba(0,144,202,.06);border:1px solid rgba(0,144,202,.18);transition:background .3s,border-color .3s;min-height:122px;display:flex;flex-direction:column;justify-content:center}
.dc-result.is-ok{background:linear-gradient(140deg,rgba(31,157,87,.1),rgba(31,157,87,.03));border-color:rgba(31,157,87,.3)}
.dc-result.is-low,.dc-result.is-high{background:linear-gradient(140deg,rgba(224,138,30,.12),rgba(224,138,30,.03));border-color:rgba(224,138,30,.4);animation:dcPulseA 2s infinite}
.dc-result.is-hard{background:linear-gradient(140deg,rgba(210,58,82,.14),rgba(210,58,82,.04));border-color:rgba(210,58,82,.5);animation:dcPulse 1.2s infinite}
.dc-result-k{font-size:11px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:.5px}
.dc-result-v{font-family:${MONO};font-size:34px;font-weight:800;color:${INK};line-height:1.15;margin:2px 0}
.dc-result-v small{font-size:14px;color:${MUTED};font-weight:600}
.dc-result.is-hard .dc-result-v{color:#c8102e}
.dc-result-s{font-size:11.5px;color:${BODY};line-height:1.5}
.dc-need{display:flex;gap:8px;align-items:center;font-size:13px;color:#a5620a;font-weight:600}
.dc-banner{display:flex;gap:7px;align-items:flex-start;font-size:12px;line-height:1.5;padding:8px 11px;border-radius:10px;margin-top:8px}
.dc-banner.is-red{background:rgba(210,58,82,.1);color:#9f1d33;font-weight:700}
.dc-banner.is-amber{background:rgba(224,138,30,.12);color:#8a5208}
.dc-banner.is-blue{background:rgba(0,144,202,.08);color:#0b5f8a}

.dc-two{display:grid;grid-template-columns:minmax(0,240px) minmax(0,1fr);gap:14px;align-items:center}
@media (max-width:640px){.dc-two{grid-template-columns:minmax(0,1fr)}}
.dc-gauge{text-align:center}
.dc-gauge-cap{font-size:12px;font-weight:800;margin-top:-4px}
.dc-gauge-cap span{display:block;font-weight:500;font-size:10.5px;color:${FAINT};font-family:${MONO};margin-top:2px}
.dc-gauge-cap.is-ok{color:#16794a}.dc-gauge-cap.is-low,.dc-gauge-cap.is-high{color:#a5620a}.dc-gauge-cap.is-hard{color:#c8102e}.dc-gauge-cap.is-none{color:${MUTED}}
.dc-facts{display:flex;flex-direction:column;gap:7px}
.dc-fact{display:flex;flex-direction:column;gap:2px;padding:8px 11px;border-radius:10px;background:rgba(255,255,255,.65);border:1px solid rgba(125,145,180,.16)}
.dc-fact span{display:flex;align-items:center;gap:5px;font-size:10.5px;color:${MUTED};font-weight:700;text-transform:uppercase;letter-spacing:.4px}
.dc-fact b{font-size:12.5px;color:${INK};font-weight:600;line-height:1.45}
.dc-note{margin-top:12px;font-size:12px;line-height:1.55;color:${BODY};padding:9px 12px;border-left:3px solid var(--g,#27a8db);background:rgba(255,255,255,.6);border-radius:0 10px 10px 0}
.dc-src{font-size:10.5px;color:${FAINT};margin-top:7px}
.dc-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:13px}
.dc-actions button:disabled{opacity:.45;cursor:not-allowed;box-shadow:none}

.dc-ttable{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px;padding:12px}
.dc-trow{display:flex;justify-content:space-between;align-items:baseline;gap:8px;padding:8px 10px;border-radius:9px;border:1px solid rgba(125,145,180,.18);background:rgba(255,255,255,.7);font:inherit;font-family:${MONO};font-size:12px;color:${BODY};cursor:pointer;transition:all .15s}
.dc-trow i{font-style:normal;font-size:9.5px;color:${FAINT}}
.dc-trow b{color:${INK}}
.dc-trow:hover{transform:translateY(-1px);border-color:#27a8db}
.dc-trow.is-low{opacity:.7}
.dc-trow.is-high{background:rgba(224,138,30,.08);border-color:rgba(224,138,30,.3)}
.dc-trow.is-hard{background:rgba(210,58,82,.08)}
.dc-trow.is-cur{background:linear-gradient(135deg,#27a8db,#0072a3);border-color:transparent;color:#fff;box-shadow:0 6px 14px rgba(0,144,202,.3)}
.dc-trow.is-cur b,.dc-trow.is-cur i{color:#fff}

.dc-pump{position:relative}
.dc-pump-svg{width:100%;height:auto;display:block}
.dc-pump.is-alarm-red .dc-pump-svg{filter:drop-shadow(0 0 10px rgba(255,77,100,.35))}
.dc-pump-foot{font-size:11.5px;color:${BODY};margin:4px 2px 8px}
.dc-pump-foot i{color:${FAINT};font-style:normal}
.dc-pump-ctl{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;padding:10px 12px;border-radius:14px;background:rgba(255,255,255,.6);border:1px solid rgba(125,145,180,.18)}
.dc-pump-btns{display:flex;gap:6px;flex-wrap:wrap}
.dc-pbtn{display:inline-flex;align-items:center;gap:5px;border:1px solid rgba(125,145,180,.3);background:#fff;font:inherit;font-size:12px;font-weight:700;color:${BODY};padding:8px 12px;border-radius:10px;cursor:pointer;transition:all .15s}
.dc-pbtn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 4px 12px rgba(31,59,90,.12)}
.dc-pbtn:disabled{opacity:.4;cursor:not-allowed}
.dc-pbtn.is-run{background:linear-gradient(135deg,#25c06b,#169652);color:#fff;border-color:transparent}
.dc-pbtn.is-pause{background:linear-gradient(135deg,#ffb84d,#e08a1e);color:#fff;border-color:transparent}
.dc-pump-rate{display:flex;align-items:center;gap:4px}
.dc-step{width:30px;height:30px;border-radius:9px;border:1px solid rgba(125,145,180,.3);background:#fff;color:#0072a3;font-size:11px;cursor:pointer}
.dc-step:active{transform:scale(.92)}
.dc-knob{cursor:ns-resize;border-radius:50%;touch-action:none;display:flex;outline:0}
.dc-knob:focus-visible{box-shadow:0 0 0 3px rgba(39,168,219,.4)}
.dc-knob.is-off{opacity:.5;cursor:not-allowed}
.dc-pump-opts{display:flex;flex-direction:column;gap:5px;font-size:11px;color:${MUTED}}
.dc-pump-opts label{display:flex;align-items:center;gap:6px}
.dc-pump-opts select{font:inherit;font-size:11px;padding:3px 5px;border-radius:7px;border:1px solid rgba(125,145,180,.3);background:#fff}
.dc-check input{accent-color:#0090ca}

.dc-em-top{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.dc-stat{padding:12px 14px;border-radius:14px;background:linear-gradient(152deg,rgba(255,255,255,.85),rgba(236,247,255,.55));border:1px solid #fff;box-shadow:0 8px 22px rgba(31,59,90,.1);animation:dcRise .4s both}
.dc-stat span{display:block;font-size:10.5px;font-weight:800;color:${MUTED};text-transform:uppercase;letter-spacing:.4px}
.dc-stat b{display:block;font-family:${MONO};font-size:22px;color:${INK};margin:3px 0 1px}
.dc-stat i{font-style:normal;font-size:10.5px;color:${FAINT}}
.dc-stat.is-big{background:linear-gradient(135deg,#0b5f8a,#0090ca);color:#fff}
.dc-stat.is-big span,.dc-stat.is-big i,.dc-stat.is-big b{color:#fff}
.dc-stat.is-red b{color:#c8102e}
.dc-em-group{border-top:1px solid ${LINE}}
.dc-em-gh{display:flex;align-items:center;gap:7px;padding:9px 16px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:${INK};background:linear-gradient(90deg,color-mix(in srgb,var(--g) 10%,transparent),transparent 60%)}
.dc-em-row{display:grid;grid-template-columns:auto minmax(170px,1.3fr) minmax(110px,.8fr) minmax(110px,.9fr) minmax(80px,.6fr) minmax(160px,1.4fr);gap:10px;align-items:center;padding:9px 16px;border-top:1px solid rgba(125,145,180,.1);font-size:12px;transition:background .15s}
.dc-em-row:hover{background:rgba(0,144,202,.04)}
.dc-em-name b{display:block;color:${INK};font-size:12.5px}
.dc-em-name span,.dc-em-ml span{display:block;font-size:10.5px;color:${FAINT};font-family:${MONO}}
.dc-em-dose{display:flex;gap:5px;align-items:center;flex-wrap:wrap}
.dc-em-dose b{font-family:${MONO};font-size:15px;color:${INK}}
.dc-em-ml{font-family:${MONO};font-weight:700;color:#0072a3;font-size:13px}
.dc-em-ml span{font-family:inherit;font-weight:500}
.dc-em-route{color:${BODY};font-size:11.5px}
.dc-em-note{color:${MUTED};font-size:11px;line-height:1.45;display:flex;flex-direction:column;gap:4px;align-items:flex-start}
@media (max-width:980px){.dc-em-row{grid-template-columns:auto minmax(0,1fr) minmax(0,1fr)}.dc-em-route,.dc-em-note{grid-column:2 / -1}}
.dc-em-elec{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px}
.dc-em-elec i{font-style:normal;font-size:10.5px}

.dc-oral-wrap{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-top:14px;padding:10px 14px;border-radius:12px;background:rgba(255,255,255,.6);border:1px solid rgba(125,145,180,.16);font-size:12.5px;color:${BODY}}
.dc-oral{flex-shrink:0}

.dc-calcs{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:12px;align-items:start}
.dc-calcs>.dc-sort-item{min-width:0}
.dc-calc .dc-card-h b{flex:1}
.dc-form{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px}
.dc-outs{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin-bottom:8px}
.dc-out{padding:9px 11px;border-radius:11px;background:rgba(255,255,255,.7);border:1px solid rgba(125,145,180,.16)}
.dc-out span{display:block;font-size:10.5px;color:${MUTED};font-weight:700}
.dc-out b{display:block;font-family:${MONO};font-size:17px;color:${INK};margin-top:2px}
.dc-out b small{font-size:10.5px;color:${MUTED};font-weight:600}
.dc-out i{display:block;font-style:normal;font-size:10px;color:${FAINT};margin-top:2px}
.dc-out.is-strong{background:linear-gradient(135deg,rgba(39,168,219,.14),rgba(40,182,163,.08));border-color:rgba(0,144,202,.25)}
.dc-out.is-strong b{font-size:21px;color:#0b5f8a}

.dc-mono{font-size:12.5px;line-height:1.65;color:${BODY};max-height:380px;overflow-y:auto}
.dc-recent{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:12px;align-items:center}
.dc-recent-chip{display:flex;flex-direction:column;align-items:flex-start;gap:1px;border:1px solid rgba(125,145,180,.25);background:rgba(255,255,255,.85);border-radius:11px;padding:7px 11px;cursor:pointer;font:inherit;text-align:left;transition:all .15s}
.dc-recent-chip:hover{border-color:#27a8db;transform:translateY(-1px)}
.dc-recent-chip b{font-size:12px;color:${INK}}
.dc-recent-chip span{font-size:10.5px;color:${FAINT}}
.dc-disclaimer{display:flex;gap:9px;align-items:flex-start;margin-top:14px;padding:11px 14px;border-radius:12px;background:rgba(224,138,30,.08);border:1px solid rgba(224,138,30,.22);font-size:11.5px;line-height:1.55;color:#7a4a08}

.dc-modal{position:fixed;inset:0;z-index:1000;background:rgba(15,30,45,.42);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:18px;animation:dcRise .2s both}
.dc-modal-box{width:min(1100px,100%);max-height:calc(100vh - 36px);display:flex;flex-direction:column;background:#f7fbfe;border-radius:18px;box-shadow:0 30px 80px rgba(10,30,50,.35);overflow:hidden}
.dc-modal-h{display:flex;align-items:center;gap:9px;padding:14px 18px;border-bottom:1px solid ${LINE};color:${INK};font-size:15px;flex-wrap:wrap}
.dc-x{margin-left:auto;border:0;background:rgba(125,145,180,.14);border-radius:9px;width:32px;height:32px;cursor:pointer;display:grid;place-items:center;color:${BODY}}
.dc-modal-tabs{display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding:10px 18px;border-bottom:1px solid ${LINE}}
.dc-modal-tabs>button:not([style]){border:0;background:transparent;font:inherit;font-size:12.5px;font-weight:700;color:${MUTED};padding:7px 12px;border-radius:9px;cursor:pointer}
.dc-modal-tabs>button.is-on{background:#fff;color:#0072a3;box-shadow:0 3px 10px rgba(31,59,90,.1)}
.dc-modal-stats{display:flex;gap:5px;margin-left:auto;flex-wrap:wrap}
.dc-modal-body{display:grid;grid-template-columns:280px minmax(0,1fr);min-height:0;flex:1}
@media (max-width:760px){.dc-modal-body{grid-template-columns:minmax(0,1fr)}.dc-lib-list{max-height:220px}}
.dc-lib-list{border-right:1px solid ${LINE};display:flex;flex-direction:column;min-height:0}
.dc-lib-add{margin:0 12px 6px;border:1px dashed rgba(0,144,202,.5);background:rgba(0,144,202,.05);color:#0072a3;font:inherit;font-size:12px;font-weight:700;padding:7px;border-radius:9px;cursor:pointer;display:flex;gap:5px;justify-content:center;align-items:center}
.dc-lib-scroll{overflow-y:auto;padding:0 6px 10px;flex:1}
.dc-lib-row{display:flex;align-items:center;gap:7px;width:100%;border:0;background:transparent;font:inherit;font-size:12px;color:${BODY};padding:7px 9px;border-radius:8px;cursor:pointer;text-align:left}
.dc-lib-row span{flex:1}
.dc-lib-row em{font-style:normal;font-size:9.5px;color:#0072a3;background:rgba(0,144,202,.1);padding:1px 6px;border-radius:8px}
.dc-lib-row:hover{background:rgba(0,144,202,.07)}
.dc-lib-row.is-on{background:#fff;box-shadow:0 3px 10px rgba(31,59,90,.1);font-weight:700;color:${INK}}
.dc-lib-row.is-off span{text-decoration:line-through;opacity:.6}
.dc-lib-edit{padding:16px 18px;overflow-y:auto;min-height:0}
.dc-sublist{display:flex;flex-direction:column;gap:6px;margin-top:6px;padding:10px 12px;border-radius:11px;background:rgba(255,255,255,.7);border:1px solid rgba(125,145,180,.16)}

@media (prefers-reduced-motion: reduce){.dc-root *,.dc-root *:before,.dc-root *:after,.dc-modal *{animation:none!important;transition:none!important}}
@media (max-width:520px){.dc-hero{padding:14px 16px}.dc-hero h2{font-size:17px}.dc-result-v{font-size:28px}.dc-calcs{grid-template-columns:minmax(0,1fr)}}
`;
    const el = document.createElement('style');
    el.id = 'dose-calc-style';
    el.textContent = css;
    document.head.appendChild(el);
  }

  window.MedDoseCalc = MedDoseCalc;
})();
