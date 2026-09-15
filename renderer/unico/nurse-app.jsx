/* NURSE APP (Android) — state, view-model and mount.
 *
 * The screen markup is the Claude Design document "Nurse App (Android)" (docs/design),
 * converted mechanically into nurse-app-view.jsx. This module is the app behind it:
 * the state, every handler and the flat view-model the view renders.
 *
 * DATA — everything comes from the server the account signed in to:
 *   POST /api/login, GET /api/me                 who I am
 *   GET  /api/phone/bootstrap                    my unit(s), the feature matrix for my role,
 *                                                hospital name / app version, phonebook, prefs
 *   GET  /api/departments, /api/staff, /api/rosters/:unit/:y/:m, /api/quality,
 *        /api/submissions, /api/med/*            the registers the console keeps
 *   GET/POST /api/phone/{notices,rooms,dm,requests,handover,incidents,shift-reports,
 *        med-requests,unit-report,my-performance,directory,me/state}
 * The server decides what I may see and do (role, unit scope, feature switches); this
 * file only hides what the server would refuse. There is no seed data in a signed-in
 * session. The design's sample data (window.NURSE_APP_DATA) is used ONLY in the
 * localhost design-review mode (/app#demo), never against a real account.
 */
(function () {
  'use strict';
  const React = window.React;
  const { api, tryApi, pageAll, mount } = window.DC;
  const D = window.NURSE_APP_DATA;
  const RS = window.UNICO_ROSTER || null;
  const AP = window.UNICO_APPRAISAL || null;
  const View = window.NurseAppView;
  const { SHIFTS, PATTERN, TEAM, ini, MED_CATS, FOODS, PREGS, MED_TABS, SEC_COLOR, CATS, ATTACH_ICONS, NOTICES, DEPTS, CHATS, CENSUS, DAYS7,
    INDICATORS, IND_PLAIN, ragOf, RAG, SR_STEPS, DC_STAT_FIELDS, DC_ITEMS, DC_ST, DC_GUIDES, ALL_STAFF,
    pillBtn, chip, catStyle, statusStyle, typeStyle, avStyle } = D;

  /* ------------------------------------------------------------- calendar --- */
  const NOW = new Date();
  const Y = NOW.getFullYear(), M = NOW.getMonth(), TODAY = NOW.getDate();
  const DIM = new Date(Y, M + 1, 0).getDate();
  const FIRST_DOW = (new Date(Y, M, 1).getDay() + 6) % 7; // Mon = 0
  const DOWS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const MON3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dowOf = (d) => DOWS[(FIRST_DOW + d - 1 + 700) % 7];
  const dateLabel = (d) => dowOf(d) + ', ' + d + ' ' + MON3[M];
  const monthLabel = MONTHS[M] + ' ' + Y;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const pad2 = (n) => String(n).padStart(2, '0');
  const isoDay = (d) => Y + '-' + pad2(M + 1) + '-' + pad2(d);
  const hm = (t) => t.getHours() + ':' + pad2(t.getMinutes());
  const timeNow = () => hm(new Date());
  const dayStamp = () => { const d = new Date(); return pad2(d.getDate()) + ' ' + MON3[d.getMonth()] + ' ' + timeNow(); };
  const fmtTs = (ts) => { if (!ts) return ''; const t = new Date(ts); return pad2(t.getDate()) + ' ' + MON3[t.getMonth()] + ' ' + hm(t); };
  const fmtIso = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); if (!m) return String(iso || '—'); return Number(m[3]) + ' ' + MON3[Number(m[2]) - 1] + (Number(m[1]) !== Y ? ' ' + m[1] : ''); };
  // "Just now", "12 min ago", "9:01", "Yesterday 21:40", "3 Sep"
  const ago = (ts) => {
    if (!ts) return '';
    const d = Date.now() - ts;
    if (d < 0) return 'Scheduled · ' + fmtTs(ts);
    if (d < 60e3) return 'Just now';
    if (d < 3600e3) return Math.round(d / 60e3) + ' min ago';
    const t = new Date(ts), now = new Date();
    if (t.toDateString() === now.toDateString()) return hm(t);
    const y = new Date(); y.setDate(y.getDate() - 1);
    if (t.toDateString() === y.toDateString()) return 'Yesterday ' + hm(t);
    return t.getDate() + ' ' + MON3[t.getMonth()] + (t.getFullYear() !== Y ? ' ' + t.getFullYear() : '');
  };
  const norm = (x) => String(x || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  const cap = (x) => String(x || '').replace(/^./, (c) => c.toUpperCase());
  const MONO = "font-family:'IBM Plex Mono',monospace";
  const BLUE_BTN = 'background:linear-gradient(140deg,#0aa0d4,#0072a3);color:#fff;box-shadow:0 10px 24px rgba(0,144,202,.32)';

  // A duty code -> {name, time, hours, color, bg}. The design knew five codes; the
  // hospital's real sheet uses window.UNICO_ROSTER's table, mapped by shift bucket.
  const BUCKET = { M: SHIFTS.M4, E: SHIFTS.E3, N: SHIFTS.N2, G: { name: 'General', color: '#1e8a7c', bg: 'rgba(58,181,167,.16)' } };
  const NONE = { name: 'Not published', time: '', hours: '—', color: '#9aa6b4', bg: 'rgba(125,145,180,.12)' };
  function shiftOf(code) {
    if (code === '' || code == null) return NONE;
    if (code === '—') return SHIFTS.O;
    if (SHIFTS[code]) return SHIFTS[code];
    const spec = RS && RS.BY_CODE && RS.BY_CODE[code];
    if (RS && RS.isLeave && RS.isLeave(code)) return Object.assign({}, SHIFTS.CL, { name: (spec && spec.label) || 'Leave' });
    if (RS && RS.isOff && RS.isOff(code)) return SHIFTS.O;
    if (spec) { const b = BUCKET[spec.bucket] || SHIFTS.O; return { name: b.name || spec.label, time: spec.label, hours: (spec.hours || 0) + 'h', color: b.color, bg: b.bg }; }
    const b = BUCKET[String(code)[0]];
    return b ? { name: b.name, time: '', hours: '—', color: b.color, bg: b.bg } : SHIFTS.O;
  }
  const isLeave = (code) => code === 'CL' || !!(RS && RS.isLeave && RS.isLeave(code));
  const isWork = (code) => { if (!code) return false; const b = shiftOf(code); return b !== SHIFTS.O && b !== NONE && b.name !== 'Off' && !isLeave(code); };
  const hoursOf = (code) => { const h = parseFloat(shiftOf(code).hours); return isNaN(h) ? 0 : h; };
  const codeChip = (code) => { const sh = shiftOf(code); return MONO + `;font-size:10.5px;font-weight:700;padding:2px 6px;border-radius:6px;color:${sh.color};background:${sh.bg}`; };
  const bucketOf = (code) => { const spec = RS && RS.BY_CODE && RS.BY_CODE[code]; return (spec && spec.bucket) || String(code || '')[0] || ''; };

  /* -------------------------------------------------------------- styling --- */
  const toggle = (on) => ({
    trackStyle: `position:relative;width:44px;height:26px;border-radius:13px;border:0;cursor:pointer;flex-shrink:0;transition:background .2s;background:${on ? 'linear-gradient(140deg,#0aa0d4,#0072a3)' : 'rgba(125,145,180,.35)'}`,
    knobStyle: `position:absolute;top:3px;left:${on ? '21px' : '3px'};width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:left .2s`,
  });
  const track = (on) => ({ track: toggle(on).trackStyle, knob: toggle(on).knobStyle });
  const dot = (c) => `width:10px;height:10px;border-radius:50%;background:${c};flex-shrink:0;box-shadow:0 0 0 3px ${c}22`;
  const box = (on) => `display:grid;place-items:center;width:22px;height:22px;border-radius:7px;border:1.5px solid ${on ? 'transparent' : 'rgba(125,145,180,.45)'};background:${on ? 'linear-gradient(140deg,#0aa0d4,#0072a3)' : 'rgba(255,255,255,.8)'};flex-shrink:0;cursor:pointer`;
  const iconBtn = (on, color) => `width:38px;height:38px;border-radius:11px;border:1px solid ${on ? color : 'rgba(255,255,255,.9)'};background:${on ? color + '22' : 'rgba(255,255,255,.6)'};display:grid;place-items:center;color:${on ? color : '#3c4858'};cursor:pointer`;
  const inputStyle = 'width:60px;text-align:center;border:1px solid rgba(125,145,180,.3);border-radius:10px;padding:8px 6px;font-size:14px;font-weight:700;background:rgba(255,255,255,.85);outline:none;' + MONO;
  const roStyle = (ro) => `border:1px solid rgba(125,145,180,.3);border-radius:10px;padding:10px 12px;font-size:14px;font-weight:700;background:${ro ? 'rgba(125,145,180,.1)' : 'rgba(255,255,255,.85)'};color:${ro ? '#6c7a8c' : '#16202e'};outline:none;width:100%;box-sizing:border-box;` + MONO;
  const spark = (vals, color, max) => { const mx = max || Math.max(1, ...vals); return vals.map((v, i) => `flex:1;height:${Math.max(8, Math.round(v / mx * 100))}%;border-radius:2px;background:${i === vals.length - 1 ? color : color + '66'}`); };
  const tel = (p) => (p ? 'tel:' + String(p).replace(/[^\d+]/g, '') : '#');
  const wa = (p) => (p ? 'https://wa.me/' + String(p).replace(/[^\d]/g, '') : '#');
  const mask = (p) => String(p || '').replace(/(\+880 \d{2})\d{2} \d{3} (\d{3})/, '$1•• ••• $2');
  const fmtN = (n) => Number(n || 0).toLocaleString('en-US');
  const sum = (a) => a.reduce((x, y) => x + (Number(y) || 0), 0);

  // Data-collection months: the previous month is the one due now, two behind it, and
  // the current month (not open yet). Keys use the console's "Aug-26" form.
  const DC_MONTHS = []; for (let k = 3; k >= 0; k--) { const d = new Date(Y, M - k, 1); DC_MONTHS.push({ label: MON3[d.getMonth()] + ' ' + d.getFullYear(), key: MON3[d.getMonth()] + '-' + String(d.getFullYear()).slice(-2), long: MONTHS[d.getMonth()] + ' ' + d.getFullYear(), y: d.getFullYear(), m: d.getMonth() }); }
  const DC_CUR = 2;
  const DC_DUE_DAY = new Date(Y, M + 1, 0).getDate();

  // Phonebook rows come from the server (settings.phonebook: [section, label, sub, number]);
  // the icon and colour are decided by the section here.
  const PHONE_LOOK = {
    Emergency: ['#b32e2e', 'rgba(214,69,69,.12)', 'M22 12h-4l-3 9L9 3l-3 9H2'],
    'Clinical support': ['#0072a3', 'rgba(0,144,202,.13)', 'M9 3h6M10 3v6l-5 9a2 2 0 001.7 3h10.6a2 2 0 001.7-3l-5-9V3'],
    Administration: ['#6a52d4', 'rgba(106,82,212,.13)', 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 3a4 4 0 110 8 4 4 0 010-8z'],
    _: ['#3c4858', 'rgba(125,145,180,.16)', 'M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1.9.4 1.8.7 2.6a2 2 0 01-.5 2.1L8 9.7a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.4c.8.3 1.7.5 2.6.7a2 2 0 011.7 2z'],
  };
  const ATTACH = [['Photo', '#0072a3', 'rgba(0,144,202,.13)', 'M21 19V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2zM8.5 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM21 15l-5-5L5 21', 'photo'], ['Document', '#b32e2e', 'rgba(214,69,69,.12)', 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8', 'pdf'], ['Handover', '#6a52d4', 'rgba(106,82,212,.13)', 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 12h6M9 16h4', 'handover'], ['Shift report', '#1e8a7c', 'rgba(58,181,167,.16)', 'M18 20V10M12 20V4M6 20v-6', 'pdf'], ['Roster', '#b8650a', 'rgba(224,138,30,.15)', 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z', 'pdf'], ['Location', '#3c4858', 'rgba(125,145,180,.16)', 'M12 22s7-7 7-12a7 7 0 10-14 0c0 5 7 12 7 12zM12 12a2 2 0 100-4 2 2 0 000 4z', 'photo']];
  const PRIO = { Critical: ['#b32e2e', 'rgba(214,69,69,.12)'], Watch: ['#b8650a', 'rgba(224,138,30,.15)'], Routine: ['#1d8f57', 'rgba(43,182,115,.14)'] };
  const INC_TYPES = ['Medication', 'Fall', 'Needle-stick', 'Equipment', 'Near miss', 'Other'];
  const INC_SEVS = ['Near miss', 'Minor', 'Moderate', 'Severe'];
  const NAV_D = { home: 'M3 11l9-8 9 8v9a2 2 0 01-2 2h-4v-7h-6v7H5a2 2 0 01-2-2z', roster: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z', chat: 'M21 12a8 8 0 01-8 8H8l-5 3 1.5-4.5A8 8 0 1121 12z', meds: 'M10.5 20.5l10-10a4.95 4.95 0 00-7-7l-10 10a4.95 4.95 0 007 7zM8.5 8.5l7 7', me: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 3a4 4 0 110 8 4 4 0 010-8z', bell: 'M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0', swap: 'M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4', staff: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 3a4 4 0 110 8 4 4 0 010-8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75', incident: 'M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z', handover: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 12h6M9 16h4', reports: 'M18 20V10M12 20V4M6 20v-6', report: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8', datacol: 'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z', history: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2', perf: 'M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z', approvals: 'M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11', compose: 'M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z' };
  const IND_D = 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2';

  /* ---------------------------------------------------------- feature map --- */
  // Which server feature switch each screen belongs to. The server enforces these on
  // its routes; the app hides the entry points so a nurse never meets a 403.
  const SCREEN_FEATURE = { roster: 'roster', shift: 'roster', requests: 'requests', newRequest: 'requests', chats: 'chatDept', thread: 'chatDept', meds: 'meds', medDetail: 'meds', medRequest: 'medReq', notices: 'notices', noticeDetail: 'notices', compose: 'compose', staff: 'staffDir', staffDetail: 'staffDir', reports: 'reports', indicator: 'reports', shiftReport: 'shiftReport', datacol: 'datacol', datacolForm: 'datacol', datacolHistory: 'datacolHist', handover: 'handover', incident: 'incident', performance: 'performance', rosterEdit: 'rosterEdit', unitStaff: 'unitStaff' };
  // The server's default matrix (server/phone-app.js FEATURES), used only when the
  // bootstrap could not be read and in demo mode. Role order: nurse, incharge, collector, pca.
  const FEATURE_DEFAULTS = { home: [1, 1, 1, 1], roster: [1, 1, 1, 1], requests: [1, 1, 1, 1], approvals: [0, 1, 0, 0], handover: [1, 1, 0, 1], chatDept: [1, 1, 1, 1], chatHosp: [1, 1, 1, 0], notices: [1, 1, 1, 1], compose: [0, 1, 0, 0], staffDir: [1, 1, 1, 1], phones: [1, 1, 0, 0], meds: [1, 1, 1, 0], medReq: [1, 1, 0, 0], incident: [1, 1, 1, 1], performance: [1, 1, 1, 1], reports: [0, 1, 0, 0], shiftReport: [0, 1, 0, 0], datacol: [0, 1, 1, 0], datacolHist: [0, 1, 1, 0], rosterEdit: [0, 1, 0, 0], unitStaff: [0, 1, 0, 0] };
  function defaultFeatures(role) {
    const col = { nurse: 0, incharge: 1, collector: 2, pca: 3 }[role];
    const out = {}; Object.keys(FEATURE_DEFAULTS).forEach((k) => { out[k] = col === undefined ? true : !!FEATURE_DEFAULTS[k][col]; }); return out;
  }
  const EMPTY_LIVE = () => ({ depts: null, staff: null, roster: null, subs: null, quality: null, meds: null, medsError: false, directory: null, notices: null, rooms: null, threads: {}, requests: null, handover: null, incidents: null, shiftReports: null, medRequests: null, perf: null, report: null, unitStaff: null, rosterDoc: null });

  /* ----------------------------------------------------- data adapters --- */
  // A catalogue brand row -> the design's medicine shape.
  const PREG = { A: 'safe', B: 'safe', C: 'caution', D: 'avoid', X: 'avoid' };
  function liveMed(b) {
    const price = b.price && (b.price.unit || b.price.raw) ? ('৳ ' + (b.price.unit != null ? Number(b.price.unit).toFixed(2) : b.price.raw) + (b.price.unitLabel ? ' / ' + b.price.unitLabel : '')) : '';
    return { id: b.id || b._id, live: true, brand: b.name || '', strength: b.strength || '', generic: b.generic || '', route: b.form || '', mfr: b.manufacturer || '', price, cls: b.drugClass || '', cat: b.drugClass || 'Other', img: b.hasImage ? '/api/med/image/' + encodeURIComponent(b.id || b._id) : '', alert: !!b.highAlert, nursing: '', facts: { max: '—', food: 'any', preg: PREG[String(b.pregnancyCategory || '').trim()[0]] || 'caution' }, sec: {} };
  }
  const SEC_ALIAS = { interaction: 'Drug Interactions', interactions: 'Drug Interactions', 'drug interactions': 'Drug Interactions', 'storage conditions': 'Storage', storage: 'Storage', 'precautions & warnings': 'Precautions And Warnings', 'precautions and warnings': 'Precautions And Warnings', 'precautions': 'Precautions And Warnings', 'duration of treatment': 'Duration Of Treatment', 'use in special populations': 'Use In Special Populations', 'pregnancy & lactation': 'Pregnancy & Lactation', 'pregnancy and lactation': 'Pregnancy & Lactation', 'dosage & administration': 'Dosage & Administration', 'dosage and administration': 'Dosage & Administration', dosage: 'Dosage & Administration', 'side effects': 'Side Effects', contraindications: 'Contraindications', indications: 'Indications', indication: 'Indications', pharmacology: 'Pharmacology', composition: 'Composition', administration: 'Administration', 'pediatric uses': 'Pediatric Uses', 'paediatric uses': 'Pediatric Uses', 'overdose effects': 'Overdose Effects', overdose: 'Overdose Effects' };
  function normaliseMonograph(m) {
    const out = {};
    Object.keys(m || {}).forEach((k) => { const v = m[k]; if (!v || typeof v !== 'string') return; const key = SEC_ALIAS[k.trim().toLowerCase()] || k.trim().replace(/\b\w/g, (c) => c.toUpperCase()); out[key] = v; });
    return out;
  }

  // A server notice -> the shape the notice screens read.
  const AUD_LABEL = (n) => n.audience === 'all' ? 'All nursing staff' : n.audience === 'incharges' ? 'All in-charges' : (n.deptNames || n.depts || []).join(', ') || 'My department';
  function noticeOf(n, me) {
    if (n.from !== undefined && !n.author) return Object.assign({ read: false, saved: false, acked: false, myVote: null, comments: [], allowComments: true, ackPending: [], attachments: [] }, n, { poll: n.poll ? Object.assign({ votes: n.poll.opts.map(() => 0) }, n.poll) : null });
    const a = n.author || {};
    const body = String(n.body || '');
    return {
      id: n.id, cat: n.cat || 'General', pinned: !!n.pinned, needsAck: !!n.needsAck, allowComments: n.allowComments !== false,
      attachments: (n.attachments || []).map((x) => ({ name: x.name, ext: x.ext || 'FILE', size: x.size || '', url: x.url || null })),
      ackCount: n.ackCount || 0, ackTotal: n.reach || 0, title: n.title, when: ago(n.publishAt || n.createdAt), ts: n.publishAt || n.createdAt || 0,
      from: a.name || '—', fromRole: [a.roleLabel || a.role, a.dept].filter(Boolean).join(', '), audience: AUD_LABEL(n), body: body.split('\n')[0], full: body,
      poll: n.poll ? { q: n.poll.q, opts: n.poll.opts, votes: n.votes || n.poll.opts.map(() => 0) } : null,
      read: !!n.read, saved: !!n.saved, acked: !!n.acked, myVote: n.myVote != null ? n.myVote : null, mine: !!(me && a.username === me),
      comments: (n.comments || []).map((c) => ({ from: c.name || c.by, when: ago(c.ts), text: c.text })), ackPending: n.ackPending || [], scheduled: !!(n.publishAt && n.publishAt > Date.now()),
    };
  }
  // A server room -> the chat-list shape.
  function chatOf(r) {
    return { id: r.id, scope: r.scope, dept: r.dept || null, deptId: r.deptId || null, group: !!r.group, name: r.name, role: r.role || null, online: !!r.online, sub: r.sub || '', unread: r.unread || 0, when: ago(r.when), ts: r.when || 0, last: r.last || null, muted: !!r.muted, pinned: r.pinned || null, readOnly: !!r.readOnly, members: r.members || 0 };
  }
  // A server request -> "my requests" / "team approvals" rows.
  function requestOf(r) {
    const type = r.type === 'leave' ? 'Leave' : 'Swap';
    const status = r.status === 'approved' ? 'Approved' : r.status === 'declined' ? 'Declined' : 'Pending';
    const title = type === 'Swap' ? `${r.code || 'Shift'} on ${fmtIso(r.date)} ↔ ${r.withName || 'a colleague'}` : `${r.leaveType || 'Casual'} leave · ${fmtIso(r.date)}`;
    const meta = status === 'Pending' ? `Sent ${ago(r.createdAt).toLowerCase()} · awaiting in-charge` : `${status} by ${(r.decidedBy && r.decidedBy.name) || 'in-charge'} · ${ago(r.decidedAt)}${r.decisionReason ? ' · ' + r.decisionReason : ''}`;
    return { id: r.id, type, title, status, meta, name: (r.by && r.by.name) || '—', reason: r.reason || '', date: r.date, dept: r.deptName || r.dept, ts: r.createdAt || 0, leaveType: r.leaveType, code: r.code, by: r.by };
  }
  // The census columns a unit's monthly sheet may carry, found by id or label.
  const COL_RX = { adm: /^adm$|admission/i, dis: /discharge/i, nvd: /nvd|normal deliv|vaginal/i, cs: /caesar|cesar|^cs$|c-?section|lscs/i, deaths: /^death|deaths|mortalit/i, transfers: /transfer/i, occ: /occupan/i, pdays: /patient.?days|pdays|bed.?days/i };
  const findCol = (cols, k) => (cols || []).find((c) => COL_RX[k].test(c.id || '') || COL_RX[k].test(c.label || '')) || null;
  // The unit report (server) or the design's sample -> one normalised census/quality block.
  function reportOf(rep) {
    if (!rep) {
      return { live: false, labels: DAYS7, unitLabel: 'day', adm: CENSUS.adm, dis: CENSUS.dis, nvd: CENSUS.nvd, cs: CENSUS.cs, occ: CENSUS.occ, deaths: CENSUS.deaths, transfers: CENSUS.transfers, beds: 12, nurses: null, pcas: null,
        indicators: INDICATORS.map((i) => Object.assign({ noData: false }, i)), updatedAt: null };
    }
    const cols = rep.cols || [], months = rep.months || [], series = rep.series || {};
    const ser = (k) => { const c = findCol(cols, k); return c && series[c.id] ? series[c.id].map((v) => (v == null ? 0 : Number(v) || 0)) : months.map(() => 0); };
    const has = (k) => !!findCol(cols, k);
    const occCol = findCol(cols, 'occ');
    const inds = (rep.indicators || []).map((i) => {
      const trend = (i.trend || []).map((t) => (t.value == null ? null : Number(t.value)));
      const latest = i.latest && i.latest.value != null ? Number(i.latest.value) : null;
      return { id: i.id, name: i.name, unit: i.unit === '%' ? '%' : (i.unit || ''), v: latest == null ? 0 : latest, noData: latest == null, bench: i.benchmark || '—', benchV: i.benchmarkValue != null ? Number(i.benchmarkValue) : 0, dir: i.goalDirection === 'higher_is_better' ? 'up' : 'down', trend: trend.map((v) => (v == null ? 0 : v)), trendLabels: (i.trend || []).map((t) => t.month), num: i.numLabel || 'Numerator', numV: '—', den: i.denLabel || 'Denominator', denV: '—', formula: i.formula || '', capa: [] };
    });
    return { live: true, labels: months.map((m) => String(m).replace(/^([A-Za-z]{3})-([0-9]{2})$/, '$1 20$2')), unitLabel: 'month', adm: ser('adm'), dis: ser('dis'), nvd: ser('nvd'), cs: ser('cs'), occ: occCol ? ser('occ') : null, deaths: ser('deaths'), transfers: ser('transfers'), hasDel: has('nvd') || has('cs'), beds: rep.staffing && rep.staffing.beds ? rep.staffing.beds : null, nurses: rep.staffing ? rep.staffing.nurses : null, pcas: rep.staffing ? rep.staffing.pcas : null, indicators: inds, updatedAt: rep.updatedAt || null, deptName: rep.deptName };
  }
  // The data-collection items for my unit: the department's monthly sheet plus the
  // quality area's indicators, both exactly as the console defines them.
  const RATE_F = ['pct', 'rate100', 'rate1000', 'avg'];
  // The formula exactly as the desktop collector form resolves it (data-collection.jsx): a
  // declared formula wins, else the benchmark / unit text decides; anything else is a COUNT.
  function formulaOf(i) {
    const declared = i.formula;
    if (['rate1000', 'rate100', 'pct', 'count', 'avg'].indexOf(declared) >= 0) return declared;
    const probe = (String(i.benchmark || '') + ' ' + String(i.unit || '')).toLowerCase();
    const per1000 = /per\s*1[.,\s]?0{3}\b|\/\s*1[.,\s]?0{3}\b/.test(probe), per100 = !per1000 && /per\s*100\b/.test(probe);
    return per1000 ? 'rate1000' : per100 ? 'rate100' : (/%/.test(probe) || /\bpercent/.test(probe)) ? 'pct' : (declared || 'count');
  }
  function dcItemsOf(dept, area) {
    const out = [];
    if (dept && Array.isArray(dept.cols) && dept.cols.length) out.push({ id: 'stat', kind: 'stat', label: (dept.name || 'Unit') + ' statistics sheet', meta: `Monthly sheet · ${dept.cols.length} fields`, d: 'M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18', fields: dept.cols.map((c) => ({ id: c.id, label: c.label || c.id, pct: !!c.pct })) });
    (area && Array.isArray(area.indicators) ? area.indicators : []).forEach((i) => {
      const unit = i.unit === '%' ? '%' : (i.unit || '');
      const formula = formulaOf(i), isRate = RATE_F.indexOf(formula) >= 0;
      const mult = !isRate ? 1 : formula === 'rate1000' ? 1000 : formula === 'avg' ? 1 : 100;
      // denAdminOnly: the administrator owns the denominator (e.g. NSI's total healthcare workers).
      out.push({ id: i.id, kind: 'q', label: i.name, meta: unit === '%' ? '% (' + (i.denLabel || 'denominator') + ')' : unit || i.valueType || '', num: i.numLabel || 'Numerator', den: i.denLabel || 'Denominator', mult, formula, isRate, unit: unit === '%' ? '%' : (unit ? 'per ' + unit.replace(/^per\s+/i, '') : ''), bench: i.benchmark || '—', benchV: i.benchmarkValue != null ? Number(i.benchmarkValue) : null, dir: i.goalDirection === 'higher_is_better' ? 'up' : 'down', grouped: false, denLocked: !!i.denAdminOnly, d: IND_D,
        guide: (i.numeratorDef || i.denominatorDef || i.reference) ? { def: [i.numeratorDef, i.denominatorDef].filter(Boolean).join(' '), example: i.formula ? 'Formula: ' + i.formula + (mult !== 1 ? ' (× ' + fmtN(mult) + ')' : '') : '', ref: i.reference || '' } : null, ind: i });
    });
    return out;
  }
  // Real submissions for one month -> {itemId: {status, num, den, vals, at, reviewer, reason}}.
  function liveSubsFor(subs, monthKey, deptId, areaKey, fields) {
    if (!subs || !subs.length || !monthKey) return {};
    const out = {};
    const stMap = { pending: 'sent', approved: 'approved', rejected: 'rejected', returned: 'rejected' };
    // A withdrawn submission was taken back before review: the item is still owed ("not submitted").
    subs.filter((x) => String(x.month || '') === monthKey && x.status !== 'withdrawn').forEach((x) => {
      const status = stMap[x.status] || 'sent';
      const rec = { status, num: x.num, den: x.den, value: x.value, at: fmtTs(x.submittedAt || x.createdAt), reviewer: x.reviewedBy || (status === 'sent' ? '' : 'Quality team'), reason: x.rejectReason || x.reason || null, note: x.note || x.remark || '', live: true, id: x.id || x._id, ts: x.submittedAt || x.createdAt || 0, autoRejected: !!x.autoRejected };
      // Newest wins, except a duplicate auto-rejected BECAUSE another one was approved never
      // hides that approved record (it is often the newer of the two).
      const better = (a, b) => !b || (b.autoRejected && !a.autoRejected) || (!(a.autoRejected && !b.autoRejected) && a.ts >= b.ts);
      if (x.type === 'patient') { if (deptId && String(x.department) !== String(deptId)) return; if (!better(rec, out.stat)) return; const vals = (fields || []).map((f) => (x.values && x.values[f.id] != null ? x.values[f.id] : '')); out.stat = Object.assign(rec, { vals, values: x.values || {} }); return; }
      if (areaKey && String(x.area) !== String(areaKey)) return;
      const id = x.indicatorId; if (!id) return;
      if (better(rec, out[id])) out[id] = rec;
    });
    return out;
  }
  // The appraisal the server keeps for me -> score, band and per-section bars.
  function perfOf(p) {
    const a = p && p.appraisal;
    if (!a) return { has: false, score: null, band: p && p.staff ? 'No appraisal on record yet' : 'No staff record linked to this account', reviewer: '—', date: '—', cycle: '—', kpis: [], comps: [], note: p && p.staff ? 'Your in-charge has not completed an appraisal for this cycle yet.' : 'Ask administration to link your account to your staff record.', goals: [] };
    const t = AP && AP.tally ? AP.tally(a.scores || {}) : null;
    const secs = t && Array.isArray(t.sections) ? t.sections : [];
    const total = t ? t.total : null, rated = t ? t.rated : a.rated || 0;
    const full = rated >= 20 && AP && AP.gradeFor ? AP.gradeFor(total) : null;
    const comps = secs.filter((x) => x.rated > 0).map((x, i) => ({ label: cap(String((x.title || (AP.SECTIONS[i] && AP.SECTIONS[i].title) || 'Section ' + (i + 1))).toLowerCase()), v: (x.sub / x.rated).toFixed(1), n: x.sub / x.rated }));
    return { has: true, score: rated ? Math.round(total / rated * 10) / 10 : null, band: full ? `${full.grade} · ${full.rating}` : (rated ? `${rated} of 20 parameters rated` : 'Not yet rated'), reviewer: a.assessorName || '—', date: a.cycleEnd ? fmtIso(a.cycleEnd) : '—', cycle: a.cycleLabel || (a.cycleStart ? fmtIso(a.cycleStart) + ' – ' + fmtIso(a.cycleEnd) : '—'),
      kpis: [{ label: 'Total', v: total != null ? total + ' / 100' : '—', note: full ? full.interp : 'out of 100', color: full && full.tone === 'ok' ? '#1d8f57' : full && full.tone === 'warn' ? '#b8650a' : '#0072a3' }, { label: 'Rated', v: rated + ' / 20', note: 'parameters scored', color: '#0072a3' }, { label: 'Status', v: a.status || 'Draft', note: a.signedOff ? 'signed off' : 'in progress', color: a.signedOff ? '#1d8f57' : '#b8650a' }],
      comps, note: a.assessorRemarks || 'No remarks recorded by the assessor yet.', goals: [] };
  }

  /* ------------------------------------------- in-charge: roster builder --- */
  const RE_TOOL = 'border:1px solid rgba(125,145,180,.3);border-radius:9px;padding:6px 9px;font-size:11px;font-weight:700;cursor:pointer;background:rgba(255,255,255,.75);color:#3c4858;white-space:nowrap';
  const yrs = (iso) => { const d = new Date(iso); if (isNaN(d)) return null; const t = new Date(); let y = t.getFullYear() - d.getFullYear(); if (t.getMonth() < d.getMonth() || (t.getMonth() === d.getMonth() && t.getDate() < d.getDate())) y--; return y; };
  const onDay = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.getDate() + ' ' + MON3[d.getMonth()]; };
  const monthOf = (iso) => { const d = new Date(iso); return isNaN(d) ? -1 : d.getMonth(); };
  function rosterBuilder(app, s, unit, unitStaffRows, phonesOn) {
    const y = s.reYear, m = s.reMonth, dim = new Date(y, m + 1, 0).getDate();
    const first = (new Date(y, m, 1).getDay() + 6) % 7;
    const day = clamp(s.reDay, 1, dim);
    const people = (s.live.unitStaff || []).map((p) => ({ sid: 'S' + p.id, name: p.name, sub: [p.designation, p.empId].filter(Boolean).join(' · '), photo: p.photo || null, role: p.role }));
    const order = (s.reOrder || people.map((p) => p.sid)).filter((sid, i, a) => a.indexOf(sid) === i);
    const byId = {}; people.forEach((p) => { byId[p.sid] = p; });
    const names = (s.live.rosterDoc && s.live.rosterDoc.names) || {};
    const rowsAll = order.map((sid) => byId[sid] || { sid, name: names[sid] || sid, sub: 'no longer on the register', photo: null, role: 'Nurse' }).concat(people.filter((p) => order.indexOf(p.sid) < 0));
    const codeAt = (sid, d) => (s.reGrid[sid] && s.reGrid[sid][d]) || '';
    const editable = s.reCanEdit !== false && s.reStatus !== 'approved' && !s.demo ? true : (s.demo ? true : false);
    const locked = s.reStatus === 'approved';
    const codes = (RS && RS.SHIFTS ? RS.SHIFTS : [{ code: 'M4', label: '8 AM – 4 PM', bucket: 'M', hours: 8 }, { code: 'E3', label: '2 PM – 10 PM', bucket: 'E', hours: 8 }, { code: 'N2', label: '10 PM – 8 AM', bucket: 'N', hours: 10 }]);
    const hoursFor = (sid) => { let h = 0; for (let d = 1; d <= dim; d++) h += hoursOf(codeAt(sid, d)); return h; };
    const dayCounts = (d) => { const c = { M: 0, E: 0, N: 0, G: 0, off: 0, leave: 0, blank: 0 }; rowsAll.forEach((r) => { const code = codeAt(r.sid, d); if (!code) c.blank++; else if (isLeave(code)) c.leave++; else if (!isWork(code)) c.off++; else { const b = bucketOf(code); if (c[b] !== undefined) c[b]++; else c.G++; } }); return c; };
    const dc = dayCounts(day);
    const reDays = []; for (let d = 1; d <= dim; d++) { const c = dayCounts(d); const on = c.M + c.E + c.N + c.G; const sel = d === day; const isT = y === Y && m === M && d === TODAY; reDays.push({ d, dow: DOWS[(first + d - 1) % 7], on: on ? on + ' on' : (c.blank === rowsAll.length ? '—' : '0 on'), go: () => app.setState({ reDay: d, rePickOpen: false }), style: `display:flex;flex-direction:column;align-items:center;gap:2px;min-width:46px;padding:7px 4px;border-radius:12px;cursor:pointer;border:1.5px solid ${sel ? '#0090ca' : isT ? 'rgba(0,144,202,.45)' : 'rgba(255,255,255,.9)'};background:${sel ? 'linear-gradient(140deg,#0aa0d4,#0072a3)' : 'rgba(255,255,255,.65)'};color:${sel ? '#fff' : '#16202e'};flex-shrink:0` }); }
    const pickRow = rowsAll.find((r) => r.sid === s.rePickId) || null;
    const chipOf = (code) => { const sh = shiftOf(code || ''); return `min-width:54px;border:1.5px solid ${code ? sh.color + '55' : 'rgba(125,145,180,.35)'};border-radius:10px;padding:7px 8px;font-family:'IBM Plex Mono',monospace;font-size:12.5px;font-weight:700;cursor:pointer;color:${code ? sh.color : '#7d8ea8'};background:${code ? sh.bg : 'rgba(255,255,255,.8)'};white-space:nowrap`; };
    const groups = [{ label: 'Shifts', codes: codes.map((c) => ({ code: c.code, label: c.label })) }, { label: 'Off', codes: (RS && RS.OFF_CODES ? RS.OFF_CODES : ['OFF']).map((c) => ({ code: c, label: 'Day off' })) }, { label: 'Leave', codes: (RS && RS.LEAVE_CODES ? RS.LEAVE_CODES : ['CL', 'AL', 'SL']).map((c) => ({ code: c, label: (RS && RS.BY_CODE && RS.BY_CODE[c] && RS.BY_CODE[c].label) || c })) }, { label: 'Clear', codes: [{ code: '—', label: 'No duty set', clear: true }] }];
    const monthLabelRe = MONTHS[m] + ' ' + y;
    const stat = { draft: ['Draft', '#b8650a', 'rgba(224,138,30,.15)'], submitted: ['Awaiting approval', '#0072a3', 'rgba(0,144,202,.13)'], approved: ['Published', '#1d8f57', 'rgba(43,182,115,.14)'] }[s.reStatus] || ['Draft', '#b8650a', 'rgba(224,138,30,.15)'];
    const csv = ['Name,Employee ID,' + Array.from({ length: dim }, (_, i) => i + 1).join(',')].concat(rowsAll.map((r) => [r.name, (byId[r.sid] && byId[r.sid].sub.split(' · ').pop()) || ''].concat(Array.from({ length: dim }, (_, i) => codeAt(r.sid, i + 1) || '')).map((x) => '"' + String(x).replace(/"/g, '""') + '"').join(','))).join('\n');
    const text = `${unit ? unit.name : ''} · Duty roster · ${monthLabelRe} (${stat[0]})\n` + rowsAll.map((r) => r.name.padEnd(22).slice(0, 22) + ' ' + Array.from({ length: dim }, (_, i) => (codeAt(r.sid, i + 1) || '·').padEnd(4)).join('').trim()).join('\n');
    const share = (kind) => { app.setState({ reExportOpen: false }); if (kind === 'share') { if (navigator.share) navigator.share({ title: 'Duty roster · ' + monthLabelRe, text }).catch(() => {}); else if (navigator.clipboard) { navigator.clipboard.writeText(text).catch(() => {}); app.toastMsg('Roster copied'); } } else if (kind === 'csv') { if (navigator.clipboard) navigator.clipboard.writeText(csv).catch(() => {}); app.toastMsg('CSV copied · paste into Excel or Sheets'); } else if (kind === 'wa') window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank'); };
    const blanks = dc.blank;
    return {
      reMonthLabel: monthLabelRe, reStatus: stat[0], reStatusStyle: `font-size:10.5px;font-weight:700;padding:4px 9px;border-radius:999px;color:${stat[1]};background:${stat[2]};white-space:nowrap`, rePrevMonth: () => app.setReMonth(-1), reNextMonth: () => app.setReMonth(1),
      reStats: [{ n: rowsAll.length, label: 'Staff', color: '#16202e' }, { n: dc.M + dc.E + dc.N + dc.G, label: 'On duty', color: '#0072a3' }, { n: dc.off + dc.leave, label: 'Off / leave', color: '#b8650a' }, { n: blanks, label: 'Unset', color: blanks ? '#b32e2e' : '#1d8f57' }],
      reLocked: locked || (!editable && !s.demo), reLockedText: locked ? `Published · rev ${s.reRevision || 1}${s.reUpdated ? ' · ' + fmtTs(s.reUpdated) : ''} · ask administration to reopen before editing` : 'You can view this sheet but only the unit in-charge can edit it.',
      reDays, reDayCover: `${DOWS[(first + day - 1) % 7]} ${day} · M ${dc.M} · E ${dc.E} · N ${dc.N}${dc.G ? ' · G ' + dc.G : ''} · off ${dc.off}${dc.leave ? ' · leave ' + dc.leave : ''}`,
      reEditable: editable && !locked, reToolStyle: RE_TOOL,
      reCopyPrev: () => { if (day <= 1) return app.toastMsg('This is the first day of the month.'); app.editDay((g) => rowsAll.forEach((r) => { const v = g[r.sid] && g[r.sid][day - 1]; g[r.sid] = g[r.sid] || {}; if (v) g[r.sid][day] = v; else delete g[r.sid][day]; })); },
      reRepeatWeek: () => { app.editDay((g) => rowsAll.forEach((r) => { const v = g[r.sid] && g[r.sid][day]; for (let d = day + 7; d <= dim; d += 7) { g[r.sid] = g[r.sid] || {}; if (v) g[r.sid][d] = v; else delete g[r.sid][d]; } })); app.toastMsg('Copied to every ' + DOWS[(first + day - 1) % 7] + ' after ' + day); },
      reClearDay: () => app.editDay((g) => rowsAll.forEach((r) => { if (g[r.sid]) delete g[r.sid][day]; })),
      reNoStaff: !rowsAll.length, reNoStaffText: s.live.unitStaff ? 'No staff are posted to this unit on the register. Ask administration to update the staff records.' : 'Loading the unit register…',
      reRows: rowsAll.map((r) => { const code = codeAt(r.sid, day); return { name: r.name, sub: r.sub, ini: ini(r.name), hasPhoto: !!r.photo, noPhoto: !r.photo, photo: r.photo, hours: hoursFor(r.sid) + 'h', code: code || '—', codeStyle: chipOf(code), pick: () => { if (!(editable && !locked)) return app.toastMsg(locked ? 'This roster is published and locked.' : 'Only the unit in-charge can edit the roster.'); app.setState({ rePickOpen: true, rePickId: r.sid }); } }; }),
      reNote: s.reNote, setReNote: (e) => app.setState({ reNote: e.target.value, reDirty: true }),
      reSaveDraft: () => app.saveRoster('draft'), reSaveLabel: s.busy.roster ? 'Saving…' : 'Save draft', reSubmit: () => { if (blanks && !confirm(blanks + ' staff have no duty on ' + day + ' ' + MON3[m] + '. Submit anyway?')) return; app.saveRoster('submitted'); }, reSubmitLabel: s.reStatus === 'submitted' ? 'Re-submit for approval' : 'Submit for approval',
      reOpenExport: () => app.setState({ reExportOpen: true }), reCloseExport: () => app.setState({ reExportOpen: false }), reExportOpen: s.reExportOpen, reExportSub: `${rowsAll.length} staff · ${dim} days · ${stat[0]}`, reExportText: text,
      reExportOpts: [{ label: 'Share', color: '#0072a3', bg: 'rgba(0,144,202,.13)', d: 'M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13', go: () => share('share') }, { label: 'Copy CSV', color: '#1e8a7c', bg: 'rgba(58,181,167,.16)', d: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 5a2 2 0 002 2h2a2 2 0 002-2', go: () => share('csv') }, { label: 'WhatsApp', color: '#1d8f57', bg: 'rgba(43,182,115,.14)', d: 'M21 12a8 8 0 01-8 8H8l-5 3 1.5-4.5A8 8 0 1121 12z', go: () => share('wa') }],
      reFooter: s.reDirty ? 'Unsaved changes on this phone' : (s.reUpdated ? `Saved ${fmtTs(s.reUpdated)} · rev ${s.reRevision || 1}` : 'Nothing saved yet for this month'),
      rePickOpen: s.rePickOpen && !!pickRow, reClosePick: () => app.setState({ rePickOpen: false }), rePickName: pickRow ? pickRow.name : '', rePickSub: pickRow ? `${DOWS[(first + day - 1) % 7]} ${day} ${MON3[m]} · now ${codeAt(pickRow.sid, day) || 'unset'}` : '',
      reCodeGroups: groups.map((g) => ({ label: g.label, codes: g.codes.map((c) => { const cur = pickRow && codeAt(pickRow.sid, day) === c.code; const sh = shiftOf(c.clear ? '' : c.code); return { code: c.code, label: c.label, go: () => pickRow && app.setCode(pickRow.sid, day, c.clear ? '' : c.code), style: `display:flex;flex-direction:column;align-items:center;gap:2px;min-width:64px;border:1.5px solid ${cur ? sh.color : 'rgba(125,145,180,.3)'};border-radius:11px;padding:8px 10px;background:${cur ? sh.bg : 'rgba(255,255,255,.85)'};color:${c.clear ? '#7d8ea8' : sh.color};cursor:pointer` }; }) })),
    };
  }
  /* ---------------------------------------------- in-charge: unit staff --- */
  function unitStaffView(app, s, unit, phonesOn) {
    const rows = s.live.unitStaff || [];
    const q = s.usSearch.trim().toLowerCase();
    const thisMonth = (iso) => monthOf(iso) === M;
    const withEvents = rows.map((p) => { const bday = p.dob && thisMonth(p.dob), anniv = p.doj && thisMonth(p.doj) && yrs(p.doj) >= 1; return Object.assign({}, p, { bday, anniv, years: p.doj ? yrs(p.doj) : null }); });
    const filters = [['All', () => true], ['Nurses', (p) => p.role !== 'PCA'], ['PCA', (p) => p.role === 'PCA'], ['Birthdays', (p) => p.bday], ['Anniversaries', (p) => p.anniv], ['No app account', (p) => !p.account]];
    const fn = (filters.find((f) => f[0] === s.usFilter) || filters[0])[1];
    const list = withEvents.filter((p) => fn(p) && (!q || [p.name, p.empId, p.designation, p.qualification].some((x) => String(x || '').toLowerCase().includes(q)))).sort((a, b) => (b.bday || b.anniv ? 1 : 0) - (a.bday || a.anniv ? 1 : 0) || a.name.localeCompare(b.name));
    const events = withEvents.filter((p) => p.bday || p.anniv).map((p) => ({ name: p.name, text: p.bday ? 'Birthday · ' + onDay(p.dob) : `${p.years} yr${p.years === 1 ? '' : 's'} on ${onDay(p.doj)}`, dot: `width:8px;height:8px;border-radius:50%;background:${p.bday ? '#e08a1e' : '#0090ca'};flex-shrink:0` }));
    return {
      usSummary: s.live.unitStaff ? `${rows.length} staff · ${rows.filter((p) => p.role !== 'PCA').length} nurses · ${rows.filter((p) => p.role === 'PCA').length} PCA` : 'loading register…',
      usSearch: s.usSearch, setUsSearch: (e) => app.setState({ usSearch: e.target.value }),
      usFilters: filters.map(([label]) => ({ label, go: () => app.setState({ usFilter: label }), style: chip(s.usFilter === label) })),
      usHasEvents: events.length > 0 && s.usFilter === 'All' && !q, usEvents: events,
      usEmpty: !list.length, usEmptyText: !s.live.unitStaff ? 'Loading…' : rows.length ? 'No one matches this filter.' : 'No staff are posted to this unit on the register.',
      usList: list.map((p) => ({ name: p.name, designation: [p.designation, p.qualification].filter(Boolean).join(' · '), empId: p.empId || '—', role: p.role, ini: ini(p.name), hasPhoto: !!p.photo, noPhoto: !p.photo, photo: p.photo,
        roleStyle: `font-size:9.5px;font-weight:800;letter-spacing:.5px;padding:2px 6px;border-radius:5px;color:${p.role === 'PCA' ? '#6a52d4' : '#0072a3'};background:${p.role === 'PCA' ? 'rgba(106,82,212,.13)' : 'rgba(0,144,202,.13)'}`,
        badge: p.bday ? '🎂 Birthday' : p.anniv ? '🎉 ' + p.years + ' yr' + (p.years === 1 ? '' : 's') : null, badgeStyle: 'font-size:9.5px;font-weight:800;padding:2px 6px;border-radius:5px;color:#b8650a;background:rgba(224,138,30,.15);white-space:nowrap',
        canCall: phonesOn && !!p.phone, tel: tel(p.phone),
        facts: [{ label: 'Joined', v: p.doj ? fmtIso(p.doj) + (p.years != null ? ' · ' + p.years + ' yr' + (p.years === 1 ? '' : 's') : '') : '—' }, { label: 'Birthday', v: p.dob ? onDay(p.dob) : 'not on record' }, { label: 'Experience', v: p.experience || '—' }],
        appDot: `width:8px;height:8px;border-radius:50%;background:${p.account ? (p.account.online ? '#2bb673' : '#0090ca') : '#c4ccd6'};flex-shrink:0`, appLine: p.account ? `App account @${p.account.username} · ${p.account.roleLabel}${p.account.online ? ' · online' : ''}` : 'No app account yet · ask administration to create one', canMsg: !!p.account, msg: () => app.openDM({ username: p.account && p.account.username, name: p.name }) })),
    };
  }

  /* ------------------------------------------------- demo (localhost) seed --- */
  // The design's sample data poured into the same shapes the server sends, so the
  // design-review mode renders through the one code path. Never used when signed in.
  function seedLive(role) {
    const at = (t) => { const m = /^(\d+):(\d+)/.exec(t || ''); const d = new Date(); if (m) d.setHours(Number(m[1]), Number(m[2]), 0, 0); else d.setMinutes(d.getMinutes() - 30); return d.getTime(); };
    const acct = (p) => ({ username: norm(p.name), name: p.name, role: /manager|charge/i.test(p.role) ? 'incharge' : 'nurse', roleLabel: p.title, departments: [p.dept], online: !!p.online, staffEmpId: p.emp });
    const directory = ALL_STAFF.map(acct);
    const staff = ALL_STAFF.map((p, i) => ({ id: i + 1, name: p.name, designation: p.title, role: p.title === 'Patient Care Assistant' ? 'PCA' : 'Nurse', current_department: p.dept, phone: p.phone, emp_id: p.emp, bnmc: p.reg, doj: p.joined, is_active: true }));
    const grid = {}; ALL_STAFF.forEach((p, i) => { const row = {}; for (let d = 1; d <= DIM; d++) row[d] = d === TODAY ? p.shift : PATTERN[(d + i) % PATTERN.length]; grid['S' + (i + 1)] = row; });
    const rooms = CHATS.map((c) => ({ id: c.id, name: c.name, scope: c.scope, dept: c.dept || null, group: !!c.group, members: c.members || 2, online: !!c.online, sub: c.sub, unread: c.unread, when: at(c.msgs.length ? c.msgs[c.msgs.length - 1].t : ''), last: c.msgs.length ? { text: c.msgs[c.msgs.length - 1].text, from: c.msgs[c.msgs.length - 1].from === 'me' ? 'You' : c.msgs[c.msgs.length - 1].from, mine: c.msgs[c.msgs.length - 1].from === 'me', urgent: !!c.msgs[c.msgs.length - 1].urgent } : null, muted: false, pinned: c.pinned != null && c.msgs[c.pinned] ? { id: c.id + ':' + c.pinned, text: c.msgs[c.pinned].text, from: c.msgs[c.pinned].from } : null, role: c.role || null }));
    const threads = {}; CHATS.forEach((c) => { threads[c.id] = { room: { id: c.id, name: c.name, scope: c.scope, group: !!c.group, pinned: rooms.find((r) => r.id === c.id).pinned, sub: c.sub, readOnly: false, other: c.group ? null : norm(c.name) }, members: (c.group ? ALL_STAFF.slice(0, Math.min(ALL_STAFF.length, c.members || 8)) : ALL_STAFF.filter((p) => p.name === c.name)).map((p) => ({ username: norm(p.name), name: p.name, role: p.title, online: !!p.online, admin: /charge|manager/i.test(p.title) })), typing: c.typing || null,
      messages: c.msgs.map((m, i) => ({ id: c.id + ':' + i, from: { username: m.from === 'me' ? 'demo' : norm(m.from), name: m.from === 'me' ? 'You' : m.from, role: m.role || '' }, text: m.text, urgent: !!m.urgent, attach: m.attach ? { name: m.attach, type: m.attachType || 'pdf' } : null, replyTo: m.replyTo ? { from: '', text: m.replyTo } : null, reactions: (m.reactions || []).map((l) => ({ label: l, n: 1, mine: false })), ts: at(m.t), mine: m.from === 'me', seen: m.seen })) }; });
    const req = (type, date, extra) => Object.assign({ id: 'r' + Math.random().toString(36).slice(2), type, dept: 'LDR', deptName: 'LDR', date: isoDay(clamp(date, 1, DIM)), status: 'pending', by: { username: 'demo', name: role === 'incharge' ? 'Priya Das' : 'Nasif Ahammed Niloy' }, createdAt: Date.now() - 86400e3 }, extra);
    const requests = { mine: [req('swap', TODAY + 4, { code: 'E3', withName: 'Sumaiya Akter' }), req('leave', TODAY + 9, { leaveType: 'Casual', status: 'approved', decidedBy: { name: 'Priya Das' }, decidedAt: Date.now() - 5 * 86400e3 }), req('swap', 28, { code: 'N2', withName: 'Tanvir Hossain', status: 'declined', decidedBy: { name: 'Priya Das' }, decidedAt: Date.now() - 12 * 86400e3, decisionReason: 'minimum night cover' })],
      team: [req('swap', TODAY + 4, { code: 'E3', withName: 'Nasif Ahammed', by: { username: 'sumaiya', name: 'Sumaiya Akter' }, reason: 'University exam the next morning, needs the earlier finish.' }), req('leave', TODAY + 1, { leaveType: 'Sick', by: { username: 'tanvir', name: 'Tanvir Hossain' }, reason: 'Fever since last night, GP note attached.' }), req('leave', TODAY + 14, { leaveType: 'Annual', by: { username: 'rahima', name: 'Rahima Khatun' }, reason: 'Family travel, booked in July.' })] };
    const handover = { dept: 'LDR', deptName: 'LDR', items: [['B2', 'Mrs. Rahman · 28 y', 'Critical', 'Variable decelerations on CTG at 09:05. Dr. Farhana reviewing. Keep left lateral, continuous CTG, IV line patent.'], ['B4', 'Mrs. Begum · 31 y', 'Watch', 'Booked for CS at 10:30. Pre-op checklist complete, consent signed. NPO since 04:00. Anaesthesia review pending.'], ['B6', 'Mrs. Akter · 24 y', 'Routine', 'Post-NVD day 1. Vitals stable, breastfeeding established. Discharge planning tomorrow if Hb ≥ 10.'], ['B7', 'Mrs. Sultana · 35 y', 'Watch', 'PIH — BP 148/94 at 08:00. Repeat 4-hourly, report ≥ 160/100. Labetalol chart reviewed.']].map(([bed, patient, prio, note], i) => ({ id: 'h' + i, bed, patient, prio, note, done: false, by: { name: 'Priya Das' } })) };
    const medRequests = [{ id: 'm1', name: 'Noradrenaline 4 mg/4 mL', form: 'Injection', createdAt: Date.now() - 11 * 86400e3, status: 'Approved', openId: 'actrapid', reply: 'Added with a dilution card. Flagged high-alert.' }, { id: 'm2', name: 'Magnesium sulphate 50%', form: 'Injection', createdAt: Date.now() - 5 * 86400e3, status: 'In review', reply: 'Checking the eclampsia protocol reference with Obs & Gynae.' }];
    const shiftReports = [['N2', 1, 'Submitted', 'Rahima Khatun', 3, 2, 0], ['E3', 1, 'Approved', 'Priya Das', 2, 1, 1], ['M4', 1, 'Approved', 'Priya Das', 4, 3, 0], ['N2', 2, 'Approved', 'Rahima Khatun', 1, 2, 0]].map(([shift, back, status, name, adm, del, ev], i) => ({ id: 's' + i, dept: 'LDR', deptName: 'LDR', date: isoDay(clamp(TODAY - back, 1, DIM)), shift, status, by: { name }, counts: { adm, nvd: del, cs: 0, falls: ev, mederr: 0, needle: 0, code: 0 }, createdAt: Date.now() - back * 86400e3 }));
    const scores = {}; for (let i = 1; i <= 20; i++) scores[i] = [5, 4, 4, 5, 4, 4, 3, 4, 5, 4, 4, 5, 4, 4, 4, 5, 4, 3, 4, 5][i - 1];
    const perf = { staff: { name: 'Nasif Ahammed Niloy' }, appraisal: { cycleLabel: 'Jan – Jun ' + Y, cycleEnd: Y + '-06-28', status: 'Signed off', signedOff: true, assessorName: role === 'incharge' ? 'Elizabeth Jothi Raja Singh' : 'Priya Das', assessorRemarks: 'Reliable, calm under pressure and trusted by the team on busy nights. Documentation timeliness is the one area to lift — aim for real-time charting on every shift this cycle.', scores, rated: 20 } };
    const notices = NOTICES.map((n) => Object.assign({}, n, { read: n.id === 2 || n.id === 5, saved: n.id === 4, comments: n.id === 1 ? [{ from: 'Tanvir Hossain', when: '8:52', text: 'Does this apply to the triage bay as well, or only the labour rooms?' }, { from: 'Elizabeth Jothi Raja Singh', when: '9:01', text: 'Both. Triage counts as LDR for this protocol.' }] : [], ackPending: ['Rahima Khatun', 'Tanvir Hossain', 'Shathi Rani'] }));
    const unitStaff = ALL_STAFF.filter((p) => p.dept === 'LDR').map((p, i) => ({ id: i + 1, name: p.name, designation: p.title, role: p.title === 'Patient Care Assistant' ? 'PCA' : 'Nurse', empId: p.emp, doj: (Y - 1 - i) + '-' + pad2(M + 1) + '-' + pad2(clamp(3 + i * 4, 1, 28)), dob: i % 2 ? (Y - 28 - i) + '-' + pad2(M + 1) + '-' + pad2(clamp(10 + i, 1, 28)) : null, phone: p.phone, photo: null, qualification: 'BSc Nursing', experience: (3 + i) + ' yrs', account: i < 3 ? { username: norm(p.name), role: 'nurse', roleLabel: 'Staff nurse', online: !!p.online } : null }));
    return { depts: DEPTS.map((d) => ({ id: d.toLowerCase(), name: d })), staff, roster: { grid, status: 'approved' }, subs: null, quality: null, meds: null, medsError: false, directory, notices, rooms, threads, requests, handover, incidents: [], shiftReports, medRequests, perf, report: null, unitStaff, rosterDoc: null };
  }
  const DEMO_ME = { nurse: { username: 'demo', name: 'Nasif Ahammed Niloy', role: 'nurse', designation: 'Staff Nurse', empId: 'UN-1042' }, incharge: { username: 'demo', name: 'Priya Das', role: 'incharge', designation: 'Nurse In-charge', empId: 'UN-0871' } };
  const DEMO_BOOT = (role) => ({ user: { username: 'demo', name: DEMO_ME[role].name, role, roleLabel: role === 'incharge' ? 'Nurse in-charge' : 'Staff nurse', isIncharge: role === 'incharge', canManage: false }, unit: { id: 'ldr', name: 'LDR', incharge: 'Priya Das' }, units: [{ id: 'ldr', name: 'LDR' }], features: defaultFeatures(role), hospital: { name: 'Hands of Care Hospitals', app: 'UNICO Nurse', version: '2.1.0' }, policy: { portalPhones: true }, phonebook: [['Emergency', 'Code Blue / Rapid Response', 'Dial from any ward phone', '2222'], ['Emergency', 'Ambulance desk', 'Transfers and referrals', '+880 1713 000 911'], ['Clinical support', 'Blood bank', 'Ground floor · 24 h', '2310'], ['Clinical support', 'Pharmacy', 'Ward supply · 8 AM – 10 PM', '2340'], ['Administration', 'Nursing office', 'Nurse Manager · Mon – Sat', '1001'], ['Administration', 'IT & app support', '9 AM – 6 PM', '1090']], prefs: {}, favs: ['actrapid'], counts: {} });
  function savedUnit() { try { return localStorage.getItem('unico.unit') || ''; } catch (e) { return ''; } }
  function demoFromHash() {
    const host = String(window.location.hostname || '');
    if (!/^(localhost|127\.0\.0\.1|10\.0\.2\.2|\[::1\])$/.test(host) && !/\.local$/.test(host)) return null;
    const h = String(window.location.hash || '').replace(/^#/, '');
    if (!/(^|&)demo(=|&|$)/.test(h)) return null;
    const get = (k) => { const m = h.match(new RegExp('(?:^|&)' + k + '=([^&]*)')); return m ? decodeURIComponent(m[1]) : ''; };
    return { role: get('demo') === 'incharge' ? 'incharge' : 'nurse', screen: get('screen') };
  }

  /* -------------------------------------------------------------- the app --- */
  class NurseApp extends React.Component {
    constructor(props) {
      super(props);
      this.state = {
        screen: 'login', booting: true, role: 'nurse', me: null, boot: null, demo: false, unitSel: savedUnit(), drawerOpen: false, empId: '', pin: '', loginBusy: false, toast: '', clockedIn: false, busy: {},
        live: EMPTY_LIVE(),
        // roster + requests
        selDay: TODAY, reqTab: 'mine', reqType: 'Swap', swapWith: 0, leaveType: 'Casual', reqReason: '', reqSent: false,
        // medicines
        meds: null, mono: {}, medQuery: '', medClass: 'All', alertOnly: false, selMed: '', medTab: 'overview', favs: [], medDetail: {}, medSearch: null,
        mr: { name: '', strength: '', mfr: '', form: 'Injection', reason: 'Used on ward, missing', note: '', urgent: false, highAlert: false }, mrSent: false,
        // chat
        chatTab: 'dept', chatDept: 'All', selChat: null, draft: '', chatSearch: '', newGroupOpen: false, ngName: '', ngScope: 'dept', ngPicked: {}, roomInfoOpen: false, attachOpen: false, urgent: false, selMsg: null, replyTo: null, pendingAttach: null,
        // notices
        noticeFilter: 'All', noticeSearch: '', selNotice: null, commentDraft: '', reminded: {},
        composeSent: false, cTitle: '', cBody: '', cCat: 'General', cAudience: 'dept', cDepts: {}, cAck: false, cPin: false, cComments: true, cWhen: 'now', cAttach: false, cPoll: false, cPollQ: '', cPollOpts: ['', ''],
        // staff directory
        staffSearch: '', staffDept: 'All', selStaff: null, staffOnlineOnly: false, dirTab: 'staff', staffSort: 'active',
        // data collection
        dcMonth: DC_CUR, dcFilter: 'All', dcSel: 'stat', dcVals: {}, dcNote: '', dcCorr: '', dcGuideOpen: false, dcEvidence: false, dcFormSent: false, dcToast: '', dcMode: 'direct', dcHistFilter: 'All', dcSubs: {}, dcAreaSel: '',
        // reports (in-charge)
        repSimple: false, compareOn: false, shareOpen: false, infoOpen: false, infoInd: '', pinnedKpis: {}, censusTip: '', repUpdated: timeNow(), refreshing: false, schedDaily: true, schedWeekly: false,
        repPeriod: 'month', repTab: 'overview', selInd: '', capaDone: {}, capaExtra: {}, capaDraft: '', exportToast: '',
        srStep: 0, srShift: 'M4', srVals: {}, srNotes: { obs: '', issues: '', handover: '' }, srSent: false,
        // handover / incident / settings
        handoverDraft: '', incType: 'Medication', incSev: 'Minor', incTime: timeNow(), incDesc: '', incAnon: false, incSent: false, incRef: '',
        notifOn: true, biometric: true, wakeOnShift: false,
        // roster builder (in-charge)
        reYear: Y, reMonth: M, reDay: TODAY, reGrid: {}, reOrder: null, reStatus: 'draft', reDirty: false, rePickOpen: false, rePickId: null, reNote: '', reExportOpen: false, reLoaded: '',
        // unit staff (in-charge)
        usSearch: '', usFilter: 'All',
      };
    }

    /* ---------------------------------------------------------- lifecycle --- */
    componentDidMount() {
      fetch('/assets/monographs.json').then((r) => r.json()).then((mono) => this.setState({ mono })).catch(() => {});
      this._onExpired = () => this.sessionExpired();
      window.addEventListener('unico:session-expired', this._onExpired);
      // Hospital name / app version for the login screen (public; nothing else is).
      tryApi('/api/phone/branding').then((b) => { if (b && b.ok && b.hospital) this.setState({ branding: b.hospital }); });
      const demo = demoFromHash();
      if (demo) {
        // Design-review mode (localhost only): /app#demo or #demo=incharge[&screen=name].
        fetch('/assets/nurse-app-meds.json').then((r) => r.json()).then((meds) => this.setState({ meds: Array.isArray(meds) ? meds : [], selMed: 'actrapid' })).catch(() => this.setState({ meds: [] }));
        this.setState({ booting: false, demo: true, role: demo.role, screen: demo.screen || 'home', me: DEMO_ME[demo.role], boot: DEMO_BOOT(demo.role), live: seedLive(demo.role), favs: ['actrapid'], selNotice: 1, selChat: 'ldr', chatDept: 'LDR', cDepts: { ldr: true }, selStaff: 'Rahima Khatun', srVals: { planned: 5, actual: 5, pca: 2 } });
        return;
      }
      tryApi('/api/me').then((me) => { if (me && me.ok && me.user) this.enter(me); else this.setState({ booting: false, screen: 'login' }); });
      this._poll = setInterval(() => this.tick(), 5000);
      this._tick = 0;
      // Back online: features / unit grants may have changed while the phone was offline.
      this._onOnline = () => { if (!this.state.demo && this.state.me) this.loadBoot(true); };
      window.addEventListener('online', this._onOnline);
    }
    componentWillUnmount() { clearInterval(this._poll); window.removeEventListener('unico:session-expired', this._onExpired); window.removeEventListener('online', this._onOnline); }
    // Any 401 (dc-runtime fires the event): the cookie is gone and every read would come back
    // empty, which looked like "my data vanished". Back to sign-in, keeping nothing.
    sessionExpired() {
      if (this.state.demo || !this.state.me) return;
      this.setState({ screen: 'login', me: null, boot: null, empId: '', pin: '', drawerOpen: false, live: EMPTY_LIVE(), meds: null, favs: [], selChat: null, selNotice: null, selStaff: null, busy: {} });
      this.toastMsg('Your session has expired — sign in again.');
    }
    // Keep the screen fresh without a socket: the open thread every 5 s (only what is
    // new), rooms / notices / requests / handover every 30 s, presence every minute.
    tick() {
      if (this.state.demo || !this.state.me || (typeof document !== 'undefined' && document.hidden)) return;
      const t = ++this._tick, s = this.state;
      if (s.screen === 'thread' && s.selChat) this.loadThread(s.selChat, true);
      if (t % 3 === 0 && s.screen === 'chats') this.loadRooms();
      if (t % 6 === 0) { this.loadNotices(); if (s.screen !== 'chats') this.loadRooms(); this.loadRequests(); if (s.screen === 'handover') this.loadHandover(); if (/^datacol/.test(s.screen)) this.loadSubs(); }
      if (t % 12 === 0) { this.loadDirectory(); }
      // Features were read once at sign-in: an admin granting/revoking one needed an app restart.
      if (t % 60 === 0) this.loadBoot(true);   // ~5 min
    }
    // Sign-in landed: remember who we are, then read the phone profile and the registers.
    enter(me) {
      const u = me.user || {};
      this.setState({ me: Object.assign({ perms: me.perms, staffScope: me.staffScope }, u), booting: false, screen: 'home', drawerOpen: false, pin: '', live: EMPTY_LIVE() });
      this.loadBoot().then(() => this.loadLive(u));
    }
    // quiet = the periodic / back-online re-read: one attempt, and on failure keep what we have
    // (no toast, no fallback to default features); on success swap the profile only — no redirect
    // mid-use, and the chat filter / prefs the person is using are left alone.
    async loadBoot(quiet) {
      const url = '/api/phone/bootstrap' + (this.state.unitSel ? '?unit=' + encodeURIComponent(this.state.unitSel) : '');
      let b = null;
      if (quiet) {
        try { b = await api(url); } catch (e) { return; }
        if (!b || !b.ok || !b.user || !this.state.me) return;
        const qr = b.user.role;
        this.setState({ boot: b, role: (b.user.isIncharge || b.user.canManage || b.user.isAdmin) ? 'incharge' : (qr === 'pca' ? 'pca' : qr === 'collector' ? 'collector' : 'nurse') });
        return;
      }
      for (let i = 0; i < 3 && !b; i++) { try { b = await api(url); } catch (e) { console.warn('[nurse] bootstrap attempt ' + (i + 1) + ' failed: ' + (e.status || '') + ' ' + (e.message || e)); if (e.status === 401) break; await new Promise((r) => setTimeout(r, 700 * (i + 1))); } }
      if (!b || !b.ok) { console.warn('[nurse] bootstrap unusable: ' + JSON.stringify(b).slice(0, 300)); this.toastMsg('Could not load your app profile — some features may be hidden.'); this.setState((s) => ({ boot: { user: s.me || {}, unit: null, units: [], features: defaultFeatures(s.me && s.me.role), hospital: {}, policy: {}, phonebook: [], prefs: {}, favs: [], counts: {} } })); return; }
      // Administrators and managers get the Admin App; /app#nurse keeps them here on purpose.
      if ((b.user.isAdmin || b.user.canManage) && !/nurse/.test(String(window.location.hash || '')) && typeof window.location.replace === 'function') { window.location.replace('/admin'); return; }
      const role = b.user.role;
      const prefs = b.prefs || {};
      this.setState({ boot: b, role: (b.user.isIncharge || b.user.canManage || b.user.isAdmin) ? 'incharge' : (role === 'pca' ? 'pca' : role === 'collector' ? 'collector' : 'nurse'), favs: Array.isArray(b.favs) ? b.favs : [], notifOn: prefs.notifOn !== false, biometric: prefs.biometric !== false, wakeOnShift: !!prefs.wakeOnShift, chatDept: 'All', cDepts: b.unit ? { [b.unit.id]: true } : {} });
    }
    F() { const b = this.state.boot; return (b && b.features) || defaultFeatures(this.state.me && this.state.me.role); }
    allowed(screen) { const fid = SCREEN_FEATURE[screen]; return !fid || this.F()[fid] !== false; }
    unit() { const b = this.state.boot; return (b && b.unit) || null; }
    unitQ() { const u = this.unit(); return u ? '?dept=' + encodeURIComponent(u.id) : ''; }
    // Pick a unit (administrators and managers, or a nurse posted to several units).
    setUnit(id) {
      try { localStorage.setItem('unico.unit', id || ''); } catch (e) { /* private mode */ }
      this.setState({ unitSel: id || '', live: Object.assign({}, this.state.live, { roster: null, handover: null, report: null }) });
      this.setState({ reLoaded: '' });
      this.loadBoot().then(() => this.loadUnitData());
    }
    patchLive(k, v) { this.setState((s) => ({ live: Object.assign({}, s.live, { [k]: v }) })); }
    async loadLive(u) {
      const F = this.F(), unit = this.unit();
      const deptsRes = await tryApi('/api/departments');
      const depts = deptsRes && deptsRes.ok && Array.isArray(deptsRes.departments) ? deptsRes.departments : null;
      if (depts) this.patchLive('depts', depts);
      const staffRes = await tryApi('/api/staff');
      const staff = staffRes && staffRes.ok && Array.isArray(staffRes.staff) ? staffRes.staff : null;
      if (staff) this.patchLive('staff', staff);
      this.loadDirectory(); this.loadNotices(); this.loadRooms(); this.loadRequests();
      if (F.medReq) this.loadMedRequests();
      if (F.performance) this.loadPerf();
      if (F.datacol || F.datacolHist) {
        await this.loadSubs();
        const q = await tryApi('/api/quality'); if (q && q.ok && Array.isArray(q.quality)) this.patchLive('quality', q.quality);
      }
      await this.loadUnitData();
      if (F.meds) {
        const medRes = await tryApi('/api/med/browse?per=60&page=1');
        if (medRes && medRes.ok && Array.isArray(medRes.rows) && medRes.rows.length) { const meds = medRes.rows.map(liveMed); this.patchLive('meds', meds); this.setState({ meds, selMed: meds[0].id, medClass: 'All' }); }
        else { this.patchLive('medsError', true); this.setState({ meds: [] }); }
      }
    }
    // Everything that belongs to ONE unit: its roster, handover board, report and shift reports.
    async loadUnitData() {
      const F = this.F(), unit = this.unit();
      if (!unit) return;
      if (F.roster) { const ros = await tryApi('/api/rosters/' + encodeURIComponent(unit.name) + '/' + Y + '/' + M); this.patchLive('roster', ros && ros.ok && ros.roster && ros.roster.grid ? ros.roster : null); }
      if (F.handover) this.loadHandover();
      if (F.reports) { this.loadReport(); this.loadShiftReports(); }
      if (F.unitStaff || F.rosterEdit) this.loadUnitStaff();
    }
    async loadUnitStaff() { if (!this.unit()) return; const r = await tryApi('/api/phone/unit-staff' + this.unitQ()); if (r && r.ok) this.patchLive('unitStaff', r.staff || []); }
    // The editable sheet for the month on screen (draft or published).
    async loadRosterEdit(force) {
      const s = this.state, unit = this.unit(); if (!unit) return;
      const key = unit.id + ':' + s.reYear + ':' + s.reMonth; if (!force && s.reLoaded === key) return;
      const r = await tryApi('/api/phone/roster' + this.unitQ() + '&year=' + s.reYear + '&month=' + s.reMonth);
      if (!r || !r.ok) return;
      const doc = r.roster || null;
      this.setState({ reLoaded: key, reGrid: doc && doc.grid ? JSON.parse(JSON.stringify(doc.grid)) : {}, reOrder: doc && doc.order && doc.order.length ? doc.order.slice() : null, reStatus: doc ? doc.status : 'draft', reDirty: false, reNote: (doc && doc.note) || '', reCanEdit: !!r.canEdit, reRevision: doc ? doc.revision : 0, reUpdated: doc ? doc.updatedAt : null });
      this.patchLive('rosterDoc', doc);
    }
    setReMonth(delta) { const d = new Date(this.state.reYear, this.state.reMonth + delta, 1); this.setState({ reYear: d.getFullYear(), reMonth: d.getMonth(), reDay: 1, rePickOpen: false }, () => this.loadRosterEdit()); }
    setCode(sid, day, code) { this.setState((s) => { const g = Object.assign({}, s.reGrid); const row = Object.assign({}, g[sid] || {}); if (code) row[day] = code; else delete row[day]; g[sid] = row; return { reGrid: g, reDirty: true, rePickOpen: false }; }); }
    editDay(fn) { this.setState((s) => { const g = {}; Object.keys(s.reGrid).forEach((k) => { g[k] = Object.assign({}, s.reGrid[k]); }); fn(g, s); return { reGrid: g, reDirty: true }; }); }
    saveRoster(status) {
      const s = this.state, unit = this.unit(); if (!unit) return;
      const order = (s.reOrder || (s.live.unitStaff || []).map((p) => 'S' + p.id));
      const names = {}; (s.live.unitStaff || []).forEach((p) => { names['S' + p.id] = p.name; });
      if (s.demo) { this.setState({ reStatus: status, reDirty: false }); return this.toastMsg(status === 'submitted' ? 'Roster submitted for approval' : 'Draft saved'); }
      this.act('roster', () => api('/api/phone/roster', { method: 'PUT', body: { dept: unit.id, year: s.reYear, month: s.reMonth, grid: s.reGrid, order, names, status, note: s.reNote } }), (r) => { if (r && r.roster) { this.setState({ reStatus: r.roster.status, reDirty: false, reRevision: r.roster.revision, reUpdated: r.roster.updatedAt }); this.patchLive('rosterDoc', r.roster); this.toastMsg(status === 'submitted' ? 'Roster submitted to administration for approval' : 'Draft saved · rev ' + r.roster.revision); if (s.reYear === Y && s.reMonth === M) this.loadUnitData(); } });
    }
    async loadDirectory() { if (!this.F().staffDir) return; const r = await tryApi('/api/phone/directory'); if (r && r.ok) this.patchLive('directory', r.accounts || []); }
    async loadNotices() { if (!this.F().notices) return; const r = await tryApi('/api/phone/notices'); if (r && r.ok) this.patchLive('notices', r.notices || []); }
    async loadRooms() { if (!this.F().chatDept) return; const r = await tryApi('/api/phone/rooms'); if (r && r.ok) this.patchLive('rooms', r.rooms || []); }
    async loadThread(id, incremental) {
      const cur = this.state.live.threads[id];
      const since = incremental && cur && cur.now ? cur.now : 0;
      const r = await tryApi('/api/phone/rooms/' + encodeURIComponent(id) + '/messages' + (since ? '?since=' + since : ''));
      if (!r || !r.ok) return;
      this.setState((s) => {
        const prev = s.live.threads[id];
        const msgs = since && prev ? prev.messages.concat((r.messages || []).filter((m) => !prev.messages.some((x) => x.id === m.id))) : (r.messages || []);
        return { live: Object.assign({}, s.live, { threads: Object.assign({}, s.live.threads, { [id]: { room: r.room, members: r.members || [], messages: msgs, now: r.now } }) }) };
      });
    }
    async loadRequests() { if (!this.F().requests) return; const r = await tryApi('/api/phone/requests'); if (r && r.ok) this.patchLive('requests', { mine: r.mine || [], team: r.team || [] }); }
    async loadHandover() { if (!this.unit()) return; const r = await tryApi('/api/phone/handover' + this.unitQ()); if (r && r.ok) this.patchLive('handover', r); }
    async loadMedRequests() { const r = await tryApi('/api/phone/med-requests'); if (r && r.ok) this.patchLive('medRequests', r.requests || []); }
    async loadPerf() { const r = await tryApi('/api/phone/my-performance'); if (r && r.ok) this.patchLive('perf', r); }
    async loadReport() { if (!this.unit()) return; const r = await tryApi('/api/phone/unit-report' + this.unitQ()); if (r && r.ok) this.patchLive('report', r); this.setState({ repUpdated: timeNow(), refreshing: false }); }
    async loadShiftReports() { const r = await tryApi('/api/phone/shift-reports'); if (r && r.ok) this.patchLive('shiftReports', r.reports || []); }
    // My submissions, every page — the server scopes a collector's rows BEFORE paging, so
    // nextOffset walks only mine. One page of 300 used to drop the rest as "not submitted".
    async loadSubs() { const rows = await pageAll('/api/submissions?limit=300', 'submissions', 10); if (rows) this.patchLive('subs', rows); }

    toastMsg(msg, key) { const k = key || 'toast'; this.setState({ [k]: msg }); clearTimeout(this['_t_' + k]); this['_t_' + k] = setTimeout(() => this.setState({ [k]: '' }), 2600); }
    go = (screen, extra) => {
      if (!this.allowed(screen)) return this.toastMsg('This feature is switched off for your role.');
      this.setState(Object.assign({ screen, drawerOpen: false }, extra || {}));
      if (screen === 'rosterEdit') { if (!this.state.live.unitStaff) this.loadUnitStaff(); this.loadRosterEdit(); }
      if (screen === 'unitStaff' && !this.state.live.unitStaff) this.loadUnitStaff();
    };
    // A guarded write: one in flight per key, errors become a toast, success reloads.
    async act(key, fn, after) {
      if (this.state.busy[key]) return;
      this.setState((s) => ({ busy: Object.assign({}, s.busy, { [key]: true }) }));
      try { const r = await fn(); if (after) await after(r); return r; }
      catch (e) { this.toastMsg(e.status === 403 ? (e.message || 'Not allowed.') : e.status === 429 ? (e.message || 'Too many requests — wait a moment.') : (e.message || 'The server did not accept that.')); return null; }
      finally { this.setState((s) => { const b = Object.assign({}, s.busy); delete b[key]; return { busy: b }; }); }
    }
    savePrefs(patch) {
      this.setState(patch);
      if (this.state.demo) return;
      const s = Object.assign({}, this.state, patch);
      tryApi('/api/phone/me/state', { method: 'PATCH', body: { prefs: { notifOn: s.notifOn, biometric: s.biometric, wakeOnShift: s.wakeOnShift } } });
    }
    saveFavs(favs) { this.setState({ favs }); if (!this.state.demo) tryApi('/api/phone/me/state', { method: 'PATCH', body: { favs } }); }

    async doLogin() {
      const username = this.state.empId.trim().toLowerCase(), password = this.state.pin;
      if (!username || !password) return this.toastMsg('Enter your employee ID and PIN.');
      this.setState({ loginBusy: true });
      try {
        await api('/api/login', { method: 'POST', body: { username, password } });
        const me = await api('/api/me');
        this.setState({ loginBusy: false });
        this.enter(me);
      } catch (e) {
        this.setState({ loginBusy: false });
        this.toastMsg(e.status === 401 ? 'Wrong employee ID or PIN.' : e.status === 429 ? (e.message || 'Too many attempts. Try again shortly.') : 'Could not reach the hospital server.');
      }
    }
    signOut() {
      if (this.state.demo) { window.location.hash = ''; }
      fetch('/logout', { credentials: 'same-origin' }).catch(() => {});
      this.setState({ screen: 'login', me: null, boot: null, demo: false, empId: '', pin: '', drawerOpen: false, live: EMPTY_LIVE(), meds: null, favs: [], selChat: null, selNotice: null, selStaff: null });
    }

    /* ------------------------------------------------------- live actions --- */
    // Notices
    openNotice(n) {
      this.setState({ screen: 'noticeDetail', selNotice: n.id, commentDraft: '' });
      if (n.read) return;
      this.mutateNotice(n.id, { read: true });
      if (!this.state.demo) tryApi('/api/phone/notices/' + encodeURIComponent(n.id) + '/read', { method: 'POST' });
    }
    mutateNotice(id, patch) { this.setState((s) => ({ live: Object.assign({}, s.live, { notices: (s.live.notices || []).map((n) => (n.id === id ? Object.assign({}, n, patch) : n)) }) })); }
    noticeAction(n, action, body, patch) {
      this.mutateNotice(n.id, patch || {});
      if (this.state.demo) return;
      this.act('notice:' + action, () => api('/api/phone/notices/' + encodeURIComponent(n.id) + '/' + action, { method: 'POST', body: body || {} }), () => this.loadNotices());
    }
    markAllRead() { this.setState((s) => ({ live: Object.assign({}, s.live, { notices: (s.live.notices || []).map((n) => Object.assign({}, n, { read: true })) }) })); if (!this.state.demo) tryApi('/api/phone/notices/read-all', { method: 'POST' }); }
    sendComment(n, text) {
      const t = String(text || '').trim(); if (!t) return;
      const me = this.state.me || {};
      this.setState({ commentDraft: '' });
      if (this.state.demo) return this.mutateNotice(n.id, { comments: (n.comments || []).concat([{ from: me.name, when: timeNow(), text: t }]) });
      this.act('comment', () => api('/api/phone/notices/' + encodeURIComponent(n.id) + '/comments', { method: 'POST', body: { text: t } }), (r) => { if (r && r.comments) this.mutateNotice(n.id, { comments: r.comments }); });
    }
    publishNotice(body) {
      if (this.state.demo) { const me = this.state.me; const id = Date.now(); this.setState((s) => ({ composeSent: true, live: Object.assign({}, s.live, { notices: [{ id, cat: body.cat, pinned: body.pinned, needsAck: body.needsAck, attachments: [], ackCount: 0, ackTotal: 14, title: body.title, when: 'Just now', from: me.name, fromRole: me.designation + ', LDR', audience: body.audience === 'all' ? 'All nursing staff' : body.audience === 'incharges' ? 'All in-charges' : 'LDR', body: body.body.split('\n')[0], full: body.body, poll: body.poll ? { q: body.poll.q, opts: body.poll.opts, votes: body.poll.opts.map(() => 0) } : null, read: true }].concat(s.live.notices || []) }), cTitle: '', cBody: '', cPollQ: '', cPollOpts: ['', ''], cAttach: false, cPoll: false })); return; }
      this.act('publish', () => api('/api/phone/notices', { method: 'POST', body }), () => { this.setState({ composeSent: true, cTitle: '', cBody: '', cPollQ: '', cPollOpts: ['', ''], cAttach: false, cPoll: false }); this.loadNotices(); });
    }
    // Chat
    openChat(id) {
      this.setState({ screen: 'thread', selChat: id, drawerOpen: false, selMsg: null, replyTo: null, roomInfoOpen: false, attachOpen: false });
      this.setState((s) => ({ live: Object.assign({}, s.live, { rooms: (s.live.rooms || []).map((r) => (r.id === id ? Object.assign({}, r, { unread: 0 }) : r)) }) }));
      if (!this.state.demo) this.loadThread(id, false);
    }
    openDM(person) {
      if (person && person.username === (this.state.me || {}).username) return;
      if (this.state.demo) { const existing = (this.state.live.rooms || []).find((r) => !r.group && r.name === person.name); if (existing) return this.openChat(existing.id); const id = 'dm-' + norm(person.name); this.setState((s) => ({ live: Object.assign({}, s.live, { rooms: [{ id, name: person.name, scope: 'dept', dept: person.dept, group: false, members: 2, online: !!person.online, sub: `${person.title || person.role} · ${person.online ? 'online' : 'offline'}`, unread: 0, when: Date.now(), last: null, role: person.title }].concat(s.live.rooms || []), threads: Object.assign({}, s.live.threads, { [id]: { room: { id, name: person.name, scope: 'dm', group: false, pinned: null, sub: person.title }, members: [], messages: [] } }) }) })); return this.openChat(id); }
      if (!person || !person.username) return this.toastMsg((person && person.name ? person.name : 'This person') + ' has no app account yet.');
      this.act('dm', () => api('/api/phone/dm', { method: 'POST', body: { username: person.username } }), (r) => { if (r && r.room) { this.loadRooms(); this.openChat(r.room.id); } });
    }
    sendMsg(roomId, text, extra) {
      const s = this.state, t = String(text || '').trim();
      if (!t && !s.pendingAttach) return;
      const th = s.live.threads[roomId];
      const body = { text: t, urgent: !!s.urgent, attach: s.pendingAttach ? { name: s.pendingAttach.name, type: s.pendingAttach.type } : null, replyTo: s.replyTo != null && th && th.messages[s.replyTo] ? th.messages[s.replyTo].id : null };
      this.setState({ draft: '', urgent: false, replyTo: null, pendingAttach: null, attachOpen: false });
      const append = (m) => this.setState((st) => { const cur = st.live.threads[roomId] || { room: { id: roomId, name: '', group: true }, members: [], messages: [] }; return { live: Object.assign({}, st.live, { threads: Object.assign({}, st.live.threads, { [roomId]: Object.assign({}, cur, { messages: cur.messages.concat([m]) }) }), rooms: (st.live.rooms || []).map((r) => (r.id === roomId ? Object.assign({}, r, { last: { text: m.text || (m.attach && m.attach.name) || '', from: 'You', mine: true, urgent: m.urgent }, when: m.ts }) : r)) }) }; });
      if (s.demo) { const orig = body.replyTo && th ? th.messages.find((x) => x.id === body.replyTo) : null; return append({ id: 'm' + Date.now(), from: { username: 'demo', name: 'You', role: '' }, text: t, urgent: body.urgent, attach: body.attach, replyTo: orig ? { from: orig.from.name, text: orig.text } : null, reactions: [], ts: Date.now(), mine: true }); }
      this.act('send', () => api('/api/phone/rooms/' + encodeURIComponent(roomId) + '/messages', { method: 'POST', body }), (r) => { if (r && r.message) append(r.message); });
    }
    reactMsg(roomId, m, label) {
      this.setState({ selMsg: null });
      const apply = (reactions) => this.setState((st) => { const cur = st.live.threads[roomId]; if (!cur) return null; return { live: Object.assign({}, st.live, { threads: Object.assign({}, st.live.threads, { [roomId]: Object.assign({}, cur, { messages: cur.messages.map((x) => (x.id === m.id ? Object.assign({}, x, { reactions }) : x)) }) }) }) }; });
      const cur = m.reactions || [], has = cur.find((r) => r.label === label);
      apply(has ? cur.map((r) => (r.label === label ? Object.assign({}, r, { n: r.n + (r.mine ? -1 : 1), mine: !r.mine }) : r)).filter((r) => r.n > 0) : cur.concat([{ label, n: 1, mine: true }]));
      if (!this.state.demo) tryApi('/api/phone/rooms/' + encodeURIComponent(roomId) + '/messages/' + encodeURIComponent(m.id) + '/react', { method: 'POST', body: { label } });
    }
    pinMsg(roomId, m) {
      this.setState({ selMsg: null });
      const pinned = m ? { id: m.id, text: m.text || (m.attach && m.attach.name) || '', from: m.from.name } : null;
      this.setState((st) => { const cur = st.live.threads[roomId]; return cur ? { live: Object.assign({}, st.live, { threads: Object.assign({}, st.live.threads, { [roomId]: Object.assign({}, cur, { room: Object.assign({}, cur.room, { pinned }) }) }) }) } : null; });
      if (!this.state.demo) this.act('pin', () => api('/api/phone/rooms/' + encodeURIComponent(roomId) + '/pin', { method: 'POST', body: { mid: m ? m.id : null } }));
    }
    deleteMsg(roomId, m) {
      this.setState({ selMsg: null });
      if (this.state.demo) return this.setState((st) => { const cur = st.live.threads[roomId]; return { live: Object.assign({}, st.live, { threads: Object.assign({}, st.live.threads, { [roomId]: Object.assign({}, cur, { messages: cur.messages.filter((x) => x.id !== m.id) }) }) }) }; });
      this.act('del', () => api('/api/phone/rooms/' + encodeURIComponent(roomId) + '/messages/' + encodeURIComponent(m.id), { method: 'DELETE' }), () => this.loadThread(roomId, false));
    }
    muteRoom(roomId, on) {
      this.setState((st) => ({ live: Object.assign({}, st.live, { rooms: (st.live.rooms || []).map((r) => (r.id === roomId ? Object.assign({}, r, { muted: on }) : r)) }) }));
      if (!this.state.demo) { const muted = {}; (this.state.live.rooms || []).forEach((r) => { muted[r.id] = r.id === roomId ? on : !!r.muted; }); tryApi('/api/phone/me/state', { method: 'PATCH', body: { muted } }); }
    }
    leaveRoom(room) {
      if (this.state.demo || room.scope === 'hosp' || (room.group && /^dept:/.test(room.id))) { this.muteRoom(room.id, true); this.setState({ roomInfoOpen: false, screen: 'chats' }); return this.toastMsg(room.group && !this.state.demo ? 'Unit and hospital rooms cannot be left — muted instead' : 'You left ' + room.name); }
      this.act('leave', () => api('/api/phone/rooms/' + encodeURIComponent(room.id) + '/leave', { method: 'POST' }), () => { this.setState({ roomInfoOpen: false, screen: 'chats' }); this.toastMsg('You left ' + room.name); this.loadRooms(); });
    }
    createGroup(name, scope, members) {
      if (this.state.demo) { const id = 'room-' + Date.now(); this.setState((s) => ({ newGroupOpen: false, live: Object.assign({}, s.live, { rooms: [{ id, name, scope, dept: 'LDR', group: true, members: members.length + 1, online: true, sub: `${members.length + 1} members · created by you`, unread: 0, when: Date.now(), last: null }].concat(s.live.rooms || []), threads: Object.assign({}, s.live.threads, { [id]: { room: { id, name, scope, group: true, pinned: null }, members: [], messages: [{ id: 'sys', from: { username: 'demo', name: 'You' }, text: `Created the room "${name}".`, ts: Date.now(), mine: true, reactions: [] }] } }) }) })); return this.openChat(id); }
      this.act('room', () => api('/api/phone/rooms', { method: 'POST', body: { name, scope, members } }), (r) => { if (r && r.room) { this.setState({ newGroupOpen: false }); this.loadRooms(); this.openChat(r.room.id); } });
    }
    // Requests
    submitRequest(body) {
      if (this.state.demo) { const rec = Object.assign({ id: 'r' + Date.now(), status: 'pending', by: { username: 'demo', name: this.state.me.name }, createdAt: Date.now(), deptName: 'LDR' }, body); return this.setState((s) => ({ reqSent: true, reqReason: '', live: Object.assign({}, s.live, { requests: { mine: [rec].concat(s.live.requests.mine), team: s.live.requests.team } }) })); }
      this.act('req', () => api('/api/phone/requests', { method: 'POST', body }), () => { this.setState({ reqSent: true, reqReason: '' }); this.loadRequests(); });
    }
    decideRequest(r, status) {
      if (this.state.demo) return this.setState((s) => ({ live: Object.assign({}, s.live, { requests: { mine: s.live.requests.mine, team: s.live.requests.team.map((x) => (x.id === r.id ? Object.assign({}, x, { status, decidedBy: { name: s.me.name }, decidedAt: Date.now() }) : x)) } }) }));
      this.act('decide:' + r.id, () => api('/api/phone/requests/' + encodeURIComponent(r.id) + '/decide', { method: 'POST', body: { status } }), () => this.loadRequests());
    }
    // Handover
    addHandover(item) {
      if (this.state.demo) return this.setState((s) => ({ handoverDraft: '', live: Object.assign({}, s.live, { handover: Object.assign({}, s.live.handover, { items: s.live.handover.items.concat([Object.assign({ id: 'h' + Date.now(), done: false, by: { name: s.me.name } }, item)]) }) }) }));
      const u = this.unit(); this.act('handover', () => api('/api/phone/handover', { method: 'POST', body: Object.assign({ dept: u ? u.id : undefined }, item) }), () => { this.setState({ handoverDraft: '' }); this.loadHandover(); });
    }
    toggleHandover(it) {
      this.setState((s) => ({ live: Object.assign({}, s.live, { handover: Object.assign({}, s.live.handover, { items: s.live.handover.items.map((x) => (x.id === it.id ? Object.assign({}, x, { done: !x.done }) : x)) }) }) }));
      if (!this.state.demo) this.act('ho:' + it.id, () => api('/api/phone/handover/' + encodeURIComponent(it.id) + '/toggle', { method: 'POST' }));
    }
    // Incident
    submitIncident(body) {
      if (this.state.demo) return this.setState({ incSent: true, incDesc: '', incRef: 'IR-' + Y + '-0912' });
      this.act('incident', () => api('/api/phone/incidents', { method: 'POST', body }), (r) => { if (r && r.incident) this.setState({ incSent: true, incDesc: '', incRef: r.incident.ref }); });
    }
    // Medicine request
    submitMedRequest(body) {
      if (this.state.demo) return this.setState((s) => ({ mrSent: true, live: Object.assign({}, s.live, { medRequests: [Object.assign({ id: 'm' + Date.now(), createdAt: Date.now(), status: body.urgent ? 'Urgent · paged' : 'In review', reply: null }, body)].concat(s.live.medRequests || []) }) }));
      this.act('medreq', () => api('/api/phone/med-requests', { method: 'POST', body }), () => { this.setState({ mrSent: true }); this.loadMedRequests(); });
    }
    // Shift report
    submitShiftReport(body) {
      if (this.state.demo) return this.setState((s) => ({ srSent: true, srStep: 0, live: Object.assign({}, s.live, { shiftReports: [Object.assign({ id: 's' + Date.now(), status: 'Submitted', by: { name: s.me.name }, deptName: 'LDR', createdAt: Date.now() }, body)].concat(s.live.shiftReports || []) }) }));
      this.act('shiftrep', () => api('/api/phone/shift-reports', { method: 'POST', body }), () => { this.setState({ srSent: true, srStep: 0 }); this.loadShiftReports(); });
    }
    // Medicines
    openMed(m) {
      if (!m) return;
      this.setState({ screen: 'medDetail', selMed: m.id, medTab: 'overview', drawerOpen: false });
      if (m.live && !this.state.medDetail[m.id]) {
        tryApi('/api/med/brand/' + encodeURIComponent(m.id)).then((r) => {
          if (!r || !r.ok) return;
          const g = r.generic || {}, sec = normaliseMonograph(g.monograph || g.sections || {});
          this.setState((s) => ({ medDetail: Object.assign({}, s.medDetail, { [m.id]: { sec, nursing: sec['Precautions And Warnings'] ? String(sec['Precautions And Warnings']).split(/\n|\. /)[0] + '.' : '' } }) }));
        });
      }
    }
    searchMeds(q) {
      const term = String(q || '').trim();
      clearTimeout(this._medT);
      if (!this.state.live.meds || term.length < 2) return;
      this._medT = setTimeout(() => {
        tryApi('/api/med/search?q=' + encodeURIComponent(term) + '&kind=brand&limit=30').then((r) => {
          if (!r || !r.ok || !Array.isArray(r.brands)) return;
          this.setState({ medSearch: { q: term.toLowerCase(), rows: r.brands.map(liveMed) } });
        });
      }, 250);
    }
    // Data collection: the console's own submissions API.
    async submitDc(item, monthObj, x) {
      const s = this.state, mi = clamp(s.dcMonth, 0, DC_MONTHS.length - 1), at = dayStamp();
      const local = (status, extra) => this.setState({ dcSubs: Object.assign({}, s.dcSubs, { [mi]: Object.assign({}, s.dcSubs[mi] || {}, { [item.id]: Object.assign({ status, num: x.num, den: x.den, vals: x.vals, at, note: x.note, reason: null, reviewer: '' }, extra || {}) }) }), dcFormSent: true, dcCorr: '', dcEvidence: false });
      if (s.demo) return local('sent');
      // One send at a time: a double tap created two pending submissions. The instance flag
      // closes the gap before the busy state has rendered.
      if (this._dcBusy) return;
      this._dcBusy = true; this.setState((st) => ({ busy: Object.assign({}, st.busy, { dc: true }) }));
      try {
        const corr = x.isCorr ? String(x.corr || '').trim() : '';
        if (item.kind === 'stat') {
          if (!x.dept) throw new Error('Your account is not linked to a department sheet.');
          const values = {}; (item.fields || []).forEach((f, i) => { if (x.vals[i] !== '' && x.vals[i] != null) values[f.id] = x.vals[i]; });
          await api('/api/submissions/patient', { method: 'POST', body: { department: x.dept.id || x.dept._id, month: monthObj.key, values, note: x.note, isCorrection: !!x.isCorr, correctionReason: corr } });
        } else {
          if (!x.area) throw new Error('Your account is not linked to a quality area.');
          const ind = item.ind || {}, rate = !!item.isRate;
          // Mirrors the desktop collector form: a COUNT goes as {value, formula:'count'} (always
          // sending entryMode:'rate' made approval turn counts into a %), and an admin-owned
          // denominator is never sent — the administrator's figure stands.
          await api('/api/submissions/quality', { method: 'POST', body: { area: x.area.key, indicatorId: item.id, indicatorName: item.label, month: monthObj.key, entryMode: rate ? 'rate' : 'count', formula: rate ? item.formula : 'count', mult: rate ? item.mult : 1, valueType: rate ? (item.formula === 'pct' ? '%' : 'Rate') : 'Count',
            value: rate ? undefined : x.num, num: rate ? x.num : undefined, den: rate && !item.denLocked ? x.den : undefined, numLabel: rate ? item.num : undefined, denLabel: rate ? item.den : undefined, unit: rate ? (ind.unit || item.unit) : (ind.unit || 'count'),
            remark: x.note, note: x.note, benchmark: ind.benchmark, benchmarkValue: ind.benchmarkValue, goalDirection: ind.goalDirection, isCorrection: !!x.isCorr, correctionReason: corr } });
        }
        await this.loadSubs();
        this.setState({ dcFormSent: true, dcCorr: '', dcEvidence: false, dcVals: {} });
      } catch (e) { this.toastMsg(e.message || 'The server did not accept the submission.', 'dcToast'); }
      finally { this._dcBusy = false; this.setState((st) => { const b = Object.assign({}, st.busy); delete b.dc; return { busy: b }; }); }
    }

    /* --------------------------------------------------------- view-model --- */
    renderVals() {
      const s = this.state, go = this.go, live = s.live, me = s.me || {}, boot = s.boot || {}, F = this.F();
      const bu = boot.user || {};
      const isIncharge = s.role === 'incharge', isNurse = !isIncharge;
      const staffName = me.name || bu.name || '';
      const designation = me.designation || me.title || bu.roleLabel || (me.role === 'incharge' ? 'Nurse In-charge' : me.role === 'pca' ? 'Patient Care Assistant' : me.role === 'collector' ? 'Data collector' : 'Staff Nurse');
      const unit = boot.unit || null;
      const units = boot.units || [];
      const dept = unit ? (unit.short || unit.name) : (units.length ? 'All units' : '—');
      const isRealIncharge = me.role === 'incharge';
      // A collector scoped only to quality areas (qualityAreas / allQualityAreas, no unit) got an
      // empty dashboard: their items come from the server-scoped /api/quality areas instead,
      // stepped through with the same unit chip.
      const qAreas = !unit && !s.demo && me.role === 'collector' ? (live.quality || []) : [];
      const qArea = qAreas.find((a) => String(a.key) === String(s.dcAreaSel)) || qAreas[0] || null;
      const unitChip = unit ? (unit.short || unit.name) + (units.length > 1 ? ' ▾' : '') : qArea ? (qArea.name || qArea.key) + (qAreas.length > 1 ? ' ▾' : '') : (units.length ? 'Choose a unit ▾' : 'No unit assigned');
      const pickUnit = () => { if (!unit && qAreas.length > 1) { const i = qAreas.indexOf(qArea); return this.setState({ dcAreaSel: qAreas[(i + 1) % qAreas.length].key }); } if (units.length <= 1) { if (!unit && units[0]) this.setUnit(units[0].id); return; } const i = units.findIndex((x) => unit && x.id === unit.id); this.setUnit(units[(i + 1) % units.length].id); };
      const hospital = boot.hospital || s.branding || {};
      const phonesOn = F.phones !== false && !(boot.policy && boot.policy.portalPhones === false);
      const staffAll = live.staff || [];
      const myRec = staffAll.find((p) => (me.empId && p.emp_id && norm(p.emp_id) === norm(me.empId)) || (me.staffEmpId && p.emp_id && norm(p.emp_id) === norm(me.staffEmpId)) || (staffName && norm(p.name) === norm(staffName))) || null;
      const empIdShown = me.empId || (myRec && myRec.emp_id) || (me.username ? '@' + me.username : '—');
      const initials = ini(staffName || '?');
      const hour = NOW.getHours();
      const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
      const inMyUnit = (p) => { const d = String(p.current_department || ''); return unit ? d.split(',').some((x) => norm(x) === norm(unit.name) || norm(x) === norm(unit.id) || (unit.short && norm(x) === norm(unit.short))) : true; };
      const gridOf = (p) => (live.roster && live.roster.grid && p && live.roster.grid['S' + p.id]) || null;
      const codeOn = (row, d) => { if (!row) return ''; const c = Array.isArray(row) ? row[d - 1] : row[d]; return c == null ? '' : String(c); };

      /* ---- roster: the published sheet for me; nothing is invented ---- */
      const ROSTER = {}; let rosterLive = false;
      const myRow = gridOf(myRec);
      if (myRow) { for (let d = 1; d <= DIM; d++) ROSTER[d] = codeOn(myRow, d) || 'O'; rosterLive = true; }
      else for (let d = 1; d <= DIM; d++) ROSTER[d] = '';
      const todayCode = ROSTER[TODAY], today = shiftOf(todayCode);
      const sel = clamp(s.selDay, 1, DIM), selCode = ROSTER[sel], selSh = shiftOf(selCode);
      const todayLabel = dateLabel(TODAY);
      const nextShiftCode = (() => { for (let d = TODAY + 1; d <= DIM; d++) if (isWork(ROSTER[d])) return ROSTER[d]; return rosterLive ? '—' : ''; })();
      const rosterNote = rosterLive ? (live.roster.status === 'approved' ? 'published' : 'draft') : (live.roster ? 'you are not on this sheet' : 'not published yet');

      /* ---- staff: the register, with presence from the app directory ---- */
      const dir = live.directory || [];
      const acctOf = (p) => dir.find((a) => (a.staffEmpId && p.emp && norm(a.staffEmpId) === norm(p.emp)) || norm(a.name) === norm(p.name)) || null;
      const STAFF = staffAll.filter((p) => !p.former && p.is_active !== false).map((p) => {
        const row = gridOf(p);
        const base = { name: p.name, dept: String(p.current_department || '').split(',')[0].trim() || '—', title: p.designation || (p.role === 'PCA' ? 'Patient Care Assistant' : 'Staff Nurse'), admin: /in.?charge|manager|supervisor/i.test(p.designation || ''), phone: phonesOn ? (p.phone || p.mobile || '') : '', ext: phonesOn ? (p.ext || '') : '', email: p.email || '', emp: p.emp_id || '', reg: p.bnmc || p.reg_no || '—', shift: row ? (codeOn(row, TODAY) || 'O') : '', joined: p.doj ? fmtIso(p.doj) : (p.joined || ''), id: p.id, photo: p.photo || null, isPca: p.role === 'PCA', mine: inMyUnit(p) };
        base.photoUrl = p.photo ? (typeof p.photo === 'string' ? p.photo : p.photo.url) : (p.photo_url || null);
        base.role = [base.title, base.dept].join(', ');
        const a = acctOf(base); base.username = a ? a.username : null; base.online = !!(a && a.online); base.hasApp = !!a;
        return base;
      });
      const unitStaff = STAFF.filter((p) => p.mine);
      const onlineN = STAFF.filter((p) => p.online).length;

      /* ---- notices ---- */
      const ALL_NOTICES = (live.notices || []).map((n) => noticeOf(n, me.username)).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.ts || 0) - (a.ts || 0));
      const noticeRaw = ALL_NOTICES.find((n) => n.id === s.selNotice) || ALL_NOTICES[0] || { id: null, cat: 'General', title: 'No notice selected', body: '', full: '', from: '—', fromRole: '', when: '', audience: '', attachments: [], comments: [], ackPending: [], ackCount: 0, ackTotal: 0 };
      const noticeSrc = (live.notices || []).find((n) => n.id === noticeRaw.id) || null;
      const unread = ALL_NOTICES.filter((n) => !n.read);
      const needsAction = ALL_NOTICES.filter((n) => n.needsAck && !n.acked);
      const reqs = live.requests || { mine: [], team: [] };
      const pendingCount = reqs.team.filter((r) => r.status === 'pending').length;

      /* ---- calendar ---- */
      const calCells = [];
      for (let i = 0; i < FIRST_DOW; i++) calCells.push({ d: '', code: '', style: 'border:0;background:transparent;min-height:48px', dayStyle: '', codeStyle: '', go: () => {} });
      for (let d = 1; d <= DIM; d++) {
        const code = ROSTER[d], sh = shiftOf(code), isT = d === TODAY, isSel = d === sel, off = !isWork(code);
        calCells.push({ d, code: code === '' ? '·' : code, go: () => go('shift', { selDay: d }),
          style: `display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;min-height:48px;border-radius:10px;cursor:pointer;padding:4px 0;border:1.5px solid ${isSel ? '#0090ca' : isT ? 'rgba(0,144,202,.45)' : 'transparent'};background:${isSel ? 'rgba(0,144,202,.12)' : off ? 'rgba(125,145,180,.08)' : 'rgba(255,255,255,.55)'}`,
          dayStyle: `font-size:12px;font-weight:${isT ? 800 : 600};color:${isT ? '#0072a3' : '#16202e'}`,
          codeStyle: MONO + `;font-size:9.5px;font-weight:700;padding:1px 5px;border-radius:5px;color:${sh.color};background:${sh.bg}` });
      }
      const codes = Object.values(ROSTER);
      const shiftsN = codes.filter(isWork).length, nights = codes.filter((c) => bucketOf(c) === 'N').length, offN = rosterLive ? codes.length - shiftsN : 0;
      const hours = codes.reduce((a, c) => a + (isWork(c) ? hoursOf(c) : 0), 0);
      const upcoming = []; for (let d = TODAY; d < TODAY + 7; d++) { const dd = ((d - 1) % DIM) + 1; upcoming.push({ d: dd, dow: dowOf(dd), code: ROSTER[dd] === '' ? '·' : ROSTER[dd], go: () => go('shift', { selDay: dd }), codeStyle: codeChip(ROSTER[dd]),
        style: `flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;padding:8px 2px;border-radius:12px;cursor:pointer;color:#16202e;border:1.5px solid ${dd === TODAY ? '#0090ca' : 'rgba(255,255,255,.9)'};background:${dd === TODAY ? 'rgba(0,144,202,.1)' : 'rgba(255,255,255,.6)'}` }); }
      // On duty with me: whoever in my unit shares my code on the selected day.
      const team = unitStaff.filter((p) => p.name !== staffName && selCode && isWork(selCode) && codeOn(gridOf(staffAll.find((x) => x.id === p.id)), sel) === selCode).slice(0, 8)
        .map((p) => ({ ini: ini(p.name), name: p.name, role: p.title, code: selCode, tel: tel(p.phone), chat: () => this.openDM(p), username: p.username }));

      /* ---- medicines ---- */
      const meds = s.meds || [];
      const q = s.medQuery.trim().toLowerCase();
      const classes = live.meds ? ['All', ...Array.from(new Set(meds.map((m) => m.cat).filter(Boolean))).slice(0, 10)] : MED_CATS;
      const medPool = (q && s.medSearch && s.medSearch.q === q && s.medSearch.rows.length) ? [...meds, ...s.medSearch.rows.filter((r) => !meds.some((m) => m.id === r.id))] : meds;
      const medList = medPool.filter((m) => (s.medClass === 'All' || m.cat === s.medClass) && (!s.alertOnly || m.alert) && (!q || [m.brand, m.generic, m.cls, m.mfr, m.cat].some((x) => String(x || '').toLowerCase().includes(q))))
        .map((m) => ({ ...m, go: () => this.openMed(m), imgStyle: `width:52px;height:52px;border-radius:12px;border:1px solid rgba(125,145,180,.2);flex-shrink:0;background:#fff ${m.img ? `url(${m.img}) center/calc(100% - 8px) no-repeat` : ''}` }));
      const medRaw = medPool.find((m) => m.id === s.selMed) || meds[0] || { id: '', brand: live.medsError ? 'Catalogue unavailable' : '', generic: '', cls: '', cat: '', route: '', strength: '', img: '', mfr: '', price: '', alert: false, nursing: '', facts: { max: '', food: 'any', preg: 'safe' }, sec: {} };
      const detail = s.medDetail[medRaw.id] || {};
      const allSec = Object.assign({}, s.mono[medRaw.id] || {}, medRaw.sec || {}, detail.sec || {});
      const med = { ...medRaw, maxDose: (medRaw.facts && medRaw.facts.max) || '—', food: FOODS[medRaw.facts && medRaw.facts.food] || '—', preg: (PREGS[medRaw.facts && medRaw.facts.preg] || PREGS.safe)[0], pregColor: (PREGS[medRaw.facts && medRaw.facts.preg] || PREGS.safe)[1], nursing: medRaw.nursing || detail.nursing || 'Confirm the prescription, dose and route against the drug chart. Check allergies before the first dose.',
        imgStyle: `width:92px;height:92px;border-radius:18px;border:1px solid rgba(125,145,180,.2);flex-shrink:0;box-shadow:0 10px 26px rgba(31,59,90,.12);background:#fff ${medRaw.img ? `url(${medRaw.img}) center/calc(100% - 12px) no-repeat` : ''}` };
      const tabKeys = Object.assign({}, MED_TABS, { more: [...MED_TABS.more, ...Object.keys(allSec).filter((k) => !Object.values(MED_TABS).some((arr) => arr.includes(k)))] });
      const medSections = (tabKeys[s.medTab] || []).filter((k) => allSec[k]).map((k) => ({ label: k, color: SEC_COLOR[k] || '#3c4858', text: allSec[k] }));
      const isFav = s.favs.includes(med.id);
      const medReqs = live.medRequests || [];

      /* ---- chat ---- */
      const ALL_CHATS = (live.rooms || []).map(chatOf);
      const cq = s.chatSearch.trim().toLowerCase();
      const roomDepts = Array.from(new Set(ALL_CHATS.filter((c) => c.scope === 'dept' && c.dept).map((c) => c.dept)));
      const chatsVisible = ALL_CHATS.filter((c) => cq ? ((c.name + ' ' + (c.last ? c.last.text : '')).toLowerCase().includes(cq)) : (s.chatTab === 'hosp' ? c.scope === 'hosp' : c.scope !== 'hosp' && (s.chatDept === 'All' || c.dept === s.chatDept)));
      const chatUnreadTotal = ALL_CHATS.reduce((a, c) => a + (c.muted ? 0 : c.unread), 0);
      const threadRoom = ALL_CHATS.find((c) => c.id === s.selChat) || null;
      const th = (s.selChat && live.threads[s.selChat]) || null;
      const threadRaw = Object.assign({ id: s.selChat, name: threadRoom ? threadRoom.name : 'Conversation', group: threadRoom ? threadRoom.group : true, scope: threadRoom ? threadRoom.scope : 'dept', sub: threadRoom ? threadRoom.sub : '', pinned: threadRoom ? threadRoom.pinned : null, readOnly: !!(threadRoom && threadRoom.readOnly), members: threadRoom ? threadRoom.members : 0 }, th ? { name: th.room.name || (threadRoom && threadRoom.name), sub: th.room.sub || (threadRoom && threadRoom.sub) || '', pinned: th.room.pinned, readOnly: !!th.room.readOnly, group: th.room.group !== undefined ? !!th.room.group : (threadRoom ? threadRoom.group : true), other: th.room.other } : {});
      const msgs = th ? th.messages : [];
      const pinnedMsg = threadRaw.pinned || null;
      const canPin = isIncharge || !threadRaw.group || bu.canManage;
      const messages = msgs.map((m, i) => { const mine = !!m.mine; const selected = s.selMsg === i; const reactions = (m.reactions || []).map((r) => r.n > 1 ? `${r.label} · ${r.n}` : r.label); const isPinned = !!(pinnedMsg && pinnedMsg.id === m.id); return { text: m.text, time: hm(new Date(m.ts || 0)), sender: m.from.name, role: m.from.role || '', ini: ini(m.from.name || '?'), showSender: !mine && threadRaw.group, urgent: !!m.urgent, seen: mine ? (m.seen || (i === msgs.length - 1 ? 'Delivered' : 'Seen')) : null,
        replyTo: m.replyTo ? `${m.replyTo.from ? m.replyTo.from + ': ' : ''}${m.replyTo.text}` : null, attach: m.attach ? m.attach.name : null, attachIcon: ATTACH_ICONS[m.attach && m.attach.type] || ATTACH_ICONS.pdf, selected, hasReactions: reactions.length > 0, reactions,
        select: () => this.setState({ selMsg: selected ? null : i }),
        rowStyle: `display:flex;gap:8px;justify-content:${mine ? 'flex-end' : 'flex-start'}`,
        colStyle: `display:flex;flex-direction:column;align-items:${mine ? 'flex-end' : 'flex-start'};max-width:80%;gap:4px`,
        bubbleStyle: `display:block;width:100%;box-sizing:border-box;text-align:left;cursor:pointer;font-family:inherit;padding:9px 12px 6px;border-radius:${mine ? '16px 16px 4px 16px' : '16px 16px 16px 4px'};${m.system ? 'background:rgba(125,145,180,.12);color:#3c4858;border:0;font-style:italic' : mine ? 'background:linear-gradient(140deg,#0aa0d4,#0072a3);color:#fff;border:0' : 'background:rgba(255,255,255,.85);color:#16202e;border:1px solid rgba(255,255,255,.95)'};${m.urgent ? 'box-shadow:0 0 0 2px rgba(210,58,82,.45),0 4px 14px rgba(31,59,90,.08)' : selected ? 'box-shadow:0 0 0 2px rgba(0,144,202,.45),0 4px 14px rgba(31,59,90,.08)' : 'box-shadow:0 4px 14px rgba(31,59,90,.08)'}`,
        replyStyle: `border-left:3px solid ${mine ? 'rgba(255,255,255,.7)' : '#0090ca'};padding:3px 8px;margin-bottom:5px;font-size:11.5px;border-radius:4px;background:${mine ? 'rgba(255,255,255,.15)' : 'rgba(0,144,202,.08)'};color:${mine ? 'rgba(255,255,255,.9)' : '#3c4858'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis`,
        attachStyle: `display:flex;align-items:center;gap:8px;padding:7px 9px;margin-bottom:6px;border-radius:9px;font-size:12px;font-weight:600;background:${mine ? 'rgba(255,255,255,.18)' : 'rgba(0,144,202,.08)'};color:${mine ? '#fff' : '#0072a3'}`,
        timeStyle: MONO + `;font-size:9.5px;margin-top:3px;text-align:right;color:${mine ? 'rgba(255,255,255,.7)' : '#9aa6b4'}`,
        reactRow: 'display:flex;gap:4px;flex-wrap:wrap;margin-top:-8px;padding:0 4px;position:relative;z-index:1',
        actionRow: 'display:flex;gap:5px;flex-wrap:wrap;padding:2px 0;animation:pop .2s ease',
        actions: [{ label: 'Reply', go: () => this.setState({ selMsg: null, replyTo: i }) }, { label: 'Ack', go: () => this.reactMsg(threadRaw.id, m, 'Ack') }, { label: 'On it', go: () => this.reactMsg(threadRaw.id, m, 'On it') },
          ...(canPin ? [{ label: isPinned ? 'Unpin' : 'Pin', go: () => this.pinMsg(threadRaw.id, isPinned ? null : m) }] : []),
          ...(mine && Date.now() - (m.ts || 0) < 10 * 60000 ? [{ label: 'Delete', go: () => this.deleteMsg(threadRaw.id, m) }] : [{ label: 'Forward', go: () => this.setState({ selMsg: null, screen: 'chats', draft: m.text }) }])] }; });
      const replyingTo = s.replyTo !== null && msgs[s.replyTo] ? `${msgs[s.replyTo].mine ? 'You' : msgs[s.replyTo].from.name}: ${msgs[s.replyTo].text}` : null;
      const sendMsg = (text) => this.sendMsg(threadRaw.id, typeof text === 'string' ? text : s.draft);
      const openChat = (id) => this.openChat(id);
      const roomMembers = (th ? th.members : []).map((m) => { const p = STAFF.find((x) => x.username === m.username || norm(x.name) === norm(m.name)) || {}; return Object.assign({ name: m.name, title: m.role, role: m.role, online: !!m.online, admin: !!m.admin, dept: p.dept || '' }, p, { ini: ini(m.name || '?'), username: m.username }); });
      const isMuted = !!(threadRoom && threadRoom.muted);
      const threadPerson = !threadRaw.group ? (STAFF.find((p) => p.username && p.username === threadRaw.other) || STAFF.find((p) => p.name === threadRaw.name) || null) : null;
      const avOf = (c) => ({ av: c.group ? (c.scope === 'hosp' ? 'HC' : ini(c.name || '?')) : ini(c.name || '?'), avStyle: avStyle(c.group) });

      /* ---- staff directory ---- */
      const sq = s.staffSearch.trim().toLowerCase();
      const lastActiveOf = (p) => p.online ? 'Active now' : p.hasApp ? 'Offline' : 'No app account';
      const deptList = ['All', ...(unit ? [unitStaff[0] ? unitStaff[0].dept : dept] : []), ...Array.from(new Set(STAFF.map((p) => p.dept))).filter(Boolean)].filter((d, i, a) => a.indexOf(d) === i);
      const staffList = STAFF.filter((p) => p.name !== staffName && (s.staffDept === 'All' || p.dept === s.staffDept) && (!s.staffOnlineOnly || p.online) && (!sq || (p.name + ' ' + p.role + ' ' + p.dept + ' ' + p.ext + ' ' + p.phone).toLowerCase().includes(sq)))
        .sort((a, b) => s.staffSort === 'active' ? (b.online ? 1 : 0) - (a.online ? 1 : 0) || (b.hasApp ? 1 : 0) - (a.hasApp ? 1 : 0) || (b.mine ? 1 : 0) - (a.mine ? 1 : 0) || a.name.localeCompare(b.name) : a.name.localeCompare(b.name));
      const person = STAFF.find((p) => p.name === s.selStaff) || staffList[0] || STAFF[0] || { name: '—', title: '', dept: '', role: '', phone: '', ext: '', email: '', emp: '', reg: '', shift: '', joined: '', online: false, hasApp: false };
      const personSh = shiftOf(person.shift);
      const personRooms = ALL_CHATS.filter((c) => c.group && (c.dept === person.dept || c.scope === 'hosp')).slice(0, 3).map((c) => ({ name: c.name, members: c.members, go: () => openChat(c.id) }));
      const canCall = !!person.phone;
      const phonebookRows = (boot.phonebook || []).map((r) => Array.isArray(r) ? { sec: r[0], label: r[1], sub: r[2], num: r[3] } : r);
      const phonebook = Array.from(new Set(phonebookRows.map((r) => r.sec))).map((sec) => { const look = PHONE_LOOK[sec] || PHONE_LOOK._; return { sec, items: phonebookRows.filter((r) => r.sec === sec && (!sq || (r.label + ' ' + r.sub).toLowerCase().includes(sq))).map((r) => ({ label: r.label, sub: r.sub, num: r.num, d: look[2], tel: tel(r.num), iconWrap: `display:grid;place-items:center;width:36px;height:36px;border-radius:11px;color:${look[0]};background:${look[1]};flex-shrink:0`, style: 'display:flex;align-items:center;gap:11px;border:1px solid rgba(255,255,255,.9);border-radius:14px;padding:10px 12px;background:rgba(255,255,255,.66)', numStyle: MONO + `;display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700;padding:7px 10px;border-radius:9px;color:${look[0]};background:${look[1]};text-decoration:none;white-space:nowrap` })) }; }).filter((g) => g.items.length);

      /* ---- reports (in-charge): the unit's registers, normalised ---- */
      const R = s.demo ? reportOf(null) : reportOf(live.report || { cols: [], months: [], series: {}, indicators: [], staffing: null });
      const nL = R.labels.length;
      const periodOpts = R.live ? [['month', 'Latest month'], ['q', 'Last 3 months'], ['half', 'Last 6 months']] : [['today', 'Today'], ['week', 'This week'], ['month', 'This month'], ['quarter', 'Quarter']];
      const periodK = periodOpts.some((p) => p[0] === s.repPeriod) ? s.repPeriod : periodOpts[R.live ? 0 : 1][0];
      const periodLabel = periodOpts.find((p) => p[0] === periodK)[1];
      const win = R.live ? ({ month: 1, q: 3, half: 6 }[periodK] || 1) : (periodK === 'today' ? 1 : nL);
      const W = (a) => (a || []).slice(-win);
      const admT = sum(W(R.adm)), disT = sum(W(R.dis)), nvdT = sum(W(R.nvd)), csT = sum(W(R.cs)), deathsT = sum(W(R.deaths)), transT = sum(W(R.transfers));
      const occAvgN = R.occ ? Math.round(sum(W(R.occ)) / Math.max(1, W(R.occ).length)) : null;
      const csRateN = Math.round(csT / Math.max(1, csT + nvdT) * 100);
      const BEDS = R.beds, bedsUsed = BEDS && R.occ ? Math.round(BEDS * (R.occ[nL - 1] || 0) / 100) : null;
      const last = (a) => (a && a.length ? a[a.length - 1] : 0), prev = (a) => (a && a.length > 1 ? a[a.length - 2] : 0);
      const deltaOf = (a, pct) => { const d = last(a) - prev(a); if (!prev(a) && !last(a)) return '0'; return pct ? (d >= 0 ? '+' : '−') + Math.abs(Math.round(d / Math.max(1, prev(a)) * 100)) + '%' : (d >= 0 ? '+' : '−') + Math.abs(d); };
      const prevNote = R.live ? 'vs previous month' : 'vs previous week';
      const INDS = R.indicators;
      const indColor = (i) => (i.noData ? '#9aa6b4' : RAG[ragOf(i)][0]);
      const indicatorsAlertRaw = INDS.filter((i) => !i.noData && ragOf(i) !== 'green');
      const eventsSeries = INDS.length ? INDS[0].trend.map((_, k) => INDS.reduce((a, i) => a + (i.noData ? 0 : (i.trend[k] || 0) > (i.dir === 'up' ? -1 : i.benchV) ? 1 : 0), 0)) : R.labels.map(() => 0);
      const kpiDef = [
        { k: 'adm', label: 'Admissions', v: admT, delta: deltaOf(R.adm, true), good: last(R.adm) >= prev(R.adm), note: prevNote, series: R.adm, color: '#0090ca' },
        { k: 'dis', label: 'Discharges', v: disT, delta: deltaOf(R.dis, true), good: last(R.dis) >= prev(R.dis), note: prevNote, series: R.dis, color: '#3ab5a7' },
        ...(R.hasDel !== false ? [{ k: 'del', label: 'Deliveries', v: nvdT + csT, delta: deltaOf(R.nvd.map((n, i) => n + (R.cs[i] || 0))), good: true, note: `${nvdT} NVD · ${csT} CS`, series: R.nvd.map((n, i) => n + (R.cs[i] || 0)), color: '#6a52d4' }] : []),
        ...(R.occ ? [{ k: 'occ', label: 'Occupancy', v: occAvgN + '%', delta: deltaOf(R.occ) + ' pts', good: occAvgN < 85, note: BEDS ? `${bedsUsed} of ${BEDS} beds now` : 'average', series: R.occ, color: '#e08a1e' }] : []),
        { k: 'deaths', label: 'Deaths', v: deathsT, delta: deltaOf(R.deaths), good: !deathsT, note: R.live ? 'this period' : 'this week', series: R.deaths, color: '#d23a52' },
        { k: 'ev', label: 'Indicators off target', v: indicatorsAlertRaw.length, delta: INDS.length ? `of ${INDS.length}` : '—', good: !indicatorsAlertRaw.length, note: indicatorsAlertRaw.slice(0, 2).map((i) => i.name).join(' · ') || 'all on target', series: eventsSeries, color: '#b8650a' },
      ];
      const repKpis = kpiDef.slice().sort((a, b) => (s.pinnedKpis[b.k] ? 1 : 0) - (s.pinnedKpis[a.k] ? 1 : 0)).map((k) => ({ label: k.label, v: k.v, delta: k.delta, note: k.note, color: k.color, spark: spark(k.series, k.color), pin: (e) => { if (e && e.stopPropagation) e.stopPropagation(); this.setState({ pinnedKpis: { ...s.pinnedKpis, [k.k]: !s.pinnedKpis[k.k] } }); }, pinFill: s.pinnedKpis[k.k] ? '#e08a1e' : 'none', pinStyle: `display:grid;place-items:center;width:20px;height:20px;border-radius:6px;color:${s.pinnedKpis[k.k] ? '#e08a1e' : '#c4ccd6'};cursor:pointer`,
        deltaStyle: `font-size:11px;font-weight:700;padding:2px 6px;border-radius:6px;color:${k.good ? '#1d8f57' : '#b32e2e'};background:${k.good ? 'rgba(43,182,115,.13)' : 'rgba(214,69,69,.12)'}`,
        style: `display:flex;flex-direction:column;align-items:flex-start;gap:6px;text-align:left;border:1px solid ${s.pinnedKpis[k.k] ? 'rgba(224,138,30,.4)' : 'rgba(255,255,255,.9)'};border-radius:15px;padding:12px 13px;background:rgba(255,255,255,.66);cursor:pointer;color:#16202e`, go: () => this.setState({ repTab: k.k === 'ev' ? 'quality' : k.k === 'occ' || k.k === 'adm' || k.k === 'dis' || k.k === 'deaths' ? 'census' : 'overview' }) }));
      const censusMax = Math.max(...R.adm, ...R.dis, 1);
      const PREV = { adm: R.adm.map((_, i) => (i ? R.adm[i - 1] : 0)) };
      const censusBars = R.labels.map((lbl, i) => { const tip = `${lbl}: ${R.adm[i]} admissions, ${R.dis[i]} discharges, ${(R.nvd[i] || 0) + (R.cs[i] || 0)} deliveries`; return { label: lbl.split(' ')[0], tip: `${lbl}: ${R.adm[i]} admissions · ${R.dis[i]} discharges`, go: () => this.setState({ censusTip: s.censusTip === tip ? '' : tip }),
        colStyle: 'flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;height:100%;border:0;background:transparent;padding:0;cursor:pointer',
        a: `width:10px;height:${Math.max(6, Math.round(R.adm[i] / censusMax * 84))}px;border-radius:3px 3px 0 0;background:#0090ca`, b: `width:10px;height:${Math.max(6, Math.round(R.dis[i] / censusMax * 84))}px;border-radius:3px 3px 0 0;background:#3ab5a7`, p: `width:6px;height:${Math.max(6, Math.round(PREV.adm[i] / censusMax * 84))}px;border-radius:3px 3px 0 0;background:rgba(125,145,180,.45)` }; });
      const idot = (c) => `width:8px;height:8px;border-radius:50%;background:${c};flex-shrink:0;margin-top:6px`;
      const worst = indicatorsAlertRaw.slice().sort((a, b) => (ragOf(a) === 'red' ? 0 : 1) - (ragOf(b) === 'red' ? 0 : 1))[0] || null;
      const insights = [
        { text: `${admT} admissions and ${disT} discharges ${R.live ? 'in the ' + periodLabel.toLowerCase() : 'this week'} (${kpiDef[0].delta} ${prevNote}).${occAvgN != null ? ` Average occupancy ${occAvgN}%${occAvgN >= 85 ? ' — above the 85% safe-capacity line' : ''}.` : ''}`, dot: idot('#0090ca'), action: null, go: () => {} },
        ...(nvdT + csT ? [{ text: `${nvdT + csT} deliveries · CS rate ${csRateN}%.`, dot: idot('#e08a1e'), action: null, go: () => {} }] : []),
        ...(worst ? [{ text: `${worst.name} is ${ragOf(worst) === 'red' ? 'in breach' : 'off target'}: ${worst.v}${worst.unit === '%' ? '%' : ''} against ${worst.bench}.`, dot: idot(ragOf(worst) === 'red' ? '#d23a52' : '#e08a1e'), action: 'Open indicator', go: () => go('indicator', { selInd: worst.id }) }] : []),
        { text: INDS.length ? `${INDS.filter((i) => !i.noData && ragOf(i) === 'green').length} of ${INDS.length} indicators on target${INDS.some((i) => i.noData) ? ` · ${INDS.filter((i) => i.noData).length} without data this month` : ''}.` : 'No quality indicators are configured for this unit yet.', dot: idot('#1d8f57'), action: null, go: () => {} },
      ];
      const indRow = (i) => ({ name: i.name, bench: i.bench, unit: i.unit, v: i.noData ? '—' : i.v + (String(i.unit).startsWith('%') ? '%' : ''), color: indColor(i), dot: dot(indColor(i)), spark: spark(i.trend, indColor(i)), go: () => go('indicator', { selInd: i.id }), info: (e) => { if (e && e.stopPropagation) e.stopPropagation(); this.setState({ infoOpen: true, infoInd: i.id }); } });
      const indicatorsAlert = indicatorsAlertRaw.map(indRow);
      const indicators = INDS.map(indRow);
      const ragSummary = ['green', 'amber', 'red'].map((k) => ({ n: INDS.filter((i) => !i.noData && ragOf(i) === k).length, label: RAG[k][2], dot: dot(RAG[k][0]) }));
      const occRows = R.occ ? [[dept, last(R.occ)]].map(([l, v]) => ({ label: l, v: v + '%', bar: `height:100%;width:${v}%;border-radius:999px;background:${v >= 90 ? 'linear-gradient(90deg,#e08a1e,#d23a52)' : 'linear-gradient(90deg,#3ab5a7,#0090ca)'}` })) : (s.demo ? [['LDR', 92], ['PNW', 78], ['ANW', 70], ['HDU', 100]].map(([l, v]) => ({ label: l, v: v + '%', bar: `height:100%;width:${v}%;border-radius:999px;background:${v >= 90 ? 'linear-gradient(90deg,#e08a1e,#d23a52)' : 'linear-gradient(90deg,#3ab5a7,#0090ca)'}` })) : []);
      const occBars = R.occ ? R.labels.map((lbl, i) => ({ label: lbl.split(' ')[0], v: R.occ[i], bar: `width:100%;max-width:26px;height:${Math.round(R.occ[i] / 100 * 70)}px;border-radius:4px 4px 0 0;background:${R.occ[i] >= 85 ? 'linear-gradient(180deg,#e08a1e,#d23a52)' : '#0090ca'}` })) : [];
      const censusTiles = [['Admissions', admT, '#0072a3'], ['Discharges', disT, '#1e8a7c'], ['NVD', nvdT, '#3ab5a7'], ['Caesarean', csT, '#0090ca'], ['Deaths', deathsT, '#b32e2e'], ['Transfers', transT, '#6a52d4']].map(([label, v, color]) => ({ label, v, color }));
      const censusTable = R.labels.map((day, i) => ({ day, adm: R.adm[i], dis: R.dis[i], nvd: R.nvd[i] || 0, cs: R.cs[i] || 0, style: `display:grid;grid-template-columns:1.2fr repeat(4,1fr);gap:4px;padding:9px 12px;font-size:12.5px;border-top:1px solid rgba(125,145,180,.12);${i === nL - 1 ? 'background:rgba(0,144,202,.06)' : ''}` }));
      // Staffing today, from the unit's roster and the approved leave requests.
      const todayIso = isoDay(TODAY);
      const onLeaveToday = reqs.team.filter((r) => r.type === 'leave' && r.status === 'approved' && r.date === todayIso).map((r) => r.by && r.by.name);
      const byBucket = { M: [], E: [], N: [], G: [] };
      unitStaff.forEach((p) => { const b = bucketOf(p.shift); if (byBucket[b] && isWork(p.shift)) byBucket[b].push(p); });
      const staffShiftDef = (s.demo ? [['M4', 'Morning', 5, 5], ['E3', 'Evening', 4, 3], ['N2', 'Night', 3, 3]] : [['M', 'Morning'], ['E', 'Evening'], ['N', 'Night'], ['G', 'General']].filter(([b]) => byBucket[b].length || b !== 'G').map(([b, name]) => { const planned = byBucket[b].length; const absent = byBucket[b].filter((p) => onLeaveToday.indexOf(p.name) >= 0).length; return [byBucket[b][0] ? byBucket[b][0].shift : b, name, planned, planned - absent]; }));
      const staffShifts = staffShiftDef.map(([code, name, planned, actual]) => ({ code, name, planned, actual, codeStyle: codeChip(code), color: actual < planned ? '#b32e2e' : '#1d8f57', bar: `position:absolute;left:0;top:0;bottom:0;width:${planned ? Math.round(actual / planned * 100) : 0}%;border-radius:999px;background:${actual < planned ? 'linear-gradient(90deg,#e08a1e,#d23a52)' : 'linear-gradient(90deg,#3ab5a7,#0090ca)'}`, gap: actual < planned ? `${planned - actual} short — on approved leave today` : null }));
      const leaveCodesToday = unitStaff.filter((p) => isLeave(p.shift));
      const staffTiles = [{ label: 'On duty today', v: staffShiftDef.reduce((a, x) => a + x[3], 0), color: '#0072a3', note: `across ${staffShiftDef.length} shifts` }, { label: 'Planned', v: staffShiftDef.reduce((a, x) => a + x[2], 0), color: '#3c4858', note: rosterLive || s.demo ? 'from roster' : 'no roster published' }, { label: 'Absent', v: s.demo ? 2 : onLeaveToday.length + leaveCodesToday.length, color: '#b32e2e', note: s.demo ? '1 sick · 1 leave' : `${onLeaveToday.length} leave approved · ${leaveCodesToday.length} rostered off` }];
      const absenceRows = (s.demo ? [['Tanvir Hossain', 'Sick leave · today', 'SICK', '#b32e2e', 'rgba(214,69,69,.12)'], ['Rahima Khatun', `Annual leave · ${clamp(TODAY + 14, 1, DIM)}–${clamp(TODAY + 18, 1, DIM)} ${MON3[M]} · pending`, 'LEAVE', '#b8650a', 'rgba(224,138,30,.15)'], ['Shathi Rani', 'Casual leave · yesterday', 'CL', '#1d8f57', 'rgba(43,182,115,.14)'], ['Sumaiya Akter', `Swap with you · ${clamp(TODAY + 4, 1, DIM)} ${MON3[M]}`, 'SWAP', '#0072a3', 'rgba(0,144,202,.13)']]
        : reqs.team.filter((r) => r.status !== 'declined' && r.date >= todayIso).slice(0, 8).map((r) => [(r.by && r.by.name) || '—', `${r.type === 'leave' ? (r.leaveType || 'Casual') + ' leave' : 'Swap ' + (r.code || '')} · ${fmtIso(r.date)} · ${r.status}`, r.type === 'leave' ? 'LEAVE' : 'SWAP', r.status === 'approved' ? '#1d8f57' : '#b8650a', r.status === 'approved' ? 'rgba(43,182,115,.14)' : 'rgba(224,138,30,.15)'])).map(([name, detail, tag, c, bg]) => ({ ini: ini(name), name, detail, tag, tagStyle: `font-size:9.5px;font-weight:800;letter-spacing:.5px;padding:3px 7px;border-radius:6px;color:${c};background:${bg}` }));
      const shiftReps = (live.shiftReports || []).map((r) => ({ id: r.id, date: fmtIso(r.date), rawDate: r.date, shift: r.shift, status: r.status, meta: `${(r.by && r.by.name) || '—'} · ${(r.counts && r.counts.adm) || 0} adm · ${((r.counts && r.counts.nvd) || 0) + ((r.counts && r.counts.cs) || 0)} deliveries · ${['falls', 'mederr', 'needle', 'code'].reduce((a, k) => a + ((r.counts && r.counts[k]) || 0), 0)} events` }));
      const submittedReports = shiftReps.map((r) => ({ shift: r.shift, shiftName: shiftOf(r.shift).name, date: r.date, meta: r.meta, status: r.status, codeStyle: codeChip(r.shift), statusStyle: statusStyle(r.status === 'Approved' ? 'Approved' : r.status === 'Returned' ? 'Declined' : 'Pending'), go: () => this.toastMsg('Report ' + r.date + ' ' + r.shift + ' · ' + r.status, 'exportToast') }));
      const simpleTiles = [{ label: R.live ? 'Admissions · latest month' : 'Admissions today', v: last(R.adm), color: '#0072a3', bg: 'rgba(0,144,202,.13)', d: NAV_D.home, note: `${last(R.dis)} discharged${BEDS ? ` · ${bedsUsed} of ${BEDS} beds full` : ''}`, go: () => this.setState({ repTab: 'census', repSimple: false }) }, { label: R.live ? 'Deliveries · latest month' : 'Deliveries today', v: last(R.nvd) + last(R.cs), color: '#3ab5a7', bg: 'rgba(58,181,167,.16)', d: 'M12 2v20M2 12h20', note: `${last(R.nvd)} normal · ${last(R.cs)} caesarean`, go: () => this.setState({ repTab: 'census', repSimple: false }) }, { label: 'Needs attention', v: indicatorsAlert.length, color: '#b32e2e', bg: 'rgba(214,69,69,.12)', d: NAV_D.incident, note: indicatorsAlert.map((i) => i.name).slice(0, 2).join(' · ') || 'all indicators on target', go: () => this.setState({ repTab: 'quality', repSimple: false }) }];
      const repTabDef = [['overview', 'Overview'], ['census', 'Census'], ['quality', 'Quality'], ['staffing', 'Staffing'], ['submitted', 'Submitted']];
      const repTabName = (repTabDef.find((t) => t[0] === s.repTab) || repTabDef[0])[1];
      const summaryText = `${dept} · ${periodLabel}\n${admT} admissions · ${disT} discharges · ${nvdT + csT} deliveries (CS ${csRateN}%)\n${occAvgN != null ? 'Occupancy ' + occAvgN + '% · ' : ''}${deathsT} death${deathsT === 1 ? '' : 's'} · ${indicatorsAlert.length} indicator${indicatorsAlert.length === 1 ? '' : 's'} need attention\nPrepared by ${staffName} · ${dayStamp()}`;
      const NO_IND = { id: '', name: 'No indicator', unit: '', v: 0, bench: '—', benchV: 0, dir: 'down', trend: [], num: '', numV: '—', den: '', denV: '—', formula: '', capa: [], noData: true };
      const infoIndRaw = INDS.find((i) => i.id === s.infoInd) || INDS[0] || NO_IND;

      /* ---- indicator detail ---- */
      const indRaw = INDS.find((i) => i.id === s.selInd) || INDS[0] || NO_IND;
      const indRag = indRaw.noData ? 'amber' : ragOf(indRaw), indC = indRaw.noData ? '#9aa6b4' : RAG[indRag][0];
      const trendMax = Math.max(1, ...indRaw.trend, indRaw.benchV || 0);
      const lastM = indRaw.trend.length > 1 ? indRaw.trend[indRaw.trend.length - 2] : indRaw.v;
      const deltaV = Math.round((indRaw.v - lastM) * 10) / 10;
      const better = indRaw.dir === 'up' ? deltaV >= 0 : deltaV <= 0;
      const capaAll = [...(indRaw.capa || []), ...(s.capaExtra[indRaw.id] || [])];
      const indBars = indRaw.trend.map((v, i) => ({ v, label: indRaw.trendLabels && indRaw.trendLabels[i] ? String(indRaw.trendLabels[i]).slice(0, 3) : MON3[(M - (indRaw.trend.length - 1 - i) + 12) % 12], bar: `width:100%;max-width:26px;height:${Math.max(3, Math.round(v / trendMax * 70))}px;border-radius:4px 4px 0 0;background:${i === indRaw.trend.length - 1 ? indC : indC + '66'}` }));
      const capaItems = capaAll.map((c, i) => { const key = indRaw.id + ':' + i; const done = !!s.capaDone[key]; return { text: c.text, owner: c.owner || staffName, due: c.due || dateLabel(clamp(TODAY + 7, 1, DIM)), done, toggle: () => this.setState({ capaDone: { ...s.capaDone, [key]: !done } }), box: box(done), textStyle: `display:block;font-size:13px;font-weight:600;line-height:1.4;${done ? 'text-decoration:line-through;color:#7d8ea8' : ''}` }; });

      /* ---- shift report (6 steps) ---- */
      const step = SR_STEPS[clamp(s.srStep, 0, SR_STEPS.length - 1)];
      const srV = (k) => s.srVals[k] === undefined ? 0 : s.srVals[k];
      const setSr = (k, v) => this.setState({ srVals: { ...s.srVals, [k]: Math.max(0, Number(v) || 0) } });
      const srCounts = (step.fields || []).map(([k, label, hint]) => ({ label, hint: hint || null, v: srV(k), set: (e) => setSr(k, e.target.value), inc: () => setSr(k, srV(k) + 1), dec: () => setSr(k, srV(k) - 1), inputStyle }));
      const srTotal = step.totalKeys ? step.totalKeys.reduce((a, k) => a + srV(k), 0) : null;
      const srReview = [['Shift', `${s.srShift} · ${shiftOf(s.srShift).name} · ${todayLabel}`], ['Census', `${srV('adm')} admitted · ${srV('dis')} discharged · ${srV('deaths')} death(s) · census ${srV('census')}`], ['Deliveries', `${srV('nvd')} NVD · ${srV('cs')} CS · ${srV('assisted')} assisted · ${srV('nicu')} to NICU`], ['Events', `${srV('falls')} falls · ${srV('mederr')} medication errors · ${srV('needle')} needle-stick · ${srV('code')} code blue`], ['Staffing', `${srV('actual')} of ${srV('planned')} nurses · ${srV('pca')} PCA · ${srV('sick')} sick · ${srV('ot')} h overtime`], ['Notes', [s.srNotes.obs, s.srNotes.issues, s.srNotes.handover].filter(Boolean).join(' · ') || '—']].map(([label, v]) => ({ label, v }));
      const srShiftCodes = s.demo ? ['M4', 'E3', 'N2'] : Array.from(new Set([todayCode, ...unitStaff.map((p) => p.shift)].filter(isWork))).slice(0, 4);
      if (!srShiftCodes.length) srShiftCodes.push('M4', 'E3', 'N2');

      /* ---- data collection: the console's own sheet and indicators for my unit ---- */
      const dcDept = s.demo ? null : (live.depts || []).find((d) => unit && (String(d.id || d._id) === String(unit.id) || norm(d.name) === norm(unit.name))) || null;
      const dcArea = s.demo ? null : unit ? (live.quality || []).find((a) => String(a.deptId) === String(unit.id) || norm(a.key) === norm(unit.id) || norm(a.name) === norm(unit.name)) || null : qArea;
      const ITEMS = s.demo ? DC_ITEMS : dcItemsOf(dcDept, dcArea);
      const dcMonth = clamp(s.dcMonth, 0, DC_MONTHS.length - 1);
      const dcM = DC_MONTHS[dcMonth];
      const statFields = ITEMS[0] && ITEMS[0].kind === 'stat' && ITEMS[0].fields ? ITEMS[0].fields : DC_STAT_FIELDS.map((l, i) => ({ id: 'f' + i, label: l }));
      const subsOf = (mi) => Object.assign({}, s.dcSubs[mi] || {}, s.demo ? {} : liveSubsFor(live.subs, DC_MONTHS[mi].key, dcDept && (dcDept.id || dcDept._id), dcArea && dcArea.key, statFields));
      const monthSubs = subsOf(dcMonth);
      const stOf = (sub) => (sub && sub.status) || 'missing';
      const dcItemsRaw = ITEMS.map((it) => ({ ...it, sub: monthSubs[it.id] || null, status: stOf(monthSubs[it.id]) }));
      const dcSent = dcItemsRaw.filter((it) => it.status !== 'missing' && it.status !== 'draft').length;
      const dcTotal = ITEMS.length;
      const openCount = dcItemsRaw.filter((it) => it.status === 'missing' || it.status === 'rejected' || it.status === 'draft').length;
      const stChip = (k) => { const st = DC_ST[k] || DC_ST.missing; return { statusLabel: st[0], statusStyle: `display:inline-flex;align-items:center;gap:5px;font-size:10.5px;font-weight:700;padding:3px 8px;border-radius:999px;color:${st[1]};background:${st[2]};white-space:nowrap;flex-shrink:0`, statusDot: `width:6px;height:6px;border-radius:50%;background:${st[1]}` }; };
      const valueOf = (it, sub) => { if (!sub) return null; if (it.kind === 'stat') return (sub.vals ? sub.vals[0] : null); if (sub.num == null || sub.den == null) return sub.value != null ? sub.value : null; const v = sub.den > 0 ? sub.num / sub.den * it.mult : 0; return Math.round(v * 100) / 100; };
      const fmtV = (it, v) => v == null || v === '' ? null : (it.kind === 'stat' ? `${v} ${statFields[0] ? statFields[0].label.toLowerCase() : ''}` : (it.unit === '%' ? v + '%' : String(v)));
      const withinBench = (it, v) => v == null || it.benchV == null ? true : (it.dir === 'up' ? v >= it.benchV : v <= it.benchV);
      const dcFilterMap = { All: null, Sent: ['sent'], Approved: ['approved'], Returned: ['rejected'], 'Not submitted': ['missing', 'draft'] };
      const dcItems = dcItemsRaw.filter((it) => !dcFilterMap[s.dcFilter] || dcFilterMap[s.dcFilter].includes(it.status)).map((it) => { const v = valueOf(it, it.sub); const ok = it.kind === 'stat' || withinBench(it, v); return { ...it, ...stChip(it.status), go: () => go('datacolForm', { dcSel: it.id, dcFormSent: false, dcGuideOpen: false, dcNote: (it.sub && it.sub.note) || '', dcCorr: '', dcMode: 'direct' }),
        cardStyle: `display:block;text-align:left;width:100%;box-sizing:border-box;border:1px solid ${it.status === 'rejected' ? 'rgba(214,69,69,.35)' : it.status === 'missing' ? 'rgba(224,138,30,.35)' : 'rgba(255,255,255,.9)'};border-radius:14px;padding:11px 13px;background:rgba(255,255,255,${it.status === 'approved' ? '.55' : '.68'});cursor:pointer;color:#16202e`,
        iconWrap: `display:grid;place-items:center;width:36px;height:36px;border-radius:11px;color:${it.kind === 'stat' ? '#0072a3' : '#6a52d4'};background:${it.kind === 'stat' ? 'rgba(0,144,202,.13)' : 'rgba(106,82,212,.12)'};flex-shrink:0`,
        value: fmtV(it, v), valueColor: ok ? '#1d8f57' : '#b32e2e', valueMeta: it.kind === 'stat' ? `${statFields.length} fields sent` : `benchmark ${it.bench}`, at: it.sub ? it.sub.at : '', reason: it.status === 'rejected' && it.sub ? it.sub.reason : null, reviewer: it.sub ? it.sub.reviewer : '' }; });
      const dcItem0 = dcItemsRaw.find((it) => it.id === s.dcSel) || dcItemsRaw[0] || { id: '', kind: 'q', label: 'No items configured', meta: '', num: '', den: '', mult: 1, unit: '', bench: '—', benchV: null, dir: 'down', sub: null, status: 'missing', d: IND_D };
      const dcSub = dcItem0.sub;
      const dcItem = { ...dcItem0, ...stChip(dcItem0.status), isApproved: dcItem0.status === 'approved', isPending: dcItem0.status === 'sent', reason: dcItem0.status === 'rejected' && dcSub ? dcSub.reason : null, reviewer: dcSub ? dcSub.reviewer : '', at: dcSub ? dcSub.at : '' };
      const dcReadOnly = dcItem.isPending || !dcItem0.id;
      const dcEditable = !dcReadOnly;
      const vkey = (k) => dcMonth + ':' + dcItem0.id + ':' + k;
      const dcGet = (k, fallback) => { const v = s.dcVals[vkey(k)]; return v === undefined ? (fallback === undefined ? '' : fallback) : v; };
      const dcSet = (k) => (e) => this.setState({ dcVals: { ...s.dcVals, [vkey(k)]: e.target.value.replace(/[^\d.]/g, '') } });
      const dcStatFields = statFields.map((f, i) => ({ label: f.label, v: dcGet('f' + i, dcSub && dcSub.vals && dcSub.vals[i] != null ? dcSub.vals[i] : ''), set: dcSet('f' + i), style: roStyle(dcReadOnly) + ';width:110px;text-align:right' }));
      const GROUPS = ['Nurses', 'Doctors', 'PCA & support', 'Others'];
      const dcGroups = GROUPS.map((label, i) => ({ label, n: dcGet('gn' + i), d: dcGet('gd' + i), setN: dcSet('gn' + i), setD: dcSet('gd' + i), style: roStyle(dcReadOnly) + ';padding:8px 6px;text-align:center' }));
      const byGroup = dcItem0.grouped && s.dcMode === 'group';
      const pdaysCol = statFields.findIndex((f) => COL_RX.pdays.test(f.id) || COL_RX.pdays.test(f.label));
      const pdaysVal = pdaysCol >= 0 && subsOf(dcMonth).stat && subsOf(dcMonth).stat.vals ? subsOf(dcMonth).stat.vals[pdaysCol] : '';
      const dcNum = byGroup ? String(GROUPS.reduce((a, _, i) => a + (Number(dcGet('gn' + i)) || 0), 0)) : dcGet('num', dcSub && dcSub.num != null ? dcSub.num : '');
      // An admin-owned denominator (denAdminOnly) is read-only: this month's figure, else the last
      // one recorded for any month — the carry-forward the desktop form shows.
      const denMap = (dcItem0.ind && dcItem0.ind.mDen) || {};
      const lockedDen = dcItem0.denLocked ? (denMap[dcM.key] != null && denMap[dcM.key] !== '' ? denMap[dcM.key] : Object.keys(denMap).map((k) => denMap[k]).filter((v) => v != null && v !== '').pop()) : null;
      const isCount = dcItem0.kind === 'q' && dcItem0.isRate === false;
      const dcDen = isCount ? '' : dcItem0.denLocked ? (lockedDen == null ? '' : String(lockedDen)) : byGroup ? String(GROUPS.reduce((a, _, i) => a + (Number(dcGet('gd' + i)) || 0), 0)) : dcGet('den', dcSub && dcSub.den != null ? dcSub.den : (/1000/.test(dcItem0.unit || '') && pdaysVal !== '' ? pdaysVal : ''));
      const numN = Number(dcNum) || 0, denN = Number(dcDen) || 0;
      const resultV = dcItem0.kind !== 'q' ? null : isCount ? (String(dcNum).trim() !== '' ? numN : null) : (denN > 0 ? Math.round(numN / denN * dcItem0.mult * 100) / 100 : null);
      const resultOk = resultV == null ? null : (dcItem0.benchV == null ? null : withinBench(dcItem0, resultV));
      // A month already on the LIVE record is a correction too (not only an approved phone
      // submission), as on the desktop: reason required, flagged for review. An admin-owned
      // denominator alone does not count — the administrator sets it before anyone reports.
      const liveHas = (() => {
        const mk = dcM.key, has = (o) => !!(o && o[mk] != null && o[mk] !== '');
        if (dcItem0.kind === 'q') { const i = dcItem0.ind; return !!i && (has(i.months) || has(i.mNum) || !!(i.mNotObserved && i.mNotObserved[mk]) || !!(i.incidents && Array.isArray(i.incidents[mk]) && i.incidents[mk].length) || (!dcItem0.denLocked && has(i.mDen))); }
        if (dcItem0.kind === 'stat' && dcDept) { const idx = (dcDept.months || []).indexOf(mk); const row = idx >= 0 ? (dcDept.data || {})[String(idx)] : null; return !!row && Object.keys(row).some((k) => row[k] != null && row[k] !== ''); }
        return false;
      })();
      const dcNeedsCorr = !!dcItem0.id && (dcItem.isApproved || liveHas);
      // Rates need a denominator unless the admin owns it (or an explicit 0 over 0); counts need the number.
      const qReady = isCount ? String(dcNum).trim() !== '' : (dcItem0.denLocked || denN > 0 || (numN === 0 && String(dcDen).trim() !== '' && Number(dcDen) === 0));
      const dcSubmitOk = !!dcItem0.id && !s.busy.dc && (dcItem0.kind === 'stat' ? dcStatFields.some((f) => f.v !== '') : qReady) && (!dcNeedsCorr || !!s.dcCorr.trim());
      const histAll = [];
      DC_MONTHS.forEach((mm, mi) => { const subs = subsOf(mi); Object.keys(subs).forEach((id) => { const it = ITEMS.find((x) => x.id === id); if (!it) return; const sub = subs[id]; histAll.push({ mi, it, sub, v: valueOf(it, sub) }); }); });
      histAll.sort((a, b) => b.mi - a.mi || (b.sub.ts || 0) - (a.sub.ts || 0));
      const histFilterMap = { All: null, Pending: ['sent'], Approved: ['approved'], Returned: ['rejected'] };
      const dcHistory = histAll.filter((h) => !histFilterMap[s.dcHistFilter] || histFilterMap[s.dcHistFilter].includes(stOf(h.sub))).map((h) => ({ label: h.it.label, ...stChip(stOf(h.sub)), month: DC_MONTHS[h.mi].label, summary: h.it.kind === 'stat' ? `${h.sub.vals && h.sub.vals[0] !== '' ? h.sub.vals[0] : '—'} ${statFields[0] ? statFields[0].label.toLowerCase() : ''} · ${statFields.length} fields` : (h.sub.num != null && h.sub.den != null ? `${h.sub.num} ÷ ${h.sub.den} → ${fmtV(h.it, h.v)}` : (fmtV(h.it, h.v) || '—')), at: h.sub.at, decision: stOf(h.sub) === 'approved' ? `Approved by ${h.sub.reviewer || 'Quality team'} · counted in the hospital dashboard` : stOf(h.sub) === 'rejected' ? `Returned by ${h.sub.reviewer || 'Quality team'}: ${h.sub.reason || ''}` : null, go: () => go('datacolForm', { dcMonth: h.mi, dcSel: h.it.id, dcFormSent: false, dcGuideOpen: false, dcNote: h.sub.note || '', dcCorr: '', dcMode: 'direct' }) }));
      const guide = s.demo ? DC_GUIDES[dcItem0.id] : dcItem0.guide;

      /* ---- handover ---- */
      const ho = live.handover || { items: [], deptName: dept };
      const handoverAll = ho.items || [];
      const handoverItems = handoverAll.map((h) => { const done = !!h.done; const [c, bg] = PRIO[h.prio] || PRIO.Routine; return { bed: h.bed, patient: h.patient || (h.by ? 'Added by ' + String(h.by.name || '').split(' ')[0] : ''), prio: h.prio, note: h.note, done, toggle: () => this.toggleHandover(h), doneLabel: done ? 'Received by next shift' : 'Tap when handed over', bedStyle: MONO + ';font-size:11px;font-weight:700;padding:3px 7px;border-radius:6px;color:#0072a3;background:rgba(0,144,202,.12)', prioStyle: `font-size:9.5px;font-weight:800;letter-spacing:.5px;padding:3px 7px;border-radius:6px;color:${c};background:${bg}`, checkStyle: `display:grid;place-items:center;width:26px;height:26px;border-radius:8px;border:1.5px solid ${done ? 'transparent' : 'rgba(125,145,180,.45)'};background:${done ? 'linear-gradient(140deg,#2bb673,#1d8f57)' : 'rgba(255,255,255,.8)'};color:#fff;cursor:pointer` }; });
      const critN = handoverAll.filter((h) => h.prio === 'Critical').length, pendingH = handoverAll.filter((h) => !h.done).length;

      /* ---- performance: my appraisal on the hospital's own form ---- */
      const P = perfOf(live.perf);
      const scoreVal = P.score;
      const competencies = P.comps.map((c) => ({ label: c.label, v: c.v, bar: `height:100%;width:${c.n / 5 * 100}%;border-radius:999px;background:linear-gradient(90deg,#3ab5a7,#0090ca)` }));

      /* ---- notice list/detail ---- */
      const nq = s.noticeSearch.trim().toLowerCase();
      const noticeList = ALL_NOTICES.filter((n) => (s.noticeFilter === 'All' || (s.noticeFilter === 'Unread' ? !n.read : s.noticeFilter === 'Action' ? (n.needsAck && !n.acked) : s.noticeFilter === 'Saved' ? !!n.saved : n.cat === s.noticeFilter)) && (!nq || (n.title + ' ' + n.body + ' ' + n.from).toLowerCase().includes(nq)))
        .map((n) => ({ ...n, catStyle: catStyle(n.cat), unread: !n.read, hasPoll: !!n.poll, hasAttach: !!(n.attachments && n.attachments.length), attachCount: n.attachments ? n.attachments.length : 0, needsAction: n.needsAck && !n.acked, go: () => this.openNotice(n),
          cardStyle: `display:block;text-align:left;width:100%;box-sizing:border-box;border:1px solid ${n.cat === 'Urgent' && !n.acked ? 'rgba(214,69,69,.35)' : 'rgba(255,255,255,.9)'};border-radius:15px;padding:12px 13px;background:rgba(255,255,255,${n.read ? '.6' : '.72'});cursor:pointer;color:#16202e` }));
      const poll = noticeRaw.poll;
      const myVote = noticeRaw.myVote;
      const pollVotes = poll ? poll.votes.slice() : [];
      const pollTotal = pollVotes.reduce((a, b) => a + b, 0);
      const pollOpts = poll ? poll.opts.map((label, i) => { const pct = pollTotal ? Math.round(pollVotes[i] / pollTotal * 100) : 0; return { label, pct: pct + '%', go: () => { if (myVote === i) return; const votes = pollVotes.slice(); if (myVote != null) votes[myVote] = Math.max(0, votes[myVote] - 1); votes[i]++; this.noticeAction(noticeRaw, 'vote', { opt: i }, { myVote: i, votes, poll: s.demo ? Object.assign({}, poll, { votes }) : noticeSrc && noticeSrc.poll }); }, fill: `position:absolute;left:0;top:0;bottom:0;width:${pct}%;background:rgba(106,82,212,${myVote === i ? '.2' : '.1'});border-radius:10px`, style: `position:relative;overflow:hidden;display:flex;align-items:center;gap:8px;border:1.5px solid ${myVote === i ? '#6a52d4' : 'rgba(125,145,180,.3)'};border-radius:11px;padding:10px 12px;background:rgba(255,255,255,.8);cursor:pointer;color:#16202e` }; }) : [];
      const ackedN = noticeRaw.ackCount || 0, ackTotal = Math.max(noticeRaw.ackTotal || 0, ackedN, 1);
      const ackPendingPeople = (noticeRaw.ackPending || []).slice(0, 3);
      const noticeComments = noticeRaw.comments || [];
      const canRemind = isIncharge || bu.canManage || noticeRaw.mine;

      /* ---- compose ---- */
      const myUnits = s.demo ? [{ id: 'ldr', name: 'LDR' }] : units;
      const pickedDeptIds = Object.keys(s.cDepts).filter((k) => s.cDepts[k]);
      const pickedNames = myUnits.filter((u) => pickedDeptIds.indexOf(u.id) >= 0).map((u) => u.name);
      const reachOf = (aud) => s.demo ? (aud === 'all' ? 186 : aud === 'incharges' ? 14 : pickedDeptIds.length * 14) : (aud === 'all' ? dir.length + 1 : aud === 'incharges' ? dir.filter((a) => a.role === 'incharge').length : dir.filter((a) => (a.departments || []).some((d) => pickedNames.indexOf(d) >= 0)).length + 1);
      const reach = reachOf(s.cAudience);
      const canPublish = !!(s.cTitle.trim() && s.cBody.trim()) && (s.cAudience !== 'dept' || pickedDeptIds.length > 0) && !s.busy.publish;
      const whenLabel = { now: 'Publish now', tonight: 'Schedule · tonight 8 PM', tomorrow: 'Schedule · tomorrow 8 AM' }[s.cWhen];

      /* ---- requests ---- */
      const myRequests = reqs.mine.map(requestOf);
      const approvals = reqs.team.map(requestOf);
      const mrOk = !!s.mr.name.trim() && !s.busy.medreq;
      const swapPool = (team.length ? team : unitStaff.filter((p) => p.name !== staffName).map((p) => ({ ini: ini(p.name), name: p.name, code: p.shift || '—', username: p.username }))).slice(0, 6);

      /* ---- in-charge: roster builder ---- */
      const RE = rosterBuilder(this, s, unit, unitStaff, phonesOn);
      /* ---- in-charge: unit staff ---- */
      const US = unitStaffView(this, s, unit, phonesOn);
      /* ---- navigation ---- */
      const navGroup = { home: 'home', roster: 'roster', shift: 'roster', requests: 'roster', newRequest: 'roster', chats: 'chat', thread: 'chat', meds: 'meds', medDetail: 'meds', medRequest: 'meds', profile: 'me', performance: 'me' }[s.screen] || null;
      const navItem = (key, screen, label, badge) => ({ label, d: NAV_D[key], badge: badge || null, go: () => go(screen), iconWrap: 'position:relative;display:grid;place-items:center;width:44px;height:30px;border-radius:12px;' + (navGroup === key ? 'background:rgba(0,144,202,.13)' : ''), style: `display:flex;flex-direction:column;align-items:center;gap:3px;border:0;background:transparent;padding:4px 0;cursor:pointer;color:${navGroup === key ? '#0072a3' : '#7d8ea8'}` });
      const dItem = (screen, label, d, extra) => { const x = extra || {}; const on = s.screen === screen; return { label, d, badge: x.badge || null, tag: x.tag || null, go: () => go(screen, x.go || {}), style: `display:flex;align-items:center;gap:11px;width:100%;box-sizing:border-box;border:0;border-radius:10px;padding:10px 12px;font-size:13px;font-weight:600;cursor:pointer;color:${on ? '#fff' : '#c7d2e0'};background:${on ? 'linear-gradient(90deg,rgba(0,144,202,.4),rgba(58,181,167,.18))' : 'transparent'};box-shadow:${on ? 'inset 3px 0 0 #3ab5a7' : 'none'}` }; };
      const ok = (screen) => this.allowed(screen);
      const appLabel = `${hospital.app || 'UNICO Nurse'} v${hospital.version || '—'}`;

      return {
        /* screens */
        sLogin: s.screen === 'login', sHome: s.screen === 'home', sRoster: s.screen === 'roster', sShift: s.screen === 'shift', sRequests: s.screen === 'requests', sNewRequest: s.screen === 'newRequest', sChats: s.screen === 'chats', sThread: s.screen === 'thread', sMeds: s.screen === 'meds', sMedRequest: s.screen === 'medRequest', sMedDetail: s.screen === 'medDetail', sNotices: s.screen === 'notices', sNoticeDetail: s.screen === 'noticeDetail', sCompose: s.screen === 'compose', sStaff: s.screen === 'staff', sStaffDetail: s.screen === 'staffDetail', sReports: s.screen === 'reports', sIndicator: s.screen === 'indicator', sShiftReport: s.screen === 'shiftReport', sDatacol: s.screen === 'datacol', sDatacolForm: s.screen === 'datacolForm', sDatacolHistory: s.screen === 'datacolHistory', sHandover: s.screen === 'handover', sIncident: s.screen === 'incident', sPerformance: s.screen === 'performance', sProfile: s.screen === 'profile', sRosterEdit: s.screen === 'rosterEdit', sUnitStaff: s.screen === 'unitStaff', goRosterEdit: () => go('rosterEdit'), goUnitStaff: () => go('unitStaff'),
        showNav: s.screen !== 'login' && s.screen !== 'thread', drawerOpen: s.drawerOpen, openDrawer: () => this.setState({ drawerOpen: true }), closeDrawer: () => this.setState({ drawerOpen: false }),
        isIncharge, isNurse, staffName, designation, dept, empIdShown, initials, greeting, todayLabel, todayCode: todayCode || '—', todayShiftName: today.name, todayTime: today.time, nextShiftCode,
        avatarUrl: (me.photo && me.photo.url) || (isIncharge ? '/assets/nurse-portrait.png' : '/assets/nurse-portrait-male.png'),
        hospitalName: hospital.name || 'Hospital', appLabel, loginFooter: `${hospital.name || 'UNICO'} · v${hospital.version || '—'}`, appFooter: appLabel, incRef: s.incRef, cycleLabel: P.cycle,
        /* login */
        empId: s.empId, setEmpId: (e) => this.setState({ empId: e.target.value }), pin: s.pin, setPin: (e) => this.setState({ pin: e.target.value }), doLogin: () => { if (!s.loginBusy) this.doLogin(); }, signOut: () => this.signOut(),
        /* navigation */
        goHome: () => go('home'), goRoster: () => go('roster'), goRequests: () => go('requests', { reqSent: false }), goNewRequest: () => go('newRequest', { reqSent: false, reqReason: '' }), goChats: () => go('chats'), goMeds: () => go('meds'), goMedRequest: () => go('medRequest', { mrSent: false }), goNotices: () => go('notices'), goCompose: () => go('compose', { composeSent: false }), goStaff: () => go('staff'), goProfile: () => go('profile'), goPerformance: () => go('performance'), goHandover: () => go('handover'), goDatacol: () => go('datacol', { dcFormSent: false }), goDcHistory: () => go('datacolHistory'),
        goReports: () => go('reports'), goRepQuality: () => go('reports', { repTab: 'quality', repSimple: false }), goRepSubmitted: () => go('reports', { repTab: 'submitted', repSimple: false, srSent: false }), goShiftReport: () => go('shiftReport', { srSent: false, srStep: 0 }), goApprovals: () => go('requests', { reqTab: 'approvals' }),
        navItems: [navItem('home', 'home', 'Home'), ...(ok('roster') ? [navItem('roster', 'roster', 'Roster')] : []), ...(ok('chats') ? [navItem('chat', 'chats', 'Chat', chatUnreadTotal || null)] : []), ...(ok('meds') ? [navItem('meds', 'meds', 'Meds')] : []), navItem('me', 'profile', 'Me')],
        drawerGroups: [
          { sec: 'Today', items: [dItem('home', 'Home', NAV_D.home), ...(ok('roster') ? [dItem('roster', 'My roster', NAV_D.roster)] : []), ...(ok('requests') ? [dItem('requests', 'Swap & leave requests', NAV_D.swap, { badge: isIncharge && pendingCount ? pendingCount : null })] : []), ...(ok('handover') ? [dItem('handover', 'Shift handover', NAV_D.handover, { badge: pendingH || null })] : [])] },
          { sec: 'Ward', items: [...(ok('chats') ? [dItem('chats', 'Chat', NAV_D.chat, { badge: chatUnreadTotal || null })] : []), ...(ok('notices') ? [dItem('notices', 'Notices', NAV_D.bell, { badge: unread.length || null })] : []), ...(ok('staff') ? [dItem('staff', 'Staff directory', NAV_D.staff)] : []), ...(ok('meds') ? [dItem('meds', 'Medicine info', NAV_D.meds)] : []), ...(ok('incident') ? [dItem('incident', 'Report an incident', NAV_D.incident, { go: { incSent: false } })] : [])] },
          { sec: isIncharge ? 'In-charge' : 'Me', items: [...(ok('reports') ? [dItem('reports', 'Reports & statistics', NAV_D.reports, { tag: 'LIVE' })] : []), ...(ok('rosterEdit') ? [dItem('rosterEdit', 'Make the unit roster', NAV_D.roster, { badge: s.reDirty ? '•' : null })] : []), ...(ok('unitStaff') ? [dItem('unitStaff', 'My unit staff', NAV_D.staff)] : []), ...(ok('shiftReport') ? [dItem('shiftReport', 'Submit shift report', NAV_D.report, { go: { srSent: false, srStep: 0 } })] : []), ...(ok('compose') ? [dItem('compose', 'Post an announcement', NAV_D.compose, { go: { composeSent: false } })] : []), ...(ok('datacol') ? [dItem('datacol', 'Data collection', NAV_D.datacol, { badge: openCount || null, go: { dcFormSent: false } })] : []), ...(ok('datacolHistory') ? [dItem('datacolHistory', 'My submissions', NAV_D.history)] : []), ...(ok('performance') ? [dItem('performance', 'My performance', NAV_D.perf)] : []), dItem('profile', 'Profile & settings', NAV_D.me)] },
        ].filter((g) => g.items.length),
        /* home */
        hasUnread: unread.length > 0, unitChip, pickUnit, hasCharge: !!unit, chargeNurse: isRealIncharge ? staffName.split(' ')[0] : (unit && unit.incharge ? unit.incharge.split(' ').slice(0, 2).join(' ') : ((unitStaff.find((p) => p.admin) || {}).name || 'not set').split(' ').slice(0, 2).join(' ')),
        toggleClock: () => { this.setState({ clockedIn: !s.clockedIn }); this.toastMsg(s.clockedIn ? 'Clocked out · ' + timeNow() : 'Clocked in · ' + timeNow()); }, clockLabel: s.clockedIn ? 'Clock out' : 'Clock in', clockBtnStyle: `border:0;border-radius:999px;padding:7px 13px;font-size:12px;font-weight:700;cursor:pointer;${s.clockedIn ? 'background:rgba(255,255,255,.18);color:#fff;border:1px solid rgba(255,255,255,.35)' : 'background:#fff;color:#0a5f87'}`,
        pendingCount, homeReportLine: R.live && !live.report ? 'Loading the unit report…' : `${last(R.adm)} admissions · ${last(R.nvd) + last(R.cs)} deliveries · ${indicatorsAlert.length} indicators to watch${R.live ? ' · ' + (R.labels[nL - 1] || '') : ''}`, homeSpark: spark(R.adm, '#0090ca'),
        quickActions: [
          ...(ok('roster') ? [{ label: 'Roster', color: '#0072a3', bg: 'rgba(0,144,202,.13)', d: NAV_D.roster, go: () => go('roster') }] : []),
          ...(ok('requests') ? [{ label: 'Requests', color: '#6a52d4', bg: 'rgba(106,82,212,.13)', d: NAV_D.swap, badge: isIncharge && pendingCount ? pendingCount : null, go: () => go('requests') }] : []),
          ...(ok('chats') ? [{ label: 'Chat', color: '#1e8a7c', bg: 'rgba(58,181,167,.16)', d: NAV_D.chat, badge: chatUnreadTotal || null, go: () => go('chats') }] : []),
          ...(ok('notices') ? [{ label: 'Notices', color: '#b8650a', bg: 'rgba(224,138,30,.15)', d: NAV_D.bell, badge: unread.length || null, go: () => go('notices') }] : []),
          ...(ok('meds') ? [{ label: 'Medicines', color: '#b32e2e', bg: 'rgba(214,69,69,.12)', d: NAV_D.meds, go: () => go('meds') }] : []),
          ...(ok('staff') ? [{ label: 'Staff', color: '#0072a3', bg: 'rgba(0,144,202,.13)', d: NAV_D.staff, go: () => go('staff') }] : []),
          ...(ok('incident') ? [{ label: 'Incident', color: '#d23a52', bg: 'rgba(210,58,82,.12)', d: NAV_D.incident, go: () => go('incident', { incSent: false }) }] : []),
          ...(ok('shiftReport') ? [{ label: 'Shift report', color: '#3c4858', bg: 'rgba(125,145,180,.16)', d: NAV_D.report, go: () => go('shiftReport', { srSent: false, srStep: 0 }) }] : ok('handover') ? [{ label: 'Handover', color: '#3c4858', bg: 'rgba(125,145,180,.16)', d: NAV_D.handover, go: () => go('handover') }] : ok('performance') ? [{ label: 'Performance', color: '#3c4858', bg: 'rgba(125,145,180,.16)', d: NAV_D.perf, go: () => go('performance') }] : []),
        ].slice(0, 8),
        upcoming, homeNotices: ALL_NOTICES.slice(0, 2).map((n) => ({ ...n, catStyle: catStyle(n.cat), unread: !n.read, go: () => this.openNotice(n) })),
        dcMonthLabel: dcM.label, dcHomeLine: !dcTotal ? 'No sheet or indicators assigned to your unit' : openCount ? `${openCount} item${openCount === 1 ? '' : 's'} still to send · due ${DC_DUE_DAY} ${MON3[M]}` : 'Everything sent — awaiting review', dcHomeBorder: openCount ? 'rgba(224,138,30,.35)' : 'rgba(255,255,255,.9)', dcHomeBadge: MONO + `;font-size:11px;font-weight:700;padding:3px 8px;border-radius:999px;color:${openCount ? '#b8650a' : '#1d8f57'};background:${openCount ? 'rgba(224,138,30,.15)' : 'rgba(43,182,115,.14)'}`, dcOpenCount: openCount ? openCount + ' open' : 'Done',
        handoverSummary: `${handoverAll.length} patient${handoverAll.length === 1 ? '' : 's'}`, handoverSub: `${critN} critical · ${pendingH} still to hand over${nextShiftCode && nextShiftCode !== '—' ? ' · next shift ' + nextShiftCode : ''}`,
        /* roster */
        monthLabel: monthLabel + ' · ' + rosterNote, rosterStats: [{ n: shiftsN, label: 'Shifts' }, { n: hours + 'h', label: 'Hours' }, { n: nights, label: 'Nights' }, { n: offN, label: 'Off' }], dows: DOWS, calCells,
        legend: [['M4', 'Morning'], ['E3', 'Evening'], ['N2', 'Night'], ['O', 'Off / leave']].map(([c, label]) => ({ label, dot: `width:10px;height:10px;border-radius:3px;background:${shiftOf(c).color}` })),
        /* shift */
        selCode: selCode || '—', selCodeStyle: MONO + `;font-size:20px;font-weight:700;padding:8px 12px;border-radius:12px;color:${selSh.color};background:${selSh.bg}`, selDateLabel: dateLabel(sel), selShiftName: selSh.name, selTime: selSh.time || '—', selHours: selSh.hours || '—', selIsWork: isWork(selCode), selIsOff: !isWork(selCode), team,
        /* requests */
        reqTabs: [['mine', 'My requests', null], ['approvals', 'Team approvals', pendingCount || null]].filter((t) => isIncharge || t[0] === 'mine').map(([k, label, badge]) => ({ label, badge, go: () => this.setState({ reqTab: k }), style: pillBtn(s.reqTab === k) })),
        reqMine: s.reqTab === 'mine' || !isIncharge, reqApprovals: isIncharge && s.reqTab === 'approvals',
        myRequests: myRequests.map((r) => ({ ...r, typeStyle: typeStyle(r.type), statusStyle: statusStyle(r.status) })),
        approvals: approvals.map((a) => ({ ...a, ini: ini(a.name), typeStyle: typeStyle(a.type), statusStyle: statusStyle(a.status), pending: a.status === 'Pending', decided: a.status !== 'Pending', approve: () => this.decideRequest(a, 'approved'), reject: () => this.decideRequest(a, 'declined') })),
        reqSent: s.reqSent, reqNotSent: !s.reqSent, reqTypeOpts: ['Swap', 'Leave'].map((t) => ({ label: t === 'Swap' ? 'Shift swap' : 'Leave', go: () => this.setState({ reqType: t }), style: pillBtn(s.reqType === t) })), reqIsSwap: s.reqType === 'Swap', reqIsLeave: s.reqType === 'Leave', reqDateLabel: s.reqType === 'Swap' ? 'Shift to swap' : 'Leave date',
        swapCandidates: swapPool.map((t, i) => ({ ini: t.ini, name: t.name, code: t.code, go: () => this.setState({ swapWith: i }), style: `display:flex;align-items:center;gap:10px;border:1.5px solid ${s.swapWith === i ? '#0090ca' : 'rgba(125,145,180,.3)'};border-radius:11px;padding:8px 10px;background:${s.swapWith === i ? 'rgba(0,144,202,.08)' : 'rgba(255,255,255,.7)'};cursor:pointer;color:#16202e` })),
        leaveTypes: ['Casual', 'Sick', 'Annual', 'Study'].map((l) => ({ label: l, go: () => this.setState({ leaveType: l }), style: chip(s.leaveType === l) })), reqReason: s.reqReason, setReqReason: (e) => this.setState({ reqReason: e.target.value }),
        submitRequest: () => { const partner = swapPool[s.swapWith] || swapPool[0] || null; if (s.reqType === 'Swap' && !partner) return this.toastMsg('No colleague to swap with on that day.'); this.submitRequest(s.reqType === 'Swap' ? { type: 'swap', date: isoDay(sel), code: selCode || '', withUsername: partner.username || '', withName: partner.name, reason: s.reqReason } : { type: 'leave', date: isoDay(sel), leaveType: s.leaveType, reason: s.reqReason }); },
        /* chat */
        chatUnreadTotal, onlineCount: onlineN, chatSearch: s.chatSearch, setChatSearch: (e) => this.setState({ chatSearch: e.target.value }),
        chatTabs: [['dept', 'Department', ALL_CHATS.filter((c) => c.scope !== 'hosp').reduce((a, c) => a + (c.muted ? 0 : c.unread), 0)], ...(F.chatHosp !== false ? [['hosp', 'Hospital-wide', ALL_CHATS.filter((c) => c.scope === 'hosp').reduce((a, c) => a + (c.muted ? 0 : c.unread), 0)]] : [])].map(([k, label, badge]) => ({ label, badge: badge || null, go: () => this.setState({ chatTab: k }), style: pillBtn(s.chatTab === k) })),
        chatIsDept: s.chatTab === 'dept' && !cq, chatIsHosp: s.chatTab === 'hosp' && !cq, deptChips: roomDepts.length > 1 ? ['All', ...roomDepts].map((d) => ({ label: d, go: () => this.setState({ chatDept: d }), style: chip(s.chatDept === d) })) : [],
        chatList: chatsVisible.length ? chatsVisible.map((c) => ({ ...avOf(c), name: c.name, members: c.group ? String(c.members) : null, muted: c.muted, urgent: !!(c.last && c.last.urgent), last: c.last ? ((c.last.mine ? 'You: ' : c.group ? String(c.last.from || '').split(' ')[0] + ': ' : '') + (c.last.text || '')) : 'No messages yet', when: c.when, unread: c.unread || null, online: c.online, go: () => openChat(c.id) })) : [],
        newGroupOpen: s.newGroupOpen, openNewGroup: () => this.setState({ newGroupOpen: true, ngName: '', ngPicked: {} }), closeNewGroup: () => this.setState({ newGroupOpen: false }), ngName: s.ngName, setNgName: (e) => this.setState({ ngName: e.target.value }),
        ngScopeOpts: [['dept', 'My department'], ...(bu.canManage ? [['hosp', 'Hospital-wide']] : [])].map(([k, label]) => ({ label, go: () => this.setState({ ngScope: k }), style: pillBtn(s.ngScope === k) })),
        ngMembers: (s.demo ? STAFF.filter((p) => p.name !== staffName).slice(0, 6).map((p) => ({ username: norm(p.name), name: p.name, roleLabel: p.title })) : dir.slice(0, 40)).map((a) => ({ ini: ini(a.name), name: a.name, role: a.roleLabel || a.role, on: !!s.ngPicked[a.username], go: () => this.setState({ ngPicked: { ...s.ngPicked, [a.username]: !s.ngPicked[a.username] } }), box: box(!!s.ngPicked[a.username]), style: 'display:flex;align-items:center;gap:10px;border:0;background:transparent;padding:6px 2px;cursor:pointer;color:#16202e;width:100%;box-sizing:border-box' })),
        ngCount: Object.values(s.ngPicked).filter(Boolean).length + 1,
        createGroup: () => { const name = s.ngName.trim(); if (!name) return this.toastMsg('Give the room a name.'); this.createGroup(name, s.ngScope, Object.keys(s.ngPicked).filter((k) => s.ngPicked[k])); },
        /* thread */
        thread: { ...avOf(threadRaw), name: threadRaw.name, sub: (threadRaw.sub || '') + (isMuted ? ' · muted' : '') + (threadRaw.readOnly ? ' · read-only' : ''), tel: threadRaw.group || !threadPerson ? null : tel(threadPerson.phone), pinnedText: pinnedMsg ? pinnedMsg.text : null, group: !!threadRaw.group, memberCount: roomMembers.length || threadRaw.members || 0 },
        unpin: () => this.pinMsg(threadRaw.id, null), messages, typing: th && th.typing && !msgs.some((m) => m.mine && Date.now() - m.ts < 60000) ? th.typing : null, replyingTo, cancelReply: () => this.setState({ replyTo: null }),
        quickReplies: ['On it', 'Noted, thanks', 'Coming now', 'Call me'].map((t) => ({ label: t, go: () => sendMsg(t) })),
        toggleAttach: () => this.setState({ attachOpen: !s.attachOpen }), attachOpen: s.attachOpen, attachBtnStyle: iconBtn(!!s.pendingAttach, '#0072a3') + ';width:36px;height:36px;border-radius:10px;flex-shrink:0',
        attachOpts: ATTACH.map(([label, color, bg, d, type]) => ({ label, color, bg, d, go: () => this.setState({ attachOpen: false, pendingAttach: { name: label + (type === 'photo' ? '.jpg' : '.pdf'), type } }) })),
        toggleUrgent: () => this.setState({ urgent: !s.urgent }), urgentBtnStyle: iconBtn(s.urgent, '#d23a52') + ';width:36px;height:36px;border-radius:10px;flex-shrink:0',
        draft: s.draft, setDraft: (e) => this.setState({ draft: e.target.value }), draftKey: (e) => { if (e.key === 'Enter') sendMsg(); }, draftPlaceholder: threadRaw.readOnly && !bu.canManage ? 'This room is read-only' : s.pendingAttach ? `Attach ${s.pendingAttach.name} · add a note` : s.urgent ? 'Urgent message…' : 'Message', sendMsg: () => sendMsg(), sendBtnStyle: `width:40px;height:40px;border-radius:12px;border:0;display:grid;place-items:center;cursor:pointer;flex-shrink:0;${(s.draft.trim() || s.pendingAttach) && !s.busy.send ? BLUE_BTN : 'background:rgba(125,145,180,.2);color:#7d8ea8'}`,
        roomInfoOpen: s.roomInfoOpen, openRoomInfo: () => this.setState({ roomInfoOpen: true }), closeRoomInfo: () => this.setState({ roomInfoOpen: false }),
        roomActions: [{ label: isMuted ? 'Unmute' : 'Mute', d: 'M13.7 21a2 2 0 01-3.4 0M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9', go: () => this.muteRoom(threadRaw.id, !isMuted) }, { label: 'Search', d: 'M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-4.3-4.3', go: () => this.setState({ roomInfoOpen: false, screen: 'chats', chatSearch: threadRaw.name }) }, { label: threadRaw.group ? 'Leave room' : 'Call', d: threadRaw.group ? 'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9' : 'M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1.9.4 1.8.7 2.6a2 2 0 01-.5 2.1L8 9.7a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.4c.8.3 1.7.5 2.6.7a2 2 0 011.7 2z', go: () => { if (threadRaw.group) this.leaveRoom(threadRaw); else if (threadPerson && threadPerson.phone) window.location.href = tel(threadPerson.phone); else this.toastMsg(phonesOn ? 'No phone number on record.' : 'Phone numbers are hidden for your role.'); } }].map((a) => ({ ...a, style: 'display:flex;flex-direction:column;align-items:center;gap:6px;border:1px solid rgba(125,145,180,.2);border-radius:13px;padding:11px 4px;background:rgba(255,255,255,.9);cursor:pointer;color:#0072a3' })),
        roomMembers,
        /* medicines */
        medCount: medList.length, medTotal: medPool.length, medsLoading: s.meds === null, toggleAlertOnly: () => this.setState({ alertOnly: !s.alertOnly }), alertChipStyle: chip(s.alertOnly).replace('rgba(0,144,202,.5)', 'rgba(214,69,69,.5)').replace('rgba(0,144,202,.12);color:#0072a3', 'rgba(214,69,69,.12);color:#b32e2e'),
        medQuery: s.medQuery, setMedQuery: (e) => { const v = e.target.value; this.setState({ medQuery: v }); this.searchMeds(v); }, medClasses: classes.map((c) => ({ label: c, go: () => this.setState({ medClass: c }), style: chip(s.medClass === c) })),
        medReqCta: ok('medRequest') ? 'Can’t find a medicine? Request it' : 'Can’t find a medicine? Ask your in-charge', medReqSub: ok('medRequest') ? 'Pharmacy answers requests in the app' : 'Medicine requests are not enabled for your role', medReqBadge: medReqs.filter((r) => r.status !== 'Approved' && r.status !== 'Declined').length ? medReqs.filter((r) => r.status !== 'Approved' && r.status !== 'Declined').length + ' in review' : null, medList,
        /* medicine request */
        mr: s.mr, mrSent: s.mrSent, mrNotSent: !s.mrSent, mrAnother: () => this.setState({ mrSent: false, mr: { name: '', strength: '', mfr: '', form: 'Injection', reason: 'Used on ward, missing', note: '', urgent: false, highAlert: false } }),
        mrSetName: (e) => this.setState({ mr: { ...s.mr, name: e.target.value } }), mrSetStrength: (e) => this.setState({ mr: { ...s.mr, strength: e.target.value } }), mrSetMfr: (e) => this.setState({ mr: { ...s.mr, mfr: e.target.value } }), mrSetNote: (e) => this.setState({ mr: { ...s.mr, note: e.target.value } }),
        mrForms: ['Tablet', 'Capsule', 'Injection', 'Syrup', 'Other'].map((f) => ({ label: f, go: () => this.setState({ mr: { ...s.mr, form: f } }), style: chip(s.mr.form === f) })), mrReasons: ['Used on ward, missing', 'New protocol', 'Doctor requested', 'Replaces a discontinued brand'].map((r) => ({ label: r, go: () => this.setState({ mr: { ...s.mr, reason: r } }), style: chip(s.mr.reason === r) })),
        mrToggleUrgent: () => this.setState({ mr: { ...s.mr, urgent: !s.mr.urgent } }), mrUrgentBox: box(s.mr.urgent), mrToggleHighAlert: () => this.setState({ mr: { ...s.mr, highAlert: !s.mr.highAlert } }), mrHighAlertBox: box(s.mr.highAlert),
        mrSubmit: () => { if (!mrOk) return; this.submitMedRequest({ name: s.mr.name.trim(), strength: s.mr.strength, mfr: s.mr.mfr, form: s.mr.form, reason: s.mr.reason, note: s.mr.note, urgent: s.mr.urgent, highAlert: s.mr.highAlert }); }, mrSubmitStyle: `border:0;border-radius:13px;padding:14px;font-size:14px;font-weight:700;cursor:pointer;${BLUE_BTN};opacity:${mrOk ? 1 : .5}`,
        myMedRequests: medReqs.map((r) => ({ name: r.name + (r.strength ? ' ' + r.strength : ''), meta: `${r.form || 'Other'} · sent ${fmtTs(r.createdAt)}`, status: r.status, approved: r.status === 'Approved', reply: r.reply || (r.decidedBy ? `${r.status} by ${r.decidedBy.name}` : null), openId: r.openId, statusStyle: statusStyle(r.status === 'Approved' ? 'Approved' : r.status === 'Declined' ? 'Declined' : 'Pending'), open: () => { const m = medPool.find((x) => x.id === r.openId); if (m) this.openMed(m); else if (r.openId) tryApi('/api/med/brand/' + encodeURIComponent(r.openId)).then((x) => { if (x && x.ok && x.brand) this.openMed(liveMed(x.brand)); }); } })), mrCount: medReqs.length + ' total',
        /* medicine detail */
        med, medTabs: [['overview', 'Overview'], ['dosage', 'Dosage'], ['safety', 'Safety'], ['more', 'More']].map(([k, l]) => ({ label: l, go: () => this.setState({ medTab: k }), style: pillBtn(s.medTab === k).replace('padding:7px 12px', 'padding:8px 4px') })), medSections, medTabMore: s.medTab === 'more',
        medFacts: [['Manufacturer', med.mfr || '—'], ['Unit price', med.price || '—'], ['Category', med.cat || '—'], ['Dosage form', med.route || '—'], ['Max daily (বাংলা)', (med.facts && med.facts.maxBn) || med.maxDose]].map(([label, v]) => ({ label, v })),
        toggleFav: () => this.saveFavs(isFav ? s.favs.filter((x) => x !== med.id) : [...s.favs, med.id]), favStyle: iconBtn(isFav, '#e08a1e'), favFill: isFav ? '#e08a1e' : 'none',
        shareMed: () => { const text = `${med.brand} ${med.strength} (${med.generic}) — ${med.nursing}`; if (navigator.share) navigator.share({ title: med.brand, text }).catch(() => {}); else { this.setState({ screen: 'chats', draft: text }); } },
        /* notices */
        unreadCount: unread.length, needsActionCount: needsAction.length, markAllRead: () => this.markAllRead(), noticeSearch: s.noticeSearch, setNoticeSearch: (e) => this.setState({ noticeSearch: e.target.value }),
        noticeFilters: ['All', 'Unread', 'Action', 'Saved', 'Urgent', 'Policy', 'Training', 'Roster'].map((f) => ({ label: f === 'Action' ? 'Needs action' : f, go: () => this.setState({ noticeFilter: f }), style: chip(s.noticeFilter === f) })), noticeList,
        notice: { ...noticeRaw, catStyle: catStyle(noticeRaw.cat), ini: ini(noticeRaw.from || '?'), hasAttach: !!(noticeRaw.attachments && noticeRaw.attachments.length), attachments: noticeRaw.attachments || [], hasPoll: !!poll, pollQ: poll ? poll.q : '', acked: !!noticeRaw.acked, notAcked: !noticeRaw.acked, full: noticeRaw.full || noticeRaw.body, canRemind },
        toggleSaveNotice: () => this.noticeAction(noticeRaw, 'save', {}, { saved: !noticeRaw.saved }), saveBtnStyle: iconBtn(!!noticeRaw.saved, '#0072a3') + ';width:36px;height:36px;border-radius:10px', saveFill: noticeRaw.saved ? '#0072a3' : 'none',
        shareNotice: () => { const text = noticeRaw.title + ' — ' + noticeRaw.body; if (navigator.share) navigator.share({ title: noticeRaw.title, text }).catch(() => {}); else this.setState({ screen: 'chats', draft: text }); },
        pollOpts, pollMeta: `${pollTotal} vote${pollTotal === 1 ? '' : 's'}${myVote != null ? ' · you voted' : ' · tap to vote'}`,
        ackStat: `${ackedN} / ${ackTotal}`, ackBar: `height:100%;width:${Math.round(ackedN / ackTotal * 100)}%;border-radius:999px;background:linear-gradient(90deg,#3ab5a7,#0090ca)`, ackPending: ackPendingPeople.map((n) => ini(n)), ackPendingLabel: `${Math.max(0, ackTotal - ackedN)} have not acknowledged yet`,
        remindUnread: () => { if (!canRemind) return this.toastMsg('Only the author or a manager can send reminders.'); this.setState({ reminded: { ...s.reminded, [noticeRaw.id]: true } }); if (!s.demo) this.act('remind', () => api('/api/phone/notices/' + encodeURIComponent(noticeRaw.id) + '/remind', { method: 'POST' })); }, remindLabel: s.reminded[noticeRaw.id] ? 'Reminder sent' : 'Remind', remindStyle: `border:1px solid rgba(0,144,202,.3);border-radius:9px;padding:6px 10px;font-size:11.5px;font-weight:700;cursor:pointer;${s.reminded[noticeRaw.id] ? 'background:rgba(43,182,115,.14);color:#1d8f57;border-color:rgba(43,182,115,.35)' : 'background:rgba(0,144,202,.08);color:#0072a3'}`,
        ackNotice: () => this.noticeAction(noticeRaw, 'ack', {}, { acked: true, ackCount: (noticeRaw.ackCount || 0) + 1 }),
        comments: noticeComments.map((c) => ({ ...c, ini: ini(c.from || '?') })), commentCount: noticeComments.length, commentDraft: s.commentDraft, setCommentDraft: (e) => this.setState({ commentDraft: e.target.value }),
        sendComment: () => this.sendComment(noticeRaw, s.commentDraft), commentKey: (e) => { if (e.key === 'Enter') this.sendComment(noticeRaw, s.commentDraft); },
        /* compose */
        composeSent: s.composeSent, composeNotSent: !s.composeSent, composeDoneTitle: s.cWhen === 'now' ? 'Announcement published' : 'Announcement scheduled', composeDoneSub: `${reach} staff will ${s.cWhen === 'now' ? 'see it now' : 'see it ' + whenLabel.replace('Schedule · ', '')}${s.cAck ? ' · acknowledgement required' : ''}`,
        cTitle: s.cTitle, setCTitle: (e) => this.setState({ cTitle: e.target.value }), cBody: s.cBody, setCBody: (e) => this.setState({ cBody: e.target.value }),
        toggleCAttach: () => this.setState({ cAttach: !s.cAttach }), cAttachStyle: chip(s.cAttach) + ';display:inline-flex;align-items:center;gap:5px', cAttachLabel: s.cAttach ? 'Attachment noted' : 'Attach file', toggleCPoll: () => this.setState({ cPoll: !s.cPoll }), cPollStyle: chip(s.cPoll).replace(/0,144,202/g, '106,82,212').replace('#0072a3', '#6a52d4') + ';display:inline-flex;align-items:center;gap:5px', cPollLabel: s.cPoll ? 'Remove poll' : 'Add poll', cPoll: s.cPoll, cPollQ: s.cPollQ, setCPollQ: (e) => this.setState({ cPollQ: e.target.value }),
        cPollOpts: s.cPollOpts.map((v, i) => ({ v, ph: 'Option ' + (i + 1), set: (e) => this.setState({ cPollOpts: s.cPollOpts.map((x, j) => j === i ? e.target.value : x) }) })),
        cCats: Object.keys(CATS).map((c) => ({ label: c, go: () => this.setState({ cCat: c }), style: chip(s.cCat === c) })),
        cAudiences: [['dept', 'My department(s)', 'Everyone with an app account in the selected units', reachOf('dept')], ...(bu.canManage || s.demo ? [['incharges', 'All in-charges', 'One per unit · for roster and policy', reachOf('incharges')], ['all', 'All nursing staff', 'Hospital-wide · use sparingly', reachOf('all')]] : [])].map(([k, label, sub, count]) => ({ label, sub, count, go: () => this.setState({ cAudience: k }), radio: `width:18px;height:18px;border-radius:50%;border:2px solid ${s.cAudience === k ? '#0090ca' : 'rgba(125,145,180,.5)'};background:${s.cAudience === k ? 'radial-gradient(circle,#0090ca 45%,#fff 50%)' : '#fff'};flex-shrink:0`, style: `display:flex;align-items:center;gap:10px;border:1.5px solid ${s.cAudience === k ? '#0090ca' : 'rgba(125,145,180,.3)'};border-radius:12px;padding:10px 12px;background:${s.cAudience === k ? 'rgba(0,144,202,.08)' : 'rgba(255,255,255,.7)'};cursor:pointer;color:#16202e` })),
        cAudienceDepts: s.cAudience === 'dept', cDeptChips: myUnits.map((u) => ({ label: u.short || u.name, go: () => this.setState({ cDepts: { ...s.cDepts, [u.id]: !s.cDepts[u.id] } }), style: chip(!!s.cDepts[u.id]) })),
        cOptions: [['cAck', 'Require acknowledgement', 'Staff must tap "I have read this"'], ['cPin', 'Pin to top', 'Stays first until you unpin it'], ['cComments', 'Allow questions', 'Staff can comment under the notice']].map(([k, label, sub]) => ({ label, sub, go: () => this.setState({ [k]: !s[k] }), ...track(!!s[k]) })),
        cWhenOpts: [['now', 'Now'], ['tonight', 'Tonight 8 PM'], ['tomorrow', 'Tomorrow 8 AM']].map(([k, label]) => ({ label, go: () => this.setState({ cWhen: k }), style: pillBtn(s.cWhen === k) })),
        publishLabel: `${whenLabel} · ${reach} staff`, publishStyle: `border:0;border-radius:13px;padding:14px;font-size:14px;font-weight:700;cursor:pointer;${BLUE_BTN};opacity:${canPublish ? 1 : .5}`,
        publishNotice: () => { if (!canPublish) return; this.publishNotice({ title: s.cTitle.trim(), body: s.cBody.trim(), cat: s.cCat, audience: s.cAudience === 'dept' ? 'depts' : s.cAudience, depts: pickedDeptIds, needsAck: s.cAck, pinned: s.cPin, allowComments: s.cComments, when: s.cWhen, poll: s.cPoll && s.cPollQ.trim() ? { q: s.cPollQ.trim(), opts: s.cPollOpts.filter((x) => x.trim()) } : null, attachments: [] }); },
        /* staff directory */
        staffCount: STAFF.length, staffOnline: onlineN, toggleStaffOnline: () => this.setState({ staffOnlineOnly: !s.staffOnlineOnly }), staffOnlineStyle: chip(s.staffOnlineOnly).replace(/0,144,202/g, '43,182,115').replace('#0072a3', '#1d8f57') + ';display:inline-flex;align-items:center;gap:6px',
        dirTabs: [['staff', 'Staff'], ...(phonebook.length || !sq ? [['phonebook', 'Phonebook']] : [])].map(([k, label]) => ({ label, go: () => this.setState({ dirTab: k }), style: pillBtn(s.dirTab === k) })), dirIsStaff: s.dirTab === 'staff', dirIsPhonebook: s.dirTab === 'phonebook', dirSearchPh: s.dirTab === 'staff' ? 'Name, role, unit, extension' : 'Department or service', staffSearch: s.staffSearch, setStaffSearch: (e) => this.setState({ staffSearch: e.target.value }),
        phonebook,
        staffDeptChips: deptList.slice(0, 24).map((d) => ({ label: d, go: () => this.setState({ staffDept: d }), style: chip(s.staffDept === d) })), staffSortOpts: [['active', 'Active'], ['name', 'Name']].map(([k, label]) => ({ label, go: () => this.setState({ staffSort: k }), style: pillBtn(s.staffSort === k).replace('padding:7px 12px', 'padding:5px 10px').replace('font-size:12px', 'font-size:11px') })),
        staffList: staffList.slice(0, 120).map((p) => ({ ini: ini(p.name), online: p.online, hasPhoto: !!p.photoUrl, noPhoto: !p.photoUrl, photo: p.photoUrl, name: p.name, title: p.title, dept: p.dept, lastActive: lastActiveOf(p), lastActiveStyle: `font-size:10.5px;font-weight:700;color:${p.online ? '#1d8f57' : '#7d8ea8'};white-space:nowrap`, shift: p.shift || '—', codeStyle: codeChip(p.shift), phoneShown: phonesOn ? (mask(p.phone) || (p.ext ? 'ext ' + p.ext : '—')) : 'hidden', phone: p.phone, tel: tel(p.phone), wa: wa(p.phone), call: (e) => { if (e && e.stopPropagation) e.stopPropagation(); if (!p.phone) { e && e.preventDefault && e.preventDefault(); this.toastMsg(phonesOn ? 'No phone number on record for ' + p.name : 'Phone numbers are hidden for your role.'); } }, msg: (e) => { if (e && e.stopPropagation) e.stopPropagation(); this.openDM(p); }, go: () => this.setState({ screen: 'staffDetail', selStaff: p.name }) })),
        /* staff detail */
        person: { ...person, ini: ini(person.name || '?'), hasPhoto: !!person.photoUrl, noPhoto: !person.photoUrl, photo: person.photoUrl, statusLabel: lastActiveOf(person), statusStyle: `display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:700;padding:4px 9px;border-radius:999px;color:${person.online ? '#1d8f57' : '#7d8ea8'};background:${person.online ? 'rgba(43,182,115,.13)' : 'rgba(125,145,180,.14)'}`, dotStyle: `width:7px;height:7px;border-radius:50%;background:${person.online ? '#2bb673' : '#9aa6b4'}`, codeStyle: MONO + `;font-size:11px;font-weight:700;padding:4px 9px;border-radius:999px;color:${personSh.color};background:${personSh.bg}`, shiftLabel: `${person.shift || '—'} · ${personSh.name}${personSh.time ? ' · ' + personSh.time : ''}`, tel: tel(person.phone), wa: wa(person.phone), telExt: 'tel:' + (person.ext || ''), phone: person.phone || (phonesOn ? 'Not on record' : 'Hidden for your role'), ext: person.ext || '—', email: person.email || '—' },
        personActionsGrid: `display:grid;grid-template-columns:repeat(${canCall ? 3 : 1},1fr);gap:6px;width:100%`, msgPerson: () => this.openDM(person), personFacts: [['Employee ID', person.emp || '—'], ['BNMC reg.', person.reg || '—'], ['Extension', person.ext || '—'], ['Joined', person.joined || '—']].map(([label, v]) => ({ label, v })), personRooms: personRooms.length ? personRooms : null,
        /* reports */
        periodLabel, periodOpts: periodOpts.map(([k, label]) => ({ label, go: () => this.setState({ repPeriod: k }), style: chip(periodK === k) })), toggleCompare: () => this.setState({ compareOn: !s.compareOn }), compareOn: s.compareOn, compareStyle: chip(s.compareOn),
        repTabs: repTabDef.map(([k, label]) => ({ label, go: () => this.setState({ repTab: k, repSimple: false }), style: pillBtn(s.repTab === k && !s.repSimple).replace('padding:7px 12px', 'padding:7px 2px').replace('font-size:12px', 'font-size:11px') })), repTabName,
        repSimple: s.repSimple, repOverview: !s.repSimple && s.repTab === 'overview', repCensus: !s.repSimple && s.repTab === 'census', repQuality: !s.repSimple && s.repTab === 'quality', repStaffing: !s.repSimple && s.repTab === 'staffing', repSubmitted: !s.repSimple && s.repTab === 'submitted',
        toggleSimple: () => this.setState({ repSimple: !s.repSimple }), simpleBtnStyle: iconBtn(s.repSimple, '#0072a3'), simpleTiles,
        repUpdated: s.repUpdated, refreshReports: () => { this.setState({ refreshing: true }); if (s.demo) setTimeout(() => this.setState({ refreshing: false, repUpdated: timeNow() }), 900); else { this.loadReport(); this.loadShiftReports(); this.loadRequests(); } }, refreshSpin: s.refreshing ? 'animation:rayspin .8s linear infinite' : '',
        exportToast: s.exportToast, insights, repKpis, censusBars, censusTip: s.censusTip, csDash: `${csRateN / 100 * 251.3} 251.3`, csRate: csRateN + '%', csCount: csT, nvdCount: nvdT, occAvg: occAvgN == null ? '—' : occAvgN + '%', bedsUsed: bedsUsed == null ? '—' : bedsUsed, bedsTotal: BEDS || '—', occRows, indicatorCount: INDS.length, indicatorsAlert, shiftReportTitle: shiftReps.some((r) => r.rawDate === todayIso && r.shift === todayCode) ? 'Shift report sent' : 'Submit today’s shift report', shiftReportSub: `${todayCode || '—'} · ${today.name} · ${todayLabel} · 6 steps, about 3 minutes`,
        censusTiles, censusTable, occBars, ragSummary, indicators, staffTiles, staffShifts, absenceRows, submittedReports,
        shareOpen: s.shareOpen, openShare: () => this.setState({ shareOpen: true }), closeShare: () => this.setState({ shareOpen: false }),
        shareOpts: [['PDF', '#b32e2e', 'rgba(214,69,69,.12)', 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6'], ['WhatsApp', '#1d8f57', 'rgba(43,182,115,.14)', 'M21 12a8 8 0 01-8 8H8l-5 3 1.5-4.5A8 8 0 1121 12z'], ['Email', '#6a52d4', 'rgba(106,82,212,.13)', 'M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zM22 6l-10 7L2 6'], ['Print', '#3c4858', 'rgba(125,145,180,.16)', 'M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z']].map(([label, color, bg, d]) => ({ label, color, bg, d, go: () => { this.setState({ shareOpen: false }); if (label === 'WhatsApp') window.open('https://wa.me/?text=' + encodeURIComponent(summaryText), '_blank'); else if (label === 'Print') window.print(); else if (label === 'Email') window.location.href = 'mailto:?subject=' + encodeURIComponent(dept + ' unit report') + '&body=' + encodeURIComponent(summaryText); else { if (navigator.clipboard) navigator.clipboard.writeText(summaryText).catch(() => {}); this.toastMsg('Summary copied — paste it into your report', 'exportToast'); } } })),
        scheduleOpts: [['schedDaily', 'Daily summary · 7 AM', 'WhatsApp to the Nurse Manager'], ['schedWeekly', 'Weekly report · Monday', 'PDF to CNS and Quality']].map(([k, label, sub]) => ({ label, sub, go: () => this.setState({ [k]: !s[k] }), ...track(!!s[k]) })),
        summaryText, copySummary: () => { if (navigator.clipboard) navigator.clipboard.writeText(summaryText).catch(() => {}); this.setState({ shareOpen: false }); this.toastMsg('Summary copied', 'exportToast'); },
        infoOpen: s.infoOpen, closeInfo: () => this.setState({ infoOpen: false }), infoInd: { name: infoIndRaw.name, v: infoIndRaw.noData ? '—' : infoIndRaw.v + (String(infoIndRaw.unit).startsWith('%') ? '%' : ''), bench: infoIndRaw.bench, ragLabel: infoIndRaw.noData ? 'No data' : RAG[ragOf(infoIndRaw)][2], dot: dot(indColor(infoIndRaw)), means: (IND_PLAIN[infoIndRaw.id] || {}).means || (infoIndRaw.num ? `${infoIndRaw.num} ÷ ${infoIndRaw.den}${infoIndRaw.formula ? ' · ' + infoIndRaw.formula : ''}` : ''), action: (IND_PLAIN[infoIndRaw.id] || {}).action || (infoIndRaw.noData ? 'Submit this month’s figures in Data collection.' : ragOf(infoIndRaw) === 'green' ? 'On target — keep the current practice.' : 'Review the cases behind this figure with the team and record an action plan.') }, infoOpenDetail: () => this.setState({ infoOpen: false, screen: 'indicator', selInd: infoIndRaw.id }),
        /* indicator */
        ind: { name: indRaw.name, unit: indRaw.unit, rag: indRaw.noData ? 'No data' : RAG[indRag][2], ragStyle: `font-size:10.5px;font-weight:700;padding:4px 9px;border-radius:999px;color:${indC};background:${indRaw.noData ? 'rgba(125,145,180,.16)' : RAG[indRag][1]};white-space:nowrap`, color: indC, v: indRaw.noData ? '—' : indRaw.v + (String(indRaw.unit).startsWith('%') ? '%' : ''), bench: indRaw.bench, delta: indRaw.noData ? '—' : (deltaV > 0 ? '+' : '') + deltaV, deltaStyle: MONO + `;font-size:16px;font-weight:600;margin-top:4px;color:${better ? '#1d8f57' : '#b32e2e'}`, benchLine: `position:absolute;left:0;right:0;bottom:${18 + Math.round((indRaw.benchV || 0) / trendMax * 70)}px;border-top:1.5px dashed rgba(210,58,82,.6)`, num: indRaw.num, numV: indRaw.numV, den: indRaw.den, denV: indRaw.denV, formula: indRaw.formula },
        indBars, capaItems, capaDone: `${capaItems.filter((c) => c.done).length} of ${capaItems.length} done`, capaDraft: s.capaDraft, setCapaDraft: (e) => this.setState({ capaDraft: e.target.value }), addCapa: () => { const t = s.capaDraft.trim(); if (!t) return; this.setState({ capaDraft: '', capaExtra: { ...s.capaExtra, [indRaw.id]: [...(s.capaExtra[indRaw.id] || []), { text: t, owner: staffName, due: dateLabel(clamp(TODAY + 7, 1, DIM)) }] } }); },
        /* shift report */
        srShiftCode: s.srShift, srStepLabel: `Step ${clamp(s.srStep, 0, 5) + 1} of ${SR_STEPS.length}`, srSent: s.srSent, srNotSent: !s.srSent,
        srSteps: SR_STEPS.map((st, i) => ({ n: i + 1, label: st.label, go: () => this.setState({ srStep: i }), style: `flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;border:0;border-radius:10px;padding:6px 2px;cursor:pointer;background:${i === s.srStep ? 'rgba(0,144,202,.12)' : 'transparent'};color:${i === s.srStep ? '#0072a3' : i < s.srStep ? '#1d8f57' : '#7d8ea8'}`, numStyle: MONO + `;display:grid;place-items:center;width:22px;height:22px;border-radius:50%;font-size:10.5px;font-weight:700;color:#fff;background:${i === s.srStep ? 'linear-gradient(140deg,#0aa0d4,#0072a3)' : i < s.srStep ? '#1d8f57' : 'rgba(125,145,180,.4)'}` })),
        srShiftOpts: srShiftCodes.map((c) => ({ label: `${c} · ${shiftOf(c).name}`, go: () => this.setState({ srShift: c }), style: pillBtn(s.srShift === c) })), srHasShiftPick: s.srStep === 0, srHasCounts: !!step.fields, srSectionTitle: step.label, srCounts, srTotalLabel: step.total, srTotal,
        srHasNotes: step.key === 'notes', srNotes: [['obs', 'Observations', 'Ward round findings, condition changes'], ['issues', 'Issues & escalations', 'Equipment, staffing, patient complaints'], ['handover', 'Handover to next shift', 'What must happen in the next 8 hours']].map(([k, label, ph]) => ({ label, ph, v: s.srNotes[k], set: (e) => this.setState({ srNotes: { ...s.srNotes, [k]: e.target.value } }) })),
        srHasReview: step.key === 'review', srReview, srCanBack: s.srStep > 0, srBack: () => this.setState({ srStep: Math.max(0, s.srStep - 1) }), srNextLabel: s.srStep >= SR_STEPS.length - 1 ? (s.busy.shiftrep ? 'Sending…' : 'Submit report') : 'Next: ' + SR_STEPS[s.srStep + 1].label,
        srNext: () => { if (s.srStep < SR_STEPS.length - 1) return this.setState({ srStep: s.srStep + 1 }); this.submitShiftReport({ dept: unit ? unit.id : undefined, date: todayIso, shift: s.srShift, counts: s.srVals, notes: s.srNotes }); },
        exportReport: () => { if (navigator.clipboard) navigator.clipboard.writeText(srReview.map((r) => r.label + ': ' + r.v).join('\n')).catch(() => {}); this.toastMsg('Shift report copied', 'exportToast'); },
        /* data collection */
        dcDueLabel: dcMonth === DC_CUR ? `Due ${DC_DUE_DAY} ${MON3[M]} · ${DC_DUE_DAY - TODAY} days left` : dcMonth < DC_CUR ? 'Closed month · corrections only' : 'Not open yet', dcDueStyle: `font-size:11px;font-weight:700;color:${dcMonth === DC_CUR ? (DC_DUE_DAY - TODAY <= 5 ? '#b32e2e' : '#b8650a') : '#7d8ea8'}`,
        dcPrevMonth: () => this.setState({ dcMonth: Math.max(0, dcMonth - 1) }), dcNextMonth: () => this.setState({ dcMonth: Math.min(DC_MONTHS.length - 1, dcMonth + 1) }),
        dcDash: `${dcTotal ? dcSent / dcTotal * 194.8 : 0} 194.8`, dcPct: (dcTotal ? Math.round(dcSent / dcTotal * 100) : 0) + '%', dcSentCount: dcSent, dcTotal,
        dcStatusChips: ['All', 'Sent', 'Approved', 'Returned', 'Not submitted'].map((f) => { const n = f === 'All' ? dcItemsRaw.length : dcItemsRaw.filter((it) => dcFilterMap[f].includes(it.status)).length; const c = f === 'Approved' ? '#1d8f57' : f === 'Returned' ? '#b32e2e' : f === 'Sent' ? '#0072a3' : f === 'Not submitted' ? '#b8650a' : '#3c4858'; return { label: f, n, go: () => this.setState({ dcFilter: f }), dot: `width:7px;height:7px;border-radius:50%;background:${c}`, style: `display:inline-flex;align-items:center;gap:5px;border:1px solid ${s.dcFilter === f ? 'rgba(0,144,202,.5)' : 'rgba(125,145,180,.25)'};border-radius:999px;padding:4px 9px;font-size:11px;font-weight:600;cursor:pointer;background:${s.dcFilter === f ? 'rgba(0,144,202,.12)' : 'rgba(255,255,255,.7)'};color:${s.dcFilter === f ? '#0072a3' : '#3c4858'}` }; }),
        dcToast: s.dcToast, dcItems,
        dcSteps: [['Enter', 'fill the sheet or the numerator and denominator'], ['Send', 'it goes to Quality & Administration for review'], ['Review', 'approved values feed the hospital dashboard, returned ones come back with a reason'], ['Correct', 'an approved figure can be corrected — administration approves again']].map(([t, d], i) => ({ n: i + 1, t, d })),
        /* data-collection form */
        dcItem, dcFormSent: s.dcFormSent, dcFormOpen: !s.dcFormSent, dcSentTitle: dcNeedsCorr ? 'Correction sent' : 'Submitted for review', dcNeedsCorr, dcNextOpenLabel: openCount > 1 ? 'Next open item' : 'Back to list', dcNextOpen: () => { const next = dcItemsRaw.find((it) => (it.status === 'missing' || it.status === 'rejected') && it.id !== dcItem0.id); if (next) go('datacolForm', { dcSel: next.id, dcFormSent: false, dcGuideOpen: false, dcNote: '', dcCorr: '' }); else go('datacol', { dcFormSent: false }); },
        dcIsStat: dcItem0.kind === 'stat', dcIsQuality: dcItem0.kind === 'q', dcStatFields, dcIsGrouped: !!dcItem0.grouped, dcModeOpts: [['direct', 'Direct entry'], ['group', 'By staff group']].map(([k, label]) => ({ label, go: () => this.setState({ dcMode: k }), style: pillBtn(s.dcMode === k) })), dcByGroup: byGroup, dcGroups, dcDirect: !byGroup,
        dcReadOnly, dcNum, setDcNum: dcSet('num'), dcNumStyle: roStyle(dcReadOnly), dcDen, setDcDen: dcSet('den'), dcDenReadOnly: dcReadOnly || !!dcItem0.denLocked || isCount, dcDenStyle: roStyle(dcReadOnly || !!dcItem0.denLocked || isCount),
        dcResult: resultV == null ? '—' : (dcItem0.unit === '%' ? resultV + '%' : String(resultV)), dcResultBg: resultOk == null ? 'rgba(125,145,180,.1)' : resultOk ? 'rgba(43,182,115,.12)' : 'rgba(214,69,69,.1)', dcResultColor: resultOk == null ? '#7d8ea8' : resultOk ? '#1d8f57' : '#b32e2e', dcResultLabel: resultV == null ? (isCount ? 'enter the count' : 'enter both values') : resultOk == null ? 'no benchmark set' : resultOk ? 'within benchmark' : 'outside benchmark',
        toggleDcGuide: () => this.setState({ dcGuideOpen: !s.dcGuideOpen }), dcGuideOpen: s.dcGuideOpen, dcGuideChevron: s.dcGuideOpen ? 'transform:rotate(180deg)' : '', dcGuide: guide ? [['Definition', guide.def, 'inherit'], ['Worked example', guide.example, "'IBM Plex Mono',monospace"], ['Benchmark', `${dcItem0.bench} ${dcItem0.meta || ''}`, "'IBM Plex Mono',monospace"], ['Reference', guide.ref, 'inherit']].filter((g) => g[1]).map(([label, text, font]) => ({ label, text, font })) : [],
        dcEditable, dcCorr: s.dcCorr, setDcCorr: (e) => this.setState({ dcCorr: e.target.value }), dcNote: s.dcNote, setDcNote: (e) => this.setState({ dcNote: e.target.value }), toggleDcEvidence: () => this.setState({ dcEvidence: !s.dcEvidence }), dcEvidenceStyle: chip(s.dcEvidence) + ';display:inline-flex;align-items:center;gap:6px;align-self:flex-start', dcEvidenceLabel: s.dcEvidence ? 'Register photo noted' : 'Attach register photo',
        dcSaveDraft: () => { this.setState({ dcSubs: { ...s.dcSubs, [dcMonth]: { ...(s.dcSubs[dcMonth] || {}), [dcItem0.id]: { status: 'draft', num: numN, den: denN, vals: dcStatFields.map((f) => f.v), at: dayStamp(), note: s.dcNote } } }, screen: 'datacol' }); this.toastMsg('Draft saved on this phone · not sent yet', 'dcToast'); },
        dcSubmitLabel: s.busy.dc ? 'Sending…' : dcNeedsCorr ? 'Send correction' : 'Submit to administration', dcSubmitStyle: `flex:2;border:0;border-radius:13px;padding:13px;font-size:14px;font-weight:700;cursor:${s.busy.dc ? 'wait' : 'pointer'};${BLUE_BTN};opacity:${dcSubmitOk ? 1 : .5}`,
        dcSubmit: () => { if (!dcSubmitOk || s.busy.dc) return; this.submitDc(dcItem0, dcM, { num: numN, den: denN, vals: dcStatFields.map((f) => (f.v === '' ? '' : Number(f.v))), note: s.dcNote, corr: s.dcCorr, isCorr: dcNeedsCorr, dept: dcDept, area: dcArea, resultV }); },
        /* submission history */
        dcHistTiles: [['Sent', histAll.filter((h) => stOf(h.sub) === 'sent').length, '#0072a3'], ['Approved', histAll.filter((h) => stOf(h.sub) === 'approved').length, '#1d8f57'], ['Returned', histAll.filter((h) => stOf(h.sub) === 'rejected').length, '#b32e2e']].map(([label, v, color]) => ({ label, v, color })),
        dcHistFilters: ['All', 'Pending', 'Approved', 'Returned'].map((f) => ({ label: f, go: () => this.setState({ dcHistFilter: f }), style: chip(s.dcHistFilter === f) })), dcHistory,
        /* handover */
        handoverStats: [{ n: handoverAll.length, label: 'Patients', color: '#0072a3' }, { n: critN, label: 'Critical', color: critN ? '#b32e2e' : '#1d8f57' }, { n: pendingH, label: 'Pending', color: pendingH ? '#b8650a' : '#1d8f57' }], handoverItems, handoverDraft: s.handoverDraft, setHandoverDraft: (e) => this.setState({ handoverDraft: e.target.value }),
        addHandover: () => { const t = s.handoverDraft.trim(); if (!t) return; const m = t.match(/^(B\d+|Bed\s*\d+)[\s:·-]*/i); this.addHandover({ bed: m ? m[1].replace(/bed\s*/i, 'B') : '—', patient: '', prio: /critical|urgent|decel|bleed/i.test(t) ? 'Critical' : /watch|monitor|bp|repeat/i.test(t) ? 'Watch' : 'Routine', note: t.replace(m ? m[0] : '', '') }); },
        /* incident */
        incSent: s.incSent, incNotSent: !s.incSent, incTypes: INC_TYPES.map((t) => ({ label: t, go: () => this.setState({ incType: t }), style: chip(s.incType === t).replace('flex-shrink:0', 'flex-shrink:0;text-align:center') })), incSevs: INC_SEVS.map((t) => ({ label: t, go: () => this.setState({ incSev: t }), style: chip(s.incSev === t) + ';flex:1;text-align:center;padding:6px 4px' })),
        incTime: s.incTime, setIncTime: (e) => this.setState({ incTime: e.target.value }), incDesc: s.incDesc, setIncDesc: (e) => this.setState({ incDesc: e.target.value }), toggleAnon: () => this.setState({ incAnon: !s.incAnon }), anonBoxStyle: box(s.incAnon), incAnon: s.incAnon,
        submitIncident: () => { if (!s.incDesc.trim()) return this.toastMsg('Describe what happened first.'); this.submitIncident({ type: s.incType, severity: s.incSev, time: s.incTime, description: s.incDesc.trim(), anonymous: s.incAnon }); },
        /* performance */
        score: scoreVal == null ? '—' : scoreVal.toFixed(1), scoreDash: `${(scoreVal || 0) / 5 * 251.3} 251.3`, scoreBand: P.band, reviewer: P.reviewer, reviewDate: P.date,
        perfKpis: P.kpis, competencies, supervisorNote: P.note, goals: P.goals,
        /* profile */
        profileFacts: [['Employee ID', empIdShown], ['BNMC reg.', (myRec && (myRec.bnmc || myRec.reg_no)) || '—'], ['Joined', (myRec && myRec.doj) ? fmtIso(myRec.doj) : '—'], ['Unit', unit ? unit.name : dept]].map(([label, v]) => ({ label, v })),
        settings: [{ label: 'Notifications', sub: 'Roster changes, notices, approvals', isToggle: true, isValue: false, go: () => this.savePrefs({ notifOn: !s.notifOn }), ...toggle(s.notifOn) }, { label: 'Biometric sign-in', sub: 'Fingerprint or face instead of PIN', isToggle: true, isValue: false, go: () => this.savePrefs({ biometric: !s.biometric }), ...toggle(s.biometric) }, { label: 'Wake before shift', sub: 'Alarm 90 minutes before each duty', isToggle: true, isValue: false, go: () => this.savePrefs({ wakeOnShift: !s.wakeOnShift }), ...toggle(s.wakeOnShift) }, { label: 'Signed in as', sub: me.username ? '@' + me.username + ' · ' + (bu.roleLabel || me.role || 'nurse') : '—', isToggle: false, isValue: true, value: s.demo ? 'Demo' : rosterLive ? 'Live roster' : 'No roster yet' }],
        ...RE, ...US,
        /* toast text lives outside the design view */
        _toast: s.toast, _booting: s.booting,
      };
    }

    render() {
      const v = this.renderVals();
      return (
        <React.Fragment>
          <View v={v} />
          {v._toast ? <div style={{ position: 'fixed', left: '50%', bottom: 28, transform: 'translateX(-50%)', zIndex: 60, maxWidth: 'min(92vw,380px)', padding: '11px 16px', borderRadius: 14, background: 'rgba(13,28,50,.94)', color: '#fff', fontSize: 13, fontWeight: 600, boxShadow: '0 14px 40px rgba(0,0,0,.3)', animation: 'pop .25s ease' }}>{v._toast}</div> : null}
        </React.Fragment>
      );
    }
  }

  mount(NurseApp, View.CSS);
})();
