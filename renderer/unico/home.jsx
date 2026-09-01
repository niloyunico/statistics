/* HOME — the personal dashboard every signed-in person lands on.
 *
 * A 1:1 port of the "Home Dashboard" canvas mockup: the computed style strings,
 * keyframes, SVG scenery and interactions are lifted from the mockup's own script
 * and template, not approximated. Two things differ, both deliberate:
 *
 *   1. DATA IS REAL. The mockup ran on props ("Rehana Akter", a fixed Morning
 *      shift, an invented leave balance). Here the hero facts come from the staff
 *      register, the shift/week/team from the published dutyRosters decoded
 *      through window.UNICO_ROSTER (the hospital's printed shift legend), records
 *      from staffCertifications, and announcements are derived from real events
 *      (roster publications, certifications nearing expiry). The mockup's leave
 *      balance had no real source, so that card counts OFF DAYS from the roster
 *      instead — same ring, honest number. Mood stays on this device only.
 *   2. The shift checklist is gone — removed earlier at the user's request.
 *
 * The scene is the mockup's: a time-of-day sky with the sun/moon riding its real
 * daily arc, tonight's true lunar phase, drifting clouds, birds, a plane with a
 * fading trail, a rocket, a kite by day, fireflies at night, a village silhouette
 * whose windows light after dark, a passing train, rain/snow summoned by clicking
 * the sun or moon, window lights toggled by clicking the village, confetti on the
 * avatar, ripples + a balloon wherever the hero is clicked, and sparkles under
 * the pointer. All decoration; every animation stops under prefers-reduced-motion.
 */
