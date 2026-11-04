/* UNICO — the two animated pumps in the Dose Calculator (window.DosePumps).

   SyringePump   50 mL-style syringe driver: the plunger and pusher block move at the
                 real mL/h, the barrel drains, the line flows, the LCD counts volume
                 infused and the time the syringe runs out.
   InfusionPump  volumetric pump with a bag, a drip chamber dropping at the real
                 drops/min and peristaltic rollers turning in proportion to the rate.

   Both are SIMULATIONS for teaching / checking a set-up — they never talk to a device.
   They take the calculated rate and report knob / ▲▼ changes back (onRate) so the dose
   fields and the pump always agree. Over the hard limit the pump locks (cannot start).

   Motion: requestAnimationFrame while running, paused when the tab is hidden; with
   prefers-reduced-motion the CSS motion is off and the counters tick once a second.
   Time-lapse (×1 / ×60 / ×600) only speeds the simulation, never the displayed rate. */
(function () {
  const { useState, useEffect, useRef, useCallback } = React;
  const D = () => window.UNICO_DOSE;

  const reduceMotion = () => { try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const fmtH = (h) => {
    if (h == null || !Number.isFinite(h)) return '—';
    if (h > 99) return '> 99 h';
    const m = Math.round(h * 60);
    return Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2, '0') + 'm';
  };
  const clockAt = (h) => {
    if (h == null || !Number.isFinite(h) || h > 72) return '';
    const d = new Date(Date.now() + h * 3600e3);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + (d.getDate() !== new Date().getDate() ? ' (tomorrow)' : '');
  };
  const f1 = (n) => (n == null || !Number.isFinite(n) ? '—' : (Math.round(n * 10) / 10).toFixed(n < 10 ? 1 : n < 100 ? 1 : 0));

  // One shared alarm beeper (WebAudio). Off unless the user switches it on.
  let audioCtx = null;
  function beep() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = 'square'; o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.08, audioCtx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.18);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(); o.stop(audioCtx.currentTime + 0.2);
    } catch (e) {}
  }

  // The simulation clock shared by both pumps: infused mL, advanced by rAF while running.
  function usePumpSim({ rate, volume, locked, bolusRate }) {
    const [run, setRun] = useState(false);
    const [infused, setInfused] = useState(0);
    const [speed, setSpeed] = useState(60);
    const [bolusLeft, setBolusLeft] = useState(0);
    const ref = useRef({ rate, volume, speed, bolusLeft, infused: 0 });
    ref.current.rate = rate; ref.current.volume = volume; ref.current.speed = speed;

    useEffect(() => { if (locked && run) setRun(false); }, [locked, run]);
    useEffect(() => {
      if (!run) return undefined;
      let raf = 0, timer = 0, last = performance.now(), alive = true;
      const slow = reduceMotion();
      const tick = (now) => {
        if (!alive) return;
        const dtH = Math.min(0.25, (now - last) / 3600e3) * ref.current.speed;
        last = now;
        if (!document.hidden) {
          const r = ref.current;
          let add = (Number(r.rate) || 0) * dtH;
          let bl = r.bolusLeft;
          if (bl > 0) { const b = Math.min(bl, (bolusRate || 300) * dtH); add += b; bl -= b; r.bolusLeft = bl; setBolusLeft(bl); }
          const next = Math.min(r.volume || 0, r.infused + add);
          r.infused = next;
          setInfused(next);
          if (next >= (r.volume || 0) - 1e-9) { setRun(false); return; }
        }
        if (slow) timer = setTimeout(() => tick(performance.now()), 1000);
        else raf = requestAnimationFrame(tick);
      };
      if (slow) timer = setTimeout(() => tick(performance.now()), 1000); else raf = requestAnimationFrame(tick);
      return () => { alive = false; cancelAnimationFrame(raf); clearTimeout(timer); };
    }, [run, bolusRate]);

    const stop = useCallback(() => { setRun(false); ref.current.infused = 0; ref.current.bolusLeft = 0; setInfused(0); setBolusLeft(0); }, []);
    const bolus = useCallback((ml) => { ref.current.bolusLeft += ml; setBolusLeft(ref.current.bolusLeft); }, []);
    const left = Math.max(0, (volume || 0) - infused);
    const hoursLeft = rate > 0 ? left / rate : null;
    return { run, setRun, infused, left, frac: volume ? left / volume : 0, hoursLeft, speed, setSpeed, stop, bolus, bolusing: bolusLeft > 0, empty: volume > 0 && left <= 1e-6, nearEmpty: volume > 0 && left / volume < 0.1 };
  }

  function useAlarmBeep(on, alarm) {
    useEffect(() => {
      if (!on || !alarm) return undefined;
      beep();
      const t = setInterval(beep, 1300);
      return () => clearInterval(t);
    }, [on, alarm]);
  }

  /* ---- rotary knob: drag up/down (or turn), wheel, arrow keys ---- */
  function RateKnob({ value, onChange, step, max, disabled, color }) {
    const drag = useRef(null);
    const v = Number(value) || 0;
    const angle = -135 + Math.min(1, v / (max || 100)) * 270;
    const set = (n) => { if (!disabled) onChange(Math.max(0, Math.round(n / step) * step)); };
    return (
      <div role="slider" tabIndex={disabled ? -1 : 0} aria-label="Pump rate (mL/h)" aria-valuenow={v} aria-valuemin={0} aria-valuemax={max}
        className={'dc-knob' + (disabled ? ' is-off' : '')}
        onKeyDown={(e) => { if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); set(v + step); } if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); set(v - step); } }}
        onWheel={(e) => { e.preventDefault(); set(v + (e.deltaY < 0 ? step : -step)); }}
        onPointerDown={(e) => { if (disabled) return; e.currentTarget.setPointerCapture(e.pointerId); drag.current = { y: e.clientY, v }; }}
        onPointerMove={(e) => { if (!drag.current) return; const dy = drag.current.y - e.clientY; set(drag.current.v + Math.round(dy / 4) * step); }}
        onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
        title="Drag up/down, scroll, or use the arrow keys">
        <svg viewBox="0 0 64 64" width="60" height="60">
          <defs>
            <radialGradient id="knobG" cx="35%" cy="30%" r="75%"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#c9d3df" /></radialGradient>
          </defs>
          <circle cx="32" cy="32" r="29" fill="none" stroke="rgba(125,145,180,.25)" strokeWidth="3" strokeDasharray="137 46" transform="rotate(135 32 32)" />
          <circle cx="32" cy="32" r="29" fill="none" stroke={color || '#0090ca'} strokeWidth="3" strokeLinecap="round"
            strokeDasharray={(Math.min(1, v / (max || 100)) * 137) + ' 999'} transform="rotate(135 32 32)" style={{ transition: 'stroke-dasharray .2s' }} />
          <circle cx="32" cy="32" r="22" fill="url(#knobG)" stroke="rgba(31,59,90,.18)" />
          {[...Array(12)].map((_, i) => <line key={i} x1="32" y1="12.5" x2="32" y2="15" stroke="rgba(31,59,90,.25)" strokeWidth="1.2" transform={'rotate(' + (i * 30) + ' 32 32)'} />)}
          <g style={{ transform: 'rotate(' + angle + 'deg)', transformOrigin: '32px 32px', transition: 'transform .18s cubic-bezier(.3,1.5,.5,1)' }}>
            <line x1="32" y1="32" x2="32" y2="15" stroke={color || '#0090ca'} strokeWidth="3.2" strokeLinecap="round" />
          </g>
          <circle cx="32" cy="32" r="3.2" fill="#16202e" />
        </svg>
      </div>
    );
  }

  function Controls({ sim, rate, onRate, step, locked, beepOn, setBeep, onBolus, bolusMl, maxRate, color, kind }) {
    const r = Number(rate) || 0;
    const set = (n) => onRate(Math.max(0, D().roundToPump(n)));
    return (
      <div className="dc-pump-ctl">
        <div className="dc-pump-btns">
          <button className={'dc-pbtn ' + (sim.run ? 'is-pause' : 'is-run')} disabled={locked || !(r > 0) || sim.empty} onClick={() => sim.setRun(!sim.run)}
            title={locked ? 'Locked — the dose is over the hard limit' : ''}>
            {sim.run ? <><svg viewBox="0 0 24 24" width="13" height="13"><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" /><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" /></svg> Pause</>
              : <><svg viewBox="0 0 24 24" width="13" height="13"><path d="M7 5l12 7-12 7z" fill="currentColor" /></svg> {sim.infused > 0 ? 'Resume' : 'Start'}</>}
          </button>
          <button className="dc-pbtn" onClick={sim.stop} title="Stop and reset the volume counter">
            <svg viewBox="0 0 24 24" width="12" height="12"><rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor" /></svg> Stop
          </button>
          {kind === 'syringe' && bolusMl ? (
            <button className="dc-pbtn" disabled={!sim.run || locked} onClick={() => onBolus && onBolus()} title={'Give a ' + bolusMl + ' mL bolus (simulated)'}>Bolus {bolusMl} mL</button>
          ) : null}
        </div>
        <div className="dc-pump-rate">
          <button className="dc-step" aria-label="Lower rate" onClick={() => set(r - step)}>▼</button>
          <RateKnob value={r} onChange={set} step={step} max={maxRate} color={color} />
          <button className="dc-step" aria-label="Raise rate" onClick={() => set(r + step)}>▲</button>
        </div>
        <div className="dc-pump-opts">
          <label title="Speed up the simulation only — the rate shown is real">
            <span>Time-lapse</span>
            <select value={sim.speed} onChange={(e) => sim.setSpeed(Number(e.target.value))}>
              <option value={1}>×1 real time</option><option value={60}>×60 (1 min = 1 h)</option><option value={600}>×600</option>
            </select>
          </label>
          <label className="dc-check"><input type="checkbox" checked={beepOn} onChange={(e) => setBeep(e.target.checked)} /> Alarm sound</label>
        </div>
      </div>
    );
  }

  const LEVEL_TEXT = { hard: 'OVER HARD LIMIT', high: 'HIGH DOSE', low: 'LOW DOSE' };
  function alarmOf(level, sim, emptyText) {
    if (level === 'hard') return { text: LEVEL_TEXT.hard + ' — LOCKED', tone: 'red' };
    if (sim.empty) return { text: emptyText, tone: 'red' };
    if (sim.nearEmpty && sim.infused > 0) return { text: 'NEAR EMPTY', tone: 'amber' };
    if (level === 'high' || level === 'low') return { text: LEVEL_TEXT[level], tone: 'amber' };
    return null;
  }
  const LCD = { ok: '#6ff2d2', amber: '#ffc861', red: '#ff7b8c' };

  /* ================= syringe driver ================= */
  function SyringePump({ drug, color, rate, volume, doseText, level, onRate, step, bolusMl, maxRate }) {
    const vol = Number(volume) > 0 ? Number(volume) : 50;
    const locked = level === 'hard';
    const sim = usePumpSim({ rate: Number(rate) || 0, volume: vol, locked, bolusRate: 600 });
    const [beepOn, setBeep] = useState(false);
    const alarm = alarmOf(level, sim, 'SYRINGE EMPTY');
    useAlarmBeep(beepOn, alarm && (sim.run || locked || sim.empty) ? alarm.text : null);
    const tone = alarm ? LCD[alarm.tone] : LCD.ok;

    // Geometry: barrel 130–430, plunger pushes left → right as the syringe empties.
    const X0 = 176, X1 = 428, travel = X1 - X0;
    const head = X0 + (1 - sim.frac) * travel;
    const flowDur = sim.run ? Math.max(0.25, 2.6 / Math.log2(2 + (Number(rate) || 0) * sim.speed / 6)) : 0;
    const liquid = color || '#27a8db';
    const ticks = [];
    for (let i = 0; i <= 10; i++) ticks.push(i);

    return (
      <div className={'dc-pump' + (alarm ? ' is-alarm-' + alarm.tone : '') + (sim.run ? ' is-running' : '')}>
        <svg viewBox="0 0 560 236" className="dc-pump-svg" role="img" aria-label={'Syringe pump at ' + f1(rate) + ' mL per hour'}>
          <defs>
            <linearGradient id="spBody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#dfe6ee" /></linearGradient>
            <linearGradient id="spRail" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#eef2f7" /><stop offset="1" stopColor="#c7d1dc" /></linearGradient>
            <linearGradient id="spGlass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="rgba(255,255,255,.95)" /><stop offset=".5" stopColor="rgba(225,238,248,.55)" /><stop offset="1" stopColor="rgba(190,210,228,.7)" /></linearGradient>
            <linearGradient id="spLiquid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={liquid} stopOpacity=".55" /><stop offset="1" stopColor={liquid} stopOpacity=".9" /></linearGradient>
            <linearGradient id="spLcd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0d2633" /><stop offset="1" stopColor="#06141c" /></linearGradient>
            <filter id="spShadow" x="-10%" y="-10%" width="120%" height="140%"><feDropShadow dx="0" dy="6" stdDeviation="7" floodColor="#1f3b5a" floodOpacity=".18" /></filter>
            <filter id="spGlow"><feGaussianBlur stdDeviation="1.4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>

          {/* body */}
          <rect x="10" y="70" width="540" height="152" rx="20" fill="url(#spBody)" stroke="rgba(31,59,90,.14)" filter="url(#spShadow)" />
          <rect x="22" y="58" width="516" height="22" rx="9" fill="url(#spRail)" stroke="rgba(31,59,90,.12)" />
          {/* syringe clamp */}
          <rect x="420" y="14" width="26" height="52" rx="5" fill="#cfd8e3" stroke="rgba(31,59,90,.2)" />

          {/* barrel */}
          <rect x={X0 - 4} y="22" width={travel + 8} height="36" rx="6" fill="url(#spGlass)" stroke="rgba(31,59,90,.35)" strokeWidth="1.2" />
          <rect x={head} y="25" width={Math.max(0, X1 - head)} height="30" rx="3" fill="url(#spLiquid)" />
          {ticks.map((i) => {
            const x = X0 + (i / 10) * travel;
            return <g key={i}><line x1={x} y1="22" x2={x} y2={i % 2 ? 29 : 33} stroke="rgba(31,59,90,.45)" strokeWidth="1" />
              {i % 2 === 0 ? <text x={x} y="42" fontSize="7.5" textAnchor="middle" fill="rgba(31,59,90,.55)" fontFamily="IBM Plex Mono,monospace">{Math.round(vol - (i / 10) * vol)}</text> : null}</g>;
          })}
          <rect x={X0 - 10} y="16" width="6" height="48" rx="2" fill="#b9c4d1" />
          {/* plunger head + rod + pusher block */}
          <rect x={head - 6} y="24" width="7" height="32" rx="2" fill="#2d3a4a" />
          <rect x={head - 118} y="36" width="112" height="8" rx="2" fill="#d7dee7" stroke="rgba(31,59,90,.25)" />
          <g>
            <rect x={head - 150} y="10" width="34" height="62" rx="7" fill="#7f8fa3" />
            <rect x={head - 146} y="14" width="26" height="54" rx="5" fill="#93a3b7" />
            <circle cx={head - 133} cy="41" r="5" fill="#5b6b80" />
          </g>
          {/* luer tip + line */}
          <rect x={X1 + 4} y="35" width="18" height="10" rx="2" fill="#d4dde7" stroke="rgba(31,59,90,.3)" />
          <path d={'M ' + (X1 + 22) + ' 40 C 500 40, 520 40, 528 60 S 548 96, 556 96'} fill="none" stroke="rgba(31,59,90,.25)" strokeWidth="5" strokeLinecap="round" />
          <path d={'M ' + (X1 + 22) + ' 40 C 500 40, 520 40, 528 60 S 548 96, 556 96'} fill="none" stroke={liquid} strokeWidth="2.6" strokeLinecap="round"
            strokeDasharray="7 5" className={sim.run ? 'dc-flow' : ''} style={sim.run ? { animationDuration: flowDur + 's' } : { opacity: .45 }} />

          {/* left panel: brand + LEDs */}
          <text x="30" y="106" fontSize="14" fontWeight="800" fill="#16202e" letterSpacing="1">UNICO</text>
          <text x="30" y="121" fontSize="9.5" fill="#6c7a8c" letterSpacing="1.2">SYRINGE PUMP · SP-50</text>
          <g transform="translate(30 138)">
            <circle cx="6" cy="6" r="5" fill={sim.run && !alarm ? '#25c06b' : '#9fd8b8'} className={sim.run && !alarm ? 'dc-blink' : ''} />
            <text x="16" y="9" fontSize="10" fill="#6c7a8c">RUN</text>
            <circle cx="60" cy="6" r="5" fill={alarm ? (alarm.tone === 'red' ? '#ff4d64' : '#ffb020') : '#f0d9a8'} className={alarm ? 'dc-blink-fast' : ''} />
            <text x="70" y="9" fontSize="10" fill="#6c7a8c">ALARM</text>
            <circle cx="130" cy="6" r="5" fill={sim.bolusing ? '#3aa0ff' : '#bcd3ea'} />
            <text x="140" y="9" fontSize="10" fill="#6c7a8c">BOLUS</text>
          </g>
          <text x="30" y="178" fontSize="10.5" fill="#6c7a8c">Syringe</text>
          <text x="30" y="195" fontSize="14" fontWeight="700" fill="#16202e" fontFamily="IBM Plex Mono,monospace">{f1(vol)} mL</text>
          <text x="130" y="178" fontSize="10.5" fill="#6c7a8c">Speed</text>
          <text x="130" y="195" fontSize="14" fontWeight="700" fill="#16202e" fontFamily="IBM Plex Mono,monospace">×{sim.speed}</text>

          {/* LCD */}
          <rect x="246" y="88" width="290" height="122" rx="12" fill="url(#spLcd)" stroke="#031018" strokeWidth="2" />
          <g filter="url(#spGlow)" fontFamily="IBM Plex Mono,monospace">
            <text x="260" y="108" fontSize="12.5" fill={tone} opacity=".85">{String(drug || 'No drug selected').slice(0, 32)}</text>
            <text x="260" y="146" fontSize="36" fontWeight="700" fill={tone}>{f1(rate)}<tspan fontSize="15" dx="6">mL/h</tspan></text>
            <text x="260" y="167" fontSize="13" fill={tone} opacity=".9">{doseText || ''}</text>
            <text x="260" y="186" fontSize="11.5" fill={tone} opacity=".78">VOL {f1(sim.infused)}/{f1(vol)} mL  LEFT {fmtH(sim.hoursLeft)}</text>
            <text x="260" y="202" fontSize="11.5" fontWeight="700" fill={alarm ? LCD[alarm.tone] : tone} className={alarm ? 'dc-blink-fast' : ''}>
              {alarm ? '⚠ ' + alarm.text : sim.run ? (sim.bolusing ? '▶ BOLUS' : '▶ INFUSING') : sim.infused > 0 ? '❚❚ PAUSED' : '■ READY'}
            </text>
          </g>
        </svg>
        <div className="dc-pump-foot">
          <span>Syringe empties at <b>{clockAt(sim.hoursLeft) || '—'}</b> <i>({fmtH(sim.hoursLeft)} at this rate)</i></span>
        </div>
        <Controls sim={sim} rate={rate} onRate={onRate} step={step || 0.1} locked={locked} beepOn={beepOn} setBeep={setBeep}
          onBolus={() => sim.bolus(bolusMl)} bolusMl={bolusMl} maxRate={maxRate} color={liquid} kind="syringe" />
      </div>
    );
  }

  /* ================= volumetric pump ================= */
  function InfusionPump({ fluid, color, rate, volume, dropFactor, doseText, level, onRate, step, maxRate }) {
    const vol = Number(volume) > 0 ? Number(volume) : 500;
    const locked = level === 'hard';
    const sim = usePumpSim({ rate: Number(rate) || 0, volume: vol, locked });
    const [beepOn, setBeep] = useState(false);
    const alarm = alarmOf(level, sim, 'INFUSION COMPLETE');
    useAlarmBeep(beepOn, alarm && (sim.run || locked || sim.empty) ? alarm.text : null);
    const tone = alarm ? LCD[alarm.tone] : LCD.ok;
    const liquid = color || '#7cc6ec';
    const df = Number(dropFactor) || 20;
    const dpm = D().dripsFromRate(Number(rate) || 0, df) || 0;
    // A drop every 60/dpm s in real time; time-lapse speeds the drops too (but not below 0.18 s).
    const dropDur = dpm > 0 ? Math.max(0.18, 60 / (dpm * Math.min(sim.speed, 30))) : 0;
    const rollDur = (Number(rate) || 0) > 0 ? Math.max(0.35, 30 / Math.sqrt((Number(rate) || 1) * Math.min(sim.speed, 60))) : 0;
    const fillTop = 26 + (1 - sim.frac) * 84;

    return (
      <div className={'dc-pump' + (alarm ? ' is-alarm-' + alarm.tone : '') + (sim.run ? ' is-running' : '')}>
        <svg viewBox="0 0 560 292" className="dc-pump-svg" role="img" aria-label={'Infusion pump at ' + f1(rate) + ' mL per hour'}>
          <defs>
            <linearGradient id="ipBody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#dde5ee" /></linearGradient>
            <linearGradient id="ipLcd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0d2633" /><stop offset="1" stopColor="#06141c" /></linearGradient>
            <linearGradient id="ipBag" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="rgba(255,255,255,.9)" /><stop offset=".6" stopColor="rgba(226,238,248,.55)" /><stop offset="1" stopColor="rgba(196,214,230,.7)" /></linearGradient>
            <clipPath id="ipBagClip"><path d="M48 22 Q48 14 56 14 L132 14 Q140 14 140 22 L140 104 Q140 118 126 122 L62 122 Q48 118 48 104 Z" /></clipPath>
            <filter id="ipShadow" x="-10%" y="-10%" width="120%" height="140%"><feDropShadow dx="0" dy="6" stdDeviation="7" floodColor="#1f3b5a" floodOpacity=".18" /></filter>
            <filter id="ipGlow"><feGaussianBlur stdDeviation="1.4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>
          {/* pole + bag */}
          <line x1="94" y1="0" x2="94" y2="12" stroke="#9aa6b4" strokeWidth="3" />
          <path d="M48 22 Q48 14 56 14 L132 14 Q140 14 140 22 L140 104 Q140 118 126 122 L62 122 Q48 118 48 104 Z" fill="url(#ipBag)" stroke="rgba(31,59,90,.35)" strokeWidth="1.2" />
          <g clipPath="url(#ipBagClip)">
            <rect x="44" y={fillTop} width="100" height={130 - fillTop} fill={liquid} opacity=".55" style={{ transition: 'y .3s linear' }} />
            <path d={'M44 ' + fillTop + ' q 12 -3 25 0 t 25 0 t 25 0 t 25 0'} fill="none" stroke={liquid} strokeWidth="1.5" className={sim.run ? 'dc-wave' : ''} />
          </g>
          <text x="94" y="58" fontSize="10" textAnchor="middle" fontWeight="700" fill="#16202e">{String(fluid || 'IV fluid').slice(0, 16)}</text>
          <text x="94" y="72" fontSize="9" textAnchor="middle" fill="#3c4858" fontFamily="IBM Plex Mono,monospace">{f1(sim.left)} mL</text>
          {/* spike + drip chamber */}
          <rect x="88" y="122" width="12" height="10" fill="#cfd8e3" />
          <rect x="80" y="132" width="28" height="50" rx="7" fill="rgba(235,244,252,.75)" stroke="rgba(31,59,90,.35)" />
          <rect x="82" y="166" width="24" height="14" rx="4" fill={liquid} opacity=".5" />
          {sim.run && dropDur ? <circle cx="94" cy="138" r="3.2" fill={liquid} className="dc-drop" style={{ animationDuration: dropDur + 's' }} /> : <circle cx="94" cy="138" r="3" fill={liquid} opacity=".6" />}
          {/* tubing into the pump door and out to the patient */}
          <path d="M94 182 L94 214 Q94 232 112 232 L196 232" fill="none" stroke="rgba(31,59,90,.25)" strokeWidth="5" strokeLinecap="round" />
          <path d="M94 182 L94 214 Q94 232 112 232 L196 232" fill="none" stroke={liquid} strokeWidth="2.4" strokeDasharray="7 5" className={sim.run ? 'dc-flow' : ''} style={sim.run ? { animationDuration: Math.max(0.3, rollDur / 2) + 's' } : { opacity: .45 }} />

          {/* body */}
          <rect x="176" y="34" width="374" height="246" rx="22" fill="url(#ipBody)" stroke="rgba(31,59,90,.14)" filter="url(#ipShadow)" />
          {/* pump door with peristaltic rollers */}
          <rect x="196" y="56" width="70" height="204" rx="12" fill="#eef2f7" stroke="rgba(31,59,90,.15)" />
          <path d="M231 60 L231 256" stroke="rgba(31,59,90,.25)" strokeWidth="5" />
          <path d="M231 60 L231 256" stroke={liquid} strokeWidth="2.4" strokeDasharray="7 5" className={sim.run ? 'dc-flow' : ''} style={sim.run ? { animationDuration: Math.max(0.3, rollDur / 2) + 's' } : { opacity: .45 }} />
          <g className={sim.run && rollDur ? 'dc-spin' : ''} style={sim.run && rollDur ? { animationDuration: rollDur + 's', transformOrigin: '231px 158px' } : { transformOrigin: '231px 158px' }}>
            <circle cx="231" cy="158" r="26" fill="#d6dee8" stroke="rgba(31,59,90,.25)" />
            {[0, 90, 180, 270].map((a) => <circle key={a} cx={231 + 18 * Math.cos(a * Math.PI / 180)} cy={158 + 18 * Math.sin(a * Math.PI / 180)} r="6.5" fill="#8b9bb0" stroke="#6c7a8c" />)}
            <circle cx="231" cy="158" r="5" fill="#5b6b80" />
          </g>
          <text x="231" y="250" fontSize="7.5" textAnchor="middle" fill="#6c7a8c">▼ TO PATIENT</text>

          <text x="286" y="68" fontSize="14" fontWeight="800" fill="#16202e" letterSpacing="1">UNICO</text>
          <text x="286" y="82" fontSize="9.5" fill="#6c7a8c" letterSpacing="1.4">VOLUMETRIC PUMP · VP-1</text>
          {/* LCD */}
          <rect x="286" y="90" width="248" height="122" rx="12" fill="url(#ipLcd)" stroke="#031018" strokeWidth="2" />
          <g filter="url(#ipGlow)" fontFamily="IBM Plex Mono,monospace">
            <text x="300" y="130" fontSize="34" fontWeight="700" fill={tone}>{f1(rate)}<tspan fontSize="15" dx="6">mL/h</tspan></text>
            <text x="300" y="150" fontSize="12.5" fill={tone} opacity=".9">{doseText || (f1(dpm) + ' drops/min  (' + df + ' gtt/mL)')}</text>
            <text x="300" y="169" fontSize="11" fill={tone} opacity=".78">VTBI {f1(vol)}  INFUSED {f1(sim.infused)} mL</text>
            <text x="300" y="184" fontSize="11" fill={tone} opacity=".78">TIME LEFT {fmtH(sim.hoursLeft)}</text>
            <text x="300" y="203" fontSize="11" fontWeight="700" fill={alarm ? LCD[alarm.tone] : tone} className={alarm ? 'dc-blink-fast' : ''}>
              {alarm ? '⚠ ' + alarm.text : sim.run ? '▶ INFUSING' : sim.infused > 0 ? '❚❚ PAUSED' : '■ READY'}
            </text>
          </g>
          <g transform="translate(300 230)">
            <circle cx="6" cy="6" r="5" fill={sim.run && !alarm ? '#25c06b' : '#9fd8b8'} className={sim.run && !alarm ? 'dc-blink' : ''} />
            <text x="16" y="9" fontSize="10" fill="#6c7a8c">RUN</text>
            <circle cx="62" cy="6" r="5" fill={alarm ? (alarm.tone === 'red' ? '#ff4d64' : '#ffb020') : '#f0d9a8'} className={alarm ? 'dc-blink-fast' : ''} />
            <text x="72" y="9" fontSize="10" fill="#6c7a8c">ALARM</text>
            <text x="130" y="9" fontSize="8.5" fill="#6c7a8c">{f1(dpm)} gtt/min</text>
          </g>
        </svg>
        <div className="dc-pump-foot">
          <span>Bag finishes at <b>{clockAt(sim.hoursLeft) || '—'}</b> <i>({fmtH(sim.hoursLeft)} at this rate)</i></span>
        </div>
        <Controls sim={sim} rate={rate} onRate={onRate} step={step || 1} locked={locked} beepOn={beepOn} setBeep={setBeep} maxRate={maxRate} color={liquid} kind="volumetric" />
      </div>
    );
  }

  window.DosePumps = { SyringePump, InfusionPump, RateKnob };
})();
