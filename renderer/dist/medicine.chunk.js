/* ===== medicine-info.jsx ===== */
(function(){
(function () {
  const {
    useState,
    useEffect,
    useMemo,
    useRef
  } = React;
  const api = u => fetch(u, {
    headers: {
      accept: 'application/json'
    },
    credentials: 'same-origin'
  }).then(r => r.json());
  const post = (u, b) => fetch(u, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    credentials: 'same-origin',
    body: JSON.stringify(b || {})
  }).then(r => r.json());
  const MONO = "'IBM Plex Mono','Noto Sans Bengali',monospace";
  const qs = o => Object.keys(o).filter(k => o[k] !== '' && o[k] != null).map(k => k + '=' + encodeURIComponent(o[k])).join('&');
  const FAV_KEY = 'unico-medinfo-favs-v1';
  const plain = v => String(v || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const SECTION_LABELS = ['Assessment before administration', 'Assessment', 'Administration', 'Monitoring and duration', 'Monitoring', 'Patient\\/caregiver education', 'Patient education', 'Education', 'Patient selection', 'Selection', 'Dose adjustment', 'Dosing', 'Dose', 'Interactions', 'Red flags', 'Stop\\/switch', 'Duration', 'Contraindications', 'Precautions', 'Storage', 'Cautions', 'Review'];
  const SECTION_RE = () => new RegExp('(?:^|\\s)(' + SECTION_LABELS.join('|') + ')\\s*:\\s*', 'gi');
  const splitSentences = text => String(text || '').split(/(?<=[.;])\s+(?=[A-Z0-9“"(])/).map(x => x.trim().replace(/^[-–•]\s*/, '')).filter(x => x.length > 2);
  function parseGuidance(raw) {
    const t = plain(raw);
    if (!t) return [];
    const re = SECTION_RE();
    const marks = [];
    let m;
    while ((m = re.exec(t)) !== null) marks.push({
      label: m[1],
      start: m.index,
      from: m.index + m[0].length
    });
    if (marks.length >= 2) {
      const out = [];
      marks.forEach((mk, i) => {
        const body = t.slice(mk.from, i + 1 < marks.length ? marks[i + 1].start : t.length).trim();
        if (body) out.push({
          label: mk.label,
          items: splitSentences(body)
        });
      });
      if (out.length) return out;
    }
    const items = splitSentences(t);
    return [{
      label: null,
      items: items.length > 1 ? items : [t]
    }];
  }
  const Bulleted = ({
    text,
    tone
  }) => {
    const blocks = parseGuidance(text);
    if (!blocks.length) return null;
    const c = tone || '#0072a3';
    return React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 9
      }
    }, blocks.map((b, i) => React.createElement("div", {
      key: i
    }, b.label && React.createElement("div", {
      style: {
        fontSize: 9.5,
        fontWeight: 800,
        letterSpacing: '.7px',
        textTransform: 'uppercase',
        color: c,
        marginBottom: 3
      }
    }, b.label), b.items.length > 1 || b.label ? React.createElement("ul", {
      style: {
        margin: 0,
        paddingLeft: 17,
        display: 'flex',
        flexDirection: 'column',
        gap: 4
      }
    }, b.items.map((s2, j) => React.createElement("li", {
      key: j,
      style: {
        fontSize: 12,
        color: '#2b3a4d',
        lineHeight: 1.55
      }
    }, s2))) : React.createElement("div", {
      style: {
        fontSize: 12,
        color: '#2b3a4d',
        lineHeight: 1.6
      }
    }, b.items[0]))));
  };
  const PAL = ['#0090ca', '#d23a52', '#1c9c8d', '#e0631e', '#6a52d4', '#0b66d0', '#8a5a10', '#0072a3'];
  const CATICONS = ['M4 6h16M4 12h16M4 18h16', 'M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z', 'M12 21s-8-5-10-10a5 5 0 019-3 5 5 0 019 3c-2 5-10 10-10 10z', 'M12 3s6 7 6 11a6 6 0 01-12 0c0-4 6-11 6-11z', 'M5 12.5l7.5-7.5a4.6 4.6 0 016.5 6.5L11.5 19A4.6 4.6 0 015 12.5zM8.7 8.7l6.6 6.6', 'M12 4v7M9 21c-3 0-4-2-4-5 0-4 2-7 4-7v12zM15 21c3 0 4-2 4-5 0-4-2-7-4-7v12z', 'M12 3s6 7 6 11a6 6 0 01-12 0c0-4 6-11 6-11zM12 14v3', 'M12 2l8 5v10l-8 5-8-5V7z'];
  const ROUTE_PILLS = [['', 'All forms', 'M4 6h16M4 12h16M4 18h16'], ['Tablet', 'Tablet', 'M12 3a9 9 0 100 18 9 9 0 000-18zM5.6 5.6l12.8 12.8'], ['Capsule', 'Capsule', 'M5 12.5l7.5-7.5a4.6 4.6 0 016.5 6.5L11.5 19A4.6 4.6 0 015 12.5zM8.7 8.7l6.6 6.6'], ['Injection', 'Injection', 'M14 4l6 6M15.5 5.5l3-3M12 6l6 6-7 7H6v-5zM6 14l-3 3'], ['Syrup', 'Syrup', 'M9 2h6M10 2v4l-4 5v9a2 2 0 002 2h8a2 2 0 002-2v-9l-4-5V2']];
  const routeOf = form => {
    const f = String(form || '').toLowerCase();
    return /injection|infusion|iv|im\b/.test(f) ? 'Injection' : /capsule/.test(f) ? 'Capsule' : /syrup|suspension|solution|drops/.test(f) ? 'Syrup' : 'Tablet';
  };
  const RCOL = {
    Tablet: '#0072a3',
    Capsule: '#6a52d4',
    Injection: '#b3541e',
    Syrup: '#1c9c8d'
  };
  const RBRIGHT = {
    Tablet: '#7ac4e8',
    Capsule: '#b3a1ff',
    Injection: '#ffb26b',
    Syrup: '#7fd6cb'
  };
  const classColor = cls => {
    let h = 0;
    const s2 = String(cls || '');
    for (let i = 0; i < s2.length; i++) h = h * 31 + s2.charCodeAt(i) >>> 0;
    return PAL[h % PAL.length];
  };
  const taka = v => v == null ? '' : '৳ ' + Math.round(v * 100) / 100;
  const bnNum = t => String(t).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[d]);
  const TABSEC = {
    overview: [['indication', 'Indications', 'নির্দেশনা', 'indications'], ['therapeuticClass', 'Therapeutic class', 'থেরাপিউটিক শ্রেণি', null], ['pharmacology', 'Pharmacology', 'ফার্মাকোলজি', 'pharmacology'], ['mechanism', 'Mechanism of action', 'কার্যপ্রণালি', null]],
    dosage: [['dosage', 'Dosage & administration', 'মাত্রা ও সেবনবিধি', 'dosage_text'], ['adultDose', 'Adult dose', 'প্রাপ্তবয়স্ক মাত্রা', null], ['childDose', 'Child dose', 'শিশুদের মাত্রা', null], ['renalDose', 'Renal dose', 'রেনাল মাত্রা', null], ['administration', 'Administration', 'প্রয়োগবিধি', null]],
    safety: [['sideEffects', 'Side effects', 'পার্শ্বপ্রতিক্রিয়া', 'side_effects'], ['contraindications', 'Contraindications', 'প্রতিনির্দেশনা', 'contraindications'], ['interaction', 'Drug interactions', 'ওষুধের মিথস্ক্রিয়া', null], ['pregnancy', 'Pregnancy & lactation', 'গর্ভাবস্থা ও স্তন্যদান', null], ['precautions', 'Precautions', 'সতর্কতা', 'precautions'], ['overdose', 'Overdose', 'অতিরিক্ত মাত্রা', null]],
    more: [['storage', 'Storage', 'সংরক্ষণ', 'storage_conditions'], ['packaging', 'Packaging', 'প্যাকেজিং', null], ['description', 'Description', 'বিবরণ', null]]
  };
  const PREGC = {
    A: ['#1c7d70', 'rgba(58,181,167,.14)', 'rgba(58,181,167,.4)'],
    B: ['#1c7d70', 'rgba(58,181,167,.14)', 'rgba(58,181,167,.4)'],
    C: ['#8a5a10', 'rgba(224,158,30,.16)', 'rgba(224,158,30,.45)'],
    D: ['#8c2237', 'rgba(210,58,82,.13)', 'rgba(210,58,82,.4)'],
    X: ['#8c2237', 'rgba(210,58,82,.13)', 'rgba(210,58,82,.4)']
  };
  const loadFavs = () => {
    try {
      const f = JSON.parse(localStorage.getItem(FAV_KEY) || '[]');
      return Array.isArray(f) ? f : [];
    } catch (e) {
      return [];
    }
  };
  const Thumb = ({
    row,
    size,
    radius
  }) => row.hasImage ? React.createElement("img", {
    src: '/api/med/image/' + row.id,
    alt: "",
    loading: "lazy",
    decoding: "async",
    onError: e => {
      e.target.style.display = 'none';
    },
    style: {
      width: size,
      height: size,
      objectFit: 'contain',
      borderRadius: radius || 8
    }
  }) : React.createElement("svg", {
    width: Math.round(size * .58),
    height: Math.round(size * .58),
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: RCOL[routeOf(row.form)],
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, React.createElement("path", {
    d: ROUTE_PILLS.find(r => r[0] === routeOf(row.form) || r[0] === 'Tablet' && routeOf(row.form) === 'Tablet')[2]
  }));
  function MedicineInfoV2({
    setRoute
  }) {
    const [q, setQ] = useState('');
    const [searchMode, setSearchMode] = useState('all');
    const [cat, setCat] = useState('');
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
    const [sel, setSel] = useState(null);
    const [tab, setTab] = useState('overview');
    const [checkMode, setCheckMode] = useState(false);
    const [picks, setPicks] = useState([]);
    const [checkRes, setCheckRes] = useState(null);
    const [copied, setCopied] = useState(false);
    const seq = useRef(0);
    const paneRef = useRef(null);
    const [paneH, setPaneH] = useState(560);
    useEffect(() => {
      const fit = () => {
        const el = paneRef.current;
        if (!el) return;
        setPaneH(Math.max(420, window.innerHeight - el.getBoundingClientRect().top - 16));
      };
      fit();
      const t = setTimeout(fit, 250);
      window.addEventListener('resize', fit);
      return () => {
        clearTimeout(t);
        window.removeEventListener('resize', fit);
      };
    }, []);
    const bn = lang === 'bn';
    const nb = t => bn ? bnNum(String(t)) : String(t);
    useEffect(() => {
      api('/api/med/status').then(setStatus).catch(() => {});
      api('/api/med/refs?kind=class').then(r => {
        if (r.ok) setClasses(r.refs || []);
      }).catch(() => {});
    }, []);
    const respCache = useRef(new Map());
    useEffect(() => {
      const drop = () => {
        if (document.visibilityState !== 'hidden') respCache.current.clear();
      };
      window.addEventListener('focus', drop);
      document.addEventListener('visibilitychange', drop);
      return () => {
        window.removeEventListener('focus', drop);
        document.removeEventListener('visibilitychange', drop);
      };
    }, []);
    const cachedGet = url => {
      const c = respCache.current;
      if (c.has(url)) return {
        hit: true,
        data: c.get(url)
      };
      return {
        hit: false,
        p: api(url).then(r => {
          if (r && r.ok) {
            c.set(url, r);
            if (c.size > 250) c.delete(c.keys().next().value);
          }
          return r;
        })
      };
    };
    useEffect(() => {
      const mine = ++seq.current;
      const term = q.trim();
      const wantGenerics = searchMode === 'generic';
      const url = term ? '/api/med/search?' + qs({
        q: term,
        kind: wantGenerics ? 'generic' : 'brand',
        field: searchMode === 'brand' ? 'name' : '',
        limit: 40,
        form: wantGenerics ? '' : form
      }) : '/api/med/browse?' + qs({
        per: 40,
        page,
        class: cat,
        form: wantGenerics ? '' : form,
        kind: wantGenerics ? 'generic' : ''
      });
      const take = r => {
        if (mine !== seq.current || !r || !r.ok) return;
        const list = term ? wantGenerics ? r.generics || [] : r.brands || [] : r.rows || [];
        setRows(old => !term && page > 1 ? old.concat(list) : list);
        setTotal(term ? list.length : r.total || list.length);
        setLoading(false);
        if (list.length && (!sel || term)) (wantGenerics ? openGeneric : openBrand)(list[0].id, true);
      };
      const got = cachedGet(url);
      if (got.hit) {
        take(got.data);
        return;
      }
      setLoading(true);
      const t = setTimeout(() => {
        const g = cachedGet(url);
        (g.hit ? Promise.resolve(g.data) : g.p).then(take).catch(() => {
          if (mine === seq.current) setLoading(false);
        });
      }, term ? 90 : 0);
      return () => clearTimeout(t);
    }, [q, cat, form, page, searchMode]);
    useEffect(() => {
      setPage(1);
    }, [q, cat, form, searchMode]);
    const openBrand = (id, quiet) => {
      const got = cachedGet('/api/med/brand/' + encodeURIComponent(id));
      const use = r => {
        if (r && r.ok) {
          setSel(r);
          if (!quiet) setTab('overview');
        }
      };
      if (got.hit) use(got.data);else got.p.then(use).catch(() => {});
    };
    const openGeneric = (id, quiet) => {
      const got = cachedGet('/api/med/generic/' + encodeURIComponent(id));
      const use = r => {
        if (r && r.ok) {
          setSel({
            ok: true,
            brand: null,
            generic: r.generic,
            alternatives: r.brands || [],
            interactions: r.interactions || [],
            foodWarnings: r.foodWarnings || []
          });
          if (!quiet) setTab('overview');
        }
      };
      if (got.hit) use(got.data);else got.p.then(use).catch(() => {});
    };
    const toggleFav = row => {
      setFavs(f => {
        const has = f.some(x => x.id === row.id);
        const next = has ? f.filter(x => x.id !== row.id) : f.concat([{
          id: row.id,
          name: row.name,
          strength: row.strength,
          form: row.form,
          generic: row.generic,
          price: row.price,
          hasImage: row.hasImage,
          drugClass: row.drugClass,
          genericId: row.genericId || (searchMode === 'generic' ? row.id : undefined)
        }]);
        try {
          localStorage.setItem(FAV_KEY, JSON.stringify(next));
        } catch (e) {}
        return next;
      });
    };
    const isFav = id => favs.some(x => x.id === id);
    const clickRow = row => {
      if (!checkMode) return searchMode === 'generic' ? openGeneric(row.id) : openBrand(row.id);
      setPicks(p => {
        const has = p.some(x => x.id === row.id);
        const pick = row.genericId || searchMode !== 'generic' ? row : Object.assign({}, row, {
          genericId: row.id
        });
        const next = has ? p.filter(x => x.id !== row.id) : p.length < 2 ? p.concat([pick]) : [p[1], pick];
        return next;
      });
    };
    useEffect(() => {
      if (picks.length !== 2) {
        setCheckRes(null);
        return;
      }
      const gids = picks.map(p => p.genericId).filter(Boolean);
      if (gids.length < 2) {
        setCheckRes({
          unchecked: true
        });
        return;
      }
      post('/api/med/check', {
        genericIds: gids
      }).then(r => setCheckRes(r.ok ? r.warnings || [] : {
        unchecked: true
      })).catch(() => setCheckRes({
        unchecked: true
      }));
    }, [picks]);
    const shown = useMemo(() => {
      let list = favOnly ? favs.slice() : rows;
      if (favOnly && q.trim()) {
        const ql = q.trim().toLowerCase();
        list = list.filter(r => (r.name + ' ' + (r.generic || '')).toLowerCase().includes(ql));
      }
      if (sortBy === 'price') list = list.slice().sort((a, b) => ((a.price && a.price.unit) == null) - ((b.price && b.price.unit) == null) || (a.price && a.price.unit || 0) - (b.price && b.price.unit || 0));
      return list;
    }, [rows, favs, favOnly, sortBy, q]);
    const gen = sel && sel.generic;
    const brand = sel && sel.brand || (gen ? {
      id: gen.id,
      name: gen.name,
      strength: '',
      generic: (gen.forms || []).join(' · '),
      form: (gen.forms || [])[0] || '',
      manufacturer: '',
      drugClass: gen.drugClass,
      price: null,
      hasImage: false,
      abx: gen.abx,
      confidence: gen.confidence,
      pregnancyCategory: gen.pregnancyCategory,
      isGeneric: true,
      brandCount: sel && sel.alternatives ? sel.alternatives.length : gen.brands
    } : null);
    const ac = brand ? classColor(brand.drugClass) : '#0090ca';
    const mono = gen && gen.monograph || {};
    const bnSec = mono.bn || {};
    const route = brand ? routeOf(brand.form) : 'Tablet';
    const nursing = mono.nursingConsiderations ? plain(mono.nursingConsiderations) : '';
    const prescriberG = mono.prescriberConsiderations ? plain(mono.prescriberConsiderations) : '';
    const lowConf = (brand && brand.confidence) === 'low';
    const preg = gen && gen.pregnancyCategory || brand && brand.pregnancyCategory || '';
    const sections = (TABSEC[tab] || []).map(([key, en, bnl, bnKey]) => {
      const enBody = mono[key] ? plain(mono[key]) : '';
      const bnBody = bnKey && bnSec[bnKey] ? plain(bnSec[bnKey]) : '';
      const body = bn ? bnBody || enBody : enBody;
      return body ? {
        key,
        t: bn ? bnl : en,
        body
      } : null;
    }).filter(Boolean);
    const L = bn ? {
      title: 'ঔষধের তথ্যভাণ্ডার',
      search: searchMode === 'brand' ? 'ব্র্যান্ডের নাম খুঁজুন — Napa, Seclo…' : searchMode === 'generic' ? 'জেনেরিক নাম খুঁজুন — Paracetamol…' : 'ব্র্যান্ড, জেনেরিক বা শ্রেণি খুঁজুন…',
      mAll: 'সব',
      mBrand: 'ব্র্যান্ড',
      mGeneric: 'জেনেরিক',
      mTip_all: 'ব্র্যান্ড ও জেনেরিক — দুটোতেই খোঁজে',
      mTip_brand: 'শুধু ব্র্যান্ডের নামে খোঁজে',
      mTip_generic: 'জেনেরিক তালিকায় খোঁজে',
      brandsOf: 'ব্র্যান্ড',
      cats: 'শ্রেণিসমূহ',
      forms: 'ডোজ ফর্ম',
      all: 'সব',
      favs: 'প্রিয়',
      sortName: 'নাম (A–Z)',
      sortPrice: 'দাম',
      check: 'ইন্টারঅ্যাকশন যাচাই',
      checkHint: 'তালিকা থেকে দুটি ওষুধে ক্লিক করে পরস্পরের সাথে যাচাই করুন।',
      clear: 'মুছুন',
      picked: 'নির্বাচিত',
      mfr: 'প্রস্তুতকারক',
      nursing: 'নার্সিং নির্দেশনা',
      prescriber: 'প্রেসক্রাইবার নির্দেশনা',
      clinicalGuidance: 'ক্লিনিক্যাল নির্দেশনা',
      aiWritten: 'AI-লিখিত',
      lowConf: 'এই ওষুধটি ফার্মাকোলজি সাহিত্যে ভালোভাবে নথিভুক্ত নয় — নিচের নির্দেশনা শুধু ইঙ্গিত হিসেবে নিন, চূড়ান্ত নয়।',
      tabs: {
        overview: 'ওভারভিউ',
        dosage: 'মাত্রা',
        safety: 'নিরাপত্তা',
        alts: 'বিকল্প',
        more: 'আরও'
      },
      statMeds: 'ওষুধ',
      statGen: 'জেনেরিক',
      statCls: 'শ্রেণি',
      empty1: 'কোনো ওষুধ পাওয়া যায়নি',
      empty2: 'অন্য ব্র্যান্ড বা জেনেরিক নাম লিখুন, অথবা ফিল্টার মুছে দিন।',
      similar: 'একই জেনেরিকের অন্য ব্র্যান্ড',
      disclaimer: 'নার্সিং স্টাফদের জন্য রেফারেন্স তথ্য। ওষুধ প্রয়োগের আগে সবসময় চলতি প্রেসক্রিপশন ও হাসপাতাল ফর্মুলারির সাথে মিলিয়ে নিন।',
      preg: 'গর্ভাবস্থা',
      formT: 'ডোজ ফর্ম',
      priceT: 'দাম',
      confT: 'তথ্যের মান',
      loadMore: 'আরও দেখুন',
      copyT: 'সারসংক্ষেপ কপি',
      noPair: 'ফর্মুলারি ডেটায় বড় কোনো মিথস্ক্রিয়া নেই। তবু সম্পূর্ণ প্রেসক্রিপশনের সাথে মিলিয়ে নিন।'
    } : {
      title: 'Medicine Information',
      search: searchMode === 'brand' ? 'Search a brand name — Napa, Seclo…' : searchMode === 'generic' ? 'Search a generic name — Paracetamol…' : 'Search brand, generic or class…',
      mAll: 'All',
      mBrand: 'Brand',
      mGeneric: 'Generic',
      mTip_all: 'Match either a brand name or its generic',
      mTip_brand: 'Match the brand name only',
      mTip_generic: 'Search the generic index',
      brandsOf: 'brands',
      cats: 'Categories',
      forms: 'Dosage form',
      all: 'All',
      favs: 'Favorites',
      sortName: 'A–Z',
      sortPrice: 'Price',
      check: 'Interaction check',
      checkHint: 'Tap two medicines in the list to check them against each other.',
      clear: 'Clear',
      picked: 'SELECTED',
      mfr: 'Manufacturer',
      nursing: 'Nursing considerations',
      prescriber: 'Prescriber considerations',
      clinicalGuidance: 'Clinical guidance',
      aiWritten: 'AI-written',
      lowConf: 'Low confidence — this preparation is not well documented in pharmacological literature. Treat the guidance below as indicative only, not authoritative.',
      tabs: {
        overview: 'Overview',
        dosage: 'Dosage',
        safety: 'Safety',
        alts: 'Alternatives',
        more: 'More'
      },
      statMeds: 'medicines',
      statGen: 'generics',
      statCls: 'classes',
      empty1: 'No medicines match your search',
      empty2: 'Try a different brand, generic name or clear the filters.',
      similar: 'Other brands of this generic',
      disclaimer: 'Reference information for nursing staff. Always confirm against the current prescription and hospital formulary before administration.',
      preg: 'Pregnancy',
      formT: 'Dosage form',
      priceT: 'Price',
      confT: 'Data confidence',
      loadMore: 'Load more',
      copyT: 'Copy summary',
      noPair: 'No major interaction recorded in the formulary data. Always verify against the full prescription.'
    };
    const cats = useMemo(() => {
      const top = classes.slice(0, 8);
      return [{
        name: '',
        label: L.all,
        count: status ? status.brands : 0,
        c: '#0072a3',
        icon: CATICONS[0]
      }].concat(top.map((r, i) => ({
        name: r.name,
        label: r.name,
        count: r.count,
        c: PAL[(i + 1) % PAL.length],
        icon: CATICONS[(i + 1) % CATICONS.length]
      })));
    }, [classes, status, lang]);
    const sevMeta = w => w.severity === 'critical' || w.severity === 'high' ? [bn ? 'গুরুতর' : 'Major', '#8c2237', 'rgba(210,58,82,.14)', 'rgba(210,58,82,.4)'] : [bn ? 'মাঝারি' : 'Moderate', '#8a5a10', 'rgba(224,158,30,.16)', 'rgba(224,158,30,.45)'];
    const copySummary = () => {
      if (!brand) return;
      const t = brand.name + ' (' + (brand.generic || '') + ') ' + (brand.strength || '') + (mono.dosage ? ' — ' + plain(mono.dosage).slice(0, 300) : '');
      try {
        navigator.clipboard.writeText(t);
      } catch (e) {}
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    };
    const glass = {
      background: 'rgba(255,255,255,.62)',
      border: '1px solid rgba(255,255,255,.92)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      boxShadow: '0 8px 20px rgba(31,59,90,.08)'
    };
    const secLbl = {
      fontSize: 9.5,
      fontWeight: 700,
      letterSpacing: '.9px',
      textTransform: 'uppercase',
      color: '#7d8ea8',
      padding: '2px 6px 5px'
    };
    const langBtn = on => ({
      fontSize: 11,
      fontWeight: 700,
      padding: '4px 11px',
      borderRadius: 16,
      cursor: 'pointer',
      transition: 'all .15s',
      ...(on ? {
        background: 'linear-gradient(90deg,#0090ca,#3ab5a7)',
        color: '#fff',
        boxShadow: '0 3px 10px rgba(0,144,202,.35)'
      } : {
        color: '#55677d'
      })
    });
    return React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        minHeight: 0,
        fontFamily: "'IBM Plex Sans','Noto Sans Bengali',system-ui,sans-serif"
      }
    }, React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        flexWrap: 'wrap'
      }
    }, React.createElement("div", {
      style: {
        minWidth: 0
      }
    }, React.createElement("div", {
      style: {
        fontSize: 20,
        fontWeight: 700,
        letterSpacing: '-.3px',
        whiteSpace: 'nowrap'
      }
    }, L.title), React.createElement("div", {
      style: {
        color: '#6c7a8c',
        fontSize: 11.5,
        marginTop: 1,
        whiteSpace: 'nowrap'
      }
    }, status ? nb(status.brands.toLocaleString()) + ' ' + L.statMeds + ' · ' + nb(status.generics.toLocaleString()) + ' ' + L.statGen : '…')), React.createElement("div", {
      style: {
        ...glass,
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        borderRadius: 12,
        padding: '10px 14px',
        flex: '1 1 260px',
        maxWidth: 520
      }
    }, React.createElement("svg", {
      width: "17",
      height: "17",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "#7d8ea8",
      strokeWidth: "1.9",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      style: {
        flexShrink: 0
      }
    }, React.createElement("path", {
      d: "M11 4a7 7 0 105 12l4 4M11 4a7 7 0 015 12"
    })), React.createElement("input", {
      value: q,
      onChange: e => setQ(e.target.value),
      placeholder: L.search,
      style: {
        flex: 1,
        border: 'none',
        outline: 'none',
        background: 'transparent',
        fontFamily: 'inherit',
        fontSize: 13.5,
        color: '#16202e',
        minWidth: 0
      }
    }), !!q.trim() && React.createElement("span", {
      onClick: () => setQ(''),
      style: {
        cursor: 'pointer',
        color: '#9aa6b4',
        display: 'grid',
        placeItems: 'center'
      }
    }, React.createElement("svg", {
      width: "14",
      height: "14",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round"
    }, React.createElement("path", {
      d: "M6 6l12 12M18 6L6 18"
    }))), React.createElement("div", {
      style: {
        display: 'inline-flex',
        gap: 2,
        background: 'rgba(31,59,90,.06)',
        borderRadius: 9,
        padding: 2,
        flexShrink: 0
      }
    }, [['all', L.mAll], ['brand', L.mBrand], ['generic', L.mGeneric]].map(([k, lab]) => React.createElement("span", {
      key: k,
      onClick: () => setSearchMode(k),
      title: L['mTip_' + k],
      style: {
        fontSize: 10.5,
        fontWeight: searchMode === k ? 700 : 500,
        padding: '4px 9px',
        borderRadius: 7,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: 'all .15s',
        ...(searchMode === k ? {
          background: '#fff',
          color: '#0072a3',
          boxShadow: '0 2px 6px rgba(31,59,90,.12)'
        } : {
          color: '#7d8ea8'
        })
      }
    }, lab)))), React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        flexWrap: 'wrap'
      }
    }, [[status ? status.brands.toLocaleString() : '—', L.statMeds, '#0072a3'], [status ? status.generics.toLocaleString() : '—', L.statGen, '#1c7d70'], [classes.length ? classes.length.toLocaleString() : '—', L.statCls, '#6a52d4']].map(([n, lab, c], i) => React.createElement("div", {
      key: i,
      style: {
        ...glass,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '6px 14px',
        borderRadius: 11,
        color: c
      }
    }, React.createElement("b", {
      style: {
        fontFamily: MONO,
        fontSize: 15.5
      }
    }, nb(n)), React.createElement("span", {
      style: {
        fontSize: 10,
        opacity: .8
      }
    }, lab))), React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        background: 'rgba(255,255,255,.55)',
        border: '1px solid rgba(255,255,255,.85)',
        borderRadius: 20,
        padding: 3,
        gap: 2
      }
    }, React.createElement("span", {
      onClick: () => setLang('en'),
      style: langBtn(!bn)
    }, "EN"), React.createElement("span", {
      onClick: () => setLang('bn'),
      style: langBtn(bn)
    }, "\u09AC\u09BE\u0982\u09B2\u09BE")))), React.createElement("div", {
      ref: paneRef,
      style: {
        display: 'flex',
        gap: 13,
        minHeight: 0,
        height: paneH
      }
    }, React.createElement("div", {
      style: {
        width: 'clamp(132px,13vw,192px)',
        flexShrink: 0,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        paddingRight: 2
      }
    }, React.createElement("div", {
      style: secLbl
    }, L.cats), cats.map(c => {
      const on = cat === c.name;
      return React.createElement("div", {
        key: c.name || 'all',
        onClick: () => setCat(on ? '' : c.name),
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 12,
          fontWeight: on ? 600 : 500,
          padding: '7px 9px',
          borderRadius: 10,
          cursor: 'pointer',
          transition: 'all .15s',
          ...(on ? {
            background: 'rgba(255,255,255,.75)',
            border: '1px solid ' + c.c + '55',
            boxShadow: '0 6px 16px rgba(31,59,90,.1)',
            color: '#16202e'
          } : {
            background: 'transparent',
            border: '1px solid transparent',
            color: '#55677d'
          })
        }
      }, React.createElement("span", {
        style: {
          width: 24,
          height: 24,
          borderRadius: 8,
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
          color: on ? '#fff' : c.c,
          background: on ? c.c : c.c + '1f',
          transition: 'all .15s'
        }
      }, React.createElement("svg", {
        width: "13",
        height: "13",
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: "2",
        strokeLinecap: "round",
        strokeLinejoin: "round"
      }, React.createElement("path", {
        d: c.icon
      }))), React.createElement("span", {
        style: {
          flex: 1,
          minWidth: 0,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }
      }, c.label), React.createElement("span", {
        style: {
          fontFamily: MONO,
          fontSize: 9.5,
          padding: '0 6px',
          borderRadius: 8,
          background: on ? c.c + '22' : 'rgba(31,59,90,.07)',
          color: on ? c.c : '#7d8ea8'
        }
      }, nb((c.count || 0).toLocaleString())));
    }), React.createElement("div", {
      style: {
        height: 1,
        background: 'rgba(31,59,90,.12)',
        margin: '8px 4px'
      }
    }), React.createElement("div", {
      onClick: () => setFavOnly(v => !v),
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 12,
        fontWeight: favOnly ? 600 : 500,
        padding: '7px 10px',
        borderRadius: 10,
        cursor: 'pointer',
        transition: 'all .15s',
        ...(favOnly ? {
          background: 'linear-gradient(90deg,#e09e1e,#d2691e)',
          color: '#fff',
          border: '1px solid transparent',
          boxShadow: '0 4px 12px rgba(224,158,30,.35)'
        } : {
          background: 'transparent',
          color: '#8a5a10',
          border: '1px solid rgba(224,158,30,.3)'
        })
      }
    }, "\u2605", React.createElement("span", {
      style: {
        flex: 1
      }
    }, L.favs, favs.length ? ' (' + nb(favs.length) + ')' : '')), React.createElement("div", {
      style: {
        ...secLbl,
        padding: '10px 6px 5px'
      }
    }, L.forms), ROUTE_PILLS.map(([f, lab, icon]) => {
      const on = form === f;
      return React.createElement("div", {
        key: f || 'all',
        onClick: () => setForm(f),
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 11.5,
          fontWeight: on ? 600 : 500,
          padding: '6px 10px',
          borderRadius: 9,
          cursor: 'pointer',
          transition: 'all .15s',
          ...(on ? {
            background: 'rgba(13,28,50,.9)',
            color: '#fff',
            border: '1px solid rgba(13,28,50,.9)'
          } : {
            background: 'transparent',
            color: '#55677d',
            border: '1px solid transparent'
          })
        }
      }, React.createElement("svg", {
        width: "12",
        height: "12",
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: "2",
        strokeLinecap: "round",
        strokeLinejoin: "round"
      }, React.createElement("path", {
        d: icon
      })), React.createElement("span", {
        style: {
          flex: 1
        }
      }, f ? lab : L.all));
    })), React.createElement("div", {
      style: {
        width: 'clamp(230px,25vw,328px)',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        gap: 8
      }
    }, React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
        flexShrink: 0
      }
    }, [['name', L.sortName], ['price', L.sortPrice]].map(([k, lab]) => React.createElement("div", {
      key: k,
      onClick: () => setSortBy(k),
      style: {
        fontSize: 10.5,
        fontWeight: sortBy === k ? 600 : 500,
        padding: '4px 10px',
        borderRadius: 8,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: 'all .15s',
        ...(sortBy === k ? {
          background: 'rgba(0,114,163,.14)',
          color: '#0072a3',
          border: '1px solid rgba(0,144,202,.35)'
        } : {
          background: 'rgba(255,255,255,.55)',
          color: '#7d8ea8',
          border: '1px solid rgba(255,255,255,.9)'
        })
      }
    }, lab)), React.createElement("div", {
      onClick: () => {
        setCheckMode(v => !v);
        setPicks([]);
      },
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 10.5,
        fontWeight: checkMode ? 600 : 500,
        padding: '4px 10px',
        borderRadius: 8,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: 'all .15s',
        ...(checkMode ? {
          background: 'linear-gradient(90deg,#6a52d4,#0090ca)',
          color: '#fff',
          border: '1px solid transparent',
          boxShadow: '0 4px 12px rgba(106,82,212,.35)'
        } : {
          background: 'rgba(255,255,255,.55)',
          color: '#5a44b8',
          border: '1px solid rgba(106,82,212,.3)'
        })
      }
    }, React.createElement("svg", {
      width: "12",
      height: "12",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M13 2 3 14h7l-1 8 11-13h-8l1-7"
    })), L.check), React.createElement("span", {
      style: {
        marginLeft: 'auto',
        fontSize: 11,
        color: '#7d8ea8',
        fontFamily: MONO
      }
    }, nb(favOnly ? shown.length : total.toLocaleString()))), checkMode && React.createElement("div", {
      style: {
        background: 'linear-gradient(90deg,rgba(106,82,212,.12),rgba(0,144,202,.07))',
        border: '1px solid rgba(106,82,212,.32)',
        borderRadius: 12,
        padding: '10px 12px',
        flexShrink: 0
      }
    }, React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        flexWrap: 'wrap'
      }
    }, React.createElement("b", {
      style: {
        fontSize: 11.5,
        color: '#3a2d80'
      }
    }, L.check), React.createElement("span", {
      onClick: () => setPicks([]),
      style: {
        marginLeft: 'auto',
        fontSize: 10.5,
        fontWeight: 600,
        color: '#0072a3',
        cursor: 'pointer'
      }
    }, L.clear)), React.createElement("div", {
      style: {
        fontSize: 11,
        color: '#55677d',
        marginTop: 2
      }
    }, picks.length ? picks.map(p => p.name).join('  +  ') : L.checkHint), picks.length === 2 && checkRes != null && React.createElement("div", {
      style: {
        marginTop: 7,
        display: 'flex',
        gap: 8,
        alignItems: 'flex-start'
      }
    }, checkRes.unchecked ? React.createElement(React.Fragment, null, React.createElement("span", {
      style: {
        flexShrink: 0,
        fontSize: 9.5,
        fontWeight: 700,
        letterSpacing: '.5px',
        textTransform: 'uppercase',
        color: '#8a5a00',
        background: 'rgba(224,161,42,.16)',
        border: '1px solid rgba(224,161,42,.45)',
        borderRadius: 6,
        padding: '3px 8px'
      }
    }, bn ? 'যাচাই হয়নি' : 'Not checked'), React.createElement("div", {
      style: {
        fontSize: 11.5,
        lineHeight: 1.5,
        color: '#2b3a4d',
        flex: 1
      }
    }, bn ? 'এই জোড়ার ইন্টারঅ্যাকশন যাচাই করা যায়নি — মনোগ্রাফ বা ফার্মাসিস্টের সাথে মিলিয়ে নিন।' : 'Interactions for this pair could NOT be checked (no linked generic, or the check failed). Consult the monograph or a pharmacist.')) : checkRes.length ? (() => {
      const w = checkRes[0],
        m = sevMeta(w);
      return React.createElement(React.Fragment, null, React.createElement("span", {
        style: {
          flexShrink: 0,
          fontSize: 9.5,
          fontWeight: 700,
          letterSpacing: '.5px',
          textTransform: 'uppercase',
          color: m[1],
          background: m[2],
          border: '1px solid ' + m[3],
          borderRadius: 6,
          padding: '3px 8px'
        }
      }, m[0]), React.createElement("div", {
        style: {
          fontSize: 11.5,
          lineHeight: 1.5,
          color: '#2b3a4d',
          flex: 1
        }
      }, w.detail || w.title));
    })() : React.createElement(React.Fragment, null, React.createElement("span", {
      style: {
        flexShrink: 0,
        fontSize: 9.5,
        fontWeight: 700,
        letterSpacing: '.5px',
        textTransform: 'uppercase',
        color: '#1c7d70',
        background: 'rgba(58,181,167,.15)',
        border: '1px solid rgba(58,181,167,.4)',
        borderRadius: 6,
        padding: '3px 8px'
      }
    }, bn ? 'ক্ষতিকর নয়' : 'No known harm'), React.createElement("div", {
      style: {
        fontSize: 11.5,
        lineHeight: 1.5,
        color: '#2b3a4d',
        flex: 1
      }
    }, L.noPair)))), React.createElement("div", {
      style: {
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 7,
        minHeight: 0,
        padding: '2px 2px 8px'
      }
    }, shown.map(m => {
      const isGenRow = searchMode === 'generic' && !favOnly;
      const on = !checkMode && brand && brand.id === m.id;
      const mc = classColor(m.drugClass);
      const picked = picks.some(x => x.id === m.id);
      return React.createElement("div", {
        key: m.id,
        onClick: () => clickRow(m),
        style: {
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '9px 11px 9px 14px',
          borderRadius: 13,
          cursor: 'pointer',
          transition: 'all .16s',
          flexShrink: 0,
          ...(on ? {
            background: 'rgba(255,255,255,.85)',
            border: '1px solid ' + mc + '77',
            boxShadow: '0 12px 28px ' + mc + '2e,0 4px 12px rgba(31,59,90,.1)'
          } : {
            background: 'rgba(255,255,255,.5)',
            border: '1px solid rgba(255,255,255,.85)'
          })
        }
      }, React.createElement("span", {
        style: {
          position: 'absolute',
          left: 0,
          top: 8,
          bottom: 8,
          width: 3.5,
          borderRadius: '0 4px 4px 0',
          background: mc + (on ? '' : '66')
        }
      }), React.createElement("div", {
        style: {
          width: 46,
          height: 46,
          background: '#fff',
          borderRadius: 10,
          flexShrink: 0,
          display: 'grid',
          placeItems: 'center',
          border: '1px solid rgba(31,59,90,.07)',
          overflow: 'hidden'
        }
      }, React.createElement(Thumb, {
        row: m,
        size: 38
      })), React.createElement("div", {
        style: {
          flex: 1,
          minWidth: 0
        }
      }, React.createElement("div", {
        style: {
          display: 'flex',
          alignItems: 'baseline',
          gap: 6,
          minWidth: 0
        }
      }, React.createElement("span", {
        style: {
          fontSize: 13,
          fontWeight: 700,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          flex: '0 1 auto',
          minWidth: 52
        }
      }, m.name), !isGenRow && React.createElement("span", {
        style: {
          fontFamily: MONO,
          fontSize: 10,
          color: '#0072a3',
          fontWeight: 600,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          minWidth: 0,
          flex: '0 1 auto'
        }
      }, m.strength), picked && React.createElement("span", {
        style: {
          fontSize: 8.5,
          fontWeight: 700,
          background: 'linear-gradient(90deg,#6a52d4,#0090ca)',
          color: '#fff',
          padding: '1px 6px',
          borderRadius: 5,
          flexShrink: 0
        }
      }, L.picked)), React.createElement("div", {
        style: {
          fontSize: 11,
          color: '#55677d',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          marginTop: 1
        }
      }, isGenRow ? m.drugClass || '—' : m.generic + (m.manufacturer ? ' · ' + m.manufacturer : ''))), React.createElement("div", {
        style: {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 3,
          flexShrink: 0
        }
      }, !isGenRow && React.createElement("span", {
        onClick: e => {
          e.stopPropagation();
          toggleFav(m);
        },
        style: {
          fontSize: 13,
          cursor: 'pointer',
          lineHeight: 1,
          userSelect: 'none',
          color: isFav(m.id) ? '#e09e1e' : 'rgba(31,59,90,.2)'
        }
      }, "\u2605"), isGenRow ? React.createElement("span", {
        style: {
          fontFamily: MONO,
          fontSize: 10.5,
          fontWeight: 700,
          color: '#0072a3',
          whiteSpace: 'nowrap'
        }
      }, nb(m.brands || 0), " ", React.createElement("span", {
        style: {
          fontFamily: 'inherit',
          fontWeight: 500,
          color: '#7d8ea8'
        }
      }, L.brandsOf)) : m.price && m.price.unit != null && React.createElement("span", {
        style: {
          fontFamily: MONO,
          fontSize: 10.5,
          fontWeight: 600,
          color: '#3c4858',
          whiteSpace: 'nowrap'
        }
      }, nb(taka(m.price.unit)))));
    }), !loading && !shown.length && React.createElement("div", {
      style: {
        textAlign: 'center',
        padding: '44px 16px',
        color: '#7d8ea8'
      }
    }, React.createElement("div", {
      style: {
        fontSize: 13,
        fontWeight: 600,
        color: '#55677d'
      }
    }, L.empty1), React.createElement("div", {
      style: {
        fontSize: 11.5,
        marginTop: 3
      }
    }, L.empty2)), !favOnly && !q.trim() && rows.length < total && React.createElement("button", {
      onClick: () => setPage(p => p + 1),
      style: {
        ...glass,
        border: '1px solid rgba(0,144,202,.3)',
        color: '#0072a3',
        borderRadius: 10,
        padding: '8px 10px',
        fontSize: 11.5,
        fontWeight: 700,
        cursor: 'pointer',
        fontFamily: 'inherit'
      }
    }, loading ? '…' : L.loadMore))), React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 340,
        background: 'rgba(255,255,255,.55)',
        border: '1px solid rgba(255,255,255,.9)',
        backdropFilter: 'blur(24px) saturate(1.5)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.5)',
        borderRadius: 18,
        boxShadow: '0 16px 44px rgba(31,59,90,.12)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }
    }, !brand ? React.createElement("div", {
      style: {
        flex: 1,
        display: 'grid',
        placeItems: 'center',
        color: '#7d8ea8',
        fontSize: 13
      }
    }, loading ? '…' : L.empty1) : React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        gap: 18,
        alignItems: 'center',
        padding: '22px 20px 20px',
        flexShrink: 0,
        color: '#fff',
        background: 'radial-gradient(460px 200px at 15% -20%,' + ac + '59,transparent 65%),radial-gradient(420px 220px at 100% 120%,' + ac + '33,transparent 70%),linear-gradient(120deg,rgba(13,28,50,.97),rgba(10,22,42,.93))'
      }
    }, React.createElement("div", {
      style: {
        position: 'absolute',
        right: -14,
        top: -44,
        fontSize: 140,
        fontWeight: 700,
        color: 'rgba(255,255,255,.045)',
        pointerEvents: 'none',
        fontFamily: MONO,
        lineHeight: 1
      }
    }, "Rx"), React.createElement("div", {
      style: {
        position: 'relative',
        width: 'clamp(88px,9vw,132px)',
        aspectRatio: '1',
        background: 'rgba(255,255,255,.97)',
        borderRadius: 16,
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
        boxShadow: '0 22px 48px ' + ac + '66,0 4px 12px rgba(0,0,0,.35)',
        overflow: 'hidden'
      }
    }, brand.hasImage ? React.createElement("img", {
      src: '/api/med/image/' + brand.id,
      alt: brand.name,
      loading: "lazy",
      style: {
        width: '84%',
        height: '84%',
        objectFit: 'contain'
      },
      onError: e => {
        e.target.style.display = 'none';
      }
    }) : React.createElement("span", {
      style: {
        fontFamily: MONO,
        fontSize: 34,
        fontWeight: 700,
        color: ac
      }
    }, "Rx")), React.createElement("div", {
      style: {
        minWidth: 0,
        flex: 1
      }
    }, React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'baseline',
        gap: 10,
        flexWrap: 'wrap'
      }
    }, React.createElement("span", {
      style: {
        fontSize: 24,
        fontWeight: 700,
        letterSpacing: '-.4px',
        color: '#fff'
      }
    }, brand.name), React.createElement("span", {
      style: {
        fontFamily: MONO,
        fontSize: 13,
        color: '#7ac4e8',
        fontWeight: 600
      }
    }, brand.strength)), React.createElement("div", {
      style: {
        color: '#c7d2e0',
        fontSize: 13.5,
        marginTop: 2,
        fontWeight: 500
      }
    }, brand.isGeneric ? nb(brand.brandCount || 0) + ' ' + L.brandsOf + (brand.generic ? ' · ' + brand.generic : '') : brand.generic), React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
        marginTop: 9
      }
    }, React.createElement("span", {
      title: brand.form || route,
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 10.5,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '.4px',
        color: RBRIGHT[route],
        background: 'rgba(255,255,255,.09)',
        border: '1px solid ' + RBRIGHT[route] + '55',
        padding: '2px 8px',
        borderRadius: 6,
        maxWidth: 200,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, brand.form || route), brand.drugClass && React.createElement("span", {
      title: brand.drugClass,
      style: {
        fontSize: 10.5,
        color: '#7ac4e8',
        background: 'rgba(255,255,255,.08)',
        border: '1px solid rgba(122,196,232,.35)',
        borderRadius: 6,
        padding: '2px 8px',
        maxWidth: 260,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, brand.drugClass), brand.price && brand.price.unit != null && React.createElement("span", {
      style: {
        fontSize: 10.5,
        fontFamily: MONO,
        fontWeight: 600,
        color: '#fff',
        background: 'rgba(255,255,255,.12)',
        border: '1px solid rgba(255,255,255,.22)',
        borderRadius: 6,
        padding: '2px 8px'
      }
    }, nb(taka(brand.price.unit))), brand.abx && React.createElement("span", {
      style: {
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: '.4px',
        textTransform: 'uppercase',
        borderRadius: 6,
        padding: '2px 8px',
        color: '#ffd28a',
        background: 'rgba(224,158,30,.18)',
        border: '1px solid rgba(255,210,138,.4)'
      }
    }, bn ? 'অ্যান্টিবায়োটিক' : 'Antibiotic')), !brand.isGeneric && React.createElement("div", {
      style: {
        fontSize: 11,
        color: '#93a5bb',
        marginTop: 8
      }
    }, L.mfr, " \u2014 ", React.createElement("b", {
      style: {
        color: '#fff'
      }
    }, brand.manufacturer || '—'))), React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 7,
        flexShrink: 0,
        alignSelf: 'flex-start'
      }
    }, React.createElement("button", {
      onClick: () => toggleFav({
        id: brand.id,
        name: brand.name,
        strength: brand.strength,
        form: brand.form,
        generic: brand.generic,
        price: brand.price,
        hasImage: brand.hasImage,
        drugClass: brand.drugClass
      }),
      title: "Favorite",
      style: {
        width: 34,
        height: 34,
        borderRadius: 9,
        border: '1px solid ' + (isFav(brand.id) ? 'rgba(224,158,30,.6)' : 'rgba(255,255,255,.22)'),
        background: isFav(brand.id) ? 'rgba(224,158,30,.25)' : 'rgba(255,255,255,.1)',
        display: 'grid',
        placeItems: 'center',
        color: isFav(brand.id) ? '#ffd28a' : 'rgba(255,255,255,.6)',
        cursor: 'pointer',
        fontSize: 16
      }
    }, "\u2605"), React.createElement("button", {
      onClick: copySummary,
      title: L.copyT,
      style: {
        width: 34,
        height: 34,
        borderRadius: 9,
        border: '1px solid ' + (copied ? 'rgba(127,214,203,.6)' : 'rgba(255,255,255,.22)'),
        background: copied ? 'rgba(58,181,167,.3)' : 'rgba(255,255,255,.1)',
        display: 'grid',
        placeItems: 'center',
        color: copied ? '#7fd6cb' : 'rgba(255,255,255,.65)',
        cursor: 'pointer',
        transition: 'all .15s'
      }
    }, React.createElement("svg", {
      width: "14",
      height: "14",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M9 9h11v11H9zM5 15H4V4h11v1"
    }))), React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        marginTop: 4
      }
    }, React.createElement("div", {
      style: {
        width: 64,
        height: 22,
        opacity: .75,
        background: 'repeating-linear-gradient(90deg,#fff 0 1.5px,transparent 1.5px 3px,#fff 3px 5.5px,transparent 5.5px 7px,#fff 7px 8px,transparent 8px 10.5px)'
      }
    }), React.createElement("span", {
      style: {
        fontFamily: MONO,
        fontSize: 7.5,
        letterSpacing: '.8px',
        color: 'rgba(255,255,255,.55)'
      }
    }, ('UNC-' + brand.id).toUpperCase().slice(0, 18))))), React.createElement("div", {
      style: {
        flex: 1,
        overflowY: 'auto',
        padding: '14px 18px 22px',
        minHeight: 0
      }
    }, tab === 'overview' && (nursing || prescriberG) && React.createElement("div", {
      style: {
        marginBottom: 12
      }
    }, React.createElement("div", {
      style: {
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: '.8px',
        textTransform: 'uppercase',
        color: '#55677d',
        marginBottom: 7
      }
    }, L.clinicalGuidance), lowConf && React.createElement("div", {
      style: {
        fontSize: 11,
        lineHeight: 1.5,
        color: '#8a5a10',
        background: 'rgba(224,158,30,.12)',
        border: '1px solid rgba(224,158,30,.4)',
        borderRadius: 10,
        padding: '8px 11px',
        marginBottom: 9
      }
    }, "\u26A0\uFE0F ", L.lowConf), nursing && React.createElement("div", {
      style: {
        background: 'linear-gradient(90deg,rgba(58,181,167,.12),rgba(0,144,202,.06))',
        border: '1px solid rgba(58,181,167,.35)',
        borderLeft: '3px solid #1c7d70',
        borderRadius: 12,
        padding: '11px 14px',
        marginBottom: 9
      }
    }, React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        marginBottom: 7,
        flexWrap: 'wrap'
      }
    }, React.createElement("span", {
      style: {
        fontSize: 13
      }
    }, "\uD83D\uDC69\u200D\u2695\uFE0F"), React.createElement("span", {
      style: {
        fontSize: 12.5,
        fontWeight: 700,
        color: '#123f38'
      }
    }, L.nursing), React.createElement("span", {
      style: {
        fontSize: 8.5,
        fontWeight: 700,
        letterSpacing: '.4px',
        textTransform: 'uppercase',
        color: '#8a5a10',
        background: 'rgba(224,158,30,.16)',
        border: '1px solid rgba(224,158,30,.4)',
        borderRadius: 5,
        padding: '2px 6px'
      }
    }, L.aiWritten)), React.createElement(Bulleted, {
      text: nursing,
      tone: "#1c7d70"
    })), prescriberG && React.createElement("div", {
      style: {
        background: 'rgba(255,255,255,.66)',
        border: '1px solid rgba(255,255,255,.95)',
        borderLeft: '3px solid #0072a3',
        borderRadius: 12,
        padding: '11px 14px',
        boxShadow: '0 4px 14px rgba(31,59,90,.05)'
      }
    }, React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        marginBottom: 7,
        flexWrap: 'wrap'
      }
    }, React.createElement("span", {
      style: {
        fontSize: 13
      }
    }, "\uD83E\uDE7A"), React.createElement("span", {
      style: {
        fontSize: 12.5,
        fontWeight: 700,
        color: '#16202e'
      }
    }, L.prescriber), React.createElement("span", {
      style: {
        fontSize: 8.5,
        fontWeight: 700,
        letterSpacing: '.4px',
        textTransform: 'uppercase',
        color: '#8a5a10',
        background: 'rgba(224,158,30,.16)',
        border: '1px solid rgba(224,158,30,.4)',
        borderRadius: 5,
        padding: '2px 6px'
      }
    }, L.aiWritten)), React.createElement(Bulleted, {
      text: prescriberG,
      tone: "#0072a3"
    }))), React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit,minmax(122px,1fr))',
        gap: 8,
        marginBottom: 13
      }
    }, [{
      k: L.preg,
      v: preg ? (bn ? 'ক্যাটাগরি ' : 'Category ') + preg : '—',
      c: PREGC[preg]
    }, {
      k: L.formT,
      v: (brand.form || '—') + (brand.strength ? ' · ' + brand.strength : '')
    }, {
      k: L.priceT,
      v: brand.price && brand.price.unit != null ? nb(taka(brand.price.unit)) + (brand.priceMax && brand.priceMax !== brand.price.unit ? ' – ' + nb(taka(brand.priceMax)) : '') : '—'
    }, {
      k: L.confT,
      v: brand.confidence ? brand.confidence : '—',
      c: brand.confidence === 'low' ? PREGC.C : null
    }].map((t, i) => React.createElement("div", {
      key: i,
      style: {
        background: t.c ? t.c[1] : 'rgba(255,255,255,.66)',
        border: '1px solid ' + (t.c ? t.c[2] : 'rgba(255,255,255,.95)'),
        borderRadius: 10,
        padding: '8px 10px',
        color: t.c ? t.c[0] : '#2b3a4d'
      }
    }, React.createElement("div", {
      style: {
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '.6px',
        textTransform: 'uppercase',
        opacity: .75,
        marginBottom: 2
      }
    }, t.k), React.createElement("div", {
      style: {
        fontSize: 11.5,
        fontWeight: 600,
        lineHeight: 1.35
      }
    }, t.v)))), React.createElement("div", {
      style: {
        display: 'flex',
        gap: 4,
        background: 'rgba(31,59,90,.06)',
        borderRadius: 11,
        padding: 4,
        marginBottom: 13
      }
    }, ['overview', 'dosage', 'safety', 'alts', 'more'].map(k => React.createElement("div", {
      key: k,
      onClick: () => setTab(k),
      style: {
        flex: 1,
        textAlign: 'center',
        fontSize: 11.5,
        fontWeight: tab === k ? 700 : 500,
        padding: '7px 6px',
        borderRadius: 8,
        cursor: 'pointer',
        transition: 'all .15s',
        whiteSpace: 'nowrap',
        ...(tab === k ? {
          background: 'linear-gradient(90deg,#0090ca,#3ab5a7)',
          color: '#fff',
          boxShadow: '0 6px 16px rgba(0,144,202,.35)'
        } : {
          color: '#55677d'
        })
      }
    }, L.tabs[k]))), tab === 'safety' && (sel.interactions || []).length > 0 && React.createElement("div", {
      style: {
        marginBottom: 11,
        background: 'rgba(255,255,255,.66)',
        border: '1px solid rgba(210,58,82,.25)',
        borderRadius: 12,
        padding: '11px 14px',
        boxShadow: '0 4px 14px rgba(31,59,90,.05)'
      }
    }, React.createElement("div", {
      style: {
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '.7px',
        textTransform: 'uppercase',
        color: '#8c2237',
        marginBottom: 7
      }
    }, bn ? 'নথিভুক্ত মিথস্ক্রিয়া' : 'Documented interactions', " \xB7 ", nb((sel.interactions || []).length)), React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 7
      }
    }, (sel.interactions || []).map((w, i) => {
      const major = w.severity === 'major';
      const c = major ? ['#8c2237', 'rgba(210,58,82,.13)', 'rgba(210,58,82,.4)'] : ['#8a5a10', 'rgba(224,158,30,.16)', 'rgba(224,158,30,.45)'];
      return React.createElement("div", {
        key: i,
        style: {
          display: 'flex',
          gap: 8,
          alignItems: 'flex-start'
        }
      }, React.createElement("span", {
        style: {
          flexShrink: 0,
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '.5px',
          textTransform: 'uppercase',
          color: c[0],
          background: c[1],
          border: '1px solid ' + c[2],
          borderRadius: 6,
          padding: '2px 7px',
          marginTop: 1
        }
      }, major ? bn ? 'গুরুতর' : 'Major' : bn ? 'মাঝারি' : 'Moderate'), React.createElement("div", {
        style: {
          fontSize: 11.5,
          lineHeight: 1.5,
          color: '#2b3a4d',
          minWidth: 0
        }
      }, React.createElement("b", null, w.with), " \u2014 ", w.reason, w.advice && React.createElement("div", {
        style: {
          color: '#55677d',
          marginTop: 1
        }
      }, React.createElement("b", {
        style: {
          color: c[0]
        }
      }, bn ? 'করণীয়: ' : 'Advice: '), w.advice)));
    }))), tab === 'safety' && (sel.foodWarnings || []).length > 0 && React.createElement("div", {
      style: {
        marginBottom: 11,
        background: 'linear-gradient(90deg,rgba(224,158,30,.1),rgba(224,99,30,.06))',
        border: '1px solid rgba(224,158,30,.35)',
        borderRadius: 12,
        padding: '11px 14px'
      }
    }, React.createElement("div", {
      style: {
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '.7px',
        textTransform: 'uppercase',
        color: '#8a5a10',
        marginBottom: 5
      }
    }, bn ? 'খাবার ও পানীয় সতর্কতা' : 'Food & drink warnings'), (sel.foodWarnings || []).map((w, i) => React.createElement("div", {
      key: i,
      style: {
        fontSize: 11.5,
        lineHeight: 1.55,
        color: '#5a3d10',
        marginBottom: 3
      }
    }, "\u2022 ", w.warning))), sections.map(s2 => React.createElement("div", {
      key: s2.key,
      style: {
        marginBottom: 11,
        background: 'rgba(255,255,255,.66)',
        border: '1px solid rgba(255,255,255,.95)',
        borderRadius: 12,
        padding: '11px 14px',
        boxShadow: '0 4px 14px rgba(31,59,90,.05)'
      }
    }, React.createElement("div", {
      style: {
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '.7px',
        textTransform: 'uppercase',
        color: '#0072a3',
        marginBottom: 6
      }
    }, s2.t), React.createElement(Bulleted, {
      text: s2.body
    }))), TABSEC[tab] && !sections.length && React.createElement("div", {
      style: {
        textAlign: 'center',
        color: '#9aa6b4',
        fontSize: 12,
        padding: '20px 0 8px'
      }
    }, "\u2014"), tab === 'alts' && ((sel.alternatives || []).length ? React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 7
      }
    }, React.createElement("div", {
      style: {
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '.7px',
        textTransform: 'uppercase',
        color: '#6c7a8c'
      }
    }, L.similar, " \xB7 ", nb((sel.alternatives || []).length)), (sel.alternatives || []).map(a => React.createElement("div", {
      key: a.id,
      onClick: () => openBrand(a.id),
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: 'rgba(255,255,255,.66)',
        border: '1px solid rgba(255,255,255,.95)',
        borderRadius: 12,
        padding: '8px 11px',
        cursor: 'pointer',
        boxShadow: '0 4px 14px rgba(31,59,90,.05)'
      }
    }, React.createElement("div", {
      style: {
        width: 40,
        height: 40,
        background: '#fff',
        borderRadius: 9,
        flexShrink: 0,
        display: 'grid',
        placeItems: 'center',
        border: '1px solid rgba(31,59,90,.07)',
        overflow: 'hidden'
      }
    }, React.createElement(Thumb, {
      row: a,
      size: 32
    })), React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'baseline',
        gap: 6
      }
    }, React.createElement("span", {
      style: {
        fontSize: 12.5,
        fontWeight: 700,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, a.name), React.createElement("span", {
      style: {
        fontFamily: MONO,
        fontSize: 10,
        color: '#0072a3',
        fontWeight: 600,
        whiteSpace: 'nowrap'
      }
    }, a.strength)), React.createElement("div", {
      style: {
        fontSize: 10.5,
        color: '#55677d',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, a.form, a.manufacturer ? ' · ' + a.manufacturer : '')), a.price && a.price.unit != null && React.createElement("span", {
      style: {
        fontFamily: MONO,
        fontSize: 11,
        fontWeight: 700,
        color: '#157a43',
        whiteSpace: 'nowrap'
      }
    }, nb(taka(a.price.unit))))), React.createElement("div", {
      style: {
        fontSize: 10,
        color: '#9aa6b4'
      }
    }, bn ? 'সস্তা আগে সাজানো — একই জেনেরিক বহনকারী ব্র্যান্ড।' : 'Cheapest first — brands carrying the same generic.')) : React.createElement("div", {
      style: {
        textAlign: 'center',
        color: '#9aa6b4',
        fontSize: 12,
        padding: '20px 0 8px'
      }
    }, bn ? 'এই জেনেরিকের অন্য কোনো ব্র্যান্ড নেই।' : 'No other brand carries this generic.')), tab === 'more' && React.createElement("div", {
      style: {
        fontSize: 10,
        color: '#9aa6b4',
        lineHeight: 1.5,
        marginTop: 4
      }
    }, L.disclaimer))))));
  }
  window.MedicineInfoV2 = MedicineInfoV2;
})();
})();
;
/* ===== medicine.jsx ===== */
(function(){
const {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback
} = React;
const Ic = window.Ic,
  I = window.I;
const MK = window.MK;
const medApi = {
  get: u => fetch(u, {
    headers: {
      accept: 'application/json'
    }
  }).then(r => r.json()),
  put: (u, b) => fetch(u, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(b || {})
  }).then(r => r.json()),
  post: (u, b) => fetch(u, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(b || {})
  }).then(r => r.json()),
  del: u => fetch(u, {
    method: 'DELETE'
  }).then(r => r.json())
};
const medToast = (m, t) => {
  try {
    window.UI && window.UI.toast && window.UI.toast(m, t || 'success');
  } catch (e) {}
};
const medCan = a => {
  try {
    return window.unicoCan ? window.unicoCan('medicine', a) : true;
  } catch (e) {
    return true;
  }
};
const medIsAdmin = () => {
  try {
    const u = window.__UNICO_USER__;
    return !u || u.role === 'Administrator';
  } catch (e) {
    return true;
  }
};
const qs = o => Object.keys(o).filter(k => o[k] !== '' && o[k] != null).map(k => k + '=' + encodeURIComponent(o[k])).join('&');
const money = n => n == null || !Number.isFinite(Number(n)) ? '—' : '৳ ' + Number(n).toFixed(2);
const today = () => new Date().toISOString().slice(0, 10);
const esc = s => String(s == null ? '' : s);
const cardOpen = extra => Object.assign({}, MK.card, {
  overflow: 'visible',
  position: 'relative',
  zIndex: 30
}, extra || {});
const Monograph = ({
  html
}) => React.createElement("div", {
  className: "mono-body",
  dangerouslySetInnerHTML: {
    __html: esc(html)
  }
});
const SECTION_LABEL = {
  indication: 'Indications',
  therapeuticClass: 'Therapeutic class',
  pharmacology: 'Pharmacology',
  dosage: 'Dosage & administration',
  adultDose: 'Adult dose',
  childDose: 'Child dose',
  renalDose: 'Renal dose',
  administration: 'Administration',
  interaction: 'Interactions',
  contraindications: 'Contraindications',
  sideEffects: 'Side effects',
  pregnancy: 'Pregnancy & lactation',
  precautions: 'Precautions',
  nursingConsiderations: 'Nursing considerations',
  prescriberConsiderations: 'Prescriber considerations',
  pediatric: 'Paediatric use',
  overdose: 'Overdose',
  duration: 'Duration of treatment',
  reconstitution: 'Reconstitution',
  storage: 'Storage'
};
const SECTION_ORDER = ['indication', 'therapeuticClass', 'pharmacology', 'dosage', 'adultDose', 'childDose', 'renalDose', 'administration', 'interaction', 'contraindications', 'sideEffects', 'pregnancy', 'precautions', 'nursingConsiderations', 'prescriberConsiderations', 'pediatric', 'overdose', 'duration', 'reconstitution', 'storage'];
const FREQ = ['1+0+0', '0+0+1', '1+0+1', '1+1+1', '0+1+0', '1+1+1+1', '½+0+½', 'OD', 'BD', 'TDS', 'QDS', 'SOS', 'STAT', 'Weekly'];
const TIMING = ['After meal', 'Before meal', 'With meal', 'Empty stomach', 'At bedtime', 'As directed'];
const DURATION = ['3 days', '5 days', '7 days', '10 days', '14 days', '1 month', '2 months', '3 months', 'Continue'];
function MedEmpty({
  icon,
  title,
  note,
  action
}) {
  return React.createElement("div", {
    style: {
      textAlign: 'center',
      padding: '46px 20px',
      color: MK.MUTED
    }
  }, React.createElement("div", {
    style: {
      marginBottom: 10,
      opacity: .5
    }
  }, React.createElement(Ic, {
    d: icon || I.search,
    s: 30
  })), React.createElement("div", {
    style: {
      fontSize: 14.5,
      fontWeight: 700,
      color: MK.INK,
      marginBottom: 5
    }
  }, title), note ? React.createElement("div", {
    style: {
      fontSize: 12.5,
      lineHeight: 1.55,
      maxWidth: 420,
      margin: '0 auto 14px'
    }
  }, note) : null, action || null);
}
const PriceNote = () => React.createElement("span", {
  style: {
    fontSize: 10.5,
    color: MK.FAINT,
    fontStyle: 'italic'
  }
}, "indicative price, 2022 snapshot");
function TypeChip({
  type
}) {
  if (type !== 'herbal') return null;
  return React.createElement("span", {
    style: MK.gchip('green')
  }, "Herbal");
}
function useDrugSearch(q, kind) {
  const [res, setRes] = useState({
    brands: [],
    generics: [],
    loading: false,
    done: false
  });
  const seq = useRef(0);
  useEffect(() => {
    const term = String(q || '').trim();
    if (term.length < 2) {
      setRes({
        brands: [],
        generics: [],
        loading: false,
        done: false
      });
      return;
    }
    setRes(s => ({
      ...s,
      loading: true
    }));
    const mine = ++seq.current;
    const t = setTimeout(() => {
      medApi.get('/api/med/search?' + qs({
        q: term,
        kind: kind || '',
        limit: 20
      })).then(r => {
        if (mine !== seq.current) return;
        setRes({
          brands: r && r.brands || [],
          generics: r && r.generics || [],
          loading: false,
          done: true
        });
      }).catch(() => {
        if (mine === seq.current) setRes({
          brands: [],
          generics: [],
          loading: false,
          done: true
        });
      });
    }, 220);
    return () => clearTimeout(t);
  }, [q, kind]);
  return res;
}
function DrugSearchBox({
  value,
  onChange,
  onPick,
  placeholder,
  autoFocus,
  kind
}) {
  const [open, setOpen] = useState(false);
  const res = useDrugSearch(value, kind);
  const box = useRef(null);
  useEffect(() => {
    const away = e => {
      if (box.current && !box.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, []);
  const hasAny = res.brands.length || res.generics.length;
  return React.createElement("div", {
    ref: box,
    style: {
      position: 'relative'
    }
  }, React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, React.createElement("span", {
    style: {
      position: 'absolute',
      left: 11,
      top: '50%',
      transform: 'translateY(-50%)',
      color: MK.FAINT
    }
  }, React.createElement(Ic, {
    d: I.search,
    s: 15
  })), React.createElement("input", {
    className: "inp",
    autoFocus: autoFocus,
    value: value,
    placeholder: placeholder || 'Search brand or generic — e.g. Napa, Paracetamol, Seclo',
    onChange: e => {
      onChange(e.target.value);
      setOpen(true);
    },
    onFocus: () => setOpen(true),
    style: {
      width: '100%',
      padding: '10px 12px 10px 34px',
      fontSize: 13
    }
  }), res.loading ? React.createElement("span", {
    style: {
      position: 'absolute',
      right: 12,
      top: '50%',
      transform: 'translateY(-50%)',
      fontSize: 11,
      color: MK.FAINT
    }
  }, "searching\u2026") : null), open && String(value || '').trim().length >= 2 ? React.createElement("div", {
    style: {
      position: 'absolute',
      zIndex: 40,
      top: '100%',
      left: 0,
      right: 0,
      marginTop: 5,
      maxHeight: 380,
      overflowY: 'auto',
      background: '#fff',
      border: '1px solid ' + MK.LINE,
      borderRadius: 11,
      boxShadow: '0 18px 44px rgba(31,59,90,.18)'
    }
  }, res.generics.length ? React.createElement("div", {
    style: {
      padding: '7px 12px 4px',
      fontSize: 10.5,
      fontWeight: 800,
      letterSpacing: .6,
      color: MK.FAINT,
      textTransform: 'uppercase'
    }
  }, "Generics") : null, res.generics.map(g => React.createElement("button", {
    key: g.id,
    className: "row-btn",
    onClick: () => {
      onPick({
        kind: 'generic',
        doc: g
      });
      setOpen(false);
    },
    style: {
      display: 'block',
      width: '100%',
      textAlign: 'left',
      padding: '8px 12px',
      border: 0,
      background: 'transparent',
      cursor: 'pointer'
    }
  }, React.createElement("div", {
    style: {
      fontSize: 12.5,
      fontWeight: 700,
      color: MK.INK
    }
  }, g.name), React.createElement("div", {
    style: {
      fontSize: 11,
      color: MK.MUTED
    }
  }, g.drugClass || 'Generic', " \xB7 ", g.brands || 0, " brand", g.brands === 1 ? '' : 's'))), res.brands.length ? React.createElement("div", {
    style: {
      padding: '7px 12px 4px',
      fontSize: 10.5,
      fontWeight: 800,
      letterSpacing: .6,
      color: MK.FAINT,
      textTransform: 'uppercase',
      borderTop: res.generics.length ? '1px solid ' + MK.LINE : 0
    }
  }, "Brands") : null, res.brands.map(b => React.createElement("button", {
    key: b.id,
    className: "row-btn",
    onClick: () => {
      onPick({
        kind: 'brand',
        doc: b
      });
      setOpen(false);
    },
    style: {
      display: 'block',
      width: '100%',
      textAlign: 'left',
      padding: '8px 12px',
      border: 0,
      background: 'transparent',
      cursor: 'pointer'
    }
  }, React.createElement("div", {
    style: {
      fontSize: 12.5,
      fontWeight: 700,
      color: MK.INK
    }
  }, b.name, " ", React.createElement("span", {
    style: {
      fontWeight: 500,
      color: MK.MUTED
    }
  }, b.strength), " ", React.createElement(TypeChip, {
    type: b.type
  })), React.createElement("div", {
    style: {
      fontSize: 11,
      color: MK.MUTED
    }
  }, b.form ? b.form + ' · ' : '', b.generic, b.manufacturer ? ' · ' + b.manufacturer : '', b.price && b.price.unit != null ? ' · ' + money(b.price.unit) : ''))), !hasAny && res.done && !res.loading ? React.createElement("div", {
    style: {
      padding: '14px 12px',
      fontSize: 12,
      color: MK.MUTED,
      textAlign: 'center'
    }
  }, "Nothing in the index matches \u201C", value, "\u201D. It may be a brand registered after the 2022 snapshot \u2014 you can still type it onto the pad by hand.") : null, !res.done && res.loading ? React.createElement("div", {
    style: {
      padding: '14px 12px',
      fontSize: 12,
      color: MK.FAINT,
      textAlign: 'center'
    }
  }, "Searching the index\u2026") : null) : null);
}
function MedHome({
  setRoute
}) {
  const [status, setStatus] = useState(null);
  const [q, setQ] = useState('');
  const [recent, setRecent] = useState([]);
  useEffect(() => {
    medApi.get('/api/med/status').then(setStatus).catch(() => setStatus({
      ready: false
    }));
    medApi.get('/api/prescriptions?limit=8').then(r => setRecent(r && r.prescriptions || [])).catch(() => {});
  }, []);
  const go = p => {
    if (p.kind === 'brand') setRoute({
      view: 'medBrand',
      id: p.doc.id
    });else setRoute({
      view: 'medGeneric',
      id: p.doc.id
    });
  };
  if (status && !status.ready) {
    return React.createElement("div", {
      style: MK.page
    }, React.createElement("div", {
      style: MK.card
    }, React.createElement(MedEmpty, {
      icon: I.download,
      title: "The drug index has not been imported yet",
      note: "Run the importer once to load the Bangladesh medicine index \u2014 about 21,700 brands and 1,700 generic monographs \u2014 into this installation.",
      action: React.createElement("code", {
        style: {
          display: 'inline-block',
          background: 'rgba(125,145,180,.12)',
          padding: '9px 14px',
          borderRadius: 8,
          fontSize: 12,
          fontFamily: MK.MONO
        }
      }, "node scripts/import-medicines.js")
    })));
  }
  return React.createElement("div", {
    style: MK.page
  }, React.createElement("div", {
    style: cardOpen({
      marginBottom: 16
    })
  }, React.createElement("div", {
    style: {
      padding: '26px 26px 22px'
    }
  }, React.createElement("div", {
    style: {
      fontSize: 20,
      fontWeight: 800,
      color: MK.INK,
      marginBottom: 4
    }
  }, "Medicine & Prescription"), React.createElement("div", {
    style: {
      ...MK.sub,
      marginBottom: 18
    }
  }, "Look up any brand or generic sold in Bangladesh, read its monograph, and write a prescription from it."), React.createElement(DrugSearchBox, {
    value: q,
    onChange: setQ,
    onPick: go,
    autoFocus: true,
    placeholder: "Search 21,700 brands and 1,700 generics \u2014 try Napa, Seclo, Amoxicillin\u2026"
  }), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 9,
      marginTop: 16,
      flexWrap: 'wrap'
    }
  }, React.createElement("button", {
    style: MK.btnPri,
    onClick: () => setRoute({
      view: 'medRxNew'
    })
  }, React.createElement(Ic, {
    d: I.plus,
    s: 14
  }), "New prescription"), React.createElement("button", {
    style: MK.btnGhost,
    onClick: () => setRoute({
      view: 'medBrowse'
    })
  }, React.createElement(Ic, {
    d: I.layers,
    s: 14
  }), "Browse the index"), React.createElement("button", {
    style: MK.btnGhost,
    onClick: () => setRoute({
      view: 'medRxList'
    })
  }, React.createElement(Ic, {
    d: I.doc,
    s: 14
  }), "Prescriptions"), React.createElement("button", {
    style: MK.btnGhost,
    onClick: () => setRoute({
      view: 'medTemplates'
    })
  }, React.createElement(Ic, {
    d: I.star,
    s: 14
  }), "Templates")))), React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))',
      gap: 13,
      marginBottom: 16
    }
  }, [{
    label: 'Brands indexed',
    value: status ? (status.brands || 0).toLocaleString() : '—',
    tone: 'blue'
  }, {
    label: 'Generic monographs',
    value: status ? (status.generics || 0).toLocaleString() : '—',
    tone: 'teal'
  }, {
    label: 'Prescriptions written',
    value: recent.length ? '—' : '0',
    tone: 'violet',
    link: 'medRxList'
  }, {
    label: 'Data snapshot',
    value: '2022',
    tone: 'amber',
    note: 'prices indicative'
  }].map((s, i) => React.createElement("div", {
    key: i,
    style: {
      ...MK.card,
      padding: '16px 18px'
    }
  }, React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: MK.MUTED,
      textTransform: 'uppercase',
      letterSpacing: .5,
      marginBottom: 6
    }
  }, s.label), React.createElement("div", {
    style: {
      fontSize: 25,
      fontWeight: 800,
      color: MK.INK,
      fontFamily: MK.MONO
    }
  }, s.value), s.note ? React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: MK.FAINT,
      marginTop: 3
    }
  }, s.note) : null))), React.createElement(MedQuickRail, {
    setRoute: setRoute
  }), React.createElement("div", {
    style: MK.card
  }, React.createElement("div", {
    style: MK.cardHead
  }, React.createElement("div", {
    style: MK.h3
  }, "Recent prescriptions"), React.createElement("button", {
    style: MK.btnGhost,
    onClick: () => setRoute({
      view: 'medRxList'
    })
  }, "See all")), React.createElement("div", {
    style: MK.cardBody
  }, recent.length ? React.createElement(RxRows, {
    rows: recent,
    setRoute: setRoute
  }) : React.createElement(MedEmpty, {
    icon: I.doc,
    title: "No prescriptions yet",
    note: "Prescriptions you write are stored against the patient's UHID so you can pull up their history and repeat one.",
    action: React.createElement("button", {
      style: MK.btnPri,
      onClick: () => setRoute({
        view: 'medRxNew'
      })
    }, "Write the first one")
  }))));
}
function MedQuickRail({
  setRoute
}) {
  const fav = useFavourites();
  const [recent, setRecent] = useState(() => readLS(RECENT_KEY, []));
  useEffect(() => {
    setRecent(readLS(RECENT_KEY, []));
  }, []);
  const go = e => setRoute({
    view: e.kind === 'brand' ? 'medBrand' : 'medGeneric',
    id: e.id
  });
  const Row = ({
    items,
    empty
  }) => items.length ? React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, items.map(e => React.createElement("button", {
    key: e.kind + e.id,
    onClick: () => go(e),
    style: {
      textAlign: 'left',
      padding: '8px 12px',
      border: '1px solid ' + MK.LINE,
      borderRadius: 10,
      background: '#fff',
      cursor: 'pointer'
    }
  }, React.createElement("div", {
    style: {
      fontSize: 12.5,
      fontWeight: 700,
      color: MK.INK
    }
  }, e.name), React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: MK.MUTED
    }
  }, e.sub || e.kind)))) : React.createElement("div", {
    style: {
      fontSize: 12,
      color: MK.FAINT
    }
  }, empty);
  if (!fav.favs.length && !recent.length) return null;
  return React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))',
      gap: 13,
      marginBottom: 16
    }
  }, React.createElement("div", {
    style: MK.card
  }, React.createElement("div", {
    style: MK.cardHead
  }, React.createElement("div", {
    style: MK.h3
  }, "Saved drugs")), React.createElement("div", {
    style: MK.cardBody
  }, React.createElement(Row, {
    items: fav.favs.slice(0, 10),
    empty: "Star a drug on its page to keep it here."
  }))), React.createElement("div", {
    style: MK.card
  }, React.createElement("div", {
    style: MK.cardHead
  }, React.createElement("div", {
    style: MK.h3
  }, "Recently viewed")), React.createElement("div", {
    style: MK.cardBody
  }, React.createElement(Row, {
    items: recent.slice(0, 10),
    empty: "Drugs you open appear here."
  }))));
}
function MedBrowse({
  setRoute,
  initialQ
}) {
  const [kind, setKind] = useState('brand');
  const [q, setQ] = useState(initialQ || '');
  const [filters, setFilters] = useState({
    letter: '',
    class: '',
    mfr: '',
    form: '',
    type: '',
    stocked: ''
  });
  const [page, setPage] = useState(1);
  const [data, setData] = useState({
    rows: [],
    total: 0,
    pages: 0,
    loading: true
  });
  const [refs, setRefs] = useState({
    class: [],
    mfr: [],
    form: []
  });
  const search = useDrugSearch(q, kind);
  useEffect(() => {
    Promise.all([medApi.get('/api/med/refs?kind=class'), medApi.get('/api/med/refs?kind=mfr'), medApi.get('/api/med/refs?kind=form')]).then(([c, m, f]) => setRefs({
      class: c && c.refs || [],
      mfr: m && m.refs || [],
      form: f && f.refs || []
    })).catch(() => {});
  }, []);
  useEffect(() => {
    if (String(q || '').trim().length >= 2) return;
    setData(d => ({
      ...d,
      loading: true
    }));
    medApi.get('/api/med/browse?' + qs({
      kind,
      page,
      per: 50,
      ...filters
    })).then(r => setData({
      rows: r && r.rows || [],
      total: r && r.total || 0,
      pages: r && r.pages || 0,
      loading: false
    })).catch(() => setData({
      rows: [],
      total: 0,
      pages: 0,
      loading: false
    }));
  }, [kind, page, filters, q]);
  useEffect(() => {
    setPage(1);
  }, [kind, filters]);
  const setF = (k, v) => setFilters(f => ({
    ...f,
    [k]: f[k] === v ? '' : v
  }));
  const searching = String(q || '').trim().length >= 2;
  const rows = searching ? kind === 'generic' ? search.generics : search.brands : data.rows;
  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  return React.createElement("div", {
    style: MK.page
  }, React.createElement("div", {
    style: cardOpen({
      marginBottom: 14
    })
  }, React.createElement("div", {
    style: {
      padding: '18px 20px 16px'
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      alignItems: 'center',
      marginBottom: 13,
      flexWrap: 'wrap'
    }
  }, [['brand', 'Brands'], ['generic', 'Generics']].map(([k, label]) => React.createElement("button", {
    key: k,
    onClick: () => setKind(k),
    style: kind === k ? MK.btnPri : MK.btnGhost
  }, label)), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 240
    }
  }, React.createElement(DrugSearchBox, {
    value: q,
    onChange: setQ,
    kind: kind,
    onPick: p => setRoute(p.kind === 'brand' ? {
      view: 'medBrand',
      id: p.doc.id
    } : {
      view: 'medGeneric',
      id: p.doc.id
    })
  }))), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 3,
      flexWrap: 'wrap',
      marginBottom: 11
    }
  }, React.createElement("button", {
    onClick: () => setF('letter', ''),
    style: {
      ...MK.btnGhost,
      padding: '4px 9px',
      fontSize: 11,
      background: filters.letter ? undefined : 'rgba(0,144,202,.12)'
    }
  }, "All"), LETTERS.map(L => React.createElement("button", {
    key: L,
    onClick: () => setF('letter', L.toLowerCase()),
    style: {
      ...MK.btnGhost,
      padding: '4px 8px',
      fontSize: 11,
      minWidth: 26,
      justifyContent: 'center',
      background: filters.letter === L.toLowerCase() ? 'rgba(0,144,202,.16)' : undefined
    }
  }, L))), React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))',
      gap: 9
    }
  }, React.createElement("select", {
    className: "inp",
    value: filters.class,
    onChange: e => setFilters(f => ({
      ...f,
      class: e.target.value
    })),
    style: {
      fontSize: 12
    }
  }, React.createElement("option", {
    value: ""
  }, "All drug classes"), refs.class.map(r => React.createElement("option", {
    key: r.id,
    value: r.name
  }, r.name, " (", r.count, ")"))), kind === 'brand' ? React.createElement("select", {
    className: "inp",
    value: filters.mfr,
    onChange: e => setFilters(f => ({
      ...f,
      mfr: e.target.value
    })),
    style: {
      fontSize: 12
    }
  }, React.createElement("option", {
    value: ""
  }, "All manufacturers"), refs.mfr.map(r => React.createElement("option", {
    key: r.id,
    value: r.name
  }, r.name, " (", r.count, ")"))) : null, kind === 'brand' ? React.createElement("select", {
    className: "inp",
    value: filters.form,
    onChange: e => setFilters(f => ({
      ...f,
      form: e.target.value
    })),
    style: {
      fontSize: 12
    }
  }, React.createElement("option", {
    value: ""
  }, "All dosage forms"), refs.form.map(r => React.createElement("option", {
    key: r.id,
    value: r.name
  }, r.name, " (", r.count, ")"))) : null, kind === 'brand' ? React.createElement("select", {
    className: "inp",
    value: filters.type,
    onChange: e => setFilters(f => ({
      ...f,
      type: e.target.value
    })),
    style: {
      fontSize: 12
    }
  }, React.createElement("option", {
    value: ""
  }, "Allopathic & herbal"), React.createElement("option", {
    value: "allopathic"
  }, "Allopathic only"), React.createElement("option", {
    value: "herbal"
  }, "Herbal only")) : null, kind === 'brand' ? React.createElement("select", {
    className: "inp",
    value: filters.stocked,
    onChange: e => setFilters(f => ({
      ...f,
      stocked: e.target.value
    })),
    style: {
      fontSize: 12
    }
  }, React.createElement("option", {
    value: ""
  }, "Whole index"), React.createElement("option", {
    value: "1"
  }, "Only what we stock")) : null))), React.createElement("div", {
    style: MK.card
  }, React.createElement("div", {
    style: MK.cardHead
  }, React.createElement("div", {
    style: MK.h3
  }, searching ? 'Search results' : kind === 'generic' ? 'Generics' : 'Brands', !searching && data.total ? React.createElement("span", {
    style: {
      fontWeight: 500,
      color: MK.MUTED,
      fontSize: 12
    }
  }, " \xB7 ", data.total.toLocaleString(), " found") : null), !searching && data.pages > 1 ? React.createElement("div", {
    style: {
      display: 'flex',
      gap: 7,
      alignItems: 'center'
    }
  }, React.createElement("button", {
    style: MK.btnGhost,
    disabled: page <= 1,
    onClick: () => setPage(p => Math.max(1, p - 1))
  }, "Previous"), React.createElement("span", {
    style: {
      fontSize: 12,
      color: MK.MUTED,
      fontFamily: MK.MONO
    }
  }, page, " / ", data.pages), React.createElement("button", {
    style: MK.btnGhost,
    disabled: page >= data.pages,
    onClick: () => setPage(p => p + 1)
  }, "Next")) : null), React.createElement("div", {
    style: {
      overflowX: 'auto'
    }
  }, data.loading && !searching ? React.createElement("div", {
    style: {
      padding: 34,
      textAlign: 'center',
      color: MK.FAINT,
      fontSize: 12.5
    }
  }, "Loading the index\u2026") : null, !data.loading || searching ? rows.length ? React.createElement("table", {
    className: "tbl",
    style: {
      width: '100%',
      fontSize: 12.5
    }
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", {
    style: {
      textAlign: 'left'
    }
  }, kind === 'generic' ? 'Generic' : 'Brand'), kind === 'brand' ? React.createElement("th", {
    style: {
      textAlign: 'left'
    }
  }, "Strength") : null, kind === 'brand' ? React.createElement("th", {
    style: {
      textAlign: 'left'
    }
  }, "Form") : null, React.createElement("th", {
    style: {
      textAlign: 'left'
    }
  }, kind === 'generic' ? 'Class' : 'Generic'), React.createElement("th", {
    style: {
      textAlign: 'left'
    }
  }, kind === 'generic' ? 'Brands' : 'Manufacturer'), React.createElement("th", {
    style: {
      textAlign: 'right'
    }
  }, kind === 'generic' ? 'Forms' : 'Unit price'))), React.createElement("tbody", null, rows.map(r => React.createElement("tr", {
    key: r.id,
    style: {
      cursor: 'pointer'
    },
    onClick: () => setRoute(kind === 'generic' ? {
      view: 'medGeneric',
      id: r.id
    } : {
      view: 'medBrand',
      id: r.id
    })
  }, React.createElement("td", {
    style: {
      fontWeight: 700,
      color: MK.INK
    }
  }, React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 9
    }
  }, kind === 'brand' ? React.createElement(DrugImage, {
    brand: r,
    size: 30
  }) : null, React.createElement("span", null, r.name, " ", React.createElement(TypeChip, {
    type: r.type
  }), " ", React.createElement(StockChip, {
    brand: r
  }), " ", React.createElement(PregChip, {
    cat: r.pregnancyCategory
  })))), kind === 'brand' ? React.createElement("td", {
    style: {
      fontFamily: MK.MONO,
      fontSize: 11.5
    }
  }, r.strength || '—') : null, kind === 'brand' ? React.createElement("td", null, r.form || '—') : null, React.createElement("td", {
    style: {
      color: MK.MUTED
    }
  }, kind === 'generic' ? r.drugClass || '—' : r.generic || '—'), React.createElement("td", {
    style: {
      color: MK.MUTED
    }
  }, kind === 'generic' ? r.brands || 0 : r.manufacturer || '—'), React.createElement("td", {
    style: {
      textAlign: 'right',
      fontFamily: MK.MONO,
      fontSize: 11.5
    }
  }, kind === 'generic' ? (r.forms || []).slice(0, 2).join(', ') || '—' : money(r.price && r.price.unit)))))) : React.createElement(MedEmpty, {
    title: "Nothing matches these filters",
    note: "Try clearing a filter, or search by name above."
  }) : null)));
}
function MonographSections({
  generic
}) {
  const mono = generic && generic.monograph || {};
  const present = SECTION_ORDER.filter(k => mono[k]);
  const [open, setOpen] = useState(() => present.slice(0, 4));
  if (!present.length) return React.createElement(MedEmpty, {
    icon: I.doc,
    title: "No monograph recorded for this generic"
  });
  const toggle = k => setOpen(o => o.indexOf(k) >= 0 ? o.filter(x => x !== k) : o.concat(k));
  return React.createElement("div", null, React.createElement("div", {
    style: {
      display: 'flex',
      gap: 7,
      marginBottom: 12,
      flexWrap: 'wrap'
    }
  }, React.createElement("button", {
    style: MK.btnGhost,
    onClick: () => setOpen(present)
  }, "Expand all"), React.createElement("button", {
    style: MK.btnGhost,
    onClick: () => setOpen([])
  }, "Collapse all")), present.map(k => {
    const isOpen = open.indexOf(k) >= 0;
    const danger = k === 'contraindications' || k === 'interaction' || k === 'overdose';
    return React.createElement("div", {
      key: k,
      style: {
        border: '1px solid ' + MK.LINE,
        borderRadius: 10,
        marginBottom: 8,
        overflow: 'hidden',
        background: '#fff'
      }
    }, React.createElement("button", {
      onClick: () => toggle(k),
      style: {
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        padding: '11px 14px',
        border: 0,
        background: danger ? 'rgba(210,58,82,.05)' : 'rgba(125,145,180,.05)',
        cursor: 'pointer',
        textAlign: 'left'
      }
    }, React.createElement("span", {
      style: {
        fontSize: 12.5,
        fontWeight: 800,
        color: danger ? '#d23a52' : MK.INK
      }
    }, SECTION_LABEL[k] || k), React.createElement("span", {
      style: {
        color: MK.FAINT,
        transform: isOpen ? 'rotate(90deg)' : 'none',
        transition: 'transform .15s'
      }
    }, React.createElement(Ic, {
      d: I.chevR,
      s: 14
    }))), isOpen ? React.createElement("div", {
      style: {
        padding: '13px 15px',
        fontSize: 12.5,
        lineHeight: 1.65,
        color: MK.BODY
      }
    }, React.createElement(Monograph, {
      html: generic.monograph[k]
    })) : null);
  }));
}
function GenericHeader({
  generic,
  extra
}) {
  if (!generic) return null;
  return React.createElement("div", {
    style: {
      ...MK.card,
      marginBottom: 14
    }
  }, React.createElement("div", {
    style: {
      padding: '20px 22px'
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: 14,
      flexWrap: 'wrap',
      alignItems: 'flex-start'
    }
  }, React.createElement("div", null, React.createElement("div", {
    style: {
      fontSize: 21,
      fontWeight: 800,
      color: MK.INK
    }
  }, generic.name), React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: MK.MUTED,
      marginTop: 3
    }
  }, generic.drugClass || 'Generic', generic.indication ? ' · ' + generic.indication : '')), extra), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 7,
      marginTop: 13,
      flexWrap: 'wrap'
    }
  }, React.createElement("span", {
    style: MK.gchip('blue')
  }, generic.brands || 0, " brands"), React.createElement(PregChip, {
    cat: generic.pregnancyCategory,
    big: true
  }), React.createElement(AbxChip, {
    on: generic.abx
  }), generic.manufacturers ? React.createElement("span", {
    style: MK.gchip('slate')
  }, generic.manufacturers, " companies") : null, (generic.forms || []).slice(0, 6).map(f => React.createElement("span", {
    key: f,
    style: MK.gchip('teal')
  }, f)))));
}
function MedGeneric({
  id,
  setRoute
}) {
  const [d, setD] = useState({
    loading: true
  });
  const fav = useFavourites();
  useEffect(() => {
    setD({
      loading: true
    });
    medApi.get('/api/med/generic/' + encodeURIComponent(id)).then(r => {
      setD({
        loading: false,
        ...r
      });
      if (r && r.ok) pushRecent({
        id: r.generic.id,
        kind: 'generic',
        name: r.generic.name,
        sub: r.generic.drugClass
      });
    }).catch(() => setD({
      loading: false,
      ok: false
    }));
  }, [id]);
  if (d.loading) return React.createElement("div", {
    style: MK.page
  }, React.createElement("div", {
    style: {
      padding: 40,
      textAlign: 'center',
      color: MK.FAINT
    }
  }, "Loading\u2026"));
  if (!d.ok) return React.createElement("div", {
    style: MK.page
  }, React.createElement("div", {
    style: MK.card
  }, React.createElement(MedEmpty, {
    title: "Generic not found"
  })));
  const g = d.generic;
  return React.createElement("div", {
    style: MK.page
  }, React.createElement("button", {
    style: {
      ...MK.btnGhost,
      marginBottom: 12
    },
    onClick: () => setRoute({
      view: 'medBrowse'
    })
  }, "\u2190 Back to the index"), React.createElement(GenericHeader, {
    generic: g,
    extra: React.createElement("div", {
      style: {
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap'
      }
    }, React.createElement(FavStar, {
      entry: {
        id: g.id,
        kind: 'generic',
        name: g.name,
        sub: g.drugClass
      },
      fav: fav
    }), React.createElement("button", {
      style: MK.btnGhost,
      onClick: () => window.print()
    }, React.createElement(Ic, {
      d: I.print,
      s: 14
    }), "Print"), React.createElement("button", {
      style: MK.btnPri,
      onClick: () => setRoute({
        view: 'medRxNew',
        id: g.id
      })
    }, React.createElement(Ic, {
      d: I.plus,
      s: 14
    }), "Prescribe"))
  }), React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1.55fr) minmax(0,1fr)',
      gap: 14,
      alignItems: 'start'
    },
    className: "med-2col"
  }, React.createElement("div", {
    style: MK.card
  }, React.createElement("div", {
    style: MK.cardHead
  }, React.createElement("div", {
    style: MK.h3
  }, "Monograph")), React.createElement("div", {
    style: MK.cardBody
  }, React.createElement(MonographSections, {
    generic: g
  }))), React.createElement("div", {
    style: MK.card
  }, React.createElement("div", {
    style: MK.cardHead
  }, React.createElement("div", {
    style: MK.h3
  }, "Brands ", React.createElement("span", {
    style: {
      fontWeight: 500,
      color: MK.MUTED,
      fontSize: 12
    }
  }, "\xB7 cheapest first"))), React.createElement("div", {
    style: {
      maxHeight: 620,
      overflowY: 'auto'
    }
  }, React.createElement("table", {
    className: "tbl",
    style: {
      width: '100%',
      fontSize: 12
    }
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", {
    style: {
      textAlign: 'left'
    }
  }, "Brand"), React.createElement("th", {
    style: {
      textAlign: 'left'
    }
  }, "Company"), React.createElement("th", {
    style: {
      textAlign: 'right'
    }
  }, "Price"))), React.createElement("tbody", null, (d.brands || []).map(b => React.createElement("tr", {
    key: b.id,
    style: {
      cursor: 'pointer'
    },
    onClick: () => setRoute({
      view: 'medBrand',
      id: b.id
    })
  }, React.createElement("td", null, React.createElement("span", {
    style: {
      fontWeight: 700,
      color: MK.INK
    }
  }, b.name), React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: MK.FAINT
    }
  }, b.strength, " ", b.form)), React.createElement("td", {
    style: {
      color: MK.MUTED,
      fontSize: 11
    }
  }, b.manufacturer), React.createElement("td", {
    style: {
      textAlign: 'right',
      fontFamily: MK.MONO,
      fontSize: 11.5
    }
  }, money(b.price && b.price.unit))))))), React.createElement("div", {
    style: {
      padding: '9px 15px',
      borderTop: '1px solid ' + MK.LINE
    }
  }, React.createElement(PriceNote, null)))));
}
function BrandAdminPanel({
  brand,
  onChanged
}) {
  const [f, setF] = useState({
    stocked: !!brand.stocked,
    preferred: !!brand.preferred,
    formularyNote: brand.formularyNote || ''
  });
  const save = () => medApi.put('/api/med/brand/' + brand.id + '/formulary', f).then(r => {
    if (r && r.ok) {
      medToast('Formulary updated');
      onChanged && onChanged();
    } else medToast(r && r.error || 'Could not update.', 'error');
  }).catch(() => medToast('Could not reach the server.', 'error'));
  return React.createElement("div", {
    style: {
      ...MK.card,
      marginBottom: 14
    }
  }, React.createElement("div", {
    style: MK.cardHead
  }, React.createElement("div", {
    style: MK.h3
  }, "Hospital record")), React.createElement("div", {
    style: {
      padding: '15px 19px',
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))',
      gap: 18
    }
  }, React.createElement("div", null, React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 800,
      textTransform: 'uppercase',
      letterSpacing: .5,
      color: MK.FAINT,
      marginBottom: 8
    }
  }, "Photograph"), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      alignItems: 'flex-start'
    }
  }, React.createElement(DrugImage, {
    brand: brand,
    size: 64
  }), React.createElement(ImageUploader, {
    brand: brand,
    onChanged: onChanged
  }))), React.createElement("div", null, React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 800,
      textTransform: 'uppercase',
      letterSpacing: .5,
      color: MK.FAINT,
      marginBottom: 8
    }
  }, "Formulary"), React.createElement("label", {
    style: {
      display: 'flex',
      gap: 8,
      alignItems: 'center',
      fontSize: 12.5,
      color: MK.BODY,
      marginBottom: 6,
      cursor: 'pointer'
    }
  }, React.createElement("input", {
    type: "checkbox",
    checked: f.stocked,
    onChange: e => setF({
      ...f,
      stocked: e.target.checked
    })
  }), "We stock this brand"), React.createElement("label", {
    style: {
      display: 'flex',
      gap: 8,
      alignItems: 'center',
      fontSize: 12.5,
      color: MK.BODY,
      marginBottom: 8,
      cursor: 'pointer'
    }
  }, React.createElement("input", {
    type: "checkbox",
    checked: f.preferred,
    onChange: e => setF({
      ...f,
      preferred: e.target.checked,
      stocked: e.target.checked || f.stocked
    })
  }), "Preferred first choice"), React.createElement("input", {
    className: "inp",
    style: {
      width: '100%',
      fontSize: 12
    },
    placeholder: "Note (e.g. ward stock only)",
    value: f.formularyNote,
    onChange: e => setF({
      ...f,
      formularyNote: e.target.value
    })
  }), React.createElement("button", {
    style: {
      ...MK.btnPri,
      marginTop: 9
    },
    onClick: save
  }, "Save"))));
}
function MedBrand({
  id,
  setRoute
}) {
  const [d, setD] = useState({
    loading: true
  });
  const fav = useFavourites();
  const load = useCallback(() => medApi.get('/api/med/brand/' + encodeURIComponent(id)).then(r => {
    setD({
      loading: false,
      ...r
    });
    if (r && r.ok) pushRecent({
      id: r.brand.id,
      kind: 'brand',
      name: r.brand.name,
      sub: [r.brand.strength, r.brand.form].filter(Boolean).join(' ')
    });
  }).catch(() => setD({
    loading: false,
    ok: false
  })), [id]);
  useEffect(() => {
    setD({
      loading: true
    });
    load();
  }, [load]);
  if (d.loading) return React.createElement("div", {
    style: MK.page
  }, React.createElement("div", {
    style: {
      padding: 40,
      textAlign: 'center',
      color: MK.FAINT
    }
  }, "Loading\u2026"));
  if (!d.ok) return React.createElement("div", {
    style: MK.page
  }, React.createElement("div", {
    style: MK.card
  }, React.createElement(MedEmpty, {
    title: "Brand not found"
  })));
  const b = d.brand,
    g = d.generic;
  const cheaper = (d.alternatives || []).filter(a => a.price && b.price && a.price.unit != null && b.price.unit != null && a.price.unit < b.price.unit);
  return React.createElement("div", {
    style: MK.page
  }, React.createElement("button", {
    style: {
      ...MK.btnGhost,
      marginBottom: 12
    },
    onClick: () => setRoute({
      view: 'medBrowse'
    })
  }, "\u2190 Back to the index"), React.createElement("div", {
    style: {
      ...MK.card,
      marginBottom: 14
    }
  }, React.createElement("div", {
    style: {
      padding: '20px 22px'
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: 14,
      flexWrap: 'wrap',
      alignItems: 'flex-start'
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      gap: 15,
      alignItems: 'flex-start'
    }
  }, React.createElement(DrugImage, {
    brand: b,
    size: 78
  }), React.createElement("div", null, React.createElement("div", {
    style: {
      fontSize: 22,
      fontWeight: 800,
      color: MK.INK
    }
  }, b.name, " ", React.createElement("span", {
    style: {
      fontWeight: 500,
      color: MK.MUTED,
      fontSize: 16
    }
  }, b.strength), " ", React.createElement(TypeChip, {
    type: b.type
  })), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      flexWrap: 'wrap',
      margin: '6px 0 2px'
    }
  }, React.createElement(StockChip, {
    brand: b
  }), React.createElement(PregChip, {
    cat: b.pregnancyCategory
  }), React.createElement(AbxChip, {
    on: b.abx
  })), React.createElement("div", {
    style: {
      fontSize: 13,
      color: MK.MUTED,
      marginTop: 4
    }
  }, b.form ? b.form + ' · ' : '', g ? React.createElement("a", {
    style: {
      color: '#0090ca',
      cursor: 'pointer',
      fontWeight: 600
    },
    onClick: () => setRoute({
      view: 'medGeneric',
      id: g.id
    })
  }, b.generic) : b.generic), React.createElement("div", {
    style: {
      fontSize: 12,
      color: MK.FAINT,
      marginTop: 3
    }
  }, b.manufacturer))), React.createElement("div", {
    style: {
      textAlign: 'right'
    }
  }, React.createElement("div", {
    style: {
      fontSize: 24,
      fontWeight: 800,
      color: MK.INK,
      fontFamily: MK.MONO
    }
  }, money(b.price && b.price.unit)), React.createElement("div", {
    style: {
      fontSize: 11,
      color: MK.MUTED
    }
  }, b.price && b.price.unitLabel || 'unit price'), React.createElement("div", {
    style: {
      marginTop: 3
    }
  }, React.createElement(PriceNote, null)), React.createElement("button", {
    style: {
      ...MK.btnPri,
      marginTop: 10
    },
    onClick: () => setRoute({
      view: 'medRxNew',
      id: b.id
    })
  }, React.createElement(Ic, {
    d: I.plus,
    s: 14
  }), "Prescribe"), React.createElement("div", {
    style: {
      marginTop: 10,
      display: 'flex',
      justifyContent: 'flex-end'
    }
  }, React.createElement(FavStar, {
    entry: {
      id: b.id,
      kind: 'brand',
      name: b.name,
      sub: b.strength + ' ' + (b.form || '')
    },
    fav: fav
  })))), (b.price && b.price.packs || []).length ? React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginTop: 14,
      flexWrap: 'wrap'
    }
  }, b.price.packs.map((p, i) => React.createElement("span", {
    key: i,
    style: {
      ...MK.gchip('slate'),
      fontFamily: MK.MONO
    }
  }, p.label, ": ", money(p.price)))) : null)), cheaper.length ? React.createElement("div", {
    style: {
      ...MK.card,
      marginBottom: 14,
      border: '1px solid rgba(31,157,87,.3)'
    }
  }, React.createElement("div", {
    style: {
      padding: '13px 18px',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      flexWrap: 'wrap'
    }
  }, React.createElement(Ic, {
    d: I.trend,
    s: 16
  }), React.createElement("span", {
    style: {
      fontSize: 12.5,
      color: MK.BODY
    }
  }, React.createElement("strong", null, cheaper.length), " cheaper brand", cheaper.length === 1 ? '' : 's', " carry the same generic \u2014 the cheapest is", ' ', React.createElement("a", {
    style: {
      color: '#0090ca',
      cursor: 'pointer',
      fontWeight: 700
    },
    onClick: () => setRoute({
      view: 'medBrand',
      id: cheaper[0].id
    })
  }, cheaper[0].name), ' ', "at ", money(cheaper[0].price.unit), "."))) : null, medIsAdmin() ? React.createElement(BrandAdminPanel, {
    brand: b,
    onChanged: load
  }) : null, React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1.55fr) minmax(0,1fr)',
      gap: 14,
      alignItems: 'start'
    },
    className: "med-2col"
  }, React.createElement("div", {
    style: MK.card
  }, React.createElement("div", {
    style: MK.cardHead
  }, React.createElement("div", {
    style: MK.h3
  }, "Monograph ", React.createElement("span", {
    style: {
      fontWeight: 500,
      color: MK.MUTED,
      fontSize: 12
    }
  }, "\xB7 ", b.generic))), React.createElement("div", {
    style: MK.cardBody
  }, g ? React.createElement(MonographSections, {
    generic: g
  }) : React.createElement(MedEmpty, {
    title: "No generic linked to this brand"
  }))), React.createElement("div", {
    style: MK.card
  }, React.createElement("div", {
    style: MK.cardHead
  }, React.createElement("div", {
    style: MK.h3
  }, "Same generic ", React.createElement("span", {
    style: {
      fontWeight: 500,
      color: MK.MUTED,
      fontSize: 12
    }
  }, "\xB7 ", (d.alternatives || []).length))), React.createElement("div", {
    style: {
      maxHeight: 560,
      overflowY: 'auto'
    }
  }, React.createElement("table", {
    className: "tbl",
    style: {
      width: '100%',
      fontSize: 12
    }
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", {
    style: {
      textAlign: 'left'
    }
  }, "Brand"), React.createElement("th", {
    style: {
      textAlign: 'left'
    }
  }, "Company"), React.createElement("th", {
    style: {
      textAlign: 'right'
    }
  }, "Price"))), React.createElement("tbody", null, (d.alternatives || []).map(a => React.createElement("tr", {
    key: a.id,
    style: {
      cursor: 'pointer'
    },
    onClick: () => setRoute({
      view: 'medBrand',
      id: a.id
    })
  }, React.createElement("td", null, React.createElement("span", {
    style: {
      fontWeight: 700,
      color: MK.INK
    }
  }, a.name), React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: MK.FAINT
    }
  }, a.strength, " ", a.form)), React.createElement("td", {
    style: {
      color: MK.MUTED,
      fontSize: 11
    }
  }, a.manufacturer), React.createElement("td", {
    style: {
      textAlign: 'right',
      fontFamily: MK.MONO,
      fontSize: 11.5
    }
  }, money(a.price && a.price.unit))))))), React.createElement("div", {
    style: {
      padding: '9px 15px',
      borderTop: '1px solid ' + MK.LINE
    }
  }, React.createElement(PriceNote, null)))));
}
const blankRx = () => ({
  uhid: '',
  patientName: '',
  age: '',
  sex: '',
  weight: '',
  phone: '',
  address: '',
  allergies: '',
  date: today(),
  dept: '',
  deptName: '',
  complaints: '',
  findings: '',
  diagnosis: '',
  investigations: '',
  advice: '',
  followUp: '',
  items: [],
  status: 'draft',
  doctorName: '',
  doctorQualification: '',
  doctorDesignation: '',
  doctorReg: '',
  acknowledged: false
});
function WarningPanel({
  warnings,
  acknowledged,
  onAck,
  hideAck
}) {
  if (!warnings || !warnings.length) return null;
  const crit = warnings.filter(w => w.severity === 'critical');
  const high = warnings.filter(w => w.severity === 'high' || w.severity === 'critical');
  return React.createElement("div", {
    style: {
      ...MK.card,
      marginBottom: 13,
      border: '1px solid ' + (high.length ? 'rgba(210,58,82,.35)' : 'rgba(224,138,30,.3)')
    }
  }, React.createElement("div", {
    style: {
      ...MK.cardHead,
      background: high.length ? 'rgba(210,58,82,.06)' : 'rgba(224,138,30,.06)'
    }
  }, React.createElement("div", {
    style: {
      ...MK.h3,
      color: high.length ? '#d23a52' : '#e08a1e'
    }
  }, crit.length ? crit.length + ' ALLERGY CLASH' + (crit.length === 1 ? '' : 'ES') + (high.length > crit.length ? ' + ' + (high.length - crit.length) + ' more' : '') : high.length ? high.length + ' interaction / duplication warning' + (high.length === 1 ? '' : 's') : 'Prescribing notes')), React.createElement("div", {
    style: {
      padding: '12px 16px'
    }
  }, warnings.map((w, i) => React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      gap: 10,
      padding: '8px 0',
      borderBottom: i < warnings.length - 1 ? '1px solid ' + MK.LINE : 0
    }
  }, React.createElement("span", {
    style: {
      ...MK.gchip(w.severity === 'critical' || w.severity === 'high' ? 'red' : 'slate'),
      flexShrink: 0,
      height: 20
    }
  }, w.kind === 'allergy' ? 'ALLERGY' : w.kind === 'duplicate' ? 'DUPLICATE' : w.severity === 'high' ? 'INTERACTION' : 'NOTE'), React.createElement("div", null, React.createElement("div", {
    style: {
      fontSize: 12.5,
      fontWeight: 700,
      color: MK.INK
    }
  }, w.title), React.createElement("div", {
    style: {
      fontSize: 12,
      color: MK.BODY,
      lineHeight: 1.55,
      marginTop: 2
    }
  }, w.detail), w.source ? React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: MK.FAINT,
      marginTop: 2
    }
  }, "from the ", w.source) : null))), high.length && !hideAck ? React.createElement("label", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      marginTop: 12,
      fontSize: 12.5,
      color: MK.BODY,
      cursor: 'pointer'
    }
  }, React.createElement("input", {
    type: "checkbox",
    checked: !!acknowledged,
    onChange: e => onAck(e.target.checked)
  }), "I have reviewed these warnings and intend to prescribe as written.") : null, React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: MK.FAINT,
      marginTop: 10,
      lineHeight: 1.5
    }
  }, "These notes are drawn from the generic monographs in this index. They are a prompt to check, not a clinical decision \u2014 the prescriber remains responsible.")));
}
function RxItemRow({
  item,
  idx,
  onChange,
  onRemove,
  onOpen
}) {
  const set = (k, v) => onChange({
    ...item,
    [k]: v
  });
  return React.createElement("div", {
    style: {
      border: '1px solid ' + MK.LINE,
      borderRadius: 10,
      padding: '11px 13px',
      marginBottom: 9,
      background: '#fff'
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: 10,
      alignItems: 'flex-start',
      marginBottom: 9
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      alignItems: 'flex-start'
    }
  }, React.createElement(DrugImage, {
    brand: {
      id: item.brandId,
      name: item.brand || item.generic,
      form: item.form,
      hasImage: item.hasImage
    },
    size: 34
  }), React.createElement("div", null, React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 800,
      color: MK.INK
    }
  }, React.createElement("span", {
    style: {
      fontFamily: MK.MONO,
      color: MK.FAINT,
      marginRight: 6
    }
  }, idx + 1, "."), item.brand || item.generic, " ", item.strength ? React.createElement("span", {
    style: {
      fontWeight: 500,
      color: MK.MUTED
    }
  }, item.strength) : null), React.createElement("div", {
    style: {
      fontSize: 11,
      color: MK.MUTED,
      marginTop: 2
    }
  }, item.form ? item.form + ' · ' : '', item.brand && item.generic && item.brand !== item.generic ? item.generic : ''))), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6
    }
  }, item.genericId ? React.createElement("button", {
    style: {
      ...MK.btnGhost,
      padding: '4px 9px',
      fontSize: 11
    },
    onClick: () => onOpen(item.genericId)
  }, "Monograph") : null, React.createElement("button", {
    style: {
      ...MK.btnGhost,
      padding: '4px 9px',
      fontSize: 11,
      color: '#d23a52'
    },
    onClick: onRemove
  }, React.createElement(Ic, {
    d: I.x,
    s: 12
  })))), React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(122px,1fr))',
      gap: 7
    }
  }, React.createElement("input", {
    className: "inp",
    style: {
      fontSize: 12
    },
    placeholder: "Dose (1 tab)",
    value: item.dose,
    onChange: e => set('dose', e.target.value)
  }), React.createElement("input", {
    className: "inp",
    style: {
      fontSize: 12
    },
    placeholder: "Frequency",
    list: "rx-freq",
    value: item.frequency,
    onChange: e => set('frequency', e.target.value)
  }), React.createElement("input", {
    className: "inp",
    style: {
      fontSize: 12
    },
    placeholder: "Timing",
    list: "rx-timing",
    value: item.timing,
    onChange: e => set('timing', e.target.value)
  }), React.createElement("input", {
    className: "inp",
    style: {
      fontSize: 12
    },
    placeholder: "Duration",
    list: "rx-duration",
    value: item.duration,
    onChange: e => set('duration', e.target.value)
  }), React.createElement("input", {
    className: "inp",
    style: {
      fontSize: 12
    },
    placeholder: "Qty",
    value: item.quantity,
    onChange: e => set('quantity', e.target.value)
  })), React.createElement("input", {
    className: "inp",
    style: {
      fontSize: 12,
      marginTop: 7,
      width: '100%'
    },
    placeholder: "Special instruction (optional)",
    value: item.instruction,
    onChange: e => set('instruction', e.target.value)
  }));
}
function RxEditor({
  rxId,
  seedId,
  setRoute
}) {
  const [rx, setRx] = useState(blankRx);
  const [q, setQ] = useState('');
  const [warnings, setWarnings] = useState([]);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [history, setHistory] = useState([]);
  const [monoFor, setMonoFor] = useState(null);
  const set = (k, v) => setRx(r => ({
    ...r,
    [k]: v
  }));
  useEffect(() => {
    if (rxId) return;
    try {
      const u = window.__UNICO_USER__;
      const sig = window.unicoSig && window.unicoSig.get ? window.unicoSig.get() : null;
      setRx(r => ({
        ...r,
        doctorName: u && u.name || sig && sig.prepared || ''
      }));
    } catch (e) {}
  }, [rxId]);
  useEffect(() => {
    medApi.get('/api/rx-templates').then(r => setTemplates(r && r.templates || [])).catch(() => {});
  }, []);
  useEffect(() => {
    if (!rxId) return;
    medApi.get('/api/prescriptions/' + encodeURIComponent(rxId)).then(r => {
      if (r && r.ok) setRx({
        ...blankRx(),
        ...r.prescription
      });
    }).catch(() => {});
  }, [rxId]);
  useEffect(() => {
    if (!seedId || rxId) return;
    const url = seedId.indexOf('gen-') === 0 ? '/api/med/generic/' + seedId : '/api/med/brand/' + seedId;
    medApi.get(url).then(r => {
      if (!r || !r.ok) return;
      if (r.brand) addBrand(r.brand);else if (r.generic) addGeneric(r.generic);
    }).catch(() => {});
  }, [seedId, rxId]);
  useEffect(() => {
    const u = String(rx.uhid || '').trim();
    if (u.length < 3) {
      setHistory([]);
      return;
    }
    const t = setTimeout(() => {
      medApi.get('/api/prescriptions?' + qs({
        uhid: u,
        limit: 8
      })).then(r => setHistory(r && r.prescriptions || [])).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [rx.uhid]);
  const genericKey = useMemo(() => rx.items.map(i => i.genericId).filter(Boolean).join(','), [rx.items]);
  useEffect(() => {
    const ids = genericKey ? genericKey.split(',') : [];
    if (!ids.length) {
      setWarnings([]);
      return;
    }
    const t = setTimeout(() => {
      medApi.post('/api/med/check', {
        genericIds: ids,
        allergies: rx.allergies
      }).then(r => setWarnings(r && r.warnings || [])).catch(() => setWarnings([]));
    }, 250);
    return () => clearTimeout(t);
  }, [genericKey, rx.allergies]);
  const addItem = it => setRx(r => ({
    ...r,
    items: r.items.concat([{
      dose: '',
      frequency: '',
      timing: '',
      duration: '',
      quantity: '',
      instruction: '',
      ...it
    }])
  }));
  const addBrand = b => addItem({
    brandId: b.id,
    brand: b.name,
    generic: b.generic,
    genericId: b.genericId,
    strength: b.strength,
    form: b.form
  });
  const addGeneric = g => addItem({
    generic: g.name,
    genericId: g.id,
    form: (g.forms || [])[0] || ''
  });
  const onPick = p => {
    if (p.kind === 'brand') addBrand(p.doc);else addGeneric(p.doc);
    setQ('');
  };
  const setItem = (i, v) => setRx(r => ({
    ...r,
    items: r.items.map((x, n) => n === i ? v : x)
  }));
  const delItem = i => setRx(r => ({
    ...r,
    items: r.items.filter((_, n) => n !== i)
  }));
  const applyTemplate = t => {
    setRx(r => ({
      ...r,
      diagnosis: r.diagnosis || t.diagnosis || '',
      advice: r.advice || t.advice || '',
      investigations: r.investigations || t.investigations || '',
      items: r.items.concat(t.items || [])
    }));
    medToast('Template “' + t.name + '” added');
  };
  const repeat = id => {
    medApi.get('/api/prescriptions/' + encodeURIComponent(id)).then(r => {
      if (!r || !r.ok) return;
      setRx(cur => ({
        ...cur,
        items: cur.items.concat(r.prescription.items || []),
        diagnosis: cur.diagnosis || r.prescription.diagnosis || ''
      }));
      medToast('Previous prescription copied onto the pad');
    }).catch(() => {});
  };
  const highWarnings = warnings.filter(w => w.severity === 'high' || w.severity === 'critical');
  const save = status => {
    if (!String(rx.patientName || '').trim()) {
      medToast('A patient name is required.', 'error');
      return;
    }
    if (status === 'issued') {
      if (!rx.items.length) {
        medToast('Add at least one drug before issuing.', 'error');
        return;
      }
      if (highWarnings.length && !rx.acknowledged) {
        medToast('Review and acknowledge the warnings before issuing.', 'error');
        return;
      }
    }
    setSaving(true);
    medApi.put('/api/prescriptions', {
      ...rx,
      id: rxId || undefined,
      status,
      warnings
    }).then(r => {
      setSaving(false);
      if (!r || !r.ok) {
        medToast(r && r.error || 'Could not save.', 'error');
        return;
      }
      medToast(status === 'issued' ? 'Prescription issued' : 'Draft saved');
      if (status === 'issued') setRoute({
        view: 'medRxPrint',
        rx: r.prescription.id
      });else setRoute({
        view: 'medRxNew',
        rx: r.prescription.id
      });
    }).catch(() => {
      setSaving(false);
      medToast('Could not reach the server.', 'error');
    });
  };
  const locked = rx.status === 'issued';
  return React.createElement("div", {
    style: MK.page
  }, React.createElement("datalist", {
    id: "rx-freq"
  }, FREQ.map(f => React.createElement("option", {
    key: f,
    value: f
  }))), React.createElement("datalist", {
    id: "rx-timing"
  }, TIMING.map(f => React.createElement("option", {
    key: f,
    value: f
  }))), React.createElement("datalist", {
    id: "rx-duration"
  }, DURATION.map(f => React.createElement("option", {
    key: f,
    value: f
  }))), locked ? React.createElement("div", {
    style: {
      ...MK.card,
      marginBottom: 13,
      border: '1px solid rgba(31,157,87,.35)'
    }
  }, React.createElement("div", {
    style: {
      padding: '12px 17px',
      fontSize: 12.5,
      color: MK.BODY,
      display: 'flex',
      gap: 10,
      alignItems: 'center',
      flexWrap: 'wrap'
    }
  }, React.createElement("span", {
    style: MK.gchip('green')
  }, "ISSUED"), "This prescription has been issued and is a clinical record \u2014 it can be printed but not edited. Write a new one to change it.", React.createElement("button", {
    style: MK.btnPri,
    onClick: () => setRoute({
      view: 'medRxPrint',
      rx: rxId
    })
  }, React.createElement(Ic, {
    d: I.print,
    s: 13
  }), "Print"))) : null, React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)',
      gap: 14,
      alignItems: 'start'
    },
    className: "med-2col"
  }, React.createElement("div", null, React.createElement("div", {
    style: {
      ...MK.card,
      marginBottom: 13
    }
  }, React.createElement("div", {
    style: MK.cardHead
  }, React.createElement("div", {
    style: MK.h3
  }, "Patient"), React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: MK.MUTED,
      fontFamily: MK.MONO
    }
  }, rx.date)), React.createElement("div", {
    style: {
      padding: '15px 18px'
    }
  }, React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))',
      gap: 9
    }
  }, React.createElement("input", {
    className: "inp",
    placeholder: "UHID",
    value: rx.uhid,
    disabled: locked,
    onChange: e => set('uhid', e.target.value)
  }), React.createElement("input", {
    className: "inp",
    placeholder: "Patient name *",
    value: rx.patientName,
    disabled: locked,
    onChange: e => set('patientName', e.target.value)
  }), React.createElement("input", {
    className: "inp",
    placeholder: "Age",
    value: rx.age,
    disabled: locked,
    onChange: e => set('age', e.target.value)
  }), React.createElement("select", {
    className: "inp",
    value: rx.sex,
    disabled: locked,
    onChange: e => set('sex', e.target.value)
  }, React.createElement("option", {
    value: ""
  }, "Sex"), React.createElement("option", null, "Male"), React.createElement("option", null, "Female"), React.createElement("option", null, "Other")), React.createElement("input", {
    className: "inp",
    placeholder: "Weight (kg)",
    value: rx.weight,
    disabled: locked,
    onChange: e => set('weight', e.target.value)
  }), React.createElement("input", {
    className: "inp",
    placeholder: "Phone",
    value: rx.phone,
    disabled: locked,
    onChange: e => set('phone', e.target.value)
  })), React.createElement("input", {
    className: "inp",
    style: {
      width: '100%',
      marginTop: 9
    },
    placeholder: "Known allergies \u2014 written on the printed prescription",
    value: rx.allergies,
    disabled: locked,
    onChange: e => set('allergies', e.target.value)
  }), rx.allergies ? React.createElement("div", {
    style: {
      marginTop: 8,
      padding: '8px 11px',
      background: 'rgba(210,58,82,.07)',
      borderRadius: 8,
      fontSize: 12,
      color: '#d23a52',
      fontWeight: 600
    }
  }, "Allergy on record: ", rx.allergies) : null)), React.createElement("div", {
    style: {
      ...MK.card,
      marginBottom: 13
    }
  }, React.createElement("div", {
    style: MK.cardHead
  }, React.createElement("div", {
    style: MK.h3
  }, "Clinical")), React.createElement("div", {
    style: {
      padding: '15px 18px',
      display: 'grid',
      gap: 9
    }
  }, React.createElement("textarea", {
    className: "inp",
    rows: 2,
    placeholder: "Chief complaints",
    value: rx.complaints,
    disabled: locked,
    onChange: e => set('complaints', e.target.value)
  }), React.createElement("textarea", {
    className: "inp",
    rows: 2,
    placeholder: "On examination / findings",
    value: rx.findings,
    disabled: locked,
    onChange: e => set('findings', e.target.value)
  }), React.createElement("textarea", {
    className: "inp",
    rows: 2,
    placeholder: "Diagnosis",
    value: rx.diagnosis,
    disabled: locked,
    onChange: e => set('diagnosis', e.target.value)
  }), React.createElement("textarea", {
    className: "inp",
    rows: 2,
    placeholder: "Investigations advised",
    value: rx.investigations,
    disabled: locked,
    onChange: e => set('investigations', e.target.value)
  }))), React.createElement("div", {
    style: cardOpen({
      marginBottom: 13
    })
  }, React.createElement("div", {
    style: MK.cardHead
  }, React.createElement("div", {
    style: MK.h3
  }, React.createElement("span", {
    style: {
      fontFamily: 'serif',
      fontSize: 19,
      marginRight: 5
    }
  }, "\u211E"), "Medication ", React.createElement("span", {
    style: {
      fontWeight: 500,
      color: MK.MUTED,
      fontSize: 12
    }
  }, "\xB7 ", rx.items.length))), React.createElement("div", {
    style: {
      padding: '15px 18px'
    }
  }, !locked ? React.createElement("div", {
    style: {
      marginBottom: 13
    }
  }, React.createElement(DrugSearchBox, {
    value: q,
    onChange: setQ,
    onPick: onPick,
    placeholder: "Add a drug \u2014 search brand or generic"
  })) : null, rx.items.length ? rx.items.map((it, i) => React.createElement(RxItemRow, {
    key: i,
    item: it,
    idx: i,
    onChange: v => setItem(i, v),
    onRemove: () => delItem(i),
    onOpen: setMonoFor
  })) : React.createElement(MedEmpty, {
    icon: I.plus,
    title: "No drugs on the pad yet",
    note: "Search above, or drop in one of your saved templates."
  }))), React.createElement("div", {
    style: {
      ...MK.card,
      marginBottom: 13
    }
  }, React.createElement("div", {
    style: MK.cardHead
  }, React.createElement("div", {
    style: MK.h3
  }, "Advice & follow-up")), React.createElement("div", {
    style: {
      padding: '15px 18px',
      display: 'grid',
      gap: 9
    }
  }, React.createElement("textarea", {
    className: "inp",
    rows: 3,
    placeholder: "Advice to the patient",
    value: rx.advice,
    disabled: locked,
    onChange: e => set('advice', e.target.value)
  }), React.createElement("input", {
    className: "inp",
    placeholder: "Follow-up (e.g. after 7 days)",
    value: rx.followUp,
    disabled: locked,
    onChange: e => set('followUp', e.target.value)
  }))), React.createElement("div", {
    style: {
      ...MK.card,
      marginBottom: 13
    }
  }, React.createElement("div", {
    style: MK.cardHead
  }, React.createElement("div", {
    style: MK.h3
  }, "Prescriber")), React.createElement("div", {
    style: {
      padding: '15px 18px',
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))',
      gap: 9
    }
  }, React.createElement("input", {
    className: "inp",
    placeholder: "Doctor's name",
    value: rx.doctorName,
    disabled: locked,
    onChange: e => set('doctorName', e.target.value)
  }), React.createElement("input", {
    className: "inp",
    placeholder: "Qualification (MBBS, FCPS)",
    value: rx.doctorQualification,
    disabled: locked,
    onChange: e => set('doctorQualification', e.target.value)
  }), React.createElement("input", {
    className: "inp",
    placeholder: "Designation",
    value: rx.doctorDesignation,
    disabled: locked,
    onChange: e => set('doctorDesignation', e.target.value)
  }), React.createElement("input", {
    className: "inp",
    placeholder: "BMDC registration no.",
    value: rx.doctorReg,
    disabled: locked,
    onChange: e => set('doctorReg', e.target.value)
  }), React.createElement("input", {
    className: "inp",
    placeholder: "Department / unit",
    value: rx.deptName,
    disabled: locked,
    onChange: e => set('deptName', e.target.value)
  }))), !locked ? React.createElement("div", {
    style: {
      display: 'flex',
      gap: 9,
      flexWrap: 'wrap',
      marginBottom: 20
    }
  }, React.createElement("button", {
    style: MK.btnGhost,
    disabled: saving,
    onClick: () => save('draft')
  }, "Save draft"), React.createElement("button", {
    style: MK.btnPri,
    disabled: saving,
    onClick: () => save('issued')
  }, React.createElement(Ic, {
    d: I.check,
    s: 14
  }), "Issue & print"), highWarnings.length && !rx.acknowledged ? React.createElement("span", {
    style: {
      fontSize: 11.5,
      color: '#d23a52',
      alignSelf: 'center'
    }
  }, "Acknowledge the warnings to issue.") : null) : null), React.createElement("div", null, React.createElement(WarningPanel, {
    warnings: warnings,
    acknowledged: rx.acknowledged,
    onAck: v => set('acknowledged', v)
  }), history.length ? React.createElement("div", {
    style: {
      ...MK.card,
      marginBottom: 13
    }
  }, React.createElement("div", {
    style: MK.cardHead
  }, React.createElement("div", {
    style: MK.h3
  }, "This patient's history")), React.createElement("div", {
    style: {
      padding: '10px 15px'
    }
  }, history.map(h => React.createElement("div", {
    key: h.id,
    style: {
      padding: '8px 0',
      borderBottom: '1px solid ' + MK.LINE
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: 8
    }
  }, React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: MK.INK
    }
  }, h.date), !locked ? React.createElement("button", {
    style: {
      ...MK.btnGhost,
      padding: '2px 8px',
      fontSize: 10.5
    },
    onClick: () => repeat(h.id)
  }, "Repeat") : null), React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: MK.MUTED,
      marginTop: 2
    }
  }, h.diagnosis || '—'), React.createElement("div", {
    style: {
      fontSize: 11,
      color: MK.FAINT
    }
  }, (h.items || []).map(i => i.brand || i.generic).join(', '), h.itemCount > 3 ? ' +' + (h.itemCount - 3) : ''))))) : null, !locked && templates.length ? React.createElement("div", {
    style: {
      ...MK.card,
      marginBottom: 13
    }
  }, React.createElement("div", {
    style: MK.cardHead
  }, React.createElement("div", {
    style: MK.h3
  }, "Templates")), React.createElement("div", {
    style: {
      padding: '10px 15px'
    }
  }, templates.map(t => React.createElement("button", {
    key: t.id,
    onClick: () => applyTemplate(t),
    style: {
      display: 'block',
      width: '100%',
      textAlign: 'left',
      padding: '8px 10px',
      marginBottom: 5,
      border: '1px solid ' + MK.LINE,
      borderRadius: 8,
      background: '#fff',
      cursor: 'pointer'
    }
  }, React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: MK.INK
    }
  }, t.name), React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: MK.MUTED
    }
  }, (t.items || []).length, " drug", (t.items || []).length === 1 ? '' : 's', t.note ? ' · ' + t.note : ''))))) : null, monoFor ? React.createElement(MonoDrawer, {
    id: monoFor,
    onClose: () => setMonoFor(null)
  }) : null)));
}
function MonoDrawer({
  id,
  onClose
}) {
  const [g, setG] = useState(null);
  useEffect(() => {
    medApi.get('/api/med/generic/' + encodeURIComponent(id)).then(r => setG(r && r.ok ? r.generic : null)).catch(() => setG(null));
  }, [id]);
  if (!g) return null;
  const b = g.brief || {};
  return React.createElement("div", {
    style: {
      ...MK.card,
      marginBottom: 13
    }
  }, React.createElement("div", {
    style: MK.cardHead
  }, React.createElement("div", {
    style: MK.h3
  }, g.name), React.createElement("button", {
    style: {
      ...MK.btnGhost,
      padding: '3px 8px'
    },
    onClick: onClose
  }, React.createElement(Ic, {
    d: I.x,
    s: 12
  }))), React.createElement("div", {
    style: {
      padding: '13px 16px',
      fontSize: 12,
      lineHeight: 1.6,
      color: MK.BODY
    }
  }, [['Dosage', b.dosage], ['Interactions', b.interaction], ['Contraindications', b.contra], ['Pregnancy', b.pregnancy]].map(([k, v]) => v ? React.createElement("div", {
    key: k,
    style: {
      marginBottom: 11
    }
  }, React.createElement("div", {
    style: {
      fontSize: 10.5,
      fontWeight: 800,
      letterSpacing: .5,
      textTransform: 'uppercase',
      color: MK.FAINT,
      marginBottom: 3
    }
  }, k), React.createElement("div", null, v.slice(0, 600), v.length > 600 ? '…' : '')) : null)));
}
function RxRows({
  rows,
  setRoute
}) {
  return React.createElement("table", {
    className: "tbl",
    style: {
      width: '100%',
      fontSize: 12.5
    }
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", {
    style: {
      textAlign: 'left'
    }
  }, "Date"), React.createElement("th", {
    style: {
      textAlign: 'left'
    }
  }, "Patient"), React.createElement("th", {
    style: {
      textAlign: 'left'
    }
  }, "Diagnosis"), React.createElement("th", {
    style: {
      textAlign: 'left'
    }
  }, "Drugs"), React.createElement("th", {
    style: {
      textAlign: 'left'
    }
  }, "Doctor"), React.createElement("th", {
    style: {
      textAlign: 'right'
    }
  }, "Status"))), React.createElement("tbody", null, rows.map(r => React.createElement("tr", {
    key: r.id,
    style: {
      cursor: 'pointer'
    },
    onClick: () => setRoute({
      view: r.status === 'issued' ? 'medRxPrint' : 'medRxNew',
      rx: r.id
    })
  }, React.createElement("td", {
    style: {
      fontFamily: MK.MONO,
      fontSize: 11.5
    }
  }, r.date), React.createElement("td", null, React.createElement("span", {
    style: {
      fontWeight: 700,
      color: MK.INK
    }
  }, r.patientName), React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: MK.FAINT
    }
  }, r.uhid ? 'UHID ' + r.uhid : '', r.age ? ' · ' + r.age : '', r.sex ? ' · ' + r.sex : '')), React.createElement("td", {
    style: {
      color: MK.MUTED
    }
  }, r.diagnosis || '—'), React.createElement("td", {
    style: {
      color: MK.MUTED,
      fontSize: 11.5
    }
  }, (r.items || []).map(i => i.brand || i.generic).join(', ') || '—', r.itemCount > 3 ? React.createElement("span", {
    style: {
      color: MK.FAINT
    }
  }, " +", r.itemCount - 3) : null), React.createElement("td", {
    style: {
      color: MK.MUTED,
      fontSize: 11.5
    }
  }, r.doctorName || '—'), React.createElement("td", {
    style: {
      textAlign: 'right'
    }
  }, React.createElement("span", {
    style: MK.gchip(r.status === 'issued' ? 'green' : r.status === 'cancelled' ? 'red' : 'amber')
  }, r.status || 'draft'))))));
}
function MedRxList({
  setRoute
}) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    setLoading(true);
    medApi.get('/api/prescriptions?' + qs({
      q,
      status,
      limit: 200
    })).then(r => {
      setRows(r && r.prescriptions || []);
      setLoading(false);
    }).catch(() => {
      setRows([]);
      setLoading(false);
    });
  }, [q, status]);
  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);
  return React.createElement("div", {
    style: MK.page
  }, React.createElement("div", {
    style: {
      ...MK.card,
      marginBottom: 13
    }
  }, React.createElement("div", {
    style: {
      padding: '15px 18px',
      display: 'flex',
      gap: 9,
      flexWrap: 'wrap',
      alignItems: 'center'
    }
  }, React.createElement("input", {
    className: "inp",
    style: {
      flex: 1,
      minWidth: 220
    },
    placeholder: "Search by patient name, UHID or diagnosis",
    value: q,
    onChange: e => setQ(e.target.value)
  }), React.createElement("select", {
    className: "inp",
    value: status,
    onChange: e => setStatus(e.target.value),
    style: {
      fontSize: 12
    }
  }, React.createElement("option", {
    value: ""
  }, "All statuses"), React.createElement("option", {
    value: "draft"
  }, "Drafts"), React.createElement("option", {
    value: "issued"
  }, "Issued"), React.createElement("option", {
    value: "cancelled"
  }, "Cancelled")), React.createElement("button", {
    style: MK.btnPri,
    onClick: () => setRoute({
      view: 'medRxNew'
    })
  }, React.createElement(Ic, {
    d: I.plus,
    s: 14
  }), "New prescription"))), React.createElement("div", {
    style: MK.card
  }, React.createElement("div", {
    style: MK.cardHead
  }, React.createElement("div", {
    style: MK.h3
  }, "Prescriptions ", React.createElement("span", {
    style: {
      fontWeight: 500,
      color: MK.MUTED,
      fontSize: 12
    }
  }, "\xB7 ", rows.length))), React.createElement("div", {
    style: {
      overflowX: 'auto'
    }
  }, loading ? React.createElement("div", {
    style: {
      padding: 34,
      textAlign: 'center',
      color: MK.FAINT,
      fontSize: 12.5
    }
  }, "Loading\u2026") : rows.length ? React.createElement(RxRows, {
    rows: rows,
    setRoute: setRoute
  }) : React.createElement(MedEmpty, {
    icon: I.doc,
    title: "No prescriptions found",
    note: "Nothing matches this search."
  }))));
}
function MedRxPrint({
  rxId,
  setRoute
}) {
  const [rx, setRx] = useState(null);
  useEffect(() => {
    medApi.get('/api/prescriptions/' + encodeURIComponent(rxId)).then(r => setRx(r && r.ok ? r.prescription : null)).catch(() => setRx(null));
  }, [rxId]);
  if (!rx) return React.createElement("div", {
    style: MK.page
  }, React.createElement("div", {
    style: {
      padding: 40,
      textAlign: 'center',
      color: MK.FAINT
    }
  }, "Loading\u2026"));
  const line = it => [it.dose, it.frequency, it.timing, it.duration].filter(Boolean).join('  —  ');
  return React.createElement("div", {
    style: MK.page
  }, React.createElement("div", {
    style: {
      display: 'flex',
      gap: 9,
      marginBottom: 13,
      flexWrap: 'wrap'
    },
    className: "no-print"
  }, React.createElement("button", {
    style: MK.btnGhost,
    onClick: () => setRoute({
      view: 'medRxList'
    })
  }, "\u2190 Prescriptions"), React.createElement("button", {
    style: MK.btnPri,
    onClick: () => window.print()
  }, React.createElement(Ic, {
    d: I.print,
    s: 14
  }), "Print / Save as PDF")), React.createElement("div", {
    id: "pdf-root",
    style: {
      background: '#fff',
      color: '#111',
      padding: '26px 30px',
      borderRadius: 8,
      maxWidth: 860,
      margin: '0 auto',
      fontSize: 13
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      borderBottom: '2px solid #0072a3',
      paddingBottom: 12,
      marginBottom: 14
    }
  }, React.createElement("div", null, React.createElement("div", {
    style: {
      fontSize: 20,
      fontWeight: 800,
      color: '#0072a3'
    }
  }, "UNICO Healthcare"), React.createElement("div", {
    style: {
      fontSize: 11,
      color: '#555'
    }
  }, "Prescription")), React.createElement("div", {
    style: {
      textAlign: 'right',
      fontSize: 11.5,
      color: '#333'
    }
  }, React.createElement("div", null, React.createElement("strong", null, rx.doctorName || '—')), rx.doctorQualification ? React.createElement("div", null, rx.doctorQualification) : null, rx.doctorDesignation ? React.createElement("div", null, rx.doctorDesignation) : null, rx.doctorReg ? React.createElement("div", null, "BMDC Reg. ", rx.doctorReg) : null, rx.deptName ? React.createElement("div", null, rx.deptName) : null)), React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4,1fr)',
      gap: 8,
      fontSize: 12,
      marginBottom: 12,
      paddingBottom: 10,
      borderBottom: '1px solid #ddd'
    }
  }, React.createElement("div", null, React.createElement("span", {
    style: {
      color: '#777'
    }
  }, "Name: "), React.createElement("strong", null, rx.patientName)), React.createElement("div", null, React.createElement("span", {
    style: {
      color: '#777'
    }
  }, "UHID: "), rx.uhid || '—'), React.createElement("div", null, React.createElement("span", {
    style: {
      color: '#777'
    }
  }, "Age/Sex: "), [rx.age, rx.sex].filter(Boolean).join(' / ') || '—'), React.createElement("div", null, React.createElement("span", {
    style: {
      color: '#777'
    }
  }, "Date: "), rx.date)), rx.allergies ? React.createElement("div", {
    style: {
      padding: '7px 11px',
      border: '1.5px solid #d23a52',
      color: '#d23a52',
      borderRadius: 5,
      fontSize: 12,
      fontWeight: 700,
      marginBottom: 12
    }
  }, "ALLERGIES: ", rx.allergies) : null, React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 2fr',
      gap: 20
    }
  }, React.createElement("div", {
    style: {
      borderRight: '1px solid #ddd',
      paddingRight: 16,
      fontSize: 12
    }
  }, [['Chief complaints', rx.complaints], ['On examination', rx.findings], ['Diagnosis', rx.diagnosis], ['Investigations', rx.investigations]].map(([k, v]) => v ? React.createElement("div", {
    key: k,
    style: {
      marginBottom: 11
    }
  }, React.createElement("div", {
    style: {
      fontSize: 10,
      fontWeight: 800,
      textTransform: 'uppercase',
      letterSpacing: .5,
      color: '#0072a3',
      marginBottom: 3
    }
  }, k), React.createElement("div", {
    style: {
      whiteSpace: 'pre-wrap',
      lineHeight: 1.5
    }
  }, v)) : null)), React.createElement("div", null, React.createElement("div", {
    style: {
      fontFamily: 'serif',
      fontSize: 30,
      fontWeight: 700,
      color: '#0072a3',
      lineHeight: 1,
      marginBottom: 10
    }
  }, "\u211E"), (rx.items || []).map((it, i) => React.createElement("div", {
    key: i,
    style: {
      marginBottom: 12,
      paddingBottom: 9,
      borderBottom: '1px dotted #ccc'
    }
  }, React.createElement("div", {
    style: {
      fontSize: 13.5,
      fontWeight: 700
    }
  }, i + 1, ". ", it.brand || it.generic, " ", it.strength ? React.createElement("span", {
    style: {
      fontWeight: 400
    }
  }, it.strength) : null, it.form ? React.createElement("span", {
    style: {
      fontWeight: 400,
      color: '#666',
      fontSize: 11.5
    }
  }, " (", it.form, ")") : null), it.brand && it.generic && it.brand !== it.generic ? React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: '#777',
      fontStyle: 'italic'
    }
  }, it.generic) : null, React.createElement("div", {
    style: {
      fontSize: 12.5,
      marginTop: 3,
      marginLeft: 15
    }
  }, line(it) || '—', it.quantity ? '   ·   Qty ' + it.quantity : ''), it.instruction ? React.createElement("div", {
    style: {
      fontSize: 11.5,
      marginLeft: 15,
      color: '#444',
      fontStyle: 'italic'
    }
  }, it.instruction) : null)), !(rx.items || []).length ? React.createElement("div", {
    style: {
      color: '#999',
      fontSize: 12
    }
  }, "No medication prescribed.") : null)), rx.advice ? React.createElement("div", {
    style: {
      marginTop: 16,
      paddingTop: 11,
      borderTop: '1px solid #ddd',
      fontSize: 12
    }
  }, React.createElement("div", {
    style: {
      fontSize: 10,
      fontWeight: 800,
      textTransform: 'uppercase',
      letterSpacing: .5,
      color: '#0072a3',
      marginBottom: 3
    }
  }, "Advice"), React.createElement("div", {
    style: {
      whiteSpace: 'pre-wrap',
      lineHeight: 1.5
    }
  }, rx.advice)) : null, React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginTop: 30
    }
  }, React.createElement("div", {
    style: {
      fontSize: 12
    }
  }, rx.followUp ? React.createElement("span", null, React.createElement("strong", null, "Follow-up:"), " ", rx.followUp) : null), React.createElement("div", {
    style: {
      textAlign: 'center',
      minWidth: 200
    }
  }, React.createElement("div", {
    style: {
      borderTop: '1px solid #333',
      paddingTop: 5,
      fontSize: 11.5
    }
  }, React.createElement("strong", null, rx.doctorName || ''), rx.doctorQualification ? React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: '#555'
    }
  }, rx.doctorQualification) : null, React.createElement("div", {
    style: {
      fontSize: 10,
      color: '#777'
    }
  }, "Signature of the prescriber")))), React.createElement("div", {
    style: {
      marginTop: 16,
      paddingTop: 8,
      borderTop: '1px solid #eee',
      fontSize: 9,
      color: '#999',
      lineHeight: 1.5
    }
  }, "Generated by UNICO Healthcare \xB7 ", rx.date, " \xB7 Ref ", rx.id, React.createElement("br", null), "Drug information from a public-domain Bangladesh medicine index (2022 snapshot); prices where shown are indicative. Not a substitute for the prescriber's clinical judgement.")));
}
function MedTemplates({
  setRoute
}) {
  const [rows, setRows] = useState([]);
  const [edit, setEdit] = useState(null);
  const [q, setQ] = useState('');
  const load = () => medApi.get('/api/rx-templates').then(r => setRows(r && r.templates || [])).catch(() => {});
  useEffect(() => {
    load();
  }, []);
  const save = () => {
    if (!String(edit.name || '').trim()) {
      medToast('Give the template a name.', 'error');
      return;
    }
    medApi.put('/api/rx-templates', edit).then(r => {
      if (r && r.ok) {
        medToast('Template saved');
        setEdit(null);
        load();
      } else medToast(r && r.error || 'Could not save.', 'error');
    }).catch(() => medToast('Could not reach the server.', 'error'));
  };
  const remove = id => medApi.del('/api/rx-templates/' + id).then(() => {
    medToast('Template deleted');
    load();
  }).catch(() => {});
  if (edit) {
    const addItem = p => {
      const d = p.doc;
      const it = p.kind === 'brand' ? {
        brandId: d.id,
        brand: d.name,
        generic: d.generic,
        genericId: d.genericId,
        strength: d.strength,
        form: d.form
      } : {
        generic: d.name,
        genericId: d.id,
        form: (d.forms || [])[0] || ''
      };
      setEdit(e => ({
        ...e,
        items: (e.items || []).concat([{
          dose: '',
          frequency: '',
          timing: '',
          duration: '',
          quantity: '',
          instruction: '',
          ...it
        }])
      }));
      setQ('');
    };
    return React.createElement("div", {
      style: MK.page
    }, React.createElement("div", {
      style: cardOpen()
    }, React.createElement("div", {
      style: MK.cardHead
    }, React.createElement("div", {
      style: MK.h3
    }, edit.id ? 'Edit template' : 'New template'), React.createElement("div", {
      style: {
        display: 'flex',
        gap: 8
      }
    }, React.createElement("button", {
      style: MK.btnGhost,
      onClick: () => setEdit(null)
    }, "Cancel"), React.createElement("button", {
      style: MK.btnPri,
      onClick: save
    }, "Save template"))), React.createElement("div", {
      style: {
        padding: '16px 19px',
        display: 'grid',
        gap: 10
      }
    }, React.createElement("input", {
      className: "inp",
      placeholder: "Template name \u2014 e.g. URTI adult, Post-op day 1",
      value: edit.name || '',
      onChange: e => setEdit({
        ...edit,
        name: e.target.value
      })
    }), React.createElement("input", {
      className: "inp",
      placeholder: "Note (optional)",
      value: edit.note || '',
      onChange: e => setEdit({
        ...edit,
        note: e.target.value
      })
    }), React.createElement("input", {
      className: "inp",
      placeholder: "Default diagnosis (optional)",
      value: edit.diagnosis || '',
      onChange: e => setEdit({
        ...edit,
        diagnosis: e.target.value
      })
    }), React.createElement("textarea", {
      className: "inp",
      rows: 2,
      placeholder: "Default advice (optional)",
      value: edit.advice || '',
      onChange: e => setEdit({
        ...edit,
        advice: e.target.value
      })
    }), React.createElement("div", null, React.createElement("div", {
      style: {
        fontSize: 11,
        fontWeight: 800,
        textTransform: 'uppercase',
        letterSpacing: .5,
        color: MK.FAINT,
        margin: '6px 0 7px'
      }
    }, "Drugs"), React.createElement(DrugSearchBox, {
      value: q,
      onChange: setQ,
      onPick: addItem,
      placeholder: "Add a drug to this template"
    }), React.createElement("div", {
      style: {
        marginTop: 11
      }
    }, (edit.items || []).map((it, i) => React.createElement(RxItemRow, {
      key: i,
      item: it,
      idx: i,
      onChange: v => setEdit(e => ({
        ...e,
        items: e.items.map((x, n) => n === i ? v : x)
      })),
      onRemove: () => setEdit(e => ({
        ...e,
        items: e.items.filter((_, n) => n !== i)
      })),
      onOpen: () => {}
    })))))));
  }
  return React.createElement("div", {
    style: MK.page
  }, React.createElement("div", {
    style: MK.card
  }, React.createElement("div", {
    style: MK.cardHead
  }, React.createElement("div", {
    style: MK.h3
  }, "Prescription templates ", React.createElement("span", {
    style: {
      fontWeight: 500,
      color: MK.MUTED,
      fontSize: 12
    }
  }, "\xB7 ", rows.length)), React.createElement("button", {
    style: MK.btnPri,
    onClick: () => setEdit({
      name: '',
      items: []
    })
  }, React.createElement(Ic, {
    d: I.plus,
    s: 14
  }), "New template")), React.createElement("div", {
    style: MK.cardBody
  }, rows.length ? React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))',
      gap: 11
    }
  }, rows.map(t => React.createElement("div", {
    key: t.id,
    style: {
      border: '1px solid ' + MK.LINE,
      borderRadius: 11,
      padding: '13px 15px',
      background: '#fff'
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: 8,
      alignItems: 'flex-start'
    }
  }, React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 800,
      color: MK.INK
    }
  }, t.name), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 5
    }
  }, React.createElement("button", {
    style: {
      ...MK.btnGhost,
      padding: '3px 8px',
      fontSize: 10.5
    },
    onClick: () => setEdit(t)
  }, "Edit"), React.createElement("button", {
    style: {
      ...MK.btnGhost,
      padding: '3px 8px',
      fontSize: 10.5,
      color: '#d23a52'
    },
    onClick: () => remove(t.id)
  }, React.createElement(Ic, {
    d: I.x,
    s: 11
  })))), t.note ? React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: MK.MUTED,
      marginTop: 3
    }
  }, t.note) : null, React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: MK.BODY,
      marginTop: 8,
      lineHeight: 1.55
    }
  }, (t.items || []).map(i => i.brand || i.generic).join(', ') || 'No drugs yet')))) : React.createElement(MedEmpty, {
    icon: I.star,
    title: "No templates yet",
    note: "A template is a drug set you prescribe often \u2014 save it once and drop it onto the pad in a click.",
    action: React.createElement("button", {
      style: MK.btnPri,
      onClick: () => setEdit({
        name: '',
        items: []
      })
    }, "Create one")
  }))));
}
function MedCatalog({
  setRoute
}) {
  const [q, setQ] = useState('');
  const [pick, setPick] = useState(null);
  const [form, setForm] = useState(null);
  const admin = medIsAdmin();
  const open = p => {
    if (p.kind === 'brand') {
      medApi.get('/api/med/brand/' + p.doc.id).then(r => {
        if (!r || !r.ok) return;
        setPick({
          kind: 'brand',
          doc: r.brand
        });
        setForm({
          name: r.brand.name,
          strength: r.brand.strength,
          form: r.brand.form,
          manufacturer: r.brand.manufacturer,
          unit: r.brand.price && r.brand.price.unit || '',
          unitLabel: r.brand.price && r.brand.price.unitLabel || ''
        });
      });
    } else {
      medApi.get('/api/med/generic/' + p.doc.id).then(r => {
        if (!r || !r.ok) return;
        setPick({
          kind: 'generic',
          doc: r.generic
        });
        setForm({
          name: r.generic.name,
          drugClass: r.generic.drugClass,
          monograph: {
            ...(r.generic.monograph || {})
          }
        });
      });
    }
  };
  const save = () => {
    if (pick.kind === 'brand') {
      medApi.put('/api/med/brand/' + pick.doc.id, {
        name: form.name,
        strength: form.strength,
        form: form.form,
        manufacturer: form.manufacturer,
        price: {
          unit: form.unit === '' ? null : Number(form.unit),
          unitLabel: form.unitLabel,
          raw: '',
          packs: pick.doc.price && pick.doc.price.packs || []
        }
      }).then(r => {
        if (r && r.ok) {
          medToast('Brand updated — it will survive the next import');
          setPick(null);
        } else medToast(r && r.error || 'Could not save.', 'error');
      });
    } else {
      medApi.put('/api/med/generic/' + pick.doc.id, {
        name: form.name,
        drugClass: form.drugClass,
        monograph: form.monograph
      }).then(r => {
        if (r && r.ok) {
          medToast('Monograph updated');
          setPick(null);
        } else medToast(r && r.error || 'Could not save.', 'error');
      });
    }
  };
  if (!admin) {
    return React.createElement("div", {
      style: MK.page
    }, React.createElement("div", {
      style: MK.card
    }, React.createElement(MedEmpty, {
      icon: I.gear,
      title: "Administrator access required",
      note: "The drug catalogue is shared by everyone who prescribes, so corrections to it are made by an administrator."
    })));
  }
  return React.createElement("div", {
    style: MK.page
  }, React.createElement("div", {
    style: cardOpen({
      marginBottom: 13
    })
  }, React.createElement("div", {
    style: {
      padding: '16px 19px'
    }
  }, React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 800,
      color: MK.INK,
      marginBottom: 4
    }
  }, "Drug catalogue"), React.createElement("div", {
    style: {
      ...MK.sub,
      marginBottom: 13
    }
  }, "Correct a price, a strength or a monograph. Anything you change here is marked as locally edited and is left alone the next time the index is re-imported."), React.createElement(DrugSearchBox, {
    value: q,
    onChange: setQ,
    onPick: open,
    placeholder: "Find the brand or generic to correct"
  }))), pick ? React.createElement("div", {
    style: MK.card
  }, React.createElement("div", {
    style: MK.cardHead
  }, React.createElement("div", {
    style: MK.h3
  }, pick.doc.name, " ", React.createElement("span", {
    style: {
      fontWeight: 500,
      color: MK.MUTED,
      fontSize: 12
    }
  }, "\xB7 ", pick.kind)), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, React.createElement("button", {
    style: MK.btnGhost,
    onClick: () => setPick(null)
  }, "Cancel"), React.createElement("button", {
    style: MK.btnPri,
    onClick: save
  }, "Save correction"))), React.createElement("div", {
    style: {
      padding: '16px 19px',
      display: 'grid',
      gap: 10
    }
  }, pick.kind === 'brand' ? React.createElement(React.Fragment, null, React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))',
      gap: 9
    }
  }, React.createElement("input", {
    className: "inp",
    placeholder: "Brand name",
    value: form.name,
    onChange: e => setForm({
      ...form,
      name: e.target.value
    })
  }), React.createElement("input", {
    className: "inp",
    placeholder: "Strength",
    value: form.strength,
    onChange: e => setForm({
      ...form,
      strength: e.target.value
    })
  }), React.createElement("input", {
    className: "inp",
    placeholder: "Dosage form",
    value: form.form,
    onChange: e => setForm({
      ...form,
      form: e.target.value
    })
  }), React.createElement("input", {
    className: "inp",
    placeholder: "Manufacturer",
    value: form.manufacturer,
    onChange: e => setForm({
      ...form,
      manufacturer: e.target.value
    })
  }), React.createElement("input", {
    className: "inp",
    placeholder: "Unit price",
    value: form.unit,
    onChange: e => setForm({
      ...form,
      unit: e.target.value
    })
  }), React.createElement("input", {
    className: "inp",
    placeholder: "Unit label (e.g. 100 ml bottle)",
    value: form.unitLabel,
    onChange: e => setForm({
      ...form,
      unitLabel: e.target.value
    })
  })), React.createElement("div", {
    style: {
      fontSize: 11,
      color: MK.FAINT
    }
  }, "Original price string from the source: ", pick.doc.price && pick.doc.price.raw || '—')) : React.createElement(React.Fragment, null, React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))',
      gap: 9
    }
  }, React.createElement("input", {
    className: "inp",
    placeholder: "Generic name",
    value: form.name,
    onChange: e => setForm({
      ...form,
      name: e.target.value
    })
  }), React.createElement("input", {
    className: "inp",
    placeholder: "Drug class",
    value: form.drugClass,
    onChange: e => setForm({
      ...form,
      drugClass: e.target.value
    })
  })), SECTION_ORDER.filter(k => form.monograph[k] != null || k === 'dosage').map(k => React.createElement("div", {
    key: k
  }, React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 800,
      textTransform: 'uppercase',
      letterSpacing: .5,
      color: MK.FAINT,
      marginBottom: 4
    }
  }, SECTION_LABEL[k] || k), React.createElement("textarea", {
    className: "inp",
    rows: 3,
    style: {
      width: '100%',
      fontFamily: MK.MONO,
      fontSize: 11.5
    },
    value: form.monograph[k] || '',
    onChange: e => setForm({
      ...form,
      monograph: {
        ...form.monograph,
        [k]: e.target.value
      }
    })
  }))), React.createElement("div", {
    style: {
      fontSize: 11,
      color: MK.FAINT
    }
  }, "Basic HTML is allowed: <strong>, <ul>, <li>, <br>.")))) : null);
}
const FORM_SHAPE = form => {
  const f = String(form || '').toLowerCase();
  if (/capsule/.test(f)) return 'capsule';
  if (/syrup|suspension|solution|elixir|drops|oral liquid/.test(f)) return 'bottle';
  if (/injection|infusion|iv |im |vial|ampoule/.test(f)) return 'vial';
  if (/cream|ointment|gel|lotion|paste/.test(f)) return 'tube';
  if (/inhaler|inhalation|nebuliser|nebulizer|spray/.test(f)) return 'inhaler';
  if (/suppository|pessary/.test(f)) return 'supp';
  if (/powder|sachet|granule/.test(f)) return 'sachet';
  return 'tablet';
};
const hueOf = s => {
  let h = 0;
  String(s || '').split('').forEach(c => {
    h = (h * 31 + c.charCodeAt(0)) % 360;
  });
  return h;
};
function DrugGlyph({
  form,
  name,
  size
}) {
  const z = size || 46;
  const shape = FORM_SHAPE(form);
  const h = hueOf(name || form);
  const fill = 'hsl(' + h + ' 55% 62%)',
    dark = 'hsl(' + h + ' 52% 44%)';
  const box = {
    width: z,
    height: z,
    borderRadius: 10,
    background: 'hsl(' + h + ' 60% 96%)',
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0,
    border: '1px solid hsl(' + h + ' 40% 88%)'
  };
  const S = z * 0.62;
  const art = {
    tablet: React.createElement("g", null, React.createElement("circle", {
      cx: "12",
      cy: "12",
      r: "8.5",
      fill: fill
    }), React.createElement("path", {
      d: "M6 12h12",
      stroke: dark,
      strokeWidth: "1.6"
    })),
    capsule: React.createElement("g", null, React.createElement("rect", {
      x: "3.5",
      y: "8",
      width: "17",
      height: "8",
      rx: "4",
      fill: fill
    }), React.createElement("path", {
      d: "M12 8v8",
      stroke: dark,
      strokeWidth: "1.6"
    })),
    bottle: React.createElement("g", null, React.createElement("path", {
      d: "M9.5 3h5v3l2 3v11a1 1 0 01-1 1h-7a1 1 0 01-1-1V9l2-3z",
      fill: fill
    }), React.createElement("path", {
      d: "M7.5 13h9",
      stroke: dark,
      strokeWidth: "1.5"
    })),
    vial: React.createElement("g", null, React.createElement("path", {
      d: "M9 3h6v4l1.5 3v10a1 1 0 01-1 1h-7a1 1 0 01-1-1V10L9 7z",
      fill: fill
    }), React.createElement("path", {
      d: "M8.5 3h7",
      stroke: dark,
      strokeWidth: "1.8"
    })),
    tube: React.createElement("g", null, React.createElement("path", {
      d: "M8 4h8v2l2 12a2 2 0 01-2 2H8a2 2 0 01-2-2L8 6z",
      fill: fill
    }), React.createElement("path", {
      d: "M8 4h8",
      stroke: dark,
      strokeWidth: "2"
    })),
    inhaler: React.createElement("g", null, React.createElement("rect", {
      x: "7",
      y: "3",
      width: "7",
      height: "9",
      rx: "2",
      fill: dark
    }), React.createElement("path", {
      d: "M6 12h10a2 2 0 012 2v5a2 2 0 01-2 2H8a2 2 0 01-2-2z",
      fill: fill
    })),
    supp: React.createElement("g", null, React.createElement("path", {
      d: "M12 3c3 3 4.5 6 4.5 9.5S14.5 21 12 21s-4.5-5-4.5-8.5S9 6 12 3z",
      fill: fill
    })),
    sachet: React.createElement("g", null, React.createElement("path", {
      d: "M5 5h14v13a1 1 0 01-1 1H6a1 1 0 01-1-1z",
      fill: fill
    }), React.createElement("path", {
      d: "M5 8.5h14",
      stroke: dark,
      strokeWidth: "1.5"
    }))
  }[shape];
  return React.createElement("div", {
    style: box,
    title: form || 'Dosage form not recorded'
  }, React.createElement("svg", {
    width: S,
    height: S,
    viewBox: "0 0 24 24",
    fill: "none"
  }, art));
}
function DrugImage({
  brand,
  size,
  onClick
}) {
  const [failed, setFailed] = useState(false);
  const z = size || 46;
  if (!brand) return null;
  if (brand.hasImage && !failed) {
    return React.createElement("img", {
      src: '/api/med/image/' + encodeURIComponent(brand.id),
      alt: brand.name,
      onError: () => setFailed(true),
      onClick: onClick,
      style: {
        width: z,
        height: z,
        objectFit: 'cover',
        borderRadius: 10,
        flexShrink: 0,
        border: '1px solid ' + MK.LINE,
        cursor: onClick ? 'zoom-in' : 'default',
        background: '#fff'
      }
    });
  }
  return React.createElement(DrugGlyph, {
    form: brand.form,
    name: brand.name,
    size: z
  });
}
function resizeToDataUri(file, maxPx, quality) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('Could not read the file.'));
    fr.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('That file is not an image.'));
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale)),
          h = Math.max(1, Math.round(img.height * scale));
        const cv = document.createElement('canvas');
        cv.width = w;
        cv.height = h;
        const cx = cv.getContext('2d');
        cx.fillStyle = '#fff';
        cx.fillRect(0, 0, w, h);
        cx.drawImage(img, 0, 0, w, h);
        resolve(cv.toDataURL('image/jpeg', quality || 0.82));
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}
function ImageUploader({
  brand,
  onChanged
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const input = useRef(null);
  const pick = e => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setErr('');
    setBusy(true);
    resizeToDataUri(f, 900, 0.82).then(uri => medApi.put('/api/med/brand/' + brand.id + '/image', {
      image: uri
    })).then(r => {
      setBusy(false);
      if (r && r.ok) {
        medToast('Photo saved (' + Math.round(r.bytes / 1024) + ' KB)');
        onChanged && onChanged();
      } else setErr(r && r.error || 'Could not save the photo.');
    }).catch(e2 => {
      setBusy(false);
      setErr(e2.message || 'Could not process that image.');
    });
    e.target.value = '';
  };
  const remove = () => medApi.del('/api/med/brand/' + brand.id + '/image').then(() => {
    medToast('Photo removed');
    onChanged && onChanged();
  }).catch(() => {});
  return React.createElement("div", null, React.createElement("input", {
    ref: input,
    type: "file",
    accept: "image/*",
    capture: "environment",
    onChange: pick,
    style: {
      display: 'none'
    }
  }), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 7,
      flexWrap: 'wrap'
    }
  }, React.createElement("button", {
    style: MK.btnGhost,
    disabled: busy,
    onClick: () => input.current && input.current.click()
  }, React.createElement(Ic, {
    d: I.upload,
    s: 13
  }), busy ? 'Uploading…' : brand.hasImage ? 'Replace photo' : 'Add photo'), brand.hasImage ? React.createElement("button", {
    style: {
      ...MK.btnGhost,
      color: '#d23a52'
    },
    onClick: remove
  }, "Remove") : null), err ? React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: '#d23a52',
      marginTop: 6
    }
  }, err) : null, React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: MK.FAINT,
      marginTop: 6,
      lineHeight: 1.5
    }
  }, "Photograph the strip or pack. The picture is resized in your browser before it is stored, and it is yours \u2014 nothing is fetched from the internet."));
}
const PREG_TONE = {
  A: 'green',
  B: 'green',
  C: 'amber',
  D: 'red',
  X: 'red'
};
function PregChip({
  cat,
  big
}) {
  if (!cat) return null;
  const note = {
    A: 'no risk shown in studies',
    B: 'no evidence of risk in humans',
    C: 'risk cannot be ruled out',
    D: 'positive evidence of risk',
    X: 'contraindicated in pregnancy'
  }[cat] || '';
  return React.createElement("span", {
    style: MK.gchip(PREG_TONE[cat] || 'slate'),
    title: 'Pregnancy category ' + cat + ' — ' + note
  }, "Preg ", cat, big ? ' · ' + note : '');
}
const AbxChip = ({
  on
}) => on ? React.createElement("span", {
  style: MK.gchip('violet'),
  title: "Antibacterial \u2014 counts toward antibiotic stewardship reporting"
}, "Antibiotic") : null;
function StockChip({
  brand
}) {
  if (!brand) return null;
  if (brand.preferred) return React.createElement("span", {
    style: MK.gchip('green'),
    title: "Formulary preferred brand"
  }, "Preferred");
  if (brand.stocked) return React.createElement("span", {
    style: MK.gchip('teal'),
    title: "Stocked by this hospital"
  }, "In formulary");
  return null;
}
const FAV_KEY = 'unico_med_fav_v1',
  RECENT_KEY = 'unico_med_recent_v1';
