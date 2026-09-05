/* MEDICINE INFO v2 — the glassy three-pane drug reference, ported 1:1 from the
 * approved Claude-Design canvas "Medicine Info v2.dc.html" and wired to the REAL
 * catalogue (138k brands on Cloudflare D1 + Cloudinary, via the same /api/med/*
 * endpoints every other medicine screen uses).
 *
 * Left rail    categories (top drug classes, live counts) · favourites · route pills
 * Middle       ranked search / browse list with pack thumbnails, ৳ price, ★,
 *              and the design's tap-two interaction quick-check (real /api/med/check)
 * Right panel  dark hero (floating pack shot, chips, barcode), nursing-considerations
 *              card, fact tiles, Overview/Dosage/Safety/More tabs over the real
 *              monograph — with the design's EN/বাংলা toggle (the dataset carries
 *              Bengali text for the core sections).
 *
 * Favourites persist in localStorage WITH a row snapshot, so the ★ list renders
 * instantly without asking the server for each id.
 * Published as window.MedicineInfoV2 (every bundled file is its own IIFE).
 */
(function () {
  const { useState, useEffect, useMemo, useRef } = React;

  const api = (u) => fetch(u, { headers: { accept: 'application/json' }, credentials: 'same-origin' }).then((r) => r.json());
  const post = (u, b) => fetch(u, { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(b || {}) }).then((r) => r.json());
  const MONO = "'IBM Plex Mono','Noto Sans Bengali',monospace";
  const qs = (o) => Object.keys(o).filter((k) => o[k] !== '' && o[k] != null).map((k) => k + '=' + encodeURIComponent(o[k])).join('&');
  const FAV_KEY = 'unico-medinfo-favs-v1';
  const plain = (v) => String(v || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  /* ---- prose -> scannable bullets -------------------------------------------
   * The dataset's clinical text is one paragraph with INLINE labels ("Assessment:
   * … Administration: … Monitoring: … Education: …"). Split on those labels, then
   * split each section into sentence-level bullets, so a nurse can skim it at the
   * bedside instead of reading a wall of prose. Same rules the source project's
   * own reader uses, so the two render identically.
   */
  const SECTION_LABELS = ['Assessment before administration', 'Assessment', 'Administration', 'Monitoring and duration', 'Monitoring', 'Patient\\/caregiver education', 'Patient education', 'Education', 'Patient selection', 'Selection', 'Dose adjustment', 'Dosing', 'Dose', 'Interactions', 'Red flags', 'Stop\\/switch', 'Duration', 'Contraindications', 'Precautions', 'Storage', 'Cautions', 'Review'];
  const SECTION_RE = () => new RegExp('(?:^|\\s)(' + SECTION_LABELS.join('|') + ')\\s*:\\s*', 'gi');
  const splitSentences = (text) => String(text || '')
    .split(/(?<=[.;])\s+(?=[A-Z0-9“"(])/)
    .map((x) => x.trim().replace(/^[-–•]\s*/, ''))
    .filter((x) => x.length > 2);
  function parseGuidance(raw) {
    const t = plain(raw);
    if (!t) return [];
    const re = SECTION_RE(); const marks = []; let m;
    while ((m = re.exec(t)) !== null) marks.push({ label: m[1], start: m.index, from: m.index + m[0].length });
    if (marks.length >= 2) {
      const out = [];
      marks.forEach((mk, i) => {
        const body = t.slice(mk.from, i + 1 < marks.length ? marks[i + 1].start : t.length).trim();
        if (body) out.push({ label: mk.label, items: splitSentences(body) });
      });
      if (out.length) return out;
    }
    const items = splitSentences(t);
    return [{ label: null, items: items.length > 1 ? items : [t] }];
  }
  // Renders parseGuidance output: labelled sub-headings + bullet lists.
  const Bulleted = ({ text, tone }) => {
    const blocks = parseGuidance(text);
    if (!blocks.length) return null;
    const c = tone || '#0072a3';
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {blocks.map((b, i) => (
          <div key={i}>
            {b.label && <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '.7px', textTransform: 'uppercase', color: c, marginBottom: 3 }}>{b.label}</div>}
            {b.items.length > 1 || b.label
              ? <ul style={{ margin: 0, paddingLeft: 17, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {b.items.map((s2, j) => <li key={j} style={{ fontSize: 12, color: '#2b3a4d', lineHeight: 1.55 }}>{s2}</li>)}
                </ul>
              : <div style={{ fontSize: 12, color: '#2b3a4d', lineHeight: 1.6 }}>{b.items[0]}</div>}
          </div>
        ))}
      </div>
    );
  };

  const PAL = ['#0090ca', '#d23a52', '#1c9c8d', '#e0631e', '#6a52d4', '#0b66d0', '#8a5a10', '#0072a3'];
  const CATICONS = ['M4 6h16M4 12h16M4 18h16', 'M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z', 'M12 21s-8-5-10-10a5 5 0 019-3 5 5 0 019 3c-2 5-10 10-10 10z', 'M12 3s6 7 6 11a6 6 0 01-12 0c0-4 6-11 6-11z', 'M5 12.5l7.5-7.5a4.6 4.6 0 016.5 6.5L11.5 19A4.6 4.6 0 015 12.5zM8.7 8.7l6.6 6.6', 'M12 4v7M9 21c-3 0-4-2-4-5 0-4 2-7 4-7v12zM15 21c3 0 4-2 4-5 0-4-2-7-4-7v12z', 'M12 3s6 7 6 11a6 6 0 01-12 0c0-4 6-11 6-11zM12 14v3', 'M12 2l8 5v10l-8 5-8-5V7z'];
  const ROUTE_PILLS = [['', 'All forms', 'M4 6h16M4 12h16M4 18h16'], ['Tablet', 'Tablet', 'M12 3a9 9 0 100 18 9 9 0 000-18zM5.6 5.6l12.8 12.8'], ['Capsule', 'Capsule', 'M5 12.5l7.5-7.5a4.6 4.6 0 016.5 6.5L11.5 19A4.6 4.6 0 015 12.5zM8.7 8.7l6.6 6.6'], ['Injection', 'Injection', 'M14 4l6 6M15.5 5.5l3-3M12 6l6 6-7 7H6v-5zM6 14l-3 3'], ['Syrup', 'Syrup', 'M9 2h6M10 2v4l-4 5v9a2 2 0 002 2h8a2 2 0 002-2v-9l-4-5V2']];
  const routeOf = (form) => { const f = String(form || '').toLowerCase(); return /injection|infusion|iv|im\b/.test(f) ? 'Injection' : /capsule/.test(f) ? 'Capsule' : /syrup|suspension|solution|drops/.test(f) ? 'Syrup' : 'Tablet'; };
  const RCOL = { Tablet: '#0072a3', Capsule: '#6a52d4', Injection: '#b3541e', Syrup: '#1c9c8d' };
  const RBRIGHT = { Tablet: '#7ac4e8', Capsule: '#b3a1ff', Injection: '#ffb26b', Syrup: '#7fd6cb' };
  const classColor = (cls) => { let h = 0; const s2 = String(cls || ''); for (let i = 0; i < s2.length; i++) h = (h * 31 + s2.charCodeAt(i)) >>> 0; return PAL[h % PAL.length]; };
  const taka = (v) => (v == null ? '' : '৳ ' + (Math.round(v * 100) / 100));
  const bnNum = (t) => String(t).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[d]);

  // Tab -> [monograph key, EN label, BN label, bn-object key]
  const TABSEC = {
    overview: [['indication', 'Indications', 'নির্দেশনা', 'indications'], ['therapeuticClass', 'Therapeutic class', 'থেরাপিউটিক শ্রেণি', null], ['pharmacology', 'Pharmacology', 'ফার্মাকোলজি', 'pharmacology'], ['mechanism', 'Mechanism of action', 'কার্যপ্রণালি', null]],
    dosage: [['dosage', 'Dosage & administration', 'মাত্রা ও সেবনবিধি', 'dosage_text'], ['adultDose', 'Adult dose', 'প্রাপ্তবয়স্ক মাত্রা', null], ['childDose', 'Child dose', 'শিশুদের মাত্রা', null], ['renalDose', 'Renal dose', 'রেনাল মাত্রা', null], ['administration', 'Administration', 'প্রয়োগবিধি', null]],
    safety: [['sideEffects', 'Side effects', 'পার্শ্বপ্রতিক্রিয়া', 'side_effects'], ['contraindications', 'Contraindications', 'প্রতিনির্দেশনা', 'contraindications'], ['interaction', 'Drug interactions', 'ওষুধের মিথস্ক্রিয়া', null], ['pregnancy', 'Pregnancy & lactation', 'গর্ভাবস্থা ও স্তন্যদান', null], ['precautions', 'Precautions', 'সতর্কতা', 'precautions'], ['overdose', 'Overdose', 'অতিরিক্ত মাত্রা', null]],
    // prescriberConsiderations is NOT here — it renders as a Clinical guidance card
    // on Overview, in the structured bullet form, alongside nursing considerations.
    more: [['storage', 'Storage', 'সংরক্ষণ', 'storage_conditions'], ['packaging', 'Packaging', 'প্যাকেজিং', null], ['description', 'Description', 'বিবরণ', null]],
  };
  const PREGC = { A: ['#1c7d70', 'rgba(58,181,167,.14)', 'rgba(58,181,167,.4)'], B: ['#1c7d70', 'rgba(58,181,167,.14)', 'rgba(58,181,167,.4)'], C: ['#8a5a10', 'rgba(224,158,30,.16)', 'rgba(224,158,30,.45)'], D: ['#8c2237', 'rgba(210,58,82,.13)', 'rgba(210,58,82,.4)'], X: ['#8c2237', 'rgba(210,58,82,.13)', 'rgba(210,58,82,.4)'] };

  const loadFavs = () => { try { const f = JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); return Array.isArray(f) ? f : []; } catch (e) { return []; } };

  const Thumb = ({ row, size, radius }) => row.hasImage
    ? <img src={'/api/med/image/' + row.id} alt="" loading="lazy" decoding="async"
        onError={(e) => { e.target.style.display = 'none'; }}
        style={{ width: size, height: size, objectFit: 'contain', borderRadius: radius || 8 }} />
    : <svg width={Math.round(size * .58)} height={Math.round(size * .58)} viewBox="0 0 24 24" fill="none" stroke={RCOL[routeOf(row.form)]} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={ROUTE_PILLS.find((r) => r[0] === routeOf(row.form) || (r[0] === 'Tablet' && routeOf(row.form) === 'Tablet'))[2]} /></svg>;

  function MedicineInfoV2({ setRoute }) {
    const [q, setQ] = useState('');
    // 'all' searches brands by name OR by their generic; 'brand' matches the brand
    // name only; 'generic' searches the generic index and lists generics.
    const [searchMode, setSearchMode] = useState('all');
    const [cat, setCat] = useState('');          // drug class ('' = all)
    const [form, setForm] = useState('');
    const [sortBy, setSortBy] = useState('name');
    const [favs, setFavs] = useState(loadFavs);
    const [favOnly, setFavOnly] = useState(false);
    const [lang, setLang] = useState('en');
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState(null);
    const [classes, setClasses] = useState([]);
    const [sel, setSel] = useState(null);        // { brand, generic, alternatives }
    const [tab, setTab] = useState('overview');
    const [checkMode, setCheckMode] = useState(false);
    const [picks, setPicks] = useState([]);      // [{id,name,genericId}]
    const [checkRes, setCheckRes] = useState(null);
    const [copied, setCopied] = useState(false);
    const seq = useRef(0);
    // The pane row must END at the bottom of the viewport. A guessed constant
    // (100vh − N px) leaves a dead gap when the shell's header is shorter than the
    // guess — so the available height is MEASURED from the row's own position.
    const paneRef = useRef(null);
    const [paneH, setPaneH] = useState(560);
    useEffect(() => {
      const fit = () => { const el = paneRef.current; if (!el) return; setPaneH(Math.max(420, window.innerHeight - el.getBoundingClientRect().top - 16)); };
      fit();
      const t = setTimeout(fit, 250);   // again after fonts/header wrap settle
      window.addEventListener('resize', fit);
      return () => { clearTimeout(t); window.removeEventListener('resize', fit); };
    }, []);
    const bn = lang === 'bn';
    const nb = (t) => bn ? bnNum(String(t)) : String(t);

    useEffect(() => {
      api('/api/med/status').then(setStatus).catch(() => {});
      api('/api/med/refs?kind=class').then((r) => { if (r.ok) setClasses(r.refs || []); }).catch(() => {});
    }, []);

    /* LIST LOADER — realtime. Every response is memoised in the browser, so a URL
       already fetched (backspacing, re-typing, flipping search mode back) renders
       on the SAME tick with no request and no spinner; only a genuinely new query
       waits, and only 90 ms. The server memoises the same queries too, which is
       what makes typing feel like a local index rather than a round trip. */
    const respCache = useRef(new Map());
    const cachedGet = (url) => {
      const c = respCache.current;
      if (c.has(url)) return { hit: true, data: c.get(url) };
      return { hit: false, p: api(url).then((r) => { if (r && r.ok) { c.set(url, r); if (c.size > 250) c.delete(c.keys().next().value); } return r; }) };
    };
    useEffect(() => {
      const mine = ++seq.current;
      const term = q.trim();
      const wantGenerics = searchMode === 'generic';
      const url = term
        ? '/api/med/search?' + qs({ q: term, kind: wantGenerics ? 'generic' : 'brand', field: searchMode === 'brand' ? 'name' : '', limit: 40, form: wantGenerics ? '' : form })
        : '/api/med/browse?' + qs({ per: 40, page, class: cat, form: wantGenerics ? '' : form, kind: wantGenerics ? 'generic' : '' });
      const take = (r) => {
        if (mine !== seq.current || !r || !r.ok) return;
        const list = term ? (wantGenerics ? (r.generics || []) : (r.brands || [])) : (r.rows || []);
        setRows((old) => (!term && page > 1) ? old.concat(list) : list);
        setTotal(term ? list.length : (r.total || list.length));
        setLoading(false);
        // live preview: keep the panel showing the best current match while typing
        if (list.length && (!sel || term)) (wantGenerics ? openGeneric : openBrand)(list[0].id, true);
      };
      const got = cachedGet(url);
      if (got.hit) { take(got.data); return; }           // instant — no debounce, no spinner
      setLoading(true);
      const t = setTimeout(() => { const g = cachedGet(url); (g.hit ? Promise.resolve(g.data) : g.p).then(take).catch(() => { if (mine === seq.current) setLoading(false); }); }, term ? 90 : 0);
      return () => clearTimeout(t);
    }, [q, cat, form, page, searchMode]);   // eslint-disable-line
    useEffect(() => { setPage(1); }, [q, cat, form, searchMode]);

    // `quiet` = opened by the live preview, so it must not steal the tab the user chose
    const openBrand = (id, quiet) => {
      const got = cachedGet('/api/med/brand/' + encodeURIComponent(id));
      const use = (r) => { if (r && r.ok) { setSel(r); if (!quiet) setTab('overview'); } };
      if (got.hit) use(got.data); else got.p.then(use).catch(() => {});
    };
    const openGeneric = (id, quiet) => {
      const got = cachedGet('/api/med/generic/' + encodeURIComponent(id));
      const use = (r) => { if (r && r.ok) { setSel({ ok: true, brand: null, generic: r.generic, alternatives: r.brands || [], interactions: r.interactions || [], foodWarnings: r.foodWarnings || [] }); if (!quiet) setTab('overview'); } };
      if (got.hit) use(got.data); else got.p.then(use).catch(() => {});
    };
    const toggleFav = (row) => {
      setFavs((f) => {
        const has = f.some((x) => x.id === row.id);
        const next = has ? f.filter((x) => x.id !== row.id)
          : f.concat([{ id: row.id, name: row.name, strength: row.strength, form: row.form, generic: row.generic, price: row.price, hasImage: row.hasImage, drugClass: row.drugClass }]);
        try { localStorage.setItem(FAV_KEY, JSON.stringify(next)); } catch (e) {}
        return next;
      });
    };
    const isFav = (id) => favs.some((x) => x.id === id);

    const clickRow = (row) => {
      if (!checkMode) return searchMode === 'generic' ? openGeneric(row.id) : openBrand(row.id);
      setPicks((p) => {
        const has = p.some((x) => x.id === row.id);
        const next = has ? p.filter((x) => x.id !== row.id) : (p.length < 2 ? p.concat([row]) : [p[1], row]);
        return next;
      });
    };
    useEffect(() => {
      if (picks.length !== 2) { setCheckRes(null); return; }
      post('/api/med/check', { genericIds: picks.map((p) => p.genericId).filter(Boolean) })
        .then((r) => setCheckRes(r.ok ? (r.warnings || []) : null)).catch(() => setCheckRes(null));
    }, [picks]);

    const shown = useMemo(() => {
      let list = favOnly ? favs.slice() : rows;
      if (favOnly && q.trim()) { const ql = q.trim().toLowerCase(); list = list.filter((r) => (r.name + ' ' + (r.generic || '')).toLowerCase().includes(ql)); }
      if (sortBy === 'price') list = list.slice().sort((a, b) => (((a.price && a.price.unit) == null) - ((b.price && b.price.unit) == null)) || (((a.price && a.price.unit) || 0) - ((b.price && b.price.unit) || 0)));
      return list;
    }, [rows, favs, favOnly, sortBy, q]);

    const gen = sel && sel.generic;
    // A generic-mode selection has no brand row; the hero and fact tiles read this
    // ONE shape either way, so there is a single render path for both.
    const brand = (sel && sel.brand) || (gen ? {
      id: gen.id, name: gen.name, strength: '', generic: (gen.forms || []).join(' · '),
      form: (gen.forms || [])[0] || '', manufacturer: '', drugClass: gen.drugClass,
      price: null, hasImage: false, abx: gen.abx, confidence: gen.confidence,
      pregnancyCategory: gen.pregnancyCategory, isGeneric: true,
      brandCount: (sel && sel.alternatives) ? sel.alternatives.length : gen.brands,
    } : null);
    const ac = brand ? classColor(brand.drugClass) : '#0090ca';
    const mono = (gen && gen.monograph) || {};
    const bnSec = mono.bn || {};
    const route = brand ? routeOf(brand.form) : 'Tablet';
    const nursing = mono.nursingConsiderations ? plain(mono.nursingConsiderations) : '';
    const prescriberG = mono.prescriberConsiderations ? plain(mono.prescriberConsiderations) : '';
    const lowConf = (brand && brand.confidence) === 'low';
    const preg = (gen && gen.pregnancyCategory) || (brand && brand.pregnancyCategory) || '';

    const sections = (TABSEC[tab] || []).map(([key, en, bnl, bnKey]) => {
      const enBody = mono[key] ? plain(mono[key]) : '';
      const bnBody = bnKey && bnSec[bnKey] ? plain(bnSec[bnKey]) : '';
      const body = bn ? (bnBody || enBody) : enBody;
      return body ? { key, t: bn ? bnl : en, body } : null;
    }).filter(Boolean);

    const L = bn
      ? { title: 'ঔষধের তথ্যভাণ্ডার', search: searchMode === 'brand' ? 'ব্র্যান্ডের নাম খুঁজুন — Napa, Seclo…' : searchMode === 'generic' ? 'জেনেরিক নাম খুঁজুন — Paracetamol…' : 'ব্র্যান্ড, জেনেরিক বা শ্রেণি খুঁজুন…',
          mAll: 'সব', mBrand: 'ব্র্যান্ড', mGeneric: 'জেনেরিক', mTip_all: 'ব্র্যান্ড ও জেনেরিক — দুটোতেই খোঁজে', mTip_brand: 'শুধু ব্র্যান্ডের নামে খোঁজে', mTip_generic: 'জেনেরিক তালিকায় খোঁজে', brandsOf: 'ব্র্যান্ড', cats: 'শ্রেণিসমূহ', forms: 'ডোজ ফর্ম', all: 'সব', favs: 'প্রিয়', sortName: 'নাম (A–Z)', sortPrice: 'দাম', check: 'ইন্টারঅ্যাকশন যাচাই', checkHint: 'তালিকা থেকে দুটি ওষুধে ক্লিক করে পরস্পরের সাথে যাচাই করুন।', clear: 'মুছুন', picked: 'নির্বাচিত', mfr: 'প্রস্তুতকারক', nursing: 'নার্সিং নির্দেশনা', prescriber: 'প্রেসক্রাইবার নির্দেশনা', clinicalGuidance: 'ক্লিনিক্যাল নির্দেশনা', aiWritten: 'AI-লিখিত', lowConf: 'এই ওষুধটি ফার্মাকোলজি সাহিত্যে ভালোভাবে নথিভুক্ত নয় — নিচের নির্দেশনা শুধু ইঙ্গিত হিসেবে নিন, চূড়ান্ত নয়।', tabs: { overview: 'ওভারভিউ', dosage: 'মাত্রা', safety: 'নিরাপত্তা', alts: 'বিকল্প', more: 'আরও' }, statMeds: 'ওষুধ', statGen: 'জেনেরিক', statCls: 'শ্রেণি', empty1: 'কোনো ওষুধ পাওয়া যায়নি', empty2: 'অন্য ব্র্যান্ড বা জেনেরিক নাম লিখুন, অথবা ফিল্টার মুছে দিন।', similar: 'একই জেনেরিকের অন্য ব্র্যান্ড', disclaimer: 'নার্সিং স্টাফদের জন্য রেফারেন্স তথ্য। ওষুধ প্রয়োগের আগে সবসময় চলতি প্রেসক্রিপশন ও হাসপাতাল ফর্মুলারির সাথে মিলিয়ে নিন।', preg: 'গর্ভাবস্থা', formT: 'ডোজ ফর্ম', priceT: 'দাম', confT: 'তথ্যের মান', loadMore: 'আরও দেখুন', copyT: 'সারসংক্ষেপ কপি', noPair: 'ফর্মুলারি ডেটায় বড় কোনো মিথস্ক্রিয়া নেই। তবু সম্পূর্ণ প্রেসক্রিপশনের সাথে মিলিয়ে নিন।' }
      : { title: 'Medicine Information', search: searchMode === 'brand' ? 'Search a brand name — Napa, Seclo…' : searchMode === 'generic' ? 'Search a generic name — Paracetamol…' : 'Search brand, generic or class…',
          mAll: 'All', mBrand: 'Brand', mGeneric: 'Generic', mTip_all: 'Match either a brand name or its generic', mTip_brand: 'Match the brand name only', mTip_generic: 'Search the generic index', brandsOf: 'brands', cats: 'Categories', forms: 'Dosage form', all: 'All', favs: 'Favorites', sortName: 'A–Z', sortPrice: 'Price', check: 'Interaction check', checkHint: 'Tap two medicines in the list to check them against each other.', clear: 'Clear', picked: 'SELECTED', mfr: 'Manufacturer', nursing: 'Nursing considerations', prescriber: 'Prescriber considerations', clinicalGuidance: 'Clinical guidance', aiWritten: 'AI-written', lowConf: 'Low confidence — this preparation is not well documented in pharmacological literature. Treat the guidance below as indicative only, not authoritative.', tabs: { overview: 'Overview', dosage: 'Dosage', safety: 'Safety', alts: 'Alternatives', more: 'More' }, statMeds: 'medicines', statGen: 'generics', statCls: 'classes', empty1: 'No medicines match your search', empty2: 'Try a different brand, generic name or clear the filters.', similar: 'Other brands of this generic', disclaimer: 'Reference information for nursing staff. Always confirm against the current prescription and hospital formulary before administration.', preg: 'Pregnancy', formT: 'Dosage form', priceT: 'Price', confT: 'Data confidence', loadMore: 'Load more', copyT: 'Copy summary', noPair: 'No major interaction recorded in the formulary data. Always verify against the full prescription.' };

    const cats = useMemo(() => {
      const top = classes.slice(0, 8);
      return [{ name: '', label: L.all, count: status ? status.brands : 0, c: '#0072a3', icon: CATICONS[0] }]
        .concat(top.map((r, i) => ({ name: r.name, label: r.name, count: r.count, c: PAL[(i + 1) % PAL.length], icon: CATICONS[(i + 1) % CATICONS.length] })));
    }, [classes, status, lang]);

    const sevMeta = (w) => w.severity === 'critical' || w.severity === 'high'
      ? [bn ? 'গুরুতর' : 'Major', '#8c2237', 'rgba(210,58,82,.14)', 'rgba(210,58,82,.4)']
      : [bn ? 'মাঝারি' : 'Moderate', '#8a5a10', 'rgba(224,158,30,.16)', 'rgba(224,158,30,.45)'];

    const copySummary = () => {
      if (!brand) return;
      const t = brand.name + ' (' + (brand.generic || '') + ') ' + (brand.strength || '') + (mono.dosage ? ' — ' + plain(mono.dosage).slice(0, 300) : '');
      try { navigator.clipboard.writeText(t); } catch (e) {}
      setCopied(true); setTimeout(() => setCopied(false), 1600);
    };

    const glass = { background: 'rgba(255,255,255,.62)', border: '1px solid rgba(255,255,255,.92)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', boxShadow: '0 8px 20px rgba(31,59,90,.08)' };
    const secLbl = { fontSize: 9.5, fontWeight: 700, letterSpacing: '.9px', textTransform: 'uppercase', color: '#7d8ea8', padding: '2px 6px 5px' };
    const langBtn = (on) => ({ fontSize: 11, fontWeight: 700, padding: '4px 11px', borderRadius: 16, cursor: 'pointer', transition: 'all .15s', ...(on ? { background: 'linear-gradient(90deg,#0090ca,#3ab5a7)', color: '#fff', boxShadow: '0 3px 10px rgba(0,144,202,.35)' } : { color: '#55677d' }) });

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0, fontFamily: "'IBM Plex Sans','Noto Sans Bengali',system-ui,sans-serif" }}>
        {/* ===== header row ===== */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.3px', whiteSpace: 'nowrap' }}>{L.title}</div>
            <div style={{ color: '#6c7a8c', fontSize: 11.5, marginTop: 1, whiteSpace: 'nowrap' }}>{status ? nb(status.brands.toLocaleString()) + ' ' + L.statMeds + ' · ' + nb(status.generics.toLocaleString()) + ' ' + L.statGen : '…'}</div>
          </div>
          <div style={{ ...glass, display: 'flex', alignItems: 'center', gap: 9, borderRadius: 12, padding: '10px 14px', flex: '1 1 260px', maxWidth: 520 }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#7d8ea8" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M11 4a7 7 0 105 12l4 4M11 4a7 7 0 015 12" /></svg>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={L.search} style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 13.5, color: '#16202e', minWidth: 0 }} />
            {!!q.trim() && <span onClick={() => setQ('')} style={{ cursor: 'pointer', color: '#9aa6b4', display: 'grid', placeItems: 'center' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg></span>}
            {/* what the query is matched against — a brand name and a generic name are
                different questions, so they get their own search modes. */}
            <div style={{ display: 'inline-flex', gap: 2, background: 'rgba(31,59,90,.06)', borderRadius: 9, padding: 2, flexShrink: 0 }}>
              {[['all', L.mAll], ['brand', L.mBrand], ['generic', L.mGeneric]].map(([k, lab]) => (
                <span key={k} onClick={() => setSearchMode(k)} title={L['mTip_' + k]}
                  style={{ fontSize: 10.5, fontWeight: searchMode === k ? 700 : 500, padding: '4px 9px', borderRadius: 7, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all .15s', ...(searchMode === k ? { background: '#fff', color: '#0072a3', boxShadow: '0 2px 6px rgba(31,59,90,.12)' } : { color: '#7d8ea8' }) }}>{lab}</span>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            {[[status ? status.brands.toLocaleString() : '—', L.statMeds, '#0072a3'], [status ? status.generics.toLocaleString() : '—', L.statGen, '#1c7d70'], [classes.length ? classes.length.toLocaleString() : '—', L.statCls, '#6a52d4']].map(([n, lab, c], i) => (
              <div key={i} style={{ ...glass, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '6px 14px', borderRadius: 11, color: c }}>
                <b style={{ fontFamily: MONO, fontSize: 15.5 }}>{nb(n)}</b><span style={{ fontSize: 10, opacity: .8 }}>{lab}</span>
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,.55)', border: '1px solid rgba(255,255,255,.85)', borderRadius: 20, padding: 3, gap: 2 }}>
              <span onClick={() => setLang('en')} style={langBtn(!bn)}>EN</span>
              <span onClick={() => setLang('bn')} style={langBtn(bn)}>বাংলা</span>
            </div>
          </div>
        </div>

        {/* ===== three panes ===== */}
        <div ref={paneRef} style={{ display: 'flex', gap: 13, minHeight: 0, height: paneH }}>
          {/* left rail */}
          <div style={{ width: 'clamp(132px,13vw,192px)', flexShrink: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3, paddingRight: 2 }}>
            <div style={secLbl}>{L.cats}</div>
            {cats.map((c) => {
              const on = cat === c.name;
              return (
                <div key={c.name || 'all'} onClick={() => setCat(on ? '' : c.name)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: on ? 600 : 500, padding: '7px 9px', borderRadius: 10, cursor: 'pointer', transition: 'all .15s', ...(on ? { background: 'rgba(255,255,255,.75)', border: '1px solid ' + c.c + '55', boxShadow: '0 6px 16px rgba(31,59,90,.1)', color: '#16202e' } : { background: 'transparent', border: '1px solid transparent', color: '#55677d' }) }}>
                  <span style={{ width: 24, height: 24, borderRadius: 8, display: 'grid', placeItems: 'center', flexShrink: 0, color: on ? '#fff' : c.c, background: on ? c.c : c.c + '1f', transition: 'all .15s' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={c.icon} /></svg>
                  </span>
                  <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.label}</span>
                  <span style={{ fontFamily: MONO, fontSize: 9.5, padding: '0 6px', borderRadius: 8, background: on ? c.c + '22' : 'rgba(31,59,90,.07)', color: on ? c.c : '#7d8ea8' }}>{nb((c.count || 0).toLocaleString())}</span>
                </div>
              );
            })}
            <div style={{ height: 1, background: 'rgba(31,59,90,.12)', margin: '8px 4px' }} />
            <div onClick={() => setFavOnly((v) => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: favOnly ? 600 : 500, padding: '7px 10px', borderRadius: 10, cursor: 'pointer', transition: 'all .15s', ...(favOnly ? { background: 'linear-gradient(90deg,#e09e1e,#d2691e)', color: '#fff', border: '1px solid transparent', boxShadow: '0 4px 12px rgba(224,158,30,.35)' } : { background: 'transparent', color: '#8a5a10', border: '1px solid rgba(224,158,30,.3)' }) }}>
              ★<span style={{ flex: 1 }}>{L.favs}{favs.length ? ' (' + nb(favs.length) + ')' : ''}</span>
            </div>
            <div style={{ ...secLbl, padding: '10px 6px 5px' }}>{L.forms}</div>
            {ROUTE_PILLS.map(([f, lab, icon]) => {
              const on = form === f;
              return (
                <div key={f || 'all'} onClick={() => setForm(f)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, fontWeight: on ? 600 : 500, padding: '6px 10px', borderRadius: 9, cursor: 'pointer', transition: 'all .15s', ...(on ? { background: 'rgba(13,28,50,.9)', color: '#fff', border: '1px solid rgba(13,28,50,.9)' } : { background: 'transparent', color: '#55677d', border: '1px solid transparent' }) }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={icon} /></svg>
                  <span style={{ flex: 1 }}>{f ? lab : L.all}</span>
                </div>
              );
            })}
          </div>

          {/* middle list */}
          <div style={{ width: 'clamp(230px,25vw,328px)', flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0, gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', flexShrink: 0 }}>
              {[['name', L.sortName], ['price', L.sortPrice]].map(([k, lab]) => (
                <div key={k} onClick={() => setSortBy(k)} style={{ fontSize: 10.5, fontWeight: sortBy === k ? 600 : 500, padding: '4px 10px', borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all .15s', ...(sortBy === k ? { background: 'rgba(0,114,163,.14)', color: '#0072a3', border: '1px solid rgba(0,144,202,.35)' } : { background: 'rgba(255,255,255,.55)', color: '#7d8ea8', border: '1px solid rgba(255,255,255,.9)' }) }}>{lab}</div>
              ))}
              <div onClick={() => { setCheckMode((v) => !v); setPicks([]); }}
                style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: checkMode ? 600 : 500, padding: '4px 10px', borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all .15s', ...(checkMode ? { background: 'linear-gradient(90deg,#6a52d4,#0090ca)', color: '#fff', border: '1px solid transparent', boxShadow: '0 4px 12px rgba(106,82,212,.35)' } : { background: 'rgba(255,255,255,.55)', color: '#5a44b8', border: '1px solid rgba(106,82,212,.3)' }) }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 3 14h7l-1 8 11-13h-8l1-7" /></svg>{L.check}
              </div>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: '#7d8ea8', fontFamily: MONO }}>{nb(favOnly ? shown.length : total.toLocaleString())}</span>
            </div>
            {checkMode && (
              <div style={{ background: 'linear-gradient(90deg,rgba(106,82,212,.12),rgba(0,144,202,.07))', border: '1px solid rgba(106,82,212,.32)', borderRadius: 12, padding: '10px 12px', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                  <b style={{ fontSize: 11.5, color: '#3a2d80' }}>{L.check}</b>
                  <span onClick={() => setPicks([])} style={{ marginLeft: 'auto', fontSize: 10.5, fontWeight: 600, color: '#0072a3', cursor: 'pointer' }}>{L.clear}</span>
                </div>
                <div style={{ fontSize: 11, color: '#55677d', marginTop: 2 }}>{picks.length ? picks.map((p) => p.name).join('  +  ') : L.checkHint}</div>
                {picks.length === 2 && checkRes != null && (
                  <div style={{ marginTop: 7, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    {checkRes.length
                      ? (() => { const w = checkRes[0], m = sevMeta(w); return (<>
                          <span style={{ flexShrink: 0, fontSize: 9.5, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: m[1], background: m[2], border: '1px solid ' + m[3], borderRadius: 6, padding: '3px 8px' }}>{m[0]}</span>
                          <div style={{ fontSize: 11.5, lineHeight: 1.5, color: '#2b3a4d', flex: 1 }}>{w.detail || w.title}</div>
                        </>); })()
                      : (<>
                          <span style={{ flexShrink: 0, fontSize: 9.5, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: '#1c7d70', background: 'rgba(58,181,167,.15)', border: '1px solid rgba(58,181,167,.4)', borderRadius: 6, padding: '3px 8px' }}>{bn ? 'ক্ষতিকর নয়' : 'No known harm'}</span>
                          <div style={{ fontSize: 11.5, lineHeight: 1.5, color: '#2b3a4d', flex: 1 }}>{L.noPair}</div>
                        </>)}
                  </div>
                )}
              </div>
            )}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 7, minHeight: 0, padding: '2px 2px 8px' }}>
              {shown.map((m) => {
                const isGenRow = searchMode === 'generic' && !favOnly;
                const on = !checkMode && brand && brand.id === m.id;
                const mc = classColor(m.drugClass);
                const picked = picks.some((x) => x.id === m.id);
                return (
                  <div key={m.id} onClick={() => clickRow(m)}
                    style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px 9px 14px', borderRadius: 13, cursor: 'pointer', transition: 'all .16s', flexShrink: 0, ...(on ? { background: 'rgba(255,255,255,.85)', border: '1px solid ' + mc + '77', boxShadow: '0 12px 28px ' + mc + '2e,0 4px 12px rgba(31,59,90,.1)' } : { background: 'rgba(255,255,255,.5)', border: '1px solid rgba(255,255,255,.85)' }) }}>
                    <span style={{ position: 'absolute', left: 0, top: 8, bottom: 8, width: 3.5, borderRadius: '0 4px 4px 0', background: mc + (on ? '' : '66') }} />
                    <div style={{ width: 46, height: 46, background: '#fff', borderRadius: 10, flexShrink: 0, display: 'grid', placeItems: 'center', border: '1px solid rgba(31,59,90,.07)', overflow: 'hidden' }}>
                      <Thumb row={m} size={38} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: '0 1 auto', minWidth: 52 }}>{m.name}</span>
                        {!isGenRow && <span style={{ fontFamily: MONO, fontSize: 10, color: '#0072a3', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0, flex: '0 1 auto' }}>{m.strength}</span>}
                        {picked && <span style={{ fontSize: 8.5, fontWeight: 700, background: 'linear-gradient(90deg,#6a52d4,#0090ca)', color: '#fff', padding: '1px 6px', borderRadius: 5, flexShrink: 0 }}>{L.picked}</span>}
                      </div>
                      <div style={{ fontSize: 11, color: '#55677d', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>
                        {isGenRow ? (m.drugClass || '—') : (m.generic + (m.manufacturer ? ' · ' + m.manufacturer : ''))}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                      {!isGenRow && <span onClick={(e) => { e.stopPropagation(); toggleFav(m); }} style={{ fontSize: 13, cursor: 'pointer', lineHeight: 1, userSelect: 'none', color: isFav(m.id) ? '#e09e1e' : 'rgba(31,59,90,.2)' }}>★</span>}
                      {isGenRow
                        ? <span style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 700, color: '#0072a3', whiteSpace: 'nowrap' }}>{nb(m.brands || 0)} <span style={{ fontFamily: 'inherit', fontWeight: 500, color: '#7d8ea8' }}>{L.brandsOf}</span></span>
                        : (m.price && m.price.unit != null && <span style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 600, color: '#3c4858', whiteSpace: 'nowrap' }}>{nb(taka(m.price.unit))}</span>)}
                    </div>
                  </div>
                );
              })}
              {!loading && !shown.length && (
                <div style={{ textAlign: 'center', padding: '44px 16px', color: '#7d8ea8' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#55677d' }}>{L.empty1}</div>
                  <div style={{ fontSize: 11.5, marginTop: 3 }}>{L.empty2}</div>
                </div>
              )}
              {!favOnly && !q.trim() && rows.length < total && (
                <button onClick={() => setPage((p) => p + 1)} style={{ ...glass, border: '1px solid rgba(0,144,202,.3)', color: '#0072a3', borderRadius: 10, padding: '8px 10px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{loading ? '…' : L.loadMore}</button>
              )}
            </div>
          </div>

          {/* right detail */}
          <div style={{ flex: 1, minWidth: 340, background: 'rgba(255,255,255,.55)', border: '1px solid rgba(255,255,255,.9)', backdropFilter: 'blur(24px) saturate(1.5)', WebkitBackdropFilter: 'blur(24px) saturate(1.5)', borderRadius: 18, boxShadow: '0 16px 44px rgba(31,59,90,.12)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {!brand ? (
              <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: '#7d8ea8', fontSize: 13 }}>{loading ? '…' : L.empty1}</div>
            ) : (
              <>
                {/* hero */}
                <div style={{ position: 'relative', overflow: 'hidden', display: 'flex', gap: 18, alignItems: 'center', padding: '22px 20px 20px', flexShrink: 0, color: '#fff', background: 'radial-gradient(460px 200px at 15% -20%,' + ac + '59,transparent 65%),radial-gradient(420px 220px at 100% 120%,' + ac + '33,transparent 70%),linear-gradient(120deg,rgba(13,28,50,.97),rgba(10,22,42,.93))' }}>
                  <div style={{ position: 'absolute', right: -14, top: -44, fontSize: 140, fontWeight: 700, color: 'rgba(255,255,255,.045)', pointerEvents: 'none', fontFamily: MONO, lineHeight: 1 }}>Rx</div>
                  <div style={{ position: 'relative', width: 'clamp(88px,9vw,132px)', aspectRatio: '1', background: 'rgba(255,255,255,.97)', borderRadius: 16, display: 'grid', placeItems: 'center', flexShrink: 0, boxShadow: '0 22px 48px ' + ac + '66,0 4px 12px rgba(0,0,0,.35)', overflow: 'hidden' }}>
                    {brand.hasImage
                      ? <img src={'/api/med/image/' + brand.id} alt={brand.name} loading="lazy" style={{ width: '84%', height: '84%', objectFit: 'contain' }} onError={(e) => { e.target.style.display = 'none'; }} />
                      : <span style={{ fontFamily: MONO, fontSize: 34, fontWeight: 700, color: ac }}>Rx</span>}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.4px', color: '#fff' }}>{brand.name}</span>
                      <span style={{ fontFamily: MONO, fontSize: 13, color: '#7ac4e8', fontWeight: 600 }}>{brand.strength}</span>
                    </div>
                    <div style={{ color: '#c7d2e0', fontSize: 13.5, marginTop: 2, fontWeight: 500 }}>
                      {brand.isGeneric ? (nb(brand.brandCount || 0) + ' ' + L.brandsOf + (brand.generic ? ' · ' + brand.generic : '')) : brand.generic}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 9 }}>
                      <span title={brand.form || route} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px', color: RBRIGHT[route], background: 'rgba(255,255,255,.09)', border: '1px solid ' + RBRIGHT[route] + '55', padding: '2px 8px', borderRadius: 6, maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{brand.form || route}</span>
                      {/* Hard width cap: 2.4% of source rows carry a whole paragraph in
                          therapeutic_class, and an uncapped chip lets that one bad value
                          blow the hero apart. Data is cleaned too, but the UI must never
                          be the thing that breaks. */}
                      {brand.drugClass && <span title={brand.drugClass} style={{ fontSize: 10.5, color: '#7ac4e8', background: 'rgba(255,255,255,.08)', border: '1px solid rgba(122,196,232,.35)', borderRadius: 6, padding: '2px 8px', maxWidth: 260, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{brand.drugClass}</span>}
                      {brand.price && brand.price.unit != null && <span style={{ fontSize: 10.5, fontFamily: MONO, fontWeight: 600, color: '#fff', background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.22)', borderRadius: 6, padding: '2px 8px' }}>{nb(taka(brand.price.unit))}</span>}
                      {brand.abx && <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.4px', textTransform: 'uppercase', borderRadius: 6, padding: '2px 8px', color: '#ffd28a', background: 'rgba(224,158,30,.18)', border: '1px solid rgba(255,210,138,.4)' }}>{bn ? 'অ্যান্টিবায়োটিক' : 'Antibiotic'}</span>}
                    </div>
                    {!brand.isGeneric && <div style={{ fontSize: 11, color: '#93a5bb', marginTop: 8 }}>{L.mfr} — <b style={{ color: '#fff' }}>{brand.manufacturer || '—'}</b></div>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7, flexShrink: 0, alignSelf: 'flex-start' }}>
                    <button onClick={() => toggleFav({ id: brand.id, name: brand.name, strength: brand.strength, form: brand.form, generic: brand.generic, price: brand.price, hasImage: brand.hasImage, drugClass: brand.drugClass })} title="Favorite"
                      style={{ width: 34, height: 34, borderRadius: 9, border: '1px solid ' + (isFav(brand.id) ? 'rgba(224,158,30,.6)' : 'rgba(255,255,255,.22)'), background: isFav(brand.id) ? 'rgba(224,158,30,.25)' : 'rgba(255,255,255,.1)', display: 'grid', placeItems: 'center', color: isFav(brand.id) ? '#ffd28a' : 'rgba(255,255,255,.6)', cursor: 'pointer', fontSize: 16 }}>★</button>
                    <button onClick={copySummary} title={L.copyT}
                      style={{ width: 34, height: 34, borderRadius: 9, border: '1px solid ' + (copied ? 'rgba(127,214,203,.6)' : 'rgba(255,255,255,.22)'), background: copied ? 'rgba(58,181,167,.3)' : 'rgba(255,255,255,.1)', display: 'grid', placeItems: 'center', color: copied ? '#7fd6cb' : 'rgba(255,255,255,.65)', cursor: 'pointer', transition: 'all .15s' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 9h11v11H9zM5 15H4V4h11v1" /></svg></button>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, marginTop: 4 }}>
                      <div style={{ width: 64, height: 22, opacity: .75, background: 'repeating-linear-gradient(90deg,#fff 0 1.5px,transparent 1.5px 3px,#fff 3px 5.5px,transparent 5.5px 7px,#fff 7px 8px,transparent 8px 10.5px)' }} />
                      <span style={{ fontFamily: MONO, fontSize: 7.5, letterSpacing: '.8px', color: 'rgba(255,255,255,.55)' }}>{('UNC-' + brand.id).toUpperCase().slice(0, 18)}</span>
                    </div>
                  </div>
                </div>
                {/* body */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px 22px', minHeight: 0 }}>
                  {/* CLINICAL GUIDANCE — the two AI-written guidance blocks, parsed into
                      labelled sections + sentence bullets so they can be skimmed. */}
                  {tab === 'overview' && (nursing || prescriberG) && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.8px', textTransform: 'uppercase', color: '#55677d', marginBottom: 7 }}>{L.clinicalGuidance}</div>
                      {lowConf && (
                        <div style={{ fontSize: 11, lineHeight: 1.5, color: '#8a5a10', background: 'rgba(224,158,30,.12)', border: '1px solid rgba(224,158,30,.4)', borderRadius: 10, padding: '8px 11px', marginBottom: 9 }}>⚠️ {L.lowConf}</div>
                      )}
                      {nursing && (
                        <div style={{ background: 'linear-gradient(90deg,rgba(58,181,167,.12),rgba(0,144,202,.06))', border: '1px solid rgba(58,181,167,.35)', borderLeft: '3px solid #1c7d70', borderRadius: 12, padding: '11px 14px', marginBottom: 9 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 13 }}>👩‍⚕️</span>
                            <span style={{ fontSize: 12.5, fontWeight: 700, color: '#123f38' }}>{L.nursing}</span>
                            <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '.4px', textTransform: 'uppercase', color: '#8a5a10', background: 'rgba(224,158,30,.16)', border: '1px solid rgba(224,158,30,.4)', borderRadius: 5, padding: '2px 6px' }}>{L.aiWritten}</span>
                          </div>
                          <Bulleted text={nursing} tone="#1c7d70" />
                        </div>
                      )}
                      {prescriberG && (
                        <div style={{ background: 'rgba(255,255,255,.66)', border: '1px solid rgba(255,255,255,.95)', borderLeft: '3px solid #0072a3', borderRadius: 12, padding: '11px 14px', boxShadow: '0 4px 14px rgba(31,59,90,.05)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 13 }}>🩺</span>
                            <span style={{ fontSize: 12.5, fontWeight: 700, color: '#16202e' }}>{L.prescriber}</span>
                            <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '.4px', textTransform: 'uppercase', color: '#8a5a10', background: 'rgba(224,158,30,.16)', border: '1px solid rgba(224,158,30,.4)', borderRadius: 5, padding: '2px 6px' }}>{L.aiWritten}</span>
                          </div>
                          <Bulleted text={prescriberG} tone="#0072a3" />
                        </div>
                      )}
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(122px,1fr))', gap: 8, marginBottom: 13 }}>
                    {[
                      { k: L.preg, v: preg ? ((bn ? 'ক্যাটাগরি ' : 'Category ') + preg) : '—', c: PREGC[preg] },
                      { k: L.formT, v: (brand.form || '—') + (brand.strength ? ' · ' + brand.strength : '') },
                      { k: L.priceT, v: brand.price && brand.price.unit != null ? nb(taka(brand.price.unit)) + (brand.priceMax && brand.priceMax !== brand.price.unit ? ' – ' + nb(taka(brand.priceMax)) : '') : '—' },
                      { k: L.confT, v: brand.confidence ? brand.confidence : '—', c: brand.confidence === 'low' ? PREGC.C : null },
                    ].map((t, i) => (
                      <div key={i} style={{ background: t.c ? t.c[1] : 'rgba(255,255,255,.66)', border: '1px solid ' + (t.c ? t.c[2] : 'rgba(255,255,255,.95)'), borderRadius: 10, padding: '8px 10px', color: t.c ? t.c[0] : '#2b3a4d' }}>
                        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', opacity: .75, marginBottom: 2 }}>{t.k}</div>
                        <div style={{ fontSize: 11.5, fontWeight: 600, lineHeight: 1.35 }}>{t.v}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 4, background: 'rgba(31,59,90,.06)', borderRadius: 11, padding: 4, marginBottom: 13 }}>
                    {['overview', 'dosage', 'safety', 'alts', 'more'].map((k) => (
                      <div key={k} onClick={() => setTab(k)}
                        style={{ flex: 1, textAlign: 'center', fontSize: 11.5, fontWeight: tab === k ? 700 : 500, padding: '7px 6px', borderRadius: 8, cursor: 'pointer', transition: 'all .15s', whiteSpace: 'nowrap', ...(tab === k ? { background: 'linear-gradient(90deg,#0090ca,#3ab5a7)', color: '#fff', boxShadow: '0 6px 16px rgba(0,144,202,.35)' } : { color: '#55677d' }) }}>{L.tabs[k]}</div>
                    ))}
                  </div>
                  {/* Curated interaction warnings (dataset's structured table) + food
                      warnings — shown at the top of Safety, above the prose sections. */}
                  {tab === 'safety' && (sel.interactions || []).length > 0 && (
                    <div style={{ marginBottom: 11, background: 'rgba(255,255,255,.66)', border: '1px solid rgba(210,58,82,.25)', borderRadius: 12, padding: '11px 14px', boxShadow: '0 4px 14px rgba(31,59,90,.05)' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: '#8c2237', marginBottom: 7 }}>{bn ? 'নথিভুক্ত মিথস্ক্রিয়া' : 'Documented interactions'} · {nb((sel.interactions || []).length)}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                        {(sel.interactions || []).map((w, i) => {
                          const major = w.severity === 'major';
                          const c = major ? ['#8c2237', 'rgba(210,58,82,.13)', 'rgba(210,58,82,.4)'] : ['#8a5a10', 'rgba(224,158,30,.16)', 'rgba(224,158,30,.45)'];
                          return (
                            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                              <span style={{ flexShrink: 0, fontSize: 9, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: c[0], background: c[1], border: '1px solid ' + c[2], borderRadius: 6, padding: '2px 7px', marginTop: 1 }}>{major ? (bn ? 'গুরুতর' : 'Major') : (bn ? 'মাঝারি' : 'Moderate')}</span>
                              <div style={{ fontSize: 11.5, lineHeight: 1.5, color: '#2b3a4d', minWidth: 0 }}>
                                <b>{w.with}</b> — {w.reason}
                                {w.advice && <div style={{ color: '#55677d', marginTop: 1 }}><b style={{ color: c[0] }}>{bn ? 'করণীয়: ' : 'Advice: '}</b>{w.advice}</div>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {tab === 'safety' && (sel.foodWarnings || []).length > 0 && (
                    <div style={{ marginBottom: 11, background: 'linear-gradient(90deg,rgba(224,158,30,.1),rgba(224,99,30,.06))', border: '1px solid rgba(224,158,30,.35)', borderRadius: 12, padding: '11px 14px' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: '#8a5a10', marginBottom: 5 }}>{bn ? 'খাবার ও পানীয় সতর্কতা' : 'Food & drink warnings'}</div>
                      {(sel.foodWarnings || []).map((w, i) => (
                        <div key={i} style={{ fontSize: 11.5, lineHeight: 1.55, color: '#5a3d10', marginBottom: 3 }}>• {w.warning}</div>
                      ))}
                    </div>
                  )}
                  {sections.map((s2) => (
                    <div key={s2.key} style={{ marginBottom: 11, background: 'rgba(255,255,255,.66)', border: '1px solid rgba(255,255,255,.95)', borderRadius: 12, padding: '11px 14px', boxShadow: '0 4px 14px rgba(31,59,90,.05)' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: '#0072a3', marginBottom: 6 }}>{s2.t}</div>
                      <Bulleted text={s2.body} />
                    </div>
                  ))}
                  {TABSEC[tab] && !sections.length && <div style={{ textAlign: 'center', color: '#9aa6b4', fontSize: 12, padding: '20px 0 8px' }}>—</div>}
                  {/* ALTERNATIVES — a full tab of its own: every brand of the same
                      generic, cheapest first, click to open it right here. */}
                  {tab === 'alts' && (
                    (sel.alternatives || []).length ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: '#6c7a8c' }}>{L.similar} · {nb((sel.alternatives || []).length)}</div>
                        {(sel.alternatives || []).map((a) => (
                          <div key={a.id} onClick={() => openBrand(a.id)}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,.66)', border: '1px solid rgba(255,255,255,.95)', borderRadius: 12, padding: '8px 11px', cursor: 'pointer', boxShadow: '0 4px 14px rgba(31,59,90,.05)' }}>
                            <div style={{ width: 40, height: 40, background: '#fff', borderRadius: 9, flexShrink: 0, display: 'grid', placeItems: 'center', border: '1px solid rgba(31,59,90,.07)', overflow: 'hidden' }}><Thumb row={a} size={32} /></div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                                <span style={{ fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</span>
                                <span style={{ fontFamily: MONO, fontSize: 10, color: '#0072a3', fontWeight: 600, whiteSpace: 'nowrap' }}>{a.strength}</span>
                              </div>
                              <div style={{ fontSize: 10.5, color: '#55677d', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.form}{a.manufacturer ? ' · ' + a.manufacturer : ''}</div>
                            </div>
                            {a.price && a.price.unit != null && <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: '#157a43', whiteSpace: 'nowrap' }}>{nb(taka(a.price.unit))}</span>}
                          </div>
                        ))}
                        <div style={{ fontSize: 10, color: '#9aa6b4' }}>{bn ? 'সস্তা আগে সাজানো — একই জেনেরিক বহনকারী ব্র্যান্ড।' : 'Cheapest first — brands carrying the same generic.'}</div>
                      </div>
                    ) : <div style={{ textAlign: 'center', color: '#9aa6b4', fontSize: 12, padding: '20px 0 8px' }}>{bn ? 'এই জেনেরিকের অন্য কোনো ব্র্যান্ড নেই।' : 'No other brand carries this generic.'}</div>
                  )}
                  {tab === 'more' && <div style={{ fontSize: 10, color: '#9aa6b4', lineHeight: 1.5, marginTop: 4 }}>{L.disclaimer}</div>}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  window.MedicineInfoV2 = MedicineInfoV2;
})();