(function () {
  const { useState, useEffect, useMemo, useRef, useCallback } = React;

  const KEY_MOOD = 'unico_home_mood_v1';
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };

  const pad = (n) => String(n).padStart(2, '0');
  const to12 = (hhmm) => { const [H, M] = hhmm.split(':').map(Number); const ap = H < 12 ? 'AM' : 'PM'; const hh = H % 12 === 0 ? 12 : H % 12; return pad(hh) + ':' + pad(M) + ' ' + ap; };
  const initialsOf = (n) => String(n || 'U').replace('Dr. ', '').split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'U';

  /* The mockup expresses every style as a CSS string; sx() turns one into a React
     style object so those strings can be carried over verbatim instead of being
     hand-translated (and mistranslated). */
  const sx = (css) => {
    const o = {};
    for (const part of String(css || '').split(';')) {
      const i = part.indexOf(':'); if (i < 0) continue;
      let k = part.slice(0, i).trim(); const v = part.slice(i + 1).trim();
      if (!k) continue;
      if (k.startsWith('--')) { o[k] = v; continue; }
      k = k.replace(/^-webkit-/, 'Webkit-').replace(/^-moz-/, 'Moz-').replace(/-([a-z])/g, (m, c) => c.toUpperCase());
      o[k] = v;
    }
    return o;
  };
  // The app bundle already defines `pop` and `livepulse` keyframes of its own, so
  // every mockup animation name is prefixed and the two sheets can never fight.
  const ANIMS = ['orbFloat', 'pop', 'livepulse', 'shiftSweep', 'tick', 'cloudDrift', 'twinkle', 'discGlow', 'birdFly', 'rayspin', 'planeFly', 'trailFade', 'rocketRise', 'flameFlicker', 'balloonUp', 'sway', 'hotAir', 'bob', 'shoot', 'smoke', 'winFlick', 'godray', 'ringGlow', 'riseIn', 'rainFall', 'snowFall', 'flash', 'firefly', 'kiteBob', 'ripple', 'grassSway', 'textGlow', 'sparkle', 'burst', 'trainRun', 'satellite', 'barShine', 'slideDown', 'fadeSwap', 'checkPop'];
  const fixAnim = (css) => String(css || '').replace(new RegExp('\\b(' + ANIMS.join('|') + ')\\b', 'g'), 'hd$1');
  const fs = (css) => sx(fixAnim(css));

  const tag = (c, bg) => 'display:inline-flex;align-items:center;font-size:10.5px;font-weight:700;letter-spacing:.4px;padding:3px 9px;border-radius:20px;color:' + c + ';background:' + bg;

  // "7:00 AM - 3:00 PM" (the roster legend's format) -> seconds since midnight
  function parseRange(label) {
    const m = String(label || '').match(/(\d{1,2}):(\d{2})\s*([AP]M)\s*[-—]\s*(\d{1,2}):(\d{2})\s*([AP]M)/i);
    if (!m) return null;
    const to = (h, mi, ap) => (((+h % 12) + (/pm/i.test(ap) ? 12 : 0)) * 3600) + (+mi) * 60;
    return { start: to(m[1], m[2], m[3]), end: to(m[4], m[5], m[6]) };
  }
  const BUCKET = {
    M: { name: 'Morning', accent: '#27a8db', accent2: '#7ac4e8' },
    E: { name: 'Evening', accent: '#3ab5a7', accent2: '#7fd6cb' },
    N: { name: 'Night', accent: '#8a72ee', accent2: '#b9a8ff' },
    G: { name: 'General', accent: '#e08a1e', accent2: '#ffd166' },
  };
  const TEAM_COLORS = ['#0072a3', '#3ab5a7', '#6a52d4', '#e08a1e', '#27a8db', '#d23a52'];

  // The mockup's keyframes, verbatim (prefixed by fixAnim).
  const KEYFRAMES = fixAnim(`
@keyframes orbFloat{from{transform:translate(0,0) scale(1)}to{transform:translate(160px,110px) scale(1.18)}}
@keyframes livepulse{0%{box-shadow:0 0 0 0 rgba(61,220,151,.6)}70%{box-shadow:0 0 0 8px rgba(61,220,151,0)}100%{box-shadow:0 0 0 0 rgba(61,220,151,0)}}
@keyframes shiftSweep{from{background-position:200% 0}to{background-position:-200% 0}}
@keyframes tick{from{opacity:.45}to{opacity:1}}
@keyframes cloudDrift{from{transform:translateX(-120px)}to{transform:translateX(760px)}}
@keyframes twinkle{0%,100%{opacity:.25}50%{opacity:1}}
@keyframes discGlow{0%,100%{filter:blur(0);transform:scale(1)}50%{filter:blur(.4px);transform:scale(1.04)}}
@keyframes birdFly{from{transform:translate(-60px,10px)}to{transform:translate(700px,-30px)}}
@keyframes rayspin{to{transform:rotate(360deg)}}
@keyframes planeFly{0%{transform:translate(-140px,26px)}100%{transform:translate(1100px,-16px)}}
@keyframes trailFade{0%,100%{opacity:0}12%{opacity:.55}80%{opacity:.2}}
@keyframes rocketRise{0%{transform:translate(0,120px) rotate(28deg);opacity:0}8%{opacity:1}70%{opacity:1}100%{transform:translate(300px,-190px) rotate(28deg);opacity:0}}
@keyframes flameFlicker{0%,100%{transform:scaleY(1);opacity:.9}50%{transform:scaleY(1.5);opacity:.6}}
@keyframes balloonUp{0%{transform:translateY(0) scale(.6);opacity:0}8%{opacity:1;transform:translateY(-10px) scale(1)}100%{transform:translateY(-280px) translateX(30px) scale(.85);opacity:0}}
@keyframes sway{0%,100%{rotate:-4deg}50%{rotate:4deg}}
@keyframes hotAir{from{transform:translateX(-90px)}to{transform:translateX(1150px)}}
@keyframes shoot{0%,100%{transform:translate(0,0);opacity:0}3%{opacity:1}14%{transform:translate(-260px,150px);opacity:0}}
@keyframes smoke{0%{transform:translate(0,0) scale(.5);opacity:.5}100%{transform:translate(14px,-46px) scale(1.6);opacity:0}}
@keyframes winFlick{0%,92%,100%{opacity:.95}95%{opacity:.4}}
@keyframes godray{from{transform:rotate(0deg)}to{transform:rotate(-360deg)}}
@keyframes ringGlow{0%,100%{box-shadow:0 0 0 0 rgba(61,220,151,.0)}50%{box-shadow:0 0 22px 4px rgba(61,220,151,.35)}}
@keyframes riseIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes rainFall{from{transform:translateY(-40px)}to{transform:translateY(280px)}}
@keyframes snowFall{from{transform:translate(0,-20px) rotate(0)}to{transform:translate(34px,280px) rotate(180deg)}}
@keyframes flash{0%,94%,100%{opacity:0}95%{opacity:.75}96%{opacity:0}97.5%{opacity:.5}98.5%{opacity:0}}
@keyframes firefly{0%,100%{transform:translate(0,0);opacity:0}20%{opacity:1}50%{transform:translate(20px,-26px);opacity:.25}80%{opacity:1}}
@keyframes kiteBob{0%,100%{transform:translate(0,0) rotate(-10deg)}50%{transform:translate(14px,-16px) rotate(8deg)}}
@keyframes ripple{from{transform:scale(.15);opacity:.9}to{transform:scale(1);opacity:0}}
@keyframes grassSway{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(5deg)}}
@keyframes textGlow{0%,100%{text-shadow:0 0 0 rgba(39,168,219,0)}50%{text-shadow:0 0 18px rgba(39,168,219,.55)}}
@keyframes sparkle{0%{transform:scale(0) rotate(0);opacity:1}100%{transform:scale(1.5) rotate(120deg);opacity:0}}
@keyframes burst{0%{transform:translateX(0) scale(1);opacity:1}100%{transform:translateX(120px) scale(.3);opacity:0}}
@keyframes trainRun{from{transform:translateX(1260px)}to{transform:translateX(-380px)}}
@keyframes satellite{from{transform:translate(-30px,46px)}to{transform:translate(1000px,6px)}}
@keyframes barShine{from{transform:translateX(-100%)}to{transform:translateX(300%)}}
@keyframes slideDown{from{opacity:0;transform:translateY(-10px) scale(.98)}to{opacity:1;transform:none}}
@keyframes fadeSwap{from{opacity:0;transform:translateX(12px)}to{opacity:1;transform:none}}
@keyframes checkPop{0%{transform:scale(.4);opacity:0}60%{transform:scale(1.15);opacity:1}100%{transform:scale(1)}}
`) + `
@media (prefers-reduced-motion:reduce){.unico-home *{animation:none!important;transition:none!important}}`;

  // The mockup's glass card, verbatim.
  const GLASS = 'background:linear-gradient(152deg,rgba(255,255,255,.82),rgba(236,247,255,.58));backdrop-filter:blur(22px) saturate(1.6);-webkit-backdrop-filter:blur(22px) saturate(1.6);border:1px solid rgba(255,255,255,.9);border-radius:16px;box-shadow:0 14px 38px rgba(31,59,90,.14),inset 0 1px 0 rgba(255,255,255,.95);padding:16px 17px';
  const cardH = (title, right) => (
    <div style={sx('display:flex;align-items:center;gap:10px;margin-bottom:12px')}>
      <div style={sx('font-size:14.5px;font-weight:700;color:#16202e')}>{title}</div>
      <span style={{ flex: 1 }} />
      {right}
    </div>
  );

  /* ------------------------- ROLLOUT SWITCHBOARD -------------------------
   * The widgets below the mood row depend on modules that are still being
   * completed. Until a module ships, its card is veiled "Coming soon" — the
   * card keeps its real shape underneath (a teaser, not a hole in the page)
   * but cannot be interacted with. Flip a flag to true to unlock that card
   * for everyone; no other change is needed.
   */
  const LIVE = {
    thisWeek: false,       // needs: duty roster rolled out to every ward
    dutyToday: false,      // needs: same roster rollout
    announcements: false,  // needs: someone owning the notices
    team: false,           // needs: roster rollout
    offDays: false,        // needs: roster rollout
    records: false,        // needs: certification register filled in
  };

  function Soon({ live, label, children }) {
    if (live) return children;
    return (
      <div style={{ position: 'relative' }} aria-disabled="true">
        {/* inert preview of the real card underneath */}
        <div style={{ pointerEvents: 'none', userSelect: 'none', filter: 'saturate(.55)', opacity: .55 }} aria-hidden="true">{children}</div>
        <div style={sx('position:absolute;inset:0;border-radius:16px;display:grid;place-items:center;background:linear-gradient(152deg,rgba(244,249,255,.55),rgba(226,239,252,.45));backdrop-filter:blur(3.5px);-webkit-backdrop-filter:blur(3.5px);border:1px dashed rgba(0,144,202,.35)')}>
          <div style={{ textAlign: 'center', padding: '0 18px' }}>
            <div style={sx('display:inline-flex;align-items:center;gap:8px;padding:7px 14px;border-radius:20px;background:linear-gradient(135deg,#27a8db,#0072a3);color:#fff;font-size:11.5px;font-weight:800;letter-spacing:.8px;text-transform:uppercase;box-shadow:0 10px 24px rgba(0,144,202,.35)')}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" /></svg>
              Coming soon
            </div>
            <div style={sx('font-size:11px;color:#3c4e66;margin-top:8px;line-height:1.55;font-weight:600')}>{label}</div>
          </div>
        </div>
      </div>
    );
  }

  const MOOD_DEFS = [
    { label: 'Great', mouth: 'M7.5 14c1.2 2.2 2.7 3.2 4.5 3.2s3.3-1 4.5-3.2', c: '#0f7a5f' },
    { label: 'Good', mouth: 'M8.5 14.5c1 1.2 2.2 1.8 3.5 1.8s2.5-.6 3.5-1.8', c: '#0072a3' },
    { label: 'Okay', mouth: 'M8.5 15.5h7', c: '#5c6f88' },
    { label: 'Tired', mouth: 'M8.5 16.5c1-1.2 2.2-1.8 3.5-1.8s2.5.6 3.5 1.8', c: '#b06a10' },
    { label: 'Stressed', mouth: 'M8 17c1.3-2 2.6-3 4-3s2.7 1 4 3', c: '#b2263e' },
  ];

  function HomeView({ setRoute }) {
    const u = (typeof window !== 'undefined' && window.__UNICO_USER__) || null;
    const [now, setNow] = useState(() => new Date());
    const [roster, setRoster] = useState(null);
    const [certs, setCerts] = useState(null);
    const [moodSt, setMoodSt] = useState(() => lsGet(KEY_MOOD, {}));
    const [selDay, setSelDay] = useState(null);
    const [annPinned, setAnnPinned] = useState(null);
    const [openRec, setOpenRec] = useState(null);
    const [teamSel, setTeamSel] = useState(0);
    const [weather, setWeather] = useState('Clear');
    const [lights, setLights] = useState(null);
    const [par, setPar] = useState({ mx: 0, my: 0 });
    const [ripples, setRipples] = useState([]);
    const [sparkles, setSparkles] = useState([]);
    const [bursts, setBursts] = useState([]);
    const [balloonsUp, setBalloonsUp] = useState([]);
    const raf = useRef(0); const pm = useRef(null); const ls = useRef(0);

    useEffect(() => {
      document.title = 'Home · UNICO';
      const t = setInterval(() => setNow(new Date()), 1000);
      return () => clearInterval(t);
    }, []);

    // ---- real people, real roster, real records ------------------------------
    const me = useMemo(() => {
      const list = (typeof window !== 'undefined' && window.STAFF_SEED) || [];
      if (!u) return list[0] || null;
      if (u.staffId != null) { const hit = list.find((s) => String(s.id) === String(u.staffId)); if (hit) return hit; }
      return list.find((s) => String(s.emp_id || '').trim() === String(u.username || '').trim()) || null;
    }, [u]);
    const staffName = (u && u.name) || (me && me.name) || 'UNICO staff';
    const designation = (u && u.designation) || (me && me.designation) || (u && u.role === 'incharge' ? 'In-charge' : 'Staff');
    const unit = (me && me.current_department) || 'Nursing Service';
    const staffId = (me && me.emp_id) || (u && u.username) || '—';
    const initials = initialsOf(staffName);

    useEffect(() => {
      let live = true;
      const y = now.getFullYear(), mo = now.getMonth() + 1;
      fetch('/api/rosters', { credentials: 'same-origin' }).then((r) => r.json()).then(async (j) => {
        const all = (j && (j.rosters || j.list)) || [];
        const mine = all.filter((r) => !me || String(r.deptName || r.dept || '').toLowerCase().indexOf(String(unit).toLowerCase().slice(0, 6)) >= 0);
        const pick = mine.find((r) => +r.year === y && +r.month === mo) || mine[0] || all.find((r) => +r.year === y && +r.month === mo) || all[0];
        if (!pick) { if (live) setRoster(false); return; }
        const full = await fetch('/api/rosters/' + encodeURIComponent(pick.dept) + '/' + pick.year + '/' + pick.month, { credentials: 'same-origin' }).then((r) => r.json()).catch(() => null);
        if (live) setRoster((full && (full.roster || full.doc)) || pick || false);
      }).catch(() => { if (live) setRoster(false); });
      return () => { live = false; };
    }, [unit]);  // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
      let live = true;
      fetch('/api/performance', { credentials: 'same-origin' }).then((r) => r.json())
        .then((j) => { if (live) setCerts((j && j.certifications) || []); })
        .catch(() => { if (live) setCerts([]); });
      return () => { live = false; };
    }, []);

    const R = (typeof window !== 'undefined' && window.UNICO_ROSTER) || null;
    const codeInfo = useCallback((code) => {
      if (!code || !R) return null;
      const f = (R.byCode && R.byCode[code]) || (R.CODES && R.CODES[code]) ||
        ((R.list || R.ALL || []).find && (R.list || R.ALL || []).find((c) => c.code === code));
      if (!f) return { code, label: '', bucket: '', hours: 0 };
      return { code, label: f.label || f.time || '', bucket: f.bucket || '', hours: f.hours || 0 };
    }, [R]);
    const myRow = useMemo(() => {
      if (!roster || !roster.grid || !me) return null;
      return roster.grid[String(me.id)] || roster.grid[String(me.emp_id)] || null;
    }, [roster, me]);

    // ---- the mockup's clock/shift math, fed by the real roster ---------------
    const h = now.getHours();
    const greeting = h >= 23 || h < 5 ? 'Working late' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 20 ? 'Good evening' : 'Good night';
    const greetEmoji = h >= 23 || h < 5 ? '🌙✨' : h < 12 ? '☀️' : h < 17 ? '🌤️' : h < 20 ? '🌆' : '🌙';
    const dateLine = now.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
    const h12 = h % 12 === 0 ? 12 : h % 12;
    const clock = pad(h12) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds()) + ' ' + (h < 12 ? 'AM' : 'PM');

    const todayCode = (roster && +roster.year === now.getFullYear() && +roster.month === now.getMonth() + 1 && myRow) ? myRow[now.getDate()] : null;
    const todayInfo = codeInfo(todayCode);
    const sh = useMemo(() => {
      if (!todayInfo || !todayInfo.label) return null;
      const r = parseRange(todayInfo.label);
      if (!r) return null;
      const b = BUCKET[todayInfo.bucket] || BUCKET.M;
      const fmt = (s) => to12(pad(Math.floor(s / 3600) % 24) + ':' + pad(Math.floor(s / 60) % 60));
      return { name: b.name, accent: b.accent, accent2: b.accent2, start: r.start, len: (r.end > r.start ? r.end - r.start : 86400 - r.start + r.end), range: fmt(r.start) + ' — ' + fmt(r.end) };
    }, [todayCode]);  // eslint-disable-line react-hooks/exhaustive-deps

    const secs = h * 3600 + now.getMinutes() * 60 + now.getSeconds();
    let on = false, before = false, remain = 0, pct = 0;
    if (sh) {
      let s0 = sh.start, s1 = sh.start + sh.len, t = secs;
      if (s1 > 86400 && t < s1 - 86400) t += 86400;
      before = t < s0; on = t >= s0 && t < s1;
      remain = on ? s1 - t : before ? s0 - t : 86400 + s0 - t;
      pct = on ? ((t - s0) / sh.len) * 100 : 0;
    }
    const hms = (v) => pad(Math.floor(v / 3600)) + ':' + pad(Math.floor(v / 60) % 60) + ':' + pad(v % 60);
    const shiftNote = !sh ? (roster === null ? 'Looking for your duty roster…' : roster === false ? 'No duty roster has been published for your department yet.' : 'You are not on this month’s roster for ' + ((roster && (roster.deptName || roster.dept)) || 'your unit') + '.')
      : on ? sh.name + ' shift in progress — ' + Math.round(pct) + '% elapsed, ends ' + sh.range.split(' — ')[1] + '.'
        : before ? sh.name + ' shift starts at ' + sh.range.split(' — ')[0] + ' today.'
          : 'Shift completed. Next duty per the roster.';

    // ---- the mockup's time-of-day theme, verbatim ----------------------------
    const theme = h >= 5 && h < 12
      ? { a: 'rgba(255,214,140,.55)', b: 'rgba(120,196,240,.5)', sky: 'linear-gradient(170deg,#3f8fd0 0%,#7bc0e8 34%,#bfe1f2 62%,#ffd9a3 88%,#ffc27a 100%)', wash: 'linear-gradient(140deg,rgba(255,196,120,.22),transparent 60%)' }
      : h >= 12 && h < 17
        ? { a: 'rgba(255,255,255,.5)', b: 'rgba(120,206,240,.5)', sky: 'linear-gradient(170deg,#2f7fc4 0%,#66b4e2 38%,#a9d8ef 70%,#dcf0f8 100%)', wash: 'linear-gradient(140deg,rgba(255,255,255,.16),transparent 60%)' }
        : h >= 17 && h < 20
          ? { a: 'rgba(255,158,110,.5)', b: 'rgba(126,96,210,.5)', sky: 'linear-gradient(170deg,#2a3a78 0%,#7a5a9e 32%,#e08a6a 66%,#ffb27a 86%,#ffd9a3 100%)', wash: 'linear-gradient(140deg,rgba(255,150,110,.2),transparent 62%)' }
          : { a: 'rgba(106,82,212,.42)', b: 'rgba(39,168,219,.28)', sky: 'linear-gradient(170deg,#0a1428 0%,#122448 46%,#1b2f5a 78%,#24406e 100%)', wash: 'linear-gradient(140deg,rgba(88,66,190,.22),rgba(12,26,52,.2) 55%,transparent)' };
    const night = h >= 20 || h < 5;
    const ink = night ? { strong: '#ffffff', soft: '#9fb0c4', muted: '#7d8ea8' } : { strong: '#0c1c34', soft: '#3c4e66', muted: '#5c6f88' };
    const lit = lights == null ? night : lights;

    // sun/moon riding its real daily arc
    const dayFrac = night ? ((h >= 20 ? h - 20 : h + 4) + now.getMinutes() / 60) / 9 : ((h - 5) + now.getMinutes() / 60) / 15;
    const px = Math.min(1, Math.max(0, dayFrac));
    // The arc is clamped to the LEFT HALF of the sky (6%..54%). The mockup let it
    // run to 84%, which carried the disc behind the shift card at certain hours —
    // a moon you cannot see or click is a broken toy. It also gets z-index above
    // the wash/scrim layers so the "click me" target stays crisp, not a smudge.
    const discX = 6 + px * 48, discY = 56 - Math.sin(px * Math.PI) * 38;
    const parS = (fx, fy) => 'transform:translate(' + (par.mx * fx).toFixed(1) + 'px,' + (par.my * fy).toFixed(1) + 'px);transition:transform .5s cubic-bezier(.2,.7,.3,1)';
    const disc = night
      ? 'position:absolute;left:' + discX.toFixed(1) + '%;top:' + discY.toFixed(1) + 'px;width:44px;height:44px;border-radius:50%;background:radial-gradient(circle at 36% 34%,#f4f7ff,#c3cfe6 62%,#9aa8c4);box-shadow:0 0 34px 12px rgba(198,214,255,.28),inset -8px -4px 0 rgba(10,18,36,.35);animation:discGlow 7s ease-in-out infinite'
      : 'position:absolute;left:' + discX.toFixed(1) + '%;top:' + discY.toFixed(1) + 'px;width:58px;height:58px;border-radius:50%;background:radial-gradient(circle at 40% 38%,#fff6d8,#ffd166 52%,#ffa93c);box-shadow:0 0 52px 20px rgba(255,190,90,.4),0 0 120px 50px rgba(255,170,70,.18);animation:discGlow 6s ease-in-out infinite';
    const rays = night ? null : 'position:absolute;inset:-26px;border-radius:50%;background:conic-gradient(from 0deg,rgba(255,214,140,.32) 0 6deg,transparent 6deg 30deg,rgba(255,214,140,.28) 30deg 36deg,transparent 36deg 60deg,rgba(255,214,140,.32) 60deg 66deg,transparent 66deg 90deg,rgba(255,214,140,.28) 90deg 96deg,transparent 96deg 120deg,rgba(255,214,140,.32) 120deg 126deg,transparent 126deg 150deg,rgba(255,214,140,.28) 150deg 156deg,transparent 156deg 180deg,rgba(255,214,140,.32) 180deg 186deg,transparent 186deg 210deg,rgba(255,214,140,.28) 210deg 216deg,transparent 216deg 240deg,rgba(255,214,140,.32) 240deg 246deg,transparent 246deg 270deg,rgba(255,214,140,.28) 270deg 276deg,transparent 276deg 300deg,rgba(255,214,140,.32) 300deg 306deg,transparent 306deg 330deg,rgba(255,214,140,.28) 330deg 336deg,transparent 336deg 360deg);mask:radial-gradient(circle,transparent 30%,#000 34%,transparent 74%);-webkit-mask:radial-gradient(circle,transparent 30%,#000 34%,transparent 74%);animation:rayspin 90s linear infinite;pointer-events:none';
    const moonPhase = ((((now - new Date(2000, 0, 6, 18, 14)) / 86400000) / 29.530588853) % 1 + 1) % 1;
    const illum = 1 - Math.abs(moonPhase - .5) * 2;
    const moonShadow = night ? 'position:absolute;inset:0;border-radius:50%;overflow:hidden;pointer-events:none;background:radial-gradient(circle 22px at ' + (50 - (moonPhase < .5 ? 1 : -1) * illum * 100).toFixed(0) + '% 50%,rgba(12,26,52,.85) 20.5px,transparent 22px);transition:background 1s' : null;
    const cloudTint = night ? 'rgba(160,176,204,.22)' : h >= 17 ? 'rgba(255,214,196,.4)' : 'rgba(255,255,255,.42)';
    const clouds = [{ top: 22, sc: 1, dur: 64, delay: 0 }, { top: 58, sc: .72, dur: 92, delay: -22 }, { top: 12, sc: .55, dur: 120, delay: -48 }];
    const puff = (w, hh, l, b) => 'position:absolute;left:' + l + 'px;bottom:' + b + 'px;width:' + w + 'px;height:' + hh + 'px;border-radius:50%;background:' + cloudTint + ';filter:blur(6px)';
    const stars = night ? Array.from({ length: 16 }, (_, i) => 'position:absolute;left:' + ((i * 37 % 97) + 1) + '%;top:' + ((i * 23 % 46) + 4) + 'px;width:' + (i % 3 === 0 ? 2.5 : 1.8) + 'px;height:' + (i % 3 === 0 ? 2.5 : 1.8) + 'px;border-radius:50%;background:#eaf1ff;opacity:.6;animation:twinkle ' + (2.4 + (i % 5) * .6).toFixed(1) + 's ease-in-out infinite;animation-delay:-' + (i * .37).toFixed(2) + 's') : [];
    const flocks = [{ top: 24, w: 84, hh: 18, dur: 30, delay: 0, op: .5 }, { top: 52, w: 58, hh: 13, dur: 44, delay: -12, op: .38 }, { top: 14, w: 44, hh: 10, dur: 58, delay: -26, op: .3 }, { top: 74, w: 70, hh: 15, dur: 38, delay: -33, op: .32 }];
    const drops = weather === 'Rain' ? Array.from({ length: 46 }, (_, i) => 'position:absolute;top:0;left:' + (i * 53 % 100) + '%;width:1.5px;height:' + (14 + (i % 4) * 4) + 'px;border-radius:2px;background:linear-gradient(180deg,transparent,rgba(210,230,255,.75));rotate:12deg;animation:rainFall ' + (.7 + (i % 5) * .12).toFixed(2) + 's linear -' + (i * .37 % 1.4).toFixed(2) + 's infinite;pointer-events:none') : [];
    const flakes = weather === 'Snow' ? Array.from({ length: 34 }, (_, i) => 'position:absolute;top:0;left:' + (i * 41 % 100) + '%;width:' + (3 + (i % 3) * 1.5) + 'px;height:' + (3 + (i % 3) * 1.5) + 'px;border-radius:50%;background:rgba(255,255,255,.9);filter:blur(' + (i % 3 === 0 ? .8 : 0) + 'px);animation:snowFall ' + (6 + (i % 6)).toFixed(1) + 's linear -' + (i * .9 % 6).toFixed(2) + 's infinite;pointer-events:none') : [];
    const fireflies = night ? Array.from({ length: 12 }, (_, i) => 'position:absolute;left:' + ((i * 29 % 96) + 2) + '%;bottom:' + (18 + (i * 13 % 50)) + 'px;width:4px;height:4px;border-radius:50%;background:#ffe27a;box-shadow:0 0 8px 3px rgba(255,226,122,.55);animation:firefly ' + (4 + (i % 4)).toFixed(1) + 's ease-in-out -' + (i * .7).toFixed(1) + 's infinite;pointer-events:none') : [];
    const rainbow = (!night && weather === 'Rain') ? 'position:absolute;left:18%;bottom:-300px;width:560px;height:560px;border-radius:50%;pointer-events:none;opacity:.42;filter:blur(1.5px);background:radial-gradient(circle,transparent 61%,#d23a52 61.5% 63.5%,#e08a1e 63.5% 65.5%,#ffd166 65.5% 67.5%,#3ddc97 67.5% 69.5%,#27a8db 69.5% 71.5%,#6a52d4 71.5% 73.5%,transparent 74%);animation:riseIn 1.5s ease-out backwards' : null;

    // ---- hero pointer play: parallax, sparkles, ripples, balloons, confetti --
    const heroMove = (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      pm.current = { mx: ((e.clientX - r.left) / r.width - .5) * 2, my: ((e.clientY - r.top) / r.height - .5) * 2 };
      const t = performance.now();
      if (e.target === e.currentTarget && t - ls.current > 70) {
        ls.current = t;
        const id = t + Math.random();
        setSparkles((s) => [...s, { id, x: e.clientX - r.left, y: e.clientY - r.top, s: 6 + Math.random() * 8 }].slice(-24));
        setTimeout(() => setSparkles((s) => s.filter((x) => x.id !== id)), 800);
      }
      if (!raf.current) raf.current = requestAnimationFrame(() => { raf.current = 0; setPar(pm.current); });
    };
    const heroClick = (e) => {
      if (e.target !== e.currentTarget) return;
      const r = e.currentTarget.getBoundingClientRect();
      const id = Date.now() + Math.random();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      setRipples((s) => [...s, { id, x, y }]);
      setTimeout(() => setRipples((s) => s.filter((q) => q.id !== id)), 900);
      const colors = ['#d23a52', '#27a8db', '#3ab5a7', '#e08a1e', '#6a52d4', '#ffd166'];
      setBalloonsUp((s) => [...s, { id, x, y, color: colors[Math.floor(Math.random() * colors.length)] }]);
      setTimeout(() => setBalloonsUp((s) => s.filter((q) => q.id !== id)), 9000);
    };
    const celebrate = (e) => {
      e.stopPropagation();
      const r = e.currentTarget.getBoundingClientRect(), hb = e.currentTarget.parentElement.getBoundingClientRect();
      const cx = r.left - hb.left + r.width / 2, cy = r.top - hb.top + r.height / 2;
      const colors = ['#d23a52', '#27a8db', '#3ab5a7', '#e08a1e', '#6a52d4', '#ffd166', '#3ddc97'];
      const batch = Date.now();
      const pieces = Array.from({ length: 26 }, (_, i) => ({ id: batch + i / 100, x: cx, y: cy, a: i * (360 / 26) + Math.random() * 10, sc: .6 + Math.random() * .9, c: colors[i % colors.length], w: 5 + Math.random() * 5 }));
      setBursts((s) => [...s, ...pieces]);
      setTimeout(() => setBursts((s) => s.filter((x) => Math.floor(x.id) !== batch)), 1000);
    };
    const cycleWeather = (e) => { e.stopPropagation(); const o = ['Clear', 'Rain', 'Snow']; setWeather((w) => o[(o.indexOf(w) + 1) % 3]); };

    // ---- week strip from the real roster row ---------------------------------
    const week = useMemo(() => {
      const d0 = new Date(now); d0.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(d0); d.setDate(d0.getDate() + i);
        const inMonth = roster && +roster.year === d.getFullYear() && +roster.month === (d.getMonth() + 1);
        const code = (inMonth && myRow) ? myRow[d.getDate()] : null;
        const info = codeInfo(code);
        const off = !code || (info && info.bucket === 'O');
        return { full: d, dow: d.toLocaleDateString('en-GB', { weekday: 'short' }), date: pad(d.getDate()), code, info, off, today: d.toDateString() === now.toDateString() };
      });
    }, [roster, myRow, now.toDateString()]);  // eslint-disable-line react-hooks/exhaustive-deps
    const sel = selDay != null ? selDay : (now.getDay() + 6) % 7;
    const sd = week[sel];

    // ---- announcements derived from real events ------------------------------
    const anns = useMemo(() => {
      const out = [];
      if (roster && roster.deptName) {
        out.push({ title: 'Roster published — ' + roster.deptName, body: 'The ' + roster.deptName + ' duty roster for ' + pad(roster.month) + '/' + roster.year + ' is live' + (roster.status ? ' (' + roster.status + ')' : '') + '. Open Duty Roster to see your month.' });
      }
      (certs || []).forEach((c) => {
        if (!c.expiry) return;
        const d = new Date(c.expiry), days = Math.round((d - now) / 86400000);
        if (days > 0 && days <= 90) out.push({ title: (c.name || 'Certification') + ' expiring', body: 'Expires ' + c.expiry + ' (' + days + ' days). Arrange renewal through your supervisor.' });
      });
      if (!out.length) out.push({ title: 'No announcements yet', body: 'This space carries Nursing Services notices — roster publications and certification reminders appear here on their own.' });
      return out;
    }, [roster, certs, now.toDateString()]);  // eslint-disable-line react-hooks/exhaustive-deps
    const ai = annPinned != null ? Math.min(annPinned, anns.length - 1) : Math.floor(now.getTime() / 7000) % anns.length;

    // ---- team on my shift, from the same roster ------------------------------
    const team = useMemo(() => {
      if (!roster || !roster.grid || !todayCode) return [];
      const rows = roster.names || roster.rows || [];
      const staffList = (typeof window !== 'undefined' && window.STAFF_SEED) || [];
      return rows.filter((r) => {
        const g = roster.grid[String(r.id)] || roster.grid[String(r.empId)] || roster.grid[String(r.emp_id)] || {};
        return g[now.getDate()] === todayCode;
      }).slice(0, 6).map((r, i) => {
        const nm = r.name || r.staffName || String(r.empId || r.emp_id || r.id);
        const st = staffList.find((s) => s.name === nm || String(s.emp_id) === String(r.empId || r.emp_id));
        return { name: nm, role: (st && st.designation) || r.designation || 'Staff', c: TEAM_COLORS[i % TEAM_COLORS.length] };
      });
    }, [roster, todayCode, now.toDateString()]);  // eslint-disable-line react-hooks/exhaustive-deps
    const tp = team[Math.min(teamSel, Math.max(0, team.length - 1))] || null;

    // ---- off days from the roster (the honest twin of "leave balance") -------
    const offStats = useMemo(() => {
      if (!myRow || !roster) return null;
      const daysIn = new Date(roster.year, roster.month, 0).getDate();
      let total = 0, taken = 0;
      for (let d = 1; d <= daysIn; d++) {
        const inf = codeInfo(myRow[d]);
        if (inf && inf.bucket === 'O') { total++; if (+roster.month === now.getMonth() + 1 && d <= now.getDate()) taken++; }
      }
      return { total, taken, left: total - taken };
    }, [myRow, roster, now.toDateString()]);  // eslint-disable-line react-hooks/exhaustive-deps

    // ---- my records ----------------------------------------------------------
    const records = useMemo(() => {
      const out = (certs || []).filter((c) => me && (String(c.staffId) === String(me.id) || String(c.empId) === String(me.emp_id)))
        .map((c) => {
          const exp = c.expiry ? new Date(c.expiry) : null;
          const expired = exp && exp < now, soon = exp && !expired && (exp - now) / 86400000 <= 90;
          return {
            label: c.name || c.title || 'Certification',
            meta: c.expiry ? ((expired ? 'Expired ' : 'Expires ') + c.expiry) : (c.issued ? 'Issued ' + c.issued : 'No date recorded'),
            tag: expired ? 'Expired' : soon ? 'Renew soon' : 'Valid',
            tagStyle: expired ? tag('#b2263e', 'rgba(210,58,82,.14)') : soon ? tag('#b06a10', 'rgba(224,138,30,.16)') : tag('#0f7a5f', 'rgba(61,220,151,.2)'),
            dotC: expired ? '#d23a52' : soon ? '#e08a1e' : '#3ddc97',
            detail: [c.issuer && ('Issued by ' + c.issuer), c.issued && ('Issued ' + c.issued), c.note].filter(Boolean).join(' · ') || 'Recorded on the staff register.',
          };
        });
      if (me && me.hepatitis_b_vaccination) {
        const done = /^completed$/i.test(String(me.hepatitis_b_vaccination).trim());
        out.push({ label: 'Hepatitis B vaccination', meta: String(me.hepatitis_b_vaccination), tag: done ? 'Complete' : 'Incomplete', tagStyle: done ? tag('#0f7a5f', 'rgba(61,220,151,.2)') : tag('#b06a10', 'rgba(224,138,30,.16)'), dotC: done ? '#3ddc97' : '#e08a1e', detail: 'From the staff register. Ask Nursing Services to correct this if it is out of date.' });
      }
      return out;
    }, [certs, me, now.toDateString()]);  // eslint-disable-line react-hooks/exhaustive-deps

    const dayKey = now.toDateString();
    const mood = moodSt[dayKey] && moodSt[dayKey].label;
    const moodAt = moodSt[dayKey] && moodSt[dayKey].at;
    const pickMood = (label) => setMoodSt((s) => { const n = Object.assign({}, s, { [dayKey]: { label, at: Date.now() } }); lsSet(KEY_MOOD, n); return n; });

    // ---- computed style strings, verbatim from the mockup script -------------
    const shiftCard = 'position:relative;flex:1 1 300px;min-width:0;max-width:400px;margin-left:auto;padding:13px 15px;border-radius:14px;overflow:hidden;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid ' + (night ? 'rgba(122,196,232,.4)' : 'rgba(255,255,255,.85)') + ';background:' + (night ? 'linear-gradient(120deg,' + ((sh && sh.accent) || '#27a8db') + '44,rgba(255,255,255,.06),' + ((sh && sh.accent) || '#27a8db') + '44) 0 0/220% 100%' : 'linear-gradient(120deg,rgba(255,255,255,.78),rgba(255,255,255,.6),rgba(255,255,255,.78)) 0 0/220% 100%') + ';animation:shiftSweep 7s linear infinite;box-shadow:0 10px 28px rgba(12,28,52,' + (night ? '.22' : '.14') + ')';
    const miniLabel = 'font-size:9.5px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:' + ink.muted;
    const rangeStyle = "font-size:10.5px;font-family:'IBM Plex Mono',monospace;color:" + ink.soft;
    const factChip = (i) => 'min-width:126px;flex:1 1 120px;padding:9px 12px;border-radius:11px;cursor:default;border:1px solid ' + (night ? 'rgba(255,255,255,.14)' : 'rgba(12,28,52,.12)') + ';background:' + (night ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,.55)') + ';backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);animation:riseIn .6s cubic-bezier(.2,.7,.3,1) ' + (.15 + i * .08).toFixed(2) + 's backwards';
    const idFacts = [
      { label: 'Staff ID', value: staffId },
      { label: 'Date of joining', value: (me && me.doj) || 'Not recorded' },
      { label: 'Role', value: designation || (!u ? 'Local session' : (u.role === 'incharge' ? 'In-charge' : (u.role === 'collector' ? 'Data Collector' : (u.role || 'Staff')))) },
      { label: 'Department', value: unit },
    ];
    const nextOff = week.find((w) => w.off && w.code && w.full >= now);
    const duty = [
      { label: 'Assigned shift', value: sh ? sh.name : 'None', note: sh ? sh.range : 'Nothing rostered today' },
      { label: 'Ward', value: unit, note: (roster && roster.deptName) || 'From your staff record' },
      { label: 'Next off day', value: nextOff ? nextOff.dow + ' ' + nextOff.date : '—', note: nextOff ? 'From this week’s roster' : 'None in the next 7 days' },
      { label: 'Off days', value: offStats ? offStats.left + ' left' : '—', note: offStats ? offStats.taken + ' taken of ' + offStats.total + ' this month' : 'Needs a published roster' },
    ];

    return (
      <div className="unico-home" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <style>{KEYFRAMES}</style>

        {/* =========================== HERO =========================== */}
        <div onMouseMove={heroMove} onMouseLeave={() => setPar({ mx: 0, my: 0 })} onClick={heroClick}
          style={sx('position:relative;overflow:hidden;border-radius:18px;padding:20px 22px 88px;display:flex;align-items:center;gap:18px;flex-wrap:wrap;min-height:236px;box-shadow:0 18px 48px rgba(12,28,52,.25)')}>
          <div style={sx('position:absolute;inset:0;pointer-events:none;transition:background 1.2s ease;background:' + theme.sky)} />
          <div style={fs('position:absolute;top:-100px;right:6%;width:280px;height:250px;border-radius:50%;pointer-events:none;filter:blur(26px);background:radial-gradient(circle,' + theme.a + ',transparent 70%);animation:orbFloat 16s ease-in-out infinite alternate')} />
          <div style={fs('position:absolute;bottom:-120px;left:32%;width:300px;height:250px;border-radius:50%;pointer-events:none;filter:blur(30px);background:radial-gradient(circle,' + theme.b + ',transparent 70%);animation:orbFloat 21s ease-in-out infinite alternate-reverse')} />

          {stars.map((st, i) => <span key={'s' + i} aria-hidden="true" style={fs(st)} />)}
          {night && <span aria-hidden="true" style={fs('position:absolute;top:8px;left:0;width:3px;height:3px;border-radius:50%;background:#cfe0f0;opacity:.8;animation:satellite 26s linear infinite;pointer-events:none')} />}
          {night && <span aria-hidden="true" style={fs('position:absolute;top:16%;right:6%;width:78px;height:1.5px;border-radius:2px;background:linear-gradient(270deg,transparent,#fff);animation:shoot 14s linear infinite;pointer-events:none')} />}

          {/* sun / moon — click to change the weather */}
          <div onClick={cycleWeather} title="Click to change the weather"
            style={Object.assign(fs(disc), sx('pointer-events:auto;cursor:pointer;z-index:3;' + parS(-10, -6)))}>
            {rays && <span style={fs(rays)} />}
            {moonShadow && <span style={fs(moonShadow)} />}
          </div>

          <div aria-hidden="true" style={sx('position:absolute;inset:0;pointer-events:none;' + parS(18, 8))}>
            {clouds.map((c, i) => (
              <span key={'c' + i} style={fs('position:absolute;top:' + c.top + 'px;left:0;width:120px;height:34px;transform-origin:left center;scale:' + c.sc + ';opacity:' + (night ? .5 : .85) + ';animation:cloudDrift ' + c.dur + 's linear infinite;animation-delay:' + c.delay + 's')}>
                <span style={sx(puff(72, 26, 0, 0))} /><span style={sx(puff(52, 40, 30, 6))} /><span style={sx(puff(58, 24, 60, 0))} />
              </span>
            ))}
          </div>

          {!night && (
            <div aria-hidden="true" style={sx('position:absolute;inset:0;pointer-events:none;' + parS(28, 12))}>
              {flocks.map((b, i) => (
                <svg key={'f' + i} viewBox="0 0 140 30" width={b.w} height={b.hh} style={fs('position:absolute;top:' + b.top + 'px;left:0;opacity:' + b.op + ';animation:birdFly ' + b.dur + 's linear infinite;animation-delay:' + b.delay + 's;pointer-events:none')} fill="none" stroke="#12233c" strokeWidth="2.4" strokeLinecap="round"><path d="M6 16c5-7 10-7 15 0M34 9c5-7 10-7 15 0M58 20c5-7 10-7 15 0M86 12c5-7 10-7 15 0" /></svg>
              ))}
            </div>
          )}

          <div aria-hidden="true" style={fs('position:absolute;top:' + (night ? 34 : 18) + 'px;left:0;width:190px;height:14px;opacity:' + (night ? .5 : .9) + ';animation:planeFly 22s linear infinite;pointer-events:none')}>
            <div style={fs('position:absolute;right:26px;top:7px;width:150px;height:3px;border-radius:2px;background:linear-gradient(270deg,rgba(255,255,255,.85),transparent);filter:blur(1.4px);animation:trailFade 22s linear infinite')} />
            <svg viewBox="0 0 64 24" width="34" height="13" style={sx('position:absolute;right:0;top:0;filter:drop-shadow(0 1px 2px rgba(10,20,40,.35))')} fill="#eef4fb"><path d="M63 12l-9 3H36l-9 8h-5l3-8H14l-5 5H5l3-5H2v-6h6L5 4h4l5 5h11l-3-8h5l9 8h18z" /></svg>
          </div>

          <div aria-hidden="true" style={fs('position:absolute;bottom:56px;left:14%;width:16px;animation:rocketRise 17s ease-in ' + (night ? '2s' : '6s') + ' infinite;pointer-events:none')}>
            <svg viewBox="0 0 24 60" width="15" height="38" style={sx('display:block;filter:drop-shadow(0 0 8px rgba(255,170,90,.6))')}>
              <path d="M12 0c6 10 8 20 8 30l-4 12H8L4 30C4 20 6 10 12 0z" fill="#e8eef7" /><path d="M12 0c3 10 4 20 4 30l-2 12h-4z" fill="#ffffff" opacity=".55" /><circle cx="12" cy="20" r="3.4" fill="#27a8db" /><path d="M4 30L0 44l6-4zM20 30l4 14-6-4z" fill="#d23a52" />
            </svg>
            <div style={fs('width:9px;height:26px;margin:-2px auto 0;border-radius:0 0 50% 50%;background:linear-gradient(180deg,#ffd166,#ff7a3c,transparent);filter:blur(2px);transform-origin:top center;animation:flameFlicker .35s linear infinite')} />
          </div>

          {!night && (
            <div aria-hidden="true" style={sx('position:absolute;right:20%;top:22px;width:80px;height:150px;pointer-events:none;opacity:.9')}>
              <svg viewBox="0 0 80 150" width="80" height="150" style={sx('display:block;overflow:visible')}>
                <path d="M40 34c-8 30-22 60-30 116" stroke="rgba(40,60,90,.55)" strokeWidth="1" fill="none" />
                <g style={fs('transform-origin:40px 18px;animation:kiteBob 4s ease-in-out infinite')}>
                  <path d="M40 0l16 18-16 22-16-22z" fill="#d23a52" /><path d="M40 0v40M24 18h32" stroke="rgba(255,255,255,.6)" strokeWidth="1.2" /><path d="M40 40q-6 8 0 16q6 8 0 16" stroke="#e08a1e" strokeWidth="2" fill="none" />
                </g>
              </svg>
            </div>
          )}

          {weather === 'Rain' && (
            <React.Fragment>
              <div aria-hidden="true" style={sx('position:absolute;inset:0;background:rgba(60,80,110,.28);pointer-events:none')} />
              {drops.map((d, i) => <span key={'d' + i} aria-hidden="true" style={fs(d)} />)}
              <div aria-hidden="true" style={fs('position:absolute;inset:0;background:#fff;pointer-events:none;animation:flash 11s linear infinite')} />
              {rainbow && <div aria-hidden="true" style={fs(rainbow)} />}
            </React.Fragment>
          )}
          {weather === 'Snow' && flakes.map((f, i) => <span key={'sn' + i} aria-hidden="true" style={fs(f)} />)}
          {fireflies.map((f, i) => <span key={'ff' + i} aria-hidden="true" style={fs(f)} />)}

          {/* the village — click to toggle the window lights */}
          <svg onClick={(e) => { e.stopPropagation(); setLights((v) => !(v == null ? night : v)); }} viewBox="0 0 1200 200" preserveAspectRatio="none"
            style={sx('position:absolute;left:-12px;right:-12px;bottom:0;width:calc(100% + 24px);height:74px;opacity:' + (night ? .95 : .8) + ';pointer-events:auto;cursor:pointer;' + parS(-8, 2))}>
            <g style={fs('animation:trainRun 36s linear 6s infinite')}>
              <g fill="#040a16" opacity=".92"><rect x="0" y="176" width="70" height="20" rx="3" /><rect x="8" y="166" width="30" height="12" rx="2" /><rect x="76" y="178" width="60" height="18" rx="2" /><rect x="142" y="178" width="60" height="18" rx="2" /><rect x="208" y="178" width="60" height="18" rx="2" /></g>
              <g style={sx('opacity:' + (lit ? 1 : 0) + ';transition:opacity 1.2s ease')} fill="#ffd98a"><rect x="14" y="169" width="7" height="6" /><rect x="82" y="182" width="8" height="6" /><rect x="98" y="182" width="8" height="6" /><rect x="114" y="182" width="8" height="6" /><rect x="148" y="182" width="8" height="6" /><rect x="164" y="182" width="8" height="6" /><rect x="180" y="182" width="8" height="6" /><rect x="214" y="182" width="8" height="6" /><rect x="230" y="182" width="8" height="6" /><rect x="246" y="182" width="8" height="6" /></g>
              <circle cx="60" cy="170" r="3" fill="#ffe9a8" />
            </g>
            <path d="M0 150c120-26 210 10 330-6s200-40 320-24 260 44 380 22 170-14 170-14V200H0z" fill="#050d1c" opacity=".55" />
            <path d="M0 200v-28h120l14-16 14 16h52v-34h26v-14l22-16 22 16v14h26v34h74l16-20 16 20h58v-46h30l24-18 24 18h30v46h96l14-18 14 18h64v-30h96v30h108l18-22 18 22h100v28z" fill="#040a16" opacity=".9" />
            <path d="M470 172v-52h8v52zM474 118l-16 10 16 6 16-6z" fill="#040a16" opacity=".9" />
            <g fill="#040a16" opacity=".9"><ellipse cx="700" cy="158" rx="26" ry="30" /><rect x="697" y="158" width="6" height="42" /><ellipse cx="1010" cy="164" rx="22" ry="26" /><rect x="1007" y="164" width="6" height="36" /></g>
            <g fill="#040a16" opacity=".9">
              <path d="M872 200l4-72h8l4 72z" />
              <g style={fs('transform-origin:880px 126px;animation:rayspin 7s linear infinite')}><path d="M880 126l-3-40h6zM880 126l36 18-3 5zM880 126l-36 18 3 5z" /><circle cx="880" cy="126" r="4" /></g>
            </g>
            <g fill="none" stroke="#061020" strokeWidth="3" strokeLinecap="round" opacity=".9">
              <g style={fs('transform-origin:60px 200px;animation:grassSway 3.2s ease-in-out infinite')}><path d="M50 200q2-12 8-20M62 200q0-14 4-24M74 200q-2-12-8-18" /></g>
              <g style={fs('transform-origin:330px 200px;animation:grassSway 2.8s ease-in-out -1s infinite')}><path d="M320 200q2-12 8-20M332 200q0-14 4-24M344 200q-2-12-8-18" /></g>
              <g style={fs('transform-origin:620px 200px;animation:grassSway 3.6s ease-in-out -2s infinite')}><path d="M610 200q2-12 8-20M622 200q0-14 4-24M634 200q-2-12-8-18" /></g>
              <g style={fs('transform-origin:1130px 200px;animation:grassSway 3s ease-in-out -.5s infinite')}><path d="M1120 200q2-12 8-20M1132 200q0-14 4-24M1144 200q-2-12-8-18" /></g>
            </g>
            <g style={sx('opacity:' + (lit ? 1 : 0) + ';transition:opacity 1.2s ease')} fill="#ffd98a">
              <rect x="128" y="180" width="7" height="8" /><rect x="212" y="150" width="7" height="9" /><rect x="232" y="150" width="7" height="9" style={fs('animation:winFlick 6s linear infinite')} /><rect x="252" y="150" width="7" height="9" />
              <rect x="378" y="180" width="7" height="8" style={fs('animation:winFlick 9s linear 2s infinite')} /><rect x="443" y="180" width="7" height="8" /><rect x="480" y="140" width="7" height="9" /><rect x="520" y="140" width="7" height="9" /><rect x="546" y="140" width="7" height="9" style={fs('animation:winFlick 7s linear 1s infinite')} />
              <rect x="672" y="180" width="7" height="8" /><rect x="770" y="152" width="7" height="9" /><rect x="800" y="152" width="7" height="9" style={fs('animation:winFlick 11s linear 4s infinite')} /><rect x="830" y="152" width="7" height="9" /><rect x="972" y="180" width="7" height="8" />
            </g>
          </svg>
          <div aria-hidden="true" style={sx('position:absolute;left:23.5%;bottom:22px;width:10px;height:10px;pointer-events:none')}>
            {[0, 1.3, 2.6].map((d) => <span key={d} style={fs('position:absolute;inset:0;border-radius:50%;background:rgba(220,228,240,.55);filter:blur(2px);animation:smoke 4s ease-out ' + d + 's infinite')} />)}
          </div>

          {ripples.map((r) => <span key={r.id} aria-hidden="true" style={fs('position:absolute;left:' + (r.x - 60) + 'px;top:' + (r.y - 60) + 'px;width:120px;height:120px;border-radius:50%;border:2px solid ' + (night ? 'rgba(255,255,255,.7)' : 'rgba(0,114,163,.6)') + ';pointer-events:none;animation:ripple .9s ease-out forwards')} />)}
          {sparkles.map((s) => <span key={s.id} aria-hidden="true" style={fs('position:absolute;left:' + (s.x - s.s / 2) + 'px;top:' + (s.y - s.s / 2) + 'px;width:' + s.s + 'px;height:' + s.s + 'px;background:' + (night ? '#fff' : '#ffd166') + ';clip-path:polygon(50% 0,62% 38%,100% 50%,62% 62%,50% 100%,38% 62%,0 50%,38% 38%);pointer-events:none;animation:sparkle .8s ease-out forwards;filter:drop-shadow(0 0 4px rgba(255,220,140,.8))')} />)}
          {bursts.map((b) => <span key={b.id} aria-hidden="true" style={sx('position:absolute;left:' + b.x + 'px;top:' + b.y + 'px;rotate:' + b.a + 'deg;scale:' + b.sc + ';pointer-events:none')}><span style={fs('display:block;width:' + b.w + 'px;height:' + (b.w * .6) + 'px;border-radius:2px;background:' + b.c + ';animation:burst .9s cubic-bezier(.1,.7,.3,1) forwards')} /></span>)}
          {balloonsUp.map((b) => (
            <div key={b.id} aria-hidden="true" style={fs('position:absolute;left:' + (b.x - 13) + 'px;top:' + (b.y - 30) + 'px;pointer-events:none;animation:balloonUp 9s cubic-bezier(.3,.6,.4,1) forwards')}>
              <svg viewBox="0 0 24 40" width="26" height="42" style={fs('display:block;animation:sway 2.4s ease-in-out infinite;filter:drop-shadow(0 3px 6px rgba(10,20,40,.3))')}>
                <ellipse cx="12" cy="13" rx="10" ry="12" fill={b.color} /><ellipse cx="8.5" cy="9" rx="3" ry="4.5" fill="#fff" opacity=".35" /><path d="M10 25l2 3 2-3z" fill={b.color} /><path d="M12 28c-3 4 3 6 0 11" stroke="#5a6b84" strokeWidth="1" fill="none" />
              </svg>
            </div>
          ))}

          <div aria-hidden="true" style={fs('position:absolute;inset:0;pointer-events:none;background:linear-gradient(100deg,transparent 30%,rgba(255,255,255,.07) 50%,transparent 70%) 0 0/240% 100%;animation:shiftSweep 9s linear infinite')} />
          <div aria-hidden="true" style={sx(night ? 'position:absolute;inset:0;pointer-events:none;background:linear-gradient(100deg,rgba(6,16,34,.25),rgba(6,16,34,.1) 60%,transparent)' : 'position:absolute;inset:0;pointer-events:none;background:linear-gradient(100deg,rgba(255,255,255,.5),rgba(255,255,255,.22) 55%,rgba(255,255,255,.06))')} />
          <div aria-hidden="true" style={sx('position:absolute;inset:0;pointer-events:none;transition:background 1.2s ease;background:' + theme.wash)} />

          {/* avatar in the shift-progress ring — click for confetti */}
          <div onClick={celebrate} title="Shift progress · click me"
            style={fs('position:relative;width:74px;height:74px;padding:4px;border-radius:20px;flex-shrink:0;display:grid;place-items:center;background:conic-gradient(#3ddc97 ' + pct.toFixed(1) + '%,' + (night ? 'rgba(255,255,255,.18)' : 'rgba(12,28,52,.14)') + ' 0);' + (on ? 'animation:ringGlow 3s ease-in-out infinite;' : '') + 'transition:background .8s,transform .25s;cursor:pointer')}>
            <div style={sx('width:66px;height:66px;border-radius:16px;background:linear-gradient(135deg,#3ab5a7,#0090ca);color:#fff;display:grid;place-items:center;font-weight:800;font-size:23px;overflow:hidden')}>
              {u && u.photo && u.photo.url ? <img src={u.photo.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
            </div>
          </div>
          <div style={sx('position:relative;min-width:0;flex:1 1 200px')}>
            {/* The greeting IS the headline — a person is welcomed first, filed second. */}
            <div style={fs('font-size:34px;font-weight:800;letter-spacing:-.8px;line-height:1.1;color:' + ink.strong + ';animation:textGlow 4s ease-in-out infinite')}>
              {greeting} <span style={sx('font-size:30px;letter-spacing:0')}>{greetEmoji}</span>
            </div>
            <div style={sx('font-size:16px;font-weight:700;letter-spacing:-.2px;margin-top:6px;color:' + (night ? '#cfe0f0' : '#12385c'))}>{staffName}</div>
            <div style={sx('font-size:12.5px;margin-top:2px;color:' + ink.soft)}>{designation} · {unit}</div>
          </div>

          {/* the shift card */}
          <div style={fs(shiftCard)}>
            {sh ? (
              <React.Fragment>
                <div style={sx('display:flex;align-items:center;gap:9px')}>
                  <span style={fs('width:9px;height:9px;border-radius:50%;flex-shrink:0;background:' + (on ? '#3ddc97' : sh.accent) + ';' + (on ? 'animation:livepulse 2.4s infinite' : ''))} />
                  <span style={sx('font-size:13.5px;font-weight:700;letter-spacing:.2px;color:' + ink.strong)}>{sh.name} shift</span>
                  <span style={sx(on ? tag('#0b3a2c', 'rgba(61,220,151,.85)') : tag(night ? '#cfe0f0' : '#2b3d55', night ? 'rgba(255,255,255,.14)' : 'rgba(12,28,52,.1)'))}>{on ? 'On duty' : before ? 'Upcoming' : 'Completed'}</span>
                  <span style={{ flex: 1 }} />
                  <span style={sx(rangeStyle)}>{sh.range}</span>
                </div>
                <div style={sx('display:flex;align-items:flex-end;gap:14px;flex-wrap:wrap;margin-top:11px')}>
                  <div>
                    <div style={sx(miniLabel)}>{on ? 'Time left on shift' : before ? 'Starts in' : 'Next shift in'}</div>
                    <div style={sx("font-family:'IBM Plex Mono',monospace;font-size:27px;font-weight:700;letter-spacing:1px;line-height:1.1;margin-top:2px;color:" + ink.strong)}>{hms(remain)}</div>
                  </div>
                  <div style={sx('margin-left:auto;text-align:right')}>
                    <div style={sx(miniLabel)}>Now</div>
                    <div style={fs("font-family:'IBM Plex Mono',monospace;font-size:15px;font-weight:700;letter-spacing:.6px;margin-top:3px;color:" + ink.strong + ';animation:tick 1s ease-in-out infinite alternate')}>{clock}</div>
                    <div style={sx(rangeStyle)}>{dateLine}</div>
                  </div>
                </div>
                <div style={sx('position:relative;height:6px;border-radius:4px;overflow:hidden;margin-top:11px;background:' + (night ? 'rgba(255,255,255,.12)' : 'rgba(12,28,52,.16)'))}>
                  <div style={sx('height:100%;border-radius:4px;width:' + pct.toFixed(2) + '%;background:linear-gradient(90deg,' + sh.accent + ',' + sh.accent2 + ');transition:width 1s linear')} />
                  <div style={fs('position:absolute;top:0;bottom:0;left:0;width:30%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.6),transparent);animation:barShine 2.8s ease-in-out infinite;pointer-events:none')} />
                </div>
                <div style={sx('font-size:11px;margin-top:8px;color:' + ink.soft)}>{shiftNote}</div>
              </React.Fragment>
            ) : (
              <React.Fragment>
                <div style={sx('display:flex;align-items:center;gap:9px')}>
                  <span style={sx('width:9px;height:9px;border-radius:50%;flex-shrink:0;background:#9fb0c4')} />
                  <span style={sx('font-size:13.5px;font-weight:700;color:' + ink.strong)}>No shift today</span>
                  <span style={{ flex: 1 }} />
                  <span style={sx(rangeStyle)}>{dateLine}</span>
                </div>
                <div style={fs("font-family:'IBM Plex Mono',monospace;font-size:27px;font-weight:700;letter-spacing:1px;margin-top:10px;color:" + ink.strong + ';animation:tick 1s ease-in-out infinite alternate')}>{clock}</div>
                <div style={sx('font-size:11px;margin-top:8px;color:' + ink.soft)}>{shiftNote}</div>
              </React.Fragment>
            )}
          </div>

          {/* ID facts */}
          <div style={sx('position:relative;display:flex;flex-wrap:wrap;gap:10px;flex:1 1 100%')}>
            {idFacts.map((f, i) => (
              <div key={f.label} style={fs(factChip(i))}>
                <div style={sx('font-size:9.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:' + ink.muted)}>{f.label}</div>
                <div style={sx("font-size:13.5px;font-weight:700;margin-top:3px;font-family:'IBM Plex Mono',monospace;color:" + ink.strong)}>{f.value}</div>
              </div>
            ))}
          </div>
          <div aria-hidden="true" style={sx('position:absolute;right:16px;bottom:9px;font-size:9.5px;letter-spacing:.6px;text-transform:uppercase;font-weight:600;color:' + (night ? 'rgba(199,210,224,.55)' : 'rgba(12,28,52,.45)') + ';pointer-events:none')}>Click the sky · the sun changes the weather</div>
        </div>

        {/* ====================== HOW ARE YOU FEELING ====================== */}
        <div style={Object.assign(sx(GLASS), { padding: '14px 16px' })}>
          <div style={sx('display:flex;align-items:center;gap:8px')}>
            <div style={sx('font-size:10.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#7d8ea8')}>How are you feeling?</div>
            <span style={{ flex: 1 }} />
            <span style={sx("font-size:10.5px;color:#9aa6b4;font-family:'IBM Plex Mono',monospace")}>{mood ? 'Logged ' + to12(pad(new Date(moodAt).getHours()) + ':' + pad(new Date(moodAt).getMinutes())) + ' · this device only' : 'Private to you'}</span>
          </div>
          <div style={sx('display:flex;gap:8px;margin-top:10px;flex-wrap:wrap')}>
            {MOOD_DEFS.map((m) => (
              <button key={m.label} type="button" onClick={() => pickMood(m.label)} title={m.label}
                style={fs('flex:1;min-width:88px;display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 4px;border-radius:12px;cursor:pointer;font-family:inherit;transition:transform .25s cubic-bezier(.2,.7,.3,1),border-color .25s;border:1px solid ' + (mood === m.label ? m.c : 'rgba(125,145,180,.22)') + ';background:' + (mood === m.label ? '#fff' : 'rgba(255,255,255,.55)') + ';color:' + (mood === m.label ? m.c : '#7d8ea8') + ';' + (mood === m.label ? 'animation:checkPop .4s cubic-bezier(.2,.7,.3,1);box-shadow:0 10px 22px rgba(31,59,90,.14)' : ''))}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="9.5" /><path d={m.mouth} /><path d="M8.5 9.5h.01M15.5 9.5h.01" strokeWidth="2.4" /></svg>
                <span style={sx('font-size:9.5px;font-weight:700;letter-spacing:.3px')}>{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:16px;align-items:start')}>
          {/* --------------------------- left --------------------------- */}
          <div style={sx('display:flex;flex-direction:column;gap:16px;min-width:0')}>
            <Soon live={LIVE.thisWeek} label="Unlocks when the Duty Roster module is rolled out to your ward.">
            <div style={sx(GLASS)}>
              {cardH('This week', <span style={sx('font-size:11px;color:#9aa6b4')}>Click a day</span>)}
              <div style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(58px,1fr));gap:8px')}>
                {week.map((w, i) => {
                  const isSel = i === sel;
                  return (
                    <button key={i} type="button" onClick={() => setSelDay(i)}
                      style={sx('display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 4px;border-radius:12px;cursor:pointer;font-family:inherit;transition:transform .25s cubic-bezier(.2,.7,.3,1),box-shadow .25s;border:1px solid ' + (isSel ? 'rgba(0,144,202,.5)' : w.today ? 'rgba(58,181,167,.5)' : 'rgba(125,145,180,.22)') + ';background:' + (isSel ? 'linear-gradient(135deg,#27a8db,#0072a3)' : 'rgba(255,255,255,.62)') + ';color:' + (isSel ? '#fff' : w.off ? '#9aa6b4' : '#16202e') + ';box-shadow:' + (isSel ? '0 10px 24px rgba(0,144,202,.35)' : 'none'))}>
                      <span style={sx('font-size:9.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase;opacity:.75')}>{w.dow}</span>
                      <span style={sx("font-size:19px;font-weight:800;font-family:'IBM Plex Mono',monospace;line-height:1.1")}>{w.date}</span>
                      <span style={sx('font-size:9px;font-weight:700;letter-spacing:.4px;padding:2px 7px;border-radius:10px;background:' + (isSel ? 'rgba(255,255,255,.22)' : w.off ? 'rgba(125,145,180,.14)' : 'rgba(0,144,202,.12)') + ';color:' + (isSel ? '#fff' : w.off ? '#8894a6' : '#0072a3'))}>{w.code || (w.off ? 'Off' : '—')}</span>
                    </button>
                  );
                })}
              </div>
              <div key={sel} style={fs('display:flex;align-items:center;gap:12px;margin-top:12px;padding:11px 13px;border-radius:12px;border:1px solid rgba(125,145,180,.22);background:rgba(255,255,255,.62);animation:fadeSwap .3s ease')}>
                <span style={sx('width:10px;height:10px;border-radius:50%;flex-shrink:0;background:' + (sd && sd.off ? '#b6c0cc' : '#27a8db'))} />
                <div style={sx('flex:1;min-width:0')}>
                  <div style={sx('font-size:13px;font-weight:700;color:#16202e')}>
                    {sd ? sd.full.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short' }) + (sd.code ? (sd.off ? ' · Off' : ' · ' + sd.code) : ' · Nothing rostered') : ''}
                  </div>
                  <div style={sx('font-size:11.5px;color:#6c7a8c;margin-top:1px')}>
                    {sd && sd.info && sd.info.label ? sd.info.label + ' · ' + unit : sd && sd.off && sd.code ? 'No duty scheduled. Enjoy your rest day.' : 'Not on the published roster for this day.'}
                  </div>
                </div>
                <button type="button" title="Opens the Duty Roster module" onClick={() => setRoute && setRoute({ view: 'rosterHome' })}
                  style={sx('font-family:inherit;font-size:11.5px;font-weight:700;padding:7px 12px;border-radius:9px;cursor:pointer;border:1px solid rgba(0,144,202,.35);background:rgba(255,255,255,.7);color:#0072a3;white-space:nowrap')}>Request swap</button>
              </div>
            </div>

            </Soon>

            <Soon live={LIVE.dutyToday} label="Unlocks with the Duty Roster rollout.">
            <div style={sx(GLASS)}>
              {cardH('My duty today', <span style={sx("font-size:11px;color:#9aa6b4;font-family:'IBM Plex Mono',monospace")}>{dateLine}</span>)}
              <div style={sx('display:flex;flex-wrap:wrap;gap:12px')}>
                {duty.map((d) => (
                  <div key={d.label} style={sx('flex:1 1 130px;min-width:130px;padding:12px 13px;border-radius:13px;border:1px solid rgba(125,145,180,.22);background:rgba(255,255,255,.62)')}>
                    <div style={sx('font-size:10.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#7d8ea8')}>{d.label}</div>
                    <div style={sx('font-size:16px;font-weight:800;color:#16202e;margin-top:5px;letter-spacing:-.2px')}>{d.value}</div>
                    <div style={sx('font-size:11.5px;color:#6c7a8c;margin-top:2px')}>{d.note}</div>
                  </div>
                ))}
              </div>
            </div>
            </Soon>
          </div>

          {/* --------------------------- right --------------------------- */}
          <div style={sx('display:flex;flex-direction:column;gap:16px;min-width:0')}>
            {/* announcements — real events, mockup chrome */}
            <Soon live={LIVE.announcements} label="Unlocks when Nursing Services notices go live.">
            <div style={sx('position:relative;overflow:hidden;border-radius:16px;border:1px solid rgba(122,196,232,.25);background:linear-gradient(135deg,rgba(0,114,163,.96),rgba(58,181,167,.92));color:#fff;box-shadow:0 14px 38px rgba(0,114,163,.3);padding:16px 17px;min-height:118px')}>
              <div aria-hidden="true" style={fs('position:absolute;right:-40px;top:-50px;width:170px;height:170px;border-radius:50%;background:rgba(255,255,255,.12);animation:orbFloat 12s ease-in-out infinite alternate')} />
              <div style={sx('display:flex;align-items:center;gap:8px;position:relative')}>
                <span style={sx('font-size:10.5px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:rgba(255,255,255,.8)')}>Announcements</span>
                <span style={{ flex: 1 }} />
                <div style={sx('display:flex;gap:5px')}>
                  {anns.map((_, i) => (
                    <button key={i} type="button" onClick={() => setAnnPinned(i)}
                      style={sx('width:' + (i === ai ? 18 : 7) + 'px;height:7px;border-radius:4px;border:none;padding:0;cursor:pointer;background:rgba(255,255,255,' + (i === ai ? .95 : .45) + ');transition:width .3s,background .3s')} />
                  ))}
                </div>
              </div>
              <div key={ai} style={fs('position:relative;margin-top:10px;animation:fadeSwap .35s ease')}>
                <div style={sx('font-size:15px;font-weight:800;letter-spacing:-.2px')}>{anns[ai].title}</div>
                <div style={sx('font-size:12px;color:rgba(255,255,255,.85);margin-top:4px;line-height:1.5')}>{anns[ai].body}</div>
              </div>
            </div>

            </Soon>

            <Soon live={LIVE.team} label="Unlocks with the Duty Roster rollout.">
            <div style={sx(GLASS)}>
              {cardH('Team on my shift', <span style={sx('font-size:11px;color:#9aa6b4')}>{team.length ? team.length + ' on this shift' : ''}</span>)}
              {team.length === 0 ? (
                <div style={sx('font-size:12.5px;color:#6c7a8c;line-height:1.6')}>
                  {todayCode ? 'Nobody else on the published roster carries ' + todayCode + ' today.' : 'This fills in once you are on a published roster for today.'}
                </div>
              ) : (
                <React.Fragment>
                  <div style={sx('display:flex;align-items:center;gap:0')}>
                    {team.map((p, i) => (
                      <div key={i} onClick={() => setTeamSel(i)} title={p.name}
                        style={sx('position:relative;width:40px;height:40px;border-radius:12px;margin-left:' + (i ? -8 : 0) + 'px;display:grid;place-items:center;font-size:12px;font-weight:700;color:#fff;cursor:pointer;background:' + p.c + ';border:2.5px solid ' + (teamSel === i ? '#16202e' : '#fff') + ';box-shadow:0 6px 16px rgba(31,59,90,.18);transition:transform .25s cubic-bezier(.2,.7,.3,1),border-color .25s;z-index:' + (teamSel === i ? 4 : 1))}>
                        {initialsOf(p.name)}<span style={sx('position:absolute;right:-2px;bottom:-2px;width:10px;height:10px;border-radius:50%;border:2px solid #fff;background:#3ddc97')} />
                      </div>
                    ))}
                  </div>
                  {tp && (
                    <div key={teamSel} style={fs('display:flex;align-items:center;gap:11px;margin-top:12px;padding:10px 12px;border-radius:11px;border:1px solid rgba(125,145,180,.22);background:rgba(255,255,255,.62);animation:fadeSwap .3s ease')}>
                      <div style={sx('width:36px;height:36px;border-radius:10px;display:grid;place-items:center;font-size:12px;font-weight:700;color:#fff;background:' + tp.c + ';flex-shrink:0')}>{initialsOf(tp.name)}</div>
                      <div style={sx('flex:1;min-width:0')}>
                        <div style={sx('font-size:12.5px;font-weight:700;color:#16202e')}>{tp.name}</div>
                        <div style={sx('font-size:11px;color:#6c7a8c')}>{tp.role}</div>
                      </div>
                      <span style={sx(tag('#0f7a5f', 'rgba(61,220,151,.2)'))}>On duty</span>
                    </div>
                  )}
                </React.Fragment>
              )}
            </div>

            </Soon>

            {/* off days — the mockup's leave ring, counting the real roster */}
            <Soon live={LIVE.offDays} label="Unlocks with the Duty Roster rollout.">
            <div style={sx(GLASS)}>
              <div style={sx('display:flex;align-items:center;gap:14px')}>
                <div style={sx('width:70px;height:70px;border-radius:50%;padding:5px;flex-shrink:0;display:grid;place-items:center;background:conic-gradient(#27a8db ' + (offStats && offStats.total ? (offStats.left / offStats.total * 100).toFixed(1) : 0) + '%,rgba(125,145,180,.18) 0);transition:background .6s')}>
                  <div style={sx('width:60px;height:60px;border-radius:50%;background:#fff;display:grid;place-items:center;text-align:center;line-height:1')}>
                    <div>
                      <div style={sx("font-size:18px;font-weight:800;font-family:'IBM Plex Mono',monospace;color:#16202e")}>{offStats ? offStats.left : '—'}</div>
                      <div style={sx('font-size:8.5px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#7d8ea8;margin-top:2px')}>days</div>
                    </div>
                  </div>
                </div>
                <div style={sx('flex:1;min-width:0')}>
                  <div style={sx('font-size:14.5px;font-weight:700;color:#16202e')}>Off days this month</div>
                  <div style={sx('font-size:11.5px;color:#6c7a8c;margin-top:3px')}>
                    {offStats ? offStats.taken + ' taken of ' + offStats.total + ' on the published roster' : 'Counts your O-coded days once a roster is published.'}
                  </div>
                  <div style={sx('font-size:10.5px;color:#9aa6b4;margin-top:6px')}>Leave requests still go through your in-charge — this counts the roster only.</div>
                </div>
              </div>
            </div>

            </Soon>

            <Soon live={LIVE.records} label="Unlocks when the certification register is filled in.">
            <div style={sx(GLASS)}>
              {cardH('My records', <span style={sx('font-size:11px;color:#9aa6b4')}>Click to expand</span>)}
              <div style={sx('display:flex;flex-direction:column;gap:8px')}>
                {certs === null ? <div style={sx('font-size:12.5px;color:#6c7a8c')}>Loading your records…</div>
                  : records.length === 0 ? <div style={sx('font-size:12.5px;color:#6c7a8c;line-height:1.6')}>No certifications or vaccination status recorded against your staff record yet.</div>
                    : records.map((r, i) => {
                      const open = openRec === i;
                      return (
                        <div key={i} onClick={() => setOpenRec(open ? null : i)}
                          style={sx('padding:9px 11px;border-radius:11px;cursor:pointer;border:1px solid ' + (open ? 'rgba(0,144,202,.35)' : 'rgba(125,145,180,.2)') + ';background:' + (open ? '#fff' : 'rgba(255,255,255,.6)') + ';transition:transform .25s cubic-bezier(.2,.7,.3,1),box-shadow .25s,border-color .25s')}>
                          <div style={sx('display:flex;align-items:center;gap:10px')}>
                            <span style={sx('width:9px;height:9px;border-radius:50%;background:' + r.dotC + ';flex-shrink:0')} />
                            <div style={sx('min-width:0;flex:1')}>
                              <div style={sx('font-size:12.5px;font-weight:600;color:#16202e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{r.label}</div>
                              <div style={sx('font-size:11px;color:#9aa6b4')}>{r.meta}</div>
                            </div>
                            <span style={sx(r.tagStyle)}>{r.tag}</span>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9aa6b4" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={sx('flex-shrink:0;transition:transform .3s;transform:rotate(' + (open ? 180 : 0) + 'deg)')}><path d="M6 9l6 6 6-6" /></svg>
                          </div>
                          {open && <div style={fs('margin-top:9px;padding-top:9px;border-top:1px dashed rgba(125,145,180,.3);font-size:11.5px;color:#3c4e66;line-height:1.55;animation:slideDown .25s ease')}>{r.detail}</div>}
                        </div>
                      );
                    })}
              </div>
              <div style={sx('margin-top:12px;font-size:11px;color:#9aa6b4;line-height:1.5;border-top:1px solid rgba(125,145,180,.2);padding-top:10px')}>Records are maintained by Nursing Services. Contact your supervisor to correct any detail.</div>
            </div>
            </Soon>
          </div>
        </div>
      </div>
    );
  }

  window.HomeView = HomeView;
})();