const readLS = (k, dflt) => {
  try {
    const v = JSON.parse(localStorage.getItem(k) || 'null');
    return Array.isArray(v) ? v : dflt;
  } catch (e) {
    return dflt;
  }
};
const writeLS = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch (e) {}
};
function useFavourites() {
  const [favs, setFavs] = useState(() => readLS(FAV_KEY, []));
  const has = useCallback(id => favs.some(f => f.id === id), [favs]);
  const toggle = useCallback(entry => {
    setFavs(cur => {
      const next = cur.some(f => f.id === entry.id) ? cur.filter(f => f.id !== entry.id) : [entry].concat(cur).slice(0, 60);
      writeLS(FAV_KEY, next);
      return next;
    });
  }, []);
  return {
    favs,
    has,
    toggle
  };
}
const pushRecent = entry => {
  const cur = readLS(RECENT_KEY, []).filter(r => r.id !== entry.id);
  writeLS(RECENT_KEY, [entry].concat(cur).slice(0, 12));
};
function FavStar({
  entry,
  fav
}) {
  const on = fav.has(entry.id);
  return React.createElement("button", {
    onClick: () => fav.toggle(entry),
    title: on ? 'Remove from favourites' : 'Save to favourites',
    style: {
      ...MK.btnGhost,
      padding: '5px 10px',
      color: on ? '#e0a12a' : MK.MUTED
    }
  }, React.createElement(Ic, {
    d: I.star,
    s: 14,
    fill: on ? '#e0a12a' : 'none'
  }), on ? 'Saved' : 'Save');
}
function MedInteractions({
  setRoute
}) {
  const [picked, setPicked] = useState([]);
  const [allergies, setAllergies] = useState('');
  const [q, setQ] = useState('');
  const [warnings, setWarnings] = useState([]);
  const [checked, setChecked] = useState(false);
  const key = picked.map(p => p.genericId).join(',') + '|' + allergies;
  useEffect(() => {
    const ids = picked.map(p => p.genericId).filter(Boolean);
    if (!ids.length) {
      setWarnings([]);
      setChecked(false);
      return;
    }
    const t = setTimeout(() => {
      medApi.post('/api/med/check', {
        genericIds: ids,
        allergies
      }).then(r => {
        setWarnings(r && r.warnings || []);
        setChecked(true);
      }).catch(() => {
        setWarnings([]);
        setChecked(true);
      });
    }, 300);
    return () => clearTimeout(t);
  }, [key]);
  const add = p => {
    const d = p.doc;
    const entry = p.kind === 'brand' ? {
      id: d.id,
      label: d.name + ' ' + (d.strength || ''),
      generic: d.generic,
      genericId: d.genericId
    } : {
      id: d.id,
      label: d.name,
      generic: d.name,
      genericId: d.id
    };
    if (!entry.genericId) {
      medToast('That brand has no generic linked, so it cannot be checked.', 'error');
      return;
    }
    setPicked(cur => cur.concat([entry]));
    setQ('');
  };
  return React.createElement("div", {
    style: MK.page
  }, React.createElement("div", {
    style: cardOpen({
      marginBottom: 13
    })
  }, React.createElement("div", {
    style: {
      padding: '18px 21px'
    }
  }, React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 800,
      color: MK.INK,
      marginBottom: 3
    }
  }, "Interaction checker"), React.createElement("div", {
    style: {
      ...MK.sub,
      marginBottom: 14
    }
  }, "Add two or more drugs to see what their monographs say about giving them together, plus duplicate-generic and allergy checks."), React.createElement(DrugSearchBox, {
    value: q,
    onChange: setQ,
    onPick: add,
    placeholder: "Add a drug to check"
  }), picked.length ? React.createElement("div", {
    style: {
      display: 'flex',
      gap: 7,
      flexWrap: 'wrap',
      marginTop: 13
    }
  }, picked.map((p, i) => React.createElement("span", {
    key: i,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 7,
      padding: '5px 10px',
      borderRadius: 9,
      background: 'rgba(0,144,202,.09)',
      fontSize: 12,
      fontWeight: 600,
      color: MK.INK
    }
  }, p.label, React.createElement("button", {
    onClick: () => setPicked(c => c.filter((_, n) => n !== i)),
    style: {
      border: 0,
      background: 'transparent',
      cursor: 'pointer',
      color: MK.MUTED,
      padding: 0,
      display: 'flex'
    }
  }, React.createElement(Ic, {
    d: I.x,
    s: 12
  })))), React.createElement("button", {
    style: {
      ...MK.btnGhost,
      padding: '5px 10px',
      fontSize: 11.5
    },
    onClick: () => setPicked([])
  }, "Clear all")) : null, React.createElement("input", {
    className: "inp",
    style: {
      width: '100%',
      marginTop: 12
    },
    placeholder: "Known allergies (optional) \u2014 e.g. penicillin, sulpha",
    value: allergies,
    onChange: e => setAllergies(e.target.value)
  }))), picked.length >= 1 ? warnings.length ? React.createElement(WarningPanel, {
    warnings: warnings,
    acknowledged: true,
    onAck: () => {},
    hideAck: true
  }) : checked ? React.createElement("div", {
    style: {
      ...MK.card,
      border: '1px solid rgba(31,157,87,.3)'
    }
  }, React.createElement("div", {
    style: {
      padding: '18px 21px',
      display: 'flex',
      gap: 11,
      alignItems: 'center'
    }
  }, React.createElement(Ic, {
    d: I.check,
    s: 18
  }), React.createElement("div", null, React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: MK.INK
    }
  }, "Nothing flagged between these drugs"), React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: MK.MUTED,
      marginTop: 2
    }
  }, "Their monographs do not mention one another. Absence of a warning is not proof of safety \u2014 24% of generics carry no interaction section at all.")))) : null : React.createElement("div", {
    style: MK.card
  }, React.createElement(MedEmpty, {
    icon: I.activity,
    title: "Add drugs to check",
    note: "Search above. Two or more drugs are needed for an interaction check; one drug plus an allergy is enough for an allergy check."
  })));
}
function MedCalc() {
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [perKg, setPerKg] = useState('');
  const [perDay, setPerDay] = useState('3');
  const [maxDaily, setMaxDaily] = useState('');
  const [q, setQ] = useState('');
  const [gen, setGen] = useState(null);
  const w = parseFloat(weight),
    r = parseFloat(perKg),
    n = parseInt(perDay, 10) || 0,
    hgt = parseFloat(height);
  const daily = w > 0 && r > 0 ? w * r : null;
  const perDose = daily != null && n > 0 ? daily / n : null;
  const cap = parseFloat(maxDaily);
  const overCap = daily != null && cap > 0 && daily > cap;
  const bsa = w > 0 && hgt > 0 ? Math.sqrt(hgt * w / 3600) : null;
  const pick = p => {
    const id = p.kind === 'generic' ? p.doc.id : p.doc.genericId;
    if (!id) {
      medToast('No generic linked to that brand.', 'error');
      return;
    }
    medApi.get('/api/med/generic/' + id).then(res => {
      if (res && res.ok) setGen(res.generic);
    }).catch(() => {});
    setQ('');
  };
  return React.createElement("div", {
    style: MK.page
  }, React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.1fr)',
      gap: 14,
      alignItems: 'start'
    },
    className: "med-2col"
  }, React.createElement("div", {
    style: MK.card
  }, React.createElement("div", {
    style: MK.cardHead
  }, React.createElement("div", {
    style: MK.h3
  }, "Weight-based dose")), React.createElement("div", {
    style: {
      padding: '16px 19px',
      display: 'grid',
      gap: 10
    }
  }, React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 9
    }
  }, React.createElement("div", null, React.createElement("label", {
    style: lbl
  }, "Weight (kg)"), React.createElement("input", {
    className: "inp",
    value: weight,
    onChange: e => setWeight(e.target.value),
    placeholder: "e.g. 14"
  })), React.createElement("div", null, React.createElement("label", {
    style: lbl
  }, "Height (cm, for BSA)"), React.createElement("input", {
    className: "inp",
    value: height,
    onChange: e => setHeight(e.target.value),
    placeholder: "optional"
  })), React.createElement("div", null, React.createElement("label", {
    style: lbl
  }, "Dose (mg/kg/day)"), React.createElement("input", {
    className: "inp",
    value: perKg,
    onChange: e => setPerKg(e.target.value),
    placeholder: "from the monograph"
  })), React.createElement("div", null, React.createElement("label", {
    style: lbl
  }, "Doses per day"), React.createElement("select", {
    className: "inp",
    value: perDay,
    onChange: e => setPerDay(e.target.value)
  }, [1, 2, 3, 4, 6].map(x => React.createElement("option", {
    key: x,
    value: x
  }, x, " (", ['', 'OD', 'BD', 'TDS', 'QDS', '', '6-hourly'][x] || '', ")"))))), React.createElement("div", null, React.createElement("label", {
    style: lbl
  }, "Maximum daily dose (mg, optional)"), React.createElement("input", {
    className: "inp",
    value: maxDaily,
    onChange: e => setMaxDaily(e.target.value),
    placeholder: "adult ceiling, if any"
  })), React.createElement("div", {
    style: {
      marginTop: 6,
      padding: '14px 16px',
      borderRadius: 11,
      background: overCap ? 'rgba(210,58,82,.07)' : 'rgba(0,144,202,.06)',
      border: '1px solid ' + (overCap ? 'rgba(210,58,82,.3)' : 'rgba(0,144,202,.15)')
    }
  }, daily == null ? React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: MK.MUTED
    }
  }, "Enter a weight and a mg/kg rate.") : React.createElement(React.Fragment, null, React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      gap: 10
    }
  }, React.createElement("span", {
    style: {
      fontSize: 12,
      color: MK.MUTED
    }
  }, "Total daily dose"), React.createElement("span", {
    style: {
      fontSize: 21,
      fontWeight: 800,
      fontFamily: MK.MONO,
      color: overCap ? '#d23a52' : MK.INK
    }
  }, daily.toFixed(1), " mg")), perDose != null ? React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      gap: 10,
      marginTop: 6
    }
  }, React.createElement("span", {
    style: {
      fontSize: 12,
      color: MK.MUTED
    }
  }, "Each dose (", n, "\xD7 daily)"), React.createElement("span", {
    style: {
      fontSize: 17,
      fontWeight: 800,
      fontFamily: MK.MONO,
      color: MK.INK
    }
  }, perDose.toFixed(1), " mg")) : null, overCap ? React.createElement("div", {
    style: {
      fontSize: 12,
      color: '#d23a52',
      fontWeight: 700,
      marginTop: 9
    }
  }, "Over the maximum you entered (", cap, " mg/day) \u2014 reduce the rate or cap the dose.") : null), bsa != null ? React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      marginTop: 10,
      paddingTop: 9,
      borderTop: '1px solid ' + MK.LINE
    }
  }, React.createElement("span", {
    style: {
      fontSize: 12,
      color: MK.MUTED
    }
  }, "Body surface area (Mosteller)"), React.createElement("span", {
    style: {
      fontSize: 14,
      fontWeight: 700,
      fontFamily: MK.MONO,
      color: MK.INK
    }
  }, bsa.toFixed(2), " m\xB2")) : null), React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: MK.FAINT,
      lineHeight: 1.55
    }
  }, "This is arithmetic, not advice. The mg/kg rate is yours to supply from the monograph or your protocol \u2014 the index states a machine-readable rate for only about one drug in ten, so nothing here is filled in for you."))), React.createElement("div", {
    style: cardOpen()
  }, React.createElement("div", {
    style: MK.cardHead
  }, React.createElement("div", {
    style: MK.h3
  }, "Dosage from the monograph")), React.createElement("div", {
    style: {
      padding: '16px 19px'
    }
  }, React.createElement(DrugSearchBox, {
    value: q,
    onChange: setQ,
    onPick: pick,
    placeholder: "Look up a drug's dosage section"
  }), gen ? React.createElement("div", {
    style: {
      marginTop: 14
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      marginBottom: 9,
      flexWrap: 'wrap'
    }
  }, React.createElement("span", {
    style: {
      fontSize: 14,
      fontWeight: 800,
      color: MK.INK
    }
  }, gen.name), React.createElement(PregChip, {
    cat: gen.pregnancyCategory
  }), React.createElement(AbxChip, {
    on: gen.abx
  })), gen.monograph && gen.monograph.dosage ? React.createElement("div", {
    style: {
      fontSize: 12.5,
      lineHeight: 1.65,
      color: MK.BODY,
      maxHeight: 420,
      overflowY: 'auto'
    }
  }, React.createElement(Monograph, {
    html: gen.monograph.dosage
  })) : React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: MK.MUTED
    }
  }, "No dosage section recorded for this generic."), gen.monograph && gen.monograph.pediatric ? React.createElement("div", {
    style: {
      marginTop: 12,
      paddingTop: 11,
      borderTop: '1px solid ' + MK.LINE
    }
  }, React.createElement("div", {
    style: {
      fontSize: 10.5,
      fontWeight: 800,
      textTransform: 'uppercase',
      letterSpacing: .5,
      color: MK.FAINT,
      marginBottom: 5
    }
  }, "Paediatric use"), React.createElement("div", {
    style: {
      fontSize: 12.5,
      lineHeight: 1.6,
      color: MK.BODY
    }
  }, React.createElement(Monograph, {
    html: gen.monograph.pediatric
  }))) : null) : React.createElement(MedEmpty, {
    icon: I.doc,
    title: "Search a drug",
    note: "Its dosage and paediatric sections appear here, next to the calculator."
  })))));
}
const lbl = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  color: MK.MUTED,
  marginBottom: 4
};
function MedAnalytics({
  setRoute
}) {
  const [d, setD] = useState({
    loading: true
  });
  const [range, setRange] = useState({
    from: '',
    to: ''
  });
  useEffect(() => {
    setD(x => ({
      ...x,
      loading: true
    }));
    medApi.get('/api/med/analytics?' + qs(range)).then(r => setD({
      loading: false,
      ...r
    })).catch(() => setD({
      loading: false,
      ok: false
    }));
  }, [range.from, range.to]);
  if (d.loading) return React.createElement("div", {
    style: MK.page
  }, React.createElement("div", {
    style: {
      padding: 40,
      textAlign: 'center',
      color: MK.FAINT
    }
  }, "Building the summary\u2026"));
  if (!d.ok) return React.createElement("div", {
    style: MK.page
  }, React.createElement("div", {
    style: MK.card
  }, React.createElement(MedEmpty, {
    title: "Could not build the summary"
  })));
  if (!d.totals.prescriptions) {
    return React.createElement("div", {
      style: MK.page
    }, React.createElement("div", {
      style: MK.card
    }, React.createElement(MedEmpty, {
      icon: I.trend,
      title: "No prescriptions to analyse yet",
      note: "Once prescriptions are written, this shows what is being prescribed, for what, by whom \u2014 and the antibiotic share.",
      action: React.createElement("button", {
        style: MK.btnPri,
        onClick: () => setRoute({
          view: 'medRxNew'
        })
      }, "Write one")
    })));
  }
  const max = Math.max(1, ...d.topDrugs.map(x => x.n));
  const Bar = ({
    rows,
    tone
  }) => React.createElement("div", null, rows.map((r, i) => React.createElement("div", {
    key: i,
    style: {
      marginBottom: 7
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 12,
      marginBottom: 3
    }
  }, React.createElement("span", {
    style: {
      color: MK.BODY,
      fontWeight: 600
    }
  }, r.name), React.createElement("span", {
    style: {
      fontFamily: MK.MONO,
      color: MK.MUTED
    }
  }, r.n)), React.createElement("div", {
    style: {
      height: 6,
      borderRadius: 3,
      background: 'rgba(125,145,180,.14)'
    }
  }, React.createElement("div", {
    style: {
      height: 6,
      borderRadius: 3,
      width: Math.round(r.n / Math.max(1, ...rows.map(x => x.n)) * 100) + '%',
      background: tone || '#27a8db'
    }
  })))));
  return React.createElement("div", {
    style: MK.page
  }, React.createElement("div", {
    style: {
      ...MK.card,
      marginBottom: 13
    }
  }, React.createElement("div", {
    style: {
      padding: '14px 18px',
      display: 'flex',
      gap: 10,
      flexWrap: 'wrap',
      alignItems: 'center'
    }
  }, React.createElement("span", {
    style: {
      fontSize: 12,
      color: MK.MUTED
    }
  }, "Period"), React.createElement("input", {
    className: "inp",
    type: "date",
    value: range.from,
    onChange: e => setRange(x => ({
      ...x,
      from: e.target.value
    })),
    style: {
      fontSize: 12
    }
  }), React.createElement("span", {
    style: {
      color: MK.FAINT
    }
  }, "\u2192"), React.createElement("input", {
    className: "inp",
    type: "date",
    value: range.to,
    onChange: e => setRange(x => ({
      ...x,
      to: e.target.value
    })),
    style: {
      fontSize: 12
    }
  }), range.from || range.to ? React.createElement("button", {
    style: MK.btnGhost,
    onClick: () => setRange({
      from: '',
      to: ''
    })
  }, "All time") : null)), React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))',
      gap: 13,
      marginBottom: 13
    }
  }, [['Prescriptions', d.totals.prescriptions], ['Drug lines', d.totals.items], ['Patients', d.totals.patients], ['Contain an antibiotic', d.antibiotics.pct + '%']].map(([label, val], i) => React.createElement("div", {
    key: i,
    style: {
      ...MK.card,
      padding: '15px 18px'
    }
  }, React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: MK.MUTED,
      textTransform: 'uppercase',
      letterSpacing: .5,
      marginBottom: 6
    }
  }, label), React.createElement("div", {
    style: {
      fontSize: 24,
      fontWeight: 800,
      color: i === 3 && d.antibiotics.pct > 30 ? '#d23a52' : MK.INK,
      fontFamily: MK.MONO
    }
  }, val), i === 3 ? React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: MK.FAINT,
      marginTop: 3
    }
  }, d.antibiotics.prescriptions, " of ", d.antibiotics.of, " prescriptions") : null))), React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))',
      gap: 13
    }
  }, React.createElement("div", {
    style: MK.card
  }, React.createElement("div", {
    style: MK.cardHead
  }, React.createElement("div", {
    style: MK.h3
  }, "Most prescribed")), React.createElement("div", {
    style: MK.cardBody
  }, React.createElement(Bar, {
    rows: d.topDrugs.slice(0, 12)
  }))), React.createElement("div", {
    style: MK.card
  }, React.createElement("div", {
    style: MK.cardHead
  }, React.createElement("div", {
    style: MK.h3
  }, "Most common diagnoses")), React.createElement("div", {
    style: MK.cardBody
  }, d.topDiagnoses.length ? React.createElement(Bar, {
    rows: d.topDiagnoses,
    tone: "#2b8f83"
  }) : React.createElement(MedEmpty, {
    title: "No diagnoses recorded"
  }))), React.createElement("div", {
    style: MK.card
  }, React.createElement("div", {
    style: MK.cardHead
  }, React.createElement("div", {
    style: MK.h3
  }, "By prescriber")), React.createElement("div", {
    style: MK.cardBody
  }, d.byDoctor.length ? React.createElement(Bar, {
    rows: d.byDoctor,
    tone: "#6a52d4"
  }) : React.createElement(MedEmpty, {
    title: "No prescribers recorded"
  }))), React.createElement("div", {
    style: MK.card
  }, React.createElement("div", {
    style: MK.cardHead
  }, React.createElement("div", {
    style: MK.h3
  }, "By month")), React.createElement("div", {
    style: MK.cardBody
  }, d.byMonth.length ? React.createElement(Bar, {
    rows: d.byMonth.map(m => ({
      name: m.month,
      n: m.n
    })),
    tone: "#e08a1e"
  }) : React.createElement(MedEmpty, {
    title: "Not enough history yet"
  })))));
}
function MedicineView({
  view,
  id,
  rx,
  q,
  setRoute
}) {
  useEffect(() => {
    medInjectStyle();
  }, []);
  if (view === 'medInfo' && window.MedicineInfoV2) return React.createElement(window.MedicineInfoV2, {
    setRoute: setRoute
  });
  if (view === 'medBrowse') return React.createElement(MedBrowse, {
    setRoute: setRoute,
    initialQ: q
  });
  if (view === 'medBrand') return React.createElement(MedBrand, {
    id: id,
    setRoute: setRoute
  });
  if (view === 'medGeneric') return React.createElement(MedGeneric, {
    id: id,
    setRoute: setRoute
  });
  if (view === 'medRxNew') return React.createElement(RxEditor, {
    rxId: rx,
    seedId: id,
    setRoute: setRoute
  });
  if (view === 'medRxList') return React.createElement(MedRxList, {
    setRoute: setRoute
  });
  if (view === 'medRxPrint') return React.createElement(MedRxPrint, {
    rxId: rx,
    setRoute: setRoute
  });
  if (view === 'medTemplates') return React.createElement(MedTemplates, {
    setRoute: setRoute
  });
  if (view === 'medCatalog') return React.createElement(MedCatalog, {
    setRoute: setRoute
  });
  if (view === 'medInteractions') return React.createElement(MedInteractions, {
    setRoute: setRoute
  });
  if (view === 'medCalc') return React.createElement(MedCalc, null);
  if (view === 'medAnalytics') return React.createElement(MedAnalytics, {
    setRoute: setRoute
  });
  return React.createElement(MedHome, {
    setRoute: setRoute
  });
}
function medInjectStyle() {
  if (typeof document === 'undefined' || document.getElementById('med-style')) return;
  const el = document.createElement('style');
  el.id = 'med-style';
  el.textContent = ['.mono-body ul,.mono-body ol{margin:6px 0 6px 18px;padding:0}', '.mono-body li{margin:3px 0}', '.mono-body strong{color:#16202e}', '.mono-body h4,.mono-body h5{font-size:12.5px;margin:9px 0 4px;color:#16202e}', '.mono-body table{border-collapse:collapse;width:100%;margin:7px 0;font-size:11.5px}', '.mono-body td,.mono-body th{border:1px solid rgba(125,145,180,.3);padding:4px 7px;text-align:left}', '.row-btn:hover{background:rgba(0,144,202,.07)!important}', '@media (max-width:1180px){.med-2col{grid-template-columns:minmax(0,1fr)!important}}', '@media print{.no-print{display:none!important}}'].join('\n');
  document.head.appendChild(el);
}
Object.assign(window, {
  MedicineView,
  DrugSearchBox,
  medApi
});
})();
